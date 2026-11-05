import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { calendarFeed, type FeedEvent } from '../lib/ics.js';
import { addDays, isoWeekday } from '../lib/time.js';
import { HttpError, newId, notFound, nowIso, randomToken, sha256 } from '../lib/util.js';
import { listVaccinations } from './healthHistory.js';
import { listSchedules } from './medReminders.js';
import { listRehabForPatient } from './rehab.js';
import { listPatientAppointments } from './scheduling.js';

/**
 * Kalendarz zdrowia (A17.13/A17.18): wizyty, planowane szczepienia, dni ćwiczeń z planu rehabilitacji
 * i przypomnienia o lekach w jednym widoku. Subskrypcja ICS (F5.6 Google, F5.7 Apple, Outlook) przez prywatny
 * adres — kalendarz zewnętrzny dostaje wyłącznie ogólne nazwy („Wizyta”, „Szczepienie”) bez danych o zdrowiu,
 * bo treść trafia na serwery dostawcy kalendarza.
 */

export interface CalendarEvent {
  id: string;
  kind: 'appointment' | 'vaccination' | 'rehab' | 'medication';
  title: string;
  detail?: string;
  start: string;
  end?: string;
  allDay: boolean;
  link: string;
}

const DAY_MAX = 120;

export async function calendarEvents(patientRef: string, from: string, to: string, tz: string, now: Date = new Date(), opts: { meds?: boolean } = {}): Promise<CalendarEvent[]> {
  if (to < from || addDays(from, DAY_MAX) < to) throw new HttpError(400, 'calendar_period_too_long');
  const out: CalendarEvent[] = [];
  for (const a of await listPatientAppointments(patientRef)) {
    if (!['booked', 'pending', 'arrived', 'checked-in', 'fulfilled'].includes(a.status)) continue;
    const day = a.start.slice(0, 10);
    if (day < from || day > to) continue;
    out.push({ id: `appt-${a.id}`, kind: 'appointment', title: a.serviceName ?? 'Wizyta', detail: [a.practitionerName, a.mode === 'tele' ? 'wizyta wideo' : a.locationName].filter(Boolean).join(' · '), start: a.start, end: a.end, allDay: false, link: `/wizyty/${a.id}` });
  }
  for (const v of await listVaccinations(patientRef)) {
    if (v.status !== 'planned' || v.date < from || v.date > to) continue;
    out.push({ id: `vacc-${v.id}`, kind: 'vaccination', title: `Szczepienie: ${v.vaccine}`, detail: v.dose ? `dawka ${v.dose}` : undefined, start: v.date, allDay: true, link: '/historia-zdrowia' });
  }
  const plans = (await listRehabForPatient(patientRef, tz, now)).filter((p) => p.status === 'active');
  // przypomnienia o lekach są codzienne — tylko na życzenie, żeby nie zasłaniały wizyt i terminów
  const meds = opts.meds ? listSchedules(patientRef).filter((s) => s.active) : [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const p of plans) {
      if (d < p.start || (p.end && d > p.end)) continue;
      const items = p.activities.filter((a) => a.days.includes(wd));
      if (items.length) out.push({ id: `rehab-${p.id}-${d}`, kind: 'rehab', title: `Ćwiczenia: ${p.title}`, detail: items.map((i) => i.name).join(', '), start: d, allDay: true, link: '/plan' });
    }
    const todays = meds.filter((s) => !s.days?.length || s.days.includes(wd));
    const count = todays.reduce((n, s) => n + s.times.length, 0);
    if (count) out.push({ id: `med-${d}`, kind: 'medication', title: `Przypomnienia o lekach: ${count}`, detail: todays.map((s) => `${s.label} (${s.times.join(', ')})`).join('; '), start: d, allDay: true, link: '/leki' });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// --- subskrypcja ICS --------------------------------------------------------------------------------------------------

const GENERIC: Record<CalendarEvent['kind'], string> = {
  appointment: 'Wizyta (Eternal)',
  vaccination: 'Szczepienie (Eternal)',
  rehab: 'Ćwiczenia (Eternal)',
  medication: 'Leki — przypomnienia (Eternal)',
};

export function feedStatus(userId: string, patientRef: string): { active: boolean; createdAt?: string; lastReadAt?: string } {
  const row = getDb().prepare('SELECT created_at, last_read_at FROM calendar_feed WHERE user_id = ? AND patient_ref = ? AND revoked_at IS NULL').get(userId, patientRef) as { created_at: string; last_read_at: string | null } | undefined;
  return row ? { active: true, createdAt: row.created_at, lastReadAt: row.last_read_at ?? undefined } : { active: false };
}

/** Nowy adres subskrypcji (poprzedni przestaje działać). Token pokazujemy tylko raz. */
export function createFeed(actor: AuditActor, userId: string, patientRef: string): { url: string; webcal: string } {
  const db = getDb();
  db.prepare('UPDATE calendar_feed SET revoked_at = ? WHERE user_id = ? AND patient_ref = ? AND revoked_at IS NULL').run(nowIso(), userId, patientRef);
  const token = randomToken(32);
  db.prepare('INSERT INTO calendar_feed (id, token_hash, user_id, patient_ref, created_at) VALUES (?, ?, ?, ?, ?)').run(newId(), sha256(token), userId, patientRef, nowIso());
  audit(actor, { action: 'C', subtype: 'calendar-feed-create', patientRef });
  const url = `${config.publicUrl}/api/calendar/${token}.ics`;
  return { url, webcal: url.replace(/^https?:/, 'webcal:') };
}

export function revokeFeed(actor: AuditActor, userId: string, patientRef: string): void {
  const res = getDb().prepare('UPDATE calendar_feed SET revoked_at = ? WHERE user_id = ? AND patient_ref = ? AND revoked_at IS NULL').run(nowIso(), userId, patientRef);
  if (!res.changes) throw notFound('feed_not_found');
  audit(actor, { action: 'D', subtype: 'calendar-feed-revoke', patientRef });
}

/** Odczyt przez aplikację kalendarza: od 30 dni wstecz do 90 dni naprzód, nazwy ogólne. */
export async function feedIcs(token: string, tz: string, now: Date = new Date()): Promise<string> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(404, 'feed_not_found');
  const row = getDb().prepare('SELECT id, patient_ref, user_id FROM calendar_feed WHERE token_hash = ? AND revoked_at IS NULL').get(sha256(token)) as { id: string; patient_ref: string; user_id: string } | undefined;
  if (!row) throw new HttpError(404, 'feed_not_found');
  getDb().prepare('UPDATE calendar_feed SET last_read_at = ? WHERE id = ?').run(nowIso(), row.id);
  audit({ userId: row.user_id, display: 'Aplikacja kalendarza (subskrypcja)' }, { action: 'R', subtype: 'calendar-feed-read', patientRef: row.patient_ref });
  const today = now.toISOString().slice(0, 10);
  const events = await calendarEvents(row.patient_ref, addDays(today, -30), addDays(today, 90), tz, now);
  const feed: FeedEvent[] = events.map((e) => ({
    uid: `${e.id}@eternal`,
    summary: GENERIC[e.kind],
    description: 'Szczegóły w aplikacji Eternal.',
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    url: `${config.publicUrl}${e.link}`,
  }));
  return calendarFeed('Eternal — kalendarz zdrowia', feed);
}
