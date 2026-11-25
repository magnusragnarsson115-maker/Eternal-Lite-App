import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { readPref, writePref } from '../lib/prefs.js';
import { badRequest, HttpError, newId, notFound, nowIso, randomToken, sha256 } from '../lib/util.js';
import { travelCard } from './doctorReport.js';
import { emergencyCard } from './safety.js';
import { eternalIdFor } from './snapshot.js';

/**
 * Eternal ID (runda 5): stały identyfikator rekordu pacjenta, karta z kodem QR i zapis na chip NFC.
 *
 * - Link z karty/chipu jest ODWOŁYWALNY i ma termin ważności; każde otwarcie trafia do dziennika dostępu pacjenta.
 * - Na chip trafia też krótki tekst PL/EN (bez sieci): imię, rok urodzenia, uczulenia, leki i kontakt — tylko to,
 *   co pacjent zaznaczył. Chip może przeczytać każdy telefon z NFC, dlatego domyślnie zapisujemy minimum.
 * - Ubezpieczenie podróżne / EKUZ: dane wpisane przez pacjenta, pokazywane na karcie, bez weryfikacji.
 */

export interface InsuranceInfo {
  provider?: string;
  policyNumber?: string;
  assistancePhone?: string;
  ehicNumber?: string;
  validUntil?: string;
}

export interface NfcChoice {
  name: boolean;
  birthYear: boolean;
  allergies: boolean;
  medications: boolean;
  conditions: boolean;
  contact: boolean;
  insurance: boolean;
}

const DEFAULT_NFC: NfcChoice = { name: true, birthYear: true, allergies: true, medications: false, conditions: false, contact: true, insurance: false };
/** Typowy chip NTAG215 ma ok. 500 bajtów pamięci użytkownika — z adresem URL zostawiamy zapas. */
export const NFC_TEXT_LIMIT = 380;

interface LinkRow {
  id: string;
  patient_ref: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  uses: number;
}

export interface IdLinkView {
  id: string;
  label?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
  uses: number;
  active: boolean;
}

function toLinkView(r: LinkRow): IdLinkView {
  return { id: r.id, label: r.label ?? undefined, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at ?? undefined, lastUsedAt: r.last_used_at ?? undefined, uses: r.uses, active: !r.revoked_at && r.expires_at > nowIso() };
}

export function getInsurance(userId: string): InsuranceInfo {
  return readPref<InsuranceInfo>(userId, 'insurance') ?? {};
}

export function setInsurance(actor: AuditActor, userId: string, patientRef: string, input: InsuranceInfo): InsuranceInfo {
  const clean = (v: string | undefined, max: number) => v?.trim().slice(0, max) || undefined;
  if (input.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)) throw badRequest('invalid_date');
  const v: InsuranceInfo = { provider: clean(input.provider, 80), policyNumber: clean(input.policyNumber, 40), assistancePhone: clean(input.assistancePhone, 30), ehicNumber: clean(input.ehicNumber, 30), validUntil: input.validUntil || undefined };
  writePref(userId, 'insurance', v);
  audit(actor, { action: 'U', subtype: 'insurance-info', patientRef });
  return v;
}

export function getNfcChoice(userId: string): NfcChoice {
  return { ...DEFAULT_NFC, ...(readPref<Partial<NfcChoice>>(userId, 'nfc-choice') ?? {}) };
}

export function setNfcChoice(actor: AuditActor, userId: string, patientRef: string, c: Partial<NfcChoice>): NfcChoice {
  const v = { ...getNfcChoice(userId), ...Object.fromEntries(Object.entries(c).filter(([k, x]) => k in DEFAULT_NFC && typeof x === 'boolean')) } as NfcChoice;
  writePref(userId, 'nfc-choice', v);
  audit(actor, { action: 'U', subtype: 'nfc-choice', patientRef });
  return v;
}

/** Tekst offline na chip (PL/EN) — tylko pola wybrane przez pacjenta, przycięty do pojemności chipu. */
export async function nfcText(userId: string, patientRef: string): Promise<{ text: string; bytes: number; truncated: boolean; choice: NfcChoice }> {
  const choice = getNfcChoice(userId);
  const card = await travelCard(patientRef);
  const ins = getInsurance(userId);
  const lines: string[] = [`ETERNAL ID ${eternalIdFor(patientRef)}`];
  if (choice.name) lines.push(card.name);
  if (choice.birthYear && card.birthDate) lines.push(`ur./born ${card.birthDate.slice(0, 4)}`);
  if (choice.allergies) lines.push(`Uczulenia/Allergies: ${card.allergies === undefined ? 'nie podano/not provided' : card.allergies || 'brak/none'}`);
  if (choice.conditions && card.conditions.length) lines.push(`Choroby/Conditions: ${card.conditions.map((c) => c.en).join(', ')}`);
  if (choice.medications && card.medications.length) lines.push(`Leki/Meds: ${card.medications.join('; ')}`);
  if (choice.contact && card.contacts[0]) lines.push(`ICE: ${card.contacts[0].name} ${card.contacts[0].phone}`);
  if (choice.insurance && (ins.provider || ins.policyNumber)) lines.push(`Ins.: ${[ins.provider, ins.policyNumber, ins.assistancePhone].filter(Boolean).join(' ')}`);
  lines.push('112 · Dane wpisane przez pacjenta / patient-entered');
  let text = lines.join('\n');
  let truncated = false;
  while (Buffer.byteLength(text, 'utf8') > NFC_TEXT_LIMIT && text.length > 20) {
    text = text.slice(0, -2);
    truncated = true;
  }
  if (truncated) text = `${text.trimEnd()}…`;
  return { text, bytes: Buffer.byteLength(text, 'utf8'), truncated, choice };
}

export function listIdLinks(patientRef: string): IdLinkView[] {
  return (getDb().prepare('SELECT * FROM eternal_id_link WHERE patient_ref = ? ORDER BY created_at DESC LIMIT 20').all(patientRef) as unknown as LinkRow[]).map(toLinkView);
}

/** Nowy link do karty (dla QR i chipu NFC). Token pokazywany raz; w bazie tylko skrót. */
export function createIdLink(actor: AuditActor, patientRef: string, input: { days: number; label?: string }): { url: string; link: IdLinkView } {
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 730) throw badRequest('invalid_value');
  const active = listIdLinks(patientRef).filter((l) => l.active).length;
  if (active >= 5) throw badRequest('too_many');
  const token = randomToken(32);
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare('INSERT INTO eternal_id_link (id, patient_ref, token_hash, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, patientRef, sha256(token), input.label?.trim().slice(0, 60) || null, now, new Date(Date.now() + input.days * 86_400_000).toISOString());
  audit(actor, { action: 'C', subtype: 'eternal-id-link', patientRef, detail: { link: id, days: input.days } });
  return { url: `${config.publicUrl}/id/${token}`, link: toLinkView(getDb().prepare('SELECT * FROM eternal_id_link WHERE id = ?').get(id) as unknown as LinkRow) };
}

export function revokeIdLink(actor: AuditActor, patientRef: string, id: string): void {
  const r = getDb().prepare('SELECT * FROM eternal_id_link WHERE id = ? AND patient_ref = ?').get(id, patientRef) as LinkRow | undefined;
  if (!r) throw notFound('link_not_found');
  getDb().prepare('UPDATE eternal_id_link SET revoked_at = ? WHERE id = ?').run(nowIso(), id);
  audit(actor, { action: 'U', subtype: 'eternal-id-link-revoke', patientRef, detail: { link: id } });
}

/** Otwarcie karty spod linku (QR/NFC) przez osobę trzecią — zapis w dzienniku dostępu pacjenta. */
export async function cardForIdToken(token: string, actor: AuditActor) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(410, 'link_invalid');
  const r = getDb().prepare('SELECT * FROM eternal_id_link WHERE token_hash = ?').get(sha256(token)) as LinkRow | undefined;
  if (!r || r.revoked_at || r.expires_at < nowIso()) throw new HttpError(410, 'link_expired');
  getDb().prepare('UPDATE eternal_id_link SET uses = uses + 1, last_used_at = ? WHERE id = ?').run(nowIso(), r.id);
  audit({ ...actor, display: 'Osoba z kartą Eternal ID (QR/NFC)' }, { action: 'R', subtype: 'emergency-access', patientRef: r.patient_ref, detail: { eternalIdLink: r.id } });
  const userRow = getDb().prepare("SELECT id FROM app_user WHERE fhir_ref = ? AND status = 'active'").get(r.patient_ref) as { id: string } | undefined;
  const ins = userRow ? getInsurance(userRow.id) : {};
  const travel = await travelCard(r.patient_ref);
  return {
    ...(await emergencyCard(r.patient_ref)),
    eternalId: eternalIdFor(r.patient_ref),
    allergies: travel.allergies,
    conditions: travel.conditions,
    insurance: userRow && getNfcChoice(userRow.id).insurance ? ins : undefined,
    expiresAt: r.expires_at,
  };
}
