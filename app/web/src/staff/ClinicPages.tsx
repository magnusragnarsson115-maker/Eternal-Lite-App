import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, KeyRound, LogOut, Mail, Plus, ShieldAlert, Trash2, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { del, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { IncidentView, ModuleView, TeleState } from '../mvp-types';
import { hasRole, useSession } from '../session';
import { ReadabilityCard, ReportIncidentCard, SecurityKeysCard, SessionsCard } from '../shared/AccountCards';
import type { AppointmentView } from '../types';
import { Badge, Button, Card, Checkbox, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, Switch, Tabs, TextArea, TextField, useConfirm, useToast } from '../ui';
import { EmergencyReviewTab } from './EmergencyAccess';

// --- pulpit: poczekalnia wideo (D7) ----------------------------------------------------------------

export function WaitingRoomCard() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tele-waiting'], queryFn: () => get<{ items: { appointmentId: string; since: string; appointment: AppointmentView }[] }>('/api/staff/tele/waiting'), refetchInterval: 15_000 });
  const admit = useMutation({
    mutationFn: (id: string) => post(`/api/staff/appointments/${id}/tele/admit`),
    onSuccess: () => {
      toast(t('Pacjent wpuszczony do pokoju.'));
      void qc.invalidateQueries({ queryKey: ['tele-waiting'] });
    },
  });
  if (!q.data?.items.length) return null;
  return (
    <Card title={t('Poczekalnia wideo')}>
      <ul className="list">
        {q.data.items.map((w) => (
          <li key={w.appointmentId} className="list-item">
            <Video size={18} aria-hidden />
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>
                {w.appointment.patientName}
              </span>
              <span className="list-sub">{t('czeka od {d}', { d: fmt.time(w.since) })}</span>
            </span>
            <Button size="sm" loading={admit.isPending} onClick={() => admit.mutate(w.appointmentId)}>
              {t('Wpuść')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TeleDoctorControls({ appointmentId }: { appointmentId: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['tele-doc', appointmentId], queryFn: () => get<TeleState>(`/api/staff/appointments/${appointmentId}/tele`), refetchInterval: 5000 });
  const admit = useMutation({ mutationFn: () => post(`/api/staff/appointments/${appointmentId}/tele/admit`), onSuccess: () => void q.refetch() });
  const end = useMutation({ mutationFn: () => post(`/api/staff/appointments/${appointmentId}/tele/end`), onSuccess: () => void q.refetch() });
  if (!q.data) return null;
  return (
    <div className="btn-row">
      {q.data.waiting && (
        <Button onClick={() => admit.mutate()} loading={admit.isPending}>
          {t('Pacjent czeka — wpuść')}
        </Button>
      )}
      {!q.data.ended && (
        <Button variant="secondary" onClick={() => end.mutate()} loading={end.isPending}>
          {t('Zakończ wizytę wideo')}
        </Button>
      )}
    </div>
  );
}

// --- D12: mierniki pilotażu ------------------------------------------------------------------------

interface Dashboard {
  month: string;
  docTime: { baselineAvg: number | null; eternalAvg: number | null; savedPerVisit: number | null; baselineN: number; eternalN: number };
  notes: { sessions: number; approved: number; manual: number; correctedRatioAvg: number | null; editSecondsAvg: number | null; draftSecondsAvg: number | null };
  cards: { sent: number; app: number; sms: number };
  invites: { created: number; opened: number; consented: number; uploads: number; confirmedUploads: number };
  survey: { responses: number; q1: number | null; q2: number | null; q3: number | null; comments: string[] };
  scribeUsage: { userId: string; name: string; used: number; limit: number }[];
}

export function MetricsPage() {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const month = params.get('miesiac') ?? new Date().toISOString().slice(0, 7);
  const q = useQuery({ queryKey: ['metrics', month], queryFn: () => get<Dashboard>(`/api/staff/metrics${qs({ month })}`) });
  const survey = useQuery({ queryKey: ['survey'], queryFn: () => get<{ due: boolean; questions: { id: string; pl: string; en: string }[] }>('/api/staff/survey') });
  const [docTime, setDocTime] = useState({ minutes: '', phase: 'eternal' as 'baseline' | 'eternal' });
  const log = useMutation({ mutationFn: () => post('/api/staff/metrics/doc-time', { minutes: Number(docTime.minutes.replace(',', '.')), phase: docTime.phase }), onSuccess: () => (setDocTime({ ...docTime, minutes: '' }), void q.refetch()) });
  const v = (x: number | null, unit = '') => (x === null ? '—' : `${fmt.number(x)}${unit}`);
  return (
    <div className="stack-lg">
      <PageHead
        title={t('Wartość pilotażu')}
        sub={t('Dane operacyjne pilotażu, nie badanie kliniczne.')}
        action={
          <div className="row" style={{ gap: 8 }}>
            <TextField label={t('Miesiąc')} type="month" value={month} onChange={(e) => setParams({ miesiac: e.target.value })} />
            <a className="btn secondary" href={`/api/staff/metrics.pdf${qs({ month })}`}>
              <Download size={16} /> {t('Raport PDF')}
            </a>
          </div>
        }
      />
      {survey.data?.due && <SurveyCard questions={survey.data.questions} onDone={() => void survey.refetch()} />}
      {q.isLoading ? (
        <Skeleton count={3} />
      ) : q.isError ? (
        <QueryError error={q.error} />
      ) : (
        <>
          <div className="grid-4">
            <div className="stat">
              <div className="label">{t('Czas dokumentacji bez Eternal')}</div>
              <div className="value">{v(q.data!.docTime.baselineAvg, ' min')}</div>
              <div className="sub">n = {q.data!.docTime.baselineN}</div>
            </div>
            <div className="stat">
              <div className="label">{t('Czas dokumentacji z Eternal')}</div>
              <div className="value">{v(q.data!.docTime.eternalAvg, ' min')}</div>
              <div className="sub">n = {q.data!.docTime.eternalN}</div>
            </div>
            <div className="stat">
              <div className="label">{t('Różnica na wizytę')}</div>
              <div className="value">{v(q.data!.docTime.savedPerVisit, ' min')}</div>
            </div>
            <div className="stat">
              <div className="label">{t('Zdania szkicu poprawione przez lekarza')}</div>
              <div className="value">{v(q.data!.notes.correctedRatioAvg, '%')}</div>
              <div className="sub">{t('{n} zatwierdzonych notatek', { n: q.data!.notes.approved })}</div>
            </div>
          </div>
          {hasRole(me, 'practitioner') && (
            <Card title={t('Wpisz czas dokumentacji wizyty (tydzień pomiaru)')}>
              <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <TextField label={t('Minuty')} inputMode="decimal" value={docTime.minutes} onChange={(e) => setDocTime({ ...docTime, minutes: e.target.value })} />
                <SelectField label={t('Tydzień')} value={docTime.phase} onChange={(e) => setDocTime({ ...docTime, phase: e.target.value as 'baseline' | 'eternal' })}>
                  <option value="baseline">{t('bez Eternal')}</option>
                  <option value="eternal">{t('z Eternal')}</option>
                </SelectField>
                <Button disabled={!docTime.minutes} loading={log.isPending} onClick={() => log.mutate()}>
                  {t('Zapisz')}
                </Button>
              </div>
              {log.isError && <Notice kind="danger">{errorMessage(log.error, t)}</Notice>}
            </Card>
          )}
          <div className="grid-2">
            <Card title={t('Materiały od pacjentów')}>
              <dl className="kv">
                <dt>{t('Zaproszenia')}</dt>
                <dd>{q.data!.invites.created}</dd>
                <dt>{t('Otwarte linki')}</dt>
                <dd>{q.data!.invites.opened}</dd>
                <dt>{t('Zgody')}</dt>
                <dd>{q.data!.invites.consented}</dd>
                <dt>{t('Wgrane pliki')}</dt>
                <dd>{q.data!.invites.uploads}</dd>
                <dt>{t('Potwierdzone w całości')}</dt>
                <dd>{q.data!.invites.confirmedUploads}</dd>
              </dl>
            </Card>
            <Card title={t('Eternal Scribe')}>
              <dl className="kv">
                <dt>{t('Sesje')}</dt>
                <dd>{q.data!.notes.sessions}</dd>
                <dt>{t('Bez nagrania')}</dt>
                <dd>{q.data!.notes.manual}</dd>
                <dt>{t('Czas przygotowania szkicu')}</dt>
                <dd>{v(q.data!.notes.draftSecondsAvg, ' s')}</dd>
                <dt>{t('Od szkicu do zatwierdzenia')}</dt>
                <dd>{v(q.data!.notes.editSecondsAvg, ' s')}</dd>
                <dt>{t('Karty „Po wizycie”')}</dt>
                <dd>{t('{n} (aplikacja {a}, SMS {s})', { n: q.data!.cards.sent, a: q.data!.cards.app, s: q.data!.cards.sms })}</dd>
              </dl>
            </Card>
          </div>
          <Card title={t('Limit wizyt Scribe w licencji')} className="card-flush">
            <ul className="list">
              {q.data!.scribeUsage.map((u) => (
                <li key={u.userId} className="list-item">
                  <span className="grow">{u.name}</span>
                  <span className="tabular">
                    {u.used} / {u.limit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('Ankieta lekarzy (1–5)')}>
            <p>
              {t('Odpowiedzi: {n}', { n: q.data!.survey.responses })} · Q1 {v(q.data!.survey.q1)} · Q2 {v(q.data!.survey.q2)} · Q3 {v(q.data!.survey.q3)}
            </p>
            {q.data!.survey.comments.map((c, i) => (
              <p key={i} className="small muted">
                „{c}”
              </p>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function SurveyCard({ questions, onDone }: { questions: { id: string; pl: string; en: string }[]; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [a, setA] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const send = useMutation({ mutationFn: () => post('/api/staff/survey', { ...a, comment: comment || undefined }), onSuccess: onDone });
  return (
    <Card title={t('Krótka ankieta (co 2 tygodnie)')}>
      <div className="stack">
        {questions.map((q) => (
          <div key={q.id}>
            <p style={{ margin: '0 0 4px' }}>{locale === 'pl' ? q.pl : q.en}</p>
            <div className="segmented" role="group" aria-label={locale === 'pl' ? q.pl : q.en}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={a[q.id] === n} onClick={() => setA({ ...a, [q.id]: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <TextArea label={t('Komentarz (opcjonalnie)')} value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button disabled={questions.some((q) => !a[q.id])} loading={send.isPending} onClick={() => send.mutate()}>
          {t('Wyślij odpowiedzi')}
        </Button>
      </div>
    </Card>
  );
}

// --- D0: organizacja kliniki (administrator) ------------------------------------------------------

type OrgTab = 'gotowosc' | 'moduly' | 'pakiety' | 'ankiety' | 'konfiguracja' | 'personel' | 'uzycie' | 'incydenty' | 'ratunkowy' | 'ai';

export function OrgManagePage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as OrgTab) ?? 'gotowosc';
  return (
    <div className="stack-lg">
      <PageHead title={t('Organizacja kliniki')} sub={t('Administrator nie ma dostępu do danych klinicznych — tylko do danych operacyjnych.')} />
      <Tabs
        label={t('Sekcje')}
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'gotowosc', label: t('Gotowość do pracy') },
          { value: 'moduly', label: t('Moduły') },
          { value: 'pakiety', label: t('Pakiety specjalizacji') },
          { value: 'ankiety', label: t('Ankiety') },
          { value: 'konfiguracja', label: t('Konfiguracja') },
          { value: 'personel', label: t('Zaproszenia personelu') },
          { value: 'uzycie', label: t('Użycie i faktura') },
          { value: 'incydenty', label: t('Incydenty') },
          { value: 'ratunkowy', label: t('Dostęp ratunkowy') },
          { value: 'ai', label: t('Rejestr AI') },
        ]}
      />
      {tab === 'gotowosc' && <ReadinessTab />}
      {tab === 'moduly' && <ModulesTab />}
      {tab === 'pakiety' && <PackagesTab />}
      {tab === 'ankiety' && <SurveysTab />}
      {tab === 'konfiguracja' && <ClinicConfigTab />}
      {tab === 'personel' && <StaffInvitesTab />}
      {tab === 'uzycie' && <UsageTab />}
      {tab === 'incydenty' && <IncidentsTab />}
      {tab === 'ratunkowy' && <EmergencyReviewTab />}
      {tab === 'ai' && <AiRegistryTab />}
    </div>
  );
}

interface ReadinessItem {
  id: string;
  group: string;
  name: string;
  state: 'ok' | 'demo' | 'missing' | 'warn';
  detail: string;
  howTo?: string;
  live?: { ok: boolean; detail: string; ms: number };
}

/** Gotowość do pracy: co działa naprawdę, co w trybie demonstracyjnym i co ustawić (to samo co `npm run cli -- check`). */
function ReadinessTab() {
  const { t } = useI18n();
  const [live, setLive] = useState(false);
  const q = useQuery({ queryKey: ['readiness', live], queryFn: () => get<{ items: ReadinessItem[]; summary: Record<ReadinessItem['state'], number> }>(`/api/admin/readiness${live ? '?live=1' : ''}`) });
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const STATE: Record<ReadinessItem['state'], { kind: 'ok' | 'info' | 'danger' | 'warn'; label: string }> = {
    ok: { kind: 'ok', label: 'działa' },
    demo: { kind: 'info', label: 'tryb demo' },
    missing: { kind: 'danger', label: 'brakuje' },
    warn: { kind: 'warn', label: 'do decyzji' },
  };
  let group = '';
  const sum = q.data!.summary;
  return (
    <div className="stack">
      <Notice kind="info">
        {t('Działa: {a} · tryb demo: {b} · brakuje: {c} · do decyzji: {d}', { a: sum.ok, b: sum.demo, c: sum.missing, d: sum.warn })}
      </Notice>
      <div className="btn-row">
        <Button variant="secondary" loading={q.isFetching && live} onClick={() => (live ? void q.refetch() : setLive(true))}>
          {t('Sprawdź połączenia (bez danych pacjentów)')}
        </Button>
      </div>
      <Card className="card-flush">
        <ul className="list">
          {q.data!.items.map((i) => {
            const head = i.group !== group ? ((group = i.group), <li key={`g-${i.group}`} className="nav-label" style={{ padding: '12px 16px 0' }}>{t(i.group)}</li>) : null;
            const st = STATE[i.state];
            return [
              head,
              <li key={i.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {t(i.name)}
                  </span>
                  <span className="list-sub">{i.detail}</span>
                  {i.live && <span className={`small ${i.live.ok ? '' : 'danger-text'}`} style={{ display: 'block', color: i.live.ok ? 'var(--success)' : 'var(--danger)' }}>{t('Test: {r} — {d} ({ms} ms)', { r: i.live.ok ? 'OK' : t('błąd'), d: i.live.detail, ms: i.live.ms })}</span>}
                  {i.howTo && <span className="small muted" style={{ display: 'block', marginTop: 4 }}>→ {i.howTo}</span>}
                  {i.id === 'sbom' && i.state === 'ok' && (
                    <a className="small" href="/api/admin/sbom" download style={{ display: 'block', marginTop: 4 }}>
                      {t('Pobierz wykaz składników (CycloneDX JSON)')}
                    </a>
                  )}
                </span>
                <Badge kind={st.kind}>{t(st.label)}</Badge>
              </li>,
            ];
          })}
        </ul>
      </Card>
      <p className="small muted">{t('To samo z wiersza poleceń: npm run cli -- check --live')}</p>
    </div>
  );
}

interface PackagePreview {
  id: string;
  name: string;
  version: string;
  description: string;
  applied: boolean;
  changes: {
    specialties: string[];
    noteTemplates: string[];
    requiredDocuments: { add: { id: string; label: string; optional?: boolean; maxAgeDays?: number }[]; keep: string[] };
    questionnaire: { action: 'create' | 'new-version' | 'none'; title: string; questions: number };
    services: { attach: { id: string; name: string }[]; skippedOwnQuestionnaire: { id: string; name: string }[]; noMatch: boolean };
  };
}

/** M30 — pakiety specjalizacji: podgląd zmian i zastosowanie. Pakiet tylko dodaje; nie usuwa ustawień placówki. */
function PackagesTab() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<PackagePreview | null>(null);
  const q = useQuery({ queryKey: ['admin-packages'], queryFn: () => get<{ items: PackagePreview[] }>('/api/admin/packages') });
  const apply = useMutation({
    mutationFn: (id: string) => post<PackagePreview>(`/api/admin/packages/${id}/apply`),
    onSuccess: (p) => {
      toast(t('Zastosowano pakiet: {n}', { n: p.name }));
      setOpen(null);
      void qc.invalidateQueries({ queryKey: ['admin-packages'] });
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const c = open?.changes;
  return (
    <div className="stack">
      <Notice kind="info">
        {t('Pakiet to gotowy zestaw dla poradni: wymagane dokumenty przed wizytą, wywiad przed wizytą, szablon notatki i układ raportu faktów. Pakiet tylko dodaje — nie usuwa ani nie zmienia Twoich ustawień, a własnych wywiadów usług nie podmienia.')}
      </Notice>
      <Card className="card-flush">
        <ul className="list">
          {q.data!.items.map((p) => (
            <li key={p.id} className="list-item">
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>{t(p.name)}</span>
                <span className="list-sub">{t(p.description)}</span>
                <span className="small muted" style={{ display: 'block' }}>{p.version}</span>
              </span>
              {p.applied ? (
                <Badge kind="ok">{t('zastosowany')}</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setOpen(p)}>
                  {t('Podgląd zmian')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? t('Pakiet: {n}', { n: t(open.name) }) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              {t('Anuluj')}
            </Button>
            <Button loading={apply.isPending} onClick={() => open && apply.mutate(open.id)}>
              {t('Zastosuj pakiet')}
            </Button>
          </>
        }
      >
        {c && (
          <div className="stack">
            <div>
              <strong>{t('Wymagane dokumenty przed wizytą')}</strong>
              <ul className="small" style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {c.requiredDocuments.add.map((d) => (
                  <li key={d.id}>
                    {t('dodamy')}: {d.label}
                    {d.optional ? ` (${t('opcjonalny')})` : ''}
                  </li>
                ))}
                {c.requiredDocuments.keep.map((l) => (
                  <li key={l} className="muted">
                    {t('już spełnione przez obecne ustawienia')}: {l}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>{t('Wywiad przed wizytą')}</strong>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {c.questionnaire.action === 'none'
                  ? t('bez zmian')
                  : t('{a}: „{title}” ({n} pytań, bez oceny odpowiedzi)', { a: c.questionnaire.action === 'create' ? t('utworzymy') : t('nowa wersja'), title: c.questionnaire.title, n: c.questionnaire.questions })}
              </p>
              <ul className="small" style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {c.services.attach.map((s) => (
                  <li key={s.id}>
                    {t('przypniemy do usługi')}: {s.name}
                  </li>
                ))}
                {c.services.skippedOwnQuestionnaire.map((s) => (
                  <li key={s.id} className="muted">
                    {t('pominiemy (usługa ma własny wywiad)')}: {s.name}
                  </li>
                ))}
              </ul>
              {c.services.noMatch && <p className="small muted" style={{ margin: '4px 0 0' }}>{t('Brak usług tej specjalizacji w katalogu — wywiad przypniesz ręcznie w katalogu usług.')}</p>}
            </div>
            <div>
              <strong>{t('Szablon notatki i układ raportu')}</strong>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {c.noteTemplates.length ? t('włączymy szablon notatki: {n}', { n: c.noteTemplates.join(', ') }) : t('szablon notatki już włączony')}
                {c.specialties.length ? ` · ${t('dodamy specjalizację: {n}', { n: c.specialties.join(', ') })}` : ''}
              </p>
            </div>
            {apply.isError && <Notice kind="danger">{errorMessage(apply.error, t)}</Notice>}
          </div>
        )}
      </Modal>
    </div>
  );
}

interface SurveySummary {
  responses: number;
  umuxLite?: number;
  nps?: number;
  comments: { date: string; hard?: string; missing?: string }[];
  completions: { surveyId: string; count: number }[];
}

const SURVEY_NAME: Record<string, string> = {
  'health-intake': 'Ankieta zdrowotna na start',
  'after-results': 'Po nowych wynikach',
  'health-followup': 'Ankieta kontrolna',
  'app-feedback': 'Jak działa aplikacja?',
};

/** A12.3 — ocena aplikacji (anonimowa) i liczba wypełnionych ankiet; bez treści zdrowotnych. */
function SurveysTab() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['admin-surveys'], queryFn: () => get<SurveySummary>('/api/admin/surveys') });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  return (
    <div className="stack">
      <Notice kind="info">
        {t('Ocena aplikacji jest anonimowa — nie wiadomo, kto ją wypełnił. Odpowiedzi z ankiet zdrowotnych należą do pacjentów: tutaj widać tylko liczbę wypełnień; lekarz zobaczy treść w raporcie faktów, gdy pacjent udostępni dane.')}
      </Notice>
      <div className="grid-2">
        <Card>
          <p className="small muted" style={{ margin: 0 }}>{t('Użyteczność (UMUX-Lite, 0–100)')}</p>
          <p className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 750, margin: '4px 0' }}>{d.umuxLite === undefined ? '—' : fmt.number(d.umuxLite)}</p>
          <p className="small muted" style={{ margin: 0 }}>{t('Średnia z 2 pytań („robi to, czego potrzebuję”, „łatwa w użyciu”), {n} odpowiedzi z 12 miesięcy.', { n: d.responses })}</p>
        </Card>
        <Card>
          <p className="small muted" style={{ margin: 0 }}>{t('Skłonność do polecenia (NPS, −100…100)')}</p>
          <p className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 750, margin: '4px 0' }}>{d.nps === undefined ? '—' : d.nps}</p>
          <p className="small muted" style={{ margin: 0 }}>{t('Odsetek ocen 9–10 minus odsetek ocen 0–6.')}</p>
        </Card>
      </div>
      <Card title={t('Wypełnione ankiety (12 miesięcy)')}>
        <ul className="list">
          {d.completions.map((c) => (
            <li key={c.surveyId} className="list-item">
              <span className="grow">{t(SURVEY_NAME[c.surveyId] ?? c.surveyId)}</span>
              <Badge>{c.count}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('Uwagi pacjentów o aplikacji')}>
        {d.comments.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{t('Brak uwag.')}</p>
        ) : (
          <ul className="list">
            {d.comments.map((c, i) => (
              <li key={i} className="list-item" style={{ display: 'block' }}>
                <span className="small muted">{fmt.date(c.date)}</span>
                {c.hard && <p style={{ margin: '4px 0 0' }}><strong>{t('Trudne:')}</strong> {c.hard}</p>}
                {c.missing && <p style={{ margin: '4px 0 0' }}><strong>{t('Brakuje:')}</strong> {c.missing}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>{t('Adresy e-mail, numery telefonów i PESEL są usuwane z uwag przed zapisem.')}</p>
      </Card>
    </div>
  );
}

function ModulesTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['admin-modules'], queryFn: () => get<{ items: ModuleView[] }>('/api/admin/modules') });
  const toggle = useMutation({ mutationFn: (v: { id: string; enabled: boolean }) => put(`/api/admin/modules/${v.id}`, { enabled: v.enabled }), onSuccess: () => void q.refetch() });
  if (q.isLoading) return <Skeleton />;
  return (
    <Card className="card-flush">
      <ul className="list">
        {q.data?.items.map((m) => (
          <li key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <Badge kind="primary">{m.code}</Badge>
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>
                {t(m.name)}
              </span>
              <span className="list-sub">{t(m.description)}</span>
              <span className="small muted">
                {m.stage === 'pilot' ? t('wersja pilotażowa') : m.stage === 'mvp1' ? 'MVP-1' : 'MVP'} · {m.scope === 'org' ? t('ustawia klinika') : t('ustawia operator')}
                {m.rollout < 100 && ` · ${t('wdrożenie dla {n}% kont', { n: m.rollout })}`}
              </span>
            </span>
            {m.switchable && m.scope === 'org' ? <Switch label={t(m.name)} checked={m.enabled} onChange={(v) => toggle.mutate({ id: m.id, enabled: v })} /> : <Badge>{m.switchable ? t('operator') : t('zawsze włączony')}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface Settings {
  specialties: string[];
  requiredDocuments: { id: string; label: string; accept: string[]; maxAgeDays?: number; specialties?: string[]; optional?: boolean }[];
  noteTemplates: string[];
  ehrLayout: 'generic' | 'soap';
  scribeMonthlyLimitPerDoctor: number;
  inviteValidityDaysAfterVisit: number;
  recordingRetentionDays: number;
  autoRemindMissingHours: number;
  pilot: { baselineWeekStart?: string; eternalWeekStart?: string; surveyEveryDays: number };
}

const KINDS = ['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other'];

function ClinicConfigTab() {
  const { t } = useI18n();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => get<Settings>('/api/admin/settings') });
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    if (q.data && !s) setS(q.data);
  }, [q.data, s]);
  const save = useMutation({
    mutationFn: () =>
      put<Settings>('/api/admin/settings', {
        specialties: s!.specialties,
        requiredDocuments: s!.requiredDocuments,
        noteTemplates: s!.noteTemplates,
        ehrLayout: s!.ehrLayout,
        scribeMonthlyLimitPerDoctor: s!.scribeMonthlyLimitPerDoctor,
        inviteValidityDaysAfterVisit: s!.inviteValidityDaysAfterVisit,
        recordingRetentionDays: s!.recordingRetentionDays,
        autoRemindMissingHours: s!.autoRemindMissingHours,
        pilot: s!.pilot,
      }),
    onSuccess: (v) => (setS(v), toast(t('Zapisano konfigurację kliniki.'))),
  });
  if (!s) return <Skeleton />;
  const num = (k: keyof Settings) => (e: { target: { value: string } }) => setS({ ...s, [k]: Number(e.target.value) });
  return (
    <div className="stack-lg">
      <Card title={t('Wymagane dokumenty przed wizytą')}>
        <div className="stack">
          {s.requiredDocuments.map((d, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <div className="grid-2">
                <TextField label={t('Nazwa wymogu')} value={d.label} onChange={(e) => setS({ ...s, requiredDocuments: s.requiredDocuments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <TextField
                  label={t('Nie starsze niż (dni)')}
                  type="number"
                  value={d.maxAgeDays ?? ''}
                  onChange={(e) => setS({ ...s, requiredDocuments: s.requiredDocuments.map((x, j) => (j === i ? { ...x, maxAgeDays: e.target.value ? Number(e.target.value) : undefined } : x)) })}
                />
                <TextField
                  label={t('Tylko dla specjalizacji (przecinek; puste = wszystkie)')}
                  value={(d.specialties ?? []).join(', ')}
                  onChange={(e) => setS({ ...s, requiredDocuments: s.requiredDocuments.map((x, j) => (j === i ? { ...x, specialties: e.target.value.split(',').map((y) => y.trim()).filter(Boolean) } : x)) })}
                />
              </div>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                {KINDS.map((k) => (
                  <Checkbox
                    key={k}
                    label={t(KIND_SHORT[k])}
                    checked={d.accept.includes(k)}
                    onChange={(e) => setS({ ...s, requiredDocuments: s.requiredDocuments.map((x, j) => (j === i ? { ...x, accept: e.target.checked ? [...x.accept, k] : x.accept.filter((y) => y !== k) } : x)) })}
                  />
                ))}
                <Checkbox label={t('opcjonalny')} checked={!!d.optional} onChange={(e) => setS({ ...s, requiredDocuments: s.requiredDocuments.map((x, j) => (j === i ? { ...x, optional: e.target.checked } : x)) })} />
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setS({ ...s, requiredDocuments: s.requiredDocuments.filter((_, j) => j !== i) })}>
                  {t('Usuń')}
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setS({ ...s, requiredDocuments: [...s.requiredDocuments, { id: `req-${Date.now().toString(36)}`, label: '', accept: ['lab'], maxAgeDays: 180 }] })}
          >
            {t('Dodaj wymóg')}
          </Button>
        </div>
      </Card>
      <Card title={t('Scribe i zaproszenia')}>
        <div className="grid-2">
          <TextField label={t('Specjalizacje kliniki (przecinek)')} value={s.specialties.join(', ')} onChange={(e) => setS({ ...s, specialties: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          <SelectField label={t('Układ pól systemu gabinetowego')} value={s.ehrLayout} onChange={(e) => setS({ ...s, ehrLayout: e.target.value as 'generic' | 'soap' })}>
            <option value="generic">{t('Wywiad / Badanie / Rozpoznanie / Zalecenia')}</option>
            <option value="soap">SOAP</option>
          </SelectField>
          <TextField label={t('Limit wizyt Scribe na lekarza w miesiącu')} type="number" value={s.scribeMonthlyLimitPerDoctor} onChange={num('scribeMonthlyLimitPerDoctor')} />
          <TextField label={t('Ważność udostępnienia: wizyta + dni')} type="number" value={s.inviteValidityDaysAfterVisit} onChange={num('inviteValidityDaysAfterVisit')} />
          <TextField label={t('Usunięcie nagrania po zatwierdzeniu (dni)')} type="number" value={s.recordingRetentionDays} onChange={num('recordingRetentionDays')} />
          <TextField label={t('Automatyczne przypomnienie o brakach (godzin przed wizytą; 0 = wyłączone)')} type="number" value={s.autoRemindMissingHours} onChange={num('autoRemindMissingHours')} />
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {['general', 'cardiology', 'pediatrics', 'soap', 'sbar'].map((id) => (
            <Checkbox key={id} label={t(TEMPLATE_PL[id])} checked={s.noteTemplates.includes(id)} onChange={(e) => setS({ ...s, noteTemplates: e.target.checked ? [...s.noteTemplates, id] : s.noteTemplates.filter((x) => x !== id) })} />
          ))}
        </div>
      </Card>
      <Card title={t('Pomiar pilotażu')}>
        <div className="grid-3">
          <TextField label={t('Tydzień bez Eternal (od)')} type="date" value={s.pilot.baselineWeekStart ?? ''} onChange={(e) => setS({ ...s, pilot: { ...s.pilot, baselineWeekStart: e.target.value || undefined } })} />
          <TextField label={t('Tydzień z Eternal (od)')} type="date" value={s.pilot.eternalWeekStart ?? ''} onChange={(e) => setS({ ...s, pilot: { ...s.pilot, eternalWeekStart: e.target.value || undefined } })} />
          <TextField label={t('Ankieta lekarza co (dni)')} type="number" value={s.pilot.surveyEveryDays} onChange={(e) => setS({ ...s, pilot: { ...s.pilot, surveyEveryDays: Number(e.target.value) } })} />
        </div>
      </Card>
      {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
      <Button loading={save.isPending} onClick={() => save.mutate()}>
        {t('Zapisz konfigurację')}
      </Button>
    </div>
  );
}

const KIND_SHORT: Record<string, string> = { lab: 'wyniki laboratoryjne', discharge: 'karta wypisowa', imaging: 'opis badania obrazowego', referral: 'skierowanie', prescription: 'recepta', certificate: 'zaświadczenie', other: 'inny dokument' };
const TEMPLATE_PL: Record<string, string> = { general: 'Wizyta ogólna (POZ, interna)', cardiology: 'Kardiologia', pediatrics: 'Pediatria', soap: 'SOAP', sbar: 'SBAR (przekazanie, konsultacja)' };

function StaffInvitesTab() {
  const { t, fmt } = useI18n();
  const [f, setF] = useState({ email: '', displayName: '', role: 'reception', practitionerId: '' });
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['staff-invites'], queryFn: () => get<{ items: { id: string; email: string; displayName: string; roles: string[]; expiresAt: string }[] }>('/api/admin/staff-invites') });
  const cat = useQuery({ queryKey: ['admin-catalog'], queryFn: () => get<{ practitioners: { id: string; name: string }[] }>('/api/admin/catalog') });
  const invite = useMutation({
    mutationFn: () => post<{ emailed: boolean; url?: string }>('/api/admin/staff-invites', { email: f.email, displayName: f.displayName, roles: [f.role], practitionerId: f.role === 'practitioner' ? f.practitionerId : undefined }),
    onSuccess: (r) => {
      setLink(r.url ?? null);
      setF({ email: '', displayName: '', role: 'reception', practitionerId: '' });
      void q.refetch();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/api/admin/staff-invites/${id}`), onSuccess: () => void q.refetch() });
  return (
    <div className="stack-lg">
      <Card title={t('Zaproś osobę do panelu')}>
        <div className="grid-2">
          <TextField label={t('E-mail')} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <TextField label={t('Imię i nazwisko')} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
          <SelectField label={t('Rola')} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="reception">{t('Rejestracja')}</option>
            <option value="practitioner">{t('Lekarz')}</option>
            <option value="admin">{t('Administrator')}</option>
          </SelectField>
          {f.role === 'practitioner' && (
            <SelectField label={t('Lekarz w katalogu')} value={f.practitionerId} onChange={(e) => setF({ ...f, practitionerId: e.target.value })}>
              <option value="">—</option>
              {cat.data?.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        {invite.isError && <Notice kind="danger">{errorMessage(invite.error, t)}</Notice>}
        {link && (
          <Notice kind="info" title={t('Poczta nie jest skonfigurowana — przekaż link osobiście')}>
            <span className="mono small" style={{ wordBreak: 'break-all' }}>
              {link}
            </span>
          </Notice>
        )}
        <Button icon={<Mail size={16} />} disabled={!f.email || f.displayName.length < 2} loading={invite.isPending} onClick={() => invite.mutate()} style={{ marginTop: 12 }}>
          {t('Wyślij zaproszenie')}
        </Button>
      </Card>
      <Card title={t('Oczekujące zaproszenia')} className="card-flush">
        {!q.data?.items.length ? (
          <Empty title={t('Brak oczekujących zaproszeń')} />
        ) : (
          <ul className="list">
            {q.data.items.map((i) => (
              <li key={i.id} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {i.displayName} · {i.email}
                  </span>
                  <span className="list-sub">{t('ważne do {d}', { d: fmt.dateTime(i.expiresAt) })}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                  {t('Odwołaj')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="small muted">
        {t('Odebranie dostępu po odejściu pracownika: Administracja → Użytkownicy → „Wyłącz konto” (sesje, klucze i linki przestają działać od razu).')} <Link to="/panel/admin">{t('Przejdź')}</Link>
      </p>
    </div>
  );
}

function UsageTab() {
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const q = useQuery({
    queryKey: ['usage', month],
    queryFn: () =>
      get<{ activeDoctors: number; doctors: number; scribeVisits: number; scribeLimit: number; videoMinutes: number; videoVisits: number; lines: { item: string; qty: number; unit: string; priceNet: number }[]; scribePerDoctor: { name: string; used: number; limit: number }[] }>(
        `/api/admin/usage${qs({ month })}`,
      ),
  });
  return (
    <div className="stack-lg">
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <TextField label={t('Miesiąc')} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <a className="btn secondary" href={`/api/admin/usage.csv${qs({ month })}`}>
          <Download size={16} /> {t('Eksport do faktury (CSV)')}
        </a>
      </div>
      {q.data && (
        <>
          <div className="grid-4">
            <div className="stat">
              <div className="label">{t('Aktywni lekarze')}</div>
              <div className="value">
                {q.data.activeDoctors} / {q.data.doctors}
              </div>
            </div>
            <div className="stat">
              <div className="label">{t('Wizyty Scribe')}</div>
              <div className="value">{q.data.scribeVisits}</div>
              <div className="sub">{t('limit {n}', { n: q.data.scribeLimit })}</div>
            </div>
            <div className="stat">
              <div className="label">{t('Minuty wideo')}</div>
              <div className="value">{q.data.videoMinutes}</div>
              <div className="sub">{t('{n} wizyt', { n: q.data.videoVisits })}</div>
            </div>
          </div>
          <Card title={t('Pozycje do faktury (netto; VAT wg decyzji D44 w programie księgowym z KSeF)')} className="card-flush">
            <table className="table">
              <tbody>
                {q.data.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{t(l.item)}</td>
                    <td className="tabular">
                      {l.qty} {l.unit}
                    </td>
                    <td className="tabular">{l.priceNet.toFixed(2)} PLN</td>
                    <td className="tabular">{(l.qty * l.priceNet).toFixed(2)} PLN</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

const SEVERITY_KIND = { low: undefined, medium: 'info', high: 'warn', critical: 'danger' } as const;
const STATUS_PL: Record<string, string> = { new: 'nowe', triage: 'ocena', 'in-progress': 'w obsłudze', resolved: 'rozwiązane', closed: 'zamknięte' };
const CATEGORY_PL: Record<string, string> = { 'data-error': 'błąd w danych', 'ai-content': 'treść AI', privacy: 'prywatność', security: 'bezpieczeństwo', availability: 'dostępność', other: 'inne' };

function IncidentsTab() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['incidents'], queryFn: () => get<{ items: IncidentView[] }>('/api/admin/incidents') });
  const [edit, setEdit] = useState<IncidentView | null>(null);
  return (
    <Card className="card-flush">
      {!q.data?.items.length ? (
        <Empty title={t('Brak zgłoszeń')} />
      ) : (
        <ul className="list">
          {q.data.items.map((i) => (
            <li key={i.id}>
              <button type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }} onClick={() => setEdit(i)}>
                {i.possibleDataBreach ? <ShieldAlert size={18} color="var(--danger)" aria-hidden /> : null}
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {t(CATEGORY_PL[i.category] ?? i.category)} · {i.description.slice(0, 80)}
                  </span>
                  <span className="list-sub">
                    {i.reporter ?? t('pacjent')} · {fmt.dateTime(i.createdAt)} · {t('termin {d}', { d: fmt.dateTime(i.dueAt) })} {i.overdue && <strong style={{ color: 'var(--danger)' }}>{t('po terminie')}</strong>}
                  </span>
                </span>
                <Badge kind={SEVERITY_KIND[i.severity]}>{i.severity}</Badge>
                <Badge>{t(STATUS_PL[i.status])}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && <IncidentModal i={edit} onClose={() => (setEdit(null), void q.refetch())} />}
    </Card>
  );
}

function IncidentModal({ i, onClose }: { i: IncidentView; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ status: i.status, resolution: i.resolution ?? '', escalatedTo: i.escalatedTo ?? '' });
  const save = useMutation({ mutationFn: () => put(`/api/admin/incidents/${i.id}`, { status: f.status, resolution: f.resolution || undefined, escalatedTo: f.escalatedTo || undefined }), onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={t('Zgłoszenie')}>
      <div className="stack">
        {i.possibleDataBreach && <Notice kind="danger">{t('Możliwe naruszenie ochrony danych: 72 godziny na ocenę i ewentualne zgłoszenie do PUODO (art. 33 RODO).')}</Notice>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{i.description}</p>
        {i.contact && <p className="small muted">{t('Kontakt')}: {i.contact}</p>}
        <SelectField label={t('Stan')} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as IncidentView['status'] })}>
          {Object.keys(STATUS_PL).map((s) => (
            <option key={s} value={s}>
              {t(STATUS_PL[s])}
            </option>
          ))}
        </SelectField>
        <TextField label={t('Przekazano dalej do (np. inspektor ochrony danych, dostawca, operator)')} value={f.escalatedTo} onChange={(e) => setF({ ...f, escalatedTo: e.target.value })} />
        <TextArea label={t('Rozwiązanie')} value={f.resolution} onChange={(e) => setF({ ...f, resolution: e.target.value })} />
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          {t('Zapisz')}
        </Button>
      </div>
    </Modal>
  );
}

function AiRegistryTab() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ['ai-registry'],
    queryFn: () =>
      get<{
        mode: string;
        providers: Record<string, string | undefined>;
        tasks: { task: string; promptVersion: string }[];
        templates: { id: string; version: string; kind: string }[];
        dictionaryVersion: string;
        dailyLimit: number;
        calls: { task: string; provider: string; model: string | null; prompt_version: string; outcome: string; calls: number; input_units: number; output_units: number; avg_latency_ms: number }[];
        secondaryUse?: { objections: number; patients: number };
      }>('/api/admin/ai-registry'),
  });
  if (!q.data) return <Skeleton />;
  const d = q.data;
  return (
    <div className="stack-lg">
      <Notice kind="info">{t('Rejestr zastosowań AI: zadania, wersje poleceń i szablonów, wywołania (bez treści medycznych). Model nie dostaje zadań oceny stanu zdrowia.')}</Notice>
      {d.secondaryUse && (
        <Card title={t('Wtórne wykorzystanie danych (EHDS)')}>
          <p style={{ margin: 0 }}>
            {t('Sprzeciwy pacjentów zapisane w rejestrze: {n} (pacjentów w placówce: {p}).', { n: d.secondaryUse.objections, p: d.secondaryUse.patients })}
          </p>
          <p className="small muted" style={{ marginBottom: 0 }}>{t('Eternal nie udostępnia dziś danych do celów wtórnych (badania, statystyka, trenowanie modeli). Rejestr sprzeciwów jest gotowy na dzień stosowania przepisów EHDS.')}</p>
        </Card>
      )}
      <Card title={t('Dostawcy')}>
        <dl className="kv">
          {Object.entries(d.providers).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v ?? '—'}</dd>
            </div>
          ))}
          <dt>{t('Tryb')}</dt>
          <dd>{d.mode}</dd>
          <dt>{t('Limit wywołań na dobę')}</dt>
          <dd>{d.dailyLimit}</dd>
          <dt>{t('Słownik badań')}</dt>
          <dd>{d.dictionaryVersion}</dd>
        </dl>
      </Card>
      <Card title={t('Zadania i wersje')}>
        <ul className="small">
          {d.tasks.map((x) => (
            <li key={x.task}>
              {x.task} — <span className="mono">{x.promptVersion}</span>
            </li>
          ))}
          {d.templates.map((x) => (
            <li key={x.id}>
              {x.kind}: {x.id} — <span className="mono">{x.version}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('Wywołania (30 dni)')} className="card-flush">
        {!d.calls.length ? (
          <Empty title={t('Brak wywołań')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Zadanie')}</th>
                  <th>{t('Dostawca / model')}</th>
                  <th>{t('Wynik')}</th>
                  <th>{t('Liczba')}</th>
                  <th>{t('Średni czas')}</th>
                </tr>
              </thead>
              <tbody>
                {d.calls.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {c.task} <span className="small muted mono">{c.prompt_version}</span>
                    </td>
                    <td>
                      {c.provider} {c.model && <span className="small muted">{c.model}</span>}
                    </td>
                    <td>{c.outcome}</td>
                    <td className="tabular">{c.calls}</td>
                    <td className="tabular">{c.avg_latency_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- konto personelu: klucze sprzętowe (F1.10), urządzenia, zgłoszenie incydentu ------------------------

export function StaffAccountPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHead title={t('Moje konto')} />
      <ReadabilityCard />
      <SecurityKeysCard />
      <SessionsCard />
      <ReportIncidentCard staff />
    </div>
  );
}

