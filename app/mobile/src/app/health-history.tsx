import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Chips, Empty, Field, Notice, P, Row, Screen } from '../components/ui';
import { del, get, post, put } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { useActiveProfile } from '../lib/profile';

/**
 * Historia zdrowia (A20.7/A21.7 szczepienia i terminy, A20.9/A21.9 choroby w rodzinie, A22.5 dyspozycje) — jak
 * w przeglądarce. Fakty wpisane przez pacjenta lub opiekuna; bez wyliczania zaleceń i bez oceny ryzyka.
 */

interface Vaccination {
  id: string;
  status: 'done' | 'planned';
  vaccine: string;
  date: string;
  dose?: number;
}
interface FamilyEntry {
  id: string;
  relationship: string;
  conditions: { text: string; onsetAge?: number }[];
}
interface Directive {
  kind: 'organ-donation' | 'transfusion' | 'info-person' | 'care-wishes';
  value?: string;
  person?: { name: string; phone?: string };
  text?: string;
  showOnCard: boolean;
}

const RELATIONSHIP: Record<string, string> = { MTH: 'matka', FTH: 'ojciec', SIS: 'siostra', BRO: 'brat', MGRMTH: 'babcia ze strony matki', MGRFTH: 'dziadek ze strony matki', PGRMTH: 'babcia ze strony ojca', PGRFTH: 'dziadek ze strony ojca', DAU: 'córka', SON: 'syn', AUNT: 'ciotka', UNCLE: 'wujek', EXT: 'inny krewny' };

function Vaccinations() {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['vaccinations'], queryFn: () => get<{ items: Vaccination[]; vaccines: Record<string, string> }>('/api/me/vaccinations') });
  const [status, setStatus] = useState<'done' | 'planned'>('done');
  const [code, setCode] = useState('influenza');
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const refresh = () => void qc.invalidateQueries({ queryKey: ['vaccinations'] });
  const add = useMutation({ mutationFn: () => post('/api/me/vaccinations', { status, code, date: day }), onSuccess: refresh });
  const done = useMutation({ mutationFn: (id: string) => post(`/api/me/vaccinations/${id}/done`, { date: new Date().toISOString().slice(0, 10) }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/vaccinations/${id}`), onSuccess: refresh });
  return (
    <>
      <Card title={t('Dodaj szczepienie albo termin')}>
        <Chips label={t('Rodzaj wpisu')} value={status} onChange={setStatus} options={[{ value: 'done', label: t('Wykonane') }, { value: 'planned', label: t('Planowany termin') }]} />
        <Chips label={t('Szczepionka')} value={code} onChange={setCode} options={Object.entries(q.data?.vaccines ?? {}).filter(([k]) => k !== 'other').map(([k, v]) => ({ value: k, label: t(v) }))} />
        <Field label={t('Data (RRRR-MM-DD)')} value={day} onChangeText={setDay} keyboardType="numbers-and-punctuation" />
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Zapisz')} loading={add.isPending} onPress={() => add.mutate()} />
      </Card>
      <Card title={t('Szczepienia')}>
        {!q.data?.items.length ? <Empty title={t('Brak wpisów')} /> : null}
        {q.data?.items.map((v) => (
          <Row
            key={v.id}
            title={`${t(v.vaccine)}${v.dose ? ` · ${t('dawka {n}', { n: v.dose })}` : ''}`}
            sub={`${v.date.length === 10 ? date(v.date) : v.date} · ${v.status === 'planned' ? t('planowane') : t('wykonane')}`}
            right={v.status === 'planned' ? <Button title={t('Wykonane dziś')} variant="ghost" onPress={() => done.mutate(v.id)} /> : <Button title={t('Usuń')} variant="ghost" onPress={() => remove.mutate(v.id)} />}
          />
        ))}
        <P small muted>{t('Aplikacja nie wylicza, jakie szczepienia są zalecane — o to zapytaj lekarza.')}</P>
      </Card>
    </>
  );
}

function FamilyHistory() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['family-history'], queryFn: () => get<{ items: FamilyEntry[]; conditions: Record<string, string> }>('/api/me/family-history') });
  const [rel, setRel] = useState('MTH');
  const [cond, setCond] = useState('hypertension');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['family-history'] });
  const add = useMutation({ mutationFn: () => post('/api/me/family-history', { relationship: rel, conditions: [{ code: cond }] }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/family-history/${id}`), onSuccess: refresh });
  return (
    <>
      <Card title={t('Na co chorowali Twoi krewni?')}>
        <Chips label={t('Krewny')} value={rel} onChange={setRel} options={Object.entries(RELATIONSHIP).map(([k, v]) => ({ value: k, label: t(v) }))} />
        <Chips label={t('Choroby')} value={cond} onChange={setCond} options={Object.entries(q.data?.conditions ?? {}).filter(([k]) => k !== 'other').map(([k, v]) => ({ value: k, label: t(v) }))} />
        <Button title={t('Zapisz')} loading={add.isPending} onPress={() => add.mutate()} />
      </Card>
      <Card title={t('Wpisy')}>
        {!q.data?.items.length ? <Empty title={t('Brak wpisów')} /> : null}
        {q.data?.items.map((f) => (
          <Row key={f.id} title={t(RELATIONSHIP[f.relationship] ?? f.relationship)} sub={f.conditions.map((c) => t(c.text)).join(', ')} right={<Button title={t('Usuń')} variant="ghost" onPress={() => remove.mutate(f.id)} />} />
        ))}
      </Card>
    </>
  );
}

function Directives() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['directives'], queryFn: () => get<{ items: Directive[]; disclaimer: string }>('/api/me/directives') });
  const save = useMutation({ mutationFn: (b: Record<string, unknown>) => put('/api/me/directives', b), onSuccess: () => void qc.invalidateQueries({ queryKey: ['directives'] }) });
  const organ = q.data?.items.find((d) => d.kind === 'organ-donation');
  const transfusion = q.data?.items.find((d) => d.kind === 'transfusion');
  return (
    <>
      {q.data ? <Notice>{t(q.data.disclaimer)}</Notice> : null}
      <Card title={t('Oświadczenie woli — dawstwo narządów')}>
        <Chips
          label={t('Moja decyzja')}
          value={organ?.value ?? ''}
          onChange={(v) => save.mutate({ kind: 'organ-donation', value: v, showOnCard: true })}
          options={[
            { value: 'donor', label: t('Chcę być dawcą') },
            { value: 'objection-registered', label: t('Złożyłem(-am) sprzeciw w rejestrze') },
            { value: 'undecided', label: t('Nie zdecydowałem(-am)') },
          ]}
        />
      </Card>
      <Card title={t('Przetoczenie krwi')}>
        <Chips
          label={t('Moja decyzja')}
          value={transfusion?.value ?? ''}
          onChange={(v) => save.mutate({ kind: 'transfusion', value: v, showOnCard: true })}
          options={[
            { value: 'accept', label: t('Zgadzam się') },
            { value: 'refuse', label: t('Nie zgadzam się') },
            { value: 'undecided', label: t('Bez dyspozycji') },
          ]}
        />
        <P small muted>{t('Zaznaczone dyspozycje pokazujemy na karcie ratunkowej i karcie na wyjazd. Zmienisz to w przeglądarce.')}</P>
      </Card>
    </>
  );
}

export default function HealthHistoryScreen() {
  const { t } = useI18n();
  const proxy = !!useActiveProfile();
  const [tab, setTab] = useState<'vaccinations' | 'family' | 'directives'>('vaccinations');
  return (
    <Screen>
      <P muted>{t('Szczepienia, choroby w rodzinie i Twoje dyspozycje. Wpisujesz fakty — aplikacja niczego nie wylicza i nie ocenia.')}</P>
      <Chips
        label={t('Sekcja')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'vaccinations', label: t('Szczepienia') },
          { value: 'family', label: t('Choroby w rodzinie') },
          ...(proxy ? [] : [{ value: 'directives' as const, label: t('Moje dyspozycje') }]),
        ]}
      />
      {tab === 'vaccinations' ? <Vaccinations /> : tab === 'family' ? <FamilyHistory /> : <Directives />}
    </Screen>
  );
}
