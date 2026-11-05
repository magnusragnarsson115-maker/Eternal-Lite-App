import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuditEvent } from '@medplum/fhirtypes';
import type { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { getDb, transaction } from './db.js';
import { nowIso } from './lib/util.js';

/**
 * Dziennik zdarzeń dostępu do danych (RODO art. 5 ust. 2 i art. 32, rozporządzenie MZ
 * w sprawie dokumentacji medycznej — rejestrowanie dostępu, EHDS — logging component).
 *
 * Tabela jest append-only (wyzwalacze blokują UPDATE/DELETE), a każdy wpis zawiera
 * HMAC poprzedniego wpisu — modyfikacja lub usunięcie wiersza z pominięciem aplikacji
 * jest wykrywalna przez verifyAuditChain().
 */

export type AuditAction = 'C' | 'R' | 'U' | 'D' | 'E';

export interface AuditActor {
  userId?: string;
  actorRef?: string;
  display?: string;
  roles?: string[];
  ip?: string;
  userAgent?: string;
}

export interface AuditEntry {
  action: AuditAction;
  subtype: string;
  entityRef?: string;
  patientRef?: string;
  outcome?: 'success' | 'failure';
  detail?: string | Record<string, unknown>;
}

export interface AuditRow {
  seq: number;
  ts: string;
  actor_user_id: string | null;
  actor_ref: string | null;
  actor_display: string | null;
  actor_roles: string | null;
  action: AuditAction;
  subtype: string;
  entity_ref: string | null;
  patient_ref: string | null;
  outcome: string;
  ip: string | null;
  user_agent: string | null;
  detail: string | null;
  prev_hash: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);
let hmacKey: Buffer | undefined;

function key(): Buffer {
  if (hmacKey) return hmacKey;
  if (config.security.auditHmacKey) {
    hmacKey = Buffer.from(config.security.auditHmacKey, 'utf8');
    return hmacKey;
  }
  // Brak klucza w konfiguracji: generujemy i zapisujemy w katalogu danych (tylko dla właściciela).
  const file = path.join(config.dataDir, 'audit.key');
  if (fs.existsSync(file)) {
    hmacKey = fs.readFileSync(file);
  } else {
    fs.mkdirSync(config.dataDir, { recursive: true });
    hmacKey = crypto.randomBytes(32);
    fs.writeFileSync(file, hmacKey, { mode: 0o600 });
  }
  return hmacKey;
}

export function setAuditKeyForTests(k: string): void {
  hmacKey = Buffer.from(k);
}

function computeHash(prev: string, row: Omit<AuditRow, 'seq' | 'hash' | 'prev_hash'>): string {
  const canonical = JSON.stringify([
    row.ts,
    row.actor_user_id,
    row.actor_ref,
    row.actor_display,
    row.actor_roles,
    row.action,
    row.subtype,
    row.entity_ref,
    row.patient_ref,
    row.outcome,
    row.ip,
    row.user_agent,
    row.detail,
  ]);
  return crypto.createHmac('sha256', key()).update(prev).update('|').update(canonical).digest('hex');
}

export function audit(actor: AuditActor | undefined, entry: AuditEntry, db: DatabaseSync = getDb()): void {
  const row = {
    ts: nowIso(),
    actor_user_id: actor?.userId ?? null,
    actor_ref: actor?.actorRef ?? null,
    actor_display: actor?.display ?? null,
    actor_roles: actor?.roles?.join(',') ?? null,
    action: entry.action,
    subtype: entry.subtype,
    entity_ref: entry.entityRef ?? null,
    patient_ref: entry.patientRef ?? null,
    outcome: entry.outcome ?? 'success',
    ip: actor?.ip ?? null,
    user_agent: actor?.userAgent?.slice(0, 300) ?? null,
    detail: entry.detail === undefined ? null : typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail),
  };
  transaction(db, () => {
    const last = db.prepare('SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1').get() as { hash: string } | undefined;
    const prev = last?.hash ?? GENESIS;
    const hash = computeHash(prev, row);
    db.prepare(
      `INSERT INTO audit_log (ts, actor_user_id, actor_ref, actor_display, actor_roles, action, subtype, entity_ref, patient_ref,
        outcome, ip, user_agent, detail, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.ts,
      row.actor_user_id,
      row.actor_ref,
      row.actor_display,
      row.actor_roles,
      row.action,
      row.subtype,
      row.entity_ref,
      row.patient_ref,
      row.outcome,
      row.ip,
      row.user_agent,
      row.detail,
      prev,
      hash,
    );
  });
}

export function verifyAuditChain(db: DatabaseSync = getDb()): { ok: boolean; count: number; brokenAt?: number } {
  let prev = GENESIS;
  let count = 0;
  const iter = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').iterate() as Iterable<AuditRow>;
  for (const row of iter) {
    count++;
    if (row.prev_hash !== prev) return { ok: false, count, brokenAt: row.seq };
    const { seq: _seq, hash, prev_hash: _p, ...rest } = row;
    if (computeHash(prev, rest) !== hash) return { ok: false, count, brokenAt: row.seq };
    prev = hash;
  }
  return { ok: true, count };
}

export function listAudit(
  filter: { patientRef?: string; actorUserId?: string; limit?: number; before?: number },
  db: DatabaseSync = getDb(),
): AuditRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.patientRef) { where.push('patient_ref = ?'); args.push(filter.patientRef); }
  if (filter.actorUserId) { where.push('actor_user_id = ?'); args.push(filter.actorUserId); }
  if (filter.before) { where.push('seq < ?'); args.push(filter.before); }
  const sql = `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY seq DESC LIMIT ?`;
  args.push(Math.min(filter.limit ?? 100, 500));
  return db.prepare(sql).all(...args) as unknown as AuditRow[];
}

const ACTION_SUBTYPE_DISPLAY: Record<string, string> = {
  login: 'Logowanie',
  logout: 'Wylogowanie',
  'login-failed': 'Nieudane logowanie',
};

/** Reprezentacja wpisu jako zasób FHIR AuditEvent (eksport, interoperacyjność). */
export function toAuditEvent(row: AuditRow): AuditEvent {
  return {
    resourceType: 'AuditEvent',
    id: String(row.seq),
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
      code: ['login', 'logout', 'login-failed', 'mfa'].some((s) => row.subtype.startsWith(s)) ? '110114' : 'rest',
      display: ['login', 'logout', 'login-failed', 'mfa'].some((s) => row.subtype.startsWith(s)) ? 'User Authentication' : 'RESTful Operation',
    },
    subtype: [{ system: 'urn:eternal:audit-subtype', code: row.subtype, display: ACTION_SUBTYPE_DISPLAY[row.subtype] ?? row.subtype }],
    action: row.action,
    recorded: row.ts,
    outcome: row.outcome === 'success' ? '0' : '4',
    agent: [
      {
        who: row.actor_ref ? { reference: row.actor_ref, display: row.actor_display ?? undefined } : { display: row.actor_display ?? 'system' },
        requestor: true,
        network: row.ip ? { address: row.ip, type: '2' } : undefined,
      },
    ],
    source: { observer: { display: 'Eternal' } },
    entity: [
      ...(row.entity_ref ? [{ what: { reference: row.entity_ref } }] : []),
      ...(row.patient_ref ? [{ what: { reference: row.patient_ref }, role: { system: 'http://terminology.hl7.org/CodeSystem/object-role', code: '1', display: 'Patient' } }] : []),
    ],
  };
}
