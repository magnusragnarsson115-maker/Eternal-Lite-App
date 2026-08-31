# Konsolidacja korpusu Eternal

Pipeline, który z 159 unikalnych plików korpusu (28,6 mln znaków) buduje osiem
dokumentów wynikowych. Skrypty są tu po to, żeby wynik dało się odtworzyć — same
dokumenty nie są wersjonowane (patrz `.gitignore`).

## Kolejność uruchamiania

```bash
python3 extract.py 126 125          # kontrola ekstrakcji wybranych plików
python3 consolidate.py S 126 125 32 105 92 107 96 101 103 82
python3 consolidate.py B 123 145 140 128 158 144 77 79 57 82
python3 consolidate.py R 158 159 154 151 152 136 128 144
python3 consolidate.py P 138 111 110 140 74 75
python3 filtr_artefaktow.py S R B P # drugi przebieg: duplikaty międzyformatowe
python3 tematy.py                    # przekrojowy indeks 16 zagadnień
python3 macierz.py                   # macierz 337 funkcji
python3 build_spec2.py               # specyfikacja wg źródeł
python3 build_tematyczna.py          # specyfikacja wg zagadnień
python3 build_bp.py                  # biznesplan
python3 build_roadmap.py             # roadmapa całości
python3 build_app_html.py            # roadmapa aplikacji
python3 build_index.py               # indeks źródeł
node    decks.js                     # pitch PPTX (aplikacja + ekosystem)
python3 finish.py                    # macierz XLSX + wstrzyknięcie rozstrzygnięć
```

Ścieżki są względne wobec katalogu scratchpad z rozpakowanym korpusem
(`INVENTORY.json` mapuje numer pliku na jego oryginał).

## Zasady, na których stoi pipeline

**Status pliku decyduje o pierwszeństwie, nie o pominięciu.** Pierwsza wersja
pipeline'u pomijała pliki oznaczone `ZASTAPIONY` bez wczytania. To był błąd:
starsza wersja bywa nie „tym samym gorzej", tylko czymś innym. Checklista v2
używa taksonomii M1–M16 z funkcjami numerowanymi F i zawiera funkcje nieobecne
w nowszych plikach. Teraz każdy plik jest wczytywany i porównywany blok po bloku;
zostaje z niego wyłącznie treść, której nie ma w wersji nowszej.

**Deduplikacja ma dwa progi.** Bloki dłuższe niż 40 znaków znormalizowanych są
porównywane globalnie po haszu. Krótsze — etykiety pól kart funkcji, nagłówki
tabel — są zachowywane mimo powtarzalności, bo ich powtórzenia są strukturalne.
Usunięcie ich rozbiłoby komplet 185 kart funkcji w biznesplanie rozszerzonym.

**Drugi przebieg łapie duplikaty międzyformatowe.** Ten sam dokument w PDF i DOCX
tnie się inaczej, więc hasze bloków się nie zgadzają, choć treść jest identyczna.
`filtr_artefaktow.py` porównuje treść jako podciąg materiału przyjętego wcześniej.

**Sprzeczności nie są rozstrzygane po cichu.** Tam, gdzie źródła mówią różne
rzeczy, obie wersje trafiają do dokumentu z zaznaczeniem, która jest nowsza.
Wyjątkiem są rozstrzygnięcia wpisane wprost w `finish.py` i `decks.js`
(cennik, tożsamość Forge) — tam wybór jest zadeklarowany i uzasadniony w treści.

## Pliki

| Plik | Rola |
|---|---|
| `mapa.py` | autorska mapa 159 plików na 4 sekcje, ze statusem wersji i rolą każdego |
| `extract.py` | ekstrakcja treści z DOCX (nagłówki z rozmiaru czcionki), PDF, HTML, XLSX |
| `consolidate.py` | dedup blokowy z proweniencją, kolejność wg priorytetu źródła |
| `filtr_artefaktow.py` | drugi przebieg — duplikaty PDF vs DOCX |
| `tematy.py` | przekrojowy indeks 16 zagadnień ze wszystkich sekcji naraz |
| `macierz.py` | macierz funkcji: monetyzacja, potrzeba, duplikacja w efekcie |
| `mkdocx.py`, `builder.py` | wspólne narzędzia generowania DOCX |
| `build_*.py`, `decks.js` | generatory poszczególnych dokumentów |
| `finish.py` | macierz XLSX i wstrzyknięcie rozstrzygnięć do roadmap |
| `INVENTORY.json` | mapa numeru pliku na ścieżkę oryginału |
| `PACZKI.txt`, `READ_QUEUE.txt` | grupowanie korpusu użyte przy pełnym odczycie |
