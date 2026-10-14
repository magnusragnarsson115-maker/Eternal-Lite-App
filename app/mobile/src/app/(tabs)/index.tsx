import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, H1, P, Row } from '../../components/ui';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { space, useColors } from '../../lib/theme';
import type { CardView, IntakeView } from '../../lib/types';

interface Appointment {
  id: string;
  status: string;
  start: string;
  serviceName?: string;
  practitionerName?: string;
  locationName?: string;
  mode: 'in-person' | 'tele';
}

export default function HomeScreen() {
  const { me } = useSession();
  const { t, dateTime } = useI18n();
  const c = useColors();
  const appts = useQuery({ queryKey: ['appointments'], queryFn: () => get<{ items: Appointment[] }>('/api/me/appointments') });
  const intake = useQuery({ queryKey: ['intake'], queryFn: () => get<{ items: IntakeView[] }>('/api/me/intake') });
  const cards = useQuery({ queryKey: ['cards'], queryFn: () => get<{ items: CardView[] }>('/api/me/cards') });
  const next = appts.data?.items.filter((a) => ['booked', 'pending', 'arrived'].includes(a.status) && Date.parse(a.start) > Date.now() - 3600_000).sort((a, b) => a.start.localeCompare(b.start))[0];
  const toReview = intake.data?.items.filter((i) => i.status === 'needs_review').length ?? 0;
  const refreshing = appts.isRefetching || intake.isRefetching || cards.isRefetching;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(10) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([appts.refetch(), intake.refetch(), cards.refetch()])} />}
      >
        <H1>{t('Dzień dobry, {n}', { n: me?.user?.displayName.split(' ')[0] ?? '' })}</H1>

        <Card title={t('Najbliższa wizyta')}>
          {next ? (
            <View style={{ gap: space(1) }}>
              <P>{dateTime(next.start)}</P>
              <P muted>{[next.serviceName, next.practitionerName, next.mode === 'tele' ? t('wizyta wideo') : next.locationName].filter(Boolean).join(' · ')}</P>
              <Button title={t('Dodaj dokumenty przed wizytą')} variant="secondary" onPress={() => router.push('/documents')} />
            </View>
          ) : (
            <P muted>{t('Brak zaplanowanych wizyt.')}</P>
          )}
        </Card>

        {toReview > 0 ? (
          <Card>
            <Row title={t('Dokumenty do sprawdzenia')} sub={t('Potwierdź odczyt, zanim zobaczy go lekarz.')} right={<Badge kind="warn">{toReview}</Badge>} onPress={() => router.push('/documents')} />
          </Card>
        ) : null}

        {cards.data?.items[0] ? (
          <Card title={t('Ostatnia karta „Po wizycie”')}>
            <Row title={cards.data.items[0].clinic} sub={`${cards.data.items[0].doctor} · ${dateTime(cards.data.items[0].date)}`} onPress={() => router.push(`/card/${cards.data!.items[0].id}`)} />
          </Card>
        ) : null}

        <Button title={t('Ratunek — SOS')} variant="danger" accessibilityHint={t('Połączenie z 112 i powiadomienie osób bliskich')} onPress={() => router.push('/sos')} />
        <Button title={t('Numery pomocowe: 112 · 116 123')} variant="ghost" onPress={() => router.push('/crisis')} />
      </ScrollView>
    </SafeAreaView>
  );
}
