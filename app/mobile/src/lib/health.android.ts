import { localDate, mergeDays, startOfDay, type ActivityDay, type HealthBridge } from './health-types';

/**
 * Health Connect (F2.2): kroki dziennie (agregat Health Connect usuwa duplikaty między aplikacjami) i sesje snu
 * z etapami. Moduł natywny ładujemy leniwie — w Expo Go go nie ma.
 */

type HC = typeof import('react-native-health-connect');

// SleepStageType: 1 czuwanie, 2 sen, 3 poza łóżkiem, 4 płytki, 5 głęboki, 6 REM
const AWAKE = 1;
const OUT_OF_BED = 3;

async function hc(): Promise<HC | undefined> {
  try {
    return await import('react-native-health-connect');
  } catch {
    return undefined;
  }
}

async function ready(m: HC): Promise<boolean> {
  try {
    if ((await m.getSdkStatus()) !== m.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return await m.initialize();
  } catch {
    return false;
  }
}

export const health: HealthBridge = {
  source: 'health-connect',
  label: 'Health Connect',
  async available() {
    const m = await hc();
    return !!m && (await ready(m));
  },
  async requestAccess() {
    const m = await hc();
    if (!m || !(await ready(m))) return false;
    const granted = await m.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'SleepSession' },
    ]);
    return granted.length > 0;
  },
  async readDays(days: number): Promise<ActivityDay[]> {
    const m = await hc();
    if (!m || !(await ready(m))) return [];
    const from = startOfDay(days - 1);
    const range = { operator: 'between' as const, startTime: from.toISOString(), endTime: new Date().toISOString() };
    const steps = new Map<string, number>();
    const groups = await m.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: { period: 'DAYS', length: 1 } });
    for (const g of groups) if (g.result.COUNT_TOTAL !== undefined) steps.set(localDate(new Date(g.startTime)), Math.round(g.result.COUNT_TOTAL));
    const sleep = new Map<string, NonNullable<ActivityDay['sleep']>>();
    const sessions = await m.readRecords('SleepSession', { timeRangeFilter: { ...range, startTime: new Date(from.getTime() - 12 * 3_600_000).toISOString() } });
    for (const r of sessions.records) {
      const end = new Date(r.endTime);
      const date = localDate(end);
      if (date < localDate(from)) continue;
      const total = (end.getTime() - new Date(r.startTime).getTime()) / 60_000;
      const by = (stage: number) => (r.stages ?? []).filter((s) => s.stage === stage).reduce((a, s) => a + (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60_000, 0);
      const staged = (r.stages ?? []).length > 0;
      const minutes = staged ? (r.stages ?? []).filter((s) => s.stage !== AWAKE && s.stage !== OUT_OF_BED).reduce((a, s) => a + (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60_000, 0) : total;
      const prev = sleep.get(date);
      const add = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : Math.round((a ?? 0) + (b ?? 0)));
      sleep.set(date, {
        minutes: Math.round((prev?.minutes ?? 0) + minutes),
        deep: staged ? add(prev?.deep, by(5)) : prev?.deep,
        light: staged ? add(prev?.light, by(4)) : prev?.light,
        rem: staged ? add(prev?.rem, by(6)) : prev?.rem,
        awake: staged ? add(prev?.awake, by(AWAKE)) : prev?.awake,
        start: prev?.start ?? r.startTime,
        end: r.endTime,
      });
    }
    return mergeDays(steps, sleep);
  },
};
