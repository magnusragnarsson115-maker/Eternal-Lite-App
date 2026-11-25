import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Loading, Notice, P, Row, Screen } from '../components/ui';
import { get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { health } from '../lib/health';
import type { ActivityDay } from '../lib/health-types';
import { useI18n } from '../lib/i18n';

/**
 * Apple Health / Health Connect (F2.1, F2.2, A1.8, F9.1, F9.3, F12.1): po zgodzie w telefonie aplikacja odczytuje
 * kroki i sen (z fazami) i wysyła dzienne podsumowania na serwer. Tylko odczyt — nic nie zapisujemy w magazynie
 * zdrowia telefonu i niczego nie oceniamy.
 */
export default function HealthSyncScreen() {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const [days, setDays] = useState<ActivityDay[] | null>(null);
  const avail = useQuery({ queryKey: ['health-available'], queryFn: () => health.available() });
  const server = useQuery({ queryKey: ['activity'], queryFn: () => get<{ items: { date: string; source: string; steps?: number; sleep?: { minutes: number } }[] }>('/api/me/activity?days=14') });
  const read = useMutation({
    mutationFn: async () => {
      if (!(await health.requestAccess())) throw new Error(t('Nie udzielono dostępu w ustawieniach telefonu.'));
      return health.readDays(30);
    },
    onSuccess: setDays,
  });
  const send = useMutation({
    mutationFn: () => post<{ created: number; updated: number }>('/api/me/activity/import', { source: health.source, device: health.label, days: days!.filter((d) => d.steps !== undefined || d.sleep) }),
    onSuccess: () => {
      setDays(null);
      void qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
  const hm = (m: number) => t('{h} h {m} min', { h: Math.floor(m / 60), m: Math.round(m % 60) });
  return (
    <Screen>
      <P muted>{t('Aplikacja odczytuje z telefonu tylko kroki i sen — po Twojej zgodzie. Liczby pochodzą z urządzenia; aplikacja ich nie ocenia. Dostęp możesz odebrać w ustawieniach telefonu.')}</P>
      <Card title={health.label || t('Dane z telefonu')}>
        {avail.isLoading ? (
          <Loading />
        ) : !avail.data ? (
          <Notice kind="info">
            {health.source
              ? t('Moduł zdrowia nie jest dostępny w tej wersji aplikacji (np. Expo Go) albo w telefonie brakuje Health Connect. Zainstaluj pełną wersję aplikacji Eternal.')
              : t('Na tym urządzeniu nie ma magazynu danych zdrowotnych.')}
          </Notice>
        ) : (
          <>
            <Button title={t('Odczytaj ostatnie 30 dni')} loading={read.isPending} onPress={() => read.mutate()} />
            {read.isError ? <Notice kind="danger">{errorMessage(read.error, t)}</Notice> : null}
          </>
        )}
      </Card>
      {days ? (
        <Card title={t('Do wysłania: {n} dni', { n: days.length })}>
          {days
            .slice(-7)
            .reverse()
            .map((d) => (
              <Row key={d.date} title={date(d.date)} sub={[d.steps !== undefined ? t('{n} kroków', { n: d.steps }) : null, d.sleep ? t('sen {s}', { s: hm(d.sleep.minutes) }) : null].filter(Boolean).join(' · ')} />
            ))}
          <Button title={t('Wyślij do aplikacji')} loading={send.isPending} disabled={!days.length} onPress={() => send.mutate()} />
          {send.isError ? <Notice kind="danger">{errorMessage(send.error, t)}</Notice> : null}
        </Card>
      ) : null}
      {send.isSuccess ? <Notice kind="ok">{t('Zapisano: nowe {c}, zaktualizowane {u}.', { c: send.data.created, u: send.data.updated })}</Notice> : null}
      <Card title={t('Ostatnie dni w aplikacji')}>
        {server.isLoading ? <Loading /> : null}
        {server.data?.items.slice(0, 7).map((d) => (
          <Row key={`${d.date}-${d.source}`} title={date(d.date)} sub={[d.steps !== undefined ? t('{n} kroków', { n: d.steps }) : null, d.sleep ? t('sen {s}', { s: hm(d.sleep.minutes) }) : null].filter(Boolean).join(' · ')} />
        ))}
        {server.data && !server.data.items.length ? <P muted>{t('Brak danych.')}</P> : null}
      </Card>
    </Screen>
  );
}
