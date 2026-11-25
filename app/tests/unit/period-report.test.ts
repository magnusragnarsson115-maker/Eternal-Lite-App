import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listAudit } from '../../server/audit.js';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { HttpError } from '../../server/lib/util.js';
import { pdfAvailable } from '../../server/pdf/render.js';
import { setConsent } from '../../server/services/consents.js';
import type { MeasurementView } from '../../server/services/observations.js';
import { groupMeasurements, periodBounds, periodReportHtml } from '../../server/services/periodReport.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';
import { system } from './helpers.js';

/** A3.1 pulpit faktów, A4.1/A4.2 raport okresowy — granice okresu, statystyki opisowe, brak oceny. */

const TZ = 'Europe/Warsaw';
const NOW = new Date('2026-10-15T10:00:00Z');
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? e.code : String(e);
  }
  return 'ok';
};

describe('Raport okresowy — granice okresu w strefie czasowej', () => {
  it('tydzień od poniedziałku, miesiąc i kwartał kalendarzowy, z przejściem na czas zimowy', () => {
    const w = periodBounds('week', { anchor: '2026-10-15' }, TZ, NOW);
    expect(w).toMatchObject({ from: '2026-10-12', to: '2026-10-18', startUtc: '2026-10-11T22:00:00.000Z', endUtc: '2026-10-18T22:00:00.000Z', partial: true });
    // październik 2026: czas letni do 25.10 — koniec miesiąca już w czasie zimowym (UTC+1)
    const m = periodBounds('month', { anchor: '2026-10-03' }, TZ, NOW);
    expect(m).toMatchObject({ from: '2026-10-01', to: '2026-10-31', startUtc: '2026-09-30T22:00:00.000Z', endUtc: '2026-10-31T23:00:00.000Z', label: 'październik 2026' });
    const q = periodBounds('quarter', { anchor: '2026-08-20' }, TZ, NOW);
    expect(q).toMatchObject({ from: '2026-07-01', to: '2026-09-30', label: 'III kwartał 2026', partial: false });
    expect(periodBounds('week', { anchor: '2026-09-27' }, TZ, NOW)).toMatchObject({ from: '2026-09-21', to: '2026-09-27', partial: false });
    expect(periodBounds('custom', { from: '2026-02-01', to: '2026-02-28' }, TZ, NOW)).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('odrzuca zakres odwrócony, za długi, nieistniejącą datę i okres przyszły', () => {
    expect(code(() => periodBounds('custom', { from: '2026-03-10', to: '2026-03-01' }, TZ, NOW))).toBe('period_invalid');
    expect(code(() => periodBounds('custom', { from: '2025-01-01', to: '2026-06-01' }, TZ, NOW))).toBe('period_too_long');
    expect(code(() => periodBounds('custom', { from: '2026-02-30', to: '2026-03-01' }, TZ, NOW))).toBe('period_invalid');
    expect(code(() => periodBounds('month', { anchor: '2026-11-02' }, TZ, NOW))).toBe('period_in_future');
  });
});

describe('Raport okresowy — statystyki opisowe', () => {
  const m = (id: string, effective: string, v: Partial<MeasurementView>): MeasurementView => ({ id, kind: 'bp', effective, unit: 'mmHg', source: 'manual', ...v });

  it('nie łączy źródeł ani urządzeń; średnia z metodą tylko przy co najmniej 2 odczytach', () => {
    const groups = groupMeasurements([
      m('1', '2026-09-21T06:00:00Z', { systolic: 120, diastolic: 80 }),
      m('2', '2026-09-22T06:00:00Z', { systolic: 131, diastolic: 85 }),
      m('3', '2026-09-23T06:00:00Z', { systolic: 150, diastolic: 95, source: 'bluetooth', device: 'Ciśnieniomierz A' }),
      m('4', '2026-09-23T06:00:00Z', { systolic: 152, diastolic: 96, source: 'bluetooth', device: 'Ciśnieniomierz B' }),
      m('5', '2026-09-21T05:00:00Z', { kind: 'weight', unit: 'kg', value: 80.2 }),
    ]);
    expect(groups.map((g) => [g.kind, g.source, g.device ?? '', g.count])).toEqual([
      ['bp', 'manual', '', 2],
      ['bp', 'bluetooth', 'Ciśnieniomierz A', 1],
      ['bp', 'bluetooth', 'Ciśnieniomierz B', 1],
      ['weight', 'manual', '', 1],
    ]);
    expect(groups[0].stats).toEqual([
      { key: 'systolic', label: 'skurczowe', min: 120, max: 131, mean: 125.5 },
      { key: 'diastolic', label: 'rozkurczowe', min: 80, max: 85, mean: 82.5 },
    ]);
    expect(groups[1].stats[0].mean).toBeUndefined();
    expect(groups[3].stats).toEqual([{ key: 'value', label: 'wartość', min: 80.2, max: 80.2, mean: undefined }]);
  });

  it('raport PDF nie zawiera słów oceniających ani pasów norm', () => {
    const period = periodBounds('week', { anchor: '2026-09-24' }, TZ, NOW);
    const groups = groupMeasurements([
      m('1', '2026-09-21T06:00:00Z', { systolic: 120, diastolic: 80 }),
      m('2', '2026-09-22T06:00:00Z', { systolic: 131, diastolic: 85, flags: [{ type: 'conflict', withId: '9', withSource: 'manual' }] }),
    ]);
    const html = periodReportHtml(
      { templateVersion: 'test', generatedAt: NOW.toISOString(), period, patient: { name: 'Jan Testowy' }, groups, labs: [], labsUnconfirmed: 0, appointments: [], method: 'm', empty: false },
      'Klinika',
    );
    expect(html).toContain('125,5');
    expect(html).toContain('inny odczyt z tej samej minuty');
    expect(html).not.toMatch(/\b(nieprawidłow|niepokoj|za wysok|za nisk|w normie|poza norm|nadciśnieni|ryzyk|zalec)/i);
    expect(html).not.toContain('#e6f2e6'); // pas zakresu z wykresu wyników laboratoryjnych
  });
});

describe('Raport okresowy — API pacjenta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const PW = 'Spokojny-Poranek-42';

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    for (const t of ['terms', 'privacy', 'results-online'] as const) await setConsent(system, fx.patient.ref, t, true);
    pt = new Client(fx.app);
    expect((await pt.req('POST', '/api/auth/login', { email: user.email, password: PW })).status).toBe(200);
    const csv = [
      'data;rodzaj;wartość;skurczowe;rozkurczowe;tętno;jednostka;uwagi',
      '21.09.2026 08:00;ciśnienie;;120;80;;mmHg;',
      '23.09.2026 08:00;ciśnienie;;130;84;;mmHg;',
      '27.09.2026 23:30;ciśnienie;;125;81;;mmHg;', // niedziela 23:30 czasu polskiego — jeszcze ten tydzień
      '28.09.2026 00:10;ciśnienie;;140;90;;mmHg;', // poniedziałek 00:10 (w UTC jeszcze niedziela) — następny tydzień
      '22.09.2026 07:00;masa ciała;80,0;;;;kg;',
    ].join('\n');
    expect((await pt.req('POST', '/api/me/measurements/import', { content: csv, fileName: 'p.csv' })).json.imported).toBe(5);
    expect((await pt.req('POST', '/api/me/measurements', { kind: 'bp', systolic: 150, diastolic: 95, effective: '2026-09-24T17:00:00Z' })).status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('tydzień: granice w czasie lokalnym, grupy według źródła, średnia z metodą, dziennik dostępu', async () => {
    const r = await pt.req('GET', '/api/me/report?period=week&anchor=2026-09-24');
    expect(r.status).toBe(200);
    const bpImport = r.json.groups.find((g: { kind: string; source: string }) => g.kind === 'bp' && g.source === 'import');
    const bpManual = r.json.groups.find((g: { kind: string; source: string }) => g.kind === 'bp' && g.source === 'manual');
    expect(bpImport.count).toBe(3);
    expect(bpImport.stats[0]).toMatchObject({ min: 120, max: 130, mean: 125 });
    expect(bpImport.stats[1].mean).toBe(81.7);
    expect(bpManual.count).toBe(1);
    expect(r.json.method).toMatch(/nie łączymy/);
    expect(r.json.empty).toBe(false);

    const next = await pt.req('GET', '/api/me/report?period=week&anchor=2026-09-28');
    expect(next.json.groups.map((g: { count: number }) => g.count)).toEqual([1]);

    const empty = await pt.req('GET', '/api/me/report?period=month&anchor=2026-03-10');
    expect(empty.json).toMatchObject({ empty: true, groups: [], labs: [] });
    expect((await pt.req('GET', '/api/me/report?period=custom&from=2026-03-10&to=2026-03-01')).json.error).toBe('period_invalid');

    const subtypes = listAudit({ patientRef: fx.patient.ref }).map((a) => a.subtype);
    expect(subtypes).toContain('patient-report');
  });

  it('pulpit faktów: ostatni odczyt każdego rodzaju z datą i źródłem', async () => {
    const r = await pt.req('GET', '/api/me/facts/latest');
    expect(r.status).toBe(200);
    expect(r.json.measurements.map((m: { kind: string }) => m.kind)).toEqual(['bp', 'weight']);
    expect(r.json.measurements[0]).toMatchObject({ systolic: 140, diastolic: 90, source: 'import' });
    expect(r.json.lastLab).toBeUndefined();
  });

  it.skipIf(!pdfAvailable())('PDF raportu', async () => {
    const r = await pt.req('GET', '/api/me/report.pdf?period=week&anchor=2026-09-24');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.raw.subarray(0, 5).toString()).toBe('%PDF-');
    expect(listAudit({ patientRef: fx.patient.ref }).some((a) => a.subtype === 'patient-report-pdf')).toBe(true);
  }, 30_000);
});
