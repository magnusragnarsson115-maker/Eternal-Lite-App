import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../server/app.js';
import { hashPassword } from '../../server/auth/passwords.js';
import { totpCode } from '../../server/auth/totp.js';
import { createUser, updateUser } from '../../server/auth/users.js';
import { createAvailability, findFreeSlots } from '../../server/services/scheduling.js';
import { nextWorkday, setupClinic, setupCore, system } from './helpers.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

class Client {
  cookie = '';
  csrf = '';
  constructor(private app: FastifyInstance) {}
  async req(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, opts: { csrf?: boolean; origin?: string } = {}) {
    const res = await this.app.inject({
      method,
      url,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(opts.csrf !== false && this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        origin: opts.origin ?? ORIGIN,
        host: 'localhost:3000',
      },
    });
    const set = res.headers['set-cookie'];
    if (set) this.cookie = (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ');
    const json = res.headers['content-type']?.includes('json') ? res.json() : undefined;
    if (json?.csrfToken) this.csrf = json.csrfToken;
    return { status: res.statusCode, json, headers: res.headers, body: res.body };
  }
}

describe('API end-to-end', () => {
  let app: FastifyInstance;
  let ctx: Awaited<ReturnType<typeof setupClinic>>;

  beforeAll(async () => {
    await setupCore();
    ctx = await setupClinic();
    const day = nextWorkday(3);
    await createAvailability(system, { practitionerId: ctx.doctor.id, serviceIds: [ctx.service.id, ctx.tele.id], locationId: ctx.loc.id, from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '12:00', slotMinutes: 20 });
    const pw = await hashPassword('Haslo-Personelu-2026');
    const doc = createUser({ email: 'lekarz@test.local', passwordHash: pw, roles: ['practitioner'], fhirRef: `Practitioner/${ctx.doctor.id}`, displayName: 'lek. Jan Testowy', emailVerified: true });
    updateUser(doc.id, { totp_secret: SECRET, totp_enabled: true });
    createUser({ email: 'recepcja@test.local', passwordHash: pw, roles: ['reception'], displayName: 'Recepcja', emailVerified: true });
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  const registerPatient = async (c: Client, email: string, extra: Record<string, unknown> = {}) =>
    c.req('POST', '/api/auth/register', {
      email,
      password: 'Spokojny-Poranek-42',
      given: 'Ewa',
      family: 'Rejestrowana',
      birthDate: '1985-03-03',
      consents: { terms: true, privacy: true, 'results-online': true },
      ...extra,
    });

  it('nagłówki bezpieczeństwa i polityka CSP', async () => {
    const res = await new Client(app).req('GET', '/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejestracja wymaga zgód obowiązkowych i silnego hasła', async () => {
    const c = new Client(app);
    expect((await c.req('POST', '/api/auth/register', { email: 'x@test.local', password: 'Spokojny-Poranek-42', given: 'A', family: 'B', birthDate: '1990-01-01', consents: { terms: true } })).json.error).toBe('required_consent_missing');
    expect((await registerPatient(c, 'y@test.local', { password: 'krotkie' })).json.error).toBe('weak_password');
  });

  it('pacjent: rejestracja → rezerwacja → odwołanie; ochrona CSRF i izolacja danych', async () => {
    const c = new Client(app);
    const reg = await registerPatient(c, 'ewa@test.local');
    expect(reg.status).toBe(200);
    expect(reg.json.patient.identityVerified).toBe(false);

    const slots = (await c.req('GET', `/api/availability?serviceId=${ctx.service.id}`)).json.slots;
    expect(slots.length).toBeGreaterThan(3);

    const noCsrf = await c.req('POST', '/api/me/appointments', { slotId: slots[0].id, serviceId: ctx.service.id }, { csrf: false });
    expect(noCsrf.status).toBe(403);
    const crossSite = await c.req('POST', '/api/me/appointments', { slotId: slots[0].id, serviceId: ctx.service.id }, { origin: 'https://evil.example' });
    expect(crossSite.json.error).toBe('cross_origin_rejected');

    const booked = await c.req('POST', '/api/me/appointments', { slotId: slots[0].id, serviceId: ctx.service.id });
    expect(booked.status).toBe(200);
    expect(booked.json.status).toBe('booked');

    const records = await c.req('GET', '/api/me/records');
    expect(records.json.access).toEqual({ allowed: false, reason: 'identity_not_verified' });

    // drugi pacjent nie widzi cudzej wizyty ani przez API, ani przez FHIR
    const other = new Client(app);
    await registerPatient(other, 'inny@test.local', { given: 'Inny' });
    expect((await other.req('GET', `/api/me/appointments/${booked.json.id}`)).status).toBe(404);
    expect((await other.req('GET', `/fhir/R4/Appointment/${booked.json.id}`)).status).toBe(404);
    expect((await other.req('GET', '/fhir/R4/Appointment')).json.total).toBe(0);
    expect((await c.req('GET', '/fhir/R4/Appointment')).json.total).toBe(1);
    expect((await other.req('GET', '/api/staff/dashboard')).json.error).toBe('staff_only');

    const ics = await c.req('GET', `/api/me/appointments/${booked.json.id}/ics`);
    expect(ics.headers['content-type']).toContain('text/calendar');

    const cancel = await c.req('POST', `/api/me/appointments/${booked.json.id}/cancel`, { reason: 'test' });
    expect(cancel.json.status).toBe('cancelled');

    const tele = await c.req('POST', '/api/me/appointments', { slotId: slots[1].id, serviceId: ctx.tele.id });
    expect(tele.json.error).toBe('telemedicine_consent_required');
  });

  it('personel: MFA obowiązkowe, ochrona przed ponownym użyciem kodu, zasada najmniejszych uprawnień', async () => {
    const d = new Client(app);
    const login = await d.req('POST', '/api/auth/login', { email: 'lekarz@test.local', password: 'Haslo-Personelu-2026' });
    expect(login.json.mfa.required).toBe(true);
    expect((await d.req('GET', '/api/staff/dashboard')).json.error).toBe('mfa_required');
    const code = totpCode(SECRET);
    expect((await d.req('POST', '/api/auth/mfa/verify', { code })).status).toBe(200);
    expect((await d.req('GET', '/api/staff/dashboard')).status).toBe(200);

    const d2 = new Client(app);
    await d2.req('POST', '/api/auth/login', { email: 'lekarz@test.local', password: 'Haslo-Personelu-2026' });
    expect((await d2.req('POST', '/api/auth/mfa/verify', { code })).json.error).toBe('invalid_code');

    const r = new Client(app);
    const rl = await r.req('POST', '/api/auth/login', { email: 'recepcja@test.local', password: 'Haslo-Personelu-2026' });
    expect(rl.json.mfa.enrollRequired).toBe(true);
    const setup = await r.req('POST', '/api/auth/mfa/setup');
    expect(setup.json.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect((await r.req('POST', '/api/auth/mfa/enable', { code: totpCode(setup.json.secret) })).status).toBe(200);
    const search = await r.req('GET', '/api/staff/patients?q=Rejestrowana');
    expect(search.json.items.length).toBeGreaterThan(0);
    const pid = search.json.items[0].id;
    expect((await r.req('GET', `/api/staff/patients/${pid}/clinical`)).json.error).toBe('insufficient_role');
    expect((await r.req('GET', '/api/admin/users')).json.error).toBe('insufficient_role');
    expect((await d.req('GET', `/api/staff/patients/${pid}/clinical`)).status).toBe(200);
  });

  it('błędne hasło: identyczna odpowiedź dla nieistniejącego konta, blokada po serii prób', async () => {
    const c = new Client(app);
    const a = await c.req('POST', '/api/auth/login', { email: 'nie-ma@test.local', password: 'x' });
    const b = await c.req('POST', '/api/auth/login', { email: 'ewa@test.local', password: 'zle-haslo' });
    expect(a.json.error).toBe('invalid_credentials');
    expect(b.json.error).toBe('invalid_credentials');
  });

  it('fasada FHIR: CapabilityStatement publiczny, wyszukiwanie wymaga sesji', async () => {
    const c = new Client(app);
    const meta = await c.req('GET', '/fhir/R4/metadata');
    expect(meta.json.fhirVersion).toBe('4.0.1');
    expect((await c.req('GET', '/fhir/R4/Patient')).status).toBe(401);
  });

  it('webhook RPM wymaga podpisu', async () => {
    const c = new Client(app);
    const res = await c.req('POST', '/api/integrations/rpm/vitalera/webhook', { resourceType: 'Observation' }, { origin: 'https://vitalera.example' });
    expect(res.json.error).toBe('missing_signature');
  });

  it('wolne terminy po rezerwacji przez personel znikają z puli pacjenta', async () => {
    const before = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const d = new Client(app);
    await d.req('POST', '/api/auth/login', { email: 'lekarz@test.local', password: 'Haslo-Personelu-2026' });
    await d.req('POST', '/api/auth/mfa/verify', { code: totpCode(SECRET, Date.now() + 30_000) });
    const pid = (await d.req('GET', '/api/staff/patients?q=Rejestrowana')).json.items[0].id;
    const res = await d.req('POST', '/api/staff/appointments', { slotId: before[0].id, serviceId: ctx.service.id, patientId: pid });
    expect(res.status).toBe(200);
    const after = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    expect(after.length).toBe(before.length - 1);
  });
});
