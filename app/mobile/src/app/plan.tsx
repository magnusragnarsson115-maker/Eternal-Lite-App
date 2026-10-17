import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Switch, View } from 'react-native';
import { Button, Card, Empty, P, Row, Screen } from '../components/ui';
import { get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';

/**
 * Plan i kalendarz (A22.4 plan ćwiczeń z odhaczaniem, A7.6 cele tygodniowe, A17.13 kalendarz zdrowia) — skrót
 * najważniejszego na telefon. Nowe cele i subskrypcję kalendarza ustawisz w przeglądarce.
 */

interface RehabPlan {
  id: string;
  title: string;
  status: string;
  activities: { index: number; name: string; dose?: string }[];
  today: { date: string; items: { index: number; name: string; done: boolean }[] };
  adherence: { last7: { expected: number; done: number } };
}
interface Goal {
  id: string;
  kind: string;
  title: string;
  target: number;
  unit: string;
  week: { value: number; checkedToday?: boolean };
}
interface CalEvent {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  start: string;
  allDay: boolean;
  link: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function PlanScreen() {
  const { t, date, dateTime } = useI18n();
  const qc = useQueryClient();
  const rehab = useQuery({ queryKey: ['rehab'], queryFn: () => get<{ items: RehabPlan[] }>('/api/me/rehab') });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => get<{ items: Goal[] }>('/api/me/goals') });
  const from = iso(new Date());
  const to = iso(new Date(Date.now() + 14 * 86_400_000));
  const cal = useQuery({ queryKey: ['calendar', from], queryFn: () => get<{ items: CalEvent[] }>(`/api/me/calendar?from=${from}&to=${to}`) });
  const log = useMutation({
    mutationFn: (v: { plan: string; activity: number; day: string; done: boolean }) => post(`/api/me/rehab/${v.plan}/log`, v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rehab'] }),
    onError: (e) => Alert.alert(errorMessage(e, t)),
  });
  const check = useMutation({ mutationFn: (v: { id: string; done: boolean }) => post(`/api/me/goals/${v.id}/check`, { done: v.done }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['goals'] }) });
  const active = rehab.data?.items.filter((p) => p.status === 'active') ?? [];
  return (
    <Screen>
      <Card title={t('Plan ćwiczeń od placówki')}>
        {!active.length ? <Empty title={t('Nie masz aktywnego planu ćwiczeń')} /> : null}
        {active.map((p) => (
          <View key={p.id} style={{ gap: space(2) }}>
            <P>{p.title}</P>
            {p.today.items.length === 0 ? <P small muted>{t('Na dziś nie ma zaplanowanych ćwiczeń.')}</P> : null}
            {p.today.items.map((i) => (
              <Row
                key={i.index}
                title={`${i.name}${p.activities[i.index]?.dose ? ` — ${p.activities[i.index].dose}` : ''}`}
                right={<Switch value={i.done} accessibilityLabel={i.name} onValueChange={(done) => log.mutate({ plan: p.id, activity: i.index, day: p.today.date, done })} />}
              />
            ))}
            <P small muted>{t('Wykonane w ostatnich 7 dniach: {a} z {b}', { a: p.adherence.last7.done, b: p.adherence.last7.expected })}</P>
          </View>
        ))}
      </Card>
      <Card title={t('Moje cele na ten tydzień')}>
        {!goals.data?.items.length ? <Empty title={t('Nie masz jeszcze celów')} /> : null}
        {goals.data?.items.map((g) => (
          <Row
            key={g.id}
            title={t(g.title)}
            sub={t('{a} z {b} {u}', { a: g.week.value, b: g.target, u: t(g.unit) })}
            right={g.kind === 'custom' ? <Switch value={!!g.week.checkedToday} accessibilityLabel={t('Zrobione dziś')} onValueChange={(done) => check.mutate({ id: g.id, done })} /> : undefined}
          />
        ))}
        <P small muted>{t('Nowe cele dodasz w przeglądarce, w zakładce Plan i cele.')}</P>
      </Card>
      <Card title={t('Kalendarz — najbliższe 14 dni')}>
        {!cal.data?.items.length ? <Empty title={t('Brak wydarzeń w tym okresie')} /> : null}
        {cal.data?.items.map((e) => (
          <Row
            key={e.id}
            title={t(e.title)}
            sub={`${e.allDay ? date(e.start) : dateTime(e.start)}${e.detail ? ` · ${e.detail}` : ''}`}
            onPress={e.kind === 'appointment' ? () => router.push('/(tabs)') : undefined}
          />
        ))}
      </Card>
      <Button title={t('Dzienniki')} variant="secondary" onPress={() => router.push('/journal')} />
    </Screen>
  );
}
