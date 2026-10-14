import type { Consent, Organization } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { getDb, transaction } from '../db.js';
import { bus } from '../events.js';
import { CONSENT_SCOPE, ETERNAL } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { badRequest, forbidden, newId, notFound, nowIso } from '../lib/util.js';
import { orgTag, vaultOrgId } from '../tenancy.js';
import { staffOrgId } from './orgs.js';

/**
 * Udostępnienia danych pacjenta klinice (D1, P2, R4): zakres × odbiorca × czas, odmowa domyślna,
 * wygasanie i odwołanie z natychmiastowym unieważnieniem linków. Każde udostępnienie ma zasób Consent
 * (data, wersja treści zgody, okres) — podstawa z art. 9 ust. 2 lit. a RODO.
 */

export const CONSENT_TEXT_VERSION = 'udostepnienie/2026-10-1';

export type GrantScope = { kind: 'all' } | { kind: 'results' } | { kind: 'documents' } | { kind: 'selected'; refs: string[] };
export type GrantPurpose = 'visit' | 'consultation' | 'second-opinion' | 'other';
export type GrantSource = 'invite' | 'app';

export interface GrantRow {
  id: string;
  patient_ref: string;
  org_id: string;
  practitioner_ref: string | null;
  scope: string;
  purpose: GrantPurpose;
  appointment_id: string | null;
  consent_ref: string | null;
  source: GrantSource;
  starts_at: string;
  expires_at: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  recipient_label: string | null;
  invite_id: string | null;
}

export interface GrantView {
  id: string;
  patientRef: string;
  orgId: string;
  recipient: string;
  practitionerRef?: string;
  scope: GrantScope;
  purpose: GrantPurpose;
  appointmentId?: string;
  source: GrantSource;
  startsAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  revokedAt?: string;
}

export function toGrantView(r: GrantRow): GrantView {
  const expired = r.status === 'active' && r.expires_at < nowIso();
  return {
    id: r.id,
    patientRef: r.patient_ref,
    orgId: r.org_id,
    recipient: r.recipient_label ?? r.org_id,
    practitionerRef: r.practitioner_ref ?? undefined,
    scope: JSON.parse(r.scope) as GrantScope,
    purpose: r.purpose,
    appointmentId: r.appointment_id ?? undefined,
    source: r.source,
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    status: expired ? 'expired' : r.status,
    createdAt: r.created_at,
    revokedAt: r.revoked_at ?? undefined,
  };
}

const PURPOSE_PL: Record<GrantPurpose, string> = {
  visit: 'Przygotowanie do wizyty',
  consultation: 'Konsultacja',
  'second-opinion': 'Druga opinia',
  other: 'Inny cel wskazany przez pacjenta',
};

const SCOPE_PL: Record<GrantScope['kind'], string> = {
  all: 'wszystkie wgrane dokumenty i wyniki',
  results: 'wyniki badań',
  documents: 'dokumenty (bez wyników badań)',
  selected: 'wybrane dokumenty i wyniki',
};

export function describeGrant(g: Pick<GrantView, 'scope' | 'purpose'>): { purpose: string; scope: string } {
  return { purpose: PURPOSE_PL[g.purpose], scope: SCOPE_PL[g.scope.kind] };
}

async function orgName(orgId: string): Promise<string> {
  const org = await fhirSystem().readOptional<Organization>('Organization', orgId);
  if (!org) throw notFound('organization_not_found');
  return org.name ?? orgId;
}

export async function createGrant(
  actor: AuditActor,
  input: {
    patientRef: string;
    orgId: string;
    practitionerRef?: string;
    scope: GrantScope;
    purpose: GrantPurpose;
    appointmentId?: string;
    source: GrantSource;
    expiresAt: string;
    inviteId?: string;
  },
): Promise<GrantView> {
  const now = nowIso();
  if (input.expiresAt <= now) throw badRequest('grant_expiry_in_past');
  if (Date.parse(input.expiresAt) - Date.now() > 400 * 86_400_000) throw badRequest('grant_too_long');
  if (input.scope.kind === 'selected' && !input.scope.refs.length) throw badRequest('grant_empty_selection');
  const label = await orgName(input.orgId);
  // zasób zgody należy do sejfu pacjenta i do organizacji odbiorcy (klinika widzi podstawę dostępu)
  const consent = await fhir().create<Consent>({
    resourceType: 'Consent',
    meta: { tag: [orgTag(vaultOrgId(input.patientRef)), orgTag(input.orgId)] },
    status: 'active',
    scope: { coding: [{ system: CONSENT_SCOPE, code: 'patient-privacy' }] },
    category: [{ coding: [{ system: ETERNAL.consentType, code: 'share-org', display: 'Udostępnienie danych klinice' }] }],
    patient: { reference: input.patientRef },
    dateTime: now,
    organization: [{ reference: `Organization/${input.orgId}`, display: label }],
    policy: [{ uri: `urn:eternal:consent-text:${CONSENT_TEXT_VERSION}` }],
    provision: {
      type: 'permit',
      period: { start: now, end: input.expiresAt },
      actor: [
        {
          role: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'IRCP', display: 'information recipient' }] },
          reference: input.practitionerRef ? { reference: input.practitionerRef } : { reference: `Organization/${input.orgId}`, display: label },
        },
      ],
      purpose: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'TREAT', display: PURPOSE_PL[input.purpose] }],
      data: input.scope.kind === 'selected' ? input.scope.refs.map((r) => ({ meaning: 'instance' as const, reference: { reference: r } })) : undefined,
    },
  });
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO access_grant (id, patient_ref, org_id, practitioner_ref, scope, purpose, appointment_id, consent_ref, source, starts_at, expires_at,
         status, created_at, recipient_label, invite_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(
      id,
      input.patientRef,
      input.orgId,
      input.practitionerRef ?? null,
      JSON.stringify(input.scope),
      input.purpose,
      input.appointmentId ?? null,
      `Consent/${consent.id}`,
      input.source,
      now,
      input.expiresAt,
      now,
      label,
      input.inviteId ?? null,
    );
  audit(actor, {
    action: 'C',
    subtype: 'grant-create',
    entityRef: `Consent/${consent.id}`,
    patientRef: input.patientRef,
    detail: { grant: id, org: input.orgId, scope: input.scope.kind, purpose: input.purpose, expiresAt: input.expiresAt, textVersion: CONSENT_TEXT_VERSION },
  });
  bus.publish({ type: 'grant.changed', patientRef: input.patientRef, orgIds: [input.orgId] });
  return toGrantView(getGrantRow(id)!);
}

export function getGrantRow(id: string): GrantRow | undefined {
  return getDb().prepare('SELECT * FROM access_grant WHERE id = ?').get(id) as GrantRow | undefined;
}

export function listGrantsForPatient(patientRef: string): GrantView[] {
  return (getDb().prepare('SELECT * FROM access_grant WHERE patient_ref = ? ORDER BY created_at DESC').all(patientRef) as unknown as GrantRow[]).map(toGrantView);
}

/** Pacjenci, którzy udostępnili dane klinice — z datą wygaśnięcia (panel D1). */
export function listGrantsForOrg(orgId: string, opts: { includeInactive?: boolean } = {}): GrantView[] {
  const rows = getDb()
    .prepare(`SELECT * FROM access_grant WHERE org_id = ? ${opts.includeInactive ? '' : "AND status = 'active' AND expires_at > ?"} ORDER BY expires_at`)
    .all(...(opts.includeInactive ? [orgId] : [orgId, nowIso()])) as unknown as GrantRow[];
  return rows.map(toGrantView);
}

export async function revokeGrant(actor: AuditActor, grantId: string, by: { patientRef?: string; orgId?: string }): Promise<GrantView> {
  const row = getGrantRow(grantId);
  if (!row) throw notFound('grant_not_found');
  if (by.patientRef && row.patient_ref !== by.patientRef) throw notFound('grant_not_found');
  if (by.orgId && row.org_id !== by.orgId) throw notFound('grant_not_found');
  if (row.status !== 'active') return toGrantView(row);
  const now = nowIso();
  transaction(getDb(), () => {
    getDb().prepare("UPDATE access_grant SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE id = ?").run(now, actor.userId ?? actor.actorRef ?? null, grantId);
    // natychmiastowe unieważnienie linków związanych z udostępnieniem
    getDb().prepare("UPDATE invite_link SET status = 'revoked' WHERE grant_id = ? AND status = 'active'").run(grantId);
  });
  if (row.consent_ref) {
    const consent = await fhirSystem().readOptional<Consent>('Consent', row.consent_ref.split('/')[1]);
    if (consent) {
      await fhirSystem().update<Consent>({
        ...consent,
        status: 'inactive',
        provision: { ...consent.provision, period: { ...consent.provision?.period, end: now } },
      });
    }
  }
  audit(actor, { action: 'U', subtype: 'grant-revoke', entityRef: row.consent_ref ?? undefined, patientRef: row.patient_ref, detail: { grant: grantId, org: row.org_id } });
  bus.publish({ type: 'grant.changed', patientRef: row.patient_ref, orgIds: [row.org_id] });
  return toGrantView(getGrantRow(grantId)!);
}

/** Zadanie okresowe: oznaczenie wygasłych udostępnień i zamknięcie zasobów Consent. */
export async function expireGrants(): Promise<number> {
  const rows = getDb().prepare("SELECT * FROM access_grant WHERE status = 'active' AND expires_at <= ?").all(nowIso()) as unknown as GrantRow[];
  for (const r of rows) {
    getDb().prepare("UPDATE access_grant SET status = 'expired' WHERE id = ?").run(r.id);
    getDb().prepare("UPDATE invite_link SET status = 'expired' WHERE grant_id = ? AND status = 'active'").run(r.id);
    if (r.consent_ref) {
      const consent = await fhirSystem().readOptional<Consent>('Consent', r.consent_ref.split('/')[1]);
      if (consent && consent.status === 'active') await fhirSystem().update<Consent>({ ...consent, status: 'inactive' });
    }
    audit(undefined, { action: 'U', subtype: 'grant-expired', patientRef: r.patient_ref, detail: { grant: r.id, org: r.org_id } });
    bus.publish({ type: 'grant.changed', patientRef: r.patient_ref, orgIds: [r.org_id] });
  }
  return rows.length;
}

/** Aktywne udostępnienie pacjenta dla organizacji (i lekarza, jeśli udostępnienie wskazuje konkretnego lekarza). */
export function activeGrant(orgId: string, patientRef: string, practitionerRef?: string): GrantView | undefined {
  const rows = getDb()
    .prepare("SELECT * FROM access_grant WHERE org_id = ? AND patient_ref = ? AND status = 'active' AND starts_at <= ? AND expires_at > ? ORDER BY expires_at DESC")
    .all(orgId, patientRef, nowIso(), nowIso()) as unknown as GrantRow[];
  const usable = rows.filter((r) => !r.practitioner_ref || r.practitioner_ref === practitionerRef);
  return usable.length ? toGrantView(usable[0]) : undefined;
}

/** Wszystkie zasoby objęte udostępnieniem (sumarycznie, jeśli kilka udostępnień). */
export function grantAllows(grants: GrantView[], ref: string, kind: 'result' | 'document'): boolean {
  return grants.some((g) => {
    switch (g.scope.kind) {
      case 'all':
        return true;
      case 'results':
        return kind === 'result';
      case 'documents':
        return kind === 'document';
      case 'selected':
        return g.scope.refs.includes(ref);
    }
  });
}

export function activeGrantsFor(orgId: string, patientRef: string, practitionerRef?: string): GrantView[] {
  const rows = getDb()
    .prepare("SELECT * FROM access_grant WHERE org_id = ? AND patient_ref = ? AND status = 'active' AND starts_at <= ? AND expires_at > ?")
    .all(orgId, patientRef, nowIso(), nowIso()) as unknown as GrantRow[];
  return rows.filter((r) => !r.practitioner_ref || r.practitioner_ref === practitionerRef).map(toGrantView);
}

/**
 * Strażnik dostępu personelu do danych z sejfu pacjenta. Odmowa domyślna: bez aktywnego udostępnienia — 403.
 * Administrator kliniki nie ma dostępu do danych klinicznych (D0).
 */
export function requireGrantAccess(user: AppUser, patientRef: string): GrantView[] {
  if (!user.roles.some((r) => r === 'practitioner' || r === 'reception')) throw forbidden('clinical_access_denied');
  const orgId = staffOrgId(user);
  if (!orgId) throw forbidden('no_organization');
  const grants = activeGrantsFor(orgId, patientRef, user.fhir_ref ?? undefined);
  if (!grants.length) throw forbidden('no_active_grant');
  return grants;
}
