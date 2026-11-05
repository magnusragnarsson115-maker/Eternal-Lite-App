/**
 * Kopia danych na wypadek braku internetu (A5.12). W przeglądarce zapisywana tylko na wyraźne życzenie pacjenta,
 * na tym jednym urządzeniu; usuwana przy wylogowaniu. Dostęp do pamięci przeglądarki może być zablokowany
 * (tryb prywatny) — wtedy kopii po prostu nie ma.
 */

export interface OfflinePack {
  version: string;
  generatedAt: string;
  refreshAfter: string;
  card: { name: string; birthDate?: string; notes: string; medications: string[]; contacts: { name: string; phone: string; relation?: string }[]; directives: string[]; disclaimer: string };
  medications: { name: string; dosage?: string }[];
  reminders: { label: string; times: string[]; days: number[] }[];
  appointments: { start: string; end?: string; service?: string; practitioner?: string; place?: string; tele: boolean }[];
  clinic: { name: string; phone?: string; address?: string };
}

interface Stored {
  userId: string;
  /** Profil, dla którego zrobiono kopię (opiekun może trzymać kopię osoby pod opieką). */
  label?: string;
  savedAt: string;
  pack: OfflinePack;
}

const KEY = 'eternal.offline.v1';

export function readOffline(): Stored | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : undefined;
  } catch {
    return undefined;
  }
}

export function saveOffline(userId: string, pack: OfflinePack, label?: string): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, label, savedAt: new Date().toISOString(), pack } satisfies Stored));
    return true;
  } catch {
    return false;
  }
}

export function clearOffline(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* brak dostępu do pamięci przeglądarki */
  }
}

/** Kopia starsza niż pół doby — odświeżamy po cichu, gdy aplikacja ma połączenie. */
export function offlineStale(s: Stored, now = Date.now()): boolean {
  return now - Date.parse(s.savedAt) > 12 * 3600_000;
}
