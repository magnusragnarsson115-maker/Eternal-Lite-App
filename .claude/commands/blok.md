---
description: Wygeneruj jeden blok dokumentu (pisanie, audyt, weryfikacja, wchłonięcie)
argument-hint: [opcjonalnie ID sekcji, domyślnie następny blok z kolejki]
allowed-tools: Task, Bash(python3 -m docgen:*), Read, Write
disable-model-invocation: true
---

## Stan bieżący

!`python3 -m docgen status`

## Zadanie

Wykonaj pełną pętlę produkcyjną dla bloku: $ARGUMENTS
(pusty argument → pierwszy blok z kolejki `docgen blocks`).

1. `python3 -m docgen prompt $ARGUMENTS --out .work/blok.txt`
   Jeżeli wynik zaczyna się od `BLOKADA:` — pokaż go i zatrzymaj się.
2. Deleguj do **redaktor-sekcji** ze wskazaniem `.work/blok.txt`.
   **Nie pisz treści sekcji samodzielnie.**
3. Dla każdego zapisanego pliku `out/<ID>.md`:
   a. `python3 -m docgen qa <ID>` — kontrole deterministyczne
   b. deleguj do **audytor-sekcji** — kontrole ocenne
   c. jeżeli docgen zgłosił ryzyko konfabulacji albo audytor podniósł [K]
      dotyczące pokrycia — deleguj do **weryfikator-zrodel**
4. Ustalenia [K] → zleć redaktorowi poprawkę i wróć do punktu 3.
   Ustalenia [I] i [D] → zbierz i pokaż użytkownikowi, nie blokuj.
5. `python3 -m docgen ingest <ID> out/<ID>.md`
6. Pokaż `docgen status` i zatrzymaj się. Nie przechodź do kolejnego bloku
   bez polecenia.
