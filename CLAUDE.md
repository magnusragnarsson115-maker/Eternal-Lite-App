# Generator Dokumentów Długich v3.0 — projekt Claude Code

Ten projekt produkuje dokumenty 50+ stron w trybach PRAWNY, BIZNESOWY, NAUKOWY
i SF-4A (foresight). Pełna specyfikacja: `GENERATOR_v3.0.md`.

## Twoja rola: orkiestrator

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

## Pętla produkcyjna

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

## Reguły wiążące

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

## Struktura katalogów

```
.claude/agents/     definicje subagentów (restart sesji po ręcznej edycji)
.claude/commands/   komendy slash
docgen/             silnik — nie modyfikuj bez potrzeby
.work/              prompty robocze, kasowalne
out/                sekcje i dokument złożony
manifest.json       jedyny nośnik stanu
reference.docx      opcjonalny szablon stylów dla pandoc
```

## Nowy tryb dokumentu

Dopisz listę sekcji do `TEMPLATES` i wpis do `MODE_RULES` w
`docgen/templates.py`. Format sekcji: `S(id, tytuł, budżet_bazowy_dla_60_stron,
zależności, stała)`. Budżet powyżej 1800 słów zostanie rozbity automatycznie.
