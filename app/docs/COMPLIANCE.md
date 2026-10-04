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
| Triage, rekomendacje, AI | brak; wywiad przed wizytą trafia do lekarza bez automatycznej analizy |
| Obliczenia kliniczne (dawki, ryzyko) | brak; lista leków bez sprawdzania interakcji (komunikat w interfejsie) |

Komunikaty „Aplikacja nie ocenia wyników i nie zastępuje porady lekarza” oraz „w nagłym przypadku dzwoń 112”
są stałym elementem interfejsu. ⚠️ Dodanie którejkolwiek funkcji z lewej kolumny wymaga ponownej analizy
kwalifikacji (reguła 11 MDR) i — w razie potrzeby — procesu oceny zgodności (IEC 62304, ISO 14971, IEC 82304-1).

**AI Act (2024/1689):** aplikacja nie zawiera systemów AI.

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
| Usunięcie danych (art. 17) z uwzględnieniem obowiązku przechowywania | wniosek o usunięcie konta → zamknięcie dostępu i danych logowania; dokumentacja medyczna pozostaje (art. 17 ust. 3 lit. b i c) |
| Przetwarzanie przez podmioty trzecie (art. 28) | ⚠️ umowy powierzenia: hosting, Medplum (jeśli używany), dostawca SMTP, SMS, serwer Jitsi; preferowany hosting w EOG |
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
własnych danych, rejestr dostępu widoczny dla pacjenta, fasada `/fhir/R4`. ⚠️ Jeżeli produkt będzie
oferowany jako system EHR, konieczna będzie ocena wymagań zasadniczych (załącznik II) i europejskiego formatu
wymiany, gdy zostanie opublikowany w aktach wykonawczych.

## 7. Dostępność cyfrowa

Interfejs projektowany pod WCAG 2.1 AA (EN 301 549): kontrast tekstu ≥ 4,5:1, pełna obsługa klawiaturą
(w tym wykres — strzałki), etykiety pól i komunikaty błędów powiązane `aria-describedby`, regiony `aria-live`
dla zmian na żywo, link „przejdź do treści”, cele dotykowe ≥ 44 px, `prefers-reduced-motion`, tryb ciemny,
tabelaryczna alternatywa wykresu. ⚠️ Podmioty publiczne: deklaracja dostępności i audyt (ustawa o dostępności
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
