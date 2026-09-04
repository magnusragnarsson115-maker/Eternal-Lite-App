# -*- coding: utf-8 -*-
"""Treść własna skróconej specyfikacji technicznej — wersja finalna.

Nie jest przeniesieniem bloków korpusu. Jest wykładem ustaleń po pełnym
odczycie 159 plików (28 618 387 znaków surowo, 13 020 154 po usunięciu
duplikatów), napisanym raz, w jednym brzmieniu, bez powtórzeń.
"""

TYTUL = "SPECYFIKACJA TECHNICZNA — WERSJA FINALNA"
PODTYTUL = ("Dwadzieścia dwie sekcje · rejestr 337 pozycji · karty funkcji priorytetu P0 · "
            "wersja skrócona dla zespołu i inwestora")

NOTA = [
 "Ten dokument zastępuje wcześniejsze wersje specyfikacji w obiegu roboczym. Poprzednia "
 "konsolidacja liczyła ponad dziewięć tysięcy stron i była zapisem dowodowym: przenosiła "
 "treść źródłową blok po bloku, żeby nic nie zginęło. Zadanie zostało wykonane i zapis "
 "pozostaje w archiwum. Ten dokument ma inne zadanie — ma być czytany.",
 "Metoda skrócenia jest jawna. Usunięto trzy rodzaje treści: powtórzenia jeden do jednego "
 "między wersjami tego samego pliku, warianty brzmieniowe tego samego ustalenia oraz materiał "
 "dowodowy, którego funkcją było wykazanie, skąd wzięło się ustalenie. Nie usunięto żadnego "
 "ustalenia. Tam, gdzie źródła były sprzeczne, podana jest wartość obowiązująca wraz z "
 "informacją, co zastępuje — sprzeczność jest rozstrzygnięta, nie przemilczana.",
 "Liczby w tym dokumencie mają jedno źródło: rejestr funkcji, który powstał ze scalenia "
 "macierzy monetyzacji, katalogu klas komponentów i rejestru funkcji ekosystemu. Rejestr liczy "
 "337 pozycji operacyjnych. Nie jest to czwarta wersja liczby funkcji obok 309, 299 i 160 — "
 "to inny przekrój tego samego zbioru: pozycja operacyjna to funkcja w kontekście produktu, "
 "kanału i klasy komponentu. Sekcja SPEC-01 pokazuje wszystkie ujęcia obok siebie i mówi, "
 "które obowiązuje do czego.",
 "Warstwa wyłączona przez sekcję 38 specyfikacji kanonicznej — sterowanie zachowaniem ludzi, "
 "wpływ na decyzje wyborcze, oddziaływanie podprogowe, masowa implantacja, niejawne podawanie "
 "nanotechnologii — nie wchodzi do tego dokumentu i nie jest w nim rozwijana. Zapisy korpusu, "
 "które tę warstwę nazywają i wykluczają, pozostają: wykluczenie jest ustaleniem, nie luką.",
 "Znaczniki luk pozostają w treści. Tam, gdzie brakuje danych, napisane jest ZAŁOŻENIE albo "
 "[BRAK] wraz z informacją, co trzeba zrobić, żeby lukę zamknąć. Luka widoczna jest tania; "
 "luka zamaskowana kosztuje wiarygodność całości dokumentu.",
]

S00 = [
 "Korpus wejściowy liczył 159 unikatowych plików i 28 618 387 znaków. Po usunięciu treści "
 "powtarzającej się jeden do jednego pozostało 13 020 154 znaki — to znaczy, że 54,5% objętości "
 "korpusu stanowiły powtórzenia. Nie jest to zarzut wobec autorów: korpus rósł przez dwa lata "
 "przez kopiowanie i rozszerzanie plików, a każda kolejna wersja przenosiła całą poprzednią.",
 "Deduplikacja została wykonana na dwóch poziomach. Poziom mechaniczny: bloki dłuższe niż "
 "czterdzieści znaków znormalizowanych porównano globalnie i przy powtórzeniu pominięto, "
 "zachowując wystąpienie z pliku o wyższym statusie — dokument finalny przed unikatem, unikat "
 "przed surowcem. Poziom redakcyjny: ustalenia wyrażone w kilku plikach różnymi słowami zapisano "
 "raz, w brzmieniu najpełniejszym, a pozostałe warianty odnotowano jako powtórzenia treściowe.",
 "Hierarchia wersji została rozstrzygnięta metrykami plików, nie deklaracjami w treści. To "
 "rozróżnienie było konieczne, bo plik opisujący sam siebie jako aktualizację bywał skrótem "
 "wcześniejszej wersji. Specyfikacja Master 5.4 FINAL ma 1 072 132 znaki i datę 30 sierpnia 2026; "
 "plik nazwany Master 3.1 ma 13 706 znaków i jest streszczeniem, mimo autoopisu jako wersji "
 "nowszej. Kanonem jest 5.4.",
 "Kontrola krzyżowa potwierdziła rozstrzygnięcie: App Specyfikacja 5.4 wniosła 84 nowe bloki "
 "na 754, czyli 89% jej treści jest dosłownie zawarte w Master 5.4. App 5.4 jest wycinkiem "
 "aplikacyjnym kanonu z niewielkim uzupełnieniem własnym, nie odrębną specyfikacją.",
 "Rejestr funkcji ma dwa źródła w obiegu jednocześnie i jest to celowe. Rejestr FINALNY 309 "
 "zastępuje rejestr scalony 299 jako źródło liczb i podziału na moduły. Rejestr 299 pozostaje "
 "jedynym źródłem nazw osiemdziesięciu funkcji dodanych w wersji 265 — nazwy te nie występują "
 "w żadnym innym pliku korpusu. Usunięcie rejestru 299 z obiegu oznaczałoby utratę tych nazw.",
 "Materiał, który po odczycie okazał się nie do użycia, został nazwany, a nie wyrzucony po "
 "cichu: dwa pliki w całości oraz jedenaście epików tematycznych zostało wyłączonych z produkcji "
 "dokumentów, z podaniem powodu i wskazaniem legalnego odpowiednika tam, gdzie odpowiednik "
 "istnieje. Zestawienie znajduje się na końcu tej sekcji.",
]

S01 = [
 "Cztery liczby funkcji krążą w korpusie i wszystkie cztery są poprawne — każda w swoim "
 "przekroju. Mieszanie ich w jednym zdaniu jest źródłem większości sprzeczności, jakie odczyt "
 "wykrył w materiałach inwestorskich.",
 "309 funkcji w 42 modułach to ekosystem: App 186, Station 34, Capsule 41, Twin 27, Matrix 21. "
 "To liczba obowiązująca wszędzie tam, gdzie mowa o całości. 160 funkcji w 23 modułach to "
 "aplikacja w ujęciu użytkownika — tyle rzeczy użytkownik może w niej zrobić. 185 funkcji "
 "w 30 modułach to baza historyczna z Master 3.0, przywoływana wyłącznie przy porównaniach "
 "wersji. 337 pozycji to rejestr operacyjny, w którym ta sama funkcja występuje tyle razy, w ilu "
 "produktach jest rdzeniowa — bo w każdym z nich ma inny kanał przychodu i inną klasę komponentu.",
 "Taksonomia kanoniczna ma cztery poziomy i jeden kierunek zależności. Funkcja to najmniejsza "
 "jednostka, która ma kod, właściciela i kryterium akceptacji. Moduł to zbiór funkcji o wspólnym "
 "przeznaczeniu — jednostka planowania, nie sprzedaży. Produkt to pięć albo sześć funkcji "
 "dobranych tak, że razem robią jedną rzecz, której żadna z nich nie robi osobno — jednostka "
 "sprzedaży. Ekosystem to zbiór produktów dzielących rdzeń danych i tożsamości.",
 "Zmiana wobec wersji wcześniejszych jest tu zasadnicza i wymaga wyraźnego zapisania: produkt "
 "NIE jest modułem ani zbiorem modułów. Wcześniejsze materiały traktowały moduł jak produkt, "
 "przez co powstawały produkty złożone z kilkunastu funkcji, których nikt nie potrafił opisać "
 "jednym zdaniem. Żaden z sześciu produktów opisanych w SPEC-20 nie wprowadza funkcji, której "
 "nie ma w rejestrze — produkty powstały z korelacji funkcji istniejących, nie z ich wymyślania.",
 "Kody funkcji mają stałą składnię: litera produktu, numer modułu, kropka, numer funkcji w "
 "module. A oznacza App, S — Station, C — Capsule, D — Digital Twin, M — Matrix. Kod jest "
 "niezmienny przez cały cykl życia funkcji; zmiana nazwy nie zmienia kodu, a wycofanie funkcji "
 "nie zwalnia kodu do ponownego użycia.",
]

S02 = [
 "Cała architektura regulacyjna produktu opiera się na jednym rozróżnieniu, które da się "
 "zapisać w jednym zdaniu: fakt i porównanie do własnej historii są bezpieczne, ocena, próg i "
 "zalecenie nie są.",
 "Rozróżnienie ma cztery wyrażenia językowe, które je przekraczają, i wszystkie cztery są "
 "zakazane w interfejsie warstwy niecertyfikowanej: „Twoje…” w znaczeniu przypisania wyniku "
 "osobie jako cechy, „w normie” jako ocena wobec wartości referencyjnej, „powinieneś” jako "
 "zalecenie działania oraz „wskazuje na” jako wnioskowanie diagnostyczne. Katalog liczy 45 reguł "
 "kwalifikacji „kiedy funkcja staje się wyrobem” i 52 bezpieczne sformułowania interfejsu, "
 "przypisane do konkretnych sytuacji ekranowych.",
 "Statusy regulacyjne są cztery, nie dwa. Podział na wellness i wyrób medyczny jest zbyt "
 "gruby i prowadzi do błędnych decyzji budżetowych, bo mieści w jednym worku funkcje podlegające "
 "zupełnie różnym reżimom. Status pierwszy — oprogramowanie ogólnego przeznaczenia. "
 "Status drugi — zdrowie i dobrostan. Status trzeci — działalność regulowana poza reżimem wyrobu "
 "(teleporada, dokumentacja medyczna, obrót lekami, profilowanie). Status czwarty — wyrób "
 "medyczny w rozumieniu reguły 11 załącznika VIII MDR.",
 "Około szesnastu funkcji aplikacji jest granicznych: ta sama funkcja mieści się w statusie "
 "drugim albo czwartym w zależności od jednego zdania deklaracji przeznaczenia. To nie jest wada "
 "specyfikacji — to miejsce, w którym decyzja produktowa ma bezpośrednie przełożenie na koszt "
 "rzędu setek tysięcy złotych i na rok pracy z jednostką notyfikowaną.",
 "Warstwa A liczy 243 pozycje rejestru i działa poza reżimem wyrobu. Warstwa B liczy 31 pozycji "
 "— działalność regulowana, ale nie wyrób. Warstwa C liczy 63 pozycje i wymaga certyfikacji. "
 "Podział ten jest podstawą kolejności budowy: warstwa A jest budowana pierwsza nie dlatego, "
 "że jest łatwiejsza, tylko dlatego, że jej dostarczenie nie zależy od zdarzenia zewnętrznego, "
 "na które nie mamy wpływu.",
 "Reguła dziedziczenia klasy jest najczęstszym źródłem błędu kosztowego w projektach tego typu: "
 "komponent obsługujący jednocześnie funkcję wellness i funkcję klasy IIa dziedziczy klasę wyższą "
 "dla całości. Oszczędność na współdzieleniu komponentu zamienia się w koszt certyfikacji "
 "komponentu, który miał być tani. Dlatego interfejs między warstwą faktów a warstwą oceny musi "
 "być walidowany i jednokierunkowy.",
 "Agregacja nie omija certyfikacji. Odracza ją. Zdanie to jest w dokumencie celowo, bo w "
 "materiałach wcześniejszych pojawiała się teza przeciwna — że wystarczy nie oceniać, żeby nigdy "
 "nie wejść w reżim wyrobu. To prawda tylko dopóki produkt nie ma wartości klinicznej. Produkt, "
 "który ma wartość kliniczną i jej nie deklaruje, jest wyrobem medycznym bez certyfikatu, a nie "
 "produktem wellness.",
]

S03 = [
 "Terminy zewnętrzne dzielą się na trzy rodzaje i tylko jeden z nich tworzy rynek. Terminy "
 "ustawowe nakładają obowiązek na nas. Terminy zewnętrzne opisują, co zrobi ktoś inny — państwo, "
 "płatnik, dostawca. Bramki wewnętrzne to daty wyznaczone przez nas samych, których przekroczenie "
 "bez wyniku zatrzymuje pracę, a nie przesuwa termin.",
 "Data 26 marca 2029 jest jedyną zewnętrzną datą w całym planie, która tworzy popyt niezależnie "
 "od naszych działań. Od tego dnia europejski format wymiany elektronicznej dokumentacji "
 "medycznej obejmuje kategorię pierwszą i systemy dokumentacji muszą mieć oznakowanie CE. Mapper "
 "między polską implementacją krajową a formatem europejskim nie istnieje jako produkt, a "
 "potrzebuje go każdy dostawca systemu gabinetowego w kraju. Kto zbuduje go przed 2029, sprzedaje "
 "go wszystkim; kto zacznie w 2029 — nikomu.",
 "Data 3 października 2026 jest obowiązkiem własnym o nietypowej konstrukcji: samoidentyfikacja. "
 "Nikt nie wezwie nas do rejestracji w wykazie krajowego systemu cyberbezpieczeństwa — to my "
 "musimy ustalić, czy jesteśmy podmiotem kluczowym czy ważnym, i zarejestrować się sami. "
 "Zaniechanie nie jest wykrywane natychmiast, ale wychodzi przy pierwszym incydencie i przy "
 "pierwszym audycie kontrahenta.",
 "Data 28 maja 2026 — obowiązkowa baza wyrobów medycznych — dotyczy także podmiotów składających "
 "systemy i zestawy z komponentów cudzych. To istotne przy modelu, w którym integrujemy wyroby "
 "innych producentów: proxy działa tylko wtedy, gdy nie modyfikujemy wyniku i wskazujemy "
 "producenta. Modyfikacja wyniku oznacza, że producentem jesteśmy my.",
 "Okno przewagi otwiera się 26 marca 2027 wraz z aktami wykonawczymi europejskiej przestrzeni "
 "danych zdrowotnych i wyznaczeniem organów dostępu do danych, a zamyka 26 marca 2031, kiedy "
 "kategoria druga formatu obejmie obrazowanie, wyniki laboratoryjne i wypisy. Cztery lata to "
 "cały horyzont, w którym luka pozostaje otwarta.",
]

S04 = [
 "Architektura ma pięć warstw i jedną zasadę nadrzędną: rdzeń nie wie, skąd przyszły dane. "
 "Zasada wygląda na techniczny drobiazg, a jest warunkiem wymienialności dostawcy — a "
 "wymienialność dostawcy jest warunkiem, żeby cena dostawcy nie stała się ceną produktu.",
 "Warstwa pierwsza, wejście: adaptery urządzeń noszonych, rozpoznawanie tekstu z dokumentów "
 "medycznych, import z platformy państwowej. Każdy adapter zapisuje proweniencję — źródło, wersję "
 "adaptera, czas pobrania i wagę pewności. Bez proweniencji nie da się później rozstrzygnąć, "
 "który z dwóch sprzecznych pomiarów jest wiarygodniejszy.",
 "Warstwa druga, struktura: mapowanie na model kanoniczny oparty na standardzie FHIR R4B, "
 "słowniki SNOMED CT i LOINC, normalizacja jednostek. Ta warstwa jest droga w budowie i nudna w "
 "prezentacji, a decyduje o wszystkim, co dalej. Dane nieznormalizowane nie dają się korelować, "
 "a korelacja jest jedyną rzeczą, której konkurencja nie ma.",
 "Warstwa trzecia, wnioskowanie: wyszukiwanie z rozszerzeniem kontekstu i cytowaniem źródła, "
 "detekcja odchyleń od własnej historii, korelacja sygnałów twardych z behawioralnymi. Warstwa "
 "ta ma twarde ograniczenie wbudowane: nie formułuje oceny, progu ani zalecenia, dopóki produkt "
 "nie ma certyfikatu. Ograniczenie jest wymuszone technicznie, nie regulaminowo — warstwa "
 "prezentacji odrzuca komunikat, który nie przeszedł filtra sformułowań.",
 "Warstwa czwarta, prezentacja: oś czasu zdrowia, raport dla lekarza w strukturze sytuacja–"
 "tło–ocena–zalecenie wypełnianej przez lekarza, eksport i usunięcie danych. Wyjście z systemu "
 "musi być zawsze dostępne i bezpłatne. To nie jest ustępstwo wobec regulatora — to warunek "
 "zaufania, na którym stoi zgoda na przetwarzanie.",
 "Warstwa piąta, nadzór: dziennik dostępu widoczny dla użytkownika, zgoda granularna per cel "
 "przetwarzania, tryb degradacji przy niedostępności modelu albo chmury, oznaczanie treści "
 "generowanej przez model. Cztery z tych funkcji są jednocześnie wymogiem prawnym i wyróżnikiem "
 "handlowym — żaden konkurent konsumencki ich nie pokazuje, bo nikt nie lubi pokazywać, ile razy "
 "sięgnął po cudze dane.",
]

S05 = [
 "Model danych jest kanoniczny i jeden. Każdy adapter mapuje do niego, żaden nie zapisuje "
 "formatu własnego. Zasób obserwacji ma pole proweniencji, pole wagi pewności i pole wersji "
 "adaptera — trzy pola, których brak w typowej aplikacji zdrowotnej i bez których nie da się "
 "rozstrzygać konfliktów pomiarowych.",
 "Konflikt pomiarowy jest sytuacją normalną, nie awarią: dwa urządzenia mierzące tętno "
 "spoczynkowe podadzą dwie różne wartości. System nie uśrednia ich po cichu. Zachowuje obie z "
 "proweniencją, a w prezentacji pokazuje szereg z urządzenia o wyższej wadze pewności, z "
 "informacją, że istnieje pomiar rozbieżny.",
 "Jakość danych ma trzy miary raportowane wewnętrznie: kompletność, czyli jaki odsetek "
 "oczekiwanych pomiarów wpłynął; spójność, czyli jaki odsetek pomiarów przeszedł walidację "
 "zakresu; świeżość, czyli ile czasu minęło od ostatniej udanej synchronizacji. Spadek "
 "którejkolwiek poniżej progu wyłącza funkcje korelacyjne dla tego użytkownika i pokazuje "
 "komunikat o niepełnych danych, zamiast liczyć korelację na dziurawym szeregu.",
 "Retencja jest ustawiana przez użytkownika, nie przez nas. Usunięcie danych jest funkcją "
 "odrębną od eksportu — to rozróżnienie było w korpusie pomijane, a jest istotne: użytkownik, "
 "który wyeksportował dane, nie wyraził tym zgody na ich dalsze przechowywanie. Usunięcie kończy "
 "się potwierdzeniem zawierającym zakres i czas operacji.",
 "Dane surowe pozostają jak najbliżej człowieka — na urządzeniu albo w jego prywatnej przestrzeni "
 "danych. Na zewnątrz wychodzą wyniki i wielkości zbiorcze. Zasada ta ogranicza część modeli "
 "przychodowych i została przyjęta świadomie: kanał sprzedaży danych osobowych jest w tym "
 "projekcie zamknięty, a kanał danych zagregowanych i zanonimizowanych — otwarty.",
]

S06 = [
 "Brama API jest jedynym wejściem do ekosystemu z zewnątrz. Nie ma dostępu bezpośredniego do "
 "bazy, nie ma wyjątku dla partnera strategicznego, nie ma trybu serwisowego z pominięciem "
 "uwierzytelnienia. Wyjątki tego rodzaju są w systemach zdrowotnych najczęstszą drogą wycieku.",
 "Uwierzytelnienie jest dwuskładnikowe po stronie systemu partnera i zakresowe po stronie "
 "zgody: token nosi zakres celu przetwarzania, a nie tożsamość aplikacji. Partner mający dostęp "
 "do celu „raport dla lekarza” nie ma dostępu do celu „badania naukowe”, nawet jeżeli technicznie "
 "obsługuje oba.",
 "Integracje dzielą się na trzy klasy według tego, co się stanie, gdy dostawca zniknie. Klasa "
 "pierwsza — dostawca wymienialny w tydzień, bo mapowanie jest po naszej stronie. Klasa druga "
 "— wymiana wymaga przepisania mapowania, kilka tygodni. Klasa trzecia — dostawca jest "
 "niewymienialny bez utraty funkcji, co oznacza, że jego cena jest naszą ceną. Do klasy trzeciej "
 "nie wchodzimy świadomie; jeżeli musimy, funkcja dostaje wariant awaryjny w warstwie A.",
 "Integracja z platformą państwową ma status odrębny: certyfikat integracji jest bezpłatny, ale "
 "wymaga statusu podmiotu leczniczego i wpisu do rejestru. Kolejność jest zatem sztywna — najpierw "
 "status prawny, potem integracja, potem produkt korzystający z integracji. Odwrócenie tej "
 "kolejności jest najczęstszym błędem harmonogramowym w projektach zdrowotnych w Polsce.",
 "Wymiana danych z zewnętrznymi systemami dokumentacji odbywa się w formacie zgodnym z "
 "europejskim standardem wymiany. Mapper między implementacją krajową a standardem europejskim "
 "jest osobnym produktem, opisanym w SPEC-20, i ma własną ścieżkę sprzedaży — nie jest wyłącznie "
 "komponentem wewnętrznym.",
]

S07 = [
 "Modele językowe są w tym systemie komponentem wymienialnym, nie fundamentem. Odejście od "
 "zamkniętej bazy wektorowej na rzecz rozszerzenia bazy relacyjnej zostało podjęte właśnie w tym "
 "celu: żeby migracja modelu nie oznaczała migracji danych.",
 "Każda odpowiedź generowana przez model ma cytowanie źródła. Odpowiedź bez możliwego cytowania "
 "nie jest pokazywana — system mówi wtedy, że nie ma podstawy, zamiast improwizować. Zasada ta "
 "kosztuje część odpowiedzi i jest w tym projekcie nienegocjowalna, bo koszt jednej pewnie "
 "brzmiącej nieprawdy w kontekście zdrowotnym jest nieproporcjonalny do wartości stu poprawnych.",
 "Orkiestracja ma dwa poziomy dojrzałości. W wersji minimalnej działa jeden agent ogólny, nie "
 "zespół specjalistów — decyzja podjęta świadomie po analizie kosztu i realnej wartości. Zespół "
 "agentów specjalistycznych wchodzi dopiero po wykazaniu, że jeden agent nie wystarcza, i wtedy "
 "według katalogu modułów kontrolnych opisanego w SPEC-15.",
 "Nadzór nad modelami obejmuje: rejestr wersji modelu z datą wdrożenia, dziennik promptów "
 "systemowych, oznaczanie treści generowanej maszynowo w interfejsie, tryb degradacji przy "
 "niedostępności modelu oraz ujawnienie użytkownikowi, że rozmawia z systemem, a nie z "
 "człowiekiem. Ostatni obowiązek wynika wprost z artykułu 50 aktu o sztucznej inteligencji.",
 "System nie klasyfikuje się jako wysokiego ryzyka w rozumieniu załącznika III dopóki nie "
 "formułuje oceny klinicznej ani nie wpływa na dostęp do świadczeń. Przejście funkcji do warstwy "
 "C jest jednocześnie przejściem do reżimu wysokiego ryzyka — te dwie zmiany zachodzą razem i "
 "razem muszą być budżetowane.",
]

S08 = [
 "Zaufanie jest w tym produkcie warunkiem działania, nie cechą marketingową. Użytkownik oddaje "
 "systemowi dane, których nie oddaje rodzinie. Konstrukcja bezpieczeństwa musi to odzwierciedlać "
 "także tam, gdzie nikt nie patrzy.",
 "Zgoda jest granularna per cel przetwarzania i odwoływalna natychmiast, punktowo. Wycofanie "
 "zgody na jeden cel nie kasuje pozostałych i nie wyłącza konta. Konstrukcja „zgoda na wszystko "
 "albo nic” jest w kontekście danych szczególnej kategorii wadliwa prawnie i szkodliwa "
 "produktowo.",
 "Dziennik dostępu jest widoczny dla użytkownika w interfejsie, nie tylko dostępny na wniosek. "
 "Każdy odczyt zostawia wpis: kto, co, kiedy, na jakiej podstawie. Dostęp ratunkowy w stanie "
 "nagłym jest możliwy bez uprzedniej zgody, ale zostawia wpis wyróżniony i wywołuje powiadomienie "
 "po fakcie — mechanizm znany z systemów szpitalnych, w aplikacjach konsumenckich niespotykany.",
 "Dostęp opiekuńczy wygasa automatycznie w osiemnaste urodziny podopiecznego. Automatyzm jest tu "
 "istotny: mechanizm wymagający działania opiekuna nie zadziała, bo opiekun nie ma powodu go "
 "uruchomić.",
 "Rezydencja danych w Unii Europejskiej, klucze po naszej stronie, nie u dostawcy chmury. "
 "Szyfrowanie w spoczynku i w tranzycie jest oczywistością i nie jest w tym dokumencie "
 "rozwijane; rozwijane jest to, co odróżnia — czyli że klucz nie jest u tego, kto trzyma dane.",
 "Rejestr komponentów obcych prowadzony od pierwszej biblioteki, nie od pierwszego audytu. "
 "Obowiązek raportowania podatności w łańcuchu dostaw dotyczy komponentów, których nazwy trzeba "
 "znać wcześniej — odtwarzanie listy zależności po dwóch latach rozwoju jest pracą na tygodnie.",
]

S09 = [
 "Zgodność jest w tym projekcie architekturą, nie działem. Oznacza to, że decyzje regulacyjne "
 "zapadają w momencie projektowania funkcji, a nie przed wprowadzeniem produktu na rynek — bo "
 "wtedy jest już za późno i jedynym wyjściem pozostaje usunięcie funkcji.",
 "Reżim wyrobu medycznego: kwalifikacja według wytycznych MDCG 2019-11 w rewizji pierwszej, "
 "klasyfikacja według reguły 11 załącznika VIII rozporządzenia MDR. Ocena kwalifikacji jest "
 "dokumentowana dla każdej funkcji granicznej i przechowywana — brak udokumentowanej oceny jest "
 "przy kontroli traktowany gorzej niż ocena błędna.",
 "Reżim danych: rozporządzenie o ochronie danych osobowych, artykuł 9 dla danych zdrowotnych, "
 "artykuł 22 dla profilowania mającego skutek prawny, artykuł 17 dla usunięcia. Kanał "
 "ubezpieczeniowy dotyka wszystkich trzech naraz i dlatego wymaga osobnej, w pełni opcjonalnej "
 "zgody oraz ścieżki odwoławczej do człowieka.",
 "Reżim europejskiej przestrzeni danych zdrowotnych: obowiązki wtórnego wykorzystania danych, "
 "organy dostępu do danych od 2027, format wymiany dokumentacji od 2029 i 2031. Dla nas jest to "
 "jednocześnie obowiązek i rynek — jedyny przypadek w całym zestawieniu, w którym regulacja "
 "tworzy popyt zamiast go ograniczać.",
 "Reżim cyberbezpieczeństwa: samoidentyfikacja i wpis do wykazu do 3 października 2026, "
 "wyznaczenie inspektora ochrony danych, ustalenie osoby odpowiedzialnej za zgodność regulacyjną "
 "wyrobów. Trzy role, z których dwie mogą być łączone, a trzecia nie.",
 "Baza wyrobów medycznych: rejestracja podmiotu i wyrobów od 28 maja 2026, także dla składających "
 "systemy i zestawy. Reguła proxy: działa wyłącznie wtedy, gdy nie modyfikujemy wyniku i "
 "wskazujemy producenta; przy integracji przez API odpowiedzialność za certyfikację produktu "
 "końcowego pozostaje po stronie integratora.",
]

S10 = [
 "Eternal App jest jedynym produktem, który użytkownik widzi bezpośrednio, i jedynym, który "
 "jest w całości darmowy dla pacjenta. Decyzja o darmowości nie jest gestem — jest warunkiem "
 "skali, a skala jest warunkiem jakości zbioru danych, na którym stoją wszystkie pozostałe "
 "kanały przychodu.",
 "Moduły aplikacji porządkuje jedna zasada: moduł jest jednostką planowania, więc jego granice "
 "przebiegają tam, gdzie przebiega granica odpowiedzialności zespołu, a nie tam, gdzie wygodnie "
 "wypada w menu. Dlatego zgodność i nadzór nad modelem są osobnymi modułami, choć użytkownik "
 "nigdy ich nie zobaczy jako pozycji w interfejsie.",
 "Trzynaście funkcji jest w aplikacji obowiązkowych od pierwszego dnia i żadna z nich nie jest "
 "funkcją sprzedażową. Przekierowanie do centrum wsparcia kryzysowego działa na każdym etapie "
 "produktu i nie podlega ewolucji fazowej — jest to jedyna funkcja w całym rejestrze o takim "
 "statusie. Deklaracja przeznaczenia z informacją, czego produkt nie robi, tryb degradacji, "
 "dziennik dostępu, granularne wycofanie zgody i realizacja usunięcia danych są wymogami "
 "prawnymi; cztery ostatnie są jednocześnie wyróżnikami handlowymi.",
 "Trzy funkcje weszły do zestawu obowiązkowego po odczycie, bo w żadnej wcześniejszej wersji "
 "rejestru ich nie było, mimo że są elementarne: rejestr przyjmowanych leków wraz z alergiami i "
 "przeciwwskazaniami, wywiad rodzinny — najsilniejszy predyktor w każdym modelu ryzyka za koszt "
 "jednego pola formularza — oraz mapa i skale bólu, czyli najczęstszy powód wizyty u lekarza.",
 "Dostępność podstawowa nie jest funkcją opcjonalną: aplikacje konsumenckie w Unii podlegają "
 "wymogom dostępności i brak ich spełnienia jest wadą prawną, nie brakiem uprzejmości wobec "
 "użytkownika.",
]

S11 = [
 "Eternal Station jest urządzeniem stacjonarnym i pierwszym punktem, w którym projekt spotyka "
 "się z reżimem wyrobu w sposób nieunikniony — pomiar biochemiczny nie da się opisać jako "
 "wellness, jeżeli wynik ma jakąkolwiek wartość kliniczną.",
 "Konsekwencją jest rozdzielenie ścieżek: sensory środowiskowe i pomiar podstawowy mogą działać "
 "w warstwie A, biochemia i dozowanie nie mogą. Stacja jest zatem projektowana jako dwa urządzenia "
 "w jednej obudowie, z walidowanym interfejsem między nimi, a nie jako jedno urządzenie o "
 "mieszanym przeznaczeniu. Wariant mieszany oznaczałby dziedziczenie klasy przez całość.",
 "Model dostarczenia sprzętu jest rozstrzygnięty na korzyść partnera OEM. Własna linia "
 "produkcyjna jest w tym projekcie odrzucona nie ze względu na koszt jednostkowy, tylko ze "
 "względu na czas: certyfikacja własnego sprzętu i certyfikacja oprogramowania toczyłyby się "
 "równolegle, a zespół zdolny prowadzić obie naraz jest większy niż zespół, który realnie "
 "zbudujemy.",
 "Ekonomia stacji opiera się na wkładach, nie na sprzedaży urządzenia. Urządzenie sprzedawane "
 "jednorazowo jest przychodem jednorazowym; wkłady są przychodem powtarzalnym. Ten sam mechanizm "
 "działa w modelu sprzętu jako usługi, który jest wariantem preferowanym tam, gdzie klient nie "
 "chce wydatku inwestycyjnego.",
]

S12 = [
 "Eternal Capsule to warstwa najdalej wysunięta technologicznie i jednocześnie ta, w której "
 "specyfikacja jest najbardziej ostrożna. Rozróżnienie między identyfikacją i podstawowym "
 "monitoringiem a terapią celowaną jest tu granicą klasy wyrobu, a nie etapem rozwoju produktu.",
 "Zastosowanie weterynaryjne ma odrębny reżim i odrębny rynek. Identyfikacja zwierząt normą "
 "ISO 11784 i nadzór weterynaryjny nad produktami leczniczymi to ścieżka niezależna od MDR i "
 "wchodzi wcześniej, bo nie wymaga jednostki notyfikowanej dla wyrobów medycznych.",
 "Zastosowanie u ludzi wchodzi w horyzoncie odległym i wyłącznie ścieżką certyfikacyjną. "
 "Wszystkie warianty zakładające implantację poza tą ścieżką — masową, domyślną, powiązaną z "
 "dostępem do świadczeń albo z jakąkolwiek funkcją nadzorczą — są wyłączone z projektu na "
 "poziomie specyfikacji kanonicznej i nie są w tym dokumencie rozwijane.",
]

S13 = [
 "Eternal Digital Twin obejmuje trzy rzeczy, które łatwo pomylić: dokumentację medyczną, model "
 "predykcyjny i archiwum osobowe. Tylko pierwsza z nich ma dziś rynek, ścieżkę regulacyjną i "
 "termin zewnętrzny, który ją napędza.",
 "Elektroniczna dokumentacja medyczna jest w tej grupie funkcją najważniejszą operacyjnie, bo "
 "to z niej wywodzi się produkt mapujący między implementacją krajową a formatem europejskim. "
 "Model predykcyjny jest funkcją najbardziej obciążoną regulacyjnie — predykcja stanu zdrowia "
 "jest wyrobem medycznym niemal w każdym sformułowaniu.",
 "Archiwum osobowe, w wersjach wcześniejszych opisywane jako cyfrowa nieśmiertelność, zostaje "
 "w rejestrze jako funkcja subskrypcyjna poza rdzeniem pacjenta. Jest to jeden z nielicznych "
 "kanałów, w których użytkownik płaci wprost, bo wartość jest emocjonalna i nie konkuruje z "
 "usługą darmową.",
]

S14 = [
 "Eternal Matrix jest warstwą badawczą i infrastrukturalną, nie produktem konsumenckim. Jej "
 "funkcje wchodzą do obiegu w postaci danych zagregowanych i zanonimizowanych oraz jako "
 "infrastruktura dla badań zdecentralizowanych.",
 "Kanał badawczy ma najwyższą marżę w całym zestawieniu i najniższą przewidywalność. Sponsor "
 "badania płaci za dostęp do kohorty i za jakość danych, a nie za liczbę użytkowników — dlatego "
 "jest to jedyny kanał, w którym przychód nie skaluje się liniowo z bazą.",
 "Rejestr, nadzór po wprowadzeniu do obrotu i wsparcie certyfikacyjne dla podmiotów trzecich to "
 "funkcje, które stają się dostępne dopiero po tym, jak sami przejdziemy ścieżkę certyfikacyjną. "
 "Kolejność jest nieodwracalna: nie da się sprzedawać wsparcia w procesie, którego się nie "
 "przeszło.",
]

S15 = [
 "Katalog klas komponentów opisuje dwadzieścia osiem klas, a każda ma trzy warianty: A — "
 "najtańszy start, B — wariant pośredni, C — wariant docelowy. Do każdej klasy przypisany jest "
 "próg wyjścia, czyli warunek liczbowy albo zdarzeniowy, po którym przechodzi się do wariantu "
 "wyższego, oraz mechanizm kontroli, czyli sposób sprawdzenia, że dostawca nie stał się "
 "niewymienialny.",
 "Zasada nadrzędna brzmi: dostawca startowy nie jest zobowiązaniem na zawsze. Konsekwencją jest "
 "wymóg, żeby każda integracja miała mapowanie po naszej stronie i żeby żaden format zewnętrzny "
 "nie był zapisywany w bazie w postaci źródłowej.",
 "Decyzja budować–kupić–zintegrować zapada według czterech kryteriów w stałej kolejności. "
 "Pierwsze: czy komponent jest w rdzeniu wartości, czyli czy klient płaci za niego, czy za to, "
 "co on umożliwia. Drugie: czy jego wymiana po dwóch latach będzie wykonalna. Trzecie: czy jego "
 "certyfikacja jest po naszej stronie, czy po stronie dostawcy. Czwarte: koszt — dopiero jako "
 "ostatnie, bo koszt bez trzech poprzednich odpowiedzi jest liczbą bez znaczenia.",
 "Przykład rozstrzygnięty w tym dokumencie: własne opaski przegrywają z gotowymi urządzeniami "
 "rynkowymi na każdym z czterech kryteriów. Wartość jest w korelacji danych, nie w pomiarze; "
 "wymiana dostawcy opaski jest łatwa, jeżeli mapowanie jest nasze; certyfikacja pozostaje po "
 "stronie producenta opaski; a koszt własnej produkcji jest wielokrotnie wyższy. Wniosek "
 "obowiązuje aż do momentu, w którym producenci przestaną udostępniać dane surowe.",
 "Moduły kontrolne K1–K14 to warstwa orkiestracji: rzeczy, które trzeba zbudować, żeby reszta "
 "dała się kontrolować. Nie mają wartości sprzedażowej i dlatego są w projektach tego typu "
 "systematycznie pomijane w budżecie. Orkiestracja w wersji minimalnej to 395 osobodni i około "
 "316 tysięcy złotych — pominięcie tej pozycji było jednym z siedmiu udokumentowanych błędów "
 "wcześniejszych wycen.",
]

S16 = [
 "Roadmapa ma pięć horyzontów i pięć równoległych torów. Tory to: sprzedaż, struktura prawna, "
 "integracja z systemem państwowym, produkt oraz zgodność. Prowadzenie ich równolegle nie jest "
 "ambicją — jest koniecznością, bo każdy z nich ma zależność zewnętrzną o własnym czasie "
 "oczekiwania, którego nie da się skrócić pracą.",
 "Horyzont zerowy trwa do końca 2026 roku i ma jeden cel: rozstrzygnąć, czy ktokolwiek za to "
 "zapłaci, zanim zostanie zbudowane cokolwiek drogiego. Czterdzieści rozmów, pięć podpisanych "
 "zobowiązań, produkt u pięciu użytkowników, wniosek o wpis do rejestru podmiotów leczniczych "
 "i podpisany statut fundacji.",
 "Bramki są wiążące i mają wpisaną konsekwencję niepowodzenia. Brak dwudziestu zamkniętych "
 "rozmów do 15 września oznacza zatrzymanie toru produktowego i zmianę produktu. Brak pięciu "
 "podpisanych zobowiązań do 15 października oznacza zatrzymanie budowy — dalsze budowanie bez "
 "zobowiązań jest spalaniem pieniędzy, a nie inwestycją. Brak statutu do 31 grudnia nie zatrzymuje "
 "prac, ale przesuwa negocjacje na gorszą pozycję.",
 "Horyzonty od pierwszego do trzeciego prowadzą kolejno: pierwszy przychód powtarzalny z "
 "dokumentacji i weterynarii, pokrycie kosztu zespołu z przychodu własnego, a następnie okno "
 "regulacyjne roku 2029. Horyzont czwarty obejmuje pozycje odłożone — wraca do nich się wtedy i "
 "tylko wtedy, gdy spełniony jest zapisany warunek reaktywacji.",
 "Rzeczy, których nie robimy, są w roadmapie wymienione z nazwy. Lista „nie robimy” jest równie "
 "wiążąca jak lista zadań, bo w projekcie o tej liczbie funkcji największym ryzykiem "
 "harmonogramowym nie jest opóźnienie, tylko rozpłynięcie się zakresu.",
]

S17 = [
 "Cykl życia oprogramowania w projekcie, który zmierza do certyfikacji, musi być udokumentowany "
 "od początku, a nie od momentu decyzji o certyfikacji. Odtworzenie historii zmian, przeglądów i "
 "decyzji projektowych wstecz jest niewykonalne i jest najczęstszą przyczyną, dla której projekty "
 "programistyczne nie przechodzą do wyrobu.",
 "Minimalny zestaw obowiązujący od pierwszego dnia: kontrola wersji z czytelną historią, przegląd "
 "kodu przed scaleniem, testy jednostkowe funkcji przetwarzających dane zdrowotne, rejestr decyzji "
 "architektonicznych z datą i uzasadnieniem, rejestr komponentów obcych z wersjami i licencjami.",
 "Testy funkcji granicznych mają dodatkowy wymóg: sprawdzenie, czy komunikat wyjściowy nie "
 "zawiera sformułowania z listy zakazanej. Test ten jest automatyczny i blokujący — jest to "
 "jedyne miejsce, w którym reguła regulacyjna została zamieniona na test jednostkowy.",
 "Walidacja modelu językowego odbywa się na zestawie pytań z odpowiedziami wzorcowymi, "
 "aktualizowanym przy każdej zmianie wersji modelu. Miarą nie jest trafność odpowiedzi, tylko "
 "odsetek odpowiedzi z poprawnym cytowaniem i odsetek poprawnych odmów odpowiedzi.",
]

S18 = [
 "Odporność operacyjna sprowadza się w tym systemie do jednego pytania: co widzi użytkownik, gdy "
 "coś nie działa. Odpowiedź musi być zaprojektowana, a nie pozostawiona przypadkowi, bo w "
 "kontekście zdrowotnym cisza systemu jest interpretowana jako informacja.",
 "Tryb degradacji jest funkcją produktu, nie procedurą zespołu. Przy niedostępności modelu albo "
 "chmury aplikacja pokazuje dane własne użytkownika i wyraźnie informuje, które funkcje są "
 "wyłączone. Nie pokazuje odpowiedzi wygenerowanej z pamięci podręcznej jako bieżącej.",
 "Obserwowalność obejmuje trzy poziomy: dostępność usług, jakość danych per użytkownik i "
 "skuteczność synchronizacji per dostawca. Trzeci poziom jest w tym systemie ważniejszy niż w "
 "typowej aplikacji, bo cicha awaria jednego adaptera nie powoduje błędu — powoduje wykres z "
 "dziurą, którą użytkownik weźmie za zmianę stanu zdrowia.",
 "Obsługa incydentu bezpieczeństwa ma terminy narzucone zewnętrznie i wymaga przygotowanego "
 "trybu zgłoszeniowego przed pierwszym incydentem. Zgłoszenie przygotowywane w trakcie incydentu "
 "jest zgłoszeniem spóźnionym.",
]

S19 = [
 "Sekcja zbiera to, czego nie da się jeszcze rozstrzygnąć, oraz to, co zostało rozstrzygnięte "
 "wbrew brzmieniu części źródeł. Jedno i drugie jest w dokumencie celowo: decyzja ukryta wraca "
 "jako spór w najgorszym momencie.",
 "Rozstrzygnięcia wbrew źródłom: kanonem specyfikacji jest Master 5.4, nie plik opisany jako "
 "3.1; szkieletem biznesowym jest plan korporacyjny 5.1, nie biznesplan 4.0; produkt jest zbiorem "
 "pięciu do sześciu funkcji, nie modułem; aplikacja pacjenta jest darmowa w całości, mimo że w "
 "korpusie występują trzy różne cenniki subskrypcji; prognoza pięcioletnia zostaje wycofana do "
 "czasu pierwszych sześciu miesięcy sprzedaży.",
 "Otwarte decyzje wymagające danych, których nie mamy: wartość życiowa użytkownika przy modelu "
 "darmowym, realny koszt pozyskania w kanale gabinetowym, gotowość dostawców systemów "
 "gabinetowych do zakupu mappera przed terminem oraz kształt struktury podmiotu w wariancie "
 "fundacyjnym. Każda z nich ma przypisany moment rozstrzygnięcia i osobę odpowiedzialną.",
 "Kryterium akceptacji dla całości dokumentacji: każda funkcja w rejestrze ma kod, warstwę, "
 "priorytet, właściciela i kryterium akceptacji; każda liczba ma źródło; każda sprzeczność ma "
 "rozstrzygnięcie albo status otwarty z terminem. Dokument, który tego nie spełnia, jest wersją "
 "roboczą niezależnie od tego, co ma napisane na okładce.",
]

S20 = [
 "Produkt to pięć albo sześć funkcji z rejestru, dobranych tak, że razem robią jedną rzecz, "
 "której żadna z nich nie robi osobno. Kryteriów doboru jest sześć i muszą być spełnione łącznie: "
 "niezastępowalność, automatyzm, samorozwój, personalizacja, szerokie grono odbiorców oraz "
 "możliwość działania samodzielnego, poza ekosystemem.",
 "Kryterium ostatnie jest najtrudniejsze i najważniejsze. Produkt, który wymaga całego "
 "ekosystemu, żeby mieć sens, nie jest produktem — jest funkcją platformy. Każdy z sześciu "
 "produktów opisanych niżej daje się sprzedać osobno, bez pozostałych pięciu.",
 "Podział na moduły a podział na produkty to dwie różne operacje na tym samym zbiorze. Moduł "
 "grupuje funkcje według przeznaczenia technicznego; produkt grupuje je według jednego zadania "
 "użytkownika i jednego kanału płatności. Dlatego funkcje jednego produktu pochodzą z kilku "
 "modułów, a funkcje jednego modułu trafiają do kilku produktów.",
 "Ten sam mechanizm pozwala wyprowadzić produkty dla kolejnych nisz i branż bez pisania nowych "
 "funkcji: wystarczy inna korelacja pięciu albo sześciu pozycji rejestru, inny język interfejsu "
 "i inny kanał sprzedaży. Zestawienie nisz znajduje się na końcu tej sekcji wraz z zasadą, która "
 "mówi, kiedy nisza jest warta osobnego produktu, a kiedy jest wariantem istniejącego.",
]

S21 = [
 "Proweniencja jest w tym dokumencie prowadzona na poziomie ustalenia, nie pliku. Oznacza to, "
 "że wskazujemy, skąd pochodzi rozstrzygnięcie, a nie z ilu plików dało się je złożyć — bo "
 "liczba plików powtarzających to samo nie zwiększa wiarygodności ustalenia.",
 "Pełny indeks 159 plików korpusu wraz z informacją, co z każdego zostało wzięte i czy plik jest "
 "wersją obowiązującą, pozostaje w dokumencie archiwalnym. Tutaj podane są wyłącznie źródła "
 "obowiązujące oraz źródła zewnętrzne użyte do aktualizacji stanu prawnego i rynkowego.",
 "Stan prawny został zweryfikowany na dzień sporządzenia dokumentu. Zmiana stanu wykryta później "
 "wymaga przeglądu sekcji SPEC-03 i SPEC-09 — pozostałe sekcje są od stanu prawnego niezależne "
 "poza zakresem, który same wskazują.",
]

ZRODLA_ZEW = [
 ["Obszar", "Źródło", "Data stanu"],
 ["Wyroby medyczne", "Rozporządzenie MDR (UE) 2017/745; MDCG 2019-11 rev. 1", "2026"],
 ["Dane osobowe", "RODO (UE) 2016/679 — art. 9, 17, 22", "2026"],
 ["Sztuczna inteligencja", "AI Act (UE) 2024/1689 — zał. III, art. 50", "2026"],
 ["Dane zdrowotne", "EHDS (UE) 2025/327; format EEHRxF — kategoria 1 i 2", "2026"],
 ["Cyberbezpieczeństwo", "Dyrektywa NIS2 (UE) 2022/2555 i ustawa o KSC", "2026"],
 ["Wymiana danych", "HL7 FHIR R4B; SNOMED CT; LOINC", "2026"],
 ["System publiczny PL", "Centrum e-Zdrowia — e-Profil Pacjenta, RPWDL 2.0, certyfikat integracji", "2026"],
 ["Finanse publiczne", "Wydatki publiczne na zdrowie 2026: 247,8 mld zł (6,81% PKB); luka 23 mld zł", "2026"],
 ["Profilaktyka", "Wydatki na profilaktykę: 21,6 EUR na mieszkańca wobec 202 EUR średniej UE", "2026"],
 ["Koszty certyfikacji", "PCBC — cennik oceny dokumentacji technicznej MDR", "2026"],
 ["Benchmark produktowy", "Neko Health; Forward Health (zamknięcie 13.11.2024)", "2024–2026"],
 ["Upadek kategorii", "LunaDNA (31.01.2024), Nebula (2025) — sprzedaż danych genetycznych", "2024–2025"],
]

ANEKS_A_NOTA = [
 "Aneks zawiera pełny rejestr operacyjny — 337 pozycji z kodem, nazwą, produktem, modułem, "
 "etapem, warstwą regulacyjną, priorytetem i kanałem przychodu — oraz pełne karty funkcji dla "
 "wszystkich pozycji priorytetu P0.",
 "Karty pozostałych pozycji, w tym samym szablonie osiemnastopolowym, znajdują się w dokumencie "
 "kart funkcji. Rozdzielenie jest celowe: specyfikacja ma być czytana w całości, a 337 pełnych "
 "kart to objętość, której nikt nie czyta w całości.",
 "Szablon karty jest stały i ma osiemnaście pól: cel, problem, użytkownik, opis funkcji, wejście, "
 "wyjście, przebieg użytkownika, integracje, API, dane, uprawnienia, bezpieczeństwo, regulacje, "
 "status wyrobu medycznego, kryteria akceptacji, priorytet, status realizacji i właściciel.",
]
