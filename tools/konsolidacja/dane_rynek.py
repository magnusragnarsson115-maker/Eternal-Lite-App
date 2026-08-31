# -*- coding: utf-8 -*-
"""Odpowiedniki rynkowe, dostawcy pogrupowani, test otwartego standardu.

Zrodlo bazowe: ETERNAL_Macierz_Dostawcow.xlsx z korpusu (22 pozycje, arkusze
01_Macierz / 02_Bez_wyjscia / 03_Najszybciej_rosnace) — dokument, ktory zadaje
dokladnie te pytania i ktorego wynikow nie przeniesiono do zadnego dokumentu
nadrzednego. Tutaj sa przeniesione i rozszerzone o ocene per funkcja.
"""

# --- TEST OTWARTEGO STANDARDU (z korpusu, arkusz 00_Jak_czytac) ------------
TEST = ('Czy istnieje publiczna specyfikacja tego, co kupuję?',
        'TAK — mogę odejść, bo mogę to napisać sam. Zamknięcie dostawcy nie jest groźne.',
        'NIE — jestem uwiązany. NIE BUDOWAĆ NA TYM RDZENIA. Może być funkcją, '
        'nigdy fundamentem.')

# 22 pozycje: (produkt, konkurencja, [3 opcje], [white label], wyjscie,
#              standard, rozwoj, rdzen_dozwolony)
POZYCJE = [
 ('Wearables — opaski, zegarki', 'Garmin, Fitbit, Oura, Whoop, Withings',
  ['Terra API (~399–499 USD/mies)', 'Rook (399 USD do 750 userów)',
   'Junction/Vital (0,50 USD/user, min. 300)'],
  ['OEM Shenzhen (Zepp, Amazfit ODM)', 'Withings B2B', 'Polar OEM'],
  'Profile Bluetooth SIG GATT są PUBLICZNE — piszesz własny adapter. '
  'Koszt 45 osobodni ≈ 36 tys. zł',
  'TAK — Bluetooth SIG GATT', 'Rośnie: nowe profile medyczne w standardzie SIG', 'TAK'),
 ('Waga, ciśnieniomierz, glukometr', 'Withings, Omron, Beurer, Accu-Chek',
  ['Withings API', 'Omron Connect', 'iHealth'],
  ['Wszyscy trzej dają OEM/white label', 'Beurer OEM', 'Shenzhen ODM'],
  'Profile GATT: Weight Scale, Blood Pressure, Glucose, CGM — publiczne. '
  'Czytasz urządzenie bezpośrednio',
  'TAK — Bluetooth SIG GATT', 'Stabilny, standard rozszerzany', 'TAK'),
 ('CGM — ciągły pomiar glukozy', 'Dexcom, Abbott Libre, Medtronic',
  ['Dexcom API', 'Abbott LibreView', 'przez Terra/Junction'],
  ['Brak white label — rynek zamknięty, trzech producentów'],
  'Profil GATT CGM istnieje, ale producenci używają własnych protokołów. '
  'RYZYKO PRZYJĘTE — nie budować rdzenia',
  'CZĘŚCIOWO', 'Rośnie bardzo szybko — najważniejszy segment', 'NIE'),
 ('Serwer FHIR / model danych', 'Epic, Cerner, InterSystems',
  ['HAPI FHIR (Apache 2.0)', 'Medplum (Apache 2.0)', 'LinuxForHealth'],
  ['Aidbox (od ~1000 USD/mies)', 'Firely Server', 'Smile CDR'],
  'Standard HL7 FHIR jest PUBLICZNY. Własny serwer to 60–90 osobodni. '
  'Mapowanie PL i tak własne',
  'TAK — HL7 FHIR', 'Medplum rośnie najszybciej — FHIR-native, Apache 2.0', 'TAK'),
 ('OCR dokumentów medycznych', 'Google, AWS, Azure',
  ['Google Document AI (1,5–30 USD/1000 str.)', 'AWS Textract',
   'Azure Document Intelligence'],
  ['Brak white label — to API'],
  'Tesseract, DocTR, PaddleOCR — wszystkie OSS. Parser kontekstu PL '
  'i tak własny (50 osobodni)',
  'TAK — modele OSS', 'DocTR i PaddleOCR dojrzewają szybko', 'TAK'),
 ('Model językowy (LLM)', 'OpenAI, Google, Anthropic',
  ['Gemini Flash', 'GPT-4o-mini', 'Claude Haiku'], ['Brak white label'],
  'Llama, Mistral, BioMistral — otwarte wagi, self-host. Koszt przenosi się na GPU',
  'CZĘŚCIOWO — otwarte wagi', 'Modele otwarte gonią zamknięte co ~12 mies.', 'TAK'),
 ('Baza wektorowa / RAG', 'Pinecone, Weaviate, Zilliz',
  ['Pinecone (~70 USD/mies)', 'Weaviate Cloud', 'Zilliz'], ['Brak'],
  'pgvector w istniejącym PostgreSQL — zero nowych zależności. Qdrant (Apache 2.0)',
  'TAK — OSS', 'pgvector wystarcza do ~10 mln wektorów', 'TAK'),
 ('Transkrypcja mowy (STT)', 'Nuance, Deepgram, OpenAI',
  ['gpt-4o-mini-transcribe (0,003 USD/min)', 'Deepgram Nova-3', 'Speechmatics'],
  ['Deepgram on-prem', 'Speechmatics on-prem', 'NVIDIA Riva'],
  'Whisper (MIT) self-host. Słownik medyczny PL i tak własny — to jest fosa',
  'TAK — Whisper MIT', 'Modele PL słabe — bariera wejścia dla zagranicznych', 'TAK'),
 ('Wideo / telemedycyna', 'Zoom, Teams, Twilio',
  ['LiveKit Cloud', 'Daily.co', 'Twilio Video'],
  ['LiveKit on-prem', 'Jitsi (self-host)', 'mediasoup'],
  'Jitsi Meet, mediasoup — OSS. Koszt tylko serwera TURN/SFU',
  'TAK — WebRTC', 'Stabilny', 'TAK'),
 ('EEG / BCI', 'Neuralink, Synchron, EMOTIV',
  ['OpenBCI', 'EMOTIV', 'g.tec'],
  ['OpenBCI = OPEN HARDWARE — możesz produkować', 'EMOTIV OEM', 'Muse (InteraXon) SDK'],
  'OpenBCI jest open hardware — schematy publiczne. To jedyna droga bez setek mln USD',
  'TAK — OpenBCI open hardware', 'OpenBCI rośnie, społeczność badawcza', 'TAK'),
 ('Transponder / implant zwierzęcy', 'Datamars, Trovan, Allflex',
  ['Datamars', 'Trovan', 'Allflex (MSD)'], ['Wszyscy trzej dają white label'],
  'ISO 11784/11785 to standard PUBLICZNY. Firmware i protokół i tak własne',
  'TAK — ISO 11784/11785', 'Stabilny — dobry tor walidacyjny dla Capsule', 'TAK'),
 ('Analiza ruchu / pose estimation', 'Kemtai, Exer, Tempo',
  ['MediaPipe (Apache 2.0)', 'MoveNet', 'Kemtai SDK'], ['Kemtai', 'Exer', 'Onyx'],
  'MediaPipe jest Apache 2.0 — pełna swoboda. UWAGA: OpenPose ma licencję NIEKOMERCYJNĄ',
  'TAK — MediaPipe', 'MediaPipe rozwijany przez Google', 'TAK'),
 ('Rozpoznawanie posiłków', 'Foodvisor, LogMeal, Passio',
  ['Passio.ai', 'LogMeal', 'Nutritionix Vision'],
  ['Passio SDK white label', 'LogMeal white label', 'Foodvisor API'],
  'Modele wizyjne OSS + Open Food Facts (ODbL) + USDA (public domain). '
  'Baza produktów PL i tak własna',
  'CZĘŚCIOWO', 'Dokładność niska (~30–40%) — nie deklarować precyzji', 'TAK'),
 ('Bazy żywnościowe', 'Nutritionix, Edamam, Spoonacular',
  ['USDA FoodData Central (public domain)', 'Open Food Facts (ODbL)', 'Edamam'], ['Brak'],
  'USDA jest public domain — bez ograniczeń. UWAGA: ODbL wymaga share-alike, '
  'trzymać osobno',
  'TAK — public domain', 'Open Food Facts rośnie, ale pokrycie PL słabe', 'TAK'),
 ('Bazy ćwiczeń', 'wger, ExerciseDB, Musclewiki',
  ['ExerciseDB', 'Musclewiki', 'Everkinetic'], ['Brak'],
  'UWAGA: wger jest AGPL-3.0 — blokuje zamknięty model. ExerciseDB bezpieczniejsze',
  'CZĘŚCIOWO', 'Stabilny', 'TAK'),
 ('Płatności', 'Stripe, PayU, Przelewy24',
  ['Przelewy24 (~1,5–1,9%)', 'Tpay', 'Stripe (1,9% + 0,30 zł)'],
  ['Brak — wymaga licencji KNF'],
  'Brak wyjścia — ale trzech dostawców wzajemnie wymiennych. Wdrożyć DWÓCH od początku',
  'NIE, ale konkurencja', 'Stabilny', 'NIE'),
 ('Baza leków', 'KS-BLOZ, Pharmindex',
  ['KS-BLOZ (~10 tys. zł/rok)', 'Pharmindex', 'Rejestr URPL (publiczny, uboższy)'],
  ['Brak'],
  'MONOPOL faktyczny. Rejestr URPL jest publiczny, ale nie zawiera cen i zamienników. '
  'RYZYKO PRZYJĘTE', 'NIE', 'Stabilny monopol', 'NIE'),
 ('Integracja P1 / e-recepta', 'Centrum e-Zdrowia',
  ['Brak alternatyw — monopol państwowy'], ['Brak'],
  'BRAK WYJŚCIA. Nie budować rdzenia na tym. Sandbox INT dostępny bezpłatnie bez RPWDL',
  'NIE', 'EHDS zmieni to od 2029', 'NIE'),
 ('Obroża GPS dla zwierząt', 'Tractive, Fi, Whistle',
  ['Tractive API', 'Fi', 'Whistle'], ['Shenzhen ODM (moduły GPS+GSM)', 'PetPace', 'Weenect'],
  'Moduł GPS+GSM z Shenzhen + własny firmware. Protokoły NMEA i MQTT publiczne',
  'TAK — NMEA/MQTT', 'Rośnie', 'TAK'),
 ('Smart clothes / tekstylia', 'Hexoskin, Sensoria, Nadi X, Myant',
  ['Hexoskin (SDK)', 'Sensoria (SDK)', 'Myant Skiin'],
  ['Producenci tekstyliów z modułem OEM', 'Myant', 'Shenzhen ODM'],
  'BRAK realnego wyjścia — rynek niedojrzały, brak standardu. REKOMENDACJA: nie wchodzić',
  'NIE', 'Rynek kurczy się od 2022 — kilka bankructw', 'NIE'),
 ('CDMO — produkcja leków', 'Polpharma, Adamed, Recipharm, Lonza',
  ['Polpharma', 'Adamed', 'Recipharm'], ['Wszyscy dają produkcję kontraktową'],
  'NIE WCHODZIĆ — inny biznes, inny reżim (GMP), inne kompetencje, '
  'minimalne serie rzędu setek tys. zł', 'NIE DOTYCZY', 'Poza zakresem Eternal', 'NIE'),
 ('Nanotech medyczny', 'Brak dojrzałego rynku',
  ['BRAK — etap badań klinicznych, pojedyncze firmy'], ['Brak'],
  'BRAK ALTERNATYW. Substytut funkcjonalny: CGM + Pet Bio-Tag jako tor walidacyjny protokołu',
  'NIE', 'Horyzont 2035+', 'NIE'),
]

# --- SZESC AGREGATOROW POGRUPOWANYCH --------------------------------------
# (nazwa, grupa, klasa, model, pokrycie A1 %, zgodnosc z Eternal %, rozwoj,
#  adaptowalnosc, roznica wobec pozostalych)
AGREGATORY = [
 ('Terra API', 'G1 — agregatory konsumenckie', 'wellness',
  '~399–499 USD/mies, ~100 tys. kredytów (~200/user)', 70, 55,
  'Stabilny, najszersze pokrycie urządzeń konsumenckich',
  'Wysoka — REST + webhooki, adapter to jeden plik',
  'Najszersze pokrycie i najdroższy przy małej skali. Rozlicza kredyty, '
  'nie użytkowników — koszt rośnie skokowo z częstotliwością synchronizacji'),
 ('Rook', 'G1 — agregatory konsumenckie', 'wellness',
  '399 USD/mies do 750 userów', 65, 55,
  'Młodszy, mniejsze pokrycie, agresywniejszy cennik',
  'Wysoka — model zbliżony do Terra',
  'Tańszy poniżej 750 userów, potem skokowo drożeje. Mniejsza lista urządzeń'),
 ('Junction / Vital', 'G1 — agregatory konsumenckie', 'wellness',
  '0,50 USD/user/mies, minimum 300 USD', 65, 55,
  'Rozwija się w stronę laboratoriów — Vital ma integracje z sieciami lab w USA',
  'Wysoka',
  'Jedyny z trójki rozliczany per użytkownik — przewidywalny koszt jednostkowy. '
  'Próg opłacalności około 600 userów'),
 ('Vitalera (FOLLOWHEALTH S.L.)', 'G2 — agregatory medyczne (RPM)', 'medyczny',
  'Cennik niepubliczny [BRAK]', 85, 80,
  'Rośnie w stronę RPM i EHDS — najbliżej kierunku Eternal',
  'Średnia — FHIR R5 wymaga mapowania na R4B używane w PL',
  'JEDYNY z całej szóstki deklarujący własne oznakowanie CE wg MDR. KOREKTA wobec '
  'wcześniejszej wersji tego zestawienia: to NIE znaczy, że obsłuży naszą funkcję '
  'warstwy C. Oznakowanie obejmuje konkretną funkcję w JEGO aplikacji i w JEGO '
  'przeznaczeniu; dane surowe z interfejsu nie są nim objęte, a cudzego CE nie da się '
  'odziedziczyć przez adapter (ETL-031, plik #119). Realna przewaga: wyższa '
  'wiarygodność pomiaru, profil RODO i system jakości po stronie dostawcy'),
 ('Validic', 'G2 — agregatory medyczne (RPM)', 'medyczny',
  'Enterprise, cennik niepubliczny', 80, 60,
  'Dojrzały, ale zorientowany na rynek amerykański i HIPAA',
  'Średnia — orientacja na USA, integracja z EHR amerykańskimi',
  'Najdłuższa historia w RPM, ale profil zgodności to HIPAA, nie RODO. '
  'Dla rynku UE oznacza dodatkową pracę, nie mniejszą'),
 ('Thryve (mio)', 'G2 — agregatory medyczne (RPM)', 'medyczny/wellness',
  'Per użytkownik, cennik na zapytanie', 70, 70,
  'Europejski, RODO-first, rośnie w segmencie badań klinicznych',
  'Wysoka — profil europejski zgodny z naszym',
  'Najbliższy nam kulturowo i regulacyjnie (Niemcy, RODO-first), ale węższe pokrycie '
  'urządzeń niż Terra. Dobry drugi wariant obok Vitalery'),
 ('Apple HealthKit + Google Health Connect', 'G3 — SDK producenta systemu', 'wellness',
  '0 zł — SDK w systemie operacyjnym', 70, 95,
  'Rozwijane przez Apple i Google, Health Connect zastąpił Google Fit',
  'Pełna — to nie jest dostawca, tylko system operacyjny użytkownika',
  'NIE JEST DOSTAWCĄ. Nie ma umowy, nie ma faktury, nie ma ryzyka odcięcia. '
  'Ograniczenie: działa tylko na urządzeniu użytkownika i tylko dla tego, '
  'co producent opaski zsynchronizował do systemu'),
 ('Własne adaptery Bluetooth SIG GATT', 'G4 — standard otwarty', 'wellness/medyczny',
  '45 osobodni ≈ 36 tys. zł jednorazowo', 60, 100,
  'Standard rozszerzany o nowe profile medyczne przez Bluetooth SIG',
  'Pełna — kod jest nasz',
  'Jedyna pozycja bez dostawcy. Pokrywa mniej urządzeń niż agregator, ale te, '
  'które pokrywa, pokrywa na zawsze i za darmo. Profile: Heart Rate, Weight Scale, '
  'Blood Pressure, Glucose, CGM'),
]

# --- ODPOWIEDNIKI PER FUNKCJA (modul A1 jako wzorzec) ---------------------
# (kod, funkcja, odpowiednik rynkowy, kto to robi, czy da sie kupic, nasza decyzja)
A1_FUNKCJE = [
 ('A1.1', 'Synchronizacja z agregatorem (Apple/Garmin/Oura)',
  'Unified wearables API', 'Terra, Rook, Junction, Vitalera, Thryve, Validic',
  'TAK — to jest gotowy produkt',
  'Kupujemy dostęp, budujemy adapter. Dwóch dostawców równolegle od startu'),
 ('A1.2', 'Open Wearables — tanie urządzenia (Xiaomi, Amazfit)',
  'Gadgetbridge i pochodne', 'Społeczność open source',
  'NIE — Gadgetbridge jest na AGPL-3.0 i blokuje model komercyjny; fork tego nie zmienia',
  'Własne adaptery na profilach Bluetooth SIG GATT. Standard publiczny, 45 osobodni'),
 ('A1.3', 'Ręczne dodawanie danych', 'Formularz z walidacją', 'Nikt tego nie sprzedaje',
  'NIE — to element interfejsu, nie produkt',
  'Własne. Koszt bliski zeru, wartość wysoka: to jedyne wejście dla użytkownika '
  'bez żadnego urządzenia'),
 ('A1.4', 'Ręczna korekta błędnych wartości', 'Edycja z historią zmian',
  'Nikt', 'NIE',
  'Własne. Wymóg RODO (prawo do sprostowania) i warunek zaufania do danych'),
 ('A1.5', 'Normalizacja do FHIR R4B', 'Serwer FHIR + mapper',
  'HAPI FHIR, Medplum, Aidbox, Firely, Google Healthcare',
  'CZĘŚCIOWO — serwer tak, mapper polski nie',
  'Medplum self-host jako serwer, mapper zawsze własny. To jest granica'),
 ('A1.6', 'Import CSV/JSON (backfill)', 'Parser plików', 'Nikt',
  'NIE', 'Własne. Warunek przenośności danych z RODO art. 20'),
 ('A1.7', 'Deduplikacja i wykrywanie anomalii',
  'Reguły jakości danych', 'Silniki reguł: Drools, OPA, json-rules-engine',
  'CZĘŚCIOWO — silnik tak, reguły nie',
  'Silnik open source, reguły własne i wersjonowane. Wersja reguły zapisywana '
  'przy każdym wyniku'),
 ('A1.8', 'Google Fit / Apple Health', 'SDK systemu operacyjnego',
  'Apple, Google — bezpłatnie',
  'NIE DOTYCZY — to nie dostawca, tylko system użytkownika',
  'Wdrożyć od dnia pierwszego. Pokrywa ~70% przypadków bez żadnej umowy'),
 ('A1.9', 'Synchronizacja z Eternal Station (BLE/MQTT)',
  'Protokół własny', 'My',
  'NIE — to nasz sprzęt',
  'Własne. Protokoły BLE GATT i MQTT publiczne, implementacja nasza'),
 ('A1.10', 'Przechowywanie danych (lokalnie i w chmurze)',
  'Baza + magazyn obiektowy', 'PostgreSQL, MinIO, Hetzner, AWS, GCP',
  'TAK — to towar',
  'PostgreSQL + MinIO na Hetznerze UE. Klucze po naszej stronie'),
]
