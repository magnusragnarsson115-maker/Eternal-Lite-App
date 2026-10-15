import { directiveCardLines, listDirectives } from './healthHistory.js';
import type { MedicationStatement, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { normalizePolishPhone } from '../integrations/channels.js';
import { badRequest, HttpError, newId, notFound, nowIso, randomToken, sha256 } from '../lib/util.js';
import { enqueue, notifyPatient } from './notifications.js';

/**
 * Ratunek jednym kliknięciem (A5.3, A5.10, S4.2): najpierw połączenie z 112 (wykonuje telefon pacjenta),
 * równolegle SMS do osób bliskich z linkiem do karty ratunkowej ważnym 24 h; każdy odczyt karty w dzienniku
 * (dostęp ratunkowy). Karta zawiera tylko to, co pacjent sam wpisał i wybrał — aplikacja niczego nie ocenia.
 * Numery kryzysowe 112 i 116 123 są w menu pomocy zawsze (F8.1, F8.4).
 */

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

export interface EmergencyInfo {
  notes: string;
  includeMedications: boolean;
}

const MAX_CONTACTS = 5;

export function listContacts(patientRef: string): EmergencyContact[] {
  return (getDb().prepare('SELECT id, name, phone, relation FROM emergency_contact WHERE patient_ref = ? ORDER BY created_at').all(patientRef) as unknown as (EmergencyContact & { relation: string | null })[]).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    relation: r.relation ?? undefined,
  }));
}

export function addContact(actor: AuditActor, patientRef: string, input: { name: string; phone: string; relation?: string }): EmergencyContact[] {
  if (listContacts(patientRef).length >= MAX_CONTACTS) throw badRequest('too_many_contacts');
  const phone = normalizePolishPhone(input.phone);
  if (!phone) throw badRequest('invalid_phone');
  getDb().prepare('INSERT INTO emergency_contact (id, patient_ref, name, phone, relation, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(newId(), patientRef, input.name.trim().slice(0, 80), `+${phone}`, input.relation?.trim().slice(0, 40) ?? null, nowIso());
  audit(actor, { action: 'C', subtype: 'emergency-contact-add', patientRef });
  return listContacts(patientRef);
}

export function removeContact(actor: AuditActor, patientRef: string, id: string): EmergencyContact[] {
  const res = getDb().prepare('DELETE FROM emergency_contact WHERE id = ? AND patient_ref = ?').run(id, patientRef);
  if (!res.changes) throw notFound('contact_not_found');
  audit(actor, { action: 'D', subtype: 'emergency-contact-remove', patientRef });
  return listContacts(patientRef);
}

function infoKey(patientRef: string): string {
  return `emergency:${patientRef}`;
}

export function getEmergencyInfo(patientRef: string): EmergencyInfo {
  const row = getDb().prepare('SELECT value FROM setting WHERE key = ?').get(infoKey(patientRef)) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as EmergencyInfo) : { notes: '', includeMedications: true };
}

export function setEmergencyInfo(actor: AuditActor, patientRef: string, info: EmergencyInfo): EmergencyInfo {
  const clean = { notes: info.notes.trim().slice(0, 1000), includeMedications: info.includeMedications };
  getDb()
    .prepare('INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(infoKey(patientRef), JSON.stringify(clean), nowIso());
  audit(actor, { action: 'U', subtype: 'emergency-info-update', patientRef });
  return clean;
}

export async function emergencyCard(patientRef: string) {
  const p = await fhirSystem().read<Patient>('Patient', patientRef.split('/')[1]);
  const info = getEmergencyInfo(patientRef);
  const name = p.name?.[0];
  let medications: string[] = [];
  if (info.includeMedications) {
    const meds = await fhirSystem().search<MedicationStatement>('MedicationStatement', { subject: patientRef, status: 'active', _count: '50' });
    medications = meds.map((m) => [m.medicationCodeableConcept?.text, m.dosage?.[0]?.text].filter(Boolean).join(' — ')).filter(Boolean);
  }
  return {
    name: name ? `${(name.given ?? []).join(' ')} ${name.family ?? ''}`.trim() : '',
    birthDate: p.birthDate,
    notes: info.notes,
    medications,
    contacts: listContacts(patientRef).map((c) => ({ name: c.name, phone: c.phone, relation: c.relation })),
    // A22.5 — dyspozycje, które pacjent zaznaczył do pokazania na karcie
    directives: directiveCardLines(await listDirectives(patientRef)).map((l) => l.pl),
    disclaimer: 'Informacje wpisane przez pacjenta w aplikacji Eternal, bez weryfikacji medycznej.',
  };
}

/** Przycisk SOS: zapis zdarzenia, SMS do osób bliskich (bez danych o zdrowiu w treści), link do karty na 24 h. */
export async function triggerSos(actor: AuditActor, patientRef: string, input: { lat?: number; lng?: number; displayName: string }): Promise<{ notified: number; cardUrl: string }> {
  const contacts = listContacts(patientRef);
  const token = randomToken(32);
  const id = newId();
  const location = input.lat !== undefined && input.lng !== undefined && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180 ? `${input.lat.toFixed(5)},${input.lng.toFixed(5)}` : null;
  getDb()
    .prepare('INSERT INTO sos_event (id, patient_ref, ts, notified, location, card_token_hash, card_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, patientRef, nowIso(), JSON.stringify(contacts.map((c) => c.id)), location, sha256(token), new Date(Date.now() + 24 * 3_600_000).toISOString());
  const cardUrl = `${config.publicUrl}/ratunek/${token}`;
  for (const c of contacts) {
    const body = `${input.displayName} użył(a) przycisku SOS w aplikacji Eternal. Zadzwoń do tej osoby.${location ? ` Lokalizacja: https://www.openstreetmap.org/?mlat=${location.split(',')[0]}&mlon=${location.split(',')[1]}` : ''} Karta ratunkowa (24 h): ${cardUrl}`;
    enqueue({ channel: 'sms', recipient: c.phone, subject: '', body, relatedRef: `sos:${id}`, dedupeKey: `sos:${id}:${c.id}` });
  }
  audit(actor, { action: 'E', subtype: 'sos', patientRef, detail: { contacts: contacts.length, location: !!location } });
  await notifyPatient(patientRef, { kind: 'sos', title: 'Wysłano powiadomienie SOS', body: contacts.length ? `Powiadomiono osoby bliskie: ${contacts.length}.` : 'Nie masz zapisanych osób bliskich — dodaj je w ustawieniach.', push: false });
  return { notified: contacts.length, cardUrl };
}

/** Odczyt karty ratunkowej spod linku z SMS — dostęp ratunkowy zapisany w dzienniku pacjenta. */
export async function cardForSosToken(token: string, actor: AuditActor) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(410, 'link_invalid');
  const row = getDb().prepare('SELECT * FROM sos_event WHERE card_token_hash = ?').get(sha256(token)) as { id: string; patient_ref: string; ts: string; location: string | null; card_expires_at: string } | undefined;
  if (!row || row.card_expires_at < nowIso()) throw new HttpError(410, 'link_expired');
  audit({ ...actor, display: 'Osoba bliska (link SOS)' }, { action: 'R', subtype: 'emergency-access', patientRef: row.patient_ref, detail: { sos: row.id } });
  return { ...(await emergencyCard(row.patient_ref)), sosAt: row.ts, location: row.location ?? undefined, expiresAt: row.card_expires_at };
}

const CRISIS_PATTERNS = [/samob[oó]j/i, /zabi(ć|c) si[eę]/i, /odebra(ć|c) sobie (?:ż|z)ycie/i, /nie chc[eę] (?:ju(?:ż|z) )?(?:ż|z)y(ć|c)/i, /sko(ń|n)czy(ć|c) ze sob[aą]/i, /suicid/i, /kill myself/i];

/** Wykrycie słów kryzysowych w tekście pacjenta (F8.1) — tylko po to, by pokazać numery pomocy; bez oceny. */
export function crisisMentioned(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}
