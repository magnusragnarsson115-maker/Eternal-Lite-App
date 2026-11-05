import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { findUserByFhirRef, type AppUser } from '../auth/users.js';
import { config } from '../config.js';
import { consentHash, consentTemplate, CONSENT_TEMPLATES, IMAGE_CONSENT_TEXT, type ConsentTemplate } from '../content/aestheticConsents.js';
import { PHYSICIAN_PROFESSIONS } from '../content/clinicProfiles.js';
import { getDb } from '../db.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { addDays, localDate } from '../lib/time.js';
import { badRequest, conflict, forbidden, newId, notFound, nowIso } from '../lib/util.js';
import { getSetting, setSetting } from '../settings.js';
import { runInScope } from '../tenancy.js';
import { getClinicSettings, listPractitioners, listServices, type ServiceView } from './directory.js';
import { notifyPatient } from './notifications.js';
import { patientName } from './poz.js';
import { createDocument, registerUpload } from './records.js';

/**
 * Medycyna estetyczna (profil placówki): rejestr produktów i partii, karta zabiegu z mapą iniekcji, zgody pisemne
 * i zgoda na wizerunek, dokumentacja fotograficzna przed/po, zalecenia i kontrole, powikłania z danymi do zgłoszenia.
 *
 * Zasady:
 * - zabieg z produktem lub usługą „wykonuje lekarz” podpisuje wyłącznie lekarz albo lekarz dentysta
 *   (komunikat MZ z 23.01.2026); kosmetolog prowadzi zabiegi bez naruszenia ciągłości skóry;
 * - karta zabiegu z lekiem lub wyrobem medycznym wymaga podpisanej zgody pisemnej (skan albo oryginał w dokumentacji);
 * - partia po dacie ważności nie może trafić do karty; „kto dostał partię X” — wyszukiwanie przy komunikacie producenta;
 * - zdjęcia: tylko za zgodą na dokumentację; aplikacja ich nie analizuje; zgoda marketingowa jest osobna i nie
 *   uruchamia żadnej publikacji;
 * - VAT: stawka wynika z celu zapisanego przez lekarza (cel leczniczy wymaga wskazania) — informacja dla księgowości.
 */

export const PRODUCT_KINDS = ['toksyna', 'wypelniacz-ha', 'biostymulator', 'mezoterapia', 'nici', 'inny'] as const;
export const PRODUCT_CATEGORIES = ['lek', 'wyrob-medyczny', 'kosmetyk', 'inny'] as const;
export const UNITS = ['j.', 'ml', 'szt.', 'mg'] as const;
export const PHOTO_ANGLES = ['en-face', 'lewy-45', 'prawy-45', 'lewy-profil', 'prawy-profil', 'okolica'] as const;
export const MAP_VIEWS = ['przod', 'lewy', 'prawy'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type Unit = (typeof UNITS)[number];
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

function today(): string {
  return localDate(new Date(), config.clinic.timezone);
}

// --- produkty i partie ----------------------------------------------------------------------------------------------

interface ProductRow {
  id: string;
  org_id: string;
  name: string;
  kind: ProductKind;
  category: ProductCategory;
  manufacturer: string | null;
  unit: Unit;
  requires_physician: number;
  active: number;
  created_at: string;
}
interface LotRow {
  id: string;
  product_id: string;
  org_id: string;
  lot: string;
  expiry: string;
  udi: string | null;
  received_on: string | null;
  note: string | null;
  active: number;
  created_at: string;
}

export interface LotView {
  id: string;
  productId: string;
  lot: string;
  expiry: string;
  udi?: string;
  receivedOn?: string;
  active: boolean;
  expired: boolean;
  expiringSoon: boolean;
  used: number;
}
export interface ProductView {
  id: string;
  name: string;
  kind: ProductKind;
  category: ProductCategory;
  manufacturer?: string;
  unit: Unit;
  requiresPhysician: boolean;
  active: boolean;
  lots: LotView[];
}

function lotView(l: LotRow, day: string): LotView {
  const used = (getDb().prepare("SELECT COUNT(*) AS n FROM aesthetic_procedure WHERE org_id = ? AND status = 'podpisana' AND items LIKE ?").get(l.org_id, `%"lotId":"${l.id}"%`) as { n: number }).n;
  return {
    id: l.id,
    productId: l.product_id,
    lot: l.lot,
    expiry: l.expiry,
    udi: l.udi ?? undefined,
    receivedOn: l.received_on ?? undefined,
    active: !!l.active,
    expired: l.expiry < day,
    expiringSoon: l.expiry >= day && l.expiry <= addDays(day, 30),
    used: Number(used),
  };
}

function productView(p: ProductRow, day: string): ProductView {
  const lots = getDb().prepare('SELECT * FROM aesthetic_lot WHERE product_id = ? ORDER BY expiry DESC').all(p.id) as unknown as LotRow[];
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    category: p.category,
    manufacturer: p.manufacturer ?? undefined,
    unit: p.unit,
    requiresPhysician: !!p.requires_physician,
    active: !!p.active,
    lots: lots.map((l) => lotView(l, day)),
  };
}

export function listProducts(orgId: string): ProductView[] {
  const day = today();
  return (getDb().prepare('SELECT * FROM aesthetic_product WHERE org_id = ? ORDER BY active DESC, name').all(orgId) as unknown as ProductRow[]).map((p) => productView(p, day));
}

function productRow(orgId: string, id: string): ProductRow {
  const p = getDb().prepare('SELECT * FROM aesthetic_product WHERE id = ? AND org_id = ?').get(id, orgId) as ProductRow | undefined;
  if (!p) throw notFound('product_not_found');
  return p;
}

export function createProduct(
  actor: AuditActor,
  orgId: string,
  input: { name: string; kind: ProductKind; category: ProductCategory; manufacturer?: string; unit: Unit; requiresPhysician?: boolean },
): ProductView {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw badRequest('name_required');
  const id = newId();
  // lek i wyrób medyczny — domyślnie podaje lekarz; kosmetyk — tylko jeśli placówka tak ustawi
  const requires = input.requiresPhysician ?? input.category !== 'kosmetyk';
  getDb()
    .prepare('INSERT INTO aesthetic_product (id, org_id, name, kind, category, manufacturer, unit, requires_physician, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
    .run(id, orgId, name, input.kind, input.category, input.manufacturer?.trim().slice(0, 120) || null, input.unit, requires ? 1 : 0, nowIso());
  audit(actor, { action: 'C', subtype: 'aesthetic-product', detail: { id, name, category: input.category } });
  return productView(productRow(orgId, id), today());
}

export function updateProduct(actor: AuditActor, orgId: string, id: string, patch: { active?: boolean; requiresPhysician?: boolean; manufacturer?: string }): ProductView {
  const p = productRow(orgId, id);
  getDb()
    .prepare('UPDATE aesthetic_product SET active = ?, requires_physician = ?, manufacturer = ? WHERE id = ?')
    .run(patch.active === undefined ? p.active : patch.active ? 1 : 0, patch.requiresPhysician === undefined ? p.requires_physician : patch.requiresPhysician ? 1 : 0, patch.manufacturer === undefined ? p.manufacturer : patch.manufacturer.trim() || null, id);
  audit(actor, { action: 'U', subtype: 'aesthetic-product', detail: { id, ...patch } });
  return productView(productRow(orgId, id), today());
}

export function addLot(actor: AuditActor, orgId: string, productId: string, input: { lot: string; expiry: string; udi?: string; receivedOn?: string; note?: string }): ProductView {
  productRow(orgId, productId);
  const lot = input.lot.trim().slice(0, 60);
  if (!lot) throw badRequest('lot_required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiry)) throw badRequest('invalid_date');
  if (input.receivedOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) throw badRequest('invalid_date');
  const exists = getDb().prepare('SELECT id FROM aesthetic_lot WHERE product_id = ? AND lower(lot) = lower(?)').get(productId, lot);
  if (exists) throw conflict('lot_exists');
  getDb()
    .prepare('INSERT INTO aesthetic_lot (id, product_id, org_id, lot, expiry, udi, received_on, note, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
    .run(newId(), productId, orgId, lot, input.expiry, input.udi?.trim().slice(0, 120) || null, input.receivedOn ?? null, input.note?.trim().slice(0, 300) || null, nowIso());
  audit(actor, { action: 'C', subtype: 'aesthetic-lot', detail: { productId, lot, expiry: input.expiry } });
  return productView(productRow(orgId, productId), today());
}

export function setLotActive(actor: AuditActor, orgId: string, lotId: string, active: boolean): ProductView {
  const l = getDb().prepare('SELECT * FROM aesthetic_lot WHERE id = ? AND org_id = ?').get(lotId, orgId) as LotRow | undefined;
  if (!l) throw notFound('lot_not_found');
  getDb().prepare('UPDATE aesthetic_lot SET active = ? WHERE id = ?').run(active ? 1 : 0, lotId);
  audit(actor, { action: 'U', subtype: 'aesthetic-lot', detail: { lotId, active } });
  return productView(productRow(orgId, l.product_id), today());
}

// --- zgody ----------------------------------------------------------------------------------------------------------

interface Approval {
  version: string;
  hash: string;
  approvedBy: string;
  approvedAt: string;
}
const approvalKey = (orgId: string, id: string) => `consent-approval:${orgId}:${id}`;

export function templateApproval(orgId: string, t: ConsentTemplate): Approval | undefined {
  const a = getSetting<Approval>(approvalKey(orgId, t.id));
  return a && a.version === t.version && a.hash === consentHash(t) ? a : undefined;
}

export function consentTemplatesFor(orgId: string) {
  return CONSENT_TEMPLATES.map((t) => ({ ...t, hash: consentHash(t), approval: templateApproval(orgId, t) }));
}

export function approveConsentTemplate(actor: AuditActor, orgId: string, id: string, approvedBy: string): Approval {
  const t = consentTemplate(id);
  if (!t) throw notFound('template_not_found');
  const name = approvedBy.trim();
  if (name.length < 5) throw badRequest('approver_required');
  const a: Approval = { version: t.version, hash: consentHash(t), approvedBy: name.slice(0, 160), approvedAt: nowIso() };
  setSetting(approvalKey(orgId, id), a);
  audit(actor, { action: 'U', subtype: 'consent-template-approve', detail: { template: id, version: t.version, hash: a.hash, approvedBy: a.approvedBy } });
  return a;
}

type ConsentStatus = 'do-podpisu' | 'podpisana' | 'wycofana';
interface ConsentRow {
  id: string;
  org_id: string;
  patient_ref: string;
  template_id: string;
  template_version: string;
  template_hash: string;
  status: ConsentStatus;
  read_at: string | null;
  signed_on: string | null;
  method: 'papier' | 'podpis-kwalifikowany' | null;
  document_id: string | null;
  recorded_by: string | null;
  withdrawn_at: string | null;
  created_at: string;
}

export interface ConsentView {
  id: string;
  patientId: string;
  templateId: string;
  title: string;
  version: string;
  status: ConsentStatus;
  readAt?: string;
  signedOn?: string;
  method?: ConsentRow['method'];
  documentId?: string;
  recordedBy?: string;
  createdAt: string;
}

function consentView(r: ConsentRow): ConsentView {
  return {
    id: r.id,
    patientId: r.patient_ref.split('/')[1] ?? '',
    templateId: r.template_id,
    title: consentTemplate(r.template_id)?.title ?? r.template_id,
    version: r.template_version,
    status: r.status,
    readAt: r.read_at ?? undefined,
    signedOn: r.signed_on ?? undefined,
    method: r.method ?? undefined,
    documentId: r.document_id ?? undefined,
    recordedBy: r.recorded_by ?? undefined,
    createdAt: r.created_at,
  };
}

function consentRow(id: string): ConsentRow | undefined {
  return getDb().prepare('SELECT * FROM procedure_consent WHERE id = ?').get(id) as ConsentRow | undefined;
}

export async function requestConsent(actor: AuditActor, orgId: string, patientId: string, templateId: string): Promise<ConsentView> {
  const t = consentTemplate(templateId);
  if (!t) throw notFound('template_not_found');
  if (!templateApproval(orgId, t)) throw conflict('template_not_approved');
  const p = await fhir().readOptional<Patient>('Patient', patientId);
  if (!p) throw notFound('patient_not_found');
  const ref = `Patient/${p.id}`;
  const id = newId();
  getDb()
    .prepare("INSERT INTO procedure_consent (id, org_id, patient_ref, template_id, template_version, template_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'do-podpisu', ?)")
    .run(id, orgId, ref, t.id, t.version, consentHash(t), nowIso());
  audit(actor, { action: 'C', subtype: 'procedure-consent-request', patientRef: ref, detail: { id, template: t.id } });
  return consentView(consentRow(id)!);
}

export function recordConsentSigned(actor: AuditActor, orgId: string, id: string, input: { signedOn: string; method: 'papier' | 'podpis-kwalifikowany'; documentId?: string }): ConsentView {
  const r = consentRow(id);
  if (!r || r.org_id !== orgId) throw notFound('consent_not_found');
  if (r.status !== 'do-podpisu') throw conflict('consent_not_pending');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedOn) || input.signedOn > today()) throw badRequest('invalid_date');
  getDb()
    .prepare("UPDATE procedure_consent SET status = 'podpisana', signed_on = ?, method = ?, document_id = ?, recorded_by = ? WHERE id = ?")
    .run(input.signedOn, input.method, input.documentId ?? null, actor.display ?? null, id);
  audit(actor, { action: 'U', subtype: 'procedure-consent-signed', patientRef: r.patient_ref, detail: { id, method: input.method, scan: !!input.documentId } });
  return consentView(consentRow(id)!);
}

export function withdrawConsent(actor: AuditActor, id: string, check: { orgId?: string; patientRef?: string }): ConsentView {
  const r = consentRow(id);
  if (!r || (check.orgId && r.org_id !== check.orgId) || (check.patientRef && r.patient_ref !== check.patientRef)) throw notFound('consent_not_found');
  if (r.status === 'wycofana') return consentView(r);
  // zgoda wykorzystana w podpisanej karcie zabiegu nie „cofa” wykonanego zabiegu — wycofanie dotyczy kolejnych
  getDb().prepare("UPDATE procedure_consent SET status = 'wycofana', withdrawn_at = ? WHERE id = ?").run(nowIso(), id);
  audit(actor, { action: 'U', subtype: 'procedure-consent-withdraw', patientRef: r.patient_ref, detail: { id } });
  return consentView(consentRow(id)!);
}

export function listConsents(actor: AuditActor, orgId: string, patientId: string): ConsentView[] {
  const ref = `Patient/${patientId}`;
  audit(actor, { action: 'R', subtype: 'procedure-consents', patientRef: ref });
  return (getDb().prepare('SELECT * FROM procedure_consent WHERE org_id = ? AND patient_ref = ? ORDER BY created_at DESC').all(orgId, ref) as unknown as ConsentRow[]).map(consentView);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Wzór do wydruku i podpisu odręcznego (forma pisemna). */
export async function consentPrintHtml(actor: AuditActor, orgId: string, id: string): Promise<string> {
  const r = consentRow(id);
  if (!r || r.org_id !== orgId) throw notFound('consent_not_found');
  const t = consentTemplate(r.template_id);
  if (!t) throw notFound('template_not_found');
  const p = await fhir().readOptional<Patient>('Patient', r.patient_ref.split('/')[1] ?? '');
  const clinic = getClinicSettings(orgId);
  const approval = templateApproval(orgId, t);
  audit(actor, { action: 'R', subtype: 'procedure-consent-print', patientRef: r.patient_ref, detail: { id } });
  const sections = t.sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.heading.startsWith('Oświadczenia') ? `<ul>${s.text.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : s.text.map((x) => `<p>${esc(x)}</p>`).join('')}`).join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:20px}h2{font-size:15px;margin:18px 0 4px}.meta{color:#444;font-size:12px}.sign{display:flex;gap:32px;margin-top:40px}.sign div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:12px}@media print{.noprint{display:none}}</style></head><body>
<p class="meta">${esc(clinic.name)} · wzór ${esc(t.version)}${approval ? ` · zatwierdził: ${esc(approval.approvedBy)}` : ''}</p>
<h1>${esc(t.title)}</h1>
<p>Pacjent: <strong>${esc(patientName(p))}</strong>${p?.birthDate ? `, data urodzenia: ${esc(p.birthDate)}` : ''}</p>
<p>Zabieg i preparat (wypełnia lekarz): ______________________________________________</p>
${sections}
<p>Wyrażam zgodę na wykonanie zabiegu opisanego powyżej.</p>
<div class="sign"><div>Data i czytelny podpis pacjenta</div><div>Data, podpis i pieczątka lekarza</div></div>
<p class="noprint meta" style="margin-top:32px">Wydrukuj tę stronę (Ctrl+P / ⌘P), podpisz z pacjentem i dołącz skan do dokumentacji w Eternal.</p>
</body></html>`;
}

// --- zgoda na wizerunek ---------------------------------------------------------------------------------------------

export interface ImageConsent {
  documentation: boolean;
  marketing: boolean;
  updatedAt?: string;
  texts: typeof IMAGE_CONSENT_TEXT;
}

export function getImageConsent(orgId: string, patientRef: string): ImageConsent {
  const r = getDb().prepare('SELECT * FROM image_consent WHERE org_id = ? AND patient_ref = ?').get(orgId, patientRef) as
    | { documentation: number; marketing: number; updated_at: string }
    | undefined;
  return { documentation: !!r?.documentation, marketing: !!r?.marketing, updatedAt: r?.updated_at, texts: IMAGE_CONSENT_TEXT };
}

export function setImageConsent(actor: AuditActor, orgId: string, patientRef: string, patch: { documentation?: boolean; marketing?: boolean }): ImageConsent {
  const cur = getImageConsent(orgId, patientRef);
  const next = { documentation: patch.documentation ?? cur.documentation, marketing: patch.marketing ?? cur.marketing };
  getDb()
    .prepare(
      `INSERT INTO image_consent (org_id, patient_ref, documentation, marketing, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, patient_ref) DO UPDATE SET documentation = excluded.documentation, marketing = excluded.marketing, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .run(orgId, patientRef, next.documentation ? 1 : 0, next.marketing ? 1 : 0, nowIso(), actor.display ?? null);
  audit(actor, { action: 'U', subtype: 'image-consent', patientRef, detail: next });
  return getImageConsent(orgId, patientRef);
}

// --- karta zabiegu --------------------------------------------------------------------------------------------------

export interface ProcItem {
  productId: string;
  lotId: string;
  quantity: number;
  area: string;
}
export interface ProcPoint {
  x: number;
  y: number;
  view: (typeof MAP_VIEWS)[number];
  quantity?: number;
  item?: number;
  label?: string;
}
export interface ProcPhoto {
  documentId: string;
  phase: 'przed' | 'po';
  angle: PhotoAngle;
  at: string;
}

interface ProcRow {
  id: string;
  org_id: string;
  patient_ref: string;
  appointment_id: string | null;
  service_id: string | null;
  title: string;
  purpose: 'estetyczny' | 'leczniczy';
  indication: string | null;
  performer_user_id: string;
  performer_name: string | null;
  performed_at: string;
  items: string;
  points: string;
  notes: string | null;
  consent_id: string | null;
  photo_ids: string;
  aftercare: string | null;
  control_on: string | null;
  next_on: string | null;
  status: 'szkic' | 'podpisana';
  signed_at: string | null;
  control_notified_at: string | null;
  next_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcedureView {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  serviceId?: string;
  serviceName?: string;
  title: string;
  purpose: ProcRow['purpose'];
  indication?: string;
  performer: string;
  performerUserId: string;
  performedAt: string;
  items: (ProcItem & { productName: string; unit: Unit; lot: string; expiry: string; udi?: string; category: ProductCategory; manufacturer?: string })[];
  points: ProcPoint[];
  notes?: string;
  consent?: ConsentView;
  photos: ProcPhoto[];
  aftercare?: string;
  controlOn?: string;
  nextOn?: string;
  status: ProcRow['status'];
  signedAt?: string;
  /** Informacja dla dokumentu sprzedaży — decyduje księgowość. */
  billing: { price?: number; vat: 'zw' | '8' | '23'; basis: string };
  complications: number;
}

function procRow(id: string): ProcRow | undefined {
  return getDb().prepare('SELECT * FROM aesthetic_procedure WHERE id = ?').get(id) as ProcRow | undefined;
}

async function servicesOf(orgId: string): Promise<Map<string, ServiceView>> {
  return new Map((await runInScope({ orgId }, () => listServices(true))).map((s) => [s.id, s]));
}

function billing(row: Pick<ProcRow, 'purpose' | 'indication'>, svc: ServiceView | undefined): ProcedureView['billing'] {
  if (row.purpose === 'leczniczy' && row.indication)
    return { price: svc?.price, vat: 'zw', basis: 'Cel leczniczy ze wskazaniem w dokumentacji — zwolnienie (art. 43 ust. 1 pkt 18 ustawy o VAT) do potwierdzenia przez księgowość.' };
  return { price: svc?.price, vat: svc?.vat ?? '23', basis: 'Cel estetyczny — stawka z usługi (co do zasady 23%).' };
}

async function procView(r: ProcRow, staff: boolean): Promise<ProcedureView> {
  const items = JSON.parse(r.items) as ProcItem[];
  const enriched = items.map((i) => {
    const p = getDb().prepare('SELECT * FROM aesthetic_product WHERE id = ?').get(i.productId) as ProductRow | undefined;
    const l = getDb().prepare('SELECT * FROM aesthetic_lot WHERE id = ?').get(i.lotId) as LotRow | undefined;
    return { ...i, productName: p?.name ?? '—', unit: (p?.unit ?? 'ml') as Unit, lot: l?.lot ?? '—', expiry: l?.expiry ?? '', udi: l?.udi ?? undefined, category: (p?.category ?? 'inny') as ProductCategory, manufacturer: p?.manufacturer ?? undefined };
  });
  const svc = r.service_id ? (await servicesOf(r.org_id)).get(r.service_id) : undefined;
  const consent = r.consent_id ? consentRow(r.consent_id) : undefined;
  const pn = patientName(await fhirSystem().readOptional<Patient>('Patient', r.patient_ref.split('/')[1] ?? ''));
  const complications = (getDb().prepare('SELECT COUNT(*) AS n FROM aesthetic_complication WHERE procedure_id = ?').get(r.id) as { n: number }).n;
  return {
    id: r.id,
    patientId: r.patient_ref.split('/')[1] ?? '',
    patientName: pn,
    appointmentId: r.appointment_id ?? undefined,
    serviceId: r.service_id ?? undefined,
    serviceName: svc?.name,
    title: r.title,
    purpose: r.purpose,
    indication: r.indication ?? undefined,
    performer: r.performer_name ?? '—',
    performerUserId: staff ? r.performer_user_id : '',
    performedAt: r.performed_at,
    items: enriched,
    points: JSON.parse(r.points) as ProcPoint[],
    notes: staff ? (r.notes ?? undefined) : undefined,
    consent: consent ? consentView(consent) : undefined,
    photos: JSON.parse(r.photo_ids) as ProcPhoto[],
    aftercare: r.aftercare ?? undefined,
    controlOn: r.control_on ?? undefined,
    nextOn: r.next_on ?? undefined,
    status: r.status,
    signedAt: r.signed_at ?? undefined,
    billing: billing(r, svc),
    complications: Number(complications),
  };
}

export interface ProcedureInput {
  patientId: string;
  appointmentId?: string;
  serviceId?: string;
  title: string;
  purpose: 'estetyczny' | 'leczniczy';
  indication?: string;
  performedAt?: string;
  items: ProcItem[];
  points: ProcPoint[];
  notes?: string;
  consentId?: string | null;
  aftercare?: string;
  controlOn?: string | null;
  nextOn?: string | null;
}

function cleanPoints(points: ProcPoint[]): ProcPoint[] {
  return points.slice(0, 120).map((p) => {
    if (!(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) throw badRequest('invalid_point');
    return { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, view: p.view, quantity: p.quantity, item: p.item, label: p.label?.trim().slice(0, 60) || undefined };
  });
}

function cleanItems(orgId: string, items: ProcItem[]): ProcItem[] {
  return items.slice(0, 20).map((i) => {
    productRow(orgId, i.productId);
    const l = getDb().prepare('SELECT * FROM aesthetic_lot WHERE id = ? AND org_id = ?').get(i.lotId, orgId) as LotRow | undefined;
    if (!l || l.product_id !== i.productId) throw badRequest('lot_not_found');
    if (!(i.quantity > 0 && i.quantity <= 1000)) throw badRequest('invalid_quantity');
    return { productId: i.productId, lotId: i.lotId, quantity: Math.round(i.quantity * 100) / 100, area: i.area.trim().slice(0, 80) };
  });
}

const dateOrNull = (d: string | null | undefined) => {
  if (d === undefined || d === null || d === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw badRequest('invalid_date');
  return d;
};

export async function createProcedure(user: AppUser, actor: AuditActor, orgId: string, input: ProcedureInput): Promise<ProcedureView> {
  const p = await fhir().readOptional<Patient>('Patient', input.patientId);
  if (!p) throw notFound('patient_not_found');
  const title = input.title.trim().slice(0, 160);
  if (!title) throw badRequest('title_required');
  const svc = input.serviceId ? (await servicesOf(orgId)).get(input.serviceId) : undefined;
  if (input.serviceId && !svc) throw badRequest('service_not_found');
  const performedAt = input.performedAt ? new Date(input.performedAt).toISOString() : nowIso();
  const performedDay = localDate(new Date(performedAt), config.clinic.timezone);
  const controlOn = input.controlOn === undefined && svc?.controlAfterDays ? addDays(performedDay, svc.controlAfterDays) : dateOrNull(input.controlOn);
  const aftercare = input.aftercare ?? (svc?.consentTemplate ? consentTemplate(svc.consentTemplate)?.aftercare.join('\n') : undefined);
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO aesthetic_procedure (id, org_id, patient_ref, appointment_id, service_id, title, purpose, indication, performer_user_id, performer_name, performed_at, items, points, notes, consent_id, photo_ids, aftercare, control_on, next_on, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 'szkic', ?, ?)`,
    )
    .run(
      id,
      orgId,
      `Patient/${p.id}`,
      input.appointmentId ?? null,
      input.serviceId ?? null,
      title,
      input.purpose,
      input.indication?.trim().slice(0, 500) || null,
      user.id,
      user.display_name,
      performedAt,
      JSON.stringify(cleanItems(orgId, input.items)),
      JSON.stringify(cleanPoints(input.points)),
      input.notes?.trim().slice(0, 4000) || null,
      input.consentId ?? null,
      aftercare?.trim().slice(0, 4000) || null,
      controlOn,
      dateOrNull(input.nextOn),
      now,
      now,
    );
  audit(actor, { action: 'C', subtype: 'aesthetic-procedure', patientRef: `Patient/${p.id}`, detail: { id, title } });
  return procView(procRow(id)!, true);
}

function ownDraft(user: AppUser, orgId: string, id: string): ProcRow {
  const r = procRow(id);
  if (!r || r.org_id !== orgId) throw notFound('procedure_not_found');
  if (r.status !== 'szkic') throw conflict('procedure_signed');
  if (r.performer_user_id !== user.id) throw forbidden('procedure_other_performer');
  return r;
}

export async function updateProcedure(user: AppUser, actor: AuditActor, orgId: string, id: string, patch: Partial<Omit<ProcedureInput, 'patientId'>>): Promise<ProcedureView> {
  const r = ownDraft(user, orgId, id);
  if (patch.serviceId && !(await servicesOf(orgId)).get(patch.serviceId)) throw badRequest('service_not_found');
  const set: Record<string, string | null> = {};
  if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 160) || r.title;
  if (patch.serviceId !== undefined) set.service_id = patch.serviceId || null;
  if (patch.appointmentId !== undefined) set.appointment_id = patch.appointmentId || null;
  if (patch.purpose !== undefined) set.purpose = patch.purpose;
  if (patch.indication !== undefined) set.indication = patch.indication.trim().slice(0, 500) || null;
  if (patch.performedAt !== undefined) set.performed_at = new Date(patch.performedAt).toISOString();
  if (patch.items !== undefined) set.items = JSON.stringify(cleanItems(orgId, patch.items));
  if (patch.points !== undefined) set.points = JSON.stringify(cleanPoints(patch.points));
  if (patch.notes !== undefined) set.notes = patch.notes.trim().slice(0, 4000) || null;
  if (patch.consentId !== undefined) set.consent_id = patch.consentId || null;
  if (patch.aftercare !== undefined) set.aftercare = patch.aftercare.trim().slice(0, 4000) || null;
  if (patch.controlOn !== undefined) set.control_on = dateOrNull(patch.controlOn);
  if (patch.nextOn !== undefined) set.next_on = dateOrNull(patch.nextOn);
  const keys = Object.keys(set);
  if (keys.length) {
    getDb()
      .prepare(`UPDATE aesthetic_procedure SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...keys.map((k) => set[k]), nowIso(), id);
  }
  audit(actor, { action: 'U', subtype: 'aesthetic-procedure', patientRef: r.patient_ref, detail: { id, fields: keys } });
  return procView(procRow(id)!, true);
}

async function performerProfession(user: AppUser, orgId: string) {
  const prId = user.fhir_ref?.startsWith('Practitioner/') ? user.fhir_ref.split('/')[1] : undefined;
  if (!prId) return undefined;
  return (await runInScope({ orgId }, () => listPractitioners(true))).find((p) => p.id === prId)?.profession;
}

/** Podpisanie karty: wymóg lekarza, ważność partii, zgoda pisemna, cel leczniczy ze wskazaniem. */
export async function signProcedure(user: AppUser, actor: AuditActor, orgId: string, id: string): Promise<ProcedureView> {
  const r = ownDraft(user, orgId, id);
  const items = JSON.parse(r.items) as ProcItem[];
  const svc = r.service_id ? (await servicesOf(orgId)).get(r.service_id) : undefined;
  const products = items.map((i) => productRow(orgId, i.productId));
  const needsPhysician = !!svc?.requiresPhysician || products.some((p) => !!p.requires_physician);
  if (needsPhysician) {
    const profession = await performerProfession(user, orgId);
    if (!profession) throw forbidden('profession_missing');
    if (!PHYSICIAN_PROFESSIONS.includes(profession)) throw forbidden('physician_required');
  }
  const performedDay = localDate(new Date(r.performed_at), config.clinic.timezone);
  for (const i of items) {
    const l = getDb().prepare('SELECT * FROM aesthetic_lot WHERE id = ?').get(i.lotId) as LotRow | undefined;
    if (!l || l.expiry < performedDay) throw conflict('lot_expired');
  }
  if (r.purpose === 'leczniczy' && !r.indication) throw badRequest('indication_required');
  const needsConsent = !!svc?.consentTemplate || products.some((p) => p.category === 'lek' || p.category === 'wyrob-medyczny');
  if (needsConsent) {
    const c = r.consent_id ? consentRow(r.consent_id) : undefined;
    if (!c || c.patient_ref !== r.patient_ref || c.org_id !== orgId || c.status !== 'podpisana') throw conflict('consent_required');
  }
  const now = nowIso();
  getDb().prepare("UPDATE aesthetic_procedure SET status = 'podpisana', signed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
  audit(actor, { action: 'U', subtype: 'aesthetic-procedure-sign', patientRef: r.patient_ref, detail: { id, items: items.length } });
  await notifyPatient(r.patient_ref, {
    kind: 'aesthetic',
    title: 'Karta zabiegu i zalecenia',
    body: 'Karta zabiegu, zalecenia i termin kontroli są w zakładce „Moje zabiegi”.',
    link: '/moje-zabiegi',
    pushTitle: 'Eternal',
    pushBody: 'Masz nową informację w aplikacji.',
  });
  return procView(procRow(id)!, true);
}

export async function getProcedure(actor: AuditActor, orgId: string, id: string): Promise<ProcedureView> {
  const r = procRow(id);
  if (!r || r.org_id !== orgId) throw notFound('procedure_not_found');
  audit(actor, { action: 'R', subtype: 'aesthetic-procedure', patientRef: r.patient_ref, detail: { id } });
  return procView(r, true);
}

export async function listProcedures(actor: AuditActor, orgId: string, filter: { patientId?: string } = {}): Promise<ProcedureView[]> {
  const rows = filter.patientId
    ? (getDb().prepare('SELECT * FROM aesthetic_procedure WHERE org_id = ? AND patient_ref = ? ORDER BY performed_at DESC').all(orgId, `Patient/${filter.patientId}`) as unknown as ProcRow[])
    : (getDb().prepare('SELECT * FROM aesthetic_procedure WHERE org_id = ? ORDER BY performed_at DESC LIMIT 100').all(orgId) as unknown as ProcRow[]);
  audit(actor, { action: 'R', subtype: 'aesthetic-procedures', patientRef: filter.patientId ? `Patient/${filter.patientId}` : undefined, detail: { count: rows.length } });
  const out: ProcedureView[] = [];
  for (const r of rows) out.push(await procView(r, true));
  return out;
}

/** Zdjęcie przed/po do karty zabiegu — tylko za zgodą na dokumentację fotograficzną; bez analizy obrazu. */
export async function addProcedurePhoto(
  actor: AuditActor,
  orgId: string,
  id: string,
  file: { data: Buffer; filename: string; contentType: string; phase: 'przed' | 'po'; angle: PhotoAngle },
): Promise<ProcedureView> {
  const r = procRow(id);
  if (!r || r.org_id !== orgId) throw notFound('procedure_not_found');
  if (!getImageConsent(orgId, r.patient_ref).documentation) throw conflict('image_consent_required');
  const upload = await registerUpload(actor, { data: file.data, filename: file.filename, contentType: file.contentType });
  if (!upload.contentType.startsWith('image/')) throw badRequest('unsupported_file_type');
  const angleLabel: Record<PhotoAngle, string> = { 'en-face': 'en face', 'lewy-45': 'lewy półprofil', 'prawy-45': 'prawy półprofil', 'lewy-profil': 'lewy profil', 'prawy-profil': 'prawy profil', okolica: 'okolica zabiegu' };
  const doc = await createDocument(actor, {
    patientId: r.patient_ref.split('/')[1] ?? '',
    title: `Zdjęcie ${file.phase === 'przed' ? 'przed zabiegiem' : 'po zabiegu'} — ${angleLabel[file.angle]}`,
    kind: 'photo',
    binaryId: upload.binaryId,
    appointmentId: r.appointment_id ?? undefined,
    bodyRegion: file.angle,
  });
  const photos = JSON.parse(r.photo_ids) as ProcPhoto[];
  photos.push({ documentId: doc.id, phase: file.phase, angle: file.angle, at: nowIso() });
  getDb().prepare('UPDATE aesthetic_procedure SET photo_ids = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(photos), nowIso(), id);
  audit(actor, { action: 'C', subtype: 'aesthetic-photo', patientRef: r.patient_ref, detail: { id, phase: file.phase, angle: file.angle } });
  return procView(procRow(id)!, true);
}

/** Komunikat bezpieczeństwa producenta: którzy pacjenci dostali produkt z tej partii (z kontaktem do placówki). */
export async function lotRecall(actor: AuditActor, orgId: string, lotId: string) {
  const l = getDb().prepare('SELECT * FROM aesthetic_lot WHERE id = ? AND org_id = ?').get(lotId, orgId) as LotRow | undefined;
  if (!l) throw notFound('lot_not_found');
  const product = productRow(orgId, l.product_id);
  const rows = getDb().prepare("SELECT * FROM aesthetic_procedure WHERE org_id = ? AND status = 'podpisana' AND items LIKE ? ORDER BY performed_at DESC").all(orgId, `%"lotId":"${lotId}"%`) as unknown as ProcRow[];
  const byPatient = new Map<string, { patientId: string; name: string; phone?: string; email?: string; procedures: { id: string; performedAt: string; title: string }[] }>();
  for (const r of rows) {
    let e = byPatient.get(r.patient_ref);
    if (!e) {
      const p = await fhirSystem().readOptional<Patient>('Patient', r.patient_ref.split('/')[1] ?? '');
      const u = findUserByFhirRef(r.patient_ref);
      e = { patientId: p?.id ?? '', name: patientName(p), phone: p?.telecom?.find((t) => t.system === 'phone')?.value ?? u?.phone ?? undefined, email: p?.telecom?.find((t) => t.system === 'email')?.value ?? u?.email ?? undefined, procedures: [] };
      byPatient.set(r.patient_ref, e);
    }
    e.procedures.push({ id: r.id, performedAt: r.performed_at, title: r.title });
  }
  audit(actor, { action: 'R', subtype: 'aesthetic-lot-recall', detail: { lotId, product: product.name, lot: l.lot, patients: byPatient.size } });
  return { product: { id: product.id, name: product.name, manufacturer: product.manufacturer ?? undefined }, lot: lotView(l, today()), patients: [...byPatient.values()] };
}

// --- powikłania -----------------------------------------------------------------------------------------------------

export const SERIOUSNESS = ['lagodne', 'umiarkowane', 'ciezkie'] as const;
export const REPORT_TO = ['urpl', 'wytworca', 'urpl-i-wytworca', 'nie-dotyczy'] as const;

interface ComplicationRow {
  id: string;
  org_id: string;
  procedure_id: string;
  patient_ref: string;
  noticed_on: string;
  description: string;
  seriousness: (typeof SERIOUSNESS)[number];
  actions: string | null;
  report_to: (typeof REPORT_TO)[number];
  reported_on: string | null;
  report_ref: string | null;
  status: 'otwarte' | 'zamkniete';
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplicationView {
  id: string;
  procedureId: string;
  procedureTitle: string;
  patientId: string;
  patientName: string;
  noticedOn: string;
  description: string;
  seriousness: ComplicationRow['seriousness'];
  actions?: string;
  reportTo: ComplicationRow['report_to'];
  reportedOn?: string;
  reportRef?: string;
  status: ComplicationRow['status'];
  recordedBy?: string;
  lots: { product: string; lot: string }[];
}

async function complicationView(c: ComplicationRow): Promise<ComplicationView> {
  const pr = procRow(c.procedure_id);
  const items = pr ? (JSON.parse(pr.items) as ProcItem[]) : [];
  return {
    id: c.id,
    procedureId: c.procedure_id,
    procedureTitle: pr?.title ?? '—',
    patientId: c.patient_ref.split('/')[1] ?? '',
    patientName: patientName(await fhirSystem().readOptional<Patient>('Patient', c.patient_ref.split('/')[1] ?? '')),
    noticedOn: c.noticed_on,
    description: c.description,
    seriousness: c.seriousness,
    actions: c.actions ?? undefined,
    reportTo: c.report_to,
    reportedOn: c.reported_on ?? undefined,
    reportRef: c.report_ref ?? undefined,
    status: c.status,
    recordedBy: c.recorded_by ?? undefined,
    lots: items.map((i) => ({
      product: (getDb().prepare('SELECT name FROM aesthetic_product WHERE id = ?').get(i.productId) as { name: string } | undefined)?.name ?? '—',
      lot: (getDb().prepare('SELECT lot FROM aesthetic_lot WHERE id = ?').get(i.lotId) as { lot: string } | undefined)?.lot ?? '—',
    })),
  };
}

export async function createComplication(
  actor: AuditActor,
  orgId: string,
  input: { procedureId: string; noticedOn: string; description: string; seriousness: ComplicationRow['seriousness']; actions?: string; reportTo: ComplicationRow['report_to']; reportedOn?: string; reportRef?: string },
): Promise<ComplicationView> {
  const pr = procRow(input.procedureId);
  if (!pr || pr.org_id !== orgId) throw notFound('procedure_not_found');
  if (pr.status !== 'podpisana') throw conflict('procedure_not_signed');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.noticedOn) || input.noticedOn > today()) throw badRequest('invalid_date');
  const description = input.description.trim().slice(0, 4000);
  if (!description) throw badRequest('description_required');
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO aesthetic_complication (id, org_id, procedure_id, patient_ref, noticed_on, description, seriousness, actions, report_to, reported_on, report_ref, status, recorded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'otwarte', ?, ?, ?)`,
    )
    .run(id, orgId, pr.id, pr.patient_ref, input.noticedOn, description, input.seriousness, input.actions?.trim().slice(0, 2000) || null, input.reportTo, dateOrNull(input.reportedOn), input.reportRef?.trim().slice(0, 120) || null, actor.display ?? null, now, now);
  audit(actor, { action: 'C', subtype: 'aesthetic-complication', patientRef: pr.patient_ref, detail: { id, procedure: pr.id, seriousness: input.seriousness } });
  return complicationView(getDb().prepare('SELECT * FROM aesthetic_complication WHERE id = ?').get(id) as unknown as ComplicationRow);
}

export async function updateComplication(
  actor: AuditActor,
  orgId: string,
  id: string,
  patch: { status?: ComplicationRow['status']; actions?: string; reportedOn?: string | null; reportRef?: string; reportTo?: ComplicationRow['report_to'] },
): Promise<ComplicationView> {
  const c = getDb().prepare('SELECT * FROM aesthetic_complication WHERE id = ? AND org_id = ?').get(id, orgId) as ComplicationRow | undefined;
  if (!c) throw notFound('complication_not_found');
  getDb()
    .prepare('UPDATE aesthetic_complication SET status = ?, actions = ?, reported_on = ?, report_ref = ?, report_to = ?, updated_at = ? WHERE id = ?')
    .run(
      patch.status ?? c.status,
      patch.actions === undefined ? c.actions : patch.actions.trim().slice(0, 2000) || null,
      patch.reportedOn === undefined ? c.reported_on : dateOrNull(patch.reportedOn),
      patch.reportRef === undefined ? c.report_ref : patch.reportRef.trim().slice(0, 120) || null,
      patch.reportTo ?? c.report_to,
      nowIso(),
      id,
    );
  audit(actor, { action: 'U', subtype: 'aesthetic-complication', patientRef: c.patient_ref, detail: { id, ...patch } });
  return complicationView(getDb().prepare('SELECT * FROM aesthetic_complication WHERE id = ?').get(id) as unknown as ComplicationRow);
}

export async function listComplications(actor: AuditActor, orgId: string, filter: { status?: ComplicationRow['status'] } = {}): Promise<ComplicationView[]> {
  const rows = filter.status
    ? (getDb().prepare('SELECT * FROM aesthetic_complication WHERE org_id = ? AND status = ? ORDER BY noticed_on DESC').all(orgId, filter.status) as unknown as ComplicationRow[])
    : (getDb().prepare('SELECT * FROM aesthetic_complication WHERE org_id = ? ORDER BY noticed_on DESC LIMIT 200').all(orgId) as unknown as ComplicationRow[]);
  audit(actor, { action: 'R', subtype: 'aesthetic-complications', detail: { count: rows.length } });
  const out: ComplicationView[] = [];
  for (const r of rows) out.push(await complicationView(r));
  return out;
}

/** Dane do zgłoszenia (URPL / wytwórca) — inicjały i rok urodzenia zamiast pełnych danych; decyzję o zgłoszeniu podejmuje lekarz. */
export async function complicationReportData(actor: AuditActor, orgId: string, id: string) {
  const c = getDb().prepare('SELECT * FROM aesthetic_complication WHERE id = ? AND org_id = ?').get(id, orgId) as ComplicationRow | undefined;
  if (!c) throw notFound('complication_not_found');
  const pr = procRow(c.procedure_id)!;
  const view = await procView(pr, true);
  const p = await fhirSystem().readOptional<Patient>('Patient', c.patient_ref.split('/')[1] ?? '');
  const n = p?.name?.[0];
  audit(actor, { action: 'R', subtype: 'aesthetic-complication-report', patientRef: c.patient_ref, detail: { id } });
  return {
    clinic: getClinicSettings(orgId).name,
    patient: { initials: `${n?.given?.[0]?.[0] ?? ''}${n?.family?.[0] ?? ''}`.toUpperCase(), birthYear: p?.birthDate?.slice(0, 4), sex: p?.gender },
    procedure: { date: view.performedAt.slice(0, 10), title: view.title, performer: view.performer, purpose: view.purpose },
    products: view.items.map((i) => ({ name: i.productName, manufacturer: i.manufacturer, category: i.category, lot: i.lot, expiry: i.expiry, udi: i.udi, quantity: `${i.quantity} ${i.unit}`, area: i.area })),
    event: { noticedOn: c.noticed_on, description: c.description, seriousness: c.seriousness, actions: c.actions ?? undefined },
    reportTo: c.report_to,
    guidance:
      'Działanie niepożądane leku (np. toksyny botulinowej) zgłasza się do Prezesa URPL lub podmiotu odpowiedzialnego; incydent z wyrobem medycznym (np. wypełniaczem) — do wytwórcy lub URPL. Formularze: urpl.gov.pl.',
  };
}

// --- pacjent i zadania placówki ---------------------------------------------------------------------------------------

export async function aestheticForPatient(patientRef: string) {
  const rows = getDb().prepare("SELECT * FROM aesthetic_procedure WHERE patient_ref = ? AND status = 'podpisana' ORDER BY performed_at DESC").all(patientRef) as unknown as ProcRow[];
  const procedures = [];
  for (const r of rows) procedures.push({ ...(await procView(r, false)), clinic: getClinicSettings(r.org_id).name });
  const consents = (getDb().prepare("SELECT * FROM procedure_consent WHERE patient_ref = ? AND status != 'wycofana' ORDER BY created_at DESC").all(patientRef) as unknown as ConsentRow[]).map((c) => ({
    ...consentView(c),
    clinic: getClinicSettings(c.org_id).name,
    template: consentTemplate(c.template_id),
  }));
  const orgIds = [...new Set([...rows.map((r) => r.org_id), ...(getDb().prepare('SELECT org_id FROM procedure_consent WHERE patient_ref = ? UNION SELECT org_id FROM image_consent WHERE patient_ref = ?').all(patientRef, patientRef) as { org_id: string }[]).map((x) => x.org_id)])];
  const image = orgIds.map((orgId) => ({ orgId, clinic: getClinicSettings(orgId).name, ...getImageConsent(orgId, patientRef) }));
  return { procedures, consents, image };
}

export function markConsentRead(actor: AuditActor, patientRef: string, id: string): void {
  const r = consentRow(id);
  if (!r || r.patient_ref !== patientRef) throw notFound('consent_not_found');
  if (!r.read_at) getDb().prepare('UPDATE procedure_consent SET read_at = ? WHERE id = ?').run(nowIso(), id);
  audit(actor, { action: 'U', subtype: 'procedure-consent-read', patientRef, detail: { id } });
}

export function aestheticTasks(orgId: string) {
  const day = today();
  const week = addDays(day, 7);
  const n = (sql: string, ...args: string[]) => Number((getDb().prepare(sql).get(...args) as { n: number }).n);
  return {
    controlsThisWeek: n("SELECT COUNT(*) AS n FROM aesthetic_procedure WHERE org_id = ? AND status = 'podpisana' AND control_on BETWEEN ? AND ?", orgId, day, week),
    drafts: n("SELECT COUNT(*) AS n FROM aesthetic_procedure WHERE org_id = ? AND status = 'szkic'", orgId),
    consentsToSign: n("SELECT COUNT(*) AS n FROM procedure_consent WHERE org_id = ? AND status = 'do-podpisu'", orgId),
    lotsExpiringSoon: n('SELECT COUNT(*) AS n FROM aesthetic_lot WHERE org_id = ? AND active = 1 AND expiry BETWEEN ? AND ?', orgId, day, addDays(day, 30)),
    lotsExpired: n('SELECT COUNT(*) AS n FROM aesthetic_lot WHERE org_id = ? AND active = 1 AND expiry < ?', orgId, day),
    openComplications: n("SELECT COUNT(*) AS n FROM aesthetic_complication WHERE org_id = ? AND status = 'otwarte'", orgId),
  };
}

/** Przypomnienia: wizyta kontrolna i termin kolejnego zabiegu — treść poza aplikacją ogólna. */
export async function runAestheticReminderSweep(now = new Date()): Promise<number> {
  const day = localDate(now, config.clinic.timezone);
  let sent = 0;
  const controls = getDb().prepare("SELECT id, patient_ref FROM aesthetic_procedure WHERE status = 'podpisana' AND control_on = ? AND control_notified_at IS NULL").all(day) as { id: string; patient_ref: string }[];
  for (const r of controls) {
    await notifyPatient(r.patient_ref, { kind: 'aesthetic', title: 'Wizyta kontrolna po zabiegu', body: 'Dziś mija termin kontroli po zabiegu. Umów wizytę w aplikacji albo telefonicznie.', link: '/moje-zabiegi', pushTitle: 'Eternal', pushBody: 'Masz nowe przypomnienie w aplikacji.' });
    getDb().prepare('UPDATE aesthetic_procedure SET control_notified_at = ? WHERE id = ?').run(nowIso(), r.id);
    sent++;
  }
  const next = getDb().prepare("SELECT id, patient_ref FROM aesthetic_procedure WHERE status = 'podpisana' AND next_on = ? AND next_notified_at IS NULL").all(day) as { id: string; patient_ref: string }[];
  for (const r of next) {
    await notifyPatient(r.patient_ref, { kind: 'aesthetic', title: 'Termin kolejnego zabiegu', body: 'Lekarz zaplanował na dziś możliwy termin kolejnego zabiegu. Umów wizytę, jeśli chcesz go wykonać.', link: '/moje-zabiegi', pushTitle: 'Eternal', pushBody: 'Masz nowe przypomnienie w aplikacji.' });
    getDb().prepare('UPDATE aesthetic_procedure SET next_notified_at = ? WHERE id = ?').run(nowIso(), r.id);
    sent++;
  }
  return sent;
}
