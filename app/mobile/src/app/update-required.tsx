import { useQuery } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';
import { Button, Notice, P, Screen } from '../components/ui';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';

/** Kontrolowana dystrybucja aktualizacji (A18.7): serwer podaje najniższą obsługiwaną wersję aplikacji. */
export default function UpdateRequiredScreen() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['app-version'], queryFn: () => get<{ minimum: string; latest: string; storeUrl?: { ios?: string; android?: string } }>('/api/public/app-version') });
  const url = Platform.OS === 'ios' ? q.data?.storeUrl?.ios : q.data?.storeUrl?.android;
  return (
    <Screen>
      <Notice kind="warn">{t('Ta wersja aplikacji nie jest już obsługiwana. Zaktualizuj aplikację, aby dalej z niej korzystać.')}</Notice>
      {q.data ? <P muted>{t('Najniższa obsługiwana wersja: {v}', { v: q.data.minimum })}</P> : null}
      {url ? <Button title={t('Przejdź do sklepu')} onPress={() => void Linking.openURL(url)} /> : null}
    </Screen>
  );
}
