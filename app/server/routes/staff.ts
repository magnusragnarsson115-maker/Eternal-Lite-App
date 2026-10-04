import type { Appointment, Patient } from '@medplum/fhirtypes';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requireClinician, requireStaff } from '../auth/sessions.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { teleJoinInfo, teleWindowOpen } from '../integrations/jitsi.js';
import { searchIcd10, searchIcd11, searchLoinc } from '../integrations/terminology.js';
import { body, IdParams, params, query, zDate, zId, zIso } from '../lib/http.js';
import { addDays, localDate, zonedToUtc } from '../lib/time.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/util.js';
import { getConsentStates } from '../services/consents.js';
import { listMedications } from '../services/medications.js';
import { getThread, listThreadsForStaff, reply, startThreadAsStaff } from '../services/messages.js';
import { listOutbox } from '../services/notifications.js';
import { listMeasurementsForStaff } from '../services/observations.js';
import {
  createPatient,
  issueActivationCode,
  searchPatients,
  setIdentityVerified,
  toPatientView,
  updatePatient,
} from '../services/patients.js';
import { readableAnswers, responseForAppointment, responsesForPatient } from '../services/questionnaires.js';
import { createDocument, createReport, getRecord, listPatientRecords, readBinaryFor, registerUpload, setShared } from '../services/records.js';
import { remindersFor, sendManualReminder } from '../services/reminders.js';
import {
  blockTime,
  bookAppointment,
  cancelAppointment,
  createAvailability,
  dayOverview,
  deleteFreeSlots,
  findFreeSlots,
  getAppointment,
  listAppointmentsInRange,
  listPatientAppointments,
  rescheduleAppointment,
  setAppointmentStatus,
  teleRoomOf,
  toAppointmentView,
} from '../services/scheduling.js';

const PatientSchema = z.object({
  given: z.string().trim().min(1).max(80),
  family: z.string().trim().min(1).max(80),
  birthDate: zDate.optional().or(z.literal('').transform(() => undefined)),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  pesel: z.string().regex(/^\d{11}$/).optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  email: z.email().max(200).optional().or(z.literal('').transform(() => undefined)),
  address: z.object({ line: z.string().max(120).optional(), postalCode: z.string().max(10).optional(), city: z.string().max(80).optional() }).optional(),
  preferredLanguage: z.enum(['pl', 'en', 'uk']).optional(),
});

const ObservationSchema = z.object({
  loinc: z.string().max(20).optional(),
  name: z.string().max(200),
  value: z.string().max(100),
  unit: z.string().max(30).optional(),
  refLow: z.number().optional(),
  refHigh: z.number().optional(),
  refText: z.string().max(100).optional(),
  labFlag: z.enum(['H', 'L', 'N', 'A', 'HH', 'LL']).optional(),
});

function isClinician(roles: string[]): boolean {
  return roles.includes('practitioner');
}

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  // --- pulpit --------------------------------------------------------------------------------
  app.get('/api/staff/dashboard', async (req) => {
    const auth = requireStaff(req);
    const tz = config.clinic.timezone;
    const today = localDate(new Date(), tz);
    const from = zonedToUtc(today, '00:00', tz).toISOString();
    const to = zonedToUtc(addDays(today, 1), '00:00', tz).toISOString();
    const practitionerId = isClinician(auth.user.roles) && auth.user.fhir_ref?.startsWith('Practitioner/') ? idFromRef(auth.user.fhir_ref) : undefined;
    const todays = await listAppointmentsInRange(from, to, practitionerId);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const last30 = await listAppointmentsInRange(monthAgo, new Date().toISOString());
    const finished = last30.filter((a) => ['fulfilled', 'noshow'].includes(a.status));
    const noShows = last30.filter((a) => a.status === 'noshow').length;
    const cancelled = last30.filter((a) => a.status === 'cancelled');
    const threads = await listThreadsForStaff();
    return {
      date: today,
      scope: practitionerId ? 'mine' : 'all',
      today: {
        total: todays.filter((a) => a.status !== 'cancelled').length,
        arrived: todays.filter((a) => a.status === 'arrived').length,
        fulfilled: todays.filter((a) => a.status === 'fulfilled').length,
        cancelled: todays.filter((a) => a.status === 'cancelled').length,
        appointments: todays,
      },
      last30: {
        noShowRate: finished.length ? Math.round((noShows / finished.length) * 1000) / 10 : null,
        cancelled: cancelled.length,
        cancelledByPatient: cancelled.filter((a) => a.cancelledBy === 'patient').length,
        total: last30.length,
      },
      unreadThreads: threads.filter((t) => t.unread).length,
    };
  });

  // --- kalendarz i wizyty ----------------------------------------------------------------------
  app.get('/api/staff/calendar', async (req) => {
    requireStaff(req);
    const q = query(req, z.object({ date: zDate, practitionerId: zId.optional() }));
    return dayOverview(q.date, q.practitionerId);
  });

  app.get('/api/staff/appointments', async (req) => {
    requireStaff(req);
    const q = query(req, z.object({ from: zIso, to: zIso, practitionerId: zId.optional() }));
    return { items: await listAppointmentsInRange(q.from, q.to, q.practitionerId) };
  });

  app.get('/api/staff/appointments/:id', async (req) => {
    const auth = requireStaff(req);
    const { id } = params(req, IdParams);
    const appt = await getAppointment(id);
    const view = toAppointmentView(appt);
    const patientRef = `Patient/${view.patientId}`;
    const patient = await fhir().readOptional<Patient>('Patient', view.patientId ?? '');
    let questionnaire: { question: string; answer: string }[] | null | undefined;
    if (view.questionnaireId) {
      const r = await responseForAppointment(id, patientRef);
      questionnaire = isClinician(auth.user.roles) ? (r ? readableAnswers(r) : null) : undefined;
    }
    audit(actorOf(req), { action: 'R', subtype: 'appointment-read', entityRef: `Appointment/${id}`, patientRef });
    return {
      ...view,
      patient: patient ? toPatientView(patient, { maskPesel: !isClinician(auth.user.roles) }) : null,
      reminders: remindersFor(id),
      questionnaire,
      questionnaireFilled: view.questionnaireId ? questionnaire !== null : undefined,
      teleWindowOpen: view.mode === 'tele' ? teleWindowOpen(view.start, view.end) : false,
    };
  });

  app.post('/api/staff/appointments', async (req) => {
    requireStaff(req);
    const input = body(req, z.object({ slotId: zId, serviceId: zId, patientId: zId, comment: z.string().max(500).optional() }));
    return bookAppointment(actorOf(req), { slotId: input.slotId, serviceId: input.serviceId, patientRef: `Patient/${input.patientId}`, comment: input.comment, bookedBy: 'staff' });
  });

  app.post('/api/staff/appointments/:id/cancel', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const { reason } = body(req, z.object({ reason: z.string().max(300).optional() }));
    return cancelAppointment(actorOf(req), { appointmentId: id, by: 'staff', reason });
  });

  app.post('/api/staff/appointments/:id/reschedule', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const { slotId } = body(req, z.object({ slotId: zId }));
    return rescheduleAppointment(actorOf(req), { appointmentId: id, newSlotId: slotId, by: 'staff' });
  });

  app.post('/api/staff/appointments/:id/status', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const { status } = body(req, z.object({ status: z.enum(['arrived', 'fulfilled', 'noshow', 'booked']) }));
    return setAppointmentStatus(actorOf(req), id, status);
  });

  app.post('/api/staff/appointments/:id/remind', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    return { channels: await sendManualReminder(actorOf(req), id) };
  });

  app.get('/api/staff/appointments/:id/tele', async (req) => {
    const auth = requireClinician(req);
    const { id } = params(req, IdParams);
    const appt: Appointment = await getAppointment(id);
    const room = teleRoomOf(appt);
    if (!room) throw badRequest('not_a_teleconsultation');
    const v = toAppointmentView(appt);
    if (auth.user.fhir_ref && auth.user.fhir_ref !== `Practitioner/${v.practitionerId}` && !auth.user.roles.includes('admin')) throw forbidden('not_your_appointment');
    audit(actorOf(req), { action: 'E', subtype: 'tele-join', entityRef: `Appointment/${id}`, patientRef: `Patient/${v.patientId}` });
    return teleJoinInfo(room, { name: auth.user.display_name, id: auth.user.id, moderator: true });
  });

  app.get('/api/staff/slots/free', async (req) => {
    requireStaff(req);
    const q = query(req, z.object({ serviceId: zId, practitionerId: zId.optional(), from: zIso.optional(), to: zIso.optional() }));
    return {
      slots: await findFreeSlots({
        serviceId: q.serviceId,
        practitionerId: q.practitionerId,
        from: q.from ?? new Date().toISOString(),
        to: q.to ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }),
    };
  });

  // --- grafik ---------------------------------------------------------------------------------
  app.post('/api/staff/availability', async (req) => {
    requireStaff(req, ['admin', 'reception', 'practitioner']);
    const input = body(
      req,
      z.object({
        practitionerId: zId,
        serviceIds: z.array(zId).min(1).max(20),
        locationId: zId.optional(),
        from: zDate,
        to: zDate,
        weekdays: z.array(z.number().int().min(1).max(7)).min(1),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        slotMinutes: z.number().int().min(5).max(240),
        breakStart: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
        breakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
        skipHolidays: z.boolean().default(true),
      }),
    );
    return createAvailability(actorOf(req), input);
  });

  app.post('/api/staff/availability/block', async (req) => {
    requireStaff(req);
    const input = body(req, z.object({ practitionerId: zId, from: zIso, to: zIso, reason: z.string().max(200) }));
    return blockTime(actorOf(req), input);
  });

  app.post('/api/staff/availability/delete', async (req) => {
    requireStaff(req, ['admin', 'reception']);
    const input = body(req, z.object({ practitionerId: zId, from: zIso, to: zIso }));
    return { removed: await deleteFreeSlots(actorOf(req), input) };
  });

  // --- pacjenci -------------------------------------------------------------------------------
  app.get('/api/staff/patients', async (req) => {
    const auth = requireStaff(req);
    const { q } = query(req, z.object({ q: z.string().max(80) }));
    const results = await searchPatients(q);
    audit(actorOf(req), { action: 'R', subtype: 'patient-search', detail: { results: results.length } });
    return { items: results.map((p) => toPatientView(p, { maskPesel: !isClinician(auth.user.roles) })) };
  });

  app.post('/api/staff/patients', async (req) => {
    requireStaff(req);
    const input = body(req, PatientSchema.extend({ identityVerified: z.boolean().default(false) }));
    const p = await createPatient(actorOf(req), input, { verified: input.identityVerified });
    return toPatientView(p);
  });

  app.get('/api/staff/patients/:id', async (req) => {
    const auth = requireStaff(req);
    const { id } = params(req, IdParams);
    const p = await fhir().readOptional<Patient>('Patient', id);
    if (!p) throw notFound('patient_not_found');
    const ref = `Patient/${id}`;
    audit(actorOf(req), { action: 'R', subtype: 'patient-read', entityRef: ref, patientRef: ref });
    const clinician = isClinician(auth.user.roles);
    return {
      patient: toPatientView(p, { maskPesel: !clinician }),
      consents: await getConsentStates(ref),
      appointments: await listPatientAppointments(ref),
      clinicalAccess: clinician,
    };
  });

  app.put('/api/staff/patients/:id', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const input = body(req, PatientSchema);
    return toPatientView(await updatePatient(actorOf(req), id, input));
  });

  app.post('/api/staff/patients/:id/verify-identity', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const { method } = body(req, z.object({ method: z.enum(['id-card', 'passport', 'mobywatel', 'other']) }));
    return toPatientView(await setIdentityVerified(actorOf(req), id, method));
  });

  app.post('/api/staff/patients/:id/activation-code', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const p = await fhir().read<Patient>('Patient', id);
    if (!toPatientView(p).identityVerified) throw conflict('identity_not_verified');
    return issueActivationCode(actorOf(req), id);
  });

  app.get('/api/staff/patients/:id/clinical', async (req) => {
    requireClinician(req);
    const { id } = params(req, IdParams);
    const ref = `Patient/${id}`;
    const [records, measurements, medications, responses] = await Promise.all([
      listPatientRecords(ref, { onlyShared: false }),
      listMeasurementsForStaff(ref),
      listMedications(ref),
      responsesForPatient(ref),
    ]);
    audit(actorOf(req), { action: 'R', subtype: 'patient-clinical-read', entityRef: ref, patientRef: ref });
    return {
      records,
      measurements,
      medications,
      questionnaires: responses.map((r) => ({ id: r.id, authored: r.authored, answers: readableAnswers(r), appointmentId: idFromRef(r.extension?.[0]?.valueReference?.reference) })),
    };
  });

  // --- wyniki i dokumenty -------------------------------------------------------------------------
  app.post('/api/staff/uploads', async (req) => {
    requireClinician(req);
    const file = await req.file();
    if (!file) throw badRequest('file_required');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    return registerUpload(actorOf(req), { data, filename: file.filename, contentType: file.mimetype });
  });

  app.post('/api/staff/reports', async (req) => {
    requireClinician(req);
    const input = body(
      req,
      z.object({
        patientId: zId,
        title: z.string().max(200),
        loinc: z.string().max(20).optional(),
        category: z.enum(['LAB', 'RAD', 'OTH']),
        effective: zIso,
        laboratory: z.string().max(200).optional(),
        conclusion: z.string().max(4000).optional(),
        observations: z.array(ObservationSchema).max(100),
        binaryId: zId.optional(),
        share: z.boolean().default(false),
      }),
    );
    const created = await createReport(actorOf(req), input);
    return input.share ? setShared(actorOf(req), created.ref, true) : created;
  });

  app.post('/api/staff/documents', async (req) => {
    requireClinician(req);
    const input = body(
      req,
      z.object({
        patientId: zId,
        title: z.string().max(200),
        kind: z.enum(['recommendations', 'certificate', 'referral-scan', 'visit-summary', 'other']),
        text: z.string().max(10000).optional(),
        binaryId: zId.optional(),
        appointmentId: zId.optional(),
        share: z.boolean().default(false),
      }),
    );
    const created = await createDocument(actorOf(req), input);
    return input.share ? setShared(actorOf(req), created.ref, true) : created;
  });

  app.get('/api/staff/records/:kind/:id', async (req) => {
    requireClinician(req);
    const p = params(req, z.object({ kind: z.enum(['r', 'd']), id: zId }));
    const ref = `${p.kind === 'r' ? 'DiagnosticReport' : 'DocumentReference'}/${p.id}`;
    const rec = await getRecord(ref, {});
    audit(actorOf(req), { action: 'R', subtype: 'record-read', entityRef: ref, patientRef: `Patient/${rec.patientId}` });
    return rec;
  });

  app.post('/api/staff/records/:kind/:id/share', async (req) => {
    requireClinician(req);
    const p = params(req, z.object({ kind: z.enum(['r', 'd']), id: zId }));
    const { shared } = body(req, z.object({ shared: z.boolean() }));
    return setShared(actorOf(req), `${p.kind === 'r' ? 'DiagnosticReport' : 'DocumentReference'}/${p.id}`, shared);
  });

  app.get('/api/staff/files/:id', async (req, replyObj) => {
    requireClinician(req);
    const { id } = params(req, IdParams);
    const file = await readBinaryFor(id, { clinician: true });
    audit(actorOf(req), { action: 'R', subtype: 'file-download', entityRef: `Binary/${id}`, patientRef: file.patientRef ?? undefined });
    replyObj.header('Content-Type', file.contentType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    return file.data;
  });

  // --- wiadomości ------------------------------------------------------------------------------
  app.get('/api/staff/threads', async (req) => {
    requireStaff(req);
    const q = query(req, z.object({ patientId: zId.optional() }));
    return { items: await listThreadsForStaff({ patientId: q.patientId }) };
  });

  app.get('/api/staff/threads/:id', async (req) => {
    const auth = requireStaff(req);
    const { id } = params(req, IdParams);
    const t = await getThread(id, { userId: auth.user.id, staff: true });
    audit(actorOf(req), { action: 'R', subtype: 'thread-read', entityRef: `Communication/${id}`, patientRef: `Patient/${t.patientId}` });
    return t;
  });

  app.post('/api/staff/threads', async (req) => {
    requireStaff(req);
    const input = body(req, z.object({ patientId: zId, subject: z.string().max(120), body: z.string().max(2000) }));
    return startThreadAsStaff(actorOf(req), input);
  });

  app.post('/api/staff/threads/:id/reply', async (req) => {
    requireStaff(req);
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ body: z.string().max(2000) }));
    return reply(actorOf(req), { threadId: id, body: input.body, as: 'staff' });
  });

  // --- terminologie ----------------------------------------------------------------------------
  app.get('/api/staff/terminology/:system', async (req) => {
    requireStaff(req);
    const { system } = params(req, z.object({ system: z.enum(['loinc', 'icd10', 'icd11']) }));
    const { q } = query(req, z.object({ q: z.string().max(80) }));
    if (system === 'loinc') return searchLoinc(q);
    if (system === 'icd10') return searchIcd10(q);
    return searchIcd11(q);
  });

  // --- kolejka powiadomień ---------------------------------------------------------------------
  app.get('/api/staff/outbox', async (req) => {
    requireStaff(req, ['admin', 'reception']);
    return {
      items: listOutbox(200).map((o) => ({
        ...o,
        // linki bezpieczeństwa (reset hasła, weryfikacja) nigdy nie są pokazywane personelowi
        body: o.related_ref === 'security' ? '••• (wiadomość bezpieczeństwa — treść ukryta)' : o.body,
        recipient: o.channel === 'push' ? 'urządzenie' : o.recipient.replace(/^(.{2}).*(@.*)$/, '$1***$2').replace(/^(\+?\d{2}).*(\d{3})$/, '$1*****$2'),
      })),
    };
  });
}
