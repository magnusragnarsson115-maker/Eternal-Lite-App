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
 * oddechowe, A21.2 cykl, A21.4 połóg i karmienie, A21.5 menopauza, F11.1/F11.4/F11.5 żywienie, A22.2 czynności dnia
 * codziennego). Zapis tego, co pacjent sam ocenił — bez interpretacji, bez wniosków i bez alarmów dla placówki.
 * Cykl: bez prognoz (dni płodne i termin następnej miesiączki to już wyrób medyczny). Czynności dnia (Katz, Lawton):
 * same odpowiedzi, bez sumy punktów — punktację i ocenę robi lekarz. Żywienie: suma kalorii i makroskładników
 * z wartości z etykiety albo Open Food Facts — zwykłe dodawanie, bez zaleceń.
 * Wpisy leżą w sejfie pacjenta (lekarz widzi je tylko po udostępnieniu). Wyjątek bezpieczeństwa (F8.1): bardzo niski
 * nastrój albo słowa kryzysowe w notatce → aplikacja od razu pokazuje numery pomocy, niczego nie wysyła.
 */

export const JOURNAL_SYSTEM = 'urn:eternal:journal';
export const JOURNAL_TAG = { system: JOURNAL_SYSTEM, code: 'patient-journal', display: 'Dziennik pacjenta (samoocena)' };
export const JOURNAL_KINDS = ['mood', 'sleep', 'pain', 'breathing', 'cycle', 'postpartum', 'menopause', 'food', 'adl'] as const;
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
export const CYCLE_FLOW = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
export const CYCLE_SYMPTOMS = ['cramps', 'headache', 'breast-tenderness', 'bloating', 'acne', 'mood-changes', 'fatigue', 'back-pain'] as const;
export const POSTPARTUM_SYMPTOMS = ['bleeding', 'breast-pain', 'perineal-pain', 'fatigue', 'low-mood', 'anxiety', 'sleep-problems', 'headache'] as const;
export const FEEDING_SIDES = ['left', 'right', 'both', 'bottle'] as const;
export const MENOPAUSE_SYMPTOMS = ['hot-flashes', 'night-sweats', 'sleep-problems', 'mood-changes', 'joint-pain', 'palpitations', 'headache', 'dryness'] as const;
export const MEALS = ['breakfast', 'second-breakfast', 'lunch', 'dinner', 'snack'] as const;
/** Katz (ADL) i Lawton (IADL) — pytania bez punktacji. */
export const ADL_ITEMS = ['bathing', 'dressing', 'toileting', 'transferring', 'continence', 'feeding'] as const;
export const IADL_ITEMS = ['telephone', 'shopping', 'cooking', 'housekeeping', 'laundry', 'transport', 'medications', 'finances'] as const;
export const ADL_LEVELS = ['independent', 'assisted', 'unable'] as const;
export const ADL_FILLED_BY = ['self', 'caregiver', 'together'] as const;

export interface FoodItem {
  name: string;
  grams: number;
  /** wartości na 100 g — z etykiety albo z Open Food Facts */
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  barcode?: string;
  source?: 'manual' | 'openfoodfacts';
}

export interface FoodTotals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Pozycje bez wartości odżywczych — suma ich nie obejmuje. */
  incomplete: number;
}

const CODE: Record<JournalKind, { code: string; display: string; loinc?: { code: string; display: string } }> = {
  mood: { code: 'mood', display: 'Samopoczucie (samoocena 1–10)' },
  sleep: { code: 'sleep', display: 'Sen (dziennik)', loinc: { code: '93832-4', display: 'Sleep duration' } },
  pain: { code: 'pain', display: 'Ból (samoocena 0–10)', loinc: { code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported' } },
  breathing: { code: 'breathing', display: 'Ćwiczenie oddechowe' },
  cycle: { code: 'cycle', display: 'Dziennik cyklu (samoobserwacja)', loinc: { code: '49033-4', display: 'Menstrual history' } },
  postpartum: { code: 'postpartum', display: 'Dziennik połogu i karmienia' },
  menopause: { code: 'menopause', display: 'Dziennik objawów okołomenopauzalnych' },
  food: { code: 'food', display: 'Dziennik żywienia', loinc: { code: '9052-2', display: 'Calorie intake total' } },
  adl: { code: 'adl', display: 'Czynności dnia codziennego (Katz, Lawton) — odpowiedzi bez punktacji' },
};

export type JournalInput =
  | { kind: 'mood'; at?: string; mood: number; tags?: (typeof MOOD_TAGS)[number][]; note?: string }
  | { kind: 'sleep'; date: string; bedtime: string; wake: string; quality: number; awakenings?: number; note?: string }
  | { kind: 'pain'; at?: string; intensity: number; regions: (typeof PAIN_REGIONS)[number][]; character?: (typeof PAIN_CHARACTER)[number][]; note?: string }
  | { kind: 'breathing'; at?: string; minutes: number; pattern: (typeof BREATHING_PATTERNS)[number] }
  | { kind: 'cycle'; date: string; flow: (typeof CYCLE_FLOW)[number]; symptoms?: (typeof CYCLE_SYMPTOMS)[number][]; note?: string }
  | { kind: 'postpartum'; at?: string; symptoms?: (typeof POSTPARTUM_SYMPTOMS)[number][]; feeding?: { side: (typeof FEEDING_SIDES)[number]; minutes?: number }; note?: string }
  | { kind: 'menopause'; at?: string; symptoms: Partial<Record<(typeof MENOPAUSE_SYMPTOMS)[number], number>>; note?: string }
  | { kind: 'food'; at?: string; meal: (typeof MEALS)[number]; items: FoodItem[]; note?: string }
  | {
      kind: 'adl';
      at?: string;
      answers: Partial<Record<(typeof ADL_ITEMS)[number] | (typeof IADL_ITEMS)[number], (typeof ADL_LEVELS)[number]>>;
      filledBy: (typeof ADL_FILLED_BY)[number];
      note?: string;
    };

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  at: string;
  mood?: number;
  tags?: string[];
  sleep?: { date: string; bedtime: string; wake: string; hours: number; quality: number; awakenings?: number };
  pain?: { intensity: number; regions: string[]; character: string[] };
  breathing?: { minutes: number; pattern: string };
  cycle?: { date: string; flow: string; symptoms: string[] };
  postpartum?: { symptoms: string[]; feeding?: { side: string; minutes?: number } };
  menopause?: { symptoms: Record<string, number> };
  food?: { meal: string; items: FoodItem[]; totals: FoodTotals };
  adl?: { answers: Record<string, string>; filledBy: string };
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
    case 'cycle':
      return {
        ...base,
        cycle: { date: compOf(o, 'day')[0]?.valueString ?? base.at.slice(0, 10), flow: compOf(o, 'flow')[0]?.valueString ?? 'none', symptoms: compOf(o, 'symptom').map((c) => c.valueString ?? '') },
      };
    case 'postpartum': {
      const side = compOf(o, 'feeding-side')[0]?.valueString;
      const minutes = compOf(o, 'feeding-minutes')[0]?.valueQuantity?.value;
      return { ...base, postpartum: { symptoms: compOf(o, 'symptom').map((c) => c.valueString ?? ''), feeding: side ? { side, minutes } : undefined } };
    }
    case 'menopause':
      return { ...base, menopause: { symptoms: Object.fromEntries(compOf(o, 'symptom').map((c) => [c.valueCodeableConcept?.text ?? '', c.valueInteger ?? 0]).filter(([k]) => k)) } };
    case 'food': {
      const items = compOf(o, 'item')
        .map((c) => {
          try {
            return JSON.parse(c.valueString ?? '') as FoodItem;
          } catch {
            return undefined;
          }
        })
        .filter((x): x is FoodItem => !!x);
      return { ...base, food: { meal: compOf(o, 'meal')[0]?.valueString ?? '', items, totals: foodTotals(items) } };
    }
    case 'adl':
      return {
        ...base,
        adl: { answers: Object.fromEntries(compOf(o, 'activity').map((c) => [c.valueCodeableConcept?.text ?? '', c.valueString ?? '']).filter(([k]) => k)), filledBy: compOf(o, 'filled-by')[0]?.valueString ?? '' },
      };
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Suma z wartości na 100 g — pozycje bez kalorii liczą się jako „niepełne”, nie jako zero. */
export function foodTotals(items: FoodItem[]): FoodTotals {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, incomplete: 0 };
  for (const i of items) {
    const f = i.grams / 100;
    if (i.kcal100 === undefined) t.incomplete += 1;
    t.kcal += (i.kcal100 ?? 0) * f;
    t.protein += (i.protein100 ?? 0) * f;
    t.fat += (i.fat100 ?? 0) * f;
    t.carbs += (i.carbs100 ?? 0) * f;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), fat: round1(t.fat), carbs: round1(t.carbs), incomplete: t.incomplete };
}

/** Suma dnia z wpisów żywienia (data lokalna z pola „at” w strefie placówki — tu: pierwsze 10 znaków ISO). */
export function foodByDay(entries: JournalEntry[]): { date: string; totals: FoodTotals; meals: number }[] {
  const days = new Map<string, FoodItem[][]>();
  for (const e of entries) if (e.kind === 'food' && e.food) days.set(e.at.slice(0, 10), [...(days.get(e.at.slice(0, 10)) ?? []), e.food.items]);
  return [...days.entries()].map(([date, meals]) => ({ date, totals: foodTotals(meals.flat()), meals: meals.length })).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Historia cyklu z zapisów — bez prognoz: początki miesiączek (pierwszy dzień krwawienia po co najmniej 10 dniach
 * bez krwawienia), dzień obecnego cyklu i długości poprzednich cykli jako zwykłe różnice dat.
 */
export function cycleHistory(entries: JournalEntry[], today: string): { starts: string[]; currentDay?: number; lengths: number[] } {
  const bleeding = [...new Set(entries.filter((e) => e.kind === 'cycle' && e.cycle && ['light', 'medium', 'heavy'].includes(e.cycle.flow)).map((e) => e.cycle!.date))].sort();
  const dayNo = (d: string) => Math.round(Date.parse(`${d}T12:00:00Z`) / 86_400_000);
  const starts: string[] = [];
  let prev: string | undefined;
  for (const d of bleeding) {
    // nowa miesiączka = krwawienie po co najmniej 10 dniach przerwy od poprzedniego dnia z krwawieniem
    if (!prev || dayNo(d) - dayNo(prev) >= 10) starts.push(d);
    prev = d;
  }
  const lengths = starts.slice(1).map((s, i) => dayNo(s) - dayNo(starts[i]));
  const last = starts[starts.length - 1];
  return { starts, currentDay: last && dayNo(today) >= dayNo(last) ? dayNo(today) - dayNo(last) + 1 : undefined, lengths };
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
    case 'cycle': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw badRequest('invalid_date');
      if (input.date > now.toISOString().slice(0, 10)) throw badRequest('date_in_future');
      if (!(CYCLE_FLOW as readonly string[]).includes(input.flow)) throw badRequest('invalid_value');
      const note = cleanNote(input.note, 500);
      return {
        ...base,
        effectiveDateTime: `${input.date}T12:00:00Z`,
        component: [
          comp('day', { valueString: input.date }),
          comp('flow', { valueString: input.flow }),
          ...[...new Set(input.symptoms ?? [])].filter((x) => (CYCLE_SYMPTOMS as readonly string[]).includes(x)).map((x) => comp('symptom', { valueString: x })),
        ],
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'postpartum': {
      const symptoms = [...new Set(input.symptoms ?? [])].filter((x) => (POSTPARTUM_SYMPTOMS as readonly string[]).includes(x));
      const note = cleanNote(input.note, 500);
      if (input.feeding && !(FEEDING_SIDES as readonly string[]).includes(input.feeding.side)) throw badRequest('invalid_value');
      if (input.feeding?.minutes !== undefined && !(input.feeding.minutes > 0 && input.feeding.minutes <= 180)) throw badRequest('invalid_value');
      if (!symptoms.length && !input.feeding && !note) throw badRequest('entry_empty');
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        component: [
          ...symptoms.map((x) => comp('symptom', { valueString: x })),
          ...(input.feeding ? [comp('feeding-side', { valueString: input.feeding.side })] : []),
          ...(input.feeding?.minutes !== undefined ? [comp('feeding-minutes', { valueQuantity: { value: input.feeding.minutes, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } })] : []),
        ],
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'menopause': {
      const entries = Object.entries(input.symptoms ?? {}).filter(([k, v]) => (MENOPAUSE_SYMPTOMS as readonly string[]).includes(k) && v !== undefined);
      for (const [, v] of entries) if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 3) throw badRequest('invalid_value');
      const nonZero = entries.filter(([, v]) => (v as number) > 0);
      const note = cleanNote(input.note, 500);
      if (!nonZero.length && !note) throw badRequest('entry_empty');
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        component: nonZero.map(([k, v]) => comp('symptom', { valueCodeableConcept: { text: k }, valueInteger: v as number })),
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'food': {
      if (!(MEALS as readonly string[]).includes(input.meal)) throw badRequest('invalid_value');
      if (!input.items.length || input.items.length > 30) throw badRequest('invalid_value');
      const items: FoodItem[] = input.items.map((i) => {
        const name = i.name.trim().slice(0, 120);
        if (!name || !(i.grams > 0 && i.grams <= 3000)) throw badRequest('invalid_value');
        for (const v of [i.kcal100, i.protein100, i.fat100, i.carbs100]) if (v !== undefined && !(v >= 0 && v <= 1000)) throw badRequest('invalid_value');
        if (i.barcode !== undefined && !/^\d{8,14}$/.test(i.barcode)) throw badRequest('invalid_value');
        return { name, grams: round1(i.grams), kcal100: i.kcal100, protein100: i.protein100, fat100: i.fat100, carbs100: i.carbs100, barcode: i.barcode, source: i.source === 'openfoodfacts' ? 'openfoodfacts' : 'manual' };
      });
      const totals = foodTotals(items);
      const note = cleanNote(input.note, 500);
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        valueQuantity: { value: totals.kcal, unit: 'kcal', system: 'http://unitsofmeasure.org', code: 'kcal' },
        component: [comp('meal', { valueString: input.meal }), ...items.map((i) => comp('item', { valueString: JSON.stringify(i) }))],
        note: note ? [{ text: note }] : undefined,
      };
    }
    case 'adl': {
      const allowed = [...ADL_ITEMS, ...IADL_ITEMS] as readonly string[];
      const answers = Object.entries(input.answers ?? {}).filter(([k, v]) => allowed.includes(k) && v !== undefined);
      if (!answers.length) throw badRequest('entry_empty');
      for (const [, v] of answers) if (!(ADL_LEVELS as readonly string[]).includes(v as string)) throw badRequest('invalid_value');
      if (!(ADL_FILLED_BY as readonly string[]).includes(input.filledBy)) throw badRequest('invalid_value');
      const note = cleanNote(input.note, 500);
      return {
        ...base,
        effectiveDateTime: checkAt(input.at, now),
        component: [comp('filled-by', { valueString: input.filledBy }), ...answers.map(([k, v]) => comp('activity', { valueCodeableConcept: { text: k }, valueString: v as string }))],
        note: note ? [{ text: note }] : undefined,
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
