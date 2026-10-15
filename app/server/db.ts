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
  // 7 — organizacje, udostępnienia, zaproszenia, materiały, Scribe, AI, mierniki, incydenty, klucze dostępu
  `
  ALTER TABLE app_user ADD COLUMN org_id TEXT;
  ALTER TABLE app_user ADD COLUMN phone TEXT;
  ALTER TABLE app_user ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE app_session ADD COLUMN device_label TEXT;
  ALTER TABLE app_session ADD COLUMN auth_method TEXT;
  CREATE INDEX app_user_org ON app_user(org_id);

  CREATE TABLE access_grant (
    id TEXT PRIMARY KEY,
    patient_ref TEXT NOT NULL,
    org_id TEXT NOT NULL,
    practitioner_ref TEXT,
    scope TEXT NOT NULL,
    purpose TEXT NOT NULL,
    appointment_id TEXT,
    consent_ref TEXT,
    source TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    revoked_by TEXT
  );
  CREATE INDEX access_grant_patient ON access_grant(patient_ref, status);
  CREATE INDEX access_grant_org ON access_grant(org_id, status, expires_at);

  CREATE TABLE invite_link (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL,
    patient_ref TEXT NOT NULL,
    appointment_id TEXT,
    purpose TEXT NOT NULL,
    subject_ref TEXT,
    phone TEXT,
    email TEXT,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT,
    created_at TEXT NOT NULL,
    first_opened_at TEXT,
    last_opened_at TEXT,
    sent_channels TEXT
  );
  CREATE INDEX invite_link_appt ON invite_link(appointment_id);
  CREATE INDEX invite_link_patient ON invite_link(patient_ref);

  CREATE TABLE intake_item (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    patient_ref TEXT NOT NULL,
    appointment_id TEXT,
    invite_id TEXT,
    uploaded_by TEXT NOT NULL,
    binary_id TEXT NOT NULL,
    filename TEXT,
    content_type TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    ocr_provider TEXT,
    ocr_text TEXT,
    ocr_pages INTEGER,
    extracted TEXT,
    laboratory TEXT,
    collected_at TEXT,
    document_ref TEXT,
    report_ref TEXT,
    confirmed_at TEXT,
    confirmed_by TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX intake_item_appt ON intake_item(appointment_id);
  CREATE INDEX intake_item_patient ON intake_item(patient_ref, created_at);

  CREATE TABLE scribe_session (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    appointment_id TEXT,
    patient_ref TEXT NOT NULL,
    practitioner_user_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    consent_at TEXT NOT NULL,
    consent_note TEXT,
    audio_binary_id TEXT,
    audio_deleted_at TEXT,
    audio_seconds REAL,
    stt_provider TEXT,
    transcript TEXT,
    note TEXT,
    note_original TEXT,
    validation TEXT,
    status TEXT NOT NULL,
    error TEXT,
    recorded_at TEXT,
    draft_ready_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    composition_ref TEXT,
    corrected_ratio REAL,
    summary TEXT,
    summary_status TEXT,
    summary_approved_at TEXT,
    summary_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX scribe_session_appt ON scribe_session(appointment_id);
  CREATE INDEX scribe_session_org ON scribe_session(org_id, created_at);

  CREATE TABLE ai_call (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    org_id TEXT,
    user_id TEXT,
    task TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    prompt_version TEXT,
    input_units INTEGER,
    output_units INTEGER,
    latency_ms INTEGER,
    outcome TEXT NOT NULL,
    error_code TEXT
  );
  CREATE INDEX ai_call_ts ON ai_call(ts);

  CREATE TABLE metric_event (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    type TEXT NOT NULL,
    user_id TEXT,
    appointment_id TEXT,
    value REAL,
    data TEXT
  );
  CREATE INDEX metric_event_org ON metric_event(org_id, type, ts);

  CREATE TABLE incident (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    reporter_user_id TEXT,
    reporter_kind TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    contact TEXT,
    handled_by TEXT,
    resolution TEXT,
    due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX incident_org ON incident(org_id, status);

  CREATE TABLE webauthn_credential (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL,
    transports TEXT,
    label TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );
  CREATE INDEX webauthn_user ON webauthn_credential(user_id);

  CREATE TABLE recovery_code (
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, code_hash)
  );

  CREATE TABLE user_pref (
    user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  CREATE TABLE emergency_contact (
    id TEXT PRIMARY KEY,
    patient_ref TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relation TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX emergency_contact_patient ON emergency_contact(patient_ref);

  CREATE TABLE sos_event (
    id TEXT PRIMARY KEY,
    patient_ref TEXT NOT NULL,
    ts TEXT NOT NULL,
    notified TEXT NOT NULL,
    location TEXT,
    card_token_hash TEXT,
    card_expires_at TEXT,
    resolved_at TEXT
  );
  CREATE INDEX sos_event_patient ON sos_event(patient_ref, ts);

  CREATE TABLE deletion_job (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    patient_ref TEXT,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL,
    steps TEXT NOT NULL,
    completed_at TEXT
  );
  `,
  // 8 — powiązania linków z udostępnieniami, wideo z poczekalnią, harmonogram leków, wersje notatek
  `
  ALTER TABLE invite_link ADD COLUMN grant_id TEXT;
  ALTER TABLE invite_link ADD COLUMN uses INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE access_grant ADD COLUMN recipient_label TEXT;
  ALTER TABLE access_grant ADD COLUMN invite_id TEXT;
  ALTER TABLE intake_item ADD COLUMN source TEXT NOT NULL DEFAULT 'invite';
  ALTER TABLE scribe_session ADD COLUMN audio_content_type TEXT;
  ALTER TABLE scribe_session ADD COLUMN card_ref TEXT;
  ALTER TABLE scribe_session ADD COLUMN erecipe_code TEXT;
  ALTER TABLE scribe_session ADD COLUMN edit_seconds REAL;
  ALTER TABLE scribe_session ADD COLUMN ai_provider TEXT;
  ALTER TABLE scribe_session ADD COLUMN ai_model TEXT;
  ALTER TABLE scribe_session ADD COLUMN prompt_version TEXT;
  ALTER TABLE scribe_session ADD COLUMN template_version TEXT;
  ALTER TABLE scribe_session ADD COLUMN pdf_binary_id TEXT;
  CREATE INDEX intake_item_org ON intake_item(org_id, created_at);

  CREATE TABLE tele_session (
    appointment_id TEXT PRIMARY KEY,
    org_id TEXT,
    provider TEXT NOT NULL,
    room TEXT NOT NULL,
    host_room TEXT,
    patient_joined_at TEXT,
    admitted_at TEXT,
    admitted_by TEXT,
    doctor_joined_at TEXT,
    ended_at TEXT,
    minutes REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE med_schedule (
    id TEXT PRIMARY KEY,
    patient_ref TEXT NOT NULL,
    medication_ref TEXT,
    label TEXT NOT NULL,
    times TEXT NOT NULL,
    days TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX med_schedule_patient ON med_schedule(patient_ref, active);
  CREATE TABLE med_intake (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES med_schedule(id) ON DELETE CASCADE,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL,
    confirmed_at TEXT,
    UNIQUE (schedule_id, due_at)
  );

  CREATE TABLE app_code (
    purpose TEXT NOT NULL,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    payload TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (purpose, user_id)
  );
  `,
  // 9 — godziny ciszy (wysyłka odroczona), eskalacja incydentów
  `
  ALTER TABLE outbox ADD COLUMN not_before TEXT;
  ALTER TABLE incident ADD COLUMN escalated_to TEXT;
  ALTER TABLE incident ADD COLUMN escalated_at TEXT;
  ALTER TABLE incident ADD COLUMN reporter_display TEXT;
  ALTER TABLE incident ADD COLUMN data_breach INTEGER NOT NULL DEFAULT 0;
  `,
  // 10 — ankiety (A12.3): rejestr wypełnień bez tożsamości; treść tylko dla ankiety o aplikacji (anonimowa)
  `
  CREATE TABLE survey_submission (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    version TEXT NOT NULL,
    kind TEXT NOT NULL,
    org_ids TEXT NOT NULL DEFAULT '',
    platform TEXT,
    answers TEXT,
    submitted_at TEXT NOT NULL
  );
  CREATE INDEX survey_submission_survey ON survey_submission(survey_id, submitted_at);
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
