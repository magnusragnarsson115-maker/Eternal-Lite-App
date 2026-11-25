import type { Observation } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { journalSummary, sleepHours } from '../../server/services/journal.js';
import { patientLabFacts } from '../../server/services/patientData.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** F8.2/A8.1, F8.14/F9.13, A21.3/A22.3, A8.6 — dzienniki pacjenta bez interpretacji. */

describe('Dzienniki pacjenta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Dziennik-Dnia-42') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Dziennik-Dnia-42' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('czas snu liczy się także przez północ', () => {
    expect(sleepHours('23:30', '07:00')).toBe(7.5);
    expect(sleepHours('01:15', '06:45')).toBe(5.5);
    expect(sleepHours('22:00', '22:00')).toBe(24);
  });

  it('nastrój: zapis w sejfie pacjenta (placówka nie widzi bez udostępnienia); bardzo niski nastrój → numery pomocy', async () => {
    const ok = await pt.req('POST', '/api/me/journal', { kind: 'mood', mood: 7, tags: ['work', 'sleep'], note: 'Spokojny dzień' });
    expect(ok.status).toBe(200);
    expect(ok.json.entry).toMatchObject({ kind: 'mood', mood: 7, tags: ['work', 'sleep'], note: 'Spokojny dzień' });
    expect(ok.json.crisis).toBeUndefined();
    const o = await fhirSystem().read<Observation>('Observation', ok.json.entry.id);
    expect(o.meta?.tag).toEqual(expect.arrayContaining([{ system: ORG_TAG_SYSTEM, code: vaultOrgId(fx.patient.ref) }]));
    expect(o.meta?.tag?.some((t) => t.system === ORG_TAG_SYSTEM && t.code === fx.orgId)).toBe(false);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'mood', mood: 2 })).json.crisis).toBe(true);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'mood', mood: 6, note: 'Myślę, żeby odebrać sobie życie' })).json.crisis).toBe(true);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'mood', mood: 11 })).status).toBe(400);
  });

  it('sen i sny: godziny, jakość, przebudzenia; bez ocen', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'sleep', date: '2026-10-14', bedtime: '23:30', wake: '07:00', quality: 4, awakenings: 1, note: 'Śniło mi się morze' });
    expect(r.json.entry.sleep).toEqual({ date: '2026-10-14', bedtime: '23:30', wake: '07:00', hours: 7.5, quality: 4, awakenings: 1 });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'sleep', date: '2026-10-14', bedtime: '25:00', wake: '07:00', quality: 4 })).status).toBe(400);
  });

  it('ból: mapa ciała i skala 0–10; obszar wymagany', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'pain', intensity: 6, regions: ['lower-back', 'left-knee'], character: ['dull'] });
    expect(r.json.entry.pain).toEqual({ intensity: 6, regions: ['lower-back', 'left-knee'], character: ['dull'] });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'pain', intensity: 6, regions: [] })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'pain', intensity: 6, regions: ['tail'] })).status).toBe(400);
  });

  it('lista według rodzaju, wycofanie wpisu; dzienniki nie trafiają do wyników badań', async () => {
    await pt.req('POST', '/api/me/journal', { kind: 'breathing', minutes: 3, pattern: 'box' });
    const moods = await pt.req('GET', '/api/me/journal?kind=mood');
    expect(moods.json.items.every((e: { kind: string }) => e.kind === 'mood')).toBe(true);
    const all = (await pt.req('GET', '/api/me/journal')).json.items;
    expect(new Set(all.map((e: { kind: string }) => e.kind))).toEqual(new Set(['mood', 'sleep', 'pain', 'breathing']));
    const summary = journalSummary(all);
    expect(summary.find((s) => s.kind === 'mood')).toMatchObject({ count: 3, min: 2, max: 7 });
    expect(await patientLabFacts(fx.patient.ref)).toHaveLength(0);
    const id = moods.json.items[0].id;
    expect((await pt.req('DELETE', `/api/me/journal/${id}`)).status).toBe(200);
    expect((await pt.req('GET', '/api/me/journal?kind=mood')).json.items.map((e: { id: string }) => e.id)).not.toContain(id);
  });
});
