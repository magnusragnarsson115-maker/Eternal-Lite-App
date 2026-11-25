import { defineConfig } from '@playwright/test';

const PORT = 3210;
// E2E_BASE_URL=https://demo.twoja-domena.pl — testy na wdrożonej instancji pokazowej (bez lokalnego serwera; dane testów zostają, potem reset-demo)
const deployed = process.env.E2E_BASE_URL?.replace(/\/$/, '');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: deployed ?? `http://localhost:${PORT}`,
    ignoreHTTPSErrors: !!deployed && process.env.E2E_IGNORE_HTTPS_ERRORS === 'true',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: deployed
    ? undefined
    : {
        command: `rm -rf data/e2e && DATA_DIR=data/e2e npx tsx server/cli.ts seed-demo && DATA_DIR=data/e2e PORT=${PORT} HIBP_ENABLED=false npx tsx server/index.ts`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { NODE_OPTIONS: '--disable-warning=ExperimentalWarning' },
      },
});
