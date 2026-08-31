# -*- coding: utf-8 -*-
"""Moduly architektury i moduly kontrolne — dzialanie, budowa, monetyzacja.

Czternascie modulow kontrolnych K1-K14 pochodzi z Master 5.4 §4.3 wraz z ocena
stanu ("Czesciowo" / "NIE ISTNIEJE"). Reszta opisu jest autorska.
"""

# (kod, nazwa, jedno zdanie, dzialanie, przeznaczenie, z czego budowac,
#  kto, kiedy, kiedy wlasne, kontrola, co widzi uzytkownik, osobny produkt,
#  monetyzacja, stan wg Master 5.4)
MODULY = [
 ('ADAPTER', 'Adapter klasy komponentu',
  'Adapter tłumaczy. Jeden na klasę komponentu, nie jeden na dostawcę.',
  'Przyjmuje wywołanie w języku Eternal Standard, zamienia je na wywołanie konkretnego '
  'dostawcy, odbiera odpowiedź i zamienia ją z powrotem. Rdzeń nie wie, czy po drugiej '
  'stronie jest Terra, Vitalera czy własny sterownik GATT — widzi zawsze ten sam kontrakt.',
  'Izolacja. Wymiana dostawcy ma być wymianą jednego pliku, nie przepisaniem funkcji. '
  'Bez adaptera plan wyjścia zapisany w karcie klasy jest deklaracją.',
  'Zwykły kod aplikacji — interfejs plus implementacja per dostawca. Testy kontraktu '
  'osobno od testów dostawcy: kontrakt musi przechodzić na atrapie.',
  'Zespół backendu; jedna osoba na adapter',
  'Przed pierwszą integracją w klasie, nigdy po',
  'Zawsze własny — adapter z definicji nie może pochodzić od dostawcy, którego izoluje',
  '100% — to jest kod, który czyni resztę wymienialną',
  'Nic. Adapter jest niewidoczny i to jest jego cecha, nie brak.',
  'NIE sam w sobie, ale zestaw adapterów jest produktem w Forge (kanał K9)',
  'Pośrednia: adapter nie zarabia, ale bez niego próg wyjścia z klasy jest nieosiągalny, '
  'więc każda oszczędność na dostawcy jest niewykonalna',
  'Nie występuje jako osobny byt w specyfikacji'),

 ('GATEWAY', 'Eternal API Gateway',
  'Gateway wywołuje i przypisuje. To druga funkcja jest tą, której nikt nie ma.',
  'Cztery czynności: PRZYPISANIE użytkownika do dostawcy w każdej klasie przy rejestracji '
  '(trwałe, bo historia pomiarów z dwóch urządzeń o różnej kalibracji nie jest '
  'porównywalna), WYWOŁANIE wyłącznie przez adapter, POMIAR kosztu per użytkownik '
  'per dostawca, ODEBRANIE — przeniesienie użytkownika bez zmiany w kodzie.',
  'Egzekwowanie reguły 33% i policzalność marży jednostkowej. Bez przypisania '
  '„udział dostawcy" oznacza udział w ruchu, a nie w bazie użytkowników — '
  'i reguły nie da się wyegzekwować.',
  'Warstwa routingu nad adapterami: tablica przypisań (user_id → klasa → dostawca), '
  'licznik udziałów, polityka wyboru z czterema filtrami, dziennik przepięć. '
  'Kong albo Traefik jako brama HTTP, logika przypisania własna.',
  'Zespół backendu, właściciel architektury',
  'Razem z drugim wariantem w pierwszej klasie — przy jednym dostawcy gateway '
  'nie ma czego wybierać',
  'Zawsze własny — to jest instrument kontroli, nie infrastruktura',
  '100%',
  'Nic w wersji podstawowej. W wersji zaawansowanej — nazwę dostawcy przy źródle danych, '
  'jeśli zapadnie decyzja 12 na „tak"',
  'NIE, ale jest warunkiem wejścia dla partnerów Forge („prawo wstępu — Eternal '
  'Kompatybilny plus klucz do Gateway")',
  'Pośrednia i bezpośrednia: pomiar per użytkownik jest jedyną drogą do policzenia LTV '
  'w modelu darmowym; klucz do Gateway jest przedmiotem licencji w kanale K9',
  'Występuje jako „prawo wstępu", bez opisu mechanizmu'),

 ('MAPPER', 'Mapper semantyczny',
  'Mapper mapuje znaczenia, nie pola. To jest różnica między nim a konwerterem formatu.',
  'Sprowadza „hemoglobina", „HGB", „Hb" i „hemoglobin" do jednego pojęcia z kodem LOINC. '
  'Rozpoznaje jednostki i przelicza. Rozpoznaje zakresy referencyjne różnych laboratoriów. '
  'Wersjonowany semantycznie: zmiana mapowania jest zmianą znaczenia danych historycznych.',
  'Bez mappera dane z dwóch źródeł leżą obok siebie, a nie razem. To on decyduje, '
  'czy „ten sam parametr" z Terra i z laboratorium to rzeczywiście ten sam parametr.',
  'Słowniki LOINC, ICD-10, SNOMED CT (dostępne z EPP bezpłatnie) plus własny słownik '
  'synonimów polskich plus dopasowanie rozmyte. Reguła: pola zarezerwowane, '
  'jedna osoba z prawem weta na zmiany.',
  'Zespół danych plus lekarz konsultant — mapowania nie da się zrobić bez kompetencji '
  'klinicznej',
  'Od dnia pierwszego, przed pierwszym importem',
  'ZAWSZE własny, bez progu wyjścia. Serwer FHIR jest wymienialny, mapper nie — '
  'to jest zdanie z korpusu i jest słuszne',
  '100% — to jest moat',
  'Nic bezpośrednio. Pośrednio widzi to, że wynik z trzech laboratoriów układa się '
  'w jeden wykres — czego konkurencja nie pokazuje',
  'TAK — mapper polski jest sprzedawalny osobno przez Forge, a dla wchodzących '
  'na rynek PL jest barierą wejścia, której nie obejdą',
  'Bezpośrednia: licencja na mapper i słownik (K9), sprzedaż do dostawców '
  'oprogramowania gabinetowego (K7)',
  'K3 Mapper — stan: „Brak mostu do CDA"'),

 ('SYNC', 'Universal Sync (silnik normalizacji)',
  'Universal Sync jest tym, co spina alternatywne ścieżki w jeden spójny produkt.',
  'Odbiera znormalizowane dane od adapterów, rozstrzyga konflikty (dwa źródła podają '
  'inne tętno o tej samej godzinie), deduplikuje, wykrywa anomalie, zapisuje '
  'z proweniencją: które źródło, kiedy, jaką ścieżką.',
  'Integruje dane z obu torów diagnostycznych — Station i laboratoriów partnerskich — '
  'w jedną historię. Korpus wskazuje go jako komponent bez alternatywy.',
  'Silnik reguł (Drools albo własny) plus polityka proweniencji plus rejestr '
  'rozbieżności. Rozbieżność jest sygnałem do pokazania, nie błędem do ukrycia.',
  'Zespół danych',
  'Razem z drugim źródłem danych — przy jednym źródle nie ma czego synchronizować',
  'ZAWSZE własny — wskazany w korpusie jako niezbywalny rdzeń',
  '100%',
  'Statusy synchronizacji i informację o rozbieżności między urządzeniami — '
  'to jest funkcja zaufania, nie techniczna',
  'TAK — w Forge jako komponent dla innych integratorów',
  'Pośrednia (retencja) i bezpośrednia (licencja w K9)',
  'K1 Universal Sync — stan: „Częściowo"'),
]

# --- czternascie modulow kontrolnych (Master 5.4 §4.3) --------------------
# (kod, nazwa, zakres, stan wg Master 5.4, kiedy budowac, kto widzi, monetyzacja)
KONTROLNE = [
 ('K1', 'Universal Sync', 'Adaptery i normalizacja', 'Częściowo',
  'MVP — bez tego nie ma produktu', 'Użytkownik — statusy synchronizacji',
  'Licencja w Forge'),
 ('K2', 'Model danych (Eternal Standard)', 'Blokuje wszystko pozostałe', 'Częściowo',
  'MVP, przed pierwszą integracją', 'Nikt — widoczny przez skutki',
  'Standard jest darmowy, wdrożenie płatne (K9)'),
 ('K3', 'Mapper', 'CDA ↔ FHIR ↔ EEHRxF', 'Brak mostu do CDA',
  'MVP dla FHIR, most do CDA przed integracją z P1',
  'Nikt bezpośrednio', 'Licencja i wdrożenia (K7, K9)'),
 ('K4', 'Terminologia', 'Słowniki — dostępne z EPP za darmo', 'Częściowo',
  'MVP', 'Nikt', 'Brak — to koszt'),
 ('K5', 'Zgody i kontrola dostępu', 'Kontrola w kontekście leczenia', 'NIE ISTNIEJE',
  'MVP — wymóg prawny, nie funkcja', 'Użytkownik — panel zgód, wyróżnik produktowy',
  'Brak bezpośredniej; warunek sprzedaży B2B'),
 ('K6', 'Dziennik audytowy', 'Kto, co, kiedy, na jakiej podstawie', 'NIE ISTNIEJE',
  'MVP — dowód wobec organu', 'Użytkownik — log dostępu, silny wyróżnik',
  'Warunek sprzedaży B2B i dossier'),
 ('K7', 'Rejestr', 'Implanty, urządzenia, wyniki podłużne', 'NIE ISTNIEJE',
  'MLP', 'Użytkownik i lekarz', 'Element oferty B2B (K7)'),
 ('K8', 'Reguły', 'Silnik decyzyjny', 'Ukryty w orkiestratorze',
  'MVP — wydzielić z orkiestratora', 'Nikt; skutki widoczne w alertach',
  'Rdzeń CDSS po certyfikacji (K7, K11)'),
 ('K9', 'Brama P1 i EPP', 'Jedyne wejście do danych publicznych', 'Brak',
  '2029–2030, po wpisie RPWDL', 'Użytkownik — dane z IKP w aplikacji',
  'Warunek wielu kanałów, sam nie zarabia'),
 ('K10', 'Zgodność i jakość', 'SOUP, macierz śledzenia, ryzyko, cykl życia',
  'NIE ISTNIEJE', 'Przed dossier, czyli 2028', 'Nikt', 'Warunek certyfikacji'),
 ('K11', 'Bezpieczeństwo', 'Model zagrożeń, składniki, incydenty, NIS2', 'NIE ISTNIEJE',
  'MVP w wersji podstawowej, pełny przed NIS2', 'Nikt', 'Warunek sprzedaży B2B'),
 ('K12', 'Obserwowalność', 'Utrzymanie plus materiał dowodowy', 'Częściowo',
  'MVP — licznik reguły 33% jest tutaj', 'Nikt', 'Brak — to koszt'),
 ('K13', 'Tożsamość', 'Węzeł Krajowy, uprawnienia, izolacja klinik', 'Do przebudowy',
  'MVP dla użytkownika, Węzeł Krajowy przy P1',
  'Użytkownik — logowanie i konta rodzinne', 'Warunek oferty dla pracodawców'),
 ('K14', 'Warstwa agentowa', 'Intencja → wykonanie, z ujawnieniem AI', 'Częściowo',
  'MLP', 'Użytkownik — asystent', 'Rdzeń oferty premium i B2B'),
]

# --- modularnosc: analiza ------------------------------------------------
MODULARNOSC = [
 ('Czy modularność aplikacji jest potrzebna nam',
  'TAK — i to jest jedyny sposób, żeby certyfikacja nie zjadła całego produktu.',
  'Bez modularności aplikacja jest jednym wyrobem. Jedna funkcja przesunięta do warstwy C '
  'przenosi w reżim MDR całość — wszystkie 337 funkcji, cały interfejs, cały cykl wydawniczy. '
  'Z modularnością certyfikacji podlega moduł, a nie aplikacja: dossier obejmuje '
  '**63 funkcje zamiast 337**, a reszta wychodzi w normalnym trybie wydawniczym.',
  'Koszt: dossier klasy IIa to 80–150 tys. zł. Bez modularności ta sama kwota kupuje '
  'certyfikat dla całości, ale wiąże cały cykl wydawniczy — każda zmiana w dowolnej '
  'funkcji przechodzi przez zarządzanie zmianą wyrobu. Z modularnością 274 funkcje '
  'zostają poza tym reżimem i można je wydawać co tydzień.'),
 ('Czy modularność jest dobra dla użytkownika',
  'TAK, ale nie z tego powodu, z którego zwykle się ją uzasadnia.',
  'Argument „użytkownik wybiera, za co płaci" nie działa w modelu darmowym — nie ma '
  'za co płacić. Działa inny: **użytkownik wybiera, co widzi i na co się zgadza.** '
  'Osoba z cukrzycą włącza moduł glukozy i nie ogląda modułu ciąży. Zgoda jest per moduł, '
  'nie per aplikacja — a to jest wymóg RODO, nie udogodnienie.',
  'Ryzyko: aplikacja modularna wymaga od użytkownika decyzji, a większość użytkowników '
  'decyzji nie chce. Rozwiązanie: **profile startowe** (fitness, lekarz, choroba przewlekła, '
  'senior, rodzic) włączające zestaw modułów jednym wyborem, z możliwością zmiany.'),
 ('Czy klient wybrałby ją kosztem konkurencji',
  'Sam z siebie nie. Wybierze coś, co modularność umożliwia.',
  'Nikt nie wybiera aplikacji dlatego, że jest modularna. Wybiera dlatego, że pokazuje '
  'wynik z trzech laboratoriów na jednym wykresie, że nie musi płacić, i że widzi, '
  'kto oglądał jego dane. **Modularność jest warunkiem tych trzech rzeczy, nie argumentem '
  'sprzedażowym.**',
  'W segmencie B2B jest inaczej: przychodnia kupuje moduł Scribe, a nie aplikację. '
  'Tam modularność jest warunkiem sprzedaży wprost — nikt nie kupi całego ekosystemu, '
  'żeby dostać transkrypcję wizyty.'),
 ('Czy zmniejsza koszty w długiej perspektywie',
  'TAK w certyfikacji i utrzymaniu, NIE w budowie.',
  'Budowa modularna kosztuje 20–40% więcej na starcie: interfejsy między modułami, '
  'osobne zarządzanie zgodami, osobne wersjonowanie. **Zwrot następuje przy pierwszej '
  'certyfikacji** — zawężenie dossier z 337 do 63 funkcji to nie jest oszczędność '
  'jednorazowa, tylko zdjęcie stałego obciążenia z 274 funkcji na cały cykl życia produktu.',
  'Drugi zwrot: sprzedaż modułu osobno (Scribe do przychodni, mapper do dostawcy '
  'oprogramowania gabinetowego) jest możliwa tylko wtedy, gdy moduł da się wyjąć.'),
 ('Czy Station też ma być modularna',
  'TAK, i tu argument jest silniejszy niż w aplikacji.',
  'Korpus opisuje Station jako modułową od początku (Mini Station → Station pełny → '
  'Care Pod). Powód regulacyjny: **moduł pomiarowy klasy IIa i moduł dozujący '
  'to dwa różne wyroby.** Zintegrowane w jedną obudowę stają się jednym wyrobem '
  'o wyższej klasie ryzyka.',
  'Powód ekonomiczny: Mini Station jest downsellem dla rynku masowego. Bez modularności '
  'nie ma downsellu — jest jeden produkt w jednej cenie.'),
 ('Czy modularność pomaga w agregacji',
  'To jest jej główna funkcja w tej architekturze.',
  'Moduł z jasną granicą można **zastąpić cudzym** bez ruszania reszty. To jest dokładnie '
  'to, o co chodzi w strategii integracji zamiast budowy: jeśli pojawi się dostawca '
  'lepszy od naszego modułu A17, wymieniamy moduł, a nie produkt.',
  'Warunek: granicą modułu musi być kontrakt danych, a nie ekran. Moduł zdefiniowany '
  'przez interfejs użytkownika nie jest wymienialny — jest tylko ładnie nazwany.'),
]

# --- strategia integracji zamiast budowy ---------------------------------
INTEGRACJA = [
 ('Założenie', 'Nie budujemy technologii, których nie stać nas zbudować — '
  'i to jest decyzja, nie ograniczenie.',
  'Nanotechnologia medyczna, interfejsy mózg-komputer i terapie zaawansowane to koszty '
  'liczone w miliardach i horyzonty liczone w dekadach. Konkurencją są koncerny. '
  'Wejście w wyścig na budowę oznacza przegraną przy założeniu, że wszystko pójdzie dobrze.'),
 ('Mechanizm kontroli bez budowy',
  'Kontroluje się przez standard, przez dane i przez dystrybucję — nie przez własność fabryki.',
  '**Standard**: kto definiuje format, ten definiuje, co da się podłączyć. Eternal Standard '
  'plus „prawo wstępu — Eternal Kompatybilny plus klucz do Gateway" to jest kontrola '
  'nad tym, co wchodzi do ekosystemu. **Dane**: historia pacjenta jest u nas, więc nowa '
  'technologia bez naszego kontekstu jest wartościowo pusta. **Dystrybucja**: dostawca '
  'z lepszą technologią i bez użytkowników potrzebuje nas bardziej niż my jego.'),
 ('Test przed każdą integracją',
  'Czy istnieje publiczna specyfikacja tego, co kupuję?',
  'TAK — mogę odejść, bo mogę to napisać sam; zamknięcie dostawcy nie jest groźne. '
  'NIE — jestem uwiązany; **wolno z tego zrobić funkcję, nigdy fundament**. '
  'W macierzy dostawców z korpusu 15 z 22 pozycji ma standard otwarty albo częściowo '
  'otwarty; 7 nie ma i te są wprost oznaczone jako „nie budować na tym rdzenia".'),
 ('Mapper integracji — co to znaczy w praktyce',
  'Rejestr zdolności, nie rejestr dostawców.',
  'Reguła z korpusu: *Eternal nie wiąże się z technologią, tylko ze zdolnością. '
  'Nie „Terra API", lecz „zdolność: dane z urządzeń".* Mapper integracji to katalog '
  'zdolności ekosystemu, w którym każda ma: definicję kontraktu danych, listę obecnych '
  'implementacji, wymagania zgodności i test akceptacyjny. **Nowy dostawca wchodzi przez '
  'przejście testu, a nie przez projekt integracyjny.** To jest różnica między '
  'integracją jako procesem a integracją jako produktem.'),
 ('Kolejność wejścia',
  'App → Capsule jako platforma → Station. Nie App → Station → Capsule.',
  'App daje bazę użytkowników i dane — bez nich nie ma czym kontrolować. '
  '**Capsule jako platforma** (agregacja CGM, wearables i biosensorów przez bramę) '
  'nie wymaga produkcji implantu i jest gotowa, zanim pojawi się sensor partnera. '
  'Station jest najdroższa i najłatwiej zastępowalna laboratoriami partnerskimi — '
  'idzie ostatnia albo w wariancie certyfikacji cudzych urządzeń.'),
 ('Czego ta strategia nie załatwia',
  'Nie daje przewagi tam, gdzie przewagą jest sama technologia.',
  'Jeśli wartość leży wyłącznie w sensorze, to właściciel sensora zbierze marżę, '
  'a integrator dostanie prowizję. Strategia działa, dopóki wartość leży w kontekście — '
  'w tym, że pomiar znaczy coś dopiero w zestawieniu z historią. **Gdy ktoś zbuduje sensor, '
  'który sam dostarcza kontekst, ta strategia przestaje działać** i trzeba to obserwować '
  'jako ryzyko, a nie zakładać, że nie nastąpi.'),
]

# --- hierarchia ekosystemu ------------------------------------------------
HIERARCHIA = [
 ('Ekosystem', '1', 'Eternal', 'Warstwa nadrzędna — wspólny standard, brama, dane, marka'),
 ('Projekty (filary)', '5', 'App, Station, Capsule, Digital Twin, Matrix',
  'Jednostki produktowe z własnym P&L; Hub i Forge są warstwą organizacyjną, '
  'nie produktową'),
 ('Produkty', '~12', 'App Lite, App Premium, Mini Station, Station, Care Pod, Bio-Tag, '
  'Bio-Monitor, Twin, Legacy, Forge, Hub, Pet', 'To, co ma cenę i klienta'),
 ('Podprodukty / pakiety wertykalne', '~8',
  'Zdrowa Ciąża, Pet, senior, fitness, choroba przewlekła, lekarz, pracodawca, ubezpieczyciel',
  'Ten sam produkt zapakowany dla niszy — różnią się zestawem modułów, nie kodem'),
 ('Moduły', '43', 'A1–A24, S1–S6, C1–C5, D1–D5, X1–X3',
  'Jednostka certyfikacji, sprzedaży B2B i wymiany na cudze rozwiązanie'),
 ('Funkcje', '337', 'A1.1 … X3.12', 'Jednostka planowania i wyceny'),
 ('Funkcjonalności', 'setki', 'Podfunkcje w kartach funkcji',
  'Poziom, na którym zapada decyzja wellness/medyczne'),
 ('Klasy komponentów', '30', 'K01–K30',
  'Jednostka zakupu, reguły 33% i progu wyjścia'),
 ('Składowe', '4', 'I. Środowisko, II. Zgodność, III. Architektura, IV. Dane',
  'Warstwy, które każda klasa funkcjonalna pociąga za sobą'),
 ('Alternatywy i odpowiedniki', '22 pozycje × 3',
  'Macierz dostawców: 3 opcje rynkowe, 3 z white label, wyjście',
  'Realizacja reguły 33% i planu wyjścia'),
]


# ==========================================================================
# UZUPELNIENIE PO AUDYCIE POKRYCIA ZRODEL
# Pierwsza wersja tego dokumentu powstala bez sieciu plikow sekcji SPECYFIKACJA,
# ktore nie zawieraja kodow funkcji i przez to wypadly z rejestru. Ponizsze
# pochodzi z plikow #117 (ETL-034 Eternal API Gateway), #119 (ETL-031 Model
# orkiestratora) i #118 (ETL-032 Wykonalnosc naukowa i kontrola technologii).
# ==========================================================================

# --- przebieg jednego zapytania przez brame (ETL-034, plik #117) ----------
PRZEBIEG = [
 ('1. Wejście', 'Moduł zgłasza potrzebę ZDOLNOŚCI plus kontekst: czyje dane, po co, '
  'w jakiej warstwie zgodności', 'Zapytanie bez kontekstu jest odrzucane'),
 ('2. Podstawa prawna', 'Sprawdzenie, kto pyta, o czyje dane i na jakiej podstawie: '
  'własne, zgoda, stosunek leczenia, opieka prawna, stan nagły',
  'Brak podstawy = wywołanie nie następuje'),
 ('3. Zakres', 'Czy żądany zakres mieści się w tym, na co jest zgoda',
  'Zakres szerszy niż zgoda jest PRZYCINANY, nie odrzucany'),
 ('4. Rozwiązanie zdolności', 'Lista dostawców obsługujących tę zdolność dla tego '
  'użytkownika', 'Pusta lista = tryb degradacji'),
 ('5. Filtr twardy', 'Odrzucenie kandydatów binarnie', 'Odrzucony nie wraca do punktacji'),
 ('6. Punktacja i wybór', 'Ranking pozostałych, wybór najlepszego',
  'Remis rozstrzyga polityka proweniencji'),
 ('7. Wywołanie', 'Z budżetem czasu, limitem i minimalnym zakresem danych',
  'Przekroczenie budżetu = przejście do kolejnego kandydata'),
 ('8. Kwarantanna odpowiedzi', 'Walidacja schematu, zakresu i sensowności wartości '
  'PRZED dopuszczeniem do systemu', 'Odpowiedź niezgodna nie wchodzi do zapisu'),
 ('9. Normalizacja', 'Adapter przekłada na format Eternal i dokłada proweniencję',
  'Brak proweniencji = wartość nie zostaje zapisana'),
 ('10. Dziennik', 'Kto, co, kiedy, na jakiej podstawie, od kogo, z jakim skutkiem',
  'Zapis jest nieusuwalny'),
 ('11. Zwrot', 'Jeden format, niezależnie od tego, kto odpowiedział', '—'),
]

FILTR_TWARDY = [
 ('Użytkownik nie ma konta ani urządzenia u tego dostawcy', 'Nie ma czego pobrać'),
 ('Dostawca nie przetwarza danych w regionie użytkownika',
  'Rezydencja danych zdrowotnych — warunek, nie preferencja'),
 ('Zgoda nie obejmuje tego rodzaju danych', 'Brak podstawy'),
 ('Klasa zgodności dostawcy nie wystarcza dla warstwy wywołania',
  'Dostawca dopuszczalny w warstwie opisowej nie musi być dopuszczalny w warstwie oceny'),
 ('Dostawca przekroczył próg jednej trzeciej w swojej klasie',
  'Nowe połączenia idą gdzie indziej'),
 ('Dostawca zgłasza awarię albo przekracza budżet czasu', 'Kaskada do kolejnego'),
 ('Licencja dostawcy nie pozwala na nasz model użycia', 'Rozstrzygnięte raz, na wejściu'),
]

PUNKTACJA = [
 ('Kompletność dla tej zdolności', '×3', 'Ile pól kontraktu danych wypełnia jedna odpowiedź'),
 ('Priorytet źródła', '×3', 'Laboratorium przed urządzeniem z oznakowaniem, to przed '
  'urządzeniem konsumenckim, to przed deklaracją'),
 ('Świeżość', '×2', 'Kiedy powstał pomiar, nie kiedy został pobrany'),
 ('Opóźnienie', '×2', 'Czas odpowiedzi przy tym profilu użycia'),
 ('Koszt wywołania', '×2', 'Przy modelu darmowym dla użytkownika to realne ograniczenie'),
 ('Preferencja użytkownika', '×1', 'Jeśli wskazał źródło, któremu ufa bardziej'),
 ('Efekt zwrotny', '×1', 'Czy odpowiedź wzbogaca rejestr'),
]

TRYBY = [
 ('Wybór', 'Jeden dostawca pokrywa całość', 'Wywołanie idzie do niego'),
 ('Kaskada', 'Główny ma luki albo padł',
  'Zapytanie idzie do kolejnego wg rankingu; użytkownik nie widzi różnicy'),
 ('Konsensus', 'Dwa źródła podają sprzeczne wartości',
  'Wygrywa wyższy priorytet źródła; przy remisie świeższy pomiar. Wartość odrzucona '
  'ZOSTAJE w zapisie z adnotacją, dlaczego przegrała'),
]

LOKALNE_GLOBALNE = [
 ('Dane z systemu publicznego', 'Wyłącznie kanał krajowy',
  'Tak — nie ma alternatywy i nie może być'),
 ('Dane z urządzenia użytkownika', 'Ten dostawca, u którego użytkownik ma konto',
  'Tak — nie ma wyboru'),
 ('Odczyt dokumentu', 'Krajowy, jeśli rozumie polskie nazewnictwo badań; '
  'globalny jako wariant zapasowy', 'Nie'),
 ('Terminologia i słowniki', 'Krajowa implementacja przed międzynarodową',
  'Tak dla dokumentacji medycznej'),
 ('Wiedza i wyszukiwanie', 'Najlepszy dostępny, niezależnie od kraju', 'Nie'),
 ('Model językowy', 'Ten, który przetwarza w regionie użytkownika',
  'Tak dla danych osobowych'),
 ('Płatności, powiadomienia', 'Dowolny spełniający wymogi', 'Nie'),
]

BRAMA_BEZPIECZENSTWO = [
 ('Jedyne wyjście na zewnątrz', 'Rozproszeniem punktów wycieku. Sto miejsc wysyłających '
  'dane jest nieaudytowalnych; jedno jest sprawdzalne w jeden dzień'),
 ('Poświadczenia dostawców w skarbcu, nigdy w kodzie modułu',
  'Wyciekiem klucza razem z kodem albo logiem'),
 ('Autoryzacja W KONTEKŚCIE, nie po roli', 'Lekarz nie ma dostępu do wszystkich pacjentów '
  '— ma dostęp do tych, z którymi łączy go stosunek leczenia. To jest różnica między '
  'systemem legalnym a nielegalnym'),
 ('Minimalizacja zakresu przy wywołaniu',
  'Wysyłaniem dostawcy więcej, niż potrzebuje do odpowiedzi'),
 ('Pseudonimizacja tam, gdzie tożsamość nie jest potrzebna',
  'Budowaniem profilu użytkownika po stronie dostawcy'),
 ('Limity na użytkownika, dostawcę i moduł', 'Masowym odpytaniem — najprostszą metodą '
  'wyprowadzenia bazy — oraz kosztem'),
 ('Kwarantanna odpowiedzi', 'Skażeniem danymi. ODPOWIEDŹ Z ZEWNĄTRZ JEST DANĄ, '
  'NIGDY INSTRUKCJĄ — treść przychodząca z zewnątrz nie może sterować zachowaniem systemu'),
 ('Wykrywanie anomalii', 'Nietypowy wolumen, pora, zakres — sygnał, że coś jest nie tak'),
 ('Wyłącznik', 'Cofnięcie klucza odcina dostawcę natychmiast, bez wdrożenia'),
 ('Nieusuwalny dziennik', 'Brakiem materiału dowodowego w audycie i przy incydencie'),
]

BRAMA_ZASTRZEZENIA = [
 ('Brama w ścieżce wyrobu JEST CZĘŚCIĄ WYROBU',
  'Jeśli przez bramę płyną dane funkcji będącej wyrobem medycznym, brama wchodzi '
  'do jego dokumentacji technicznej. Nie jest infrastrukturą obok wyrobu — jest w nim.',
  'ETL-034 #117 i ETL-031 #119'),
 ('Brama jest pojedynczym punktem awarii',
  'Cała architektura odporności opiera się na komponencie, który sam odporny nie jest. '
  'Brama wymaga własnej redundancji, zanim zacznie chronić przed cudzą awarią.',
  'ETL-034 #117'),
 ('Reguła kierowania MUSI BYĆ JAWNA',
  'Kierujemy użytkowników do dostawców według własnych reguł i jednocześnie pobieramy '
  'od tych dostawców opłaty. Ukryta reguła przy tej konstrukcji jest zarzutem, '
  'nie przewagą.', 'ETL-031 #119'),
 ('Cudzego oznakowania CE nie da się odziedziczyć',
  'Oznakowanie wyrobu obejmuje konkretną funkcję w aplikacji producenta i w jego '
  'przeznaczeniu. Dane surowe pobrane przez interfejs programistyczny nie są nim objęte. '
  'Wysoka ocena regulacyjna urządzenia podnosi wiarygodność pomiaru, ale nie zdejmuje '
  'z nas ani jednego obowiązku.', 'ETL-031 #119'),
]

# --- trzy poziomy dostepnosci zdolnosci = model sprzedazy (ETL-034 #117) --
POZIOMY_SPRZEDAZY = [
 ('1 — W katalogu', 'Adapter działa, dostawca w rejestrze, testy przechodzą',
  'Natychmiast', 'Nikt osobno', 'W abonamencie'),
 ('2 — W rejestrze Forge, bez adaptera', 'Dostawca znany i oceniony, adapter nie istnieje',
  'Dni do tygodni', 'Zamawiający', 'Opłata jednorazowa za uruchomienie'),
 ('3 — Poza rejestrem', 'Dostawca nieznany albo nieoceniony', 'Tygodnie do miesięcy',
  'Zamawiający', 'Wyższa — obejmuje rozpoznanie, ocenę, budowę adaptera i test kontrolny'),
]

REGULA_KATALOGU = (
 'ADAPTER ZBUDOWANY NA ZAMÓWIENIE WCHODZI DO KATALOGU I OBNIŻA CENĘ DLA NASTĘPNYCH.',
 'Klient płaci za BYCIE PIERWSZYM, nie za wyłączność. Drugi zamawiający tej samej '
 'zdolności płaci ułamek, dziesiąty nie płaci nic — bo pozycja jest już na poziomie '
 'pierwszym. To jest mechanizm, w którym katalog rośnie na cudzy koszt, a każdy kolejny '
 'klient dostaje więcej za tę samą cenę.',
 [('Standardowy', 'Adapter działa u niego i u wszystkich następnych', 'Podstawowa'),
  ('Wyłączność czasowa', 'Adapter nie wchodzi do katalogu przez ustalony okres',
   'Wielokrotność ceny podstawowej — bo blokuje efekt sieciowy'),
  ('Wyłączność trwała', 'NIE OFERUJEMY',
   'Trwale blokuje wartość, którą sprzedajemy wszystkim pozostałym')])

# --- aparat oceny technologii (ETL-032, plik #118) ------------------------
DOWOD = [
 ('D5 — potwierdzone w praktyce', 'Produkty na rynku, wytyczne kliniczne',
  'Budować, planować przychód'),
 ('D4 — potwierdzone u ludzi', 'Badania z udziałem ludzi, walidacja prospektywna',
  'Budować z rezerwą na walidację własną'),
 ('D3 — wykazane w laboratorium', 'Zwierzęta, warunki kontrolowane',
  'Finansować cudze badania. NIE planować produktu'),
 ('D2 — brak zaprzeczenia', 'Wiarygodne, nikt nie sprawdził',
  'Obserwować. ZERO budżetu na budowę'),
 ('D1 — brak ścieżki', 'Sprzeczne ze stanem wiedzy albo bez metody weryfikacji',
  'Nie występuje w dokumentacji operacyjnej'),
]

PRZEPISANIE = [
 ('Nanoboty terapeutyczne', 'Dostarczyć substancję do konkretnej tkanki, omijając resztę',
  'Koniugaty przeciwciało-lek, radioligandy celowane, nanocząstki lipidowe — '
  'wszystkie JUŻ stosowane klinicznie'),
 ('Roje wykonujące edycję genów in vivo', 'Zmienić funkcję komórki bez operacji',
  'Edycja genów poza organizmem jest zatwierdzona i stosowana; w organizmie — '
  'w badaniach z ludźmi'),
 ('Kopia świadomości', 'Zachować to, co po człowieku zostaje, w formie użytecznej '
  'dla bliskich', 'Archiwum narracyjne plus model językowy — z zastrzeżeniem, że to '
  'symulacja stylu, nie ciągłość osoby. Nazwanie tego inaczej byłoby sprzedażą iluzji '
  'ludziom w żałobie'),
 ('Wydłużenie życia do konkretnej liczby lat',
  'Wydłużyć lata w zdrowiu i opóźnić wielochorobowość',
  'Mierzalne markery, ciągły zapis, interwencje stylu życia — to jest dokładnie '
  'nasz obszar'),
 ('Implant mierzący wszystko', 'Mieć ciągły zapis zamiast przekrojów',
  'Urządzenia noszone plus dokumenty plus deklaracje — ciągłość bez wchodzenia w ciało'),
 ('Pełna immersja', 'Zwiększyć przestrzeganie zaleceń i zaangażowanie',
  'Przypomnienia, wspólnota, rozliczalność — tańsze i lepiej udowodnione'),
 ('Autonomiczna medycyna', 'Skrócić drogę od pomiaru do decyzji',
  'Triage z człowiekiem w pętli, dokumentacja automatyczna, teleopieka'),
]

WERDYKTY = [
 ('E1 Aplikacja i warstwa danych', 'D5', '9', 'Wykonalne dziś',
  'Żaden — to jest wykonanie, nie badanie'),
 ('E2 Station — pomiar podstawowy', 'D5', '7–8', 'Wykonalne jako zestaw',
  'Art. 22 MDR, komponenty z oznakowaniem, framing wellness'),
 ('E2 Station — biochemia domowa', 'D3 dla panelu pełnego', '4–6',
  'Warunkowo, jako wyrób profesjonalny', 'Reżim IVDR, nie MDR'),
 ('E2 Station — dozowanie na podstawie pomiaru', 'D4 w warunkach szpitalnych', '5',
  'POZA PLANEM', 'Klasa III'),
 ('E3 Capsule — transponder weterynaryjny', 'D5', '8–9', 'Wykonalne 2027–2028',
  'Przychód z linii Pet'),
 ('E3 Capsule — transponder u człowieka, wellness', 'D4', '6–7', 'Realnie 2030–2031',
  'Kompetencja produkcyjna z weterynarii'),
 ('E3 Capsule — implant klasy IIb', 'D4', '5–6', '2035–2037',
  'Partner z systemem jakości ORAZ finansowanie w milionach euro'),
 ('E3 Capsule — biosensor metaboliczny wszczepialny', 'D3', '4',
  'NIE własnymi siłami', 'Dekada i kapitał, którego nie mamy'),
 ('E3 Capsule — roje terapeutyczne', 'D2–D1', '1–2',
  'Poza dokumentacją operacyjną', '—'),
 ('E4 Digital Twin — wizualizacja', 'D5', '9', 'Wykonalne dziś',
  'Bez oceny klinicznej pozostaje poza reżimem wyrobu'),
 ('E4 Digital Twin — predykcja ryzyka', 'D3–D4', '4–5', 'Warunkowo',
  'Walidacja prospektywna. Bez niej model nie jest wyrobem, tylko wykresem'),
 ('E4 Digital Twin — model przyczynowy', 'D3', '4', 'Program badawczy',
  'Kohorta z ciągłością, nie z masą'),
 ('E5 Matrix — technologia', 'D5', '9', 'Technicznie gotowe',
  'Silniki i sprzęt działają od lat'),
 ('E5 Matrix — wartość kliniczna', 'D2', '3', 'REKOMENDACJA: NIE ROBIĆ',
  'Technologia dojrzała, cel niepotwierdzony. 33 funkcje zależności i jedyny komponent '
  'zamknięty w stosie'),
]

REGULA_KRZYWEJ = (
 'Rzeczy, które się deprecjonują, kupować później. Rzeczy, które się kumulują, '
 'zaczynać dziś.',
 'Deprecjonują się: krzem, modele, czujniki, moc obliczeniowa — każdy rok czekania '
 'obniża cenę. Kumulują się: zapis, zaufanie, pozycja w standardzie, dorobek — '
 'każdy rok czekania podnosi koszt nadrobienia. To jest cała odpowiedź na pytanie, '
 'co robić najpierw, i jest ważniejsza niż rachunek kosztów.')

PULAPKA_E5 = (
 'Wysoka gotowość technologiczna przy niskim dowodzie wartości.',
 'Sprzęt działa, silnik działa, wszystko da się zbudować — i nikt nie wykazał, '
 'że to komukolwiek pomaga. GOTOWOŚĆ TECHNOLOGII JEST NAJCZĘSTSZYM POWODEM, '
 'DLA KTÓREGO BUDUJE SIĘ RZECZY NIEPOTRZEBNE. Sprawdzanie stopnia dowodu ODDZIELNIE '
 'od gotowości chroni przed tym błędem.')

# --- indeks zrodel per sekcja --------------------------------------------
ZRODLA_SEKCJI = [
 ('0. Trzy zdania', 'Master 5.4 §7 (#126), ETL-034 Eternal API Gateway (#117)'),
 ('1. Moduł A1', 'Master 5.4 §11 (#126), Macierz Dostawców (#86), '
  'AGREGACJA DANYCH Z WEARABLES (#135), ETL-AGREGACJA-KONTROLA (#28)'),
 ('2. Moduły architektury', 'ETL-034 Gateway (#117), ETL-031 Model orkiestratora (#119), '
  'Master 5.4 §4.3 (#126)'),
 ('3. Sześć agregatorów', 'Macierz Dostawców (#86), Pytania i odpowiedzi (#101), '
  'ETL-031 (#119) — korekta o nieodziedziczalności CE'),
 ('4. Test otwartego standardu', 'ETERNAL_Macierz_Dostawcow.xlsx (#86)'),
 ('5. Integracja zamiast budowy', 'ETL-032 Wykonalność naukowa i kontrola technologii '
  '(#118), ETL-AGREGACJA-KONTROLA (#28), Model agregacyjny bez certyfikacji (#88)'),
 ('6. Modularność', 'Master 5.4 (#126), Struktura warstwowa (#43), '
  'ETL-031 §5 klinika mobilna (#119)'),
 ('7. Hierarchia ekosystemu', 'Eternal_Projekty_P1-P5_definicja (#151), '
  'Macierz 40 Projektów v2 (#128), Struktura Cel-Projekt-Produkt-Funkcja (#153)'),
 ('8. Ocena technologii', 'ETL-032 (#118)'),
]
