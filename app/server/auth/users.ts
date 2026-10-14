import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { newId, nowIso, randomToken, sha256 } from '../lib/util.js';

export type Role = 'patient' | 'practitioner' | 'reception' | 'admin';
export const STAFF_ROLES: Role[] = ['practitioner', 'reception', 'admin'];

export interface AppUser {
  id: string;
  email: string;
  password_hash: string;
  roles: Role[];
  fhir_ref: string | null;
  display_name: string;
  locale: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  email_verified: boolean;
  must_change_password: boolean;
  failed_logins: number;
  locked_until: string | null;
  status: 'active' | 'disabled' | 'deletion-requested';
  created_at: string;
  last_login_at: string | null;
  /** Organizacja (klinika) personelu; pacjent — null. */
  org_id: string | null;
  phone: string | null;
  phone_verified: boolean;
}

interface UserRow extends Omit<AppUser, 'roles' | 'totp_enabled' | 'email_verified' | 'must_change_password' | 'phone_verified'> {
  roles: string;
  totp_enabled: number;
  email_verified: number;
  must_change_password: number;
  phone_verified: number;
}

function fromRow(row: UserRow | undefined): AppUser | undefined {
  if (!row) return undefined;
  return {
    ...row,
    roles: row.roles.split(',').filter(Boolean) as Role[],
    totp_enabled: !!row.totp_enabled,
    email_verified: !!row.email_verified,
    must_change_password: !!row.must_change_password,
    phone_verified: !!row.phone_verified,
  };
}

export function isStaff(user: Pick<AppUser, 'roles'>): boolean {
  return user.roles.some((r) => STAFF_ROLES.includes(r));
}

export function findUserByEmail(email: string): AppUser | undefined {
  return fromRow(getDb().prepare('SELECT * FROM app_user WHERE email = ?').get(email.trim()) as UserRow | undefined);
}

export function findUserById(id: string): AppUser | undefined {
  return fromRow(getDb().prepare('SELECT * FROM app_user WHERE id = ?').get(id) as UserRow | undefined);
}

export function findUserByFhirRef(ref: string): AppUser | undefined {
  return fromRow(getDb().prepare('SELECT * FROM app_user WHERE fhir_ref = ?').get(ref) as UserRow | undefined);
}

export function listUsers(filter: { staffOnly?: boolean; orgId?: string } = {}): AppUser[] {
  const rows = (
    filter.orgId
      ? getDb().prepare('SELECT * FROM app_user WHERE org_id = ? ORDER BY display_name').all(filter.orgId)
      : getDb().prepare('SELECT * FROM app_user ORDER BY display_name').all()
  ) as unknown as UserRow[];
  const users = rows.map((r) => fromRow(r)!);
  return filter.staffOnly ? users.filter(isStaff) : users;
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  roles: Role[];
  fhirRef?: string;
  displayName: string;
  locale?: string;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  orgId?: string;
  phone?: string;
}): AppUser {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO app_user (id, email, password_hash, roles, fhir_ref, display_name, locale, email_verified, must_change_password, created_at, org_id, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.email.trim().toLowerCase(),
      input.passwordHash,
      input.roles.join(','),
      input.fhirRef ?? null,
      input.displayName,
      input.locale ?? 'pl',
      input.emailVerified ? 1 : 0,
      input.mustChangePassword ? 1 : 0,
      nowIso(),
      input.orgId ?? null,
      input.phone ?? null,
    );
  return findUserById(id)!;
}

type Updatable = Partial<{
  password_hash: string;
  roles: Role[];
  fhir_ref: string | null;
  display_name: string;
  locale: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  email_verified: boolean;
  must_change_password: boolean;
  failed_logins: number;
  locked_until: string | null;
  status: AppUser['status'];
  last_login_at: string;
  org_id: string | null;
  phone: string | null;
  phone_verified: boolean;
}>;

export function updateUser(id: string, patch: Updatable): void {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    if (k === 'roles') args.push((v as Role[]).join(','));
    else if (typeof v === 'boolean') args.push(v ? 1 : 0);
    else args.push(v as string | number | null);
  }
  if (sets.length === 0) return;
  args.push(id);
  getDb().prepare(`UPDATE app_user SET ${sets.join(', ')} WHERE id = ?`).run(...args);
}

// --- tokeny jednorazowe (weryfikacja e-mail, reset hasła, kody aktywacyjne, stan OAuth) -----------------

export type TokenPurpose =
  | 'email-verify'
  | 'password-reset'
  | 'patient-activation'
  | 'oauth-state'
  | 'phone-verify'
  | 'magic-link'
  | 'staff-invite'
  | 'webauthn-challenge'
  | 'link-takeover';

const ACTIVATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function issueToken(
  purpose: TokenPurpose,
  opts: { userId?: string; payload?: unknown; ttlMinutes: number; code?: 'activation' },
): string {
  let token: string;
  if (opts.code === 'activation') {
    const bytes = randomToken(16);
    token = Array.from({ length: 10 }, (_, i) => ACTIVATION_ALPHABET[bytes.charCodeAt(i) % ACTIVATION_ALPHABET.length]).join('');
  } else {
    token = randomToken(32);
  }
  const now = new Date();
  getDb()
    .prepare('INSERT INTO one_time_token (token_hash, purpose, user_id, payload, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      sha256(normalizeToken(token)),
      purpose,
      opts.userId ?? null,
      opts.payload === undefined ? null : JSON.stringify(opts.payload),
      new Date(now.getTime() + opts.ttlMinutes * 60_000).toISOString(),
      now.toISOString(),
    );
  return opts.code === 'activation' ? `${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}` : token;
}

function normalizeToken(token: string): string {
  return /^[A-Z0-9-]{10,14}$/i.test(token) ? token.replace(/-/g, '').toUpperCase() : token;
}

export function consumeToken<T = unknown>(purpose: TokenPurpose, token: string): { userId: string | null; payload: T } | undefined {
  const db = getDb();
  const hash = sha256(normalizeToken(token.trim()));
  const row = db.prepare('SELECT * FROM one_time_token WHERE token_hash = ? AND purpose = ?').get(hash, purpose) as
    | { user_id: string | null; payload: string | null; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || row.expires_at < nowIso()) return undefined;
  const res = db.prepare('UPDATE one_time_token SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(nowIso(), hash);
  if (res.changes !== 1) return undefined;
  return { userId: row.user_id, payload: (row.payload ? JSON.parse(row.payload) : null) as T };
}

export function peekToken<T = unknown>(purpose: TokenPurpose, token: string): { userId: string | null; payload: T } | undefined {
  const hash = sha256(normalizeToken(token.trim()));
  const row = getDb().prepare('SELECT * FROM one_time_token WHERE token_hash = ? AND purpose = ?').get(hash, purpose) as
    | { user_id: string | null; payload: string | null; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || row.expires_at < nowIso()) return undefined;
  return { userId: row.user_id, payload: (row.payload ? JSON.parse(row.payload) : null) as T };
}

// --- kody 6-cyfrowe (weryfikacja telefonu SMS-em) — jeden aktywny kod na konto i cel, limit prób -----------

const CODE_ATTEMPTS = 5;

export function issueCode(purpose: 'phone-verify', userId: string, payload: unknown, ttlMinutes = 10): string {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  getDb()
    .prepare(
      `INSERT INTO app_code (purpose, user_id, code_hash, payload, attempts, expires_at, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(purpose, user_id) DO UPDATE SET code_hash = excluded.code_hash, payload = excluded.payload, attempts = 0,
         expires_at = excluded.expires_at, created_at = excluded.created_at`,
    )
    .run(purpose, userId, sha256(`${purpose}:${userId}:${code}`), JSON.stringify(payload), new Date(now.getTime() + ttlMinutes * 60_000).toISOString(), now.toISOString());
  return code;
}

export function consumeCode<T>(purpose: 'phone-verify', userId: string, code: string): { ok: true; payload: T } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM app_code WHERE purpose = ? AND user_id = ?').get(purpose, userId) as
    | { code_hash: string; payload: string; attempts: number; expires_at: string }
    | undefined;
  if (!row || row.expires_at < nowIso()) return { ok: false, reason: 'expired' };
  if (row.attempts >= CODE_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (sha256(`${purpose}:${userId}:${code.trim()}`) !== row.code_hash) {
    db.prepare('UPDATE app_code SET attempts = attempts + 1 WHERE purpose = ? AND user_id = ?').run(purpose, userId);
    return { ok: false, reason: 'invalid' };
  }
  db.prepare('DELETE FROM app_code WHERE purpose = ? AND user_id = ?').run(purpose, userId);
  return { ok: true, payload: JSON.parse(row.payload) as T };
}
