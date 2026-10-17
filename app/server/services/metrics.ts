import { audit, type AuditActor } from '../audit.js';
import { listUsers } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { badRequest, newId, nowIso } from '../lib/util.js';
import { documentHtml, esc } from '../pdf/html.js';
import { getSetting, setSetting } from '../settings.js';
import { getClinicSettings } from './directory.js';

/**
 * Mierniki pilotażu i jakości (D12) oraz licznik użycia do rozliczenia (D0, R9).
 * Dane operacyjne, nie badanie kliniczne: zdarzenia bez treści medycznych (typ, czas, lekarz, wizyta, liczba).
 */

export type MetricType =
  | 'scribe_session'
  | 'scribe_draft_ready'
  | 'scribe_approved'
  | 'card_sent'
  | 'doc_time'
  | 'survey'
  | 'invite_sent'
  | 'facts_opened';

export function recordMetric(orgId: string | undefined, type: MetricType, input: { userId?: string; appointmentId?: string; value?: number; data?: Record<string, unknown> } = {}): void {
  if (!orgId) return;
  getDb()
    .prepare('INSERT INTO metric_event (id, org_id, ts, type, user_id, appointment_id, value, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), orgId, nowIso(), type, input.userId ?? null, input.appointmentId ?? null, input.value ?? null, input.data ? JSON.stringify(input.data) : null);
}

interface EventRow {
  ts: string;
  type: MetricType;
  user_id: string | null;
  appointment_id: string | null;
  value: number | null;
  data: string | null;
}

function events(orgId: string, from: string, to: string, type?: MetricType): EventRow[] {
  return getDb()
    .prepare(`SELECT ts, type, user_id, appointment_id, value, data FROM metric_event WHERE org_id = ? AND ts >= ? AND ts < ? ${type ? 'AND type = ?' : ''} ORDER BY ts`)
    .all(...[orgId, from, to, ...(type ? [type] : [])]) as unknown as EventRow[];
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

// --- tydzień pomiaru: czas dokumentacji bez Eternal i z Eternal ------------------------------------------

export function logDocTime(orgId: string, actor: AuditActor, userId: string, input: { minutes: number; phase: 'baseline' | 'eternal'; appointmentId?: string }): void {
  if (!(input.minutes > 0 && input.minutes <= 180)) throw badRequest('invalid_minutes');
  recordMetric(orgId, 'doc_time', { userId, appointmentId: input.appointmentId, value: input.minutes, data: { phase: input.phase } });
  audit(actor, { action: 'C', subtype: 'metric-doc-time', detail: { phase: input.phase } });
}

// --- ankieta lekarza (3 pytania co N dni) ------------------------------------------------------------------

export const SURVEY_VERSION = 'ankieta-lekarza/2026-10-1';
export const SURVEY_QUESTIONS = [
  { id: 'q1', pl: 'Eternal skraca mój czas pracy z dokumentacją.', en: 'Eternal shortens the time I spend on documentation.' },
  { id: 'q2', pl: 'Materiały i raport faktów pomagają mi przygotować się do wizyty.', en: 'The materials and facts report help me prepare for the visit.' },
  { id: 'q3', pl: 'Szkic notatki wymaga niewielu poprawek.', en: 'The draft note needs few corrections.' },
];

export function surveyDue(orgId: string, userId: string): boolean {
  const days = getClinicSettings(orgId).pilot.surveyEveryDays;
  const last = getDb().prepare("SELECT ts FROM metric_event WHERE org_id = ? AND user_id = ? AND type = 'survey' ORDER BY ts DESC LIMIT 1").get(orgId, userId) as { ts: string } | undefined;
  return !last || Date.parse(last.ts) + days * 86_400_000 < Date.now();
}

export function submitSurvey(orgId: string, actor: AuditActor, userId: string, answers: { q1: number; q2: number; q3: number; comment?: string }): void {
  for (const k of ['q1', 'q2', 'q3'] as const) if (!(Number.isInteger(answers[k]) && answers[k] >= 1 && answers[k] <= 5)) throw badRequest('invalid_answer');
  recordMetric(orgId, 'survey', { userId, data: { ...answers, comment: answers.comment?.slice(0, 500), version: SURVEY_VERSION } });
  audit(actor, { action: 'C', subtype: 'metric-survey' });
}

// --- pulpit „Wartość pilotażu” ---------------------------------------------------------------------------

export interface PilotDashboard {
  period: { from: string; to: string };
  docTime: { baselineAvg: number | null; eternalAvg: number | null; savedPerVisit: number | null; baselineN: number; eternalN: number };
  notes: { sessions: number; approved: number; manual: number; correctedRatioAvg: number | null; editSecondsAvg: number | null; draftSecondsAvg: number | null };
  cards: { sent: number; app: number; sms: number };
  invites: { created: number; opened: number; consented: number; uploads: number; confirmedUploads: number };
  survey: { responses: number; q1: number | null; q2: number | null; q3: number | null; comments: string[] };
  scribeUsage: { userId: string; name: string; used: number; limit: number }[];
}

export function pilotDashboard(orgId: string, from: string, to: string): PilotDashboard {
  const ev = events(orgId, from, to);
  const doc = ev.filter((e) => e.type === 'doc_time');
  const phase = (e: EventRow) => (e.data ? (JSON.parse(e.data) as { phase?: string }).phase : undefined);
  const base = doc.filter((e) => phase(e) === 'baseline').map((e) => e.value ?? 0);
  const ete = doc.filter((e) => phase(e) === 'eternal').map((e) => e.value ?? 0);
  const baselineAvg = avg(base);
  const eternalAvg = avg(ete);
  const approved = ev.filter((e) => e.type === 'scribe_approved');
  const manual = approved.filter((e) => e.data && (JSON.parse(e.data) as { manual?: boolean }).manual);
  const aiApproved = approved.filter((e) => !manual.includes(e));
  const cards = ev.filter((e) => e.type === 'card_sent').map((e) => (e.data ? (JSON.parse(e.data) as { channel?: string }).channel : undefined));
  const surveys = ev.filter((e) => e.type === 'survey').map((e) => JSON.parse(e.data ?? '{}') as { q1: number; q2: number; q3: number; comment?: string });
  const db = getDb();
  const inv = db.prepare("SELECT COUNT(*) AS n, SUM(first_opened_at IS NOT NULL) AS opened, SUM(grant_id IS NOT NULL) AS consented FROM invite_link WHERE org_id = ? AND purpose = 'intake' AND created_at >= ? AND created_at < ?").get(orgId, from, to) as {
    n: number;
    opened: number | null;
    consented: number | null;
  };
  const up = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'confirmed') AS confirmed FROM intake_item WHERE org_id = ? AND created_at >= ? AND created_at < ?").get(orgId, from, to) as { n: number; confirmed: number | null };
  const month = from.slice(0, 7);
  const limit = getClinicSettings(orgId).scribeMonthlyLimitPerDoctor;
  const usage = listUsers({ orgId, staffOnly: true })
    .filter((u) => u.roles.includes('practitioner'))
    .map((u) => {
      const r = db.prepare("SELECT COUNT(*) AS n FROM scribe_session WHERE practitioner_user_id = ? AND substr(created_at, 1, 7) = ? AND status <> 'cancelled' AND (audio_binary_id IS NOT NULL OR status IN ('draft','approved'))").get(u.id, month) as { n: number };
      return { userId: u.id, name: u.display_name, used: r.n, limit };
    });
  return {
    period: { from, to },
    docTime: { baselineAvg, eternalAvg, savedPerVisit: baselineAvg !== null && eternalAvg !== null ? Math.round((baselineAvg - eternalAvg) * 10) / 10 : null, baselineN: base.length, eternalN: ete.length },
    notes: {
      sessions: ev.filter((e) => e.type === 'scribe_session').length,
      approved: approved.length,
      manual: manual.length,
      correctedRatioAvg: avg(aiApproved.map((e) => (e.value ?? 0) * 100)),
      editSecondsAvg: avg(approved.map((e) => (e.data ? ((JSON.parse(e.data) as { editSeconds?: number }).editSeconds ?? 0) : 0))),
      draftSecondsAvg: avg(ev.filter((e) => e.type === 'scribe_draft_ready' && e.value !== null).map((e) => e.value as number)),
    },
    cards: { sent: cards.length, app: cards.filter((c) => c === 'app').length, sms: cards.filter((c) => c === 'sms').length },
    invites: { created: inv.n, opened: inv.opened ?? 0, consented: inv.consented ?? 0, uploads: up.n, confirmedUploads: up.confirmed ?? 0 },
    survey: { responses: surveys.length, q1: avg(surveys.map((s) => s.q1)), q2: avg(surveys.map((s) => s.q2)), q3: avg(surveys.map((s) => s.q3)), comments: surveys.map((s) => s.comment).filter((c): c is string => !!c).slice(-10) },
    scribeUsage: usage,
  };
}

export function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('invalid_month');
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() };
}

export const METRICS_TEMPLATE_VERSION = 'raport-pilotazu/2026-10-1';

export function dashboardHtml(d: PilotDashboard, clinic: string, month: string): string {
  const v = (x: number | null, unit = '') => (x === null ? '—' : `${String(x).replace('.', ',')}${unit}`);
  const body = `
  <p class="small muted">Dane operacyjne pilotażu, nie badanie kliniczne. Czas dokumentacji — wpisy lekarzy w tygodniach pomiaru.</p>
  <h2>Czas dokumentacji na wizytę</h2>
  <table><tr><th>Tydzień bez Eternal</th><th>Z Eternal</th><th>Różnica na wizytę</th></tr>
  <tr><td>${v(d.docTime.baselineAvg, ' min')} (n=${d.docTime.baselineN})</td><td>${v(d.docTime.eternalAvg, ' min')} (n=${d.docTime.eternalN})</td><td>${v(d.docTime.savedPerVisit, ' min')}</td></tr></table>
  <h2>Materiały od pacjentów</h2>
  <table><tr><th>Zaproszenia</th><th>Otwarte</th><th>Zgody</th><th>Wgrane pliki</th><th>Potwierdzone w całości</th></tr>
  <tr><td>${d.invites.created}</td><td>${d.invites.opened}</td><td>${d.invites.consented}</td><td>${d.invites.uploads}</td><td>${d.invites.confirmedUploads}</td></tr></table>
  <h2>Eternal Scribe</h2>
  <table><tr><th>Sesje</th><th>Zatwierdzone notatki</th><th>W tym bez nagrania</th><th>Odsetek zdań poprawionych</th><th>Czas od szkicu do zatwierdzenia</th><th>Czas przygotowania szkicu</th></tr>
  <tr><td>${d.notes.sessions}</td><td>${d.notes.approved}</td><td>${d.notes.manual}</td><td>${v(d.notes.correctedRatioAvg, '%')}</td><td>${v(d.notes.editSecondsAvg, ' s')}</td><td>${v(d.notes.draftSecondsAvg, ' s')}</td></tr></table>
  <table><tr><th>Lekarz</th><th class="num">Wizyty Scribe w miesiącu</th><th class="num">Limit</th></tr>${d.scribeUsage.map((u) => `<tr><td>${esc(u.name)}</td><td class="num">${u.used}</td><td class="num">${u.limit}</td></tr>`).join('')}</table>
  <h2>Karty „Po wizycie”</h2><p>Wysłane: ${d.cards.sent} (w aplikacji: ${d.cards.app}, SMS: ${d.cards.sms})</p>
  <h2>Ankieta lekarzy (1–5)</h2>
  <table><tr><th>Odpowiedzi</th>${SURVEY_QUESTIONS.map((q) => `<th>${esc(q.pl)}</th>`).join('')}</tr><tr><td>${d.survey.responses}</td><td>${v(d.survey.q1)}</td><td>${v(d.survey.q2)}</td><td>${v(d.survey.q3)}</td></tr></table>
  ${d.survey.comments.length ? `<ul class="small">${d.survey.comments.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`;
  return documentHtml({ title: 'Raport miesięczny pilotażu', subtitle: month, org: clinic, meta: [['Okres', `${d.period.from.slice(0, 10)} – ${d.period.to.slice(0, 10)}`]], body, templateVersion: METRICS_TEMPLATE_VERSION, demo: config.demoMode });
}

// --- licznik użycia i eksport do faktury (D0, R9) ------------------------------------------------------------

export interface BillingSettings {
  pricePerDoctorNet: number;
  includedScribePerDoctor: number;
  videoMinutePriceNet: number;
  currency: 'PLN';
}

export function billingSettings(orgId: string): BillingSettings {
  return { pricePerDoctorNet: 299, includedScribePerDoctor: getClinicSettings(orgId).scribeMonthlyLimitPerDoctor, videoMinutePriceNet: 0, currency: 'PLN', ...(getSetting<Partial<BillingSettings>>(`billing:${orgId}`) ?? {}) };
}

export function setBillingSettings(orgId: string, actor: AuditActor, patch: Partial<BillingSettings>): BillingSettings {
  const next = { ...billingSettings(orgId), ...patch };
  if (!(next.pricePerDoctorNet >= 0) || !(next.videoMinutePriceNet >= 0)) throw badRequest('invalid_price');
  setSetting(`billing:${orgId}`, next);
  audit(actor, { action: 'U', subtype: 'billing-settings', detail: { ...next } });
  return next;
}

export function usageForMonth(orgId: string, month: string) {
  const { from, to } = monthRange(month);
  const db = getDb();
  const doctors = listUsers({ orgId, staffOnly: true }).filter((u) => u.roles.includes('practitioner'));
  const active = doctors.filter((u) => {
    const s = db.prepare("SELECT 1 FROM audit_log WHERE actor_user_id = ? AND ts >= ? AND ts < ? AND subtype = 'login' LIMIT 1").get(u.id, from, to);
    const sc = db.prepare('SELECT 1 FROM scribe_session WHERE practitioner_user_id = ? AND created_at >= ? AND created_at < ? LIMIT 1').get(u.id, from, to);
    return !!s || !!sc;
  });
  const scribe = db.prepare("SELECT COUNT(*) AS n FROM scribe_session WHERE org_id = ? AND created_at >= ? AND created_at < ? AND status <> 'cancelled' AND (audio_binary_id IS NOT NULL OR status IN ('draft','approved'))").get(orgId, from, to) as { n: number };
  const video = db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m, COUNT(*) AS n FROM tele_session WHERE org_id = ? AND created_at >= ? AND created_at < ?').get(orgId, from, to) as { m: number; n: number };
  const billing = billingSettings(orgId);
  return {
    month,
    activeDoctors: active.length,
    doctors: doctors.length,
    scribeVisits: scribe.n,
    scribeLimit: billing.includedScribePerDoctor * Math.max(active.length, 1),
    videoMinutes: Math.round(video.m),
    videoVisits: video.n,
    billing,
    lines: [
      { item: 'Licencja Eternal Doctor (aktywny lekarz)', qty: active.length, unit: 'szt.', priceNet: billing.pricePerDoctorNet },
      ...(billing.videoMinutePriceNet ? [{ item: 'Minuty wideo', qty: Math.round(video.m), unit: 'min', priceNet: billing.videoMinutePriceNet }] : []),
    ],
  };
}

/** CSV do programu księgowego (faktura wystawiana tam, z KSeF). Stawka VAT — decyzja D44, poza aplikacją. */
export function usageCsv(orgId: string, month: string, org: { name: string; nip?: string }): string {
  const u = usageForMonth(orgId, month);
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['okres', 'klient', 'nip', 'pozycja', 'ilosc', 'jednostka', 'cena_netto', 'wartosc_netto', 'waluta'].map(q).join(';')];
  for (const l of u.lines) rows.push([month, org.name, org.nip ?? '', l.item, l.qty, l.unit, l.priceNet.toFixed(2), (l.qty * l.priceNet).toFixed(2), u.billing.currency].map(q).join(';'));
  rows.push([month, org.name, org.nip ?? '', `Informacyjnie: wizyty Scribe ${u.scribeVisits} / limit ${u.scribeLimit}`, '', '', '', '', ''].map(q).join(';'));
  return `﻿${rows.join('\r\n')}\r\n`;
}

export function monthlyReportSent(orgId: string, month: string): boolean {
  return !!getSetting<string>(`metrics-report:${orgId}:${month}`);
}

export function markMonthlyReportSent(orgId: string, month: string): void {
  setSetting(`metrics-report:${orgId}:${month}`, nowIso());
}
