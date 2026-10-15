import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, post, put, setCsrfToken, setOnAuthLost } from './api';
import { applyA11y, loadLocalA11y, watchSystemContrast, type A11yPrefs } from './lib/a11y';
import { setClinicTimezone, useI18n } from './i18n';
import type { Me, PublicConfig } from './types';

interface Session {
  me: Me | undefined;
  config: PublicConfig | undefined;
  loading: boolean;
  refresh: () => Promise<unknown>;
  setMe: (me: Me) => void;
  logout: () => Promise<void>;
  /** Ustawienia czytelności: z konta po zalogowaniu, przed zalogowaniem — zapamiętane w przeglądarce. */
  a11y: A11yPrefs;
  saveA11y: (p: A11yPrefs) => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { setLocale, setSimple } = useI18n();
  const [localA11y, setLocalA11y] = useState<A11yPrefs>(loadLocalA11y);
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/api/auth/me'), staleTime: 30_000 });
  const cfgQ = useQuery({ queryKey: ['public-config'], queryFn: () => get<PublicConfig>('/api/public/config'), staleTime: 300_000 });

  useEffect(() => {
    setCsrfToken(meQ.data?.csrfToken);
  }, [meQ.data?.csrfToken]);

  useEffect(() => {
    setClinicTimezone(cfgQ.data?.timezone);
  }, [cfgQ.data?.timezone]);

  useEffect(() => {
    if (meQ.data?.user?.locale) setLocale(meQ.data.user.locale);
  }, [meQ.data?.user?.locale, setLocale]);

  const serverA11y = meQ.data?.user?.a11y;
  const a11y = serverA11y ?? localA11y;
  useEffect(() => {
    applyA11y(a11y);
    setSimple(a11y.simpleLanguage);
    return watchSystemContrast(() => applyA11y(a11y));
  }, [a11y, setSimple]);

  const saveA11y = useCallback(
    async (p: A11yPrefs) => {
      setLocalA11y(p);
      const me = qc.getQueryData<Me>(['me']);
      if (me?.authenticated && me.user) {
        qc.setQueryData<Me>(['me'], { ...me, user: { ...me.user, a11y: p } });
        await put('/api/auth/a11y', p);
      }
    },
    [qc],
  );

  useEffect(() => {
    setOnAuthLost(() => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    });
  }, [qc]);

  const setMe = useCallback(
    (me: Me) => {
      setCsrfToken(me.csrfToken);
      qc.setQueryData(['me'], me);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout');
    } finally {
      setCsrfToken(undefined);
      qc.clear();
      qc.setQueryData(['me'], { authenticated: false });
    }
  }, [qc]);

  return (
    <Ctx.Provider value={{ me: meQ.data, config: cfgQ.data, loading: meQ.isLoading || cfgQ.isLoading, refresh: () => meQ.refetch(), setMe, logout, a11y, saveA11y }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}

export function hasRole(me: Me | undefined, ...roles: string[]): boolean {
  return !!me?.user?.roles.some((r) => roles.includes(r));
}
