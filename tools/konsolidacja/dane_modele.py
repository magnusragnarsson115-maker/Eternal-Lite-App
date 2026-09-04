# -*- coding: utf-8 -*-
"""Model struktury podmiotu i modele wykonania ekosystemu."""

# ------------------------------------------------- struktura badawczo-biznesowa
STRUKTURA_CEL = (
 "Cel konstrukcji jest jeden: kontrola bez zarzadzania operacyjnego, utrzymana takze wtedy, "
 "gdy zalozyciel przestanie prowadzic firme i gdy wejda inwestorzy. Dwa wzorce sprawdzone "
 "w praktyce. Bosch: rozdzielenie kapitalu od glosu — fundacja ma udzial kapitalowy, "
 "glosami steruje osobne cialo powiernicze, fundacja czerpie korzysc, ale nie kieruje. "
 "Novo Nordisk: fundacja trzyma glosy przez holding, akcje uprzywilejowane sa nienotowane "
 "i poza obrotem. Element do skopiowania jest jeden i jest jezykowy: statut nie mowi, "
 "ze fundacja MOZE utrzymac kontrole — mowi, ze jest ZOBOWIAZANA. Uprawnienie nastepca "
 "moze nie wykonac; obowiazek jest naruszeniem statutu.")

PODMIOTY = [
 ["Podmiot", "Co posiada i czym zarzadza", "Rezim", "Kiedy"],
 ["Fundacja Eternal", "standard danych, rejestr zgodnosci, znaki towarowe, weto misyjne, "
  "fundusz badawczy", "prawo o fundacjach", "statut do 31.12.2026 — data nieodwracalna"],
 ["Eternal Labs Sp. z o.o.", "oprogramowanie, warstwa danych, mapper, produkty P1-P3, P5-P6",
  "prawo handlowe", "istnieje"],
 ["Eternal Vet Sp. z o.o.", "linia weterynaryjna P4 — osobny kanal sprzedazy i osobny "
  "wlasciciel", "prawo handlowe, poza MDR", "gdy P4 ma przychod powtarzalny"],
 ["Eternal Care", "podmiot leczniczy: teleporada, zlecanie badan, wytwarzanie wlasnej "
  "dokumentacji", "ustawa o dzialalnosci leczniczej, RPWDL — 894 zl podmiot, 179 zl praktyka",
  "wniosek Q4 2026, wpis Q1 2027"],
 ["Eternal Devices", "producent wyrobu — warstwa sprzetowa, gdy powstanie",
  "MDR, PRRC, EUDAMED", "gdy jest co produkowac"],
 ["Rada Naukowa", "ocena zgloszen, przyznawanie stypendiow, nadzor nad funduszem",
  "cialo Fundacji", "2027"],
]

FUNDUSZ = (
 "Warunek konieczny, bez ktorego cala konstrukcja badawcza jest deklaracja: fundusz badawczy "
 "zasilany automatycznie stalym odsetkiem przychodu, poza kontrola zarzadu. Zarzad rozliczany "
 "z wynikow biezacych nie sfinansuje badan o horyzoncie dwudziestoletnim — nie ze zlej woli, "
 "tylko dlatego, ze jest rozliczany z czegos innego. Odpis rzedu 20% przychodu finansuje "
 "przy 3 mln zl jeden projekt warstwowy, przy 10 mln — trzy rownolegle.")

KONTROLA_ZRODLA = [
 ["Zrodlo kontroli", "Mechanizm", "Co daje"],
 ["Kapital", "udzialy Fundacji w spolce operacyjnej", "korzysc ekonomiczna"],
 ["Glosy", "obowiazek statutowy udaremniania rozwodnienia",
  "utrzymanie wiekszosci przy wejsciu inwestorow"],
 ["Wlasnosc intelektualna", "IP mieszka nad spolkami i jest licencjonowane odwolywalnie",
  "sprzedaz spolki zaleznej nie sprzedaje technologii"],
 ["Infrastruktura", "standard danych, rejestr zgodnosci, protokol",
  "kto definiuje format, ten posiada ekosystem"],
 ["Ludzie", "nastepca operacyjny wprowadzany 2-3 lata przed przekazaniem",
  "ciaglosc — dzis to jedyna rola nieobsadzona i najpilniejsza rekrutacja"],
]

# --------------------------------------------- modele wykonania ekosystemu
MODELE = [
 {
  'kod': 'M-A', 'nazwa': 'ORKIESTRATOR',
  'istota': 'Nie budujemy prawie niczego. Kupujemy funkcje, kontrolujemy interfejs. '
  'Wlasne zostaja: model danych, protokol, rejestr, mapper, firmware, dziennik audytowy.',
  'koszt': '400-540 tys. zl na zestaw podstawowy, 9-12 miesiecy',
  'kontrola': 'srednia na starcie, rosnaca — okolo 39% dzis, cel 80% na trzech do pieciu '
  'komponentach krytycznych',
  'czas': 'przychod od kwartalu drugiego — uslugi regulacyjne nie wymagaja zadnego produktu',
  'ryzyko_reg': 'najnizsze — warstwa A i B, bez dossier',
  'kiedy': 'DOMYSLNY. Dopoki nie ma dowodu popytu i pierwszego przychodu.',
  'wyjscie': 'gdy koszt licencji przekracza prog wyjscia zapisany dla danej klasy '
  'komponentu — wtedy i tylko wtedy budujemy wlasne',
 },
 {
  'kod': 'M-B', 'nazwa': 'INTEGRATOR SYSTEMOW',
  'istota': 'Sprzedajemy komponent dostawcom systemow gabinetowych, ktorzy w innych '
  'obszarach sa konkurencja. Mapper, terminologia, rejestr zgodnosci.',
  'koszt': '110 osobodni na K3 i K4, okolo 88 tys. zl',
  'kontrola': 'wysoka nad formatem, zadna nad relacja z pacjentem',
  'czas': 'przychod 2027-2028, skok w 2029 przy terminie EEHRxF',
  'ryzyko_reg': 'niskie — komponent, nie wyrob',
  'kiedy': 'rownolegle do M-A, bo dzieli z nim te sama warstwe K2-K4',
  'wyjscie': 'nie wychodzimy — to jest docelowa pozycja, nie etap',
 },
 {
  'kod': 'M-C', 'nazwa': 'PODMIOT LECZNICZY',
  'istota': 'Wchodzimy w rezim uslugowy: teleporada, zlecanie badan, wytwarzanie wlasnej '
  'dokumentacji. Kto wytworzyl dokument, ma do niego dostep z mocy ustawy.',
  'koszt': '894 zl wpisu plus lokal, personel, opinia sanitarna, OC — realnie druga firma '
  'obok pierwszej',
  'kontrola': 'bardzo wysoka — to jest fosa, ktorej zadna aplikacja konsumencka nie powtorzy',
  'czas': 'wpis Q1 2027, pierwsze swiadczenia Q2 2027',
  'ryzyko_reg': 'srednie — rezim uslugowy, nie wyrob, ale realny ciezar operacyjny',
  'kiedy': 'po pierwszym przychodzie z M-A; nie wczesniej, bo to koszt staly',
  'wyjscie': 'nie dotyczy — status raz uzyskany jest aktywem trwalym',
 },
 {
  'kod': 'M-D', 'nazwa': 'WYTWORCA WYROBU',
  'istota': 'Warstwa oceny: interpretacja, prog, zalecenie, predykcja. Dossier, PRRC, '
  'jednostka notyfikowana, nadzor po wprowadzeniu.',
  'koszt': 'setki tysiecy do kilku mln zl i 18-36 miesiecy; waskim gardlem jest kolejka '
  'do jednostki notyfikowanej, nie koszt',
  'kontrola': 'pelna nad produktem, zerowa nad harmonogramem',
  'czas': 'najwczesniej 2029, realnie 2030+',
  'ryzyko_reg': 'najwyzsze — i nieprzewidywalne, bo jak konkretna jednostka odczyta '
  'konkretne zdanie o przeznaczeniu, tego nie wie nikt poza nia',
  'kiedy': 'dopiero gdy jest pieciu placacych klientow na to samo. Dopuszczenie nie chroni '
  'przed brakiem popytu — spalono na tym miliardy.',
  'wyjscie': 'alternatywa stala: proxy do cudzego wyrobu z CE, dopoki nie ma przychodu B2B',
 },
 {
  'kod': 'M-E', 'nazwa': 'KONSORCJUM BADAWCZE',
  'istota': 'Dane wnoszone jako wklad niepieniezny w zamian za udzial w wyniku i we '
  'wlasnosci intelektualnej. Zamiast transakcji tworzy wspolwlasnosc.',
  'koszt': 'zero pieniedzy; koszt to czas i warunek wstepny — kohorta musi istniec wczesniej',
  'kontrola': 'wysoka przez udzial 5-15% i prawo weta wobec zbycia IP',
  'czas': '2029-2030, po zbudowaniu kohorty',
  'ryzyko_reg': 'niskie, ale wymaga zgod odwolywalnych i sciezki wyjscia z danymi',
  'kiedy': 'gdy tworca technologii potrzebuje danych do walidacji i nie moze ich kupic, '
  'bo skladaja sie z czasu',
  'wyjscie': 'nie dotyczy — to mechanizm kontroli, nie etap',
 },
 {
  'kod': 'M-F', 'nazwa': 'PLATFORMA DLA TWORCOW',
  'istota': 'Nie zatrudniamy zespolu do zbudowania kolejnych stu funkcji. Budujemy warstwe, '
  'na ktorej robia to inni, i bierzemy prowizje.',
  'koszt': '40-60 tys. zl na wersje pierwsza, 200 tys. na pelna',
  'kontrola': 'wysoka nad dystrybucja, zadna nad jakoscia modulow',
  'czas': 'rok 3 — wymaga wczesniej dzialajacego API i pierwszych klientow',
  'ryzyko_reg': 'srednie — kazdy modul zewnetrzny to potencjalne przeniesienie '
  'odpowiedzialnosci na nas jako operatora platformy',
  'kiedy': 'po pierwszym przychodzie i po ustabilizowaniu API',
  'wyjscie': 'nie dotyczy',
 },
]

MODELE_WNIOSEK = (
 "Modele nie sa alternatywami do wyboru — sa warstwami, ktore wlacza sie w kolejnosci. "
 "M-A jest domyslny i zaczyna sie dzis. M-B rownolegle, bo dzieli z nim komponenty K2-K4. "
 "M-C po pierwszym przychodzie, bo to koszt staly. M-E gdy istnieje kohorta. M-F gdy "
 "istnieje API i klienci. M-D na koncu i tylko wtedy, gdy pieciu klientow placi za to samo. "
 "Kazde przeskoczenie kolejnosci kosztuje rok. Najczestszy blad w tej kategorii to wejscie "
 "w M-D przed M-A: dossier przed dowodem popytu.")

PORTFEL_ZASADA = (
 "Zasada dwoch do trzech projektow rownoczesnie. Rozproszenie uwagi na zbyt wiele frontow "
 "jest w rejestrze ryzyk pozycja o najwyzszym prawdopodobienstwie, wyzszym niz brak popytu "
 "i wyzszym niz ryzyko regulacyjne. Przy szesciu osobach i czterech rodzinach technologii "
 "kazdy dodatkowy front kosztuje wiecej, niz wnosi. Katalog odrzucen jest czescia planu, "
 "nie jego brakiem.")
