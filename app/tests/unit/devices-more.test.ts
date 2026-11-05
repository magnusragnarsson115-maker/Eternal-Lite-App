import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { mapSleepSeries } from '../../server/integrations/withings.js';
import { streaks } from '../../server/services/achievements.js';
import { genomicKind } from '../../server/services/genomicFiles.js';
import { kindForService, parseGlucose, parsePlxContinuous } from '../../web/src/lib/ble.js';
import { matchCommand } from '../../web/src/lib/voice.js';
import { Client, ORIGIN } from './client.js';
import { orgFixture } from './fixture.js';

/** Runda 4, część 2: odznaki (F13.4), plik DNA (F16.2), aktywność i sen (F2.1, F2.2, F2.19, F9.1, F9.3), Bluetooth (F2.9, F2.21), głos (A17.10). */

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
const sfloat = (mantissa: number, exp: number) => {
  const raw = ((exp & 0xf) << 12) | (mantissa & 0x0fff);
  return [raw & 0xff, raw >> 8];
};

function multipart(fields: Record<string, string>, file: { name: string; type: string; data: Buffer }): { body: Buffer; type: string } {
  const b = '----eternal-test-boundary';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.data, Buffer.from(`\r\n--${b}--\r\n`));
  return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${b}` };
}

describe('Runda 4 — urządzenia, odznaki, plik DNA, głos', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Urzadzenia-Dnia-44') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Urzadzenia-Dnia-44' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('serie dni: bieżąca liczy się także, gdy dziś jeszcze nic nie zapisano; najdłuższa z przerwami', () => {
    expect(streaks(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-14', '2026-10-15', '2026-10-16'], '2026-10-17')).toEqual({ current: 3, longest: 3 });
    expect(streaks(['2026-10-17', '2026-10-16'], '2026-10-17')).toEqual({ current: 2, longest: 2 });
    expect(streaks(['2026-10-01'], '2026-10-17')).toEqual({ current: 0, longest: 1 });
    expect(streaks([], '2026-10-17')).toEqual({ current: 0, longest: 0 });
  });

  it('odznaki liczą dni z zapisem, nie wartości', async () => {
    await pt.req('POST', '/api/me/journal', { kind: 'mood', mood: 2 });
    const a = await pt.req('GET', '/api/me/achievements');
    expect(a.status).toBe(200);
    expect(a.json.activeDays).toBeGreaterThanOrEqual(1);
    expect(a.json.badges.find((b: { key: string }) => b.key === 'first-entry').earned).toBe(true);
    expect(JSON.stringify(a.json)).not.toMatch(/mood|nastr|score|punkt/i);
  });

  it('plik DNA: tylko po potwierdzeniu, tylko ZIP/GZ/tekst, bez odczytu; poza dokumentami; pobranie i usunięcie z dziennikiem', async () => {
    expect(genomicKind(Buffer.from('# rsid\tchromosome\tposition\tgenotype\nrs123\t1\t1000\tAA\n'))).toBe('text/plain');
    expect(genomicKind(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toBe('application/zip');
    expect(genomicKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBeUndefined();
    const raw = Buffer.from('# plik testowy dostawcy\nrs0001\t1\t12345\tAG\n');
    const no = multipart({ provider: 'Test', confirmed: 'false' }, { name: 'dna.txt', type: 'text/plain', data: raw });
    expect((await pt.upload('/api/me/genomic-files', no.body, no.type)).status).toBe(400);
    const bad = multipart({ confirmed: 'true' }, { name: 'x.png', type: 'image/png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]) });
    expect((await pt.upload('/api/me/genomic-files', bad.body, bad.type)).status).toBe(400);
    const ok = multipart({ provider: 'Test DNA', confirmed: 'true' }, { name: 'dna.txt', type: 'text/plain', data: raw });
    const up = await pt.upload('/api/me/genomic-files', ok.body, ok.type);
    expect(up.status).toBe(200);
    expect(up.json.items[0]).toMatchObject({ filename: 'dna.txt', provider: 'Test DNA', size: raw.length, contentType: 'text/plain' });
    const id = up.json.items[0].id;
    const res = await fx.app.inject({ method: 'GET', url: `/api/me/genomic-files/${id}/file`, headers: { cookie: pt.cookie, origin: ORIGIN, host: 'localhost:3000' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
    expect(res.rawPayload.equals(raw)).toBe(true);
    const docs = await pt.req('GET', '/api/me/documents');
    expect(JSON.stringify(docs.json)).not.toContain('dna.txt');
    const log = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype LIKE 'genomic-file-%' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(log.n).toBeGreaterThanOrEqual(3);
    expect((await pt.req('DELETE', `/api/me/genomic-files/${id}`)).json.items).toHaveLength(0);
  });

  it('aktywność i sen: import dzienny z telefonu, ponowny import nadpisuje, fazy snu zachowane; data z przyszłości odrzucona', async () => {
    const days = [
      { date: '2026-10-15', steps: 8123, sleep: { minutes: 412, deep: 70, light: 250, rem: 92, awake: 18 } },
      { date: '2026-10-16', steps: 10500 },
    ];
    const r = await pt.req('POST', '/api/me/activity/import', { source: 'healthkit', device: 'Apple Health', days });
    expect(r.json).toEqual({ created: 3, updated: 0 });
    const again = await pt.req('POST', '/api/me/activity/import', { source: 'healthkit', days: [{ date: '2026-10-16', steps: 10750 }] });
    expect(again.json).toEqual({ created: 0, updated: 1 });
    const list = await pt.req('GET', '/api/me/activity?days=60');
    const d15 = list.json.items.find((x: { date: string }) => x.date === '2026-10-15');
    expect(d15).toMatchObject({ source: 'healthkit', steps: 8123, sleep: { minutes: 412, deep: 70, light: 250, rem: 92, awake: 18 } });
    expect(list.json.items.find((x: { date: string }) => x.date === '2026-10-16').steps).toBe(10750);
    expect((await pt.req('POST', '/api/me/activity/import', { source: 'healthkit', days: [{ date: '2099-01-01', steps: 1 }] })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/activity/import', { source: 'fitbit', days })).status).toBe(400);
  });

  it('Withings Sleep: sekundy → minuty, okno snu z czasu uniksowego', () => {
    expect(mapSleepSeries([{ date: '2026-10-16', startdate: 1792188000, enddate: 1792215000, data: { total_sleep_time: 25200, deepsleepduration: 4800, lightsleepduration: 15000, remsleepduration: 5400, wakeupduration: 1200 } }, { date: '2026-10-15', data: {} }])).toEqual([
      { date: '2026-10-16', sleep: { minutes: 420, deep: 80, light: 250, rem: 90, awake: 20, start: new Date(1792188000 * 1000).toISOString(), end: new Date(1792215000 * 1000).toISOString() } },
    ]);
  });

  it('Bluetooth: PLX ciągły, glukometr (kg/L i mol/L → mg/dL), rodzaj po numerze usługi', () => {
    expect(parsePlxContinuous(dv([0x00, ...sfloat(96, 0), ...sfloat(71, 0)]))).toMatchObject({ kind: 'spo2', value: 96, pulse: 71 });
    const ts = [0xea, 0x07, 10, 17, 7, 5, 0];
    expect(parseGlucose(dv([0x02, 0x01, 0x00, ...ts, ...sfloat(95, -5), 0x11]))).toMatchObject({ kind: 'glucose', value: 95, unit: 'mg/dL' });
    expect(parseGlucose(dv([0x07, 0x02, 0x00, ...ts, 0x00, 0x00, ...sfloat(53, -4), 0x11]))).toMatchObject({ value: 95, unit: 'mg/dL' });
    expect(() => parseGlucose(dv([0x00, 0x01, 0x00, ...ts]))).toThrow();
    expect(kindForService(0x1822)).toBe('spo2');
    expect(kindForService('00001808-0000-1000-8000-00805f9b34fb')).toBe('glucose');
    expect(kindForService(0x1234)).toBeUndefined();
  });

  it('głos: polecenia przejścia po polsku i angielsku; „pomoc” otwiera ekran pomocy, nic nie wybiera samo', () => {
    expect(matchCommand('pokaż moje wyniki')).toEqual({ to: '/wyniki', label: 'Wyniki od placówki' });
    expect(matchCommand('Leki')).toMatchObject({ to: '/leki' });
    expect(matchCommand('apteki w pobliżu')).toMatchObject({ to: '/apteki' });
    expect(matchCommand('wróć')).toBe('back');
    expect(matchCommand('help')).toMatchObject({ to: '/pomoc' });
    expect(matchCommand('zadzwoń do mamy')).toBeUndefined();
  });
});
