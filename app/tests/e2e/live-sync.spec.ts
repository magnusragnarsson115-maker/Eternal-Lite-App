import { expect, test, type Browser, type Page } from '@playwright/test';
import { totpCode } from '../../server/auth/totp';

const PASSWORD = 'Eternal-Demo-2026';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
// Serwer odrzuca ponowne użycie tego samego kodu TOTP — każde logowanie używa kolejnego kroku czasowego.
let totpStep = 0;

async function loginPatient(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/logowanie');
  await page.getByLabel('E-mail').fill('pacjent@eternal.local');
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Anna');
  return page;
}

async function loginDoctor(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/panel/logowanie');
  await page.getByLabel('E-mail').fill('anna.nowicka@eternal.local');
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL(/\/panel\/mfa/);
  await page.getByLabel('Kod z aplikacji').fill(totpCode(TOTP, Date.now() + 30_000 * totpStep++));
  await page.getByRole('button', { name: 'Potwierdź' }).click();
  await page.waitForURL(/\/panel$/);
  return page;
}

test('rezerwacja pacjenta pojawia się w kalendarzu placówki, a odwołanie przez placówkę — u pacjenta (bez przeładowania)', async ({ browser }) => {
  const patient = await loginPatient(browser);
  const doctor = await loginDoctor(browser);

  // pacjent wybiera usługę i pierwszy wolny termin
  await patient.goto('/rezerwacja');
  await patient.getByRole('button', { name: /Konsultacja kardiologiczna/ }).click();
  const firstTime = patient.locator('.time-btn').first();
  await firstTime.waitFor();
  const dayLabel = await patient.locator('.day-chip[aria-pressed="true"]').getAttribute('aria-label');
  const time = (await firstTime.textContent())?.trim() ?? '';
  // data wybranego dnia — z API (ta sama co w interfejsie)
  const slots = await patient.evaluate(async () => {
    const cat = await (await fetch('/api/catalog')).json();
    const svc = cat.services.find((s: { name: string }) => s.name.startsWith('Konsultacja kardio'));
    return (await (await fetch(`/api/availability?serviceId=${svc.id}`)).json()).slots as { start: string }[];
  });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(slots[0].start));
  expect(dayLabel).toBeTruthy();

  // lekarz ma otwarty kalendarz tego dnia
  await doctor.goto(`/panel/kalendarz?date=${day}`);
  await expect(doctor.locator('.cal-col').first()).toBeVisible();
  const before = await doctor.locator('.cal-appt', { hasText: 'Anna Kowalska' }).count();

  await firstTime.click();
  await patient.getByRole('button', { name: 'Rezerwuję' }).click();
  await expect(patient.getByRole('heading', { name: 'Konsultacja kardiologiczna' })).toBeVisible();
  await expect(patient.getByText('Zaplanowana')).toBeVisible();

  // bez przeładowania: wizyta pojawia się w kalendarzu placówki
  await expect(doctor.locator('.cal-appt', { hasText: 'Anna Kowalska' })).toHaveCount(before + 1);
  const appt = doctor.locator('.cal-appt', { hasText: `${time} Anna Kowalska` });
  await appt.click();
  await doctor.getByRole('button', { name: 'Odwołaj' }).click();
  await doctor.getByLabel('Powód (widoczny dla pacjenta)').fill('Zmiana grafiku lekarza');
  await doctor.getByRole('button', { name: 'Odwołaj wizytę' }).click();

  // pacjent widzi odwołanie na otwartym ekranie wizyty
  await expect(patient.getByText('Odwołana', { exact: true })).toBeVisible();
  await expect(patient.getByText('Zmiana grafiku lekarza')).toBeVisible();
});

test('udostępnienie wyniku przez lekarza od razu pojawia się w aplikacji pacjenta', async ({ browser }) => {
  const patient = await loginPatient(browser);
  const doctor = await loginDoctor(browser);
  await patient.goto('/wyniki');
  await expect(patient.getByText('Morfologia krwi')).toBeVisible();
  await expect(patient.getByText('Lipidogram')).toHaveCount(0);

  await doctor.goto('/panel/pacjenci');
  await doctor.getByLabel('Szukaj pacjenta').fill('Kowalska');
  await doctor.getByRole('button', { name: 'Szukaj' }).click();
  await doctor.getByRole('link', { name: 'Anna Kowalska' }).click();
  await doctor.getByRole('tab', { name: 'Wyniki i dokumenty' }).click();
  await doctor.getByRole('switch', { name: /Lipidogram/ }).click();

  await expect(patient.getByText('Lipidogram')).toBeVisible();
  await patient.getByText('Lipidogram').click();
  await expect(patient.locator('.obs-list').getByText('Cholesterol całkowity')).toBeVisible();
  await expect(patient.getByText('Aplikacja nie ocenia wyników', { exact: false }).first()).toBeVisible();

  // potwierdzenie odczytu wraca do lekarza
  await expect(doctor.getByRole('button', { name: /^Lipidogram .*odczytano/ })).toBeVisible();
});
