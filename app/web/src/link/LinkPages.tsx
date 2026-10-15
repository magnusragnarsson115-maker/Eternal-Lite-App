import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Eye, FileUp, LogIn, Phone, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { useRecorder } from '../lib/recorder';
import { uploadFile } from '../lib/upload';
import type { AccessEntry, CardView, IntakeView, LinkContext } from '../mvp-types';
import { useSession } from '../session';
import type { Me } from '../types';
import { IntakeReview, IntakeStatusBadge, KIND_PL, type FieldAction } from '../shared/IntakeReview';
import { AccessLogList, CardContent, RecorderControls } from '../shared/LinkShared';
import { BrandMark, Button, Card, Checkbox, DemoBanner, Empty, Modal, Notice, Segmented, SelectField, Spinner, TextField, useConfirm } from '../ui';
import { TextSizeButton } from '../shared/AccountCards';

/** Układ stron pod linkiem: na telefon, bez konta, bez instalowania (D1/DOC-07, D54). */
export function LinkLayout({ children, clinic, demo }: { children: ReactNode; clinic?: string; demo?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {demo && <DemoBanner />}
      <header className="p-header">
        <div className="p-header-inner">
          <span className="brand">
            <BrandMark />
            <span className="brand-name">eternal</span>
          </span>
          <span className="grow small muted" style={{ textAlign: 'center' }}>
            {clinic}
          </span>
          <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
            <TextSizeButton />
            <Segmented label={t('Język')} value={locale} onChange={setLocale} options={[{ value: 'pl', label: 'PL' }, { value: 'en', label: 'EN' }]} />
          </div>
        </div>
      </header>
      <main id="main" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 64px' }} className="stack-lg">
        {children}
      </main>
      <footer className="p-footer" style={{ textAlign: 'center' }}>
        {t('W nagłym zagrożeniu życia lub zdrowia dzwoń 112. W kryzysie psychicznym: 116 123.')}
      </footer>
    </div>
  );
}

function GoneNotice({ code }: { code?: string }) {
  const { t } = useI18n();
  const msg =
    code === 'link_revoked'
      ? t('Ten link został odwołany. Jeśli to pomyłka, skontaktuj się z placówką.')
      : code === 'link_expired'
        ? t('Ten link wygasł. Placówka może wysłać nowy.')
        : t('Link jest nieprawidłowy albo już nieaktualny.');
  return (
    <LinkLayout>
      <Notice kind="warn" title={t('Link nieaktywny')}>
        {msg}
      </Notice>
    </LinkLayout>
  );
}

function TextBlock({ text }: { text: { title: string; paragraphs: string[]; version: string } }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{text.title}</h2>
      {text.paragraphs.map((p, i) => (
        <p key={i} className="small" style={{ margin: 0 }}>
          {p}
        </p>
      ))}
      <span className="small muted">{text.version}</span>
    </div>
  );
}

/** Strona zaproszenia: zgoda → wgranie → potwierdzenie odczytu → „Gotowe”; „kto oglądał”; wycofanie zgody. */
export function IntakeLinkPage() {
  const { token = '' } = useParams();
  const { t, locale, fmt } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = (msg: string) => setFlash(msg);
  const [flash, setFlash] = useState('');
  const [agree, setAgree] = useState(false);
  const [kind, setKind] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [takeover, setTakeover] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const base = `/api/link/${token}`;
  const ctx = useQuery({
    queryKey: ['link', token, locale],
    queryFn: () => get<LinkContext>(`${base}?lang=${locale}`),
    retry: false,
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.status === 'processing') ? 2000 : false),
  });
  const item = useQuery({
    queryKey: ['link-item', token, openItem],
    queryFn: () => get<IntakeView>(`${base}/intake/${openItem}`),
    enabled: !!openItem,
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 1500 : false),
  });
  const log = useQuery({ queryKey: ['link-log', token], queryFn: () => get<{ items: AccessEntry[] }>(`${base}/access-log`), enabled: showLog });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['link', token] });
    void qc.invalidateQueries({ queryKey: ['link-item', token] });
  };
  const consent = useMutation({ mutationFn: () => post(`${base}/consent`, { accept: true, textVersion: ctx.data?.texts.consent.version }), onSuccess: refresh });
  const upload = useMutation({
    mutationFn: (f: File) => uploadFile<IntakeView>(`${base}/upload`, f, f.name, kind ? { kind } : {}),
    onSuccess: (v) => {
      refresh();
      setOpenItem(v.id);
    },
  });
  const review = useMutation({ mutationFn: (items: FieldAction[]) => post<IntakeView>(`${base}/intake/${openItem}/review`, { items }), onSuccess: (v) => qc.setQueryData(['link-item', token, openItem], v) });
  const submit = useMutation({
    mutationFn: () => post<IntakeView>(`${base}/intake/${openItem}/submit`),
    onSuccess: () => {
      setOpenItem(null);
      refresh();
      toast(t('Gotowe — lekarz zobaczy dokument przed wizytą.'));
    },
  });
  const withdraw = useMutation({ mutationFn: () => post(`${base}/withdraw`), onSuccess: refresh });
  const take = useMutation({ mutationFn: () => post<{ activationCode: string }>(`${base}/takeover`), onSuccess: (r) => setTakeover(r.activationCode) });

  useEffect(() => {
    if (flash) {
      const id = setTimeout(() => setFlash(''), 5000);
      return () => clearTimeout(id);
    }
  }, [flash]);

  if (ctx.isLoading) return <Spinner />;
  if (ctx.isError) return <GoneNotice code={errorCode(ctx.error)} />;
  const c = ctx.data!;
  const shared = c.grant?.status === 'active';
  const pick = (input: HTMLInputElement | null) => input?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) upload.mutate(f);
  };

  return (
    <LinkLayout clinic={c.clinic.name} demo={c.demo}>
      {dialog}
      <div className="page-head">
        <h1>{t('Dokumenty przed wizytą')}</h1>
        <p className="muted">
          {c.patientLabel && <>{t('Dla: {p}', { p: c.patientLabel })} · </>}
          {c.appointment ? t('wizyta {d}', { d: fmt.dateTime(c.appointment.start) }) : c.clinic.name}
        </p>
      </div>
      {flash && <Notice kind="ok">{flash}</Notice>}

      <Card>
        <TextBlock text={c.texts.purpose} />
      </Card>

      {!shared ? (
        <Card title={c.texts.consent.title}>
          <div className="stack">
            {c.texts.consent.paragraphs.map((p, i) => (
              <p key={i} className="small" style={{ margin: 0 }}>
                {p}
              </p>
            ))}
            <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label={t('Wyrażam zgodę na udostępnienie dokumentów tej placówce na opisanych zasadach.')} />
            {c.grant && c.grant.status !== 'active' && <Notice kind="warn">{t('Zgoda została wycofana albo wygasła. Możesz udzielić jej ponownie.')}</Notice>}
            {consent.isError && <Notice kind="danger">{errorMessage(consent.error, t)}</Notice>}
            <Button block disabled={!agree} loading={consent.isPending} icon={<ShieldCheck size={18} />} onClick={() => consent.mutate()}>
              {t('Zgadzam się i przechodzę dalej')}
            </Button>
            <span className="small muted">{c.texts.consent.version}</span>
          </div>
        </Card>
      ) : (
        <>
          <Card title={t('Dodaj zdjęcie albo PDF')}>
            <div className="stack">
              <SelectField label={t('Co dodajesz?')} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{t('Nie wiem — rozpoznaj automatycznie')}</option>
                {['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other'].map((k) => (
                  <option key={k} value={k}>
                    {t(KIND_PL[k])}
                  </option>
                ))}
              </SelectField>
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
              <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={onFile} />
              <div className="grid-2">
                <Button icon={<Camera size={18} />} loading={upload.isPending} onClick={() => pick(cameraInput.current)}>
                  {t('Zrób zdjęcie')}
                </Button>
                <Button variant="secondary" icon={<FileUp size={18} />} loading={upload.isPending} onClick={() => pick(fileInput.current)}>
                  {t('Wybierz plik (PDF, JPG, PNG)')}
                </Button>
              </div>
              <span className="small muted">{t('Najlepiej działają PDF-y z portalu laboratorium. Zdjęcie: cała strona, równo, bez cienia.')}</span>
              {upload.isError && <Notice kind="danger">{errorMessage(upload.error, t)}</Notice>}
            </div>
          </Card>

          <Card title={t('Przesłane dokumenty')} className="card-flush">
            {c.items.length === 0 ? (
              <Empty title={t('Nie dodano jeszcze dokumentów')} />
            ) : (
              <ul className="list">
                {c.items.map((i) => (
                  <li key={i.id}>
                    <button type="button" className="list-item" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0 }} onClick={() => setOpenItem(i.id)}>
                      <span className="grow">
                        <span className="list-title" style={{ display: 'block' }}>
                          {i.filename}
                        </span>
                        <span className="list-sub">
                          {t(KIND_PL[i.kind] ?? 'Dokument')} · {fmt.dateTime(i.createdAt)}
                        </span>
                      </span>
                      <IntakeStatusBadge item={i} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="stack">
              <p className="small" style={{ margin: 0 }}>
                {t('Dostęp placówki do tej skrzynki wygasa {d}.', { d: fmt.dateTime(c.grant?.expiresAt ?? c.expiresAt) })}
              </p>
              <div className="btn-row">
                <Button variant="secondary" icon={<Eye size={16} />} onClick={() => setShowLog(true)}>
                  {t('Kto oglądał moje dane')}
                </Button>
                <Button variant="secondary" icon={<UserPlus size={16} />} loading={take.isPending} onClick={() => take.mutate()}>
                  {t('Załóż konto i przejmij dane')}
                </Button>
                <Button
                  variant="danger-outline"
                  onClick={async () => {
                    if (await confirm({ title: t('Wycofać zgodę?'), body: t('Placówka natychmiast straci dostęp do przesłanych dokumentów, a ten link przestanie działać.'), confirmLabel: t('Wycofaj zgodę'), danger: true })) withdraw.mutate();
                  }}
                >
                  {t('Wycofaj zgodę')}
                </Button>
              </div>
              {take.isError && <Notice kind="warn">{errorMessage(take.error, t)}</Notice>}
            </div>
          </Card>
        </>
      )}

      <Card>
        <TextBlock text={c.texts.ai} />
      </Card>

      <Modal open={!!openItem} onClose={() => setOpenItem(null)} title={t('Sprawdź odczyt')} wide>
        {!item.data || item.data.status === 'processing' ? (
          <div className="stack center">
            <Spinner label={t('Odczytywanie dokumentu…')} />
            <p className="muted">{t('Odczytywanie dokumentu… zwykle kilka sekund.')}</p>
          </div>
        ) : item.data.status === 'submitted' || item.data.status === 'confirmed' ? (
          <Notice kind="ok" title={t('Gotowe — lekarz zobaczy przed wizytą')}>
            {t('Dokument jest zapisany. Pola niepotwierdzone lekarz zobaczy z oznaczeniem.')}
          </Notice>
        ) : (
          <IntakeReview
            item={item.data}
            fileUrl={`${base}/intake/${item.data.id}/file`}
            editable
            busy={review.isPending || submit.isPending}
            submitLabel={t('Gotowe — lekarz zobaczy przed wizytą')}
            onReview={(items) => review.mutate(items)}
            onSubmit={() => submit.mutate()}
          />
        )}
        {(review.isError || submit.isError) && <Notice kind="danger">{errorMessage(review.error ?? submit.error, t)}</Notice>}
      </Modal>

      <Modal open={showLog} onClose={() => setShowLog(false)} title={t('Kto oglądał moje dane')}>
        {log.isLoading ? <Spinner /> : <AccessLogList items={log.data?.items ?? []} />}
      </Modal>

      <Modal open={!!takeover} onClose={() => setTakeover(null)} title={t('Załóż konto i przejmij dane')}>
        <div className="stack">
          <p>{t('Twój kod aktywacyjny (ważny 30 minut):')}</p>
          <p className="mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {takeover}
          </p>
          <p className="small muted">{t('Przy zakładaniu konta podasz datę urodzenia — musi zgadzać się z kartoteką placówki.')}</p>
          <Button icon={<LogIn size={18} />} onClick={() => nav(`/rejestracja?kod=${encodeURIComponent(takeover ?? '')}`)}>
            {t('Przejdź do zakładania konta')}
          </Button>
        </div>
      </Modal>
    </LinkLayout>
  );
}

/** Karta „Po wizycie” pod linkiem z SMS (pacjent bez aplikacji albo osoba upoważniona). */
export function CardLinkPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['card-link', token], queryFn: () => get<CardView & { purpose: string; expiresAt: string; demo: boolean }>(`/api/card/${token}`), retry: false });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <GoneNotice code={errorCode(q.error)} />;
  const c = q.data!;
  return (
    <LinkLayout clinic={c.clinic} demo={c.demo}>
      <CardContent card={c} pdfUrl={`/api/card/${token}/pdf`} />
      {c.purpose === 'card-share' && <Notice kind="info">{t('Karta została Ci udostępniona na czas. Link wygaśnie automatycznie.')}</Notice>}
    </LinkLayout>
  );
}

/** Nagrywanie telefonem (kod QR z panelu lekarza) — jedna sesja Scribe, link jednorazowy. */
export function PhoneRecordPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const info = useQuery({ queryKey: ['scribe-record', token], queryFn: () => get<{ doctor: string; consentAt: string; template: string }>(`/api/scribe-record/${token}`), retry: false });
  const rec = useRecorder();
  const send = useMutation({ mutationFn: (b: Blob) => uploadFile<{ status: string }>(`/api/scribe-record/${token}/audio`, b, 'wizyta.webm', { seconds: String(rec.seconds) }) });
  if (info.isLoading) return <Spinner />;
  if (info.isError) return <GoneNotice code={errorCode(info.error)} />;
  return (
    <LinkLayout>
      <div className="page-head">
        <h1>{t('Nagrywanie wizyty')}</h1>
        <p className="muted">
          {info.data!.doctor} · {info.data!.template}
        </p>
      </div>
      <Notice kind="info">{t('Pacjent wyraził zgodę na nagranie (zapisana w panelu). Telefon połóż między lekarzem a pacjentem.')}</Notice>
      {send.isSuccess ? (
        <Notice kind="ok" title={t('Nagranie wysłane')}>
          {t('Szkic notatki pojawi się w panelu lekarza za około minutę.')}
        </Notice>
      ) : (
        <RecorderControls rec={rec} sending={send.isPending} onSend={(b) => send.mutate(b)} />
      )}
      {send.isError && <Notice kind="danger">{errorMessage(send.error, t)}</Notice>}
    </LinkLayout>
  );
}

/** Karta ratunkowa spod linku SOS (osoba bliska) — każdy odczyt zapisany w dzienniku pacjenta. */
export function SosCardPage() {
  const { token = '' } = useParams();
  const { t, fmt } = useI18n();
  const q = useQuery({
    queryKey: ['sos-card', token],
    queryFn: () =>
      get<{ name: string; birthDate?: string; notes: string; medications: string[]; directives?: string[]; contacts: { name: string; phone: string; relation?: string }[]; disclaimer: string; sosAt: string; location?: string; expiresAt: string }>(`/api/sos-card/${token}`),
    retry: false,
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <GoneNotice code={errorCode(q.error)} />;
  const c = q.data!;
  return (
    <LinkLayout>
      <div className="page-head">
        <h1>{t('Karta ratunkowa')}</h1>
        <p className="muted">
          {c.name}
          {c.birthDate && <>, {t('ur. {d}', { d: fmt.date(c.birthDate) })}</>} · {t('SOS: {d}', { d: fmt.dateTime(c.sosAt) })}
        </p>
      </div>
      <a className="btn danger block" href="tel:112">
        <Phone size={20} /> {t('Zadzwoń pod 112')}
      </a>
      {c.location && (
        <a className="btn secondary block" href={`https://www.openstreetmap.org/?mlat=${c.location.split(',')[0]}&mlon=${c.location.split(',')[1]}`} target="_blank" rel="noreferrer">
          {t('Lokalizacja z chwili wezwania')}
        </a>
      )}
      {c.notes && (
        <Card title={t('Informacje od pacjenta')}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.notes}</p>
        </Card>
      )}
      {c.medications.length > 0 && (
        <Card title={t('Przyjmowane leki (lista pacjenta)')}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {c.medications.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}
      {!!c.directives?.length && (
        <Card title={t('Dyspozycje pacjenta')}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {c.directives.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}
      <p className="small muted">{t('Informacje wpisane przez pacjenta w aplikacji Eternal, bez weryfikacji medycznej.')}</p>
    </LinkLayout>
  );
}

/** Zaproszenie do panelu personelu: ustawienie hasła, potem drugi składnik (TOTP albo klucz). */
export function StaffInviteAcceptPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const { refresh } = useSession();
  const nav = useNavigate();
  const [pw, setPw] = useState({ a: '', b: '' });
  const info = useQuery({ queryKey: ['staff-invite', token], queryFn: () => get<{ email: string; displayName: string; roles: string[]; clinic: string; passwordMinLength: number }>(`/api/auth/staff-invite/${token}`), retry: false });
  const accept = useMutation({
    mutationFn: () => post<{ next: string }>('/api/auth/staff-invite/accept', { token, password: pw.a }),
    onSuccess: async (r) => {
      await refresh();
      nav(r.next, { replace: true });
    },
  });
  if (info.isLoading) return <Spinner />;
  if (info.isError) return <GoneNotice code="link_expired" />;
  const i = info.data!;
  return (
    <LinkLayout clinic={i.clinic}>
      <div className="page-head">
        <h1>{t('Zaproszenie do panelu')}</h1>
        <p className="muted">
          {i.displayName} · {i.email}
        </p>
      </div>
      <Card>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate();
          }}
        >
          <TextField label={t('Hasło (min. {n} znaków)', { n: i.passwordMinLength })} type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} required />
          <TextField label={t('Powtórz hasło')} type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} required error={pw.b && pw.a !== pw.b ? t('Hasła nie są identyczne.') : undefined} />
          {accept.isError && <Notice kind="danger">{errorMessage(accept.error, t)}</Notice>}
          <Button type="submit" block loading={accept.isPending} disabled={!pw.a || pw.a !== pw.b} icon={<CheckCircle2 size={18} />}>
            {t('Ustaw hasło i przejdź do drugiego składnika')}
          </Button>
        </form>
      </Card>
    </LinkLayout>
  );
}

/** Logowanie linkiem z e-maila (F1.9). */
export function MagicLinkPage() {
  const [params] = useSearchParams();
  const { t } = useI18n();
  const { setMe } = useSession();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const m = useMutation({
    mutationFn: () => post<Me>('/api/auth/magic-link/consume', { token }),
    onSuccess: (me) => {
      setMe(me);
      nav(me.mfa?.required ? '/mfa' : '/', { replace: true });
    },
  });
  useEffect(() => {
    if (token && m.isIdle) m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <LinkLayout>
      {m.isError ? (
        <Notice kind="warn" title={t('Link wygasł lub został już użyty.')}>
          <Link to="/logowanie">{t('Wróć do logowania')}</Link>
        </Notice>
      ) : (
        <Spinner label={t('Logowanie…')} />
      )}
    </LinkLayout>
  );
}
