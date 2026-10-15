import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Field, H1, Loading, Notice, P, Screen } from '../../components/ui';
import { get, post } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { space, useColors } from '../../lib/theme';
import type { CardView } from '../../lib/types';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, dateTime } = useI18n();
  const c = useColors();
  const q = useQuery({ queryKey: ['card', id], queryFn: () => get<CardView>(`/api/me/cards/${id}`) });
  const [sh, setSh] = useState({ open: false, phone: '', label: '', days: 7 });
  const share = useMutation({ mutationFn: () => post<{ url: string; expiresAt: string }>(`/api/me/cards/${id}/share`, { days: sh.days, phone: sh.phone || undefined, label: sh.label || undefined }) });
  if (!q.data) return <Screen>{q.isLoading ? <Loading /> : <Notice kind="danger">{t('Nie znaleziono.')}</Notice>}</Screen>;
  const k = q.data;
  const list = (title: string, items: string[]) =>
    items.length > 0 ? (
      <Card title={title}>
        {items.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space(2) }}>
            <Text style={{ color: c.primary, fontSize: 16 }}>•</Text>
            <Text style={{ color: c.ink2, fontSize: 16, lineHeight: 23, flex: 1 }}>{x}</Text>
          </View>
        ))}
      </Card>
    ) : null;
  return (
    <Screen>
      <H1>{k.clinic}</H1>
      <P muted>
        {k.doctor} · {dateTime(k.date)}
      </P>
      <Notice kind="info">{t('Przygotowane przez AI, zatwierdzone przez lekarza.')}</Notice>
      {list(t('Co zrobiono na wizycie'), k.card.whatWasDone)}
      {list(t('Co robić dalej'), k.card.nextSteps)}
      {k.card.whenToReturn ? (
        <Card title={t('Kiedy wrócić')}>
          <P>{k.card.whenToReturn}</P>
        </Card>
      ) : null}
      {list(t('Kiedy zgłosić się wcześniej'), k.card.warningSigns)}
      {k.card.erecipeCode ? (
        <Card title={t('Kod e-recepty')}>
          <Text selectable style={{ fontSize: 30, fontWeight: '700', letterSpacing: 4, color: c.ink }}>
            {k.card.erecipeCode}
          </Text>
          <P small muted>
            {t('W aptece podaj kod i PESEL.')}
          </P>
        </Card>
      ) : null}
      <Card title={t('Udostępnij osobie bliskiej')}>
        {!sh.open ? (
          <Button title={t('Udostępnij kartę na czas')} variant="secondary" onPress={() => setSh({ ...sh, open: true })} />
        ) : share.data ? (
          <Notice kind="ok">{t('Link ważny do {d}. Odczyty zobaczysz w „Kto oglądał moje dane”.', { d: dateTime(share.data.expiresAt) })}</Notice>
        ) : (
          <>
            <Field label={t('Kto (np. córka Ewa)')} value={sh.label} onChangeText={(v) => setSh({ ...sh, label: v })} />
            <Field label={t('Telefon (SMS z linkiem, opcjonalnie)')} value={sh.phone} onChangeText={(v) => setSh({ ...sh, phone: v })} keyboardType="phone-pad" />
            <Field label={t('Ważność (dni, 1–30)')} value={String(sh.days)} onChangeText={(v) => setSh({ ...sh, days: Math.max(1, Math.min(30, Number(v.replace(/\D/g, '')) || 1)) })} keyboardType="number-pad" />
            {share.isError ? <Notice kind="danger">{errorMessage(share.error, t)}</Notice> : null}
            <Button title={t('Udostępnij')} loading={share.isPending} onPress={() => share.mutate()} />
          </>
        )}
      </Card>
      <P small muted>
        {t('W nagłym zagrożeniu życia dzwoń 112.')}
      </P>
    </Screen>
  );
}
