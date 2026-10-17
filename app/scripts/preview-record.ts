/**
 * Nagranie odpowiedzi API do podglądu bez serwera (`vite.preview.config.ts`). Tylko instancja pokazowa
 * z danymi fikcyjnymi (DEMO_MODE) — skrypt odmawia pracy, gdy serwer nie jest w trybie demo.
 *
 *   npm run seed:demo && npm run build:web && npm start        (w drugim terminalu)
 *   npm run preview:record -- [http://localhost:3000]
 *   npm run build:preview                                      → dist/preview
 *
 * Dla każdego konta pokazowego: logowanie, przejście po wszystkich ekranach z menu, po linkach do szczegółów
 * (do 3 na wzorzec adresu) i po zakładkach; pliki z linków (PDF, CSV, ICS) pobierane osobno. Pacjentka Anna —
 * także w profilu dziecka, jeśli ma go w rodzinie.
 */
import { writeFileSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from '@playwright/test';
import { totpCode } from '../server/auth/totp.ts';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT = process.argv[3] ?? 'dist/preview-data.json';
const PASSWORD = 'Eternal-Demo-2026';
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const MAX_PAGES = 180;
const PER_TEMPLATE = 3;
const MAX_FILE = 1_500_000;

interface Recorded {
  s: number;
  t: string;
  b?: string;
  b64?: string;
}

const PATIENT_ROUTES = ['/', '/wizyty', '/rezerwacja', '/wyniki', '/dokumenty', '/os-czasu', '/raport', '/pomiary', '/leki', '/wiadomosci', '/kalendarz', '/dzienniki', '/historia-zdrowia', '/plan', '/dla-lekarza', '/rodzina', '/ankiety', '/udostepnianie', '/karty', '/bezpieczenstwo', '/pomoc', '/prywatnosc', '/profil', '/powiadomienia', '/nfz', '/wiecej', '/jak-dziala-ai'];
const STAFF_ROUTES = ['/panel', '/panel/kalendarz', '/panel/skrzynka', '/panel/pacjenci', '/panel/wiadomosci', '/panel/grafik', '/panel/udostepnienia', '/panel/mierniki', '/panel/wysylka', '/panel/powiadomienia', '/panel/admin', '/panel/organizacja', '/panel/konto'];
const NEVER = [/\/wyloguj/, /\/logowanie/, /\/mfa/, /\/teleporada$/, /\/nagranie\//];

const PERSONAS: { id: string; email: string; staff: boolean }[] = [
  { id: 'patient', email: 'pacjent@eternal.local', staff: false },
  { id: 'maria', email: 'maria@eternal.local', staff: false },
  { id: 'doctor', email: 'anna.nowicka@eternal.local', staff: true },
  { id: 'cardio', email: 'piotr.zielinski@eternal.local', staff: true },
  { id: 'reception', email: 'recepcja@eternal.local', staff: true },
  { id: 'admin', email: 'admin@eternal.local', staff: true },
];

function keyOf(method: string, rawUrl: string, profile?: string): string {
  const u = new URL(rawUrl);
  const p = profile || u.searchParams.get('profile') || '';
  u.searchParams.delete('profile');
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const q = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  return `${method.toUpperCase()} ${u.pathname}${q}${p ? ` @${p}` : ''}`;
}

function isApi(url: string): boolean {
  const p = new URL(url).pathname;
  return p.startsWith('/api/') || p.startsWith('/fhir/');
}

function isText(type: string): boolean {
  return /json|text|xml|csv|calendar|javascript/.test(type);
}

async function toRecord(status: number, type: string, body: Buffer): Promise<Recorded | undefined> {
  if (body.length > MAX_FILE) return undefined;
  return isText(type) ? { s: status, t: type, b: body.toString('utf8') } : { s: status, t: type, b64: body.toString('base64') };
}

/** Wzorzec adresu: identyfikatory zamienione na :id — ogranicza liczbę odwiedzanych szczegółów. */
function template(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map((s) => (/\d/.test(s) && s.length >= 6 ? ':id' : s))
    .join('/');
}

function recorder(routes: Record<string, Recorded>) {
  return async (res: Response) => {
    const req = res.request();
    if (!isApi(res.url()) || new URL(res.url()).pathname === '/api/events') return;
    try {
      const body = await res.body();
      const rec = await toRecord(res.status(), res.headers()['content-type'] ?? '', body);
      if (rec) routes[keyOf(req.method(), res.url(), req.headers()['x-eternal-profile'])] = rec;
    } catch {
      /* odpowiedź bez treści (przekierowanie, przerwane) */
    }
  };
}

async function newContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
  await ctx.route('**/api/events**', (r) => r.abort());
  return ctx;
}

async function login(page: Page, p: (typeof PERSONAS)[number]): Promise<void> {
  await page.goto(`${BASE}${p.staff ? '/panel/logowanie' : '/logowanie'}`);
  await page.getByLabel('E-mail').fill(p.email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  if (p.staff) {
    await page.waitForURL(/\/panel\/mfa/);
    await page.getByLabel('Kod z aplikacji').fill(totpCode(TOTP, Date.now()));
    await page.getByRole('button', { name: 'Potwierdź' }).click();
    await page.waitForURL((u) => u.pathname === '/panel');
  } else {
    await page.waitForURL((u) => !u.pathname.startsWith('/logowanie'));
  }
  await page.waitForTimeout(800);
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Przejście po ekranach: menu, linki do szczegółów, zakładki. Zwraca linki do plików. */
async function crawl(page: Page, start: string[], scope: (path: string) => boolean): Promise<Set<string>> {
  const queue = [...start];
  const seen = new Set<string>();
  const perTemplate = new Map<string, number>();
  const files = new Set<string>();
  while (queue.length && seen.size < MAX_PAGES) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    const tpl = template(path);
    if ((perTemplate.get(tpl) ?? 0) >= PER_TEMPLATE) continue;
    seen.add(path);
    perTemplate.set(tpl, (perTemplate.get(tpl) ?? 0) + 1);
    await page.goto(`${BASE}${path}`).catch(() => undefined);
    await settle(page);
    const tabs = page.getByRole('tab');
    const count = await tabs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click({ timeout: 2000 }).catch(() => undefined);
      await settle(page);
      await collect(page, queue, files, scope);
    }
    await collect(page, queue, files, scope);
  }
  console.log(`  ekrany: ${seen.size}, pliki: ${files.size}`);
  return files;
}

async function collect(page: Page, queue: string[], files: Set<string>, scope: (path: string) => boolean): Promise<void> {
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? '')).catch(() => [] as string[]);
  for (const h of hrefs) {
    if (h.startsWith('/api/') || h.startsWith('/fhir/')) files.add(h);
    else if (h.startsWith('/') && scope(h) && !NEVER.some((r) => r.test(h)) && !queue.includes(h)) queue.push(h);
  }
}

/**
 * Odczyty, do których prowadzą przyciski i pola wyboru (nie linki): inne okresy, rodzaje pomiarów, terminy, dni.
 * Adresy liczymy tutaj, a strona tylko je pobiera — kod w `page.evaluate` nie może mieć nazwanych funkcji
 * pomocniczych (tsx dopisuje do nich `__name`, którego w przeglądarce nie ma).
 */
function warsawDay(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

async function pageGet(page: Page, urls: string[], profile?: string): Promise<unknown[]> {
  return page.evaluate(
    async ([list, prof]) => {
      const out: unknown[] = [];
      for (const u of list as string[]) {
        const r = await fetch(u, { headers: prof ? { 'X-Eternal-Profile': prof as string } : {} }).catch(() => undefined);
        out.push(r && r.ok && (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : null);
      }
      return out;
    },
    [urls, profile ?? ''] as const,
  );
}

async function patientExtras(page: Page, profile?: string): Promise<void> {
  const today = warsawDay(0);
  const from = `${today.slice(0, 8)}01`;
  const end = new Date(`${from}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const urls = [
    ...['bp', 'heartRate', 'weight', 'height', 'spo2', 'temperature', 'glucose'].map((k) => `/api/me/measurements?kind=${k}`),
    ...['month', 'quarter'].map((p) => `/api/me/report?period=${p}&anchor=${today}`),
    `/api/me/doctor-report?reason=${encodeURIComponent('Kontrola po zmianie leków')}&days=90`,
    `/api/me/calendar?from=${from}&to=${end.toISOString().slice(0, 10)}&meds=1`,
    // runda 4: odczyty uruchamiane przyciskami
    '/api/me/journal/overview?kind=cycle',
    '/api/me/journal/overview?kind=food&days=30',
    '/api/me/activity?days=30',
  ];
  if (!profile) urls.push('/api/registries/pharmacies?near=1', '/api/registries/refund?q=D3', '/api/registries/refund?q=Witamina', '/api/me/environment');
  await pageGet(page, urls, profile);
  if (!profile) {
    const [cat] = (await pageGet(page, ['/api/catalog'])) as [{ services?: { id: string }[] } | null];
    const to = new Date(Date.now() + 42 * 86_400_000).toISOString();
    await pageGet(page, (cat?.services ?? []).map((s) => `/api/availability?serviceId=${s.id}&to=${encodeURIComponent(to)}`));
  }
  await page.waitForTimeout(500);
}

async function staffExtras(page: Page): Promise<string[]> {
  const urls: string[] = [];
  for (let d = -3; d <= 10; d++) {
    urls.push(`/api/staff/calendar?date=${warsawDay(d)}`);
    for (const filter of ['all', 'missing']) for (const mine of ['true', 'false']) urls.push(`/api/staff/inbox?date=${warsawDay(d)}&filter=${filter}&mine=${mine}`);
  }
  // runda 4: słownik ICD-10 w panelu lekarza (pole wyszukiwania)
  for (const q of ['na', 'nad', 'nadc', 'nadci', 'nadciś', 'I1', 'I10', 'as', 'ast', 'astm', 'cu', 'cuk', 'cukr', 'mi', 'mig', 'migr']) urls.push(`/api/staff/diagnosis-codes?q=${encodeURIComponent(q)}`);
  await pageGet(page, urls);
  const found = (await pageGet(page, ['Kowalska', 'Wiśniewski', 'Lewandowska', 'Anna', 'Jan', 'Maria', 'Ko'].map((q) => `/api/staff/patients?q=${encodeURIComponent(q)}`))) as ({ items?: { id: string }[] } | null)[];
  const ids = new Set(found.flatMap((r) => r?.items?.map((i) => i.id) ?? []));
  await page.waitForTimeout(500);
  return [...ids].map((id) => `/panel/pacjenci/${id}`);
}

async function fetchFiles(ctx: BrowserContext, files: Set<string>, routes: Record<string, Recorded>): Promise<void> {
  for (const f of files) {
    if (f.includes('/oidc/')) continue;
    const res = await ctx.request.get(`${BASE}${f}`).catch(() => undefined);
    if (!res) continue;
    const rec = await toRecord(res.status(), res.headers()['content-type'] ?? '', await res.body());
    if (rec) routes[keyOf('GET', `${BASE}${f}`)] = rec;
  }
}

async function main() {
  const cfg = (await (await fetch(`${BASE}/api/public/config`)).json()) as { demoMode?: boolean };
  if (!cfg.demoMode) throw new Error('Serwer nie jest w trybie demo (DEMO_MODE) — nagrywam tylko dane fikcyjne.');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const recordedAt = new Date().toISOString();

  // bez logowania: ekrany logowania i konfiguracja publiczna
  const anon: Record<string, Recorded> = {};
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    page.on('response', recorder(anon));
    for (const p of ['/logowanie', '/panel/logowanie', '/rejestracja']) {
      await page.goto(`${BASE}${p}`);
      await settle(page);
    }
    await ctx.close();
  }

  const personas: Record<string, { email: string; routes: Record<string, Recorded> }> = {};
  for (const p of PERSONAS) {
    console.log(`→ ${p.email}`);
    const routes: Record<string, Recorded> = {};
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    page.on('response', recorder(routes));
    await login(page, p);
    const inScope = p.staff ? (h: string) => h.startsWith('/panel') : (h: string) => !h.startsWith('/panel');
    const files = await crawl(page, p.staff ? STAFF_ROUTES : PATIENT_ROUTES, inScope);
    if (p.staff) {
      for (const f of await crawl(page, await staffExtras(page), inScope)) files.add(f);
    } else {
      await patientExtras(page);
    }
    if (p.id === 'patient') {
      // profil dziecka / osoby pod opieką (A24.2): te same ekrany w imieniu tej osoby
      const fam = (await page.evaluate(async () => (await fetch('/api/me/family')).json())) as { profiles?: { id: string; self?: boolean; lapsed?: boolean }[] };
      const child = fam.profiles?.find((x) => !x.self && !x.lapsed);
      if (child) {
        await page.evaluate((id) => sessionStorage.setItem('eternal.profile', id), child.id);
        for (const f of await crawl(page, PATIENT_ROUTES, inScope)) files.add(f);
        await patientExtras(page, child.id);
        await page.evaluate(() => sessionStorage.removeItem('eternal.profile'));
      }
    }
    await fetchFiles(ctx, files, routes);
    // stan „po zalogowaniu” — ostatni odczyt profilu
    const me = await ctx.request.get(`${BASE}/api/auth/me`);
    routes['GET /api/auth/me'] = { s: me.status(), t: me.headers()['content-type'] ?? 'application/json', b: await me.text() };
    personas[p.id] = { email: p.email, routes };
    console.log(`  odpowiedzi: ${Object.keys(routes).length}`);
    await ctx.close();
  }
  await browser.close();
  const data = { recordedAt, anon, personas };
  writeFileSync(OUT, JSON.stringify(data));
  console.log(`Zapisano ${OUT} (${(JSON.stringify(data).length / 1e6).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
