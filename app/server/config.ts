import path from 'node:path';

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function int(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

const nodeEnv = str('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

export type FhirBackend = 'local' | 'medplum' | 'fhir';

export const config = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  host: str('HOST', '0.0.0.0'),
  port: int('PORT', 3000),
  publicUrl: str('PUBLIC_URL', `http://localhost:${int('PORT', 3000)}`).replace(/\/$/, ''),
  dataDir: path.resolve(str('DATA_DIR', './data')),
  trustProxy: bool('TRUST_PROXY', false),
  /** Pokazuje baner „dane fikcyjne” i pozwala na seed danych demonstracyjnych. */
  demoMode: bool('DEMO_MODE', !isProduction),

  fhir: {
    backend: str('FHIR_BACKEND', 'local') as FhirBackend,
    medplum: {
      baseUrl: str('MEDPLUM_BASE_URL', 'https://api.medplum.com/'),
      clientId: str('MEDPLUM_CLIENT_ID'),
      clientSecret: str('MEDPLUM_CLIENT_SECRET'),
    },
    generic: {
      baseUrl: str('FHIR_BASE_URL'),
      bearerToken: str('FHIR_AUTH_TOKEN'),
      tokenUrl: str('FHIR_TOKEN_URL'),
      clientId: str('FHIR_CLIENT_ID'),
      clientSecret: str('FHIR_CLIENT_SECRET'),
    },
  },

  security: {
    /** Klucz HMAC łańcucha dziennika zdarzeń. W produkcji podaj z menedżera sekretów. */
    auditHmacKey: str('AUDIT_HMAC_KEY'),
    patientIdleMinutes: int('PATIENT_IDLE_MINUTES', 30),
    staffIdleMinutes: int('STAFF_IDLE_MINUTES', 15),
    sessionAbsoluteHours: int('SESSION_ABSOLUTE_HOURS', 12),
    maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
    lockoutMinutes: int('LOCKOUT_MINUTES', 15),
    minPasswordLength: int('MIN_PASSWORD_LENGTH', 10),
    requireEmailVerification: bool('REQUIRE_EMAIL_VERIFICATION', isProduction),
    /** Adres zgłoszeń bezpieczeństwa (security.txt, zgłoszenia podatności A18.9, incydenty bezpieczeństwa). */
    contact: str('SECURITY_CONTACT'),
    /** Najwięcej jednocześnie zalogowanych urządzeń na konto pacjenta (F1.13). */
    maxDevices: int('MAX_DEVICES', 5),
  },

  /** Aplikacja mobilna (A18.7): najniższa obsługiwana wersja i adresy sklepów; starsze wersje widzą ekran aktualizacji. */
  mobile: {
    minVersion: str('MOBILE_MIN_VERSION', '1.0.0'),
    latestVersion: str('MOBILE_LATEST_VERSION', '1.0.0'),
    iosStoreUrl: str('MOBILE_IOS_STORE_URL'),
    androidStoreUrl: str('MOBILE_ANDROID_STORE_URL'),
  },

  clinic: {
    cancelMinHours: int('CANCEL_MIN_HOURS', 12),
    reminderOffsetsHours: str('REMINDER_OFFSETS_HOURS', '24,2')
      .split(',')
      .map((s) => Number.parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
    timezone: str('CLINIC_TIMEZONE', 'Europe/Warsaw'),
  },

  mail: {
    smtpUrl: str('SMTP_URL'),
    from: str('MAIL_FROM', 'Eternal <no-reply@localhost>'),
  },

  sms: {
    provider: str('SMS_PROVIDER') as '' | 'smsapi' | 'webhook',
    smsapiToken: str('SMSAPI_TOKEN'),
    sender: str('SMS_SENDER', 'Eternal'),
    webhookUrl: str('SMS_WEBHOOK_URL'),
  },

  push: {
    vapidPublicKey: str('VAPID_PUBLIC_KEY'),
    vapidPrivateKey: str('VAPID_PRIVATE_KEY'),
    subject: str('VAPID_SUBJECT', 'mailto:admin@localhost'),
  },

  jitsi: {
    domain: str('JITSI_DOMAIN', 'meet.jit.si'),
    appId: str('JITSI_APP_ID'),
    appSecret: str('JITSI_APP_SECRET'),
  },

  withings: {
    clientId: str('WITHINGS_CLIENT_ID'),
    clientSecret: str('WITHINGS_CLIENT_SECRET'),
  },

  icd11: {
    clientId: str('ICD11_CLIENT_ID'),
    clientSecret: str('ICD11_CLIENT_SECRET'),
    release: str('ICD11_RELEASE', '2025-01'),
  },

  /** Sekrety webhooków platform RPM, format: "vitalera:sekret,inna:sekret2". */
  rpmWebhookSecrets: Object.fromEntries(
    str('RPM_WEBHOOK_SECRETS')
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf(':');
        return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
      })
      .filter(([k, v]) => k && v),
  ) as Record<string, string>,

  publicApis: {
    nfz: bool('NFZ_API_ENABLED', true),
    nlm: bool('NLM_API_ENABLED', true),
    hibp: bool('HIBP_ENABLED', true),
    timeoutMs: int('PUBLIC_API_TIMEOUT_MS', 8000),
  },

  /**
   * Brama modeli językowych (moduł R5). Dostawca podstawowy: Claude przez Amazon Bedrock w regionie UE
   * (decyzja z pliku 12.8, A7 poz. 8) albo bezpośrednio API Anthropic; zapas: Mistral (UE).
   * „demo” — deterministyczne reguły bez modelu (tylko DEMO_MODE), „none” — funkcje AI wyłączone.
   */
  ai: {
    provider: str('AI_PROVIDER', bool('DEMO_MODE', !isProduction) ? 'demo' : 'none') as 'bedrock' | 'anthropic' | 'demo' | 'none',
    awsRegion: str('AWS_REGION', 'eu-central-1'),
    modelNote: str('AI_MODEL_NOTE', str('AI_PROVIDER') === 'bedrock' ? 'anthropic.claude-sonnet-5-5' : 'claude-sonnet-5-5'),
    modelFast: str('AI_MODEL_FAST', str('AI_PROVIDER') === 'bedrock' ? 'anthropic.claude-haiku-5-5' : 'claude-haiku-5-5'),
    /** Ponowienie odmowy modelu na innym modelu (SDK, middleware po stronie klienta). */
    refusalFallback: bool('AI_REFUSAL_FALLBACK', true),
    fallbackModelNote: str('AI_FALLBACK_MODEL_NOTE', str('AI_PROVIDER') === 'bedrock' ? 'anthropic.claude-sonnet-5' : 'claude-sonnet-5'),
    fallbackModelFast: str('AI_FALLBACK_MODEL_FAST', str('AI_PROVIDER') === 'bedrock' ? 'anthropic.claude-sonnet-5-5' : 'claude-sonnet-5-5'),
    /** Drugi dostawca (UE) przy błędzie dostawcy podstawowego. */
    secondary: str('AI_SECONDARY_PROVIDER') as '' | 'mistral',
    mistralApiKey: str('MISTRAL_API_KEY'),
    mistralModel: str('MISTRAL_MODEL', 'mistral-medium-latest'),
    dailyCallLimitPerOrg: int('AI_DAILY_CALL_LIMIT_PER_ORG', 3000),
    timeoutMs: int('AI_TIMEOUT_MS', 120_000),
  },

  /** Odczyt dokumentów (decyzja D51: Mistral OCR 4 albo Google Document AI — wybór testem). */
  ocr: {
    provider: str('OCR_PROVIDER') as '' | 'mistral' | 'google',
    mistralModel: str('MISTRAL_OCR_MODEL', 'mistral-ocr-latest'),
    google: {
      credentialsFile: str('GOOGLE_APPLICATION_CREDENTIALS'),
      projectId: str('GOOGLE_DOCAI_PROJECT'),
      location: str('GOOGLE_DOCAI_LOCATION', 'eu'),
      processorId: str('GOOGLE_DOCAI_PROCESSOR'),
    },
  },

  /** Mowa na tekst dla Scribe (decyzja D48 — wybór testem 20 nagrań; warunek: przetwarzanie w UE). */
  stt: {
    provider: str('STT_PROVIDER') as '' | 'elevenlabs' | 'azure' | 'openai',
    elevenlabs: {
      apiKey: str('ELEVENLABS_API_KEY'),
      baseUrl: str('ELEVENLABS_BASE_URL', 'https://api.eu.residency.elevenlabs.io'),
      model: str('ELEVENLABS_STT_MODEL', 'scribe_v2'),
    },
    azure: { key: str('AZURE_SPEECH_KEY'), region: str('AZURE_SPEECH_REGION', 'westeurope') },
    openai: {
      apiKey: str('OPENAI_API_KEY'),
      baseUrl: str('OPENAI_BASE_URL', 'https://eu.api.openai.com/v1'),
      model: str('OPENAI_STT_MODEL', 'gpt-4o-transcribe'),
    },
  },

  /** Raporty PDF: Chromium (Playwright) — HTML → PDF. */
  pdf: {
    chromiumPath: str('CHROMIUM_PATH'),
  },

  /** Wideo w MVP-1 (decyzja D52): Whereby Embedded albo Jitsi u nas. */
  video: {
    provider: str('VIDEO_PROVIDER', 'jitsi') as 'jitsi' | 'whereby',
    wherebyApiKey: str('WHEREBY_API_KEY'),
    wherebyRegion: str('WHEREBY_REGION', 'eu-central-1'),
  },

  /** Logowanie zewnętrzną usługą tożsamości (decyzja D50: Cognito Essentials albo Keycloak) — OIDC. */
  oidc: {
    issuer: str('OIDC_ISSUER'),
    clientId: str('OIDC_CLIENT_ID'),
    clientSecret: str('OIDC_CLIENT_SECRET'),
    label: str('OIDC_LABEL', 'Logowanie firmowe'),
  },

  /** Klucze dostępu (WebAuthn/FIDO2). */
  webauthn: {
    rpName: str('WEBAUTHN_RP_NAME', 'Eternal'),
  },
};

export type AppConfig = typeof config;
