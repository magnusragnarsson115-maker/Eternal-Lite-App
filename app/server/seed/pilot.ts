import type { AuditActor } from '../audit.js';
import { findUserByEmail } from '../auth/users.js';
import { setModuleFlag } from '../modules.js';
import { createIntakeInvite, getInviteRow, acceptIntakeConsent } from '../services/invites.js';
import { processIntake, reviewIntake, rowById, submitIntake, toIntakeView, uploadIntake, type IntakeContext } from '../services/intake.js';
import { createSchedule } from '../services/medReminders.js';
import { logDocTime } from '../services/metrics.js';
import { addContact, setEmergencyInfo } from '../services/safety.js';
import { approveAndSendCard, approveNote, generateCard, ownSession, saveNote, startManual, startSession } from '../services/scribe.js';
import { runInScope } from '../tenancy.js';
import { simplePdf } from './pdf.js';

/**
 * Dane pilotażu (D1–D12, P2–P14) do prezentacji — wyłącznie fikcyjne.
 * Przechodzą przez te same usługi co interfejs: zaproszenie → zgoda → wgranie → potwierdzenie,
 * notatka z wizyty → karta „Po wizycie”, osoba bliska, przypomnienia o lekach, pomiar czasu dokumentacji.
 */
export async function seedPilot(input: {
  orgId: string;
  patientId: string;
  patientRef: string;
  /** Wizyta jutrzejsza pacjentki — zaproszenie z dokumentami już przesłanymi. */
  nextAppointmentId?: string;
  /** Wizyta innego pacjenta — zaproszenie wysłane, link jeszcze nieotwarty. */
  otherPatientId?: string;
  otherAppointmentId?: string;
  /** Wizyta przeszła — notatka Scribe i karta „Po wizycie”. */
  pastAppointmentId?: string;
  log: (m: string) => void;
}): Promise<void> {
  const { orgId, patientRef } = input;
  const reception = findUserByEmail('recepcja@eternal.local');
  const doctor = findUserByEmail('anna.nowicka@eternal.local');
  if (!reception || !doctor) return;
  const recActor: AuditActor = { userId: reception.id, display: reception.display_name, roles: ['reception'] };
  const docActor: AuditActor = { userId: doctor.id, actorRef: doctor.fhir_ref ?? undefined, display: doctor.display_name, roles: ['practitioner'] };

  // moduł wideo (MVP-1) włączony dla organizacji demonstracyjnej; pozostałe — wartości domyślne rejestru
  setModuleFlag(undefined, 'video', { enabled: true }, orgId);

  // D1: zaproszenie do wizyty jutrzejszej → pacjentka zgadza się i przesyła wyniki (dane fikcyjne)
  if (input.nextAppointmentId) {
    const inv = await runInScope({ orgId }, () => createIntakeInvite(recActor, { patientId: input.patientId, appointmentId: input.nextAppointmentId, send: false }));
    const row = getInviteRow(inv.invite.id)!;
    const patientActor: AuditActor = { actorRef: patientRef, display: 'Pacjent (link z SMS)', roles: ['patient'] };
    await runInScope({ patientRef, patientOrgIds: [orgId] }, async () => {
      await acceptIntakeConsent(patientActor, row);
      const ctx: IntakeContext = { actor: patientActor, patientRef, orgId, inviteId: row.id, appointmentId: input.nextAppointmentId, source: 'invite', confirmer: 'patient' };
      const pdf = simplePdf([
        'Laboratorium Przykladowe (fikcyjne) - DANE FIKCYJNE',
        'Data pobrania: ' + new Date(Date.now() - 6 * 86_400_000).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' }),
        'Glukoza 96 mg/dl 70 - 99',
        'Cholesterol calkowity 205 H mg/dl < 190',
        'TSH 1,84 uIU/ml 0,27 - 4,2',
        'Kreatynina 0,81 mg/dl 0,5 - 0,9',
      ]);
      const up = await uploadIntake(ctx, { data: pdf, filename: 'wyniki-dane-fikcyjne.pdf', contentType: 'application/pdf' }, undefined, { background: false });
      await processIntake(up.id);
      const view = toIntakeView(rowById(up.id)!, true);
      const items = view.extract?.items ?? [];
      if (view.status === 'needs_review' && items.length) {
        reviewIntake(ctx, up.id, { items: items.map((i) => ({ id: i.id, action: 'confirm' as const })) });
        await submitIntake(ctx, up.id);
      }
    });
  }

  // D1/D2: zaproszenie wysłane do innego pacjenta — w skrzynce „zaproszenie wysłane”
  if (input.otherPatientId && input.otherAppointmentId) {
    await runInScope({ orgId }, () => createIntakeInvite(recActor, { patientId: input.otherPatientId!, appointmentId: input.otherAppointmentId, send: false }));
  }

  // D5: notatka z wizyty przeszłej (bez nagrania — tryb ograniczony) → zatwierdzenie → karta „Po wizycie” w aplikacji
  if (input.pastAppointmentId) {
    await runInScope({ orgId }, async () => {
      const s = await startSession(doctor, docActor, { patientId: input.patientId, appointmentId: input.pastAppointmentId, templateId: 'general', consent: true, consentNote: 'Dane demonstracyjne' });
      startManual(ownSession(doctor, s.id), docActor);
      saveNote(ownSession(doctor, s.id), docActor, [
        { key: 'wywiad', paragraphs: [{ text: 'Pacjentka zgłasza się na kontrolę po infekcji górnych dróg oddechowych. Objawy ustąpiły tydzień temu.' }] },
        { key: 'zalecenia', paragraphs: [{ text: 'Nawadnianie i odpoczynek.' }] },
        { key: 'kontrola', paragraphs: [{ text: 'Kontrola za 2–3 tygodnie z wynikiem morfologii.' }] },
      ]);
      await approveNote(ownSession(doctor, s.id), doctor, docActor);
      await generateCard(ownSession(doctor, s.id), docActor);
      await approveAndSendCard(ownSession(doctor, s.id), doctor, docActor, {});
    }).catch((err: Error) => input.log(`Notatka demonstracyjna pominięta: ${err.message}`));
  }

  // P14: osoba bliska i informacje ratunkowe; F6.x: przypomnienie o leku
  const annaActor: AuditActor = { actorRef: patientRef, display: 'Anna Kowalska', roles: ['patient'] };
  addContact(annaActor, patientRef, { name: 'Tomasz Kowalski (fikcyjny)', phone: '+48500000009', relation: 'mąż' });
  setEmergencyInfo(annaActor, patientRef, { notes: 'Uczulenie na penicylinę (dane fikcyjne).', includeMedications: true });
  await createSchedule(annaActor, patientRef, { label: 'Witamina D3 2000 j.m.', times: ['08:00'] }, 'patient');

  // D12: tydzień pomiaru bez Eternal (wpisy ręczne lekarza) — do porównania na pulpicie mierników
  for (const minutes of [9, 11, 8, 12, 10]) logDocTime(orgId, docActor, doctor.id, { minutes, phase: 'baseline' });
  for (const minutes of [5, 6, 4]) logDocTime(orgId, docActor, doctor.id, { minutes, phase: 'eternal' });

  input.log('Dane pilotażu: zaproszenia, materiały od pacjentki, notatka z kartą „Po wizycie”, osoba bliska, przypomnienie o leku.');
}
