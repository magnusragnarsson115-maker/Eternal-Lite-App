import type { Patient } from '@medplum/fhirtypes';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requirePatient, requireUser } from '../auth/sessions.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { CONSENT_TYPES, type ConsentType } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { teleJoinInfo, teleWindowOpen } from '../integrations/jitsi.js';
import { PROVINCES, searchBenefits, searchQueues } from '../integrations/nfz.js';
import { searchMedicinalProducts } from '../integrations/rpl.js';
import { authorizeUrl, disconnectWithings, syncWithings, withingsConfigured, withingsStatus } from '../integrations/withings.js';
import { body, IdParams, params, query, zDate, zId, zIso } from '../lib/http.js';
import { appointmentIcs } from '../lib/ics.js';
import { messageLimiter, publicApiLimiter } from '../lib/ratelimit.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/util.js';
import { consentHistory, getConsentStates, hasConsent, setConsent } from '../services/consents.js';
import { getClinicSettings, getService, listLocations, listPractitioners, listServices } from '../services/directory.js';
import { addMedication, listMedications, stopMedication } from '../services/medications.js';
import { listThreadsForPatient, getThread, MESSAGE_CATEGORIES, reply, startThreadAsPatient } from '../services/messages.js';
import { listNotifications, markNotificationsRead, removePushSubscription, savePushSubscription } from '../services/notifications.js';
import { addMeasurement, listMeasurements, retractMeasurement } from '../services/observations.js';
import { toPatientView, updatePatient } from '../services/patients.js';
import { accessLogForPatient, exportPatientBundle, requestAccountDeletion } from '../services/privacy.js';
import { canonicalOf, getQuestionnaire, responseForAppointment, submitResponse } from '../services/questionnaires.js';
import { getRecord, listPatientRecords, markRead, patientCanViewRecords, readBinaryFor } from '../services/records.js';
import {
  addToWaitlist,
  bookAppointment,
  cancelAppointment,
  findFreeSlots,
  getAppointment,
  listPatientAppointments,
  listWaitlist,
  removeFromWaitlist,
  rescheduleAppointment,
  teleRoomOf,
  toAppointmentView,
} from '../services/scheduling.js';

async function ownAppointment(id: string, patientRef: string) {
  const appt = await getAppointment(id).catch(() => undefined);
  if (!appt || !appt.participant.some((p) => p.actor?.reference === patientRef)) throw notFound('appointment_not_found');
  return appt;
}

function requireVerifiedEmail(user: { email_verified: boolean }): void {
  if (config.security.requireEmailVerification && !user.email_verified) throw forbidden('email_not_verified');
}

export async function patientRoutes(app: FastifyInstance): Promise<void> {
  // --- powiadomienia i push (wszyscy zalogowani) ---------------------------------------------------
  app.get('/api/notifications', async (req) => {
    const auth = requireUser(req);
    const items = listNotifications(auth.user.id);
    return { items, unread: items.filter((n) => !n.read_at).length };
  });

  app.post('/api/notifications/read', async (req) => {
    const auth = requireUser(req);
    const { ids } = body(req, z.object({ ids: z.array(zId).max(200).optional() }));
    markNotificationsRead(auth.user.id, ids);
    return { ok: true };
  });

  app.post('/api/push/subscribe', async (req) => {
    const auth = requireUser(req);
    const sub = body(
      req,
      z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
    );
    if (!sub.endpoint.startsWith('https://')) throw badRequest('invalid_endpoint');
    savePushSubscription(auth.user.id, sub);
    return { ok: true };
  });

  app.post('/api/push/unsubscribe', async (req) => {
    const auth = requireUser(req);
    const { endpoint } = body(req, z.object({ endpoint: z.string().max(1000) }));
    removePushSubscription(auth.user.id, endpoint);
    return { ok: true };
  });

  // --- katalog -------------------------------------------------------------------------------
  app.get('/api/catalog', async (req) => {
    requireUser(req);
    const [services, practitioners, locations] = await Promise.all([listServices(), listPractitioners(), listLocations()]);
    return { services, practitioners, locations };
  });

  app.get('/api/availability', async (req) => {
    requireUser(req);
    const q = query(req, z.object({ serviceId: zId, practitionerId: zId.optional(), from: zIso.optional(), to: zIso.optional() }));
    const from = q.from ?? new Date().toISOString();
    const to = q.to ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
    if (Date.parse(to) - Date.parse(from) > 92 * 86_400_000) throw badRequest('range_too_long');
    return { slots: await findFreeSlots({ serviceId: q.serviceId, practitionerId: q.practitionerId, from, to }) };
  });

  // --- profil i pulpit -------------------------------------------------------------------------
  app.get('/api/me/profile', async (req) => {
    const auth = requirePatient(req);
    const p = await fhir().read<Patient>('Patient', idFromRef(auth.patientRef));
    return toPatientView(p);
  });

  app.put('/api/me/profile', async (req) => {
    const auth = requirePatient(req);
    const input = body(
      req,
      z.object({
        phone: z.string().max(20).optional(),
        address: z.object({ line: z.string().max(120).optional(), postalCode: z.string().max(10).optional(), city: z.string().max(80).optional() }).optional(),
        preferredLanguage: z.enum(['pl', 'en', 'uk']).optional(),
      }),
    );
    const p = toPatientView(await fhir().read<Patient>('Patient', idFromRef(auth.patientRef)));
    // dane identyfikacyjne (imię, nazwisko, PESEL) zmienia wyłącznie placówka po weryfikacji dokumentu
    const saved = await updatePatient(actorOf(req), p.id, {
      given: p.given,
      family: p.family,
      birthDate: p.birthDate,
      gender: p.gender as 'male' | 'female' | undefined,
      pesel: p.pesel,
      email: p.email,
      phone: input.phone ?? p.phone,
      address: input.address ?? p.address,
      preferredLanguage: input.preferredLanguage ?? p.preferredLanguage,
    });
    return toPatientView(saved);
  });

  app.get('/api/me/dashboard', async (req) => {
    const auth = requirePatient(req);
    const [appointments, access, threads] = await Promise.all([
      listPatientAppointments(auth.patientRef),
      patientCanViewRecords(auth.patientRef),
      listThreadsForPatient(auth.patientRef, auth.user.id),
    ]);
    const now = Date.now();
    const upcoming = appointments.filter((a) => ['booked', 'arrived'].includes(a.status) && Date.parse(a.end) > now).sort((a, b) => a.start.localeCompare(b.start));
    const records = access.allowed ? await listPatientRecords(auth.patientRef, { onlyShared: true }) : [];
    const notifications = listNotifications(auth.user.id, 20);
    const pendingQuestionnaires = [];
    for (const a of upcoming) {
      if (a.questionnaireId && !(await responseForAppointment(a.id, auth.patientRef))) pendingQuestionnaires.push(a.id);
    }
    return {
      nextAppointment: upcoming[0] ?? null,
      upcomingCount: upcoming.length,
      unreadRecords: records.filter((r) => !r.readAt).length,
      recordsAccess: access,
      unreadMessages: threads.filter((t) => t.unread).length,
      unreadNotifications: notifications.filter((n) => !n.read_at).length,
      recentNotifications: notifications.slice(0, 5),
      pendingQuestionnaires,
    };
  });

  // --- wizyty ---------------------------------------------------------------------------------
  app.get('/api/me/appointments', async (req) => {
    const auth = requirePatient(req);
    return { items: await listPatientAppointments(auth.patientRef) };
  });

  app.get('/api/me/appointments/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const appt = await ownAppointment(id, auth.patientRef);
    const view = toAppointmentView(appt);
    const response = view.questionnaireId ? await responseForAppointment(id, auth.patientRef) : undefined;
    const service = view.serviceId ? await getService(view.serviceId).catch(() => undefined) : undefined;
    return {
      ...view,
      questionnaireDone: !!response,
      service,
      teleWindowOpen: view.mode === 'tele' ? teleWindowOpen(view.start, view.end) : false,
      clinic: { phone: getClinicSettings().phone, cancelMinHours: getClinicSettings().cancelMinHours },
    };
  });

  app.post('/api/me/appointments', async (req) => {
    const auth = requirePatient(req);
    requireVerifiedEmail(auth.user);
    const input = body(req, z.object({ slotId: zId, serviceId: zId, comment: z.string().max(500).optional() }));
    const service = await getService(input.serviceId);
    if (service.mode === 'tele' && !(await hasConsent(auth.patientRef, 'telemedicine'))) throw conflict('telemedicine_consent_required');
    return bookAppointment(actorOf(req), { ...input, patientRef: auth.patientRef, bookedBy: 'patient' });
  });

  app.post('/api/me/appointments/:id/cancel', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const { reason } = body(req, z.object({ reason: z.string().max(300).optional() }));
    await ownAppointment(id, auth.patientRef);
    return cancelAppointment(actorOf(req), { appointmentId: id, by: 'patient', patientRef: auth.patientRef, reason });
  });

  app.post('/api/me/appointments/:id/reschedule', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const { slotId } = body(req, z.object({ slotId: zId }));
    await ownAppointment(id, auth.patientRef);
    return rescheduleAppointment(actorOf(req), { appointmentId: id, newSlotId: slotId, by: 'patient', patientRef: auth.patientRef });
  });

  app.get('/api/me/appointments/:id/ics', async (req, replyObj) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const v = toAppointmentView(await ownAppointment(id, auth.patientRef));
    const s = getClinicSettings();
    const ics = appointmentIcs({
      uid: `${v.id}@eternal`,
      start: v.start,
      end: v.end,
      summary: `${v.mode === 'tele' ? 'Teleporada' : 'Wizyta'} — ${s.name}`,
      location: v.mode === 'tele' ? 'Online (link w aplikacji)' : (v.locationName ?? s.address),
      description: `${v.serviceName ?? ''}${v.practitionerName ? `, ${v.practitionerName}` : ''}`,
      url: `${config.publicUrl}/wizyty/${v.id}`,
      cancelled: v.status === 'cancelled',
    });
    replyObj.header('Content-Type', 'text/calendar; charset=utf-8').header('Content-Disposition', `attachment; filename="wizyta-${v.start.slice(0, 10)}.ics"`);
    return ics;
  });

  app.get('/api/me/appointments/:id/tele', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const appt = await ownAppointment(id, auth.patientRef);
    const room = teleRoomOf(appt);
    if (!room) throw badRequest('not_a_teleconsultation');
    if (appt.status !== 'booked' && appt.status !== 'arrived') throw conflict('appointment_not_active');
    if (!teleWindowOpen(appt.start ?? '', appt.end ?? '')) throw conflict('tele_window_closed');
    if (!(await hasConsent(auth.patientRef, 'telemedicine'))) throw conflict('telemedicine_consent_required');
    audit(actorOf(req), { action: 'E', subtype: 'tele-join', entityRef: `Appointment/${id}`, patientRef: auth.patientRef });
    return teleJoinInfo(room, { name: auth.user.display_name, id: auth.user.id, moderator: false });
  });

  app.get('/api/me/appointments/:id/questionnaire', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const v = toAppointmentView(await ownAppointment(id, auth.patientRef));
    if (!v.questionnaireId) throw notFound('no_questionnaire');
    const q = await getQuestionnaire(v.questionnaireId);
    const response = await responseForAppointment(id, auth.patientRef);
    return { questionnaire: q, response: response ?? null, canonical: canonicalOf(q) };
  });

  app.post('/api/me/appointments/:id/questionnaire', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const { answers } = body(req, z.object({ answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])) }));
    return submitResponse(actorOf(req), { patientRef: auth.patientRef, appointmentId: id, answers });
  });

  // --- lista oczekujących -----------------------------------------------------------------------
  app.get('/api/me/waitlist', async (req) => {
    const auth = requirePatient(req);
    return { items: listWaitlist(auth.patientRef) };
  });

  app.post('/api/me/waitlist', async (req) => {
    const auth = requirePatient(req);
    const input = body(req, z.object({ serviceId: zId, practitionerId: zId.optional(), beforeDate: zDate.optional() }));
    await getService(input.serviceId);
    const id = addToWaitlist({ ...input, patientRef: auth.patientRef, userId: auth.user.id });
    audit(actorOf(req), { action: 'C', subtype: 'waitlist-join', patientRef: auth.patientRef, detail: { serviceId: input.serviceId } });
    return { id };
  });

  app.delete('/api/me/waitlist/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    removeFromWaitlist(auth.patientRef, undefined, id);
    return { ok: true };
  });

  // --- wyniki i dokumenty -------------------------------------------------------------------------
  app.get('/api/me/records', async (req) => {
    const auth = requirePatient(req);
    const access = await patientCanViewRecords(auth.patientRef);
    if (!access.allowed) return { access, items: [] };
    const items = await listPatientRecords(auth.patientRef, { onlyShared: true });
    audit(actorOf(req), { action: 'R', subtype: 'records-list', patientRef: auth.patientRef });
    return { access, items };
  });

  app.get('/api/me/records/:kind/:id', async (req) => {
    const auth = requirePatient(req);
    const p = params(req, z.object({ kind: z.enum(['r', 'd']), id: zId }));
    const access = await patientCanViewRecords(auth.patientRef);
    if (!access.allowed) throw forbidden(access.reason);
    const ref = `${p.kind === 'r' ? 'DiagnosticReport' : 'DocumentReference'}/${p.id}`;
    const rec = await getRecord(ref, { patientRef: auth.patientRef });
    markRead(auth.user.id, ref);
    audit(actorOf(req), { action: 'R', subtype: 'record-read', entityRef: ref, patientRef: auth.patientRef });
    return { ...rec, readAt: rec.readAt ?? new Date().toISOString() };
  });

  app.get('/api/me/files/:id', async (req, replyObj) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const access = await patientCanViewRecords(auth.patientRef);
    if (!access.allowed) throw forbidden(access.reason);
    const file = await readBinaryFor(id, { patientRef: auth.patientRef });
    audit(actorOf(req), { action: 'R', subtype: 'file-download', entityRef: `Binary/${id}`, patientRef: auth.patientRef });
    replyObj
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .header('X-Content-Type-Options', 'nosniff');
    return file.data;
  });

  // --- wiadomości -------------------------------------------------------------------------------
  app.get('/api/me/threads', async (req) => {
    const auth = requirePatient(req);
    return { items: await listThreadsForPatient(auth.patientRef, auth.user.id) };
  });

  app.get('/api/me/threads/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const thread = await getThread(id, { patientRef: auth.patientRef, userId: auth.user.id });
    audit(actorOf(req), { action: 'R', subtype: 'thread-read', entityRef: `Communication/${id}`, patientRef: auth.patientRef });
    return thread;
  });

  app.post('/api/me/threads', async (req) => {
    const auth = requirePatient(req);
    messageLimiter.check(`msg:${auth.user.id}`);
    const input = body(req, z.object({ subject: z.string().max(120), category: z.enum(MESSAGE_CATEGORIES), body: z.string().max(2000) }));
    return startThreadAsPatient(actorOf(req), { ...input, patientRef: auth.patientRef });
  });

  app.post('/api/me/threads/:id/reply', async (req) => {
    const auth = requirePatient(req);
    messageLimiter.check(`msg:${auth.user.id}`);
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ body: z.string().max(2000) }));
    return reply(actorOf(req), { threadId: id, body: input.body, as: 'patient', patientRef: auth.patientRef });
  });

  // --- pomiary domowe ----------------------------------------------------------------------------
  const MeasurementSchema = z.object({
    kind: z.enum(['bp', 'heartRate', 'weight', 'height', 'temperature', 'spo2', 'glucose']),
    systolic: z.number().optional(),
    diastolic: z.number().optional(),
    value: z.number().optional(),
    pulse: z.number().optional(),
    effective: zIso.optional(),
    note: z.string().max(300).optional(),
    source: z.enum(['manual', 'bluetooth']).default('manual'),
    device: z.string().max(120).optional(),
  });

  app.get('/api/me/measurements', async (req) => {
    const auth = requirePatient(req);
    const q = query(req, z.object({ kind: MeasurementSchema.shape.kind.optional() }));
    return { items: await listMeasurements(auth.patientRef, q.kind), sharedWithClinic: await hasConsent(auth.patientRef, 'share-measurements') };
  });

  app.post('/api/me/measurements', async (req) => {
    const auth = requirePatient(req);
    const input = body(req, MeasurementSchema);
    return { items: await addMeasurement(actorOf(req), auth.patientRef, input) };
  });

  app.delete('/api/me/measurements/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    await retractMeasurement(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  // --- leki ------------------------------------------------------------------------------------
  app.get('/api/me/medications', async (req) => {
    const auth = requirePatient(req);
    return { items: await listMedications(auth.patientRef) };
  });

  app.post('/api/me/medications', async (req) => {
    const auth = requirePatient(req);
    const input = body(req, z.object({ name: z.string().max(200), rplId: z.string().max(40).optional(), dosage: z.string().max(200).optional(), since: z.string().max(10).optional() }));
    return addMedication(actorOf(req), auth.patientRef, input);
  });

  app.delete('/api/me/medications/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    const { error } = query(req, z.object({ error: z.enum(['1', '0']).optional() }));
    await stopMedication(actorOf(req), auth.patientRef, id, error === '1');
    return { ok: true };
  });

  app.get('/api/drugs', async (req) => {
    requireUser(req);
    const { q } = query(req, z.object({ q: z.string().max(80) }));
    return { items: searchMedicinalProducts(q) };
  });

  // --- zgody i prywatność --------------------------------------------------------------------------
  app.get('/api/me/consents', async (req) => {
    const auth = requirePatient(req);
    return { items: await getConsentStates(auth.patientRef) };
  });

  app.put('/api/me/consents/:type', async (req) => {
    const auth = requirePatient(req);
    const { type } = params(req, z.object({ type: z.string() }));
    if (!(type in CONSENT_TYPES)) throw notFound('unknown_consent');
    const { granted } = body(req, z.object({ granted: z.boolean() }));
    if (!granted && CONSENT_TYPES[type as ConsentType].required) throw badRequest('required_consent_cannot_be_withdrawn_here');
    await setConsent(actorOf(req), auth.patientRef, type as ConsentType, granted);
    return { items: await getConsentStates(auth.patientRef) };
  });

  app.get('/api/me/consents/:type/history', async (req) => {
    const auth = requirePatient(req);
    const { type } = params(req, z.object({ type: z.string() }));
    const state = (await getConsentStates(auth.patientRef)).find((c) => c.type === type);
    if (!state?.id) return { items: [] };
    return { items: await consentHistory(state.id) };
  });

  app.get('/api/me/access-log', async (req) => {
    const auth = requirePatient(req);
    return { items: accessLogForPatient(auth.patientRef) };
  });

  app.get('/api/me/export', async (req, replyObj) => {
    const auth = requirePatient(req);
    const bundle = await exportPatientBundle(actorOf(req), auth.patientRef);
    replyObj
      .header('Content-Type', 'application/fhir+json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="eternal-dane-${new Date().toISOString().slice(0, 10)}.json"`);
    return JSON.stringify(bundle, null, 2);
  });

  app.post('/api/me/delete-account', async (req) => {
    const auth = requirePatient(req);
    const { reason } = body(req, z.object({ reason: z.string().max(500).optional() }));
    await requestAccountDeletion(actorOf(req), auth.user, reason);
    return { ok: true };
  });

  // --- urządzenia: Withings ---------------------------------------------------------------------
  app.get('/api/me/integrations', async (req) => {
    const auth = requirePatient(req);
    return { withings: { available: withingsConfigured(), ...withingsStatus(auth.user.id) } };
  });

  app.post('/api/me/integrations/withings/connect', async (req) => {
    const auth = requirePatient(req);
    return { url: authorizeUrl(auth.user.id) };
  });

  app.post('/api/me/integrations/withings/sync', async (req) => {
    const auth = requirePatient(req);
    return syncWithings(actorOf(req), auth.user.id, auth.patientRef);
  });

  app.delete('/api/me/integrations/withings', async (req) => {
    const auth = requirePatient(req);
    disconnectWithings(auth.user.id);
    audit(actorOf(req), { action: 'D', subtype: 'withings-disconnect', patientRef: auth.patientRef });
    return { ok: true };
  });

  // --- NFZ: terminy leczenia (dane publiczne) ---------------------------------------------------------
  app.get('/api/nfz/provinces', async () => ({ items: Object.entries(PROVINCES).map(([code, name]) => ({ code, name })) }));

  app.get('/api/nfz/benefits', async (req) => {
    requireUser(req);
    publicApiLimiter.check(`nfz:${req.ip}`);
    const { name } = query(req, z.object({ name: z.string().max(80) }));
    return { items: await searchBenefits(name) };
  });

  app.get('/api/nfz/queues', async (req) => {
    requireUser(req);
    publicApiLimiter.check(`nfz:${req.ip}`);
    const q = query(
      req,
      z.object({
        benefit: z.string().max(120),
        province: z.string().regex(/^\d{2}$/),
        urgent: z.enum(['1', '0']).optional(),
        locality: z.string().max(80).optional(),
        page: z.coerce.number().int().min(1).max(50).optional(),
      }),
    );
    return searchQueues({ benefit: q.benefit, province: q.province, urgent: q.urgent === '1', locality: q.locality, page: q.page });
  });

  // pomocnicze: liczba nieprzeczytanych dla odznak w menu
  app.get('/api/me/badges', async (req) => {
    const auth = requirePatient(req);
    const n = getDb().prepare('SELECT COUNT(*) AS n FROM notification WHERE user_id = ? AND read_at IS NULL').get(auth.user.id) as { n: number };
    const threads = await listThreadsForPatient(auth.patientRef, auth.user.id);
    return { notifications: n.n, messages: threads.filter((t) => t.unread).length };
  });
}
