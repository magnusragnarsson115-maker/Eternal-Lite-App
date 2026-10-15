import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading, Screen } from '../components/ui';
import { I18nProvider, useI18n } from '../lib/i18n';
import { getLocale } from '../lib/secure';
import { SessionProvider, useSession } from '../lib/session';
import { useColors } from '../lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <Gate />
          </SessionProvider>
        </QueryClientProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/** Ekrany dostępne zależnie od stanu sesji; numery pomocowe — zawsze, także przed zalogowaniem (F8.1). */
function Gate() {
  const { phase, me } = useSession();
  const { t, setLocale } = useI18n();
  const c = useColors();

  useEffect(() => {
    void getLocale().then((l) => l && setLocale(l));
  }, [setLocale]);
  useEffect(() => {
    if (me?.user?.locale) setLocale(me.user.locale);
  }, [me?.user?.locale, setLocale]);

  if (phase === 'loading') {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const ready = phase === 'ready';
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTintColor: c.primary, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.ink }, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={phase === 'update-required'}>
          <Stack.Screen name="update-required" options={{ title: t('Wymagana aktualizacja'), headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'signed-out' || phase === 'mfa'}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'pin-setup'}>
          <Stack.Screen name="pin-setup" options={{ title: t('Zabezpiecz aplikację'), headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'locked'}>
          <Stack.Screen name="lock" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="intake/[id]" options={{ title: t('Sprawdź odczyt') }} />
          <Stack.Screen name="card/[id]" options={{ title: t('Karta „Po wizycie”') }} />
          <Stack.Screen name="sos" options={{ title: t('Ratunek') }} />
          <Stack.Screen name="security" options={{ title: t('Bezpieczeństwo konta') }} />
          <Stack.Screen name="devices" options={{ title: t('Zalogowane urządzenia') }} />
          <Stack.Screen name="about" options={{ title: t('Do czego służy aplikacja') }} />
          <Stack.Screen name="delete-data" options={{ title: t('Usuń moje dane') }} />
          <Stack.Screen name="measurements" options={{ title: t('Pomiary') }} />
          <Stack.Screen name="timeline" options={{ title: t('Oś czasu wyników') }} />
          <Stack.Screen name="notifications" options={{ title: t('Powiadomienia') }} />
          <Stack.Screen name="share-new" options={{ title: t('Nowe udostępnienie') }} />
        </Stack.Protected>
        <Stack.Screen name="crisis" options={{ title: t('Numery pomocowe'), presentation: ready ? 'card' : 'modal' }} />
      </Stack>
    </>
  );
}
