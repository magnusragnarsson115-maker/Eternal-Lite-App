# ETERNAL UNIVERSAL SYNC — PROJEKT (ST-0, Station Sync)

Wersja 1.0 · 3.10.2026 · status: ROBOCZY, do decyzji (sekcja 14)
Podstawa: ETERNAL 11 · Plik 5 — Station i Universal Sync (arkusze Z1, Z2, S1, plik tekstowy 030, rubryki 3, 10, 13, 28, 30, 36–39, 46–50).

Oznaczenia jak w pliku 030: **[PEWNE]** sprawdzone w źródle · **[KORPUS]** z dokumentów Eternal · **[ZAŁ.]** założenie robocze (= `ZAŁOŻENIE`) · **[OBL.]** obliczenie · **[NIEZWER.]** niesprawdzone albo sprzeczne · **[NOWE]** propozycja tego projektu, nieobecna w plikach.

---

## 0. Werdykt w skrócie

1. Universal Sync to **warstwa danych całego Eternal**, nie gadżet: zbiera pomiary z urządzeń, które pacjent już ma, zapisuje je z pochodzeniem i — za zgodą — pokazuje lekarzowi. Pierwszy produkt linii Station, zero sprzętu.
2. **Nasze zawsze:** model danych, pochodzenie każdej liczby, zgody per źródło, rejestr urządzeń, kontrakt adaptera, widok lekarza, rejestr dostawców z planem wyjścia. **Cudze i wymienne:** wszystko pod kontraktem adaptera (HealthKit, Health Connect, Open Wearables, Thryve/Terra, chmury producentów).
3. Kolejność dróg danych: **telefon → wpis/zdjęcie/plik → otwarty agregator na naszym serwerze → agregator komercyjny jako zapas → własne łączniki do 3–4 największych marek → Data Act i program zgodności**.
4. Sync **pokazuje fakty, nie ocenia**. Brak alarmów progowych i „wyników niepokojących” → brak wyrobu medycznego (MDCG 2019-11). Ocena = moduł partnera z CE albo decyzja lekarza.
5. Pacjent płaci 0 zł; płaci klinika (abonament panelu), później firmy za licencję SDK/API.
6. MVP 2027 kosztuje ok. **50–93 osobodni** pracy i ok. 1,5–3 zł/konto/mies. infrastruktury, bez opłat dla dostawców [OBL. z kart Z2].

---

## 1. Czym jest i czym nie jest

**Jedno zdanie:** „Dane z urządzeń pacjenta są w jego profilu z pochodzeniem i — za zgodą — u lekarza” (efekt końcowy z rubryki 39, wspólny dla wszystkich wariantów budowy).

| Sync JEST | Sync NIE JEST |
|---|---|
| zbieraczem danych z telefonu, chmur producentów, Bluetooth, plików, zdjęć i wpisów | platformą zdalnego monitoringu (to ST-1/ST-3 — inna zdolność, partner z CE) |
| jednym rekordem z pochodzeniem i poziomem zaufania każdego pomiaru | systemem alarmów, triage'u, oceny stanu zdrowia |
| warstwą zgód: kto widzi które źródło, jak długo | agregatorem do odsprzedaży danych (wykluczone) |
| produktem (ekran „Moje urządzenia”, zakładka „Urządzenia” u lekarza) i mikroproduktem (SDK/API) | obietnicą „dowolnego urządzenia” ani ciągłości pomiaru |

Problem, który rozwiązuje: dane są w 5–10 aplikacjach producentów; lekarz ich nie widzi; pacjent nie umie ich pokazać [KORPUS: rubryka 13].

---

## 2. Zasady projektowe (obowiązują na każdym etapie)

| # | Zasada | Konsekwencja w projekcie |
|---|---|---|
| Z1 | **Adapter jest nasz, dostawca pod spodem wymienny** | każde źródło za jednym kontraktem (sekcja 4); zmiana dostawcy = konfiguracja, nie przebudowa |
| Z2 | **Każda liczba ma pochodzenie** | urządzenie, producent, model, droga odczytu, czas pomiaru i czas odbioru, poziom zaufania — nie da się zapisać pomiaru bez tych pól |
| Z3 | **Zgoda per źródło i per odbiorca** | pacjent włącza/wyłącza każde źródło osobno i każdemu lekarzowi osobno; wycofanie jednym ruchem |
| Z4 | **Nic nie ginie po cichu** | kolejka z ponawianiem; stan źródła widoczny („brak danych od 3 dni”, „wymaga ponownej zgody”) |
| Z5 | **Fakty, nie oceny** | żadnych progów, kolorów „za wysokie”, alarmów w interfejsie pacjenta; „anomalia” = tylko błąd techniczny |
| Z6 | **Oryginału nie nadpisujemy** | korekta tworzy nową wersję; dane z urządzeń CE i dokumentów placówek — tylko adnotacja |
| Z7 | **Dane w UE, wyjście w 30 dni** | dostawca bez pełnego eksportu nie wchodzi do produkcji; test wyjścia co kwartał |
| Z8 | **Telefon najpierw** | najtańsza droga (0 zł) jest domyślna; płatne drogi tylko tam, gdzie telefon nie wystarcza, i tylko dla płacących |

---

## 3. Architektura

```
 ŹRÓDŁA                       ADAPTERY (kontrakt Z1)            RDZEŃ SYNC (nasz)                         ODBIORCY
 ─────────────────────────    ──────────────────────────        ─────────────────────────────────         ─────────────────────
 Apple Zdrowie (HealthKit) ─► A-HK   moduł Swift      ─┐
 Health Connect (Android)  ─► A-HC   moduł Kotlin     ─┤        ┌─ 1. Kolejka wejściowa (ponawianie,   ┐
 Wpis ręczny / głos        ─► A-MAN  formularz         ─┤        │     idempotencja, bufor offline)    │   Aplikacja pacjenta
 Zdjęcie wyświetlacza      ─► A-OCR  odczyt + potwierdz.┤        │  2. Walidacja techniczna (zakresy)   │   („Moje urządzenia”,
 Pliki CSV/JSON/FIT/PDF    ─► A-FILE parsery + podgląd ─┼──────► │  3. Normalizacja → FHIR R4           ├─► wykresy, raporty)
 Bluetooth (profile std.)  ─► A-BLE  GATT w aplikacji  ─┤  zdarz.│     (LOINC, UCUM, czas UTC+strefa)  │   Doctor — zakładka
 Chmury producentów        ─► A-OW   Open Wearables   ─┤  w     │  4. Pochodzenie + poziom zaufania    │   „Urządzenia”
                              A-AGG  Thryve/Terra(zap.)─┤  jedn. │  5. Deduplikacja (priorytet, okna)   │   Digital Twin
 Withings (bezpośrednio)   ─► A-WIT  własny łącznik    ─┤  form. │  6. Rejestr urządzeń                 │   Labs, Medication,
 Bramka Station (MLP+)     ─► A-GW   tablet / bramka   ─┤        └─ 7. Zapis: rekord FHIR (UE)          ┘   Matrix (wellness)
 Data Act (FINAL)          ─► A-DA   odbiorca danych   ─┘                      │                          API / SDK (M-45)
                                                                               ▼
                                    WARSTWA KONTROLNA: zgody · dziennik dostępu (nie do zmiany) · rejestr dostawców
                                    i plan wyjścia · tryb awaryjny · kontrola kosztu na użytkownika · bezpieczeństwo
```

**Gdzie co działa**

| Element | Miejsce | Technologia [ZAŁ.] |
|---|---|---|
| A-HK, A-HC, A-BLE, A-OCR, bufor offline | telefon (aplikacja wieloplatformowa z modułami natywnymi) | Swift / Kotlin; szyfrowana pamięć podręczna |
| Kolejka, normalizacja, deduplikacja, rekord | nasza chmura w UE — źródło prawdy | PostgreSQL + magazyn zgodny z S3 (przenośność) [KORPUS: A1.10] |
| Open Wearables (A-OW) | nasz serwer w UE, za adapterem | licencja MIT [PEWNE na 2.10.2026; plik licencji w repozytorium do przeczytania] |
| Agregator zapasowy (A-AGG) | chmura dostawcy (Thryve — Niemcy) | tylko dla płacących; decyzja nr 3 w sekcji 14 |

Uwaga techniczna: sama strona internetowa nie ma dostępu do HealthKit ani Health Connect — **potrzebna aplikacja natywna lub hybrydowa z modułami natywnymi** [KORPUS: A1.8].

---

## 4. Kontrakt adaptera (rdzeń decyzji architektonicznej — F2.14)

Każde źródło, także przyszłe, implementuje ten sam interfejs. Szkic [NOWE]:

```ts
interface SyncAdapter {
  id: string;                          // "A-HK", "A-OW:garmin", "A-WIT"
  kind: "phone" | "cloud" | "ble" | "file" | "manual" | "ocr" | "gateway" | "data_act";
  vendor: VendorCard;                  // karta dostawcy: umowa, koszt, dane gdzie, zapasowy dostawca, data testu wyjścia
  supportedTypes: MeasurementType[];   // z katalogu sekcji 5.2

  connect(user: UserId, scope: ConsentScope): Promise<Connection>;     // zgoda systemowa / OAuth / parowanie BLE
  pull(conn: Connection, since: Instant): AsyncIterable<RawRecord>;    // dogrywanie od znacznika
  onPush?(payload: unknown): RawRecord[];                              // webhooki chmur, bramka
  toCanonical(raw: RawRecord): CanonicalObservation;                   // normalizacja PRZY ZAPISIE (A1.5)
  health(conn: Connection): ConnectionState;                           // OK | STALE(dni) | REAUTH | REVOKED | VENDOR_DOWN
  disconnect(conn: Connection, purge: boolean): Promise<void>;
  exportAll(user: UserId): AsyncIterable<RawRecord>;                   // warunek Z7 — bez eksportu brak produkcji
}
```

**Testy kontraktowe** (uruchamiane przy każdej zmianie): ten sam zestaw nagranych danych wejściowych → identyczny wynik kanoniczny; jednostki; strefy czasowe; powtórzone wysłanie nie tworzy duplikatu (idempotencja); utrata zgody → stan `REAUTH`, nie błąd cichy.

Koszt: 10–15 osobodni jednorazowo, potem oszczędność przy każdym źródle [KORPUS: F2.14]. W FINAL ten sam kontrakt publikujemy producentom jako program zgodności „działa z Eternal”.

---

## 5. Model danych

### 5.1 Pomiar kanoniczny (FHIR R4 `Observation` + rozszerzenia pochodzenia)

| Pole | Znaczenie | Obowiązkowe |
|---|---|---|
| `code` (LOINC), `value`, `unit` (UCUM) | co i ile | tak |
| `effective` (UTC) + `tzOffset` | kiedy zmierzono, w strefie pacjenta | tak |
| `received` | kiedy do nas dotarło (opóźnienie chmur, CGM) | tak |
| `device` → rejestr urządzeń | producent, model, nr seryjny (jeśli jest), oprogramowanie, **czy wyrób z CE** | tak (albo „nieznane”) |
| `route` | `phone_store` / `cloud:<vendor>` / `ble` / `file` / `photo` / `manual` / `gateway` | tak |
| `adapter`, `adapterVersion`, `vendorRecordId` | ścieżka techniczna; klucz do deduplikacji i audytu | tak |
| `trust` | poziom zaufania T1–T5 (5.3) | tak |
| `status` | `final` / `superseded` (korekta) / `suspect_technical` / `duplicate_hidden` | tak |
| `supersedes` | odnośnik do wersji poprzedniej przy korekcie (A1.4) | przy korekcie |
| `context` | np. „ranny/wieczorny”, „po wysiłku” — tylko jako opis, nie ocena | nie |

### 5.2 Katalog typów pomiarów MVP (ok. 15 — A1.5) [ZAŁ.: kody LOINC do potwierdzenia w słowniku przed wdrożeniem]

| Typ | LOINC | Jednostka | Główna droga MVP |
|---|---|---|---|
| Ciśnienie skurczowe / rozkurczowe (panel) | 8480-6 / 8462-4 (85354-9) | mm[Hg] | telefon, zdjęcie, wpis |
| Tętno | 8867-4 | /min | telefon |
| Tętno spoczynkowe | 40443-4 | /min | telefon |
| Zmienność rytmu (HRV, SDNN) | 80404-7 | ms | telefon — pokazujemy liczbę, bez oceny stresu |
| Saturacja SpO₂ | 59408-5 | % | telefon, wpis |
| Masa ciała | 29463-7 | kg | telefon (aplikacja wagi) |
| Tkanka tłuszczowa | 41982-0 | % | telefon — „szacunek producenta” |
| Wzrost / BMI | 8302-2 / 39156-5 | cm / kg/m² | wpis / obliczenie |
| Glukoza (glukometr) | 2339-0 | mg/dL, mmol/L | zdjęcie, wpis, telefon |
| Temperatura ciała | 8310-5 | Cel | wpis, zdjęcie |
| Częstość oddechów | 9279-1 | /min | telefon |
| Kroki | 55423-8 | {steps} | telefon |
| Czas snu | 93832-4 | h | telefon |
| EKG z zegarka | — | dokument PDF + klasyfikacja producenta | plik (MVP), telefon (MLP) |

### 5.3 Poziom zaufania (widoczny dla lekarza przy każdej liczbie)

| Poziom | Źródło | Przykład |
|---|---|---|
| T1 | urządzenie z CE (wyrób medyczny), odczyt automatyczny | ciśnieniomierz z CE przez BLE / bramkę |
| T2 | urządzenie konsumenckie, odczyt automatyczny | zegarek, pierścień, waga bez CE |
| T3 | magazyn zdrowia telefonu bez znanego urządzenia | wpis innej aplikacji w Apple Zdrowie |
| T4 | zdjęcie wyświetlacza potwierdzone przez pacjenta | fotografia glukometru |
| T5 | wpis ręczny | „130/85” wpisane palcem lub głosem |

### 5.4 Deduplikacja (A1.7 / F2.5)

- **MVP:** jedno źródło na typ danych (pacjent wybiera albo domyślne wg priorytetu) + filtr wartości technicznie niemożliwych (np. tętno 400 → `suspect_technical`, nie usuwamy).
- **MLP:** priorytet automatyczny **T1 > T2 > T3 > T4 > T5**, pacjent może zmienić kolejność; okna czasowe per typ [ZAŁ.]: ciśnienie ±2 min i różnica ≤ 2 mmHg; masa ±10 min; kroki i sen — rozstrzygnięcie per interwał (nie sumujemy zegarka z telefonem).
- **FINAL:** łączenie sygnałów z oceną wiarygodności.
- Ukryty duplikat zostaje w rekordzie (`duplicate_hidden`) — da się go pokazać i odwrócić decyzję.

---

## 6. Przepływy (jak działa)

**6.1 Podłączenie źródła.** „Moje urządzenia” → „Dodaj źródło” → wybór drogi → zgoda systemowa (Apple/Google), logowanie u producenta (chmury) albo parowanie BLE → **pierwsze pobranie historii** (Health Connect: domyślnie 30 dni, starsza wymaga osobnej zgody [KORPUS: F2.2]) → wpis do rejestru urządzeń → wykres w ciągu kilku sekund od zakończenia pobrania.

**6.2 Dogrywanie.** MVP: przy otwarciu aplikacji + raz dziennie w tle. MLP: Android — zadanie okresowe (najczęściej co 15 min); iPhone — dostarczanie w tle, gdy system pozwoli; chmury — webhooki serwer–serwer. **Nie obiecujemy ciągłości** — to nie monitoring [KORPUS: F2.6].

**6.3 Zdjęcie wyświetlacza.** Zdjęcie → odczyt liczb → **pacjent potwierdza lub poprawia** → zapis T4 z miniaturą zdjęcia jako dowodem. Ta sama technika co odczyt wyników badań (wspólny komponent).

**6.4 Import pliku.** Plik → kolejka → podgląd z mapowaniem kolumn i strefą czasową → „Zapisz” → T2/T3 zależnie od zawartości. Demo: eksport Apple Zdrowie — najtańszy sposób pokazania historii bez aplikacji natywnej.

**6.5 Udostępnienie lekarzowi.** Pacjent wybiera lekarza/klinikę, **zakres źródeł i typów** oraz termin (np. 90 dni) → lekarz widzi zakładkę „Urządzenia” → każde otwarcie trafia do dziennika dostępu widocznego dla pacjenta.

**6.6 Awaria i utrata zgody.** Dostawca nie odpowiada → kolejka ponawia, stan `VENDOR_DOWN`, komunikat w aplikacji; zgoda wygasła → stan `REAUTH`, powiadomienie „połącz ponownie”; brak danych > 3 dni → powiadomienie pacjenta (bez oceny zdrowia). Zmiana dostawcy chmur wymaga ponownego połączenia przez pacjenta — komunikat i przycisk przygotowane z góry.

**6.7 Wycofanie.** „Odłącz” → wybór: zachowaj historię / usuń dane z tego źródła → odwołanie tokenów u dostawcy → wpis w dzienniku.

---

## 7. Jak wygląda

### 7.1 Pacjent — „Moje urządzenia” (MVP)

```
┌──────────────────────────────────────┐
│  Moje urządzenia                     │
│                                      │
│  [ + Dodaj źródło ]                  │
│                                      │
│  ● Apple Zdrowie          działa     │
│    tętno, kroki, sen · 12 min temu   │
│  ● Ciśnieniomierz (zdjęcia)          │
│    ostatnio 128/82 · dziś 7:40       │
│  ◐ Waga Xiaomi (Health Connect)      │
│    brak danych od 4 dni   [Sprawdź]  │
│  ○ Garmin                            │
│    wymaga ponownej zgody [Połącz]    │
│                                      │
│  Udostępniam: dr Nowak (do 31.12) ›  │
└──────────────────────────────────────┘
```

„Dodaj źródło” w MVP — trzy drogi (rubryka 36.4): **Połącz z Apple Zdrowie / Health Connect** · **Połącz urządzenie Bluetooth** (od MVP-2, jeśli przejdzie test 6/10 modeli) · **Zrób zdjęcie wyniku z urządzenia**; pod spodem „Wpisz ręcznie” i „Importuj plik”. W MLP dochodzi czwarta: **Połącz konto producenta** (lista marek; Open Wearables / Withings / zapas).

### 7.2 Pacjent — wykres z pochodzeniem

```
  Ciśnienie · 7 dni            [rano ▪] [wieczór ▫]
  150 ┤
  130 ┤  ▪   ▪ ▫  ▪    ▪ ▫   ▪
  110 ┤
       pn  wt  śr  cz  pt  sb  nd
  śr 7:40  128/82  ⓘ skąd to? → Omron M3 · zdjęcie potwierdzone · T4
```

Bez kolorowania „za wysokie”, bez stref ryzyka. Zakresy docelowe pojawiają się wyłącznie jako **zakres ustawiony przez lekarza** (decyzja lekarza) albo z modułu partnera z CE.

### 7.3 Lekarz — zakładka „Urządzenia” w karcie pacjenta (Doctor)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Jan Kowalski · Urządzenia        Okres: [30 dni ▾]  [✓] tylko CE (T1)    │
├──────────────────────────────────────────────────────────────────────────┤
│ Kompletność przed wizytą:  ciśnienie 24/30 dni · masa 18/30 · sen 29/30  │
│                                                                          │
│ Ciśnienie   [wykres rano/wieczór]   śr. 131/83 · 48 pomiarów · T1 62%    │
│ Masa        [wykres]                 −1,4 kg / 30 dni · T2               │
│ Tętno spocz.[wykres]                 śr. 64 · T2                         │
│ Sen         [wykres]                 śr. 6 h 40 min · T2                 │
│                                                                          │
│ Źródła: Omron M3 (CE, zdjęcia) · Apple Watch (konsumenckie) · ręczne     │
│ [Raport PDF przed wizytą]   [Eksport FHIR]                               │
└──────────────────────────────────────────────────────────────────────────┘
```

Lekarz widzi statystyki opisowe (średnia, liczba pomiarów, kompletność) — **fakty**, nie interpretację.

### 7.4 Operator — panel stanu połączeń (MLP) [NOWE]

Liczba aktywnych połączeń per adapter, odsetek `STALE`/`REAUTH`, opóźnienie odbioru, błędy kontraktu, **koszt Sync na aktywnego użytkownika** (serwer + agregator + praca), data ostatniego testu wyjścia per dostawca.

### 7.5 Zasady wyglądu (wszystkie etapy — rubryka 30)

Duże litery i kontrast (seniorzy) · jeden przycisk na czynność · komunikaty głosowe · przy każdej liczbie „skąd to” · żadnych ocen typu „wynik niepokojący” po stronie pacjenta · wygląd domowy dla pacjenta, medyczny dla panelu placówki.

---

## 8. Etapy

| Etap | Kiedy | Co wchodzi | Czego świadomie nie ma | Koszt |
|---|---|---|---|---|
| **Prototyp / Demo** | IV kw. 2026 | import eksportu Apple Zdrowie; tabela pomiarów (wartość, jednostka, czas, źródło); formularz 4 typów; 2–3 urządzenia CE na biurku + widok lekarza na danych syntetycznych; **test BLE na 10 modelach**; **test Open Wearables na 20 kontach (2 tyg.)** | aplikacji natywnej w sklepie | 0 zł opłat; urządzenia 600–1 500 zł; infra 50–200 zł/mies. [KORPUS] |
| **MVP** | 2027 | HealthKit + Health Connect natywnie (30 dni historii); wpis z historią poprawek; zdjęcie wyświetlacza; import CSV/JSON/PDF; FHIR dla ok. 15 typów; deduplikacja prosta; T1–T5; rejestr urządzeń (lista); zgody, dziennik; „brak danych od 3 dni”; kontrakt adaptera + 2 adaptery wg wzoru; zakładka „Urządzenia” u lekarza. **MVP-2:** BLE dla 5 profili standardowych, jeśli test ≥ 6/10 | agregatora komercyjnego; chmur Garmin/Polar/Oura/Whoop bezpośrednio; alarmów | **50–93 osobodni** [OBL.] + BLE 20–40 osobodni [ZAŁ.]; infra 1,5–3 zł/konto/mies. [KORPUS] |
| **MLP** | 2028 | Open Wearables na naszym serwerze (Garmin, Polar, Suunto, Oura, Whoop, Ultrahuman, Strava, Samsung); **Withings bezpośrednio**; Thryve jako zapas tylko dla płacących; tło co 15 min (Android) i webhooki; priorytet źródeł ustawiany przez pacjenta; tryb offline; wpis głosem; FIT i eksport Google; **bramka Station (A-GW)** dla ST-1/ST-3; panel stanu połączeń | własnych łączników „na zapas” | OW: 0 zł licencji, serwer 200–400 zł/mies. (do 300–1 000 zł przy 2 000 użytk.), wdrożenie 15–30 osobodni [KORPUS/ZAŁ.] |
| **FINAL-1** | 2029–2030 | własne łączniki do marek > 500–1 000 aktywnych użytkowników; Data Act jako droga do danych; program zgodności dla producentów; **licencja Sync (SDK/API)**; podpis pomiaru w bramce; rezydencja danych per kraj | — | łącznik 8–20 osobodni + 1–2 osobodni/mies. utrzymania [ZAŁ.] |
| **SF** | po 2030 | brama danych dla implantów i CGM partnerów (Capsule) — wyrób zostaje u producenta | własny implant, BCI, nanoboty, „Cloud Brain” | — |

Sumowanie MVP [OBL. z kart Z2]: HealthKit/Health Connect 10–20 + wpis 5–8 + korekta 2–4 + FHIR 10–20 + import 5–10 + deduplikacja 5–10 + tło 3–6 + kontrakt adaptera 10–15 = **50–93 osobodni**, bez zgód/dziennika (wspólne z resztą aplikacji) i bez BLE.

---

## 9. Dostawcy, progi przejścia, plan wyjścia

| Rola | Główny | Zapas | Wyzwalacz zmiany |
|---|---|---|---|
| Dane z telefonu | HealthKit, Health Connect (funkcje systemu, 0 zł) | Samsung Health Data SDK; zestaw mobilny OW | nie ma dostawcy — zmienia się tylko biblioteka odczytu |
| Chmury producentów | **Open Wearables** (Momentum, Wrocław; nasz serwer UE) | **Thryve** (dane w Niemczech, 499 EUR/mies. za 500 użytk.) | OW traci opiekunów → nasz fork + Thryve |
| Najszersze pokrycie | Terra (500+ integracji, od 499 USD/mies.) | ROOK, Sahha, Spike | tylko jeśli klient wymaga marki spoza OW i Thryve |
| Withings | bezpośredni łącznik (publiczny interfejs) | Thryve | brak w OW [PEWNE: 2.10.2026] |
| Własny łącznik do marki | — | — | **500–1 000 aktywnych użytkowników tej marki** albo opłata agregatora > 1 osobodzień utrzymania/mies. [OBL.] |

Wyzwalacze awaryjne: podwyżka > 30%, upadłość, utrata regionu UE, zamknięcie interfejsu przez producenta (precedens: wyłączenie integracji Fitbit przez Validic, wrzesień 2026 [KORPUS]). **Test wyjścia co kwartał:** pełny eksport, przełączenie części ruchu na zapas, kontrola, że nic nie zginęło.

Pierwszy kandydat na własny łącznik: **Polar** (interfejs bezpłatny, prosty) [KORPUS: F2.12]. WHOOP — raczej nigdy (mała grupa w Polsce).

---

## 10. Granice regulacyjne i licencyjne

| Obszar | Reguła dla Sync |
|---|---|
| MDR / MDCG 2019-11 | zbiera, zapisuje, pokazuje, przesyła → **nie wyrób medyczny**. Próg, alarm, ocena trendu, interpretacja EKG → wyrób → tylko moduł partnera z CE. **Pisemna kwalifikacja przed MVP** (rubryka 50.1) |
| RODO art. 9 | dane o zdrowiu: wyraźna zgoda per cel; umowy powierzenia z każdym dostawcą za adapterem; DPIA przed MVP [ZAŁ.] |
| Data Act | od 12.09.2026 nowe urządzenia podłączone do sieci w UE muszą dawać dostęp do danych „z założenia” (art. 3 ust. 1) [PEWNE]; ograniczenia dla odbiorcy (art. 5–6, 9) — opinia prawna [NIEZWER.] |
| NIS2 / KSC | sprawdzić kryteria wpisu spółki (termin w pliku 030: 3.10.2026 — **dziś**) |
| CRA, RED | dotyczą dopiero własnej bramki (FINAL-1) |
| Apple / Google | opis celu użycia danych zdrowotnych przy publikacji; zakaz użycia do reklamy; konto Apple 99 USD/rok, Google Play 25 USD |
| Licencje OSS | Open Wearables — MIT (potwierdzić plik w repozytorium i licencje zależności); **Gadgetbridge — AGPL: kodu nie włączamy** |
| Regulaminy chmur | zakaz odsprzedaży, limity przechowywania — sprawdzane przy każdym adapterze (karta dostawcy) |

---

## 11. Bezpieczeństwo i kontrola (moduły zabezpieczające — rubryka 28)

Szyfrowanie w spoczynku i w tranzycie; tokeny dostawców w sejfie kluczy, nigdy w telefonie w postaci jawnej; dziennik dostępu nie do zmiany i widoczny dla pacjenta; upoważnienie opiekuna z terminem; wykrywanie podmienionych danych (MVP: poziom zaufania; FINAL-1: podpis pomiaru w bramce); tryb awaryjny (kolejka, komunikat); test penetracyjny przed MLP [ZAŁ.].

---

## 12. Mierniki i bramki

**Miesięczne:** odsetek pacjentów z ≥ 1 połączonym źródłem · pomiary na pacjenta · **odsetek pomiarów widzianych przez lekarza przed wizytą** · koszt Sync na aktywnego użytkownika · odsetek źródeł w stanie `STALE`/`REAUTH` · mediana opóźnienia odbioru [NOWE: dwa ostatnie].

**Bramki:**
- Prototyp → MVP: 3–5 klinik gotowych do płatnego pilotażu; BLE ≥ 6/10 modeli [KORPUS/ZAŁ.].
- MVP → MLP: ≥ 20% pacjentów klinik pilotażowych połączyło choć jedno urządzenie; 3 płatne odnowienia; oszczędność czasu ≥ 30% [ZAŁ./KORPUS].

---

## 13. Pieniądze

| Kto | Za co | Kwota |
|---|---|---|
| Pacjent | nic — bezpłatny rdzeń jako kanał | 0 zł |
| Klinika | abonament panelu Doctor z zakładką „Urządzenia” i raportem przed wizytą | 1 500 zł/mies. [KORPUS: kanon 7.1] |
| Firma healthtech | licencja Sync (SDK/API, M-45, MP06) — model danych z pochodzeniem, zgody, dziennik | za aktywnego użytkownika, 2028–2029 [KORPUS]; stawka [ZAŁ.: do wyceny] |
| Producent urządzeń | program zgodności „działa z Eternal” (testy, katalog w Forge) | FINAL-1 |

Koszt jednostkowy: serwer ok. 1,50–3 zł/mies. na konto bezpłatne; agregator tylko dla płacących [KORPUS: 9.10 arkusze 39, 80].

---

## 14. Rozbieżności w plikach — do rozstrzygnięcia

| # | Rozbieżność | Gdzie | Propozycja tego projektu |
|---|---|---|---|
| R1 | **Rozwiązanie ★:** Z1 (ST-0) wskazuje ★ Terra i „do 6–10 tys. profili agregator, potem Open Wearables”; plik 030 (37.4, ZMIANA 10) i Z2 „Budowa 1” wskazują **Open Wearables jako drogę główną od MLP**, agregator tylko jako zapas | Z1 vs Z2 / 030 | przyjęto 030 (nowsze, z uzasadnieniem); Z1 zaktualizować — Terra to ★ *rynku*, nie ★ *wyboru Eternal* |
| R2 | **Bluetooth:** 030 rubryka 36.1 — MVP-2 warunkowo; karty F2.7, F2.9, F2.21 — MLP | 030 vs Z2 | MVP-2 dla 5 profili standardowych **tylko po teście ≥ 6/10**, inaczej MLP |
| R3 | **Thryve:** zapas w MLP, ale pytanie 11 (rubryka 50) — czy dane mogą być w chmurze w Niemczech — otwarte | 030 | do decyzji D3 |
| R4 | **„Co 15 min”** w nazwie F2.6 — gwarantowane tylko na Androidzie | Z2 | w komunikacji produktu: „dane dogrywają się automatycznie”, bez interwału |
| R5 | **„Google Fit”** w nazwie F2.2 — interfejs wygaszany | Z2 | wyłącznie Health Connect |
| R6 | **A1.20** — pozycja bez opisu | Z2 | wykreślić z rejestru (zgodnie z kartą) |
| R7 | **Lista Open Wearables** — typy danych i opóźnienia niesprawdzone | 030 rubryka 49 poz. 10 | test na 20 kontach przed decyzją D2 |

## 15. Decyzje do podjęcia (zmieniają projekt)

| # | Pytanie | Rekomendacja |
|---|---|---|
| D1 | Nazwa: „Station Sync” w linii Station czy osobna marka „Eternal Sync” (pyt. 1, rubryka 50)? | **osobna nazwa produktu „Eternal Sync”**, „Station” od sprzętu — pacjent bez sprzętu nie rozumie „stacji” [NOWE] |
| D2 | Open Wearables na własnym serwerze jako droga główna (pyt. 4)? | **tak**, po teście na 20 kontach |
| D3 | Dane u dostawcy w Niemczech (Thryve) czy tylko nasz serwer (pyt. 11)? | dopuścić Thryve **tylko jako zapas, tylko dla klientów płacących, z umową powierzenia** |
| D4 | BLE w MVP-2 czy w MLP? | wg wyniku testu (R2) |
| D5 | Zakresy docelowe w widoku pacjenta? | tylko ustawione przez lekarza, oznaczone „zakres od dr X” — **kwalifikacja na piśmie** przed wdrożeniem |

---

## 16. Kolejne dokumenty (rekomendacja)

1. **Pisemna kwalifikacja regulacyjna Sync** (MDR/MDCG 2019-11) — przed MVP; `/dokument` z `ekspert-prawno-regulacyjny`.
2. **DPIA (ocena skutków dla ochrony danych)** dla Sync — przed MVP.
3. **Specyfikacja kontraktu adaptera + katalog LOINC/UCUM** — dokument techniczny dla zespołu.
4. **Protokół testów prototypu** (BLE 10 modeli, Open Wearables 20 kont) — IV kw. 2026.
5. **Karta dostawcy i plan wyjścia** dla Open Wearables, Thryve, Withings.
