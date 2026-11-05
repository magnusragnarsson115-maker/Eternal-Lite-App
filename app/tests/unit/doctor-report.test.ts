import type { Bundle, Composition, Observation } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { LOINC, TRUST } from '../../server/fhir/constants.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { validateFhir } from '../../server/fhir/validation.js';
import { doctorReportHtml } from '../../server/services/doctorReport.js';
import { vaultOrgId, withOrgTags } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A4.3/F6.2 raport SBAR przygotowany przez pacjenta, A4.4 dokument FHIR, A24.7 karta zdrowia PL/EN. */

describe('Raport dla lekarza, dokument FHIR i karta na wyjazd', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const q = `reason=${encodeURIComponent('Od tygodnia boli mnie kolano po bieganiu')}&since=${encodeURIComponent('8 października')}&questions=${encodeURIComponent('Czy mogę dalej biegać?')}&days=90`;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Raport-Lekarza-42') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Raport-Lekarza-42' });
    const recent = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    await fhirSystem().create<Observation>(
      withOrgTags<Observation>(
        {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: LOINC, code: '2345-7', display: 'Glukoza' }], text: 'Glukoza' },
          subject: { reference: fx.patient.ref },
          effectiveDateTime: recent,
          valueQuantity: { value: 104, unit: 'mg/dl' },
          referenceRange: [{ low: { value: 70, unit: 'mg/dl' }, high: { value: 99, unit: 'mg/dl' } }],
          interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H' }] }],
          meta: { tag: [TRUST.patientConfirmed] },
        },
        [vaultOrgId(fx.patient.ref)],
      ),
    );
    await pt.req('POST', '/api/me/measurements', { kind: 'bp', systolic: 128, diastolic: 82 });
    await pt.req('POST', '/api/me/medications', { name: 'Ibuprofen 400 mg', dosage: 'doraźnie' });
    await pt.req('POST', '/api/me/journal', { kind: 'pain', intensity: 5, regions: ['left-knee'] });
    await pt.req('POST', '/api/me/journal', { kind: 'pain', intensity: 3, regions: ['left-knee'] });
    await pt.req('POST', '/api/me/vaccinations', { status: 'done', code: 'td', date: '2022-06-01' });
    await pt.req('POST', '/api/me/surveys/health-intake', { answers: { chronic: ['hypertension'], allergies: true, 'allergies-list': 'penicylina', smoking: 'never', 'self-rated': '4' } });
    await pt.req('PUT', '/api/me/directives', { kind: 'transfusion', value: 'refuse', showOnCard: true });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('SBAR: słowa pacjenta, tło, same dane w części A (zakres i oznaczenie tylko z dokumentu), pytania', async () => {
    const r = await pt.req('GET', `/api/me/doctor-report?${q}`);
    expect(r.status).toBe(200);
    expect(r.json.s).toEqual({ reason: 'Od tygodnia boli mnie kolano po bieganiu', since: '8 października' });
    expect(r.json.b.medications[0].name).toBe('Ibuprofen 400 mg');
    expect(r.json.b.surveys[0].answers).toEqual(expect.arrayContaining([{ question: 'Na jakie leki?', answer: 'penicylina' }]));
    expect(r.json.a.labs[0]).toMatchObject({ name: 'Glukoza', range: '70 – 99', labFlag: 'H' });
    expect(r.json.a.measurements[0]).toMatchObject({ kind: 'bp', systolic: 128 });
    expect(r.json.a.journal).toEqual([expect.objectContaining({ kind: 'pain', count: 2, min: 3, max: 5, mean: 4 })]);
    expect(r.json.r.questions).toBe('Czy mogę dalej biegać?');
    const html = doctorReportHtml(r.json);
    expect(html).toContain('W standardzie SBAR litera A oznacza ocenę');
    // aplikacja nie dopisuje ocen ani zaleceń
    expect(html.replace(/oznacza ocenę — dokonuje jej lekarz|nie ocenia wyników ani objawów|nie zostały zweryfikowane/g, '')).not.toMatch(/nieprawidłow|podwyższon|ryzyk|zalecamy|powinien|norma\b/i);
    expect((await pt.req('GET', '/api/me/doctor-report?reason=a')).status).toBe(400);
  });

  it('dokument FHIR: Bundle „document” z Composition, wszystkie odwołania wewnątrz pliku, poprawny strukturalnie', async () => {
    const r = await pt.req('GET', `/api/me/fhir-bundle?${q}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/fhir+json');
    const b = JSON.parse(r.body) as Bundle;
    expect(b.type).toBe('document');
    const comp = b.entry![0].resource as Composition;
    expect(comp.resourceType).toBe('Composition');
    expect(comp.type.coding?.[0].code).toBe('60591-5');
    expect(comp.section?.map((s) => s.title?.slice(0, 1))).toEqual(['S', 'B', 'B', 'B', 'B', 'A', 'R']);
    const urls = new Set(b.entry!.map((e) => e.fullUrl));
    const refs = [...r.body.matchAll(/"reference":"([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(3);
    for (const ref of refs) expect(urls.has(ref)).toBe(true);
    expect(() => validateFhir(b)).not.toThrow();
  });

  it('karta na wyjazd PL/EN: choroby, uczulenia, leki, dyspozycje zaznaczone do pokazania, 112', async () => {
    const r = await pt.req('GET', '/api/me/travel-card');
    expect(r.json.conditions).toEqual([{ pl: 'Nadciśnienie tętnicze', en: 'High blood pressure' }]);
    expect(r.json.allergies).toBe('penicylina');
    expect(r.json.medications).toEqual(['Ibuprofen 400 mg — doraźnie']);
    expect(r.json.directives).toEqual([{ pl: 'Nie wyrażam zgody na przetoczenie krwi', en: 'I do not consent to blood transfusion' }]);
    const { travelCardHtml } = await import('../../server/services/doctorReport.js');
    const html = travelCardHtml(r.json);
    expect(html).toContain('112');
    expect(html).toContain('Drug allergies');
  });
});
