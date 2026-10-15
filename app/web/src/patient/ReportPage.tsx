import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileDown, Sheet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api';
import { errorMessage } from '../errors';
import { addDaysIso, useI18n } from '../i18n';
import { Badge, Button, Card, Empty, Notice, PageHead, Segmented, Skeleton, TextField } from '../ui';
import { TrendChart } from '../ui/TrendChart';

/**
 * Raport okresowy (A4.1 tydzień, A4.2 miesiąc/kwartał/własny zakres): karta podsumowania, rozwijana tabela
 * odczytów ze źródłem, wykres i PDF. Liczby opisowe z podaną metodą; bez porównań z normą i bez ocen.
 */

type PeriodKind = 'week' | 'month' | 'quarter' | 'custom';

interface Stat {
  key: 'value' | 'systolic' | 'diastolic';
  min: number;
  max: number;
  mean?: number;
}

interface GroupPoint {
  id: string;
  at: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
  corrected?: boolean;
  note?: string;
  conflict?: boolean;
}

interface Group {
  id: string;
  kind: string;
  unit: string;
  source: string;
  device?: string;
  count: number;
  firstAt: string;
  lastAt: string;
  stats: Stat[];
  conflicts: number;
  points: GroupPoint[];
}

interface Lab {
  id?: string;
  name: string;
  loinc?: string;
  date: string;
  value: string;
  unit?: string;
  range?: string;
  labFlag?: string;
  source: 'patient' | 'clinic';
}

interface Report {
  templateVersion: string;
  generatedAt: string;
  period: { kind: PeriodKind; from: string; to: string; partial: boolean; timezone: string };
  groups: Group[];
  labs: Lab[];
  labsUnconfirmed: number;
  appointments: { start: string; serviceName?: string; practitionerName?: string; status: string }[];
  empty: boolean;
}

export const KIND_LABEL: Record<string, string> = {
  bp: 'Ciśnienie tętnicze',
  heartRate: 'Tętno',
  weight: 'Masa ciała',
  height: 'Wzrost',
  temperature: 'Temperatura ciała',
  spo2: 'Saturacja (SpO₂)',
  glucose: 'Glukoza we krwi',
};
const SOURCE_LABEL: Record<string, string> = { manual: 'wpis ręczny', bluetooth: 'urządzenie Bluetooth', withings: 'Withings', import: 'import z pliku', rpm: 'telemonitoring' };
const STAT_LABEL: Record<Stat['key'], string> = { value: 'wartość', systolic: 'skurczowe', diastolic: 'rozkurczowe' };
const VISIT_STATUS: Record<string, string> = { booked: 'zaplanowana', arrived: 'w placówce', 'checked-in': 'w placówce', fulfilled: 'odbyta', noshow: 'nieobecność' };

export const sourceText = (s: string, t: (x: string) => string) => t(SOURCE_LABEL[s.split(':')[0]] ?? s);

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftMonths(date: string, months: number): string {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

function reportQuery(kind: PeriodKind, anchor: string, from: string, to: string): string {
  const p = new URLSearchParams({ period: kind });
  if (kind === 'custom') {
    p.set('from', from);
    p.set('to', to);
  } else p.set('anchor', anchor);
  return p.toString();
}

export function ReportPage() {
  const { t, fmt } = useI18n();
  const today = localToday();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState({ from: addDaysIso(today, -29), to: today });
  const [draft, setDraft] = useState(custom);
  const qs = reportQuery(kind, anchor, custom.from, custom.to);
  const q = useQuery({ queryKey: ['report', qs], queryFn: () => get<Report>(`/api/me/report?${qs}`) });
  const r = q.data;

  const shift = (dir: -1 | 1) => setAnchor((a) => (kind === 'week' ? addDaysIso(a, 7 * dir) : shiftMonths(a, (kind === 'month' ? 1 : 3) * dir)));
  const kindLabel: Record<PeriodKind, string> = { week: t('Tydzień'), month: t('Miesiąc'), quarter: t('Kwartał'), custom: t('Własny zakres') };
  const value = (g: Group, p: GroupPoint) => (g.kind === 'bp' ? `${p.systolic}/${p.diastolic}` : fmt.number(p.value));

  return (
    <div className="stack-lg">
      <PageHead
        title={t('Raport okresowy')}
        sub={t('Twoje pomiary, potwierdzone wyniki badań i wizyty w wybranym okresie — do zapisania jako PDF i pokazania lekarzowi. Raport niczego nie ocenia.')}
        back={{ to: '/', label: t('Start') }}
      />

      <Card>
        <div className="stack">
          <Segmented label={t('Okres raportu')} value={kind} onChange={(k) => { setKind(k); setAnchor(today); }} options={(['week', 'month', 'quarter', 'custom'] as const).map((k) => ({ value: k, label: kindLabel[k] }))} />
          {kind === 'custom' ? (
            <form
              className="btn-row"
              style={{ alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                setCustom(draft);
              }}
            >
              <TextField label={t('Od')} type="date" value={draft.from} max={today} onChange={(e) => setDraft({ ...draft, from: e.target.value })} required />
              <TextField label={t('Do')} type="date" value={draft.to} max={today} onChange={(e) => setDraft({ ...draft, to: e.target.value })} required />
              <Button type="submit" variant="secondary">
                {t('Pokaż')}
              </Button>
            </form>
          ) : (
            <div className="row-between">
              <Button variant="ghost" icon={<ChevronLeft size={20} />} onClick={() => shift(-1)} aria-label={t('Poprzedni okres')} />
              <strong style={{ textAlign: 'center' }} aria-live="polite">
                {r ? `${kindLabel[kind]}: ${fmt.date(r.period.from)} – ${fmt.date(r.period.to)}` : '…'}
              </strong>
              <Button variant="ghost" icon={<ChevronRight size={20} />} onClick={() => shift(1)} disabled={!r || r.period.partial} aria-label={t('Następny okres')} />
            </div>
          )}
          {r && (
            <div className="btn-row">
              <a className="btn" href={`/api/me/report.pdf?${qs}`} download>
                <FileDown size={18} /> {t('Pobierz raport PDF')}
              </a>
              <a className="btn secondary" href={`/api/me/export.csv?from=${r.period.from}&to=${r.period.to}`} download>
                <Sheet size={18} /> {t('Dane z okresu (CSV)')}
              </a>
            </div>
          )}
        </div>
      </Card>

      {q.isLoading && <Skeleton height={140} count={2} />}
      {q.isError && <Notice kind="danger">{errorMessage(q.error, t)}</Notice>}

      {r && (
        <>
          {r.period.partial && <Notice>{t('Okres jeszcze trwa — raport obejmuje dane zapisane do {d}.', { d: fmt.dateTime(r.generatedAt) })}</Notice>}
          {r.empty && (
            <Empty title={t('Brak danych w tym okresie')}>
              {t('W tym okresie nie ma pomiarów, potwierdzonych wyników ani wizyt. Wybierz inny okres albo')} <Link to="/pomiary">{t('dodaj pomiar')}</Link>.
            </Empty>
          )}

          {r.groups.length > 0 && (
            <Card title={t('Podsumowanie pomiarów')}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('Pomiar')}</th>
                      <th scope="col" className="num">{t('Odczyty')}</th>
                      <th scope="col" className="num">{t('Najniższa')}</th>
                      <th scope="col" className="num">{t('Najwyższa')}</th>
                      <th scope="col" className="num">{t('Średnia')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.groups.flatMap((g) =>
                      g.stats.map((s, i) => (
                        <tr key={`${g.id}-${s.key}`}>
                          <td>
                            {i === 0 && (
                              <>
                                <strong>{t(KIND_LABEL[g.kind] ?? g.kind)}</strong>
                                <span className="small muted" style={{ display: 'block' }}>
                                  {g.unit} · {sourceText(g.source, t)}
                                  {g.device ? ` (${g.device})` : ''}
                                </span>
                              </>
                            )}
                            {g.stats.length > 1 && <span className="small">{t(STAT_LABEL[s.key])}</span>}
                          </td>
                          <td className="num">{i === 0 ? g.count : ''}</td>
                          <td className="num">{fmt.number(s.min)}</td>
                          <td className="num">{fmt.number(s.max)}</td>
                          <td className="num">{s.mean === undefined ? <span className="small muted">{t('1 odczyt')}</span> : fmt.number(s.mean)}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <details className="explain" style={{ marginTop: 8 }}>
                <summary className="small">{t('Jak liczymy')}</summary>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {t('Odczyty grupujemy według rodzaju pomiaru, jednostki i źródła (wpis ręczny, urządzenie, import z pliku) — odczytów z różnych źródeł, urządzeń i jednostek nie łączymy. Dla każdej grupy podajemy liczbę odczytów, najniższą i najwyższą wartość oraz średnią arytmetyczną wszystkich odczytów z okresu (zaokrągloną do 0,1; liczoną przy co najmniej 2 odczytach). Odczyty oznaczone jako rozbieżne (inny odczyt z tej samej minuty) są uwzględnione i wskazane w tabeli. Wyniki badań pochodzą z dokumentów laboratoriów i są pokazane bez przeliczeń. Raport nie porównuje wartości z normami i niczego nie ocenia.')}
                </p>
              </details>
            </Card>
          )}

          {r.groups.map((g) => (
            <Card
              key={g.id}
              title={
                <h2>
                  {t(KIND_LABEL[g.kind] ?? g.kind)} <span className="small muted">· {sourceText(g.source, t)}{g.device ? ` (${g.device})` : ''}</span>
                </h2>
              }
            >
              {g.count >= 2 && (
                <TrendChart
                  dates={g.points.map((p) => p.at)}
                  unit={g.unit}
                  height={180}
                  series={
                    g.kind === 'bp'
                      ? [
                          { key: 'sys', label: t('Skurczowe'), color: 'var(--chart-line)', values: g.points.map((p) => p.systolic) },
                          { key: 'dia', label: t('Rozkurczowe'), color: 'var(--chart-line-2)', values: g.points.map((p) => p.diastolic) },
                        ]
                      : [{ key: 'v', label: t(KIND_LABEL[g.kind] ?? g.kind), color: 'var(--chart-line)', values: g.points.map((p) => p.value) }]
                  }
                />
              )}
              <details className="explain">
                <summary className="small">{t('Pokaż odczyty i źródła ({n})', { n: g.count })}</summary>
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">{t('Data i godzina')}</th>
                        <th scope="col" className="num">{t('Wartość')} ({g.unit})</th>
                        <th scope="col">{t('Uwagi')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.points.map((p) => (
                        <tr key={p.id}>
                          <td className="nowrap">{fmt.dateTime(p.at)}</td>
                          <td className="num">{value(g, p)}</td>
                          <td className="small">
                            {p.corrected && <Badge>{t('poprawiony')}</Badge>} {p.conflict && <Badge kind="warn">{t('inny odczyt z tej samej minuty')}</Badge>} {p.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
          ))}

          <Card title={t('Wyniki badań')}>
            {r.labs.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>{t('Brak potwierdzonych wyników badań z datą w tym okresie.')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('Data')}</th>
                      <th scope="col">{t('Badanie')}</th>
                      <th scope="col" className="num">{t('Wynik')}</th>
                      <th scope="col">{t('Zakres z dokumentu')}</th>
                      <th scope="col">{t('Oznaczenie lab.')}</th>
                      <th scope="col">{t('Źródło')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.labs.map((f, i) => (
                      <tr key={f.id ?? i}>
                        <td className="nowrap">{fmt.date(f.date)}</td>
                        <td>{f.name}</td>
                        <td className="num">
                          {f.value} {f.unit}
                        </td>
                        <td>{f.range ?? '—'}</td>
                        <td>{f.labFlag ?? ''}</td>
                        <td className="small">{f.source === 'clinic' ? t('placówka') : t('mój dokument')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.labsUnconfirmed > 0 && (
              <p className="small" style={{ marginBottom: 0 }}>
                {t('Pominięto niepotwierdzone odczyty maszynowe: {n} — nie są faktem, dopóki ich nie sprawdzisz.', { n: r.labsUnconfirmed })} <Link to="/dokumenty">{t('Moje dokumenty')}</Link>
              </p>
            )}
          </Card>

          <Card title={t('Wizyty')}>
            {r.appointments.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>{t('Brak wizyt w tym okresie.')}</p>
            ) : (
              <ul className="list">
                {r.appointments.map((a) => (
                  <li key={a.start} className="list-item">
                    <span className="grow">
                      <span className="list-title" style={{ display: 'block' }}>{fmt.dateTime(a.start)}</span>
                      <span className="list-sub">
                        {[a.serviceName, a.practitionerName].filter(Boolean).join(' · ')} · {t(VISIT_STATUS[a.status] ?? a.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="small muted">{t('Szablon raportu: {v}', { v: r.templateVersion })}</p>
        </>
      )}
    </div>
  );
}
