# -*- coding: utf-8 -*-
"""Ustalenia z pełnego odczytu korpusu (D001–D076).

Źródło: tools/konsolidacja/odczyt/USTALENIA_ODCZYT.md — dziennik odczytu całej
treści 159 plików (28 618 387 znaków surowo, 13 020 154 po deduplikacji).
Poniżej wyłącznie te ustalenia, które należą do sekcji SPECYFIKACJA i których
nie ma w blokach źródłowych przenoszonych dosłownie przez builder — bo powstały
z zestawienia wielu plików albo prostują treść źródłową.
"""

HIERARCHIA = [
 ["Zakres", "Dokument obowiązujący", "Zastępuje"],
 ["Specyfikacja — KANON",
  "#126 ETERNAL_Specyfikacja_Master_5_4_FINAL (1 072 132 zn., 30.08.2026)",
  "Master 3.0 (#129, #148), Master 3.1 (#90)"],
 ["Specyfikacja aplikacji",
  "#125 App Specyfikacja 5.4 FINAL (752 667 zn.) — 89% treści zawarte w Master 5.4; "
  "do dokumentu wchodzą wyłącznie bloki własne",
  "App 3.1, App Specyfikacja Funkcjonalna (#95)"],
 ["Rejestr funkcji ekosystemu",
  "#32 Rejestr FINALNY 309 (10 518 zn.)",
  "#51 Rejestr scalony 299, wersje 265 i 239"],
 ["Nazwy 80 funkcji dodanych w wersji 265",
  "#51 Rejestr scalony 299 — jedyne źródło nazewnictwa tych pozycji", "—"],
 ["Granica MDR per funkcja",
  "katalog 183 kart z #126: pola „dlaczego nie jest MDR / kiedy staje się MDR / "
  "bezpieczne sformułowanie / wersja wellness / wersja medyczna / klasa / termin”",
  "pole „MDR jeżeli software medyczny” z kart #129 — formuła warunkowa, nierozstrzygająca"],
 ["Liczby aplikacji", "#83 — 160 funkcji w 23 modułach", "„141”, „161”, „115”, „169”"],
 ["Cztery statusy regulacyjne, warstwa orkiestracji K1–K8",
  "#90 Master 3.1 (skrót, 13 706 zn.) — ustalenia przejęte przez 5.4, wartość jako zwięzły wykład",
  "—"],
 ["Klasy komponentów", "K01–K28 z #126 (A/B/C, próg wyjścia, mechanizm kontroli)",
  "tabele komponentowe w #90 i #81"],
 ["Moduły techniczne", "#134 — 16 modułów: rozwiązanie agregowane / własne IP / koszt", "—"],
]

LICZBY = [
 ["Liczba", "Źródło", "Co obejmuje", "Status"],
 ["115 / 16 modułów", "Master 3.0, moduł A", "sama aplikacja, moduły A1–A16", "składnik"],
 ["141 / 21 modułów", "#83", "A + D + X — aplikacja tak, jak jej doświadcza użytkownik", "składnik"],
 ["160 / 23 moduły", "#83", "141 + A17 Zgodność (12) + A18 Nadzór nad AI (7)",
  "OBOWIĄZUJE dla aplikacji"],
 ["169 / 23 moduły", "#39", "115 + 54 nowe, inna numeracja modułów", "wersja pośrednia"],
 ["185 / 30 modułów", "Master 3.0", "pięć projektów razem", "baza historyczna"],
 ["196", "#65", "suma sześciu modułów produktowych M1–M6", "ujęcie produktowe"],
 ["239", "#39", "169 + Twin 15 + Station 21 + Capsule 23 + Matrix 11", "wersja pośrednia"],
 ["265", "plik źródłowy", "wersja produktowa przed scaleniem", "składnik scalenia"],
 ["299 / 42 moduły", "#51 Rejestr scalony", "185 + 114 netto po usunięciu 21 duplikatów",
  "zastąpiony przez 309; pozostaje źródłem nazw"],
 ["309 / 42 moduły", "#32 Rejestr FINALNY",
  "App 186 + Station 34 + Capsule 41 + Twin 27 + Matrix 21", "OBOWIĄZUJE dla ekosystemu"],
 ["309 (inne)", "#145 sek. 6.1", "16 modułów × 4 poziomy, kody F1.1–F16.x",
  "INNA NUMERACJA — zbieżność liczby przypadkowa"],
]

STATUSY = [
 ["Status", "Co obejmuje", "Reżim", "Funkcji App"],
 ["1. General software",
  "konto, ID, marketplace, społeczność, Forge, Hub, kalendarz, płatności",
  "RODO, prawo handlowe", "~30"],
 ["2. Health / wellness",
  "sen, aktywność, cele, trening, wizualizacja, personalizacja stylu życia",
  "RODO art. 9", "~38"],
 ["3. Regulowane poza MDR",
  "teleporada, dokumentacja, P1, profilowanie, marketplace leków i badań",
  "ustawa o działalności leczniczej, prawo farmaceutyczne, IVDR, AI Act", "~17"],
 ["4. MDSW — wyrób medyczny",
  "interpretacja, alerty progowe, triage, predykcja, closed loop",
  "MDR reguła 11 zał. VIII", "~14"],
 ["GRANICZNE",
  "ta sama funkcja może być w statusie 2 albo 4 zależnie od jednego zdania przeznaczenia",
  "—", "~16"],
]

EWOLUCJA = [
 ["Etap", "Co się dzieje", "Koszt", "Czego wymaga"],
 ["1. Wellness", "funkcja pokazuje fakt bez oceny", "0 zł ponad koszt budowy",
  "zdanie przeznaczenia bez celu medycznego"],
 ["2. Decyzja", "rozstrzygnięcie, czy wersja medyczna ma płatnika", "0 zł", "analiza rynku"],
 ["3. Ocena kwalifikacji", "udokumentowana ocena wg MDCG 2019-11 rev.1", "kilka dni pracy",
  "konsultant regulacyjny"],
 ["4. Rozdzielenie", "moduł medyczny jako osobny wyrób z własnym release", "40–80 osobodni",
  "walidowany interfejs do warstwy faktów"],
 ["5. Dossier", "dokumentacja techniczna, ocena kliniczna, QMS", "setki tys. – mln zł",
  "PRRC, jednostka notyfikowana"],
 ["6. Utrzymanie", "nadzór po wprowadzeniu, PSUR, audyty", "koszt cykliczny",
  "ciągłość zespołu"],
]

KIEDY_MDR = [
 "gdy dodasz ocenę",
 "gdy wartościujesz („gorszy niż”)",
 "gdy oceniasz względem progu fizjologicznego",
 "gdy nanosisz zakres normy z własną oceną",
 "gdy walidujesz wpis względem normy klinicznej",
 "gdy „walidacja” oznacza sprawdzenie względem normy",
 "gdy dashboard sam sygnalizuje nieprawidłowość",
 "gdy OCR dodaje interpretację odczytanej wartości",
 "gdy przy imporcie oceniasz zawartość",
 "gdy mapowanie zmienia znaczenie kliniczne",
 "gdy w trakcie mapowania interpretujesz znaczenie",
 "gdy system sam rozstrzyga, która wartość jest prawdziwa",
 "gdy rozstrzygasz konflikt medyczny między źródłami",
 "gdy chatbot ma dostęp do danych użytkownika",
 "gdy odnosisz się do WYNIKU tego pacjenta",
 "gdy odnosi się do konkretnego pacjenta",
 "gdy uzasadniasz danymi pacjenta",
 "gdy formułujesz wniosek przyczynowy",
 "gdy raport zawiera wnioski",
 "gdy ankieta prowadzi do wniosku diagnostycznego",
 "gdy deklarujesz cel diagnostyczny",
 "gdy cel jest kliniczny",
 "gdy deklarujesz dokładność pomiarową",
 "gdy urządzenie mierzy parametr życiowy z oceną",
 "gdy analizujesz treść klinicznie",
 "gdy analizujesz nagranie klinicznie",
 "gdy tłumaczysz treść kliniczną bez weryfikacji",
 "gdy treść komunikatu jest oceną stanu",
 "gdy komunikat odnosi się do stanu zdrowia użytkownika",
 "gdy funkcja reaguje na dane zdrowotne",
 "gdy plan jest dla osoby przewlekle chorej",
 "gdy plan jest dostosowany do jednostki chorobowej",
 "gdy personalizujesz pod jednostkę chorobową",
 "gdy dostosowujesz zalecenie zdrowotne",
 "gdy zalecasz dawkę pod stan zdrowia",
 "gdy sugestia wynika z wyniku badania",
 "gdy analizujesz interakcje leków",
 "gdy system ocenia stan psychiczny",
 "gdy system wykrywa pogorszenie i eskaluje",
 "gdy system SAM wykrywa kryzys",
 "gdy eskalacja jest automatyczna na podstawie oceny stanu",
 "gdy gamifikujesz parametry kliniczne",
 "gdy TY tworzysz dokumentację — a nie dostarczasz narzędzia klinice",
 "gdy treść jest oceną stanu",
 "osobno: „nie dotyczy — inny reżim: wymaga wpisu do RPWDL”",
]

BEZPIECZNE = [
 ["Obszar", "Bezpieczne (wellness)", "Przekracza granicę (MDR)"],
 ["Pomiar", "„Tętno: 78”", "„Tętno w normie”"],
 ["Pomiar", "„Zapisano wartość 5,4 mmol/l”", "ocena wartości przy zapisie"],
 ["Pomiar", "„Twoje 10 ostatnich pomiarów” — bez linii normy", "wykres z naniesioną normą"],
 ["Pomiar", "„Twoje pomiary z 7 dni” — tabela bez podsumowania oceniającego",
  "podsumowanie oceniające"],
 ["Pomiar", "„Wizualizacja Twoich pomiarów” — bez deklaracji klinicznej",
  "deklaracja kliniczna"],
 ["Wynik badania", "„CRP to białko ostrej fazy”", "„Twoje CRP jest podwyższone”"],
 ["OCR", "„Odczytano: CRP 12 mg/l. Sprawdź poprawność”", "interpretacja odczytu"],
 ["OCR", "„Odczytano: metformina 500 mg 2× dz.”", "ocena schematu dawkowania"],
 ["Korekta", "„Czy odczyt jest poprawny?” — pytanie, nie ocena",
  "automatyczna ocena poprawności"],
 ["Korekta", "„Poprawiono wpis. Poprzednia wartość zachowana w historii”", "—"],
 ["Konflikt źródeł", "„Dwa wyniki z 12.03, różne metody — pokazujemy oba”",
  "rozstrzygnięcie, który wynik jest prawdziwy"],
 ["Środowisko", "„Dziś PM10: 85 µg/m³”", "„Źle dla Twojej astmy”"],
 ["Środowisko", "„Spadek ciśnienia atmosferycznego o 12 hPa”",
  "komunikat pod jednostkę chorobową"],
 ["Korelacja", "„W dni o niższym ciśnieniu spałeś średnio 40 min krócej”",
  "wniosek przyczynowy"],
 ["Porównanie", "„Średnia dla grupy 40–49: 5,2” — bez oceny Twojej pozycji",
  "wartościowanie pozycji użytkownika"],
 ["Dieta", "„Dieta śródziemnomorska”", "„Dieta dla cukrzycy”"],
 ["Trening", "„Plan dla początkujących” bez odniesienia do chorób",
  "plan pod jednostkę chorobową"],
 ["Suplementy", "„Witamina D3 — informacje” bez zalecenia dawki", "zalecenie dawki"],
 ["Posiłek", "„Szacunkowo ok. 450 kcal — zweryfikuj”", "ocena adekwatności posiłku"],
 ["Profilaktyka", "„Wg wytycznych dla Twojego wieku badanie co 3 lata. Ostatnie: 2023”",
  "uzasadnienie danymi pacjenta"],
 ["Nastrój", "„Zapisano nastrój: 3/5”", "ocena stanu psychicznego"],
 ["HRV i sen", "pokazanie HRV i snu bez wniosku", "wniosek o stanie"],
 ["Ankieta", "ankieta o samopoczuciu bez wniosków", "wywiad kliniczny"],
 ["Kryzys", "116 123: numer zawsze dostępny i wywołanie przez użytkownika; "
  "twarde reguły przekierowania, bez detekcji stanu", "automatyczne wykrycie kryzysu"],
 ["Eskalacja", "przycisk „zadzwoń do bliskiej osoby” bez oceny; 112 NIE MA API — "
  "tylko rodzina i lekarz", "eskalacja z oceną stanu"],
 ["AI", "separacja architektoniczna kontekstu, nie prompt; wsparcie decyzji człowieka "
  "z prawem do wyjaśnienia", "chatbot z dostępem do danych użytkownika"],
 ["Triage", "proxy do Infermedica (ma CE)", "własny CDSS"],
 ["EEG", "proxy do certyfikowanego urządzenia EEG", "własna diagnostyka z EEG"],
 ["Marketplace", "rezerwacja w aptece i OTC; katalog bez powiązania z danymi zdrowotnymi",
  "sugestia wynikająca z wyniku badania"],
 ["Marketplace", "płatna widoczność zamiast prowizji per wizyta", "—"],
 ["Dokumentacja", "„sprzedajesz narzędzie, nie usługę dokumentacyjną”",
  "TY tworzysz dokumentację"],
 ["Gamifikacja", "nie gamifikować wartości medycznych", "gamifikacja parametrów klinicznych"],
 ["BRAK wersji bezpiecznej", "trójkolorowe alerty — „albo budujesz, albo nie ma”; "
  "predykcja ryzyka — „wymaga kohorty podłużnej”", "—"],
]

REGULA_GRANICY = (
 "Fakt i porównanie do własnej historii są bezpieczne. Ocena, próg i zalecenie nie są. "
 "Cztery słowa przekraczają granicę: „Twoje…”, „w normie”, „powinieneś”, „wskazuje na”.")

ORKIESTRACJA = [
 ["Kod", "Moduł", "Co robi", "Osobodni", "Dlaczego krytyczny"],
 ["K1", "Universal Sync", "źródło → adapter → model Eternal → rdzeń", "45",
  "obsługuje 7 funkcji naraz; wymiana dostawcy = wymiana pliku"],
 ["K2", "Model danych i Standard", "kanoniczny model, jednostki UCUM, wersjonowanie", "60",
  "kto definiuje format, ten posiada ekosystem"],
 ["K3", "Mapper CDA ↔ FHIR ↔ EEHRxF", "transformacja z walidacją", "70",
  "twardy termin 26.03.2029; produkt sprzedawalny"],
 ["K4", "Usługa terminologiczna", "LOINC, ICD, ATC, SNOMED i mapowanie PL", "40",
  "bez tego „glukoza” znaczy co innego w każdym źródle"],
 ["K5", "Zgody i kontrola dostępu", "granularne, odwoływalne, z zakresem i czasem", "70",
  "WARUNEK PRAWNY całej reszty"],
 ["K6", "Dziennik audytowy i proweniencja", "kto, co, kiedy, na jakiej podstawie", "35",
  "dopisanie później = migracja wszystkich danych"],
 ["K7", "Rejestr zgodności", "adaptery, wersje, partnerzy, urządzenia", "30",
  "nośnik programu Eternal Kompatybilny"],
 ["K8", "Silnik reguł i granica wyrobu", "reguły jawne, wersjonowane", "45",
  "wymusza granicę wellness/MDR w kodzie, nie w regulaminie"],
 ["", "RAZEM", "", "395", "316 000 zł przy stawce 800 zł/osobodzień"],
]

KLASY = [
 ["Klasa", "Próg wyjścia na własne", "Rekomendacja na dzień 1"],
 ["K01 Adapter wearables", "3 000 zł/mies. LUB 5 000 aktywnych użytkowników — co nastąpi pierwsze",
  "HealthKit i Health Connect od dnia 1; Terra dopiero gdy klient B2B zażąda Garmina lub Oura"],
 ["K02 Model danych i FHIR", "nigdy — mapowanie zawsze własne",
  "Medplum self-host i własny mapper; serwer wymienialny, mapper nie"],
 ["K03 Storage i backup", "nie wychodzimy — zmieniamy hostingodawcę, nie technologię",
  "Hetzner UE od dnia 1; AWS dopiero gdy klient B2B zażąda w umowie"],
 ["K04 OCR dokumentów", "2 000 zł/mies. LUB wejście funkcji do dossier wyrobu",
  "Document AI (procesor formularzowy) i własny parser od dnia 1"],
 ["K05 LLM", "2 500 zł/mies. — powyżej self-host tanieje",
  "Gemini Flash lub GPT-4o-mini; własny model językowy to setki tysięcy — odpada"],
 ["K06 Baza wektorowa i RAG", "nie wychodzimy przy małej skali",
  "pgvector w istniejącym PostgreSQL — zero nowych zależności"],
 ["K07 Transkrypcja mowy", "2 400–3 000 godzin nagrań miesięcznie",
  "gpt-4o-mini-transcribe i własny słownik — najtańszy start w całym projekcie"],
 ["K08 Wideo i WebRTC", "nie wychodzimy", "Jitsi self-host"],
 ["K09 Powiadomienia", "nie wychodzimy", "FCM i SendGrid"],
 ["K11 Wizualizacja i wykresy", "nie wychodzimy — MIT wystarcza", "Recharts"],
 ["K12 Grafika 3D i AR", "nie wchodzimy w Unity bez wyraźnej potrzeby — to jedyna "
  "zależność bez substytutu w stosie",
  "Three.js; odłożyć do czasu, gdy Twin ma sens biznesowy"],
 ["K13 Forum i społeczność", "nie wychodzimy", "Discourse self-host"],
 ["K14 Dane środowiskowe", "nie wychodzimy — IMGW i GIOŚ są darmowe", "IMGW i GIOŚ"],
 ["K15 Bazy żywności", "nie wychodzimy z USDA (public domain); ODbL wymaga ostrożności",
  "USDA i własna baza PL budowana przez użytkowników"],
 ["K16 Bazy ćwiczeń i ruch", "nie wychodzimy z MediaPipe",
  "MediaPipe; omijać OpenPose i wger"],
 ["K17 Geolokalizacja i mapy", "800 zł/mies.", "OSM i Leaflet, własna baza punktów"],
 ["K18 Generowanie PDF", "nie wychodzimy", "WeasyPrint"],
 ["K20 Integracja P1", "nie wychodzimy — nie ma dokąd",
  "odłożyć do momentu, gdy jest podmiot leczniczy"],
 ["K21 Marketplace i afiliacja", "nie dotyczy — to przychód, nie koszt",
  "Dietly przez Circlewise od zaraz (model CPS); Maczfit przez MyLead 3,20% CPS; "
  "suplementy ok. 30% prowizji"],
 ["K22 Firmware i BLE", "nigdy nie wychodzimy z własnego firmware",
  "moduł OEM i własny firmware; zacząć od Pet Bio-Tag — brak ściany MDR"],
 ["K23 Silnik reguł", "nigdy nie wychodzimy",
  "własny silnik reguł: prosty, jawny, wersjonowany"],
 ["K25 Rozpoznawanie obrazu", "2 000 zł/mies.",
  "SDK komercyjne i korekta ręczna; nie budować własnego modelu"],
 ["K26 Katalogi IP i patentów", "nie wychodzimy — API są darmowe", "Espacenet i GitHub API"],
 ["K27 Procesy organizacyjne", "nie dotyczy", "Notion lub Airtable na start"],
 ["K28 Moduł certyfikowany", "nie dotyczy — decyzja strategiczna, nie kosztowa",
  "proxy na start (Labplus); własny wyrób dopiero przy przychodzie B2B"],
]

REGULA_PROXY = (
 "Proxy działa tylko wtedy, gdy NIE modyfikujesz wyniku i wskazujesz producenta. "
 "Modyfikacja oznacza, że jesteś producentem. Przy integracji przez API odpowiedzialność "
 "za certyfikację produktu końcowego pozostaje po stronie integratora.")

BRAKI_KLAS = ("W korpusie obecne jest 25 z 28 klas. Brakuje K10, K19 i K24 — wedle listy "
 "z #90 są to: tożsamość i zgody, płatności oraz synteza mowy. Do uzupełnienia.")

LICENCJE = [
 ["Komponent", "Licencja", "Skutek", "Zamiennik"],
 ["Gadgetbridge", "AGPL-3.0", "blokuje zamknięty model komercyjny; fork nie zmienia licencji",
  "profile Bluetooth SIG GATT"],
 ["wger", "AGPL-3.0", "jak wyżej", "ExerciseDB"],
 ["OpenPose", "niekomercyjna, 25 000 USD/rok", "wyłączone zastosowania sportowe",
  "MediaPipe (Apache 2.0)"],
 ["Open Food Facts", "ODbL share-alike", "baza pochodna musi być udostępniona",
  "trzymać w bazie odrębnej od własnych"],
 ["MinIO", "AGPL-3.0 (zmiana po 2021)", "wymaga zamiany przy zamkniętym modelu usługowym",
  "SeaweedFS albo Garage"],
 ["Grafana i Loki", "AGPL-3.0 (zmiana po 2021)",
  "jak wyżej — dotyczy też modułu Analytics z #134", "Prometheus z VictoriaMetrics"],
 ["Sentry", "FSL", "jak wyżej", "—"],
 ["Redis", "2024 poza OSI, 2025 AGPLv3",
  "dotyczy warstwy kolejek Redis i BullMQ w MVP oraz MLP", "Valkey — fork na licencji BSD"],
]

TERMINY = [
 ["Data", "Co obowiązuje", "Kogo dotyczy", "Podstawa"],
 ["28.05.2026", "EUDAMED obowiązkowy — moduły Actors, UDI/Devices, Notified Bodies, "
  "Market Surveillance", "producenci wyrobów i systemów — także składający zestawy",
  "Decyzja (UE) 2025/2371"],
 ["02.08.2026", "AI Act art. 50 — oznaczanie treści syntetycznych", "systemy generatywne",
  "Rozp. (UE) 2024/1689"],
 ["03.10.2026", "rejestracja w Wykazie KSC (NIS2)",
  "podmioty od progu średniego; mikroprzedsiębiorstwa co do zasady wyłączone",
  "ustawa o KSC, Dz.U. 2026 poz. 252"],
 ["26.03.2027", "EHDS — ogólne stosowanie; akty wykonawcze, wyznaczenie organów dostępu",
  "wszyscy", "Rozp. (UE) 2025/327"],
 ["26.03.2029", "EEHRxF kategoria 1: karta pacjenta, e-recepta, e-dyspensacja",
  "systemy EHR", "Rozp. (UE) 2025/327"],
 ["26.03.2031", "EEHRxF kategoria 2: obrazowanie, wyniki laboratoryjne, wypisy",
  "systemy EHR", "Rozp. (UE) 2025/327"],
]

TERMIN_RYNKOWY = (
 "Termin 26 marca 2029 jest jedyną zewnętrzną datą tworzącą rynek. Mapper "
 "CDA ↔ FHIR ↔ EEHRxF dla polskiej implementacji krajowej nie istnieje jako produkt, "
 "a potrzebuje go każdy dostawca EDM w kraju. Kto zbuduje mapper przed 2029, sprzedaje "
 "go każdemu dostawcy systemu gabinetowego w Polsce; kto zacznie w 2029 — nikomu.")

KOREKTY = [
 ["Miejsce", "Zapis błędny", "Zapis poprawny", "Podstawa"],
 ["A5.6 e-recepta", "„Class I (WSS)”",
  "nie jest wyrobem medycznym; WSS to certyfikat systemu usługodawcy, nie klasa MDR",
  "MDR i ustawa o SIOZ"],
 ["Koszt certyfikatu P1", "ok. 5 000 zł/rok",
  "BEZPŁATNY; wniosek w RPWDL 2.0, ważność 2 lata", "Centrum e-Zdrowia"],
 ["ISO 13485", "„wymagane dla klasy IIa i wyższych”",
  "MDR wymaga systemu zarządzania jakością; ISO 13485 jest drogą wykazania zgodności, "
  "nie obowiązkiem ustawowym", "MDR art. 10 ust. 9"],
 ["Inspektor ochrony danych", "„obowiązkowy dla danych zdrowotnych”",
  "obowiązkowy przy dużej skali albo gdy przetwarzanie jest główną działalnością",
  "RODO art. 37 ust. 1"],
 ["A1.2 Gadgetbridge", "„fork, koszt 0”",
  "AGPL-3.0 blokuje zamknięty model; fork nie zmienia licencji", "licencja projektu"],
 ["A1.1 Terra API", "0,002 USD za synchronizację",
  "wycena oparta na użyciu; plany od 399–499 USD/mies.", "cennik dostawcy"],
 ["Sekcja komponentów", "AD8232 — Texas Instruments",
  "Analog Devices; MAX30102 — Maxim, obecnie część Analog Devices po przejęciu w 2021",
  "dokumentacja producenta"],
 ["Mini Implant Human", "MDR klasa I",
  "klasa wyższa — wyrób implantowany długotrwale", "MDR zał. VIII"],
 ["Eternal Pet", "„łatwiejsze regulacje CVMP niż MDR”",
  "MDR nie obejmuje weterynarii w ogóle — to odrębny reżim, nie łatwiejsza ścieżka",
  "MDR art. 1"],
 ["Koszt certyfikacji IIa", "10–20 tys. zł albo 50–150 tys. zł i 6–12 miesięcy",
  "PCBC: ocena dokumentacji 1 500–3 200 zł/h, całościowa ocena 15–90 tys. zł; "
  "Komisja Europejska: 30–250 tys. EUR za ocenę kliniczną; opłaty jednostki notyfikowanej "
  "35–70 tys. EUR za pierwszy cykl IIb; realnie setki tysięcy do kilku mln PLN "
  "i 18–36 miesięcy",
  "cennik PCBC, materiały KE, analiza opłat jednostek notyfikowanych"],
 ["Karta A1.1 w Master 3.0",
  "stos „Unity, ARKit/ARCore, backend metawersum”, interfejs „nakładki AR na otoczenie”",
  "treść karty X2.1 lub X2.3 wklejona do funkcji pobierania danych z API — błąd źródła, "
  "do usunięcia, nie do przeniesienia", "porównanie kart"],
 ["Karty #129 — redirect 116 123",
  "„jeżeli AI wykryje sygnały kryzysu, automatyczne przekierowanie aktywuje się”",
  "to jest automatyczne wykrywanie kryzysu, czyli wersja MDR klasy IIa; "
  "w MVP obowiązuje wersja ręczna", "katalog granicy MDR z #126"],
]

MVP_OBOWIAZKOWE = [
 ["Kod", "Funkcja", "Powód"],
 ["A8.10", "redirect 116 123",
  "jedyna funkcja bez ewolucji faz — dostępna na każdym etapie"],
 ["A18.3", "deklaracja przeznaczenia i ograniczeń — co wyrób NIE robi", "wymóg"],
 ["A18.8", "tryb degradacji przy niedostępności modelu albo chmury", "wymóg"],
 ["A18.10", "log dostępu widoczny dla użytkownika", "wymóg i wyróżnik handlowy"],
 ["A18.11", "granularne wycofanie zgody per cel", "wymóg i wyróżnik handlowy"],
 ["A18.12", "realizacja usunięcia danych z potwierdzeniem, odrębna od eksportu",
  "wymóg i wyróżnik handlowy; to NIE jest to samo co D1.4 eksport"],
 ["A19.1", "oznaczanie treści generowanej przez model", "wymóg — AI Act art. 50"],
 ["A20.1", "rejestr przyjmowanych leków", "fundament farmakoterapii"],
 ["A20.3", "alergie i przeciwwskazania", "bezpieczeństwo"],
 ["A21.9", "wywiad rodzinny",
  "najsilniejszy predyktor w każdym modelu ryzyka, koszt jednego pola formularza"],
 ["A22.3", "mapa i skale bólu",
  "najczęstszy powód wizyty u lekarza; nie występował w 185 funkcjach w żadnej postaci"],
 ["A23.1–A23.3", "dostępność podstawowa", "wymóg prawny UE dla aplikacji konsumenckich"],
 ["A24.4", "czasowe udostępnienie lekarzowi", "prostsze niż pełna integracja"],
]

MODULY16 = [
 ["#", "Moduł", "Rozwiązanie agregowane", "Własne IP", "Koszt"],
 ["1", "Eternal Data Vault — backend FHIR",
  "Medplum: otwarty serwer FHIR, zgodny z RODO i EHDS",
  "definicja rozszerzeń schematu FHIR i polityki dostępu", "0 zł self-hosted"],
 ["2", "Eternal Bridge — wearables",
  "Terra API na wczesnym etapie, docelowo własny fork Gadgetbridge",
  "warstwa normalizująca do FHIR", "niski, zależny od liczby użytkowników"],
 ["3", "Eternal OCR Gateway", "DocTR albo LayoutLMv3, ewentualnie Google Vision",
  "Medical Context Parser: słownik synonimów, jednostek, reguły mapowania",
  "0 zł przy open source"],
 ["4", "Eternal RAG", "LangChain, Pinecone lub OSS, darmowe API PubMed i Cochrane",
  "selekcja i nadzór nad bazą zweryfikowanych publikacji", "niski"],
 ["5", "Eternal Orchestrator", "LangChain albo Flowise",
  "algorytm priorytetyzacji rekomendacji — nadrzędność zaleceń kardiologicznych "
  "nad dietetycznymi", "0 zł"],
 ["6", "Eternal Translator", "BioMistral-7B albo Llama-3 na własnej instancji GPU",
  "prompty systemowe i reguły przekładu żargonu medycznego", "niski"],
 ["7", "Eternal ID", "Solid Pods (Inrupt) — dane u użytkownika",
  "zarządzanie kluczami w standardzie post-quantum i autoryzacja profilu", "0 zł"],
 ["8", "Eternal Underwriting AI", "Stripe Connect i API ubezpieczycieli (MGA)",
  "algorytm Eternal Score", "niski, prowizyjny"],
 ["9", "Eternal Agent Manager", "Flowise albo LangFlow",
  "definicje promptów systemowych dla ról: kardiolog, dietetyk, pulmonolog", "0 zł"],
 ["10", "Eternal Digital Twin", "Three.js i TensorFlow.js w przeglądarce",
  "model predykcyjny starzenia biologicznego", "0 zł"],
 ["11", "Eternal Audit Trail", "Hyperledger Fabric albo publiczna sieć testowa",
  "struktura zapisu logów i weryfikacja podpisów", "0 zł"],
 ["12", "Eternal Notification Hub", "Firebase Cloud Messaging i Twilio",
  "reguły dystrybucji i priorytetyzacji powiadomień",
  "niski, zależny od wolumenu SMS"],
 ["13", "Eternal Analytics Dashboard",
  "Grafana i Metabase — UWAGA: Grafana na AGPL-3.0, zob. blokady licencyjne",
  "szablony raportów i analiz kohortowych", "0 zł"],
 ["14", "Eternal Subscription Engine", "Stripe Billing",
  "logika poziomów Lite, Premium i Elite, okresy próbne, kontrola uprawnień",
  "niski, prowizja"],
 ["15", "Eternal Bio-Firewall", "WireGuard i OpenSSL",
  "autoryzacja i dystrybucja kluczy dla podmiotów zewnętrznych", "—"],
 ["16", "Eternal Mapping Engine", "biblioteka Pint i słowniki norm",
  "Fuzzy Matcher — korekta błędów OCR, np. „Clukosa” na „Glukoza”", "—"],
]

MODULY16_MVP = (
 "Dziewięć modułów wchodzi do MVP w wersji najtańszej z możliwych. Bridge — darmowy "
 "Apple HealthKit i ręczne dodawanie danych, bez Terra. Data Vault — gotowy Medplum. "
 "Mapping Engine — DocTR albo Google Vision i podstawowy słownik synonimów. RAG — "
 "LangChain, BioMistral, PubMed API. Orchestrator — JEDEN agent (Internista), nie zespół "
 "specjalistów. Translator — przełożenie wyników na prosty polski. Eternal ID — Solid Pods "
 "albo klasyczne logowanie e-mailem i hasłem. Score Engine — proste reguły i progi na "
 "normach laboratoryjnych, bez modelu predykcyjnego. Audit Trail — logowanie w bazie "
 "danych, bez blockchaina.")

GRAF = (
 "Pole „Zasila / Czerpie z” w kartach funkcji tworzy graf zależności nieobecny w żadnym "
 "innym pliku korpusu. Dwa węzły mają najwyższy stopień wejścia: EDM D1.1 oraz Digital "
 "Twin D2.2 — każda ścieżka danych kończy się w jednym z nich. To potwierdza ustalenie, "
 "że D1 nie jest modułem Twin, tylko fundamentem, a Twin jest jednym z jego konsumentów. "
 "Krawędzie istotne dla architektury: OCR i dokumenty zasilają FHIR A1.5, EDM D1.1, "
 "Twin D2.2 i Scoring A16.7; pomiary Station S1–S2 zasilają telemedycynę A5.1 i eskalację "
 "A14.1; Bio-Monitor C2.x wraz z pompami MEMS zasila zamkniętą pętlę terapeutyczną ze "
 "Station — to jedyne miejsce, w którym Closed Loop występuje jako krawędź grafu, a nie "
 "jako produkt; dane genetyczne, OCR badań i Causal AI zasilają Marketplace auto-order "
 "oraz Station Auto-Refill S3.4, i ta krawędź czyni z suplementacji funkcję graniczną; "
 "powiadomienia A14 zasilają wszystkie moduły jako warstwa notyfikacji.")

DO_WERYFIKACJI = [
 "stawki rynkowe w Polsce 2026 — programista, inżynier uczenia maszynowego, "
 "konsultant regulacyjny, inspektor ochrony danych",
 "koszt certyfikacji MDR klasy IIa — opłaty jednostki notyfikowanej, ISO 13485, "
 "ocena kliniczna, czas oczekiwania w kolejce",
 "dostępność API u laboratoriów: Diagnostyka, ALAB, Synevo",
 "warunki programów afiliacyjnych: Dietly, Maczfit i pozostałe",
 "aktualna funkcjonalność IKP i mojeIKP — czy pokazuje wyniki prywatne "
 "i czy przyjmuje dane z urządzeń",
 "istnienie gotowego narzędzia PIK → FHIR u dostawców krajowych",
 "warunki Apple HealthKit i Google Health Connect — dostęp serwerowy "
 "i ograniczenia regulaminowe",
 "warunki członkostwa Bluetooth SIG przy produkcji własnych urządzeń",
 "uzupełnienie klas komponentów K10, K19 i K24, których nie ma w korpusie",
]

PRZED_BUDOWA = [
 "Napisanie przeznaczenia dla każdej ze 115 funkcji — jedno zdanie. To jedyny dokument, "
 "którego dziś nie ma, a który decyduje o klasie regulacyjnej.",
 "Rozstrzygnięcie licencji Gadgetbridge. Harmonogram Macierzy v3 przewiduje fork "
 "w trzecim kwartale 2026, co jest sprzeczne z zastrzeżeniem licencyjnym w tej samej "
 "macierzy.",
 "Decyzja, czy Eternal świadczy teleporadę, czy tylko pośredniczy — to determinuje "
 "strukturę spółek i status RPWDL.",
 "Wskazanie, które funkcje graniczne pójdą kiedykolwiek ścieżką medyczną. Reszta zostaje "
 "wellness na stałe i można ją zbudować taniej.",
 "Założenie rejestru komponentów obcych (SOUP) od pierwszej biblioteki — to jedyna "
 "pozycja w projekcie nieodtwarzalna wstecz.",
 "Klasyfikacja bezpieczeństwa IEC 62304 (A/B/C) dla funkcji planowanych w warstwie C.",
]
