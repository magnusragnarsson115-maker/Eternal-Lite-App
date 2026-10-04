import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FlaskConical, Paperclip, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { get, put } from '../api';
import { useI18n } from '../i18n';
import type { RecordView } from '../types';
import { Badge, Button, Card, Empty, formatBytes, Notice, PageHead, QueryError, Skeleton } from '../ui';

interface RecordsResponse {
  access: { allowed: boolean; reason?: 'identity_not_verified' | 'consent_missing' };
  items: RecordView[];
}

export function RecordAccessNotice({ reason }: { reason?: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const grant = useMutation({
    mutationFn: () => put('/api/me/consents/results-online', { granted: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['records'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  if (reason === 'identity_not_verified') {
    return (
      <Notice kind="warn" title={t('Potwierdź tożsamość w placówce')}>
        <p>{t('Ze względów bezpieczeństwa wyniki i dokumentacja są dostępne po potwierdzeniu tożsamości. Pokaż dokument tożsamości w rejestracji podczas najbliższej wizyty — dostęp włączy się od razu.')}</p>
      </Notice>
    );
  }
  return (
    <Notice kind="info" title={t('Włącz dostęp do wyników w aplikacji')}>
      <p>{t('Na Twój wniosek placówka będzie udostępniać wyniki badań i dokumenty w aplikacji. Możesz to wyłączyć w każdej chwili w ustawieniach prywatności.')}</p>
      <Button size="sm" onClick={() => grant.mutate()} loading={grant.isPending}>
        {t('Włącz dostęp')}
      </Button>
    </Notice>
  );
}

export function RecordsPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['records'], queryFn: () => get<RecordsResponse>('/api/me/records') });
  return (
    <div className="stack-lg">
      <PageHead title={t('Wyniki i dokumenty')} sub={t('Widzisz dokumenty udostępnione przez placówkę.')} />
      {q.isLoading && <Skeleton />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {q.data && !q.data.access.allowed && <RecordAccessNotice reason={q.data.access.reason} />}
      {q.data?.access.allowed && q.data.items.length === 0 && (
        <Empty icon={<FileText size={40} />} title={t('Brak udostępnionych dokumentów')}>
          <p className="small">{t('Gdy lekarz udostępni wynik, dostaniesz powiadomienie.')}</p>
        </Empty>
      )}
      {q.data?.access.allowed && q.data.items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((r) => (
              <li key={r.ref}>
                <Link to={`/wyniki/${r.type === 'report' ? 'r' : 'd'}/${r.id}`} className="list-item">
                  {!r.readAt && <span className="unread-dot" aria-label={t('nowe')} />}
                  <span className={`list-icon ${r.type === 'report' ? 'info' : ''}`}>{r.type === 'report' ? <FlaskConical size={20} /> : <FileText size={20} />}</span>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>{r.title}</span>
                    <span className="list-sub">
                      {fmt.date(r.date)} · {r.type === 'report' ? t('Wynik badania') : r.category}
                      {r.author ? ` · ${r.author}` : ''}
                    </span>
                  </span>
                  {r.attachment && <Paperclip size={16} aria-label={t('załącznik')} />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="small muted">{t('Aplikacja nie ocenia wyników. Wartości, zakresy referencyjne i oznaczenia pochodzą z laboratorium. Omów wyniki z lekarzem.')}</p>
    </div>
  );
}

export function ObservationTable({ record }: { record: RecordView }) {
  const { t } = useI18n();
  if (!record.observations?.length) return null;
  return (
    <>
      <div className="table-wrap obs-table">
        <table className="table">
          <caption className="sr-only">{record.title}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Parametr')}</th>
              <th scope="col" className="num">{t('Wynik')}</th>
              <th scope="col">{t('Jednostka')}</th>
              <th scope="col">{t('Zakres referencyjny')}</th>
              <th scope="col">{t('Oznaczenie lab.')}</th>
            </tr>
          </thead>
          <tbody>
            {record.observations.map((o) => (
              <tr key={o.id}>
                <th scope="row" className="obs-name">
                  {o.name}
                  {o.loinc && <span className="small muted mono" style={{ display: 'block' }}>LOINC {o.loinc}</span>}
                </th>
                <td className="num" style={{ fontWeight: 650 }}>{o.value}</td>
                <td>{o.unit ?? ''}</td>
                <td className="tabular">{o.referenceRange ?? '—'}</td>
                <td>{o.labFlag ? <Badge>{o.labFlag}</Badge> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list obs-list" aria-label={record.title}>
        {record.observations.map((o) => (
          <li key={o.id} className="obs-item">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <strong>{o.name}</strong>
              <span className="tabular" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {o.value} <span className="muted small" style={{ fontWeight: 500 }}>{o.unit}</span>
              </span>
            </div>
            <div className="small muted">
              {t('Zakres referencyjny')}: <span className="tabular">{o.referenceRange ?? '—'}</span>
              {o.labFlag && (
                <>
                  {' · '}
                  {t('Oznaczenie lab.')} <Badge>{o.labFlag}</Badge>
                </>
              )}
              {o.loinc && <span className="mono"> · LOINC {o.loinc}</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function RecordBody({ record, fileBase }: { record: RecordView; fileBase: string }) {
  const { t, fmt } = useI18n();
  return (
    <div className="stack">
      <dl className="kv">
        <dt>{t('Data')}</dt>
        <dd>{fmt.date(record.date)}</dd>
        {record.laboratory && (
          <>
            <dt>{t('Laboratorium')}</dt>
            <dd>{record.laboratory}</dd>
          </>
        )}
        {record.author && (
          <>
            <dt>{t('Autor')}</dt>
            <dd>{record.author}</dd>
          </>
        )}
        {record.sharedAt && (
          <>
            <dt>{t('Udostępniono')}</dt>
            <dd>{fmt.dateTime(record.sharedAt)}</dd>
          </>
        )}
      </dl>
      <ObservationTable record={record} />
      {record.conclusion && (
        <div>
          <h3>{t('Komentarz lekarza')}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{record.conclusion}</p>
        </div>
      )}
      {record.text && <div style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>{record.text}</div>}
      {record.attachment && (
        <a className="btn secondary" href={`${fileBase}/${record.attachment.binaryId}`} target="_blank" rel="noopener">
          <Paperclip size={18} /> {record.attachment.title ?? t('Otwórz załącznik')} {record.attachment.size ? `(${formatBytes(record.attachment.size)})` : ''}
        </a>
      )}
    </div>
  );
}

export function RecordDetailPage() {
  const { kind = 'r', id = '' } = useParams();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['record', kind, id], queryFn: () => get<RecordView>(`/api/me/records/${kind}/${id}`) });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const r = q.data!;
  return (
    <div className="stack-lg">
      <PageHead
        title={r.title}
        sub={r.type === 'report' ? t('Wynik badania') : r.category}
        back={{ to: '/wyniki', label: t('Wyniki i dokumenty') }}
        action={
          <Button variant="secondary" size="sm" icon={<Printer size={16} />} onClick={() => window.print()} className="no-print">
            {t('Drukuj')}
          </Button>
        }
      />
      <Card>
        <RecordBody record={r} fileBase="/api/me/files" />
      </Card>
      <Notice kind="info">{t('Aplikacja nie ocenia wyników i nie zastępuje porady lekarza. W razie pytań napisz do placówki.')}</Notice>
      <Link to="/wiadomosci?nowa=wyniki" className="btn secondary no-print" style={{ alignSelf: 'flex-start' }}>
        {t('Zapytaj o wynik')}
      </Link>
    </div>
  );
}
