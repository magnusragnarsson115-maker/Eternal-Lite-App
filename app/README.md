# Eternal — aplikacja pacjenta i panel placówki

**Eternal Pacjent** (PWA na telefon i komputer) i **Eternal Doctor** (panel lekarzy, rejestracji i administracji)
działają na jednym repozytorium danych w standardzie **HL7 FHIR R4**. Każda zmiana po jednej stronie —
rezerwacja, odwołanie, przypomnienie, udostępnienie wyniku, wiadomość — jest widoczna po drugiej
natychmiast (Server-Sent Events), bez przeładowania strony.

> Przeznaczenie: komunikacja i organizacja (rezerwacje, przekazywanie dokumentacji, wiadomości, pomiary
> wprowadzane przez pacjenta). **Aplikacja nie interpretuje wyników, nie ocenia pomiarów i nie zastępuje
> porady lekarza.** Uzasadnienie regulacyjne: [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

## Funkcje

| Obszar | Pacjent | Placówka |
|---|---|---|
| Wizyty | rezerwacja (usługa → lekarz → termin), zmiana terminu, odwołanie w oknie czasowym, plik `.ics`, lista oczekujących na wcześniejszy termin | kalendarz dnia per lekarz, rezerwacja telefoniczna, statusy (na miejscu / zrealizowana / nieobecność), zmiana terminu, odwołanie z powodem |
| Grafik | — | generowanie slotów z przerwą, pomijanie dni ustawowo wolnych (w tym Wigilii od 2025 r.), blokada czasu (urlop) z listą kolizji |
| Przypomnienia | w aplikacji, push, e-mail, SMS — tylko kanały, na które pacjent wyraził zgodę | automatycznie 24 h i 2 h przed wizytą (konfigurowalne), wysyłka ręczna, podgląd kolejki wysyłek |
| Wyniki i dokumenty | wyniki (wartość, jednostka, zakres i oznaczenie z laboratorium), zalecenia, PDF; potwierdzenie odczytu | dodawanie wyników z kodami LOINC, załączniki PDF/JPG/PNG, udostępnianie jednym przełącznikiem, status „odczytano” |
| Teleporady | dołączenie w przeglądarce 15 min przed wizytą (Jitsi Meet) | rozpoczęcie teleporady jako moderator (JWT dla własnej instancji) |
| Wywiad przed wizytą | formularz FHIR Questionnaire (warunki, wymagane pola), możliwość poprawy | odpowiedzi widoczne wyłącznie dla lekarza |
| Wiadomości | wątki z placówką, kategorie, ostrzeżenie o numerze 112 | skrzynka z nieprzeczytanymi, odpowiedzi, wątki inicjowane przez placówkę |
| Pomiary domowe | ręcznie, z urządzeń Bluetooth (ciśnieniomierz, waga, termometr, pulsoksymetr, pulsometr), Withings, platformy RPM (np. Vitalera); wykres i tabela | wgląd tylko za zgodą pacjenta |
| Leki | lista z wyszukiwaniem w Rejestrze Produktów Leczniczych (lokalnie) | wgląd w kartę pacjenta |
| NFZ | wyszukiwarka pierwszych wolnych terminów (API Terminy Leczenia NFZ) | — |
| Prywatność | zgody z historią wersji, **historia dostępu do danych**, eksport FHIR Bundle (RODO art. 20), wniosek o usunięcie konta | dziennik zdarzeń z weryfikacją integralności, realizacja wniosków |
| Tożsamość | rejestracja samodzielna lub kodem aktywacyjnym z placówki; wyniki dostępne po potwierdzeniu tożsamości | potwierdzenie tożsamości (dokument), wydawanie kodów aktywacyjnych |
| Bezpieczeństwo | opcjonalne MFA (TOTP) | **obowiązkowe MFA** dla personelu, role i zasada najmniejszych uprawnień |

Interfejs po polsku i angielsku (test pilnuje kompletności tłumaczeń), zgodny z WCAG 2.1 AA (kontrast,
nawigacja klawiaturą, etykiety, czytniki ekranu, `prefers-reduced-motion`), tryb ciemny, instalowalny jako PWA.

## Architektura

```
 telefon / przeglądarka                       serwer Node.js 22 (Fastify)                         dane
┌──────────────────────┐   HTTPS + SSE    ┌──────────────────────────────────┐   FHIR R4 REST   ┌──────────────────────┐
│ Eternal Pacjent (PWA)│◀────────────────▶│ REST API  /api/*                 │◀────────────────▶│ lokalny magazyn FHIR │
│ Eternal Doctor       │                  │ fasada FHIR /fhir/R4 (odczyt)    │                  │ (SQLite, wersje)     │
└──────────────────────┘                  │ szyna zdarzeń → /api/events (SSE)│                  │  lub Medplum         │
   Web Bluetooth (GATT)                   │ harmonogram: przypomnienia,      │                  │  lub dowolny FHIR R4 │
   Web Push (VAPID)                       │   kolejka wysyłek                │                  └──────────────────────┘
                                          │ dziennik zdarzeń (łańcuch HMAC)  │   SQLite: konta, sesje, dziennik,
                                          └──────────────────────────────────┘   kolejka powiadomień, ustawienia
```

- **Zasoby FHIR**: `Patient`, `Practitioner`, `PractitionerRole`, `Organization`, `Location`, `HealthcareService`,
  `Schedule`, `Slot`, `Appointment`, `DiagnosticReport`, `Observation`, `DocumentReference`, `Binary`,
  `Communication`, `Consent`, `Questionnaire`, `QuestionnaireResponse`, `MedicationStatement`, `Task`, `AuditEvent` (eksport).
- **Walidacja**: każdy zapis jest walidowany względem specyfikacji FHIR R4 (`@medplum/core`), także przed wysłaniem do zewnętrznego serwera.
- **Rezerwacja bez podwójnych terminów**: blokada optymistyczna na wersji zasobu `Slot` (`If-Match`) — z dwóch równoczesnych rezerwacji wygrywa dokładnie jedna (test `scheduling.test.ts`).
- **Usunięcia logiczne** i pełna historia wersji — dokumentacja medyczna nie znika.

## Szybki start

Wymagania: Node.js ≥ 22.13 (wbudowany `node:sqlite`), npm.

```bash
cd app
npm install
npm run seed:demo        # dane fikcyjne do prezentacji (DEMO_MODE=true domyślnie poza produkcją)
npm run dev              # API :3000 + interfejs :5173 (Vite, proxy do API)
```

Konta demonstracyjne (hasło `Eternal-Demo-2026`): `pacjent@eternal.local`, `maria@eternal.local` (tożsamość
niepotwierdzona), `recepcja@eternal.local`, `anna.nowicka@eternal.local`, `piotr.zielinski@eternal.local`,
`admin@eternal.local`. Personel loguje się z kodem TOTP — w trybie demo sekret
`JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (dodaj w Google/Microsoft Authenticator).

### Produkcja

```bash
cp .env.example .env     # uzupełnij: PUBLIC_URL, AUDIT_HMAC_KEY, SMTP_URL, JITSI_DOMAIN, DEMO_MODE=false …
npm run build
npm run cli -- create-admin admin@twoja-placowka.pl "Imię Nazwisko"
npm start                # za reverse proxy z TLS
```

albo kontener: `docker compose up -d --build` (aplikacja + Caddy z certyfikatem Let's Encrypt).

Narzędzia: `npm run cli -- import-rpl` (Rejestr Produktów Leczniczych), `verify-audit` (integralność
dziennika), `backup <katalog>` (spójna kopia bazy — zawiera dane osobowe, szyfruj).

### Medplum jako repozytorium danych

1. Załóż projekt w Medplum (chmura lub instancja własna) i utwórz **ClientApplication** z odpowiednią polityką dostępu.
2. W `.env`: `FHIR_BACKEND=medplum`, `MEDPLUM_BASE_URL`, `MEDPLUM_CLIENT_ID`, `MEDPLUM_CLIENT_SECRET`.
3. Dane kliniczne trafiają do Medplum; lokalnie zostają konta, sesje, dziennik i kolejka powiadomień.

Analogicznie `FHIR_BACKEND=fhir` dla HAPI FHIR, Azure Health Data Services, Google Cloud Healthcare API itp.
Szczegóły i status każdej integracji: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Testy

```bash
npm test                 # 60 testów: FHIR, rezerwacje (w tym wyścig), uprawnienia, dziennik, integracje, API, i18n
npm run test:e2e         # Playwright: dwie sesje (pacjent + lekarz) i synchronizacja na żywo
npm run typecheck
```

## Struktura

```
server/            API (Fastify), domena, integracje
  fhir/            repozytoria FHIR: lokalne (SQLite), Medplum, generyczne R4; walidacja
  auth/            hasła (scrypt), TOTP, sesje, role
  services/        grafik i rezerwacje, wyniki, wiadomości, zgody, przypomnienia, pomiary, prywatność
  integrations/    NFZ, NLM/LOINC/ICD, WHO ICD-11, HIBP, Withings, RPM (Vitalera), Jitsi, RPL, e-mail/SMS/push
  routes/          trasy REST, fasada FHIR, SSE
web/src/           React: aplikacja pacjenta (patient/), panel placówki (staff/), komponenty (ui/)
tests/             unit (Vitest) i e2e (Playwright)
docs/              zgodność, integracje, zrzuty ekranu
```

## Ograniczenia tej wersji

- Brak integracji z **Platformą P1** (Centralna e-Rejestracja, EDM, e-skierowanie, e-recepta) — wymaga certyfikatu placówki i testów z CeZ; patrz `docs/COMPLIANCE.md`.
- Brak płatności online i rozliczeń NFZ.
- Jedna instancja aplikacji (limiter i szyna zdarzeń w pamięci procesu); skalowanie poziome wymaga Redis/pub-sub.
- Powiadomienia generowane przez serwer są po polsku.
- Adaptery Withings, WHO ICD-11, Medplum i publicznych API zostały zaimplementowane według dokumentacji dostawców
  i przetestowane na danych przykładowych; w środowisku, w którym powstała ta wersja, ruch wychodzący do tych usług
  był zablokowany — przed wdrożeniem wykonaj test połączeń w panelu *Administracja → Integracje*.
