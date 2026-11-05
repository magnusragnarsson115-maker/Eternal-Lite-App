/**
 * Numery pomocowe (F8.1, F8.4) — zapisane w aplikacji, żeby działały bez internetu; ekran i przycisk
 * nie dają się wyłączyć ani zasłonić. Ta sama lista co server/content/texts.ts (CRISIS_NUMBERS);
 * godziny 116 123 nie są podawane, bo źródła się różnią (sprawdzone 14.10.2026).
 */
export const CRISIS_NUMBERS: { number: string; pl: string; en: string; hours?: string }[] = [
  { number: '112', pl: 'Numer alarmowy (zagrożenie życia lub zdrowia)', en: 'Emergency number (threat to life or health)', hours: '24/7' },
  { number: '116 123', pl: 'Kryzysowy telefon zaufania dla dorosłych (bezpłatny)', en: 'Crisis helpline for adults (free)' },
  { number: '800 70 2222', pl: 'Centrum Wsparcia dla osób dorosłych w kryzysie psychicznym', en: 'Support centre for adults in mental health crisis', hours: '24/7' },
  { number: '116 111', pl: 'Telefon zaufania dla dzieci i młodzieży', en: 'Helpline for children and young people', hours: '24/7' },
  { number: '800 120 002', pl: 'Ogólnopolskie Pogotowie dla Ofiar Przemocy w Rodzinie „Niebieska Linia”', en: 'National helpline for victims of domestic violence (“Blue Line”)' },
];

export const telUrl = (n: string) => `tel:${n.replace(/\s+/g, '')}`;
