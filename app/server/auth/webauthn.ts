import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { badRequest, notFound, nowIso, unauthorized } from '../lib/util.js';
import { type AppUser, consumeToken, findUserById, issueToken } from './users.js';

/**
 * Klucze dostępu i klucze sprzętowe (WebAuthn/FIDO2): F1.10 (YubiKey jako drugi składnik personelu),
 * P1 (logowanie pacjenta kluczem dostępu z biometrią telefonu). Wyzwanie jednorazowe, ważne 5 minut.
 */

export function rpId(): string {
  return new URL(config.publicUrl).hostname;
}

export function expectedOrigins(): string[] {
  const out = [config.publicUrl];
  if (!config.isProduction) out.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000');
  return [...new Set(out)];
}

interface CredRow {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function credentialsOf(userId: string): CredRow[] {
  return getDb().prepare('SELECT * FROM webauthn_credential WHERE user_id = ? ORDER BY created_at').all(userId) as unknown as CredRow[];
}

export function credentialViews(userId: string) {
  return credentialsOf(userId).map((c) => ({ id: c.id.slice(0, 16), label: c.label ?? 'Klucz', createdAt: c.created_at, lastUsedAt: c.last_used_at ?? undefined, transports: c.transports ? (JSON.parse(c.transports) as string[]) : [] }));
}

export async function registrationOptions(user: AppUser): Promise<{ flowId: string; options: unknown }> {
  const options = await generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: rpId(),
    userName: user.email,
    userDisplayName: user.display_name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: credentialsOf(user.id).map((c) => ({ id: c.id, transports: c.transports ? (JSON.parse(c.transports) as string[]) : undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  const flowId = issueToken('webauthn-challenge', { userId: user.id, payload: { challenge: options.challenge, kind: 'register' }, ttlMinutes: 5 });
  return { flowId, options };
}

export async function verifyRegistration(user: AppUser, flowId: string, response: RegistrationResponseJSON, label?: string): Promise<{ id: string }> {
  const flow = consumeToken<{ challenge: string; kind: string }>('webauthn-challenge', flowId);
  if (!flow || flow.userId !== user.id || flow.payload.kind !== 'register') throw badRequest('webauthn_flow_invalid');
  const v = await verifyRegistrationResponse({ response, expectedChallenge: flow.payload.challenge, expectedOrigin: expectedOrigins(), expectedRPID: rpId(), requireUserVerification: false });
  if (!v.verified) throw badRequest('webauthn_not_verified');
  const c = v.registrationInfo.credential;
  getDb()
    .prepare('INSERT INTO webauthn_credential (id, user_id, public_key, counter, transports, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(c.id, user.id, Buffer.from(c.publicKey).toString('base64url'), c.counter, c.transports ? JSON.stringify(c.transports) : null, (label ?? '').slice(0, 60) || (v.registrationInfo.credentialDeviceType === 'multiDevice' ? 'Klucz dostępu' : 'Klucz sprzętowy'), nowIso());
  return { id: c.id.slice(0, 16) };
}

export async function authenticationOptions(user?: AppUser, kind: 'login' | 'mfa' = 'login'): Promise<{ flowId: string; options: unknown }> {
  const creds = user ? credentialsOf(user.id) : [];
  if (user && !creds.length) throw notFound('no_credentials');
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports ? (JSON.parse(c.transports) as string[]) : undefined })),
    userVerification: kind === 'login' ? 'required' : 'preferred',
  });
  const flowId = issueToken('webauthn-challenge', { userId: user?.id, payload: { challenge: options.challenge, kind }, ttlMinutes: 5 });
  return { flowId, options };
}

/** Weryfikacja podpisu; zwraca konto i informację, czy urządzenie potwierdziło użytkownika (biometria/PIN). */
export async function verifyAuthentication(flowId: string, response: AuthenticationResponseJSON, kind: 'login' | 'mfa', sessionUserId?: string): Promise<{ user: AppUser; userVerified: boolean }> {
  const flow = consumeToken<{ challenge: string; kind: string }>('webauthn-challenge', flowId);
  if (!flow || flow.payload.kind !== kind) throw badRequest('webauthn_flow_invalid');
  const cred = getDb().prepare('SELECT * FROM webauthn_credential WHERE id = ?').get(response.id) as CredRow | undefined;
  if (!cred) throw unauthorized('webauthn_unknown_credential');
  if (flow.userId && flow.userId !== cred.user_id) throw unauthorized('webauthn_wrong_user');
  if (sessionUserId && sessionUserId !== cred.user_id) throw unauthorized('webauthn_wrong_user');
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: flow.payload.challenge,
    expectedOrigin: expectedOrigins(),
    expectedRPID: rpId(),
    credential: { id: cred.id, publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64url')), counter: cred.counter, transports: cred.transports ? JSON.parse(cred.transports) : undefined },
    requireUserVerification: kind === 'login',
  });
  if (!v.verified) throw unauthorized('webauthn_not_verified');
  getDb().prepare('UPDATE webauthn_credential SET counter = ?, last_used_at = ? WHERE id = ?').run(v.authenticationInfo.newCounter, nowIso(), cred.id);
  const user = findUserById(cred.user_id);
  if (!user || user.status === 'disabled') throw unauthorized('account_disabled');
  return { user, userVerified: v.authenticationInfo.userVerified };
}

export function removeCredential(userId: string, shortId: string): void {
  const res = getDb().prepare('DELETE FROM webauthn_credential WHERE user_id = ? AND substr(id, 1, 16) = ?').run(userId, shortId);
  if (!res.changes) throw notFound('credential_not_found');
}

// --- kody odzyskiwania (F1.4) -------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 10 jednorazowych kodów. W bazie tylko skrót SHA-256 (kodu nie da się odczytać nawet z kopii bazy) —
 * mocniejsze niż szyfrowanie AES-256 z pliku 1 (F1.4), bo nie wymaga przechowywania klucza.
 */
export function generateRecoveryCodes(userId: string): string[] {
  const codes = Array.from({ length: 10 }, () => {
    const raw = Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  const db = getDb();
  db.prepare('DELETE FROM recovery_code WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT INTO recovery_code (user_id, code_hash, created_at) VALUES (?, ?, ?)');
  for (const c of codes) ins.run(userId, crypto.createHash('sha256').update(`${userId}:${c.replace('-', '')}`).digest('hex'), nowIso());
  return codes;
}

export function recoveryCodesLeft(userId: string): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM recovery_code WHERE user_id = ? AND used_at IS NULL').get(userId) as { n: number }).n;
}

export function useRecoveryCode(userId: string, code: string): boolean {
  const norm = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (norm.length !== 8) return false;
  const hash = crypto.createHash('sha256').update(`${userId}:${norm}`).digest('hex');
  const res = getDb().prepare('UPDATE recovery_code SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL').run(nowIso(), userId, hash);
  return res.changes === 1;
}

