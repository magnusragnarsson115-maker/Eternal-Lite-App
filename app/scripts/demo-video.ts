/**
 * Film demonstracyjny: aplikacja pacjenta (telefon) i panel lekarza obok siebie — synchronizacja na żywo.
 * Wymaga uruchomionego serwera z danymi demo i ffmpeg. Użycie: npx tsx scripts/demo-video.ts [http://localhost:3000]
 */
import { chromium, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { totpCode } from '../server/auth/totp.ts';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
const TMP = 'data/video-tmp';
const PASSWORD = 'Eternal-Demo-2026';
const H = 844;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, slowMo: 60 }).catch(() => chromium.launch({ slowMo: 60 }));
  const common = { locale: 'pl-PL', timezoneId: 'Europe/Warsaw', deviceScaleFactor: 1 };
  const [pctx, dctx] = await Promise.all([
    browser.newContext({ ...common, viewport: { width: 390, height: H }, recordVideo: { dir: `${TMP}/p`, size: { width: 390, height: H } } }),
    browser.newContext({ ...common, viewport: { width: 1280, height: H }, recordVideo: { dir: `${TMP}/d`, size: { width: 1280, height: H } } }),
  ]);
  const [p, d] = await Promise.all([pctx.newPage(), dctx.newPage()]);

  // logowanie obu stron
  await Promise.all([p.goto(`${BASE}/logowanie`), d.goto(`${BASE}/panel/logowanie`)]);
  await p.getByLabel('E-mail').pressSequentially('pacjent@eternal.local', { delay: 20 });
  await p.getByLabel('Hasło').fill(PASSWORD);
  await d.getByLabel('E-mail').pressSequentially('anna.nowicka@eternal.local', { delay: 20 });
  await d.getByLabel('Hasło').fill(PASSWORD);
  await Promise.all([p.getByRole('button', { name: 'Zaloguj się' }).click(), d.getByRole('button', { name: 'Zaloguj się' }).click()]);
  await d.waitForURL(/\/panel\/mfa/);
  await d.getByLabel('Kod z aplikacji').pressSequentially(totpCode('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'), { delay: 60 });
  await d.getByRole('button', { name: 'Potwierdź' }).click();
  await d.waitForURL(/\/panel$/);
  await pause(1500);

  // lekarz otwiera kalendarz dnia z pierwszym wolnym terminem kardiologii
  const firstSlot = await p.evaluate(async () => {
    const cat = await (await fetch('/api/catalog')).json();
    const svc = cat.services.find((s: { name: string }) => s.name.startsWith('Konsultacja kardio'));
    return ((await (await fetch(`/api/availability?serviceId=${svc.id}`)).json()).slots as { start: string }[])[0].start;
  });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(firstSlot));
  await d.goto(`${BASE}/panel/kalendarz?date=${day}`);
  await d.getByRole('combobox', { name: 'Lekarz' }).selectOption({ label: 'dr n. med. Piotr Zieliński' });
  await pause(1200);

  // pacjent rezerwuje
  await p.goto(`${BASE}/rezerwacja`);
  await pause(800);
  await p.getByRole('button', { name: /Konsultacja kardiologiczna/ }).click();
  await p.locator('.time-btn').first().waitFor();
  await pause(800);
  await p.locator('.time-btn').first().click();
  await p.getByLabel('Informacja dla placówki (opcjonalnie)').pressSequentially('Kontrola po zmianie leków.', { delay: 25 });
  await p.getByRole('button', { name: 'Rezerwuję' }).scrollIntoViewIfNeeded();
  await pause(600);
  await p.getByRole('button', { name: 'Rezerwuję' }).click();
  await p.getByText('Zaplanowana').waitFor();
  // po stronie lekarza wizyta pojawia się bez przeładowania
  await d.locator('.cal-appt', { hasText: 'Anna Kowalska' }).first().waitFor();
  await pause(2200);

  // lekarz otwiera wizytę i wysyła przypomnienie — u pacjenta rośnie licznik powiadomień
  await d.locator('.cal-appt', { hasText: 'Anna Kowalska' }).first().click();
  await pause(1500);
  await d.getByRole('button', { name: 'Wyślij przypomnienie' }).click();
  await pause(2500);
  await d.keyboard.press('Escape');

  // lekarz udostępnia wynik — pacjent widzi go od razu
  await p.goto(`${BASE}/wyniki`);
  await d.goto(`${BASE}/panel/pacjenci`);
  await d.getByLabel('Szukaj pacjenta').pressSequentially('Kowalska', { delay: 30 });
  await d.getByRole('button', { name: 'Szukaj' }).click();
  await d.getByRole('link', { name: 'Anna Kowalska' }).click();
  await d.getByRole('tab', { name: 'Wyniki i dokumenty' }).click();
  await pause(1500);
  await d.getByRole('switch', { name: /Lipidogram/ }).click();
  await p.getByText('Lipidogram').waitFor();
  await pause(2000);
  await p.getByText('Lipidogram').click();
  await pause(2500);
  await p.mouse.wheel(0, 500);
  await d.getByRole('button', { name: /^Lipidogram .*odczytano/ }).waitFor();
  await pause(2500);

  await Promise.all([pctx.close(), dctx.close()]);
  await browser.close();

  const pv = fs.readdirSync(`${TMP}/p`).map((f) => path.join(`${TMP}/p`, f))[0];
  const dv = fs.readdirSync(`${TMP}/d`).map((f) => path.join(`${TMP}/d`, f))[0];
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const label = (text: string) => `drawtext=fontfile=${font}:text='${text}':fontcolor=white:fontsize=18:box=1:boxcolor=0x0e6f78@0.92:boxborderw=8:x=12:y=h-th-20`;
  execFileSync('ffmpeg', [
    '-y', '-i', pv, '-i', dv,
    '-filter_complex',
    `[0:v]${label('Pacjent — telefon')}[a];[1:v]${label('Lekarz — panel placówki')}[b];[a]pad=iw+12:ih:0:0:color=0x102029[a2];[a2][b]hstack=inputs=2,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-movflags', '+faststart',
    `${OUT}/eternal-demo-na-zywo.mp4`,
  ], { stdio: 'inherit' });
  console.log(`✓ ${OUT}/eternal-demo-na-zywo.mp4`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
