import type { DocumentReference } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { ETERNAL } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { normalizePolishPhone } from '../integrations/channels.js';
import { formatLocal } from '../lib/time.js';
import { badRequest, newId, notFound, nowIso, randomToken, sha256 } from '../lib/util.js';
import { documentHtml, esc } from '../pdf/html.js';
import { getClinicSettings } from './directory.js';
import { type InviteRow, linkUrl } from './invites.js';
import { enqueue } from './notifications.js';
import { CARD_TEMPLATE_VERSION, type CardDoc } from './scribe.js';

/**
 * Karta „Po wizycie” poza panelem: link z SMS (pacjent bez aplikacji), widok w aplikacji pacjenta,
 * przekazanie osobie bliskiej na określony czas (MVP) i osobie upoważnionej przez lekarza
 * (także gdy pacjent był nieprzytomny — art. 31 ust. 6 ustawy o zawodach lekarza i lekarza dentysty).
 */

export interface CardView {
  id: string;
  ref: string;
  clinic: string;
  doctor: string;
  date: string;
  card: CardDoc & { version?: string };
  aiLabel: string;
  appointmentId?: string;
}

const AI_LABEL = 'Przygotowane przez AI, zatwierdzone przez lekarza';

export function isCard(d: DocumentReference): boolean {
  return (d.meta?.tag ?? []).some((t) => t.system === ETERNAL.intakeKind && t.code === 'after-visit');
}

export function toCardView(d: DocumentReference): CardView {
  const json = d.content.find((c) => c.attachment.contentType === 'application/json')?.attachment.data;
  const data = json ? (JSON.parse(Buffer.from(json, 'base64').toString('utf8')) as CardDoc & { clinic: string; doctor: string; date: string; version?: string }) : undefined;
  return {
    id: d.id ?? '',
    ref: `DocumentReference/${d.id}`,
    clinic: data?.clinic ?? d.author?.find((a) => a.reference?.startsWith('Organization/'))?.display ?? '',
    doctor: data?.doctor ?? d.author?.[0]?.display ?? '',
    date: d.date ?? '',
    card: { whatWasDone: data?.whatWasDone ?? [], nextSteps: data?.nextSteps ?? [], whenToReturn: data?.whenToReturn ?? null, warningSigns: data?.warningSigns ?? [], erecipeCode: data?.erecipeCode, version: data?.version },
    aiLabel: AI_LABEL,
    appointmentId: d.context?.related?.find((r) => r.reference?.startsWith('Appointment/'))?.reference?.split('/')[1],
  };
}

export async function createCardLink(input: {
  orgId: string;
  patientRef: string;
  cardRef: string;
  appointmentId?: string;
  days: number;
  createdBy?: string;
  purpose: 'after-visit' | 'card-share';
  phone?: string;
}): Promise<{ id: string; url: string; expiresAt: string }> {
  if (!(input.days >= 1 && input.days <= 365)) throw badRequest('invalid_days');
  const token = randomToken(32);
  const id = newId();
  const expiresAt = new Date(Date.now() + input.days * 86_400_000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO invite_link (id, token_hash, org_id, patient_ref, appointment_id, purpose, subject_ref, phone, expires_at, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(id, sha256(token), input.orgId, input.patientRef, input.appointmentId ?? null, input.purpose, input.cardRef, input.phone ?? null, expiresAt, input.createdBy ?? null, nowIso());
  return { id, url: linkUrl(input.purpose, token), expiresAt };
}

export async function cardForLink(row: InviteRow): Promise<CardView> {
  if (!row.subject_ref) throw notFound('card_not_found');
  const d = await fhirSystem().readOptional<DocumentReference>('DocumentReference', row.subject_ref.split('/')[1]);
  if (!d || !isCard(d) || d.subject?.reference !== row.patient_ref || d.status !== 'current') throw notFound('card_not_found');
  return toCardView(d);
}

export async function listPatientCards(patientRef: string): Promise<CardView[]> {
  const docs = await fhirSystem().search<DocumentReference>('DocumentReference', { subject: patientRef, _tag: `${ETERNAL.intakeKind}|after-visit`, status: 'current', _count: '200' });
  return docs.filter(isCard).map(toCardView).sort((a, b) => b.date.localeCompare(a.date));
}

export async function patientCard(patientRef: string, id: string): Promise<{ view: CardView; doc: DocumentReference }> {
  const d = await fhirSystem().readOptional<DocumentReference>('DocumentReference', id);
  if (!d || !isCard(d) || d.subject?.reference !== patientRef) throw notFound('card_not_found');
  return { view: toCardView(d), doc: d };
}

export function cardHtml(v: CardView): string {
  const list = (title: string, items: string[]) => (items.length ? `<h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const body = `
    <div class="box ai small"><span class="tag ai">AI</span> ${esc(v.aiLabel)}.</div>
    ${list('Co zrobiono na wizycie', v.card.whatWasDone)}
    ${list('Co robić dalej', v.card.nextSteps)}
    ${v.card.whenToReturn ? `<h2>Kiedy wrócić</h2><p>${esc(v.card.whenToReturn)}</p>` : ''}
    ${list('Kiedy zgłosić się wcześniej', v.card.warningSigns)}
    ${v.card.erecipeCode ? `<div class="box"><strong>Kod e-recepty:</strong> ${esc(v.card.erecipeCode)} <span class="small muted">(wpisany przez lekarza; do recepty potrzebny jest też PESEL)</span></div>` : ''}
    <p class="small muted">W nagłym zagrożeniu życia lub zdrowia dzwoń pod 112.</p>`;
  return documentHtml({
    title: 'Karta „Po wizycie”',
    subtitle: `${v.clinic} · ${v.doctor}`,
    org: v.clinic,
    meta: [['Data', formatLocal(v.date, config.clinic.timezone)]],
    body,
    templateVersion: v.card.version ?? CARD_TEMPLATE_VERSION,
    demo: config.demoMode,
  });
}

export interface ShareView {
  id: string;
  label?: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  firstOpenedAt?: string;
}

/** Pacjent udostępnia kartę osobie bliskiej — link na czas (bez dostępu do reszty danych). */
export async function shareCard(actor: AuditActor, patientRef: string, cardId: string, input: { days: number; phone?: string; label?: string }): Promise<{ url: string; expiresAt: string }> {
  const { doc } = await patientCard(patientRef, cardId);
  const orgId = doc.author?.find((a) => a.reference?.startsWith('Organization/'))?.reference?.split('/')[1] ?? '';
  const link = await createCardLink({ orgId, patientRef, cardRef: `DocumentReference/${cardId}`, days: input.days, purpose: 'card-share', createdBy: actor.userId, phone: input.phone });
  getDb().prepare('UPDATE invite_link SET email = ? WHERE id = ?').run(input.label?.slice(0, 80) ?? null, link.id);
  if (input.phone) {
    const number = normalizePolishPhone(input.phone);
    if (!number) throw badRequest('invalid_phone');
    enqueue({ channel: 'sms', recipient: number, subject: '', body: `Udostępniono Ci kartę po wizycie (ważna do ${link.expiresAt.slice(0, 10)}): ${link.url}`, relatedRef: `card-share:${link.id}`, dedupeKey: `card-share:${link.id}` });
  }
  audit(actor, { action: 'C', subtype: 'card-share', entityRef: `DocumentReference/${cardId}`, patientRef, detail: { days: input.days, sms: !!input.phone } });
  return link;
}

/** Lekarz przekazuje kartę osobie upoważnionej (podstawa wskazana i zapisana w dzienniku). */
export async function shareCardByStaff(
  actor: AuditActor,
  input: { orgId: string; patientRef: string; cardRef: string; phone: string; name: string; relation: string; basis: 'patient-authorization' | 'art31-6' },
): Promise<{ expiresAt: string }> {
  const number = normalizePolishPhone(input.phone);
  if (!number) throw badRequest('invalid_phone');
  const link = await createCardLink({ orgId: input.orgId, patientRef: input.patientRef, cardRef: input.cardRef, days: 14, purpose: 'card-share', createdBy: actor.userId, phone: number });
  getDb().prepare('UPDATE invite_link SET email = ? WHERE id = ?').run(`${input.name.slice(0, 60)} (${input.relation.slice(0, 30)})`, link.id);
  const clinic = getClinicSettings(input.orgId).name;
  enqueue({ channel: 'sms', recipient: number, subject: '', body: `${clinic}: przekazujemy kartę po wizycie osoby bliskiej (ważna 14 dni): ${link.url}`, relatedRef: `card-share:${link.id}`, dedupeKey: `card-share:${link.id}` });
  audit(actor, { action: 'C', subtype: 'card-share-authorized', entityRef: input.cardRef, patientRef: input.patientRef, detail: { basis: input.basis, recipient: input.name.slice(0, 60), relation: input.relation.slice(0, 30) } });
  return { expiresAt: link.expiresAt };
}

export function listCardShares(patientRef: string, cardId: string): ShareView[] {
  const rows = getDb()
    .prepare("SELECT * FROM invite_link WHERE patient_ref = ? AND subject_ref = ? AND purpose = 'card-share' ORDER BY created_at DESC")
    .all(patientRef, `DocumentReference/${cardId}`) as unknown as InviteRow[];
  return rows.map((r) => ({
    id: r.id,
    label: r.email ?? undefined,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    status: r.status === 'active' && r.expires_at < nowIso() ? 'expired' : r.status,
    firstOpenedAt: r.first_opened_at ?? undefined,
  }));
}

export function revokeCardShare(actor: AuditActor, patientRef: string, shareId: string): void {
  const res = getDb().prepare("UPDATE invite_link SET status = 'revoked' WHERE id = ? AND patient_ref = ? AND purpose = 'card-share'").run(shareId, patientRef);
  if (!res.changes) throw notFound('share_not_found');
  audit(actor, { action: 'U', subtype: 'card-share-revoke', patientRef, detail: { share: shareId } });
}
