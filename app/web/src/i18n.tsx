import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EN } from './i18n-en';

export type Locale = 'pl' | 'en';

const STORAGE_KEY = 'eternal.locale';

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pl' || saved === 'en') return saved;
  } catch {
    /* brak dostępu do localStorage */
  }
  return navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : navigator.language ? 'en' : 'pl';
}

let clinicTz = 'Europe/Warsaw';
export function setClinicTimezone(tz: string | undefined): void {
  if (tz) clinicTz = tz;
}

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Teksty źródłowe są po polsku; słownik EN mapuje polski tekst na angielski. */
  t: (text: string, vars?: Record<string, string | number>) => string;
  fmt: {
    date: (iso: string | undefined) => string;
    dateLong: (iso: string | undefined) => string;
    time: (iso: string | undefined) => string;
    dateTime: (iso: string | undefined) => string;
    weekday: (iso: string) => string;
    dayNum: (iso: string) => string;
    relative: (iso: string) => string;
    money: (v: number | undefined) => string;
    number: (v: number | undefined, digits?: number) => string;
  };
}

const Ctx = createContext<I18n | null>(null);

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignorujemy */
    }
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18n>(() => {
    const tag = locale === 'pl' ? 'pl-PL' : 'en-GB';
    const opts = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: clinicTz, ...o });
    const dDate = opts({ day: 'numeric', month: 'short', year: 'numeric' });
    const dLong = opts({ weekday: 'long', day: 'numeric', month: 'long' });
    const dTime = opts({ hour: '2-digit', minute: '2-digit' });
    const dDateTime = opts({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const dWeekday = opts({ weekday: 'short' });
    const dDay = opts({ day: 'numeric' });
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    const safe = (f: Intl.DateTimeFormat) => (iso: string | undefined) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '—' : f.format(d);
    };
    return {
      locale,
      setLocale,
      t: (text, vars) => interpolate(locale === 'en' ? (EN[text] ?? text) : text, vars),
      fmt: {
        date: safe(dDate),
        dateLong: (iso) => {
          const v = safe(dLong)(iso);
          return v.charAt(0).toLocaleUpperCase(tag) + v.slice(1);
        },
        time: safe(dTime),
        dateTime: safe(dDateTime),
        weekday: (iso) => dWeekday.format(new Date(iso)),
        dayNum: (iso) => dDay.format(new Date(iso)),
        relative: (iso) => {
          const diff = (Date.parse(iso) - Date.now()) / 1000;
          const abs = Math.abs(diff);
          if (abs < 60) return rtf.format(Math.round(diff), 'second');
          if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
          if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
          return rtf.format(Math.round(diff / 86400), 'day');
        },
        money: (v) => (v === undefined ? '—' : new Intl.NumberFormat(tag, { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v)),
        number: (v, digits = 1) => (v === undefined ? '—' : new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(v)),
      },
    };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}

/** Data kalendarzowa (YYYY-MM-DD) w strefie placówki. */
export function clinicDate(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: clinicTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function clinicMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: clinicTz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
