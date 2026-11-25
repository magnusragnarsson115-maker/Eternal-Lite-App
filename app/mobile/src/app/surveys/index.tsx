import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Badge, Card, Empty, Loading, Notice, P, Row, Screen } from '../../components/ui';
import { get } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import type { SurveysData } from '../../lib/types';

/** Ankiety (A12.3): lista z informacją „dlaczego teraz” i historia własnych odpowiedzi zdrowotnych. */
export default function SurveysScreen() {
  const { t, date, dateTime } = useI18n();
  const q = useQuery({ queryKey: ['surveys'], queryFn: () => get<SurveysData>('/api/me/surveys') });
  return (
    <Screen>
      <P muted>{t('Krótkie ankiety o Twoim zdrowiu i o aplikacji. Aplikacja nie ocenia odpowiedzi — odpowiedzi zdrowotne zobaczy lekarz tylko wtedy, gdy udostępnisz mu dane.')}</P>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <Notice kind="danger">{errorMessage(q.error, t)}</Notice> : null}
      {q.data ? (
        <>
          <Card>
            {q.data.items.map((s) => {
              const canFill = s.due || s.id === 'health-intake' || s.id === 'health-followup';
              return (
                <Row
                  key={s.id}
                  title={t(s.title)}
                  sub={[s.completedAt ? t('Ostatnio: {d}', { d: date(s.completedAt) }) : '', t(s.reason, s.reasonVars)].filter(Boolean).join(' · ')}
                  right={s.due ? <Badge kind="warn">{t('do wypełnienia')}</Badge> : s.kind === 'product' ? <Badge>{t('anonimowa')}</Badge> : undefined}
                  onPress={canFill ? () => router.push(`/surveys/${s.id}`) : undefined}
                />
              );
            })}
          </Card>
          <Card title={t('Moje odpowiedzi')}>
            {q.data.history.length === 0 ? <Empty title={t('Brak wypełnionych ankiet zdrowotnych')} /> : q.data.history.map((h) => <Row key={h.id} title={t(h.title)} sub={dateTime(h.authored)} />)}
            <P small muted>
              {t('Ocena aplikacji jest anonimowa, dlatego nie ma jej na tej liście.')}
            </P>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
