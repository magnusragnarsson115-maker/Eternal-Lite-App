import { audit, type AuditActor } from '../audit.js';
import { listUsers } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { emailConfigured, sendEmail } from '../integrations/channels.js';
import { badRequest, conflict, newId, notFound, nowIso } from '../lib/util.js';
import { notifyUser } from './notifications.js';

/**
 * Zgłaszanie incydentów przez użytkowników (A18.4, D0/DOC-05): kto zgłosił, kategoria, termin obsługi wg wagi,
 * eskalacja (komu dalej). Kategoria „prywatność/bezpieczeństwo” oznacza możliwe naruszenie ochrony danych —
 * administrator ma 72 h na ocenę i ewentualne zgłoszenie do PUODO (art. 33 RODO), dlatego termin jest krótszy.
 */

export type IncidentCategory = 'data-error' | 'ai-content' | 'privacy' | 'security' | 'availability' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'new' | 'triage' | 'in-progress' | 'resolved' | 'closed';

const DUE_HOURS: Record<IncidentSeverity, number> = { critical: 24, high: 72, medium: 7 * 24, low: 14 * 24 };

export interface IncidentRow {
  id: string;
  org_id: string | null;
  reporter_user_id: string | null;
  reporter_kind: 'patient' | 'staff' | 'link';
  reporter_display: string | null;
  category: IncidentCategory;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  contact: string | null;
  handled_by: string | null;
  resolution: string | null;
  due_at: string;
  created_at: string;
  updated_at: string;
  escalated_to: string | null;
  escalated_at: string | null;
  data_breach: number;
}

export function toIncidentView(r: IncidentRow) {
  return {
    id: r.id,
    reporterKind: r.reporter_kind,
    reporter: r.reporter_display ?? undefined,
    category: r.category,
    description: r.description,
    severity: r.severity,
    status: r.status,
    contact: r.contact ?? undefined,
    handledBy: r.handled_by ?? undefined,
    resolution: r.resolution ?? undefined,
    dueAt: r.due_at,
    overdue: !['resolved', 'closed'].includes(r.status) && r.due_at < nowIso(),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    escalatedTo: r.escalated_to ?? undefined,
    escalatedAt: r.escalated_at ?? undefined,
    possibleDataBreach: !!r.data_breach,
  };
}

export async function reportIncident(
  actor: AuditActor,
  input: { orgId?: string; reporterKind: IncidentRow['reporter_kind']; category: IncidentCategory; description: string; severity?: IncidentSeverity; contact?: string },
) {
  const description = input.description.trim();
  if (description.length < 10) throw badRequest('description_too_short');
  const breach = input.category === 'privacy' || input.category === 'security';
  let severity: IncidentSeverity = input.severity ?? 'medium';
  if (breach && (severity === 'low' || severity === 'medium')) severity = 'high';
  const now = new Date();
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO incident (id, org_id, reporter_user_id, reporter_kind, reporter_display, category, description, severity, status, contact, due_at, created_at, updated_at, data_breach)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.orgId ?? null,
      actor.userId ?? null,
      input.reporterKind,
      actor.display ?? null,
      input.category,
      description.slice(0, 4000),
      severity,
      input.contact?.slice(0, 200) ?? null,
      new Date(now.getTime() + DUE_HOURS[severity] * 3_600_000).toISOString(),
      now.toISOString(),
      now.toISOString(),
      breach ? 1 : 0,
    );
  audit(actor, { action: 'C', subtype: 'incident-report', entityRef: `urn:eternal:incident:${id}`, detail: { category: input.category, severity } });
  // powiadomienie administratorów kliniki (bez treści zgłoszenia poza aplikacją)
  const admins = listUsers({ staffOnly: true }).filter((u) => u.roles.includes('admin') && u.status === 'active' && (!input.orgId || u.org_id === input.orgId || !u.org_id));
  for (const a of admins) {
    await notifyUser(a.id, { kind: 'incident', title: breach ? 'Zgłoszenie: możliwe naruszenie ochrony danych' : 'Nowe zgłoszenie incydentu', body: `Kategoria: ${input.category}, waga: ${severity}.`, link: '/panel/organizacja?tab=incydenty', push: false });
  }
  if (breach && config.security.contact && emailConfigured()) {
    await sendEmail(config.security.contact, `Eternal — zgłoszenie bezpieczeństwa (${severity})`, `Nowe zgłoszenie kategorii ${input.category} (id ${id}). Szczegóły w panelu — art. 33 RODO: 72 h na ocenę.`).catch(() => undefined);
  }
  bus.publish({ type: 'incident.changed', staff: true, orgIds: input.orgId ? [input.orgId] : undefined });
  return toIncidentView(getDb().prepare('SELECT * FROM incident WHERE id = ?').get(id) as unknown as IncidentRow);
}

export function listIncidents(orgId: string | undefined, opts: { open?: boolean } = {}) {
  const rows = getDb()
    .prepare(`SELECT * FROM incident WHERE (org_id = ? OR (org_id IS NULL AND ? = 1)) ${opts.open ? "AND status NOT IN ('resolved','closed')" : ''} ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'triage' THEN 1 WHEN 'in-progress' THEN 2 ELSE 3 END, due_at`)
    .all(orgId ?? '', orgId ? 0 : 1) as unknown as IncidentRow[];
  return rows.map(toIncidentView);
}

const NEXT: Record<IncidentStatus, IncidentStatus[]> = {
  new: ['triage', 'in-progress', 'closed'],
  triage: ['in-progress', 'resolved', 'closed'],
  'in-progress': ['resolved', 'closed'],
  resolved: ['closed', 'in-progress'],
  closed: [],
};

export function updateIncident(
  actor: AuditActor,
  orgId: string | undefined,
  id: string,
  patch: { status?: IncidentStatus; severity?: IncidentSeverity; resolution?: string; escalatedTo?: string },
) {
  const row = getDb().prepare('SELECT * FROM incident WHERE id = ?').get(id) as IncidentRow | undefined;
  if (!row || (row.org_id && row.org_id !== orgId)) throw notFound('incident_not_found');
  if (patch.status && patch.status !== row.status && !NEXT[row.status].includes(patch.status)) throw conflict('invalid_transition');
  if (patch.status === 'resolved' && !(patch.resolution ?? row.resolution)) throw badRequest('resolution_required');
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE incident SET status = ?, severity = ?, resolution = ?, handled_by = ?, escalated_to = ?, escalated_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      patch.status ?? row.status,
      patch.severity ?? row.severity,
      patch.resolution?.slice(0, 2000) ?? row.resolution,
      actor.display ?? row.handled_by,
      patch.escalatedTo?.slice(0, 200) ?? row.escalated_to,
      patch.escalatedTo && patch.escalatedTo !== row.escalated_to ? now : row.escalated_at,
      now,
      id,
    );
  audit(actor, { action: 'U', subtype: 'incident-update', entityRef: `urn:eternal:incident:${id}`, detail: { status: patch.status, escalatedTo: patch.escalatedTo } });
  bus.publish({ type: 'incident.changed', staff: true, orgIds: row.org_id ? [row.org_id] : undefined });
  return toIncidentView(getDb().prepare('SELECT * FROM incident WHERE id = ?').get(id) as unknown as IncidentRow);
}
