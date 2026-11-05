import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Zgłaszanie błędów serwera (R8, A3: Sentry w regionie UE) — bez danych medycznych i osobowych.
 *
 * Wysyłamy wyłącznie: typ błędu, kod, wzorzec trasy (np. /api/staff/intake/:id — bez identyfikatorów),
 * metodę HTTP, wersję i środowisko. Nie wysyłamy: treści błędu (może zawierać dane), ciała żądania,
 * parametrów, nagłówków, adresu IP, identyfikatora użytkownika ani śladu stosu z wartościami zmiennych.
 * Wyłączone, gdy SENTRY_DSN nie jest ustawione. DSN musi wskazywać region UE (np. *.de.sentry.io) — inaczej odmawiamy.
 */

interface Dsn {
  host: string;
  projectId: string;
  publicKey: string;
  protocol: string;
}

function parseDsn(raw: string | undefined): Dsn | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const projectId = u.pathname.replace(/^\//, '');
    if (!u.username || !projectId) return undefined;
    return { host: u.host, projectId, publicKey: u.username, protocol: u.protocol };
  } catch {
    return undefined;
  }
}

const dsn = parseDsn(process.env.SENTRY_DSN);
const allowNonEu = process.env.SENTRY_ALLOW_NON_EU === 'true';

export function monitoringEnabled(): boolean {
  return !!dsn && (allowNonEu || /(^|\.)de\.sentry\.io$/.test(dsn.host) || !dsn.host.endsWith('sentry.io'));
}

/** Ślad stosu bez wartości: tylko nazwy plików i numery linii z kodu aplikacji. */
function frames(err: Error): { filename: string; lineno?: number; function?: string }[] {
  return (err.stack ?? '')
    .split('\n')
    .slice(1, 15)
    .map((l) => l.match(/at (?:(\S+) )?\(?(.*?):(\d+):\d+\)?$/))
    .filter((m): m is RegExpMatchArray => !!m && !m[2].includes('node_modules') && !m[2].startsWith('node:'))
    .map((m) => ({ function: m[1], filename: m[2].replace(/^.*?\/(server|dist)\//, '$1/'), lineno: Number(m[3]) }))
    .reverse();
}

export function reportError(err: Error & { code?: string }, ctx: { route?: string; method?: string }): void {
  if (!monitoringEnabled() || !dsn) return;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: config.isProduction ? 'production' : 'development',
    release: process.env.APP_VERSION ?? 'eternal@1.0.0',
    tags: { route: ctx.route ?? 'unknown', method: ctx.method ?? '' },
    exception: { values: [{ type: err.name || 'Error', value: err.code ?? '(treść pominięta — może zawierać dane)', stacktrace: { frames: frames(err) } }] },
  };
  const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() });
  const body = `${header}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  void fetch(`${dsn.protocol}//${dsn.host}/api/${dsn.projectId}/envelope/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=eternal/1.0` },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}

/** security.txt (RFC 9116) — kontakt w sprawie podatności (A18.9). */
export function securityTxt(): string | undefined {
  const contact = config.security.contact;
  if (!contact) return undefined;
  const expires = new Date(Date.now() + 180 * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);
  return [
    `Contact: ${contact.includes(':') ? contact : `mailto:${contact}`}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: pl, en',
    `Canonical: ${config.publicUrl}/.well-known/security.txt`,
    `Policy: ${config.publicUrl}/security-policy.txt`,
    '',
  ].join('\n');
}

export const SECURITY_POLICY = `Zgłaszanie podatności — Eternal

Prosimy o zgłoszenia na adres z pliku /.well-known/security.txt.
Potwierdzamy otrzymanie w ciągu 3 dni roboczych; ocenę i plan naprawy przekazujemy w ciągu 10 dni roboczych.
Prosimy nie testować na danych prawdziwych pacjentów i nie pobierać danych innych osób — użyj trybu demonstracyjnego
(DEMO_MODE=true, dane fikcyjne). Nie podejmujemy kroków prawnych wobec osób działających w dobrej wierze w tych granicach.
Wykaz składników oprogramowania (SBOM, CycloneDX) jest dostępny na żądanie dla klientów i audytorów.

Vulnerability reporting — Eternal

Please report to the address in /.well-known/security.txt. We acknowledge within 3 business days and share an
assessment and fix plan within 10 business days. Do not test on real patient data; use demo mode (fictional data).
`;
