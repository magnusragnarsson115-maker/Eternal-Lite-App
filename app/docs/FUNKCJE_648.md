# Eternal — wszystkie 648 funkcji: co zrobione, co mogę zrobić, czego nie mogę i dlaczego

Stan na 17.10.2026 (po rundzie 4). Źródło: arkusz `24_REJESTR_648_FUNKCJI` (Eternal 9.0). Kod: katalog `app/` (serwer, przeglądarka, aplikacja mobilna).
Mapa funkcji na pliki i testy: [`MODULES.md`](MODULES.md). Granica wyrobu medycznego: [`COMPLIANCE.md`](COMPLIANCE.md) §1. Kolejka następnych pakietów, przeszkody i potrzebne decyzje — na końcu pliku.

## Legenda

| Status | Znaczenie |
|---|---|
| ✅ Zrobione | działa w aplikacji, ma testy (wcześniejsze rundy) |
| 🆕 Zrobione teraz | zbudowane w rundzie 4 (kolejka A, pakiety 1–9) |
| 🟡 Częściowo | działa wersja informacyjna/administracyjna; reszta wymaga powodu z listy „nie mogę” |
| 🔧 Mogę zrobić | da się zbudować kodem bez certyfikacji, sprzętu i umów — kolejne rundy |
| ⛔ MDR | nie mogę: interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| ⛔ Umowa | nie mogę: konto / umowa z zewnętrznym dostawcą |
| ⛔ Sprzęt | nie mogę: fizyczne urządzenie — projekt sprzętowy i CE |
| ⛔ Ludzie | nie mogę: usługa świadczona przez ludzi |
| ⛔ R&D | nie mogę: technologia w fazie badań |
| ⛔ SF | nie mogę: wizja / wstrzymane w rejestrze |
| ⛔ Prawo | nie mogę: niedozwolone obecnie prawem |
| ⛔ Osobny produkt | nie mogę: inny produkt / platforma niż ta aplikacja |
| ❔ Do doprecyzowania | nie mogę: pozycja w rejestrze bez czytelnej nazwy |

## Podsumowanie

| Status | Liczba | Udział |
|---|---:|---:|
| ✅ Zrobione | 129 | 20% |
| 🆕 Zrobione teraz | 41 | 6% |
| 🟡 Częściowo | 31 | 5% |
| 🔧 Mogę zrobić | 48 | 7% |
| ⛔ Nie mogę (razem) | 399 | 62% |
| — w tym ⛔ MDR | 103 | 16% |
| — w tym ⛔ R&D | 70 | 11% |
| — w tym ⛔ SF | 67 | 10% |
| — w tym ⛔ Sprzęt | 60 | 9% |
| — w tym ⛔ Umowa | 55 | 8% |
| — w tym ⛔ Ludzie | 27 | 4% |
| — w tym ⛔ Osobny produkt | 10 | 2% |
| — w tym ❔ Do doprecyzowania | 4 | 1% |
| — w tym ⛔ Prawo | 3 | <1% |

### Według grupy produktów

| Grupa | Razem | ✅ | 🆕 | 🟡 | 🔧 | ⛔ |
|---|---:|---:|---:|---:|---:|---:|
| Aplikacja pacjenta — rdzeń | 125 | 56 | 11 | 9 | 2 | 47 |
| Lekarz, placówka, leki i badania | 120 | 25 | 6 | 6 | 7 | 76 |
| Wellness, zdrowie psychiczne, rodzina i senior | 169 | 24 | 20 | 10 | 10 | 105 |
| Nadzór, dane, bliźniak cyfrowy i genetyka | 87 | 21 | 3 | 6 | 9 | 48 |
| Społeczność i ekosystem | 71 | 0 | 0 | 0 | 20 | 51 |
| Urządzenia (Station, Care Pod, implanty) | 76 | 3 | 1 | 0 | 0 | 72 |

### Według etapu z rejestru

| Etap | Razem | ✅ + 🆕 | 🟡 | 🔧 | ⛔ |
|---|---:|---:|---:|---:|---:|
| MVP/MLP | 403 | 154 | 29 | 38 | 182 |
| MLP→R&D | 43 | 7 | 1 | 10 | 25 |
| R&D/FINAL | 37 | 0 | 0 | 0 | 37 |
| SF / obserwacja | 33 | 0 | 0 | 0 | 33 |
| MLP/FINAL | 30 | 3 | 0 | 0 | 27 |
| FINAL/R&D | 24 | 2 | 0 | 0 | 22 |
| MLP/R&D | 16 | 1 | 1 | 0 | 14 |
| SF / WSTRZYMANE | 16 | 0 | 0 | 0 | 16 |
| MLP/FINAL (regulowany) | 14 | 2 | 0 | 0 | 12 |
| MLP | 12 | 1 | 0 | 0 | 11 |
| MLP/FINAL (regulowany/R&D) | 8 | 0 | 0 | 0 | 8 |
| WSTRZYMANE / R&D | 6 | 0 | 0 | 0 | 6 |
| R&D/WSTRZYMANE | 3 | 0 | 0 | 0 | 3 |
| R&D/SF | 3 | 0 | 0 | 0 | 3 |

## Aplikacja pacjenta — rdzeń


### Eternal App Core (88)

✅ 45 · 🆕 4 · 🟡 7 · 🔧 2 · ⛔ 30

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F1.1 | Rejestracja przez email/Apple/Google (OAuth 2.0) | MVP/MLP | P1 | ✅ Zrobione | e-mail + logowanie firmowe OIDC; Apple/Google wg planu w MLP (konfiguracja OIDC) |
| F1.2 | Logowanie biometryczne (Touch ID, Face ID, odcisk palca) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.3 | Zgody RODO (pole wyboru + znacznik czasu + log audytowy) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.4 | Kody odzyskiwania (10 jednorazowych kodów, szyfrowane AES-256) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.5 | 6-cyfrowy PIN jako zamiennik | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.6 | Profil podstawowy (imie, wiek, plec, waga, wzrost) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.7 | Uwierzytelnianie wieloskładnikowe TOTP (Authy, Google Authenticator, 1Password) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.8 | Weryfikacja SMS przez Twilio | MVP/MLP | P1 | ✅ Zrobione | kod gotowy; wysyłka po podłączeniu operatora SMS |
| F1.9 | Logowanie linkiem z e-maila (bez hasła) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.10 | Obsługa sprzętowych kluczy YubiKey (WebAuthn/FIDO2) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.11 | Wykrywanie żywotności (FaceTec, ochrona przed podszywaniem) | MVP/MLP | P1 | ⛔ Umowa | licencja dostawcy (np. FaceTec) i DPIA biometrii |
| F1.12 | Uwierzytelnianie oparte na ryzyku (model uczenia maszynowego wykrywa anomalie) | MVP/MLP | P1 | 🟡 Częściowo | reguła: logowanie z nowego urządzenia × sieci → powiadomienie i e-mail; model ML ryzyka wymaga danych produkcyjnych |
| F1.13 | Zarządzanie sesjami + śledzenie urządzeń (maks. 5 urządzeń) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.14 | Biometria behawioralna (sposób trzymania telefonu, dotyk, chód) | MVP/MLP | P1 | ⛔ R&D | biometria behawioralna — badania, DPIA, AI Act |
| F1.15 | Samosuwerenna tożsamość (DID:web, Veramo, Hyperledger Aries) | MVP/MLP | P1 | 🔧 Mogę zrobić | po EUDI Wallet (eIDAS 2) — wtedy logowanie portfelem |
| F1.16 | Dowody z wiedzą zerową (zk-SNARK — weryfikacja wieku lub regionu) | MVP/MLP | P1 | ⛔ R&D | dowody ZK — prototyp badawczy |
| F1.17 | Kwalifikowany podpis eIDAS (mObywatel, mDokumenty) | MVP/MLP | P1 | ⛔ Umowa | węzeł krajowy / kwalifikowany dostawca podpisu |
| F1.18 | Sprzętowy moduł bezpieczeństwa (Apple Secure Enclave, Android KeyStore) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F1.19 | Szyfrowanie odporne na komputery kwantowe (CRYSTALS-Kyber) | R&D/WSTRZYMANE | P1 | ⛔ R&D | technologia w fazie badań |
| F1.20 | Biometria fal mózgowych (sygnatura EEG, EMOTIV / Neuralink) | R&D/WSTRZYMANE | P1 | ⛔ R&D | technologia w fazie badań |
| F1.21 | Weryfikacja DNA (mikropróbka, czujnik mikropapierowy) | R&D/WSTRZYMANE | P1 | ⛔ R&D | technologia w fazie badań |
| F1.22 | Kwantowa dystrybucja klucza (QKD) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F1.23 | Sygnatura duszy / świadomości (interfejs mózg–komputer + biometria + zachowanie) (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F3.1 | Skan dokumentu z aparatu (obsługa jak w CamScanner) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.2 | Wgrywanie PDF z Dysku Google / Plików | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.3 | OCR z Tesseract 5 + model trenowany na polskich danych | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.4 | Parser polskich wyników laboratoryjnych (Synevo, Diagnostyka, ALAB) | MLP/FINAL (regulowany) | P1 | ✅ Zrobione | odczyt z potwierdzeniem przez człowieka (granica MDR zachowana) |
| F3.5 | Mapowanie do kodów LOINC (standard medyczny) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.6 | Alert gdy parametr poza norma | MLP/FINAL (regulowany) | P1 | ✅ Zrobione | tylko oznaczenia wydrukowane przez laboratorium — bez własnej oceny |
| F3.7 | USG/RTG/MRI raport tekstowy (parser) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.8 | Recepta z P1 (NFZ Online API) | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 (CSIOZ/CeZ) |
| F3.9 | Karta wypisowa szpitalna | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.10 | Automatyczne oznaczanie diagnoz kodami ICD-10 | MVP/MLP | P1 | ⛔ MDR | automatyczne kodowanie rozpoznań; ręczny wybór kodu przez lekarza — A12.6 |
| F3.11 | Automatyczne oznaczanie leków kodami ATC | MVP/MLP | P1 | 🆕 Zrobione teraz | kod ATC z Rejestru Produktów Leczniczych przy lekach |
| F3.12 | Przetwarzanie języka z BioMistral 7B (medyczny, otwarty model językowy) | MVP/MLP | P1 | ⛔ R&D | własny model medyczny: trening, walidacja, hosting GPU |
| F3.13 | Detekcja niekonsistencji (interakcje lekowe w historii) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.14 | Analiza zdjęć znamion (model wykrywania czerniaka) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.15 | Analiza zdjęć oka (retinopatia cukrzycowa) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.16 | Analiza zdjęć wysypek (AI dermatologiczne) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.17 | Pełna integracja EHR HL7 FHIR R5 | MVP/MLP | P1 | 🟡 Częściowo | fasada FHIR R4; FHIR R5 i integracje EHR — z dostawcami systemów |
| F3.18 | Polski medyczny graf wiedzy (ponad 3000 pojęć) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F3.19 | Nagrywanie dźwięku wizyt + transkrypcja (Whisper) + auto-SBAR | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F3.20 | Nagrywanie wideo konsultacji + analiza wyrazu twarzy | MVP/MLP | P1 | ⛔ MDR | analiza mimiki — AI Act (emocje) i MDR |
| F3.21 | Medyczna ogólna sztuczna inteligencja (autonomiczny diagnosta) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.22 | Predykcja stanu zdrowia 10+ lat naprzod | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.23 | Rozumowanie kontrfaktyczne („co by było, gdyby...") | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F3.24 | AI przyczynowa (przyczyna, nie tylko korelacja) (4 podzadania) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| A1.1 | Synchronizacja Terra API (Apple/Garmin/Oura) | MVP/MLP | P1 | ⛔ Umowa | Terra (płatny klucz) |
| A1.2 | Open Wearables / Gadgetbridge | MVP/MLP | P1 | ⛔ Osobny produkt | osobna aplikacja Android |
| A1.3 | Ręczne dodawanie danych | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.4 | Ręczna korekta błędnych wartości | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.5 | Normalizacja do FHIR R4 | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.6 | Import CSV/JSON (backfill) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.7 | Deduplikacja i wykrywanie anomalii | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.8 | Google Fit / Apple Health | MVP/MLP | P1 | 🆕 Zrobione teraz | Apple Health / Health Connect (F2.1/F2.2) |
| A1.9 | Synchronizacja z Eternal Station (Bluetooth LE / MQTT) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| A1.10 | Przechowywanie danych (lokalnie + chmura) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A1.20 | Universal Sync — synchronizacja wielu źródeł danych | MVP/MLP | P1 | 🟡 Częściowo | źródła: ręczne, Bluetooth, Withings, import, telemonitoring; bez jednego agregatora |
| A2.1 | OCR wyników laboratoryjnych | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.2 | Parsowanie do FHIR Observation | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.3 | Walidacja i korekta OCR | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.4 | Tłumaczenie wyników na język naturalny | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.5 | Historia badań z wersjonowaniem | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.6 | Eksport CSV/PDF/FHIR Bundle | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.7 | OCR recept i zaświadczeń | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A2.8 | Integracja z P1 (e-skierowania) | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 |
| A3.1 | Pulpit główny | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A3.2 | Wykresy trendów | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A3.3 | Monitoring na żywo (strumieniowanie) | MVP/MLP | P1 | 🟡 Częściowo | zmiany na żywo (SSE) i telemonitoring przez partnera; strumień z urządzenia — Station |
| A3.4 | System powiadomień (FCM/SendGrid) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A3.5 | Trójkolorowe alerty | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A3.6 | Alerty środowiskowe (pogoda, smog) | MVP/MLP | P1 | 🆕 Zrobione teraz | powietrze i pogoda — informacja z datą pomiaru, bez porad |
| A3.7 | Bio-pogoda — analiza | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A3.8 | Porównanie do grupy wiekowej | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A3.9 | Digital Twin 2D/3D (podgląd) | MLP→R&D | P1 | 🔧 Mogę zrobić | podgląd 2D — produkt P4 |
| A4.1 | Raport tygodniowy PDF | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A4.2 | Raport miesięczny/kwartalny | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A4.3 | Raport SBAR dla lekarza | MVP/MLP | P1 | ✅ Zrobione | S — słowa pacjenta, A — tylko dane (ocenia lekarz); PDF |
| A4.4 | Raport jako FHIR Bundle | MVP/MLP | P1 | ✅ Zrobione | dokument FHIR R4 (Composition, LOINC 60591-5) |
| A4.5 | Raport holograficzny | MVP/MLP | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A14.1 | Eskalacja (rodzina, lekarz, 112) | MVP/MLP | P1 | 🟡 Częściowo | SOS do osób bliskich + 112; automatyczna eskalacja do lekarza — MDR |
| A14.2 | Inteligentne przypomnienia | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A14.3 | Niski stan suplementów | MLP | P1 | 🆕 Zrobione teraz | zapas leku z harmonogramu i jedno przypomnienie o uzupełnieniu |
| A23.1 | Dostępność podstawowa (A23.3) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A23.2 | Tryb prostego języka | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A23.3 | Dostępność podstawowa | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A23.4 | Obsługa czytnikiem ekranu i głosem | MVP/MLP | P1 | 🟡 Częściowo | czytniki ekranu działają; sterowanie głosem — A17.10 |
| A23.5 | Kanał niecyfrowy dla osób bez smartfona | MVP/MLP | P1 | 🟡 Częściowo | link SMS, karta PDF do druku, profil prowadzony przez opiekuna; infolinia/IVR — umowa |

### Eternal App Core / Eternal Station (25)

✅ 3 · 🆕 5 · 🟡 2 · 🔧 0 · ⛔ 15

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F2.1 | Natywna integracja Apple HealthKit (iOS) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | HealthKit: kroki i sen z fazami (development build EAS) |
| F2.2 | Google Fit / Health Connect (Android) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | Health Connect: kroki i sesje snu (development build EAS) |
| F2.3 | Integracja z API Terra (Garmin, Oura, Fitbit, Whoop, Polar) | MVP/MLP | P1/P2 | ⛔ Umowa | klucz API / umowa partnerska |
| F2.4 | Mapowanie do zasobu FHIR R4 Observation | MVP/MLP | P1/P2 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F2.5 | Rozstrzyganie konfliktów (gdy dwa urządzenia mierzą to samo) | MVP/MLP | P1/P2 | 🟡 Częściowo | rozbieżne odczyty oznaczane, bez rozstrzygania (świadomie — A1.7) |
| F2.6 | Automatyczna synchronizacja co 15 min (w tle) | MVP/MLP | P1/P2 | 🟡 Częściowo | synchronizacja Withings i telemonitoringu; tło co 15 min — po F2.1/F2.2 |
| F2.7 | Inteligentna waga Bluetooth (Withings, Fitbit Aria, Eufy) | MVP/MLP | P1/P2 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F2.8 | CGM API (Dexcom G7, Freestyle Libre 3) | MVP/MLP | P1/P2 | ⛔ Umowa | API partnerskie Dexcom / Abbott |
| F2.9 | Bluetooth pulsoksymetr (Wellue, Masimo MightySat) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | profil Bluetooth PLX (pomiar jednorazowy i ciągły) |
| F2.10 | Bluetooth EKG (KardiaMobile, Withings ScanWatch) | MVP/MLP | P1/P2 | ⛔ Umowa | SDK partnerskie; interpretacja EKG — MDR |
| F2.11 | Natywne Garmin Health API (dane sportowe) | MVP/MLP | P1/P2 | ⛔ Umowa | klucz API / umowa partnerska |
| F2.12 | Polar Flow API (zmienność rytmu serca) | MVP/MLP | P1/P2 | ⛔ Umowa | klucz API / umowa partnerska |
| F2.13 | Bezpośrednie API Whoop | MVP/MLP | P1/P2 | ⛔ Umowa | klucz API / umowa partnerska |
| F2.14 | Wzorzec adaptera — łatwe dodawanie nowych urządzeń | MVP/MLP | P1/P2 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F2.15 | Natywna integracja z Eternal Station | MVP/MLP | P1/P2 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F2.16 | Natywna integracja z Eternal Implant (Bluetooth LE 5.4) | FINAL/R&D | P1/P2 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F2.17 | Integracja z inteligentną odzieżą (Hexoskin, Athos) | MVP/MLP | P1/P2 | ⛔ Umowa | klucz API / umowa partnerska |
| F2.18 | Inteligentna toaleta (Toi Labs, Casana Heart Seat) | MVP/MLP | P1/P2 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F2.19 | Inteligentna poduszka / materace (Eight Sleep, Withings Sleep) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | Withings Sleep przez integrację Withings (czas i fazy snu) |
| F2.20 | Fork otwartego Gadgetbridge (Xiaomi, Amazfit, Huawei, Honor) | MVP/MLP | P1/P2 | ⛔ Osobny produkt | osobna aplikacja Android (fork Gadgetbridge) |
| F2.21 | Uniwersalny adapter protokołów (dowolne urządzenie Bluetooth) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | tryb „dowolne urządzenie zgodne ze standardem” (6 profili GATT) |
| F2.22 | Strumieniowanie z interfejsu mózg–komputer (Neuralink, Synchron Stentrode) | FINAL/R&D | P1/P2 | ⛔ R&D | technologia w fazie badań |
| F2.23 | Telemetria nanobotów in vivo | SF / obserwacja | P1/P2 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F2.24 | Sieć kratowa implantów (wymiana P2P między implantami) | FINAL/R&D | P1/P2 | ⛔ R&D | technologia w fazie badań |
| F2.25 | Eternal Cloud Brain — kolektywna inteligencja z miliardów użytkowników (4 podzadania) | SF / obserwacja | P1/P2 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Country Layer (5)

✅ 2 · 🆕 1 · 🟡 0 · 🔧 0 · ⛔ 2

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A11.1 | Wykrywanie lokalizacji (GPS) | MVP/MLP | RDZEŃ / P1 | 🆕 Zrobione teraz | miasto albo położenie urządzenia zaokrąglone do ok. 1 km |
| A11.2 | Regionalne nawyki | MVP/MLP | RDZEŃ / P1 | ⛔ Ludzie | treści regionalne — redakcja |
| A11.3 | Tłumaczenie interfejsu | MVP/MLP | RDZEŃ / P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A11.4 | Standaryzacja jednostek | MVP/MLP | RDZEŃ / P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A11.5 | Rekomendacje regionalne | MVP/MLP | RDZEŃ / P1 | ⛔ Ludzie | treści regionalne — redakcja |

### Eternal ID / Family / Travel (7)

✅ 6 · 🆕 1 · 🟡 0 · 🔧 0 · ⛔ 0

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A24.1 | Konto rodzinne wieloprofilowe | MVP/MLP | P1 | ✅ Zrobione | konto z profilami: dziecko, osoba pod opieką, bliscy z kodem |
| A24.2 | Dostęp zastępczy | MVP/MLP | P1 | ✅ Zrobione | działanie w imieniu profilu; każdy dostęp w dzienniku tej osoby |
| A24.3 | Profil dziecka i raporty rodziny (A21.x, A4.2) | MVP/MLP | P1 | ✅ Zrobione | profil dziecka; raporty i karty w jego imieniu |
| A24.4 | Czasowe udostępnienie lekarzowi | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A24.5 | Dostęp ratunkowy z pełnym logiem | MVP/MLP | P1 | ✅ Zrobione | 60 min, uzasadnienie, powiadomienie pacjenta, przegląd administratora |
| A24.6 | Tryb offline aplikacji | MVP/MLP | P1 | 🆕 Zrobione teraz | jak A5.12 — także dla profilu osoby pod opieką |
| A24.7 | Karta zdrowia na wyjazd zagraniczny | MVP/MLP | P1 | ✅ Zrobione | PL/EN, 112, EKUZ; PDF do druku |

## Lekarz, placówka, leki i badania


### Eternal Care Access / Doctor (32)

✅ 14 · 🆕 1 · 🟡 1 · 🔧 0 · ⛔ 16

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F6.1 | Czat asynchroniczny z lekarzem (tekstowy) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.2 | Automatycznie generowany PDF w formacie SBAR (historia użytkownika) | MVP/MLP | P1 | ✅ Zrobione | raport SBAR w PDF przygotowany przez pacjenta |
| F6.3 | Sciaganie wyników + zalaczanie | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.4 | Subskrypcja (49 PLN/mies = 5 czatow) | MVP/MLP | P1 | ⛔ Umowa | operator płatności |
| F6.5 | Video konsultacja (WebRTC, LiveKit) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.6 | e-Recepta (P1 NFZ Online) | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 |
| F6.7 | Triaż AI (zaadaptowany system triażu manchesterskiego) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F6.8 | Kalendarz lekarzy + terminy | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.9 | Przypomnienia przed wizytą | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.10 | Nagrywanie konsultacji (za zgodą RODO) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F6.11 | 24/7 dostęp do specjalistow (500+ lekarzy) | MVP/MLP | P1 | ⛔ Ludzie | sieć lekarzy i umowy |
| F6.12 | AI co-pilot lekarza (LLM sugeruje diagnozy) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F6.13 | Rejestracja w szpitalach przez API | MVP/MLP | P1 | ⛔ Umowa | API szpitali |
| F6.14 | ePUAP integracja (e-skierowanie) | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 |
| F6.15 | Drugie opinie międzynarodowe | MVP/MLP | P1 | ⛔ Ludzie | sieć lekarzy i umowy |
| F6.16 | Pełna integracja z Eternal Lab (M10) | MVP/MLP | P1 | ⛔ Osobny produkt | produkt Eternal Labs |
| F6.17 | Holonet hologram konsultacji | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F6.18 | BCI telepatia z lekarzem | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F6.19 | Autonomiczny lekarz — ogólna sztuczna inteligencja (bez człowieka) (4 podzadania) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A5.1 | Wideokonsultacja | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.2 | Medical Snapshot | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.3 | Ratunek jednym kliknięciem | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.4 | Nagrywanie konsultacji | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.5 | Ankiety / zdalny wywiad AI | MVP/MLP | P1 | 🟡 Częściowo | ankiety i wywiad przed wizytą bez AI |
| A5.6 | E-recepty (P1) | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 |
| A5.7 | E-skierowania | MVP/MLP | P1 | ⛔ Umowa | Platforma P1 |
| A5.8 | Przypomnienia o wizytach | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.9 | Pętla zamknięta (ze Station) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| A5.10 | Przycisk SOS *(z S4.2)* | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A5.11 | Triaż na urządzeniu *(z S4.3)* | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A5.12 | Tryb offline *(z S4.4)* | MVP/MLP | P1 | 🆕 Zrobione teraz | kopia karty, leków z godzinami, wizyt i telefonu placówki na urządzeniu — po decyzji pacjenta; web i telefon |
| A5.13 | Panel dla opiekuna *(z S4.5)* | MVP/MLP | P1 | ✅ Zrobione | panel opiekuna w aplikacji |

### Eternal Doctor / Clinic OS (7)

✅ 4 · 🆕 1 · 🟡 1 · 🔧 0 · ⛔ 1

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A12.1 | Nagrywanie konsultacji | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A12.2 | Transkrypcja nagrań | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A12.3 | Ankiety okresowe | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A12.4 | Zdalny wywiad AI | MVP/MLP | P1 | 🟡 Częściowo | wywiad przed wizytą w formie rozmowy, bez AI (M27) |
| A12.5 | Auto-dokumentacja | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A12.6 | Kodowanie ICD | MVP/MLP | P1 | 🆕 Zrobione teraz | lekarz wybiera kod ICD-10 ze słownika; zapis jako FHIR Condition |
| A12.7 | Integracja z systemem gabinetowym | MVP/MLP | P1 | ⛔ Umowa | dostawcy systemów gabinetowych |

### Eternal Assistant / Doctor (33)

✅ 2 · 🆕 0 · 🟡 3 · 🔧 6 · ⛔ 22

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F4.1 | Czat z modelem językowym (strumieniowanie tekstu) | MVP/MLP | P1 | 🔧 Mogę zrobić | tylko edukacja z zatwierdzonych źródeł, bez danych pacjenta — po decyzji o przeznaczeniu |
| F4.2 | RAG na PubMed (35M+ artykulow) | MVP/MLP | P1 | 🔧 Mogę zrobić | tylko edukacja z zatwierdzonych źródeł, bez danych pacjenta — po decyzji o przeznaczeniu |
| F4.3 | RAG na przeglądach Cochrane | MVP/MLP | P1 | ⛔ Umowa | licencje na treści (Cochrane, wytyczne) |
| F4.4 | RAG na polskie wytyczne (AOTMiT, KGL) | MVP/MLP | P1 | ⛔ Umowa | licencje na treści (Cochrane, wytyczne) |
| F4.5 | PRZEKIEROWANIE KRYZYSOWE 116 123 (zdrowie psychiczne) — NIEPRZESŁANIALNE | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F4.6 | Łączenie cytowań (każda odpowiedź ma źródło) | MVP/MLP | P1 | 🟡 Częściowo | odnośniki do źródeł w notatce Scribe i raporcie faktów |
| F4.7 | Pamięć wielu tur (cała historia rozmowy) | MVP/MLP | P1 | 🔧 Mogę zrobić | tylko edukacja z zatwierdzonych źródeł, bez danych pacjenta — po decyzji o przeznaczeniu |
| F4.8 | Personalizacja (LLM zna historie zdrowia) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.9 | Integracja z dietetyka | MVP/MLP | P1 | ⛔ Ludzie | dietetyk |
| F4.10 | Proaktywne alerty ('Zauwazylem, ze...') | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.11 | Tryb głosowy (Whisper + ElevenLabs) | MVP/MLP | P1 | ⛔ Umowa | synteza mowy (dostawca TTS); mowa→tekst już działa w Scribe |
| F4.12 | Wielojezycznosc (PL, EN, DE, FR) | MVP/MLP | P1 | 🟡 Częściowo | PL i EN; DE/FR — kolejne tłumaczenia |
| F4.13 | Wywoływanie funkcji (model językowy planuje wizytę, zleca badania) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.14 | Analiza nastroju wypowiedzi (wykrywa kryzys emocjonalny → przekierowanie) | MVP/MLP | P1 | 🟡 Częściowo | słowa kryzysowe → numery pomocy (bez modelu analizy nastroju) |
| F4.15 | AI przyczynowa (rozumowanie przyczynowo-skutkowe) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.16 | Rozumowanie cyfrowego bliźniaka („co będzie, gdy zacznę biegać?") | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.17 | Proaktywna interwencja (model językowy dzwoni, gdy widzi ryzyko) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.18 | Uczenie federacyjne (uczy się od użytkowników bez wycieku danych) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F4.19 | Multi-agent (Lekarz LLM + Dietetyk LLM + Trener LLM) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.20 | Wnioskowanie na urządzeniu (model językowy 7B na telefonie, pełna prywatność) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F4.21 | Autonomiczny lekarz — ogólna sztuczna inteligencja | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.22 | Telepatyczna komunikacja przez BCI | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F4.23 | Empatyczne AI (rozpoznaje emocje z biometrii) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F4.24 | Kwantowy model językowy (komputery kwantowe — 1000× szybsze rozumowanie) (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A6.1 | Chatbot medyczny (RAG) | MVP/MLP | P1 | 🔧 Mogę zrobić | edukacja i motywacja bez danych zdrowotnych — po decyzji o przeznaczeniu |
| A6.2 | Cytowanie źródeł | MVP/MLP | P1 | 🔧 Mogę zrobić | edukacja i motywacja bez danych zdrowotnych — po decyzji o przeznaczeniu |
| A6.3 | Chatbot motywacyjny | MVP/MLP | P1 | 🔧 Mogę zrobić | edukacja i motywacja bez danych zdrowotnych — po decyzji o przeznaczeniu |
| A6.4 | Tłumaczenie wyników (opis) | MVP/MLP | P1 | ✅ Zrobione | słownik objaśnień zatwierdzany przez lekarza, bez AI |
| A6.5 | Diagnostyka wstępna (triaż) — wsparcie decyzji klinicznej | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A6.6 | Spersonalizowane rekomendacje | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A6.7 | Analiza korelacji pogoda↔samopoczucie | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A6.8 | Predykcja ryzyka chorób | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A6.9 | AGI (uczenie całożyciowe) | MVP/MLP | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Medication (25)

✅ 4 · 🆕 4 · 🟡 1 · 🔧 0 · ⛔ 16

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F7.1 | Lista aptek w okolicy (Google Places) | MVP/MLP | P1 | 🆕 Zrobione teraz | wyszukiwarka aptek z importu Rejestru Aptek; „w pobliżu” ze współrzędnych rejestru |
| F7.2 | Godziny otwarcia + telefon | MVP/MLP | P1 | 🆕 Zrobione teraz | adres, telefon i godziny z Rejestru Aptek |
| F7.3 | Wyszukiwarka leku po nazwie | MVP/MLP | P1 | ✅ Zrobione | wyszukiwarka RPL |
| F7.4 | Mapa z wyznaczaniem trasy (Google Maps) | MVP/MLP | P1 | 🆕 Zrobione teraz | trasa w OpenStreetMap, Google albo Apple Maps — bez wysyłania położenia |
| F7.5 | Dostępność leku w czasie rzeczywistym | MVP/MLP | P1 | ⛔ Umowa | apteki / serwis dostępności leków |
| F7.6 | Rezerwacja online (apteki polaczone API) | MVP/MLP | P1 | ⛔ Umowa | apteki / serwis dostępności leków |
| F7.7 | Porównanie cen (refundacja vs pełna) | MVP/MLP | P1 | 🆕 Zrobione teraz | informacja z obwieszczenia MZ (import CSV): poziom odpłatności, dopłata, wskazania |
| F7.8 | Substytuty (jeśli lek niedostępny) | FINAL/R&D | P1 | ⛔ MDR | dobór zamiennika = porada farmaceutyczna |
| F7.9 | Powiadomienie push „lek dostępny w aptece X" | MVP/MLP | P1 | ⛔ Umowa | apteki / serwis dostępności leków |
| F7.10 | Dostawa dronem (Flytrex, Zipline — pilotaż w Polsce) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F7.11 | Kurier w godzinę (integracja z Glovo, Uber Eats) | MVP/MLP | P1 | ⛔ Prawo | wysyłkowo apteka może sprzedawać tylko leki bez recepty (art. 68 ust. 3 Pf); alternatywa: rezerwacja i odbiór w aptece |
| F7.12 | Odbiór w ramach subskrypcji w Eternal Station | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F7.13 | Skrypt Telemedi + apteka razem | MVP/MLP | P1 | ⛔ Umowa | apteki / serwis dostępności leków |
| F7.14 | Replikator domowy | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F7.15 | Atomowy druk leków (4 subtaski) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A20.1 | Rejestr przyjmowanych leków | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A20.2 | (nazwa w rejestrze nieczytelna — paszport lekowy) | MVP/MLP | P1 | ❔ Do doprecyzowania | pozycja w rejestrze bez czytelnej nazwy |
| A20.3 | Alergie i przeciwwskazania | MVP/MLP | P1 | 🟡 Częściowo | alergie z ankiety i karty ratunkowej |
| A20.4 | Połóg i karmienie | MVP/MLP | P1 | ⛔ MDR | bezpieczeństwo leków w karmieniu — ocena farmakoterapii |
| A20.5 | (nazwa w rejestrze nieczytelna — paszport lekowy) | MVP/MLP | P1 | ❔ Do doprecyzowania | pozycja w rejestrze bez czytelnej nazwy |
| A20.6 | (nazwa w rejestrze nieczytelna: „100–150k”) | MVP/MLP | P1 | ❔ Do doprecyzowania | pozycja w rejestrze bez czytelnej nazwy |
| A20.7 | Szczepienia | MVP/MLP | P1 | ✅ Zrobione | szczepienia wykonane i planowane |
| A20.8 | Siatki centylowe | MVP/MLP | P1 | ⛔ MDR | siatki centylowe = porównanie z normą (decyzja kwalifikacyjna) |
| A20.9 | Wywiad rodzinny | MVP/MLP | P1 | ✅ Zrobione | krewny, choroby, wiek zachorowania — bez oceny ryzyka |
| A20.10 | Integracja z e-kartami (szczepień) | MVP/MLP | P1 | ⛔ Umowa | e-karta szczepień w P1 |

### Eternal Labs (15)

✅ 1 · 🆕 0 · 🟡 0 · 🔧 1 · ⛔ 13

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F10.1 | Lista laboratoriów w okolicy | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.2 | Ceny + porównanie (Synevo, Diagnostyka, ALAB) | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.3 | Zamówienie (link do partnera) | MVP/MLP | P1 | 🔧 Mogę zrobić | zwykły link do partnera; z prowizją — umowa |
| F10.4 | Wyniki przez OCR (M3) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F10.5 | Integracja API z Synevo (wyniki w aplikacji) | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.6 | Zamówienie jednym kliknięciem (z receptą z M3) | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.7 | Pakiety profilaktyczne (Eternal Checkup Basic/Plus/Premium) | MVP/MLP | P1 | ⛔ Ludzie | dobór pakietów — lekarz |
| F10.8 | Pielegniarka w domu (uPacjenta) | MVP/MLP | P1 | ⛔ Ludzie | pielęgniarki (np. uPacjenta) |
| F10.9 | Model subskrypcyjny (rok badań profilaktycznych) | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.10 | Eternal Lab Pop-up (kontener czynny całą dobę przy markecie) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F10.11 | Wyniki dostarczane dronem | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F10.12 | Integracja z Eternal Station (podstawowe badanie krwi w domu) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F10.13 | Pełna integracja P1 NFZ (refundacja) | MVP/MLP | P1 | ⛔ Umowa | umowy z laboratoriami / P1 / płatności |
| F10.14 | Implant ciągłe monitoring | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F10.15 | Laboratorium z nanobotów in vivo (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Care Access / Forge (8)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 8

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A10.1 | Leki (e-Recepta) | MVP/MLP | P1/P7 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A10.2 | Leki z dostawą (1h/drona) | MVP/MLP | P1/P7 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| A10.3 | Badania laboratoryjne (domowe) | MVP/MLP | P1/P7 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A10.4 | Badania laboratoryjne (punkty pobrań) | MVP/MLP | P1/P7 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A10.5 | Opieka domowa | MVP/MLP | P1/P7 | ⛔ Ludzie | usługa świadczona przez ludzi |
| A10.6 | Lekarz z dojazdem | MVP/MLP | P1/P7 | ⛔ Ludzie | usługa świadczona przez ludzi |
| A10.7 | ZnanyLekarz / specjaliści | MVP/MLP | P1/P7 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A10.8 | Suplementy (automatyczne zamawianie) | MLP | P1/P7 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |

## Wellness, zdrowie psychiczne, rodzina i senior


### Eternal Wellness Composer (66)

✅ 1 · 🆕 10 · 🟡 2 · 🔧 7 · ⛔ 46

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F9.1 | Śledzenie snu z urządzenia noszonego (M2) | MVP/MLP | P1 | 🆕 Zrobione teraz | sen z telefonu, zegarka albo Withings Sleep |
| F9.2 | Wynik snu 0–100 | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F9.3 | Fazy snu (płytki / głęboki / REM) | MVP/MLP | P1 | 🆕 Zrobione teraz | fazy snu tak, jak policzyło urządzenie — bez oceny |
| F9.4 | Sugestie 'spij 23:00' | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F9.5 | Inteligentny budzik (budzi w fazie płytkiego snu) | MVP/MLP | P1 | ⛔ Osobny produkt | czujniki telefonu w aplikacji natywnej — badania |
| F9.6 | Chronobiologia (początek wydzielania melatoniny w słabym świetle — DLMO) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F9.7 | Coaching snu (8-tygodniowy program) | MVP/MLP | P1 | 🔧 Mogę zrobić | program edukacyjny (higiena snu) — treść do zatwierdzenia |
| F9.8 | Inteligentna poduszka (Eight Sleep, Withings) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F9.9 | CBT-I (terapia poznawcza bezsenności) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F9.10 | Biały szum / dudnienia binauralne | MVP/MLP | P1 | 🔧 Mogę zrobić | odtwarzacz dźwięków — treść audio |
| F9.11 | Przypomnienia o terapii światłem | MVP/MLP | P1 | 🆕 Zrobione teraz | przypomnienia ustawiane przez pacjenta (np. terapia światłem) |
| F9.12 | Sen dopasowany do genetyki (integracja z M16) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F9.13 | Dziennik snów + interpretacja | MVP/MLP | P1 | 🟡 Częściowo | dziennik snów bez interpretacji (interpretacja — poza granicą) |
| F9.14 | Wykrywanie bezdechu sennego (audio + HR) | MLP/FINAL (regulowany) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F9.15 | Spersonalizowany zegar okołodobowy | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F9.16 | Synchronizacja partnera (rodzina) | MVP/MLP | P1 | 🟡 Częściowo | profile rodzinne |
| F9.17 | Sterowanie świadomym śnieniem przez interfejs mózg–komputer | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F9.18 | Nauka we śnie (podczas fazy REM) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F9.19 | Wspólne śnienie (Matrix) (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F11.1 | Dziennik żywienia (ręczny) | MVP/MLP | P1 | 🆕 Zrobione teraz | dziennik posiłków z sumą wartości z etykiet |
| F11.2 | Rozpoznawanie jedzenia ze zdjęcia (oparte na modelu językowym) | MVP/MLP | P1 | 🔧 Mogę zrobić | wellness (W0); rozpoznanie przez model z rejestru AI — walidacja jakości |
| F11.3 | Baza Open Food Facts (ponad 1 mln produktów) | MVP/MLP | P1 | 🆕 Zrobione teraz | kod kreskowy i wyszukiwanie w Open Food Facts |
| F11.4 | Licznik kalorii | MVP/MLP | P1 | 🆕 Zrobione teraz | sumy kcal i makroskładników dzień po dniu |
| F11.5 | Makroskładniki (białko / tłuszcz / węglowodany) | MVP/MLP | P1 | 🆕 Zrobione teraz | makroskładniki z etykiet, bez oceny diety |
| F11.6 | Sugestie generyczne ('jedz więcej warzyw') | MVP/MLP | P1 | 🔧 Mogę zrobić | zalecenia ogólne z zatwierdzonej treści |
| F11.7 | Personalizacja na bazie badań | MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F11.8 | Plan jadlospisu na tydzien | MVP/MLP | P1 | ⛔ Ludzie | dietetyk |
| F11.9 | Lista zakupów + integracja Frisco/Carrefour | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F11.10 | Suplementacja indywidualna (Eternal Station) | MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F11.11 | Interakcje lek-suplement | MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F11.12 | Allergeny (z badań) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F11.13 | Dieta genomiczna (geny CYP, MTHFR, FTO) | MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F11.14 | Microbiom (z testu, np. Atlas Biomed) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F11.15 | Kucharz AI (przepisy z modelu językowego) | MVP/MLP | P1 | 🔧 Mogę zrobić | przepisy z modelu (W0) — bez zaleceń zdrowotnych |
| F11.16 | Integracja z inteligentną lodówką (Samsung Family Hub) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F11.17 | Integracja z ciągłym monitorem glukozy (CGM z M2) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F11.18 | Replikator jedzenia | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F11.19 | Nanosuplementy in vivo | MLP | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F11.20 | Autonomiczny dietetyk — ogólna sztuczna inteligencja (4 podzadania) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F12.1 | Śledzenie z urządzenia noszonego (M2) | MVP/MLP | P1 | 🆕 Zrobione teraz | kroki dziennie z telefonu |
| F12.2 | Integracja ze Strava (odczyt) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F12.3 | Tygodniowy plan treningowy (generowany przez model językowy) | MVP/MLP | P1 | ⛔ MDR | plan dopasowany do stanu zdrowia = ocena |
| F12.4 | VO2max + wskaźnik regeneracji | MVP/MLP | P1 | ⛔ MDR | plan dopasowany do stanu zdrowia = ocena |
| F12.5 | Lista ćwiczeń z video (200+) | MVP/MLP | P1 | 🔧 Mogę zrobić | biblioteka zrobię; nagrania wideo — produkcja |
| F12.6 | Sprawdzanie techniki na wideo (ocena pozy, MediaPipe) | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| F12.7 | Zajęcia grupowe (na żywo) | MVP/MLP | P1 | ⛔ Ludzie | trenerzy |
| F12.8 | Wydolność sportowa (FTP, próg mleczanowy) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F12.9 | Periodization (plany sezonowe) | MVP/MLP | P1 | ⛔ Ludzie | trenerzy |
| F12.10 | Planowanie dnia zawodów (maraton, triathlon) | MVP/MLP | P1 | ⛔ Ludzie | trenerzy |
| F12.11 | Integracja z inteligentną odzieżą (Hexoskin, Athos) | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| F12.12 | VR fitness (Supernatural, Holofit) | MVP/MLP | P1 | ⛔ Osobny produkt | inny produkt / platforma niż ta aplikacja |
| F12.13 | Optymalizacja wydajności w e-sporcie | MVP/MLP | P1 | ⛔ Osobny produkt | inny produkt / platforma niż ta aplikacja |
| F12.14 | Automatyzacja regeneracji (Eternal Station) | MVP/MLP | P1 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| F12.15 | Adaptacyjny trener AI (uczy się z każdym treningiem) | MVP/MLP | P1 | ⛔ MDR | plan dopasowany do stanu zdrowia = ocena |
| F12.16 | Nanoaugmentacja (budowa mięśni nanobotami) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F12.17 | Bioniczne ulepszenia (implanty zwiększające wydolność) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F12.18 | Ulepszenia transhumanistyczne (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A7.1 | Plany treningowe (AI) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A7.2 | Plany dietetyczne (AI) | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A7.3 | Plany suplementacyjne (AI) | MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A7.4 | Sugestie suplementów | MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A7.5 | Analiza składu posiłków (zdjęcie) | MVP/MLP | P1 | 🔧 Mogę zrobić | jak F11.2 (W0) |
| A7.6 | Cele i śledzenie postępów | MVP/MLP | P1 | ✅ Zrobione | cele tygodniowe liczone z danych aplikacji |
| A7.7 | Przypomnienia profilaktyczne | MVP/MLP | P1 | 🆕 Zrobione teraz | programy NFZ wg rocznika; treść do zatwierdzenia przez lekarza (CLI) |
| A7.8 | Geolokalizacja w planach | MVP/MLP | P1 | 🆕 Zrobione teraz | miejsce w przypomnieniu i w planie ćwiczeń z odnośnikiem do mapy |
| A7.9 | Plany pooperacyjne / nanotech | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |

### Eternal Wellness Composer / Station (21)

✅ 2 · 🆕 4 · 🟡 1 · 🔧 0 · ⛔ 14

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F5.1 | Pogoda (OpenWeatherMap, bezpłatny plan) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | dane synoptyczne IMGW dla stacji wybranej albo miasta |
| F5.2 | Smog (API Airly, IMGW gov.pl) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | Polski Indeks Jakości Powietrza GIOŚ z najbliższej stacji |
| F5.3 | HRV z urządzenia noszonego (Garmin / Oura) | MVP/MLP | P1/P2 | ⛔ Umowa | API urządzeń (Garmin, Oura, Whoop) |
| F5.4 | Dzienny wynik 0–100 (prosty algorytm) | MVP/MLP | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.5 | Poranne powiadomienie push (planer dnia) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | poranne podsumowanie dnia; push bez danych o zdrowiu |
| F5.6 | Integracja z Kalendarzem Google | MVP/MLP | P1/P2 | ✅ Zrobione | subskrypcja ICS z ogólnymi nazwami (Google, Apple, Outlook) |
| F5.7 | Integracja z Kalendarzem Apple | MVP/MLP | P1/P2 | ✅ Zrobione | subskrypcja ICS z ogólnymi nazwami (Google, Apple, Outlook) |
| F5.8 | Integracja z urządzeniem śledzącym sen (Oura, Whoop) | MVP/MLP | P1/P2 | ⛔ Umowa | API urządzeń (Garmin, Oura, Whoop) |
| F5.9 | Ocena punktowa diety (z M11) | MVP/MLP | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.10 | Personalizowane sugestie ('trening na 16:00') | MVP/MLP | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.11 | Predykcja samopoczucia za 1-3 dni | MVP/MLP | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.12 | Alert pogody (np. burza -> lek prewencyjny) | MLP/FINAL (regulowany) | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.13 | Model przyczynowy (co dokładnie wpływa na samopoczucie) | MVP/MLP | P1/P2 | ⛔ R&D | technologia w fazie badań |
| F5.14 | Predykcja 7-30 dni naprzod | MVP/MLP | P1/P2 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F5.15 | Multi-user planer (rodzina, partner) | MVP/MLP | P1/P2 | 🟡 Częściowo | profile rodzinne + kalendarz każdego profilu |
| F5.16 | Integracja Eternal Twin (M14) | MVP/MLP | P1/P2 | ⛔ Osobny produkt | produkt P4 Digital Twin |
| F5.17 | Alerty strefowe (wjeżdżasz w strefę smogu) | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | powiadomienie o przekroczeniu wybranej kategorii GIOŚ |
| F5.18 | Zegar biorytmu (chronobiologia) | MVP/MLP | P1/P2 | ⛔ R&D | technologia w fazie badań |
| F5.19 | Osobiste sterowanie mikroklimatem (w pomieszczeniu) | SF / obserwacja | P1/P2 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F5.20 | Sprzężenie mózg–pogoda przez interfejs mózg–komputer | MVP/MLP | P1/P2 | ⛔ R&D | technologia w fazie badań |
| F5.21 | Kwantowa predykcja chaosu (4 podzadania) | MVP/MLP | P1/P2 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Wellness Composer / Digital Twin (15)

✅ 0 · 🆕 1 · 🟡 1 · 🔧 0 · ⛔ 13

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F13.1 | Wiek biologiczny algorytm (z HRV+VO2+BMI+ciśnienie) | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.2 | Trend miesięczny | MLP/R&D | P1/P4 | 🟡 Częściowo | raport okresowy i wykresy trendów |
| F13.3 | Porównanie z grupą rówieśniczą | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.4 | Grywalizacja (osiągnięcia, odznaki) | MLP/R&D | P1/P4 | 🆕 Zrobione teraz | odznaki za regularność — liczone z dni z zapisem, nie z wartości |
| F13.5 | Wiek epigenetyczny (metylacja DNA) | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.6 | Długość telomerów | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.7 | Markery długowieczności (CRP, GlycA, ApoB) | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.8 | Spersonalizowany wskaźnik długowieczności | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.9 | Predykcja rocznego pogorszenia | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.10 | Starzenie się poszczególnych narządów | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.11 | Przyczynowa analiza starzenia | MLP/R&D | P1/P4 | ⛔ R&D | technologia w fazie badań |
| F13.12 | Rekomendacje interwencji (długowieczność) | MLP/R&D | P1/P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F13.13 | Trendy starzenia w drzewie rodzinnym | MLP/R&D | P1/P4 | ⛔ R&D | technologia w fazie badań |
| F13.14 | Odwracanie starzenia (czynniki Yamanaki podawane nanotechnologią) | SF / obserwacja | P1/P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F13.15 | Digital twin starzenia (4 subtaski) | MLP/R&D | P1/P4 | ⛔ R&D | technologia w fazie badań |

### Eternal Mental Health (28)

✅ 8 · 🆕 0 · 🟡 0 · 🔧 1 · ⛔ 19

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F8.1 | PRZEKIEROWANIE KRYZYSOWE 116 123 (OBOWIĄZKOWE, BEZ MOŻLIWOŚCI NADPISANIA) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F8.2 | Dziennik nastroju (codziennie, skala 1–10) | MVP/MLP | P1 | ✅ Zrobione | nastrój 1–10 z czynnikami; numery pomocy przy bardzo niskim |
| F8.3 | Medytacje prowadzone audio (10 bezpłatnych) | MVP/MLP | P1 | 🔧 Mogę zrobić | odtwarzacz zrobię; nagrania — lektor i psycholog |
| F8.4 | Lista numerow kryzysowych (regionalne) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F8.5 | Bezpieczna książka adresowa (zaufana osoba) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| F8.6 | Terapia online (sieć psychologów) | MLP/FINAL (regulowany/R&D) | P1 | ⛔ Ludzie | sieć psychologów |
| F8.7 | Moduły CBT (terapia poznawczo-behawioralna) | MLP/FINAL (regulowany/R&D) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.8 | Terapeuta oparty na modelu językowym (BioMistral dostrojony na dialogach) | MLP/FINAL (regulowany/R&D) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.9 | Analiza nastroju wpisów w dzienniku (model językowy wykrywa trendy) | MLP/FINAL (regulowany/R&D) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.10 | Sen + alerty korelacji ze stresem | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.11 | Medytacja w VR (Oculus, Apple Vision Pro) | MVP/MLP | P1 | ⛔ Osobny produkt | aplikacja VR |
| F8.12 | Neurofeedback (Muse 2/S, Mendi) | MLP/FINAL (regulowany/R&D) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.13 | Terapia wspomagana psychodelikami (po legalizacji w Polsce) | MVP/MLP | P1 | ⛔ Prawo | niedozwolone obecnie prawem |
| F8.14 | Śledzenie snu + dziennik snów (integracja z M5) | MVP/MLP | P1 | ✅ Zrobione | dziennik snu i snów, bez interpretacji |
| F8.15 | Sesje terapii grupowej w VR | MLP/FINAL (regulowany/R&D) | P1 | ⛔ Ludzie | sieć psychologów |
| F8.16 | Nanoboty regulacja neuroprzekaznikow | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F8.17 | Modulacja nastroju przez interfejs mózg–komputer | MLP/FINAL (regulowany/R&D) | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F8.18 | Zrzut traumy (przeniesienie traumy do cyfrowego bliźniaka) (4 podzadania) | SF / obserwacja | P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A8.1 | Dziennik nastroju | MVP/MLP | P1 | ✅ Zrobione | nastrój 1–10 z czynnikami; numery pomocy przy bardzo niskim |
| A8.2 | Wykrywanie nastroju z urządzeń noszonych | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A8.3 | Czat z psychologiem | MVP/MLP | P1 | ⛔ Ludzie | psycholodzy i psychiatrzy (wideo działa) |
| A8.4 | Wideokonsultacja z psychiatrą | MVP/MLP | P1 | ⛔ Ludzie | psycholodzy i psychiatrzy (wideo działa) |
| A8.5 | Trener AI 24/7 | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A8.6 | Techniki oddechowe / uważność | MVP/MLP | P1 | ✅ Zrobione | ćwiczenia 4-6, 4-4-4-4, 4-7-8 z animacją |
| A8.7 | Wykrywanie EEG | MVP/MLP | P1 | ⛔ Sprzęt | urządzenia EEG/TMS — wyroby medyczne |
| A8.8 | Stymulacja mózgu (TMS) | MVP/MLP | P1 | ⛔ Sprzęt | urządzenia EEG/TMS — wyroby medyczne |
| A8.9 | BCI dla zdrowia psychicznego | MLP/FINAL (regulowany/R&D) | P1 | ⛔ R&D | technologia w fazie badań |
| A8.10 | Przekierowanie 116 123 (obowiązkowe) | MVP/MLP | P1 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |

### Eternal App / Personalization Composer (21)

✅ 3 · 🆕 1 · 🟡 3 · 🔧 2 · ⛔ 12

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A17.1 | Autonomiczny opiekun zdrowia | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A17.2 | Rozpoznawanie stanu emocjonalnego | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A17.3 | Lustro bliźniaka | MLP→R&D | P1 | ⛔ R&D | technologia w fazie badań |
| A17.4 | Przypomnienia kontekstowe | MVP/MLP | P1 | 🟡 Częściowo | przypomnienia o lekach, wizytach, ankiety we właściwym momencie; kontekst miejsca — następna runda |
| A17.5 | Wyprzedzające podpowiedzi | MVP/MLP | P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A17.6 | Łącznik rodzinny | MVP/MLP | P1 | ✅ Zrobione | kod zaproszenia dla bliskiej osoby; podgląd albo pełny dostęp |
| A17.7 | Transmisja danych na żywo | MVP/MLP | P1 | 🟡 Częściowo | synchronizacja na żywo (SSE), telemonitoring |
| A17.8 | (pozycja bez nazwy w rejestrze — „Autonomia / kontekst”) | MVP/MLP | P1 | ❔ Do doprecyzowania | pozycja w rejestrze bez nazwy („**”) |
| A17.9 | Zbiorczy wynik społeczności | MVP/MLP | P1 | 🔧 Mogę zrobić | zanonimizowane statystyki aktywności — produkt P5 |
| A17.10 | Interfejs głosowy | MVP/MLP | P1 | 🆕 Zrobione teraz | sterowanie głosem w przeglądarce tylko do nawigacji |
| A17.11 | Integracja z domem inteligentnym | MVP/MLP | P1 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A17.12 | Analiza formy ćwiczeń z kamery | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |
| A17.13 | Kalendarz zdrowotny | MVP/MLP | P1 | ✅ Zrobione | wizyty, szczepienia, ćwiczenia, leki; subskrypcja ICS |
| A17.14 | Zegar epigenetyczny | FINAL/R&D | P1 | ⛔ R&D | technologia w fazie badań |
| A17.15 | Zegar epigenetyczny | FINAL/R&D | P1 | ⛔ R&D | technologia w fazie badań |
| A17.16 | Skaner posiłków | MVP/MLP | P1 | 🔧 Mogę zrobić | jak F11.2 (W0) |
| A17.17 | Doradca zdrowia w podróży | MVP/MLP | P1 | 🟡 Częściowo | karta zdrowia PL/EN; porady szczepień przed podróżą — lekarz medycyny podróży |
| A17.18 | Kalendarz zdrowotny | MVP/MLP | P1 | ✅ Zrobione | wizyty, szczepienia, ćwiczenia, leki; subskrypcja ICS |
| A17.19 | Wnioski z danych genetycznych | FINAL/R&D | P1 | ⛔ MDR | interpretacja genetyczna |
| A17.20 | Zegar epigenetyczny | FINAL/R&D | P1 | ⛔ R&D | technologia w fazie badań |
| A17.21 | Optymalizator rytmu dobowego | MVP/MLP | P1 | ⛔ R&D | technologia w fazie badań |

### Eternal Women & Family (11)

✅ 5 · 🆕 3 · 🟡 2 · 🔧 0 · ⛔ 1

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A21.1 | Łącznik rodzinny (A21.11) | MVP/MLP | P1 | ✅ Zrobione | kod zaproszenia dla drugiego rodzica lub bliskiej osoby |
| A21.2 | Płodność i planowanie ciąży | MVP/MLP | P1 | 🆕 Zrobione teraz | dziennik cyklu z historią, bez prognoz dni płodnych |
| A21.3 | Mapa i skale bólu | MVP/MLP | P1 | ✅ Zrobione | mapa ciała + skala 0–10 |
| A21.4 | Połóg i karmienie | MVP/MLP | P1 | 🆕 Zrobione teraz | połóg i karmienie; słowa kryzysowe → numery pomocy |
| A21.5 | Menopauza i okres okołomenopauzalny | MVP/MLP | P1 | 🆕 Zrobione teraz | objawy okołomenopauzalne 0–3, bez oceny |
| A21.6 | Profil dziecka | MVP/MLP | P1 | ✅ Zrobione | profil dziecka z oświadczeniem rodzica; dostęp wygasa w 18. urodziny |
| A21.7 | Kalendarz szczepień dziecka | MVP/MLP | P1 | 🟡 Częściowo | terminy z karty szczepień dziecka; kalendarz PSO — treść zatwierdzona przez lekarza |
| A21.8 | Siatki centylowe i rozwój | MVP/MLP | P1 | ⛔ MDR | siatki centylowe |
| A21.9 | Wywiad rodzinny | MVP/MLP | P1 | ✅ Zrobione | krewny, choroby, wiek zachorowania — bez oceny ryzyka |
| A21.10 | Zdrowie rodziny jako całości | MVP/MLP | P1 | 🟡 Częściowo | panel opiekuna dla całej rodziny |
| A21.11 | Łącznik rodzinny | MVP/MLP | P1 | ✅ Zrobione | kod zaproszenia dla drugiego rodzica lub bliskiej osoby |

### Eternal Senior / Rehab (7)

✅ 5 · 🆕 1 · 🟡 1 · 🔧 0 · ⛔ 0

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A22.1 | Konto rodzinne / wieloprofilowe | MVP/MLP | P1/P2 | ✅ Zrobione | konto z profilami: dziecko, osoba pod opieką, bliscy z kodem |
| A22.2 | Ocena czynności dnia codziennego | MVP/MLP | P1/P2 | 🆕 Zrobione teraz | czynności dnia (Katz, Lawton) bez liczenia punktów |
| A22.3 | Mapa i skale bólu | MVP/MLP | P1/P2 | ✅ Zrobione | mapa ciała + skala 0–10 |
| A22.4 | Plan rehabilitacji z kontrolą wykonania | MVP/MLP | P1/P2 | ✅ Zrobione | plan od lekarza, odhaczanie, „x z y” sesji |
| A22.5 | Oświadczenie woli i dyspozycje medyczne | MVP/MLP | P1/P2 | ✅ Zrobione | informacyjnie; wybrane dyspozycje na karcie ratunkowej |
| A22.6 | Panel dla opiekuna rozszerzony | MVP/MLP | P1/P2 | ✅ Zrobione | panel opiekuna: wizyty, leki dziś, wiadomości |
| A22.7 | Tryb senioralny | MVP/MLP | P1/P2 | 🟡 Częściowo | duży tekst, kontrast, prosty język; osobny uproszczony układ — następna runda |

## Nadzór, dane, bliźniak cyfrowy i genetyka


### Eternal Control Plane (19)

✅ 13 · 🆕 0 · 🟡 4 · 🔧 0 · ⛔ 2

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A18.1 | Instrukcja w aplikacji, wersjonowana | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.2 | Karta modelu dla użytkownika | MVP/MLP | RDZEŃ | ✅ Zrobione | karty zastosowań AI dla pacjenta i personelu |
| A18.3 | Deklaracja przeznaczenia i ograniczeń — co wyrób NIE robi | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.4 | Zgłaszanie incydentu przez użytkownika | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.5 | Monitoring dryfu modelu | MVP/MLP | RDZEŃ | 🟡 Częściowo | miernik poprawek notatek Scribe; formalny monitoring dryfu — przy produkcji |
| A18.6 | Rejestr zastosowań AI | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.7 | Kontrolowana dystrybucja aktualizacji | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.8 | Tryb degradacji przy awarii | MVP/MLP | RDZEŃ | ✅ Zrobione | baner z opisem trybu zastępczego (web i mobile) |
| A18.9 | S8 — usługi regulacyjne | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.10 | Log dostępu | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.11 | Granularne wycofanie zgody | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A18.12 | Usunięcie danych z potwierdzeniem | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A19.1 | Oznaczanie treści generowanej | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A19.2 | Cytowanie źródeł odpowiedzi (nazwa w rejestrze niepełna) | MVP/MLP | RDZEŃ | 🟡 Częściowo | odnośniki do źródeł w notatce (nazwa w rejestrze niepełna) |
| A19.3 | Alergie i przeciwwskazania | MVP/MLP | RDZEŃ | 🟡 Częściowo | alergie w ankiecie i na kartach; sprawdzanie przeciwwskazań — MDR |
| A19.4 | Interakcje lek–suplement | MLP | RDZEŃ | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A19.5 | Farmakogenomika — dobór leku wg genotypu | FINAL/R&D | RDZEŃ | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| A19.6 | Karta modelu, rejestr zastosowań | MVP/MLP | RDZEŃ | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| A19.7 | Cały moduł nadzoru nad AI | MVP/MLP | RDZEŃ | 🟡 Częściowo | rejestr AI, karty modeli, wersje poleceń, tryb degradacji; formalny nadzór po wprowadzeniu na rynek — z QMS |

### Eternal Digital Shadow (6)

✅ 5 · 🆕 0 · 🟡 1 · 🔧 0 · ⛔ 0

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| D1.1 | EDM (identyfikacja) | MVP/MLP | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D1.2 | Historia badań | MLP→R&D | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D1.3 | Edycja/korekta | MLP→R&D | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D1.4 | Eksport FHIR/CSV/PDF | MVP/MLP | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D1.5 | Blockchain | MLP→R&D | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D1.6 | Integracja EHR/EMR | MLP→R&D | P4 | 🟡 Częściowo | fasada FHIR R4 i dokument FHIR; integracje EHR — z dostawcami |

### Eternal Research Twin (5)

✅ 2 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 3

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| D5.1 | Twin populacyjny (kohorty zanonimizowane) | MLP→R&D | P4 | ⛔ R&D | dane populacyjne — podmiot dostępu do danych (EHDS) |
| D5.2 | Uczenie federacyjne — model uczy się bez wynoszenia danych | MVP/MLP | P4 | ⛔ R&D | dane populacyjne — podmiot dostępu do danych (EHDS) |
| D5.3 | Generowanie danych syntetycznych | MLP→R&D | P4 | ✅ Zrobione | działa (web, mobile, testy) — dalej pilotaż w placówce |
| D5.4 | Rejestr zgód na wtórne wykorzystanie danych (EHDS) | MLP→R&D | P4 | ✅ Zrobione | rejestr sprzeciwów wobec wtórnego wykorzystania |
| D5.6 | Alert epidemiologiczny lokalny | MLP→R&D | P4 | ⛔ R&D | dane populacyjne — podmiot dostępu do danych (EHDS) |

### Predictive / Specialty Twin (5)

✅ 0 · 🆕 0 · 🟡 1 · 🔧 1 · ⛔ 3

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| D2.1 | Wizualizacja 2D/3D | MLP→R&D | P4 | 🔧 Mogę zrobić | wizualizacja własnych danych — produkt P4 |
| D2.2 | Symulacja ryzyka chorób | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D2.3 | Pulpit dla lekarza (SBAR + Twin) | MVP/MLP | P4 | 🟡 Częściowo | SBAR + raport faktów; bliźniak — P4 |
| D2.4 | Symulacja interwencji ('co jeśli') | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D2.5 | Autonomiczna aktualizacja (z Capsule) (7 podzadań) | MLP→R&D | P4 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |

### Twin Extensions (15)

✅ 1 · 🆕 1 · 🟡 0 · 🔧 5 · ⛔ 8

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| D4.1 | Symulator przewidywanej długości życia | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.2 | Predyktor postępu choroby | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.3 | Trajektoria starzenia | MLP/R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.4 | Trajektoria starzenia | MLP/R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.5 | Zbiorczy wskaźnik zdrowia z epigenetyką | FINAL/R&D | P4 | ⛔ R&D | technologia w fazie badań |
| D4.6 | Interaktywne ciało 3D | MLP→R&D | P4 | 🔧 Mogę zrobić | wizualizacja własnych danych — produkt P4 |
| D4.7 | Oś czasu zdrowia | MLP→R&D | P4 | ✅ Zrobione | oś czasu wyników z wersjami |
| D4.8 | Drzewo zdrowia rodziny | MLP→R&D | P4 | 🆕 Zrobione teraz | drzewo zdrowia z wywiadu rodzinnego |
| D4.9 | Kalkulator wpływu stylu życia | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.10 | Awatar przyszłego siebie | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| D4.11 | Testament cyfrowy | MLP→R&D | P4 | 🔧 Mogę zrobić | dyspozycja „co z moimi danymi po śmierci” — treść z prawnikiem |
| D4.12 | Panel spadkobierców | MLP→R&D | P4 | 🔧 Mogę zrobić | dostęp bliskich po śmierci (art. 26 ust. 2 upt) — procedura z prawnikiem |
| D4.13 | Wiadomości wideo dla bliskich | MLP→R&D | P4 | 🔧 Mogę zrobić | dostęp bliskich po śmierci (art. 26 ust. 2 upt) — procedura z prawnikiem |
| D4.14 | Panel spadkobierców | MLP→R&D | P4 | 🔧 Mogę zrobić | dostęp bliskich po śmierci (art. 26 ust. 2 upt) — procedura z prawnikiem |
| D4.15 | Ciągłość po śmierci fizycznej | MLP→R&D | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Legacy (4)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 1 · ⛔ 3

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| D3.1 | Testament danych | MLP→R&D | P4 | 🔧 Mogę zrobić | dyspozycja „co z moimi danymi po śmierci” — treść z prawnikiem |
| D3.2 | Eternal Ghost | MLP→R&D | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| D3.3 | Kopia świadomości | MLP→R&D | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| D3.4 | Interakcja z Matrix | MLP→R&D | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Digital Twin (14)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 2 · ⛔ 12

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F14.1 | Model ciała 3D (Three.js) | MLP→R&D | P4 | 🔧 Mogę zrobić | wizualizacja własnych danych — produkt P4, po MLP |
| F14.2 | Nakładka biomarkerów (kolor według stanu) | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.3 | Statyczne zestawienie | MLP→R&D | P4 | 🔧 Mogę zrobić | wizualizacja własnych danych — produkt P4, po MLP |
| F14.4 | Symulacje „co jeśli" | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.5 | Wehikuł czasu (przeszłość + przyszłość 5 lat) | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.6 | Rozumowanie kontrfaktyczne | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.7 | Planowanie interwencji | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.8 | Bliźniak na poziomie narządu | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.9 | Bliźniaki uczone federacyjnie | MLP→R&D | P4 | ⛔ R&D | technologia w fazie badań |
| F14.10 | Porównania między bliźniakami | MLP→R&D | P4 | ⛔ R&D | technologia w fazie badań |
| F14.11 | Predykcja ryzyka zgonu | MLP→R&D | P4 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| F14.12 | Bliźniak jako nośnik cyfrowej nieśmiertelności (4 podzadania) | SF / obserwacja | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F14.13 | Autonomiczny bliźniak (podejmuje decyzje) (4 podzadania) | MLP→R&D | P4 | ⛔ R&D | technologia w fazie badań |
| F14.14 | Twin transfer (do innego ciala / androida) | SF / obserwacja | P4 | ⛔ SF | wizja / wstrzymane w rejestrze |

### Eternal Genetics / Digital Twin (19)

✅ 0 · 🆕 2 · 🟡 0 · 🔧 0 · ⛔ 17

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F16.1 | Zamówienie testu (kit do domu) | FINAL/R&D | P1/P4 | ⛔ Umowa | laboratorium genetyczne |
| F16.2 | Wgrywanie wyników (surowe dane) | FINAL/R&D | P1/P4 | 🆕 Zrobione teraz | przechowanie pliku bez odczytu, poza udostępnianiem; interpretacja — IVDR/MDR |
| F16.3 | Wizualizacja drzewa genealogicznego | FINAL/R&D | P1/P4 | 🆕 Zrobione teraz | drzewo z wywiadu rodzinnego (A20.9) |
| F16.4 | 100 najważniejszych markerów zdrowia | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.5 | Lista leków do unikania (PGx) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.6 | Pełna interpretacja kliniczna | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.7 | Poligeniczne wskaźniki ryzyka (10 chorób) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.8 | Status nosicielstwa (rodzicielstwo) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.9 | Integracja z dieta (CYP, MTHFR) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.10 | Integracja z treningiem (ACTN3) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.11 | Sekwencjonowanie całego genomu | FINAL/R&D | P1/P4 | ⛔ Umowa | laboratorium genetyczne |
| F16.12 | Planowanie CRISPR (po legalizacji w Polsce) | R&D/SF | P1/P4 | ⛔ Prawo | edycja genomu zarodka niedozwolona; tylko obserwacja zmian prawa |
| F16.13 | Genetyka rodzinna (cała rodzina razem) | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.14 | Badanie przesiewowe zarodków (PGT) | FINAL/R&D | P1/P4 | ⛔ Ludzie | PGT tylko w ośrodku i laboratorium, ze wskazań medycznych (art. 26 ustawy o leczeniu niepłodności); aplikacja najwyżej przechowa wynik |
| F16.15 | Pharmacogenomics PRO | FINAL/R&D | P1/P4 | ⛔ MDR | interpretacja genetyczna — IVDR/MDR |
| F16.16 | CRISPR in vivo | R&D/SF | P1/P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F16.17 | Napęd genowy | SF / obserwacja | P1/P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F16.18 | Dzieci projektowane genetycznie | SF / obserwacja | P1/P4 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F16.19 | Odwracanie starzenia terapią genową (4 podzadania) | SF / obserwacja | P1/P4 | ⛔ SF | wizja / wstrzymane w rejestrze |

## Społeczność i ekosystem


### Matrix Community / App (28)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 15 · ⛔ 13

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| F15.1 | Forum (Discourse uruchamiany u siebie) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.2 | Kanał wpisów (oś czasu) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.3 | Polubienia / komentarze | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.4 | Grupy tematyczne | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.5 | Profile użytkownika | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.6 | Wydarzenia na żywo (LiveKit) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | wydarzenia wideo na istniejącym Jitsi |
| F15.7 | Wyzwania (90-dniowe i inne) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.8 | Podcast Eternal (audio CDN) | MVP/MLP | P5/P1 | ⛔ Ludzie | produkcja treści |
| F15.9 | eBooki Eternal (PDF/EPUB) | MVP/MLP | P5/P1 | ⛔ Ludzie | produkcja treści |
| F15.10 | Program mentorski (dopasowanie) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.11 | Lokalne spotkania (kalendarz) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | kod zrobię; start wymaga moderacji i regulaminu (DSA) — produkt P5 |
| F15.12 | Spotkania w AR (Apple Vision Pro, Quest) | MVP/MLP | P5/P1 | ⛔ Osobny produkt | inny produkt / platforma niż ta aplikacja |
| F15.13 | Eternal Token (nagrody) | WSTRZYMANE / R&D | P5/P1 | ⛔ SF | wstrzymane w rejestrze (token, DAO, NFT) |
| F15.14 | Zarządzanie przez DAO | WSTRZYMANE / R&D | P5/P1 | ⛔ SF | wstrzymane w rejestrze (token, DAO, NFT) |
| F15.15 | Odznaki NFT (osiągnięcia) | WSTRZYMANE / R&D | P5/P1 | ⛔ SF | wstrzymane w rejestrze (token, DAO, NFT) |
| F15.16 | Marketplace Eternal (dobra społeczności) | MVP/MLP | P5/P1 | ⛔ Umowa | płatności, regulamin sprzedaży |
| F15.17 | Metawersum Eternal | SF / obserwacja | P5/P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F15.18 | Kolektywna swiadomość | SF / obserwacja | P5/P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F15.19 | Transfer doswiadczen | SF / obserwacja | P5/P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| F15.20 | Holonet (4 subtaski) | SF / obserwacja | P5/P1 | ⛔ SF | wizja / wstrzymane w rejestrze |
| A9.1 | Baza wiedzy zdrowotnej | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | baza wiedzy — kod; treść pisze i zatwierdza zespół medyczny |
| A9.2 | Forum społecznościowe | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | produkt P5 — moderacja i DSA |
| A9.3 | Gamifikacja (Cywilizacja Q) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | produkt P5 — moderacja i DSA |
| A9.4 | Webinaria na żywo | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | webinaria na Jitsi; prowadzący — ludzie |
| A9.5 | NFT trofea zdrowotne | WSTRZYMANE / R&D | P5/P1 | ⛔ SF | wstrzymane (NFT) |
| A9.6 | Grupy wsparcia | MVP/MLP | P5/P1 | ⛔ Ludzie | moderator / psycholog |
| A9.7 | Grupy tematyczne (z X1.2) | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | produkt P5 — moderacja i DSA |
| A9.8 | baza wiedzy *(z X1.5)* | MVP/MLP | P5/P1 | 🔧 Mogę zrobić | baza wiedzy — kod; treść pisze i zatwierdza zespół medyczny |

### Matrix Community (5)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 2 · ⛔ 3

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| X1.1 | Baza wiedzy | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X1.2 | Forum | MVP/MLP | P5 | 🔧 Mogę zrobić | jak A9.2 / A9.4 |
| X1.3 | Gamifikacja/NFT | WSTRZYMANE / R&D | P5 | ⛔ SF | wstrzymane w rejestrze |
| X1.4 | Webinaria | MVP/MLP | P5 | 🔧 Mogę zrobić | jak A9.2 / A9.4 |
| X1.5 | Grupy wsparcia | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |

### Matrix Immersive (6)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 6

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| X2.1 | AR nakładki | SF / WSTRZYMANE | P5 | ⛔ SF | wizja / wstrzymane w rejestrze |
| X2.2 | VR pokój danych | SF / WSTRZYMANE | P5 | ⛔ SF | wizja / wstrzymane w rejestrze |
| X2.3 | Metawersum | SF / WSTRZYMANE | P5 | ⛔ SF | wizja / wstrzymane w rejestrze |
| X2.4 | Holonet | SF / obserwacja | P5 | ⛔ SF | wizja / wstrzymane w rejestrze |
| X2.5 | Immersja sensoryczna | MVP/MLP | P5 | ⛔ R&D | technologia w fazie badań |
| X2.6 | Integracja z Twin | MLP→R&D | P5 | ⛔ R&D | technologia w fazie badań |

### Matrix Extended (12)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 12

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| X3.1 | Wioski zdrowotne w VR | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.2 | Globalne wyzwania zdrowotne | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.3 | Platforma dla edukatorów | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.4 | Kręgi wsparcia | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.5 | Pełna immersja z dotykiem | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.6 | Zwiedzanie własnego ciała w VR | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.7 | Lekarz holograficzny | MVP/MLP | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.8 | Lekarz holograficzny | MVP/MLP | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.9 | Miasto zdrowia w metawersum | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.10 | Obalanie mitów zdrowotnych | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.11 | Szkolenie pierwszej pomocy w AR | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |
| X3.12 | Obalanie mitów zdrowotnych | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |

### Matrix R&D / HOLD (1)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 1

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| X4.3 | Arkusz roboczy horyzontu dalekiego (archiwalny) | SF / WSTRZYMANE | P5 | ⛔ SF | wstrzymane w rejestrze |

### Innovation Hub (6)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 1 · ⛔ 5

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A15.1 | Nabór i zglaszanie projektów | MVP/MLP | P6 | 🔧 Mogę zrobić | formularz zgłoszeń — produkt P6 |
| A15.2 | Ocena i selekcja (Rada Naukowa) | MVP/MLP | P6 | ⛔ Ludzie | rada naukowa, granty, mentorzy, prawnicy |
| A15.3 | Stypendia i granty | MVP/MLP | P6 | ⛔ Ludzie | rada naukowa, granty, mentorzy, prawnicy |
| A15.4 | Wsparcie mentorskie i infrastruktura | MVP/MLP | P6 | ⛔ Ludzie | rada naukowa, granty, mentorzy, prawnicy |
| A15.5 | Przedsprzedaz / crowdfunding | MVP/MLP | P6 | ⛔ Umowa | operator płatności i prawo crowdfundingu |
| A15.6 | Licencjonowanie do Spolki | MVP/MLP | P6 | ⛔ Ludzie | rada naukowa, granty, mentorzy, prawnicy |

### Forge Marketplace (7)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 2 · ⛔ 5

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A16.1 | Katalog OSS / patentów | MVP/MLP | P7 | 🔧 Mogę zrobić | katalog i ocena — produkt P7 |
| A16.2 | Marketplace modułów i API | MVP/MLP | P7 | ⛔ Umowa | płatności |
| A16.3 | AI łączenia projektów | MVP/MLP | P7 | ⛔ R&D | technologia w fazie badań |
| A16.4 | Crowdsourcing R&D | MVP/MLP | P7 | ⛔ Ludzie | usługa świadczona przez ludzi |
| A16.5 | Program partnerski | MVP/MLP | P7 | ⛔ Ludzie | usługa świadczona przez ludzi |
| A16.6 | Eternal Token | WSTRZYMANE / R&D | P7 | ⛔ SF | wstrzymane (token) |
| A16.7 | Dynamiczna ocena punktowa | MVP/MLP | P7 | 🔧 Mogę zrobić | katalog i ocena — produkt P7 |

### Eternal Pet (6)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 6

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| A13.1 | Aplikacja Eternal Pet | MVP/MLP | P1/P2 | ⛔ Osobny produkt | osobny produkt Eternal Pet |
| A13.2 | Obroża GPS / Tractive | MVP/MLP | P1/P2 | ⛔ Umowa | konto / umowa z zewnętrznym dostawcą |
| A13.3 | Mini Station dla zwierząt | MVP/MLP | P1/P2 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| A13.4 | AI weterynaryjne | MVP/MLP | P1/P2 | ⛔ R&D | technologia w fazie badań |
| A13.5 | Bio-Tag dla zwierząt | MVP/MLP | P1/P2 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| A13.6 | Nanoboty dla zwierząt | SF / obserwacja | P1/P2 | ⛔ SF | wizja / wstrzymane w rejestrze |

## Urządzenia (Station, Care Pod, implanty)


### Eternal Station Core (13)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 13

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| S1.1 | EKG (1-odprow.) | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S1.2 | Pulsoksymetria (SpO2) | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S1.3 | Ciśnienie krwi | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S1.4 | Temperatura ciała | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S1.5 | Glukoza | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S3.1 | Dozownik proszków | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S3.2 | Dozownik płynów | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S3.3 | Identyfikacja wkładów (NFC) | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S3.4 | Automatyczne zamawianie | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S3.5 | Związki na zamówienie (AI) | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S5.1 | Czujniki powietrza | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S5.2 | Samodiagnoza urządzenia | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S5.3 | Zabezpieczenie awaryjne | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |

### Eternal Station Advanced (14)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 14

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| S6.1 | Bezdotykowe EKG | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.2 | Nieinwazyjny pomiar glukozy | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.3 | Monitorowanie oddechu | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.4 | Analiza potu | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.5 | Aplikator przezskórny | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.6 | Diagnostyka bezkrwawa | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.7 | Inteligentne opakowanie leków | MVP/MLP | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.8 | Autonomiczny karmnik | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.9 | Dozownik napojów z suplementami | MLP | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.10 | Inteligentna kuweta | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.11 | Dozownik wielu suplementów | MLP | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.12 | Analiza aktywności zwierzęcia | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.13 | Inteligentna kuweta | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S6.14 | Robot towarzyszący zwierzęciu | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |

### Eternal Home Diagnostics (3)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 3

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| S2.1 | Analiza moczu | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S2.2 | Skład ciała (BIA) | MLP/FINAL | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |
| S2.3 | Lipidogram (Lab-on-chip) | MVP/MLP | P2 | ⛔ Sprzęt | Eternal Station — projekt sprzętowy, CE/MDR |

### Eternal RPM / Care Pod (5)

✅ 3 · 🆕 1 · 🟡 0 · 🔧 0 · ⛔ 1

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| S4.1 | Wideokonsultacja (LiveKit) | MVP/MLP | P2/P1 | ✅ Zrobione | w aplikacji (urządzenie — P2) |
| S4.2 | Przycisk SOS | MLP/FINAL | P2/P1 | ✅ Zrobione | w aplikacji (urządzenie — P2) |
| S4.3 | Triaż AI (na urządzeniu) | MLP/FINAL | P2/P1 | ⛔ MDR | interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja) |
| S4.4 | Tryb offline | MLP/FINAL | P2/P1 | 🆕 Zrobione teraz | tryb offline aplikacji (A5.12); urządzenie Station — P2 |
| S4.5 | Panel opiekuna | MLP/FINAL | P2/P1 | ✅ Zrobione | panel opiekuna w aplikacji (urządzenie — P2) |

### Eternal Bio-Tag (5)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 5

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| C1.1 | Identyfikacja NFC | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C1.2 | Temperatura (NTC) | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C1.3 | Powłoka Bio-Glass | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C1.4 | Ochrona przed migracją | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C1.5 | Tryb samolotowy | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |

### Eternal Bio-Monitor (7)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 7

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| C2.1 | CGM (glukoza) | MVP/MLP | P3 | ⛔ Umowa | partner CGM |
| C2.2 | Kortyzol | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C2.3 | Mleczany | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C2.4 | BLE | MVP/MLP | P3 | ⛔ Sprzęt | fizyczne urządzenie — projekt sprzętowy i CE |
| C2.5 | Haptyka | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C2.6 | Kalibracja | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |
| C2.7 | Stealth Mode | R&D/FINAL | P3 | ⛔ Sprzęt | Bio-Tag / Bio-Monitor — projekt sprzętowy i certyfikacja |

### Hive R&D (5)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 5

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| C3.1 | Mikro-pompy (MEMS) | R&D/FINAL | P3 | ⛔ R&D | Hive — badania |
| C3.2 | AI na urządzeniu | R&D/FINAL | P3 | ⛔ R&D | Hive — badania |
| C3.3 | Ogniwa biopaliwowe | R&D/FINAL | P3 | ⛔ R&D | Hive — badania |
| C3.4 | UWB | R&D/FINAL | P3 | ⛔ R&D | Hive — badania |
| C3.5 | Panel w aplikacji | R&D/FINAL | P3 | ⛔ R&D | Hive — badania |

### Swarm R&D (6)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 6

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| C4.1 | Celowana chemioterapia | R&D/FINAL | P3 | ⛔ R&D | nanoroboty — badania |
| C4.2 | Czyszczenie naczyń | R&D/FINAL | P3 | ⛔ R&D | nanoroboty — badania |
| C4.3 | Neuroprzekaźniki | R&D/FINAL | P3 | ⛔ R&D | nanoroboty — badania |
| C4.4 | Walka z patogenami | R&D/FINAL | P3 | ⛔ R&D | nanoroboty — badania |
| C4.5 | CRISPR in vivo | R&D/SF | P3 | ⛔ SF | wizja / wstrzymane w rejestrze |
| C4.6 | Raport z misji | R&D/FINAL | P3 | ⛔ R&D | nanoroboty — badania |

### Capsule Advanced (18)

✅ 0 · 🆕 0 · 🟡 0 · 🔧 0 · ⛔ 18

| ID | Funkcja | Etap | Projekt | Status | Faza / co dalej |
|---|---|---|---|---|---|
| C5.1 | Ciągły pomiar ciśnienia od wewnątrz | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.2 | Monitorowanie stanu zapalnego | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.3 | Wykrywanie infekcji przed objawami | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.4 | Monitorowanie hormonów płodności | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.5 | Wczesne wykrywanie zmian nowotworowych | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.6 | Monitorowanie mikrobiomu | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.7 | Autonomiczne dozowanie insuliny | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.8 | Celowane dostarczanie leków | MVP/MLP | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.9 | Wsparcie odporności | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.10 | Regulacja ciśnienia | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.11 | Regulacja snu | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.12 | Wsparcie trawienia | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.13 | Terapia celowana nowotworów | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.14 | Ładowanie bezprzewodowe przez skórę | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.15 | Interfejs wielojęzyczny | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.16 | Interfejs wielojęzyczny | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.17 | Samodiagnoza implantu | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |
| C5.18 | Implanty biodegradowalne | R&D/FINAL | P3 | ⛔ R&D | kapsuła wszczepialna — badania i certyfikacja |

## Runda 4 — zbudowane: 41 funkcji 🆕 (kolejka A, pakiety 1–9)

| # | Pakiet | Funkcje | Co działa | Co zostaje poza kodem |
|---|---|---|---|---|
| 1 | Tryb offline | A5.12, A24.6, S4.4 | kopia karty ratunkowej, leków z godzinami, wizyt i telefonu placówki — w przeglądarce i w telefonie, po decyzji pacjenta, usuwana przy wylogowaniu; ekran „Brak połączenia” z numerami alarmowymi | nic |
| 2 | Rejestry publiczne | F3.11, F7.1, F7.2, F7.4, F7.7 | kod ATC przy lekach, wyszukiwarka aptek „w pobliżu”, trasa w wybranej mapie, informacja z obwieszczenia refundacyjnego | operator importuje pliki: Rejestr Aptek (CSV) i obwieszczenie MZ (arkusze jako CSV) — `npm run cli -- import-pharmacies`, `import-refund` |
| 3 | Kolejne dzienniki | A21.2, A21.4, A21.5, A22.2, F11.1, F11.3, F11.4, F11.5 | cykl bez prognoz, połóg i karmienie, menopauza, czynności dnia bez punktów, żywienie z Open Food Facts | nic |
| 4 | Przypomnienia i lokalizacja | A14.3, A7.7, F9.11, F5.5, A11.1, A7.8, A12.6 | zapas leku, profilaktyka NFZ wg rocznika, przypomnienia własne z miejscem, poranny plan dnia, okolica użytkownika, rozpoznania ICD-10 wybierane przez lekarza | lekarz zatwierdza treść programów profilaktycznych (`approve-preventive`); pełny słownik ICD-10 — import pliku |
| 5 | Powietrze i pogoda | F5.1, F5.2, F5.17, A3.6 | indeks GIOŚ z najbliższej stacji, dane synoptyczne IMGW, powiadomienie o przekroczeniu progu | test z siecią produkcyjną (w środowisku budowy hosty GIOŚ/IMGW były zablokowane — kod według opublikowanego formatu, testy na danych wzorcowych) |
| 6 | Apple Health / Health Connect | F2.1, F2.2, A1.8, F9.1, F9.3, F12.1 | odczyt kroków i snu z fazami w aplikacji mobilnej, dzienne podsumowania na serwerze, widok w „Pomiarach” | development build EAS i test na fizycznym iPhonie i telefonie z Androidem |
| 7 | Urządzenia Bluetooth | F2.9, F2.21, F2.19 | pulsoksymetr (PLX jednorazowy i ciągły), glukometr, tryb „dowolne urządzenie zgodne ze standardem”, sen z Withings Sleep | test z fizycznym urządzeniem; konto deweloperskie Withings |
| 8 | Głos i motywacja | A17.10, F13.4 | sterowanie głosem tylko do nawigacji (z informacją o przetwarzaniu mowy), odznaki za regularność bez ocen zdrowia | nic |
| 9 | Drzewo rodziny i plik DNA | D4.8, F16.3, F16.2 | drzewo zdrowia z wywiadu rodzinnego; przechowanie surowego pliku genetycznego bez odczytu | nic |

## Co mogę zbudować dalej — 48 funkcji 🔧

Kod w tej samej aplikacji, w granicy MDR (bez oceny, prognozy i porady na podstawie danych pacjenta). 9 pakietów w dwóch kolejkach.

### B. Po decyzji albo z treścią — 24 funkcje

| # | Pakiet | Funkcje | Co powstanie | Na co czeka |
|---|---|---|---|---|
| 10 | Asystent edukacyjny | F4.1, F4.2, F4.7, A6.1, A6.2, A6.3 | czat z cytowaniem zatwierdzonych źródeł, bez dostępu do danych pacjenta | decyzja o przeznaczeniu (wellness/edukacja, nie wyrób) i lista źródeł |
| 11 | Posiłki i przepisy z AI | F11.2, A7.5, A17.16, F11.15 | rozpoznanie posiłku ze zdjęcia, przepisy — wellness | wpis w rejestrze AI, próbka do walidacji jakości, klucz modelu w sekretach środowiska |
| 12 | Treści i odtwarzacze | F9.7, F9.10, F8.3, F12.5, F11.6, A9.1, A9.8 | program higieny snu, dźwięki, medytacje, biblioteka ćwiczeń, zalecenia ogólne, baza wiedzy | nagrania i teksty zatwierdzone przez zespół medyczny |
| 13 | Dziedzictwo danych | D3.1, D4.11, D4.12, D4.13, D4.14 | dyspozycja „co z moimi danymi po śmierci”, dostęp bliskich, wiadomości dla bliskich | procedura i tekst od prawnika |
| 14 | Link do laboratorium | F10.3 | zwykły link do partnera | wybór partnera; link z prowizją = umowa |
| 15 | Logowanie portfelem EUDI | F1.15 | logowanie Europejskim Portfelem Tożsamości Cyfrowej | dostępność portfela i interfejsu dla usługodawców w Polsce |

### C. Osobne produkty — 24 funkcje

| # | Pakiet | Funkcje | Co powstanie | Na co czeka |
|---|---|---|---|---|
| 16 | P4 — wizualizacja bliźniaka | A3.9, D2.1, D4.6, F14.1, F14.3 | podgląd 2D/3D własnych danych, bez symulacji i kolorowania „wg stanu” | decyzja o starcie P4 (po MLP) |
| 17 | P5 — społeczność | F15.1–F15.7, F15.10, F15.11, A9.2, A9.3, A9.4, A9.7, X1.2, X1.4, A17.9 | forum, grupy, wyzwania, mentoring, spotkania, wydarzenia na Jitsi, anonimowe statystyki | moderatorzy, regulamin i procedura zgłoszeń treści (DSA) |
| 18 | P6/P7 — Hub i Forge | A15.1, A16.1, A16.7 | formularz zgłoszeń projektów, katalog OSS i patentów z oceną | decyzja o starcie P6/P7 |

Kolejka B rusza po decyzjach z tabeli niżej; kolejka C — po decyzji o starcie produktów P4–P7.

## Czego nie mogę zrobić — 399 funkcji ⛔ i jak je odblokować

| Przeszkoda | Liczba | Przykłady | Dlaczego kod nie wystarczy | Jak odblokować |
|---|---|---|---|---|
| MDR — interpretacja danych zdrowotnych | 103 (44 w etapie MVP/MLP) | triaż F6.7, A5.11; alerty trójkolorowe A3.5; wynik snu F9.2; predykcje A6.8, F14.5; interakcje F3.13, F11.11; genetyka F16.4–F16.10 | oprogramowanie, które ocenia, prognozuje albo doradza na podstawie danych pacjenta, jest wyrobem medycznym (MDR, reguła 11), a przy AI zwykle także systemem wysokiego ryzyka (AI Act) | decyzja kwalifikacyjna dla każdej funkcji (`/dokument`); dla wybranych — osobny projekt certyfikacji: QMS ISO 13485, IEC 62304, ISO 14971, ocena kliniczna, jednostka notyfikowana |
| Umowa, konto lub klucz dostawcy | 55 | P1: e-recepta, e-skierowanie, e-karta szczepień; Terra, Dexcom/Abbott, Garmin, Polar, Whoop; apteki i laboratoria; płatności; licencje treści; systemy gabinetowe | integracja wymaga klucza, certyfikatu albo umowy | konto lub umowa po stronie właściciela; klucze w sekretach środowiska, nigdy w czacie; adapter i test po stronie kodu |
| Sprzęt | 60 | Station S1–S6, Bio-Tag i Bio-Monitor C1–C2, drony F7.10, Lab Pop-up F10.10 | fizyczne urządzenie: elektronika, produkcja, CE, często MDR | zespół sprzętowy i prototyp; aplikacja ma wzorzec adaptera urządzenia (F2.14) |
| Badania (R&D) | 70 | F1.14, F3.12, F4.18, D5.2, C5.x, C4.x | technologia niegotowa do wdrożenia albo wymaga badań klinicznych | program badawczy (P6), partnerzy akademiccy, granty |
| Wizja / wstrzymane (SF) | 67 | F1.22, metawersum, token i NFT, D3.3, nanoboty | wstrzymane w rejestrze albo poza dzisiejszą technologią | przegląd rejestru raz w roku |
| Usługa ludzi | 27 | F6.11, A8.3, A8.4, F4.9, F11.8, F12.7, F10.8, A15.2, F16.14 | usługę świadczą ludzie; aplikacja ma wideo, wiadomości, grafik i panel personelu | rekrutacja lub umowy z personelem i placówkami |
| Osobny produkt | 10 | A1.2, F2.20, A13.1, F8.11, F12.12, F15.12, F9.5 | inna aplikacja lub platforma | osobne repozytorium i zespół |
| Prawo | 3 | F7.11, F8.13, F16.12 | obecnie niezgodne z prawem — nie generuję | niżej |
| Opis w rejestrze | 4 | A17.8, A20.2, A20.5, A20.6 | pozycja bez czytelnej nazwy | doprecyzowanie w rejestrze |

### Funkcje niezgodne z prawem

| Funkcja | Problem | Legalna alternatywa | Konsekwencje |
|---|---|---|---|
| F7.11 Kurier z lekami w godzinę | apteka może sprzedawać wysyłkowo wyłącznie leki bez recepty (art. 68 ust. 3 Prawa farmaceutycznego) | rezerwacja leku i odbiór w aptece (F7.6, po umowie z apteką); dowóz leków bez recepty przez aptekę | wysyłka leku na receptę grozi aptece nakazem zaprzestania i karą; platforma pośrednicząca naraża się na zarzut udziału w nielegalnym obrocie |
| F8.13 Terapia wspomagana psychodelikami | substancje z wykazu ustawy o przeciwdziałaniu narkomanii; poza badaniami klinicznymi niedozwolone | informacja o badaniach klinicznych prowadzonych przez ośrodki naukowe (bez kierowania pacjentów) | promowanie lub organizowanie takiej terapii — odpowiedzialność karna |
| F16.12 Planowanie CRISPR | edycja genomu zarodka niedozwolona | obserwacja zmian prawa; edukacja o genetyce bez interpretacji | brak ścieżki legalnej dziś |

Poprawka wobec rejestru: F16.14 (diagnostyka preimplantacyjna, PGT) nie jest zakazana — ustawa o leczeniu niepłodności (art. 26) dopuszcza ją ze wskazań medycznych, w laboratorium, z zakazem wyboru cech poza uniknięciem ciężkiej choroby dziedzicznej. Wykonuje ją ośrodek, nie aplikacja — status ⛔ „usługa ludzi”.

## Co jest potrzebne od właściciela projektu

| # | Decyzja lub zasób | Odblokowuje |
|---|---|---|
| 1 | Import rejestrów publicznych na serwerze (Rejestr Aptek, obwieszczenie refundacyjne, słownik ICD-10) i dostęp serwera do api.gios.gov.pl, danepubliczne.imgw.pl, world.openfoodfacts.org | pakiety 2, 4, 5 i 3 w pełnej wersji |
| 2 | Decyzja kwalifikacyjna MDR: które funkcje zostają poza wyrobem (N0/W0), a które idą ścieżką MED-GATE lub URZĄDZENIE | 103 funkcje MDR; pakiet 10 |
| 3 | Konta i klucze dostawców (SMS, e-mail, model AI, Withings, Terra) — w sekretach środowiska | wysyłka powiadomień i integracje urządzeń |
| 4 | Ścieżka P1: placówka lub dostawca oprogramowania z dostępem do środowiska testowego CeZ | e-recepta, e-skierowanie, e-karta szczepień |
| 5 | Treści do zatwierdzenia przez lekarza (programy profilaktyczne NFZ — gotowe do przeglądu, kalendarz szczepień, higiena snu, lista z BRAKI §2.2a) | A7.7, pakiet 12, A21.7 |
| 6 | Prawnik: regulamin i polityka prywatności, dostęp bliskich po śmierci, regulamin społeczności (DSA) | pakiety 13 i 17 |
| 7 | Telefon iOS i Android, konto deweloperskie Apple/Google (development build EAS), pulsoksymetr Bluetooth | test pakietów 6 i 7 na urządzeniach |
| 8 | Partnerzy: placówka pilotażowa, apteka, laboratorium, sieć lekarzy i psychologów | 55 funkcji „umowa” i 27 „usługa ludzi” |
| 9 | Doprecyzowanie A17.8, A20.2, A20.5, A20.6 w rejestrze | 4 funkcje |
