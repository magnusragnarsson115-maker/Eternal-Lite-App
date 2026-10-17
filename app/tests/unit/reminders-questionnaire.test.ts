import type { Appointment, Questionnaire } from '@medplum/fhirtypes';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db.js';
import { fhir } from '../../server/fhir/index.js';
import { HttpError } from '../../server/lib/util.js';
import { listOutbox } from '../../server/services/notifications.js';
import { readableAnswers, submitResponse } from '../../server/services/questionnaires.js';
import { remindersFor, runReminderSweep } from '../../server/services/reminders.js';
import { bookAppointment, findFreeSlots } from '../../server/services/scheduling.js';
import { upsertService } from '../../server/services/directory.js';
import { createAvailability } from '../../server/services/scheduling.js';
import { grantAll, makePatient, nextWorkday, setupClinic, setupCore, system } from './helpers.js';

describe('Przypomnienia', () => {
  beforeEach(setupCore);

  it('wysyła 24 h przed wizytą raz (idempotentnie), kanały zewnętrzne tylko za zgodą', async () => {
    const c = await setupClinic();
    const day = nextWorkday(3);
    await createAvailability(system, { practitionerId: c.doctor.id, serviceIds: [c.service.id], locationId: c.loc.id, from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '10:00', endTime: '11:00', slotMinutes: 20 });
    const [slot] = await findFreeSlots({ serviceId: c.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    await grantAll(a.actor, a.ref, ['reminders-email']);
    const view = await bookAppointment(a.actor, { slotId: slot.id, serviceId: c.service.id, patientRef: a.ref, bookedBy: 'patient' });
    // rezerwacja „dawno temu" — inaczej przypomnienie zostałoby pominięte jako spóźnione
    const appt = await fhir().read<Appointment>('Appointment', view.id);
    await fhir().update<Appointment>({ ...appt, created: new Date(Date.parse(appt.start ?? '') - 5 * 86_400_000).toISOString() });

    const at = new Date(Date.parse(view.start) - 23 * 3_600_000); // 23 h przed
    expect(await runReminderSweep(at)).toBe(1);
    expect(await runReminderSweep(at)).toBe(0);
    const rec = remindersFor(view.id);
    expect(rec).toHaveLength(1);
    expect(rec[0].channels).toBe('app,email');
    const email = listOutbox().find((o) => o.channel === 'email' && o.related_ref === `/wizyty/${view.id}`);
    expect(email?.body).not.toMatch(/Konsultacja/); // bez nazwy usługi w treści
    const notif = getDb().prepare('SELECT * FROM notification WHERE user_id = ? AND kind = ?').all(a.userId ?? '', 'reminder');
    expect(notif).toHaveLength(1);
  });

  it('pomija przypomnienie 24 h dla wizyty zarezerwowanej po tym punkcie', async () => {
    const c = await setupClinic();
    const day = nextWorkday(3);
    await createAvailability(system, { practitionerId: c.doctor.id, serviceIds: [c.service.id], from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '10:00', endTime: '10:20', slotMinutes: 20 });
    const [slot] = await findFreeSlots({ serviceId: c.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    const view = await bookAppointment(a.actor, { slotId: slot.id, serviceId: c.service.id, patientRef: a.ref, bookedBy: 'patient' });
    const appt = await fhir().read<Appointment>('Appointment', view.id);
    await fhir().update<Appointment>({ ...appt, created: new Date(Date.parse(appt.start ?? '') - 20 * 3_600_000).toISOString() });
    await runReminderSweep(new Date(Date.parse(view.start) - 19 * 3_600_000));
    expect(remindersFor(view.id)[0].status).toBe('skipped-late-booking');
  });
});

describe('Wywiad przed wizytą', () => {
  beforeEach(setupCore);

  it('waliduje wymagane odpowiedzi i warunki enableWhen', async () => {
    const c = await setupClinic();
    const q = await fhir().create<Questionnaire>({
      resourceType: 'Questionnaire',
      status: 'active',
      title: 'Wywiad',
      item: [
        { linkId: 'reason', type: 'text', text: 'Powód', required: true },
        { linkId: 'allergy', type: 'boolean', text: 'Alergie?' },
        { linkId: 'which', type: 'string', text: 'Jakie?', required: true, enableWhen: [{ question: 'allergy', operator: '=', answerBoolean: true }] },
        { linkId: 'dur', type: 'choice', text: 'Od kiedy', answerOption: [{ valueCoding: { code: 'd', display: 'Dni' } }] },
      ],
    });
    const svc = await upsertService(system, { name: 'Z wywiadem', durationMinutes: 20, mode: 'in-person', active: true, locationIds: [], questionnaireId: q.id });
    const day = nextWorkday(3);
    await createAvailability(system, { practitionerId: c.doctor.id, serviceIds: [svc.id], from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '12:00', endTime: '12:20', slotMinutes: 20 });
    const [slot] = await findFreeSlots({ serviceId: svc.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    const appt = await bookAppointment(a.actor, { slotId: slot.id, serviceId: svc.id, patientRef: a.ref, bookedBy: 'patient' });
    expect(appt.questionnaireId).toBe(q.id);
    const code = async (answers: Record<string, string | boolean | null>) => {
      try {
        await submitResponse(a.actor, { patientRef: a.ref, appointmentId: appt.id, answers });
        return 'ok';
      } catch (e) {
        return (e as HttpError).code;
      }
    };
    expect(await code({ allergy: false })).toBe('required_answer_missing');
    expect(await code({ reason: 'Kontrola', allergy: true })).toBe('required_answer_missing');
    expect(await code({ reason: 'Kontrola', dur: 'zzz' })).toBe('invalid_answer');
    const r = await submitResponse(a.actor, { patientRef: a.ref, appointmentId: appt.id, answers: { reason: 'Kontrola', allergy: true, which: 'Penicylina', dur: 'd' } });
    expect(readableAnswers(r)).toEqual([
      { question: 'Powód', answer: 'Kontrola' },
      { question: 'Alergie?', answer: 'Tak' },
      { question: 'Jakie?', answer: 'Penicylina' },
      { question: 'Od kiedy', answer: 'Dni' },
    ]);
    const again = await submitResponse(a.actor, { patientRef: a.ref, appointmentId: appt.id, answers: { reason: 'Zmiana', allergy: false } });
    expect(again.status).toBe('amended');
    expect(again.id).toBe(r.id);
  });
});
