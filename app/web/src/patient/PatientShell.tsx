import { useQuery } from '@tanstack/react-query';
import { Activity, Bell, CalendarDays, FileText, Home, LogOut, Menu, MessageSquare, Pill, Search, Shield, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { get } from '../api';
import { useI18n } from '../i18n';
import { useRealtime, type LiveEvent } from '../realtime';
import { useSession } from '../session';
import { BrandMark, Button, DemoBanner, Notice, Spinner, useToast } from '../ui';

const LIVE_MESSAGES: Record<string, string> = {
  'appointment.changed': 'Zaktualizowano Twoje wizyty.',
  'report.changed': 'Placówka zaktualizowała Twoje wyniki.',
  'document.changed': 'Placówka zaktualizowała Twoje dokumenty.',
  'message.changed': 'Nowa aktywność w wiadomościach.',
};

function NavItem({ to, icon, label, badge, end }: { to: string; icon: ReactNode; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end}>
      {icon}
      <span>{label}</span>
      {!!badge && (
        <span className="count-badge" aria-label={`${badge}`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

export function PatientShell() {
  const { me, config, loading, logout } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const location = useLocation();
  const authed = !!me?.authenticated && !me.user?.staff && !me.mfa?.required;
  const badges = useQuery({
    queryKey: ['badges'],
    queryFn: () => get<{ notifications: number; messages: number }>('/api/me/badges'),
    enabled: authed,
    refetchInterval: 120_000,
  });
  useRealtime(authed, (e: LiveEvent) => {
    const msg = LIVE_MESSAGES[e.type];
    if (msg && document.visibilityState === 'visible') toast(t(msg));
  });

  if (loading) return <Spinner />;
  if (!me?.authenticated) return <Navigate to="/logowanie" replace state={{ from: location.pathname }} />;
  if (me.user?.staff) return <Navigate to="/panel" replace />;
  if (me.mfa?.required) return <Navigate to="/mfa" replace />;

  const unreadMsg = badges.data?.messages ?? 0;
  const unreadNotif = badges.data?.notifications ?? 0;

  return (
    <div className="p-shell">
      <a href="#main" className="skip-link">
        {t('Przejdź do treści')}
      </a>
      {config?.demoMode && <DemoBanner />}
      <header className="p-header">
        <div className="p-header-inner">
          <Link to="/" className="brand" aria-label={t('Strona główna')}>
            <BrandMark />
            <span className="brand-name">
              eternal <em>Pacjent</em>
            </span>
          </Link>
          <span className="grow small muted" style={{ textAlign: 'center' }}>
            {config?.clinic.name}
          </span>
          <Link to="/powiadomienia" className="btn ghost icon" aria-label={t('Powiadomienia ({n} nieprzeczytanych)', { n: unreadNotif })} style={{ position: 'relative' }}>
            <Bell size={22} />
            {unreadNotif > 0 && (
              <span className="count-badge" style={{ position: 'absolute', top: 4, right: 4 }}>
                {unreadNotif > 9 ? '9+' : unreadNotif}
              </span>
            )}
          </Link>
        </div>
      </header>
      {me.user && !me.user.emailVerified && (
        <div style={{ maxWidth: 1080, margin: '12px auto 0', padding: '0 16px', width: '100%' }}>
          <Notice kind="warn">{t('Potwierdź adres e-mail — wysłaliśmy link na {email}.', { email: me.user.email })}</Notice>
        </div>
      )}
      <div className="p-body">
        <aside className="p-side" aria-label={t('Menu główne')}>
          <nav>
            <NavItem to="/" end icon={<Home size={20} />} label={t('Start')} />
            <NavItem to="/wizyty" icon={<CalendarDays size={20} />} label={t('Wizyty')} />
            <NavItem to="/wyniki" icon={<FileText size={20} />} label={t('Wyniki i dokumenty')} />
            <NavItem to="/wiadomosci" icon={<MessageSquare size={20} />} label={t('Wiadomości')} badge={unreadMsg} />
            <NavItem to="/pomiary" icon={<Activity size={20} />} label={t('Pomiary')} />
            <NavItem to="/leki" icon={<Pill size={20} />} label={t('Leki')} />
            <div className="side-sep" />
            <NavItem to="/nfz" icon={<Search size={20} />} label={t('Terminy NFZ')} />
            <NavItem to="/prywatnosc" icon={<Shield size={20} />} label={t('Prywatność i zgody')} />
            <NavItem to="/profil" icon={<User size={20} />} label={t('Profil i bezpieczeństwo')} />
            <div className="side-sep" />
            <button type="button" className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => void logout()}>
              <LogOut size={20} /> {t('Wyloguj')}
            </button>
          </nav>
        </aside>
        <main className="p-main" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <footer className="p-footer">
        {t('Aplikacja nie ocenia wyników i nie zastępuje porady lekarza.')} {config?.clinic.emergencyInfo && t(config.clinic.emergencyInfo)}
      </footer>
      <nav className="tabbar" aria-label={t('Menu główne')}>
        <NavLink to="/" end>
          <Home size={22} aria-hidden />
          {t('Start')}
        </NavLink>
        <NavLink to="/wizyty">
          <CalendarDays size={22} aria-hidden />
          {t('Wizyty')}
        </NavLink>
        <NavLink to="/wyniki">
          <FileText size={22} aria-hidden />
          {t('Wyniki')}
        </NavLink>
        <NavLink to="/wiadomosci">
          <MessageSquare size={22} aria-hidden />
          {t('Wiadomości')}
          {unreadMsg > 0 && <span className="count-badge">{unreadMsg}</span>}
        </NavLink>
        <NavLink to="/wiecej">
          <Menu size={22} aria-hidden />
          {t('Więcej')}
        </NavLink>
      </nav>
    </div>
  );
}

export function MorePage() {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const items: [string, ReactNode, string][] = [
    ['/pomiary', <Activity size={20} key="a" />, t('Pomiary')],
    ['/leki', <Pill size={20} key="b" />, t('Leki')],
    ['/nfz', <Search size={20} key="c" />, t('Terminy NFZ')],
    ['/powiadomienia', <Bell size={20} key="d" />, t('Powiadomienia')],
    ['/prywatnosc', <Shield size={20} key="e" />, t('Prywatność i zgody')],
    ['/profil', <User size={20} key="f" />, t('Profil i bezpieczeństwo')],
  ];
  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>{me?.patient?.name}</h1>
        <p className="muted">{me?.user?.email}</p>
      </div>
      <div className="card card-flush">
        <ul className="list">
          {items.map(([to, icon, label]) => (
            <li key={to}>
              <Link to={to} className="list-item">
                <span className="list-icon">{icon}</span>
                <span className="list-title grow">{label}</span>
                <span aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void logout()}>
        {t('Wyloguj')}
      </Button>
    </div>
  );
}
