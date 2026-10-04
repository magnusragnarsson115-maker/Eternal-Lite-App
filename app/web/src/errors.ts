import { ApiError } from './api';

/** Komunikaty błędów API (kod → treść po polsku; tłumaczenie przez słownik EN). */
const MESSAGES: Record<string, string> = {
  network_error: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
  internal_error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
  validation_failed: 'Sprawdź poprawność wypełnionych pól.',
  invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
  too_many_attempts: 'Zbyt wiele prób. Konto zostało czasowo zablokowane — spróbuj później.',
  rate_limited: 'Zbyt wiele prób w krótkim czasie. Odczekaj chwilę.',
  invalid_code: 'Nieprawidłowy lub już użyty kod. Wpisz aktualny kod z aplikacji uwierzytelniającej.',
  mfa_required: 'Wymagane jest potwierdzenie logowania kodem z aplikacji uwierzytelniającej.',
  email_taken: 'Konto z tym adresem e-mail już istnieje. Zaloguj się lub zresetuj hasło.',
  weak_password: 'Hasło jest zbyt słabe — użyj dłuższego hasła, które nie zawiera Twoich danych.',
  password_breached: 'To hasło pojawiło się w znanych wyciekach danych. Wybierz inne.',
  password_unchanged: 'Nowe hasło musi różnić się od obecnego.',
  required_consent_missing: 'Zaakceptuj wymagane zgody, aby założyć konto.',
  invalid_pesel: 'Numer PESEL jest nieprawidłowy.',
  pesel_birthdate_mismatch: 'Data urodzenia nie zgadza się z numerem PESEL.',
  birthdate_required: 'Podaj datę urodzenia lub numer PESEL.',
  invalid_birthdate: 'Nieprawidłowa data urodzenia.',
  pesel_registered_use_activation_code: 'Ten PESEL jest już w kartotece placówki. Poproś rejestrację o kod aktywacyjny, aby połączyć konto z kartoteką.',
  invalid_activation_code: 'Kod aktywacyjny jest nieprawidłowy lub wygasł.',
  activation_data_mismatch: 'Data urodzenia nie zgadza się z danymi w placówce.',
  account_exists: 'Ta kartoteka ma już konto w aplikacji.',
  invalid_or_expired_token: 'Link wygasł lub został już użyty.',
  slot_taken: 'Ten termin został właśnie zajęty. Wybierz inny.',
  slot_in_past: 'Ten termin już minął.',
  too_many_active_bookings: 'Masz już maksymalną liczbę zaplanowanych wizyt.',
  already_booked_for_service: 'Masz już zaplanowaną wizytę tego rodzaju. Możesz zmienić jej termin.',
  patient_time_conflict: 'Masz inną wizytę w tym czasie.',
  telemedicine_consent_required: 'Aby umówić teleporadę, włącz zgodę na udział w teleporadach.',
  cancel_window_passed: 'Odwołanie online nie jest już możliwe. Skontaktuj się telefonicznie z placówką.',
  not_cancellable: 'Tej wizyty nie można odwołać.',
  tele_window_closed: 'Pokój teleporady otwiera się 15 minut przed wizytą.',
  identity_not_verified: 'Tożsamość pacjenta nie została jeszcze potwierdzona w placówce.',
  consent_missing: 'Włącz dostęp do wyników w aplikacji w ustawieniach prywatności.',
  email_not_verified: 'Potwierdź adres e-mail, aby rezerwować wizyty.',
  value_out_of_input_range: 'Wartość poza zakresem możliwym do wprowadzenia — sprawdź, czy nie ma literówki.',
  diastolic_not_lower: 'Ciśnienie rozkurczowe musi być niższe niż skurczowe.',
  date_in_future: 'Data pomiaru nie może być z przyszłości.',
  message_too_long: 'Wiadomość jest za długa (maks. 2000 znaków).',
  empty_message: 'Wpisz treść wiadomości.',
  subject_required: 'Podaj temat wiadomości.',
  required_answer_missing: 'Odpowiedz na wszystkie wymagane pytania.',
  insufficient_role: 'Nie masz uprawnień do tej operacji.',
  staff_only: 'Ta część jest dostępna wyłącznie dla personelu.',
  patient_only: 'Ta część jest dostępna wyłącznie dla pacjentów.',
  forbidden: 'Brak dostępu.',
  not_found: 'Nie znaleziono.',
  csrf_token_invalid: 'Sesja wygasła. Odśwież stronę.',
  unauthenticated: 'Zaloguj się ponownie.',
  invalid_transition: 'Nie można zmienić statusu wizyty w ten sposób.',
  noshow_before_start: 'Nieobecność można oznaczyć dopiero po rozpoczęciu wizyty.',
  reminder_recently_sent: 'Przypomnienie zostało wysłane przed chwilą.',
  not_remindable: 'Do tej wizyty nie można wysłać przypomnienia.',
  invalid_range: 'Nieprawidłowy zakres dat lub godzin.',
  range_too_long: 'Zakres jest zbyt długi.',
  invalid_hours: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.',
  unsupported_file_type: 'Dozwolone pliki: PDF, JPG, PNG.',
  file_content_mismatch: 'Zawartość pliku nie odpowiada jego typowi.',
  file_too_large: 'Plik jest zbyt duży (maks. 15 MB).',
  empty_report: 'Dodaj co najmniej jeden parametr, plik lub opis.',
  observation_incomplete: 'Uzupełnij nazwę i wartość każdego parametru.',
  title_required: 'Podaj tytuł.',
  upstream_unavailable: 'Zewnętrzna usługa jest chwilowo niedostępna.',
  upstream_error: 'Zewnętrzna usługa zwróciła błąd.',
  integration_not_configured: 'Integracja nie została skonfigurowana przez placówkę.',
  withings_not_connected: 'Konto Withings nie jest połączone.',
  cannot_demote_self: 'Nie możesz odebrać sobie uprawnień administratora.',
  practitioner_required: 'Wskaż lekarza dla konta z rolą lekarza.',
  practitioner_has_account: 'Ten lekarz ma już konto.',
  mfa_mandatory_for_staff: 'Uwierzytelnianie dwuskładnikowe jest obowiązkowe dla personelu.',
  version_conflict: 'Dane zmieniły się w międzyczasie. Odśwież i spróbuj ponownie.',
  fhir_validation_failed: 'Dane nie przeszły walidacji FHIR.',
  required_consent_cannot_be_withdrawn_here: 'Tej zgody nie można wycofać w aplikacji — skontaktuj się z placówką.',
};

export function errorMessage(err: unknown, t: (s: string) => string): string {
  if (err instanceof ApiError) {
    const msg = MESSAGES[err.code];
    if (msg) return t(msg);
    return t('Wystąpił błąd: {code}').replace('{code}', err.code);
  }
  return t(MESSAGES.internal_error);
}

export function errorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}
