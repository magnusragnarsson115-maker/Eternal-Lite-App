import type { Patient } from '@medplum/fhirtypes';
import { proxyRecipients } from '../auth/proxy.js';
import { findUserByFhirRef, findUserById } from '../auth/users.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import type { ConsentType } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { ChannelNotConfigured, PushGone, sendEmail, sendPush, sendSms } from '../integrations/channels.js';
import { newId, nowIso } from '../lib/util.js';
import { hasConsent } from './consents.js';
import { config } from '../config.js';

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

// --- preferencje powiadomień i godziny ciszy (P8: A3.4, A14.2) ------------------------------------------

export const NOTIFY_KINDS = ['appointment-reminder', 'docs-request', 'after-visit-card', 'record-shared', 'message', 'med-reminder', 'med-stock', 'custom-reminder', 'preventive', 'morning-summary', 'air-alert', 'lab-flags'] as const;
/** Zawsze dostarczane (bezpieczeństwo konta, SOS) — bez wyłączania i bez godzin ciszy. */
const ALWAYS = new Set(['security', 'sos']);
const IGNORE_QUIET = new Set(['security', 'sos', 'med-reminder', 'custom-reminder']);

export interface NotifyPrefs {
  disabled: string[];
  quiet: { enabled: boolean; from: string; to: string };
}

const DEFAULT_PREFS: NotifyPrefs = { disabled: [], quiet: { enabled: true, from: '22:00', to: '07:00' } };

export function getNotifyPrefs(userId: string): NotifyPrefs {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'notify'").get(userId) as { value: string } | undefined;
  return row ? { ...DEFAULT_PREFS, ...(JSON.parse(row.value) as Partial<NotifyPrefs>) } : DEFAULT_PREFS;
}

export function setNotifyPrefs(userId: string, prefs: NotifyPrefs): NotifyPrefs {
  const clean: NotifyPrefs = {
    disabled: prefs.disabled.filter((k) => (NOTIFY_KINDS as readonly string[]).includes(k)),
    quiet: { enabled: prefs.quiet.enabled, from: prefs.quiet.from, to: prefs.quiet.to },
  };
  if (![clean.quiet.from, clean.quiet.to].every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('invalid_time');
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'notify', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(clean), nowIso());
  return clean;
}

/** Koniec godzin ciszy (ISO), jeśli teraz trwają — wysyłka odroczona; inaczej undefined. */
export function quietUntil(prefs: NotifyPrefs, now = new Date(), tz = config.clinic.timezone): string | undefined {
  if (!prefs.quiet.enabled) return undefined;
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const cur = toMin(local);
  const from = toMin(prefs.quiet.from);
  const to = toMin(prefs.quiet.to);
  const inQuiet = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  if (!inQuiet) return undefined;
  const minutesLeft = (to - cur + 24 * 60) % (24 * 60);
  return new Date(now.getTime() + minutesLeft * 60_000).toISOString();
}

/** Powiadomienie w aplikacji (zawsze) + push, jeśli pacjent wyraził zgodę i ma subskrypcję. */
export async function notifyUser(
  userId: string,
  n: { kind: string; title: string; body: string; link?: string; push?: boolean; pushTitle?: string; pushBody?: string; fallback?: boolean },
): Promise<void> {
  const id = newId();
  const prefs = getNotifyPrefs(userId);
  const muted = !ALWAYS.has(n.kind) && prefs.disabled.includes(n.kind);
  const notBefore = IGNORE_QUIET.has(n.kind) ? undefined : quietUntil(prefs);
  getDb()
    .prepare('INSERT INTO notification (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, n.kind, n.title, n.body, n.link ?? null, nowIso());
  bus.publish({ type: 'notification.created', userId, staff: false });
  if (n.push !== false && !muted) {
    const user = findUserById(userId);
    const allowed = user?.fhir_ref?.startsWith('Patient/') ? await hasConsent(user.fhir_ref, 'reminders-push') : true;
    const subs = allowed ? (getDb().prepare('SELECT id FROM push_subscription WHERE user_id = ?').all(userId) as { id: string }[]) : [];
    for (const s of subs) {
      // treść push bywa widoczna na ekranie blokady — przy treści wrażliwej usługa podaje wersję ogólną
      enqueue({ channel: 'push', userId, recipient: s.id, subject: n.pushTitle ?? n.title, body: n.pushBody ?? n.body, relatedRef: n.link, dedupeKey: `push:${id}:${s.id}`, notBefore });
    }
    // kolejność kanałów push → e-mail → SMS (R6): bez push — jedna wiadomość ogólna e-mailem albo SMS-em, za zgodą
    if (!subs.length && n.fallback && user?.fhir_ref?.startsWith('Patient/')) {
      const subject = n.pushTitle ?? 'Eternal';
      const body = n.pushBody ?? 'Masz nową informację w aplikacji. Zaloguj się, aby ją zobaczyć.';
      if (user.email && (await hasConsent(user.fhir_ref, 'reminders-email'))) {
        enqueue({ channel: 'email', userId, recipient: user.email, subject, body, relatedRef: n.link, dedupeKey: `fb:${id}:email`, notBefore });
      } else if (user.phone && user.phone_verified && (await hasConsent(user.fhir_ref, 'reminders-sms'))) {
        enqueue({ channel: 'sms', userId, recipient: user.phone, subject: '', body: `${subject}: ${body}`, relatedRef: n.link, dedupeKey: `fb:${id}:sms`, notBefore });
      }
    }
  }
}

export async function notifyPatient(
  patientRef: string,
  n: { kind: string; title: string; body: string; link?: string; push?: boolean; pushTitle?: string; pushBody?: string },
): Promise<void> {
  const user = findUserByFhirRef(patientRef);
  if (user) return notifyUser(user.id, n);
  // profil prowadzony przez opiekuna (A24.1): powiadomienie trafia do opiekunów, z imieniem profilu w tytule
  const proxies = proxyRecipients(patientRef);
  if (!proxies.length) return;
  const p = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
  const given = p?.name?.[0]?.given?.[0];
  const link = n.link ? `${n.link}${n.link.includes('?') ? '&' : '?'}profile=${patientRef.split('/')[1]}` : undefined;
  for (const id of proxies) await notifyUser(id, { ...n, title: given ? `${given}: ${n.title}` : n.title, link });
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
  notBefore?: string;
}): boolean {
  const res = getDb()
    .prepare(
      `INSERT OR IGNORE INTO outbox (id, channel, user_id, recipient, subject, body, related_ref, dedupe_key, created_at, not_before)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), input.channel, input.userId ?? null, input.recipient, input.subject, input.body, input.relatedRef ?? null, input.dedupeKey ?? null, nowIso(), input.notBefore ?? null);
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
    const rows = db.prepare("SELECT * FROM outbox WHERE status = 'pending' AND (not_before IS NULL OR not_before <= ?) ORDER BY created_at LIMIT 50").all(nowIso()) as unknown as OutboxRow[];
    for (const row of rows) {
      try {
        if (row.channel === 'email') await sendEmail(row.recipient, row.subject, row.body);
        else if (row.channel === 'sms') await sendSms(row.recipient, (row.subject ? `${row.subject}. ${row.body}` : row.body).slice(0, 459));
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
