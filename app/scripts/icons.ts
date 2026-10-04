/** Generuje ikony PNG aplikacji (PWA) z web/public/icon.svg. Użycie: npx tsx scripts/icons.ts */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const svg = fs.readFileSync('web/public/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `web/public/icon-${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('ok');
