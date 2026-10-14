# Eternal — aplikacja pacjenta i panel placówki

**Eternal Pacjent** (PWA na telefon i komputer oraz aplikacja **iOS/Android** w `mobile/`) i **Eternal Doctor**
(panel lekarzy, rejestracji i administracji) działają na jednym repozytorium danych w standardzie **HL7 FHIR R4**. Każda zmiana po jednej stronie —
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

### Moduły pilotażu i MVP (plik 12.8)

Pełna mapa 78 funkcji na kod i testy: [`docs/MODULES.md`](docs/MODULES.md). Moduły włącza się bez wdrożenia
(panel *Organizacja kliniki → Moduły* albo `npm run cli -- set-module`).

| Moduł | Co robi |
|---|---|
| D1 Zaproszenie i przyjęcie danych | SMS z linkiem albo kod QR → strona bez konta: zgoda (udostępnienie do terminu), zdjęcie lub PDF, odczyt z potwierdzeniem pól, „kto oglądał”, wycofanie zgody |
| D2 Skrzynka materiałów | wizyty dnia z paskiem kompletności wg wymagań kliniki, filtr braków, przypomnienia SMS (ręczne i automatyczne) |
| D3 Raport faktów | wyniki z datą, jednostką, zakresem i oznaczeniem z dokumentu, odnośniki do źródła (plik, wiersz), odczyty niepotwierdzone osobno, PDF; układ wg specjalizacji |
| D5 Eternal Scribe | zgoda na nagranie → transkrypcja (dostawca w UE) → szkic wg szablonu (POZ, kardiologia, pediatria, SOAP, SBAR) z odnośnikami do fragmentów rozmowy → walidator źródeł → zatwierdzenie (FHIR `Composition` + `Provenance`), wersje, PDF, pola do systemu gabinetowego; karta „Po wizycie” dla pacjenta zatwierdzana przez lekarza |
| D7 Wideo | Whereby Embedded albo Jitsi, poczekalnia po stronie serwera, przypomnienia o wizytach i lekach |
| D0 / D12 | zaproszenia personelu, role, odebranie dostępu, licznik użycia i CSV do faktury, incydenty z terminem 72 h, rejestr AI; mierniki pilotażu (czas dokumentacji, poprawki szkicu, kompletność, ankieta lekarza, raport miesięczny) |
| P1–P14 | dokumenty z odczytem, oś czasu z wersjami, udostępnianie na czas, wpisy ręczne z korektą, powiadomienia z godzinami ciszy, SOS i karta ratunkowa, numery kryzysowe (nie do wyłączenia), usunięcie danych z potwierdzeniem; klucze dostępu, kody odzyskiwania, link z e-maila, weryfikacja telefonu, lista urządzeń |

Aplikacja **nie ocenia** wyników: zakres i oznaczenia pochodzą z dokumentu laboratorium, a odczyt maszynowy
jest oznaczony, dopóki ktoś go nie potwierdzi. Treści przygotowane przez AI są oznaczone w interfejsie, w PDF i w FHIR.

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
dziennika), `backup <katalog>` (spójna kopia bazy — zawiera dane osobowe, szyfruj), `create-org` / `orgs`
(kliniki), `create-admin <email> "<imię>" --org <id>`, `modules` / `set-module` (moduły, wdrożenie procentowe),
`synthetic --purpose "<cel>"` (dane syntetyczne z zestawem testowym PDF), `import-synthea <katalog>`.
Bezpieczeństwo: `npm run sbom` (wykaz składników CycloneDX), `npm run audit:deps`, `/.well-known/security.txt`
(`SECURITY_CONTACT`). Dostawcy i wymagane regiony: [`docs/VENDORS.md`](docs/VENDORS.md).

### Medplum jako repozytorium danych

1. Załóż projekt w Medplum (chmura lub instancja własna) i utwórz **ClientApplication** z odpowiednią polityką dostępu.
2. W `.env`: `FHIR_BACKEND=medplum`, `MEDPLUM_BASE_URL`, `MEDPLUM_CLIENT_ID`, `MEDPLUM_CLIENT_SECRET`.
3. Dane kliniczne trafiają do Medplum; lokalnie zostają konta, sesje, dziennik i kolejka powiadomień.

Analogicznie `FHIR_BACKEND=fhir` dla HAPI FHIR, Azure Health Data Services, Google Cloud Healthcare API itp.
Szczegóły i status każdej integracji: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Testy

```bash
npm test                 # 99 testów: FHIR, rezerwacje, uprawnienia, dziennik, link pacjenta, odczyt wyników,
                         # raport faktów, Scribe, udostępnienia, SOS, usuwanie danych, dane syntetyczne, i18n
npm run test:e2e         # Playwright: synchronizacja na żywo; zaproszenie → strona pod linkiem → raport lekarza;
                         # Scribe z mikrofonem testowym → karta „Po wizycie” w aplikacji pacjenta
npm run typecheck
cd mobile && npm run typecheck    # aplikacja mobilna
```

## Struktura

```
server/            API (Fastify), domena, integracje
  fhir/            repozytoria FHIR: lokalne (SQLite), Medplum, generyczne R4; walidacja
  auth/            hasła (scrypt), TOTP, sesje, role
  services/        grafik i rezerwacje, wyniki, wiadomości, zgody, przypomnienia, pomiary, prywatność
  integrations/    NFZ, NLM/LOINC/ICD, WHO ICD-11, HIBP, Withings, RPM (Vitalera), Jitsi, RPL, e-mail/SMS/push
  routes/          trasy REST, fasada FHIR, SSE
  ai/              brama modeli (Claude/Bedrock, Mistral), odczyt dokumentów, mowa na tekst
  labs/            słownik polskich nazw badań (LOINC, UCUM) i parser wyników
  scribe/          szablony notatek
  seed/            dane demonstracyjne, pilotaż, dane syntetyczne
web/src/           React: aplikacja pacjenta (patient/), panel placówki (staff/), strony pod linkiem (link/)
mobile/            aplikacja iOS/Android (Expo SDK 57) — patrz mobile/README.md
tests/             unit (Vitest) i e2e (Playwright)
docs/              zgodność, integracje, moduły (mapa 78 funkcji), rejestr dostawców, zrzuty ekranu
```

## Ograniczenia tej wersji

- Brak integracji z **Platformą P1** (Centralna e-Rejestracja, EDM, e-skierowanie, e-recepta) — wymaga certyfikatu placówki i testów z CeZ; patrz `docs/COMPLIANCE.md`.
- Brak płatności online i rozliczeń NFZ.
- Jedna instancja aplikacji (limiter i szyna zdarzeń w pamięci procesu); skalowanie poziome wymaga Redis/pub-sub.
- Powiadomienia generowane przez serwer są po polsku.
- Dostawcy AI, OCR, mowy na tekst i wideo są zaimplementowani według dokumentacji, ale bez kluczy w tym środowisku
  działały w trybie demonstracyjnym (reguły bez modelu, przykładowa rozmowa). Wybór dostawców wymaga testów z
  decyzji D48 i D51 (20 nagrań, 100 wyników) — patrz `docs/MODULES.md`.
- Aplikacja mobilna jest sprawdzona typami i pełnym pakietem JS (Metro); biometria, schowek systemu i push
  wymagają testu na urządzeniach (development build EAS).
- Adaptery Withings, WHO ICD-11, Medplum i publicznych API zostały zaimplementowane według dokumentacji dostawców
  i przetestowane na danych przykładowych; w środowisku, w którym powstała ta wersja, ruch wychodzący do tych usług
  był zablokowany — przed wdrożeniem wykonaj test połączeń w panelu *Administracja → Integracje*.
