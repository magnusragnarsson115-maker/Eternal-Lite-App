import type { MedicationStatement } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { zonedToUtc } from '../lib/time.js';
import { badRequest, newId, notFound, nowIso } from '../lib/util.js';
import { notifyPatient } from './notifications.js';

/**
 * Przypomnienia o lekach (Specyfikacja 10, D7 MVP-1): harmonogram z listy leków pacjenta i godzin, które
 * ustawia pacjent (albo lekarz w porozumieniu z pacjentem), potwierdzenie przyjęcia. Aplikacja nie ustala dawek
 * ani nie sprawdza interakcji. Treść push bez nazwy leku (ekran blokady).
 */

export interface MedSchedule {
  id: string;
  medicationId?: string;
  label: string;
  times: string[];
  days: number[];
  active: boolean;
  createdBy: 'patient' | 'clinic';
}

interface ScheduleRow {
  id: string;
  patient_ref: string;
  medication_ref: string | null;
  label: string;
  times: string;
  days: string;
  active: number;
  created_by: string | null;
  created_at: string;
}

function toView(r: ScheduleRow): MedSchedule {
  return {
    id: r.id,
    medicationId: r.medication_ref?.split('/')[1],
    label: r.label,
    times: JSON.parse(r.times) as string[],
    days: JSON.parse(r.days) as number[],
    active: !!r.active,
    createdBy: r.created_by === 'clinic' ? 'clinic' : 'patient',
  };
}

export function listSchedules(patientRef: string): MedSchedule[] {
  return (getDb().prepare('SELECT * FROM med_schedule WHERE patient_ref = ? ORDER BY created_at').all(patientRef) as unknown as ScheduleRow[]).map(toView);
}

export async function createSchedule(
  actor: AuditActor,
  patientRef: string,
  input: { medicationId?: string; label?: string; times: string[]; days?: number[] },
  by: 'patient' | 'clinic',
): Promise<MedSchedule[]> {
  const times = [...new Set(input.times)].sort();
  if (!times.length || times.length > 8 || !times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw badRequest('invalid_times');
  const days = [...new Set(input.days?.length ? input.days : [1, 2, 3, 4, 5, 6, 7])].sort();
  if (!days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) throw badRequest('invalid_days');
  let label = input.label?.trim();
  if (input.medicationId) {
    const m = await fhirSystem().readOptional<MedicationStatement>('MedicationStatement', input.medicationId);
    if (!m || m.subject.reference !== patientRef) throw notFound('medication_not_found');
    label = label || m.medicationCodeableConcept?.text || 'Lek';
  }
  if (!label) throw badRequest('label_required');
  getDb()
    .prepare('INSERT INTO med_schedule (id, patient_ref, medication_ref, label, times, days, active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
    .run(newId(), patientRef, input.medicationId ? `MedicationStatement/${input.medicationId}` : null, label.slice(0, 120), JSON.stringify(times), JSON.stringify(days), by, nowIso());
  audit(actor, { action: 'C', subtype: 'med-schedule-create', patientRef, detail: { times: times.length, by } });
  return listSchedules(patientRef);
}

export function setScheduleActive(actor: AuditActor, patientRef: string, id: string, active: boolean): MedSchedule[] {
  const res = getDb().prepare('UPDATE med_schedule SET active = ? WHERE id = ? AND patient_ref = ?').run(active ? 1 : 0, id, patientRef);
  if (!res.changes) throw notFound('schedule_not_found');
  audit(actor, { action: 'U', subtype: active ? 'med-schedule-resume' : 'med-schedule-pause', patientRef });
  return listSchedules(patientRef);
}

export function deleteSchedule(actor: AuditActor, patientRef: string, id: string): MedSchedule[] {
  const res = getDb().prepare('DELETE FROM med_schedule WHERE id = ? AND patient_ref = ?').run(id, patientRef);
  if (!res.changes) throw notFound('schedule_not_found');
  audit(actor, { action: 'D', subtype: 'med-schedule-delete', patientRef });
  return listSchedules(patientRef);
}

export interface IntakeEntry {
  id: string;
  scheduleId: string;
  label: string;
  dueAt: string;
  status: 'due' | 'taken' | 'skipped' | 'missed';
  confirmedAt?: string;
}

export function listIntakeLog(patientRef: string, days = 7): IntakeEntry[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return (
    getDb()
      .prepare(
        `SELECT i.id, i.schedule_id, s.label, i.due_at, i.status, i.confirmed_at FROM med_intake i JOIN med_schedule s ON s.id = i.schedule_id
         WHERE s.patient_ref = ? AND i.due_at >= ? ORDER BY i.due_at DESC`,
      )
      .all(patientRef, since) as { id: string; schedule_id: string; label: string; due_at: string; status: IntakeEntry['status']; confirmed_at: string | null }[]
  ).map((r) => ({ id: r.id, scheduleId: r.schedule_id, label: r.label, dueAt: r.due_at, status: r.status, confirmedAt: r.confirmed_at ?? undefined }));
}

export function confirmIntake(actor: AuditActor, patientRef: string, id: string, status: 'taken' | 'skipped'): IntakeEntry[] {
  const res = getDb()
    .prepare('UPDATE med_intake SET status = ?, confirmed_at = ? WHERE id = ? AND schedule_id IN (SELECT id FROM med_schedule WHERE patient_ref = ?)')
    .run(status, nowIso(), id, patientRef);
  if (!res.changes) throw notFound('intake_not_found');
  audit(actor, { action: 'U', subtype: `med-intake-${status}`, patientRef });
  return listIntakeLog(patientRef);
}

function localParts(now: Date, tz: string): { date: string; time: string; weekday: number } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: wd };
}

/** Zadanie co minutę: przypomnienia o porach przyjęcia (okno 10 min) i oznaczenie pominiętych po 3 h. */
export async function runMedReminderSweep(now = new Date()): Promise<number> {
  const tz = config.clinic.timezone;
  const { date, weekday } = localParts(now, tz);
  const rows = getDb().prepare('SELECT * FROM med_schedule WHERE active = 1').all() as unknown as ScheduleRow[];
  let sent = 0;
  for (const r of rows) {
    if (!(JSON.parse(r.days) as number[]).includes(weekday)) continue;
    for (const t of JSON.parse(r.times) as string[]) {
      const due = zonedToUtc(date, t, tz);
      const diff = now.getTime() - due.getTime();
      if (diff < 0 || diff > 10 * 60_000) continue;
      const res = getDb().prepare("INSERT OR IGNORE INTO med_intake (id, schedule_id, due_at, status) VALUES (?, ?, ?, 'due')").run(newId(), r.id, due.toISOString());
      if (!res.changes) continue;
      await notifyPatient(r.patient_ref, {
        kind: 'med-reminder',
        title: `Przypomnienie: ${r.label} (${t})`,
        body: 'Potwierdź w aplikacji, czy lek został przyjęty.',
        link: '/leki',
        pushTitle: 'Eternal',
        pushBody: `Przypomnienie zaplanowane na ${t}.`,
      });
      sent++;
    }
  }
  getDb().prepare("UPDATE med_intake SET status = 'missed' WHERE status = 'due' AND due_at < ?").run(new Date(now.getTime() - 3 * 3_600_000).toISOString());
  return sent;
}
