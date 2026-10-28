// Kwoty zawsze w groszach (liczby całkowite), żeby uniknąć błędów zaokrągleń.
export type Grosze = number;

export type TypKlienta = "B2B" | "B2C";

export interface Zapytanie {
  id: string;
  wplynelo: Date;
  pierwszyKontakt?: Date;
  pracownikId?: string;
  kanal?: string; // np. "telefon", "formularz", "portal"
}

export type StatusOferty = "wyslana" | "wygrana" | "przegrana";

export type PrzyczynaPrzegranej =
  | "cena"
  | "termin"
  | "brak_kontaktu"
  | "konkurencja"
  | "rezygnacja";

export interface Oferta {
  id: string;
  klientId: string;
  wartoscNetto: Grosze;
  wyslana: Date;
  ostatniKontakt?: Date;
  status: StatusOferty;
  przyczynaPrzegranej?: PrzyczynaPrzegranej;
  pracownikId?: string;
}

export interface Faktura {
  id: string;
  klientId: string;
  klientTyp: TypKlienta;
  kwotaBrutto: Grosze;
  terminPlatnosci: Date;
  zaplacona?: Date;
}

export interface Realizacja {
  id: string;
  klientId: string;
  zakonczona: Date;
  ostatniPrzeglad?: Date;
  wymagaPrzegladu: boolean; // pompy ciepła, PV — tak; remont — zwykle nie
}

export type TypStraty =
  | "zapytanie_bez_odpowiedzi"
  | "oferta_bez_followupu"
  | "oferta_przegrana"
  | "faktura_przeterminowana"
  | "przeglad_zalegly";

export interface Strata {
  typ: TypStraty;
  zrodloId: string;
  wartosc: Grosze;
  pracownikId?: string;
  przyczyna?: PrzyczynaPrzegranej;
  opis: string;
}

export interface Progi {
  zapytanieBezOdpowiedziGodz: number;
  ofertaBezFollowUpDni: number;
  przegladCoMiesiecy: number;
  // Używane, gdy firma ma za mało rozstrzygniętych ofert do wyliczenia własnego wskaźnika.
  domyslnyWskaznikWygranej: number;
  minOfertDoWskaznika: number;
  domyslnaCenaPrzegladu: Grosze;
}

export const DOMYSLNE_PROGI: Progi = {
  zapytanieBezOdpowiedziGodz: 24,
  ofertaBezFollowUpDni: 7,
  przegladCoMiesiecy: 12,
  domyslnyWskaznikWygranej: 0.25,
  minOfertDoWskaznika: 10,
  domyslnaCenaPrzegladu: 40_000, // 400 zł
};
