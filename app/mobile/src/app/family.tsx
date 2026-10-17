import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Badge, Button, Card, Chips, Empty, Field, Loading, Notice, P, Row, Screen } from '../components/ui';
import { del, get, post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { setActiveProfile, useActiveProfile } from '../lib/profile';
import { space, useColors } from '../lib/theme';
import type { CaregiverOverviewItem, FamilyData, FamilyProfile, ProxyAccess, ProxyRelation } from '../lib/types';

/**
 * Rodzina i opiekunowie (A22.1/A24.1, A24.2, A5.13/A22.6 panel opiekuna, A21.6 profil dziecka, A21.11 łącznik rodzinny).
 * To samo co w przeglądarce: przełączanie profilu, kod zaproszenia, odebranie dostępu, profil dziecka.
 */

const RELATION_LABEL: Record<ProxyRelation, string> = { parent: 'rodzic', guardian: 'opiekun prawny', caregiver: 'osoba upoważniona', family: 'rodzina' };
const ACCESS_LABEL: Record<ProxyAccess, string> = { full: 'pełny dostęp', view: 'tylko podgląd' };

function Overview() {
  const { t, dateTime } = useI18n();
  const q = useQuery({ queryKey: ['family', 'overview'], queryFn: () => get<{ items: CaregiverOverviewItem[] }>('/api/me/family/overview') });
  if (!q.data?.items.length) return null;
  return (
    <Card title={t('Panel opiekuna')}>
      <P small muted>
        {t('Stan profili, którymi się opiekujesz — same fakty z aplikacji, bez ocen.')}
      </P>
      {q.data.items.map((i) => (
        <View key={i.patientRef} style={{ gap: space(1), paddingVertical: space(2) }}>
          <P>{i.name}</P>
          <P small muted>
            {i.nextAppointment ? t('Najbliższa wizyta: {d}, {s}', { d: dateTime(i.nextAppointment.start), s: i.nextAppointment.service }) : t('Brak zaplanowanych wizyt')}
          </P>
          <P small muted>
            {i.medsToday.due + i.medsToday.taken + i.medsToday.skipped + i.medsToday.missed === 0
              ? t('Brak przypomnień o lekach na dziś')
              : t('Leki dziś: przyjęte {a}, pominięte {b}, bez potwierdzenia {c}, czekają {d}', { a: i.medsToday.taken, b: i.medsToday.skipped, c: i.medsToday.missed, d: i.medsToday.due })}
          </P>
          <P small muted>
            {t('Nieprzeczytane wiadomości: {n}', { n: i.unreadMessages })}
          </P>
        </View>
      ))}
    </Card>
  );
}

export default function FamilyScreen() {
  const { t } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const active = useActiveProfile();
  const q = useQuery({ queryKey: ['family'], queryFn: () => get<FamilyData>('/api/me/family') });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['family'] });

  const [code, setCode] = useState('');
  const accept = useMutation({
    mutationFn: () => post<FamilyProfile>('/api/me/family/accept', { code }),
    onSuccess: (p) => {
      setCode('');
      refresh();
      Alert.alert(t('Masz dostęp do profilu: {name}', { name: p.name }));
    },
  });

  const [invRelation, setInvRelation] = useState<ProxyRelation>('family');
  const [invAccess, setInvAccess] = useState<ProxyAccess>('view');
  const invite = useMutation({
    mutationFn: () => post<{ code: string; codeExpiresAt: string }>('/api/me/family/invites', { relation: invRelation, access: invAccess }),
    onSuccess: refresh,
  });

  const [form, setForm] = useState({ given: '', family: '', birthDate: '' });
  const [relation, setRelation] = useState<'parent' | 'guardian' | 'caregiver'>('parent');
  const [declaration, setDeclaration] = useState(false);
  const add = useMutation({
    mutationFn: () => post<FamilyProfile>('/api/me/family/dependents', { ...form, relation, declaration }),
    onSuccess: () => {
      setForm({ given: '', family: '', birthDate: '' });
      setDeclaration(false);
      refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/api/me/family/links/${id}`), onSuccess: refresh, onError: (e) => Alert.alert(errorMessage(e, t)) });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><Notice kind="danger">{errorMessage(q.error, t)}</Notice></Screen>;
  const others = q.data.profiles.filter((p) => !p.self);

  return (
    <Screen>
      <P muted>{t('Prowadź profile dzieci i bliskich, zaproś drugiego rodzica albo opiekuna. To, co robisz w czyimś profilu, widać w dzienniku dostępu tej osoby.')}</P>
      <Overview />
      <Card title={t('Profile')}>
        {others.length === 0 ? <Empty title={t('Masz tylko swój profil')} /> : null}
        {others.map((p) => (
          <Row
            key={p.id}
            title={p.name}
            sub={[p.relation ? t(RELATION_LABEL[p.relation]) : '', p.access !== 'self' ? t(ACCESS_LABEL[p.access]) : '', p.lapsed ? t('dostęp wygasł') : ''].filter(Boolean).join(' · ')}
            right={active?.id === p.id ? <Badge kind="ok">{t('aktywny')}</Badge> : undefined}
            onPress={
              p.lapsed
                ? undefined
                : () => {
                    setActiveProfile(p);
                    router.replace('/');
                  }
            }
          />
        ))}
        {active ? <Button title={t('Wróć do swojego profilu')} variant="secondary" onPress={() => (setActiveProfile(undefined), router.replace('/'))} /> : null}
      </Card>

      <Card title={t('Kto ma dostęp do moich danych')}>
        {q.data.access.length === 0 ? <P small muted>{t('Nikt poza Tobą nie ma dostępu.')}</P> : null}
        {q.data.access.map((a) => (
          <Row
            key={a.id}
            title={a.status === 'pending' ? t('Kod czeka na użycie') : (a.name ?? '—')}
            sub={`${t(RELATION_LABEL[a.relation])} · ${a.status === 'active' ? t(ACCESS_LABEL[a.access]) : a.status === 'pending' ? t('oczekuje') : t('wygasło')}`}
            right={a.status !== 'expired' ? <Button title={a.status === 'pending' ? t('Unieważnij') : t('Odbierz dostęp')} variant="ghost" onPress={() => revoke.mutate(a.id)} /> : undefined}
          />
        ))}
        <P small>{t('Zaproś osobę bliską do swojego profilu')}</P>
        <Chips label={t('Kim jest ta osoba?')} value={invRelation} onChange={setInvRelation} options={(['family', 'caregiver'] as const).map((r) => ({ value: r, label: t(RELATION_LABEL[r]) }))} />
        <Chips label={t('Zakres')} value={invAccess} onChange={setInvAccess} options={(['view', 'full'] as const).map((r) => ({ value: r, label: t(ACCESS_LABEL[r]) }))} />
        {invite.data ? (
          <View style={{ gap: space(1) }}>
            <Text selectable accessibilityLabel={t('Kod zaproszenia')} style={{ fontSize: 28, fontWeight: '700', letterSpacing: 3, color: c.ink, textAlign: 'center' }}>
              {invite.data.code}
            </Text>
            <P small muted>{t('Przekaż ten kod osobie, której ufasz. Wpisze go u siebie w zakładce Rodzina.')}</P>
          </View>
        ) : (
          <Button title={t('Utwórz kod zaproszenia')} variant="secondary" loading={invite.isPending} onPress={() => invite.mutate()} />
        )}
        {invite.isError ? <Notice kind="danger">{errorMessage(invite.error, t)}</Notice> : null}
      </Card>

      <Card title={t('Mam kod zaproszenia')}>
        <Field label={t('Kod')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="ABCDE-FGH23" />
        {accept.isError ? <Notice kind="danger">{errorMessage(accept.error, t)}</Notice> : null}
        <Button title={t('Użyj kodu')} loading={accept.isPending} disabled={code.trim().length < 10} onPress={() => accept.mutate()} />
      </Card>

      <Card title={t('Dodaj profil dziecka lub osoby pod opieką')}>
        <Chips
          label={t('Podstawa')}
          value={relation}
          onChange={(v) => (setRelation(v), setDeclaration(false))}
          options={[
            { value: 'parent', label: t('Moje dziecko') },
            { value: 'guardian', label: t('Jestem opiekunem prawnym') },
            { value: 'caregiver', label: t('Mam upoważnienie') },
          ]}
        />
        <Field label={t('Imię')} value={form.given} onChangeText={(v) => setForm({ ...form, given: v })} />
        <Field label={t('Nazwisko')} value={form.family} onChangeText={(v) => setForm({ ...form, family: v })} />
        <Field label={t('Data urodzenia (RRRR-MM-DD)')} value={form.birthDate} onChangeText={(v) => setForm({ ...form, birthDate: v })} placeholder="2019-04-02" keyboardType="numbers-and-punctuation" />
        <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Switch value={declaration} onValueChange={setDeclaration} accessibilityLabel={t(q.data.basis.text[relation])} />
          <View style={{ flex: 1 }}>
            <P small>{t(q.data.basis.text[relation])}</P>
          </View>
        </View>
        {add.isError ? <Notice kind="danger">{errorMessage(add.error, t)}</Notice> : null}
        <Button title={t('Dodaj profil')} loading={add.isPending} disabled={!declaration || !form.given || !form.family || !form.birthDate} onPress={() => add.mutate()} />
      </Card>
    </Screen>
  );
}
