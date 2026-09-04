# -*- coding: utf-8 -*-
"""Produkty zlozone z 5-6 funkcji, wyprowadzone przez korelacje istniejacego rejestru.

Zasada konstrukcyjna, ktora rozni ten dokument od wczesniejszych: produkt nie
jest modulem ani zbiorem modulow. Produkt to piec albo szesc funkcji z rejestru
337, dobranych tak, ze razem robia jedna rzecz, ktorej zadna z nich nie robi
osobno. Zaden produkt ponizej nie wprowadza funkcji, ktorej nie ma w rejestrze.

Kryteria, ktore kazdy produkt musi spelnic — wszystkie piec naraz:
  NIEZASTEPOWALNY  poza Eternal nie ma tego zestawienia, a nie samych czesci
  AUTOMATYCZNY     dziala bez pracy uzytkownika po jednorazowej konfiguracji
  ROZWIJAJACY SIE  kazde uzycie poprawia wynik nastepnego uzycia
  PERSONALIZOWANY  wynik odnosi sie do historii tego czlowieka, nie do sredniej
  SZEROKIE SPEKTRUM  odbiorca to nie nisza, tylko kazdy, kto ma dane albo dokument
"""

# ---------------------------------------------------------------- metoda
METODA = [
 ["Krok", "Co robimy", "Dlaczego tak"],
 ["1. Wezly grafu", "z pola „Zasila / Czerpie z” w kartach funkcji wyznaczamy wezly "
  "o najwyzszym stopniu wejscia: EDM i normalizacja FHIR",
  "kazda sciezka danych konczy sie w jednym z nich — to sa naturalne osie produktow"],
 ["2. Wspolny kanal", "grupujemy funkcje po kanale monetyzacji, nie po module",
  "modul to porzadek katalogowy; kanal mowi, kto placi — a to jest granica produktu"],
 ["3. Wspolna warstwa", "w jednym produkcie nie mieszamy warstwy A z warstwa C",
  "komponent obslugujacy jednoczesnie wellness i klase IIa dziedziczy klase wyzsza "
  "dla calosci; rozdzielenie produktow jest tansze niz dossier"],
 ["4. Piec do szesciu", "twardy limit liczby funkcji na produkt",
  "ponizej pieciu produkt nie domyka petli uzytkownika; powyzej szesciu przestaje "
  "byc jednym produktem i wraca do bycia modulem"],
 ["5. Test niezastepowalnosci", "pytamy, co trzeba mieć, zeby to powtorzyc",
  "jezeli odpowiedz brzmi „kupic te same API”, produkt odpada — zostaje tylko to, "
  "czego nie da sie kupic: polski kontekst, ciaglosc zapisu, status podmiotu"],
]

# ------------------------------------------------------------- produkty
# (kod, nazwa, jedno zdanie, [funkcje], niezastepowalnosc, automatyzm, rozwoj,
#  personalizacja, odbiorca, monetyzacja, samodzielnosc, warstwa, etap, ryzyko)
PRODUKTY = [
 {
  'kod': 'P1', 'nazwa': 'ETERNAL SYNC', 'claim': 'Jedno miejsce, w ktorym dane z kazdego '
  'urzadzenia i kazdego laboratorium sa policzone razem — i rozstrzygniete, gdy sie roznia.',
  'funkcje': ['A1.1', 'A1.2', 'A1.8', 'A1.7', 'A1.5', 'A1.10'],
  'niezast': 'Apple, Google i Terra pobieraja dane. Zaden z nich nie laczy ich z wynikami '
  'laboratoryjnymi i zaden nie rozstrzyga konfliktu odczytow miedzy zrodlami. Dwa '
  'urzadzenia mierzace to samo daja dwie rozne wartosci i ktos musi zdecydowac, ktora '
  'jest prawdziwa — albo pokazac obie z waga pewnosci. To jest funkcja A1.7 i nie ma jej '
  'nikt inny.',
  'automat': 'Synchronizacja w tle co 15 minut. Po jednorazowym podlaczeniu urzadzenia '
  'uzytkownik nie robi nic.',
  'rozwoj': 'Kazdy nowy adapter dokłada zrodlo bez zmiany reszty systemu. Rdzen nigdy nie '
  'wola API dostawcy — zawsze przez adapter, wiec wymiana dostawcy to wymiana pliku.',
  'person': 'Warstwa faktow, celowo bez personalizacji. Personalizacja wchodzi wyzej — '
  'to jest wlasnie powod, dla ktorego ten produkt jest poza rezimem wyrobu.',
  'odbiorca': 'Kazdy, kto ma cokolwiek mierzacego: zegarek, wage, cisnieniomierz, glukometr. '
  'W Polsce to kilka milionow ludzi, w Unii kilkadziesiat.',
  'monetyzacja': 'Sam nie zarabia i nie ma zarabiac — to fundament. Zarabia jako API i SDK '
  'sprzedawane B2B (kanal K3) oraz jako warunek kazdego produktu wyzej. Wycena: licencja '
  'na zdolnosc, nie za uzytkownika.',
  'sam': 'Dziala samodzielnie jako produkt infrastrukturalny dla cudzych aplikacji.',
  'warstwa': 'A', 'etap': 'MVP — dostepny od pierwszego dnia',
  'ryzyko': 'Progi wyjscia z dostawcow: Terra powyzej 3 000 zl/mies. albo 5 000 aktywnych '
  'uzytkownikow. Gadgetbridge na AGPL-3.0 wymaga oddzielenia architektonicznego przed '
  'rozpoczeciem prac, nie po.',
 },
 {
  'kod': 'P2', 'nazwa': 'ETERNAL PARSER', 'claim': 'Zdjecie polskiego wyniku badania staje '
  'sie danymi, ktore da sie porownac z osmioma poprzednimi.',
  'funkcje': ['A2.1', 'A2.3', 'A2.7', 'A11.4', 'A1.5', 'A2.6'],
  'niezast': 'Nie chodzi o OCR — OCR jest towarem. Chodzi o polski kontekst medyczny: '
  'ponad trzy tysiace nazw laboratoryjnych, slownik synonimow, jednostki, formaty Synevo, '
  'Diagnostyki i ALAB-u oraz korekta bledow rozpoznawania w rodzaju „Clukosa” na „Glukoza”. '
  'To jest zbior, ktorego nie da sie kupic, bo sklada sie z czasu i z korekt uzytkownikow.',
  'automat': 'Uzytkownik robi zdjecie. Reszta dzieje sie bez niego — do momentu, w ktorym '
  'system prosi o potwierdzenie pola o niskiej pewnosci rozpoznania.',
  'rozwoj': 'Kazda korekta wraca do slownika. Skutecznosc mierzona jako odsetek pol bez '
  'korekty; prog docelowy to ponad 90% po tysiacu dokumentow.',
  'person': 'Wynik nie jest pokazywany jako liczba, tylko jako pozycja w Twoim wlasnym '
  'szeregu. „Odczytano: CRP 12 mg/l. Sprawdz poprawnosc” — nigdy „Twoje CRP jest podwyzszone”.',
  'odbiorca': 'Kazdy, kto ma papierowy albo pedeefowy wynik badania. To jest praktycznie '
  'cala populacja korzystajaca z opieki zdrowotnej, bo platforma panstwowa pokazuje '
  'wylacznie to, co placowka zaraportowala.',
  'monetyzacja': 'Dwa kanaly naraz. B2C: driver konwersji — konwersja po pierwszym uzyciu '
  '25-35%, przy czym z calej bazy okolo 3,9%. B2B: odczyt dokumentow dla placowek '
  'rozliczany za dokument, marza bardzo wysoka, przychod od roku trzeciego.',
  'sam': 'Dziala samodzielnie i jest najlepszym kandydatem na osobna spolke — nie wymaga '
  'ani urzadzen, ani statusu podmiotu leczniczego.',
  'warstwa': 'A', 'etap': 'MVP — rdzen pierwszej wersji',
  'ryzyko': 'Granica: OCR odczytujacy jest bezpieczny, OCR dodajacy interpretacje staje sie '
  'wyrobem. Prog wyjscia z Document AI: 2 000 zl/mies. albo moment wejscia funkcji do dossier.',
 },
 {
  'kod': 'P3', 'nazwa': 'ETERNAL SCRIBE', 'claim': 'Notatka z wizyty pisze sie sama, '
  'w jezyku polskim, i ląduje w systemie gabinetowym, ktorego lekarz juz uzywa.',
  'funkcje': ['A12.1', 'A12.2', 'A12.5', 'A12.6', 'A12.7', 'A2.2'],
  'niezast': 'Rozwiazania miedzynarodowe maja kapital i dojrzalosc produktu, ale nie maja '
  'polskiego jezyka medycznego ani integracji z polska dokumentacja. Jezyk polski medyczny '
  'jest bariera wejscia, a nie przewaga kosztowa — dlatego ta pozycja jest broniona dluzej '
  'niz cokolwiek innego w portfelu.',
  'automat': 'Lekarz wlacza nagrywanie i konczy wizyte. Dokumentacja jest gotowa, zanim '
  'wyjdzie pacjent.',
  'rozwoj': 'Slownik medyczny i wzorce notatek ucza sie na korektach lekarza. Kodowanie ICD '
  'poprawia sie na tym samym materiale.',
  'person': 'Personalizacja dotyczy lekarza, nie pacjenta: system uczy sie stylu notatki '
  'i ukladu pol tego gabinetu.',
  'odbiorca': 'Kazdy lekarz przyjmujacy pacjentow w Polsce. Platnik decyzyjny to jedna '
  'osoba, nie komisja — to najkrotsza droga do pierwszej faktury.',
  'monetyzacja': 'Licencja per lekarz miesiecznie. Punkt odniesienia rynkowy: okolo '
  '199-250 USD za lekarza miesiecznie u gracza amerykanskiego. Abonament instytucjonalny '
  'to najlepszy typ przychodu w calym zestawieniu.',
  'sam': 'Calkowicie samodzielny. Nie potrzebuje aplikacji pacjenta, nie potrzebuje '
  'urzadzen, nie potrzebuje danych z P1.',
  'warstwa': 'B', 'etap': 'pierwsza fala — ocena 5/7 wg kryteriow wlasnych',
  'ryzyko': 'Granica przebiega przy przeznaczeniu: „sprzedajesz narzedzie, nie usluge '
  'dokumentacyjna”. W momencie, w ktorym to Eternal tworzy dokumentacje, a nie klinika, '
  'zmienia sie rezim.',
 },
 {
  'kod': 'P4', 'nazwa': 'ETERNAL PET', 'claim': 'Ciagly zapis zdrowia zwierzecia, ktory '
  'wlasciciel moze zabrac ze soba — razem z danymi.',
  'funkcje': ['A13.1', 'A13.2', 'A13.4', 'A13.5', 'A13.3', 'A2.6'],
  'niezast': 'Rynek jest nasycony — dominujacy gracz ma ponad 5 600 placowek, dwa '
  'rozwiazania sa bezplatne, migracja trwa kwadrans. Luka jest jedna i konkurencja '
  'deklaruje ja wprost: na pytanie, czy klient po zakonczeniu wspolpracy otrzyma '
  'zgromadzone dane, odpowiada „nie”. Pelny eksport w formacie uzytecznym gdzie indziej '
  'kosztuje niewiele i da sie go powiedziec jednym zdaniem.',
  'automat': 'Transponder i obroza raportuja same. Wlasciciel dostaje kalendarz szczepien '
  'i przypomnienia bez wpisywania czegokolwiek.',
  'rozwoj': 'Kohorta zwierzeca rosnie szybciej niz ludzka i nie podlega MDR — to jest '
  'material do kontraktow badawczych i tor walidacyjny dla pozniejszej warstwy sprzetowej.',
  'person': 'Profil rasy i predykcja chorob rasowych; odchylenie od wlasnej trajektorii '
  'zwierzecia, nie od sredniej gatunku.',
  'odbiorca': 'Miliony gospodarstw domowych i tysiace lecznic. Jedyny segment konsumencki, '
  'w ktory wchodzimy — bo tu zero obecnosci panstwa.',
  'monetyzacja': 'Freemium, potem subskrypcja okolo 29 zl/mies., potem sprzet z marza. '
  'Do tego prowizja weterynaryjna i sprzedaz transponderow.',
  'sam': 'Osobny produkt, osobny kanal sprzedazy, kandydat na osobna spolke. Nie wymaga '
  'niczego z linii ludzkiej poza kodem.',
  'warstwa': 'A', 'etap': 'pierwsza fala — jedyna pozycja z ocena 7/7',
  'ryzyko': 'MDR nie obejmuje weterynarii w ogole — to odrebny rezim, nie latwiejsza '
  'sciezka. Obowiazuja normy identyfikacji zwierzat ISO 11784 i 11785.',
 },
 {
  'kod': 'P5', 'nazwa': 'ETERNAL MAPPER', 'claim': 'Polski dokument kliniczny zamieniony '
  'na format europejski — zanim stanie sie to obowiazkiem.',
  'funkcje': ['D1.6', 'A1.5', 'A2.2', 'D1.4', 'A11.4', 'A2.8'],
  'niezast': 'Polska dokumentacja stoi na innym standardzie niz europejski. Mapper miedzy '
  'nimi nie istnieje jako produkt, a od 26 marca 2029 potrzebuje go kazdy dostawca systemu '
  'gabinetowego w kraju. To jedyna zewnetrzna data w calym planie, ktora tworzy popyt '
  'niezaleznie od naszych dzialan.',
  'automat': 'Placowka nie zmienia niczego u siebie. Mapper stoi obok i tlumaczy.',
  'rozwoj': 'Kazdy nowy format dostawcy poszerza pokrycie; uslugi terminologiczna '
  'i mapujaca sprzedaja sie razem.',
  'person': 'Brak i nie jest potrzebna — to komponent infrastrukturalny.',
  'odbiorca': 'Kilkudziesieciu dostawcow systemow gabinetowych i szpitalnych oraz placowki '
  'bez wlasnego dzialu IT. Rynek zamkniety liczbowo, ale kazdy klient jest duzy.',
  'monetyzacja': 'Licencja per placowka plus wdrozenie. Zerowy koszt krancowy, wiec marza '
  'rosnie z kazdym kolejnym klientem.',
  'sam': 'Samodzielny komponent sprzedawany dostawcom, ktorzy w innych obszarach sa '
  'konkurencja. To celowe: stajemy sie ich dostawca, nie konkurentem.',
  'warstwa': 'A', 'etap': 'wersja sprzedawalna do Q4 2027 — dwa lata przed terminem',
  'ryzyko': 'To wyscig, nie fosa trwala. Kazdy, kto zacznie teraz, moze zdazyc. Poslizg '
  'powyzej szesciu miesiecy wzgledem 26.03.2029 oznacza repriorytetyzacje calego portfela.',
 },
 {
  'kod': 'P6', 'nazwa': 'ETERNAL REPORT', 'claim': 'To, co pacjent kladzie lekarzowi na '
  'biurku — komplet, ktorego lekarz nie ma z zadnego innego zrodla.',
  'funkcje': ['A4.1', 'A4.2', 'A4.4', 'A2.5', 'D1.2', 'A2.6'],
  'niezast': 'Platforma panstwowa pokazuje to, co placowka zaraportowala. Laboratoria '
  'prywatne maja wlasne portale i wlasny interes. Raport laczacy jedno z drugim i z danymi '
  'z urzadzen nie powstaje nigdzie indziej, bo nikt inny nie ma wszystkich trzech zrodel.',
  'automat': 'Raport generuje sie z tego, co juz jest w zapisie — uzytkownik wybiera zakres '
  'dat i format.',
  'rozwoj': 'Wartosc rosnie z czasem w sposob, ktorego nie da sie przyspieszyc: osma kartka '
  'po trzech latach jest bezcenna, bo nikt inny nie ma siedmiu poprzednich.',
  'person': 'Caly produkt jest personalizacja — to jest zestawienie jednej osoby w czasie.',
  'odbiorca': 'Kazdy, kto idzie do lekarza z wiecej niz jednym wynikiem. Wtornie: lekarz, '
  'ktory dostaje zrodlo i wiarygodnosc kazdego pomiaru, a nie sama liczbe.',
  'monetyzacja': 'Wersja surowa bezplatna na zawsze — to jest warunek zaufania i prawo '
  'wyjscia z danymi. Zarabia to, co obok: prowizja od zleconego badania i licencja B2B '
  'na format raportu dla placowek.',
  'sam': 'Dziala samodzielnie, ale nabiera wartosci dopiero nad P1 i P2 — to jedyny produkt '
  'z tej szostki, ktory realnie potrzebuje ekosystemu.',
  'warstwa': 'A', 'etap': 'MVP w wersji surowej; SBAR dopiero po dossier',
  'ryzyko': 'Granica jest ostra: „Twoje pomiary z 7 dni” jako tabela bez podsumowania '
  'oceniajacego to wellness. Raport SBAR z wnioskiem to wyrob klasy IIa i osobna sciezka.',
 },
]

PRODUKT_SIODMY = (
 "Siodma pozycja swiadomie nie jest produktem: karta ratunkowa (A5.3, A14.1) — dziala bez "
 "sieci, z zablokowanego ekranu, bez konta po stronie ratownika, kazdy odczyt zostawia "
 "nieusuwalny slad, pacjent dostaje powiadomienie po fakcie. To najmocniejszy argument "
 "adopcyjny w calym portfelu i nie monetyzujemy jej nigdy. Jest jedyna funkcja, ktora "
 "dziala dla czlowieka, ktory nigdy nie otworzyl aplikacji — bo w tym momencie nie moze.")

# --------------------------------------------- modul jako osobny produkt
MODUL_NA_PRODUKT = [
 ["Kryterium", "Modul zostaje modulem", "Modul staje sie produktem"],
 ["Platnik", "placi ten sam klient, co za reszte",
  "ma wlasnego platnika, ktory nie kupuje reszty"],
 ["Kanal", "sprzedaje sie razem z aplikacja", "ma wlasny kanal sprzedazy i wlasny cennik"],
 ["Zaleznosci", "nie dziala bez trzech innych modulow",
  "domyka petle uzytkownika w piatke funkcji"],
 ["Rezim", "dzieli warstwe regulacyjna z reszta",
  "ma wlasna warstwe — i dzieki wydzieleniu nie dziedziczy klasy wyzszej"],
 ["Zespol", "ten sam zespol, ten sam sprint",
  "moze miec wlasnego wlasciciela i wlasny harmonogram"],
 ["Test koncowy", "usuniecie modulu psuje produkt glowny",
  "usuniecie modulu nie psuje nic poza nim samym"],
]

MODUL_NA_PRODUKT_WNIOSEK = (
 "Zastosowanie tych szesciu kryteriow do rejestru daje dokladnie szesc produktow powyzej "
 "i jedna pozycje niemonetyzowana. Reszta modulow kryteriow nie spelnia — nie dlatego, ze "
 "sa gorsze, tylko dlatego, ze nie maja wlasnego platnika. Modul bez wlasnego platnika "
 "sprzedawany jako osobny produkt tworzy koszt sprzedazy bez przychodu.")

# ------------------------------------------- produkty wielobranzowe
RDZEN = (
 "Piec funkcji tworzy rdzen przenoszalny miedzy branzami: A2.1 odczyt dokumentu, "
 "A1.5 normalizacja do jednego modelu, A1.7 deduplikacja i rozstrzyganie konfliktu, "
 "A2.6 eksport w formacie uzytecznym gdzie indziej oraz log dostepu. Zmienia sie slownik, "
 "format zrodlowy i platnik — nie zmienia sie kod. To jest podstawa, na ktorej z jednego "
 "zespolu powstaje wiele produktow bez mnozenia technologii.")

BRANZE = [
 ["Nisza / branza", "Funkcje rdzenia", "Co sie zmienia", "Kto placi", "Rezim"],
 ["Weterynaria", "A2.1 A1.5 A2.6 + A13.1 A13.5",
  "slownik weterynaryjny, normy dla gatunku i rasy, transponder ISO 11784",
  "wlasciciel i lecznica", "poza MDR — odrebny rezim"],
 ["Medycyna pracy", "A2.1 A1.5 A2.6 A12.5 + A4.1",
  "orzeczenia, badania okresowe, terminy waznosci, raport zbiorczy dla pracodawcy",
  "pracodawca — od 100 do 5 000 pracownikow", "poza wyrobem, ochrona danych szczegolna"],
 ["Fizjoterapia i rehabilitacja", "A2.1 A1.5 A2.6 + A7.1 A4.2",
  "skale bolu i sprawnosci, plan z kontrola wykonania, postep miedzy wizytami",
  "gabinet i pacjent", "poza wyrobem do momentu oceny postepu"],
 ["Laboratoria", "A2.1 A2.3 A11.4 A1.5 A2.6",
  "parser wlasnych formatow jako usluga dla laboratorium, nie dla pacjenta",
  "laboratorium za dokument", "poza wyrobem"],
 ["Dostawcy systemow EDM", "D1.6 A1.5 A2.2 D1.4 A11.4",
  "mapowanie na format europejski, walidacja, raport zgodnosci",
  "dostawca systemu, per placowka", "komponent, termin 26.03.2029"],
 ["Badania kliniczne zdecentralizowane", "A1.1 A1.7 A1.5 A12.3 A2.6",
  "protokol badania zamiast profilu, zgody per badanie, eksport dla sponsora",
  "sponsor badania — najwyzsza marza", "prawo badan klinicznych, nie MDR"],
 ["Producenci wyrobow", "A1.1 A1.5 A2.6 + rejestr zgodnosci",
  "dane nadzoru po wprowadzeniu do obrotu: producent wie, ze urzadzenie dziala, "
  "nie wie, czy pacjentowi jest lepiej",
  "producent, kontrakt roczny", "sprzedaz obowiazku, nie produktu"],
 ["Senior care i opieka domowa", "A1.1 A1.7 A14.1 A4.1 + tryb senioralny",
  "dwa konta na jednym ekranie, mniej powiadomien, panel opiekuna",
  "rodzina i placowka opiekuncza", "poza wyrobem do momentu detekcji stanu"],
 ["Sport wyczynowy", "A1.1 A1.2 A1.7 A1.5 A2.6",
  "dane surowe, wiele osi, eksport do narzedzi trenera, brak warstwy oceny",
  "klub i zawodnik", "poza wyrobem"],
 ["Apteki", "A2.7 A1.5 A2.6 + katalog",
  "odczyt recepty i zaswiadczenia, rezerwacja i OTC bez powiazania z danymi zdrowotnymi",
  "apteka i sieć", "prawo farmaceutyczne, nie MDR"],
 ["Ubezpieczyciele", "A1.1 A1.7 A2.6 + scoring",
  "dane wnoszone przez klienta za osobna zgoda, sciezka odwolawcza do czlowieka",
  "ubezpieczyciel, 5-15 zl za uzytkownika miesiecznie",
  "RODO art. 22 plus AI Act zalacznik III — nie MDR, ale nadzor finansowy"],
]

BRANZE_ZASADA = (
 "Kolejnosc wejscia w nisze nie wynika z wielkosci rynku, tylko z rezimu. Najpierw te, "
 "ktore nie wymagaja ani statusu podmiotu leczniczego, ani dossier: weterynaria, "
 "dokumentacja, laboratoria, medycyna pracy. Potem te, ktore wymagaja statusu: swiadczenia "
 "wlasne i badania. Na koncu te, ktore wymagaja dossier albo nadzoru finansowego: "
 "interpretacja i scoring ubezpieczeniowy. Kazde przeskoczenie tej kolejnosci kosztuje "
 "rok i pieniadze, ktorych nie ma.")

# ------------------------------------------------- monetyzacja produktow
MONETYZACJA = [
 ["Produkt", "Model", "Kto placi", "Kiedy pierwszy przychod", "Marza"],
 ["P1 Eternal Sync", "licencja na zdolnosc, API i SDK",
  "dostawca aplikacji, integrator", "rok 2", "programowa, zerowy koszt krancowy"],
 ["P2 Eternal Parser", "za dokument (B2B) plus driver konwersji (B2C)",
  "placowka, laboratorium", "rok 3 w B2B, od razu jako driver", "bardzo wysoka"],
 ["P3 Eternal Scribe", "licencja per lekarz miesiecznie", "klinika, gabinet",
  "kwartal 3 pierwszego roku", "abonament instytucjonalny — najlepszy typ"],
 ["P4 Eternal Pet", "freemium, subskrypcja, sprzet z marza",
  "wlasciciel, lecznica", "kwartal 3 pierwszego roku", "mieszana: software wysoka, sprzet 40%"],
 ["P5 Eternal Mapper", "licencja per placowka plus wdrozenie",
  "dostawca systemu, placowka", "rok 2-3, skok w 2029", "bardzo wysoka"],
 ["P6 Eternal Report", "wersja surowa bezplatna; prowizja i licencja na format",
  "platnik badania, placowka", "rok 1 przez prowizje", "srednia"],
]

MONETYZACJA_ZASADA = (
 "Najwyzej marzowe produkty nie sa skierowane do pacjenta. Parser dla laboratoriow, "
 "dokumentacja dla klinik, mapper dla dostawcow, dane nadzoru dla producentow — wszystkie "
 "powstaja jako produkt uboczny czegos, co i tak budujemy. Aplikacja konsumencka jest "
 "kanalem dystrybucji i rekrutacji, nie produktem. Trzy pozycje nie sa platne nigdy: "
 "eksport danych, warstwa kryzysowa i format zapisu — bo to one kupuja zaufanie, "
 "na ktorym stoi reszta.")

# --------------------------------------------- dobor funkcji pod klienta
DOBOR = [
 ["Pytanie do klienta", "Odpowiedz", "Co wlaczamy"],
 ["Czy masz urzadzenia mierzace?", "tak", "P1 Sync w calosci"],
 ["Czy masz dokumenty papierowe albo pedeefy?", "tak", "P2 Parser"],
 ["Czy przyjmujesz pacjentow?", "tak", "P3 Scribe"],
 ["Czy jestes dostawca systemu gabinetowego?", "tak", "P5 Mapper"],
 ["Czy potrzebujesz danych do badania albo nadzoru?", "tak",
  "P1 plus eksport, kontrakt badawczy"],
 ["Czy chcesz oceny, progu albo zalecenia?", "tak",
  "STOP — to warstwa C, osobny produkt i osobne dossier; oferujemy proxy do wyrobu z CE"],
]

DOBOR_ZASADA = (
 "Szesc pytan wystarcza, zeby zlozyc oferte. Ostatnie jest najwazniejsze i jest pytaniem "
 "rozlaczajacym: w momencie, w ktorym klient chce oceny, progu albo zalecenia, przestajemy "
 "sprzedawac produkt z tej listy i zaczynamy rozmowe o dossier albo o proxy do cudzego "
 "wyrobu z oznakowaniem CE. Proxy dziala tylko wtedy, gdy nie modyfikujemy wyniku "
 "i wskazujemy producenta — modyfikacja oznacza, ze producentem jestesmy my.")

# ------------------------------------------ build / buy per klasa
BUILD_BUY = [
 ["Sytuacja", "Decyzja", "Przyklad z rejestru"],
 ["Komponent jest towarem, a rozniczka jest w danych",
  "kupujemy komponent, budujemy warstwe danych",
  "OCR: silnik kupiony, parser polskiego kontekstu wlasny"],
 ["Dostawca ma to, czego nie da sie odtworzyc w rok",
  "integrujemy z progiem wyjscia zapisanym z gory",
  "wearables: HealthKit i Health Connect od dnia 1, Terra dopiero na zadanie klienta B2B"],
 ["Rzecz definiuje format albo granice regulacyjna",
  "zawsze wlasne, nigdy nie wychodzimy",
  "model danych, silnik regul, firmware, dziennik audytowy"],
 ["Rzecz wymaga fabryki albo chemii", "nigdy wlasne",
  "polprzewodniki, produkcja masowa, transport wideo"],
 ["Partner ma oznakowanie CE, my nie", "proxy, dopoki nie ma przychodu B2B",
  "triage przez dostawce z CE zamiast wlasnego systemu wspomagania decyzji"],
 ["Licencja blokuje model komercyjny", "zamiana przed rozpoczeciem prac, nie po",
  "Gadgetbridge i wger na AGPL-3.0, OpenPose z licencja niekomercyjna"],
]

ALTERNATYWY = [
 ["Zamiast", "Robimy", "Oszczednosc", "Kiedy wracamy do wlasnego"],
 ["wlasnych opasek i zegarkow", "agregacja cudzych urzadzen przez adaptery",
  "300 tys. zl", "gdy koszt licencji przekroczy 3 000 zl/mies. albo 5 000 userow"],
 ["wlasnej platformy telemedycznej", "Jitsi w wersji pierwszej, dostawca white label dalej",
  "200 tys. zl", "nigdy — transport wideo zostaje kupiony"],
 ["wlasnego laboratorium", "afiliacja i katalog, wynik wprowadzany recznie",
  "50 tys. zl na integracji", "gdy powstanie wlasny podmiot leczniczy zlecajacy badania"],
 ["wlasnego modelu jezykowego", "model komercyjny, potem self-hosting",
  "setki tysiecy", "powyzej 2 500 zl/mies. na wywolaniach"],
 ["wlasnej platformy Hubu", "narzedzia gotowe i regulamin funduszu",
  "200 tys. zl", "przy skali, nie wczesniej"],
 ["wlasnego wyrobu medycznego na start", "proxy do cudzego wyrobu z CE",
  "koszt dossier", "przy przychodzie B2B uzasadniajacym dossier"],
]
