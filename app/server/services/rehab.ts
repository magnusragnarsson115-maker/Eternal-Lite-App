import type { CarePlan, CarePlanActivity, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { addDays, isoWeekday, localDate } from '../lib/time.js';
import { badRequest, newId, notFound, nowIso } from '../lib/util.js';
import { notifyPatient } from './notifications.js';

/**
 * Plan rehabilitacji z kontrolą wykonania (A22.4). Plan (FHIR CarePlan) układa lekarz lub fizjoterapeuta placówki:
 * ćwiczenia, dawka, dni tygodnia, okres. Pacjent odhacza wykonane ćwiczenia; obie strony widzą zwykłe liczby —
 * ile sesji zaplanowano do dziś i ile oznaczono jako wykonane. Aplikacja nie ocenia postępów rehabilitacji.
 */

export const REHAB_VERSION = 'plan-rehabilitacji/2026-10-1';
const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayCode = (typeof DAY_CODES)[number];

export interface RehabActivityInput {
  name: string;
  instructions?: string;
  dose?: string;
  days: number[];
}

export interface RehabPlanView {
  id: string;
  title: string;
  status: CarePlan['status'];
  start: string;
  end?: string;
  author?: string;
  note?: string;
  activities: { index: number; name: string; instructions?: string; dose?: string; days: number[] }[];
  today: { date: string; items: { index: number; name: string; done: boolean }[] };
  adherence: { last7: { expected: number; done: number }; total: { expected: number; done: number } };
}

const DOSE_EXT = 'urn:eternal:ext:rehab-dose';

function toDays(a: CarePlanActivity): number[] {
  const dow = a.detail?.scheduledTiming?.repeat?.dayOfWeek ?? [];
  return dow.map((d) => DAY_CODES.indexOf(d as DayCode) + 1).filter((n) => n > 0);
}

function expectedSessions(activities: RehabPlanView['activities'], from: string, to: string): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    n += activities.filter((a) => a.days.includes(wd)).length;
  }
  return n;
}

function logsOf(planId: string): { activity: number; day: string }[] {
  return getDb().prepare('SELECT activity, day FROM rehab_log WHERE plan_id = ?').all(planId) as { activity: number; day: string }[];
}

export function toRehabView(p: CarePlan, tz: string, now: Date = new Date()): RehabPlanView {
  const today = localDate(now, tz);
  const activities = (p.activity ?? []).map((a, index) => ({
    index,
    name: a.detail?.code?.text ?? '',
    instructions: a.detail?.description,
    dose: a.detail?.extension?.find((e) => e.url === DOSE_EXT)?.valueString,
    days: toDays(a),
  }));
  const start = p.period?.start ?? today;
  const end = p.period?.end;
  const until = end && end < today ? end : today;
  const logs = logsOf(p.id ?? '');
  const done = (from: string) => logs.filter((l) => l.day >= from && l.day <= until).length;
  const weekAgo = addDays(today, -6) > start ? addDays(today, -6) : start;
  const wd = isoWeekday(today);
  return {
    id: p.id ?? '',
    title: p.title ?? 'Plan rehabilitacji',
    status: p.status,
    start,
    end,
    author: p.author?.display,
    note: p.note?.[0]?.text,
    activities,
    today: {
      date: today,
      items: today >= start && (!end || today <= end) ? activities.filter((a) => a.days.includes(wd)).map((a) => ({ index: a.index, name: a.name, done: logs.some((l) => l.activity === a.index && l.day === today) })) : [],
    },
    adherence: {
      last7: { expected: expectedSessions(activities, weekAgo, until), done: done(weekAgo) },
      total: { expected: expectedSessions(activities, start, until), done: done(start) },
    },
  };
}

export async function createRehabPlan(
  actor: AuditActor,
  staff: AppUser,
  patientId: string,
  input: { title: string; start: string; end?: string; note?: string; activities: RehabActivityInput[] },
): Promise<CarePlan> {
  const patient = await fhir().readOptional<Patient>('Patient', patientId);
  if (!patient) throw notFound('patient_not_found');
  if (!input.activities.length) throw badRequest('activity_required');
  if (input.end && input.end < input.start) throw badRequest('invalid_period');
  for (const a of input.activities) if (!a.name.trim() || !a.days.length || a.days.some((d) => d < 1 || d > 7)) throw badRequest('invalid_activity');
  const patientRef = `Patient/${patientId}`;
  const saved = await fhir().create<CarePlan>({
    resourceType: 'CarePlan',
    status: 'active',
    intent: 'plan',
    title: input.title.trim().slice(0, 120),
    category: [{ coding: [{ system: 'http://snomed.info/sct', code: '52052004', display: 'Rehabilitation therapy' }], text: 'Rehabilitacja' }],
    subject: { reference: patientRef },
    period: { start: input.start, end: input.end },
    created: nowIso(),
    author: { reference: staff.fhir_ref ?? `urn:eternal:user:${staff.id}`, display: staff.display_name },
    note: input.note?.trim() ? [{ text: input.note.trim().slice(0, 1000) }] : undefined,
    activity: input.activities.map((a) => ({
      detail: {
        status: 'scheduled',
        code: { text: a.name.trim().slice(0, 120) },
        description: a.instructions?.trim().slice(0, 1000) || undefined,
        scheduledTiming: { repeat: { frequency: 1, period: 1, periodUnit: 'd', dayOfWeek: [...new Set(a.days)].sort().map((d) => DAY_CODES[d - 1]) } },
        extension: a.dose?.trim() ? [{ url: DOSE_EXT, valueString: a.dose.trim().slice(0, 80) }] : undefined,
      },
    })),
    extension: [{ url: 'urn:eternal:ext:template-version', valueString: REHAB_VERSION }],
  });
  audit(actor, { action: 'C', subtype: 'rehab-plan-create', entityRef: `CarePlan/${saved.id}`, patientRef });
  await notifyPatient(patientRef, { kind: 'rehab-plan', title: 'Nowy plan ćwiczeń', body: 'Placówka przygotowała dla Ciebie plan ćwiczeń. Zobacz go w aplikacji.', link: '/plan' });
  bus.publish({ type: 'appointment.changed', patientRef });
  return saved;
}

const isRehab = (p: CarePlan) => p.category?.some((c) => c.coding?.some((x) => x.code === '52052004'));

export async function listRehabForPatient(patientRef: string, tz: string, now: Date = new Date()): Promise<RehabPlanView[]> {
  const plans = await fhirSystem().search<CarePlan>('CarePlan', { subject: patientRef, _count: '100' });
  return plans.filter((p) => isRehab(p) && ['active', 'completed'].includes(p.status)).map((p) => toRehabView(p, tz, now)).sort((a, b) => b.start.localeCompare(a.start));
}

export async function listRehabForStaff(patientId: string, tz: string, now: Date = new Date()): Promise<RehabPlanView[]> {
  const plans = await fhir().search<CarePlan>('CarePlan', { subject: `Patient/${patientId}`, _count: '100' });
  return plans.filter((p) => isRehab(p) && p.status !== 'entered-in-error').map((p) => toRehabView(p, tz, now));
}

export async function logRehab(actor: AuditActor, patientRef: string, planId: string, input: { activity: number; day: string; done: boolean; note?: string }, tz: string, now: Date = new Date()): Promise<RehabPlanView> {
  const plan = await fhirSystem().readOptional<CarePlan>('CarePlan', planId);
  if (!plan || plan.subject.reference !== patientRef || !isRehab(plan)) throw notFound('plan_not_found');
  if (plan.status !== 'active') throw badRequest('plan_not_active');
  const view = toRehabView(plan, tz, now);
  if (!view.activities[input.activity]) throw badRequest('invalid_activity');
  if (input.day > view.today.date || input.day < view.start || (view.end && input.day > view.end)) throw badRequest('invalid_date');
  if (!view.activities[input.activity].days.includes(isoWeekday(input.day))) throw badRequest('not_scheduled');
  if (input.done) {
    getDb()
      .prepare('INSERT OR IGNORE INTO rehab_log (id, plan_id, patient_ref, activity, day, done_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(newId(), planId, patientRef, input.activity, input.day, nowIso(), input.note?.trim().slice(0, 300) || null);
  } else {
    getDb().prepare('DELETE FROM rehab_log WHERE plan_id = ? AND activity = ? AND day = ?').run(planId, input.activity, input.day);
  }
  audit(actor, { action: 'U', subtype: input.done ? 'rehab-done' : 'rehab-undone', entityRef: `CarePlan/${planId}`, patientRef });
  return toRehabView(plan, tz, now);
}

export async function endRehabPlan(actor: AuditActor, planId: string): Promise<void> {
  const plan = await fhir().readOptional<CarePlan>('CarePlan', planId);
  if (!plan || !isRehab(plan)) throw notFound('plan_not_found');
  await fhir().update<CarePlan>({ ...plan, status: 'completed', period: { ...plan.period, end: plan.period?.end ?? nowIso().slice(0, 10) } });
  audit(actor, { action: 'U', subtype: 'rehab-plan-end', entityRef: `CarePlan/${planId}`, patientRef: plan.subject.reference });
}
