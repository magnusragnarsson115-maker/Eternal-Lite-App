import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requireClinician, requirePatient, requireStaff } from '../auth/sessions.js';
import { approveTree, INTERVIEW_IDS } from '../content/interviews.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { body, IdParams, params, query, zDate, zId } from '../lib/http.js';
import { badRequest, notFound } from '../lib/util.js';
import { requireModule } from '../modules.js';
import { NOTE_FORMATS } from '../scribe/templates.js';
import { cardForIdToken, createIdLink, getInsurance, listIdLinks, nfcText, revokeIdLink, setInsurance, setNfcChoice } from '../services/eternalId.js';
import { activeGrantsFor } from '../services/grants.js';
import { listCorrections, listIntake, mappingCorrectionsCsv } from '../services/intake.js';
import { qrSvg } from '../services/invites.js';
import { answerInterview, availableInterviews, backInterview, getInterview, interviewsForStaff, listInterviews, startInterview } from '../services/interview.js';
import { staffOrgId } from '../services/orgs.js';
import { createDocument, registerUpload } from '../services/records.js';
import { getAppointment, toAppointmentView } from '../services/scheduling.js';
import { editSegment, formatNote, ownSession, PARTICIPANT_ROLES, regenerateSection, sectionAction, setParticipants, transcriptEdits } from '../services/scribe.js';
import {
  AVATAR_REGIONS,
  avatarFor,
  buildSnapshot,
  buildTimeline,
  collectForPatient,
  collectForStaff,
  eternalIdFor,
  getDisplayFilter,
  resultDetail,
  setDisplayFilter,
  TIMELINE_CATEGORIES,
  whatChanged,
} from '../services/snapshot.js';
import { CASE_SOURCES, CASE_STATUSES, caseOwners, createCase, getCase, listCases, updateCase, visitCompleteness, workspaceQueue } from '../services/workspace.js';

/**
 * Runda 5: przestrzeń pracy lekarza (kolejka, sprawy), Medical Snapshot z pochodzeniem wartości, oś czasu,
 * „Co się zmieniło”, avatar danych, rejestr poprawek odczytu, rozszerzenia Scribe, wywiad czatowy i Eternal ID.
 * Każdy odczyt danych pacjenta przechodzi przez audit() (w usługach albo tutaj).
 */

const Categories = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v.split(',').filter((c): c is (typeof TIMELINE_CATEGORIES)[number] => (TIMELINE_CATEGORIES as readonly string[]).includes(c)) : undefined));

const SegmentParams = z.object({ id: z.string().uuid(), segmentId: z.string().max(20) });
const SectionParams = z.object({ id: z.string().uuid(), key: z.string().max(40) });

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  const staff = (req: FastifyRequest, module = 'workspace') => {
    const auth = requireStaff(req);
    requireModule(module, { orgId: staffOrgId(auth.user) });
    return auth;
  };
  const clinician = (req: FastifyRequest, module = 'medical-snapshot') => {
    const auth = requireClinician(req);
    requireModule(module, { orgId: staffOrgId(auth.user) });
    return auth;
  };
  const patient = (req: FastifyRequest, module: string) => {
    const auth = requirePatient(req);
    requireModule(module, { subject: auth.user.id });
    return auth;
  };

  // --- kolejka i sprawy -------------------------------------------------------------------------------------------
  app.get('/api/staff/workspace', async (req) => {
    const auth = staff(req);
    const q = query(req, z.object({ scope: z.enum(['mine', 'all']).default('mine') }));
    const practitionerId = q.scope === 'mine' && auth.user.fhir_ref?.startsWith('Practitioner/') ? idFromRef(auth.user.fhir_ref) : undefined;
    return workspaceQueue(auth.user, actorOf(req), { practitionerId });
  });

  app.get('/api/staff/cases', async (req) => {
    const auth = staff(req);
    const q = query(req, z.object({ patientId: zId.optional(), includeClosed: z.enum(['1', '0']).optional() }));
    const items = listCases(auth.user, { patientId: q.patientId, includeClosed: q.includeClosed === '1' });
    if (q.patientId) audit(actorOf(req), { action: 'R', subtype: 'case-list', patientRef: `Patient/${q.patientId}` });
    return { items, statuses: CASE_STATUSES };
  });

  app.get('/api/staff/case-owners', async (req) => {
    const auth = staff(req);
    return { items: caseOwners(auth.user) };
  });

  app.post('/api/staff/cases', async (req) => {
    const auth = staff(req);
    const input = body(
      req,
      z.object({
        patientId: zId,
        title: z.string().min(1).max(160),
        status: z.enum(CASE_STATUSES).optional(),
        priority: z.enum(['normal', 'urgent']).optional(),
        ownerUserId: z.string().max(64).nullable().optional(),
        source: z.enum(CASE_SOURCES).optional(),
        sourceRef: z.string().max(200).optional(),
        appointmentId: zId.optional(),
        dueDate: zDate.optional(),
        note: z.string().max(1000).optional(),
      }),
    );
    return createCase(auth.user, actorOf(req), input);
  });

  app.get('/api/staff/cases/:id', async (req) => {
    const auth = staff(req);
    const { id } = params(req, IdParams);
    return getCase(auth.user, actorOf(req), id);
  });

  app.put('/api/staff/cases/:id', async (req) => {
    const auth = staff(req);
    const { id } = params(req, IdParams);
    const patch = body(
      req,
      z.object({
        status: z.enum(CASE_STATUSES).optional(),
        ownerUserId: z.string().max(64).nullable().optional(),
        priority: z.enum(['normal', 'urgent']).optional(),
        dueDate: zDate.nullable().optional(),
        note: z.string().max(1000).optional(),
        comment: z.string().max(300).optional(),
      }),
    );
    return updateCase(auth.user, actorOf(req), id, patch);
  });

  app.get('/api/staff/appointments/:id/completeness', async (req) => {
    staff(req);
    const { id } = params(req, IdParams);
    const appt = toAppointmentView(await getAppointment(id));
    if (!appt.patientId) throw notFound('appointment_not_found');
    audit(actorOf(req), { action: 'R', subtype: 'visit-completeness', entityRef: `Appointment/${id}`, patientRef: `Patient/${appt.patientId}` });
    return visitCompleteness(appt);
  });

  // --- Medical Snapshot, oś czasu, „Co się zmieniło”, avatar --------------------------------------------------------
  app.get('/api/staff/patients/:id/snapshot', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, IdParams);
    const data = await collectForStaff(auth.user, actorOf(req), id);
    audit(actorOf(req), { action: 'R', subtype: 'snapshot-read', patientRef: data.patientRef });
    const filter = getDisplayFilter(auth.user.id);
    return { snapshot: buildSnapshot(data), avatar: avatarFor(data), whatChanged: whatChanged(data, { filter }) };
  });

  app.get('/api/staff/patients/:id/snapshot/result', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, IdParams);
    const q = query(req, z.object({ key: z.string().min(1).max(200) }));
    const data = await collectForStaff(auth.user, actorOf(req), id);
    const detail = await resultDetail(data, q.key);
    audit(actorOf(req), { action: 'R', subtype: 'result-provenance', patientRef: data.patientRef, detail: { key: q.key } });
    return detail;
  });

  app.get('/api/staff/patients/:id/health-timeline', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, IdParams);
    const q = query(req, z.object({ categories: Categories, from: zDate.optional(), to: zDate.optional() }));
    const data = await collectForStaff(auth.user, actorOf(req), id);
    audit(actorOf(req), { action: 'R', subtype: 'health-timeline', patientRef: data.patientRef });
    return { items: buildTimeline(data, q), categories: TIMELINE_CATEGORIES };
  });

  app.get('/api/staff/patients/:id/what-changed', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, IdParams);
    const q = query(req, z.object({ since: zDate.optional() }));
    const data = await collectForStaff(auth.user, actorOf(req), id);
    audit(actorOf(req), { action: 'R', subtype: 'what-changed', patientRef: data.patientRef });
    return whatChanged(data, { since: q.since, filter: getDisplayFilter(auth.user.id) });
  });

  app.get('/api/staff/display-filter', async (req) => {
    const auth = clinician(req);
    return getDisplayFilter(auth.user.id);
  });

  app.put('/api/staff/display-filter', async (req) => {
    const auth = clinician(req);
    const input = body(req, z.object({ bpSystolic: z.number().optional(), bpDiastolic: z.number().optional(), glucose: z.number().optional() }));
    return setDisplayFilter(actorOf(req), auth.user.id, input);
  });

  /** Rejestr poprawek odczytu dokumentów pacjenta — tylko dokumenty przekazane tej placówce albo przy udostępnieniu. */
  app.get('/api/staff/patients/:id/corrections', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, IdParams);
    const patientRef = `Patient/${id}`;
    const orgId = staffOrgId(auth.user);
    if (!(await fhir().readOptional('Patient', id))) throw notFound('patient_not_found');
    const shared = orgId ? activeGrantsFor(orgId, patientRef).length > 0 : false;
    const visible = new Set(listIntake({ patientRef }).filter((r) => r.org_id === orgId || shared).map((r) => r.id));
    audit(actorOf(req), { action: 'R', subtype: 'extraction-corrections', patientRef });
    return { items: listCorrections({ patientRef }).filter((c) => visible.has(c.intakeId)) };
  });

  app.get('/api/staff/patients/:id/interviews', async (req) => {
    const auth = clinician(req, 'interviews');
    const { id } = params(req, IdParams);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw badRequest('org_required');
    return { items: interviewsForStaff(actorOf(req), orgId, id) };
  });

  /** Dokumentacja fotograficzna (np. zmiany skórne) za zgodą pacjenta — zapis, bez jakiejkolwiek analizy obrazu. */
  app.post('/api/staff/patients/:id/photos', async (req) => {
    const auth = requireClinician(req);
    requireModule('medical-snapshot', { orgId: staffOrgId(auth.user) });
    const { id } = params(req, IdParams);
    const file = await req.file({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    if (!file) throw badRequest('file_required');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    const field = (k: string) => (file.fields[k] as { value?: string } | undefined)?.value;
    if (field('consent') !== 'true') throw badRequest('consent_required');
    const region = field('region');
    if (region && !(AVATAR_REGIONS as readonly string[]).includes(region) && region.length > 40) throw badRequest('invalid_value');
    const upload = await registerUpload(actorOf(req), { data, filename: file.filename, contentType: file.mimetype });
    if (!upload.contentType.startsWith('image/')) throw badRequest('unsupported_file_type');
    const note = field('note')?.slice(0, 1000);
    return createDocument(actorOf(req), {
      patientId: id,
      title: `Dokumentacja fotograficzna${region ? ` — ${region}` : ''}`.slice(0, 200),
      kind: 'photo',
      binaryId: upload.binaryId,
      text: note,
      appointmentId: field('appointmentId') || undefined,
      bodyRegion: region || undefined,
    });
  });

  // --- Scribe: uczestnicy, transkrypcja, sekcje, formaty ----------------------------------------------------------
  const scribe = (req: FastifyRequest) => {
    const auth = requireClinician(req);
    requireModule('scribe');
    return auth;
  };

  app.put('/api/staff/scribe/:id/participants', async (req) => {
    const auth = scribe(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const input = body(req, z.object({ participants: z.array(z.object({ role: z.enum(PARTICIPANT_ROLES), name: z.string().max(80).optional(), speaker: z.string().max(40).optional() })).max(8) }));
    return setParticipants(ownSession(auth.user, id), actorOf(req), input.participants);
  });

  app.put('/api/staff/scribe/:id/transcript/:segmentId', async (req) => {
    const auth = scribe(req);
    const { id, segmentId } = params(req, SegmentParams);
    const input = body(req, z.object({ text: z.string().max(2000).optional(), speaker: z.string().max(40).optional() }));
    return editSegment(ownSession(auth.user, id), auth.user, actorOf(req), segmentId, input);
  });

  app.get('/api/staff/scribe/:id/transcript-edits', async (req) => {
    const auth = scribe(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const row = ownSession(auth.user, id);
    audit(actorOf(req), { action: 'R', subtype: 'scribe-transcript-edits', patientRef: row.patient_ref, detail: { session: id } });
    return { items: transcriptEdits(row) };
  });

  app.post('/api/staff/scribe/:id/sections/:key', async (req) => {
    const auth = scribe(req);
    const { id, key } = params(req, SectionParams);
    const input = body(req, z.object({ action: z.enum(['accept', 'reject', 'reset']) }));
    return sectionAction(ownSession(auth.user, id), actorOf(req), key, input.action);
  });

  app.post('/api/staff/scribe/:id/sections/:key/regenerate', async (req) => {
    const auth = scribe(req);
    const { id, key } = params(req, SectionParams);
    return regenerateSection(ownSession(auth.user, id), actorOf(req), key);
  });

  app.get('/api/staff/scribe/:id/format/:format', async (req) => {
    const auth = scribe(req);
    const { id, format } = params(req, z.object({ id: z.string().uuid(), format: z.enum(NOTE_FORMATS) }));
    const row = ownSession(auth.user, id);
    audit(actorOf(req), { action: 'R', subtype: 'scribe-format', patientRef: row.patient_ref, detail: { session: id, format } });
    return formatNote(row, auth.user, format);
  });

  // --- administrator: eksport poprawek dla słownika mapowania ------------------------------------------------------
  app.get('/api/admin/mapping-corrections.csv', async (req, reply) => {
    requireStaff(req, ['admin']);
    const q = query(req, z.object({ since: zDate.optional() }));
    const csv = mappingCorrectionsCsv(q.since);
    audit(actorOf(req), { action: 'E', subtype: 'mapping-corrections-export', detail: { rows: csv.split('\n').length - 1 } });
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="poprawki-mapowania.csv"');
    return `﻿${csv}`;
  });

  app.post('/api/admin/interviews/:id/approve', async (req) => {
    requireStaff(req, ['admin']);
    const { id } = params(req, z.object({ id: z.enum(INTERVIEW_IDS as [string, ...string[]]) }));
    const input = body(req, z.object({ approvedBy: z.string().min(5).max(160) }));
    return approveTree(actorOf(req), id, input.approvedBy);
  });

  // --- pacjent: snapshot, avatar, oś czasu, zmiany, poprawki ---------------------------------------------------------
  app.get('/api/me/health-snapshot', async (req) => {
    const auth = patient(req, 'patient-avatar');
    const data = await collectForPatient(actorOf(req), auth.patientRef);
    audit(actorOf(req), { action: 'R', subtype: 'snapshot-read', patientRef: auth.patientRef });
    return { snapshot: buildSnapshot(data), avatar: avatarFor(data), whatChanged: whatChanged(data) };
  });

  app.get('/api/me/health-timeline', async (req) => {
    const auth = patient(req, 'patient-avatar');
    const q = query(req, z.object({ categories: Categories, from: zDate.optional(), to: zDate.optional() }));
    const data = await collectForPatient(actorOf(req), auth.patientRef);
    audit(actorOf(req), { action: 'R', subtype: 'health-timeline', patientRef: auth.patientRef });
    return { items: buildTimeline(data, q), categories: TIMELINE_CATEGORIES };
  });

  app.get('/api/me/health-snapshot/result', async (req) => {
    const auth = patient(req, 'patient-avatar');
    const q = query(req, z.object({ key: z.string().min(1).max(200) }));
    const data = await collectForPatient(actorOf(req), auth.patientRef);
    audit(actorOf(req), { action: 'R', subtype: 'result-provenance', patientRef: auth.patientRef, detail: { key: q.key } });
    return resultDetail(data, q.key);
  });

  app.get('/api/me/corrections', async (req) => {
    const auth = requirePatient(req);
    audit(actorOf(req), { action: 'R', subtype: 'extraction-corrections', patientRef: auth.patientRef });
    return { items: listCorrections({ patientRef: auth.patientRef }) };
  });

  // --- pacjent: wywiad czatowy ---------------------------------------------------------------------------------------
  app.get('/api/me/interviews', async (req) => {
    const auth = patient(req, 'interviews');
    return { available: availableInterviews(), items: listInterviews(auth.patientRef) };
  });

  app.post('/api/me/interviews', async (req) => {
    const auth = patient(req, 'interviews');
    const input = body(req, z.object({ treeId: z.string().max(40), appointmentId: zId.optional() }));
    return startInterview(actorOf(req), auth.patientRef, input);
  });

  app.get('/api/me/interviews/:id', async (req) => {
    const auth = patient(req, 'interviews');
    const { id } = params(req, IdParams);
    return getInterview(actorOf(req), auth.patientRef, id);
  });

  app.post('/api/me/interviews/:id/answer', async (req) => {
    const auth = patient(req, 'interviews');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ nodeId: z.string().max(40), value: z.union([z.string().max(1000), z.number(), z.array(z.string().max(40)).max(20), z.null()]) }));
    return answerInterview(actorOf(req), auth.patientRef, id, input);
  });

  app.post('/api/me/interviews/:id/back', async (req) => {
    const auth = patient(req, 'interviews');
    const { id } = params(req, IdParams);
    return backInterview(actorOf(req), auth.patientRef, id);
  });

  // --- pacjent: Eternal ID -------------------------------------------------------------------------------------------
  app.get('/api/me/eternal-id', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('eternal-id', { subject: auth.user.id });
    audit(actorOf(req), { action: 'R', subtype: 'eternal-id', patientRef: auth.patientRef });
    return { eternalId: eternalIdFor(auth.patientRef), insurance: getInsurance(auth.user.id), nfc: await nfcText(auth.user.id, auth.patientRef), links: listIdLinks(auth.patientRef) };
  });

  app.put('/api/me/eternal-id/insurance', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('eternal-id', { subject: auth.user.id });
    const input = body(req, z.object({ provider: z.string().max(80).optional(), policyNumber: z.string().max(40).optional(), assistancePhone: z.string().max(30).optional(), ehicNumber: z.string().max(30).optional(), validUntil: z.string().max(10).optional() }));
    return setInsurance(actorOf(req), auth.user.id, auth.patientRef, input);
  });

  app.put('/api/me/eternal-id/nfc', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('eternal-id', { subject: auth.user.id });
    const input = body(req, z.object({ name: z.boolean(), birthYear: z.boolean(), allergies: z.boolean(), medications: z.boolean(), conditions: z.boolean(), contact: z.boolean(), insurance: z.boolean() }).partial());
    setNfcChoice(actorOf(req), auth.user.id, auth.patientRef, input);
    return nfcText(auth.user.id, auth.patientRef);
  });

  app.post('/api/me/eternal-id/links', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('eternal-id', { subject: auth.user.id });
    const input = body(req, z.object({ days: z.number().int().min(1).max(730), label: z.string().max(60).optional() }));
    const created = createIdLink(actorOf(req), auth.patientRef, input);
    return { ...created, qr: await qrSvg(created.url) };
  });

  app.delete('/api/me/eternal-id/links/:id', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    const { id } = params(req, IdParams);
    revokeIdLink(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  app.get('/api/eternal-id/:token', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    return cardForIdToken(token, actorOf(req));
  });

}
