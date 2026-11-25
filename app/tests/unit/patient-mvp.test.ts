import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { setConsent } from '../../server/services/consents.js';
import { runMedReminderSweep } from '../../server/services/medReminders.js';
import { quietUntil } from '../../server/services/notifications.js';
import { Client, waitFor } from './client.js';
import { orgFixture } from './fixture.js';
import { multipart, simplePdf, system } from './helpers.js';

const PW = 'Spokojny-Poranek-42';
const PDF = simplePdf(['ALAB laboratoria', 'Data pobrania: 2026-10-01', 'Glukoza 101 H mg/dl 70 - 99', 'Hemoglobina 13,9 g/dl 12 - 16']);

describe('Aplikacja pacjenta — MVP', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    for (const t of ['terms', 'privacy', 'results-online'] as const) await setConsent(system, fx.patient.ref, t, true);
    pt = new Client(fx.app);
    const login = await pt.req('POST', '/api/auth/login', { email: user.email, password: PW });
    expect(login.status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  let docRef = '';

  it('dokument w aplikacji: odczyt, potwierdzenie, zapis do sejfu, oś czasu z wersjami', async () => {
    const up = multipart({ kind: 'lab' }, { name: 'file', filename: 'alab.pdf', contentType: 'application/pdf', data: PDF });
    const res = await pt.upload('/api/me/intake', up.payload, up.contentType);
    expect(res.status).toBe(200);
    const item = await waitFor(async () => {
      const r = await pt.req('GET', `/api/me/intake/${res.json.id}`);
      return r.json.status === 'processing' ? undefined : r.json;
    });
    expect(item.extract.items.length).toBe(2);
    await pt.req('POST', `/api/me/intake/${item.id}/review`, { items: item.extract.items.map((i: { id: string }) => ({ id: i.id, action: 'confirm' })) });
    const sub = await pt.req('POST', `/api/me/intake/${item.id}/submit`);
    expect(sub.json.status).toBe('confirmed');
    docRef = sub.json.documentRef;
    const docs = await pt.req('GET', '/api/me/documents');
    expect(docs.json.items[0].kindLabel).toBe('Wyniki badań laboratoryjnych');
    const tl = await pt.req('GET', '/api/me/timeline');
    const glu = tl.json.items.find((r: { loinc?: string }) => r.loinc === '2345-7');
    expect(glu.labFlag).toBe('H');
    expect(glu.trust).toBe('patient-confirmed');
    const v = await pt.req('GET', `/api/me/observations/${glu.id}/versions`);
    expect(v.json.versions.length).toBe(1);
    expect(v.json.provenance.length).toBeGreaterThanOrEqual(2);
    // F3.6 — oznaczenie laboratorium przepisane w powiadomieniu w aplikacji, push bez treści medycznej
    const notes = await pt.req('GET', '/api/notifications');
    expect(notes.json.items.some((n: { kind: string }) => n.kind === 'lab-flags')).toBe(true);
  });

  it('udostępnienie innej klinice na czas: widzi raport faktów; wycofanie odbiera dostęp', async () => {
    expect((await fx.clients.other.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`)).status).toBe(404);
    const g = await pt.req('POST', '/api/me/grants', { orgId: fx.otherOrgId, scope: { kind: 'selected', refs: [docRef] }, purpose: 'second-opinion', days: 7 });
    expect(g.status).toBe(200);
    expect(g.json.recipient).toBe('Inna klinika');
    const facts = await fx.clients.other.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`);
    expect(facts.status).toBe(200);
    expect(facts.json.results.some((r: { loinc?: string }) => r.loinc === '2345-7')).toBe(true);
    const log = await pt.req('GET', '/api/me/access-log');
    expect(log.json.items.some((e: { who: string; org?: string }) => e.who === 'lek. Obcy')).toBe(true);
    expect((await pt.req('DELETE', `/api/me/grants/${g.json.id}`)).json.status).toBe('revoked');
    expect((await fx.clients.other.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`)).status).toBe(404);
  });

  it('wpis ręczny i korekta z powodem — poprzednia wartość w historii', async () => {
    const add = await pt.req('POST', '/api/me/measurements', { kind: 'weight', value: 72.5 });
    const id = add.json.items[0].id;
    expect((await pt.req('POST', `/api/me/measurements/${id}/correct`, { value: 75, reason: 'ab' })).status).toBe(400);
    const c = await pt.req('POST', `/api/me/measurements/${id}/correct`, { value: 72.0, reason: 'Pomyłka przy wpisywaniu' });
    expect(c.json.corrected).toBe(true);
    const v = await pt.req('GET', `/api/me/observations/${id}/versions`);
    expect(v.json.versions.map((x: { value: string }) => x.value)).toEqual(['72', '72.5']);
    expect(v.json.versions[0].reason).toBe('Pomyłka przy wpisywaniu');
  });

  it('powiadomienia: godziny ciszy i preferencje', async () => {
    const prefs = { disabled: [], quiet: { enabled: true, from: '22:00', to: '07:00' } };
    expect(quietUntil(prefs, new Date('2026-10-14T21:30:00Z'), 'Europe/Warsaw')).toBe('2026-10-15T05:00:00.000Z');
    expect(quietUntil(prefs, new Date('2026-10-14T10:00:00Z'), 'Europe/Warsaw')).toBeUndefined();
    const res = await pt.req('PUT', '/api/me/notification-prefs', { disabled: ['message'], quiet: { enabled: true, from: '23:00', to: '06:30' } });
    expect(res.json.prefs.quiet.from).toBe('23:00');
  });

  it('SOS: SMS do osób bliskich bez danych o zdrowiu, karta ratunkowa z dziennikiem dostępu', async () => {
    await pt.req('PUT', '/api/me/emergency/info', { notes: 'Uczulenie na penicylinę (wpis pacjenta)', includeMedications: true });
    await pt.req('POST', '/api/me/emergency/contacts', { name: 'Jan Bliski', phone: '600 700 800', relation: 'mąż' });
    const sos = await pt.req('POST', '/api/me/sos', { lat: 52.2297, lng: 21.0122 });
    expect(sos.json.notified).toBe(1);
    const sms = getDb().prepare("SELECT body FROM outbox WHERE related_ref LIKE 'sos:%'").get() as { body: string };
    expect(sms.body).toContain('SOS');
    expect(sms.body).not.toMatch(/penicylin/i);
    const token = sos.json.cardUrl.split('/ratunek/')[1];
    const card = await new Client(fx.app).req('GET', `/api/sos-card/${token}`);
    expect(card.json.notes).toContain('penicylinę');
    const log = await pt.req('GET', '/api/me/access-log');
    expect(log.json.items.some((e: { subtype: string }) => e.subtype === 'emergency-access')).toBe(true);
  });

  it('przypomnienie o leku: harmonogram, przypomnienie, potwierdzenie przyjęcia', async () => {
    const now = new Date();
    const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const s = await pt.req('POST', '/api/me/med-schedules', { label: 'Lek testowy', times: [hhmm] });
    expect(s.json.items.length).toBe(1);
    expect(await runMedReminderSweep(now)).toBe(1);
    expect(await runMedReminderSweep(now)).toBe(0);
    const log = (await pt.req('GET', '/api/me/med-schedules')).json.log;
    const c = await pt.req('POST', `/api/me/med-intake/${log[0].id}`, { status: 'taken' });
    expect(c.json.log[0].status).toBe('taken');
  });

  it('urządzenia: lista sesji, limit 5 urządzeń', async () => {
    const user = findUserByFhirRef(fx.patient.ref)!;
    for (let i = 0; i < 6; i++) await new Client(fx.app).req('POST', '/api/auth/login', { email: user.email, password: PW });
    const n = (getDb().prepare('SELECT COUNT(*) AS n FROM app_session WHERE user_id = ?').get(user.id) as { n: number }).n;
    expect(n).toBe(5);
  });

  it('usunięcie danych z potwierdzeniem: sejf znika, dokumentacja placówki zostaje', async () => {
    const pt2 = new Client(fx.app);
    const user = findUserByFhirRef(fx.patient.ref)!;
    await pt2.req('POST', '/api/auth/login', { email: user.email, password: PW });
    expect((await pt2.req('POST', '/api/me/delete-data', { confirm: 'USUŃ', password: 'zle-haslo' })).status).toBe(401);
    const res = await pt2.req('POST', '/api/me/delete-data', { confirm: 'USUŃ', password: PW });
    expect(res.status).toBe(200);
    const steps = res.json.confirmation.steps.map((s: { key: string; status: string }) => `${s.key}:${s.status}`);
    expect(steps).toContain('vault:deleted');
    expect(steps).toContain('clinic-records:kept');
    expect(await fhirSystem().readOptional('DocumentReference', docRef.split('/')[1])).toBeUndefined();
    expect((await pt2.req('GET', '/api/me/documents')).status).toBe(401);
    expect(findUserByFhirRef(fx.patient.ref)?.status).toBe('disabled');
  });
});
