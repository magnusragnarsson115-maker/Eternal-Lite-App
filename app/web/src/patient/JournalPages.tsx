import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Wind } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { del, get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, Empty, FullText, Notice, PageHead, QueryError, Segmented, Skeleton, Tabs, TextArea, TextField, useToast } from '../ui';
import { TrendChart } from '../ui/TrendChart';
import { AdlTab, FoodTab } from './FoodDiary';
import { CrisisModal, CrisisNumbers } from './MvpPages';

/**
 * Dzienniki (F8.2/A8.1 nastrój 1–10, F8.14/F9.13 sen i sny, A21.3/A22.3 mapa i skala bólu, A8.6 oddech).
 * Zapis samooceny bez interpretacji. Numery pomocy zawsze na stronie nastroju; bardzo niski nastrój albo słowa
 * kryzysowe w notatce otwierają okno z numerami (F8.1). Nic nie jest wysyłane do placówki.
 */

export type Kind = 'mood' | 'sleep' | 'pain' | 'breathing' | 'cycle' | 'postpartum' | 'menopause' | 'food' | 'adl';

export interface FoodItem {
  name: string;
  grams: number;
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  barcode?: string;
  source?: 'manual' | 'openfoodfacts';
}

export interface FoodTotals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  incomplete: number;
}

export interface JournalEntry {
  id: string;
  kind: Kind;
  at: string;
  mood?: number;
  tags?: string[];
  sleep?: { date: string; bedtime: string; wake: string; hours: number; quality: number; awakenings?: number };
  pain?: { intensity: number; regions: string[]; character: string[] };
  breathing?: { minutes: number; pattern: string };
  cycle?: { date: string; flow: string; symptoms: string[] };
  postpartum?: { symptoms: string[]; feeding?: { side: string; minutes?: number } };
  menopause?: { symptoms: Record<string, number> };
  food?: { meal: string; items: FoodItem[]; totals: FoodTotals };
  adl?: { answers: Record<string, string>; filledBy: string };
  note?: string;
}

export const MOOD_TAG_LABEL: Record<string, string> = {
  work: 'praca lub nauka',
  family: 'rodzina',
  sleep: 'sen',
  health: 'zdrowie',
  movement: 'ruch',
  weather: 'pogoda',
  money: 'pieniądze',
  loneliness: 'samotność',
};

export const PAIN_REGION_LABEL: Record<string, string> = {
  head: 'głowa',
  neck: 'szyja',
  chest: 'klatka piersiowa',
  abdomen: 'brzuch',
  'upper-back': 'plecy — górna część',
  'lower-back': 'plecy — dolna część (lędźwie)',
  'left-shoulder': 'lewy bark',
  'right-shoulder': 'prawy bark',
  'left-arm': 'lewa ręka',
  'right-arm': 'prawa ręka',
  'left-hand': 'lewa dłoń',
  'right-hand': 'prawa dłoń',
  'left-hip': 'lewe biodro',
  'right-hip': 'prawe biodro',
  'left-knee': 'lewe kolano',
  'right-knee': 'prawe kolano',
  'left-foot': 'lewa stopa',
  'right-foot': 'prawa stopa',
  pelvis: 'miednica',
};

export const PAIN_CHARACTER_LABEL: Record<string, string> = {
  stabbing: 'kłujący',
  burning: 'piekący',
  dull: 'tępy',
  throbbing: 'pulsujący',
  radiating: 'promieniujący',
  cramping: 'skurczowy',
};

const PATTERNS: Record<string, { label: string; phases: [string, number][] }> = {
  box: { label: 'Oddech „pudełkowy” 4-4-4-4', phases: [['Wdech', 4], ['Zatrzymaj', 4], ['Wydech', 4], ['Zatrzymaj', 4]] },
  '4-7-8': { label: 'Oddech 4-7-8', phases: [['Wdech', 4], ['Zatrzymaj', 7], ['Wydech', 8]] },
  calm: { label: 'Spokojny oddech 4-6', phases: [['Wdech', 4], ['Wydech', 6]] },
};

export function useJournal(kind: Kind) {
  return useQuery({ queryKey: ['journal', kind], queryFn: () => get<{ items: JournalEntry[] }>(`/api/me/journal?kind=${kind}&days=90`) });
}

export function useAdd(kind: Kind, onCrisis: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => post<{ entry: JournalEntry; crisis?: boolean }>('/api/me/journal', { kind, ...body }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['journal', kind] });
      void qc.invalidateQueries({ queryKey: ['journal-overview', kind] });
      if (r.crisis) onCrisis();
      else toast(t('Zapisano wpis.'));
    },
  });
}

export function Scale({ from, to, value, onChange, label }: { from: number; to: number; value?: number; onChange: (v: number) => void; label: string }) {
  const values = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      {values.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

export function ChipToggle({ options, value, onChange, label }: { options: Record<string, string>; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const { t } = useI18n();
  return (
    <div className="chips" role="group" aria-label={label}>
      {Object.entries(options).map(([k, v]) => {
        const on = value.includes(k);
        return (
          <button key={k} type="button" aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>
            {t(v)}
          </button>
        );
      })}
    </div>
  );
}

export function History({ kind, items, render }: { kind: Kind; items: JournalEntry[]; render: (e: JournalEntry) => string }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/me/journal/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['journal', kind] });
      void qc.invalidateQueries({ queryKey: ['journal-overview', kind] });
    },
  });
  if (!items.length) return <Empty title={t('Brak wpisów z ostatnich 90 dni')} />;
  return (
    <ul className="list">
      {items.slice(0, 30).map((e) => (
        <li key={e.id} className="list-item">
          <span className="grow">
            <span className="list-title" style={{ display: 'block' }}>{render(e)}</span>
            <span className="list-sub">
              {fmt.dateTime(e.at)}
              {e.note ? ` · ${e.note}` : ''}
            </span>
          </span>
          <Button variant="ghost" size="sm" aria-label={t('Usuń wpis')} icon={<Trash2 size={16} />} onClick={() => remove.mutate(e.id)} />
        </li>
      ))}
    </ul>
  );
}

function Trend({ items, value, unit, label }: { items: JournalEntry[]; value: (e: JournalEntry) => number | undefined; unit: string; label: string }) {
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));
  if (sorted.length < 2) return null;
  return <TrendChart dates={sorted.map((e) => e.at)} unit={unit} height={180} series={[{ key: 'v', label, color: 'var(--chart-line)', values: sorted.map(value) }]} />;
}

function MoodTab({ onCrisis }: { onCrisis: () => void }) {
  const { t } = useI18n();
  const q = useJournal('mood');
  const add = useAdd('mood', onCrisis);
  const [mood, setMood] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <div className="stack-lg">
      <Card title={t('Jak się dziś czujesz?')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mood) return;
            add.mutate({ mood, tags, note: note || undefined }, { onSuccess: () => (setMood(undefined), setTags([]), setNote('')) });
          }}
        >
          <p className="small muted" style={{ margin: 0 }}>{t('1 — bardzo źle, 10 — bardzo dobrze. To Twoja ocena; aplikacja jej nie interpretuje.')}</p>
          <Scale from={1} to={10} value={mood} onChange={setMood} label={t('Samopoczucie od 1 do 10')} />
          <ChipToggle options={MOOD_TAG_LABEL} value={tags} onChange={setTags} label={t('Co wpłynęło na samopoczucie?')} />
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending} disabled={!mood}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Gdy jest bardzo trudno')}>
        <CrisisNumbers />
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <>
            <Trend items={q.data!.items} value={(e) => e.mood} unit="/10" label={t('Samopoczucie')} />
            <History kind="mood" items={q.data!.items} render={(e) => `${t('Samopoczucie')}: ${e.mood}/10${e.tags?.length ? ` · ${e.tags.map((x) => t(MOOD_TAG_LABEL[x] ?? x)).join(', ')}` : ''}`} />
          </>
        )}
      </Card>
    </div>
  );
}

export const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function SleepTab() {
  const { t, fmt } = useI18n();
  const q = useJournal('sleep');
  const add = useAdd('sleep', () => undefined);
  const [f, setF] = useState({ date: todayLocal(), bedtime: '23:00', wake: '07:00', quality: 3, awakenings: '', note: '' });
  return (
    <div className="stack-lg">
      <Card title={t('Jak spałeś(-aś)?')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ date: f.date, bedtime: f.bedtime, wake: f.wake, quality: f.quality, awakenings: f.awakenings === '' ? undefined : Number(f.awakenings), note: f.note || undefined });
          }}
        >
          <div className="grid-2">
            <TextField label={t('Dzień pobudki')} type="date" required value={f.date} max={todayLocal()} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <TextField label={t('Liczba przebudzeń (opcjonalnie)')} type="number" min={0} max={30} value={f.awakenings} onChange={(e) => setF({ ...f, awakenings: e.target.value })} />
            <TextField label={t('Zaśnięcie')} type="time" required value={f.bedtime} onChange={(e) => setF({ ...f, bedtime: e.target.value })} />
            <TextField label={t('Pobudka')} type="time" required value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t('Jakość snu według Ciebie: 1 — bardzo zła, 5 — bardzo dobra.')}</p>
          <Scale from={1} to={5} value={f.quality} onChange={(v) => setF({ ...f, quality: v })} label={t('Jakość snu od 1 do 5')} />
          <TextArea label={t('Sny i uwagi (opcjonalnie)')} rows={3} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <>
            <Trend items={q.data!.items} value={(e) => e.sleep?.hours} unit="h" label={t('Czas snu')} />
            <History
              kind="sleep"
              items={q.data!.items}
              render={(e) => t('{d}: {h} h ({b}–{w}), jakość {q}/5', { d: fmt.date(e.sleep!.date), h: fmt.number(e.sleep!.hours), b: e.sleep!.bedtime, w: e.sleep!.wake, q: e.sleep!.quality })}
            />
          </>
        )}
      </Card>
    </div>
  );
}

/** Uproszczona sylwetka z przodu — Twoja lewa strona po prawej stronie rysunku. Każdy obszar to pole wyboru. */
const BODY: { id: string; shape: 'circle' | 'rect'; x: number; y: number; w: number; h: number }[] = [
  { id: 'head', shape: 'circle', x: 100, y: 28, w: 22, h: 22 },
  { id: 'neck', shape: 'rect', x: 91, y: 52, w: 18, h: 12 },
  { id: 'right-shoulder', shape: 'circle', x: 66, y: 74, w: 12, h: 12 },
  { id: 'left-shoulder', shape: 'circle', x: 134, y: 74, w: 12, h: 12 },
  { id: 'chest', shape: 'rect', x: 76, y: 66, w: 48, h: 40 },
  { id: 'abdomen', shape: 'rect', x: 78, y: 108, w: 44, h: 36 },
  { id: 'pelvis', shape: 'rect', x: 78, y: 146, w: 44, h: 20 },
  { id: 'right-arm', shape: 'rect', x: 50, y: 88, w: 14, h: 64 },
  { id: 'left-arm', shape: 'rect', x: 136, y: 88, w: 14, h: 64 },
  { id: 'right-hand', shape: 'circle', x: 56, y: 166, w: 10, h: 10 },
  { id: 'left-hand', shape: 'circle', x: 144, y: 166, w: 10, h: 10 },
  { id: 'right-hip', shape: 'circle', x: 80, y: 172, w: 9, h: 9 },
  { id: 'left-hip', shape: 'circle', x: 120, y: 172, w: 9, h: 9 },
  { id: 'right-knee', shape: 'circle', x: 86, y: 226, w: 11, h: 11 },
  { id: 'left-knee', shape: 'circle', x: 114, y: 226, w: 11, h: 11 },
  { id: 'right-foot', shape: 'rect', x: 74, y: 278, w: 22, h: 12 },
  { id: 'left-foot', shape: 'rect', x: 104, y: 278, w: 22, h: 12 },
];

function BodyMap({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle(id);
    }
  };
  return (
    <div className="body-map">
      <svg viewBox="0 0 200 300" role="group" aria-label={t('Mapa ciała — widok z przodu')}>
        <path className="body-outline" d="M100 6a22 22 0 1 1 0 44a22 22 0 1 1 0-44M90 50h20v14l26 6 14 18v80h-12V96l-12-6v80l10 110h-26l-10-80-10 80H64l10-110V90l-12 6v72H50V88l14-18 26-6z" />
        {BODY.map((r) => {
          const on = value.includes(r.id);
          const common = {
            role: 'checkbox',
            'aria-checked': on,
            'aria-label': t(PAIN_REGION_LABEL[r.id]),
            tabIndex: 0,
            className: on ? 'region on' : 'region',
            onClick: () => toggle(r.id),
            onKeyDown: key(r.id),
          };
          return r.shape === 'circle' ? <circle key={r.id} cx={r.x} cy={r.y} r={r.w} {...common} /> : <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={6} {...common} />;
        })}
      </svg>
      <div className="stack" style={{ gap: 6 }}>
        <p className="small muted" style={{ margin: 0 }}>{t('Widok z przodu — Twoja lewa strona jest po prawej stronie rysunku. Plecy wybierz poniżej.')}</p>
        <ChipToggle options={{ 'upper-back': PAIN_REGION_LABEL['upper-back'], 'lower-back': PAIN_REGION_LABEL['lower-back'] }} value={value} onChange={onChange} label={t('Plecy')} />
        {value.length > 0 && <p className="small" style={{ margin: 0 }}>{t('Wybrane: {list}', { list: value.map((x) => t(PAIN_REGION_LABEL[x] ?? x)).join(', ') })}</p>}
      </div>
    </div>
  );
}

function PainTab() {
  const { t } = useI18n();
  const q = useJournal('pain');
  const add = useAdd('pain', () => undefined);
  const [intensity, setIntensity] = useState<number>();
  const [regions, setRegions] = useState<string[]>([]);
  const [character, setCharacter] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <div className="stack-lg">
      <Card title={t('Gdzie i jak bardzo boli?')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (intensity === undefined || !regions.length) return;
            add.mutate({ intensity, regions, character, note: note || undefined }, { onSuccess: () => (setIntensity(undefined), setRegions([]), setCharacter([]), setNote('')) });
          }}
        >
          <BodyMap value={regions} onChange={setRegions} />
          <p className="small muted" style={{ margin: 0 }}>{t('Siła bólu: 0 — brak bólu, 10 — najgorszy ból, jaki możesz sobie wyobrazić.')}</p>
          <Scale from={0} to={10} value={intensity} onChange={setIntensity} label={t('Siła bólu od 0 do 10')} />
          <ChipToggle options={PAIN_CHARACTER_LABEL} value={character} onChange={setCharacter} label={t('Jaki to ból?')} />
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <Notice kind="warn">
            <FullText text="Nagły, bardzo silny ból w klatce piersiowej, duszność albo ból głowy jak nigdy dotąd — dzwoń 112. Aplikacja nie ocenia objawów." />
          </Notice>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending} disabled={intensity === undefined || !regions.length}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <>
            <Trend items={q.data!.items} value={(e) => e.pain?.intensity} unit="/10" label={t('Siła bólu')} />
            <History kind="pain" items={q.data!.items} render={(e) => `${e.pain!.intensity}/10 · ${e.pain!.regions.map((x) => t(PAIN_REGION_LABEL[x] ?? x)).join(', ')}`} />
          </>
        )}
      </Card>
    </div>
  );
}

function BreathingTab() {
  const { t } = useI18n();
  const toast = useToast();
  const add = useAdd('breathing', () => undefined);
  const [pattern, setPattern] = useState<'box' | '4-7-8' | 'calm'>('calm');
  const [minutes, setMinutes] = useState('3');
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const started = useRef(0);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const phases = PATTERNS[pattern].phases;
  const cycle = phases.reduce((a, [, s]) => a + s, 0);
  const total = Number(minutes) * 60;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (running && tick >= total) {
      setRunning(false);
      add.mutate({ minutes: Math.round((Date.now() - started.current) / 6000) / 10 || Number(minutes), pattern });
      toast(t('Gotowe. Zapisano ćwiczenie.'));
    }
  }, [running, tick, total, add, minutes, pattern, toast, t]);
  let s = tick % cycle;
  let phase = phases[0];
  for (const p of phases) {
    if (s < p[1]) {
      phase = p;
      break;
    }
    s -= p[1];
  }
  const remaining = phase[1] - s;
  return (
    <Card title={t('Ćwiczenie oddechowe')}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {t('Kilka minut spokojnego oddechu. Jeśli zakręci Ci się w głowie, wróć do zwykłego oddechu. To ćwiczenie relaksacyjne, nie leczenie.')}
        </p>
        <Segmented label={t('Rodzaj')} value={pattern} onChange={(v) => !running && setPattern(v)} options={Object.entries(PATTERNS).map(([k, v]) => ({ value: k as 'box', label: t(v.label) }))} />
        <Segmented label={t('Czas')} value={minutes} onChange={(v) => !running && setMinutes(v)} options={['1', '3', '5'].map((m) => ({ value: m, label: t('{n} min', { n: m }) }))} />
        <div className={`breath ${running && !reduced ? `phase-${phase[0] === 'Wdech' ? 'in' : phase[0] === 'Wydech' ? 'out' : 'hold'}` : ''}`} style={{ ['--phase-s' as string]: `${phase[1]}s` }} aria-live="polite">
          <span className="breath-circle" aria-hidden />
          <span className="breath-text">{running ? `${t(phase[0])} · ${remaining}` : t('Gotowy?')}</span>
        </div>
        {running && <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>{t('Zostało {n} s', { n: Math.max(0, total - tick) })}</p>}
        <Button
          icon={<Wind size={18} />}
          variant={running ? 'secondary' : 'primary'}
          onClick={() => {
            if (running) return setRunning(false);
            started.current = Date.now();
            setTick(0);
            setRunning(true);
          }}
        >
          {running ? t('Zatrzymaj') : t('Zacznij')}
        </Button>
      </div>
    </Card>
  );
}

export function JournalPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Kind>(() => (params.get('tab') as Kind) || 'mood');
  const [crisis, setCrisis] = useState(false);
  return (
    <div className="stack-lg">
      <PageHead title={t('Dzienniki')} sub={t('Samopoczucie, sen, ból, oddech, żywienie i czynności dnia. Zapisujesz dla siebie — lekarz zobaczy wpisy tylko wtedy, gdy udostępnisz mu dane.')} />
      <CrisisModal open={crisis} onClose={() => setCrisis(false)} />
      <Tabs
        label={t('Rodzaj dziennika')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'mood', label: t('Nastrój') },
          { value: 'sleep', label: t('Sen') },
          { value: 'pain', label: t('Ból') },
          { value: 'breathing', label: t('Oddech') },
          { value: 'food', label: t('Żywienie') },
          { value: 'adl', label: t('Czynności dnia') },
        ]}
      />
      {tab === 'mood' && <MoodTab onCrisis={() => setCrisis(true)} />}
      {tab === 'sleep' && <SleepTab />}
      {tab === 'pain' && <PainTab />}
      {tab === 'breathing' && <BreathingTab />}
      {tab === 'food' && <FoodTab />}
      {tab === 'adl' && <AdlTab />}
    </div>
  );
}
