import type { DaneFirmy } from "@/lib/straty/reguly";

// Przykładowe dane instalatora pomp ciepła — do podglądu, zanim podłączymy bazę.
export const DEMO_TERAZ = new Date("2026-10-28T12:00:00Z");

export const DEMO: DaneFirmy = {
  zapytania: [
    { id: "Z-101", wplynelo: new Date("2026-10-26T09:00:00Z"), kanal: "formularz" },
    { id: "Z-102", wplynelo: new Date("2026-10-28T08:00:00Z"), kanal: "telefon" },
  ],
  oferty: [
    { id: "OF-31", klientId: "Nowak", wartoscNetto: 4_800_000, wyslana: new Date("2026-10-05T00:00:00Z"), status: "wyslana", pracownikId: "Marek" },
    { id: "OF-32", klientId: "Wiśniewski", wartoscNetto: 3_900_000, wyslana: new Date("2026-10-12T00:00:00Z"), status: "przegrana", przyczynaPrzegranej: "termin", pracownikId: "Ola" },
    { id: "OF-33", klientId: "Zielińska", wartoscNetto: 5_200_000, wyslana: new Date("2026-10-20T00:00:00Z"), status: "wyslana", pracownikId: "Ola" },
    { id: "OF-30", klientId: "Kamińscy", wartoscNetto: 4_100_000, wyslana: new Date("2026-09-15T00:00:00Z"), status: "wygrana", pracownikId: "Marek" },
  ],
  faktury: [
    { id: "FV/14/10/2026", klientId: "Dom-Bud Sp. z o.o.", klientTyp: "B2B", kwotaBrutto: 1_230_000, terminPlatnosci: new Date("2026-10-10T00:00:00Z") },
  ],
  realizacje: [
    { id: "R-2025-07", klientId: "Lewandowscy", zakonczona: new Date("2025-09-20T00:00:00Z"), wymagaPrzegladu: true },
  ],
};
