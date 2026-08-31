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
