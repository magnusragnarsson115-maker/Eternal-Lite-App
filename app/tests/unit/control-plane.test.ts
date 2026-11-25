import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { newId } from '../../server/lib/util.js';
import { systemStatus } from '../../server/services/systemStatus.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A18.2 karta modelu, A18.8 tryb degradacji, D5.4 sprzeciw EHDS, F1.12 logowanie z nowego urządzenia. */

describe('Warstwa nadzoru', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let email = '';
  let userId = '';
  const PW = 'Nadzor-Systemu-42';

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    email = u.email;
    userId = u.id;
    updateUser(u.id, { password_hash: await hashPassword(PW) });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('tryb degradacji: 3 błędy AI bez sukcesu → „ograniczone działanie” z opisem zastępstwa; sukces przywraca', async () => {
    const anon = new Client(fx.app);
    expect((await anon.req('GET', '/api/public/status')).json.degraded).toBe(false);
    const ins = getDb().prepare("INSERT INTO ai_call (id, ts, task, provider, outcome) VALUES (?, ?, 'scribe-note', 'anthropic', ?)");
    const t = (s: number) => new Date(Date.now() - s * 1000).toISOString();
    for (const s of [300, 200, 100]) ins.run(newId(), t(s), 'error');
    const st = (await anon.req('GET', '/api/public/status')).json;
    expect(st.degraded).toBe(true);
    expect(st.items.find((i: { id: string }) => i.id === 'ai')).toMatchObject({ status: 'degraded', fallback: expect.stringContaining('ręcznie') });
    ins.run(newId(), t(10), 'ok');
    expect(systemStatus().find((i) => i.id === 'ai')?.status).toBe('ok');
  });

  it('karta modelu: co robi, czego nie robi, kto sprawdza; osobna karta „czego aplikacja nie robi”', async () => {
    const r = await new Client(fx.app).req('GET', '/api/public/ai-cards');
    expect(r.json.items.map((c: { id: string }) => c.id)).toEqual(['scribe-note', 'patient-summary', 'lab-extract', 'transcription', 'no-ai']);
    for (const c of r.json.items) {
      expect(c.doesNot.length).toBeGreaterThan(10);
      expect(c.oversight.length).toBeGreaterThan(10);
    }
    expect(r.json.items[4].doesNot).toMatch(/triażu, diagnozy, oceny ryzyka/);
  });

  it('sprzeciw EHDS: osobna pozycja w zgodach z historią; administrator widzi tylko liczbę', async () => {
    const pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email, password: PW });
    const list = await pt.req('GET', '/api/me/consents');
    expect(list.json.items.map((c: { type: string }) => c.type)).toContain('secondary-use-objection');
    expect((await pt.req('PUT', '/api/me/consents/secondary-use-objection', { granted: true })).status).toBe(200);
    const reg = await fx.clients.admin.req('GET', '/api/admin/ai-registry');
    expect(reg.json.secondaryUse).toEqual({ objections: 1, patients: expect.any(Number) });
  });

  it('logowanie z nowego urządzenia: powiadomienie i e-mail bez danych o zdrowiu; to samo urządzenie — cisza', async () => {
    const count = () => (getDb().prepare("SELECT COUNT(*) AS n FROM notification WHERE user_id = ? AND kind = 'security'").get(userId) as { n: number }).n;
    const before = count();
    const again = new Client(fx.app);
    await again.req('POST', '/api/auth/login', { email, password: PW });
    expect(count()).toBe(before);
    const phone = new Client(fx.app);
    const r = await phone.req('POST', '/api/auth/login', { email, password: PW }, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' } });
    expect(r.status).toBe(200);
    expect(count()).toBe(before + 1);
    const n = getDb().prepare("SELECT title, body FROM notification WHERE user_id = ? AND kind = 'security' ORDER BY created_at DESC").get(userId) as { title: string; body: string };
    expect(n.title).toBe('Logowanie z nowego urządzenia');
    expect(n.body).toContain('Safari · iOS');
    const mail = getDb().prepare("SELECT subject FROM outbox WHERE dedupe_key LIKE ?").get(`new-device:${userId}:%`) as { subject: string };
    expect(mail.subject).toBe('Eternal: logowanie z nowego urządzenia');
  });
});
