import { z } from 'zod';
import { getDb } from '../db.js';
import { nowIso } from '../lib/util.js';

/**
 * Ustawienia czytelności konta (A23.2 tryb prostego języka, A23.3 duży kontrast i skalowanie).
 * Zapisane na koncie, więc działają tak samo w przeglądarce i w aplikacji mobilnej, na każdym urządzeniu.
 * Nie są danymi o zdrowiu.
 */

export const A11ySchema = z.object({
  textScale: z.union([z.literal(100), z.literal(125), z.literal(150), z.literal(200)]),
  /** system — według ustawienia systemu (prefers-contrast / „Zwiększ kontrast”); high — zawsze wysoki. */
  contrast: z.enum(['system', 'high', 'standard']),
  simpleLanguage: z.boolean(),
});

export type A11yPrefs = z.infer<typeof A11ySchema>;

export const DEFAULT_A11Y: A11yPrefs = { textScale: 100, contrast: 'system', simpleLanguage: false };

export function getA11yPrefs(userId: string): A11yPrefs {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'a11y'").get(userId) as { value: string } | undefined;
  if (!row) return DEFAULT_A11Y;
  const parsed = A11ySchema.partial().safeParse(JSON.parse(row.value));
  return { ...DEFAULT_A11Y, ...(parsed.success ? parsed.data : {}) };
}

export function setA11yPrefs(userId: string, prefs: A11yPrefs): A11yPrefs {
  const clean = A11ySchema.parse(prefs);
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'a11y', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(clean), nowIso());
  return clean;
}
