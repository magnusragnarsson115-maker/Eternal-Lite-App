import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Badge, Button, Card, Empty, Loading, Notice, Row, Screen } from '../../components/ui';
import { del, get } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { PURPOSE_PL, SCOPE_PL, SUBTYPE_PL } from '../../lib/labels';
import type { AccessEntry, EmergencyAccessView, GrantView } from '../../lib/types';

/** Udostępnianie na czas (P2, A24.4): komu, w jakim zakresie, do kiedy; wycofanie jednym ruchem; „kto oglądał” (A18.10). */
export default function SharingScreen() {
  const { t, dateTime } = useI18n();
  const qc = useQueryClient();
  const grants = useQuery({ queryKey: ['grants'], queryFn: () => get<{ items: GrantView[] }>('/api/me/grants') });
  const log = useQuery({ queryKey: ['access-log'], queryFn: () => get<{ items: AccessEntry[] }>('/api/me/access-log') });
  const emergency = useQuery({ queryKey: ['emergency-access'], queryFn: () => get<{ items: EmergencyAccessView[] }>('/api/me/emergency-access') });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/api/me/grants/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grants'] });
      void qc.invalidateQueries({ queryKey: ['access-log'] });
    },
  });
  const active = grants.data?.items.filter((g) => g.status === 'active') ?? [];
  const ask = (g: GrantView) =>
    Alert.alert(t('Wycofać udostępnienie?'), t('{r} natychmiast straci dostęp do Twoich dokumentów i wyników.', { r: g.recipient }), [
      { text: t('Anuluj'), style: 'cancel' },
      { text: t('Wycofaj'), style: 'destructive', onPress: () => revoke.mutate(g.id) },
    ]);
  return (
    <Screen>
      <Card title={t('Komu udostępniam')}>
        {grants.isLoading ? (
          <Loading />
        ) : !active.length ? (
          <Empty title={t('Nie udostępniasz teraz danych żadnej placówce')} />
        ) : (
          active.map((g) => (
            <Row
              key={g.id}
              title={g.recipient}
              sub={`${t(SCOPE_PL[g.scope.kind] ?? g.scope.kind)} · ${t(PURPOSE_PL[g.purpose] ?? g.purpose)} · ${t('do {d}', { d: dateTime(g.expiresAt) })}`}
              right={<Button title={t('Wycofaj')} variant="ghost" onPress={() => ask(g)} />}
            />
          ))
        )}
        {revoke.isError ? <Notice kind="danger">{errorMessage(revoke.error, t)}</Notice> : null}
        <Button title={t('Udostępnij placówce lub lekarzowi')} variant="secondary" onPress={() => router.push('/share-new')} />
      </Card>
      {emergency.data?.items.length ? (
        <Card title={t('Dostęp ratunkowy do Twoich danych')}>
          {emergency.data.items.map((e) => (
            <Row
              key={e.id}
              title={`${e.who} · ${e.clinic ?? ''}`}
              sub={`${dateTime(e.startedAt)} · ${t(e.reasonText)}`}
              right={<Badge kind={e.review ? (e.review.outcome === 'justified' ? 'ok' : 'danger') : 'info'}>{e.review ? (e.review.outcome === 'justified' ? t('uzasadniony') : t('nieuzasadniony')) : t('w ocenie')}</Badge>}
            />
          ))}
        </Card>
      ) : null}
      <Card title={t('Kto oglądał moje dane')}>
        {log.isLoading ? (
          <Loading />
        ) : !log.data?.items.length ? (
          <Empty title={t('Nikt jeszcze nie oglądał Twoich danych')} />
        ) : (
          log.data.items.slice(0, 50).map((e, i) => (
            <Row key={i} title={e.who === 'Ty' ? t('Ty') : e.who} sub={`${t(SUBTYPE_PL[e.subtype] ?? 'Dostęp do danych')}${e.org ? ` · ${e.org}` : ''} · ${dateTime(e.at)}`} right={e.who === 'Ty' ? undefined : <Badge>{e.role === 'caregiver' ? t('opiekun') : t('personel')}</Badge>} />
          ))
        )}
      </Card>
    </Screen>
  );
}
