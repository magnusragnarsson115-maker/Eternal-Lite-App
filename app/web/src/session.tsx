import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { get, post, setCsrfToken, setOnAuthLost } from './api';
import { setClinicTimezone, useI18n } from './i18n';
import type { Me, PublicConfig } from './types';

interface Session {
  me: Me | undefined;
  config: PublicConfig | undefined;
  loading: boolean;
  refresh: () => Promise<unknown>;
  setMe: (me: Me) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { setLocale } = useI18n();
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
    <Ctx.Provider value={{ me: meQ.data, config: cfgQ.data, loading: meQ.isLoading || cfgQ.isLoading, refresh: () => meQ.refetch(), setMe, logout }}>
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
