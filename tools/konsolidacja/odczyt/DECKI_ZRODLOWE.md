# Decki źródłowe — układ, schemat, nazwy slajdów i zawartość

Odczyt z plików przesłanych przez użytkownika:

| Plik | Slajdów | Format | Kształtów |
|---|---|---|---|
| `Eternal_Life_Ecosystem_Pitch_deck_.pptx` | 32 | 13,33 × 7,5 cala (16:9) | 1 181 pól tekstowych, 736 autokształtów, 291 obrazów |
| `Mini_pitch_deck_nowy_.pptx` | 14 | 13,33 × 7,5 cala (16:9) | 435 pól tekstowych, 342 autokształty, 167 obrazów |

## Schemat konstrukcyjny (wspólny dla obu decków)

- **Brak układów slajdów.** Każdy slajd używa layoutu `DEFAULT`; cała kompozycja jest
  rysowana ręcznie polami tekstowymi i autokształtami. Nie ma wzorca slajdu, numeracji
  ani stopki generowanej systemowo.
- **Strefa górna (0–2,4 cala):** logo złożone z trzech osobnych pól tekstowych („E",
  „TERNAL", „LIFE"), nadtytuł wersalikami 10–15 pt, tytuł 22–36 pt, podtytuł 13–15 pt.
- **Strefa środkowa (2,4–6,6 cala):** karty w zaokrąglonych prostokątach, po trzy do
  sześciu w rzędzie; wewnątrz nagłówek karty 12–15 pt i opis 9–12 pt. Dane liczbowe
  podawane jako duże liczby 18–27 pt z podpisem 9 pt.
- **Strefa dolna:** pasek z adresem strony, e-mailem i telefonem. Brak wskazania źródeł
  danych — żaden slajd w obu deckach nie podaje, skąd pochodzi liczba.
- **Zero tabel natywnych** (`0` obiektów tabelowych w obu plikach) — wszystkie zestawienia
  są rysowane jako siatki pól tekstowych.

## Typografia i paleta

| Element | Deck ekosystemu | Mini deck |
|---|---|---|
| Kroje | Arial (704 wystąpienia), Montserrat (283), Roboto (190) | Roboto (402), Montserrat (20), Arial (15) |
| Stopnie pisma | 36 / 27 / 22 / 18 / 15 / 13 / 12 / 10 / 9 / 8 pt | jak wyżej |
| Szarości | `1F2937`, `374151`, `4B5563`, `6B7280`, `9CA3AF`, `F3F4F6`, `F9FAFB` | te same |
| Akcenty | `1E40AF`, `2563EB`, `003366` | `1E3A8A`, `2563EB`, `EFF6FF`, `DBEAFE` |

Paleta jest domyślnym zestawem szarości i błękitów Tailwind, nie kolorystyką marki.
Logo Eternal Life używa rdzy `#A1370E` i granatu `#003071` — żaden z tych kolorów nie
występuje w deckach źródłowych.

## Deck ekosystemu — 32 slajdy

| # | Nadtytuł | Tytuł | Co jest na slajdzie |
|---|---|---|---|
| 1 | Pre-Seed · Faza Koncepcyjna | Rewolucja w Prewencji Zdrowotnej | „Pierwszy na świecie zintegrowany Health OS"; trzy filary: aplikacja, diagnostyka domowa, nanotechnologia; CEO |
| 2 | Problem | Współczesna medycyna jest fragmentaryczna i opóźniona | cytat o systemie leczącym zamiast utrzymującym zdrowie; rosnące obciążenie chorobami |
| 3 | OBECNE WYZWANIA | Problem II — bariera „ostatniej mili" | martwe dane, brak kontekstu klinicznego, brak standardu FHIR |
| 4 | — | Rozwiązanie: Eternal Core Intelligence | trzy filary: import uniwersalny (Google Document AI), synchronizacja (Terra API), logika medyczna |
| 5 | ETAP PRE-SEED | Propozycja wartości — od monitoringu do predykcji | kompleksowość, personalizacja, predykcja |
| 6 | — | Analiza rynku i segmentacja | globalny potencjał rynku; sześć segmentów: biohackerzy, opiekunowie, przewlekli, kliniki, ubezpieczyciele, pracodawcy |
| 7 | MARKET ANALYSIS | Trendy rynkowe napędzające adopcję | cztery siły; telemedycyna; CAGR 18,9% |
| 8 | Produkt i Technologia | Ekosystem produktowy — 4 fazy do Health OS | Lite App → Premium → Station → Nanotech |
| 9 | — | Eternal Lite App | subskrypcja 29,99 PLN/mies lub 299 PLN/rok; COGS 15%; marża >85% |
| 10 | — | Eternal App Premium | silnik Bio-Physics, triaż AI, stos: GCP, LiveKit/Twilio, Stripe |
| 11 | — | Eternal Station (domowe laboratorium) | NXP i.MX 8M Plus, EKG/SpO2/temperatura/ciśnienie, Wi-Fi 6 / 5G; marża ~65% |
| 12 | — | Eternal Station: koszty i fazy rozwoju | ESP32-S3, AD8232, COGS ~25 tys. PLN, CAPEX 200 tys., R&D 4 mln, oprzyrządowanie 1,5–2 mln |
| 13 | — | Nanotech i implanty (przyszłość) | Bio-Tag NFC 499 PLN, koszt <250, marża >50%; CGM glukoza i kortyzol |
| 14 | — | Architektura techniczna | INGESTION → STRUCTURING → INTELLIGENCE → PRESENTATION; GCP, Python/Node, Pub/Sub |
| 15 | Technologia | Bezpieczeństwo i zaufanie | AES-256, TLS 1.3, „technologia blockchain", standard militarny |
| 16 | — | Roadmapa strategiczna 2026–2030+ | Q3 2026 Lite App, Q4 500 testerów, 50 tys. użytkowników, prototyp Station |
| 17 | WIZJA DŁUGOTERMINOWA | Roadmapa 2030+: globalna ekspansja | dominacja w UE, >10 tys. stacji rocznie, partnerstwa z ubezpieczycielami, wejście do USA |
| 18 | — | Model biznesowy — monetyzacja wielofilarowa | B2C SaaS freemium, B2B, ARR |
| 19 | MODEL BIZNESOWY | Strumienie przychodów i cennik | Premium 49,99 PLN (marża >90%), Station ~1000 PLN (marża ~30%), wkłady 149 PLN, Bio-Tag 499 PLN |
| 20 | MODEL BIZNESOWY | Strategia go-to-market | faza 1 Polska, faza 2 Niemcy/Austria/UK, omnichannel |
| 21 | — | Krajobraz konkurencyjny | 1upHealth, Redox, Human API — luka: brak interfejsu pacjenta, tylko middleware |
| 22 | STRATEGIA | Przewagi konkurencyjne | software + hardware + wetware; measure → diagnose → treat |
| 23 | — | Pozycjonowanie rynkowe: strategia blue ocean | zintegrowany, proaktywny, Health OS jako nowa kategoria |
| 24 | — | Zespół założycielski | CEO, CTO, CMO, CAO z zakresami odpowiedzialności |
| 25 | — | Model operacyjny i outsourcing | lean startup, software house, OEM Shenzhen Pisofter / Comen, white-label |
| 26 | FAZA PRE-SEED | Prognozy finansowe — podsumowanie pięcioletnie | 2027: 85 tys. / −1,62 mln … 2031: 18,50 mln / +1,56 mln |
| 27 | — | Struktura finansowania | Pre-Seed 110 tys. PLN za 5–8%; Seed 6,0–6,7 mln za 12–15%; runway 18–24 mies. |
| 28 | — | Alokacja budżetu Seed | dev 40%, marketing 25%, hardware 15–20%, zespół 10–15%, ops/legal 10–15% |
| 29 | STRATEGIA FINANSOWA | Alokacja kapitału i roadmapa | cztery fazy inwestycyjne, cel 110 tys. PLN w fazie 01 |
| 30 | OCENA RYZYKA | Analiza ryzyk i strategia mitygacji | ryzyko regulacyjne, technologiczne, rynkowe |
| 31 | GTM | Grupy docelowe i strategia ekspansji | biohackerzy 200 tys./2 mln, CAC 80 PLN, LTV 1200 PLN, ROI 15× |
| 32 | — | Skontaktuj się z nami | dane kontaktowe, partnerstwa i inwestycje |

## Mini deck — 14 slajdów

| # | Nadtytuł | Tytuł | Co jest na slajdzie |
|---|---|---|---|
| 1 | ETERNAL LIFE SYSTEMS | Uniwersalny System Operacyjny Danych Zdrowotnych | start operacyjny Q2 2026; model: pure SaaS / agregacja danych; natywny FHIR |
| 2 | OBECNE WYZWANIA | Bariera „ostatniej mili" w analizie zdrowia | ~80% historii medycznej w PDF-ach; brak kontekstu klinicznego; silosy 3+ aplikacji |
| 3 | NASZE ROZWIĄZANIE | Eternal Core Intelligence | filar 1 import (Google Document AI), filar 2 wearables (Terra API), filar 3 logika medyczna |
| 4 | ARCHITEKTURA | Architektura techniczna: pipeline danych | ingestion → strukturyzacja (NLP, SNOMED CT, LOINC, FHIR) → inteligencja (Med-PaLM 2) |
| 5 | CORE INTELLIGENCE | Kluczowe funkcjonalności | silnik bio-korelacji, Google Document AI, medyczny RAG, poziomy ostrzeżeń |
| 6 | RYNEK I SEGMENTY | Grupy docelowe | TAM 175 mld USD, CAGR +27%; biohackerzy, metaboliczni, managerowie; wykluczenie seniorów |
| 7 | CASE STUDY | Podróż użytkownika: Piotr | 38 lat, manager IT; sen 8 h 15 min, energia 4/10; korelacja z glukozą 105 mg/dl |
| 8 | MONETYZACJA | Model biznesowy | plan darmowy „na zawsze", Premium, licencja na zanonimizowane zbiory, token API |
| 9 | OKAZJA RYNKOWA | Rynek i dlaczego teraz? | rynek 175 mld USD, boom na wearables, rewolucja LLM |
| 10 | KRAJOBRAZ RYNKU | Konkurencja | Apple Health, aplikacje laboratoryjne — porównanie po ośmiu kryteriach |
| 11 | ETAP PRE-SEED | Traction i roadmapa (start 2026) | rozwój, faza beta 500 osób, publiczny launch, monetyzacja |
| 12 | STRUKTURA ORGANIZACYJNA | Kluczowy zespół i partnerzy strategiczni | CEO, partner technologiczny (Flutter + Cloud), konsultant medyczny |
| 13 | BUDŻET I EKONOMIA | Finanse (budżet MVP) | 110 000 PLN: frontend 50 tys. (45%), backend 40 tys. (36%), UX 10 tys., infra 5 tys.; koszt/user ~4 PLN, przychód 39 PLN, marża 89% |
| 14 | — | Kontakt | „Eternal — porządek w danych. Inteligencja w zdrowiu." |

## Pozycje z decków źródłowych sprostowane w wersjach nowych

| Slajd źródłowy | Zapis źródłowy | Zapis obowiązujący po odczycie korpusu |
|---|---|---|
| 9, 19 (eko), 8 (mini) | subskrypcja 29,99 / 49,99 PLN | aplikacja pacjenta darmowa w całości; przychód z kanałów instytucjonalnych |
| 6, 9 (mini) | TAM 175 mld USD, CAGR 27% | globalnych liczb rynku nie podajemy przy strategii ograniczonej do Polski |
| 31 (eko) | CAC 80 PLN, LTV 1200 PLN, ROI 15× | CAC 250–600 PLN w B2C, 2–10 tys. w B2B; LTV do przeliczenia od zera |
| 26 (eko) | prognoza pięcioletnia do 18,5 mln PLN | prognoza wycofana do czasu pierwszych sześciu miesięcy sprzedaży |
| 27 (eko), 13 (mini) | budżet MVP 110 tys. PLN | 160–190 tys. przy orkiestracji; ~200 tys. domyka strukturę i pierwszy przychód |
| 15 (eko) | „technologia blockchain" jako gwarancja integralności | dziennik audytowy w bazie danych; blockchain bez uzasadnienia kosztowego |
| 13 (eko) | implanty jako produkt w roadmapie | wyłącznie ścieżka certyfikacyjna; tor weterynaryjny jako pierwszy |
| wszystkie | brak wskazania źródła danych | każdy slajd merytoryczny ma blok ŹRÓDŁA |
