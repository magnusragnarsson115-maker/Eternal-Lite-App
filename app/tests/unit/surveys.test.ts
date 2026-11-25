import type { Observation, QuestionnaireResponse } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, findUserById, updateUser } from '../../server/auth/users.js';
import { getDb } from '../../server/db.js';
import { LOINC, TRUST } from '../../server/fhir/constants.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { createGrant } from '../../server/services/grants.js';
import { SURVEYS, surveysFor } from '../../server/services/surveys.js';
import { ORG_TAG_SYSTEM, runInScope, vaultOrgId, withOrgTags } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';
import { system } from './helpers.js';

/** A12.3 — ankiety: wstępna zdrowotna, po wynikach, kontrolna po raportach, anonimowa ocena aplikacji. */

const DAY = 86_400_000;

describe('Ankiety pacjenta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  let userId = '';
  const PW = 'Spokojny-Poranek-42';
  const due = (items: { id: string; due: boolean }[]) => items.filter((i) => i.due).map((i) => i.id);
  const at = async (days: number) => due(await surveysFor(findUserById(userId)!, fx.patient.ref, Date.now() + days * DAY));

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    userId = user.id;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    pt = new Client(fx.app);
    expect((await pt.req('POST', '/api/auth/login', { email: user.email, password: PW })).status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('treści ankiet: bez punktacji i wniosków; zdrowotne z informacją o 112; ocena aplikacji ostrzega przed danymi o zdrowiu', () => {
    for (const s of SURVEYS) {
      const text = JSON.stringify(s.item);
      expect(text).not.toMatch(/wynik ankiety|punkt(y|ów)|ryzyk|zalecamy|powinieneś|nieprawidłow/i);
      if (s.kind === 'health') expect(text).toContain('112');
      else expect(text).toMatch(/Nie wpisuj/);
    }
  });

  it('na start: należna jest tylko ankieta zdrowotna; można ją odłożyć, ale nie pominąć', async () => {
    const r = await pt.req('GET', '/api/me/surveys');
    expect(r.status).toBe(200);
    expect(due(r.json.items)).toEqual(['health-intake']);
    expect((await pt.req('POST', '/api/me/surveys/health-intake/defer', { mode: 'skip' })).json.error).toBe('survey_cannot_skip');
    await pt.req('POST', '/api/me/surveys/health-intake/defer', { mode: 'later' });
    expect(due((await pt.req('GET', '/api/me/surveys')).json.items)).toEqual([]);
    expect(await at(4)).toContain('health-intake'); // po 3 dniach wraca
  });

  it('ankieta wstępna: walidacja, zapis w sejfie pacjenta, historia i aktualizacja od ostatnich odpowiedzi', async () => {
    expect((await pt.req('POST', '/api/me/surveys/health-intake', { answers: { smoking: 'never' } })).json.error).toBe('required_answer_missing');
    const ok = await pt.req('POST', '/api/me/surveys/health-intake', {
      answers: { chronic: ['hypertension', 'other'], 'chronic-other': 'dna moczanowa', allergies: true, 'allergies-list': 'penicylina', smoking: 'former', 'self-rated': '4' },
      platform: 'web',
    });
    expect(ok.status).toBe(200);
    const qr = await fhirSystem().read<QuestionnaireResponse>('QuestionnaireResponse', ok.json.responseId);
    expect(qr.meta?.tag).toEqual(expect.arrayContaining([{ system: ORG_TAG_SYSTEM, code: vaultOrgId(fx.patient.ref) }]));
    expect(qr.meta?.tag?.some((t) => t.system === ORG_TAG_SYSTEM && t.code === fx.orgId)).toBe(false); // placówka nie widzi bez udostępnienia
    const list = await pt.req('GET', '/api/me/surveys');
    expect(due(list.json.items)).toEqual([]);
    expect(list.json.history[0]).toMatchObject({ surveyId: 'health-intake', title: 'Ankieta zdrowotna na start' });
    const again = await pt.req('GET', '/api/me/surveys/health-intake');
    expect(again.json.answers).toMatchObject({ chronic: ['hypertension', 'other'], 'chronic-other': 'dna moczanowa', allergies: true });
    const read = await pt.req('GET', `/api/me/surveys/responses/${ok.json.responseId}`);
    expect(read.json.answers).toEqual(expect.arrayContaining([{ question: 'Na jakie leki?', answer: 'penicylina' }]));
  });

  it('kontrolna: po 3 różnych raportach i nie wcześniej niż 30 dni po poprzedniej ankiecie', async () => {
    for (const a of ['2026-07-15', '2026-07-15', '2026-08-15']) await pt.req('GET', `/api/me/report?period=month&anchor=${a}`); // ten sam okres liczy się raz
    expect(await at(31)).not.toContain('health-followup');
    await pt.req('GET', '/api/me/report?period=quarter&anchor=2026-08-15');
    expect(due((await pt.req('GET', '/api/me/surveys')).json.items)).not.toContain('health-followup'); // dopiero co wypełniona wstępna
    expect(await at(31)).toContain('health-followup');
  });

  it('po wynikach: nowe potwierdzone wyniki → ankieta; pytanie do lekarza wraca do wysłania; słowa kryzysowe → numery pomocy', async () => {
    const obs = (value: number) =>
      fhirSystem().create<Observation>(
        withOrgTags(
          {
            resourceType: 'Observation',
            status: 'final',
            meta: { tag: [TRUST.patientConfirmed] },
            code: { coding: [{ system: LOINC, code: '2345-7', display: 'Glukoza' }], text: 'Glukoza' },
            subject: { reference: fx.patient.ref },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value, unit: 'mg/dL' },
          },
          [vaultOrgId(fx.patient.ref)],
        ),
      );
    await obs(95);
    expect(due((await pt.req('GET', '/api/me/surveys')).json.items)).toContain('after-results');
    const r = await pt.req('POST', '/api/me/surveys/after-results', { answers: { discussed: 'no', understood: 'partly', question: 'Czy powtórzyć badanie?' } });
    expect(r.json).toMatchObject({ ok: true, question: 'Czy powtórzyć badanie?' });
    expect(due((await pt.req('GET', '/api/me/surveys')).json.items)).not.toContain('after-results');
    await obs(97);
    expect(due((await pt.req('GET', '/api/me/surveys')).json.items)).not.toContain('after-results'); // nie częściej niż co 7 dni
    expect(await at(8)).toContain('after-results');
    const crisis = await pt.req('POST', '/api/me/surveys/after-results', { answers: { discussed: 'no', question: 'nie chcę żyć' } });
    expect(crisis.json.crisis).toBe(true);
  });

  it('ocena aplikacji: po 14 dniach, anonimowo, identyfikatory usunięte; administrator widzi zestawienie bez treści zdrowotnych', async () => {
    expect(await at(1)).not.toContain('app-feedback');
    expect(await at(15)).toContain('app-feedback');
    const r = await pt.req('POST', '/api/me/surveys/app-feedback', { answers: { 'umux-1': '7', 'umux-2': '6', recommend: '9', hard: 'Nie umiem znaleźć raportu, piszcie na jan@example.com', missing: '' } });
    expect(r.json.responseId).toBeUndefined();
    const row = getDb().prepare("SELECT * FROM survey_submission WHERE survey_id = 'app-feedback'").get() as { answers: string; org_ids: string };
    expect(row.answers).toContain('[E-MAIL]');
    expect(row.answers).not.toContain('jan@example.com');
    expect(JSON.stringify(row)).not.toContain(fx.patient.ref);
    const sum = await fx.clients.admin.req('GET', '/api/admin/surveys');
    expect(sum.status).toBe(200);
    expect(sum.json).toMatchObject({ responses: 1, nps: 100 });
    expect(sum.json.umuxLite).toBeCloseTo(91.7, 1);
    expect(sum.json.completions.find((c: { surveyId: string }) => c.surveyId === 'health-intake').count).toBe(1);
    expect(JSON.stringify(sum.json)).not.toContain('penicylina');
    expect((await fx.clients.doctor.req('GET', '/api/admin/surveys')).status).toBe(403);
  });

  it('raport faktów: lekarz widzi ankietę zdrowotną tylko przy udostępnieniu przez pacjenta', async () => {
    const facts = () => fx.clients.doctor.req('GET', `/api/staff/patients/${fx.patient.patient.id}/facts`);
    expect((await facts()).json.surveys).toEqual([]);
    await runInScope({ orgId: fx.orgId }, () =>
      createGrant(system, { patientRef: fx.patient.ref, orgId: fx.orgId, scope: { kind: 'all' }, purpose: 'visit', source: 'app', expiresAt: new Date(Date.now() + 7 * DAY).toISOString() }),
    );
    const f = await facts();
    expect(f.json.surveys.map((s: { title: string }) => s.title)).toEqual(['Ankieta zdrowotna na start']);
    expect(JSON.stringify(f.json.surveys)).toContain('penicylina');
  });
});
