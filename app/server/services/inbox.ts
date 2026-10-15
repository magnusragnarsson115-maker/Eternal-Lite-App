import type { DiagnosticReport, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { addDays, zonedToUtc } from '../lib/time.js';
import { conflict, nowIso } from '../lib/util.js';
import { moduleEnabled } from '../modules.js';
import type { DocumentKind, RequiredDocument } from '../settings.js';
import { currentOrgId, runInScope } from '../tenancy.js';
import { getClinicSettings, getPractitioner } from './directory.js';
import { activeGrantsFor, getGrantRow, toGrantView, type GrantView } from './grants.js';
import { listIntake, type IntakeRow } from './intake.js';
import { type InviteRow, remindInvite, toInviteView, type InviteView } from './invites.js';
import { listOrganizations } from './orgs.js';
import { type AppointmentView, listAppointmentsInRange } from './scheduling.js';
import { specialtyKey } from './packages.js';

/**
 * Skrzynka materiałów i kompletność przed wizytą (D2, DOC-03). Porządek według daty i braków —
 * nigdy według ryzyka klinicznego (granica z pliku 12.8).
 */

export type ReqStatus = 'missing' | 'to_confirm' | 'ready';

export interface RequirementState {
  id: string;
  label: string;
  optional: boolean;
  status: ReqStatus;
  intakeIds: string[];
  clinicRecords: number;
}

export interface VisitPrep {
  appointment: AppointmentView;
  invite?: InviteView;
  grant?: GrantView;
  /** none — brak zaproszenia; invited — link wysłany, brak zgody; shared — zgoda aktywna; withdrawn — zgoda wycofana/wygasła. */
  sharing: 'none' | 'invited' | 'shared' | 'withdrawn';
  requirements: RequirementState[];
  completeness: number;
  status: 'missing' | 'to_confirm' | 'ready';
  counts: { uploaded: number; toConfirm: number; unreadable: number };
  lastReminderAt?: string;
}

const ACTIVE_APPT = ['booked', 'arrived', 'checked-in', 'pending', 'fulfilled'];

function requirementsFor(settings: ReturnType<typeof getClinicSettings>, specialty?: string): RequiredDocument[] {
  // specjalizacja z pakietu (M30) dopasowana po kluczu: „Kardiolog”, „Poradnia kardiologiczna” → kardiologia
  const key = specialtyKey(specialty);
  return settings.requiredDocuments.filter(
    (r) => !r.specialties?.length || (specialty && r.specialties.some((s) => s.toLowerCase() === specialty.toLowerCase() || (key !== undefined && s === key))),
  );
}

function itemDate(r: IntakeRow): string {
  return r.collected_at ?? r.created_at.slice(0, 10);
}

function withinAge(date: string, apptStart: string, maxAgeDays?: number): boolean {
  if (!maxAgeDays) return true;
  return Date.parse(apptStart) - Date.parse(date) <= maxAgeDays * 86_400_000;
}

function itemState(r: IntakeRow): ReqStatus {
  if (r.status === 'confirmed' || r.status === 'unreadable') return 'ready';
  if (r.status === 'failed') return 'missing';
  return 'to_confirm';
}

export function latestInviteRow(appointmentId: string): InviteRow | undefined {
  return getDb().prepare("SELECT * FROM invite_link WHERE appointment_id = ? AND purpose = 'intake' ORDER BY created_at DESC LIMIT 1").get(appointmentId) as InviteRow | undefined;
}

/** Stan przygotowania jednej wizyty. Pozycje z sejfu pacjenta liczą się tylko przy aktywnym udostępnieniu tej klinice. */
export async function prepFor(appt: AppointmentView, orgId = currentOrgId()): Promise<VisitPrep> {
  const settings = getClinicSettings(orgId);
  const patientRef = `Patient/${appt.patientId}`;
  const specialty = appt.practitionerId ? (await getPractitioner(appt.practitionerId).catch(() => undefined))?.specialty : undefined;
  const required = requirementsFor(settings, specialty);
  const inviteRow = latestInviteRow(appt.id);
  const grants = orgId ? activeGrantsFor(orgId, patientRef) : [];
  const inviteGrant = inviteRow?.grant_id ? getGrantRow(inviteRow.grant_id) : undefined;
  const sharing: VisitPrep['sharing'] = grants.length ? 'shared' : inviteGrant ? 'withdrawn' : inviteRow ? 'invited' : 'none';
  const intake = grants.length ? listIntake({ patientRef }).filter((r) => r.org_id === orgId || r.source === 'app') : [];
  // własne wyniki kliniki (wprowadzone przez personel) też spełniają wymóg wyników
  const reports = await fhir().search<DiagnosticReport>('DiagnosticReport', { subject: patientRef, _count: '200' }).catch(() => [] as DiagnosticReport[]);
  const requirements: RequirementState[] = required.map((req) => {
    const matching = intake.filter((r) => req.accept.includes(r.kind as DocumentKind) && withinAge(itemDate(r), appt.start, req.maxAgeDays));
    const clinicRecords = req.accept.includes('lab')
      ? reports.filter((r) => r.category?.some((c) => c.coding?.some((x) => x.code === 'LAB')) && withinAge((r.effectiveDateTime ?? r.issued ?? '').slice(0, 10), appt.start, req.maxAgeDays)).length
      : 0;
    const states = matching.map(itemState);
    const status: ReqStatus = clinicRecords || states.includes('ready') ? 'ready' : states.includes('to_confirm') ? 'to_confirm' : 'missing';
    return { id: req.id, label: req.label, optional: !!req.optional, status, intakeIds: matching.map((m) => m.id), clinicRecords };
  });
  const mandatory = requirements.filter((r) => !r.optional);
  const score = mandatory.reduce((acc, r) => acc + (r.status === 'ready' ? 1 : r.status === 'to_confirm' ? 0.5 : 0), 0);
  const completeness = mandatory.length ? Math.round((score / mandatory.length) * 100) : 100;
  const status: VisitPrep['status'] = mandatory.some((r) => r.status === 'missing') ? 'missing' : mandatory.some((r) => r.status === 'to_confirm') ? 'to_confirm' : 'ready';
  const lastReminder = getDb().prepare("SELECT created_at FROM reminder_sent WHERE appointment_id = ? AND kind LIKE 'docs-%' ORDER BY created_at DESC LIMIT 1").get(appt.id) as
    | { created_at: string }
    | undefined;
  return {
    appointment: appt,
    invite: inviteRow ? toInviteView(inviteRow) : undefined,
    grant: grants[0] ?? (inviteGrant ? toGrantView(inviteGrant) : undefined),
    sharing,
    requirements,
    completeness,
    status,
    counts: {
      uploaded: intake.length,
      toConfirm: intake.filter((r) => itemState(r) === 'to_confirm').length,
      unreadable: intake.filter((r) => r.status === 'unreadable').length,
    },
    lastReminderAt: lastReminder?.created_at,
  };
}

/** Lista wizyt dnia z paskiem kompletności (D2). */
export async function dayInbox(date: string, opts: { practitionerId?: string; filter?: 'missing' | 'all' } = {}): Promise<VisitPrep[]> {
  const tz = config.clinic.timezone;
  const from = zonedToUtc(date, '00:00', tz).toISOString();
  const to = zonedToUtc(addDays(date, 1), '00:00', tz).toISOString();
  const appts = (await listAppointmentsInRange(from, to, opts.practitionerId)).filter((a) => ACTIVE_APPT.includes(a.status) && a.patientId);
  const preps = await Promise.all(appts.map((a) => prepFor(a)));
  const out = opts.filter === 'missing' ? preps.filter((p) => p.status !== 'ready') : preps;
  return out.sort((a, b) => a.appointment.start.localeCompare(b.appointment.start));
}

export async function sendDocsReminder(actor: AuditActor, appointmentId: string, kind: 'docs-manual' | 'docs-auto'): Promise<{ smsQueued: boolean }> {
  const row = latestInviteRow(appointmentId);
  if (!row) throw conflict('no_invite');
  const res = await remindInvite(actor, row.id);
  getDb()
    .prepare('INSERT OR REPLACE INTO reminder_sent (appointment_id, kind, channels, status, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(appointmentId, kind === 'docs-auto' ? 'docs-auto' : `docs-manual-${Date.now()}`, '["sms"]', 'queued', nowIso());
  return res;
}

/**
 * Zadanie okresowe (MVP-1): przypomnienie automatyczne N godzin przed wizytą, jeśli brakuje wymaganych dokumentów
 * i pacjent dostał już zaproszenie. Jedno przypomnienie automatyczne na wizytę.
 */
export async function runMissingDocsSweep(): Promise<number> {
  let sent = 0;
  for (const org of await listOrganizations()) {
    const settings = getClinicSettings(org.id);
    const hours = settings.autoRemindMissingHours;
    if (!hours) continue;
    if (!moduleEnabled('inbox', { orgId: org.id }) || !moduleEnabled('invite', { orgId: org.id })) continue;
    await runInScope({ orgId: org.id }, async () => {
      const from = new Date(Date.now() + (hours - 1) * 3_600_000).toISOString();
      const to = new Date(Date.now() + hours * 3_600_000).toISOString();
      const appts = (await listAppointmentsInRange(from, to)).filter((a) => a.status === 'booked' && a.patientId);
      for (const a of appts) {
        const done = getDb().prepare("SELECT 1 FROM reminder_sent WHERE appointment_id = ? AND kind = 'docs-auto'").get(a.id);
        if (done) continue;
        const invite = latestInviteRow(a.id);
        if (!invite || invite.status !== 'active' || !invite.phone || invite.expires_at < nowIso()) continue;
        const prep = await prepFor(a, org.id);
        if (prep.status === 'ready') continue;
        try {
          await sendDocsReminder({ display: 'Eternal — przypomnienie automatyczne' }, a.id, 'docs-auto');
          sent++;
        } catch {
          getDb().prepare("INSERT OR IGNORE INTO reminder_sent (appointment_id, kind, channels, status, created_at) VALUES (?, 'docs-auto', '[]', 'failed', ?)").run(a.id, nowIso());
        }
      }
    });
  }
  return sent;
}

/** Pacjenci z aktywnym udostępnieniem dla kliniki — z datą wygaśnięcia (D1). */
export async function sharedPatients(orgId: string, actor: AuditActor) {
  const rows = getDb().prepare("SELECT * FROM access_grant WHERE org_id = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, expires_at DESC LIMIT 300").all(orgId) as unknown as Parameters<typeof toGrantView>[0][];
  const out = [];
  for (const r of rows) {
    const g = toGrantView(r);
    const p = await fhirSystem().readOptional<Patient>('Patient', r.patient_ref.split('/')[1]);
    const name = p?.name?.[0];
    out.push({ grant: g, patientId: r.patient_ref.split('/')[1], patientName: name ? `${(name.given ?? []).join(' ')} ${name.family ?? ''}`.trim() : '—', birthDate: g.status === 'active' ? p?.birthDate : undefined });
  }
  audit(actor, { action: 'R', subtype: 'shared-patients-list', detail: { count: out.length } });
  return out;
}
