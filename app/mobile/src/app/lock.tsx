import * as LocalAuthentication from 'expo-local-authentication';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, H1, Notice } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { biometricsEnabled, checkPin } from '../lib/secure';
import { useSession } from '../lib/session';
import { space, useColors } from '../lib/theme';

/** Ekran blokady: biometria (F1.2), w zapasie PIN (F1.5); limit prób usuwa sesję z urządzenia. */
export default function LockScreen() {
  const { unlock, logout, me } = useSession();
  const { t } = useI18n();
  const c = useColors();
  const [pin, setPin] = useState('');
  const [bio, setBio] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);

  const tryBiometrics = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('Odblokuj Eternal'), cancelLabel: t('Użyj PIN-u'), disableDeviceFallback: true });
    if (res.success) unlock();
  }, [t, unlock]);

  useEffect(() => {
    void biometricsEnabled().then((on) => {
      setBio(on);
      if (on) void tryBiometrics();
    });
  }, [tryBiometrics]);

  const submit = async (value: string) => {
    setBusy(true);
    const r = await checkPin(value);
    setBusy(false);
    setPin('');
    if (r.result === 'ok') return unlock();
    if (r.result === 'wiped') {
      await logout();
      return;
    }
    setMsg(t('Nieprawidłowy PIN. Pozostało prób: {n}.', { n: r.left }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space(5), gap: space(4) }}>
        <H1>{t('Aplikacja zablokowana')}</H1>
        {me?.user ? <Text style={{ color: c.muted, fontSize: 16 }}>{me.user.displayName}</Text> : null}
        {msg ? <Notice kind="warn">{msg}</Notice> : null}
        <Card>
          <Field
            label={t('PIN (6 cyfr)')}
            value={pin}
            onChangeText={(v) => {
              const d = v.replace(/\D/g, '').slice(0, 6);
              setPin(d);
              if (d.length === 6) void submit(d);
            }}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            editable={!busy}
          />
          {bio ? <Button title={t('Odblokuj biometrią')} variant="secondary" onPress={() => void tryBiometrics()} /> : null}
          <Button title={t('Wyloguj i zaloguj hasłem')} variant="ghost" onPress={() => void logout()} />
        </Card>
        <Link href="/crisis" asChild>
          <Text accessibilityRole="link" style={{ color: c.danger, textAlign: 'center', fontSize: 16, fontWeight: '600', padding: space(2) }}>
            {t('Numery pomocowe: 112 · 116 123')}
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
