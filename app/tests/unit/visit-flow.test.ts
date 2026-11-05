import type { Appointment } from '@medplum/fhirtypes';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../server/app.js';
import { hashPassword } from '../../server/auth/passwords.js';
import { createUser, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { fhir, fhirSystem } from '../../server/fhir/index.js';
import { pdfAvailable } from '../../server/pdf/render.js';
import { createOrganization, ensureOrganizations } from '../../server/services/orgs.js';
import { createAvailability, findFreeSlots, bookAppointment } from '../../server/services/scheduling.js';
import { runInScope, setDefaultOrgId, withOrgTags } from '../../server/tenancy.js';
import { Client, waitFor } from './client.js';
import { makePatient, multipart, nextWorkday, setupClinic, setupCore, simplePdf, system } from './helpers.js';

const SECRET_DOC = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const SECRET_REC = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';
const SECRET_OTHER = 'MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK';

const LAB_PDF = simplePdf([
  'Diagnostyka S.A. Laboratorium Medyczne',
  'Data pobrania: 12.09.2026',
  'Glukoza 92 mg/dl 70 - 99',
  'Cholesterol calkowity 212 H mg/dl < 190',
  'TSH 2,31 uIU/ml 0,27 - 4,2',
  'Kreatynina 0,92 mg/dl 0,7 - 1,2',
]);

describe('Obieg wizyty: zaproszenie → strona pacjenta → skrzynka → raport faktów', () => {
  let app: FastifyInstance;
  let orgId: string;
  let otherOrgId: string;
  let apptId: string;
  let patientId: string;
  const doc = () => new Client(app);
  let docClient: Client;
  let recClient: Client;
  let otherClient: Client;

  beforeAll(async () => {
    await setupCore();
    const ctx = await setupClinic();
    orgId = ctx.org.id ?? '';
    await fhirSystem().update(withOrgTags(ctx.org, [orgId]));
    setDefaultOrgId(orgId);
    await ensureOrganizations();
    const other = await createOrganization(system, { name: 'Inna klinika' });
    otherOrgId = other.id;
    const day = nextWorkday(3);
    await runInScope({ orgId }, async () => {
      await createAvailability(system, { practitionerId: ctx.doctor.id, serviceIds: [ctx.service.id], locationId: ctx.loc.id ?? '', from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '10:00', slotMinutes: 20 });
    });
    const p = await makePatient('Maria', 'Linkowa', { verified: true, account: false });
    patientId = p.patient.id ?? '';
    await runInScope({ orgId }, async () => {
      const slots = await findFreeSlots({ serviceId: ctx.service.id, from: `${day}T00:00:00Z`, to: `${day}T23:59:59Z` });
      const appt = await bookAppointment(system, { patientRef: p.ref, slotId: slots[0].id, serviceId: ctx.service.id, bookedBy: 'staff' });
      apptId = appt.id;
    });
    const pw = await hashPassword('Haslo-Personelu-2026');
    const d = createUser({ email: 'lekarz@flow.local', passwordHash: pw, roles: ['practitioner'], fhirRef: `Practitioner/${ctx.doctor.id}`, displayName: 'lek. Jan Testowy', emailVerified: true, orgId });
    updateUser(d.id, { totp_secret: SECRET_DOC, totp_enabled: true });
    const r = createUser({ email: 'recepcja@flow.local', passwordHash: pw, roles: ['reception'], displayName: 'Recepcja', emailVerified: true, orgId });
    updateUser(r.id, { totp_secret: SECRET_REC, totp_enabled: true });
    const o = createUser({ email: 'lekarz@inna.local', passwordHash: pw, roles: ['practitioner'], displayName: 'lek. Obcy', emailVerified: true, orgId: otherOrgId });
    updateUser(o.id, { totp_secret: SECRET_OTHER, totp_enabled: true });
    app = await buildApp();
    docClient = doc();
    await docClient.loginStaff('lekarz@flow.local', 'Haslo-Personelu-2026', SECRET_DOC);
    recClient = doc();
    await recClient.loginStaff('recepcja@flow.local', 'Haslo-Personelu-2026', SECRET_REC);
    otherClient = doc();
    await otherClient.loginStaff('lekarz@inna.local', 'Haslo-Personelu-2026', SECRET_OTHER);
  });
  afterAll(async () => {
    await app?.close();
  });

  let token = '';

  it('rejestracja tworzy zaproszenie z linkiem i kodem QR', async () => {
    const res = await recClient.req('POST', `/api/staff/appointments/${apptId}/invite`, { phone: '600100200', send: true });
    expect(res.status).toBe(200);
    expect(res.json.url).toMatch(/\/z\/[A-Za-z0-9_-]{40,}$/);
    expect(res.json.qr).toContain('<svg');
    expect(res.json.smsQueued).toBe(true);
    token = res.json.url.split('/z/')[1];
    const sms = getDb().prepare("SELECT body FROM outbox WHERE channel = 'sms' ORDER BY created_at DESC LIMIT 1").get() as { body: string };
    expect(sms.body).toContain('/z/');
    expect(sms.body).not.toMatch(/glukoz|cholesterol/i);
  });

  it('strona pod linkiem wymaga zgody przed wgraniem dokumentu', async () => {
    const pub = new Client(app);
    const ctx = await pub.req('GET', `/api/link/${token}`);
    expect(ctx.status).toBe(200);
    expect(ctx.json.patientLabel).toBe('Maria L.');
    expect(ctx.json.texts.consent.version).toBeTruthy();
    const up = multipart({}, { name: 'file', filename: 'wyniki.pdf', contentType: 'application/pdf', data: LAB_PDF });
    expect((await pub.upload(`/api/link/${token}/upload`, up.payload, up.contentType)).json.error).toBe('consent_required');
    const consent = await pub.req('POST', `/api/link/${token}/consent`, { accept: true, textVersion: ctx.json.texts.consent.version });
    expect(consent.status).toBe(200);
    expect(consent.json.grant.status).toBe('active');
  });

  let intakeId = '';

  it('wgrany PDF jest odczytany: polskie nazwy → LOINC, zakres i oznaczenie z dokumentu', async () => {
    const pub = new Client(app);
    const up = multipart({ kind: 'lab' }, { name: 'file', filename: 'wyniki.pdf', contentType: 'application/pdf', data: LAB_PDF });
    const res = await pub.upload(`/api/link/${token}/upload`, up.payload, up.contentType);
    expect(res.status).toBe(200);
    intakeId = res.json.id;
    const item = await waitFor(async () => {
      const r = await pub.req('GET', `/api/link/${token}/intake/${intakeId}`);
      return r.json.status === 'processing' ? undefined : r.json;
    });
    expect(item.status).toBe('needs_review');
    expect(item.collectedAt).toBe('2026-09-12');
    const byName = Object.fromEntries(item.extract.items.map((i: { match?: { key: string } }) => [i.match?.key, i]));
    expect(byName.glucose.match.loinc).toBe('2345-7');
    expect(byName.glucose.unit).toBe('mg/dL');
    expect(byName.chol.flag).toBe('H');
    expect(byName.chol.rangeText).toBe('< 190');
    expect(byName.tsh.value).toBe('2,31');
  });

  it('pacjent potwierdza i poprawia pola, a zapis trafia do rekordu z pochodzeniem', async () => {
    const pub = new Client(app);
    const item = (await pub.req('GET', `/api/link/${token}/intake/${intakeId}`)).json;
    const [glu, chol, tsh] = ['glucose', 'chol', 'tsh'].map((k) => item.extract.items.find((i: { match?: { key: string } }) => i.match?.key === k));
    const rev = await pub.req('POST', `/api/link/${token}/intake/${intakeId}/review`, {
      items: [
        { id: glu.id, action: 'confirm' },
        { id: chol.id, action: 'confirm' },
        { id: tsh.id, action: 'correct', value: '2,13' },
      ],
    });
    expect(rev.status).toBe(200);
    const sub = await pub.req('POST', `/api/link/${token}/intake/${intakeId}/submit`);
    expect(sub.json.status).toBe('submitted'); // kreatynina niepotwierdzona
    const prov = await fhirSystem().search('Provenance', { target: sub.json.documentRef });
    expect(prov.length).toBeGreaterThan(0);
  });

  it('skrzynka pokazuje kompletność; raport faktów oddziela odczyt niepotwierdzony', async () => {
    const day = (await runInScope({ orgId }, () => fhir().read<Appointment>('Appointment', apptId))).start?.slice(0, 10);
    const inbox = await recClient.req('GET', `/api/staff/inbox?date=${day}`);
    expect(inbox.status).toBe(200);
    const prep = inbox.json.items.find((i: { appointment: { id: string } }) => i.appointment.id === apptId);
    expect(prep.sharing).toBe('shared');
    expect(prep.requirements[0].status).toBe('to_confirm');
    // rejestracja nie dostaje treści klinicznej
    expect((await recClient.req('GET', `/api/staff/patients/${patientId}/facts?appointmentId=${apptId}`)).status).toBe(403);
    const facts = await docClient.req('GET', `/api/staff/patients/${patientId}/facts?appointmentId=${apptId}`);
    expect(facts.status).toBe(200);
    const names = facts.json.results.map((r: { name: string }) => r.name);
    expect(names).toContain('Glukoza');
    const tsh = facts.json.results.find((r: { loinc?: string }) => r.loinc === '3016-3');
    expect(tsh.points[0].value).toBe('2,13');
    expect(tsh.points[0].source.kind).toBe('patient-document');
    expect(facts.json.unconfirmed.map((r: { loinc?: string }) => r.loinc)).toContain('2160-0');
    const chol = facts.json.results.find((r: { loinc?: string }) => r.loinc === '2093-3');
    expect(chol.points[0].labFlag).toBe('H');
  });

  it('inna klinika nie ma dostępu; lekarz potwierdza pozostałe pole', async () => {
    expect((await otherClient.req('GET', `/api/staff/intake/${intakeId}`)).status).toBe(404);
    expect((await otherClient.req('GET', `/api/staff/patients/${patientId}/facts`)).status).toBe(404);
    const item = (await docClient.req('GET', `/api/staff/intake/${intakeId}`)).json;
    const creat = item.extract.items.find((i: { match?: { key: string } }) => i.match?.key === 'creat');
    const res = await docClient.req('POST', `/api/staff/intake/${intakeId}/confirm`, { items: [{ id: creat.id, action: 'confirm' }] });
    expect(res.json.status).toBe('confirmed');
  });

  it('pacjent widzi pod linkiem, kto oglądał; wycofanie zgody natychmiast odbiera dostęp', async () => {
    const pub = new Client(app);
    const log = await pub.req('GET', `/api/link/${token}/access-log`);
    expect(log.json.items.some((e: { who: string; org?: string }) => e.who === 'lek. Jan Testowy' && e.org)).toBe(true);
    expect((await pub.req('POST', `/api/link/${token}/withdraw`)).status).toBe(200);
    expect((await pub.req('GET', `/api/link/${token}`)).status).toBe(410);
    expect((await docClient.req('GET', `/api/staff/intake/${intakeId}`)).json.error).toBe('no_active_grant');
  });

  it('PDF raportu faktów (Chromium)', async () => {
    if (!pdfAvailable()) return;
    const p2 = await makePatient('Olga', 'Pdfowa', { verified: true, account: false });
    await fhirSystem().update(withOrgTags(p2.patient, [orgId]));
    const res = await docClient.req('GET', `/api/staff/patients/${p2.patient.id}/facts.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.raw.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
