import { ApiError } from './api';

/** Komunikaty błędów (kod API → tekst polski; tłumaczenie EN przez t()). */
const MESSAGES: Record<string, string> = {
  network_error: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
  internal_error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
  invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
  too_many_attempts: 'Zbyt wiele prób. Konto zostało czasowo zablokowane — spróbuj później.',
  rate_limited: 'Zbyt wiele prób w krótkim czasie. Odczekaj chwilę.',
  invalid_code: 'Nieprawidłowy lub już użyty kod. Wpisz aktualny kod z aplikacji uwierzytelniającej.',
  staff_use_password: 'Aplikacja mobilna jest dla pacjentów. Personel loguje się w panelu w przeglądarce.',
  unsupported_file_type: 'Dozwolone pliki: PDF, JPG, PNG.',
  file_too_large: 'Plik jest zbyt duży (maks. 15 MB).',
  module_disabled: 'Ta funkcja jest wyłączona w Twojej placówce.',
  intake_processing: 'Dokument jest jeszcze odczytywany. Spróbuj za chwilę.',
  too_many_contacts: 'Możesz dodać najwyżej 5 osób bliskich.',
  unauthenticated: 'Zaloguj się ponownie.',
  unauthorized: 'Sesja wygasła. Zaloguj się ponownie.',
  download_failed: 'Nie udało się pobrać pliku. Spróbuj ponownie za chwilę.',
  sharing_unavailable: 'Udostępnianie plików nie jest dostępne na tym urządzeniu.',
};

export function errorMessage(err: unknown, t: (s: string) => string): string {
  const code = err instanceof ApiError ? err.code : 'internal_error';
  return t(MESSAGES[code] ?? MESSAGES.internal_error);
}
