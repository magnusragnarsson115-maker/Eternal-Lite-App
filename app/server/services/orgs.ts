import type { Organization, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest } from '../lib/util.js';
import { defaultOrgId, ORG_TAG_SYSTEM, orgIdsOf, setDefaultOrgId, withOrgTags } from '../tenancy.js';

/**
 * Organizacje (kliniki) w instancji. Jedna instancja może obsługiwać kilka klinik pilotażu —
 * dane są rozdzielone znacznikiem organizacji (tenancy.ts), konto personelu należy do jednej organizacji.
 */

export interface OrgView {
  id: string;
  name: string;
  nip?: string;
  rpwdl?: string;
  phone?: string;
  email?: string;
  isDefault: boolean;
}

export function toOrgView(o: Organization): OrgView {
  return {
    id: o.id ?? '',
    name: o.name ?? '',
    nip: o.identifier?.find((i) => i.system === 'urn:oid:2.16.840.1.113883.3.4424.1.3.1')?.value,
    rpwdl: o.identifier?.find((i) => i.system === 'urn:eternal:rpwdl')?.value,
    phone: o.telecom?.find((t) => t.system === 'phone')?.value,
    email: o.telecom?.find((t) => t.system === 'email')?.value,
    isDefault: o.id === defaultOrgId(),
  };
}

export async function listOrganizations(): Promise<OrgView[]> {
  const orgs = await fhirSystem().search<Organization>('Organization', { _count: '200' });
  return orgs.map(toOrgView).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export async function createOrganization(
  actor: AuditActor,
  input: { name: string; nip?: string; rpwdl?: string; phone?: string; email?: string },
): Promise<OrgView> {
  if (!input.name.trim()) throw badRequest('name_required');
  if (input.nip && !/^\d{10}$/.test(input.nip)) throw badRequest('invalid_nip');
  const created = await fhirSystem().create<Organization>({
    resourceType: 'Organization',
    active: true,
    name: input.name.trim(),
    identifier: [
      ...(input.nip ? [{ system: 'urn:oid:2.16.840.1.113883.3.4424.1.3.1', value: input.nip }] : []),
      ...(input.rpwdl ? [{ system: 'urn:eternal:rpwdl', value: input.rpwdl }] : []),
    ],
    telecom: [
      ...(input.phone ? [{ system: 'phone' as const, value: input.phone }] : []),
      ...(input.email ? [{ system: 'email' as const, value: input.email }] : []),
    ],
  });
  // organizacja nosi własny znacznik — personel tej organizacji widzi jej zasób
  const saved = await fhirSystem().update(withOrgTags(created, [created.id ?? '']));
  if (!defaultOrgId()) setDefaultOrgId(saved.id ?? '');
  audit(actor, { action: 'C', subtype: 'organization-create', entityRef: `Organization/${saved.id}` });
  return toOrgView(saved);
}

/** Organizacja personelu (konta sprzed wprowadzenia organizacji należą do organizacji domyślnej). */
export function staffOrgId(user: Pick<AppUser, 'org_id'>): string | undefined {
  return user.org_id ?? defaultOrgId();
}

const patientOrgCache = new Map<string, { at: number; orgIds: string[] }>();

/** Organizacje, w których pacjent jest zarejestrowany (znaczniki zasobu Patient), z krótkim cache. */
export async function patientOrgIds(patientRef: string): Promise<string[]> {
  const hit = patientOrgCache.get(patientRef);
  if (hit && Date.now() - hit.at < 30_000) return hit.orgIds;
  const p = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
  const orgIds = p ? orgIdsOf(p) : [];
  patientOrgCache.set(patientRef, { at: Date.now(), orgIds });
  return orgIds;
}

export function forgetPatientOrgs(patientRef: string): void {
  patientOrgCache.delete(patientRef);
}

/**
 * Przy starcie: wskazanie organizacji domyślnej i oznaczenie zasobów sprzed wprowadzenia organizacji
 * (dane jednej kliniki) — bez zmiany wersji zasobów, bo to korekta metadanych, nie treści.
 */
export async function ensureOrganizations(): Promise<void> {
  let def = defaultOrgId();
  if (!def) {
    const first = (await fhirSystem().search<Organization>('Organization', { _count: '1' }))[0];
    if (!first?.id) return;
    def = first.id;
    setDefaultOrgId(def);
  }
  if (config.fhir.backend !== 'local') return;
  const db = getDb();
  const rows = db.prepare(`SELECT type, id, content FROM fhir_resource WHERE content NOT LIKE ?`).all(`%${ORG_TAG_SYSTEM}%`) as {
    type: string;
    id: string;
    content: string;
  }[];
  const upd = db.prepare('UPDATE fhir_resource SET content = ? WHERE type = ? AND id = ?');
  for (const row of rows) {
    const r = JSON.parse(row.content);
    upd.run(JSON.stringify(withOrgTags(r, [row.type === 'Organization' ? row.id : def])), row.type, row.id);
  }
}
