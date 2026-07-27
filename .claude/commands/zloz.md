---
description: Złóż dokument do markdown i docx wraz z Kartą wiarygodności
argument-hint: [opcjonalnie ścieżka do reference.docx]
allowed-tools: Bash(python3 -m docgen:*), Bash(pandoc:*), Read
disable-model-invocation: true
---

1. `python3 -m docgen karta` — sprawdź status.
2. Jeżeli status to `SZKIELETOWY` albo istnieją twierdzenia krytyczne `{N*}`,
   ostrzeż użytkownika przed złożeniem i poproś o potwierdzenie.
3. `python3 -m docgen assemble --outdir out --reference $ARGUMENTS`
4. Pokaż: sumę słów, szacunek stron, status, liczbę otwartych `[BRAK]`.

Znaczniki `[BRAK]` **nie są usuwane przy składaniu** — to celowe. Nie proponuj
ich wyczyszczenia „dla estetyki".
