import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { idFromRef } from '../fhir/repository.js';
import { readPref, writePref } from '../lib/prefs.js';
import { badRequest, fetchWithTimeout, HttpError, nowIso } from '../lib/util.js';
import { importActivity, type ActivityDayInput } from '../services/activity.js';
import { addMeasurementsBatch, type MeasurementInput } from '../services/observations.js';

/**
 * Validic Inform (REST API v2) — jeden dostęp do setek urządzeń i aplikacji (wagi, ciśnieniomierze, glukometry,
 * zegarki, Apple Health/Health Connect przez Validic Mobile). Integracja przez API, bez osadzonych widżetów:
 * 1) aplikacja zakłada użytkownika Validic z nieczytelnym identyfikatorem (bez danych osobowych),
 * 2) pacjent łączy swoje urządzenia na stronie Validic Marketplace (link z odpowiedzi API — logowanie u producenta),
 * 3) aplikacja pobiera pomiary, sen i dzienne podsumowania i zapisuje je jak inne pomiary (źródło „rpm:validic”).
 * Wartości przepisywane bez oceny. Dostęp: konto organizacji Validic (wersja próbna dla deweloperów, potem umowa).
 * Dokumentacja: https://helpdocs.validic.com/docs/inform-rest-api — base https://api.v2.validic.com, ?token=…
 */

export interface ValidicPref {
  uid: string;
  validicId?: string;
  marketplaceUrl?: string;
  connectedAt: string;
  lastSyncAt?: string;
  lastResult?: { measurements: number; days: number };
}

export function validicConfigured(): boolean {
  return !!(config.validic.orgId && config.validic.token);
}

/** Identyfikator użytkownika u Validic: skrót identyfikatora rekordu (UUID) — bez imienia, PESEL i e-maila. */
export function validicUid(patientRef: string): string {
  return `etr-${crypto.createHash('sha256').update(`${config.validic.orgId}:${idFromRef(patientRef)}`).digest('hex').slice(0, 32)}`;
}

function url(path: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...params, token: config.validic.token });
  return `${config.validic.baseUrl.replace(/\/$/, '')}/organizations/${encodeURIComponent(config.validic.orgId)}${path}?${q.toString()}`;
}

async function call<T>(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await fetchWithTimeout(url(path, params), { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }, 20_000).catch((err: Error) => {
    throw new HttpError(502, 'validic_unreachable', err.message);
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'validic_auth', `Validic ${res.status}`);
  if (res.status === 429) throw new HttpError(503, 'validic_rate_limited');
  return { status: res.status, json };
}

interface ValidicUser {
  id?: string;
  uid?: string;
  marketplace?: { token?: string; url?: string };
}

/** Założenie (albo odczyt istniejącego) użytkownika Validic i link do Marketplace, gdzie pacjent łączy urządzenia. */
export async function connectValidic(actor: AuditActor, userId: string, patientRef: string): Promise<{ marketplaceUrl: string }> {
  if (!validicConfigured()) throw new HttpError(409, 'validic_not_configured');
  const uid = validicUid(patientRef);
  let r = await call<ValidicUser>('POST', '/users', {}, { uid, location: { timezone: config.clinic.timezone, country_code: 'PL' } });
  if (r.status === 409 || r.status === 422) r = await call<ValidicUser>('GET', `/users/${encodeURIComponent(uid)}`);
  if (r.status >= 400) throw new HttpError(502, 'validic_error', `Validic ${r.status}`);
  const marketplaceUrl = r.json.marketplace?.url;
  if (!marketplaceUrl) throw new HttpError(502, 'validic_no_marketplace');
  const prev = readPref<ValidicPref>(userId, 'validic');
  writePref(userId, 'validic', { ...prev, uid, validicId: r.json.id, marketplaceUrl, connectedAt: prev?.connectedAt ?? nowIso() } satisfies ValidicPref);
  audit(actor, { action: 'C', subtype: 'validic-connect', patientRef });
  return { marketplaceUrl };
}

export function validicStatus(userId: string): { configured: boolean; connected: boolean; lastSyncAt?: string; lastResult?: ValidicPref['lastResult'] } {
  const p = readPref<ValidicPref>(userId, 'validic');
  return { configured: validicConfigured(), connected: !!p, lastSyncAt: p?.lastSyncAt, lastResult: p?.lastResult };
}

// --- mapowanie rekordów Validic → pomiary i dzienne podsumowania ---------------------------------------------------

export interface ValidicMetric {
  type: string;
  unit?: string;
  value: number;
}
export interface ValidicRecord {
  id?: string;
  start_time?: string;
  end_time?: string;
  offset_origin?: string;
  source?: { type?: string; device?: { manufacturer?: string; model?: string } };
  metrics?: ValidicMetric[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function metric(r: ValidicRecord, ...types: string[]): ValidicMetric | undefined {
  return r.metrics?.find((m) => types.includes(m.type) && Number.isFinite(m.value));
}

function deviceOf(r: ValidicRecord): string {
  const d = r.source?.device;
  return [d?.manufacturer, d?.model].filter(Boolean).join(' ') || `${r.source?.type ?? 'Validic'} (Validic)`;
}

function kg(m: ValidicMetric): number {
  return /lb/i.test(m.unit ?? '') ? round1(m.value * 0.45359237) : round1(m.value);
}
function celsius(m: ValidicMetric): number {
  return /f/i.test(m.unit ?? '') && !/c/i.test(m.unit ?? '') ? round1(((m.value - 32) * 5) / 9) : round1(m.value);
}
function mgdl(m: ValidicMetric): number {
  return /mmol/i.test(m.unit ?? '') ? Math.round(m.value * 18.016) : Math.round(m.value);
}
function minutesOf(m: ValidicMetric | undefined): number | undefined {
  if (!m) return undefined;
  const u = (m.unit ?? 's').toLowerCase();
  return Math.round(u.startsWith('min') ? m.value : u.startsWith('h') ? m.value * 60 : m.value / 60);
}

/** Pomiary punktowe (ciśnienie, tętno, waga, SpO₂, glukoza, temperatura) → wejście do wspólnej ścieżki pomiarów. */
export function mapMeasurements(records: ValidicRecord[]): MeasurementInput[] {
  const out: MeasurementInput[] = [];
  for (const r of records) {
    if (!r.start_time) continue;
    const base = { effective: new Date(r.start_time).toISOString(), source: 'rpm:validic' as const, device: deviceOf(r) };
    const id = r.id ?? `${r.start_time}`;
    const sys = metric(r, 'systolic');
    const dia = metric(r, 'diastolic');
    const pulse = metric(r, 'pulse', 'heart_rate', 'resting_heart_rate');
    if (sys && dia) out.push({ ...base, kind: 'bp', systolic: Math.round(sys.value), diastolic: Math.round(dia.value), pulse: pulse ? Math.round(pulse.value) : undefined, externalId: `validic:${id}:bp` });
    else if (pulse) out.push({ ...base, kind: 'heartRate', value: Math.round(pulse.value), externalId: `validic:${id}:hr` });
    const w = metric(r, 'body_weight', 'weight');
    if (w) out.push({ ...base, kind: 'weight', value: kg(w), externalId: `validic:${id}:weight` });
    const s = metric(r, 'spo2', 'oxygen_saturation');
    if (s) out.push({ ...base, kind: 'spo2', value: Math.round(s.value), externalId: `validic:${id}:spo2` });
    const g = metric(r, 'blood_glucose', 'glucose');
    if (g) out.push({ ...base, kind: 'glucose', value: mgdl(g), externalId: `validic:${id}:glucose` });
    const t = metric(r, 'body_temperature', 'temperature');
    if (t) out.push({ ...base, kind: 'temperature', value: celsius(t), externalId: `validic:${id}:temp` });
  }
  return out;
}

/** Dzienne podsumowania (kroki) i sen → dni aktywności (jedna obserwacja na dzień × rodzaj × źródło). */
export function mapDays(summaries: ValidicRecord[], sleeps: ValidicRecord[], today: string): { days: ActivityDayInput[]; device?: string } {
  const byDay = new Map<string, ActivityDayInput>();
  let device: string | undefined;
  const day = (iso: string) => iso.slice(0, 10);
  for (const s of summaries) {
    const steps = metric(s, 'steps');
    if (!s.start_time || !steps) continue;
    const d = day(s.start_time);
    if (d > today) continue;
    byDay.set(d, { ...(byDay.get(d) ?? { date: d }), steps: Math.max(0, Math.round(steps.value)) });
    device ??= deviceOf(s);
  }
  for (const s of sleeps) {
    const total = minutesOf(metric(s, 'sleep_duration', 'total_sleep', 'asleep'));
    const at = s.end_time ?? s.start_time;
    if (total === undefined || !at) continue;
    const d = day(at);
    if (d > today) continue;
    byDay.set(d, {
      ...(byDay.get(d) ?? { date: d }),
      sleep: {
        minutes: total,
        deep: minutesOf(metric(s, 'deep_sleep')),
        light: minutesOf(metric(s, 'light_sleep')),
        rem: minutesOf(metric(s, 'rem_sleep')),
        awake: minutesOf(metric(s, 'awake', 'awake_duration')),
        start: s.start_time,
        end: s.end_time,
      },
    });
    device ??= deviceOf(s);
  }
  return { days: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)), device };
}

function rows(json: unknown): ValidicRecord[] {
  if (Array.isArray(json)) return json as ValidicRecord[];
  const d = (json as { data?: unknown }).data;
  return Array.isArray(d) ? (d as ValidicRecord[]) : [];
}

/** Pobranie danych z ostatnich dni (zakres REST ≤ 31 dni) i zapis do rekordu pacjenta. */
export async function syncValidic(actor: AuditActor, userId: string, patientRef: string, days = 30, now = new Date()): Promise<{ measurements: number; days: number }> {
  if (!validicConfigured()) throw new HttpError(409, 'validic_not_configured');
  const pref = readPref<ValidicPref>(userId, 'validic');
  if (!pref) throw badRequest('validic_not_connected');
  const span = Math.min(31, Math.max(1, days));
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (span - 1) * 86_400_000).toISOString().slice(0, 10);
  const params = { start_date: start, end_date: end };
  const uid = encodeURIComponent(pref.uid);
  const [m, s, sl] = await Promise.all([call('GET', `/users/${uid}/measurements`, params), call('GET', `/users/${uid}/summaries`, params), call('GET', `/users/${uid}/sleep`, params)]);
  for (const r of [m, s, sl]) if (r.status >= 400) throw new HttpError(502, 'validic_error', `Validic ${r.status}`);
  const meas = mapMeasurements(rows(m.json));
  const act = mapDays(rows(s.json), rows(sl.json), end);
  const created = meas.length ? (await addMeasurementsBatch(actor, patientRef, meas, 'Validic')).created : 0;
  if (act.days.length) await importActivity(actor, patientRef, { source: 'validic', device: act.device, days: act.days }, end);
  const result = { measurements: created, days: act.days.length };
  writePref(userId, 'validic', { ...pref, lastSyncAt: nowIso(), lastResult: result } satisfies ValidicPref);
  audit(actor, { action: 'C', subtype: 'validic-sync', patientRef, detail: result });
  return result;
}

/** Synchronizacja w tle (co 6 h) dla połączonych kont. */
export async function runValidicSweep(): Promise<number> {
  if (!validicConfigured() || config.demoMode) return 0;
  const rowsPref = getDb().prepare("SELECT p.user_id, u.fhir_ref FROM user_pref p JOIN app_user u ON u.id = p.user_id WHERE p.key = 'validic' AND u.status = 'active' AND u.fhir_ref IS NOT NULL").all() as { user_id: string; fhir_ref: string }[];
  let n = 0;
  for (const r of rowsPref) {
    try {
      await syncValidic({ display: 'Synchronizacja Validic' }, r.user_id, r.fhir_ref, 3);
      n++;
    } catch {
      /* następna próba w kolejnym przebiegu */
    }
  }
  return n;
}
