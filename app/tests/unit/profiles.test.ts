import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { config } from '../../server/config.js';
import { CLINIC_PROFILES } from '../../server/content/clinicProfiles.js';
import { getDb } from '../../server/db.js';
import { addDays, localDate } from '../../server/lib/time.js';
import { runAestheticReminderSweep } from '../../server/services/aesthetic.js';
import { bzodEligibility, runIpomReminderSweep } from '../../server/services/poz.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';
import { multipart } from './helpers.js';

/**
 * Profile placówek: POZ (deklaracje, IPOM, bilans „Moje Zdrowie”) i medycyna estetyczna (produkty i partie, karta
 * zabiegu, zgody, zdjęcia, powikłania). Profil tylko dodaje; funkcje profilu są niedostępne bez profilu.
 */

const PW = 'Profil-Placowki-2026';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const today = () => localDate(new Date(), config.clinic.timezone);

describe('Bilans „Moje Zdrowie” — uprawnienie orientacyjne (rocznikowo)', () => {
  it('20–49 lat co 5 lat, od 50 lat co 3 lata; za młody; brak daty urodzenia', () => {
    expect(bzodEligibility('2007-12-31', undefined, '2026-11-05')).toMatchObject({ age: 19, eligibleNow: false, reason: 'za-mlody', nextYear: 2027 });
    expect(bzodEligibility('2006-12-31', undefined, '2026-11-05')).toMatchObject({ age: 20, intervalYears: 5, eligibleNow: true });
    expect(bzodEligibility('1990-05-05', '2023-03-01', '2026-11-05')).toMatchObject({ eligibleNow: false, nextYear: 2028, reason: 'po-bilansie' });
    expect(bzodEligibility('1970-01-01', '2023-03-01', '2026-11-05')).toMatchObject({ age: 56, intervalYears: 3, eligibleNow: true });
    expect(bzodEligibility(undefined, undefined, '2026-11-05')).toMatchObject({ eligibleNow: false, reason: 'brak-daty-urodzenia' });
  });

  it('każdy profil ma potrzeby, braki i zasady; profile z funkcjami mają usługi', () => {
    for (const p of CLINIC_PROFILES) {
      expect(p.needs.length, p.id).toBeGreaterThan(0);
      expect(p.gaps.length, p.id).toBeGreaterThan(0);
      expect(p.services.length, p.id).toBeGreaterThan(0);
    }
    const est = CLINIC_PROFILES.find((p) => p.id === 'estetyka')!;
    expect(est.services.filter((s) => s.consentTemplate).every((s) => s.requiresPhysician)).toBe(true);
  });
});

describe('Profile placówek — API', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const pid = () => fx.patient.patient.id!;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: user.email, password: PW });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('bez profilu funkcje POZ i estetyki są niedostępne; profil stosuje tylko administrator', async () => {
    expect((await fx.clients.reception.req('GET', '/api/staff/poz/declarations')).json.error).toBe('profile_feature_off');
    expect((await fx.clients.doctor.req('GET', '/api/staff/aesthetic/products')).status).toBe(404);
    expect((await fx.clients.doctor.req('POST', '/api/admin/clinic-profiles/poz/apply')).status).toBe(403);
    const list = await fx.clients.admin.req('GET', '/api/admin/clinic-profiles');
    const poz = list.json.items.find((p: { id: string }) => p.id === 'poz');
    expect(poz.active).toBe(false);
    expect(poz.changes.services.length).toBeGreaterThan(5);
    expect(poz.gaps.map((g: { gap: string }) => g.gap).join(' ')).toMatch(/e-recepta/);
  });

  it('zastosowanie profilu POZ dodaje usługi, dokumenty, szablon „Porada kompleksowa”; ponowne nie dubluje', async () => {
    const before = (await fx.clients.admin.req('GET', '/api/admin/catalog')).json.services.length;
    const r = await fx.clients.admin.req('POST', '/api/admin/clinic-profiles/poz/apply');
    expect(r.status).toBe(200);
    expect(r.json.active).toBe(true);
    expect(r.json.changes.services).toHaveLength(0);
    const services = (await fx.clients.admin.req('GET', '/api/admin/catalog')).json.services;
    expect(services.length).toBeGreaterThan(before + 5);
    expect(services.find((s: { name: string }) => s.name === 'Teleporada lekarza POZ').mode).toBe('tele');
    const again = await fx.clients.admin.req('POST', '/api/admin/clinic-profiles/poz/apply');
    expect(again.status).toBe(200);
    expect((await fx.clients.admin.req('GET', '/api/admin/catalog')).json.services.length).toBe(services.length);
    const profile = await fx.clients.doctor.req('GET', '/api/staff/clinic-profile');
    expect(profile.json.features).toEqual(['poz']);
    const s = (await fx.clients.admin.req('GET', '/api/admin/settings')).json;
    expect(s.noteTemplates).toContain('koz');
    expect(s.requiredDocuments.map((d: { id: string }) => d.id)).toContain('poz-lab');
    // druga klinika nie ma profilu POZ
    expect((await fx.clients.other.req('GET', '/api/staff/poz/declarations')).status).toBe(404);
  });

  it('deklaracje: złożona → przyjęta; nowa przyjęta zastępuje poprzednią; odrzucenie wymaga powodu; lista aktywna', async () => {
    const prId = fx.ctx.doctor.id;
    const d1 = await fx.clients.reception.req('POST', '/api/staff/poz/declarations', { patientId: pid(), kind: 'lekarz', practitionerId: prId, source: 'papier' });
    expect(d1.status).toBe(200);
    expect(d1.json).toMatchObject({ status: 'zlozona', practitionerName: 'lek. Jan Testowy', patientName: 'Maria Linkowa' });
    expect((await fx.clients.reception.req('POST', '/api/staff/poz/declarations', { patientId: pid(), kind: 'lekarz', practitionerId: prId, source: 'ikp' })).status).toBe(409);
    expect((await fx.clients.reception.req('POST', `/api/staff/poz/declarations/${d1.json.id}/decision`, { action: 'reject' })).status).toBe(400);
    expect((await fx.clients.reception.req('POST', `/api/staff/poz/declarations/${d1.json.id}/decision`, { action: 'accept' })).json.status).toBe('przyjeta');
    const d2 = await fx.clients.reception.req('POST', '/api/staff/poz/declarations', { patientId: pid(), kind: 'lekarz', practitionerId: prId, source: 'ikp' });
    await fx.clients.reception.req('POST', `/api/staff/poz/declarations/${d2.json.id}/decision`, { action: 'accept' });
    const list = await fx.clients.reception.req('GET', '/api/staff/poz/declarations');
    expect(list.json.items.map((d: { status: string }) => d.status).sort()).toEqual(['przyjeta', 'zastapiona']);
    expect(list.json.active).toEqual([expect.objectContaining({ practitionerId: prId, kind: 'lekarz', count: 1 })]);
    const mine = await pt.req('GET', '/api/me/poz');
    expect(mine.json.declarations[0]).toMatchObject({ kind: 'lekarz', status: 'przyjeta', practitionerName: 'lek. Jan Testowy' });
  });

  it('IPOM: lekarz układa plan, koordynator odhacza, limity placówki, zaległości; pacjent widzi plan bez notatek', async () => {
    expect((await fx.clients.reception.req('POST', `/api/staff/patients/${pid()}/ipom`, { groups: ['nadcisnienie'], items: [] })).status).toBe(403);
    await fx.clients.admin.req('PUT', '/api/admin/ipom-limits', { limits: { edukacja: 6, dietetyk: 3 } });
    const yesterday = addDays(today(), -1);
    const tomorrow = addDays(today(), 1);
    const p = await fx.clients.doctor.req('POST', `/api/staff/patients/${pid()}/ipom`, {
      groups: ['nadcisnienie', 'cukrzyca-2', 'nieznana'],
      coordinatorUserId: fx.users.reception.id,
      note: 'Notatka wewnętrzna',
      items: [
        { kind: 'badanie', title: 'Lipidogram, kreatynina', dueOn: yesterday },
        { kind: 'edukacja', title: 'Porada edukacyjna — pomiary ciśnienia', dueOn: tomorrow },
        { kind: 'dietetyk', title: 'Porada dietetyczna' },
      ],
    });
    expect(p.status).toBe(200);
    expect(p.json.groups).toEqual(['nadcisnienie', 'cukrzyca-2']);
    expect(p.json.items.find((i: { kind: string }) => i.kind === 'badanie').overdue).toBe(true);
    const overdue = await fx.clients.reception.req('GET', '/api/staff/poz/ipom?overdue=1');
    expect(overdue.json.items[0]).toMatchObject({ overdue: 1, open: 3, coordinator: 'Recepcja' });
    const edu = p.json.items.find((i: { kind: string }) => i.kind === 'edukacja');
    const done = await fx.clients.reception.req('PUT', `/api/staff/poz/ipom/${p.json.id}/items/${edu.id}`, { status: 'zrealizowane' });
    expect(done.json.usage.find((u: { kind: string }) => u.kind === 'edukacja')).toMatchObject({ done: 1, limit: 6 });
    const mine = await pt.req('GET', '/api/me/poz');
    expect(mine.json.plans[0].note).toBeUndefined();
    expect(mine.json.plans[0].items[0].doneBy).toBeUndefined();
    expect(mine.json.plans[0].coordinator.name).toBe('Recepcja');
    // przypomnienie dla pacjenta: pozycja na jutro — treść ogólna; nie powtarza się
    const sent = await runIpomReminderSweep();
    expect(sent).toBeGreaterThanOrEqual(0);
    const tasks = await fx.clients.reception.req('GET', '/api/staff/profile-tasks');
    expect(tasks.json.poz).toMatchObject({ ipomOverdue: 1, activePlans: 1 });
    const audits = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype LIKE 'ipom%' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(audits.n).toBeGreaterThanOrEqual(2);
  });

  it('bilans „Moje Zdrowie”: lista pacjentów z deklaracją, zapis wykonania zmienia uprawnienie', async () => {
    const list = await fx.clients.reception.req('GET', '/api/staff/poz/bzod');
    expect(list.json.rule).toMatch(/rocznikowo/);
    expect(list.json.items[0]).toMatchObject({ patientId: pid(), eligibleNow: true, intervalYears: 5 });
    const r = await fx.clients.reception.req('POST', `/api/staff/patients/${pid()}/bzod`, { doneOn: today() });
    expect(r.json).toMatchObject({ eligibleNow: false, reason: 'po-bilansie' });
    expect((await pt.req('GET', '/api/me/poz')).json.bzod.ikpUrl).toBe('https://pacjent.gov.pl');
  });

  let productId = '';
  let lotId = '';
  let expiredLotId = '';
  let consentId = '';
  let procId = '';

  it('estetyka: produkty i partie (partia przeterminowana oznaczona), zgody wymagają zatwierdzenia wzoru', async () => {
    expect((await fx.clients.admin.req('POST', '/api/admin/clinic-profiles/estetyka/apply')).status).toBe(200);
    expect((await fx.clients.doctor.req('GET', '/api/staff/clinic-profile')).json.features).toEqual(['poz', 'aesthetic']);
    const prod = await fx.clients.doctor.req('POST', '/api/staff/aesthetic/products', { name: 'Toksyna A (fikcyjna)', kind: 'toksyna', category: 'lek', manufacturer: 'Producent X', unit: 'j.' });
    expect(prod.json.requiresPhysician).toBe(true);
    productId = prod.json.id;
    const l = await fx.clients.reception.req('POST', `/api/staff/aesthetic/products/${productId}/lots`, { lot: 'TX-2026-01', expiry: addDays(today(), 200) });
    lotId = l.json.lots[0].id;
    const e = await fx.clients.reception.req('POST', `/api/staff/aesthetic/products/${productId}/lots`, { lot: 'TX-2024-09', expiry: addDays(today(), -10) });
    expiredLotId = e.json.lots.find((x: { lot: string }) => x.lot === 'TX-2024-09').id;
    expect(e.json.lots.find((x: { id: string }) => x.id === expiredLotId).expired).toBe(true);
    expect((await fx.clients.reception.req('POST', `/api/staff/aesthetic/products/${productId}/lots`, { lot: 'tx-2026-01', expiry: addDays(today(), 10) })).status).toBe(409);
    expect((await fx.clients.reception.req('POST', `/api/staff/patients/${pid()}/procedure-consents`, { templateId: 'toksyna' })).json.error).toBe('template_not_approved');
    expect((await fx.clients.doctor.req('POST', '/api/staff/aesthetic/consent-templates/toksyna/approve', { approvedBy: 'lek. Jan Testowy, PWZ 1234567' })).status).toBe(200);
    const c = await fx.clients.reception.req('POST', `/api/staff/patients/${pid()}/procedure-consents`, { templateId: 'toksyna' });
    expect(c.json.status).toBe('do-podpisu');
    consentId = c.json.id;
    const print = await fx.clients.reception.req('GET', `/api/staff/aesthetic/consents/${consentId}/print`);
    expect(print.body).toContain('Maria Linkowa');
    expect(print.body).toContain('podpis pacjenta');
    expect(print.body).not.toContain('<script');
  });

  it('karta zabiegu: zawód wymagany, kosmetolog nie podpisze, zgoda pisemna, partia ważna, cel leczniczy ze wskazaniem, VAT z celu', async () => {
    const svc = (await fx.clients.doctor.req('GET', '/api/staff/aesthetic/meta')).json.services.find((s: { name: string }) => s.name.startsWith('Toksyna botulinowa — mimiczne'));
    expect(svc).toMatchObject({ requiresPhysician: true, consentTemplate: 'toksyna', controlAfterDays: 14, vat: '23' });
    const p = await fx.clients.doctor.req('POST', '/api/staff/aesthetic/procedures', {
      patientId: pid(),
      serviceId: svc.id,
      title: 'Toksyna — czoło i lwia zmarszczka',
      purpose: 'estetyczny',
      items: [{ productId, lotId, quantity: 20, area: 'czoło' }],
      points: [{ x: 0.5, y: 0.22, view: 'przod', quantity: 4, item: 0 }],
      consentId,
    });
    expect(p.status, JSON.stringify(p.json)).toBe(200);
    procId = p.json.id;
    expect(p.json.controlOn).toBe(addDays(today(), 14));
    expect(p.json.aftercare).toMatch(/4 godziny/);
    expect(p.json.billing.vat).toBe('23');
    expect((await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${procId}/sign`)).json.error).toBe('profession_missing');
    const prBody = { given: 'Jan', family: 'Testowy', prefix: 'lek.', serviceIds: [], locationIds: [], active: true };
    await fx.clients.admin.req('PUT', `/api/admin/practitioners/${fx.ctx.doctor.id}`, { ...prBody, profession: 'kosmetolog' });
    expect((await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${procId}/sign`)).json.error).toBe('physician_required');
    await fx.clients.admin.req('PUT', `/api/admin/practitioners/${fx.ctx.doctor.id}`, { ...prBody, profession: 'lekarz' });
    expect((await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${procId}/sign`)).json.error).toBe('consent_required');
    expect((await fx.clients.reception.req('POST', `/api/staff/aesthetic/consents/${consentId}/signed`, { signedOn: today(), method: 'papier' })).json.status).toBe('podpisana');
    // przeterminowana partia blokuje podpis innej karty
    const bad = await fx.clients.doctor.req('POST', '/api/staff/aesthetic/procedures', { patientId: pid(), serviceId: svc.id, title: 'x', purpose: 'estetyczny', items: [{ productId, lotId: expiredLotId, quantity: 10, area: 'czoło' }], points: [], consentId });
    expect((await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${bad.json.id}/sign`)).json.error).toBe('lot_expired');
    const med = await fx.clients.doctor.req('POST', '/api/staff/aesthetic/procedures', { patientId: pid(), title: 'Nadpotliwość pach', purpose: 'leczniczy', items: [{ productId, lotId, quantity: 50, area: 'pachy' }], points: [], consentId });
    expect((await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${med.json.id}/sign`)).json.error).toBe('indication_required');
    const withInd = await fx.clients.doctor.req('PUT', `/api/staff/aesthetic/procedures/${med.json.id}`, { indication: 'Nadpotliwość pierwotna pach (rozpoznanie lekarza)' });
    expect(withInd.json.billing.vat).toBe('zw');
    const signed = await fx.clients.doctor.req('POST', `/api/staff/aesthetic/procedures/${procId}/sign`);
    expect(signed.json.status).toBe('podpisana');
    expect((await fx.clients.doctor.req('PUT', `/api/staff/aesthetic/procedures/${procId}`, { notes: 'zmiana' })).status).toBe(409);
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM notification WHERE kind = 'aesthetic' AND user_id = ?").get(findUserByFhirRef(fx.patient.ref)!.id) as { n: number };
    expect(n.n).toBe(1);
  });

  it('zdjęcia tylko za zgodą na dokumentację; partia → pacjenci; powikłanie z danymi do zgłoszenia; widok pacjenta i zgoda na wizerunek', async () => {
    const up = () => multipart({ phase: 'przed', angle: 'en-face' }, { name: 'file', filename: 'przed.png', contentType: 'image/png', data: PNG });
    let u = up();
    expect((await fx.clients.doctor.upload(`/api/staff/aesthetic/procedures/${procId}/photos`, u.payload, u.contentType)).json.error).toBe('image_consent_required');
    await fx.clients.reception.req('PUT', `/api/staff/patients/${pid()}/image-consent`, { documentation: true });
    u = up();
    const ph = await fx.clients.doctor.upload(`/api/staff/aesthetic/procedures/${procId}/photos`, u.payload, u.contentType);
    expect(ph.status).toBe(200);
    expect(ph.json.photos[0]).toMatchObject({ phase: 'przed', angle: 'en-face' });
    const recall = await fx.clients.doctor.req('GET', `/api/staff/aesthetic/lots/${lotId}/recall`);
    expect(recall.json.patients).toEqual([expect.objectContaining({ patientId: pid(), phone: '+48600100200' })]);
    expect((await fx.clients.reception.req('GET', `/api/staff/aesthetic/lots/${lotId}/recall`)).status).toBe(403);
    const c = await fx.clients.doctor.req('POST', '/api/staff/aesthetic/complications', { procedureId: procId, noticedOn: today(), description: 'Opadnięcie lewej powieki', seriousness: 'umiarkowane', reportTo: 'urpl' });
    expect(c.json.lots).toEqual([{ product: 'Toksyna A (fikcyjna)', lot: 'TX-2026-01' }]);
    const rep = await fx.clients.doctor.req('GET', `/api/staff/aesthetic/complications/${c.json.id}/report`);
    expect(rep.json.patient).toMatchObject({ initials: 'ML', birthYear: '1990' });
    expect(rep.json.products[0]).toMatchObject({ lot: 'TX-2026-01', quantity: '20 j.' });
    expect(JSON.stringify(rep.json)).not.toContain('Linkowa');
    const mine = await pt.req('GET', '/api/me/aesthetic');
    expect(mine.json.procedures).toHaveLength(1);
    expect(mine.json.procedures[0]).toMatchObject({ title: 'Toksyna — czoło i lwia zmarszczka' });
    expect(mine.json.procedures[0].notes).toBeUndefined();
    expect(mine.json.procedures[0].items[0]).toMatchObject({ lot: 'TX-2026-01', productName: 'Toksyna A (fikcyjna)' });
    expect(mine.json.image[0]).toMatchObject({ documentation: true, marketing: false });
    const mk = await pt.req('PUT', '/api/me/aesthetic/image-consent', { orgId: fx.orgId, marketing: true });
    expect(mk.json.marketing).toBe(true);
    expect((await pt.req('PUT', '/api/me/aesthetic/image-consent', { orgId: fx.otherOrgId, marketing: true })).status).toBe(403);
    const tasks = await fx.clients.doctor.req('GET', '/api/staff/profile-tasks');
    expect(tasks.json.aesthetic).toMatchObject({ openComplications: 1, lotsExpired: 1 });
    expect(await runAestheticReminderSweep()).toBe(0);
  });
});
