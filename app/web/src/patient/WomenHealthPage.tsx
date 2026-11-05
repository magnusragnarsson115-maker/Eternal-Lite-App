import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, Empty, FullText, Notice, PageHead, QueryError, Segmented, Skeleton, Tabs, TextArea, TextField } from '../ui';
import { ChipToggle, History, Scale, todayLocal, useAdd, useJournal } from './JournalPages';
import { CrisisModal } from './MvpPages';

/**
 * Zdrowie kobiety: dziennik cyklu (A21.2), połogu i karmienia (A21.4), objawów okołomenopauzalnych (A21.5).
 * Zapis obserwacji bez prognoz i bez oceny: aplikacja nie wylicza dni płodnych ani terminu miesiączki —
 * to byłoby oprogramowanie wyrobu medycznego. Pokazuje tylko historię: początki miesiączek i długości cykli.
 */

type Tab = 'cycle' | 'postpartum' | 'menopause';

export const FLOW_LABEL: Record<string, string> = { none: 'Brak', spotting: 'Plamienie', light: 'Słabe', medium: 'Umiarkowane', heavy: 'Obfite' };
export const CYCLE_SYMPTOM_LABEL: Record<string, string> = {
  cramps: 'skurcze, ból brzucha',
  headache: 'ból głowy',
  'breast-tenderness': 'tkliwość piersi',
  bloating: 'wzdęcia',
  acne: 'trądzik',
  'mood-changes': 'zmiany nastroju',
  fatigue: 'zmęczenie',
  'back-pain': 'ból pleców',
};
export const POSTPARTUM_SYMPTOM_LABEL: Record<string, string> = {
  bleeding: 'krwawienie (odchody)',
  'breast-pain': 'ból piersi',
  'perineal-pain': 'ból krocza lub rany',
  fatigue: 'zmęczenie',
  'low-mood': 'obniżony nastrój',
  anxiety: 'lęk, niepokój',
  'sleep-problems': 'problemy ze snem',
  headache: 'ból głowy',
};
export const FEEDING_LABEL: Record<string, string> = { left: 'Lewa pierś', right: 'Prawa pierś', both: 'Obie', bottle: 'Butelka' };
export const MENOPAUSE_SYMPTOM_LABEL: Record<string, string> = {
  'hot-flashes': 'Uderzenia gorąca',
  'night-sweats': 'Nocne poty',
  'sleep-problems': 'Problemy ze snem',
  'mood-changes': 'Zmiany nastroju',
  'joint-pain': 'Bóle stawów',
  palpitations: 'Kołatanie serca',
  headache: 'Ból głowy',
  dryness: 'Suchość pochwy',
};

function CycleTab() {
  const { t, fmt } = useI18n();
  const q = useJournal('cycle');
  const add = useAdd('cycle', () => undefined);
  const overview = useQuery({ queryKey: ['journal-overview', 'cycle'], queryFn: () => get<{ cycle: { starts: string[]; currentDay?: number; lengths: number[] } }>('/api/me/journal/overview?kind=cycle') });
  const [date, setDate] = useState(todayLocal());
  const [flow, setFlow] = useState('light');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const c = overview.data?.cycle;
  return (
    <div className="stack-lg">
      <Card title={t('Dzień cyklu')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ date, flow, symptoms, note: note || undefined }, { onSuccess: () => (setSymptoms([]), setNote('')) });
          }}
        >
          <TextField label={t('Dzień')} type="date" required value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          <Segmented label={t('Krwawienie')} value={flow} onChange={setFlow} options={Object.entries(FLOW_LABEL).map(([value, label]) => ({ value, label: t(label) }))} />
          <ChipToggle options={CYCLE_SYMPTOM_LABEL} value={symptoms} onChange={setSymptoms} label={t('Objawy')} />
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Historia cyklu')}>
        {overview.isLoading ? <Skeleton count={2} /> : overview.isError ? <QueryError error={overview.error} /> : !c?.starts.length ? <Empty title={t('Zapisz dni krwawienia, a zobaczysz tu historię cyklu.')} /> : (
          <dl className="kv">
            <dt>{t('Ostatnia miesiączka od')}</dt>
            <dd>{fmt.date(c.starts[c.starts.length - 1])}</dd>
            {c.currentDay !== undefined && (
              <>
                <dt>{t('Dzień cyklu')}</dt>
                <dd>{c.currentDay}</dd>
              </>
            )}
            {c.lengths.length > 0 && (
              <>
                <dt>{t('Poprzednie cykle (dni)')}</dt>
                <dd>{c.lengths.slice(-6).join(', ')}</dd>
              </>
            )}
          </dl>
        )}
        <p className="small muted" style={{ margin: '10px 0 0' }}>{t('Aplikacja nie przewiduje dni płodnych ani terminu kolejnej miesiączki. To zapis Twoich obserwacji.')}</p>
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <History
            kind="cycle"
            items={q.data!.items}
            render={(e) => `${fmt.date(e.cycle!.date)} · ${t(FLOW_LABEL[e.cycle!.flow] ?? e.cycle!.flow)}${e.cycle!.symptoms.length ? ` · ${e.cycle!.symptoms.map((s) => t(CYCLE_SYMPTOM_LABEL[s] ?? s)).join(', ')}` : ''}`}
          />
        )}
      </Card>
    </div>
  );
}

function PostpartumTab({ onCrisis }: { onCrisis: () => void }) {
  const { t, fmt } = useI18n();
  const q = useJournal('postpartum');
  const add = useAdd('postpartum', onCrisis);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [feeding, setFeeding] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const empty = !symptoms.length && !feeding && !note.trim();
  return (
    <div className="stack-lg">
      <Card title={t('Połóg i karmienie')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (empty) return;
            add.mutate(
              { symptoms, feeding: feeding ? { side: feeding, minutes: minutes ? Number(minutes) : undefined } : undefined, note: note || undefined },
              { onSuccess: () => (setSymptoms([]), setFeeding(''), setMinutes(''), setNote('')) },
            );
          }}
        >
          <ChipToggle options={POSTPARTUM_SYMPTOM_LABEL} value={symptoms} onChange={setSymptoms} label={t('Objawy')} />
          <Segmented
            label={t('Karmienie')}
            value={feeding}
            onChange={setFeeding}
            options={[{ value: '', label: t('Bez karmienia') }, ...Object.entries(FEEDING_LABEL).map(([value, label]) => ({ value, label: t(label) }))]}
          />
          {feeding && <TextField label={t('Czas karmienia (min, opcjonalnie)')} type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <Notice kind="info">
            <FullText text="Jeśli smutek albo lęk utrudniają codzienne życie, porozmawiaj z lekarzem lub położną. W kryzysie dzwoń 116 123, w nagłym zagrożeniu 112." />
          </Notice>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending} disabled={empty}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <History
            kind="postpartum"
            items={q.data!.items}
            render={(e) =>
              [
                e.postpartum!.feeding ? `${t(FEEDING_LABEL[e.postpartum!.feeding.side] ?? e.postpartum!.feeding.side)}${e.postpartum!.feeding.minutes ? ` · ${fmt.number(e.postpartum!.feeding.minutes)} min` : ''}` : '',
                e.postpartum!.symptoms.map((s) => t(POSTPARTUM_SYMPTOM_LABEL[s] ?? s)).join(', '),
              ]
                .filter(Boolean)
                .join(' · ') || t('Notatka')
            }
          />
        )}
      </Card>
    </div>
  );
}

function MenopauseTab() {
  const { t } = useI18n();
  const q = useJournal('menopause');
  const add = useAdd('menopause', () => undefined);
  const [values, setValues] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const any = Object.values(values).some((v) => v > 0) || !!note.trim();
  return (
    <div className="stack-lg">
      <Card title={t('Objawy dziś')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!any) return;
            add.mutate({ symptoms: values, note: note || undefined }, { onSuccess: () => (setValues({}), setNote('')) });
          }}
        >
          <p className="small muted" style={{ margin: 0 }}>{t('0 — brak, 1 — łagodne, 2 — umiarkowane, 3 — bardzo nasilone. To Twoja ocena; aplikacja jej nie interpretuje.')}</p>
          {Object.entries(MENOPAUSE_SYMPTOM_LABEL).map(([k, label]) => (
            <div key={k} className="stack" style={{ gap: 4 }}>
              <span>{t(label)}</span>
              <Scale from={0} to={3} value={values[k]} onChange={(v) => setValues((x) => ({ ...x, [k]: v }))} label={t(label)} />
            </div>
          ))}
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending} disabled={!any}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <History
            kind="menopause"
            items={q.data!.items}
            render={(e) =>
              Object.entries(e.menopause!.symptoms)
                .map(([k, v]) => `${t(MENOPAUSE_SYMPTOM_LABEL[k] ?? k)} ${v}/3`)
                .join(', ') || t('Notatka')
            }
          />
        )}
      </Card>
    </div>
  );
}

export function WomenHealthPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') as Tab) || 'cycle');
  const [crisis, setCrisis] = useState(false);
  return (
    <div className="stack-lg">
      <PageHead title={t('Zdrowie kobiety')} sub={t('Cykl, połóg i karmienie, menopauza. Zapisujesz dla siebie — lekarz zobaczy wpisy tylko wtedy, gdy udostępnisz mu dane.')} />
      <CrisisModal open={crisis} onClose={() => setCrisis(false)} />
      <Tabs
        label={t('Rodzaj dziennika')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'cycle', label: t('Cykl') },
          { value: 'postpartum', label: t('Połóg') },
          { value: 'menopause', label: t('Menopauza') },
        ]}
      />
      {tab === 'cycle' && <CycleTab />}
      {tab === 'postpartum' && <PostpartumTab onCrisis={() => setCrisis(true)} />}
      {tab === 'menopause' && <MenopauseTab />}
    </div>
  );
}
