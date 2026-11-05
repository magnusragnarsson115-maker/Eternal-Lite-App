import type { Appointment, Slot } from '@medplum/fhirtypes';
import type { AuditActor } from '../audit.js';
import { findUserByEmail } from '../auth/users.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { addDays, localDate } from '../lib/time.js';
import { getSetting, setSetting } from '../settings.js';
import { answerInterview, startInterview } from '../services/interview.js';
import { listPatientAppointments } from '../services/scheduling.js';
import { editSegment, ownSession, sectionAction, startSession, uploadAudio } from '../services/scribe.js';
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
  // Scribe (A12.1/12.2/12.5): dzisiejsza wizyta z nagraniem przykładowej rozmowy → szkic pełnej notatki (11 sekcji);
  // dwie sekcje zaakceptowane, jedna poprawka w transkrypcji — żeby w panelu było widać cały przebieg
  if (next) {
    await runInScope({ orgId }, async () => {
      const src = await fhir().read<Appointment>('Appointment', next.id);
      const start = new Date(Math.floor((Date.now() - 35 * 60_000) / 300_000) * 300_000);
      const end = new Date(start.getTime() + 20 * 60_000);
      const srcSlotId = src.slot?.[0]?.reference?.split('/')[1];
      const srcSlot = srcSlotId ? await fhir().read<Slot>('Slot', srcSlotId) : undefined;
      const slot = srcSlot
        ? await fhir().create<Slot>({ resourceType: 'Slot', schedule: srcSlot.schedule, status: 'busy', start: start.toISOString(), end: end.toISOString(), serviceType: srcSlot.serviceType })
        : undefined;
      const visit = await fhir().create<Appointment>({
        resourceType: 'Appointment',
        status: 'arrived',
        serviceType: src.serviceType,
        start: start.toISOString(),
        end: end.toISOString(),
        minutesDuration: 20,
        created: new Date(start.getTime() - 3 * 86_400_000).toISOString(),
        slot: slot ? [{ reference: `Slot/${slot.id}` }] : undefined,
        comment: 'Bóle głowy, pomiary ciśnienia z domu (dane pokazowe).',
        participant: src.participant,
      });
      const s = await startSession(doctor, docActor, {
        patientId,
        appointmentId: visit.id,
        templateId: 'full',
        consent: true,
        consentNote: 'Dane pokazowe',
        participants: [
          { role: 'lekarz', name: doctor.display_name },
          { role: 'pacjent', name: 'Anna Kowalska' },
        ],
      });
      await uploadAudio(ownSession(doctor, s.id), docActor, { data: silentWav(), contentType: 'audio/wav' }, 52);
      for (let i = 0; i < 200 && ownSession(doctor, s.id).status === 'processing'; i++) await new Promise((r) => setTimeout(r, 50));
      if (ownSession(doctor, s.id).status !== 'draft') throw new Error(`Scribe: ${ownSession(doctor, s.id).status}`);
      const draft = JSON.parse(ownSession(doctor, s.id).note ?? '{"sections":[]}') as { sections: { key: string; paragraphs: unknown[] }[] };
      for (const sec of draft.sections.filter((x) => x.paragraphs.length).slice(0, 2)) sectionAction(ownSession(doctor, s.id), docActor, sec.key, 'accept');
      editSegment(ownSession(doctor, s.id), doctor, docActor, 'S7', { text: 'W gabinecie zmierzyłam ciśnienie: 148 na 92, tętno 78.' });
    }).catch((err: Error) => log(`Sesja Scribe pokazowa pominięta: ${err.message}`));
  }

  setSetting('demo-round5', true);
  log('Dane pokazowe rundy 5 utworzone (fikcyjne).');
}

/** Krótki plik WAV z ciszą (8 kHz, 8 bit) — nagranie zastępcze dla sesji pokazowej; treść rozmowy pochodzi z trybu demonstracyjnego. */
function silentWav(seconds = 0.2, rate = 8000): Buffer {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n, 0x80);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n, 40);
  return b;
}
