import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarPlus, ClipboardList, FileChartColumn, FileText, MessageSquare, Search, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { AppointmentView, NotificationRow } from '../types';
import { Card, FullText, LinkButton, Notice, QueryError, Skeleton } from '../ui';
import { KIND_LABEL, sourceText } from './ReportPage';

interface Dashboard {
  nextAppointment: AppointmentView | null;
  upcomingCount: number;
  unreadRecords: number;
  recordsAccess: { allowed: boolean; reason?: string };
  unreadMessages: number;
  unreadNotifications: number;
  recentNotifications: NotificationRow[];
  pendingQuestionnaires: string[];
}

export function HomePage() {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/api/me/dashboard') });
  const greeting = new Date().getHours() >= 18 ? t('Dobry wieczór') : t('Dzień dobry');

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>
          {greeting}, {me?.patient?.given ?? me?.user?.displayName}
        </h1>
        <p className="muted">{t('Co chcesz dziś zrobić?')}</p>
      </div>

      {q.isLoading && <Skeleton height={120} count={2} />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {q.data && (
        <>
          {q.data.nextAppointment ? (
            <Card className="card-hero">
              <p className="small" style={{ margin: 0, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('Najbliższa wizyta')}
              </p>
              <h2 style={{ fontSize: '1.45rem', margin: '6px 0 2px' }}>{fmt.dateLong(q.data.nextAppointment.start)}</h2>
              <p style={{ fontSize: '1.15rem', fontWeight: 650, margin: 0 }}>
                {t('godz.')} {fmt.time(q.data.nextAppointment.start)}
              </p>
              <p style={{ margin: '8px 0 14px', opacity: 0.92 }}>
                {q.data.nextAppointment.serviceName} · {q.data.nextAppointment.practitionerName}
                {q.data.nextAppointment.mode === 'tele' ? ` · ${t('teleporada')}` : q.data.nextAppointment.locationName ? ` · ${q.data.nextAppointment.locationName}` : ''}
              </p>
              <div className="btn-row">
                <Link to={`/wizyty/${q.data.nextAppointment.id}`} className="btn secondary">
                  {q.data.nextAppointment.mode === 'tele' ? <Video size={18} /> : null}
                  {t('Szczegóły wizyty')}
                </Link>
                {q.data.upcomingCount > 1 && (
                  <Link to="/wizyty" className="btn ghost" style={{ color: '#fff' }}>
                    {t('Wszystkie wizyty ({n})', { n: q.data.upcomingCount })}
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <h2>{t('Nie masz zaplanowanych wizyt')}</h2>
              <p className="muted">{t('Wybierz usługę i dogodny termin — rezerwacja zajmie mniej niż minutę.')}</p>
              <LinkButton to="/rezerwacja" icon={<CalendarPlus size={18} />}>
                {t('Umów wizytę')}
              </LinkButton>
            </Card>
          )}

          {q.data.pendingQuestionnaires.length > 0 && (
            <Notice kind="warn" title={t('Wypełnij wywiad przed wizytą')}>
              <p>{t('Lekarz prosi o kilka informacji przed wizytą. To zajmie ok. 2 minuty.')}</p>
              <Link to={`/wizyty/${q.data.pendingQuestionnaires[0]}/wywiad`} className="btn sm">
                <ClipboardList size={16} /> {t('Wypełnij teraz')}
              </Link>
            </Notice>
          )}

          <LatestFactsCard />

          <div className="grid-2">
            <Tile to="/rezerwacja" icon={<CalendarPlus size={22} />} title={t('Umów wizytę')} sub={t('Wolne terminy na bieżąco')} />
            <Tile
              to="/wyniki"
              icon={<FileText size={22} />}
              title={t('Wyniki i dokumenty')}
              sub={
                !q.data.recordsAccess.allowed
                  ? q.data.recordsAccess.reason === 'identity_not_verified'
                    ? t('Wymaga potwierdzenia tożsamości')
                    : t('Włącz dostęp w ustawieniach')
                  : q.data.unreadRecords
                    ? t('{n} nowe do przeczytania', { n: q.data.unreadRecords })
                    : t('Brak nowych')
              }
              highlight={q.data.unreadRecords > 0}
            />
            <Tile
              to="/wiadomosci"
              icon={<MessageSquare size={22} />}
              title={t('Wiadomości')}
              sub={q.data.unreadMessages ? t('{n} nieprzeczytane', { n: q.data.unreadMessages }) : t('Napisz do placówki')}
              highlight={q.data.unreadMessages > 0}
            />
            <Tile to="/pomiary" icon={<Activity size={22} />} title={t('Pomiary domowe')} sub={t('Ciśnienie, waga, tętno, saturacja')} />
          </div>

          {q.data.recentNotifications.length > 0 && (
            <Card title={t('Ostatnie powiadomienia')} action={<Link to="/powiadomienia" className="small">{t('Wszystkie')}</Link>} className="card-flush" as="section">
              <ul className="list">
                {q.data.recentNotifications.map((n) => (
                  <li key={n.id}>
                    <Link to={n.link ?? '/powiadomienia'} className="list-item">
                      {!n.read_at && <span className="unread-dot" aria-label={t('nieprzeczytane')} />}
                      <span className="grow">
                        <span className="list-title" style={{ display: 'block' }}>{t(n.title)}</span>
                        <span className="list-sub" style={{ display: 'block' }}>{t(n.body)}</span>
                        <span className="small muted">{fmt.relative(n.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Link to="/nfz" className="card list-item" style={{ padding: 16 }}>
            <span className="list-icon info">
              <Search size={20} />
            </span>
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>{t('Sprawdź terminy w NFZ')}</span>
              <span className="list-sub">{t('Pierwsze wolne terminy u świadczeniodawców z umową NFZ (dane otwarte NFZ).')}</span>
            </span>
          </Link>
        </>
      )}
    </div>
  );
}

interface LatestFacts {
  measurements: { kind: string; effective: string; value?: number; systolic?: number; diastolic?: number; unit: string; source: string; device?: string }[];
  lastLab?: { date: string; count: number; source: 'patient' | 'clinic' };
  unconfirmedLabs: number;
}

/**
 * Pulpit faktów (A3.1): ostatni odczyt każdego rodzaju z datą i źródłem oraz data ostatnich potwierdzonych wyników.
 * Bez oceny, kolorów „normy” i trendów — szczegóły i średnie z metodą w raporcie okresowym.
 */
function LatestFactsCard() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['facts-latest'], queryFn: () => get<LatestFacts>('/api/me/facts/latest') });
  const d = q.data;
  if (q.isLoading) return <Skeleton height={110} count={1} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  if (!d) return null;
  return (
    <Card
      title={t('Moje dane — ostatnie odczyty')}
      action={
        <Link to="/raport" className="small">
          <FileChartColumn size={16} aria-hidden /> {t('Raport okresowy')}
        </Link>
      }
    >
      {d.measurements.length === 0 ? (
        <p className="muted" style={{ margin: '0 0 8px' }}>
          {t('Brak pomiarów.')} <Link to="/pomiary">{t('Dodaj pierwszy pomiar')}</Link>
        </p>
      ) : (
        <dl className="kv facts-kv">
          {d.measurements.map((m) => (
            <div key={m.kind} style={{ display: 'contents' }}>
              <dt>{t(KIND_LABEL[m.kind] ?? m.kind)}</dt>
              <dd>
                <strong>
                  {m.kind === 'bp' ? `${m.systolic}/${m.diastolic}` : fmt.number(m.value)} {m.unit}
                </strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {fmt.dateTime(m.effective)} · {sourceText(m.source, t)}
                  {m.device ? ` (${m.device})` : ''}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="small" style={{ margin: '8px 0 0' }}>
        {d.lastLab ? (
          <>
            {t('Ostatnie potwierdzone wyniki badań: {d} ({n})', { d: fmt.date(d.lastLab.date), n: d.lastLab.count })} · <Link to="/os-czasu">{t('Oś czasu wyników')}</Link>
          </>
        ) : (
          <span className="muted">{t('Brak potwierdzonych wyników badań.')}</span>
        )}
        {d.unconfirmedLabs > 0 && (
          <span style={{ display: 'block' }}>
            {t('Do sprawdzenia: {n} odczytów z dokumentów.', { n: d.unconfirmedLabs })} <Link to="/dokumenty">{t('Moje dokumenty')}</Link>
          </span>
        )}
      </p>
      <p className="small muted" style={{ margin: '6px 0 0' }}><FullText text="Ostatnie zapisane wartości z datą i źródłem. Aplikacja ich nie ocenia." /></p>
    </Card>
  );
}

function Tile({ to, icon, title, sub, highlight }: { to: string; icon: React.ReactNode; title: string; sub: string; highlight?: boolean }) {
  return (
    <Link to={to} className="card list-item" style={{ padding: 16, borderColor: highlight ? 'var(--primary)' : undefined }}>
      <span className="list-icon">{icon}</span>
      <span className="grow">
        <span className="list-title" style={{ display: 'block' }}>{title}</span>
        <span className="list-sub">{sub}</span>
      </span>
    </Link>
  );
}
