import type { Appointment, Organization, Patient } from '@medplum/fhirtypes';
import QRCode from 'qrcode';
import type { FastifyRequest } from 'fastify';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { normalizePolishPhone } from '../integrations/channels.js';
import { formatLocal } from '../lib/time.js';
import { badRequest, conflict, HttpError, newId, notFound, nowIso, randomToken, sha256 } from '../lib/util.js';
import { currentOrgId } from '../tenancy.js';
import { getClinicSettings } from './directory.js';
import { createGrant, getGrantRow, revokeGrant, toGrantView, type GrantView } from './grants.js';
import { enqueue } from './notifications.js';

/**
 * Linki z tokenem (D1, DOC-07; R3): strona pacjenta bez konta i bez instalowania.
 * - intake — zaproszenie do przekazania dokumentów przed wizytą (zgoda → wgranie → potwierdzenie odczytu),
 * - after-visit — karta „Po wizycie” (drugi SMS),
 * - card-share — karta przekazana osobie upoważnionej przez pacjenta (link na czas).
 * Token: 256 bitów losowych, w bazie tylko skrót; zakres (pacjent, klinika, wizyta, cel) i termin w rekordzie linku.
 */

export type LinkPurpose = 'intake' | 'after-visit' | 'card-share';

export interface InviteRow {
  id: string;
  token_hash: string;
  org_id: string;
  patient_ref: string;
  appointment_id: string | null;
  purpose: LinkPurpose;
  subject_ref: string | null;
  phone: string | null;
  email: string | null;
  expires_at: string;
  status: 'active' | 'revoked' | 'expired' | 'used';
  created_by: string | null;
  created_at: string;
  first_opened_at: string | null;
  last_opened_at: string | null;
  sent_channels: string | null;
  grant_id: string | null;
  uses: number;
}

export interface InviteView {
  id: string;
  purpose: LinkPurpose;
  patientId: string;
  appointmentId?: string;
  phone?: string;
  expiresAt: string;
  status: InviteRow['status'];
  createdAt: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  sentChannels: string[];
  grant?: GrantView;
}

export function toInviteView(r: InviteRow): InviteView {
  const grantRow = r.grant_id ? getGrantRow(r.grant_id) : undefined;
  return {
    id: r.id,
    purpose: r.purpose,
    patientId: idFromRef(r.patient_ref),
    appointmentId: r.appointment_id ?? undefined,
    phone: r.phone ? `${r.phone.slice(0, -3).replace(/\d/g, '•')}${r.phone.slice(-3)}` : undefined,
    expiresAt: r.expires_at,
    status: r.status === 'active' && r.expires_at < nowIso() ? 'expired' : r.status,
    createdAt: r.created_at,
    firstOpenedAt: r.first_opened_at ?? undefined,
    lastOpenedAt: r.last_opened_at ?? undefined,
    sentChannels: r.sent_channels ? (JSON.parse(r.sent_channels) as string[]) : [],
    grant: grantRow ? toGrantView(grantRow) : undefined,
  };
}

const PATH: Record<LinkPurpose, string> = { intake: 'z', 'after-visit': 'k', 'card-share': 'k' };

export function linkUrl(purpose: LinkPurpose, token: string): string {
  return `${config.publicUrl}/${PATH[purpose]}/${token}`;
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 220 });
}

function insertLink(input: {
  orgId: string;
  patientRef: string;
  appointmentId?: string;
  purpose: LinkPurpose;
  subjectRef?: string;
  phone?: string;
  email?: string;
  expiresAt: string;
  createdBy?: string;
  grantId?: string;
}): { id: string; token: string } {
  const token = randomToken(32);
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO invite_link (id, token_hash, org_id, patient_ref, appointment_id, purpose, subject_ref, phone, email, expires_at, status, created_by, created_at, grant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(
      id,
      sha256(token),
      input.orgId,
      input.patientRef,
      input.appointmentId ?? null,
      input.purpose,
      input.subjectRef ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.expiresAt,
      input.createdBy ?? null,
      nowIso(),
      input.grantId ?? null,
    );
  return { id, token };
}

function appointmentEnd(appt: Appointment): Date {
  return new Date(appt.end ?? appt.start ?? Date.now());
}

/** Ważność: do wizyty + N dni (ustawienie kliniki, [ZAŁ.] 30); bez wizyty — N dni od dziś. */
export function inviteExpiry(appt: Appointment | undefined, orgId?: string): string {
  const days = getClinicSettings(orgId).inviteValidityDaysAfterVisit;
  const base = appt ? appointmentEnd(appt) : new Date();
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

function orgDisplayName(orgId: string, fallback?: string): string {
  return getClinicSettings(orgId).name || fallback || 'Placówka';
}

async function sendLinkSms(row: { id: string; phone?: string | null }, text: string): Promise<string[]> {
  if (!row.phone) return [];
  const phone = normalizePolishPhone(row.phone);
  if (!phone) throw badRequest('invalid_phone');
  enqueue({ channel: 'sms', recipient: phone, subject: '', body: text, relatedRef: `invite:${row.id}`, dedupeKey: `invite:${row.id}:${Date.now()}` });
  const channels = ['sms'];
  getDb().prepare('UPDATE invite_link SET sent_channels = ? WHERE id = ?').run(JSON.stringify(channels), row.id);
  return channels;
}

/** Rejestracja: telefon pacjenta i termin → SMS z linkiem (albo kod QR do pokazania w rejestracji). */
export async function createIntakeInvite(
  actor: AuditActor,
  input: { patientId: string; appointmentId?: string; phone?: string; send: boolean },
): Promise<{ invite: InviteView; url: string; qr: string; smsQueued: boolean }> {
  const orgId = currentOrgId();
  if (!orgId) throw badRequest('no_organization');
  const patient = await fhir().read<Patient>('Patient', input.patientId);
  const patientRef = `Patient/${patient.id}`;
  let appt: Appointment | undefined;
  if (input.appointmentId) {
    appt = await fhir().read<Appointment>('Appointment', input.appointmentId);
    if (!appt.participant.some((p) => p.actor?.reference === patientRef)) throw badRequest('appointment_patient_mismatch');
    if (['cancelled', 'noshow', 'entered-in-error'].includes(appt.status)) throw conflict('appointment_not_active');
  }
  const phone = input.phone?.trim() || patient.telecom?.find((t) => t.system === 'phone')?.value;
  if (input.send && !phone) throw badRequest('phone_required');
  // poprzednie aktywne zaproszenie do tej samej wizyty traci ważność — jeden ważny link na wizytę
  if (input.appointmentId) {
    getDb().prepare("UPDATE invite_link SET status = 'revoked' WHERE appointment_id = ? AND purpose = 'intake' AND status = 'active' AND grant_id IS NULL").run(input.appointmentId);
  }
  const { id, token } = insertLink({
    orgId,
    patientRef,
    appointmentId: input.appointmentId,
    purpose: 'intake',
    phone,
    expiresAt: inviteExpiry(appt, orgId),
    createdBy: actor.userId,
  });
  const url = linkUrl('intake', token);
  const clinic = orgDisplayName(orgId);
  let smsQueued = false;
  if (input.send && phone) {
    const when = appt?.start ? ` przed wizytą ${formatLocal(appt.start, config.clinic.timezone)}` : '';
    await sendLinkSms({ id, phone }, `${clinic}: prosimy o przesłanie dokumentów${when}. Link (bez instalowania aplikacji): ${url}`);
    smsQueued = true;
  }
  audit(actor, { action: 'C', subtype: 'invite-create', entityRef: input.appointmentId ? `Appointment/${input.appointmentId}` : undefined, patientRef, detail: { invite: id, sms: smsQueued } });
  const row = getInviteRow(id)!;
  return { invite: toInviteView(row), url, qr: await qrSvg(url), smsQueued };
}

/** Ponowne wysłanie (przypomnienie z D2) — nowy token; poprzedni link pozostaje ważny, jeśli pacjent już go używa. */
export async function remindInvite(actor: AuditActor, inviteId: string): Promise<{ smsQueued: boolean }> {
  const row = getInviteRow(inviteId);
  if (!row || row.org_id !== currentOrgId()) throw notFound('invite_not_found');
  if (row.status !== 'active' || row.expires_at < nowIso()) throw conflict('invite_not_active');
  if (!row.phone) throw badRequest('phone_required');
  const appt = row.appointment_id ? await fhir().readOptional<Appointment>('Appointment', row.appointment_id) : undefined;
  // nowy token w tym samym rekordzie (stary link przestaje działać — w SMS-ie jest zawsze aktualny)
  const token = randomToken(32);
  getDb().prepare('UPDATE invite_link SET token_hash = ? WHERE id = ?').run(sha256(token), row.id);
  const clinic = orgDisplayName(row.org_id);
  const when = appt?.start ? ` przed wizytą ${formatLocal(appt.start, config.clinic.timezone)}` : '';
  await sendLinkSms(row, `${clinic}: przypominamy o przesłaniu dokumentów${when}. Link: ${linkUrl('intake', token)}`);
  audit(actor, { action: 'U', subtype: 'invite-remind', patientRef: row.patient_ref, detail: { invite: row.id } });
  return { smsQueued: true };
}

export async function revokeInvite(actor: AuditActor, inviteId: string): Promise<InviteView> {
  const row = getInviteRow(inviteId);
  if (!row || row.org_id !== currentOrgId()) throw notFound('invite_not_found');
  getDb().prepare("UPDATE invite_link SET status = 'revoked' WHERE id = ?").run(row.id);
  audit(actor, { action: 'U', subtype: 'invite-revoke', patientRef: row.patient_ref, detail: { invite: row.id } });
  return toInviteView(getInviteRow(row.id)!);
}

export function getInviteRow(id: string): InviteRow | undefined {
  return getDb().prepare('SELECT * FROM invite_link WHERE id = ?').get(id) as InviteRow | undefined;
}

export function listInvites(filter: { appointmentId?: string; patientRef?: string; orgId?: string }): InviteView[] {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.appointmentId) { where.push('appointment_id = ?'); args.push(filter.appointmentId); }
  if (filter.patientRef) { where.push('patient_ref = ?'); args.push(filter.patientRef); }
  if (filter.orgId) { where.push('org_id = ?'); args.push(filter.orgId); }
  const rows = getDb().prepare(`SELECT * FROM invite_link ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 200`).all(...args) as unknown as InviteRow[];
  return rows.map(toInviteView);
}

/** Rozwiązanie tokenu z adresu. Nieważny, wygasły albo odwołany link — 410 (bez ujawniania szczegółów). */
export function resolveLink(token: string, purposes: LinkPurpose[]): InviteRow {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(410, 'link_invalid');
  const row = getDb().prepare('SELECT * FROM invite_link WHERE token_hash = ?').get(sha256(token)) as InviteRow | undefined;
  if (!row || !purposes.includes(row.purpose)) throw new HttpError(410, 'link_invalid');
  if (row.status === 'revoked') throw new HttpError(410, 'link_revoked');
  if (row.status !== 'active' || row.expires_at < nowIso()) throw new HttpError(410, 'link_expired');
  const now = nowIso();
  getDb().prepare('UPDATE invite_link SET first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?, uses = uses + 1 WHERE id = ?').run(now, now, row.id);
  return row;
}

/** Aktor w dzienniku dla działań pacjenta przez link (bez konta). */
export function linkActor(req: FastifyRequest, row: InviteRow, display = 'Pacjent (link z SMS)'): AuditActor {
  return { actorRef: row.patient_ref, display, roles: ['patient'], ip: req.ip, userAgent: req.headers['user-agent'] };
}

/** Pacjent wyraża zgodę na stronie pod linkiem → udostępnienie klinice, która zaprosiła, do terminu linku. */
export async function acceptIntakeConsent(actor: AuditActor, row: InviteRow): Promise<GrantView> {
  if (row.grant_id) {
    const g = getGrantRow(row.grant_id);
    if (g && g.status === 'active') return toGrantView(g);
  }
  const grant = await createGrant(actor, {
    patientRef: row.patient_ref,
    orgId: row.org_id,
    scope: { kind: 'all' },
    purpose: 'visit',
    appointmentId: row.appointment_id ?? undefined,
    source: 'invite',
    expiresAt: row.expires_at,
    inviteId: row.id,
  });
  getDb().prepare('UPDATE invite_link SET grant_id = ? WHERE id = ?').run(grant.id, row.id);
  return grant;
}

/** Odwołanie zgody spod linku — natychmiast odbiera klinice dostęp i unieważnia link. */
export async function withdrawViaLink(actor: AuditActor, row: InviteRow): Promise<void> {
  if (!row.grant_id) {
    getDb().prepare("UPDATE invite_link SET status = 'revoked' WHERE id = ?").run(row.id);
    audit(actor, { action: 'U', subtype: 'invite-withdraw', patientRef: row.patient_ref, detail: { invite: row.id } });
    return;
  }
  await revokeGrant(actor, row.grant_id, { patientRef: row.patient_ref });
}

export async function linkContext(row: InviteRow) {
  const org = await fhirSystem().readOptional<Organization>('Organization', row.org_id);
  const patient = await fhirSystem().readOptional<Patient>('Patient', idFromRef(row.patient_ref));
  const appt = row.appointment_id ? await fhirSystem().readOptional<Appointment>('Appointment', row.appointment_id) : undefined;
  const settings = getClinicSettings(row.org_id);
  const given = patient?.name?.[0]?.given?.[0];
  const family = patient?.name?.[0]?.family;
  const grantRow = row.grant_id ? getGrantRow(row.grant_id) : undefined;
  return {
    purpose: row.purpose,
    clinic: { name: settings.name || org?.name || 'Placówka', phone: settings.phone || undefined, privacyContact: settings.privacyContact || undefined, address: settings.address || undefined },
    // tylko imię i inicjał nazwiska — potwierdzenie, że link dotyczy właściwej osoby, bez ujawniania danych
    patientLabel: given ? `${given} ${family ? `${family[0]}.` : ''}`.trim() : undefined,
    appointment: appt?.start ? { start: appt.start, status: appt.status } : undefined,
    expiresAt: row.expires_at,
    grant: grantRow ? toGrantView(grantRow) : undefined,
    demo: config.demoMode,
  };
}
