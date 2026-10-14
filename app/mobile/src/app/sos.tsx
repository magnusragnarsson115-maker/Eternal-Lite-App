import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';
import { Button, Card, Empty, Notice, P, Row, Screen } from '../components/ui';
import { get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';

interface Emergency {
  contacts: { id: string; name: string; phone: string; relation?: string }[];
}

/** Ratunek jednym kliknięciem (P14): 112 zawsze pierwsze; powiadomienie osób bliskich z linkiem do karty ratunkowej. */
export default function SosScreen() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['emergency'], queryFn: () => get<Emergency>('/api/me/emergency') });
  const sos = useMutation({ mutationFn: () => post<{ notified: number }>('/api/me/sos', {}) });
  return (
    <Screen>
      <Button title={t('Zadzwoń 112')} variant="danger" accessibilityHint={t('Numer alarmowy — zagrożenie życia lub zdrowia')} onPress={() => void Linking.openURL('tel:112')} />
      <Card title={t('Powiadom osoby bliskie')}>
        <P small muted>
          {t('Osoby bliskie dostaną SMS z linkiem do Twojej karty ratunkowej (ważny 24 godziny). Każde otwarcie karty zobaczysz w dzienniku.')}
        </P>
        {q.data?.contacts.length ? (
          q.data.contacts.map((c) => <Row key={c.id} title={c.name} sub={[c.relation, c.phone].filter(Boolean).join(' · ')} />)
        ) : (
          <Empty title={t('Nie dodano osób bliskich — dodasz je w aplikacji w przeglądarce (Bezpieczeństwo).')} />
        )}
        <Button
          title={t('Wyślij SOS do osób bliskich')}
          variant="danger"
          disabled={!q.data?.contacts.length}
          loading={sos.isPending}
          onPress={() =>
            Alert.alert(t('Wysłać SOS?'), t('Osoby bliskie dostaną SMS z linkiem do Twojej karty ratunkowej.'), [
              { text: t('Anuluj'), style: 'cancel' },
              { text: t('Wyślij'), style: 'destructive', onPress: () => sos.mutate() },
            ])
          }
        />
        {sos.data ? <Notice kind="ok">{t('Powiadomiono osoby: {n}.', { n: sos.data.notified })}</Notice> : null}
        {sos.isError ? <Notice kind="danger">{errorMessage(sos.error, t)}</Notice> : null}
      </Card>
      <Button title={t('Numery pomocowe')} variant="secondary" onPress={() => router.push('/crisis')} />
    </Screen>
  );
}
