import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { CrisisModal } from './MvpPages';
import { useSession } from '../session';
import type { ThreadView } from '../types';
import { Button, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, TextArea, TextField } from '../ui';
import { ThreadConversation } from '../ui/ThreadView';

const CATEGORIES = [
  ['question', 'Pytanie do lekarza'],
  ['administrative', 'Sprawa organizacyjna'],
  ['prescription', 'Kontynuacja recepty'],
  ['results', 'Pytanie o wyniki'],
] as const;

export function MessagesPage() {
  const { t, fmt } = useI18n();
  const { config } = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const initialCategory = params.get('nowa');
  const [open, setOpen] = useState(!!initialCategory);
  // wstępne wypełnienie (np. pytanie z ankiety „po wynikach”) — pacjent sam decyduje, czy wysłać
  const [f, setF] = useState({ subject: (params.get('temat') ?? '').slice(0, 120), category: (initialCategory as string) || 'question', body: (params.get('tresc') ?? '').slice(0, 2000) });
  const q = useQuery({ queryKey: ['threads'], queryFn: () => get<{ items: ThreadView[] }>('/api/me/threads') });
  const create = useMutation({
    mutationFn: () => post<ThreadView & { crisis?: boolean }>('/api/me/threads', f),
    onSuccess: (th) => {
      void qc.invalidateQueries({ queryKey: ['threads'] });
      setOpen(false);
      nav(`/wiadomosci/${th.id}${th.crisis ? '?kryzys=1' : ''}`);
    },
  });
  const close = () => {
    setOpen(false);
    if (initialCategory) setParams({});
  };
  return (
    <div className="stack-lg">
      <PageHead
        title={t('Wiadomości')}
        sub={t('Odpowiadamy zwykle w ciągu {n} dni roboczych.', { n: config?.clinic.messageResponseDays ?? 2 })}
        action={<Button icon={<MessageSquarePlus size={18} />} onClick={() => setOpen(true)}>{t('Nowa wiadomość')}</Button>}
      />
      <Notice kind="warn">{t('Wiadomości nie służą do zgłaszania nagłych stanów. W nagłym przypadku dzwoń pod numer 112.')}</Notice>
      {q.isLoading && <Skeleton />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {q.data && q.data.items.length === 0 && <Empty icon={<MessagesSquare size={40} />} title={t('Brak wiadomości')} />}
      {q.data && q.data.items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((th) => (
              <li key={th.id}>
                <Link to={`/wiadomosci/${th.id}`} className="list-item">
                  {th.unread && <span className="unread-dot" aria-label={t('nieprzeczytane')} />}
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block', fontWeight: th.unread ? 750 : 600 }}>{th.subject}</span>
                    <span className="list-sub">
                      {th.lastFrom === 'clinic' ? t('Odpowiedź placówki') : t('Twoja wiadomość')} · {fmt.relative(th.lastMessageAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Modal
        open={open}
        onClose={close}
        title={t('Nowa wiadomość do placówki')}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t('Anuluj')}
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!f.subject.trim() || !f.body.trim()}>
              {t('Wyślij')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <SelectField label={t('Rodzaj sprawy')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Temat')} maxLength={120} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required />
          <TextArea label={t('Treść')} maxLength={2000} rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} hint={`${f.body.length}/2000`} required />
          {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
        </div>
      </Modal>
    </div>
  );
}

export function ThreadPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const [params] = useSearchParams();
  // F8.1 — przy słowach kryzysowych zawsze pokazujemy numery pomocy (wiadomość nie jest pomocą doraźną)
  const [crisis, setCrisis] = useState(params.get('kryzys') === '1');
  const q = useQuery({ queryKey: ['thread', id], queryFn: () => get<ThreadView>(`/api/me/threads/${id}`) });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack-lg">
      <PageHead title={q.data!.subject} back={{ to: '/wiadomosci', label: t('Wiadomości') }} />
      <div className="card">
        <ThreadConversation
          thread={q.data!}
          viewer="patient"
          replyUrl={`/api/me/threads/${id}/reply`}
          onSent={(res) => {
            if (res?.crisis) setCrisis(true);
            void q.refetch();
          }}
        />
        <CrisisModal open={crisis} onClose={() => setCrisis(false)} />
      </div>
    </div>
  );
}
