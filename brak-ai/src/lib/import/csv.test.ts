import { describe, expect, it } from "vitest";
import { importFaktur, naglowkiCsv, parseData, parseKwota } from "./csv";

describe("parseKwota", () => {
  it.each([
    ["1 234,56 zł", 123_456],
    ["1.234,56", 123_456],
    ["1234.56", 123_456],
    ["12 300", 1_230_000],
    [" 7 999,9", 799_990],
  ])("%s → %d gr", (tekst, oczekiwane) => {
    expect(parseKwota(tekst)).toBe(oczekiwane);
  });

  it("odrzuca tekst, który nie jest kwotą", () => {
    expect(parseKwota("brak")).toBeNull();
    expect(parseKwota("")).toBeNull();
  });
});

describe("parseData", () => {
  it("czyta format polski i ISO", () => {
    expect(parseData("28.10.2026")?.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(parseData("2026-10-28")?.toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });

  it("odrzuca nieistniejące daty", () => {
    expect(parseData("31.02.2026")).toBeNull();
  });
});

// Typowy eksport z programu księgowego: średnik jako separator, polskie kwoty.
const CSV = `Numer;Kontrahent;NIP;Brutto;Termin płatności;Data zapłaty
FV/1/10/2026;Dom-Bud Sp. z o.o.;5260000000;12 300,00;15.10.2026;
FV/2/10/2026;Jan Kowalski;;8 500,00;20.10.2026;18.10.2026
FV/3/10/2026;Jan Nowak;;abc;20.10.2026;
`;

const MAPA = {
  numer: "Numer",
  klient: "Kontrahent",
  nip: "NIP",
  kwotaBrutto: "Brutto",
  terminPlatnosci: "Termin płatności",
  dataZaplaty: "Data zapłaty",
};

describe("importFaktur", () => {
  it("odczytuje nagłówki do mapowania kolumn", () => {
    expect(naglowkiCsv(CSV)).toEqual(["Numer", "Kontrahent", "NIP", "Brutto", "Termin płatności", "Data zapłaty"]);
  });

  it("importuje poprawne wiersze i raportuje błędne", () => {
    const { rekordy, bledy } = importFaktur(CSV, MAPA);
    expect(rekordy).toHaveLength(2);
    expect(rekordy[0]).toMatchObject({ id: "FV/1/10/2026", klientTyp: "B2B", kwotaBrutto: 1_230_000, zaplacona: undefined });
    expect(rekordy[1]).toMatchObject({ klientTyp: "B2C" });
    expect(rekordy[1].zaplacona?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(bledy).toEqual([{ wiersz: 4, komunikat: 'Nieczytelna kwota: "abc"' }]);
  });

  it("zatrzymuje import, gdy brakuje zmapowanej kolumny", () => {
    const { rekordy, bledy } = importFaktur(CSV, { ...MAPA, kwotaBrutto: "Kwota" });
    expect(rekordy).toEqual([]);
    expect(bledy[0].komunikat).toContain("Kwota");
  });
});
