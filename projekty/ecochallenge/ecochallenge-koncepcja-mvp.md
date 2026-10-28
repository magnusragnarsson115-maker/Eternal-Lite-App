# EcoChallenge — Koncepcja produktu i specyfikacja MVP

Wersja robocza 0.2 · Data stanu: 2026-10-27 · Etap projektu: 3 (MVP) · Podmiot: fundacja (działalność nieodpłatna)

Notacja stosowana w dokumencie:

- `ZAŁOŻENIE:` — przyjęcie robocze bez pokrycia w danych; wymaga potwierdzenia albo zastąpienia danymi.
- `Ustalenie projektowe:` — decyzja projektowa wiążąca w tym dokumencie (np. Z-08); nie jest założeniem do potwierdzenia, a jej zmiana wymaga decyzji założyciela i przeglądu powiązanych wymagań.
- `[DO USTALENIA]` — luka decyzyjna; wymaga decyzji założyciela lub partnera.
- `DO WERYFIKACJI` — twierdzenie prawne lub dydaktyczne oparte na źródłach wtórnych; wymaga sprawdzenia w źródle pierwotnym przed publikacją. `POTWIERDZONE` — zweryfikowane 2026-10-27 w źródłach wtórnych zgodnych ze sobą; przed publikacją nadal wymaga odczytu w ISAP/EUR-Lex.

Dokument nie zastępuje przeglądu prawnego ani metodycznego. Szczegółowa analiza prawna zostanie opracowana w odrębnym dokumencie „Analiza prawna”, a szczegółowe mapowanie na podstawę programową w dokumencie „Projekt dydaktyczny” (ZL-13). Medyczny bliźniak cyfrowy jest jawnie wyłączony z zakresu.

## 1. Cel

### 1.1. Problem edukacyjny

Decyzje publiczne (podatek lokalny, dopłata do komunikacji, inwestycja w energetykę) mają skutki dalszych rzędów, które mogą nie być widoczne w chwili podejmowania decyzji.

Hipoteza projektu (ZAŁOŻENIE: do potwierdzenia w przeglądzie metodycznym, nie jest wynikiem badania): materiały szkolne przedstawiają budżet, podatki i politykę lokalną częściej jako zbiór definicji niż jako układ powiązanych zmiennych. W efekcie uczeń poznaje pojęcie dochodu własnego gminy, ale nie widzi, że obniżka podatku od nieruchomości zmienia jednocześnie wpływy budżetowe, możliwość finansowania dowozów szkolnych i koszt dojazdu konkretnej rodziny. Hipotezę weryfikują przegląd metodyczny (ZL-10) i pomiar pre/post w pilotażu (K-01).

EcoChallenge ma pokazać społeczność jako układ „naczyń połączonych”: każda decyzja przesuwa kilka wskaźników naraz, a poprawa jednego może pogorszyć inny. Produkt nie wskazuje jednej poprawnej odpowiedzi. Uczy rozpoznawania kompromisów i uzasadniania wyboru.

### 1.2. Cele dydaktyczne

| ID | Cel | Sposób sprawdzenia (bez udziału AI w ocenie) |
|---|---|---|
| CD-1 | Uczeń wskazuje co najmniej jeden skutek 2. rzędu decyzji budżetowej gminy | test pre/post oceniany przez człowieka |
| CD-2 | Uczeń odczytuje podstawowe pozycje budżetu gminy (dochody, wydatki, wynik, zadłużenie) na danych rzeczywistych | zadanie na danych BDL/BIP, ocena nauczyciela |
| CD-3 | Uczeń formułuje argument za i przeciw tej samej decyzji z perspektywy różnych grup mieszkańców | omówienie, karta refleksji |
| CD-4 | Uczeń odróżnia fakt (dane z datą i źródłem) od założenia modelu | test pre/post, ćwiczenie „dlaczego tak wyszło” |
| CD-5 | Uczeń rozpoznaje, że tekst narracyjny został wygenerowany przez AI i nie jest źródłem danych | test post, obserwacja nauczyciela |

### 1.3. Cele MVP

- MVP-C1: sprawdzić, czy deterministyczny model przyczynowy jednej gminy, oparty na danych publicznych, jest zrozumiały dla ucznia w wieku ok. 13-19 lat w czasie jednej lekcji lub jednego dnia zajęć projektowych.
- MVP-C2: sprawdzić wykonalność trzech warstw architektury (model, populacja NPC, szablony narracji LLM przygotowywane poza grą) przy realizacji zerobudżetowej.
- MVP-C3: przeprowadzić pilotaż w jednej gminie i co najmniej jednej szkole z pomiarem pre/post.
- MVP-C4: potwierdzić, że wymagania W-1…W-24 (§6.5) są wykonalne bez utraty wartości dydaktycznej.

## 2. Zakres

### 2.1. W zakresie MVP

- Jeden poziom gry: gmina. Gmina pilotażowa `[DO USTALENIA]`, kryteria w §2.4.
- Dane rzeczywiste gminy: GUS/BDL, uchwała budżetowa i sprawozdania z BIP, z datą pobrania i wersją.
- Cztery obszary decyzji: budżet, energia (obiekty gminne), transport (komunikacja lokalna, dowozy), podatki i opłaty lokalne w granicach stawek maksymalnych (wartości DO WERYFIKACJI na rok gry).
- Wskaźniki ekonomiczne, społeczne i ekologiczne (§6.1).
- Scenariusz zewnętrzny: szok cen paliw bez nazwanego konfliktu zbrojnego i bez realnych państw.
- Dwa kanały: tryb klasowy (drużynowy, z opiekunem) i tryb indywidualny (domyślnie bez konta).
- Panel opiekuna, raport omówienia, funkcja „dlaczego tak wyszło”.
- Wersja webowa bez aplikacji mobilnej natywnej (ZAŁOŻENIE Z-01).

### 2.2. Poza MVP

- Poziom województwa i państwa.
- Scenariusze wojenne i geopolityczne z realnymi państwami (np. Rosja, USA-Iran) — odrębna kontrola prawna przed włączeniem (W-24).
- Tryb wieloosobowy między szkołami, rankingi, profile publiczne, czat — ponowna ocena DSA/RODO/ochrony małoletnich (W-19).
- Aplikacja mobilna — ponowna ocena CRA.
- Pola swobodnego tekstu przekazywane do LLM (W-5).
- Generowanie narracji przez LLM na żywo w czasie gry — wymaga odrębnej oceny (art. 50 AI Act, RODO).

### 2.3. Wyłączenia stałe

- Medyczny bliźniak cyfrowy i dane zdrowotne.
- Ocena ucznia, sugestia oceny, sterowanie ścieżką nauki (W-9).
- Rozpoznawanie emocji, kamera, analiza sentymentu (W-10).
- Realni politycy, partie i ugrupowania lokalne (W-21).
- Reklamy, trackery, sprzedaż danych (W-8); mechaniki kompulsywne, loot boxy, waluty premium (W-11).
- Zapożyczenia nazw i mechanik z gier i projektów stanowiących inspirację; brak sugestii afiliacji.

### 2.4. Kryteria wyboru gminy pilotażowej

| Kryterium | Uzasadnienie |
|---|---|
| Kompletność danych BDL i BIP za ostatnie dostępne lata | kalibracja modelu |
| Szkoła z kl. VII-VIII lub ponadpodstawowa gotowa do udziału (art. 86 Prawa oświatowego: uzgodnienie warunków, opinie rady szkoły i rady rodziców, zgoda dyrektora — W-18) | warunek pilotażu |
| Pisemna akceptacja gminy dla użycia nazwy albo wariant „gmina modelowa” | ryzyko R-08 |
| Brak kampanii wyborczej w okresie pilotażu — dotyczy wszystkich wyborów, nie tylko lokalnych — albo przyjęcie trybu „okres kampanii” | W-22, R-09 |
| Struktura dojazdów pozwalająca pokazać problem transportowy | scenariusz szoku cen paliw |
| Łącze w szkole sprawdzone przed pilotażem | §6.6 |
| Wielkość populacji wykluczająca rozpoznanie rzeczywistych osób w populacji NPC | RODO, R-16 |

## 3. Definicje

| Termin | Definicja w tym dokumencie |
|---|---|
| Model przyczynowy | Jawny, deterministyczny graf: węzły = zmienne gminy, krawędzie = współczynniki wpływu. Te same wejścia dają zawsze te same wyniki. |
| Współczynnik | Siła i kierunek wpływu jednej zmiennej na drugą; wersjonowany, ze źródłem albo oznaczeniem „założenie kalibracyjne”. |
| Karta modelu / karta danych | Dokumenty opisujące zmienne, współczynniki, źródła, uproszczenia i ograniczenia modelu / źródło, datę pobrania, podstawę ponownego wykorzystania i przekształcenia każdego zbioru. |
| Ścieżka przyczynowa | Lista krawędzi, przez które przeszła zmiana od decyzji do wskaźnika, z wartościami pośrednimi; podstawa funkcji „dlaczego tak wyszło”. |
| NPC | Syntetyczny mieszkaniec gminy (dochód, zawód, sposób i koszt dojazdu, wiek, waga reprezentacji). Nie odpowiada żadnej rzeczywistej osobie. |
| Populacja agentowa | Zbiór NPC wygenerowany deterministycznie (stałe ziarno) z rozkładów zagregowanych danych publicznych. |
| Skutek n-tego rzędu | Skutek 1. rzędu = bezpośrednia zmiana wywołana decyzją lub zdarzeniem; każde kolejne ogniwo łańcucha przyczynowego = kolejny rząd (2., 3., …). |
| Sprzężenie zwrotne | Wpływ agregatów populacji NPC na zmienne modelu w kolejnej turze. |
| Tura | Jednostka czasu gry; ZAŁOŻENIE: jeden rok budżetowy. |
| Szablon narracji | Tekst scenariusza lub historii NPC przygotowany z wyprzedzeniem przez LLM i przejrzany przez człowieka, zawierający pola (liczby, nazwy NPC, wartości wskaźników) wypełniane w grze deterministycznie przez warstwy 1-2. |
| Warstwa LLM | Moduł generujący szablony narracji na etapie przygotowania treści, poza pętlą tury; nie ma dostępu do danych gracza ani wyników sesji. |
| Tryb klasowy / indywidualny | Sesja prowadzona przez opiekuna w szkole, konta zakłada nauczyciel / sesja poza szkołą, domyślnie bez konta, stan zapisany lokalnie w przeglądarce. |
| Opiekun grupy | Nauczyciel lub inna osoba prowadząca sesję; nie jest oceniany przez system i nie otrzymuje od niego ocen uczniów. |
| Gmina modelowa | Dane rzeczywiste gminy, nazwa i cechy identyfikujące zmienione. |
| KRiBSI | Komisja Rozwoju i Bezpieczeństwa Sztucznej Inteligencji — organ nadzoru wg ustawy o systemach sztucznej inteligencji (POTWIERDZONE); faktyczne rozpoczęcie działalności DO WERYFIKACJI. |
| DPIA / TIA | Ocena skutków dla ochrony danych (art. 35 RODO) / ocena skutków transferu danych poza EOG. |
| BDL / EOG | Bank Danych Lokalnych GUS / Europejski Obszar Gospodarczy. |

## 4. Interesariusze

| Interesariusz | Rola w MVP | Zobowiązania wobec niego |
|---|---|---|
| Uczniowie (ok. 13-19 lat) | gracze w trybie klasowym | brak oceniania i profilowania; informacja zrozumiała dla 13-latka (W-8, W-9) |
| Gracze indywidualni (młodzież i dorośli) | gracze poza szkołą | tryb bez konta domyślnie (W-1); konto <16 lat tylko przez rodzica lub za jego zgodą (W-3) |
| Nauczyciele — opiekunowie grup | prowadzą sesję i omówienie | scenariusz lekcji, mapowanie na podstawę, materiał o AI (W-13) |
| Szkoła (dyrektor) | zgoda na wejście (art. 86 Prawa oświatowego); w kanale szkolnym szkoła jest administratorem (dokładne wskazanie — dyrektor/organ prowadzący — DO WERYFIKACJI, PR-1) | umowa powierzenia (art. 28 RODO), wzór DPIA, standardy ochrony małoletnich |
| Rada szkoły i rada rodziców | pozytywna opinia warunkująca zgodę dyrektora (art. 86) | jawne założenia, neutralność, brak realnych postaci politycznych |
| Rodzice | zgoda dla osób <16 lat przy koncie w kanale indywidualnym | informacja o przetwarzaniu, usunięcie konta |
| Gmina pilotażowa `[DO USTALENIA]` | źródło danych, ewentualny partner | uzgodnienie wariantu nazwy, przegląd karty danych |
| Fundacja (założyciel) | właściciel produktu; podmiot przetwarzający w kanale szkolnym; w kanale indywidualnym rola DO WERYFIKACJI (PR-1) — w trybie bez konta z zapisem lokalnym fundacja może nie przetwarzać danych osobowych, przy koncie pseudonimowym ZAŁOŻENIE robocze: rola administratora (PR-1) | — |
| GUS/BDL, BIP gmin | źródła danych publicznych | atrybucja, data pobrania, warunki ponownego wykorzystania |
| Dostawca LLM i hostingu `[DO USTALENIA]` | dalszy podmiot przetwarzający (hosting); dostawca narzędzia (LLM) | wymagania W-6 |
| Partnerzy merytoryczni `[DO USTALENIA]` (ekonomista, metodyk, prawnik) | przegląd modelu, lekcji, zgodności | dostęp do karty modelu i danych |
| Organy nadzoru (PUODO, KRiBSI) | nadzór | dokumentacja zgodności, ewentualny wniosek o opinię (W-14) |

## 5. Założenia

Fakty z ustaleń z założycielem (bez znacznika): podmiot jest fundacją; działalność nieodpłatna; brak budżetu gotówkowego; realizacja przez założyciela przy wsparciu narzędzi AI; poziomy gry gmina → województwo → państwo; MVP od gminy; grupa docelowa jak w §4.

| ID | Treść |
|---|---|
| Z-01 | ZAŁOŻENIE: MVP jest aplikacją webową działającą w aktualnych przeglądarkach na komputerach szkolnych i smartfonach, bez instalacji. |
| Z-02 | ZAŁOŻENIE: silnik modelu i NPC działa w przeglądarce, co pozwala grać przy słabym łączu i ogranicza przesyłanie danych. |
| Z-03 | ZAŁOŻENIE: graf MVP liczy 30-60 węzłów; większy utrudnia zrozumienie w czasie lekcji. Wymaga testu z uczniami. |
| Z-04 | ZAŁOŻENIE: populacja liczy od kilkuset do kilku tysięcy NPC (dobór wg wydajności przeglądarki); NPC reprezentuje grupę mieszkańców z wagą. |
| Z-05 | ZAŁOŻENIE: sesja klasowa obejmuje 3-5 tur. |
| Z-06 | ZAŁOŻENIE: sesja klasowa mieści się w 1-2 godzinach lekcyjnych; wariant projektowy obejmuje 3-5 spotkań. |
| Z-07 | ZAŁOŻENIE: drużyna liczy 3-5 uczniów. |
| Z-08 | Ustalenie projektowe: LLM generuje z wyprzedzeniem szablony narracji i scenariuszy, przeglądane przez człowieka przed publikacją; pola szablonów wypełniają w grze deterministycznie warstwy 1-2. LLM nie działa w pętli tury i nie widzi danych gracza. Generowanie na żywo jest poza MVP (§2.2). Decyzja orkiestratora z 2026-10-27, wynikająca z odpowiedzi założyciela (AI generuje treść na podstawie danych ogólnodostępnych i zweryfikowanych) — do akceptacji założyciela. |
| Z-09 | ZAŁOŻENIE: dane BDL i sprawozdania budżetowe są dostępne za kilka ostatnich lat, co pozwala na kalibrację wsteczną części współczynników. |
| Z-10 | ZAŁOŻENIE: część współczynników nie będzie miała bezpośredniego źródła i zostanie przyjęta eksperymentalnie z jawnym oznaczeniem. |
| Z-11 | ZAŁOŻENIE: założyciel ma czas pozwalający na harmonogram z §11; brak zespołu etatowego. |
| Z-12 | ZAŁOŻENIE: co najmniej jeden nauczyciel szkoły pilotażowej współtworzy scenariusz lekcji. |
| Z-13 | ZAŁOŻENIE: dostępne są bezpłatne lub niskokosztowe programy hostingu i LLM dla NGO; ich warunki wymagają sprawdzenia pod kątem W-6. |
| Z-14 | ZAŁOŻENIE: kod silnika i karta modelu są publikowane jawnie (licencja `[DO USTALENIA]`), co wspiera W-15 i W-23. |

## 6. Wymagania

### 6.1. Wymagania funkcjonalne MVP

**Decyzje gracza** (wybory zamknięte, bez pól swobodnego tekstu — W-5)

| ID | Obszar | Przykładowe decyzje | Uwagi |
|---|---|---|---|
| F-01 | Budżet | przesunięcia między działami; inwestycje vs. wydatki bieżące; zadłużenie | uproszczone reguły finansów JST opisane w karcie modelu |
| F-02 | Energia | termomodernizacja i oświetlenie budynków gminnych; źródło ciepła | koszty energii, emisje, wydatki inwestycyjne |
| F-03 | Transport | częstotliwość kursów; cena biletu; dowozy szkolne; utrzymanie dróg | koszt dojazdu NPC, dostępność pracy, emisje |
| F-04 | Podatki i opłaty | podatek od nieruchomości, opłata za odpady, ulgi | w granicach stawek maksymalnych (DO WERYFIKACJI na rok gry) |
| F-05 | Reakcja na scenariusz | opcje zamknięte wobec szoku cen paliw (dopłata do biletu, zmiana rozkładu, brak działania) | bez nazwanego konfliktu i realnych państw |

**Wskaźniki**

| ID | Grupa | Wskaźniki (lista robocza) |
|---|---|---|
| F-06 | Ekonomiczne | dochody i wydatki gminy, wynik budżetu, zadłużenie, wydatki inwestycyjne, dochód rozporządzalny NPC, bezrobocie w populacji NPC |
| F-07 | Społeczne | udział NPC z kosztem dojazdu powyżej progu `[DO USTALENIA]`, dostępność transportu, rozkład obciążeń wg wieku i dochodu, migracja NPC (w modelu) |
| F-08 | Ekologiczne | emisje z obiektów gminnych i transportu, zużycie energii obiektów gminnych |

Każdy wskaźnik ma jednostkę, wartość wyjściową z datą i źródłem albo oznaczenie „wartość modelowa” oraz ścieżkę przyczynową.

**Tryby i role**

| ID | Wymaganie |
|---|---|
| F-09 | Tryb drużynowy: decyzje na jednym lub kilku urządzeniach w sesji opiekuna; brak komunikacji tekstowej między użytkownikami (W-19). |
| F-10 | Tryb indywidualny: start bez konta, zapis lokalny, opcjonalny eksport/import pliku stanu. Konto pseudonimowe bez e-maila tylko na żądanie; dla osób <16 lat wyłącznie zakładane przez rodzica lub za jego zgodą (W-1, W-3). |
| F-11 | Panel opiekuna: tworzenie sesji, pseudonimowe dostępy drużyn, uruchamianie tur, podgląd decyzji i wskaźników drużyn, porównanie przebiegów bez rankingów, usunięcie sesji i danych. Bez ocen, punktacji ucznia i rekomendacji ocen (W-9). |
| F-12 | Omówienie: raport deterministyczny (bez LLM) — przebieg decyzji, zmiany wskaźników, trzy najdłuższe ścieżki przyczynowe, lista kompromisów, pytania do dyskusji. |
| F-13 | „Dlaczego tak wyszło”: dla każdego wskaźnika i tury lista krawędzi z wartościami pośrednimi i źródłem współczynnika. |
| F-14 | Historie NPC: przejrzany szablon narracji, w którym pola (nazwa NPC, dochód, koszt dojazdu, wartości wskaźników) wypełnia deterministycznie warstwa 1-2; tekst oznaczony jako wygenerowany przez AI (W-12). |
| F-15 | Usunięcie danych: stan lokalny jednym działaniem; sesja przez opiekuna; konto bez kontaktu z fundacją. |

### 6.2. Architektura trzech warstw

**Warstwa 1 — model przyczynowy (deterministyczny)**

- Graf skierowany; krawędzie z kierunkiem, siłą i opóźnieniem (w turach); współczynniki wersjonowane, wersja widoczna w interfejsie i raporcie.
- Źródła: GUS/BDL, uchwała budżetowa i sprawozdania z BIP; każdy współczynnik ma pole „źródło” albo „założenie kalibracyjne”.
- Brak losowości; szok cen paliw jest parametrem wejściowym.
- Identyczne wejście + identyczna wersja modelu = identyczny wynik (test regresyjny).

**Warstwa 2 — populacja agentowa NPC (deterministyczna)**

- Generacja z rozkładów zagregowanych (wiek, zatrudnienie, dojazdy — o ile dostępne publicznie) przy stałym ziarnie zapisanym w wersji modelu; brak danych jednostkowych na wejściu.
- Przeliczenie po każdej decyzji wg jawnych reguł (np. przejście z samochodu na autobus po przekroczeniu progu kosztu).
- Agregaty wracają do grafu jako sprzężenie zwrotne w następnej turze.
- Wypełnienie pól szablonów narracji wartościami z warstw 1-2 i wybór wariantu szablonu wg jawnych reguł (np. kierunek zmiany wskaźnika).

**Warstwa 3 — LLM (etap przygotowania treści, poza pętlą tury)**

- Działa wyłącznie przed publikacją wersji treści. Wejście: opis scenariusza, etykiety i zakresy zmiennych modelu, ogólnodostępne zweryfikowane dane. Brak danych użytkowników i wyników sesji (W-5, W-6).
- Wyjście: szablony scenariuszy i historii NPC z polami; LLM nie liczy skutków, nie zmienia wartości modelu i nie ocenia gracza (W-9).
- Filtr wyjścia: realne postacie i partie polityczne, agitacja, treści nieodpowiednie dla małoletnich, nazwy realnych państw w kontekście konfliktu (W-21, W-22, W-24).
- Kontrola zgodności liczb: szablon nie może zawierać liczb wpisanych na stałe poza polami; każde pole musi odpowiadać zmiennej modelu; kierunek opisany w tekście (wzrost/spadek) musi odpowiadać regule wyboru wariantu. Niezgodność = odrzucenie szablonu.
- Przegląd człowieka przed publikacją; zestaw szablonów powiązany z wersją modelu.
- Oznaczenia: etykieta „wygenerowane przez AI” i znakowanie maszynowe w metadanych (W-12).
- Generowanie na żywo — poza MVP; wymaga odrębnej oceny (art. 50 AI Act, RODO), DPIA i testu filtra.
- Dostawca LLM i hosting `[DO USTALENIA]` (W-6).

**Komponenty (szkic):** klient webowy (interfejs, silnik modelu i NPC, wypełnianie szablonów, zapis lokalny); repozytorium modelu (graf, wersje, karta modelu — Z-14); potok danych (BDL/BIP, karta danych); serwer sesji klasowych (pseudonimowe dostępy, minimalna retencja); moduł redakcyjny LLM (generowanie, filtr, kontrola liczb, przegląd, publikacja szablonów).

### 6.3. Przejrzystość modelu

| ID | Wymaganie |
|---|---|
| P-01 | Karta modelu publikowana przy każdej wersji (W-15, W-23). |
| P-02 | Karta danych dla każdego zbioru. |
| P-03 | Przy każdej wartości: źródło i data albo „wartość modelowa”. |
| P-04 | „Dlaczego tak wyszło” (F-13) w obu trybach. |
| P-05 | Komunikat stały: „To model uproszczony. Pokazuje zależności, nie przewiduje przyszłości gminy.” |
| P-06 | Zgłaszanie stronniczości lub błędu: formularz z wyborami zamkniętymi, opcjonalny kontakt dorosłego; rejestr zgłoszeń i odpowiedzi publikowany w formie zanonimizowanej (W-23). |
| P-07 | Dziennik zmian współczynników z uzasadnieniem. |

### 6.4. Wymagania pedagogiczne

Stan podstawy programowej (2026-10-27, źródła wtórne; szczegóły — dokument „Projekt dydaktyczny”):

- Szkoła podstawowa: nowa podstawa (reforma „Kompas Jutra”) — rozporządzenie z 11.03.2026, Dz.U. 2026 poz. 378; ramowe plany nauczania — odrębne rozporządzenie z 12.03.2026, Dz.U. 2026 poz. 380. Od 1.09.2026 w kl. I i IV — POTWIERDZONE. Kl. VII ok. 2029/30, kl. VIII ok. 2030/31 — DO WERYFIKACJI. EDB w kl. VIII — rozbieżność źródeł, DO WERYFIKACJI.
- Moduły tematyczne w podstawie (nie przedmioty): moduł ekonomiczno-finansowy (kl. IV-VIII) — POTWIERDZONY; moduł klimatyczny — nazwa DO WERYFIKACJI.
- Edukacja obywatelska: w szkołach ponadpodstawowych od 1.09.2025; w szkole podstawowej zastępuje WOS (planowo kl. VI-VII po 1 godz. — DO WERYFIKACJI w poz. 380), w kl. VII najwcześniej ok. 2029/30. Obecnie w kl. VII-VIII obowiązuje WOS wg dotychczasowej podstawy.
- Szkoły ponadpodstawowe: nowa podstawa planowo od 1.09.2027 w klasach I; status publikacji DO WERYFIKACJI.
- Tydzień projektowy (wg poz. 380; źródła rozbieżne — DO WERYFIKACJI): 2026/27 fakultatywnie; 2027/28 kl. IV-V; 2028/29 kl. IV-VI; 2029/30 kl. IV-VII; od 2030/31 kl. IV-VIII. Dla kl. VII-VIII stały element najwcześniej od 2029/30; w MVP wyłącznie opcja fakultatywna.

| ID | Wymaganie |
|---|---|
| D-01 | Mapowanie na obowiązującą podstawę: SP kl. VII-VIII → WOS, geografia, EDB; szkoły ponadpodstawowe → edukacja obywatelska, geografia, EDB; „biznes i zarządzanie” — przedmiot NIEPOTWIERDZONY, DO WERYFIKACJI. Punkty podstawy `[DO USTALENIA]` z nauczycielem. |
| D-02 | Mapowanie docelowe na moduły tematyczne Kompasu Jutra z datą wejścia dla danej klasy. |
| D-03 | Scenariusz lekcji 45 min (podstawowy) i wariant zajęć projektowych (fakultatywny). |
| D-04 | Materiał dla opiekuna: cele CD-1…CD-5, przebieg, pytania, typowe błędne przekonania, wyjaśnienie warstwy AI (W-13). |
| D-05 | Brak oceniania w produkcie; ocena szkolna wyłącznie u nauczyciela, poza systemem (W-9). |
| D-06 | Treści neutralne światopoglądowo i politycznie; kompromisy zamiast „właściwej” opcji. |
| D-07 | Język zrozumiały dla 13-latka; przegląd przez polonistę lub metodyka `[DO USTALENIA]`. |

### 6.5. Wymagania prawne i etyczne (twarde)

Werdykt eksperta prawno-regulacyjnego: ZGODNE Z WARUNKAMI. Niespełnienie któregokolwiek wymagania blokuje pilotaż. Publikatory i uzasadnienie — §16 i „Analiza prawna”.

Stan regulacji (2026-10-27; szczegóły — §16 poz. 4-5, 9): AI Act zmieniony rozporządzeniem (UE) 2026/1744; obowiązki z Zał. III od 2.12.2027, z Zał. I od 2.08.2028 — POTWIERDZONE. Art. 50 stosowany od 2.08.2026; okres przejściowy ust. 2 (do 2.12.2026) obejmuje tylko systemy wprowadzone wcześniej, nie EcoChallenge (POTWIERDZONE). Wytyczne KE do art. 50 — DO WERYFIKACJI. Ustawa o systemach sztucznej inteligencji, organ KRiBSI — POTWIERDZONE; wejście w życie (27.07 albo 11.08.2026) i przepisy stosowane od 28.10.2026 — DO WERYFIKACJI; brak faktycznej działalności KRiBSI wg doniesień z X 2026 — DO WERYFIKACJI (wpływ na W-14).

| ID | Wymaganie | Konsekwencja dla produktu |
|---|---|---|
| | **RODO** (próg wieku 16 lat wg art. 8 w PL — POTWIERDZONE) | |
| W-1 | Tryb bez konta domyślny w kanale indywidualnym; konta pseudonimowe bez e-maila | F-10; brak rejestracji przy starcie |
| W-2 | Kanał szkolny: szkoła administratorem (dyrektor/organ prowadzący — DO WERYFIKACJI, PR-1), fundacja podmiotem przetwarzającym (art. 28); konta zakłada nauczyciel | wzór umowy powierzenia; F-11 |
| W-3 | Osoby <16 lat: konto chmurowe tylko za zgodą rodzica lub zakładane przez rodzica | mechanizm i wzór zgody (P-K18, PR-9) |
| W-4 | DPIA przed uruchomieniem | P-K06, §15 |
| W-5 | Brak pól swobodnego tekstu przekazywanych do LLM | wyłącznie wybory zamknięte |
| W-6 | LLM/hosting preferowany w EOG; poza EOG — DPF albo SCC (§16 poz. 2-3) z TIA; bez trenowania na danych; minimalna retencja | kryteria wyboru dostawcy; TIA warunkowo (P-K19); przy Z-08 do LLM nie trafiają dane osobowe |
| W-7 | Personalizacja wyłącznie w obrębie sesji, bez trwałego profilu, domyślnie wyłączona | brak profilu użytkownika na serwerze |
| W-8 | Informacja o przetwarzaniu zrozumiała dla 13-latka; bez reklam, trackerów, cookies analitycznych bez zgody | dwie wersje informacji; zapis lokalny ograniczony do niezbędnego (art. 399 PKE — ustęp zwolnienia DO WERYFIKACJI, PR-7) |
| | **AI Act** | |
| W-9 | System nie ocenia ucznia, nie wystawia ani nie sugeruje ocen, nie steruje ścieżką nauki | F-11, D-05; argument przeciw kwalifikacji z Zał. III (PR-2) |
| W-10 | Zakaz rozpoznawania emocji, kamer, analizy sentymentu (art. 5 ust. 1 lit. f — numeracja po nowelizacji DO WERYFIKACJI) | brak dostępu do kamery i mikrofonu |
| W-11 | Bez dark patterns, mechanik kompulsywnych, loot boxów, manipulacji politycznej (art. 5 ust. 1 lit. a-b — numeracja DO WERYFIKACJI) | brak serii dziennych, powiadomień nakłaniających, nagród losowych; przegląd UX |
| W-12 | Oznaczenia art. 50: etykieta „wygenerowane przez AI”, znakowanie maszynowe, informacja o AI. Przy Z-08 (LLM poza pętlą gry, brak dialogu z użytkownikiem) obowiązek informowania o interakcji z systemem AI w MVP prawdopodobnie nie zachodzi; zakres rozstrzyga PR-3; etykieta „wygenerowane przez AI” pozostaje. | F-14; metadane szablonów; teksty przejrzane przez człowieka — PR-3 |
| W-13 | Działania wspierające kompetencje w zakresie AI (art. 4 po zmianach — obowiązek działań, bez wymogu określonego poziomu) dla zespołu i nauczycieli | D-04; P-K17 |
| W-14 | Rozważenie wniosku do KRiBSI o opinię indywidualną co do klasyfikacji | decyzja `[DO USTALENIA]`; bez działalności KRiBSI — notatka klasyfikacyjna z opinią prawnika (P-K10) |
| W-15 | Dokumentacja modelu deterministycznego jako jawnego, opartego na regułach | P-01; rozdzielenie warstw 1-2 (reguły) i 3 (LLM) |
| | **Ochrona małoletnich** (ustawa z 13.05.2016, t.j. Dz.U. 2026 poz. 110 z późn. zm.) | |
| W-16 | Standardy ochrony małoletnich — obowiązkowe, jeśli fundacja jest podmiotem z art. 22b (PR-5), inaczej dobrowolne | P-K11 |
| W-17 | Weryfikacja z art. 21 (Rejestr Sprawców, KRK) osób mogących mieć kontakt z małoletnim użytkownikiem; zakres — PR-5 | lista osób i weryfikacja przed pilotażem |
| W-18 | Art. 86 Prawa oświatowego (t.j. Dz.U. 2026 poz. 820): zgoda dyrektora po uzgodnieniu warunków i pozytywnej opinii rady szkoły i rady rodziców; ust. 2a-2n DO WERYFIKACJI | P-K12; fazy 0-2 (§11) |
| | **DSA** (UE) 2022/2065 (stosowanie do usługi nieodpłatnej DO WERYFIKACJI, PR-4; do rozstrzygnięcia W-19 i W-20 są twarde) | |
| W-19 | Brak czatu, wiadomości prywatnych, publicznych profili i rankingów, udostępniania poza klasą; zmiana = ponowna ocena DSA/RODO/ochrony małoletnich | F-09, F-11 |
| W-20 | Punkt kontaktowy dla organów (art. 11) i odbiorców (art. 12), mechanizm zgłoszeń (art. 16) — POTWIERDZONE; regulamin zrozumiały dla małoletnich (art. 14 ust. 3 — DO WERYFIKACJI) | regulamin w dwóch wersjach; formularz wspólny z P-06 |
| | **Neutralność** | |
| W-21 | Wyłącznie fikcyjni politycy i ugrupowania; filtr wyjścia LLM | lista nazw fikcyjnych sprawdzona pod kątem kolizji (P-K20) |
| W-22 | Brak agitacji (Kodeks wyborczy art. 108 § 2, sankcja art. 494 § 2 — DO WERYFIKACJI); dostosowanie treści w kampanii dowolnych wyborów | kalendarz wyborów; tryb „okres kampanii” |
| W-23 | Jawne założenia modelu, źródła GUS/BDL z datą, procedura zgłaszania stronniczości | P-01…P-07 |
| W-24 | Scenariusze wojenne i z realnymi państwami poza MVP; włączenie po odrębnej kontroli prawnej | blokada w module redakcyjnym |

**Zakazane warianty** (problem → legalna alternatywa → konsekwencja):

| Zakazany wariant | Legalna alternatywa | Konsekwencja zakazanego wariantu |
|---|---|---|
| Konto osoby <16 lat na zgodzie samego dziecka | tryb bez konta albo konto zakładane przez rodzica lub za jego zgodą | brak ważnej podstawy przetwarzania, ryzyko sankcji PUODO |
| Rozpoznawanie emocji ucznia (kamera, mikrofon, analiza sentymentu) | karta refleksji wypełniana dobrowolnie lub obserwacja nauczyciela poza systemem, bez kamery i mikrofonu; zaangażowanie mierzone wyłącznie anonimowymi metrykami gry | praktyka zakazana (art. 5 ust. 1 lit. f AI Act); kara do 35 mln EUR lub 7% obrotu (numeracja DO WERYFIKACJI) |
| Ocena ucznia przez LLM z profilowaniem | ocena wyłącznie przez nauczyciela poza systemem | kwalifikacja jako system wysokiego ryzyka (Zał. III) z obowiązkami niewykonalnymi w MVP |
| Realni politycy lub partie w treściach | postacie i ugrupowania fikcyjne | ryzyko naruszenia zakazu agitacji w szkołach, utrata neutralności i zgody szkół |

**Inne:** WCAG 2.1 AA — N-01. CRA (UE) 2024/2847 (POTWIERDZONE); ocena „poza zakresem” DO WERYFIKACJI, zwłaszcza przy publikacji kodu (Z-14) i aplikacji mobilnej. Dane GUS/BDL — wg ustawy o otwartych danych, z atrybucją.

### 6.6. Wymagania niefunkcjonalne

| ID | Wymaganie |
|---|---|
| N-01 | WCAG 2.1 AA jako cel: klawiatura, kontrast, tabela wartości jako alternatywa dla wykresów, informacja nie tylko kolorem. |
| N-02 | Słabe łącze: tryb indywidualny działa offline po pierwszym załadowaniu; w trybie klasowym synchronizacja minimalna. ZAŁOŻENIE: pierwsze pobranie do kilku MB. |
| N-03 | Słabe komputery szkolne i smartfony; próg czasu przeliczenia tury `[DO USTALENIA]` po teście. |
| N-04 | Szyfrowanie transmisji; minimalne dane w serwerze sesji; kody sesji o ograniczonej ważności; brak imion i nazwisk uczniów po stronie fundacji. |
| N-05 | Automatyczne usuwanie danych sesji klasowej po okresie `[DO USTALENIA]` (DPIA, umowa powierzenia). |
| N-06 | Testy regresyjne determinizmu przy każdej zmianie współczynników. |
| N-07 | Rejestrowanie zdarzeń technicznych bez danych identyfikujących; w kanale szkolnym wykorzystanie do celów fundacji wyłącznie w formie zanonimizowanej/zagregowanej (PR-10). |
| N-08 | Brak zewnętrznych skryptów analitycznych i reklamowych (W-8). |
| N-09 | Język polski w MVP. |

## 7. Proces

### 7.1. Przebieg lekcji (tryb klasowy, 45 min)

0. Przed zajęciami: test pre (anonimowy, po stronie szkoły); opiekun tworzy sesję, generuje kody drużyn, wybiera scenariusz.
1. Wprowadzenie (ok. 5 min): gmina (dane z datą i źródłem), cel gry, informacja o AI (W-12, W-13).
2. Tury 1-2 (ok. 15 min): decyzje budżetowe, energetyczne, transportowe, podatkowe; zmiany wskaźników.
3. Scenariusz (ok. 10 min): szok cen paliw, wybór reakcji, historie NPC.
4. Analiza (ok. 5 min): „dlaczego tak wyszło” dla jednego wskaźnika; zapis ścieżki na karcie poza systemem.
5. Omówienie (ok. 10 min): raport F-12, porównanie przebiegów bez rankingów, pytania o kompromisy.
6. Po zajęciach: test post.

Podział czasu: ZAŁOŻENIE do weryfikacji w pilotażu.

### 7.2. Wariant zajęć projektowych (fakultatywny)

Tryb i klasy DO WERYFIKACJI (§6.4). Wariant roboczy:

1. Dzień 1: test pre; dane gminy — BDL, BIP, karta danych.
2. Dzień 2: model — graf, „dlaczego tak wyszło”, uproszczenia.
3. Dzień 3: gra — kilka tur i szok cen paliw.
4. Dzień 4: perspektywy mieszkańców — historie NPC, debata z fikcyjnymi rolami.
5. Dzień 5: prezentacje drużyn; test post.

### 7.3. Sesja indywidualna

Wejście bez rejestracji → informacja o przetwarzaniu (wersja dla młodzieży) i o AI → wybór gminy (pilotażowa lub modelowa) → tury z zapisem lokalnym → szok cen paliw → podsumowanie deterministyczne → opcjonalnie eksport pliku lub konto (W-1, W-3) → usunięcie stanu jednym działaniem (F-15).

### 7.4. Proces budowy MVP

1. **Dane:** wybór gminy (§2.4); pobranie BDL i dokumentów budżetowych z BIP; karta danych; kontrola kompletności.
2. **Model:** zmienne i krawędzie; źródło albo założenie kalibracyjne dla każdego współczynnika; przegląd ekonomisty `[DO USTALENIA]`.
3. **Kalibracja:** porównanie z danymi historycznymi (Z-09); rozbieżności w karcie modelu; zamrożenie wersji.
4. **NPC:** generacja z rozkładów zagregowanych; kontrola ryzyka reidentyfikacji; jawne reguły zachowań.
5. **Szablony narracji:** generowanie przez LLM w module redakcyjnym; filtr; kontrola pól i liczb; przegląd człowieka; oznaczenia art. 50; powiązanie z wersją modelu.
6. **Test:** regresja; test użyteczności (dorośli, potem uczniowie za zgodą szkoły i rodziców); WCAG; DPIA; przegląd prawny; dopiero potem pilotaż.

Pętla korekty: wynik testu → zmiana współczynnika lub interfejsu → nowa wersja → test regresyjny → dziennik zmian → ponowna kontrola szablonów.

## 8. Diagram logiczny

### 8.1. Przepływ główny

```
ETAP PRZYGOTOWANIA TREŚCI (poza grą, przed publikacją wersji)
Opis scenariusza + etykiety i zakresy zmiennych modelu vN + dane publiczne
  → Warstwa 3: LLM generuje szablony narracji z polami {…}
  → filtr wyjścia → kontrola pól i liczb → przegląd człowieka
  → publikacja zestawu szablonów powiązanego z wersją modelu vN

PĘTLA TURY (w grze; LLM nieobecny)
Decyzja gracza (wybór zamknięty)
  → Warstwa 1: graf przyczynowy (współczynniki vN)
  → Wskaźniki (ekonomiczne / społeczne / ekologiczne)
  → Warstwa 2: przeliczenie populacji NPC
  │     └→ agregaty NPC → sprzężenie zwrotne do grafu (warstwa 1) ↺ następna tura
  → Wybór wariantu szablonu i wypełnienie pól wartościami z warstw 1-2
        → etykieta „wygenerowane przez AI”
  → Raport deterministyczny + „dlaczego tak wyszło”
  → Omówienie z opiekunem (ocena wyłącznie poza systemem)
```

Ograniczenie kierunku: brak połączenia z warstwy 3 do pętli tury i do danych gracza. LLM nie zapisuje żadnej wartości modelu.

### 8.2. Przykładowy łańcuch — szok cen paliw

Wielkości zmian `[DO USTALENIA]` w kalibracji; poniżej wyłącznie kierunki. Numeracja rzędów wg §3.

```
Zdarzenie: cena paliwa ↑
  ├→ koszt dojazdu NPC dojeżdżających samochodem ↑ (1. rząd)
  │    → dochód rozporządzalny tych NPC ↓ (2. rząd)
  │         → popyt w lokalnych usługach ↓ (3. rząd)
  │              → dochody lokalnych firm ↓ (4. rząd)
  │                   → udział gminy w podatkach dochodowych ↓ (5. rząd, z opóźnieniem)
  │    → część NPC przekracza próg kosztu → przejście na komunikację lokalną (2. rząd)
  │         → obłożenie autobusów ↑ (3. rząd) → wpływy z biletów ↑ (4. rząd)
  │         → emisje z transportu: kierunek zależny od przesunięcia modalnego (3. rząd)
  └→ koszt eksploatacji komunikacji lokalnej i dowozów ↑ (1. rząd)
       → wydatki bieżące gminy ↑ (2. rząd) → wynik budżetu ↓ (3. rząd)

Decyzja A: dopłata do biletu
  → wydatki gminy ↑ (1.) → środki na inwestycje ↓ (2., kompromis)
  → koszt dojazdu NPC ↓ (1.) → dochód rozporządzalny częściowo odbudowany (2.)

Decyzja B: podwyżka podatku od nieruchomości na sfinansowanie dopłaty
  → dochody gminy ↑ (1.)
  → koszty NPC-właścicieli i lokalnych firm ↑ (1.) → dochód rozporządzalny ↓ (2., inna grupa niż w A)

Decyzja C: brak działania
  → skutki łańcucha zdarzenia bez korekty; najbardziej obciążeni NPC o najdłuższych dojazdach
```

Każda strzałka odpowiada krawędzi grafu widocznej w „dlaczego tak wyszło”.

## 9. Ryzyka

Skala: N/Ś/W. Oceny P (prawdopodobieństwo) i S (skutek) są ZAŁOŻENIE do przeglądu po PoC.

| ID | Kategoria | Ryzyko | P | S | Działanie ograniczające | Sygnał wczesnego ostrzegania |
|---|---|---|---|---|---|---|
| R-01 | Merytoryczne | Wyniki brane za prognozę | Ś | W | P-05, karta modelu, CD-4 | K-03 |
| R-02 | Merytoryczne | Współczynniki przyjęte arbitralnie | W | Ś | oznaczenie, przegląd ekonomisty, kalibracja | K-11 |
| R-03 | Merytoryczne | Błąd danych lub przekształceń | Ś | Ś | karta danych, testy zgodności | K-10 |
| R-04 | Pedagogiczne | Graf zbyt złożony na lekcję | Ś | W | Z-03, test z uczniami, tryb uproszczony | K-06, K-04 |
| R-05 | Pedagogiczne | Gra jako optymalizacja punktów | Ś | Ś | bez punktacji i rankingów, wskaźniki bez agregatu | K-01 |
| R-06 | Pedagogiczne | Niedopasowanie do podstawy w okresie przejściowym | W | Ś | D-01, D-02, aktualizacja mapowania | otwarte DO WERYFIKACJI w §6.4 |
| R-07 | Polityczne | Odbiór modelu jako stronniczego | Ś | W | jawne założenia, P-06, przegląd przez osoby o różnych poglądach `[DO USTALENIA]` | K-07 |
| R-08 | Polityczne | Gmina odbiera wyniki jako ocenę władz | Ś | W | uzgodnienie, gmina modelowa | uwagi gminy do karty danych |
| R-09 | Polityczne | Pilotaż w kampanii dowolnych wyborów; wybory do Sejmu i Senatu przewidywane jesienią 2027 (data DO WERYFIKACJI, PKW) — możliwa kolizja z oknem IX-XII 2027 | W | W | W-22, tryb „okres kampanii”, przesunięcie okna | zarządzenie o wyborach, kalendarz PKW |
| R-10 | Prawne | Błędna kwalifikacja ról RODO | Ś | W | PR-1, PR-10, wzór umowy | uwagi szkoły do umowy |
| R-11 | Prawne | Kwalifikacja jako system wysokiego ryzyka | N | W | W-9, W-14, W-15, PR-2 | — |
| R-12 | Prawne | Daty i zakres ustawy o systemach AI inne niż przyjęte | Ś | Ś | weryfikacja w źródłach pierwotnych | otwarte DO WERYFIKACJI |
| R-13 | Prawne | Dostawca LLM poza EOG bez zabezpieczeń transferu | Ś | W | W-6, Z-08 | — |
| R-14 | Techniczne | Szablony LLM niezgodne z modelem lub z W-21 | W | Ś | kontrola pól i liczb, filtr, przegląd człowieka | K-09, K-13 |
| R-15 | Techniczne | Wydajność na słabym sprzęcie | Ś | Ś | Z-02, Z-04, test w szkole | K-06 |
| R-16 | Techniczne | Reidentyfikacja mieszkańców małej gminy | N | W | kryterium wielkości (§2.4), agregacja | — |
| R-17 | Organizacyjne | Realizacja przez jedną osobę | W | W | publiczne repozytorium, dokumentacja, partnerzy | opóźnienie fazy >1 mies. |
| R-18 | Organizacyjne | Brak finansowania utrzymania | Ś | Ś | §12, niski koszt stały | — |
| R-19 | Organizacyjne | Brak szkoły lub nauczyciela; brak zgód z art. 86 do VI 2027 | Ś | W | Z-12, wczesny kontakt, zgody w fazach 0-2 | brak opinii rad do V 2027 |
| R-20 | Dokument | Oparcie na źródłach wtórnych w regulacjach w toku zmian | W | Ś | oznaczenia DO WERYFIKACJI, weryfikacja przed pilotażem | otwarte DO WERYFIKACJI |
| R-21 | Prawne | Projekt ustawy o ograniczeniu dostępu do serwisów społecznościowych <15 lat — status i definicje DO WERYFIKACJI | `[DO USTALENIA]` | `[DO USTALENIA]` | W-19; ocena po publikacji projektu | etap prac legislacyjnych |

**Punkty do przeglądu prawnika**

- PR-1: role RODO — kanał szkolny (administrator: dyrektor albo organ prowadzący; wzór umowy powierzenia); kanał indywidualny (czy tryb bez konta z zapisem lokalnym to przetwarzanie przez fundację; rola przy koncie pseudonimowym).
- PR-2: klasyfikacja AI Act (warstwy 1-2 regułowe, brak kategorii Zał. III); wniosek do KRiBSI wobec stanu jej działalności.
- PR-3: zakres art. 50 dla szablonów przejrzanych przez człowieka; wytyczne KE.
- PR-4: DSA wobec usługi nieodpłatnej; art. 14 ust. 3.
- PR-5: art. 22b ustawy z 13.05.2016 (obowiązek standardów); zakres weryfikacji z art. 21.
- PR-6: Kodeks wyborczy art. 108 § 2 i art. 494 § 2 wobec treści gry.
- PR-7: art. 399 PKE — zwolnienie zapisu lokalnego.
- PR-8: ponowne wykorzystanie BDL i BIP; zgoda gminy na nazwę.
- PR-9: forma i weryfikacja zgody rodzica (W-3).
- PR-10: licznik zdarzeń w kanale szkolnym (K-05, N-07) jako cel własny podmiotu przetwarzającego; rozwiązanie: dane zanonimizowane/zagregowane, zapis w umowie powierzenia i DPIA.
- CRA: „poza zakresem” przy publikacji kodu (Z-14) — w PR-2 albo osobno.

## 10. KPI

Żaden KPI nie jest liczony z oceny ucznia przez AI; pomiary dydaktyczne wykonuje człowiek. Wartości docelowe ustalane po PoC i ze szkołą, przed fazą 4.

| ID | Grupa | KPI | Pomiar | Wartość docelowa |
|---|---|---|---|---|
| K-01 | Dydaktyczne | Zmiana odsetka uczniów wskazujących skutek 2. rzędu (CD-1) | test pre/post, anonimowy | `[DO USTALENIA]` |
| K-02 | Dydaktyczne | Zmiana poprawności odczytu budżetu (CD-2) | test pre/post | `[DO USTALENIA]` |
| K-03 | Dydaktyczne | Odsetek rozróżniających fakt i założenie (CD-4) | test pre/post | `[DO USTALENIA]` |
| K-04 | Dydaktyczne | Ocena przydatności przez nauczyciela | ankieta | `[DO USTALENIA]` |
| K-05 | Produktowe | Odsetek sesji klasowych zakończonych omówieniem | licznik zagregowany bez identyfikacji (PR-10) | `[DO USTALENIA]` |
| K-06 | Produktowe | Czas do pierwszej decyzji | test użyteczności | `[DO USTALENIA]` |
| K-07 | Produktowe | Liczba zgłoszeń stronniczości/błędów i czas odpowiedzi | rejestr P-06 | czas odpowiedzi `[DO USTALENIA]` |
| K-08 | Produktowe | Otwarte niezgodności WCAG 2.1 AA | przegląd dostępności | ZAŁOŻENIE: 0 niezgodności krytycznych |
| K-09 | Produktowe | Odsetek szablonów odrzuconych w kontroli pól i liczb | moduł redakcyjny | `[DO USTALENIA]` |
| K-10 | Kalibracja | Rozbieżność modelu z danymi historycznymi | kalibracja wsteczna | próg `[DO USTALENIA]` z ekonomistą |
| K-11 | Kalibracja | Odsetek współczynników ze źródłem | karta modelu | `[DO USTALENIA]` |
| K-12 | Kalibracja | Powtarzalność wyników | testy regresyjne | 100% (wymóg determinizmu) |
| K-13 | Produktowe | Liczba szablonów opublikowanych bez przeglądu człowieka | rejestr publikacji modułu redakcyjnego | 0 (wymóg — §6.2 warstwa 3, §15) |

Testy pre/post są anonimowe lub pseudonimowe po stronie szkoły; fundacja otrzymuje wyniki zagregowane. ZAŁOŻENIE: w trybie indywidualnym brak analityki w MVP (W-8).

## 11. Harmonogram

Wszystkie daty: ZAŁOŻENIE (Z-11, wybór gminy i szkoły, finansowanie utrzymania).

| Faza | Okres | Zakres | Kryterium zakończenia |
|---|---|---|---|
| 0. Przygotowanie | XI-XII 2026 | wybór gminy, kontakt ze szkołą i wstępne uzgodnienie warunków (art. 86), partnerzy, wybór dostawcy | gmina i szkoła wskazane `[DO USTALENIA]` |
| 1. PoC modelu | I-III 2027 | dane, graf, kalibracja, interfejs bez LLM; przedstawienie projektu radzie szkoły i radzie rodziców | model z kartą v0.x, test z dorosłymi |
| 2. MVP | IV-VI 2027 | NPC, oba tryby, panel, moduł redakcyjny LLM, WCAG; opinie rady szkoły i rady rodziców, zgoda dyrektora | MVP wg §6.1; DPIA; PR-1…PR-10; zgody z art. 86 uzyskane do VI 2027 |
| 3. Przygotowanie pilotażu | VII-VIII 2027 | materiały, mapowanie na podstawę, standardy ochrony małoletnich, weryfikacje W-17 | check-lista §15 |
| 4. Pilotaż | IX-XII 2027 | sesje klasowe, pre/post, zgłoszenia | raport z pilotażu |
| 5. Ocena | I-II 2028 | KPI, korekta modelu, decyzja o kolejnym etapie | decyzja założyciela |

Faza 3 przypada na wakacje, dlatego zgody z art. 86 uzyskuje się w fazach 0-2; ich brak do VI 2027 przesuwa pilotaż (R-19).

Daty zewnętrzne: obowiązki dla systemów wysokiego ryzyka z Zał. III od 2.12.2027 przypadają w trakcie pilotażu — PR-2 rozstrzygnięty przed fazą 4. Nowa podstawa dla szkół ponadpodstawowych planowo od 1.09.2027 — aktualizacja D-01/D-02 w fazie 3. Wybory do Sejmu i Senatu przewidywane jesienią 2027 (DO WERYFIKACJI) — decyzja o oknie pilotażu albo trybie „okres kampanii” w fazie 3 (R-09).

Wariant wcześniejszy: test z jedną grupą uczniów wiosną 2027 — ZAŁOŻENIE; możliwy tylko po spełnieniu W-2 (umowa powierzenia), W-3 (mechanizm zgody rodzica albo wyłączenie kont), W-4, W-17 i W-18 (w tym wariancie zgody z art. 86 muszą być uzyskane przed testem, a więc wcześniej niż „do VI 2027” ze ścieżki podstawowej) oraz wymagania produktowe z §15 w zakresie wersji testowej (m.in. W-5, W-7…W-12, W-19, W-21).

## 12. Koszty

Model zerobudżetowy: praca założyciela przy wsparciu narzędzi AI, bez wynagrodzeń. Finansowanie utrzymania i pilotażu `[DO USTALENIA]` (grant, darowizna rzeczowa, program dla NGO). Przedziały są ZAŁOŻENIE do porównania, nie wyceną.

| Pozycja | Charakter | Przedział (ZAŁOŻENIE) | Uwagi |
|---|---|---|---|
| Hosting klienta webowego | miesięczny | 0-50 zł/mies. | programy bezpłatne; preferowany w EOG (W-6) |
| Serwer sesji i baza danych | miesięczny | 0-200 zł/mies. | preferowany w EOG (W-6) |
| LLM — generowanie szablonów | na wersję treści | 0-500 zł na wersję | zależne od liczby wariantów |
| LLM — generowanie na żywo | — | N/D — poza MVP | — |
| Domena | roczny | 50-150 zł/rok | — |
| Przegląd prawny | jednorazowy | 0 zł (pro bono) – górna granica `[DO USTALENIA]` | zależna od zakresu PR-1…PR-10 |
| Przegląd metodyczny i ekonomiczny | jednorazowy | 0 zł (wolontariat) – `[DO USTALENIA]` | partnerzy |
| Audyt WCAG | jednorazowy | 0 zł (samoocena) – `[DO USTALENIA]` | — |
| Weryfikacja z art. 21 | na osobę | `[DO USTALENIA]` | każda osoba mogąca mieć kontakt z małoletnim użytkownikiem (zajęcia, punkt kontaktowy, obsługa zgłoszeń) — W-17, PR-5 |
| Materiały drukowane | jednorazowy | 0-300 zł | możliwy druk po stronie szkoły |

Praca założyciela: N/D — brak danych do oszacowania (brak stawki i wymiaru czasu).

## 13. Zależności

| ID | Zależność | Typ | Wpływ przy braku |
|---|---|---|---|
| ZL-01 | Dane BDL i BIP gminy pilotażowej | dane | brak kalibracji, zmiana gminy |
| ZL-02 | Zgoda gminy na nazwę albo wariant „gmina modelowa” | partnerska | R-08 |
| ZL-03 | Art. 86: uzgodnienie warunków, pozytywne opinie rady szkoły i rady rodziców, zgoda dyrektora | prawna | brak pilotażu szkolnego |
| ZL-04 | Umowa powierzenia (szkoła/organ prowadzący — PR-1) | prawna | brak kanału szkolnego |
| ZL-05 | DPIA zakończona | prawna | brak uruchomienia (W-4) |
| ZL-06 | Dostawca LLM i hostingu spełniający W-6 | techniczna/prawna | brak szablonów narracji; MVP działa bez narracji |
| ZL-07 | Klasyfikacja AI Act (PR-2), ewentualnie opinia KRiBSI | prawna | R-11 |
| ZL-08 | Weryfikacja otwartych DO WERYFIKACJI (reforma, AI Act, ustawa o systemach AI) | merytoryczna | błędne mapowanie i daty |
| ZL-09 | Partner-ekonomista | merytoryczna | R-02 |
| ZL-10 | Nauczyciel współtworzący lekcję i przegląd metodyczny | pedagogiczna | R-19, niezweryfikowana hipoteza §1.1 |
| ZL-11 | Kalendarz wyborczy (PKW) | zewnętrzna | R-09 |
| ZL-12 | Kolejność: model → NPC → szablony narracji; szablony po zamrożeniu wersji modelu | techniczna | niespójność narracji z modelem |
| ZL-13 | Dokumenty „Analiza prawna” i „Projekt dydaktyczny” | dokumentacyjna | brak szczegółowego uzasadnienia §6.4-§6.5 |

## 14. Produkty końcowe

| ID | Produkt | Faza |
|---|---|---|
| P-K01 | Model przyczynowy gminy (wersjonowany) z testami regresyjnymi | 1 |
| P-K02 | Karta modelu i karta danych | 1-2 |
| P-K03 | Aplikacja webowa MVP (Z-01): oba tryby, panel opiekuna, „dlaczego tak wyszło”, raport omówienia | 2 |
| P-K04 | Moduł redakcyjny LLM: filtr, kontrola pól i liczb, oznaczenia art. 50 | 2 |
| P-K05 | Scenariusz „szok cen paliw” z przejrzanym zestawem szablonów | 2 |
| P-K06 | DPIA | 2 |
| P-K07 | Wzór umowy powierzenia | 2 |
| P-K08 | Informacja o przetwarzaniu — wersja dla młodzieży i pełna | 2 |
| P-K09 | Regulamin (dwie wersje), punkt kontaktowy, mechanizm zgłoszeń | 2 |
| P-K10 | Notatka klasyfikacyjna AI Act (W-14, W-15) i decyzja ws. KRiBSI | 2 |
| P-K11 | Standardy ochrony małoletnich (W-16) | 3 |
| P-K12 | Pakiet dla szkoły: opis projektu, warunki działalności, materiał dla rady szkoły i rady rodziców (art. 86) | 0-2 |
| P-K13 | Materiał dla nauczyciela: lekcja 45 min, wariant projektowy, mapowanie, materiał o AI | 3 |
| P-K14 | Test pre/post i ankieta nauczyciela | 3 |
| P-K15 | Raport z przeglądu WCAG 2.1 AA | 2-3 |
| P-K16 | Raport z pilotażu z KPI | 5 |
| P-K17 | Dokumentacja działań z art. 4 AI Act (W-13) | 2-3 |
| P-K18 | Mechanizm i wzór zgody rodzica (W-3) | 2 |
| P-K19 | TIA — tylko przy transferze poza EOG (W-6) | 2 |
| P-K20 | Lista nazw fikcyjnych sprawdzona pod kątem kolizji z realnymi (W-21) | 2 |

## 15. Check-lista

Gotowość do pilotażu. Każdy punkt niespełniony blokuje fazę 4.

**Dane i model**

- [ ] Gmina wybrana wg §2.4; wariant nazwy uzgodniony.
- [ ] Karta danych i karta modelu kompletne; każdy współczynnik ze źródłem albo „założeniem kalibracyjnym”.
- [ ] Kalibracja wsteczna wykonana; testy regresyjne przechodzą.
- [ ] Populacja NPC bez danych jednostkowych; ryzyko reidentyfikacji sprawdzone.

**Produkt**

- [ ] F-01…F-15 dostępne; test na sprzęcie i łączu szkoły.
- [ ] W-1: tryb bez konta domyślny w kanale indywidualnym; brak rejestracji przy starcie.
- [ ] W produkcie spełnione: W-5, W-7…W-12, W-19, W-21, W-24 (w tym przegląd UX pod kątem dark patterns).
- [ ] W-23: jawne założenia modelu (karta modelu opublikowana), źródła GUS/BDL z datą przy wartościach, procedura zgłaszania stronniczości działa (P-01…P-07).
- [ ] Wszystkie opublikowane szablony przeszły filtr, kontrolę pól i liczb oraz przegląd człowieka (K-13 = 0); LLM poza pętlą tury.
- [ ] Przegląd WCAG 2.1 AA; niezgodności krytyczne usunięte.

**Prawo i ochrona małoletnich**

- [ ] W-2 (umowa powierzenia), W-3 (P-K18 albo konta wyłączone w pilotażu), W-4 (DPIA), W-6 (dostawca; TIA, jeśli dotyczy), W-13 (P-K17), W-14/W-15 (P-K10), W-16, W-20 — spełnione.
- [ ] W-17: weryfikacja z art. 21 każdej osoby, która może mieć kontakt z małoletnim użytkownikiem (zajęcia, punkt kontaktowy, obsługa zgłoszeń), w zakresie rozstrzygniętym w PR-5.
- [ ] W-18: zgoda dyrektora po uzgodnieniu warunków i pozytywnych opiniach rady szkoły i rady rodziców.
- [ ] W-22: kalendarz wszystkich wyborów sprawdzony; okno pilotażu poza kampanią albo tryb „okres kampanii”.
- [ ] PR-1…PR-10 przejrzane przez prawnika.
- [ ] Wszystkie oznaczenia DO WERYFIKACJI w całym dokumencie rozstrzygnięte albo świadomie zaakceptowane przez założyciela z opinią prawnika.

**Pedagogika**

- [ ] Mapowanie D-01 potwierdzone przez nauczyciela; hipoteza §1.1 skonfrontowana z przeglądem metodycznym.
- [ ] Lekcja i materiał dla nauczyciela gotowe (D-03, D-04); test pre/post i ankieta z procedurą anonimizacji po stronie szkoły.
- [ ] Wartości docelowe KPI (§10) ustalone przed fazą 4.

## 16. Podstawy prawne i bibliografia

Publikatory i teksty jednolite potwierdzić w ISAP i EUR-Lex przed publikacją. Status przy pozycjach — wg weryfikacji z 2026-10-27 (źródła wtórne).

**Prawo Unii Europejskiej**

1. Rozporządzenie (UE) 2016/679 (RODO) — art. 8 (próg 16 lat w PL — POTWIERDZONE), art. 28, art. 35, rozdział V. Podstawa W-1…W-8.
2. Decyzja wykonawcza Komisji (UE) 2023/1795 z 10.07.2023 w sprawie odpowiedniego stopnia ochrony w ramach EU-US Data Privacy Framework (DPF) — DO WERYFIKACJI; ważność decyzji przedmiotem sporu sądowego (odwołanie od wyroku Sądu UE T-553/23 Latombe), stan DO WERYFIKACJI. Podstawa W-6.
3. Decyzja wykonawcza Komisji (UE) 2021/914 z 4.06.2021 w sprawie standardowych klauzul umownych (SCC) dla transferów do państw trzecich — DO WERYFIKACJI. Podstawa W-6.
4. Rozporządzenie (UE) 2024/1689 z 13.06.2024 (AI Act), Dz.Urz. UE z 12.07.2024 — art. 4, art. 5 ust. 1 lit. a, b, f (numeracja po nowelizacji DO WERYFIKACJI), art. 50, Zał. III. Podstawa W-9…W-15.
5. Rozporządzenie (UE) 2026/1744 zmieniające AI Act — publ. 24.07.2026, w mocy od 27.07.2026; Zał. III od 2.12.2027, Zał. I od 2.08.2028 — POTWIERDZONE. Wytyczne KE do art. 50 (VII 2026) — DO WERYFIKACJI.
6. Rozporządzenie (UE) 2022/2065 (DSA) — art. 11, 12, 16 (POTWIERDZONE), art. 14 ust. 3 (DO WERYFIKACJI). Podstawa W-19, W-20.
7. Rozporządzenie (UE) 2024/2847 (CRA) — POTWIERDZONE; ocena „poza zakresem” DO WERYFIKACJI.

**Prawo polskie**

8. Ustawa z 10.05.2018 o ochronie danych osobowych — DO WERYFIKACJI (publikator t.j.).
9. Ustawa z 3.07.2026 o systemach sztucznej inteligencji, Dz.U. 2026 poz. 1003; organ KRiBSI — POTWIERDZONE; wejście w życie głównej części oraz zakres przepisów stosowanych od 28.10.2026 — DO WERYFIKACJI.
10. Ustawa z 13.05.2016 o przeciwdziałaniu zagrożeniom przestępczością na tle seksualnym i ochronie małoletnich, t.j. Dz.U. 2026 poz. 110 z późn. zm. — art. 21, 22b-22c. Podstawa W-16, W-17.
11. Ustawa z 14.12.2016 — Prawo oświatowe, t.j. Dz.U. 2026 poz. 820 — art. 86 (ust. 2a-2n DO WERYFIKACJI). Podstawa W-18.
12. Ustawa z 5.01.2011 — Kodeks wyborczy — art. 108 § 2, art. 494 § 2 (DO WERYFIKACJI w t.j.). Podstawa W-22.
13. Ustawa z 11.08.2021 o otwartych danych i ponownym wykorzystywaniu informacji sektora publicznego, t.j. Dz.U. 2023 poz. 1524 — POTWIERDZONE.
14. Ustawa z 12.07.2024 — Prawo komunikacji elektronicznej, Dz.U. 2024 poz. 1221 — art. 399 (ustęp zwolnienia DO WERYFIKACJI). Podstawa W-8.
15. Rozporządzenie z 11.03.2026 w sprawie podstawy programowej (szkoła podstawowa, „Kompas Jutra”), Dz.U. 2026 poz. 378 — POTWIERDZONE w zakresie kl. I i IV od 1.09.2026.
16. Rozporządzenie z 12.03.2026 w sprawie ramowych planów nauczania, Dz.U. 2026 poz. 380 — tydzień projektowy i wymiar godzin (DO WERYFIKACJI).
17. Obowiązujące rozporządzenia w sprawie podstawy programowej dla kl. VII-VIII i szkół ponadpodstawowych — WOS, edukacja obywatelska, geografia, EDB; „biznes i zarządzanie” — DO WERYFIKACJI.
18. Projekt ustawy o ograniczeniu dostępu do serwisów społecznościowych osobom poniżej 15 lat — status DO WERYFIKACJI (R-21).

**Standardy i źródła danych**

19. W3C, WCAG 2.1, poziom AA.
20. GUS, Bank Danych Lokalnych — zbiory i daty pobrania w karcie danych.
21. BIP gminy pilotażowej — uchwała budżetowa, sprawozdania z wykonania budżetu.

**Inspiracje (bez afiliacji i zapożyczeń nazw i mechanik)**

22. Gry strategiczne (np. seria Cywilizacja, Age of History) oraz wargaming (J. Bartosiak, Strategy & Future) — inspiracja koncepcyjna wskazana przez założyciela; projekt nie jest z nimi powiązany.

---

EcoChallenge — Koncepcja produktu i specyfikacja MVP · wersja robocza 0.2 · stan na 2026-10-27 · wymaga przeglądu prawnego i metodycznego przed pilotażem.
