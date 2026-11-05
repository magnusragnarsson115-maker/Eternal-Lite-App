import { audit, type AuditActor } from '../audit.js';
import { getDb } from '../db.js';
import { AIR_LEVELS, airNear, weatherFor, type AirIndex, type Weather } from '../integrations/air.js';
import { badRequest, nowIso } from '../lib/util.js';
import { notifyUser } from './notifications.js';
import { getLocation, type UserLocation } from './personalReminders.js';

/**
 * Powietrze i pogoda w miejscu wybranym przez pacjenta (F5.1, F5.2) oraz powiadomienie o zmianie kategorii
 * indeksu GIOŚ (A3.6, F5.17). Próg wybiera pacjent; powiadomienie podaje kategorię GIOŚ i stację — bez porad
 * i bez danych o zdrowiu. Lokalizacja jest ustawieniem konta (nie profilu osoby pod opieką).
 */

export interface AirAlertPrefs {
  enabled: boolean;
  /** Powiadom od tej kategorii indeksu GIOŚ (0–5), domyślnie „Dostateczny”. */
  threshold: number;
  weatherStationId?: string;
  lastLevel?: number;
  lastNotifiedAt?: string;
}

const DEFAULT: AirAlertPrefs = { enabled: false, threshold: 3 };

export function getAirPrefs(userId: string): AirAlertPrefs {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'air'").get(userId) as { value: string } | undefined;
  return row ? { ...DEFAULT, ...(JSON.parse(row.value) as Partial<AirAlertPrefs>) } : DEFAULT;
}

function saveAirPrefs(userId: string, p: AirAlertPrefs): void {
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'air', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(p), nowIso());
}

export function setAirPrefs(actor: AuditActor, userId: string, input: { enabled?: boolean; threshold?: number; weatherStationId?: string | null }): AirAlertPrefs {
  if (input.threshold !== undefined && !(Number.isInteger(input.threshold) && input.threshold >= 1 && input.threshold <= 5)) throw badRequest('invalid_value');
  const cur = getAirPrefs(userId);
  const next: AirAlertPrefs = {
    ...cur,
    enabled: input.enabled ?? cur.enabled,
    threshold: input.threshold ?? cur.threshold,
    weatherStationId: input.weatherStationId === null ? undefined : (input.weatherStationId ?? cur.weatherStationId),
  };
  saveAirPrefs(userId, next);
  audit(actor, { action: 'U', subtype: 'air-alert-prefs', detail: { enabled: next.enabled, threshold: next.threshold } });
  return next;
}

export interface EnvironmentView {
  location?: UserLocation;
  air?: AirIndex;
  airError?: string;
  weather?: Weather;
  weatherStations: { id: string; name: string }[];
  weatherError?: string;
  prefs: AirAlertPrefs;
  levels: readonly string[];
}

const cityOf = (loc: UserLocation) => (loc.source === 'city' ? loc.label : loc.label.replace(/^okolice: /, ''));

export async function environmentView(userId: string): Promise<EnvironmentView> {
  const location = getLocation(userId);
  const prefs = getAirPrefs(userId);
  if (!location) return { weatherStations: [], prefs, levels: AIR_LEVELS };
  const [air, w] = await Promise.all([airNear(location), weatherFor({ stationId: prefs.weatherStationId, city: cityOf(location) })]);
  return { location, air: air.index, airError: air.error, weather: w.weather, weatherStations: w.stations, weatherError: w.error, prefs, levels: AIR_LEVELS };
}

/** Co godzinę: jedno powiadomienie, gdy indeks na najbliższej stacji przekroczy próg (i ponownie po spadku). */
export async function runAirAlertSweep(): Promise<number> {
  const rows = getDb()
    .prepare("SELECT p.user_id, p.value FROM user_pref p JOIN app_user u ON u.id = p.user_id WHERE p.key = 'air' AND u.status = 'active'")
    .all() as { user_id: string; value: string }[];
  let sent = 0;
  for (const r of rows) {
    const prefs = { ...DEFAULT, ...(JSON.parse(r.value) as Partial<AirAlertPrefs>) };
    if (!prefs.enabled) continue;
    const loc = getLocation(r.user_id);
    if (!loc) continue;
    const { index } = await airNear(loc);
    if (!index || index.level === undefined || index.demo) continue;
    const crossed = index.level >= prefs.threshold && (prefs.lastLevel === undefined || prefs.lastLevel < prefs.threshold);
    saveAirPrefs(r.user_id, { ...prefs, lastLevel: index.level, lastNotifiedAt: crossed ? nowIso() : prefs.lastNotifiedAt });
    if (!crossed) continue;
    await notifyUser(r.user_id, {
      kind: 'air-alert',
      title: `Jakość powietrza: ${index.category}`,
      body: `Według GIOŚ indeks jakości powietrza na stacji ${index.stationName ?? index.stationId}${index.calculatedAt ? ` (obliczenie z ${index.calculatedAt})` : ''}: ${index.category}. Szczegóły w aplikacji.`,
      link: '/powietrze',
      pushTitle: 'Eternal',
      pushBody: `Jakość powietrza w Twojej okolicy: ${index.category} (GIOŚ).`,
    });
    sent++;
  }
  return sent;
}
