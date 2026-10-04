import crypto from 'node:crypto';
import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';

/**
 * Have I Been Pwned — Pwned Passwords (bezpłatne, bez klucza), model k-anonimowości:
 * do usługi trafia wyłącznie 5 pierwszych znaków skrótu SHA-1 hasła, nigdy hasło ani pełny skrót.
 * Niedostępność usługi nie blokuje rejestracji (fail-open), zdarzenie jest raportowane.
 */
export async function pwnedCount(password: string): Promise<{ count: number; checked: boolean }> {
  if (!config.publicApis.hibp) return { count: 0, checked: false };
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetchWithTimeout(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' } }, 4000);
    if (!res.ok) return { count: 0, checked: false };
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [s, c] = line.trim().split(':');
      if (s === suffix) return { count: Number(c) || 0, checked: true };
    }
    return { count: 0, checked: true };
  } catch {
    return { count: 0, checked: false };
  }
}
