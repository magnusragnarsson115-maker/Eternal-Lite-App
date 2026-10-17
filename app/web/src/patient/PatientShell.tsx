import { useQuery } from '@tanstack/react-query';
import { Activity, AlarmClock, BookHeart, Bell, BriefcaseMedical, CalendarCheck, Wind, CalendarRange, Dumbbell, Stethoscope, Syringe, CalendarDays, ClipboardCheck, ClipboardList, FileChartColumn, FileText, Flower2, FolderOpen, Home, LayoutGrid, LifeBuoy, LogOut, Menu, MessageSquare, Pill, Search, Share2, Shield, Siren, User, Users } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get, msSinceOwnMutation } from '../api';
import { useI18n } from '../i18n';
import { useRealtime, type LiveEvent } from '../realtime';
import { useSession } from '../session';
import { OfflineBanner, useOfflineRefresh } from './OfflinePages';
import { VoiceNavButton } from './VoiceNav';
import { BrandMark, Button, DemoBanner, FullText, Notice, Spinner, useToast } from '../ui';
import { ProfileSwitcher, ProxyBanner } from './FamilyPages';
import { StatusBanner } from '../shared/SystemStatus';

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
  const { me, config, loading, logout, profile, profiles, switchProfile } = useSession();
  const navigate = useNavigate();
  // tryb opiekuna (A24.2): obszary osobiste konta (ankiety, SOS, profil i bezpieczeństwo) zostają przy właścicielu
  const proxy = !!profile;
  const { t } = useI18n();
  const toast = useToast();
  useOfflineRefresh();
  const location = useLocation();
  const authed = !!me?.authenticated && !me.user?.staff && !me.mfa?.required;
  const badges = useQuery({
    queryKey: ['badges'],
    queryFn: () => get<{ notifications: number; messages: number }>('/api/me/badges'),
    enabled: authed,
    refetchInterval: 120_000,
  });
  // link z powiadomienia dla opiekuna (…?profile=<id>) otwiera właściwy profil
  const linkProfile = new URLSearchParams(location.search).get('profile');
  useEffect(() => {
    if (!linkProfile || !profiles.length) return;
    const target = profiles.find((p) => p.id === linkProfile);
    if (target && (target.self ? !!profile : profile?.id !== target.id)) switchProfile(target.self ? undefined : target.id);
    const params = new URLSearchParams(location.search);
    params.delete('profile');
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
  }, [linkProfile, profiles, profile, switchProfile, navigate, location.pathname, location.search]);
  useRealtime(authed, (e: LiveEvent) => {
    const msg = LIVE_MESSAGES[e.type];
    if (msg && document.visibilityState === 'visible' && msSinceOwnMutation() > 5000) toast(t(msg));
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
          <span className="grow small muted header-clinic" style={{ textAlign: 'center' }}>
            {config?.clinic.name}
          </span>
          <VoiceNavButton />
          <ProfileSwitcher />
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
      <ProxyBanner />
      <StatusBanner />
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
            <NavItem to="/kalendarz" icon={<CalendarRange size={20} />} label={t('Kalendarz zdrowia')} />
            <NavItem to="/wyniki" icon={<FileText size={20} />} label={t('Wyniki od placówki')} />
            <NavItem to="/dokumenty" icon={<FolderOpen size={20} />} label={t('Moje dokumenty')} />
            <NavItem to="/karty" icon={<ClipboardCheck size={20} />} label={t('Karty „Po wizycie”')} />
            <NavItem to="/wiadomosci" icon={<MessageSquare size={20} />} label={t('Wiadomości')} badge={unreadMsg} />
            <NavItem to="/pomiary" icon={<Activity size={20} />} label={t('Pomiary')} />
            <NavItem to="/raport" icon={<FileChartColumn size={20} />} label={t('Raport okresowy')} />
            <NavItem to="/dla-lekarza" icon={<Stethoscope size={20} />} label={t('Dla lekarza i na wyjazd')} />
            {!proxy && <NavItem to="/ankiety" icon={<ClipboardList size={20} />} label={t('Ankiety')} />}
            <NavItem to="/leki" icon={<Pill size={20} />} label={t('Leki')} />
            <NavItem to="/dzienniki" icon={<BookHeart size={20} />} label={t('Dzienniki')} />
            <NavItem to="/zdrowie-kobiety" icon={<Flower2 size={20} />} label={t('Zdrowie kobiety')} />
            <NavItem to="/historia-zdrowia" icon={<Syringe size={20} />} label={t('Historia zdrowia')} />
            <NavItem to="/plan" icon={<Dumbbell size={20} />} label={t('Plan i cele')} />
            <NavItem to="/przypomnienia" icon={<AlarmClock size={20} />} label={t('Przypomnienia')} />
            <NavItem to="/profilaktyka" icon={<CalendarCheck size={20} />} label={t('Profilaktyka NFZ')} />
            <NavItem to="/apteki" icon={<BriefcaseMedical size={20} />} label={t('Apteki i refundacja')} />
            {!proxy && <NavItem to="/powietrze" icon={<Wind size={20} />} label={t('Powietrze i pogoda')} />}
            <div className="side-sep" />
            <NavItem to="/rodzina" icon={<Users size={20} />} label={t('Rodzina i opiekunowie')} />
            <NavItem to="/nfz" icon={<Search size={20} />} label={t('Terminy NFZ')} />
            <NavItem to="/udostepnianie" icon={<Share2 size={20} />} label={t('Komu udostępniam')} />
            <NavItem to="/prywatnosc" icon={<Shield size={20} />} label={t('Prywatność i zgody')} />
            {!proxy && <NavItem to="/profil" icon={<User size={20} />} label={t('Profil i bezpieczeństwo')} />}
            {!proxy && <NavItem to="/bezpieczenstwo" icon={<Siren size={20} />} label={t('SOS i karta ratunkowa')} />}
            <NavItem to="/pomoc" icon={<LifeBuoy size={20} />} label={t('Pomoc · 112 · 116 123')} />
            {config?.demoMode && <NavItem to="/moduly" icon={<LayoutGrid size={20} />} label={t('Moduły i funkcje')} />}
            <div className="side-sep" />
            <button type="button" className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => void logout()}>
              <LogOut size={20} /> {t('Wyloguj')}
            </button>
          </nav>
        </aside>
        <main className="p-main" id="main" tabIndex={-1}>
          <OfflineBanner />
          <Outlet />
        </main>
      </div>
      <footer className="p-footer">
        <FullText text="Aplikacja nie ocenia wyników i nie zastępuje porady lekarza." /> {config?.clinic.emergencyInfo && t(config.clinic.emergencyInfo)}
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
  const { me, config, logout, profile } = useSession();
  const own = (x: [string, ReactNode, string]) => (profile ? [] : [x]);
  const items: [string, ReactNode, string][] = [
    ['/pomoc', <LifeBuoy size={20} key="h" />, t('Pomoc · 112 · 116 123')],
    ['/rodzina', <Users size={20} key="ro" />, t('Rodzina i opiekunowie')],
    ...own(['/bezpieczenstwo', <Siren size={20} key="s" />, t('SOS i karta ratunkowa')]),
    ['/dokumenty', <FolderOpen size={20} key="dd" />, t('Moje dokumenty')],
    ['/karty', <ClipboardCheck size={20} key="k" />, t('Karty „Po wizycie”')],
    ['/udostepnianie', <Share2 size={20} key="u" />, t('Komu udostępniam')],
    ['/pomiary', <Activity size={20} key="a" />, t('Pomiary')],
    ['/raport', <FileChartColumn size={20} key="r" />, t('Raport okresowy')],
    ['/dla-lekarza', <Stethoscope size={20} key="dl" />, t('Dla lekarza i na wyjazd')],
    ...own(['/ankiety', <ClipboardList size={20} key="an" />, t('Ankiety')]),
    ['/leki', <Pill size={20} key="b" />, t('Leki')],
    ['/dzienniki', <BookHeart size={20} key="dz" />, t('Dzienniki')],
    ['/zdrowie-kobiety', <Flower2 size={20} key="zk" />, t('Zdrowie kobiety')],
    ['/historia-zdrowia', <Syringe size={20} key="hz" />, t('Historia zdrowia')],
    ['/plan', <Dumbbell size={20} key="pl" />, t('Plan i cele')],
    ['/przypomnienia', <AlarmClock size={20} key="pr" />, t('Przypomnienia')],
    ['/profilaktyka', <CalendarCheck size={20} key="pf" />, t('Profilaktyka NFZ')],
    ['/apteki', <BriefcaseMedical size={20} key="ap" />, t('Apteki i refundacja')],
    ...own(['/powietrze', <Wind size={20} key="pw" />, t('Powietrze i pogoda')]),
    ['/kalendarz', <CalendarRange size={20} key="ka" />, t('Kalendarz zdrowia')],
    ['/nfz', <Search size={20} key="c" />, t('Terminy NFZ')],
    ['/powiadomienia', <Bell size={20} key="d" />, t('Powiadomienia')],
    ['/prywatnosc', <Shield size={20} key="e" />, t('Prywatność i zgody')],
    ...own(['/profil', <User size={20} key="f" />, t('Profil i bezpieczeństwo')]),
    ...(config?.demoMode ? ([['/moduly', <LayoutGrid size={20} key="mm" />, t('Moduły i funkcje')]] as [string, ReactNode, string][]) : []),
  ];
  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>{profile?.name ?? me?.patient?.name}</h1>
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
