/**
 * Obraz strony oryginału do wycinków przy odczytanych polach (A2.3). PDF renderuje pdf.js w przeglądarce
 * (plik już jest u użytkownika, nic nie wychodzi poza aplikację); zdjęcie — zwykły obraz. Strony są
 * zapamiętywane w obrębie sesji widoku, żeby kilkanaście pól nie renderowało tej samej strony wiele razy.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

// wersja „legacy” — z polyfillami dla starszych przeglądarek (np. starsze telefony seniorów); nowa wersja
// wymaga funkcji JavaScript dostępnych dopiero w najnowszych przeglądarkach
type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | undefined;
const docs = new Map<string, Promise<PDFDocumentProxy>>();
const canvases = new Map<string, Promise<HTMLCanvasElement>>();
const MAX_CACHED = 12;

function pdfjs(): Promise<PdfJs> {
  lib ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJs>, import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
    m.GlobalWorkerOptions.workerSrc = worker.default;
    return m;
  });
  return lib;
}

function remember(key: string, make: () => Promise<HTMLCanvasElement>): Promise<HTMLCanvasElement> {
  const hit = canvases.get(key);
  if (hit) return hit;
  if (canvases.size >= MAX_CACHED) canvases.delete(canvases.keys().next().value as string);
  const p = make().catch((err) => {
    canvases.delete(key);
    throw err;
  });
  canvases.set(key, p);
  return p;
}

/** Strona PDF jako płótno w skali 2 (czytelny wycinek na ekranach o wysokiej gęstości). */
export function pdfPage(url: string, pageNo: number): Promise<HTMLCanvasElement> {
  return remember(`${url}#${pageNo}`, async () => {
    const m = await pdfjs();
    if (!docs.has(url)) docs.set(url, m.getDocument({ url, withCredentials: true }).promise);
    const doc = await docs.get(url)!;
    const page = await doc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  });
}

export function imagePage(url: string): Promise<HTMLCanvasElement> {
  return remember(url, async () => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas;
  });
}
