import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      HIBP_ENABLED: 'false',
      NFZ_API_ENABLED: 'false',
      NLM_API_ENABLED: 'false',
      DEMO_MODE: 'true',
      DATA_DIR: './data/test',
      AUDIT_HMAC_KEY: 'test-audit-key',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      RPM_WEBHOOK_SECRETS: 'vitalera:test-secret',
      CLINIC_TIMEZONE: 'Europe/Warsaw',
    },
  },
});
