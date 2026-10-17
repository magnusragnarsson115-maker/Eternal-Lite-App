/**
 * Podgląd aplikacji bez serwera (np. prywatny link do strony w przeglądarce, także na telefonie).
 *
 * Odpowiedzi API są nagrane z instancji pokazowej z danymi fikcyjnymi (`scripts/preview-record.ts`), osobno dla
 * każdego konta pokazowego. Ta warstwa podmienia `fetch` dla adresów `/api/*` i `/fhir/*`: odczyty zwracają
 * nagranie, zapis kończy się komunikatem „podgląd — zmiany nie są zapisywane”. Czas w podglądzie płynie od chwili
 * nagrania, żeby „dziś”, „jutro” i najbliższe wizyty zgadzały się z danymi.
 */

export interface Recorded {
  /** status HTTP */
  s: number;
  /** content-type */
  t: string;
  /** treść tekstowa */
  b?: string;
  /** treść binarna (PDF, obraz) w base64 */
  b64?: string;
}

export interface PreviewPersona {
  email: string;
  routes: Record<string, Recorded>;
}

export interface PreviewData {
  recordedAt: string;
  anon: Record<string, Recorded>;
  personas: Record<string, PreviewPersona>;
}

const STATE_KEY = 'eternal.preview.persona';

let data: PreviewData;
let persona: string | null = null;

function readState(): string | null {
  try {
    return sessionStorage.getItem(STATE_KEY);
  } catch {
    return null;
  }
}

function writeState(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(STATE_KEY, id);
    else sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* tryb prywatny — konto pamiętane tylko do odświeżenia strony */
  }
}

/** Klucz nagrania: metoda, ścieżka, posortowane parametry i profil opiekuna (A24.2). */
export function recordKey(method: string, rawUrl: string, profileHeader?: string | null): string {
  const u = new URL(rawUrl, 'http://preview.local');
  const profile = profileHeader || u.searchParams.get('profile') || '';
  u.searchParams.delete('profile');
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const q = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  return `${method.toUpperCase()} ${u.pathname}${q}${profile ? ` @${profile}` : ''}`;
}

function splitKey(key: string): { method: string; path: string; profile: string } {
  const [method, rest] = [key.slice(0, key.indexOf(' ')), key.slice(key.indexOf(' ') + 1)];
  const at = rest.indexOf(' @');
  const target = at >= 0 ? rest.slice(0, at) : rest;
  return { method, path: target.split('?')[0], profile: at >= 0 ? rest.slice(at + 2) : '' };
}

function table(): Record<string, Recorded> {
  return persona && data.personas[persona] ? data.personas[persona].routes : data.anon;
}

function paramsOf(key: string): URLSearchParams {
  const rest = key.slice(key.indexOf(' ') + 1).split(' @')[0];
  return new URLSearchParams(rest.includes('?') ? rest.slice(rest.indexOf('?') + 1) : '');
}

/** Zgodność parametrów: ta sama wartość liczy się podwójnie, zawieranie (wyszukiwanie po fragmencie) — pojedynczo. */
function score(want: URLSearchParams, got: URLSearchParams): number {
  let s = 0;
  for (const [k, v] of want) {
    const g = got.get(k);
    if (g === null) continue;
    if (g === v) s += 2;
    else if (v && g.toLowerCase().includes(v.toLowerCase())) s += 1;
  }
  return s;
}

/**
 * Nagranie dla żądania: dokładnie to samo, a dla odczytu — ta sama ścieżka z innymi parametrami (np. inny dzień
 * albo okres), z pierwszeństwem dla nagrania o najbardziej zgodnych parametrach.
 */
export function lookup(key: string): Recorded | undefined {
  const routes = table();
  if (routes[key]) return routes[key];
  if (data.anon[key]) return data.anon[key];
  const want = splitKey(key);
  if (want.method !== 'GET') return undefined;
  const wantParams = paramsOf(key);
  let best: { r: Recorded; s: number } | undefined;
  for (const [k, v] of Object.entries(routes)) {
    const got = splitKey(k);
    if (got.method !== 'GET' || got.path !== want.path || got.profile !== want.profile || v.s >= 400) continue;
    const s = score(wantParams, paramsOf(k));
    if (!best || s > best.s) best = { r: v, s };
  }
  return best?.r;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export function bytesOf(r: Recorded): Uint8Array {
  if (r.b64 !== undefined) {
    const bin = atob(r.b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(r.b ?? '');
}

function toResponse(r: Recorded): Response {
  // 204/304 nie mogą mieć treści
  const body = r.s === 204 || r.s === 304 ? null : (bytesOf(r) as BodyInit);
  return new Response(body, { status: r.s, headers: { 'content-type': r.t || 'application/json' } });
}

function personaByEmail(email: string): string | undefined {
  const e = email.trim().toLowerCase();
  return Object.entries(data.personas).find(([, p]) => p.email === e)?.[0];
}

function meOf(id: string): Recorded | undefined {
  return data.personas[id]?.routes['GET /api/auth/me'];
}

async function handle(method: string, url: string, headers: Headers, body: BodyInit | null | undefined): Promise<Response> {
  const path = new URL(url, 'http://preview.local').pathname;
  if (method === 'POST' && path === '/api/auth/login') {
    let email = '';
    try {
      email = (JSON.parse(String(body ?? '{}')) as { email?: string }).email ?? '';
    } catch {
      /* brak treści */
    }
    const id = personaByEmail(email);
    const me = id ? meOf(id) : undefined;
    if (!id || !me) return json(401, { error: 'preview_account', message: 'Preview account' });
    persona = id;
    writeState(id);
    return toResponse(me);
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    persona = null;
    writeState(null);
    return json(200, { ok: true });
  }
  if (method === 'GET' && path === '/api/auth/me') {
    const me = persona ? meOf(persona) : undefined;
    if (me) return toResponse(me);
    return toResponse(data.anon['GET /api/auth/me'] ?? { s: 200, t: 'application/json', b: '{"authenticated":false}' });
  }
  const key = recordKey(method, url, headers.get('X-Eternal-Profile'));
  const hit = lookup(key);
  if (hit) return toResponse(hit);
  if (method !== 'GET') return json(403, { error: 'preview_read_only', message: 'Preview is read-only' });
  return json(404, { error: 'preview_not_recorded', message: 'Not recorded in the preview' });
}

function isApi(url: string): boolean {
  const p = new URL(url, location.href).pathname;
  return p.startsWith('/api/') || p.startsWith('/fhir/');
}

/** Lokalna kopia pliku z nagrania (blob:) — dla wycinków z oryginału i okna podglądu pliku. */
export function fileRecord(href: string): Recorded | undefined {
  const r = lookup(recordKey('GET', href));
  return r && r.s < 400 ? r : undefined;
}

export async function fileUrl(href: string): Promise<string> {
  const r = fileRecord(href);
  if (!r) throw new Error('preview_not_recorded');
  return URL.createObjectURL(new Blob([bytesOf(r) as BlobPart], { type: r.t }));
}

/** Czas od chwili nagrania — daty w danych pokazowych zgadzają się z „dziś” w aplikacji. */
function shiftClock(recordedAt: string): void {
  const offset = new Date(recordedAt).getTime() - Date.now();
  if (!Number.isFinite(offset) || Math.abs(offset) < 60_000) return;
  const Real = Date;
  const Shifted = function (this: unknown, ...args: unknown[]) {
    if (!new.target) return new Real(Real.now() + offset).toString();
    return args.length === 0 ? new Real(Real.now() + offset) : new (Real as unknown as new (...a: unknown[]) => Date)(...args);
  } as unknown as DateConstructor;
  Object.setPrototypeOf(Shifted, Real);
  (Shifted as unknown as { prototype: Date }).prototype = Real.prototype;
  Shifted.now = () => Real.now() + offset;
  window.Date = Shifted;
}

export function installShim(d: PreviewData): void {
  data = d;
  const saved = readState();
  persona = saved && d.personas[saved] ? saved : null;
  shiftClock(d.recordedAt);
  // na żywo (SSE) nie ma czego słuchać — realtime.ts pomija połączenie, gdy EventSource nie istnieje
  (window as unknown as { EventSource?: unknown }).EventSource = undefined;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!isApi(url)) return realFetch(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return handle(method, url, headers, init?.body);
  };
}
