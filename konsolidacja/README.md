# Konsolidacja korpusu — scalenie, deduplikacja, eksport DOCX

Pipeline do połączenia wielu plików źródłowych w jeden korpus, usunięcia
powtórzeń w dwóch trybach i złożenia z tego dokumentów Worda.

Powstał dla korpusu Eternal: 7 paczek konwersji markdown zawierających
149 plików źródłowych (1 300 064 słowa).

## Po co dwa tryby deduplikacji

| Tryb | Co usuwa | Co robi z unikatem |
|---|---|---|
| **Zwykła** (`03`) | treść identyczną znak w znak po normalizacji białych znaków, znaczników markdown i wielkości liter | nic nie rusza — usuwa wyłącznie kopie |
| **Zaawansowana** (`04`) | treść o zbliżonym znaczeniu i kontekście (MinHash + LSH, próg Jaccarda 0,65) | z każdego pochłoniętego wariantu wyłuskuje zdania nieobecne w wersji wiodącej i **dokleja je do niej ze wskazaniem pliku źródłowego** |

Wersję wiodącą wybiera priorytet z `lib_bloki.priorytet()`: numer wersji
w nazwie pliku, znaczniki `FINAL` / `KOMPLETNA` / `scalona`, waga dokumentu.
Surowe konwersje rozmów mają priorytet ujemny. Dzięki temu Master 5.4
pochłania 3.0 i 3.1, a nie odwrotnie.

Reguła nadrzędna: **nic nie ginie, treść się przenosi.** Deduplikacja
zaawansowana usuwa 596 wariantów, ratując z nich 1 179 zdań unikatowych.

## Przebieg

```bash
export KONSOLIDACJA_BASE=/ścieżka/do/katalogu/roboczego   # domyślnie katalog skryptów
mkdir -p $KONSOLIDACJA_BASE/{src,parts,work,out}
# paczki .md wrzuć do $KONSOLIDACJA_BASE/src/

python3 01_split.py              # paczki -> pojedyncze pliki + work/index.json
python3 02_master.py             # out/00_PLIK_GLOWNY_PELNA_TRESC.md
python3 03_dedup_zwykla.py       # out/01_DEDUP_ZWYKLA.md
python3 04_dedup_zaawansowana.py # out/02_DEDUP_ZAAWANSOWANA.md
python3 05_spec_docx.py          # out/03_..._SPECYFIKACJA_TECHNICZNA.docx
python3 06_biznesplan_docx.py    # out/04_..._BIZNESPLAN.docx
```

Zależności: `python-docx`, `numpy`, `lxml`.

## Moduły

| Plik | Rola |
|---|---|
| `lib_grupy.py` | klasyfikacja plików na 9 grup tematycznych (regułowa, pierwsza reguła wygrywa) |
| `lib_bloki.py` | priorytet wersji, podział treści na bloki (nagłówek / tabela / akapit), normalizacja do porównań |
| `lib_zrodla.py` | atrybucja źródeł — odwrócony indeks z wagami IDF; dla dowolnego fragmentu wskazuje pliki, które go faktycznie zawierają |
| `lib_docx.py` | skład DOCX: style, tabele, pola TOC / PAGE / PAGEREF, zakładki, hiperłącza |
| `lib_md.py` | odzyskanie hierarchii nagłówków z konwersji docx (sekcje są tam pogrubieniami, nie nagłówkami) + render do Worda |

## Uwaga o polach Worda

Spis treści i numery stron w indeksie źródeł to pola. Po otwarciu pliku:
`Ctrl+A`, potem `F9`, „Aktualizuj cały spis". Wcześniej numery stron
pokazują wielokropek.
