import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, CalendarRange, LayoutDashboard, LogOut, Menu, MessageSquare, Send, Settings, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { get } from '../api';
import { useI18n } from '../i18n';
import { useRealtime, type LiveEvent } from '../realtime';
import { hasRole, useSession } from '../session';
import { BrandMark, Button, DemoBanner, Segmented, Spinner, useToast } from '../ui';

export function StaffShell() {
  const { me, config, loading, logout } = useSession();
  const { t, locale, setLocale } = useI18n();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const authed = !!me?.authenticated && !!me.user?.staff && !me.mfa?.required && !me.user.mustChangePassword;
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ unread: number }>('/api/notifications'), enabled: authed, refetchInterval: 60_000 });
  const threads = useQuery({ queryKey: ['threads', 'staff'], queryFn: () => get<{ items: { unread: boolean }[] }>('/api/staff/threads'), enabled: authed, refetchInterval: 120_000 });
  const live = useRealtime(authed, (e: LiveEvent) => {
    if (e.type === 'notification.created') void notifications.refetch();
    if (e.type === 'message.changed') void threads.refetch();
  });
  // powiadomienia w czasie rzeczywistym z treścią — z listy powiadomień użytkownika
  const lastUnread = notifications.data?.unread ?? 0;
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (notifications.data === undefined) return;
    if (seen.current !== undefined && lastUnread > seen.current) toast(t('Nowe powiadomienie — sprawdź dzwonek.'));
    seen.current = lastUnread;
  }, [lastUnread, notifications.data, toast, t]);

  if (loading) return <Spinner />;
  if (!me?.authenticated) return <Navigate to="/panel/logowanie" replace state={{ from: location.pathname }} />;
  if (!me.user?.staff) return <Navigate to="/" replace />;
  if (me.mfa?.required || me.mfa?.enrollRequired) return <Navigate to="/panel/mfa" replace />;
  if (me.user.mustChangePassword) return <Navigate to="/panel/zmiana-hasla" replace />;

  const unreadThreads = threads.data?.items.filter((x) => x.unread).length ?? 0;
  const roleLabel = me.user.roles.includes('practitioner') ? t('Lekarz') : me.user.roles.includes('admin') ? t('Administrator') : t('Rejestracja');

  return (
    <>
      {config?.demoMode && <DemoBanner />}
      <div className="s-shell">
        <a href="#main" className="skip-link">
          {t('Przejdź do treści')}
        </a>
        <aside className={`s-side ${open ? 'open' : ''}`} aria-label={t('Menu panelu')}>
          <div className="row-between">
            <Link to="/panel" className="brand" onClick={() => setOpen(false)}>
              <BrandMark />
              <span className="brand-name">
                eternal <em>Doctor</em>
              </span>
            </Link>
            {open && <Button variant="ghost" size="sm" aria-label={t('Zamknij menu')} icon={<X size={18} color="#fff" />} onClick={() => setOpen(false)} />}
          </div>
          <nav onClick={() => setOpen(false)}>
            <NavLink to="/panel" end>
              <LayoutDashboard size={19} /> {t('Pulpit')}
            </NavLink>
            <NavLink to="/panel/kalendarz">
              <CalendarDays size={19} /> {t('Kalendarz')}
            </NavLink>
            <NavLink to="/panel/pacjenci">
              <Users size={19} /> {t('Pacjenci')}
            </NavLink>
            <NavLink to="/panel/wiadomosci">
              <MessageSquare size={19} /> {t('Wiadomości')}
              {unreadThreads > 0 && <span className="count-badge">{unreadThreads}</span>}
            </NavLink>
            <div className="nav-label">{t('Organizacja')}</div>
            <NavLink to="/panel/grafik">
              <CalendarRange size={19} /> {t('Grafik')}
            </NavLink>
            {hasRole(me, 'admin', 'reception') && (
              <NavLink to="/panel/wysylka">
                <Send size={19} /> {t('Wysyłka powiadomień')}
              </NavLink>
            )}
            {hasRole(me, 'admin') && (
              <NavLink to="/panel/admin">
                <Settings size={19} /> {t('Administracja')}
              </NavLink>
            )}
          </nav>
          <div className="side-foot">
            <div style={{ color: '#fff', fontWeight: 600 }}>{me.user.displayName}</div>
            <div style={{ color: '#9fc1c8', marginBottom: 8 }}>{roleLabel}</div>
            <div className="row" style={{ gap: 6, fontSize: '0.78rem', color: '#9fc1c8', marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: live.connected ? '#5fd38d' : '#ffb35c' }} aria-hidden />
              {live.connected ? t('Synchronizacja na żywo') : t('Łączenie…')}
            </div>
            <button type="button" className="btn sm" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', width: '100%' }} onClick={() => void logout()}>
              <LogOut size={16} /> {t('Wyloguj')}
            </button>
          </div>
        </aside>
        <div className="s-main">
          <header className="s-top">
            <Button variant="ghost" className="s-menu-btn" aria-label={t('Otwórz menu')} icon={<Menu size={22} />} onClick={() => setOpen(true)} />
            <strong className="grow">{config?.clinic.name}</strong>
            <Segmented label={t('Język')} value={locale} onChange={setLocale} options={[{ value: 'pl', label: 'PL' }, { value: 'en', label: 'EN' }]} />
            <Link to="/panel/powiadomienia" className="btn ghost icon" aria-label={t('Powiadomienia ({n} nieprzeczytanych)', { n: lastUnread })} style={{ position: 'relative' }}>
              <Bell size={21} />
              {lastUnread > 0 && (
                <span className="count-badge" style={{ position: 'absolute', top: 4, right: 4 }}>
                  {lastUnread > 9 ? '9+' : lastUnread}
                </span>
              )}
            </Link>
          </header>
          <main className="s-content" id="main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
