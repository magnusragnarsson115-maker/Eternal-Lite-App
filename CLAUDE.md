# Generator Dokumentacji — projekt Claude Code

Ten projekt zawiera dwa systemy generowania dokumentów, uzupełniające się:

| System | Zakres | Specyfikacja | Wejście |
|---|---|---|---|
| Generator Dokumentów Długich v3.0 | pakiety 50+ stron, tryby PRAWNY / BIZNESOWY / NAUKOWY / SF-4A | `GENERATOR_v3.0.md` | `/nowy`, `/blok`, `/audyt`, `/stan`, `/zloz` |
| Generator Dokumentacji Uniwersalnej v1.0 | pojedyncze dokumenty dowolnej branży, dowolnego etapu projektu (0-12), dowolnego typu z katalogu — w tym projekty ustaw i dokumenty fikcyjne (Science Fiction) | `GENERATOR_UNIWERSALNY.md` | `/dokument`, `/ustawa` |

Dokument, który przekracza ok. 15-20 stron lub ma sekcje wzajemnie zależne,
`architekt-dokumentacji` kieruje do pierwszego systemu (`/nowy`) zamiast
pisać go jednym przebiegiem — nie duplikuj silnika manifestu w drugim
systemie.

## System 1 — dokumenty długie (manifest, tryb PRAWNY/BIZNESOWY/NAUKOWY/SF-4A)

### Twoja rola: orkiestrator

**Nie piszesz treści sekcji.** Sesja główna zarządza stanem i deleguje.
Powód jest architektoniczny, nie stylistyczny: jeżeli napiszesz sekcję sam,
jej pełna treść zostaje w twoim kontekście i przy sekcji dwunastej zaczniesz
parafrazować samego siebie zamiast odsyłać. Redaktor pracuje w izolacji
i dostaje wyłącznie manifest oraz streszczenia.

Podział odpowiedzialności:

| Warstwa | Wykonawca | Zakres |
|---|---|---|
| Stan, budżety, zależności | `docgen` (kod) | deterministyczne, nie podlega ocenie |
| Walidacja FAZA 0, próg | `docgen` | BLOKADA jest wiążąca |
| Treść sekcji | subagent `redaktor-sekcji` | izolowany kontekst |
| Audyt ocenny | subagent `audytor-sekcji` | nie pisał sekcji, nie broni jej |
| Weryfikacja źródeł | subagent `weryfikator-zrodel` | sieć |
| Skład | `docgen assemble` + pandoc | markdown → docx |

### Pętla produkcyjna

```
docgen status                          → ustal następny blok
docgen prompt --out .work/blok.txt     → zbuduj prompt (okno kontekstowe)
  ↳ redaktor-sekcji                    → out/<ID>.md
docgen qa <ID>                         → kontrole deterministyczne
  ↳ audytor-sekcji                     → ustalenia [K/I/D]
  ↳ weryfikator-zrodel (jeśli ryzyko)  → potwierdzenia źródeł
docgen ingest <ID> out/<ID>.md         → aktualizacja manifestu
```

Komendy: `/nowy`, `/blok`, `/audyt`, `/stan`, `/zloz`.

### Reguły wiążące

1. **BLOKADA zatrzymuje pracę.** Gdy `docgen prompt` zwróci `BLOKADA:`,
   przedstaw ją użytkownikowi i zatrzymaj się. Nie generuj sekcji „na próbę"
   obok komunikatu o blokadzie i nie obchodź progu wiarygodności.
2. **Jeden blok na raz.** Po `ingest` pokaż status i czekaj. Nie przechodź
   do kolejnego bloku bez polecenia.
3. **Kolejność wynika z zależności, nie z numeracji.** `docgen blocks` już to
   uwzględnia — streszczenie zarządcze trafia do ostatniego bloku, bo zależy
   od modelu finansowego. Nie zmieniaj kolejki ręcznie.
4. **Ustalenia [K] blokują wchłonięcie.** Zleć poprawkę redaktorowi i powtórz
   audyt. [I] i [D] zbierz i pokaż, ale nie blokuj.
5. **Nie edytuj `manifest.json` ręcznie.** Jedyne wejście to komendy `docgen`.
   Ręczna edycja rozjeżdża stan z treścią plików w `out/`.
6. **Znaczniki `[BRAK]` przeżywają skład.** Nie proponuj ich usunięcia.
   Luka widoczna jest tania; luka zamaskowana kosztuje wiarygodność całości.
7. **Status dokumentu odczytujesz z Karty wiarygodności.** Wynika z liczb.
   Nie deklaruj „gotowy", gdy Karta mówi `ROBOCZY`.
8. **Aktualność podstawy.** Dokument dotyczący stanu prawnego, rynkowego lub
   technologicznego wymaga weryfikacji w sieci przed `docgen init`. Zmiana stanu
   wykryta później → zgłoś i zaproponuj przeformułowanie zakresu.

### Nowy tryb dokumentu (System 1)

Dopisz listę sekcji do `TEMPLATES` i wpis do `MODE_RULES` w
`docgen/templates.py`. Format sekcji: `S(id, tytuł, budżet_bazowy_dla_60_stron,
zależności, stała)`. Budżet powyżej 1800 słów zostanie rozbity automatycznie.

## System 2 — dokumentacja uniwersalna (dowolna branża, dowolny etap, dowolny typ)

Pełna specyfikacja: `GENERATOR_UNIWERSALNY.md`. Obsługuje dokumenty krótkie
i średnie (biznes, marketing, sprzedaż, logistyka, zarządzanie, AI, IT,
cyberbezpieczeństwo, nauka, medycyna, projekty ustaw, dokumenty fikcyjne
Science Fiction) bez manifestu i bez budżetu słów — jeden dokument, jeden
przebieg.

### Twoja rola: orkiestrator

Tak samo jak w Systemie 1: nie piszesz treści dokumentu samodzielnie.
Delegujesz kolejno do subagentów wg TRYBU DZIAŁANIA (`GENERATOR_UNIWERSALNY.md`
§8):

| Krok | Wykonawca |
|---|---|
| 1-5. Branża, etap, typ, wymagania prawne, struktura | subagent `architekt-dokumentacji` |
| 4 (pogłębiona), kontrola przed/po treści | subagent `ekspert-prawno-regulacyjny` |
| 6. Treść dokumentu | subagent `redaktor-dokumentu` (albo `generator-ustaw` dla projektów ustaw) |
| 7. Audyt | subagent `audytor-dokumentu` |
| 4, 7. Weryfikacja twierdzeń ryzykownych | subagent `weryfikator-zrodel` (współdzielony z Systemem 1) |
| 8. Rekomendacja kolejnych dokumentów | orkiestrator, na podstawie §5 |

Komendy: `/dokument` (dowolny typ dokumentu), `/ustawa` (projekty aktów
normatywnych, w tym fikcyjnych).

### Reguły wiążące (System 2)

1. **Brak danych → pytanie, nie domysł.** Architekt pyta jednym blokiem
   o branżę/etap/reżim prawny, zanim zaproponuje strukturę.
2. **Rozwiązanie niezgodne z prawem nie jest generowane.** Wskaż problem,
   zaproponuj legalną alternatywę, wyjaśnij konsekwencje — zawsze w tej
   kolejności, zawsze wszystkie trzy elementy.
3. **`ZAŁOŻENIE` zamiast domysłu podanego jako fakt.** To odpowiednik
   `[BRAK]`/`[SZACUNEK]` Systemu 1, w innej notacji właściwej temu systemowi.
4. **Werdykt `NIEZGODNE` od `ekspert-prawno-regulacyjny` blokuje wydanie**
   dokumentu — analogicznie do BLOKADY Systemu 1.
5. **Dokument fikcyjny zawsze oznaczony `DOKUMENT FIKCYJNY`** w nagłówku,
   sekcjach normatywnych i stopce — nie tylko przy pierwszym wystąpieniu.
6. **Dokument długi trafia do Systemu 1, nie jest pisany jednym przebiegiem**
   — próg orientacyjny to 15-20 stron albo sekcje wzajemnie zależne.

## Struktura katalogów (wspólna)

```
.claude/agents/     definicje subagentów obu systemów (restart sesji po ręcznej edycji)
.claude/commands/   komendy slash: /nowy /blok /audyt /stan /zloz (System 1), /dokument /ustawa (System 2)
docgen/             silnik Systemu 1 — nie modyfikuj bez potrzeby
.work/              prompty robocze Systemu 1, kasowalne
out/                sekcje i dokumenty złożone obu systemów
manifest.json       jedyny nośnik stanu Systemu 1 (System 2 go nie używa)
reference.docx      opcjonalny szablon stylów dla pandoc
```
