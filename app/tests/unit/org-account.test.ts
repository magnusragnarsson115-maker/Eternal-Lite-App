import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { totpCode } from '../../server/auth/totp.js';
import { findUserByEmail, findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { setConsent } from '../../server/services/consents.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';
import { system } from './helpers.js';

const PW = 'Spokojny-Poranek-42';

describe('Organizacja, konto i wideo', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    updateUser(findUserByFhirRef(fx.patient.ref)!.id, { password_hash: await hashPassword(PW) });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('administrator: zaproszenie personelu → przyjęcie → wymagany drugi składnik', async () => {
    const inv = await fx.clients.admin.req('POST', '/api/admin/staff-invites', { email: 'nowa@fx.local', displayName: 'Nowa Rejestratorka', roles: ['reception'] });
    expect(inv.status).toBe(200);
    expect(inv.json.url).toContain('/panel/zaproszenie/');
    const token = inv.json.url.split('/zaproszenie/')[1];
    const info = await new Client(fx.app).req('GET', `/api/auth/staff-invite/${token}`);
    expect(info.json.clinic).toBeTruthy();
    const c = new Client(fx.app);
    expect((await c.req('POST', '/api/auth/staff-invite/accept', { token, password: 'krotkie' })).status).toBe(400);
    expect((await c.req('POST', '/api/auth/staff-invite/accept', { token, password: 'Bardzo-Dlugie-Haslo-2026' })).json.next).toBe('/panel/mfa');
    const me = await c.req('GET', '/api/auth/me');
    expect(me.json.mfa.enrollRequired).toBe(true);
    expect((await c.req('GET', '/api/staff/inbox')).json.error).toBe('mfa_required');
    expect(findUserByEmail('nowa@fx.local')?.org_id).toBe(fx.orgId);
  });

  it('administrator widzi tylko konta swojej organizacji i nie ma dostępu do danych klinicznych', async () => {
    const users = await fx.clients.admin.req('GET', '/api/admin/users');
    const emails = users.json.items.map((u: { email: string }) => u.email);
    expect(emails).toContain('lekarz@fx.local');
    expect(emails).not.toContain('lekarz@inna.local');
    expect((await fx.clients.admin.req('PUT', `/api/admin/users/${fx.users.other.id}`, { status: 'disabled' })).status).toBe(404);
    expect((await fx.clients.admin.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`)).status).toBe(403);
  });

  it('moduły kliniki: wyłączony moduł znika z API', async () => {
    const res = await fx.clients.admin.req('PUT', '/api/admin/modules/facts', { enabled: false });
    expect(res.json.items.find((m: { id: string }) => m.id === 'facts').enabled).toBe(false);
    expect((await fx.clients.doctor.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`)).json.error).toBe('module_disabled');
    expect((await fx.clients.admin.req('PUT', '/api/admin/modules/crisis', { enabled: false })).status).toBe(403);
    await fx.clients.admin.req('PUT', '/api/admin/modules/facts', { enabled: true });
  });

  it('gotowość do pracy: administrator widzi stan składników bez wartości sekretów; inni nie mają dostępu', async () => {
    const r = await fx.clients.admin.req('GET', '/api/admin/readiness');
    expect(r.status).toBe(200);
    const ids = r.json.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['mode', 'ai', 'stt', 'ocr', 'sms', 'email', 'video', 'pdf', 'fhir']));
    expect(r.json.items.find((i: { id: string }) => i.id === 'mode').state).toBe('demo');
    expect(JSON.stringify(r.json)).not.toContain('test-audit-key');
    expect((await fx.clients.doctor.req('GET', '/api/admin/readiness')).status).toBe(403);
  });

  it('A18.9: wykaz składników (CycloneDX) w kontroli gotowości i do pobrania tylko przez administratora', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbom-'));
    const file = path.join(dir, 'sbom.cdx.json');
    process.env.SBOM_PATH = file;
    try {
      fs.writeFileSync(file, JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', metadata: { timestamp: '2026-10-15T10:00:00Z' }, components: [{ name: 'fastify' }, { name: 'zod' }] }));
      const item = (await fx.clients.admin.req('GET', '/api/admin/readiness')).json.items.find((i: { id: string }) => i.id === 'sbom');
      expect(item).toMatchObject({ state: 'ok' });
      expect(item.detail).toContain('2 składników');
      const dl = await fx.clients.admin.req('GET', '/api/admin/sbom');
      expect(dl.status).toBe(200);
      expect(dl.headers['content-type']).toContain('application/vnd.cyclonedx+json');
      expect((await fx.clients.doctor.req('GET', '/api/admin/sbom')).status).toBe(403);
    } finally {
      delete process.env.SBOM_PATH;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('incydent: zgłoszenie personelu, termin wg wagi, obsługa i eskalacja', async () => {
    const r = await fx.clients.doctor.req('POST', '/api/incidents', { category: 'privacy', description: 'Wynik innego pacjenta w skrzynce materiałów.' });
    expect(r.json.severity).toBe('high');
    expect(r.json.possibleDataBreach).toBe(true);
    const list = await fx.clients.admin.req('GET', '/api/admin/incidents?open=1');
    expect(list.json.items.length).toBe(1);
    expect((await fx.clients.admin.req('PUT', `/api/admin/incidents/${r.json.id}`, { status: 'resolved' })).json.error).toBe('invalid_transition');
    const u = await fx.clients.admin.req('PUT', `/api/admin/incidents/${r.json.id}`, { status: 'in-progress', escalatedTo: 'Inspektor ochrony danych' });
    expect(u.json.escalatedTo).toBe('Inspektor ochrony danych');
  });

  it('licznik użycia i eksport CSV do faktury; rejestr zastosowań AI bez treści', async () => {
    const usage = await fx.clients.admin.req('GET', '/api/admin/usage');
    expect(usage.json.lines[0].priceNet).toBe(299);
    const csv = await fx.clients.admin.req('GET', '/api/admin/usage.csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('Licencja Eternal Doctor');
    const reg = await fx.clients.admin.req('GET', '/api/admin/ai-registry');
    expect(reg.json.tasks.map((t: { task: string }) => t.task)).toContain('scribe-note');
    expect(JSON.stringify(reg.json)).not.toMatch(/Glukoza|Linkowa/);
  });

  it('mierniki pilotażu: czas dokumentacji i ankieta lekarza', async () => {
    await fx.clients.doctor.req('POST', '/api/staff/metrics/doc-time', { minutes: 12, phase: 'baseline' });
    await fx.clients.doctor.req('POST', '/api/staff/metrics/doc-time', { minutes: 7, phase: 'eternal' });
    expect((await fx.clients.doctor.req('GET', '/api/staff/survey')).json.due).toBe(true);
    await fx.clients.doctor.req('POST', '/api/staff/survey', { q1: 4, q2: 5, q3: 3 });
    const m = await fx.clients.doctor.req('GET', '/api/staff/metrics');
    expect(m.json.docTime.savedPerVisit).toBe(5);
    expect(m.json.survey.q2).toBe(5);
    expect((await fx.clients.reception.req('GET', '/api/staff/metrics')).status).toBe(403);
  });

  it('pacjent: kody odzyskiwania, weryfikacja telefonu, link z e-maila, lista urządzeń', async () => {
    const user = findUserByFhirRef(fx.patient.ref)!;
    const pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: user.email, password: PW });
    const codes = await pt.req('POST', '/api/auth/recovery-codes');
    expect(codes.json.codes).toHaveLength(10);
    const ph = await pt.req('POST', '/api/me/phone', { phone: '600 111 222' });
    expect((await pt.req('POST', '/api/me/phone/verify', { code: '000000' === ph.json.demoCode ? '111111' : '000000' })).json.error).toBe('code_invalid');
    const ok = await pt.req('POST', '/api/me/phone/verify', { code: ph.json.demoCode });
    expect(ok.json.user.phoneVerified).toBe(true);
    // włączenie TOTP i logowanie kodem odzyskiwania zamiast kodu z aplikacji
    const setup = await pt.req('POST', '/api/auth/mfa/setup');
    await pt.req('POST', '/api/auth/mfa/enable', { code: totpCode(setup.json.secret) });
    const pt2 = new Client(fx.app);
    const l = await pt2.req('POST', '/api/auth/login', { email: user.email, password: PW });
    expect(l.json.mfa.required).toBe(true);
    const rec = await pt2.req('POST', '/api/auth/mfa/recovery', { code: codes.json.codes[0] });
    expect(rec.json.mfa.required).toBe(false);
    expect((await new Client(fx.app).req('POST', '/api/auth/mfa/recovery', { code: codes.json.codes[0] })).status).toBe(401);
    const sessions = await pt2.req('GET', '/api/auth/sessions');
    expect(sessions.json.items.length).toBe(2);
    // link logowania z e-maila: ta sama odpowiedź dla nieistniejącego konta
    expect((await new Client(fx.app).req('POST', '/api/auth/magic-link', { email: 'nie-ma@fx.local' })).json.ok).toBe(true);
    await new Client(fx.app).req('POST', '/api/auth/magic-link', { email: user.email });
    const mail = getDb().prepare("SELECT body FROM outbox WHERE subject = 'Link do logowania' ORDER BY created_at DESC LIMIT 1").get() as { body: string };
    const token = mail.body.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    const ml = new Client(fx.app);
    const res = await ml.req('POST', '/api/auth/magic-link/consume', { token });
    expect(res.json.authenticated).toBe(true);
    expect(res.json.mfa.required).toBe(true); // konto z TOTP — link nie omija drugiego składnika
  });

  it('aplikacja mobilna: sesja z tokenem w nagłówku (bez ciasteczka i CSRF)', async () => {
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { totp_enabled: false, totp_secret: null });
    const res = await fx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: PW, client: 'mobile' }, headers: { 'content-type': 'application/json' } });
    expect(res.headers['set-cookie']).toBeUndefined();
    const token = res.json().token as string;
    expect(token.length).toBeGreaterThan(30);
    const me = await fx.app.inject({ method: 'GET', url: '/api/me/emergency', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    const post = await fx.app.inject({ method: 'PUT', url: '/api/me/notification-prefs', payload: { disabled: [], quiet: { enabled: false, from: '22:00', to: '07:00' } }, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    expect(post.statusCode).toBe(200);
    // token push z aplikacji Expo (P8) — zapis jako kanał „expo:”; nieprawidłowy format odrzucony
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const bad = await fx.app.inject({ method: 'POST', url: '/api/push/expo', payload: { token: 'nie-token' }, headers: auth });
    expect(bad.statusCode).toBe(400);
    const push = await fx.app.inject({ method: 'POST', url: '/api/push/expo', payload: { token: 'ExponentPushToken[abcDEF123_-xyz]' }, headers: auth });
    expect(push.statusCode).toBe(200);
    // wylogowanie unieważnia token — kolejne żądanie z tym samym tokenem jest odrzucane
    const out = await fx.app.inject({ method: 'POST', url: '/api/auth/logout', payload: {}, headers: auth });
    expect(out.statusCode).toBe(200);
    const after = await fx.app.inject({ method: 'GET', url: '/api/me/emergency', headers: { authorization: `Bearer ${token}` } });
    expect(after.statusCode).toBe(401);
  });

  it('wideo: poczekalnia — pacjent dostaje adres pokoju dopiero po wpuszczeniu', async () => {
    const { bookAppointment, findFreeSlots } = await import('../../server/services/scheduling.js');
    const { runInScope } = await import('../../server/tenancy.js');
    await setConsent(system, fx.patient.ref, 'telemedicine', true);
    const appt = await runInScope({ orgId: fx.orgId }, async () => {
      const slots = await findFreeSlots({ serviceId: fx.ctx.tele.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
      return bookAppointment(system, { patientRef: fx.patient.ref, slotId: slots[0].id, serviceId: fx.ctx.tele.id, bookedBy: 'staff' });
    });
    // okno dołączenia: przesuwamy wizytę na teraz
    const a = await fhirSystem().read<import('@medplum/fhirtypes').Appointment>('Appointment', appt.id);
    await fhirSystem().update({ ...a, start: new Date(Date.now() + 5 * 60_000).toISOString(), end: new Date(Date.now() + 20 * 60_000).toISOString() });
    const user = findUserByFhirRef(fx.patient.ref)!;
    const pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: user.email, password: PW });
    const w = await pt.req('GET', `/api/me/appointments/${appt.id}/tele`);
    expect(w.json.waiting).toBe(true);
    expect(w.json.join).toBeUndefined();
    const waiting = await fx.clients.doctor.req('GET', '/api/staff/tele/waiting');
    expect(waiting.json.items[0].appointmentId).toBe(appt.id);
    const doc = await fx.clients.doctor.req('GET', `/api/staff/appointments/${appt.id}/tele`);
    expect(doc.json.join.url).toBeTruthy();
    await fx.clients.doctor.req('POST', `/api/staff/appointments/${appt.id}/tele/admit`);
    const after = await pt.req('GET', `/api/me/appointments/${appt.id}/tele`);
    expect(after.json.admitted).toBe(true);
    expect(after.json.join.url).toContain('eternal-');
    const end = await fx.clients.doctor.req('POST', `/api/staff/appointments/${appt.id}/tele/end`);
    expect(end.json.ended).toBe(true);
  });
});
