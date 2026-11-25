import type { Appointment, QuestionnaireResponse } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { INTERVIEW_TREES, interviewTree, type IvNode, type IvTree, treeApproval, treeNode, treeVisible } from '../content/interviews.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { ETERNAL } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, conflict, forbidden, newId, notFound, nowIso } from '../lib/util.js';
import { orgIdsOf, vaultOrgId, withOrgTags } from '../tenancy.js';
import { activeGrantsFor } from './grants.js';
import type { Patient } from '@medplum/fhirtypes';
import {
  answerToEvidence,
  diagnosis,
  engineAvailable,
  type EngineQuestion,
  type Evidence,
  newInterviewId,
  parseText,
  questionToNode,
  regulatoryAck,
  type Sex,
  triage,
  TRIAGE_PL,
} from '../integrations/infermedica.js';

/**
 * Wywiad czatowy przed wizytą (A12.4, A5.5). Silnik deterministyczny: bieżące pytanie → odpowiedź → następne pytanie
 * według reguł drzewa (content/interviews.ts, zatwierdzane przez lekarza). Podsumowanie przepisuje odpowiedzi do pól
 * (powód, czas trwania, objawy, objawy zaprzeczone, leki, choroby, uczulenia, czynniki ryzyka, sprawy do omówienia)
 * — bez punktacji, pilności i rozpoznań.
 */

export type AnswerValue = string | number | string[];

export interface InterviewSummary {
  reason: string[];
  duration?: string;
  symptoms: string[];
  /** Objawy, o które zapytano i którym pacjent zaprzeczył (pertinent negatives). */
  negatives: string[];
  /** Odpowiedzi „nie wiem” — do wyjaśnienia na wizycie. */
  unsure: string[];
  meds: string[];
  conditions: string[];
  allergies: string[];
  risk: string[];
  issues: string[];
  other: { question: string; answer: string }[];
}

interface Row {
  id: string;
  patient_ref: string;
  org_id: string | null;
  appointment_id: string | null;
  tree_id: string;
  tree_version: string;
  answers: string;
  path: string;
  status: 'in_progress' | 'completed';
  summary: string | null;
  response_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface InterviewView {
  id: string;
  treeId: string;
  title: string;
  version: string;
  approved: boolean;
  status: Row['status'];
  appointmentId?: string;
  /** Pytania już zadane, z odpowiedziami w czytelnej postaci (rozmowa). */
  transcript: { nodeId: string; question: string; answer: string }[];
  current?: Pick<IvNode, 'id' | 'text' | 'type' | 'options' | 'unit' | 'min' | 'max' | 'optional' | 'hint'>;
  summary?: InterviewSummary;
  createdAt: string;
  completedAt?: string;
  notice: string;
  engine: 'tree' | 'infermedica';
  /** Wynik triażu wyrobu medycznego Infermedica — tylko w trybie silnika, z oznaczeniem źródła. */
  engineResult?: { triageLevel: string; label: string; serious: string[]; source: string };
}

export const ENGINE_TREE = 'infermedica';
const ENGINE_VERSION = 'infermedica-engine-api-v3';
const ENGINE_MAX_QUESTIONS = 30;

interface EngineState {
  sex: Sex;
  age: number;
  interviewId: string;
  evidence: Evidence[];
  labels: Record<string, string>;
  current?: EngineQuestion;
  steps: { question: EngineQuestion; answer: string; added: number }[];
  result?: InterviewView['engineResult'];
}

const NOTICE = 'Odpowiedzi przeczyta lekarz — aplikacja ich nie ocenia. To nie jest zgłoszenie nagłego stanu: w nagłym zagrożeniu dzwoń 112.';

function rowById(id: string): Row | undefined {
  return getDb().prepare('SELECT * FROM interview_session WHERE id = ?').get(id) as Row | undefined;
}

function labelOf(node: IvNode, v: AnswerValue): string {
  if (Array.isArray(v)) return v.map((x) => node.options?.find((o) => o.value === x)?.label ?? x).join(', ');
  if (typeof v === 'number') return `${String(v).replace('.', ',')}${node.unit ?? ''}`;
  return node.options?.find((o) => o.value === v)?.label ?? v;
}

function validate(node: IvNode, v: AnswerValue | null): AnswerValue | null {
  if (v === null || v === '' || (Array.isArray(v) && !v.length)) {
    if (node.optional) return null;
    throw badRequest('answer_required');
  }
  switch (node.type) {
    case 'single':
    case 'yesno':
      if (typeof v !== 'string' || !node.options?.some((o) => o.value === v)) throw badRequest('invalid_value');
      return v;
    case 'multi':
      if (!Array.isArray(v) || v.some((x) => !node.options?.some((o) => o.value === x))) throw badRequest('invalid_value');
      return [...new Set(v)];
    case 'number': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || (node.min !== undefined && n < node.min) || (node.max !== undefined && n > node.max)) throw badRequest('invalid_value');
      return n;
    }
    case 'text':
      if (typeof v !== 'string') throw badRequest('invalid_value');
      return v.trim().slice(0, 1000);
  }
}

/** Następne pytanie: z wybranej odpowiedzi (rozgałęzienie), inaczej domyślne następne pytanie węzła. */
export function nextNode(node: IvNode, v: AnswerValue | null): string | undefined {
  if (typeof v === 'string') return node.options?.find((o) => o.value === v)?.next ?? node.next;
  if (Array.isArray(v)) return v.map((x) => node.options?.find((o) => o.value === x)?.next).find(Boolean) ?? node.next;
  return node.next;
}

export function summarize(tree: IvTree, answers: Record<string, AnswerValue | null>, path: string[]): InterviewSummary {
  const s: InterviewSummary = { reason: [], symptoms: [], negatives: [], unsure: [], meds: [], conditions: [], allergies: [], risk: [], issues: [], other: [] };
  for (const id of path) {
    const node = treeNode(tree, id);
    const v = answers[id];
    if (!node || v === null || v === undefined) continue;
    const label = labelOf(node, v);
    const q = node.text.replace(/\?$/, '').replace(/\s*\(.*\)$/, '');
    if (node.type === 'yesno') {
      if (v === 'unknown') {
        s.unsure.push(node.symptom ?? node.riskLabel ?? q);
        continue;
      }
      const yes = v === 'yes';
      if (node.field === 'symptoms' && node.symptom) (yes ? s.symptoms : s.negatives).push(node.symptom);
      else if (node.field === 'risk' && node.riskLabel) {
        if (yes) s.risk.push(node.riskLabel);
      } else if (node.field === 'allergies') {
        if (!yes) s.allergies.push('pacjent zaprzecza uczuleniom na leki');
      } else if (node.field === 'conditions' && node.symptom) {
        if (yes) s.conditions.push(node.symptom);
      } else if (node.field === 'meds') {
        if (!yes) s.meds.push('bez zmian w lekach od ostatniej wizyty (według pacjenta)');
      } else s.other.push({ question: node.text, answer: label });
      continue;
    }
    switch (node.field) {
      case 'reason':
        s.reason.push(label);
        break;
      case 'duration':
        s.duration = label;
        break;
      case 'symptoms':
        s.symptoms.push(node.type === 'multi' ? label : `${q}: ${label}`);
        break;
      case 'meds':
        s.meds.push(label);
        break;
      case 'conditions':
        if (Array.isArray(v) && v.includes('none')) s.conditions.push('pacjent nie zgłasza chorób z listy');
        else s.conditions.push(label);
        break;
      case 'allergies':
        s.allergies.push(label);
        break;
      case 'risk':
        if (!(node.id === 'alcohol' && v === 'never')) s.risk.push(`${q}: ${label}`);
        break;
      case 'issues':
        s.issues.push(label);
        break;
      default:
        s.other.push({ question: node.text, answer: label });
    }
  }
  return s;
}

function engineView(r: Row): InterviewView {
  const st = JSON.parse(r.answers) as EngineState;
  const ack = regulatoryAck();
  return {
    id: r.id,
    treeId: r.tree_id,
    title: 'Wywiad objawowy (silnik Infermedica)',
    version: r.tree_version,
    approved: !!ack,
    status: r.status,
    appointmentId: r.appointment_id ?? undefined,
    transcript: st.steps.map((x, i) => ({ nodeId: `q${i + 1}`, question: x.question.text, answer: x.answer })),
    current: r.status === 'in_progress' && st.current ? questionToNode(st.current, st.steps.length + 1) : undefined,
    summary: r.summary ? (JSON.parse(r.summary) as InterviewSummary) : undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    notice: 'Pytania dobiera i wynik triażu podaje wyrób medyczny Infermedica (klasa IIb wg MDR). To nie jest rozpoznanie. W nagłym zagrożeniu dzwoń 112.',
    engine: 'infermedica',
    engineResult: st.result,
  };
}

function toView(r: Row): InterviewView {
  if (r.tree_id === ENGINE_TREE) return engineView(r);
  const tree = interviewTree(r.tree_id);
  const answers = JSON.parse(r.answers) as Record<string, AnswerValue | null>;
  const path = JSON.parse(r.path) as string[];
  const currentId = r.status === 'completed' ? undefined : path.at(-1);
  const answered = r.status === 'completed' ? path : path.slice(0, -1);
  const cur = currentId ? treeNode(tree, currentId) : undefined;
  return {
    id: r.id,
    treeId: r.tree_id,
    title: tree.title,
    version: r.tree_version,
    approved: !!treeApproval(tree),
    status: r.status,
    appointmentId: r.appointment_id ?? undefined,
    transcript: answered.map((id) => {
      const n = treeNode(tree, id)!;
      const v = answers[id];
      return { nodeId: id, question: n.text, answer: v === null || v === undefined ? '(pominięte)' : labelOf(n, v) };
    }),
    current: cur ? { id: cur.id, text: cur.text, type: cur.type, options: cur.options?.map((o) => ({ value: o.value, label: o.label })), unit: cur.unit, min: cur.min, max: cur.max, optional: cur.optional, hint: cur.hint } : undefined,
    summary: r.summary ? (JSON.parse(r.summary) as InterviewSummary) : undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    notice: NOTICE,
    engine: 'tree',
  };
}

export function availableInterviews(): { id: string; title: string; specialty: string; description: string; version: string; approved: boolean }[] {
  return INTERVIEW_TREES.filter(treeVisible).map((t) => ({ id: t.id, title: t.title, specialty: t.specialty, description: t.description, version: t.version, approved: !!treeApproval(t) }));
}

export async function startInterview(actor: AuditActor, patientRef: string, input: { treeId: string; appointmentId?: string }): Promise<InterviewView> {
  const tree = INTERVIEW_TREES.find((t) => t.id === input.treeId);
  if (!tree || !treeVisible(tree)) throw notFound('interview_not_found');
  let orgId: string | null = null;
  if (input.appointmentId) {
    const appt = await fhirSystem().readOptional<Appointment>('Appointment', input.appointmentId);
    if (!appt || !appt.participant.some((p) => p.actor?.reference === patientRef)) throw forbidden('not_your_appointment');
    orgId = orgIdsOf(appt)[0] ?? null;
  }
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare('INSERT INTO interview_session (id, patient_ref, org_id, appointment_id, tree_id, tree_version, answers, path, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, patientRef, orgId, input.appointmentId ?? null, tree.id, tree.version, '{}', JSON.stringify([tree.start]), 'in_progress', actor.userId ?? null, now, now);
  audit(actor, { action: 'C', subtype: 'interview-start', patientRef, detail: { interview: id, tree: tree.id } });
  return toView(rowById(id)!);
}

function own(patientRef: string, id: string): Row {
  const r = rowById(id);
  if (!r || r.patient_ref !== patientRef) throw notFound('interview_not_found');
  return r;
}

export function getInterview(actor: AuditActor, patientRef: string, id: string): InterviewView {
  const r = own(patientRef, id);
  audit(actor, { action: 'R', subtype: 'interview-read', patientRef, detail: { interview: id } });
  return toView(r);
}

export function listInterviews(patientRef: string): InterviewView[] {
  return (getDb().prepare('SELECT * FROM interview_session WHERE patient_ref = ? ORDER BY created_at DESC LIMIT 50').all(patientRef) as unknown as Row[]).map(toView);
}

export async function answerInterview(actor: AuditActor, patientRef: string, id: string, input: { nodeId: string; value: AnswerValue | null }): Promise<InterviewView> {
  const r = own(patientRef, id);
  if (r.status !== 'in_progress') throw conflict('interview_completed');
  if (r.tree_id === ENGINE_TREE) return answerEngine(actor, r, input);
  const tree = interviewTree(r.tree_id);
  if (tree.version !== r.tree_version) throw conflict('interview_version_changed');
  const path = JSON.parse(r.path) as string[];
  if (path.at(-1) !== input.nodeId) throw conflict('interview_not_current_question');
  const node = treeNode(tree, input.nodeId)!;
  const value = validate(node, input.value);
  const answers = { ...(JSON.parse(r.answers) as Record<string, AnswerValue | null>), [node.id]: value };
  const next = nextNode(node, value);
  if (next && !treeNode(tree, next)) throw new Error(`interview ${tree.id}: missing node ${next}`);
  if (next && path.includes(next)) throw new Error(`interview ${tree.id}: loop at ${next}`);
  const now = nowIso();
  if (next) {
    getDb().prepare('UPDATE interview_session SET answers = ?, path = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(answers), JSON.stringify([...path, next]), now, id);
    return toView(rowById(id)!);
  }
  // koniec — podsumowanie i zapis odpowiedzi jako QuestionnaireResponse (widoczny dla placówki tylko przy wizycie u niej)
  const summary = summarize(tree, answers, path);
  const view = toView({ ...r, answers: JSON.stringify(answers), path: JSON.stringify(path), status: 'completed' });
  return complete(actor, r, view, summary, JSON.stringify(answers), `urn:eternal:interview:${tree.id}|${tree.version}`, path.length);
}

async function complete(actor: AuditActor, r: Row, view: InterviewView, summary: InterviewSummary, answersJson: string, questionnaire: string, answered: number): Promise<InterviewView> {
  const patientRef = r.patient_ref;
  const id = r.id;
  const now = nowIso();
  const qr: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire,
    subject: { reference: patientRef },
    author: { reference: patientRef },
    source: { reference: patientRef },
    authored: now,
    item: view.transcript.map((t) => ({ linkId: t.nodeId, text: t.question, answer: [{ valueString: t.answer }] })),
    extension: [
      ...(r.appointment_id ? [{ url: ETERNAL.ext.appointment, valueReference: { reference: `Appointment/${r.appointment_id}` } }] : []),
      { url: 'urn:eternal:ext:interview', valueString: r.id },
    ],
  };
  const saved = await fhirSystem().create<QuestionnaireResponse>(withOrgTags(qr, [r.org_id ?? vaultOrgId(patientRef)]));
  getDb()
    .prepare("UPDATE interview_session SET answers = ?, status = 'completed', summary = ?, response_ref = ?, completed_at = ?, updated_at = ? WHERE id = ?")
    .run(answersJson, JSON.stringify(summary), `QuestionnaireResponse/${saved.id}`, now, now, id);
  audit(actor, { action: 'C', subtype: 'interview-complete', entityRef: `QuestionnaireResponse/${saved.id}`, patientRef, detail: { interview: id, tree: r.tree_id, answers: answered } });
  bus.publish({ type: 'questionnaire.changed', patientRef, resourceRef: r.appointment_id ? `Appointment/${r.appointment_id}` : undefined, orgIds: r.org_id ? [r.org_id] : undefined });
  return toView(rowById(id)!);
}

/** Krok wstecz (poprawa poprzedniej odpowiedzi) — tylko w trakcie. */
export function backInterview(actor: AuditActor, patientRef: string, id: string): InterviewView {
  const r = own(patientRef, id);
  if (r.status !== 'in_progress') throw conflict('interview_completed');
  if (r.tree_id === ENGINE_TREE) {
    const st = JSON.parse(r.answers) as EngineState;
    const last = st.steps.pop();
    if (last) {
      st.evidence.splice(st.evidence.length - last.added, last.added);
      st.current = last.question;
      getDb().prepare('UPDATE interview_session SET answers = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(st), nowIso(), id);
    }
    return toView(rowById(id)!);
  }
  const path = JSON.parse(r.path) as string[];
  if (path.length < 2) return toView(r);
  const answers = JSON.parse(r.answers) as Record<string, AnswerValue | null>;
  const prev = path.slice(0, -1);
  delete answers[prev.at(-1)!];
  getDb().prepare('UPDATE interview_session SET answers = ?, path = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(answers), JSON.stringify(prev), nowIso(), id);
  audit(actor, { action: 'U', subtype: 'interview-back', patientRef, detail: { interview: id } });
  return toView(rowById(id)!);
}

/** Dla personelu: zakończone wywiady pacjenta przy wizytach w tej placówce albo przy aktywnym udostępnieniu. */
export function interviewsForStaff(actor: AuditActor, orgId: string, patientId: string): InterviewView[] {
  const patientRef = `Patient/${patientId}`;
  const shared = activeGrantsFor(orgId, patientRef).length > 0;
  const rows = (getDb().prepare("SELECT * FROM interview_session WHERE patient_ref = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 20").all(patientRef) as unknown as Row[]).filter(
    (r) => r.org_id === orgId || shared,
  );
  audit(actor, { action: 'R', subtype: 'interview-staff-read', patientRef, detail: { count: rows.length } });
  return rows.map(toView);
}

// --- tryb silnika Infermedica (wyrób medyczny dostawcy; dostępny tylko po ocenie zgodności — integrations/infermedica.ts)

function ageOf(birthDate: string | undefined, now = new Date()): number | undefined {
  if (!birthDate) return undefined;
  const b = new Date(`${birthDate}T00:00:00Z`);
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export function engineStatus(): { available: boolean } {
  return { available: engineAvailable() };
}

export async function startEngineInterview(actor: AuditActor, patientRef: string, input: { text: string; sex?: Sex; age?: number; appointmentId?: string }): Promise<InterviewView> {
  if (!engineAvailable()) throw conflict('engine_not_available');
  const p = await fhirSystem().read<Patient>('Patient', patientRef.split('/')[1]);
  const sex = input.sex ?? (p.gender === 'male' || p.gender === 'female' ? p.gender : undefined);
  const age = input.age ?? ageOf(p.birthDate);
  if (!sex) throw badRequest('sex_required');
  if (!age || age < 1 || age > 130) throw badRequest('age_required');
  let orgId: string | null = null;
  if (input.appointmentId) {
    const appt = await fhirSystem().readOptional<Appointment>('Appointment', input.appointmentId);
    if (!appt || !appt.participant.some((x) => x.actor?.reference === patientRef)) throw forbidden('not_your_appointment');
    orgId = orgIdsOf(appt)[0] ?? null;
  }
  const interviewId = newInterviewId();
  const parsed = await parseText(input.text, sex, age, interviewId);
  if (!parsed.evidence.length) throw badRequest('no_symptoms_recognized');
  const d = await diagnosis(sex, age, parsed.evidence, interviewId);
  const st: EngineState = { sex, age, interviewId, evidence: parsed.evidence, labels: parsed.labels, current: d.question, steps: [] };
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare('INSERT INTO interview_session (id, patient_ref, org_id, appointment_id, tree_id, tree_version, answers, path, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, patientRef, orgId, input.appointmentId ?? null, ENGINE_TREE, ENGINE_VERSION, JSON.stringify(st), '[]', 'in_progress', actor.userId ?? null, now, now);
  audit(actor, { action: 'C', subtype: 'interview-start', patientRef, detail: { interview: id, tree: ENGINE_TREE, initial: parsed.evidence.length } });
  const row = rowById(id)!;
  if (!d.question || d.should_stop) return finishEngine(actor, row, st);
  return toView(row);
}

function engineSummary(st: EngineState): InterviewSummary {
  const label = (id: string) => st.labels[id] ?? id;
  return {
    reason: st.evidence.filter((e) => e.source === 'initial' && e.choice_id === 'present').map((e) => label(e.id)),
    symptoms: st.evidence.filter((e) => e.source !== 'initial' && e.choice_id === 'present').map((e) => label(e.id)),
    negatives: st.evidence.filter((e) => e.choice_id === 'absent').map((e) => label(e.id)),
    unsure: st.evidence.filter((e) => e.choice_id === 'unknown').map((e) => label(e.id)),
    meds: [],
    conditions: [],
    allergies: [],
    risk: [],
    issues: [],
    other: [],
  };
}

async function finishEngine(actor: AuditActor, r: Row, st: EngineState): Promise<InterviewView> {
  const t = await triage(st.sex, st.age, st.evidence, st.interviewId);
  st.current = undefined;
  st.result = {
    triageLevel: t.triage_level,
    label: TRIAGE_PL[t.triage_level] ?? t.triage_level,
    serious: (t.serious ?? []).map((x) => x.common_name ?? x.name),
    source: 'Infermedica Engine API (wyrób medyczny klasy IIb wg MDR)',
  };
  const summary = engineSummary(st);
  const view = engineView({ ...r, answers: JSON.stringify(st), status: 'completed', summary: JSON.stringify(summary) });
  return complete(actor, r, view, summary, JSON.stringify(st), `urn:eternal:interview:${ENGINE_TREE}|${ENGINE_VERSION}`, st.steps.length);
}

async function answerEngine(actor: AuditActor, r: Row, input: { nodeId: string; value: AnswerValue | null }): Promise<InterviewView> {
  const st = JSON.parse(r.answers) as EngineState;
  if (!st.current || input.nodeId !== `q${st.steps.length + 1}`) throw conflict('interview_not_current_question');
  if (input.value === null || typeof input.value === 'number') throw badRequest('answer_required');
  const added = answerToEvidence(st.current, input.value);
  for (const it of st.current.items) st.labels[it.id] = it.name;
  const node = questionToNode(st.current, st.steps.length + 1);
  const answerLabel = Array.isArray(input.value) ? input.value.map((v) => node.options.find((o) => o.value === v)?.label ?? v).join(', ') || '—' : (node.options.find((o) => o.value === input.value)?.label ?? String(input.value));
  st.steps.push({ question: st.current, answer: answerLabel, added: added.length });
  st.evidence.push(...added);
  const d = await diagnosis(st.sex, st.age, st.evidence, st.interviewId);
  if (!d.question || d.should_stop || st.steps.length >= ENGINE_MAX_QUESTIONS) return finishEngine(actor, r, st);
  st.current = d.question;
  getDb().prepare('UPDATE interview_session SET answers = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(st), nowIso(), r.id);
  return toView(rowById(r.id)!);
}
