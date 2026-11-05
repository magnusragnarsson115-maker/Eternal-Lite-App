/** Dzienne podsumowanie wysyłane na serwer (POST /api/me/activity/import) — liczby z urządzenia, bez ocen. */
export interface ActivityDay {
  date: string;
  steps?: number;
  sleep?: { minutes: number; deep?: number; light?: number; rem?: number; awake?: number; start?: string; end?: string };
}

export interface HealthBridge {
  /** 'healthkit' (iOS), 'health-connect' (Android) albo undefined, gdy platforma nie ma magazynu zdrowia. */
  source?: 'healthkit' | 'health-connect';
  label: string;
  /** false także w Expo Go i w buildzie bez modułu natywnego. */
  available(): Promise<boolean>;
  requestAccess(): Promise<boolean>;
  readDays(days: number): Promise<ActivityDay[]>;
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Łączenie kroków i snu w jeden wpis na dzień (noc liczymy do dnia przebudzenia). */
export function mergeDays(steps: Map<string, number>, sleep: Map<string, NonNullable<ActivityDay['sleep']>>): ActivityDay[] {
  const dates = [...new Set([...steps.keys(), ...sleep.keys()])].sort();
  return dates.map((date) => ({ date, steps: steps.get(date), sleep: sleep.get(date) }));
}
