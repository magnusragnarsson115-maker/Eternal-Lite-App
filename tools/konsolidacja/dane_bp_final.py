# -*- coding: utf-8 -*-
"""Treść własna skróconego biznesplanu — wersja finalna."""

TYTUL = "BIZNESPLAN — WERSJA FINALNA"
PODTYTUL = ("Dwadzieścia jeden sekcji · wersja skrócona dla zespołu i inwestora · "
            "bez prognozy pięcioletniej do czasu pierwszych sześciu miesięcy sprzedaży")

NOTA = [
 "Ten dokument zastępuje wcześniejsze wersje biznesplanu w obiegu roboczym. Poprzednia "
 "konsolidacja liczyła ponad dziewięć tysięcy stron, bo przenosiła treść źródłową blok po "
 "bloku. Ten dokument ma inne zadanie: ma dać się przeczytać przed spotkaniem i wytrzymać "
 "pytania po spotkaniu.",
 "Szkieletem biznesowym jest plan korporacyjny 5.1, nie biznesplan 4.0 — rozstrzygnięcie "
 "wynika z metryk plików i z zakresu, nie z nazw. Wszędzie tam, gdzie źródła podawały różne "
 "liczby, wpisana jest wartość obowiązująca wraz z informacją, co zastępuje.",
 "Plan jest napisany tak, żeby dało się go zweryfikować, a nie tylko zaakceptować. Dlatego "
 "zawiera sekcję z rzeczami, których nie obiecuje, listę błędów wcześniejszych wycen wraz ze "
 "skalą każdego z nich oraz bramki decyzyjne z zapisaną konsekwencją niepowodzenia. "
 "Przedsięwzięcie, które nie ma zapisanego warunku zatrzymania, nie ma też sposobu, żeby "
 "stwierdzić, że nie działa.",
 "Prognozy pięcioletniej w tym dokumencie nie ma i jest to decyzja, nie przeoczenie. Poprzednia "
 "była zbudowana na modelu kosztowym bez wynagrodzeń i na konwersji konsumenckiej, która nie "
 "jest osią przychodu w tym modelu. Prognoza powstanie po pierwszych sześciu miesiącach "
 "sprzedaży, na danych z tych sześciu miesięcy.",
 "Warstwa wyłączona ze specyfikacji — sterowanie zachowaniem ludzi, wpływ na decyzje wyborcze, "
 "oddziaływanie podprogowe, masowa implantacja — nie jest w tym planie źródłem przychodu, "
 "kanałem ani przewagą i nie jest w nim rozwijana.",
]

S01 = [
 "Eternal buduje otwarty system danych zdrowotnych: warstwę, która zbiera rozproszoną historię "
 "medyczną człowieka, nadaje jej strukturę i udostępnia ją tam, gdzie zapada decyzja — "
 "w gabinecie, w laboratorium, w badaniu klinicznym. Aplikacja pacjenta jest darmowa w całości "
 "i taką pozostanie; przychód pochodzi z warstw, które płacą za dostęp do struktury, nie za "
 "dostęp do pacjenta.",
 "Rozstrzygnięcie, które porządkuje cały plan: nie konkurujemy z systemem publicznym i nie "
 "mamy takiego zamiaru. Państwo zajęło funkcje najtańsze do zbudowania i o najwyższym "
 "wolumenie — konto pacjenta, e-recepta, e-skierowanie, rejestracja. Zostawiło funkcje drogie "
 "i trudne: interpretację, ciągłość, personalizację, badania. Wchodzimy tam, gdzie państwo "
 "wejść nie może, bo nie ma po temu ani mandatu, ani ekonomiki.",
 "Model wykonania jest lean i etapowy. Pierwszy przychód nie pochodzi z aplikacji "
 "konsumenckiej, tylko z dwóch kanałów o najkrótszej drodze do pieniędzy: automatycznej "
 "dokumentacji dla gabinetów i rynku weterynaryjnego, na którym nie ma obecności państwa. "
 "Kapitału wysokiego ryzyka używamy wyłącznie do spółek celowych pod sprzęt.",
 "Kwota, która domyka strukturę prawną, status podmiotu leczniczego i doprowadza do pierwszego "
 "przychodu, to około dwustu tysięcy złotych — bez rundy kapitałowej. Kolejność źródeł jest "
 "sztywna: przepływ z działalności powtarzalnej, potem granty, potem kapitał cierpliwy.",
 "Ryzyko główne nie jest technologiczne. Jest nim to, że nikt nie zapłaci — i dlatego "
 "harmonogram zaczyna się od czterdziestu rozmów i pięciu podpisanych zobowiązań, a nie od "
 "budowy produktu.",
]

S02 = [
 "Problem ma dwie warstwy: finansową po stronie systemu i informacyjną po stronie pacjenta. "
 "Warstwa finansowa jest znana i opisana; warstwa informacyjna jest tą, w której da się coś "
 "zrobić za pieniądze, jakimi dysponuje przedsięwzięcie tej wielkości.",
 "Wydatki publiczne na zdrowie w 2026 roku sięgają 247,8 mld zł, czyli 6,81% produktu "
 "krajowego brutto, a luka finansowa systemu wynosi 23 mld zł i według prognoz rośnie do "
 "171 mld zł w 2040 roku. Na profilaktykę przypada 21,6 EUR na mieszkańca wobec 202 EUR "
 "średniej unijnej — dziewięciokrotna różnica, która tłumaczy, dlaczego system jest "
 "zaprojektowany do leczenia chorób, a nie do utrzymania zdrowia.",
 "Dwie pozycje w tym bilansie są problemami informacyjnymi, nie medycznymi: hospitalizacje "
 "możliwe do uniknięcia to 8–10 mld zł rocznie, a dublowanie badań — 6–8 mld zł rocznie. "
 "Razem 14–18 mld zł, których przyczyną nie jest brak leku ani brak lekarza, tylko brak "
 "dostępu do informacji, która już istnieje.",
 "Po stronie pacjenta problem sprowadza się do bariery ostatniej mili: dane istnieją, ale są "
 "nieczytelne dla maszyn i pozbawione kontekstu. Wyniki leżą w plikach PDF i skanach, urządzenia "
 "noszone widzą zachowanie, ale nie widzą biochemii, a jedno z drugim nigdy się nie spotyka. "
 "Pacjent dostaje informację, nie dostaje możliwości działania.",
]

S03 = [
 "Rozwiązaniem jest warstwa, która robi trzy rzeczy w jednym przebiegu: importuje dowolny "
 "dokument medyczny i nadaje mu strukturę, synchronizuje dane z urządzeń noszonych przez jedno "
 "wejście i koreluje twarde wyniki badań z miękkimi danymi behawioralnymi.",
 "Wartością nie jest żadna z tych trzech rzeczy osobno — każdą z nich robi ktoś inny na rynku. "
 "Wartością jest ich zestawienie w jednej osi czasu, z zachowaniem informacji o pochodzeniu "
 "każdego pomiaru. To jest jedyna rzecz, której konkurencja nie ma, bo wymaga pracy nudnej i "
 "drogiej: normalizacji danych.",
 "Granica produktu jest wyznaczona jednym zdaniem i nie jest negocjowalna: fakt i porównanie "
 "do własnej historii są bezpieczne, ocena, próg i zalecenie nie są. Produkt pokazuje, co się "
 "zmierzyło i jak to wygląda wobec własnej historii użytkownika. Rozstrzyga lekarz — z raportem, "
 "którego wcześniej nie miał.",
 "Etap zerowy to dwanaście funkcji tworzących jeden produkt, a nie sto osiemdziesiąt pięć. "
 "Redukcja zakresu jest tu decyzją strategiczną: produkt złożony z dwunastu funkcji da się "
 "dowieźć w terminie i sprzedać; produkt złożony ze stu osiemdziesięciu pięciu funkcji nie da "
 "się dowieźć w żadnym terminie.",
]

S04 = [
 "Cztery daty tworzą okno, w którym to przedsięwzięcie ma sens, i tylko jedna z nich tworzy "
 "popyt niezależnie od naszych działań.",
 "26 marca 2029 — europejski format wymiany dokumentacji medycznej obejmuje kategorię "
 "pierwszą i systemy dokumentacji muszą mieć oznakowanie CE. Mapper między polską implementacją "
 "krajową a formatem europejskim nie istnieje jako produkt, a potrzebuje go każdy dostawca "
 "systemu gabinetowego w kraju. Kto zbuduje go przed 2029, sprzedaje wszystkim; kto zacznie "
 "w 2029 — nikomu.",
 "26 marca 2027 — akty wykonawcze europejskiej przestrzeni danych zdrowotnych i wyznaczenie "
 "organów dostępu do danych. Od tego momentu dostęp do danych wtórnych przestaje być kwestią "
 "umowy z konkretnym podmiotem, a staje się procedurą.",
 "3 października 2026 — obowiązek rejestracji w wykazie krajowego systemu cyberbezpieczeństwa, "
 "w trybie samoidentyfikacji. 28 maja 2026 — obowiązkowa baza wyrobów medycznych, także dla "
 "składających systemy z komponentów cudzych. Obie daty to obowiązki, nie szanse, ale obie "
 "podnoszą próg wejścia dla późniejszych konkurentów.",
 "Do tego dochodzi zmiana po stronie państwa: cel 99% placówek raportujących do platformy "
 "krajowej w 2027 roku oraz finansowanie opieki specjalistycznej przez e-Rejestrację do końca "
 "2029. Im pełniejsze dane w systemie państwowym, tym większa wartość warstwy, która potrafi "
 "je odczytać i połączyć z danymi spoza systemu.",
]

S05 = [
 "Segmentacja jest prowadzona według jednej zasady: liczy się nie wielkość rynku, tylko część, "
 "do której realnie docieramy przy naszych zasobach i przy naszym statusie prawnym.",
 "Segment, w którym pieniądze są najbliżej, to gabinety bez działu informatycznego. Płatnik "
 "decyzyjny jest tam jedną osobą, nie komisją, cykl sprzedaży liczy się w tygodniach, a problem "
 "— czas zjadany przez dokumentację — jest odczuwany codziennie. Drugi to lecznice weterynaryjne "
 "i właściciele zwierząt: pole bez obecności państwa i z udokumentowaną luką po stronie "
 "dostawców, którzy nie oddają klientowi zgromadzonych danych po zakończeniu współpracy.",
 "Segmenty konsumenckie — pacjenci metaboliczni i przewlekli, opiekunowie osób starszych, "
 "biohackerzy — są istotne dla jakości zbioru danych i dla wiarygodności produktu, ale nie są "
 "osią przychodu. Aplikacja dla nich jest darmowa, a koszt pozyskania w kanale konsumenckim "
 "wynosi w scenariuszu bazowym 250–600 zł, przy dobrym efekcie wirusowym 100–250 zł.",
 "Segmenty instytucjonalne dla stacji są ważniejsze niż klient detaliczny: pracodawcy "
 "zatrudniający od stu do pięciu tysięcy osób, prywatne kliniki, ubezpieczyciele, sieci "
 "aptek, ośrodki opieki długoterminowej. W kanale business-to-business koszt pozyskania to "
 "2–10 tys. zł na klienta, ale klient kupuje od dziesięciu do tysiąca stanowisk — dlatego kanał "
 "ten jest wielokrotnie efektywniejszy niż konsumencki.",
]

S06 = [
 "Portfel składa się z sześciu produktów, a każdy z nich to pięć albo sześć funkcji z rejestru, "
 "dobranych tak, że razem robią jedną rzecz, której żadna z nich nie robi osobno. Żaden produkt "
 "nie wprowadza funkcji, której nie ma w rejestrze — portfel powstał z korelacji funkcji "
 "istniejących, nie z ich dopisywania.",
 "Kryteria doboru są sześciu i muszą być spełnione łącznie: niezastępowalność, automatyzm, "
 "samorozwój, personalizacja, szerokie grono odbiorców i zdolność do działania samodzielnego "
 "poza ekosystemem. Ostatnie kryterium jest najostrzejsze: produkt, który wymaga całego "
 "ekosystemu, żeby mieć sens, nie jest produktem, tylko funkcją platformy.",
 "Kolejność wejścia wynika z tego, jak szybko produkt daje przychód powtarzalny i jak głęboko "
 "wchodzi w reżim regulacyjny. Pierwsza fala to dokumentacja dla gabinetów i produkt "
 "weterynaryjny — oba poza reżimem wyrobu, oba z płatnikiem instytucjonalnym. Mapper wchodzi "
 "przed 2029 rokiem w oknie regulacyjnym. Produkty oparte na interpretacji wchodzą po "
 "certyfikacji, nie przed.",
 "Ten sam mechanizm pozwala wyprowadzać produkty dla kolejnych nisz bez pisania nowych funkcji: "
 "inna korelacja pięciu albo sześciu pozycji rejestru, inny język interfejsu, inny kanał "
 "sprzedaży. Nisza jest warta osobnego produktu wtedy, gdy ma własnego płatnika i własny reżim; "
 "w przeciwnym razie jest wariantem produktu istniejącego.",
]

S07 = [
 "Model biznesowy ma trzy warstwy przychodu i jedną zasadę: pacjent nie płaci. Zasada jest "
 "warunkiem skali, a skala jest warunkiem jakości zbioru danych, na którym stoją obie pozostałe "
 "warstwy.",
 "Warstwa pierwsza to przychód powtarzalny od instytucji: licencje na dokumentację, subskrypcje "
 "weterynaryjne, dostęp programistyczny. Warstwa druga to prowizje i marże w marketplace "
 "usług — telemedycyna, laboratoria, apteka. Warstwa trzecia to przychód niezależny od liczby "
 "użytkowników: badania, kohorty, dane nadzoru, wsparcie certyfikacyjne.",
 "Najwyżej marżowe pozycje nie są skierowane do pacjenta. Parser dla laboratoriów, dokumentacja "
 "dla klinik, kohorta dla sponsora badania, protokół, dane nadzoru porynkowego — wszystkie mają "
 "płatnika instytucjonalnego i wszystkie sprzedają obowiązek albo oszczędność czasu, a nie "
 "obietnicę lepszego zdrowia.",
 "Arytmetyka subskrypcji konsumenckiej została policzona i jest powodem, dla którego aplikacja "
 "jest darmowa: przy cenie 49 zł miesięcznie dojście do 10 mln zł rocznego przychodu wymaga "
 "od 340 do 850 tysięcy zarejestrowanych użytkowników, czyli 1–2% populacji Polski, przy "
 "konwersji freemium w tej branży rzędu 3,9%. Cel na czwarty kwartał 2026 to tysiąc "
 "użytkowników. Różnica jest trzyrzędowa i nie da się jej zamknąć lepszym marketingiem.",
 "Model odrzucony wprost: sprzedaż danych użytkownika z prowizją. Powód jest podwójny — rynkowy, "
 "bo kategoria upadła wraz z zamknięciem obu platform monetyzujących dane genetyczne, i "
 "regulacyjny, bo konstrukcja zgody na taki obrót nie wytrzymuje wymogów artykułu 9. Kanałem "
 "pozostają wyłącznie dane zagregowane i zanonimizowane.",
]

S08 = [
 "Strategia zgodności jest w tym planie pozycją kosztową i przewagą jednocześnie. Kosztową, bo "
 "certyfikacja jednej funkcji klasy IIa to setki tysięcy złotych i rok pracy. Przewagą, bo "
 "podnosi próg wejścia dla każdego, kto chciałby powtórzyć produkt po tym, jak zadziała.",
 "Podział funkcji na warstwy przesądza o kolejności wydatków: 243 pozycje rejestru działają "
 "poza reżimem wyrobu, 31 to działalność regulowana bez reżimu wyrobu, a 63 wymagają "
 "certyfikacji. Budujemy w tej kolejności — nie dlatego, że warstwa A jest łatwiejsza, tylko "
 "dlatego, że jej dostarczenie nie zależy od zdarzenia zewnętrznego, na które nie mamy wpływu.",
 "Status podmiotu leczniczego jest warunkiem wstępnym całych kanałów, nie formalnością na "
 "koniec. Bez wpisu do rejestru nie ma integracji z platformą krajową, nie ma teleporady i nie "
 "ma części kanału instytucjonalnego. Koszt wpisu to 894 zł; koszt spełnienia warunków — lokal, "
 "opinia sanitarna, polisa, regulamin organizacyjny — to 20–40 tys. zł.",
 "Ścieżka certyfikacyjna zaczyna się od spotkania przedzgłoszeniowego z jednostką notyfikowaną, "
 "nie od dokumentacji. Koszt spotkania to 5–15 tys. zł i jest to najtańszy sposób, żeby "
 "dowiedzieć się, czy planowana klasa i zakres są realne, zanim wyda się kwoty rzędu setek "
 "tysięcy.",
]

S09 = [
 "Wartość zbioru danych nie leży w jego szerokości, tylko w głębi. Zbiory publiczne są "
 "przekrojami — pojedynczymi zdarzeniami rozrzuconymi w czasie. Nikt nie ma ciągłości, a bez "
 "ciągłości nie da się wnioskować o przyczynach, tylko o współwystępowaniu.",
 "To rozróżnienie jest podstawą kanału badawczego. Sponsor badania płaci za dostęp do kohorty "
 "o znanej jakości i ciągłości danych, a nie za liczbę rekordów. Kanał ten ma najwyższą marżę "
 "w całym zestawieniu i najniższą przewidywalność — nie skaluje się liniowo z bazą użytkowników.",
 "Największy zasób otwartego systemu nie jest przychodem: jest nim skrócenie ścieżki badawczej "
 "o pięć do dziesięciu lat dzięki równoległemu prowadzeniu toru weterynaryjnego. Walidacja na "
 "torze weterynaryjnym jest tańsza, szybsza i regulacyjnie odrębna, a wnioski metodyczne "
 "przenoszą się na tor ludzki.",
 "Dowód wartości musi powstać zanim powstanie oferta oparta na danych. Kolejność odwrotna — "
 "sprzedaż dostępu do zbioru, który dopiero ma powstać — jest w tej kategorii najczęstszym "
 "źródłem utraty wiarygodności wobec partnerów instytucjonalnych.",
]

S10 = [
 "Fizyka marketingu w tej kategorii jest odwrotna niż w większości branż: im głośniej się mówi, "
 "tym mniej jest się wiarygodnym. Prosimy człowieka nie o uwagę, tylko o dane, których nie "
 "pokazuje rodzinie. Kampania zasięgowa działa w tym przypadku przeciwko produktowi.",
 "Wejście na rynek prowadzimy trzema fazami. Faza pierwsza to sprzedaż bezpośrednia w kanale "
 "gabinetowym i weterynaryjnym — czterdzieści rozmów, jednostronicowa oferta z ceną zamiast "
 "prezentacji, każda rozmowa kończona pytaniem o pieniądze albo o podpis. Faza druga to "
 "referencje i wdrożenia wzorcowe. Faza trzecia to kanał partnerski przez dostawców systemów "
 "gabinetowych.",
 "Mierzymy trzy rzeczy i tylko trzy: liczbę rozmów zakończonych zobowiązaniem, czas od "
 "pierwszego kontaktu do pierwszej płatności oraz utrzymanie klienta po trzecim miesiącu. "
 "Wskaźniki zasięgowe nie są w tym modelu miarą niczego.",
 "Kanał konsumencki uruchamiamy dopiero wtedy, gdy kanał instytucjonalny generuje przychód "
 "powtarzalny. Odwrotna kolejność oznacza finansowanie darmowej aplikacji z kapitału, czyli "
 "dokładnie ten model, który w tej kategorii upadł najgłośniej.",
]

S11 = [
 "System publiczny nie jest konkurentem i nie będzie nim niezależnie od tego, co zrobimy. Ma "
 "mandat ustawowy, dwadzieścia milionów kont i cenę zerową, której nie da się podciąć. Wchodzenie "
 "z nim w spór o te same funkcje jest przegrane z definicji, a jednocześnie zbędne: państwo "
 "działa populacyjnie, nie indywidualnie.",
 "Luka, w którą wchodzimy, ma jasną definicję: ankieta państwowa jest ta sama dla wszystkich, "
 "program profilaktyczny jest ten sam, przypomnienie jest identyczne. Personalizacja, ciągłość i "
 "interpretacja pozostają poza zakresem — nie z powodu zaniedbania, tylko z powodu ekonomiki "
 "usługi publicznej.",
 "Konkurenci komercyjni dzielą się na siedem kategorii i w każdej mamy inną pozycję: wobec "
 "systemów gabinetowych stajemy się dostawcą komponentu, wobec agregatorów danych — jednym z "
 "trzech dostawców, a nie klientem jednego, wobec aplikacji konsumenckich nie wchodzimy w "
 "kategorię, a wobec globalnych firm prewencyjnych korzystamy z tego, że wejście do Polski "
 "wymaga statusu podmiotu leczniczego.",
 "Kalibracja skali ryzyka jest w tym planie zapisana wprost, bo bez niej sekcja o konkurencji "
 "brzmi zbyt komfortowo: w tej kategorii spalono kapitał rzędu miliardów przy produktach, które "
 "uzyskały dopuszczenie regulacyjne i mimo to upadły. Firma prewencyjna z 657 mln USD kapitału "
 "zamknęła działalność w listopadzie 2024 roku. Regulacja nie jest gwarancją rynku.",
]

S12 = [
 "Fosa tego przedsięwzięcia nie jest technologiczna. Sześć elementów, z których się składa, ma "
 "różny czas budowy i różną odporność na powtórzenie, a najsilniejsze z nich są najwolniejsze.",
 "Elementem najtrwalszym jest struktura własności: własność intelektualna mieszka nad spółkami "
 "i jest licencjonowana w dół kaskady odwoływalnie. Bez tej konstrukcji sprzedaż spółki zależnej "
 "sprzedaje technologię. Zapis statutowy mówi, że fundacja jest zobowiązana utrzymać kontrolę, "
 "a nie że może — różnica między obowiązkiem a uprawnieniem jest tu całą treścią zabezpieczenia.",
 "Drugim elementem jest zbiór danych o ciągłości, której nie da się kupić ani odtworzyć wstecz. "
 "Trzecim — integracje i status prawny, których uzyskanie zajmuje kwartały niezależnie od "
 "posiadanego kapitału. Czwartym — normalizacja i słowniki, praca nudna i kosztowna, którą "
 "konkurent musiałby wykonać w całości od nowa.",
 "Fundusz badawczy zasilany automatycznie stałym odsetkiem przychodu, poza kontrolą operacyjną "
 "zarządu, jest warunkiem koniecznym trwałości całej konstrukcji. Bez niego mechanizmy kontrolne "
 "działają dopóty, dopóki nikt nie ma powodu ich naruszyć.",
]

S13 = [
 "Technologia jest w tym planie pozycją kosztową o znanej strukturze, nie polem eksperymentu. "
 "Każda klasa komponentu ma wariant startowy, wariant docelowy i próg wyjścia — warunek liczbowy "
 "albo zdarzeniowy, po którym przechodzi się do wariantu wyższego.",
 "Zasada nadrzędna: dostawca startowy nie jest zobowiązaniem na zawsze. Mapowanie jest zawsze "
 "po naszej stronie, żaden format zewnętrzny nie jest zapisywany w bazie w postaci źródłowej, a "
 "rdzeń nie wie, skąd przyszły dane. To jedyny sposób, żeby cena dostawcy nie stała się ceną "
 "produktu.",
 "Sprzęt budujemy przez partnera, nie samodzielnie. Nie z powodu kosztu jednostkowego, tylko "
 "z powodu czasu: certyfikacja własnego sprzętu i certyfikacja oprogramowania toczyłyby się "
 "równolegle, a zespół zdolny prowadzić obie naraz jest większy niż zespół, który realnie "
 "zbudujemy. Ścieżka: własne oprogramowanie na gotowych modułach, potem produkcja kontraktowa "
 "z własnym oprogramowaniem układowym, dopiero potem konstrukcja własna.",
 "Warstwa orkiestracji — moduły, dzięki którym reszta daje się kontrolować — kosztuje 395 "
 "osobodni i około 316 tys. zł w wersji minimalnej. Nie ma wartości sprzedażowej i dlatego "
 "w projektach tego typu jest systematycznie pomijana w budżecie. W tym planie jest policzona "
 "osobno, żeby nie zniknęła.",
]

S14 = [
 "Zespół rdzeniowy liczy cztery osoby i taki pozostaje w horyzoncie zerowym. Rozszerzenie idzie "
 "przez wyspecjalizowane zespoły zewnętrzne i konsultantów rozliczanych projektowo, nie przez "
 "zatrudnienie — do momentu, w którym przychód powtarzalny pokrywa koszt osobowy.",
 "Trzy role regulacyjne muszą zostać obsadzone niezależnie od wielkości zespołu: inspektor "
 "ochrony danych, osoba odpowiedzialna za zgodność regulacyjną wyrobów oraz osoba odpowiedzialna "
 "za bezpieczeństwo w rozumieniu przepisów o krajowym systemie cyberbezpieczeństwa. Dwie z nich "
 "mogą być łączone, trzecia nie.",
 "Struktura podmiotu opiera się na rozdzieleniu własności od operacji: fundacja trzyma własność "
 "intelektualną i kontrolę, spółka operacyjna wykonuje, spółki celowe biorą kapitał wysokiego "
 "ryzyka pod konkretny sprzęt. Wariant konstrukcyjny — głosy poza fundacją albo fundacja wraz "
 "ze spółką wykonującą własność — jest rozstrzygany do końca 2026 roku, przed podpisaniem "
 "statutu.",
 "Statut zawiera trzy zamki: obowiązek zamiast uprawnienia po stronie zarządu, niezbywalność "
 "kluczowych praw oraz zakaz rozwodnienia kontroli. Do tego sukcesja rady i mechanizm "
 "rozstrzygający przy paraliżu decyzyjnym. Przegląd przez drugą kancelarię jest w budżecie "
 "osobną pozycją — statut pisany raz i sprawdzany raz jest statutem sprawdzonym w połowie.",
]

S15 = [
 "Ekonomika jest w tym planie przedstawiona jako struktura kosztów i mechanizm przychodu, a nie "
 "jako prognoza. Powód jest zapisany w nocie metodycznej i powtórzony tutaj, bo to najczęstsze "
 "pytanie inwestorskie: prognoza pięcioletnia oparta na modelu bez wynagrodzeń i na konwersji "
 "konsumenckiej nie jest prognozą, tylko wykresem.",
 "Wynagrodzenia stanowią od 70 do 90 procent struktury kosztów. Ich pominięcie było "
 "najpoważniejszym z siedmiu udokumentowanych błędów wcześniejszych wycen; pozostałe sześć "
 "obejmuje między innymi pominięcie warstwy orkiestracji, zaniżenie kosztu pozyskania klienta "
 "i policzenie wartości życiowej użytkownika dla modelu subskrypcyjnego, który został "
 "zastąpiony modelem darmowym.",
 "Najwcześniejsze źródło przychodu, dostępne przed produktem, to usługi regulacyjne świadczone "
 "innym podmiotom: przy zespole trzech osób i dwunastu projektach rocznie daje 600 tys. – "
 "1,2 mln zł przychodu przy koszcie osobowym 400–500 tys. zł. Jest to jedyna pozycja w planie, "
 "która nie wymaga ani produktu, ani certyfikatu, ani kapitału.",
 "Ekonomika stacji opiera się na wkładach, nie na sprzedaży urządzenia: urządzenie sprzedane "
 "jednorazowo jest przychodem jednorazowym, wkłady są przychodem powtarzalnym. W wariancie "
 "sprzętu jako usługi cały przychód jest powtarzalny od pierwszego miesiąca, kosztem wyższego "
 "zaangażowania kapitału w zapas.",
]

S16 = [
 "Około dwustu tysięcy złotych domyka strukturę prawną, status podmiotu leczniczego i "
 "doprowadza do pierwszego przychodu — bez rundy kapitałowej. Zestawienie pozycji znajduje się "
 "w tabeli poniżej i nie obejmuje kosztu zespołu, który jest pozycją osobną i największą.",
 "Kolejność źródeł finansowania jest sztywna i wynika z kosztu kontroli, nie z kosztu pieniądza. "
 "Pierwsze: przepływ z działalności powtarzalnej. Drugie: granty i dotacje — do 500 tys. zł bez "
 "wkładu własnego w programach krajowych. Trzecie: kapitał cierpliwy, czyli inwestor "
 "akceptujący horyzont zgodny z cyklem regulacyjnym. Kapitał wysokiego ryzyka wyłącznie do "
 "spółek celowych pod sprzęt.",
 "Dźwignie niepieniężne są w tym planie policzone na równi z pieniędzmi, bo w tej kategorii "
 "finansują więcej niż runda: dostęp do danych powierzonych dobrowolnie, partnerstwa "
 "instytucjonalne, tor weterynaryjny jako tańsza ścieżka walidacji, wsparcie regulacyjne "
 "świadczone innym w zamian za dostęp.",
 "Najsilniejsza z tych dźwigni ma warunek, który pozornie ją osłabia, a w rzeczywistości jest "
 "jej podstawą: możliwość odejścia z pełnym zapisem danych, bez konsekwencji i bez opłaty. "
 "Depozyt danych powierzony pod przymusem nie jest zasobem, tylko zobowiązaniem.",
]

S17 = [
 "Ryzyka są w tym planie zapisane z prawdopodobieństwem i mitygacją, a nie jako lista obaw. "
 "Ryzyko główne jest jedno i nie jest technologiczne: że nikt nie zapłaci. Cały horyzont zerowy "
 "jest skonstruowany po to, żeby rozstrzygnąć je w ciągu trzech miesięcy, zanim zostanie "
 "wydane cokolwiek dużego.",
 "Ryzyko regulacyjne ma dwa oblicza. Pierwsze: funkcja uznana za wyrób medyczny bez certyfikatu "
 "— mitygowane regułą granicy wymuszoną technicznie w warstwie prezentacji i udokumentowaną "
 "oceną kwalifikacji dla każdej funkcji granicznej. Drugie: przesunięcie terminów europejskich, "
 "które zamyka okno rynkowe na mapper — mitygowane tym, że mapper nie jest jedynym produktem.",
 "Ryzyko zależności od dostawcy jest mitygowane konstrukcyjnie: mapowanie po naszej stronie, "
 "trzy warianty na klasę komponentu, próg wyjścia zapisany liczbowo. Ryzyko kadrowe — brak "
 "obsadzenia ról regulacyjnych — jest mitygowane przez konsultantów rozliczanych projektowo do "
 "czasu, gdy przychód pozwoli na zatrudnienie.",
 "Ryzyko wiarygodności jest mitygowane tym dokumentem: wycofaniem prognozy, wskazaniem błędów "
 "wcześniejszych wycen i zapisaniem, czego plan nie obiecuje. Materiał inwestorski, który "
 "poprawia własne liczby po tym, jak zostaną zakwestionowane, kosztuje więcej niż materiał, "
 "który poprawia je wcześniej.",
]

S18 = [
 "Kamienie milowe horyzontu zerowego mają wpisaną konsekwencję niepowodzenia i to jest ich "
 "najważniejsza cecha. Bramka bez konsekwencji jest terminem, a termin bez konsekwencji przesuwa "
 "się sam.",
 "Brak dwudziestu zamkniętych rozmów do 15 września 2026 oznacza zatrzymanie toru produktowego "
 "i zmianę produktu. Brak pięciu podpisanych zobowiązań do 15 października oznacza zatrzymanie "
 "budowy — dalsze budowanie bez zobowiązań jest spalaniem pieniędzy. Brak produktu u pięciu "
 "użytkowników do 15 listopada jest opóźnieniem, nie porażką. Brak podpisanego statutu do "
 "31 grudnia nie zatrzymuje prac, ale przesuwa negocjacje na gorszą pozycję.",
 "Wskaźniki prowadzone od pierwszego miesiąca: liczba rozmów zakończonych zobowiązaniem, czas "
 "do pierwszej płatności, utrzymanie klienta po trzecim miesiącu, przychód powtarzalny w ujęciu "
 "miesięcznym oraz koszt pozyskania w podziale na kanał. Wskaźniki zasięgowe nie są prowadzone.",
]

S19 = [
 "Plan nie obiecuje wygranej z systemem publicznym na jego polu — obiecuje pozycję na polu, "
 "na które on nie wejdzie. Nie obiecuje wydłużenia życia o konkretną liczbę lat. Nie obiecuje "
 "przychodu z subskrypcji konsumenckiej. Nie obiecuje certyfikacji w horyzoncie zerowym. Nie "
 "obiecuje prognozy pięcioletniej przed pierwszymi sześcioma miesiącami sprzedaży.",
 "Pozycje usunięte z planu i z każdego materiału zewnętrznego są wymienione z nazwy, bo "
 "usunięcie ciche wraca jako pytanie w najgorszym momencie. Obejmują między innymi tezy o "
 "wydłużeniu życia do konkretnej liczby lat, koncepcje z zakresu kopiowania świadomości oraz "
 "całą warstwę sterowania zachowaniem ludzi wyłączoną przez sekcję 38 specyfikacji.",
 "Rzeczy, których nie robimy, mają w tym planie taki sam status jak rzeczy, które robimy. "
 "W przedsięwzięciu o tej liczbie funkcji największym ryzykiem harmonogramowym nie jest "
 "opóźnienie, tylko rozpłynięcie się zakresu.",
]

S20 = [
 "Proweniencja jest prowadzona na poziomie ustalenia, nie pliku. Wskazujemy, skąd pochodzi "
 "rozstrzygnięcie, a nie z ilu plików dało się je złożyć — liczba plików powtarzających to samo "
 "nie zwiększa wiarygodności ustalenia.",
 "Pełny indeks 159 plików korpusu wraz z informacją, co z każdego zostało wzięte, pozostaje "
 "w dokumencie archiwalnym. Tutaj podane są źródła obowiązujące oraz źródła zewnętrzne użyte "
 "do aktualizacji stanu prawnego, rynkowego i finansowego.",
]

S21 = [
 "Audyt objął cały korpus i doprowadził do trzynastu korekt wobec treści źródłowej. Każda "
 "korekta ma zapisane brzmienie błędne, brzmienie poprawne i podstawę rozstrzygnięcia — po to, "
 "żeby dało się ją zakwestionować, a nie tylko przyjąć.",
 "Cztery korekty mają skutek finansowy: struktura kosztów bez wynagrodzeń, budżet pierwszej "
 "wersji produktu zaniżony o rząd wielkości, koszt pozyskania klienta zaniżony trzykrotnie oraz "
 "wartość życiowa użytkownika policzona dla modelu, który został zastąpiony. Trzy mają skutek "
 "regulacyjny, w tym klasa wyrobu i status licencji jednego z komponentów.",
 "Pozycje wymagające weryfikacji przed przyjęciem założeń są wymienione osobno — są to dane, "
 "których nie mamy, a nie dane, co do których się nie zgadzamy. Każda ma przypisany moment "
 "rozstrzygnięcia.",
]

ZRODLA_ZEW = [
 ["Obszar", "Źródło", "Data stanu"],
 ["Finanse publiczne", "Wydatki publiczne na zdrowie 2026: 247,8 mld zł (6,81% PKB); luka 23 mld zł; prognoza 2040 — 171 mld zł", "2026"],
 ["Profilaktyka", "21,6 EUR na mieszkańca wobec 202 EUR średniej UE", "2026"],
 ["Koszty unikalne", "Hospitalizacje możliwe do uniknięcia 8–10 mld zł; dublowanie badań 6–8 mld zł rocznie", "2026"],
 ["Regulacje wyrobów", "MDR (UE) 2017/745; MDCG 2019-11 rev. 1; EUDAMED od 28.05.2026", "2026"],
 ["Dane i AI", "RODO (UE) 2016/679; AI Act (UE) 2024/1689; EHDS (UE) 2025/327; EEHRxF 2029 i 2031", "2026"],
 ["Cyberbezpieczeństwo", "NIS2 (UE) 2022/2555 i ustawa o KSC — wykaz do 03.10.2026", "2026"],
 ["System publiczny PL", "Centrum e-Zdrowia — e-Profil Pacjenta, RPWDL 2.0 (894 zł), certyfikat integracji bezpłatny", "2026"],
 ["Certyfikacja", "PCBC — cennik oceny dokumentacji technicznej MDR; koszt oceny klinicznej", "2026"],
 ["Benchmark rynkowy", "Neko Health — skan ok. 60 min, £299, ponad 350 tys. osób na liście oczekujących", "2025–2026"],
 ["Upadki kategorii", "Forward Health — 657 mln USD, zamknięcie 13.11.2024; LunaDNA 31.01.2024; Nebula 2025", "2024–2025"],
 ["Ekosystemy pełne", "M42 (Abu Zabi); Ping An, Alibaba Health, JD Health", "2025–2026"],
]
