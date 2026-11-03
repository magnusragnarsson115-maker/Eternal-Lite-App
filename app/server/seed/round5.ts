import type { AuditActor } from '../audit.js';
import { findUserByEmail } from '../auth/users.js';
import { config } from '../config.js';
import { addDays, localDate } from '../lib/time.js';
import { getSetting, setSetting } from '../settings.js';
import { answerInterview, startInterview } from '../services/interview.js';
import { listPatientAppointments } from '../services/scheduling.js';
import { setDisplayFilter } from '../services/snapshot.js';
import { createCase, updateCase } from '../services/workspace.js';
import { runInScope } from '../tenancy.js';

/**
 * Dane pokazowe rundy 5 (tylko DEMO_MODE, jednorazowo): filtr wyświetlania lekarki, dwie sprawy w kolejce
 * (kontrola po zmianie leku, braki danych oznaczone przez rejestrację jako pilne) i zakończony wywiad
 * kardiologiczny pacjentki przed najbliższą wizytą. Wszystkie osoby i dane są fikcyjne.
 */
export async function seedRound5Demo(log: (m: string) => void = console.log): Promise<void> {
  if (!config.demoMode || getSetting<boolean>('demo-round5')) return;
  const doctor = findUserByEmail('anna.nowicka@eternal.local');
  const reception = findUserByEmail('recepcja@eternal.local');
  const patient = findUserByEmail('pacjent@eternal.local');
  if (!doctor?.org_id || !patient?.fhir_ref) return;
  const orgId = doctor.org_id;
  const patientId = patient.fhir_ref.split('/')[1];
  const docActor: AuditActor = { userId: doctor.id, actorRef: doctor.fhir_ref ?? undefined, display: doctor.display_name, roles: doctor.roles };
  setDisplayFilter(docActor, doctor.id, { bpSystolic: 140, bpDiastolic: 90 });
  const today = localDate(new Date(), config.clinic.timezone);
  await runInScope({ orgId }, async () => {
    const c1 = await createCase(doctor, docActor, { patientId, title: 'Kontrola ciśnienia po zmianie leku', status: 'follow-up', dueDate: addDays(today, 7), note: 'Dzienniczek pomiarów z 2 tygodni (dane pokazowe).' });
    void c1;
    const c2 = await createCase(doctor, docActor, { patientId, title: 'Brak lipidogramu przed wizytą', status: 'incomplete', ownerUserId: reception?.id ?? null });
    if (reception) updateCase(reception, { userId: reception.id, display: reception.display_name }, c2.id, { priority: 'urgent', comment: 'Pacjentka prosiła o telefon przed wizytą (dane pokazowe).' });
  });
  const next = (await runInScope({ orgId }, () => listPatientAppointments(patient.fhir_ref!))).find((a) => a.status === 'booked' && Date.parse(a.start) > Date.now());
  const ptActor: AuditActor = { userId: patient.id, actorRef: patient.fhir_ref, display: 'Anna Kowalska (dane pokazowe)', roles: ['patient'] };
  await runInScope({ patientRef: patient.fhir_ref }, async () => {
    let s = await startInterview(ptActor, patient.fhir_ref!, { treeId: 'cardiology', appointmentId: next?.id });
    for (const v of ['control', 'no', 'yes', 'no', 'no', 'no', '145/92 rano', 'yes', 'Od września ramipril 5 mg rano.', 'no', ['hypertension'], 'no', 'monthly', 'yes', 'Czy mogę wrócić do biegania?']) {
      if (!s.current) break;
      s = await answerInterview(ptActor, patient.fhir_ref!, s.id, { nodeId: s.current.id, value: v as string | string[] });
    }
  });
  setSetting('demo-round5', true);
  log('Dane pokazowe rundy 5 utworzone (fikcyjne).');
}
