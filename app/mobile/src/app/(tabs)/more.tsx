import * as Application from 'expo-application';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Button, Card, P, Row, Screen } from '../../components/ui';
import { put } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { setLocale as saveLocale } from '../../lib/secure';
import { useSession } from '../../lib/session';

export default function MoreScreen() {
  const { t, locale, setLocale } = useI18n();
  const { logout, me } = useSession();
  const switchLocale = () => {
    const next = locale === 'pl' ? 'en' : 'pl';
    setLocale(next);
    void saveLocale(next);
    void put('/api/auth/locale', { locale: next }).catch(() => undefined);
  };
  return (
    <Screen>
      <Card title={t('Pomoc i bezpieczeństwo')}>
        <Row title={t('Ratunek — SOS')} sub={t('112, osoby bliskie, karta ratunkowa')} onPress={() => router.push('/sos')} />
        <Row title={t('Numery pomocowe')} sub="112 · 116 123 · 800 70 2222 · 116 111" onPress={() => router.push('/crisis')} />
      </Card>
      <Card title={t('Zdrowie i powiadomienia')}>
        <Row title={t('Pomiary')} sub={t('Wpisy ręczne i korekta z historią')} onPress={() => router.push('/measurements')} />
        <Row title={t('Oś czasu wyników')} sub={t('Każda wartość z pochodzeniem i wersjami')} onPress={() => router.push('/timeline')} />
        <Row title={t('Powiadomienia')} sub={t('Rodzaje i godziny ciszy')} onPress={() => router.push('/notifications')} />
      </Card>
      <Card title={t('Konto')}>
        <Row title={me?.user?.displayName ?? ''} sub={me?.user?.email} />
        <Row title={t('Bezpieczeństwo konta')} sub={t('Biometria, PIN, logowanie dwuskładnikowe')} onPress={() => router.push('/security')} />
        <Row title={t('Zalogowane urządzenia')} sub={t('Najwyżej 5 urządzeń jednocześnie')} onPress={() => router.push('/devices')} />
        <Row title={t('Język')} sub={locale === 'pl' ? 'Polski' : 'English'} right={<Button title={locale === 'pl' ? 'English' : 'Polski'} variant="ghost" onPress={switchLocale} />} />
      </Card>
      <Card title={t('O aplikacji')}>
        <Row title={t('Do czego służy aplikacja')} sub={t('Co robi, czego nie robi, wersja instrukcji')} onPress={() => router.push('/about')} />
        <Row title={t('Usuń moje dane')} sub={t('Z potwierdzeniem, co usunięto i co musi zostać')} onPress={() => router.push('/delete-data')} />
        <P small muted>
          {t('Wersja {v}', { v: Application.nativeApplicationVersion ?? '—' })}
        </P>
      </Card>
      <Button
        title={t('Wyloguj')}
        variant="secondary"
        onPress={() =>
          Alert.alert(t('Wylogować?'), t('Na tym telefonie zostaną usunięte token sesji i PIN.'), [
            { text: t('Anuluj'), style: 'cancel' },
            { text: t('Wyloguj'), style: 'destructive', onPress: () => void logout() },
          ])
        }
      />
    </Screen>
  );
}
