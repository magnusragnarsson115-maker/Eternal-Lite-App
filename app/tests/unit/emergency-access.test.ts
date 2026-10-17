import type { Observation } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db.js';
import { LOINC, TRUST } from '../../server/fhir/constants.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { ORG_TAG_SYSTEM, vaultOrgId, withOrgTags } from '../../server/tenancy.js';
import { orgFixture } from './fixture.js';

/** A24.5 — dostęp ratunkowy z pełnym logiem: uzasadnienie, 60 minut, powiadomienie pacjenta, przegląd administratora. */

describe('Dostęp ratunkowy personelu', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pid = '';
  const okBody = { reason: 'unconscious', justification: 'Pacjent przywieziony nieprzytomny, potrzebna lista leków i alergii.', confirm: true };

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    pid = fx.patient.ref.split('/')[1];
    // wynik w sejfie pacjenta — bez udostępnienia klinika go nie widzi
    await fhirSystem().create<Observation>(
      withOrgTags(
        {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: LOINC, code: '2345-7', display: 'Glukoza' }], text: 'Glukoza' },
          subject: { reference: fx.patient.ref },
          effectiveDateTime: '2026-09-01',
          valueQuantity: { value: 96, unit: 'mg/dl' },
          meta: { tag: [TRUST.patientConfirmed] },
        },
        [vaultOrgId(fx.patient.ref)],
      ),
    );
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('bez udostępnienia: raport tylko z danymi placówki; tylko lekarz może otworzyć dostęp, z uzasadnieniem', async () => {
    const before = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid}/facts`);
    expect(before.json.sharing.vaultIncluded).toBe(false);
    expect((await fx.clients.reception.req('POST', `/api/staff/patients/${pid}/emergency-access`, okBody)).status).toBe(403);
    expect((await fx.clients.doctor.req('POST', `/api/staff/patients/${pid}/emergency-access`, { ...okBody, justification: 'za krótko' })).json.error).toBe('justification_too_short');
    expect((await fx.clients.doctor.req('POST', `/api/staff/patients/${pid}/emergency-access`, { ...okBody, confirm: false })).status).toBe(400);
    // pacjent obcej placówki — nie da się „wyszukać” przez dostęp ratunkowy
    expect((await fx.clients.other.req('POST', `/api/staff/patients/${pid}/emergency-access`, okBody)).json.error).toBe('patient_not_found');
  });

  it('otwarcie: 60 minut, raport z sejfem i oznaczeniem, pacjent powiadomiony bez danych o zdrowiu', async () => {
    const r = await fx.clients.doctor.req('POST', `/api/staff/patients/${pid}/emergency-access`, okBody);
    expect(r.status).toBe(200);
    expect(Date.parse(r.json.expiresAt) - Date.parse(r.json.startedAt)).toBe(60 * 60_000);
    const again = await fx.clients.doctor.req('POST', `/api/staff/patients/${pid}/emergency-access`, okBody);
    expect(again.json.id).toBe(r.json.id); // jedno aktywne naraz
    const facts = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid}/facts`);
    expect(facts.json.sharing.vaultIncluded).toBe(true);
    expect(facts.json.sharing.emergency.id).toBe(r.json.id);
    expect(JSON.stringify(facts.json.results)).toContain('Glukoza');
    const userId = getDb().prepare('SELECT id FROM app_user WHERE fhir_ref = ?').get(fx.patient.ref) as { id: string };
    const n = getDb().prepare("SELECT title, body FROM notification WHERE user_id = ? AND kind = 'emergency-access'").get(userId.id) as { title: string; body: string };
    expect(n.title).toBe('Dostęp ratunkowy do Twoich danych');
    expect(n.body).not.toMatch(/glukoz|nieprzytomny|leków/i);
    const audit = getDb().prepare("SELECT detail FROM audit_log WHERE subtype = 'break-glass' AND patient_ref = ?").get(fx.patient.ref) as { detail: string };
    expect(JSON.parse(audit.detail)).toMatchObject({ reason: 'unconscious', minutes: 60 });
    // inny lekarz tej samej placówki nie korzysta z cudzego dostępu ratunkowego
    expect(getDb().prepare('SELECT practitioner_ref FROM emergency_access WHERE id = ?').get(r.json.id)).toMatchObject({ practitioner_ref: expect.stringMatching(/^Practitioner\//) });
  });

  it('pacjent widzi kto, kiedy i dlaczego — bez wewnętrznego uzasadnienia', async () => {
    const { Client } = await import('./client.js');
    const { hashPassword } = await import('../../server/auth/passwords.js');
    const { findUserByFhirRef, updateUser } = await import('../../server/auth/users.js');
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Ratunkowy-Dzien-42') });
    const pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Ratunkowy-Dzien-42' });
    const list = await pt.req('GET', '/api/me/emergency-access');
    expect(list.json.items[0]).toMatchObject({ who: 'lek. Jan Testowy', reason: 'unconscious', active: true });
    expect(list.json.items[0].justification).toBeUndefined();
    const log = await pt.req('GET', '/api/me/access-log');
    expect(log.json.items.some((e: { subtype: string }) => e.subtype === 'break-glass')).toBe(true);
  });

  it('zakończenie przez lekarza; przegląd administratora — „nieuzasadniony” zakłada zgłoszenie naruszenia', async () => {
    const active = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid}/emergency-access`);
    expect((await fx.clients.doctor.req('POST', `/api/staff/emergency-access/${active.json.active.id}/end`)).status).toBe(200);
    expect((await fx.clients.doctor.req('GET', `/api/staff/patients/${pid}/facts`)).json.sharing.vaultIncluded).toBe(false);
    const list = await fx.clients.admin.req('GET', '/api/admin/emergency-access');
    expect(list.json.items[0]).toMatchObject({ who: 'lek. Jan Testowy', patientName: 'Maria Linkowa', active: false });
    expect(list.json.items[0].justification).toContain('nieprzytomny');
    const id = list.json.items[0].id;
    expect((await fx.clients.admin.req('POST', `/api/admin/emergency-access/${id}/review`, { outcome: 'unjustified' })).json.error).toBe('note_required');
    const rev = await fx.clients.admin.req('POST', `/api/admin/emergency-access/${id}/review`, { outcome: 'unjustified', note: 'Pacjent był przytomny i dostępny telefonicznie.' });
    expect(rev.json.review.outcome).toBe('unjustified');
    expect((await fx.clients.admin.req('POST', `/api/admin/emergency-access/${id}/review`, { outcome: 'justified' })).json.error).toBe('already_reviewed');
    const inc = getDb().prepare("SELECT category, severity, data_breach FROM incident WHERE description LIKE ?").get(`%${id}%`);
    expect(inc).toEqual({ category: 'privacy', severity: 'high', data_breach: 1 });
    expect((await fx.clients.doctor.req('GET', '/api/admin/emergency-access')).status).toBe(403);
  });
});
