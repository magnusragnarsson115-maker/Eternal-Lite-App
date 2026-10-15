import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { get } from '../api';
import { useI18n } from '../i18n';
import { Notice } from '../ui';

/**
 * Objaśnienia badań i jednostek ze słownika (A2.4). Opis mówi, co jest mierzone — nie ocenia wartości.
 * Widoczne po zatwierdzeniu przez lekarza; w instancji pokazowej jako projekt z wyraźnym oznaczeniem.
 */

export interface ExplanationsData {
  version: string;
  hash: string;
  approval?: { by: string; at: string };
  visible: boolean;
  draft: boolean;
  tests: Record<string, { key: string; name: string; text: string }>;
  units: Record<string, string>;
  fields: { range: string; flag: string; loinc: string };
}

const UNIT_ALIASES: Record<string, string> = {
  'tys/ul': '10*3/ul',
  'mln/ul': '10*6/ul',
  'g/100ml': 'g/dl',
  'mg/100ml': 'mg/dl',
  'ml/min/1.73m2': 'ml/min/1.73_m2',
  'ml/min/1,73m2': 'ml/min/1.73_m2',
  'mm/godz': 'mm/h',
  'mm/1h': 'mm/h',
  sek: 's',
  'miu/l': 'uiu/ml',
  'mj/l': 'uiu/ml',
  'mu/l': 'uiu/ml',
  'j/l': 'u/l',
  'iu/l': 'u/l',
};

/** Ta sama normalizacja co na serwerze (server/labs/explanations.ts — unitKey). */
export function unitKey(unit: string): string {
  const k = unit
    .trim()
    .toLowerCase()
    .replace(/µ|μ/g, 'u')
    .replace(/[[\]{}\s]/g, '')
    .replace(/\^/g, '*')
    .replace(/x10/g, '10');
  return UNIT_ALIASES[k] ?? k;
}

export function useExplanations() {
  return useQuery({ queryKey: ['explanations'], queryFn: () => get<ExplanationsData>('/api/public/explanations'), staleTime: 60 * 60_000 });
}

function Footer({ data }: { data: ExplanationsData }) {
  const { t, fmt } = useI18n();
  return (
    <p className="small muted" style={{ margin: '6px 0 0' }}>
      {data.approval
        ? t('Opis ogólny ze słownika ({v}), zatwierdził(a): {by}, {d}. Nie dotyczy Twojego wyniku i go nie ocenia — wynik omawia z Tobą lekarz.', { v: data.version, by: data.approval.by, d: fmt.date(data.approval.at) })
        : t('Projekt opisu ze słownika ({v}) — czeka na zatwierdzenie przez lekarza. Nie dotyczy Twojego wyniku i go nie ocenia.', { v: data.version })}
    </p>
  );
}

/** Jedno badanie: „Co mierzy to badanie?” (np. przy karcie na osi czasu). */
export function TestExplanation({ loinc, unit }: { loinc?: string; unit?: string }) {
  const { t } = useI18n();
  const q = useExplanations();
  const d = q.data;
  const test = loinc ? d?.tests[loinc] : undefined;
  if (!d?.visible || !test) return null;
  const unitText = unit ? d.units[unitKey(unit)] : undefined;
  return (
    <details className="explain">
      <summary className="small">
        <BookOpen size={14} aria-hidden /> {t('Co mierzy to badanie?')}
      </summary>
      <div className="small" style={{ marginTop: 6 }}>
        {d.draft && <strong>{t('Projekt — czeka na zatwierdzenie przez lekarza.')} </strong>}
        <p style={{ margin: 0 }}>{test.text}</p>
        {unitText && (
          <p style={{ margin: '4px 0 0' }}>
            {t('Jednostka')} {unit}: {unitText}
          </p>
        )}
        <Footer data={d} />
      </div>
    </details>
  );
}

/** Wszystkie badania z jednego wyniku + objaśnienie kolumn dokumentu (szczegóły wyniku). */
export function ExplanationsPanel({ items }: { items: { name: string; loinc?: string; unit?: string }[] }) {
  const { t } = useI18n();
  const q = useExplanations();
  const d = q.data;
  if (!d?.visible) return null;
  const seen = new Set<string>();
  const rows = items.filter((i) => i.loinc && d.tests[i.loinc] && !seen.has(i.loinc) && seen.add(i.loinc));
  return (
    <details className="explain card" style={{ padding: 14 }}>
      <summary>
        <BookOpen size={16} aria-hidden /> {t('Co oznaczają te badania, jednostki i kolumny')}
      </summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {d.draft && <Notice kind="warn">{t('Projekt opisów — czeka na zatwierdzenie przez lekarza. W instancji pokazowej pokazujemy go z tym oznaczeniem.')}</Notice>}
        {rows.length > 0 && (
          <dl className="kv explain-list">
            {rows.map((i) => {
              const unitText = i.unit ? d.units[unitKey(i.unit)] : undefined;
              return (
                <div key={i.loinc} style={{ display: 'contents' }}>
                  <dt>{i.name}</dt>
                  <dd>
                    {d.tests[i.loinc!].text}
                    {unitText && (
                      <span className="small muted" style={{ display: 'block' }}>
                        {t('Jednostka')} {i.unit}: {unitText}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        <div className="small">
          <p style={{ margin: '0 0 4px' }}>{d.fields.range}</p>
          <p style={{ margin: '0 0 4px' }}>{d.fields.flag}</p>
          <p style={{ margin: 0 }}>{d.fields.loinc}</p>
        </div>
        <Footer data={d} />
      </div>
    </details>
  );
}
