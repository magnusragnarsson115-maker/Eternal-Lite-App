import { formatHumanName } from '@medplum/core';
import type { Patient, RelatedPerson } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { ageOn, linkUsable, parentLinkLapsed, type ProxyAccess, type ProxyLinkRow, type ProxyRelation, resolveProxy } from '../auth/proxy.js';
import { type AppUser, findUserByFhirRef, findUserById } from '../auth/users.js';
import { getDb } from '../db.js';
import { TAG_FICTIONAL } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, conflict, forbidden, newId, notFound, nowIso, sha256 } from '../lib/util.js';
import { runInScope, vaultOrgId, withOrgTags } from '../tenancy.js';
import { deleteManagedProfileData, type DeletionStep } from './deletion.js';
import { listIntakeLog } from './medReminders.js';
import { listThreadsForPatient } from './messages.js';
import { notifyUser } from './notifications.js';
import { patientOrgIds } from './orgs.js';
import { createPatient, hasTag, type PatientInput } from './patients.js';
import { listPatientAppointments } from './scheduling.js';

/**
 * Profile rodzinne i dostęp opiekuna (A22.1/A24.1 konto wieloprofilowe, A24.2 dostęp zastępczy,
 * A5.13/A22.6/S4.5 panel opiekuna, A21.6 profil dziecka, A21.11/A17.6 łącznik rodzinny).
 *
 * Dwie drogi powstania powiązania:
 *  1. profil prowadzony — rodzic, opiekun prawny albo osoba z pisemnym upoważnieniem zakłada profil osoby bez konta
 *     (oświadczenie o podstawie zapisane z wersją tekstu),
 *  2. zaproszenie — osoba z własnym kontem (albo opiekun profilu prowadzonego) tworzy jednorazowy kod; druga osoba
 *     wpisuje go u siebie. Właściciel widzi, kto ma dostęp, i odbiera go jednym ruchem.
 *
 * Aplikacja niczego nie ocenia w imieniu opiekuna — pokazuje te same fakty, które widzi właściciel profilu.
 */

export const PROXY_BASIS_VERSION = 'opiekun/2026-10-1';
export const MAX_MANAGED_PROFILES = 10;
export const MAX_PENDING_INVITES = 5;
export const INVITE_HOURS = 72;

/** Treść oświadczeń zapisywana z wersją (podstawa działania w imieniu innej osoby). */
export const BASIS_TEXT: Record<'parent' | 'guardian' | 'caregiver', string> = {
  parent: 'Oświadczam, że jestem rodzicem tego dziecka i przysługuje mi władza rodzicielska.',
  guardian: 'Oświadczam, że jestem opiekunem prawnym tej osoby ustanowionym przez sąd.',
  caregiver: 'Oświadczam, że mam pisemne upoważnienie tej osoby do dostępu do jej danych o zdrowiu i działania w jej imieniu.',
};

const ROLE_CODE: Record<ProxyRelation, { code: string; display: string }> = {
  parent: { code: 'PRN', display: 'parent' },
  guardian: { code: 'GUARD', display: 'guardian' },
  caregiver: { code: 'HPOWATT', display: 'healthcare power of attorney' },
  family: { code: 'FAMMEMB', display: 'family member' },
};

export interface ProfileView {
  patientRef: string;
  id: string;
  name: string;
  given: string;
  birthDate?: string;
  age?: number;
  self: boolean;
  managed: boolean;
  relation?: ProxyRelation;
  access: ProxyAccess | 'self';
  linkId?: string;
  /** Rodzic profilu osoby, która skończyła 18 lat — dostęp wygasł z mocy prawa. */
  lapsed?: boolean;
}

export interface AccessView {
  id: string;
  name?: string;
  relation: ProxyRelation;
  access: ProxyAccess;
  status: 'pending' | 'active' | 'expired';
  managed: boolean;
  you: boolean;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  codeExpiresAt?: string;
}

function patientName(p: Patient | undefined): { name: string; given: string } {
  const n = p?.name?.[0];
  return { name: n ? formatHumanName(n) : '—', given: n?.given?.[0] ?? (n ? formatHumanName(n) : '—') };
}

async function readPatient(patientRef: string): Promise<Patient | undefined> {
  return fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
}

function linksOfUser(userId: string): ProxyLinkRow[] {
  return getDb().prepare("SELECT * FROM proxy_link WHERE proxy_user_id = ? AND status = 'active' ORDER BY created_at").all(userId) as unknown as ProxyLinkRow[];
}

function linksOfPatient(patientRef: string): ProxyLinkRow[] {
  return getDb()
    .prepare("SELECT * FROM proxy_link WHERE patient_ref = ? AND status IN ('pending', 'active') ORDER BY created_at")
    .all(patientRef) as unknown as ProxyLinkRow[];
}

function getLink(id: string): ProxyLinkRow | undefined {
  return getDb().prepare('SELECT * FROM proxy_link WHERE id = ?').get(id) as ProxyLinkRow | undefined;
}

/** Profile, w których można działać: własny + aktywne powiązania (profil rodzica dziecka po 18. urodzinach — oznaczony). */
export async function listProfiles(user: AppUser, now: Date = new Date()): Promise<ProfileView[]> {
  const out: ProfileView[] = [];
  if (user.fhir_ref) {
    const p = await readPatient(user.fhir_ref);
    out.push({ patientRef: user.fhir_ref, id: user.fhir_ref.split('/')[1], ...patientName(p), birthDate: p?.birthDate, self: true, managed: false, access: 'self' });
  }
  const seen = new Set(out.map((p) => p.patientRef));
  for (const l of linksOfUser(user.id)) {
    if (seen.has(l.patient_ref)) continue;
    if (l.expires_at && Date.parse(l.expires_at) <= now.getTime()) continue;
    seen.add(l.patient_ref);
    const p = await readPatient(l.patient_ref);
    if (p && p.active === false) continue;
    out.push({
      patientRef: l.patient_ref,
      id: l.patient_ref.split('/')[1],
      ...patientName(p),
      birthDate: p?.birthDate,
      age: p?.birthDate ? ageOn(p.birthDate, now) : undefined,
      self: false,
      managed: !!l.managed,
      relation: l.relation,
      access: l.access,
      linkId: l.id,
      lapsed: parentLinkLapsed(l, now) || undefined,
    });
  }
  return out;
}

function toAccessView(r: ProxyLinkRow, viewerId: string, now: Date): AccessView {
  const proxy = r.proxy_user_id ? findUserById(r.proxy_user_id) : undefined;
  const expired = r.status === 'active' && !linkUsable(r, now);
  const pendingExpired = r.status === 'pending' && !!r.code_expires_at && Date.parse(r.code_expires_at) <= now.getTime();
  return {
    id: r.id,
    name: proxy?.display_name,
    relation: r.relation,
    access: r.access,
    status: expired || pendingExpired ? 'expired' : r.status === 'pending' ? 'pending' : 'active',
    managed: !!r.managed,
    you: r.proxy_user_id === viewerId,
    createdAt: r.created_at,
    activatedAt: r.activated_at ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    codeExpiresAt: r.status === 'pending' ? (r.code_expires_at ?? undefined) : undefined,
  };
}

/** Kto może zarządzać dostępem do profilu: właściciel konta albo opiekun z pełnym dostępem profilu prowadzonego. */
function canManage(user: AppUser, patientRef: string): { owner: boolean; link?: ProxyLinkRow } {
  if (user.fhir_ref === patientRef) return { owner: true };
  const link = resolveProxy(user.id, patientRef);
  if (link && link.managed && link.access === 'full' && link.relation !== 'family') return { owner: false, link };
  throw forbidden('proxy_not_allowed');
}

export function listAccess(user: AppUser, patientRef: string, now: Date = new Date()): AccessView[] {
  canManage(user, patientRef);
  return linksOfPatient(patientRef).map((r) => toAccessView(r, user.id, now));
}

// --- profil prowadzony (dziecko, osoba pod opieką) ---------------------------------------------------------------

export interface DependentInput extends Pick<PatientInput, 'given' | 'family' | 'birthDate' | 'gender' | 'pesel'> {
  relation: 'parent' | 'guardian' | 'caregiver';
  declaration: boolean;
}

export async function createDependent(actor: AuditActor, user: AppUser, input: DependentInput, now: Date = new Date()): Promise<ProfileView> {
  if (!user.fhir_ref) throw forbidden('patient_only');
  if (!input.declaration) throw badRequest('declaration_required');
  const managedCount = (
    getDb().prepare("SELECT COUNT(DISTINCT patient_ref) AS n FROM proxy_link WHERE created_by = ? AND managed = 1 AND status = 'active'").get(user.id) as { n: number }
  ).n;
  if (managedCount >= MAX_MANAGED_PROFILES) throw conflict('too_many_profiles');
  const birthDate = input.birthDate;
  if (input.relation === 'parent') {
    if (!birthDate) throw badRequest('birthdate_required');
    if (ageOn(birthDate, now) >= 18) throw badRequest('child_must_be_minor');
  }
  if (input.relation === 'caregiver' && birthDate && ageOn(birthDate, now) < 18) throw badRequest('caregiver_requires_adult');

  const owner = await readPatient(user.fhir_ref);
  const fictional = owner ? hasTag(owner, TAG_FICTIONAL) : false;
  // profil widoczny w placówkach rodzica (rejestracja dziecka, wizyty); dane o zdrowiu — wyłącznie w sejfie profilu
  const orgIds = await patientOrgIds(user.fhir_ref);
  const patient = await runInScope({ patientRef: user.fhir_ref, patientOrgIds: orgIds }, () =>
    createPatient(actor, { given: input.given, family: input.family, birthDate: input.birthDate, gender: input.gender, pesel: input.pesel }, { fictional }),
  );
  const patientRef = `Patient/${patient.id}`;
  await fhirSystem().create<RelatedPerson>(
    withOrgTags<RelatedPerson>(
      {
        resourceType: 'RelatedPerson',
        active: true,
        patient: { reference: patientRef },
        relationship: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', ...ROLE_CODE[input.relation] }] }],
        name: [{ text: user.display_name }],
        identifier: [{ system: 'urn:eternal:user', value: user.id }],
      },
      [vaultOrgId(patientRef)],
    ),
  );
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO proxy_link (id, patient_ref, patient_birth_date, proxy_user_id, relation, access, status, managed, basis, created_by, created_at, activated_at)
       VALUES (?, ?, ?, ?, ?, 'full', 'active', 1, ?, ?, ?, ?)`,
    )
    .run(id, patientRef, patient.birthDate ?? null, user.id, input.relation, `${PROXY_BASIS_VERSION}:${input.relation}`, user.id, nowIso(), nowIso());
  audit(actor, { action: 'C', subtype: 'managed-profile-create', entityRef: patientRef, patientRef, detail: { relation: input.relation, basis: `${PROXY_BASIS_VERSION}:${input.relation}` } });
  return (await listProfiles(user, now)).find((p) => p.patientRef === patientRef)!;
}

export async function deleteDependent(actor: AuditActor, user: AppUser, patientRef: string): Promise<DeletionStep[]> {
  const { link } = canManage(user, patientRef);
  if (!link) throw badRequest('not_managed_profile');
  const others = linksOfPatient(patientRef).filter((r) => r.status === 'active' && r.access === 'full' && r.proxy_user_id !== user.id);
  if (others.length) throw conflict('other_guardians');
  if (findUserByFhirRef(patientRef)) throw conflict('profile_has_account');
  return deleteManagedProfileData(actor, patientRef);
}

// --- zaproszenia (łącznik rodzinny) ------------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = crypto.randomBytes(10);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export interface InviteInput {
  patientRef: string;
  relation: ProxyRelation;
  access: ProxyAccess;
  days?: number;
}

export async function createInvite(actor: AuditActor, user: AppUser, input: InviteInput, now: Date = new Date()): Promise<{ id: string; code: string; codeExpiresAt: string }> {
  const { owner, link } = canManage(user, input.patientRef);
  if (owner && !['family', 'caregiver'].includes(input.relation)) throw badRequest('invalid_relation');
  if (!owner && input.relation === 'family' && input.access === 'full') throw badRequest('invalid_relation');
  const pending = linksOfPatient(input.patientRef).filter((r) => r.status === 'pending' && r.code_expires_at && Date.parse(r.code_expires_at) > now.getTime());
  if (pending.length >= MAX_PENDING_INVITES) throw conflict('too_many_invites');
  const p = await readPatient(input.patientRef);
  const code = newCode();
  const id = newId();
  const codeExpiresAt = new Date(now.getTime() + INVITE_HOURS * 3_600_000).toISOString();
  const expiresAt = input.days ? new Date(now.getTime() + input.days * 86_400_000).toISOString() : null;
  getDb()
    .prepare(
      `INSERT INTO proxy_link (id, patient_ref, patient_birth_date, proxy_user_id, relation, access, status, managed, code_hash, code_expires_at, basis, created_by, created_at, expires_at)
       VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.patientRef,
      p?.birthDate ?? null,
      input.relation,
      input.access,
      link?.managed ? 1 : 0,
      sha256(normalizeCode(code)),
      codeExpiresAt,
      owner ? `${PROXY_BASIS_VERSION}:owner-invite` : `${PROXY_BASIS_VERSION}:guardian-invite`,
      user.id,
      nowIso(),
      expiresAt,
    );
  audit(actor, { action: 'C', subtype: 'proxy-invite-create', patientRef: input.patientRef, detail: { relation: input.relation, access: input.access, days: input.days ?? null } });
  return { id, code, codeExpiresAt };
}

export async function acceptInvite(actor: AuditActor, user: AppUser, code: string, now: Date = new Date()): Promise<ProfileView> {
  if (!user.fhir_ref) throw forbidden('patient_only');
  const hash = sha256(normalizeCode(code));
  const row = getDb().prepare("SELECT * FROM proxy_link WHERE code_hash = ? AND status = 'pending'").get(hash) as ProxyLinkRow | undefined;
  if (!row) throw notFound('invite_not_found');
  if (row.code_expires_at && Date.parse(row.code_expires_at) <= now.getTime()) throw conflict('invite_expired');
  if (row.patient_ref === user.fhir_ref || row.created_by === user.id) throw badRequest('invite_own');
  if (resolveProxy(user.id, row.patient_ref, now)) throw conflict('already_linked');
  getDb()
    .prepare("UPDATE proxy_link SET proxy_user_id = ?, status = 'active', activated_at = ?, code_hash = NULL WHERE id = ?")
    .run(user.id, nowIso(), row.id);
  audit(actor, { action: 'C', subtype: 'proxy-link-accept', patientRef: row.patient_ref, detail: { link: row.id, relation: row.relation, access: row.access } });
  // powiadomienie bez danych o zdrowiu: kto i jaki zakres
  const inviter = findUserById(row.created_by);
  if (inviter) {
    await notifyUser(inviter.id, {
      kind: 'family',
      title: 'Nowa osoba ma dostęp do profilu',
      body: `${user.display_name} — ${row.access === 'full' ? 'pełny dostęp' : 'tylko podgląd'}. Dostęp odbierzesz w zakładce Rodzina.`,
      link: '/rodzina',
    });
  }
  const view = (await listProfiles(user, now)).find((p) => p.patientRef === row.patient_ref);
  if (!view) throw conflict('invite_not_usable');
  return view;
}

export async function revokeLink(actor: AuditActor, user: AppUser, linkId: string, now: Date = new Date()): Promise<void> {
  const row = getLink(linkId);
  if (!row || !['pending', 'active'].includes(row.status)) throw notFound('link_not_found');
  const resign = row.proxy_user_id === user.id;
  if (!resign) canManage(user, row.patient_ref);
  if (row.managed && row.status === 'active' && row.access === 'full') {
    const others = linksOfPatient(row.patient_ref).filter((r) => r.id !== row.id && r.status === 'active' && r.access === 'full' && linkUsable(r, now));
    if (!others.length && !findUserByFhirRef(row.patient_ref)) throw conflict('last_guardian');
  }
  getDb()
    .prepare("UPDATE proxy_link SET status = 'revoked', revoked_at = ?, revoked_by = ?, code_hash = NULL WHERE id = ?")
    .run(nowIso(), user.id, row.id);
  audit(actor, { action: 'D', subtype: resign ? 'proxy-link-resign' : 'proxy-link-revoke', patientRef: row.patient_ref, detail: { link: row.id } });
  const other = resign ? findUserById(row.created_by) : row.proxy_user_id ? findUserById(row.proxy_user_id) : undefined;
  if (other && other.id !== user.id && row.status === 'active') {
    await notifyUser(other.id, {
      kind: 'family',
      title: resign ? 'Opiekun zrezygnował z dostępu' : 'Dostęp do profilu został odebrany',
      body: resign ? `${user.display_name} nie ma już dostępu do profilu.` : 'Nie masz już dostępu do tego profilu w aplikacji.',
      link: '/rodzina',
    });
  }
}

// --- panel opiekuna ------------------------------------------------------------------------------------------------

export interface CaregiverOverviewItem {
  patientRef: string;
  name: string;
  age?: number;
  relation: ProxyRelation;
  access: ProxyAccess;
  nextAppointment?: { start: string; service: string; practitioner?: string };
  medsToday: { due: number; taken: number; skipped: number; missed: number };
  unreadMessages: number;
  lastActivityAt?: string;
}

/**
 * Panel opiekuna (A5.13/A22.6/S4.5): stan wszystkich profili naraz — najbliższa wizyta, przyjęcia leków dziś,
 * nieprzeczytane wiadomości. Same fakty z aplikacji, bez ocen i bez alarmów.
 */
export async function caregiverOverview(actor: AuditActor, user: AppUser, tz: string, now: Date = new Date()): Promise<CaregiverOverviewItem[]> {
  const out: CaregiverOverviewItem[] = [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  for (const p of await listProfiles(user, now)) {
    if (p.self || p.lapsed || !p.relation || p.access === 'self') continue;
    const ref = p.patientRef;
    const orgIds = await patientOrgIds(ref);
    const item = await runInScope({ patientRef: ref, patientOrgIds: orgIds }, async () => {
      const appts = (await listPatientAppointments(ref)).filter((a) => ['booked', 'pending', 'arrived', 'checked-in'].includes(a.status) && Date.parse(a.end) > now.getTime());
      appts.sort((a, b) => a.start.localeCompare(b.start));
      const intake = listIntakeLog(ref, 2).filter((i) => dayOf(i.dueAt) === today);
      const threads = await listThreadsForPatient(ref, user.id);
      const next = appts[0];
      return {
        patientRef: ref,
        name: p.name,
        age: p.age,
        relation: p.relation!,
        access: p.access as ProxyAccess,
        nextAppointment: next ? { start: next.start, service: next.serviceName ?? '', practitioner: next.practitionerName } : undefined,
        medsToday: {
          due: intake.filter((i) => i.status === 'due').length,
          taken: intake.filter((i) => i.status === 'taken').length,
          skipped: intake.filter((i) => i.status === 'skipped').length,
          missed: intake.filter((i) => i.status === 'missed').length,
        },
        unreadMessages: threads.filter((t) => t.unread).length,
        lastActivityAt: [...intake.map((i) => i.confirmedAt ?? ''), ...threads.map((t) => t.lastMessageAt ?? '')].filter(Boolean).sort().pop(),
      } satisfies CaregiverOverviewItem;
    });
    audit(actor, { action: 'R', subtype: 'caregiver-overview', patientRef: ref });
    out.push(item);
  }
  return out;
}
