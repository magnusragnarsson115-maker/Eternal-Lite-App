import { localDate, mergeDays, startOfDay, type ActivityDay, type HealthBridge } from './health-types';

/**
 * Apple Health (F2.1): kroki dziennie (suma HealthKit, bez dublowania iPhone + zegarek) i analiza snu z fazami.
 * Moduł natywny ładujemy leniwie — w Expo Go go nie ma, a import rzuciłby błąd przy starcie aplikacji.
 */

type HK = typeof import('@kingstinct/react-native-healthkit');

const READ = ['HKQuantityTypeIdentifierStepCount', 'HKCategoryTypeIdentifierSleepAnalysis'] as const;
// wartości CategoryValueSleepAnalysis: 0 w łóżku, 1 sen (bez fazy), 2 czuwanie, 3 sen płytki (core), 4 głęboki, 5 REM
const ASLEEP = new Set([1, 3, 4, 5]);

async function hk(): Promise<HK | undefined> {
  try {
    return await import('@kingstinct/react-native-healthkit');
  } catch {
    return undefined;
  }
}

export const health: HealthBridge = {
  source: 'healthkit',
  label: 'Apple Health',
  async available() {
    const m = await hk();
    try {
      return !!m && m.isHealthDataAvailable();
    } catch {
      return false;
    }
  },
  async requestAccess() {
    const m = await hk();
    if (!m) return false;
    return m.requestAuthorization({ toRead: READ });
  },
  async readDays(days: number): Promise<ActivityDay[]> {
    const m = await hk();
    if (!m) return [];
    const from = startOfDay(days - 1);
    const now = new Date();
    const steps = new Map<string, number>();
    const stats = await m.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], from, { day: 1 }, { filter: { date: { startDate: from, endDate: now } }, unit: 'count' });
    for (const s of stats) {
      const v = s.sumQuantity?.quantity;
      if (s.startDate && v !== undefined) steps.set(localDate(new Date(s.startDate)), Math.round(v));
    }
    // sen: od wieczora dnia poprzedzającego okres, przypisany do dnia przebudzenia
    const samples = await m.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, ascending: true, filter: { date: { startDate: new Date(from.getTime() - 12 * 3_600_000), endDate: now } } });
    const nights = new Map<string, { asleep: number; unspecified: number; deep: number; light: number; rem: number; awake: number; staged: boolean; start: Date; end: Date }>();
    for (const s of samples) {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      const min = (end.getTime() - start.getTime()) / 60_000;
      const value = Number(s.value);
      const key = localDate(end);
      const n = nights.get(key) ?? { asleep: 0, unspecified: 0, deep: 0, light: 0, rem: 0, awake: 0, staged: false, start, end };
      if (value === 3) n.light += min;
      if (value === 4) n.deep += min;
      if (value === 5) n.rem += min;
      if (value === 2) n.awake += min;
      if (value >= 3) n.staged = true;
      if (value === 1) n.unspecified += min;
      else if (ASLEEP.has(value)) n.asleep += min;
      if (start < n.start) n.start = start;
      if (end > n.end) n.end = end;
      nights.set(key, n);
    }
    const sleep = new Map<string, NonNullable<ActivityDay['sleep']>>();
    for (const [date, n] of nights) {
      if (date < localDate(from)) continue;
      // gdy są fazy (np. z zegarka), pomijamy ogólny „sen” z telefonu, żeby nie liczyć tej samej nocy dwa razy
      const minutes = n.staged ? n.asleep : n.unspecified;
      if (minutes <= 0) continue;
      sleep.set(date, {
        minutes: Math.round(minutes),
        ...(n.staged ? { deep: Math.round(n.deep), light: Math.round(n.light), rem: Math.round(n.rem) } : {}),
        awake: n.awake ? Math.round(n.awake) : undefined,
        start: n.start.toISOString(),
        end: n.end.toISOString(),
      });
    }
    return mergeDays(steps, sleep);
  },
};
