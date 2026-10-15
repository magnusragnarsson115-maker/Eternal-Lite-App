import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { flagReadings, type MeasurementView } from '../../server/services/observations.js';
import { setConsent } from '../../server/services/consents.js';
import { Client, waitFor } from './client.js';
import { orgFixture } from './fixture.js';
import { multipart, simplePdf, system } from './helpers.js';

/** Wymagania MVP P0 (Biznesplan 7.1, arkusz 02 Macierzy v11) domknięte w Eternal Lite. */

const PW = 'Spokojny-Poranek-42';

describe('MVP P0 — dane pacjenta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    for (const t of ['terms', 'privacy', 'results-online'] as const) await setConsent(system, fx.patient.ref, t, true);
    pt = new Client(fx.app);
    expect((await pt.req('POST', '/api/auth/login', { email: user.email, password: PW })).status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  const CSV = [
    'data;rodzaj;wartość;skurczowe;rozkurczowe;tętno;jednostka;uwagi',
    '01.10.2026 08:30;ciśnienie;;128;82;71;mmHg;rano',
    '01.10.2026 08:35;masa ciała;78,4;;;;kg;',
    '01.10.2026 21:10;glukoza;5,5;;;;mmol/L;',
    '02.10.2026;temperatura;36,6;;;;°C;',
    '02.10.2026 07:00;waga;78,1;;;;;',
    '02.10.2026 07:05;ciśnienie;;80;120;;mmHg;',
    '02.10.2026 07:10;cukier;abc;;;;mg/dL;',
    '31.02.2026 07:10;tętno;70;;;;/min;',
    '01.10.2026 08:30;ciśnienie;;128;82;71;mmHg;rano',
    '03.10.2026 07:00;wynik;5;;;;mg/dL;',
    '03.10.2026 07:00;Cholesterol;190;;;;mg/dL;',
  ].join('\n');

  it('A1.6: podgląd importu CSV pokazuje błąd każdego wiersza, przelicza jednostki i niczego nie zapisuje', async () => {
    const r = await pt.req('POST', '/api/me/measurements/import/preview', { content: CSV, fileName: 'pomiary.csv' });
    expect(r.status).toBe(200);
    expect(r.json.format).toBe('csv');
    const byLine = new Map(r.json.rows.map((x: { line: number }) => [x.line, x]));
    const row = (n: number) => byLine.get(n) as { status: string; error?: { code: string }; warnings: string[]; value?: number; systolic?: number; pulse?: number };
    expect(row(2)).toMatchObject({ status: 'ok', systolic: 128, pulse: 71 });
    expect(row(3)).toMatchObject({ status: 'ok', value: 78.4 });
    expect(row(4).value).toBe(99.1); // 5,5 mmol/L × 18,016
    expect(row(4).warnings).toContain('unit_converted');
    expect(row(5).warnings).toContain('time_missing');
    expect(row(6).error?.code).toBe('unit_missing');
    expect(row(7).error?.code).toBe('diastolic_not_lower');
    expect(row(8).error?.code).toBe('value_invalid');
    expect(row(9).error?.code).toBe('date_invalid');
    expect(row(10)).toMatchObject({ status: 'duplicate', error: { code: 'duplicate_in_file' } });
    expect(row(11).error?.code).toBe('kind_unknown');
    expect(row(12).error?.code).toBe('kind_unknown');
    expect(r.json.summary).toMatchObject({ total: 11, ok: 4, duplicate: 1, error: 6 });
    const list = await pt.req('GET', '/api/me/measurements');
    expect(list.json.items.length).toBe(0);
  });

  it('A1.6: zapis tylko poprawnych wierszy; ponowny import tego samego pliku nie tworzy kopii', async () => {
    const first = await pt.req('POST', '/api/me/measurements/import', { content: CSV, fileName: 'pomiary.csv' });
    expect(first.json).toMatchObject({ imported: 4, error: 6 });
    const bp = await pt.req('GET', '/api/me/measurements?kind=bp');
    expect(bp.json.items[0]).toMatchObject({ systolic: 128, diastolic: 82, source: 'import', device: 'pomiary.csv' });
    const glu = await pt.req('GET', '/api/me/measurements?kind=glucose');
    expect(glu.json.items[0].note).toContain('przeliczono z 5,5 mmol/L');
    const again = await pt.req('POST', '/api/me/measurements/import', { content: CSV, fileName: 'pomiary.csv' });
    expect(again.json.imported).toBe(0);
    const all = await pt.req('GET', '/api/me/measurements');
    expect(all.json.items.filter((m: { kind: string }) => m.kind !== 'heartRate').length).toBe(4);
  });

  it('A1.6: JSON i FHIR Bundle; plik z samymi nagłówkami jest odrzucony', async () => {
    const json = JSON.stringify([{ date: '2026-10-04T09:00:00+02:00', kind: 'spo2', value: 97, unit: '%' }]);
    const j = await pt.req('POST', '/api/me/measurements/import/preview', { content: json });
    expect(j.json).toMatchObject({ format: 'json', summary: { ok: 1 } });
    const bundle = JSON.stringify({
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: { resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '29463-7' }] }, effectiveDateTime: '2026-10-05T07:00:00Z', valueQuantity: { value: 77.9, unit: 'kg' } } },
        { resource: { resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '2093-3' }], text: 'Cholesterol' }, effectiveDateTime: '2026-10-05T07:00:00Z', valueQuantity: { value: 190, unit: 'mg/dL' } } },
      ],
    });
    const b = await pt.req('POST', '/api/me/measurements/import/preview', { content: bundle });
    expect(b.json.format).toBe('fhir');
    expect(b.json.rows.map((x: { status: string; error?: { code: string } }) => x.error?.code ?? x.status)).toEqual(['ok', 'lab_result_row']);
    const empty = await pt.req('POST', '/api/me/measurements/import/preview', { content: 'data;rodzaj;wartość\n' });
    expect(empty.status).toBe(400);
    expect(empty.json.error).toBe('import_empty');
  });

  it('A1.7: odczyty z tej samej minuty są oznaczone, nie usuwane; inny odczyt kilka minut później nie jest oznaczony', async () => {
    await pt.req('POST', '/api/me/measurements', { kind: 'weight', value: 79.0, effective: '2026-10-01T06:35:20.000Z', source: 'manual' });
    await pt.req('POST', '/api/me/measurements', { kind: 'weight', value: 78.4, effective: '2026-10-01T06:35:40.000Z', source: 'bluetooth', device: 'Waga BT' });
    const w = await pt.req('GET', '/api/me/measurements?kind=weight');
    const manual = w.json.items.find((m: MeasurementView) => m.source === 'manual');
    const bt = w.json.items.find((m: MeasurementView) => m.source === 'bluetooth');
    const imported = w.json.items.find((m: MeasurementView) => m.source === 'import' && m.value === 78.4);
    expect(manual.flags.map((f: { type: string }) => f.type)).toContain('conflict');
    expect(bt.flags).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'same-reading', withSource: 'import' })]));
    expect(imported.flags.some((f: { type: string }) => f.type === 'same-reading')).toBe(true);
    // czyste porównanie: dwa pomiary ciśnienia 3 minuty od siebie to zwykły pomiar powtórzony, bez oznaczenia
    const base = { kind: 'bp' as const, unit: 'mmHg', source: 'manual' };
    const flagged = flagReadings([
      { ...base, id: 'a', effective: '2026-10-01T06:00:00.000Z', systolic: 130, diastolic: 85 },
      { ...base, id: 'b', effective: '2026-10-01T06:03:00.000Z', systolic: 126, diastolic: 82 },
    ]);
    expect(flagged.every((m) => !m.flags)).toBe(true);
  });

  it('A2.6: eksport CSV z pomiarami i wynikami; pomiary z eksportu można zaimportować z powrotem bez kopii', async () => {
    const res = await pt.req('GET', '/api/me/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.body;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split('\r\n')[0]).toContain('data;kategoria;rodzaj;wartość');
    expect(text).toContain(';pomiar;masa ciała;78,4;');
    const back = await pt.req('POST', '/api/me/measurements/import/preview', { content: text });
    // wszystkie pomiary z eksportu są już w danych — nic nie zostanie zapisane drugi raz
    expect(back.json.summary).toMatchObject({ ok: 0, error: 0, duplicate: back.json.summary.total });
  });

  it('A2.3: każda linia PDF ma położenie na stronie, więc pole można pokazać obok fragmentu oryginału', async () => {
    const pdf = simplePdf(['Laboratorium Testowe', 'Data pobrania: 2026-10-01', 'Glukoza 101 H mg/dl 70 - 99', 'Hemoglobina 13,9 g/dl 12 - 16']);
    const up = multipart({ kind: 'lab' }, { name: 'file', filename: 'wynik.pdf', contentType: 'application/pdf', data: pdf });
    const res = await pt.upload('/api/me/intake', up.payload, up.contentType);
    const item = await waitFor(async () => {
      const r = await pt.req('GET', `/api/me/intake/${res.json.id}`);
      return r.json.status === 'processing' ? undefined : r.json;
    });
    const lines = item.extract.lines as { text: string; box?: number[] }[];
    expect(lines.every((l) => l.box && l.box.length === 4 && l.box.every((v) => v >= 0 && v <= 1) && l.box[0] < l.box[2] && l.box[1] < l.box[3])).toBe(true);
    // kolejne wiersze są niżej na stronie
    for (let i = 1; i < lines.length; i++) expect(lines[i].box![1]).toBeGreaterThan(lines[i - 1].box![1]);
    const glu = item.extract.items.find((f: { name: string }) => /Glukoza/.test(f.name));
    expect(lines[glu.line].text).toContain('Glukoza 101');
  });
});

describe('MVP P0 — objaśnienia ze słownika (A2.4)', () => {
  it('każde badanie słownika ma opis i każda jego jednostka ma objaśnienie', async () => {
    const { LAB_TESTS } = await import('../../server/labs/dictionary.js');
    const { TEST_TEXT, UNIT_TEXT, unitKey } = await import('../../server/labs/explanations.js');
    expect(LAB_TESTS.filter((t) => !TEST_TEXT[t.key]).map((t) => t.key)).toEqual([]);
    const missingUnits = [...new Set(LAB_TESTS.flatMap((t) => t.units))].filter((u) => !UNIT_TEXT[unitKey(u)]);
    expect(missingUnits).toEqual([]);
    // zapisy z polskich wydruków trafiają w te same objaśnienia
    expect(unitKey('µIU/ml')).toBe(unitKey('u[IU]/mL'));
    expect(unitKey('tys/µl')).toBe(unitKey('10*3/uL'));
    expect(unitKey('mg/dl')).toBe(unitKey('mg/dL'));
  });

  it('opisy niczego nie oceniają: bez słów interpretujących wartość, przyczyn i zaleceń', async () => {
    const { TEST_TEXT, FIELD_TEXT } = await import('../../server/labs/explanations.js');
    const forbidden = /podwyższon|obniżon|za wysok|za nisk|nieprawidłow|w normie|poza normą|świadcz|wskazuje na|oznacza chorob|choroba|zawał|cukrzyc|nowotw|zaleca|należy|powinien|powinna|niedobór|nadmiar/i;
    const bad = [...Object.entries(TEST_TEXT), ...Object.entries(FIELD_TEXT)].filter(([, txt]) => forbidden.test(txt));
    expect(bad).toEqual([]);
  });

  it('pacjent widzi opisy dopiero po zatwierdzeniu przez lekarza; zmiana treści unieważnia zatwierdzenie', async () => {
    const { setupCore } = await import('./helpers.js');
    await setupCore();
    const ex = await import('../../server/labs/explanations.js');
    const { config } = await import('../../server/config.js');
    const { setSetting } = await import('../../server/settings.js');
    const demo = config.demoMode;
    (config as { demoMode: boolean }).demoMode = false;
    try {
      expect(ex.explanationsView()).toMatchObject({ visible: false, draft: true });
      expect(() => ex.approveExplanations(system, 'ab')).toThrow();
      ex.approveExplanations(system, 'lek. Test Testowy, PWZ 1234567');
      const v = ex.explanationsView();
      expect(v).toMatchObject({ visible: true, draft: false, approval: { by: 'lek. Test Testowy, PWZ 1234567' } });
      expect(v.tests['2345-7'].text).toContain('glukozy');
      // zatwierdzenie innej treści (inny skrót) nie obowiązuje
      setSetting('lab-explanations-approval', { version: ex.EXPLANATIONS_VERSION, hash: 'inna-tresc', approvedBy: 'x', approvedAt: new Date().toISOString() });
      expect(ex.explanationsView().visible).toBe(false);
    } finally {
      (config as { demoMode: boolean }).demoMode = demo;
    }
  });
});
