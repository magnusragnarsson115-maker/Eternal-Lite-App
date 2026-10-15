import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, Field, Loading, Notice, P, Row, Screen } from '../components/ui';
import { get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { radius, space, useColors } from '../lib/theme';

type Kind = 'bp' | 'heartRate' | 'weight' | 'height' | 'temperature' | 'spo2' | 'glucose';

interface Measurement {
  id: string;
  kind: Kind;
  effective: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit: string;
  source: string;
  corrected?: boolean;
  correctionReason?: string;
  /** Inny odczyt z tej samej minuty (A1.7) — oznaczenie bez rozstrzygania. */
  flags?: { type: 'conflict' | 'same-reading'; withId: string; withSource: string }[];
}

const SOURCE: Record<string, string> = { manual: 'wpis ręczny', bluetooth: 'Bluetooth', withings: 'Withings', import: 'import z pliku' };

/** Lista parametrów z jednostką (UCUM po stronie serwera); zakres wprowadzania sprawdza serwer — tylko przeciw literówkom. */
const KINDS: { id: Kind; label: string; unit: string }[] = [
  { id: 'bp', label: 'Ciśnienie', unit: 'mmHg' },
  { id: 'heartRate', label: 'Tętno', unit: '/min' },
  { id: 'weight', label: 'Masa ciała', unit: 'kg' },
  { id: 'height', label: 'Wzrost', unit: 'cm' },
  { id: 'temperature', label: 'Temperatura', unit: '°C' },
  { id: 'spo2', label: 'Saturacja', unit: '%' },
  { id: 'glucose', label: 'Glukoza', unit: 'mg/dL' },
];

const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined);

/** Wpisy ręczne (P4: A1.3) i korekta z powodem (A1.4) — poprzednia wartość zostaje w historii. Aplikacja nie ocenia wartości. */
export default function MeasurementsScreen() {
  const { t, dateTime } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('bp');
  const [f, setF] = useState({ systolic: '', diastolic: '', pulse: '', value: '' });
  const [fix, setFix] = useState<Measurement | null>(null);
  const [fx, setFx] = useState({ systolic: '', diastolic: '', value: '', reason: '' });
  const list = useQuery({ queryKey: ['measurements'], queryFn: () => get<{ items: Measurement[] }>('/api/me/measurements') });
  const add = useMutation({
    mutationFn: () =>
      post('/api/me/measurements', kind === 'bp' ? { kind, systolic: num(f.systolic), diastolic: num(f.diastolic), pulse: num(f.pulse), source: 'manual' } : { kind, value: num(f.value), source: 'manual' }),
    onSuccess: () => {
      setF({ systolic: '', diastolic: '', pulse: '', value: '' });
      void qc.invalidateQueries({ queryKey: ['measurements'] });
    },
  });
  const correct = useMutation({
    mutationFn: (m: Measurement) => post(`/api/me/measurements/${m.id}/correct`, m.kind === 'bp' ? { systolic: num(fx.systolic), diastolic: num(fx.diastolic), reason: fx.reason } : { value: num(fx.value), reason: fx.reason }),
    onSuccess: () => {
      setFix(null);
      void qc.invalidateQueries({ queryKey: ['measurements'] });
    },
  });
  const def = KINDS.find((k) => k.id === kind)!;
  const show = (m: Measurement) => (m.kind === 'bp' ? `${m.systolic}/${m.diastolic} ${m.unit}` : `${m.value} ${m.unit}`);
  return (
    <Screen>
      <Card title={t('Nowy pomiar')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {KINDS.map((k) => (
            <Pressable
              key={k.id}
              accessibilityRole="button"
              accessibilityState={{ selected: k.id === kind }}
              onPress={() => setKind(k.id)}
              style={{ paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius, borderWidth: 1, borderColor: k.id === kind ? c.primary : c.border, backgroundColor: k.id === kind ? c.primarySoft : c.surface }}
            >
              <Text style={{ color: c.ink, fontWeight: k.id === kind ? '700' : '400' }}>{t(k.label)}</Text>
            </Pressable>
          ))}
        </View>
        {kind === 'bp' ? (
          <>
            <Field label={t('Skurczowe (mmHg)')} value={f.systolic} onChangeText={(v) => setF({ ...f, systolic: v })} keyboardType="number-pad" />
            <Field label={t('Rozkurczowe (mmHg)')} value={f.diastolic} onChangeText={(v) => setF({ ...f, diastolic: v })} keyboardType="number-pad" />
            <Field label={t('Tętno (/min, opcjonalnie)')} value={f.pulse} onChangeText={(v) => setF({ ...f, pulse: v })} keyboardType="number-pad" />
          </>
        ) : (
          <Field label={`${t(def.label)} (${def.unit})`} value={f.value} onChangeText={(v) => setF({ ...f, value: v })} keyboardType="decimal-pad" />
        )}
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Zapisz pomiar')} loading={add.isPending} disabled={kind === 'bp' ? !f.systolic || !f.diastolic : !f.value} onPress={() => add.mutate()} />
        <P small muted>
          {t('Wpis zostanie oznaczony jako „ręczny”. Aplikacja nie ocenia wartości — omów je z lekarzem.')}
        </P>
      </Card>

      {fix ? (
        <Card title={t('Popraw wartość')}>
          <P muted>{t('Obecnie: {v} · {d}', { v: show(fix), d: dateTime(fix.effective) })}</P>
          {fix.kind === 'bp' ? (
            <>
              <Field label={t('Skurczowe (mmHg)')} value={fx.systolic} onChangeText={(v) => setFx({ ...fx, systolic: v })} keyboardType="number-pad" />
              <Field label={t('Rozkurczowe (mmHg)')} value={fx.diastolic} onChangeText={(v) => setFx({ ...fx, diastolic: v })} keyboardType="number-pad" />
            </>
          ) : (
            <Field label={`${t('Nowa wartość')} (${fix.unit})`} value={fx.value} onChangeText={(v) => setFx({ ...fx, value: v })} keyboardType="decimal-pad" />
          )}
          <Field label={t('Powód poprawki')} value={fx.reason} onChangeText={(v) => setFx({ ...fx, reason: v })} />
          {correct.isError ? <Notice kind="danger">{errorMessage(correct.error, t)}</Notice> : null}
          <Button title={t('Zapisz poprawkę')} loading={correct.isPending} disabled={fx.reason.trim().length < 3} onPress={() => correct.mutate(fix)} />
          <Button title={t('Anuluj')} variant="ghost" onPress={() => setFix(null)} />
          <P small muted>
            {t('Poprzednia wartość zostaje w historii razem z powodem poprawki.')}
          </P>
        </Card>
      ) : null}

      <Card title={t('Moje pomiary')}>
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <Empty title={t('Brak pomiarów')} />
        ) : (
          list.data.items.slice(0, 60).map((m) => (
            <Row
              key={m.id}
              title={`${t(KINDS.find((k) => k.id === m.kind)?.label ?? m.kind)}: ${show(m)}`}
              sub={`${dateTime(m.effective)} · ${SOURCE[m.source] ? t(SOURCE[m.source]) : m.source}${m.corrected ? ` · ${t('poprawione')}` : ''}${
                m.flags?.some((fl) => fl.type === 'conflict') ? ` · ${t('inny odczyt z tej samej minuty')}` : m.flags?.length ? ` · ${t('ten sam odczyt z innego źródła')}` : ''
              }`}
              right={m.source === 'manual' ? <Badge>{t('Popraw')}</Badge> : undefined}
              onPress={m.source === 'manual' ? () => (setFix(m), setFx({ systolic: String(m.systolic ?? ''), diastolic: String(m.diastolic ?? ''), value: String(m.value ?? ''), reason: '' })) : undefined}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
