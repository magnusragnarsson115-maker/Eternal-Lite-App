import type { Bundle, BundleEntry, Communication, Consent, Patient, Resource, Task } from '@medplum/fhirtypes';
import { audit, type AuditActor, listAudit, toAuditEvent } from '../audit.js';
import { type AppUser, findUserById, isStaff, listUsers, updateUser } from '../auth/users.js';
import { getClinicSettings } from './directory.js';
import { staffOrgId } from './orgs.js';
import { destroyAllSessions } from '../auth/sessions.js';
import { getDb } from '../db.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../tenancy.js';
import { VAULT_TYPES } from './deletion.js';
import { idFromRef } from '../fhir/repository.js';
import { nowIso } from '../lib/util.js';
import { listMeasurements } from './observations.js';
import { notifyUser } from './notifications.js';
import { listPatientRecords } from './records.js';
import { responsesForPatient } from './questionnaires.js';

/**
 * Prawa osoby, której dane dotyczą: dostęp i przenoszenie (RODO art. 15 i 20, EHDS rozdz. II),
 * historia dostępu do danych, wniosek o usunięcie konta.
 * Dokumentacja medyczna podlega przechowywaniu przez 20 lat (art. 29 ustawy o prawach pacjenta) —
 * usunięcie konta nie usuwa dokumentacji, tylko dostęp online.
 */

export async function exportPatientBundle(actor: AuditActor, patientRef: string): Promise<Bundle> {
  const patient = await fhir().read<Patient>('Patient', idFromRef(patientRef));
  const [appointments, consents, communications, records, measurements, responses] = await Promise.all([
    fhir().search('Appointment', { patient: patientRef }),
    fhir().search<Consent>('Consent', { patient: patientRef }),
    fhir().search<Communication>('Communication', { subject: patientRef }),
    listPatientRecords(patientRef, { onlyShared: true }),
    listMeasurements(patientRef),
    responsesForPatient(patientRef),
  ]);
  const resources: Resource[] = [patient, ...appointments, ...consents, ...communications, ...responses];

  for (const rec of records) {
    const r = await fhir().read(rec.type === 'report' ? 'DiagnosticReport' : 'DocumentReference', rec.id);
    resources.push(r);
    if (rec.type === 'report') {
      const full = r as { result?: { reference?: string }[] };
      for (const ref of full.result ?? []) {
        const o = await fhir().readOptional('Observation', idFromRef(ref.reference));
        if (o) resources.push(o);
      }
    }
    if (rec.attachment) {
      const bin = await fhir().readBinary(rec.attachment.binaryId);
      resources.push({ resourceType: 'Binary', id: rec.attachment.binaryId, contentType: bin.contentType, data: bin.data.toString('base64') });
    }
  }
  for (const m of measurements) {
    const o = await fhir().readOptional('Observation', m.id);
    if (o) resources.push(o);
  }
  // sejf pacjenta: dokumenty i odczyty wgrane przez pacjenta, dzienniki, szczepienia, wywiad rodzinny, dyspozycje, cele
  const seen = new Set(resources.map((r) => `${r.resourceType}/${r.id}`));
  for (const type of VAULT_TYPES) {
    for (const r of await fhirSystem().search(type, { _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '5000' })) {
      if (!seen.has(`${r.resourceType}/${r.id}`)) {
        seen.add(`${r.resourceType}/${r.id}`);
        resources.push(r);
      }
    }
  }
  for (const row of listAudit({ patientRef, limit: 500 })) resources.push(toAuditEvent(row));

  audit(actor, { action: 'E', subtype: 'patient-export', entityRef: patientRef, patientRef, detail: { resources: resources.length } });
  const entries: BundleEntry[] = resources.map((r) => ({ fullUrl: `urn:uuid:${r.resourceType}-${r.id}`, resource: r }));
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: nowIso(),
    meta: { tag: [{ system: 'urn:eternal:export', code: 'patient-portability', display: 'Eksport danych pacjenta (RODO art. 20)' }] },
    entry: entries,
  };
}

export interface AccessLogEntry {
  at: string;
  who: string;
  role: string;
  /** Organizacja osoby z personelu (P2: „z rolą, organizacją i datą”). */
  org?: string;
  action: string;
  subtype: string;
  resource?: string;
}

const ROLE_PL: Record<string, string> = {
  patient: 'Ty',
  practitioner: 'Lekarz',
  reception: 'Rejestracja',
  admin: 'Administrator',
  caregiver: 'Opiekun',
};

/** Historia dostępu do danych pacjenta — kto, kiedy, co (bez adresów IP personelu). */
export function accessLogForPatient(patientRef: string, opts: { staffOnly?: boolean; since?: string } = {}): AccessLogEntry[] {
  const orgOfUser = new Map<string, string | undefined>();
  const orgName = (userId: string | null): string | undefined => {
    if (!userId) return undefined;
    if (!orgOfUser.has(userId)) {
      const u = findUserById(userId);
      const orgId = u && isStaff(u) ? staffOrgId(u) : undefined;
      orgOfUser.set(userId, orgId ? getClinicSettings(orgId).name : undefined);
    }
    return orgOfUser.get(userId);
  };
  return listAudit({ patientRef, limit: 300 })
    .filter((r) => (!opts.since || r.ts >= opts.since) && (!opts.staffOnly || (r.actor_roles ?? '').split(',').some((x) => x && x !== 'patient')))
    .map((r) => {
      const roles = (r.actor_roles ?? '').split(',').filter(Boolean);
      const isSelf = r.actor_ref === patientRef;
      return {
        at: r.ts,
        who: isSelf ? 'Ty' : (r.actor_display ?? 'System'),
        // konto pacjenta działające w cudzym profilu = opiekun (A24.2)
        role: isSelf ? 'patient' : (roles.find((x) => x !== 'patient') ?? (roles.includes('patient') ? 'caregiver' : r.actor_user_id ? 'staff' : 'system')),
        org: isSelf ? undefined : orgName(r.actor_user_id),
        action: r.action,
        subtype: r.subtype,
        resource: r.entity_ref?.split('/')[0],
      };
    });
}

export { ROLE_PL };

export async function requestAccountDeletion(actor: AuditActor, user: AppUser, reason?: string): Promise<void> {
  const patientRef = user.fhir_ref ?? undefined;
  await fhir().create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    priority: 'routine',
    code: { text: 'Wniosek o usunięcie konta w aplikacji' },
    description: reason?.slice(0, 500) || 'Pacjent wnioskuje o usunięcie konta. Dokumentacja medyczna pozostaje w placówce zgodnie z art. 29 ustawy o prawach pacjenta.',
    for: patientRef ? { reference: patientRef } : undefined,
    authoredOn: nowIso(),
    requester: patientRef ? { reference: patientRef } : undefined,
  });
  updateUser(user.id, { status: 'deletion-requested' });
  audit(actor, { action: 'U', subtype: 'account-deletion-request', entityRef: patientRef, patientRef });
  for (const admin of listUsers({ staffOnly: true }).filter((u) => u.roles.includes('admin'))) {
    await notifyUser(admin.id, { kind: 'deletion-request', title: 'Wniosek o usunięcie konta', body: user.display_name, link: '/panel/admin', push: false });
  }
}

/** Realizacja wniosku przez administratora: konto wyłączone, dane logowania i subskrypcje usunięte. */
export function closeAccount(actor: AuditActor, userId: string): void {
  const db = getDb();
  updateUser(userId, { status: 'disabled', totp_secret: null, totp_enabled: false, password_hash: 'disabled' });
  destroyAllSessions(userId);
  db.prepare('DELETE FROM push_subscription WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM integration_token WHERE user_id = ?').run(userId);
  db.prepare("UPDATE waitlist_entry SET status = 'removed' WHERE user_id = ?").run(userId);
  audit(actor, { action: 'D', subtype: 'account-closed', entityRef: `urn:eternal:user:${userId}` });
}
