import type { Patient } from '@medplum/fhirtypes';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { finishOidc, oidcEnabled, startOidc } from '../auth/oidc.js';
import { actorOf, createSession, listSessions, markMfaPassed, requireUser, revokeSession } from '../auth/sessions.js';
import { consumeCode, consumeToken, findUserByEmail, findUserById, isStaff, issueCode, issueToken, updateUser } from '../auth/users.js';
import {
  authenticationOptions,
  credentialsOf,
  credentialViews,
  generateRecoveryCodes,
  recoveryCodesLeft,
  registrationOptions,
  removeCredential,
  useRecoveryCode,
  verifyAuthentication,
  verifyRegistration,
} from '../auth/webauthn.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { normalizePolishPhone } from '../integrations/channels.js';
import { body, params, query } from '../lib/http.js';
import { authLimiter } from '../lib/ratelimit.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/util.js';
import { getClinicSettings } from '../services/directory.js';
import { enqueue, notifyUser } from '../services/notifications.js';
import { meResponse } from './auth.js';

/**
 * Konto i logowanie (P1, MVP; F1.10 dla personelu): klucze dostępu i sprzętowe (WebAuthn), logowanie linkiem z e-maila,
 * kody odzyskiwania, weryfikacja telefonu SMS-em, lista urządzeń z wylogowaniem, logowanie OIDC (D50),
 * sesja aplikacji mobilnej (token w bezpiecznym magazynie telefonu).
 */

const AnyJson = z.record(z.string(), z.unknown());

/** Rejestracja klucza: po pełnym zalogowaniu albo — dla personelu bez żadnego drugiego składnika — w trakcie wdrożenia. */
function canEnroll(req: FastifyRequest) {
  const auth = req.auth;
  if (!auth) throw unauthorized();
  const enrolling = isStaff(auth.user) && !auth.user.totp_enabled && credentialsOf(auth.user.id).length === 0;
  if (!auth.mfaPassed && !enrolling) throw forbidden('mfa_required');
  return auth;
}

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // --- WebAuthn: rejestracja ------------------------------------------------------------------------
  app.post('/api/auth/webauthn/register/options', async (req) => {
    const auth = canEnroll(req);
    return registrationOptions(auth.user);
  });

  app.post('/api/auth/webauthn/register/verify', async (req) => {
    const auth = canEnroll(req);
    const input = body(req, z.object({ flowId: z.string().max(80), response: AnyJson, label: z.string().max(60).optional() }));
    const res = await verifyRegistration(auth.user, input.flowId, input.response as unknown as RegistrationResponseJSON, input.label);
    if (!auth.mfaPassed) markMfaPassed(auth); // wdrożenie personelu: rejestracja klucza kończy konfigurację drugiego składnika
    audit(actorOf(req), { action: 'C', subtype: 'webauthn-register', detail: { credential: res.id } });
    await notifyUser(auth.user.id, { kind: 'security', title: 'Dodano klucz dostępu', body: 'Do konta dodano nowy klucz dostępu. Jeśli to nie Ty — usuń go i zmień hasło.', link: isStaff(auth.user) ? '/panel/konto' : '/profil', push: false });
    return { ...res, me: await meResponse(req) };
  });

  app.get('/api/auth/webauthn/credentials', async (req) => {
    const auth = requireUser(req);
    return { items: credentialViews(auth.user.id) };
  });

  app.delete('/api/auth/webauthn/credentials/:id', async (req) => {
    const auth = requireUser(req);
    const { id } = params(req, z.object({ id: z.string().max(20) }));
    if (isStaff(auth.user) && !auth.user.totp_enabled && credentialsOf(auth.user.id).length <= 1) throw conflict('last_second_factor');
    removeCredential(auth.user.id, id);
    audit(actorOf(req), { action: 'D', subtype: 'webauthn-remove', detail: { credential: id } });
    return { items: credentialViews(auth.user.id) };
  });

  // --- WebAuthn: logowanie pacjenta kluczem dostępu (bez hasła) ---------------------------------------------
  app.post('/api/auth/webauthn/login/options', async (req) => {
    authLimiter.check(`webauthn:${req.ip}`);
    return authenticationOptions(undefined, 'login');
  });

  app.post('/api/auth/webauthn/login/verify', async (req, reply) => {
    authLimiter.check(`webauthn:${req.ip}`);
    const input = body(req, z.object({ flowId: z.string().max(80), response: AnyJson, client: z.enum(['web', 'mobile']).default('web') }));
    const { user, userVerified } = await verifyAuthentication(input.flowId, input.response as unknown as AuthenticationResponseJSON, 'login');
    // personel loguje się hasłem + drugim składnikiem; sam klucz z weryfikacją użytkownika zastępuje oba składniki tylko u pacjenta
    if (isStaff(user)) throw forbidden('staff_use_password');
    createSession(reply, req, user, userVerified, { method: 'passkey', bearer: input.client === 'mobile' });
    audit({ ...actorOf(req), userId: user.id, actorRef: user.fhir_ref ?? undefined, display: user.display_name, roles: user.roles }, { action: 'E', subtype: 'login', detail: { method: 'passkey' } });
    return meResponse(req);
  });

  // --- WebAuthn jako drugi składnik (F1.10 — klucz sprzętowy personelu) ---------------------------------------
  app.post('/api/auth/mfa/webauthn/options', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    return authenticationOptions(auth.user, 'mfa');
  });

  app.post('/api/auth/mfa/webauthn/verify', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    authLimiter.check(`mfa:${auth.user.id}`);
    const input = body(req, z.object({ flowId: z.string().max(80), response: AnyJson }));
    await verifyAuthentication(input.flowId, input.response as unknown as AuthenticationResponseJSON, 'mfa', auth.user.id);
    markMfaPassed(auth);
    audit(actorOf(req), { action: 'E', subtype: 'login', detail: { method: 'password+security-key' } });
    return meResponse(req);
  });

  // --- kody odzyskiwania (F1.4) ----------------------------------------------------------------------
  app.post('/api/auth/recovery-codes', async (req) => {
    const auth = requireUser(req);
    const codes = generateRecoveryCodes(auth.user.id);
    audit(actorOf(req), { action: 'C', subtype: 'recovery-codes-generate' });
    return { codes };
  });

  app.get('/api/auth/recovery-codes', async (req) => {
    const auth = requireUser(req);
    return { remaining: recoveryCodesLeft(auth.user.id) };
  });

  app.post('/api/auth/mfa/recovery', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    authLimiter.check(`mfa:${auth.user.id}`);
    const { code } = body(req, z.object({ code: z.string().max(20) }));
    if (!useRecoveryCode(auth.user.id, code)) {
      audit(actorOf(req), { action: 'E', subtype: 'mfa-failed', outcome: 'failure', detail: 'recovery_code' });
      throw unauthorized('invalid_code');
    }
    markMfaPassed(auth);
    audit(actorOf(req), { action: 'E', subtype: 'login', detail: { method: 'recovery-code', remaining: recoveryCodesLeft(auth.user.id) } });
    await notifyUser(auth.user.id, { kind: 'security', title: 'Użyto kodu odzyskiwania', body: `Pozostało kodów: ${recoveryCodesLeft(auth.user.id)}. Jeśli to nie Ty — zmień hasło.`, push: false });
    return meResponse(req);
  });

  // --- logowanie linkiem z e-maila (F1.9; tylko pacjenci) -------------------------------------------------
  app.post('/api/auth/magic-link', async (req) => {
    authLimiter.check(`magic:${req.ip}`);
    const { email } = body(req, z.object({ email: z.string().max(200) }));
    const user = findUserByEmail(email);
    if (user && user.status === 'active' && !isStaff(user)) {
      authLimiter.check(`magic:${user.id}`);
      const token = issueToken('magic-link', { userId: user.id, ttlMinutes: 15 });
      enqueue({
        channel: 'email',
        userId: user.id,
        recipient: user.email,
        subject: 'Link do logowania',
        body: `Link do zalogowania w aplikacji ${getClinicSettings().name || 'Eternal'} (ważny 15 minut, jednorazowy):\n${config.publicUrl}/logowanie/link?token=${token}\n\nJeśli to nie Ty — zignoruj wiadomość.`,
        relatedRef: 'security',
        dedupeKey: `magic:${user.id}:${Date.now()}`,
      });
      audit({ ...actorOf(req), userId: user.id, display: user.display_name }, { action: 'E', subtype: 'magic-link-requested' });
    }
    // ta sama odpowiedź niezależnie od istnienia konta
    return { ok: true };
  });

  app.post('/api/auth/magic-link/consume', async (req, reply) => {
    authLimiter.check(`magic:${req.ip}`);
    const input = body(req, z.object({ token: z.string().max(200), client: z.enum(['web', 'mobile']).default('web') }));
    const t = consumeToken('magic-link', input.token);
    const user = t?.userId ? findUserById(t.userId) : undefined;
    if (!user || user.status !== 'active' || isStaff(user)) throw badRequest('invalid_or_expired_token');
    updateUser(user.id, { email_verified: true, last_login_at: new Date().toISOString() });
    createSession(reply, req, findUserById(user.id)!, !user.totp_enabled, { method: 'magic-link', bearer: input.client === 'mobile' });
    audit({ ...actorOf(req), userId: user.id, actorRef: user.fhir_ref ?? undefined, display: user.display_name, roles: user.roles }, { action: 'E', subtype: user.totp_enabled ? 'login-password-ok' : 'login', detail: { method: 'magic-link' } });
    return meResponse(req);
  });

  // --- urządzenia i sesje (F1.13) ----------------------------------------------------------------------
  app.get('/api/auth/sessions', async (req) => {
    const auth = requireUser(req);
    return { items: listSessions(auth.user.id, auth.sessionHash), maxDevices: isStaff(auth.user) ? undefined : config.security.maxDevices };
  });

  app.delete('/api/auth/sessions/:id', async (req) => {
    const auth = requireUser(req);
    const { id } = params(req, z.object({ id: z.string().regex(/^[a-f0-9]{16}$/) }));
    if (!revokeSession(auth.user.id, id)) throw notFound('session_not_found');
    audit(actorOf(req), { action: 'D', subtype: 'session-revoke', detail: { session: id } });
    return { items: listSessions(auth.user.id, auth.sessionHash) };
  });

  // --- telefon: weryfikacja kodem SMS (F1.8) -----------------------------------------------------------
  app.post('/api/me/phone', async (req) => {
    const auth = requireUser(req);
    authLimiter.check(`phone:${auth.user.id}`);
    const { phone } = body(req, z.object({ phone: z.string().max(20) }));
    const number = normalizePolishPhone(phone);
    if (!number) throw badRequest('invalid_phone');
    const code = issueCode('phone-verify', auth.user.id, { phone: `+${number}` });
    enqueue({ channel: 'sms', userId: auth.user.id, recipient: number, subject: '', body: `Kod weryfikacyjny Eternal: ${code}. Nie podawaj go nikomu.`, relatedRef: 'security', dedupeKey: `phone:${auth.user.id}:${Date.now()}` });
    audit(actorOf(req), { action: 'E', subtype: 'phone-verify-requested' });
    return { sent: true, expiresInMinutes: 10, ...(config.demoMode && !config.isProduction ? { demoCode: code } : {}) };
  });

  app.post('/api/me/phone/verify', async (req) => {
    const auth = requireUser(req);
    const { code } = body(req, z.object({ code: z.string().regex(/^\d{6}$/) }));
    const res = consumeCode<{ phone: string }>('phone-verify', auth.user.id, code);
    if (!res.ok) throw badRequest(`code_${res.reason}`);
    updateUser(auth.user.id, { phone: res.payload.phone, phone_verified: true });
    if (auth.user.fhir_ref?.startsWith('Patient/')) {
      const p = await fhir().read<Patient>('Patient', auth.user.fhir_ref.split('/')[1]);
      const telecom = [...(p.telecom ?? []).filter((t) => t.system !== 'phone'), { system: 'phone' as const, value: res.payload.phone, use: 'mobile' as const }];
      await fhir().update<Patient>({ ...p, telecom });
    }
    audit(actorOf(req), { action: 'U', subtype: 'phone-verified' });
    return meResponse(req);
  });

  // --- OIDC (D50) ---------------------------------------------------------------------------------
  app.get('/api/auth/oidc', async () => ({ enabled: oidcEnabled(), label: config.oidc.label }));

  app.get('/api/auth/oidc/start', async (req, reply) => {
    const q = query(req, z.object({ returnTo: z.string().max(200).default('/panel') }));
    return reply.redirect(await startOidc(q.returnTo));
  });

  app.get('/api/auth/oidc/callback', async (req, reply) => {
    const q = query(req, z.object({ code: z.string().max(2000), state: z.string().max(200) }));
    const r = await finishOidc(q.code, q.state);
    const user = findUserByEmail(r.email);
    if (!user || user.status !== 'active') {
      audit({ ...actorOf(req), display: r.email.slice(0, 80) }, { action: 'E', subtype: 'login-failed', outcome: 'failure', detail: 'oidc_no_account' });
      return reply.redirect('/panel/logowanie?blad=oidc_no_account');
    }
    const mfaOk = r.mfa || (!isStaff(user) && !user.totp_enabled);
    createSession(reply, req, user, mfaOk, { method: 'oidc' });
    audit({ ...actorOf(req), userId: user.id, display: user.display_name, roles: user.roles }, { action: 'E', subtype: mfaOk ? 'login' : 'login-password-ok', detail: { method: 'oidc', idpMfa: r.mfa } });
    return reply.redirect(mfaOk ? r.returnTo : isStaff(user) ? '/panel/mfa' : '/mfa');
  });
}
