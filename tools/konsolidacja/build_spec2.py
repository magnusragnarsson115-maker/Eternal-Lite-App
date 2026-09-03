# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from builder import build
NOTA=[
 "Dokument scala treść 82 plików korpusu przypisanych do sekcji SPECYFIKACJA. Nie jest streszczeniem: "
 "treść źródłowa jest przenoszona dosłownie, blok po bloku.",
 "Kanonem jest Specyfikacja Master 5.4 FINAL. Wersje 3.0 i 3.1 — Master i App — zostały przez nią "
 "zastąpione w całości i nie są powielane w treści; figurują w Aneksie A z adnotacją o zastąpieniu. "
 "Same te cztery pliki to 3,03 mln znaków, które nie trafiają do dokumentu, bo ich treść zawiera się w 5.4.",
 "Kontrola faktyczna: App Specyfikacja 5.4 FINAL wniosła 84 nowe bloki na 754 — 89% jej treści jest "
 "dosłownie zawarte w Master 5.4. To potwierdza, że Master 5.4 jest jedynym kanonem specyfikacji, "
 "a App 5.4 jej wycinkiem aplikacyjnym z niewielkim własnym uzupełnieniem.",
 "Deduplikacja: bloki dłuższe niż 40 znaków znormalizowanych są porównywane globalnie i przy powtórzeniu "
 "pomijane; plik, w którym powtórzenie wystąpiło, zachowuje wpis w Aneksie A. Bloki krótsze (etykiety pól "
 "kart funkcji, nagłówki tabel) są zachowywane, bo ich powtarzalność jest strukturalna. "
 "Z 34 800 bloków źródłowych pozostało 33 659.",
 "Kolejność pierwszeństwa: przy tej samej treści zachowywane jest wystąpienie z pliku o wyższym statusie "
 "(FINAL przed UNIKAT, UNIKAT przed SUROWIEC), dlatego brzmienie pochodzi z wersji najnowszej.",
 "Znaczniki luk pozostawione w treści źródłowej (np. [BRAK]) nie są usuwane — luka widoczna jest tańsza "
 "niż luka zamaskowana.",
 "CZĘŚĆ 0C powstała inaczej niż reszta dokumentu. Nie jest przeniesieniem bloków, tylko wynikiem odczytu "
 "całej treści wszystkich 159 plików korpusu — 28 618 387 znaków surowo, 13 020 154 po usunięciu duplikatów "
 "i treści powtarzającej się jeden do jednego. Zawiera wyłącznie ustalenia, których nie ma w żadnym "
 "pojedynczym pliku: rozstrzygnięcia sprzeczności między wersjami, korekty do treści źródłowej oraz "
 "zestawienia powstałe z porównania wielu plików. Tam, gdzie część 0C prostuje treść źródłową, "
 "obowiązuje część 0C — ale brzmienie źródłowe pozostaje w częściach I–X i musi być czytane razem z korektą.",
 "Rozstrzygnięcie hierarchii wersji zostało zweryfikowane metrykami plików, nie deklaracjami w treści. "
 "Master 5.4 FINAL ma 1 072 132 znaki i datę 30.08.2026; Master 3.1 ma 13 706 znaków i jest skrótem, "
 "mimo że sam siebie opisuje jako aktualizację. Rejestr FINALNY 309 zastępuje rejestr scalony 299, "
 "ale nazwy osiemdziesięciu funkcji dodanych w wersji 265 występują wyłącznie w rejestrze 299 — "
 "dlatego oba pozostają w obiegu, każdy w swojej roli.",
]
WERSJE=[["Wersja","Plik","Znaków","Status"],
 ["Master 3.0","Eternal_Specyfikacja_Master_3.0_KOMPLETNA","744 973","zastąpiona przez 5.4"],
 ["Master 3.0 (PDF)","…_Master_3.0_KOMPLETNA.docx.pdf","756 326","duplikat 3.0 — różnica 6 słów na poziomie wyrazów"],
 ["Master 3.1 (skrót)","ETERNAL_Specyfikacja_Master_3_1","13 706","zastąpiona przez 5.4"],
 ["Master 3.1 KOMPLETNA","ETERNAL_Specyfikacja_Master_3_1_KOMPLETNA","922 034","zastąpiona przez 5.4"],
 ["Master 5.4 FINAL","ETERNAL_Specyfikacja_Master_5_4_FINAL","1 072 132","KANON"],
 ["App funkcjonalna","ETERNAL_App_Specyfikacja_Funkcjonalna","24 282","zastąpiona przez App 5.4"],
 ["App 3.1","ETERNAL_App_Specyfikacja_3_1","602 569","zastąpiona przez App 5.4"],
 ["App 5.4 FINAL","ETERNAL_App_Specyfikacja_5_4_FINAL","752 667","kanon aplikacji; 89% zawarte w Master 5.4"],
 ["Rejestr 299","Eternal_Rejestr_scalony_299","15 205","zastąpiony przez Rejestr FINALNY 309"],
 ["Rejestr 309","Eternal_Rejestr_FINALNY_309","10 518","OBOWIĄZUJĄCY rejestr funkcji"]]
KANON=[
 (126,("CZĘŚĆ I — SPECYFIKACJA MASTER 5.4 (KANON)",
   "Treść przeniesiona dosłownie z ETERNAL_Specyfikacja_Master_5_4_FINAL.docx. "
   "Ta część ma pierwszeństwo przed wszystkimi pozostałymi w razie sprzeczności.")),
 (125,("CZĘŚĆ II — UZUPEŁNIENIA WŁASNE SPECYFIKACJI APLIKACJI 5.4",
   "Wyłącznie te bloki App Specyfikacji 5.4, których nie ma w Master 5.4.")),
]
KLASTRY=[
 ("CZĘŚĆ III — REJESTR FUNKCJI, MODUŁÓW I PRODUKTÓW",
  "Kanoniczne zestawienia funkcji ekosystemu i aplikacji oraz ich podział na moduły i produkty.",
  [32,105,61,78,91,99,56,75,35,64,50]),
 ("CZĘŚĆ IV — GRANICA REGULACYJNA, KLASYFIKACJA MDR I ZGODNOŚĆ",
  "Które funkcje są wyrobem medycznym, w jakiej klasie i co z tego wynika kosztowo i licencyjnie.",
  [92,97,88,98,25,28,127,103,17,118]),
 ("CZĘŚĆ V — ARCHITEKTURA, KOMPONENTY I STOS TECHNOLOGICZNY",
  "Warstwy, klasy komponentów K01–K28, moduły kontrolne K1–K14, orkiestracja, brama API, punkty wspólne.",
  [8,11,12,13,67,21,23,117,119,85,89,107,96,101,43,68,69,80,48,82]),
 ("CZĘŚĆ VI — DANE, INTEGRACJE I URZĄDZENIA",
  "Źródła danych, e-Profil Pacjenta i P1, agregacja z wearables, katalog urządzeń i dostawców.",
  [7,2,3,4,135,42,86,5]),
 ("CZĘŚĆ VII — WARSTWA WEWNĄTRZUSTROJOWA (CAPSULE / IMPLANTY)",
  "Bio-Tag, Bio-Monitor, The Hive, The Swarm — zakres, granice sterowania i wariant niskokosztowy. "
  "Obowiązuje zasada projektowa: wyłącznie odczyt, świadoma zgoda, wyłącznik sprzętowy, możliwość usunięcia.",
  [6,30,44,24]),
 ("CZĘŚĆ VIII — PRZEBIEGI UŻYTKOWNIKA, AUDYTY I WERYFIKACJA",
  "Ścieżki end-to-end, audyty pokrycia źródeł, weryfikacja odpowiedzi zewnętrznych, jawna lista luk.",
  [41,93,104,106,100,112,113,114,115,34,18]),
 ("CZĘŚĆ IX — MATERIAŁ ŹRÓDŁOWY: PYTANIA, ODPOWIEDZI, KONWERSACJE",
  "Treść nieskonsolidowana, o niższym statusie niż części I–VIII. Włączona dla kompletności; "
  "w razie sprzeczności z częścią I obowiązuje część I (Master 5.4).",
  [146,130,139,131,132,87]),
]
build('S', "SPECYFIKACJA FUNKCJONALNO-TECHNICZNA — DOKUMENT SCALONY",
      "Wszystkie aktualne ustalenia techniczne, funkcjonalne i regulacyjne",
      "Podstawa: Master 5.4 FINAL · App 5.4 FINAL · Rejestr FINALNY 309",
      NOTA, WERSJE, KANON, KLASTRY,
      "CZĘŚĆ X — POZOSTAŁE USTALENIA TECHNICZNE",
      '/home/user/Eternal-Lite-App/out/ETERNAL_SPECYFIKACJA_SCALONA.docx')
