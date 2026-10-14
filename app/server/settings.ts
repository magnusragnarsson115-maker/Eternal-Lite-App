import { getDb } from './db.js';
import { nowIso } from './lib/util.js';

export function getSetting<T>(key: string): T | undefined {
  const row = getDb().prepare('SELECT value FROM setting WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setSetting(key: string, value: unknown): void {
  getDb()
    .prepare('INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(key, JSON.stringify(value), nowIso());
}

export interface ClinicSettings {
  organizationId?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  cancelMinHours: number;
  reminderOffsetsHours: number[];
  emergencyInfo: string;
  messageResponseDays: number;
  privacyContact: string;
  /** R10 — konfiguracja kliniki (MVP-1): specjalizacje, wymagane dokumenty, szablony notatek, limity. */
  specialties: string[];
  requiredDocuments: RequiredDocument[];
  noteTemplates: string[];
  /** Układ pól „Kopiuj do systemu gabinetowego”. */
  ehrLayout: 'generic' | 'soap';
  /** Limit wizyt Scribe na lekarza w miesiącu (licencja; plik 12.8 A8 — 300). */
  scribeMonthlyLimitPerDoctor: number;
  /** Ważność linku i udostępnienia: do wizyty + N dni [ZAŁ. 30]. */
  inviteValidityDaysAfterVisit: number;
  /** Usunięcie nagrania N dni po zatwierdzeniu notatki [ZAŁ. 30]. */
  recordingRetentionDays: number;
  /** Automatyczne przypomnienie o brakujących dokumentach N godzin przed wizytą (0 = wyłączone). */
  autoRemindMissingHours: number;
  /** Pomiar pilotażu (D12): tydzień bez Eternal i tydzień z Eternal. */
  pilot: { baselineWeekStart?: string; eternalWeekStart?: string; surveyEveryDays: number };
}

export type DocumentKind = 'lab' | 'discharge' | 'imaging' | 'referral' | 'prescription' | 'certificate' | 'other';

export interface RequiredDocument {
  id: string;
  label: string;
  /** Rodzaje dokumentów, które spełniają wymóg. */
  accept: DocumentKind[];
  /** Dokument nie starszy niż N dni (data pobrania/wystawienia). */
  maxAgeDays?: number;
  /** Tylko dla wizyt tych specjalizacji (puste = wszystkie). */
  specialties?: string[];
  optional?: boolean;
}

export function cacheGet<T>(key: string): T | undefined {
  const row = getDb().prepare('SELECT value, expires_at FROM cache_entry WHERE key = ?').get(key) as
    | { value: string; expires_at: string }
    | undefined;
  if (!row || row.expires_at < nowIso()) return undefined;
  return JSON.parse(row.value) as T;
}

export function cacheSet(key: string, value: unknown, ttlSeconds: number): void {
  getDb()
    .prepare('INSERT INTO cache_entry (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at')
    .run(key, JSON.stringify(value), new Date(Date.now() + ttlSeconds * 1000).toISOString());
}
