import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Loading, Notice, P, Screen } from '../../components/ui';
import { get, post } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { ISSUE_PL, KIND_PL } from '../../lib/labels';
import { space, useColors } from '../../lib/theme';
import type { IntakeField, IntakeView } from '../../lib/types';

/**
 * Potwierdzenie odczytu (P3, A2.3): każde pole z wierszem źródłowym z dokumentu. Nic nie jest oceniane —
 * zakres i oznaczenia pochodzą z dokumentu laboratorium. Pola niepotwierdzone lekarz widzi z oznaczeniem.
 */
export default function IntakeReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const qc = useQueryClient();
  const c = useColors();
  const q = useQuery({
    queryKey: ['intake', id],
    queryFn: () => get<IntakeView>(`/api/me/intake/${id}`),
    refetchInterval: (s) => (s.state.data?.status === 'processing' ? 1500 : false),
  });
  const review = useMutation({
    mutationFn: (items: { id: string; action: 'confirm' | 'reject' }[]) => post<IntakeView>(`/api/me/intake/${id}/review`, { items }),
    onSuccess: (v) => qc.setQueryData(['intake', id], v),
  });
  const submit = useMutation({
    mutationFn: () => post<IntakeView>(`/api/me/intake/${id}/submit`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['intake'] });
      void qc.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
  });

  const v = q.data;
  if (!v || v.status === 'processing') {
    return (
      <Screen>
        <Loading label={t('Odczytywanie dokumentu… zwykle kilka sekund.')} />
      </Screen>
    );
  }
  if (v.status === 'submitted' || v.status === 'confirmed') {
    return (
      <Screen>
        <Notice kind="ok">{t('Dokument jest zapisany. Pola niepotwierdzone lekarz zobaczy z oznaczeniem.')}</Notice>
      </Screen>
    );
  }
  const items = v.extract?.items ?? [];
  const certain = items.filter((i) => i.state === 'pending' && i.confidence === 'high');
  const ai = v.extract?.engine.ai;
  const lines = v.extract?.lines ?? [];
  return (
    <Screen>
      <P muted>{t(KIND_PL[v.kind] ?? 'Dokument')}</P>
      <Notice kind="info">
        {ai && !ai.demo ? t('Odczyt maszynowy: program i model AI ({m}). Może zawierać błędy — sprawdź pola na żółto.', { m: ai.model }) : t('Odczyt maszynowy (program). Może zawierać błędy — sprawdź pola na żółto.')}{' '}
        {t('Nic nie jest oceniane: zakres i oznaczenia pochodzą z dokumentu.')}
      </Notice>
      {v.status === 'unreadable' ? <Notice kind="warn">{t('Nie udało się odczytać tekstu z tego pliku. Lekarz zobaczy oryginał.')}</Notice> : null}
      {v.status === 'needs_review' && v.kind === 'lab' && !items.length ? <Notice kind="warn">{t('W dokumencie nie rozpoznano wyników badań. Lekarz zobaczy oryginał.')}</Notice> : null}

      {certain.length > 0 ? <Button title={t('Potwierdź wszystkie pewne ({n})', { n: certain.length })} variant="secondary" loading={review.isPending} onPress={() => review.mutate(certain.map((i) => ({ id: i.id, action: 'confirm' })))} /> : null}

      {items.map((f) => (
        <FieldCard key={f.id} f={f} busy={review.isPending} onAction={(action) => review.mutate([{ id: f.id, action }])} />
      ))}

      {v.extract?.doc?.sections.map((s, i) => (
        <Card key={i} title={s.title}>
          <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 22 }}>{s.lines.map((n) => lines[n]?.text ?? '').join('\n')}</Text>
          <P small muted>
            {t('Treść sekcji jest skopiowana z dokumentu bez zmian.')}
          </P>
        </Card>
      ))}

      {(review.isError || submit.isError) && <Notice kind="danger">{errorMessage(review.error ?? submit.error, t)}</Notice>}
      <P small muted>
        {t('Pól, których nie potwierdzisz, lekarz zobaczy jako „odczyt maszynowy, niepotwierdzony”.')}
      </P>
      <Button title={t('Gotowe — lekarz zobaczy przed wizytą')} loading={submit.isPending} onPress={() => submit.mutate()} />
    </Screen>
  );
}

function FieldCard({ f, busy, onAction }: { f: IntakeField; busy: boolean; onAction: (a: 'confirm' | 'reject') => void }) {
  const { t } = useI18n();
  const c = useColors();
  const state = { pending: { kind: 'warn', label: 'do potwierdzenia' }, confirmed: { kind: 'ok', label: 'potwierdzone' }, corrected: { kind: 'ok', label: 'poprawione' }, rejected: { kind: 'info', label: 'pominięte' } } as const;
  const st = state[f.state];
  return (
    <Card style={f.state === 'pending' && f.confidence !== 'high' ? { borderColor: c.warning, backgroundColor: c.warningSoft } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>{f.name}</Text>
          <Text style={{ color: c.ink, fontSize: 20, fontWeight: '600' }}>
            {f.value} {f.unit ?? ''} {f.flag ? <Text accessibilityLabel={t('Oznaczenie wydrukowane przez laboratorium')}>({f.flag})</Text> : null}
          </Text>
        </View>
        <Badge kind={st.kind}>{t(st.label)}</Badge>
      </View>
      <P small muted>
        {f.rangeText ? t('Zakres z dokumentu: {r}', { r: f.rangeText }) : t('Brak zakresu w dokumencie')}
      </P>
      <Text style={{ color: c.ink2, fontSize: 13, backgroundColor: c.surface2, padding: space(2), borderRadius: 8 }}>
        {t('wiersz {n}', { n: f.line + 1 })}: „{f.sourceText}”
      </Text>
      {f.issues.length > 0 && f.state === 'pending' ? <P small style={{ color: c.warning }}>{f.issues.map((i) => t(ISSUE_PL[i] ?? i)).join(' · ')}</P> : null}
      {f.state === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}>
            <Button title={t('Zgadza się')} disabled={busy} onPress={() => onAction('confirm')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('To nie jest wynik')} variant="secondary" disabled={busy} onPress={() => onAction('reject')} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
