import { defineConfig } from '@playwright/test';

const PORT = 3210;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `rm -rf data/e2e && DATA_DIR=data/e2e npx tsx server/cli.ts seed-demo && DATA_DIR=data/e2e PORT=${PORT} HIBP_ENABLED=false npx tsx server/index.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NODE_OPTIONS: '--disable-warning=ExperimentalWarning' },
  },
});
