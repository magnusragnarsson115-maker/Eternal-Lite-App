import { describe, expect, it } from "vitest";
import {
  rekompensataEUR,
  stratyFaktur,
  stratyOfert,
  stratyPrzegladow,
  stratyZapytan,
  wskaznikWygranej,
  wykryjStraty,
} from "./reguly";
import type { Faktura, Oferta } from "./typy";

const TERAZ = new Date("2026-10-28T12:00:00Z");
const d = (iso: string) => new Date(iso);

function oferta(nadpisz: Partial<Oferta>): Oferta {
  return { id: "o", klientId: "k", wartoscNetto: 4_000_000, wyslana: d("2026-10-01T00:00:00Z"), status: "wyslana", ...nadpisz };
}

describe("wskaznikWygranej", () => {
  it("przy małej próbie zwraca wartość domyślną", () => {
    expect(wskaznikWygranej([oferta({ status: "wygrana" })])).toBe(0.25);
  });

  it("przy wystarczającej próbie liczy z danych firmy, pomijając otwarte oferty", () => {
    const oferty = [
      ...Array.from({ length: 4 }, () => oferta({ status: "wygrana" })),
      ...Array.from({ length: 6 }, () => oferta({ status: "przegrana" })),
      oferta({ status: "wyslana" }),
    ];
    expect(wskaznikWygranej(oferty)).toBe(0.4);
  });
});

describe("stratyZapytan", () => {
  it("zgłasza tylko zapytania bez kontaktu starsze niż 24 h", () => {
    const zapytania = [
      { id: "stare", wplynelo: d("2026-10-27T10:00:00Z") },
      { id: "swieze", wplynelo: d("2026-10-28T08:00:00Z") },
      { id: "obsluzone", wplynelo: d("2026-10-20T08:00:00Z"), pierwszyKontakt: d("2026-10-20T09:00:00Z") },
    ];
    const wynik = stratyZapytan(zapytania, [oferta({ wartoscNetto: 2_000_000 })], TERAZ);
    expect(wynik.map((s) => s.zrodloId)).toEqual(["stare"]);
    expect(wynik[0].wartosc).toBe(500_000); // 20 000 zł × 0,25
  });
});

describe("stratyOfert", () => {
  it("rozróżnia ofertę przegraną i ofertę bez follow-upu", () => {
    const wynik = stratyOfert(
      [
        oferta({ id: "przegrana", status: "przegrana", przyczynaPrzegranej: "cena" }),
        oferta({ id: "zapomniana", wyslana: d("2026-10-10T00:00:00Z") }),
        oferta({ id: "niedawny-kontakt", ostatniKontakt: d("2026-10-25T00:00:00Z") }),
        oferta({ id: "wygrana", status: "wygrana" }),
      ],
      TERAZ,
    );
    expect(wynik).toHaveLength(2);
    expect(wynik[0]).toMatchObject({ typ: "oferta_przegrana", wartosc: 4_000_000, przyczyna: "cena" });
    expect(wynik[1]).toMatchObject({ typ: "oferta_bez_followupu", zrodloId: "zapomniana", wartosc: 1_000_000 });
  });
});

describe("stratyFaktur", () => {
  it("zgłasza nieopłacone faktury po terminie", () => {
    const faktury: Faktura[] = [
      { id: "po-terminie", klientId: "k", klientTyp: "B2B", kwotaBrutto: 123_00, terminPlatnosci: d("2026-10-01T00:00:00Z") },
      { id: "oplacona", klientId: "k", klientTyp: "B2B", kwotaBrutto: 1, terminPlatnosci: d("2026-10-01T00:00:00Z"), zaplacona: d("2026-10-05T00:00:00Z") },
      { id: "przed-terminem", klientId: "k", klientTyp: "B2C", kwotaBrutto: 1, terminPlatnosci: d("2026-11-10T00:00:00Z") },
    ];
    expect(stratyFaktur(faktury, TERAZ).map((s) => s.zrodloId)).toEqual(["po-terminie"]);
  });
});

describe("rekompensataEUR", () => {
  const f = (kwotaBrutto: number, klientTyp: "B2B" | "B2C" = "B2B"): Faktura => ({
    id: "f", klientId: "k", klientTyp, kwotaBrutto, terminPlatnosci: TERAZ,
  });

  it("stosuje progi 5 000 zł i 50 000 zł", () => {
    expect(rekompensataEUR(f(500_000))).toBe(40);
    expect(rekompensataEUR(f(500_001))).toBe(70);
    expect(rekompensataEUR(f(4_999_999))).toBe(70);
    expect(rekompensataEUR(f(5_000_000))).toBe(100);
  });

  it("nie przysługuje wobec konsumenta", () => {
    expect(rekompensataEUR(f(10_000_000, "B2C"))).toBe(0);
  });
});

describe("stratyPrzegladow", () => {
  it("zgłasza instalacje, którym minął rok od ostatniego przeglądu", () => {
    const wynik = stratyPrzegladow(
      [
        { id: "zalegly", klientId: "k", zakonczona: d("2025-09-01T00:00:00Z"), wymagaPrzegladu: true },
        { id: "po-przegladzie", klientId: "k", zakonczona: d("2024-09-01T00:00:00Z"), ostatniPrzeglad: d("2026-03-01T00:00:00Z"), wymagaPrzegladu: true },
        { id: "remont", klientId: "k", zakonczona: d("2020-01-01T00:00:00Z"), wymagaPrzegladu: false },
      ],
      TERAZ,
    );
    expect(wynik.map((s) => s.zrodloId)).toEqual(["zalegly"]);
  });
});

describe("wykryjStraty", () => {
  it("łączy wszystkie moduły", () => {
    const wynik = wykryjStraty(
      {
        zapytania: [{ id: "z", wplynelo: d("2026-10-01T00:00:00Z") }],
        oferty: [oferta({ id: "o" })],
        faktury: [],
        realizacje: [],
      },
      TERAZ,
    );
    expect(wynik.map((s) => s.typ)).toEqual(["zapytanie_bez_odpowiedzi", "oferta_bez_followupu"]);
  });
});
