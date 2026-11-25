import { File, Paths } from 'expo-file-system';

/**
 * Kopia na wypadek braku internetu (A5.12, A24.6, S4.4) w prywatnym katalogu aplikacji — tylko po decyzji
 * pacjenta, usuwana przy wylogowaniu (session.tsx). Numery alarmowe aplikacja ma wbudowane niezależnie od kopii.
 */

export interface OfflinePack {
  version: string;
  generatedAt: string;
  refreshAfter: string;
  card: { name: string; birthDate?: string; notes: string; medications: string[]; contacts: { name: string; phone: string; relation?: string }[]; directives: string[]; disclaimer: string };
  medications: { name: string; dosage?: string }[];
  reminders: { label: string; times: string[]; days: number[] }[];
  appointments: { start: string; service?: string; practitioner?: string; place?: string; tele: boolean }[];
  clinic: { name: string; phone?: string; address?: string };
}

export interface StoredOffline {
  userId: string;
  savedAt: string;
  pack: OfflinePack;
}

const file = () => new File(Paths.document, 'eternal-offline.json');

export function readOffline(): StoredOffline | undefined {
  try {
    const f = file();
    return f.exists ? (JSON.parse(f.textSync()) as StoredOffline) : undefined;
  } catch {
    return undefined;
  }
}

export function saveOffline(userId: string, pack: OfflinePack): void {
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify({ userId, savedAt: new Date().toISOString(), pack } satisfies StoredOffline));
}

export function clearOffline(): void {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // brak pliku — nic do usunięcia
  }
}
