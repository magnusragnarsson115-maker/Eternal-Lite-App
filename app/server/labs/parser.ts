import { isUnitToken, matchTestName, toUcum } from './dictionary.js';

/**
 * Rozbiór polskich wyników laboratoryjnych z tekstu dokumentu (P3, F3.4).
 * Reguły → (opcjonalnie) model → walidacja: każda wartość musi wystąpić w tekście wskazanej linii.
 * Parser nie ocenia wyników: zakres referencyjny i oznaczenie (H/L) są wyłącznie przepisywane z dokumentu.
 */

export interface DocLine {
  page: number;
  text: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedItem {
  id: string;
  line: number;
  page: number;
  sourceText: string;
  name: string;
  value: string;
  valueNum?: number;
  comparator?: '<' | '>' | '<=' | '>=';
  unitRaw?: string;
  unit?: string;
  rangeText?: string;
  refLow?: number;
  refHigh?: number;
  flag?: string;
  match?: { key: string; loinc: string; pl: string; loincDisplay: string; kind: 'exact' | 'fuzzy' };
  confidence: Confidence;
  issues: string[];
  origin: 'rules' | 'model';
}

export interface ParseResult {
  items: ParsedItem[];
  laboratory?: string;
  collectedAt?: string;
  /** Pozycje z modelu odrzucone, bo wartości nie było w tekście wskazanej linii. */
  rejected: number;
}

const FLAG_TOKENS = new Set(['H', 'L', 'HH', 'LL', '↑', '↓', '*', '!', '+', '(H)', '(L)', '<<', '>>']);
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const VALUE_RE = new RegExp(String.raw`(^|\s)((?:[<>≤≥]=?\s?)?${NUMBER})(?=\s|$)`, 'g');

export function toNumber(s: string): number | undefined {
  const m = s.match(new RegExp(NUMBER));
  if (!m) return undefined;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function comparatorOf(s: string): ParsedItem['comparator'] {
  const m = s.match(/^([<>≤≥]=?)/);
  if (!m) return undefined;
  return ({ '<': '<', '>': '>', '≤': '<=', '≥': '>=', '<=': '<=', '>=': '>=' } as const)[m[1] as '<'] ?? undefined;
}

function cleanLine(text: string): string {
  return text.replace(/[–—]/g, '-').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanName(name: string): string {
  return name.replace(/[.·…_]{2,}/g, ' ').replace(/[:;]+$/, '').replace(/\s+/g, ' ').trim();
}

export function parseRange(text: string): { rangeText?: string; refLow?: number; refHigh?: number } {
  const t = text.trim();
  if (!t) return {};
  let m = t.match(new RegExp(String.raw`^(${NUMBER})\s*-\s*(${NUMBER})`));
  if (m) return { rangeText: m[0], refLow: toNumber(m[1]), refHigh: toNumber(m[2]) };
  m = t.match(new RegExp(String.raw`^(?:od\s+)(${NUMBER})\s+do\s+(${NUMBER})`, 'i'));
  if (m) return { rangeText: m[0], refLow: toNumber(m[1]), refHigh: toNumber(m[2]) };
  m = t.match(new RegExp(String.raw`^(?:[<≤]=?|do|poniżej|ponizej)\s*(${NUMBER})`, 'i'));
  if (m) return { rangeText: m[0], refHigh: toNumber(m[1]) };
  m = t.match(new RegExp(String.raw`^(?:[>≥]=?|od|powyżej|powyzej)\s*(${NUMBER})`, 'i'));
  if (m) return { rangeText: m[0], refLow: toNumber(m[1]) };
  return {};
}

/** Najdłuższe dopasowanie jednostki z 1–3 kolejnych tokenów. */
function takeUnit(tokens: string[], start: number): { raw: string; ucum: string; used: number } | undefined {
  for (let n = Math.min(3, tokens.length - start); n >= 1; n--) {
    const raw = tokens.slice(start, start + n).join(' ');
    const ucum = toUcum(raw) ?? toUcum(tokens.slice(start, start + n).join(''));
    if (ucum) return { raw, ucum, used: n };
  }
  return undefined;
}

/** Układ „nazwa [jednostka] wynik (zakres)” → „nazwa wynik jednostka zakres”; zakres w nawiasie na końcu linii bez nawiasu. */
function normalizeLayout(text: string): string {
  const m = text.match(new RegExp(String.raw`^(.*?\p{L}.*?)\s*\[([^\]]{1,20})\]\s+((?:[<>≤≥]=?\s?)?${NUMBER})(?:\s+(.*))?$`, 'u'));
  const out = m && toUcum(m[2]) ? `${m[1]} ${m[3]} ${m[2]} ${m[4] ?? ''}`.trim() : text;
  return out.replace(/\s\((\d[^()]*)\)$/, ' $1');
}

/** Rozbiór jednej linii wyniku; undefined, gdy linia nie wygląda na wynik badania. */
export function parseLine(rawText: string): Omit<ParsedItem, 'id' | 'line' | 'page' | 'origin' | 'confidence' | 'issues'> | undefined {
  const text = normalizeLayout(cleanLine(rawText));
  if (text.length < 3 || text.length > 200) return undefined;
  VALUE_RE.lastIndex = 0;
  let valueMatch: RegExpExecArray | null;
  while ((valueMatch = VALUE_RE.exec(text))) {
    const start = valueMatch.index + valueMatch[1].length;
    const name = cleanName(text.slice(0, start));
    if ((name.match(/\p{L}/gu) ?? []).length < 2) continue;
    if (/\d{1,2}[.-]\d{1,2}[.-]\d{2,4}\s*$/.test(name)) return undefined; // data, nie wynik
    const value = valueMatch[2].replace(/\s+/g, '');
    const rest = text.slice(start + valueMatch[2].length).trim();
    const tokens = rest ? rest.split(' ') : [];
    let i = 0;
    let flag: string | undefined;
    if (tokens[i] && FLAG_TOKENS.has(tokens[i])) flag = tokens[i++];
    let unit = takeUnit(tokens, i);
    if (unit) i += unit.used;
    if (!flag && tokens[i] && FLAG_TOKENS.has(tokens[i])) flag = tokens[i++];
    let rangePart = tokens.slice(i).join(' ');
    let range = parseRange(rangePart);
    if (!unit) {
      // układ „wynik zakres jednostka”
      const afterRange = range.rangeText ? rangePart.slice(range.rangeText.length).trim().split(' ') : [];
      const u2 = afterRange.length ? takeUnit(afterRange, 0) : undefined;
      if (u2) unit = u2;
    }
    if (range.rangeText) {
      const tail = rangePart.slice(range.rangeText.length).trim().split(' ').filter(Boolean);
      const trailingFlag = tail.find((t) => FLAG_TOKENS.has(t));
      if (!flag && trailingFlag) flag = trailingFlag;
    } else {
      rangePart = '';
      range = {};
    }
    return {
      sourceText: rawText,
      name,
      value,
      valueNum: toNumber(value),
      comparator: comparatorOf(value),
      unitRaw: unit?.raw,
      unit: unit?.ucum,
      ...range,
      flag: flag?.replace(/[()]/g, ''),
    };
  }
  return undefined;
}

function finalize(base: Omit<ParsedItem, 'id' | 'confidence' | 'issues' | 'match'>): ParsedItem | undefined {
  const issues: string[] = [];
  const m = matchTestName(base.name);
  if (!m && !base.unit) return undefined; // ani znana nazwa, ani jednostka — prawdopodobnie nie wynik
  const match = m ? { key: m.def.key, loinc: m.def.loinc, pl: m.def.pl, loincDisplay: m.def.loincDisplay, kind: m.kind } : undefined;
  if (!m) issues.push('not_in_dictionary');
  else if (m.kind === 'fuzzy') issues.push('name_corrected');
  const unitless = m?.def.units.includes('{INR}');
  if (!base.unit && !unitless) issues.push('unit_missing');
  if (base.unit && m && !m.def.units.includes(base.unit)) issues.push('unit_unexpected');
  if (base.valueNum === undefined) issues.push('value_not_numeric');
  let confidence: Confidence = 'high';
  if (issues.includes('not_in_dictionary') || issues.includes('unit_unexpected')) confidence = 'low';
  else if (issues.length) confidence = 'medium';
  if (base.origin === 'model' && confidence === 'high') confidence = 'medium';
  return { ...base, id: `${base.page}-${base.line}-${base.origin}`, match, confidence, issues };
}

const LAB_NAMES = ['Diagnostyka', 'ALAB', 'Synevo', 'Medicover', 'LUX MED', 'Luxmed', 'Enel-Med', 'Bruss', 'Laboratorium'];

function detectLaboratory(lines: DocLine[]): string | undefined {
  for (const l of lines.slice(0, 15)) {
    const hit = LAB_NAMES.find((n) => l.text.toLowerCase().includes(n.toLowerCase()));
    if (hit) return cleanLine(l.text).slice(0, 120);
  }
  return undefined;
}

function detectCollectedAt(lines: DocLine[]): string | undefined {
  for (const l of lines) {
    const m = l.text.match(/(?:data\s+(?:i\s+godz\.?\s+)?pobrania|pobrano|data pobrania materiału)[^0-9]{0,12}(\d{4}-\d{2}-\d{2}|\d{1,2}[.-]\d{1,2}[.-]\d{4})/i);
    if (m) return isoDate(m[1]);
  }
  return undefined;
}

export function isoDate(s: string): string | undefined {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

export function parseLabDocument(lines: DocLine[]): ParseResult {
  const items: ParsedItem[] = [];
  lines.forEach((l, idx) => {
    const base = parseLine(l.text);
    if (!base) return;
    const item = finalize({ ...base, line: idx, page: l.page, origin: 'rules' });
    if (item) items.push(item);
  });
  return { items, laboratory: detectLaboratory(lines), collectedAt: detectCollectedAt(lines), rejected: 0 };
}

const squash = (s: string) => s.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();

/**
 * Dołącza pozycje odczytane przez model: tylko te, których wartość (i nazwa) występuje w tekście wskazanej linii.
 * Linia rozebrana regułami ma pierwszeństwo — model uzupełnia, nie nadpisuje.
 */
export function mergeModelItems(
  result: ParseResult,
  lines: DocLine[],
  modelItems: { name: string; value: string; unit: string | null; referenceRange: string | null; flag: string | null; line: number }[],
): ParseResult {
  const taken = new Set(result.items.map((i) => i.line));
  let rejected = 0;
  const added: ParsedItem[] = [];
  for (const mi of modelItems) {
    const idx = mi.line - 1;
    const line = lines[idx];
    if (!line || taken.has(idx)) {
      if (!line) rejected++;
      continue;
    }
    const src = squash(line.text);
    if (!src.includes(squash(mi.value)) || !src.includes(squash(mi.name).slice(0, 4))) {
      rejected++;
      continue;
    }
    const unit = mi.unit && isUnitToken(mi.unit) ? toUcum(mi.unit) : undefined;
    const range = mi.referenceRange && src.includes(squash(mi.referenceRange)) ? parseRange(mi.referenceRange) : {};
    const item = finalize({
      line: idx,
      page: line.page,
      sourceText: line.text,
      name: cleanName(mi.name),
      value: mi.value.replace(/\s+/g, ''),
      valueNum: toNumber(mi.value),
      comparator: comparatorOf(mi.value),
      unitRaw: unit ? (mi.unit ?? undefined) : undefined,
      unit,
      ...range,
      flag: mi.flag && src.includes(squash(mi.flag)) ? mi.flag : undefined,
      origin: 'model',
    });
    if (item) {
      added.push(item);
      taken.add(idx);
    }
  }
  return { ...result, items: [...result.items, ...added].sort((a, b) => a.line - b.line), rejected: result.rejected + rejected };
}

/** Tekst z numerami linii dla modelu (Lnnn: …). */
export function numberedText(lines: DocLine[]): string {
  return lines.map((l, i) => `L${String(i + 1).padStart(3, '0')}: ${l.text}`).join('\n');
}
