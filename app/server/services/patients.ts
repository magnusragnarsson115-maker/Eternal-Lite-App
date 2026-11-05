import { formatHumanName } from '@medplum/core';
import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { findUserByFhirRef, issueToken } from '../auth/users.js';
import { bus } from '../events.js';
import { PESEL_SYSTEM, TAG_FICTIONAL, TAG_IDENTITY_VERIFIED } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { badRequest, conflict, isValidPesel, peselBirthDate, peselGender } from '../lib/util.js';

export interface PatientView {
  id: string;
  ref: string;
  name: string;
  given: string;
  family: string;
  birthDate?: string;
  gender?: string;
  pesel?: string;
  phone?: string;
  email?: string;
  address?: { line?: string; postalCode?: string; city?: string };
  identityVerified: boolean;
  hasAccount: boolean;
  fictional: boolean;
  preferredLanguage?: string;
}

export interface PatientInput {
  given: string;
  family: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  pesel?: string;
  phone?: string;
  email?: string;
  address?: { line?: string; postalCode?: string; city?: string };
  preferredLanguage?: string;
}

export function hasTag(r: { meta?: { tag?: { system?: string; code?: string }[] } }, tag: { system: string; code: string }): boolean {
  return !!r.meta?.tag?.some((t) => t.system === tag.system && t.code === tag.code);
}

export function maskPesel(pesel: string | undefined): string | undefined {
  return pesel ? `${pesel.slice(0, 2)}*******${pesel.slice(9)}` : undefined;
}

export function toPatientView(p: Patient, opts: { maskPesel?: boolean } = {}): PatientView {
  const name = p.name?.[0];
  const pesel = p.identifier?.find((i) => i.system === PESEL_SYSTEM)?.value;
  const ref = `Patient/${p.id}`;
  return {
    id: p.id ?? '',
    ref,
    name: name ? formatHumanName(name) : '—',
    given: name?.given?.join(' ') ?? '',
    family: name?.family ?? '',
    birthDate: p.birthDate,
    gender: p.gender,
    pesel: opts.maskPesel ? maskPesel(pesel) : pesel,
    phone: p.telecom?.find((t) => t.system === 'phone')?.value,
    email: p.telecom?.find((t) => t.system === 'email')?.value,
    address: p.address?.[0] ? { line: p.address[0].line?.join(' '), postalCode: p.address[0].postalCode, city: p.address[0].city } : undefined,
    identityVerified: hasTag(p, TAG_IDENTITY_VERIFIED),
    hasAccount: !!findUserByFhirRef(ref),
    fictional: hasTag(p, TAG_FICTIONAL),
    preferredLanguage: p.communication?.find((c) => c.preferred)?.language?.coding?.[0]?.code,
  };
}

function validateInput(input: PatientInput): void {
  if (!input.given?.trim() || !input.family?.trim()) throw badRequest('name_required');
  if (input.pesel) {
    if (!isValidPesel(input.pesel)) throw badRequest('invalid_pesel');
    const bd = peselBirthDate(input.pesel);
    if (input.birthDate && bd !== input.birthDate) throw badRequest('pesel_birthdate_mismatch');
  } else if (!input.birthDate) {
    throw badRequest('birthdate_required');
  }
  if (input.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || input.birthDate > new Date().toISOString().slice(0, 10))) {
    throw badRequest('invalid_birthdate');
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw badRequest('invalid_email');
  if (input.phone && !/^\+?[\d\s-]{9,16}$/.test(input.phone)) throw badRequest('invalid_phone');
}

function buildPatient(input: PatientInput, base?: Patient): Patient {
  const birthDate = input.pesel ? peselBirthDate(input.pesel) : input.birthDate;
  const gender = input.gender ?? (input.pesel ? peselGender(input.pesel) : base?.gender);
  const telecom = [
    ...(input.phone ? [{ system: 'phone' as const, value: input.phone.trim(), use: 'mobile' as const }] : []),
    ...(input.email ? [{ system: 'email' as const, value: input.email.trim().toLowerCase() }] : []),
  ];
  return {
    ...(base ?? {}),
    resourceType: 'Patient',
    active: true,
    name: [{ use: 'official', family: input.family.trim(), given: input.given.trim().split(/\s+/) }],
    birthDate,
    gender,
    identifier: [
      ...(base?.identifier?.filter((i) => i.system !== PESEL_SYSTEM) ?? []),
      ...(input.pesel ? [{ system: PESEL_SYSTEM, value: input.pesel }] : []),
    ],
    telecom: telecom.length ? telecom : undefined,
    address:
      input.address && (input.address.line || input.address.city)
        ? [{ use: 'home', line: input.address.line ? [input.address.line] : undefined, postalCode: input.address.postalCode, city: input.address.city, country: 'PL' }]
        : base?.address,
    communication: input.preferredLanguage
      ? [{ language: { coding: [{ system: 'urn:ietf:bcp:47', code: input.preferredLanguage }] }, preferred: true }]
      : base?.communication,
  };
}

export async function findPatientByPesel(pesel: string): Promise<Patient | undefined> {
  return (await fhir().search<Patient>('Patient', { identifier: `${PESEL_SYSTEM}|${pesel}` }))[0];
}

export async function createPatient(actor: AuditActor, input: PatientInput, opts: { verified?: boolean; fictional?: boolean } = {}): Promise<Patient> {
  validateInput(input);
  if (input.pesel && (await findPatientByPesel(input.pesel))) throw conflict('pesel_exists');
  const patient = buildPatient(input);
  const tags = [...(opts.verified ? [TAG_IDENTITY_VERIFIED] : []), ...(opts.fictional ? [TAG_FICTIONAL] : [])];
  if (tags.length) patient.meta = { tag: tags };
  const saved = await fhir().create(patient);
  audit(actor, { action: 'C', subtype: 'patient-create', entityRef: `Patient/${saved.id}`, patientRef: `Patient/${saved.id}` });
  bus.publish({ type: 'patient.changed', patientRef: `Patient/${saved.id}` });
  return saved;
}

export async function updatePatient(actor: AuditActor, id: string, input: PatientInput): Promise<Patient> {
  validateInput(input);
  const current = await fhir().read<Patient>('Patient', id);
  if (input.pesel) {
    const other = await findPatientByPesel(input.pesel);
    if (other && other.id !== id) throw conflict('pesel_exists');
  }
  const saved = await fhir().update(buildPatient(input, current));
  audit(actor, { action: 'U', subtype: 'patient-update', entityRef: `Patient/${id}`, patientRef: `Patient/${id}` });
  bus.publish({ type: 'patient.changed', patientRef: `Patient/${id}` });
  return saved;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (/^\d{11}$/.test(q)) return fhir().search<Patient>('Patient', { identifier: `${PESEL_SYSTEM}|${q}` });
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return fhir().search<Patient>('Patient', { birthdate: q, _count: '50' });
  if (/^\+?[\d\s-]{6,}$/.test(q)) return fhir().search<Patient>('Patient', { phone: q.replace(/\s/g, ''), _count: '50' });
  const parts = q.split(/\s+/).filter(Boolean);
  const results = await fhir().search<Patient>('Patient', { name: parts[0], _count: '50', _sort: 'family' });
  return parts.length > 1
    ? results.filter((p) => parts.every((part) => formatHumanName(p.name?.[0] ?? {}).toLowerCase().includes(part.toLowerCase())))
    : results;
}

export async function setIdentityVerified(actor: AuditActor, id: string, method: string): Promise<Patient> {
  const p = await fhir().read<Patient>('Patient', id);
  if (hasTag(p, TAG_IDENTITY_VERIFIED)) return p;
  const saved = await fhir().update<Patient>({ ...p, meta: { ...p.meta, tag: [...(p.meta?.tag ?? []), TAG_IDENTITY_VERIFIED] } });
  audit(actor, { action: 'U', subtype: 'identity-verified', entityRef: `Patient/${id}`, patientRef: `Patient/${id}`, detail: { method } });
  bus.publish({ type: 'patient.changed', patientRef: `Patient/${id}` });
  return saved;
}

/** Kod aktywacyjny wydawany w rejestracji po okazaniu dokumentu tożsamości — łączy konto z kartoteką. */
export async function issueActivationCode(actor: AuditActor, id: string): Promise<{ code: string; expiresInDays: number }> {
  const p = await fhir().read<Patient>('Patient', id);
  if (findUserByFhirRef(`Patient/${id}`)) throw conflict('account_exists');
  const code = issueToken('patient-activation', { payload: { patientRef: `Patient/${p.id}` }, ttlMinutes: 30 * 24 * 60, code: 'activation' });
  audit(actor, { action: 'E', subtype: 'activation-code-issued', entityRef: `Patient/${id}`, patientRef: `Patient/${id}` });
  return { code, expiresInDays: 30 };
}
