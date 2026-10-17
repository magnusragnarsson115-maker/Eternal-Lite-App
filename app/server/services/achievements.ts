import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { addDays, localDate } from '../lib/time.js';
import { listJournal } from './journal.js';
import { listIntakeLog } from './medReminders.js';
import { listMeasurements } from './observations.js';

/**
 * Odznaki za regularność (F13.4): liczymy wyłącznie DNI, w których pacjent coś zapisał (dziennik, pomiar,
 * potwierdzenie leku, ćwiczenie z planu) — nigdy wartości. Żadna odznaka nie zależy od wyniku pomiaru, nastroju
 * czy masy ciała, więc nie ocenia zdrowia ani nie nagradza „lepszych” liczb.
 */

export interface Badge {
  key: string;
  title: string;
  description: string;
  earned: boolean;
  progress: { value: number; target: number };
}

export interface Achievements {
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
}

/** Najdłuższa i bieżąca seria kolejnych dni (bieżąca liczy się także, gdy dziś jeszcze nic nie zapisano). */
export function streaks(days: string[], today: string): { current: number; longest: number } {
  const set = new Set(days);
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

const DEFS: { key: string; title: string; description: string; target: number; metric: 'days' | 'longest' | 'journalDays' | 'measureDays' | 'medDays' | 'rehabDays' }[] = [
  { key: 'first-entry', title: 'Pierwszy wpis', description: 'Pierwszy dzień z zapisem w aplikacji.', target: 1, metric: 'days' },
  { key: 'week-streak', title: 'Tydzień z rzędu', description: '7 kolejnych dni z jakimkolwiek zapisem.', target: 7, metric: 'longest' },
  { key: 'month-streak', title: 'Miesiąc z rzędu', description: '30 kolejnych dni z jakimkolwiek zapisem.', target: 30, metric: 'longest' },
  { key: 'journal-10', title: 'Dziennik — 10 dni', description: '10 dni z wpisem w dzienniku.', target: 10, metric: 'journalDays' },
  { key: 'measure-14', title: 'Pomiary — 14 dni', description: '14 dni z zapisanym pomiarem (bez względu na wartość).', target: 14, metric: 'measureDays' },
  { key: 'meds-14', title: 'Leki — 14 dni', description: '14 dni z potwierdzeniem przyjęcia albo pominięcia leku.', target: 14, metric: 'medDays' },
  { key: 'rehab-10', title: 'Ćwiczenia — 10 dni', description: '10 dni z odhaczonym ćwiczeniem z planu.', target: 10, metric: 'rehabDays' },
  { key: 'active-100', title: '100 dni z aplikacją', description: '100 dni (niekoniecznie kolejnych) z jakimkolwiek zapisem.', target: 100, metric: 'days' },
];

export async function achievements(actor: AuditActor, patientRef: string, now = new Date()): Promise<Achievements> {
  const tz = config.clinic.timezone;
  const day = (iso: string) => localDate(new Date(iso), tz);
  const journalDays = new Set((await listJournal(patientRef, undefined, 400, now)).map((e) => day(e.at)));
  const measureDays = new Set((await listMeasurements(patientRef)).map((m) => day(m.effective)));
  const medDays = new Set(listIntakeLog(patientRef, 400).filter((l) => l.status === 'taken' || l.status === 'skipped').map((l) => day(l.confirmedAt ?? l.dueAt)));
  const rehabDays = new Set((getDb().prepare('SELECT day FROM rehab_log WHERE patient_ref = ?').all(patientRef) as { day: string }[]).map((r) => r.day));
  const all = [...new Set([...journalDays, ...measureDays, ...medDays, ...rehabDays])];
  const s = streaks(all, localDate(now, tz));
  const metrics = { days: all.length, longest: s.longest, journalDays: journalDays.size, measureDays: measureDays.size, medDays: medDays.size, rehabDays: rehabDays.size };
  audit(actor, { action: 'R', subtype: 'achievements', patientRef });
  return {
    activeDays: all.length,
    currentStreak: s.current,
    longestStreak: s.longest,
    badges: DEFS.map((d) => ({ key: d.key, title: d.title, description: d.description, earned: metrics[d.metric] >= d.target, progress: { value: Math.min(metrics[d.metric], d.target), target: d.target } })),
  };
}
