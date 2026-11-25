import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '../i18n';

export interface Series {
  key: string;
  label: string;
  color: string; // zmienna CSS, np. var(--chart-line)
  values: (number | undefined)[];
}

/**
 * Wykres liniowy zmian w czasie: linie 2 px, znaczniki ≥ 8 px z obwódką w kolorze tła, siatka 1 px,
 * celownik z podpowiedzią (mysz i klawiatura). Bez stref „normy" — aplikacja nie ocenia pomiarów.
 */
export function TrendChart({ dates, series, unit, height = 220 }: { dates: string[]; series: Series[]; unit: string; height?: number }) {
  const { fmt, t } = useI18n();
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // szerokość układu współrzędnych = faktyczna szerokość w pikselach, dzięki czemu tekst osi ma stały rozmiar
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 44, r: 16, t: 12, b: 28 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== undefined));
  const { min, max, ticks } = useMemo(() => {
    if (!all.length) return { min: 0, max: 1, ticks: [0, 1] };
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const span = hi - lo;
    const step = niceStep(span / 4);
    const nlo = Math.floor((lo - span * 0.08) / step) * step;
    const nhi = Math.ceil((hi + span * 0.08) / step) * step;
    const tk: number[] = [];
    for (let v = nlo; v <= nhi + 1e-9; v += step) tk.push(Math.round(v * 100) / 100);
    return { min: nlo, max: nhi, ticks: tk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(all)]);

  const n = dates.length;
  const x = (i: number) => pad.l + (n <= 1 ? (width - pad.l - pad.r) / 2 : (i * (width - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);

  const path = (vals: (number | undefined)[]) =>
    vals.reduce((acc, v, i) => (v === undefined ? acc : `${acc}${acc && vals[i - 1] !== undefined ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`), '');

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setActive(best);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min((a ?? -1) + 1, n - 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max((a ?? n) - 1, 0));
    if (e.key === 'Escape') setActive(null);
  };

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(width / 90))));
  const tip = active !== null ? { left: `${(x(active) / width) * 100}%`, top: `${(Math.min(...series.map((s) => (s.values[active] !== undefined ? y(s.values[active]!) : height))) / height) * 100}%` } : null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {series.length > 1 && (
        <div className="chart-legend" aria-hidden>
          {series.map((s) => (
            <span key={s.key}>
              <i className="line-key" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('Wykres zmian w czasie. Użyj strzałek, aby odczytać wartości.')}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {fmt.number(v)}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={d + i} x={x(i)} y={height - 8} textAnchor="middle">
              {fmt.date(d).replace(/\s\d{4}$/, '')}
            </text>
          ) : null,
        )}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={height - pad.b} stroke="var(--border-strong)" strokeWidth={1} />}
        {series.map((s) => (
          <g key={s.key}>
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) =>
              v === undefined || (n > 20 && i !== n - 1 && i !== active) ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={i === active ? 5.5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ),
            )}
          </g>
        ))}
        {series.length <= 2 &&
          series.map((s) => {
            const last = [...s.values].reverse().findIndex((v) => v !== undefined);
            if (last < 0 || active !== null) return null;
            const i = n - 1 - last;
            return (
              <text key={`lbl-${s.key}`} x={Math.min(x(i) + 8, width - pad.r)} y={y(s.values[i]!) - 8} textAnchor="end" style={{ fill: 'var(--ink-2)', fontWeight: 650 }}>
                {fmt.number(s.values[i])}
              </text>
            );
          })}
      </svg>
      {active !== null && tip && (
        <div className="chart-tip" style={tip} role="status">
          <div className="k">{fmt.dateTime(dates[active])}</div>
          {series.map((s) => (
            <div key={s.key} className="row">
              <i className="line-key" style={{ background: s.color }} />
              <span className="v">
                {s.values[active] !== undefined ? fmt.number(s.values[active]) : '—'} {unit}
              </span>
              <span className="k">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}
