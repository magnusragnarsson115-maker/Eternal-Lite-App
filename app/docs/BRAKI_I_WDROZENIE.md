# Braki względem pliku 12.8 i przejście z trybu demo na pracę produkcyjną

Stan na 15.10.2026. Zakres zrobiony (78 pozycji pilotażu, MVP-1 i MVP oraz domknięcia MVP P0 z Biznesplanu 7.1 i moduły M27/M30): [`MODULES.md`](MODULES.md).
Aktualny stan każdego składnika pokazuje polecenie **`npm run cli -- check --live`** albo panel
**Organizacja kliniki → Gotowość do pracy** (działa / tryb demo / brakuje / do decyzji, z dokładnym ustawieniem do zmiany).

## 1. Co działa naprawdę już teraz, a co jest w trybie demo

| Działa naprawdę (bez kont u dostawców) | Tryb demonstracyjny — wymaga konta u dostawcy |
|---|---|
| Panel kliniki, strona pod linkiem, aplikacja pacjenta (przeglądarka), aplikacja mobilna (kod) | **Szkic notatki Scribe i karta „Po wizycie”** — reguły zamiast modelu (`AI_PROVIDER`) |
| Odczyt **PDF z warstwą tekstu** (portale laboratoriów) i rozbiór polskich wyników — słownik, LOINC, UCUM | **Transkrypcja** — w demo zawsze ta sama przykładowa rozmowa, nagranie jest ignorowane (`STT_PROVIDER`) |
| Raport faktów, PDF (Chromium), oś czasu, wersje, korekty | **Zdjęcia i skany** — bez dostawcy OCR nieodczytane, lekarz widzi oryginał (`OCR_PROVIDER`) |
| Udostępnienia, zgody, „kto oglądał”, wygasanie, usuwanie danych | **SMS i e-mail** — trafiają do kolejki wysyłek, nikt ich nie dostaje (`SMS_PROVIDER`, `SMTP_URL`) |
| Logowanie: hasło, TOTP, klucze dostępu, link z e-maila, kody odzyskiwania | **Wideo** — publiczny meet.jit.si, tylko do testów (`VIDEO_PROVIDER=whereby`) |
| Dziennik zdarzeń z łańcuchem HMAC, moduły, mierniki, incydenty, rejestr AI | Push w aplikacji mobilnej — wymaga projektu EAS (`extra.eas.projectId`) |

## 2. Czego nie zrobiłem tak jak w oryginale

### 2.1. Świadome odstępstwa od wyboru składników (A7) — działa, ale inną drogą

| Obszar | W pliku 12.8 | Jest teraz | Co zrobić, jeśli trzymać się oryginału |
|---|---|---|---|
| Panel i strona (R7) | Next.js + shadcn/ui + komponenty Medplum | React + Vite + własne komponenty, te same tokeny wyglądu | Migracja ekranów do Next.js — nie zmienia API ani danych; nie blokuje pilotażu |
| Aplikacja mobilna (R7) | Expo + NativeWind | Expo + StyleSheet z tymi samymi tokenami | Zamiana stylów na NativeWind — kosmetyka |
| Rekord FHIR (R2) | Medplum u nas na PostgreSQL | lokalne repozytorium FHIR (SQLite, wersje); Medplum jako opcja `FHIR_BACKEND=medplum` | Postawić Medplum w AWS Frankfurt i przełączyć zmienną; **adapter Medplum nie był testowany na żywo** |
| Baza (R1) | PostgreSQL zarządzany przez AWS | SQLite w katalogu danych | Wystarcza dla jednej instancji pilotażu; przy kilku instancjach — adapter PostgreSQL (do napisania) |
| Pliki (R1) | S3 Frankfurt z szyfrowaniem KMS | pliki w repozytorium FHIR (`Binary`) w bazie | Adapter S3 + KMS (do napisania) — wymóg przy większym wolumenie i w umowie powierzenia |
| Chmura (R1) | ECS Fargate, sejf sekretów, kopie AWS | Docker Compose + Caddy (HTTPS), kopia `npm run cli -- backup` | Wdrożenie w AWS według A7 albo VPS w UE na pilotaż |
| Uprawnienia (R4) | Medplum AccessPolicy; od MVP-1 OpenFGA | własny model udostępnień (`Consent` + rejestr udostępnień), testowany | OpenFGA, gdy dojdą relacje rodzina/opiekun (MLP) |
| Tożsamość (R3, D50) | pilotaż: Medplum; MVP-1: Cognito albo Keycloak | wbudowane logowanie + gotowe OIDC (PKCE) | Po decyzji D50 ustawić `OIDC_*`; **OIDC nie był testowany z prawdziwą usługą** |
| Wykresy (D3, D12) | ECharts | własne wykresy SVG (te same w PDF) | Nie trzeba |
| Nadzór nad AI (R5, MVP-1) | Langfuse + promptfoo | rejestr wywołań i wersji poleceń w bazie | Dodać Langfuse i testy poleceń jako warunek wydania |
| Monitoring (R8) | Sentry (SDK), od MVP-1 Sentry Team + PostHog | zgłoszenia do Sentry UE bez SDK; analityki produktu brak | PostHog w regionie UE (bez danych medycznych) |
| Rozliczenia (R9) | program księgowy z KSeF i interfejsem; Stripe opcjonalnie | licznik użycia i eksport CSV do faktury | Integracja z wybranym programem księgowym po wyborze z biurem rachunkowym |

### 2.2. Funkcje opisane w A3, których nie ma w kodzie

| Moduł | Brakuje | Dlaczego | Jak domknąć |
|---|---|---|---|
| R5, D5, P3 | **Zbiory testowe**: 30 (pilotaż) / 100 (MVP-1) polskich nagrań z poprawnymi notatkami, 100 polskich wyników | wymagają nagrań scenek i wydruków — nie da się ich wygenerować | Nagrać scenki (zespół, znajomi), zebrać wydruki bez danych osobowych; do wyników jest generator syntetyczny `npm run cli -- synthetic --pdf <katalog>` |
| P3 (MVP) | **Skaner dokumentu systemu telefonu** (VisionKit, ML Kit) | wymaga biblioteki natywnej i buildu na urządzenie | Biblioteka skanera dla React Native + development build EAS; teraz: aparat, galeria, PDF |
| P3 (pilotaż) | **Wycinek oryginału przy zdjęciach odczytanych przez Mistral OCR** | zrobione dla PDF z warstwą tekstu i dla Google Document AI; Mistral OCR zwraca tekst strony bez współrzędnych wierszy | Do zdjęć wybrać Google Document AI (D51) albo dopasowanie tekstu do obrazu po stronie serwera |
| D5 (MVP-1) | **Nagrywanie w aplikacji telefonu lekarza** | jest nagrywanie telefonem przez przeglądarkę (kod QR) | Ekran nagrywania w osobnej aplikacji lekarza albo w obecnej aplikacji z rolą personelu |
| D5 (zapas) | Gotowy Scribe partnera (Corti albo Nabla) jako wyjście awaryjne | A3 traktuje to jako zapas, nie funkcję | Umowa i adapter tylko wtedy, gdy własna notatka nie przejdzie oceny lekarzy |
| D7, P1 | Rezerwacja, wiadomości i wideo **w aplikacji mobilnej** | są w aplikacji w przeglądarce (PWA) | Ekrany w Expo korzystające z tego samego API |
| P1 | Logowanie Apple i Google | według A3 dopiero MLP | Konfiguracja przez OIDC |

### 2.2a. Treści, które napisałem jako projekt — wymagają zatwierdzenia przez ludzi

| Treść | Gdzie | Kto zatwierdza | Jak |
|---|---|---|---|
| Objaśnienia 73 badań i jednostek (A2.4) | `server/labs/explanations.ts` | lekarz (z numerem PWZ) | `npm run cli -- explanations-review > objasnienia.md` → poprawki → `npm run cli -- approve-explanations "lek. Imię Nazwisko, PWZ …"`; do tego czasu pacjenci ich nie widzą (w demo — z oznaczeniem „projekt”) |
| Wywiady i wymagane dokumenty w pakietach specjalizacji (M30) | `server/services/packages.ts` | lekarz danej specjalizacji | przegląd pytań i listy dokumentów przed zastosowaniem pakietu w pierwszej poradni; zmiana treści = nowa wersja pakietu |
| Pytania ankiet: na start, po wynikach, kontrolna, ocena aplikacji (A12.3) | `server/services/surveys.ts` | lekarz (ankiety zdrowotne) + osoba od produktu (ocena aplikacji) | przegląd pytań i reguł „kiedy” (`SURVEY_RULES`); zmiana treści = nowa wersja ankiety, stare odpowiedzi zachowują swoją wersję |
| Teksty w prostym języku (A23.2) | `web/src/simple-pl.ts`, `mobile/src/simple-pl.ts` | redakcja + test z 3–5 seniorami | test zrozumienia na prawdziwych zadaniach (rezerwacja, wynik, raport) |

### 2.3. Sprawdzone tylko częściowo (w tym środowisku nie było kont ani urządzeń)

- **Dostawcy AI, mowy, OCR, wideo, SMS, e-mail** — kod według dokumentacji dostawców, test tylko w trybie demo.
- **Obraz Docker z Chromium** — sieć środowiska blokowała repozytoria Debiana, więc obrazu nie zbudowano; Chromium i PDF sprawdzone poza kontenerem.
- **Klucze dostępu (WebAuthn)** — bez testu automatycznego (wymaga uwierzytelniacza).
- **Aplikacja mobilna** — sprawdzona typami i pełnym pakietem JS; biometria, PIN, schowek systemu i push wymagają testu na telefonach.

### 2.4. Poza kodem (organizacyjne, z A3)

Ocena skutków dla ochrony danych (do 18.12.2026), umowy powierzenia z każdym dostawcą ([`VENDORS.md`](VENDORS.md)),
przegląd OWASP ASVS poziom 1 przed pierwszymi danymi, treści zgody i przeznaczenia z prawnikiem, formalna analiza
kwalifikacji (MDR, AI Act) przez `/dokument`, szkolenie personelu z AI (art. 4 AI Act), plan reakcji na incydenty,
ćwiczenie odtworzenia z kopii, potwierdzenie godzin numeru 116 123, test penetracyjny przed sprzedażą (MVP-1).

## 3. Z demo na pracę produkcyjną — krok po kroku

| Krok | Co zrobić | Zmienne / polecenia |
|---|---|---|
| 0 | Sprawdzić stan | `npm run cli -- check --live` |
| 1 | Serwer w UE i domena z HTTPS (VPS albo AWS Frankfurt według A7) | `NODE_ENV=production`, `DEMO_MODE=false`, `PUBLIC_URL=https://…`, `docker compose up -d --build` |
| 2 | Sekrety i bezpieczeństwo | `AUDIT_HMAC_KEY` (z menedżera sekretów), `SECURITY_CONTACT`, opcjonalnie `SENTRY_DSN` (UE) |
| 3 | Kopie zapasowe | codziennie `npm run cli -- backup <katalog>`, szyfrowanie, kopia poza serwerem, test odtworzenia |
| 4 | SMS i e-mail (bez nich zaproszenia nie wychodzą) | `SMS_PROVIDER=smsapi`, `SMSAPI_TOKEN`, `SMS_SENDER`; `SMTP_URL` (np. Amazon SES Frankfurt), `MAIL_FROM` |
| 5 | Model językowy | `AI_PROVIDER=bedrock` + dostęp IAM do Bedrock w `eu-central-1` z włączonymi modelami Claude (albo `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`); zapas `AI_SECONDARY_PROVIDER=mistral` |
| 6 | Mowa na tekst — po teście D48 | `STT_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` (rezydencja UE) / `azure` / `openai` |
| 7 | OCR zdjęć i skanów — po teście D51 | `OCR_PROVIDER=mistral` + `MISTRAL_API_KEY` albo `google` + `GOOGLE_DOCAI_*` |
| 8 | Wideo — według D52 | `VIDEO_PROVIDER=whereby` + `WHEREBY_API_KEY` albo własny Jitsi (`JITSI_*`) |
| 9 | Pierwsza klinika | `npm run cli -- create-org "Nazwa"`, `create-admin <email> "<Imię>" --org <id>`; w panelu: zaproszenia personelu, wymagane dokumenty, szablony notatek, moduły |
| 10 | Aplikacja mobilna | konta Apple (99 USD/rok) i Google Play (25 USD), `npx eas-cli@latest init`, build preview → test na telefonach → sklep; na serwerze `MOBILE_*` |
| 11 | Prawo i bezpieczeństwo przed pierwszymi danymi | ocena skutków, umowy powierzenia, ASVS L1, treści zgód z prawnikiem |
| 12 | Kontrola końcowa | `npm run cli -- check --live` — wszystkie pozycje „działa” |

Koszty jednostkowe z pliku 12.8 (A3/A8): SMS ok. 0,17 zł netto; Scribe ok. 0,3–0,5 zł za 15-minutową wizytę;
odczyt dokumentu ok. 0,016 zł za stronę; Whereby od 10,99 USD/mies.; test penetracyjny 15–40 tys. zł.

## 4. Co usprawnić najpierw (kolejność)

1. **Hosting pilotażowy z HTTPS i kopiami** — bez tego nie ma pilotażu (kroki 1–3).
2. **SMS i e-mail** — zaproszenia i przypomnienia to rdzeń modułów D1/D2 (krok 4).
3. **Testy D48 i D51, potem Bedrock, mowa i OCR** — zamieniają tryb demo Scribe i odczytu zdjęć na prawdziwy (kroki 5–7).
4. **Zbiory testowe i Langfuse** — jakość AI mierzona przy każdym wydaniu (R5).
5. **PostgreSQL + S3 z KMS**, gdy dojdzie druga instancja albo wymaga tego klient.
6. **Aplikacja mobilna w sklepach** z natywnym skanerem dokumentów, rezerwacją i wiadomościami (MVP).
