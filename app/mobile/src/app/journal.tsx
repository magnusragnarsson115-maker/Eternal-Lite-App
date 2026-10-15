import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Text, View } from 'react-native';
import { Button, Card, Chips, Empty, Field, Notice, P, Row, Screen } from '../components/ui';
import { del, get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { space, useColors } from '../lib/theme';

/**
 * Dzienniki (F8.2/A8.1 nastrój, F8.14/F9.13 sen i sny, A21.3/A22.3 mapa i skala bólu, A8.6 oddech) — to samo co
 * w przeglądarce. Samoocena bez interpretacji; bardzo niski nastrój albo słowa kryzysowe → numery pomocy (F8.1).
 */

type Kind = 'mood' | 'sleep' | 'pain' | 'breathing';

interface Entry {
  id: string;
  kind: Kind;
  at: string;
  mood?: number;
  tags?: string[];
  sleep?: { date: string; bedtime: string; wake: string; hours: number; quality: number };
  pain?: { intensity: number; regions: string[] };
  breathing?: { minutes: number; pattern: string };
  note?: string;
}

const MOOD_TAGS: Record<string, string> = { work: 'praca lub nauka', family: 'rodzina', sleep: 'sen', health: 'zdrowie', movement: 'ruch', weather: 'pogoda', money: 'pieniądze', loneliness: 'samotność' };
const REGIONS: Record<string, string> = {
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
  pelvis: 'miednica',
  'left-hip': 'lewe biodro',
  'right-hip': 'prawe biodro',
  'left-knee': 'lewe kolano',
  'right-knee': 'prawe kolano',
  'left-foot': 'lewa stopa',
  'right-foot': 'prawa stopa',
};
const PATTERNS: Record<string, { label: string; phases: [string, number][] }> = {
  calm: { label: 'Spokojny oddech 4-6', phases: [['Wdech', 4], ['Wydech', 6]] },
  box: { label: 'Oddech „pudełkowy” 4-4-4-4', phases: [['Wdech', 4], ['Zatrzymaj', 4], ['Wydech', 4], ['Zatrzymaj', 4]] },
  '4-7-8': { label: 'Oddech 4-7-8', phases: [['Wdech', 4], ['Zatrzymaj', 7], ['Wydech', 8]] },
};

function Multi({ options, value, onChange }: { options: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {Object.entries(options).map(([k, v]) => {
        const on = value.includes(k);
        return (
          <Text
            key={k}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            style={{ minHeight: 44, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: 22, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.surface, color: c.ink, fontWeight: on ? '700' : '400', overflow: 'hidden', textAlignVertical: 'center' }}
          >
            {t(v)}
          </Text>
        );
      })}
    </View>
  );
}

function useEntries(kind: Kind) {
  return useQuery({ queryKey: ['journal', kind], queryFn: () => get<{ items: Entry[] }>(`/api/me/journal?kind=${kind}&days=90`) });
}

function useAdd(kind: Kind) {
  const qc = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (b: Record<string, unknown>) => post<{ entry: Entry; crisis?: boolean }>('/api/me/journal', { kind, ...b }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['journal', kind] });
      if (r.crisis) {
        Alert.alert(t('Jeśli jest Ci bardzo trudno — nie zostawaj z tym sam(a)'), t('Zadzwoń: 116 123 (wsparcie w kryzysie) albo 112.'), [
          { text: t('Numery pomocowe'), onPress: () => router.push('/crisis') },
          { text: t('Zamknij'), style: 'cancel' },
        ]);
      }
    },
  });
}

function HistoryList({ kind, render }: { kind: Kind; render: (e: Entry) => string }) {
  const { t, dateTime } = useI18n();
  const qc = useQueryClient();
  const q = useEntries(kind);
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/journal/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['journal', kind] }) });
  if (!q.data?.items.length) return <Empty title={t('Brak wpisów z ostatnich 90 dni')} />;
  return (
    <>
      {q.data.items.slice(0, 20).map((e) => (
        <Row key={e.id} title={render(e)} sub={`${dateTime(e.at)}${e.note ? ` · ${e.note}` : ''}`} right={<Button title={t('Usuń')} variant="ghost" onPress={() => remove.mutate(e.id)} />} />
      ))}
    </>
  );
}

function Mood() {
  const { t } = useI18n();
  const add = useAdd('mood');
  const [mood, setMood] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <>
      <Card title={t('Jak się dziś czujesz?')}>
        <P small muted>{t('1 — bardzo źle, 10 — bardzo dobrze. To Twoja ocena; aplikacja jej nie interpretuje.')}</P>
        <Chips label={t('Samopoczucie od 1 do 10')} value={mood} onChange={setMood} options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
        <P small>{t('Co wpłynęło na samopoczucie?')}</P>
        <Multi options={MOOD_TAGS} value={tags} onChange={setTags} />
        <Field label={t('Notatka (opcjonalnie)')} value={note} onChangeText={setNote} multiline maxLength={500} />
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Zapisz')} disabled={!mood} loading={add.isPending} onPress={() => add.mutate({ mood, tags, note: note || undefined }, { onSuccess: () => (setMood(0), setTags([]), setNote('')) })} />
      </Card>
      <Card>
        <Row title={t('Gdy jest bardzo trudno')} sub="116 123 · 112" onPress={() => router.push('/crisis')} />
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        <HistoryList kind="mood" render={(e) => `${t('Samopoczucie')}: ${e.mood}/10`} />
      </Card>
    </>
  );
}

function Sleep() {
  const { t, date } = useI18n();
  const add = useAdd('sleep');
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), bedtime: '23:00', wake: '07:00', note: '' });
  const [quality, setQuality] = useState(3);
  return (
    <>
      <Card title={t('Jak spałeś(-aś)?')}>
        <Field label={t('Dzień pobudki (RRRR-MM-DD)')} value={f.date} onChangeText={(v) => setF({ ...f, date: v })} keyboardType="numbers-and-punctuation" />
        <Field label={t('Zaśnięcie (GG:MM)')} value={f.bedtime} onChangeText={(v) => setF({ ...f, bedtime: v })} keyboardType="numbers-and-punctuation" />
        <Field label={t('Pobudka (GG:MM)')} value={f.wake} onChangeText={(v) => setF({ ...f, wake: v })} keyboardType="numbers-and-punctuation" />
        <P small muted>{t('Jakość snu według Ciebie: 1 — bardzo zła, 5 — bardzo dobra.')}</P>
        <Chips label={t('Jakość snu od 1 do 5')} value={quality} onChange={setQuality} options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))} />
        <Field label={t('Sny i uwagi (opcjonalnie)')} value={f.note} onChangeText={(v) => setF({ ...f, note: v })} multiline maxLength={1000} />
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Zapisz')} loading={add.isPending} onPress={() => add.mutate({ date: f.date, bedtime: f.bedtime, wake: f.wake, quality, note: f.note || undefined })} />
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        <HistoryList kind="sleep" render={(e) => t('{d}: {h} h ({b}–{w}), jakość {q}/5', { d: date(e.sleep!.date), h: e.sleep!.hours, b: e.sleep!.bedtime, w: e.sleep!.wake, q: e.sleep!.quality })} />
      </Card>
    </>
  );
}

function Pain() {
  const { t } = useI18n();
  const add = useAdd('pain');
  const [regions, setRegions] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(-1);
  const [note, setNote] = useState('');
  return (
    <>
      <Card title={t('Gdzie i jak bardzo boli?')}>
        <P small>{t('Gdzie boli? (możesz zaznaczyć kilka miejsc)')}</P>
        <Multi options={REGIONS} value={regions} onChange={setRegions} />
        <P small muted>{t('Siła bólu: 0 — brak bólu, 10 — najgorszy ból, jaki możesz sobie wyobrazić.')}</P>
        <Chips label={t('Siła bólu od 0 do 10')} value={intensity} onChange={setIntensity} options={Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) }))} />
        <Field label={t('Notatka (opcjonalnie)')} value={note} onChangeText={setNote} multiline maxLength={500} />
        <Notice kind="warn">{t('Nagły, bardzo silny ból w klatce piersiowej, duszność albo ból głowy jak nigdy dotąd — dzwoń 112. Aplikacja nie ocenia objawów.')}</Notice>
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Zapisz')} disabled={intensity < 0 || !regions.length} loading={add.isPending} onPress={() => add.mutate({ intensity, regions, note: note || undefined }, { onSuccess: () => (setRegions([]), setIntensity(-1), setNote('')) })} />
      </Card>
      <Card title={t('Ostatnie 90 dni')}>
        <HistoryList kind="pain" render={(e) => `${e.pain!.intensity}/10 · ${e.pain!.regions.map((x) => t(REGIONS[x] ?? x)).join(', ')}`} />
      </Card>
    </>
  );
}

function Breathing() {
  const { t } = useI18n();
  const c = useColors();
  const add = useAdd('breathing');
  const [pattern, setPattern] = useState('calm');
  const [minutes, setMinutes] = useState(3);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);
  const phases = PATTERNS[pattern].phases;
  const cycle = phases.reduce((a, [, s]) => a + s, 0);
  let s = tick % cycle;
  let phase = phases[0];
  for (const p of phases) {
    if (s < p[1]) {
      phase = p;
      break;
    }
    s -= p[1];
  }
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!running || reduced || s !== 0) return;
    if (phase[0] === 'Wdech') Animated.timing(scale, { toValue: 1.7, duration: phase[1] * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    if (phase[0] === 'Wydech') Animated.timing(scale, { toValue: 1, duration: phase[1] * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
  }, [running, reduced, phase, s, scale]);
  useEffect(() => {
    if (running && tick >= minutes * 60) {
      setRunning(false);
      add.mutate({ minutes, pattern });
    }
  }, [running, tick, minutes, pattern, add]);
  return (
    <Card title={t('Ćwiczenie oddechowe')}>
      <P small muted>{t('Kilka minut spokojnego oddechu. Jeśli zakręci Ci się w głowie, wróć do zwykłego oddechu. To ćwiczenie relaksacyjne, nie leczenie.')}</P>
      <Chips label={t('Rodzaj')} value={pattern} onChange={(v) => !running && setPattern(v)} options={Object.entries(PATTERNS).map(([k, v]) => ({ value: k, label: t(v.label) }))} />
      <Chips label={t('Czas')} value={minutes} onChange={(v) => !running && setMinutes(v)} options={[1, 3, 5].map((m) => ({ value: m, label: t('{n} min', { n: m }) }))} />
      <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite">
        <Animated.View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: c.primary, backgroundColor: c.primarySoft, transform: [{ scale }] }} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.ink }}>{running ? `${t(phase[0])} · ${phase[1] - s}` : t('Gotowy?')}</Text>
      </View>
      <Button
        title={running ? t('Zatrzymaj') : t('Zacznij')}
        variant={running ? 'secondary' : 'primary'}
        onPress={() => {
          if (running) return setRunning(false);
          setTick(0);
          scale.setValue(1);
          setRunning(true);
        }}
      />
    </Card>
  );
}

export default function JournalScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Kind>('mood');
  return (
    <Screen>
      <P muted>{t('Samopoczucie, sen, ból i chwila na oddech. Zapisujesz dla siebie — lekarz zobaczy wpisy tylko wtedy, gdy udostępnisz mu dane.')}</P>
      <Chips
        label={t('Rodzaj dziennika')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mood', label: t('Nastrój') },
          { value: 'sleep', label: t('Sen') },
          { value: 'pain', label: t('Ból') },
          { value: 'breathing', label: t('Oddech') },
        ]}
      />
      {tab === 'mood' ? <Mood /> : tab === 'sleep' ? <Sleep /> : tab === 'pain' ? <Pain /> : <Breathing />}
    </Screen>
  );
}
