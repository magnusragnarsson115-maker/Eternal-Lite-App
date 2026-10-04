import fs from 'node:fs';
import { Readable } from 'node:stream';
import { getDb, transaction } from '../db.js';
import { fetchWithTimeout } from '../lib/util.js';

/**
 * Rejestr Produktów Leczniczych (CeZ/URPL) — oficjalny eksport XML, aktualizowany codziennie.
 * Oficjalne API wyszukiwania nie jest publiczne, więc importujemy eksport do lokalnej tabeli
 * (polecenie: npm run cli -- import-rpl [plik|URL]) i wyszukujemy lokalnie, bez wysyłania zapytań pacjentów na zewnątrz.
 */

export const RPL_EXPORT_URL = 'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml';

export interface MedicinalProduct {
  id: string;
  name: string;
  commonName?: string;
  strength?: string;
  form?: string;
  holder?: string;
  permit?: string;
  atc?: string;
  substances: string[];
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}

/** Pole może być atrybutem elementu produktLeczniczy albo elementem potomnym — obsługujemy oba warianty schematu. */
function field(block: string, openTag: string, name: string): string | undefined {
  const attr = new RegExp(`\\s${name}="([^"]*)"`).exec(openTag);
  if (attr) return decode(attr[1]) || undefined;
  const el = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return el ? decode(el[1]) || undefined : undefined;
}

export function parseProductBlock(block: string): MedicinalProduct | undefined {
  const open = /<produktLeczniczy\b[^>]*>/.exec(block)?.[0] ?? '';
  const name = field(block, open, 'nazwaProduktu');
  const id = field(block, open, 'id') ?? field(block, open, 'numerPozwolenia');
  if (!name || !id) return undefined;
  const substances: string[] = [];
  const subsBlock = /<substancjeCzynne>([\s\S]*?)<\/substancjeCzynne>/.exec(block)?.[1] ?? '';
  for (const m of subsBlock.matchAll(/<substancjaCzynna\b([^>]*)(?:\/>|>([\s\S]*?)<\/substancjaCzynna>)/g)) {
    const inner = m[2] ? decode(m[2].replace(/<[^>]+>/g, ' ')) : '';
    const attrName = /\snazwaSubstancji="([^"]*)"/.exec(m[1])?.[1];
    const value = attrName ? decode(attrName) : inner.replace(/\s+/g, ' ');
    if (value) substances.push(value);
  }
  return {
    id,
    name,
    commonName: field(block, open, 'nazwaPowszechnieStosowana'),
    strength: field(block, open, 'moc'),
    form: field(block, open, 'nazwaPostaciFarmaceutycznej') ?? field(block, open, 'postac'),
    holder: field(block, open, 'podmiotOdpowiedzialny'),
    permit: field(block, open, 'numerPozwolenia'),
    atc: field(block, open, 'kodATC'),
    substances,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');
}

export async function importRpl(source: string): Promise<{ imported: number }> {
  let stream: Readable;
  if (/^https?:\/\//.test(source)) {
    const res = await fetchWithTimeout(source, {}, 300_000);
    if (!res.ok || !res.body) throw new Error(`RPL download failed: ${res.status}`);
    stream = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  } else {
    stream = fs.createReadStream(source);
  }
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO medicinal_product (id, name, common_name, strength, form, holder, permit, atc, substances, search_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let buffer = '';
  let imported = 0;
  let batch: MedicinalProduct[] = [];
  const flush = () => {
    transaction(db, () => {
      for (const p of batch) {
        insert.run(
          p.id,
          p.name,
          p.commonName ?? null,
          p.strength ?? null,
          p.form ?? null,
          p.holder ?? null,
          p.permit ?? null,
          p.atc ?? null,
          JSON.stringify(p.substances),
          normalize([p.name, p.commonName, p.substances.join(' '), p.atc].filter(Boolean).join(' ')),
        );
      }
    });
    imported += batch.length;
    batch = [];
  };
  db.exec('DELETE FROM medicinal_product');
  for await (const chunk of stream) {
    buffer += chunk.toString('utf8');
    let end: number;
    while ((end = buffer.indexOf('</produktLeczniczy>')) >= 0) {
      const start = buffer.lastIndexOf('<produktLeczniczy', end);
      const block = buffer.slice(start, end + '</produktLeczniczy>'.length);
      buffer = buffer.slice(end + '</produktLeczniczy>'.length);
      const p = start >= 0 ? parseProductBlock(block) : undefined;
      if (p) batch.push(p);
      if (batch.length >= 500) flush();
    }
    // samozamykające się elementy (wariant z atrybutami bez dzieci)
    let selfClose: RegExpExecArray | null;
    const re = /<produktLeczniczy\b[^>]*\/>/g;
    let consumed = 0;
    while ((selfClose = re.exec(buffer))) {
      const p = parseProductBlock(selfClose[0]);
      if (p) batch.push(p);
      consumed = re.lastIndex;
    }
    if (consumed) buffer = buffer.slice(consumed);
    if (buffer.length > 5_000_000) buffer = buffer.slice(-1_000_000);
  }
  if (batch.length) flush();
  return { imported };
}

export function searchMedicinalProducts(term: string, limit = 20): MedicinalProduct[] {
  const t = normalize(term.trim());
  if (t.length < 2) return [];
  const rows = getDb()
    .prepare('SELECT * FROM medicinal_product WHERE search_text LIKE ? ORDER BY (CASE WHEN search_text LIKE ? THEN 0 ELSE 1 END), name LIMIT ?')
    .all(`%${t}%`, `${t}%`, limit) as {
    id: string;
    name: string;
    common_name: string | null;
    strength: string | null;
    form: string | null;
    holder: string | null;
    permit: string | null;
    atc: string | null;
    substances: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    commonName: r.common_name ?? undefined,
    strength: r.strength ?? undefined,
    form: r.form ?? undefined,
    holder: r.holder ?? undefined,
    permit: r.permit ?? undefined,
    atc: r.atc ?? undefined,
    substances: JSON.parse(r.substances) as string[],
  }));
}

export function medicinalProductCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM medicinal_product').get() as { n: number }).n;
}
