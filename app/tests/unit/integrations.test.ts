import type { Observation } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { PESEL_SYSTEM } from '../../server/fhir/constants.js';
import { signJitsiJwt, teleJoinInfo, teleWindowOpen } from '../../server/integrations/jitsi.js';
import { mapQueue } from '../../server/integrations/nfz.js';
import { parseProductBlock } from '../../server/integrations/rpl.js';
import { ingestRpm, mapRpmObservation, verifySignature } from '../../server/integrations/rpm.js';
import { parseClinicalTables, searchLocalLab, stripEm } from '../../server/integrations/terminology.js';
import { mapMeasureGroup } from '../../server/integrations/withings.js';
import { HttpError } from '../../server/lib/util.js';
import { listMeasurements } from '../../server/services/observations.js';
import { makePatient, setupCore } from './helpers.js';
import { normalizePolishPhone } from '../../server/integrations/channels.js';

const sign = (body: string, ts: string, secret = 'test-secret') => `sha256=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;

describe('Webhook RPM (Vitalera i inne platformy)', () => {
  beforeEach(setupCore);

  it('weryfikuje podpis HMAC i znacznik czasu', () => {
    const body = '{"resourceType":"Observation"}';
    const ts = String(Math.floor(Date.now() / 1000));
    expect(() => verifySignature('vitalera', body, ts, sign(body, ts))).not.toThrow();
    expect(() => verifySignature('vitalera', body, ts, sign(body, ts, 'zly'))).toThrow(HttpError);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(() => verifySignature('vitalera', body, old, sign(body, old))).toThrow(/stale|stale_timestamp/);
    expect(() => verifySignature('nieznany', body, ts, sign(body, ts))).toThrow(HttpError);
  });

  it('mapuje Observation z konwersją jednostek', () => {
    const bp = mapRpmObservation(
      {
        resourceType: 'Observation',
        id: 'v1',
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
        effectiveDateTime: '2026-10-01T08:00:00Z',
        component: [
          { code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 132 } },
          { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: 85 } },
        ],
      },
      'vitalera',
    );
    expect(bp).toMatchObject({ kind: 'bp', systolic: 132, diastolic: 85, source: 'rpm:vitalera', externalId: 'vitalera:v1' });
    const w = mapRpmObservation({ resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '29463-7' }] }, valueQuantity: { value: 154.3, code: '[lb_av]' } }, 'vitalera');
    expect(w).toMatchObject({ kind: 'weight', value: 70 });
    const g = mapRpmObservation({ resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '15074-8' }] }, valueQuantity: { value: 5.5, unit: 'mmol/L' } }, 'vitalera');
    expect(g).toMatchObject({ kind: 'glucose', value: 99 });
    expect(mapRpmObservation({ resourceType: 'Observation', status: 'final', code: { text: 'x' } }, 'vitalera')).toBe('unsupported_code');
  });

  it('przyjmuje Bundle, identyfikuje pacjenta po PESEL i deduplikuje', async () => {
    const pesel = '90050501238';
    const { createPatient } = await import('../../server/services/patients.js');
    const p = await createPatient({ display: 't' }, { given: 'Jan', family: 'Monitorowany', pesel: undefined, birthDate: '1990-05-05' });
    const { fhir } = await import('../../server/fhir/index.js');
    await fhir().update({ ...p, identifier: [{ system: PESEL_SYSTEM, value: pesel }] });
    const obs: Observation = { resourceType: 'Observation', id: 'hr-1', status: 'final', subject: { identifier: { system: PESEL_SYSTEM, value: pesel } }, code: { coding: [{ system: 'http://loinc.org', code: '8867-4' }] }, valueQuantity: { value: 64 }, effectiveDateTime: new Date(Date.now() - 60_000).toISOString() };
    const bundle = { resourceType: 'Bundle', type: 'collection', entry: [{ resource: obs }, { resource: { ...obs, id: 'x', subject: { reference: 'Patient/nie-ma' } } }] };
    const r1 = await ingestRpm('vitalera', bundle);
    expect(r1.accepted).toBe(1);
    expect(r1.rejected).toEqual([{ index: 1, reason: 'patient_not_found' }]);
    await ingestRpm('vitalera', bundle);
    expect((await listMeasurements(`Patient/${p.id}`)).length).toBe(1);
  });
});

describe('Adaptery API', () => {
  it('Withings: wartość = value × 10^unit, grupa ciśnienia', () => {
    const inputs = mapMeasureGroup({ grpid: 7, date: 1_790_000_000, deviceid: 'abc123456', measures: [{ type: 10, value: 12100, unit: -2 }, { type: 9, value: 79, unit: 0 }, { type: 11, value: 68, unit: 0 }, { type: 1, value: 72350, unit: -3 }] });
    expect(inputs.find((i) => i.kind === 'bp')).toMatchObject({ systolic: 121, diastolic: 79, pulse: 68, externalId: 'withings:7:bp' });
    expect(inputs.find((i) => i.kind === 'weight')).toMatchObject({ value: 72.35 });
  });

  it('NFZ: mapowanie atrybutów kolejki', () => {
    const q = mapQueue({ provider: 'SZPITAL', place: 'PORADNIA KARDIOLOGICZNA', address: 'UL. TESTOWA 1', locality: 'WARSZAWA', dates: { date: '2026-11-20', 'date-situation-as-at': '2026-10-01' }, statistics: { 'provider-data': { awaiting: 120, 'average-period': 45 } }, 'benefits-for-children': 'N' });
    expect(q).toMatchObject({ firstAvailableDate: '2026-11-20', awaiting: 120, averagePeriodDays: 45, forChildren: false });
  });

  it('terminologie: format NLM, słownik lokalny bez polskich znaków, ICD-11', () => {
    expect(parseClinicalTables([2, ['2345-7', '718-7'], null, [['2345-7', 'Glucose'], ['718-7', 'Hemoglobin']]])).toEqual([
      { code: '2345-7', display: 'Glucose' },
      { code: '718-7', display: 'Hemoglobin' },
    ]);
    expect(searchLocalLab('zelazo')[0]).toMatchObject({ code: '2498-4', displayPl: 'Żelazo' });
    expect(searchLocalLab('płytki')[0].code).toBe('777-3');
    expect(stripEm('<em class="found">Asthma</em>')).toBe('Asthma');
  });

  it('RPL: parser eksportu XML w wariancie atrybutów i elementów', () => {
    const attr = parseProductBlock('<produktLeczniczy id="100" nazwaProduktu="Apap" nazwaPowszechnieStosowana="Paracetamolum" moc="500 mg" nazwaPostaciFarmaceutycznej="Tabletki powlekane" podmiotOdpowiedzialny="US Pharmacia" numerPozwolenia="1234" kodATC="N02BE01"><substancjeCzynne><substancjaCzynna>Paracetamolum</substancjaCzynna></substancjeCzynne></produktLeczniczy>');
    expect(attr).toMatchObject({ id: '100', name: 'Apap', strength: '500 mg', atc: 'N02BE01', substances: ['Paracetamolum'] });
    const el = parseProductBlock('<produktLeczniczy><id>200</id><nazwaProduktu>Ibuprom &amp; Co</nazwaProduktu><moc>200 mg</moc></produktLeczniczy>');
    expect(el).toMatchObject({ id: '200', name: 'Ibuprom & Co', strength: '200 mg' });
  });

  it('Jitsi: okno dołączenia i podpis JWT', () => {
    const start = new Date(Date.now() + 10 * 60_000).toISOString();
    const end = new Date(Date.now() + 25 * 60_000).toISOString();
    expect(teleWindowOpen(start, end)).toBe(true);
    expect(teleWindowOpen(new Date(Date.now() + 3_600_000).toISOString(), end)).toBe(false);
    const info = teleJoinInfo('abc', { name: 'Anna', id: 'u1', moderator: false });
    expect(info.room).toBe('eternal-abc');
    expect(info.publicServer).toBe(true);
    expect(signJitsiJwt('r', { name: 'x', id: 'y', moderator: true })).toBeUndefined();
  });

  it('SMS: normalizacja numerów', () => {
    expect(normalizePolishPhone('+48 500 000 001')).toBe('48500000001');
    expect(normalizePolishPhone('500-000-001')).toBe('48500000001');
    expect(normalizePolishPhone('12')).toBeUndefined();
  });
});
