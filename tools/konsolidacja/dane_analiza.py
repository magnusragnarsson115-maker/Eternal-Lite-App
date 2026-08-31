# -*- coding: utf-8 -*-
"""Dane analizy wlasnej: bledy, zrodla, tabela finansowa, mocne strony.

Wyroznienie w tekscie zapisane jako **tekst** — renderer DOCX zamienia je na pogrubienie.
"""

BLEDY = [
 ('KRYT', 'Luka finansowania ok. 1,3–2,0 mln PLN przed rundą A',
  'Deck podaje skumulowaną EBITDA 2027–2030 na poziomie −1,62, −2,45, −3,19 i −0,85 mln PLN, '
  'a finansowanie do rundy A jako 110 tys. PLN (pre-seed) plus 6,0–6,7 mln PLN (seed).',
  'Suma strat przed osiągnięciem rentowności to **−8,11 mln PLN**, a pozyskany kapitał to '
  '**6,11–6,81 mln PLN**. Brakuje 1,3–2,0 mln PLN. Runda A (20 mln PLN) nie ma w decku daty, '
  'więc na papierze spółka kończy gotówkę w 2029 roku.',
  'Albo wpisać rundę A na rok 2029 jako warunek konieczny, albo podnieść seed do 8–8,5 mln PLN, '
  'albo obciąć koszty tak, by strata 2029 zmieściła się w rundzie seed.'),
 ('KRYT', 'Wycena 200 mln USD nie ma pokrycia w prognozie przychodów',
  'Deck deklaruje cel wyceny 200 mln USD w 2030 i przychód 18,5 mln PLN w 2031.',
  '18,5 mln PLN to około **4,4 mln USD**. Wycena 200 mln USD oznacza **mnożnik ~45× przychodu**. '
  'Transakcje w digital health rozliczają się zwykle w przedziale 3–10× przychodu, a premium SaaS '
  'do 10–15×. Deklarowana wycena jest 4–10 razy wyższa niż to, co uzasadnia prognoza.',
  'Albo urealnić wycenę do 20–45 mln USD przy tej prognozie, albo pokazać prognozę na 2032–2033, '
  'w której przychód sięga 40–60 mln USD. Inwestor policzy ten mnożnik w pierwszej minucie.'),
 ('KRYT', 'Skok wyceny 20–40× w pół roku między pre-seed a seed',
  'Pre-seed: 110 tys. PLN za 5–8% w Q2 2026. Seed: 6,0–6,7 mln PLN za 12–15% w Q4 2026.',
  'Pre-seed implikuje wycenę post-money **1,4–2,2 mln PLN**, seed **40–56 mln PLN**. '
  'To skok 20–40× w ciągu dwóch kwartałów, przy jednym kamieniu milowym (beta z 500 testerami). '
  'Taki skok jest bardzo trudny do obrony przed inwestorem seed.',
  'Zmniejszyć różnicę: albo podnieść wycenę pre-seed, albo obniżyć oczekiwania seed, '
  'albo wstawić rundę pomostową i kamień milowy przychodowy między nimi.'),
 ('WYS', 'TAM 1,39 bln USD jest zawyżony wobec cytowanego źródła',
  'Deck podaje TAM 1,39 bln USD dla zdrowia cyfrowego, ze wskazaniem na raport z 2024 roku.',
  'Główne prognozy na 2030 rok mówią o **573 mld USD** (MarketsandMarkets) do '
  '**946 mld USD** (Grand View Research), przy CAGR 22–24%. Poziom 1,39 bln USD pojawia się '
  'dopiero w prognozach na lata 2032–2033 albo przy znacznie szerszej definicji rynku, '
  'obejmującej cały health IT.',
  'Podać rok, którego dotyczy liczba, i nazwać źródło z metodologią. Bezpieczniej użyć '
  '946 mld USD na 2030 i wskazać Grand View Research — CAGR 22,2% i tak zgadza się z deckiem.'),
 ('WYS', 'Blockchain do niezmienności dokumentacji kłóci się z prawem do bycia zapomnianym',
  'Deck deklaruje technologię rozproszonego rejestru dla zapewnienia niezmienności historii medycznej.',
  'RODO art. 17 daje prawo do usunięcia danych. Rejestr, którego istotą jest niezmienność, '
  'nie pozwala usunąć wpisu. To **znany, nierozwiązany konflikt**, a przy danych szczególnej '
  'kategorii (art. 9) organ nadzorczy potraktuje go poważnie. Deklarowana zaleta jest '
  'w istocie zobowiązaniem prawnym.',
  'Trzymać na łańcuchu wyłącznie hasze i znaczniki czasu, nigdy danych osobowych ani zdrowotnych. '
  'Wtedy usunięcie danych spod hasza realizuje prawo do zapomnienia, a integralność zostaje. '
  'Ten wariant trzeba opisać wprost, inaczej slajd czyta się jako deklaracja przechowywania '
  'danych medycznych w łańcuchu.'),
 ('WYS', 'Scoring dla ubezpieczycieli to zautomatyzowana decyzja o skutkach prawnych',
  'Kanał K6 i slajd modelu biznesowego zakładają scoring ryzyka i składkę pay-as-you-live.',
  'Różnicowanie składki na podstawie danych zdrowotnych to profilowanie prowadzące do decyzji '
  'o istotnym skutku dla osoby — **RODO art. 22** w połączeniu z **art. 9**. Wymaga wyraźnej '
  'zgody, prawa do interwencji człowieka, wyjaśnienia logiki i oceny skutków (DPIA). Sama zgoda '
  'zebrana w darmowej aplikacji może zostać uznana za nieswobodną, jeśli od niej zależy dostęp do funkcji.',
  'Rozdzielić zgodę na korzystanie z aplikacji od zgody na scoring, uczynić tę drugą w pełni '
  'opcjonalną i odwracalną, przewidzieć ścieżkę odwoławczą do człowieka. Bez tego kanał K6 '
  'jest najbardziej ryzykowną pozycją całego modelu.'),
 ('WYS', 'AI Act nie występuje w decku, a system kwalifikuje się jako wysokiego ryzyka',
  'Deck wymienia RODO, HIPAA i MDR. Nie wspomina o AI Act.',
  'System AI wspierający decyzje zdrowotne wchodzi w **załącznik III AI Act** jako wysokiego '
  'ryzyka: wymaga systemu zarządzania ryzykiem, dokumentacji technicznej, nadzoru człowieka, '
  'rejestrowania zdarzeń i oceny zgodności. Do tego art. 50 nakłada obowiązek oznaczania treści '
  'generowanej. To osobny reżim obok MDR, nie jego część.',
  'Dodać AI Act do slajdu zgodności i do rejestru ryzyk regulacyjnych, z osobnym budżetem. '
  'Specyfikacja Master 5.4 już to uwzględnia — deck został w tyle.'),
 ('SR', 'DiGA jest prezentowana jako skrót, a jest osobną ścieżką dowodową',
  'Deck wskazuje DiGA jako drogę do refundowanego dostępu do 73 mln ubezpieczonych w Niemczech.',
  'Wpis do rejestru DiGA wymaga **oznakowania CE jako wyrobu medycznego** oraz dowodu '
  'pozytywnego efektu zdrowotnego. Przy wpisie warunkowym producent ma rok, wyjątkowo dwa, '
  'na dostarczenie badania. BfArM ocenia wniosek w trzy miesiące, ale dopiero po zebraniu dowodów.',
  'Pokazać DiGA jako projekt na 18–30 miesięcy z własnym budżetem badania klinicznego, '
  'a nie jako konsekwencję wejścia na rynek niemiecki.'),
 ('SR', 'Harmonogram implantów jest wewnętrznie sprzeczny',
  'Deck: pilotaż Bio-Tag i Bio-Monitor w latach 2028–2029. Specyfikacja Master 5.4: implant '
  'w klasie IIb/III, ścieżka MDR klasy III to 3–8 mln PLN, certyfikacja realistycznie po 2033.',
  'Różnica wynosi **cztery do pięciu lat**. Slajd fazy czwartej obiecuje pilotaż wcześniej, '
  'niż pozwala ścieżka regulacyjna opisana we własnej specyfikacji.',
  'Rozdzielić na slajdzie pilotaż badawczy (dopuszczalny wcześniej, w reżimie badania klinicznego) '
  'od wdrożenia komercyjnego (po certyfikacji). Bez tego rozdzielenia slajd jest nieobronny '
  'przy due diligence.'),
 ('SR', 'Ekonomika jednostkowa zakłada subskrypcję, której w modelu darmowym nie ma',
  'Segmenty mają CAC 80–120 PLN i LTV 1200–2000 PLN, przy zwrocie 15–16×.',
  'Te LTV były liczone dla płatnej subskrypcji 29,99–49,99 PLN. Po przyjęciu modelu darmowej '
  'aplikacji **LTV trzeba przeliczyć od zera** — z prowizji marketplace, przychodu B2B '
  'i kanałów płatniczych, a nie z opłaty abonamentowej. **To jest konsekwencja mojej własnej '
  'rekomendacji** i muszę ją zgłosić jako otwartą.',
  'Policzyć LTV per segment jako sumę marży z kanałów K3–K11 przypadającej na użytkownika. '
  'Do czasu przeliczenia nie pokazywać zwrotu 15× — jest nieporównywalny z modelem darmowym.'),
 ('SR', 'Budżet MVP 110 tys. PLN nie pokrywa opisanego zakresu',
  'Alokacja pre-seed: frontend 50 tys., backend 40 tys., UX 10 tys., prawne i API 10 tys.',
  'Za tę kwotę da się kupić około trzech miesięcy pracy dwóch programistów w stawkach kontraktowych. '
  'Opisany zakres to Flutter, FastAPI, mapowanie FHIR R4B, OCR i RAG z guardrails. '
  'Specyfikacja Master 5.4 wycenia to na **160–190 tys. PLN przy orkiestracji** i zaznacza, '
  'że wcześniejsze wyceny **całkowicie pomijały wynagrodzenia**.',
  'Albo zawęzić zakres pre-seed do agregacji i OCR bez RAG, albo podnieść kwotę do 160–190 tys. '
  'Obie opcje są uczciwe; obecna kombinacja kwoty i zakresu nie jest.'),
 ('SR', 'Gotowość post-quantum jest deklaracją bez pokrycia',
  'Slajd bezpieczeństwa deklaruje wdrożenie algorytmów odpornych na komputery kwantowe.',
  'Na etapie pre-seed, przy MVP za 110 tys. PLN, wdrożenie kryptografii postkwantowej jest '
  'nierealne i niesprawdzalne. Dla inwestora technicznego to sygnał ostrzegawczy: obietnica, '
  'której nie da się zweryfikować, obniża wiarygodność sąsiednich, prawdziwych deklaracji.',
  'Usunąć albo przeformułować na plan: „architektura kryptograficzna przygotowana na wymianę '
  'algorytmów, migracja po standaryzacji NIST”. To jest prawdziwe i obronne.'),
 ('NISK', 'Ryzyko licencyjne nie występuje w rejestrze ryzyk',
  'Rejestr ryzyk obejmuje regulacyjne, technologiczne i adopcję rynkową.',
  'Korpus identyfikuje **Gadgetbridge na AGPL-3.0** jako blokujący model komercyjny — fork '
  'nie zmienia licencji. Do tego OpenPose na licencji niekomercyjnej, Open Food Facts na ODbL '
  'ze share-alike i Unity jako najgorszy profil licencyjny w projekcie.',
  'Dodać czwarty wiersz do rejestru ryzyk i audyt licencji przed każdą integracją.'),
 ('NISK', 'Rozbieżność składu zespołu i siedziby między dokumentami',
  'Deck: Adrian Hołubcki jako CTO, siedziba w Warszawie. Plan operacyjny: Janek jako CTO, '
  'Adrian jako CTO Hardware, ośrodek w Poznaniu (PPNT, UMP, Politechnika Poznańska).',
  'Dwa dokumenty tej samej firmy podają inny skład zarządu i inne miasto. Przy due diligence '
  'to pytanie, na które trzeba odpowiedzieć od razu.',
  'Uzgodnić jedną wersję przed wysyłką. Jeśli oba są prawdziwe (np. siedziba formalna kontra '
  'ośrodek R&D), napisać to wprost.'),
]

ZRODLA = [
 ('Grand View Research — Digital Health Market Size & Share Report',
  'https://www.grandviewresearch.com/industry-analysis/digital-health-market',
  'Rynek zdrowia cyfrowego: 946,04 mld USD w 2030, CAGR 22,2% (2025–2030). '
  'Użyte do weryfikacji TAM i CAGR z decku.'),
 ('MarketsandMarkets — Digital Health Market Report 2025–2030',
  'https://www.marketsandmarkets.com/Market-Reports/digital-health-market-45458752.html',
  'Alternatywna prognoza: 199,14 mld USD w 2025 → 573,53 mld USD w 2030, CAGR 23,6%. '
  'Dolna granica przedziału dla weryfikacji TAM.'),
 ('BfArM — Digital Health Applications (DiGA)',
  'https://www.bfarm.de/EN/Medical-devices/Tasks/DiGA-and-DiPA/Digital-Health-Applications/_node.html',
  'Warunki wpisu do rejestru DiGA: oznakowanie CE, dowód pozytywnego efektu zdrowotnego, '
  'ocena w 3 miesiące, wpis warunkowy z badaniem w 1–2 lata.'),
 ('Precedence Research — Digital Health Market',
  'https://www.precedenceresearch.com/digital-health-market',
  'Prognoza długoterminowa do 2035 — kontekst dla poziomu 1,39 bln USD deklarowanego w decku.'),
]

# Rachunek policzony bezposrednio z liczb podanych w oficjalnym decku.
FINANSE = [
 ['Pozycja', '2027', '2028', '2029', '2030', '2031', 'Razem'],
 ['Przychody (mln PLN)', '0,085', '0,513', '1,97', '6,50', '18,50', '27,57'],
 ['EBITDA (mln PLN)', '−1,62', '−2,45', '−3,19', '−0,85', '+1,56', '−6,55'],
 ['Skumulowana strata do progu', '−1,62', '−4,07', '−7,26', '−8,11', '—', '−8,11'],
 ['Kapitał do rundy A (pre-seed + seed)', '0,11 + 6,0÷6,7', '', '', '', '', '6,11÷6,81'],
 ['LUKA FINANSOWANIA', 'runda A bez daty w decku', '', '', '', '', '1,30÷2,00'],
]

DOBRZE = [
 ['Element', 'Dlaczego się broni'],
 ['Strategia regulacyjna warstwowa',
  'Podział na warstwy A, B i C oraz świadome wyłączenie dziewięciu funkcji MDSW na podstawie '
  'MDCG 2019-11 to rozwiązanie poprawne i rzadko spotykane na tym etapie. Pozwala wejść na rynek '
  'bez certyfikacji, nie łamiąc prawa.'],
 ['Walidacja na linii zwierzęcej przed człowiekiem',
  'Ścieżka CVMP zamiast MDR skraca drogę o 5–10 lat i obniża ryzyko. W dokumentach jest traktowana '
  'jako etap obowiązkowy, nie opcja — słusznie.'],
 ['Architektura privacy-first',
  'Surowe dane pozostają na urządzeniu, do chmury trafia wynik. To realnie ogranicza ekspozycję '
  'pod RODO i jest spójne z pozycjonowaniem marki.'],
 ['Zasada wyłącznie odczytu dla implantów',
  'Brak zdalnego sterowania funkcjami ciała, wyłącznik sprzętowy po stronie użytkownika '
  'i możliwość usunięcia. To granica postawiona świadomie i konsekwentnie utrzymana '
  'w całej dokumentacji.'],
 ['Rejestr funkcji z historią deduplikacji',
  'Rejestr 309 funkcji dokumentuje własną korektę: z 21 usuniętych jako duplikaty dziesięć '
  'przywrócono, bo opisywały zastosowanie wobec mechanizmu. Taka jawność procesu jest rzadka '
  'i podnosi wiarygodność całości.'],
]

WAGI = {'KRYT': 'KRYTYCZNY', 'WYS': 'WYSOKI', 'SR': 'ŚREDNI', 'NISK': 'NISKI'}
KOLOR = {'KRYT': 'B8431F', 'WYS': 'B07419', 'SR': '1B3A6B', 'NISK': '5D6B8A'}
OPIS_WAGI = {
 'KRYT': 'blokują rozmowę z inwestorem',
 'WYS': 'ryzyko prawne lub utrata wiarygodności',
 'SR': 'sprzeczności między dokumentami',
 'NISK': 'braki do uzupełnienia',
}
