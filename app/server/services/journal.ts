import type { Observation, ObservationComponent } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { LOINC } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, vaultOrgId, withOrgTags } from '../tenancy.js';
import { crisisMentioned } from './safety.js';

/**
 * Dzienniki pacjenta (F8.2/A8.1 nastrój, F8.14/F9.13 sen i sny, A21.3/A22.3 mapa i skala bólu, A8.6 ćwiczenia
 * oddechowe). Zapis tego, co pacjent sam ocenił — bez interpretacji, bez wniosków i bez alarmów dla placówki.
 * Wpisy leżą w sejfie pacjenta (lekarz widzi je tylko po udostępnieniu). Wyjątek bezpieczeństwa (F8.1): bardzo niski
 * nastrój albo słowa kryzysowe w notatce → aplikacja od razu pokazuje numery pomocy, niczego nie wysyła.
 */

export const JOURNAL_SYSTEM = 'urn:eternal:journal';
export const JOURNAL_TAG = { system: JOURNAL_SYSTEM, code: 'patient-journal', display: 'Dziennik pacjenta (samoocena)' };
export const JOURNAL_KINDS = ['mood', 'sleep', 'pain', 'breathing'] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const MOOD_TAGS = ['work', 'family', 'sleep', 'health', 'movement', 'weather', 'money', 'loneliness'] as const;
export const PAIN_REGIONS = [
  'head',
  'neck',
  'chest',
  'abdomen',
  'upper-back',
  'lower-back',
  'left-shoulder',
  'right-shoulder',
  'left-arm',
  'right-arm',
  'left-hand',
  'right-hand',
  'left-hip',
  'right-hip',
  'left-knee',
  'right-knee',
  'left-foot',
  'right-foot',
  'pelvis',
] as const;
export const PAIN_CHARACTER = ['stabbing', 'burning', 'dull', 'throbbing', 'radiating', 'cramping'] as const;
export const BREATHING_PATTERNS = ['box', '4-7-8', 'calm'] as const;

const CODE: Record<JournalKind, { code: string; display: string; loinc?: { code: string; display: string } }> = {
  mood: { code: 'mood', display: 'Samopoczucie (samoocena 1–10)' },
  sleep: { code: 'sleep', display: 'Sen (dziennik)', loinc: { code: '93832-4', display: 'Sleep duration' } },
  pain: { code: 'pain', display: 'Ból (samoocena 0–10)', loinc: { code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported' } },
  breathing: { code: 'breathing', display: 'Ćwiczenie oddechowe' },
};

export type JournalInput =
  | { kind: 'mood'; at?: string; mood: number; tags?: (typeof MOOD_TAGS)[number][]; note?: string }
  | { kind: 'sleep'; date: string; bedtime: string; wake: string; quality: number; awakenings?: number; note?: string }
  | { kind: 'pain'; at?: string; intensity: number; regions: (typeof PAIN_REGIONS)[number][]; character?: (typeof PAIN_CHARACTER)[number][]; note?: string }
  | { kind: 'breathing'; at?: string; minutes: number; pattern: (typeof BREATHING_PATTERNS)[number] };

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  at: string;
  mood?: number;
  tags?: string[];
  sleep?: { date: string; bedtime: string; wake: string; hours: number; quality: number; awakenings?: number };
  pain?: { intensity: number; regions: string[]; character: string[] };
  breathing?: { minutes: number; pattern: string };
  note?: string;
}

const comp = (code: string, value: Partial<ObservationComponent>): ObservationComponent => ({ code: { coding: [{ system: JOURNAL_SYSTEM, code }] }, ...value });
const compOf = (o: Observation, code: string) => o.component?.filter((c) => c.code.coding?.some((x) => x.system === JOURNAL_SYSTEM && x.code === code)) ?? [];

export function isJournal(o: Observation): boolean {
  return !!o.meta?.tag?.some((t) => t.system === JOURNAL_SYSTEM);
}

function kindOf(o: Observation): JournalKind | undefined {
  const c = o.code.coding?.find((x) => x.system === JOURNAL_SYSTEM)?.code;
  return (JOURNAL_KINDS as readonly string[]).includes(c ?? '') ? (c as JournalKind) : undefined;
}

export function toJournalEntry(o: Observation): JournalEntry | undefined {
  const kind = kindOf(o);
  if (!kind) return undefined;
  const base: JournalEntry = { id: o.id ?? '', kind, at: o.effectiveDateTime ?? o.effectivePeriod?.end ?? '', note: o.note?.[0]?.text };
  switch (kind) {
    case 'mood':
      return { ...base, mood: o.valueInteger, tags: compOf(o, 'tag').map((c) => c.valueString ?? '') };
    case 'sleep': {
      const date = compOf(o, 'night')[0]?.valueString ?? (o.effectivePeriod?.end ?? '').slice(0, 10);
      return {
        ...base,
        sleep: {
          date,
          bedtime: compOf(o, 'bedtime')[0]?.valueString ?? '',
          wake: compOf(o, 'wake')[0]?.valueString ?? '',
          hours: o.valueQuantity?.value ?? 0,
          quality: compOf(o, 'quality')[0]?.valueInteger ?? 0,
          awakenings: compOf(o, 'awakenings')[0]?.valueInteger,
        },
      };
    }
    case 'pain':
      return {
        ...base,
        pain: { intensity: o.valueInteger ?? 0, regions: compOf(o, 'region').map((c) => c.valueString ?? ''), character: compOf(o, 'character').map((c) => c.valueString ?? '') },
      };
    case 'breathing':
      return { ...base, breathing: { minutes: o.valueQuantity?.value ?? 0, pattern: compOf(o, 'pattern')[0]?.valueString ?? '' } };
  }
}

function minutesOf(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw badRequest('invalid_time');
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Czas snu z godzin zaśnięcia i pobudki (zaśnięcie po północy albo przed — obie wersje). */
export function sleepHours(bedtime: string, wake: string): number {
  let d = minutesOf(wake) - minutesOf(bedtime);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 10) / 10;
}

function checkAt(at: string | undefined, now: Date): string {
  const t = at ? new Date(at) : now;
  if (Number.isNaN(t.getTime())) throw badRequest('invalid_date');
  if (t.getTime() > now.getTime() + 5 * 60_000) throw badRequest('date_in_future');
  return t.toISOString();
}

const cleanNote = (s?: string, max = 1000) => (s?.trim() ? s.trim().slice(0, max) : undefined);

function build(patientRef: string, input: JournalInput, now: Date): Observation {
  const def = CODE[input.kind];
  const base: Observation = {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
    code: { coding: [{ system: JOURNAL_SYSTEM, code: def.code, display: def.display }, ...(def.loinc ? [{ system: LOINC, ...def.loinc }] : [])], text: def.display },
    subject: { reference: patientRef },
    performer: [{ reference: patientRef }],
    issued: nowIso(),
    meta: { tag: [JOURNAL_TAG] },
  };
  switch (input.kind) {
    case 'mood': {
      if (!Number.isInteger(input.mood) || input.mood < 1 || input.mood > 10) throw badRequest('invalid_value');
      const note = cleanNote(input.note, 500);
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        valueInteger: input.mood,
        component: [...new Set(input.tags ?? [])].filter((x) => (MOOD_TAGS as readonly string[]).includes(x)).map((x) => comp('tag', { valueString: x })),
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'sleep': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw badRequest('invalid_date');
      if (input.date > now.toISOString().slice(0, 10)) throw badRequest('date_in_future');
      if (!Number.isInteger(input.quality) || input.quality < 1 || input.quality > 5) throw badRequest('invalid_value');
      if (input.awakenings !== undefined && (!Number.isInteger(input.awakenings) || input.awakenings < 0 || input.awakenings > 30)) throw badRequest('invalid_value');
      const hours = sleepHours(input.bedtime, input.wake);
      const note = cleanNote(input.note);
      return {
        ...base,
        effectiveDateTime: `${input.date}T${input.wake}:00`,
        valueQuantity: { value: hours, unit: 'h', system: 'http://unitsofmeasure.org', code: 'h' },
        component: [
          comp('night', { valueString: input.date }),
          comp('bedtime', { valueString: input.bedtime }),
          comp('wake', { valueString: input.wake }),
          comp('quality', { valueInteger: input.quality }),
          ...(input.awakenings !== undefined ? [comp('awakenings', { valueInteger: input.awakenings })] : []),
        ],
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'pain': {
      if (!Number.isInteger(input.intensity) || input.intensity < 0 || input.intensity > 10) throw badRequest('invalid_value');
      const regions = [...new Set(input.regions)].filter((x) => (PAIN_REGIONS as readonly string[]).includes(x));
      if (!regions.length) throw badRequest('region_required');
      const note = cleanNote(input.note, 500);
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        valueInteger: input.intensity,
        component: [
          ...regions.map((x) => comp('region', { valueString: x })),
          ...[...new Set(input.character ?? [])].filter((x) => (PAIN_CHARACTER as readonly string[]).includes(x)).map((x) => comp('character', { valueString: x })),
        ],
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'breathing': {
      if (!(input.minutes > 0 && input.minutes <= 60)) throw badRequest('invalid_value');
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        valueQuantity: { value: Math.round(input.minutes * 10) / 10, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' },
        component: [comp('pattern', { valueString: input.pattern })],
      };
    }
  }
}

/** Wyjątek bezpieczeństwa (F8.1): bardzo niski nastrój albo słowa kryzysowe w notatce. Nic nie trafia do placówki. */
export function needsCrisisHelp(input: JournalInput): boolean {
  if (input.kind === 'mood' && input.mood <= 2) return true;
  return 'note' in input && !!input.note && crisisMentioned(input.note);
}

export async function addJournalEntry(actor: AuditActor, patientRef: string, input: JournalInput, now: Date = new Date()): Promise<{ entry: JournalEntry; crisis?: boolean }> {
  const saved = await fhirSystem().create<Observation>(withOrgTags(build(patientRef, input, now), [vaultOrgId(patientRef)]));
  audit(actor, { action: 'C', subtype: `journal-${input.kind}`, entityRef: `Observation/${saved.id}`, patientRef });
  bus.publish({ type: 'observation.changed', patientRef, orgIds: [vaultOrgId(patientRef)] });
  return { entry: toJournalEntry(saved)!, crisis: needsCrisisHelp(input) || undefined };
}

export async function listJournal(patientRef: string, kind?: JournalKind, days = 90, now: Date = new Date()): Promise<JournalEntry[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const params: Record<string, string> = { subject: patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '2000', date: `ge${since.slice(0, 10)}` };
  if (kind) params.code = `${JOURNAL_SYSTEM}|${kind}`;
  const obs = await fhirSystem().search<Observation>('Observation', params);
  return obs
    .filter((o) => isJournal(o) && o.status !== 'entered-in-error')
    .map(toJournalEntry)
    .filter((e): e is JournalEntry => !!e)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function retractJournalEntry(actor: AuditActor, patientRef: string, id: string): Promise<void> {
  const o = await fhirSystem().readOptional<Observation>('Observation', id);
  if (!o || o.subject?.reference !== patientRef || !isJournal(o)) throw notFound('entry_not_found');
  await fhirSystem().update<Observation>({ ...o, status: 'entered-in-error' });
  audit(actor, { action: 'U', subtype: 'journal-retract', entityRef: `Observation/${id}`, patientRef });
}

/**
 * Zestawienie do raportu dla lekarza (A4.3) — liczby z wpisów pacjenta, bez oceny: ile wpisów, zakres i średnia
 * samooceny, średni czas snu. Tylko gdy pacjent udostępnił dane.
 */
export function journalSummary(entries: JournalEntry[]): { kind: JournalKind; count: number; min?: number; max?: number; mean?: number; unit: string }[] {
  const out: { kind: JournalKind; count: number; min?: number; max?: number; mean?: number; unit: string }[] = [];
  const stat = (kind: JournalKind, values: number[], unit: string) => {
    if (!values.length) return;
    const mean = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    out.push({ kind, count: values.length, min: Math.min(...values), max: Math.max(...values), mean: values.length >= 2 ? mean : undefined, unit });
  };
  stat('mood', entries.filter((e) => e.kind === 'mood').map((e) => e.mood ?? 0), '/10');
  stat('pain', entries.filter((e) => e.kind === 'pain').map((e) => e.pain?.intensity ?? 0), '/10');
  stat('sleep', entries.filter((e) => e.kind === 'sleep').map((e) => e.sleep?.hours ?? 0), 'h');
  stat('breathing', entries.filter((e) => e.kind === 'breathing').map((e) => e.breathing?.minutes ?? 0), 'min');
  return out;
}
