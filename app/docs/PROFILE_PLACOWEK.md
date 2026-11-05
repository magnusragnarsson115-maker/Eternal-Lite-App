# Profile placówek — Eternal pod rodzaj kliniki

Profil dopasowuje Eternal do rodzaju placówki: moduły, usługi, wymagane dokumenty, szablony notatek, wywiady
i funkcje właściwe dla danego typu (np. deklaracje POZ, karta zabiegu). Wybiera go administrator
(**Administracja → Profil placówki**). Placówka może mieć kilka profili naraz.

Zasady:

- **Zastosowanie tylko dodaje** — usługi, dokumenty, szablony, specjalizacje i moduły. Niczego nie usuwa ani nie nadpisuje;
  ponowne zastosowanie uzupełnia tylko brakujące elementy (`S/services/clinicProfile.ts`).
- **Wyłączenie profilu** chowa funkcje profilu (menu, trasy API zwracają `profile_feature_off`), dane zostają.
- **Każdy profil pokazuje braki** — czego Eternal jeszcze nie robi albo co wymaga certyfikacji zewnętrznej. Placówka widzi
  to przed wyborem.
- Definicje: `S/content/clinicProfiles.ts`; stan prawny opisów — **listopad 2026** (źródła na końcu).

## Profile

| Profil | Funkcje profilu | Co dostaje placówka | Braki (świadomie widoczne) |
|---|---|---|---|
| **POZ (NFZ)** | `poz` | deklaracje lekarza, pielęgniarki i położnej (papier/IKP, zastępowanie, lista aktywna); opieka koordynowana z IPOM (koordynator, pozycje z terminami, zaległości, limity placówki); bilans „Moje Zdrowie”; szablon „Porada kompleksowa”; usługi POZ (porada, teleporada, wizyta domowa, pielęgniarka, porada kompleksowa, edukacyjna, dietetyczna, bilanse, szczepienie, pobranie) | e-recepta, e-skierowanie, EDM (P1 — certyfikacja CeZ); e-ZLA (ZUS); eWUŚ i rozliczenia NFZ; zgłaszanie deklaracji do NFZ; kalendarz PSO na dany rok |
| **Medycyna estetyczna** | `aesthetic` | produkty i partie (data ważności, UDI, „kto dostał partię”); karta zabiegu (cel i wskazanie, produkt, seria, ilość, mapa iniekcji, zgoda, zdjęcia przed/po, zalecenia, kontrola, kolejny termin, VAT z celu); wzory zgód do zatwierdzenia przez lekarza; zgoda na zdjęcia (dokumentacja / materiały placówki); powikłania z danymi do zgłoszenia; wywiad kwalifikacyjny; wymóg lekarza dla zabiegów inwazyjnych | płatności i zadatki online; sprzedaż kosmetyków i karty podarunkowe; galeria „przed i po” (celowo nie budujemy); automatyczna ocena zdjęć (wyrób medyczny) |
| **Poradnia specjalistyczna (AOS)** | — | usługi konsultacji, skierowanie jako dokument, pakiety specjalizacji, raport faktów | e-skierowanie z P1, lista oczekujących NFZ |
| **Fizjoterapia i rehabilitacja** | — | plan ćwiczeń z kontrolą wykonania, dziennik bólu, teleporada | rozliczanie cykli NFZ, grafik sal i urządzeń |
| **Zdrowie psychiczne** | — | wywiad psychiatryczny bez punktacji, numery pomocy, dzienniki | notatki z psychoterapii z węższym dostępem (do czasu wdrożenia — bez nagrywania sesji) |
| **Stomatologia (częściowy)** | — | usługi, RTG jako dokument, zdjęcia, przypomnienia | diagram zębów (odontogram), plan leczenia z kosztorysem, RVG/DICOM, limity NFZ |
| **Medycyna pracy (częściowy)** | — | usługi badań, skierowanie od pracodawcy jako wymagany dokument | orzeczenia z datą ważności, umowy z pracodawcami, portal pracodawcy |

## POZ — szczegóły

- **Deklaracje** (`S/services/poz.ts`): złożona → przyjęta / odrzucona (z powodem widocznym dla pacjenta) / wycofana.
  Przyjęcie nowej deklaracji tego samego rodzaju w placówce zmienia poprzednią na „zastąpiona”. Jeśli zawód osoby
  w profilu personelu jest uzupełniony, musi odpowiadać rodzajowi deklaracji. Pacjent widzi deklaracje w „Moja POZ”
  z informacją o IKP i bezpłatnych zmianach.
- **IPOM**: zakłada lekarz (zawód „lekarz” albo nieuzupełniony; inny zawód — odmowa). Jeden aktywny plan pacjenta w placówce;
  nowy plan zamyka poprzedni. Koordynatorem może być dowolny członek personelu placówki. Limity porad (np. edukacyjnych,
  dietetycznych) wpisuje administrator według aktualnego zarządzenia Prezesa NFZ — aplikacja liczy wykorzystanie,
  nie decyduje o kwalifikacji. Pacjent widzi plan bez notatek zespołu; dzień przed terminem i w dniu terminu dostaje
  przypomnienie z ogólną treścią poza aplikacją.
- **Bilans „Moje Zdrowie”**: 20–49 lat co 5 lat, od 50 lat co 3 lata, wiek liczony rocznikowo; ankieta w IKP albo w przychodni.
  Lista obejmuje pacjentów z przyjętą deklaracją do lekarza POZ. Wynik jest **orientacyjny** — uprawnienie potwierdza IKP,
  badania dobiera ankieta programu i lekarz.

## Medycyna estetyczna — szczegóły

- **Kto wykonuje**: usługa „wykonuje lekarz” albo produkt z wymogiem lekarza → kartę podpisze wyłącznie osoba z zawodem
  „lekarz” lub „lekarz dentysta” w profilu personelu (`physician_required`, `profession_missing`). Podstawa: komunikat MZ
  z 23.01.2026 (procedury estetyczno-naprawcze jako świadczenia zdrowotne o podwyższonym ryzyku, wykonywane przez lekarzy
  i lekarzy dentystów). Status prawny komunikatu jest sporny, ustawy brak — placówka może zmienić ustawienia usług.
- **Zgoda pisemna**: zabieg o podwyższonym ryzyku wymaga zgody w formie pisemnej (podpis odręczny albo kwalifikowany
  podpis elektroniczny). Problem: kliknięcie w aplikacji nie spełnia formy pisemnej. Rozwiązanie w Eternal: wzór do
  wydruku (`/api/staff/aesthetic/consents/:id/print`), podpis w gabinecie, skan w dokumentacji; pacjent może przeczytać
  treść wcześniej w aplikacji („przeczytano” — informacyjnie). Karta z lekiem lub wyrobem medycznym nie zostanie podpisana
  bez podpisanej zgody (`procedure_consent_required`).
- **Wzory zgód i zalecenia** (`S/content/aestheticConsents.ts`): projekty ogólne; lekarz placówki zatwierdza każdy wzór
  imieniem, nazwiskiem i numerem PWZ; zatwierdzenie jest związane z wersją i skrótem treści.
- **Partie**: partia po dacie ważności nie trafi do podpisanej karty (`lot_expired`); „Kto dostał” zwraca listę pacjentów
  z kontaktem (odczyt w dzienniku dostępu) — na wypadek komunikatu bezpieczeństwa producenta lub URPL.
- **Zdjęcia**: tylko za zgodą na dokumentację fotograficzną; są dokumentem medycznym; aplikacja ich nie analizuje.
  Zgoda na wykorzystanie zdjęć w materiałach placówki jest osobna, domyślnie wyłączona, zmienia ją pacjent w aplikacji
  i nie uruchamia żadnej publikacji.
- **VAT**: stawka na karcie wynika z celu zapisanego przez lekarza: cel leczniczy ze wskazaniem → zwolnienie
  (art. 43 ust. 1 pkt 18 ustawy o VAT) do potwierdzenia przez księgowość; cel estetyczny → stawka z usługi (co do zasady 23%).
- **Powikłania**: nasilenie wpisuje lekarz; „Dane do zgłoszenia” zawierają inicjały, rok urodzenia, produkt, serię,
  datę ważności, UDI i opis zdarzenia — decyzję o zgłoszeniu (URPL / wytwórca) podejmuje lekarz.

## Dane pokazowe

- Centrum Medyczne Eternal ma profil POZ: deklaracje (przyjęte i do przyjęcia), IPOM Anny Kowalskiej z koordynatorem
  i zaległą pozycją, bilans pana Wiśniewskiego.
- Klinika Medycyny Estetycznej Aurora (druga placówka, fikcyjna): lek. Joanna Malinowska (`joanna.malinowska@eternal.local`),
  kosmetolożka bez konta, pacjentka Karolina Wiśniewska (`karolina@eternal.local`), trzy produkty o fikcyjnych nazwach,
  partie (w tym po terminie i z krótką datą), zatwierdzone wzory zgód, dwie podpisane karty zabiegów ze zdjęciami
  poglądowymi (rysunki), szkic trzeciej, powikłanie, wizyta kontrolna na jutro. Hasło i TOTP jak dla pozostałych kont.

## Źródła (sprawdzone 2026-11)

- NFZ — opieka koordynowana w POZ: https://www.nfz.gov.pl/dla-pacjenta/informacje-o-swiadczeniach/podstawowa-opieka-zdrowotna/opieka-koordynowana-w-poz/
- NFZ — finansowanie koordynatora (zarządzenie z 20.01.2026): https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/finansowanie-koordynatora-w-poz-zmiany-w-kierunku-lepszej-opieki-nad-pacjentami,8883.html
- gov.pl — program „Moje Zdrowie” (bilans zdrowia osoby dorosłej): https://www.gov.pl/web/zdrowie/bezplatne-programy-profilaktyczne
- pacjent.gov.pl — deklaracja wyboru POZ w IKP: https://pacjent.gov.pl/print/pdf/node/2303
- Komunikat MZ z 23.01.2026 o medycynie estetyczno-naprawczej (omówienie): https://www.prawo.pl/zdrowie/prawo-do-wykonywania-zabiegow-medycyny-estetycznej,519103.html
- VAT w medycynie estetycznej (cel zabiegu): https://www.prawo.pl/podatki/kiedy-uslugi-medycyny-estetycznej-sa-zwolnione-z-vat,531237.html
- Kodeks Etyki Lekarskiej — informacja o usługach od 2025 r. (omówienie): https://www.prawo.pl/zdrowie/zakaz-reklamy-lekarzy-kodeks-etyki-lekarskiej-zmiany,520259.html

Szczegóły zarządzeń NFZ (limity porad w opiece koordynowanej) i ostateczny status regulacji medycyny estetycznej trzeba
sprawdzić przed wdrożeniem — opisy w aplikacji są informacyjne, a ustawienia placówki można zmienić.
