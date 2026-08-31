# -*- coding: utf-8 -*-
"""Rejestr komponentow Eternal: klasy K01-K30, dostawcy, skladowe I-IV, progi zmiany.

Zrodlo bazowe: Specyfikacja Master 5.4, sekcja "11. KOMPONENT I ALTERNATYWY" (25 klas)
oraz sekcja 4.2 "Piec klas komponentow" i 7. "Orkiestracja i kontrola nad dostawcami".
Klasy K10, K19, K24, K29, K30 sa uzupelnieniem luki — w korpusie nie mialy definicji.
Pozycje oznaczone [ZALOZENIE] nie pochodza z korpusu i wymagaja potwierdzenia.
"""

# --- 4.2 Piec klas komponentow (Master 5.4) --------------------------------
# Klasa V (funkcjonalna) jest jedyna opisana w korpusie. I-IV uzupelnione tutaj.
SKLADOWE = {
 'I': ('Środowisko', 'Runtime, baza, magazyn z rezydencją w UE, kolejki, wdrożenia',
       'PostgreSQL 16 + MinIO, Hetzner/OVH Falkenstein i Gravelines (dwie lokalizacje UE), '
       'Docker + Kubernetes, RabbitMQ, GitHub Actions → ArgoCD'),
 'II': ('Zgodność', 'Zgody, dziennik audytowy, klucze, kontrola dostępu, przeznaczenie',
        'Rejestr zgód granularnych (K5), dziennik w profilu IHE ATNA (K6), HashiCorp Vault '
        'z kluczami po naszej stronie, RBAC + ABAC, deklaracja przeznaczenia per funkcja'),
 'III': ('Architektura', 'Adaptery, brama, tożsamość, orkiestracja, obserwowalność',
         'Eternal API Gateway (przypisanie + routing + pomiar + odebranie), adapter na klasę '
         'komponentu, Keycloak + Węzeł Krajowy, orkiestrator jednoagentowy, OpenTelemetry'),
 'IV': ('Dane', 'Model Eternal, mapper, rejestr, terminologia, proweniencja',
        'Eternal Standard (własny model), mapper LOINC/ICD-10/SNOMED ↔ nazwy polskie, '
        'rejestr implantów i wyników podłużnych, słowniki z EPP, polityka proweniencji'),
}

# --- klasy komponentow (V. funkcjonalna) -----------------------------------
# (kod, nazwa, A_open, B_platne, C_wlasne, prog_wyjscia, kontrola, rekomendacja,
#  szczebel_kontroli_docelowy, skladowe_wymagane, zrodlo)
K = {
 'K01': ('Adapter wearables / urządzenia noszone',
   'Apple HealthKit + Google Health Connect (SDK producenta, 0 zł); Open Wearables (MIT)',
   'Terra API ~399–499 USD/mies (~100 tys. kredytów); Rook 399 USD/mies do 750 userów; '
   'Junction/Vital 0,50 USD/user/mies, min. 300 USD; Vitalera (FOLLOWHEALTH S.L.) — '
   'jedyny z tej czwórki deklarujący własne CE wg MDR, FHIR R5',
   'Własne adaptery na profilach Bluetooth SIG GATT (Heart Rate, Weight Scale, Glucose, '
   'Blood Pressure, CGM) — protokoły publiczne, bez opłat',
   '3 000 zł/mies LUB 5 000 aktywnych userów — co nastąpi pierwsze',
   'Rdzeń nigdy nie woła API dostawcy. Zawsze przez adapter. Dwa źródła równoległe dla '
   'tego samego parametru. Vitalera i Terra na tym samym urządzeniu źródłowym to jeden '
   'punkt awarii w dwóch opakowaniach — liczyć redundancję technologii, nie dostawcy',
   'HealthKit + Health Connect od dnia 1. Terra dopiero gdy klient B2B zażąda Garmina/Oura. '
   'KOREKTA (ETL-031, plik #119): oznakowanie CE dostawcy obejmuje KONKRETNĄ FUNKCJĘ '
   'W JEGO APLIKACJI I W JEGO PRZEZNACZENIU. Dane surowe pobrane przez interfejs '
   'programistyczny NIE są objęte tym certyfikatem — cudzego oznakowania nie da się '
   'odziedziczyć przez adapter. CE Vitalery podnosi wiarygodność pomiaru i nie zdejmuje '
   'z nas ani jednego obowiązku',
   3, ['I', 'III', 'IV'], 'Master 5.4 §11 + analiza Vitalera (Pytania i odpowiedzi)'),

 'K02': ('Model danych i mapowanie FHIR',
   'HAPI FHIR (Apache 2.0), Medplum (Apache 2.0), LinuxForHealth FHIR',
   'Aidbox (~od 1 000 USD/mies), Firely Server (licencja roczna), Google Cloud Healthcare API '
   '(per wywołanie)',
   'Własny mapper LOINC/ICD-10 ↔ nazwy polskie + słownik synonimów',
   'Nigdy nie wychodzimy — mapowanie zawsze własne',
   'Wersjonowanie semantyczne mapowania. Pola zarezerwowane. Jedna osoba z prawem weta na zmiany',
   'Medplum self-host + własny mapper. Serwer wymienialny, mapper nie',
   5, ['I', 'IV'], 'Master 5.4 §11'),

 'K03': ('Storage, baza, backup',
   'PostgreSQL + MinIO/S3-compatible, Hetzner/OVH (UE)',
   'AWS RDS + S3 (UE), Google Cloud SQL, Azure — 3–6× drożej przy tej skali',
   'Własny schemat, polityka retencji, szyfrowanie at-rest',
   'Nie wychodzimy — zmieniamy hostingodawcę, nie technologię',
   'Rezydencja UE obowiązkowa (RODO). Backup w drugiej lokalizacji UE. Klucze u nas, nie u dostawcy',
   'Hetzner UE od dnia 1. AWS dopiero gdy klient B2B tego zażąda w umowie',
   5, ['I', 'II'], 'Master 5.4 §11'),

 'K04': ('OCR dokumentów medycznych',
   'Tesseract + DocTR (Apache 2.0), PaddleOCR — wymaga fine-tuningu na polskich wynikach',
   'Google Document AI (~1,5 USD/1000 stron OCR podstawowy; ~30 USD/1000 procesor formularzowy), '
   'AWS Textract, Azure Document Intelligence',
   'Własny Polish Medical Context Parser: fuzzy matching nazw badań, jednostek, zakresów',
   '2 000 zł/mies LUB moment wejścia funkcji do dossier wyrobu',
   'Parser zawsze własny, silnik wymienny. Test regresyjny na 200 realnych wynikach przed '
   'każdą zmianą silnika',
   'Document AI (procesor formularzowy) + własny parser od dnia 1',
   5, ['I', 'III', 'IV'], 'Master 5.4 §11'),

 'K05': ('LLM / inferencja modelu językowego',
   'Llama / Mistral / BioMistral self-hosted',
   'Gemini Flash, Claude Haiku, GPT-4o-mini — grosze za token przy małej skali',
   'Brak sensownej opcji własnej — trening modelu językowego to setki tysięcy',
   '2 500 zł/mies — powyżej tego self-host tanieje',
   'Abstrakcja providera od dnia 1 (jeden interfejs, trzy backendy). Żaden prompt nie zawiera '
   'danych zdrowotnych bez umowy powierzenia. Od 2.08.2026 obowiązek oznaczania treści '
   'generowanej (AI Act art. 50)',
   'Gemini Flash lub GPT-4o-mini. Self-host dopiero przy dużym ruchu',
   2, ['I', 'II', 'III'], 'Master 5.4 §11'),

 'K06': ('Baza wektorowa i RAG',
   'Qdrant (Apache 2.0), Weaviate, pgvector w PostgreSQL',
   'Pinecone (~70 USD/mies starter, rośnie), Weaviate Cloud, Zilliz',
   'Własny korpus: PubMed (publiczny), ChPL/URPL (publiczne), wytyczne towarzystw',
   'Nie wychodzimy z pgvector przy małej skali — nie ma po co',
   'pgvector eliminuje osobną zależność. Jedna baza zamiast dwóch. Korpus zawsze własny — '
   'to on decyduje o jakości odpowiedzi, nie silnik wektorowy',
   'pgvector w istniejącym PostgreSQL. Zero nowych zależności',
   5, ['I', 'IV'], 'Master 5.4 §11'),

 'K07': ('Transkrypcja mowy (STT)',
   'Whisper (MIT) self-hosted, faster-whisper',
   'gpt-4o-mini-transcribe ~0,003 USD/min; Deepgram Nova-3 ~0,0043 USD/min batch; '
   'Whisper API 0,006 USD/min; Speechmatics ~0,24 USD/h',
   'Własny słownik medyczny polski + korekta post-transkrypcyjna',
   '2 400–3 000 godzin nagrań miesięcznie — powyżej tego self-host tanieje',
   'Dane zdrowotne NIE mogą iść do API bez umowy powierzenia. Sprawdzić to przed pierwszym nagraniem',
   'gpt-4o-mini-transcribe + własny słownik. Najtańszy start w całym projekcie',
   2, ['I', 'II'], 'Master 5.4 §11'),

 'K08': ('Wideo / WebRTC',
   'LiveKit (Apache 2.0) self-host, Jitsi Meet, mediasoup',
   'LiveKit Cloud, Daily.co, Twilio Video, Vonage — per uczestnikominuta',
   'Nie budujemy własnego WebRTC — to lata pracy',
   'Nie wychodzimy — przy małym ruchu Jitsi wystarcza',
   'WYMAGA statusu podmiotu leczniczego jeśli TY świadczysz. Sam serwer nie załatwia sprawy',
   'Jitsi self-host. Zero kosztu licencji, wystarczająco dobre',
   3, ['I', 'II'], 'Master 5.4 §11'),

 'K09': ('Powiadomienia push / e-mail / SMS',
   'Firebase Cloud Messaging (darmowe do dużej skali), Gotify, ntfy',
   'SendGrid (~15 USD/mies), Twilio SMS (~0,25 zł/SMS w PL), OneSignal',
   'Własny serwer push nie ma sensu — sklepy i tak pośredniczą',
   'Nie wychodzimy',
   'SMS drogi — używać tylko do eskalacji. Push do reszty. Treść powiadomienia nie może '
   'zawierać danych zdrowotnych — ekran blokady jest publiczny',
   'FCM + SendGrid. Prawie zero kosztu',
   2, ['I', 'II'], 'Master 5.4 §11'),

 'K10': ('Płatności i rozliczenia',
   'Brak sensownej opcji OSS — to usługa regulowana (PSD2, KNF)',
   'Stripe (~1,4% + 1 zł EEA), Przelewy24 (~1,5–1,9%), Adyen (interchange++), Mollie, PayU',
   'Własne rozliczenie prowizji marketplace na podstawie zdarzeń z Gateway',
   'Nie wychodzimy — licencja płatnicza jest poza zakresem',
   'Dane kartowe nigdy nie dotykają naszej infrastruktury (SAQ-A). Rozdzielić operatora '
   'płatności od operatora rozliczeń prowizji — to my liczymy prowizję, nie oni',
   'Przelewy24 dla rynku PL + Stripe dla zagranicy od pierwszej transakcji B2B',
   2, ['I', 'II'], '[ZALOZENIE] klasa nieopisana w korpusie'),

 'K11': ('Wizualizacja danych i wykresy',
   'Recharts, D3.js, Chart.js, Apache ECharts (MIT/Apache)',
   'Highcharts (licencja komercyjna ~500–2 500 USD), amCharts',
   'Własny układ kafelków i wybór metryk',
   'Nie wychodzimy — MIT wystarcza',
   'Brak ryzyka licencyjnego. Ryzyko jest gdzie indziej: wykres z linią odniesienia i kolorem '
   'ostrzegawczym bywa interpretacją, a interpretacja jest wyrobem',
   'Recharts. Zero kosztu',
   5, ['III'], 'Master 5.4 §11'),

 'K12': ('Grafika 3D / AR',
   'Three.js (MIT), Babylon.js (Apache 2.0), model-viewer',
   'Unity (licencja per-seat, historia zmian cennika), Unreal (royalty)',
   'Własny model 3D ciała + logika mapowania danych na model',
   'Nie wchodzimy w Unity bez wyraźnej potrzeby — to jedyna zależność bez substytutu w stacku',
   'Three.js zamiast Unity. Unity ma najgorszy profil ryzyka licencyjnego w projekcie',
   'Three.js. Odłożyć do czasu, gdy Twin ma sens biznesowy',
   5, ['III'], 'Master 5.4 §11'),

 'K13': ('Forum i społeczność',
   'Discourse (GPL-2.0) self-host, Flarum, NodeBB',
   'Circle.so (~99 USD/mies), Discord (darmowy, ale nie kontrolujesz danych)',
   'Własne forum nie ma sensu',
   'Nie wychodzimy',
   'MODERACJA TREŚCI ZDROWOTNYCH TO KOSZT STAŁY, nie jednorazowy. Wliczyć etat częściowy. '
   'Treść użytkowników o leczeniu bez moderacji to ryzyko po stronie operatora platformy',
   'Discourse self-host',
   3, ['I', 'II'], 'Master 5.4 §11'),

 'K14': ('Dane środowiskowe (pogoda, smog)',
   'IMGW (API publiczne, 0 zł), GIOŚ Jakość Powietrza (0 zł), Open-Meteo (0 zł do użytku '
   'niekomercyjnego — sprawdzić przed wdrożeniem komercyjnym)',
   'Airly API, Breezometer (Google), OpenWeatherMap (~40–180 USD/mies)',
   'Własne reguły progowe i korelacje (Bio-Weather Intelligence — moat)',
   'Nie wychodzimy — IMGW i GIOŚ są darmowe i publiczne',
   'Dane państwowe są stabilniejsze niż komercyjne API. Reguła korelacji zawsze własna — '
   'to ona jest moatem, nie dane pogodowe',
   'IMGW + GIOŚ. Zero kosztu',
   5, ['I', 'IV'], 'Master 5.4 §11'),

 'K15': ('Bazy żywności i wartości odżywczych',
   'Open Food Facts (ODbL — UWAGA: share-alike), USDA FoodData Central (public domain, 0 zł)',
   'Nutritionix (~499 USD/mies), Edamam (~100–500 USD/mies), Spoonacular',
   'Własna baza produktów polskich + korekta przez użytkownika',
   'Nie wychodzimy z USDA (public domain). ODbL wymaga ostrożności',
   'ODbL wymaga udostępnienia pochodnej bazy. Trzymać dane OFF osobno od własnych — '
   'zmieszanie ich zaraża własną bazę licencją share-alike',
   'USDA (public domain) + własna baza PL budowana przez userów',
   5, ['I', 'IV'], 'Master 5.4 §11'),

 'K16': ('Bazy ćwiczeń i analiza ruchu',
   'MediaPipe (Apache 2.0), MoveNet — pose estimation; ExerciseDB',
   'Kemtai, Exer, Onyx — SDK komercyjne',
   'Własna baza ćwiczeń + wideo techniki',
   'Nie wychodzimy z MediaPipe',
   'OpenPose ma LICENCJĘ NIEKOMERCYJNĄ — nie używać. wger jest AGPL-3.0 — ten sam problem '
   'co Gadgetbridge. Ocena techniki i ostrzeganie przed kontuzją może być wyrobem',
   'MediaPipe. Omijać OpenPose i wger',
   3, ['I', 'III'], 'Master 5.4 §11'),

 'K17': ('Geolokalizacja i mapy',
   'OpenStreetMap + Nominatim + Leaflet (0 zł)',
   'Google Maps Platform (~7 USD/1000 zapytań po darmowym limicie), Mapbox',
   'Własna baza punktów (laboratoria, apteki, punkty poboru)',
   '800 zł/mies — powyżej tego OSM',
   'OSM eliminuje ryzyko zmiany cennika Google (historia podwyżek)',
   'OSM + Leaflet. Własna baza punktów',
   5, ['I', 'IV'], 'Master 5.4 §11'),

 'K18': ('Generowanie dokumentów PDF',
   'WeasyPrint (BSD), Puppeteer (Apache 2.0), wkhtmltopdf',
   'DocRaptor, PDFShift, Api2Pdf — per dokument',
   'Własne szablony',
   'Nie wychodzimy',
   'Brak ryzyka technicznego. Ryzyko treściowe: dokument z naszym logo i wnioskiem to '
   'nasze oświadczenie, nie cudze',
   'WeasyPrint. Zero kosztu',
   5, ['III'], 'Master 5.4 §11'),

 'K19': ('Tożsamość, zgody i kontrola dostępu',
   'Keycloak (Apache 2.0), Ory Kratos/Hydra, Supabase Auth',
   'Auth0 (~0,02–0,05 USD/MAU powyżej limitu), Okta, Stytch',
   'Węzeł Krajowy (profil zaufany, mObywatel) + własny rejestr zgód granularnych '
   'i dziennik dostępu widoczny dla użytkownika',
   'Nigdy nie wychodzimy z własnego rejestru zgód — to on jest dowodem wobec organu',
   'Zgoda na korzystanie z aplikacji MUSI być rozdzielona od zgody na scoring i na '
   'udostępnienie danych — zgoda pakietowa jest nieswobodna (RODO mot. 43). Wycofanie '
   'zgody musi być tak samo łatwe jak jej udzielenie i musi działać wstecz',
   'Keycloak self-host od dnia 1, Węzeł Krajowy przy pierwszej integracji z P1',
   5, ['I', 'II', 'III'], '[ZALOZENIE] klasa nieopisana w korpusie'),

 'K20': ('Integracja P1 / e-zdrowie',
   'Brak opcji OSS — to system państwowy',
   'Certyfikat P1 WSS (dostęp do środowiska integracyjnego bezpłatny) + KS-BLOZ '
   '(baza leków) ~10 000 zł/rok',
   'Nie da się zastąpić — monopol państwowy',
   'Nie wychodzimy — nie ma dokąd',
   'WYMAGA statusu usługodawcy (wpis RPWDL). Bez tego certyfikat jest bezużyteczny. '
   'Reguła 33% tu NIE OBOWIĄZUJE — odpowiedzią na monopol jest stanie się niezbędnym, '
   'nie redundancja',
   'Odłożyć do momentu, gdy jest podmiot leczniczy (RPWDL 2029–2030)',
   3, ['II', 'III', 'IV'], 'Master 5.4 §11 + korekta 5.4 (certyfikat bezpłatny)'),

 'K21': ('Marketplace i afiliacja',
   'Brak OSS — to sieci afiliacyjne',
   'Dietly przez Circlewise (darmowe dla wydawcy, model CPS); Maczfit przez MyLead (3,20% CPS); '
   'suplementy ~30% prowizji',
   'Własny marketplace w Forge',
   'Nie dotyczy — to przychód, nie koszt',
   'Konflikt interesu: rekomendacja + prowizja. Wymaga jawności wobec użytkownika przy '
   'każdej rekomendacji, nie w regulaminie',
   'Dietly przez Circlewise OD ZARAZ. Zero negocjacji, przychód od pierwszego miesiąca',
   3, ['I', 'IV'], 'Master 5.4 §11'),

 'K22': ('Firmware urządzeń i BLE',
   'ESP-IDF (Apache 2.0), Zephyr RTOS, protokoły Bluetooth SIG GATT (publiczne, 0 zł)',
   'Moduły OEM z gotowym firmware (Chiny) — koszt sprzętu, nie licencji',
   'Własny firmware na module OEM',
   'Nigdy nie wychodzimy z własnego firmware',
   'Firmware cudzy = brak kontroli nad zmianą i brak dostępu do dokumentacji przy certyfikacji. '
   'Bez dostępu do kodu nie ma dossier',
   'Moduł OEM + własny firmware. Zacząć od Pet Bio-Tag (brak ściany MDR)',
   5, ['I', 'III'], 'Master 5.4 §11'),

 'K23': ('Silnik reguł i priorytetyzacja',
   'Drools, json-rules-engine, OPA (Apache 2.0)',
   'Brak sensownej opcji płatnej w tej skali',
   'Własny silnik reguł jawnych i wersjonowanych',
   'Nigdy nie wychodzimy',
   'Reguły jawne da się audytować i obronić przed regulatorem. Model uczony nie. '
   'Zaczynać od reguł. Wersja reguły musi być zapisana przy każdym wyniku — inaczej '
   'nie da się odtworzyć, na jakiej podstawie zapadła ocena',
   'Własny silnik reguł. Prosty, jawny, wersjonowany',
   5, ['II', 'III', 'IV'], 'Master 5.4 §11'),

 'K24': ('Kolejki, zadania i przetwarzanie asynchroniczne',
   'RabbitMQ (MPL-2.0), Redis Streams, NATS, Celery',
   'AWS SQS/EventBridge, Confluent Cloud, Google Pub/Sub — per komunikat',
   'Własna polityka ponowień, kolejka martwych listów i idempotencja',
   'Nie wychodzimy — RabbitMQ w środowisku własnym',
   'Kolejka przenosi dane zdrowotne — szyfrowanie w tranzycie i w spoczynku, retencja '
   'komunikatu w godzinach, nie w dniach. Zdarzenie w kolejce jest też materiałem dowodowym '
   'dla dziennika audytowego',
   'RabbitMQ od dnia 1 — jest już w środowisku, zero nowej zależności',
   5, ['I', 'II'], '[ZALOZENIE] K24 nie ma definicji w korpusie — luka uzupelniona'),

 'K25': ('Rozpoznawanie obrazu (posiłki, skóra)',
   'Modele wizyjne open (YOLO, CLIP) + Open Food Facts',
   'Passio.ai, LogMeal, Foodvisor, Nutritionix Vision — SDK per wywołanie',
   'Własny model na polskich produktach',
   '2 000 zł/mies',
   'Dokładność rozpoznawania posiłków ze zdjęcia jest niska (badania podają rzędu 30–40% '
   'trafności logowania). NIE deklarować dokładności — to szacunek, nie pomiar. '
   'Zdjęcie zmiany skórnej z oceną to wyrób klasy IIa — tego SDK nie załatwia',
   'SDK komercyjne + korekta ręczna. Nie budować własnego modelu',
   2, ['I', 'III'], 'Master 5.4 §11'),

 'K26': ('Katalogi IP i patentów',
   'GitHub API (0 zł), Espacenet/EPO OPS (0 zł), Google Patents',
   'Derwent, PatSnap, Orbit — tysiące USD/rok',
   'Własna kuracja i tagowanie',
   'Nie wychodzimy — API są darmowe',
   'Brak ryzyka. Wartością jest kuracja, nie dostęp do bazy',
   'Espacenet + GitHub API. Zero kosztu',
   5, ['IV'], 'Master 5.4 §11'),

 'K27': ('Procesy organizacyjne (Hub, Fundacja)',
   'Brak — to procesy, nie oprogramowanie',
   'Narzędzia do zarządzania naborem (Airtable, Notion) ~kilkaset zł/mies',
   'Własne regulaminy i procesy',
   'Nie dotyczy',
   'Umowy licencyjne są kluczowe dla struktury właścicielskiej. Regulamin naboru do Hubu '
   'przesądza, kto jest właścicielem wniesionego IP — to nie jest formalność',
   'Notion/Airtable na start. Własne dopiero przy skali',
   5, ['II'], 'Master 5.4 §11'),

 'K28': ('Moduł certyfikowany (osobny wyrób)',
   'BRAK — moduł certyfikowany nie może być złożony z przypadkowych komponentów OSS',
   'Proxy do cudzego wyrobu z CE przez API (np. Labplus — ma API i partnerstwa '
   'z Diagnostyką i Synevo)',
   'Własny wyrób: dossier, ISO 13485, PRRC, UDI, EUDAMED, ocena kliniczna',
   'Nie dotyczy — to decyzja strategiczna, nie kosztowa',
   'Proxy działa TYLKO gdy nie modyfikujesz wyniku i wskazujesz producenta. '
   'Modyfikacja wyniku = jesteś producentem. Reguła 33% tu nie obowiązuje — '
   'trzech dostawców to trzy dossier',
   'Proxy na start (Labplus). Własny wyrób dopiero przy przychodzie B2B',
   4, ['II', 'IV'], 'Master 5.4 §11'),

 'K29': ('Laboratoria i diagnostyka zewnętrzna',
   'Brak OSS — to sieci laboratoryjne',
   'Diagnostyka, Synevo, ALAB, uPacjenta — model afiliacyjny 10–15% prowizji, '
   'integracja IT ~50 tys. zł na start (Tor B z roadmapy v4)',
   'Eternal Lab Pop-up (kontener 24/7) — dopiero po udowodnionym popycie',
   'Nie dotyczy — to przychód. Próg wejścia we własne lab: powtarzalny wolumen zamówień',
   'Wynik laboratoryjny jest cudzym wyrobem — przekazujemy go bez zmiany i z nazwą '
   'wykonawcy. Dodanie własnej interpretacji do cudzego wyniku czyni z nas producenta '
   'oprogramowania klasy IIa',
   'Afiliacja z dwiema sieciami równolegle od dnia 1 — jedna sieć to jeden punkt awarii '
   'i zero siły negocjacyjnej',
   3, ['III', 'IV'], 'Roadmapa v4 (Tor B) + Master 5.4 §11 K28'),

 'K30': ('Wsparcie psychologiczne i terapia',
   'Brak OSS klinicznie odpowiedzialnego — protokoły CBT są publiczne, wykonanie nie',
   'twojpsycholog.ai, Wellbee, Mindgram, HearMe — platformy z siecią terapeutów, '
   'model B2B2C (pracodawca płaci) albo prowizja od sesji',
   'Własny moduł A8 po walidacji popytu: dziennik nastroju (warstwa A) + kierowanie '
   'do terapeuty partnera, nigdy własna terapia bez podmiotu leczniczego',
   'Nie wychodzimy w stronę własnej terapii — wychodzimy w stronę własnej warstwy danych. '
   'Próg: 2 000 aktywnych użytkowników modułu A8 miesięcznie',
   'OBSZAR NAJWYŻSZEJ SZKODY. Detektor kryzysu i przekierowanie na 116 123 jest '
   'obligatoryjne i nie może zależeć od dostawcy — to funkcja własna, w rdzeniu. '
   'Chatbot nie prowadzi terapii; prowadzi dziennik i kieruje do człowieka',
   'Partnerstwo z jedną platformą + własny dziennik nastroju i własny detektor kryzysu '
   'od dnia 1. Ocena przejęcia dopiero po 12 miesiącach wspólnego ruchu',
   3, ['II', 'III'], '[ZALOZENIE] klasa uzupelniona; korpus wymienia Wellbee i Mindgram '
   'jako konkurencje modulu A8'),
}

# --- warstwy zgodnosci (Master 5.4) ----------------------------------------
WARSTWA = {
 'A': ('Pacjent, poza MDR',
       'Agregacja, przechowywanie, pokazywanie własnych danych, eksport, historia, '
       'przypomnienia bez oceny, dziennik nastroju, wellness, marketplace, społeczność, '
       'digitalizacja dokumentów, platforma teleporady, edukacja',
       'wellness', 'NIE', 'Sprzedaż od dnia pierwszego'),
 'B': ('Klinika, poza MDR',
       'Transkrypcja i dokumentacja, umawianie wizyt, prezentacja danych pacjenta '
       'bez interpretacji',
       'nie-wyrób', 'NIE', 'Sprzedaż od pierwszego dnia bez jednostki notyfikowanej'),
 'C': ('Klinika, wyrób klasy IIa i wyżej',
       'Interpretacja z oceną, alerty progowe z oceną kliniczną, triage, predykcja ryzyka, '
       'dobór lub modyfikacja terapii',
       'medyczny', 'TAK — IIa lub wyżej',
       'Dossier, jednostka notyfikowana, ISO 13485, PRRC, UDI, EUDAMED, ocena kliniczna. '
       '80–150 tys. zł i 6–12 miesięcy dla klasy IIa'),
}

# --- piec szczebli kontroli (Master 5.4 §7.3) ------------------------------
SZCZEBEL = {
 1: ('Użytkownik cudzego produktu', 'Zero kontroli', 'Żadna rola wg MDR'),
 2: ('Integracja przez interfejs', 'Dostawca może odciąć', 'Żadna rola wg MDR'),
 3: ('Partnerstwo', 'Wspólna oferta, wpis do rejestru', 'Zależna od przeznaczenia'),
 4: ('Marka własna na cudzym produkcie', 'Wysoka kontrola',
     'PRODUCENT — dossier, PRRC, EUDAMED'),
 5: ('Model własny', 'Pełna kontrola', 'Producent'),
}

# --- wyzwalacze zmiany modelu ---------------------------------------------
# (kod, nazwa, co konkretnie mierzone, co sie zmienia, zrodlo)
WYZWALACZE = [
 ('W1', 'Próg kosztowy klasy',
  'Miesięczny rachunek od dostawcy przekracza próg wyjścia zapisany w karcie klasy '
  '(K01: 3 000 zł lub 5 000 userów; K04: 2 000 zł; K05: 2 500 zł; K17: 800 zł; K25: 2 000 zł)',
  'Wariant B (usługa płatna) ustępuje wariantowi A (open source) albo C (własne). '
  'Adapter zostaje ten sam — zmienia się jego implementacja',
  'Master 5.4 §11, pole „Próg wyjścia”'),
 ('W2', 'Próg koncentracji — reguła 33%',
  'Udział aktywnych użytkowników przypisanych do jednego dostawcy W OBRĘBIE KLASY. '
  'Ostrzeżenie przy 25%, twardy próg przy 33%',
  'Gateway przestaje przypisywać nowych użytkowników do tego dostawcy i przenosi część '
  'istniejących przy najbliższym oknie migracji',
  'Master 5.4 §7.1'),
 ('W3', 'Zmiana warstwy zgodności funkcji',
  'Funkcja przechodzi z warstwy A lub B do C — pojawia się własna ocena, próg kliniczny '
  'albo predykcja ryzyka',
  'Albo bierzemy dossier, albo model proxy w ścisłym sensie: przekazujemy CUDZY WYNIK '
  'bez zmiany i z nazwą wykonawcy (K28). UWAGA: samo pobranie danych przez API od dostawcy '
  'z CE nie jest proxy i nie zdejmuje obowiązku — cudzego oznakowania nie da się '
  'odziedziczyć przez adapter (ETL-031, plik #119)',
  'Master 5.4 §4.2 i definicja warstw'),
 ('W4', 'Marka własna na cudzym produkcie',
  'Logo Eternal na obudowie albo w interfejsie wyniku bez nazwy wykonawcy',
  'Szczebel kontroli skacze z 3 na 4. Stajemy się PRODUCENTEM ze wszystkimi obowiązkami: '
  'dossier, PRRC, EUDAMED. To decyzja regulacyjna o koszcie w setkach tysięcy, '
  'nie decyzja marketingowa',
  'Master 5.4 §7.3 i decyzja 11'),
 ('W5', 'Modyfikacja cudzego wyniku',
  'Zmieniamy, przeliczamy, uzupełniamy albo interpretujemy wynik pochodzący z cudzego '
  'wyrobu z CE',
  'Model proxy przestaje działać. Jesteśmy producentem oprogramowania, a nie pośrednikiem',
  'Master 5.4 §11 K28 i decyzja 10'),
 ('W6', 'Ukrycie dostawcy przed użytkownikiem',
  'Użytkownik nie widzi, czyj wynik ogląda',
  'Odpowiadamy za wynik my. Decyzje 10, 11 i 12 są powiązane: trzy „tak” dają jeden model, '
  'trzy „nie” dają inny, mieszanka daje sprzeczność, którą zauważy pierwszy audytor',
  'Master 5.4, decyzja 12'),
 ('W7', 'Zmiana licencji komponentu',
  'Dostawca albo projekt open source zmienia warunki (precedensy w projekcie: '
  'Gadgetbridge AGPL-3.0, OpenPose licencja niekomercyjna, wger AGPL-3.0, '
  'Unity — historia zmian cennika)',
  'Natychmiastowy audyt licencji i przełączenie na wariant zapasowy. Dlatego trzy warianty '
  'muszą być ZAIMPLEMENTOWANE, nie tylko wypisane',
  'Master 5.4, rejestr ryzyka licencyjnego'),
 ('W8', 'Utrata ciągłości dostawcy',
  'Dostawca łamie SLA, ogłasza koniec usługi albo zostaje przejęty przez konkurenta',
  'Uruchomienie planu wyjścia w czasie zapisanym w karcie funkcji (CZAS WYJŚCIA w dniach). '
  'Bez tego pola plan wyjścia jest deklaracją',
  'Master 5.4 §4.2, wymóg pola „czas wyjścia”'),
]


# --- ekonomia per uzytkownik ----------------------------------------------
# (klasa, dostawca, model rozliczenia, koszt PLN/user/mies, udzial docelowy %,
#  podstawa liczby)
# Kursy przyjete: 1 USD = 4,00 PLN, 1 EUR = 4,30 PLN. Wartosci [SZACUNEK] wynikaja
# z przelicznika wolumenu na uzytkownika i wymagaja potwierdzenia na realnym ruchu.
EKONOMIA = [
 ('K01', 'Apple HealthKit + Google Health Connect', 'SDK producenta, bez opłat', 0.00, 34,
  'Master 5.4: 0 zł — SDK w systemie operacyjnym'),
 ('K01', 'Terra API', 'abonament + kredyty', 3.60, 33,
  '399–499 USD/mies ÷ ~500 userów (100 tys. kredytów ÷ 200/user) [SZACUNEK]'),
 ('K01', 'Rook', 'abonament do 750 userów', 2.13, 22,
  '399 USD/mies ÷ 750 userów [SZACUNEK]'),
 ('K01', 'Junction/Vital', 'per użytkownik', 2.00, 11,
  '0,50 USD/user/mies, minimum 300 USD — próg opłacalności ~600 userów'),
 ('K01', 'Vitalera', 'per użytkownik; CE dotyczy jego wyrobu, nie naszego', 0.00, 0,
  'Cennik niepubliczny — pozycja zarezerwowana dla funkcji warstwy C [BRAK]'),
 ('K03', 'Hetzner/OVH + PostgreSQL + MinIO', 'ryczałt za serwer', 0.05, 67,
  '~200 EUR/mies infrastruktury ÷ 17 tys. userów [SZACUNEK]'),
 ('K03', 'AWS RDS + S3 (region UE)', 'per zasób', 0.20, 33,
  'Master 5.4: 3–6× drożej przy tej skali'),
 ('K04', 'Google Document AI — procesor formularzowy', 'per strona', 0.24, 34,
  '30 USD/1000 stron × 2 dokumenty/user/mies [SZACUNEK]'),
 ('K04', 'AWS Textract', 'per strona', 0.26, 33,
  'Cennik zbliżony do Document AI [SZACUNEK]'),
 ('K04', 'Tesseract + DocTR self-host', 'koszt CPU', 0.03, 33,
  'Koszt obliczeniowy własnego serwera [SZACUNEK]'),
 ('K05', 'Gemini Flash', 'per token', 0.08, 34,
  '~50 zapytań/user/mies przy cenniku modelu ekonomicznego [SZACUNEK]'),
 ('K05', 'GPT-4o-mini', 'per token', 0.10, 33,
  'Rząd wielkości jak Gemini Flash [SZACUNEK]'),
 ('K05', 'Llama/Mistral self-host', 'koszt GPU', 0.06, 33,
  'Opłacalny powyżej progu 2 500 zł/mies łącznego rachunku'),
 ('K07', 'gpt-4o-mini-transcribe', 'per minuta', 0.24, 34,
  '0,003 USD/min × 20 min/user/mies [SZACUNEK]'),
 ('K07', 'Deepgram Nova-3 (batch)', 'per minuta', 0.34, 33,
  '0,0043 USD/min × 20 min/user/mies [SZACUNEK]'),
 ('K07', 'Whisper self-host', 'koszt GPU', 0.10, 33,
  'Opłacalny powyżej 2 400–3 000 godzin nagrań miesięcznie'),
 ('K08', 'Jitsi self-host', 'koszt serwera', 0.02, 50,
  'Master 5.4: wystarczająco dobre przy małym ruchu'),
 ('K08', 'Daily.co / LiveKit Cloud', 'per uczestnikominuta', 0.40, 50,
  '~10 min konsultacji/user/mies [SZACUNEK]'),
 ('K09', 'Firebase Cloud Messaging', 'darmowe do dużej skali', 0.00, 67,
  'Master 5.4: praktycznie zero kosztu'),
 ('K09', 'Twilio SMS (tylko eskalacja)', 'per wiadomość', 0.25, 33,
  '~0,25 zł/SMS w PL, jeden SMS eskalacyjny na użytkownika miesięcznie'),
 ('K17', 'OpenStreetMap + Leaflet', 'bez opłat', 0.00, 67,
  'Master 5.4: 0 zł'),
 ('K17', 'Google Maps Platform', 'per zapytanie', 0.14, 33,
  '7 USD/1000 zapytań × 5 zapytań/user/mies [SZACUNEK]'),
 ('K25', 'Passio.ai / LogMeal SDK', 'per wywołanie', 0.60, 50,
  '~15 zdjęć posiłków/user/mies [SZACUNEK]'),
 ('K25', 'YOLO/CLIP self-host', 'koszt GPU', 0.15, 50,
  'Poniżej progu 2 000 zł/mies nie opłaca się przenosić'),
]

# --- strategia wobec gotowych modulow i produktow --------------------------
# (podmiot, co robi, co daje nam, czego nie daje, postawa, warunek zmiany postawy)
MODULY = [
 ('Vitalera (FOLLOWHEALTH S.L.)',
  'Zunifikowane API/SDK do wearables i urządzeń medycznych — Garmin, Omron, Dexcom, '
  'Withings, Polar, HealthKit, Health Connect. FHIR R5, webhooki, alerty. '
  'Deklaruje własne oznakowanie CE wg MDR',
  'Skraca pięćdziesiąt osobnych integracji do jednej. Jako jedyny w klasie K01 pozwala '
  'obsłużyć funkcję warstwy C w modelu proxy, bez własnego dossier',
  'Nie jest Station, Care Podem, laboratorium, Bliźniakiem, Eternal ID ani własnym '
  'firmware. Rozwiązuje pytanie „jak dostać dane z urządzenia”, nie „czyj jest ekosystem”',
  'Integracja przez adapter (szczebel 2) na MVP, partnerstwo (szczebel 3) przy pierwszym '
  'kliencie B2B. NIGDY jako jedyny backend',
  'Gdy udział przypisanych użytkowników przekroczy 33% klasy K01 albo gdy warunki '
  'cenowe zmienią się powyżej progu 3 000 zł/mies — przeniesienie części ruchu '
  'na HealthKit/Health Connect i własne adaptery GATT'),
 ('Labplus',
  'Wyrób z oznakowaniem CE i API, z partnerstwami z Diagnostyką i Synevo',
  'Pozwala oddać wynik laboratoryjny użytkownikowi bez własnego dossier — model proxy '
  'w klasie K28. Najtańsze wejście w warstwę C, jakie jest w całej architekturze',
  'Nie pozwala niczego dopisać do wyniku. W chwili, gdy dodamy własną interpretację, '
  'proxy przestaje działać i stajemy się producentem',
  'Proxy (szczebel 3) — przekazujemy wynik bez zmiany, z nazwą wykonawcy',
  'Wyzwalacz W5: pierwsza własna interpretacja wyniku. Wtedy albo cofamy interpretację, '
  'albo bierzemy dossier klasy IIa (80–150 tys. zł, 6–12 mies.)'),
 ('twojpsycholog.ai i platformy pokrewne (Wellbee, Mindgram, HearMe)',
  'Platformy wsparcia psychologicznego z siecią terapeutów, sprzedawane najczęściej '
  'pracodawcom jako świadczenie pracownicze',
  'Gotowa podaż terapeutów i gotowy proces umawiania — dwie rzeczy, których nie da się '
  'zbudować kodem. Moduł A8 dostaje wykonawcę usługi bez zakładania podmiotu leczniczego',
  'Nie dają danych. Użytkownik zostaje w ich systemie, historia sesji też. Bez własnego '
  'dziennika nastroju i własnego detektora kryzysu moduł A8 nie ma z czego zbudować moatu',
  'Partnerstwo (szczebel 3) z jedną platformą + własny dziennik nastroju i własny '
  'detektor kryzysu z przekierowaniem na 116 123 od dnia pierwszego. Detektor kryzysu '
  'nigdy nie jest po stronie partnera — to funkcja rdzenia',
  'Ocena przejęcia albo budowy własnej dopiero po dwunastu miesiącach wspólnego ruchu '
  'i przy 2 000 aktywnych użytkowników modułu A8 miesięcznie. Wcześniej nie ma czego '
  'wyceniać ani czym zastępować'),
 ('Sieci laboratoryjne (Diagnostyka, Synevo, ALAB, uPacjenta)',
  'Pobrania, wykonanie badań, wynik z podpisem diagnosty',
  'Przychód od pierwszego miesiąca przy prowizji 10–15% i integracji IT ~50 tys. zł, '
  'bez CAPEX na własne laboratorium (Tor B z roadmapy)',
  'Nie dają kontroli nad jakością ani terminem. Dane są punktowe, nie ciągłe',
  'Afiliacja z DWIEMA sieciami równolegle (szczebel 3). Jedna sieć to jeden punkt awarii '
  'i zero siły negocjacyjnej',
  'Własne Eternal Lab Pop-up dopiero przy powtarzalnym wolumenie zamówień — nie wcześniej. '
  'Wariant „certyfikacja cudzych urządzeń” jest tańszy i szybszy niż własna produkcja'),
 ('Terra API / Rook / Junction',
  'Agregatory danych z wearables klasy konsumenckiej',
  'Pokrycie Garmina, Oury i Fitbita, którego HealthKit i Health Connect nie dają '
  'w modelu B2B',
  'Klasa wellness. UWAGA — wcześniejszy zapis, że dostawca z własnym CE obsłuży '
  'warstwę C, jest błędny: cudzego oznakowania nie da się odziedziczyć przez adapter. '
  'Różnica między G1 a G2 dotyczy wiarygodności pomiaru i profilu zgodności, '
  'nie zdjęcia z nas obowiązku. '
  'Trzej dostawcy sięgający po ten sam SDK producenta opaski to jedna zależność '
  'w trzech opakowaniach',
  'Wariant B w klasie K01, uruchamiany dopiero gdy klient B2B zażąda konkretnego '
  'urządzenia (szczebel 2)',
  'Próg wyjścia: 3 000 zł/mies albo 5 000 aktywnych userów. Wtedy własne adaptery '
  'Bluetooth SIG GATT — protokoły są publiczne i bezpłatne'),
]

# --- zasady bezpieczenstwa bramy ------------------------------------------
BEZPIECZENSTWO = [
 ('Rdzeń nigdy nie woła API dostawcy',
  'Każde wywołanie przechodzi przez adapter klasy komponentu. Wymiana dostawcy to '
  'wymiana jednego pliku, nie zmiana w kodzie funkcji',
  'Master 5.4 §11, mechanizm kontroli K01'),
 ('Klucze po naszej stronie',
  'Klucze szyfrujące i klucze API w magazynie sekretów kontrolowanym przez nas, '
  'nigdy u dostawcy. Rezydencja danych w UE obowiązkowa, backup w drugiej lokalizacji UE',
  'Master 5.4 §11, mechanizm kontroli K03'),
 ('Umowa powierzenia przed pierwszym wywołaniem',
  'Żaden prompt, plik ani nagranie z danymi zdrowotnymi nie trafia do zewnętrznego API '
  'bez podpisanej umowy powierzenia. Sprawdzane przed pierwszym wywołaniem, nie po',
  'Master 5.4 §11, mechanizmy kontroli K05 i K07'),
 ('Rozdzielenie zgód',
  'Zgoda na korzystanie z aplikacji jest odrębna od zgody na scoring i od zgody na '
  'udostępnienie danych. Zgoda pakietowa jest nieswobodna i upada przy pierwszej kontroli',
  'RODO mot. 43 i art. 9; ustalenie 6 analizy poprawności'),
 ('Dziennik dostępu widoczny dla użytkownika',
  'Kto, co, kiedy i na jakiej podstawie — w profilu IHE ATNA, z podglądem po stronie '
  'użytkownika. To jednocześnie wymóg i wyróżnik produktowy',
  'Master 5.4, moduł kontrolny K6 i funkcja A18.5'),
 ('Wersja reguły zapisana przy wyniku',
  'Każdy wynik silnika reguł niesie numer wersji reguły, która go wygenerowała. '
  'Bez tego nie da się odtworzyć podstawy oceny ani obronić jej przed organem',
  'Master 5.4 §11, mechanizm kontroli K23'),
 ('Dwa źródła dla tego samego parametru',
  'Parametr krytyczny (tętno, glukoza, ciśnienie) czytany równolegle z dwóch niezależnych '
  'źródeł. Rozbieżność jest sygnałem, nie błędem do ukrycia',
  'Master 5.4 §11, mechanizm kontroli K01'),
 ('Redundancja technologii, nie tylko dostawcy',
  'Reguła 33% mierzy dostawcę. Trzeba dodać drugi licznik: ilu dostawców stoi na tym samym '
  'sprzęcie źródłowym, tej samej bibliotece i tej samej chmurze',
  'Master 5.4 §7.1, „pułapka”'),
]
