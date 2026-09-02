# -*- coding: utf-8 -*-
"""Ustalenia z 55 plikow, ktore nie wystepuja w rejestrze funkcji.

Pliki bez kodow funkcji wypadly z rejestru, a wiec i z rozumowania przy budowie
dokumentow analitycznych. Ich tresc byla w specyfikacji scalonej — nie byla
w zadnym wniosku. Ponizej to, co z nich wynika, z numerem pliku przy kazdej pozycji.

Kategorie:
  KOREKTA  — obala albo poprawia twierdzenie z wczesniejszych dokumentow
  ROZSTRZ  — rozstrzyga sprawe otwarta
  NOWE     — wnosi tresc nieobecna gdzie indziej
  RYZYKO   — wskazuje zagrozenie nieujete w rejestrze ryzyk
"""

# (kod, kategoria, tytul, ustalenie, co zmienia, pliki)
U = [
# ---------------------------------------------------- certyfikacja i agregacja
('C1', 'KOREKTA', 'Agregacja nie omija certyfikacji — odracza ją',
 'Model agregacyjny nie jest sposobem na uniknięcie certyfikacji. Jest sposobem na jej '
 'ODROCZENIE i na zbudowanie w międzyczasie czegoś, czego certyfikacja nie dotyczy. '
 'Kupujesz: szybkie wejście, brak kosztu dossier, brak kolejki do jednostki notyfikowanej, '
 'przychód od pierwszego roku.',
 'Wszystkie dokumenty mówiące „63 funkcje wymagają certyfikacji" muszą dodać: '
 'a pozostałe 274 są bezpieczne tylko dopóki nie wydają oceny.', '#88'),

('C2', 'KOREKTA', 'Nie ma czego agregować „z certyfikatem"',
 'Ze 115 funkcji aplikacji liczba składników posiadających własne CE jako wyrób medyczny '
 'jest BLISKA ZERU. Terra API — nie. HealthKit i Health Connect — nie. PostgreSQL, Qdrant — '
 'nie. HAPI FHIR, Medplum — nie. Whisper, Tesseract — nie. LiveKit, Jitsi — nie. '
 'Modele językowe — nie. Wearables — tylko pojedyncze funkcje i tylko w aplikacji '
 'producenta.',
 'Obala założenie „one już mają certyfikacje", na którym opierała się cała koncepcja '
 'agregacji bez dossier.', '#88'),

('C3', 'ROZSTRZ', 'Trzy role, nie ma czwartej',
 'Dystrybutor (cudza marka, bez zmian, cudzy certyfikat) · Składający system wg art. 22 MDR '
 '(łączysz wyroby z CE w granicach ich przeznaczenia, własna deklaracja) · Producent '
 '(zmieniasz przeznaczenie, dodajesz obudowę, firmware albo interpretację, sprzedajesz '
 'pod swoją marką — pełne dossier).',
 'Zastępuje pięć szczebli kontroli jako podstawę decyzji regulacyjnej. Szczeble opisują '
 'kontrolę biznesową; role opisują obowiązek prawny.', '#88, #24, #25'),

('C4', 'ROZSTRZ', 'Sześć czasowników — gdzie przebiega granica wyrobu',
 'ZBIERA, NORMALIZUJE, ŁĄCZY (jako zestawienie obok siebie) — bezpieczne. '
 'AUTOMATYZUJE, PERSONALIZUJE — granica. JEDNA WARSTWA DECYZYJNA — to jest wyrób.',
 'Daje operacyjny test dla każdej funkcji, ostrzejszy niż podział na warstwy A/B/C. '
 'Warstwa mówi, gdzie funkcja jest; czasowniki mówią, co ją przesunie.', '#88'),

('C5', 'NOWE', 'Paradoks agregacji',
 'Bezpieczeństwo regulacyjne modelu agregacyjnego jest ODWROTNIE PROPORCJONALNE do jego '
 'wartości produktowej. Czysta rura jest legalna i mało warta. Warstwa decyzyjna jest warta '
 'dużo i jest wyrobem.',
 'To jest zdanie, które powinno otwierać rozdział o strategii regulacyjnej. '
 'Wyjaśnia, dlaczego nie ma tu bezpiecznej drogi na skróty.', '#88'),

('C6', 'KOREKTA', '„Trzy alternatywy" jako wybór użytkownika są szkodliwe',
 'Doktryna trzech wariantów jest słuszna jako strategia zakupowa i szkodliwa jako wybór '
 'pokazany użytkownikowi: potrójny koszt utrzymania, rozjazd wyników (trzy silniki OCR dają '
 'trzy odczyty — odpowiadasz Ty, bo Ty je zestawiłeś), użytkownik nie ma czym wybrać, '
 'a w reżimie certyfikowanym każdy wariant to osobna konfiguracja do walidacji.',
 'Właściwa forma: trzy alternatywy w dokumentacji i architekturze, JEDNA aktywna, '
 'przełączenie decyzją firmy uruchamianą przez zapisany próg. Użytkownik nigdy o tym '
 'nie wie i nie powinien.', '#88'),

('C7', 'ROZSTRZ', 'Trzy warunki licencjonowania cudzego certyfikowanego oprogramowania',
 'Agregacja działa naprawdę tylko wtedy, gdy: (1) dostawca pozostaje producentem i JEST '
 'WIDOCZNY dla użytkownika — „Interpretacja: [nazwa]" na ekranie, nie w regulaminie; '
 '(2) nie zmieniasz jego wyniku — nie skracasz, nie parafrazujesz, nie poprawiasz językowo; '
 '(3) NIE ŁĄCZYSZ WYNIKÓW DWÓCH DOSTAWCÓW W JEDNĄ ODPOWIEDŹ.',
 'Warunek trzeci jest w napięciu z trybem „konsensus" bramy z ETL-034. Rozstrzygnięcie: '
 'konsensus nad POMIAREM (ten sam parametr z dwóch urządzeń) jest normalizacją; '
 'konsensus nad INTERPRETACJĄ (dwie oceny kliniczne) jest naszą własną oceną i tworzy wyrób.',
 '#88, #117'),

('C8', 'KOREKTA', 'Art. 16 MDR — white label jest martwy',
 'Dystrybutor przejmuje wszystkie obowiązki producenta, jeżeli udostępnia wyrób pod własną '
 'nazwą lub znakiem — z jednym wyjątkiem: umowa, w której producent jest wskazany na '
 'etykiecie i pozostaje odpowiedzialny. Procedura OEM–PLM, powszechna pod starą dyrektywą, '
 'NIE JEST JUŻ DOZWOLONA pod MDR.',
 'Usuwa wariant „marka własna na cudzym implancie" z zestawu opcji. Zostaje co-branding '
 '(zero kontroli nad firmware), produkcja kontraktowa (pełne dossier klasy III) '
 'albo art. 22 (nie działa dla implantu — tam nie łączysz, tam wszczepiasz).', '#24'),

('C9', 'NOWE', 'Reguła produktowa, która sterowała całym projektem',
 'Fakt i porównanie do własnej historii są bezpieczne regulacyjnie. Ocena, próg i zalecenie '
 'nie są. Ta sama funkcja po jednej stronie granicy jest darmowa, po drugiej kosztuje dossier.',
 'Najkrótsze sformułowanie strategii warstwowej, jakie jest w korpusie. '
 'Nadaje się na slajd i do specyfikacji.', '#122'),

('C10', 'ROZSTRZ', 'Warstwa oceny jest przekrojem, nie modułem',
 'Żaden z piętnastu modułów pierwszej fali nie jest wyrobem medycznym. Warstwa oceny '
 'jest PRZEKROJEM PRZEZ MODUŁY, nie osobnym modułem — i to ona kosztuje dossier. '
 'Rozdzielenie tych dwóch rzeczy pozwala sprzedawać od pierwszego dnia.',
 'Zmienia sposób liczenia zakresu certyfikacji: nie „które moduły", tylko '
 '„która warstwa w których modułach".', '#123'),

('C11', 'RYZYKO', 'Trzy powierzchnie, nie dwie',
 'Aplikacja użytkownika, konsola kliniczna i WARSTWA KONTROLNA. Trzecia jest najważniejsza, '
 'nie ma jej w specyfikacji jako bytu, i to ona decyduje o dossier. Konsola kliniczna '
 'i panel administracyjny wyrobu SĄ CZĘŚCIĄ WYROBU — nie da się ich wyłączyć z dossier.',
 'Do rejestru ryzyk i do zakresu dossier.', '#124'),

# ---------------------------------------------------- państwo, IKP, EDM
('P1', 'ROZSTRZ', 'Darmowa aplikacja nie wygrywa z IKP i nie ma wygrywać',
 'Cena nie jest wymiarem konkurencji — nie da się podciąć ceny zera. IKP ma mandat ustawowy, '
 'mObywatela i dwadzieścia milionów kont, przy zaangażowaniu 500 tys. osób miesięcznie. '
 'Darmowa aplikacja bez różnicy odziedziczy ten sam problem, nie mając tego, co IKP ma.',
 'Darmowa aplikacja to DECYZJA DYSTRYBUCYJNA, nie konkurencyjna. Sprawia, że pytanie '
 '„kto wygra z IKP" przestaje być właściwym pytaniem.', '#15'),

('P2', 'NOWE', 'Zlecając badania sam wytwarzasz EDM',
 'Jako podmiot leczniczy zlecasz badanie → wytwarzasz elektroniczną dokumentację medyczną → '
 'masz do niej dostęp Z MOCY USTAWY, bez zgody i bez pośrednictwa IKP. Ten sam ruch, '
 'który generuje przychód, generuje dane.',
 'To jest jedyny mechanizm w całym projekcie, w którym pieniądze i dane przychodzą tą samą '
 'drogą. Powinien być osią modelu biznesowego, a nie przypisem.', '#3, #15'),

('P3', 'ROZSTRZ', 'Czego państwo strukturalnie nie zrobi',
 'Państwo mówi CO SIĘ ZDARZYŁO i KIEDY MASZ PRZYJŚĆ. Nie mówi CO TO ZNACZY DLA CIEBIE. '
 'Nie może interpretować, bo interpretacja bez lekarza w pętli robi z aplikacji wyrób. '
 'Ty możesz — jako podmiot leczniczy masz lekarza w pętli z definicji. '
 'Aktywność państwa jest populacyjna, nie indywidualna.',
 'Definiuje lukę, która nie zamyka się do 2030.', '#3, #26'),

('P4', 'RYZYKO', 'Po 2029 dostęp do danych przestaje być przewagą',
 'EHDS daje pacjentowi prawo dostępu i przenoszenia. Log dostępu, dziś nasz wyróżnik, '
 'staje się wymogiem powszechnym. Cel unijny: 100% dostępu do 2030.',
 'Dwa z trzech deklarowanych wyróżników mają datę ważności. Przewagą zostaje '
 'INTERPRETACJA I KONTEKST, nie posiadanie danych.', '#36'),

('P5', 'NOWE', 'Nie ma polskiej strategii po 2027',
 'Ramy strategiczne kończą się na 2027. Wszystko, co da się powiedzieć o latach 2028–2030, '
 'wynika z dat narzuconych przez EHDS i harmonogramu Centralnej e-Rejestracji.',
 'Jedyne twarde daty po 2027 pochodzą z prawa unijnego. Kto planuje pod nie, planuje pewnie.',
 '#26'),

('P6', 'NOWE', 'Portfel Aplikacji Zdrowotnych — państwo próbowało i nie wyszło',
 'PAZ ma warunek: aplikacja musi być bezpłatna dla każdego użytkownika. Efekt — dwie '
 'aplikacje w portfelu i określenie „fiasko" w prasie branżowej.',
 'Dowód, że państwo nie zajmie tej przestrzeni. Argument do decku i do rozdziału '
 'o konkurencji.', '#26'),

('P7', 'ROZSTRZ', 'Nie integrujemy się z laboratoriami, tylko z systemami gabinetowymi',
 'Systemy gabinetowe MAJĄ JUŻ integracje z sieciami laboratoryjnymi. Jedna integracja '
 'zamiast kilkunastu, a przy okazji kanał sprzedaży do placówek, które tych systemów używają.',
 'Zmienia plan integracyjny modułu A10 i K29 oraz kanał sprzedaży B2B.', '#113'),

('P8', 'NOWE', 'Sprzedawaj oferentom, nie państwu',
 'Skoro państwo przepłaca przez przetargi, nie startuj w przetargu — sprzedaj część, '
 'której potrzebuje każdy oferent. Jeden klient (państwo) kontra setki klientów (dostawcy '
 'oprogramowania i placówki). Konkurujesz z Asseco i Comarchem kontra sprzedajesz '
 'Asseco i Comarchowi.',
 'Mapper HL7 CDA ↔ FHIR R4 ↔ EEHRxF jako PRODUKT, nie element aplikacji.', '#3'),

('P9', 'NOWE', 'Okno mappera zamyka się samo',
 'Kto zbuduje mapper przed 2029, sprzedaje go każdemu dostawcy systemu gabinetowego '
 'w Polsce. Kto zacznie w 2029 — nikomu. To jedyna zewnętrzna data w całym planie, '
 'która tworzy popyt niezależnie od naszych działań.',
 'Priorytet mappera z P1 na P0 i twarda data w roadmapie.', '#122'),

# ---------------------------------------------------- struktura i projekty
('S1', 'ROZSTRZ', 'Czterdzieści pozycji to pięć projektów',
 'Podział nie według podobieństwa nazw, tylko według JEDNEJ KOMPETENCJI i JEDNEGO '
 'WŁAŚCICIELA: A zapis i rozumienie · B pomiar w otoczeniu · C wnętrze ciała · '
 'D linia zwierzęca · E zastosowania. Kryterium: czy dwie rzeczy wymagają tych samych ludzi.',
 'Z dwudziestu pozycji zostaje pięć projektów, jedenaście produktów, cztery wskazania '
 'i dwie funkcje. Reszta znika jako osobne byty, nie tracąc nic z zawartości.', '#49'),

('S2', 'KOREKTA', 'Pozycje 14–17 nie są projektami',
 'Skrzepy, tłuszcz, uzależnienie i psychika to WSKAZANIA — zastosowania jednej platformy. '
 'Traktowanie ich jako czterech przedsięwzięć czterokrotnie zawyża obraz pracy.',
 'Największa pojedyncza korekta wyceny pracy w całym korpusie.', '#49'),

('S3', 'ROZSTRZ', 'Linia zwierzęca musi być osobnym projektem',
 'Gdyby aplikacja weterynaryjna leżała w projekcie A, urządzenie w B, a implant w C, '
 'to w każdym byłaby najmniej pilną pozycją i w żadnym nie zostałaby zrobiona. '
 'Rzeczy poboczne w cudzych projektach nie powstają nigdy.',
 'Linia zwierzęca to jedyne miejsce, gdzie pełny cykl życia domknie się za życia '
 'założyciela: pies żyje kilkanaście lat, człowiek osiemdziesiąt. Pierwszy dowód, '
 'że ciągły zapis z interwencją wydłuża życie, przyjdzie STĄD I TYLKO STĄD.', '#49'),

('S4', 'NOWE', 'Moonshot ma trzy stany, nie dwa',
 'Nie „robimy albo nie robimy", tylko: OBSERWUJEMY / FINANSUJEMY CUDZE BADANIA / BUDUJEMY. '
 'Przejście między stanami jest decyzją RADY, nie zarządu. Moonshot nie ma własnego '
 'odbiorcy — nikt nie kupi baterii diamentowej, kupi implant, którego nie trzeba wymieniać. '
 'Wielobranżowość jest jego cechą definicyjną, nie dodatkiem.',
 'Zastępuje moje dwa rodzaje moonshotów (komponentowy i rynkowy) modelem trójstanowym '
 'z jawnym organem decyzyjnym.', '#49, #53'),

('S5', 'RYZYKO', 'Macierz w formie tabeli produkuje projekty',
 'Puste miejsce w tabeli wygląda jak brak, a nie jak brak potrzeby. Kiedy między dwoma '
 'produktami jest luka, format podpowiada, żeby ją wypełnić — i powstaje pozycja, która '
 'istnieje dlatego, że w tabeli była dziura. To jest wada GENERATYWNA: nie tylko źle '
 'opisuje rzeczywistość, ale ją produkuje.',
 'Siedem z czterdziestu pozycji jest oznaczonych „do wykreślenia — powstały z wypełniania '
 'przestrzeni".', '#60, #43'),

('S6', 'NOWE', 'Struktura warstwowa: 7 pytań → 10 zdolności → 3 linie → 5 decyzji → produkty',
 'Model z pytaniami badawczymi na szczycie. Wszystkie 40 pozycji przypisane: 7 do warstwy '
 '4/5 (robimy), 5 do warstwy 2 (to zdolności, nie projekty), 7 do warstwy 1 (to pytania, '
 'nie projekty), 14 do archiwum (możliwość, nie zobowiązanie), 7 do wykreślenia. '
 'Granica wyjścia przebiega między warstwą 2 a 3.',
 'To jest model zalecany zamiast macierzy — i jest kompletniejszy od mojej '
 'dziesięciopoziomowej hierarchii.', '#43'),

('S7', 'ROZSTRZ', 'Zapis jest ważniejszy niż funkcja',
 'Wszystko, co ma wartość w 2046, jest zbudowane z nieprzerwanego zapisu zaczętego w 2027. '
 'Każdy rok zwłoki to rok, którego nie da się odzyskać żadnym późniejszym nakładem. '
 'Model przyczynowy wymaga danych z dziesięciu lat: zaczynając w 2026 masz wynik w 2036, '
 'zaczynając w 2031 — w 2041.',
 'Baza danych pacjenta rusza przed czymkolwiek innym — nie z powodów technicznych, '
 'tylko dlatego, że jest erozyjna.', '#55, #69'),

('S8', 'RYZYKO', 'Digital Twin: keystone bez budżetu',
 'Filar Digital Twin ma w Macierzy 40 dwa projekty i zawiera oba komponenty kluczowe — '
 'bazę pacjenta i symulację ryzyka. Cały ekosystem zależy od filaru, który nie ma budżetu '
 'ani terminu przed 2028. Filar Hub nie ma ani jednego projektu.',
 'Niespójność planistyczna do rozstrzygnięcia przed rundą.', '#151'),

# ---------------------------------------------------- ekonomia i model
('E1', 'KOREKTA', 'Sprzęt nie jest produktem, tylko dostępem do produktu',
 'Marża na urządzeniu jest jednorazowa i niska. Marża na tym, co urządzenie wydaje '
 'co miesiąc, jest powtarzalna i wysoka. Im tańsze wejście, tym więcej wkładów.',
 'Wycena Station musi to odzwierciedlać: sprzedawać taniej, zarabiać na wkładach '
 'i Auto-Refill.', '#62'),

('E2', 'NOWE', 'Najwyżej marżowe produkty nie są skierowane do pacjenta',
 'Parser dla laboratoriów, dokumentacja dla klinik, kohorta, protokół, dane nadzoru. '
 'Wszystkie powstają jako PRODUKT UBOCZNY czegoś, co i tak budujemy. Aplikacja konsumencka '
 'jest kanałem dystrybucji i rekrutacji, nie produktem.',
 'Potwierdza i wzmacnia rekomendację darmowej aplikacji.', '#122'),

('E3', 'NOWE', 'Moduły widoczne mają najniższą wagę dla firmy',
 'Moduły najbardziej widoczne dla użytkownika (A3, A6, A7) mają najniższą wagę dla '
 'ekosystemu i najsłabszą monetyzację. Moduły niewidoczne (A12, A16, D1, K2, K5) mają '
 'najwyższą wagę i mają płatnika. Fosa leży w ćwiartce „nikt o to nie prosi, wszystko '
 'od tego zależy".',
 'Kolejność budowy NIE MOŻE wynikać z tego, o co pytają użytkownicy.', '#123, #124'),

('E4', 'ROZSTRZ', 'Nie brać kapitału venture do spółki-matki',
 'Kapitał wysokiego ryzyka jest strukturalnie sprzeczny z horyzontem trzydziestoletnim. '
 'Jeśli w ogóle — wyłącznie do wydzielonych spółek celowych pod konkretne produkty sprzętowe. '
 'Trzydziestoletnie przedsięwzięcie utrzymuje PRZEPŁYW GOTÓWKI, nie kapitał: trzeba mieć '
 'działalność przynoszącą pieniądze co miesiąc, niezależnie od tego, czy wizja postępuje.',
 'W bezpośredniej sprzeczności z planem rundy seed 6–6,7 mln zł. '
 'Sprzeczność do rozstrzygnięcia, nie do przemilczenia.', '#69'),

('E5', 'NOWE', 'Stały odsetek przychodu na fundusz badawczy rady',
 'Zarząd operacyjny nigdy nie sfinansuje badań o dwudziestoletnim horyzoncie — nie ze złej '
 'woli, tylko dlatego, że jest rozliczany z czegoś innego. Stały, zapisany w statucie '
 'odsetek przychodu przekazywany automatycznie na fundusz, którym dysponuje RADA, '
 'a nie zarząd, jest jedynym sposobem.',
 'Zapis statutowy do listy dla kancelarii.', '#71, #120'),

('E6', 'NOWE', 'Siedem mnożników kosztu wdrożenia publicznego',
 'Różnica między wyceną własną a publiczną wynika z siedmiu mnożników: kierunek integracji, '
 'gwarancja pokrycia, tryb zamawiania, poziom dostępności, skala przetwarzania, zakres '
 'wymuszony powszechnością i założenie, że wszystko musi być nasze.',
 'Wyjaśnia rozbieżności wycen w korpusie bez zarzucania komukolwiek błędu.', '#46'),

# ---------------------------------------------------- kontrola i ład
('K1', 'ROZSTRZ', 'Rola, która daje kontrolę bez bycia prezesem',
 'Nie prezes spółki operacyjnej. PRZEWODNICZĄCY PODMIOTU, KTÓRY POSIADA IP I TRZYMA WETO, '
 'PLUS AUTOR STANDARDU. Odwołanie licencji boli tylko wtedy, gdy przedmiotem jest standard, '
 'rejestr albo dossier — rzecz, której nie da się odtworzyć bez powtórzenia całej drogi. '
 'Kod się przepisze w rok.',
 'Odpowiada wprost na cel „nie chcę być prezesem" i wskazuje, co musi być przedmiotem '
 'licencji, żeby jej odwołanie miało siłę.', '#23'),

('K2', 'RYZYKO', 'MVP jest kamieniem milowym PRZEKAZANIA, nie produktu',
 'Skoro założyciel odchodzi z operacji po MVP, wszystko musi być zaprojektowane tak, '
 'żeby dało się to prowadzić bez niego. Projekt wymagający jego osobistego przekonania '
 'nie może zostać rozpoczęty przed odejściem — albo musi być zapisany jako opcja, '
 'nie zobowiązanie.',
 'Zmienia definicję MVP w całej dokumentacji.', '#71'),

('K3', 'RYZYKO', 'Następca operacyjny nie istnieje',
 'Szefowie dziedzin to nie zarząd. Osoba prowadząca całość po założycielu nie istnieje, '
 'a jej wprowadzenie wymaga dwóch–trzech lat wspólnej pracy. Zaczynając szukać w 2028, '
 'odchodzi się w 2031.',
 'Najpilniejsza rekrutacja w całym przedsięwzięciu — nieobecna w planie zatrudnienia.',
 '#71'),

('K4', 'NOWE', 'Katalog odrzuceń jako dokument obowiązkowy',
 'Lista rzeczy, których świadomie nie robimy, wraz z powodem. Bez niej następca po roku '
 'odkryje katalog czterdziestu pozycji i zacznie je realizować.',
 'Nowy dokument do wytworzenia; częściowo już istnieje jako listy pozycji usuniętych '
 'z Planu Korporacyjnego i Biznesplanu 4.0.', '#71'),

('K5', 'NOWE', 'Reguła żywego wariantu zapasowego',
 'Przez każdy wariant zapasowy przechodzi od jednego do pięciu procent realnego ruchu. '
 'Kod, przez który nie płynie ruch, GNIJE W TRZY MIESIĄCE i w dniu awarii okazuje się, '
 'że nie działa. Niesprawdzony wariant zapasowy nie jest wariantem zapasowym, '
 'tylko wpisem w tabeli.',
 'Konkretyzuje regułę 33% od strony wykonawczej.', '#120'),

('K6', 'NOWE', 'Test adaptacyjny odróżnia dobór od rankingu',
 'Punktacja opisuje, co producent DEKLARUJE. Test adaptacyjny mierzy, co komponent ROBI '
 'na naszych danych. Kandydat bez przechodzącego testu nie zostaje wybrany, choćby miał '
 'najwyższą punktację.',
 'Dodaje etap do algorytmu doboru dostawcy w bramie.', '#120'),

('K7', 'ROZSTRZ', 'Eternal Kompatybilny — model istnieje i jest praktykowany',
 'IHE pisze wprost, że niektóre wdrożenia dodały własny proces certyfikacji, w którym '
 'raport IHE służy jako materiał wejściowy do wydania własnego certyfikatu albo etykiety. '
 'Krajobraz etykiet jest gęsty: CE Mark, Continua, IHE Connectathon Seal, Label2Enable, '
 'xShare, QUANTUM, Blue Button 2.0 — te miejsca są zajęte.',
 'Znak nie może znaczyć „dobra aplikacja" ani „zgodna z EEHRxF". Musi znaczyć: '
 'MÓWI MODELEM DANYCH ETERNAL I ZAPISUJE DO REJESTRU ETERNAL.', '#25'),

('K8', 'RYZYKO', 'Sformułowanie znaku, które nie koliduje z CE',
 '„Eternal Kompatybilny oznacza, że produkt przeszedł testy interoperacyjności z Eternal '
 'Standard w wersji X. Nie stanowi oceny bezpieczeństwa ani skuteczności medycznej." '
 'Znak sugerujący bezpieczeństwo albo skuteczność jest oświadczeniem regulacyjnym '
 'i koliduje z oznakowaniem CE.',
 'Obowiązujące brzmienie do wszystkich materiałów.', '#124'),

('K9', 'ROZSTRZ', 'Granica fizyczna reguły trzech dostawców',
 'Agregacja działa tam, gdzie rzecz jest WYMIENNA W PUNKCIE UŻYCIA. Implant jest '
 'pojedynczy, chirurgiczny i nieodwracalny — nie da się wszczepić trzech na wszelki wypadek. '
 'Trzy alternatywy w łańcuchu dostaw tak, trzy implanty w pacjencie nie.',
 'Reguła 33% nie obowiązuje w klasie K28 i C1–C5 z powodu fizycznego, nie regulacyjnego.',
 '#6'),

# ---------------------------------------------------- technologia
('T1', 'NOWE', 'Warstwa protokołowa BCI standaryzuje się teraz, nie w 2035',
 'Apple ogłosił protokół BCI HID w maju 2025, uznając interfejsy neuronalne za natywną '
 'kategorię wejścia. Synchron współtworzył standard i przez to jest w środku, nie na zewnątrz '
 '— nie musieli budować konkurencyjnego telefonu. To moment analogiczny do OBD-II '
 'w motoryzacji i Matter w domu inteligentnym.',
 'Kto teraz nie jest przy stole, w 2035 będzie konsumentem cudzego standardu. '
 'Przesuwa działanie w sprawie BCI z 2035 na teraz — ale jako udział w standardzie, '
 'nie jako budowa implantu.', '#24, #6'),

('T2', 'NOWE', 'CorTec — realna droga produkcji kontraktowej implantów',
 'CorTec (Freiburg) prowadzi przychodowy biznes CDMO w zakresie zaawansowanych komponentów '
 'implantowalnych, obsługujący czołowe firmy neurotechnologiczne. Oferuje wprost '
 'wytwarzanie na zamówienie dla aktywnych wyrobów implantowalnych.',
 'Jedyna nazwana ścieżka do implantu bez własnej linii produkcyjnej. '
 'Do zweryfikowania u źródła.', '#24'),

('T3', 'RYZYKO', 'Kabina diagnostyczna ma cmentarz',
 'Forward upadł. Wcześniej w ten sam sposób HealthSpot — blisko 50 mln USD, około dwustu '
 'kabin, umowy z dużymi sieciami, zamknięcie. Dwie firmy, dwie dekady, ten sam wynik.',
 'NIE BUDOWAĆ KABINY. Ścieżka: stacja jako zestaw wyrobów w trybie art. 22, punkt '
 'diagnostyczny w drugim kroku, model mobilny testowany najpierw w linii weterynaryjnej.',
 '#113'),

('T4', 'ROZSTRZ', 'Szpital nie jest kolejnym szczeblem skalowania stacji',
 'Realny sufit tej ścieżki to POZIOM PIĄTY: mobilny punkt diagnostyczno-konsultacyjny '
 'łączący opiekę ambulatoryjną z diagnostyką. Poziom szósty wymaga kapitału i kompetencji '
 'z innej kategorii i nie powinien pojawiać się w dokumencie planistycznym jako etap.',
 'Klinika mobilna powinna powstać NAJPIERW W LINII WETERYNARYJNEJ — reżim lżejszy, '
 'a kompetencja operacyjna w całości przenośna. Wspinaczka jest przenośna, dossier nie.',
 '#119'),

('T5', 'NOWE', 'Trójka opisu komponentu programowego zamiast drabiny',
 'W sprzęcie „kto wytwarza" i „kto posiada" to ta sama rzecz. W oprogramowaniu się rozjeżdża '
 '— zawsze piszesz kod, nie ma „produkcji". Komponent opisuje się trójką: '
 'oś A (skąd zdolność), oś B (gdzie działa), oś C (licencja i prawa do danych). '
 'Na przykład A1/B2/C1 dla modelu językowego, A4/B3/C4 dla własnego mappera.',
 'Zastępuje drabinę afiliacja → agregacja → white label → OEM → produkcja własna, '
 'która w oprogramowaniu nie ma sensu.', '#12, #122'),

('T6', 'NOWE', 'Trzy wyzwalacze przejścia na własne',
 'WOLUMENOWY (koszt rośnie z użyciem), ZDOLNOŚCIOWY (cudze API czegoś nie umie), '
 'REDUNDANCYJNY (już masz coś, co to robi). Każdy ma inny próg i inną matematykę. '
 'Przy modelu językowym przechodzisz nie dlatego, że drogo, tylko dlatego, że przez '
 'zamknięte API nie dostroisz modelu na własnych danych podłużnych — a to jest cała przewaga.',
 'Uzupełnia progi kosztowe o dwa wyzwalacze niekosztowe.', '#12'),

# ---------------------------------------------------- dane i użytkownik
('D1', 'NOWE', 'Oznaczamy dane, nie ludzi',
 'Każdy wpis dostaje wagę pewności ze źródła, zgodności z sąsiednimi pomiarami i historią. '
 'Model uczy się z wpisów ważonych, więc niepewne po prostu ważą mniej. '
 'System, o którym ludzie wiedzą, że ich ocenia, natychmiast przestaje dostawać prawdziwe '
 'odpowiedzi — ukryta ocena wiarygodności produkuje mniej wiarygodne dane.',
 'To nie jest kompromis między skutecznością a przyzwoitością — jedno i drugie '
 'wskazuje w tę samą stronę.', '#31'),

('D2', 'NOWE', 'Rozbieżność jest sygnałem klinicznym, nie oszustwem',
 'Rosnący rozjazd między tym, jak ktoś ocenia swój sen, a tym, jak śpi, bywa objawem — '
 'na przykład zaburzenia postrzegania snu. To realna informacja kliniczna, którą traci się '
 'w momencie potraktowania rozbieżności jako oszustwa. Pokazywać jako obserwację, '
 'nigdy jako zarzut.',
 'Do specyfikacji modułu A1 (rozstrzyganie konfliktów) i A8.', '#31'),

('D3', 'ROZSTRZ', 'Personalizacja zaczyna się przy własnej historii, nie przy populacji',
 'Dopóki system mówi „u ludzi takich jak ty", jest przewodnikiem. Od momentu, gdy mówi '
 '„u ciebie, na podstawie twoich trzystu dni", staje się czymś, czego nie da się zastąpić. '
 'Agent zmiany — odchylenie człowieka od jego własnego wzorca sprzed trzech tygodni — '
 'jest najważniejszy z siedmiu i najczęściej pomijany.',
 'Definiuje moment, w którym produkt przestaje być wymienialny.', '#31'),

('D4', 'RYZYKO', 'Zaufanie do przewidywania odbiera czujność',
 'Kiedy system mówi „nic ci nie będzie", a jest inaczej, szkoda jest WIĘKSZA niż przy braku '
 'systemu — bo człowiek przestał się obserwować. Zjawisko nie ma jeszcze nazwy '
 'w tych dokumentach.',
 'Do rejestru ryzyk produktowych i do projektu komunikatów modułu D2.', '#55, #68'),

('D5', 'RYZYKO', 'Śmierć w systemie zbudowanym przeciw śmierci',
 'Ludzie będą umierać w tym ekosystemie przez cały czas jego istnienia. To, jak system się '
 'wtedy zachowuje — co mówi rodzinie, co robi z zapisem, czy milknie — zdecyduje o tym, '
 'czy ludzie mu ufają. Dziś nie ma na to odpowiedzi.',
 'Do modułu D3 Eternal Legacy jako wymaganie projektowe.', '#55'),

('D6', 'NOWE', 'Zdrowie rodzinne jako osobny obiekt',
 'Bliźniak rodziny jest silniejszy niż bliźniak jednostki, bo choroby są dziedziczne, '
 'a nawyki wspólne. Ale wynik jednej osoby ujawnia coś o pozostałych. '
 'Nie ma tego w żadnym dokumencie.',
 'Nowy byt do modelu danych i do polityki zgód (moduł A24).', '#55'),

('D7', 'NOWE', 'Format zapisu przeżyje kilka pokoleń technologii',
 'Zapis z 2027 będzie w 2047 równie czytelny co dyskietka. Ciągłość zapisu przez zmiany '
 'technologiczne jest osobnym problemem — i takim, którego rozwiązanie jest samo w sobie '
 'produktem, bo nikt inny go nie rozwiązuje.',
 'Zdolność Z10 z modelu warstwowego; nieobecna w rejestrze funkcji.', '#55, #43, #68'),

('D8', 'RYZYKO', 'Dostępność dla niedowidzących i drżących rąk',
 'Wśród deklarowanych odbiorców jest senior, ale nie ma niczego, co czyniłoby system '
 'używalnym dla kogoś ze słabym wzrokiem, drżeniem rąk albo trudnością ze złożonym tekstem.',
 'Moduł A23 istnieje jako lista funkcji, ale nie jako wymaganie projektowe całości.',
 '#68'),

# ---------------------------------------------------- metodyka
('M1', 'NOWE', 'Odpowiedź modelu o stanie rynku jest hipotezą, nie źródłem',
 'Nadaje się do zawężenia poszukiwań i wskazania kierunku. Nie nadaje się do decyzji '
 'zakupowej, do slajdu inwestorskiego ani do dokumentu regulacyjnego bez weryfikacji '
 'u źródła pierwotnego. Przypadek Forward pokazuje koszt pominięcia tego kroku.',
 'Zasada obowiązująca dla całej dokumentacji, w tym dla moich własnych ocen pokrycia '
 'i cenników.', '#113'),

('M2', 'NOWE', 'Pole „co to obali" jest najważniejsze i najczęściej pomijane',
 'Odpowiedź, przy której nie napisano, co ją obali, zostaje w dokumentacji na zawsze — '
 'także wtedy, gdy świat się zmienił. Przykład z tego projektu: rekomendacja oparta '
 'na firmie, która zamknęła się dwa lata wcześniej, przetrwała, bo nikt nie zapisał '
 'warunku „sprawdzić, czy firma istnieje".',
 'Do dodania jako pole w każdej karcie funkcji i w każdej karcie klasy komponentu.',
 '#115'),

('M3', 'RYZYKO', 'Największa pojedyncza luka w materiale',
 'Pół miliona znaków pracy wykonanej w innym narzędziu, zawierającej NAZWANE BYTY '
 'ARCHITEKTONICZNE, których w taksonomii nie ma. Dopóki nie zostanie przeczytane '
 'i zestawione, każde zdanie o „ujednoliceniu wszystkich źródeł" jest nieprawdziwe.',
 'Audyt pokrycia źródeł wykonany w korpusie stawia dokładnie ten sam zarzut, '
 'który postawił użytkownik. Ta praca to jego wykonanie.', '#114'),

('M4', 'NOWE', 'Szesnaście nazwanych modułów architektury',
 'Eternal Data Vault, Bridge, OCR Gateway, RAG, Orchestrator, Translator, ID, '
 'Underwriting AI, Agent Manager, Digital Twin, Audit Trail, Notification Hub, '
 'Analytics Dashboard, Subscription Engine, Bio-Firewall, Mapping Engine.',
 'Nazewnictwo nieobecne w taksonomii A1–A24 i K01–K30. Do uzgodnienia — dwa równoległe '
 'nazewnictwa tego samego są kosztem, nie bogactwem.', '#134'),
]

KAT = {
 'KOREKTA': ('KOREKTA', 'B8431F', 'obala albo poprawia wcześniejsze twierdzenie'),
 'ROZSTRZ': ('ROZSTRZYGNIĘCIE', '1B3A6B', 'zamyka sprawę otwartą'),
 'NOWE': ('NOWE', '2E7D32', 'wnosi treść nieobecną gdzie indziej'),
 'RYZYKO': ('RYZYKO', 'B07419', 'wskazuje zagrożenie nieujęte w rejestrze ryzyk'),
}
