let csrfToken = '';
let activeProfile: string | undefined;
let onAuthLost: (() => void) | undefined;
let lastMutation = 0;

/** Czas ostatniej zmiany wykonanej przez tego użytkownika — do wyciszania komunikatów o własnych akcjach. */
export function msSinceOwnMutation(): number {
  return Date.now() - lastMutation;
}

export function setCsrfToken(token: string | undefined): void {
  csrfToken = token ?? '';
}

/** Profil, w którym działa opiekun (A24.2) — id zasobu Patient; undefined = własny profil. */
export function setApiProfile(id: string | undefined): void {
  activeProfile = id;
}

export function apiProfile(): string | undefined {
  return activeProfile;
}

/** Adres pliku (PDF, CSV, ICS) otwieranego linkiem — w trybie opiekuna z parametrem profilu. */
export function withProfile(url: string): string {
  if (!activeProfile) return url;
  return `${url}${url.includes('?') ? '&' : '?'}profile=${encodeURIComponent(activeProfile)}`;
}

export function setOnAuthLost(fn: () => void): void {
  onAuthLost = fn;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (activeProfile) headers['X-Eternal-Profile'] = activeProfile;
  if (method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
    lastMutation = Date.now();
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Network error');
  }
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const d = (typeof data === 'object' ? data : {}) as { error?: string; message?: string; details?: unknown };
    if (res.status === 401 && path !== '/api/auth/login') onAuthLost?.();
    throw new ApiError(res.status, d.error ?? `http_${res.status}`, d.message ?? res.statusText, d.details);
  }
  return data as T;
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
