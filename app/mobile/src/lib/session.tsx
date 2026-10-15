import * as Application from 'expo-application';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiError, get, post, setUnauthorizedHandler } from './api';
import { registerPush } from './push';
import * as secure from './secure';
import type { Me } from './types';
import { clearDownloads } from './files';

/** Blokada po powrocie z tła: po tylu sekundach wymagamy biometrii albo PIN-u. */
const LOCK_AFTER_SECONDS = 60;

export type Phase = 'loading' | 'update-required' | 'signed-out' | 'mfa' | 'pin-setup' | 'locked' | 'ready';

interface Session {
  phase: Phase;
  me?: Me;
  error?: string;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  /** Po pierwszym logowaniu: ustawienie PIN-u i (opcjonalnie) biometrii. */
  finishPinSetup: (pin: string, biometrics: boolean) => Promise<void>;
  unlock: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [me, setMe] = useState<Me>();
  const backgroundAt = useRef<number | undefined>(undefined);

  const signOutLocal = useCallback(async () => {
    clearDownloads(); // pobrane PDF z danymi o zdrowiu nie zostają po wylogowaniu
    await secure.wipe();
    setMe(undefined);
    setPhase('signed-out');
  }, []);

  const afterAuth = useCallback(async (m: Me) => {
    setMe(m);
    if (m.mfa?.required) return setPhase('mfa');
    if (!(await secure.hasPin())) return setPhase('pin-setup');
    setPhase('ready');
    void registerPush();
  }, []);

  // start: sprawdzenie wymaganej wersji (A18.7), potem sesja z tokenu w schowku systemu
  useEffect(() => {
    setUnauthorizedHandler(() => void signOutLocal());
    void (async () => {
      try {
        const v = await get<{ minimum: string }>('/api/public/app-version');
        const current = Application.nativeApplicationVersion ?? '0.0.0';
        if (compareVersions(current, v.minimum) < 0) return setPhase('update-required');
      } catch {
        // brak sieci: aplikacja działa dalej, serwer i tak odrzuci nieobsługiwane żądania
      }
      const token = await secure.getToken();
      if (!token) return setPhase('signed-out');
      try {
        const m = await get<Me>('/api/auth/me');
        if (!m.authenticated) return signOutLocal();
        setMe(m);
        if (m.mfa?.required) return setPhase('mfa');
        setPhase((await secure.hasPin()) ? 'locked' : 'pin-setup');
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) return setPhase((await secure.hasPin()) ? 'locked' : 'signed-out');
        await signOutLocal();
      }
    })();
  }, [signOutLocal]);

  // blokada po powrocie z tła; w tle ekran aplikacji jest zasłaniany przez system (podgląd w przełączniku aplikacji)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current) {
        const away = (Date.now() - backgroundAt.current) / 1000;
        backgroundAt.current = undefined;
        setPhase((p) => (p === 'ready' && away > LOCK_AFTER_SECONDS ? 'locked' : p));
      }
    });
    return () => sub.remove();
  }, []);

  const value: Session = {
    phase,
    me,
    login: async (email, password) => {
      const m = await post<Me>('/api/auth/login', { email, password, client: 'mobile' });
      if (!m.token) throw new ApiError(400, 'staff_use_password');
      await secure.setToken(m.token);
      await afterAuth(m);
    },
    verifyMfa: async (code) => {
      const m = await post<Me>('/api/auth/mfa/verify', { code });
      await afterAuth(m);
    },
    finishPinSetup: async (pin, biometrics) => {
      await secure.setPin(pin);
      await secure.setBiometrics(biometrics);
      setPhase('ready');
      void registerPush();
    },
    unlock: () => {
      setPhase('ready');
      void registerPush();
    },
    logout: async () => {
      await post('/api/auth/logout').catch(() => undefined);
      await signOutLocal();
    },
    refresh: async () => {
      setMe(await get<Me>('/api/auth/me'));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
