/**
 * Teksty, które chronią granicę „bez wyrobu medycznego” i podstawę przetwarzania (A18.3, A19.1, F1.3, A18.1).
 * Każdy tekst ma wersję — zgoda zapisuje wersję treści, którą pacjent widział. Zmiana treści = nowa wersja.
 * [ZAŁ.] Brzmienie do zatwierdzenia przez prawnika (plik 12.8, krok 8 w 042 §5.3).
 */

export type Lang = 'pl' | 'en';

export interface VersionedText {
  version: string;
  title: Record<Lang, string>;
  paragraphs: Record<Lang, string[]>;
}

export const PURPOSE_TEXT: VersionedText = {
  version: 'przeznaczenie/2026-10-1',
  title: { pl: 'Do czego służy ta strona', en: 'What this page is for' },
  paragraphs: {
    pl: [
      'Ta strona służy wyłącznie do przekazania placówce Twoich dokumentów medycznych (wyników badań, wypisów, opisów badań) przed wizytą i do odebrania karty „Po wizycie”.',
      'Strona niczego nie ocenia: nie interpretuje wyników, nie stawia rozpoznań i nie udziela porad. Wartości, jednostki, zakresy referencyjne i oznaczenia są przepisywane z dokumentu laboratorium.',
      'Odczyt dokumentu wykonuje program — może się pomylić. Dlatego prosimy o potwierdzenie albo poprawienie odczytanych pól. Pola niepotwierdzone lekarz zobaczy z oznaczeniem „odczyt maszynowy, niepotwierdzony”.',
      'W nagłym zagrożeniu życia lub zdrowia dzwoń pod 112. W kryzysie psychicznym: 116 123 (bezpłatnie) albo 800 70 2222 (całodobowo).',
    ],
    en: [
      'This page is only for sending your medical documents (test results, discharge summaries, imaging reports) to the clinic before your visit and for receiving your after-visit card.',
      'The page does not assess anything: it does not interpret results, make diagnoses or give advice. Values, units, reference ranges and flags are copied from the laboratory document.',
      'Documents are read by software, which can make mistakes. Please confirm or correct the fields that were read. Unconfirmed fields will be shown to the doctor marked “machine-read, unconfirmed”.',
      'In a life-threatening emergency call 112. In a mental health crisis call 116 123 (free of charge) or 800 70 2222 (24/7).',
    ],
  },
};

export const LINK_CONSENT_TEXT: VersionedText = {
  version: 'zgoda-link/2026-10-1',
  title: { pl: 'Zgoda na udostępnienie dokumentów placówce', en: 'Consent to share documents with the clinic' },
  paragraphs: {
    pl: [
      'Cel: przygotowanie lekarza do Twojej wizyty w placówce {clinic}.',
      'Zakres: dokumenty i zdjęcia, które dodasz na tej stronie, oraz odczytane z nich wartości.',
      'Odbiorca: wyłącznie placówka {clinic} (lekarz i rejestracja). Nikt inny nie otrzyma dostępu.',
      'Czas: do {until}. Po tym terminie placówka traci dostęp do tej skrzynki (dokumenty włączone przez lekarza do dokumentacji medycznej placówka przechowuje zgodnie z prawem).',
      'Jak odwołać: w każdej chwili przyciskiem „Wycofaj zgodę” na tej stronie — dostęp wygasa natychmiast. Wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.',
      'Administrator danych: {clinic}. Podstawa: Twoja wyraźna zgoda (art. 9 ust. 2 lit. a RODO). Pod tym samym linkiem zobaczysz, kto i kiedy oglądał Twoje dokumenty.',
    ],
    en: [
      'Purpose: preparing the doctor for your visit at {clinic}.',
      'Scope: documents and photos you add on this page and the values read from them.',
      'Recipient: only {clinic} (the doctor and the front desk). Nobody else will get access.',
      'Duration: until {until}. After that date the clinic loses access to this inbox (documents the doctor includes in your medical records are kept by the clinic as required by law).',
      'How to withdraw: at any time with the “Withdraw consent” button on this page — access ends immediately. Withdrawal does not affect the lawfulness of earlier processing.',
      'Data controller: {clinic}. Legal basis: your explicit consent (Art. 9(2)(a) GDPR). Under the same link you can see who viewed your documents and when.',
    ],
  },
};

export const AI_NOTICE: VersionedText = {
  version: 'ai/2026-10-1',
  title: { pl: 'Treści przygotowane z udziałem AI', en: 'Content prepared with AI' },
  paragraphs: {
    pl: [
      'Odczyt dokumentów, szkic notatki z wizyty i karta „Po wizycie” są przygotowywane z udziałem programu i modelu językowego (AI).',
      'Model przepisuje i porządkuje treść źródła — nie ocenia stanu zdrowia. Szkic notatki i kartę zawsze sprawdza i zatwierdza lekarz; dopiero wtedy trafiają do dokumentacji i do Ciebie.',
      'Treści przygotowane z udziałem AI mają oznaczenie „przygotowane przez AI, zatwierdzone przez lekarza” (art. 50 aktu o sztucznej inteligencji).',
    ],
    en: [
      'Reading documents, the draft visit note and the after-visit card are prepared with software and a language model (AI).',
      'The model copies and organises the source content — it does not assess your health. The doctor always reviews and approves the draft note and the card before they become part of the records or reach you.',
      'Content prepared with AI is labelled “prepared by AI, approved by the doctor” (Article 50 of the AI Act).',
    ],
  },
};

export const APP_INSTRUCTIONS: VersionedText = {
  version: 'instrukcja/2026-10-1',
  title: { pl: 'Instrukcja używania aplikacji', en: 'Instructions for use' },
  paragraphs: {
    pl: [
      'Dokumenty: „Dodaj dokument” → zdjęcie (aparat) albo plik PDF. Po kilku sekundach zobaczysz odczytane pola obok wiersza z dokumentu. Pola na żółto sprawdź: „Zgadza się” albo „Popraw”. Potem „Zapisz w moich dokumentach”.',
      'Udostępnianie: „Komu udostępniam” → wybierz placówkę (i lekarza), zakres (wszystko, wyniki, dokumenty albo wybrane) i czas. „Wycofaj” natychmiast odbiera dostęp. „Kto oglądał” pokazuje każdy odczyt Twoich danych.',
      'Wpisy ręczne: „Pomiary” → „Dodaj pomiar” (parametr z listy, wartość, jednostka, data). Korekta zostawia poprzednią wartość w historii z powodem zmiany.',
      'Karta „Po wizycie”: pojawia się po zatwierdzeniu przez lekarza; możesz pobrać PDF albo udostępnić ją osobie bliskiej na określony czas.',
      'Pomoc: w menu „Pomoc” zawsze znajdziesz numery 112 i 116 123 oraz przycisk SOS.',
      'Aplikacja nie ocenia wyników i pomiarów, nie stawia rozpoznań i nie zastępuje porady lekarza.',
    ],
    en: [
      'Documents: “Add document” → photo (camera) or a PDF file. After a few seconds you will see the fields read next to the line from the document. Check the fields marked yellow: “Correct” or “Fix”. Then “Save to my documents”.',
      'Sharing: “Who I share with” → choose a clinic (and doctor), the scope (everything, results, documents or selected) and the duration. “Withdraw” ends access immediately. “Who viewed” shows every access to your data.',
      'Manual entries: “Measurements” → “Add measurement” (parameter from the list, value, unit, date). A correction keeps the previous value in the history together with the reason.',
      'After-visit card: appears once the doctor approves it; you can download a PDF or share it with a close person for a limited time.',
      'Help: the “Help” menu always contains the 112 and 116 123 numbers and the SOS button.',
      'The app does not assess results or measurements, does not diagnose and does not replace medical advice.',
    ],
  },
};

export function renderText(t: VersionedText, lang: Lang, vars: Record<string, string> = {}) {
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return { version: t.version, title: fill(t.title[lang]), paragraphs: t.paragraphs[lang].map(fill) };
}

/**
 * Numery pomocowe (F8.1, F8.4) — lista stała, bez przełącznika. Godziny podane tylko tam, gdzie źródła są zgodne
 * (sprawdzone 14.10.2026; godziny 116 123 różnią się w źródłach — operator potwierdza przed wydaniem).
 */
export const CRISIS_NUMBERS: { number: string; pl: string; en: string; hours?: string }[] = [
  { number: '112', pl: 'Numer alarmowy (zagrożenie życia lub zdrowia)', en: 'Emergency number (threat to life or health)', hours: '24/7' },
  { number: '116 123', pl: 'Kryzysowy telefon zaufania dla dorosłych (bezpłatny)', en: 'Crisis helpline for adults (free)' },
  { number: '800 70 2222', pl: 'Centrum Wsparcia dla osób dorosłych w kryzysie psychicznym', en: 'Support centre for adults in mental health crisis', hours: '24/7' },
  { number: '116 111', pl: 'Telefon zaufania dla dzieci i młodzieży', en: 'Helpline for children and young people', hours: '24/7' },
  { number: '800 120 002', pl: 'Ogólnopolskie Pogotowie dla Ofiar Przemocy w Rodzinie „Niebieska Linia”', en: 'National helpline for victims of domestic violence (“Blue Line”)' },
];
