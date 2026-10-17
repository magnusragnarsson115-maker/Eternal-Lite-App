import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Sekrety w schowku systemu (F1.18): iOS Keychain (Secure Enclave chroni klucze), Android Keystore.
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY — nie trafiają do kopii zapasowej ani na inne urządzenie.
 * Nic z danych medycznych nie jest zapisywane na telefonie — tylko token sesji i ustawienia blokady.
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const KEY = {
  token: 'eternal.session.token',
  pin: 'eternal.lock.pin',
  biometrics: 'eternal.lock.biometrics',
  failures: 'eternal.lock.failures',
  locale: 'eternal.locale',
} as const;

export const MAX_PIN_FAILURES = 5;

export const getToken = () => SecureStore.getItemAsync(KEY.token, OPTS);
export const setToken = (t: string) => SecureStore.setItemAsync(KEY.token, t, OPTS);

export async function getLocale(): Promise<'pl' | 'en' | null> {
  const v = await SecureStore.getItemAsync(KEY.locale, OPTS);
  return v === 'pl' || v === 'en' ? v : null;
}
export const setLocale = (l: 'pl' | 'en') => SecureStore.setItemAsync(KEY.locale, l, OPTS);

/** Wylogowanie albo przekroczenie prób PIN: usuwamy token i ustawienia blokady z tego urządzenia. */
export async function wipe(): Promise<void> {
  await Promise.all([KEY.token, KEY.pin, KEY.biometrics, KEY.failures].map((k) => SecureStore.deleteItemAsync(k, OPTS)));
}

// --- PIN zapasowy (F1.5) -----------------------------------------------------------------------------
// PIN ma 6 cyfr, więc sam skrót nie chroni przed próbą wszystkich wartości — ochroną jest schowek systemu
// (skrót nie opuszcza Keychain/Keystore) i limit prób: po 5 błędach token jest usuwany i trzeba zalogować się hasłem.

async function hash(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < 2000; i += 1) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h);
  return h;
}

export async function hasPin(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(KEY.pin, OPTS));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) throw new Error('pin_format');
  const salt = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY.pin, `${salt}$${await hash(pin, salt)}`, OPTS);
  await SecureStore.deleteItemAsync(KEY.failures, OPTS);
}

/** 'ok' | 'wrong' (z liczbą pozostałych prób) | 'wiped' (limit przekroczony — sesja usunięta). */
export async function checkPin(pin: string): Promise<{ result: 'ok' } | { result: 'wrong'; left: number } | { result: 'wiped' }> {
  const stored = await SecureStore.getItemAsync(KEY.pin, OPTS);
  if (!stored) return { result: 'wiped' };
  const [salt, expected] = stored.split('$');
  if ((await hash(pin, salt)) === expected) {
    await SecureStore.deleteItemAsync(KEY.failures, OPTS);
    return { result: 'ok' };
  }
  const failures = Number((await SecureStore.getItemAsync(KEY.failures, OPTS)) ?? '0') + 1;
  if (failures >= MAX_PIN_FAILURES) {
    await wipe();
    return { result: 'wiped' };
  }
  await SecureStore.setItemAsync(KEY.failures, String(failures), OPTS);
  return { result: 'wrong', left: MAX_PIN_FAILURES - failures };
}

export async function biometricsEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY.biometrics, OPTS)) === '1';
}
export const setBiometrics = (on: boolean) => (on ? SecureStore.setItemAsync(KEY.biometrics, '1', OPTS) : SecureStore.deleteItemAsync(KEY.biometrics, OPTS));
