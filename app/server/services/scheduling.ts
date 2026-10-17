import type { Appointment, Patient, Slot } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { findUserByFhirRef } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { APPOINTMENT_CANCEL_REASON, ETERNAL } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { FhirConflictError, idFromRef } from '../fhir/repository.js';
import { addDays, formatLocal, holidayName, isoWeekday, localDate, zonedToUtc } from '../lib/time.js';
import { badRequest, conflict, forbidden, HttpError, newId, nowIso } from '../lib/util.js';
import { listUsers } from '../auth/users.js';
import {
  ensureSchedule,
  getClinicSettings,
  getPractitioner,
  getService,
  listLocations,
  listPractitioners,
  SERVICE_SYSTEM,
} from './directory.js';
import { notifyPatient, notifyUser } from './notifications.js';
import { toPatientView } from './patients.js';

export const MAX_ACTIVE_BOOKINGS = 5;
const ACTIVE_STATUSES = ['booked', 'arrived', 'checked-in', 'pending'];

export interface AppointmentView {
  id: string;
  status: Appointment['status'];
  start: string;
  end: string;
  minutesDuration: number;
  serviceId?: string;
  serviceName?: string;
  mode: 'in-person' | 'tele';
  practitionerId?: string;
  practitionerName?: string;
  locationId?: string;
  locationName?: string;
  patientId?: string;
  patientName?: string;
  comment?: string;
  preparation?: string;
  cancelReason?: string;
  cancelledBy?: 'patient' | 'staff';
  created?: string;
  slotId?: string;
  questionnaireId?: string;
  canCancelOnline: boolean;
  cancelDeadline: string;
  teleRoom?: boolean;
}

export interface SlotView {
  id: string;
  start: string;
  end: string;
  status: Slot['status'];
  practitionerId: string;
  practitionerName: string;
  serviceIds: string[];
  comment?: string;
}

function participant(appt: Appointment, type: string) {
  return appt.participant.find((p) => p.actor?.reference?.startsWith(`${type}/`))?.actor;
}

export function teleRoomOf(appt: Appointment): string | undefined {
  return appt.extension?.find((e) => e.url === ETERNAL.ext.teleRoom)?.valueString;
}

export function toAppointmentView(appt: Appointment): AppointmentView {
  const svc = appt.serviceType?.flatMap((s) => s.coding ?? []).find((c) => c.system === SERVICE_SYSTEM);
  const settings = getClinicSettings();
  const deadline = new Date(Date.parse(appt.start ?? '') - settings.cancelMinHours * 3_600_000);
  const cancelCode = appt.cancelationReason?.coding?.[0]?.code;
  return {
    id: appt.id ?? '',
    status: appt.status,
    start: appt.start ?? '',
    end: appt.end ?? '',
    minutesDuration: appt.minutesDuration ?? Math.round((Date.parse(appt.end ?? '') - Date.parse(appt.start ?? '')) / 60_000),
    serviceId: svc?.code,
    serviceName: svc?.display,
    mode: teleRoomOf(appt) ? 'tele' : 'in-person',
    practitionerId: idFromRef(participant(appt, 'Practitioner')?.reference),
    practitionerName: participant(appt, 'Practitioner')?.display,
    locationId: idFromRef(participant(appt, 'Location')?.reference) || undefined,
    locationName: participant(appt, 'Location')?.display,
    patientId: idFromRef(participant(appt, 'Patient')?.reference),
    patientName: participant(appt, 'Patient')?.display,
    comment: appt.comment,
    preparation: appt.patientInstruction,
    cancelReason: appt.cancelationReason?.text,
    cancelledBy: cancelCode ? (cancelCode.startsWith('pat') ? 'patient' : 'staff') : undefined,
    created: appt.created,
    slotId: idFromRef(appt.slot?.[0]?.reference) || undefined,
    questionnaireId: appt.extension?.find((e) => e.url === ETERNAL.ext.questionnaire)?.valueReference?.reference?.split('/')[1],
    canCancelOnline: appt.status === 'booked' && Date.now() <= deadline.getTime(),
    cancelDeadline: deadline.toISOString(),
    teleRoom: !!teleRoomOf(appt),
  };
}

function toSlotView(slot: Slot, practitionerNames: Map<string, { id: string; name: string }>): SlotView {
  const p = practitionerNames.get(slot.schedule.reference ?? '');
  return {
    id: slot.id ?? '',
    start: slot.start,
    end: slot.end,
    status: slot.status,
    practitionerId: p?.id ?? '',
    practitionerName: p?.name ?? '',
    serviceIds: (slot.serviceType ?? []).flatMap((s) => s.coding ?? []).filter((c) => c.system === SERVICE_SYSTEM).map((c) => c.code ?? ''),
    comment: slot.comment,
  };
}

async function scheduleIndex(): Promise<Map<string, { id: string; name: string }>> {
  const schedules = await fhir().search<import('@medplum/fhirtypes').Schedule>('Schedule', {});
  const map = new Map<string, { id: string; name: string }>();
  for (const s of schedules) {
    const actor = s.actor.find((a) => a.reference?.startsWith('Practitioner/'));
    if (actor?.reference) map.set(`Schedule/${s.id}`, { id: idFromRef(actor.reference), name: actor.display ?? '' });
  }
  return map;
}

// --- dostępność (sloty) ---------------------------------------------------------------------------

export interface AvailabilityInput {
  practitionerId: string;
  serviceIds: string[];
  locationId?: string;
  from: string; // YYYY-MM-DD (czas lokalny placówki)
  to: string;
  weekdays: number[]; // 1..7
  startTime: string; // HH:MM
  endTime: string;
  slotMinutes: number;
  breakStart?: string;
  breakEnd?: string;
  skipHolidays?: boolean;
}

export async function createAvailability(
  actor: AuditActor,
  input: AvailabilityInput,
): Promise<{ created: number; skippedOverlap: number; skippedHolidays: { date: string; name: string }[] }> {
  const tz = config.clinic.timezone;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.to < input.from) throw badRequest('invalid_range');
  if (addDays(input.from, 120) < input.to) throw badRequest('range_too_long');
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime) || input.endTime <= input.startTime) throw badRequest('invalid_hours');
  if (!(input.slotMinutes >= 5 && input.slotMinutes <= 240)) throw badRequest('invalid_slot_length');
  if (input.weekdays.length === 0) throw badRequest('no_weekdays');
  if (input.serviceIds.length === 0) throw badRequest('no_services');
  const practitioner = await getPractitioner(input.practitionerId);
  const services = await Promise.all(input.serviceIds.map((id) => getService(id)));
  const schedule = await ensureSchedule(practitioner.id, input.locationId);

  const rangeStart = zonedToUtc(input.from, '00:00', tz);
  const rangeEnd = zonedToUtc(addDays(input.to, 1), '00:00', tz);
  const existing = (
    await fhir().search<Slot>('Slot', {
      schedule: `Schedule/${schedule.id}`,
      start: [`ge${rangeStart.toISOString()}`, `lt${rangeEnd.toISOString()}`],
    })
  ).map((s) => [Date.parse(s.start), Date.parse(s.end)] as const);

  const overlaps = (a: number, b: number) => existing.some(([s, e]) => a < e && b > s);
  const skippedHolidays: { date: string; name: string }[] = [];
  let skippedOverlap = 0;
  const toCreate: Slot[] = [];

  for (let day = input.from; day <= input.to; day = addDays(day, 1)) {
    if (!input.weekdays.includes(isoWeekday(day))) continue;
    const holiday = holidayName(day);
    if (holiday && input.skipHolidays !== false) {
      skippedHolidays.push({ date: day, name: holiday });
      continue;
    }
    let cursor = zonedToUtc(day, input.startTime, tz).getTime();
    const end = zonedToUtc(day, input.endTime, tz).getTime();
    const bStart = input.breakStart ? zonedToUtc(day, input.breakStart, tz).getTime() : undefined;
    const bEnd = input.breakEnd ? zonedToUtc(day, input.breakEnd, tz).getTime() : undefined;
    while (cursor + input.slotMinutes * 60_000 <= end) {
      const sEnd = cursor + input.slotMinutes * 60_000;
      if (bStart !== undefined && bEnd !== undefined && cursor < bEnd && sEnd > bStart) {
        cursor = bEnd;
        continue;
      }
      if (overlaps(cursor, sEnd)) {
        skippedOverlap++;
      } else {
        toCreate.push({
          resourceType: 'Slot',
          schedule: { reference: `Schedule/${schedule.id}` },
          status: 'free',
          start: new Date(cursor).toISOString(),
          end: new Date(sEnd).toISOString(),
          serviceType: services.map((s) => ({ coding: [{ system: SERVICE_SYSTEM, code: s.id, display: s.name }] })),
        });
        existing.push([cursor, sEnd]);
      }
      cursor = sEnd;
    }
  }
  for (const slot of toCreate) await fhir().create(slot);
  audit(actor, {
    action: 'C',
    subtype: 'availability-create',
    entityRef: `Schedule/${schedule.id}`,
    detail: { created: toCreate.length, from: input.from, to: input.to },
  });
  if (toCreate.length) bus.publish({ type: 'slot.changed', staff: true });
  return { created: toCreate.length, skippedOverlap, skippedHolidays };
}

/** Blokada czasu (urlop, szkolenie): wolne sloty → busy-unavailable. Zwraca wizyty kolidujące. */
export async function blockTime(
  actor: AuditActor,
  input: { practitionerId: string; from: string; to: string; reason: string },
): Promise<{ blocked: number; conflicts: AppointmentView[] }> {
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (!(to > from)) throw badRequest('invalid_range');
  const schedules = await fhir().search<import('@medplum/fhirtypes').Schedule>('Schedule', { actor: `Practitioner/${input.practitionerId}` });
  let blocked = 0;
  for (const sch of schedules) {
    const slots = await fhir().search<Slot>('Slot', {
      schedule: `Schedule/${sch.id}`,
      start: [`ge${new Date(from.getTime() - 86_400_000).toISOString()}`, `lt${to.toISOString()}`],
      status: 'free',
    });
    for (const s of slots) {
      if (Date.parse(s.start) < to.getTime() && Date.parse(s.end) > from.getTime()) {
        await fhir().update<Slot>({ ...s, status: 'busy-unavailable', comment: input.reason.slice(0, 200) });
        blocked++;
      }
    }
  }
  const conflicts = (
    await fhir().search<Appointment>('Appointment', {
      practitioner: `Practitioner/${input.practitionerId}`,
      date: [`ge${from.toISOString()}`, `lt${to.toISOString()}`],
      status: 'booked',
    })
  ).map(toAppointmentView);
  audit(actor, { action: 'U', subtype: 'time-block', entityRef: `Practitioner/${input.practitionerId}`, detail: { blocked, from: input.from, to: input.to } });
  bus.publish({ type: 'slot.changed', staff: true });
  return { blocked, conflicts };
}

export async function deleteFreeSlots(actor: AuditActor, input: { practitionerId: string; from: string; to: string }): Promise<number> {
  const schedules = await fhir().search<import('@medplum/fhirtypes').Schedule>('Schedule', { actor: `Practitioner/${input.practitionerId}` });
  let removed = 0;
  for (const sch of schedules) {
    const slots = await fhir().search<Slot>('Slot', {
      schedule: `Schedule/${sch.id}`,
      start: [`ge${new Date(input.from).toISOString()}`, `lt${new Date(input.to).toISOString()}`],
    });
    for (const s of slots) {
      if (s.status === 'free' || s.status === 'busy-unavailable') {
        await fhir().delete('Slot', s.id ?? '');
        removed++;
      }
    }
  }
  audit(actor, { action: 'D', subtype: 'slots-delete', entityRef: `Practitioner/${input.practitionerId}`, detail: { removed } });
  bus.publish({ type: 'slot.changed', staff: true });
  return removed;
}

export async function findFreeSlots(input: { serviceId: string; practitionerId?: string; from: string; to: string }): Promise<SlotView[]> {
  const index = await scheduleIndex();
  const minStart = new Date(Math.max(Date.now() + 15 * 60_000, Date.parse(input.from)));
  const slots = await fhir().search<Slot>('Slot', {
    'service-type': `${SERVICE_SYSTEM}|${input.serviceId}`,
    status: 'free',
    start: [`ge${minStart.toISOString()}`, `lt${new Date(input.to).toISOString()}`],
    _sort: 'start',
  });
  const views = slots.map((s) => toSlotView(s, index)).filter((s) => s.practitionerId);
  return input.practitionerId ? views.filter((s) => s.practitionerId === input.practitionerId) : views;
}

export async function listSlotsForRange(from: string, to: string, practitionerId?: string): Promise<SlotView[]> {
  const index = await scheduleIndex();
  const slots = await fhir().search<Slot>('Slot', { start: [`ge${from}`, `lt${to}`], _sort: 'start' });
  const views = slots.map((s) => toSlotView(s, index));
  return practitionerId ? views.filter((s) => s.practitionerId === practitionerId) : views;
}

// --- rezerwacja ---------------------------------------------------------------------------------

async function staffUserIdsFor(practitionerId?: string): Promise<string[]> {
  return listUsers({ staffOnly: true })
    .filter((u) => u.status === 'active' && (u.roles.includes('reception') || (practitionerId && u.fhir_ref === `Practitioner/${practitionerId}`)))
    .map((u) => u.id);
}

export async function bookAppointment(
  actor: AuditActor,
  input: { slotId: string; serviceId: string; patientRef: string; comment?: string; bookedBy: 'patient' | 'staff'; reschedulingId?: string },
): Promise<AppointmentView> {
  const slot = await fhir().read<Slot>('Slot', input.slotId);
  const service = await getService(input.serviceId);
  if (!service.active) throw badRequest('service_inactive');
  if (slot.status !== 'free') throw conflict('slot_taken');
  if (Date.parse(slot.start) < Date.now()) throw conflict('slot_in_past');
  const allowed = (slot.serviceType ?? []).flatMap((s) => s.coding ?? []).some((c) => c.system === SERVICE_SYSTEM && c.code === service.id);
  if (!allowed) throw badRequest('service_not_offered_in_slot');

  const patient = await fhir().read<Patient>('Patient', idFromRef(input.patientRef));
  const patientView = toPatientView(patient);

  const upcoming = (
    await fhir().search<Appointment>('Appointment', {
      patient: input.patientRef,
      date: `ge${nowIso()}`,
      status: ACTIVE_STATUSES.join(','),
    })
  ).filter((a) => a.id !== input.reschedulingId);
  if (input.bookedBy === 'patient') {
    if (upcoming.length >= MAX_ACTIVE_BOOKINGS) throw conflict('too_many_active_bookings');
    if (upcoming.some((a) => toAppointmentView(a).serviceId === service.id)) throw conflict('already_booked_for_service');
  }
  const s0 = Date.parse(slot.start);
  const s1 = Date.parse(slot.end);
  if (upcoming.some((a) => Date.parse(a.start ?? '') < s1 && Date.parse(a.end ?? '') > s0)) throw conflict('patient_time_conflict');

  const schedule = await fhir().read<import('@medplum/fhirtypes').Schedule>('Schedule', idFromRef(slot.schedule.reference));
  const practitionerRef = schedule.actor.find((a) => a.reference?.startsWith('Practitioner/'))?.reference ?? '';
  const practitioner = await getPractitioner(idFromRef(practitionerRef));
  const locationRef = schedule.actor.find((a) => a.reference?.startsWith('Location/'))?.reference;
  const location = locationRef ? (await listLocations()).find((l) => `Location/${l.id}` === locationRef) : undefined;

  // Blokada optymistyczna na wersji slotu — dwie równoczesne rezerwacje: wygrywa jedna.
  let busySlot: Slot;
  try {
    busySlot = await fhir().update<Slot>({ ...slot, status: 'busy' }, { ifMatch: slot.meta?.versionId });
  } catch (err) {
    if (err instanceof FhirConflictError) throw conflict('slot_taken');
    throw err;
  }

  const appointment: Appointment = {
    resourceType: 'Appointment',
    status: 'booked',
    serviceType: [{ coding: [{ system: SERVICE_SYSTEM, code: service.id, display: service.name }] }],
    appointmentType: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0276', code: 'ROUTINE', display: 'Routine appointment' }],
    },
    start: slot.start,
    end: slot.end,
    minutesDuration: Math.round((s1 - s0) / 60_000),
    slot: [{ reference: `Slot/${slot.id}` }],
    created: nowIso(),
    comment: input.comment?.trim().slice(0, 500) || undefined,
    patientInstruction: service.preparation,
    participant: [
      { actor: { reference: input.patientRef, display: patientView.name }, required: 'required', status: 'accepted' },
      { actor: { reference: practitionerRef, display: practitioner.name }, required: 'required', status: 'accepted' },
      ...(location ? [{ actor: { reference: `Location/${location.id}`, display: location.name }, required: 'required' as const, status: 'accepted' as const }] : []),
    ],
    extension: [
      ...(service.mode === 'tele' ? [{ url: ETERNAL.ext.teleRoom, valueString: crypto.randomBytes(16).toString('hex') }] : []),
      ...(service.questionnaireId ? [{ url: ETERNAL.ext.questionnaire, valueReference: { reference: `Questionnaire/${service.questionnaireId}` } }] : []),
    ],
  };
  if (!appointment.extension?.length) delete appointment.extension;

  let saved: Appointment;
  try {
    saved = await fhir().create(appointment);
  } catch (err) {
    await fhir().update<Slot>({ ...busySlot, status: 'free' }).catch(() => undefined);
    throw err;
  }

  const view = toAppointmentView(saved);
  audit(actor, {
    action: 'C',
    subtype: input.bookedBy === 'patient' ? 'appointment-book-online' : 'appointment-book-staff',
    entityRef: `Appointment/${saved.id}`,
    patientRef: input.patientRef,
  });
  bus.publish({ type: 'appointment.changed', patientRef: input.patientRef, resourceRef: `Appointment/${saved.id}` });
  bus.publish({ type: 'slot.changed', resourceRef: `Slot/${slot.id}` });

  const when = formatLocal(saved.start ?? '', config.clinic.timezone);
  await notifyPatient(input.patientRef, {
    kind: 'appointment-booked',
    title: 'Wizyta zarezerwowana',
    body: `${service.name}, ${when}`,
    link: `/wizyty/${saved.id}`,
  });
  if (input.bookedBy === 'patient') {
    for (const uid of await staffUserIdsFor(practitioner.id)) {
      await notifyUser(uid, { kind: 'appointment-booked', title: 'Nowa rezerwacja online', body: `${patientView.name} · ${service.name} · ${when}`, link: `/panel/kalendarz?date=${localDate(new Date(saved.start ?? ''), config.clinic.timezone)}`, push: false });
    }
  }
  removeFromWaitlist(input.patientRef, service.id);
  return view;
}

export async function getAppointment(id: string): Promise<Appointment> {
  return fhir().read<Appointment>('Appointment', id);
}

export async function cancelAppointment(
  actor: AuditActor,
  input: { appointmentId: string; by: 'patient' | 'staff'; patientRef?: string; reason?: string },
): Promise<AppointmentView> {
  const appt = await fhir().read<Appointment>('Appointment', input.appointmentId);
  const view = toAppointmentView(appt);
  const patientRef = participant(appt, 'Patient')?.reference ?? '';
  if (input.by === 'patient') {
    if (patientRef !== input.patientRef) throw forbidden('not_your_appointment');
    if (appt.status !== 'booked') throw conflict('not_cancellable');
    if (!view.canCancelOnline) {
      const s = getClinicSettings();
      throw new HttpError(409, 'cancel_window_passed', `Online cancellation closes ${s.cancelMinHours}h before the visit`, { phone: s.phone, hours: s.cancelMinHours });
    }
  } else if (!['booked', 'arrived', 'checked-in', 'pending', 'proposed'].includes(appt.status)) {
    throw conflict('not_cancellable');
  }
  const reasonCode = input.by === 'patient' ? { code: 'pat-cpp', display: 'Patient: Canceled via Patient Portal' } : { code: 'prov', display: 'Provider' };
  const updated = await fhir().update<Appointment>({
    ...appt,
    status: 'cancelled',
    cancelationReason: { coding: [{ system: APPOINTMENT_CANCEL_REASON, ...reasonCode }], text: input.reason?.trim().slice(0, 300) || undefined },
  });

  const slotId = idFromRef(appt.slot?.[0]?.reference);
  let freedSlot = false;
  if (slotId && Date.parse(appt.start ?? '') > Date.now()) {
    const slot = await fhir().readOptional<Slot>('Slot', slotId);
    if (slot && slot.status === 'busy') {
      await fhir().update<Slot>({ ...slot, status: 'free' });
      freedSlot = true;
    }
  }

  audit(actor, { action: 'U', subtype: `appointment-cancel-${input.by}`, entityRef: `Appointment/${appt.id}`, patientRef, detail: input.reason ? { reason: input.reason.slice(0, 300) } : undefined });
  bus.publish({ type: 'appointment.changed', patientRef, resourceRef: `Appointment/${appt.id}` });
  if (freedSlot) bus.publish({ type: 'slot.changed', resourceRef: `Slot/${slotId}` });

  const when = formatLocal(appt.start ?? '', config.clinic.timezone);
  if (input.by === 'staff') {
    await notifyPatient(patientRef, {
      kind: 'appointment-cancelled',
      title: 'Wizyta odwołana przez placówkę',
      body: `${view.serviceName ?? 'Wizyta'}, ${when}. ${input.reason ? `Powód: ${input.reason}. ` : ''}Wybierz nowy termin w aplikacji.`,
      link: `/wizyty/${appt.id}`,
    });
  } else {
    for (const uid of await staffUserIdsFor(view.practitionerId)) {
      await notifyUser(uid, { kind: 'appointment-cancelled', title: 'Pacjent odwołał wizytę', body: `${view.patientName} · ${view.serviceName} · ${when}`, link: `/panel/kalendarz?date=${localDate(new Date(appt.start ?? ''), config.clinic.timezone)}`, push: false });
    }
  }
  if (freedSlot && view.serviceId) await notifyWaitlist(view.serviceId, appt.start ?? '');
  return toAppointmentView(updated);
}

export async function rescheduleAppointment(
  actor: AuditActor,
  input: { appointmentId: string; newSlotId: string; by: 'patient' | 'staff'; patientRef?: string },
): Promise<AppointmentView> {
  const appt = await fhir().read<Appointment>('Appointment', input.appointmentId);
  const view = toAppointmentView(appt);
  const patientRef = participant(appt, 'Patient')?.reference ?? '';
  if (input.by === 'patient' && patientRef !== input.patientRef) throw forbidden('not_your_appointment');
  if (input.by === 'patient' && !view.canCancelOnline) throw conflict('cancel_window_passed');
  if (!view.serviceId) throw badRequest('unknown_service');
  // Nowy termin rezerwujemy przed odwołaniem starego — pacjent nie zostaje bez wizyty, gdy nowy slot zajęto.
  const booked = await bookAppointment(actor, {
    slotId: input.newSlotId,
    serviceId: view.serviceId,
    patientRef,
    comment: appt.comment,
    bookedBy: input.by,
    reschedulingId: appt.id,
  });
  await cancelAppointment(actor, { appointmentId: appt.id ?? '', by: input.by, patientRef, reason: 'Zmiana terminu' });
  return booked;
}

const STAFF_TRANSITIONS: Record<string, Appointment['status'][]> = {
  booked: ['arrived', 'noshow', 'fulfilled'],
  arrived: ['fulfilled', 'booked'],
  'checked-in': ['fulfilled'],
  noshow: ['booked'],
  fulfilled: ['arrived'],
};

export async function setAppointmentStatus(actor: AuditActor, id: string, status: Appointment['status']): Promise<AppointmentView> {
  const appt = await fhir().read<Appointment>('Appointment', id);
  if (!STAFF_TRANSITIONS[appt.status]?.includes(status)) throw conflict('invalid_transition');
  if (status === 'noshow' && Date.parse(appt.start ?? '') > Date.now()) throw conflict('noshow_before_start');
  const updated = await fhir().update<Appointment>({ ...appt, status });
  const patientRef = participant(appt, 'Patient')?.reference ?? '';
  audit(actor, { action: 'U', subtype: `appointment-status-${status}`, entityRef: `Appointment/${id}`, patientRef });
  bus.publish({ type: 'appointment.changed', patientRef, resourceRef: `Appointment/${id}` });
  return toAppointmentView(updated);
}

export async function listPatientAppointments(patientRef: string): Promise<AppointmentView[]> {
  const appts = await fhir().search<Appointment>('Appointment', { patient: patientRef, _sort: '-date', _count: '200' });
  return appts.map(toAppointmentView);
}

export async function listAppointmentsInRange(from: string, to: string, practitionerId?: string): Promise<AppointmentView[]> {
  const params: Record<string, string | string[]> = { date: [`ge${from}`, `lt${to}`], _sort: 'date' };
  if (practitionerId) params.practitioner = `Practitioner/${practitionerId}`;
  return (await fhir().search<Appointment>('Appointment', params)).map(toAppointmentView);
}

export async function dayOverview(date: string, practitionerId?: string) {
  const tz = config.clinic.timezone;
  const from = zonedToUtc(date, '00:00', tz).toISOString();
  const to = zonedToUtc(addDays(date, 1), '00:00', tz).toISOString();
  const [appointments, slots, practitioners] = await Promise.all([
    listAppointmentsInRange(from, to, practitionerId),
    listSlotsForRange(from, to, practitionerId),
    listPractitioners(),
  ]);
  return { date, holiday: holidayName(date), appointments, slots, practitioners: practitionerId ? practitioners.filter((p) => p.id === practitionerId) : practitioners };
}

// --- lista oczekujących na wcześniejszy termin ------------------------------------------------------

export function addToWaitlist(input: { patientRef: string; userId: string; serviceId: string; practitionerId?: string; beforeDate?: string }): string {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM waitlist_entry WHERE patient_ref = ? AND service_id = ? AND status = 'active'").get(input.patientRef, input.serviceId) as
    | { id: string }
    | undefined;
  if (existing) return existing.id;
  const id = newId();
  db.prepare('INSERT INTO waitlist_entry (id, patient_ref, user_id, service_id, practitioner_id, before_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    input.patientRef,
    input.userId,
    input.serviceId,
    input.practitionerId ?? null,
    input.beforeDate ?? null,
    nowIso(),
  );
  return id;
}

export function listWaitlist(patientRef: string): { id: string; service_id: string; practitioner_id: string | null; before_date: string | null; created_at: string }[] {
  return getDb().prepare("SELECT id, service_id, practitioner_id, before_date, created_at FROM waitlist_entry WHERE patient_ref = ? AND status = 'active'").all(patientRef) as never;
}

export function removeFromWaitlist(patientRef: string, serviceId?: string, id?: string): void {
  const db = getDb();
  if (id) db.prepare("UPDATE waitlist_entry SET status = 'removed' WHERE id = ? AND patient_ref = ?").run(id, patientRef);
  else if (serviceId) db.prepare("UPDATE waitlist_entry SET status = 'fulfilled' WHERE patient_ref = ? AND service_id = ? AND status = 'active'").run(patientRef, serviceId);
}

/** Zwolniony termin → powiadomienie osób z listy oczekujących (kto pierwszy zarezerwuje, ten ma). */
async function notifyWaitlist(serviceId: string, freedStart: string): Promise<void> {
  const rows = getDb()
    .prepare("SELECT * FROM waitlist_entry WHERE service_id = ? AND status = 'active' ORDER BY created_at LIMIT 10")
    .all(serviceId) as { id: string; user_id: string; before_date: string | null; patient_ref: string }[];
  const service = await getService(serviceId).catch(() => undefined);
  for (const r of rows) {
    if (r.before_date && freedStart.slice(0, 10) > r.before_date) continue;
    if (!findUserByFhirRef(r.patient_ref)) continue;
    await notifyUser(r.user_id, {
      kind: 'waitlist-slot',
      title: 'Zwolnił się wcześniejszy termin',
      body: `${service?.name ?? 'Usługa'}: ${formatLocal(freedStart, config.clinic.timezone)}. Zarezerwuj, zanim zrobi to ktoś inny.`,
      link: `/rezerwacja?service=${serviceId}`,
    });
    getDb().prepare('UPDATE waitlist_entry SET notified_at = ? WHERE id = ?').run(nowIso(), r.id);
  }
}
