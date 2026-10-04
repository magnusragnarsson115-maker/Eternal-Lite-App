/**
 * Zrzuty ekranu kluczowych widoków (dane demonstracyjne). Użycie:
 *   npm run seed:demo && npm start   (w drugim terminalu)
 *   npx tsx scripts/screenshots.ts [http://localhost:3000]
 */
import { chromium, type Page } from '@playwright/test';
import { totpCode } from '../server/auth/totp.ts';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
const PASSWORD = 'Eternal-Demo-2026';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log('✓', name);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  // --- pacjent (telefon) ---
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const p = await pctx.newPage();
  await p.goto(`${BASE}/logowanie`);
  await shot(p, 'p01-logowanie');
  await p.getByLabel('E-mail').fill('pacjent@eternal.local');
  await p.getByLabel('Hasło').fill(PASSWORD);
  await p.getByRole('button', { name: 'Zaloguj się' }).click();
  await p.waitForURL(`${BASE}/`);
  await shot(p, 'p02-start', true);
  await p.goto(`${BASE}/rezerwacja`);
  await p.getByRole('button', { name: /Konsultacja kardiologiczna/ }).click();
  await p.locator('.time-btn').first().waitFor();
  await p.locator('.time-btn').nth(2).click();
  await shot(p, 'p03-rezerwacja', true);
  await p.goto(`${BASE}/wizyty`);
  await shot(p, 'p04-wizyty');
  await p.locator('.list-item').first().click();
  await shot(p, 'p05-wizyta', true);
  await p.goto(`${BASE}/wyniki`);
  await shot(p, 'p06-wyniki');
  await p.getByText('Morfologia krwi').click();
  await shot(p, 'p07-wynik', true);
  await p.goto(`${BASE}/wiadomosci`);
  await p.locator('.list-item').first().click();
  await shot(p, 'p08-wiadomosc');
  await p.goto(`${BASE}/pomiary`);
  await shot(p, 'p09-pomiary', true);
  await p.goto(`${BASE}/prywatnosc`);
  await shot(p, 'p10-prywatnosc', true);

  // --- personel (komputer) ---
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const s = await sctx.newPage();
  await s.goto(`${BASE}/panel/logowanie`);
  await shot(s, 's01-logowanie');
  await s.getByLabel('E-mail').fill('anna.nowicka@eternal.local');
  await s.getByLabel('Hasło').fill(PASSWORD);
  await s.getByRole('button', { name: 'Zaloguj się' }).click();
  await s.waitForURL(/\/panel\/mfa/);
  await s.getByLabel('Kod z aplikacji').fill(totpCode(TOTP));
  await s.getByRole('button', { name: 'Potwierdź' }).click();
  await s.waitForURL(`${BASE}/panel`);
  await shot(s, 's02-pulpit');
  const d = new Date(Date.now() + 86_400_000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const day = d.toISOString().slice(0, 10);
  await s.goto(`${BASE}/panel/kalendarz?date=${day}`);
  await shot(s, 's03-kalendarz');
  await s.locator('.cal-appt').first().click();
  await shot(s, 's04-wizyta');
  await s.keyboard.press('Escape');
  await s.goto(`${BASE}/panel/pacjenci`);
  await s.getByLabel('Szukaj pacjenta').fill('Kowalska');
  await s.getByRole('button', { name: 'Szukaj' }).click();
  await s.getByRole('link', { name: 'Anna Kowalska' }).click();
  await s.getByRole('tab', { name: 'Wyniki i dokumenty' }).click();
  await shot(s, 's05-pacjent-wyniki');
  await s.getByRole('tab', { name: 'Pomiary' }).click();
  await shot(s, 's06-pacjent-pomiary');
  await s.goto(`${BASE}/panel/grafik`);
  await shot(s, 's07-grafik');
  await s.goto(`${BASE}/panel/wiadomosci`);
  await s.locator('.list-item').first().click();
  await shot(s, 's08-wiadomosci');

  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const a = await actx.newPage();
  await a.goto(`${BASE}/panel/logowanie`);
  await a.getByLabel('E-mail').fill('admin@eternal.local');
  await a.getByLabel('Hasło').fill(PASSWORD);
  await a.getByRole('button', { name: 'Zaloguj się' }).click();
  await a.waitForURL(/\/panel\/mfa/);
  await a.waitForTimeout(1000);
  await a.getByLabel('Kod z aplikacji').fill(totpCode(TOTP, Date.now() + 30_000));
  await a.getByRole('button', { name: 'Potwierdź' }).click();
  await a.waitForURL(`${BASE}/panel`);
  await a.goto(`${BASE}/panel/admin`);
  await a.getByRole('tab', { name: 'Integracje' }).click();
  await shot(a, 's09-integracje', true);
  await a.getByRole('tab', { name: 'Dziennik zdarzeń' }).click();
  await a.getByRole('button', { name: 'Zweryfikuj integralność dziennika' }).click();
  await shot(a, 's10-dziennik');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
