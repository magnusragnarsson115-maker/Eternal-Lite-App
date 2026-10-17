import { expect, test, type Browser, type Page } from '@playwright/test';
import { totpCode } from '../../server/auth/totp';
import { simplePdf } from '../../server/seed/pdf';

const PASSWORD = 'Eternal-Demo-2026';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

// mikrofon testowy Chromium (sygnał syntetyczny) — nagranie wizyty bez prawdziwego dźwięku
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  },
});

const LAB_PDF = simplePdf([
  'Laboratorium Przykladowe (fikcyjne) - DANE FIKCYJNE',
  'Data pobrania: 02.10.2026',
  'Glukoza 94 mg/dl 70 - 99',
  'TSH 1,62 uIU/ml 0,27 - 4,2',
  'Kreatynina 0,77 mg/dl 0,5 - 0,9',
]);

/**
 * Logowanie personelu z TOTP. Serwer nie przyjmuje ponownie kodu z tego samego lub wcześniejszego kroku czasu —
 * przy odrzuceniu czekamy na kolejny krok (maks. 30 s).
 */
async function loginStaff(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await page.goto('/panel/logowanie');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.waitForURL(/\/panel\/mfa/);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel('Kod z aplikacji').fill(totpCode(TOTP, Date.now()));
    await page.getByRole('button', { name: 'Potwierdź' }).click();
    const ok = await page
      .waitForURL(/\/panel$/, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return page;
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
  throw new Error(`Logowanie ${email} nie powiodło się`);
}

async function loginPatient(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/logowanie');
  await page.getByLabel('E-mail').fill('pacjent@eternal.local');
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Anna');
  return page;
}

/** Wizyta pacjenta z najbliższych dni — przez API skrzynki (ten sam widok co w panelu). */
async function findVisit(page: Page, patient: string): Promise<{ date: string; appointmentId: string; patientId: string }> {
  return page.evaluate(async (name) => {
    for (let d = 0; d < 14; d += 1) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + d * 86_400_000));
      const r = await (await fetch(`/api/staff/inbox?date=${date}`)).json();
      const hit = r.items?.find((i: { appointment: { patientName?: string } }) => i.appointment.patientName?.includes(name));
      if (hit) return { date, appointmentId: hit.appointment.id, patientId: hit.appointment.patientId };
    }
    throw new Error(`Brak wizyty: ${name}`);
  }, patient);
}

test('zaproszenie z rejestracji → zgoda i wgranie wyniku pod linkiem → lekarz widzi raport faktów, pacjent — kto oglądał', async ({ browser }) => {
  const reception = await loginStaff(browser, 'recepcja@eternal.local');
  const visit = await findVisit(reception, 'Lewandowska');

  // D2 → D1: skrzynka dnia, zaproszenie z kodem QR (bez SMS — pacjentka nie ma telefonu w kartotece)
  await reception.goto(`/panel/skrzynka?data=${visit.date}`);
  const row = reception.locator('tr', { hasText: 'Maria Lewandowska' });
  await row.getByRole('button', { name: 'Zaproś' }).click();
  const [res] = await Promise.all([reception.waitForResponse((r) => r.url().includes('/invite') && r.request().method() === 'POST'), reception.getByRole('button', { name: 'Pokaż kod QR' }).click()]);
  const { url } = (await res.json()) as { url: string };
  await expect(reception.getByRole('button', { name: 'Kopiuj link' })).toBeVisible();

  // strona pod linkiem: telefon pacjentki, bez konta
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await phone.goto(new URL(url).pathname);
  await expect(phone.getByRole('heading', { name: 'Dokumenty przed wizytą' })).toBeVisible();
  await phone.getByLabel('Wyrażam zgodę na udostępnienie dokumentów tej placówce na opisanych zasadach.').check();
  await phone.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
  await phone.locator('input[type=file][accept^="application/pdf"]').setInputFiles({ name: 'wyniki.pdf', mimeType: 'application/pdf', buffer: LAB_PDF });

  // potwierdzenie odczytu: wiersz źródłowy widoczny, nic nie jest oceniane
  await expect(phone.getByText('Glukoza 94 mg/dl 70 - 99').first()).toBeVisible({ timeout: 20_000 });
  await phone.getByRole('button', { name: /Potwierdź wszystkie pewne/ }).click();
  await phone.getByRole('button', { name: 'Gotowe — lekarz zobaczy przed wizytą' }).click();
  await expect(phone.getByText('Gotowe — lekarz zobaczy dokument przed wizytą.')).toBeVisible();

  // rejestracja widzi kompletność bez treści
  await reception.goto(`/panel/wizyta/${visit.appointmentId}`);
  await expect(reception.getByText('Treść materiałów widzi lekarz. Rejestracja widzi tylko stan kompletności.')).toBeVisible();
  await expect(reception.getByText('Glukoza')).toHaveCount(0);

  // D3: lekarz — raport faktów z wartością, jednostką, zakresem z dokumentu i źródłem
  const doctor = await loginStaff(browser, 'piotr.zielinski@eternal.local');
  await doctor.goto(`/panel/raport/${visit.patientId}`);
  await expect(doctor.getByRole('heading', { name: 'Wyniki potwierdzone' })).toBeVisible();
  await expect(doctor.getByText('Glukoza').first()).toBeVisible();
  await expect(doctor.getByText('70 - 99').first()).toBeVisible();

  // P2: pacjentka widzi, kto oglądał jej dane
  await phone.getByRole('button', { name: 'Kto oglądał moje dane' }).click();
  await expect(phone.getByRole('dialog').getByText('Raport faktów przed wizytą').first()).toBeVisible();
  await expect(phone.getByRole('dialog').getByText(/Zieliński/).first()).toBeVisible();
});

test('Scribe: zgoda → nagranie → szkic ze źródłami → zatwierdzenie → karta „Po wizycie” w aplikacji pacjentki', async ({ browser }) => {
  const patient = await loginPatient(browser);
  await patient.goto('/karty');
  // dane demonstracyjne zawierają już jedną kartę — czekamy na listę, zanim policzymy
  await expect(patient.locator('a[href^="/karty/"]').first()).toBeVisible();
  const before = await patient.locator('a[href^="/karty/"]').count();

  const doctor = await loginStaff(browser, 'piotr.zielinski@eternal.local');
  const visit = await findVisit(doctor, 'Kowalska');
  await doctor.goto(`/panel/wizyta/${visit.appointmentId}?tab=scribe`);
  await doctor.getByLabel('Pacjent zgodził się na nagranie rozmowy').check();
  await doctor.getByRole('button', { name: 'Rozpocznij' }).click();

  await doctor.getByRole('button', { name: 'Nagrywaj' }).click();
  await doctor.waitForTimeout(2500);
  await doctor.getByRole('button', { name: 'Zakończ' }).click();
  await doctor.getByRole('button', { name: 'Wyślij do szkicu notatki' }).click();

  // szkic: akapity z odnośnikami do fragmentów rozmowy (S#), oznaczenie AI
  await expect(doctor.getByText('Szkic notatki')).toBeVisible({ timeout: 30_000 });
  await expect(doctor.getByText('Transkrypcja')).toBeVisible();
  await expect(doctor.locator('button.badge', { hasText: /^S\d+$/ }).first()).toBeVisible();
  await doctor.getByRole('button', { name: 'Zatwierdź notatkę' }).click();
  const confirmBtn = doctor.getByRole('dialog').getByRole('button', { name: 'Zatwierdź' });
  if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
  await expect(doctor.getByText('Notatka zatwierdzona').first()).toBeVisible();

  // karta „Po wizycie”: szkic → akceptacja lekarza → aplikacja pacjentki (bez przeładowania strony listy)
  await doctor.getByRole('button', { name: 'Przygotuj szkic karty' }).click();
  await doctor.getByRole('button', { name: 'Akceptuję i wyślij' }).click();
  await expect(doctor.getByText('Karta wysłana do aplikacji pacjenta.')).toBeVisible();

  await patient.reload();
  await expect(patient.locator('a[href^="/karty/"]')).toHaveCount(before + 1);
  await patient.locator('a[href^="/karty/"]').first().click();
  await expect(patient.getByText('Przygotowane przez AI, zatwierdzone przez lekarza.')).toBeVisible();
});
