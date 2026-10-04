import type { FastifyInstance, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import { audit } from '../audit.js';
import { getDummyHash, hashPassword, passwordProblems, verifyPassword } from '../auth/passwords.js';
import { actorOf, createSession, destroyAllSessions, destroySession, markMfaPassed } from '../auth/sessions.js';
import { generateTotpSecret, otpauthUri, totpCode, verifyTotp } from '../auth/totp.js';
import {
  type AppUser,
  consumeToken,
  createUser,
  findUserByEmail,
  findUserByFhirRef,
  findUserById,
  isStaff,
  issueToken,
  peekToken,
  updateUser,
} from '../auth/users.js';
import { config } from '../config.js';
import { CONSENT_TYPES, type ConsentType } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { pwnedCount } from '../integrations/hibp.js';
import { body } from '../lib/http.js';
import { authLimiter } from '../lib/ratelimit.js';
import { badRequest, conflict, forbidden, HttpError, isValidPesel, nowIso, unauthorized } from '../lib/util.js';
import { setConsent } from '../services/consents.js';
import { getClinicSettings, getPractitioner } from '../services/directory.js';
import { enqueue } from '../services/notifications.js';
import { createPatient, findPatientByPesel, toPatientView } from '../services/patients.js';
import type { Patient } from '@medplum/fhirtypes';

const lastTotpStep = new Map<string, number>();

async function assertPasswordOk(password: string, context: string[]): Promise<void> {
  const problems = passwordProblems(password, config.security.minPasswordLength, context);
  if (problems.length) throw badRequest('weak_password', problems.join(','), { problems });
  const pwned = await pwnedCount(password);
  if (pwned.count > 0) throw badRequest('password_breached', `Password appears in ${pwned.count} known breaches`, { count: pwned.count });
}

function sendSecurityEmail(user: AppUser, subject: string, text: string, key: string): void {
  enqueue({ channel: 'email', userId: user.id, recipient: user.email, subject, body: text, relatedRef: 'security', dedupeKey: key });
}

function sendVerification(user: AppUser): void {
  const token = issueToken('email-verify', { userId: user.id, ttlMinutes: 48 * 60 });
  sendSecurityEmail(
    user,
    'Potwierdź adres e-mail',
    `Aby potwierdzić adres e-mail w aplikacji ${getClinicSettings().name}, otwórz link:\n${config.publicUrl}/potwierdz-email?token=${token}\n\nJeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.`,
    `verify:${user.id}:${Date.now()}`,
  );
}

function verifyTotpOnce(user: AppUser, code: string): boolean {
  if (!user.totp_secret) return false;
  const now = Date.now();
  if (!verifyTotp(user.totp_secret, code, now)) return false;
  // ochrona przed ponownym użyciem tego samego kodu
  const step = [-1, 0, 1].map((d) => Math.floor((now + d * 30_000) / 30_000)).find((s) => totpCode(user.totp_secret ?? '', s * 30_000) === code.trim());
  const last = lastTotpStep.get(user.id) ?? -1;
  if (step !== undefined && step <= last) return false;
  if (step !== undefined) lastTotpStep.set(user.id, step);
  return true;
}

async function meResponse(req: FastifyRequest) {
  const auth = req.auth;
  if (!auth) return { authenticated: false };
  const u = auth.user;
  const staff = isStaff(u);
  let patient;
  let practitioner;
  if (u.fhir_ref?.startsWith('Patient/')) {
    const p = await fhir().readOptional<Patient>('Patient', u.fhir_ref.split('/')[1]);
    if (p) patient = toPatientView(p);
  }
  if (u.fhir_ref?.startsWith('Practitioner/')) practitioner = await getPractitioner(u.fhir_ref.split('/')[1]).catch(() => undefined);
  const mfaNeeded = staff || u.totp_enabled;
  return {
    authenticated: true,
    csrfToken: auth.csrfToken,
    mfa: { required: mfaNeeded && !auth.mfaPassed, enrolled: u.totp_enabled, enrollRequired: staff && !u.totp_enabled },
    user: {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      roles: u.roles,
      staff,
      locale: u.locale,
      emailVerified: u.email_verified,
      mustChangePassword: u.must_change_password,
      status: u.status,
      fhirRef: u.fhir_ref,
    },
    patient,
    practitioner,
  };
}

const RegisterSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(256),
  given: z.string().trim().min(1).max(80),
  family: z.string().trim().min(1).max(80),
  pesel: z.string().regex(/^\d{11}$/).optional().or(z.literal('').transform(() => undefined)),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  activationCode: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  locale: z.enum(['pl', 'en']).default('pl'),
  consents: z.record(z.string(), z.boolean()),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/me', async (req) => meResponse(req));

  app.post('/api/auth/register', async (req, reply) => {
    authLimiter.check(`register:${req.ip}`);
    const input = body(req, RegisterSchema);
    const actor = { ...actorOf(req), display: `${input.given} ${input.family}` };
    for (const [type, def] of Object.entries(CONSENT_TYPES)) {
      if (def.required && !input.consents[type]) throw badRequest('required_consent_missing', type);
    }
    if (findUserByEmail(input.email)) throw conflict('email_taken');
    await assertPasswordOk(input.password, [input.email.split('@')[0], input.given, input.family, input.pesel ?? '']);

    let patientRef: string;
    let verified = false;
    if (input.activationCode) {
      const peek = peekToken<{ patientRef: string }>('patient-activation', input.activationCode);
      if (!peek) throw badRequest('invalid_activation_code');
      const p = await fhir().read<Patient>('Patient', peek.payload.patientRef.split('/')[1]);
      // drugi czynnik przy aktywacji: data urodzenia musi zgadzać się z kartoteką
      if (!input.birthDate || p.birthDate !== input.birthDate) throw badRequest('activation_data_mismatch');
      if (findUserByFhirRef(peek.payload.patientRef)) throw conflict('account_exists');
      if (!consumeToken('patient-activation', input.activationCode)) throw badRequest('invalid_activation_code');
      patientRef = peek.payload.patientRef;
      verified = true;
      audit(actor, { action: 'E', subtype: 'activation-code-used', entityRef: patientRef, patientRef });
    } else {
      if (input.pesel) {
        if (!isValidPesel(input.pesel)) throw badRequest('invalid_pesel');
        if (await findPatientByPesel(input.pesel)) throw conflict('pesel_registered_use_activation_code');
      }
      const p = await createPatient(actor, {
        given: input.given,
        family: input.family,
        pesel: input.pesel,
        birthDate: input.birthDate,
        phone: input.phone,
        email: input.email,
        preferredLanguage: input.locale,
      });
      patientRef = `Patient/${p.id}`;
    }

    const user = createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roles: ['patient'],
      fhirRef: patientRef,
      displayName: `${input.given} ${input.family}`,
      locale: input.locale,
      emailVerified: !config.security.requireEmailVerification,
    });
    const userActor = { ...actor, userId: user.id, actorRef: patientRef, roles: user.roles };
    for (const type of Object.keys(CONSENT_TYPES) as ConsentType[]) {
      if (input.consents[type] !== undefined) await setConsent(userActor, patientRef, type, input.consents[type]);
    }
    audit(userActor, { action: 'C', subtype: 'account-register', entityRef: patientRef, patientRef, detail: { verifiedIdentity: verified } });
    if (config.security.requireEmailVerification) sendVerification(user);
    createSession(reply, req, user, true);
    return meResponse(req);
  });

  app.post('/api/auth/login', async (req, reply) => {
    const input = body(req, z.object({ email: z.string().max(200), password: z.string().max(256) }));
    authLimiter.check(`login:${req.ip}`);
    authLimiter.check(`login:${input.email.toLowerCase()}`);
    const user = findUserByEmail(input.email);
    if (!user || user.status === 'disabled') {
      await verifyPassword(input.password, await getDummyHash());
      audit({ ...actorOf(req), display: input.email.slice(0, 80) }, { action: 'E', subtype: 'login-failed', outcome: 'failure', detail: 'unknown_or_disabled' });
      throw unauthorized('invalid_credentials');
    }
    if (user.locked_until && user.locked_until > nowIso()) {
      throw new HttpError(429, 'too_many_attempts', 'Account temporarily locked', { retryAfter: Math.ceil((Date.parse(user.locked_until) - Date.now()) / 1000) });
    }
    const actor = { ...actorOf(req), userId: user.id, display: user.display_name, actorRef: user.fhir_ref ?? undefined, roles: user.roles };
    if (!(await verifyPassword(input.password, user.password_hash))) {
      const failed = user.failed_logins + 1;
      const lock = failed >= config.security.maxFailedLogins;
      updateUser(user.id, {
        failed_logins: lock ? 0 : failed,
        locked_until: lock ? new Date(Date.now() + config.security.lockoutMinutes * 60_000).toISOString() : user.locked_until,
      });
      audit(actor, { action: 'E', subtype: 'login-failed', outcome: 'failure', detail: lock ? 'locked' : 'bad_password' });
      throw unauthorized('invalid_credentials');
    }
    updateUser(user.id, { failed_logins: 0, locked_until: null, last_login_at: nowIso() });
    const fresh = findUserById(user.id)!;
    const mfaNeeded = isStaff(fresh) || fresh.totp_enabled;
    createSession(reply, req, fresh, !mfaNeeded);
    audit(actor, { action: 'E', subtype: mfaNeeded ? 'login-password-ok' : 'login' });
    return meResponse(req);
  });

  app.post('/api/auth/mfa/verify', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    authLimiter.check(`mfa:${auth.user.id}`);
    const { code } = body(req, z.object({ code: z.string().max(10) }));
    if (!auth.user.totp_enabled) throw badRequest('mfa_not_enrolled');
    const actor = actorOf(req);
    if (!verifyTotpOnce(auth.user, code)) {
      audit(actor, { action: 'E', subtype: 'mfa-failed', outcome: 'failure' });
      throw unauthorized('invalid_code');
    }
    markMfaPassed(auth);
    audit(actor, { action: 'E', subtype: 'login' });
    return meResponse(req);
  });

  app.post('/api/auth/mfa/setup', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    if (auth.user.totp_enabled) throw conflict('mfa_already_enabled');
    const secret = generateTotpSecret();
    updateUser(auth.user.id, { totp_secret: secret });
    const uri = otpauthUri(secret, auth.user.email, `Eternal ${getClinicSettings().name}`.trim());
    return { secret, otpauthUri: uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  });

  app.post('/api/auth/mfa/enable', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    authLimiter.check(`mfa:${auth.user.id}`);
    const { code } = body(req, z.object({ code: z.string().max(10) }));
    const user = findUserById(auth.user.id)!;
    if (user.totp_enabled) throw conflict('mfa_already_enabled');
    if (!user.totp_secret || !verifyTotpOnce(user, code)) throw unauthorized('invalid_code');
    updateUser(user.id, { totp_enabled: true });
    auth.user = findUserById(user.id)!;
    markMfaPassed(auth);
    audit(actorOf(req), { action: 'U', subtype: 'mfa-enroll' });
    return meResponse(req);
  });

  app.post('/api/auth/mfa/disable', async (req) => {
    const auth = req.auth;
    if (!auth || !auth.mfaPassed) throw unauthorized();
    if (isStaff(auth.user)) throw forbidden('mfa_mandatory_for_staff');
    const { password, code } = body(req, z.object({ password: z.string().max(256), code: z.string().max(10) }));
    if (!(await verifyPassword(password, auth.user.password_hash)) || !verifyTotpOnce(auth.user, code)) throw unauthorized('invalid_credentials');
    updateUser(auth.user.id, { totp_enabled: false, totp_secret: null });
    audit(actorOf(req), { action: 'U', subtype: 'mfa-disable' });
    return meResponse(req);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.auth) audit(actorOf(req), { action: 'E', subtype: 'logout' });
    destroySession(reply, req.auth);
    return { ok: true };
  });

  app.post('/api/auth/password/forgot', async (req) => {
    authLimiter.check(`forgot:${req.ip}`);
    const { email } = body(req, z.object({ email: z.string().max(200) }));
    const user = findUserByEmail(email);
    if (user && user.status !== 'disabled') {
      const token = issueToken('password-reset', { userId: user.id, ttlMinutes: 60 });
      sendSecurityEmail(
        user,
        'Reset hasła',
        `Otrzymaliśmy prośbę o zmianę hasła. Link jest ważny 60 minut:\n${config.publicUrl}/reset-hasla?token=${token}\n\nJeśli to nie Ty, zignoruj wiadomość — hasło pozostanie bez zmian.`,
        `reset:${user.id}:${Date.now()}`,
      );
      audit({ ...actorOf(req), userId: user.id, display: user.display_name }, { action: 'E', subtype: 'password-reset-requested' });
    }
    return { ok: true };
  });

  app.post('/api/auth/password/reset', async (req) => {
    authLimiter.check(`reset:${req.ip}`);
    const input = body(req, z.object({ token: z.string().max(200), password: z.string().max(256) }));
    const t = consumeToken('password-reset', input.token);
    if (!t?.userId) throw badRequest('invalid_or_expired_token');
    const user = findUserById(t.userId);
    if (!user) throw badRequest('invalid_or_expired_token');
    await assertPasswordOk(input.password, [user.email.split('@')[0], ...user.display_name.split(' ')]);
    updateUser(user.id, { password_hash: await hashPassword(input.password), failed_logins: 0, locked_until: null, must_change_password: false });
    destroyAllSessions(user.id);
    audit({ ...actorOf(req), userId: user.id, display: user.display_name }, { action: 'U', subtype: 'password-reset' });
    return { ok: true };
  });

  app.post('/api/auth/password/change', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    const needsMfa = isStaff(auth.user) || auth.user.totp_enabled;
    if (needsMfa && !auth.mfaPassed) throw forbidden('mfa_required');
    const input = body(req, z.object({ current: z.string().max(256), next: z.string().max(256) }));
    if (!(await verifyPassword(input.current, auth.user.password_hash))) throw unauthorized('invalid_credentials');
    if (input.current === input.next) throw badRequest('password_unchanged');
    await assertPasswordOk(input.next, [auth.user.email.split('@')[0], ...auth.user.display_name.split(' ')]);
    updateUser(auth.user.id, { password_hash: await hashPassword(input.next), must_change_password: false });
    destroyAllSessions(auth.user.id, auth.sessionHash);
    auth.user = findUserById(auth.user.id)!;
    audit(actorOf(req), { action: 'U', subtype: 'password-change' });
    return meResponse(req);
  });

  app.post('/api/auth/verify-email', async (req) => {
    const { token } = body(req, z.object({ token: z.string().max(200) }));
    const t = consumeToken('email-verify', token);
    if (!t?.userId) throw badRequest('invalid_or_expired_token');
    updateUser(t.userId, { email_verified: true });
    audit({ ...actorOf(req), userId: t.userId }, { action: 'U', subtype: 'email-verified' });
    return { ok: true };
  });

  app.post('/api/auth/resend-verification', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    authLimiter.check(`verify:${auth.user.id}`);
    if (!auth.user.email_verified) sendVerification(auth.user);
    return { ok: true };
  });

  app.put('/api/auth/locale', async (req) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    const { locale } = body(req, z.object({ locale: z.enum(['pl', 'en']) }));
    updateUser(auth.user.id, { locale });
    return { ok: true };
  });
}
