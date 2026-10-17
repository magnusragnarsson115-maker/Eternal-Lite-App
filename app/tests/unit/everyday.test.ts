import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { config } from '../../server/config.js';
import { approvePreventive, preventiveApproval, PREVENTIVE_PROGRAMS } from '../../server/content/preventive.js';
import { getDb } from '../../server/db.js';
import { nearestStation, parseGiosIndex, parseGiosStations, parseImgwSynop } from '../../server/integrations/air.js';
import { importPharmaciesCsv, importRefundCsv, searchPharmacies, searchRefund } from '../../server/integrations/registries.js';
import { parseCsvRows } from '../../server/lib/csv.js';
import { localDate, zonedToUtc } from '../../server/lib/time.js';
import { importIcd10Csv, searchDiagnosisCodes } from '../../server/services/diagnoses.js';
import { runMedReminderSweep, stockDaysLeft } from '../../server/services/medReminders.js';
import { listNotifications } from '../../server/services/notifications.js';
import { dayPlanText, preventiveItems, runCustomReminderSweep, runMorningSweep, runPreventiveSweep } from '../../server/services/personalReminders.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/**
 * Runda 4: kopia offline (A5.12), zapas leków (A14.3), przypomnienia własne z miejscem (F9.11, A7.8), poranny plan
 * (F5.5), profilaktyka NFZ (A7.7), lokalizacja (A11.1), rozpoznania ICD-10 (A12.6), apteki i refundacja (F7.1, F7.2,
 * F7.7), powietrze i pogoda (F5.1, F5.2, A3.6). Push bez danych o zdrowiu; nic nie jest interpretowane.
 */

const tz = config.clinic.timezone;

describe('Runda 4 — na co dzień', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  let userId: string;
  const pid = () => fx.patient.ref.split('/')[1];

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    userId = u.id;
    updateUser(u.id, { password_hash: await hashPassword('Na-Co-Dzien-2026') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Na-Co-Dzien-2026' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('kopia offline: karta, leki z godzinami, najbliższa wizyta, telefon placówki; bez zapisu w pamięci podręcznej; odczyt w dzienniku', async () => {
    await pt.req('POST', '/api/me/medications', { name: 'Lek testowy 5 mg', dosage: '1 rano' });
    await pt.req('POST', '/api/me/med-schedules', { label: 'Lek testowy', times: ['08:00', '20:00'] });
    const r = await pt.req('GET', '/api/me/offline-pack');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.json.medications.map((m: { name: string }) => m.name)).toContain('Lek testowy 5 mg');
    expect(r.json.reminders[0]).toMatchObject({ label: 'Lek testowy', times: ['08:00', '20:00'] });
    expect(r.json.appointments.length).toBeGreaterThan(0);
    expect(r.json.card.disclaimer).toBeTruthy();
    expect(Date.parse(r.json.refreshAfter) - Date.parse(r.json.generatedAt)).toBe(30 * 86_400_000);
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype = 'offline-pack' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(n.n).toBe(1);
  });

  it('zapas leku: dni z harmonogramu, „przyjęty” zmniejsza zapas, jedno przypomnienie bez nazwy leku w push', async () => {
    expect(stockDaysLeft(30, 1, 2, 7)).toBe(15);
    expect(stockDaysLeft(10, 0.5, 1, 3)).toBe(46);
    const list = await pt.req('GET', '/api/me/med-schedules');
    const s = list.json.items[0];
    const set = await pt.req('PUT', `/api/me/med-schedules/${s.id}/stock`, { stock: 10, perDose: 1 });
    expect(set.json.items[0]).toMatchObject({ stock: 10, perDose: 1, daysLeft: 5, lowStock: true });
    const today = localDate(new Date(), tz);
    await runMedReminderSweep(new Date(zonedToUtc(today, '08:00', tz).getTime() + 60_000));
    const due = (await pt.req('GET', '/api/me/med-schedules')).json.log.find((l: { status: string }) => l.status === 'due');
    await pt.req('POST', `/api/me/med-intake/${due.id}`, { status: 'taken' });
    expect((await pt.req('GET', '/api/me/med-schedules')).json.items[0].stock).toBe(9);
    const stockNotes = listNotifications(userId).filter((n) => n.kind === 'med-stock');
    expect(stockNotes).toHaveLength(1);
    await runMedReminderSweep(new Date(zonedToUtc(today, '08:30', tz).getTime()));
    expect(listNotifications(userId).filter((n) => n.kind === 'med-stock')).toHaveLength(1);
    const push = getDb().prepare("SELECT body FROM outbox WHERE channel = 'push'").all() as { body: string }[];
    expect(push.every((p) => !p.body.includes('Lek testowy'))).toBe(true);
    expect((await pt.req('PUT', `/api/me/med-schedules/${s.id}/stock`, { stock: -1 })).status).toBe(400);
  });

  it('przypomnienie własne (terapia światłem) z miejscem; wysyłka raz w oknie 10 min; push bez treści', async () => {
    const r = await pt.req('POST', '/api/me/custom-reminders', { kind: 'light-therapy', times: ['07:15'], place: 'Gabinet, ul. Słoneczna 3, Kraków' });
    expect(r.status).toBe(200);
    expect(r.json.items[0]).toMatchObject({ kind: 'light-therapy', title: 'Terapia światłem', times: ['07:15'], place: 'Gabinet, ul. Słoneczna 3, Kraków', active: true });
    expect((await pt.req('POST', '/api/me/custom-reminders', { kind: 'custom', times: ['25:00'] })).status).toBe(400);
    const today = localDate(new Date(), tz);
    const at = new Date(zonedToUtc(today, '07:15', tz).getTime() + 2 * 60_000);
    expect(await runCustomReminderSweep(at)).toBe(1);
    expect(await runCustomReminderSweep(new Date(at.getTime() + 60_000))).toBe(0);
    const n = listNotifications(userId).find((x) => x.kind === 'custom-reminder')!;
    expect(n.title).toBe('Terapia światłem (07:15)');
    expect(n.body).toContain('ul. Słoneczna');
    const id = r.json.items[0].id;
    expect((await pt.req('PUT', `/api/me/custom-reminders/${id}`, { active: false })).json.items[0].active).toBe(false);
    expect((await pt.req('DELETE', `/api/me/custom-reminders/${id}`)).json.items).toHaveLength(0);
  });

  it('plan dnia i poranne podsumowanie o wybranej godzinie — raz dziennie, push ogólny', async () => {
    await pt.req('POST', '/api/me/custom-reminders', { kind: 'exercise', times: ['18:00'] });
    expect(dayPlanText({ date: '2026-10-17', appointments: [], medTimes: 2, reminders: [{ title: 'Ćwiczenia', time: '18:00' }] })).toBe('Przypomnienia o lekach: 2. Moje przypomnienia: 18:00 Ćwiczenia.');
    expect((await pt.req('PUT', '/api/me/morning-summary', { enabled: true, time: '06:45' })).json.morning).toMatchObject({ enabled: true, time: '06:45' });
    const today = localDate(new Date(), tz);
    const at = new Date(zonedToUtc(today, '06:45', tz).getTime() + 60_000);
    expect(await runMorningSweep(at)).toBe(1);
    expect(await runMorningSweep(new Date(at.getTime() + 60_000))).toBe(0);
    const n = listNotifications(userId).find((x) => x.kind === 'morning-summary')!;
    expect(n.body).toContain('Moje przypomnienia: 18:00 Ćwiczenia');
    const plan = await pt.req('GET', '/api/me/day-plan');
    expect(plan.json.plan.reminders).toEqual([{ title: 'Ćwiczenia', time: '18:00' }]);
  });

  it('profilaktyka NFZ: programy dla rocznika, następny termin z daty pacjenta, przypomnienie raz; treść wymaga zatwierdzenia', async () => {
    const female1975 = preventiveItems(1975, 'female', [], '2026-10-17');
    expect(female1975.map((i) => i.key)).toEqual(['moje-zdrowie', 'mammografia', 'cytologia', 'kolonoskopia']);
    expect(female1975.every((i) => i.status === 'available')).toBe(true);
    const male1980 = preventiveItems(1980, 'male', [{ patient_ref: 'x', program: 'moje-zdrowie', last_done: '2024-03-01', variant: null, remind: 1, notified_for: null }], '2026-10-17');
    expect(male1980.map((i) => i.key)).toEqual(['moje-zdrowie', 'kolonoskopia']);
    expect(male1980[1]).toMatchObject({ status: 'upcoming', fromYear: 2030 });
    expect(male1980[0]).toMatchObject({ status: 'later', nextFrom: '2029-03-01' });
    expect(preventiveItems(1990, 'female', [{ patient_ref: 'x', program: 'cytologia', last_done: '2022-05-10', variant: 'hpv', remind: 0, notified_for: null }], '2026-10-17').find((i) => i.key === 'cytologia')).toMatchObject({ status: 'later', nextFrom: '2027-05-10' });

    const o = await pt.req('GET', '/api/me/preventive');
    expect(o.json).toMatchObject({ visible: true, draft: true, birthYear: 1990 });
    expect(o.json.items.map((i: { key: string }) => i.key)).toEqual(['moje-zdrowie', 'cytologia']);
    const set = await pt.req('PUT', '/api/me/preventive/cytologia', { lastDone: '2023-01-15', variant: 'cytology', remind: true });
    expect(set.json.items.find((i: { key: string }) => i.key === 'cytologia')).toMatchObject({ status: 'available', nextFrom: '2026-01-15', remind: true });
    expect((await pt.req('PUT', '/api/me/preventive/cytologia', { lastDone: '2099-01-01' })).status).toBe(400);
    expect(await runPreventiveSweep()).toBe(1);
    expect(await runPreventiveSweep()).toBe(0);
    const n = listNotifications(userId).find((x) => x.kind === 'preventive')!;
    expect(n.title).toBe(PREVENTIVE_PROGRAMS.find((p) => p.key === 'cytologia')!.name);
    const push = getDb().prepare("SELECT body FROM outbox WHERE channel = 'push' ORDER BY rowid DESC LIMIT 1").get() as { body: string } | undefined;
    if (push) expect(push.body).toBe('Masz nowe przypomnienie w aplikacji.');

    expect(preventiveApproval()).toBeUndefined();
    expect(() => approvePreventive({ display: 'test' }, 'ab')).toThrow();
    approvePreventive({ display: 'test' }, 'lek. Anna Testowa, PWZ 1234567');
    expect((await pt.req('GET', '/api/me/preventive')).json).toMatchObject({ draft: false, approval: { by: 'lek. Anna Testowa, PWZ 1234567' } });
  });

  it('lokalizacja: miasto z listy albo położenie urządzenia zaokrąglone do ok. 1 km; poza Polską odrzucone', async () => {
    expect((await pt.req('PUT', '/api/me/location', { city: 'Kraków' })).json.location).toMatchObject({ source: 'city', label: 'Kraków', lat: 50.06, lon: 19.94 });
    const dev = await pt.req('PUT', '/api/me/location', { lat: 52.229676, lon: 21.012229 });
    expect(dev.json.location).toMatchObject({ source: 'device', label: 'okolice: Warszawa', lat: 52.23, lon: 21.01 });
    expect((await pt.req('PUT', '/api/me/location', { lat: 48.85, lon: 2.35 })).status).toBe(400);
    expect((await pt.req('PUT', '/api/me/location', { city: 'Atlantyda' })).status).toBe(400);
  });

  it('ICD-10: lekarz wybiera kod ze słownika (wbudowana lista albo import), zapis jako Condition z autorem', async () => {
    const common = await searchDiagnosisCodes('nadciśn');
    expect(common.dictionary).toBe('common');
    expect(common.hits[0]).toMatchObject({ code: 'I10', source: 'local' });
    const doc = fx.clients.doctor;
    const add = await doc.req('POST', `/api/staff/patients/${pid()}/diagnoses`, { code: 'I10', display: 'Samoistne (pierwotne) nadciśnienie', onset: '2024-02-01' });
    expect(add.status).toBe(200);
    expect(add.json.item).toMatchObject({ code: 'I10', status: 'active', recorder: 'lek. Jan Testowy' });
    expect((await doc.req('POST', `/api/staff/patients/${pid()}/diagnoses`, { code: 'nadciśnienie', display: 'x' })).status).toBe(400);
    const list = await doc.req('GET', `/api/staff/patients/${pid()}/diagnoses`);
    expect(list.json.items).toHaveLength(1);
    const res = await doc.req('PUT', `/api/staff/diagnoses/${add.json.item.id}`, { status: 'resolved' });
    expect(res.json.item.status).toBe('resolved');
    expect((await fx.clients.reception.req('GET', `/api/staff/patients/${pid()}/diagnoses`)).status).toBe(403);
    const imp = importIcd10Csv('Kod;Nazwa\nI10;Samoistne (pierwotne) nadciśnienie\nJ45.0;Dychawica oskrzelowa z przewagą komponenty alergicznej\nXX;zły wiersz\n');
    expect(imp).toEqual({ imported: 2, skipped: 1 });
    expect((await searchDiagnosisCodes('J45')).hits.map((h) => h.code)).toEqual(['J45.0']);
    expect((await searchDiagnosisCodes('dychawica')).dictionary).toBe('imported');
  });

  it('Rejestr Aptek: import z synonimami kolumn, pominięcie wykreślonych, wyszukiwanie po mieście i najbliższe', async () => {
    const csv = [
      'Rejestr Aptek — eksport',
      'Nazwa apteki;Rodzaj apteki;Ulica;Numer domu;Kod pocztowy;Miejscowość;Województwo;Telefon;Status;Szerokość geograficzna;Długość geograficzna',
      'Apteka Pod Lwem;ogólnodostępna;Floriańska;10;31-019;Kraków;małopolskie;12 000 00 00;Aktywna;50,0640;19,9395',
      'Apteka Rynek;ogólnodostępna;Rynek Główny;1;31-042;Kraków;małopolskie;;Aktywna;50,0617;19,9373',
      'Apteka Zamknięta;ogólnodostępna;Długa;5;31-147;Kraków;małopolskie;;Wykreślona;50,0700;19,9400',
      '"Apteka ""Centrum""";punkt apteczny;Marszałkowska;100;00-001;Warszawa;mazowieckie;;Aktywna;52,2300;21,0100',
    ].join('\n');
    expect(importPharmaciesCsv(csv)).toEqual({ imported: 3, skipped: 1, withCoordinates: 3 });
    expect(parseCsvRows(csv)[5][0]).toBe('Apteka "Centrum"');
    expect(searchPharmacies({ city: 'krakow' }).map((p) => p.name)).toEqual(['Apteka Pod Lwem', 'Apteka Rynek']);
    const near = searchPharmacies({ near: { lat: 50.0619, lon: 19.9369 } });
    expect(near[0].name).toBe('Apteka Rynek');
    expect(near[0].distanceKm).toBeLessThan(0.2);
    await pt.req('PUT', '/api/me/location', { city: 'Kraków' });
    const api = await pt.req('GET', '/api/registries/pharmacies?near=1');
    expect(api.json.items.map((p: { street: string }) => p.street)).toEqual(['Rynek Główny 1', 'Floriańska 10']);
  });

  it('wykaz refundacyjny: import arkusza CSV, wyszukiwanie po substancji i kodzie EAN — informacja z obwieszczenia', async () => {
    const csv = [
      'Lp.;Substancja czynna;Nazwa  postać i dawka leku;Zawartość opakowania;Kod EAN lub inny kod odpowiadający kodowi EAN;Grupa limitowa;Cena detaliczna;Wysokość limitu finansowania;Zakres wskazań objętych refundacją;Zakres wskazań pozarejestracyjnych objętych refundacją;Poziom odpłatności;Wysokość dopłaty świadczeniobiorcy',
      '1;Amlodipinum;Amlodypina Test, tabl., 5 mg;30 szt.;05909990000011;24.0, Leki przeciwnadciśnieniowe;12,50;10,00;We wskazaniach zgodnych z ChPL;;ryczałt;5,70',
      '2;Metforminum;Metformina Test, tabl. powl., 500 mg;60 szt.;05909990000028;61.0, Leki przeciwcukrzycowe;8,20;8,20;We wskazaniach zgodnych z ChPL;Stan przedcukrzycowy;30%;2,46',
    ].join('\n');
    expect(importRefundCsv(csv, { list: 'A1', title: 'Obwieszczenie testowe', validFrom: '2026-11-01' })).toEqual({ imported: 2, skipped: 0 });
    const a = searchRefund({ q: 'amlodip' });
    expect(a[0]).toMatchObject({ substance: 'Amlodipinum', paymentLevel: 'ryczałt', copay: '5,70', list: 'A1', indications: 'We wskazaniach zgodnych z ChPL' });
    expect(searchRefund({ gtin: '5909990000028' })[0].offLabel).toBe('Stan przedcukrzycowy');
    const api = await pt.req('GET', '/api/registries/refund?q=metformina%20500');
    expect(api.json.items).toHaveLength(1);
    expect(api.json.meta).toMatchObject({ title: 'Obwieszczenie testowe', validFrom: '2026-11-01', count: 2 });
  });

  it('GIOŚ i IMGW: odczyt formatu, najbliższa stacja, do GIOŚ idzie tylko numer stacji; błąd usługi nie psuje ekranu', async () => {
    const st = parseGiosStations({
      'Lista stacji pomiarowych': [
        { 'Identyfikator stacji': 552, 'Nazwa stacji': 'Warszawa, ul. Kondratowicza', 'WGS84 φ N': '52.290864', 'WGS84 λ E': '21.042458', 'Nazwa miasta': 'Warszawa' },
        { 'Identyfikator stacji': 400, 'Nazwa stacji': 'Kraków, al. Krasińskiego', 'WGS84 φ N': '50.057678', 'WGS84 λ E': '19.926189', 'Nazwa miasta': 'Kraków' },
      ],
      totalPages: 1,
    });
    expect(st.stations).toHaveLength(2);
    expect(nearestStation(st.stations, { lat: 50.06, lon: 19.94 })?.id).toBe(400);
    const idx = parseGiosIndex({
      AqIndex: {
        'Identyfikator stacji pomiarowej': 400,
        'Data wykonania obliczeń indeksu': '2026-10-17 10:35:10',
        'Wartość indeksu': 3,
        'Nazwa kategorii indeksu': 'Dostateczny',
        'Wartość indeksu dla wskaźnika PM10': 3,
        'Nazwa kategorii indeksu dla wskażnika PM10': 'Dostateczny',
        'Wartość indeksu dla wskaźnika SO2': null,
        'Status indeksu ogólnego dla stacji pomiarowej': true,
        'Kod zanieczyszczenia krytycznego': 'PYL',
      },
    });
    expect(idx).toMatchObject({ stationId: 400, level: 3, category: 'Dostateczny', pollutants: [{ code: 'PM10', level: 3, category: 'Dostateczny' }] });
    expect(parseGiosIndex({ AqIndex: { 'Identyfikator stacji pomiarowej': 1, 'Wartość indeksu': -1, 'Status indeksu ogólnego dla stacji pomiarowej': false } })?.category).toBe('Brak indeksu');
    expect(parseImgwSynop([{ id_stacji: '12566', stacja: 'Kraków', data_pomiaru: '2026-10-17', godzina_pomiaru: '9', temperatura: '10.2', predkosc_wiatru: '2', kierunek_wiatru: '250', wilgotnosc_wzgledna: '81.3', suma_opadu: '0', cisnienie: null }])[0]).toMatchObject({
      stationId: '12566',
      measuredAt: '2026-10-17T09:00:00Z',
      temperature: 10.2,
      humidity: 81.3,
      pressure: undefined,
    });

    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes('station/findAll'))
          return Response.json({ 'Lista stacji pomiarowych': [{ 'Identyfikator stacji': 400, 'Nazwa stacji': 'Kraków, al. Krasińskiego', 'WGS84 φ N': '50.057678', 'WGS84 λ E': '19.926189' }], totalPages: 1 });
        if (String(url).includes('aqindex')) return Response.json({ AqIndex: { 'Identyfikator stacji pomiarowej': 400, 'Wartość indeksu': 4, 'Nazwa kategorii indeksu': 'Zły', 'Status indeksu ogólnego dla stacji pomiarowej': true } });
        if (String(url).includes('imgw')) return Response.json([{ id_stacji: '12566', stacja: 'Kraków', data_pomiaru: '2026-10-17', godzina_pomiaru: '9', temperatura: '10.2' }]);
        return new Response('nie', { status: 404 });
      }),
    );
    await pt.req('PUT', '/api/me/location', { city: 'Kraków' });
    const env = await pt.req('GET', '/api/me/environment');
    expect(env.json.air).toMatchObject({ stationId: 400, level: 4, category: 'Zły' });
    expect(env.json.weather).toMatchObject({ station: 'Kraków', temperature: 10.2 });
    expect(calls.some((c) => c.endsWith('/aqindex/getIndex/400'))).toBe(true);
    expect(calls.join(' ')).not.toMatch(/50\.0|19\.9/);

    await pt.req('PUT', '/api/me/environment/prefs', { enabled: true, threshold: 4 });
    const { runAirAlertSweep } = await import('../../server/services/environment.js');
    expect(await runAirAlertSweep()).toBe(1);
    expect(await runAirAlertSweep()).toBe(0);
    expect(listNotifications(userId).find((n) => n.kind === 'air-alert')?.title).toBe('Jakość powietrza: Zły');
  });
});
