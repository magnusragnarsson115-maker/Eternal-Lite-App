import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readDocument } from '../../server/ai/ocr.js';
import { getDb } from '../../server/db.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { parseLabDocument } from '../../server/labs/parser.js';
import { generateSynthetic, rng, type SyntheticLabDoc } from '../../server/seed/synthetic.js';
import { setupCore, system } from './helpers.js';

describe('Dane syntetyczne (D5.3)', () => {
  let dir: string;
  let docs: SyntheticLabDoc[] = [];

  beforeAll(async () => {
    await setupCore();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eternal-synth-'));
    const r = await generateSynthetic(system, { count: 3, seed: 7, years: 1, purpose: 'test jednostkowy', pdfDir: dir });
    docs = r.pdfs;
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('generator jest deterministyczny', () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('tworzy fikcyjnych pacjentów z danymi podłużnymi i zapisem w rejestrze użyć', async () => {
    const patients = await fhirSystem().search('Patient', {});
    expect(patients).toHaveLength(3);
    expect(patients.every((p) => p.meta?.tag?.some((t) => t.code === 'fictional'))).toBe(true);
    expect(patients.every((p) => !p.identifier?.some((i) => i.system?.includes('pesel')))).toBe(true);
    const reports = await fhirSystem().search('DiagnosticReport', {});
    expect(reports.length).toBeGreaterThanOrEqual(6);
    const log = getDb().prepare("SELECT detail FROM audit_log WHERE subtype = 'synthetic-generate'").all() as { detail: string }[];
    expect(log).toHaveLength(1);
    expect(JSON.parse(log[0].detail)).toMatchObject({ count: 3, seed: 7, purpose: 'test jednostkowy' });
  });

  it('zestaw testowy odczytu: parser odczytuje wartości z PDF zgodnie z oczekiwaniami', async () => {
    expect(fs.existsSync(path.join(dir, 'oczekiwane.json'))).toBe(true);
    let expected = 0;
    let matched = 0;
    for (const d of docs) {
      const read = await readDocument(fs.readFileSync(path.join(dir, d.file)), 'application/pdf');
      const parsed = parseLabDocument(read.lines);
      expect(parsed.collectedAt).toBe(d.collectedAt);
      for (const item of d.items) {
        expected += 1;
        const hit = parsed.items.find((p) => p.match?.loinc === item.loinc);
        if (hit && hit.value.replace(',', '.') === item.value && hit.unit === item.unit) matched += 1;
      }
    }
    // każdy układ wydruku musi być czytelny dla parsera — zestaw służy do wykrywania regresji
    expect(matched).toBe(expected);
  });
});
