---
description: Nowy dokument uniwersalny — dowolna branża, dowolny etap projektu, dowolny typ (poza projektami ustaw, patrz /ustawa)
argument-hint: [opis dokumentu, np. "polityka bezpieczeństwa dla startupu FinTech, etap 8 (produkcja)"]
allowed-tools: Task, Read, Write, Bash(python3 -m docgen:*)
disable-model-invocation: true
---

Wykonaj TRYB DZIAŁANIA z `GENERATOR_UNIWERSALNY.md` §8 dla: $ARGUMENTS

1. Deleguj do **architekt-dokumentacji**: branża, etap projektu, rodzaj
   dokumentu, wymagania prawne, struktura (kroki 1-5).
2. Jeżeli architekt zwrócił pytania uzupełniające — zadaj je użytkownikowi
   i zatrzymaj się. Nie zgaduj brakujących danych.
3. Jeżeli architekt zaproponował rekomendację `/nowy` (pakiet 50+ stron) —
   przedstaw to użytkownikowi zamiast pisać dokument jednym przebiegiem.
   Nie uruchamiaj `/nowy` automatycznie.
4. Jeżeli krok 4 architekta wskazał reżimy prawne wymagające pogłębionej
   weryfikacji przed napisaniem treści (stan w toku zmian, obszar sporny) —
   deleguj do **ekspert-prawno-regulacyjny** przed krokiem 5.
5. Deleguj do **redaktor-dokumentu** ze strukturą i danymi z architekta.
   **Nie pisz treści dokumentu samodzielnie.**
6. Po zapisaniu pliku `out/<slug>.md`:
   a. deleguj do **audytor-dokumentu** — ustalenia [K/I/D]
   b. jeżeli audytor podniósł [K] dotyczące zgodności prawnej, albo
      architekt wskazał reżim wymagający kontroli końcowej — deleguj do
      **ekspert-prawno-regulacyjny**
   c. twierdzenia oznaczone przez redaktora jako ryzykowne (liczby, daty,
      normy bez pokrycia) → **weryfikator-zrodel**
7. Ustalenia [K] → zleć redaktorowi poprawkę i wróć do punktu 6.
   Ustalenia [I] i [D] → zbierz i pokaż użytkownikowi, nie blokuj.
8. Przedstaw użytkownikowi: plik wynikowy, werdykt audytu, werdykt zgodności
   prawnej (jeśli dotyczy), ryzyka (krok 7 TRYBU DZIAŁANIA — także ryzyka
   samego procesu: dane niepełne, regulacja w toku zmian, brak przeglądu
   specjalisty), oraz propozycję kolejnych dokumentów na następny etap
   (krok 8 TRYBU DZIAŁANIA, §5).
