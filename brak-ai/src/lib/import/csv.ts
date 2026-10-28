import Papa from "papaparse";
import type { Faktura, Grosze } from "@/lib/straty/typy";

/** "1 234,56 zł", "1.234,56", "1234.56" → grosze. Zwraca null, gdy nie da się odczytać. */
export function parseKwota(tekst: string): Grosze | null {
  let t = tekst.replace(/zł|pln/gi, "").replace(/[\s ]/g, "");
  if (t === "") return null;
  if (t.includes(",")) {
    // Format polski: kropki to separatory tysięcy, przecinek to część dziesiętna.
    t = t.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

/** "28.10.2026", "28-10-2026", "2026-10-28" → Date (UTC, północ). */
export function parseData(tekst: string): Date | null {
  const t = tekst.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return utc(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return utc(+m[3], +m[2], +m[1]);
  return null;
}

function utc(rok: number, miesiac: number, dzien: number): Date | null {
  const d = new Date(Date.UTC(rok, miesiac - 1, dzien));
  return d.getUTCMonth() === miesiac - 1 && d.getUTCDate() === dzien ? d : null;
}

/** Które kolumny pliku odpowiadają którym polom — wskazuje użytkownik przy imporcie. */
export interface MapowanieFaktur {
  numer: string;
  klient: string;
  kwotaBrutto: string;
  terminPlatnosci: string;
  dataZaplaty?: string;
  nip?: string; // niepusty NIP → klient B2B
}

export interface BladImportu {
  wiersz: number; // numer wiersza w pliku, licząc nagłówek jako 1
  komunikat: string;
}

export interface WynikImportu<T> {
  rekordy: T[];
  bledy: BladImportu[];
}

export function naglowkiCsv(csv: string): string[] {
  const wynik = Papa.parse<string[]>(csv.trim(), { preview: 1, skipEmptyLines: true });
  return (wynik.data[0] ?? []).map((n) => n.trim());
}

export function importFaktur(csv: string, mapa: MapowanieFaktur): WynikImportu<Faktura> {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rekordy: Faktura[] = [];
  const bledy: BladImportu[] = [];

  const brakujace = [mapa.numer, mapa.klient, mapa.kwotaBrutto, mapa.terminPlatnosci].filter(
    (k) => !parsed.meta.fields?.includes(k),
  );
  if (brakujace.length > 0) {
    return { rekordy, bledy: [{ wiersz: 1, komunikat: `Brak kolumn w pliku: ${brakujace.join(", ")}` }] };
  }

  parsed.data.forEach((w, i) => {
    const wiersz = i + 2;
    const kwota = parseKwota(w[mapa.kwotaBrutto] ?? "");
    const termin = parseData(w[mapa.terminPlatnosci] ?? "");
    const tekstZaplaty = mapa.dataZaplaty ? (w[mapa.dataZaplaty] ?? "").trim() : "";
    const zaplacona = tekstZaplaty ? parseData(tekstZaplaty) : undefined;

    if (kwota === null) return bledy.push({ wiersz, komunikat: `Nieczytelna kwota: "${w[mapa.kwotaBrutto]}"` });
    if (termin === null) return bledy.push({ wiersz, komunikat: `Nieczytelny termin: "${w[mapa.terminPlatnosci]}"` });
    if (zaplacona === null) return bledy.push({ wiersz, komunikat: `Nieczytelna data zapłaty: "${tekstZaplaty}"` });

    rekordy.push({
      id: (w[mapa.numer] ?? "").trim(),
      klientId: (w[mapa.klient] ?? "").trim(),
      klientTyp: mapa.nip && (w[mapa.nip] ?? "").trim() ? "B2B" : "B2C",
      kwotaBrutto: kwota,
      terminPlatnosci: termin,
      zaplacona,
    });
  });

  return { rekordy, bledy };
}
