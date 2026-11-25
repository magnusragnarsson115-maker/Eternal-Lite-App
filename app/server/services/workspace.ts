import type { DiagnosticReport, Observation, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { findUserById, isStaff, listUsers } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { ETERNAL } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { addDays, localDate, zonedToUtc } from '../lib/time.js';
import { badRequest, conflict, newId, notFound, nowIso } from '../lib/util.js';
import { hasConsent } from './consents.js';
import { listGrantsForOrg } from './grants.js';
import { prepFor, type VisitPrep } from './inbox.js';
import { listIntake } from './intake.js';
import { listMedications } from './medications.js';
import { listThreadsForStaff } from './messages.js';
import { staffOrgId } from './orgs.js';
import { responseForAppointment } from './questionnaires.js';
import { listAppointmentsInRange, listPatientAppointments, type AppointmentView } from './scheduling.js';

/**
 * Przestrzeń pracy lekarza (Eternal Klinika, runda 5): kolejka pacjentów i sprawy.
 *
 * Kolejka powstaje z faktów organizacyjnych — wizyt, wiadomości, wgranych dokumentów, wyników, pomiarów
 * z telemonitoringu, szkiców notatek i zadań wpisanych ręcznie. Kolejność: termin i czas zdarzenia.
 * Aplikacja NIE ustala pilności klinicznej: „pilne” to wyłącznie oznaczenie nadane przez personel
 * (z nazwiskiem i godziną w historii sprawy). Granica MDR — docs/COMPLIANCE.md §1.
 */

export const CASE_STATUSES = ['new', 'incomplete', 'analysis', 'doctor', 'follow-up', 'closed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_STATUS_PL: Record<CaseStatus, string> = {
  new: 'nowa',
  incomplete: 'dane niepełne',
  analysis: 'do analizy',
  doctor: 'do lekarza',
  'follow-up': 'kontrola (follow-up)',
  closed: 'zakończona',
};
/** Cykl życia sprawy: dozwolone przejścia. Zamkniętą sprawę można tylko otworzyć ponownie (→ nowa). */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ['incomplete', 'analysis', 'doctor', 'follow-up', 'closed'],
  incomplete: ['analysis', 'doctor', 'closed'],
  analysis: ['doctor', 'incomplete', 'follow-up', 'closed'],
  doctor: ['analysis', 'follow-up', 'closed'],
  'follow-up': ['doctor', 'analysis', 'closed'],
  closed: ['new'],
};
export const CASE_SOURCES = ['manual', 'appointment', 'message', 'intake', 'result', 'rpm', 'scribe', 'grant'] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];
export type CasePriority = 'normal' | 'urgent';

interface CaseRow {
  id: string;
  org_id: string;
  patient_ref: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  owner_user_id: string | null;
  owner_name: string | null;
  source: CaseSource;
  source_ref: string | null;
  appointment_id: string | null;
  due_date: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface EventRow {
  id: string;
  case_id: string;
  at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  kind: 'created' | 'status' | 'owner' | 'priority' | 'note' | 'due';
  from_value: string | null;
  to_value: string | null;
  note: string | null;
}

export interface CaseEvent {
  at: string;
  actor?: string;
  kind: EventRow['kind'];
  from?: string;
  to?: string;
  note?: string;
}

export interface CaseView {
  id: string;
  patientId: string;
  patientName?: string;
  title: string;
  status: CaseStatus;
  statusLabel: string;
  next: CaseStatus[];
  priority: CasePriority;
  owner?: { userId: string; name: string };
  source: CaseSource;
  sourceRef?: string;
  appointmentId?: string;
  dueDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  history?: CaseEvent[];
}

function toCaseView(r: CaseRow, history?: EventRow[]): CaseView {
  return {
    id: r.id,
    patientId: idFromRef(r.patient_ref),
    title: r.title,
    status: r.status,
    statusLabel: CASE_STATUS_PL[r.status],
    next: CASE_TRANSITIONS[r.status],
    priority: r.priority,
    owner: r.owner_user_id ? { userId: r.owner_user_id, name: r.owner_name ?? '' } : undefined,
    source: r.source,
    sourceRef: r.source_ref ?? undefined,
    appointmentId: r.appointment_id ?? undefined,
    dueDate: r.due_date ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    closedAt: r.closed_at ?? undefined,
    history: history?.map((e) => ({ at: e.at, actor: e.actor_name ?? undefined, kind: e.kind, from: e.from_value ?? undefined, to: e.to_value ?? undefined, note: e.note ?? undefined })),
  };
}

function requireOrg(user: AppUser): string {
  const orgId = staffOrgId(user);
  if (!orgId) throw badRequest('org_required');
  return orgId;
}

function caseRow(orgId: string, id: string): CaseRow {
  const r = getDb().prepare('SELECT * FROM care_case WHERE id = ? AND org_id = ?').get(id, orgId) as CaseRow | undefined;
  if (!r) throw notFound('case_not_found');
  return r;
}

function addEvent(caseId: string, user: AppUser, e: Omit<EventRow, 'id' | 'case_id' | 'at' | 'actor_user_id' | 'actor_name'>): void {
  getDb()
    .prepare('INSERT INTO care_case_event (id, case_id, at, actor_user_id, actor_name, kind, from_value, to_value, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), caseId, nowIso(), user.id, user.display_name, e.kind, e.from_value, e.to_value, e.note);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CaseInput {
  patientId: string;
  title: string;
  status?: CaseStatus;
  priority?: CasePriority;
  ownerUserId?: string | null;
  source?: CaseSource;
  sourceRef?: string;
  appointmentId?: string;
  dueDate?: string;
  note?: string;
}

function ownerFor(orgId: string, userId: string | null | undefined): { id: string; name: string } | null {
  if (!userId) return null;
  const u = findUserById(userId);
  if (!u || u.org_id !== orgId || !isStaff(u)) throw badRequest('owner_not_in_org');
  return { id: u.id, name: u.display_name };
}

/** Nowa sprawa (zadanie ręczne albo przejęcie pozycji z kolejki). Dla tego samego źródła — jedna otwarta sprawa. */
export async function createCase(user: AppUser, actor: AuditActor, input: CaseInput): Promise<CaseView> {
  const orgId = requireOrg(user);
  const title = input.title.trim().slice(0, 160);
  if (!title) throw badRequest('title_required');
  if (input.dueDate && !DATE.test(input.dueDate)) throw badRequest('invalid_date');
  const patientRef = `Patient/${input.patientId}`;
  // pacjent musi być widoczny dla tej placówki (zakres organizacji)
  const p = await fhir().readOptional<Patient>('Patient', input.patientId);
  if (!p) throw notFound('patient_not_found');
  const source = input.source ?? 'manual';
  if (input.sourceRef) {
    const open = getDb().prepare('SELECT * FROM care_case WHERE org_id = ? AND source = ? AND source_ref = ? AND closed_at IS NULL').get(orgId, source, input.sourceRef) as CaseRow | undefined;
    if (open) return toCaseView(open);
  }
  const owner = input.ownerUserId === undefined ? { id: user.id, name: user.display_name } : ownerFor(orgId, input.ownerUserId);
  const status = input.status ?? 'new';
  if (!CASE_STATUSES.includes(status)) throw badRequest('invalid_status');
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO care_case (id, org_id, patient_ref, title, status, priority, owner_user_id, owner_name, source, source_ref, appointment_id, due_date, note, created_by, created_at, updated_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, orgId, patientRef, title, status, input.priority ?? 'normal', owner?.id ?? null, owner?.name ?? null, source, input.sourceRef ?? null, input.appointmentId ?? null, input.dueDate ?? null, input.note?.trim().slice(0, 1000) || null, user.id, now, now, status === 'closed' ? now : null);
  addEvent(id, user, { kind: 'created', from_value: null, to_value: status, note: input.note?.trim().slice(0, 300) || null });
  if (input.priority === 'urgent') addEvent(id, user, { kind: 'priority', from_value: 'normal', to_value: 'urgent', note: null });
  audit(actor, { action: 'C', subtype: 'case-create', entityRef: `urn:eternal:case:${id}`, patientRef, detail: { source, status } });
  return toCaseView(caseRow(orgId, id));
}

/** Zmiana statusu, właściciela, oznaczenia „pilne”, terminu albo notatki — każda zmiana trafia do historii sprawy. */
export function updateCase(
  user: AppUser,
  actor: AuditActor,
  id: string,
  patch: { status?: CaseStatus; ownerUserId?: string | null; priority?: CasePriority; dueDate?: string | null; note?: string; comment?: string },
): CaseView {
  const orgId = requireOrg(user);
  const row = caseRow(orgId, id);
  const sets: string[] = [];
  const vals: (string | null)[] = [];
  if (patch.status && patch.status !== row.status) {
    if (!CASE_TRANSITIONS[row.status].includes(patch.status)) throw conflict('case_transition_not_allowed', `${row.status} → ${patch.status}`);
    sets.push('status = ?', 'closed_at = ?');
    vals.push(patch.status, patch.status === 'closed' ? nowIso() : null);
    addEvent(id, user, { kind: 'status', from_value: row.status, to_value: patch.status, note: patch.comment?.trim().slice(0, 300) || null });
  }
  if (patch.ownerUserId !== undefined && patch.ownerUserId !== row.owner_user_id) {
    const owner = ownerFor(orgId, patch.ownerUserId);
    sets.push('owner_user_id = ?', 'owner_name = ?');
    vals.push(owner?.id ?? null, owner?.name ?? null);
    addEvent(id, user, { kind: 'owner', from_value: row.owner_name, to_value: owner?.name ?? null, note: null });
  }
  if (patch.priority && patch.priority !== row.priority) {
    sets.push('priority = ?');
    vals.push(patch.priority);
    addEvent(id, user, { kind: 'priority', from_value: row.priority, to_value: patch.priority, note: patch.comment?.trim().slice(0, 300) || null });
  }
  if (patch.dueDate !== undefined && patch.dueDate !== row.due_date) {
    if (patch.dueDate && !DATE.test(patch.dueDate)) throw badRequest('invalid_date');
    sets.push('due_date = ?');
    vals.push(patch.dueDate);
    addEvent(id, user, { kind: 'due', from_value: row.due_date, to_value: patch.dueDate, note: null });
  }
  if (patch.note !== undefined) {
    const note = patch.note.trim().slice(0, 1000) || null;
    sets.push('note = ?');
    vals.push(note);
    addEvent(id, user, { kind: 'note', from_value: null, to_value: null, note: note?.slice(0, 300) ?? null });
  }
  if (!sets.length && patch.comment) addEvent(id, user, { kind: 'note', from_value: null, to_value: null, note: patch.comment.trim().slice(0, 300) });
  if (sets.length) {
    getDb()
      .prepare(`UPDATE care_case SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...vals, nowIso(), id);
  }
  audit(actor, { action: 'U', subtype: 'case-update', entityRef: `urn:eternal:case:${id}`, patientRef: row.patient_ref, detail: { status: patch.status, owner: patch.ownerUserId !== undefined, priority: patch.priority } });
  return getCase(user, actor, id, { audit: false });
}

export function getCase(user: AppUser, actor: AuditActor, id: string, opts: { audit?: boolean } = {}): CaseView {
  const orgId = requireOrg(user);
  const row = caseRow(orgId, id);
  const events = getDb().prepare('SELECT * FROM care_case_event WHERE case_id = ? ORDER BY at, rowid').all(id) as unknown as EventRow[];
  if (opts.audit !== false) audit(actor, { action: 'R', subtype: 'case-read', entityRef: `urn:eternal:case:${id}`, patientRef: row.patient_ref });
  return toCaseView(row, events);
}

export function listCases(user: AppUser, filter: { patientId?: string; includeClosed?: boolean } = {}): CaseView[] {
  const orgId = requireOrg(user);
  const where = ['org_id = ?'];
  const vals: string[] = [orgId];
  if (filter.patientId) {
    where.push('patient_ref = ?');
    vals.push(`Patient/${filter.patientId}`);
  }
  if (!filter.includeClosed) where.push('closed_at IS NULL');
  const rows = getDb().prepare(`SELECT * FROM care_case WHERE ${where.join(' AND ')} ORDER BY COALESCE(due_date, substr(created_at, 1, 10)), created_at LIMIT 500`).all(...vals) as unknown as CaseRow[];
  return rows.map((r) => toCaseView(r));
}

/** Osoby z placówki, którym można przypisać sprawę. */
export function caseOwners(user: AppUser): { userId: string; name: string; role: string }[] {
  const orgId = requireOrg(user);
  return listUsers({ orgId, staffOnly: true })
    .filter((u) => u.status === 'active')
    .map((u) => ({ userId: u.id, name: u.display_name, role: u.roles.includes('practitioner') ? 'lekarz' : u.roles.includes('admin') ? 'administrator' : 'rejestracja' }));
}

// --- kompletność danych przed wizytą ---------------------------------------------------------------------

export type CompletenessKey = 'interview' | 'results' | 'consent' | 'medications' | 'measurements';
export interface CompletenessItem {
  key: CompletenessKey;
  label: string;
  status: 'ok' | 'partial' | 'missing';
  detail?: string;
}
export interface VisitCompleteness {
  percent: number;
  items: CompletenessItem[];
  missing: string[];
}

const COMPLETENESS_LABEL: Record<CompletenessKey, string> = {
  interview: 'Wywiad przed wizytą',
  results: 'Wyniki badań',
  consent: 'Zgoda na udostępnienie danych',
  medications: 'Lista leków',
  measurements: 'Pomiary domowe',
};
const MISSING_LABEL: Record<CompletenessKey, string> = {
  interview: 'brak wywiadu',
  results: 'brak wyników',
  consent: 'brak zgody',
  medications: 'brak listy leków',
  measurements: 'brak pomiarów',
};

function interviewDone(patientRef: string, appointmentId: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM interview_session WHERE patient_ref = ? AND status = 'completed' AND (appointment_id = ? OR completed_at >= ?) LIMIT 1")
    .get(patientRef, appointmentId, new Date(Date.now() - 30 * 86_400_000).toISOString()) as { id: string } | undefined;
  return !!row;
}

/**
 * Pięć pól kompletności (wywiad, wyniki, zgoda, leki, pomiary) — tylko obecność danych, nie ich treść.
 * Wynik: procent i lista braków do pokazania przed wizytą (15 minut, z czego ~7 na wywiad).
 */
export async function visitCompleteness(appt: AppointmentView, prep?: VisitPrep): Promise<VisitCompleteness> {
  const patientRef = `Patient/${appt.patientId}`;
  const p = prep ?? (await prepFor(appt));
  const items: CompletenessItem[] = [];
  const questionnaire = await responseForAppointment(appt.id, patientRef).catch(() => undefined);
  items.push({ key: 'interview', label: COMPLETENESS_LABEL.interview, status: questionnaire || interviewDone(patientRef, appt.id) ? 'ok' : 'missing' });
  const labReqs = p.requirements.filter((r) => !r.optional);
  const resultsStatus: CompletenessItem['status'] = labReqs.length
    ? labReqs.every((r) => r.status === 'ready')
      ? 'ok'
      : labReqs.some((r) => r.status !== 'missing')
        ? 'partial'
        : 'missing'
    : p.requirements.some((r) => r.status === 'ready') || p.counts.uploaded > 0
      ? 'ok'
      : 'missing';
  items.push({ key: 'results', label: COMPLETENESS_LABEL.results, status: resultsStatus, detail: p.counts.toConfirm ? `${p.counts.toConfirm} do potwierdzenia` : undefined });
  items.push({ key: 'consent', label: COMPLETENESS_LABEL.consent, status: p.sharing === 'shared' ? 'ok' : p.sharing === 'invited' ? 'partial' : 'missing', detail: p.sharing === 'invited' ? 'zaproszenie wysłane' : p.sharing === 'withdrawn' ? 'zgoda wycofana lub wygasła' : undefined });
  const meds = await listMedications(patientRef).catch(() => []);
  items.push({ key: 'medications', label: COMPLETENESS_LABEL.medications, status: meds.length ? 'ok' : 'missing', detail: meds.length ? `${meds.length} na liście` : 'albo pacjent nie przyjmuje leków — potwierdź w rozmowie' });
  const shared = await hasConsent(patientRef, 'share-measurements').catch(() => false);
  let recent = 0;
  if (shared) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    recent = (await fhir().search<Observation>('Observation', { subject: patientRef, category: 'vital-signs', date: `ge${since}`, _count: '200' }).catch(() => [] as Observation[])).filter((o) => o.status !== 'entered-in-error').length;
  }
  items.push({ key: 'measurements', label: COMPLETENESS_LABEL.measurements, status: !shared ? 'missing' : recent ? 'ok' : 'partial', detail: !shared ? 'pacjent nie udostępnia pomiarów' : recent ? `${recent} z 30 dni` : 'brak z ostatnich 30 dni' });
  const score = items.reduce((a, i) => a + (i.status === 'ok' ? 1 : i.status === 'partial' ? 0.5 : 0), 0);
  return { percent: Math.round((score / items.length) * 100), items, missing: items.filter((i) => i.status !== 'ok').map((i) => MISSING_LABEL[i.key]) };
}

// --- kolejka ---------------------------------------------------------------------------------------------

export const QUEUE_BUCKETS = ['today', 'new', 'followup', 'urgent', 'action', 'missing'] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];
export type QueueKind = 'appointment' | 'message' | 'intake' | 'scribe' | 'rpm' | 'result' | 'grant' | 'task';

export interface QueueItem {
  key: string;
  kind: QueueKind;
  buckets: QueueBucket[];
  patientId: string;
  patientName: string;
  title: string;
  detail?: string;
  at: string;
  link: string;
  source: CaseSource;
  sourceRef: string;
  case?: CaseView;
  completeness?: VisitCompleteness;
  appointment?: Pick<AppointmentView, 'id' | 'start' | 'serviceName' | 'mode' | 'status' | 'practitionerName'>;
}

export interface WorkspaceQueue {
  date: string;
  scope: 'mine' | 'all';
  counts: Record<QueueBucket, number>;
  items: QueueItem[];
  rule: string;
}

function patientNameOf(p: Patient | undefined): string {
  const n = p?.name?.[0];
  return n ? `${(n.given ?? []).join(' ')} ${n.family ?? ''}`.trim() : '—';
}

const ACTIVE = ['booked', 'arrived', 'checked-in', 'pending'];

export async function workspaceQueue(user: AppUser, actor: AuditActor, opts: { practitionerId?: string; now?: Date } = {}): Promise<WorkspaceQueue> {
  const orgId = requireOrg(user);
  const tz = config.clinic.timezone;
  const now = opts.now ?? new Date();
  const today = localDate(now, tz);
  const from = zonedToUtc(today, '00:00', tz).toISOString();
  const weekEnd = zonedToUtc(addDays(today, 8), '00:00', tz).toISOString();
  const todayEnd = zonedToUtc(addDays(today, 1), '00:00', tz).toISOString();
  const recentSince = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const items: QueueItem[] = [];
  const names = new Map<string, string>();
  const nameOf = async (patientId: string, fallback?: string): Promise<string> => {
    if (fallback) names.set(patientId, fallback);
    if (names.has(patientId)) return names.get(patientId)!;
    const p = await fhir().readOptional<Patient>('Patient', patientId).catch(() => undefined);
    const n = patientNameOf(p);
    names.set(patientId, n);
    return n;
  };

  // 1. wizyty: dziś + 7 dni (braki danych)
  const appts = (await listAppointmentsInRange(from, weekEnd, opts.practitionerId)).filter((a) => ACTIVE.includes(a.status) && a.patientId);
  for (const a of appts) {
    const isToday = a.start < todayEnd;
    const prep = await prepFor(a, orgId);
    const completeness = await visitCompleteness(a, prep);
    const buckets: QueueBucket[] = [];
    if (isToday) buckets.push('today');
    if (completeness.missing.length) buckets.push('missing');
    // pierwsza wizyta w placówce = nowy pacjent (fakt z kalendarza, nie ocena)
    const history = await listPatientAppointments(`Patient/${a.patientId}`).catch(() => [] as AppointmentView[]);
    if (!history.some((h) => h.status === 'fulfilled' && h.start < a.start)) buckets.push('new');
    if (!buckets.length) continue;
    items.push({
      key: `appointment:${a.id}`,
      kind: 'appointment',
      buckets,
      patientId: a.patientId!,
      patientName: await nameOf(a.patientId!, a.patientName),
      title: isToday ? 'Wizyta dziś' : 'Nadchodząca wizyta',
      detail: [a.serviceName, a.mode === 'tele' ? 'teleporada' : undefined, completeness.missing.length ? `braki: ${completeness.missing.join(', ')}` : undefined].filter(Boolean).join(' · '),
      at: a.start,
      link: `/panel/wizyta/${a.id}`,
      source: 'appointment',
      sourceRef: `Appointment/${a.id}`,
      completeness,
      appointment: { id: a.id, start: a.start, serviceName: a.serviceName, mode: a.mode, status: a.status, practitionerName: a.practitionerName },
    });
  }

  // 2. wiadomości od pacjentów bez odpowiedzi
  for (const th of (await listThreadsForStaff()).filter((x) => x.unread && x.lastFrom === 'patient').slice(0, 50)) {
    items.push({
      key: `message:${th.id}`,
      kind: 'message',
      buckets: ['action'],
      patientId: th.patientId,
      patientName: await nameOf(th.patientId, th.patientName),
      title: 'Wiadomość od pacjenta',
      detail: th.subject,
      at: th.lastMessageAt,
      link: `/panel/wiadomosci/${th.id}`,
      source: 'message',
      sourceRef: `Communication/${th.id}`,
    });
  }

  // 3. dokumenty od pacjentów z odczytami do potwierdzenia (tylko przy aktywnym udostępnieniu tej placówce)
  const grants = listGrantsForOrg(orgId);
  const grantPatients = new Set(grants.map((g) => g.patientRef));
  for (const it of listIntake({ since: new Date(now.getTime() - 30 * 86_400_000).toISOString() }).filter((r) => r.status === 'submitted' && (r.org_id === orgId || (r.source === 'app' && grantPatients.has(r.patient_ref))))) {
    const pid = idFromRef(it.patient_ref);
    items.push({
      key: `intake:${it.id}`,
      kind: 'intake',
      buckets: ['action'],
      patientId: pid,
      patientName: await nameOf(pid),
      title: 'Odczyty dokumentu do potwierdzenia',
      detail: it.filename ?? undefined,
      at: it.updated_at,
      link: it.appointment_id ? `/panel/wizyta/${it.appointment_id}` : `/panel/pacjenci/${pid}`,
      source: 'intake',
      sourceRef: `urn:eternal:intake:${it.id}`,
    });
  }

  // 4. nowe wyniki wprowadzone w placówce (3 dni) — oznaczenia wyłącznie z dokumentu laboratorium
  const reports = await fhir().search<DiagnosticReport>('DiagnosticReport', { _lastUpdated: `ge${recentSince}`, _count: '200' }).catch(() => [] as DiagnosticReport[]);
  for (const r of reports) {
    const pid = idFromRef(r.subject?.reference);
    if (!pid) continue;
    const obsIds = (r.result ?? []).map((x) => idFromRef(x.reference)).filter(Boolean);
    const obs = obsIds.length ? await fhir().search<Observation>('Observation', { _id: obsIds.join(','), _count: '200' }).catch(() => [] as Observation[]) : [];
    const flagged = obs.filter((o) => o.interpretation?.[0]?.coding?.[0]?.code && !['N', 'normal'].includes(o.interpretation[0].coding![0].code!)).length;
    items.push({
      key: `result:${r.id}`,
      kind: 'result',
      buckets: ['action'],
      patientId: pid,
      patientName: await nameOf(pid),
      title: 'Nowy wynik w dokumentacji',
      detail: [r.code.text, flagged ? `${flagged} z oznaczeniem laboratorium` : undefined].filter(Boolean).join(' · '),
      at: r.meta?.lastUpdated ?? r.effectiveDateTime ?? nowIso(),
      link: `/panel/pacjenci/${pid}`,
      source: 'result',
      sourceRef: `DiagnosticReport/${r.id}`,
    });
  }

  // 5. pomiary z telemonitoringu (24 h) — liczba odczytów, bez progów i bez oceny
  const rpmSince = new Date(now.getTime() - 86_400_000).toISOString();
  const rpmObs = (await fhir().search<Observation>('Observation', { category: 'vital-signs', _lastUpdated: `ge${rpmSince}`, _count: '1000' }).catch(() => [] as Observation[])).filter((o) =>
    o.meta?.tag?.some((t) => t.system === ETERNAL.source && (t.code ?? '').startsWith('rpm:')),
  );
  const rpmBy = new Map<string, Observation[]>();
  for (const o of rpmObs) {
    const pid = idFromRef(o.subject?.reference);
    if (pid) rpmBy.set(pid, [...(rpmBy.get(pid) ?? []), o]);
  }
  for (const [pid, list] of rpmBy) {
    items.push({
      key: `rpm:${pid}:${today}`,
      kind: 'rpm',
      buckets: ['action'],
      patientId: pid,
      patientName: await nameOf(pid),
      title: 'Nowe pomiary z telemonitoringu',
      detail: `${list.length} odczytów z 24 godzin`,
      at: list.map((o) => o.meta?.lastUpdated ?? '').sort().at(-1) ?? nowIso(),
      link: `/panel/pacjenci/${pid}`,
      source: 'rpm',
      sourceRef: `rpm:${pid}:${today}`,
    });
  }

  // 6. szkice notatek Scribe tego lekarza do zatwierdzenia
  const drafts = getDb().prepare("SELECT id, patient_ref, appointment_id, draft_ready_at FROM scribe_session WHERE org_id = ? AND practitioner_user_id = ? AND status = 'draft'").all(orgId, user.id) as {
    id: string;
    patient_ref: string;
    appointment_id: string | null;
    draft_ready_at: string | null;
  }[];
  for (const d of drafts) {
    const pid = idFromRef(d.patient_ref);
    items.push({
      key: `scribe:${d.id}`,
      kind: 'scribe',
      buckets: ['action'],
      patientId: pid,
      patientName: await nameOf(pid),
      title: 'Notatka z wizyty do zatwierdzenia',
      detail: 'AI przygotowało szkic — dokumentacją staje się dopiero po zatwierdzeniu',
      at: d.draft_ready_at ?? nowIso(),
      link: d.appointment_id ? `/panel/wizyta/${d.appointment_id}` : `/panel/pacjenci/${pid}`,
      source: 'scribe',
      sourceRef: `urn:eternal:scribe:${d.id}`,
    });
  }

  // 7. nowe udostępnienia danych (7 dni)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  for (const g of grants.filter((x) => x.createdAt >= weekAgo && x.purpose !== 'emergency' && x.status === 'active')) {
    const pid = idFromRef(g.patientRef);
    items.push({
      key: `grant:${g.id}`,
      kind: 'grant',
      buckets: ['new'],
      patientId: pid,
      patientName: await nameOf(pid),
      title: 'Pacjent udostępnił dane placówce',
      detail: g.recipient,
      at: g.createdAt,
      link: `/panel/pacjenci/${pid}`,
      source: 'grant',
      sourceRef: `urn:eternal:grant:${g.id}`,
    });
  }

  // 8. sprawy — dołącz do pozycji o tym samym źródle albo pokaż jako zadania
  const cases = listCases(user);
  const bySource = new Map(cases.filter((c) => c.sourceRef).map((c) => [`${c.source}|${c.sourceRef}`, c]));
  const attached = new Set<string>();
  for (const it of items) {
    const c = bySource.get(`${it.source}|${it.sourceRef}`);
    if (!c) continue;
    it.case = c;
    attached.add(c.id);
  }
  for (const c of cases.filter((x) => !attached.has(x.id))) {
    items.push({
      key: `case:${c.id}`,
      kind: 'task',
      buckets: [],
      patientId: c.patientId,
      patientName: await nameOf(c.patientId),
      title: c.title,
      detail: c.note,
      at: c.dueDate ? `${c.dueDate}T08:00:00.000Z` : c.createdAt,
      link: `/panel/pacjenci/${c.patientId}`,
      source: c.source,
      sourceRef: c.sourceRef ?? `urn:eternal:case:${c.id}`,
      case: c,
    });
  }
  for (const it of items) {
    const c = it.case;
    if (!c) continue;
    const add = (b: QueueBucket) => !it.buckets.includes(b) && it.buckets.push(b);
    if (c.status === 'new') add('new');
    if (c.status === 'incomplete') add('missing');
    if (c.status === 'analysis' || c.status === 'doctor') add('action');
    if (c.status === 'follow-up') add('followup');
    if (c.priority === 'urgent') add('urgent');
    if (c.dueDate && c.dueDate <= today) add('today');
    if (c.status === 'closed') it.buckets = [];
  }
  for (const c of cases) if (c.patientName === undefined) c.patientName = names.get(c.patientId);

  const visible = items.filter((i) => i.buckets.length);
  visible.sort((a, b) => a.at.localeCompare(b.at));
  const counts = Object.fromEntries(QUEUE_BUCKETS.map((b) => [b, visible.filter((i) => i.buckets.includes(b)).length])) as Record<QueueBucket, number>;
  audit(actor, { action: 'R', subtype: 'workspace-queue', detail: { items: visible.length } });
  return {
    date: today,
    scope: opts.practitionerId ? 'mine' : 'all',
    counts,
    items: visible,
    rule: 'Kolejka według terminu i czasu zdarzenia. „Pilne” nadaje wyłącznie personel — aplikacja nie ocenia stanu pacjenta.',
  };
}
