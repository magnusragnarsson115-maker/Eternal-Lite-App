import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorOf, requireClinician, requirePatient, requireUser } from '../auth/sessions.js';
import { pharmacyCount, refundCount, registryMeta, searchPharmacies, searchRefund } from '../integrations/registries.js';
import { body, IdParams, params, query, zDate } from '../lib/http.js';
import { requireModule } from '../modules.js';
import { achievements } from '../services/achievements.js';
import { ACTIVITY_SOURCES, importActivity, listActivity } from '../services/activity.js';
import { environmentView, setAirPrefs } from '../services/environment.js';
import { deleteGenomicFile, downloadGenomicFile, GENOMIC_NOTICE, listGenomicFiles, uploadGenomicFile } from '../services/genomicFiles.js';
import { badRequest } from '../lib/util.js';
import { addDiagnosis, importedIcd10Count, listDiagnoses, searchDiagnosisCodes, setDiagnosisStatus } from '../services/diagnoses.js';
import {
  CITIES,
  clearLocation,
  createCustomReminder,
  CUSTOM_KINDS,
  dayPlan,
  deleteCustomReminder,
  getLocation,
  getMorningPrefs,
  listCustomReminders,
  preventiveOverview,
  setLocation,
  setMorningPrefs,
  setPreventiveStatus,
  updateCustomReminder,
} from '../services/personalReminders.js';

/**
 * Funkcje „na co dzień” (runda 4): przypomnienia własne z miejscem (F9.11, A7.8), plan dnia i poranne
 * podsumowanie (F5.5), profilaktyka NFZ (A7.7), lokalizacja (A11.1) oraz rozpoznania z kodem ICD-10 wybieranym
 * przez lekarza (A12.6). Wszystko działa w profilu osoby pod opieką (auth/proxy.ts) i przechodzi przez audit().
 */

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Days = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export async function everydayRoutes(app: FastifyInstance): Promise<void> {
  const patient = (req: FastifyRequest, module: string) => {
    const auth = requirePatient(req);
    requireModule(module, { subject: auth.user.id });
    return auth;
  };

  // --- przypomnienia własne ------------------------------------------------------------------------------------
  app.get('/api/me/custom-reminders', async (req) => {
    const auth = patient(req, 'patient-reminders');
    return { items: listCustomReminders(auth.patientRef) };
  });

  app.post('/api/me/custom-reminders', async (req) => {
    const auth = patient(req, 'patient-reminders');
    const input = body(req, z.object({ kind: z.enum(CUSTOM_KINDS), title: z.string().max(80).optional(), times: z.array(HHMM).min(1).max(8), days: Days.optional(), place: z.string().max(160).optional() }));
    return { items: createCustomReminder(actorOf(req), auth.user.id, auth.patientRef, input) };
  });

  app.put('/api/me/custom-reminders/:id', async (req) => {
    const auth = patient(req, 'patient-reminders');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ active: z.boolean().optional(), title: z.string().max(80).optional(), times: z.array(HHMM).min(1).max(8).optional(), days: Days.optional(), place: z.string().max(160).nullable().optional() }));
    return { items: updateCustomReminder(actorOf(req), auth.patientRef, id, input) };
  });

  app.delete('/api/me/custom-reminders/:id', async (req) => {
    const auth = patient(req, 'patient-reminders');
    const { id } = params(req, IdParams);
    return { items: deleteCustomReminder(actorOf(req), auth.patientRef, id) };
  });

  // --- plan dnia i poranne podsumowanie (ustawienie konta, nie profilu) -----------------------------------------
  app.get('/api/me/day-plan', async (req) => {
    const auth = patient(req, 'patient-reminders');
    return { plan: await dayPlan(auth.patientRef), morning: getMorningPrefs(auth.user.id) };
  });

  app.put('/api/me/morning-summary', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('patient-reminders', { subject: auth.user.id });
    const input = body(req, z.object({ enabled: z.boolean(), time: HHMM }));
    return { morning: setMorningPrefs(actorOf(req), auth.user.id, input) };
  });

  // --- profilaktyka NFZ ---------------------------------------------------------------------------------------
  app.get('/api/me/preventive', async (req) => {
    const auth = patient(req, 'patient-preventive');
    return preventiveOverview(actorOf(req), auth.patientRef);
  });

  app.put('/api/me/preventive/:program', async (req) => {
    const auth = patient(req, 'patient-preventive');
    const { program } = params(req, z.object({ program: z.string().max(40) }));
    const input = body(req, z.object({ lastDone: zDate.nullable().optional(), variant: z.string().max(20).nullable().optional(), remind: z.boolean().optional() }));
    return setPreventiveStatus(actorOf(req), auth.patientRef, program, input);
  });

  // --- lokalizacja (konto) ------------------------------------------------------------------------------------
  app.get('/api/me/location', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    return { location: getLocation(auth.user.id) ?? null, cities: CITIES.map((c) => c.name) };
  });

  app.put('/api/me/location', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    const input = body(req, z.union([z.object({ city: z.string().max(60) }), z.object({ lat: z.number(), lon: z.number() })]));
    return { location: setLocation(actorOf(req), auth.user.id, input) };
  });

  app.delete('/api/me/location', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    clearLocation(actorOf(req), auth.user.id);
    return { location: null };
  });

  // --- aktywność i sen z urządzeń (F2.1, F2.2, F9.1, F9.3, F12.1, F2.19) — dzienne podsumowania, bez ocen ------------
  const SleepSchema = z.object({ minutes: z.number().min(0).max(1440), deep: z.number().min(0).max(1440).optional(), light: z.number().min(0).max(1440).optional(), rem: z.number().min(0).max(1440).optional(), awake: z.number().min(0).max(1440).optional(), start: z.string().max(40).optional(), end: z.string().max(40).optional() });
  app.post('/api/me/activity/import', async (req) => {
    const auth = patient(req, 'manual-entries');
    const input = body(req, z.object({ source: z.enum(ACTIVITY_SOURCES), device: z.string().max(80).optional(), days: z.array(z.object({ date: zDate, steps: z.number().int().min(0).max(200_000).optional(), sleep: SleepSchema.optional() })).min(1).max(400) }));
    return importActivity(actorOf(req), auth.patientRef, input);
  });

  app.get('/api/me/activity', async (req) => {
    const auth = patient(req, 'manual-entries');
    const q = query(req, z.object({ days: z.coerce.number().int().min(1).max(400).default(30) }));
    return { items: await listActivity(actorOf(req), auth.patientRef, q.days) };
  });

  // --- odznaki za regularność (F13.4) — liczone z dni z zapisem, nigdy z wartości -------------------------------------
  app.get('/api/me/achievements', async (req) => {
    const auth = patient(req, 'patient-journal');
    return achievements(actorOf(req), auth.patientRef);
  });

  // --- plik surowych danych genetycznych (F16.2) — tylko przechowanie, tylko właściciel konta -------------------------
  app.get('/api/me/genomic-files', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('patient-history', { subject: auth.user.id });
    return { items: listGenomicFiles(actorOf(req), auth.patientRef), notice: GENOMIC_NOTICE };
  });

  app.post('/api/me/genomic-files', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('patient-history', { subject: auth.user.id });
    const file = await req.file();
    if (!file) throw badRequest('file_required');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    const field = (k: string) => (file.fields[k] as { value?: string } | undefined)?.value;
    return { items: await uploadGenomicFile(actorOf(req), auth.patientRef, { data, filename: file.filename, provider: field('provider'), confirmed: field('confirmed') === 'true' }) };
  });

  app.get('/api/me/genomic-files/:id/file', async (req, reply) => {
    const auth = requirePatient(req, { ownOnly: true });
    const { id } = params(req, IdParams);
    const f = await downloadGenomicFile(actorOf(req), auth.patientRef, id);
    reply.header('Content-Type', f.contentType).header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`).header('Cache-Control', 'no-store');
    return f.data;
  });

  app.delete('/api/me/genomic-files/:id', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    const { id } = params(req, IdParams);
    return { items: await deleteGenomicFile(actorOf(req), auth.patientRef, id) };
  });

  // --- powietrze i pogoda (konto) ------------------------------------------------------------------------------
  app.get('/api/me/environment', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('air-weather', { subject: auth.user.id });
    return environmentView(auth.user.id);
  });

  app.put('/api/me/environment/prefs', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('air-weather', { subject: auth.user.id });
    const input = body(req, z.object({ enabled: z.boolean().optional(), threshold: z.number().int().min(1).max(5).optional(), weatherStationId: z.string().max(10).nullable().optional() }));
    return { prefs: setAirPrefs(actorOf(req), auth.user.id, input) };
  });

  // --- rejestry publiczne: apteki i wykaz refundacyjny (dane lokalne, zapytanie nie wychodzi poza serwer) ---------
  app.get('/api/registries/status', async (req) => {
    requireUser(req);
    requireModule('public-registries');
    return { pharmacies: { ...pharmacyCount(), meta: registryMeta('pharmacies') }, refund: { count: refundCount(), meta: registryMeta('refund') } };
  });

  app.get('/api/registries/pharmacies', async (req) => {
    const auth = requireUser(req);
    requireModule('public-registries');
    const q = query(req, z.object({ q: z.string().max(80).optional(), city: z.string().max(60).optional(), near: z.enum(['1']).optional() }));
    const loc = q.near ? getLocation(auth.user.id) : undefined;
    if (q.near && !loc) return { items: [], needLocation: true };
    return { items: searchPharmacies({ q: q.q, city: q.city, near: loc ? { lat: loc.lat, lon: loc.lon } : undefined }), location: loc?.label };
  });

  app.get('/api/registries/refund', async (req) => {
    requireUser(req);
    requireModule('public-registries');
    const q = query(req, z.object({ q: z.string().max(80).optional(), gtin: z.string().regex(/^\d{8,14}$/).optional() }));
    return { items: searchRefund(q), meta: registryMeta('refund') };
  });

  // --- rozpoznania ICD-10 wybierane przez lekarza ---------------------------------------------------------------
  app.get('/api/staff/diagnosis-codes', async (req) => {
    requireClinician(req);
    requireModule('diagnoses');
    const { q } = query(req, z.object({ q: z.string().max(80) }));
    return searchDiagnosisCodes(q);
  });

  app.get('/api/staff/patients/:id/diagnoses', async (req) => {
    requireClinician(req);
    requireModule('diagnoses');
    const { id } = params(req, IdParams);
    return { items: await listDiagnoses(actorOf(req), id), dictionary: importedIcd10Count() ? 'imported' : 'common' };
  });

  app.post('/api/staff/patients/:id/diagnoses', async (req) => {
    const auth = requireClinician(req);
    requireModule('diagnoses');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ code: z.string().min(3).max(10), display: z.string().min(2).max(300), system: z.string().max(80).optional(), onset: zDate.optional(), note: z.string().max(1000).optional() }));
    return { item: await addDiagnosis(actorOf(req), auth.user, id, input) };
  });

  app.put('/api/staff/diagnoses/:id', async (req) => {
    requireClinician(req);
    requireModule('diagnoses');
    const { id } = params(req, IdParams);
    const { status } = body(req, z.object({ status: z.enum(['active', 'resolved', 'inactive', 'entered-in-error']) }));
    return { item: await setDiagnosisStatus(actorOf(req), id, status) };
  });
}
