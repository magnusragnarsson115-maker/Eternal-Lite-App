import type { Observation, ObservationComponent } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { ETERNAL, LOINC, OBS_CATEGORY, TRUST, UCUM, type VitalKind, VITALS } from '../fhir/constants.js';
import { recordProvenance } from '../fhir/provenance.js';
import { fhir } from '../fhir/index.js';
import { badRequest, forbidden, notFound, nowIso } from '../lib/util.js';
import { hasConsent } from './consents.js';

/**
 * Pomiary domowe (FHIR Observation, kategoria vital-signs, kody LOINC profilu Vital Signs).
 * Zakresy poniżej to wyłącznie kontrola poprawności wprowadzania (literówki, błędy jednostek),
 * nie ocena kliniczna — aplikacja nie klasyfikuje pomiarów jako prawidłowe/nieprawidłowe.
 */

export const INPUT_LIMITS: Record<string, [number, number]> = {
  systolic: [50, 300],
  diastolic: [20, 200],
  heartRate: [20, 260],
  weight: [1, 400],
  height: [30, 250],
  temperature: [30, 45],
  spo2: [50, 100],
  glucose: [10, 1000],
};

export type MeasurementSource = 'manual' | 'bluetooth' | 'withings' | 'import' | `rpm:${string}`;

export interface MeasurementInput {
  kind: VitalKind;
  systolic?: number;
  diastolic?: number;
  value?: number;
  pulse?: number;
  effective?: string;
  note?: string;
  source: MeasurementSource;
  device?: string;
  externalId?: string;
}

export interface MeasurementView {
  id: string;
  kind: VitalKind;
  effective: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit: string;
  source: string;
  device?: string;
  note?: string;
  /** Wartość poprawiona przez pacjenta (A1.4) — poprzednie wersje w historii. */
  corrected?: boolean;
  correctionReason?: string;
  version?: string;
  /**
   * Oznaczenia jakości danych (A1.7), bez rozstrzygania: inny odczyt tego samego rodzaju z tej samej minuty.
   * „conflict” — inna wartość; „same-reading” — ta sama wartość z innego źródła. Żaden odczyt nie jest usuwany.
   */
  flags?: { type: 'conflict' | 'same-reading'; withId: string; withSource: string }[];
}

function check(name: string, v: number | undefined): number {
  if (v === undefined || !Number.isFinite(v)) throw badRequest('value_required', name);
  const [min, max] = INPUT_LIMITS[name];
  if (v < min || v > max) throw badRequest('value_out_of_input_range', `${name}: ${min}–${max}`, { field: name, min, max });
  return Math.round(v * 10) / 10;
}

function quantity(def: { unit: string; unitDisplay: string }, value: number) {
  return { value, unit: def.unitDisplay, system: UCUM, code: def.unit };
}

function kindOf(o: Observation): VitalKind | undefined {
  const code = o.code.coding?.find((c) => c.system === LOINC)?.code;
  if (code === VITALS.bpPanel.code) return 'bp';
  for (const k of ['heartRate', 'weight', 'height', 'temperature', 'spo2', 'glucose'] as const) {
    if (VITALS[k].code === code) return k;
  }
  return undefined;
}

export function toMeasurementView(o: Observation): MeasurementView | undefined {
  const kind = kindOf(o);
  if (!kind) return undefined;
  const source = o.meta?.tag?.find((t) => t.system === ETERNAL.source)?.code ?? 'manual';
  const device = o.extension?.find((e) => e.url === ETERNAL.ext.device)?.valueString;
  const reason = o.extension?.find((e) => e.url === ETERNAL.ext.correctionReason)?.valueString;
  const base = { id: o.id ?? '', kind, effective: o.effectiveDateTime ?? '', source, device, note: o.note?.[0]?.text, corrected: o.status === 'amended', correctionReason: reason, version: o.meta?.versionId };
  if (kind === 'bp') {
    const comp = (code: string) => o.component?.find((c) => c.code.coding?.some((cd) => cd.code === code))?.valueQuantity?.value;
    return { ...base, systolic: comp(VITALS.systolic.code), diastolic: comp(VITALS.diastolic.code), unit: 'mmHg' };
  }
  return { ...base, value: o.valueQuantity?.value, unit: o.valueQuantity?.unit ?? '' };
}

/** Tworzy zasoby pomiaru bez audytu, proweniencji i zdarzenia (wspólne dla wpisu, urządzeń i importu). */
async function createMeasurementResources(patientRef: string, input: MeasurementInput): Promise<{ created: Observation[]; existing: Observation[] }> {
  const effective = input.effective ? new Date(input.effective) : new Date();
  if (Number.isNaN(effective.getTime())) throw badRequest('invalid_date');
  if (effective.getTime() > Date.now() + 5 * 60_000) throw badRequest('date_in_future');

  if (input.externalId) {
    const dup = await fhir().search<Observation>('Observation', { subject: patientRef, identifier: `${ETERNAL.source}|${input.externalId}` });
    if (dup.length) return { created: [], existing: dup };
  }

  const common: Partial<Observation> = {
    status: 'final',
    category: [{ coding: [{ system: OBS_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }] }],
    subject: { reference: patientRef },
    effectiveDateTime: effective.toISOString(),
    issued: nowIso(),
    performer: [{ reference: patientRef }],
    meta: { tag: [{ system: ETERNAL.source, code: input.source }, ...(input.source === 'manual' ? [TRUST.manual] : [])] },
    note: input.note?.trim() ? [{ text: input.note.trim().slice(0, 300) }] : undefined,
    extension: input.device ? [{ url: ETERNAL.ext.device, valueString: input.device.slice(0, 120) }] : undefined,
    identifier: input.externalId ? [{ system: ETERNAL.source, value: input.externalId }] : undefined,
  };

  const created: Observation[] = [];
  if (input.kind === 'bp') {
    const sys = check('systolic', input.systolic);
    const dia = check('diastolic', input.diastolic);
    if (dia >= sys) throw badRequest('diastolic_not_lower');
    const components: ObservationComponent[] = [
      { code: { coding: [{ system: LOINC, code: VITALS.systolic.code, display: VITALS.systolic.display }], text: VITALS.systolic.pl }, valueQuantity: quantity(VITALS.systolic, sys) },
      { code: { coding: [{ system: LOINC, code: VITALS.diastolic.code, display: VITALS.diastolic.display }], text: VITALS.diastolic.pl }, valueQuantity: quantity(VITALS.diastolic, dia) },
    ];
    created.push(
      await fhir().create<Observation>({
        ...common,
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ system: LOINC, code: VITALS.bpPanel.code, display: VITALS.bpPanel.display }], text: VITALS.bpPanel.pl },
        component: components,
      }),
    );
    if (input.pulse !== undefined) {
      const hr = check('heartRate', input.pulse);
      created.push(
        await fhir().create<Observation>({
          ...common,
          identifier: input.externalId ? [{ system: ETERNAL.source, value: `${input.externalId}:hr` }] : undefined,
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: LOINC, code: VITALS.heartRate.code, display: VITALS.heartRate.display }], text: VITALS.heartRate.pl },
          valueQuantity: quantity(VITALS.heartRate, hr),
        }),
      );
    }
  } else {
    const def = VITALS[input.kind];
    const v = check(input.kind, input.value);
    created.push(
      await fhir().create<Observation>({
        ...common,
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ system: LOINC, code: def.code, display: def.display }], text: def.pl },
        valueQuantity: quantity(def, v),
      }),
    );
  }
  return { created, existing: [] };
}

export async function addMeasurement(actor: AuditActor, patientRef: string, input: MeasurementInput): Promise<MeasurementView[]> {
  const { created, existing } = await createMeasurementResources(patientRef, input);
  if (!created.length) return existing.map(toMeasurementView).filter((m): m is MeasurementView => !!m);
  for (const o of created) {
    audit(actor, { action: 'C', subtype: `measurement-${input.source.split(':')[0]}`, entityRef: `Observation/${o.id}`, patientRef });
  }
  await recordProvenance({
    targets: created.map((o) => `Observation/${o.id}`),
    activity: input.source === 'manual' ? 'manual-entry' : 'document-read',
    agents: [{ who: patientRef, display: input.source === 'manual' ? 'Pacjent (wpis ręczny)' : `Pacjent (${input.device ?? input.source})`, role: 'author' }],
  });
  bus.publish({ type: 'observation.changed', patientRef });
  return created.map(toMeasurementView).filter((m): m is MeasurementView => !!m);
}

/**
 * Zapis wielu pomiarów z jednego pliku (A1.6): jeden wpis proweniencji z nazwą pliku, audyt każdego zasobu,
 * jedno zdarzenie odświeżenia. Pomiary z tym samym identyfikatorem importu są pomijane (ponowny import).
 */
export async function addMeasurementsBatch(actor: AuditActor, patientRef: string, inputs: MeasurementInput[], fileLabel: string): Promise<{ created: number; existing: number }> {
  const all: Observation[] = [];
  let existing = 0;
  for (const input of inputs) {
    const r = await createMeasurementResources(patientRef, input);
    all.push(...r.created);
    if (!r.created.length && r.existing.length) existing++;
  }
  for (const o of all) audit(actor, { action: 'C', subtype: 'measurement-import', entityRef: `Observation/${o.id}`, patientRef });
  if (all.length) {
    await recordProvenance({
      targets: all.map((o) => `Observation/${o.id}`),
      activity: 'import',
      agents: [{ who: patientRef, display: `Pacjent (import z pliku ${fileLabel})`, role: 'author' }],
    });
    bus.publish({ type: 'observation.changed', patientRef });
  }
  return { created: all.length, existing };
}

function readingKey(m: MeasurementView): string {
  return m.kind === 'bp' ? `${m.systolic}/${m.diastolic}` : String(m.value);
}

/** Oznacza odczyty tego samego rodzaju z tej samej minuty (A1.7). Nie usuwa i nie wybiera „właściwego”. */
export function flagReadings(items: MeasurementView[]): MeasurementView[] {
  const byKind = new Map<string, MeasurementView[]>();
  for (const m of items) byKind.set(m.kind, [...(byKind.get(m.kind) ?? []), m]);
  const flags = new Map<string, NonNullable<MeasurementView['flags']>>();
  const add = (a: MeasurementView, b: MeasurementView, type: 'conflict' | 'same-reading') => flags.set(a.id, [...(flags.get(a.id) ?? []), { type, withId: b.id, withSource: b.source }]);
  for (const list of byKind.values()) {
    const sorted = [...list].sort((a, b) => a.effective.localeCompare(b.effective));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (Date.parse(b.effective) - Date.parse(a.effective) >= 60_000) break;
        if (readingKey(a) !== readingKey(b)) {
          add(a, b, 'conflict');
          add(b, a, 'conflict');
        } else if (a.source !== b.source) {
          add(a, b, 'same-reading');
          add(b, a, 'same-reading');
        }
      }
    }
  }
  return items.map((m) => (flags.has(m.id) ? { ...m, flags: flags.get(m.id) } : m));
}

export async function listMeasurements(patientRef: string, kind?: VitalKind): Promise<MeasurementView[]> {
  const params: Record<string, string> = { subject: patientRef, category: `${OBS_CATEGORY}|vital-signs`, _sort: '-date', _count: '2000' };
  if (kind) params.code = `${LOINC}|${kind === 'bp' ? VITALS.bpPanel.code : VITALS[kind].code}`;
  const obs = await fhir().search<Observation>('Observation', params);
  return flagReadings(
    obs
      .filter((o) => o.status !== 'entered-in-error')
      .map(toMeasurementView)
      .filter((m): m is MeasurementView => !!m),
  );
}

/** Pomiar wprowadzony omyłkowo — status entered-in-error (FHIR), historia pozostaje. */
export async function retractMeasurement(actor: AuditActor, patientRef: string, id: string): Promise<void> {
  const o = await fhir().readOptional<Observation>('Observation', id);
  if (!o || o.subject?.reference !== patientRef) throw notFound('measurement_not_found');
  if (o.performer?.[0]?.reference !== patientRef) throw forbidden('not_patient_entered');
  await fhir().update<Observation>({ ...o, status: 'entered-in-error' });
  audit(actor, { action: 'U', subtype: 'measurement-retract', entityRef: `Observation/${id}`, patientRef });
  bus.publish({ type: 'observation.changed', patientRef });
}

/** Personel widzi pomiary domowe tylko po zgodzie pacjenta na ich przekazywanie. */
export async function listMeasurementsForStaff(patientRef: string): Promise<{ shared: boolean; items: MeasurementView[] }> {
  if (!(await hasConsent(patientRef, 'share-measurements'))) return { shared: false, items: [] };
  return { shared: true, items: await listMeasurements(patientRef) };
}

/**
 * Ręczna korekta wartości (A1.4): nowa wersja zasobu ze statusem „amended” i powodem; poprzednia wartość
 * zostaje w historii wersji (FHIR _history) i jest widoczna w aplikacji.
 */
export async function correctMeasurement(
  actor: AuditActor,
  patientRef: string,
  id: string,
  input: { value?: number; systolic?: number; diastolic?: number; reason: string },
): Promise<MeasurementView> {
  const o = await fhir().readOptional<Observation>('Observation', id);
  if (!o || o.subject?.reference !== patientRef || o.status === 'entered-in-error') throw notFound('measurement_not_found');
  if (o.performer?.[0]?.reference !== patientRef) throw forbidden('not_patient_entered');
  const reason = input.reason.trim();
  if (reason.length < 3) throw badRequest('reason_required');
  const kind = kindOf(o);
  if (!kind) throw badRequest('not_a_measurement');
  let next: Observation;
  if (kind === 'bp') {
    const sys = check('systolic', input.systolic);
    const dia = check('diastolic', input.diastolic);
    if (dia >= sys) throw badRequest('diastolic_not_lower');
    next = {
      ...o,
      component: (o.component ?? []).map((c) =>
        c.code.coding?.some((cd) => cd.code === VITALS.systolic.code) ? { ...c, valueQuantity: quantity(VITALS.systolic, sys) } : c.code.coding?.some((cd) => cd.code === VITALS.diastolic.code) ? { ...c, valueQuantity: quantity(VITALS.diastolic, dia) } : c,
      ),
    };
  } else {
    next = { ...o, valueQuantity: quantity(VITALS[kind], check(kind, input.value)) };
  }
  next.status = 'amended';
  next.extension = [...(o.extension ?? []).filter((e) => e.url !== ETERNAL.ext.correctionReason), { url: ETERNAL.ext.correctionReason, valueString: reason.slice(0, 300) }];
  const saved = await fhir().update<Observation>(next);
  await recordProvenance({ targets: [`Observation/${id}`], activity: 'correction', agents: [{ who: patientRef, display: 'Pacjent', role: 'author' }], reason });
  audit(actor, { action: 'U', subtype: 'measurement-correct', entityRef: `Observation/${id}`, patientRef });
  bus.publish({ type: 'observation.changed', patientRef });
  return toMeasurementView(saved)!;
}

/** Historia wersji wartości (najnowsza pierwsza). */
export async function observationVersions(patientRef: string, id: string) {
  const current = await fhir().readOptional<Observation>('Observation', id);
  if (!current || current.subject?.reference !== patientRef) throw notFound('observation_not_found');
  const versions = await fhir().history<Observation>('Observation', id);
  return versions.map((v) => {
    const m = toMeasurementView(v);
    const q = v.valueQuantity;
    return {
      version: v.meta?.versionId,
      at: v.meta?.lastUpdated,
      status: v.status,
      value: m ? (m.kind === 'bp' ? `${m.systolic}/${m.diastolic}` : String(m.value ?? '')) : q?.value !== undefined ? `${q.comparator ?? ''}${q.value}` : (v.valueString ?? ''),
      unit: m?.unit ?? q?.unit,
      reason: v.extension?.find((e) => e.url === ETERNAL.ext.correctionReason)?.valueString,
      trust: v.meta?.tag?.find((t) => t.system === ETERNAL.trust)?.code,
    };
  });
}
