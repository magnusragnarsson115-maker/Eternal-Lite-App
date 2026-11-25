import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Empty, Loading, Notice, P, Row, Screen } from '../components/ui';
import { get } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { downloadAndSharePdf } from '../lib/files';
import { useI18n } from '../lib/i18n';
import { radius, space, useColors } from '../lib/theme';

/**
 * Raport okresowy (A4.1/A4.2): podsumowanie pomiarów według rodzaju i źródła z liczbą, zakresem odczytów
 * i średnią (metoda opisana), potwierdzone wyniki i wizyty. Bez oceny i porównań z normą.
 */

type PeriodKind = 'week' | 'month' | 'quarter';

interface Report {
  period: { from: string; to: string; partial: boolean };
  generatedAt: string;
  groups: { id: string; kind: string; unit: string; source: string; device?: string; count: number; stats: { key: 'value' | 'systolic' | 'diastolic'; min: number; max: number; mean?: number }[] }[];
  labs: { id?: string; name: string; date: string; value: string; unit?: string; range?: string; labFlag?: string }[];
  labsUnconfirmed: number;
  appointments: { start: string; serviceName?: string; practitionerName?: string }[];
  empty: boolean;
}

const KIND_LABEL: Record<string, string> = { bp: 'Ciśnienie tętnicze', heartRate: 'Tętno', weight: 'Masa ciała', height: 'Wzrost', temperature: 'Temperatura ciała', spo2: 'Saturacja (SpO₂)', glucose: 'Glukoza we krwi' };
const SOURCE_LABEL: Record<string, string> = { manual: 'wpis ręczny', bluetooth: 'urządzenie Bluetooth', withings: 'Withings', import: 'import z pliku', rpm: 'telemonitoring' };
const STAT_LABEL = { value: 'wartość', systolic: 'skurczowe', diastolic: 'rozkurczowe' } as const;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shift(anchor: string, kind: PeriodKind, dir: -1 | 1): string {
  const [y, m, d] = anchor.split('-').map(Number);
  const dt = kind === 'week' ? new Date(Date.UTC(y, m - 1, d + 7 * dir)) : new Date(Date.UTC(y, m - 1 + (kind === 'month' ? 1 : 3) * dir, 1));
  return dt.toISOString().slice(0, 10);
}

export default function ReportScreen() {
  const { t, date, dateTime } = useI18n();
  const c = useColors();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [anchor, setAnchor] = useState(today());
  const q = useQuery({ queryKey: ['report', kind, anchor], queryFn: () => get<Report>(`/api/me/report?period=${kind}&anchor=${anchor}`) });
  const r = q.data;
  const pdf = useMutation({
    mutationFn: () => downloadAndSharePdf(`/api/me/report.pdf?period=${kind}&anchor=${anchor}`, r ? `eternal-raport-${r.period.from}-${r.period.to}.pdf` : 'eternal-raport.pdf', t('Raport okresowy')),
  });
  const num = (v: number) => String(v).replace('.', ',');
  const kinds: { id: PeriodKind; label: string }[] = [
    { id: 'week', label: t('Tydzień') },
    { id: 'month', label: t('Miesiąc') },
    { id: 'quarter', label: t('Kwartał') },
  ];

  return (
    <Screen>
      <P muted>{t('Twoje pomiary, potwierdzone wyniki badań i wizyty w wybranym okresie. Raport niczego nie ocenia.')}</P>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {kinds.map((k) => (
          <Pressable
            key={k.id}
            accessibilityRole="button"
            accessibilityState={{ selected: k.id === kind }}
            onPress={() => {
              setKind(k.id);
              setAnchor(today());
            }}
            style={{ paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius, borderWidth: 1, borderColor: k.id === kind ? c.primary : c.border, backgroundColor: k.id === kind ? c.primarySoft : c.surface }}
          >
            <Text style={{ color: c.ink, fontWeight: k.id === kind ? '700' : '400' }}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Button title={t('Poprzedni okres')} variant="ghost" onPress={() => setAnchor(shift(anchor, kind, -1))} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('Następny okres')} variant="ghost" disabled={!r || r.period.partial} onPress={() => setAnchor(shift(anchor, kind, 1))} />
        </View>
      </View>

      {q.isLoading ? <Loading /> : null}
      {q.isError ? <Notice kind="danger">{errorMessage(q.error, t)}</Notice> : null}
      {r ? (
        <>
          <P>
            {date(r.period.from)} – {date(r.period.to)}
          </P>
          {r.period.partial ? <Notice>{t('Okres jeszcze trwa — raport obejmuje dane zapisane do {d}.', { d: dateTime(r.generatedAt) })}</Notice> : null}
          {r.empty ? <Empty title={t('Brak danych w tym okresie')} /> : null}

          {r.groups.length ? (
            <Card title={t('Podsumowanie pomiarów')}>
              {r.groups.map((g) => (
                <Row
                  key={g.id}
                  title={`${t(KIND_LABEL[g.kind] ?? g.kind)} · ${t(SOURCE_LABEL[g.source.split(':')[0]] ?? g.source)}${g.device ? ` (${g.device})` : ''}`}
                  sub={[
                    t('Odczyty: {n}', { n: g.count }),
                    ...g.stats.map((s) =>
                      t('{label}: {min}–{max} {unit}, średnia {mean}', {
                        label: t(STAT_LABEL[s.key]),
                        min: num(s.min),
                        max: num(s.max),
                        unit: g.unit,
                        mean: s.mean === undefined ? t('— (1 odczyt)') : num(s.mean),
                      }),
                    ),
                  ].join('\n')}
                />
              ))}
              <P small muted>
                {t('Średnia arytmetyczna wszystkich odczytów z okresu, osobno dla każdego rodzaju, jednostki i źródła; liczona przy co najmniej 2 odczytach. Raport nie porównuje wartości z normami.')}
              </P>
            </Card>
          ) : null}

          <Card title={t('Wyniki badań')}>
            {r.labs.length ? (
              r.labs.map((f, i) => <Row key={f.id ?? i} title={`${f.name}: ${f.value} ${f.unit ?? ''}`} sub={[date(f.date), f.range ? t('zakres z dokumentu: {r}', { r: f.range }) : '', f.labFlag ? t('oznaczenie laboratorium: {f}', { f: f.labFlag }) : ''].filter(Boolean).join(' · ')} />)
            ) : (
              <P muted>{t('Brak potwierdzonych wyników badań z datą w tym okresie.')}</P>
            )}
            {r.labsUnconfirmed ? <P small>{t('Pominięto niepotwierdzone odczyty maszynowe: {n} — nie są faktem, dopóki ich nie sprawdzisz.', { n: r.labsUnconfirmed })}</P> : null}
          </Card>

          <Card title={t('Wizyty')}>
            {r.appointments.length ? r.appointments.map((a) => <Row key={a.start} title={dateTime(a.start)} sub={[a.serviceName, a.practitionerName].filter(Boolean).join(' · ')} />) : <P muted>{t('Brak wizyt w tym okresie.')}</P>}
          </Card>
          <Button title={t('Zapisz lub wyślij PDF')} loading={pdf.isPending} onPress={() => pdf.mutate()} accessibilityHint={t('Otwiera systemowe okno udostępniania: zapis w plikach, poczta, drukarka')} />
          {pdf.isError ? <Notice kind="danger">{errorMessage(pdf.error, t)}</Notice> : null}
        </>
      ) : null}
    </Screen>
  );
}
