import path from 'node:path';
import { purgeExpiredSessions } from './auth/sessions.js';
import { config } from './config.js';
import { initDatabase } from './db.js';
import { createRepository, setRepo } from './fhir/index.js';
import { getVapidKeys } from './integrations/channels.js';
import { processOutbox } from './services/notifications.js';
import { ensureOrganizations } from './services/orgs.js';
import { runReminderSweep } from './services/reminders.js';
import { expireGrants } from './services/grants.js';
import { runMissingDocsSweep } from './services/inbox.js';
import { purgeRecordings } from './services/scribe.js';
import { runMonthlyReports } from './services/reports.js';
import { runMedReminderSweep } from './services/medReminders.js';
import { runAirAlertSweep } from './services/environment.js';
import { runCustomReminderSweep, runMorningSweep, runPreventiveSweep } from './services/personalReminders.js';

export async function initCore(): Promise<void> {
  initDatabase(path.join(config.dataDir, 'eternal.sqlite'));
  const repo = createRepository();
  await repo.init();
  setRepo(repo);
  await ensureOrganizations();
  getVapidKeys();
}

export function productionWarnings(): string[] {
  const w: string[] = [];
  if (!config.isProduction) return w;
  if (config.demoMode) w.push('DEMO_MODE=true w produkcji — wyłącz (baner danych fikcyjnych, seed).');
  if (!config.security.auditHmacKey) w.push('AUDIT_HMAC_KEY nie ustawiony — klucz łańcucha dziennika leży w katalogu danych.');
  if (config.jitsi.domain === 'meet.jit.si') w.push('JITSI_DOMAIN=meet.jit.si — publiczny serwer bez umowy powierzenia; użyj własnej instancji.');
  if (!config.publicUrl.startsWith('https://')) w.push('PUBLIC_URL bez https — ciasteczka Secure nie zadziałają.');
  if (!config.mail.smtpUrl) w.push('SMTP_URL nie ustawiony — brak weryfikacji e-mail, resetu hasła i przypomnień e-mail.');
  return w;
}

export function startJobs(log: (msg: string, err?: unknown) => void): () => void {
  const every = (ms: number, name: string, fn: () => Promise<unknown> | unknown) =>
    setInterval(() => {
      Promise.resolve()
        .then(fn)
        .catch((err) => log(`${name} failed`, err));
    }, ms);
  const timers = [
    every(10 * 60_000, 'grant expiry', expireGrants),
    every(15 * 60_000, 'missing documents sweep', runMissingDocsSweep),
    every(60 * 60_000, 'recording purge', purgeRecordings),
    every(60 * 60_000, 'monthly pilot report', runMonthlyReports),
    every(60_000, 'medication reminders', runMedReminderSweep),
    every(60_000, 'custom reminders', runCustomReminderSweep),
    every(60_000, 'morning summary', runMorningSweep),
    every(60 * 60_000, 'preventive reminders', runPreventiveSweep),
    every(60 * 60_000, 'air quality alerts', runAirAlertSweep),
    setInterval(() => void runReminderSweep().catch((err) => log('reminder sweep failed', err)), 60_000),
    setInterval(() => void processOutbox().catch((err) => log('outbox failed', err)), 30_000),
    setInterval(() => {
      try {
        purgeExpiredSessions();
      } catch (err) {
        log('session purge failed', err);
      }
    }, 3_600_000),
  ];
  setTimeout(() => void runReminderSweep().catch((err) => log('reminder sweep failed', err)), 5_000);
  return () => timers.forEach(clearInterval);
}
