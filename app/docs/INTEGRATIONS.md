# Integracje zewnętrzne

Wszystkie integracje są opcjonalne — aplikacja działa w pełni bez nich (lokalny magazyn FHIR, powiadomienia w aplikacji).
Status połączeń i test na żywo: panel **Administracja → Integracje → Sprawdź połączenia**.

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
| **Web Bluetooth (GATT)** | bezpłatne | — | ✅ parsery 5 profili | nic — odczyt w przeglądarce pacjenta |
| **Withings** | bezpłatne konto deweloperskie | `WITHINGS_CLIENT_ID/SECRET` | ✅ mapowanie, 🌐 OAuth | token OAuth pacjenta; pobierane są pomiary |
| **Vitalera / platformy RPM** | umowa partnerska | `RPM_WEBHOOK_SECRETS` | ✅ podpis, mapowanie, deduplikacja | nic — platforma wysyła dane do nas |
| **Jitsi Meet** | bezpłatne (open source) | `JITSI_DOMAIN`, `JITSI_APP_ID/SECRET` | ✅ JWT i okno czasowe | strumień wideo do serwera Jitsi |
| **Web Push (VAPID)** | bezpłatne | opcjonalnie `VAPID_*` | — | tytuł i treść powiadomienia bez danych medycznych (przez usługę push przeglądarki) |
| **E-mail (SMTP)** | zależnie od dostawcy | `SMTP_URL`, `MAIL_FROM` | ✅ kolejka i zgody | adres e-mail, treść przypomnienia bez danych medycznych |
| **SMS** (SMSAPI.pl / własna bramka) | płatne | `SMS_PROVIDER`, `SMSAPI_TOKEN` / `SMS_WEBHOOK_URL` | ✅ normalizacja numerów | numer telefonu, treść przypomnienia bez danych medycznych |
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
Glukometry (profil `0x1808`) wymagają protokołu RACP — do rozbudowy.

## Withings

OAuth 2.0 (`account.withings.com/oauth2_user/authorize2`, `wbsapi.withings.net/v2/oauth2`), pomiary
`wbsapi.withings.net/measure?action=getmeas` (typy 1, 4, 9, 10, 11, 54, 71; wartość = `value × 10^unit`).
Adres zwrotny do rejestracji aplikacji: `{PUBLIC_URL}/api/integrations/withings/callback`. Pacjent łączy konto
w „Pomiary”, import ręczny lub po połączeniu.

## Jitsi Meet

Własna instancja (zalecane): `JITSI_DOMAIN`, a przy uwierzytelnianiu tokenami — `JITSI_APP_ID` i `JITSI_APP_SECRET`
(HS256; lekarz = moderator, pacjent = uczestnik, token ważny 3 h). Publiczny `meet.jit.si` wyłącznie do testów
(interfejs pokazuje ostrzeżenie). CSP i `Permissions-Policy` dopuszczają kamerę i mikrofon tylko dla tej domeny.
