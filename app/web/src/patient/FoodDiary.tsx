import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { get } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, Empty, Notice, QueryError, Segmented, Skeleton, TextArea, TextField } from '../ui';
import { History, useAdd, useJournal, type FoodItem, type FoodTotals } from './JournalPages';

/**
 * Dziennik żywienia (F11.1, F11.3–F11.5) i czynności dnia codziennego (A22.2).
 *
 * Żywienie: produkt z Open Food Facts (kod kreskowy albo nazwa) albo wpis z etykiety; aplikacja tylko sumuje
 * kalorie i makroskładniki z wartości na 100 g. Bez zaleceń, bez oceny diety.
 * Czynności dnia: pytania skal Katza (ADL) i Lawtona (IADL); bez sumy punktów — odpowiedzi ocenia lekarz.
 */

export const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Śniadanie',
  'second-breakfast': 'Drugie śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};

interface FoodProduct {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  source: 'openfoodfacts' | 'demo';
}

const portion = (per100: number | undefined, grams: number) => (per100 === undefined ? undefined : Math.round(((per100 * grams) / 100) * 10) / 10);

export function totalsOf(items: FoodItem[]): FoodTotals {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, incomplete: 0 };
  for (const i of items) {
    if (i.kcal100 === undefined) t.incomplete += 1;
    t.kcal += portion(i.kcal100, i.grams) ?? 0;
    t.protein += portion(i.protein100, i.grams) ?? 0;
    t.fat += portion(i.fat100, i.grams) ?? 0;
    t.carbs += portion(i.carbs100, i.grams) ?? 0;
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  return { kcal: Math.round(t.kcal), protein: r(t.protein), fat: r(t.fat), carbs: r(t.carbs), incomplete: t.incomplete };
}

function TotalsLine({ totals }: { totals: FoodTotals }) {
  const { t, fmt } = useI18n();
  return (
    <span>
      {t('{k} kcal · białko {p} g · tłuszcz {f} g · węglowodany {c} g', { k: fmt.number(totals.kcal), p: fmt.number(totals.protein), f: fmt.number(totals.fat), c: fmt.number(totals.carbs) })}
      {totals.incomplete > 0 && <span className="muted"> · {t('bez wartości: {n}', { n: totals.incomplete })}</span>}
    </span>
  );
}

const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

function ManualItem({ onAdd }: { onAdd: (i: FoodItem) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: '', grams: '100', kcal: '', protein: '', fat: '', carbs: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !(Number(f.grams) > 0)) return;
    onAdd({ name: f.name.trim(), grams: Number(f.grams), kcal100: numOrUndef(f.kcal), protein100: numOrUndef(f.protein), fat100: numOrUndef(f.fat), carbs100: numOrUndef(f.carbs), source: 'manual' });
    setF({ name: '', grams: '100', kcal: '', protein: '', fat: '', carbs: '' });
  };
  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid-2">
        <TextField label={t('Nazwa produktu')} value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label={t('Porcja (g)')} type="number" min={1} max={3000} value={f.grams} onChange={(e) => setF({ ...f, grams: e.target.value })} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>{t('Wartości na 100 g z etykiety (opcjonalnie):')}</p>
      <div className="grid-4">
        <TextField label={t('kcal')} inputMode="decimal" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} />
        <TextField label={t('Białko (g)')} inputMode="decimal" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} />
        <TextField label={t('Tłuszcz (g)')} inputMode="decimal" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value })} />
        <TextField label={t('Węglowodany (g)')} inputMode="decimal" value={f.carbs} onChange={(e) => setF({ ...f, carbs: e.target.value })} />
      </div>
      <Button type="submit" variant="secondary" icon={<Plus size={16} />} disabled={!f.name.trim()}>
        {t('Dodaj do posiłku')}
      </Button>
    </form>
  );
}

function ProductSearch({ onAdd }: { onAdd: (i: FoodItem) => void }) {
  const { t, fmt } = useI18n();
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const isBarcode = /^\d{8,14}$/.test(submitted);
  const q = useQuery({
    queryKey: ['food-search', submitted],
    enabled: submitted.length >= 3,
    queryFn: async () => {
      if (isBarcode) {
        const r = await get<{ product?: FoodProduct; remoteError?: string }>(`/api/food/product/${submitted}`);
        return { items: r.product ? [r.product] : [], remoteError: r.remoteError };
      }
      return get<{ items: FoodProduct[]; remoteError?: string }>(`/api/food/search?q=${encodeURIComponent(submitted)}`);
    },
  });
  return (
    <div className="stack">
      <form
        className="row"
        style={{ gap: 8, alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <div className="grow">
          <TextField label={t('Szukaj w Open Food Facts (nazwa albo kod kreskowy)')} value={term} maxLength={80} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" icon={<Search size={16} />} disabled={term.trim().length < 3}>
          {t('Szukaj')}
        </Button>
      </form>
      {q.isFetching && <Skeleton count={2} />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && (
        <>
          {q.data.items.some((i) => i.source === 'demo') && <Notice kind="info">{t('Produkty przykładowe (tryb demonstracyjny) — brak połączenia z Open Food Facts.')}</Notice>}
          {q.data.remoteError && !q.data.items.length && <Notice kind="warn">{t('Open Food Facts jest teraz niedostępne. Wpisz produkt ręcznie z etykiety.')}</Notice>}
          {!q.data.remoteError && !q.data.items.length && <Empty title={t('Nie znaleziono produktu. Wpisz go ręcznie z etykiety.')} />}
          {q.data.items.length > 0 && (
            <ul className="list">
              {q.data.items.map((p) => (
                <li key={p.barcode} className="list-item">
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {p.name}
                      {p.brand ? ` · ${p.brand}` : ''}
                    </span>
                    <span className="list-sub">
                      {p.kcal100 !== undefined ? t('{k} kcal / 100 g', { k: fmt.number(p.kcal100) }) : t('brak wartości odżywczych')} · {p.barcode}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={16} />}
                    onClick={() => onAdd({ name: p.name, grams: 100, kcal100: p.kcal100, protein100: p.protein100, fat100: p.fat100, carbs100: p.carbs100, barcode: p.barcode, source: 'openfoodfacts' })}
                  >
                    {t('Dodaj')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="small muted" style={{ margin: 0 }}>{t('Do Open Food Facts trafia tylko wpisana nazwa albo kod — bez Twoich danych. Wartości pochodzą od producentów i społeczności; sprawdź je z etykietą.')}</p>
    </div>
  );
}

export function FoodTab() {
  const { t, fmt } = useI18n();
  const q = useJournal('food');
  const add = useAdd('food', () => undefined);
  const days = useQuery({ queryKey: ['journal-overview', 'food'], queryFn: () => get<{ days: { date: string; totals: FoodTotals; meals: number }[] }>('/api/me/journal/overview?kind=food&days=30') });
  const [meal, setMeal] = useState('breakfast');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const addItem = (i: FoodItem) => setItems((xs) => [...xs, i]);
  return (
    <div className="stack-lg">
      <Card title={t('Co zjadłeś(-aś)?')}>
        <div className="stack">
          <Segmented label={t('Posiłek')} value={meal} onChange={setMeal} options={Object.entries(MEAL_LABEL).map(([value, label]) => ({ value, label: t(label) }))} />
          <Segmented
            label={t('Sposób dodania')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'search', label: t('Wyszukaj produkt') },
              { value: 'manual', label: t('Wpisz z etykiety') },
            ]}
          />
          {mode === 'search' ? <ProductSearch onAdd={addItem} /> : <ManualItem onAdd={addItem} />}
          {items.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{t(MEAL_LABEL[meal])}</h3>
              <ul className="list">
                {items.map((i, idx) => (
                  <li key={`${i.name}-${idx}`} className="list-item" style={{ flexWrap: 'wrap' }}>
                    <span className="grow" style={{ minWidth: 160 }}>
                      <span className="list-title" style={{ display: 'block' }}>{i.name}</span>
                      <span className="list-sub">
                        {portion(i.kcal100, i.grams) !== undefined ? t('{k} kcal w porcji', { k: fmt.number(portion(i.kcal100, i.grams)!) }) : t('brak wartości odżywczych')}
                      </span>
                    </span>
                    <div style={{ width: 120 }}>
                      <TextField
                        label={t('Porcja (g)')}
                        type="number"
                        min={1}
                        max={3000}
                        value={String(i.grams)}
                        onChange={(e) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, grams: Math.max(1, Number(e.target.value) || 1) } : x)))}
                      />
                    </div>
                    <Button variant="ghost" size="sm" aria-label={t('Usuń z posiłku')} icon={<Trash2 size={16} />} onClick={() => setItems((xs) => xs.filter((_, j) => j !== idx))} />
                  </li>
                ))}
              </ul>
              <p style={{ margin: 0 }}>
                <strong>{t('Razem:')}</strong> <TotalsLine totals={totalsOf(items)} />
              </p>
              <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
              <Button loading={add.isPending} onClick={() => add.mutate({ meal, items, note: note || undefined }, { onSuccess: () => (setItems([]), setNote('')) })}>
                {t('Zapisz posiłek')}
              </Button>
            </div>
          )}
          <p className="small muted" style={{ margin: 0 }}>{t('Aplikacja tylko sumuje wartości z etykiet. Nie ocenia diety i nie zastępuje dietetyka.')}</p>
        </div>
      </Card>
      <Card title={t('Dzień po dniu (30 dni)')}>
        {days.isLoading ? <Skeleton count={2} /> : days.isError ? <QueryError error={days.error} /> : !days.data!.days.length ? <Empty title={t('Brak zapisanych posiłków')} /> : (
          <ul className="list">
            {days.data!.days.slice(0, 14).map((d) => (
              <li key={d.date} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{fmt.date(d.date)}</span>
                  <span className="list-sub">
                    <TotalsLine totals={d.totals} /> · {t('posiłki: {n}', { n: d.meals })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('Ostatnie posiłki')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : (
          <History kind="food" items={q.data!.items} render={(e) => `${t(MEAL_LABEL[e.food!.meal] ?? e.food!.meal)}: ${e.food!.items.map((i) => i.name).join(', ')} · ${fmt.number(e.food!.totals.kcal)} kcal`} />
        )}
      </Card>
    </div>
  );
}

// --- czynności dnia codziennego (A22.2) ------------------------------------------------------------------------

export const ADL_LABEL: Record<string, string> = {
  bathing: 'Kąpiel i mycie',
  dressing: 'Ubieranie się',
  toileting: 'Korzystanie z toalety',
  transferring: 'Przemieszczanie się z łóżka na krzesło',
  continence: 'Kontrolowanie potrzeb fizjologicznych',
  feeding: 'Jedzenie',
};

export const IADL_LABEL: Record<string, string> = {
  telephone: 'Korzystanie z telefonu',
  shopping: 'Robienie zakupów',
  cooking: 'Przygotowywanie posiłków',
  housekeeping: 'Sprzątanie i prace domowe',
  laundry: 'Pranie',
  transport: 'Korzystanie z transportu',
  medications: 'Przyjmowanie leków',
  finances: 'Gospodarowanie pieniędzmi',
};

export const ADL_LEVEL_LABEL: Record<string, string> = { independent: 'Samodzielnie', assisted: 'Z pomocą', unable: 'Nie jest w stanie' };
export const FILLED_BY_LABEL: Record<string, string> = { self: 'Sama osoba', caregiver: 'Opiekun', together: 'Razem' };

function AdlGroup({ title, labels, answers, onChange }: { title: string; labels: Record<string, string>; answers: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 10 }}>
      <legend style={{ fontWeight: 700, marginBottom: 6 }}>{t(title)}</legend>
      {Object.entries(labels).map(([k, label]) => (
        <div key={k} className="stack" style={{ gap: 4 }}>
          <span>{t(label)}</span>
          <Segmented label={t(label)} value={answers[k] ?? ''} onChange={(v) => onChange(k, v)} options={Object.entries(ADL_LEVEL_LABEL).map(([value, l]) => ({ value, label: t(l) }))} />
        </div>
      ))}
    </fieldset>
  );
}

export function AdlTab() {
  const { t, fmt } = useI18n();
  const q = useJournal('adl');
  const add = useAdd('adl', () => undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [filledBy, setFilledBy] = useState('self');
  const [note, setNote] = useState('');
  const latest = q.data?.items[0];
  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  return (
    <div className="stack-lg">
      <Card title={t('Czynności dnia codziennego')}>
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            {t('Pytania ze skal Katza (czynności podstawowe) i Lawtona (czynności złożone). Zaznacz, jak jest teraz. Aplikacja nie liczy punktów — odpowiedzi ocenia lekarz, gdy udostępnisz mu dane.')}
          </p>
          <Segmented label={t('Kto wypełnia?')} value={filledBy} onChange={setFilledBy} options={Object.entries(FILLED_BY_LABEL).map(([value, label]) => ({ value, label: t(label) }))} />
          <AdlGroup title="Czynności podstawowe (Katz)" labels={ADL_LABEL} answers={answers} onChange={set} />
          <AdlGroup title="Czynności złożone (Lawton)" labels={IADL_LABEL} answers={answers} onChange={set} />
          <TextArea label={t('Notatka (opcjonalnie)')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button loading={add.isPending} disabled={!Object.keys(answers).length} onClick={() => add.mutate({ answers, filledBy, note: note || undefined }, { onSuccess: () => (setAnswers({}), setNote('')) })}>
            {t('Zapisz')}
          </Button>
        </div>
      </Card>
      <Card title={t('Ostatnia ocena')}>
        {q.isLoading ? <Skeleton count={2} /> : q.isError ? <QueryError error={q.error} /> : !latest?.adl ? <Empty title={t('Brak wpisów z ostatnich 90 dni')} /> : (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small muted" style={{ margin: 0 }}>
              {fmt.dateTime(latest.at)} · {t('wypełnia: {who}', { who: t(FILLED_BY_LABEL[latest.adl.filledBy] ?? latest.adl.filledBy) })}
            </p>
            <dl className="kv">
              {Object.entries({ ...ADL_LABEL, ...IADL_LABEL })
                .filter(([k]) => latest.adl!.answers[k])
                .map(([k, label]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{t(label)}</dt>
                    <dd>{t(ADL_LEVEL_LABEL[latest.adl!.answers[k]] ?? latest.adl!.answers[k])}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </Card>
      {q.data && q.data.items.length > 1 && (
        <Card title={t('Wcześniejsze wpisy')}>
          <History kind="adl" items={q.data.items.slice(1)} render={(e) => t('Odpowiedzi: {n} · wypełnia: {who}', { n: Object.keys(e.adl?.answers ?? {}).length, who: t(FILLED_BY_LABEL[e.adl?.filledBy ?? ''] ?? '') })} />
        </Card>
      )}
    </div>
  );
}
