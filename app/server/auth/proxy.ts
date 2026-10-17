import type { FastifyRequest } from 'fastify';
import { getDb } from '../db.js';

/**
 * Działanie w imieniu innego profilu (A24.2 — dostęp zastępczy): rodzic, opiekun prawny albo osoba upoważniona
 * wybiera profil w aplikacji, a żądania niosą nagłówek `x-eternal-profile` (albo `?profile=` przy pobieraniu plików).
 * Uprawnienie wynika wyłącznie z aktywnego powiązania w tabeli proxy_link — sam nagłówek niczego nie otwiera.
 *
 * Dozwolone są tylko obszary potrzebne do opieki (dokumenty, wyniki, pomiary, leki, wizyty, wiadomości, dzienniki);
 * ustawienia konta, ankiety, SOS i usunięcie danych zostają przy właścicielu konta.
 */

export type ProxyRelation = 'parent' | 'guardian' | 'caregiver' | 'family';
export type ProxyAccess = 'full' | 'view';

export interface ProxyLinkRow {
  id: string;
  patient_ref: string;
  patient_birth_date: string | null;
  proxy_user_id: string | null;
  relation: ProxyRelation;
  access: ProxyAccess;
  status: 'pending' | 'active' | 'revoked';
  managed: number;
  code_hash: string | null;
  code_expires_at: string | null;
  basis: string | null;
  created_by: string;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface ProxyContext {
  linkId: string;
  relation: ProxyRelation;
  access: ProxyAccess;
  managed: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    proxy?: ProxyContext;
  }
}

/** Pełne lata na dany dzień (data urodzenia RRRR-MM-DD). */
export function ageOn(birthDate: string, now: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const today = now.toISOString().slice(0, 10);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Władza rodzicielska kończy się z pełnoletnością — powiązanie „rodzic” przestaje działać w dniu 18. urodzin. */
export function parentLinkLapsed(row: Pick<ProxyLinkRow, 'relation' | 'patient_birth_date'>, now: Date = new Date()): boolean {
  return row.relation === 'parent' && !!row.patient_birth_date && ageOn(row.patient_birth_date, now) >= 18;
}

export function linkUsable(row: ProxyLinkRow, now: Date = new Date()): boolean {
  if (row.status !== 'active') return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) return false;
  return !parentLinkLapsed(row, now);
}

export function resolveProxy(userId: string, patientRef: string, now: Date = new Date()): ProxyLinkRow | undefined {
  const rows = getDb()
    .prepare("SELECT * FROM proxy_link WHERE proxy_user_id = ? AND patient_ref = ? AND status = 'active' ORDER BY access = 'full' DESC")
    .all(userId, patientRef) as unknown as ProxyLinkRow[];
  return rows.find((r) => linkUsable(r, now));
}

/** Odbiorcy powiadomień profilu bez własnego konta — opiekunowie z aktywnym powiązaniem. */
export function proxyRecipients(patientRef: string, now: Date = new Date()): string[] {
  const rows = getDb().prepare("SELECT * FROM proxy_link WHERE patient_ref = ? AND status = 'active'").all(patientRef) as unknown as ProxyLinkRow[];
  return [...new Set(rows.filter((r) => r.proxy_user_id && linkUsable(r, now)).map((r) => r.proxy_user_id as string))];
}

const PROFILE_ID = /^[A-Za-z0-9\-.]{1,64}$/;

/** Profil wskazany w żądaniu (nagłówek albo parametr `profile` przy GET, np. link do PDF). */
export function requestedProfile(req: FastifyRequest): string | undefined {
  const header = req.headers['x-eternal-profile'];
  let id = typeof header === 'string' ? header.trim() : undefined;
  if (!id && req.method === 'GET') {
    const q = (req.query ?? {}) as Record<string, unknown>;
    if (typeof q.profile === 'string') id = q.profile.trim();
  }
  if (!id) return undefined;
  if (id.startsWith('Patient/')) id = id.slice(8);
  return PROFILE_ID.test(id) ? `Patient/${id}` : undefined;
}

/** Obszary aplikacji dostępne w trybie opiekuna. */
const PROXY_PREFIXES = [
  '/api/me/dashboard',
  '/api/me/profile',
  '/api/me/intake',
  '/api/me/documents',
  '/api/me/timeline',
  '/api/me/records',
  '/api/me/files',
  '/api/me/measurements',
  '/api/me/observations',
  '/api/me/medications',
  '/api/me/med-schedules',
  '/api/me/med-intake',
  '/api/me/emergency',
  '/api/me/emergency-access',
  '/api/me/facts',
  '/api/me/report',
  '/api/me/appointments',
  '/api/me/cards',
  '/api/me/waitlist',
  '/api/me/threads',
  '/api/me/export.csv',
  '/api/me/badges',
  '/api/me/grants',
  '/api/me/access-log',
  '/api/me/consents',
  '/api/me/journal',
  '/api/me/vaccinations',
  '/api/me/family-history',
  '/api/me/calendar',
  '/api/me/rehab',
  '/api/me/goals',
  '/api/me/doctor-report',
  '/api/me/travel-card',
  '/api/me/fhir-bundle',
  '/api/food',
  '/api/me/offline-pack',
  '/api/me/custom-reminders',
  '/api/me/day-plan',
  '/api/me/preventive',
  '/api/me/achievements',
  '/api/me/activity',
];

/** Decyzje osobiste osoby dorosłej (dane profilu, zgody, udostępnienia) zmienia tylko ona — albo opiekun profilu prowadzonego. */
const MANAGED_ONLY_WRITES = ['/api/me/profile', '/api/me/consents', '/api/me/grants'];

const under = (path: string, p: string) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}.`);

/**
 * Czy trasa jest dostępna w trybie opiekuna. Zwraca kod błędu albo undefined.
 * Dostęp „tylko podgląd” (view) pozwala wyłącznie na odczyt.
 */
export function proxyRouteVerdict(
  method: string,
  routeUrl: string,
  link: Pick<ProxyContext, 'access' | 'managed'>,
): 'proxy_not_allowed' | 'proxy_read_only' | undefined {
  const path = routeUrl.split('?')[0];
  if (!PROXY_PREFIXES.some((p) => under(path, p))) return 'proxy_not_allowed';
  const write = !['GET', 'HEAD'].includes(method);
  if (write && link.access === 'view') return 'proxy_read_only';
  if (write && !link.managed && MANAGED_ONLY_WRITES.some((p) => under(path, p))) return 'proxy_not_allowed';
  return undefined;
}
