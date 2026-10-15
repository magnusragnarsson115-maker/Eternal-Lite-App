import type { Goal } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { addDays, isoWeekday, localDate } from '../lib/time.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, vaultOrgId, withOrgTags } from '../tenancy.js';
import { listJournal } from './journal.js';
import { listMeasurements } from './observations.js';

/**
 * Cele i śledzenie postępów (A7.6): cele tygodniowe ustawiane przez pacjenta i liczone z danych aplikacji (pomiary,
 * dzienniki, ćwiczenia oddechowe) albo odhaczane ręcznie. Postęp to liczba „x z y” w bieżącym tygodniu — bez ocen,
 * bez porównań z innymi i bez celów zdrowotnych narzucanych przez aplikację (FHIR Goal w sejfie pacjenta).
 */

export const GOAL_KINDS = ['bp-measure', 'weight-measure', 'mood-log', 'sleep-log', 'breathing-minutes', 'custom'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

const GOAL_LABEL: Record<GoalKind, { pl: string; unit: string }> = {
  'bp-measure': { pl: 'Pomiary ciśnienia', unit: 'pomiarów' },
  'weight-measure': { pl: 'Pomiary masy ciała', unit: 'pomiarów' },
  'mood-log': { pl: 'Wpisy w dzienniku nastroju', unit: 'wpisów' },
  'sleep-log': { pl: 'Wpisy w dzienniku snu', unit: 'wpisów' },
  'breathing-minutes': { pl: 'Ćwiczenia oddechowe', unit: 'minut' },
  custom: { pl: 'Własny cel', unit: 'razy' },
};

const KIND_EXT = 'urn:eternal:ext:goal-kind';

export interface GoalView {
  id: string;
  kind: GoalKind;
  title: string;
  target: number;
  unit: string;
  status: Goal['lifecycleStatus'];
  week: { from: string; to: string; value: number; checkedToday?: boolean };
  createdAt: string;
}

function weekOf(today: string): { from: string; to: string } {
  const from = addDays(today, 1 - isoWeekday(today));
  return { from, to: addDays(from, 6) };
}

async function progress(patientRef: string, kind: GoalKind, goalId: string, from: string, to: string, tz: string): Promise<number> {
  const inWeek = (iso: string) => {
    const d = localDate(new Date(iso), tz);
    return d >= from && d <= to;
  };
  switch (kind) {
    case 'bp-measure':
      return (await listMeasurements(patientRef, 'bp')).filter((m) => inWeek(m.effective)).length;
    case 'weight-measure':
      return (await listMeasurements(patientRef, 'weight')).filter((m) => inWeek(m.effective)).length;
    case 'mood-log':
      return (await listJournal(patientRef, 'mood', 14)).filter((e) => inWeek(e.at)).length;
    case 'sleep-log':
      return (await listJournal(patientRef, 'sleep', 14)).filter((e) => e.sleep && e.sleep.date >= from && e.sleep.date <= to).length;
    case 'breathing-minutes':
      return Math.round((await listJournal(patientRef, 'breathing', 14)).filter((e) => inWeek(e.at)).reduce((s, e) => s + (e.breathing?.minutes ?? 0), 0));
    case 'custom':
      return (getDb().prepare('SELECT COUNT(*) AS n FROM goal_checkin WHERE goal_id = ? AND day >= ? AND day <= ?').get(goalId, from, to) as { n: number }).n;
  }
}

async function toView(g: Goal, patientRef: string, tz: string, now: Date): Promise<GoalView> {
  const kind = (g.extension?.find((e) => e.url === KIND_EXT)?.valueCode ?? 'custom') as GoalKind;
  const today = localDate(now, tz);
  const w = weekOf(today);
  const value = await progress(patientRef, kind, g.id ?? '', w.from, w.to, tz);
  const checked = kind === 'custom' ? !!getDb().prepare('SELECT 1 FROM goal_checkin WHERE goal_id = ? AND day = ?').get(g.id ?? '', today) : undefined;
  return {
    id: g.id ?? '',
    kind,
    title: g.description.text ?? GOAL_LABEL[kind].pl,
    target: g.target?.[0]?.detailQuantity?.value ?? 1,
    unit: GOAL_LABEL[kind].unit,
    status: g.lifecycleStatus,
    week: { ...w, value, checkedToday: checked },
    createdAt: g.startDate ?? '',
  };
}

export async function createGoal(actor: AuditActor, patientRef: string, input: { kind: GoalKind; target: number; title?: string }, tz: string, now: Date = new Date()): Promise<GoalView> {
  if (!(input.target >= 1 && input.target <= (input.kind === 'breathing-minutes' ? 300 : 21))) throw badRequest('invalid_target');
  if (input.kind === 'custom' && !input.title?.trim()) throw badRequest('title_required');
  const active = await listGoalResources(patientRef);
  if (active.filter((g) => g.lifecycleStatus === 'active').length >= 10) throw badRequest('too_many_goals');
  const saved = await fhirSystem().create<Goal>(
    withOrgTags<Goal>(
      {
        resourceType: 'Goal',
        lifecycleStatus: 'active',
        description: { text: (input.kind === 'custom' ? input.title!.trim() : GOAL_LABEL[input.kind].pl).slice(0, 120) },
        subject: { reference: patientRef },
        startDate: localDate(now, tz),
        expressedBy: { reference: patientRef },
        target: [{ measure: { text: GOAL_LABEL[input.kind].pl }, detailQuantity: { value: input.target, unit: `${GOAL_LABEL[input.kind].unit} / tydzień` } }],
        extension: [{ url: KIND_EXT, valueCode: input.kind }],
      },
      [vaultOrgId(patientRef)],
    ),
  );
  audit(actor, { action: 'C', subtype: 'goal-create', entityRef: `Goal/${saved.id}`, patientRef });
  return toView(saved, patientRef, tz, now);
}

async function listGoalResources(patientRef: string): Promise<Goal[]> {
  return fhirSystem().search<Goal>('Goal', { subject: patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '100' });
}

export async function listGoals(patientRef: string, tz: string, now: Date = new Date()): Promise<GoalView[]> {
  const goals = (await listGoalResources(patientRef)).filter((g) => g.lifecycleStatus === 'active');
  return Promise.all(goals.map((g) => toView(g, patientRef, tz, now)));
}

export async function checkGoal(actor: AuditActor, patientRef: string, id: string, done: boolean, tz: string, now: Date = new Date()): Promise<GoalView> {
  const g = await fhirSystem().readOptional<Goal>('Goal', id);
  if (!g || g.subject.reference !== patientRef) throw notFound('goal_not_found');
  if (g.extension?.find((e) => e.url === KIND_EXT)?.valueCode !== 'custom') throw badRequest('goal_counted_automatically');
  const today = localDate(now, tz);
  if (done) getDb().prepare('INSERT OR IGNORE INTO goal_checkin (goal_id, patient_ref, day, created_at) VALUES (?, ?, ?, ?)').run(id, patientRef, today, nowIso());
  else getDb().prepare('DELETE FROM goal_checkin WHERE goal_id = ? AND day = ?').run(id, today);
  audit(actor, { action: 'U', subtype: 'goal-check', entityRef: `Goal/${id}`, patientRef });
  return toView(g, patientRef, tz, now);
}

export async function endGoal(actor: AuditActor, patientRef: string, id: string): Promise<void> {
  const g = await fhirSystem().readOptional<Goal>('Goal', id);
  if (!g || g.subject.reference !== patientRef) throw notFound('goal_not_found');
  await fhirSystem().update<Goal>({ ...g, lifecycleStatus: 'completed', statusDate: nowIso().slice(0, 10) });
  audit(actor, { action: 'U', subtype: 'goal-end', entityRef: `Goal/${id}`, patientRef });
}
