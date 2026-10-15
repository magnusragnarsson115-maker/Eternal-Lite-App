# Eternal — mapa zgodności regulacyjnej

Dokument techniczny: jak rozwiązania w kodzie odpowiadają wymaganiom prawnym i oczekiwaniom instytucji
(NFZ, CeZ, UODO, URPL, audytorzy bezpieczeństwa). **Nie jest opinią prawną.** Formalną dokumentację
(DPIA, analizę kwalifikacji MDR, rejestr czynności przetwarzania, politykę bezpieczeństwa) przygotuj
w Systemie 2 tego repozytorium (`/dokument`) i zweryfikuj z prawnikiem oraz IOD placówki.

Stan wiedzy: październik 2026. Pozycje oznaczone ⚠️ wymagają działań organizacyjnych placówki lub dalszego rozwoju.

---

## 1. Przeznaczenie i kwalifikacja jako wyrób medyczny (MDR 2017/745)

**Deklarowane przeznaczenie:** oprogramowanie do organizacji opieki i komunikacji między pacjentem a placówką:
rezerwacja wizyt, przypomnienia, przekazywanie pacjentowi dokumentacji sporządzonej przez placówkę,
bezpieczne wiadomości, prowadzenie przez pacjenta dzienniczka pomiarów i listy leków, dostęp do danych publicznych NFZ.

Zgodnie z wytycznymi **MDCG 2019-11** (kwalifikacja i klasyfikacja oprogramowania) oprogramowanie, które
wyłącznie przechowuje, archiwizuje, przesyła i wyświetla dane bez ich przetwarzania w celu diagnostycznym
lub terapeutycznym, co do zasady nie jest wyrobem medycznym. Kod został zaprojektowany tak, by tej granicy nie przekraczać:

| Świadomie pominięte (zmieniłoby kwalifikację) | Jak to rozwiązano |
|---|---|
| Interpretacja wyników, kolorowanie „poza normą” | wyświetlamy wartość, jednostkę, **zakres i oznaczenie przepisane z laboratorium** z podpisem „oznaczenie laboratorium”; brak własnych progów (`records.ts`, `RecordPages.tsx`) |
| Alarmy i progi dla pomiarów domowych | brak progów i powiadomień o wartościach; zakresy w `observations.ts` służą wyłącznie kontroli literówek przy wprowadzaniu |
| Triage, rekomendacje, ocena stanu zdrowia przez AI | brak; wywiad przed wizytą trafia do lekarza bez automatycznej analizy. AI w pilotażu (niżej) tylko **przepisuje i porządkuje** treść: rozmowę w szkic notatki, dokument w pola do potwierdzenia, zatwierdzoną notatkę w kartę dla pacjenta — model nie dostaje zadań oceny (`server/ai/prompts.ts`) |
| Alert „parametr poza normą” (F3.6) | powiadomienie wyłącznie o **oznaczeniu wydrukowanym przez laboratorium** (H/L) w dokumencie pacjenta — aplikacja nie porównuje wartości z normą |
| Raport faktów dla lekarza (D3) | tylko wartości potwierdzone, z datą, jednostką, zakresem i oznaczeniem z dokumentu, z odnośnikiem do źródła; bez wniosków, sortowania „nieprawidłowe najpierw” ani wyróżnień |
| Obliczenia kliniczne (dawki, ryzyko) | brak; lista leków bez sprawdzania interakcji (komunikat w interfejsie) |
| Ankiety pacjenta (A12.3): na start, po wynikach, kontrolna, ocena aplikacji | zbierają informacje od pacjenta — bez punktacji, triażu, progów i wniosków; odpowiedzi zdrowotne zostają w sejfie pacjenta (lekarz widzi je tylko przy udostępnieniu, w raporcie faktów „przepisane bez zmian i bez oceny”); pytanie do lekarza wysyłane tylko na wyraźne życzenie pacjenta; słowa kryzysowe w odpowiedziach → numery pomocy (F8.1); ocena aplikacji anonimowa, identyfikatory usuwane z tekstu (`surveys.ts`) |
| Statystyki pomiarów domowych w pulpicie i raporcie okresowym (A3.1, A4.1, A4.2) | wyłącznie statystyka opisowa: liczba, najniższa i najwyższa wartość, średnia arytmetyczna z okresu z opisaną metodą, osobno dla rodzaju, jednostki i źródła (bez łączenia urządzeń); bez progów, porównań z normą, trendów „rośnie/spada”, kolorów i wyróżnień; wykres bez pasów norm (`periodReport.ts`, test słów oceniających). ⚠️ uwzględnij w analizie kwalifikacji MDR |

Komunikaty „Aplikacja nie ocenia wyników i nie zastępuje porady lekarza” oraz „w nagłym przypadku dzwoń 112”
są stałym elementem interfejsu. ⚠️ Dodanie którejkolwiek funkcji z lewej kolumny wymaga ponownej analizy
kwalifikacji (reguła 11 MDR) i — w razie potrzeby — procesu oceny zgodności (IEC 62304, ISO 14971, IEC 82304-1).

**AI Act (2024/1689):** od wersji pilotażowej aplikacja korzysta z modeli językowych i mowy na tekst
(Eternal Scribe, odczyt dokumentów, karta „Po wizycie”). Rozwiązania w kodzie:

| Obszar | Realizacja |
|---|---|
| Przejrzystość, oznaczanie treści (art. 50) | „odczyt maszynowy”, „przygotowane przez AI, zatwierdzone przez lekarza” w interfejsie, w PDF i w FHIR (`TAG_AI_ASSISTED`, znaczniki zaufania, `Provenance` z modelem i wersją polecenia); tekst o AI dla pacjenta w wersji (`AI_NOTICE`) |
| Nadzór człowieka | każda notatka i karta wymaga zatwierdzenia lekarza; każde pole odczytu — potwierdzenia pacjenta albo lekarza; niepotwierdzone pola są oddzielone w raporcie |
| Wierność źródłu | walidator deterministyczny (liczby i kody z akapitu muszą wystąpić we wskazanych fragmentach rozmowy) + walidator modelowy; model odczytu może wskazać tylko wartość obecną w tekście danej linii |
| Rejestr zastosowań i zapytań (A19.6) | `ai_call`: zadanie, wersja polecenia, dostawca, model, czas — **bez treści medycznej**; panel „Rejestr AI” |
| Minimalizacja | PESEL, e-maile i telefony usuwane z tekstu przed wysłaniem do modelu (`server/lib/redact.ts`); dostawcy wyłącznie z przetwarzaniem w UE (`docs/VENDORS.md`) |
| Kompetencje w zakresie AI (art. 4) | ⚠️ obowiązek placówki jako podmiotu stosującego — krótkie szkolenie personelu przed pilotażem |

⚠️ Kwalifikacja Scribe i odczytu dokumentów (MDR reguła 11 / AI Act art. 6) wymaga formalnej analizy — przygotuj ją
przez `/dokument` z udziałem `ekspert-prawno-regulacyjny`; zweryfikuj aktualne terminy stosowania przepisów AI Act.

### Funkcje pilotażu i MVP — ochrona danych w kodzie

| Funkcja | Realizacja |
|---|---|
| Link z SMS (D1) | token jednorazowy (skrót w bazie), ważny do wizyty + okres z ustawień; zgoda z wersją tekstu przed wgraniem; udostępnienie wygasa automatycznie; wycofanie zgody natychmiast odbiera dostęp i unieważnia link; treść SMS bez danych o zdrowiu |
| Sejf pacjenta | dane wniesione przez pacjenta są oddzielone od dokumentacji kliniki; klinika czyta je tylko przy aktywnym udostępnieniu (zakres × odbiorca × czas), każdy odczyt trafia do dziennika widocznego dla pacjenta |
| Nagranie wizyty (D5) | zgoda pacjenta zapisana jako `Consent` z datą przed nagraniem; nagranie i transkrypcja usuwane N dni po zatwierdzeniu (`recordingRetentionDays`); recepcja nie ma dostępu |
| Przekazanie karty osobie upoważnionej | wymagana podstawa: upoważnienie pacjenta albo art. 31 ust. 6 ustawy o zawodach lekarza; zapis w dzienniku |
| SOS (P14) | SMS do osób bliskich bez danych o zdrowiu; karta ratunkowa ważna 24 h, każde otwarcie w dzienniku pacjenta |
| Usunięcie danych (A18.12) | usunięcie sejfu, plików, udostępnień, linków i konta; potwierdzenie (PDF) z listą: co usunięto, co zostaje w placówkach (art. 29 ustawy o prawach pacjenta) i w dzienniku, kiedy dane znikną z kopii |
| Dane syntetyczne (D5.3) | wyłącznie osoby fikcyjne bez PESEL, każde uruchomienie z celem w dzienniku |
| Aplikacja mobilna | na telefonie tylko token sesji i skrót PIN-u w Keychain/Keystore (bez kopii zapasowej); brak danych medycznych w pamięci urządzenia; blokada biometrią/PIN-em |
| Profile rodzinne i dostęp opiekuna (A24.1, A24.2) | podstawa działania w imieniu innej osoby zapisana jako oświadczenie z wersją (`opiekun/2026-10-1`: władza rodzicielska, opiekun prawny, pisemne upoważnienie); władza rodzicielska wygasa z pełnoletnością — dostęp rodzica kończy się automatycznie w dniu 18. urodzin; dorosły z kontem nadaje dostęp sam i odbiera go jednym ruchem; w trybie opiekuna niedostępne: ankiety, SOS, ustawienia konta, usunięcie danych; zgody i udostępnienia dorosłego zmienia tylko on; każdy dostęp opiekuna w dzienniku profilu („… (opiekun)”); profil dziecka widoczny w placówkach rodzica (imię, data urodzenia), dane o zdrowiu w sejfie profilu ⚠️ forma oświadczeń do weryfikacji przez prawnika (art. 9, 26 ustawy o prawach pacjenta; art. 95–98 KRO) |
| Dostęp ratunkowy (A24.5) | przesłanka: art. 9 ust. 2 lit. c RODO (żywotne interesy, osoba niezdolna do wyrażenia zgody) i art. 26 ust. 3 ustawy o prawach pacjenta; tylko lekarz, 60 min, powód + uzasadnienie, powiadomienie pacjenta, ocena administratora, „nieuzasadniony” → zgłoszenie możliwego naruszenia (art. 33 RODO, 72 h) |
| Dzienniki nastroju, snu i bólu | dane o zdrowiu psychicznym — w sejfie pacjenta, bez analizy i bez alarmów dla placówki (brak funkcji wyrobu medycznego); numery 116 123 i 112 zawsze na stronie, okno z numerami przy nastroju ≤ 2 albo słowach kryzysowych |
| Kalendarz w zewnętrznej aplikacji (ICS) | do kalendarza Google/Apple/Outlook trafiają tylko ogólne nazwy („Wizyta (Eternal)”) — bez nazwy usługi, lekarza, szczepionki i leku; prywatny adres można unieważnić; każde pobranie w dzienniku |
| Dyspozycje i oświadczenie woli (A22.5) | wyłącznie informacja dla bliskich i ratowników; aplikacja mówi wprost, że nie zastępuje sprzeciwu w Centralnym Rejestrze Sprzeciwów, upoważnienia w placówce ani pełnomocnictwa |
| Raport dla lekarza (SBAR) i plik FHIR | część „A” zawiera tylko dane — oceny dokonuje lekarz; zakres referencyjny wyłącznie z dokumentu laboratorium; test pilnuje braku słów oceniających |
| Logowanie z nowego urządzenia | powiadomienie i e-mail bez danych o zdrowiu; reguła (urządzenie × sieć), nie profilowanie |

## 2. RODO (2016/679) i ochrona danych

| Wymóg | Realizacja w kodzie |
|---|---|
| Podstawa przetwarzania danych o zdrowiu (art. 9 ust. 2 lit. h) | kartoteka i dokumentacja w ramach udzielania świadczeń; zgody zbierane osobno wyłącznie dla funkcji dobrowolnych |
| Zgody dobrowolne, granularne, możliwe do wycofania i wykazania (art. 7) | `Consent` FHIR per rodzaj (wyniki online, e-mail, SMS, push, teleporady, udostępnianie pomiarów), domyślnie odznaczone, wersja treści (`CONSENT_POLICY_VERSION`), pełna historia wersji zasobu, wpis w dzienniku |
| Obowiązek informacyjny (art. 13) | akceptacja informacji przy rejestracji; kontakt do IOD w ustawieniach placówki i interfejsie |
| Prawo dostępu i przenoszenia (art. 15, 20) | eksport `Bundle` FHIR R4 (JSON) z danymi, dokumentami, plikami i historią dostępu — przycisk w „Prywatność i zgody” |
| Minimalizacja (art. 5 ust. 1 lit. c) | treść e-mail/SMS/push bez danych o zdrowiu (bez nazwy usługi i lekarza); recepcja widzi PESEL zamaskowany i nie ma dostępu do treści klinicznej |
| Rozliczalność i bezpieczeństwo (art. 5 ust. 2, art. 32) | dziennik zdarzeń append-only z łańcuchem HMAC (`audit.ts`), weryfikacja integralności w panelu i CLI; MFA dla personelu; szyfrowane hasła (scrypt); sesje z limitem bezczynności; CSRF; CSP; limity prób logowania; walidacja plików (sygnatura) |
| Przejrzystość wobec pacjenta | **historia dostępu do danych** w aplikacji pacjenta: kto (rola), kiedy, jaka czynność |
| Usunięcie danych (art. 17) z uwzględnieniem obowiązku przechowywania | „Usuń moje dane” z potwierdzeniem (A18.12): dane wniesione przez pacjenta usuwane trwale, dokumentacja medyczna placówek pozostaje (art. 17 ust. 3 lit. b i c) — pacjent dostaje wykaz |
| Przetwarzanie przez podmioty trzecie (art. 28) | ⚠️ umowy powierzenia: hosting, Medplum (jeśli używany), dostawca SMTP, SMS, serwer Jitsi, dostawcy AI/OCR/mowy/wideo — rejestr i wymagane regiony: [`VENDORS.md`](VENDORS.md); preferowany hosting w EOG |
| DPIA (art. 35) | ⚠️ wymagana — przetwarzanie danych o zdrowiu na dużą skalę (lista UODO); przygotuj przed uruchomieniem |
| Transfery poza EOG | publiczne API bez danych osobowych (NFZ, NLM: wyłącznie hasła wyszukiwania; HIBP: 5 znaków skrótu hasła); meet.jit.si wyłącznie do testów |

## 3. Prawo krajowe — dokumentacja medyczna i prawa pacjenta

| Akt | Wymóg | Realizacja |
|---|---|---|
| Ustawa o prawach pacjenta i RPP — udostępnianie dokumentacji | udostępnianie pacjentowi dokumentacji, m.in. w postaci elektronicznej | udostępnianie wyników i dokumentów w aplikacji po potwierdzeniu tożsamości i na wniosek pacjenta (zgoda „wyniki online”); potwierdzenie odczytu |
| Ustawa o prawach pacjenta — przechowywanie (art. 29) | co do zasady 20 lat od ostatniego wpisu | brak fizycznego usuwania: usunięcia logiczne, historia wersji (`fhir_history`), zamknięcie konta nie usuwa dokumentacji |
| Rozporządzenie MZ w sprawie dokumentacji medycznej (2020) | integralność, autentyczność, dostęp tylko dla uprawnionych, rejestrowanie dostępu, kopie zapasowe | role i zasada najmniejszych uprawnień, dziennik zdarzeń każdego odczytu, wersjonowanie, `npm run cli -- backup` (⚠️ harmonogram kopii, szyfrowanie i test odtworzenia po stronie placówki) |
| Tajemnica lekarska | ograniczenie kręgu osób z dostępem | recepcja bez dostępu do wyników, pomiarów i wywiadu; pacjent widzi wyłącznie własny przedział danych (także przez API FHIR — testy `api.test.ts`) |
| Identyfikacja pacjenta | wiarygodne powiązanie konta z kartoteką | kod aktywacyjny wydawany po okazaniu dokumentu + data urodzenia; rejestracja z PESEL istniejącym w kartotece jest blokowana (ochrona przed przejęciem kartoteki) |

## 4. System informacji w ochronie zdrowia — Platforma P1 ⚠️

- **Centralna e-Rejestracja (CeR):** od 1 stycznia 2026 r. obowiązuje dla wybranych świadczeń finansowanych przez NFZ
  (kardiologia, profilaktyka raka piersi — mammografia, profilaktyka raka szyjki macicy — cytologia/HPV), a od
  1 lipca 2026 r. placówki realizujące te świadczenia muszą być z nią zintegrowane i synchronizować terminy na bieżąco.
  **Ta wersja nie integruje się z CeR.** Placówka z umową NFZ w tym zakresie musi korzystać z systemu
  zintegrowanego z P1 albo zlecić rozwój integracji (certyfikat placówki, środowisko testowe CeZ).
- **EDM / indeksowanie dokumentacji w P1, e-skierowanie, e-recepta:** poza zakresem. Model danych (FHIR R4,
  identyfikator PESEL z OID CeZ) ułatwia rozbudowę, ale integracja wymaga certyfikacji.
- **Węzeł Krajowy (login.gov.pl):** możliwy kolejny etap dla zdalnego potwierdzania tożsamości.

## 5. Cyberbezpieczeństwo — NIS2 / ustawa o KSC

Nowelizacja ustawy o krajowym systemie cyberbezpieczeństwa wdrażająca NIS2 obowiązuje od 3 kwietnia 2026 r.;
podmioty objęte ustawą składają wniosek o wpis do wykazu do 3 października 2026 r. i dostosowują się do wymagań
do 3 kwietnia 2027 r. Zakres podmiotowy (czy dana placówka jest podmiotem kluczowym/ważnym) zależy od jej
rodzaju i wielkości — ⚠️ do oceny przez placówkę.

Elementy techniczne wspierające wymagania zarządzania ryzykiem:

- MFA obowiązkowe dla personelu, ochrona przed ponownym użyciem kodu TOTP, blokada po serii nieudanych logowań,
  sprawdzanie haseł w bazie wycieków (k-anonimowość);
- dziennik zdarzeń bezpieczeństwa (logowania, nieudane próby, zmiany uprawnień, odczyty danych) z wykrywaniem modyfikacji;
- nagłówki bezpieczeństwa (CSP bez `unsafe-inline` dla skryptów, HSTS, `frame-ancestors 'none'`, Permissions-Policy),
  ciasteczka `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, token CSRF i weryfikacja pochodzenia żądań;
- podpisy HMAC i ochrona przed powtórzeniem dla webhooków integracji;
- brak zależności natywnych; obraz kontenera uruchamiany jako użytkownik bez uprawnień.

⚠️ Po stronie placówki: test penetracyjny przed uruchomieniem, monitorowanie i reagowanie na incydenty
(zgłaszanie do CSIRT), zarządzanie podatnościami zależności, plan ciągłości działania.

## 6. Europejska przestrzeń danych dotyczących zdrowia (EHDS, rozporządzenie 2025/327)

Rozporządzenie weszło w życie 26 marca 2025 r.; przepisy ogólne stosuje się od 26 marca 2027 r., a wymagania
dla systemów EHR (zharmonizowane komponenty: interoperacyjność i rejestrowanie zdarzeń) — etapami od 2029 r.
Projekt jest zgodny z kierunkiem rozporządzenia: dane w FHIR R4, eksport dla pacjenta, dostęp pacjenta do
własnych danych, rejestr dostępu widoczny dla pacjenta, fasada `/fhir/R4`. Raport dla lekarza jest też
dostępny jako dokument FHIR (Bundle „document” z Composition, LOINC 60591-5 — zbliżony do podsumowania pacjenta),
a eksport RODO obejmuje cały sejf pacjenta. Prawo sprzeciwu wobec wtórnego wykorzystania (art. 71) — rejestr
sprzeciwów jest gotowy (zgoda `secondary-use-objection` z historią); Eternal nie udostępnia dziś danych do celów
wtórnych. ⚠️ Jeżeli produkt będzie
oferowany jako system EHR, konieczna będzie ocena wymagań zasadniczych (załącznik II) i europejskiego formatu
wymiany, gdy zostanie opublikowany w aktach wykonawczych.

## 7. Dostępność cyfrowa

Interfejs projektowany pod WCAG 2.1 AA (EN 301 549): kontrast tekstu ≥ 4,5:1, pełna obsługa klawiaturą
(w tym wykres — strzałki), etykiety pól i komunikaty błędów powiązane `aria-describedby`, regiony `aria-live`
dla zmian na żywo, link „przejdź do treści”, cele dotykowe ≥ 44 px, `prefers-reduced-motion`, tryb ciemny,
tabelaryczna alternatywa wykresu. Ustawienia czytelności zapisane na koncie (A23.2/A23.3, wspólne dla
przeglądarki i aplikacji mobilnej): rozmiar tekstu 100–200% bez poziomego przewijania (WCAG 1.4.4, 1.4.10 — przy 150%
i 200% układ jednokolumnowy), wysoki kontrast (czerń/biel, linki podkreślone, obramowania 2 px; także automatycznie
według `prefers-contrast` / „Zwiększ kontrast” w telefonie), tryb prostego języka dla kluczowych tekstów z przyciskiem
„Pokaż pełny opis” (test: każde zdanie ≤ 16 słów, zastrzeżenia zachowane). ⚠️ Prosty język wymaga przeglądu
redakcyjnego (najlepiej testu z udziałem seniorów) przed wdrożeniem. ⚠️ Podmioty publiczne: deklaracja dostępności i audyt (ustawa o dostępności
cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych).

## 8. Teleporady

Połączenie wideo przez Jitsi Meet w przeglądarce; pokój o losowym identyfikatorze 128-bit, otwierany od 15 min przed
wizytą; dla własnej instancji tokeny JWT (lekarz jako moderator); nagrywanie wyłączone. ⚠️ Produkcyjnie
wymagany własny serwer Jitsi w EOG z umową powierzenia; w POZ finansowanej przez NFZ obowiązuje standard
organizacyjny teleporady (m.in. weryfikacja tożsamości pacjenta na początku teleporady).

## 9. Lista kontrolna przed uruchomieniem produkcyjnym

- [ ] DPIA, rejestr czynności przetwarzania, aktualizacja klauzul informacyjnych
- [ ] umowy powierzenia: hosting, SMTP, SMS, Jitsi, Medplum (jeśli dotyczy)
- [ ] `DEMO_MODE=false`, `PUBLIC_URL` z HTTPS, `AUDIT_HMAC_KEY` z menedżera sekretów, `TRUST_PROXY` zgodnie z infrastrukturą
- [ ] własny serwer Jitsi (`JITSI_DOMAIN`, `JITSI_APP_ID/SECRET`)
- [ ] SMTP (weryfikacja e-mail, reset hasła, przypomnienia); opcjonalnie SMS
- [ ] kopie zapasowe: harmonogram `backup`, szyfrowanie, test odtworzenia, przechowywanie poza serwerem
- [ ] test penetracyjny, skan zależności (`npm audit`), procedura obsługi incydentów
- [ ] konta personelu z MFA, przegląd ról (lekarz / rejestracja / administrator)
- [ ] import Rejestru Produktów Leczniczych (`import-rpl`) i test integracji w panelu
- [ ] decyzja dot. CeR/P1 dla świadczeń NFZ objętych centralną e-rejestracją
- [ ] regulamin świadczenia usług drogą elektroniczną (ustawa o świadczeniu usług drogą elektroniczną)
- [ ] pilotaż i MVP: umowy powierzenia z dostawcami AI, OCR, mowy na tekst i wideo (region UE, brak retencji treści) — `VENDORS.md`
- [ ] testy wyboru dostawców D48 (20 nagrań) i D51 (100 wyników); zestaw testowy: `npm run cli -- synthetic --pdf <katalog>`
- [ ] szkolenie personelu z korzystania z AI (art. 4 AI Act); procedura zatwierdzania notatek i kart
- [ ] `SECURITY_CONTACT`, `SENTRY_DSN` w regionie UE (opcjonalnie), Dependabot i skan Trivy włączone; przegląd OWASP ASVS poziom 1
- [ ] potwierdzenie godzin działania numerów pomocowych (116 123) przed wydaniem
- [ ] aplikacja mobilna: development build i test biometrii/PIN na urządzeniach, opis prywatności w sklepach, `MOBILE_MIN_VERSION`
