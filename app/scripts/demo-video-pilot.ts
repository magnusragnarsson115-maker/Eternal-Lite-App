/**
 * Wideo z pokazu pilotażu (dane fikcyjne) — jeden przebieg z podpisami kroków, do pokazu klinikom i inwestorom.
 * Użycie (serwer demo: DEMO_MODE=true, `npm run seed:demo`, `npm start`):
 *   npx tsx scripts/demo-video-pilot.ts [http://localhost:3000] [katalog-wyjściowy]
 * Wynik: plik .webm (Playwright); konwersja do MP4: ffmpeg -i wideo.webm -c:v libx264 -pix_fmt yuv420p wideo.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { simplePdf } from '../server/seed/pdf.ts';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? 'docs/demo';
const W = 1280;
const H = 800;

let caption = '';

async function showCaption(page: Page) {
  await page
    .evaluate((text) => {
      let el = document.getElementById('demo-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-caption';
        el.setAttribute('style', 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;max-width:90%;background:rgba(10,40,46,.92);color:#fff;font:600 19px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);text-align:center;pointer-events:none');
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.style.display = text ? 'block' : 'none';
    }, caption)
    .catch(() => undefined);
}

async function say(page: Page, text: string, ms = 2500) {
  caption = text;
  await showCaption(page);
  await page.waitForTimeout(ms);
}

async function scroll(page: Page, px: number, steps = 6) {
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, px / steps);
    await page.waitForTimeout(120);
  }
}

async function staffLogin(page: Page, button: string) {
  await page.goto(`${BASE}/panel/logowanie`);
  await page.getByRole('button', { name: button }).click();
  await page.waitForURL(/\/panel\/mfa/);
  await page.getByRole('button', { name: 'Wpisz kod' }).click({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Potwierdź' }).click();
  await page.waitForURL(`${BASE}/panel`);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Wyloguj' }).first().click();
  await page.waitForTimeout(800);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    permissions: ['microphone'],
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  page.on('load', () => void showCaption(page));

  // --- 0. tytuł ---
  await page.goto(`${BASE}/panel/logowanie`);
  await say(page, 'Eternal — materiały przed wizytą, raport faktów i Eternal Scribe (dane fikcyjne)', 3500);

  // --- 1. rejestracja: skrzynka i zaproszenie ---
  await staffLogin(page, 'Rejestracja');
  const visit = await page.evaluate(async () => {
    for (let d = 0; d < 14; d += 1) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + d * 86_400_000));
      const r = await (await fetch(`/api/staff/inbox?date=${date}`)).json();
      const hit = r.items?.find((i: { appointment: { patientName?: string } }) => i.appointment.patientName?.includes('Lewandowska'));
      if (hit) return { date, patientId: hit.appointment.patientId as string };
    }
    throw new Error('brak wizyty');
  });
  await page.goto(`${BASE}/panel/skrzynka?data=${visit.date}`);
  await say(page, '1. Rejestracja: wizyty dnia z paskiem kompletności materiałów', 3500);
  await page.locator('tr', { hasText: 'Maria Lewandowska' }).getByRole('button', { name: 'Zaproś' }).click();
  await say(page, 'Zaproszenie: SMS z linkiem albo kod QR — treść SMS bez danych o zdrowiu', 2500);
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes('/invite') && r.request().method() === 'POST'), page.getByRole('button', { name: 'Pokaż kod QR' }).click()]);
  const { url } = (await res.json()) as { url: string };
  await say(page, 'Pacjentka skanuje kod telefonem — bez konta i bez instalowania aplikacji', 3500);
  await page.keyboard.press('Escape');
  await logout(page);

  // --- 2. pacjentka pod linkiem ---
  await page.setViewportSize({ width: W, height: H });
  await page.goto(`${BASE}${new URL(url).pathname}`);
  await say(page, '2. Strona pod linkiem: do czego służy, zgoda na udostępnienie do terminu wizyty', 3500);
  await scroll(page, 500);
  await page.getByLabel('Wyrażam zgodę na udostępnienie dokumentów tej placówce na opisanych zasadach.').check();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
  await say(page, 'Dodanie wyniku: zdjęcie albo PDF z portalu laboratorium', 2500);
  await page.locator('input[type=file][accept^="application/pdf"]').setInputFiles({
    name: 'wyniki-laboratorium.pdf',
    mimeType: 'application/pdf',
    buffer: simplePdf(['Laboratorium Przykladowe (fikcyjne) - DANE FIKCYJNE', 'Data pobrania: 02.10.2026', 'Glukoza 94 mg/dl 70 - 99', 'TSH 1,62 uIU/ml 0,27 - 4,2', 'Cholesterol calkowity 214 H mg/dl < 190', 'Kreatynina 0,77 mg/dl 0,5 - 0,9']),
  });
  await page.getByRole('button', { name: /Potwierdź wszystkie pewne/ }).waitFor({ timeout: 20_000 });
  await say(page, 'Odczyt: każde pole z wierszem źródłowym; zakres i oznaczenie wyłącznie z dokumentu', 4000);
  await scroll(page, 400);
  await page.getByRole('button', { name: /Potwierdź wszystkie pewne/ }).click();
  await page.waitForTimeout(800);
  await say(page, 'Pacjentka potwierdza odczyt — niepotwierdzone pola lekarz zobaczy z oznaczeniem', 3000);
  await page.getByRole('button', { name: 'Gotowe — lekarz zobaczy przed wizytą' }).click();
  await say(page, 'Gotowe — dokument trafia do lekarza przed wizytą', 2500);

  // --- 3. lekarz: raport faktów ---
  await staffLogin(page, 'Lekarz (interna)');
  await page.goto(`${BASE}/panel/raport/${visit.patientId}`);
  await page.getByRole('heading', { name: 'Wyniki potwierdzone' }).waitFor();
  await say(page, '3. Lekarz: raport faktów — wartość, jednostka, zakres z dokumentu, odnośnik do źródła', 4000);
  await scroll(page, 700, 10);
  await say(page, 'Raport niczego nie ocenia; PDF jednym kliknięciem do systemu kliniki', 3000);

  // --- 4. Scribe ---
  const anna = await page.evaluate(async () => {
    for (let d = 0; d < 14; d += 1) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + d * 86_400_000));
      const r = await (await fetch(`/api/staff/inbox?date=${date}`)).json();
      const hit = r.items?.find((i: { appointment: { patientName?: string } }) => i.appointment.patientName?.includes('Kowalska'));
      if (hit) return hit.appointment.id as string;
    }
    throw new Error('brak wizyty');
  });
  await page.goto(`${BASE}/panel/wizyta/${anna}?tab=scribe`);
  await say(page, '4. Eternal Scribe: najpierw zapis zgody pacjenta na nagranie', 3000);
  await page.getByLabel('Pacjent zgodził się na nagranie rozmowy').check();
  await page.getByRole('button', { name: 'Rozpocznij' }).click();
  await page.getByRole('button', { name: 'Nagrywaj' }).click();
  await say(page, 'Nagranie wizyty (w pokazie: mikrofon testowy i przykładowa rozmowa)', 3500);
  await page.getByRole('button', { name: 'Zakończ' }).click();
  await page.getByRole('button', { name: 'Wyślij do szkicu notatki' }).click();
  await page.getByText('Szkic notatki').waitFor({ timeout: 30_000 });
  await say(page, 'Szkic według szablonu kliniki — każdy akapit z odnośnikiem do fragmentu rozmowy (S1, S2…)', 4500);
  await scroll(page, 500);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Zatwierdź notatkę' }).click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Zatwierdź' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.getByText('Notatka zatwierdzona').first().waitFor();
  await say(page, 'Lekarz zatwierdza — notatka trafia do dokumentacji z oznaczeniem AI', 3000);
  await page.getByRole('button', { name: 'Przygotuj szkic karty' }).click();
  await page.getByRole('button', { name: 'Akceptuję i wyślij' }).waitFor();
  await say(page, 'Karta „Po wizycie” prostym językiem — lekarz sprawdza i akceptuje', 3500);
  await page.getByRole('button', { name: 'Akceptuję i wyślij' }).click();
  await page.waitForTimeout(1500);
  await logout(page);

  // --- 5. pacjentka w aplikacji ---
  await page.goto(`${BASE}/logowanie`);
  await page.getByRole('button', { name: 'Pacjentka Anna Kowalska' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/karty`);
  await page.locator('a[href^="/karty/"]').first().click();
  await say(page, '5. Pacjentka: karta „Po wizycie” w aplikacji — co zrobiono, co dalej, kiedy wrócić', 4500);
  await scroll(page, 400);
  await page.goto(`${BASE}/udostepnianie`);
  await say(page, 'Udostępnianie na czas i dziennik „kto oglądał moje dane”', 4000);
  await scroll(page, 500);
  await page.goto(`${BASE}/pomoc`);
  await say(page, 'Numery pomocowe 112 i 116 123 — zawsze widoczne, nie do wyłączenia', 3500);
  await say(page, 'Eternal · dane fikcyjne · tryb demonstracyjny', 2500);

  const video = page.video();
  await context.close();
  await browser.close();
  const file = await video?.path();
  if (file) {
    const target = path.join(OUT, 'eternal-pilotaz-pokaz.webm');
    fs.renameSync(file, target);
    console.log(target);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
