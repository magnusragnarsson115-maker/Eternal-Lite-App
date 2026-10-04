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

export function createSession(reply: FastifyReply, req: FastifyRequest, user: AppUser, mfaPassed: boolean): AuthContext {
  const token = randomToken(32);
  const idHash = sha256(token);
  const csrf = randomToken(24);
  const now = new Date();
  const expires = new Date(now.getTime() + config.security.sessionAbsoluteHours * 3_600_000);
  getDb()
    .prepare(
      `INSERT INTO app_session (id_hash, user_id, csrf_token, mfa_passed, created_at, last_seen_at, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(idHash, user.id, csrf, mfaPassed ? 1 : 0, now.toISOString(), now.toISOString(), expires.toISOString(), req.ip, req.headers['user-agent']?.slice(0, 300) ?? null);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    expires,
  });
  const ctx = { user, sessionHash: idHash, csrfToken: csrf, mfaPassed };
  req.auth = ctx;
  return ctx;
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
  const token = req.cookies?.[SESSION_COOKIE];
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
  return { user, sessionHash: idHash, csrfToken: row.csrf_token, mfaPassed: !!row.mfa_passed };
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
