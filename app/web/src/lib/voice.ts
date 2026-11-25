/**
 * Sterowanie głosem (A17.10): rozpoznawanie mowy przeglądarki (Web Speech API) tylko do przechodzenia między
 * ekranami. Aplikacja nie zapisuje nagrań ani tekstu; polecenie „pomoc” otwiera ekran pomocy, ale nigdy nie
 * dzwoni sama. Gdy przeglądarka potrafi rozpoznawać na urządzeniu (processLocally), prosimy o to.
 */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type Ctor = new () => SpeechRecognitionLike;

function ctor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const speechSupported = (): boolean => !!ctor();

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');

/** Słowa kluczowe (bez polskich znaków) → ekran. Kolejność ma znaczenie: dłuższe frazy najpierw. */
export const VOICE_COMMANDS: { words: string[]; to: string; label: string }[] = [
  { words: ['umow', 'rezerw', 'book'], to: '/rezerwacja', label: 'Umów wizytę' },
  { words: ['wizyt', 'appointment'], to: '/wizyty', label: 'Wizyty' },
  { words: ['wynik', 'result'], to: '/wyniki', label: 'Wyniki od placówki' },
  { words: ['dokument', 'document'], to: '/dokumenty', label: 'Moje dokumenty' },
  { words: ['wiadomo', 'message'], to: '/wiadomosci', label: 'Wiadomości' },
  { words: ['pomiar', 'cisnieni', 'measurement'], to: '/pomiary', label: 'Pomiary' },
  { words: ['przypomn', 'reminder'], to: '/przypomnienia', label: 'Przypomnienia' },
  { words: ['aptek', 'refundac', 'pharmac'], to: '/apteki', label: 'Apteki i refundacja' },
  { words: ['lek', 'medic', 'medicine'], to: '/leki', label: 'Leki' },
  { words: ['dzienni', 'journal', 'diary'], to: '/dzienniki', label: 'Dzienniki' },
  { words: ['kalendarz', 'calendar'], to: '/kalendarz', label: 'Kalendarz zdrowia' },
  { words: ['powietrz', 'pogod', 'smog', 'weather', 'air'], to: '/powietrze', label: 'Powietrze i pogoda' },
  { words: ['profilakty', 'screening'], to: '/profilaktyka', label: 'Profilaktyka NFZ' },
  { words: ['plan', 'cwicz', 'exercise'], to: '/plan', label: 'Plan i cele' },
  { words: ['rodzin', 'family'], to: '/rodzina', label: 'Rodzina i opiekunowie' },
  { words: ['pomoc', 'sos', 'ratun', 'help', 'emergency'], to: '/pomoc', label: 'Pomoc · 112 · 116 123' },
  { words: ['powiadom', 'notification'], to: '/powiadomienia', label: 'Powiadomienia' },
  { words: ['start', 'glowna', 'pulpit', 'home'], to: '/', label: 'Start' },
];

export const BACK_WORDS = ['wstecz', 'wroc', 'cofnij', 'back'];

export function matchCommand(transcript: string): { to: string; label: string } | 'back' | undefined {
  const t = fold(transcript);
  if (BACK_WORDS.some((w) => t.includes(w))) return 'back';
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  for (const c of VOICE_COMMANDS) if (c.words.some((w) => words.some((x) => x.startsWith(w)))) return { to: c.to, label: c.label };
  return undefined;
}

/** Jedno nasłuchiwanie: zwraca rozpoznane alternatywy (najpierw najbardziej prawdopodobne). */
export function listenOnce(lang: string): { promise: Promise<string[]>; stop: () => void } {
  const C = ctor();
  if (!C) return { promise: Promise.reject(new Error('unsupported')), stop: () => undefined };
  const r = new C();
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 3;
  if ('processLocally' in r) r.processLocally = true;
  const promise = new Promise<string[]>((resolve, reject) => {
    let done = false;
    r.onresult = (e) => {
      done = true;
      const first = e.results[0];
      resolve(Array.from({ length: first.length }, (_, i) => first[i].transcript));
    };
    r.onerror = (e) => {
      done = true;
      reject(new Error(e.error));
    };
    r.onend = () => {
      if (!done) resolve([]);
    };
  });
  r.start();
  return { promise, stop: () => r.stop() };
}
