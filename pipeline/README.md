# Pipeline konsolidacji korpusu Eternal

Pięć kroków: z paczki konwersji markdown powstaje jeden plik źródłowy,
dwa pliki po deduplikacji i dwa dokumenty `.docx`.

Pipeline jest niezależny od obu generatorów opisanych w `CLAUDE.md`
(System 1 `docgen` i System 2 `GENERATOR_UNIWERSALNY.md`). Tamte piszą
dokumenty od zera na podstawie briefu; ten **konsoliduje istniejący
korpus**, więc nie tworzy treści — wyłącznie ją scala, odsiewa powtórzenia
i składa. Dlatego nie korzysta z manifestu ani z subagentów redakcyjnych:
każda decyzja jest deterministyczna i odtwarzalna, a nie ocenna.

## Uruchomienie

```bash
mkdir -p .work/src && unzip -q <paczka>.zip -d .work/src
python3 pipeline/01_split_index.py          # podział bundli + indeks + grupy
python3 pipeline/02_merge_master.py         # plik główny + bloki + autorytet
python3 pipeline/03_dedup.py                # obie deduplikacje
PYTHONPATH=pipeline python3 pipeline/04_docx_specyfikacja.py
PYTHONPATH=pipeline python3 pipeline/05_docx_biznesplan.py   # wymaga kroku 04
```

Zależność: `python-docx`. Krok 05 czyta `.work/kotwice_spec.json` zapisany
przez krok 04 — stąd kolejność.

## Co robi każdy krok

| Krok | Wejście | Wyjście | Rola |
|---|---|---|---|
| 01 | `.work/src/*.md` | `out/zrodla/`, `out/indeks_zrodel.json` | Rozcina paczki na pojedyncze dokumenty (granica: nagłówek `## nazwa.ext`) i przypisuje każdy do jednej z 9 grup |
| 02 | `out/zrodla/` | `out/ETAP1_PLIK_SCALONY.md`, `.work/bloki.jsonl`, `.work/autorytet.json` | Scala całość w jeden plik, tnie na bloki, wylicza autorytet dokumentów |
| 03 | bloki + autorytet | `out/ETAP2_DEDUPLIKACJA_1do1.md`, `out/ETAP3_DEDUPLIKACJA_ZAAWANSOWANA.md`, `.work/kanon.jsonl` | Obie deduplikacje |
| 04 | bloki kanoniczne | `out/ETAP4_ETERNAL_Specyfikacja_Techniczna.docx`, `.work/kotwice_spec.json` | Specyfikacja + zakładki do linkowania |
| 05 | bloki + zakładki | `out/ETAP5_ETERNAL_Biznesplan.docx` | Biznesplan z indeksem, źródłami i odsyłaczami |

## Autorytet dokumentu (krok 02)

Rozstrzyga, który wariant przeżywa deduplikację zaawansowaną. Punktacja
jest wyliczana, nie uznaniowa:

* numer wersji z nazwy pliku × 2,5 — najsilniejszy sygnał (`Master_5_4` > `Master_3_1`);
* znaczniki w nazwie i nagłówku: `FINAL` +3, `SCALONA` +2,5, `KOMPLETNA` +2,
  `zastępuje` +2, `DRAFT` −2, `szkic` −1,5;
* data dokumentu — 0,35 pkt za miesiąc. Wykrywane są tylko daty z okna
  autorskiego 2024–2026; horyzonty planistyczne z treści (2030, 2036, 2050)
  są odrzucane, bo nie są datą powstania;
* kompletność — do 3 pkt za objętość.

## Dwie deduplikacje (krok 03)

**Zwykła (1:1)** — bloki identyczne po normalizacji białych znaków.

**Zaawansowana (znaczeniowa)** — indeks odwrócony na 3-gramach słów
(sygnatura: 48 shingli o najmniejszym hashu), weryfikacja pary dokładnym
Jaccardem ≥ 0,50 **albo** zawieraniem ≥ 0,75. Sam Jaccard nie złapałby
bloku krótszego w całości zawartego w dłuższym, a to w tym korpusie
częsty przypadek. Klastry łączone przez union-find.

Dwie decyzje projektowe, bez których wynik jest zły:

1. **Duplikat to ta sama treść w różnych dokumentach.** Powtórzenie
   wewnątrz jednego pliku jest jego strukturą — nagłówek tabeli przy każdej
   z 300 kart funkcji nie jest redundancją. Zwycięzcą klastra jest
   **dokument**, nie pojedynczy blok: z dokumentu wygrywającego zostają
   wszystkie wystąpienia. Bez tego Master 5.4 tracił 82 % objętości.
2. **Nic unikalnego nie ginie.** Z wariantów odrzuconych odzyskiwane są
   zdania pokryte przez wersję zachowaną w mniej niż 60 % — trafiają pod
   blok ze wskazaniem dokumentu, z którego pochodzą.

## Uwagi utrzymaniowe

* Segmentacja na bloki (krok 02) przyjmuje bloki od 3 znaków. Próg musi
  być niski: nagłówki sekcji zapisane pogrubieniem (`**5\. Dane**` — 11
  znaków) niosą strukturę całego dokumentu, a przy progu 25 znaków znikały
  razem z całymi sekcjami.
* Parser wersji używa `(?![0-9])`, nie `\b` — po `5_4` następuje `_FINAL`,
  a podkreślenie jest znakiem słowa, więc `\b` nigdy by nie zadziałało.
* Trzon biznesplanu (krok 05) czytany jest z pliku źródłowego, nie z bloków
  kanonicznych. Biznesplan ma być dokumentem samodzielnym, a deduplikacja
  przenosi część jego akapitów do dokumentu o wyższym autorytecie i
  zostawiłaby puste sekcje. Duplikacji to nie tworzy, bo Część II składa
  się wyłącznie z bloków kanonicznych.
* Odsyłacze między plikami wymagają relacji do pliku **oraz** atrybutu
  `w:anchor`; fragment `#zakładka` zostawiony w adresie relacji nie działa.
* Numery stron i spis treści to pola Worda — wyliczają się przy
  aktualizacji (Ctrl+A, F9) lub przy druku.
