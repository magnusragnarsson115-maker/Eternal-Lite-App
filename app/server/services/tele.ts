import type { Appointment } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { teleJoinInfo, type TeleJoinInfo } from '../integrations/jitsi.js';
import { fetchWithTimeout, HttpError, nowIso } from '../lib/util.js';
import { teleRoomOf } from './scheduling.js';

/**
 * Wizyta wideo z poczekalnią (D7, A5.1). Dostawca wg decyzji D52: Whereby Embedded (pokój zamknięty — gospodarz
 * wpuszcza) albo Jitsi na własnym serwerze. Niezależnie od dostawcy pacjent widzi adres pokoju dopiero po
 * „Wpuść” lekarza — poczekalnia jest po naszej stronie. Kanał komunikacji; świadczenia udziela placówka.
 */

export interface TeleRow {
  appointment_id: string;
  org_id: string | null;
  provider: 'jitsi' | 'whereby';
  room: string;
  host_room: string | null;
  patient_joined_at: string | null;
  admitted_at: string | null;
  admitted_by: string | null;
  doctor_joined_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  created_at: string;
}

export interface TeleState {
  provider: 'jitsi' | 'whereby';
  waiting: boolean;
  admitted: boolean;
  ended: boolean;
  patientJoinedAt?: string;
  admittedAt?: string;
  join?: TeleJoinInfo | { provider: 'whereby'; url: string };
}

function row(appointmentId: string): TeleRow | undefined {
  return getDb().prepare('SELECT * FROM tele_session WHERE appointment_id = ?').get(appointmentId) as TeleRow | undefined;
}

async function createWhereby(endDate: string): Promise<{ roomUrl: string; hostRoomUrl: string }> {
  if (!config.video.wherebyApiKey) throw new HttpError(503, 'video_not_configured');
  const res = await fetchWithTimeout('https://api.whereby.dev/v1/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.video.wherebyApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endDate, fields: ['hostRoomUrl'], roomMode: 'normal', isLocked: true }),
  });
  if (!res.ok) throw new HttpError(502, 'video_provider_error', `Whereby ${res.status}`);
  const json = (await res.json()) as { roomUrl: string; hostRoomUrl: string };
  return { roomUrl: json.roomUrl, hostRoomUrl: json.hostRoomUrl };
}

export async function ensureTele(appt: Appointment, orgId: string | undefined): Promise<TeleRow> {
  const existing = row(appt.id ?? '');
  if (existing) return existing;
  const room = teleRoomOf(appt);
  if (!room) throw new HttpError(400, 'not_a_teleconsultation');
  const provider = config.video.provider === 'whereby' && config.video.wherebyApiKey ? 'whereby' : 'jitsi';
  let roomUrl = room;
  let host: string | null = null;
  if (provider === 'whereby') {
    const end = new Date(Date.parse(appt.end ?? appt.start ?? nowIso()) + 60 * 60_000).toISOString();
    const w = await createWhereby(end);
    roomUrl = w.roomUrl;
    host = w.hostRoomUrl;
  }
  getDb()
    .prepare('INSERT OR IGNORE INTO tele_session (appointment_id, org_id, provider, room, host_room, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(appt.id ?? '', orgId ?? null, provider, roomUrl, host, nowIso());
  return row(appt.id ?? '')!;
}

function joinFor(r: TeleRow, user: { name: string; id: string }, host: boolean): TeleState['join'] {
  if (r.provider === 'whereby') {
    const base = host ? (r.host_room ?? r.room) : r.room;
    const sep = base.includes('?') ? '&' : '?';
    return { provider: 'whereby', url: `${base}${sep}displayName=${encodeURIComponent(user.name)}&minimal&lang=pl` };
  }
  return teleJoinInfo(r.room, { name: user.name, id: user.id, moderator: host });
}

function state(r: TeleRow): Omit<TeleState, 'join'> {
  return {
    provider: r.provider,
    waiting: !!r.patient_joined_at && !r.admitted_at && !r.ended_at,
    admitted: !!r.admitted_at,
    ended: !!r.ended_at,
    patientJoinedAt: r.patient_joined_at ?? undefined,
    admittedAt: r.admitted_at ?? undefined,
  };
}

function publish(appointmentId: string, patientRef: string, orgId: string | null): void {
  bus.publish({ type: 'tele.changed', patientRef, resourceRef: `Appointment/${appointmentId}`, orgIds: orgId ? [orgId] : undefined });
}

/** Pacjent wchodzi do poczekalni; adres pokoju dostaje dopiero po wpuszczeniu. */
export async function patientEnter(appt: Appointment, patientRef: string, orgId: string | undefined, user: { name: string; id: string }, actor: AuditActor): Promise<TeleState> {
  const r = await ensureTele(appt, orgId);
  if (r.ended_at) return state(r);
  if (!r.patient_joined_at) {
    getDb().prepare('UPDATE tele_session SET patient_joined_at = ? WHERE appointment_id = ?').run(nowIso(), r.appointment_id);
    audit(actor, { action: 'E', subtype: 'tele-waiting', entityRef: `Appointment/${r.appointment_id}`, patientRef });
    publish(r.appointment_id, patientRef, r.org_id);
  }
  const fresh = row(r.appointment_id)!;
  return { ...state(fresh), join: fresh.admitted_at ? joinFor(fresh, user, false) : undefined };
}

export async function doctorEnter(appt: Appointment, orgId: string | undefined, user: { name: string; id: string }): Promise<TeleState> {
  const r = await ensureTele(appt, orgId);
  if (!r.doctor_joined_at) getDb().prepare('UPDATE tele_session SET doctor_joined_at = ? WHERE appointment_id = ?').run(nowIso(), r.appointment_id);
  const fresh = row(r.appointment_id)!;
  return { ...state(fresh), join: joinFor(fresh, user, true) };
}

export function teleStatus(appointmentId: string): Omit<TeleState, 'join'> | undefined {
  const r = row(appointmentId);
  return r ? state(r) : undefined;
}

export function admit(appointmentId: string, patientRef: string, actor: AuditActor): Omit<TeleState, 'join'> {
  const r = row(appointmentId);
  if (!r) throw new HttpError(409, 'tele_not_started');
  if (!r.admitted_at) {
    getDb().prepare('UPDATE tele_session SET admitted_at = ?, admitted_by = ? WHERE appointment_id = ?').run(nowIso(), actor.userId ?? null, appointmentId);
    audit(actor, { action: 'E', subtype: 'tele-admit', entityRef: `Appointment/${appointmentId}`, patientRef });
    publish(appointmentId, patientRef, r.org_id);
  }
  return state(row(appointmentId)!);
}

export function endTele(appointmentId: string, patientRef: string, actor: AuditActor): Omit<TeleState, 'join'> {
  const r = row(appointmentId);
  if (!r) throw new HttpError(409, 'tele_not_started');
  if (!r.ended_at) {
    const now = nowIso();
    const start = r.admitted_at ?? r.doctor_joined_at ?? r.created_at;
    const minutes = Math.max(0, Math.round(((Date.parse(now) - Date.parse(start)) / 60_000) * 10) / 10);
    getDb().prepare('UPDATE tele_session SET ended_at = ?, minutes = ? WHERE appointment_id = ?').run(now, minutes, appointmentId);
    audit(actor, { action: 'E', subtype: 'tele-end', entityRef: `Appointment/${appointmentId}`, patientRef, detail: { minutes } });
    publish(appointmentId, patientRef, r.org_id);
  }
  return state(row(appointmentId)!);
}

/** Lista oczekujących w poczekalni (panel). */
export function waitingRoom(orgId: string | undefined): { appointmentId: string; since: string }[] {
  const rows = getDb()
    .prepare('SELECT appointment_id, patient_joined_at FROM tele_session WHERE patient_joined_at IS NOT NULL AND admitted_at IS NULL AND ended_at IS NULL AND (org_id = ? OR ? IS NULL) ORDER BY patient_joined_at')
    .all(orgId ?? null, orgId ?? null) as { appointment_id: string; patient_joined_at: string }[];
  return rows.map((r) => ({ appointmentId: r.appointment_id, since: r.patient_joined_at }));
}

export function frameSources(): string[] {
  const out = [`https://${config.jitsi.domain}`];
  if (config.video.provider === 'whereby') out.push('https://*.whereby.com');
  return out;
}
