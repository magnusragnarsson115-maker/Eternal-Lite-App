import type { Slot } from '@medplum/fhirtypes';
import { beforeEach, describe, expect, it } from 'vitest';
import { fhir } from '../../server/fhir/index.js';
import { HttpError } from '../../server/lib/util.js';
import { zonedToUtc } from '../../server/lib/time.js';
import { bookAppointment, cancelAppointment, createAvailability, findFreeSlots, rescheduleAppointment, setAppointmentStatus } from '../../server/services/scheduling.js';
import { makePatient, nextWorkday, setupClinic, setupCore, system } from './helpers.js';

async function prepare() {
  await setupCore();
  const clinic = await setupClinic();
  const day = nextWorkday(3);
  const r = await createAvailability(system, {
    practitionerId: clinic.doctor.id,
    serviceIds: [clinic.service.id],
    locationId: clinic.loc.id,
    from: day,
    to: day,
    weekdays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '10:00',
    slotMinutes: 20,
    breakStart: '09:00',
    breakEnd: '09:20',
  });
  return { ...clinic, day, created: r.created };
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof HttpError ? err.code : (err as Error).message;
  }
};

describe('Grafik i rezerwacje', () => {
  let ctx: Awaited<ReturnType<typeof prepare>>;
  beforeEach(async () => {
    ctx = await prepare();
  });

  it('generuje sloty z przerwą w czasie lokalnym', async () => {
    expect(ctx.created).toBe(5); // 8:00–9:00 (3) + 9:20–10:00 (2)
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    expect(slots[0].start).toBe(zonedToUtc(ctx.day, '08:00', 'Europe/Warsaw').toISOString());
    expect(slots.some((s) => s.start === zonedToUtc(ctx.day, '09:00', 'Europe/Warsaw').toISOString())).toBe(false);
  });

  it('pomija święta i nie dubluje istniejących slotów', async () => {
    const r = await createAvailability(system, { practitionerId: ctx.doctor.id, serviceIds: [ctx.service.id], from: '2026-12-21', to: '2026-12-27', weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '08:00', endTime: '09:00', slotMinutes: 30 });
    expect(r.skippedHolidays.map((h) => h.date)).toEqual(['2026-12-24', '2026-12-25', '2026-12-26']);
    const again = await createAvailability(system, { practitionerId: ctx.doctor.id, serviceIds: [ctx.service.id], from: '2026-12-21', to: '2026-12-21', weekdays: [1], startTime: '08:00', endTime: '09:00', slotMinutes: 30 });
    expect(again.created).toBe(0);
    expect(again.skippedOverlap).toBe(2);
  });

  it('rezerwacja zajmuje slot; równoczesne rezerwacje — wygrywa dokładnie jedna', async () => {
    const [slot] = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient('Anna', 'Pierwsza');
    const b = await makePatient('Basia', 'Druga');
    const results = await Promise.all([
      codeOf(bookAppointment(a.actor, { slotId: slot.id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' })),
      codeOf(bookAppointment(b.actor, { slotId: slot.id, serviceId: ctx.service.id, patientRef: b.ref, bookedBy: 'patient' })),
    ]);
    expect(results.sort()).toEqual(['ok', 'slot_taken']);
    const s = await fhir().read<Slot>('Slot', slot.id);
    expect(s.status).toBe('busy');
  });

  it('limity pacjenta: jedna aktywna wizyta danej usługi', async () => {
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    await bookAppointment(a.actor, { slotId: slots[0].id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' });
    expect(await codeOf(bookAppointment(a.actor, { slotId: slots[1].id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' }))).toBe('already_booked_for_service');
  });

  it('odwołanie przez pacjenta zwalnia termin; po terminie odwołania online — odmowa', async () => {
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    const appt = await bookAppointment(a.actor, { slotId: slots[0].id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' });
    const other = await makePatient('Obcy', 'Pacjent');
    expect(await codeOf(cancelAppointment(other.actor, { appointmentId: appt.id, by: 'patient', patientRef: other.ref }))).toBe('not_your_appointment');
    const cancelled = await cancelAppointment(a.actor, { appointmentId: appt.id, by: 'patient', patientRef: a.ref, reason: 'Wyjazd' });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledBy).toBe('patient');
    expect((await fhir().read<Slot>('Slot', slots[0].id)).status).toBe('free');

    // wizyta za 2 godziny — poza oknem odwołania online (12 h)
    const soonStart = new Date(Date.now() + 2 * 3_600_000);
    const schedule = (await fhir().read<Slot>('Slot', slots[0].id)).schedule;
    const soon = await fhir().create<Slot>({ resourceType: 'Slot', schedule, status: 'free', start: soonStart.toISOString(), end: new Date(soonStart.getTime() + 20 * 60_000).toISOString(), serviceType: (await fhir().read<Slot>('Slot', slots[0].id)).serviceType });
    const late = await bookAppointment(a.actor, { slotId: soon.id ?? '', serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' });
    expect(late.canCancelOnline).toBe(false);
    expect(await codeOf(cancelAppointment(a.actor, { appointmentId: late.id, by: 'patient', patientRef: a.ref }))).toBe('cancel_window_passed');
    expect((await cancelAppointment(system, { appointmentId: late.id, by: 'staff', reason: 'Choroba lekarza' })).cancelledBy).toBe('staff');
  });

  it('zmiana terminu rezerwuje nowy slot przed zwolnieniem starego', async () => {
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    const appt = await bookAppointment(a.actor, { slotId: slots[0].id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'patient' });
    const moved = await rescheduleAppointment(a.actor, { appointmentId: appt.id, newSlotId: slots[2].id, by: 'patient', patientRef: a.ref });
    expect(moved.slotId).toBe(slots[2].id);
    expect((await fhir().read<Slot>('Slot', slots[0].id)).status).toBe('free');
    expect((await fhir().read<Slot>('Slot', slots[2].id)).status).toBe('busy');
  });

  it('przejścia statusów wizyty', async () => {
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: new Date().toISOString(), to: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    const a = await makePatient();
    const appt = await bookAppointment(system, { slotId: slots[0].id, serviceId: ctx.service.id, patientRef: a.ref, bookedBy: 'staff' });
    expect(await codeOf(setAppointmentStatus(system, appt.id, 'noshow'))).toBe('noshow_before_start');
    expect((await setAppointmentStatus(system, appt.id, 'arrived')).status).toBe('arrived');
    expect((await setAppointmentStatus(system, appt.id, 'fulfilled')).status).toBe('fulfilled');
  });
});
