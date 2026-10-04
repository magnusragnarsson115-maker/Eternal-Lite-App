import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Download, History, MapPin, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, qs } from '../api';
import { ChangePasswordPage } from '../auth/AuthPages';
import { errorMessage } from '../errors';
import { useI18n, type Locale } from '../i18n';
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../lib/push';
import { useSession } from '../session';
import type { AccessLogEntry, ConsentState, Me, NotificationRow, PatientView } from '../types';
import { Badge, Button, Card, Empty, Modal, Notice, PageHead, QueryError, Segmented, SelectField, Skeleton, Switch, TextArea, TextField, useConfirm, useToast } from '../ui';

// --- profil i bezpieczeństwo ------------------------------------------------------------------------

export function ProfilePage() {
  const { t, locale, setLocale } = useI18n();
  const { me, config, setMe } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => get<PatientView>('/api/me/profile') });
  const [f, setF] = useState<{ phone: string; line: string; postalCode: string; city: string } | null>(null);
  useEffect(() => {
    if (profile.data && !f) setF({ phone: profile.data.phone ?? '', line: profile.data.address?.line ?? '', postalCode: profile.data.address?.postalCode ?? '', city: profile.data.address?.city ?? '' });
  }, [profile.data, f]);
  const save = useMutation({
    mutationFn: () => put<PatientView>('/api/me/profile', { phone: f?.phone || undefined, address: { line: f?.line, postalCode: f?.postalCode, city: f?.city } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      toast(t('Zapisano dane kontaktowe.'));
    },
  });
  const changeLocale = (l: Locale) => {
    setLocale(l);
    void put('/api/auth/locale', { locale: l });
  };

  // push
  const [pushOn, setPushOn] = useState(false);
  const [pushErr, setPushErr] = useState('');
  useEffect(() => {
    void currentPushSubscription().then((s) => setPushOn(!!s));
  }, []);
  const togglePush = async (on: boolean) => {
    setPushErr('');
    try {
      if (on) {
        await enablePush(config?.vapidPublicKey ?? '');
        await put('/api/me/consents/reminders-push', { granted: true });
      } else {
        await disablePush();
        await put('/api/me/consents/reminders-push', { granted: false });
      }
      setPushOn(on);
    } catch (err) {
      setPushErr((err as Error).message === 'permission_denied' ? t('Przeglądarka zablokowała powiadomienia. Zmień to w ustawieniach witryny.') : t('Nie udało się włączyć powiadomień push.'));
    }
  };

  // MFA (opcjonalne dla pacjenta)
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const startMfa = useMutation({ mutationFn: () => post<{ secret: string; qrDataUrl: string }>('/api/auth/mfa/setup'), onSuccess: setMfaSetup });
  const enableMfa = useMutation({
    mutationFn: () => post<Me>('/api/auth/mfa/enable', { code }),
    onSuccess: (m) => {
      setMe(m);
      setMfaSetup(null);
      setCode('');
      toast(t('Logowanie dwuskładnikowe włączone.'));
    },
  });

  if (profile.isLoading || !f) return <Skeleton count={3} />;
  if (profile.isError) return <QueryError error={profile.error} />;
  const p = profile.data!;

  return (
    <div className="stack-lg">
      <PageHead title={t('Profil i bezpieczeństwo')} />
      <Card title={t('Dane osobowe')}>
        <dl className="kv">
          <dt>{t('Imię i nazwisko')}</dt>
          <dd>{p.name}</dd>
          <dt>{t('Data urodzenia')}</dt>
          <dd>{p.birthDate ?? '—'}</dd>
          <dt>PESEL</dt>
          <dd>{p.pesel ?? '—'}</dd>
          <dt>{t('E-mail')}</dt>
          <dd>{me?.user?.email}</dd>
          <dt>{t('Tożsamość')}</dt>
          <dd>{p.identityVerified ? <Badge kind="ok">{t('Potwierdzona w placówce')}</Badge> : <Badge kind="warn">{t('Niepotwierdzona')}</Badge>}</dd>
        </dl>
        <p className="small muted" style={{ marginTop: 10 }}>{t('Zmianę imienia, nazwiska lub numeru PESEL zgłoś w rejestracji (wymaga okazania dokumentu).')}</p>
      </Card>

      <Card title={t('Dane kontaktowe')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <TextField label={t('Telefon')} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <TextField label={t('Ulica i numer')} value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} />
          <div className="grid-2">
            <TextField label={t('Kod pocztowy')} value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} />
            <TextField label={t('Miejscowość')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </div>
          {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
          <Button type="submit" loading={save.isPending} style={{ alignSelf: 'flex-start' }}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>

      <Card title={t('Język i powiadomienia')}>
        <div className="stack">
          <div className="row-between">
            <span>{t('Język aplikacji')}</span>
            <Segmented label={t('Język')} value={locale} onChange={changeLocale} options={[{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]} />
          </div>
          <div className="row-between">
            <span>
              {pushOn ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />} {t('Powiadomienia push na tym urządzeniu')}
              <span className="small muted" style={{ display: 'block' }}>{t('Bez treści medycznych — tylko informacja, że coś czeka w aplikacji.')}</span>
            </span>
            <Switch checked={pushOn} onChange={(v) => void togglePush(v)} label={t('Powiadomienia push')} disabled={!pushSupported()} />
          </div>
          {!pushSupported() && <p className="small muted">{t('Ta przeglądarka nie obsługuje powiadomień push (lub połączenie nie jest szyfrowane).')}</p>}
          {pushErr && <Notice kind="danger">{pushErr}</Notice>}
          <p className="small muted">
            {t('Przypomnienia e-mail i SMS włączysz w')} <Link to="/prywatnosc">{t('ustawieniach prywatności')}</Link>.
          </p>
        </div>
      </Card>

      <Card title={t('Logowanie dwuskładnikowe')}>
        {me?.mfa?.enrolled ? (
          <p>
            <Badge kind="ok">
              <ShieldCheck size={14} /> {t('Włączone')}
            </Badge>{' '}
            <span className="muted small">{t('Przy logowaniu poprosimy o kod z aplikacji uwierzytelniającej.')}</span>
          </p>
        ) : mfaSetup ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              enableMfa.mutate();
            }}
          >
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <img src={mfaSetup.qrDataUrl} alt={t('Kod QR do aplikacji uwierzytelniającej')} className="qr" />
              <p className="small mono" style={{ wordBreak: 'break-all', maxWidth: 260 }}>{mfaSetup.secret}</p>
            </div>
            <TextField label={t('Kod z aplikacji')} className="input input-otp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            {enableMfa.isError && <Notice kind="danger">{errorMessage(enableMfa.error, t)}</Notice>}
            <Button type="submit" disabled={code.length !== 6} loading={enableMfa.isPending} style={{ alignSelf: 'flex-start' }}>
              {t('Włącz')}
            </Button>
          </form>
        ) : (
          <>
            <p className="small muted">{t('Dodatkowa ochrona konta: oprócz hasła poprosimy o kod z aplikacji w telefonie.')}</p>
            <Button variant="secondary" onClick={() => startMfa.mutate()} loading={startMfa.isPending}>
              {t('Skonfiguruj')}
            </Button>
          </>
        )}
      </Card>

      <Card title={t('Zmiana hasła')}>
        <ChangePasswordPage />
      </Card>
    </div>
  );
}

// --- prywatność --------------------------------------------------------------------------------------

const AUDIT_LABELS: Record<string, string> = {
  login: 'Logowanie',
  'login-password-ok': 'Logowanie (hasło)',
  logout: 'Wylogowanie',
  'patient-read': 'Otwarcie karty pacjenta',
  'patient-clinical-read': 'Wgląd w dane medyczne',
  'patient-search': 'Wyszukiwanie w kartotece',
  'patient-update': 'Zmiana danych osobowych',
  'patient-create': 'Utworzenie kartoteki',
  'appointment-read': 'Wgląd w wizytę',
  'appointment-book-online': 'Rezerwacja online',
  'appointment-book-staff': 'Rezerwacja przez placówkę',
  'appointment-cancel-patient': 'Odwołanie wizyty przez pacjenta',
  'appointment-cancel-staff': 'Odwołanie wizyty przez placówkę',
  'record-read': 'Odczyt wyniku lub dokumentu',
  'records-list': 'Lista wyników',
  'record-share': 'Udostępnienie dokumentu',
  'record-unshare': 'Cofnięcie udostępnienia',
  'report-create': 'Dodanie wyniku',
  'document-create': 'Dodanie dokumentu',
  'file-download': 'Pobranie pliku',
  'message-send': 'Wysłanie wiadomości',
  'thread-read': 'Odczyt wiadomości',
  'consent-grant': 'Wyrażenie zgody',
  'consent-withdraw': 'Wycofanie zgody',
  'measurement-manual': 'Dodanie pomiaru',
  'measurement-bluetooth': 'Pomiar z urządzenia Bluetooth',
  'patient-export': 'Eksport danych',
  'identity-verified': 'Potwierdzenie tożsamości',
  'reminder-sent': 'Wysłanie przypomnienia',
  'reminder-manual': 'Przypomnienie wysłane przez placówkę',
  'questionnaire-submit': 'Wypełnienie wywiadu',
  'tele-join': 'Dołączenie do teleporady',
  'fhir-read': 'Odczyt przez interfejs FHIR',
  'fhir-search': 'Wyszukiwanie przez interfejs FHIR',
  'account-register': 'Założenie konta',
  'activation-code-issued': 'Wydanie kodu aktywacyjnego',
  'activation-code-used': 'Użycie kodu aktywacyjnego',
  'medication-add': 'Dodanie leku',
  'medication-stop': 'Odstawienie leku',
  'waitlist-join': 'Zapis na listę oczekujących',
};

const ROLE_LABELS: Record<string, string> = { patient: 'Ty', practitioner: 'Lekarz', reception: 'Rejestracja', admin: 'Administrator', staff: 'Personel', system: 'System' };

export function PrivacyPage() {
  const { t, fmt, locale } = useI18n();
  const { config, logout } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [historyFor, setHistoryFor] = useState<ConsentState | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const consents = useQuery({ queryKey: ['consents'], queryFn: () => get<{ items: ConsentState[] }>('/api/me/consents') });
  const log = useQuery({ queryKey: ['access-log'], queryFn: () => get<{ items: AccessLogEntry[] }>('/api/me/access-log') });
  const history = useQuery({
    queryKey: ['consent-history', historyFor?.type],
    queryFn: () => get<{ items: { at: string; granted: boolean; version?: string }[] }>(`/api/me/consents/${historyFor?.type}/history`),
    enabled: !!historyFor,
  });
  const setConsent = useMutation({
    mutationFn: ({ type, granted }: { type: string; granted: boolean }) => put<{ items: ConsentState[] }>(`/api/me/consents/${type}`, { granted }),
    onSuccess: (r) => {
      qc.setQueryData(['consents'], r);
      void qc.invalidateQueries({ queryKey: ['access-log'] });
      toast(t('Zapisano zmianę zgody.'));
    },
  });
  const del = useMutation({
    mutationFn: () => post('/api/me/delete-account', { reason: reason || undefined }),
    onSuccess: () => {
      setDeleteOpen(false);
      toast(t('Wniosek przekazany do placówki.'));
    },
  });

  return (
    <div className="stack-lg">
      <PageHead title={t('Prywatność i zgody')} sub={t('Decydujesz, jak placówka kontaktuje się z Tobą i co udostępniasz.')} />

      <Card title={t('Twoje zgody')} className="card-flush" as="section">
        {consents.isLoading && <div style={{ padding: 18 }}><Skeleton count={4} height={40} /></div>}
        {consents.data && (
          <ul className="list">
            {consents.data.items.map((c) => (
              <li key={c.type} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{locale === 'en' ? c.label.en : c.label.pl}</span>
                  <span className="list-sub">
                    {c.required ? t('Wymagane do korzystania z aplikacji') : c.updatedAt ? t('Zmieniono {d}', { d: fmt.dateTime(c.updatedAt) }) : t('Nie wyrażono')}
                    {c.id && (
                      <>
                        {' · '}
                        <button type="button" className="btn ghost sm" style={{ minHeight: 0, padding: 0, height: 'auto' }} onClick={() => setHistoryFor(c)}>
                          {t('historia')}
                        </button>
                      </>
                    )}
                  </span>
                </span>
                <Switch
                  checked={c.granted}
                  disabled={c.required || setConsent.isPending}
                  label={locale === 'en' ? c.label.en : c.label.pl}
                  onChange={async (v) => {
                    if (!v && c.type === 'results-online' && !(await confirm({ title: t('Wyłączyć dostęp do wyników?'), body: t('Udostępnione wyniki znikną z aplikacji. Nadal możesz otrzymać je w placówce.'), confirmLabel: t('Wyłącz') }))) return;
                    setConsent.mutate({ type: c.type, granted: v });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('Kto i kiedy miał dostęp do Twoich danych')} action={<History size={18} aria-hidden />}>
        <p className="small muted">{t('Każdy wgląd personelu w Twoje dane jest rejestrowany w dzienniku zabezpieczonym przed modyfikacją.')}</p>
        {log.isLoading && <Skeleton count={3} height={36} />}
        {log.data && log.data.items.length === 0 && <Empty title={t('Brak wpisów')} />}
        {log.data && log.data.items.length > 0 && (
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('Kiedy')}</th>
                  <th scope="col">{t('Kto')}</th>
                  <th scope="col">{t('Czynność')}</th>
                </tr>
              </thead>
              <tbody>
                {log.data.items.map((e, i) => (
                  <tr key={i}>
                    <td className="nowrap">{fmt.dateTime(e.at)}</td>
                    <td>
                      {e.who === 'Ty' ? t('Ty') : e.who} <span className="muted small">({t(ROLE_LABELS[e.role] ?? e.role)})</span>
                    </td>
                    <td>{t(AUDIT_LABELS[e.subtype] ?? e.subtype)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('Twoje dane')}>
        <div className="stack">
          <div className="row-between">
            <span className="grow">
              <strong>{t('Pobierz kopię danych')}</strong>
              <span className="small muted" style={{ display: 'block' }}>{t('Plik w standardzie HL7 FHIR R4 (JSON) — możesz przekazać go innej placówce (RODO art. 20).')}</span>
            </span>
            <a className="btn secondary" href="/api/me/export" download>
              <Download size={18} /> {t('Pobierz')}
            </a>
          </div>
          <hr />
          <div className="row-between">
            <span className="grow">
              <strong>{t('Usuń konto w aplikacji')}</strong>
              <span className="small muted" style={{ display: 'block' }}>
                {t('Dokumentacja medyczna pozostaje w placówce przez okres wymagany prawem (co do zasady 20 lat). Usuwamy dostęp online i dane logowania.')}
              </span>
            </span>
            <Button variant="danger-outline" icon={<Trash2 size={18} />} onClick={() => setDeleteOpen(true)}>
              {t('Złóż wniosek')}
            </Button>
          </div>
          {config?.clinic.privacyContact && <p className="small muted">{t('Inspektor ochrony danych: {c}', { c: config.clinic.privacyContact })}</p>}
        </div>
      </Card>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={t('Historia zgody')}>
        {history.isLoading && <Skeleton count={2} height={30} />}
        {history.data && (
          <ul className="list">
            {history.data.items.map((h, i) => (
              <li key={i} className="list-item" style={{ padding: '10px 0' }}>
                <span className="grow">{fmt.dateTime(h.at)}</span>
                <Badge kind={h.granted ? 'ok' : undefined}>{h.granted ? t('wyrażona') : t('wycofana')}</Badge>
                <span className="small muted mono">v{h.version}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('Wniosek o usunięcie konta')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t('Anuluj')}
            </Button>
            <Button variant="danger" onClick={() => del.mutate()} loading={del.isPending}>
              {t('Wyślij wniosek')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>{t('Administrator placówki zrealizuje wniosek. Po zamknięciu konta nie zalogujesz się do aplikacji.')}</p>
          <TextArea label={t('Uwagi (opcjonalnie)')} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          {del.isError && <Notice kind="danger">{errorMessage(del.error, t)}</Notice>}
          <Button variant="ghost" onClick={() => void logout()}>
            {t('Wyloguj')}
          </Button>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}

// --- powiadomienia -------------------------------------------------------------------------------------

export function NotificationsPage({ staff }: { staff?: boolean }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items: NotificationRow[]; unread: number }>('/api/notifications') });
  const readAll = useMutation({
    mutationFn: () => post('/api/notifications/read', {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['badges'] });
    },
  });
  return (
    <div className="stack-lg">
      <PageHead title={t('Powiadomienia')} action={q.data?.unread ? <Button variant="secondary" size="sm" onClick={() => readAll.mutate()}>{t('Oznacz wszystkie jako przeczytane')}</Button> : undefined} />
      {q.isLoading && <Skeleton />}
      {q.data && q.data.items.length === 0 && <Empty icon={<Bell size={36} />} title={t('Brak powiadomień')} />}
      {q.data && q.data.items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((n) => (
              <li key={n.id}>
                <Link to={n.link ? (staff || !n.link.startsWith('/panel') ? n.link : '/') : '#'} className="list-item" onClick={() => void post('/api/notifications/read', { ids: [n.id] }).then(() => qc.invalidateQueries({ queryKey: ['badges'] }))}>
                  {!n.read_at && <span className="unread-dot" aria-label={t('nieprzeczytane')} />}
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>{t(n.title)}</span>
                    <span className="list-sub" style={{ display: 'block' }}>{t(n.body)}</span>
                    <span className="small muted">{fmt.dateTime(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- NFZ: terminy leczenia ------------------------------------------------------------------------------

interface NfzEntry {
  provider: string;
  place: string;
  address: string;
  locality: string;
  phone?: string;
  benefit: string;
  firstAvailableDate?: string;
  situationAsAt?: string;
  awaiting?: number;
  averagePeriodDays?: number;
}

export function NfzPage() {
  const { t, fmt } = useI18n();
  const provinces = useQuery({ queryKey: ['nfz-provinces'], queryFn: () => get<{ items: { code: string; name: string }[] }>('/api/nfz/provinces'), staleTime: Infinity });
  const [f, setF] = useState({ benefit: '', province: '07', locality: '', urgent: false });
  const [benefitQ, setBenefitQ] = useState('');
  const benefits = useQuery({
    queryKey: ['nfz-benefits', benefitQ],
    queryFn: () => get<{ items: string[] }>(`/api/nfz/benefits${qs({ name: benefitQ })}`),
    enabled: benefitQ.length >= 3,
    staleTime: 3_600_000,
  });
  const search = useMutation({
    mutationFn: () => get<{ items: NfzEntry[]; total?: number; hasMore: boolean }>(`/api/nfz/queues${qs({ benefit: f.benefit, province: f.province, locality: f.locality || undefined, urgent: f.urgent ? '1' : undefined })}`),
  });
  return (
    <div className="stack-lg">
      <PageHead title={t('Terminy leczenia NFZ')} sub={t('Dane otwarte Narodowego Funduszu Zdrowia: pierwszy wolny termin u świadczeniodawców z umową NFZ.')} />
      <Card>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            search.mutate();
          }}
        >
          <TextField
            label={t('Świadczenie (np. poradnia kardiologiczna)')}
            value={f.benefit}
            list="nfz-benefits"
            onChange={(e) => {
              setF({ ...f, benefit: e.target.value });
              setBenefitQ(e.target.value.trim());
            }}
            hint={t('Zacznij pisać — podpowiemy nazwy ze słownika NFZ.')}
            required
          />
          <datalist id="nfz-benefits">{benefits.data?.items.map((b) => <option key={b} value={b} />)}</datalist>
          <div className="grid-2">
            <SelectField label={t('Województwo')} value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}>
              {provinces.data?.items.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <TextField label={t('Miejscowość (opcjonalnie)')} value={f.locality} onChange={(e) => setF({ ...f, locality: e.target.value })} />
          </div>
          <Segmented
            label={t('Przypadek')}
            value={f.urgent ? 'urgent' : 'stable'}
            onChange={(v) => setF({ ...f, urgent: v === 'urgent' })}
            options={[
              { value: 'stable', label: t('Stabilny') },
              { value: 'urgent', label: t('Pilny') },
            ]}
          />
          <Button type="submit" icon={<Search size={18} />} loading={search.isPending} disabled={f.benefit.trim().length < 3} style={{ alignSelf: 'flex-start' }}>
            {t('Szukaj terminów')}
          </Button>
        </form>
      </Card>
      {search.isError && <Notice kind="danger">{errorMessage(search.error, t)}</Notice>}
      {search.data && search.data.items.length === 0 && <Empty title={t('Brak wyników dla podanych kryteriów')} />}
      {search.data && search.data.items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {search.data.items.map((e, i) => (
              <li key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span className="list-icon info">
                  <MapPin size={20} />
                </span>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{e.provider}</span>
                  <span className="list-sub" style={{ display: 'block' }}>
                    {e.place} · {e.address}, {e.locality}
                  </span>
                  {e.phone && <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="small">{e.phone}</a>}
                </span>
                <span style={{ textAlign: 'right' }}>
                  <strong className="nowrap">{e.firstAvailableDate ? fmt.date(e.firstAvailableDate) : t('brak danych')}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {e.awaiting !== undefined ? t('oczekuje: {n}', { n: e.awaiting }) : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="small muted">{t('Źródło: API Terminy Leczenia NFZ. Dane przekazują świadczeniodawcy i mogą być nieaktualne — termin potwierdź telefonicznie.')}</p>
    </div>
  );
}
