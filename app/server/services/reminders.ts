import type { Appointment, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { formatLocal } from '../lib/time.js';
import { conflict, nowIso } from '../lib/util.js';
import { getClinicSettings } from './directory.js';
import { messagePatientExternally, notifyPatient } from './notifications.js';
import { toPatientView } from './patients.js';
import { teleRoomOf } from './scheduling.js';

/**
 * Przypomnienia o wizytach: domyślnie 24 h i 2 h przed wizytą (konfigurowalne).
 * W aplikacji zawsze; e-mail/SMS/push wyłącznie za zgodą pacjenta na dany kanał.
 * Treść nie zawiera nazwy usługi ani lekarza (może ujawniać stan zdrowia).
 */

export interface ReminderRecord {
  appointment_id: string;
  kind: string;
  channels: string;
  status: string;
  created_at: string;
}

function reminderText(appt: Appointment) {
  const s = getClinicSettings();
  const when = formatLocal(appt.start ?? '', config.clinic.timezone);
  const deadline = new Date(Date.parse(appt.start ?? '') - s.cancelMinHours * 3_600_000);
  const tele = !!teleRoomOf(appt);
  const canStillCancel = deadline.getTime() > Date.now();
  const body = [
    `${tele ? 'Teleporada' : 'Wizyta'}: ${when}${s.name ? ` — ${s.name}` : ''}.`,
    tele ? 'Link do połączenia znajdziesz w aplikacji.' : s.address ? `Adres: ${s.address}.` : '',
    canStillCancel
      ? `Odwołanie w aplikacji do ${formatLocal(deadline.toISOString(), config.clinic.timezone)}${s.phone ? ` lub tel. ${s.phone}` : ''}.`
      : s.phone
        ? `Jeśli nie możesz przyjść, zadzwoń: ${s.phone}.`
        : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { title: 'Przypomnienie o wizycie', body };
}

async function sendReminder(appt: Appointment, kind: string): Promise<string[]> {
  const patientRef = appt.participant.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
  if (!patientRef) return [];
  const patient = await fhir().readOptional<Patient>('Patient', idFromRef(patientRef));
  if (!patient) return [];
  const pv = toPatientView(patient);
  const { title, body } = reminderText(appt);
  await notifyPatient(patientRef, { kind: 'reminder', title, body, link: `/wizyty/${appt.id}` });
  const external = await messagePatientExternally(
    patientRef,
    { email: pv.email, phone: pv.phone },
    { subject: title, body, relatedRef: `/wizyty/${appt.id}`, dedupeKey: `reminder:${appt.id}:${kind}` },
  );
  return ['app', ...external];
}

/** Uruchamiane cyklicznie (co minutę). Idempotentne dzięki tabeli reminder_sent. */
export async function runReminderSweep(now = new Date()): Promise<number> {
  const offsets = [...getClinicSettings().reminderOffsetsHours].sort((a, b) => b - a);
  if (offsets.length === 0) return 0;
  const db = getDb();
  const horizon = new Date(now.getTime() + offsets[0] * 3_600_000);
  const appts = await fhir().search<Appointment>('Appointment', {
    status: 'booked',
    date: [`gt${now.toISOString()}`, `le${horizon.toISOString()}`],
  });
  let sent = 0;
  for (const appt of appts) {
    const start = Date.parse(appt.start ?? '');
    const created = Date.parse(appt.created ?? appt.meta?.lastUpdated ?? '') || 0;
    for (const h of offsets) {
      const point = start - h * 3_600_000;
      if (now.getTime() < point) continue; // jeszcze nie pora
      const kind = `${h}h`;
      const exists = db.prepare('SELECT 1 FROM reminder_sent WHERE appointment_id = ? AND kind = ?').get(appt.id ?? '', kind);
      if (exists) continue;
      // wizyta zarezerwowana już po punkcie przypomnienia — pomijamy (pacjent właśnie rezerwował)
      if (created > point) {
        db.prepare('INSERT OR IGNORE INTO reminder_sent (appointment_id, kind, channels, status, created_at) VALUES (?, ?, ?, ?, ?)').run(appt.id ?? '', kind, '', 'skipped-late-booking', nowIso());
        continue;
      }
      // pomiń przypomnienie dłuższe, jeśli krótsze też już przypada (np. serwer był wyłączony)
      const shorterDue = offsets.some((o) => o < h && now.getTime() >= start - o * 3_600_000);
      const res = db
        .prepare('INSERT OR IGNORE INTO reminder_sent (appointment_id, kind, channels, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(appt.id ?? '', kind, '', shorterDue ? 'skipped-superseded' : 'sending', nowIso());
      if (res.changes === 0 || shorterDue) continue;
      const channels = await sendReminder(appt, kind);
      db.prepare("UPDATE reminder_sent SET channels = ?, status = 'sent' WHERE appointment_id = ? AND kind = ?").run(channels.join(','), appt.id ?? '', kind);
      audit({ display: 'system' }, { action: 'E', subtype: 'reminder-sent', entityRef: `Appointment/${appt.id}`, patientRef: appt.participant.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference, detail: { kind, channels } });
      bus.publish({ type: 'appointment.changed', resourceRef: `Appointment/${appt.id}`, staff: true });
      sent++;
    }
  }
  return sent;
}

/** Przypomnienie wysłane ręcznie z panelu placówki. */
export async function sendManualReminder(actor: AuditActor, appointmentId: string): Promise<string[]> {
  const appt = await fhir().read<Appointment>('Appointment', appointmentId);
  if (appt.status !== 'booked' || Date.parse(appt.start ?? '') < Date.now()) throw conflict('not_remindable');
  const recent = getDb()
    .prepare("SELECT created_at FROM reminder_sent WHERE appointment_id = ? AND kind LIKE 'manual-%' ORDER BY created_at DESC LIMIT 1")
    .get(appointmentId) as { created_at: string } | undefined;
  if (recent && Date.now() - Date.parse(recent.created_at) < 10 * 60_000) throw conflict('reminder_recently_sent');
  const kind = `manual-${Date.now()}`;
  const channels = await sendReminder(appt, kind);
  getDb()
    .prepare('INSERT INTO reminder_sent (appointment_id, kind, channels, status, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(appointmentId, kind, channels.join(','), 'sent', nowIso());
  const patientRef = appt.participant.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
  audit(actor, { action: 'E', subtype: 'reminder-manual', entityRef: `Appointment/${appointmentId}`, patientRef, detail: { channels } });
  bus.publish({ type: 'appointment.changed', patientRef, resourceRef: `Appointment/${appointmentId}` });
  return channels;
}

export function remindersFor(appointmentId: string): ReminderRecord[] {
  return getDb().prepare('SELECT * FROM reminder_sent WHERE appointment_id = ? ORDER BY created_at').all(appointmentId) as unknown as ReminderRecord[];
}
