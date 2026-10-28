import { DEMO, DEMO_TERAZ } from "@/lib/demo";
import { wykryjStraty } from "@/lib/straty/reguly";
import type { TypStraty } from "@/lib/straty/typy";

const NAZWY: Record<TypStraty, string> = {
  zapytanie_bez_odpowiedzi: "Zapytania bez odpowiedzi",
  oferta_bez_followupu: "Oferty bez follow-upu",
  oferta_przegrana: "Oferty przegrane",
  faktura_przeterminowana: "Faktury po terminie",
  przeglad_zalegly: "Zaległe przeglądy",
};

const zl = (gr: number) =>
  (gr / 100).toLocaleString("pl-PL", { maximumFractionDigits: 0 }) + " zł";

export default function Strona() {
  const straty = wykryjStraty(DEMO, DEMO_TERAZ).sort((a, b) => b.wartosc - a.wartosc);
  const suma = straty.reduce((s, x) => s + x.wartosc, 0);
  const wgTypu = new Map<TypStraty, number>();
  for (const s of straty) wgTypu.set(s.typ, (wgTypu.get(s.typ) ?? 0) + s.wartosc);

  return (
    <main>
      <h1>BRAK AI — podgląd na danych przykładowych</h1>
      <p className="podtytul">Instalator pomp ciepła, stan na {DEMO_TERAZ.toLocaleDateString("pl-PL")}</p>

      <div className="kafle">
        <div className="kafel suma"><span>Zagrożony przychód</span><strong>{zl(suma)}</strong></div>
        {[...wgTypu].map(([typ, wartosc]) => (
          <div className="kafel" key={typ}><span>{NAZWY[typ]}</span><strong>{zl(wartosc)}</strong></div>
        ))}
      </div>

      <div className="tabela">
        <table>
          <thead>
            <tr><th>Rodzaj</th><th>Źródło</th><th>Pracownik</th><th>Opis</th><th className="kwota">Wartość</th></tr>
          </thead>
          <tbody>
            {straty.map((s) => (
              <tr key={s.typ + s.zrodloId}>
                <td>{NAZWY[s.typ]}</td>
                <td>{s.zrodloId}</td>
                <td>{s.pracownikId ?? "—"}</td>
                <td>{s.opis}{s.przyczyna ? ` (przyczyna: ${s.przyczyna})` : ""}</td>
                <td className="kwota">{zl(s.wartosc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
