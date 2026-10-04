import { useMutation } from '@tanstack/react-query';
import { CalendarCheck, FileText, KeyRound, Lock, MessageSquare, ShieldCheck, Smartphone, Stethoscope, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { Me } from '../types';
import { BrandMark, Button, Checkbox, DemoBanner, Notice, Segmented, TextField } from '../ui';

export function landingFor(me: Me | undefined): string {
  if (!me?.authenticated) return '/logowanie';
  const staff = me.user?.staff;
  if (me.mfa?.required || me.mfa?.enrollRequired) return staff ? '/panel/mfa' : '/mfa';
  if (staff && me.user?.mustChangePassword) return '/panel/zmiana-hasla';
  return staff ? '/panel' : '/';
}

function AuthLayout({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const { config } = useSession();
  return (
    <>
      {config?.demoMode && <DemoBanner />}
      <div className="auth-wrap">
        <aside className={`auth-aside ${staff ? 'staff' : ''}`} aria-hidden="true">
          <div className="brand">
            <BrandMark size={36} />
            <span className="brand-name" style={{ color: '#fff' }}>
              eternal <em style={{ color: 'rgba(255,255,255,.7)' }}>{staff ? 'Doctor' : 'Pacjent'}</em>
            </span>
          </div>
          <div>
            <h2>{staff ? t('Panel placówki na wspólnych danych z aplikacją pacjenta.') : t('Twoje wizyty, wyniki i kontakt z placówką w jednym miejscu.')}</h2>
            <ul>
              {(staff
                ? [
                    [Users, t('Kalendarz, grafik i kartoteka pacjentów — zmiany widoczne u pacjenta natychmiast.')],
                    [FileText, t('Wyniki i dokumenty udostępniane jednym kliknięciem, z potwierdzeniem odczytu.')],
                    [ShieldCheck, t('Logowanie dwuskładnikowe i pełny dziennik dostępu do danych.')],
                  ]
                : [
                    [CalendarCheck, t('Rezerwacja, odwołanie i zmiana terminu bez dzwonienia.')],
                    [FileText, t('Wyniki badań i zalecenia, gdy tylko lekarz je udostępni.')],
                    [MessageSquare, t('Bezpieczne wiadomości z rejestracją i lekarzem.')],
                  ]
              ).map(([Icon, text], i) => {
                const I = Icon as typeof Users;
                return (
                  <li key={i}>
                    <I size={22} />
                    <span>{text as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="small">{t('Dane przechowywane w standardzie HL7 FHIR R4. Aplikacja nie ocenia wyników i nie zastępuje porady lekarza.')}</p>
        </aside>
        <main className="auth-panel" id="main">
          <div className="row-between" style={{ marginBottom: 28 }}>
            <Link to={staff ? '/panel/logowanie' : '/logowanie'} className="brand">
              <BrandMark />
              <span className="brand-name">
                eternal <em>{staff ? 'Doctor' : 'Pacjent'}</em>
              </span>
            </Link>
            <Segmented
              label={t('Język')}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'pl', label: 'PL' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </div>
          {children}
          {config?.clinic.emergencyInfo && <p className="small muted" style={{ marginTop: 28 }}>{t(config.clinic.emergencyInfo)}</p>}
        </main>
      </div>
    </>
  );
}

export function LoginPage({ staff }: { staff?: boolean }) {
  const { t } = useI18n();
  const { me, setMe, config } = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: () => post<Me>('/api/auth/login', { email, password }),
    onSuccess: (m) => {
      setMe(m);
      nav(landingFor(m), { replace: true });
    },
  });
  if (me?.authenticated && !login.isPending) return <Navigate to={landingFor(me)} replace />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };
  return (
    <AuthLayout staff={staff}>
      <h1>{staff ? t('Logowanie personelu') : t('Zaloguj się')}</h1>
      <p className="muted">{staff ? t('Dostęp dla lekarzy, rejestracji i administratorów placówki.') : t('Zaloguj się, aby zarządzać wizytami i zobaczyć wyniki.')}</p>
      <form className="stack" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
        {login.isError && <Notice kind="danger">{errorMessage(login.error, t)}</Notice>}
        <TextField label={t('E-mail')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label={t('Hasło')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" block loading={login.isPending} icon={<Lock size={18} />}>
          {t('Zaloguj się')}
        </Button>
        <div className="row-between small">
          <Link to="/zapomniane-haslo">{t('Nie pamiętasz hasła?')}</Link>
          {!staff ? <Link to="/rejestracja">{t('Załóż konto')}</Link> : <Link to="/logowanie">{t('Jestem pacjentem')}</Link>}
        </div>
        {!staff && (
          <p className="small muted" style={{ marginTop: 8 }}>
            {t('Pracujesz w placówce?')} <Link to="/panel/logowanie">{t('Przejdź do panelu personelu')}</Link>
          </p>
        )}
        {config?.demoMode && (
          <Notice kind="info" title={t('Konta demonstracyjne')}>
            <p className="small" style={{ margin: 0 }}>
              {staff ? 'recepcja@eternal.local · anna.nowicka@eternal.local · admin@eternal.local' : 'pacjent@eternal.local · maria@eternal.local'}
              <br />
              {t('Hasło')}: <span className="mono">Eternal-Demo-2026</span>
              {staff && (
                <>
                  <br />
                  {t('Sekret TOTP (MFA)')}: <span className="mono">JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP</span>
                </>
              )}
            </p>
          </Notice>
        )}
      </form>
    </AuthLayout>
  );
}

export function MfaPage({ staff }: { staff?: boolean }) {
  const { t } = useI18n();
  const { me, setMe, logout } = useSession();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const enroll = !!me?.mfa?.enrollRequired || (staff && !me?.mfa?.enrolled);

  const startSetup = useMutation({
    mutationFn: () => post<{ secret: string; qrDataUrl: string }>('/api/auth/mfa/setup'),
    onSuccess: setSetup,
  });
  const verify = useMutation({
    mutationFn: () => post<Me>(enroll ? '/api/auth/mfa/enable' : '/api/auth/mfa/verify', { code }),
    onSuccess: (m) => {
      setMe(m);
      nav(landingFor(m), { replace: true });
    },
  });

  useEffect(() => {
    if (enroll && !setup && !startSetup.isPending && me?.authenticated) startSetup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enroll, me?.authenticated]);

  if (!me?.authenticated) return <Navigate to={staff ? '/panel/logowanie' : '/logowanie'} replace />;
  if (!me.mfa?.required && !me.mfa?.enrollRequired) return <Navigate to={landingFor(me)} replace />;

  return (
    <AuthLayout staff={staff}>
      <h1>{enroll ? t('Skonfiguruj logowanie dwuskładnikowe') : t('Potwierdź logowanie')}</h1>
      <p className="muted">
        {enroll
          ? t('Dla kont personelu drugi składnik jest obowiązkowy. Zeskanuj kod w aplikacji uwierzytelniającej (np. Google Authenticator, Microsoft Authenticator) i wpisz 6-cyfrowy kod.')
          : t('Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.')}
      </p>
      <form
        className="stack"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          verify.mutate();
        }}
      >
        {enroll && setup && (
          <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <img src={setup.qrDataUrl} alt={t('Kod QR do aplikacji uwierzytelniającej')} className="qr" />
            <div className="small">
              <p className="muted">{t('Nie możesz zeskanować? Wpisz klucz ręcznie:')}</p>
              <p className="mono" style={{ wordBreak: 'break-all' }}>{setup.secret}</p>
            </div>
          </div>
        )}
        {verify.isError && <Notice kind="danger">{errorMessage(verify.error, t)}</Notice>}
        <TextField
          label={t('Kod z aplikacji')}
          className="input input-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
          required
        />
        <Button type="submit" block loading={verify.isPending} disabled={code.length !== 6} icon={<Smartphone size={18} />}>
          {enroll ? t('Włącz i kontynuuj') : t('Potwierdź')}
        </Button>
        <Button variant="ghost" onClick={() => void logout()}>
          {t('Wyloguj')}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { t, locale } = useI18n();
  const { me, setMe, config } = useSession();
  const nav = useNavigate();
  const [mode, setMode] = useState<'new' | 'code'>('new');
  const [f, setF] = useState({ given: '', family: '', birthDate: '', pesel: '', phone: '', email: '', password: '', password2: '', activationCode: '' });
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState('');
  const reg = useMutation({
    mutationFn: () =>
      post<Me>('/api/auth/register', {
        ...f,
        activationCode: mode === 'code' ? f.activationCode : undefined,
        pesel: mode === 'new' ? f.pesel : undefined,
        locale,
        consents,
      }),
    onSuccess: (m) => {
      setMe(m);
      nav('/', { replace: true });
    },
  });
  if (me?.authenticated) return <Navigate to={landingFor(me)} replace />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const code = errorCode(reg.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (f.password !== f.password2) return setLocalError(t('Hasła nie są identyczne.'));
    const missing = config?.consents.filter((c) => c.required && !consents[c.type]);
    if (missing?.length) return setLocalError(t('Zaakceptuj wymagane zgody, aby założyć konto.'));
    reg.mutate();
  };

  return (
    <AuthLayout>
      <h1>{t('Załóż konto')}</h1>
      <p className="muted">{t('Konto pozwala rezerwować wizyty, odbierać wyniki i pisać do placówki.')}</p>
      <form className="stack-lg" onSubmit={submit} noValidate style={{ marginTop: 12 }}>
        <Segmented
          label={t('Sposób rejestracji')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'new', label: t('Nowy pacjent') },
            { value: 'code', label: t('Mam kod z placówki') },
          ]}
        />
        {mode === 'code' && (
          <Notice kind="info">{t('Kod aktywacyjny otrzymasz w rejestracji po okazaniu dokumentu tożsamości. Połączy konto z Twoją kartoteką i od razu da dostęp do wyników.')}</Notice>
        )}
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">{t('Dane osobowe')}</legend>
          {mode === 'code' && (
            <TextField label={t('Kod aktywacyjny')} value={f.activationCode} onChange={set('activationCode')} placeholder="ABCD-EFGH-JK" autoComplete="off" required />
          )}
          <div className="grid-2">
            <TextField label={t('Imię')} value={f.given} onChange={set('given')} autoComplete="given-name" required />
            <TextField label={t('Nazwisko')} value={f.family} onChange={set('family')} autoComplete="family-name" required />
          </div>
          <div className="grid-2">
            <TextField label={t('Data urodzenia')} type="date" value={f.birthDate} onChange={set('birthDate')} autoComplete="bday" required={mode === 'code'} />
            {mode === 'new' && (
              <TextField label={t('PESEL (opcjonalnie)')} inputMode="numeric" maxLength={11} value={f.pesel} onChange={set('pesel')} hint={t('Potrzebny do dokumentacji medycznej — możesz podać go w placówce.')} />
            )}
          </div>
          <div className="grid-2">
            <TextField label={t('E-mail')} type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
            <TextField label={t('Telefon (opcjonalnie)')} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
          </div>
          <div className="grid-2">
            <TextField
              label={t('Hasło')}
              type="password"
              value={f.password}
              onChange={set('password')}
              autoComplete="new-password"
              hint={t('Co najmniej {n} znaków. Sprawdzamy, czy hasło nie wyciekło (bez wysyłania hasła).', { n: config?.passwordMinLength ?? 10 })}
              required
            />
            <TextField label={t('Powtórz hasło')} type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" required />
          </div>
        </fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 650, marginBottom: 8 }}>{t('Zgody i oświadczenia')}</legend>
          {config?.consents.map((c) => (
            <Checkbox
              key={c.type}
              checked={!!consents[c.type]}
              onChange={(e) => setConsents({ ...consents, [c.type]: e.target.checked })}
              label={
                <>
                  {locale === 'en' ? c.label.en : c.label.pl}
                  {c.required ? <strong> *</strong> : <span className="muted"> ({t('dobrowolna, możesz zmienić później')})</span>}
                </>
              }
            />
          ))}
          <p className="small muted">{t('Administratorem danych jest placówka medyczna. Kontakt z inspektorem ochrony danych: {c}.', { c: config?.clinic.privacyContact || '—' })}</p>
        </fieldset>
        {(localError || reg.isError) && (
          <Notice kind="danger">
            {localError || errorMessage(reg.error, t)}
            {code === 'pesel_registered_use_activation_code' && (
              <p style={{ marginTop: 6 }}>
                <Button size="sm" variant="secondary" onClick={() => setMode('code')}>
                  {t('Mam kod aktywacyjny')}
                </Button>
              </p>
            )}
          </Notice>
        )}
        <Button type="submit" block loading={reg.isPending} icon={<KeyRound size={18} />}>
          {t('Załóż konto')}
        </Button>
        <p className="small">
          {t('Masz już konto?')} <Link to="/logowanie">{t('Zaloguj się')}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const m = useMutation({ mutationFn: () => post('/api/auth/password/forgot', { email }) });
  return (
    <AuthLayout>
      <h1>{t('Reset hasła')}</h1>
      {m.isSuccess ? (
        <Notice kind="ok">{t('Jeśli konto istnieje, wysłaliśmy na podany adres link do ustawienia nowego hasła. Link jest ważny 60 minut.')}</Notice>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <p className="muted">{t('Podaj adres e-mail konta — wyślemy link do ustawienia nowego hasła.')}</p>
          {m.isError && <Notice kind="danger">{errorMessage(m.error, t)}</Notice>}
          <TextField label={t('E-mail')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" loading={m.isPending}>
            {t('Wyślij link')}
          </Button>
        </form>
      )}
      <p className="small" style={{ marginTop: 16 }}>
        <Link to="/logowanie">{t('Wróć do logowania')}</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => post('/api/auth/password/reset', { token: params.get('token') ?? '', password }) });
  return (
    <AuthLayout>
      <h1>{t('Ustaw nowe hasło')}</h1>
      {m.isSuccess ? (
        <Notice kind="ok">
          {t('Hasło zostało zmienione. Wylogowaliśmy wszystkie sesje.')} <Link to="/logowanie">{t('Zaloguj się')}</Link>
        </Notice>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          {m.isError && <Notice kind="danger">{errorMessage(m.error, t)}</Notice>}
          <TextField label={t('Nowe hasło')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={m.isPending}>
            {t('Zapisz hasło')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const m = useMutation({ mutationFn: () => post('/api/auth/verify-email', { token: params.get('token') ?? '' }) });
  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AuthLayout>
      <h1>{t('Potwierdzenie adresu e-mail')}</h1>
      {m.isPending && <p>{t('Sprawdzam link…')}</p>}
      {m.isSuccess && <Notice kind="ok">{t('Adres e-mail został potwierdzony.')}</Notice>}
      {m.isError && <Notice kind="danger">{errorMessage(m.error, t)}</Notice>}
      <p style={{ marginTop: 16 }}>
        <Link to="/">{t('Przejdź do aplikacji')}</Link>
      </p>
    </AuthLayout>
  );
}

export function ChangePasswordPage({ forced }: { forced?: boolean }) {
  const { t } = useI18n();
  const { setMe } = useSession();
  const nav = useNavigate();
  const [f, setF] = useState({ current: '', next: '', next2: '' });
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: () => post<Me>('/api/auth/password/change', { current: f.current, next: f.next }),
    onSuccess: (me) => {
      setMe(me);
      nav(landingFor(me), { replace: true });
    },
  });
  const content = (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setErr('');
        if (f.next !== f.next2) return setErr(t('Hasła nie są identyczne.'));
        m.mutate();
      }}
    >
      {forced && <Notice kind="warn">{t('Konto zostało utworzone z hasłem tymczasowym. Ustaw własne hasło, aby kontynuować.')}</Notice>}
      {(err || m.isError) && <Notice kind="danger">{err || errorMessage(m.error, t)}</Notice>}
      <TextField label={t('Obecne hasło')} type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
      <TextField label={t('Nowe hasło')} type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
      <TextField label={t('Powtórz nowe hasło')} type="password" autoComplete="new-password" value={f.next2} onChange={(e) => setF({ ...f, next2: e.target.value })} required />
      <Button type="submit" loading={m.isPending} icon={<Stethoscope size={18} />}>
        {t('Zmień hasło')}
      </Button>
    </form>
  );
  return forced ? (
    <AuthLayout staff>
      <h1>{t('Ustaw własne hasło')}</h1>
      {content}
    </AuthLayout>
  ) : (
    content
  );
}
