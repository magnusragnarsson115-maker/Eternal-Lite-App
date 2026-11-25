import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Loading, Notice, P, Row, Screen } from '../components/ui';
import { get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { PURPOSE_PL, SCOPE_PL } from '../lib/labels';
import { radius, space, useColors } from '../lib/theme';

/** Nowe udostępnienie (P2: A24.4): placówka (opcjonalnie lekarz) × zakres × czas; wycofanie w każdej chwili. */
export default function ShareNewScreen() {
  const { t } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState<string>();
  const [practitionerId, setPractitionerId] = useState<string>();
  const [scope, setScope] = useState<'all' | 'results' | 'documents'>('all');
  const [purpose, setPurpose] = useState<'visit' | 'consultation' | 'second-opinion'>('visit');
  const [days, setDays] = useState(7);
  const clinics = useQuery({ queryKey: ['clinics'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/api/directory/clinics') });
  const doctors = useQuery({ queryKey: ['clinic-doctors', orgId], queryFn: () => get<{ items: { id: string; name: string }[] }>(`/api/directory/clinics/${orgId}/practitioners`), enabled: !!orgId });
  const create = useMutation({
    mutationFn: () => post('/api/me/grants', { orgId, practitionerId, scope: { kind: scope }, purpose, days }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grants'] });
      router.back();
    },
  });
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius, borderWidth: 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.surface }}
    >
      <Text style={{ color: c.ink, fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen>
      <Card title={t('Placówka')}>
        {clinics.isLoading ? <Loading /> : clinics.data?.items.map((o) => <Row key={o.id} title={o.name} right={orgId === o.id ? <Text style={{ color: c.primary, fontWeight: '700' }}>✓</Text> : undefined} onPress={() => (setOrgId(o.id), setPractitionerId(undefined))} />)}
      </Card>
      {orgId ? (
        <Card title={t('Lekarz (opcjonalnie)')}>
          <Row title={t('Cała placówka')} right={!practitionerId ? <Text style={{ color: c.primary, fontWeight: '700' }}>✓</Text> : undefined} onPress={() => setPractitionerId(undefined)} />
          {doctors.data?.items.map((d) => <Row key={d.id} title={d.name} right={practitionerId === d.id ? <Text style={{ color: c.primary, fontWeight: '700' }}>✓</Text> : undefined} onPress={() => setPractitionerId(d.id)} />)}
        </Card>
      ) : null}
      <Card title={t('Zakres')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{(['all', 'results', 'documents'] as const).map((k) => chip(t(SCOPE_PL[k]), scope === k, () => setScope(k)))}</View>
      </Card>
      <Card title={t('Cel')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{(['visit', 'consultation', 'second-opinion'] as const).map((k) => chip(t(PURPOSE_PL[k]), purpose === k, () => setPurpose(k)))}</View>
      </Card>
      <Card title={t('Na jak długo')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{[1, 7, 30, 90].map((d) => chip(t('{n} dni', { n: d }), days === d, () => setDays(d)))}</View>
      </Card>
      {create.isError ? <Notice kind="danger">{errorMessage(create.error, t)}</Notice> : null}
      <Button title={t('Udostępnij')} disabled={!orgId} loading={create.isPending} onPress={() => create.mutate()} />
      <P small muted>
        {t('Udostępnienie wygaśnie samo. Wycofasz je w każdej chwili, a każdy odczyt zobaczysz w „Kto oglądał moje dane”.')}
      </P>
    </Screen>
  );
}
