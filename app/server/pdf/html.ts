/**
 * Wspólny układ dokumentów PDF i podglądów HTML. Szablony są wersjonowane — wersja trafia do stopki
 * każdego dokumentu (A18.1, D3: „wersjonowany szablon”).
 */

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 10pt; color: #14213d; margin: 0; line-height: 1.4; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  h2 { font-size: 12pt; margin: 6mm 0 2mm; border-bottom: 1px solid #c9d3e0; padding-bottom: 1mm; }
  h3 { font-size: 10.5pt; margin: 4mm 0 1mm; }
  .muted { color: #5b6577; }
  .small { font-size: 8.5pt; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f4e79; padding-bottom: 3mm; margin-bottom: 4mm; }
  .brand { font-weight: bold; color: #1f4e79; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  th, td { text-align: left; border-bottom: 1px solid #dde3ec; padding: 1.5mm 2mm; vertical-align: top; }
  th { background: #eef2f7; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .02em; }
  .num { text-align: right; white-space: nowrap; }
  .box { border: 1px solid #c9d3e0; border-radius: 2mm; padding: 3mm; margin: 3mm 0; }
  .warn { border-color: #d9a400; background: #fff8e1; }
  .ai { border-color: #6c4fd3; background: #f4f1ff; }
  .tag { display: inline-block; font-size: 7.5pt; padding: .3mm 1.5mm; border-radius: 1mm; background: #eef2f7; color: #334; }
  .tag.ai { background: #e7e1ff; color: #3d2a91; }
  .tag.unconfirmed { background: #fff1c2; color: #6b5200; }
  .src { color: #5b6577; font-size: 8pt; }
  ul { margin: 1mm 0 1mm 5mm; padding: 0; }
  li { margin: .5mm 0; }
  .chart { margin: 2mm 0 4mm; }
  .fiction { color: #a00; font-weight: bold; }
`;

export function documentHtml(input: {
  title: string;
  subtitle?: string;
  org?: string;
  meta?: [string, string][];
  body: string;
  templateVersion: string;
  demo?: boolean;
}): string {
  const meta = (input.meta ?? []).map(([k, v]) => `<div><span class="muted">${esc(k)}:</span> ${esc(v)}</div>`).join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(input.title)}</title><style>${CSS}</style></head><body>
  <div class="head"><div><div class="brand">${esc(input.org ?? 'Eternal')}</div><h1>${esc(input.title)}</h1>${input.subtitle ? `<div class="muted">${esc(input.subtitle)}</div>` : ''}</div>
  <div class="small" style="text-align:right">${meta}</div></div>
  ${input.demo ? '<div class="box warn small fiction">DANE FIKCYJNE — instancja demonstracyjna</div>' : ''}
  ${input.body}
  <p class="small muted" style="margin-top:8mm">Szablon: ${esc(input.templateVersion)} · wygenerowano ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC</p>
  </body></html>`;
}

/**
 * Wykres przebiegu wartości (SVG, bez JavaScriptu). Pas zakresu referencyjnego rysowany tylko wtedy,
 * gdy zakres pochodzi z dokumentu laboratorium (D3 — granica: bez własnych norm).
 */
export function lineChartSvg(points: { date: string; value: number }[], opts: { unit?: string; refLow?: number; refHigh?: number; width?: number; height?: number }): string {
  const w = opts.width ?? 520;
  const h = opts.height ?? 140;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 26;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const vals = sorted.map((p) => p.value);
  if (opts.refLow !== undefined) vals.push(opts.refLow);
  if (opts.refHigh !== undefined) vals.push(opts.refHigh);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const t0 = Date.parse(sorted[0].date);
  const t1 = Date.parse(sorted[sorted.length - 1].date);
  const x = (d: string) => (t1 === t0 ? padL + (w - padL - padR) / 2 : padL + ((Date.parse(d) - t0) / (t1 - t0)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
  const band =
    opts.refLow !== undefined || opts.refHigh !== undefined
      ? `<rect x="${padL}" y="${y(opts.refHigh ?? max)}" width="${w - padL - padR}" height="${Math.max(0, y(opts.refLow ?? min) - y(opts.refHigh ?? max))}" fill="#e6f2e6"/>`
      : '';
  const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = sorted
    .map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3" fill="#1f4e79"/><text x="${x(p.date).toFixed(1)}" y="${(y(p.value) - 6).toFixed(1)}" font-size="9" text-anchor="middle" fill="#14213d">${esc(String(p.value).replace('.', ','))}</text>`)
    .join('');
  const labels = sorted.map((p) => `<text x="${x(p.date).toFixed(1)}" y="${h - 8}" font-size="8.5" text-anchor="middle" fill="#5b6577">${esc(p.date.slice(0, 10))}</text>`).join('');
  const axis = `<line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#c9d3e0"/><text x="4" y="${padT + 8}" font-size="8.5" fill="#5b6577">${esc(opts.unit ?? '')}</text>
    <text x="${padL - 4}" y="${y(max - span * 0.1) + 3}" font-size="8" text-anchor="end" fill="#5b6577">${esc((max - span * 0.1).toFixed(1).replace('.', ','))}</text>
    <text x="${padL - 4}" y="${y(min + span * 0.1) + 3}" font-size="8" text-anchor="end" fill="#5b6577">${esc((min + span * 0.1).toFixed(1).replace('.', ','))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${band}${axis}<path d="${path}" fill="none" stroke="#1f4e79" stroke-width="1.6"/>${dots}${labels}</svg>`;
}

/**
 * Wykres odczytów w okresie (raport okresowy A4): oś czasu obejmuje cały okres, więc widać też dni bez odczytów.
 * Bez pasów norm i progów — aplikacja nie ocenia pomiarów. Wartości przy punktach tylko przy niewielkiej liczbie odczytów.
 */
export function periodChartSvg(
  series: { label: string; points: { at: string; value: number }[]; dashed?: boolean }[],
  opts: { unit: string; start: string; end: string; startLabel: string; endLabel: string; width?: number; height?: number },
): string {
  const w = opts.width ?? 640;
  const h = opts.height ?? 150;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const vals = series.flatMap((s) => s.points.map((p) => p.value));
  if (!vals.length) return '';
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;
  const t0 = Date.parse(opts.start);
  const t1 = Date.parse(opts.end);
  const x = (at: string) => padL + ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const total = series.reduce((n, s) => n + s.points.length, 0);
  const r = total > 60 ? 1.6 : 2.6;
  const lines = series
    .map((s) => {
      const pts = [...s.points].sort((a, b) => a.at.localeCompare(b.at));
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      const dots = pts.map((p) => `<circle cx="${x(p.at).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${r}" fill="${s.dashed ? '#fff' : '#1f4e79'}" stroke="#1f4e79" stroke-width="1"/>`).join('');
      const labels =
        total <= 14
          ? pts.map((p) => `<text x="${x(p.at).toFixed(1)}" y="${(y(p.value) - 5).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="#14213d">${esc(String(p.value).replace('.', ','))}</text>`).join('')
          : '';
      return `<path d="${d}" fill="none" stroke="#1f4e79" stroke-width="1.4"${s.dashed ? ' stroke-dasharray="4 3"' : ''}/>${dots}${labels}`;
    })
    .join('');
  const legend =
    series.length > 1
      ? series
          .map((s, i) => `<g transform="translate(${padL + i * 120},${h - 4})"><line x1="0" y1="-3" x2="16" y2="-3" stroke="#1f4e79" stroke-width="1.4"${s.dashed ? ' stroke-dasharray="4 3"' : ''}/><text x="20" y="0" font-size="8.5" fill="#5b6577">${esc(s.label)}</text></g>`)
          .join('')
      : '';
  const yTick = (v: number) => `<text x="${padL - 4}" y="${(y(v) + 3).toFixed(1)}" font-size="8" text-anchor="end" fill="#5b6577">${esc(String(Math.round(v * 10) / 10).replace('.', ','))}</text><line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" stroke="#eef2f7"/>`;
  const axis = `<line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#c9d3e0"/>
    <text x="4" y="${padT + 2}" font-size="8.5" fill="#5b6577">${esc(opts.unit)}</text>${yTick(min)}${yTick(max)}
    <text x="${padL}" y="${h - padB + 12}" font-size="8.5" fill="#5b6577">${esc(opts.startLabel)}</text>
    <text x="${w - padR}" y="${h - padB + 12}" font-size="8.5" text-anchor="end" fill="#5b6577">${esc(opts.endLabel)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${axis}${lines}${legend}</svg>`;
}
