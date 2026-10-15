import type { DiagnosticReport, Observation } from '@medplum/fhirtypes';
import { ETERNAL, LOINC, TRUST } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { ORG_TAG_SYSTEM, orgIdsOf, vaultOrgId } from '../tenancy.js';
import { listMeasurements, type MeasurementView } from './observations.js';
import { patientCanViewRecords } from './records.js';

/**
 * Dane pacjenta widziane przez niego samego: wyniki z jego sejfu (dokumenty, które zapisał) oraz wyniki placówki
 * udostępnione pacjentowi. Wspólne źródło dla osi czasu (A2.5), eksportu CSV (A2.6) i raportu okresowego (A4).
 */

export interface LabFact {
  id?: string;
  name: string;
  loinc?: string;
  date: string;
  value: string;
  valueNum?: number;
  unit?: string;
  range?: string;
  labFlag?: string;
  status: Observation['status'];
  trust?: string;
  version?: string;
  documentId?: string;
  source: 'patient' | 'clinic';
}

export async function patientLabFacts(patientRef: string): Promise<LabFact[]> {
  const own = await fhirSystem().search<Observation>('Observation', { subject: patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '2000' });
  // wyniki placówki tylko udostępnione pacjentowi (jak w zakładce Wyniki)
  const clinic: Observation[] = [];
  if ((await patientCanViewRecords(patientRef)).allowed) {
    const reports = await fhir().search<DiagnosticReport>('DiagnosticReport', { subject: patientRef, _tag: `${ETERNAL.visibility}|patient-visible`, _count: '500' });
    const ids = reports.filter((r) => !orgIdsOf(r).includes(vaultOrgId(patientRef))).flatMap((r) => (r.result ?? []).map((x) => idFromRef(x.reference)));
    if (ids.length) clinic.push(...(await fhir().search<Observation>('Observation', { _id: ids.join(','), _count: '2000' })));
  }
  return [...own.map((o) => ({ o, source: 'patient' as const })), ...clinic.map((o) => ({ o, source: 'clinic' as const }))]
    .filter(({ o }) => !['entered-in-error', 'cancelled'].includes(o.status))
    .filter(({ o }) => !o.category?.some((c) => c.coding?.some((cd) => cd.code === 'vital-signs')))
    .map(({ o, source }) => ({
      id: o.id,
      name: o.code.text ?? o.code.coding?.[0]?.display ?? '',
      loinc: o.code.coding?.find((c) => c.system === LOINC)?.code,
      date: (o.effectiveDateTime ?? '').slice(0, 10),
      value: o.valueQuantity?.value !== undefined ? `${o.valueQuantity.comparator ?? ''}${o.valueQuantity.value}` : (o.valueString ?? ''),
      valueNum: o.valueQuantity?.comparator ? undefined : o.valueQuantity?.value,
      unit: o.valueQuantity?.unit,
      range: labRange(o),
      labFlag: o.interpretation?.[0]?.coding?.[0]?.code,
      status: o.status,
      trust: o.meta?.tag?.find((t) => t.system === ETERNAL.trust)?.code ?? (source === 'clinic' ? TRUST.clinic.code : undefined),
      version: o.meta?.versionId,
      documentId: o.derivedFrom?.[0]?.reference ? idFromRef(o.derivedFrom[0].reference) : undefined,
      source,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Zakres referencyjny przepisany z dokumentu laboratorium (tekst albo dolna/górna granica) — bez własnych norm. */
export function labRange(o: Observation): string | undefined {
  const r = o.referenceRange?.[0];
  if (!r) return undefined;
  if (r.text) return r.text.replace(/ \(zakres z dokumentu laboratorium\)$/, '');
  const lo = r.low?.value;
  const hi = r.high?.value;
  if (lo !== undefined && hi !== undefined) return `${lo} – ${hi}`;
  if (lo !== undefined) return `≥ ${lo}`;
  if (hi !== undefined) return `≤ ${hi}`;
  return undefined;
}

/** Wynik potwierdzony = zapisany przez pacjenta po sprawdzeniu, potwierdzony przez personel albo wprowadzony przez placówkę. */
export function isConfirmed(f: LabFact): boolean {
  return f.status !== 'preliminary' && f.trust !== TRUST.machineUnconfirmed.code;
}

// --- eksport CSV (A2.6) -----------------------------------------------------------------------------------

export const KIND_PL: Record<string, string> = { bp: 'ciśnienie', heartRate: 'tętno', weight: 'masa ciała', height: 'wzrost', temperature: 'temperatura', spo2: 'saturacja', glucose: 'glukoza' };
export const SOURCE_PL: Record<string, string> = { manual: 'wpis ręczny', bluetooth: 'urządzenie Bluetooth', withings: 'Withings', import: 'import z pliku', rpm: 'telemonitoring', patient: 'dokument przesłany przez pacjenta', clinic: 'placówka' };

function cell(v: string | number | undefined): string {
  const s = v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV dla Excela (średnik, przecinek dziesiętny, BOM). Kolumny pomiarów są zgodne z importem (A1.6),
 * więc plik można wczytać z powrotem; wiersze „wynik badania” import pomija (wyniki pochodzą z dokumentów).
 */
export function exportCsv(measurements: MeasurementView[], labs: LabFact[], range: { from?: string; to?: string }): string {
  const inRange = (d: string) => (!range.from || d.slice(0, 10) >= range.from) && (!range.to || d.slice(0, 10) <= range.to);
  const head = ['data', 'kategoria', 'rodzaj', 'wartość', 'skurczowe', 'rozkurczowe', 'jednostka', 'zakres z dokumentu', 'oznaczenie laboratorium', 'status', 'źródło', 'uwagi'];
  const rows: string[][] = [];
  for (const m of measurements.filter((x) => inRange(x.effective))) {
    rows.push([
      m.effective,
      'pomiar',
      KIND_PL[m.kind] ?? m.kind,
      m.kind === 'bp' ? '' : cell(m.value),
      m.kind === 'bp' ? cell(m.systolic) : '',
      m.kind === 'bp' ? cell(m.diastolic) : '',
      m.unit,
      '',
      '',
      m.corrected ? 'poprawiony' : '',
      cell(SOURCE_PL[m.source] ?? m.source),
      cell([m.note, m.correctionReason ? `powód korekty: ${m.correctionReason}` : ''].filter(Boolean).join(' · ')),
    ]);
  }
  for (const f of labs.filter((x) => inRange(x.date))) {
    rows.push([
      f.date,
      'wynik badania',
      cell(f.name),
      cell(f.value.replace('.', ',')),
      '',
      '',
      cell(f.unit),
      cell(f.range),
      cell(f.labFlag),
      isConfirmed(f) ? 'potwierdzony' : 'niepotwierdzony',
      cell(SOURCE_PL[f.source]),
      '',
    ]);
  }
  rows.sort((a, b) => b[0].localeCompare(a[0]));
  return `﻿${[head.join(';'), ...rows.map((r) => r.map((c, i) => (i === 0 ? c : c)).join(';'))].join('\r\n')}\r\n`;
}

export async function measurementsForExport(patientRef: string): Promise<MeasurementView[]> {
  return listMeasurements(patientRef);
}
