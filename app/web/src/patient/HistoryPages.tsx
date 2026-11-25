import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { del, get, post, put } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import { Badge, Button, Card, Checkbox, Empty, Notice, PageHead, QueryError, Segmented, SelectField, Skeleton, Tabs, TextArea, TextField, useToast } from '../ui';
import { FamilyTree, GenomicFilesCard } from './FamilyTree';

/**
 * Historia zdrowia wpisywana przez pacjenta (A20.7/A21.7 szczepienia i terminy z karty szczepień, A20.9/A21.9 choroby
 * w rodzinie, A22.5 dyspozycje medyczne). Aplikacja zapisuje fakty — nie wylicza zaleceń ani ryzyka.
 */

interface Vaccination {
  id: string;
  status: 'done' | 'planned';
  vaccine: string;
  code?: string;
  date: string;
  dose?: number;
  lot?: string;
  place?: string;
  note?: string;
}

interface FamilyEntry {
  id: string;
  relationship: string;
  relationshipLabel: string;
  conditions: { code?: string; text: string; onsetAge?: number }[];
  deceased?: boolean;
  deceasedAge?: number;
  note?: string;
}

type DirectiveKind = 'organ-donation' | 'transfusion' | 'info-person' | 'care-wishes';
interface Directive {
  kind: DirectiveKind;
  value?: string;
  person?: { name: string; phone?: string };
  text?: string;
  showOnCard: boolean;
  updatedAt: string;
}

export const RELATIONSHIP_LABEL: Record<string, string> = {
  MTH: 'matka',
  FTH: 'ojciec',
  SIS: 'siostra',
  BRO: 'brat',
  MGRMTH: 'babcia ze strony matki',
  MGRFTH: 'dziadek ze strony matki',
  PGRMTH: 'babcia ze strony ojca',
  PGRFTH: 'dziadek ze strony ojca',
  DAU: 'córka',
  SON: 'syn',
  AUNT: 'ciotka',
  UNCLE: 'wujek',
  EXT: 'inny krewny',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function Vaccinations() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['vaccinations'], queryFn: () => get<{ items: Vaccination[]; vaccines: Record<string, string> }>('/api/me/vaccinations') });
  const [f, setF] = useState({ status: 'done' as 'done' | 'planned', code: 'influenza', name: '', date: todayIso(), dose: '', lot: '', place: '' });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['vaccinations'] });
  const add = useMutation({
    mutationFn: () =>
      post('/api/me/vaccinations', {
        status: f.status,
        code: f.code,
        name: f.code === 'other' ? f.name : undefined,
        date: f.date,
        dose: f.dose ? Number(f.dose) : undefined,
        lot: f.lot || undefined,
        place: f.place || undefined,
      }),
    onSuccess: () => {
      toast(t('Zapisano.'));
      setF({ ...f, name: '', dose: '', lot: '', place: '' });
      refresh();
    },
  });
  const done = useMutation({ mutationFn: (id: string) => post(`/api/me/vaccinations/${id}/done`, { date: todayIso() }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/vaccinations/${id}`), onSuccess: refresh });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const items = q.data!.items;
  const planned = items.filter((v) => v.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const history = items.filter((v) => v.status === 'done');
  return (
    <div className="stack-lg">
      <Card title={t('Dodaj szczepienie albo termin')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Segmented
            label={t('Rodzaj wpisu')}
            value={f.status}
            onChange={(v) => setF({ ...f, status: v, date: v === 'planned' ? '' : todayIso() })}
            options={[
              { value: 'done', label: t('Wykonane') },
              { value: 'planned', label: t('Planowany termin') },
            ]}
          />
          <div className="grid-2">
            <SelectField label={t('Szczepionka')} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })}>
              {Object.entries(q.data!.vaccines).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </SelectField>
            {f.code === 'other' && <TextField label={t('Nazwa szczepionki')} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
            <TextField label={f.status === 'done' ? t('Data szczepienia') : t('Planowana data')} type="date" required value={f.date} min={f.status === 'planned' ? todayIso() : undefined} max={f.status === 'done' ? todayIso() : undefined} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <TextField label={t('Dawka (numer, opcjonalnie)')} type="number" min={1} max={10} value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
            {f.status === 'done' && <TextField label={t('Numer serii (opcjonalnie)')} value={f.lot} maxLength={40} onChange={(e) => setF({ ...f, lot: e.target.value })} />}
            {f.status === 'done' && <TextField label={t('Gdzie (opcjonalnie)')} value={f.place} maxLength={120} onChange={(e) => setF({ ...f, place: e.target.value })} />}
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t('Przepisz dane z karty szczepień, książeczki zdrowia albo zaświadczenia. Aplikacja nie wylicza, jakie szczepienia są zalecane — o to zapytaj lekarza.')}</p>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      {planned.length > 0 && (
        <Card title={t('Planowane terminy')}>
          <ul className="list">
            {planned.map((v) => (
              <li key={v.id} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {t(v.vaccine)} {v.dose ? <span className="small muted">· {t('dawka {n}', { n: v.dose })}</span> : null}
                  </span>
                  <span className="list-sub">{fmt.date(v.date)}</span>
                </span>
                <Button size="sm" variant="secondary" icon={<CheckCircle2 size={16} />} onClick={() => done.mutate(v.id)}>
                  {t('Wykonane dziś')}
                </Button>
                <Button size="sm" variant="ghost" aria-label={t('Usuń wpis')} icon={<Trash2 size={16} />} onClick={() => remove.mutate(v.id)} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={t('Wykonane szczepienia')}>
        {history.length === 0 ? (
          <Empty title={t('Brak wpisów')} />
        ) : (
          <ul className="list">
            {history.map((v) => (
              <li key={v.id} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {t(v.vaccine)} {v.dose ? <span className="small muted">· {t('dawka {n}', { n: v.dose })}</span> : null}
                  </span>
                  <span className="list-sub">
                    {v.date.length === 10 ? fmt.date(v.date) : v.date}
                    {v.place ? ` · ${v.place}` : ''}
                    {v.lot ? ` · ${t('seria {s}', { s: v.lot })}` : ''}
                  </span>
                </span>
                <Badge kind="info">{t('zgłoszone przez Ciebie')}</Badge>
                <Button size="sm" variant="ghost" aria-label={t('Usuń wpis')} icon={<Trash2 size={16} />} onClick={() => remove.mutate(v.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FamilyHistory() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['family-history'], queryFn: () => get<{ items: FamilyEntry[]; conditions: Record<string, string> }>('/api/me/family-history') });
  const [relationship, setRelationship] = useState('MTH');
  const [codes, setCodes] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [onset, setOnset] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['family-history'] });
  const add = useMutation({
    mutationFn: () =>
      post('/api/me/family-history', {
        relationship,
        conditions: [
          ...codes.filter((c) => c !== 'other').map((c) => ({ code: c, onsetAge: onset && codes.length === 1 ? Number(onset) : undefined })),
          ...(other.trim() ? [{ code: 'other', text: other.trim() }] : []),
        ],
      }),
    onSuccess: () => {
      toast(t('Zapisano.'));
      setCodes([]);
      setOther('');
      setOnset('');
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/family-history/${id}`), onSuccess: refresh });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack-lg">
      <Card title={t('Na co chorowali Twoi krewni?')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <SelectField label={t('Krewny')} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {Object.entries(RELATIONSHIP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </SelectField>
          <div className="chips" role="group" aria-label={t('Choroby')}>
            {Object.entries(q.data!.conditions)
              .filter(([k]) => k !== 'other')
              .map(([k, v]) => {
                const on = codes.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => setCodes(on ? codes.filter((x) => x !== k) : [...codes, k])}>
                    {t(v)}
                  </button>
                );
              })}
          </div>
          <div className="grid-2">
            <TextField label={t('Inna choroba (opcjonalnie)')} value={other} maxLength={120} onChange={(e) => setOther(e.target.value)} />
            {codes.length === 1 && <TextField label={t('W jakim wieku zachorował(a)? (opcjonalnie)')} type="number" min={0} max={120} value={onset} onChange={(e) => setOnset(e.target.value)} />}
          </div>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" loading={add.isPending} disabled={!codes.length && !other.trim()}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Wpisy')}>
        {q.data!.items.length === 0 ? (
          <Empty title={t('Brak wpisów')} />
        ) : (
          <ul className="list">
            {q.data!.items.map((f) => (
              <li key={f.id} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{t(RELATIONSHIP_LABEL[f.relationship] ?? f.relationshipLabel)}</span>
                  <span className="list-sub">{f.conditions.map((c) => `${t(c.text)}${c.onsetAge !== undefined ? ` (${t('od {n} r.ż.', { n: c.onsetAge })})` : ''}`).join(', ')}</span>
                </span>
                <Button size="sm" variant="ghost" aria-label={t('Usuń wpis')} icon={<Trash2 size={16} />} onClick={() => remove.mutate(f.id)} />
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>{t('Lekarz zobaczy te informacje, gdy udostępnisz mu dane. Aplikacja nie ocenia ryzyka.')}</p>
      </Card>
      {q.data!.items.length > 0 && <FamilyTree items={q.data!.items} labels={RELATIONSHIP_LABEL} />}
    </div>
  );
}

function Directives() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['directives'], queryFn: () => get<{ items: Directive[]; disclaimer: string }>('/api/me/directives') });
  const save = useMutation({
    mutationFn: (b: Record<string, unknown>) => put<{ items: Directive[] }>('/api/me/directives', b),
    onSuccess: (r) => {
      qc.setQueryData(['directives'], { ...q.data!, items: r.items });
      toast(t('Zapisano.'));
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const [person, setPerson] = useState<{ name: string; phone: string } | null>(null);
  const [wishes, setWishes] = useState<string | null>(null);
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} />;
  const get1 = (k: DirectiveKind) => q.data!.items.find((d) => d.kind === k);
  const organ = get1('organ-donation');
  const transfusion = get1('transfusion');
  const info = get1('info-person');
  const care = get1('care-wishes');
  const p = person ?? { name: info?.person?.name ?? '', phone: info?.person?.phone ?? '' };
  const w = wishes ?? care?.text ?? '';
  return (
    <div className="stack-lg">
      <Notice kind="info">{t(q.data!.disclaimer)}</Notice>
      <Card title={t('Oświadczenie woli — dawstwo narządów')}>
        <div className="stack">
          <Segmented
            label={t('Moja decyzja')}
            value={organ?.value ?? ''}
            onChange={(v) => save.mutate({ kind: 'organ-donation', value: v, showOnCard: organ?.showOnCard ?? true })}
            options={[
              { value: 'donor', label: t('Chcę być dawcą') },
              { value: 'objection-registered', label: t('Złożyłem(-am) sprzeciw w rejestrze') },
              { value: 'undecided', label: t('Nie zdecydowałem(-am)') },
            ]}
          />
          {organ && <Checkbox label={t('Pokaż na karcie ratunkowej i karcie na wyjazd')} checked={organ.showOnCard} onChange={(e) => save.mutate({ kind: 'organ-donation', value: organ.value, showOnCard: e.target.checked })} />}
          <p className="small muted" style={{ margin: 0 }}>{t('W Polsce sprzeciw wobec pobrania narządów jest ważny tylko po wpisaniu do Centralnego Rejestru Sprzeciwów (Poltransplant). Porozmawiaj o swojej decyzji z bliskimi.')}</p>
        </div>
      </Card>
      <Card title={t('Przetoczenie krwi')}>
        <div className="stack">
          <Segmented
            label={t('Moja decyzja')}
            value={transfusion?.value ?? ''}
            onChange={(v) => save.mutate({ kind: 'transfusion', value: v, showOnCard: transfusion?.showOnCard ?? true })}
            options={[
              { value: 'accept', label: t('Zgadzam się') },
              { value: 'refuse', label: t('Nie zgadzam się') },
              { value: 'undecided', label: t('Bez dyspozycji') },
            ]}
          />
          {transfusion && <Checkbox label={t('Pokaż na karcie ratunkowej i karcie na wyjazd')} checked={transfusion.showOnCard} onChange={(e) => save.mutate({ kind: 'transfusion', value: transfusion.value, showOnCard: e.target.checked })} />}
        </div>
      </Card>
      <Card title={t('Osoba, której można przekazać informacje o moim zdrowiu')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ kind: 'info-person', person: { name: p.name, phone: p.phone || undefined }, showOnCard: info?.showOnCard ?? true }, { onSuccess: () => setPerson(null) });
          }}
        >
          <div className="grid-2">
            <TextField label={t('Imię i nazwisko')} required value={p.name} onChange={(e) => setPerson({ ...p, name: e.target.value })} />
            <TextField label={t('Telefon (opcjonalnie)')} type="tel" value={p.phone} onChange={(e) => setPerson({ ...p, phone: e.target.value })} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t('Formalne upoważnienie składasz w każdej placówce osobno (art. 9 ustawy o prawach pacjenta). Tu zapisujesz informację dla bliskich i ratowników.')}</p>
          <Button type="submit" variant="secondary" loading={save.isPending}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
      <Card title={t('Moje życzenia dotyczące leczenia')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ kind: 'care-wishes', text: w, showOnCard: care?.showOnCard ?? false }, { onSuccess: () => setWishes(null) });
          }}
        >
          <TextArea label={t('Co chcesz przekazać bliskim i lekarzom?')} rows={4} maxLength={2000} value={w} onChange={(e) => setWishes(e.target.value)} />
          {care && <Checkbox label={t('Pokaż na karcie ratunkowej i karcie na wyjazd')} checked={care.showOnCard} onChange={(e) => save.mutate({ kind: 'care-wishes', text: care.text, showOnCard: e.target.checked })} />}
          {care && <p className="small muted" style={{ margin: 0 }}>{t('Ostatnia zmiana: {d}', { d: fmt.dateTime(care.updatedAt) })}</p>}
          <Button type="submit" variant="secondary" loading={save.isPending} disabled={w.trim().length < 3}>
            {t('Zapisz')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function HistoryPage() {
  const { t } = useI18n();
  const { profile } = useSession();
  const [tab, setTab] = useState<'vaccinations' | 'family' | 'directives' | 'genomic'>('vaccinations');
  return (
    <div className="stack-lg">
      <PageHead title={t('Historia zdrowia')} sub={t('Szczepienia, choroby w rodzinie i Twoje dyspozycje. Wpisujesz fakty — aplikacja niczego nie wylicza i nie ocenia.')} />
      <Tabs
        label={t('Sekcja')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'vaccinations', label: t('Szczepienia') },
          { value: 'family', label: t('Choroby w rodzinie') },
          ...(profile ? [] : [{ value: 'directives' as const, label: t('Moje dyspozycje') }]),
          ...(profile ? [] : [{ value: 'genomic' as const, label: t('Plik DNA') }]),
        ]}
      />
      {tab === 'vaccinations' && <Vaccinations />}
      {tab === 'family' && <FamilyHistory />}
      {tab === 'directives' && !profile && <Directives />}
      {tab === 'genomic' && !profile && <GenomicFilesCard />}
    </div>
  );
}
