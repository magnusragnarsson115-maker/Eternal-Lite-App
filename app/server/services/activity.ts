import type { Observation } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { LOINC } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, vaultOrgId, withOrgTags } from '../tenancy.js';

/**
 * Aktywność i sen z urządzeń (F2.1, F2.2, A1.8, F9.1, F9.3, F12.1, F2.19): dzienne podsumowania z Apple Health,
 * Health Connect albo Withings Sleep — kroki, czas snu i fazy snu tak, jak je policzyło urządzenie. Aplikacja
 * przechowuje i pokazuje liczby; nie ocenia snu ani aktywności i nie wylicza „wyniku”.
 *
 * Jeden dzień × rodzaj × źródło = jedna obserwacja (ponowny import nadpisuje ją, zamiast dublować).
 */

export const ACTIVITY_SOURCES = ['healthkit', 'health-connect', 'withings', 'manual'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];
export const SOURCE_LABEL: Record<ActivitySource, string> = { healthkit: 'Apple Health', 'health-connect': 'Health Connect', withings: 'Withings', manual: 'wpis ręczny' };

const STEPS = { system: LOINC, code: '41950-7', display: 'Number of steps in 24 hour Measured' };
const SLEEP = { system: LOINC, code: '93832-4', display: 'Sleep duration' };
const PHASE_SYSTEM = 'urn:eternal:sleep-phase';
const SOURCE_SYSTEM = 'urn:eternal:activity-source';
/** Okno snu (od–do) w rozszerzeniu, bo effective[x] to dzień podsumowania. */
const WINDOW_EXT = 'urn:eternal:ext:sleep-window';
export const SLEEP_PHASES = ['deep', 'light', 'rem', 'awake'] as const;
type Phase = (typeof SLEEP_PHASES)[number];

export interface ActivityDayInput {
  date: string;
  steps?: number;
  sleep?: { minutes: number; deep?: number; light?: number; rem?: number; awake?: number; start?: string; end?: string };
}

export interface ActivityDay {
  date: string;
  source: ActivitySource;
  device?: string;
  steps?: number;
  sleep?: { minutes: number; deep?: number; light?: number; rem?: number; awake?: number; start?: string; end?: string };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(d: ActivityDayInput, today: string): void {
  if (!DATE.test(d.date) || d.date > today) throw badRequest('invalid_date');
  if (d.steps !== undefined && !(Number.isInteger(d.steps) && d.steps >= 0 && d.steps <= 200_000)) throw badRequest('invalid_value');
  if (d.sleep) {
    const { minutes, ...phases } = d.sleep;
    if (!(minutes >= 0 && minutes <= 24 * 60)) throw badRequest('invalid_value');
    for (const p of SLEEP_PHASES) {
      const v = phases[p];
      if (v !== undefined && !(v >= 0 && v <= 24 * 60)) throw badRequest('invalid_value');
    }
  }
  if (d.steps === undefined && !d.sleep) throw badRequest('entry_empty');
}

function tags(source: ActivitySource) {
  return [{ system: SOURCE_SYSTEM, code: source }];
}

async function existing(patientRef: string, code: string, date: string, source: ActivitySource): Promise<Observation | undefined> {
  const found = await fhirSystem().search<Observation>('Observation', { subject: patientRef, code: `${LOINC}|${code}`, date: `eq${date}`, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '20' });
  return found.find((o) => o.status !== 'entered-in-error' && o.meta?.tag?.some((t) => t.system === SOURCE_SYSTEM && t.code === source) && o.effectiveDateTime?.slice(0, 10) === date);
}

async function upsert(patientRef: string, obs: Observation, code: string, date: string, source: ActivitySource): Promise<'created' | 'updated'> {
  const prev = await existing(patientRef, code, date, source);
  const tagged = withOrgTags({ ...obs, meta: { ...obs.meta, tag: [...(obs.meta?.tag ?? []), ...tags(source)] } }, [vaultOrgId(patientRef)]);
  if (prev) {
    await fhirSystem().update<Observation>({ ...tagged, id: prev.id });
    return 'updated';
  }
  await fhirSystem().create<Observation>(tagged);
  return 'created';
}

/** Import dziennych podsumowań (np. z telefonu albo Withings). Zwraca liczby utworzonych i zaktualizowanych. */
export async function importActivity(
  actor: AuditActor,
  patientRef: string,
  input: { source: ActivitySource; device?: string; days: ActivityDayInput[] },
  today: string = nowIso().slice(0, 10),
): Promise<{ created: number; updated: number }> {
  if (!ACTIVITY_SOURCES.includes(input.source)) throw badRequest('invalid_value');
  if (input.days.length > 400) throw badRequest('too_many');
  for (const d of input.days) validate(d, today);
  const device = input.device?.trim().slice(0, 80) || SOURCE_LABEL[input.source];
  let created = 0;
  let updated = 0;
  const count = (r: 'created' | 'updated') => (r === 'created' ? created++ : updated++);
  for (const d of input.days) {
    const base = {
      resourceType: 'Observation' as const,
      status: 'final' as const,
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'activity' }] }],
      subject: { reference: patientRef },
      performer: [{ reference: patientRef }],
      effectiveDateTime: d.date,
      device: { display: device },
      issued: nowIso(),
    };
    if (d.steps !== undefined) count(await upsert(patientRef, { ...base, code: { coding: [STEPS], text: 'Kroki' }, valueQuantity: { value: d.steps, unit: 'kroki', system: 'http://unitsofmeasure.org', code: '/d' } }, STEPS.code, d.date, input.source));
    if (d.sleep) {
      const s = d.sleep;
      count(
        await upsert(
          patientRef,
          {
            ...base,
            code: { coding: [SLEEP], text: 'Czas snu' },
            extension: s.start && s.end ? [{ url: WINDOW_EXT, valuePeriod: { start: s.start, end: s.end } }] : undefined,
            valueQuantity: { value: Math.round(s.minutes), unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' },
            component: SLEEP_PHASES.filter((p) => s[p] !== undefined).map((p) => ({
              code: { coding: [{ system: PHASE_SYSTEM, code: p }] },
              valueQuantity: { value: Math.round(s[p]!), unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' },
            })),
          },
          SLEEP.code,
          d.date,
          input.source,
        ),
      );
    }
  }
  audit(actor, { action: 'C', subtype: 'activity-import', patientRef, detail: { source: input.source, days: input.days.length, created, updated } });
  bus.publish({ type: 'observation.changed', patientRef, orgIds: [vaultOrgId(patientRef)] });
  return { created, updated };
}

export async function listActivity(actor: AuditActor, patientRef: string, days = 30, today: string = nowIso().slice(0, 10)): Promise<ActivityDay[]> {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const obs = await fhirSystem().search<Observation>('Observation', { subject: patientRef, category: 'activity', _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, date: `ge${since}`, _count: '2000' });
  const map = new Map<string, ActivityDay>();
  for (const o of obs) {
    if (o.status === 'entered-in-error' || !o.effectiveDateTime) continue;
    const code = o.code.coding?.[0]?.code;
    const source = (o.meta?.tag?.find((t) => t.system === SOURCE_SYSTEM)?.code ?? 'manual') as ActivitySource;
    const date = o.effectiveDateTime.slice(0, 10);
    const key = `${date}|${source}`;
    const day = map.get(key) ?? { date, source, device: o.device?.display };
    if (code === STEPS.code) day.steps = o.valueQuantity?.value;
    if (code === SLEEP.code) {
      const phase = (p: Phase) => o.component?.find((c) => c.code.coding?.[0]?.code === p)?.valueQuantity?.value;
      const win = o.extension?.find((e) => e.url === WINDOW_EXT)?.valuePeriod;
      day.sleep = { minutes: o.valueQuantity?.value ?? 0, deep: phase('deep'), light: phase('light'), rem: phase('rem'), awake: phase('awake'), start: win?.start, end: win?.end };
    }
    map.set(key, day);
  }
  audit(actor, { action: 'R', subtype: 'activity-list', patientRef });
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source));
}
