# Konsolidacja korpusu Eternal

Pipeline, który z 159 unikalnych plików korpusu (28,6 mln znaków) buduje czternaście
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
python3 macierz.py                   # macierz 337 funkcji (monetyzacja)
python3 komponenty.py                # przypisanie komponentow do 337 funkcji
python3 build_spec2.py               # specyfikacja wg źródeł          → DOCX
python3 build_tematyczna.py          # specyfikacja wg zagadnień       → DOCX
python3 build_bp.py                  # biznesplan                      → DOCX
python3 build_analiza_docx.py        # analiza poprawności             → DOCX
python3 build_index_docx.py          # indeks 159 źródeł               → DOCX
python3 build_komponenty_docx.py     # architektura komponentów        → DOCX
python3 build_komponenty_xlsx.py     # macierz komponentów             → XLSX
python3 build_prd_docx.py            # PRD 43 modułów                  → DOCX
python3 build_master_docx.py         # dokument nadrzędny 26 sekcji    → DOCX
python3 build_roadmap.py             # roadmapa całości                → HTML
python3 build_app_html.py            # roadmapa aplikacji              → HTML
node    decks.js                     # pitch aplikacja + ekosystem     → PPTX
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

**Format wynika z przeznaczenia dokumentu, nie z wygody generatora.** HTML jest
zarezerwowany wyłącznie dla roadmap — tam interaktywność (przełączanie widoków,
liczniki, zwijane etapy) jest treścią, nie ozdobą. Specyfikacja, biznesplan,
analiza poprawności i indeks źródeł idą w DOCX, bo są czytane i drukowane
liniowo oraz komentowane w edytorze. Pitch decki idą w PPTX, bo są prezentowane.
Wcześniejsze wersje pipeline'u generowały HTML dla wszystkiego — zostało to
cofnięte, a generatory HTML analizy, indeksu i pitcha usunięte, żeby nie
odtwarzały plików w niewłaściwym formacie.

**Warstwa zgodności jest wyprowadzana z definicji, nie z pola źródłowego.** Rejestr
funkcji ma pole „klasa MDR" (IIA/IIB/III), ale jest ono artefaktem ekstrakcji: jako
klasa IIb oznaczone są w nim „Dashboard główny" i „Ręczne dodawanie danych", które
wyrobem nie są. `komponenty.py` wyprowadza warstwę A/B/C z definicji Master 5.4
i z treści nazwy funkcji, a pole źródłowe zachowuje wyłącznie jako ślad, z adnotacją.
Kontrola: korpus wskazuje A3.5, A6.5, A6.8 i D2.x jako warstwę C — reguły odtwarzają
wszystkie cztery przypadki niezależnie.

**Kontrola jest liczona jawnym wzorem, nie oceniana.** `dane_moduly.py` liczy ją jako
0,40 x (szczebel/5) + 0,25 x dane + 0,20 x wymienialność + 0,15 x wniosek. Wagi są
arbitralne, ale jawne — spór dotyczy wtedy wag, a nie wyniku. Wynik pokazał rzecz
nieoczywistą: agregacja całego modułu sama w sobie nie kosztuje kontroli (mediana 74%).
Kontrolę traci się przez brak adaptera, brak własnej kopii danych albo oddanie
dostawcy wniosku końcowego — a to trzecie bywa decyzją słuszną.

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
| `marka.py` | identyfikacja wizualna odtworzona z logo: paleta i wektorowy znak |
| `dane_analiza.py` | dane analizy własnej: 14 ustaleń, rachunek finansowy, źródła zewnętrzne |
| `dane_komponenty.py` | rejestr 30 klas komponentów, dostawcy A/B/C, ekonomia per user, wyzwalacze zmiany |
| `komponenty.py` | przypisanie klasy komponentu i warstwy zgodności do każdej z 337 funkcji |
| `dane_moduly.py` | 43 moduły: kandydat na cały moduł, pokrycie, kontrola %, OSS, adapter, kubełek wellness→med |
| `dane_master.py` | treść dokumentu nadrzędnego — 26 sekcji od wizji po załączniki |
| `DECK30.json` | struktura oficjalnego pitch decku (32 slajdy) wyeksportowana z PDF |
| `mkdocx.py`, `builder.py` | wspólne narzędzia generowania DOCX |
| `build_*.py`, `decks.js` | generatory poszczególnych dokumentów |
| `finish.py` | macierz XLSX i wstrzyknięcie rozstrzygnięć do roadmap |
| `INVENTORY.json` | mapa numeru pliku na ścieżkę oryginału |
| `PACZKI.txt`, `READ_QUEUE.txt` | grupowanie korpusu użyte przy pełnym odczycie |
