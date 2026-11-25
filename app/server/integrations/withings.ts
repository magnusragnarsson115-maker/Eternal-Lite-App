import type { AuditActor } from '../audit.js';
import { issueToken, consumeToken } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fetchWithTimeout, HttpError, nowIso } from '../lib/util.js';
import { addMeasurement, type MeasurementInput } from '../services/observations.js';
import { importActivity, type ActivityDayInput } from '../services/activity.js';

/**
 * Withings Public Health Data API (bezpłatne konto deweloperskie, OAuth 2.0).
 * Ciśnieniomierze, wagi, termometry i pulsoksymetry Withings — pomiary trafiają jako FHIR Observation.
 * Wymaga WITHINGS_CLIENT_ID i WITHINGS_CLIENT_SECRET oraz adresu zwrotnego {PUBLIC_URL}/api/integrations/withings/callback.
 */

const AUTHORIZE = 'https://account.withings.com/oauth2_user/authorize2';
const TOKEN = 'https://wbsapi.withings.net/v2/oauth2';
const MEASURE = 'https://wbsapi.withings.net/measure';
const SLEEP = 'https://wbsapi.withings.net/v2/sleep';

/** Typy pomiarów Withings (meastype). */
export const MEASTYPE = { weight: 1, height: 4, diastolic: 9, systolic: 10, pulse: 11, spo2: 54, bodyTemp: 71 } as const;

export function withingsConfigured(): boolean {
  return !!(config.withings.clientId && config.withings.clientSecret);
}

function redirectUri(): string {
  return `${config.publicUrl}/api/integrations/withings/callback`;
}

export function authorizeUrl(userId: string): string {
  if (!withingsConfigured()) throw new HttpError(503, 'integration_not_configured');
  const state = issueToken('oauth-state', { userId, payload: { provider: 'withings' }, ttlMinutes: 15 });
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: config.withings.clientId,
    // user.activity — podsumowania snu z Withings Sleep (F2.19)
    scope: 'user.metrics,user.activity',
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTHORIZE}?${q.toString()}`;
}

interface TokenBody {
  userid: string | number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenBody> {
  const res = await fetchWithTimeout(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ action: 'requesttoken', client_id: config.withings.clientId, client_secret: config.withings.clientSecret, ...params }),
  });
  const json = (await res.json()) as { status: number; body?: TokenBody; error?: string };
  if (json.status !== 0 || !json.body) throw new HttpError(502, 'withings_token_error', json.error ?? `status ${json.status}`);
  return json.body;
}

function saveToken(userId: string, t: TokenBody): void {
  getDb()
    .prepare(
      `INSERT INTO integration_token (provider, user_id, external_user_id, access_token, refresh_token, expires_at, scope, created_at)
       VALUES ('withings', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, user_id) DO UPDATE SET external_user_id = excluded.external_user_id, access_token = excluded.access_token,
         refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, scope = excluded.scope`,
    )
    .run(userId, String(t.userid), t.access_token, t.refresh_token, new Date(Date.now() + t.expires_in * 1000).toISOString(), t.scope, nowIso());
}

export async function handleCallback(code: string, state: string): Promise<string> {
  const st = consumeToken<{ provider: string }>('oauth-state', state);
  if (!st || st.payload?.provider !== 'withings' || !st.userId) throw new HttpError(400, 'invalid_oauth_state');
  const token = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  saveToken(st.userId, token);
  return st.userId;
}

async function accessToken(userId: string): Promise<string> {
  const row = getDb().prepare("SELECT * FROM integration_token WHERE provider = 'withings' AND user_id = ?").get(userId) as
    | { access_token: string; refresh_token: string; expires_at: string }
    | undefined;
  if (!row) throw new HttpError(409, 'withings_not_connected');
  if (Date.parse(row.expires_at) > Date.now() + 60_000) return row.access_token;
  const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
  saveToken(userId, refreshed);
  return refreshed.access_token;
}

export interface WithingsMeasureGroup {
  grpid: number;
  date: number;
  category?: number;
  deviceid?: string | null;
  measures: { value: number; type: number; unit: number }[];
}

/** Grupa pomiarowa Withings → wejście do addMeasurement (wartość = value × 10^unit). */
export function mapMeasureGroup(g: WithingsMeasureGroup): MeasurementInput[] {
  const v = (type: number) => {
    const m = g.measures.find((x) => x.type === type);
    return m ? Math.round(m.value * 10 ** m.unit * 100) / 100 : undefined;
  };
  const effective = new Date(g.date * 1000).toISOString();
  const common = { effective, source: 'withings' as const, device: g.deviceid ? `Withings ${g.deviceid.slice(0, 8)}` : 'Withings' };
  const out: MeasurementInput[] = [];
  const sys = v(MEASTYPE.systolic);
  const dia = v(MEASTYPE.diastolic);
  if (sys !== undefined && dia !== undefined) {
    out.push({ ...common, kind: 'bp', systolic: sys, diastolic: dia, pulse: v(MEASTYPE.pulse), externalId: `withings:${g.grpid}:bp` });
  } else if (v(MEASTYPE.pulse) !== undefined) {
    out.push({ ...common, kind: 'heartRate', value: v(MEASTYPE.pulse), externalId: `withings:${g.grpid}:hr` });
  }
  if (v(MEASTYPE.weight) !== undefined) out.push({ ...common, kind: 'weight', value: v(MEASTYPE.weight), externalId: `withings:${g.grpid}:w` });
  const h = v(MEASTYPE.height);
  if (h !== undefined) out.push({ ...common, kind: 'height', value: Math.round(h * 1000) / 10, externalId: `withings:${g.grpid}:h` });
  if (v(MEASTYPE.spo2) !== undefined) out.push({ ...common, kind: 'spo2', value: v(MEASTYPE.spo2), externalId: `withings:${g.grpid}:spo2` });
  if (v(MEASTYPE.bodyTemp) !== undefined) out.push({ ...common, kind: 'temperature', value: v(MEASTYPE.bodyTemp), externalId: `withings:${g.grpid}:t` });
  return out;
}

export async function syncWithings(actor: AuditActor, userId: string, patientRef: string): Promise<{ imported: number; skipped: number }> {
  const token = await accessToken(userId);
  const row = getDb().prepare("SELECT last_sync_at FROM integration_token WHERE provider = 'withings' AND user_id = ?").get(userId) as { last_sync_at: string | null };
  const since = row.last_sync_at ? Math.floor(Date.parse(row.last_sync_at) / 1000) - 3600 : Math.floor(Date.now() / 1000) - 90 * 86400;
  let imported = 0;
  let skipped = 0;
  let offset: number | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      action: 'getmeas',
      meastypes: Object.values(MEASTYPE).join(','),
      category: '1',
      lastupdate: String(since),
      ...(offset ? { offset: String(offset) } : {}),
    });
    const res = await fetchWithTimeout(MEASURE, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    const json = (await res.json()) as { status: number; body?: { measuregrps: WithingsMeasureGroup[]; more?: number; offset?: number } };
    if (json.status !== 0 || !json.body) throw new HttpError(502, 'withings_api_error', `status ${json.status}`);
    for (const g of json.body.measuregrps) {
      for (const input of mapMeasureGroup(g)) {
        try {
          await addMeasurement(actor, patientRef, input);
          imported++;
        } catch {
          skipped++;
        }
      }
    }
    if (!json.body.more) break;
    offset = json.body.offset;
  }
  // sen (Withings Sleep i zegarki): podsumowanie nocy — błąd tej części nie przerywa importu pomiarów
  try {
    const nights = await fetchSleepSummary(token, new Date(since * 1000).toISOString().slice(0, 10), nowIso().slice(0, 10));
    if (nights.length) {
      const r = await importActivity(actor, patientRef, { source: 'withings', device: 'Withings', days: nights });
      imported += r.created + r.updated;
    }
  } catch {
    skipped++;
  }
  getDb().prepare("UPDATE integration_token SET last_sync_at = ? WHERE provider = 'withings' AND user_id = ?").run(nowIso(), userId);
  return { imported, skipped };
}

/** Odpowiedź Sleep v2 getsummary: czasy w sekundach → minuty; dzień nocy wg pola date (YYYY-MM-DD). */
export interface WithingsSleepSeries {
  date?: string;
  startdate?: number;
  enddate?: number;
  data?: { total_sleep_time?: number; deepsleepduration?: number; lightsleepduration?: number; remsleepduration?: number; wakeupduration?: number };
}

export function mapSleepSeries(series: WithingsSleepSeries[]): ActivityDayInput[] {
  const min = (s?: number) => (s === undefined ? undefined : Math.round(s / 60));
  return series
    .filter((x) => x.date && x.data?.total_sleep_time !== undefined)
    .map((x) => ({
      date: x.date!,
      sleep: {
        minutes: min(x.data!.total_sleep_time)!,
        deep: min(x.data!.deepsleepduration),
        light: min(x.data!.lightsleepduration),
        rem: min(x.data!.remsleepduration),
        awake: min(x.data!.wakeupduration),
        start: x.startdate ? new Date(x.startdate * 1000).toISOString() : undefined,
        end: x.enddate ? new Date(x.enddate * 1000).toISOString() : undefined,
      },
    }));
}

async function fetchSleepSummary(token: string, from: string, to: string): Promise<ActivityDayInput[]> {
  const params = new URLSearchParams({
    action: 'getsummary',
    startdateymd: from,
    enddateymd: to,
    data_fields: 'total_sleep_time,deepsleepduration,lightsleepduration,remsleepduration,wakeupduration',
  });
  const res = await fetchWithTimeout(SLEEP, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const json = (await res.json()) as { status: number; body?: { series?: WithingsSleepSeries[] } };
  if (json.status !== 0) throw new HttpError(502, 'withings_api_error', `sleep status ${json.status}`);
  return mapSleepSeries(json.body?.series ?? []);
}

export function withingsStatus(userId: string): { connected: boolean; lastSyncAt?: string } {
  const row = getDb().prepare("SELECT last_sync_at FROM integration_token WHERE provider = 'withings' AND user_id = ?").get(userId) as
    | { last_sync_at: string | null }
    | undefined;
  return { connected: !!row, lastSyncAt: row?.last_sync_at ?? undefined };
}

export function disconnectWithings(userId: string): void {
  getDb().prepare("DELETE FROM integration_token WHERE provider = 'withings' AND user_id = ?").run(userId);
}
