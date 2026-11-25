import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { PREVENTIVE_PROGRAMS, PREVENTIVE_VERSION, preventiveApproval, preventiveVisible, type PreventiveProgram } from '../content/preventive.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { distanceKm } from '../lib/geo.js';
import { isoWeekday, localDate, zonedToUtc } from '../lib/time.js';
import { badRequest, newId, notFound, nowIso } from '../lib/util.js';
import { listSchedules } from './medReminders.js';
import { notifyPatient, notifyUser } from './notifications.js';
import { listPatientAppointments } from './scheduling.js';

/**
 * Przypomnienia ustawiane przez pacjenta (F9.11, A7.8), programy profilaktyczne NFZ według wieku (A7.7),
 * poranne podsumowanie dnia (F5.5) i lokalizacja do usług publicznych (A11.1).
 *
 * Aplikacja niczego nie zaleca: godziny, miejsce i treść przypomnienia wpisuje pacjent (np. tak, jak ustalił
 * z lekarzem), a przy profilaktyce pokazuje zasady programu NFZ i datę z prostego dodawania lat do daty, którą
 * wpisał pacjent. Treść push nie zawiera danych o zdrowiu (ekran blokady).
 */

// --- przypomnienia własne ------------------------------------------------------------------------------------

export const CUSTOM_KINDS = ['light-therapy', 'exercise', 'custom'] as const;
export type CustomKind = (typeof CUSTOM_KINDS)[number];
const DEFAULT_TITLE: Record<CustomKind, string> = { 'light-therapy': 'Terapia światłem', exercise: 'Ćwiczenia', custom: 'Przypomnienie' };

export interface CustomReminder {
  id: string;
  kind: CustomKind;
  title: string;
  times: string[];
  days: number[];
  active: boolean;
  /** Miejsce (A7.8): adres albo nazwa — do odnośnika „pokaż na mapie”. */
  place?: string;
  createdAt: string;
}

interface CustomRow {
  id: string;
  user_id: string;
  patient_ref: string;
  kind: string;
  title: string;
  times: string;
  days: string;
  active: number;
  place: string | null;
  created_at: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toCustom(r: CustomRow): CustomReminder {
  return { id: r.id, kind: r.kind as CustomKind, title: r.title, times: JSON.parse(r.times) as string[], days: JSON.parse(r.days) as number[], active: !!r.active, place: r.place ?? undefined, createdAt: r.created_at };
}

function cleanSchedule(times: string[], days?: number[]): { times: string[]; days: number[] } {
  const t = [...new Set(times)].sort();
  if (!t.length || t.length > 8 || !t.every((x) => HHMM.test(x))) throw badRequest('invalid_times');
  const d = [...new Set(days?.length ? days : [1, 2, 3, 4, 5, 6, 7])].sort();
  if (!d.every((x) => Number.isInteger(x) && x >= 1 && x <= 7)) throw badRequest('invalid_days');
  return { times: t, days: d };
}

export function listCustomReminders(patientRef: string): CustomReminder[] {
  return (getDb().prepare('SELECT * FROM custom_reminder WHERE patient_ref = ? ORDER BY created_at').all(patientRef) as unknown as CustomRow[]).map(toCustom);
}

export function createCustomReminder(
  actor: AuditActor,
  userId: string,
  patientRef: string,
  input: { kind: CustomKind; title?: string; times: string[]; days?: number[]; place?: string },
): CustomReminder[] {
  const { times, days } = cleanSchedule(input.times, input.days);
  const count = (getDb().prepare('SELECT COUNT(*) AS n FROM custom_reminder WHERE patient_ref = ?').get(patientRef) as { n: number }).n;
  if (count >= 30) throw badRequest('too_many');
  const title = (input.title?.trim() || DEFAULT_TITLE[input.kind]).slice(0, 80);
  getDb()
    .prepare('INSERT INTO custom_reminder (id, user_id, patient_ref, kind, title, times, days, active, place, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
    .run(newId(), userId, patientRef, input.kind, title, JSON.stringify(times), JSON.stringify(days), input.place?.trim().slice(0, 160) || null, nowIso());
  audit(actor, { action: 'C', subtype: 'custom-reminder-create', patientRef, detail: { kind: input.kind, times: times.length } });
  return listCustomReminders(patientRef);
}

export function updateCustomReminder(
  actor: AuditActor,
  patientRef: string,
  id: string,
  input: { active?: boolean; title?: string; times?: string[]; days?: number[]; place?: string | null },
): CustomReminder[] {
  const row = getDb().prepare('SELECT * FROM custom_reminder WHERE id = ? AND patient_ref = ?').get(id, patientRef) as unknown as CustomRow | undefined;
  if (!row) throw notFound('reminder_not_found');
  const cur = toCustom(row);
  const sched = input.times || input.days ? cleanSchedule(input.times ?? cur.times, input.days ?? cur.days) : { times: cur.times, days: cur.days };
  const place = input.place === undefined ? cur.place ?? null : input.place?.trim().slice(0, 160) || null;
  getDb()
    .prepare('UPDATE custom_reminder SET active = ?, title = ?, times = ?, days = ?, place = ? WHERE id = ?')
    .run(input.active === undefined ? row.active : input.active ? 1 : 0, (input.title?.trim() || cur.title).slice(0, 80), JSON.stringify(sched.times), JSON.stringify(sched.days), place, id);
  audit(actor, { action: 'U', subtype: 'custom-reminder-update', patientRef });
  return listCustomReminders(patientRef);
}

export function deleteCustomReminder(actor: AuditActor, patientRef: string, id: string): CustomReminder[] {
  const res = getDb().prepare('DELETE FROM custom_reminder WHERE id = ? AND patient_ref = ?').run(id, patientRef);
  if (!res.changes) throw notFound('reminder_not_found');
  audit(actor, { action: 'D', subtype: 'custom-reminder-delete', patientRef });
  return listCustomReminders(patientRef);
}

/** Odnośnik do mapy (OpenStreetMap) dla wpisanego miejsca — otwierany na urządzeniu pacjenta. */
export function mapLink(place: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(place)}`;
}

/** Co minutę: przypomnienia o godzinach ustawionych przez pacjenta (okno 10 min, każda pora raz). */
export async function runCustomReminderSweep(now = new Date()): Promise<number> {
  const tz = config.clinic.timezone;
  const today = localDate(now, tz);
  const weekday = isoWeekday(today);
  const rows = getDb().prepare('SELECT * FROM custom_reminder WHERE active = 1').all() as unknown as CustomRow[];
  let sent = 0;
  for (const r of rows) {
    const v = toCustom(r);
    if (!v.days.includes(weekday)) continue;
    for (const t of v.times) {
      const due = zonedToUtc(today, t, tz);
      const diff = now.getTime() - due.getTime();
      if (diff < 0 || diff > 10 * 60_000) continue;
      const res = getDb().prepare('INSERT OR IGNORE INTO custom_reminder_sent (reminder_id, due_at) VALUES (?, ?)').run(r.id, due.toISOString());
      if (!res.changes) continue;
      await notifyPatient(r.patient_ref, {
        kind: 'custom-reminder',
        title: `${v.title} (${t})`,
        body: v.place ? `Miejsce: ${v.place}` : 'Przypomnienie, które ustawiłeś w aplikacji.',
        link: '/przypomnienia',
        pushTitle: 'Eternal',
        pushBody: `Przypomnienie zaplanowane na ${t}.`,
      });
      sent++;
    }
  }
  getDb().prepare('DELETE FROM custom_reminder_sent WHERE due_at < ?').run(new Date(now.getTime() - 30 * 86_400_000).toISOString());
  return sent;
}

// --- profilaktyka NFZ (A7.7) ---------------------------------------------------------------------------------

export interface PreventiveItem {
  key: string;
  name: string;
  text: string;
  howTo: string;
  note?: string;
  source: string;
  ageRange: string;
  variants?: { key: string; label: string; years: number }[];
  /** 'available' — w wieku programu i minął odstęp od ostatniego badania (albo brak daty); 'later' — kolejne
   *  badanie w programie od daty nextFrom; 'upcoming' — program od roku fromYear. */
  status: 'available' | 'later' | 'upcoming';
  fromYear?: number;
  lastDone?: string;
  variant?: string;
  nextFrom?: string;
  remind: boolean;
}

export interface PreventiveOverview {
  version: string;
  visible: boolean;
  draft: boolean;
  approval?: { by: string; at: string };
  birthYear?: number;
  items: PreventiveItem[];
}

interface StatusRow {
  patient_ref: string;
  program: string;
  last_done: string | null;
  variant: string | null;
  remind: number;
  notified_for: string | null;
}

function addYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  // 29 lutego → 28 lutego w roku niebędącym przestępnym
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

function intervalFor(p: PreventiveProgram, age: number, variant?: string): number {
  const v = p.variants?.find((x) => x.key === variant);
  if (v) return v.years;
  return [...p.intervals].reverse().find((i) => age >= i.fromAge)?.years ?? p.intervals[0].years;
}

/** Programy dla rocznika i płci z kartoteki; płeć nieznana — pokazujemy wszystkie (decyduje pacjent). */
export function preventiveItems(birthYear: number | undefined, gender: string | undefined, rows: StatusRow[], today: string): PreventiveItem[] {
  if (!birthYear) return [];
  const year = Number(today.slice(0, 4));
  const age = year - birthYear;
  const out: PreventiveItem[] = [];
  for (const p of PREVENTIVE_PROGRAMS) {
    if (p.sex === 'female' && gender === 'male') continue;
    if (p.maxAge !== undefined && age > p.maxAge) continue;
    const row = rows.find((r) => r.program === p.key);
    const base = {
      key: p.key,
      name: p.name,
      text: p.text,
      howTo: p.howTo,
      note: p.note,
      source: p.source,
      ageRange: p.maxAge ? `${p.minAge}–${p.maxAge}` : `${p.minAge}+`,
      variants: p.variants,
      lastDone: row?.last_done ?? undefined,
      variant: row?.variant ?? undefined,
      remind: !!row?.remind,
    };
    if (age < p.minAge) {
      if (p.minAge - age <= 5) out.push({ ...base, status: 'upcoming', fromYear: birthYear + p.minAge });
      continue;
    }
    const nextFrom = row?.last_done ? addYears(row.last_done, intervalFor(p, age, row.variant ?? undefined)) : undefined;
    out.push({ ...base, nextFrom, status: nextFrom && nextFrom > today ? 'later' : 'available' });
  }
  return out;
}

async function patientDemographics(patientRef: string): Promise<{ birthYear?: number; gender?: string }> {
  const p = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
  const y = p?.birthDate ? Number(p.birthDate.slice(0, 4)) : undefined;
  return { birthYear: y && Number.isFinite(y) ? y : undefined, gender: p?.gender };
}

function statusRows(patientRef: string): StatusRow[] {
  return getDb().prepare('SELECT * FROM preventive_status WHERE patient_ref = ?').all(patientRef) as unknown as StatusRow[];
}

export async function preventiveOverview(actor: AuditActor, patientRef: string, now = new Date()): Promise<PreventiveOverview> {
  const approval = preventiveApproval();
  const visible = preventiveVisible();
  const head = { version: PREVENTIVE_VERSION, visible, draft: !approval, approval: approval ? { by: approval.approvedBy, at: approval.approvedAt } : undefined };
  if (!visible) return { ...head, items: [] };
  const { birthYear, gender } = await patientDemographics(patientRef);
  audit(actor, { action: 'R', subtype: 'preventive-overview', patientRef });
  return { ...head, birthYear, items: preventiveItems(birthYear, gender, statusRows(patientRef), localDate(now, config.clinic.timezone)) };
}

export async function setPreventiveStatus(
  actor: AuditActor,
  patientRef: string,
  program: string,
  input: { lastDone?: string | null; variant?: string | null; remind?: boolean },
  now = new Date(),
): Promise<PreventiveOverview> {
  const p = PREVENTIVE_PROGRAMS.find((x) => x.key === program);
  if (!p) throw notFound('program_not_found');
  if (!preventiveVisible()) throw badRequest('content_not_approved');
  if (input.lastDone && input.lastDone > localDate(now, config.clinic.timezone)) throw badRequest('date_in_future');
  if (input.variant && !p.variants?.some((v) => v.key === input.variant)) throw badRequest('invalid_value');
  const cur = statusRows(patientRef).find((r) => r.program === program);
  const lastDone = input.lastDone === undefined ? cur?.last_done ?? null : input.lastDone;
  const variant = input.variant === undefined ? cur?.variant ?? null : input.variant;
  const remind = input.remind === undefined ? cur?.remind ?? 0 : input.remind ? 1 : 0;
  getDb()
    .prepare(
      `INSERT INTO preventive_status (patient_ref, program, last_done, variant, remind, notified_for, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(patient_ref, program) DO UPDATE SET last_done = excluded.last_done, variant = excluded.variant, remind = excluded.remind, notified_for = NULL, updated_at = excluded.updated_at`,
    )
    .run(patientRef, program, lastDone, variant, remind, nowIso());
  audit(actor, { action: 'U', subtype: 'preventive-status', patientRef, detail: { program, remind: !!remind } });
  return preventiveOverview(actor, patientRef, now);
}

/** Raz na godzinę: jedno przypomnienie, gdy zgodnie z zasadami programu można skorzystać z badania. */
export async function runPreventiveSweep(now = new Date()): Promise<number> {
  if (!preventiveVisible()) return 0;
  const today = localDate(now, config.clinic.timezone);
  const rows = getDb().prepare('SELECT * FROM preventive_status WHERE remind = 1').all() as unknown as StatusRow[];
  const byPatient = new Map<string, StatusRow[]>();
  for (const r of rows) byPatient.set(r.patient_ref, [...(byPatient.get(r.patient_ref) ?? []), r]);
  let sent = 0;
  for (const [patientRef, list] of byPatient) {
    const { birthYear, gender } = await patientDemographics(patientRef);
    for (const item of preventiveItems(birthYear, gender, list, today)) {
      const row = list.find((r) => r.program === item.key);
      if (!row || item.status !== 'available') continue;
      const key = item.nextFrom ?? 'available';
      if (row.notified_for === key) continue;
      getDb().prepare('UPDATE preventive_status SET notified_for = ? WHERE patient_ref = ? AND program = ?').run(key, patientRef, item.key);
      await notifyPatient(patientRef, {
        kind: 'preventive',
        title: item.name,
        body: 'Według zasad programu NFZ możesz skorzystać z tego badania. Jak się zapisać — w aplikacji, w zakładce „Profilaktyka”.',
        link: '/profilaktyka',
        pushTitle: 'Eternal',
        pushBody: 'Masz nowe przypomnienie w aplikacji.',
      });
      sent++;
    }
  }
  return sent;
}

// --- poranne podsumowanie dnia (F5.5) ------------------------------------------------------------------------

export interface MorningPrefs {
  enabled: boolean;
  time: string;
  lastSent?: string;
}

const MORNING_DEFAULT: MorningPrefs = { enabled: false, time: '07:30' };

export function getMorningPrefs(userId: string): MorningPrefs {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'morning'").get(userId) as { value: string } | undefined;
  return row ? { ...MORNING_DEFAULT, ...(JSON.parse(row.value) as Partial<MorningPrefs>) } : MORNING_DEFAULT;
}

function saveMorning(userId: string, p: MorningPrefs): void {
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'morning', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(p), nowIso());
}

export function setMorningPrefs(actor: AuditActor, userId: string, input: { enabled: boolean; time: string }): MorningPrefs {
  if (!HHMM.test(input.time)) throw badRequest('invalid_times');
  const p = { ...getMorningPrefs(userId), enabled: input.enabled, time: input.time };
  saveMorning(userId, p);
  audit(actor, { action: 'U', subtype: 'morning-summary-prefs', detail: { enabled: input.enabled } });
  return p;
}

export interface DayPlan {
  date: string;
  appointments: { start: string; service?: string; tele: boolean }[];
  medTimes: number;
  reminders: { title: string; time: string }[];
}

/** Plan dnia z kalendarza zdrowia: wizyty, liczba pór leków, przypomnienia własne. Bez porad. */
export async function dayPlan(patientRef: string, now = new Date()): Promise<DayPlan> {
  const tz = config.clinic.timezone;
  const date = localDate(now, tz);
  const wd = isoWeekday(date);
  const appointments = (await listPatientAppointments(patientRef))
    .filter((a) => ['booked', 'pending', 'arrived', 'checked-in'].includes(a.status) && localDate(new Date(a.start), tz) === date)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ start: a.start, service: a.serviceName, tele: a.mode === 'tele' }));
  const medTimes = listSchedules(patientRef)
    .filter((s) => s.active && s.days.includes(wd))
    .reduce((n, s) => n + s.times.length, 0);
  const reminders = listCustomReminders(patientRef)
    .filter((r) => r.active && r.days.includes(wd))
    .flatMap((r) => r.times.map((time) => ({ title: r.title, time })))
    .sort((a, b) => a.time.localeCompare(b.time));
  return { date, appointments, medTimes, reminders };
}

export function dayPlanText(p: DayPlan, tz = config.clinic.timezone): string {
  const time = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const parts: string[] = [];
  if (p.appointments.length) parts.push(`Wizyty: ${p.appointments.map((a) => `${time(a.start)}${a.service ? ` ${a.service}` : ''}${a.tele ? ' (wideo)' : ''}`).join(', ')}.`);
  if (p.medTimes) parts.push(`Przypomnienia o lekach: ${p.medTimes}.`);
  if (p.reminders.length) parts.push(`Moje przypomnienia: ${p.reminders.map((r) => `${r.time} ${r.title}`).join(', ')}.`);
  return parts.join(' ');
}

/** Co minutę: podsumowanie o godzinie wybranej przez pacjenta; tylko gdy coś jest zaplanowane. */
export async function runMorningSweep(now = new Date()): Promise<number> {
  const tz = config.clinic.timezone;
  const today = localDate(now, tz);
  const rows = getDb()
    .prepare("SELECT p.user_id, p.value, u.fhir_ref FROM user_pref p JOIN app_user u ON u.id = p.user_id WHERE p.key = 'morning' AND u.status = 'active'")
    .all() as { user_id: string; value: string; fhir_ref: string | null }[];
  let sent = 0;
  for (const r of rows) {
    const pref = { ...MORNING_DEFAULT, ...(JSON.parse(r.value) as Partial<MorningPrefs>) };
    if (!pref.enabled || pref.lastSent === today || !r.fhir_ref?.startsWith('Patient/')) continue;
    const due = zonedToUtc(today, pref.time, tz);
    const diff = now.getTime() - due.getTime();
    if (diff < 0 || diff > 10 * 60_000) continue;
    saveMorning(r.user_id, { ...pref, lastSent: today });
    const text = dayPlanText(await dayPlan(r.fhir_ref, now), tz);
    if (!text) continue;
    await notifyUser(r.user_id, { kind: 'morning-summary', title: 'Plan na dziś', body: text, link: '/kalendarz', pushTitle: 'Eternal', pushBody: 'Twój plan na dziś czeka w aplikacji.' });
    sent++;
  }
  return sent;
}

// --- lokalizacja (A11.1) -------------------------------------------------------------------------------------

/**
 * Miejsce do usług publicznych (jakość powietrza, pogoda, apteki w pobliżu). Pacjent wybiera miasto z listy albo
 * zgadza się na odczyt położenia urządzenia — zapisujemy współrzędne zaokrąglone do 0,01° (ok. 1 km), bez historii.
 */
export interface UserLocation {
  source: 'city' | 'device';
  label: string;
  lat: number;
  lon: number;
  updatedAt: string;
}

/** Miasta wojewódzkie i największe miasta — przybliżone współrzędne centrum (do wyboru bez GPS). */
export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Białystok', lat: 53.13, lon: 23.16 },
  { name: 'Bielsko-Biała', lat: 49.82, lon: 19.04 },
  { name: 'Bydgoszcz', lat: 53.12, lon: 18.01 },
  { name: 'Bytom', lat: 50.35, lon: 18.92 },
  { name: 'Chełm', lat: 51.14, lon: 23.47 },
  { name: 'Częstochowa', lat: 50.81, lon: 19.12 },
  { name: 'Elbląg', lat: 54.16, lon: 19.4 },
  { name: 'Gdańsk', lat: 54.35, lon: 18.65 },
  { name: 'Gdynia', lat: 54.52, lon: 18.53 },
  { name: 'Gliwice', lat: 50.29, lon: 18.67 },
  { name: 'Gorzów Wielkopolski', lat: 52.73, lon: 15.24 },
  { name: 'Grudziądz', lat: 53.48, lon: 18.75 },
  { name: 'Jelenia Góra', lat: 50.9, lon: 15.73 },
  { name: 'Kalisz', lat: 51.76, lon: 18.09 },
  { name: 'Katowice', lat: 50.26, lon: 19.02 },
  { name: 'Kielce', lat: 50.87, lon: 20.63 },
  { name: 'Konin', lat: 52.22, lon: 18.25 },
  { name: 'Koszalin', lat: 54.19, lon: 16.17 },
  { name: 'Kraków', lat: 50.06, lon: 19.94 },
  { name: 'Krosno', lat: 49.69, lon: 21.77 },
  { name: 'Legnica', lat: 51.21, lon: 16.16 },
  { name: 'Leszno', lat: 51.84, lon: 16.57 },
  { name: 'Lublin', lat: 51.25, lon: 22.57 },
  { name: 'Łomża', lat: 53.18, lon: 22.06 },
  { name: 'Łódź', lat: 51.76, lon: 19.46 },
  { name: 'Nowy Sącz', lat: 49.62, lon: 20.69 },
  { name: 'Olsztyn', lat: 53.78, lon: 20.49 },
  { name: 'Opole', lat: 50.67, lon: 17.93 },
  { name: 'Ostrołęka', lat: 53.09, lon: 21.57 },
  { name: 'Piła', lat: 53.15, lon: 16.74 },
  { name: 'Piotrków Trybunalski', lat: 51.41, lon: 19.7 },
  { name: 'Płock', lat: 52.55, lon: 19.71 },
  { name: 'Poznań', lat: 52.41, lon: 16.93 },
  { name: 'Przemyśl', lat: 49.78, lon: 22.77 },
  { name: 'Radom', lat: 51.4, lon: 21.15 },
  { name: 'Rybnik', lat: 50.1, lon: 18.55 },
  { name: 'Rzeszów', lat: 50.04, lon: 22.0 },
  { name: 'Siedlce', lat: 52.17, lon: 22.29 },
  { name: 'Słupsk', lat: 54.46, lon: 17.03 },
  { name: 'Sosnowiec', lat: 50.29, lon: 19.1 },
  { name: 'Suwałki', lat: 54.1, lon: 22.93 },
  { name: 'Szczecin', lat: 53.43, lon: 14.55 },
  { name: 'Tarnów', lat: 50.01, lon: 20.99 },
  { name: 'Toruń', lat: 53.01, lon: 18.6 },
  { name: 'Tychy', lat: 50.12, lon: 19.0 },
  { name: 'Wałbrzych', lat: 50.77, lon: 16.28 },
  { name: 'Warszawa', lat: 52.23, lon: 21.01 },
  { name: 'Włocławek', lat: 52.65, lon: 19.07 },
  { name: 'Wrocław', lat: 51.11, lon: 17.03 },
  { name: 'Zabrze', lat: 50.32, lon: 18.79 },
  { name: 'Zakopane', lat: 49.3, lon: 19.95 },
  { name: 'Zamość', lat: 50.72, lon: 23.25 },
  { name: 'Zielona Góra', lat: 51.94, lon: 15.51 },
];

export function getLocation(userId: string): UserLocation | undefined {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'location'").get(userId) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as UserLocation) : undefined;
}

export function setLocation(actor: AuditActor, userId: string, input: { city?: string; lat?: number; lon?: number }): UserLocation {
  let loc: UserLocation;
  if (input.city) {
    const c = CITIES.find((x) => x.name === input.city);
    if (!c) throw badRequest('invalid_value');
    loc = { source: 'city', label: c.name, lat: c.lat, lon: c.lon, updatedAt: nowIso() };
  } else {
    const { lat, lon } = input;
    if (lat === undefined || lon === undefined || !(lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24.2)) throw badRequest('location_outside_poland');
    const round = (x: number) => Math.round(x * 100) / 100;
    const near = nearestCity(lat, lon);
    loc = { source: 'device', label: near ? `okolice: ${near.name}` : 'położenie urządzenia', lat: round(lat), lon: round(lon), updatedAt: nowIso() };
  }
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'location', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(loc), nowIso());
  audit(actor, { action: 'U', subtype: 'location-set', detail: { source: loc.source } });
  return loc;
}

export function clearLocation(actor: AuditActor, userId: string): void {
  getDb().prepare("DELETE FROM user_pref WHERE user_id = ? AND key = 'location'").run(userId);
  audit(actor, { action: 'D', subtype: 'location-clear' });
}

export function nearestCity(lat: number, lon: number): { name: string; km: number } | undefined {
  let best: { name: string; km: number } | undefined;
  for (const c of CITIES) {
    const km = distanceKm({ lat, lon }, c);
    if (!best || km < best.km) best = { name: c.name, km };
  }
  return best && best.km <= 40 ? best : undefined;
}
