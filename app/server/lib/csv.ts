/**
 * Odczyt plików CSV z rejestrów publicznych (Rejestr Aptek, obwieszczenie refundacyjne, słownik ICD-10):
 * separator ; , albo tabulator wykrywany z nagłówka, cudzysłowy, BOM. Nagłówki porównujemy bez wielkości
 * liter, polskich znaków i interpunkcji — urzędy zmieniają je między wydaniami.
 */

export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts: [string, number][] = [';', ',', '\t'].map((c) => [c, firstLine.split(c).length - 1]);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function normHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Indeks kolumny dla pierwszego pasującego synonimu (dokładnie albo jako początek nagłówka); -1 — brak. */
export function columnIndex(headers: string[], synonyms: string[]): number {
  const h = headers.map(normHeader);
  for (const syn of synonyms.map(normHeader)) {
    const exact = h.indexOf(syn);
    if (exact >= 0) return exact;
  }
  for (const syn of synonyms.map(normHeader)) {
    const prefix = h.findIndex((x) => x.startsWith(syn));
    if (prefix >= 0) return prefix;
  }
  return -1;
}

/** Wiersz nagłówka: pierwszy z wierszy, w którym znajdują się wszystkie wymagane kolumny. */
export function findHeader(rows: string[][], required: string[][], maxScan = 15): { index: number; cols: number[] } | undefined {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cols = required.map((syn) => columnIndex(rows[i], syn));
    if (cols.every((c) => c >= 0)) return { index: i, cols };
  }
  return undefined;
}

export function searchText(...parts: (string | undefined)[]): string {
  return normHeader(parts.filter(Boolean).join(' '));
}
