import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { findUserById, type AppUser } from '../auth/users.js';
import { config } from '../config.js';
import { PHYSICIAN_PROFESSIONS } from '../content/clinicProfiles.js';
import { getDb } from '../db.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { localDate } from '../lib/time.js';
import { badRequest, conflict, forbidden, newId, notFound, nowIso } from '../lib/util.js';
import { runInScope } from '../tenancy.js';
import { getClinicSettings, listPractitioners, type PractitionerView } from './directory.js';
import { notifyPatient } from './notifications.js';

/**
 * Podstawowa opieka zdrowotna (profil POZ): deklaracje wyboru, opieka koordynowana z Indywidualnym Planem Opieki
 * Medycznej (IPOM) i bilans zdrowia osoby dorosłej „Moje Zdrowie”.
 *
 * - Deklaracje: rejestr i statusy w placówce (papierowe i złożone w IKP). Zgłoszenie do NFZ robi system rozliczeniowy.
 * - IPOM układa lekarz POZ; koordynator pilnuje terminów. Limity porad ustawia placówka według zarządzenia NFZ —
 *   aplikacja liczy wykorzystanie, nie decyduje o kwalifikacji.
 * - Bilans „Moje Zdrowie”: 20–49 lat co 5 lat, od 50 lat co 3 lata, wiek liczony rocznikowo (gov.pl, 2026).
 *   Wynik jest orientacyjny — uprawnienie potwierdza IKP. Aplikacja nie dobiera badań.
 */

export type DeclKind = 'lekarz' | 'pielegniarka' | 'polozna';
export type DeclSource = 'papier' | 'ikp';
export type DeclStatus = 'zlozona' | 'przyjeta' | 'odrzucona' | 'wycofana' | 'zastapiona';
export const DECL_KINDS: DeclKind[] = ['lekarz', 'pielegniarka', 'polozna'];

interface DeclRow {
  id: string;
  org_id: string;
  patient_ref: string;
  kind: DeclKind;
  practitioner_id: string;
  source: DeclSource;
  status: DeclStatus;
  reason: string | null;
  submitted_on: string;
  decided_at: string | null;
  decided_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeclarationView {
  id: string;
  patientId: string;
  patientName: string;
  kind: DeclKind;
  practitionerId: string;
  practitionerName: string;
  source: DeclSource;
  status: DeclStatus;
  reason?: string;
  submittedOn: string;
  decidedAt?: string;
  decidedBy?: string;
}

const PROFESSION_OF: Record<DeclKind, string> = { lekarz: 'lekarz', pielegniarka: 'pielegniarka', polozna: 'polozna' };

function today(): string {
  return localDate(new Date(), config.clinic.timezone);
}

export function patientName(p: Patient | undefined): string {
  const n = p?.name?.[0];
  return n ? `${(n.given ?? []).join(' ')} ${n.family ?? ''}`.trim() : '—';
}

async function names(refs: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const ref of [...new Set(refs)]) out.set(ref, patientName(await fhirSystem().readOptional<Patient>('Patient', ref.split('/')[1] ?? '')));
  return out;
}

async function practitionersOf(orgId: string): Promise<Map<string, PractitionerView>> {
  const list = await runInScope({ orgId }, () => listPractitioners(true));
  return new Map(list.map((p) => [p.id, p]));
}

async function declViews(rows: DeclRow[], orgId: string): Promise<DeclarationView[]> {
  const pn = await names(rows.map((r) => r.patient_ref));
  const pr = await practitionersOf(orgId);
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_ref.split('/')[1] ?? '',
    patientName: pn.get(r.patient_ref) ?? '—',
    kind: r.kind,
    practitionerId: r.practitioner_id,
    practitionerName: pr.get(r.practitioner_id)?.name ?? '—',
    source: r.source,
    status: r.status,
    reason: r.reason ?? undefined,
    submittedOn: r.submitted_on,
    decidedAt: r.decided_at ?? undefined,
    decidedBy: r.decided_by ?? undefined,
  }));
}

export async function createDeclaration(
  actor: AuditActor,
  orgId: string,
  input: { patientId: string; kind: DeclKind; practitionerId: string; source: DeclSource; submittedOn?: string },
): Promise<DeclarationView> {
  const patient = await fhir().readOptional<Patient>('Patient', input.patientId);
  if (!patient) throw notFound('patient_not_found');
  const pr = (await practitionersOf(orgId)).get(input.practitionerId);
  if (!pr) throw badRequest('practitioner_not_found');
  // osoba wskazana w deklaracji musi wykonywać zawód tego rodzaju deklaracji (jeśli zawód jest uzupełniony)
  if (pr.profession && pr.profession !== PROFESSION_OF[input.kind]) throw badRequest('practitioner_profession_mismatch');
  const patientRef = `Patient/${patient.id}`;
  const open = getDb()
    .prepare("SELECT id FROM poz_declaration WHERE org_id = ? AND patient_ref = ? AND kind = ? AND status = 'zlozona'")
    .get(orgId, patientRef, input.kind);
  if (open) throw conflict('declaration_pending');
  const submittedOn = input.submittedOn ?? today();
  if (submittedOn > today()) throw badRequest('invalid_date');
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO poz_declaration (id, org_id, patient_ref, kind, practitioner_id, source, status, submitted_on, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'zlozona', ?, ?, ?, ?)`,
    )
    .run(id, orgId, patientRef, input.kind, input.practitionerId, input.source, submittedOn, actor.display ?? null, now, now);
  audit(actor, { action: 'C', subtype: 'poz-declaration', patientRef, detail: { id, kind: input.kind, source: input.source } });
  return (await declViews([declRow(id)!], orgId))[0];
}

function declRow(id: string): DeclRow | undefined {
  return getDb().prepare('SELECT * FROM poz_declaration WHERE id = ?').get(id) as DeclRow | undefined;
}

export async function decideDeclaration(
  actor: AuditActor,
  orgId: string,
  id: string,
  input: { action: 'accept' | 'reject' | 'withdraw'; reason?: string },
): Promise<DeclarationView> {
  const row = declRow(id);
  if (!row || row.org_id !== orgId) throw notFound('declaration_not_found');
  const reason = input.reason?.trim().slice(0, 300) || null;
  const now = nowIso();
  if (input.action === 'accept') {
    if (row.status !== 'zlozona') throw conflict('declaration_not_pending');
    // nowa deklaracja tego samego rodzaju w placówce zastępuje poprzednią (zmiana lekarza, pielęgniarki, położnej)
    getDb()
      .prepare("UPDATE poz_declaration SET status = 'zastapiona', updated_at = ? WHERE org_id = ? AND patient_ref = ? AND kind = ? AND status = 'przyjeta'")
      .run(now, orgId, row.patient_ref, row.kind);
    getDb().prepare("UPDATE poz_declaration SET status = 'przyjeta', decided_at = ?, decided_by = ?, updated_at = ? WHERE id = ?").run(now, actor.display ?? null, now, id);
  } else if (input.action === 'reject') {
    if (row.status !== 'zlozona') throw conflict('declaration_not_pending');
    if (!reason) throw badRequest('reason_required');
    getDb().prepare("UPDATE poz_declaration SET status = 'odrzucona', reason = ?, decided_at = ?, decided_by = ?, updated_at = ? WHERE id = ?").run(reason, now, actor.display ?? null, now, id);
  } else {
    if (!['zlozona', 'przyjeta'].includes(row.status)) throw conflict('declaration_not_active');
    getDb().prepare("UPDATE poz_declaration SET status = 'wycofana', reason = ?, decided_at = ?, decided_by = ?, updated_at = ? WHERE id = ?").run(reason, now, actor.display ?? null, now, id);
  }
  audit(actor, { action: 'U', subtype: `poz-declaration-${input.action}`, patientRef: row.patient_ref, detail: { id, kind: row.kind } });
  return (await declViews([declRow(id)!], orgId))[0];
}

export async function listDeclarations(
  actor: AuditActor,
  orgId: string,
  filter: { status?: DeclStatus; kind?: DeclKind; patientId?: string } = {},
): Promise<{ items: DeclarationView[]; active: { practitionerId: string; practitionerName: string; kind: DeclKind; count: number }[] }> {
  const where = ['org_id = ?'];
  const args: string[] = [orgId];
  if (filter.status) (where.push('status = ?'), args.push(filter.status));
  if (filter.kind) (where.push('kind = ?'), args.push(filter.kind));
  if (filter.patientId) (where.push('patient_ref = ?'), args.push(`Patient/${filter.patientId}`));
  const rows = getDb().prepare(`SELECT * FROM poz_declaration WHERE ${where.join(' AND ')} ORDER BY submitted_on DESC, created_at DESC LIMIT 500`).all(...args) as unknown as DeclRow[];
  const items = await declViews(rows, orgId);
  audit(actor, { action: 'R', subtype: 'poz-declarations', detail: { count: items.length, ...filter } });
  const counts = getDb()
    .prepare("SELECT practitioner_id, kind, COUNT(*) AS n FROM poz_declaration WHERE org_id = ? AND status = 'przyjeta' GROUP BY practitioner_id, kind")
    .all(orgId) as { practitioner_id: string; kind: DeclKind; n: number }[];
  const pr = await practitionersOf(orgId);
  return { items, active: counts.map((c) => ({ practitionerId: c.practitioner_id, practitionerName: pr.get(c.practitioner_id)?.name ?? '—', kind: c.kind, count: Number(c.n) })) };
}

/** Lista aktywna placówki: pacjenci z przyjętą deklaracją do lekarza POZ. */
function declaredPatients(orgId: string): string[] {
  return (getDb().prepare("SELECT DISTINCT patient_ref FROM poz_declaration WHERE org_id = ? AND kind = 'lekarz' AND status = 'przyjeta'").all(orgId) as { patient_ref: string }[]).map((r) => r.patient_ref);
}

// --- Opieka koordynowana: IPOM -------------------------------------------------------------------------------------

export const IPOM_GROUPS: Record<string, string> = {
  nadcisnienie: 'Nadciśnienie tętnicze',
  'niewydolnosc-serca': 'Przewlekła niewydolność serca',
  'migotanie-przedsionkow': 'Migotanie przedsionków',
  'choroba-wiencowa': 'Przewlekły zespół wieńcowy',
  'cukrzyca-2': 'Cukrzyca typu 2',
  'stan-przedcukrzycowy': 'Stan przedcukrzycowy',
  'niedoczynnosc-tarczycy': 'Niedoczynność tarczycy',
  'guzki-tarczycy': 'Guzki tarczycy',
  astma: 'Astma',
  pochp: 'POChP',
  'choroba-nerek': 'Przewlekła choroba nerek',
  inna: 'Inna choroba przewlekła (opis w planie)',
};
export const IPOM_KINDS = ['wizyta', 'badanie', 'konsultacja', 'edukacja', 'dietetyk'] as const;
export type IpomKind = (typeof IPOM_KINDS)[number];
export type IpomItemStatus = 'zaplanowane' | 'zrealizowane' | 'odwolane';

interface PlanRow {
  id: string;
  org_id: string;
  patient_ref: string;
  groups: string;
  coordinator_user_id: string | null;
  author_user_id: string;
  author_name: string | null;
  status: 'aktywny' | 'zakonczony';
  note: string | null;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  plan_id: string;
  kind: IpomKind;
  title: string;
  due_on: string | null;
  status: IpomItemStatus;
  done_on: string | null;
  done_by: string | null;
  note: string | null;
  patient_notified_at: string | null;
  created_at: string;
}

export interface IpomItemView {
  id: string;
  kind: IpomKind;
  title: string;
  dueOn?: string;
  status: IpomItemStatus;
  overdue: boolean;
  doneOn?: string;
  doneBy?: string;
  note?: string;
}

export interface IpomView {
  id: string;
  patientId: string;
  patientName: string;
  groups: string[];
  coordinator?: { userId: string; name: string };
  author?: string;
  status: PlanRow['status'];
  note?: string;
  validFrom: string;
  items: IpomItemView[];
  /** Wykorzystanie w bieżącym roku wobec limitu ustawionego przez placówkę (brak limitu = tylko liczba). */
  usage: { kind: IpomKind; done: number; planned: number; limit?: number }[];
}

function itemView(i: ItemRow, day: string, staff: boolean): IpomItemView {
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    dueOn: i.due_on ?? undefined,
    status: i.status,
    overdue: i.status === 'zaplanowane' && !!i.due_on && i.due_on < day,
    doneOn: i.done_on ?? undefined,
    doneBy: staff ? (i.done_by ?? undefined) : undefined,
    note: staff ? (i.note ?? undefined) : undefined,
  };
}

function planRow(id: string): PlanRow | undefined {
  return getDb().prepare('SELECT * FROM ipom_plan WHERE id = ?').get(id) as PlanRow | undefined;
}

function itemsOf(planId: string): ItemRow[] {
  return getDb().prepare('SELECT * FROM ipom_item WHERE plan_id = ? ORDER BY COALESCE(due_on, \'9999\'), created_at').all(planId) as unknown as ItemRow[];
}

async function planView(p: PlanRow, staff: boolean): Promise<IpomView> {
  const day = today();
  const year = day.slice(0, 4);
  const items = itemsOf(p.id);
  const limits = getClinicSettings(p.org_id).ipomLimits ?? {};
  const coordinator = p.coordinator_user_id ? findUserById(p.coordinator_user_id) : undefined;
  const pn = await names([p.patient_ref]);
  return {
    id: p.id,
    patientId: p.patient_ref.split('/')[1] ?? '',
    patientName: pn.get(p.patient_ref) ?? '—',
    groups: JSON.parse(p.groups) as string[],
    coordinator: coordinator ? { userId: coordinator.id, name: coordinator.display_name } : undefined,
    author: p.author_name ?? undefined,
    status: p.status,
    note: staff ? (p.note ?? undefined) : undefined,
    validFrom: p.valid_from,
    items: items.map((i) => itemView(i, day, staff)),
    usage: IPOM_KINDS.map((kind) => ({
      kind,
      done: items.filter((i) => i.kind === kind && i.status === 'zrealizowane' && (i.done_on ?? '').startsWith(year)).length,
      planned: items.filter((i) => i.kind === kind && i.status === 'zaplanowane').length,
      limit: limits[kind],
    })).filter((u) => u.done || u.planned || u.limit !== undefined),
  };
}

function cleanItems(items: { kind: IpomKind; title: string; dueOn?: string }[]): { kind: IpomKind; title: string; dueOn?: string }[] {
  return items.map((i) => {
    const title = i.title.trim().slice(0, 200);
    if (!title) throw badRequest('title_required');
    if (i.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(i.dueOn)) throw badRequest('invalid_date');
    return { kind: i.kind, title, dueOn: i.dueOn };
  });
}

async function requirePhysician(user: AppUser, orgId: string): Promise<void> {
  const prId = user.fhir_ref?.startsWith('Practitioner/') ? user.fhir_ref.split('/')[1] : undefined;
  const pr = prId ? (await practitionersOf(orgId)).get(prId) : undefined;
  // zawód nieuzupełniony — rola „lekarz” w koncie wystarcza; uzupełniony inny niż lekarz — odmowa
  if (pr?.profession && !PHYSICIAN_PROFESSIONS.includes(pr.profession)) throw forbidden('physician_required');
}

export async function createPlan(
  user: AppUser,
  actor: AuditActor,
  orgId: string,
  input: { patientId: string; groups: string[]; coordinatorUserId?: string | null; note?: string; items: { kind: IpomKind; title: string; dueOn?: string }[] },
): Promise<IpomView> {
  await requirePhysician(user, orgId);
  const patient = await fhir().readOptional<Patient>('Patient', input.patientId);
  if (!patient) throw notFound('patient_not_found');
  const groups = [...new Set(input.groups)].filter((g) => g in IPOM_GROUPS);
  if (!groups.length) throw badRequest('groups_required');
  if (input.coordinatorUserId) {
    const c = findUserById(input.coordinatorUserId);
    if (!c || c.org_id !== user.org_id) throw badRequest('coordinator_not_found');
  }
  const items = cleanItems(input.items);
  const patientRef = `Patient/${patient.id}`;
  const id = newId();
  const now = nowIso();
  const db = getDb();
  // jeden aktywny IPOM pacjenta w placówce — nowy plan zamyka poprzedni
  db.prepare("UPDATE ipom_plan SET status = 'zakonczony', valid_to = ?, updated_at = ? WHERE org_id = ? AND patient_ref = ? AND status = 'aktywny'").run(today(), now, orgId, patientRef);
  db.prepare(
    `INSERT INTO ipom_plan (id, org_id, patient_ref, groups, coordinator_user_id, author_user_id, author_name, status, note, valid_from, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'aktywny', ?, ?, ?, ?)`,
  ).run(id, orgId, patientRef, JSON.stringify(groups), input.coordinatorUserId ?? null, user.id, user.display_name, input.note?.trim().slice(0, 2000) || null, today(), now, now);
  for (const i of items) {
    db.prepare("INSERT INTO ipom_item (id, plan_id, kind, title, due_on, status, created_at) VALUES (?, ?, ?, ?, ?, 'zaplanowane', ?)").run(newId(), id, i.kind, i.title, i.dueOn ?? null, now);
  }
  audit(actor, { action: 'C', subtype: 'ipom', patientRef, detail: { id, groups, items: items.length } });
  return planView(planRow(id)!, true);
}

function ownPlan(orgId: string, id: string): PlanRow {
  const p = planRow(id);
  if (!p || p.org_id !== orgId) throw notFound('ipom_not_found');
  return p;
}

export async function addPlanItem(actor: AuditActor, orgId: string, planId: string, input: { kind: IpomKind; title: string; dueOn?: string }): Promise<IpomView> {
  const p = ownPlan(orgId, planId);
  if (p.status !== 'aktywny') throw conflict('ipom_closed');
  const [i] = cleanItems([input]);
  getDb().prepare("INSERT INTO ipom_item (id, plan_id, kind, title, due_on, status, created_at) VALUES (?, ?, ?, ?, ?, 'zaplanowane', ?)").run(newId(), planId, i.kind, i.title, i.dueOn ?? null, nowIso());
  getDb().prepare('UPDATE ipom_plan SET updated_at = ? WHERE id = ?').run(nowIso(), planId);
  audit(actor, { action: 'U', subtype: 'ipom-item-add', patientRef: p.patient_ref, detail: { plan: planId, kind: i.kind } });
  return planView(planRow(planId)!, true);
}

export async function updatePlanItem(
  actor: AuditActor,
  orgId: string,
  planId: string,
  itemId: string,
  input: { status?: IpomItemStatus; doneOn?: string; dueOn?: string | null; note?: string },
): Promise<IpomView> {
  const p = ownPlan(orgId, planId);
  const item = (getDb().prepare('SELECT * FROM ipom_item WHERE id = ? AND plan_id = ?').get(itemId, planId) as ItemRow | undefined) ?? undefined;
  if (!item) throw notFound('ipom_item_not_found');
  if (input.doneOn && (!/^\d{4}-\d{2}-\d{2}$/.test(input.doneOn) || input.doneOn > today())) throw badRequest('invalid_date');
  if (input.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) throw badRequest('invalid_date');
  const status = input.status ?? item.status;
  const doneOn = status === 'zrealizowane' ? (input.doneOn ?? item.done_on ?? today()) : null;
  getDb()
    .prepare('UPDATE ipom_item SET status = ?, done_on = ?, done_by = ?, due_on = ?, note = ?, patient_notified_at = CASE WHEN ? IS NOT due_on THEN NULL ELSE patient_notified_at END WHERE id = ?')
    .run(
      status,
      doneOn,
      status === 'zrealizowane' ? (actor.display ?? null) : null,
      input.dueOn === undefined ? item.due_on : input.dueOn,
      input.note === undefined ? item.note : input.note.trim().slice(0, 500) || null,
      input.dueOn === undefined ? item.due_on : input.dueOn,
      itemId,
    );
  getDb().prepare('UPDATE ipom_plan SET updated_at = ? WHERE id = ?').run(nowIso(), planId);
  audit(actor, { action: 'U', subtype: 'ipom-item', patientRef: p.patient_ref, detail: { plan: planId, item: itemId, status } });
  return planView(planRow(planId)!, true);
}

export async function setCoordinator(user: AppUser, actor: AuditActor, orgId: string, planId: string, coordinatorUserId: string | null): Promise<IpomView> {
  const p = ownPlan(orgId, planId);
  if (coordinatorUserId) {
    const c = findUserById(coordinatorUserId);
    if (!c || c.org_id !== user.org_id) throw badRequest('coordinator_not_found');
  }
  getDb().prepare('UPDATE ipom_plan SET coordinator_user_id = ?, updated_at = ? WHERE id = ?').run(coordinatorUserId, nowIso(), planId);
  audit(actor, { action: 'U', subtype: 'ipom-coordinator', patientRef: p.patient_ref, detail: { plan: planId } });
  return planView(planRow(planId)!, true);
}

export async function closePlan(actor: AuditActor, orgId: string, planId: string): Promise<IpomView> {
  const p = ownPlan(orgId, planId);
  getDb().prepare("UPDATE ipom_plan SET status = 'zakonczony', valid_to = ?, updated_at = ? WHERE id = ?").run(today(), nowIso(), planId);
  audit(actor, { action: 'U', subtype: 'ipom-close', patientRef: p.patient_ref, detail: { plan: planId } });
  return planView(planRow(planId)!, true);
}

export async function planForPatient(actor: AuditActor, orgId: string, patientId: string): Promise<{ active?: IpomView; history: { id: string; validFrom: string; groups: string[] }[] }> {
  const patientRef = `Patient/${patientId}`;
  const rows = getDb().prepare('SELECT * FROM ipom_plan WHERE org_id = ? AND patient_ref = ? ORDER BY created_at DESC').all(orgId, patientRef) as unknown as PlanRow[];
  audit(actor, { action: 'R', subtype: 'ipom', patientRef });
  const active = rows.find((r) => r.status === 'aktywny');
  return {
    active: active ? await planView(active, true) : undefined,
    history: rows.filter((r) => r.status !== 'aktywny').map((r) => ({ id: r.id, validFrom: r.valid_from, groups: JSON.parse(r.groups) as string[] })),
  };
}

export interface PlanSummary {
  id: string;
  patientId: string;
  patientName: string;
  groups: string[];
  coordinator?: string;
  nextDue?: string;
  overdue: number;
  open: number;
}

export async function listPlans(actor: AuditActor, orgId: string, filter: { coordinatorUserId?: string; overdueOnly?: boolean } = {}): Promise<PlanSummary[]> {
  const day = today();
  const rows = getDb().prepare("SELECT * FROM ipom_plan WHERE org_id = ? AND status = 'aktywny' ORDER BY updated_at DESC").all(orgId) as unknown as PlanRow[];
  const pn = await names(rows.map((r) => r.patient_ref));
  const out: PlanSummary[] = [];
  for (const r of rows) {
    if (filter.coordinatorUserId && r.coordinator_user_id !== filter.coordinatorUserId) continue;
    const open = itemsOf(r.id).filter((i) => i.status === 'zaplanowane');
    const overdue = open.filter((i) => i.due_on && i.due_on < day).length;
    if (filter.overdueOnly && !overdue) continue;
    out.push({
      id: r.id,
      patientId: r.patient_ref.split('/')[1] ?? '',
      patientName: pn.get(r.patient_ref) ?? '—',
      groups: JSON.parse(r.groups) as string[],
      coordinator: r.coordinator_user_id ? findUserById(r.coordinator_user_id)?.display_name : undefined,
      nextDue: open.map((i) => i.due_on).filter((d): d is string => !!d).sort()[0],
      overdue,
      open: open.length,
    });
  }
  audit(actor, { action: 'R', subtype: 'ipom-list', detail: { count: out.length } });
  return out.sort((a, b) => b.overdue - a.overdue || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999'));
}

// --- Bilans zdrowia osoby dorosłej „Moje Zdrowie” ------------------------------------------------------------------

export const BZOD = {
  minAge: 20,
  rule: '20–49 lat: co 5 lat; od 50 lat: co 3 lata (wiek liczony rocznikowo). Ankieta w IKP albo w przychodni.',
  source: 'gov.pl — program „Moje Zdrowie” (bilans zdrowia osoby dorosłej), sprawdzono 2026-11',
  /** Internetowe Konto Pacjenta — ankieta programu jest dostępna po zalogowaniu. */
  ikpUrl: 'https://pacjent.gov.pl',
};

export interface BzodEligibility {
  age?: number;
  intervalYears?: number;
  lastDone?: string;
  eligibleNow: boolean;
  nextYear?: number;
  reason: 'brak-daty-urodzenia' | 'za-mlody' | 'mozna-teraz' | 'po-bilansie';
}

/** Orientacyjne uprawnienie (rocznikowo): ostatecznie potwierdza IKP. */
export function bzodEligibility(birthDate: string | undefined, lastDone: string | undefined, day: string = today()): BzodEligibility {
  if (!birthDate) return { eligibleNow: false, reason: 'brak-daty-urodzenia', lastDone };
  const year = Number(day.slice(0, 4));
  const age = year - Number(birthDate.slice(0, 4));
  if (age < BZOD.minAge) return { age, eligibleNow: false, nextYear: Number(birthDate.slice(0, 4)) + BZOD.minAge, reason: 'za-mlody', lastDone };
  const interval = age >= 50 ? 3 : 5;
  if (!lastDone) return { age, intervalYears: interval, eligibleNow: true, reason: 'mozna-teraz' };
  const next = Number(lastDone.slice(0, 4)) + interval;
  return next <= year
    ? { age, intervalYears: interval, lastDone, eligibleNow: true, reason: 'mozna-teraz' }
    : { age, intervalYears: interval, lastDone, eligibleNow: false, nextYear: next, reason: 'po-bilansie' };
}

function lastBzod(patientRef: string): string | undefined {
  return (getDb().prepare("SELECT MAX(done_on) AS d FROM program_visit WHERE patient_ref = ? AND program = 'bzod'").get(patientRef) as { d: string | null }).d ?? undefined;
}

export async function bzodList(actor: AuditActor, orgId: string): Promise<{ rule: string; source: string; items: ({ patientId: string; patientName: string; birthDate?: string } & BzodEligibility)[] }> {
  const refs = declaredPatients(orgId);
  const items: ({ patientId: string; patientName: string; birthDate?: string } & BzodEligibility)[] = [];
  for (const ref of refs) {
    const p = await fhirSystem().readOptional<Patient>('Patient', ref.split('/')[1] ?? '');
    if (!p) continue;
    items.push({ patientId: p.id ?? '', patientName: patientName(p), birthDate: p.birthDate, ...bzodEligibility(p.birthDate, lastBzod(ref)) });
  }
  audit(actor, { action: 'R', subtype: 'bzod-list', detail: { count: items.length } });
  items.sort((a, b) => Number(b.eligibleNow) - Number(a.eligibleNow) || a.patientName.localeCompare(b.patientName, 'pl'));
  return { rule: BZOD.rule, source: BZOD.source, items };
}

export async function recordBzod(actor: AuditActor, orgId: string, patientId: string, doneOn: string): Promise<BzodEligibility> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doneOn) || doneOn > today()) throw badRequest('invalid_date');
  const p = await fhir().readOptional<Patient>('Patient', patientId);
  if (!p) throw notFound('patient_not_found');
  const ref = `Patient/${p.id}`;
  getDb().prepare("INSERT INTO program_visit (id, org_id, patient_ref, program, done_on, recorded_by, created_at) VALUES (?, ?, ?, 'bzod', ?, ?, ?)").run(newId(), orgId, ref, doneOn, actor.display ?? null, nowIso());
  audit(actor, { action: 'C', subtype: 'bzod-done', patientRef: ref, detail: { doneOn } });
  return bzodEligibility(p.birthDate, lastBzod(ref));
}

// --- widok pacjenta -----------------------------------------------------------------------------------------------

export async function pozForPatient(patientRef: string): Promise<{
  declarations: { id: string; kind: DeclKind; practitionerName: string; clinic: string; status: DeclStatus; submittedOn: string; source: DeclSource; reason?: string }[];
  plans: (IpomView & { clinic: string })[];
  bzod: BzodEligibility & { rule: string; source: string; ikpUrl: string };
}> {
  const rows = getDb().prepare("SELECT * FROM poz_declaration WHERE patient_ref = ? AND status IN ('zlozona', 'przyjeta', 'odrzucona') ORDER BY submitted_on DESC").all(patientRef) as unknown as DeclRow[];
  const declarations = [];
  for (const r of rows) {
    const pr = (await practitionersOf(r.org_id)).get(r.practitioner_id);
    declarations.push({ id: r.id, kind: r.kind, practitionerName: pr?.name ?? '—', clinic: getClinicSettings(r.org_id).name, status: r.status, submittedOn: r.submitted_on, source: r.source, reason: r.reason ?? undefined });
  }
  const planRows = getDb().prepare("SELECT * FROM ipom_plan WHERE patient_ref = ? AND status = 'aktywny'").all(patientRef) as unknown as PlanRow[];
  const plans = [];
  for (const p of planRows) plans.push({ ...(await planView(p, false)), clinic: getClinicSettings(p.org_id).name });
  const patient = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
  return { declarations, plans, bzod: { ...bzodEligibility(patient?.birthDate, lastBzod(patientRef)), rule: BZOD.rule, source: BZOD.source, ikpUrl: BZOD.ikpUrl } };
}

/** Przypomnienia o pozycjach IPOM na dziś i jutro — treść poza aplikacją ogólna (bez danych o zdrowiu). */
export async function runIpomReminderSweep(now = new Date()): Promise<number> {
  const day = localDate(now, config.clinic.timezone);
  const tomorrow = localDate(new Date(now.getTime() + 86_400_000), config.clinic.timezone);
  const rows = getDb()
    .prepare(
      `SELECT i.id, p.patient_ref FROM ipom_item i JOIN ipom_plan p ON p.id = i.plan_id
       WHERE p.status = 'aktywny' AND i.status = 'zaplanowane' AND i.patient_notified_at IS NULL AND i.due_on IN (?, ?)`,
    )
    .all(day, tomorrow) as { id: string; patient_ref: string }[];
  for (const r of rows) {
    await notifyPatient(r.patient_ref, {
      kind: 'care-plan',
      title: 'Przypomnienie z planu opieki',
      body: 'W planie opieki masz pozycję na dziś lub jutro. Szczegóły w zakładce „Moja POZ”.',
      link: '/moja-poz',
      pushTitle: 'Eternal',
      pushBody: 'Masz nowe przypomnienie w aplikacji.',
    });
    getDb().prepare('UPDATE ipom_item SET patient_notified_at = ? WHERE id = ?').run(nowIso(), r.id);
  }
  return rows.length;
}
