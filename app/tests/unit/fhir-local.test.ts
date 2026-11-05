import type { Appointment, DiagnosticReport, Patient } from '@medplum/fhirtypes';
import { beforeEach, describe, expect, it } from 'vitest';
import { fhir } from '../../server/fhir/index.js';
import { FhirConflictError, FhirValidationError } from '../../server/fhir/repository.js';
import { setupCore } from './helpers.js';

describe('Lokalny magazyn FHIR R4', () => {
  beforeEach(setupCore);

  it('tworzy, wersjonuje i zachowuje historię', async () => {
    const p = await fhir().create<Patient>({ resourceType: 'Patient', name: [{ family: 'Nowak', given: ['Ewa'] }], birthDate: '1980-01-01' });
    expect(p.meta?.versionId).toBe('1');
    const u = await fhir().update<Patient>({ ...p, gender: 'female' });
    expect(u.meta?.versionId).toBe('2');
    const hist = await fhir().history('Patient', p.id ?? '');
    expect(hist.map((h) => h.meta?.versionId)).toEqual(['2', '1']);
  });

  it('blokada optymistyczna (If-Match) odrzuca nieaktualną wersję', async () => {
    const p = await fhir().create<Patient>({ resourceType: 'Patient', birthDate: '1980-01-01' });
    await fhir().update<Patient>({ ...p, gender: 'male' }, { ifMatch: '1' });
    await expect(fhir().update<Patient>({ ...p, gender: 'female' }, { ifMatch: '1' })).rejects.toBeInstanceOf(FhirConflictError);
  });

  it('waliduje zasoby względem specyfikacji FHIR R4', async () => {
    await expect(fhir().create({ resourceType: 'Appointment', status: 'booked', participant: [] } as Appointment)).rejects.toBeInstanceOf(FhirValidationError);
  });

  it('wyszukuje po referencji, dacie, tagu i sortuje', async () => {
    const mk = (start: string, patient: string, status: Appointment['status'] = 'booked') =>
      fhir().create<Appointment>({
        resourceType: 'Appointment',
        status,
        start,
        end: new Date(Date.parse(start) + 20 * 60_000).toISOString(),
        participant: [{ actor: { reference: patient }, status: 'accepted' }],
      });
    await mk('2026-11-03T09:00:00Z', 'Patient/a');
    await mk('2026-11-02T09:00:00Z', 'Patient/a');
    await mk('2026-11-02T10:00:00Z', 'Patient/b');
    await mk('2026-11-05T10:00:00Z', 'Patient/a', 'cancelled');
    const a = await fhir().search<Appointment>('Appointment', { patient: 'Patient/a', _sort: 'date' });
    expect(a.map((x) => x.start)).toEqual(['2026-11-02T09:00:00Z', '2026-11-03T09:00:00Z', '2026-11-05T10:00:00Z']);
    const range = await fhir().search<Appointment>('Appointment', { date: ['ge2026-11-02T09:30:00Z', 'lt2026-11-04T00:00:00Z'] });
    expect(range).toHaveLength(2);
    const booked = await fhir().search<Appointment>('Appointment', { patient: 'Patient/a', status: 'booked', _sort: '-date', _count: '1' });
    expect(booked[0].start).toBe('2026-11-03T09:00:00Z');

    await fhir().create<DiagnosticReport>({ resourceType: 'DiagnosticReport', status: 'final', code: { text: 'x' }, subject: { reference: 'Patient/a' }, meta: { tag: [{ system: 'urn:eternal:visibility', code: 'patient-visible' }] } });
    await fhir().create<DiagnosticReport>({ resourceType: 'DiagnosticReport', status: 'final', code: { text: 'y' }, subject: { reference: 'Patient/a' } });
    const visible = await fhir().search<DiagnosticReport>('DiagnosticReport', { subject: 'Patient/a', _tag: 'urn:eternal:visibility|patient-visible' });
    expect(visible.map((r) => r.code.text)).toEqual(['x']);
  });

  it('usunięcie jest logiczne — zasób znika z wyszukiwania, historia zostaje', async () => {
    const p = await fhir().create<Patient>({ resourceType: 'Patient', birthDate: '1980-01-01' });
    await fhir().delete('Patient', p.id ?? '');
    expect(await fhir().readOptional('Patient', p.id ?? '')).toBeUndefined();
    expect((await fhir().history('Patient', p.id ?? '')).length).toBe(2);
  });
});
