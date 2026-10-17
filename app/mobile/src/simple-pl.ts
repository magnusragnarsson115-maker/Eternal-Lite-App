/**
 * Tryb prostego języka w aplikacji mobilnej (A23.2) — jak web/src/simple-pl.ts: klucz to pełny tekst z t(),
 * wartość to krótkie zdania z zachowaniem sensu i zastrzeżeń. Test: tests/unit/i18n.test.ts.
 */
export const SIMPLE: Record<string, string> = {
  'Usuniemy Twoje konto, dokumenty dodane przez Ciebie, udostępnienia i ustawienia. Dokumentacja prowadzona przez placówki zostaje u nich (obowiązek prawny) — dostaniesz potwierdzenie, co dokładnie zostało.':
    'Usuniemy Twoje konto, dokumenty i ustawienia. Placówka musi zachować swoją dokumentację. Dostaniesz potwierdzenie.',
  'Średnia arytmetyczna wszystkich odczytów z okresu, osobno dla każdego rodzaju, jednostki i źródła; liczona przy co najmniej 2 odczytach. Raport nie porównuje wartości z normami.':
    'Średnią liczymy osobno dla każdego rodzaju pomiaru i urządzenia. Potrzebne są co najmniej 2 pomiary. Nie porównujemy wyników z normą.',
  'Osoby bliskie dostaną SMS z linkiem do Twojej karty ratunkowej (ważny 24 godziny). Każde otwarcie karty zobaczysz w dzienniku.':
    'Bliscy dostaną SMS z linkiem do Twojej karty ratunkowej. Link działa 24 godziny.',
  'Ustal 6-cyfrowy PIN. Będzie potrzebny, gdy biometria nie zadziała. Po 5 błędnych próbach trzeba zalogować się hasłem.':
    'Wymyśl PIN z 6 cyfr. Przyda się, gdy telefon nie rozpozna twarzy lub palca. Po 5 pomyłkach zaloguj się hasłem.',
  'Projekt opisu ze słownika ({v}) — czeka na zatwierdzenie przez lekarza. Nie dotyczy Twojego wyniku i go nie ocenia.': 'Ten opis czeka na sprawdzenie przez lekarza. Nie mówi nic o Twoim wyniku.',
  'Opis ogólny ze słownika ({v}), zatwierdził(a): {by}. Nie dotyczy Twojego wyniku i go nie ocenia.': 'Ogólny opis badania. Sprawdził go lekarz: {by}. Nie mówi nic o Twoim wyniku.',
  'Udostępnienie wygaśnie samo. Wycofasz je w każdej chwili, a każdy odczyt zobaczysz w „Kto oglądał moje dane”.': 'Udostępnienie samo się skończy. Możesz je wcześniej wyłączyć.',
  'Powiadomienia z godzin ciszy przyjdą po ich zakończeniu. Kanały: najpierw push, potem e-mail, na końcu SMS.': 'W godzinach ciszy nie wyślemy powiadomień. Przyjdą później.',
  'Twoje pomiary, potwierdzone wyniki badań i wizyty w wybranym okresie. Raport niczego nie ocenia.': 'Twoje pomiary, wyniki i wizyty z wybranego czasu. Raport nie ocenia wyników.',
  'Wpis zostanie oznaczony jako „ręczny”. Aplikacja nie ocenia wartości — omów je z lekarzem.': 'Zapiszemy, że wpisano go ręcznie. Aplikacja nie ocenia wyników. Omów je z lekarzem.',
  'Najlepiej działają PDF-y z portalu laboratorium. Zdjęcie: cała strona, równo, bez cienia.': 'Najlepiej dodaj PDF z laboratorium. Zdjęcie zrób z całej strony, bez cienia.',
  'Odczyt maszynowy: program i model AI ({m}). Może zawierać błędy — sprawdź pola na żółto.': 'Program odczytał dokument ({m}). Może się mylić. Sprawdź żółte pola.',
  'Pól, których nie potwierdzisz, lekarz zobaczy jako „odczyt maszynowy, niepotwierdzony”.': 'Lekarz zobaczy, które pola nie zostały przez Ciebie sprawdzone.',
};
