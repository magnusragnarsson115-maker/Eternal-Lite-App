import { config } from '../config.js';
import { distanceKm } from '../lib/geo.js';
import { fetchWithTimeout } from '../lib/util.js';
import { cacheGet, cacheSet } from '../settings.js';

/**
 * Jakość powietrza i pogoda z publicznych danych (F5.1, F5.2, A3.6, F5.17) — bez klucza i bez danych pacjenta:
 * - GIOŚ, API PJP v1 (api.gios.gov.pl/pjp-api/v1/rest): lista stacji z współrzędnymi i Polski Indeks Jakości
 *   Powietrza dla stacji. Najbliższą stację wybieramy na serwerze; do GIOŚ idzie tylko numer stacji.
 * - IMGW-PIB (danepubliczne.imgw.pl/api/data/synop): bieżące dane ze stacji synoptycznych.
 *
 * To informacja z urzędowego źródła z datą pomiaru. Aplikacja nie wydaje zaleceń zdrowotnych; przy indeksie
 * GIOŚ pokazujemy nazwę kategorii tak, jak podaje ją GIOŚ.
 */

const GIOS = 'https://api.gios.gov.pl/pjp-api/v1/rest';
const IMGW_SYNOP = 'https://danepubliczne.imgw.pl/api/data/synop';
export const AIR_SOURCE = 'Główny Inspektorat Ochrony Środowiska (GIOŚ), Polski Indeks Jakości Powietrza';
export const WEATHER_SOURCE = 'Instytut Meteorologii i Gospodarki Wodnej — PIB (IMGW-PIB), dane synoptyczne';

export interface AirStation {
  id: number;
  name: string;
  city?: string;
  lat: number;
  lon: number;
}

/** Kategorie Polskiego Indeksu Jakości Powietrza (0–5) w kolejności GIOŚ. */
export const AIR_LEVELS = ['Bardzo dobry', 'Dobry', 'Umiarkowany', 'Dostateczny', 'Zły', 'Bardzo zły'] as const;

export interface AirIndex {
  stationId: number;
  stationName?: string;
  distanceKm?: number;
  /** 0–5 albo undefined, gdy GIOŚ zwraca „Brak indeksu”. */
  level?: number;
  category?: string;
  calculatedAt?: string;
  sourceDataAt?: string;
  pollutants: { code: string; level?: number; category?: string }[];
  critical?: string;
  source: string;
  demo?: boolean;
}

export interface Weather {
  stationId: string;
  station: string;
  measuredAt?: string;
  temperature?: number;
  windSpeed?: number;
  windDirection?: number;
  humidity?: number;
  precipitation?: number;
  pressure?: number;
  source: string;
  demo?: boolean;
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Strona listy stacji GIOŚ (JSON-LD, nazwy pól po polsku). */
export function parseGiosStations(json: unknown): { stations: AirStation[]; totalPages: number } {
  const o = json as Record<string, unknown>;
  const list = (o['Lista stacji pomiarowych'] ?? []) as Record<string, unknown>[];
  const stations: AirStation[] = [];
  for (const s of list) {
    const id = num(s['Identyfikator stacji']);
    const lat = num(s['WGS84 φ N']);
    const lon = num(s['WGS84 λ E']);
    if (id === undefined || lat === undefined || lon === undefined) continue;
    stations.push({ id, name: String(s['Nazwa stacji'] ?? ''), city: s['Nazwa miasta'] ? String(s['Nazwa miasta']) : undefined, lat, lon });
  }
  return { stations, totalPages: Math.max(1, num(o.totalPages) ?? 1) };
}

const POLLUTANTS = ['PM10', 'PM2.5', 'O3', 'NO2', 'SO2'];

export function parseGiosIndex(json: unknown): AirIndex | undefined {
  const a = (json as Record<string, unknown>)?.AqIndex as Record<string, unknown> | undefined;
  if (!a) return undefined;
  const stationId = num(a['Identyfikator stacji pomiarowej']);
  if (stationId === undefined) return undefined;
  const level = num(a['Wartość indeksu']);
  const valid = a['Status indeksu ogólnego dla stacji pomiarowej'] !== false && level !== undefined && level >= 0 && level <= 5;
  return {
    stationId,
    level: valid ? level : undefined,
    category: valid ? String(a['Nazwa kategorii indeksu'] ?? AIR_LEVELS[level!]) : 'Brak indeksu',
    calculatedAt: a['Data wykonania obliczeń indeksu'] ? String(a['Data wykonania obliczeń indeksu']) : undefined,
    sourceDataAt: a['Data danych źródłowych, z których policzono wartość indeksu dla wskaźnika st'] ? String(a['Data danych źródłowych, z których policzono wartość indeksu dla wskaźnika st']) : undefined,
    pollutants: POLLUTANTS.map((code) => {
      const l = num(a[`Wartość indeksu dla wskaźnika ${code}`]);
      // w odpowiedzi GIOŚ pole kategorii ma literówkę „wskażnika” — sprawdzamy obie pisownie
      const c = a[`Nazwa kategorii indeksu dla wskażnika ${code}`] ?? a[`Nazwa kategorii indeksu dla wskaźnika ${code}`];
      return { code, level: l, category: c ? String(c) : undefined };
    }).filter((p) => p.level !== undefined),
    critical: a['Kod zanieczyszczenia krytycznego'] ? String(a['Kod zanieczyszczenia krytycznego']) : undefined,
    source: AIR_SOURCE,
  };
}

export function parseImgwSynop(json: unknown): Weather[] {
  if (!Array.isArray(json)) return [];
  return (json as Record<string, unknown>[])
    .filter((r) => r.id_stacji && r.stacja)
    .map((r) => {
      const date = r.data_pomiaru ? String(r.data_pomiaru) : undefined;
      const hour = r.godzina_pomiaru !== undefined && r.godzina_pomiaru !== null ? String(r.godzina_pomiaru).padStart(2, '0') : undefined;
      return {
        stationId: String(r.id_stacji),
        station: String(r.stacja),
        // IMGW podaje datę i pełną godzinę pomiaru w czasie UTC
        measuredAt: date && hour ? `${date}T${hour}:00:00Z` : undefined,
        temperature: num(r.temperatura),
        windSpeed: num(r.predkosc_wiatru),
        windDirection: num(r.kierunek_wiatru),
        humidity: num(r.wilgotnosc_wzgledna),
        precipitation: num(r.suma_opadu),
        pressure: num(r.cisnienie),
        source: WEATHER_SOURCE,
      };
    });
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, config.publicApis.timeoutMs);
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

export async function giosStations(): Promise<AirStation[]> {
  const cached = cacheGet<AirStation[]>('gios:stations');
  if (cached) return cached;
  if (!config.publicApis.gios) return config.demoMode ? DEMO_STATIONS : [];
  const first = parseGiosStations(await getJson(`${GIOS}/station/findAll?page=0&size=500`));
  const all = [...first.stations];
  for (let p = 1; p < Math.min(first.totalPages, 10); p++) all.push(...parseGiosStations(await getJson(`${GIOS}/station/findAll?page=${p}&size=500`)).stations);
  cacheSet('gios:stations', all, 24 * 3600);
  return all;
}

export function nearestStation(stations: AirStation[], at: { lat: number; lon: number }): (AirStation & { distanceKm: number }) | undefined {
  let best: (AirStation & { distanceKm: number }) | undefined;
  for (const s of stations) {
    const d = distanceKm(at, s);
    if (!best || d < best.distanceKm) best = { ...s, distanceKm: Math.round(d * 10) / 10 };
  }
  return best;
}

/** Indeks dla najbliższej stacji (do 30 km). Błąd usługi → w trybie demo dane pokazowe z oznaczeniem. */
export async function airNear(at: { lat: number; lon: number }): Promise<{ index?: AirIndex; error?: string }> {
  try {
    const st = nearestStation(await giosStations(), at);
    if (!st || st.distanceKm > 30) return { error: 'no_station_nearby' };
    const key = `gios:index:${st.id}`;
    let idx = cacheGet<AirIndex>(key);
    if (!idx) {
      if (!config.publicApis.gios) throw new Error('GIOS_API_ENABLED=false');
      idx = parseGiosIndex(await getJson(`${GIOS}/aqindex/getIndex/${st.id}`));
      if (!idx) throw new Error('GIOŚ: nieoczekiwany format odpowiedzi');
      cacheSet(key, idx, 20 * 60);
    }
    return { index: { ...idx, stationName: st.name, distanceKm: st.distanceKm } };
  } catch (err) {
    if (config.demoMode) return { index: demoIndex(at), error: (err as Error).message };
    return { error: (err as Error).message };
  }
}

export async function synopAll(): Promise<Weather[]> {
  const cached = cacheGet<Weather[]>('imgw:synop');
  if (cached) return cached;
  if (!config.publicApis.imgw) throw new Error('IMGW_API_ENABLED=false');
  const list = parseImgwSynop(await getJson(IMGW_SYNOP));
  cacheSet('imgw:synop', list, 20 * 60);
  return list;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');

/** Stacja synoptyczna wybrana przez pacjenta albo o nazwie miasta z lokalizacji. */
export async function weatherFor(input: { stationId?: string; city?: string }): Promise<{ weather?: Weather; stations: { id: string; name: string }[]; error?: string }> {
  try {
    const list = await synopAll();
    const stations = list.map((w) => ({ id: w.stationId, name: w.station })).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    const weather = list.find((w) => w.stationId === input.stationId) ?? (input.city ? list.find((w) => fold(w.station) === fold(input.city!)) ?? list.find((w) => fold(input.city!).startsWith(fold(w.station))) : undefined);
    return { weather, stations };
  } catch (err) {
    if (config.demoMode) return { weather: { ...DEMO_WEATHER, station: input.city ?? DEMO_WEATHER.station }, stations: [{ id: DEMO_WEATHER.stationId, name: DEMO_WEATHER.station }], error: (err as Error).message };
    return { stations: [], error: (err as Error).message };
  }
}

// --- dane pokazowe (tylko DEMO_MODE, zawsze oznaczone) ------------------------------------------------------------

const DEMO_STATIONS: AirStation[] = [
  { id: 552, name: 'Warszawa, ul. Kondratowicza', city: 'Warszawa', lat: 52.290864, lon: 21.042458 },
  { id: 400, name: 'Kraków, al. Krasińskiego', city: 'Kraków', lat: 50.057678, lon: 19.926189 },
];

function demoIndex(at: { lat: number; lon: number }): AirIndex {
  const st = nearestStation(DEMO_STATIONS, at)!;
  return {
    stationId: st.id,
    stationName: `${st.name} (dane pokazowe)`,
    distanceKm: st.distanceKm,
    level: 1,
    category: 'Dobry',
    pollutants: [
      { code: 'PM10', level: 0, category: 'Bardzo dobry' },
      { code: 'PM2.5', level: 1, category: 'Dobry' },
    ],
    source: `${AIR_SOURCE} — DANE POKAZOWE, nie pochodzą z GIOŚ`,
    demo: true,
  };
}

const DEMO_WEATHER: Weather = {
  stationId: '12375',
  station: 'Warszawa',
  temperature: 11.4,
  windSpeed: 3,
  windDirection: 240,
  humidity: 78,
  precipitation: 0,
  pressure: 1016.2,
  source: `${WEATHER_SOURCE} — DANE POKAZOWE, nie pochodzą z IMGW`,
  demo: true,
};
