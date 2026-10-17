import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Field, Notice, P, Screen } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { space } from '../lib/theme';

/** Pierwsze uruchomienie po zalogowaniu: PIN zapasowy (F1.5) i odblokowanie biometrią (F1.2). */
export default function PinSetupScreen() {
  const { finishPinSetup } = useSession();
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bio, setBio] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))();
  }, []);

  const valid = /^\d{6}$/.test(pin) && pin === again;
  const weak = /^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
  return (
    <Screen>
      <P>{t('Ustal 6-cyfrowy PIN. Będzie potrzebny, gdy biometria nie zadziała. Po 5 błędnych próbach trzeba zalogować się hasłem.')}</P>
      <Card>
        <Field label={t('PIN (6 cyfr)')} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Field label={t('Powtórz PIN')} value={again} onChangeText={(v) => setAgain(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} secureTextEntry error={again.length === 6 && pin !== again ? t('PIN-y się różnią.') : undefined} />
        {pin.length === 6 && weak ? <Notice kind="warn">{t('Ten PIN łatwo odgadnąć. Wybierz inny.')}</Notice> : null}
      </Card>
      {bioAvailable ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <P>{t('Odblokowuj odciskiem palca lub twarzą')}</P>
            </View>
            <Switch accessibilityLabel={t('Odblokowuj odciskiem palca lub twarzą')} value={bio} onValueChange={setBio} />
          </View>
          <P small muted>
            {t('Dane biometryczne zostają w telefonie — aplikacja dostaje tylko informację „rozpoznano” albo „nie rozpoznano”.')}
          </P>
        </Card>
      ) : null}
      <Button
        title={t('Zapisz i przejdź dalej')}
        disabled={!valid || weak}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void finishPinSetup(pin, bioAvailable && bio).finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}
