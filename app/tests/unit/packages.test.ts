import type { Questionnaire } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fhir } from '../../server/fhir/index.js';
import { getClinicSettings, listServices, upsertService } from '../../server/services/directory.js';
import { PACKAGES, specialtyKey } from '../../server/services/packages.js';
import { runInScope } from '../../server/tenancy.js';
import { orgFixture } from './fixture.js';
import { system } from './helpers.js';

/** M30 — pakiety specjalizacji: podgląd, zastosowanie tylko dodające, wywiad bez oceny (M27, N0). */

describe('Pakiety specjalizacji (M30)', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let cardioId = '';
  let ownId = '';

  beforeAll(async () => {
    fx = await orgFixture();
    await runInScope({ orgId: fx.orgId }, async () => {
      const own = await fhir().create<Questionnaire>({ resourceType: 'Questionnaire', status: 'active', title: 'Własny wywiad poradni', item: [{ linkId: 'a', type: 'text', text: 'Pytanie' }] });
      cardioId = (await upsertService(system, { name: 'Konsultacja kardiologiczna', specialty: 'Kardiologia', durationMinutes: 30, mode: 'in-person', active: true, locationIds: [] })).id;
      ownId = (await upsertService(system, { name: 'Echo serca', specialty: 'Kardiologia', durationMinutes: 30, mode: 'in-person', active: true, locationIds: [], questionnaireId: own.id })).id;
    });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('rozpoznaje specjalizację z dowolnej nazwy', () => {
    expect(specialtyKey('Poradnia kardiologiczna')).toBe('kardiologia');
    expect(specialtyKey('Choroby wewnętrzne')).toBe('interna');
    expect(specialtyKey('Pediatra')).toBe('pediatria');
    expect(specialtyKey('Diagnostyka laboratoryjna')).toBeUndefined();
  });

  it('wywiady pakietów: bez punktacji i oceny, z informacją o 112', () => {
    for (const p of PACKAGES) {
      const text = JSON.stringify(p.questionnaire);
      expect(text).toContain('112');
      expect(text).not.toMatch(/punkt|wynik testu|ryzyk|pilnie|triaż|ocen(a|ę) stanu/i);
      expect(p.questionnaire.item.some((i) => i.required)).toBe(true);
    }
  });

  it('podgląd: co zostanie dodane, czego nie dublujemy i których usług nie ruszamy', async () => {
    const list = await fx.clients.admin.req('GET', '/api/admin/packages');
    expect(list.status).toBe(200);
    const cardio = list.json.items.find((p: { id: string }) => p.id === 'kardiologia');
    expect(cardio.applied).toBe(false);
    expect(cardio.changes.services.attach.map((s: { id: string }) => s.id)).toEqual([cardioId]);
    expect(cardio.changes.services.skippedOwnQuestionnaire.map((s: { id: string }) => s.id)).toEqual([ownId]);
    // wyniki laboratoryjne: istniejący wymóg ogólny (6 mies.) jest bardziej restrykcyjny — nie dublujemy
    expect(cardio.changes.requiredDocuments.keep).toHaveLength(1);
    expect(cardio.changes.requiredDocuments.add.map((d: { id: string }) => d.id)).toEqual(['pkg-kardio-ecg', 'pkg-kardio-discharge']);
    expect(cardio.changes.questionnaire.action).toBe('create');
    expect((await fx.clients.doctor.req('GET', '/api/admin/packages')).status).toBe(403);
  });

  it('zastosowanie: dodaje ustawienia, tworzy wywiad i przypina go tylko do usług bez własnego wywiadu', async () => {
    const before = await runInScope({ orgId: fx.orgId }, async () => getClinicSettings());
    const r = await fx.clients.admin.req('POST', '/api/admin/packages/kardiologia/apply');
    expect(r.status).toBe(200);
    expect(r.json.applied).toBe(true);
    await runInScope({ orgId: fx.orgId }, async () => {
      const s = getClinicSettings();
      expect(s.specialties).toContain('kardiologia');
      expect(s.requiredDocuments.map((d) => d.id)).toEqual([...before.requiredDocuments.map((d) => d.id), 'pkg-kardio-ecg', 'pkg-kardio-discharge']);
      const services = await listServices(true);
      const cardio = services.find((x) => x.id === cardioId)!;
      const own = services.find((x) => x.id === ownId)!;
      const q = await fhir().read<Questionnaire>('Questionnaire', cardio.questionnaireId!);
      expect(q).toMatchObject({ url: 'urn:eternal:package:kardiologia:wywiad', status: 'active', title: 'Wywiad przed wizytą — kardiologia' });
      expect((await fhir().read<Questionnaire>('Questionnaire', own.questionnaireId!)).title).toBe('Własny wywiad poradni');
    });
    expect((await fx.clients.admin.req('POST', '/api/admin/packages/kardiologia/apply')).json.error).toBe('package_already_applied');
  });
});
