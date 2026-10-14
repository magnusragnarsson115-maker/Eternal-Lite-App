import fs from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';
import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import type { DocLine } from '../labs/parser.js';
import { AiError } from './types.js';

/**
 * Odczyt dokumentów (moduł R5 / P3).
 * 1. PDF z warstwą tekstową (większość wyników z portali laboratoriów) — odczyt lokalny, bez wysyłania pliku (0 zł).
 * 2. Zdjęcie albo skan — usługa odczytu wybrana testem D51: Mistral OCR albo Google Document AI (region UE).
 */

export interface OcrResult {
  provider: 'pdf-text' | 'mistral' | 'google';
  lines: DocLine[];
  pages: number;
}

export function ocrConfigured(): boolean {
  if (config.ocr.provider === 'mistral') return !!config.ai.mistralApiKey;
  if (config.ocr.provider === 'google') return !!(config.ocr.google.credentialsFile && config.ocr.google.projectId && config.ocr.google.processorId);
  return false;
}

// --- 1. warstwa tekstowa PDF -------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
  transform: number[];
}

export async function pdfTextLayer(data: Buffer): Promise<OcrResult | undefined> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  try {
    const lines: DocLine[] = [];
    let chars = 0;
    for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // grupowanie fragmentów w linie po współrzędnej Y (tolerancja 2 pkt), w linii — po X
      const rows: { y: number; items: { x: number; s: string }[] }[] = [];
      for (const it of content.items as PdfTextItem[]) {
        if (!('str' in it) || !it.str.trim()) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) <= 2);
        if (!row) {
          row = { y, items: [] };
          rows.push(row);
        }
        row.items.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        const text = r.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) {
          lines.push({ page: p, text });
          chars += text.length;
        }
      }
    }
    if (chars < 40) return undefined; // skan bez warstwy tekstowej
    return { provider: 'pdf-text', lines, pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

// --- 2a. Mistral OCR ---------------------------------------------------------------------------------

/** Tabele z markdownu Mistral OCR („| Glukoza | 92 | mg/dl |”) → zwykłe linie tekstu. */
export function markdownToLines(md: string, page: number): DocLine[] {
  return md
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\|?\s*:?-{2,}/.test(l) && !/^!\[/.test(l))
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/\s*\|\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .map((text) => ({ page, text }));
}

async function mistralOcr(data: Buffer, contentType: string): Promise<OcrResult> {
  const dataUrl = `data:${contentType};base64,${data.toString('base64')}`;
  const document = contentType === 'application/pdf' ? { type: 'document_url', document_url: dataUrl } : { type: 'image_url', image_url: dataUrl };
  const res = await fetchWithTimeout(
    'https://api.mistral.ai/v1/ocr',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.ai.mistralApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.ocr.mistralModel, document, include_image_base64: false }),
    },
    config.ai.timeoutMs,
  ).catch((err: Error) => {
    throw new AiError('provider_unreachable', err.message);
  });
  if (!res.ok) throw new AiError(res.status === 429 ? 'rate_limited' : res.status === 401 ? 'auth' : 'provider_error', `Mistral OCR ${res.status}`);
  const json = (await res.json()) as { pages?: { index?: number; markdown?: string }[] };
  const pages = json.pages ?? [];
  return { provider: 'mistral', lines: pages.flatMap((p, i) => markdownToLines(p.markdown ?? '', (p.index ?? i) + 1)), pages: pages.length };
}

// --- 2b. Google Document AI (konto usługi, region UE) -------------------------------------------------

let googleToken: { token: string; exp: number } | undefined;

async function googleAccessToken(): Promise<string> {
  if (googleToken && googleToken.exp > Date.now() + 60_000) return googleToken.token;
  const sa = JSON.parse(fs.readFileSync(config.ocr.google.credentialsFile, 'utf8')) as { client_email: string; private_key: string; token_uri?: string };
  const key = await importPKCS8(sa.private_key, 'RS256');
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const res = await fetchWithTimeout(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new AiError('auth', `Google token ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  googleToken = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

interface DocAiLayout {
  textAnchor?: { textSegments?: { startIndex?: string; endIndex?: string }[] };
}

async function googleOcr(data: Buffer, contentType: string): Promise<OcrResult> {
  const g = config.ocr.google;
  const url = `https://${g.location}-documentai.googleapis.com/v1/projects/${g.projectId}/locations/${g.location}/processors/${g.processorId}:process`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${await googleAccessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawDocument: { content: data.toString('base64'), mimeType: contentType } }),
    },
    config.ai.timeoutMs,
  ).catch((err: Error) => {
    throw new AiError('provider_unreachable', err.message);
  });
  if (!res.ok) throw new AiError(res.status === 429 ? 'rate_limited' : 'provider_error', `Document AI ${res.status}`);
  const json = (await res.json()) as { document?: { text?: string; pages?: { pageNumber?: number; lines?: { layout?: DocAiLayout }[] }[] } };
  const text = json.document?.text ?? '';
  const pages = json.document?.pages ?? [];
  const lines: DocLine[] = [];
  for (const p of pages) {
    for (const l of p.lines ?? []) {
      const seg = (l.layout?.textAnchor?.textSegments ?? [])
        .map((s) => text.slice(Number(s.startIndex ?? 0), Number(s.endIndex ?? 0)))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (seg) lines.push({ page: p.pageNumber ?? 1, text: seg });
    }
  }
  return { provider: 'google', lines, pages: pages.length };
}

/** Odczyt dokumentu: najpierw lokalna warstwa tekstowa PDF, potem skonfigurowana usługa. */
export async function readDocument(data: Buffer, contentType: string): Promise<OcrResult> {
  if (contentType === 'application/pdf') {
    const local = await pdfTextLayer(data).catch(() => undefined);
    if (local) return local;
  }
  if (!ocrConfigured()) throw new AiError('not_configured', 'OCR provider not configured');
  return config.ocr.provider === 'google' ? googleOcr(data, contentType) : mistralOcr(data, contentType);
}
