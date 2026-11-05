import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { QuestionnaireForm, type Answers } from '../shared/QuestionnaireForm';
import type { Questionnaire } from '../types';
import { Badge, Button, Card, Empty, FullText, Notice, PageHead, QueryError, Skeleton, useToast } from '../ui';
import { CrisisModal } from './MvpPages';

/**
 * Ankiety pacjenta (A12.3): na start (zdrowotna), po nowych wynikach, kontrolna po kilku raportach,
 * ocena aplikacji (anonimowa). Aplikacja nie ocenia odpowiedzi; zdrowotne zostają w danych pacjenta.
 */

export interface SurveyCard {
  id: string;
  title: string;
  description: string;
  minutes: number;
  kind: 'health' | 'product';
  reason: string;
  reasonVars?: Record<string, number>;
  due: boolean;
  completedAt?: string;
}

interface SurveysData {
  items: SurveyCard[];
  history: { id: string; surveyId?: string; title: string; authored: string }[];
}

function useSurveys() {
  return useQuery({ queryKey: ['surveys'], queryFn: () => get<SurveysData>('/api/me/surveys'), retry: false });
}

function useDefer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; mode: 'later' | 'skip' }) => post(`/api/me/surveys/${v.id}/defer`, { mode: v.mode }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['surveys'] }),
  });
}

/** Zaproszenie na pulpicie — najwyżej jedna ankieta naraz (bez zasypywania pytaniami). */
export function SurveyInvite() {
  const { t } = useI18n();
  const q = useSurveys();
  const defer = useDefer();
  const s = q.data?.items.find((i) => i.due);
  if (!s) return null;
  return (
    <Card>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <span className="list-icon">
          <ClipboardList size={22} aria-hidden />
        </span>
        <div className="grow stack" style={{ gap: 4 }}>
          <strong>{t(s.title)}</strong>
          <span className="small muted">
            {t(s.reason, s.reasonVars)} · {t('ok. {n} min', { n: s.minutes })}
          </span>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <Link to={`/ankiety/${s.id}`} className="btn sm">
              {t('Wypełnij')}
            </Link>
            <Button variant="ghost" size="sm" loading={defer.isPending} onClick={() => defer.mutate({ id: s.id, mode: 'later' })}>
              {t('Nie teraz')}
            </Button>
            {s.id !== 'health-intake' && (
              <Button variant="ghost" size="sm" onClick={() => defer.mutate({ id: s.id, mode: 'skip' })}>
                {t('Pomiń')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SurveysPage() {
  const { t, fmt } = useI18n();
  const q = useSurveys();
  return (
    <div className="stack-lg">
      <PageHead title={t('Ankiety')} sub={t('Krótkie ankiety o Twoim zdrowiu i o aplikacji. Aplikacja nie ocenia odpowiedzi — odpowiedzi zdrowotne zobaczy lekarz tylko wtedy, gdy udostępnisz mu dane.')} />
      {q.isLoading && <Skeleton count={3} />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {q.data && (
        <>
          <Card className="card-flush">
            <ul className="list">
              {q.data.items.map((s) => {
                const canFill = s.due || s.id === 'health-intake' || s.id === 'health-followup';
                return (
                  <li key={s.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <span className="grow">
                      <span className="list-title" style={{ display: 'block' }}>
                        {t(s.title)} {s.kind === 'product' && <Badge>{t('anonimowa')}</Badge>}
                      </span>
                      <span className="list-sub" style={{ display: 'block' }}>{t(s.description)}</span>
                      <span className="small muted" style={{ display: 'block' }}>
                        {s.completedAt ? t('Ostatnio: {d}', { d: fmt.date(s.completedAt) }) + ' · ' : ''}
                        {t(s.reason, s.reasonVars)}
                      </span>
                    </span>
                    {s.due ? (
                      <Link to={`/ankiety/${s.id}`} className="btn sm">
                        {t('Wypełnij')}
                      </Link>
                    ) : canFill ? (
                      <Link to={`/ankiety/${s.id}`} className="btn secondary sm">
                        {s.id === 'health-intake' && s.completedAt ? t('Aktualizuj') : t('Wypełnij')}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title={t('Moje odpowiedzi')}>
            {q.data.history.length === 0 ? (
              <Empty title={t('Brak wypełnionych ankiet zdrowotnych')} />
            ) : (
              <ul className="list">
                {q.data.history.map((h) => (
                  <li key={h.id}>
                    <Link to={`/ankiety/odpowiedzi/${h.id}`} className="list-item">
                      <span className="grow">
                        <span className="list-title" style={{ display: 'block' }}>{t(h.title)}</span>
                        <span className="list-sub">{fmt.dateTime(h.authored)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ marginBottom: 0 }}>{t('Ocena aplikacji jest anonimowa, dlatego nie ma jej na tej liście.')}</p>
          </Card>
        </>
      )}
    </div>
  );
}

export function SurveyPage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const defer = useDefer();
  const [done, setDone] = useState<{ question?: string; crisis?: boolean } | null>(null);
  const q = useQuery({
    queryKey: ['survey', id],
    queryFn: () => get<{ questionnaire: Questionnaire; kind: 'health' | 'product'; minutes: number; answers: Answers; lastAuthored?: string }>(`/api/me/surveys/${id}`),
  });
  const save = useMutation({
    mutationFn: (answers: Answers) => post<{ ok: true; question?: string; crisis?: boolean }>(`/api/me/surveys/${id}`, { answers, platform: 'web' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['surveys'] });
      if (r.question || r.crisis) return setDone(r);
      toast(t('Dziękujemy — zapisaliśmy odpowiedzi.'));
      nav('/ankiety');
    },
  });
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} />;
  const d = q.data!;

  if (done) {
    // F8.1 — numery pomocy; „po wynikach” — pytanie do lekarza wysyłane tylko na życzenie pacjenta
    const subject = t('Pytanie o wynik badania');
    return (
      <div className="stack-lg">
        <PageHead title={t('Dziękujemy')} back={{ to: '/ankiety', label: t('Ankiety') }} />
        <CrisisModal open={!!done.crisis} onClose={() => setDone({ ...done, crisis: false })} />
        {done.question && (
          <Card title={t('Wysłać pytanie do placówki?')}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{done.question}</p>
            <p className="small muted">{t('Pytanie trafi do placówki jako wiadomość. Odpowiedź może przyjść za kilka dni — w nagłym zagrożeniu dzwoń 112.')}</p>
            <div className="btn-row">
              <Link className="btn" to={`/wiadomosci?nowa=results&temat=${encodeURIComponent(subject)}&tresc=${encodeURIComponent(done.question)}`}>
                <MessageSquare size={18} aria-hidden /> {t('Napisz wiadomość z tym pytaniem')}
              </Link>
              <Link className="btn secondary" to="/ankiety">
                {t('Nie, dziękuję')}
              </Link>
            </div>
          </Card>
        )}
        {!done.question && (
          <Link className="btn" to="/ankiety">
            {t('Wróć do ankiet')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageHead
        title={t(d.questionnaire.title ?? '')}
        sub={<FullText text={d.questionnaire.description ?? ''} />}
        back={{ to: '/ankiety', label: t('Ankiety') }}
      />
      {d.lastAuthored && <Notice>{t('Formularz zawiera Twoje odpowiedzi z {d}. Zmień to, co jest nieaktualne.', { d: fmt.date(d.lastAuthored) })}</Notice>}
      {d.kind === 'product' && <Notice kind="info">{t('Ankieta jest anonimowa: nie zapisujemy, kto ją wypełnił. Nie wpisuj danych osobowych ani informacji o zdrowiu.')}</Notice>}
      <QuestionnaireForm
        questionnaire={d.questionnaire}
        initial={d.answers ?? {}}
        onSubmit={(a) => save.mutate(a)}
        submitting={save.isPending}
        submitLabel={t('Zapisz odpowiedzi')}
        error={save.isError ? <Notice kind="danger">{errorMessage(save.error, t)}</Notice> : undefined}
        footer={
          <Button
            variant="ghost"
            onClick={() =>
              defer.mutate(
                { id, mode: 'later' },
                { onSuccess: () => nav('/') },
              )
            }
          >
            {t('Nie teraz')}
          </Button>
        }
      />
    </div>
  );
}

export function SurveyResponsePage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['survey-response', id], queryFn: () => get<{ title: string; authored: string; answers: { question: string; answer: string }[] }>(`/api/me/surveys/responses/${id}`) });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack-lg">
      <PageHead title={t(q.data!.title)} sub={fmt.dateTime(q.data!.authored)} back={{ to: '/ankiety', label: t('Ankiety') }} />
      <Card>
        <dl className="answers-review">
          {q.data!.answers.map((a, i) => (
            <div key={i}>
              <dt>{a.question}</dt>
              <dd>{a.answer}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

