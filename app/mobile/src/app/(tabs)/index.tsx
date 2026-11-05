import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, H1, Notice, P, ProxyBanner, Row } from '../../components/ui';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useActiveProfile } from '../../lib/profile';
import { useSession } from '../../lib/session';
import { space, useColors } from '../../lib/theme';
import type { CardView, IntakeView, SurveysData } from '../../lib/types';

interface LatestFacts {
  measurements: { kind: string; effective: string; value?: number; systolic?: number; diastolic?: number; unit: string; source: string; device?: string }[];
  lastLab?: { date: string; count: number };
}

const KIND_LABEL: Record<string, string> = { bp: 'Ciśnienie tętnicze', heartRate: 'Tętno', weight: 'Masa ciała', height: 'Wzrost', temperature: 'Temperatura ciała', spo2: 'Saturacja (SpO₂)', glucose: 'Glukoza we krwi' };
const SOURCE_LABEL: Record<string, string> = { manual: 'wpis ręczny', bluetooth: 'urządzenie Bluetooth', withings: 'Withings', import: 'import z pliku', rpm: 'telemonitoring' };

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
  const { t, date, dateTime } = useI18n();
  const c = useColors();
  const appts = useQuery({ queryKey: ['appointments'], queryFn: () => get<{ items: Appointment[] }>('/api/me/appointments') });
  const intake = useQuery({ queryKey: ['intake'], queryFn: () => get<{ items: IntakeView[] }>('/api/me/intake') });
  const cards = useQuery({ queryKey: ['cards'], queryFn: () => get<{ items: CardView[] }>('/api/me/cards') });
  const facts = useQuery({ queryKey: ['facts-latest'], queryFn: () => get<LatestFacts>('/api/me/facts/latest') });
  const profile = useActiveProfile();
  // A18.8 — tryb degradacji: co działa ograniczenie i co aplikacja robi zamiast tego
  const status = useQuery({ queryKey: ['system-status'], queryFn: () => get<{ items: { id: string; label: string; status: string; fallback: string }[] }>('/api/public/status'), retry: false, refetchInterval: 120_000 });
  const degraded = status.data?.items.filter((i) => i.status === 'degraded') ?? [];
  // ankiety dotyczą właściciela konta — w profilu dziecka lub osoby pod opieką ich nie ma (A24.2)
  const surveys = useQuery({ queryKey: ['surveys'], queryFn: () => get<SurveysData>('/api/me/surveys'), retry: false, enabled: !profile });
  const dueSurvey = surveys.data?.items.find((s) => s.due);
  const next = appts.data?.items.filter((a) => ['booked', 'pending', 'arrived'].includes(a.status) && Date.parse(a.start) > Date.now() - 3600_000).sort((a, b) => a.start.localeCompare(b.start))[0];
  const toReview = intake.data?.items.filter((i) => i.status === 'needs_review').length ?? 0;
  const refreshing = appts.isRefetching || intake.isRefetching || cards.isRefetching || facts.isRefetching || surveys.isRefetching;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(10) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([appts.refetch(), intake.refetch(), cards.refetch(), facts.refetch(), ...(profile ? [] : [surveys.refetch()])])} />}
      >
        <ProxyBanner />
        {degraded.length ? <Notice kind="warn">{degraded.map((i) => `${t(i.label)}: ${t(i.fallback)}`).join('\n')}</Notice> : null}
        <H1>{profile ? t('Profil: {name}', { name: profile.name }) : t('Dzień dobry, {n}', { n: me?.user?.displayName.split(' ')[0] ?? '' })}</H1>

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

        {dueSurvey ? (
          <Card title={t(dueSurvey.title)}>
            <P muted>
              {t(dueSurvey.reason, dueSurvey.reasonVars)} · {t('ok. {n} min', { n: dueSurvey.minutes })}
            </P>
            <Button title={t('Wypełnij')} onPress={() => router.push(`/surveys/${dueSurvey.id}`)} />
          </Card>
        ) : null}

        {facts.data ? (
          <Card title={t('Moje dane — ostatnie odczyty')}>
            {facts.data.measurements.length ? (
              facts.data.measurements.map((m) => (
                <Row
                  key={m.kind}
                  title={`${t(KIND_LABEL[m.kind] ?? m.kind)}: ${m.kind === 'bp' ? `${m.systolic}/${m.diastolic}` : String(m.value).replace('.', ',')} ${m.unit}`}
                  sub={`${dateTime(m.effective)} · ${t(SOURCE_LABEL[m.source.split(':')[0]] ?? m.source)}${m.device ? ` (${m.device})` : ''}`}
                />
              ))
            ) : (
              <P muted>{t('Brak pomiarów.')}</P>
            )}
            <P small muted>
              {facts.data.lastLab ? t('Ostatnie potwierdzone wyniki badań: {d} ({n})', { d: date(facts.data.lastLab.date), n: facts.data.lastLab.count }) : t('Brak potwierdzonych wyników badań.')}
            </P>
            <P small muted>
              {t('Ostatnie zapisane wartości z datą i źródłem. Aplikacja ich nie ocenia.')}
            </P>
            <Button title={t('Raport okresowy')} variant="secondary" onPress={() => router.push('/report')} />
          </Card>
        ) : null}

        <Button title={t('Dodaj pomiar (ciśnienie, waga…)')} variant="secondary" onPress={() => router.push('/measurements')} />
        <Button title={t('Ratunek — SOS')} variant="danger" accessibilityHint={t('Połączenie z 112 i powiadomienie osób bliskich')} onPress={() => router.push('/sos')} />
        <Button title={t('Numery pomocowe: 112 · 116 123')} variant="ghost" onPress={() => router.push('/crisis')} />
      </ScrollView>
    </SafeAreaView>
  );
}
