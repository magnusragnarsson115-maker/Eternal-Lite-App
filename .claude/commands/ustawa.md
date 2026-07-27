---
description: Szkic projektu ustawy lub aktu normatywnego (w tym fikcyjnego) — jednorazowy, bez pełnego pakietu OSR
argument-hint: [temat i cel ustawy, np. "ustawa o rejestrze dostawców usług chmurowych" albo, dla SF: "konstytucja kolonii Kepler-442b, DOKUMENT FIKCYJNY"]
allowed-tools: Task, Read, Write, Bash(python3 -m docgen:*)
disable-model-invocation: true
---

Wykonaj TRYB DZIAŁANIA z `GENERATOR_UNIWERSALNY.md` §4 i §8 dla: $ARGUMENTS

1. Deleguj do **architekt-dokumentacji**: zakres regulacji, branża/dziedzina,
   czy projekt jest fikcyjny (Science Fiction — jeżeli tak, wymagaj
   jednoznacznego potwierdzenia użytkownika przed dalszą pracą), wymagania
   prawne, etap projektu jeśli dotyczy.
2. Jeżeli architekt zwrócił pytania uzupełniające lub wskazał, że
   proponowane rozwiązanie jest sprzeczne z prawem — przedstaw to
   użytkownikowi i zatrzymaj się. Nie generuj projektu „na próbę".
3. Jeżeli zakres wymaga pełnego pakietu legislacyjnego z OSR na poziomie
   50+ stron (`SZABLONY_STRUKTUR.md` §1) — zaproponuj `/nowy tryb=prawny`
   zamiast tego polecenia. Nie uruchamiaj go automatycznie.
4. W przeciwnym razie deleguj do **generator-ustaw** ze strukturą i danymi
   z architekta. **Nie pisz treści projektu samodzielnie.**
5. Po zapisaniu pliku `out/ustawa-<slug>.md`:
   a. deleguj do **ekspert-prawno-regulacyjny** — zgodność z Konstytucją RP,
      prawem UE i prawami człowieka jest obowiązkowa dla każdego projektu,
      fikcyjnego również w zakresie, w jakim odnosi się do realnego
      porządku prawnego
   b. deleguj do **audytor-dokumentu** — kompletność struktury z §4,
      oznaczenie `DOKUMENT FIKCYJNY` jeśli dotyczy
6. Werdykt `NIEZGODNE` z ekspert-prawno-regulacyjny → zleć poprawkę
   generator-ustaw z konkretnym wskazaniem przepisu do usunięcia lub
   przeformułowania i powtórz krok 5a. Nie wydawaj projektu z werdyktem
   `NIEZGODNE`.
7. Przedstaw użytkownikowi: plik wynikowy, werdykt zgodności prawnej,
   ustalenia audytu, oraz — zgodnie z krokiem 8 TRYBU DZIAŁANIA — dokumenty
   towarzyszące zwykle potrzebne obok projektu ustawy (uzasadnienie
   rozszerzone, tabela zgodności z prawem UE, projekty aktów wykonawczych).
