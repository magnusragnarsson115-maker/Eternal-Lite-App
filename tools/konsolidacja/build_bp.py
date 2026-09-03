# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from builder import build

NOTA=[
 "Dokument scala treść 77 plików korpusu przypisanych do sekcji BIZNESPLAN. Nie jest streszczeniem: "
 "treść źródłowa jest przenoszona dosłownie, blok po bloku.",
 "Szkieletem obowiązującym jest Plan Korporacyjny 5.1 — najnowszy dokument biznesowy w korpusie "
 "(numeracja 5.x zgodna ze Specyfikacją Master 5.4). Biznesplan 4.0 został przez niego zastąpiony "
 "i nie jest powielany w treści.",
 "Rdzeniem narracyjnym jest Biznesplan rozszerzony (403 702 znaki) — najobszerniejszy dokument "
 "biznesowy korpusu, zawierający m.in. komplet 185 kart funkcji z polami Cel / Problem / "
 "Wartość dla klienta / Persona wiodąca / Perspektywa pacjenta / Perspektywa lekarza.",
 "Deduplikacja: bloki dłuższe niż 40 znaków znormalizowanych są porównywane globalnie i przy powtórzeniu "
 "pomijane. Bloki krótsze (etykiety pól, nagłówki kart) są zachowywane, ponieważ ich powtarzalność jest "
 "strukturalna — usunięcie ich rozbiłoby karty funkcji. Z 48 391 bloków źródłowych pozostało 45 549.",
 "OSTRZEŻENIE O ROZBIEŻNOŚCIACH. Część dokumentów w tej sekcji powstała przed Specyfikacją Master 5.4 "
 "i powiela liczby, które 5.4 skorygowała. Najważniejsze korekty: aplikacja pacjenta jest darmowa "
 "w całości (nie freemium 49 PLN/mies); koszt MVP przy orkiestracji to 160–190 tys. PLN, przy czym "
 "wynagrodzenia zostały w wcześniejszych wycenach całkowicie pominięte; certyfikat P1 jest bezpłatny; "
 "Terra API kosztuje od 399 USD/mies, nie 0,002 USD za synchronizację; RPWDL przypada na lata 2029–2030. "
 "W razie sprzeczności obowiązuje Master 5.4 i Plan Korporacyjny 5.1.",
 "Plan PWNŚ (plik #158) wnosi warstwę operacyjną: 188 punktów z przypisaniem narzędzi, czasu, "
 "odpowiedzialności, partnerów i kosztów w cenach rynkowych PL 2026, oraz imienny podział ról w zespole. "
 "Ten sam plik jest jednocześnie miejscem, w którym granica wykluczenia została zapisana najostrzej: "
 "punkty dotyczące przejmowania władzy, partii politycznej, masowej implantacji i nadzoru nad ludźmi "
 "NIE zostały zoperacjonalizowane, z uzasadnieniem „nie da się zbudować dla nich budżetu, listy "
 "partnerów i harmonogramu, bo to nie jest plan firmy”. Warstwa operacyjna, która z tego pliku wchodzi "
 "do dokumentu, jest w całości legalną częścią planu.",
 "CZĘŚĆ 0C powstała inaczej niż reszta dokumentu. Nie jest przeniesieniem bloków, tylko wynikiem odczytu "
 "całej treści wszystkich 159 plików korpusu — 28 618 387 znaków surowo, 13 020 154 po deduplikacji. "
 "Zawiera dwadzieścia dwie podsekcje z ustaleniami, których nie ma w żadnym pojedynczym pliku: "
 "rozstrzygnięcia sprzeczności między wersjami, korekty liczb oraz zestawienia powstałe z porównania "
 "wielu plików. Tam, gdzie część 0C prostuje treść źródłową, obowiązuje część 0C — brzmienie źródłowe "
 "pozostaje w częściach I–XIII i musi być czytane razem z korektą.",
 "Rozstrzygnięcie hierarchii zostało zweryfikowane metrykami plików, nie deklaracjami w treści. "
 "Biznesplan 4.0 nie znika z obiegu: zachowuje wartość jako gotowy układ prezentacji dla inwestora "
 "medtech i jako jedyne miejsce z pełnym wykazem podstaw prawnych — unijnych, krajowych i normatywnych. "
 "Plan Korporacyjny 5.1 jest natomiast szkieletem rozstrzygającym w razie sprzeczności.",
]
WERSJE=[["Dokument","Plik","Znaków","Status"],
 ["Biznesplan 4.0","ETERNAL_Biznesplan_4_0","29 836",
  "zastąpiony przez Plan Korporacyjny 5.1 jako szkielet; pozostaje układem inwestorskim i wykazem podstaw prawnych"],
 ["Plan Korporacyjny 5.1","ETERNAL_Plan_Korporacyjny_5_1","30 903","OBOWIĄZUJĄCY szkielet"],
 ["Biznesplan rozszerzony","eternal_ecosystem_biznesplan_rozszerzony.pdf","403 702","OBOWIĄZUJĄCY rdzeń narracyjny"],
 ["Podsumowanie wykonawcze","Podsumowanie wykonawcze","53 046","OBOWIĄZUJĄCE streszczenie"],
 ["Macierz 40 projektów v2","Eternal_Macierz_40_Projektow_v2_z_PDF","48 601","OBOWIĄZUJĄCA (zastępuje Macierz skondensowaną v3)"],
 ["IKP i P1 do 2030","Eternal_IKP_i_P1_do_2030","10 545","zastąpiony przez wersję do 2031"],
 ["Pięć odpowiedzi","Eternal_Piec_odpowiedzi","40 937","zastąpiony przez wersję poprawioną"],
 ["Pięć punktów v2","Eternal_Piec_punktow_v2","15 686","zastąpiony przez Pięć rozstrzygnięć"],
 ["Plan PWNŚ (warstwa operacyjna)","eternal_roadmap_checklist_v5_pelna_analiza_PWNS","2 880 533",
  "OBOWIĄZUJĄCA warstwa operacyjna i kalendarz bazowy"],
 ["DeepSeek 5d6d38","deepseek_html_20260705_5d6d38","64 117","POMINIĘTY — warstwa wyłączona"],
 ["DeepSeek 5f7054","deepseek_html_20260705_5f7054","79 721","POMINIĘTY — warstwa wyłączona"]]

KANON=[
 (123,("CZĘŚĆ I — PLAN KORPORACYJNY 5.1 (SZKIELET OBOWIĄZUJĄCY)",
   "Najnowszy dokument biznesowy korpusu. Ma pierwszeństwo przed pozostałymi częściami w razie sprzeczności.")),
 (145,("CZĘŚĆ II — BIZNESPLAN ROZSZERZONY (RDZEŃ NARRACYJNY)",
   "Najobszerniejszy dokument biznesowy korpusu wraz z kompletem 185 kart funkcji.")),
 (140,("CZĘŚĆ III — PODSUMOWANIE WYKONAWCZE",
   "Gotowe streszczenie zarządcze pięciu filarów ekosystemu wraz z tabelą porównawczą i ścieżką krytyczną.")),
]
KLASTRY=[
 ("CZĘŚĆ IV — PORTFEL PROJEKTÓW I MACIERZ 40",
  "Pełny portfel projektów, kryteria doboru, priorytetyzacja P1–P5 oraz etapowanie z wagami.",
  [128,57,59,49,40,60,20,124,71,73]),
 ("CZĘŚĆ V — MODEL BIZNESOWY, MONETYZACJA I PRZYCHODY",
  "Warstwy przychodu, cenniki, marketplace, Hub i Forge, warianty pivotu oraz relacja rentowność–własność.",
  [15,52,58,62,84,9,120,37,63,102,22,86]),
 ("CZĘŚĆ VI — KOSZTY, FINANSOWANIE I RENTOWNOŚĆ",
  "Widełki kosztowe, źródła finansowania, warianty wykonania i niezależna ocena wykonalności.",
  [94,46,44,66,121,14,16,118]),
 ("CZĘŚĆ VII — RYNEK, OTOCZENIE REGULACYJNE I KONKURENCJA",
  "Otoczenie e-zdrowia w Polsce, punkty styku z państwem, mapa konkurencji i pozycjonowanie.",
  [26,27,3,29,36,45,47,88,97,17,25,28]),
 ("CZĘŚĆ VIII — STRUKTURA PRAWNA, KORPORACYJNA I KONTROLA",
  "Fundacja, golden share, kaskada spółek, WBS holdingu oraz co musi pozostać własne.",
  [19,76,133,72,98,24]),
 ("CZĘŚĆ IX — ROZSTRZYGNIĘCIA STRATEGICZNE",
  "Kluczowe decyzje projektu w wersjach obowiązujących, weryfikacja hipotez i wyróżniki.",
  [77,79,70,74,31,34,106,100,112,82]),
 ("CZĘŚĆ X — WARSTWA OPERACYJNA: ETAP 2 I PLAN PWNŚ",
  "Pełne rozpisanie etapu budowy firmy oraz 188 punktów operacyjnych z kosztami PL 2026.",
  [144,158]),
 ("CZĘŚĆ XI — ANALIZY ZEWNĘTRZNE",
  "Materiał przygotowany przez inne systemy analityczne. Status niższy niż części I–X; "
  "włączony dla kompletności i porównania. Dwa pliki z tej grupy — DeepSeek 5d6d38 i 5f7054 — "
  "są w całości poświęcone warstwie wyłączonej i nie wchodzą do dokumentu; pozostaje po nich "
  "wpis w Aneksie A oraz nota na początku dokumentu.",
  [143,137]),
 ("CZĘŚĆ XII — MATERIAŁ ŹRÓDŁOWY: PYTANIA, ODPOWIEDZI, KONWERSACJE",
  "Treść nieskonsolidowana. W razie sprzeczności z częściami I–III obowiązują części I–III.",
  [146,130,139,131,132]),
]
build('B', "BIZNESPLAN — DOKUMENT SCALONY",
      "Wszystkie aktualne ustalenia biznesowe, finansowe i rynkowe",
      "Podstawa: Plan Korporacyjny 5.1 · Biznesplan rozszerzony · Podsumowanie wykonawcze",
      NOTA, WERSJE, KANON, KLASTRY,
      "CZĘŚĆ XIII — POZOSTAŁE USTALENIA BIZNESOWE",
      '/home/user/Eternal-Lite-App/out/ETERNAL_BIZNESPLAN_SCALONY.docx')
