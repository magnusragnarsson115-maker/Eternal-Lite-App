import { api } from '../api';

/** Wysyłka pliku (multipart). Pola tekstowe przed plikiem — serwer czyta je razem z plikiem. */
export function uploadFile<T>(path: string, file: Blob, filename: string, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', file, filename);
  return api<T>(path, { method: 'POST', form });
}

export function download(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
