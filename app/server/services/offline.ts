import { audit, type AuditActor } from '../audit.js';
import { getClinicSettings } from './directory.js';
import { listMedications } from './medications.js';
import { listSchedules } from './medReminders.js';
import { emergencyCard } from './safety.js';
import { listPatientAppointments } from './scheduling.js';

/**
 * Kopia na wypadek braku internetu (A5.12, A24.6, S4.4): karta ratunkowa, leki z godzinami przypomnień,
 * najbliższe wizyty i kontakt do placówki — w jednym pakiecie, który aplikacja zapisuje na urządzeniu tylko na
 * wyraźne życzenie pacjenta (przeglądarka) albo w prywatnym katalogu aplikacji (telefon) i usuwa przy wylogowaniu.
 * Numery alarmowe aplikacja ma wbudowane — działają zawsze, także bez kopii.
 */

export const OFFLINE_PACK_VERSION = 'offline/2026-10-1';
const APPT_DAYS = 60;
const VALID_DAYS = 30;

export interface OfflinePack {
  version: string;
  generatedAt: string;
  /** Po tej dacie aplikacja prosi o odświeżenie kopii (leki i wizyty mogły się zmienić). */
  refreshAfter: string;
  card: Awaited<ReturnType<typeof emergencyCard>>;
  medications: { name: string; dosage?: string }[];
  reminders: { label: string; times: string[]; days: number[] }[];
  appointments: { start: string; end?: string; service?: string; practitioner?: string; place?: string; tele: boolean }[];
  clinic: { name: string; phone?: string; address?: string };
}

export async function offlinePack(actor: AuditActor, patientRef: string, now: Date = new Date()): Promise<OfflinePack> {
  const until = new Date(now.getTime() + APPT_DAYS * 86_400_000).toISOString();
  const appointments = (await listPatientAppointments(patientRef))
    .filter((a) => ['booked', 'pending', 'arrived', 'checked-in'].includes(a.status) && a.start >= now.toISOString() && a.start <= until)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 10)
    .map((a) => ({ start: a.start, end: a.end, service: a.serviceName, practitioner: a.practitionerName, place: a.mode === 'tele' ? undefined : a.locationName, tele: a.mode === 'tele' }));
  const s = getClinicSettings();
  const pack: OfflinePack = {
    version: OFFLINE_PACK_VERSION,
    generatedAt: now.toISOString(),
    refreshAfter: new Date(now.getTime() + VALID_DAYS * 86_400_000).toISOString(),
    card: await emergencyCard(patientRef),
    medications: (await listMedications(patientRef)).map((m) => ({ name: m.name, dosage: m.dosage })),
    reminders: listSchedules(patientRef)
      .filter((r) => r.active)
      .map((r) => ({ label: r.label, times: r.times, days: r.days })),
    appointments,
    clinic: { name: s.name, phone: s.phone || undefined, address: s.address || undefined },
  };
  audit(actor, { action: 'R', subtype: 'offline-pack', patientRef });
  return pack;
}
