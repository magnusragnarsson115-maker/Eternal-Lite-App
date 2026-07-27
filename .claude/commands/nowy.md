---
description: Nowy dokument — brief, próg wiarygodności, manifest
argument-hint: [tytuł dokumentu i tryb, np. "Strategia 2026-2030, biznesowy, 50 str."]
allowed-tools: Task, Bash(python3 -m docgen:*), Read, Write
disable-model-invocation: true
---

Rozpocznij nowy dokument długi: $ARGUMENTS

1. Deleguj do subagenta **architekt-dokumentu**: przeprowadzenie briefu,
   ocena progu wiarygodności, weryfikacja aktualności podstawy.
2. Jeżeli architekt zwrócił BLOKADĘ — przedstaw ją użytkownikowi i zatrzymaj się.
   Nie inicjalizuj manifestu „na próbę".
3. W przeciwnym razie uruchom zwróconą komendę `docgen init`, a następnie dodaj
   źródła przez `docgen source`.
4. Pokaż `docgen outline` i `docgen blocks`.
5. Zaproponuj `/blok` dla pierwszego bloku, ale go nie uruchamiaj.
