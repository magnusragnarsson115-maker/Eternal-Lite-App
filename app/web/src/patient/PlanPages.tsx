import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, MapPin, Target, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { del, get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { placeUrl } from '../lib/maps';
import { type RehabPlan, WEEKDAY_SHORT } from '../staff/RehabPanel';
import { Button, Card, Checkbox, Empty, Notice, PageHead, QueryError, SelectField, Skeleton, TextField, useToast } from '../ui';

/**
 * Plan ćwiczeń od placówki (A22.4) i cele tygodniowe (A7.6) oraz kalendarz zdrowia z subskrypcją ICS
 * (A17.13/A17.18, F5.6/F5.7). Same liczby i terminy — bez ocen postępów.
 */

interface Goal {
  id: string;
  kind: string;
  title: string;
  target: number;
  unit: string;
  week: { from: string; to: string; value: number; checkedToday?: boolean };
}

const GOAL_OPTIONS: { kind: string; label: string; unit: string; def: number }[] = [
  { kind: 'bp-measure', label: 'Pomiary ciśnienia', unit: 'pomiarów w tygodniu', def: 3 },
  { kind: 'weight-measure', label: 'Pomiary masy ciała', unit: 'pomiarów w tygodniu', def: 1 },
  { kind: 'mood-log', label: 'Wpisy w dzienniku nastroju', unit: 'wpisów w tygodniu', def: 5 },
  { kind: 'sleep-log', label: 'Wpisy w dzienniku snu', unit: 'wpisów w tygodniu', def: 5 },
  { kind: 'breathing-minutes', label: 'Ćwiczenia oddechowe', unit: 'minut w tygodniu', def: 20 },
  { kind: 'custom', label: 'Własny cel', unit: 'razy w tygodniu', def: 3 },
];

function Progress({ value, target }: { value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function RehabPlans() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['rehab'], queryFn: () => get<{ items: RehabPlan[] }>('/api/me/rehab') });
  const log = useMutation({
    mutationFn: (v: { plan: string; activity: number; day: string; done: boolean }) => post<RehabPlan>(`/api/me/rehab/${v.plan}/log`, { activity: v.activity, day: v.day, done: v.done }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rehab'] }),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton count={2} />;
  if (q.isError) return <QueryError error={q.error} />;
  const active = q.data!.items.filter((p) => p.status === 'active');
  if (!active.length) return <Card title={t('Plan ćwiczeń od placówki')}><Empty title={t('Nie masz aktywnego planu ćwiczeń')}>{t('Plan przygotowuje lekarz lub fizjoterapeuta Twojej placówki.')}</Empty></Card>;
  return (
    <>
      {active.map((p) => (
        <Card key={p.id} title={p.title}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {p.author ? `${p.author} · ` : ''}
            {t('od {d}', { d: fmt.date(p.start) })}
            {p.end ? ` ${t('do {d}', { d: fmt.date(p.end) })}` : ''}
          </p>
          {p.note && <Notice kind="info">{p.note}</Notice>}
          <h3 style={{ fontSize: '1rem' }}>{t('Dziś')}</h3>
          {p.today.items.length === 0 ? (
            <p className="muted">{t('Na dziś nie ma zaplanowanych ćwiczeń.')}</p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {p.today.items.map((i) => {
                const a = p.activities[i.index];
                return (
                  <Checkbox
                    key={i.index}
                    checked={i.done}
                    onChange={(e) => log.mutate({ plan: p.id, activity: i.index, day: p.today.date, done: e.target.checked })}
                    label={`${a.name}${a.dose ? ` — ${a.dose}` : ''}`}
                    hint={[a.instructions, a.place].filter(Boolean).join(' · ') || undefined}
                  />
                );
              })}
            </div>
          )}
          <p style={{ marginBottom: 6 }}>
            {t('Wykonane w ostatnich 7 dniach: {a} z {b}', { a: p.adherence.last7.done, b: p.adherence.last7.expected })}
          </p>
          <Progress value={p.adherence.last7.done} target={p.adherence.last7.expected} />
          <details style={{ marginTop: 10 }}>
            <summary>{t('Wszystkie ćwiczenia w planie')}</summary>
            <ul className="list">
              {p.activities.map((a) => (
                <li key={a.index} className="list-item">
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {a.name} {a.dose && <span className="small muted">· {a.dose}</span>}
                    </span>
                    <span className="list-sub">
                      {a.days.map((d) => t(WEEKDAY_SHORT[d - 1])).join(', ')}
                      {a.instructions ? ` · ${a.instructions}` : ''}
                    </span>
                    {a.place && (
                      <a className="list-sub" style={{ display: 'block' }} href={placeUrl(a.place)} target="_blank" rel="noopener noreferrer">
                        <MapPin size={14} aria-hidden /> {a.place}
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <p className="small muted" style={{ marginBottom: 0 }}>{t('Placówka, która przygotowała plan, widzi, które ćwiczenia oznaczasz jako wykonane.')}</p>
        </Card>
      ))}
    </>
  );
}

function Goals() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['goals'], queryFn: () => get<{ items: Goal[] }>('/api/me/goals') });
  const [kind, setKind] = useState('bp-measure');
  const opt = GOAL_OPTIONS.find((o) => o.kind === kind)!;
  const [target, setTarget] = useState(String(opt.def));
  const [title, setTitle] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['goals'] });
  const create = useMutation({
    mutationFn: () => post('/api/me/goals', { kind, target: Number(target), title: kind === 'custom' ? title : undefined }),
    onSuccess: () => {
      toast(t('Dodano cel.'));
      setTitle('');
      refresh();
    },
  });
  const check = useMutation({ mutationFn: (v: { id: string; done: boolean }) => post(`/api/me/goals/${v.id}/check`, { done: v.done }), onSuccess: refresh });
  const end = useMutation({ mutationFn: (id: string) => del(`/api/me/goals/${id}`), onSuccess: refresh });
  return (
    <Card title={t('Moje cele na ten tydzień')}>
      <p className="small muted" style={{ marginTop: 0 }}>{t('Cele ustawiasz sam(a). Liczymy je z Twoich wpisów w aplikacji, od poniedziałku do niedzieli.')}</p>
      {q.isLoading && <Skeleton count={2} />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && q.data.items.length === 0 && <Empty icon={<Target size={26} />} title={t('Nie masz jeszcze celów')} />}
      <div className="stack">
        {q.data?.items.map((g) => (
          <div key={g.id} className="stack" style={{ gap: 6 }}>
            <div className="row-between">
              <strong>{t(g.title)}</strong>
              <span className="row" style={{ gap: 6 }}>
                <span className="small">{t('{a} z {b} {u}', { a: g.week.value, b: g.target, u: t(g.unit) })}</span>
                <Button size="sm" variant="ghost" aria-label={t('Zakończ cel')} icon={<X size={16} />} onClick={() => end.mutate(g.id)} />
              </span>
            </div>
            <Progress value={g.week.value} target={g.target} />
            {g.kind === 'custom' && <Checkbox label={t('Zrobione dziś')} checked={!!g.week.checkedToday} onChange={(e) => check.mutate({ id: g.id, done: e.target.checked })} />}
          </div>
        ))}
      </div>
      <form
        className="stack"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid-2">
          <SelectField
            label={t('Nowy cel')}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setTarget(String(GOAL_OPTIONS.find((o) => o.kind === e.target.value)!.def));
            }}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.kind} value={o.kind}>
                {t(o.label)}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Ile ({u})', { u: t(opt.unit) })} type="number" min={1} max={kind === 'breathing-minutes' ? 300 : 21} required value={target} onChange={(e) => setTarget(e.target.value)} />
          {kind === 'custom' && <TextField label={t('Twój cel (np. spacer 30 minut)')} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </div>
        {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
        <Button type="submit" variant="secondary" loading={create.isPending}>
          {t('Dodaj cel')}
        </Button>
      </form>
    </Card>
  );
}

export function PlanPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHead title={t('Plan i cele')} sub={t('Ćwiczenia od placówki do odhaczania i Twoje cele na tydzień.')} />
      <RehabPlans />
      <Goals />
    </div>
  );
}

// --- kalendarz -----------------------------------------------------------------------------------------------------

interface CalEvent {
  id: string;
  kind: 'appointment' | 'vaccination' | 'rehab' | 'medication';
  title: string;
  detail?: string;
  start: string;
  end?: string;
  allDay: boolean;
  link: string;
}

const addDaysIso = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

function FeedCard({ feed }: { feed: { active: boolean; createdAt?: string; lastReadAt?: string } }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [urls, setUrls] = useState<{ url: string; webcal: string }>();
  const create = useMutation({
    mutationFn: () => post<{ url: string; webcal: string }>('/api/me/calendar/feed'),
    onSuccess: (r) => {
      setUrls(r);
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => del('/api/me/calendar/feed'),
    onSuccess: () => {
      setUrls(undefined);
      toast(t('Subskrypcja wyłączona — poprzedni adres przestał działać.'));
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  return (
    <Card title={t('Kalendarz w telefonie (Google, Apple, Outlook)')}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('Prywatny adres subskrypcji. Do kalendarza trafiają tylko ogólne nazwy („Wizyta”, „Szczepienie”, „Ćwiczenia”) — bez danych o zdrowiu, bo kalendarz przechowuje je u swojego dostawcy.')}
      </p>
      {urls ? (
        <div className="stack">
          <p className="feed-url">{urls.url}</p>
          <div className="btn-row">
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy size={16} />}
              onClick={() => {
                void navigator.clipboard?.writeText(urls.url);
                toast(t('Skopiowano adres.'));
              }}
            >
              {t('Kopiuj adres')}
            </Button>
            <a className="btn sm secondary" href={urls.webcal}>
              <CalendarPlus size={16} aria-hidden /> {t('Otwórz w kalendarzu Apple lub Outlook')}
            </a>
            <a className="btn sm secondary" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(urls.webcal)}`} target="_blank" rel="noreferrer">
              {t('Dodaj do Google Kalendarza')}
            </a>
          </div>
          <Notice kind="warn">{t('Nie udostępniaj tego adresu — kto go zna, widzi terminy. W razie potrzeby wygeneruj nowy.')}</Notice>
        </div>
      ) : feed.active ? (
        <p className="small">
          {t('Subskrypcja włączona {d}.', { d: fmt.date(feed.createdAt) })} {feed.lastReadAt ? t('Ostatnie pobranie przez kalendarz: {d}.', { d: fmt.dateTime(feed.lastReadAt) }) : ''}
        </p>
      ) : null}
      <div className="btn-row">
        <Button size="sm" loading={create.isPending} onClick={() => create.mutate()}>
          {feed.active ? t('Wygeneruj nowy adres') : t('Włącz subskrypcję')}
        </Button>
        {feed.active && (
          <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>
            {t('Wyłącz subskrypcję')}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function HealthCalendarPage() {
  const { t, fmt } = useI18n();
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [meds, setMeds] = useState(false);
  const to = addDaysIso(from, 30);
  const q = useQuery({ queryKey: ['calendar', from, meds], queryFn: () => get<{ items: CalEvent[]; feed: { active: boolean; createdAt?: string; lastReadAt?: string } }>(`/api/me/calendar?from=${from}&to=${to}${meds ? '&meds=1' : ''}`) });
  const byDay = new Map<string, CalEvent[]>();
  for (const e of q.data?.items ?? []) {
    const d = e.allDay ? e.start : new Date(e.start).toLocaleDateString('sv-SE');
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  return (
    <div className="stack-lg">
      <PageHead title={t('Kalendarz zdrowia')} sub={t('Wizyty, planowane szczepienia, dni ćwiczeń i przypomnienia o lekach w jednym miejscu.')} />
      <Card
        title={t('{a} – {b}', { a: fmt.date(from), b: fmt.date(to) })}
        action={
          <span className="btn-row">
            <Button size="sm" variant="ghost" aria-label={t('Wcześniej')} icon={<ChevronLeft size={18} />} onClick={() => setFrom(addDaysIso(from, -30))} />
            <Button size="sm" variant="ghost" onClick={() => setFrom(today)}>
              {t('Dziś')}
            </Button>
            <Button size="sm" variant="ghost" aria-label={t('Później')} icon={<ChevronRight size={18} />} onClick={() => setFrom(addDaysIso(from, 30))} />
          </span>
        }
      >
        <Checkbox label={t('Pokaż codzienne przypomnienia o lekach')} checked={meds} onChange={(e) => setMeds(e.target.checked)} />
        {q.isLoading && <Skeleton count={3} />}
        {q.isError && <QueryError error={q.error} />}
        {q.data && byDay.size === 0 && <Empty title={t('Brak wydarzeń w tym okresie')} />}
        {[...byDay.entries()].map(([day, events]) => (
          <section key={day} className={`cal-day ${day === today ? 'today' : ''}`}>
            <h3>{fmt.dateLong(`${day}T12:00:00`)}</h3>
            {events.map((e) => (
              <Link key={e.id} to={e.link} className="cal-event">
                <span className={`cal-dot ${e.kind}`} aria-hidden />
                <span className="grow">
                  <span className="cal-title" style={{ display: 'block', fontWeight: 600 }}>
                    {e.allDay ? '' : `${fmt.time(e.start)} · `}
                    {t(e.title)}
                  </span>
                  {e.detail && <span className="small muted">{e.detail}</span>}
                </span>
              </Link>
            ))}
          </section>
        ))}
      </Card>
      {q.data && <FeedCard feed={q.data.feed} />}
    </div>
  );
}
