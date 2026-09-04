# -*- coding: utf-8 -*-
"""Ustalenia roadmapowe z pełnego odczytu korpusu (D001–D076).

Źródło: tools/konsolidacja/odczyt/USTALENIA_ODCZYT.md.
Dokumentem obowiązującym dla roadmapy jest #116 Roadmapa Wykonawcza 2.0
(23.08.2026), która zastępuje roadmapy v2–v5 oraz etapy 7–11 z plików HTML.
Wzorcem zakresu dla wersji prezentacyjnej jest #155 v5-SHORT — wersja, w której
etapy 7–11 zostały celowo pominięte.
"""

ZASADA = (
 "Nie budujemy produktu — budujemy dowód, że ktoś go kupi, i strukturę, która przetrwa "
 "pięćdziesiąt lat. Kod może poczekać kwartał. Statut Fundacji nie może, bo po 31.12.2026 "
 "negocjujesz zamiast decydować. Rejestracja NIS2 nie może, bo termin 3.10.2026 jest "
 "ustawowy. Rejestr komponentów obcych nie może, bo jest jedyną pozycją w projekcie "
 "nieodtwarzalną wstecz.")

TORY = [
 ["Tor", "Cel w 90 dni", "Właściciel", "Wsparcie"],
 ["A — Popyt", "pięć podpisanych zobowiązań", "Maksymilian", "Julia"],
 ["B — Fundacja i kaskada", "projekt statutu gotowy do podpisu", "Karol i kancelaria",
  "Maksymilian"],
 ["C — Podmiot leczniczy i P1",
  "wniosek RPWDL złożony, dostęp do środowiska integracyjnego", "Karol", "Wiktor"],
 ["D — Pierwszy produkt", "działa u pięciu użytkowników", "Łukasz i Janek", "Wiktor"],
 ["E — Zgodność (NOWY)",
  "NIS2 zarejestrowane, rejestr SOUP założony, IOD i PRRC wskazani", "Karol", "Janek"],
]

TORY_NOTA = (
 "Tor E nie występował w planie 90-dniowym i jest jedynym torem z terminem ustawowym "
 "wewnątrz tego okna. Adrian, odpowiedzialny za sprzęt, nadal nie ma pracy w torze "
 "głównym — prowadzi wyłącznie rozpoznanie transponderów white-label pod linię "
 "weterynaryjną, bez zamówień.")

DATY = [
 ["Data", "Co", "Rodzaj", "Konsekwencja przekroczenia"],
 ["28.05.2026", "EUDAMED obowiązkowy", "ustawowa",
  "dotyczy także składających systemy i zestawy"],
 ["02.08.2026", "ujawnienie, że rozmówcą jest AI — AI Act art. 50", "ustawowa",
  "termin minął — zweryfikować stan wdrożenia"],
 ["15.09.2026", "dwadzieścia rozmów zamkniętych", "bramka wewnętrzna",
  "zatrzymaj tor D, zmień produkt"],
 ["01.10.2026", "państwowy asystent głosowy AI potwierdza i odwołuje wizyty", "zewnętrzna",
  "państwo wchodzi w warstwę kontaktu z pacjentem"],
 ["03.10.2026", "samoidentyfikacja NIS2 i wpis do Wykazu KSC", "ustawowa",
  "obowiązek własny — nikt nie wezwie"],
 ["15.10.2026", "PIĘĆ PODPISANYCH ZOBOWIĄZAŃ", "bramka wewnętrzna",
  "ZATRZYMAJ BUDOWĘ — dalsze budowanie jest spalaniem pieniędzy"],
 ["15.11.2026", "produkt u pięciu użytkowników, wniosek RPWDL złożony",
  "bramka wewnętrzna", "opóźnienie, nie porażka"],
 ["31.12.2026", "podpisany statut Fundacji", "własna, nieodwracalna",
  "po tej dacie piszesz go z pozycji negocjacyjnej"],
 ["2027", "cel Centrum e-Zdrowia: 99% placówek raportujących do P1", "zewnętrzna",
  "kompletność danych w P1 rośnie"],
 ["26.03.2027", "akty wykonawcze EHDS, wyznaczenie organów dostępu", "ustawowa",
  "początek okna przewagi"],
 ["26.03.2029", "EEHRxF kategoria 1 — CE dla systemów EDM", "ustawowa",
  "jedyna data tworząca rynek na mapper"],
 ["koniec 2029", "cała opieka specjalistyczna finansowana przez NFZ przez e-Rejestrację",
  "zewnętrzna", "kanał rejestracji zamknięty w systemie państwowym"],
 ["26.03.2031", "EHDS kategoria 2 — obrazowanie, wyniki laboratoryjne, wypisy", "ustawowa",
  "do tego czasu luka pozostaje otwarta"],
]

H0 = [
 ["Okres", "Tor", "Zadanie", "Kto"],
 ["Tygodnie 1–2", "A", "lista 40 rozmówców: 20 gabinetów weterynaryjnych, 20 lekarzy "
  "lub menedżerów przychodni — imiona, telefony, kto poleca", "Maksymilian, Julia"],
 ["Tygodnie 1–2", "A", "jednostronicowa oferta dla każdej grupy — jedna strona z ceną, "
  "nie prezentacja", "Maksymilian"],
 ["Tygodnie 1–2", "B", "wybór kancelarii z doświadczeniem w fundacjach kontrolujących "
  "spółki", "Karol"],
 ["Tygodnie 1–2", "C", "pobranie specyfikacji API e-Profilu Pacjenta; rozstrzygnięcie, "
  "czy zwraca pełne dokumenty EDM, czy wyłącznie zdarzenia i indeksy", "Łukasz"],
 ["Tygodnie 1–2", "C", "mail na adres integracyjny Centrum e-Zdrowia — warunki dostępu "
  "i ścieżka dla podmiotu naszego typu", "Karol"],
 ["Tygodnie 1–2", "D", "Pinecone → pgvector; adapter na warstwie modeli językowych",
  "Janek"],
 ["Tygodnie 1–2", "E", "samoidentyfikacja NIS2 — ustalenie, czy jesteśmy podmiotem "
  "kluczowym czy ważnym", "Karol"],
 ["Tygodnie 1–2", "E", "założenie rejestru komponentów obcych od pierwszej biblioteki",
  "Janek"],
 ["Tygodnie 1–2", "wszyscy", "korekty w specyfikacji: klasa MDR IIb, Unity nie jest "
  "open source, cena Terra przy A1.1, Gadgetbridge na AGPL-3.0", "Maksymilian"],
 ["Wrzesień", "A", "dwadzieścia rozmów przeprowadzonych — rozmowa, nie ankieta; "
  "zawsze kończ pytaniem o pieniądze albo podpis", "Maksymilian"],
 ["Wrzesień", "A", "makieta jednego ekranu, nie produkt", "Julia"],
 ["Wrzesień", "B", "decyzja: wariant Bosch — głosy poza fundacją — czy Novo, "
  "czyli fundacja plus spółka wykonująca własność; rozstrzygnięcie kaskady",
  "Karol, Maksymilian"],
 ["Wrzesień", "C", "kompletowanie warunków RPWDL: regulamin organizacyjny, drzewo "
  "Przedsiębiorstwo → Zakład → Komórka, lokal, opinia sanitarna, polisa OC",
  "Karol, Wiktor"],
 ["Wrzesień", "D", "szkielet mappera CDA ↔ FHIR na danych testowych z P1", "Łukasz"],
 ["Wrzesień", "E", "wpis do Wykazu KSC; wyznaczenie IOD; ustalenie, kto obejmie rolę "
  "PRRC", "Karol"],
 ["Październik", "A", "kolejne dwadzieścia rozmów; cel: pięć podpisanych zobowiązań — "
  "list intencyjny, przedpłata, cokolwiek wiążącego", "Maksymilian"],
 ["Październik", "B", "pierwszy projekt statutu z trzema zamkami: obowiązek zamiast "
  "uprawnienia, niezbywalność, zakaz rozwodnienia; plus sukcesja rady i mechanizm "
  "przy paraliżu", "kancelaria, Karol"],
 ["Październik", "C", "złożenie wniosku do RPWDL 2.0 — 894 zł; wniosek o środowisko "
  "integracyjne P1", "Karol, Łukasz"],
 ["Październik", "D", "pierwsza wersja produktu u trzech użytkowników testowych",
  "Łukasz, Janek"],
 ["Październik", "E", "umówienie spotkania przedzgłoszeniowego z jednostką notyfikowaną",
  "Karol, Maksymilian"],
 ["Do 15.11", "—", "konwersja zobowiązań w pierwsze płatności; przegląd statutu przez "
  "drugą kancelarię; certyfikat P1 i KS-BLOZ po uzyskaniu wpisu; produkt działa "
  "u pięciu płacących lub zobowiązanych użytkowników", "zespół"],
]

H1 = [
 "Podpisanie statutu Fundacji, rejestracja i wykonanie licencji IP w dół kaskady. "
 "IP mieszka nad spółkami i jest licencjonowane odwoływalnie — inaczej sprzedaż spółki "
 "zależnej sprzedaje technologię.",
 "Opinia prawna: konflikt retencji dwudziestoletniej z RODO — przed budową warstwy danych.",
 "Opinia farmaceutyczna: czy mechanika Auto-Refill z rabatem i program lojalnościowy są "
 "dopuszczalne po zmianie reżimu reklamy aptek — wyrok TSUE C-200/24.",
 "Opinia: czy Underwriting AI to dystrybucja ubezpieczeń pod nadzorem KNF, czy da się go "
 "sprowadzić do dostarczania danych ubezpieczycielowi.",
 "Przepisanie opisu przeznaczenia dla trzech funkcji granicznych: trójkolorowe alerty, "
 "priorytetyzacja zaleceń, model starzenia biologicznego.",
 "Klasyfikacja bezpieczeństwa IEC 62304 — poziom A, B albo C — dla funkcji planowanych "
 "w warstwie oceny.",
]

H2 = [
 ["Kwartał", "Kamień milowy", "Próg decyzyjny"],
 ["Q1 2027", "wpis do RPWDL uzyskany, MUS, certyfikaty CeZ, kwalifikowane podpisy "
  "personelu", "brak wpisu do końca Q1 = przegląd całej strategii dostępu do danych"],
 ["Q2 2027", "działające raportowanie zdarzeń medycznych i indeksów EDM do P1",
  "brak = stop i przegląd architektury integracji"],
 ["Q2 2027", "zlecanie badań przez Eternal — wytwarzanie własnej dokumentacji medycznej",
  "to jest moment, w którym pieniądze i dane zaczynają przychodzić tym samym kanałem"],
 ["Q3 2027", "Eternal Pet: przychód powtarzalny; Eternal Scribe: pierwsze kliniki",
  "przychód pokrywający koszt zespołu do miesiąca 18"],
 ["Q4 2027", "mapper CDA ↔ FHIR ↔ EEHRxF w wersji sprzedawalnej",
  "dwa lata przed terminem 26.03.2029 — to jest cały margines"],
]

H3 = [
 "Dossier dla warstwy oceny — interpretacja, alerty z oceną, triage. Poprzedzone "
 "spotkaniem przedzgłoszeniowym, nie zastępowane analizą wewnętrzną.",
 "Walidacja prospektywna modeli predykcyjnych — bez niej Digital Twin pozostaje "
 "wizualizacją, nie wyrobem.",
 "Komponent EEHRxF gotowy i przetestowany przed 26.03.2029. Poślizg powyżej sześciu "
 "miesięcy względem tej daty oznacza repriorytetyzację całego portfela.",
 "Eternal Kompatybilny: uruchomienie poziomów Ready i Compatible. Warunek startu — "
 "pierwszy podmiot spoza Eternal, który chce mieć znaczek.",
 "Rejestr implantów: od 26.03.2029 skrócona karta zdrowia pacjenta w EHDS zawiera "
 "wszczepione urządzenia medyczne. Rejestr przestaje być pomysłem i staje się elementem "
 "infrastruktury.",
 "Pierwsze umowy na nadzór po wprowadzeniu do obrotu z producentami wyrobów — "
 "sprzedaż obowiązku, nie produktu.",
]

H4 = [
 ["Pozycja", "Realna data", "Warunek reaktywacji"],
 ["Bio-Tag weterynaryjny — produkcja własna", "2027–2028", "przychód z Eternal Pet"],
 ["Bio-Tag człowiek, wellness NFC", "2030–2031",
  "kompetencja produkcyjna z toru weterynaryjnego"],
 ["Bio-Tag człowiek, wyrób klasy IIb", "2035–2037",
  "partner z ISO 13485 ORAZ finansowanie deep-tech co najmniej 5 mln EUR"],
 ["Station z gotowych komponentów, framing wellness", "2028",
  "art. 22 MDR — systemy i zestawy"],
 ["Station jako wyrób medyczny", "2032", "dossier"],
 ["Bio-Monitor — biosensor implantowalny", "2040+", "nie własnymi siłami"],
 ["Digital Twin jako wyrób — ścieżka ASME V&V 40", "2031", "walidacja prospektywna"],
 ["Warstwa AR/VR", "—", "rekomendacja: nie robić"],
 ["The Hive", "2045+", "—"],
 ["The Swarm, kopia świadomości, teza o konkretnej liczbie lat życia", "—",
  "USUNIĘTE Z DOKUMENTACJI PRODUKTOWEJ"],
]

NIE_ROBIMY = [
 ["Czego nie robimy", "Dlaczego"],
 ["żadnego sprzętu poza rozpoznaniem weterynaryjnym",
  "Adrian ma rozpoznanie, nie zamówienia"],
 ["żadnej nowej rodziny technologii", "cztery przy zespole, który dopiero rośnie"],
 ["żadnej pracy nad Unity, AR i warstwą immersyjną",
  "33 funkcje zależności, warstwa nierentowna u wszystkich graczy"],
 ["żadnej pracy nad Capsule poza rozpoznaniem weterynaryjnym",
  "wraca po pierwszym przychodzie"],
 ["żadnego zbierania pieniędzy do funduszu",
  "najpierw wyniki operacyjne, potem klub, potem fundusz"],
 ["żadnych nowych funkcji w specyfikacji",
  "masz 185; problem nie polega na tym, że masz za mało"],
 ["żadnej kolejnej etykiety „dobra aplikacja zdrowotna”",
  "Label2Enable, xShare, Continua, QUANTUM — te miejsca są zajęte"],
 ["żadnej nowej analizy", "dwadzieścia osiem dokumentów wystarczy"],
]

BUDZET = [
 ["Pozycja", "Kwota"],
 ["Kancelaria — statut Fundacji i opinia MDR", "30–60 tys. zł"],
 ["Przegląd przez drugą kancelarię", "10–20 tys. zł"],
 ["Wpis do RPWDL", "894 zł"],
 ["OC na spółkę, lokal, opinia sanitarna", "20–40 tys. zł"],
 ["Certyfikat P1 i KS-BLOZ, rocznie", "15 tys. zł"],
 ["Podróże i spotkania — czterdzieści rozmów", "5–10 tys. zł"],
 ["Spotkanie przedzgłoszeniowe z jednostką notyfikowaną (nowa pozycja)", "5–15 tys. zł"],
 ["Opinie prawne: retencja, farmaceutyczna, ubezpieczeniowa (nowa pozycja)",
  "15–30 tys. zł"],
 ["RAZEM, poza kosztem zespołu", "około 101–191 tys. zł"],
]

BUDZET_NOTA = (
 "To jest cały budżet przejścia od dwudziestu ośmiu dokumentów analizy do pierwszego "
 "przychodu i domkniętej struktury kontrolnej.")

ZMIANY = [
 ["Poprzednio", "Teraz", "Powód"],
 ["jedenaście etapów, dwa scenariusze czasowe — 2026 i 2030",
  "pięć horyzontów, jeden scenariusz — ten, który biegnie",
  "scenariusz B zakładał start w 2030; jest sierpień 2026 i scenariusz A trwa"],
 ["etapy 7–11 z moonshotami i celami strategicznymi",
  "horyzont 4 z warunkami reaktywacji",
  "etap bez warunku wejścia nie jest planem, tylko listą życzeń"],
 ["pierwszy produkt: Eternal App MVP",
  "pierwsza fala: Eternal Pet i Eternal Scribe",
  "selekcja wg kryteriów sformułowanych w samym projekcie — 7/7 i 5/7"],
 ["Fundacja Q3 2026, potem spółka Q1 2027",
  "spółka istnieje, Fundacja do 31.12.2026, licencja IP w dół kaskady",
  "kolejność w poprzednich dokumentach była odwrotna wobec stanu faktycznego"],
 ["brak toru zgodnościowego", "tor E z terminem ustawowym 3.10.2026",
  "NIS2, rejestr SOUP, IEC 62304, IOD i PRRC nie występowały w żadnej roadmapie"],
 ["MVP implantu Q2 2028", "wyrób klasy IIb w latach 2035–2037",
  "rozjazd siedmiu do dziesięciu lat wobec stanu techniki"],
 ["nanoboty jako etap z datą", "usunięte z roadmapy produktowej",
  "poza stanem techniki w horyzoncie produktu"],
 ["KPI: MAU powyżej 1000, MRR powyżej 5000 zł",
  "trzy bramki: pięć zobowiązań, pięciu płacących, przychód pokrywający zespół",
  "MAU nie rozstrzyga, czy ktoś zapłaci"],
]

KALENDARZ_SPOR = (
 "Rozbieżność kalendarzy do rozstrzygnięcia: roadmapy v2–v5 i Plan PWNŚ podają różne "
 "daty dla tego samego kamienia milowego — dla Eternal Assist i App Lite różnica sięga "
 "półtora roku. Warstwa PWNŚ jest realistyczniejsza, bo ma przypisane narzędzia, "
 "partnerów i koszty, i to ona jest przyjęta jako kalendarz bazowy.")

SF_NOTA = (
 "Etapy 7–11 są w źródłach jawnie oznaczone jako fikcja i worldbuilding. Roadmapa "
 "Wykonawcza 2.0 zastępuje je horyzontem 4 z warunkami reaktywacji, a wersja v5-SHORT "
 "pomija je całkowicie. W tym dokumencie są dostępne pod osobnym widokiem, nigdy "
 "w widoku planu realnego — żeby dało się je czytać jako materiał źródłowy, ale nie "
 "dało pomylić z planem. Warstwa dotycząca sterowania zachowaniem ludzi, propagandy "
 "politycznej i masowej implantacji nie wchodzi do dokumentu w ogóle; szczegóły "
 "w nocie o warstwie wyłączonej.")
