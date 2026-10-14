import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { forbidden, nowIso, randomToken, sha256, unauthorized } from '../lib/util.js';
import { type AppUser, findUserById, isStaff, type Role } from './users.js';

export const SESSION_COOKIE = config.isProduction ? '__Host-eternal_sid' : 'eternal_sid';

export interface AuthContext {
  user: AppUser;
  sessionHash: string;
  csrfToken: string;
  mfaPassed: boolean;
  /** Sesja aplikacji mobilnej (nagłówek Authorization) — bez ciasteczka, więc bez ryzyka CSRF. */
  bearer?: boolean;
  /** Token zwracany aplikacji mobilnej tylko w odpowiedzi na logowanie. */
  bearerToken?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

interface SessionRow {
  id_hash: string;
  user_id: string;
  csrf_token: string;
  mfa_passed: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

function idleMinutes(user: AppUser): number {
  return isStaff(user) ? config.security.staffIdleMinutes : config.security.patientIdleMinutes;
}

function deviceLabel(ua: string | undefined, mobile: boolean): string {
  const u = ua ?? '';
  const os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '';
  const app = mobile ? 'aplikacja Eternal' : /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'przeglądarka';
  return [app, os].filter(Boolean).join(' · ');
}

export function createSession(
  reply: FastifyReply,
  req: FastifyRequest,
  user: AppUser,
  mfaPassed: boolean,
  opts: { method?: string; bearer?: boolean } = {},
): AuthContext {
  const token = randomToken(32);
  const idHash = sha256(token);
  const csrf = randomToken(24);
  const now = new Date();
  const mobile = !!opts.bearer;
  // aplikacja mobilna: dłuższa sesja odblokowywana biometrią/PIN-em na urządzeniu (F1.2, F1.5)
  const hours = mobile && !isStaff(user) ? 30 * 24 : config.security.sessionAbsoluteHours;
  const expires = new Date(now.getTime() + hours * 3_600_000);
  const db = getDb();
  // F1.13 — najwyżej N urządzeń pacjenta: najdawniej używane zostaje wylogowane
  if (!isStaff(user)) {
    const rows = db.prepare('SELECT id_hash FROM app_session WHERE user_id = ? ORDER BY last_seen_at DESC').all(user.id) as { id_hash: string }[];
    for (const r of rows.slice(Math.max(0, config.security.maxDevices - 1))) db.prepare('DELETE FROM app_session WHERE id_hash = ?').run(r.id_hash);
  }
  db.prepare(
    `INSERT INTO app_session (id_hash, user_id, csrf_token, mfa_passed, created_at, last_seen_at, expires_at, ip, user_agent, device_label, auth_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idHash,
    user.id,
    csrf,
    mfaPassed ? 1 : 0,
    now.toISOString(),
    now.toISOString(),
    expires.toISOString(),
    req.ip,
    req.headers['user-agent']?.slice(0, 300) ?? null,
    deviceLabel(req.headers['user-agent'], mobile),
    opts.method ?? 'password',
  );
  if (!mobile) {
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
      expires,
    });
  }
  const ctx: AuthContext = { user, sessionHash: idHash, csrfToken: csrf, mfaPassed, bearer: mobile, bearerToken: mobile ? token : undefined };
  req.auth = ctx;
  return ctx;
}

export interface SessionView {
  id: string;
  device: string;
  method: string;
  ip?: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export function listSessions(userId: string, currentHash?: string): SessionView[] {
  const rows = getDb().prepare('SELECT * FROM app_session WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC').all(userId, nowIso()) as unknown as (SessionRow & {
    device_label: string | null;
    auth_method: string | null;
    ip: string | null;
  })[];
  return rows.map((r) => ({
    id: r.id_hash.slice(0, 16),
    device: r.device_label ?? 'urządzenie',
    method: r.auth_method ?? 'password',
    ip: r.ip ? r.ip.replace(/\.\d+$/, '.•••') : undefined,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    current: r.id_hash === currentHash,
  }));
}

export function revokeSession(userId: string, shortId: string): boolean {
  const res = getDb().prepare('DELETE FROM app_session WHERE user_id = ? AND substr(id_hash, 1, 16) = ?').run(userId, shortId);
  return res.changes > 0;
}

export function markMfaPassed(ctx: AuthContext): void {
  getDb().prepare('UPDATE app_session SET mfa_passed = 1 WHERE id_hash = ?').run(ctx.sessionHash);
  ctx.mfaPassed = true;
}

export function destroySession(reply: FastifyReply, ctx: AuthContext | undefined): void {
  if (ctx) getDb().prepare('DELETE FROM app_session WHERE id_hash = ?').run(ctx.sessionHash);
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function destroyAllSessions(userId: string, exceptHash?: string): void {
  if (exceptHash) getDb().prepare('DELETE FROM app_session WHERE user_id = ? AND id_hash <> ?').run(userId, exceptHash);
  else getDb().prepare('DELETE FROM app_session WHERE user_id = ?').run(userId);
}

/** Odczytuje sesję z ciasteczka; wygasa po bezczynności i po czasie absolutnym. */
export function loadSession(req: FastifyRequest): AuthContext | undefined {
  const authz = req.headers.authorization;
  const bearer = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : undefined;
  const token = bearer || req.cookies?.[SESSION_COOKIE];
  if (!token) return undefined;
  const db = getDb();
  const idHash = sha256(token);
  const row = db.prepare('SELECT * FROM app_session WHERE id_hash = ?').get(idHash) as SessionRow | undefined;
  if (!row) return undefined;
  const user = findUserById(row.user_id);
  const now = Date.now();
  if (!user || user.status === 'disabled') {
    db.prepare('DELETE FROM app_session WHERE id_hash = ?').run(idHash);
    return undefined;
  }
  const idleLimit = Date.parse(row.last_seen_at) + idleMinutes(user) * 60_000;
  if (Date.parse(row.expires_at) < now || idleLimit < now) {
    db.prepare('DELETE FROM app_session WHERE id_hash = ?').run(idHash);
    return undefined;
  }
  if (now - Date.parse(row.last_seen_at) > 30_000) {
    db.prepare('UPDATE app_session SET last_seen_at = ? WHERE id_hash = ?').run(nowIso(), idHash);
  }
  return { user, sessionHash: idHash, csrfToken: row.csrf_token, mfaPassed: !!row.mfa_passed, bearer: !!bearer };
}

export function purgeExpiredSessions(): void {
  getDb().prepare('DELETE FROM app_session WHERE expires_at < ?').run(nowIso());
}

// --- strażnicy -----------------------------------------------------------------------------------

export function requireUser(req: FastifyRequest): AuthContext {
  const auth = req.auth;
  if (!auth) throw unauthorized('unauthenticated');
  const needsMfa = isStaff(auth.user) || auth.user.totp_enabled;
  if (needsMfa && !auth.mfaPassed) throw forbidden('mfa_required');
  return auth;
}

export function requirePatient(req: FastifyRequest): AuthContext & { patientRef: string } {
  const auth = requireUser(req);
  if (!auth.user.roles.includes('patient') || !auth.user.fhir_ref) throw forbidden('patient_only');
  return { ...auth, patientRef: auth.user.fhir_ref };
}

export function requireStaff(req: FastifyRequest, roles: Role[] = ['practitioner', 'reception', 'admin']): AuthContext {
  const auth = requireUser(req);
  if (!isStaff(auth.user)) throw forbidden('staff_only');
  if (!auth.user.roles.some((r) => roles.includes(r))) throw forbidden('insufficient_role');
  return auth;
}

/** Dostęp do treści klinicznej (wyniki, pomiary, odpowiedzi z wywiadu) — zasada najmniejszych uprawnień. */
export function requireClinician(req: FastifyRequest): AuthContext {
  return requireStaff(req, ['practitioner']);
}

export function actorOf(req: FastifyRequest): AuditActor {
  const u = req.auth?.user;
  return {
    userId: u?.id,
    actorRef: u?.fhir_ref ?? (u ? `urn:eternal:user:${u.id}` : undefined),
    display: u?.display_name,
    roles: u?.roles,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
