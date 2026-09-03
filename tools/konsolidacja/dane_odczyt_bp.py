# -*- coding: utf-8 -*-
"""Ustalenia biznesowe z pełnego odczytu korpusu (D001–D076).

Źródło: tools/konsolidacja/odczyt/USTALENIA_ODCZYT.md. Wyłącznie te ustalenia,
które należą do sekcji BIZNESPLAN i których nie ma w blokach źródłowych
przenoszonych dosłownie — bo powstały z zestawienia wielu plików albo prostują
treść źródłową.
"""

HIERARCHIA = [
 ["Zakres", "Dokument obowiązujący", "Zastępuje"],
 ["Szkielet biznesowy", "#123 Plan Korporacyjny 5.1 (30 903 zn., 30.08.2026) — "
  "numeracja 5.x zgodna ze Specyfikacją Master 5.4",
  "#122 Biznesplan 4.0 (29 836 zn.)"],
 ["Układ inwestorski i aparat źródłowy",
  "#122 Biznesplan 4.0 — zachowuje wartość jako gotowy układ prezentacji dla inwestora "
  "medtech oraz jako jedyne miejsce z pełnym wykazem podstaw prawnych",
  "biznesplan rozszerzony 2.0 i wersja 3.0"],
 ["Rdzeń narracyjny", "#145 Biznesplan rozszerzony (403 702 zn.) — komplet 185 kart funkcji",
  "—"],
 ["Warstwa operacyjna", "#158 Plan PWNŚ — 188 punktów z narzędziami, czasem, "
  "odpowiedzialnością, partnerami i kosztami w cenach rynkowych PL 2026",
  "—"],
 ["Portfel projektów", "#128 Macierz 40 Projektów v2",
  "Macierz skondensowana v3 (#65) — v3 kondensuje, nie zastępuje"],
 ["Kalendarz kamieni milowych", "kalendarz z Planu PWNŚ jako bazowy",
  "kalendarz z roadmap v2–v5 — rozbieżność ok. 1,5 roku dla tego samego kamienia"],
]

STRESZCZENIE = [
 ["Wymiar", "Ustalenie"],
 ["Co sprzedajemy", "dokumentację dla klinik, oprogramowanie weterynaryjne, "
  "interoperacyjność, certyfikację zgodności i dane wynikowe"],
 ["Kto płaci", "podmiot leczniczy, integrator systemów EDM, producent wyrobu, "
  "sponsor badania. Pacjent nie płaci"],
 ["Pierwsza fala", "Eternal Pet (7/7 wg kryteriów własnych) i Eternal Scribe (5/7), "
  "poprzedzone społecznością"],
 ["Fosa", "status podmiotu leczniczego — kto wytworzył dokumentację, ma do niej dostęp "
  "z mocy ustawy"],
 ["Okno rynkowe", "26 marca 2029 — obowiązek CE dla systemów EDM w reżimie EEHRxF"],
 ["Czego potrzebujemy", "około 200 tys. PLN na domknięcie struktury i pierwszy przychód. "
  "Nie rundy kapitałowej"],
 ["Kiedy wiemy, że działa", "pięć zobowiązań w 2 miesiące, pięciu płacących w 6, "
  "pokrycie kosztu zespołu w 18"],
]

PROBLEM_SKALA = [
 ["Wskaźnik", "Wartość", "Charakter"],
 ["Wydatki publiczne na zdrowie 2026", "247,8 mld zł — 6,81% PKB", "tło"],
 ["Leczenie szpitalne", "100,1 mld zł — 46,1% kosztów świadczeń", "tło"],
 ["Luka finansowa 2026", "23 mld zł", "tło"],
 ["Prognoza luki 2040", "171 mld zł — 3,4% PKB", "tło"],
 ["Hospitalizacje możliwe do uniknięcia", "8–10 mld zł rocznie",
  "problem informacyjny, nie medyczny"],
 ["Dublowanie badań diagnostycznych", "6–8 mld zł rocznie",
  "problem informacyjny, nie medyczny"],
 ["Wydatki na profilaktykę", "21,6 EUR na mieszkańca wobec 202 EUR średniej unijnej",
  "dziewięciokrotna różnica"],
]

PROBLEM_TEZA = (
 "Dwie pozycje środkowe — razem 14–18 mld zł rocznie — to problemy o charakterze "
 "informacyjnym, nie medycznym. Dokładnie te, które adresuje otwarty system agregujący "
 "dane. To najmocniejszy argument rynkowy w całym korpusie i jedyny, który wiąże wielkość "
 "problemu z rodzajem rozwiązania, a nie tylko z wielkością rynku.")

LUKA = (
 "Aktywność państwa jest populacyjna, nie indywidualna. Ankieta ta sama dla wszystkich, "
 "program profilaktyczny ten sam, przypomnienie identyczne. Państwo mówi, co się zdarzyło "
 "i kiedy masz przyjść. Nie mówi, co to znaczy dla ciebie. To jest cała dostępna luka "
 "i ona nie zamyka się do 2030. Dowód empiryczny: Portfel Aplikacji Zdrowotnych ma warunek "
 "bezpłatności dla każdego użytkownika — efektem są dwie aplikacje w portfelu i określenie "
 "„fiasko” w prasie branżowej. Państwo próbowało wejść w rolę prywatnych aplikacji "
 "i mu się nie udało.")

BILANS_PANSTWO = [
 ["Kategoria funkcji", "Ile", "Wniosek"],
 ["Zajęte przez państwo", "~18", "nie konkurujemy"],
 ["Zajęte częściowo", "~26", "integrujemy się"],
 ["Puste", "~105", "to jest pole gry"],
 ["Poza zakresem systemu publicznego", "~36", "weterynaria, wellness, badania"],
]

BILANS_WZORZEC = (
 "Państwo zajęło funkcje najtańsze do zbudowania i o najwyższym wolumenie — czyli te, "
 "od których startup normalnie zaczyna. Zostawiło drogie i trudne. To odwrotność "
 "sekwencji, którą chce się mieć, i to jest właściwy problem, a nie sama konkurencja.")

SEGMENTY = [
 ["Segment", "Wielkość", "Nasza dostępna część", "Uwaga"],
 ["Podmioty lecznicze w Polsce", "dziesiątki tysięcy",
  "gabinety i małe placówki bez własnego działu IT",
  "płatnik decyzyjny to jedna osoba, nie komisja"],
 ["Dostawcy systemów gabinetowych i szpitalnych", "kilkudziesięciu",
  "wszyscy — każdy musi spełnić wymóg do 2029",
  "rynek zamknięty liczbowo, ale każdy klient jest duży"],
 ["Lecznice weterynaryjne", "tysiące", "wszystkie", "zero obecności państwa"],
 ["Właściciele zwierząt", "miliony gospodarstw domowych", "segment konsumencki",
  "jedyny segment konsumencki, w który wchodzimy"],
 ["Producenci wyrobów medycznych", "setki w regionie",
  "ci, którzy potrzebują danych nadzoru porynkowego", "sprzedaż obowiązku, nie produktu"],
 ["Sponsorzy badań klinicznych", "dziesiątki działających w Polsce",
  "badania zdecentralizowane", "najwyższa marża, płatnik instytucjonalny"],
 ["Pacjenci", "ponad 20 mln kont w systemie państwowym", "nie jest naszym płatnikiem",
  "kanał dystrybucji i rekrutacji"],
]

ZASADA_RYNKU = (
 "CELOWO NIE PODAJEMY GLOBALNYCH LICZB RYNKU. Wcześniejsze materiały operowały wartościami "
 "rzędu bilionów dolarów przy strategii ograniczonej do Polski. Taka rozbieżność między "
 "wielkością rynku a zasięgiem działania jest w rozmowie z inwestorem sygnałem "
 "ostrzegawczym, nie atutem. Podajemy segmenty, do których realnie docieramy. "
 "Ta zasada obowiązuje także w materiałach prezentacyjnych.")

KANALY = [
 ["Kanał", "Kto płaci", "Za co", "Model"],
 ["Eternal Scribe", "klinika", "dokumentacja wizyty", "licencja per lekarz miesięcznie"],
 ["Eternal Pet", "właściciel i lecznica", "subskrypcja i transponder",
  "freemium → subskrypcja → sprzęt"],
 ["Mapper interoperacyjności", "dostawcy systemów, placówki",
  "zgodność z terminem 2029", "licencja per placówka i wdrożenie"],
 ["Świadczenia własne", "pacjent albo płatnik", "teleporada, zlecone badania",
  "za świadczenie"],
 ["Marketplace", "apteka, laboratorium, dostawca", "transakcja z kontekstem", "prowizja"],
 ["Certyfikacja zgodności", "producent urządzenia", "wpis do rejestru, testy",
  "opłata roczna i test"],
 ["Nadzór porynkowy", "producent wyrobu", "dane nadzoru po wprowadzeniu",
  "kontrakt roczny"],
 ["Badania zdecentralizowane", "sponsor badania", "infrastruktura zbierania danych",
  "kontrakt na badanie"],
 ["Wersje konsumenckie", "użytkownik", "rozszerzona funkcjonalność",
  "finansowanie pomostowe lat 1–2, nie oś przychodu"],
]

RANKING_PRZYCHODU = [
 ["Typ przychodu", "Ocena"],
 ["Abonament instytucjonalny", "najlepszy — decyduje jedna osoba, nie komisja"],
 ["Materiał zużywalny", "bardzo dobry — sprzęt jest nośnikiem, nie towarem"],
 ["Kontrakt badawczy", "bardzo dobry — płaci za ciągłość, której nikt nie ma"],
 ["Licencja na zdolność", "dobry po udowodnieniu skuteczności"],
 ["Prowizja", "dobry jako uzupełnienie, zły jako źródło główne"],
 ["Abonament konsumencki", "najsłabszy — najwyższy koszt pozyskania i odejścia"],
 ["Marża sprzętowa", "nigdy jako źródło główne"],
 ["Nigdy płatne", "eksport danych, warstwa kryzysowa, format zapisu"],
]

MARZA_TEZA = (
 "Najwyżej marżowe produkty nie są skierowane do pacjenta: parser dla laboratoriów, "
 "dokumentacja dla klinik, kohorta, protokół, dane nadzoru. Wszystkie powstają jako "
 "produkt uboczny czegoś, co i tak budujemy. Aplikacja konsumencka jest kanałem "
 "dystrybucji i rekrutacji, nie produktem.")

MODEL_ODRZUCONY = (
 "MODEL ODRZUCONY — sprzedaż danych użytkownika z prowizją. Powód jest podwójny. "
 "Rynkowy: kategoria upadła, LunaDNA została zamknięta 31 stycznia 2024, Nebula "
 "przekształcona w 2025. Prawny: zgoda w rozumieniu RODO nie może być kupiona ani "
 "stanowić warunku usługi (art. 7 ust. 4). To unieważnia model 80/20 w wersji pieniężnej. "
 "Wersje, które przetrwały tę weryfikację: świadczenie w naturze zamiast wynagrodzenia "
 "pieniężnego oraz wkład danych do konsorcjum badawczego w zamian za udział w wyniku "
 "i we własności intelektualnej — „zamiast transakcji tworzy współwłasność”.")

MARZA_SPRZET = [
 ["Parametr", "Wartość"],
 ["Marża na sprzęcie noszonym", "15–25%, przy naszym wolumenie bliżej 15%"],
 ["Cykl życia produktu", "18–24 miesiące, potem projekt od nowa"],
 ["Minimalna partia", "tysiące sztuk, kapitał zamrożony w magazynie"],
 ["Przewaga konkurencji", "cztery rzędy wielkości wolumenu"],
 ["Czas do przychodu", "18–24 miesiące od decyzji"],
 ["Warstwa agregacji dla porównania",
  "2–3 miesiące do działającej wersji, marża programowa, brak zamrożonego kapitału"],
]

ARYTMETYKA_ABO = [
 ["Cena", "Płacących potrzeba na 10 mln zł rocznie",
  "Zarejestrowanych przy konwersji 2%", "przy 5%"],
 ["20 zł/mies.", "41 700", "2,1 mln", "834 tys."],
 ["49 zł/mies.", "17 000", "850 tys.", "340 tys."],
 ["99 zł/mies.", "8 400", "420 tys.", "168 tys."],
]

ARYTMETYKA_WNIOSEK = (
 "Przy cenie 49 zł potrzeba od 340 do 850 tysięcy zarejestrowanych, czyli 1–2% populacji "
 "Polski. Cel na czwarty kwartał 2026 to tysiąc użytkowników — do celu abonamentowego "
 "brakuje trzech rzędów wielkości. Do tego lejek retencji w całej kategorii jest niski: "
 "aktywni po 30 dniach 10–25%, po roku 3–10%, płacący 2–5% zarejestrowanych. "
 "Dlatego przychód abonamentowy jest ostatnim, nie pierwszym zasobem.")

ZASOBY = [
 ["Zasób", "Skala potrzebna", "Kiedy"],
 ["Skrócenie ścieżki badawczej", "kohorta zwierzęca kilku tysięcy", "2029"],
 ["Wiarygodność naukowa i granty", "kohorta 1000 osób z pełnym zapisem", "2029"],
 ["Pozycja negocjacyjna wobec płatnika", "10 tys. zaangażowanych", "2030"],
 ["Przychód abonamentowy", "340 tys. – 2,1 mln zarejestrowanych", "2033+"],
]

ZASOB_GLOWNY = (
 "Największym zasobem otwartego systemu nie są abonamenty, tylko skrócenie ścieżki "
 "badawczej o 5–10 lat. Koszt etapu implantu bez walidacji na torze weterynaryjnym to "
 "4–6 mln zł, z walidacją 2–3 mln — oszczędność bezpośrednia 2–3 mln zł plus wartość "
 "pięciu lat wcześniejszego wejścia na rynek CGM, gdzie samych diabetyków jest 500 tys. "
 "w Polsce i 10 mln w Unii. To jest zasób nieporównywalnie większy niż jakikolwiek "
 "przychód abonamentowy osiągalny w tym samym czasie.")

GLEBIA = (
 "GŁĘBIA ZAMIAST SZEROKOŚCI. Zbiory publiczne to przekroje — pojedyncze zdarzenia "
 "rozrzucone w czasie. Nikt nie ma ciągłości. Do wnioskowania przyczynowego potrzeba tej "
 "samej osoby przed i po, wielokrotnie. Milion przekrojów tego nie da; tysiąc ciągłych "
 "historii — da. Wniosek operacyjny: cel przestaje brzmieć „jak najwięcej użytkowników”, "
 "a zaczyna „jak najwięcej użytkowników prowadzących zapis nieprzerwanie”. To zmienia "
 "metrykę główną produktu z liczby rejestracji na ciągłość zapisu.")

ZRODLA_FINANSOWANIA = [
 ["Kolejność", "Źródło", "Uwaga"],
 ["1", "przepływ z działalności powtarzalnej — oprogramowanie weterynaryjne, dokumentacja",
  "dostępne od pierwszego roku"],
 ["2", "środki bezzwrotne — granty i konsorcja", "nie rozwadniają, dają wiarygodność"],
 ["3", "kapitał cierpliwy — biura rodzinne, fundacje, partnerzy strategiczni", ""],
 ["4", "przychód konsumencki", "dopiero przy zbudowanej społeczności"],
 ["NIE", "kapitał wysokiego ryzyka do spółki-matki",
  "czas życia funduszu jest krótszy niż horyzont przedsięwzięcia; wyłącznie do spółek "
  "celowych pod konkretne produkty sprzętowe"],
]

WCZESNY_PRZYCHOD = [
 ["Źródło", "Kiedy", "Ile rocznie", "Warunek"],
 ["Usługi regulacyjne Hubu", "od kwartału 2", "600 tys. – 1,2 mln zł",
  "kompetencja, którą i tak budujemy dla własnych wyrobów"],
 ["Oprogramowanie dla lecznic", "rok 1", "1–3 mln zł", "15–50 klientów"],
 ["Odczyt dokumentów dla placówek", "rok 3", "2–5 mln zł",
  "skuteczność powyżej ręcznego przepisywania"],
 ["Abonamenty i prowizje", "rok 2–4", "3–10 mln zł", "skala"],
]

CENNIK_HUB = [
 ["Usługa regulacyjna", "Wycena rynkowa", "Czas"],
 ["Kwalifikacja i klasyfikacja", "5–15 tys. zł", "2–4 tygodnie"],
 ["Dokumentacja techniczna — wyrób prostszy", "30–80 tys. zł", "2–4 miesiące"],
 ["Dokumentacja techniczna — wyrób złożony", "100–250 tys. zł", "6–12 miesięcy"],
 ["Ocena kliniczna", "20–60 tys. zł", "2–3 miesiące"],
 ["Wdrożenie systemu jakości", "40–100 tys. zł", "4–8 miesięcy"],
]

CENNIK_HUB_WNIOSEK = (
 "Przy zespole trzech osób i dwunastu projektach rocznie: przychód 600 tys. – 1,2 mln zł "
 "przy koszcie osobowym 400–500 tys. To najwcześniejsze źródło przychodu w całym "
 "przedsięwzięciu — nie wymaga zbudowania żadnego produktu.")

DZWIGNIA = [
 ["Forma dźwigni niepieniężnej", "Co finansuje", "Kiedy dostępna"],
 ["Własność wiedzy podstawowej", "licencjonowanie do partnerów", "2029"],
 ["Depozyt danych", "wkład do konsorcjum zamiast kapitału", "2030"],
 ["Wiarygodność naukowa", "granty i konsorcja", "2029"],
 ["Miejsce w standardzie", "kontrakty publiczne", "2031"],
 ["Efekt sieci", "przychód abonamentowy", "2028"],
 ["Neutralność", "udział w wyniku partnerstw", "2032"],
]

DZWIGNIA_WARUNEK = (
 "Najsilniejsza z tych form — dobrowolnie powierzony depozyt danych — ma warunek pozornie "
 "ją osłabiający: możliwość odejścia z pełnym zapisem bez konsekwencji. Jeśli ludzie "
 "zostają, bo chcą, dźwignia jest prawdziwa. Jeśli zostają, bo nie mogą wyjść, jest "
 "policzona na kilka lat.")

KONTROLA8 = [
 ["Mechanizm", "Konstrukcja", "Koszt", "Siła kontroli"],
 ["Udział za dane", "wnosimy kohortę, obejmujemy 5–15% udziałów", "zero", "wysoka"],
 ["Wąskie gardło", "finansujemy badania nad zasilaniem implantu, nie nad implantem",
  "100–300 tys. zł rocznie", "bardzo wysoka"],
 ["Zespół akademicki z prawami do wyniku",
  "stypendium i umowa o prawa do zastosowań", "100–300 tys. zł rocznie", "wysoka"],
 ["Protokół", "urządzenia mówią naszym protokołem", "150–250 tys. zł jednorazowo",
  "wysoka"],
 ["Partner walidacyjny", "prowadzimy walidację, zachowujemy prawa do wyników",
  "infrastruktura własna", "wysoka"],
 ["Umowa opcyjna", "płacimy mało teraz za licencję później na dziś ustalonych warunkach",
  "20–100 tys. zł", "średnia"],
 ["Wyłączność terytorialna",
  "prawa do rynku środkowoeuropejskiego kupione przed dowodem skuteczności",
  "50–300 tys. zł", "średnia"],
 ["Pozycja orzekająca",
  "kto orzeka o zgodności modułu ze specyfikacją, ten ustala standard",
  "czas", "wysoka"],
]

KONTROLA_PLAN = [
 ["Rok", "Ruch", "Koszt"],
 ["2027", "rada i fundusz badawczy, obserwacja trzech dziedzin", "10 tys. zł"],
 ["2028", "finansowanie pierwszego zespołu akademickiego", "150 tys. zł"],
 ["2029", "protokół gotowy i opublikowany", "200 tys. zł"],
 ["2030", "pierwsza umowa udziału za dane", "zero"],
 ["2031", "opcje na dwie technologie", "150 tys. zł"],
 ["2032", "wyłączność terytorialna na jedną", "200 tys. zł"],
 ["", "RAZEM do 2032", "około 710 tys. zł za pozycję kontrolną w trzech dziedzinach, "
  "których nie budujemy"],
]

KONTROLA_WARUNEK = (
 "Warunek konieczny, bez którego żaden z tych mechanizmów nie zadziała: fundusz badawczy "
 "zasilany automatycznie stałym odsetkiem przychodu, poza kontrolą zarządu. Zarząd "
 "rozliczany z wyników bieżących nie sfinansuje badań o horyzoncie dwudziestoletnim — "
 "nie ze złej woli, tylko dlatego, że jest rozliczany z czegoś innego.")

MOONSHOT_ARYTMETYKA = (
 "Przy realnych kwotach moonshot w wariancie warstwowym kosztuje 250–900 tys. zł, nie "
 "dziesiątki milionów. Odpis 20% z przychodu 3 mln zł finansuje jeden taki moonshot, "
 "z 5 mln — jeden plus rezerwa, z 10 mln — wszystkie trzy równolegle. Skutek dla "
 "priorytetów jest jednoznaczny: każda złotówka wydana na przyspieszenie moonshotu przed "
 "osiągnięciem przychodu jest wydana źle, a każda wydana na przyspieszenie przychodu "
 "skraca drogę do wszystkich trzech naraz.")

WARIANTY_TANIE = [
 ["Obszar", "Wariant afiliacyjny", "Koszt", "Zamiast"],
 ["Laboratoria", "katalog i przekierowanie do sieci, wynik wprowadzany ręcznie",
  "10–15 tys. zł", "50 tys. zł za pełną integrację"],
 ["Sprzęt noszony", "agregacja cudzych urządzeń", "20–30 tys. zł",
  "300 tys. zł za własne ubranie mierzące"],
 ["Telemedycyna", "Jitsi w MVP, dostawca white label w MLP", "0–50 tys. zł",
  "200 tys. zł za własną platformę"],
 ["Hub", "rada i regulamin funduszu, Notion z Tally i Discordem", "0–10 tys. zł",
  "200 tys. zł za platformę"],
 ["Transkrypcja", "model otwarty na własnej infrastrukturze", "20–30 tys. zł",
  "budowa własnego modelu"],
 ["RAZEM", "", "50–135 tys. zł", "950 tys. zł — oszczędność 815 tys., czyli 86%"],
]

ZESTAW_PODSTAWOWY = [
 ["Element", "Co to jest", "Koszt", "Czas"],
 ["Agregator", "warstwa nad cudzymi urządzeniami", "20–30 tys. zł", "2 miesiące"],
 ["Ważenie pewności", "rozstrzyganie konfliktu odczytów między źródłami",
  "40–60 tys. zł", "2 miesiące"],
 ["Odczyt dokumentów", "parser polskich wyników", "100 tys. zł", "6–9 miesięcy"],
 ["Hub — usługi regulacyjne", "kompetencja sprzedawana na zewnątrz",
  "zero dodatkowego", "od razu"],
 ["Interfejsy", "eksport danych, potem usługa dla placówek", "40–50 tys. zł",
  "2 miesiące"],
 ["Rdzeń zapisu", "warunek wszystkiego", "200–300 tys. zł", "6 miesięcy"],
 ["RAZEM", "", "400–540 tys. zł", "9–12 miesięcy"],
]

BEZ_WARIANTU = [
 ["Element", "Dlaczego nie ma wariantu minimalnego"],
 ["Warstwa kryzysowa", "rozpoznanie, że komuś dzieje się źle, nie ma wersji uproszczonej"],
 ["Model zapisu danych", "skrót wymusza migrację całego zapisu za pięć lat"],
 ["Prawo wyjścia z danymi", "jest albo go nie ma; to jednocześnie jedyny wyróżnik "
  "wobec darmowej konkurencji weterynaryjnej"],
 ["Log dostępu", "musi istnieć od pierwszego dnia — wstecz się go nie odtworzy"],
]

BUDZET90 = [
 ["Pozycja", "Kwota"],
 ["Kancelaria — statut Fundacji i opinia MDR", "30–60 tys. zł"],
 ["Przegląd przez drugą kancelarię", "10–20 tys. zł"],
 ["Opinie prawne: retencja, farmaceutyczna, ubezpieczeniowa", "15–30 tys. zł"],
 ["Wpis do rejestru podmiotów leczniczych", "894 zł"],
 ["OC na spółkę, lokal, opinia sanitarna", "20–40 tys. zł"],
 ["Certyfikat integracji z platformą państwową", "bezpłatny"],
 ["Bazy słownikowe i licencje branżowe", "około 15 tys. zł rocznie"],
 ["Spotkanie przedzgłoszeniowe z jednostką notyfikowaną", "5–15 tys. zł"],
 ["Podróże i spotkania — czterdzieści rozmów", "5–10 tys. zł"],
 ["RAZEM, poza kosztem zespołu", "około 101–191 tys. zł"],
]

KOSZTY_STRUKTURA = [
 ["Kategoria", "Udział", "Uwaga"],
 ["Wynagrodzenia", "70–90%", "pozycja nieobecna w poprzednich modelach kosztowych"],
 ["Infrastruktura i usługi zewnętrzne", "5–15%", "rośnie z liczbą użytkowników"],
 ["Zgodność i prawo", "5–10%", "rośnie skokowo przy wejściu w warstwę oceny"],
 ["Sprzedaż i pozyskanie", "5–15%", "niskie przy sprzedaży bezpośredniej do instytucji"],
 ["Sprzęt", "0% do 2028", "rozpoznanie, bez zamówień"],
]

BLEDY_KOSZTOWE = [
 ["Błąd w poprzednich modelach kosztowych", "Skala"],
 ["Pominięty mnożnik trzydziestu dni przy usłudze agregacyjnej", "30×"],
 ["Zaniżona liczba tokenów przy modelu językowym", "75×"],
 ["Stawka podstawowa zamiast parsowania formularza", "10–20×"],
 ["Anotacja medyczna po 0,80 zł za dokument przy stawce rynkowej 5–50 zł", "10–50×"],
 ["Podwójne liczenie tych samych funkcji", "—"],
 ["Rozjazd sum w obrębie jednej tabeli", "2–3×"],
 ["Koszt certyfikacji", "zaniżony o rząd wielkości"],
 ["Brak wynagrodzeń w modelu", "najpoważniejszy — pozycja o największym udziale"],
]

KOREKTY = [
 ["Pozycja", "Zapis wcześniejszy", "Zapis poprawny"],
 ["Koszt pozyskania klienta (CAC)", "100 zł",
  "B2C 250–600 zł jako scenariusz bazowy dla nowej marki medtech; dobry viral 100–250 zł; "
  "premium health 500–1000+ zł; B2B 2–10 tys. zł na klienta, ale klient kupuje "
  "10–1000 urządzeń"],
 ["Konwersja freemium", "25–35%",
  "25–35% dotyczy konwersji PO UŻYCIU funkcji (OCR, agregacja); konwersja z całej bazy "
  "w healthtech to około 3,9%"],
 ["Terra API", "0,002 USD za synchronizację", "plany od 399–499 USD miesięcznie"],
 ["Certyfikat P1", "5 000 zł rocznie", "bezpłatny, ważność 2 lata"],
 ["Koszt certyfikacji MDR IIa", "10–20 tys. zł albo 50–150 tys. zł",
  "realnie setki tysięcy do kilku mln zł i 18–36 miesięcy; wąskim gardłem jest kolejka "
  "do jednostki notyfikowanej, nie koszt"],
 ["ISO 13485", "25–40 tys. zł", "80–150 tys. zł wg warstwy operacyjnej Planu PWNŚ"],
 ["Badania kliniczne", "wartość z katalogu", "0,5–1,5 mln zł wg Planu PWNŚ — różnica 5–10×"],
 ["Forward CarePod jako działający benchmark", "aktywna rekomendacja",
  "Forward zamknął działalność 13 listopada 2024 — pozostaje lekcją architektoniczną, "
  "nie wzorcem do naśladowania"],
 ["Kalendarz kamieni milowych", "roadmapy v2–v5",
  "kalendarz Planu PWNŚ jest realistyczniejszy o około 1,5 roku i przyjęty jako bazowy"],
]

NIE_OBIECUJEMY = [
 "Nie obiecuje wygranej z systemem publicznym na jego polu. Obiecuje pozycję na polu, "
 "na które on nie wejdzie.",
 "Nie obiecuje ekspansji globalnej. Konkurenci z miliardem kapitału robią jeden produkt; "
 "my robimy dwa na rynku, który wymaga statusu podmiotu leczniczego w Polsce.",
 "Nie obiecuje implantu w horyzoncie planu. Program sprzętowy jest finansowany osobno "
 "albo wcale.",
 "Nie obiecuje, że klasyfikacja regulacyjna wypadnie po naszej myśli. Jak konkretna "
 "jednostka notyfikowana odczyta konkretne zdanie o przeznaczeniu — tego nie wie nikt "
 "poza nią.",
 "Nie obiecuje rentowności modelu konsumenckiego. Analogi zagraniczne wskazują, że "
 "przetrwały modele infrastrukturalne i instytucjonalne, nie czysty rynek konsumencki.",
 "Nie podaje prognozy pięcioletniej przed pierwszymi sześcioma miesiącami sprzedaży. "
 "Poprzednia prognoza była zbudowana na modelu kosztowym bez wynagrodzeń i na konwersji "
 "konsumenckiej, która nie jest osią przychodu.",
]

RYZYKA = [
 ["Ryzyko", "Prawdopodobieństwo", "Mitygacja"],
 ["Brak popytu na pierwszą falę", "średnie",
  "bramka dwumiesięczna: pięć zobowiązań przed budową"],
 ["Wpis do rejestru nieuzyskany", "niskie",
  "Pet i Scribe go nie wymagają — dlatego są pierwsze"],
 ["Konkurent zajmuje mapper przed nami", "średnie",
  "mapper zostaje komponentem własnym; przychód z Pet i Scribe niezależny"],
 ["Jednostka notyfikowana klasyfikuje wyżej niż zakładano", "średnie",
  "spotkanie przedzgłoszeniowe przed kodem; różnica jest w jednym zdaniu przeznaczenia"],
 ["Odcięcie kluczowego dostawcy", "średnie",
  "reguła jednej trzeciej, adapter, wariant zapasowy, przez który faktycznie płynie ruch"],
 ["Termin cyberbezpieczeństwa niedotrzymany", "niskie po podjęciu działania",
  "koszt bliski zeru dziś"],
 ["Rozproszenie uwagi na zbyt wiele frontów", "WYSOKIE",
  "zasada dwóch–trzech projektów; katalog odrzuceń zapisany"],
 ["Odejście założyciela z operacji bez następcy", "WYSOKIE",
  "rekrutacja następcy jako pozycja priorytetowa; dokumentacja jako obowiązek "
  "instytucjonalny"],
]

ZESPOL = [
 ["Rola", "Osoba", "Stan"],
 ["CEO — strategia, produkt, sprzedaż", "Maksymilian", "obsadzona"],
 ["CTO — architektura i inżynieria", "Janek", "obsadzona"],
 ["CMO i dyrektor medyczny", "Wiktor", "obsadzona"],
 ["CAO — compliance i RODO", "Karol", "obsadzona"],
 ["CTO Hardware", "Adrian", "rozpoznanie, bez zamówień"],
 ["Marketing i społeczność", "Julia", "obsadzona"],
 ["Następca operacyjny", "—",
  "NIEOBSADZONA — najpilniejsza rekrutacja, wymaga 2–3 lat wspólnej pracy "
  "przed przekazaniem"],
 ["Osoba odpowiedzialna za zgodność regulacyjną (PRRC)", "—",
  "do wskazania w czwartym kwartale 2026"],
]

STRUKTURA = [
 ["Podmiot", "Rola", "Reżim", "Kiedy zakładać"],
 ["Fundacja Eternal", "standard, rejestr, znaki towarowe, weto misyjne",
  "prawo o fundacjach", "statut do 31.12.2026"],
 ["Eternal Labs Sp. z o.o.", "software, warstwa danych, mapper", "prawo handlowe",
  "ISTNIEJE"],
 ["Eternal Devices", "producent wyrobu — Station, Capsule", "MDR, PRRC, EUDAMED",
  "gdy jest co produkować"],
 ["Eternal Care", "podmiot leczniczy",
  "RPWDL — 894 zł podmiot, 179 zł praktyka", "przy teleporadzie własnej"],
 ["Eternal Forge", "marketplace, standard, rejestr", "prawo handlowe", "2027–2028"],
]

STATUT = (
 "ZAPIS STATUTOWY DECYDUJĄCY O TRWAŁOŚCI: statut mówi, że Fundacja jest ZOBOWIĄZANA "
 "utrzymać kontrolę, nie że MOŻE. Wymienia obowiązki zarządu, w tym udaremnianie każdego "
 "podwyższenia kapitału, przez które Fundacja utraciłaby większość głosów. Uprawnienie "
 "następca może nie wykonać; obowiązek jest naruszeniem statutu. Wzory: Bosch — "
 "rozdzielenie kapitału od głosu, fundacja czerpie korzyść, ale nie kieruje; "
 "Novo Nordisk — fundacja trzyma głosy przez holding, akcje uprzywilejowane nienotowane "
 "i poza obrotem. Kontrola ma pięć niezależnych źródeł: kapitał, głosy, własność "
 "intelektualną, infrastrukturę i ludzi.")

FOSA = [
 ["Element fosy", "Na czym polega", "Kto może powtórzyć"],
 ["Status podmiotu leczniczego",
  "wpis wymaga personelu, lokalu, opinii sanitarnej, OC i obowiązku prowadzenia "
  "dokumentacji",
  "żadna aplikacja konsumencka — dla niej to absurdalny koszt za dostęp do danych"],
 ["Wytwarzanie własnej dokumentacji",
  "kto wytworzył dokument, ma dostęp z mocy ustawy; zlecanie badań daje jednocześnie "
  "przychód i dane",
  "tylko inny podmiot leczniczy — a te nie budują oprogramowania"],
 ["Model danych i mapper",
  "Polska stoi na innym standardzie niż europejski; mapper jest warunkiem od 2029",
  "każdy, kto zacznie teraz — to wyścig, nie fosa trwała"],
 ["Rejestr i dane wynikowe",
  "producent wie, że urządzenie działa; nie wie, czy pacjentowi jest lepiej",
  "nikt bez dostępu do pacjentów wielu producentów"],
 ["Ciągłość zapisu",
  "ósma kartka po trzech latach jest bezcenna, bo nikt inny nie ma siedmiu poprzednich",
  "nikt — czasu nie da się kupić"],
 ["Kompetencja regulacyjna", "wąska, rzadka, już zbudowana",
  "kosztuje czas, nie pieniądze"],
]

KONKURENCJA = [
 ["Kategoria", "Ich przewaga", "Nasza pozycja"],
 ["System publiczny", "darmowe, ponad 20 mln kont, obowiązek prawny po stronie placówek",
  "nie konkurujemy — integrujemy się"],
 ["Systemy gabinetowe", "zainstalowana baza, relacje",
  "stajemy się ich dostawcą komponentu, nie konkurentem"],
 ["Dokumentacja automatyczna — rozwiązania międzynarodowe", "kapitał, dojrzałość produktu",
  "język polski, integracja z polską dokumentacją, cena"],
 ["Aplikacje konsumenckie — setki", "marketing", "nie wchodzimy w tę kategorię"],
 ["Agregatory danych", "zasięg integracji", "stają się jednym z trzech dostawców, "
  "nie jedynym"],
 ["Weterynaria", "brak", "pole czyste, ale rynek nasycony: dominujący gracz ma ponad "
  "5600 placówek, dwa rozwiązania są bezpłatne, migracja trwa kwadrans"],
 ["Globalne firmy prewencyjne", "kapitał rzędu miliarda",
  "nie wchodzą do Polski, bo wymaga to statusu podmiotu leczniczego"],
]

KONKURENCJA_KALIBRACJA = (
 "KALIBRACJA SKALI RYZYKA. W tej kategorii spalono kapitał rzędu miliardów przy "
 "produktach, które uzyskały dopuszczenie regulacyjne i mimo to upadły z powodów "
 "rynkowych. Dopuszczenie nie chroni przed brakiem popytu. To jest argument za tym, żeby "
 "najpierw mieć pięciu płacących klientów, a dopiero potem dossier. Nikt na świecie nie "
 "buduje wszystkich pięciu produktów Eternal pod jednym dachem i nie jest to luka rynkowa, "
 "tylko wynik selekcji — każda z warstw ma dobrze dokapitalizowanego okupanta. Najbliżej "
 "pełnego ekosystemu są M42 z Abu Zabi oraz chińska trójka Ping An, Alibaba Health "
 "i JD Health; żaden nie robi implantu ani metawersum, bo obie warstwy mają ujemną "
 "ekonomikę jednostkową.")

LUKA_WETERYNARYJNA = (
 "Luka, której nikt nie zajmuje na rynku weterynaryjnym: jeden z bezpłatnych dostawców "
 "na pytanie, czy klient po zakończeniu współpracy otrzyma zgromadzone dane, odpowiada "
 "wprost: nie. Przewaga polegająca na odwrotności — pełny eksport w formacie użytecznym "
 "gdzie indziej, bezpłatnie — kosztuje niewiele i da się ją powiedzieć jednym zdaniem. "
 "To ten sam wyróżnik, który po stronie ludzkiej dają log dostępu, granularne zgody "
 "i realizacja usunięcia danych.")

FIZYKA_MARKETINGU = (
 "Fizyka marketingu w tej kategorii jest odwrotna niż w większości branż: im głośniej "
 "się mówi, tym mniej jest się wiarygodnym. Prosimy człowieka nie o zakup, tylko "
 "o powierzenie zapisu własnego ciała na dwadzieścia lat. Decyzja o powierzeniu zapada "
 "wolno, reaguje na dowód zamiast na obietnicę i karze rozmach.")

WEJSCIE = [
 ["Faza", "Kanał", "Co mierzymy"],
 ["Przed produktem", "baza wiedzy i społeczność prowadzona przez rozpoznawalną osobę "
  "o wiarygodności medycznej, wokół konkretnej sprawy",
  "wielkość i zaangażowanie społeczności"],
 ["Miesiące 1–2", "czterdzieści rozmów: dwadzieścia lecznic weterynaryjnych, "
  "dwadzieścia gabinetów", "pięć podpisanych zobowiązań"],
 ["Miesiące 3–6", "konwersja zobowiązań w płatności, polecenia", "pięciu płacących"],
 ["Rok 1–2", "sprzedaż bezpośrednia do lecznic i gabinetów, kanał przez dostawców "
  "systemów", "przychód powtarzalny"],
 ["Rok 2–3", "mapper przez dostawców systemów gabinetowych", "trzy płacące placówki"],
 ["Rok 3+", "rejestr i certyfikacja — producenci przychodzą sami", "wpisy zewnętrzne"],
]

BRAMKI = [
 ["Termin", "Kamień milowy", "Co znaczy niepowodzenie"],
 ["03.10.2026", "identyfikacja w krajowym systemie cyberbezpieczeństwa",
  "naruszenie obowiązku ustawowego"],
 ["15.09.2026", "dwadzieścia rozmów zamkniętych", "zatrzymać budowę, zmienić produkt"],
 ["15.10.2026", "pięć podpisanych zobowiązań", "nie ma popytu"],
 ["31.12.2026", "statut Fundacji podpisany", "negocjujesz zamiast decydować"],
 ["Q1 2027", "wpis do rejestru podmiotów leczniczych", "przegląd strategii dostępu"],
 ["Q2 2027", "raportowanie zdarzeń i indeksów do platformy państwowej",
  "stop i przegląd architektury"],
 ["Miesiąc 6", "pięciu płacących, aktywnych klientów", "nie umiemy sprzedać"],
 ["Miesiąc 18", "przychód pokrywający koszt zespołu", "zwiń do jednego produktu"],
 ["Koniec 2028", "trzy płacące placówki na komponencie interoperacyjności",
  "repriorytetyzacja"],
 ["Przed 26.03.2029", "mapper gotowy i przetestowany", "okno zamknięte"],
]

PORTFEL = [
 ["Pozycja", "Ocena wg kryteriów własnych", "Reżim", "Start"],
 ["Społeczność i baza wiedzy", "—", "poza reżimem wyrobu",
  "przed produktem konsumenckim"],
 ["Eternal Pet z ramieniem sprzętowym", "7/7", "weterynaryjny — poza MDR", "teraz"],
 ["Eternal Scribe", "5/7", "dokumentacja — poza reżimem wyrobu", "teraz"],
 ["Mapper interoperacyjności", "4/7", "komponent", "2027"],
 ["Translator wyników", "4/7", "poza reżimem wyrobu", "2027"],
 ["Marketplace", "3/7", "platforma zdrowia", "po pierwszym przychodzie"],
 ["Station z gotowych komponentów", "2/7", "zestaw wyrobów wg art. 22 MDR", "2028"],
 ["Telemedycyna", "1/7", "działalność lecznicza", "rynek nasycony"],
]

ETAP_ZEROWY = (
 "Etap zerowy to dwanaście funkcji tworzących jeden produkt, nie sto osiemdziesiąt pięć: "
 "konto, profil zdrowia, integracja urządzenia, import dokumentów z mapowaniem, dashboard, "
 "asystent, rekomendacje w warstwie wellness, cele, historia, osobisty model zdrowia, "
 "podstawowy bliźniak i marketplace.")

USUNIETE = (
 "POZYCJE USUNIĘTE Z PLANU I Z KAŻDEGO MATERIAŁU ZEWNĘTRZNEGO: roje terapeutyczne, kopia "
 "świadomości, teza o wydłużeniu życia do konkretnej liczby lat, konsumencki panel "
 "biochemiczny, mieszanie preparatów przez model, ogniwa biopaliwowe oraz pozycjonowanie "
 "w kategorii długowieczności. Każda z nich kończy rozmowę z inwestorem medtech "
 "w pierwszej minucie. Parkowane z warunkiem powrotu: transponder u człowieka — "
 "po zbudowaniu kompetencji produkcyjnej na torze weterynaryjnym; biosensor wszczepialny — "
 "nie własnymi siłami; warstwa immersyjna — rekomendacja: nie robić.")

STACJA_EKONOMIKA = [
 ["Pozycja", "Wartość"],
 ["Rynkowe ceny gotowych kiosków", "1 100–4 900 USD podstawowy, 7 500–8 000 zaawansowany, "
  "11 000–12 500+ telemedyczny; przy kursie 3,65 PLN/USD to 17–46 tys. zł/szt."],
 ["BOM prototypu MVP", "550–1 570 zł na sztukę"],
 ["Software MVP", "110–210 tys. zł"],
 ["Cały MVP — rekomendowany pierwszy budżet", "250–300 tys. zł na 50–100 urządzeń"],
 ["BOM wersji MLP", "3 000–8 000 zł na sztukę"],
 ["Trzy drogi do MLP", "gotowy OEM 15–45 tys. zł/szt.; ODM 12–30 tys. przy wolumenie; "
  "własna konstrukcja 5–12 tys., ale po R&D, toolingu i certyfikacji"],
 ["Koszt stworzenia własnego MLP", "860 tys. – 2,2 mln zł"],
 ["Próg decyzyjny", "przy mniej niż 500 szt. rocznie OEM jest prawie zawsze rozsądniejszy"],
 ["Utrzymanie jednej stacji", "420–530 zł/szt./mies., przy dużej skali 150–300 zł"],
 ["Koszt na użytkownika", "10 użytkowników na stację — 50 zł/user/mies.; 50 — 10 zł; "
  "100 — 5 zł; 250 — 2 zł"],
 ["Budżet regulacyjny", "wellness 30–100 tys. zł; MDR klasa I 100–300 tys.; "
  "klasa IIa 300–900 tys.; IIa złożone 700 tys.–1,5 mln; IIb 1–3+ mln; "
  "IVDR Chip Lab 0,5–3+ mln"],
]

STACJA_WNIOSEK = (
 "Nie opłaca się produkować całej stacji od zera. Ścieżka: MVP z własnym oprogramowaniem "
 "i gotowymi modułami, potem OEM lub ODM z własnym firmware, potem własny projekt "
 "przemysłowy z własnym kluczowym IP, a częściowa własna produkcja dopiero przy dużej "
 "skali. Najpierw kontroluj technologię, później produkcję — nie odwrotnie. Przy umowie "
 "OEM obowiązuje dwunastopunktowa lista kontrolna: kod źródłowy firmware, toolchain, "
 "dostęp do bootloadera, własne OTA, dokumentacja PCB, schematy, BOM, surowe dane "
 "z każdego sensora, protokół komunikacyjny, SDK bez uwiązania do chmury dostawcy, prawa "
 "do modyfikacji i prawa do własnych aktualizacji. Deklaracja „SDK/API available” nie "
 "oznacza, że dostajemy źródła firmware.")

SEGMENTY_B2B_STACJA = (
 "Osiem segmentów instytucjonalnych ważniejszych dla stacji niż klient detaliczny: "
 "pracodawcy od 100 do 5000 pracowników, prywatne kliniki jako automatyczny punkt badań, "
 "hotele premium w segmencie wellness i longevity, senior living, siłownie, "
 "ubezpieczyciele w programach prewencyjnych, samorządy w programach profilaktycznych "
 "oraz apteki w screeningu.")
