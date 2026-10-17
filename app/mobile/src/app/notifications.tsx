import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Field, Loading, Notice, P, Screen } from '../components/ui';
import { get, put } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';

interface Prefs {
  disabled: string[];
  quiet: { enabled: boolean; from: string; to: string };
}

const KIND_LABEL: Record<string, string> = {
  'appointment-reminder': 'Przypomnienia o wizytach',
  'docs-request': 'Prośby placówki o dokumenty',
  'after-visit-card': 'Karta „Po wizycie”',
  'record-shared': 'Nowe wyniki i dokumenty od placówki',
  message: 'Wiadomości',
  'med-reminder': 'Przypomnienia o lekach',
  'med-stock': 'Kończący się zapas leku',
  'custom-reminder': 'Moje przypomnienia (np. światło, ćwiczenia)',
  preventive: 'Badania profilaktyczne NFZ',
  'morning-summary': 'Poranne podsumowanie dnia',
  'air-alert': 'Jakość powietrza w mojej okolicy (GIOŚ)',
  'lab-flags': 'Oznaczenia laboratorium w moich dokumentach',
};

/** Powiadomienia (P8): które rodzaje i godziny ciszy. Treść powiadomień nie zawiera danych o zdrowiu. */
export default function NotificationsScreen() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['notify-prefs'], queryFn: () => get<{ prefs: Prefs; kinds: string[] }>('/api/me/notification-prefs') });
  const [p, setP] = useState<Prefs | null>(null);
  useEffect(() => {
    if (q.data && !p) setP(q.data.prefs);
  }, [q.data, p]);
  const save = useMutation({ mutationFn: (v: Prefs) => put<{ prefs: Prefs }>('/api/me/notification-prefs', v), onSuccess: (r) => setP(r.prefs) });
  if (!p || !q.data) return <Screen>{<Loading />}</Screen>;
  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <P>{label}</P>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
  return (
    <Screen>
      <Card title={t('Rodzaje powiadomień')}>
        {q.data.kinds.map((k) => row(t(KIND_LABEL[k] ?? k), !p.disabled.includes(k), (on) => setP({ ...p, disabled: on ? p.disabled.filter((x) => x !== k) : [...p.disabled, k] })))}
      </Card>
      <Card title={t('Godziny ciszy')}>
        {row(t('Nie wysyłaj powiadomień w godzinach ciszy'), p.quiet.enabled, (on) => setP({ ...p, quiet: { ...p.quiet, enabled: on } }))}
        <Field label={t('Od (GG:MM)')} value={p.quiet.from} onChangeText={(v) => setP({ ...p, quiet: { ...p.quiet, from: v } })} maxLength={5} />
        <Field label={t('Do (GG:MM)')} value={p.quiet.to} onChangeText={(v) => setP({ ...p, quiet: { ...p.quiet, to: v } })} maxLength={5} />
        <P small muted>
          {t('Powiadomienia z godzin ciszy przyjdą po ich zakończeniu. Kanały: najpierw push, potem e-mail, na końcu SMS.')}
        </P>
      </Card>
      {save.isError ? <Notice kind="danger">{errorMessage(save.error, t)}</Notice> : null}
      {save.isSuccess ? <Notice kind="ok">{t('Zapisano.')}</Notice> : null}
      <Button title={t('Zapisz')} loading={save.isPending} onPress={() => save.mutate(p)} />
    </Screen>
  );
}
