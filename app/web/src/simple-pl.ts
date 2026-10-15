/**
 * Tryb prostego języka (A23.2): prostsze wersje kluczowych tekstów dla pacjenta. Klucz = pełny tekst
 * z interfejsu (dokładnie jak w t()), wartość = krótkie zdania, strona czynna, słowa potoczne.
 * Sens i zastrzeżenia (brak oceny wyników, 112, zgoda) muszą zostać zachowane — prosty tekst niczego nie
 * obiecuje ponad pełny. Pełną wersję pokazuje „Pokaż pełny opis” (komponent FullText).
 * Test i18n sprawdza, że każdy klucz występuje w kodzie i że każda wersja ma tłumaczenie EN.
 */
export const SIMPLE: Record<string, string> = {
  // raport okresowy i pulpit
  'Odczyty grupujemy według rodzaju pomiaru, jednostki i źródła (wpis ręczny, urządzenie, import z pliku) — odczytów z różnych źródeł, urządzeń i jednostek nie łączymy. Dla każdej grupy podajemy liczbę odczytów, najniższą i najwyższą wartość oraz średnią arytmetyczną wszystkich odczytów z okresu (zaokrągloną do 0,1; liczoną przy co najmniej 2 odczytach). Odczyty oznaczone jako rozbieżne (inny odczyt z tej samej minuty) są uwzględnione i wskazane w tabeli. Wyniki badań pochodzą z dokumentów laboratoriów i są pokazane bez przeliczeń. Raport nie porównuje wartości z normami i niczego nie ocenia.':
    'Liczymy osobno dla każdego rodzaju pomiaru i każdego urządzenia. Pokazujemy, ile było pomiarów oraz najniższy, najwyższy i średni wynik. Średnią liczymy, gdy są co najmniej 2 pomiary. Nie porównujemy wyników z normą.',
  'Twoje pomiary, potwierdzone wyniki badań i wizyty w wybranym okresie — do zapisania jako PDF i pokazania lekarzowi. Raport niczego nie ocenia.':
    'Twoje pomiary, wyniki i wizyty z wybranego czasu. Możesz zapisać raport i pokazać go lekarzowi. Raport nie ocenia wyników.',
  'Ostatnie zapisane wartości z datą i źródłem. Aplikacja ich nie ocenia.': 'Twoje ostatnie pomiary. Aplikacja ich nie ocenia.',
  // wyniki i objaśnienia
  'Aplikacja nie ocenia wyników. Wartości, zakresy referencyjne i oznaczenia pochodzą z laboratorium. Omów wyniki z lekarzem.':
    'Aplikacja nie ocenia wyników. Liczby i zakresy pochodzą z laboratorium. Wyniki omów z lekarzem.',
  'Aplikacja nie ocenia wyników i nie zastępuje porady lekarza.': 'Aplikacja nie ocenia wyników. Nie zastępuje lekarza.',
  'Ze względów bezpieczeństwa wyniki i dokumentacja są dostępne po potwierdzeniu tożsamości. Pokaż dokument tożsamości w rejestracji podczas najbliższej wizyty — dostęp włączy się od razu.':
    'Wyniki zobaczysz, gdy potwierdzisz, kim jesteś. Pokaż dowód osobisty w rejestracji przy najbliższej wizycie.',
  'Na Twój wniosek placówka będzie udostępniać wyniki badań i dokumenty w aplikacji. Możesz to wyłączyć w każdej chwili w ustawieniach prywatności.':
    'Placówka pokaże Ci wyniki i dokumenty w aplikacji. Możesz to wyłączyć w każdej chwili.',
  'Opis ogólny ze słownika ({v}), zatwierdził(a): {by}, {d}. Nie dotyczy Twojego wyniku i go nie ocenia — wynik omawia z Tobą lekarz.':
    'Ogólny opis badania. Sprawdził go lekarz: {by}, {d}. Opis nie mówi nic o Twoim wyniku. Wynik omówi z Tobą lekarz.',
  'Projekt opisu ze słownika ({v}) — czeka na zatwierdzenie przez lekarza. Nie dotyczy Twojego wyniku i go nie ocenia.':
    'Ten opis czeka na sprawdzenie przez lekarza. Nie mówi nic o Twoim wyniku.',
  'Projekt opisów — czeka na zatwierdzenie przez lekarza. W instancji pokazowej pokazujemy go z tym oznaczeniem.': 'Te opisy czekają na sprawdzenie przez lekarza.',
  // pomiary
  'Aplikacja nie ocenia pomiarów. Niepokojące objawy omów z lekarzem; w nagłym przypadku dzwoń 112.':
    'Aplikacja nie ocenia pomiarów. Jeśli coś Cię niepokoi, porozmawiaj z lekarzem. W nagłej sytuacji dzwoń 112.',
  'Plik CSV (np. z Excela lub aplikacji ciśnieniomierza), JSON albo eksport FHIR z Eternal. Najpierw zobaczysz każdy wiersz — zapiszemy tylko poprawne. Ponowny import tego samego pliku nie tworzy kopii.':
    'Wybierz plik z pomiarami, np. z Excela. Najpierw pokażemy każdy wiersz. Zapiszemy tylko poprawne. Ten sam plik nie doda pomiarów drugi raz.',
  'Pierwszy wiersz to nagłówki. Wymagane kolumny: data, rodzaj, jednostka oraz wartość (dla ciśnienia: skurczowe i rozkurczowe). Separator: średnik albo przecinek. Przykład:':
    'W pierwszym wierszu wpisz nazwy kolumn: data, rodzaj, wartość, jednostka. Dla ciśnienia: skurczowe i rozkurczowe. Przykład:',
  'Pomiary i wyniki badań w jednym arkuszu — otworzysz go w Excelu. Pomiary z tego pliku można zaimportować z powrotem.': 'Pomiary i wyniki w jednym pliku. Otworzysz go w Excelu.',
  'Twoja przeglądarka nie obsługuje Web Bluetooth. Użyj Chrome lub Edge na Androidzie albo komputerze.': 'Ta przeglądarka nie połączy się z urządzeniem. Użyj Chrome albo Edge.',
  'Lista pomoże lekarzowi przygotować się do wizyty. Aplikacja nie sprawdza interakcji ani dawkowania.': 'Lista pomoże lekarzowi. Aplikacja nie sprawdza, czy leki do siebie pasują ani czy dawka jest dobra.',
  // wizyty
  'Teleporada odbywa się przez połączenie wideo w przeglądarce. Aby kontynuować, potwierdź zgodę na udział w teleporadach (możesz ją wycofać w ustawieniach prywatności).':
    'Teleporada to rozmowa wideo z lekarzem w przeglądarce. Zaznacz zgodę, żeby przejść dalej. Zgodę możesz potem wycofać.',
  'Połączenie nie jest nagrywane. Jeśli obraz się nie pojawia, zezwól przeglądarce na dostęp do kamery i mikrofonu.':
    'Rozmowa nie jest nagrywana. Jeśli nie widzisz obrazu, pozwól przeglądarce używać kamery i mikrofonu.',
  'Źródło: API Terminy Leczenia NFZ. Dane przekazują świadczeniodawcy i mogą być nieaktualne — termin potwierdź telefonicznie.': 'Terminy pochodzą z NFZ i mogą być nieaktualne. Zadzwoń, żeby potwierdzić termin.',
  // bezpieczeństwo i pomoc
  'W nagłym zagrożeniu najpierw dzwoń 112. Przycisk SOS dodatkowo powiadamia osoby bliskie SMS-em.': 'W nagłej sytuacji najpierw dzwoń 112. Przycisk SOS wyśle też SMS do bliskich.',
  'Wiadomość do placówki może zostać przeczytana dopiero za kilka dni. Jeśli myślisz o zrobieniu sobie krzywdy, zadzwoń teraz:':
    'Placówka może przeczytać wiadomość dopiero za kilka dni. Jeśli myślisz o zrobieniu sobie krzywdy, zadzwoń teraz:',
  // prywatność i konto
  'Podstawą udostępnienia jest Twoja wyraźna zgoda; zapisujemy datę i zakres. Możesz ją wycofać w każdej chwili.': 'Udostępniasz dane tylko za swoją zgodą. Możesz ją wycofać w każdej chwili.',
  'Kolejność: powiadomienie w aplikacji → e-mail → SMS. Treść poza aplikacją nigdy nie zawiera danych o zdrowiu.':
    'Najpierw powiadomimy Cię w aplikacji, potem e-mailem, na końcu SMS-em. Poza aplikacją nie piszemy nic o Twoim zdrowiu.',
  'Każdy wgląd personelu w Twoje dane jest rejestrowany w dzienniku zabezpieczonym przed modyfikacją.': 'Zapisujemy każde wejście personelu w Twoje dane. Tego zapisu nie da się zmienić.',
  'Usuwamy Twoje dokumenty, wpisy i konto. Dokumentacja w placówkach zostaje (20 lat). Otrzymasz potwierdzenie: co usunięto, co zostaje i kiedy znikną kopie.':
    'Usuniemy Twoje dokumenty, wpisy i konto. Placówka musi zachować swoją dokumentację przez 20 lat. Dostaniesz potwierdzenie.',
  'Jednorazowe kody na wypadek utraty telefonu z aplikacją uwierzytelniającą. Zapisz je w bezpiecznym miejscu.': 'To zapasowe kody do logowania, gdy zgubisz telefon. Zapisz je w bezpiecznym miejscu.',
  'Klucz sprzętowy (np. YubiKey) albo klucz dostępu w telefonie może zastąpić kod z aplikacji przy logowaniu.': 'Zamiast kodu możesz logować się kluczem w telefonie albo kluczem USB.',
  'Telefon służy do SMS z linkami od placówki i do przypomnień — SMS nigdy nie zawiera danych o zdrowiu.': 'Na ten numer przyjdą SMS-y z placówki. SMS nigdy nie zawiera informacji o zdrowiu.',
  'Kod aktywacyjny otrzymasz w rejestracji po okazaniu dokumentu tożsamości. Połączy konto z Twoją kartoteką i od razu da dostęp do wyników.':
    'Kod dostaniesz w rejestracji, gdy pokażesz dowód osobisty. Dzięki niemu zobaczysz swoje wyniki.',
  'Jeśli konto istnieje, wysłaliśmy na podany adres link do ustawienia nowego hasła. Link jest ważny 60 minut.': 'Jeśli masz u nas konto, wysłaliśmy link do zmiany hasła. Link działa 60 minut.',
};
