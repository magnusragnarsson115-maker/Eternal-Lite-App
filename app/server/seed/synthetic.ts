import fs from 'node:fs';
import path from 'node:path';
import type { Bundle, Observation, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { TAG_FICTIONAL } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { LAB_TESTS } from '../labs/dictionary.js';
import { withOrgTags } from '../tenancy.js';
import { addMeasurement } from '../services/observations.js';
import { createPatient } from '../services/patients.js';
import { createReport } from '../services/records.js';
import { runInScope } from '../tenancy.js';
import { simplePdf } from './pdf.js';

/**
 * Dane syntetyczne (D5.3, R8): fikcyjni pacjenci z danymi podłużnymi (wyniki co kilka miesięcy, pomiary domowe)
 * do testów, demonstracji i zestawów testowych odczytu dokumentów — bez danych prawdziwych osób.
 *
 * - generator deterministyczny (ziarno) — ten sam zestaw da się odtworzyć w testach;
 * - każdy zasób oznaczony TAG_FICTIONAL, bez PESEL (każdy poprawny numer może należeć do realnej osoby);
 * - każde uruchomienie zapisane w dzienniku (rejestr użyć: kto, ile, ziarno, cel);
 * - opcjonalnie pliki PDF wyników w kilku układach polskich laboratoriów (zestaw testowy OCR z oczekiwanymi wartościami w JSON);
 * - import paczek FHIR z Synthea (otwarte oprogramowanie) — pacjenci i wyniki laboratoryjne z oznaczeniem fikcyjności.
 */

const GIVEN_F = ['Alicja', 'Barbara', 'Celina', 'Dorota', 'Ewelina', 'Felicja', 'Grażyna', 'Halina', 'Irena', 'Joanna', 'Karolina', 'Lena'];
const GIVEN_M = ['Adam', 'Bartosz', 'Cezary', 'Dawid', 'Edward', 'Filip', 'Grzegorz', 'Henryk', 'Igor', 'Jakub', 'Kamil', 'Leon'];
const FAMILY = ['Syntetyczn', 'Próbn', 'Testow', 'Wzorcow', 'Modelow', 'Przykładow'];

/** Panele badań z wartościami bazowymi (środek zakresu) i rozrzutem — liczby fikcyjne, nie normy kliniczne. */
const PANELS: { title: string; loinc: string; tests: { key: string; base: number; spread: number; decimals: number; low?: number; high?: number }[] }[] = [
  {
    title: 'Morfologia krwi',
    loinc: '58410-2',
    tests: [
      { key: 'wbc', base: 6.5, spread: 1.6, decimals: 2, low: 4, high: 10 },
      { key: 'hgb', base: 14, spread: 1.2, decimals: 1, low: 12, high: 16 },
      { key: 'plt', base: 260, spread: 60, decimals: 0, low: 150, high: 400 },
    ],
  },
  {
    title: 'Lipidogram',
    loinc: '24331-1',
    tests: [
      { key: 'chol', base: 195, spread: 30, decimals: 0, high: 190 },
      { key: 'hdl', base: 55, spread: 10, decimals: 0, low: 40 },
      { key: 'ldl', base: 120, spread: 25, decimals: 0, high: 115 },
      { key: 'tg', base: 130, spread: 40, decimals: 0, high: 150 },
    ],
  },
  {
    title: 'Glukoza, kreatynina, TSH',
    loinc: '24323-8',
    tests: [
      { key: 'glucose', base: 92, spread: 9, decimals: 0, low: 70, high: 99 },
      { key: 'creat', base: 0.9, spread: 0.15, decimals: 2, low: 0.6, high: 1.2 },
      { key: 'tsh', base: 2, spread: 0.9, decimals: 2, low: 0.27, high: 4.2 },
    ],
  },
];

/** Prosty generator liczb pseudolosowych z ziarnem (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const fmt = (n: number, d: number) => n.toFixed(d);
const plDecimal = (s: string) => s.replace('.', ',');
/** PDF z czcionką standardową (WinAnsi) nie ma polskich liter — zestaw testowy używa transliteracji, jak część starszych wydruków. */
const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[–—]/g, '-');

export interface SyntheticOptions {
  count: number;
  seed: number;
  /** Ile lat wstecz sięgają wyniki (dane podłużne). */
  years: number;
  purpose: string;
  orgId?: string;
  /** Katalog na pliki PDF wyników i plik oczekiwanych wartości (zestaw testowy odczytu). */
  pdfDir?: string;
}

export interface SyntheticLabDoc {
  file: string;
  layout: string;
  collectedAt: string;
  items: { name: string; loinc: string; value: string; unit: string; rangeText?: string }[];
}

/** Układy wydruku: różne kolejności kolumn, separatory dziesiętne i zapisy zakresu (jak w polskich laboratoriach). */
const LAYOUTS = ['nazwa-wynik-jednostka-zakres', 'nazwa-wynik-flaga-jednostka-zakres', 'nazwa-jednostka-wynik-zakres-myslnik'] as const;

function labLine(layout: (typeof LAYOUTS)[number], name: string, value: string, unit: string, low?: number, high?: number, flag?: string): { text: string; range?: string } {
  const range = low !== undefined && high !== undefined ? `${plDecimal(String(low))} - ${plDecimal(String(high))}` : high !== undefined ? `< ${plDecimal(String(high))}` : low !== undefined ? `> ${plDecimal(String(low))}` : undefined;
  const v = plDecimal(value);
  switch (layout) {
    case 'nazwa-wynik-jednostka-zakres':
      return { text: `${name} ${v} ${unit} ${range ?? ''}`.trim(), range };
    case 'nazwa-wynik-flaga-jednostka-zakres':
      return { text: `${name} ${v}${flag ? ` ${flag}` : ''} ${unit} ${range ?? ''}`.trim(), range };
    default:
      return { text: `${name} [${unit}] ${v} ${range ? `(${range.replace(' - ', '-')})` : ''}`.trim(), range: range?.replace(' - ', '-') };
  }
}

const UNIT_PRINT: Record<string, string> = { '10*3/uL': 'tys/ul', 'g/dL': 'g/dl', 'mg/dL': 'mg/dl', 'u[IU]/mL': 'uIU/ml', 'mIU/L': 'mIU/l' };

export async function generateSynthetic(actor: AuditActor, opts: SyntheticOptions): Promise<{ patients: number; reports: number; measurements: number; pdfs: SyntheticLabDoc[] }> {
  const r = rng(opts.seed);
  const now = Date.now();
  let reports = 0;
  let measurements = 0;
  const pdfs: SyntheticLabDoc[] = [];
  if (opts.pdfDir) fs.mkdirSync(opts.pdfDir, { recursive: true });
  const scope = opts.orgId ? { orgId: opts.orgId } : {};

  for (let i = 0; i < opts.count; i += 1) {
    const female = r() < 0.5;
    const given = pick(r, female ? GIVEN_F : GIVEN_M);
    const family = pick(r, FAMILY) + (female ? 'a' : 'y');
    const year = 1945 + Math.floor(r() * 60);
    const birthDate = `${year}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
    const patient = await runInScope(scope, () =>
      createPatient(actor, { given, family, birthDate, gender: female ? 'female' : 'male', phone: `+48 500 ${String(100 + i).padStart(3, '0')} ${String(Math.floor(r() * 900) + 100)}` }, { verified: true, fictional: true }),
    );
    const patientRef = `Patient/${patient.id}`;
    // trend osobniczy: stałe przesunięcie i dryf w czasie (dane podłużne)
    const offset = new Map(PANELS.flatMap((p) => p.tests).map((t) => [t.key, (r() - 0.5) * t.spread]));
    const drift = new Map(PANELS.flatMap((p) => p.tests).map((t) => [t.key, (r() - 0.5) * t.spread * 0.4]));
    const visits = Math.max(2, Math.round(opts.years * 2 + r() * 2));
    for (let v = 0; v < visits; v += 1) {
      const ageFrac = 1 - v / visits; // 1 = najstarszy
      const at = new Date(now - ageFrac * opts.years * 365 * 86_400_000 - Math.floor(r() * 20) * 86_400_000);
      at.setUTCHours(6, 30, 0, 0);
      const panel = PANELS[v % PANELS.length];
      const layout = LAYOUTS[Math.floor(r() * LAYOUTS.length)];
      const items: SyntheticLabDoc['items'] = [];
      const lines: string[] = [];
      const observations = panel.tests.map((t) => {
        const def = LAB_TESTS.find((d) => d.key === t.key)!;
        const value = t.base + (offset.get(t.key) ?? 0) + (drift.get(t.key) ?? 0) * (1 - ageFrac) + (r() - 0.5) * t.spread * 0.5;
        const val = fmt(Math.max(0, value), t.decimals);
        const flag = t.high !== undefined && Number(val) > t.high ? 'H' : t.low !== undefined && Number(val) < t.low ? 'L' : undefined;
        const unit = def.units[0];
        const line = labLine(layout, def.names[1] ?? def.pl, val, UNIT_PRINT[unit] ?? unit, t.low, t.high, flag);
        lines.push(line.text);
        items.push({ name: def.pl, loinc: def.loinc, value: val, unit, rangeText: line.range });
        return { loinc: def.loinc, name: def.pl, value: val, unit, refLow: t.low, refHigh: t.high, labFlag: flag as 'H' | 'L' | undefined };
      });
      await runInScope(scope, () =>
        createReport(actor, { patientId: patient.id ?? '', title: panel.title, loinc: panel.loinc, category: 'LAB', effective: at.toISOString(), laboratory: 'Laboratorium Syntetyczne (fikcyjne)', observations }),
      );
      reports += 1;
      if (opts.pdfDir) {
        const date = at.toISOString().slice(0, 10).split('-').reverse().join('.');
        const file = `syntetyczny-${String(i + 1).padStart(3, '0')}-${String(v + 1).padStart(2, '0')}.pdf`;
        fs.writeFileSync(path.join(opts.pdfDir, file), simplePdf(['Laboratorium Syntetyczne - DANE FIKCYJNE', `Pacjent: ${given} ${family} (osoba fikcyjna)`, `Data pobrania: ${date}`, ...lines].map(ascii)));
        pdfs.push({ file, layout, collectedAt: at.toISOString().slice(0, 10), items });
      }
    }
    // pomiary domowe co tydzień (ciśnienie) — dane podłużne do wykresów
    const weeks = Math.min(26, Math.round(opts.years * 52));
    const sysBase = 115 + r() * 25;
    for (let w = weeks; w >= 0; w -= 1) {
      const at = new Date(now - w * 7 * 86_400_000);
      at.setUTCHours(6, 0, 0, 0);
      if (at.getTime() > now) continue;
      await runInScope({ patientRef }, () =>
        addMeasurement({ ...actor, actorRef: patientRef, roles: ['patient'] }, patientRef, {
          kind: 'bp',
          systolic: Math.round(sysBase + (r() - 0.5) * 14),
          diastolic: Math.round(sysBase * 0.62 + (r() - 0.5) * 8),
          pulse: Math.round(62 + r() * 18),
          effective: at.toISOString(),
          source: 'manual',
        }),
      );
      measurements += 1;
    }
  }
  if (opts.pdfDir) fs.writeFileSync(path.join(opts.pdfDir, 'oczekiwane.json'), JSON.stringify({ generator: 'eternal-synthetic/1', seed: opts.seed, documents: pdfs }, null, 2));
  audit(actor, { action: 'C', subtype: 'synthetic-generate', detail: { count: opts.count, seed: opts.seed, years: opts.years, reports, measurements, pdfs: pdfs.length, purpose: opts.purpose } });
  return { patients: opts.count, reports, measurements, pdfs };
}

/**
 * Import paczek FHIR R4 z Synthea (pliki *.json w katalogu output/fhir): pacjenci i obserwacje laboratoryjne.
 * Identyfikatory z Synthea (SSN, prawa jazdy, paszporty itp.) są pomijane; zasoby dostają TAG_FICTIONAL i znacznik organizacji.
 */
export async function importSynthea(actor: AuditActor, dir: string, opts: { orgId?: string; purpose: string; limit?: number }): Promise<{ patients: number; observations: number }> {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !/^(hospitalInformation|practitionerInformation)/.test(f));
  let patients = 0;
  let observations = 0;
  const tag = (r: Patient | Observation) => {
    const tagged = { ...r, meta: { tag: [TAG_FICTIONAL] } } as typeof r;
    return opts.orgId ? withOrgTags(tagged, [opts.orgId]) : tagged;
  };
  for (const f of files) {
    if (opts.limit && patients >= opts.limit) break;
    const bundle = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Bundle;
    const src = bundle.entry?.find((e) => e.resource?.resourceType === 'Patient')?.resource as Patient | undefined;
    if (!src) continue;
    const name = src.name?.[0];
    const patient = await fhirSystem().create<Patient>(
      tag({
        resourceType: 'Patient',
        active: true,
        // Synthea dodaje cyfry do imion („Anna123”) — usuwamy je
        name: [{ given: (name?.given ?? ['Syntetyczny']).map((g) => g.replace(/\d+/g, '')), family: (name?.family ?? 'Pacjent').replace(/\d+/g, '') }],
        gender: src.gender,
        birthDate: src.birthDate,
      }) as Patient,
    );
    patients += 1;
    for (const e of bundle.entry ?? []) {
      const o = e.resource as Observation | undefined;
      if (o?.resourceType !== 'Observation') continue;
      if (!o.category?.some((c) => c.coding?.some((x) => x.code === 'laboratory'))) continue;
      if (!o.valueQuantity || !o.code.coding?.some((c) => c.system === 'http://loinc.org')) continue;
      await fhirSystem().create<Observation>(
        tag({
          resourceType: 'Observation',
          status: 'final',
          category: o.category,
          code: o.code,
          subject: { reference: `Patient/${patient.id}` },
          effectiveDateTime: o.effectiveDateTime,
          valueQuantity: o.valueQuantity,
        }) as Observation,
      );
      observations += 1;
    }
  }
  audit(actor, { action: 'C', subtype: 'synthetic-import', detail: { source: 'synthea', patients, observations, purpose: opts.purpose } });
  return { patients, observations };
}
