import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { put } from './api';

/**
 * Czytelność (A23.2/A23.3) — to samo ustawienie konta co w przeglądarce: rozmiar tekstu (mnożnik ponad
 * systemowy rozmiar czcionki), wysoki kontrast (także według ustawienia systemu) i prosty język.
 */

export interface A11yPrefs {
  textScale: 100 | 125 | 150 | 200;
  contrast: 'system' | 'high' | 'standard';
  simpleLanguage: boolean;
}

export const DEFAULT_A11Y: A11yPrefs = { textScale: 100, contrast: 'system', simpleLanguage: false };

let prefs: A11yPrefs = DEFAULT_A11Y;
let systemHigh = false;
let snapshot = { prefs, highContrast: false, scale: 1 };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { prefs, highContrast: prefs.contrast === 'high' || (prefs.contrast === 'system' && systemHigh), scale: prefs.textScale / 100 };
  for (const l of listeners) l();
}

export function setA11y(p: A11yPrefs | undefined): void {
  prefs = p ?? DEFAULT_A11Y;
  emit();
}

/** Zapis na koncie; widoczny od razu, także w przeglądarce po odświeżeniu. */
export async function saveA11y(p: A11yPrefs): Promise<void> {
  setA11y(p);
  await put('/api/auth/a11y', p);
}

// „Zwiększ kontrast” (iOS) / „Tekst o wysokim kontraście” (Android)
const query = Platform.OS === 'ios' ? AccessibilityInfo.isDarkerSystemColorsEnabled : AccessibilityInfo.isHighTextContrastEnabled;
void query?.()
  .then((v) => {
    systemHigh = v;
    emit();
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener(Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged', (v: boolean) => {
  systemHigh = v;
  emit();
});

export function useA11y() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

/** Rozmiar czcionki z mnożnikiem z konta (systemowe powiększenie stosuje React Native osobno). */
export function useFontSize(): (size: number) => number {
  const { scale } = useA11y();
  return (size: number) => Math.round(size * scale);
}
