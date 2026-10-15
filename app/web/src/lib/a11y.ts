/**
 * Czytelność (A23.2/A23.3): rozmiar tekstu, kontrast i prosty język. Ustawienie z konta jest stosowane
 * na elemencie <html> (atrybuty data-*) i zapamiętane lokalnie, żeby działało już na ekranie logowania.
 */

export interface A11yPrefs {
  textScale: 100 | 125 | 150 | 200;
  contrast: 'system' | 'high' | 'standard';
  simpleLanguage: boolean;
}

export const DEFAULT_A11Y: A11yPrefs = { textScale: 100, contrast: 'system', simpleLanguage: false };
const KEY = 'eternal.a11y';
const SCALES = [100, 125, 150, 200];

export function loadLocalA11y(): A11yPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<A11yPrefs> | null;
    if (!raw) return DEFAULT_A11Y;
    return {
      textScale: SCALES.includes(Number(raw.textScale)) ? (Number(raw.textScale) as A11yPrefs['textScale']) : 100,
      contrast: raw.contrast === 'high' || raw.contrast === 'standard' ? raw.contrast : 'system',
      simpleLanguage: raw.simpleLanguage === true,
    };
  } catch {
    return DEFAULT_A11Y;
  }
}

const systemHighContrast = () => typeof matchMedia === 'function' && (matchMedia('(prefers-contrast: more)').matches || matchMedia('(forced-colors: active)').matches);

export function applyA11y(p: A11yPrefs): void {
  const root = document.documentElement;
  if (p.textScale === 100) delete root.dataset.textScale;
  else root.dataset.textScale = String(p.textScale);
  const high = p.contrast === 'high' || (p.contrast === 'system' && systemHighContrast());
  if (high) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  if (p.simpleLanguage) root.dataset.simple = 'on';
  else delete root.dataset.simple;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* brak dostępu do localStorage */
  }
}

/** Zmiana kontrastu w systemie w trakcie pracy (tryb „według systemu”). */
export function watchSystemContrast(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;
  const mq = matchMedia('(prefers-contrast: more)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
