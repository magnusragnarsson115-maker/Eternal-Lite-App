import fs from 'node:fs';
import { type Browser, chromium } from 'playwright-core';
import { config } from '../config.js';
import { HttpError } from '../lib/util.js';

/**
 * Generator PDF (plik 12.8, A7: szablony wersjonowane + Chromium na serwerze).
 * HTML jest budowany po stronie serwera z danych już zapisanych w rekordzie; strona renderowana
 * bez JavaScriptu i bez dostępu do sieci — wszystkie zasoby (style, wykresy SVG) są w treści.
 */

const CANDIDATES = ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];

export function chromiumPath(): string | undefined {
  const configured = config.pdf.chromiumPath || process.env.CHROMIUM_PATH;
  if (configured) return configured;
  return CANDIDATES.find((p) => fs.existsSync(p));
}

export function pdfAvailable(): boolean {
  return !!chromiumPath();
}

let browserPromise: Promise<Browser> | undefined;

async function browser(): Promise<Browser> {
  const executablePath = chromiumPath();
  if (!executablePath) throw new HttpError(503, 'pdf_unavailable', 'Chromium not found (CHROMIUM_PATH)');
  if (!browserPromise) {
    browserPromise = chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
    browserPromise.then((b) => b.on('disconnected', () => (browserPromise = undefined))).catch(() => (browserPromise = undefined));
  }
  return browserPromise;
}

export async function closePdfBrowser(): Promise<void> {
  const b = await browserPromise?.catch(() => undefined);
  browserPromise = undefined;
  await b?.close().catch(() => undefined);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export async function renderPdf(html: string, opts: { footerLeft: string; landscape?: boolean }): Promise<Buffer> {
  const b = await browser();
  const context = await b.newContext({ javaScriptEnabled: false, locale: 'pl-PL' });
  try {
    await context.route('**/*', (route) => (route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: opts.landscape ?? false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:7.5pt;color:#555;width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">
        <span>${esc(opts.footerLeft)}</span><span>str. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await context.close().catch(() => undefined);
  }
}
