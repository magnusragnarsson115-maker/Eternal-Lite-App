import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Fingerprint, MessageCircleQuestion, Nfc, Phone, QrCode, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { del, get, post, put, qs } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { LinkLayout } from '../link/LinkPages';
import { fieldLabel, HealthTimeline, ResultDetailModal, SnapshotSections, WhatChangedList, type SnapshotResponse } from '../shared/HealthViews';
import type { AppointmentView } from '../types';
import { Badge, Button, Card, Checkbox, Empty, Notice, PageHead, QueryError, SelectField, Skeleton, Spinner, Tabs, TextField, useConfirm, useToast } from '../ui';

const Avatar3D = lazy(() => import('../shared/Avatar3D').then((m) => ({ default: m.Avatar3D })));

/**
 * Panel pacjenta — runda 5: „Moje zdrowie” (avatar rosnący z kompletnością danych, zmiany od ostatniej wizyty,
 * Snapshot, oś czasu, poprawki odczytu), wywiad przed wizytą w formie rozmowy i Eternal ID (QR, chip NFC).
 * Nic tu nie ocenia stanu zdrowia — avatar pokazuje, gdzie i kiedy są dane.
 */

interface Correction {
  id: string;
  field: string;
  autoValue?: string;
  correctedValue?: string;
  actorKind: 'patient' | 'clinician';
  actorName?: string;
  at: string;
  sourceText?: string;
}

export function MyHealthPage() {
  const { t, fmt } = useI18n();
  const [params] = useSearchParams();
  const linked = params.get('tab') === 'timeline' ? 'timeline' : params.get('tab') === 'overview' ? 'overview' : null;
  const [tab, setTab] = useState<'overview' | 'timeline'>(linked ?? 'overview');
  // ponowne przejście pod ten sam adres (nowy klucz lokalizacji) też otwiera wskazaną zakładkę
  const { key: locKey } = useLocation();
  useEffect(() => {
    if (linked) setTab(linked);
  }, [linked, locKey]);
  const [region, setRegion] = useState<string | undefined>();
  const [detail, setDetail] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['my-health'], queryFn: () => get<SnapshotResponse>('/api/me/health-snapshot') });
  const corr = useQuery({ queryKey: ['my-corrections'], queryFn: () => get<{ items: Correction[] }>('/api/me/corrections') });
  if (q.isLoading) return <Skeleton count={3} height={140} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const { snapshot: s, avatar, whatChanged } = q.data!;
  const reg = region ? avatar.regions.find((r) => r.key === region) : undefined;
  const toNext = Math.max(0, avatar.nextLevelAt - avatar.regionsWithData);
  return (
    <div className="stack-lg">
      <PageHead title={t('Moje zdrowie')} sub={t('Twój avatar rośnie razem z Twoją dokumentacją — każde badanie i pomiar go uzupełniają.')} />
      <Tabs
        label={t('Moje zdrowie')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: t('Przegląd') },
          { value: 'timeline', label: t('Oś czasu') },
        ]}
      />
      {tab === 'timeline' ? (
        <Card>
          <HealthTimeline url="/api/me/health-timeline" />
        </Card>
      ) : (
        <>
          <Card className="avatar-hero">
            <div className="avatar-hero-head">
              <div>
                <div className="avatar-level-big">
                  <Sparkles size={18} aria-hidden /> {t('Poziom {n}', { n: avatar.level })}
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {avatar.level >= 6 ? t('Najwyższy poziom — Twoja dokumentacja obejmuje prawie wszystkie obszary.') : t('Do następnego poziomu: dane z {n} kolejnych obszarów.', { n: toNext })}
                  {avatar.newSince7d > 0 && ` · ${t('nowe dane w tym tygodniu: {n}', { n: avatar.newSince7d })}`}
                </p>
              </div>
              <div className="eternal-id">
                <Fingerprint size={16} aria-hidden /> <span className="mono">{s.patient.eternalId}</span>
              </div>
            </div>
            <Suspense fallback={<Skeleton count={1} height={300} />}>
              <Avatar3D data={avatar} mode="patient" selected={region} onSelect={(k) => setRegion((x) => (x === k ? undefined : k))} />
            </Suspense>
            {reg && (
              <div className="region-detail">
                <strong>{t(reg.label)}</strong> · {t('{n} danych', { n: reg.count })}
                {reg.lastDate && <> · {t('ostatnio {d}', { d: fmt.date(reg.lastDate) })}</>}
                <div className="small muted">{reg.topics.join(', ')}</div>
              </div>
            )}
          </Card>
          <Card title={t('Co się zmieniło od ostatniej wizyty')}>
            <WhatChangedList wc={whatChanged} />
          </Card>
          <Card title={t('Moje dane w skrócie')}>
            <SnapshotSections s={s} onResult={(key) => setDetail(`/api/me/health-snapshot/result${qs({ key })}`)} />
          </Card>
          {!!corr.data?.items.length && (
            <Card title={t('Poprawione odczyty dokumentów')}>
              <ul className="plain stack-sm">
                {corr.data.items.slice(0, 20).map((c) => (
                  <li key={c.id} className="small">
                    <Badge kind="info">{t('poprawione')}</Badge> {fieldLabel(c.field, t)}: <span className="mono">{c.autoValue ?? '—'}</span> → <span className="mono">{c.correctedValue ?? '—'}</span> ·{' '}
                    {c.actorKind === 'patient' ? t('Ty') : c.actorName ?? t('personel')} · <span className="muted">{fmt.dateTime(c.at)}</span>
                  </li>
                ))}
              </ul>
              <p className="small muted">{t('Odczyt automatyczny bywa błędny — widzisz, co i kto poprawił. Oryginał dokumentu zostaje bez zmian.')}</p>
            </Card>
          )}
          <div className="btn-row">
            <Link to="/wywiad" className="btn secondary">
              <MessageCircleQuestion size={16} /> {t('Wywiad przed wizytą')}
            </Link>
            <Link to="/eternal-id" className="btn secondary">
              <Fingerprint size={16} /> {t('Eternal ID — karta i chip NFC')}
            </Link>
          </div>
        </>
      )}
      <ResultDetailModal url={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/** Ekran startowy: avatar danych (zabawa i motywacja, nie ocena) i liczba zmian od ostatniej wizyty. */
export function HomeAvatarCard() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['my-health'], queryFn: () => get<SnapshotResponse>('/api/me/health-snapshot'), retry: false, staleTime: 60_000 });
  if (!q.data) return null;
  const { avatar, whatChanged } = q.data;
  return (
    <Card className="avatar-home">
      <div className="avatar-home-grid">
        <Suspense fallback={<Skeleton count={1} height={200} />}>
          <Avatar3D data={avatar} mode="patient" height={220} />
        </Suspense>
      </div>
      <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="small">
          <Sparkles size={14} aria-hidden /> {t('Poziom {n}', { n: avatar.level })} · {t('zmiany od ostatniej wizyty: {n}', { n: whatChanged.items.length })}
        </span>
        <Link to="/moje-zdrowie" className="btn sm">
          {t('Moje zdrowie')}
        </Link>
      </div>
    </Card>
  );
}

// --- wywiad czatowy ------------------------------------------------------------------------------------------------

interface IvOption {
  value: string;
  label: string;
}
interface IvView {
  id: string;
  treeId: string;
  title: string;
  version: string;
  approved: boolean;
  status: 'in_progress' | 'completed';
  appointmentId?: string;
  transcript: { nodeId: string; question: string; answer: string }[];
  current?: { id: string; text: string; type: 'single' | 'multi' | 'yesno' | 'text' | 'number'; options?: IvOption[]; unit?: string; min?: number; max?: number; optional?: boolean; hint?: string };
  summary?: {
    reason: string[];
    duration?: string;
    symptoms: string[];
    negatives: string[];
    unsure: string[];
    meds: string[];
    conditions: string[];
    allergies: string[];
    risk: string[];
    issues: string[];
    other: { question: string; answer: string }[];
  };
  createdAt: string;
  completedAt?: string;
  notice: string;
  engine?: 'tree' | 'infermedica';
  engineResult?: { triageLevel: string; label: string; serious: string[]; source: string };
}

export function InterviewListPage() {
  const { t, fmt } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const q = useQuery({ queryKey: ['interviews'], queryFn: () => get<{ available: { id: string; title: string; description: string; approved: boolean }[]; items: IvView[]; engine?: { available: boolean } }>('/api/me/interviews') });
  const [symptoms, setSymptoms] = useState('');
  const engine = useMutation({
    mutationFn: () => post<IvView>('/api/me/interviews/engine', { text: symptoms, appointmentId: appt || undefined }),
    onSuccess: (v) => nav(`/wywiad/${v.id}`),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const appts = useQuery({ queryKey: ['appointments'], queryFn: () => get<{ items: AppointmentView[] }>('/api/me/appointments') });
  const [appt, setAppt] = useState('');
  const start = useMutation({
    mutationFn: (treeId: string) => post<IvView>('/api/me/interviews', { treeId, appointmentId: appt || undefined }),
    onSuccess: (v) => nav(`/wywiad/${v.id}`),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const upcoming = (appts.data?.items ?? []).filter((a) => ['booked', 'arrived'].includes(a.status) && Date.parse(a.end) > Date.now());
  return (
    <div className="stack-lg">
      <PageHead title={t('Wywiad przed wizytą')} sub={t('Kilka pytań w formie rozmowy — lekarz przeczyta podsumowanie przed wizytą i zyska czas na rozmowę z Tobą.')} back={{ to: '/moje-zdrowie', label: t('Moje zdrowie') }} />
      <Notice kind="info">{t('Pytania i ich kolejność ustalił lekarz. Aplikacja nie ocenia odpowiedzi i nie stawia rozpoznań. W nagłym zagrożeniu dzwoń 112.')}</Notice>
      {upcoming.length > 0 && (
        <SelectField label={t('Dla której wizyty? (lekarz zobaczy podsumowanie)')} value={appt} onChange={(e) => setAppt(e.target.value)}>
          <option value="">{t('bez przypisania do wizyty (tylko dla mnie)')}</option>
          {upcoming.map((a) => (
            <option key={a.id} value={a.id}>
              {fmt.dateTime(a.start)} · {a.serviceName} · {a.practitionerName}
            </option>
          ))}
        </SelectField>
      )}
      {q.data!.engine?.available && (
        <Card title={t('Asystent objawów (Infermedica)')}>
          <p className="small muted">{t('Opisz własnymi słowami, co Ci dolega. Kolejne pytania dobiera certyfikowany wyrób medyczny Infermedica; na końcu zobaczysz jego zalecenie, gdzie się zgłosić. To nie jest rozpoznanie.')}</p>
          <TextField label={t('Co Ci dolega?')} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} maxLength={2000} />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button size="sm" disabled={symptoms.trim().length < 3} loading={engine.isPending} onClick={() => engine.mutate()}>
              {t('Rozpocznij')}
            </Button>
          </div>
        </Card>
      )}
      <div className="grid-2">
        {q.data!.available.map((x) => (
          <Card key={x.id} title={x.title}>
            <p className="small muted">{x.description}</p>
            {!x.approved && <Badge>{t('projekt — czeka na zatwierdzenie przez lekarza')}</Badge>}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <Button size="sm" loading={start.isPending && start.variables === x.id} onClick={() => start.mutate(x.id)}>
                {t('Zacznij rozmowę')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {q.data!.items.length > 0 && (
        <Card title={t('Moje wywiady')} className="card-flush">
          <ul className="list">
            {q.data!.items.map((i) => (
              <li key={i.id}>
                <Link to={`/wywiad/${i.id}`} className="list-item">
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {i.title}
                    </span>
                    <span className="list-sub">{fmt.dateTime(i.completedAt ?? i.createdAt)}</span>
                  </span>
                  {i.status === 'completed' ? <Badge kind="ok">{t('zakończony')}</Badge> : <Badge>{t('w trakcie')}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AnswerInput({ q, busy, onAnswer }: { q: NonNullable<IvView['current']>; busy: boolean; onAnswer: (v: string | number | string[] | null) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  useEffect(() => {
    setText('');
    setMulti([]);
  }, [q.id]);
  if (q.type === 'single' || q.type === 'yesno')
    return (
      <div className="quick-replies" role="group" aria-label={t('Odpowiedzi')}>
        {q.options!.map((o) => (
          <button key={o.value} type="button" className="quick-reply" disabled={busy} onClick={() => onAnswer(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  if (q.type === 'multi')
    return (
      <div className="stack-sm">
        <div className="quick-replies" role="group" aria-label={t('Zaznacz wszystkie pasujące')}>
          {q.options!.map((o) => (
            <button key={o.value} type="button" aria-pressed={multi.includes(o.value)} className={`quick-reply ${multi.includes(o.value) ? 'on' : ''}`} onClick={() => setMulti((m) => (m.includes(o.value) ? m.filter((x) => x !== o.value) : [...m, o.value]))}>
              {o.label}
            </button>
          ))}
        </div>
        <Button size="sm" disabled={!multi.length || busy} icon={<Send size={14} />} onClick={() => onAnswer(multi)}>
          {t('Dalej')}
        </Button>
      </div>
    );
  return (
    <form
      className="chat-input"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.type === 'number') onAnswer(text.trim() ? Number(text.replace(',', '.')) : null);
        else onAnswer(text.trim() || null);
      }}
    >
      <input className="input" aria-label={q.text} inputMode={q.type === 'number' ? 'decimal' : undefined} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={q.type === 'number' ? `${q.min ?? ''}–${q.max ?? ''}${q.unit ?? ''}` : t('Napisz odpowiedź')} />
      <Button type="submit" size="sm" disabled={busy || (!q.optional && !text.trim())} icon={<Send size={14} />}>
        {t('Wyślij')}
      </Button>
      {q.optional && (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onAnswer(null)}>
          {t('Pomiń')}
        </Button>
      )}
    </form>
  );
}

export function InterviewChatPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => get<IvView>(`/api/me/interviews/${id}`) });
  const answer = useMutation({
    mutationFn: (value: string | number | string[] | null) => post<IvView>(`/api/me/interviews/${id}/answer`, { nodeId: q.data!.current!.id, value }),
    onSuccess: (v) => qc.setQueryData(['interview', id], v),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const back = useMutation({ mutationFn: () => post<IvView>(`/api/me/interviews/${id}/back`), onSuccess: (v) => qc.setQueryData(['interview', id], v) });
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [q.data?.transcript.length, q.data?.status]);
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const v = q.data!;
  const sum = v.summary;
  const line = (label: string, x?: string[] | string) => (x && (Array.isArray(x) ? x.length : true) ? <li><span className="muted">{label}:</span> {Array.isArray(x) ? x.join('; ') : x}</li> : null);
  return (
    <div className="stack-lg">
      <PageHead title={v.title} sub={v.approved ? t('Pytania zatwierdzone przez lekarza ({v})', { v: v.version }) : t('Projekt pytań — w wersji pokazowej')} back={{ to: '/wywiad', label: t('Wywiady') }} />
      <div className="chat" aria-live="polite">
        {v.transcript.map((m) => (
          <div key={m.nodeId} className="chat-pair">
            <div className="bubble bot">{m.question}</div>
            <div className="bubble me">{m.answer}</div>
          </div>
        ))}
        {v.current && (
          <div className="chat-pair">
            <div className="bubble bot">
              {v.current.text}
              {v.current.hint && <div className="small muted">{v.current.hint}</div>}
            </div>
            <AnswerInput q={v.current} busy={answer.isPending} onAnswer={(x) => answer.mutate(x)} />
            {v.transcript.length > 0 && (
              <button type="button" className="link-btn small" onClick={() => back.mutate()} disabled={back.isPending}>
                <ArrowLeft size={13} aria-hidden /> {t('Popraw poprzednią odpowiedź')}
              </button>
            )}
          </div>
        )}
        <div ref={end} />
      </div>
      {v.engineResult && (
        <Notice kind={/emergency/.test(v.engineResult.triageLevel) ? 'danger' : 'info'} title={t('Zalecenie wyrobu medycznego Infermedica')}>
          <p style={{ margin: 0 }}>
            <strong>{t(v.engineResult.label)}</strong>
          </p>
          {v.engineResult.serious.length > 0 && <p className="small" style={{ margin: '6px 0 0' }}>{t('Objawy, które wymagają uwagi')}: {v.engineResult.serious.join(', ')}</p>}
          <p className="small muted" style={{ margin: '6px 0 0' }}>{v.engineResult.source}</p>
          {/emergency/.test(v.engineResult.triageLevel) && (
            <a className="btn danger" href="tel:112" style={{ marginTop: 8 }}>
              <Phone size={18} /> 112
            </a>
          )}
        </Notice>
      )}
      {v.status === 'completed' && sum && (
        <Card title={t('Podsumowanie dla lekarza')}>
          <ul className="plain stack-sm">
            {line(t('Powód wizyty'), sum.reason)}
            {line(t('Od kiedy'), sum.duration)}
            {line(t('Objawy'), sum.symptoms)}
            {line(t('Objawy, których nie masz'), sum.negatives)}
            {line(t('Nie wiem — do omówienia'), sum.unsure)}
            {line(t('Leki'), sum.meds)}
            {line(t('Choroby'), sum.conditions)}
            {line(t('Uczulenia'), sum.allergies)}
            {line(t('Styl życia i rodzina'), sum.risk)}
            {line(t('Pytania do lekarza'), sum.issues)}
          </ul>
          <p className="small muted">{v.appointmentId ? t('Lekarz zobaczy to przed wizytą.') : t('Wywiad nie jest przypisany do wizyty — widzisz go tylko Ty.')}</p>
        </Card>
      )}
      <p className="small muted">{t(v.notice)}</p>
    </div>
  );
}

// --- Eternal ID -----------------------------------------------------------------------------------------------------

interface EternalIdData {
  eternalId: string;
  insurance: { provider?: string; policyNumber?: string; assistancePhone?: string; ehicNumber?: string; validUntil?: string };
  nfc: { text: string; bytes: number; truncated: boolean; choice: Record<string, boolean> };
  links: { id: string; label?: string; createdAt: string; expiresAt: string; revokedAt?: string; lastUsedAt?: string; uses: number; active: boolean }[];
}

interface NdefWriter {
  write: (m: { records: { recordType: string; data: string; lang?: string }[] }) => Promise<void>;
}

export function EternalIdPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const q = useQuery({ queryKey: ['eternal-id'], queryFn: () => get<EternalIdData>('/api/me/eternal-id') });
  const [created, setCreated] = useState<{ url: string; qr?: string } | null>(null);
  const [days, setDays] = useState('365');
  const [ins, setIns] = useState<EternalIdData['insurance'] | null>(null);
  const [nfcState, setNfcState] = useState<'idle' | 'writing' | 'done' | 'error' | 'unsupported'>(() => (typeof window !== 'undefined' && 'NDEFReader' in window ? 'idle' : 'unsupported'));
  const refresh = () => void qc.invalidateQueries({ queryKey: ['eternal-id'] });
  const link = useMutation({ mutationFn: () => post<{ url: string; qr?: string }>('/api/me/eternal-id/links', { days: Number(days), label: 'Eternal ID' }), onSuccess: (r) => (setCreated(r), refresh()), onError: (e) => toast(errorMessage(e, t), 'error') });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/api/me/eternal-id/links/${id}`), onSuccess: refresh });
  const choice = useMutation({ mutationFn: (c: Record<string, boolean>) => put('/api/me/eternal-id/nfc', c), onSuccess: refresh });
  const saveIns = useMutation({ mutationFn: () => put('/api/me/eternal-id/insurance', ins ?? {}), onSuccess: () => (toast(t('Zapisano dane ubezpieczenia.')), refresh()) });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const d = q.data!;
  const insV = ins ?? d.insurance;
  const writeNfc = async () => {
    if (!created) return;
    setNfcState('writing');
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
      await new Reader().write({ records: [{ recordType: 'url', data: created.url }, { recordType: 'text', data: d.nfc.text, lang: 'pl' }] });
      setNfcState('done');
    } catch {
      setNfcState('error');
    }
  };
  const CHOICES: [string, string][] = [
    ['name', t('imię i nazwisko')],
    ['birthYear', t('rok urodzenia')],
    ['allergies', t('uczulenia')],
    ['medications', t('leki')],
    ['conditions', t('choroby przewlekłe')],
    ['contact', t('osoba do kontaktu')],
    ['insurance', t('ubezpieczenie (także na karcie online)')],
  ];
  return (
    <div className="stack-lg">
      {dialog}
      <PageHead title={t('Eternal ID')} sub={t('Twój identyfikator na wyjazd i na wypadek nagłej sytuacji — karta z kodem QR i chip NFC (np. brelok, naklejka).')} back={{ to: '/moje-zdrowie', label: t('Moje zdrowie') }} />
      <div className="id-card">
        <div className="id-card-head">
          <Fingerprint size={22} aria-hidden /> <span>Eternal ID</span>
        </div>
        <div className="id-card-num mono">{d.eternalId}</div>
        <div className="small">{t('Numer alarmowy w UE / EU emergency number')}: 112</div>
      </div>
      <Card title={t('Link do karty (QR i NFC)')}>
        <p className="small muted">{t('Link możesz w każdej chwili odwołać. Każde otwarcie karty widzisz w dzienniku dostępu.')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <SelectField label={t('Ważność')} value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="30">{t('30 dni (wyjazd)')}</option>
            <option value="365">{t('1 rok')}</option>
            <option value="730">{t('2 lata')}</option>
          </SelectField>
          <Button icon={<QrCode size={16} />} loading={link.isPending} onClick={() => link.mutate()}>
            {t('Utwórz link')}
          </Button>
        </div>
        {created && (
          <div className="stack center" style={{ marginTop: 12 }}>
            {created.qr && <div className="qr-box" dangerouslySetInnerHTML={{ __html: created.qr }} />}
            <code className="small" style={{ wordBreak: 'break-all' }}>
              {created.url}
            </code>
            {nfcState === 'unsupported' ? (
              <Notice kind="info">{t('Zapis chipu NFC działa w Chrome na Androidzie. Na tym urządzeniu wydrukuj kod QR albo zapisz chip w aplikacji mobilnej.')}</Notice>
            ) : (
              <Button variant="secondary" icon={<Nfc size={16} />} loading={nfcState === 'writing'} onClick={() => void writeNfc()}>
                {t('Zapisz na chipie NFC (przyłóż chip do telefonu)')}
              </Button>
            )}
            {nfcState === 'done' && <Notice kind="ok">{t('Zapisano chip: link do karty i tekst do odczytu bez internetu.')}</Notice>}
            {nfcState === 'error' && <Notice kind="danger">{t('Nie udało się zapisać chipu. Sprawdź, czy NFC jest włączone i chip jest zapisywalny.')}</Notice>}
          </div>
        )}
        {d.links.length > 0 && (
          <ul className="list" style={{ marginTop: 12 }}>
            {d.links.map((l) => (
              <li key={l.id} className="row-between" style={{ padding: '8px 0', gap: 8 }}>
                <span className="small">
                  {l.active ? <Badge kind="ok">{t('aktywny')}</Badge> : <Badge>{l.revokedAt ? t('odwołany') : t('wygasł')}</Badge>} {t('do {d}', { d: fmt.date(l.expiresAt) })} · {t('otwarty {n} razy', { n: l.uses })}
                  {l.lastUsedAt && <> · {t('ostatnio {d}', { d: fmt.dateTime(l.lastUsedAt) })}</>}
                </span>
                {l.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={14} />}
                    onClick={async () => {
                      if (await confirm({ title: t('Odwołać link?'), body: t('Kod QR i chip z tym linkiem przestaną działać.'), confirmLabel: t('Odwołaj'), danger: true })) revoke.mutate(l.id);
                    }}
                  >
                    {t('Odwołaj')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('Co zapisać na chipie (odczyt bez internetu)')}>
        <p className="small muted">{t('Chip może odczytać każdy telefon z NFC — zaznacz tylko to, co chcesz pokazać obcej osobie. Tekst jest krótki (pojemność chipu).')}</p>
        <div className="stack-sm">
          {CHOICES.map(([k, label]) => (
            <Checkbox key={k} label={label} checked={!!d.nfc.choice[k]} onChange={(e) => choice.mutate({ [k]: e.target.checked })} />
          ))}
        </div>
        <pre className="nfc-preview">{d.nfc.text}</pre>
        <p className="small muted">
          {t('{b} z 380 bajtów', { b: d.nfc.bytes })}
          {d.nfc.truncated && ` · ${t('tekst skrócony do pojemności chipu')}`}
        </p>
      </Card>
      <Card title={t('Ubezpieczenie za granicą')}>
        <p className="small muted">{t('Dane wpisujesz sam(a) — aplikacja ich nie weryfikuje. EKUZ to Europejska Karta Ubezpieczenia Zdrowotnego z NFZ.')}</p>
        <div className="grid-2">
          <TextField label={t('Ubezpieczyciel')} value={insV.provider ?? ''} onChange={(e) => setIns({ ...insV, provider: e.target.value })} />
          <TextField label={t('Numer polisy')} value={insV.policyNumber ?? ''} onChange={(e) => setIns({ ...insV, policyNumber: e.target.value })} />
          <TextField label={t('Telefon assistance')} type="tel" value={insV.assistancePhone ?? ''} onChange={(e) => setIns({ ...insV, assistancePhone: e.target.value })} />
          <TextField label={t('Numer karty EKUZ')} value={insV.ehicNumber ?? ''} onChange={(e) => setIns({ ...insV, ehicNumber: e.target.value })} />
          <TextField label={t('Ważne do')} type="date" value={insV.validUntil ?? ''} onChange={(e) => setIns({ ...insV, validUntil: e.target.value })} />
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <Button variant="secondary" disabled={!ins} loading={saveIns.isPending} onClick={() => saveIns.mutate()}>
            {t('Zapisz')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Karta spod linku Eternal ID (QR/NFC) — dla osoby, która znalazła kartę albo udziela pomocy. */
export function EternalIdCardPage() {
  const { token = '' } = useParams();
  const { t, fmt } = useI18n();
  const q = useQuery({
    queryKey: ['eternal-id-card', token],
    queryFn: () =>
      get<{
        eternalId: string;
        name: string;
        birthDate?: string;
        notes: string;
        medications: string[];
        allergies?: string;
        conditions: { pl: string; en: string }[];
        directives?: string[];
        contacts: { name: string; phone: string; relation?: string }[];
        insurance?: EternalIdData['insurance'];
        disclaimer: string;
        expiresAt: string;
      }>(`/api/eternal-id/${token}`),
    retry: false,
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError)
    return (
      <LinkLayout>
        <Empty title={errorCode(q.error) === 'link_expired' ? t('Link wygasł albo został odwołany') : t('Nieprawidłowy link')} />
      </LinkLayout>
    );
  const c = q.data!;
  return (
    <LinkLayout>
      <div className="page-head">
        <h1>{t('Karta zdrowia · Health card')}</h1>
        <p className="muted">
          {c.name}
          {c.birthDate && <>, {t('ur. {d}', { d: fmt.date(c.birthDate) })}</>} · <span className="mono">{c.eternalId}</span>
        </p>
      </div>
      <a className="btn danger block" href="tel:112">
        <Phone size={20} /> {t('Zadzwoń pod 112 · Call 112')}
      </a>
      <Card title={t('Uczulenia na leki · Drug allergies')}>
        <p style={{ margin: 0 }}>{c.allergies === undefined ? t('nie podano · not provided') : c.allergies || t('brak · none')}</p>
      </Card>
      {c.conditions.length > 0 && (
        <Card title={t('Choroby przewlekłe · Chronic conditions')}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {c.conditions.map((x, i) => (
              <li key={i}>
                {x.pl} · <span className="muted">{x.en}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {c.medications.length > 0 && (
        <Card title={t('Przyjmowane leki · Current medicines')}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {c.medications.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}
      {c.contacts.length > 0 && (
        <Card title={t('Kontakt · Emergency contact')}>
          {c.contacts.map((x, i) => (
            <p key={i} style={{ margin: 0 }}>
              {x.name} {x.relation ? `(${x.relation})` : ''} · <a href={`tel:${x.phone}`}>{x.phone}</a>
            </p>
          ))}
        </Card>
      )}
      {c.insurance && (c.insurance.provider || c.insurance.policyNumber || c.insurance.ehicNumber) && (
        <Card title={t('Ubezpieczenie · Insurance')}>
          <p style={{ margin: 0 }}>
            {[c.insurance.provider, c.insurance.policyNumber, c.insurance.assistancePhone && `tel. ${c.insurance.assistancePhone}`, c.insurance.ehicNumber && `EHIC/EKUZ ${c.insurance.ehicNumber}`].filter(Boolean).join(' · ')}
          </p>
        </Card>
      )}
      <p className="small muted">
        <ShieldCheck size={14} aria-hidden /> {t('Informacje wpisane przez pacjenta, bez weryfikacji medycznej. Otwarcie karty zostało zapisane w dzienniku dostępu pacjenta.')}
      </p>
    </LinkLayout>
  );
}
