# Moduły i funkcje wersji pilotażowej, MVP-1 i MVP — mapa na kod

Źródło zakresu: plik **12.8 „Aplikacja — skład”** (arkusze A2 *Funkcje i etapy*, A3 *Skład na etap*, A7 *Wybór na etap*).
Zakres: **78 pozycji** z etapami „wersja pilotażowa” (37), „MVP-1” (11) i „MVP” (30), w podziale na moduły
Doctor (D0–D12), Pacjent (P1–P14) i Rdzeń wspólny (R1–R10).

## Rejestr modułów i włączanie

Moduły są przełączane bez wdrożenia (`server/modules.ts`, panel **Organizacja kliniki → Moduły**, CLI
`npm run cli -- modules` / `set-module <id> on|off [--rollout 0-100] [--org <id>]`). Moduły kliniki (D*) ustawia
administrator kliniki; moduły aplikacji pacjenta (P*) — operator. Wdrożenie procentowe (A18.7) przydziela konto do
grupy stabilnie (skrót SHA-256 identyfikatora). Wyłączony moduł zwraca `404 module_disabled`, menu go ukrywa.
Numery kryzysowe (P14, F8.1) nie mają przełącznika.

| Moduł | Kod | Etap | Przełącznik |
|---|---|---|---|
| Konta kliniki, role, rozliczenia, incydenty | D0 | pilotaż / MVP-1 | stały |
| Zaproszenie i przyjęcie danych od pacjenta | D1 | pilotaż | klinika |
| Skrzynka materiałów i kompletność | D2 | pilotaż | klinika |
| Raport faktów przed wizytą | D3 | pilotaż | klinika |
| Eternal Scribe i karta „Po wizycie” | D5 | pilotaż | klinika |
| Wideo, rezerwacje, przypomnienia | D7 | MVP-1 | klinika |
| Mierniki pilotażu i jakości | D12 | pilotaż | klinika |
| Udostępnianie na czas i „kto oglądał” | P2 | MVP | operator |
| Dokumenty i wyniki w aplikacji | P3 | MVP | operator |
| Wpisy ręczne i korekta | P4 | MVP | operator |
| Powiadomienia i przypomnienia | P8 | MVP | stały |
| Ratunek jednym kliknięciem (SOS) | P14 | MVP | operator |
| Numery kryzysowe 112 i 116 123 | P14 | MVP | **nie do wyłączenia** |

## Mapa 78 pozycji

Skróty ścieżek: `S/` = `server/`, `W/` = `web/src/`, `M/` = `mobile/src/`, `T/` = `tests/`.
„= nr” oznacza pozycję zduplikowaną w A2 (ta sama funkcja pod innym numerem).

### Doctor (pozycje z pliku 2)

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 1 | DOC-01 konto kliniki, użytkownicy i role | pilotaż | wiele klinik w jednej instancji: `S/tenancy.ts` (znacznik organizacji w każdym zasobie FHIR), `S/services/orgs.ts`; role i MFA personelu `S/auth/*`; zaproszenia personelu `S/routes/org.ts` (`/api/admin/staff-invites`), `W/staff/ClinicPages.tsx` (`OrgManagePage`); odebranie dostępu: wyłączenie konta usuwa sesje, klucze i tokeny (`S/routes/admin.ts`) | `T/unit/org-account.test.ts`, `api.test.ts` |
| 2 | DOC-05 panel organizacji: użycie, rozliczenie, incydenty | MVP-1 | licznik użycia i eksport CSV do faktury `S/services/metrics.ts` (`usageForMonth`, `usageCsv`), `/api/admin/usage(.csv)`; incydenty `S/services/incidents.ts`; panel `OrgManagePage` | `org-account.test.ts` |
| 3 | DOC-02 przyjęcie danych od pacjenta za zgodą | pilotaż | udostępnienie = zasób `Consent` + `access_grant` (zakres × odbiorca × czas, odmowa domyślna): `S/services/grants.ts`; sejf pacjenta (`pt-{id}`) — dostęp kliniki tylko przez aktywne udostępnienie (`requireGrantAccess`) | `visit-flow.test.ts`, `patient-mvp.test.ts` |
| 4 | DOC-06 dziennik dostępu kliniki i wygasanie | pilotaż | każdy odczyt przez `audit()`; wygasanie `expireGrants` (co 10 min, `S/bootstrap.ts`); widok „kto oglądał” `S/services/privacy.ts` (`accessLogForPatient`), strona pod linkiem i aplikacja | `visit-flow.test.ts`, E2E `pilot.spec.ts` |
| 5 | DOC-07 zaproszenie: link albo kod QR, wgrywanie bez aplikacji | pilotaż | `S/services/invites.ts` (token jednorazowy, ważność = wizyta + okres z ustawień, SMS bez danych o zdrowiu, QR), `S/routes/link.ts`, `W/link/LinkPages.tsx` (`/z/:token`): zgoda → wgranie → potwierdzenie → „Gotowe”, wycofanie zgody, przejęcie danych do konta | `visit-flow.test.ts`, E2E `pilot.spec.ts` |
| 6 | DOC-03 skrzynka materiałów i kompletność | pilotaż | `S/services/inbox.ts` (wymagane dokumenty z ustawień kliniki, pasek kompletności, filtr „brakuje”, przypomnienie SMS, automatyczne przypomnienie N godzin przed wizytą), `W/staff/VisitPages.tsx` (`InboxPage`, `VisitPage`) | `visit-flow.test.ts`, E2E |
| 7 | DOC-04 raport faktów przed wizytą | pilotaż | `S/services/facts.ts` (szablon wersjonowany, układy wg specjalizacji, wyłącznie potwierdzone wartości z zakresem i oznaczeniem z dokumentu, odczyty niepotwierdzone osobno, odnośniki do źródeł — plik i wiersz), PDF `S/pdf/*`; `FactsReportView` | `visit-flow.test.ts`, E2E |
| 8 | DOC-MLP-01 Eternal Scribe — notatka z wizyty | pilotaż | `S/services/scribe.ts`, `S/scribe/templates.ts` (ogólna, kardiologia, pediatria, SOAP, SBAR), walidator „każde zdanie ma źródło” (`validateNote`), zatwierdzenie → `Composition` + `Provenance`, wersje i poprawki, kopiowanie pól do systemu gabinetowego, PDF; `W/staff/ScribePanel.tsx` | `scribe.test.ts`, E2E `pilot.spec.ts` |
| 9 | DOC-08 podsumowanie dla pacjenta (zatwierdza lekarz) | pilotaż | karta „Po wizycie”: `generateCard` / `saveCard` / `approveAndSendCard` (aplikacja albo SMS z linkiem `/k/:token`), `S/services/cards.ts`, przekazanie osobie upoważnionej z podstawą prawną | `scribe.test.ts`, E2E |
| 10 | DOC-MLP-04 wideo, rezerwacje i przypomnienia | MVP-1 | `S/services/tele.ts` (Whereby Embedded albo Jitsi, poczekalnia po stronie serwera — adres pokoju dopiero po wpuszczeniu), `WaitingRoomCard`, `TeleDoctorControls`; rezerwacje i kalendarz z wersji bazowej | `org-account.test.ts`, `scheduling.test.ts` |
| 11 | D12 mierniki pilotażu | pilotaż | `S/services/metrics.ts` (zdarzenia, czas dokumentacji bez/z Eternal, odsetek poprawek szkicu, kompletność, ankieta co 14 dni, raport miesięczny PDF), `S/services/reports.ts`, `MetricsPage` | `scribe.test.ts`, `org-account.test.ts` |
| 12 | Specyfikacja 10: przypomnienia o lekach i wizytach | MVP-1 | `S/services/medReminders.ts` (harmonogram z listy leków, potwierdzenie „wziąłem/pominąłem”, bez ustalania dawek), `MedRemindersCard`; przypomnienia o wizytach 24 h / 2 h z wersji bazowej | `patient-mvp.test.ts`, `reminders-questionnaire.test.ts` |

### D5 — Scribe (pozycje szczegółowe)

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 13 | A12.1 nagrywanie konsultacji | pilotaż | zgoda pacjenta zapisywana jako `Consent` z datą przed nagraniem (`startSession`), nagranie w przeglądarce (`W/lib/recorder.ts`) albo telefonem przez kod QR (`/nagranie/:token`); usuwanie nagrania i transkrypcji N dni po zatwierdzeniu (`purgeRecordings`) | `scribe.test.ts` |
| 14 | A5.4 = 13 | pilotaż | jw. | |
| 15 | F6.10 = 13 (za zgodą RODO) | pilotaż | jw. | |
| 16 | A12.2 transkrypcja | pilotaż | `S/ai/stt.ts` — ElevenLabs Scribe (rezydencja UE) / Azure AI Speech (UE) / OpenAI (rezydencja UE); wybór testem D48 przez `STT_PROVIDER`; fragmenty S1…Sn | `scribe.test.ts` |
| 17 | A12.5 automatyczne tworzenie dokumentacji | pilotaż | szkic z akapitami powiązanymi z fragmentami rozmowy (`processSession`, `S/ai/prompts.ts`), model nie stawia rozpoznań | `scribe.test.ts` |
| 18 | F3.19 nagranie, transkrypcja i raport SBAR | pilotaż | szablon `sbar` w `S/scribe/templates.ts` (sytuacja, tło, ocena lekarza, zalecenie) | `scribe.test.ts` |

### P2 — zgody, udostępnianie, dziennik

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 19 | A18.10 dziennik dostępu widoczny dla użytkownika | pilotaż | `accessLogForPatient` (personel, organizacja, rodzaj odczytu), strona pod linkiem, `SharingPage`, `M/app/(tabs)/sharing.tsx` | E2E `pilot.spec.ts` |
| 20 | A24.4 czasowe udostępnienie lekarzowi | pilotaż | `createGrant` (klinika lub konkretny lekarz, zakres: wszystko / wyniki / dokumenty / wybrane, do 365 dni; w interfejsie 1, 7, 30 albo 90 dni), `/api/me/grants`, `SharingPage` | `patient-mvp.test.ts` |
| 21 | F1.3 zgody RODO (znacznik czasu, dziennik) | pilotaż | zgody wersjonowane (`S/services/consents.ts`), tekst zgody z wersją w `S/content/texts.ts`, `Consent.policy` z identyfikatorem wersji tekstu | `records-privacy.test.ts`, `visit-flow.test.ts` |
| 59 | A18.11 granularne wycofanie zgody | MVP | wycofanie jednym ruchem: `revokeGrant` (unieważnia też linki), wycofanie spod linku `withdrawViaLink`, aplikacja mobilna | `patient-mvp.test.ts`, `visit-flow.test.ts` |

### P3 — dokumenty i wyniki badań

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 22 | A2.1 OCR wyników laboratoryjnych | pilotaż | `S/ai/ocr.ts`: warstwa tekstowa PDF (pdf.js, lokalnie) → Mistral OCR albo Google Document AI (`OCR_PROVIDER`, decyzja D51) | `visit-flow.test.ts`, `synthetic.test.ts` |
| 23 | F3.3 = 22 (Tesseract) | pilotaż | zamiast Tesseract — wybór z A7 poz. 9 (patrz „Odstępstwa”) | |
| 24 | F10.4 = 22 | pilotaż | jw. | |
| 25 | A2.2 rozbiór do FHIR Observation | pilotaż | `submitIntake`: `DocumentReference` + `DiagnosticReport` + `Observation` (LOINC, UCUM, zakres i oznaczenie z dokumentu, znacznik zaufania, `Provenance`) | `visit-flow.test.ts`, `patient-mvp.test.ts` |
| 26 | A2.3 walidacja i korekta OCR | pilotaż | ekran potwierdzania pól z wierszem źródłowym (`W/shared/IntakeReview.tsx`, `M/app/intake/[id].tsx`): potwierdź / popraw / „to nie jest wynik”; model może tylko wskazać wartości obecne w tekście danej linii (`mergeModelItems`) | `visit-flow.test.ts`, E2E |
| 27 | A11.4 standaryzacja jednostek | pilotaż | `S/labs/dictionary.ts` (jednostki z polskich wydruków → UCUM, jednostki dopuszczalne dla badania, kontrola „nietypowa jednostka”) | `visit-flow.test.ts`, `synthetic.test.ts` |
| 28 | F3.1 skan dokumentu aparatem | pilotaż | strona pod linkiem: `capture="environment"`; aplikacja: `expo-image-picker` (`M/app/(tabs)/documents.tsx`) | E2E (PDF) |
| 29 | F3.2 PDF z Google Drive i plików telefonu | pilotaż | wybór pliku systemowego (dostawcy Dysk Google, iCloud, pliki) — przeglądarka i `expo-document-picker` | E2E |
| 30 | F3.4 rozbiór polskich wyników (Synevo, Diagnostyka, ALAB) | pilotaż | `S/labs/parser.ts` (układy: nazwa–wynik–jednostka–zakres, z flagą, wynik–zakres–jednostka, nazwa [jednostka] wynik (zakres); przecinek dziesiętny; daty pobrania) | `visit-flow.test.ts`, `synthetic.test.ts` (zestaw testowy 3 układów) |
| 31 | F3.5 mapowanie na LOINC | pilotaż | słownik 73 badań z nazwami i skrótami spotykanymi na polskich wynikach, dopasowanie dokładne i przybliżone z oznaczeniem „sprawdź” | `visit-flow.test.ts` |
| 60 | A2.5 historia badań z wersjonowaniem | MVP | oś czasu `TimelinePage` (`/api/me/timeline`), historia wersji wartości z powodem korekty i pochodzeniem (`/api/me/observations/:id/versions`) | `patient-mvp.test.ts` |
| 61 | A2.7 OCR recept i zaświadczeń | MVP | ścieżka dokumentów nie-laboratoryjnych: rozpoznanie rodzaju (recepta, zaświadczenie, skierowanie, opis badania), sekcje kopiowane dosłownie z wierszami źródłowymi (`heuristicStructure` + model) | — (do zestawu testowego D51) |
| 62 | F3.6 alert, gdy parametr poza normą | MVP | powiadomienie „lab-flags” wyłącznie na podstawie **oznaczeń wydrukowanych przez laboratorium** (H/L) — aplikacja sama nie porównuje z normą (granica MDR); treść powiadomienia bez danych o zdrowiu; wyłączalne w preferencjach | `patient-mvp.test.ts` (powiadomienie `lab-flags`) |
| 63 | F3.9 karta wypisowa szpitalna | MVP | rodzaj `discharge`: sekcje (rozpoznanie, przebieg, zalecenia) kopiowane bez zmian, widoczne w raporcie faktów jako dokument | — (do zestawu testowego D51) |
| 64 | F6.3 pobieranie i załączanie wyników | MVP | pobranie oryginału (`/api/me/documents/:id/file`), dołączenie dokumentów do wizyty (`/api/me/appointments/:id/attach`) | — |

### P1 — konto i logowanie

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 42 | F1.10 klucz sprzętowy (WebAuthn/FIDO2) | MVP-1 | `S/auth/webauthn.ts` (`@simplewebauthn/server`), logowanie kluczem i klucz jako drugi składnik personelu, `SecurityKeysCard` | — (wymaga uwierzytelniacza; sprawdzone typami biblioteki) |
| 49 | F1.1 rejestracja e-mailem (Apple, Google) | MVP | e-mail + hasło (wersja bazowa), klucz dostępu, logowanie firmowe OIDC (`S/auth/oidc.ts`, PKCE + nonce); Apple i Google — zgodnie z A3 w MLP (konfiguracja tym samym OIDC) | `api.test.ts` (rejestracja e-mailem); OIDC — test z dostawcą przed wdrożeniem |
| 50 | F1.2 logowanie biometryczne | MVP | `M/app/lock.tsx` (`expo-local-authentication`, bez obejścia kodem urządzenia); w przeglądarce — klucz dostępu (odcisk palca, twarz) | typecheck + pakiet Metro |
| 51 | F1.4 kody odzyskiwania (10 jednorazowych) | MVP | `S/auth/webauthn.ts` (`generateRecoveryCodes`, przechowywane jako skróty SHA-256 — nie do odszyfrowania), `RecoveryCodesCard` | `org-account.test.ts` |
| 52 | F1.5 zapasowy PIN 6-cyfrowy | MVP | `M/lib/secure.ts` (skrót z solą w schowku systemu, 5 prób → usunięcie sesji z urządzenia) | typecheck |
| 53 | F1.6 profil podstawowy | MVP | profil (imię, nazwisko, data urodzenia → wiek, płeć, kontakt) `/api/me/profile`; waga i wzrost jako pomiary z historią (P4) | `records-privacy.test.ts` (pomiary) |
| 54 | F1.7 TOTP | MVP | wersja bazowa (`S/auth/totp.ts`, ochrona przed ponownym użyciem kodu), aplikacja mobilna | `api.test.ts` |
| 55 | F1.8 weryfikacja SMS | MVP | `/api/me/phone`, `/api/me/phone/verify` (kod 6 cyfr, ważny 10 min, 5 prób), `PhoneVerifyCard`; bramka SMSAPI (A7 poz. 11) | `org-account.test.ts` |
| 56 | F1.9 logowanie linkiem z e-maila | MVP | `/api/auth/magic-link`, `/logowanie/link` — link jednorazowy, 15 min; konto z TOTP nadal wymaga drugiego składnika | `org-account.test.ts` |
| 57 | F1.13 sesje i lista urządzeń (≤ 5) | MVP | `S/auth/sessions.ts` (nazwa urządzenia, metoda logowania, limit `MAX_DEVICES` — najstarsza sesja wygasa), `SessionsCard`, `M/app/devices.tsx` | `org-account.test.ts` |
| 58 | F1.18 Secure Enclave / Android Keystore | MVP | `M/lib/secure.ts` — `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, bez kopii zapasowej | typecheck |

### P4, P8 — wpisy ręczne, powiadomienia

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 65 | A1.3 ręczne dodawanie danych | MVP | pomiar z listy parametrów z kontrolą jednostek i zakresu wprowadzania, znacznik „wpis ręczny” + `Provenance` (`S/services/observations.ts`) | `patient-mvp.test.ts` |
| 66 | A1.4 ręczna korekta wartości | MVP | `correctMeasurement`: nowa wersja `Observation` (`amended`) z powodem; poprzednia wartość zostaje w historii | `patient-mvp.test.ts` |
| 67 | A3.4 system powiadomień | MVP | `S/services/notifications.ts`: rodzaje, preferencje, godziny ciszy (`outbox.not_before`), kolejność push → e-mail → SMS, push przez Web Push i Expo; treść poza aplikacją bez danych o zdrowiu | `patient-mvp.test.ts`, `reminders-questionnaire.test.ts` |
| 68 | A14.2 inteligentne przypomnienia | MVP | przypomnienia o wizytach, brakujących dokumentach (D2) i lekach z uwzględnieniem preferencji i godzin ciszy | `patient-mvp.test.ts` |

### P14 — zaufanie, bezpieczeństwo, dostępność

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 32 | A18.3 deklaracja przeznaczenia i ograniczeń | pilotaż | `S/content/texts.ts` (`PURPOSE_TEXT`, wersjonowany), strona pod linkiem, `HelpPage`, `M/app/about.tsx` | `visit-flow.test.ts` (teksty z wersją pod linkiem) |
| 33 | A19.1 oznaczanie treści generowanej | pilotaż | etykiety „odczyt maszynowy” / „przygotowane przez AI, zatwierdzone przez lekarza” w interfejsie, PDF i FHIR (`TAG_AI_ASSISTED`, znaczniki zaufania) | `scribe.test.ts` |
| 69 | A5.3 ratunek jednym kliknięciem | MVP | `S/services/safety.ts` (`triggerSos`: SMS do osób bliskich z linkiem do karty ratunkowej ważnym 24 h, odczyt karty zapisany w dzienniku), `SafetyPage`, `M/app/sos.tsx` | `patient-mvp.test.ts` |
| 70 | A5.10 = 69 | MVP | jw. | |
| 71 | S4.2 = 69 | MVP | jw. | |
| 72 | A18.1 instrukcja w aplikacji, wersjonowana | MVP | `APP_INSTRUCTIONS` (wersja w treści), `HelpPage`, `M/app/about.tsx` | — |
| 73 | A18.12 usunięcie danych z potwierdzeniem | MVP | `S/services/deletion.ts` (sejf, pliki, udostępnienia, linki, konto; co zostaje w placówkach i dlaczego; data zniknięcia z kopii), potwierdzenie PDF, `DeleteDataCard`, `M/app/delete-data.tsx` | `patient-mvp.test.ts` |
| 74 | F8.1 przekierowanie kryzysowe 116 123 (nie do wyłączenia) | MVP | `CRISIS_NUMBERS` w serwerze i w aplikacji mobilnej (działa bez internetu i bez logowania); wykrycie słów kryzysowych w wiadomości pokazuje okno z numerami (`crisisMentioned`, `CrisisModal`) | `org-account.test.ts` (modułu nie da się wyłączyć) |
| 75 | A8.10 = 74 | MVP | jw. | |
| 76 | F4.5 = 74 (nie do zasłonięcia) | MVP | jw. — moduł `crisis` ma `switchable: false` | |
| 77 | F8.4 lista numerów kryzysowych | MVP | 112, 116 123, 800 70 2222, 116 111, 800 120 002 (godziny tylko tam, gdzie źródła są zgodne) | |

### Rdzeń wspólny (R1–R10) i D0

| Nr | Pozycja | Etap | Gdzie w kodzie | Testy |
|---|---|---|---|---|
| 34 | A1.5 normalizacja do FHIR R4 | pilotaż | walidacja każdego zapisu (`@medplum/core`), repozytoria: lokalne, Medplum, dowolny FHIR R4 | `fhir-local.test.ts` |
| 35 | F2.4 = 34 (Observation) | pilotaż | jw. | |
| 36 | D1.1 baza danych pacjenta | pilotaż | rekord FHIR z wersjami, pochodzeniem (`S/fhir/provenance.ts`) i poziomem zaufania; sejf pacjenta oddzielony od dokumentacji kliniki | `fhir-local.test.ts`, `patient-mvp.test.ts` |
| 37 | D1.5 niezmienialny dziennik zdarzeń | pilotaż | `S/audit.ts` — łańcuch HMAC, `npm run cli -- verify-audit` | `records-privacy.test.ts` |
| 38 | A19.6 rejestr zastosowań i logowanie zapytań | pilotaż | `S/ai/gateway.ts` (rejestr wywołań bez treści medycznej: zadanie, wersja polecenia, dostawca, model, czas), limit wywołań na organizację, panel „Rejestr AI” | `org-account.test.ts` |
| 39 | A18.9 wykaz składników i zgłaszanie podatności | pilotaż | `npm run sbom` (CycloneDX), `/.well-known/security.txt`, `/security-policy.txt`, `SECURITY.md`, Dependabot, cotygodniowy skan Trivy (`.github/workflows/security.yml`), zgłaszanie błędów serwera do Sentry UE bez danych (`S/lib/monitoring.ts`) | `api.test.ts` |
| 40 | D5.3 dane syntetyczne | pilotaż | `S/seed/synthetic.ts`, CLI `synthetic` (fikcyjni pacjenci z danymi podłużnymi, zestaw testowy PDF z oczekiwanymi wartościami, wpis w rejestrze użyć z celem) i `import-synthea` | `synthetic.test.ts` |
| 41 | A18.4 zgłaszanie incydentu przez użytkownika | MVP-1 | `ReportIncidentCard` (pacjent i personel), `S/services/incidents.ts` (prywatność/bezpieczeństwo → priorytet wysoki, możliwe naruszenie: termin 72 h na ocenę, powiadomienie administratorów i `SECURITY_CONTACT`) | `org-account.test.ts` |
| 43 | A5.1 wideokonsultacja | MVP-1 | = 10 | |
| 44 | F6.5 = 43 (LiveKit) | MVP-1 | jw. — Whereby/Jitsi wg D52 | |
| 45 | S4.1 = 43 | MVP-1 | jw. | |
| 46 | A5.8 przypomnienia o wizytach | MVP-1 | przypomnienia 24 h i 2 h (`REMINDER_OFFSETS_HOURS`), powiązane z przygotowaniem do wizyty (link do dokumentów, wywiad) | `reminders-questionnaire.test.ts` |
| 47 | F6.9 = 46 | MVP-1 | jw. | |
| 48 | F6.8 kalendarz lekarzy i wolne terminy | MVP-1 | grafik i rezerwacje z wersji bazowej (sloty, przerwy, święta, blokada optymistyczna) | `scheduling.test.ts`, E2E `live-sync.spec.ts` |
| 78 | A18.7 kontrolowana dystrybucja aktualizacji | MVP | wdrożenie procentowe modułów (`inRollout`), `/api/public/app-version` + ekran „Wymagana aktualizacja”, kanały EAS Update z `--rollout-percentage` | `api.test.ts` |

## Odstępstwa od A7 i uzasadnienie

| A7 | Wybór w A7 | W kodzie | Dlaczego |
|---|---|---|---|
| poz. 1 | Next.js + shadcn/ui + komponenty Medplum | React 19 + Vite + własne komponenty (te same tokeny wyglądu w aplikacji mobilnej) | Kontynuacja wersji bazowej (PR #2); ten sam TypeScript, bez zmiany funkcji. Przejście na Next.js nie zmienia API serwera. |
| poz. 4–6 | Medplum u nas (dane, uprawnienia, dziennik, logowanie) | repozytorium FHIR za interfejsem: lokalne (SQLite) **albo** Medplum (`FHIR_BACKEND=medplum`); uprawnienia, zgody i dziennik w serwerze aplikacji | Działa bez zewnętrznej usługi (pilotaż, demo, testy); z Medplum dane kliniczne trafiają do Medplum bez zmian w kodzie domeny. |
| poz. 5 (D50) | pilotaż: logowanie Medplum; MVP-1: Cognito albo Keycloak | własne logowanie (hasło scrypt, TOTP, WebAuthn, link z e-maila, kody odzyskiwania) + OIDC dla zewnętrznej usługi tożsamości | OIDC pozwala podłączyć Cognito/Keycloak/Entra bez zmiany aplikacji, gdy zapadnie decyzja D50. |
| poz. 7 (D48), 9 (D51), 10 (D52) | wybór testem | wszyscy kandydaci zaimplementowani, wybór zmienną środowiskową (`STT_PROVIDER`, `OCR_PROVIDER`, `VIDEO_PROVIDER`) | Test 20 nagrań / 100 wyników wymaga kluczy i danych testowych — po teście zmiana bez wdrożenia kodu. |
| poz. 13 | ECharts + Playwright | wykresy SVG generowane w serwerze i w przeglądarce + Playwright (Chromium) do PDF | Mniej zależności; ten sam silnik PDF. |
| poz. 17 | Sentry | Sentry przez protokół „envelope” bez SDK, z odrzuceniem DSN spoza UE | Pełna kontrola nad tym, co opuszcza serwer (żadnych danych żądań). |
| poz. 18 | Langfuse + promptfoo (MVP-1) | rejestr wywołań i wersji poleceń w bazie, zestawy testowe w repozytorium | Langfuse/promptfoo — przy MVP-1 zgodnie z A7; rejestr już zbiera te same pola. |
| poz. 20 | plik / tabela konfiguracji | tabela konfiguracji z rejestrem modułów i wdrożeniem procentowym | Zgodnie z A7 dla MVP-1 i MVP. |
| D54 | pilotaż bez aplikacji mobilnej | strona pod linkiem w pilotażu **i** aplikacja Expo dla MVP | Aplikacja nie jest wymagana w pilotażu — pacjent korzysta z linku; aplikacja gotowa na etap MVP. |
| F3.3 | Tesseract 5 | pdf.js (warstwa tekstowa) + Mistral OCR / Google Document AI | A7 poz. 9 (D51) zastępuje Tesseract. |
| F1.4 | kody „szyfrowane AES-256” | skróty SHA-256 kodów | Kodów nie trzeba odszyfrowywać — skrót jest bezpieczniejszy niż szyfrowanie odwracalne. |
| F1.8 | Twilio | SMSAPI.pl albo własna bramka | A7 poz. 11. |
| F3.6 | alert poza normą | powiadomienie tylko o oznaczeniach wydrukowanych przez laboratorium | Ocena wyniku przez aplikację byłaby funkcją wyrobu medycznego (`COMPLIANCE.md` §1). |

## Decyzje konfigurowalne (A9)

| Decyzja | Zmienna / miejsce |
|---|---|
| D48 mowa na tekst | `STT_PROVIDER=elevenlabs|azure|openai` (+ klucze, adresy z rezydencją UE) |
| D49 system gabinetowy | układ pól `ehrLayout` w ustawieniach kliniki (ogólny / SOAP), kopiowanie pól i PDF |
| D50 tożsamość | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_LABEL` |
| D51 odczyt dokumentów | `OCR_PROVIDER=mistral|google` |
| D52 wideo | `VIDEO_PROVIDER=whereby|jitsi`, `WHEREBY_API_KEY` |
| D53 czat wiedzy | poza zakresem (MVP-2/MLP) |
| D54 pilotaż bez aplikacji | moduły P* wyłączone (`set-module patient-intake off` itd.), pacjent przez link |
