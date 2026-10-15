import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { addDays, isoWeekday, localDate } from '../../server/lib/time.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A17.13/A17.18 kalendarz i ICS (F5.6/F5.7), A22.4 plan rehabilitacji z kontrolą wykonania, A7.6 cele tygodniowe. */

describe('Kalendarz zdrowia, plan rehabilitacji i cele', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const today = localDate(new Date(), 'Europe/Warsaw');
  const wd = isoWeekday(today);
  let planId = '';

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Kalendarz-Zdrowia-42') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Kalendarz-Zdrowia-42' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('plan rehabilitacji: tylko lekarz go tworzy; pacjent dostaje powiadomienie i widzi dzisiejsze ćwiczenia', async () => {
    const body = { title: 'Kolano po urazie', start: addDays(today, -6), activities: [{ name: 'Przysiad przy ścianie', dose: '3 × 10', days: [1, 2, 3, 4, 5, 6, 7] }, { name: 'Rower stacjonarny', dose: '15 min', days: [wd] }] };
    expect((await fx.clients.reception.req('POST', `/api/staff/patients/${fx.patient.ref.split('/')[1]}/rehab`, body)).status).toBe(403);
    const r = await fx.clients.doctor.req('POST', `/api/staff/patients/${fx.patient.ref.split('/')[1]}/rehab`, body);
    expect(r.status).toBe(200);
    planId = r.json.id;
    const list = await pt.req('GET', '/api/me/rehab');
    expect(list.json.items[0]).toMatchObject({ title: 'Kolano po urazie', author: 'lek. Jan Testowy' });
    expect(list.json.items[0].today.items.map((i: { name: string }) => i.name)).toEqual(['Przysiad przy ścianie', 'Rower stacjonarny']);
    // 7 dni × 1 ćwiczenie codzienne + 1 dzień roweru
    expect(list.json.items[0].adherence.total).toEqual({ expected: 8, done: 0 });
  });

  it('odhaczanie: liczby wykonania widzi pacjent i placówka; dzień bez ćwiczenia i przyszłość odrzucone', async () => {
    let r = await pt.req('POST', `/api/me/rehab/${planId}/log`, { activity: 0, day: today, done: true });
    r = await pt.req('POST', `/api/me/rehab/${planId}/log`, { activity: 0, day: addDays(today, -1), done: true });
    expect(r.json.adherence.total).toEqual({ expected: 8, done: 2 });
    expect(r.json.today.items[0].done).toBe(true);
    expect((await pt.req('POST', `/api/me/rehab/${planId}/log`, { activity: 0, day: addDays(today, 1), done: true })).json.error).toBe('invalid_date');
    expect((await pt.req('POST', `/api/me/rehab/${planId}/log`, { activity: 1, day: addDays(today, -1), done: true })).json.error).toBe('not_scheduled');
    const staff = await fx.clients.doctor.req('GET', `/api/staff/patients/${fx.patient.ref.split('/')[1]}/rehab`);
    expect(staff.json.items[0].adherence.total).toEqual({ expected: 8, done: 2 });
    expect(JSON.stringify(staff.json)).not.toMatch(/słab|dobr|ocen/i);
  });

  it('kalendarz: wizyta, szczepienie planowane, dni ćwiczeń i leki; zakres ograniczony', async () => {
    const plannedDay = addDays(today, 3);
    await pt.req('POST', '/api/me/vaccinations', { status: 'planned', code: 'influenza', date: plannedDay });
    await pt.req('POST', '/api/me/med-schedules', { label: 'Lek A', times: ['08:00', '20:00'], days: [] });
    const r = await pt.req('GET', `/api/me/calendar?from=${today}&to=${addDays(fx.day, 1)}&meds=1`);
    expect((await pt.req('GET', `/api/me/calendar?from=${today}&to=${addDays(fx.day, 1)}`)).json.items.some((e: { kind: string }) => e.kind === 'medication')).toBe(false);
    expect(r.status).toBe(200);
    const kinds = new Set(r.json.items.map((e: { kind: string }) => e.kind));
    expect(kinds).toEqual(new Set(['appointment', 'vaccination', 'rehab', 'medication']));
    expect(r.json.items.find((e: { kind: string }) => e.kind === 'vaccination')).toMatchObject({ start: plannedDay, allDay: true, title: 'Szczepienie: Grypa' });
    expect((await pt.req('GET', `/api/me/calendar?from=${today}&to=${addDays(today, 200)}`)).json.error).toBe('calendar_period_too_long');
  });

  it('subskrypcja ICS: prywatny adres, ogólne nazwy bez danych o zdrowiu, unieważnienie', async () => {
    const f = await pt.req('POST', '/api/me/calendar/feed');
    expect(f.json.webcal).toMatch(/^webcal:\/\/.+\/api\/calendar\/[A-Za-z0-9_-]+\.ics$/);
    const path = new URL(f.json.url).pathname;
    const anon = new Client(fx.app);
    const ics = await anon.req('GET', path);
    expect(ics.status).toBe(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.body).toContain('SUMMARY:Wizyta (Eternal)');
    expect(ics.body).toContain('SUMMARY:Szczepienie (Eternal)');
    expect(ics.body).not.toMatch(/Grypa|Kolano|Przysiad|Lek A|lek\. Jan/);
    const audit = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype = 'calendar-feed-read' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(audit.n).toBe(1);
    await pt.req('DELETE', '/api/me/calendar/feed');
    expect((await anon.req('GET', path)).status).toBe(404);
  });

  it('cele tygodniowe: liczone z danych aplikacji albo odhaczane; bez ocen', async () => {
    const g1 = await pt.req('POST', '/api/me/goals', { kind: 'bp-measure', target: 3 });
    expect(g1.json).toMatchObject({ kind: 'bp-measure', target: 3, week: { value: 0 } });
    await pt.req('POST', '/api/me/measurements', { kind: 'bp', systolic: 120, diastolic: 80 });
    await pt.req('POST', '/api/me/journal', { kind: 'breathing', minutes: 5, pattern: 'calm' });
    const g2 = await pt.req('POST', '/api/me/goals', { kind: 'breathing-minutes', target: 20 });
    expect(g2.json.week.value).toBe(5);
    expect((await pt.req('POST', '/api/me/goals', { kind: 'custom', target: 3 })).json.error).toBe('title_required');
    const g3 = await pt.req('POST', '/api/me/goals', { kind: 'custom', target: 5, title: 'Spacer 30 minut' });
    const checked = await pt.req('POST', `/api/me/goals/${g3.json.id}/check`, { done: true });
    expect(checked.json.week).toMatchObject({ value: 1, checkedToday: true });
    expect((await pt.req('POST', `/api/me/goals/${g1.json.id}/check`, { done: true })).json.error).toBe('goal_counted_automatically');
    const list = await pt.req('GET', '/api/me/goals');
    expect(list.json.items.find((g: { kind: string }) => g.kind === 'bp-measure').week.value).toBe(1);
    expect((await pt.req('DELETE', `/api/me/goals/${g1.json.id}`)).status).toBe(200);
    expect((await pt.req('GET', '/api/me/goals')).json.items).toHaveLength(2);
  });
});
