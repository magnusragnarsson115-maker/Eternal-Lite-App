/** Etykiety słownikowe (tekst polski; tłumaczenie przez t()). Te same nazwy co w aplikacji w przeglądarce. */

export const KIND_PL: Record<string, string> = {
  lab: 'Wyniki badań laboratoryjnych',
  discharge: 'Karta informacyjna (wypis ze szpitala)',
  imaging: 'Opis badania obrazowego',
  referral: 'Skierowanie',
  prescription: 'Recepta',
  certificate: 'Zaświadczenie',
  other: 'Dokument medyczny',
  unknown: 'Dokument',
};

export const STATUS_PL: Record<string, string> = {
  processing: 'Odczytywanie…',
  needs_review: 'Do potwierdzenia',
  submitted: 'Gotowe',
  confirmed: 'Gotowe',
  unreadable: 'Bez odczytu tekstu',
  failed: 'Błąd odczytu',
};

export const SCOPE_PL: Record<string, string> = { all: 'wszystkie dokumenty i wyniki', results: 'wyniki badań', documents: 'dokumenty', selected: 'wybrane dokumenty' };

export const PURPOSE_PL: Record<string, string> = { visit: 'wizyta', consultation: 'konsultacja', 'second-opinion': 'druga opinia', other: 'inny cel' };

export const SUBTYPE_PL: Record<string, string> = {
  'intake-read': 'Odczyt przesłanego dokumentu',
  'intake-file-read': 'Otwarcie pliku dokumentu',
  'intake-list': 'Przegląd przesłanych materiałów',
  'facts-report': 'Raport faktów przed wizytą',
  'facts-report-pdf': 'Pobranie raportu faktów (PDF)',
  'visit-prep': 'Przygotowanie wizyty',
  'intake-clinician-confirm': 'Potwierdzenie odczytu przez lekarza',
  'patient-clinical-read': 'Odczyt dokumentacji',
  'record-read': 'Odczyt wyniku lub dokumentu',
  'file-download': 'Pobranie pliku',
  'patient-read': 'Odczyt danych pacjenta',
  'emergency-access': 'Dostęp ratunkowy (karta SOS)',
  'card-open': 'Otwarcie karty „Po wizycie”',
  'scribe-read': 'Notatka z wizyty',
  'shared-patients-list': 'Lista udostępnień',
};

export const ISSUE_PL: Record<string, string> = {
  not_in_dictionary: 'Nazwa spoza słownika badań',
  name_corrected: 'Nazwa poprawiona automatycznie — sprawdź',
  unit_missing: 'Brak jednostki',
  unit_unexpected: 'Nietypowa jednostka dla tego badania',
  value_not_numeric: 'Wartość nie jest liczbą',
};
