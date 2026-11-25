import type { RequiredDocument } from '../settings.js';

/**
 * Profile placówek (produkt pod rodzaj kliniki): co dany typ placówki realnie potrzebuje i gdzie to jest w Eternal.
 *
 * Profil ustawia moduły, usługi, wymagane dokumenty, szablony notatek i wywiady; włącza też funkcje profilu
 * (np. deklaracje POZ, karta zabiegu). Zastosowanie profilu tylko DODAJE — nie usuwa usług ani ustawień placówki.
 * Placówka może mieć kilka profili naraz (np. POZ z poradnią specjalistyczną albo przychodnia z gabinetem estetycznym).
 *
 * Lista „braki” jest częścią profilu celowo: placówka widzi przed wyborem, czego Eternal jeszcze nie robi
 * (np. e-recepta wymaga certyfikacji w Centrum e-Zdrowia), zamiast odkryć to po wdrożeniu.
 * Stan prawny opisów: zweryfikowano 2026-11 (źródła w docs/PROFILE_PLACOWEK.md).
 */

export type ProfileFeature = 'poz' | 'aesthetic';
export type Profession = 'lekarz' | 'lekarz-dentysta' | 'pielegniarka' | 'polozna' | 'fizjoterapeuta' | 'psycholog' | 'dietetyk' | 'kosmetolog' | 'inny';
export const PROFESSIONS: Profession[] = ['lekarz', 'lekarz-dentysta', 'pielegniarka', 'polozna', 'fizjoterapeuta', 'psycholog', 'dietetyk', 'kosmetolog', 'inny'];
export const PHYSICIAN_PROFESSIONS: Profession[] = ['lekarz', 'lekarz-dentysta'];

export type Vat = 'zw' | '8' | '23';

export interface ProfileService {
  key: string;
  name: string;
  durationMinutes: number;
  mode: 'in-person' | 'tele';
  specialty: string;
  program?: string;
  description?: string;
  /** Stawka VAT dla celu estetycznego (cel leczniczy z udokumentowanym wskazaniem — zwolnienie; decyduje księgowość). */
  vat?: Vat;
  /** Zabieg wykonuje lekarz albo lekarz dentysta (komunikat MZ z 23.01.2026: procedury estetyczno-naprawcze). */
  requiresPhysician?: boolean;
  /** Zgoda pisemna według wzoru (identyfikator wzoru zgody). */
  consentTemplate?: string;
  /** Wizyta kontrolna po N dniach (ustawia placówka; przypomnienie ogólne dla pacjenta). */
  controlAfterDays?: number;
  purposeDefault?: 'estetyczny' | 'leczniczy';
}

export interface ClinicProfile {
  id: 'poz' | 'estetyka' | 'aos' | 'rehabilitacja' | 'zdrowie-psychiczne' | 'stomatologia' | 'medycyna-pracy';
  version: string;
  name: string;
  forWhom: string;
  features: ProfileFeature[];
  /** Moduły kliniki włączane przez profil (przełączniki organizacji). */
  modulesOn: string[];
  noteTemplates: string[];
  specialties: string[];
  requiredDocuments: RequiredDocument[];
  services: ProfileService[];
  /** Wywiady przed wizytą polecane dla profilu (drzewa zatwierdzane przez lekarza). */
  interviews: string[];
  /** Co placówka tego typu realnie potrzebuje → gdzie to jest w Eternal. */
  needs: { need: string; where: string }[];
  /** Czego Eternal (jeszcze) nie robi albo co wymaga zewnętrznej certyfikacji. */
  gaps: { gap: string; why: string }[];
  /** Najważniejsze zasady prawne, które profil uwzględnia. */
  legal: string[];
}

const doc = (id: string, label: string, accept: RequiredDocument['accept'], extra: Partial<RequiredDocument> = {}): RequiredDocument => ({ id, label, accept, ...extra });

export const CLINIC_PROFILES: ClinicProfile[] = [
  {
    id: 'poz',
    version: 'profil-poz/2026-11-1',
    name: 'Podstawowa opieka zdrowotna (POZ, NFZ)',
    forWhom: 'Przychodnie POZ z umową z NFZ: lekarz rodzinny, pielęgniarka i położna POZ, opieka koordynowana.',
    features: ['poz'],
    modulesOn: ['workspace', 'medical-snapshot', 'inbox', 'facts', 'scribe', 'diagnoses', 'video', 'invite'],
    noteTemplates: ['general', 'koz', 'pediatrics'],
    specialties: ['interna', 'pediatria'],
    requiredDocuments: [
      doc('poz-lab', 'Wyniki badań laboratoryjnych (ostatnie 6 miesięcy)', ['lab'], { maxAgeDays: 180, optional: true }),
      doc('poz-discharge', 'Karta informacyjna ze szpitala lub opis leczenia specjalistycznego', ['discharge', 'other'], { optional: true }),
    ],
    services: [
      { key: 'poz-porada', name: 'Porada lekarza POZ', durationMinutes: 15, mode: 'in-person', specialty: 'interna', program: 'NFZ — POZ' },
      { key: 'poz-teleporada', name: 'Teleporada lekarza POZ', durationMinutes: 10, mode: 'tele', specialty: 'interna', program: 'NFZ — POZ', description: 'Pacjent może zawsze poprosić o wizytę w gabinecie.' },
      { key: 'poz-domowa', name: 'Wizyta domowa lekarza POZ', durationMinutes: 30, mode: 'in-person', specialty: 'interna', program: 'NFZ — POZ' },
      { key: 'poz-pielegniarka', name: 'Porada pielęgniarki POZ', durationMinutes: 15, mode: 'in-person', specialty: 'pielęgniarstwo', program: 'NFZ — POZ' },
      { key: 'poz-kompleksowa', name: 'Porada kompleksowa (opieka koordynowana)', durationMinutes: 30, mode: 'in-person', specialty: 'interna', program: 'NFZ — opieka koordynowana', description: 'Bilans choroby przewlekłej i Indywidualny Plan Opieki Medycznej (IPOM).' },
      { key: 'poz-edukacja', name: 'Porada edukacyjna', durationMinutes: 30, mode: 'in-person', specialty: 'pielęgniarstwo', program: 'NFZ — opieka koordynowana' },
      { key: 'poz-dietetyk', name: 'Porada dietetyczna', durationMinutes: 30, mode: 'in-person', specialty: 'dietetyka', program: 'NFZ — opieka koordynowana' },
      { key: 'poz-bzod', name: 'Bilans zdrowia osoby dorosłej „Moje Zdrowie”', durationMinutes: 20, mode: 'in-person', specialty: 'interna', program: 'NFZ — Moje Zdrowie', description: 'Ankieta w IKP albo w przychodni, badania według ankiety, wizyta podsumowująca.' },
      { key: 'poz-bilans-dziecka', name: 'Bilans zdrowia dziecka', durationMinutes: 30, mode: 'in-person', specialty: 'pediatria', program: 'NFZ — POZ' },
      { key: 'poz-szczepienie', name: 'Szczepienie', durationMinutes: 10, mode: 'in-person', specialty: 'pielęgniarstwo', program: 'NFZ — POZ' },
      { key: 'poz-pobranie', name: 'Pobranie materiału do badań', durationMinutes: 10, mode: 'in-person', specialty: 'pielęgniarstwo', program: 'NFZ — POZ' },
    ],
    interviews: ['first-visit', 'cardiology', 'diabetology'],
    needs: [
      { need: 'Deklaracje wyboru lekarza, pielęgniarki i położnej POZ (papierowe i z IKP), lista aktywna', where: 'Panel → POZ → Deklaracje; pacjent: „Moja POZ”' },
      { need: 'Opieka koordynowana: porada kompleksowa, IPOM, koordynator, badania, konsultacje, edukacja i dietetyk', where: 'Karta pacjenta → IPOM; Panel → POZ → Opieka koordynowana; pacjent widzi swój plan' },
      { need: 'Bilans zdrowia osoby dorosłej „Moje Zdrowie” (20–49 lat co 5 lat, od 50 lat co 3 lata, liczone rocznikowo)', where: 'Panel → POZ → Bilans dorosłych: kto może teraz skorzystać, zapis wykonania' },
      { need: 'Choroby przewlekłe pod kontrolą: pomiary domowe, wyniki z datą i źródłem, „co się zmieniło”', where: 'Medical Snapshot, oś czasu, pomiary pacjenta' },
      { need: 'Profilaktyka i szczepienia', where: 'Pacjent: Profilaktyka NFZ, Szczepienia (terminy planowane przez lekarza)' },
      { need: 'Teleporady i wizyty domowe', where: 'Usługi profilu, wideo z poczekalnią' },
      { need: 'Notatka z wizyty i rozpoznanie ICD-10', where: 'Scribe (szablon ogólny i „Porada kompleksowa”), słownik ICD-10' },
    ],
    gaps: [
      { gap: 'e-recepta, e-skierowanie, EDM (P1)', why: 'Wymaga certyfikacji systemu w Centrum e-Zdrowia i certyfikatów placówki — nie zaimplementowano.' },
      { gap: 'e-zwolnienie (e-ZLA, ZUS PUE)', why: 'Wymaga integracji z usługami ZUS i certyfikatu — nie zaimplementowano.' },
      { gap: 'Sprawdzanie ubezpieczenia (eWUŚ) i rozliczenia z NFZ (SWIAD, raporty)', why: 'Usługi NFZ dla świadczeniodawców wymagają dostępu z umową; dziś obsługuje je system gabinetowy placówki.' },
      { gap: 'Przesyłanie deklaracji do NFZ', why: 'Eternal prowadzi rejestr i statusy; zgłoszenie do NFZ robi system rozliczeniowy placówki.' },
      { gap: 'Kalendarz szczepień PSO na dany rok', why: 'Treść zmienia się co roku (komunikat GIS) — do importu i zatwierdzenia przez lekarza.' },
    ],
    legal: [
      'Deklarację można złożyć w przychodni albo elektronicznie w IKP; dwie zmiany lekarza POZ w roku są bezpłatne.',
      'Opiekę koordynowaną i IPOM prowadzi lekarz POZ; plan i limity porad ustala placówka według aktualnego zarządzenia Prezesa NFZ.',
      'Bilans „Moje Zdrowie”: ankieta w IKP albo w przychodni; aplikacja nie dobiera badań — robi to ankieta programu i lekarz.',
    ],
  },
  {
    id: 'estetyka',
    version: 'profil-estetyka/2026-11-1',
    name: 'Medycyna estetyczna',
    forWhom: 'Gabinety i kliniki medycyny estetycznej: toksyna botulinowa, wypełniacze, biostymulatory, mezoterapia, zabiegi kosmetologiczne.',
    features: ['aesthetic'],
    modulesOn: ['workspace', 'medical-snapshot', 'scribe', 'invite', 'video'],
    noteTemplates: ['aesthetic'],
    specialties: ['medycyna estetyczna', 'dermatologia'],
    requiredDocuments: [doc('est-docs', 'Dokumentacja wcześniejszych zabiegów estetycznych (jeśli były)', ['other', 'certificate'], { optional: true })],
    services: [
      { key: 'est-konsultacja', name: 'Konsultacja kwalifikacyjna medycyny estetycznej', durationMinutes: 30, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, purposeDefault: 'estetyczny' },
      { key: 'est-toksyna', name: 'Toksyna botulinowa — mimiczne okolice twarzy', durationMinutes: 30, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, consentTemplate: 'toksyna', controlAfterDays: 14, purposeDefault: 'estetyczny' },
      { key: 'est-nadpotliwosc', name: 'Toksyna botulinowa — leczenie nadpotliwości', durationMinutes: 45, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, consentTemplate: 'toksyna', controlAfterDays: 14, purposeDefault: 'leczniczy' },
      { key: 'est-wypelniacz', name: 'Wypełniacz z kwasem hialuronowym', durationMinutes: 45, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, consentTemplate: 'wypelniacz', controlAfterDays: 14, purposeDefault: 'estetyczny' },
      { key: 'est-biostymulator', name: 'Stymulator tkankowy (biostymulacja)', durationMinutes: 45, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, consentTemplate: 'biostymulator', controlAfterDays: 30, purposeDefault: 'estetyczny' },
      { key: 'est-mezoterapia', name: 'Mezoterapia igłowa', durationMinutes: 45, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true, consentTemplate: 'mezoterapia', controlAfterDays: 14, purposeDefault: 'estetyczny' },
      { key: 'est-kontrola', name: 'Wizyta kontrolna po zabiegu', durationMinutes: 15, mode: 'in-person', specialty: 'medycyna estetyczna', vat: '23', requiresPhysician: true },
      { key: 'est-kosmetologia', name: 'Zabieg kosmetologiczny (bez naruszenia ciągłości skóry)', durationMinutes: 45, mode: 'in-person', specialty: 'kosmetologia', vat: '23', purposeDefault: 'estetyczny' },
    ],
    interviews: ['aesthetic'],
    needs: [
      { need: 'Karta zabiegu: cel (estetyczny/leczniczy ze wskazaniem), produkt, numer serii i data ważności, ilość, mapa iniekcji', where: 'Karta pacjenta → Zabiegi → Nowa karta zabiegu' },
      { need: 'Rejestr produktów i partii; „kto dostał partię X” przy komunikacie bezpieczeństwa producenta', where: 'Panel → Zabiegi → Produkty i partie' },
      { need: 'Zgoda pisemna na zabieg według wzoru zatwierdzonego przez lekarza; osobna zgoda na wizerunek', where: 'Zgody: wydruk do podpisu i skan w dokumentacji; pacjent może przeczytać treść wcześniej w aplikacji' },
      { need: 'Dokumentacja fotograficzna przed i po w tych samych ujęciach (bez analizy obrazu)', where: 'Karta zabiegu → zdjęcia z ujęciem; porównanie obok siebie' },
      { need: 'Wywiad kwalifikacyjny (ciąża, leki przeciwzakrzepowe, choroby autoimmunologiczne, wcześniejsze wypełniacze)', where: 'Wywiad przed wizytą „Kwalifikacja do zabiegu estetycznego”' },
      { need: 'Zalecenia po zabiegu, wizyta kontrolna, przypomnienie o kolejnym zabiegu', where: 'Karta zabiegu → zalecenia, kontrola i termin; pacjent: „Moje zabiegi”' },
      { need: 'Rejestr powikłań powiązany z partią produktu, dane do zgłoszenia', where: 'Panel → Zabiegi → Powikłania' },
      { need: 'Zabiegi inwazyjne tylko przez lekarza; kosmetolog — zabiegi bez naruszenia ciągłości skóry', where: 'Usługa „wykonuje lekarz” + zawód w profilu personelu; aplikacja nie pozwala podpisać karty innej osobie' },
      { need: 'Cennik i VAT zależny od celu zabiegu', where: 'Usługi: cena i stawka; karta zabiegu: cel i wskazanie' },
    ],
    gaps: [
      { gap: 'Płatności i zadatki online', why: 'Wymaga operatora płatności (np. Przelewy24, PayU, Stripe) i umowy placówki — nie zaimplementowano.' },
      { gap: 'Sprzedaż kosmetyków, karty podarunkowe, programy lojalnościowe', why: 'Poza zakresem dokumentacji medycznej — do rozważenia jako osobny moduł.' },
      { gap: 'Galeria „przed i po” na stronę i do mediów społecznościowych', why: 'Nie budujemy celowo: ogłaszanie się zdjęciami pacjentów budzi zastrzeżenia samorządu lekarskiego; zgoda na wizerunek jest osobna i domyślnie wyłączona.' },
      { gap: 'Automatyczna ocena zdjęć (zmarszczki, symetria, skóra)', why: 'Ocena obrazu to wyrób medyczny i dane biometryczne — Eternal pokazuje zdjęcia obok siebie bez analizy.' },
    ],
    legal: [
      'Komunikat MZ z 23.01.2026: procedury medycyny estetyczno-naprawczej to świadczenia zdrowotne o podwyższonym ryzyku, wykonywane przez lekarzy i lekarzy dentystów (status prawny komunikatu jest sporny, brak ustawy).',
      'Zgoda na zabieg o podwyższonym ryzyku — w formie pisemnej (podpis odręczny albo kwalifikowany podpis elektroniczny); potwierdzenie kliknięciem w aplikacji nie zastępuje formy pisemnej.',
      'VAT: o zwolnieniu decyduje cel zabiegu (profilaktyka, ratowanie, przywracanie, poprawa zdrowia) udokumentowany w dokumentacji medycznej; zabiegi wyłącznie estetyczne — co do zasady 23%. Przy wątpliwościach — interpretacja indywidualna.',
      'Zdjęcia są częścią dokumentacji medycznej; rozpowszechnianie wizerunku tylko za osobną zgodą, którą pacjent może w każdej chwili wycofać.',
    ],
  },
  {
    id: 'aos',
    version: 'profil-aos/2026-11-1',
    name: 'Poradnia specjalistyczna (AOS)',
    forWhom: 'Poradnie specjalistyczne NFZ i prywatne: kardiologia, interna, pediatria i inne.',
    features: [],
    modulesOn: ['workspace', 'medical-snapshot', 'inbox', 'facts', 'scribe', 'diagnoses', 'invite', 'video'],
    noteTemplates: ['general', 'cardiology', 'pediatrics', 'full'],
    specialties: ['interna', 'kardiologia', 'pediatria'],
    requiredDocuments: [doc('aos-referral', 'Skierowanie (jeśli wizyta na NFZ wymaga skierowania)', ['referral'], { optional: true })],
    services: [
      { key: 'aos-pierwsza', name: 'Konsultacja specjalistyczna — pierwsza wizyta', durationMinutes: 30, mode: 'in-person', specialty: 'interna' },
      { key: 'aos-kontrola', name: 'Wizyta kontrolna w poradni', durationMinutes: 20, mode: 'in-person', specialty: 'interna' },
      { key: 'aos-tele', name: 'Teleporada specjalistyczna', durationMinutes: 15, mode: 'tele', specialty: 'interna' },
    ],
    interviews: ['first-visit', 'cardiology', 'diabetology'],
    needs: [
      { need: 'Komplet dokumentów przed pierwszą wizytą (skierowanie, wyniki, wypisy)', where: 'Zaproszenie z linkiem, skrzynka materiałów z kompletnością' },
      { need: 'Raport faktów i Medical Snapshot przed wizytą', where: 'Raport faktów, karta pacjenta' },
      { need: 'Pakiety specjalizacji (dokumenty, wywiad, szablon notatki)', where: 'Administracja → Pakiety specjalizacji' },
    ],
    gaps: [
      { gap: 'e-skierowanie z P1 i lista oczekujących NFZ (AP-KOLCE)', why: 'Wymaga certyfikacji i usług NFZ — prowadzi je system rozliczeniowy placówki.' },
    ],
    legal: ['Aplikacja nie ocenia wyników — pokazuje je z datą, zakresem z dokumentu i źródłem.'],
  },
  {
    id: 'rehabilitacja',
    version: 'profil-rehabilitacja/2026-11-1',
    name: 'Fizjoterapia i rehabilitacja',
    forWhom: 'Gabinety fizjoterapii i poradnie rehabilitacyjne: wizyty fizjoterapeutyczne, serie zabiegów, ćwiczenia w domu.',
    features: [],
    modulesOn: ['workspace', 'medical-snapshot', 'rehab-plan', 'invite', 'video'],
    noteTemplates: ['general', 'soap'],
    specialties: ['rehabilitacja', 'fizjoterapia'],
    requiredDocuments: [
      doc('reh-referral', 'Skierowanie na rehabilitację (jeśli wymagane)', ['referral'], { optional: true }),
      doc('reh-imaging', 'Opisy badań obrazowych (RTG, USG, rezonans) dotyczące leczonej okolicy', ['imaging'], { optional: true }),
    ],
    services: [
      { key: 'reh-wizyta', name: 'Wizyta fizjoterapeutyczna', durationMinutes: 45, mode: 'in-person', specialty: 'fizjoterapia' },
      { key: 'reh-zabieg', name: 'Zabieg fizjoterapeutyczny (seria)', durationMinutes: 30, mode: 'in-person', specialty: 'fizjoterapia' },
      { key: 'reh-lekarz', name: 'Konsultacja lekarza rehabilitacji', durationMinutes: 30, mode: 'in-person', specialty: 'rehabilitacja' },
      { key: 'reh-tele', name: 'Teleporada fizjoterapeutyczna (kontrola ćwiczeń)', durationMinutes: 30, mode: 'tele', specialty: 'fizjoterapia' },
    ],
    interviews: ['first-visit'],
    needs: [
      { need: 'Plan ćwiczeń w domu z dniami tygodnia i kontrolą wykonania', where: 'Karta pacjenta → Plan rehabilitacji; pacjent odhacza ćwiczenia' },
      { need: 'Ból przed i po (dziennik pacjenta, skala 0–10, bez oceny)', where: 'Dzienniki pacjenta — mapa i skala bólu' },
      { need: 'Kontrola ćwiczeń na wideo', where: 'Teleporada z poczekalnią' },
    ],
    gaps: [
      { gap: 'Rozliczanie cykli zabiegów NFZ i grafik sal/urządzeń', why: 'Nie zaimplementowano — grafik dotyczy dziś personelu, nie urządzeń.' },
    ],
    legal: ['Skale funkcjonalne zapisujemy bez wyliczania wyniku i bez oceny — interpretuje fizjoterapeuta lub lekarz.'],
  },
  {
    id: 'zdrowie-psychiczne',
    version: 'profil-zdrowie-psychiczne/2026-11-1',
    name: 'Zdrowie psychiczne (psychiatria, psychologia, psychoterapia)',
    forWhom: 'Poradnie zdrowia psychicznego, gabinety psychiatryczne, psychologiczne i psychoterapii.',
    features: [],
    modulesOn: ['workspace', 'medical-snapshot', 'invite', 'video', 'diagnoses'],
    noteTemplates: ['general', 'soap'],
    specialties: ['psychiatria', 'psychologia'],
    requiredDocuments: [doc('psy-history', 'Dokumentacja wcześniejszego leczenia (wypisy, zaświadczenia)', ['discharge', 'other'], { optional: true })],
    services: [
      { key: 'psy-konsultacja', name: 'Konsultacja psychiatryczna', durationMinutes: 45, mode: 'in-person', specialty: 'psychiatria' },
      { key: 'psy-kontrola', name: 'Wizyta kontrolna psychiatryczna', durationMinutes: 30, mode: 'in-person', specialty: 'psychiatria' },
      { key: 'psy-sesja', name: 'Sesja psychoterapii', durationMinutes: 50, mode: 'in-person', specialty: 'psychologia' },
      { key: 'psy-psycholog', name: 'Konsultacja psychologiczna', durationMinutes: 50, mode: 'in-person', specialty: 'psychologia' },
      { key: 'psy-tele', name: 'Teleporada psychiatryczna', durationMinutes: 30, mode: 'tele', specialty: 'psychiatria' },
    ],
    interviews: ['psychiatry'],
    needs: [
      { need: 'Wywiad przed pierwszą wizytą, bez punktacji', where: 'Wywiad „Psychiatria” (zatwierdzony przez lekarza)' },
      { need: 'Numery pomocy zawsze pod ręką', where: 'Menu pomocy pacjenta: 112, 116 123, 800 70 2222 — nie do wyłączenia' },
      { need: 'Dziennik nastroju i snu prowadzony przez pacjenta', where: 'Dzienniki pacjenta (bez interpretacji)' },
    ],
    gaps: [
      { gap: 'Notatki z psychoterapii z osobnym, węższym dostępem', why: 'Nie zaimplementowano osobnej kategorii notatek; do czasu wdrożenia nie zalecamy nagrywania sesji (Scribe można wyłączyć dla usługi).' },
    ],
    legal: ['Nagranie rozmowy wyłącznie za zgodą; w psychoterapii rozważ rezygnację z nagrywania.'],
  },
  {
    id: 'stomatologia',
    version: 'profil-stomatologia/2026-11-1',
    name: 'Stomatologia (profil częściowy)',
    forWhom: 'Gabinety stomatologiczne — na dziś: rezerwacje, dokumenty, zdjęcia, zgody i przypomnienia; bez diagramu zębów.',
    features: [],
    modulesOn: ['workspace', 'medical-snapshot', 'invite'],
    noteTemplates: ['general'],
    specialties: ['stomatologia'],
    requiredDocuments: [doc('dent-xray', 'Zdjęcie RTG (pantomogram) z ostatnich 12 miesięcy, jeśli było wykonane', ['imaging'], { maxAgeDays: 365, optional: true })],
    services: [
      { key: 'dent-przeglad', name: 'Przegląd stomatologiczny', durationMinutes: 30, mode: 'in-person', specialty: 'stomatologia' },
      { key: 'dent-zachowawcze', name: 'Leczenie zachowawcze', durationMinutes: 60, mode: 'in-person', specialty: 'stomatologia' },
      { key: 'dent-higienizacja', name: 'Higienizacja', durationMinutes: 45, mode: 'in-person', specialty: 'stomatologia' },
      { key: 'dent-chirurgia', name: 'Chirurgia stomatologiczna', durationMinutes: 60, mode: 'in-person', specialty: 'stomatologia' },
    ],
    interviews: ['first-visit'],
    needs: [
      { need: 'Przypomnienie o przeglądzie i higienizacji', where: 'Przypomnienia o wizytach; planowanie kolejnej wizyty' },
      { need: 'Zdjęcia i opisy RTG w dokumentacji pacjenta', where: 'Dokumenty pacjenta, dokumentacja fotograficzna' },
    ],
    gaps: [
      { gap: 'Diagram zębów (odontogram) i plan leczenia z kosztorysem', why: 'Nie zaimplementowano — kluczowe dla gabinetu stomatologicznego, do zbudowania w kolejnym etapie.' },
      { gap: 'Integracja z RVG i pantomografem (DICOM)', why: 'Wymaga integracji z oprogramowaniem urządzeń.' },
      { gap: 'Limity i rozliczenia NFZ w stomatologii', why: 'Prowadzi je system rozliczeniowy placówki.' },
    ],
    legal: ['Zabiegi chirurgiczne i o podwyższonym ryzyku — zgoda pisemna.'],
  },
  {
    id: 'medycyna-pracy',
    version: 'profil-medycyna-pracy/2026-11-1',
    name: 'Medycyna pracy (profil częściowy)',
    forWhom: 'Poradnie medycyny pracy — na dziś: rezerwacje, dokumenty od pracodawcy, konsultacje; bez wystawiania orzeczeń.',
    features: [],
    modulesOn: ['workspace', 'invite', 'inbox'],
    noteTemplates: ['general'],
    specialties: ['medycyna pracy'],
    requiredDocuments: [doc('mp-referral', 'Skierowanie na badania od pracodawcy', ['referral'])],
    services: [
      { key: 'mp-wstepne', name: 'Badanie wstępne', durationMinutes: 20, mode: 'in-person', specialty: 'medycyna pracy' },
      { key: 'mp-okresowe', name: 'Badanie okresowe', durationMinutes: 20, mode: 'in-person', specialty: 'medycyna pracy' },
      { key: 'mp-kontrolne', name: 'Badanie kontrolne', durationMinutes: 20, mode: 'in-person', specialty: 'medycyna pracy' },
    ],
    interviews: [],
    needs: [
      { need: 'Skierowanie od pracodawcy przed wizytą', where: 'Wymagany dokument „Skierowanie na badania”, zaproszenie z linkiem' },
    ],
    gaps: [
      { gap: 'Orzeczenia lekarskie z datą ważności i przypomnieniem przed końcem ważności', why: 'Nie zaimplementowano — wymaga wzoru z rozporządzenia i rejestru orzeczeń.' },
      { gap: 'Umowy i rozliczenia z pracodawcami, portal pracodawcy', why: 'Nie zaimplementowano.' },
    ],
    legal: ['Pracodawca nie otrzymuje dokumentacji medycznej — wyłącznie orzeczenie.'],
  },
];

export function clinicProfile(id: string): ClinicProfile | undefined {
  return CLINIC_PROFILES.find((p) => p.id === id);
}
