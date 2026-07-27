"""Szablony struktur (SZABLONY_STRUKTUR.md) i reguły trybów (§9)."""

# (id, tytul, budzet_bazowy_dla_60_stron, zaleznosci, stala)
S = lambda i, t, w, d=(), f=False: {
    "id": i, "title": t, "base": w, "depends_on": list(d), "fixed": f
}

BIZNESOWY = [
    S("0",   "Metryka dokumentu", 150, (), True),
    S("1",   "Streszczenie zarządcze", 700, ("5.1", "6.4", "7.2", "8.1")),
    S("2.1", "Punkt wyjścia", 650),
    S("2.2", "Otoczenie rynkowe, technologiczne i regulacyjne", 850),
    S("2.3", "Definicja problemu strategicznego", 600, ("2.1", "2.2")),
    S("2.4", "Zakres, założenia i ograniczenia", 400, ("2.3",)),
    S("3.1", "Rynek: TAM / SAM / SOM", 950, ("2.2",)),
    S("3.2", "Segmenty i ekonomika jednostkowa", 800, ("2.1",)),
    S("3.3", "Konkurencja i pozycjonowanie", 750, ("3.1",)),
    S("3.4", "Zasoby i zdolności organizacyjne", 750, ("2.1",)),
    S("3.5", "Produkt i dług technologiczny", 650, ("2.1",)),
    S("3.6", "Synteza: luka strategiczna", 400, ("3.1", "3.2", "3.3", "3.4", "3.5")),
    S("4.1", "Kryteria oceny i metoda wyboru", 400, ("3.6",)),
    S("4.2", "Opcja A", 600, ("4.1",)),
    S("4.3", "Opcja B", 600, ("4.1",)),
    S("4.4", "Opcja C", 600, ("4.1",)),
    S("4.5", "Wariant zerowy", 350, ("4.1",)),
    S("4.6", "Ocena porównawcza opcji", 550, ("4.2", "4.3", "4.4", "4.5")),
    S("5.1", "Wybór i uzasadnienie", 650, ("4.6",)),
    S("5.2", "Cele strategiczne i mierniki", 650, ("5.1",)),
    S("5.3", "Warunki brzegowe i punkty decyzyjne", 450, ("5.1",)),
    S("6.1", "Założenia modelu", 600, ("3.6", "5.1")),
    S("6.2", "Prognoza przychodów", 750, ("6.1",)),
    S("6.3", "Struktura kosztów i plan zatrudnienia", 650, ("6.1",)),
    S("6.4", "Kapitał i finansowanie", 650, ("6.2", "6.3")),
    S("6.5", "Analiza wrażliwości", 400, ("6.4",)),
    S("7.1", "Rejestr ryzyk", 800, ("5.1",)),
    S("7.2", "Ryzyka krytyczne", 650, ("7.1",)),
    S("7.3", "Scenariusz negatywny i plan ciągłości", 450, ("7.2",)),
    S("8.1", "Mapa drogowa", 750, ("5.1",)),
    S("8.2", "Struktura organizacyjna i plan kadrowy", 550, ("8.1",)),
    S("8.3", "Governance i rytm zarządczy", 450, ("8.1",)),
    S("8.4", "Pierwsze 180 dni", 450, ("8.1",)),
    S("9.1", "Słownik pojęć", 250, (), True),
    S("9.2", "Metodyka i źródła", 350),
    S("9.3", "Rejestr założeń i decyzji", 350, (), True),
]

PRAWNY = [
    S("A.0",  "Tytuł aktu", 30, (), True),
    S("A.2",  "Dział I — Przepisy ogólne", 900),
    S("A.3",  "Dział II — Przepisy ustrojowe", 1100, ("A.2",)),
    S("A.4",  "Dział III — Przepisy materialne", 2000, ("A.2",)),
    S("A.5",  "Dział IV — Przepisy proceduralne", 900, ("A.4",)),
    S("A.6",  "Dział V — Przepisy o karach i sankcjach", 600, ("A.4",)),
    S("A.7",  "Dział VI — Przepisy zmieniające", 700, ("A.4",)),
    S("A.8",  "Dział VII — Przepisy przejściowe i dostosowujące", 500, ("A.7",)),
    S("A.9",  "Dział VIII — Przepisy uchylające", 120, ("A.7",)),
    S("A.10", "Przepis o wejściu w życie", 150, ("A.8",)),
    S("B.1",  "Potrzeba i cel wydania ustawy", 700, ("A.4",)),
    S("B.2",  "Aktualny stan prawny", 1000),
    S("B.3",  "Różnica między stanem obecnym a projektowanym", 1400, ("A.10",)),
    S("B.4",  "Przewidywane skutki społeczne i gospodarcze", 900, ("C.6", "C.7")),
    S("B.5",  "Zgodność z prawem Unii Europejskiej", 700, ("A.10",)),
    S("B.6",  "Zgodność z Konstytucją i umowami międzynarodowymi", 600, ("A.10",)),
    S("B.7",  "Obowiązek notyfikacji", 200, ("A.10",)),
    S("B.8",  "Konsultacje publiczne i opiniowanie", 500),
    S("B.9",  "Wpływ na działalność MŚP", 250, ("C.7",)),
    S("B.10", "Akty wykonawcze", 150, ("A.10",)),
    S("C.1",  "OSR 1 — Jaki problem jest rozwiązywany", 350, ("A.4",)),
    S("C.2",  "OSR 2 — Rekomendowane rozwiązanie i alternatywy", 450, ("A.4",)),
    S("C.3",  "OSR 3 — Rozwiązania w innych państwach", 350),
    S("C.4",  "OSR 4 — Podmioty, na które oddziałuje projekt", 400, ("A.4",)),
    S("C.5",  "OSR 5 — Konsultacje publiczne", 250, ("B.8",)),
    S("C.6",  "OSR 6 — Wpływ na sektor finansów publicznych", 900, ("A.10",)),
    S("C.7",  "OSR 7 — Konkurencyjność i przedsiębiorczość", 450, ("A.10",)),
    S("C.8",  "OSR 8 — Zmiana obciążeń regulacyjnych", 400, ("A.10",)),
    S("C.9",  "OSR 9 — Wpływ na pozostałe obszary", 300, ("A.10",)),
    S("C.10", "OSR 10 — Planowane wykonanie przepisów", 200, ("A.10",)),
    S("C.11", "OSR 11 — Ewaluacja", 150, ("C.6",)),
    S("D.1",  "Tabela zgodności z prawem UE", 700, ("A.10",)),
    S("D.2",  "Odwrócona tabela zgodności", 300, ("D.1",)),
    S("D.3",  "Projekty aktów wykonawczych", 400, ("B.10",)),
    S("D.4",  "Wzory formularzy", 200, ("A.10",)),
]

NAUKOWY = [
    S("M.1", "Strona tytułowa i afiliacje", 100, (), True),
    S("M.2", "Streszczenie / abstrakt", 300, ("6.4", "8"), True),
    S("M.3", "Słowa kluczowe i wykaz skrótów", 200, (), True),
    S("1.1", "Tło i znaczenie problemu", 500),
    S("1.2", "Luka badawcza", 450, ("2.5",)),
    S("1.3", "Cel, pytania badawcze i hipotezy", 500, ("1.2",)),
    S("1.4", "Zakres i struktura pracy", 450, ("1.3",)),
    S("2.1", "Strategia przeglądu", 400),
    S("2.2", "Przegląd — blok tematyczny I", 900, ("2.1",)),
    S("2.3", "Przegląd — blok tematyczny II", 900, ("2.1",)),
    S("2.4", "Przegląd — blok tematyczny III", 900, ("2.1",)),
    S("2.5", "Synteza i identyfikacja luki", 700, ("2.2", "2.3", "2.4")),
    S("3.1", "Przyjęta teoria lub model", 700, ("2.5",)),
    S("3.2", "Definicje operacyjne zmiennych", 500, ("3.1",)),
    S("3.3", "Model badawczy", 400, ("3.2",)),
    S("4.1", "Projekt badania", 450, ("3.3",)),
    S("4.2", "Populacja, próba, dobór", 550, ("4.1",)),
    S("4.3", "Narzędzia i pomiar", 550, ("3.2",)),
    S("4.4", "Procedura zbierania danych", 450, ("4.2",)),
    S("4.5", "Metody analizy", 500, ("4.1",)),
    S("4.6", "Etyka i odtwarzalność", 400, ("4.4",)),
    S("5.1", "Statystyki opisowe", 700, ("4.5",)),
    S("5.2", "Wyniki — pytanie badawcze I", 900, ("5.1",)),
    S("5.3", "Wyniki — pytanie badawcze II", 900, ("5.1",)),
    S("5.4", "Wyniki — pytanie badawcze III", 900, ("5.1",)),
    S("5.5", "Analizy dodatkowe", 400, ("5.2", "5.3", "5.4")),
    S("6.1", "Odpowiedzi na pytania badawcze", 700, ("5.2", "5.3", "5.4")),
    S("6.2", "Odniesienie do literatury", 750, ("6.1",)),
    S("6.3", "Implikacje teoretyczne", 400, ("6.2",)),
    S("6.4", "Implikacje praktyczne", 400, ("6.2",)),
    S("7",   "Ograniczenia", 650, ("6.4",)),
    S("8",   "Wnioski i kierunki dalszych badań", 650, ("7",)),
    S("B",   "Bibliografia", 400, (), True),
]

SF4A = [
    S("0",   "Metryka i deklaracja statusu", 200, (), True),
    S("1",   "Streszczenie", 800, ("5.6", "8.1")),
    S("2.1", "Cel i pytanie foresightowe", 450),
    S("2.2", "Horyzont i jednostki analizy", 400, ("2.1",)),
    S("2.3", "Metodyka", 750, ("2.2",)),
    S("2.4", "Konwencja oznaczania niepewności", 350, (), True),
    S("3.1", "Stan obecny dziedziny", 900, ("2.2",)),
    S("3.2", "Mapa dojrzałości technologii", 800, ("3.1",)),
    S("3.3", "Bariery strukturalne", 600, ("3.2",)),
    S("4.1", "Megatrendy", 700, ("3.1",)),
    S("4.2", "Słabe sygnały", 700, ("3.1",)),
    S("4.3", "Niepewności krytyczne", 800, ("4.1", "4.2")),
    S("4.4", "Wildcards", 500, ("4.3",)),
    S("5.1", "Konstrukcja przestrzeni scenariuszy", 500, ("4.3",)),
    S("5.2", "Scenariusz 1", 850, ("5.1",)),
    S("5.3", "Scenariusz 2", 850, ("5.1",)),
    S("5.4", "Scenariusz 3", 850, ("5.1",)),
    S("5.5", "Scenariusz 4", 850, ("5.1",)),
    S("5.6", "Porównanie scenariuszy", 600, ("5.2", "5.3", "5.4", "5.5")),
    S("6.1", "Mapa drogowa", 900, ("5.6", "3.2")),
    S("6.2", "Punkty rozstrzygające", 700, ("6.1",)),
    S("6.3", "Zależności krytyczne", 500, ("6.1",)),
    S("7.1", "Implikacje gospodarcze", 700, ("5.6",)),
    S("7.2", "Implikacje społeczne i kulturowe", 600, ("5.6",)),
    S("7.3", "Implikacje etyczne", 700, ("5.6",)),
    S("7.4", "Implikacje regulacyjne", 600, ("5.6",)),
    S("8.1", "Działania odporne na scenariusze", 700, ("5.6", "6.1")),
    S("8.2", "Opcje warunkowe", 600, ("8.1",)),
    S("8.3", "System wczesnego ostrzegania", 500, ("6.2",)),
    S("9.1", "Kanon technologiczny", 500, (), True),
    S("9.2", "Słownik", 300, (), True),
    S("9.3", "Źródła i metodyka szczegółowa", 400, ("2.3",)),
]

TEMPLATES = {
    "prawny": PRAWNY,
    "biznesowy": BIZNESOWY,
    "naukowy": NAUKOWY,
    "sf4a": SF4A,
}

MODE_RULES = {
    "prawny": {
        "mandat": "Piszesz dla sędziego szukającego podstawy. Każda nieostrość "
                  "zostanie rozstrzygnięta przez kogoś innego, w sprawie, której nie znasz.",
        "zdanie": "15-35 słów, maks. dwa poziomy podrzędności",
        "formalnosc": "F5 kodeksowa",
        "jednostka": "artykuł — nigdy nie przerywaj w środku artykułu",
        "cytacje": "W tekście normatywnym znaczników NIE MA. Wątpliwości co do "
                   "odesłania lub publikatora wyłącznie w polu OTWARTE.",
        "zakazy": "powinien, warto, zaleca się, w miarę możliwości, istotny, "
                  "znaczący, niezwłocznie bez terminu granicznego; powielanie "
                  "treści rozporządzeń UE",
        "test": "TEST ROZSTRZYGALNOŚCI: wymyśl trzy stany faktyczne na granicy "
                "przepisu. Nie potrafisz wskazać skutku bez domysłu → przepis wadliwy.",
        "wyciek": "z biznesowego: przymiotniki ocenne; z naukowego: hedging "
                  "(w normie katastrofalny); z sci-fi: regulacja technologii nieistniejących",
    },
    "biznesowy": {
        "mandat": "Dokument ma doprowadzić do decyzji i umożliwić rozliczenie z niej. "
                  "Zdanie, po którym czytelnik nie wie, co zrobić ani kto odpowiada, jest zbędne.",
        "zdanie": "12-25 słów, średnia ok. 18; akapit 3-5 zdań",
        "formalnosc": "F3 zarządcza",
        "jednostka": "sekcja",
        "cytacje": "Każda liczba ma pokrycie i pewność. Liczba bez pokrycia = błąd krytyczny.",
        "zakazy": "rewolucyjny, przełomowy, unikalny, ogromny potencjał, game changer, "
                  "synergia, holistyczny, dedykowany, w dzisiejszych czasach",
        "test": "TEST ROZLICZALNOŚCI: każda rekomendacja ma koszt, termin, właściciela "
                "i miernik. Brak któregokolwiek → to postulat, nie rekomendacja.",
        "wyciek": "z naukowego: hedging bez liczby, brak konkluzji; z prawnego: "
                  "kategoryczność bez podstawy; z sci-fi: wizja zamiast planu",
    },
    "naukowy": {
        "mandat": "Dokument przedstawia dowód, który ktoś będzie próbował obalić. "
                  "Piszesz dla recenzenta szukającego luki.",
        "zdanie": "18-32 słowa; akapit 4-7 zdań, jedna teza na akapit",
        "formalnosc": "F4 akademicka",
        "jednostka": "sekcja",
        "cytacje": "Gęstość najwyższa. Jeden standard cytowań w całym dokumencie. "
                   "Zakaz: nazwisko, rok, tytuł, DOI ani ustalenie, których nie masz.",
        "zakazy": "interpretacja w rozdziale wyników; korelacja przedstawiona jako "
                  "przyczyna; hedging nadmiarowy",
        "test": "TEST RECENZENTA: zdanie po zdaniu — skąd to wiadomo. Zdanie bez "
                "odpowiedzi: cytowanie, przeniesienie do dyskusji jako hipoteza, usunięcie.",
        "wyciek": "z biznesowego: rekomendacja bez zastrzeżenia siły dowodu; "
                  "z prawnego: kategoryczność; z sci-fi: ekstrapolacja poza dane",
    },
    "sf4a": {
        "mandat": "Dokument pokazuje przestrzeń możliwości, nie przewiduje przyszłości. "
                  "Wartość leży w rozróżnialności poziomów pewności.",
        "zdanie": "14-28 słów, bezosobowa",
        "formalnosc": "F3 zarządcza",
        "jednostka": "scenariusz",
        "cytacje": "Podwójne oznaczanie: pokrycie + pewność, plus dojrzałość "
                   "[U] wdrożone / [R] TRL 4-7 / [E] TRL 1-3 / [S] spekulatywne / [F] fikcja. "
                   "Rozdział 3.1 wyłącznie [U] z pełnym pokryciem.",
        "zakazy": "czas przyszły oznajmujący w opisie scenariusza (błąd krytyczny — "
                  "użyj trybu przypuszczającego); prognoza punktowa; liczba bez metody",
        "test": "TEST ROZRÓŻNIALNOŚCI: usuń znaczniki. Czytelnik nie wskaże, co jest "
                "faktem, a co spekulacją → dokument wadliwy.",
        "wyciek": "z biznesowego: ROI dla TRL 2; z naukowego: hedging na stanie obecnym; "
                  "z 4B: narracja przekraczająca winietę 150 słów",
    },
}
