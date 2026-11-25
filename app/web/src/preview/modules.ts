/**
 * Wszystkie moduły aplikacji w przewodniku podglądu: 32 moduły z rejestru (server/modules.ts), profile placówek
 * i ekrany administracji. Każdy ma krótki opis i przyciski, które logują na właściwe konto pokazowe i otwierają
 * ekran modułu. Opisy mówią, co moduł robi — bez oceny danych (granica MDR, COMPLIANCE §1).
 */

export type Lang = 'pl' | 'en';
export type Text = Record<Lang, string>;

export interface ModuleOpen {
  label: Text;
  persona: string;
  route: string;
}

export interface ModuleEntry {
  code: string;
  name: Text;
  what: Text;
  open: ModuleOpen[];
}

export interface ModuleGroup {
  title: Text;
  items: ModuleEntry[];
}

export interface PreviewIds {
  annaId?: string;
  scribeVisit?: string;
  interview?: string;
  karolinaId?: string;
}

const L = {
  open: { pl: 'Otwórz', en: 'Open' },
  panel: { pl: 'Panel', en: 'Panel' },
  patient: { pl: 'Pacjent', en: 'Patient' },
};

const one = (persona: string, route: string): ModuleOpen[] => [{ label: L.open, persona, route }];

export function moduleGroups(ids: PreviewIds): ModuleGroup[] {
  const card = ids.annaId ? `/panel/pacjenci/${ids.annaId}` : '/panel/pacjenci';
  const facts = ids.annaId ? `/panel/raport/${ids.annaId}` : '/panel/pacjenci';
  const scribe = ids.scribeVisit ? `/panel/wizyta/${ids.scribeVisit}?tab=scribe` : '/panel/kalendarz';
  return [
    {
      title: { pl: 'Panel lekarza i placówki', en: 'Doctor and clinic panel' },
      items: [
        {
          code: 'A5.1',
          name: { pl: 'Przestrzeń pracy lekarza — kolejka', en: "Doctor's workspace — queue" },
          what: { pl: 'Kolejka pacjentów (dziś, nowe, pilne, brak danych), statusy spraw i historia każdej zmiany.', en: 'Patient queue (today, new, urgent, missing data), case statuses and the history of every change.' },
          open: one('doctor', '/panel'),
        },
        {
          code: 'A5.2',
          name: { pl: 'Medical Snapshot i „Co się zmieniło”', en: 'Medical Snapshot and “What changed”' },
          what: { pl: 'Obraz dokumentacji z drążeniem do źródła wyniku i listą nowych wpisów od ostatniej wizyty.', en: 'Overview of the record with drill-down to the source of each result and the new entries since the last visit.' },
          open: [
            { label: { pl: 'Snapshot', en: 'Snapshot' }, persona: 'doctor', route: card },
            { label: { pl: 'Oś czasu', en: 'Timeline' }, persona: 'doctor', route: `${card}?tab=timeline` },
          ],
        },
        {
          code: 'D1',
          name: { pl: 'Zaproszenie i przyjęcie danych od pacjenta', en: 'Invitation and intake from the patient' },
          what: { pl: 'Rejestracja wysyła SMS albo kod QR; pacjent bez konta daje zgodę, wgrywa wyniki i potwierdza odczyt.', en: 'Reception sends an SMS or a QR code; the patient, without an account, consents, uploads results and confirms the reading.' },
          open: one('reception', '/panel/skrzynka'),
        },
        {
          code: 'D2',
          name: { pl: 'Skrzynka materiałów i kompletność', en: 'Materials inbox and completeness' },
          what: { pl: 'Wizyty dnia z paskiem kompletności materiałów, filtr braków i przypomnienia dla pacjentów.', en: "Today's visits with a materials completeness bar, a missing-items filter and reminders to patients." },
          open: one('doctor', '/panel/skrzynka'),
        },
        {
          code: 'D3',
          name: { pl: 'Raport faktów przed wizytą', en: 'Pre-visit facts report' },
          what: { pl: 'Potwierdzone wyniki na jednej stronie: data, jednostka, zakres z dokumentu i odnośnik do źródła; PDF.', en: 'Confirmed results on one page: date, unit, range from the document and a link to the source; PDF.' },
          open: one('doctor', facts),
        },
        {
          code: 'D5',
          name: { pl: 'Eternal Scribe i karta „Po wizycie”', en: 'Eternal Scribe and the after-visit card' },
          what: { pl: 'Nagranie za zgodą → szkic notatki ze źródłami → zatwierdzenie przez lekarza → karta dla pacjenta.', en: 'Recording with consent → draft note with sources → approval by the doctor → card for the patient.' },
          open: [
            { label: L.panel, persona: 'doctor', route: scribe },
            { label: { pl: 'Karta pacjenta', en: "Patient's card" }, persona: 'patient', route: '/karty' },
          ],
        },
        {
          code: 'A12.6',
          name: { pl: 'Rozpoznania z kodem ICD-10', en: 'Diagnoses with ICD-10 codes' },
          what: { pl: 'Lekarz wybiera kod ICD-10 ze słownika z polskimi nazwami; zapis jako rozpoznanie w dokumentacji.', en: 'The doctor picks an ICD-10 code from a dictionary with Polish names; saved as a diagnosis in the record.' },
          open: one('doctor', `${card}?tab=diagnoses`),
        },
        {
          code: 'A22.4',
          name: { pl: 'Plan rehabilitacji z kontrolą wykonania', en: 'Rehab plan with completion tracking' },
          what: { pl: 'Lekarz lub fizjoterapeuta układa ćwiczenia z dniami tygodnia; pacjent odhacza wykonanie.', en: 'A doctor or physiotherapist sets exercises by weekday; the patient checks them off.' },
          open: [
            { label: L.panel, persona: 'doctor', route: `${card}?tab=rehab` },
            { label: L.patient, persona: 'patient', route: '/plan' },
          ],
        },
        {
          code: 'D7',
          name: { pl: 'Kalendarz, wideo i przypomnienia', en: 'Calendar, video and reminders' },
          what: { pl: 'Kalendarz i grafik placówki, wizyta wideo z poczekalnią, przypomnienia 24 h i 2 h przed wizytą.', en: 'Clinic calendar and schedule, video visit with a waiting room, reminders 24 h and 2 h before the visit.' },
          open: [
            { label: L.panel, persona: 'doctor', route: '/panel/kalendarz' },
            { label: L.patient, persona: 'patient', route: '/wizyty' },
          ],
        },
        {
          code: 'D12',
          name: { pl: 'Mierniki pilotażu i jakości', en: 'Pilot and quality metrics' },
          what: { pl: 'Czas dokumentacji, kompletność materiałów, poprawki notatek i raport miesięczny.', en: 'Documentation time, materials completeness, note corrections and a monthly report.' },
          open: one('admin', '/panel/mierniki'),
        },
        {
          code: 'D0',
          name: { pl: 'Konta kliniki, rozliczenia, incydenty', en: 'Clinic accounts, billing, incidents' },
          what: { pl: 'Zaproszenia personelu i role, licznik użycia z fakturą CSV, incydenty z terminem 72 h.', en: 'Staff invitations and roles, usage counter with an invoice CSV, incidents with a 72-hour deadline.' },
          open: [
            { label: { pl: 'Personel', en: 'Staff' }, persona: 'admin', route: '/panel/organizacja?tab=personel' },
            { label: { pl: 'Użycie', en: 'Usage' }, persona: 'admin', route: '/panel/organizacja?tab=uzycie' },
            { label: { pl: 'Incydenty', en: 'Incidents' }, persona: 'admin', route: '/panel/organizacja?tab=incydenty' },
          ],
        },
      ],
    },
    {
      title: { pl: 'Aplikacja pacjenta', en: 'Patient app' },
      items: [
        {
          code: 'A5.3',
          name: { pl: 'Moje zdrowie i avatar 3D', en: 'My health and the 3D avatar' },
          what: { pl: 'Avatar pokazuje, gdzie i jak świeże są dane w dokumentacji — nigdy wyniku zdrowia.', en: 'The avatar shows where data exists and how recent it is — never a health score.' },
          open: one('patient', '/moje-zdrowie'),
        },
        {
          code: 'P3',
          name: { pl: 'Dokumenty i wyniki', en: 'Documents and results' },
          what: { pl: 'Skan albo PDF, odczyt z potwierdzeniem każdej wartości, wersje dokumentów i oś czasu.', en: 'Scan or PDF, reading with confirmation of each value, document versions and a timeline.' },
          open: [
            { label: { pl: 'Dokumenty', en: 'Documents' }, persona: 'patient', route: '/dokumenty' },
            { label: { pl: 'Wyniki', en: 'Results' }, persona: 'patient', route: '/wyniki' },
          ],
        },
        {
          code: 'P2',
          name: { pl: 'Udostępnianie na czas i „kto oglądał”', en: 'Time-limited sharing and “who viewed”' },
          what: { pl: 'Komu, co i na jak długo; wycofanie jednym ruchem; lista każdego odczytu danych.', en: 'Who, what and for how long; withdraw in one tap; a list of every access to the data.' },
          open: one('patient', '/udostepnianie'),
        },
        {
          code: 'P4',
          name: { pl: 'Pomiary i wpisy ręczne', en: 'Measurements and manual entries' },
          what: { pl: 'Pomiar z kontrolą jednostek, korekta z powodem i historią, dane z urządzeń.', en: 'Measurements with unit checks, corrections with a reason and history, data from devices.' },
          open: one('patient', '/pomiary'),
        },
        {
          code: 'A12.4',
          name: { pl: 'Wywiad przed wizytą w formie rozmowy', en: 'Pre-visit interview as a chat' },
          what: { pl: 'Pytania z rozgałęzieniami zatwierdzonymi przez lekarza; odpowiedzi trafiają do karty.', en: 'Questions with branches approved by a doctor; answers go to the chart.' },
          open: one('patient', ids.interview ? `/wywiad/${ids.interview}` : '/wywiad'),
        },
        {
          code: 'A12.3',
          name: { pl: 'Ankiety zdrowotne i ocena aplikacji', en: 'Health questionnaires and app rating' },
          what: { pl: 'Ankieta na start, po nowych wynikach, kontrolna i anonimowa ocena aplikacji.', en: 'Starting questionnaire, after new results, follow-up and an anonymous app rating.' },
          open: one('patient', '/ankiety'),
        },
        {
          code: 'A24.6',
          name: { pl: 'Eternal ID — karta z QR i NFC', en: 'Eternal ID — card with QR and NFC' },
          what: { pl: 'Stały identyfikator, odwoływalny link do karty (QR, chip NFC), kopia na telefonie.', en: 'Permanent identifier, revocable card link (QR, NFC tag), copy on the phone.' },
          open: one('patient', '/eternal-id'),
        },
        {
          code: 'A4.3',
          name: { pl: 'Raport dla lekarza i karta na wyjazd', en: 'Report for the doctor and travel card' },
          what: { pl: 'SBAR przygotowany przez pacjenta, dokument FHIR do pobrania, karta PL/EN z 112 i EKUZ.', en: 'SBAR prepared by the patient, downloadable FHIR document, PL/EN card with 112 and EHIC.' },
          open: one('patient', '/dla-lekarza'),
        },
        {
          code: 'F8.2',
          name: { pl: 'Dzienniki: nastrój, sen, ból, oddech', en: 'Diaries: mood, sleep, pain, breathing' },
          what: { pl: 'Samoocena nastroju, sen, ból z mapą ciała, ćwiczenie oddechowe, cykl i żywienie — bez interpretacji.', en: 'Mood self-rating, sleep, pain with a body map, breathing exercise, cycle and food — no interpretation.' },
          open: one('patient', '/dzienniki'),
        },
        {
          code: 'A20.7',
          name: { pl: 'Szczepienia, choroby w rodzinie, dyspozycje', en: 'Vaccinations, family history, advance directives' },
          what: { pl: 'Szczepienia wykonane i planowane, wywiad rodzinny z drzewem, dyspozycje na wypadek nagłej sytuacji.', en: 'Vaccinations done and planned, family history with a tree, directives for an emergency.' },
          open: one('patient', '/historia-zdrowia'),
        },
        {
          code: 'A17.13',
          name: { pl: 'Kalendarz zdrowia', en: 'Health calendar' },
          what: { pl: 'Wizyty, szczepienia, ćwiczenia i leki w jednym kalendarzu; subskrypcja ICS bez danych o zdrowiu.', en: 'Visits, vaccinations, exercises and medicines in one calendar; ICS feed without health data.' },
          open: one('patient', '/kalendarz'),
        },
        {
          code: 'A7.6',
          name: { pl: 'Plan ćwiczeń i cele tygodniowe', en: 'Exercise plan and weekly goals' },
          what: { pl: 'Plan od placówki do odhaczania i własne cele liczone z danych w aplikacji.', en: 'Plan from the clinic to check off and personal goals counted from app data.' },
          open: one('patient', '/plan'),
        },
        {
          code: 'F9.11',
          name: { pl: 'Własne przypomnienia i plan dnia', en: 'Personal reminders and day plan' },
          what: { pl: 'Przypomnienia ustawiane przez pacjenta, z miejscem i mapą, oraz poranny plan dnia.', en: 'Reminders set by the patient, with a place and map, and a morning day plan.' },
          open: one('patient', '/przypomnienia'),
        },
        {
          code: 'A7.7',
          name: { pl: 'Profilaktyka NFZ według wieku', en: 'NFZ screening by age' },
          what: { pl: 'Programy profilaktyczne dla rocznika pacjenta; treść zatwierdza lekarz.', en: "Screening programmes for the patient's year of birth; content approved by a doctor." },
          open: one('patient', '/profilaktyka'),
        },
        {
          code: 'F7.1',
          name: { pl: 'Apteki i leki refundowane', en: 'Pharmacies and reimbursed medicines' },
          what: { pl: 'Apteki z Rejestru Aptek z trasą w mapie; informacja o refundacji z obwieszczenia MZ.', en: 'Pharmacies from the Pharmacy Register with a route on the map; reimbursement information from the MoH list.' },
          open: one('patient', '/apteki'),
        },
        {
          code: 'F5.1',
          name: { pl: 'Jakość powietrza i pogoda', en: 'Air quality and weather' },
          what: { pl: 'Indeks GIOŚ z najbliższej stacji i dane IMGW — informacja, bez ocen zdrowia.', en: 'GIOŚ index from the nearest station and IMGW data — information, no health assessment.' },
          open: one('patient', '/powietrze'),
        },
        {
          code: 'A24.1',
          name: { pl: 'Profile rodzinne i dostęp opiekuna', en: 'Family profiles and caregiver access' },
          what: { pl: 'Profil dziecka lub osoby pod opieką, zaproszenie opiekuna kodem, przełącznik profilu.', en: 'Profile of a child or dependant, caregiver invitation by code, profile switcher.' },
          open: one('patient', '/rodzina'),
        },
        {
          code: 'P8',
          name: { pl: 'Powiadomienia i przypomnienia', en: 'Notifications and reminders' },
          what: { pl: 'Push → e-mail → SMS, preferencje i godziny ciszy; treść poza aplikacją bez danych o zdrowiu.', en: 'Push → e-mail → SMS, preferences and quiet hours; messages outside the app carry no health data.' },
          open: one('patient', '/powiadomienia'),
        },
        {
          code: 'A5.12',
          name: { pl: 'Kopia na wypadek braku internetu', en: 'Offline copy' },
          what: { pl: 'Karta ratunkowa, leki z godzinami i najbliższe wizyty zapisane w telefonie na żądanie pacjenta.', en: 'Emergency card, medicines with times and upcoming visits saved on the phone at the patient’s request.' },
          open: one('patient', '/bezpieczenstwo'),
        },
        {
          code: 'P14',
          name: { pl: 'Ratunek jednym kliknięciem (SOS)', en: 'One-tap emergency (SOS)' },
          what: { pl: 'Karta ratunkowa, osoby bliskie i połączenie z 112.', en: 'Emergency card, close contacts and a call to 112.' },
          open: one('patient', '/bezpieczenstwo'),
        },
        {
          code: 'P14',
          name: { pl: 'Numery kryzysowe 112 i 116 123', en: 'Crisis numbers 112 and 116 123' },
          what: { pl: 'Zawsze widoczne w pomocy; tego modułu nie da się wyłączyć.', en: 'Always visible in Help; this module cannot be switched off.' },
          open: one('patient', '/pomoc'),
        },
      ],
    },
    {
      title: { pl: 'Profile placówek', en: 'Clinic profiles' },
      items: [
        {
          code: 'POZ',
          name: { pl: 'Podstawowa opieka zdrowotna (NFZ)', en: 'Primary care (NFZ)' },
          what: { pl: 'Deklaracje lekarza, pielęgniarki i położnej, opieka koordynowana z IPOM, bilans „Moje Zdrowie”.', en: 'Doctor, nurse and midwife declarations, coordinated care with a care plan, “Moje Zdrowie” health check.' },
          open: [
            { label: L.panel, persona: 'doctor', route: '/panel/poz' },
            { label: L.patient, persona: 'patient', route: '/moja-poz' },
          ],
        },
        {
          code: 'EST',
          name: { pl: 'Medycyna estetyczna', en: 'Aesthetic medicine' },
          what: { pl: 'Produkty i partie, karta zabiegu z mapą iniekcji, zgody pisemne, zdjęcia przed/po, powikłania.', en: 'Products and batches, procedure record with injection map, written consents, before/after photos, complications.' },
          open: [
            { label: L.panel, persona: 'aesthetic', route: '/panel/zabiegi' },
            { label: { pl: 'Karta zabiegu', en: 'Procedure record' }, persona: 'aesthetic', route: ids.karolinaId ? `/panel/pacjenci/${ids.karolinaId}?tab=zabiegi` : '/panel/zabiegi' },
            { label: L.patient, persona: 'karolina', route: '/moje-zabiegi' },
          ],
        },
        {
          code: 'PROF',
          name: { pl: 'Wybór profilu placówki', en: 'Choosing the clinic profile' },
          what: { pl: 'POZ, estetyka, AOS, rehabilitacja, zdrowie psychiczne, stomatologia, medycyna pracy — z listą braków.', en: 'Primary care, aesthetics, specialist clinic, rehab, mental health, dentistry, occupational medicine — with gaps listed.' },
          open: one('admin', '/panel/admin?tab=profiles'),
        },
      ],
    },
    {
      title: { pl: 'Administracja i platforma', en: 'Administration and platform' },
      items: [
        {
          code: 'OPS',
          name: { pl: 'Gotowość do pracy', en: 'Readiness' },
          what: { pl: 'Co działa naprawdę, co w trybie demo i czego brakuje — z instrukcją podłączenia każdego dostawcy.', en: 'What really works, what runs in demo mode and what is missing — with how to connect each provider.' },
          open: one('admin', '/panel/organizacja?tab=gotowosc'),
        },
        {
          code: 'MOD',
          name: { pl: 'Włączanie modułów', en: 'Switching modules' },
          what: { pl: 'Przełączniki modułów dla placówki i wdrożenie procentowe; numerów kryzysowych nie da się wyłączyć.', en: 'Module switches per clinic and percentage rollout; crisis numbers cannot be switched off.' },
          open: one('admin', '/panel/organizacja?tab=moduly'),
        },
        {
          code: 'API',
          name: { pl: 'Integracje przez API', en: 'Integrations by API' },
          what: { pl: 'Partnerzy po stronie serwera: odczyt dokumentów, mowa na tekst, urządzenia, ZnanyLekarz, wywiad objawowy.', en: 'Server-side partners: document reading, speech-to-text, devices, ZnanyLekarz, symptom interview.' },
          open: one('admin', '/panel/admin?tab=integrations'),
        },
        {
          code: 'LOG',
          name: { pl: 'Dziennik dostępu', en: 'Access log' },
          what: { pl: 'Każdy dostęp do danych pacjenta zapisany w łańcuchu z podpisem HMAC.', en: 'Every access to patient data recorded in an HMAC-signed chain.' },
          open: one('admin', '/panel/admin?tab=audit'),
        },
        {
          code: '648',
          name: { pl: 'Mapa 42 modułów produktowych i 648 funkcji', en: 'Map of 42 product modules and 648 functions' },
          what: { pl: 'Co działa i gdzie to otworzyć, co jest w kolejce, czego sam kod nie zrobi i dlaczego.', en: 'What works and where to open it, what is queued, what code alone cannot do and why.' },
          open: one('admin', '/moduly'),
        },
      ],
    },
  ];
}

export function moduleCount(groups: ModuleGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
