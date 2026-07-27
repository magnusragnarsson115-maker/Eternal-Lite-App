---
description: Audyt zakresu dokumentu — kontrole deterministyczne plus ocenne
argument-hint: [opcjonalnie ID sekcji, domyślnie wszystkie wchłonięte]
allowed-tools: Task, Bash(python3 -m docgen:*), Read, Grep
---

## Kontrole deterministyczne

!`python3 -m docgen qa`

## Karta wiarygodności

!`python3 -m docgen karta`

## Zadanie

Dla zakresu: $ARGUMENTS (pusty → wszystkie sekcje wchłonięte, partiami po ~10 stron)

1. Deleguj do **audytor-sekcji** kontrole ocenne — nie powtarzaj ustaleń,
   które zwrócił już `docgen qa`.
2. Twierdzenia oznaczone jako ryzyko konfabulacji lub poza okresem ważności
   przekaż do **weryfikator-zrodel**.
3. Zestaw wynik: ustalenia [K/I/D] posortowane, werdykt, status z Karty.
4. Status dokumentu odczytaj z Karty — nie deklaruj go uznaniowo.
