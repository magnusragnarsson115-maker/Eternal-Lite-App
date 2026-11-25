# Integracje zewnętrzne

Wszystkie integracje są opcjonalne — aplikacja działa w pełni bez nich (lokalny magazyn FHIR, powiadomienia w aplikacji).
Status połączeń i test na żywo: panel **Administracja → Integracje → Sprawdź połączenia**.

Wybór dostawców dla wszystkich funkcji MVP z pliku 11.1 na etapach Demo / MVP / MLP / FINAL (open source, bezpłatne,
płatne, uzasadnienie, koszty, źródła; stan rynku 10.2026): [`ETERNAL_11_1_WYBOR_ROZWIAZAN.xlsx`](ETERNAL_11_1_WYBOR_ROZWIAZAN.xlsx).

**Legenda testów:** ✅ test automatyczny na danych przykładowych · 🌐 test połączenia na żywo wymaga dostępu do internetu
(środowisko, w którym zbudowano tę wersję, blokowało ruch wychodzący do usług zewnętrznych).

| Integracja | Koszt | Konfiguracja | Testy | Jakie dane opuszczają serwer |
|---|---|---|---|---|
| Lokalny magazyn FHIR R4 | bezpłatny | `FHIR_BACKEND=local` | ✅ | — |
| **Medplum** | bezpłatny plan deweloperski / instancja własna (open source) | `FHIR_BACKEND=medplum`, `MEDPLUM_*` | ✅ walidacja i mapowanie, 🌐 połączenie | pełne dane kliniczne (repozytorium) — umowa powierzenia |
| Dowolny serwer FHIR R4 (HAPI, Azure, Google, Aidbox) | zależnie od dostawcy | `FHIR_BACKEND=fhir`, `FHIR_*` | ✅, 🌐 | jak wyżej |
| **NFZ — Terminy Leczenia** | bezpłatne, bez klucza | `NFZ_API_ENABLED` | ✅ mapowanie, 🌐 | nazwa świadczenia, województwo, miejscowość (bez danych pacjenta) |
| **Rejestr Produktów Leczniczych** | bezpłatny eksport XML | `npm run cli -- import-rpl` | ✅ parser | nic — wyszukiwanie lokalne |
| **NLM Clinical Tables** (LOINC, ICD-10-CM) | bezpłatne, bez klucza | `NLM_API_ENABLED` | ✅ parser, 🌐 | hasło wyszukiwania wpisane przez personel |
| **WHO ICD-11 API** | bezpłatne po rejestracji | `ICD11_CLIENT_ID/SECRET` | 🌐 | hasło wyszukiwania |
| **Have I Been Pwned** (hasła) | bezpłatne, bez klucza | `HIBP_ENABLED` | 🌐 | 5 znaków skrótu SHA-1 hasła (k-anonimowość) |
| **Web Bluetooth (GATT)** | bezpłatne | — | ✅ parsery 6 profili (+ PLX ciągły, RACP glukometru) | nic — odczyt w przeglądarce pacjenta |
| **Rejestr Aptek (CeZ)** | bezpłatny eksport CSV | `npm run cli -- import-pharmacies <plik.csv>` | ✅ import i wyszukiwanie | nic — wyszukiwanie lokalne |
| **Obwieszczenie refundacyjne MZ** | bezpłatne (arkusze jako CSV) | `npm run cli -- import-refund <plik.csv> --list A1 --title … --valid-from …` | ✅ import i wyszukiwanie | nic — wyszukiwanie lokalne |
| **Klasyfikacja ICD-10 (wydanie polskie)** | bezpłatny słownik | `npm run cli -- import-icd10 <plik.csv>` | ✅ import, lista wbudowana | nic |
| **GIOŚ — jakość powietrza (PJP API v1)** | bezpłatne, bez klucza | `GIOS_API_ENABLED` | ✅ format i najbliższa stacja, 🌐 | numer stacji (bez położenia pacjenta) |
| **IMGW-PIB — dane synoptyczne** | bezpłatne, bez klucza | `IMGW_API_ENABLED` | ✅ format, 🌐 | nic poza zapytaniem o listę stacji |
| **Open Food Facts** | bezpłatne, bez klucza | `OFF_API_ENABLED` | ✅ format, 🌐 | kod kreskowy albo nazwa produktu |
| **Apple HealthKit / Health Connect** | bezpłatne (konto deweloperskie) | aplikacja mobilna (development build EAS) | ✅ typy, 🌐 test na telefonie | nic do dostawcy — odczyt na telefonie, wysyłka do naszego serwera |
| **Withings** | bezpłatne konto deweloperskie | `WITHINGS_CLIENT_ID/SECRET` | ✅ mapowanie pomiarów i snu, 🌐 OAuth | token OAuth pacjenta; pobierane są pomiary i podsumowania snu |
| **Vitalera / platformy RPM** | umowa partnerska | `RPM_WEBHOOK_SECRETS` | ✅ podpis, mapowanie, deduplikacja | nic — platforma wysyła dane do nas |
| **Jitsi Meet** | bezpłatne (open source) | `JITSI_DOMAIN`, `JITSI_APP_ID/SECRET` | ✅ JWT i okno czasowe | strumień wideo do serwera Jitsi |
| **Web Push (VAPID)** | bezpłatne | opcjonalnie `VAPID_*` | — | tytuł i treść powiadomienia bez danych medycznych (przez usługę push przeglądarki) |
| **E-mail (SMTP)** | zależnie od dostawcy | `SMTP_URL`, `MAIL_FROM` | ✅ kolejka i zgody | adres e-mail, treść przypomnienia bez danych medycznych |
| **SMS** (SMSAPI.pl / własna bramka) | płatne | `SMS_PROVIDER`, `SMSAPI_TOKEN` / `SMS_WEBHOOK_URL` | ✅ normalizacja numerów | numer telefonu, treść przypomnienia bez danych medycznych |
| **Claude (Amazon Bedrock, UE)** / API Anthropic | płatne za użycie | `AI_PROVIDER=bedrock|anthropic`, `AWS_REGION` | ✅ tryb demo i schematy odpowiedzi, 🌐 | tekst rozmowy / dokumentu / notatki po usunięciu PESEL, e-maili i telefonów |
| **Mistral** (zapas modelu, OCR) | płatne za użycie | `AI_SECONDARY_PROVIDER=mistral`, `OCR_PROVIDER=mistral`, `MISTRAL_API_KEY` | 🌐 | jw. / obraz dokumentu |
| **Google Document AI** (OCR) | płatne za stronę | `OCR_PROVIDER=google`, `GOOGLE_DOCAI_*` | 🌐 | obraz lub PDF dokumentu |
| **ElevenLabs / Azure AI Speech / OpenAI** (mowa na tekst) | płatne za minutę | `STT_PROVIDER`, klucze, adresy z rezydencją UE | ✅ tryb demo, 🌐 | nagranie wizyty |
| **Whereby Embedded** (wideo) | abonament | `VIDEO_PROVIDER=whereby`, `WHEREBY_API_KEY` | ✅ poczekalnia, 🌐 tworzenie pokoju | strumień wideo; pokój z czasem wygaśnięcia |
| **OIDC** (Cognito, Keycloak, Entra — D50) | zależnie od usługi | `OIDC_ISSUER`, `OIDC_CLIENT_*` | 🌐 | adres e-mail z usługi tożsamości |
| **Expo Notifications** (push w aplikacji mobilnej) | bezpłatne | — (token z aplikacji) | ✅ rejestracja tokenu | tytuł i treść bez danych o zdrowiu |
| **Sentry** (błędy serwera, UE) | plan bezpłatny | `SENTRY_DSN` | — | typ błędu, kod, wzorzec trasy — bez treści i identyfikatorów |
| **Synthea** (dane syntetyczne) | bezpłatne (open source) | `npm run cli -- import-synthea` | — | nic — import plików lokalnych |
| Platforma P1 (CeR, EDM, e-skierowanie) | wymaga certyfikacji CeZ | — | — | nie zaimplementowano |
| Węzeł Krajowy (login.gov.pl) | wymaga porozumienia | — | — | nie zaimplementowano |

## Medplum

Adapter używa oficjalnego SDK `@medplum/core` (`MedplumClient`, OAuth2 client credentials z automatycznym odnawianiem).
Zasoby są walidowane lokalnie przed wysłaniem. Rezerwacja korzysta z warunkowej aktualizacji `If-Match` na `Slot`,
co Medplum obsługuje — gwarancja braku podwójnych rezerwacji jest zachowana także przy zdalnym repozytorium.

Ograniczenie: zmiany wprowadzone w Medplum z pominięciem Eternal (np. w Medplum App) nie generują zdarzeń
na żywo — widoki odświeżą się przy następnym pobraniu. Rozszerzenie: subskrypcje FHIR (WebSocket) Medplum.

## NFZ — Terminy Leczenia

`GET https://api.nfz.gov.pl/app-itl-api/queues` (`benefit`, `province`, `case` 1/2, `locality`, `format=json`,
`api-version=1.3`) i słownik świadczeń `/benefits`. Odpowiedzi są cache'owane 6 h. Interfejs informuje, że dane
przekazują świadczeniodawcy i mogą być nieaktualne.

## Rejestr Produktów Leczniczych

Oficjalny eksport: `https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/6.0.0/overall.xml`.
Import strumieniowy (plik kilkadziesiąt MB) do tabeli lokalnej; parser obsługuje warianty z atrybutami
i z elementami potomnymi. Zalecany import cykliczny (np. raz na dobę, cron).

## Vitalera i inne platformy RPM

Vitalera nie publikuje otwartego API — dostęp na podstawie umowy partnerskiej. Eternal udostępnia ustandaryzowany
punkt odbioru, który platforma może wywoływać po stronie serwera:

```
POST {PUBLIC_URL}/api/integrations/rpm/vitalera/webhook
Content-Type: application/fhir+json
X-Eternal-Timestamp: 1791100000
X-Eternal-Signature: sha256=<HMAC_SHA256(sekret, "<timestamp>.<body>")>

{ "resourceType": "Bundle", "type": "collection", "entry": [ { "resource": {
    "resourceType": "Observation", "id": "pomiar-123", "status": "final",
    "subject": { "identifier": { "system": "urn:oid:2.16.840.1.113883.3.4424.1.1.616", "value": "<PESEL>" } },
    "code": { "coding": [ { "system": "http://loinc.org", "code": "85354-9" } ] },
    "effectiveDateTime": "2026-10-04T07:30:00Z",
    "component": [
      { "code": { "coding": [ { "system": "http://loinc.org", "code": "8480-6" } ] }, "valueQuantity": { "value": 128, "unit": "mmHg" } },
      { "code": { "coding": [ { "system": "http://loinc.org", "code": "8462-4" } ] }, "valueQuantity": { "value": 82, "unit": "mmHg" } } ] } } ] }
```

- Pacjent: `subject.reference = Patient/{id w Eternal}` albo `subject.identifier` z numerem PESEL.
- Obsługiwane kody LOINC: panel ciśnienia `85354-9`/`55284-4`, tętno `8867-4`, masa ciała `29463-7`, wzrost `8302-2`,
  temperatura `8310-5`, SpO₂ `59408-5`/`2708-6`, glukoza `2339-0`/`15074-8`/`2345-7`; konwersja lb→kg, °F→°C, mmol/L→mg/dL.
- Odpowiedź: `{ accepted, rejected: [{ index, reason }] }`; ponowne wysłanie tego samego pomiaru jest ignorowane (deduplikacja po identyfikatorze).
- Okno czasowe podpisu ±5 min (ochrona przed powtórzeniem). Ten sam mechanizm pozwala podłączyć inne platformy (`RPM_WEBHOOK_SECRETS="vitalera:…,inna:…"`).

Format danych należy potwierdzić z Vitalerą przy zawieraniu umowy; jeśli platforma wysyła inny format niż FHIR,
wystarczy dopisać funkcję mapującą obok `mapRpmObservation` (`server/integrations/rpm.ts`).

## Web Bluetooth

Standardowe profile Bluetooth SIG (bez SDK producentów): Blood Pressure `0x1810`/`0x2A35`, Heart Rate `0x180D`/`0x2A37`,
Weight Scale `0x181D`/`0x2A9D`, Health Thermometer `0x1809`/`0x2A1C`, Pulse Oximeter `0x1822`/`0x2A5E`. Parsery
IEEE 11073 (SFLOAT/FLOAT, jednostki, znaczniki czasu) w `web/src/lib/ble.ts`. Działa w Chrome i Edge (Android,
Windows, macOS, ChromeOS); Safari/iOS nie obsługuje Web Bluetooth — tam pomiary wpisuje się ręcznie lub przez Withings.
Glukometr (`0x1808`/`0x2A18`): po włączeniu powiadomień aplikacja prosi przez RACP (`0x2A52`, `[0x01, 0x06]`) o ostatni
zapis; wartość zapisywana w mg/dL. Pulsoksymetry wysyłające tylko pomiar ciągły — `0x2A5F`. Przycisk „Połącz dowolne
urządzenie” rozpoznaje profil po usłudze GATT.

## Withings

OAuth 2.0 (`account.withings.com/oauth2_user/authorize2`, `wbsapi.withings.net/v2/oauth2`), pomiary
`wbsapi.withings.net/measure?action=getmeas` (typy 1, 4, 9, 10, 11, 54, 71; wartość = `value × 10^unit`).
Adres zwrotny do rejestracji aplikacji: `{PUBLIC_URL}/api/integrations/withings/callback`. Pacjent łączy konto
w „Pomiary”, import ręczny lub po połączeniu.

Sen (Withings Sleep i zegarki): `wbsapi.withings.net/v2/sleep?action=getsummary` z polami `total_sleep_time`,
`deepsleepduration`, `lightsleepduration`, `remsleepduration`, `wakeupduration` (sekundy) — wymaga zakresu
`user.activity`; konta połączone wcześniej trzeba połączyć ponownie.

## Rejestry publiczne (runda 4)

- **Rejestr Aptek** — eksport CSV z rejestrymedyczne.ezdrowie.gov.pl. Kolumny rozpoznawane po synonimach (nazwa,
  rodzaj, ulica, numer, kod, miejscowość, województwo, telefon, godziny, status, szerokość/długość geograficzna);
  apteki wykreślone, zawieszone i z cofniętym zezwoleniem są pomijane. Bez współrzędnych działa wyszukiwanie tekstowe.
- **Obwieszczenie refundacyjne** — plik XLSX z gov.pl zapisany jako CSV po jednym arkuszu (wykazy A1, A2, …);
  kolumny: substancja czynna, nazwa postać i dawka, zawartość opakowania, kod EAN, grupa limitowa, cena detaliczna,
  limit finansowania, zakres wskazań, wskazania pozarejestracyjne, poziom odpłatności, dopłata. Import nadpisuje dany
  wykaz; aktualizuj po każdym obwieszczeniu.
- **ICD-10** — dowolny CSV z kolumnami „kod” i „nazwa”; bez importu działa wbudowana lista najczęstszych rozpoznań.

## GIOŚ i IMGW (runda 4)

GIOŚ: `api.gios.gov.pl/pjp-api/v1/rest/station/findAll` (strony po 500, pola JSON-LD po polsku, współrzędne
`WGS84 φ N`/`λ E`) i `aqindex/getIndex/{id}` — kategoria ogólna i dla PM10, PM2.5, O3, NO2, SO2. Lista stacji w pamięci
podręcznej 24 h, indeks 20 min. IMGW: `danepubliczne.imgw.pl/api/data/synop` — temperatura, wilgotność, ciśnienie,
wiatr, opad, godzina pomiaru (UTC). Format według dokumentacji i wzorcowych odpowiedzi; w środowisku budowy hosty
były zablokowane, więc 🌐 test na żywo — po wdrożeniu. W trybie demo bez sieci: dane pokazowe z wyraźnym oznaczeniem.

## Partnerzy przez API — runda 5 (bez osadzanych widżetów)

Wszystkie klucze tylko w zmiennych środowiska serwera (nigdy w przeglądarce ani w aplikacji mobilnej). Stan każdej integracji:
panel administratora → Integracje oraz `npm run cli -- readiness`.

| Usługa | Co robi w Eternal | Zmienne | Koszt / dostęp (stan z listopada 2026, sprawdź przed umową) |
|---|---|---|---|
| **Amazon Textract** | OCR zdjęć i jednostronicowych skanów (DetectDocumentText), linie z położeniem do podświetlenia w oryginale; PDF z warstwą tekstu nadal czytany lokalnie (0 zł) | `OCR_PROVIDER=textract`, `AWS_REGION=eu-central-1`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (opcjonalnie `AWS_SESSION_TOKEN`) | darmowy pakiet nowych kont AWS: 1000 stron/mies. przez 3 miesiące; potem ok. 1,5 USD / 1000 stron (DetectDocumentText) |
| **ElevenLabs Scribe v2 Medical** | transkrypcja wizyty: mówcy (liczba z listy uczestników), znaczniki czasu słów, model medyczny | `STT_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, `ELEVENLABS_STT_MODEL=scribe_v2_medical`, `ELEVENLABS_KEYTERMS=on|off` (słownik leków i badań — dodatkowo płatny), `ELEVENLABS_ZERO_RETENTION=on|off` (plan firmowy) | cena jak Scribe v2; konto z kredytami (plan darmowy z małym limitem do testów); rezydencja UE |
| **Własny serwer Whisper** (bez kosztu licencji) | ta sama ścieżka co OpenAI STT — dowolny serwer zgodny z API OpenAI (np. faster-whisper) | `STT_PROVIDER=openai`, `OPENAI_BASE_URL=https://…/v1`, `OPENAI_API_KEY`, `OPENAI_STT_MODEL` | tylko koszt serwera (GPU zalecane); bez rozpoznawania mówców |
| **Validic Inform (REST v2)** | pacjent łączy urządzenia na stronie Validic Marketplace (link z API); Eternal pobiera pomiary, sen i kroki (`/organizations/{org}/users/{uid}/measurements|summaries|sleep`, zakres ≤ 31 dni), co 6 h w tle | `VALIDIC_ORG_ID`, `VALIDIC_TOKEN`, `VALIDIC_BASE_URL` | wersja próbna dla deweloperów; produkcja — umowa |
| **Docplanner / ZnanyLekarz (Integrations API v3)** | wolne terminy z kalendarza Eternal → ZnanyLekarz (`replaceSlots`), rezerwacje i odwołania → wizyty; mapowanie lekarzy, adresów i usług w panelu administratora; co 10 min w tle | `DOCPLANNER_CLIENT_ID`, `DOCPLANNER_CLIENT_SECRET`, `DOCPLANNER_DOMAIN` (domyślnie `https://www.znanylekarz.pl`) | klucze API tylko dla klientów Docplanner (panel → Integracje), bez dodatkowej opłaty za API według opisu dostawcy |
| **Infermedica Engine API v3** | wywiad z pytaniami silnika (`/parse`, `/diagnosis`) i triażem (`/triage`); w Eternal **zablokowany**, dopóki administrator nie zapisze referencji oceny zgodności MDR produktu | `INFERMEDICA_APP_ID`, `INFERMEDICA_APP_KEY`, `INFERMEDICA_BASE_URL`, `INFERMEDICA_MODEL` (opcjonalnie) | konto próbne do 2000 wywołań (zatwierdzane ręcznie), potem plan płatny; wyrób medyczny klasy IIb dostawcy |
| **Przeglądarka 3D badań obrazowych** (np. Avatar Medical Vision) | przycisk „Anatomia 3D z badań” w karcie pacjenta otwiera licencjonowaną przeglądarkę placówki | `IMAGING_VIEWER_URL` (szablon z `{patientId}` albo `{eternalId}`), `IMAGING_VIEWER_NAME` | licencja placówki; wyrób medyczny (CE/FDA) — Eternal tylko uruchamia link |
| **Vitalera** | bez zmian: webhook FHIR z podpisem HMAC (sekcja wyżej) | `RPM_WEBHOOK_SECRETS` | umowa partnerska |

Uwagi:
- W środowisku budowy strony dostawców (validic, docplanner, infermedica, elevenlabs, vitalera) były zablokowane w ustawieniach sieci —
  adaptery napisano według opublikowanych opisów API, a testy (`tests/unit/partners.test.ts`) sprawdzają zapytania i mapowanie na
  podstawionych odpowiedziach. Przed produkcją: test z kontem próbnym każdego dostawcy.
- Podpis AWS SigV4 (`server/lib/sigv4.ts`) jest sprawdzony oficjalnym wektorem testowym AWS.
- Pola rezerwacji ZnanyLekarz (`start_at`, `patient`, `address_service`) i rekordów Validic (`metrics[]` z `type/unit/value`) mapowane
  są ostrożnie — nieznane pola są pomijane, a nie zgadywane.

## Jitsi Meet

Własna instancja (zalecane): `JITSI_DOMAIN`, a przy uwierzytelnianiu tokenami — `JITSI_APP_ID` i `JITSI_APP_SECRET`
(HS256; lekarz = moderator, pacjent = uczestnik, token ważny 3 h). Publiczny `meet.jit.si` wyłącznie do testów
(interfejs pokazuje ostrzeżenie). CSP i `Permissions-Policy` dopuszczają kamerę i mikrofon tylko dla tej domeny.
