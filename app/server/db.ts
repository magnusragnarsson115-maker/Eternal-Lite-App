import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Jedna baza SQLite (tryb WAL) przechowuje:
 *  - zasoby FHIR (gdy FHIR_BACKEND=local) wraz z pełną historią wersji,
 *  - dane techniczne aplikacji: konta, sesje, kolejkę powiadomień, dziennik zdarzeń.
 * Dane kliniczne przy FHIR_BACKEND=medplum|fhir trafiają na zewnętrzny serwer FHIR,
 * tu zostają wyłącznie dane techniczne i dziennik.
 */

const MIGRATIONS: string[] = [
  // 1 — magazyn FHIR
  `
  CREATE TABLE fhir_resource (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    version_id INTEGER NOT NULL,
    last_updated TEXT NOT NULL,
    ts TEXT,
    content TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (type, id)
  );
  CREATE INDEX fhir_resource_type_ts ON fhir_resource(type, ts);
  CREATE TABLE fhir_history (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    version_id INTEGER NOT NULL,
    last_updated TEXT NOT NULL,
    content TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (type, id, version_id)
  );
  CREATE TABLE fhir_ref (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    ref TEXT NOT NULL
  );
  CREATE INDEX fhir_ref_ref ON fhir_ref(ref, type);
  CREATE INDEX fhir_ref_res ON fhir_ref(type, id);
  CREATE TABLE fhir_binary (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // 2 — konta, sesje, tokeny
  `
  CREATE TABLE app_user (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    roles TEXT NOT NULL,
    fhir_ref TEXT,
    display_name TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'pl',
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE INDEX app_user_fhir_ref ON app_user(fhir_ref);
  CREATE TABLE app_session (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    mfa_passed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX app_session_user ON app_session(user_id);
  CREATE TABLE one_time_token (
    token_hash TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    user_id TEXT,
    payload TEXT,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );
  `,
  // 3 — powiadomienia
  `
  CREATE TABLE notification (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX notification_user ON notification(user_id, created_at);
  CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    user_id TEXT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    related_ref TEXT,
    dedupe_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  );
  CREATE INDEX outbox_status ON outbox(status, created_at);
  CREATE TABLE push_subscription (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // 4 — dziennik zdarzeń (append-only, łańcuch HMAC)
  `
  CREATE TABLE audit_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    actor_user_id TEXT,
    actor_ref TEXT,
    actor_display TEXT,
    actor_roles TEXT,
    action TEXT NOT NULL,
    subtype TEXT NOT NULL,
    entity_ref TEXT,
    patient_ref TEXT,
    outcome TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    detail TEXT,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
  );
  CREATE INDEX audit_patient ON audit_log(patient_ref, ts);
  CREATE INDEX audit_actor ON audit_log(actor_user_id, ts);
  CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
  CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
  `,
  // 5 — ustawienia, integracje, słowniki
  `
  CREATE TABLE setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE integration_token (
    provider TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    external_user_id TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT,
    scope TEXT,
    last_sync_at TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (provider, user_id)
  );
  CREATE TABLE cache_entry (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE medicinal_product (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    common_name TEXT,
    strength TEXT,
    form TEXT,
    holder TEXT,
    permit TEXT,
    atc TEXT,
    substances TEXT,
    search_text TEXT NOT NULL
  );
  CREATE INDEX medicinal_product_search ON medicinal_product(search_text);
  CREATE TABLE waitlist_entry (
    id TEXT PRIMARY KEY,
    patient_ref TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL,
    practitioner_id TEXT,
    before_date TEXT,
    created_at TEXT NOT NULL,
    notified_at TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE INDEX waitlist_service ON waitlist_entry(service_id, status);
  `,
  // 6 — potwierdzenia odczytu i powiązania plików z dokumentacją
  `
  CREATE TABLE record_read (
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    resource_ref TEXT NOT NULL,
    read_at TEXT NOT NULL,
    PRIMARY KEY (user_id, resource_ref)
  );
  CREATE INDEX record_read_ref ON record_read(resource_ref);
  CREATE TABLE binary_owner (
    binary_id TEXT PRIMARY KEY,
    patient_ref TEXT,
    resource_ref TEXT,
    filename TEXT,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX binary_owner_resource ON binary_owner(resource_ref);
  CREATE TABLE reminder_sent (
    appointment_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    channels TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (appointment_id, kind)
  );
  `,
];

export type Db = DatabaseSync;

let instance: DatabaseSync | undefined;

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null };
  const current = row.v ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i]);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(i + 1, new Date().toISOString());
    });
  }
}

let txDepth = 0;

/** Transakcja z obsługą zagnieżdżeń (SAVEPOINT). Funkcja musi być synchroniczna. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  const name = `sp${txDepth}`;
  db.exec(txDepth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
  txDepth++;
  try {
    const result = fn();
    txDepth--;
    db.exec(txDepth === 0 ? 'COMMIT' : `RELEASE ${name}`);
    return result;
  } catch (err) {
    txDepth--;
    db.exec(txDepth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
    throw err;
  }
}

export function initDatabase(file: string): DatabaseSync {
  instance = openDatabase(file);
  return instance;
}

export function getDb(): DatabaseSync {
  if (!instance) throw new Error('Database not initialised');
  return instance;
}

export function closeDatabase(): void {
  instance?.close();
  instance = undefined;
}
