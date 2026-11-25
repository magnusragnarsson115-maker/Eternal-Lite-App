import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { parseOffProduct } from '../../server/integrations/openfoodfacts.js';
import { cycleHistory, foodTotals, type JournalEntry } from '../../server/services/journal.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A21.2 cykl, A21.4 połóg, A21.5 menopauza, F11.1/F11.3–F11.5 żywienie, A22.2 czynności dnia — zapis bez oceny. */

const cycleEntry = (date: string, flow: string): JournalEntry => ({ id: date, kind: 'cycle', at: `${date}T12:00:00Z`, cycle: { date, flow, symptoms: [] } });

describe('Dzienniki — cykl, połóg, menopauza, żywienie, czynności dnia', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    updateUser(u.id, { password_hash: await hashPassword('Dziennik-Dnia-43') });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: 'Dziennik-Dnia-43' });
  });
  afterAll(async () => {
    await fx?.app.close();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('historia cyklu: początki miesiączek po ≥10 dniach przerwy, dzień cyklu i długości poprzednich — bez prognoz', () => {
    const entries = [
      cycleEntry('2026-08-03', 'medium'),
      cycleEntry('2026-08-04', 'heavy'),
      cycleEntry('2026-08-05', 'light'),
      cycleEntry('2026-08-20', 'spotting'),
      cycleEntry('2026-08-31', 'medium'),
      cycleEntry('2026-09-01', 'light'),
      cycleEntry('2026-09-29', 'heavy'),
      cycleEntry('2026-10-02', 'none'),
    ];
    const h = cycleHistory(entries, '2026-10-16');
    expect(h.starts).toEqual(['2026-08-03', '2026-08-31', '2026-09-29']);
    expect(h.lengths).toEqual([28, 29]);
    expect(h.currentDay).toBe(18);
    expect(Object.keys(h)).not.toContain('next');
    expect(cycleHistory([], '2026-10-16')).toEqual({ starts: [], currentDay: undefined, lengths: [] });
  });

  it('suma żywienia z wartości na 100 g; pozycje bez kalorii liczą się jako niepełne, nie jako zero', () => {
    expect(foodTotals([{ name: 'Płatki', grams: 50, kcal100: 372, protein100: 13.5, fat100: 7, carbs100: 59 }, { name: 'Jogurt', grams: 150, kcal100: 61, protein100: 4.3, fat100: 2, carbs100: 6.2 }])).toEqual({
      kcal: 278,
      protein: 13.2,
      fat: 6.5,
      carbs: 38.8,
      incomplete: 0,
    });
    expect(foodTotals([{ name: 'Zupa z domu', grams: 300 }]).incomplete).toBe(1);
  });

  it('Open Food Facts: produkt → pozycja dziennika (kcal z kJ, gdy brak kcal; bez nazwy — pomijany)', () => {
    expect(parseOffProduct({ code: '5900000000017', product_name: 'Jogurt naturalny', brands: 'Mleczarnia, Inna', nutriments: { 'energy-kcal_100g': 61, proteins_100g: 4.3, fat_100g: 2, carbohydrates_100g: 6.2 } })).toEqual({
      barcode: '5900000000017',
      name: 'Jogurt naturalny',
      brand: 'Mleczarnia',
      quantity: undefined,
      kcal100: 61,
      protein100: 4.3,
      fat100: 2,
      carbs100: 6.2,
      source: 'openfoodfacts',
    });
    expect(parseOffProduct({ code: '1234567890123', product_name_pl: 'Chleb', nutriments: { 'energy-kj_100g': 920 } })?.kcal100).toBe(220);
    expect(parseOffProduct({ code: '1234567890123' })).toBeUndefined();
  });

  it('cykl: zapis dnia, historia przez API; data z przyszłości odrzucona', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'cycle', date: '2026-09-29', flow: 'heavy', symptoms: ['cramps', 'fatigue'] });
    expect(r.status).toBe(200);
    expect(r.json.entry.cycle).toEqual({ date: '2026-09-29', flow: 'heavy', symptoms: ['cramps', 'fatigue'] });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'cycle', date: '2099-01-01', flow: 'light' })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'cycle', date: '2026-09-29', flow: 'flood' })).status).toBe(400);
    const o = await pt.req('GET', '/api/me/journal/overview?kind=cycle');
    expect(o.json.cycle.starts).toContain('2026-09-29');
  });

  it('połóg i karmienie: objawy, strona i czas karmienia; pusty wpis odrzucony; słowa kryzysowe → numery pomocy', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'postpartum', symptoms: ['fatigue', 'breast-pain'], feeding: { side: 'left', minutes: 15 } });
    expect(r.json.entry.postpartum).toEqual({ symptoms: ['fatigue', 'breast-pain'], feeding: { side: 'left', minutes: 15 } });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'postpartum' })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'postpartum', note: 'Nie chcę już żyć' })).json.crisis).toBe(true);
  });

  it('menopauza: nasilenie 0–3 dla objawów, zapisywane tylko niezerowe', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'menopause', symptoms: { 'hot-flashes': 2, 'night-sweats': 0, 'sleep-problems': 3 } });
    expect(r.json.entry.menopause).toEqual({ symptoms: { 'hot-flashes': 2, 'sleep-problems': 3 } });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'menopause', symptoms: { 'hot-flashes': 4 } })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'menopause', symptoms: { 'hot-flashes': 0 } })).status).toBe(400);
  });

  it('żywienie: posiłek z pozycjami i sumą; sumy dnia; walidacja kodu kreskowego', async () => {
    const r = await pt.req('POST', '/api/me/journal', {
      kind: 'food',
      meal: 'breakfast',
      items: [
        { name: 'Płatki owsiane', grams: 50, kcal100: 372, protein100: 13.5, fat100: 7, carbs100: 59, barcode: '5900000000024', source: 'openfoodfacts' },
        { name: 'Mleko', grams: 200 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.json.entry.food.totals).toEqual({ kcal: 186, protein: 6.8, fat: 3.5, carbs: 29.5, incomplete: 1 });
    expect((await pt.req('POST', '/api/me/journal', { kind: 'food', meal: 'breakfast', items: [{ name: 'X', grams: 10, barcode: '12' }] })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'food', meal: 'brunch', items: [{ name: 'X', grams: 10 }] })).status).toBe(400);
    const days = await pt.req('GET', '/api/me/journal/overview?kind=food&days=30');
    expect(days.json.days[0]).toMatchObject({ meals: 1, totals: { kcal: 186 } });
  });

  it('czynności dnia (Katz, Lawton): same odpowiedzi i kto wypełnia — bez sumy punktów', async () => {
    const r = await pt.req('POST', '/api/me/journal', { kind: 'adl', filledBy: 'caregiver', answers: { bathing: 'assisted', feeding: 'independent', finances: 'unable' } });
    expect(r.json.entry.adl).toEqual({ filledBy: 'caregiver', answers: { bathing: 'assisted', feeding: 'independent', finances: 'unable' } });
    expect(JSON.stringify(r.json.entry)).not.toMatch(/score|punkt/i);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'adl', filledBy: 'caregiver', answers: { bathing: 'maybe' } })).status).toBe(400);
    expect((await pt.req('POST', '/api/me/journal', { kind: 'adl', filledBy: 'caregiver', answers: {} })).status).toBe(400);
  });

  it('Open Food Facts przez API: kod kreskowy wysyłany bez danych pacjenta; błąd usługi nie psuje dziennika', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ status: 1, product: { code: '5901234123457', product_name: 'Kefir', nutriments: { 'energy-kcal_100g': 50 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    const r = await pt.req('GET', '/api/food/product/5901234123457');
    expect(r.json.product).toMatchObject({ name: 'Kefir', kcal100: 50, barcode: '5901234123457' });
    expect(calls[0]).toContain('/api/v2/product/5901234123457');
    expect(calls[0]).not.toMatch(/patient|Patient|@/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const s = await pt.req('GET', '/api/food/search?q=jogurt%20grecki');
    expect(s.status).toBe(200);
    expect(s.json.remoteError).toBeTruthy();
    expect((await pt.req('GET', '/api/food/product/12')).status).toBe(400);
  });
});
