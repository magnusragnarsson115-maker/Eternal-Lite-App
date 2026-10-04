import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

/** Parametry scrypt zgodne z zaleceniami OWASP (N=2^17, r=8, p=1). */
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return crypto.timingSafeEqual(key, expected);
}

/** Hash używany do porównań w stałym czasie, gdy konto nie istnieje (ochrona przed enumeracją). */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

const COMMON = new Set([
  'password', 'password1', 'qwerty', 'qwertyuiop', '1234567890', '123456789', 'zaq12wsx', 'haslo123', 'haslo1234',
  'polska123', 'kochamcie', 'qwerty123', 'iloveyou', 'admin123', 'eternal123',
]);

export function passwordProblems(password: string, minLength: number, context: string[] = []): string[] {
  const problems: string[] = [];
  if (password.length < minLength) problems.push('too_short');
  if (password.length > 256) problems.push('too_long');
  if (COMMON.has(password.toLowerCase())) problems.push('too_common');
  if (/^(.)\1+$/.test(password)) problems.push('repetitive');
  const lower = password.toLowerCase();
  if (context.some((c) => c && c.length >= 4 && lower.includes(c.toLowerCase()))) problems.push('contains_personal_data');
  return problems;
}
