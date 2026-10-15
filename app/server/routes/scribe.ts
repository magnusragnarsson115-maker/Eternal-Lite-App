import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requireClinician, requirePatient } from '../auth/sessions.js';
import { consumeToken, findUserById, issueToken, peekToken } from '../auth/users.js';
import { config } from '../config.js';
import { body, params, query, zId } from '../lib/http.js';
import { badRequest, HttpError, notFound } from '../lib/util.js';
import { requireModule } from '../modules.js';
import { renderPdf } from '../pdf/render.js';
import { getTemplate, NOTE_TEMPLATES } from '../scribe/templates.js';
import { cardForLink, cardHtml, listCardShares, listPatientCards, patientCard, revokeCardShare, shareCard, shareCardByStaff } from '../services/cards.js';
import { getClinicSettings } from '../services/directory.js';
import { linkActor, qrSvg, resolveLink } from '../services/invites.js';
import { staffOrgId } from '../services/orgs.js';
import {
  amendNote,
  approveAndSendCard,
  approveNote,
  cancelSession,
  ehrExport,
  generateCard,
  listSessions,
  monthlyUsage,
  notePdfHtml,
  noteVersions,
  ownSession,
  saveCard,
  saveNote,
  scribeCapabilities,
  startManual,
  startSession,
  toScribeView,
  uploadAudio,
} from '../services/scribe.js';
import { runInScope } from '../tenancy.js';

/** Eternal Scribe (D5) i karta „Po wizycie” — panel lekarza, nagrywanie telefonem przez kod QR, link pacjenta. */

const SessionParams = z.object({ id: z.string().uuid() });
const AUDIO_LIMIT = 60 * 1024 * 1024;

const SectionsSchema = z
  .array(
    z.object({
      key: z.string().max(40),
      paragraphs: z.array(z.object({ id: z.string().max(80).optional(), text: z.string().max(4000), sources: z.array(z.string().max(10)).max(50).optional() })).max(60),
    }),
  )
  .max(20);

const CardSchema = z.object({
  whatWasDone: z.array(z.string().max(400)).max(12),
  nextSteps: z.array(z.string().max(400)).max(12),
  whenToReturn: z.string().max(300).nullable(),
  warningSigns: z.array(z.string().max(400)).max(12),
  erecipeCode: z.string().regex(/^\d{4}$/).optional().or(z.literal('').transform(() => undefined)),
});

async function readAudio(req: FastifyRequest): Promise<{ data: Buffer; contentType: string; seconds?: number }> {
  const file = await req.file({ limits: { fileSize: AUDIO_LIMIT, files: 1 } });
  if (!file) throw badRequest('file_required');
  const data = await file.toBuffer();
  if (file.file.truncated) throw badRequest('file_too_large');
  const secField = file.fields.seconds as { value?: string } | undefined;
  const seconds = secField?.value ? Number(secField.value) : undefined;
  return { data, contentType: file.mimetype, seconds: Number.isFinite(seconds) ? seconds : undefined };
}

export async function scribeRoutes(app: FastifyInstance): Promise<void> {
  const clinician = (req: FastifyRequest) => {
    const auth = requireClinician(req);
    requireModule('scribe');
    return auth;
  };

  app.get('/api/staff/scribe/config', async (req) => {
    const auth = clinician(req);
    const settings = getClinicSettings(staffOrgId(auth.user));
    return {
      templates: NOTE_TEMPLATES.filter((t) => settings.noteTemplates.includes(t.id)).map((t) => ({ id: t.id, name: t.name, version: t.version, sections: t.sections.map((s) => ({ key: s.key, title: s.title })) })),
      usage: monthlyUsage(auth.user.id),
      capabilities: scribeCapabilities(),
      retentionDays: settings.recordingRetentionDays,
      ehrLayout: settings.ehrLayout,
    };
  });

  app.get('/api/staff/scribe', async (req) => {
    const auth = clinician(req);
    const q = query(req, z.object({ appointmentId: zId.optional(), patientId: zId.optional() }));
    return { items: listSessions(auth.user, q) };
  });

  app.post('/api/staff/scribe', async (req) => {
    const auth = clinician(req);
    const input = body(req, z.object({ patientId: zId, appointmentId: zId.optional(), templateId: z.string().max(40), consent: z.literal(true), consentNote: z.string().max(300).optional() }));
    return startSession(auth.user, actorOf(req), input);
  });

  app.get('/api/staff/scribe/:id', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    audit(actorOf(req), { action: 'R', subtype: 'scribe-read', patientRef: row.patient_ref, detail: { session: id } });
    return toScribeView(row, { full: true });
  });

  app.post('/api/staff/scribe/:id/audio', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    const audio = await readAudio(req);
    return uploadAudio(row, actorOf(req), audio, audio.seconds);
  });

  app.get('/api/staff/scribe/:id/audio', async (req, reply) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    if (!row.audio_binary_id || row.audio_deleted_at) throw notFound('audio_not_available');
    const { fhirSystem } = await import('../fhir/index.js');
    const bin = await fhirSystem().readBinary(row.audio_binary_id);
    audit(actorOf(req), { action: 'R', subtype: 'scribe-audio-play', patientRef: row.patient_ref, detail: { session: id } });
    reply.header('Content-Type', row.audio_content_type ?? bin.contentType);
    return bin.data;
  });

  /** Nagrywanie telefonem: krótkotrwały link (kod QR) do strony nagrywania dla tej jednej sesji. */
  app.post('/api/staff/scribe/:id/phone-link', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    if (row.status !== 'consented') throw new HttpError(409, 'scribe_audio_already_uploaded');
    const token = issueToken('scribe-record', { userId: auth.user.id, payload: { sessionId: id }, ttlMinutes: 180 });
    const url = `${config.publicUrl}/nagranie/${token}`;
    audit(actorOf(req), { action: 'C', subtype: 'scribe-phone-link', patientRef: row.patient_ref, detail: { session: id } });
    return { url, qr: await qrSvg(url), expiresInMinutes: 180 };
  });

  app.post('/api/staff/scribe/:id/manual', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    return startManual(ownSession(auth.user, id), actorOf(req));
  });

  app.put('/api/staff/scribe/:id/note', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const { sections } = body(req, z.object({ sections: SectionsSchema }));
    return saveNote(ownSession(auth.user, id), actorOf(req), sections);
  });

  app.post('/api/staff/scribe/:id/approve', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    return approveNote(ownSession(auth.user, id), auth.user, actorOf(req));
  });

  app.post('/api/staff/scribe/:id/amend', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const input = body(req, z.object({ sections: SectionsSchema, reason: z.string().min(3).max(300) }));
    return amendNote(ownSession(auth.user, id), auth.user, actorOf(req), input.sections, input.reason);
  });

  app.get('/api/staff/scribe/:id/versions', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    return { items: await noteVersions(ownSession(auth.user, id)) };
  });

  app.get('/api/staff/scribe/:id/export', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    audit(actorOf(req), { action: 'E', subtype: 'scribe-ehr-copy', patientRef: row.patient_ref, detail: { session: id } });
    return ehrExport(row);
  });

  app.get('/api/staff/scribe/:id/pdf', async (req, reply) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    const pdf = await renderPdf(await notePdfHtml(row), { footerLeft: `Notatka z wizyty · ${getTemplate(row.template_id).version}` });
    audit(actorOf(req), { action: 'E', subtype: 'scribe-pdf', patientRef: row.patient_ref, detail: { session: id } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="notatka-${(row.approved_at ?? row.created_at).slice(0, 10)}.pdf"`);
    return pdf;
  });

  app.delete('/api/staff/scribe/:id', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    await cancelSession(ownSession(auth.user, id), actorOf(req));
    return { ok: true };
  });

  // --- karta „Po wizycie” -------------------------------------------------------------------------
  app.post('/api/staff/scribe/:id/card', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    return generateCard(ownSession(auth.user, id), actorOf(req));
  });

  app.put('/api/staff/scribe/:id/card', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    return saveCard(ownSession(auth.user, id), actorOf(req), body(req, CardSchema));
  });

  app.post('/api/staff/scribe/:id/card/send', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const input = body(req, z.object({ phone: z.string().max(20).optional() }));
    return approveAndSendCard(ownSession(auth.user, id), auth.user, actorOf(req), input);
  });

  app.post('/api/staff/scribe/:id/card/authorized', async (req) => {
    const auth = clinician(req);
    const { id } = params(req, SessionParams);
    const row = ownSession(auth.user, id);
    if (!row.card_ref) throw new HttpError(409, 'card_not_sent');
    const input = body(req, z.object({ phone: z.string().max(20), name: z.string().min(2).max(60), relation: z.string().min(2).max(30), basis: z.enum(['patient-authorization', 'art31-6']) }));
    return shareCardByStaff(actorOf(req), { orgId: row.org_id, patientRef: row.patient_ref, cardRef: row.card_ref, ...input });
  });

  // --- strona nagrywania na telefonie (bez logowania; token jednorazowy dla jednej sesji) ------------------
  app.get('/api/scribe-record/:token', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    const t = peekToken<{ sessionId: string }>('scribe-record', token);
    if (!t?.userId) throw new HttpError(410, 'link_expired');
    const user = findUserById(t.userId);
    if (!user || user.status !== 'active') throw new HttpError(410, 'link_expired');
    const row = ownSession(user, t.payload.sessionId);
    if (row.status !== 'consented') throw new HttpError(410, 'link_used');
    return { doctor: user.display_name, consentAt: row.consent_at, template: getTemplate(row.template_id).name };
  });

  app.post('/api/scribe-record/:token/audio', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    const t = peekToken<{ sessionId: string }>('scribe-record', token);
    if (!t?.userId) throw new HttpError(410, 'link_expired');
    const user = findUserById(t.userId);
    if (!user || user.status !== 'active') throw new HttpError(410, 'link_expired');
    const row = ownSession(user, t.payload.sessionId);
    const audio = await readAudio(req);
    if (!consumeToken('scribe-record', token)) throw new HttpError(410, 'link_used');
    const actor = { userId: user.id, actorRef: user.fhir_ref ?? undefined, display: user.display_name, roles: user.roles, ip: req.ip, userAgent: req.headers['user-agent'] };
    const view = await runInScope({ orgId: row.org_id }, () => uploadAudio(row, actor, audio, audio.seconds));
    return { status: view.status };
  });

  // --- karta pod linkiem z SMS (pacjent bez aplikacji, osoba bliska) ---------------------------------------
  app.get('/api/card/:token', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    const row = resolveLink(token, ['after-visit', 'card-share']);
    const card = await cardForLink(row);
    audit(linkActor(req, row, row.purpose === 'card-share' ? 'Osoba upoważniona (link)' : 'Pacjent (link z SMS)'), { action: 'R', subtype: 'card-open', entityRef: card.ref, patientRef: row.patient_ref, detail: { link: row.id, purpose: row.purpose } });
    return { ...card, purpose: row.purpose, expiresAt: row.expires_at, demo: config.demoMode };
  });

  app.get('/api/card/:token/pdf', async (req, reply) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    const row = resolveLink(token, ['after-visit', 'card-share']);
    const card = await cardForLink(row);
    const pdf = await renderPdf(cardHtml(card), { footerLeft: `Karta „Po wizycie” · ${card.clinic}` });
    audit(linkActor(req, row), { action: 'E', subtype: 'card-pdf', entityRef: card.ref, patientRef: row.patient_ref, detail: { link: row.id } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename="karta-po-wizycie.pdf"');
    return pdf;
  });

  // --- karty w aplikacji pacjenta (MVP) ------------------------------------------------------------
  app.get('/api/me/cards', async (req) => {
    const auth = requirePatient(req);
    return { items: await listPatientCards(auth.patientRef) };
  });

  app.get('/api/me/cards/:id', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, z.object({ id: zId }));
    const { view } = await patientCard(auth.patientRef, id);
    audit(actorOf(req), { action: 'R', subtype: 'card-read', entityRef: view.ref, patientRef: auth.patientRef });
    return { ...view, shares: listCardShares(auth.patientRef, id) };
  });

  app.get('/api/me/cards/:id/pdf', async (req, reply) => {
    const auth = requirePatient(req);
    const { id } = params(req, z.object({ id: zId }));
    const { view } = await patientCard(auth.patientRef, id);
    const pdf = await renderPdf(cardHtml(view), { footerLeft: `Karta „Po wizycie” · ${view.clinic}` });
    audit(actorOf(req), { action: 'E', subtype: 'card-pdf', entityRef: view.ref, patientRef: auth.patientRef });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename="karta-po-wizycie.pdf"');
    return pdf;
  });

  app.post('/api/me/cards/:id/share', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, z.object({ id: zId }));
    const input = body(req, z.object({ days: z.number().int().min(1).max(30), phone: z.string().max(20).optional(), label: z.string().max(80).optional() }));
    return shareCard(actorOf(req), auth.patientRef, id, input);
  });

  app.delete('/api/me/cards/:id/shares/:shareId', async (req) => {
    const auth = requirePatient(req);
    const p = params(req, z.object({ id: zId, shareId: z.string().uuid() }));
    revokeCardShare(actorOf(req), auth.patientRef, p.shareId);
    return { ok: true };
  });
}
