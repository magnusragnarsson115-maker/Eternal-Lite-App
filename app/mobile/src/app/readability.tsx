import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Card, Notice, P, Screen } from '../components/ui';
import { saveA11y, useA11y, type A11yPrefs } from '../lib/a11y';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { radius, space, useColors } from '../lib/theme';

function Choice<T extends string | number>({ value, current, label, onPress }: { value: T; current: T; label: string; onPress: (v: T) => void }) {
  const c = useColors();
  const on = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={() => onPress(value)}
      style={{ paddingHorizontal: space(3), paddingVertical: space(2), minHeight: 44, justifyContent: 'center', borderRadius: radius, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.surface }}
    >
      <Text style={{ color: c.ink, fontWeight: on ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

/** Czytelność (A23.2/A23.3): to samo ustawienie konta co w przeglądarce. Zmiana widoczna od razu. */
export default function ReadabilityScreen() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const { prefs } = useA11y();
  const [error, setError] = useState('');

  const save = (p: A11yPrefs) => {
    setError('');
    saveA11y(p)
      .then(() => refresh())
      .catch((e: unknown) => setError(errorMessage(e, t)));
  };

  return (
    <Screen>
      <Card title={t('Rozmiar tekstu')}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {([100, 125, 150, 200] as const).map((v) => (
            <Choice key={v} value={v} current={prefs.textScale} label={`${v}%`} onPress={(x) => save({ ...prefs, textScale: x })} />
          ))}
        </View>
        <P small muted>
          {t('Działa razem z rozmiarem czcionki ustawionym w telefonie.')}
        </P>
      </Card>
      <Card title={t('Kontrast')}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Choice value="system" current={prefs.contrast} label={t('Jak w systemie')} onPress={(x) => save({ ...prefs, contrast: x })} />
          <Choice value="high" current={prefs.contrast} label={t('Wysoki')} onPress={(x) => save({ ...prefs, contrast: x })} />
          <Choice value="standard" current={prefs.contrast} label={t('Standardowy')} onPress={(x) => save({ ...prefs, contrast: x })} />
        </View>
      </Card>
      <Card title={t('Prosty język')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <View style={{ flex: 1 }}>
            <P>{t('Krótsze zdania w najważniejszych opisach.')}</P>
          </View>
          <Switch value={prefs.simpleLanguage} onValueChange={(v) => save({ ...prefs, simpleLanguage: v })} accessibilityLabel={t('Prosty język')} />
        </View>
      </Card>
      {error ? <Notice kind="danger">{error}</Notice> : null}
      <P small muted>
        {t('Ustawienie zapisujemy na Twoim koncie — działa też w przeglądarce.')}
      </P>
    </Screen>
  );
}
