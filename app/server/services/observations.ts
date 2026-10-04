import type { Observation, ObservationComponent } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { ETERNAL, LOINC, OBS_CATEGORY, UCUM, type VitalKind, VITALS } from '../fhir/constants.js';
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

export type MeasurementSource = 'manual' | 'bluetooth' | 'withings' | `rpm:${string}`;

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
  const base = { id: o.id ?? '', kind, effective: o.effectiveDateTime ?? '', source, device, note: o.note?.[0]?.text };
  if (kind === 'bp') {
    const comp = (code: string) => o.component?.find((c) => c.code.coding?.some((cd) => cd.code === code))?.valueQuantity?.value;
    return { ...base, systolic: comp(VITALS.systolic.code), diastolic: comp(VITALS.diastolic.code), unit: 'mmHg' };
  }
  return { ...base, value: o.valueQuantity?.value, unit: o.valueQuantity?.unit ?? '' };
}

export async function addMeasurement(actor: AuditActor, patientRef: string, input: MeasurementInput): Promise<MeasurementView[]> {
  const effective = input.effective ? new Date(input.effective) : new Date();
  if (Number.isNaN(effective.getTime())) throw badRequest('invalid_date');
  if (effective.getTime() > Date.now() + 5 * 60_000) throw badRequest('date_in_future');

  if (input.externalId) {
    const dup = await fhir().search<Observation>('Observation', { subject: patientRef, identifier: `${ETERNAL.source}|${input.externalId}` });
    if (dup.length) return dup.map(toMeasurementView).filter((m): m is MeasurementView => !!m);
  }

  const common: Partial<Observation> = {
    status: 'final',
    category: [{ coding: [{ system: OBS_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }] }],
    subject: { reference: patientRef },
    effectiveDateTime: effective.toISOString(),
    issued: nowIso(),
    performer: [{ reference: patientRef }],
    meta: { tag: [{ system: ETERNAL.source, code: input.source }] },
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
  for (const o of created) {
    audit(actor, { action: 'C', subtype: `measurement-${input.source.split(':')[0]}`, entityRef: `Observation/${o.id}`, patientRef });
  }
  bus.publish({ type: 'observation.changed', patientRef });
  return created.map(toMeasurementView).filter((m): m is MeasurementView => !!m);
}

export async function listMeasurements(patientRef: string, kind?: VitalKind): Promise<MeasurementView[]> {
  const params: Record<string, string> = { subject: patientRef, category: `${OBS_CATEGORY}|vital-signs`, _sort: '-date', _count: '500' };
  if (kind) params.code = `${LOINC}|${kind === 'bp' ? VITALS.bpPanel.code : VITALS[kind].code}`;
  const obs = await fhir().search<Observation>('Observation', params);
  return obs
    .filter((o) => o.status !== 'entered-in-error')
    .map(toMeasurementView)
    .filter((m): m is MeasurementView => !!m);
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
