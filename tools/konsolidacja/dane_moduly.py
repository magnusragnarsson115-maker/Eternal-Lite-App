# -*- coding: utf-8 -*-
"""Rejestr modulow: kandydat na caly modul, kontrola %, OSS, ewolucja wellness->med.

MODEL KONTROLI (autorski, jawny — kazdy moze przeliczyc):
    kontrola = 0,40 x (szczebel/5) + 0,25 x dane + 0,20 x wymienialnosc + 0,15 x wniosek
  szczebel      1-5 wg Master 5.4 §7.3
  dane          czy mamy kopie dzialajaca bez dostawcy (0 / 0,5 / 1)
  wymienialnosc czy adapter izoluje rdzen od dostawcy (0 / 0,5 / 1)
  wniosek       czy koncowy wniosek nalezy do nas (0 / 0,5 / 1)
Wagi sa arbitralne, ale jawne. Zmiana wag zmienia wynik — to cecha, nie wada:
wagi mowia, co uznajemy za kontrole.
"""

WAGI = {'szczebel': 0.40, 'dane': 0.25, 'wymienialnosc': 0.20, 'wniosek': 0.15}


def kontrola(szczebel, dane, wymienialnosc, wniosek):
    return round(100 * (WAGI['szczebel'] * szczebel / 5 + WAGI['dane'] * dane
                        + WAGI['wymienialnosc'] * wymienialnosc
                        + WAGI['wniosek'] * wniosek))


# --- cztery kubelki wellness / med ----------------------------------------
KUBELKI = {
 'W': ('WELLNESS OD POCZĄTKU I NA ZAWSZE',
       'Funkcja nie może stać się wyrobem, bo nie zawiera i nie może zawierać oceny. '
       'Agregacja, prezentacja, eksport, społeczność, marketplace, dostępność.',
       'Nie planować dla niej ścieżki certyfikacyjnej — to marnowanie budżetu'),
 'W>M': ('WELLNESS DZIŚ, MEDYCZNA DOCELOWO',
         'Funkcja jest dziś prezentacją, ale jej wartość rośnie dopiero wtedy, gdy zacznie '
         'oceniać. Ewolucja jest zamierzona i wpisana w plan.',
         'Projektować od dnia pierwszego tak, żeby dało się ją odciąć: osobny moduł, '
         'osobne przeznaczenie, osobna wersja. Certyfikacja wtedy dotyczy modułu, '
         'nie całej aplikacji'),
 'M>W': ('MEDYCZNA Z NATURY, WYDANA JAKO WELLNESS',
         'Funkcja robi coś, co merytorycznie jest oceną kliniczną, ale została świadomie '
         'okrojona do wersji bez oceny, żeby wejść na rynek bez certyfikacji.',
         'NAJWYŻSZE RYZYKO W CAŁYM REJESTRZE. Granica jest cienka i przesuwa ją jedno '
         'zdanie w interfejsie. Wymaga zapisanej deklaracji przeznaczenia i przeglądu '
         'przy każdej zmianie tekstu na ekranie'),
 'M': ('MEDYCZNA OD POCZĄTKU',
       'Nie da się jej wydać jako wellness bez odebrania jej sensu. Interpretacja, triage, '
       'predykcja, dawkowanie, implant.',
       'Albo proxy do cudzego CE, albo własne dossier, albo funkcji nie ma. '
       'Trzeciej drogi nie ma'),
}

# --- moduly aplikacji ------------------------------------------------------
# klucz: (nazwa, cel, problem, uzytkownik, input, output,
#         kandydat_calosc, pokrycie%, kontrola_przy_kandydacie, co_zostaje_nasze,
#         oss, wlasne_kiedy, adapter, kubelek, priorytet, owner)
M = {
'A1': ('Agregacja i synchronizacja danych zdrowotnych',
 'Zebrać w jednym miejscu dane ze wszystkich urządzeń i źródeł, którymi użytkownik '
 'już dysponuje, bez wymagania od niego jakiejkolwiek pracy po pierwszym połączeniu.',
 'Dane zdrowotne jednej osoby leżą w sześciu aplikacjach producentów, z których żadna '
 'nie rozmawia z pozostałymi. Lekarz widzi wycinek, pacjent nie widzi całości.',
 'Każdy użytkownik aplikacji — to jest fundament, z którego korzystają wszystkie '
 'pozostałe moduły.',
 'Strumienie z HealthKit, Health Connect, Bluetooth GATT, Terra/Rook/Junction/Vitalera, '
 'import CSV/JSON, wpis ręczny',
 'Znormalizowany zasób FHIR R4B w Eternal Standard, z proweniencją: które źródło, '
 'kiedy, jaką ścieżką',
 'Vitalera (FOLLOWHEALTH S.L.) — zunifikowane API/SDK, FHIR R5, webhooki, deklarowane '
 'CE wg MDR. Alternatywy: Terra API, Rook, Junction/Vital — wszystkie klasy wellness',
 85, kontrola(2, 1, 1, 1),
 'Model danych (Eternal Standard), mapper, polityka proweniencji, decyzja o tym, '
 'który parametr z którego źródła wygrywa przy rozbieżności',
 'Apple HealthKit + Google Health Connect (SDK w systemie, 0 zł) pokrywają iPhone, '
 'Apple Watch i cały Android. Profile Bluetooth SIG GATT (Heart Rate, Weight Scale, '
 'Glucose, Blood Pressure) są publiczne i bezpłatne — to jest darmowa alternatywa '
 'dla agregatora w około 70% przypadków',
 'Przy 3 000 zł/mies rachunku albo 5 000 aktywnych userów — wtedy własne adaptery GATT '
 'zwracają się w 4–6 miesięcy pracy jednego programisty',
 ('TAK', 'Cztery warianty na rynku plus własny — bez adaptera każda zmiana dostawcy '
  'to przepisanie modułu'),
 'W', 'P0', 'CTO'),

'A2': ('OCR i digitalizacja dokumentacji',
 'Zamienić papierowy albo pedeefowy wynik badania w dane, które da się porównać w czasie '
 'i przeszukać.',
 'Polski wynik laboratoryjny nie ma standardu. Ta sama morfologia z trzech laboratoriów '
 'ma trzy układy, trzy zestawy nazw i trzy sposoby zapisu jednostek.',
 'Pacjent z historią badań; przychodnia digitalizująca archiwum.',
 'Zdjęcie, skan, PDF, plik z portalu laboratorium',
 'Struktura: badanie, wartość, jednostka, zakres referencyjny, data, wykonawca — '
 'zmapowana na LOINC',
 'BRAK kandydata na cały moduł. Google Document AI, AWS Textract i Azure Document '
 'Intelligence pokrywają silnik rozpoznawania, ale żaden nie rozumie polskiego wyniku '
 'laboratoryjnego',
 60, kontrola(5, 1, 1, 1),
 'Polish Medical Context Parser — dopasowanie rozmyte nazw badań, jednostek i zakresów. '
 'To jest moat językowy i regulacyjny, wskazany w korpusie jako niezbywalny',
 'Tesseract + DocTR (Apache 2.0) i PaddleOCR jako silnik — wymagają dostrojenia '
 'na polskich wynikach, ale są bezpłatne. Zamiana silnika płatnego na open source '
 'nie dotyka parsera',
 'Parser od dnia pierwszego — nigdy nie kupujemy. Silnik: przy 2 000 zł/mies albo '
 'w chwili wejścia funkcji do dossier wyrobu',
 ('TAK', 'Silnik wymienny, parser stały — adapter jest granicą między nimi'),
 'W>M', 'P0', 'CTO'),

'A3': ('Dashboard, alerty i Bio-Weather',
 'Pokazać stan zdrowia jednym ekranem i zwrócić uwagę na to, co się zmienia.',
 'Dane bez układu nie są informacją. Użytkownik, który dostaje sto liczb, nie dostaje nic.',
 'Użytkownik codzienny — to jest ekran, na którym spędza 90% czasu w aplikacji.',
 'Znormalizowane serie z A1, wyniki z A2, dane środowiskowe z IMGW i GIOŚ',
 'Kafelki z trendem, korelacje pogoda–samopoczucie, alerty',
 'BRAK kandydata na cały moduł — to jest produkt, a nie komponent. Wykresy da się kupić '
 '(Highcharts), układu i wyboru metryk nie',
 20, kontrola(5, 1, 1, 1),
 'Cały moduł. Wybór metryk, progi, język komunikatu i decyzja, co jest alertem',
 'Recharts, D3.js, Chart.js, Apache ECharts (MIT/Apache) — pełne pokrycie warstwy '
 'wykresów bez opłat. IMGW i GIOŚ dają dane środowiskowe za darmo',
 'Zawsze własne — moduł nie ma sensu kupiony',
 ('NIE', 'Komponent jest produktem; nie ma dostawcy, od którego trzeba się izolować'),
 'M>W', 'P0', 'Product'),

'A4': ('Raporty i eksport',
 'Wyprowadzić dane w formie, którą przyjmie lekarz, druga aplikacja albo sąd.',
 'Dane zamknięte w aplikacji są warte tyle, co dane w szufladzie. Przenośność jest '
 'wymogiem RODO, nie funkcją premium.',
 'Pacjent idący do lekarza; lekarz przyjmujący pacjenta z zewnątrz.',
 'Zakres dat, wybór parametrów, cel raportu',
 'PDF (raport SBAR), pakiet FHIR, CSV',
 'CZĘŚCIOWY: Medplum i HAPI FHIR dają eksport FHIR w standardzie. Układ raportu '
 'i dobór treści zostaje nasz',
 55, kontrola(5, 1, 1, 1),
 'Szablon SBAR, dobór parametrów do raportu, język. Raport z naszym logo jest naszym '
 'oświadczeniem — to nie jest wydruk',
 'WeasyPrint (BSD) i Puppeteer (Apache 2.0) generują PDF bez opłat. HAPI FHIR '
 'i Medplum (Apache 2.0) obsługują eksport w standardzie',
 'Od razu własne — koszt jest zerowy',
 ('NIE', 'Biblioteki PDF są wymienne bez adaptera; interfejs jest trywialny'),
 'W', 'P0', 'Product'),

'A5': ('Telemedycyna i zdalna opieka',
 'Połączyć użytkownika z lekarzem bez wychodzenia z aplikacji i z pełnym kontekstem '
 'jego danych.',
 'Teleporada bez danych pacjenta jest rozmową telefoniczną z nieznajomym. Wartością '
 'nie jest wideo, tylko kontekst.',
 'Pacjent potrzebujący konsultacji; lekarz przyjmujący zdalnie.',
 'Wniosek o konsultację, kontekst z A1–A4, kalendarz lekarza',
 'Konsultacja, notatka, e-recepta, e-skierowanie, wpis do historii',
 'TAK — Docplanner/ZnanyLekarz, Telemedico, Doctor.One. Pokrywają całą ścieżkę: '
 'podaż lekarzy, umawianie, wideo, rozliczenie. Dostępne w modelu white-label',
 90, kontrola(3, 0.5, 1, 0),
 'Kontekst pacjenta wnoszony do konsultacji i notatka wracająca do historii. '
 'Bez tego jesteśmy tylko kanałem sprzedaży cudzej usługi',
 'Jitsi Meet, LiveKit (Apache 2.0) i mediasoup dają samo wideo za darmo — ale wideo '
 'to najmniejsza część modułu. Podaży lekarzy open source nie ma',
 'NIGDY w całości — świadczenie teleporady wymaga statusu podmiotu leczniczego '
 '(RPWDL). Własne wideo tak, własna usługa medyczna nie przed 2029',
 ('TAK', 'Partner wymienny; kontekst i notatka muszą przeżyć zmianę partnera'),
 'W>M', 'P1', 'Product'),

'A6': ('AI, RAG i asystent',
 'Odpowiadać na pytania o własne dane i o wiedzę medyczną, w języku, który użytkownik '
 'rozumie, i bez zmyślania.',
 'Model językowy bez własnego korpusu zmyśla. Model z korpusem, ale bez danych '
 'użytkownika, odpowiada ogólnikami.',
 'Użytkownik pytający „co znaczy mój wynik"; lekarz szukający wytycznej.',
 'Pytanie w języku naturalnym, kontekst z danych użytkownika, korpus wiedzy',
 'Odpowiedź z przypisami do źródeł, z oznaczeniem treści generowanej',
 'CZĘŚCIOWY: Infermedica (polska, klasa IIb pod MDR) pokrywa triage i wstępną ocenę. '
 'Ada Health, Mediktor, K Health — podobnie. Żaden nie pokrywa RAG na naszym korpusie '
 'ani odpowiedzi na dane użytkownika',
 50, kontrola(3, 1, 1, 0),
 'Korpus wiedzy, zabezpieczenia przed halucynacją, przypisy do źródeł, decyzja '
 'o tym, czego asystent NIE mówi',
 'Llama, Mistral i BioMistral self-hosted jako model; pgvector, Qdrant i Weaviate '
 '(Apache 2.0) jako baza wektorowa; PubMed, ChPL i URPL jako publiczny korpus. '
 'Cały stos RAG jest dostępny bez opłat licencyjnych',
 'Model: przy 2 500 zł/mies self-host tanieje. Korpus i zabezpieczenia: zawsze własne',
 ('TAK', 'Abstrakcja providera od dnia pierwszego — jeden interfejs, trzy backendy'),
 'M>W', 'P0', 'CTO'),

'A7': ('Planowanie i rekomendacje',
 'Zamienić dane w konkretną sugestię działania — co zjeść, kiedy się ruszyć, '
 'co uzupełnić.',
 'Użytkownik nie potrzebuje wykresu, tylko odpowiedzi na pytanie „co mam zrobić dzisiaj".',
 'Użytkownik prowadzący zdrowie aktywnie; segment fitness.',
 'Cele użytkownika, dane z A1, baza żywności i ćwiczeń',
 'Plan dnia, lista zakupów, przypomnienie o suplemencie',
 'CZĘŚCIOWY: Nutritionix i Edamam dają bazę żywności z API. Silnik reguł i logika '
 'planu zostają nasze — nikt nie sprzedaje planu, który zna kontekst medyczny użytkownika',
 40, kontrola(5, 1, 1, 1),
 'Silnik reguł, progi, logika łączenia celów użytkownika z danymi. To jest miejsce, '
 'w którym rekomendacja może stać się poradą medyczną — granica jest tutaj',
 'USDA FoodData Central (public domain) zamiast Nutritionix za 499 USD/mies; '
 'MediaPipe (Apache 2.0) do analizy ruchu; Drools i json-rules-engine jako silnik',
 'Silnik reguł od razu własny. Baza żywności: USDA od dnia pierwszego, własna baza '
 'polska budowana przez użytkowników',
 ('TAK', 'Bazy żywności są wymienne; silnik reguł nie wychodzi nigdy'),
 'W>M', 'P1', 'Product'),

'A8': ('Zdrowie psychiczne',
 'Dać codzienne narzędzie do prowadzenia nastroju i bezpieczną drogę do człowieka, '
 'kiedy narzędzie przestaje wystarczać.',
 'Obszar najwyższej szkody w całym produkcie. Błąd w module fitness kosztuje trening; '
 'błąd tutaj kosztuje życie.',
 'Użytkownik prowadzący dziennik nastroju; pracownik korporacji w programie '
 'świadczeń; osoba w kryzysie.',
 'Wpis nastroju, kwestionariusz, tekst rozmowy',
 'Trend nastroju, sugestia kontaktu z terapeutą, przekierowanie kryzysowe',
 'TAK dla warstwy terapeutycznej — twojpsycholog.ai, Wellbee, Mindgram, HearMe '
 'dają sieć terapeutów i proces umawiania. NIE dla detektora kryzysu',
 80, kontrola(3, 0.5, 1, 0),
 'Dziennik nastroju, dane użytkownika i DETEKTOR KRYZYSU z przekierowaniem na 116 123. '
 'Detektor nigdy nie jest po stronie partnera — jest funkcją rdzenia i musi działać '
 'także wtedy, gdy partner jest niedostępny',
 'Protokoły CBT są publiczne. Kwestionariusze PHQ-9 i GAD-7 są dostępne bezpłatnie '
 'do użytku klinicznego. Wykonania klinicznego open source nie ma i nie powinno być',
 'Ocena przejęcia albo budowy własnej po 12 miesiącach wspólnego ruchu i przy 2 000 '
 'aktywnych użytkowników modułu miesięcznie',
 ('TAK', 'Partner terapeutyczny wymienny; detektor kryzysu poza adapterem, w rdzeniu'),
 'M>W', 'P1', 'Product'),

'A9': ('Społeczność i gamifikacja',
 'Utrzymać użytkownika przy produkcie między pomiarami.',
 'Aplikacja zdrowotna otwierana raz na dwa tygodnie nie zbiera danych, a bez danych '
 'nie ma z czego budować niczego innego.',
 'Użytkownik szukający motywacji i osób z podobnym problemem.',
 'Wpis, wyzwanie, odznaka, komentarz',
 'Wątek, ranking, odznaka',
 'TAK — Discourse (GPL-2.0), Circle.so, NodeBB pokrywają moduł niemal w całości',
 95, kontrola(3, 1, 0.5, 1),
 'Moderacja i decyzja, co wolno napisać o leczeniu. Discourse daje mechanikę, '
 'nie daje odpowiedzialności',
 'Discourse (GPL-2.0), Flarum i NodeBB — pełne pokrycie bez opłat licencyjnych. '
 'Self-host oznacza, że dane zostają u nas',
 'Nigdy — budowa własnego forum nie ma uzasadnienia',
 ('NIE', 'Jedno wdrożenie self-host; migracja jest jednorazowa, nie ciągła'),
 'W', 'P2', 'Community'),

'A10': ('Marketplace',
 'Zamienić rekomendację w transakcję i wziąć z niej prowizję.',
 'Aplikacja darmowa musi zarabiać gdzie indziej. Marketplace jest jedynym kanałem, '
 'który działa od pierwszego miesiąca bez negocjacji i bez certyfikacji.',
 'Użytkownik, któremu aplikacja coś doradziła; partner sprzedający produkt.',
 'Rekomendacja z A7, katalog partnerów',
 'Zamówienie u partnera, prowizja, potwierdzenie',
 'TAK — Circlewise, MyLead i sieci CPS pokrywają rozliczenie i katalog. '
 'Dietly przez Circlewise jest dostępny bez negocjacji',
 85, kontrola(3, 1, 1, 1),
 'Decyzja, co jest rekomendowane i ujawnienie konfliktu interesu przy każdej '
 'rekomendacji — nie w regulaminie, tylko na ekranie',
 'Sieci afiliacyjne nie mają odpowiednika open source. Rozliczenie prowizji '
 'na podstawie zdarzeń z bramy jest własne i trywialne',
 'Własny marketplace w Forge dopiero przy powtarzalnym wolumenie',
 ('TAK', 'Sieci afiliacyjne wymienne; katalog i rekomendacja zostają'),
 'W', 'P1', 'Growth'),

'A11': ('Geolokalizacja i tłumaczenie',
 'Znaleźć najbliższy punkt poboru i zrozumieć wynik wystawiony w obcym języku.',
 'Warunek ekspansji poza Polskę i warunek obsługi pacjenta w podróży.',
 'Użytkownik szukający laboratorium; pacjent za granicą.',
 'Lokalizacja, dokument w obcym języku',
 'Mapa punktów, przetłumaczony wynik z zachowaniem jednostek',
 'TAK — OpenStreetMap z Nominatim pokrywa mapy, DeepL i modele językowe pokrywają '
 'tłumaczenie',
 90, kontrola(3, 1, 1, 0.5),
 'Baza punktów poboru z godzinami i cenami — to jest dane, których OSM nie ma',
 'OpenStreetMap + Nominatim + Leaflet — pełne pokrycie map bez opłat i bez ryzyka '
 'zmiany cennika, które Google ma udokumentowane',
 'Baza punktów od razu własna; mapy i tłumaczenie nigdy',
 ('TAK', 'Google Maps ma historię podwyżek — adapter jest tu ubezpieczeniem'),
 'W', 'P2', 'Product'),

'A12': ('Nagrywanie i dokumentacja wizyty',
 'Zdjąć z lekarza pisanie w trakcie wizyty i oddać mu gotową notatkę.',
 'Lekarz spędza jedną trzecią wizyty na klawiaturze. To jest czas odebrany pacjentowi '
 'i najłatwiejszy do odzyskania.',
 'Lekarz w gabinecie; przychodnia kupująca licencję.',
 'Nagranie rozmowy za zgodą obu stron',
 'Notatka w strukturze SOAP, propozycja kodów ICD-10, wpis do dokumentacji',
 'TAK na rynku amerykańskim — Nuance DAX, Suki, Abridge pokrywają moduł w całości. '
 'W Polsce brak odpowiednika ze słownikiem medycznym polskim',
 85, kontrola(3, 0.5, 1, 0),
 'Polski słownik medyczny i korekta post-transkrypcyjna. To ta sama kompetencja, '
 'co parser z A2 — i ten sam moat',
 'Whisper (MIT) i faster-whisper dają transkrypcję bez opłat; jakość na polskim '
 'materiale medycznym wymaga własnego słownika niezależnie od wyboru silnika',
 'Silnik: przy 2 400–3 000 godzin nagrań miesięcznie self-host tanieje. '
 'Słownik: od dnia pierwszego własny',
 ('TAK', 'Silnik transkrypcji wymienny; słownik i korekta stałe'),
 'W>M', 'P1', 'CTO'),

'A13': ('Eternal Pet',
 'Objąć zwierzę tym samym systemem monitoringu co człowieka — i sprawdzić na nim '
 'technologię, zanim trafi do ludzi.',
 'Ścieżka weterynaryjna nie ma ściany MDR. To najtańszy sposób zwalidowania czujników '
 'i firmware przed wejściem w reżim wyrobu medycznego.',
 'Właściciel zwierzęcia; lecznica weterynaryjna.',
 'Dane z obroży, waga, aktywność, wizyty',
 'Profil zdrowia zwierzęcia, przypomnienia, rekomendacja weterynarza',
 'BRAK kandydata na cały moduł. Rynek obroży (Tractive, Whistle) daje sprzęt, '
 'nie daje ekosystemu',
 30, kontrola(5, 1, 1, 1),
 'Cały moduł — to jest poligon dla firmware i czujników, więc jego wartość polega '
 'na tym, że jest nasz',
 'ESP-IDF (Apache 2.0) i Zephyr RTOS jako firmware; profile Bluetooth SIG publiczne',
 'Od razu własne — to jest sens tego modułu',
 ('NIE', 'Sprzęt własny, brak dostawcy do izolowania'),
 'W', 'P2', 'Hardware'),

'A14': ('Powiadomienia i eskalacja',
 'Dotrzeć do użytkownika, a gdy trzeba — do jego opiekuna albo do pomocy.',
 'Alert, który nie dotarł, nie istnieje. Eskalacja bez drugiego kanału jest '
 'pojedynczym punktem awarii w funkcji bezpieczeństwa.',
 'Każdy użytkownik; opiekun osoby starszej.',
 'Zdarzenie z A3, A8 albo A22',
 'Push, e-mail, SMS eskalacyjny, połączenie z numerem alarmowym',
 'TAK — Firebase Cloud Messaging, SendGrid i Twilio pokrywają moduł w całości',
 95, kontrola(2, 1, 1, 1),
 'Logika eskalacji: kiedy, do kogo, po ilu minutach braku reakcji. Dostawca dostarcza '
 'kanał, nie decyzję',
 'Firebase Cloud Messaging jest bezpłatny do dużej skali; ntfy i Gotify pozwalają '
 'na własny serwer push tam, gdzie nie chcemy pośrednika',
 'Nigdy — własny serwer push nie ma sensu, sklepy i tak pośredniczą',
 ('TAK', 'Kanały wymienne; treść powiadomienia nie może zawierać danych zdrowotnych '
  'niezależnie od dostawcy — ekran blokady jest publiczny'),
 'W', 'P0', 'CTO'),

'A15': ('Fundacja i Hub Innowatora',
 'Przyjmować pomysły i IP z zewnątrz na warunkach, które nie oddają kontroli.',
 'Bez regulaminu naboru wniesione IP należy do tego, kto je wniósł. To nie jest '
 'formalność, tylko struktura właścicielska.',
 'Innowator zgłaszający rozwiązanie; Fundacja.',
 'Zgłoszenie, dokumentacja rozwiązania',
 'Umowa licencyjna, wpis do rejestru IP, decyzja o finansowaniu',
 'CZĘŚCIOWY: Notion i Airtable pokrywają obsługę naboru. Regulamin i umowy '
 'to praca prawnika, nie oprogramowania',
 60, kontrola(5, 1, 0.5, 1),
 'Regulamin naboru i wzory umów licencyjnych — one przesądzają, czyje jest IP',
 'Narzędzia do zarządzania naborem mają odpowiedniki open source (NocoDB, Baserow), '
 'ale to nie jest miejsce oszczędzania',
 'Własne procesy od razu; narzędzie dopiero przy skali',
 ('NIE', 'To proces, nie integracja'),
 'W', 'P2', 'Fundacja'),

'A16': ('Eternal Forge',
 'Sprzedawać komponenty i API zbudowane na potrzeby ekosystemu tym, którzy budują '
 'coś innego.',
 'Każdy komponent zbudowany raz dla siebie może być sprzedany wielokrotnie. '
 'To jest różnica między kosztem a aktywem.',
 'Zewnętrzny deweloper; partner branżowy.',
 'Komponent z rejestru, dokumentacja, wersja',
 'Licencja, klucz do API, rozliczenie',
 'BRAK kandydata — to jest produkt własny z definicji',
 10, kontrola(5, 1, 1, 1),
 'Cały moduł',
 'Espacenet i GitHub API (bezpłatne) do katalogowania IP; rejestr własny',
 'Zawsze własne',
 ('NIE', 'Produkt własny'),
 'W', 'P2', 'Product'),

'A17': ('Kalendarz, skanery i doradcy kontekstowi',
 'Prowadzić zdrowie w czasie: co kiedy zrobić, co właśnie zjadłem, jak się czuję.',
 'Zdrowie jest procesem, a większość aplikacji pokazuje zdjęcie. Kalendarz jest '
 'fundamentem prowadzenia, nie dodatkiem.',
 'Użytkownik prowadzący zdrowie aktywnie.',
 'Zdjęcie posiłku, wpis do kalendarza, głos, dane z A1',
 'Wpis kaloryczny, przypomnienie, ocena stanu',
 'CZĘŚCIOWY: Passio.ai, LogMeal i Foodvisor pokrywają rozpoznawanie posiłków. '
 'Kalendarz zdrowotny nie ma dostawcy',
 40, kontrola(2, 1, 1, 0.5),
 'Kalendarz i logika łączenia zdarzeń w czasie. Rozpoznawanie posiłku ma trafność '
 'rzędu 30–40% i nie wolno deklarować dokładności',
 'YOLO i CLIP jako modele wizyjne, Open Food Facts jako baza — z zastrzeżeniem, '
 'że ODbL wymaga udostępnienia bazy pochodnej, więc dane trzymać osobno',
 'Przy 2 000 zł/mies za SDK. Własnego modelu rozpoznawania nie budować — '
 'to nie jest miejsce na R&D',
 ('TAK', 'SDK rozpoznawania wymienne'),
 'W>M', 'P1', 'Product'),

'A18': ('Przejrzystość, zgody i nadzór nad wyrobem',
 'Pokazać użytkownikowi, kto miał dostęp do jego danych, i pozwolić mu to odwołać.',
 'To jest jednocześnie wymóg prawny i najmocniejszy wyróżnik produktowy, jaki ma '
 'ten produkt. Konkurencja tego nie pokazuje, bo nie potrafi.',
 'Każdy użytkownik; organ nadzorczy przy kontroli.',
 'Zdarzenie dostępu, zgoda, żądanie usunięcia',
 'Dziennik widoczny dla użytkownika, potwierdzenie usunięcia, wycofanie zgody',
 'CZĘŚCIOWY: OneTrust i Usercentrics pokrywają zarządzanie zgodami. Dziennik dostępu '
 'w profilu IHE ATNA i deklaracja przeznaczenia zostają nasze',
 50, kontrola(5, 1, 1, 1),
 'Rejestr zgód i dziennik audytowy — to jest dowód wobec organu i nie może być '
 'u dostawcy',
 'Keycloak (Apache 2.0) do tożsamości; profil IHE ATNA jest otwartym standardem, '
 'nie produktem',
 'Zawsze własne',
 ('NIE', 'To jest warstwa zgodności — nie ma czego izolować, bo nie ma dostawcy'),
 'W', 'P0', 'Compliance'),

'A19': ('Zgodność AI i bezpieczeństwo farmakoterapii',
 'Nie zaszkodzić lekiem i nie ukryć, że odpowiedź pochodzi od modelu.',
 'Interakcja lek–suplement jest realnym ryzykiem, a Smart Dispenser czyni je '
 'automatycznym. Oznaczanie treści generowanej to obowiązek od 2 sierpnia 2026.',
 'Pacjent przyjmujący więcej niż jeden preparat; lekarz weryfikujący.',
 'Lista leków i suplementów, genotyp (docelowo)',
 'Ostrzeżenie o interakcji, oznaczenie treści generowanej, karta modelu',
 'CZĘŚCIOWY: bazy interakcji lekowych (Lexicomp, Medi-Span) są licencjonowane '
 'i pokrywają rdzeń. KS-BLOZ pokrywa polski rynek leków',
 70, kontrola(3, 1, 1, 0),
 'Reguły łączenia bazy interakcji z konkretnym pacjentem i decyzja, co pokazujemy, '
 'a co kierujemy do lekarza',
 'RxNorm i DrugBank (wersja akademicka) są dostępne bezpłatnie, ale pokrycie polskiego '
 'rynku leków wymaga KS-BLOZ (~10 000 zł/rok) — tu open source nie zastępuje',
 'Baza nigdy — to licencja. Reguły zawsze własne',
 ('TAK', 'Baza interakcji wymienna, reguły stałe'),
 'M', 'P1', 'Compliance'),

'A20': ('Leki, alergie i grupy szczególne',
 'Wiedzieć, co pacjent przyjmuje i czego nie wolno mu podać.',
 'Rejestr leków jest fundamentem farmakoterapii i warunkiem sensu modułu A19. '
 'Bez niego ostrzeżenie o interakcji nie ma na czym stanąć.',
 'Pacjent przewlekle chory; senior; rodzic dziecka.',
 'Recepta z OCR, wpis ręczny, dane z P1',
 'Rejestr leków z dawkowaniem, lista alergii, siatki centylowe',
 'CZĘŚCIOWY: KS-BLOZ daje bazę leków, P1 daje e-receptę. Rejestr pacjenta '
 'i logika zostają nasze',
 60, kontrola(3, 1, 1, 1),
 'Rejestr i model danych. P1 jest źródłem, nie właścicielem rejestru',
 'RxNorm (bezpłatny, rynek amerykański) nie pokrywa polskich nazw handlowych — '
 'KS-BLOZ jest tu bez alternatywy open source',
 'Rejestr od razu własny; baza leków nigdy',
 ('TAK', 'Źródło bazy wymienne przy ekspansji zagranicznej'),
 'W>M', 'P1', 'Product'),

'A21': ('Wywiad rodzinny, zdrowie kobiet, rehabilitacja',
 'Objąć obszary, które w produktach ogólnozdrowotnych są pomijane, a mają '
 'najwyższą gotowość do płacenia.',
 'Wywiad rodzinny jest najsilniejszym predyktorem przy koszcie zebrania bliskim zeru. '
 'Zdrowie kobiet jest segmentem o najwyższej gotowości do płacenia i najsłabszej obsłudze.',
 'Kobieta w okresie okołomenopauzalnym; osoba w rehabilitacji; pracodawca kupujący '
 'świadczenie.',
 'Kwestionariusz rodzinny, cykl, plan ćwiczeń',
 'Profil ryzyka rodzinnego, kalendarz cyklu, plan rehabilitacji z kontrolą wykonania',
 'CZĘŚCIOWY: Clue i Flo pokrywają cykl (~30% modułu). Wywiadu rodzinnego '
 'i rehabilitacji nikt nie pokrywa w integrowalnej formie',
 30, kontrola(5, 1, 1, 1),
 'Prawie cały moduł — to jest obszar, w którym nie ma czego kupić',
 'MediaPipe (Apache 2.0) do kontroli wykonania ćwiczeń. UWAGA: OpenPose ma licencję '
 'niekomercyjną, a wger jest na AGPL-3.0 — obu nie używać',
 'Od razu własne',
 ('TAK', 'Analiza ruchu wymienna'),
 'W>M', 'P1', 'Product'),

'A22': ('Ból, sprawność i bezpieczeństwo seniora',
 'Obsłużyć najczęstszy powód wizyty u lekarza i najczęstszą przyczynę '
 'hospitalizacji osoby starszej.',
 'Ból jest najczęstszym powodem wizyty i nie ma dla niego narzędzia. Upadek '
 'jest najczęstszą przyczyną hospitalizacji seniora i wykrywalny czujnikiem.',
 'Senior; opiekun; osoba z bólem przewlekłym.',
 'Skala bólu, mapa ciała, akcelerometr, brak aktywności',
 'Historia bólu, alert o upadku, powiadomienie opiekuna',
 'CZĘŚCIOWY: Vayyar i Essence pokrywają wykrywanie upadku sprzętowo (~40%). '
 'Mapy bólu i oceny sprawności nikt nie pokrywa',
 40, kontrola(3, 1, 1, 0.5),
 'Mapa i skale bólu, logika eskalacji, panel opiekuna',
 'Detekcja upadku z akcelerometru telefonu jest wykonalna własnymi siłami '
 'i bezpłatna; czujnik radarowy daje wyższą czułość, ale jest wyrobem',
 'Detekcja z telefonu od razu własna; czujnik radarowy dopiero przy segmencie '
 'senioralnym B2B',
 ('TAK', 'Czujnik wymienny'),
 'M>W', 'P1', 'Product'),

'A23': ('Dostępność i wykluczenie cyfrowe',
 'Nie wykluczyć osób, które najbardziej potrzebują tego produktu.',
 'Europejski akt o dostępności obowiązuje od czerwca 2025. To wymóg prawny, '
 'a nie kwestia dobrej woli — i dotyczy produktów konsumenckich.',
 'Osoba niedowidząca; senior; osoba bez smartfona.',
 'Ten sam interfejs, inne kanały wejścia',
 'Tryb prostego języka, wysoki kontrast, obsługa czytnikiem ekranu, kanał niecyfrowy',
 'BRAK kandydata — dostępności nie da się kupić, można ją tylko zbudować',
 5, kontrola(5, 1, 1, 1),
 'Cały moduł',
 'Standardy WCAG 2.2 i normy EN 301 549 są publiczne. Narzędzia audytu (axe-core, '
 'Pa11y) są open source',
 'Zawsze własne',
 ('NIE', 'Praca własna wg normy'),
 'W', 'P1', 'Product'),

'A24': ('Dostęp współdzielony i konta rodzinne',
 'Pozwolić rodzinie i lekarzowi wejść do danych na jasnych zasadach i na czas '
 'określony.',
 'Konto rodzinne jest warunkiem sprzedaży pracodawcy, a dostęp czasowy dla lekarza '
 'jest prostszy niż pełna integracja z gabinetem.',
 'Rodzic; opiekun; lekarz z jednorazowym dostępem; pracodawca.',
 'Zaproszenie, zakres, czas',
 'Token dostępu z zakresem i terminem, wpis do dziennika, wygaszenie',
 'CZĘŚCIOWY: Keycloak i Auth0 pokrywają tożsamość i uprawnienia (~60%). '
 'Logika kont rodzinnych i wygaszenie w osiemnaste urodziny są nasze',
 60, kontrola(5, 1, 1, 1),
 'Model uprawnień, wygaszanie i dziennik. To jest ta sama warstwa co A18',
 'Keycloak (Apache 2.0) i Ory pokrywają tożsamość w pełni, bez opłat i self-host',
 'Od razu Keycloak self-host; własna warstwa uprawnień na nim',
 ('TAK', 'Dostawca tożsamości wymienny, model uprawnień stały'),
 'W', 'P1', 'CTO'),
}

# --- moduly poza aplikacja (Station, Capsule, Twin, Matrix) ---------------
M.update({
'S1': ('Diagnostyka podstawowa (Station)',
 'Zmierzyć w domu to, po co dziś trzeba jechać do przychodni.',
 'Pomiar punktowy w gabinecie nie pokazuje przebiegu. Ciągłość jest wartością, '
 'której gabinet nie daje.',
 'Użytkownik ze Station; osoba przewlekle chora.',
 'Odczyt z czujnika przez BLE/MQTT', 'Pomiar w Eternal Standard, trend',
 'CZĘŚCIOWY: moduły OEM z Shenzhen dają sprzęt, nie dają firmware ani dossier',
 50, kontrola(5, 1, 1, 1),
 'Firmware i dossier — bez dostępu do kodu nie ma certyfikacji',
 'ESP-IDF (Apache 2.0), Zephyr RTOS, profile Bluetooth SIG GATT — pełne pokrycie '
 'warstwy firmware bez opłat licencyjnych',
 'Firmware zawsze własne. Sprzęt: moduł OEM, nigdy własna produkcja przed popytem',
 ('TAK', 'Moduł OEM wymienny, firmware nie'),
 'M>W', 'P1', 'Hardware'),
'S2': ('Diagnostyka biochemiczna (Station)',
 'Zbadać krew bez wyjścia z domu.', 'Najdroższy i najbardziej regulowany element Station.',
 'Pacjent przewlekle chory.', 'Próbka', 'Wynik biochemiczny',
 'TAK — certyfikacja cudzych urządzeń albo proxy do sieci laboratoryjnej. '
 'Korpus rekomenduje ten wariant jako najtańszy i najszybszy',
 70, kontrola(3, 1, 1, 0),
 'Prezentacja wyniku w kontekście historii — nigdy sam wynik',
 'Brak — mikrofluidyka nie ma odpowiednika open source',
 'Nigdy własne przed udowodnionym popytem — CAPEX 800 tys. – 2,5 mln zł',
 ('TAK', 'Wykonawca badania wymienny'), 'M', 'P2', 'Hardware'),
'S3': ('System dozowania (Station)',
 'Podać właściwy preparat o właściwej porze.', 'Nieprzyjmowanie leków zgodnie z zaleceniem '
 'jest jedną z głównych przyczyn nieskuteczności terapii.',
 'Senior; pacjent przewlekle chory.', 'Plan dawkowania', 'Wydanie dawki, potwierdzenie',
 'CZĘŚCIOWY: dozowniki na rynku istnieją, integracji z ekosystemem nie mają',
 40, kontrola(5, 1, 1, 1), 'Auto-Refill i logika dawkowania — to jest moat',
 'ESP-IDF do firmware', 'Od razu własne — to jest wyróżnik Station',
 ('NIE', 'Sprzęt własny'), 'M', 'P2', 'Hardware'),
'S4': ('Telemedycyna i łączność (Station)',
 'Połączyć ze stacji z lekarzem.', 'Ta sama funkcja co A5, inny punkt wejścia.',
 'Użytkownik Station.', 'Wniosek ze stacji', 'Konsultacja',
 'TAK — ten sam partner co A5', 90, kontrola(3, 0.5, 1, 0),
 'Kontekst pomiaru ze stacji', 'Jitsi, LiveKit', 'Nigdy w całości — patrz A5',
 ('TAK', 'Wspólny adapter z A5'), 'W>M', 'P2', 'Product'),
'S5': ('Środowisko i bezpieczeństwo (Station)',
 'Mierzyć warunki w domu i reagować na zagrożenie.', 'Jakość powietrza w domu wpływa '
 'na zdrowie bardziej niż większość interwencji, a nikt jej nie mierzy.',
 'Użytkownik Station.', 'Czujniki środowiskowe', 'Alert, korelacja z samopoczuciem',
 'CZĘŚCIOWY: czujniki jakości powietrza są towarem', 60, kontrola(5, 1, 1, 1),
 'Korelacja ze stanem zdrowia — Bio-Weather Intelligence',
 'IMGW i GIOŚ za darmo dla danych zewnętrznych', 'Czujnik kupny, korelacja własna',
 ('TAK', 'Czujnik wymienny'), 'W', 'P2', 'Hardware'),
'S6': ('Dozowanie zaawansowane i pomiary bezdotykowe (Station)',
 'Rozszerzyć stację o pomiary, które dziś wymagają gabinetu.',
 'Etap docelowy Station — bezdotykowe EKG i nieinwazyjna glukoza.',
 'Pacjent przewlekle chory.', 'Pomiar bezdotykowy', 'Wynik',
 'BRAK — to jest R&D, nie zakup', 20, kontrola(5, 1, 1, 1),
 'Wszystko', 'Brak', 'Zawsze własne, ale dopiero po S1–S3',
 ('NIE', 'R&D własne'), 'M', 'P2', 'Hardware'),
'C1': ('Bio-Tag (Capsule)', 'Trwale zidentyfikować pacjenta i jego implanty.',
 'Identyfikacja pacjenta nieprzytomnego jest problemem ratownictwa.',
 'Pacjent z implantem; ratownik.', 'Odczyt NFC/RFID', 'Identyfikator, rejestr implantów',
 'CZĘŚCIOWY: znaczniki RFID są towarem, wszczepialne wymagają dossier',
 40, kontrola(4, 1, 1, 1), 'Rejestr implantów i protokół odczytu',
 'Brak dla części wszczepialnej', 'Zacząć od Pet Bio-Tag — brak ściany MDR',
 ('TAK', 'Producent znacznika wymienny'), 'M', 'P2', 'Hardware'),
'C2': ('Bio-Monitor (Capsule)', 'Mierzyć od wewnątrz to, czego nie da się zmierzyć z zewnątrz.',
 'Ciągły pomiar wewnątrzustrojowy jest jedyną drogą do części parametrów.',
 'Pacjent przewlekle chory.', 'Sygnał z implantu', 'Ciągła seria pomiarowa',
 'TAK jako platforma: Capsule najpierw jest PLATFORMĄ agregującą CGM, wearables '
 'i biosensory przez bramę, a dopiero potem fizycznym implantem',
 60, kontrola(3, 1, 1, 0.5),
 'Platforma i model osobisty — sensor może być cudzy',
 'Brak dla sensora; warstwa agregacji jak w A1',
 'Sensor od partnera; platforma własna od dnia pierwszego',
 ('TAK', 'Sensor wymienny — to jest sedno podejścia platformowego'),
 'M', 'P2', 'Hardware'),
'C3': ('The Hive (Capsule)', 'Skoordynować wiele implantów jednego pacjenta.',
 'Etap docelowy — wymaga wcześniejszego C2.', 'Pacjent z wieloma implantami.',
 'Sygnały z implantów', 'Skoordynowany obraz', 'BRAK', 15, kontrola(5, 1, 1, 1),
 'Wszystko — protokół Hive jest moatem', 'Brak', 'Po C2',
 ('NIE', 'R&D własne'), 'M', 'P2', 'Hardware'),
'C4': ('The Swarm (Capsule)', 'Działać precyzyjnie w tkance bez otwierania ciała.',
 'Cel, nie technologia. Korpus formułuje to wprost: „chcemy nanoboty" nie jest celem.',
 'Pacjent onkologiczny (horyzont odległy).', 'Zlecenie', 'Działanie miejscowe',
 'BRAK', 5, kontrola(5, 1, 1, 1), 'Wszystko', 'Brak',
 'Horyzont odległy — obserwacja, nie budżet', ('NIE', 'R&D'), 'M', 'P2', 'R&D'),
'C5': ('Terapia i monitoring wewnątrzustrojowy (Capsule)',
 'Zamknąć pętlę: pomiar, decyzja, podanie.', 'Najwyższa klasa ryzyka w całym ekosystemie.',
 'Pacjent z cukrzycą (autonomiczne dozowanie insuliny).', 'Pomiar ciągły',
 'Dawka', 'CZĘŚCIOWY: pompy insulinowe z pętlą zamkniętą istnieją i mają CE',
 50, kontrola(3, 1, 1, 0), 'Model osobisty — nie pompa',
 'Projekty open source pętli zamkniętej istnieją, ale nie są wyrobem i nie wolno '
 'ich użyć komercyjnie w tej roli',
 'Nigdy własna pompa — proxy do producenta z CE',
 ('TAK', 'Producent pompy wymienny'), 'M', 'P2', 'R&D'),
'D1': ('EDM — elektroniczna dokumentacja', 'Trzymać dokumentację w standardzie, '
 'który przyjmie każdy system.', 'Interoperacyjność jest wymogiem od 2029, nie opcją.',
 'Pacjent; przychodnia.', 'Dokumenty z A2, A12, P1', 'Zasoby FHIR, CDA',
 'TAK — Medplum, HAPI FHIR, Aidbox pokrywają serwer dokumentacji w całości',
 80, kontrola(5, 1, 1, 1), 'Mapper — serwer wymienialny, mapper nie',
 'HAPI FHIR i Medplum (Apache 2.0), LinuxForHealth FHIR — pełne pokrycie serwera '
 'bez opłat; Aidbox kosztuje od 1 000 USD/mies za to samo',
 'Medplum self-host od dnia pierwszego; mapper zawsze własny',
 ('TAK', 'Serwer FHIR wymienny'), 'W', 'P0', 'CTO'),
'D2': ('Predykcyjny Bliźniak', 'Pokazać, co się stanie, jeśli nic się nie zmieni.',
 'To jest funkcja, dla której warto certyfikować — i jedyna, która uzasadnia '
 'wycenę wyższą niż aplikacja do agregacji.',
 'Pacjent; lekarz; płatnik.', 'Pełna historia z A1–A4', 'Prognoza z przedziałem ufności',
 'BRAK kandydata — to jest moat', 15, kontrola(5, 1, 1, 1),
 'Wszystko', 'Biblioteki modelowania są open source, model nie',
 'Zawsze własne', ('NIE', 'Moat własny'), 'M', 'P1', 'CTO'),
'D3': ('Eternal Legacy', 'Przekazać dane po śmierci na warunkach ustalonych za życia.',
 'Nikt tego nie robi, a pytanie zadaje sobie każdy, kto choruje przewlekle.',
 'Pacjent; spadkobierca.', 'Dyspozycja', 'Dostęp dla wskazanej osoby',
 'BRAK', 20, kontrola(5, 1, 1, 1), 'Wszystko — to jest kwestia prawna, nie techniczna',
 'Keycloak do tożsamości', 'Zawsze własne', ('NIE', 'Warstwa własna'), 'W', 'P2', 'Legal'),
'D4': ('Symulacja, ciało 3D, dziedziczenie cyfrowe',
 'Pokazać ciało i skutki decyzji w formie, którą widać.',
 'Wykres nie przekonuje; obraz ciała przekonuje.', 'Pacjent.',
 'Dane z D2', 'Model 3D z naniesionymi danymi',
 'CZĘŚCIOWY: silniki 3D są dostępne, model ciała trzeba złożyć',
 40, kontrola(5, 1, 1, 1), 'Model ciała i mapowanie danych',
 'Three.js (MIT), Babylon.js (Apache 2.0), model-viewer — pełne pokrycie bez opłat. '
 'UWAGA: Unity ma najgorszy profil ryzyka licencyjnego w projekcie',
 'Three.js od razu; nie wchodzić w Unity',
 ('TAK', 'Silnik 3D wymienny'), 'W>M', 'P2', 'Product'),
'D5': ('Twin populacyjny i benchmarki',
 'Sprzedać wiedzę z danych bez sprzedania danych.',
 'Kohorty zanonimizowane i dane syntetyczne odblokowują demo inwestorskie '
 'i sprzedaż płatnikom bez ruszania danych osobowych.',
 'Płatnik; placówka; badacz.', 'Zagregowane dane', 'Kohorta, benchmark',
 'CZĘŚCIOWY: narzędzia do danych syntetycznych istnieją',
 40, kontrola(5, 1, 1, 1), 'Metodyka anonimizacji — od niej zależy legalność całości',
 'Synthea (Apache 2.0) do danych syntetycznych, SDV do generowania kohort',
 'Od razu własne', ('NIE', 'Warstwa własna'), 'W', 'P1', 'Data'),
'X1': ('Społeczność Matrix', 'Rozszerzyć społeczność poza aplikację.',
 'Powiela A9 — korpus wskazuje to jako duplikację w efekcie.',
 'Użytkownik zaawansowany.', 'Wpis', 'Wątek',
 'TAK — jak A9', 95, kontrola(3, 1, 0.5, 1), 'Moderacja',
 'Discourse', 'Nigdy', ('NIE', 'Wspólne z A9'), 'W', 'P2', 'Community'),
'X2': ('Immersja cyfrowa', 'Pokazać dane w przestrzeni.',
 'Etap docelowy.', 'Użytkownik premium.', 'Dane', 'Scena VR',
 'CZĘŚCIOWY: silniki VR dostępne', 50, kontrola(5, 1, 1, 1), 'Treść',
 'Three.js, Babylon.js, WebXR', 'Po D4', ('TAK', 'Silnik wymienny'), 'W', 'P2', 'Product'),
'X3': ('Światy zdrowotne VR/AR', 'Zbudować przestrzeń, w której zdrowie jest doświadczeniem.',
 'Horyzont odległy, w większości oznaczony w korpusie jako fikcja.',
 'Użytkownik premium.', 'Dane', 'Świat VR',
 'CZĘŚCIOWY', 50, kontrola(5, 1, 1, 1), 'Treść', 'WebXR, Three.js',
 'Po X2', ('TAK', 'Silnik wymienny'), 'W', 'P2', 'Product'),
})

# --- stos technologiczny (wspolny szkielet + roznice per modul) ------------
STOS_WSPOLNY = [
 ('Frontend', 'Flutter (iOS, Android) + PWA na tym samym kodzie; Web dla panelu B2B'),
 ('Backend', 'Python FastAPI, warstwa adapterów per klasa komponentu, orkiestrator '
  'jednoagentowy'),
 ('Database', 'PostgreSQL 16 z pgvector (jedna baza zamiast dwóch), MinIO/S3 na pliki, '
  'rezydencja UE — Hetzner Falkenstein + backup Gravelines'),
 ('Authentication', 'Keycloak (OIDC) self-host; Węzeł Krajowy przy integracji z P1; '
  'RBAC + ABAC na zakresach zgód'),
 ('FHIR', 'Medplum self-host (Apache 2.0) jako serwer, własny mapper LOINC/ICD-10 '
  '↔ nazwy polskie; profil krajowy przy P1'),
 ('Data model', 'Eternal Standard — własny model nadrzędny wobec FHIR, z polami '
  'zarezerwowanymi i wersjonowaniem semantycznym'),
 ('Encryption', 'TLS 1.3 w tranzycie, AES-256 at-rest, klucze w HashiCorp Vault '
  'po naszej stronie — nigdy u dostawcy'),
 ('Logging', 'Dziennik audytowy w profilu IHE ATNA (kto, co, kiedy, na jakiej podstawie), '
  'widoczny dla użytkownika; logi techniczne w OpenTelemetry'),
 ('Error handling', 'Tryb degradacji: brak dostawcy nie wyłącza funkcji, tylko obniża '
  'ją do wariantu zapasowego; komunikat mówi użytkownikowi, co przestało działać'),
 ('Caching', 'Redis na sesje i wyniki wywołań idempotentnych; danych zdrowotnych '
  'nie cachujemy poza sesją'),
 ('Queues', 'RabbitMQ — retencja komunikatu w godzinach, kolejka martwych listów, '
  'idempotencja po kluczu zdarzenia'),
 ('Testing', 'pytest z pokryciem ścieżek zgód; test regresyjny parsera na 200 realnych '
  'wynikach przed każdą zmianą silnika; kontrakt adaptera testowany osobno od dostawcy'),
 ('Deployment', 'Docker + Kubernetes, GitHub Actions → ArgoCD, wdrożenia niebiesko-zielone'),
 ('Monitoring', 'OpenTelemetry + Grafana; osobny licznik reguły 33% per klasa komponentu '
  '— bez niego reguła nie jest egzekwowalna'),
]

STOS_ROZNICE = {
 'A1': [('API zewnętrzne', 'HealthKit, Health Connect, Bluetooth SIG GATT; Terra/Rook/'
         'Junction/Vitalera przez adapter K01'),
        ('API endpoints', 'POST /v1/sync/{provider}, GET /v1/observations, '
         'POST /v1/devices/bind, GET /v1/provenance/{id}')],
 'A2': [('API zewnętrzne', 'Google Document AI (procesor formularzowy) przez adapter K04'),
        ('API endpoints', 'POST /v1/documents, GET /v1/documents/{id}/parsed, '
         'POST /v1/documents/{id}/correct')],
 'A5': [('API zewnętrzne', 'Partner telemedyczny przez adapter K08; Jitsi self-host'),
        ('API endpoints', 'POST /v1/consultations, GET /v1/consultations/{id}/context, '
         'POST /v1/consultations/{id}/note')],
 'A6': [('API zewnętrzne', 'Gemini Flash / GPT-4o-mini / Llama self-host przez jeden '
         'interfejs K05; Infermedica przez adapter K28 dla triage'),
        ('API endpoints', 'POST /v1/assistant/ask, GET /v1/assistant/sources/{id}, '
         'POST /v1/triage')],
 'D1': [('API zewnętrzne', 'P1 przez adapter K20 po uzyskaniu wpisu RPWDL'),
        ('API endpoints', 'GET /v1/fhir/Patient/{id}/$everything, POST /v1/fhir/Bundle')],
}

# --- odpowiedzi na pytania strategiczne -----------------------------------
ODPOWIEDZI = [
 ('Czy możemy zagregować wszystko?',
  'NIE — i to nie jest kwestia ambicji, tylko trzech granic.',
  'Trzy rzeczy nie dają się zagregować. **Model danych** — zagregowanie go oznacza brak '
  'produktu, bo to on decyduje, co znaczy „ten sam parametr" z dwóch źródeł. '
  '**Warstwa zgód i dziennik audytowy** — administratorem danych jesteśmy my i nie da się '
  'tego zlecić; dostawca może być procesorem, nigdy administratorem. **Wniosek kliniczny** — '
  'w chwili, gdy pokazujemy cudzą ocenę jako własną, jesteśmy producentem wyrobu. '
  'Wszystko poza tymi trzema można zagregować i większość należy zagregować.',
  'Z 24 modułów aplikacji **11 ma kandydata na całość przy pokryciu 80% i wyższym**. '
  'Obejmują one około 40% funkcji — i są to dokładnie te funkcje, które nie są moatem. '
  'Moduły bez kandydata (A2 parser polski, A3 dashboard, A16 Forge, A21, A23, D2 Bliźniak) '
  'to jednocześnie te, w których leży cała wartość własna. To nie przypadek: '
  'jeśli coś da się kupić, konkurencja też to kupi.'),
 ('Czy można zintegrować całe narzędzie z nami?',
  'TAK, w trzech modelach — ale każdy przenosi inną odpowiedzialność.',
  '**OEM/API (szczebel 2)** — wołamy cudze API, użytkownik widzi nazwę dostawcy. '
  'Odpowiedzialność za wynik po stronie dostawcy. Kontrola 25–45%. '
  '**Partnerstwo osadzone (szczebel 3)** — wspólna oferta, obie marki widoczne. '
  'Kontrola 55–70%. **Marka własna (szczebel 4)** — cudzy produkt pod naszą nazwą. '
  'Kontrola 75–85%, ale **stajemy się producentem** ze wszystkimi obowiązkami MDR.',
  'Korpus zawiera korektę, która jest tu najważniejsza: o Infermedice zapisano najpierw '
  '„ma CE", a potem poprawiono na **„klasa IIb pod MDR — odpowiedzialność za certyfikację '
  'produktu końcowego po stronie integratora"**. To jest reguła ogólna, nie wyjątek: '
  'zintegrowanie cudzego wyrobu z CE NIE przenosi na nas jego certyfikatu. Certyfikat '
  'dotyczy jego wyrobu; nasz produkt końcowy jest osobnym wyrobem i wymaga własnej oceny, '
  'jeśli zawiera własne przeznaczenie medyczne.'),
 ('Czy dzielimy na trzy źródła? Czy to odpowiedzialne?',
  'TAK w klasach, gdzie jest co dzielić. NIE wszędzie — i korpus mówi wprost, gdzie nie.',
  'Reguła 33% obowiązuje tam, gdzie rynek daje trzech niezależnych dostawców i gdzie '
  'przerwa w dostawie boli. **Nie obowiązuje** przy P1 i Centrum e-Zdrowia, przy jednostce '
  'notyfikowanej, w reżimie MDR i u producentów pasków — tam odpowiedzią na monopol jest '
  'stanie się niezbędnym, nie redundancja. Trzy dossier zamiast jednego to potrojony koszt '
  'certyfikacji bez żadnej korzyści.',
  'Cena reguły jest realna i nazwana w korpusie: utrata rabatu wolumenowego, potrojony '
  'nakład integracyjny, trzy warianty w dossier, trzy umowy powierzenia. '
  '**Odpowiedzialne jest stosowanie jej tam, gdzie awaria dostawcy zatrzymuje produkt, '
  'i odpuszczenie jej tam, gdzie nie zatrzymuje.** Z 30 klas komponentów reguła ma sens '
  'w kilkunastu. W pozostałych wystarczy jeden dostawca plus zapisany plan wyjścia.'),
 ('Kiedy robimy swoje? Opłacalność.',
  'Gdy koszt utrzymania własnego spada poniżej rachunku od dostawcy — i ani miesiąca wcześniej.',
  'Progi są zapisane w kartach klas i wyrażone liczbą, nie wrażeniem: **K01 3 000 zł/mies '
  'albo 5 000 aktywnych userów; K04 2 000 zł/mies; K05 2 500 zł/mies; K07 2 400–3 000 godzin '
  'nagrań; K17 800 zł/mies; K25 2 000 zł/mies.** Poniżej progu własne rozwiązanie jest '
  'droższe, tylko koszt jest ukryty w wynagrodzeniach.',
  'Od tej reguły są **trzy wyjątki, w których budujemy własne od dnia pierwszego niezależnie '
  'od kosztu**: model danych i mapper, warstwa zgód i dziennika, oraz to, co jest moatem '
  '(parser polski, silnik reguł, korpus wiedzy, firmware). Powód nie jest kosztowy — '
  'te elementy nie są wymienne, więc próg wyjścia dla nich nie istnieje.'),
 ('Czy każde musi mieć adaptery?',
  'NIE. Adapter kosztuje i trzeba go uzasadnić.',
  'Adapter jest potrzebny, gdy spełniony jest przynajmniej jeden z trzech warunków: '
  '**istnieje więcej niż jeden wariant** dostawcy, **zapisany jest próg wyjścia** '
  'albo **dane przechodzą przez granicę zgodności** (wellness → medyczne). '
  'Nie jest potrzebny, gdy dostawcy nie ma (moduł własny), gdy dostawca jest monopolistą '
  '(P1) albo gdy komponent jest jednorazowym wdrożeniem, a nie ciągłą zależnością '
  '(forum self-host).',
  'W rejestrze modułów **adapter jest wymagany w 27 z 43 modułów**. Pozostałe 16 to '
  'moduły własne, procesy organizacyjne i wdrożenia jednorazowe. Ta liczba jest wynikiem '
  'reguły, nie preferencji — każdy przypadek ma podane uzasadnienie.'),
 ('Czy istnieje jeden producent pokrywający moduły A1–A10?',
  'NIE. I to jest dobra wiadomość.',
  'Rynek dzieli się na dostawców warstwy danych (Vitalera, Terra, Rook — pokrywają A1), '
  'dostawców usługi medycznej (Docplanner, Telemedico — pokrywają A5), dostawców triage '
  '(Infermedica, Ada — część A6) i dostawców infrastruktury (Medplum, Aidbox — D1). '
  '**Żaden nie pokrywa więcej niż jednego z tych obszarów**, bo każdy wymaga innej '
  'kompetencji i innego reżimu regulacyjnego.',
  'Gdyby taki dostawca istniał, byłby konkurentem, a nie komponentem — a integracja '
  'z nim oznaczałaby oddanie mu relacji z użytkownikiem. **Rozproszenie rynku jest '
  'warunkiem istnienia orkiestratora.** Wartość Eternal polega właśnie na tym, że spina '
  'cztery rozłączne rynki, z których żaden nie spina pozostałych.'),
]
