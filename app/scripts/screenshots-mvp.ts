/**
 * Zrzuty ekranu modułów pilotażu i MVP (dane demonstracyjne). Użycie:
 *   npm run seed:demo && npm start   (w drugim terminalu)
 *   npx tsx scripts/screenshots-mvp.ts [http://localhost:3000]
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { totpCode } from '../server/auth/totp.ts';
import { simplePdf } from '../server/seed/pdf.ts';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
const PASSWORD = 'Eternal-Demo-2026';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';


async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log('✓', name);
}

async function staff(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/panel/logowanie`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.waitForURL(/\/panel\/mfa/);
  await page.getByLabel('Kod z aplikacji').fill(totpCode(TOTP, Date.now()));
  await page.getByRole('button', { name: 'Potwierdź' }).click();
  await page.waitForURL(`${BASE}/panel`);
  return page;
}

/** Wizyta pacjenta z najbliższych dni (API skrzynki). */
async function visit(page: Page, name: string) {
  return page.evaluate(async (n) => {
    for (let d = -14; d < 14; d += 1) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + d * 86_400_000));
      const r = await (await fetch(`/api/staff/inbox?date=${date}`)).json();
      const hit = r.items?.find((i: { appointment: { patientName?: string } }) => i.appointment.patientName?.includes(n));
      if (hit) return { date, id: hit.appointment.id as string, patientId: hit.appointment.patientId as string };
    }
    throw new Error(n);
  }, name);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  // --- rejestracja: skrzynka i zaproszenie z kodem QR ---
  const rec = await staff(browser, 'recepcja@eternal.local');
  const maria = await visit(rec, 'Lewandowska');
  await rec.goto(`${BASE}/panel/skrzynka?data=${maria.date}`);
  await shot(rec, 's11-skrzynka');
  const row = rec.locator('tr', { hasText: 'Maria Lewandowska' });
  await row.getByRole('button', { name: 'Zaproś' }).click();
  const [res] = await Promise.all([rec.waitForResponse((r) => r.url().includes('/invite') && r.request().method() === 'POST'), rec.getByRole('button', { name: 'Pokaż kod QR' }).click()]);
  const { url } = (await res.json()) as { url: string };
  await shot(rec, 's12-zaproszenie-qr');

  // --- pacjentka pod linkiem (telefon, bez konta) ---
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' })).newPage();
  await phone.goto(`${BASE}${new URL(url).pathname}`);
  await shot(phone, 'm01-link-zgoda', true);
  await phone.getByLabel('Wyrażam zgodę na udostępnienie dokumentów tej placówce na opisanych zasadach.').check();
  await phone.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
  await phone
    .locator('input[type=file][accept^="application/pdf"]')
    .setInputFiles({ name: 'wyniki.pdf', mimeType: 'application/pdf', buffer: simplePdf(['Laboratorium Przykladowe (fikcyjne) - DANE FIKCYJNE', 'Data pobrania: 02.10.2026', 'Glukoza 94 mg/dl 70 - 99', 'TSH 1,62 uIU/ml 0,27 - 4,2', 'Cholesterol calkowity 214 H mg/dl < 190']) });
  await phone.getByRole('button', { name: /Potwierdź wszystkie pewne/ }).waitFor({ timeout: 20_000 });
  await shot(phone, 'm02-link-potwierdzenie');

  // --- lekarz: raport faktów, Scribe, mierniki ---
  const doc = await staff(browser, 'anna.nowicka@eternal.local');
  const anna = await visit(doc, 'Kowalska');
  await doc.goto(`${BASE}/panel/wizyta/${anna.id}?tab=raport`);
  await doc.getByRole('heading', { name: 'Wyniki potwierdzone' }).waitFor();
  await shot(doc, 's13-raport-faktow', true);
  const sessions = await doc.evaluate(async () => (await (await fetch('/api/staff/scribe')).json()) as { items: { appointmentId?: string }[] });
  const past = sessions.items.find((x) => x.appointmentId)?.appointmentId;
  if (past) {
    await doc.goto(`${BASE}/panel/wizyta/${past}?tab=scribe`);
    await shot(doc, 's14-scribe-notatka', true);
  }
  await doc.goto(`${BASE}/panel/mierniki`);
  await shot(doc, 's15-mierniki', true);

  // --- administrator: moduły ---
  const adm = await staff(browser, 'admin@eternal.local');
  await adm.goto(`${BASE}/panel/organizacja`);
  await shot(adm, 's16-organizacja-moduly', true);

  // --- pacjentka w aplikacji ---
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  const p = await pctx.newPage();
  await p.goto(`${BASE}/logowanie`);
  await p.getByLabel('E-mail').fill('pacjent@eternal.local');
  await p.getByLabel('Hasło').fill(PASSWORD);
  await p.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await p.waitForURL(`${BASE}/`);
  for (const [path, name] of [
    ['/dokumenty', 'p11-dokumenty'],
    ['/os-czasu', 'p12-os-czasu'],
    ['/udostepnianie', 'p13-udostepnianie'],
    ['/karty', 'p14-karty'],
    ['/bezpieczenstwo', 'p15-bezpieczenstwo-sos'],
    ['/pomoc', 'p16-pomoc-numery'],
  ] as const) {
    await p.goto(`${BASE}${path}`);
    await shot(p, name, true);
  }
  await p.goto(`${BASE}/karty`);
  await p.locator('a[href^="/karty/"]').first().click();
  await shot(p, 'p17-karta-po-wizycie', true);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
