import { aiMode } from '../ai/gateway.js';
import { callClaude } from '../ai/anthropic.js';
import { ocrConfigured } from '../ai/ocr.js';
import { sttMode } from '../ai/stt.js';
import { oidcEnabled } from '../auth/oidc.js';
import { config } from '../config.js';
import { currentApproval, EXPLANATIONS_VERSION } from '../labs/explanations.js';
import { fhirSystem } from '../fhir/index.js';
import { emailConfigured, smsConfigured, verifyEmailTransport } from '../integrations/channels.js';
import { monitoringEnabled } from '../lib/monitoring.js';
import { sbomFile, sbomSummary } from '../lib/sbom.js';
import { pdfAvailable, renderPdf } from '../pdf/render.js';
import { z } from 'zod';

/**
 * Gotowość do pracy: dla każdego składnika — czy działa naprawdę, czy w trybie demonstracyjnym, czy jest wyłączony,
 * i co ustawić, żeby działał produkcyjnie. Bez sekretów w odpowiedzi (tylko „ustawione / brak”).
 * Używane przez `npm run cli -- check [--live]` i panel „Organizacja kliniki → Gotowość”.
 */

export type ReadinessState = 'ok' | 'demo' | 'missing' | 'warn';

export interface ReadinessItem {
  id: string;
  group: string;
  name: string;
  state: ReadinessState;
  /** Co jest teraz ustawione (bez wartości sekretów). */
  detail: string;
  /** Co zrobić, żeby działało produkcyjnie (puste, gdy gotowe). */
  howTo?: string;
  /** Wynik testu połączenia (tylko z --live / ?live=1). */
  live?: { ok: boolean; detail: string; ms: number };
}

const yes = (v: unknown) => (v ? 'ustawione' : 'brak');

function items(): ReadinessItem[] {
  const out: ReadinessItem[] = [];
  const add = (i: ReadinessItem) => out.push(i);

  // --- tryb pracy i bezpieczeństwo ---
  add({
    id: 'mode',
    group: 'Tryb pracy',
    name: 'Tryb demonstracyjny',
    state: config.demoMode ? 'demo' : 'ok',
    detail: config.demoMode ? 'DEMO_MODE=true — baner „dane fikcyjne”, dane przykładowe, logowanie jednym kliknięciem' : 'DEMO_MODE=false',
    howTo: config.demoMode ? 'Produkcja: DEMO_MODE=false, NODE_ENV=production, nowa baza (bez danych demo), `npm run cli -- create-org` i `create-admin`.' : undefined,
  });
  const https = config.publicUrl.startsWith('https://');
  add({
    id: 'public-url',
    group: 'Tryb pracy',
    name: 'Adres publiczny (HTTPS)',
    state: https ? 'ok' : 'missing',
    detail: config.publicUrl,
    howTo: https ? undefined : 'PUBLIC_URL=https://twoja-domena — linki w SMS, kody QR, klucze dostępu i ciasteczka Secure wymagają HTTPS (Caddy w docker-compose robi certyfikat).',
  });
  add({
    id: 'audit-key',
    group: 'Bezpieczeństwo',
    name: 'Klucz dziennika zdarzeń',
    state: config.security.auditHmacKey ? 'ok' : config.demoMode ? 'demo' : 'warn',
    detail: config.security.auditHmacKey ? 'AUDIT_HMAC_KEY z konfiguracji' : 'klucz wygenerowany w katalogu danych (audit.key)',
    howTo: config.security.auditHmacKey ? undefined : 'AUDIT_HMAC_KEY (min. 32 losowe znaki) z menedżera sekretów — klucz nie może leżeć obok bazy.',
  });
  const expl = currentApproval();
  add({
    id: 'explanations',
    group: 'Treści',
    name: 'Objaśnienia badań dla pacjentów (A2.4)',
    state: expl ? 'ok' : 'warn',
    detail: expl ? `wersja ${EXPLANATIONS_VERSION}, zatwierdził(a): ${expl.approvedBy}, ${expl.approvedAt.slice(0, 10)}` : `wersja ${EXPLANATIONS_VERSION} czeka na zatwierdzenie przez lekarza — pacjenci jej nie widzą${config.demoMode ? ' (w trybie demo widoczna jako projekt)' : ''}`,
    howTo: expl ? undefined : 'Lekarz przegląda opisy (npm run cli -- explanations-review > objasnienia.md) i zatwierdza: npm run cli -- approve-explanations "lek. Imię Nazwisko, PWZ 0000000"',
  });
  add({
    id: 'security-contact',
    group: 'Bezpieczeństwo',
    name: 'Kontakt bezpieczeństwa (security.txt)',
    state: config.security.contact ? 'ok' : 'missing',
    detail: config.security.contact || 'brak — /.well-known/security.txt zwraca 404',
    howTo: config.security.contact ? undefined : 'SECURITY_CONTACT=security@twoja-domena',
  });
  const sbom = sbomSummary();
  add({
    id: 'sbom',
    group: 'Bezpieczeństwo',
    name: 'Wykaz składników oprogramowania (SBOM, A18.9)',
    state: sbom.present ? 'ok' : 'warn',
    detail: sbom.present ? `${sbom.format}, ${sbom.components} składników${sbom.generatedAt ? `, ${sbom.generatedAt.slice(0, 10)}` : ''} — pobranie: panel administratora` : 'brak pliku sbom.cdx.json w tej instalacji',
    howTo: sbom.present ? undefined : 'Obraz Docker generuje go przy budowaniu; lokalnie: npm run sbom. Skan podatności: .github/workflows/security.yml (co tydzień).',
  });
  add({
    id: 'monitoring',
    group: 'Bezpieczeństwo',
    name: 'Zgłaszanie błędów (Sentry UE)',
    state: monitoringEnabled() ? 'ok' : 'warn',
    detail: monitoringEnabled() ? 'SENTRY_DSN w regionie UE' : 'wyłączone — błędy tylko w logach serwera',
    howTo: monitoringEnabled() ? undefined : 'SENTRY_DSN (projekt w regionie UE, *.de.sentry.io) — opcjonalnie.',
  });

  // --- dane ---
  const fhirBackend = config.fhir.backend;
  add({
    id: 'fhir',
    group: 'Dane',
    name: 'Repozytorium FHIR',
    state: 'ok',
    detail: fhirBackend === 'local' ? 'lokalne (SQLite w DATA_DIR, z wersjami)' : fhirBackend === 'medplum' ? `Medplum (${config.fhir.medplum.baseUrl})` : `serwer FHIR R4 (${config.fhir.generic.baseUrl})`,
    howTo: fhirBackend === 'local' ? 'Działa produkcyjnie dla jednej instancji; wybór z A7 (Medplum u nas w AWS Frankfurt): FHIR_BACKEND=medplum + MEDPLUM_*.' : undefined,
  });
  add({
    id: 'backups',
    group: 'Dane',
    name: 'Kopie zapasowe',
    state: 'warn',
    detail: `katalog danych: ${config.dataDir}; rotacja podawana pacjentom: ${process.env.BACKUP_RETENTION_DAYS ?? 35} dni`,
    howTo: 'Codziennie `npm run cli -- backup <katalog>` (cron) + szyfrowanie + kopia poza serwerem; raz w kwartale test odtworzenia.',
  });

  // --- AI, mowa, odczyt dokumentów ---
  const ai = aiMode();
  add({
    id: 'ai',
    group: 'AI i odczyt',
    name: 'Model językowy (szkic notatki, karta, odczyt)',
    state: ai === 'model' ? 'ok' : ai === 'demo' ? 'demo' : 'missing',
    detail:
      ai === 'model'
        ? `${config.ai.provider} (${config.ai.provider === 'bedrock' ? `region ${config.ai.awsRegion}` : 'API Anthropic'}), modele: ${config.ai.modelNote} / ${config.ai.modelFast}${config.ai.secondary ? `, zapas: ${config.ai.secondary}` : ''}`
        : ai === 'demo'
          ? 'tryb demo: szkic notatki z reguł (słowa kluczowe), karta z notatki, odczyt bez modelu'
          : 'wyłączony — odczyt tylko regułami, Scribe bez szkicu (tryb ograniczony)',
    howTo:
      ai === 'model'
        ? undefined
        : 'AI_PROVIDER=bedrock + dostęp IAM do Bedrock w eu-central-1 (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY albo rola) z włączonymi modelami Claude; albo AI_PROVIDER=anthropic + ANTHROPIC_API_KEY. Zapas: AI_SECONDARY_PROVIDER=mistral + MISTRAL_API_KEY.',
  });
  const stt = sttMode();
  add({
    id: 'stt',
    group: 'AI i odczyt',
    name: 'Mowa na tekst (Scribe)',
    state: stt === 'service' ? 'ok' : stt === 'demo' ? 'demo' : 'missing',
    detail: stt === 'service' ? `${config.stt.provider}` : stt === 'demo' ? 'tryb demo: zamiast nagrania używana jest przykładowa rozmowa' : 'wyłączona — Scribe tylko w trybie „notatka bez nagrania”',
    howTo: stt === 'service' ? undefined : 'Decyzja D48 (test 20 nagrań): STT_PROVIDER=elevenlabs + ELEVENLABS_API_KEY (rezydencja UE) albo azure + AZURE_SPEECH_KEY albo openai + OPENAI_API_KEY (projekt z rezydencją UE).',
  });
  const ocr = ocrConfigured();
  add({
    id: 'ocr',
    group: 'AI i odczyt',
    name: 'Odczyt zdjęć i skanów (OCR)',
    state: ocr ? 'ok' : 'warn',
    detail: ocr ? `${config.ocr.provider}` : 'PDF z warstwą tekstu (portale laboratoriów) działa bez dostawcy; zdjęcia i skany — nieodczytane (lekarz zobaczy oryginał)',
    howTo: ocr ? undefined : 'Decyzja D51 (test 100 wyników): OCR_PROVIDER=mistral + MISTRAL_API_KEY albo OCR_PROVIDER=google + GOOGLE_DOCAI_* (region eu).',
  });
  add({
    id: 'pdf',
    group: 'AI i odczyt',
    name: 'Raporty PDF (Chromium)',
    state: pdfAvailable() ? 'ok' : 'missing',
    detail: pdfAvailable() ? 'Chromium dostępny' : 'brak Chromium — PDF raportu, notatki i potwierdzeń zwraca błąd pdf_unavailable',
    howTo: pdfAvailable() ? undefined : 'Obraz Docker z pakietem chromium (Dockerfile) albo CHROMIUM_PATH=/ścieżka/do/chromium.',
  });

  // --- komunikacja ---
  add({
    id: 'sms',
    group: 'Komunikacja',
    name: 'SMS (zaproszenia, przypomnienia, SOS)',
    state: smsConfigured() ? 'ok' : config.demoMode ? 'demo' : 'missing',
    detail: smsConfigured() ? `${config.sms.provider}` : 'brak — SMS trafiają tylko do kolejki wysyłek (panel „Wysyłka powiadomień”), nikt ich nie dostaje',
    howTo: smsConfigured() ? undefined : 'SMS_PROVIDER=smsapi + SMSAPI_TOKEN + SMS_SENDER (nazwa nadawcy zarejestrowana w SMSAPI).',
  });
  add({
    id: 'email',
    group: 'Komunikacja',
    name: 'E-mail',
    state: emailConfigured() ? 'ok' : config.demoMode ? 'demo' : 'missing',
    detail: emailConfigured() ? 'SMTP ustawiony' : 'brak — e-maile tylko w kolejce wysyłek',
    howTo: emailConfigured() ? undefined : 'SMTP_URL (np. Amazon SES we Frankfurcie: smtps://UŻYTKOWNIK:HASŁO@email-smtp.eu-central-1.amazonaws.com:465) + MAIL_FROM.',
  });
  add({
    id: 'web-push',
    group: 'Komunikacja',
    name: 'Push w przeglądarce (VAPID)',
    state: 'ok',
    detail: config.push.vapidPublicKey ? 'klucze z konfiguracji' : 'klucze wygenerowane automatycznie i zapisane w bazie',
  });

  // --- wideo, tożsamość, aplikacja mobilna ---
  const whereby = config.video.provider === 'whereby' && !!config.video.wherebyApiKey;
  const ownJitsi = config.jitsi.domain !== 'meet.jit.si';
  add({
    id: 'video',
    group: 'Wideo i tożsamość',
    name: 'Wizyty wideo',
    state: whereby || ownJitsi ? 'ok' : config.demoMode ? 'demo' : 'warn',
    detail: whereby ? `Whereby Embedded (${config.video.wherebyRegion})` : ownJitsi ? `Jitsi: ${config.jitsi.domain}${config.jitsi.appSecret ? ' (JWT)' : ''}` : 'publiczny meet.jit.si — tylko do testów, nie dla danych pacjentów',
    howTo: whereby || ownJitsi ? undefined : 'Decyzja D52: VIDEO_PROVIDER=whereby + WHEREBY_API_KEY (umowa powierzenia, region UE) albo własny Jitsi: JITSI_DOMAIN + JITSI_APP_ID/SECRET.',
  });
  add({
    id: 'oidc',
    group: 'Wideo i tożsamość',
    name: 'Zewnętrzna usługa tożsamości (OIDC)',
    state: oidcEnabled() ? 'ok' : 'warn',
    detail: oidcEnabled() ? `${config.oidc.issuer}` : 'logowanie wbudowane (hasło, TOTP, klucze dostępu, link z e-maila) — działa produkcyjnie',
    howTo: oidcEnabled() ? undefined : 'Opcjonalnie wg D50: OIDC_ISSUER + OIDC_CLIENT_ID/SECRET (Cognito, Keycloak, Entra).',
  });
  add({
    id: 'mobile',
    group: 'Wideo i tożsamość',
    name: 'Aplikacja mobilna (wersje)',
    state: config.mobile.iosStoreUrl || config.mobile.androidStoreUrl ? 'ok' : 'warn',
    detail: `najniższa obsługiwana ${config.mobile.minVersion}, najnowsza ${config.mobile.latestVersion}; sklepy: ${yes(config.mobile.iosStoreUrl)} (iOS), ${yes(config.mobile.androidStoreUrl)} (Android)`,
    howTo: config.mobile.iosStoreUrl || config.mobile.androidStoreUrl ? undefined : 'Po publikacji w sklepach: MOBILE_IOS_STORE_URL, MOBILE_ANDROID_STORE_URL; w mobile/app.json — extra.eas.projectId (push).',
  });
  return out;
}

async function timed(fn: () => Promise<{ ok: boolean; detail: string }>): Promise<{ ok: boolean; detail: string; ms: number }> {
  const t = Date.now();
  try {
    return { ...(await fn()), ms: Date.now() - t };
  } catch (err) {
    return { ok: false, detail: (err as Error).message.slice(0, 200), ms: Date.now() - t };
  }
}

/** Testy połączeń na żywo — bez danych pacjentów (zapytanie testowe, pusta strona PDF, odczyt metadanych). */
const LIVE: Record<string, () => Promise<{ ok: boolean; detail: string }>> = {
  fhir: async () => {
    await fhirSystem().search('Organization', { _count: '1' });
    return { ok: true, detail: 'odczyt działa' };
  },
  ai: async () => {
    if (aiMode() !== 'model') return { ok: false, detail: 'brak dostawcy modelu' };
    const r = await callClaude({ tier: 'fast', system: 'Odpowiadasz wyłącznie w formacie JSON.', user: 'Zwróć {"ok": true}.', schema: z.object({ ok: z.boolean() }), maxTokens: 64, effort: 'low' });
    return { ok: r.data.ok === true, detail: `odpowiedź modelu ${r.model}` };
  },
  pdf: async () => {
    const pdf = await renderPdf('<html><body><p>test</p></body></html>', { footerLeft: 'test' });
    return { ok: pdf.length > 500, detail: `PDF ${pdf.length} B` };
  },
  email: async () => verifyEmailTransport(),
};

export async function readiness(opts: { live?: boolean } = {}): Promise<{ items: ReadinessItem[]; summary: Record<ReadinessState, number> }> {
  const list = items();
  if (opts.live) {
    await Promise.all(
      list.map(async (i) => {
        const fn = LIVE[i.id];
        if (fn && (i.state === 'ok' || i.id === 'fhir' || i.id === 'pdf')) i.live = await timed(fn);
      }),
    );
  }
  const summary = { ok: 0, demo: 0, missing: 0, warn: 0 } as Record<ReadinessState, number>;
  for (const i of list) summary[i.state] += 1;
  return { items: list, summary };
}
