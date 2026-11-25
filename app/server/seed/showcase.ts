import type { AuditActor } from '../audit.js';
import { findUserByEmail, issueToken } from '../auth/users.js';
import { config } from '../config.js';
import { addDays, localDate } from '../lib/time.js';
import { addDiagnosis } from '../services/diagnoses.js';
import { addFamilyHistory, addVaccination, setDirective } from '../services/healthHistory.js';
import { reportIncident, updateIncident } from '../services/incidents.js';
import { addJournalEntry } from '../services/journal.js';
import { createRehabPlan, logRehab } from '../services/rehab.js';
import { submitSurvey } from '../services/surveys.js';
import { getSetting, setSetting } from '../settings.js';
import { runInScope } from '../tenancy.js';

/**
 * Dane pokazowe dla modułów, które bez nich pokazywałyby pusty ekran (tylko DEMO_MODE, jednorazowo):
 * rozpoznanie z kodem ICD-10, plan rehabilitacji z odhaczonymi dniami, wpisy w dziennikach, szczepienia,
 * wywiad rodzinny i dyspozycje, ankieta na start, oczekujące zaproszenie personelu i dwa zgłoszenia incydentów.
 * Wszystkie osoby i dane są fikcyjne; treści nie zawierają ocen zdrowia.
 */
export async function seedShowcaseDemo(log: (m: string) => void = console.log): Promise<void> {
  if (!config.demoMode || getSetting<boolean>('demo-showcase')) return;
  const doctor = findUserByEmail('anna.nowicka@eternal.local');
  const admin = findUserByEmail('admin@eternal.local');
  const patient = findUserByEmail('pacjent@eternal.local');
  if (!doctor?.org_id || !patient?.fhir_ref) return;
  const orgId = doctor.org_id;
  const tz = config.clinic.timezone;
  const patientRef = patient.fhir_ref;
  const patientId = patientRef.split('/')[1];
  const now = Date.now();
  const today = localDate(new Date(now), tz);
  const dayAgo = (n: number) => localDate(new Date(now - n * 86_400_000), tz);
  const atAgo = (days: number, hour: number) => {
    const d = new Date(now - days * 86_400_000);
    d.setUTCHours(hour, 0, 0, 0);
    return new Date(Math.min(d.getTime(), now - 60_000)).toISOString();
  };
  const docActor: AuditActor = { userId: doctor.id, actorRef: doctor.fhir_ref ?? undefined, display: doctor.display_name, roles: doctor.roles };
  const ptActor: AuditActor = { userId: patient.id, actorRef: patientRef, display: 'Anna Kowalska (dane pokazowe)', roles: ['patient'] };

  // panel lekarza: rozpoznanie (A12.6) i plan rehabilitacji (A22.4)
  const planId = await runInScope({ orgId }, async () => {
    await addDiagnosis(docActor, doctor, patientId, {
      code: 'I10',
      display: 'Nadciśnienie tętnicze samoistne (pierwotne)',
      onset: '2025-09-01',
      note: 'Rozpoznanie pokazowe — dane fikcyjne.',
    });
    const plan = await createRehabPlan(docActor, doctor, patientId, {
      title: 'Aktywność fizyczna — plan pokazowy',
      start: dayAgo(10),
      end: addDays(today, 50),
      note: 'Plan pokazowy (dane fikcyjne). W razie bólu w klatce piersiowej przerwij ćwiczenia i dzwoń 112.',
      activities: [
        { name: 'Marsz w szybkim tempie', dose: '30 min', instructions: 'Tempo, przy którym możesz mówić pełnymi zdaniami.', days: [1, 3, 5] },
        { name: 'Ćwiczenia rozciągające', dose: '10 min', instructions: 'Spokojne rozciąganie nóg i pleców.', days: [2, 4, 6], place: 'Park Miejski (fikcyjny)' },
      ],
    });
    return plan.id ?? '';
  });
  await runInScope({ patientRef }, async () => {
    if (planId) {
      for (const [activity, back] of [
        [0, 2],
        [1, 1],
        [0, 4],
      ] as const) {
        await logRehab(ptActor, patientRef, planId, { activity, day: dayAgo(back), done: true }, tz).catch(() => undefined);
      }
    }
    // dzienniki (F8.2): nastrój, sen, ból, oddech — bez interpretacji
    await addJournalEntry(ptActor, patientRef, { kind: 'mood', at: atAgo(3, 18), mood: 6, tags: ['work', 'sleep'] });
    await addJournalEntry(ptActor, patientRef, { kind: 'mood', at: atAgo(1, 19), mood: 7, tags: ['movement', 'family'], note: 'Spacer po pracy (wpis pokazowy).' });
    await addJournalEntry(ptActor, patientRef, { kind: 'sleep', date: dayAgo(2), bedtime: '23:20', wake: '06:40', quality: 3, awakenings: 1 });
    await addJournalEntry(ptActor, patientRef, { kind: 'sleep', date: dayAgo(1), bedtime: '22:50', wake: '06:30', quality: 4 });
    await addJournalEntry(ptActor, patientRef, { kind: 'pain', at: atAgo(2, 9), intensity: 3, regions: ['neck'], character: ['dull'], note: 'Po długiej pracy przy komputerze (wpis pokazowy).' });
    await addJournalEntry(ptActor, patientRef, { kind: 'breathing', at: atAgo(1, 21), minutes: 5, pattern: '4-7-8' });
    // historia zdrowia (A20.7, A20.9, A21.7)
    await addVaccination(ptActor, patientRef, { status: 'done', code: 'td', date: '2021-05-12', place: 'Przychodnia (dane pokazowe)' });
    await addVaccination(ptActor, patientRef, { status: 'done', code: 'covid-19', date: '2023-10-20', dose: 4 });
    await addVaccination(ptActor, patientRef, { status: 'planned', code: 'influenza', date: addDays(today, 14), note: 'Termin pokazowy.' });
    await addFamilyHistory(ptActor, patientRef, { relationship: 'FTH', conditions: [{ code: 'hypertension', onsetAge: 50 }] });
    await addFamilyHistory(ptActor, patientRef, { relationship: 'MTH', conditions: [{ code: 'thyroid', onsetAge: 45 }] });
    await setDirective(ptActor, patientRef, { kind: 'info-person', person: { name: 'Tomasz Kowalski (fikcyjny)', phone: '+48 600 100 200' }, showOnCard: true });
    await setDirective(ptActor, patientRef, { kind: 'organ-donation', value: 'donor', showOnCard: false });
    // ankieta na start (A12.3) — odpowiedzi pokazowe
    await submitSurvey(ptActor, patient, patientRef, 'health-intake', {
      'self-rated': '4',
      chronic: ['hypertension'],
      meds: 'Ramipril 5 mg rano (dane pokazowe).',
      allergies: false,
      smoking: 'never',
      activity: '1-2',
      family: ['heart-early'],
      goals: 'Mieć wyniki i zalecenia w jednym miejscu.',
    }).catch((err: Error) => log(`Ankieta pokazowa pominięta: ${err.message}`));
  });

  // administracja (D0): oczekujące zaproszenie personelu i dwa zgłoszenia incydentów
  if (admin) {
    issueToken('staff-invite', {
      userId: admin.id,
      payload: { email: 'beata.wrona@eternal.local', displayName: 'Beata Wrona (fikcyjna)', roles: ['reception'], orgId },
      ttlMinutes: 7 * 24 * 60,
    });
    const adminActor: AuditActor = { userId: admin.id, display: admin.display_name, roles: admin.roles };
    await reportIncident(adminActor, {
      orgId,
      reporterKind: 'staff',
      category: 'availability',
      severity: 'low',
      description: 'Przerwa w wysyłce SMS przez ok. 20 minut — powiadomienia dostarczone po wznowieniu (zgłoszenie pokazowe).',
    });
    const fixed = await reportIncident(adminActor, {
      orgId,
      reporterKind: 'staff',
      category: 'data-error',
      severity: 'medium',
      description: 'Wynik z laboratorium dopięty do niewłaściwej wizyty — poprawiony przed udostępnieniem pacjentce (zgłoszenie pokazowe).',
    });
    updateIncident(adminActor, orgId, fixed.id, { status: 'triage' });
    updateIncident(adminActor, orgId, fixed.id, { status: 'resolved', resolution: 'Dokument przypięty do właściwej wizyty, pacjentka nie miała do niego dostępu (dane pokazowe).' });
  }

  setSetting('demo-showcase', true);
  log('Dane pokazowe modułów utworzone (rozpoznanie, plan ćwiczeń, dzienniki, historia zdrowia, ankieta, zaproszenie, incydenty — fikcyjne).');
}
