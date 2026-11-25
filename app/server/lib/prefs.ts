import { getDb } from '../db.js';
import { nowIso } from './util.js';

/** Ustawienia użytkownika (tabela user_pref, klucz → JSON). */
export function readPref<T>(userId: string, key: string): T | undefined {
  const row = getDb().prepare('SELECT value FROM user_pref WHERE user_id = ? AND key = ?').get(userId, key) as { value: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

export function writePref(userId: string, key: string, value: unknown): void {
  getDb()
    .prepare('INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(userId, key, JSON.stringify(value), nowIso());
}
