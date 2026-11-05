import crypto from 'node:crypto';
import type { Bundle, Observation } from '@medplum/fhirtypes';
import type { AuditActor } from '../audit.js';
import { config } from '../config.js';
import { LOINC, VITALS, type VitalKind } from '../fhir/constants.js';
import { zonedToUtc } from '../lib/time.js';
import { badRequest } from '../lib/util.js';
import { addMeasurementsBatch, INPUT_LIMITS, listMeasurements, type MeasurementInput, type MeasurementView } from './observations.js';

/**
 * Import pomiarów z pliku (A1.6): CSV (także z Excela: średnik i przecinek dziesiętny), JSON (lista obiektów)
 * albo FHIR Bundle (np. własny eksport z Eternal). Najpierw podgląd z błędem każdego wiersza, zapis dopiero po
 * zatwierdzeniu i tylko poprawnych wierszy. Ponowny import tego samego pliku nie tworzy kopii (identyfikator z
 * treści wiersza). Duplikaty i rozbieżności są oznaczane, nie rozstrzygane (A1.7). Import niczego nie ocenia.
 */

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2000;

export type ImportFormat = 'csv' | 'json' | 'fhir';

export type ImportErrorCode =
  | 'kind_unknown'
  | 'lab_result_row'
  | 'date_missing'
  | 'date_invalid'
  | 'date_future'
  | 'value_missing'
  | 'value_invalid'
  | 'value_out_of_input_range'
  | 'unit_missing'
  | 'unit_unexpected'
  | 'diastolic_not_lower'
  | 'duplicate_in_file'
  | 'duplicate_existing';

export type ImportWarning = 'time_missing' | 'unit_converted' | 'conflict';

export interface ImportRow {
  line: number;
  kind?: VitalKind;
  effective?: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  pulse?: number;
  unit?: string;
  note?: string;
  status: 'ok' | 'duplicate' | 'error';
  error?: { code: ImportErrorCode; detail?: string };
  warnings: ImportWarning[];
  /** Tekst wiersza ze źródła (do 160 znaków) — pacjent widzi, którego wiersza dotyczy błąd. */
  raw: string;
}

export interface ImportPreview {
  format: ImportFormat;
  rows: ImportRow[];
  summary: { total: number; ok: number; duplicate: number; error: number; warnings: number };
}

// --- normalizacja -----------------------------------------------------------------------------------------

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['data', 'date', 'datetime', 'data i godzina', 'data pomiaru', 'czas', 'timestamp', 'effective', 'kiedy'],
  time: ['godzina', 'time', 'czas pomiaru', 'hour'],
  category: ['kategoria', 'category'],
  kind: ['rodzaj', 'rodzaj pomiaru', 'typ pomiaru', 'pomiar', 'parametr', 'kind', 'type', 'measurement'],
  value: ['wartosc', 'value', 'wynik', 'odczyt'],
  systolic: ['skurczowe', 'cisnienie skurczowe', 'sys', 'systolic', 'skurczowe mmhg'],
  diastolic: ['rozkurczowe', 'cisnienie rozkurczowe', 'dia', 'diastolic', 'rozkurczowe mmhg'],
  pulse: ['tetno', 'puls', 'pulse', 'heart rate', 'hr'],
  unit: ['jednostka', 'unit', 'units'],
  note: ['uwagi', 'notatka', 'komentarz', 'note', 'notes', 'comment'],
};
const COLUMN_BY_ALIAS = new Map(Object.entries(COLUMN_ALIASES).flatMap(([k, list]) => list.map((a) => [a, k] as const)));

const KIND_ALIASES: Record<VitalKind, string[]> = {
  bp: ['cisnienie', 'cisnienie tetnicze', 'cisnienie krwi', 'bp', 'blood pressure', 'rr'],
  heartRate: ['tetno', 'puls', 'heart rate', 'hr', 'pulse', 'heartrate'],
  weight: ['waga', 'masa ciala', 'masa', 'weight', 'body weight'],
  height: ['wzrost', 'height', 'body height'],
  temperature: ['temperatura', 'temperatura ciala', 'temperature', 'temp', 'body temperature'],
  spo2: ['saturacja', 'spo2', 'spo₂', 'sp o2', 'saturation', 'oxygen saturation'],
  glucose: ['glukoza', 'glukoza we krwi', 'cukier', 'glucose', 'blood glucose', 'glikemia'],
};
const KIND_BY_ALIAS = new Map(Object.entries(KIND_ALIASES).flatMap(([k, list]) => list.map((a) => [a, k as VitalKind] as const)));

/** Jednostki dopuszczalne dla rodzaju pomiaru; przeliczenie do jednostki zapisu z zachowaniem źródła w uwagach. */
const UNITS: Record<VitalKind, { canonical: string; accept: Record<string, number> }> = {
  bp: { canonical: 'mmHg', accept: { mmhg: 1, 'mm hg': 1, 'mm[hg]': 1 } },
  heartRate: { canonical: '/min', accept: { '/min': 1, bpm: 1, 'ud/min': 1, 'uderzen/min': 1, '1/min': 1, 'min 1': 1, 'min^ 1': 1 } },
  weight: { canonical: 'kg', accept: { kg: 1, lb: 0.45359237, lbs: 0.45359237 } },
  height: { canonical: 'cm', accept: { cm: 1, m: 100 } },
  temperature: { canonical: '°C', accept: { '°c': 1, c: 1, cel: 1, 'st c': 1, 'stopnie c': 1, 'deg c': 1 } },
  spo2: { canonical: '%', accept: { '%': 1 } },
  glucose: { canonical: 'mg/dL', accept: { 'mg/dl': 1, 'mmol/l': 18.016 } },
};

function unitKey(u: string): string {
  return norm(u).replace(/\s*\/\s*/g, '/').replace(/º/g, '°');
}

function parseNumber(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return undefined;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(',', '.'));
}

/** Data i godzina: ISO (z przesunięciem albo bez — wtedy czas lokalny placówki) lub zapis polski DD.MM.RRRR GG:MM. */
function parseDate(rawDate: unknown, rawTime: unknown): { iso?: string; timeMissing?: boolean; error?: ImportErrorCode } {
  const d = rawDate === undefined || rawDate === null ? '' : String(rawDate).trim();
  const t = rawTime === undefined || rawTime === null ? '' : String(rawTime).trim();
  if (!d) return { error: 'date_missing' };
  const tz = config.clinic.timezone;
  // ISO z przesunięciem lub Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(d)) {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? { error: 'date_invalid' } : { iso: dt.toISOString() };
  }
  let date: string | undefined;
  let time: string | undefined;
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (m) {
    date = `${m[1]}-${m[2]}-${m[3]}`;
    if (m[4]) time = `${m[4].padStart(2, '0')}:${m[5]}`;
  } else {
    m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
    if (m) {
      date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      if (m[4]) time = `${m[4].padStart(2, '0')}:${m[5]}`;
    }
  }
  if (!date) return { error: 'date_invalid' };
  if (!time && t) {
    const tm = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!tm) return { error: 'date_invalid' };
    time = `${tm[1].padStart(2, '0')}:${tm[2]}`;
  }
  const [y, mo, da] = date.split('-').map(Number);
  const check = new Date(Date.UTC(y, mo - 1, da));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== da || y < 1900) return { error: 'date_invalid' };
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    if (hh > 23 || mm > 59) return { error: 'date_invalid' };
  }
  const at = zonedToUtc(date, time ?? '12:00', tz);
  return { iso: at.toISOString(), timeMissing: !time };
}

// --- odczyt formatów --------------------------------------------------------------------------------------

type RawRecord = { line: number; raw: string; fields: Record<string, unknown> };

/** Prosty, poprawny parser CSV: cudzysłowy, podwójny cudzysłów, separator ; , lub tabulator, BOM. */
function parseCsv(text: string): RawRecord[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = { ';': (firstLine.match(/;/g) ?? []).length, ',': (firstLine.match(/,/g) ?? []).length, '\t': (firstLine.match(/\t/g) ?? []).length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ';') as ';' | ',' | '\t';
  const records: { cells: string[]; line: number; raw: string }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let raw = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        raw += '""';
        i++;
      } else if (ch === '"') {
        quoted = false;
        raw += ch;
      } else {
        if (ch === '\n') line++;
        cell += ch;
        raw += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      raw += ch;
    } else if (ch === sep) {
      cells.push(cell);
      cell = '';
      raw += ch;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cells.push(cell);
      if (cells.some((c) => c.trim() !== '')) records.push({ cells, line: startLine, raw });
      cells = [];
      cell = '';
      raw = '';
      line++;
      startLine = line;
    } else {
      cell += ch;
      raw += ch;
    }
  }
  cells.push(cell);
  if (cells.some((c) => c.trim() !== '')) records.push({ cells, line: startLine, raw });
  if (records.length < 2) return [];
  const header = records[0].cells.map((h) => COLUMN_BY_ALIAS.get(norm(h)) ?? `?${norm(h)}`);
  return records.slice(1).map((r) => ({
    line: r.line,
    raw: r.raw.slice(0, 160),
    fields: Object.fromEntries(header.map((h, i) => [h, r.cells[i]?.trim() ?? ''])),
  }));
}

function fromJsonObjects(list: unknown[]): RawRecord[] {
  return list.map((o, i) => {
    const fields: Record<string, unknown> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) fields[COLUMN_BY_ALIAS.get(norm(k)) ?? `?${norm(k)}`] = v;
    return { line: i + 1, raw: JSON.stringify(o).slice(0, 160), fields };
  });
}

/** FHIR Bundle → rekordy: obserwacje Vital Signs z kodami LOINC znanymi aplikacji (inne zasoby są pomijane). */
function fromFhirBundle(bundle: Bundle): RawRecord[] {
  const byCode = new Map<string, VitalKind>([[VITALS.bpPanel.code, 'bp'], ...(['heartRate', 'weight', 'height', 'temperature', 'spo2', 'glucose'] as const).map((k) => [VITALS[k].code, k] as [string, VitalKind])]);
  const out: RawRecord[] = [];
  (bundle.entry ?? []).forEach((e, i) => {
    const o = e.resource as Observation | undefined;
    if (o?.resourceType !== 'Observation') return;
    if (o.status === 'entered-in-error') return;
    const code = o.code?.coding?.find((c) => c.system === LOINC)?.code ?? '';
    const kind = byCode.get(code);
    const isLab = !kind && !!o.code?.coding?.length;
    const comp = (c: string) => o.component?.find((x) => x.code.coding?.some((cd) => cd.code === c))?.valueQuantity;
    const fields: Record<string, unknown> = {
      kind: kind ?? (isLab ? '__lab__' : o.code?.text),
      date: o.effectiveDateTime,
      value: o.valueQuantity?.value,
      unit: kind === 'bp' ? comp(VITALS.systolic.code)?.unit : o.valueQuantity?.unit,
      systolic: comp(VITALS.systolic.code)?.value,
      diastolic: comp(VITALS.diastolic.code)?.value,
      note: o.note?.[0]?.text,
    };
    out.push({ line: i + 1, raw: `${o.code?.text ?? code} ${o.effectiveDateTime ?? ''}`.trim().slice(0, 160), fields });
  });
  return out;
}

function detect(content: string): { format: ImportFormat; records: RawRecord[] } {
  const trimmed = content.replace(/^﻿/, '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw badRequest('import_invalid_json');
    }
    if (data && typeof data === 'object' && (data as Bundle).resourceType === 'Bundle') return { format: 'fhir', records: fromFhirBundle(data as Bundle) };
    const list = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: unknown[] }).items : null;
    if (!list) throw badRequest('import_invalid_json');
    return { format: 'json', records: fromJsonObjects(list) };
  }
  return { format: 'csv', records: parseCsv(content) };
}

// --- walidacja wiersza ------------------------------------------------------------------------------------

function inRange(name: string, v: number): boolean {
  const [min, max] = INPUT_LIMITS[name];
  return v >= min && v <= max;
}

function validate(rec: RawRecord): ImportRow {
  const f = rec.fields;
  const row: ImportRow = { line: rec.line, status: 'ok', warnings: [], raw: rec.raw };
  const fail = (code: ImportErrorCode, detail?: string): ImportRow => ({ ...row, status: 'error', error: { code, detail } });
  const category = f.category ? norm(String(f.category)) : '';
  if (f.kind === '__lab__' || category.startsWith('wynik')) return fail('lab_result_row');
  const kindRaw = f.kind === undefined || f.kind === null ? '' : norm(String(f.kind));
  const kind = (KIND_BY_ALIAS.get(kindRaw) ?? (Object.keys(UNITS).includes(String(f.kind)) ? (String(f.kind) as VitalKind) : undefined)) as VitalKind | undefined;
  if (!kind) return fail('kind_unknown', kindRaw || undefined);
  row.kind = kind;
  const date = parseDate(f.date, f.time);
  if (date.error) return fail(date.error);
  if (Date.parse(date.iso!) > Date.now() + 5 * 60_000) return fail('date_future');
  row.effective = date.iso;
  if (date.timeMissing) row.warnings.push('time_missing');
  row.note = f.note ? String(f.note).slice(0, 300) : undefined;

  const unitRaw = f.unit === undefined || f.unit === null ? '' : String(f.unit).trim();
  if (!unitRaw) return fail('unit_missing', UNITS[kind].canonical);
  const factor = UNITS[kind].accept[unitKey(unitRaw)];
  if (factor === undefined) return fail('unit_unexpected', `${unitRaw} → ${UNITS[kind].canonical}`);
  row.unit = UNITS[kind].canonical;

  if (kind === 'bp') {
    let sys = parseNumber(f.systolic);
    let dia = parseNumber(f.diastolic);
    const combined = f.value !== undefined && f.value !== null ? String(f.value).match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/) : null;
    if ((sys === undefined || dia === undefined) && combined) {
      sys = Number(combined[1]);
      dia = Number(combined[2]);
    }
    if (sys === null || dia === null) return fail('value_invalid');
    if (sys === undefined || dia === undefined) return fail('value_missing');
    if (!inRange('systolic', sys)) return fail('value_out_of_input_range', `${INPUT_LIMITS.systolic[0]}–${INPUT_LIMITS.systolic[1]} mmHg`);
    if (!inRange('diastolic', dia)) return fail('value_out_of_input_range', `${INPUT_LIMITS.diastolic[0]}–${INPUT_LIMITS.diastolic[1]} mmHg`);
    if (dia >= sys) return fail('diastolic_not_lower');
    row.systolic = Math.round(sys);
    row.diastolic = Math.round(dia);
    const pulse = parseNumber(f.pulse);
    if (pulse === null) return fail('value_invalid');
    if (pulse !== undefined) {
      if (!inRange('heartRate', pulse)) return fail('value_out_of_input_range', `${INPUT_LIMITS.heartRate[0]}–${INPUT_LIMITS.heartRate[1]} /min`);
      row.pulse = Math.round(pulse);
    }
    return row;
  }
  const raw = parseNumber(f.value ?? (kind === 'heartRate' ? f.pulse : undefined));
  if (raw === null) return fail('value_invalid');
  if (raw === undefined) return fail('value_missing');
  const value = Math.round(raw * factor * 10) / 10;
  if (!inRange(kind, value)) {
    const [min, max] = INPUT_LIMITS[kind];
    return fail('value_out_of_input_range', `${min}–${max} ${UNITS[kind].canonical}`);
  }
  if (factor !== 1) {
    row.warnings.push('unit_converted');
    row.note = [row.note, `przeliczono z ${String(raw).replace('.', ',')} ${unitRaw}`].filter(Boolean).join(' · ').slice(0, 300);
  }
  row.value = value;
  return row;
}

function valuesKey(r: { kind?: VitalKind; systolic?: number; diastolic?: number; value?: number }): string {
  return r.kind === 'bp' ? `${r.systolic}/${r.diastolic}` : String(r.value);
}

function minute(iso: string): string {
  return iso.slice(0, 16);
}

/** Identyfikator importu z treści wiersza: ten sam pomiar zaimportowany drugi raz zostanie pominięty. */
export function importId(r: ImportRow): string {
  return `imp-${crypto.createHash('sha256').update(`${r.kind}|${minute(r.effective!)}|${valuesKey(r)}`).digest('hex').slice(0, 24)}`;
}

export async function previewImport(patientRef: string, content: string): Promise<ImportPreview> {
  if (Buffer.byteLength(content, 'utf8') > IMPORT_MAX_BYTES) throw badRequest('import_too_large', `${IMPORT_MAX_BYTES / 1024 / 1024} MB`);
  const { format, records } = detect(content);
  if (!records.length) throw badRequest('import_empty');
  if (records.length > IMPORT_MAX_ROWS) throw badRequest('import_too_many_rows', String(IMPORT_MAX_ROWS));
  const rows = records.map(validate);

  const existing: MeasurementView[] = await listMeasurements(patientRef);
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.status !== 'ok') continue;
    const key = `${r.kind}|${minute(r.effective!)}|${valuesKey(r)}`;
    if (seen.has(key)) {
      r.status = 'duplicate';
      r.error = { code: 'duplicate_in_file' };
      continue;
    }
    seen.add(key);
    // ten sam rodzaj, minuta i wartość już zapisane (z dowolnego źródła) — pomijamy, istniejący odczyt zostaje
    const sameMinute = existing.filter((m) => m.kind === r.kind && minute(m.effective) === minute(r.effective!));
    if (sameMinute.some((m) => valuesKey(m) === valuesKey(r))) {
      r.status = 'duplicate';
      r.error = { code: 'duplicate_existing' };
      continue;
    }
    // inna wartość z tej samej minuty — zapisujemy oba odczyty i oznaczamy rozbieżność (A1.7)
    if (sameMinute.length) r.warnings.push('conflict');
  }
  const count = (s: ImportRow['status']) => rows.filter((r) => r.status === s).length;
  return { format, rows, summary: { total: rows.length, ok: count('ok'), duplicate: count('duplicate'), error: count('error'), warnings: rows.filter((r) => r.warnings.length).length } };
}

export async function commitImport(actor: AuditActor, patientRef: string, content: string, fileName?: string): Promise<{ imported: number; duplicate: number; error: number }> {
  const preview = await previewImport(patientRef, content);
  const inputs: MeasurementInput[] = preview.rows
    .filter((r) => r.status === 'ok')
    .map((r) => ({
      kind: r.kind!,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      value: r.value,
      effective: r.effective,
      note: r.note,
      source: 'import',
      device: fileName ? fileName.slice(0, 120) : undefined,
      externalId: importId(r),
    }));
  const label = (fileName ?? 'bez nazwy').slice(0, 80);
  const res = inputs.length ? await addMeasurementsBatch(actor, patientRef, inputs, label) : { created: 0, existing: 0 };
  return { imported: res.created ? inputs.length - res.existing : 0, duplicate: preview.summary.duplicate + res.existing, error: preview.summary.error };
}
