import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card, Empty, Loading, P, Row, Screen } from '../../components/ui';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import type { CardView } from '../../lib/types';

/** Karty „Po wizycie” (D5): co zrobiono, co dalej, kiedy wrócić — zatwierdzone przez lekarza. */
export default function CardsScreen() {
  const { t, dateTime } = useI18n();
  const q = useQuery({ queryKey: ['cards'], queryFn: () => get<{ items: CardView[] }>('/api/me/cards') });
  return (
    <Screen>
      <P muted>{t('Co zrobiono, co dalej i kiedy wrócić — zatwierdzone przez lekarza.')}</P>
      <Card>
        {q.isLoading ? (
          <Loading />
        ) : !q.data?.items.length ? (
          <Empty title={t('Nie masz jeszcze kart po wizycie')} />
        ) : (
          q.data.items.map((c) => <Row key={c.id} title={c.clinic} sub={`${c.doctor} · ${dateTime(c.date)}`} onPress={() => router.push(`/card/${c.id}`)} />)
        )}
      </Card>
    </Screen>
  );
}
