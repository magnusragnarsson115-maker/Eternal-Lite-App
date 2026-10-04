import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MessageSquare, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { AppointmentView } from '../types';
import { Card, Empty, PageHead, QueryError, Skeleton, StatusBadge } from '../ui';

interface StaffDashboard {
  date: string;
  scope: 'mine' | 'all';
  today: { total: number; arrived: number; fulfilled: number; cancelled: number; appointments: AppointmentView[] };
  last30: { noShowRate: number | null; cancelled: number; cancelledByPatient: number; total: number };
  unreadThreads: number;
}

export function StaffDashboardPage() {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const q = useQuery({ queryKey: ['staff-dashboard'], queryFn: () => get<StaffDashboard>('/api/staff/dashboard'), refetchInterval: 60_000 });
  if (q.isLoading) return <Skeleton count={3} height={90} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  const appts = d.today.appointments.filter((a) => a.status !== 'cancelled');
  return (
    <div className="stack-lg">
      <PageHead title={`${t('Dzień dobry')}, ${me?.user?.displayName}`} sub={<span>{fmt.dateLong(new Date().toISOString())} · {d.scope === 'mine' ? t('Twoje wizyty') : t('Cała placówka')}</span>} />
      <div className="grid-4">
        <div className="stat">
          <div className="label">{t('Wizyty dziś')}</div>
          <div className="value">{d.today.total}</div>
          <div className="sub">{t('{a} na miejscu · {f} zrealizowane', { a: d.today.arrived, f: d.today.fulfilled })}</div>
        </div>
        <div className="stat">
          <div className="label">{t('Odwołane dziś')}</div>
          <div className="value">{d.today.cancelled}</div>
          <div className="sub">{t('Zwolnione terminy wracają do puli')}</div>
        </div>
        <div className="stat">
          <div className="label">{t('Nieobecności (30 dni)')}</div>
          <div className="value">{d.last30.noShowRate === null ? '—' : `${fmt.number(d.last30.noShowRate)}%`}</div>
          <div className="sub">{t('odsetek wizyt zakończonych nieobecnością')}</div>
        </div>
        <Link to="/panel/wiadomosci" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">{t('Nieprzeczytane wątki')}</div>
          <div className="value">{d.unreadThreads}</div>
          <div className="sub">
            <MessageSquare size={13} aria-hidden /> {t('Przejdź do wiadomości')}
          </div>
        </Link>
      </div>
      <Card title={t('Dzisiejsze wizyty')} action={<Link to="/panel/kalendarz" className="btn secondary sm"><CalendarDays size={16} /> {t('Kalendarz')}</Link>} className="card-flush" as="section">
        {appts.length === 0 ? (
          <Empty title={t('Brak wizyt na dziś')} />
        ) : (
          <ul className="list">
            {appts.map((a) => (
              <li key={a.id}>
                <Link to={`/panel/kalendarz?date=${d.date}&wizyta=${a.id}`} className="list-item">
                  <strong className="tabular" style={{ width: 52 }}>{fmt.time(a.start)}</strong>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {a.patientName} {a.mode === 'tele' && <Video size={14} aria-label={t('teleporada')} />}
                    </span>
                    <span className="list-sub">
                      {a.serviceName} · {a.practitionerName}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
