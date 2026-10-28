# ZLECENIE REDAKCYJNE — EcoChallenge: Koncepcja produktu i MVP (System 2)

## Parametry
- Branża: Edukacja / EdTech (serious game, symulacja społeczno-gospodarcza), NGO. Medyczny bliźniak cyfrowy — jawnie wyłączony z zakresu.
- Etap: 3 (MVP) — specyfikacja MVP, architektura wstępna, plan pilotażu. Typ dokumentu budowany przez analogię (IT: specyfikacje/architektury; Biznes: roadmapa; AI: governance).
- Objętość: 10-15 stron. Język: polski. Data stanu: 2026-10-27. Plik wyjściowy: out/ecochallenge-koncepcja-mvp.md
- Notacja: ZAŁOŻENIE dla domysłów, [DO USTALENIA] dla luk, DO WERYFIKACJI dla twierdzeń prawnych opartych na źródłach wtórnych. Nie podawaj liczb bez źródła.

## Ustalenia z założycielem
- Podmiot: fundacja; działalność nieodpłatna. Brak budżetu gotówkowego — realizacja przez założyciela przy wsparciu narzędzi AI (koszty rynkowe/utrzymania tylko jako przedziały ZAŁOŻENIE).
- Poziomy gry: gmina → województwo → państwo. MVP/pilotaż zaczyna od gminy; gmina pilotażowa [DO USTALENIA] (opisz kryteria wyboru).
- Grupa docelowa: SP kl. VII-VIII i szkoły ponadpodstawowe (ok. 13-19 lat) ORAZ użytkownicy indywidualni poza szkołą (młodzież i dorośli grający samodzielnie). Nauczyciel = opiekun grupy, nie jedyny użytkownik.
- Scenariusze wojenne/geopolityczne z realnymi państwami (Rosja, USA-Iran) — kolejny etap, poza MVP; w MVP np. scenariusz szoku cen paliw bez nazwanego konfliktu zbrojnego.
- AI (LLM) generuje scenariusze i narrację wyłącznie na podstawie ogólnodostępnych, zweryfikowanych danych; nie liczy skutków, nie ocenia użytkownika. Dostawca LLM i hosting [DO USTALENIA].
- Idea: społeczeństwo jako „naczynia połączone” — każda decyzja ma skutki 2. i 3. rzędu (np. cło → wpływy budżetowe ↑, ceny importu ↑, siła nabywcza ↓). Kompromisy, nie jedyna słuszna odpowiedź. Inspiracje: Cywilizacja, Age of History, wargaming (J. Bartosiak, Strategy & Future) — bez zapożyczeń nazw/mechanik i bez sugerowania afiliacji.

## Architektura (rdzeń dokumentu)
1. Jawny, deterministyczny model przyczynowy — graf zależności z wersjonowanymi współczynnikami opartymi na danych GUS/BDL, budżetach gmin (BIP); karta modelu i danych; funkcja „dlaczego tak wyszło” (ścieżka przyczynowa).
2. Deterministyczna populacja agentowa NPC (dochód, zawód, dojazd, wiek) — przeliczana po każdej decyzji.
3. Warstwa LLM — tylko odczyt wyników; scenariusze i narracja (historie konkretnych NPC), bez wpływu na wyliczenia.

## Kontekst dydaktyczny (zweryfikowany 2026-10-27, źródła wtórne)
- Reforma26 „Kompas Jutra”: nowa podstawa SP (rozporządzenie z 11.03.2026) obowiązuje od 1.09.2026 tylko w kl. I i IV, kolejne klasy rocznikowo (kl. VII ok. 2029/30, kl. VIII ok. 2030/31; EDB kl. VIII od 1.09.2027 — DO WERYFIKACJI). Moduły interdyscyplinarne m.in. ekonomiczno-finansowy i klimatyczny. Szkoły ponadpodstawowe: nowa podstawa najwcześniej od 1.09.2027, treść nieopublikowana.
- Wniosek: MVP mapowane na obowiązującą podstawę (WOS/edukacja obywatelska, geografia, EDB, biznes i zarządzanie — status DO WERYFIKACJI); moduły Kompasu Jutra jako kierunek docelowy z datami. Tydzień projektowy — tryb i klasy DO WERYFIKACJI.

## Wymagania prawne i etyczne (werdykt eksperta: ZGODNE Z WARUNKAMI) — wpisz jako twarde wymogi
RODO: W-1 tryb bez konta domyślny w kanale indywidualnym; konta pseudonimowe bez e-maila. W-2 kanał szkolny: szkoła administratorem, fundacja podmiotem przetwarzającym (art. 28), konta zakłada nauczyciel. W-3 osoby <16 lat (próg PL wg art. 8 RODO): konto chmurowe tylko za zgodą rodzica lub zakładane przez rodzica. W-4 DPIA przed uruchomieniem. W-5 brak pól swobodnego tekstu do LLM w MVP (wybory zamknięte). W-6 LLM/hosting preferowany w EOG; przy transferze DPF/SCC+TIA, brak trenowania na danych, minimalna retencja. W-7 personalizacja tylko w obrębie sesji, bez trwałego profilu, domyślnie wyłączona. W-8 informacja o przetwarzaniu zrozumiała dla 13-latka; bez reklam, trackerów, cookies analitycznych bez zgody.
AI Act (2024/1689 zm. 2026/1744; obowiązki wysokiego ryzyka Zał. III od 2.12.2027; art. 50 od 2.08.2026 bez karencji dla nowych systemów; PL ustawa o systemach AI Dz.U. 2026 poz. 1003, organ KRiBSI, kary od 28.10.2026): W-9 system nie ocenia ucznia, nie wystawia/sugeruje ocen, nie steruje ścieżką nauki. W-10 zakaz rozpoznawania emocji, kamer, analizy sentymentu (art. 5 ust. 1 lit. f). W-11 bez dark patterns, mechanik kompulsywnych, loot boxów, manipulacji politycznej (art. 5 ust. 1 lit. a-b). W-12 oznaczenia art. 50: etykieta „wygenerowane przez AI”, znakowanie maszynowe, informacja o interakcji z AI. W-13 działania art. 4 (kompetencje AI) dla zespołu i materiał dla nauczycieli. W-14 rozważenie wniosku do KRiBSI o opinię indywidualną co do klasyfikacji. W-15 dokumentacja modelu deterministycznego jako jawnego, opartego na regułach.
Ochrona małoletnich: W-16 dobrowolne standardy ochrony małoletnich (ustawa z 13.05.2016, art. 22b-22c — zakres dla usług online DO WERYFIKACJI). W-17 weryfikacja z art. 21 (Rejestr Sprawców, KRK) osób z kontaktem z użytkownikami. W-18 wejście do szkół przez art. 86 Prawa oświatowego (zgoda dyrektora, rada szkoły, opinia rady rodziców).
DSA: W-19 w MVP brak czatu, wiadomości prywatnych, publicznych profili, publicznych rankingów, udostępniania poza klasą; zmiana = ponowna ocena DSA/RODO/ochrony małoletnich. W-20 obowiązki hostingu: punkt kontaktowy, regulamin zrozumiały dla dzieci, mechanizm zgłoszeń.
Neutralność: W-21 wyłącznie fikcyjni politycy i partie, filtr wyjścia LLM. W-22 brak agitacji (Kodeks wyborczy — zakaz agitacji w szkołach, DO WERYFIKACJI numer artykułu), dostosowanie treści w kampaniach. W-23 jawne założenia modelu, źródła GUS/BDL z datą, procedura zgłaszania stronniczości. W-24 scenariusze wojenne/realne państwa poza MVP, włączenie wymaga odrębnej kontroli prawnej.
Inne: WCAG 2.1 AA jako dobra praktyka; CRA nie dotyczy aplikacji webowej SaaS niekomercyjnej (ponowna ocena przy aplikacji mobilnej); ustawa o otwartych danych dla GUS/BDL.
ZAKAZANE WARIANTY (nie mogą się pojawić): konto <16 lat na zgodzie samego dziecka; rozpoznawanie emocji; realni politycy/partie w treściach; ocena ucznia przez LLM z profilowaniem.

## Struktura (16 sekcji)
1. Cel (problem edukacyjny, cele dydaktyczne, cele MVP)
2. Zakres (MVP: gmina, prawdziwe dane, tryb klasowy i indywidualny; poza MVP: województwo, państwo, scenariusze geopolityczne; wyłączenia)
3. Definicje
4. Interesariusze (uczniowie, gracze indywidualni, nauczyciele-opiekunowie, dyrektor i rada rodziców, rodzice, gmina pilotażowa, fundacja, GUS/BDL, dostawca LLM, partnerzy merytoryczni)
5. Założenia (z oznaczeniami ZAŁOŻENIE)
6. Wymagania: 6.1 funkcjonalne MVP (decyzje: budżet, energia, transport, podatki lokalne; wskaźniki ekonomiczne/społeczne/ekologiczne; tryb drużynowy i indywidualny; panel opiekuna; omówienie); 6.2 architektura trzech warstw; 6.3 przejrzystość modelu; 6.4 pedagogiczne (mapowanie na podstawę); 6.5 prawne i etyczne (W-1…W-24); 6.6 niefunkcjonalne (WCAG, słabe łącze, bezpieczeństwo)
7. Proces (przebieg lekcji/tygodnia projektowego; sesja indywidualna; proces budowy MVP: dane → model → kalibracja → NPC → narracja → test)
8. Diagram logiczny (tekstowy): decyzja → graf → wskaźniki → NPC → sprzężenie → narracja LLM (odczyt) → omówienie; przykładowy łańcuch szoku cen paliw
9. Ryzyka (merytoryczne, pedagogiczne, polityczne/reputacyjne, prawne — w tym punkty do przeglądu prawnika, techniczne, organizacyjne)
10. KPI (dydaktyczne pre/post, produktowe, kalibracja modelu) — bez oceniania przez AI
11. Harmonogram (PoC modelu → MVP → pilotaż; rok szkolny 2026/27-2027/28; daty jako ZAŁOŻENIE)
12. Koszty (przedziały ZAŁOŻENIE; model zerobudżetowy; finansowanie [DO USTALENIA])
13. Zależności
14. Produkty końcowe
15. Check-lista gotowości do pilotażu
16. Podstawy prawne i bibliografia
