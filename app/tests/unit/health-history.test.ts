import type { Consent, Immunization } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { emergencyCard } from '../../server/services/safety.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A20.7/A21.7 szczepienia, A20.9/A21.9 choroby w rodzinie, A22.5 dyspozycje medyczne i oświadczenie woli. */

describe('Historia zdrowia wpisywana przez pacjenta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const future = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Historia-Zdrowia-42') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Historia-Zdrowia-42' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('szczepienie wykonane: FHIR Immunization zgłoszone przez pacjenta, w sejfie; data z przyszłości odrzucona', async () => {
    const r = await pt.req('POST', '/api/me/vaccinations', { status: 'done', code: 'tbe', date: '2025-05', dose: 2, lot: 'AB123', place: 'Przychodnia Rodzinna' });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: 'done', vaccine: 'Kleszczowe zapalenie mózgu', date: '2025-05', dose: 2, lot: 'AB123' });
    const imm = await fhirSystem().read<Immunization>('Immunization', r.json.id);
    expect(imm.primarySource).toBe(false);
    expect(imm.meta?.tag).toEqual(expect.arrayContaining([{ system: ORG_TAG_SYSTEM, code: vaultOrgId(fx.patient.ref) }]));
    expect((await pt.req('POST', '/api/me/vaccinations', { status: 'done', code: 'influenza', date: future })).json.error).toBe('date_in_future');
    expect((await pt.req('POST', '/api/me/vaccinations', { status: 'done', date: '2024-10-01' })).json.error).toBe('vaccine_required');
  });

  it('termin planowany → oznaczenie jako wykonane zamyka plan', async () => {
    const plan = await pt.req('POST', '/api/me/vaccinations', { status: 'planned', code: 'influenza', date: future });
    expect(plan.json).toMatchObject({ status: 'planned', vaccine: 'Grypa', date: future });
    expect((await pt.req('POST', '/api/me/vaccinations', { status: 'planned', code: 'influenza', date: '2020-01-01' })).json.error).toBe('date_in_past');
    const done = await pt.req('POST', `/api/me/vaccinations/${plan.json.id}/done`, { date: new Date().toISOString().slice(0, 10) });
    expect(done.json).toMatchObject({ status: 'done', vaccine: 'Grypa' });
    const list = (await pt.req('GET', '/api/me/vaccinations')).json.items;
    expect(list.filter((v: { status: string }) => v.status === 'planned')).toHaveLength(0);
    expect(list.map((v: { vaccine: string }) => v.vaccine)).toEqual(expect.arrayContaining(['Grypa', 'Kleszczowe zapalenie mózgu']));
  });

  it('choroby w rodzinie: krewny, choroby z wiekiem zachorowania; bez oceny ryzyka', async () => {
    const r = await pt.req('POST', '/api/me/family-history', { relationship: 'MTH', conditions: [{ code: 'diabetes', onsetAge: 52 }, { text: 'jaskra' }] });
    expect(r.json).toMatchObject({ relationshipLabel: 'matka', conditions: [{ code: 'diabetes', text: 'Cukrzyca', onsetAge: 52 }, { text: 'jaskra' }] });
    expect(JSON.stringify(r.json)).not.toMatch(/ryzyk|risk/i);
    expect((await pt.req('POST', '/api/me/family-history', { relationship: 'MTH', conditions: [{}] })).json.error).toBe('condition_required');
    expect((await pt.req('DELETE', `/api/me/family-history/${r.json.id}`)).status).toBe(200);
    expect((await pt.req('GET', '/api/me/family-history')).json.items).toHaveLength(0);
  });

  it('dyspozycje: zapis nadpisuje poprzednią; na karcie ratunkowej tylko zaznaczone', async () => {
    await pt.req('PUT', '/api/me/directives', { kind: 'organ-donation', value: 'undecided', showOnCard: false });
    const r = await pt.req('PUT', '/api/me/directives', { kind: 'organ-donation', value: 'donor', showOnCard: true });
    expect(r.json.items).toEqual([expect.objectContaining({ kind: 'organ-donation', value: 'donor', showOnCard: true })]);
    await pt.req('PUT', '/api/me/directives', { kind: 'transfusion', value: 'refuse', showOnCard: false });
    const all = await fhirSystem().search<Consent>('Consent', { patient: fx.patient.ref });
    expect(all.filter((c) => c.status === 'active' && c.scope?.coding?.[0]?.code === 'adr')).toHaveLength(2);
    const card = await emergencyCard(fx.patient.ref);
    expect(card.directives).toEqual(['Oświadczenie woli: chcę być dawcą narządów']);
    const list = await pt.req('GET', '/api/me/directives');
    expect(list.json.disclaimer).toContain('Centralnym Rejestrze Sprzeciwów');
    expect((await pt.req('DELETE', '/api/me/directives/transfusion')).json.items).toHaveLength(1);
    // aplikacyjne zgody nie mieszają się z dyspozycjami
    expect((await pt.req('GET', '/api/me/consents')).json.items.every((c: { type: string }) => !c.type.includes('organ'))).toBe(true);
  });

  it('eksport danych (RODO art. 20) zawiera wpisy z sejfu: szczepienia i dyspozycje', async () => {
    const r = await pt.req('GET', '/api/me/export');
    const types = new Set((r.json.entry as { resource: { resourceType: string } }[]).map((e) => e.resource.resourceType));
    expect(types.has('Immunization')).toBe(true);
    expect(types.has('Consent')).toBe(true);
  });
});
