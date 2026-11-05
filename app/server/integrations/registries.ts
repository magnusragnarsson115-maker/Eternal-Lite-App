import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb, transaction } from '../db.js';
import { columnIndex, findHeader, normHeader, parseCsvRows, searchText } from '../lib/csv.js';
import { distanceKm } from '../lib/geo.js';

/**
 * Rejestry publiczne bez wysyłania zapytań pacjentów na zewnątrz (F7.1, F7.2, F7.7): operator pobiera plik
 * ze strony urzędu i importuje go do lokalnej tabeli, a aplikacja wyszukuje lokalnie.
 *
 * - Rejestr Aptek (rejestrymedyczne.ezdrowie.gov.pl, eksport CSV) — `npm run cli -- import-pharmacies <plik.csv>`.
 * - Obwieszczenie Ministra Zdrowia w sprawie wykazu refundowanych leków (arkusz zapisany jako CSV, po jednym
 *   pliku na wykaz A1, A2, …) — `npm run cli -- import-refund <plik.csv> --list A1 --title "…" --valid-from RRRR-MM-DD`.
 *
 * Nazwy kolumn bywają różne między wydaniami, dlatego szukamy ich po synonimach. Wykaz refundacyjny to
 * informacja z obwieszczenia: o refundacji na recepcie decyduje lekarz według wskazań, a cenę — apteka.
 */

// --- apteki ---------------------------------------------------------------------------------------------------

export interface Pharmacy {
  id: string;
  name: string;
  kind?: string;
  street?: string;
  postcode?: string;
  city?: string;
  voivodeship?: string;
  phone?: string;
  hours?: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
}

const PH = {
  name: ['nazwa apteki', 'nazwa', 'nazwa punktu'],
  kind: ['rodzaj apteki', 'rodzaj', 'typ apteki', 'typ'],
  street: ['ulica', 'adres ulica', 'adres'],
  number: ['numer domu', 'nr domu', 'numer budynku'],
  local: ['numer lokalu', 'nr lokalu'],
  postcode: ['kod pocztowy', 'kod'],
  city: ['miejscowosc', 'miasto', 'poczta'],
  voivodeship: ['wojewodztwo'],
  phone: ['telefon', 'numer telefonu', 'tel'],
  hours: ['godziny pracy', 'godziny otwarcia', 'godziny'],
  lat: ['szerokosc geograficzna', 'szerokosc', 'latitude', 'lat'],
  lon: ['dlugosc geograficzna', 'dlugosc', 'longitude', 'lon'],
  status: ['status', 'stan', 'status apteki'],
  id: ['identyfikator', 'id', 'numer zezwolenia', 'nr zezwolenia', 'numer w rejestrze'],
};

const coord = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

export function importPharmaciesCsv(text: string): { imported: number; skipped: number; withCoordinates: number } {
  const rows = parseCsvRows(text);
  const header = findHeader(rows, [PH.name, PH.city]);
  if (!header) throw new Error('Nie znaleziono kolumn z nazwą apteki i miejscowością w nagłówku pliku.');
  const h = rows[header.index];
  const col = Object.fromEntries(Object.entries(PH).map(([k, syn]) => [k, columnIndex(h, syn)])) as Record<keyof typeof PH, number>;
  const at = (r: string[], k: keyof typeof PH) => (col[k] >= 0 ? r[col[k]]?.trim() || undefined : undefined);
  let imported = 0;
  let skipped = 0;
  let withCoordinates = 0;
  const db = getDb();
  transaction(db, () => {
    db.prepare('DELETE FROM pharmacy').run();
    const ins = db.prepare(
      'INSERT OR REPLACE INTO pharmacy (id, name, kind, street, postcode, city, voivodeship, phone, hours, lat, lon, status, search_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const r of rows.slice(header.index + 1)) {
      const name = at(r, 'name');
      const city = at(r, 'city');
      const status = at(r, 'status');
      // wykreślone, cofnięte i wygaszone zezwolenia pomijamy; zawieszone też (apteka nie działa)
      if (!name || !city || (status && /wykresl|cofni|wygas|zawiesz|zamkni/i.test(normHeader(status)))) {
        skipped++;
        continue;
      }
      const street = [at(r, 'street'), [at(r, 'number'), at(r, 'local')].filter(Boolean).join('/')].filter(Boolean).join(' ') || undefined;
      const lat = coord(at(r, 'lat'));
      const lon = coord(at(r, 'lon'));
      if (lat !== undefined && lon !== undefined) withCoordinates++;
      const id = at(r, 'id') ?? crypto.createHash('sha1').update(`${name}|${street}|${city}`).digest('hex').slice(0, 16);
      ins.run(id, name.slice(0, 200), at(r, 'kind') ?? null, street ?? null, at(r, 'postcode') ?? null, city, at(r, 'voivodeship') ?? null, at(r, 'phone') ?? null, at(r, 'hours') ?? null, lat ?? null, lon ?? null, status ?? null, searchText(name, street, city, at(r, 'postcode')));
      imported++;
    }
  });
  setMeta('pharmacies', { importedAt: new Date().toISOString(), count: imported });
  return { imported, skipped, withCoordinates };
}

interface PharmacyRow {
  id: string;
  name: string;
  kind: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  voivodeship: string | null;
  phone: string | null;
  hours: string | null;
  lat: number | null;
  lon: number | null;
}

const toPharmacy = (r: PharmacyRow): Pharmacy => ({
  id: r.id,
  name: r.name,
  kind: r.kind ?? undefined,
  street: r.street ?? undefined,
  postcode: r.postcode ?? undefined,
  city: r.city ?? undefined,
  voivodeship: r.voivodeship ?? undefined,
  phone: r.phone ?? undefined,
  hours: r.hours ?? undefined,
  lat: r.lat ?? undefined,
  lon: r.lon ?? undefined,
});

/** Wyszukiwanie: tekst (nazwa, ulica, miejscowość, kod) i/lub najbliższe od punktu (gdy rejestr ma współrzędne). */
export function searchPharmacies(input: { q?: string; city?: string; near?: { lat: number; lon: number }; limit?: number }): Pharmacy[] {
  const limit = Math.min(input.limit ?? 20, 50);
  const where: string[] = [];
  const args: string[] = [];
  if (input.q?.trim()) {
    where.push('search_text LIKE ?');
    args.push(`%${normHeader(input.q)}%`);
  }
  if (input.city?.trim()) {
    where.push('search_text LIKE ?');
    args.push(`%${normHeader(input.city)}%`);
  }
  if (input.near) {
    // wstępne zawężenie prostokątem ok. ±15 km, dokładna odległość po kole wielkim
    where.push('lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?');
    args.push(String(input.near.lat - 0.14), String(input.near.lat + 0.14), String(input.near.lon - 0.22), String(input.near.lon + 0.22));
  }
  if (!where.length) return [];
  const rows = getDb()
    .prepare(`SELECT * FROM pharmacy WHERE ${where.join(' AND ')} ${input.near ? '' : 'ORDER BY city, name'} LIMIT ?`)
    .all(...args, input.near ? 2000 : limit) as unknown as PharmacyRow[];
  const items = rows.map(toPharmacy);
  if (!input.near) return items;
  const near = input.near;
  return items
    .map((p) => ({ ...p, distanceKm: Math.round(distanceKm(near, { lat: p.lat!, lon: p.lon! }) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export function pharmacyCount(): { total: number; withCoordinates: number } {
  const r = getDb().prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END) AS geo FROM pharmacy').get() as { total: number; geo: number | null };
  return { total: r.total, withCoordinates: r.geo ?? 0 };
}

// --- wykaz leków refundowanych ----------------------------------------------------------------------------------

export interface RefundItem {
  gtin?: string;
  substance?: string;
  name: string;
  pack?: string;
  limitGroup?: string;
  retailPrice?: string;
  limitAmount?: string;
  indications?: string;
  offLabel?: string;
  paymentLevel?: string;
  copay?: string;
  list?: string;
}

const RF = {
  substance: ['substancja czynna'],
  name: ['nazwa postac i dawka', 'nazwa postac i dawka leku', 'nazwa'],
  pack: ['zawartosc opakowania', 'opakowanie'],
  gtin: ['kod ean lub inny kod odpowiadajacy kodowi ean', 'kod ean', 'ean', 'gtin'],
  limitGroup: ['grupa limitowa'],
  retailPrice: ['cena detaliczna'],
  limitAmount: ['wysokosc limitu finansowania', 'limit finansowania'],
  indications: ['zakres wskazan objetych refundacja', 'zakres wskazan'],
  offLabel: ['zakres wskazan pozarejestracyjnych objetych refundacja', 'zakres wskazan pozarejestracyjnych'],
  paymentLevel: ['poziom odplatnosci'],
  copay: ['wysokosc doplaty swiadczeniobiorcy', 'doplata swiadczeniobiorcy', 'doplata'],
};

export function importRefundCsv(text: string, opts: { list?: string; title?: string; validFrom?: string; append?: boolean } = {}): { imported: number; skipped: number } {
  const rows = parseCsvRows(text);
  const header = findHeader(rows, [RF.substance, RF.name], 25);
  if (!header) throw new Error('Nie znaleziono kolumn „Substancja czynna” i „Nazwa, postać i dawka” w nagłówku pliku.');
  const h = rows[header.index];
  // „Zakres wskazań” jest też początkiem „Zakres wskazań pozarejestracyjnych” — najpierw dopasowanie dokładne
  const col = Object.fromEntries(Object.entries(RF).map(([k, syn]) => [k, columnIndex(h, syn)])) as Record<keyof typeof RF, number>;
  if (col.indications === col.offLabel) col.indications = h.map(normHeader).findIndex((x, i) => i !== col.offLabel && x.startsWith('zakres wskazan'));
  const at = (r: string[], k: keyof typeof RF) => (col[k] >= 0 ? r[col[k]]?.trim() || undefined : undefined);
  let imported = 0;
  let skipped = 0;
  const db = getDb();
  transaction(db, () => {
    if (!opts.append) {
      if (opts.list) db.prepare('DELETE FROM refund_item WHERE list = ?').run(opts.list);
      else db.prepare('DELETE FROM refund_item').run();
    }
    const ins = db.prepare(
      'INSERT INTO refund_item (gtin, substance, name, pack, limit_group, retail_price, limit_amount, indications, offlabel, payment_level, copay, list, search_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const r of rows.slice(header.index + 1)) {
      const name = at(r, 'name');
      if (!name || normHeader(name) === normHeader(h[col.name])) {
        skipped++;
        continue;
      }
      const gtin = at(r, 'gtin')?.replace(/\D/g, '') || undefined;
      ins.run(
        gtin ?? null,
        at(r, 'substance') ?? null,
        name.slice(0, 300),
        at(r, 'pack') ?? null,
        at(r, 'limitGroup') ?? null,
        at(r, 'retailPrice') ?? null,
        at(r, 'limitAmount') ?? null,
        at(r, 'indications')?.slice(0, 4000) ?? null,
        at(r, 'offLabel')?.slice(0, 4000) ?? null,
        at(r, 'paymentLevel') ?? null,
        at(r, 'copay') ?? null,
        opts.list ?? null,
        searchText(at(r, 'substance'), name, gtin),
      );
      imported++;
    }
  });
  setMeta('refund', { importedAt: new Date().toISOString(), title: opts.title, validFrom: opts.validFrom, count: refundCount() });
  return { imported, skipped };
}

interface RefundRow {
  gtin: string | null;
  substance: string | null;
  name: string;
  pack: string | null;
  limit_group: string | null;
  retail_price: string | null;
  limit_amount: string | null;
  indications: string | null;
  offlabel: string | null;
  payment_level: string | null;
  copay: string | null;
  list: string | null;
}

const toRefund = (r: RefundRow): RefundItem => ({
  gtin: r.gtin ?? undefined,
  substance: r.substance ?? undefined,
  name: r.name,
  pack: r.pack ?? undefined,
  limitGroup: r.limit_group ?? undefined,
  retailPrice: r.retail_price ?? undefined,
  limitAmount: r.limit_amount ?? undefined,
  indications: r.indications ?? undefined,
  offLabel: r.offlabel ?? undefined,
  paymentLevel: r.payment_level ?? undefined,
  copay: r.copay ?? undefined,
  list: r.list ?? undefined,
});

export function searchRefund(input: { q?: string; gtin?: string; limit?: number }): RefundItem[] {
  const limit = Math.min(input.limit ?? 20, 50);
  if (input.gtin) {
    const g = input.gtin.replace(/\D/g, '');
    // GTIN-14 z obwieszczenia vs EAN-13 z opakowania: porównujemy bez wiodącego zera
    return (getDb().prepare('SELECT * FROM refund_item WHERE gtin = ? OR gtin = ? OR gtin = ? LIMIT ?').all(g, `0${g}`, g.replace(/^0/, ''), limit) as unknown as RefundRow[]).map(toRefund);
  }
  const words = normHeader(input.q ?? '')
    .split(' ')
    .filter((w) => w.length >= 2)
    .slice(0, 4);
  if (!words.length) return [];
  return (
    getDb()
      .prepare(`SELECT * FROM refund_item WHERE ${words.map(() => 'search_text LIKE ?').join(' AND ')} ORDER BY name, list LIMIT ?`)
      .all(...words.map((w) => `%${w}%`), limit) as unknown as RefundRow[]
  ).map(toRefund);
}

export function refundCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM refund_item').get() as { n: number }).n;
}

// --- metadane importów --------------------------------------------------------------------------------------------

export interface RegistryMeta {
  importedAt: string;
  count: number;
  title?: string;
  validFrom?: string;
}

function setMeta(key: string, value: RegistryMeta): void {
  getDb().prepare('INSERT INTO refund_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

export function registryMeta(key: 'pharmacies' | 'refund'): RegistryMeta | undefined {
  const r = getDb().prepare('SELECT value FROM refund_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return r ? (JSON.parse(r.value) as RegistryMeta) : undefined;
}

// --- dane pokazowe (tylko DEMO_MODE, gdy rejestry są puste; zawsze oznaczone) ------------------------------------

/** Instancja pokazowa bez importu: kilka fikcyjnych aptek i pozycji wykazu z wyraźnym oznaczeniem „dane pokazowe”. */
export function ensureDemoRegistries(): void {
  if (!config.demoMode) return;
  if (!pharmacyCount().total) {
    importPharmaciesCsv(
      [
        'Nazwa apteki;Rodzaj apteki;Ulica;Numer domu;Kod pocztowy;Miejscowość;Województwo;Telefon;Godziny pracy;Status;Szerokość geograficzna;Długość geograficzna',
        'Apteka Przykładowa „Pod Kasztanem” (dane pokazowe);ogólnodostępna;Marszałkowska;10;00-001;Warszawa;mazowieckie;+48 22 000 00 01;pn–pt 8–20, sob 9–14;aktywna;52.2290;21.0140',
        'Apteka Przykładowa Centrum (dane pokazowe);ogólnodostępna;Świętokrzyska;5;00-002;Warszawa;mazowieckie;+48 22 000 00 02;całodobowo;aktywna;52.2350;21.0080',
        'Apteka Przykładowa Rynek (dane pokazowe);ogólnodostępna;Rynek Główny;1;31-042;Kraków;małopolskie;+48 12 000 00 03;pn–sob 8–21;aktywna;50.0617;19.9373',
      ].join('\n'),
    );
  }
  if (!refundCount()) {
    importRefundCsv(
      [
        'Substancja czynna;Nazwa, postać i dawka leku;Zawartość opakowania;Kod EAN lub inny kod odpowiadający kodowi EAN;Grupa limitowa;Cena detaliczna;Wysokość limitu finansowania;Zakres wskazań objętych refundacją;Zakres wskazań pozarejestracyjnych objętych refundacją;Poziom odpłatności;Wysokość dopłaty świadczeniobiorcy',
        'Cholecalciferolum;Lek Przykładowy D3 (dane pokazowe), kaps., 2000 j.m.;60 kaps.;05900000000017;Grupa przykładowa;19,90;10,00;Przykładowe wskazanie (dane pokazowe);;30%;12,90',
        'Amlodipinum;Lek Przykładowy A (dane pokazowe), tabl., 5 mg;30 tabl.;05900000000024;Grupa przykładowa;12,50;10,00;Przykładowe wskazanie (dane pokazowe);;ryczałt;5,70',
      ].join('\n'),
      { list: 'A1', title: 'DANE POKAZOWE — nie pochodzą z obwieszczenia Ministra Zdrowia' },
    );
  }
}
