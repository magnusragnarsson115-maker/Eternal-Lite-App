import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Loading, Notice, P, Row, Screen } from '../components/ui';
import { del, get } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import type { SessionItem } from '../lib/types';

const METHOD_PL: Record<string, string> = { password: 'hasło', passkey: 'klucz dostępu', 'magic-link': 'link z e-maila', oidc: 'logowanie firmowe' };

/** Lista zalogowanych urządzeń (F1.13) z wylogowaniem zdalnym; najwyżej 5 urządzeń — najstarsze wylogowuje się samo. */
export default function DevicesScreen() {
  const { t, dateTime } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => get<{ items: SessionItem[]; maxDevices?: number }>('/api/auth/sessions') });
  const revoke = useMutation({ mutationFn: (id: string) => del<{ items: SessionItem[] }>(`/api/auth/sessions/${id}`), onSuccess: (r) => qc.setQueryData(['sessions'], (old: object | undefined) => ({ ...old, items: r.items })) });
  return (
    <Screen>
      {q.data?.maxDevices ? <P muted>{t('Możesz być zalogowany(-a) na najwyżej {n} urządzeniach. Po zalogowaniu na kolejnym najstarsza sesja wygasa.', { n: q.data.maxDevices })}</P> : null}
      <Card>
        {q.isLoading ? (
          <Loading />
        ) : (
          q.data?.items.map((s) => (
            <Row
              key={s.id}
              title={s.device}
              sub={`${t(METHOD_PL[s.method] ?? s.method)} · ${t('ostatnio {d}', { d: dateTime(s.lastSeenAt ?? s.createdAt) })}${s.ip ? ` · ${s.ip}` : ''}`}
              right={s.current ? <Badge kind="ok">{t('to urządzenie')}</Badge> : <Button title={t('Wyloguj')} variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onPress={() => revoke.mutate(s.id)} />}
            />
          ))
        )}
        {revoke.isError ? <Notice kind="danger">{errorMessage(revoke.error, t)}</Notice> : null}
      </Card>
    </Screen>
  );
}
