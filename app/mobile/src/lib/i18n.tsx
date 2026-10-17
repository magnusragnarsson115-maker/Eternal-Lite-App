import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EN } from '../i18n-en';
import { SIMPLE } from '../simple-pl';
import { useA11y } from './a11y';

export type Locale = 'pl' | 'en';

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (pl: string, vars?: Record<string, string | number>) => string;
  date: (iso?: string) => string;
  dateTime: (iso?: string) => string;
}

const Ctx = createContext<I18n | null>(null);

/** Teksty interfejsu po polsku; tłumaczenie EN w src/i18n-en.ts (test kompletności: tests/unit/i18n.test.ts). */
export function I18nProvider({ children, initial = 'pl' }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial);
  const simple = useA11y().prefs.simpleLanguage;
  const t = useCallback(
    (pl: string, vars?: Record<string, string | number>) => {
      const text = simple ? (SIMPLE[pl] ?? pl) : pl; // A23.2 — prosty język
      const s = locale === 'en' ? (EN[text] ?? text) : text;
      return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m)) : s;
    },
    [locale, simple],
  );
  const value = useMemo<I18n>(() => {
    const tag = locale === 'pl' ? 'pl-PL' : 'en-GB';
    const opts = { timeZone: 'Europe/Warsaw' } as const;
    return {
      locale,
      setLocale,
      t,
      date: (iso) => (iso ? new Date(iso).toLocaleDateString(tag, { ...opts, day: 'numeric', month: 'long', year: 'numeric' }) : ''),
      dateTime: (iso) => (iso ? new Date(iso).toLocaleString(tag, { ...opts, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''),
    };
  }, [locale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}
