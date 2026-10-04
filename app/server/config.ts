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
};

export type AppConfig = typeof config;
