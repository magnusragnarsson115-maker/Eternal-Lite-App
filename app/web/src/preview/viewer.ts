import { pdfjs } from '../lib/sourceImage';
import { bytesOf, fileRecord } from './shim';

/**
 * Okno z plikiem w podglądzie. Strona podglądu nie może pobierać plików ani otwierać nowych kart, więc PDF,
 * obraz albo tekst (CSV, ICS, FHIR) wyświetla się tutaj, w oknie nad aplikacją.
 */

const T = {
  pl: { title: 'Podgląd pliku', close: 'Zamknij', missing: 'Tego pliku nie ma w podglądzie. W aplikacji uruchomionej na serwerze pobiera się normalnie.', note: 'W podglądzie pliki nie pobierają się na urządzenie, więc pokazuję je tutaj.', loading: 'Wczytywanie…' },
  en: { title: 'File preview', close: 'Close', missing: 'This file is not part of the preview. It downloads normally in the app running on a server.', note: 'Files do not download in the preview, so they are shown here.', loading: 'Loading…' },
};

function texts() {
  return document.documentElement.lang === 'en' ? T.en : T.pl;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const n = Object.assign(document.createElement(tag), props);
  for (const c of children) n.append(c);
  return n;
}

function fileName(href: string): string {
  const path = new URL(href, 'http://preview.local').pathname;
  return decodeURIComponent(path.split('/').filter(Boolean).slice(-2).join(' / '));
}

async function renderPdf(bytes: Uint8Array, into: HTMLElement): Promise<void> {
  const m = await pdfjs();
  const doc = await m.getDocument({ data: bytes }).promise;
  into.replaceChildren();
  for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = el('canvas', { width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) });
    canvas.style.cssText = 'display:block;width:100%;height:auto;margin:0 0 12px;border:1px solid var(--border);border-radius:8px;background:#fff';
    canvas.setAttribute('aria-label', `${i} / ${doc.numPages}`);
    into.append(canvas);
    await page.render({ canvas, viewport }).promise;
  }
}

export function openFile(href: string): void {
  const tx = texts();
  const body = el('div', { className: 'modal-body' });
  const close = el('button', { type: 'button', className: 'btn secondary sm', textContent: tx.close });
  const dialog = el('dialog', { className: 'modal wide' }, [
    el('div', { className: 'modal-head' }, [el('h2', { textContent: `${tx.title}: ${fileName(href)}` }), close]),
    body,
  ]);
  dialog.setAttribute('aria-label', tx.title);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();

  const rec = fileRecord(href);
  if (!rec) {
    body.append(el('p', { textContent: tx.missing }));
    return;
  }
  body.append(el('p', { className: 'small muted', textContent: tx.note }));
  const content = el('div', { textContent: tx.loading });
  body.append(content);
  const bytes = bytesOf(rec);
  const type = rec.t.toLowerCase();
  if (type.includes('pdf')) {
    renderPdf(bytes, content).catch(() => (content.textContent = tx.missing));
  } else if (type.startsWith('image/')) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: rec.t }));
    content.replaceChildren(el('img', { src: url, alt: fileName(href) }));
  } else {
    const pre = el('pre', { className: 'mono small', textContent: new TextDecoder().decode(bytes) });
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:0';
    content.replaceChildren(pre);
  }
}

/** Linki do plików z API (`/api/...pdf`, CSV, ICS) otwierają okno podglądu zamiast pobierania. */
export function interceptFileLinks(): void {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      const href = a?.getAttribute('href') ?? '';
      if (!href.startsWith('/api/') && !href.startsWith('/fhir/')) return;
      e.preventDefault();
      e.stopPropagation();
      openFile(href);
    },
    true,
  );
}
