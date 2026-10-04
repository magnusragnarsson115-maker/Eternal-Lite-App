import { findUserByFhirRef, findUserById } from '../auth/users.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import type { ConsentType } from '../fhir/constants.js';
import { ChannelNotConfigured, PushGone, sendEmail, sendPush, sendSms } from '../integrations/channels.js';
import { newId, nowIso } from '../lib/util.js';
import { hasConsent } from './consents.js';

export type Channel = 'email' | 'sms' | 'push';

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface OutboxRow {
  id: string;
  channel: Channel;
  user_id: string | null;
  recipient: string;
  subject: string;
  body: string;
  related_ref: string | null;
  dedupe_key: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

const MAX_ATTEMPTS = 5;

/** Powiadomienie w aplikacji (zawsze) + push, jeśli pacjent wyraził zgodę i ma subskrypcję. */
export async function notifyUser(
  userId: string,
  n: { kind: string; title: string; body: string; link?: string; push?: boolean },
): Promise<void> {
  const id = newId();
  getDb()
    .prepare('INSERT INTO notification (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, n.kind, n.title, n.body, n.link ?? null, nowIso());
  bus.publish({ type: 'notification.created', userId, staff: false });
  if (n.push !== false) {
    const user = findUserById(userId);
    const allowed = user?.fhir_ref?.startsWith('Patient/') ? await hasConsent(user.fhir_ref, 'reminders-push') : true;
    if (allowed) {
      const subs = getDb().prepare('SELECT id FROM push_subscription WHERE user_id = ?').all(userId) as { id: string }[];
      for (const s of subs) {
        enqueue({ channel: 'push', userId, recipient: s.id, subject: n.title, body: n.body, relatedRef: n.link, dedupeKey: `push:${id}:${s.id}` });
      }
    }
  }
}

export async function notifyPatient(
  patientRef: string,
  n: { kind: string; title: string; body: string; link?: string; push?: boolean },
): Promise<void> {
  const user = findUserByFhirRef(patientRef);
  if (user) await notifyUser(user.id, n);
}

/** Wiadomość poza aplikację, wyłącznie za zgodą pacjenta na dany kanał. */
export async function messagePatientExternally(
  patientRef: string,
  contact: { email?: string; phone?: string },
  msg: { subject: string; body: string; relatedRef?: string; dedupeKey: string },
): Promise<Channel[]> {
  const queued: Channel[] = [];
  const user = findUserByFhirRef(patientRef);
  const checks: [Channel, ConsentType, string | undefined][] = [
    ['email', 'reminders-email', contact.email ?? user?.email],
    ['sms', 'reminders-sms', contact.phone],
  ];
  for (const [channel, consent, recipient] of checks) {
    if (!recipient) continue;
    if (!(await hasConsent(patientRef, consent))) continue;
    enqueue({ channel, userId: user?.id, recipient, subject: msg.subject, body: msg.body, relatedRef: msg.relatedRef, dedupeKey: `${msg.dedupeKey}:${channel}` });
    queued.push(channel);
  }
  return queued;
}

export function enqueue(input: {
  channel: Channel;
  userId?: string;
  recipient: string;
  subject: string;
  body: string;
  relatedRef?: string;
  dedupeKey?: string;
}): boolean {
  const res = getDb()
    .prepare(
      `INSERT OR IGNORE INTO outbox (id, channel, user_id, recipient, subject, body, related_ref, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), input.channel, input.userId ?? null, input.recipient, input.subject, input.body, input.relatedRef ?? null, input.dedupeKey ?? null, nowIso());
  if (res.changes > 0) {
    bus.publish({ type: 'outbox.changed' });
    setImmediate(() => void processOutbox());
  }
  return res.changes > 0;
}

let processing = false;

export async function processOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50").all() as unknown as OutboxRow[];
    for (const row of rows) {
      try {
        if (row.channel === 'email') await sendEmail(row.recipient, row.subject, row.body);
        else if (row.channel === 'sms') await sendSms(row.recipient, `${row.subject}. ${row.body}`.slice(0, 459));
        else if (row.channel === 'push') {
          const sub = db.prepare('SELECT endpoint, keys FROM push_subscription WHERE id = ?').get(row.recipient) as
            | { endpoint: string; keys: string }
            | undefined;
          if (!sub) throw new PushGone('subscription removed');
          await sendPush({ endpoint: sub.endpoint, keys: JSON.parse(sub.keys) }, { title: row.subject, body: row.body, url: row.related_ref ?? '/' });
        }
        db.prepare("UPDATE outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1, error = NULL WHERE id = ?").run(nowIso(), row.id);
      } catch (err) {
        if (err instanceof ChannelNotConfigured) {
          db.prepare("UPDATE outbox SET status = 'skipped', error = 'provider_not_configured' WHERE id = ?").run(row.id);
        } else if (err instanceof PushGone) {
          db.prepare('DELETE FROM push_subscription WHERE id = ?').run(row.recipient);
          db.prepare("UPDATE outbox SET status = 'skipped', error = 'push_subscription_expired' WHERE id = ?").run(row.id);
        } else {
          const attempts = row.attempts + 1;
          db.prepare('UPDATE outbox SET attempts = ?, status = ?, error = ? WHERE id = ?').run(
            attempts,
            attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            (err as Error).message.slice(0, 500),
            row.id,
          );
        }
      }
    }
    if (rows.length) bus.publish({ type: 'outbox.changed' });
  } finally {
    processing = false;
  }
}

export function listNotifications(userId: string, limit = 50): NotificationRow[] {
  return getDb().prepare('SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as unknown as NotificationRow[];
}

export function markNotificationsRead(userId: string, ids?: string[]): void {
  const db = getDb();
  if (ids?.length) {
    const stmt = db.prepare('UPDATE notification SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL');
    for (const id of ids) stmt.run(nowIso(), userId, id);
  } else {
    db.prepare('UPDATE notification SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(nowIso(), userId);
  }
}

export function listOutbox(limit = 100): OutboxRow[] {
  return getDb().prepare('SELECT * FROM outbox ORDER BY created_at DESC LIMIT ?').all(limit) as unknown as OutboxRow[];
}

export function savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  getDb()
    .prepare(
      `INSERT INTO push_subscription (id, user_id, endpoint, keys, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`,
    )
    .run(newId(), userId, sub.endpoint, JSON.stringify(sub.keys), nowIso());
}

export function removePushSubscription(userId: string, endpoint: string): void {
  getDb().prepare('DELETE FROM push_subscription WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
}
