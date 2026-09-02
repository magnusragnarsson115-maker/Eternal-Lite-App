# -*- coding: utf-8 -*-
"""Tresc dokumentu nadrzednego — 26 sekcji (00-25)."""

# (numer, tytul, [akapity albo ('T', naglowki, wiersze, szerokosci)])
S = []


def sek(nr, tyt, *tresc):
    S.append((nr, tyt, list(tresc)))


sek('00', 'Executive Summary',
 'Eternal Life buduje warstwę, która spina rozproszony rynek zdrowia cyfrowego: dane '
 'z urządzeń, dokumentację, diagnostykę laboratoryjną i usługę medyczną. Rynek jest '
 'rozproszony na cztery rozłączne obszary i **żaden dostawca nie spina więcej niż jednego** '
 '— to jest warunek istnienia orkiestratora i jednocześnie jego okazja.',
 'Produkt pacjenta jest **darmowy w całości**. Przychód pochodzi z jedenastu kanałów '
 'ustawionych za nim: prowizji marketplace, sprzedaży do przychodni i lekarzy, danych '
 'zagregowanych, API i licencji, płatników, segmentu fitness i obsługi chorób przewlekłych. '
 'Aplikacja nie jest produktem do sprzedania — jest kanałem dystrybucji dla jedenastu innych.',
 'Architektura opiera się na **bramie, która przypisuje użytkownika do dostawcy**, mierzy '
 'koszt tego przypisania i może je odebrać. Żaden dostawca nie obsługuje więcej niż jednej '
 'trzeciej użytkowników w swojej klasie. Z trzydziestu klas komponentów dwadzieścia pięć '
 'ma trzy warianty: open source, płatny i własny.',
 'Ze **%d funkcji %d jest w warstwie wellness poza MDR**, %d w warstwie klinicznej '
 'poza MDR i %d wymaga certyfikacji. Ta proporcja nie jest przypadkiem — warstwy zostały '
 'zaprojektowane tak, żeby certyfikacja dotyczyła wąskiego rdzenia, a reszta była '
 'sprzedawalna od dnia pierwszego.',
 'Z dwudziestu czterech modułów aplikacji **jedenaście da się kupić w całości** przy '
 'pokryciu 80% i wyższym. Obejmują one około 40% funkcji i są to dokładnie te funkcje, '
 'które nie są przewagą. Moduły bez kandydata rynkowego — polski parser dokumentacji, '
 'dashboard, Forge, dostępność, Bliźniak — to jednocześnie te, w których leży cała '
 'wartość własna.',
 '**Trzy ustalenia krytyczne z niezależnej analizy pozostają otwarte**: luka finansowania '
 '1,3–2,0 mln zł przed rundą A, wycena 200 mln USD odpowiadająca 45-krotności przychodu '
 'przy rynkowych 3–10, oraz skok wyceny 20–40× między pre-seed a seed. Rozstrzygnięcie '
 'ich jest warunkiem rozmowy z inwestorem, nie jej elementem.')

sek('01', 'Wizja i misja',
 '**Wizja.** Wydłużenie zdrowego życia człowieka przez system, który wie o jego zdrowiu '
 'wszystko, co da się wiedzieć, i nie oddaje tej wiedzy nikomu bez jego zgody.',
 '**Misja.** Zebrać rozproszone dane zdrowotne jednej osoby w jedno miejsce, nadać im '
 'sens i oddać je jej — za darmo, z pełną historią dostępu i z prawem do usunięcia.',
 '**Granica postawiona świadomie.** Implanty i urządzenia działają wyłącznie w trybie '
 'odczytu. Brak zdalnego sterowania funkcjami ciała, wyłącznik sprzętowy po stronie '
 'użytkownika, możliwość usunięcia. Ta granica jest utrzymana konsekwentnie w całej '
 'dokumentacji i jest elementem tożsamości produktu, nie ograniczeniem technicznym.')

sek('02', 'Cele strategiczne',
 ('T', ['Horyzont', 'Cel', 'Miara'], [
  ['2026', 'MVP w warstwie A i B, bez certyfikacji', '5 000 aktywnych użytkowników, '
   'pierwszy przychód z marketplace'],
  ['2027', 'Pierwszy klient B2B — przychodnia albo pracodawca',
   'Przychód 85 tys. zł, trzy warianty zaimplementowane w klasach K01, K04, K05'],
  ['2028–2029', 'Dossier klasy IIa dla rdzenia warstwy C; wpis RPWDL',
   'Certyfikat dla A3.5, A6.5, A6.8, D2.x; integracja z P1'],
  ['2030', 'Rentowność operacyjna', 'EBITDA dodatnia, przychód 6,5 mln zł'],
  ['2031+', 'Ekspansja i Forge jako osobny strumień', 'Przychód 18,5 mln zł'],
 ], [2.6, 7.6, 7.8]),
 'Cele są przepisane z prognoz w dokumentacji i **nie zostały przeze mnie urealnione** '
 '— ustalenia 1–3 analizy poprawności wskazują, że ścieżka finansowa między nimi ma lukę.')

sek('03', 'Problem i potrzeba rynku',
 'Dane zdrowotne jednej osoby leżą w sześciu aplikacjach producentów, z których żadna '
 'nie rozmawia z pozostałymi. Lekarz widzi wycinek. Pacjent nie widzi całości. '
 'Nikt nie widzi przebiegu.',
 'Polski wynik laboratoryjny nie ma standardu — ta sama morfologia z trzech laboratoriów '
 'ma trzy układy, trzy zestawy nazw i trzy sposoby zapisu jednostek. To jest bariera, '
 'której nie usuwa żaden dostawca zagraniczny, bo nie ma powodu jej usuwać.',
 'Wymóg interoperacyjności wchodzi w 2029 roku. Do tego czasu rynek musi mieć warstwę '
 'mapującą — i to jest okno, w którym powstaje przewaga.')

sek('04', 'Grupy użytkowników',
 ('T', ['Segment', 'Co dostaje', 'Kto płaci', 'Kanał'], [
  ['Pacjent', 'Cała aplikacja za darmo', 'Nikt — to kanał dystrybucji', 'K0'],
  ['Segment fitness', 'Planowanie, suplementacja, analiza ruchu', 'Partner sprzedający '
   'produkt', 'K10 + K5 prowizja'],
  ['Choroby przewlekłe', 'Rejestr leków, interakcje, monitoring', 'Klinika albo płatnik',
   'K11 + K7'],
  ['Lekarz i przychodnia', 'Raport SBAR, Scribe, kontekst pacjenta', 'Placówka', 'K7 B2B'],
  ['Pracodawca', 'Konto rodzinne, zdrowie kobiet i dzieci', 'Pracodawca',
   'Świadczenie pracownicze'],
  ['Płatnik i ubezpieczyciel', 'Dane zagregowane, benchmark', 'Płatnik',
   'K6 — najwyższe ryzyko regulacyjne w modelu'],
  ['Deweloper zewnętrzny', 'Komponenty i API z Forge', 'Licencjobiorca', 'K9'],
 ], [4.0, 5.6, 4.4, 4.0]))

sek('05', 'Model biznesowy',
 '**Rozstrzygnięcie: aplikacja pacjenta jest darmowa w całości.** Wersje 29,99/49,99, '
 '49 i 19–29 zł miesięcznie występujące we wcześniejszych dokumentach zostały zastąpione '
 'przez Master 5.4 i nie obowiązują.',
 'Powód nie jest ideologiczny. Darmowa aplikacja maksymalizuje bazę, a wszystkie '
 'jedenaście kanałów przychodu wymaga bazy jako warunku wstępnego. Subskrypcja '
 'ograniczyłaby bazę o rząd wielkości i zabiła dziesięć kanałów, żeby uratować jeden.',
 'KOREKTA PO ANALIZIE PLIKU #15. Darmowa aplikacja **nie wygrywa z IKP i nie ma wygrywać** '
 '— ceny zera nie da się podciąć, a IKP ma mandat ustawowy i dwadzieścia milionów kont '
 'przy zaangażowaniu 500 tys. osób miesięcznie. To jest **decyzja dystrybucyjna, '
 'nie konkurencyjna**: sprawia, że pytanie „kto wygra z IKP" przestaje być właściwym '
 'pytaniem. Wygrywamy tym, czego IKP zrobić nie może — zlecić badanie, leczyć, '
 'zinterpretować, przyjąć dane, których państwo nie ma.',
 'MECHANIZM, KTÓRY POWINIEN BYĆ OSIĄ MODELU (plik #3 i #15). Jako podmiot leczniczy '
 'zlecamy badanie → **wytwarzamy elektroniczną dokumentację medyczną → mamy do niej dostęp '
 'z mocy ustawy**, bez zgody i bez pośrednictwa IKP. Ten sam ruch, który generuje przychód, '
 'generuje dane. To jedyne miejsce w całym projekcie, gdzie pieniądze i dane przychodzą '
 'tą samą drogą.',
 'NAJWYŻEJ MARŻOWE PRODUKTY NIE SĄ SKIEROWANE DO PACJENTA (plik #122): parser dla '
 'laboratoriów, dokumentacja dla klinik, kohorta, protokół, dane nadzoru. Wszystkie '
 'powstają jako produkt uboczny czegoś, co i tak budujemy.',
 ('T', ['Kanał', 'Co sprzedajemy', 'Kiedy startuje'], [
  ['K0', 'Aplikacja pacjenta — darmowa, kanał dystrybucji', '2026'],
  ['K1', 'Subskrypcje poza rdzeniem: Pet, Legacy, immersja', '2027'],
  ['K2', 'Sprzęt i wkłady (Station, Auto-Refill)', '2028'],
  ['K3', 'API i eksport danych', '2027'],
  ['K4', 'Token i społeczność Matrix', '2029'],
  ['K5', 'Prowizja: marketplace 5–15%, telemedycyna 20–30%', '2026'],
  ['K6', 'Płatnicy i ubezpieczyciele — scoring', '2029, po rozstrzygnięciu art. 22 RODO'],
  ['K7', 'B2B lekarze i przychodnie — Scribe, raport, CDSS', '2027'],
  ['K8', 'Granty i licencjonowanie IP z Fundacji do spółki', '2027'],
  ['K9', 'Forge — licencje na komponenty i API', '2028'],
  ['K10', 'Fitness, suplementacja, dieta', '2026'],
  ['K11', 'Choroby przewlekłe i zdrowie psychiczne — B2B klinika', '2028'],
 ], [1.6, 9.4, 7.0]),
 '**Ustalenie otwarte.** Wartość życiowa klienta 1200–2000 zł przy koszcie pozyskania '
 '80–120 zł była liczona dla subskrypcji, której w tym modelu nie ma. Trzeba ją '
 'przeliczyć jako sumę marży z kanałów K3–K11 przypadającej na użytkownika. '
 'Do czasu przeliczenia nie należy pokazywać zwrotu 15-krotnego — jest nieporównywalny.')

sek('06', 'Ekosystem Eternal',
 'Pięć produktów w jednym systemie danych: **Aplikacja** (mózg — agregacja, interfejs, '
 'monetyzacja), **Station** (diagnostyka domowa), **Capsule** (monitoring '
 'wewnątrzustrojowy), **Digital Twin** (predykcja), **Matrix** (społeczność i immersja).',
 '**Czego nie oddajemy nigdy** — lista z korpusu, niezależna od wybranej ścieżki '
 'technologicznej: Aplikacja, Fundacja jako właściciel IP, polski parser dokumentacji, '
 'silnik normalizacji, silnik score, Bliźniak przyczynowy, Bio-Weather Intelligence, '
 'symulator wieku biologicznego oraz struktura instytucjonalna.',
 '**Capsule najpierw jest platformą, a dopiero potem implantem.** Platforma agreguje '
 'systemy ciągłego pomiaru glukozy, urządzenia noszone i biosensory przez bramę. '
 'Kiedy partner dostarczy sensor, wchodzi do gotowej platformy jako kolejna implementacja '
 'zdolności. To jest odpowiedź na pytanie, jak zbudować Capsule tanio i nie stracić kontroli: '
 '**nie budować sensora, zbudować platformę, do której sensor się podłącza.**',
 '**Czy Station jest potrzebna.** Nie jako warunek startu. Roadmapa v4 stawia dwa tory: '
 'własny sprzęt (800 tys. – 2,5 mln zł CAPEX, 12–24 miesiące do MVP) i partnerskie '
 'laboratoria (50 tys. zł integracji, start możliwy od zaraz). Rekomendacja korpusu: '
 '**zacząć od laboratoriów, prowadzić R&D Station równolegle.** Laboratoria walidują popyt '
 'i dają przychód natychmiast; Station buduje moat długoterminowy. Wariant, w którym '
 'certyfikujemy cudze urządzenia zamiast produkować własne, jest najtańszy, najszybszy '
 'i zgodny z całą pozostałą architekturą, w której jesteśmy orkiestratorem.')

sek('07', 'Produkty',
 ('T', ['Produkt', 'Modułów', 'Funkcji', 'Etap wiodący', 'Rola w modelu'], [
  ['Eternal App', '24', '186', 'MVP', 'Kanał dystrybucji i baza dla wszystkich kanałów'],
  ['Eternal Station', '6', '35', 'MLP', 'Sprzęt i wkłady — kanał K2'],
  ['Eternal Capsule', '5', '42', 'FINAL', 'Platforma, potem implant — najdłuższy horyzont'],
  ['Eternal Digital Twin', '5', '36', 'MLP', 'Predykcja — jedyna funkcja uzasadniająca '
   'wycenę wyższą niż agregator'],
  ['Eternal Matrix', '3', '23', 'FINAL', 'Społeczność i immersja — w większości '
   'oznaczone w korpusie jako fikcja'],
 ], [4.0, 2.0, 2.0, 3.0, 7.0]))

sek('08', 'Moduły — co budujemy, czym zarządzamy, co agregujemy',
 'To jest odpowiedź na pytanie postawione wprost: ile z tego można kupić i ile kontroli '
 'zostaje przy każdym wariancie. Postawa wynika z pokrycia, jakie daje najlepszy '
 'kandydat rynkowy, a nie z preferencji.',
 ('T', ['Postawa', 'Modułów', 'Kiedy', 'Kontrola (mediana)'], [
  ['AGREGUJEMY', '11', 'Kandydat pokrywa 80% modułu i więcej — kupujemy dostęp, '
   'zostawiamy sobie warstwę danych i decyzję', '74%'],
  ['ZARZĄDZAMY', '24', 'Kandydat pokrywa 30–79% — kupujemy komponenty, moduł składamy sami',
   '100%'],
  ['BUDUJEMY', '8', 'Brak kandydata albo pokrycie poniżej 30% — moduł jest produktem '
   'albo moatem', '100%'],
 ], [3.0, 2.0, 9.0, 3.0]),
 '**Pierwszy wniosek: moduły, które da się kupić, to moduły, których nie warto budować '
 '— i odwrotnie.** Jeśli coś jest dostępne u trzech dostawców, konkurencja też to kupi '
 'i nie zbudujesz na tym przewagi. Jeśli czegoś nie ma na rynku, to albo nie ma popytu, '
 'albo jest to trudne — i wtedy zbudowanie tego jest jedyną przewagą, jaką da się mieć. '
 'Moduły bez kandydata to dokładnie polski parser dokumentacji, dashboard, Forge, '
 'dostępność i Bliźniak.',
 '**Drugi wniosek jest ważniejszy i nieoczywisty: agregacja całego modułu sama w sobie '
 'nie kosztuje kontroli.** Mediana kontroli przy agregacji wynosi 74%, a nie 30%. '
 'Kontrolę traci się z trzech innych powodów: braku adaptera, braku własnej kopii danych '
 'i oddania dostawcy wniosku końcowego. Pierwsze dwa są błędem. Trzeci bywa decyzją słuszną.',
 ('T', ['Moduł', 'Kontrola', 'Dlaczego niżej', 'Czy to problem'], [
  ['A5 Telemedycyna', '57%', 'Wniosek należy do lekarza', 'NIE — opinia lekarska ma '
   'należeć do lekarza. Przejęcie jej czyni z nas świadczeniodawcę'],
  ['A8 Zdrowie psychiczne', '57%', 'Wniosek należy do terapeuty', 'NIE — z tego samego '
   'powodu. Ale detektor kryzysu musi zostać u nas'],
  ['A12 Scribe', '57%', 'Notatka należy do lekarza', 'NIE — my dostarczamy narzędzie, '
   'nie treść'],
  ['A6 Triage', '69%', 'Ocena należy do dostawcy z CE', 'NIE, dopóki nie dopisujemy '
   'własnej oceny. Dopisanie jej to wyzwalacz W5'],
  ['A19 Interakcje leków', '69%', 'Baza interakcji jest licencjonowana', 'NIE — reguły '
   'łączenia z pacjentem zostają nasze'],
  ['A17 Skaner posiłków', '68%', 'Rozpoznanie należy do SDK', 'NIE — trafność 30–40% '
   'i tak nie pozwala deklarować dokładności'],
  ['S2 Diagnostyka biochemiczna', '69%', 'Wynik należy do laboratorium', 'NIE — to jest '
   'model proxy i on ma tak działać'],
  ['C5 Terapia wewnątrzustrojowa', '69%', 'Dawka należy do producenta pompy', 'NIE — '
   'przejęcie jej to najwyższa klasa ryzyka w ekosystemie'],
 ], [4.6, 2.0, 4.4, 6.0]),
 '**Wszystkie dziewięć przypadków niskiej kontroli to przypadki, w których wniosek '
 'kliniczny należy do kogoś innego — i we wszystkich dziewięciu jest to właściwe.** '
 'Przejęcie wniosku podnosi kontrolę na papierze i czyni z nas producenta wyrobu '
 'w rzeczywistości. To jest jedyne miejsce w całej architekturze, w którym niższa '
 'kontrola jest celem, a nie kosztem.')

sek('09', 'Funkcje',
 'Rejestr obejmuje %d funkcji w 43 modułach. Każda ma przypisaną klasę komponentu, '
 'warstwę zgodności, etap, wymóg certyfikacji, czas wyjścia i próg zmiany modelu — '
 'wykonuje to polecenie zapisane w Master 5.4 i nigdy dotąd niewykonane.',
 'Pełny rejestr znajduje się w macierzy komponentów (arkusz „Funkcje-komponenty"), '
 'a karty modułowe — w Product Requirements Document.',
 '**Duplikacja w efekcie końcowym**, nie w działaniu: dwanaście grup funkcji o różnych '
 'mechanizmach daje ten sam rezultat dla użytkownika (pomiar glukozy ze Station i z Capsule, '
 'telemedycyna z aplikacji i ze stacji, trzy drogi do wezwania pomocy). To nie są duplikaty '
 'do usunięcia — to są ścieżki alternatywne. Ale liczyć je jako osobne funkcje w wycenie '
 'produktu byłoby zawyżaniem.')

sek('10', 'Priorytety i roadmapa produktu',
 ('T', ['Priorytet', 'Modułów', 'Które', 'Kryterium'], [
  ['P0', '7', 'A1, A2, A3, A4, A14, A18, D1', 'Bez nich produkt nie działa ani nie jest legalny'],
  ['P1', '14', 'A5–A8, A10, A12, A17, A19–A24, D2, D5, S1',
   'Decydują o przychodzie albo o zgodności'],
  ['P2', '22', 'Pozostałe', 'Etap docelowy'],
 ], [2.2, 2.0, 7.8, 5.0]))

sek('11', 'Regulacje i compliance',
 ('T', ['Reżim', 'Co obejmuje', 'Kiedy'], [
  ['MDR 2017/745', '%d funkcji w warstwie C — dossier klasy IIa albo proxy do cudzego CE',
   '2028–2029'],
  ['MDCG 2019-11', 'Klasyfikacja funkcji granicznych; świadome wyłączenie funkcji MDSW',
   'Przed pierwszym klientem B2B'],
  ['RODO art. 9 i 32', 'Dane szczególnej kategorii, rozdzielenie zgód, DPIA', 'Od dnia 1'],
  ['RODO art. 17', 'Prawo do usunięcia — konflikt z niezmiennością rejestru rozproszonego. '
   'Na łańcuchu wyłącznie hasze, nigdy dane', 'Od dnia 1'],
  ['RODO art. 22', 'Scoring dla płatników to zautomatyzowana decyzja o skutku prawnym. '
   'Zgoda odrębna, ścieżka odwoławcza do człowieka', 'Przed kanałem K6'],
  ['AI Act 2024/1689', 'Załącznik III — system wysokiego ryzyka. Oznaczanie treści '
   'generowanej wg art. 50', 'Obowiązek od 2.08.2026'],
  ['EHDS 2025/327', 'Interoperacyjność i wtórne wykorzystanie danych', 'Rynek od 26.03.2029'],
  ['NIS2 / KSC', 'Zarządzanie incydentami i łańcuchem dostaw', '2026–2027'],
  ['Akt o dostępności', 'WCAG 2.2, EN 301 549 — moduł A23', 'Obowiązuje od 06.2025'],
  ['ISO 13485 / 14971', 'System jakości i zarządzanie ryzykiem — warunek dossier', '2028'],
 ], [4.4, 9.6, 3.0]),
 '**AI Act jest osobnym reżimem obok MDR, nie jego częścią.** W pitch decku nie występuje '
 'wcale — to jest ustalenie 7 analizy poprawności i pozostaje otwarte.',
 'PARADOKS AGREGACJI (plik #88). **Bezpieczeństwo regulacyjne modelu agregacyjnego jest '
 'odwrotnie proporcjonalne do jego wartości produktowej.** Czysta rura jest legalna '
 'i mało warta. Warstwa decyzyjna jest warta dużo i jest wyrobem. Model agregacyjny '
 'nie omija certyfikacji — **odracza ją**.',
 'SZEŚĆ CZASOWNIKÓW — operacyjny test granicy, ostrzejszy niż podział na warstwy: '
 '**zbiera, normalizuje, łączy** (jako zestawienie obok siebie) są bezpieczne; '
 '**automatyzuje, personalizuje** to granica; **jedna warstwa decyzyjna to jest wyrób**.',
 'REGUŁA PRODUKTOWA W JEDNYM ZDANIU (plik #122): **fakt i porównanie do własnej historii '
 'są bezpieczne regulacyjnie; ocena, próg i zalecenie nie są.** Ta sama funkcja po jednej '
 'stronie granicy jest darmowa, po drugiej kosztuje dossier.',
 'WARSTWA OCENY JEST PRZEKROJEM PRZEZ MODUŁY, NIE MODUŁEM (plik #123). Żaden z modułów '
 'pierwszej fali nie jest wyrobem. Rozdzielenie tych dwóch rzeczy pozwala sprzedawać '
 'od pierwszego dnia — i zmienia sposób liczenia zakresu dossier: nie „które moduły", '
 'tylko „która warstwa w których modułach".')

sek('12', 'IP i własność technologiczna',
 'Właścicielem kluczowego IP jest Fundacja, która licencjonuje je do spółki operacyjnej '
 'na royalty 5–15%. Struktura jest wariantem modelu Novo Nordisk: fundacja zobowiązana '
 'do utrzymania kontroli, nie tylko do niej uprawniona.',
 '**Brakująca warstwa — spółka wykonująca własność.** U Novo fundacja nie steruje '
 'bezpośrednio; steruje przez Novo Holdings, na podstawie mandatu w statucie. Powód jest '
 'nazwany w korpusie: *zarządy fundacji są dobierane pod misję i filantropię, nie pod ocenę '
 'przedsiębiorczą; przez dekady dryfują ku pierwszemu. Jeśli fundacja steruje bezpośrednio, '
 'dryf zarządu jest dryfem firmy.*',
 '**Ryzyko licencyjne — nieobecne w rejestrze ryzyk, a realne.** Gadgetbridge na AGPL-3.0 '
 'blokuje model komercyjny i fork tego nie zmienia. OpenPose ma licencję niekomercyjną. '
 'wger jest na AGPL-3.0. Open Food Facts na ODbL wymaga udostępnienia bazy pochodnej. '
 'Unity ma najgorszy profil licencyjny w projekcie. **Audyt licencji przed każdą integracją '
 'jest wymogiem, nie dobrą praktyką.**')

sek('13', 'Dane',
 'Architektura privacy-first: surowe dane zostają na urządzeniu, do chmury trafia wynik. '
 'Rezydencja UE obowiązkowa, backup w drugiej lokalizacji UE, klucze po naszej stronie.',
 '**Eternal Standard** jest modelem nadrzędnym wobec FHIR. Serwer FHIR jest wymienny '
 '(Medplum, HAPI, Aidbox, Firely) — mapper nie jest. Wersjonowanie semantyczne mapowania '
 'i jedna osoba z prawem weta na zmiany.',
 '**Proweniencja przy każdym zapisie**: które źródło, kiedy, jaką ścieżką. Bez niej '
 'rozbieżność między dwoma źródłami tego samego parametru jest nierozstrzygalna.',
 '**Dane zagregowane i syntetyczne** (moduł D5) pozwalają sprzedać wiedzę bez sprzedania '
 'danych i odblokowują demo inwestorskie. Metodyka anonimizacji przesądza o legalności '
 'całego kanału K3.')

sek('14', 'AI',
 'Abstrakcja dostawcy od dnia pierwszego: jeden interfejs, trzy backendy. Żaden prompt '
 'nie zawiera danych zdrowotnych bez umowy powierzenia.',
 '**Reguły przed modelem.** Reguły jawne i wersjonowane da się audytować i obronić przed '
 'regulatorem; modelu uczonego nie. Wersja reguły zapisana przy każdym wyniku — bez tego '
 'nie da się odtworzyć podstawy oceny.',
 'RAG na własnym korpusie (PubMed, ChPL, URPL, wytyczne towarzystw) z przypisami do źródeł. '
 'Korpus jest własny zawsze — to on decyduje o jakości odpowiedzi, nie silnik wektorowy.',
 '**Granica produktowa**: asystent odpowiada na pytania o dane i o wiedzę. Nie stawia '
 'diagnozy, nie zaleca leczenia i nie prowadzi terapii. Przekroczenie tej granicy '
 'to wyzwalacz W3 — funkcja przechodzi do warstwy C.')

sek('15', 'Cybersecurity',
 ('T', ['Obszar', 'Rozwiązanie'], [
  ['Szyfrowanie', 'TLS 1.3 w tranzycie, AES-256 at-rest, klucze w magazynie po naszej stronie'],
  ['Dostęp', 'RBAC + ABAC na zakresach zgód; dostęp lekarza czasowy i odwoływalny'],
  ['Dziennik', 'IHE ATNA — kto, co, kiedy, na jakiej podstawie; widoczny dla użytkownika'],
  ['Łańcuch dostaw', 'Zestawienie składników oprogramowania (SBOM), audyt licencji '
   'przed integracją, NIS2'],
  ['Incydenty', 'Procedura zgłoszenia, retencja materiału dowodowego, obowiązki wobec '
   'organu nadzorczego'],
  ['Ciągłość', 'Tryb degradacji przy odciętym dostawcy; backup w drugiej lokalizacji UE'],
  ['Post-quantum', 'NIE deklarować wdrożenia. Prawdziwe i obronne sformułowanie: '
   'architektura kryptograficzna przygotowana na wymianę algorytmów, migracja '
   'po standaryzacji NIST'],
 ], [3.6, 13.4]))

sek('16', 'Integracje — brama Eternal',
 'Brama ma cztery funkcje, nie jedną: **przypisanie** użytkownika do dostawcy przy '
 'rejestracji, **wywołanie** wyłącznie przez adapter, **pomiar** kosztu per użytkownik '
 'i **odebranie** — prawo przeniesienia bez zmiany w kodzie i bez udziału dostawcy.',
 'Wybór dostawcy przechodzi przez cztery filtry w tej kolejności: **zgodność → możliwość '
 '→ udział 33% → koszt**. Odwrócenie kolejności jest najczęstszym sposobem, w jaki taka '
 'architektura łamie prawo bez niczyjej złej woli.',
 'Szczegóły — dokument „Architektura komponentów i brama dostawców" oraz macierz '
 'komponentów.')

sek('17', 'Hardware i software',
 '**Software**: Flutter na froncie, FastAPI na backendzie, PostgreSQL z pgvector, '
 'Medplum jako serwer FHIR, Keycloak jako tożsamość, RabbitMQ jako kolejka, '
 'Kubernetes jako środowisko. Wszystko na licencjach dopuszczających użycie komercyjne.',
 '**Hardware**: moduł OEM plus własne oprogramowanie układowe. Firmware cudzy oznacza '
 'brak dostępu do dokumentacji przy certyfikacji — a bez dokumentacji nie ma dossier. '
 'Zacząć od Pet Bio-Tag, gdzie nie ma ściany MDR.',
 '**Rekomendacja dla Station**: certyfikacja cudzych urządzeń zamiast własnej produkcji. '
 'Wariant dzierżawy wchodzi dopiero, gdy urządzenie własne ma udowodniony popyt. '
 'Wariant podstawowy — własna produkcja od początku — nigdy jako pierwszy.')

sek('18', 'Partnerstwa, OEM, API i SDK',
 'Trzy modele integracji cudzego narzędzia, każdy z inną odpowiedzialnością:',
 ('T', ['Model', 'Szczebel', 'Kto widnieje', 'Kontrola', 'Rola wg MDR'], [
  ['OEM / API', '2', 'Dostawca', '25–45%', 'Żadna — odpowiada dostawca'],
  ['Partnerstwo osadzone', '3', 'Obie marki', '55–70%', 'Zależna od przeznaczenia'],
  ['Marka własna', '4', 'Tylko my', '75–85%', 'PRODUCENT — dossier, PRRC, EUDAMED'],
 ], [4.2, 2.0, 3.0, 2.4, 5.4]),
 '**Reguła, którą korpus odkrył przy Infermedice i która obowiązuje ogólnie**: '
 'zintegrowanie cudzego wyrobu z oznakowaniem CE **nie przenosi na nas jego certyfikatu**. '
 'Zapisano najpierw „Infermedica ma CE", a potem poprawiono na „klasa IIb pod MDR — '
 'odpowiedzialność za certyfikację produktu końcowego po stronie integratora". '
 'Nasz produkt końcowy jest osobnym wyrobem, jeśli ma własne przeznaczenie medyczne.',
 'Wykaz kandydatów na całe moduły z pokryciem, kontrolą i warunkiem zmiany postawy '
 '— w Product Requirements Document, karta budowy przy każdym module.')

sek('19', 'Model operacyjny i ład korporacyjny',
 '**Struktura**: Fundacja (właściciel IP, złota akcja, weto misyjne) → spółka wykonująca '
 'własność → spółka operacyjna PSA z głosami 10:1 → holding. To jest wariant modelu '
 'Novo Nordisk, nie Boscha.',
 '**Dlaczego nie Bosch 1:1.** U Boscha fundacja ma 92–94% kapitału i 1% głosów, a steruje '
 'osobny trust przemysłowy z 93% głosów. To rozdzielenie działa, ale wymaga instytucji, '
 'której w polskim prawie nie ma w tej formie. Model Novo — fundacja **zobowiązana** '
 'statutem do utrzymania kontroli, z czterema zamkami na cztery różne sposoby jej utraty '
 '— daje ten sam efekt w prawie polskim, przez PSA z uprzywilejowaniem głosowym.',
 '**Odpowiedź na pytanie o rolę założyciela.** Cała ta struktura istnieje po to, żeby '
 'założyciel nie musiał być prezesem. Rozdzielenie kapitału od głosu oznacza, że kontrola '
 'nad kierunkiem nie wymaga zarządzania operacyjnego. Konkretnie: **weto misyjne '
 'w Fundacji, uprzywilejowanie głosowe w PSA i mandat wpisany do statutu wystarczają '
 'do zachowania kierunku bez fotela prezesa** — pod trzema warunkami.',
 ('T', ['Warunek', 'Dlaczego bez tego nie działa'], [
  ['Umowa założycielska z vestingiem 4 lata i cliffem rocznym',
   'Bez niej odejście z operacji jest odejściem z firmy'],
  ['Plan sukcesji prezesa spisany zawczasu — dokument „co jeśli" w sejfie Fundacji',
   'Sukcesja improwizowana w kryzysie oddaje kontrolę temu, kto akurat jest pod ręką'],
  ['Statut, który zobowiązuje zarząd Fundacji do udaremniania rozwodnienia, '
   'a nie tylko mu na to pozwala',
   'Novo ma cztery takie zapisy. „Fundacja może utrzymać kontrolę" nie jest ochroną'],
 ], [7.0, 10.0]),
 'ROLA, KTÓRA DAJE KONTROLĘ BEZ PREZESURY (plik #23), nazwana wprost: **nie prezes spółki '
 'operacyjnej, tylko przewodniczący podmiotu, który posiada IP i trzyma weto, plus autor '
 'standardu.** Odwołanie licencji boli tylko wtedy, gdy przedmiotem jest standard, rejestr '
 'albo dossier — rzecz, której nie da się odtworzyć bez powtórzenia całej drogi. '
 'Kod się przepisze w rok.',
 'DWA BRAKI, KTÓRYCH NIE MA W PLANIE (plik #71). Po pierwsze: skoro założyciel odchodzi '
 'z operacji po MVP, **MVP jest kamieniem milowym przekazania, nie produktu** — wszystko '
 'musi dać się prowadzić bez niego. Po drugie: **następca operacyjny nie istnieje**, '
 'a jego wprowadzenie wymaga dwóch–trzech lat wspólnej pracy. Zaczynając szukać w 2028, '
 'odchodzi się w 2031. To najpilniejsza rekrutacja w całym przedsięwzięciu.',
 'MECHANIZM FINANSOWANIA CELÓW DALEKICH (pliki #71 i #120): **stały, zapisany w statucie '
 'odsetek przychodu przekazywany automatycznie na fundusz badawczy, którym dysponuje RADA, '
 'a nie zarząd.** Zarząd operacyjny nigdy nie sfinansuje badań o horyzoncie dwudziestoletnim '
 '— nie ze złej woli, tylko dlatego, że jest rozliczany z czegoś innego.',
 '**Ostrzeżenie z korpusu, dosłownie**: *statutu Fundacji nie da się nadrobić, bo jego '
 'wartość zależy od tego, kto ma siłę go narzucić w momencie podpisania. Bosch '
 'przebudowywał ład korporacyjny dwadzieścia pięć lat przed śmiercią — nie dlatego, '
 'że lubił papiery, tylko dlatego, że wtedy jeszcze mógł zdecydować sam.* '
 'Przy pierwszym inwestorze siła negocjacyjna spada. To jest praca na teraz.')

sek('20', 'Finanse',
 ('T', ['Pozycja', '2027', '2028', '2029', '2030', '2031', 'Razem'], [
  ['Przychody (mln zł)', '0,085', '0,513', '1,97', '6,50', '18,50', '27,57'],
  ['EBITDA (mln zł)', '−1,62', '−2,45', '−3,19', '−0,85', '+1,56', '−6,55'],
  ['Skumulowana strata', '−1,62', '−4,07', '−7,26', '−8,11', '—', '−8,11'],
  ['Kapitał do rundy A', '0,11 + 6,0÷6,7', '', '', '', '', '6,11÷6,81'],
  ['LUKA', 'runda A bez daty', '', '', '', '', '1,30÷2,00'],
 ], [4.4, 2.6, 2.0, 2.0, 2.0, 2.0, 2.0]),
 '**Trzy ustalenia krytyczne pozostają otwarte** i są warunkiem rozmowy z inwestorem: '
 'luka 1,3–2,0 mln zł, wycena 200 mln USD odpowiadająca 45-krotności przychodu przy '
 'rynkowych 3–10, oraz skok wyceny 20–40× między pre-seed a seed przy jednym kamieniu '
 'milowym.',
 '**Największa pozycja kosztowa nie występuje w rejestrze kosztów: wynagrodzenia.** '
 'Wśród siedemnastu kosztów stałych nie ma ani jednego. Test spójności: MVP za 150–200 tys. zł '
 'przez 12–18 miesięcy to 10–13 tys. zł miesięcznie na cały zespół.',
 'SPRZECZNOŚĆ DO ROZSTRZYGNIĘCIA, NIE DO PRZEMILCZENIA (plik #69). Korpus zawiera '
 'ustalenie wprost przeciwne do planu rundy seed: **nie brać kapitału venture do '
 'spółki-matki** — jest strukturalnie sprzeczny z horyzontem trzydziestoletnim. '
 'Jeśli w ogóle, to wyłącznie do wydzielonych spółek celowych pod konkretne produkty '
 'sprzętowe. Trzydziestoletnie przedsięwzięcie utrzymuje **przepływ gotówki, nie kapitał**: '
 'trzeba mieć działalność przynoszącą pieniądze co miesiąc, niezależnie od tego, '
 'czy wizja postępuje. Plan seed 6,0–6,7 mln zł i to ustalenie nie mogą obowiązywać naraz.')

sek('21', 'KPI',
 ('T', ['Wskaźnik', 'Co mierzy', 'Próg'], [
  ['Udział dostawcy w klasie', 'Egzekwowalność reguły 33%', 'Ostrzeżenie 25%, twardy 33%'],
  ['Warianty żywe per klasa', 'Czy plan wyjścia jest realny', 'Min. 1 wariant z 1–5% ruchu'],
  ['Koszt dostawców na użytkownika', 'Marża jednostkowa', 'Poniżej progu wyjścia klasy'],
  ['Czas wyjścia rzeczywisty', 'Czy adapter działa', 'Zgodny z kartą funkcji'],
  ['Funkcje w warstwie C bez dossier', 'Ekspozycja regulacyjna', 'Zero po 2029'],
  ['Pokrycie dziennika audytowego', 'Gotowość na kontrolę', '100% wywołań zewnętrznych'],
  ['Aktywni użytkownicy', 'Baza dla wszystkich kanałów', '5 000 w 2026'],
  ['Konwersja na kanał przychodowy', 'Czy darmowa aplikacja zarabia', 'Do ustalenia '
   'po pierwszym kwartale marketplace'],
 ], [5.0, 6.0, 6.0]),
 'Licznik reguły 33% jest osobnym wymaganiem wobec monitoringu. Bez niego reguła '
 'nie jest egzekwowalna, tylko zadeklarowana.')

sek('22', 'Ryzyka',
 ('T', ['Ryzyko', 'Waga', 'Odpowiedź'], [
  ['Luka finansowania przed rundą A', 'KRYTYCZNE', 'Data rundy A albo seed 8–8,5 mln zł '
   'albo cięcie kosztów 2029'],
  ['Wycena bez pokrycia w prognozie', 'KRYTYCZNE', 'Urealnić do 20–45 mln USD albo pokazać '
   'prognozę 2032–2033'],
  ['Scoring dla płatników wobec art. 22 RODO', 'WYSOKIE', 'Zgoda odrębna i odwoływalna, '
   'ścieżka do człowieka, DPIA'],
  ['Ryzyko licencyjne (AGPL, licencje niekomercyjne)', 'WYSOKIE', 'Audyt licencji przed '
   'każdą integracją; rejestr ryzyk rozszerzony'],
  ['Koncentracja dostawcy powyżej 33%', 'ŚREDNIE', 'Licznik w monitoringu, migracja '
   'w oknach'],
  ['Redundancja pozorna — trzej dostawcy, jedna technologia', 'ŚREDNIE', 'Drugi licznik '
   'na poziomie technologii źródłowej'],
  ['Utrata dostępu do P1 albo brak RPWDL', 'ŚREDNIE', 'Reguła 33% nie działa — '
   'odpowiedzią jest stanie się niezbędnym'],
  ['Moderacja treści zdrowotnych w społeczności', 'ŚREDNIE', 'Etat częściowy jako koszt '
   'stały, nie jednorazowy'],
  ['Rozbieżność zespołu i siedziby między dokumentami', 'NISKIE', 'Uzgodnić jedną wersję '
   'przed wysyłką do inwestora'],
 ], [6.4, 2.4, 8.2]))

sek('23', 'Decyzje strategiczne — otwarte',
 ('T', ['#', 'Decyzja', 'Dlaczego teraz', 'Kto'], [
  ['1', 'Data rundy A albo podniesienie seed', 'Bez tego model kończy gotówkę w 2029',
   'Założyciel + CFO'],
  ['2', 'Czy wydajemy własną ocenę kliniczną', 'Trzy „tak" dają jeden model, trzy „nie" '
   'inny, mieszanka daje sprzeczność', 'Założyciel'],
  ['3', 'Czy sprzęt nosi naszą markę', 'Logo na obudowie czyni z nas producenta — '
   'koszt w setkach tysięcy', 'Założyciel'],
  ['4', 'Czy użytkownik widzi nazwy dostawców', 'Jeśli nie widzi, odpowiadamy my',
   'Product + Legal'],
  ['5', 'Wariant ładu: Novo (rekomendowany) czy Bosch', 'Siła narzucenia statutu '
   'spada przy pierwszym inwestorze', 'Założyciel + Fundacja'],
  ['6', 'Kolejność Station: własny sprzęt czy laboratoria partnerskie',
   'Rekomendacja korpusu: laboratoria pierwsze, R&D równolegle', 'Założyciel + CTO'],
  ['7', 'Czy kanał K6 (płatnicy) wchodzi do modelu', 'Najwyższe ryzyko regulacyjne '
   'w całym modelu przychodowym', 'Założyciel + Legal'],
  ['8', 'Przeliczenie LTV per segment po przyjęciu modelu darmowego',
   'Obecne LTV jest nieporównywalne z modelem', 'CFO'],
 ], [1.0, 5.4, 7.6, 3.0]))

sek('24', 'Roadmapa 1–3–5–10 lat',
 ('T', ['Horyzont', 'Produkt', 'Regulacje', 'Organizacja', 'Przychód'], [
  ['1 rok (2026)', 'MVP: A1–A4, A14, A18, D1. Warstwa A i B. Marketplace od '
   'pierwszego miesiąca', 'MDCG 2019-11 dla funkcji granicznych; AI Act art. 50 '
   'od sierpnia', 'Statut Fundacji i umowa założycielska — teraz, dopóki jest siła '
   'narzucenia', '85 tys. zł'],
  ['3 lata (2028)', 'A5–A12, A17, A19–A24. Station przez laboratoria partnerskie. '
   'Pet Bio-Tag jako poligon firmware', 'Dossier klasy IIa w przygotowaniu; ISO 13485; '
   'wniosek RPWDL', 'Spółka wykonująca własność; pierwszy zespół regulacyjny', '1,97 mln zł'],
  ['5 lat (2030)', 'Digital Twin D2 z certyfikacją. Station własna po udowodnionym '
   'popycie. Forge jako osobny strumień', 'Certyfikat IIa; integracja P1; EHDS od 2029',
   'Rentowność operacyjna; holding', '6,5 mln zł'],
  ['10 lat (2035)', 'Capsule jako platforma z sensorem partnera. Ekspansja poza Polskę. '
   'Matrix', 'Klasa IIb dla implantu — realnie po 2033', 'Struktura międzynarodowa',
   'Poza horyzontem prognozy'],
 ], [2.6, 5.4, 4.4, 4.0, 2.6]),
 '**Harmonogram implantów jest wewnętrznie sprzeczny w dokumentacji źródłowej**: deck '
 'obiecuje pilotaż Bio-Tag i Bio-Monitor w latach 2028–2029, a własna specyfikacja '
 'wskazuje klasę IIb/III i certyfikację realnie po 2033. Różnica to cztery do pięciu lat. '
 'W tej roadmapie przyjęto wersję ze specyfikacji.')

sek('25', 'Załączniki',
 ('T', ['Dokument', 'Format', 'Co zawiera'], [
  ['ETERNAL_SPECYFIKACJA_SCALONA', 'DOCX', 'Specyfikacja wg źródeł, kanon Master 5.4'],
  ['ETERNAL_SPECYFIKACJA_TEMATYCZNA', 'DOCX', '16 zagadnień przekrojowych'],
  ['ETERNAL_BIZNESPLAN_SCALONY', 'DOCX', 'Biznesplan z 77 plików korpusu'],
  ['ETERNAL_PRD', 'DOCX', '43 karty PRD i karty budowy — ten pakiet'],
  ['ETERNAL_ARCHITEKTURA_KOMPONENTOW', 'DOCX', 'Brama, reguła 33%, certyfikacja'],
  ['ETERNAL_MACIERZ_KOMPONENTOW', 'XLSX', 'Funkcje × komponenty × dostawcy × warstwa'],
  ['ETERNAL_MACIERZ_FUNKCJI', 'XLSX', 'Monetyzacja, potrzeba, duplikacja w efekcie'],
  ['ETERNAL_ANALIZA_POPRAWNOSCI', 'DOCX', '14 ustaleń, 3 krytyczne'],
  ['ETERNAL_INDEKS_ZRODEL', 'DOCX', '159 plików korpusu w 4 sekcjach'],
  ['ETERNAL_ROADMAPA_SCALONA / _APLIKACJA', 'HTML', 'Roadmapy interaktywne'],
  ['ETERNAL_PITCH_APLIKACJA / _EKOSYSTEM', 'PPTX', 'Pitch decki 12 i 26 slajdów'],
 ], [7.0, 2.0, 8.0]))
