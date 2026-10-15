import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, ApiError } from './api';
import { getToken } from './secure';

/**
 * Pobranie PDF z serwera (z tokenem sesji) do prywatnej pamięci podręcznej aplikacji i otwarcie systemowego
 * arkusza „Udostępnij / Zapisz w plikach”. Dokument zawiera dane o zdrowiu, więc katalog jest czyszczony
 * przed każdym pobraniem i przy wylogowaniu — na telefonie zostaje najwyżej ostatni plik, w obszarze aplikacji.
 */

const dir = () => new Directory(Paths.cache, 'eternal-pdf');

export function clearDownloads(): void {
  try {
    const d = dir();
    if (d.exists) d.delete();
  } catch {
    // brak katalogu albo plik w użyciu — następne pobranie i tak go wyczyści
  }
}

export async function downloadAndSharePdf(path: string, fileName: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new ApiError(0, 'sharing_unavailable');
  clearDownloads();
  const d = dir();
  d.create({ intermediates: true, idempotent: true });
  const token = await getToken();
  let file: File;
  try {
    file = await File.downloadFileAsync(`${API_URL}${path}`, new File(d, fileName.replace(/[^\w.-]+/g, '_')), {
      headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      idempotent: true,
    });
  } catch (e) {
    const status = Number(/\b([45]\d\d)\b/.exec(String((e as Error)?.message ?? ''))?.[1] ?? 0);
    throw new ApiError(status, status === 401 ? 'unauthorized' : status ? 'download_failed' : 'network_error');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}
