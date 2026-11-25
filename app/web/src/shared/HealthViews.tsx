import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronRight, FileText } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { get, qs } from '../api';
import { useI18n } from '../i18n';
import { Badge, Empty, Modal, QueryError, Skeleton } from '../ui';
import type { AvatarData } from './Avatar3D';

/**
 * Wspólne widoki rundy 5 dla panelu lekarza i pacjenta: Medical Snapshot (sekcje rozwijane), szczegół wyniku
 * z pochodzeniem, „Co się zmieniło” i oś czasu z filtrami. Strzałki ↑/↓ wyłącznie z oznaczenia laboratorium.
 */

export interface SnapItem {
  label: string;
  detail?: string;
  date?: string;
  source?: string;
  ref?: string;
}
export interface ResultRef {
  key: string;
  name: string;
  group: string;
  value: string;
  unit?: string;
  date: string;
  range?: string;
  labFlag?: string;
  arrow?: '↑' | '↓';
  source: string;
  points: number;
  confirmed: boolean;
}
export interface ParamRow {
  kind: string;
  label: string;
  value: string;
  unit: string;
  date: string;
  source: string;
  previous?: { value: string; date: string };
  count30: number;
}
export type TimelineCategory = 'meds' | 'tests' | 'symptoms' | 'visits' | 'measurements' | 'hospital' | 'documents' | 'diagnoses';
export interface TimelineEvent {
  id: string;
  date: string;
  category: TimelineCategory;
  title: string;
  detail?: string;
  source?: string;
  ref?: string;
}
export interface Snapshot {
  generatedAt: string;
  patient: { id: string; name: string; birthDate?: string; age?: number; gender?: string; eternalId: string };
  sharing: { vault: boolean; measurements: boolean };
  problems: { active: SnapItem[]; historical: SnapItem[] };
  medications: { current: SnapItem[]; historical: SnapItem[] };
  allergies: { reported: 'yes' | 'no' | 'unknown'; text?: string; source?: string; date?: string };
  results: { latest: ResultRef[]; flagged: ResultRef[]; total: number };
  parameters: ParamRow[];
  wearables: { days: number; source?: string; lastDate?: string; sleepAvg7?: number; sleepAvgPrev7?: number; stepsAvg7?: number; stepsAvgPrev7?: number };
  documents: SnapItem[];
  events: TimelineEvent[];
  alerts: { kind: string; text: string }[];
  sources: { label: string; count: number }[];
}
export interface Change {
  kind: string;
  text: string;
  from?: string;
  to?: string;
  delta?: string;
  date?: string;
  ref?: string;
  labFlag?: string;
}
export interface WhatChanged {
  since: string;
  sinceSource: 'last-visit' | 'default-90-days' | 'chosen';
  filter: { bpSystolic?: number; bpDiastolic?: number; glucose?: number };
  items: Change[];
  note: string;
}
export interface SnapshotResponse {
  snapshot: Snapshot;
  avatar: AvatarData;
  whatChanged: WhatChanged;
}
interface ResultDetail {
  key: string;
  name: string;
  loinc?: string;
  group: string;
  points: {
    date: string;
    value: string;
    unit?: string;
    range?: string;
    labFlag?: string;
    laboratory?: string;
    trustLabel: string;
    source: { kind: string; ref: string; label: string; binaryId?: string; intakeId?: string; line?: number; text?: string };
    confirmations: { who: string; activity: string; at?: string }[];
    corrections: { field: string; from?: string; to?: string; who: string; at: string }[];
  }[];
}

const UP = /^(H|HH|HU|A)$/;
const DOWN = /^(L|LL|LU)$/;
const arrowOf = (flag?: string): '↑' | '↓' | undefined => (flag && UP.test(flag) ? '↑' : flag && DOWN.test(flag) ? '↓' : undefined);

/** Nazwa poprawionego pola odczytu (rejestr poprawek OCR). */
export function fieldLabel(field: string, t: (s: string) => string): string {
  return ({ name: t('nazwa'), value: t('wartość'), unit: t('jednostka'), range: t('zakres'), status: t('odrzucenie pola') } as Record<string, string>)[field] ?? field;
}

export function LabArrow({ arrow, flag }: { arrow?: '↑' | '↓'; flag?: string }) {
  const { t } = useI18n();
  if (!arrow) return null;
  return (
    <span className="lab-arrow" title={t('Oznaczenie laboratorium: {f}', { f: flag ?? '' })}>
      {arrow === '↑' ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />}
      <span className="sr-only">{t('oznaczenie laboratorium {f}', { f: flag ?? '' })}</span>
    </span>
  );
}

function Section({ title, count, children, open }: { title: string; count?: number; children: ReactNode; open?: boolean }) {
  return (
    <details className="snap-section" open={open}>
      <summary>
        <ChevronRight size={16} aria-hidden className="snap-chevron" />
        <span className="grow">{title}</span>
        {count !== undefined && <span className="count-pill tabular">{count}</span>}
      </summary>
      <div className="snap-body">{children}</div>
    </details>
  );
}

function Items({ items, empty }: { items: SnapItem[]; empty: string }) {
  const { fmt } = useI18n();
  if (!items.length) return <p className="muted small">{empty}</p>;
  return (
    <ul className="snap-items">
      {items.map((i, n) => (
        <li key={i.ref ?? n}>
          <strong>{i.label}</strong>
          {i.detail && <span className="muted"> · {i.detail}</span>}
          <span className="small muted" style={{ display: 'block' }}>
            {[i.date ? fmt.date(i.date) : undefined, i.source].filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

const minutes = (m?: number) => (m === undefined ? '—' : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);

/** Medical Snapshot: skondensowany, rozwijany; kliknięcie wyniku → szczegół z pochodzeniem. */
export function SnapshotSections({ s, onResult }: { s: Snapshot; onResult: (key: string) => void }) {
  const { t, fmt } = useI18n();
  const resultRow = (r: ResultRef) => (
    <li key={r.key}>
      <button type="button" className="snap-result" onClick={() => onResult(r.key)}>
        <span className="grow">
          {r.name}
          <span className="small muted" style={{ display: 'block' }}>
            {fmt.date(r.date)} · {r.source}
            {!r.confirmed ? ` · ${t('niepotwierdzone')}` : ''}
          </span>
        </span>
        <span className="tabular nowrap">
          <strong>{r.value}</strong> {r.unit} <LabArrow arrow={r.arrow} flag={r.labFlag} />
        </span>
        <ChevronRight size={16} aria-hidden />
      </button>
    </li>
  );
  return (
    <div className="snap">
      <Section title={t('Problemy zdrowotne')} count={s.problems.active.length} open>
        <h4 className="snap-sub">{t('Aktywne')}</h4>
        <Items items={s.problems.active} empty={t('Brak rozpoznań w dokumentacji placówki.')} />
        {s.problems.historical.length > 0 && (
          <>
            <h4 className="snap-sub">{t('Historyczne')}</h4>
            <Items items={s.problems.historical} empty="" />
          </>
        )}
      </Section>
      <Section title={t('Leki')} count={s.medications.current.length} open>
        <h4 className="snap-sub">{t('Aktualne')}</h4>
        <Items items={s.medications.current} empty={t('Brak leków na liście.')} />
        {s.medications.historical.length > 0 && (
          <>
            <h4 className="snap-sub">{t('Historyczne')}</h4>
            <Items items={s.medications.historical} empty="" />
          </>
        )}
      </Section>
      <Section title={t('Alergie')} open>
        {s.allergies.reported === 'unknown' ? (
          <p className="muted small">{t('Brak informacji o uczuleniach.')}</p>
        ) : s.allergies.reported === 'no' ? (
          <p>{t('Pacjent podaje, że nie ma uczuleń na leki.')}</p>
        ) : (
          <p>
            <strong>{s.allergies.text || t('Pacjent podaje uczulenia — bez szczegółów.')}</strong>
          </p>
        )}
        {s.allergies.source && <p className="small muted">{[s.allergies.source, s.allergies.date ? fmt.date(s.allergies.date) : undefined].filter(Boolean).join(' · ')}</p>}
      </Section>
      <Section title={t('Wyniki — najnowsze')} count={s.results.total} open>
        {s.results.latest.length ? <ul className="snap-results">{s.results.latest.map(resultRow)}</ul> : <p className="muted small">{t('Brak wyników.')}</p>}
      </Section>
      {s.results.flagged.length > 0 && (
        <Section title={t('Wyniki z oznaczeniem laboratorium')} count={s.results.flagged.length}>
          <p className="small muted">{t('Oznaczenie (↑/↓) przepisane z dokumentu laboratorium — aplikacja go nie wylicza.')}</p>
          <ul className="snap-results">{s.results.flagged.map(resultRow)}</ul>
        </Section>
      )}
      <Section title={t('Parametry')} count={s.parameters.length} open>
        {!s.sharing.measurements ? (
          <p className="muted small">{t('Pacjent nie udostępnia pomiarów domowych.')}</p>
        ) : s.parameters.length ? (
          <div className="param-grid">
            {s.parameters.map((p) => (
              <div key={p.kind} className="param-tile">
                <div className="small muted">{t(p.label)}</div>
                <div className="tabular">
                  <strong>{p.value}</strong> {p.unit}
                </div>
                <div className="small muted">
                  {fmt.date(p.date)}
                  {p.previous ? ` · ${t('poprzednio')} ${p.previous.value}` : ''}
                </div>
                <div className="small muted">{t('{n} pomiarów w 30 dni', { n: p.count30 })}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">{t('Brak pomiarów.')}</p>
        )}
      </Section>
      <Section title={t('Urządzenia (sen, aktywność)')} count={s.wearables.days}>
        {s.wearables.days ? (
          <div className="param-grid">
            <div className="param-tile">
              <div className="small muted">{t('Średni sen — 7 dni')}</div>
              <strong className="tabular">{minutes(s.wearables.sleepAvg7)}</strong>
              <div className="small muted">
                {t('poprzednie 7 dni')}: {minutes(s.wearables.sleepAvgPrev7)}
              </div>
            </div>
            <div className="param-tile">
              <div className="small muted">{t('Średnio kroków — 7 dni')}</div>
              <strong className="tabular">{s.wearables.stepsAvg7 !== undefined ? fmt.number(Math.round(s.wearables.stepsAvg7), 0) : '—'}</strong>
              <div className="small muted">
                {t('poprzednie 7 dni')}: {s.wearables.stepsAvgPrev7 !== undefined ? fmt.number(Math.round(s.wearables.stepsAvgPrev7), 0) : '—'}
              </div>
            </div>
            <div className="param-tile">
              <div className="small muted">{t('Źródło')}</div>
              <strong>{s.wearables.source ?? '—'}</strong>
              <div className="small muted">{s.wearables.lastDate ? fmt.date(s.wearables.lastDate) : ''}</div>
            </div>
          </div>
        ) : (
          <p className="muted small">{t('Brak danych z urządzeń (Apple Health, Health Connect, Withings, Validic).')}</p>
        )}
        <p className="small muted">{t('Liczby policzone przez urządzenie; aplikacja ich nie ocenia. Zmienność rytmu serca (HRV) — gdy urządzenie ją przekaże.')}</p>
      </Section>
      <Section title={t('Dokumenty')} count={s.documents.length}>
        <Items items={s.documents} empty={t('Brak dokumentów.')} />
      </Section>
      <Section title={t('Zdarzenia')} count={s.events.length}>
        <TimelineList items={s.events} />
      </Section>
      <Section title={t('Źródła danych')} count={s.sources.length}>
        <ul className="snap-items">
          {s.sources.map((x) => (
            <li key={x.label}>
              {x.label} <span className="muted tabular">· {x.count}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** Szczegół wyniku: data → laboratorium → dokument źródłowy → poprzednie wartości → kto potwierdził → poprawki. */
export function ResultDetailModal({ url, fileBase, onClose }: { url: string | null; fileBase?: string; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['result-detail', url], queryFn: () => get<ResultDetail>(url!), enabled: !!url });
  return (
    <Modal open={!!url} onClose={onClose} title={q.data?.name ?? t('Wynik')} wide>
      {q.isLoading ? (
        <Skeleton count={3} height={48} />
      ) : q.isError ? (
        <QueryError error={q.error} />
      ) : q.data ? (
        <div className="stack">
          <p className="small muted">
            {q.data.group}
            {q.data.loinc ? ` · LOINC ${q.data.loinc}` : ''}
          </p>
          <ol className="provenance">
            {q.data.points.map((p, i) => (
              <li key={i} className={i === 0 ? 'latest' : ''}>
                <div className="row-between" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="tabular">
                    <strong>{p.value}</strong> {p.unit} <LabArrow arrow={arrowOf(p.labFlag)} flag={p.labFlag} />
                  </span>
                  <span className="small muted">{fmt.date(p.date)}</span>
                </div>
                <dl className="prov-dl">
                  <dt>{t('Zakres z dokumentu')}</dt>
                  <dd>{p.range ?? '—'}</dd>
                  <dt>{t('Laboratorium')}</dt>
                  <dd>{p.laboratory ?? '—'}</dd>
                  <dt>{t('Dokument źródłowy')}</dt>
                  <dd>
                    {p.source.binaryId && fileBase ? (
                      <a href={p.source.kind === 'intake' ? `/api/staff/intake/${p.source.intakeId}/file` : `${fileBase}/${p.source.binaryId}`} target="_blank" rel="noreferrer">
                        <FileText size={13} aria-hidden /> {p.source.label}
                      </a>
                    ) : (
                      p.source.label
                    )}
                    {p.source.line ? ` · ${t('w. {n}', { n: p.source.line })}` : ''}
                    {p.source.text && <div className="small mono muted">„{p.source.text}”</div>}
                  </dd>
                  <dt>{t('Status')}</dt>
                  <dd>{t(p.trustLabel)}</dd>
                  {p.confirmations.length > 0 && (
                    <>
                      <dt>{t('Kto i kiedy')}</dt>
                      <dd>
                        <ul className="plain">
                          {p.confirmations.map((c, j) => (
                            <li key={j}>
                              {c.activity}: <strong>{c.who}</strong> {c.at ? <span className="muted small">· {fmt.dateTime(c.at)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {p.corrections.length > 0 && (
                    <>
                      <dt>{t('Poprawki odczytu')}</dt>
                      <dd>
                        <ul className="plain">
                          {p.corrections.map((c, j) => (
                            <li key={j}>
                              <Badge kind="info">{t('poprawione')}</Badge> {fieldLabel(c.field, t)}: <span className="mono">{c.from ?? '—'}</span> → <span className="mono">{c.to ?? '—'}</span> · {c.who} ·{' '}
                              <span className="muted small">{fmt.dateTime(c.at)}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ol>
          <p className="small muted">{t('Poprzednie wartości — od najnowszej. Aplikacja nie ocenia wyników.')}</p>
        </div>
      ) : null}
    </Modal>
  );
}

export function WhatChangedList({ wc, extra }: { wc: WhatChanged; extra?: ReactNode }) {
  const { t, fmt } = useI18n();
  return (
    <div className="stack">
      <p className="small muted">
        {wc.sinceSource === 'last-visit' ? t('Od ostatniej wizyty ({d})', { d: fmt.date(wc.since) }) : wc.sinceSource === 'chosen' ? t('Od {d}', { d: fmt.date(wc.since) }) : t('Z ostatnich 90 dni (brak wcześniejszej wizyty)')}
      </p>
      {wc.items.length ? (
        <ul className="wc-list">
          {wc.items.map((c, i) => (
            <li key={i} data-kind={c.kind}>
              <span className="wc-dot" aria-hidden />
              <span className="grow">
                {c.text} {c.labFlag && <LabArrow arrow={arrowOf(c.labFlag)} flag={c.labFlag} />}
                {c.delta && c.kind === 'lab-change' && <span className="muted tabular"> ({c.delta})</span>}
              </span>
              {c.date && <span className="small muted nowrap">{fmt.date(c.date)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title={t('Bez zmian w danych')} />
      )}
      {extra}
      <p className="small muted">{t(wc.note)}</p>
    </div>
  );
}

export const TIMELINE_CATS: TimelineCategory[] = ['meds', 'tests', 'symptoms', 'visits', 'measurements', 'hospital', 'documents', 'diagnoses'];

function useCatLabel() {
  const { t } = useI18n();
  return (c: TimelineCategory) =>
    ({ meds: t('leki'), tests: t('badania'), symptoms: t('objawy'), visits: t('wizyty'), measurements: t('pomiary'), hospital: t('hospitalizacje'), documents: t('dokumenty'), diagnoses: t('rozpoznania') })[c];
}

export function TimelineList({ items }: { items: TimelineEvent[] }) {
  const { t, fmt, locale } = useI18n();
  const cat = useCatLabel();
  const monthFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pl-PL', { month: 'long', year: 'numeric' });
  if (!items.length) return <p className="muted small">{t('Brak zdarzeń.')}</p>;
  let month = '';
  return (
    <ol className="htl">
      {items.map((e) => {
        const m = e.date.slice(0, 7);
        const head = m !== month;
        month = m;
        return (
          <li key={e.id} data-cat={e.category}>
            {head && <div className="htl-month">{monthFmt.format(new Date(`${m}-15T12:00:00Z`))}</div>}
            <div className="htl-row">
              <span className="htl-date small muted tabular">{fmt.date(e.date)}</span>
              <span className="htl-cat" data-cat={e.category}>
                {cat(e.category)}
              </span>
              <span className="grow">
                {e.title}
                {e.detail && (
                  <span className="small muted" style={{ display: 'block' }}>
                    {e.detail}
                  </span>
                )}
                {e.source && (
                  <span className="small muted" style={{ display: 'block' }}>
                    {t('źródło')}: {e.source}
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Oś czasu zdrowia z filtrami (leki / badania / objawy / wizyty / pomiary / hospitalizacje / dokumenty / rozpoznania). */
export function HealthTimeline({ url }: { url: string }) {
  const { t } = useI18n();
  const cat = useCatLabel();
  const [cats, setCats] = useState<TimelineCategory[]>([]);
  const q = useQuery({ queryKey: ['health-timeline', url, cats.join(',')], queryFn: () => get<{ items: TimelineEvent[] }>(`${url}${qs({ categories: cats.length ? cats.join(',') : undefined })}`) });
  const toggle = (c: TimelineCategory) => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <div className="stack">
      <div className="chip-row" role="group" aria-label={t('Filtry osi czasu')}>
        <button type="button" className={`filter-chip ${cats.length === 0 ? 'on' : ''}`} aria-pressed={cats.length === 0} onClick={() => setCats([])}>
          {t('wszystko')}
        </button>
        {TIMELINE_CATS.map((c) => (
          <button key={c} type="button" className={`filter-chip ${cats.includes(c) ? 'on' : ''}`} data-cat={c} aria-pressed={cats.includes(c)} onClick={() => toggle(c)}>
            {cat(c)}
          </button>
        ))}
      </div>
      {q.isLoading ? <Skeleton count={4} height={36} /> : q.isError ? <QueryError error={q.error} /> : <TimelineList items={q.data!.items} />}
    </div>
  );
}
