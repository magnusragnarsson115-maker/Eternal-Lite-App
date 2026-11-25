import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, Empty, Notice, QueryError, Skeleton, TextArea, TextField, useToast } from '../ui';

/**
 * Plan rehabilitacji (A22.4) w karcie pacjenta: lekarz lub fizjoterapeuta układa ćwiczenia z dniami tygodnia,
 * a potem widzi liczby — ile sesji zaplanowano do dziś i ile pacjent oznaczył jako wykonane. Bez ocen.
 */

export interface RehabPlan {
  id: string;
  title: string;
  status: string;
  start: string;
  end?: string;
  author?: string;
  note?: string;
  activities: { index: number; name: string; instructions?: string; dose?: string; place?: string; days: number[] }[];
  today: { date: string; items: { index: number; name: string; done: boolean }[] };
  adherence: { last7: { expected: number; done: number }; total: { expected: number; done: number } };
}

export const WEEKDAY_SHORT = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

interface DraftActivity {
  name: string;
  dose: string;
  instructions: string;
  place: string;
  days: number[];
}

const empty = (): DraftActivity => ({ name: '', dose: '', instructions: '', place: '', days: [1, 3, 5] });

export function RehabPanel({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['rehab', patientId], queryFn: () => get<{ items: RehabPlan[] }>(`/api/staff/patients/${patientId}/rehab`) });
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [acts, setActs] = useState<DraftActivity[]>([empty()]);
  const create = useMutation({
    mutationFn: () => post(`/api/staff/patients/${patientId}/rehab`, { title, start, end: end || undefined, note: note || undefined, activities: acts.map((a) => ({ name: a.name, dose: a.dose || undefined, instructions: a.instructions || undefined, place: a.place || undefined, days: a.days })) }),
    onSuccess: () => {
      toast(t('Plan zapisany — pacjent dostał powiadomienie.'));
      setTitle('');
      setNote('');
      setActs([empty()]);
      void qc.invalidateQueries({ queryKey: ['rehab', patientId] });
    },
  });
  const endPlan = useMutation({ mutationFn: (id: string) => post(`/api/staff/rehab/${id}/end`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['rehab', patientId] }) });
  const setAct = (i: number, a: Partial<DraftActivity>) => setActs(acts.map((x, j) => (j === i ? { ...x, ...a } : x)));

  return (
    <div className="stack">
      {q.isLoading && <Skeleton count={2} />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && q.data.items.length === 0 && <Empty title={t('Brak planów rehabilitacji')} />}
      {q.data?.items.map((p) => (
        <Card key={p.id} title={p.title} action={p.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => endPlan.mutate(p.id)}>{t('Zakończ plan')}</Button> : undefined}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('Od {a}', { a: fmt.date(p.start) })}
            {p.end ? ` ${t('do {b}', { b: fmt.date(p.end) })}` : ''} · {p.status === 'active' ? t('aktywny') : t('zakończony')}
          </p>
          <p>
            <strong>{t('Wykonanie (oznaczenia pacjenta):')}</strong> {t('ostatnie 7 dni {a} z {b}, od początku {c} z {d}', { a: p.adherence.last7.done, b: p.adherence.last7.expected, c: p.adherence.total.done, d: p.adherence.total.expected })}
          </p>
          <ul className="list">
            {p.activities.map((a) => (
              <li key={a.index} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {a.name} {a.dose && <span className="small muted">· {a.dose}</span>}
                  </span>
                  <span className="list-sub">
                    {a.days.map((d) => t(WEEKDAY_SHORT[d - 1])).join(', ')}
                    {a.place && ` · ${a.place}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card title={t('Nowy plan rehabilitacji')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid-2">
            <TextField label={t('Nazwa planu')} required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label={t('Od')} type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            <TextField label={t('Do (opcjonalnie)')} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {acts.map((a, i) => (
            <fieldset key={i} className="rehab-activity">
              <legend>{t('Ćwiczenie {n}', { n: i + 1 })}</legend>
              <div className="grid-2">
                <TextField label={t('Nazwa')} required value={a.name} onChange={(e) => setAct(i, { name: e.target.value })} />
                <TextField label={t('Dawka (np. 3 × 10)')} value={a.dose} onChange={(e) => setAct(i, { dose: e.target.value })} />
              </div>
              <TextArea label={t('Instrukcja dla pacjenta')} rows={2} value={a.instructions} onChange={(e) => setAct(i, { instructions: e.target.value })} />
              <TextField label={t('Miejsce (opcjonalnie)')} hint={t('Np. „Basen miejski, ul. Sportowa 1, Kraków” — pacjent zobaczy odnośnik do mapy.')} value={a.place} onChange={(e) => setAct(i, { place: e.target.value })} />
              <div className="chips" role="group" aria-label={t('Dni tygodnia')}>
                {WEEKDAY_SHORT.map((d, k) => {
                  const on = a.days.includes(k + 1);
                  return (
                    <button key={d} type="button" aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => setAct(i, { days: on ? a.days.filter((x) => x !== k + 1) : [...a.days, k + 1] })}>
                      {t(d)}
                    </button>
                  );
                })}
              </div>
              {acts.length > 1 && (
                <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} onClick={() => setActs(acts.filter((_, j) => j !== i))}>
                  {t('Usuń ćwiczenie')}
                </Button>
              )}
            </fieldset>
          ))}
          <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setActs([...acts, empty()])}>
            {t('Dodaj ćwiczenie')}
          </Button>
          <TextArea label={t('Uwagi do planu (opcjonalnie)')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
          <Button type="submit" loading={create.isPending} disabled={!title.trim() || acts.some((a) => !a.name.trim() || !a.days.length)}>
            {t('Zapisz plan i powiadom pacjenta')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
