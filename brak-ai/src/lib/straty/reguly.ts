import {
  DOMYSLNE_PROGI,
  type Faktura,
  type Grosze,
  type Oferta,
  type Progi,
  type Realizacja,
  type Strata,
  type Zapytanie,
} from "./typy";

const GODZINA = 60 * 60 * 1000;
const DZIEN = 24 * GODZINA;

function dodajMiesiace(data: Date, miesiace: number): Date {
  const d = new Date(data.getTime());
  d.setUTCMonth(d.getUTCMonth() + miesiace);
  return d;
}

function zl(grosze: Grosze): string {
  return (grosze / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

/** Udział wygranych wśród rozstrzygniętych ofert; przy małej próbie — wartość domyślna. */
export function wskaznikWygranej(oferty: Oferta[], progi: Progi = DOMYSLNE_PROGI): number {
  const wygrane = oferty.filter((o) => o.status === "wygrana").length;
  const przegrane = oferty.filter((o) => o.status === "przegrana").length;
  const rozstrzygniete = wygrane + przegrane;
  if (rozstrzygniete < progi.minOfertDoWskaznika) return progi.domyslnyWskaznikWygranej;
  return wygrane / rozstrzygniete;
}

export function sredniaWartoscOferty(oferty: Oferta[]): Grosze {
  if (oferty.length === 0) return 0;
  const suma = oferty.reduce((s, o) => s + o.wartoscNetto, 0);
  return Math.round(suma / oferty.length);
}

export function stratyZapytan(
  zapytania: Zapytanie[],
  oferty: Oferta[],
  teraz: Date,
  progi: Progi = DOMYSLNE_PROGI,
): Strata[] {
  const wartosc = Math.round(sredniaWartoscOferty(oferty) * wskaznikWygranej(oferty, progi));
  const limit = progi.zapytanieBezOdpowiedziGodz * GODZINA;
  return zapytania
    .filter((z) => !z.pierwszyKontakt && teraz.getTime() - z.wplynelo.getTime() > limit)
    .map((z) => ({
      typ: "zapytanie_bez_odpowiedzi" as const,
      zrodloId: z.id,
      wartosc,
      pracownikId: z.pracownikId,
      opis: `Brak odpowiedzi od ${Math.floor((teraz.getTime() - z.wplynelo.getTime()) / GODZINA)} h`,
    }));
}

export function stratyOfert(oferty: Oferta[], teraz: Date, progi: Progi = DOMYSLNE_PROGI): Strata[] {
  const wskaznik = wskaznikWygranej(oferty, progi);
  const limit = progi.ofertaBezFollowUpDni * DZIEN;
  const wynik: Strata[] = [];
  for (const o of oferty) {
    if (o.status === "przegrana") {
      wynik.push({
        typ: "oferta_przegrana",
        zrodloId: o.id,
        wartosc: o.wartoscNetto,
        pracownikId: o.pracownikId,
        przyczyna: o.przyczynaPrzegranej,
        opis: `Przegrana oferta na ${zl(o.wartoscNetto)}`,
      });
    } else if (o.status === "wyslana") {
      const odKontaktu = teraz.getTime() - (o.ostatniKontakt ?? o.wyslana).getTime();
      if (odKontaktu > limit) {
        wynik.push({
          typ: "oferta_bez_followupu",
          zrodloId: o.id,
          wartosc: Math.round(o.wartoscNetto * wskaznik),
          pracownikId: o.pracownikId,
          opis: `Brak kontaktu od ${Math.floor(odKontaktu / DZIEN)} dni`,
        });
      }
    }
  }
  return wynik;
}

export function stratyFaktur(faktury: Faktura[], teraz: Date): Strata[] {
  return faktury
    .filter((f) => !f.zaplacona && f.terminPlatnosci.getTime() < teraz.getTime())
    .map((f) => ({
      typ: "faktura_przeterminowana" as const,
      zrodloId: f.id,
      wartosc: f.kwotaBrutto,
      opis: `Po terminie ${Math.floor((teraz.getTime() - f.terminPlatnosci.getTime()) / DZIEN)} dni`,
    }));
}

export function stratyPrzegladow(
  realizacje: Realizacja[],
  teraz: Date,
  progi: Progi = DOMYSLNE_PROGI,
): Strata[] {
  return realizacje
    .filter(
      (r) =>
        r.wymagaPrzegladu &&
        dodajMiesiace(r.ostatniPrzeglad ?? r.zakonczona, progi.przegladCoMiesiecy).getTime() < teraz.getTime(),
    )
    .map((r) => ({
      typ: "przeglad_zalegly" as const,
      zrodloId: r.id,
      wartosc: progi.domyslnaCenaPrzegladu,
      opis: "Minął termin corocznego przeglądu",
    }));
}

/**
 * Rekompensata za koszty odzyskiwania należności w transakcjach handlowych (tylko B2B),
 * w euro — przeliczenie na zł wg średniego kursu NBP z ostatniego dnia roboczego
 * miesiąca poprzedzającego miesiąc, w którym świadczenie stało się wymagalne.
 */
export function rekompensataEUR(f: Faktura): 0 | 40 | 70 | 100 {
  if (f.klientTyp !== "B2B") return 0;
  if (f.kwotaBrutto <= 500_000) return 40;
  if (f.kwotaBrutto < 5_000_000) return 70;
  return 100;
}

export interface DaneFirmy {
  zapytania: Zapytanie[];
  oferty: Oferta[];
  faktury: Faktura[];
  realizacje: Realizacja[];
}

export function wykryjStraty(dane: DaneFirmy, teraz: Date, progi: Progi = DOMYSLNE_PROGI): Strata[] {
  return [
    ...stratyZapytan(dane.zapytania, dane.oferty, teraz, progi),
    ...stratyOfert(dane.oferty, teraz, progi),
    ...stratyFaktur(dane.faktury, teraz),
    ...stratyPrzegladow(dane.realizacje, teraz, progi),
  ];
}
