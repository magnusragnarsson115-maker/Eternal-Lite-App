import type { AuditActor } from '../audit.js';
import { findUserByEmail } from '../auth/users.js';
import { config } from '../config.js';
import { addDays, localDate } from '../lib/time.js';
import { getSetting, setSetting } from '../settings.js';
import { importActivity } from '../services/activity.js';
import { addJournalEntry } from '../services/journal.js';
import { listSchedules, setScheduleStock } from '../services/medReminders.js';
import { createCustomReminder, setLocation } from '../services/personalReminders.js';

/**
 * Dane pokazowe rundy 4 dla fikcyjnej pacjentki Anny Kowalskiej (tylko DEMO_MODE, jednorazowo): przypomnienie
 * o terapii światłem z miejscem, posiłek, kilka dni cyklu, kroki i sen „z telefonu”, zapas leku, okolica.
 * Uruchamiane przy starcie instancji pokazowej, także na bazie utworzonej przed rundą 4.
 */
export async function seedRound4Demo(log: (m: string) => void = console.log): Promise<void> {
  if (!config.demoMode || getSetting<boolean>('demo-round4')) return;
  const user = findUserByEmail('pacjent@eternal.local');
  if (!user?.fhir_ref) return;
  const ref = user.fhir_ref;
  const actor: AuditActor = { userId: user.id, actorRef: ref, display: 'Anna Kowalska (dane pokazowe)', roles: ['patient'] };
  const tz = config.clinic.timezone;
  const today = localDate(new Date(), tz);
  const at = (daysAgo: number, hour = 9) => new Date(Date.parse(`${addDays(today, -daysAgo)}T${String(hour).padStart(2, '0')}:00:00Z`)).toISOString();

  createCustomReminder(actor, user.id, ref, { kind: 'light-therapy', times: ['07:30'], days: [1, 2, 3, 4, 5], place: 'Gabinet fototerapii, ul. Słoneczna 3, Warszawa (fikcyjny)' });
  createCustomReminder(actor, user.id, ref, { kind: 'exercise', title: 'Spacer', times: ['18:00'] });
  setLocation(actor, user.id, { city: 'Warszawa' });
  const sched = listSchedules(ref)[0];
  if (sched) setScheduleStock(actor, ref, sched.id, { stock: 24, perDose: 1 });

  for (const [d, flow] of [[30, 'medium'], [29, 'heavy'], [28, 'light'], [2, 'medium'], [1, 'heavy']] as const) {
    await addJournalEntry(actor, ref, { kind: 'cycle', date: addDays(today, -d), flow, symptoms: d === 1 ? ['cramps', 'fatigue'] : [] });
  }
  await addJournalEntry(actor, ref, {
    kind: 'food',
    at: at(0, 7),
    meal: 'breakfast',
    items: [
      { name: 'Płatki owsiane', grams: 50, kcal100: 372, protein100: 13.5, fat100: 7, carbs100: 59, source: 'manual' },
      { name: 'Jogurt naturalny', grams: 150, kcal100: 61, protein100: 4.3, fat100: 2, carbs100: 6.2, source: 'manual' },
    ],
  });
  await addJournalEntry(actor, ref, { kind: 'food', at: at(1, 12), meal: 'lunch', items: [{ name: 'Zupa pomidorowa (domowa)', grams: 350 }] });

  const days = Array.from({ length: 10 }, (_, i) => {
    const d = 10 - i;
    return {
      date: addDays(today, -d),
      steps: 5200 + ((d * 1371) % 6100),
      sleep: { minutes: 380 + ((d * 17) % 80), deep: 60 + ((d * 7) % 30), light: 220 + ((d * 11) % 40), rem: 80 + ((d * 5) % 25), awake: 15 + (d % 10) },
    };
  });
  await importActivity(actor, ref, { source: 'healthkit', device: 'Apple Health (dane pokazowe)', days }, today);
  setSetting('demo-round4', true);
  log('Dane pokazowe rundy 4 utworzone (fikcyjne).');
}
