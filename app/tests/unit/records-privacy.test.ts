import { beforeEach, describe, expect, it } from 'vitest';
import { verifyAuditChain, listAudit, audit } from '../../server/audit.js';
import { getDb } from '../../server/db.js';
import { HttpError } from '../../server/lib/util.js';
import { hasConsent, setConsent, getConsentStates, consentHistory } from '../../server/services/consents.js';
import { addMeasurement, listMeasurementsForStaff, retractMeasurement, listMeasurements } from '../../server/services/observations.js';
import { setIdentityVerified } from '../../server/services/patients.js';
import { accessLogForPatient, exportPatientBundle } from '../../server/services/privacy.js';
import { createDocument, createReport, getRecord, listPatientRecords, patientCanViewRecords, readBinaryFor, registerUpload, setShared } from '../../server/services/records.js';
import { simplePdf } from '../../server/seed/pdf.js';
import { makePatient, setupCore, system } from './helpers.js';

const doctor = { display: 'lek. Test', actorRef: 'Practitioner/doc', roles: ['practitioner'], userId: undefined };
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof HttpError ? err.code : (err as Error).message;
  }
};

describe('Wyniki, dokumenty i dostęp pacjenta', () => {
  beforeEach(setupCore);

  it('pacjent widzi tylko udostępnione dokumenty, po potwierdzeniu tożsamości i włączeniu dostępu', async () => {
    const a = await makePatient('Ala', 'Niezweryfikowana', { verified: false, account: true });
    const report = await createReport(doctor, {
      patientId: a.patient.id ?? '',
      title: 'Morfologia',
      category: 'LAB',
      effective: new Date().toISOString(),
      observations: [{ name: 'HGB', value: '13,5', unit: 'g/dL', refLow: 12, refHigh: 16 }],
    });
    expect(report.observations?.[0]).toMatchObject({ value: '13.5', referenceRange: '12 – 16' });
    expect(await code(setShared(doctor, report.ref, true))).toBe('identity_not_verified');
    await setIdentityVerified(system, a.patient.id ?? '', 'id-card');
    await setShared(doctor, report.ref, true);
    expect(await patientCanViewRecords(a.ref)).toEqual({ allowed: false, reason: 'consent_missing' });
    await setConsent(a.actor, a.ref, 'results-online', true);
    expect((await patientCanViewRecords(a.ref)).allowed).toBe(true);

    await createDocument(doctor, { patientId: a.patient.id ?? '', title: 'Notatka wewnętrzna', kind: 'other', text: 'nieudostępniona' });
    const visible = await listPatientRecords(a.ref, { onlyShared: true });
    expect(visible.map((r) => r.title)).toEqual(['Morfologia']);
    const all = await listPatientRecords(a.ref, { onlyShared: false });
    expect(all).toHaveLength(2);

    const other = await makePatient('Obcy', 'Pacjent');
    expect(await code(getRecord(report.ref, { patientRef: other.ref }))).toBe('record_not_found');
    await setShared(doctor, report.ref, false);
    expect(await code(getRecord(report.ref, { patientRef: a.ref }))).toBe('record_not_found');
  });

  it('pliki: kontrola typu i dostęp wyłącznie do udostępnionych', async () => {
    const a = await makePatient();
    expect(await code(registerUpload(doctor, { data: Buffer.from('<script>'), filename: 'x.pdf', contentType: 'application/pdf' }))).toBe('file_content_mismatch');
    expect(await code(registerUpload(doctor, { data: Buffer.from('x'), filename: 'x.exe', contentType: 'application/x-msdownload' }))).toBe('unsupported_file_type');
    const up = await registerUpload(doctor, { data: simplePdf(['test']), filename: 'wynik.pdf', contentType: 'application/pdf' });
    const doc = await createDocument(doctor, { patientId: a.patient.id ?? '', title: 'Skan', kind: 'referral-scan', binaryId: up.binaryId });
    expect(await code(readBinaryFor(up.binaryId, { patientRef: a.ref }))).toBe('file_not_found');
    await setShared(doctor, doc.ref, true);
    const file = await readBinaryFor(up.binaryId, { patientRef: a.ref });
    expect(file.data.subarray(0, 5).toString()).toBe('%PDF-');
    const other = await makePatient('Inny', 'Pacjent');
    expect(await code(readBinaryFor(up.binaryId, { patientRef: other.ref }))).toBe('file_not_found');
  });

  it('pomiary: walidacja zakresu wprowadzania, zgoda na udostępnienie, wycofanie wpisu', async () => {
    const a = await makePatient();
    expect(await code(addMeasurement(a.actor, a.ref, { kind: 'bp', systolic: 80, diastolic: 120, source: 'manual' }))).toBe('diastolic_not_lower');
    expect(await code(addMeasurement(a.actor, a.ref, { kind: 'spo2', value: 140, source: 'manual' }))).toBe('value_out_of_input_range');
    const [bp] = await addMeasurement(a.actor, a.ref, { kind: 'bp', systolic: 125, diastolic: 82, pulse: 70, source: 'manual' });
    expect(bp).toMatchObject({ kind: 'bp', systolic: 125, diastolic: 82 });
    expect((await listMeasurements(a.ref)).length).toBe(2); // ciśnienie + tętno
    expect((await listMeasurementsForStaff(a.ref)).shared).toBe(false);
    await setConsent(a.actor, a.ref, 'share-measurements', true);
    expect((await listMeasurementsForStaff(a.ref)).items.length).toBe(2);
    await retractMeasurement(a.actor, a.ref, bp.id);
    expect((await listMeasurements(a.ref, 'bp')).length).toBe(0);
  });
});

describe('Zgody, dziennik zdarzeń, eksport', () => {
  beforeEach(setupCore);

  it('zgody mają historię wersji i są sprawdzane przed wysyłką', async () => {
    const a = await makePatient();
    expect(await hasConsent(a.ref, 'reminders-email')).toBe(false);
    await setConsent(a.actor, a.ref, 'reminders-email', true);
    await setConsent(a.actor, a.ref, 'reminders-email', false);
    await setConsent(a.actor, a.ref, 'reminders-email', true);
    expect(await hasConsent(a.ref, 'reminders-email')).toBe(true);
    const state = (await getConsentStates(a.ref)).find((c) => c.type === 'reminders-email');
    const hist = await consentHistory(state?.id ?? '');
    expect(hist.map((h) => h.granted)).toEqual([true, false, true]);
  });

  it('dziennik jest łańcuchem HMAC: wykrywa modyfikację z pominięciem aplikacji', () => {
    for (let i = 0; i < 5; i++) audit(system, { action: 'R', subtype: 'test-read', patientRef: 'Patient/x', entityRef: `Observation/${i}` });
    expect(verifyAuditChain()).toMatchObject({ ok: true });
    const db = getDb();
    expect(() => db.prepare("UPDATE audit_log SET subtype = 'x' WHERE seq = 2").run()).toThrow(/append-only/);
    db.exec('DROP TRIGGER audit_no_update');
    db.prepare("UPDATE audit_log SET actor_display = 'ktoś inny' WHERE seq = 3").run();
    const r = verifyAuditChain();
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(3);
  });

  it('historia dostępu pacjenta i eksport FHIR Bundle', async () => {
    const a = await makePatient();
    audit({ display: 'lek. Kowalski', roles: ['practitioner'], actorRef: 'Practitioner/1', userId: undefined }, { action: 'R', subtype: 'patient-read', patientRef: a.ref, entityRef: a.ref });
    const log = accessLogForPatient(a.ref);
    expect(log.some((e) => e.who === 'lek. Kowalski' && e.role === 'practitioner')).toBe(true);
    const bundle = await exportPatientBundle(a.actor, a.ref);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.entry?.some((e) => e.resource?.resourceType === 'Patient')).toBe(true);
    expect(bundle.entry?.some((e) => e.resource?.resourceType === 'AuditEvent')).toBe(true);
    expect(listAudit({ patientRef: a.ref }).some((r) => r.subtype === 'patient-export')).toBe(true);
  });
});
