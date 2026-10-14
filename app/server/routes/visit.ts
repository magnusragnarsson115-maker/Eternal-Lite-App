import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requireClinician, requireStaff } from '../auth/sessions.js';
import { config } from '../config.js';
import { body, IdParams, params, query, zDate, zId } from '../lib/http.js';
import { localDate } from '../lib/time.js';
import { conflict, forbidden, notFound } from '../lib/util.js';
import { requireModule } from '../modules.js';
import { renderPdf } from '../pdf/render.js';
import { buildFacts, clinicNameFor, factsHtml } from '../services/facts.js';
import { requireGrantAccess, revokeGrant } from '../services/grants.js';
import { dayInbox, prepFor, sendDocsReminder, sharedPatients } from '../services/inbox.js';
import { clinicianConfirmObservations, intakeFile, listIntake, reviewIntake, rowById, submitIntake, toIntakeView, type IntakeContext } from '../services/intake.js';
import { createIntakeInvite, listInvites, revokeInvite } from '../services/invites.js';
import { staffOrgId } from '../services/orgs.js';
import { getAppointment, toAppointmentView } from '../services/scheduling.js';
import { currentOrgId } from '../tenancy.js';
import { ReviewSchema } from './link.js';

/**
 * Panel: przygotowanie wizyty — zaproszenie (D1), skrzynka materiałów i kompletność (D2), raport faktów (D3).
 * Rejestracja widzi statusy i kompletność, treść kliniczną (odczyty, raport) — tylko lekarz z aktywnym udostępnieniem.
 */

function orgOf(_req: FastifyRequest): string {
  const orgId = currentOrgId();
  if (!orgId) throw forbidden('no_organization');
  return orgId;
}

export async function visitRoutes(app: FastifyInstance): Promise<void> {
  // --- D2: lista wizyt dnia z kompletnością -------------------------------------------------------------
  app.get('/api/staff/inbox', async (req) => {
    const auth = requireStaff(req, ['practitioner', 'reception']);
    requireModule('inbox');
    const q = query(req, z.object({ date: zDate.optional(), practitionerId: zId.optional(), filter: z.enum(['all', 'missing']).default('all'), mine: z.coerce.boolean().optional() }));
    const date = q.date ?? localDate(new Date(), config.clinic.timezone);
    const own = q.mine && auth.user.fhir_ref?.startsWith('Practitioner/') ? auth.user.fhir_ref.split('/')[1] : undefined;
    const items = await dayInbox(date, { practitionerId: q.practitionerId ?? own, filter: q.filter });
    audit(actorOf(req), { action: 'R', subtype: 'inbox-list', detail: { date, count: items.length } });
    return { date, items };
  });

  app.get('/api/staff/appointments/:id/prep', async (req) => {
    const auth = requireStaff(req, ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    const appt = toAppointmentView(await getAppointment(id));
    const prep = await prepFor(appt);
    const clinical = auth.user.roles.includes('practitioner') && prep.sharing === 'shared';
    const intake = clinical ? listIntake({ patientRef: `Patient/${appt.patientId}` }).filter((r) => r.org_id === orgOf(req) || r.source === 'app').map((r) => toIntakeView(r, false)) : [];
    audit(actorOf(req), { action: 'R', subtype: 'visit-prep', entityRef: `Appointment/${id}`, patientRef: `Patient/${appt.patientId}` });
    return { prep, intake, invites: listInvites({ appointmentId: id }) };
  });

  // --- D1: zaproszenie linkiem albo kodem QR ---------------------------------------------------------------
  app.post('/api/staff/appointments/:id/invite', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    requireModule('invite');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ phone: z.string().max(20).optional(), send: z.boolean().default(true) }));
    const appt = toAppointmentView(await getAppointment(id));
    if (!appt.patientId) throw conflict('appointment_without_patient');
    return createIntakeInvite(actorOf(req), { patientId: appt.patientId, appointmentId: id, phone: input.phone, send: input.send });
  });

  app.post('/api/staff/patients/:id/invite', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    requireModule('invite');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ phone: z.string().max(20).optional(), send: z.boolean().default(true) }));
    return createIntakeInvite(actorOf(req), { patientId: id, phone: input.phone, send: input.send });
  });

  app.post('/api/staff/appointments/:id/remind-docs', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    requireModule('inbox');
    const { id } = params(req, IdParams);
    await getAppointment(id);
    return sendDocsReminder(actorOf(req), id, 'docs-manual');
  });

  app.post('/api/staff/invites/:id/revoke', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return revokeInvite(actorOf(req), id);
  });

  /** Pacjenci z udostępnieniem i datą wygaśnięcia (D1). */
  app.get('/api/staff/shared-patients', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    return { items: await sharedPatients(orgOf(req), actorOf(req)) };
  });

  app.post('/api/staff/grants/:id/end', async (req) => {
    requireStaff(req, ['practitioner', 'reception']);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    // klinika może zakończyć udostępnienie wcześniej (np. po wizycie) — nie może go przedłużyć
    return revokeGrant(actorOf(req), id, { orgId: orgOf(req) });
  });

  // --- materiały od pacjenta (lekarz, przy aktywnym udostępnieniu) -------------------------------------------
  const intakeAccess = (req: FastifyRequest, id: string) => {
    const auth = requireClinician(req);
    const row = rowById(id);
    if (!row) throw notFound('intake_not_found');
    if (row.org_id && row.org_id !== staffOrgId(auth.user) && row.source !== 'app') throw notFound('intake_not_found');
    const grants = requireGrantAccess(auth.user, row.patient_ref);
    return { auth, row, grants };
  };

  app.get('/api/staff/patients/:id/intake', async (req) => {
    const auth = requireClinician(req);
    const { id } = params(req, IdParams);
    const patientRef = `Patient/${id}`;
    requireGrantAccess(auth.user, patientRef);
    const items = listIntake({ patientRef }).filter((r) => r.org_id === orgOf(req) || r.source === 'app').map((r) => toIntakeView(r, false));
    audit(actorOf(req), { action: 'R', subtype: 'intake-list', patientRef, detail: { count: items.length } });
    return { items };
  });

  app.get('/api/staff/intake/:id', async (req) => {
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const { row } = intakeAccess(req, id);
    audit(actorOf(req), { action: 'R', subtype: 'intake-read', entityRef: row.document_ref ?? `urn:eternal:intake:${id}`, patientRef: row.patient_ref });
    return toIntakeView(row, true);
  });

  app.get('/api/staff/intake/:id/file', async (req, reply) => {
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const { row } = intakeAccess(req, id);
    const f = await intakeFile(row);
    audit(actorOf(req), { action: 'R', subtype: 'intake-file-read', entityRef: `Binary/${row.binary_id}`, patientRef: row.patient_ref });
    reply.header('Content-Type', f.contentType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
    return f.data;
  });

  /** Potwierdzenie albo poprawka pól przez lekarza (np. gdy pacjent nie zdążył). */
  app.post('/api/staff/intake/:id/confirm', async (req) => {
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const { row } = intakeAccess(req, id);
    const input = body(req, ReviewSchema.extend({ submit: z.boolean().default(true) }));
    const ctx: IntakeContext = {
      actor: actorOf(req),
      patientRef: row.patient_ref,
      orgId: row.org_id ?? undefined,
      appointmentId: row.appointment_id ?? undefined,
      source: row.source,
      confirmer: 'clinician',
    };
    if (row.status === 'submitted') return clinicianConfirmObservations(actorOf(req), row.patient_ref, id, input.items ?? []);
    const reviewed = reviewIntake(ctx, id, input);
    return input.submit ? submitIntake(ctx, id) : reviewed;
  });

  // --- D3: raport faktów -------------------------------------------------------------------------------
  const FactsQuery = z.object({ appointmentId: zId.optional() });

  app.get('/api/staff/patients/:id/facts', async (req) => {
    const auth = requireClinician(req);
    requireModule('facts');
    const { id } = params(req, IdParams);
    const q = query(req, FactsQuery);
    return buildFacts(auth.user, actorOf(req), { patientId: id, appointmentId: q.appointmentId });
  });

  app.get('/api/staff/patients/:id/facts.pdf', async (req, reply) => {
    const auth = requireClinician(req);
    requireModule('facts');
    const { id } = params(req, IdParams);
    const q = query(req, FactsQuery);
    const report = await buildFacts(auth.user, actorOf(req), { patientId: id, appointmentId: q.appointmentId });
    const pdf = await renderPdf(factsHtml(report, clinicNameFor(auth.user)), { footerLeft: `Raport faktów · ${report.patient.name} · ${report.templateVersion}` });
    audit(actorOf(req), { action: 'E', subtype: 'facts-report-pdf', patientRef: `Patient/${id}`, detail: { bytes: pdf.length } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="raport-faktow-${report.generatedAt.slice(0, 10)}.pdf"`);
    return pdf;
  });
}
