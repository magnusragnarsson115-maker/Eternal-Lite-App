import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { type AppUser, findUserById, listUsers } from '../auth/users.js';
import { getDb } from '../db.js';
import { fhir } from '../fhir/index.js';
import { badRequest, HttpError, newId, notFound, nowIso } from '../lib/util.js';
import { getClinicSettings } from './directory.js';
import { reportIncident } from './incidents.js';
import { notifyPatient, notifyUser } from './notifications.js';
import { staffOrgId } from './orgs.js';

/**
 * Dostęp ratunkowy z pełnym logiem (A24.5, „przełamanie szklanej szyby”): lekarz bez udostępnienia od pacjenta może
 * otworzyć jego dane na 60 minut, gdy pacjent nie jest w stanie udzielić zgody. Warunki:
 *  - wybrany powód z listy i pisemne uzasadnienie (min. 20 znaków), zapisane z wersją tekstu,
 *  - tylko lekarz, który otworzył dostęp, tylko w swojej placówce, limit dzienny,
 *  - pacjent dostaje powiadomienie (bez danych o zdrowiu) i widzi wpis w historii dostępu,
 *  - administrator przegląda każde użycie; „nieuzasadnione” zakłada zgłoszenie naruszenia (art. 33 RODO).
 */

export const EMERGENCY_TEXT_VERSION = 'dostep-ratunkowy/2026-10-1';
export const EMERGENCY_MINUTES = 60;
export const EMERGENCY_DAILY_LIMIT = 5;
export const EMERGENCY_REASONS = ['unconscious', 'life-threat', 'urgent-care'] as const;
export type EmergencyReason = (typeof EMERGENCY_REASONS)[number];

export const REASON_PL: Record<EmergencyReason, string> = {
  unconscious: 'Pacjent nieprzytomny lub niezdolny do wyrażenia zgody',
  'life-threat': 'Bezpośrednie zagrożenie życia lub zdrowia',
  'urgent-care': 'Pilna pomoc, brak możliwości kontaktu z pacjentem',
};

interface Row {
  id: string;
  org_id: string;
  patient_ref: string;
  user_id: string;
  practitioner_ref: string | null;
  user_display: string;
  reason: EmergencyReason;
  justification: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_outcome: 'justified' | 'unjustified' | null;
  review_note: string | null;
}

export interface EmergencyAccessView {
  id: string;
  patientRef: string;
  patientName?: string;
  who: string;
  reason: EmergencyReason;
  reasonText: string;
  justification?: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  active: boolean;
  review?: { outcome: 'justified' | 'unjustified'; at: string; by?: string; note?: string };
}

function toView(r: Row, opts: { withJustification?: boolean; patientName?: string } = {}): EmergencyAccessView {
  const reviewer = r.reviewed_by ? findUserById(r.reviewed_by) : undefined;
  return {
    id: r.id,
    patientRef: r.patient_ref,
    patientName: opts.patientName,
    who: r.user_display,
    reason: r.reason,
    reasonText: REASON_PL[r.reason],
    justification: opts.withJustification ? r.justification : undefined,
    startedAt: r.started_at,
    expiresAt: r.expires_at,
    endedAt: r.ended_at ?? undefined,
    active: !r.ended_at && r.expires_at > nowIso(),
    review: r.review_outcome && r.reviewed_at ? { outcome: r.review_outcome, at: r.reviewed_at, by: reviewer?.display_name, note: opts.withJustification ? (r.review_note ?? undefined) : undefined } : undefined,
  };
}

const getRow = (id: string) => getDb().prepare('SELECT * FROM emergency_access WHERE id = ?').get(id) as Row | undefined;

export async function startEmergencyAccess(
  actor: AuditActor,
  user: AppUser,
  patientId: string,
  input: { reason: EmergencyReason; justification: string },
  now: Date = new Date(),
): Promise<EmergencyAccessView> {
  const orgId = staffOrgId(user);
  if (!orgId) throw badRequest('no_organization');
  const justification = input.justification.trim();
  if (justification.length < 20) throw badRequest('justification_too_short');
  // pacjent musi być znany tej placówce (rejestracja, wizyta) — dostęp ratunkowy nie służy do wyszukiwania obcych osób
  const patient = await fhir().readOptional<Patient>('Patient', patientId);
  if (!patient) throw notFound('patient_not_found');
  const patientRef = `Patient/${patientId}`;
  const active = getDb()
    .prepare('SELECT * FROM emergency_access WHERE user_id = ? AND patient_ref = ? AND ended_at IS NULL AND expires_at > ?')
    .get(user.id, patientRef, now.toISOString()) as Row | undefined;
  if (active) return toView(active, { withJustification: true });
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const used = (getDb().prepare('SELECT COUNT(*) AS n FROM emergency_access WHERE user_id = ? AND started_at > ?').get(user.id, since) as { n: number }).n;
  if (used >= EMERGENCY_DAILY_LIMIT) throw new HttpError(429, 'emergency_access_limit', undefined, { retryAfter: 3600 });
  const id = newId();
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EMERGENCY_MINUTES * 60_000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO emergency_access (id, org_id, patient_ref, user_id, practitioner_ref, user_display, reason, justification, started_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, orgId, patientRef, user.id, user.fhir_ref ?? null, user.display_name, input.reason, justification.slice(0, 2000), startedAt, expiresAt);
  audit(actor, { action: 'E', subtype: 'break-glass', entityRef: `urn:eternal:emergency-access:${id}`, patientRef, detail: { reason: input.reason, minutes: EMERGENCY_MINUTES, text: EMERGENCY_TEXT_VERSION } });
  const clinic = getClinicSettings(orgId).name;
  await notifyPatient(patientRef, {
    kind: 'emergency-access',
    title: 'Dostęp ratunkowy do Twoich danych',
    body: `${clinic}: lekarz otworzył Twoje dane w nagłym przypadku. Kto, kiedy i dlaczego — w zakładce Prywatność.`,
    link: '/prywatnosc',
  });
  for (const a of listUsers({ staffOnly: true }).filter((u) => u.roles.includes('admin') && u.status === 'active' && (u.org_id === orgId || !u.org_id))) {
    await notifyUser(a.id, { kind: 'emergency-access', title: 'Dostęp ratunkowy do przeglądu', body: `${user.display_name}: ${REASON_PL[input.reason]}.`, link: '/panel/organizacja?tab=ratunkowy', push: false });
  }
  return toView(getRow(id)!, { withJustification: true });
}

export function endEmergencyAccess(actor: AuditActor, user: AppUser, id: string): void {
  const r = getRow(id);
  if (!r || r.user_id !== user.id) throw notFound('emergency_access_not_found');
  if (r.ended_at) return;
  getDb().prepare('UPDATE emergency_access SET ended_at = ? WHERE id = ?').run(nowIso(), id);
  audit(actor, { action: 'U', subtype: 'break-glass-end', entityRef: `urn:eternal:emergency-access:${id}`, patientRef: r.patient_ref });
}

export function activeEmergencyFor(user: AppUser, patientRef: string): EmergencyAccessView | undefined {
  const r = getDb()
    .prepare('SELECT * FROM emergency_access WHERE user_id = ? AND patient_ref = ? AND ended_at IS NULL AND expires_at > ? ORDER BY started_at DESC')
    .get(user.id, patientRef, nowIso()) as Row | undefined;
  return r ? toView(r, { withJustification: true }) : undefined;
}

/** Przegląd administratora — najpierw nieprzejrzane. */
export async function listEmergencyForOrg(orgId: string): Promise<EmergencyAccessView[]> {
  const rows = getDb().prepare('SELECT * FROM emergency_access WHERE org_id = ? ORDER BY reviewed_at IS NOT NULL, started_at DESC LIMIT 200').all(orgId) as unknown as Row[];
  const out: EmergencyAccessView[] = [];
  for (const r of rows) {
    const p = await fhir().readOptional<Patient>('Patient', r.patient_ref.split('/')[1] ?? '');
    const n = p?.name?.[0];
    out.push(toView(r, { withJustification: true, patientName: n ? [n.given?.join(' '), n.family].filter(Boolean).join(' ') : undefined }));
  }
  return out;
}

export async function reviewEmergencyAccess(actor: AuditActor, admin: AppUser, id: string, input: { outcome: 'justified' | 'unjustified'; note?: string }): Promise<EmergencyAccessView> {
  const r = getRow(id);
  const orgId = staffOrgId(admin);
  if (!r || r.org_id !== orgId) throw notFound('emergency_access_not_found');
  if (r.reviewed_at) throw new HttpError(409, 'already_reviewed');
  if (input.outcome === 'unjustified' && (input.note?.trim().length ?? 0) < 10) throw badRequest('note_required');
  getDb().prepare('UPDATE emergency_access SET reviewed_at = ?, reviewed_by = ?, review_outcome = ?, review_note = ? WHERE id = ?').run(nowIso(), admin.id, input.outcome, input.note?.trim().slice(0, 2000) ?? null, id);
  audit(actor, { action: 'U', subtype: 'break-glass-review', entityRef: `urn:eternal:emergency-access:${id}`, patientRef: r.patient_ref, detail: { outcome: input.outcome } });
  if (input.outcome === 'unjustified') {
    await reportIncident(actor, {
      orgId,
      reporterKind: 'staff',
      category: 'privacy',
      severity: 'high',
      description: `Dostęp ratunkowy oceniony jako nieuzasadniony (id ${id}, ${r.user_display}, ${r.started_at.slice(0, 16)}). Ocena w ciągu 72 h (art. 33 RODO). Uwagi: ${input.note?.trim() ?? ''}`,
    });
  }
  return toView(getRow(id)!, { withJustification: true });
}

/** Widok pacjenta: kto, kiedy, z jakiego powodu i czy dostęp oceniono — bez uzasadnienia wewnętrznego. */
export function listEmergencyForPatient(patientRef: string): (EmergencyAccessView & { clinic: string })[] {
  const rows = getDb().prepare('SELECT * FROM emergency_access WHERE patient_ref = ? ORDER BY started_at DESC LIMIT 100').all(patientRef) as unknown as Row[];
  return rows.map((r) => ({ ...toView(r), clinic: getClinicSettings(r.org_id).name }));
}
