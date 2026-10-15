import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { imagePage, pdfPage } from '../lib/sourceImage';

/**
 * Wycinek oryginału z podświetloną linią, z której odczytano pole (A2.3: „odczyt obok fragmentu oryginału”).
 * Gdy dokument nie podaje położenia linii (np. OCR bez układu strony), komponent nic nie pokazuje —
 * zostaje tekst wiersza i przycisk „Zobacz oryginał”.
 */
export function SourceSnippet({ fileUrl, contentType, page, box, text }: { fileUrl: string; contentType: string; page: number; box?: [number, number, number, number]; text: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const supported = !!box && (contentType === 'application/pdf' || contentType.startsWith('image/'));

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const src = contentType === 'application/pdf' ? await pdfPage(fileUrl, page) : await imagePage(fileUrl);
        if (cancelled || !ref.current) return;
        const W = src.width;
        const H = src.height;
        const [x0, y0, x1, y1] = box!;
        const lineH = Math.max((y1 - y0) * H, 8);
        const sx = Math.max(0, Math.floor(x0 * W - 0.02 * W));
        const ex = Math.min(W, Math.ceil(x1 * W + 0.02 * W));
        const sy = Math.max(0, Math.floor(y0 * H - lineH * 0.9));
        const ey = Math.min(H, Math.ceil(y1 * H + lineH * 0.9));
        const c = ref.current;
        c.width = Math.max(1, ex - sx);
        c.height = Math.max(1, ey - sy);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(src, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0e6f78';
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = accent;
        ctx.fillRect(x0 * W - sx - 3, y0 * H - sy - 2, (x1 - x0) * W + 6, (y1 - y0) * H + 4);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 * W - sx - 3, y0 * H - sy - 2, (x1 - x0) * W + 6, (y1 - y0) * H + 4);
        setState('ok');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, fileUrl, contentType, page, box]);

  if (!supported || state === 'error') return null;
  return (
    <figure className="source-snippet" style={{ margin: '6px 0 0' }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={t('Fragment oryginału, strona {p}: {t}', { p: page, t: text })}
        style={{ display: state === 'ok' ? 'block' : 'none', maxWidth: '100%', height: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
      />
      {state === 'loading' && <span className="small muted">{t('Ładuję fragment oryginału…')}</span>}
      <figcaption className="small muted">{t('Fragment oryginału, strona {p} — sprawdź, czy wartość się zgadza.', { p: page })}</figcaption>
    </figure>
  );
}
