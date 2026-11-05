import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, H1, Notice, P } from '../components/ui';
import { API_URL } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { space, useColors } from '../lib/theme';

/** Logowanie pacjenta (F1.1, F1.7): e-mail i hasło, potem kod TOTP, jeśli włączony. Token trafia do schowka systemu. */
export default function LoginScreen() {
  const { phase, login, verifyMfa, logout } = useSession();
  const { t } = useI18n();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: space(5), gap: space(4) }}>
        <View style={{ gap: space(1) }}>
          <Text style={{ color: c.primary, fontSize: 30, fontWeight: '800' }}>eternal</Text>
          <H1>{phase === 'mfa' ? t('Potwierdź logowanie') : t('Zaloguj się')}</H1>
        </View>
        {error ? <Notice kind="danger">{error}</Notice> : null}
        {phase === 'mfa' ? (
          <Card>
            <P>{t('Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.')}</P>
            <Field label={t('Kod z aplikacji')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Button title={t('Potwierdź')} loading={busy} disabled={code.length !== 6} onPress={() => void run(() => verifyMfa(code))} />
            <Button title={t('Anuluj')} variant="ghost" onPress={() => void logout()} />
          </Card>
        ) : (
          <Card>
            <Field label={t('E-mail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
            <Field label={t('Hasło')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
            <Button title={t('Zaloguj się')} loading={busy} disabled={!email || !password} onPress={() => void run(() => login(email.trim(), password))} />
            <Button title={t('Nie mam konta / nie pamiętam hasła')} variant="ghost" onPress={() => void Linking.openURL(`${API_URL}/logowanie`)} />
          </Card>
        )}
        <Link href="/crisis" asChild>
          <Text accessibilityRole="link" style={{ color: c.danger, textAlign: 'center', fontSize: 16, fontWeight: '600', padding: space(2) }}>
            {t('Numery pomocowe: 112 · 116 123')}
          </Text>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
