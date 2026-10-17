import type { Appointment, DiagnosticReport, DocumentReference, Observation, Organization, Practitioner, Provenance } from '@medplum/fhirtypes';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { verifyPassword } from '../auth/passwords.js';
import { actorOf, destroySession, requireClinician, requirePatient } from '../auth/sessions.js';
import { ETERNAL, LOINC, TRUST } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { provenanceFor } from '../fhir/provenance.js';
import { idFromRef } from '../fhir/repository.js';
import { body, IdParams, params, query, zId } from '../lib/http.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/util.js';
import { requireModule } from '../modules.js';
import { renderPdf } from '../pdf/render.js';
import { confirmationHtml, deleteMyData } from '../services/deletion.js';
import { createGrant, listGrantsForPatient, revokeGrant, type GrantScope } from '../services/grants.js';
import { getIntake, intakeFile, KIND_LABEL, listIntake, reviewIntake, submitIntake, toIntakeView, uploadIntake, type IntakeContext } from '../services/intake.js';
import { confirmIntake, createSchedule, deleteSchedule, listIntakeLog, listSchedules, setScheduleActive, setScheduleStock } from '../services/medReminders.js';
import { getNotifyPrefs, NOTIFY_KINDS, savePushSubscription, setNotifyPrefs } from '../services/notifications.js';
import { commitImport, previewImport } from '../services/measurementImport.js';
import { correctMeasurement, observationVersions } from '../services/observations.js';
import { exportCsv, measurementsForExport, patientLabFacts } from '../services/patientData.js';
import { listOrganizations } from '../services/orgs.js';
import { buildPeriodReport, latestFacts, periodBounds, periodReportHtml } from '../services/periodReport.js';
import { readableAnswers } from '../services/questionnaires.js';
import { answersOf, deferSurvey, healthResponses, noteReportViewed, questionnaireOf, submitSurvey, surveyDef, surveyIdOf, surveysFor } from '../services/surveys.js';
import { getClinicSettings } from '../services/directory.js';
import { patientCanViewRecords } from '../services/records.js';
import { addContact, cardForSosToken, emergencyCard, getEmergencyInfo, listContacts, removeContact, setEmergencyInfo, triggerSos } from '../services/safety.js';
import { ORG_TAG_SYSTEM, orgIdsOf, vaultOrgId } from '../tenancy.js';
import { ReviewSchema } from './link.js';

/**
 * Aplikacja pacjenta — MVP (P1–P4, P8, P14): dokumenty z odczytem w aplikacji, oś czasu z wersjami,
 * udostępnianie na czas, korekta wpisów, preferencje powiadomień, SOS i karta ratunkowa, przypomnienia o lekach,
 * usunięcie danych z potwierdzeniem.
 */

const KindEnum = z.enum(['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other']);

function intakeCtx(req: FastifyRequest, patientRef: string): IntakeContext {
  return { actor: actorOf(req), patientRef, source: 'app', confirmer: 'patient' };
}

const ScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('results') }),
  z.object({ kind: z.literal('documents') }),
  z.object({ kind: z.literal('selected'), refs: z.array(z.string().regex(/^(DocumentReference|DiagnosticReport)\/[A-Za-z0-9\-.]{1,64}$/)).min(1).max(100) }),
]);

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const patient = (req: FastifyRequest, module?: string) => {
    const auth = requirePatient(req);
    if (module) requireModule(module, { subject: auth.user.id });
    return auth;
  };

  // --- dokumenty i odczyt w aplikacji (P3) -------------------------------------------------------------
  app.post('/api/me/intake', async (req) => {
    const auth = patient(req, 'patient-intake');
    const file = await req.file();
    if (!file) throw badRequest('file_required');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    const hint = KindEnum.optional().parse((file.fields.kind as { value?: string } | undefined)?.value || undefined);
    return uploadIntake(intakeCtx(req, auth.patientRef), { data, filename: file.filename, contentType: file.mimetype }, hint);
  });

  app.get('/api/me/intake', async (req) => {
    const auth = patient(req, 'patient-intake');
    return { items: listIntake({ patientRef: auth.patientRef }).map((r) => toIntakeView(r, false)) };
  });

  app.get('/api/me/intake/:id', async (req) => {
    const auth = patient(req, 'patient-intake');
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return toIntakeView(getIntake(id, { patientRef: auth.patientRef }), true);
  });

  app.post('/api/me/intake/:id/review', async (req) => {
    const auth = patient(req, 'patient-intake');
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return reviewIntake(intakeCtx(req, auth.patientRef), id, body(req, ReviewSchema));
  });

  app.post('/api/me/intake/:id/submit', async (req) => {
    const auth = patient(req, 'patient-intake');
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return submitIntake(intakeCtx(req, auth.patientRef), id);
  });

  app.get('/api/me/intake/:id/file', async (req, reply) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const f = await intakeFile(getIntake(id, { patientRef: auth.patientRef }));
    reply.header('Content-Type', f.contentType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
    return f.data;
  });

  /** Moje dokumenty (sejf): wgrane przeze mnie, z rodzajem i datą; karta „Po wizycie” osobno (/api/me/cards). */
  app.get('/api/me/documents', async (req) => {
    const auth = patient(req);
    const docs = await fhirSystem().search<DocumentReference>('DocumentReference', { subject: auth.patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(auth.patientRef)}`, status: 'current', _count: '500' });
    const items = docs
      .filter((d) => d.meta?.tag?.find((t) => t.system === ETERNAL.intakeKind)?.code !== 'after-visit')
      .map((d) => {
        const kind = (d.meta?.tag?.find((t) => t.system === ETERNAL.intakeKind)?.code ?? 'other') as keyof typeof KIND_LABEL;
        return { id: d.id, ref: `DocumentReference/${d.id}`, kind, kindLabel: KIND_LABEL[kind] ?? 'Dokument', title: d.description ?? '', date: d.context?.period?.start ?? d.date, binaryId: d.content[0]?.attachment.url ? idFromRef(d.content[0].attachment.url) : undefined, contentType: d.content[0]?.attachment.contentType };
      })
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return { items };
  });

  app.get('/api/me/documents/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, IdParams);
    const d = await fhirSystem().readOptional<DocumentReference>('DocumentReference', id);
    if (!d || d.subject?.reference !== auth.patientRef || !orgIdsOf(d).includes(vaultOrgId(auth.patientRef))) throw notFound('document_not_found');
    const text = d.content.find((c) => c.attachment.contentType?.startsWith('text/plain'))?.attachment.data;
    const reportRef = (await fhirSystem().search<DiagnosticReport>('DiagnosticReport', { subject: auth.patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(auth.patientRef)}` })).find((r) =>
      r.extension?.some((e) => e.valueReference?.reference === `DocumentReference/${id}`),
    );
    return {
      id: d.id,
      title: d.description,
      date: d.context?.period?.start ?? d.date,
      text: text ? Buffer.from(text, 'base64').toString('utf8') : undefined,
      binaryId: d.content[0]?.attachment.url ? idFromRef(d.content[0].attachment.url) : undefined,
      accessCode: d.extension?.find((e) => e.url === 'urn:eternal:ext:access-code')?.valueString,
      reportId: reportRef?.id,
      provenance: (await provenanceFor(`DocumentReference/${id}`)).map(provView),
    };
  });

  app.get('/api/me/documents/:id/file', async (req, reply) => {
    const auth = patient(req);
    const { id } = params(req, IdParams);
    const d = await fhirSystem().readOptional<DocumentReference>('DocumentReference', id);
    if (!d || d.subject?.reference !== auth.patientRef || !orgIdsOf(d).includes(vaultOrgId(auth.patientRef))) throw notFound('document_not_found');
    const url = d.content[0]?.attachment.url;
    if (!url) throw notFound('file_not_found');
    const bin = await fhirSystem().readBinary(idFromRef(url));
    reply.header('Content-Type', d.content[0].attachment.contentType ?? bin.contentType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(d.content[0].attachment.title ?? 'dokument')}`);
    return bin.data;
  });

  // --- oś czasu wyników z wersjami (A2.5) ----------------------------------------------------------------
  app.get('/api/me/timeline', async (req) => {
    const auth = patient(req);
    return { items: await patientLabFacts(auth.patientRef) };
  });

  // --- import pomiarów z pliku (A1.6) i eksport CSV (A2.6) --------------------------------------------------
  const ImportBody = z.object({ content: z.string().min(1).max(3_000_000), fileName: z.string().max(200).optional() });
  app.post('/api/me/measurements/import/preview', async (req) => {
    const auth = patient(req, 'manual-entries');
    const input = body(req, ImportBody);
    return previewImport(auth.patientRef, input.content);
  });

  app.post('/api/me/measurements/import', async (req) => {
    const auth = patient(req, 'manual-entries');
    const input = body(req, ImportBody);
    return commitImport(actorOf(req), auth.patientRef, input.content, input.fileName);
  });

  app.get('/api/me/export.csv', async (req, reply) => {
    const auth = patient(req);
    const range = query(req, z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }));
    const [measurements, labs] = await Promise.all([measurementsForExport(auth.patientRef), patientLabFacts(auth.patientRef)]);
    audit(actorOf(req), { action: 'E', subtype: 'patient-export-csv', patientRef: auth.patientRef, detail: { from: range.from, to: range.to } });
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="eternal-dane-${new Date().toISOString().slice(0, 10)}.csv"`);
    return exportCsv(measurements, labs, range);
  });

  // --- pulpit faktów (A3.1) i raport okresowy (A4.1/A4.2) --------------------------------------------------
  const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const ReportQuery = z.object({ period: z.enum(['week', 'month', 'quarter', 'custom']).default('week'), anchor: DateStr.optional(), from: DateStr.optional(), to: DateStr.optional() });
  const buildReport = async (req: FastifyRequest) => {
    const auth = patient(req);
    const q = query(req, ReportQuery);
    const period = periodBounds(q.period, q);
    noteReportViewed(auth.user.id, `${period.kind}:${period.from}:${period.to}`); // ankieta kontrolna po kilku raportach
    return { auth, report: await buildPeriodReport(auth.patientRef, auth.user.display_name, period) };
  };

  app.get('/api/me/facts/latest', async (req) => {
    const auth = patient(req);
    audit(actorOf(req), { action: 'R', subtype: 'patient-facts-latest', patientRef: auth.patientRef });
    return latestFacts(auth.patientRef);
  });

  app.get('/api/me/report', async (req) => {
    const { auth, report } = await buildReport(req);
    audit(actorOf(req), { action: 'R', subtype: 'patient-report', patientRef: auth.patientRef, detail: { period: report.period.kind, from: report.period.from, to: report.period.to } });
    return report;
  });

  app.get('/api/me/report.pdf', async (req, reply) => {
    const { auth, report } = await buildReport(req);
    const pdf = await renderPdf(periodReportHtml(report, getClinicSettings().name), { footerLeft: `Raport okresowy · ${report.period.label} · ${report.templateVersion}` });
    audit(actorOf(req), { action: 'E', subtype: 'patient-report-pdf', patientRef: auth.patientRef, detail: { period: report.period.kind, from: report.period.from, to: report.period.to } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="eternal-raport-${report.period.from}-${report.period.to}.pdf"`);
    return pdf;
  });

  // --- ankiety (A12.3): wstępna zdrowotna, po wynikach, kontrolna po raportach, ocena aplikacji -------------
  const SurveyParams = z.object({ id: z.enum(['health-intake', 'health-followup', 'after-results', 'app-feedback']) });
  app.get('/api/me/surveys', async (req) => {
    const auth = patient(req, 'patient-surveys');
    const [items, history] = await Promise.all([surveysFor(auth.user, auth.patientRef), healthResponses(auth.patientRef)]);
    audit(actorOf(req), { action: 'R', subtype: 'surveys-list', patientRef: auth.patientRef });
    return {
      items,
      history: history.map((r) => ({ id: r.id, surveyId: surveyIdOf(r), title: surveyIdOf(r) ? surveyDef(surveyIdOf(r)!).title : '', authored: r.authored })),
    };
  });

  app.get('/api/me/surveys/:id', async (req) => {
    const auth = patient(req, 'patient-surveys');
    const { id } = params(req, SurveyParams);
    const d = surveyDef(id);
    // ankietę wstępną można aktualizować — formularz startuje od ostatnich odpowiedzi
    const last = id === 'health-intake' ? (await healthResponses(auth.patientRef, id))[0] : undefined;
    if (last) audit(actorOf(req), { action: 'R', subtype: 'survey-read', entityRef: `QuestionnaireResponse/${last.id}`, patientRef: auth.patientRef });
    return { questionnaire: questionnaireOf(d), kind: d.kind, minutes: d.minutes, answers: answersOf(last), lastAuthored: last?.authored };
  });

  app.post('/api/me/surveys/:id', async (req) => {
    const auth = patient(req, 'patient-surveys');
    const { id } = params(req, SurveyParams);
    const input = body(req, z.object({ answers: z.record(z.string().max(64), z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(64)).max(30), z.null()])), platform: z.enum(['web', 'mobile']).optional() }));
    return submitSurvey(actorOf(req), auth.user, auth.patientRef, id, input.answers, { platform: input.platform });
  });

  app.post('/api/me/surveys/:id/defer', async (req) => {
    const auth = patient(req, 'patient-surveys');
    const { id } = params(req, SurveyParams);
    const { mode } = body(req, z.object({ mode: z.enum(['later', 'skip']) }));
    await deferSurvey(auth.user, auth.patientRef, id, mode);
    return { ok: true };
  });

  app.get('/api/me/surveys/responses/:id', async (req) => {
    const auth = patient(req, 'patient-surveys');
    const { id } = params(req, IdParams);
    const r = (await healthResponses(auth.patientRef)).find((x) => x.id === id);
    if (!r) throw notFound('survey_response_not_found');
    audit(actorOf(req), { action: 'R', subtype: 'survey-read', entityRef: `QuestionnaireResponse/${id}`, patientRef: auth.patientRef });
    const sid = surveyIdOf(r);
    return { id, surveyId: sid, title: sid ? surveyDef(sid).title : '', authored: r.authored, answers: readableAnswers(r) };
  });

  app.get('/api/me/observations/:id/versions', async (req) => {
    const auth = patient(req);
    const { id } = params(req, IdParams);
    const versions = await observationVersions(auth.patientRef, id).catch(async () => {
      // obserwacje z sejfu (wyniki z dokumentów) — ten sam widok przez repozytorium systemowe
      const o = await fhirSystem().readOptional<Observation>('Observation', id);
      if (!o || o.subject?.reference !== auth.patientRef) throw notFound('observation_not_found');
      return (await fhirSystem().history<Observation>('Observation', id)).map((v) => ({
        version: v.meta?.versionId,
        at: v.meta?.lastUpdated,
        status: v.status,
        value: v.valueQuantity?.value !== undefined ? `${v.valueQuantity.comparator ?? ''}${v.valueQuantity.value}` : (v.valueString ?? ''),
        unit: v.valueQuantity?.unit,
        reason: v.extension?.find((e) => e.url === ETERNAL.ext.correctionReason)?.valueString,
        trust: v.meta?.tag?.find((t) => t.system === ETERNAL.trust)?.code,
      }));
    });
    return { versions, provenance: (await provenanceFor(`Observation/${id}`)).map(provView) };
  });

  // --- korekta wpisu ręcznego (A1.4) ---------------------------------------------------------------------
  app.post('/api/me/measurements/:id/correct', async (req) => {
    const auth = patient(req, 'manual-entries');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ value: z.number().optional(), systolic: z.number().optional(), diastolic: z.number().optional(), reason: z.string().min(3).max(300) }));
    return correctMeasurement(actorOf(req), auth.patientRef, id, input);
  });

  // --- udostępnianie na czas (P2: A24.4, A18.11, A18.10) ---------------------------------------------------
  app.get('/api/directory/clinics', async (req) => {
    patient(req, 'patient-sharing');
    return { items: (await listOrganizations()).map((o) => ({ id: o.id, name: o.name })) };
  });

  app.get('/api/directory/clinics/:id/practitioners', async (req) => {
    patient(req, 'patient-sharing');
    const { id } = params(req, IdParams);
    const list = await fhirSystem().search<Practitioner>('Practitioner', { _tag: `${ORG_TAG_SYSTEM}|${id}`, active: 'true', _count: '200' });
    return { items: list.map((p) => ({ id: p.id, name: [p.name?.[0]?.prefix?.join(' '), p.name?.[0]?.given?.join(' '), p.name?.[0]?.family].filter(Boolean).join(' ') })) };
  });

  app.get('/api/me/grants', async (req) => {
    const auth = patient(req);
    return { items: listGrantsForPatient(auth.patientRef) };
  });

  app.post('/api/me/grants', async (req) => {
    const auth = patient(req, 'patient-sharing');
    const input = body(
      req,
      z.object({
        orgId: zId,
        practitionerId: zId.optional(),
        scope: ScopeSchema,
        purpose: z.enum(['visit', 'consultation', 'second-opinion', 'other']).default('consultation'),
        days: z.number().int().min(1).max(365).optional(),
        until: z.string().datetime().optional(),
      }),
    );
    if (!input.days && !input.until) throw badRequest('duration_required');
    const org = await fhirSystem().readOptional<Organization>('Organization', input.orgId);
    if (!org) throw notFound('organization_not_found');
    if (input.scope.kind === 'selected') await assertOwnRefs(auth.patientRef, input.scope.refs);
    const expiresAt = input.until ?? new Date(Date.now() + (input.days ?? 7) * 86_400_000).toISOString();
    return createGrant(actorOf(req), {
      patientRef: auth.patientRef,
      orgId: input.orgId,
      practitionerRef: input.practitionerId ? `Practitioner/${input.practitionerId}` : undefined,
      scope: input.scope as GrantScope,
      purpose: input.purpose,
      source: 'app',
      expiresAt,
    });
  });

  app.delete('/api/me/grants/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return revokeGrant(actorOf(req), id, { patientRef: auth.patientRef });
  });

  /** „Dołącz wyniki do wizyty” (F6.3): udostępnienie wybranych dokumentów placówce wizyty — do wizyty + 30 dni. */
  app.post('/api/me/appointments/:id/attach', async (req) => {
    const auth = patient(req, 'patient-sharing');
    const { id } = params(req, IdParams);
    const { refs } = body(req, z.object({ refs: z.array(z.string().regex(/^(DocumentReference|DiagnosticReport)\/[A-Za-z0-9\-.]{1,64}$/)).min(1).max(50) }));
    const appt = await fhir().read<Appointment>('Appointment', id);
    if (!appt.participant.some((p) => p.actor?.reference === auth.patientRef)) throw notFound('appointment_not_found');
    if (['cancelled', 'noshow', 'entered-in-error'].includes(appt.status)) throw conflict('appointment_not_active');
    const orgId = orgIdsOf(appt)[0];
    if (!orgId) throw conflict('appointment_without_organization');
    await assertOwnRefs(auth.patientRef, refs);
    const expires = new Date(Date.parse(appt.end ?? appt.start ?? '') + 30 * 86_400_000).toISOString();
    return createGrant(actorOf(req), { patientRef: auth.patientRef, orgId, practitionerRef: appt.participant.find((p) => p.actor?.reference?.startsWith('Practitioner/'))?.actor?.reference, scope: { kind: 'selected', refs }, purpose: 'visit', appointmentId: id, source: 'app', expiresAt: expires });
  });

  // --- powiadomienia (P8) ----------------------------------------------------------------------------
  app.get('/api/me/notification-prefs', async (req) => {
    const auth = patient(req);
    return { prefs: getNotifyPrefs(auth.user.id), kinds: NOTIFY_KINDS };
  });

  app.put('/api/me/notification-prefs', async (req) => {
    const auth = patient(req);
    const input = body(req, z.object({ disabled: z.array(z.string().max(40)).max(20), quiet: z.object({ enabled: z.boolean(), from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) }) }));
    try {
      const prefs = setNotifyPrefs(auth.user.id, input);
      audit(actorOf(req), { action: 'U', subtype: 'notify-prefs' });
      return { prefs };
    } catch {
      throw badRequest('invalid_time');
    }
  });

  /** Token powiadomień aplikacji mobilnej (Expo → APNs/FCM). */
  app.post('/api/push/expo', async (req) => {
    const auth = patient(req);
    const { token } = body(req, z.object({ token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) }));
    savePushSubscription(auth.user.id, { endpoint: `expo:${token}`, keys: { p256dh: '-', auth: '-' } });
    return { ok: true };
  });

  // --- bezpieczeństwo: SOS, osoby bliskie, karta ratunkowa (P14) --------------------------------------------
  app.get('/api/me/emergency', async (req) => {
    const auth = patient(req);
    return { contacts: listContacts(auth.patientRef), info: getEmergencyInfo(auth.patientRef), card: await emergencyCard(auth.patientRef) };
  });

  app.post('/api/me/emergency/contacts', async (req) => {
    const auth = patient(req, 'sos');
    const input = body(req, z.object({ name: z.string().min(2).max(80), phone: z.string().max(20), relation: z.string().max(40).optional() }));
    return { contacts: addContact(actorOf(req), auth.patientRef, input) };
  });

  app.delete('/api/me/emergency/contacts/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return { contacts: removeContact(actorOf(req), auth.patientRef, id) };
  });

  app.put('/api/me/emergency/info', async (req) => {
    const auth = patient(req, 'sos');
    const input = body(req, z.object({ notes: z.string().max(1000), includeMedications: z.boolean() }));
    return { info: setEmergencyInfo(actorOf(req), auth.patientRef, input) };
  });

  app.post('/api/me/sos', async (req) => {
    const auth = patient(req, 'sos');
    const input = body(req, z.object({ lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }));
    return triggerSos(actorOf(req), auth.patientRef, { ...input, displayName: auth.user.display_name });
  });

  app.get('/api/sos-card/:token', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    return cardForSosToken(token, actorOf(req));
  });

  // --- przypomnienia o lekach (D7 MVP-1, P8) ---------------------------------------------------------------
  app.get('/api/me/med-schedules', async (req) => {
    const auth = patient(req);
    return { items: listSchedules(auth.patientRef), log: listIntakeLog(auth.patientRef) };
  });

  const ScheduleInput = z.object({ medicationId: zId.optional(), label: z.string().max(120).optional(), times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(8), days: z.array(z.number().int().min(1).max(7)).max(7).optional() });

  app.post('/api/me/med-schedules', async (req) => {
    const auth = patient(req);
    return { items: await createSchedule(actorOf(req), auth.patientRef, body(req, ScheduleInput), 'patient') };
  });

  app.put('/api/me/med-schedules/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const { active } = body(req, z.object({ active: z.boolean() }));
    return { items: setScheduleActive(actorOf(req), auth.patientRef, id, active) };
  });

  app.put('/api/me/med-schedules/:id/stock', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const input = body(req, z.object({ stock: z.number().min(0).max(10_000).nullable(), perDose: z.number().positive().max(20).optional() }));
    return { items: setScheduleStock(actorOf(req), auth.patientRef, id, input) };
  });

  app.delete('/api/me/med-schedules/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    return { items: deleteSchedule(actorOf(req), auth.patientRef, id) };
  });

  app.post('/api/me/med-intake/:id', async (req) => {
    const auth = patient(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const { status } = body(req, z.object({ status: z.enum(['taken', 'skipped']) }));
    return { log: confirmIntake(actorOf(req), auth.patientRef, id, status) };
  });

  /** Lekarz proponuje harmonogram z listy leków pacjenta (pacjent widzi go i może wyłączyć). */
  app.post('/api/staff/patients/:id/med-schedules', async (req) => {
    requireClinician(req);
    requireModule('video');
    const { id } = params(req, IdParams);
    await fhir().read('Patient', id);
    return { items: await createSchedule(actorOf(req), `Patient/${id}`, body(req, ScheduleInput), 'clinic') };
  });

  // --- usunięcie danych z potwierdzeniem (A18.12) -------------------------------------------------------------
  app.post('/api/me/delete-data', async (req, reply) => {
    const auth = patient(req);
    const input = body(req, z.object({ confirm: z.literal('USUŃ'), password: z.string().max(256).optional() }));
    if (auth.user.password_hash && !['disabled', 'deleted'].includes(auth.user.password_hash)) {
      if (!input.password || !(await verifyPassword(input.password, auth.user.password_hash))) throw unauthorized('invalid_credentials');
    }
    const confirmation = await deleteMyData(actorOf(req), auth.user);
    destroySession(reply, req.auth);
    return { confirmation, html: confirmationHtml(confirmation) };
  });

  app.post('/api/deletion/confirmation.pdf', async (req, reply) => {
    // potwierdzenie do zapisania po usunięciu konta (sesja już nie istnieje) — renderowane z danych przesłanych z ekranu
    const input = body(req, z.object({ id: z.string().uuid() }));
    const { getDb } = await import('../db.js');
    const row = getDb().prepare("SELECT * FROM deletion_job WHERE id = ? AND status = 'completed' AND completed_at > ?").get(input.id, new Date(Date.now() - 3_600_000).toISOString()) as
      | { id: string; requested_at: string; completed_at: string; steps: string }
      | undefined;
    if (!row) throw notFound('confirmation_not_found');
    const backupDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 35);
    const pdf = await renderPdf(
      confirmationHtml({ id: row.id, requestedAt: row.requested_at, completedAt: row.completed_at, steps: JSON.parse(row.steps), backupsGoneBy: new Date(Date.parse(row.completed_at) + backupDays * 86_400_000).toISOString() }),
      { footerLeft: `Potwierdzenie usunięcia danych · ${row.id}` },
    );
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename="potwierdzenie-usuniecia.pdf"');
    return pdf;
  });
}

async function assertOwnRefs(patientRef: string, refs: string[]): Promise<void> {
  for (const ref of refs) {
    const [type, id] = ref.split('/');
    const r = await fhirSystem().readOptional<DocumentReference | DiagnosticReport>(type as 'DocumentReference', id);
    if (!r || r.subject?.reference !== patientRef || !orgIdsOf(r).includes(vaultOrgId(patientRef))) throw forbidden('not_own_document');
  }
}

function provView(p: Provenance) {
  return {
    at: p.recorded,
    activity: p.activity?.coding?.[0]?.display ?? p.activity?.text,
    agents: p.agent.map((a) => ({ role: a.type?.coding?.[0]?.code, who: a.who?.display })),
    reason: p.reason?.[0]?.text,
  };
}
