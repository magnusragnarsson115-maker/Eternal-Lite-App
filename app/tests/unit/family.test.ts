import type { Observation, Patient, RelatedPerson } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { proxyRouteVerdict, resolveProxy } from '../../server/auth/proxy.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { notifyPatient } from '../../server/services/notifications.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';
import { makePatient } from './helpers.js';

/** A22.1/A24.1/A24.2/A5.13 — profile rodzinne, dostęp zastępczy i panel opiekuna. */

describe('Profile rodzinne i dostęp opiekuna', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let parent: Client;
  let second: Client;
  let parentUserId = '';
  let secondRef = '';
  let childId = '';
  const PW = 'Rodzinny-Poranek-42';
  const as = (id: string) => ({ headers: { 'x-eternal-profile': id } });

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    parentUserId = user.id;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    parent = new Client(fx.app);
    expect((await parent.req('POST', '/api/auth/login', { email: user.email, password: PW })).status).toBe(200);
    const other = await makePatient('Piotr', 'Drugi', { verified: true, account: true });
    secondRef = other.ref;
    updateUser(other.userId!, { password_hash: await hashPassword(PW) });
    second = new Client(fx.app);
    expect((await second.req('POST', '/api/auth/login', { email: 'piotr.drugi@test.local', password: PW })).status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('profil dziecka: wymaga oświadczenia i niepełnoletności; widoczny w placówce rodzica, powiązanie zapisane w FHIR', async () => {
    const base = { given: 'Zosia', family: 'Linkowa', birthDate: '2019-04-02', relation: 'parent' };
    expect((await parent.req('POST', '/api/me/family/dependents', base)).status).toBe(400); // brak oświadczenia
    expect((await parent.req('POST', '/api/me/family/dependents', { ...base, birthDate: '2001-01-01', declaration: true })).json.error).toBe('child_must_be_minor');
    const r = await parent.req('POST', '/api/me/family/dependents', { ...base, declaration: true });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ name: 'Zosia Linkowa', managed: true, relation: 'parent', access: 'full', self: false });
    childId = r.json.id;
    const p = await fhirSystem().read<Patient>('Patient', childId);
    expect(p.meta?.tag?.some((t) => t.system === ORG_TAG_SYSTEM && t.code === fx.orgId)).toBe(true);
    const rp = await fhirSystem().search<RelatedPerson>('RelatedPerson', { patient: `Patient/${childId}` });
    expect(rp[0].relationship?.[0].coding?.[0].code).toBe('PRN');
    expect(rp[0].meta?.tag).toEqual(expect.arrayContaining([{ system: ORG_TAG_SYSTEM, code: vaultOrgId(`Patient/${childId}`) }]));
    const fam = await parent.req('GET', '/api/me/family');
    expect(fam.json.profiles.map((x: { name: string }) => x.name)).toEqual(['Maria Linkowa', 'Zosia Linkowa']);
  });

  it('działanie w profilu dziecka: dane trafiają do profilu dziecka, dziennik pokazuje opiekuna', async () => {
    const add = await parent.req('POST', '/api/me/measurements', { kind: 'weight', value: 21.4 }, as(childId));
    expect(add.status).toBe(200);
    const childItems = (await parent.req('GET', '/api/me/measurements', undefined, as(childId))).json.items;
    expect(childItems).toHaveLength(1);
    const own = (await parent.req('GET', '/api/me/measurements')).json.items;
    expect(own.some((m: { value?: number }) => m.value === 21.4)).toBe(false);
    const obs = await fhirSystem().search<Observation>('Observation', { subject: `Patient/${childId}` });
    expect(obs).toHaveLength(1);
    const log = await parent.req('GET', '/api/me/access-log', undefined, as(childId));
    expect(log.json.items[0]).toMatchObject({ role: 'caregiver', who: 'Maria Linkowa (opiekun)' });
  });

  it('obszary osobiste i cudze profile są zablokowane', async () => {
    expect((await parent.req('GET', '/api/me/surveys', undefined, as(childId))).json.error).toBe('proxy_not_allowed');
    expect((await parent.req('POST', '/api/me/delete-data', { password: PW }, as(childId))).json.error).toBe('proxy_not_allowed');
    expect((await second.req('GET', '/api/me/measurements', undefined, as(childId))).json.error).toBe('proxy_not_allowed');
    expect((await parent.req('GET', '/api/me/measurements', undefined, as(secondRef.split('/')[1]))).json.error).toBe('proxy_not_allowed');
    expect(proxyRouteVerdict('PUT', '/api/me/consents/:type', { access: 'full', managed: false })).toBe('proxy_not_allowed');
    expect(proxyRouteVerdict('PUT', '/api/me/consents/:type', { access: 'full', managed: true })).toBeUndefined();
    expect(proxyRouteVerdict('GET', '/api/me/report.pdf', { access: 'view', managed: false })).toBeUndefined();
  });

  it('drugi opiekun przez kod: tylko podgląd, odebranie jednym ruchem; kod jednorazowy', async () => {
    const inv = await parent.req('POST', '/api/me/family/invites', { patientId: childId, relation: 'parent', access: 'view' });
    expect(inv.status).toBe(200);
    expect(inv.json.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect((await parent.req('POST', '/api/me/family/accept', { code: inv.json.code })).json.error).toBe('invite_own');
    const acc = await second.req('POST', '/api/me/family/accept', { code: inv.json.code.toLowerCase().replace('-', ' ') });
    expect(acc.status).toBe(200);
    expect(acc.json).toMatchObject({ name: 'Zosia Linkowa', access: 'view' });
    expect((await second.req('POST', '/api/me/family/accept', { code: inv.json.code })).json.error).toBe('invite_not_found');
    expect((await second.req('GET', '/api/me/measurements', undefined, as(childId))).json.items).toHaveLength(1);
    expect((await second.req('POST', '/api/me/measurements', { kind: 'weight', value: 22 }, as(childId))).json.error).toBe('proxy_read_only');
    const access = await parent.req('GET', `/api/me/family/${childId}/access`);
    const link = access.json.items.find((a: { name?: string }) => a.name === 'Piotr Drugi');
    expect(link).toMatchObject({ access: 'view', status: 'active' });
    // powiadomienie zapraszającego — bez danych o zdrowiu
    const notes = getDb().prepare("SELECT title, body FROM notification WHERE user_id = ? AND kind = 'family'").all(parentUserId) as { title: string; body: string }[];
    expect(notes.at(-1)?.body).toContain('Piotr Drugi — tylko podgląd');
    expect((await parent.req('DELETE', `/api/me/family/links/${link.id}`)).status).toBe(200);
    expect((await second.req('GET', '/api/me/measurements', undefined, as(childId))).json.error).toBe('proxy_not_allowed');
  });

  it('dorosły z własnym kontem zaprasza rodzinę do swojego profilu; nie może dać roli rodzica', async () => {
    expect((await second.req('POST', '/api/me/family/invites', { relation: 'parent', access: 'full' })).json.error).toBe('invalid_relation');
    const inv = await second.req('POST', '/api/me/family/invites', { relation: 'family', access: 'view', days: 30 });
    const acc = await parent.req('POST', '/api/me/family/accept', { code: inv.json.code });
    expect(acc.json).toMatchObject({ name: 'Piotr Drugi', relation: 'family', managed: false });
    expect((await parent.req('GET', '/api/me/report?period=month', undefined, as(secondRef.split('/')[1]))).status).toBe(200);
    expect((await parent.req('PUT', '/api/me/consents/telemedicine', { granted: true }, as(secondRef.split('/')[1]))).json.error).toBe('proxy_read_only');
    const mine = await second.req('GET', '/api/me/family');
    expect(mine.json.access[0]).toMatchObject({ name: 'Maria Linkowa', access: 'view', relation: 'family' });
    expect(mine.json.access[0].expiresAt).toBeTruthy();
  });

  it('ostatni opiekun nie może zrezygnować; powiadomienia profilu bez konta trafiają do opiekuna z imieniem', async () => {
    const fam = await parent.req('GET', '/api/me/family');
    const child = fam.json.profiles.find((p: { id: string }) => p.id === childId);
    expect((await parent.req('DELETE', `/api/me/family/links/${child.linkId}`)).json.error).toBe('last_guardian');
    await notifyPatient(`Patient/${childId}`, { kind: 'appointment', title: 'Przypomnienie o wizycie', body: 'Jutro 9:00', link: '/wizyty' });
    const n = getDb().prepare("SELECT title, link FROM notification WHERE user_id = ? AND kind = 'appointment' ORDER BY created_at DESC").get(parentUserId) as { title: string; link: string };
    expect(n).toEqual({ title: 'Zosia: Przypomnienie o wizycie', link: `/wizyty?profile=${childId}` });
  });

  it('panel opiekuna: wszystkie profile naraz, same fakty', async () => {
    const r = await parent.req('GET', '/api/me/family/overview');
    expect(r.status).toBe(200);
    const names = r.json.items.map((i: { name: string }) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Zosia Linkowa', 'Piotr Drugi']));
    expect(r.json.items[0].medsToday).toEqual({ due: 0, taken: 0, skipped: 0, missed: 0 });
  });

  it('pełnoletność kończy dostęp rodzica', async () => {
    const link = resolveProxy(parentUserId, `Patient/${childId}`)!;
    expect(link).toBeTruthy();
    expect(resolveProxy(parentUserId, `Patient/${childId}`, new Date('2037-04-02T12:00:00Z'))).toBeUndefined();
    expect(resolveProxy(parentUserId, `Patient/${childId}`, new Date('2037-04-01T12:00:00Z'))).toBeTruthy();
  });

  it('usunięcie profilu dziecka: dane własne profilu znikają, profil nie jest już widoczny', async () => {
    const del = await parent.req('DELETE', `/api/me/family/dependents/${childId}`);
    expect(del.status).toBe(200);
    expect(del.json.steps.map((s: { key: string }) => s.key)).toEqual(['sharing', 'vault', 'entries']);
    expect(await fhirSystem().search<Observation>('Observation', { subject: `Patient/${childId}` })).toHaveLength(0);
    const fam = await parent.req('GET', '/api/me/family');
    expect(fam.json.profiles.map((p: { id: string }) => p.id)).not.toContain(childId);
    expect((await parent.req('GET', '/api/me/measurements', undefined, as(childId))).json.error).toBe('proxy_not_allowed');
  });
});
