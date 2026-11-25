import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { Button, Card, Field, Notice, P, Screen } from '../components/ui';
import { API_URL } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { biometricsEnabled, checkPin, setBiometrics, setPin } from '../lib/secure';
import { useSession } from '../lib/session';
import { space } from '../lib/theme';

/** Bezpieczeństwo konta: biometria, zmiana PIN-u; TOTP, klucze dostępu i kody odzyskiwania — w przeglądarce (F1.4, F1.7). */
export default function SecurityScreen() {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bio, setBio] = useState(false);
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'danger'; text: string }>();

  useEffect(() => {
    void (async () => {
      setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      setBio(await biometricsEnabled());
    })();
  }, []);

  const toggleBio = async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: t('Potwierdź włączenie biometrii'), disableDeviceFallback: true, cancelLabel: t('Anuluj') });
      if (!r.success) return;
    }
    await setBiometrics(on);
    setBio(on);
  };

  const changePin = async () => {
    const r = await checkPin(f.current);
    if (r.result === 'wiped') return logout();
    if (r.result === 'wrong') return setMsg({ kind: 'danger', text: t('Nieprawidłowy PIN. Pozostało prób: {n}.', { n: r.left }) });
    await setPin(f.next);
    setF({ current: '', next: '', again: '' });
    setMsg({ kind: 'ok', text: t('PIN zmieniony.') });
  };

  const m = me?.mfa?.methods;
  return (
    <Screen>
      {bioAvailable ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <P>{t('Odblokowuj odciskiem palca lub twarzą')}</P>
            </View>
            <Switch accessibilityLabel={t('Odblokowuj odciskiem palca lub twarzą')} value={bio} onValueChange={(v) => void toggleBio(v)} />
          </View>
        </Card>
      ) : null}
      <Card title={t('Zmień PIN')}>
        <Field label={t('Obecny PIN')} value={f.current} onChangeText={(v) => setF({ ...f, current: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Field label={t('Nowy PIN (6 cyfr)')} value={f.next} onChangeText={(v) => setF({ ...f, next: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Field label={t('Powtórz PIN')} value={f.again} onChangeText={(v) => setF({ ...f, again: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} secureTextEntry />
        {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
        <Button title={t('Zmień PIN')} disabled={f.current.length !== 6 || f.next.length !== 6 || f.next !== f.again} onPress={() => void changePin()} />
      </Card>
      <Card title={t('Logowanie dwuskładnikowe')}>
        <P>{m?.totp ? t('Kod z aplikacji uwierzytelniającej: włączony') : t('Kod z aplikacji uwierzytelniającej: wyłączony')}</P>
        <P>{t('Klucze dostępu: {n}', { n: m?.keys ?? 0 })}</P>
        <P>{t('Pozostałe kody odzyskiwania: {n}', { n: m?.recoveryCodes ?? 0 })}</P>
        <Button title={t('Zarządzaj w przeglądarce')} variant="secondary" onPress={() => void Linking.openURL(`${API_URL}/profil`)} />
      </Card>
    </Screen>
  );
}
