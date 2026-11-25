import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import { cacheGet, cacheSet } from '../settings.js';

/**
 * Open Food Facts — otwarta baza produktów spożywczych (licencja ODbL, bez klucza) do dziennika żywienia (F11.3).
 * Do bazy trafia wyłącznie kod kreskowy albo wpisana nazwa produktu — bez identyfikatora pacjenta i bez
 * zawartości dziennika. Wartości odżywcze na 100 g pochodzą od producenta/społeczności; pacjent może je poprawić
 * przed zapisem. Limity usługi: 100 zapytań/min o produkt, 10/min wyszukiwań — stąd pamięć podręczna.
 *
 * Dokumentacja: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_pl,brands,quantity,nutriments';
const USER_AGENT = 'Eternal/1.0 (aplikacja pacjenta; dziennik zywienia)';

export interface FoodProduct {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  source: 'openfoodfacts' | 'demo';
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  brands?: string;
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : undefined;
}

/** Produkt z odpowiedzi Open Food Facts → pozycja dziennika (kcal: energy-kcal_100g, a gdy brak — kJ / 4,184). */
export function parseOffProduct(p: OffProduct | undefined): FoodProduct | undefined {
  if (!p?.code) return undefined;
  const name = (p.product_name_pl || p.product_name || '').trim();
  if (!name) return undefined;
  const n = p.nutriments ?? {};
  const kj = num(n['energy-kj_100g'] ?? n.energy_100g);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? Math.round(kj / 4.184) : undefined);
  return {
    barcode: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    quantity: p.quantity || undefined,
    kcal100: kcal,
    protein100: num(n.proteins_100g),
    fat100: num(n.fat_100g),
    carbs100: num(n.carbohydrates_100g),
    source: 'openfoodfacts',
  };
}

/** Produkty pokazowe — tylko w trybie demo, gdy usługa jest niedostępna (oznaczone w aplikacji jako przykładowe). */
const DEMO: FoodProduct[] = [
  { barcode: '5900000000017', name: 'Jogurt naturalny 2% (przykład)', brand: 'Produkt pokazowy', kcal100: 61, protein100: 4.3, fat100: 2, carbs100: 6.2, source: 'demo' },
  { barcode: '5900000000024', name: 'Płatki owsiane górskie (przykład)', brand: 'Produkt pokazowy', kcal100: 372, protein100: 13.5, fat100: 7, carbs100: 59, source: 'demo' },
  { barcode: '5900000000031', name: 'Chleb żytni razowy (przykład)', brand: 'Produkt pokazowy', kcal100: 220, protein100: 6, fat100: 1.5, carbs100: 42, source: 'demo' },
];

async function offGet(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }, config.publicApis.timeoutMs);
  if (!res.ok && res.status !== 404) throw new Error(`Open Food Facts returned ${res.status}`);
  return res.status === 404 ? { status: 0 } : res.json();
}

export async function foodByBarcode(barcode: string): Promise<{ product?: FoodProduct; remoteError?: string }> {
  if (!/^\d{8,14}$/.test(barcode)) return {};
  const key = `off:product:${barcode}`;
  const cached = cacheGet<{ product?: FoodProduct }>(key);
  if (cached) return cached;
  if (!config.publicApis.openFoodFacts) return { product: config.demoMode ? DEMO.find((d) => d.barcode === barcode) : undefined, remoteError: 'disabled' };
  try {
    const json = (await offGet(`${BASE}/api/v2/product/${barcode}?fields=${FIELDS}`)) as { status?: number; product?: OffProduct };
    const out = { product: json.status === 1 ? parseOffProduct({ ...json.product, code: json.product?.code ?? barcode }) : undefined };
    cacheSet(key, out, 7 * 24 * 3600);
    return out;
  } catch (err) {
    return { product: config.demoMode ? DEMO.find((d) => d.barcode === barcode) : undefined, remoteError: (err as Error).message };
  }
}

export async function searchFood(term: string): Promise<{ items: FoodProduct[]; remoteError?: string }> {
  const t = term.trim();
  if (t.length < 3) return { items: [] };
  const key = `off:search:${t.toLowerCase()}`;
  const cached = cacheGet<{ items: FoodProduct[] }>(key);
  if (cached) return cached;
  const demo = () => DEMO.filter((d) => d.name.toLowerCase().includes(t.toLowerCase().slice(0, 4)));
  if (!config.publicApis.openFoodFacts) return { items: config.demoMode ? demo() : [], remoteError: 'disabled' };
  try {
    const q = new URLSearchParams({ search_terms: t, search_simple: '1', action: 'process', json: '1', page_size: '10', fields: FIELDS, lc: 'pl', cc: 'pl' });
    const json = (await offGet(`${BASE}/cgi/search.pl?${q}`)) as { products?: OffProduct[] };
    const out = { items: (json.products ?? []).map(parseOffProduct).filter((p): p is FoodProduct => !!p) };
    cacheSet(key, out, 24 * 3600);
    return out;
  } catch (err) {
    return { items: config.demoMode ? demo() : [], remoteError: (err as Error).message };
  }
}
