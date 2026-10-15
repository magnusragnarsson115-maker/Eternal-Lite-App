import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorOf, requireClinician, requirePatient } from '../auth/sessions.js';
import { config } from '../config.js';
import { calendarEvents, createFeed, feedIcs, feedStatus, revokeFeed } from '../services/calendar.js';
import { checkGoal, createGoal, endGoal, GOAL_KINDS, listGoals } from '../services/goals.js';
import { createRehabPlan, endRehabPlan, listRehabForPatient, listRehabForStaff, logRehab } from '../services/rehab.js';
import { body, IdParams, params, query, zDate, zIso } from '../lib/http.js';
import { requireModule } from '../modules.js';
import { audit } from '../audit.js';
import { renderPdf } from '../pdf/render.js';
import { buildDoctorReport, doctorReportBundle, doctorReportHtml, travelCard, travelCardHtml } from '../services/doctorReport.js';
import {
  addFamilyHistory,
  addVaccination,
  clearDirective,
  completePlannedVaccination,
  DIRECTIVE_DISCLAIMER,
  DIRECTIVE_KINDS,
  DIRECTIVE_TEXT_VERSION,
  FAMILY_CONDITIONS,
  listDirectives,
  listFamilyHistory,
  listVaccinations,
  RELATIONSHIP_CODES,
  removeFamilyHistory,
  removeVaccination,
  setDirective,
  VACCINES,
} from '../services/healthHistory.js';
import { addJournalEntry, BREATHING_PATTERNS, JOURNAL_KINDS, listJournal, MOOD_TAGS, PAIN_CHARACTER, PAIN_REGIONS, retractJournalEntry } from '../services/journal.js';

/**
 * Funkcje zdrowotne pacjenta dodane w rundzie „aplikacja w całości”: dzienniki (F8.2, F8.14, A21.3, A8.6),
 * szczepienia, wywiad rodzinny i dyspozycje (A20.7, A20.9, A22.5), raport dla lekarza i karta na wyjazd (A4.3, A4.4,
 * A24.7), kalendarz, plan rehabilitacji i cele (A17.13, A22.4, A7.6). Wszystko działa także w profilu dziecka lub
 * osoby pod opieką (auth/proxy.ts) i przechodzi przez audit().
 */

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const JournalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mood'), at: zIso.optional(), mood: z.number().int().min(1).max(10), tags: z.array(z.enum(MOOD_TAGS)).max(8).optional(), note: z.string().max(500).optional() }),
  z.object({ kind: z.literal('sleep'), date: zDate, bedtime: HHMM, wake: HHMM, quality: z.number().int().min(1).max(5), awakenings: z.number().int().min(0).max(30).optional(), note: z.string().max(1000).optional() }),
  z.object({
    kind: z.literal('pain'),
    at: zIso.optional(),
    intensity: z.number().int().min(0).max(10),
    regions: z.array(z.enum(PAIN_REGIONS)).min(1).max(19),
    character: z.array(z.enum(PAIN_CHARACTER)).max(6).optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({ kind: z.literal('breathing'), at: zIso.optional(), minutes: z.number().positive().max(60), pattern: z.enum(BREATHING_PATTERNS) }),
]);

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const patient = (req: FastifyRequest, module: string) => {
    const auth = requirePatient(req);
    requireModule(module, { subject: auth.user.id });
    return auth;
  };

  // --- dzienniki ------------------------------------------------------------------------------------------------
  app.get('/api/me/journal', async (req) => {
    const auth = patient(req, 'patient-journal');
    const q = query(req, z.object({ kind: z.enum(JOURNAL_KINDS).optional(), days: z.coerce.number().int().min(1).max(730).default(90) }));
    return { items: await listJournal(auth.patientRef, q.kind, q.days) };
  });

  app.post('/api/me/journal', async (req) => {
    const auth = patient(req, 'patient-journal');
    return addJournalEntry(actorOf(req), auth.patientRef, body(req, JournalSchema));
  });

  app.delete('/api/me/journal/:id', async (req) => {
    const auth = patient(req, 'patient-journal');
    const { id } = params(req, IdParams);
    await retractJournalEntry(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  // --- szczepienia (A20.7, A21.7) ------------------------------------------------------------------------------------
  const DateLoose = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/);
  app.get('/api/me/vaccinations', async (req) => {
    const auth = patient(req, 'patient-history');
    return { items: await listVaccinations(auth.patientRef), vaccines: VACCINES };
  });

  app.post('/api/me/vaccinations', async (req) => {
    const auth = patient(req, 'patient-history');
    const input = body(
      req,
      z.object({
        status: z.enum(['done', 'planned']),
        code: z.enum(Object.keys(VACCINES) as [string, ...string[]]).optional(),
        name: z.string().max(120).optional(),
        date: DateLoose,
        dose: z.number().int().min(1).max(10).optional(),
        lot: z.string().max(40).optional(),
        place: z.string().max(120).optional(),
        note: z.string().max(500).optional(),
      }),
    );
    return addVaccination(actorOf(req), auth.patientRef, input);
  });

  app.post('/api/me/vaccinations/:id/done', async (req) => {
    const auth = patient(req, 'patient-history');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ date: zDate, lot: z.string().max(40).optional(), place: z.string().max(120).optional() }));
    return completePlannedVaccination(actorOf(req), auth.patientRef, id, input);
  });

  app.delete('/api/me/vaccinations/:id', async (req) => {
    const auth = patient(req, 'patient-history');
    const { id } = params(req, IdParams);
    await removeVaccination(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  // --- choroby w rodzinie (A20.9, A21.9) -----------------------------------------------------------------------------
  app.get('/api/me/family-history', async (req) => {
    const auth = patient(req, 'patient-history');
    return { items: await listFamilyHistory(auth.patientRef), conditions: FAMILY_CONDITIONS };
  });

  app.post('/api/me/family-history', async (req) => {
    const auth = patient(req, 'patient-history');
    const input = body(
      req,
      z.object({
        relationship: z.enum(RELATIONSHIP_CODES),
        conditions: z.array(z.object({ code: z.string().max(40).optional(), text: z.string().max(120).optional(), onsetAge: z.number().int().min(0).max(120).optional() })).min(1).max(10),
        deceased: z.boolean().optional(),
        deceasedAge: z.number().int().min(0).max(120).optional(),
        note: z.string().max(500).optional(),
      }),
    );
    return addFamilyHistory(actorOf(req), auth.patientRef, input);
  });

  app.delete('/api/me/family-history/:id', async (req) => {
    const auth = patient(req, 'patient-history');
    const { id } = params(req, IdParams);
    await removeFamilyHistory(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  // --- dyspozycje medyczne (A22.5) — tylko właściciel konta (poza trybem opiekuna) -----------------------------------
  app.get('/api/me/directives', async (req) => {
    const auth = patient(req, 'patient-history');
    return { items: await listDirectives(auth.patientRef), disclaimer: DIRECTIVE_DISCLAIMER, version: DIRECTIVE_TEXT_VERSION };
  });

  app.put('/api/me/directives', async (req) => {
    const auth = patient(req, 'patient-history');
    const input = body(
      req,
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('organ-donation'), value: z.enum(['donor', 'objection-registered', 'undecided']), showOnCard: z.boolean() }),
        z.object({ kind: z.literal('transfusion'), value: z.enum(['accept', 'refuse', 'undecided']), showOnCard: z.boolean() }),
        z.object({ kind: z.literal('info-person'), person: z.object({ name: z.string().max(120), phone: z.string().max(20).optional() }), showOnCard: z.boolean() }),
        z.object({ kind: z.literal('care-wishes'), text: z.string().max(2000), showOnCard: z.boolean() }),
      ]),
    );
    return { items: await setDirective(actorOf(req), auth.patientRef, input) };
  });

  app.delete('/api/me/directives/:kind', async (req) => {
    const auth = patient(req, 'patient-history');
    const { kind } = params(req, z.object({ kind: z.enum(DIRECTIVE_KINDS) }));
    return { items: await clearDirective(actorOf(req), auth.patientRef, kind) };
  });

  // --- raport dla lekarza SBAR (A4.3, F6.2), dokument FHIR (A4.4), karta na wyjazd (A24.7) ----------------------------
  const ReportQuery = z.object({
    reason: z.string().trim().min(3).max(1000),
    since: z.string().max(120).optional(),
    questions: z.string().max(1500).optional(),
    expectations: z.string().max(500).optional(),
    days: z.coerce.number().int().min(7).max(365).default(90),
  });

  app.get('/api/me/doctor-report', async (req) => {
    const auth = patient(req, 'patient-reports');
    const report = await buildDoctorReport(auth.patientRef, query(req, ReportQuery));
    audit(actorOf(req), { action: 'R', subtype: 'doctor-report', patientRef: auth.patientRef, detail: { days: report.period.days } });
    return report;
  });

  app.get('/api/me/doctor-report.pdf', async (req, reply) => {
    const auth = patient(req, 'patient-reports');
    const report = await buildDoctorReport(auth.patientRef, query(req, ReportQuery));
    const pdf = await renderPdf(doctorReportHtml(report), { footerLeft: `Informacje dla lekarza (SBAR) · ${report.patient.name} · ${report.version}` });
    audit(actorOf(req), { action: 'E', subtype: 'doctor-report-pdf', patientRef: auth.patientRef, detail: { bytes: pdf.length } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="dla-lekarza-${report.generatedAt.slice(0, 10)}.pdf"`);
    return pdf;
  });

  app.get('/api/me/fhir-bundle', async (req, reply) => {
    const auth = patient(req, 'patient-reports');
    const report = await buildDoctorReport(auth.patientRef, query(req, ReportQuery));
    const bundle = await doctorReportBundle(auth.patientRef, report);
    audit(actorOf(req), { action: 'E', subtype: 'doctor-report-fhir', patientRef: auth.patientRef, detail: { entries: bundle.entry?.length ?? 0 } });
    reply.header('Content-Type', 'application/fhir+json; charset=utf-8').header('Content-Disposition', `attachment; filename="dla-lekarza-${report.generatedAt.slice(0, 10)}.fhir.json"`);
    return bundle;
  });

  app.get('/api/me/travel-card', async (req) => {
    const auth = patient(req, 'patient-reports');
    const card = await travelCard(auth.patientRef);
    audit(actorOf(req), { action: 'R', subtype: 'travel-card', patientRef: auth.patientRef });
    return card;
  });

  app.get('/api/me/travel-card.pdf', async (req, reply) => {
    const auth = patient(req, 'patient-reports');
    const card = await travelCard(auth.patientRef);
    const pdf = await renderPdf(travelCardHtml(card), { footerLeft: `Karta zdrowia · Health card · ${card.version}` });
    audit(actorOf(req), { action: 'E', subtype: 'travel-card-pdf', patientRef: auth.patientRef, detail: { bytes: pdf.length } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename="karta-zdrowia-health-card.pdf"');
    return pdf;
  });

  // --- kalendarz zdrowia i subskrypcja ICS (A17.13, A17.18, F5.6, F5.7) -------------------------------------------------
  const tz = config.clinic.timezone;
  app.get('/api/me/calendar', async (req) => {
    const auth = patient(req, 'patient-calendar');
    const q = query(req, z.object({ from: zDate, to: zDate, meds: z.enum(['0', '1']).optional() }));
    return { items: await calendarEvents(auth.patientRef, q.from, q.to, tz, new Date(), { meds: q.meds === '1' }), feed: feedStatus(auth.user.id, auth.patientRef) };
  });

  app.post('/api/me/calendar/feed', async (req) => {
    const auth = patient(req, 'patient-calendar');
    return createFeed(actorOf(req), auth.user.id, auth.patientRef);
  });

  app.delete('/api/me/calendar/feed', async (req) => {
    const auth = patient(req, 'patient-calendar');
    revokeFeed(actorOf(req), auth.user.id, auth.patientRef);
    return { ok: true };
  });

  // adres dla aplikacji kalendarza — bez logowania, z prywatnym tokenem; same ogólne nazwy wydarzeń
  app.get('/api/calendar/:file', async (req, reply) => {
    const { file } = params(req, z.object({ file: z.string().regex(/^[A-Za-z0-9_-]{30,60}\.ics$/) }));
    const ics = await feedIcs(file.replace(/\.ics$/, ''), tz);
    reply.header('Content-Type', 'text/calendar; charset=utf-8').header('Cache-Control', 'private, max-age=900');
    return ics;
  });

  // --- plan rehabilitacji z kontrolą wykonania (A22.4) ------------------------------------------------------------------
  const ActivitySchema = z.object({ name: z.string().max(120), instructions: z.string().max(1000).optional(), dose: z.string().max(80).optional(), days: z.array(z.number().int().min(1).max(7)).min(1).max(7) });

  app.get('/api/me/rehab', async (req) => {
    const auth = patient(req, 'patient-goals');
    return { items: await listRehabForPatient(auth.patientRef, tz) };
  });

  app.post('/api/me/rehab/:id/log', async (req) => {
    const auth = patient(req, 'patient-goals');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ activity: z.number().int().min(0).max(50), day: zDate, done: z.boolean(), note: z.string().max(300).optional() }));
    return logRehab(actorOf(req), auth.patientRef, id, input, tz);
  });

  app.get('/api/staff/patients/:id/rehab', async (req) => {
    requireClinician(req);
    requireModule('rehab-plan');
    const { id } = params(req, IdParams);
    return { items: await listRehabForStaff(id, tz) };
  });

  app.post('/api/staff/patients/:id/rehab', async (req) => {
    const auth = requireClinician(req);
    requireModule('rehab-plan');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ title: z.string().min(3).max(120), start: zDate, end: zDate.optional(), note: z.string().max(1000).optional(), activities: z.array(ActivitySchema).min(1).max(20) }));
    const plan = await createRehabPlan(actorOf(req), auth.user, id, input);
    return { id: plan.id };
  });

  app.post('/api/staff/rehab/:id/end', async (req) => {
    requireClinician(req);
    requireModule('rehab-plan');
    const { id } = params(req, IdParams);
    await endRehabPlan(actorOf(req), id);
    return { ok: true };
  });

  // --- cele tygodniowe (A7.6) ---------------------------------------------------------------------------------------------
  app.get('/api/me/goals', async (req) => {
    const auth = patient(req, 'patient-goals');
    return { items: await listGoals(auth.patientRef, tz) };
  });

  app.post('/api/me/goals', async (req) => {
    const auth = patient(req, 'patient-goals');
    const input = body(req, z.object({ kind: z.enum(GOAL_KINDS), target: z.number().int().min(1).max(300), title: z.string().max(120).optional() }));
    return createGoal(actorOf(req), auth.patientRef, input, tz);
  });

  app.post('/api/me/goals/:id/check', async (req) => {
    const auth = patient(req, 'patient-goals');
    const { id } = params(req, IdParams);
    const { done } = body(req, z.object({ done: z.boolean() }));
    return checkGoal(actorOf(req), auth.patientRef, id, done, tz);
  });

  app.delete('/api/me/goals/:id', async (req) => {
    const auth = patient(req, 'patient-goals');
    const { id } = params(req, IdParams);
    await endGoal(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });
}
