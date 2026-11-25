import Constants from 'expo-constants';
import { getToken } from './secure';

/** Adres serwera: EXPO_PUBLIC_API_URL (profil EAS) albo extra.apiUrl z app.json. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

let onUnauthorized: (() => void) | undefined;
let profileId: string | undefined;

/** Profil, w którym działa opiekun (A24.2) — nagłówek X-Eternal-Profile w każdym żądaniu. */
export function setApiProfile(id: string | undefined): void {
  profileId = id;
}

export function profileHeader(): Record<string, string> {
  return profileId ? { 'X-Eternal-Profile': profileId } : {};
}
/** Sesja wygasła albo została odwołana z innego urządzenia — aplikacja wraca do logowania. */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown, init: { token?: string; form?: FormData } = {}): Promise<T> {
  const token = init.token ?? (await getToken());
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...profileHeader(),
        ...(body !== undefined && !init.form ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  const json = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => undefined) : undefined;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, (json as { error?: string } | undefined)?.error ?? 'internal_error');
  }
  return json as T;
}

export const get = <T>(path: string) => request<T>('GET', path);
export const post = <T>(path: string, body?: unknown, token?: string) => request<T>('POST', path, body ?? {}, { token });
export const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {});
export const del = <T>(path: string) => request<T>('DELETE', path);

/** Wysyłka pliku (zdjęcie dokumentu, PDF) — pole „kind” przed plikiem, jak oczekuje serwer. */
export function upload<T>(path: string, file: { uri: string; name: string; type: string }, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  // React Native przyjmuje obiekt { uri, name, type } jako plik w FormData
  form.append('file', file as unknown as Blob);
  return request<T>('POST', path, undefined, { form });
}

/** Adres pliku do pobrania z tokenem w nagłówku nie zadziała w przeglądarce systemowej — pliki otwieramy w aplikacji. */
export const fileUrl = (path: string) => `${API_URL}${path}`;
