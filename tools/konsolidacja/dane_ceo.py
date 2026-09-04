# -*- coding: utf-8 -*-
"""Dokument CEO — 26 sekcji. Tresc z pelnego odczytu korpusu, po korektach liczb."""

S00 = [
 "Eternal buduje warstwe znaczenia nad polskim systemem e-zdrowia. Panstwo dostarcza fakty — "
 "co sie zdarzylo, kiedy przyjsc, ile zaplacisz — za darmo, dwudziestu milionom ludzi. "
 "Nie dostarcza interpretacji i nie moze jej dostarczyc bez stania sie producentem wyrobu "
 "medycznego. Ta luka nie zamknie sie do 2031 roku.",
 "Dwie pozycje w wydatkach publicznych — hospitalizacje mozliwe do unikniecia oraz dublowanie "
 "badan diagnostycznych, razem 14-18 mld zl rocznie — sa problemami o charakterze "
 "informacyjnym, nie medycznym. To sa dokladnie te, ktore adresuje warstwa agregujaca dane.",
 "Portfel to szesc produktow, kazdy zlozony z pieciu do szesciu funkcji z rejestru 337. "
 "Zaden nie wprowadza funkcji, ktorej nie ma w rejestrze. Pierwsza fala to Eternal Scribe "
 "i Eternal Pet — obie poza rezimem wyrobu, obie z platnikiem instytucjonalnym, obie "
 "z przychodem w pierwszym roku.",
 "Potrzebujemy okolo 200 tys. zl na domkniecie struktury prawnej, uzyskanie statusu podmiotu "
 "leczniczego i doprowadzenie do pierwszego przychodu. Nie prowadzimy rundy kapitalowej.",
 "Wiemy, ze dziala, gdy: piec podpisanych zobowiazan w dwa miesiace, pieciu placacych "
 "w szesc, przychod pokrywajacy koszt zespolu w osiemnascie.",
]

S01 = [
 "MISJA. Zapis zdrowia czlowieka ma byc ciagly, kompletny i jego wlasny — przez dekady, "
 "niezaleznie od tego, w ilu placowkach sie leczyl i ilu urzadzen uzywal.",
 "WIZJA. Warstwa, przez ktora przechodza dane zdrowotne w Polsce i w Unii: nie dlatego, "
 "ze zablokowalismy wyjscie, tylko dlatego, ze nikt inny nie ma kompletu. Osma kartka "
 "po trzech latach jest bezcenna, bo nikt inny nie ma siedmiu poprzednich.",
 "ZASADA NADRZEDNA. Dane naleza do ludzi, ktorzy je wytworzyli. Prawo wyjscia z pelnym "
 "zapisem jest bezplatne i zawsze dostepne. Jesli ludzie zostaja, bo chca — mamy dzwignie. "
 "Jesli zostaja, bo nie moga wyjsc — mamy ja policzona na kilka lat.",
 "CZEGO NIE ROBIMY. Nie sterujemy zachowaniem ludzi bez ich wiedzy, nie wplywamy na decyzje "
 "wyborcze, nie budujemy oddzialywania podprogowego ani masowej implantacji. Ta warstwa jest "
 "wylaczona z dokumentacji na mocy sekcji 38 specyfikacji i pozostaje wylaczona.",
]

S02 = [
 ["Cel", "Miara", "Termin"],
 ["Zbudowac ciagly zapis zdrowia, ktorego nie ma nikt inny",
  "tysiac osob z nieprzerwana historia", "2029"],
 ["Zajac pozycje dostawcy komponentu u dostawcow systemow",
  "trzy placowki placace za komponent interoperacyjnosci", "koniec 2028"],
 ["Uzyskac status podmiotu leczniczego", "wpis do RPWDL", "Q1 2027"],
 ["Doprowadzic do samofinansowania", "przychod pokrywajacy koszt zespolu", "miesiac 18"],
 ["Utrzymac kontrole przy wejsciu inwestorow",
  "statut z obowiazkiem, nie uprawnieniem", "31.12.2026"],
 ["Wejsc w okno EEHRxF przed konkurencja", "mapper sprzedawalny", "Q4 2027"],
]

S03 = [
 ["Problem", "Skala", "Dowod"],
 ["Dokumentacja medyczna jest rozproszona",
  "placowka trzyma dokument u siebie, do platformy panstwowej trafia wylacznie indeks",
  "architektura P1 — panstwo nie rozwiazalo problemu agregacji"],
 ["Wynik badania jest nieczytelny dla pacjenta", "kazdy wynik laboratoryjny",
  "brak warstwy tlumaczacej w systemie publicznym"],
 ["Dane z urzadzen nie lacza sie z dokumentacja", "caly rynek urzadzen noszonych",
  "platforma panstwowa ich nie przyjmuje i nie przyjmie"],
 ["Lekarz traci czas na dokumentacje", "kazda wizyta",
  "powod istnienia calej kategorii produktow do automatycznej dokumentacji"],
 ["Systemy gabinetowe nie sa gotowe na wymog interoperacyjnosci", "wszystkie",
  "termin 26.03.2029 wynikajacy z rozporzadzenia"],
 ["Weterynaria nie ma infrastruktury cyfrowej z prawem wyjscia", "caly rynek",
  "dostawca bezplatny odpowiada wprost, ze danych nie odda"],
]

S03_NIE = ("Problem, ktorego NIE rozwiazujemy: dostepu do lekarza, kolejek i finansowania "
 "swiadczen. To sa problemy systemowe, ktorych zadna firma nie rozwiaze, a obiecywanie tego "
 "podwaza wiarygodnosc wszystkiego pozostalego.")

S04 = [
 ["Grupa", "Co ja boli", "Ktore produkty", "Czy placi"],
 ["Lekarz i gabinet", "czas na dokumentacje zamiast na pacjenta", "P3 Scribe", "TAK, wysoko"],
 ["Placowka bez dzialu IT", "wymog interoperacyjnosci do 2029", "P5 Mapper", "TAK"],
 ["Laboratorium", "wlasny format, brak wymiany", "P2 Parser", "TAK, za dokument"],
 ["Pacjent przewlekly", "stosy dokumentow, brak ciaglosci", "P2, P6", "nisko"],
 ["Opiekun i senior", "brak wgladu w stan bliskiej osoby", "P1, P6", "nisko"],
 ["Wlasciciel zwierzecia i lecznica", "brak zapisu, brak prawa wyjscia", "P4 Pet", "TAK"],
 ["Sponsor badania", "brak danych ciaglych", "P1 plus eksport", "TAK, najwyzej"],
 ["Producent wyrobu", "wie, ze urzadzenie dziala; nie wie, czy pacjentowi jest lepiej",
  "P1 plus rejestr", "TAK"],
]

S04_ZASADA = ("Pacjent nie jest platnikiem. Jest kanalem dystrybucji i rekrutacji. "
 "Aplikacja pacjenta jest bezplatna w calosci — ceny zera nie da sie podciac, a platforma "
 "panstwowa ma mandat ustawowy i dwadziescia milionow kont. To decyzja dystrybucyjna, "
 "nie konkurencyjna.")

S05 = [
 ["Warstwa przychodu", "Kto placi", "Ile zostaje", "Kiedy", "Charakterystyka"],
 ["Prowizja od ruchu", "laboratoria, apteki, catering", "10-30%", "pierwszy miesiac",
  "liniowa — kazda zlotowka wymaga transakcji"],
 ["Licencja B2B", "ubezpieczyciel, dostawca EDM, klinika", "100%", "2027-2029",
  "zerowy koszt krancowy"],
 ["Oplata za zgodnosc", "producenci urzadzen", "100%", "2028+", "rosnie z adopcja standardu"],
]

S05_ZASADA = ("Orkiestrator nie zarabia na prowizji — prowizja finansuje koszty biezace. "
 "Wartosc powstaje z tego, ze jestesmy jedynym miejscem, w ktorym dane z wielu zrodel sa "
 "w komplecie, a to sprzedaje sie licencyjnie. Model odrzucony: sprzedaz danych uzytkownika "
 "z prowizja — kategoria upadla rynkowo, a zgoda w rozumieniu RODO nie moze byc kupiona "
 "ani stanowic warunku uslugi.")

S06 = [
 ["Warstwa ekosystemu", "Co robi", "Rezim"],
 ["Zdolnosc dane zdrowotne", "adaptery, import dokumentow, normalizacja", "poza wyrobem"],
 ["Zdolnosc dokumentacja", "transkrypcja, strukturyzacja notatki", "poza wyrobem"],
 ["Zdolnosc interoperacyjnosc", "mapowanie standardu krajowego na europejski", "komponent"],
 ["Zdolnosc zwierzeta", "dokumentacja, przypomnienia, transponder", "poza MDR"],
 ["Zdolnosc interpretacja", "ocena wyniku, alert progowy, predykcja",
  "wyrob klasy IIa — nie w pierwszej fali"],
]

S09_LICZBY = [
 ["Ujecie", "Liczba", "Status"],
 ["Ekosystem — rejestr pelny", "309 funkcji w 42 modulach", "obowiazuje"],
 ["Rejestr operacyjny z macierza monetyzacji", "337 pozycji", "podstawa kart funkcji"],
 ["Aplikacja w ujeciu uzytkownika", "160 funkcji w 23 modulach", "obowiazuje dla App"],
 ["Baza historyczna", "185 funkcji w 30 modulach", "Master 3.0 — punkt odniesienia"],
 ["Etap zerowy", "12 funkcji", "jeden produkt, nie sto szescdziesiat"],
 ["Warstwa A poza wyrobem", "243 z 337", "buduje sie od razu"],
 ["Warstwa B inny rezim", "31 z 337", "wymaga statusu albo umowy powierzenia"],
 ["Warstwa C wyrob medyczny", "63 z 337", "dossier, 2029 i pozniej"],
]

S11 = [
 ["Data", "Co obowiazuje", "Podstawa"],
 ["28.05.2026", "EUDAMED — takze dla skladajacych systemy i zestawy", "Decyzja UE 2025/2371"],
 ["02.08.2026", "AI Act art. 50 — oznaczanie tresci generowanej", "Rozp. UE 2024/1689"],
 ["03.10.2026", "rejestracja w Wykazie KSC", "ustawa o KSC, Dz.U. 2026 poz. 252"],
 ["26.03.2027", "EHDS — ogolne stosowanie", "Rozp. UE 2025/327"],
 ["26.03.2029", "EEHRxF kategoria 1 — CE dla systemow EDM", "Rozp. UE 2025/327"],
 ["26.03.2031", "EEHRxF kategoria 2 — obrazowanie, wyniki, wypisy", "Rozp. UE 2025/327"],
]

S11_REGULA = ("Fakt i porownanie do wlasnej historii sa bezpieczne. Ocena, prog i zalecenie "
 "nie sa. Cztery slowa przekraczaja granice: „Twoje…”, „w normie”, „powinienes”, "
 "„wskazuje na”. Ta sama funkcja po jednej stronie granicy jest darmowa, po drugiej "
 "kosztuje dossier.")

S12 = [
 ["Aktywo", "Gdzie mieszka", "Dlaczego tam"],
 ["Standard danych i model kanoniczny", "Fundacja", "kto definiuje format, ten posiada ekosystem"],
 ["Rejestr zgodnosci i protokol", "Fundacja", "nosnik programu Eternal Kompatybilny"],
 ["Znaki towarowe", "Fundacja", "nie do zbycia razem ze spolka operacyjna"],
 ["Parser polskiego kontekstu", "spolka operacyjna, licencja od Fundacji",
  "sklada sie z czasu i korekt — nie da sie go kupic"],
 ["Firmware urzadzen", "spolka operacyjna", "zawsze wlasne, nigdy nie wychodzimy"],
 ["Dziennik audytowy", "spolka operacyjna", "wstecz sie go nie odtworzy"],
]

S12_ZASADA = ("IP mieszka nad spolkami i jest licencjonowane odwolywalnie w dol kaskady. "
 "Inaczej sprzedaz spolki zaleznej sprzedaje technologie.")

S13 = [
 "Glebia zamiast szerokosci. Zbiory publiczne to przekroje — pojedyncze zdarzenia rozrzucone "
 "w czasie. Do wnioskowania przyczynowego potrzeba tej samej osoby przed i po, wielokrotnie. "
 "Milion przekrojow tego nie da; tysiac ciaglych historii — da.",
 "Cel operacyjny brzmi wiec nie „jak najwiecej uzytkownikow”, tylko „jak najwiecej "
 "uzytkownikow prowadzacych zapis nieprzerwanie”. Metryka glowna to ciaglosc zapisu, "
 "nie liczba rejestracji.",
 "Dane surowe zostaja jak najblizej czlowieka. Na zewnatrz ida wyniki i wielkosci zbiorcze. "
 "Kazde wykorzystanie poza bezposrednia usluga wymaga osobnej zgody, odwolywalnej "
 "natychmiast. Oznaczamy dane, nie ludzi — kazdy wpis dostaje wage pewnosci, model uczy sie "
 "z wpisow wazonych.",
]

S14 = [
 ["Zasada AI", "Wykonanie"],
 ["Nie budujemy wlasnego modelu jezykowego",
  "trening to setki tysiecy; kupujemy wywolania, wlasna jest warstwa orkiestracji"],
 ["Kazda odpowiedz oznaczona jako wygenerowana", "AI Act art. 50, termin minal 02.08.2026"],
 ["Separacja architektoniczna, nie prompt",
  "chatbot z dostepem do danych uzytkownika przekracza granice wyrobu; rozdzielenie musi byc "
  "w architekturze, nie w instrukcji dla modelu"],
 ["Priorytetyzacja rekomendacji jest wlasna",
  "nadrzednosc zalecen kardiologicznych nad dietetycznymi — to rdzen decyzyjny, "
  "zapobiegajacy konfliktom agentow"],
 ["Jeden agent w pierwszej wersji", "Internista; zespol specjalistow dopiero pozniej"],
 ["Prawo do zakwestionowania wyniku", "warunek wykonalnosci scoringu B2B — RODO art. 22 "
  "plus AI Act zalacznik III"],
]

S15 = [
 ["Obszar", "Wymog", "Termin"],
 ["Samoidentyfikacja NIS2", "ustalenie, czy jestesmy podmiotem kluczowym czy waznym",
  "03.10.2026 — obowiazek wlasny, nikt nie wezwie"],
 ["Rejestr komponentow obcych", "zalozony od pierwszej biblioteki",
  "natychmiast — jedyna pozycja nieodtwarzalna wstecz"],
 ["Dziennik audytowy", "kto, co, kiedy, na jakiej podstawie", "od pierwszego dnia"],
 ["Zgody granularne", "per cel, odwolywalne natychmiast", "MVP"],
 ["Rezydencja danych", "Unia; klucze po naszej stronie", "MVP"],
 ["Tryb degradacji", "bezpieczne dzialanie przy niedostepnosci modelu albo chmury", "MVP"],
]

S16 = [
 ["Integracja", "Co daje", "Status"],
 ["Apple HealthKit i Google Health Connect", "urzadzenia od dnia pierwszego, bez oplat",
  "MVP"],
 ["Terra API", "dwanascie i wiecej urzadzen premium",
  "dopiero na zadanie klienta B2B; plany od 399-499 USD/mies."],
 ["e-Profil Pacjenta", "e-recepty, e-skierowania, zdarzenia, swiadczenia, slowniki ATC, "
  "ICD-10, ICD-9, ICF i ORPHANET za darmo",
  "wniosek po uzyskaniu statusu podmiotu leczniczego"],
 ["Systemy gabinetowe", "kanal sprzedazy dla P3 i P5", "2027"],
 ["Laboratoria", "katalog i przekierowanie, wynik wprowadzany recznie", "MVP w wersji taniej"],
]

S16_LUKA = ("Czego e-Profil Pacjenta nie udostepnia: wynikow badan laboratoryjnych "
 "strukturalnie, badan obrazowych i wypisow — te wchodza dopiero 26.03.2031 — oraz danych "
 "z urzadzen i pomiarow domowych, ktorych platforma panstwowa nie przyjmuje i nie przyjmie. "
 "To jest cala nasza przestrzen.")

S17 = [
 "Sprzet jest nosnikiem, nie produktem. Marza na sprzecie noszonym to 15-25%, przy naszym "
 "wolumenie blizej 15%, cykl zycia produktu 18-24 miesiace, minimalna partia to tysiace "
 "sztuk, a konkurencja ma cztery rzedy wielkosci wiekszy wolumen. Warstwa agregacji daje "
 "dzialajaca wersje w 2-3 miesiace, marze programowa i zero zamrozonego kapitalu.",
 "Do 2028 nie kupujemy sprzetu. Adrian prowadzi rozpoznanie transponderow pod linie "
 "weterynaryjna — bez zamowien. Pierwszy sprzet, ktory ma sens, to transponder Pet: "
 "poza MDR, wlasny kanal sprzedazy, tor walidacyjny dla wszystkiego pozniej.",
 "Przy umowie z producentem obowiazuje dwunastopunktowa lista kontrolna: kod zrodlowy "
 "firmware, toolchain, dostep do bootloadera, wlasne aktualizacje, dokumentacja plytki, "
 "schematy, wykaz materialowy, surowe dane z kazdego sensora, protokol komunikacyjny, "
 "SDK bez uwiazania do chmury dostawcy, prawa do modyfikacji i prawa do aktualizacji. "
 "Deklaracja, ze SDK jest dostepne, nie oznacza, ze dostajemy zrodla firmware.",
]

S18 = [
 ["Model wspolpracy", "Kiedy stosujemy", "Czego pilnujemy"],
 ["Afiliacja", "laboratoria, catering, apteki",
  "prowizja od pierwszego miesiaca; swiadome oddanie kontroli za brak kosztu budowy"],
 ["Integracja przez API", "wearables, telemedycyna",
  "adapter zawsze po naszej stronie; prog wyjscia zapisany z gory"],
 ["OEM na sprzet", "transponder, pozniej stacja",
  "cztery poziomy glebokosci; celujemy w poziom C i D, nie A"],
 ["Proxy do wyrobu z CE", "triage, EEG, diagnostyka",
  "dziala tylko gdy nie modyfikujemy wyniku i wskazujemy producenta"],
 ["Licencja komponentu", "mapper dla dostawcow systemow",
  "stajemy sie ich dostawca, nie konkurentem"],
 ["Konsorcjum badawcze", "dane jako wklad niepienieżny",
  "udzial w wyniku i w IP zamiast jednorazowej platnosci"],
]

S19 = [
 ["Tor", "Cel w 90 dni", "Wlasciciel"],
 ["A — Popyt", "piec podpisanych zobowiazan", "Maksymilian"],
 ["B — Fundacja i kaskada", "projekt statutu gotowy do podpisu", "Karol"],
 ["C — Podmiot leczniczy i P1", "wniosek RPWDL zlozony", "Karol"],
 ["D — Pierwszy produkt", "dziala u pieciu uzytkownikow", "Lukasz i Janek"],
 ["E — Zgodnosc", "NIS2, rejestr komponentow, IOD i PRRC", "Karol"],
]

S19_ZASADA = ("Zasada dwoch do trzech projektow rownoczesnie. Rozproszenie uwagi jest "
 "w rejestrze ryzyk pozycja o najwyzszym prawdopodobienstwie — wyzszym niz brak popytu.")

S20 = [
 ["Pozycja", "Kwota"],
 ["Kancelaria — statut i opinia regulacyjna", "30-60 tys. zl"],
 ["Przeglad przez druga kancelarie", "10-20 tys. zl"],
 ["Opinie prawne: retencja, farmaceutyczna, ubezpieczeniowa", "15-30 tys. zl"],
 ["Wpis do rejestru podmiotow leczniczych", "894 zl"],
 ["OC, lokal, opinia sanitarna", "20-40 tys. zl"],
 ["Certyfikat integracji z platforma panstwowa", "bezplatny"],
 ["Bazy slownikowe i licencje branzowe", "okolo 15 tys. zl rocznie"],
 ["Spotkanie przedzgloszeniowe z jednostka notyfikowana", "5-15 tys. zl"],
 ["Podroze i spotkania — czterdziesci rozmow", "5-10 tys. zl"],
 ["RAZEM, poza kosztem zespolu", "okolo 101-191 tys. zl"],
]

S20_KOSZTY = ("Struktura kosztow: wynagrodzenia 70-90%, infrastruktura 5-15%, zgodnosc "
 "i prawo 5-10%, sprzedaz 5-15%, sprzet 0% do 2028. Wynagrodzenia byly w poprzednich "
 "modelach kosztowych pominiete calkowicie — to najpowazniejszy z siedmiu bledow tamtych "
 "wycen. Prognozy pieciolatniej nie podajemy przed pierwszymi szescioma miesiacami "
 "sprzedazy; poprzednia byla zbudowana na modelu bez wynagrodzen i na konwersji "
 "konsumenckiej, ktora nie jest osia przychodu.")

S21 = [
 ["Wskaznik", "Prog", "Kiedy mierzymy"],
 ["Podpisane zobowiazania", "piec", "15.10.2026"],
 ["Placacy klienci", "pieciu", "miesiac 6"],
 ["Przychod pokrywajacy koszt zespolu", "100%", "miesiac 18"],
 ["Skutecznosc odczytu dokumentu", "ponad 90% pol bez korekty", "po tysiacu dokumentow"],
 ["Ciaglosc zapisu", "tysiac osob z nieprzerwana historia", "2029"],
 ["Placowki na komponencie interoperacyjnosci", "trzy", "koniec 2028"],
 ["Udzial ruchu przez warianty zapasowe", "1-5%", "regula, nie szacunek"],
 ["Koszt pozyskania klienta instytucjonalnego", "nie szacujemy", "mierzymy po fakcie"],
]

S22 = [
 ["Ryzyko", "Prawdopodobienstwo", "Mitygacja"],
 ["Rozproszenie uwagi na zbyt wiele frontow", "WYSOKIE",
  "zasada dwoch-trzech projektow; katalog odrzucen zapisany"],
 ["Odejscie zalozyciela z operacji bez nastepcy", "WYSOKIE",
  "rekrutacja nastepcy jako pozycja priorytetowa"],
 ["Brak popytu na pierwsza fale", "srednie", "bramka: piec zobowiazan przed budowa"],
 ["Konkurent zajmuje mapper przed nami", "srednie",
  "przychod z P3 i P4 niezalezny od mappera"],
 ["Jednostka notyfikowana klasyfikuje wyzej", "srednie",
  "spotkanie przedzgloszeniowe przed kodem"],
 ["Odciecie kluczowego dostawcy", "srednie",
  "regula jednej trzeciej, adapter, wariant zapasowy przez ktory plynie ruch"],
 ["Wpis do rejestru nieuzyskany", "niskie", "P3 i P4 go nie wymagaja — dlatego sa pierwsze"],
]

S23 = [
 ["Decyzja", "Rozstrzygniecie", "Kiedy"],
 ["Czy aplikacja pacjenta jest platna", "NIE — bezplatna w calosci", "rozstrzygniete"],
 ["Czy budujemy wlasny sprzet", "NIE do 2028; pierwszy sprzet to transponder Pet",
  "rozstrzygniete"],
 ["Czy wchodzimy w warstwe oceny", "NIE przed piecioma placacymi klientami na to samo",
  "rozstrzygniete"],
 ["Bosch czy Novo Nordisk jako wzorzec struktury", "do decyzji z kancelaria", "wrzesien 2026"],
 ["Czy Eternal swiadczy teleporade, czy tylko posredniczy",
  "OTWARTE — determinuje strukture spolek i status RPWDL", "przed Q4 2026"],
 ["Licencja Gadgetbridge", "OTWARTE — harmonogram przewiduje fork sprzeczny "
  "z zastrzezeniem licencyjnym w tej samej macierzy", "przed rozpoczeciem prac"],
 ["Ktore funkcje graniczne pojda kiedykolwiek sciezka medyczna",
  "OTWARTE — reszta zostaje wellness na stale i mozna ja zbudowac taniej", "Q4 2026"],
]

S24 = [
 ["Horyzont", "Co ma byc gotowe", "Warunek przejscia dalej"],
 ["Rok 1 — do konca 2027", "P3 Scribe i P4 Pet z przychodem powtarzalnym; wpis do RPWDL; "
  "raportowanie do platformy panstwowej; P2 Parser w wersji uzytkowej",
  "przychod pokrywajacy koszt zespolu"],
 ["Rok 3 — do konca 2029", "P5 Mapper sprzedany trzem placowkom; kohorta tysiaca osob "
  "z ciaglym zapisem; pierwsze kontrakty badawcze; dossier warstwy oceny rozpoczete",
  "wejscie w okno EEHRxF przed 26.03.2029"],
 ["Rok 5 — do konca 2031", "warstwa oceny dopuszczona; rejestr implantow jako element "
  "infrastruktury; Digital Twin z walidacja prospektywna; ekspansja na drugi rynek unijny "
  "na tej samej infrastrukturze", "walidacja prospektywna modeli"],
 ["Rok 10 — 2036", "wlasna warstwa sprzetowa tam, gdzie ekonomika ja uzasadnia; "
  "transponder u czlowieka jako wyrob klasy IIb; pozycja kontrolna w trzech dziedzinach, "
  "ktorych nie budujemy",
  "partner z ISO 13485 oraz finansowanie deep-tech co najmniej 5 mln EUR"],
]

S25 = [
 ["Zalacznik", "Zawartosc"],
 ["Rejestr funkcji", "337 pozycji: kod, nazwa, produkt, modul, etap, warstwa, klasa MDR, "
  "kanal, klasa komponentu, wariant build/buy, prog wyjscia"],
 ["Karty funkcji", "337 kart w szablonie osiemnastopolowym plus warstwa rozszerzona"],
 ["Produkty i monetyzacja", "szesc produktow z korelacji funkcji, produkty wielobranzowe, "
  "modele wykonania ekosystemu, struktura podmiotu"],
 ["Specyfikacja scalona", "kanon techniczny wraz z katalogiem granicy MDR"],
 ["Biznesplan scalony", "uklad inwestorski wraz z aparatem zrodlowym"],
 ["Roadmapa", "plan realny etapy 1-6, warstwa fabularna oddzielona"],
 ["Dziennik odczytu korpusu", "ustalenia z 159 plikow, 28,6 mln znakow"],
]
