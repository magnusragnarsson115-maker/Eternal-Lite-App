import { listUsers } from '../auth/users.js';
import { sendEmail, emailConfigured } from '../integrations/channels.js';
import { moduleEnabled } from '../modules.js';
import { getClinicSettings } from './directory.js';
import { markMonthlyReportSent, monthlyReportSent } from './metrics.js';
import { notifyUser } from './notifications.js';
import { listOrganizations } from './orgs.js';

/**
 * Raport miesięczny pilotażu wysyłany automatycznie (D12, MVP-1): pierwszego dnia miesiąca administrator
 * i lekarze kliniki dostają powiadomienie (i e-mail, jeśli skonfigurowany) z odnośnikiem do raportu PDF w panelu.
 * Treść wiadomości nie zawiera danych pacjentów.
 */
export async function runMonthlyReports(now = new Date()): Promise<number> {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = prev.toISOString().slice(0, 7);
  let sent = 0;
  for (const org of await listOrganizations()) {
    if (!moduleEnabled('metrics', { orgId: org.id })) continue;
    if (monthlyReportSent(org.id, month)) continue;
    const recipients = listUsers({ orgId: org.id, staffOnly: true }).filter((u) => u.status === 'active' && (u.roles.includes('admin') || u.roles.includes('practitioner')));
    for (const u of recipients) {
      await notifyUser(u.id, { kind: 'pilot-report', title: `Raport pilotażu za ${month}`, body: 'Raport miesięczny jest gotowy w panelu (Mierniki).', link: `/panel/mierniki?miesiac=${month}`, push: false });
      if (emailConfigured()) {
        await sendEmail(u.email, `Eternal — raport pilotażu za ${month}`, `Raport miesięczny pilotażu dla ${getClinicSettings(org.id).name} jest gotowy w panelu: Mierniki → ${month}.`).catch(() => undefined);
      }
    }
    markMonthlyReportSent(org.id, month);
    sent++;
  }
  return sent;
}
