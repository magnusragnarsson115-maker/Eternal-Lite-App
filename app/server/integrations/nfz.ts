import { config } from '../config.js';
import { fetchWithTimeout, HttpError } from '../lib/util.js';
import { cacheGet, cacheSet } from '../settings.js';

/**
 * NFZ — Informator o Terminach Leczenia (API Terminy Leczenia, dane otwarte, bez klucza).
 * https://api.nfz.gov.pl/app-itl-api/ — kolejki oczekujących i pierwszy wolny termin u świadczeniodawców
 * z umową z NFZ. Dane przekazują świadczeniodawcy; mogą być nieaktualne — interfejs to komunikuje.
 */

const BASE = 'https://api.nfz.gov.pl/app-itl-api';
const API_VERSION = '1.3';

export const PROVINCES: Record<string, string> = {
  '01': 'dolnośląskie',
  '02': 'kujawsko-pomorskie',
  '03': 'lubelskie',
  '04': 'lubuskie',
  '05': 'łódzkie',
  '06': 'małopolskie',
  '07': 'mazowieckie',
  '08': 'opolskie',
  '09': 'podkarpackie',
  '10': 'podlaskie',
  '11': 'pomorskie',
  '12': 'śląskie',
  '13': 'świętokrzyskie',
  '14': 'warmińsko-mazurskie',
  '15': 'wielkopolskie',
  '16': 'zachodniopomorskie',
};

export interface NfzQueueEntry {
  provider: string;
  place: string;
  address: string;
  locality: string;
  phone?: string;
  benefit: string;
  firstAvailableDate?: string;
  situationAsAt?: string;
  awaiting?: number;
  averagePeriodDays?: number;
  latitude?: number;
  longitude?: number;
  forChildren?: boolean;
}

interface NfzQueueAttributes {
  benefit?: string;
  provider?: string;
  place?: string;
  address?: string;
  locality?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  'benefits-for-children'?: string;
  dates?: { date?: string | null; 'date-situation-as-at'?: string | null } | null;
  statistics?: { 'provider-data'?: { awaiting?: number; 'average-period'?: number | null } | null } | null;
}

export function mapQueue(attrs: NfzQueueAttributes): NfzQueueEntry {
  const pd = attrs.statistics?.['provider-data'];
  return {
    provider: attrs.provider ?? '',
    place: attrs.place ?? '',
    address: attrs.address ?? '',
    locality: attrs.locality ?? '',
    phone: attrs.phone || undefined,
    benefit: attrs.benefit ?? '',
    firstAvailableDate: attrs.dates?.date ?? undefined,
    situationAsAt: attrs.dates?.['date-situation-as-at'] ?? undefined,
    awaiting: pd?.awaiting ?? undefined,
    averagePeriodDays: pd?.['average-period'] ?? undefined,
    latitude: attrs.latitude,
    longitude: attrs.longitude,
    forChildren: attrs['benefits-for-children'] === 'Y',
  };
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!config.publicApis.nfz) throw new HttpError(503, 'integration_disabled', 'NFZ API disabled');
  const q = new URLSearchParams({ ...params, format: 'json', 'api-version': API_VERSION });
  const key = `nfz:${path}?${q.toString()}`;
  const cached = cacheGet<T>(key);
  if (cached) return cached;
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}/${path}?${q.toString()}`, { headers: { Accept: 'application/json' } }, config.publicApis.timeoutMs);
  } catch (err) {
    throw new HttpError(502, 'upstream_unavailable', `NFZ API: ${(err as Error).message}`);
  }
  if (!res.ok) throw new HttpError(502, 'upstream_error', `NFZ API returned ${res.status}`);
  const json = (await res.json()) as T;
  cacheSet(key, json, 6 * 3600);
  return json;
}

export async function searchBenefits(name: string): Promise<string[]> {
  if (name.trim().length < 3) return [];
  const json = await call<{ data?: string[] }>('benefits', { name: name.trim(), page: '1', limit: '25' });
  return json.data ?? [];
}

export async function searchQueues(input: {
  benefit: string;
  province: string;
  urgent?: boolean;
  locality?: string;
  forChildren?: boolean;
  page?: number;
}): Promise<{ items: NfzQueueEntry[]; total?: number; hasMore: boolean }> {
  if (!PROVINCES[input.province]) throw new HttpError(400, 'invalid_province');
  if (input.benefit.trim().length < 3) throw new HttpError(400, 'benefit_required');
  const params: Record<string, string> = {
    case: input.urgent ? '2' : '1',
    province: input.province,
    benefit: input.benefit.trim(),
    page: String(input.page ?? 1),
    limit: '25',
  };
  if (input.locality?.trim()) params.locality = input.locality.trim();
  if (input.forChildren !== undefined) params.benefitForChildren = input.forChildren ? 'true' : 'false';
  const json = await call<{
    meta?: { count?: number; links?: { next?: string | null } };
    links?: { next?: string | null };
    data?: { attributes?: NfzQueueAttributes }[];
  }>('queues', params);
  const items = (json.data ?? []).map((d) => mapQueue(d.attributes ?? {}));
  items.sort((a, b) => (a.firstAvailableDate ?? '9999').localeCompare(b.firstAvailableDate ?? '9999'));
  return { items, total: json.meta?.count, hasMore: !!(json.links?.next ?? json.meta?.links?.next) };
}

export async function nfzHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await searchBenefits('kardio');
    return { ok: true, detail: `API odpowiada (${r.length} pozycji słownika)` };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}
