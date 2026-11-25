import type { VitalKind } from '../fhir/constants.js';
import { config } from '../config.js';
import { addDays, formatLocal, isoWeekday, localDate, zonedToUtc } from '../lib/time.js';
import { badRequest } from '../lib/util.js';
import { documentHtml, esc, periodChartSvg } from '../pdf/html.js';
import { listMeasurements, type MeasurementView } from './observations.js';
import { isConfirmed, patientLabFacts, SOURCE_PL, type LabFact } from './patientData.js';
import { listPatientAppointments } from './scheduling.js';

/**
 * Raport okresowy pacjenta (A4.1 tydzień, A4.2 miesiąc/kwartał/własny zakres) i pulpit faktów (A3.1).
 * Wyłącznie fakty: odczyty z datą i źródłem, liczba, najniższa i najwyższa wartość, średnia arytmetyczna
 * z opisaną metodą. Bez porównań z normą, bez trendów „rośnie/spada”, bez wyróżnień — granica MDR (COMPLIANCE §1).
 */

export const PERIOD_REPORT_VERSION = 'period-report/2026-10-1';

export type PeriodKind = 'week' | 'month' | 'quarter' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Pierwszy i ostatni dzień okresu (włącznie), daty kalendarzowe w strefie pacjenta. */
  from: string;
  to: string;
  /** Granice w UTC: [startUtc, endUtc). */
  startUtc: string;
  endUtc: string;
  label: string;
  /** Okres jeszcze trwa — dane do chwili wygenerowania. */
  partial: boolean;
  timezone: string;
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const QUARTERS = ['I', 'II', 'III', 'IV'];
const MAX_CUSTOM_DAYS = 366;

const plDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1–12
const pad = (n: number) => String(n).padStart(2, '0');
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Granice okresu w strefie czasowej pacjenta (tydzień od poniedziałku, miesiąc i kwartał kalendarzowy). */
export function periodBounds(kind: PeriodKind, opts: { anchor?: string; from?: string; to?: string }, timeZone = config.clinic.timezone, now = new Date()): Period {
  const today = localDate(now, timeZone);
  let from: string;
  let to: string;
  let label: string;
  if (kind === 'custom') {
    if (!isDate(opts.from) || !isDate(opts.to)) throw badRequest('period_invalid');
    if (opts.from > opts.to) throw badRequest('period_invalid');
    if ((Date.parse(opts.to) - Date.parse(opts.from)) / 86_400_000 + 1 > MAX_CUSTOM_DAYS) throw badRequest('period_too_long', String(MAX_CUSTOM_DAYS));
    from = opts.from;
    to = opts.to;
    label = `${plDate(from)} – ${plDate(to)}`;
  } else {
    const anchor = opts.anchor ?? today;
    if (!isDate(anchor)) throw badRequest('period_invalid');
    const y = Number(anchor.slice(0, 4));
    const m = Number(anchor.slice(5, 7));
    if (kind === 'week') {
      from = addDays(anchor, 1 - isoWeekday(anchor));
      to = addDays(from, 6);
      label = `tydzień ${plDate(from)} – ${plDate(to)}`;
    } else if (kind === 'month') {
      from = `${y}-${pad(m)}-01`;
      to = `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`;
      label = `${MONTHS[m - 1]} ${y}`;
    } else {
      const q = Math.floor((m - 1) / 3);
      from = `${y}-${pad(q * 3 + 1)}-01`;
      to = `${y}-${pad(q * 3 + 3)}-${pad(lastDayOfMonth(y, q * 3 + 3))}`;
      label = `${QUARTERS[q]} kwartał ${y}`;
    }
  }
  if (from > today) throw badRequest('period_in_future');
  return {
    kind,
    from,
    to,
    startUtc: zonedToUtc(from, '00:00', timeZone).toISOString(),
    endUtc: zonedToUtc(addDays(to, 1), '00:00', timeZone).toISOString(),
    label,
    partial: to >= today,
    timezone: timeZone,
  };
}

// --- statystyki opisowe ------------------------------------------------------------------------------------

export interface SeriesStat {
  key: 'value' | 'systolic' | 'diastolic';
  label: string;
  min: number;
  max: number;
  /** Średnia arytmetyczna, zaokrąglona do 0,1 — tylko przy co najmniej 2 odczytach. */
  mean?: number;
}

export interface GroupPoint {
  id: string;
  at: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
  corrected?: boolean;
  note?: string;
  /** Inny odczyt z tej samej minuty (A1.7) — uwzględniony w liczbach, wskazany w tabeli. */
  conflict?: boolean;
}

export interface MeasurementGroup {
  /** rodzaj|jednostka|źródło|urządzenie — odczyty z różnych źródeł, urządzeń i jednostek nie są łączone. */
  id: string;
  kind: VitalKind;
  label: string;
  unit: string;
  source: string;
  sourceLabel: string;
  device?: string;
  count: number;
  firstAt: string;
  lastAt: string;
  stats: SeriesStat[];
  conflicts: number;
  points: GroupPoint[];
}

export const METHOD_TEXT =
  'Odczyty grupujemy według rodzaju pomiaru, jednostki i źródła (wpis ręczny, urządzenie, import z pliku) — odczytów z różnych źródeł, urządzeń i jednostek nie łączymy. Dla każdej grupy podajemy liczbę odczytów, najniższą i najwyższą wartość oraz średnią arytmetyczną wszystkich odczytów z okresu (zaokrągloną do 0,1; liczoną przy co najmniej 2 odczytach). Odczyty oznaczone jako rozbieżne (inny odczyt z tej samej minuty) są uwzględnione i wskazane w tabeli. Wyniki badań pochodzą z dokumentów laboratoriów i są pokazane bez przeliczeń. Raport nie porównuje wartości z normami i niczego nie ocenia.';

const KIND_LABEL: Record<VitalKind, string> = {
  bp: 'Ciśnienie tętnicze',
  heartRate: 'Tętno',
  weight: 'Masa ciała',
  height: 'Wzrost',
  temperature: 'Temperatura ciała',
  spo2: 'Saturacja (SpO₂)',
  glucose: 'Glukoza we krwi',
};
const KIND_ORDER: VitalKind[] = ['bp', 'heartRate', 'weight', 'height', 'temperature', 'spo2', 'glucose'];

export const sourceLabel = (source: string): string => SOURCE_PL[source.split(':')[0]] ?? source;

const round1 = (v: number) => Math.round(v * 10) / 10;

function stat(key: SeriesStat['key'], label: string, values: number[]): SeriesStat {
  return {
    key,
    label,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.length >= 2 ? round1(values.reduce((a, b) => a + b, 0) / values.length) : undefined,
  };
}

export function groupMeasurements(items: MeasurementView[]): MeasurementGroup[] {
  const groups = new Map<string, MeasurementView[]>();
  for (const m of items) {
    const id = [m.kind, m.unit, m.source, m.device ?? ''].join('|');
    groups.set(id, [...(groups.get(id) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) => a.effective.localeCompare(b.effective));
      const first = sorted[0];
      const stats =
        first.kind === 'bp'
          ? [
              stat('systolic', 'skurczowe', sorted.map((m) => m.systolic).filter((v): v is number => v !== undefined)),
              stat('diastolic', 'rozkurczowe', sorted.map((m) => m.diastolic).filter((v): v is number => v !== undefined)),
            ]
          : [stat('value', 'wartość', sorted.map((m) => m.value).filter((v): v is number => v !== undefined))];
      const points: GroupPoint[] = sorted.map((m) => ({
        id: m.id,
        at: m.effective,
        value: m.value,
        systolic: m.systolic,
        diastolic: m.diastolic,
        corrected: m.corrected || undefined,
        note: m.note,
        conflict: m.flags?.some((f) => f.type === 'conflict') || undefined,
      }));
      return {
        id,
        kind: first.kind,
        label: KIND_LABEL[first.kind] ?? first.kind,
        unit: first.unit,
        source: first.source,
        sourceLabel: sourceLabel(first.source),
        device: first.device,
        count: sorted.length,
        firstAt: first.effective,
        lastAt: sorted[sorted.length - 1].effective,
        stats: stats.filter((s) => Number.isFinite(s.min)),
        conflicts: points.filter((p) => p.conflict).length,
        points,
      };
    })
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count || a.sourceLabel.localeCompare(b.sourceLabel));
}

// --- raport --------------------------------------------------------------------------------------------------

export interface ReportAppointment {
  start: string;
  serviceName?: string;
  practitionerName?: string;
  status: string;
}

export interface PeriodReport {
  templateVersion: string;
  generatedAt: string;
  period: Period;
  patient: { name: string };
  groups: MeasurementGroup[];
  /** Wyniki potwierdzone z datą w okresie (z dokumentów laboratorium). */
  labs: LabFact[];
  /** Pominięte odczyty maszynowe, których nikt nie potwierdził — nie są faktem. */
  labsUnconfirmed: number;
  appointments: ReportAppointment[];
  method: string;
  empty: boolean;
}

export async function buildPeriodReport(patientRef: string, patientName: string, period: Period, now = new Date()): Promise<PeriodReport> {
  const [measurements, labs, appointments] = await Promise.all([listMeasurements(patientRef), patientLabFacts(patientRef), listPatientAppointments(patientRef)]);
  const inPeriod = (iso: string) => iso >= period.startUtc && iso < period.endUtc && Date.parse(iso) <= now.getTime();
  const sameInstant = (iso: string) => new Date(iso).toISOString();
  const groups = groupMeasurements(measurements.filter((m) => m.effective && inPeriod(sameInstant(m.effective))));
  const labsInPeriod = labs.filter((f) => f.date >= period.from && f.date <= period.to);
  const confirmed = labsInPeriod.filter(isConfirmed).sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.date.localeCompare(b.date));
  const visits = appointments
    .filter((a) => !['cancelled', 'entered-in-error', 'proposed', 'pending', 'waitlist'].includes(a.status) && inPeriod(sameInstant(a.start)))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ start: a.start, serviceName: a.serviceName, practitionerName: a.practitionerName, status: a.status }));
  return {
    templateVersion: PERIOD_REPORT_VERSION,
    generatedAt: now.toISOString(),
    period,
    patient: { name: patientName },
    groups,
    labs: confirmed,
    labsUnconfirmed: labsInPeriod.length - confirmed.length,
    appointments: visits,
    method: METHOD_TEXT,
    empty: groups.length === 0 && confirmed.length === 0 && visits.length === 0,
  };
}

// --- pulpit faktów (A3.1) ------------------------------------------------------------------------------------

export interface LatestFacts {
  measurements: { kind: VitalKind; label: string; effective: string; value?: number; systolic?: number; diastolic?: number; unit: string; source: string; sourceLabel: string; device?: string }[];
  lastLab?: { date: string; count: number; source: LabFact['source'] };
  unconfirmedLabs: number;
}

/** Ostatni odczyt każdego rodzaju i data ostatnich potwierdzonych wyników — bez oceny, z datą i źródłem. */
export async function latestFacts(patientRef: string): Promise<LatestFacts> {
  const [measurements, labs] = await Promise.all([listMeasurements(patientRef), patientLabFacts(patientRef)]);
  const latest = new Map<VitalKind, MeasurementView>();
  for (const m of measurements) {
    const cur = latest.get(m.kind);
    if (!cur || m.effective > cur.effective) latest.set(m.kind, m);
  }
  const confirmed = labs.filter(isConfirmed);
  const lastDate = confirmed.reduce((d, f) => (f.date > d ? f.date : d), '');
  return {
    measurements: KIND_ORDER.filter((k) => latest.has(k)).map((k) => {
      const m = latest.get(k)!;
      return { kind: k, label: KIND_LABEL[k], effective: m.effective, value: m.value, systolic: m.systolic, diastolic: m.diastolic, unit: m.unit, source: m.source, sourceLabel: sourceLabel(m.source), device: m.device };
    }),
    lastLab: lastDate ? { date: lastDate, count: confirmed.filter((f) => f.date === lastDate).length, source: confirmed.find((f) => f.date === lastDate)!.source } : undefined,
    unconfirmedLabs: labs.length - confirmed.length,
  };
}

// --- PDF ----------------------------------------------------------------------------------------------------

const num = (v: number | undefined) => (v === undefined ? '—' : String(v).replace('.', ','));
const STATUS_PL: Record<string, string> = { booked: 'zaplanowana', arrived: 'w placówce', 'checked-in': 'w placówce', fulfilled: 'odbyta', noshow: 'nieobecność' };

function timeLocal(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function groupValue(g: MeasurementGroup, p: GroupPoint): string {
  return g.kind === 'bp' ? `${num(p.systolic)}/${num(p.diastolic)}` : num(p.value);
}

function groupTitle(g: MeasurementGroup): string {
  return `${g.label} · ${g.unit} · ${g.sourceLabel}${g.device ? ` (${g.device})` : ''}`;
}

export function periodReportHtml(r: PeriodReport, org: string): string {
  const tz = r.period.timezone;
  const summary = r.groups.length
    ? `<table><thead><tr><th>Pomiar</th><th class="num">Odczyty</th><th>Pierwszy – ostatni</th><th class="num">Najniższa</th><th class="num">Najwyższa</th><th class="num">Średnia</th></tr></thead><tbody>${r.groups
        .map((g) =>
          g.stats
            .map(
              (s, i) =>
                `<tr><td>${i === 0 ? esc(groupTitle(g)) : ''}${g.stats.length > 1 ? ` <span class="muted">${esc(s.label)}</span>` : ''}</td><td class="num">${i === 0 ? g.count : ''}</td><td class="small">${i === 0 ? `${esc(timeLocal(g.firstAt, tz))} – ${esc(timeLocal(g.lastAt, tz))}` : ''}</td><td class="num">${num(s.min)}</td><td class="num">${num(s.max)}</td><td class="num">${s.mean === undefined ? '<span class="muted small">1 odczyt</span>' : num(s.mean)}</td></tr>`,
            )
            .join(''),
        )
        .join('')}</tbody></table>`
    : '<p class="muted">Brak pomiarów w tym okresie.</p>';

  const groupSections = r.groups
    .map((g) => {
      const series =
        g.kind === 'bp'
          ? [
              { label: 'skurczowe', points: g.points.filter((p) => p.systolic !== undefined).map((p) => ({ at: p.at, value: p.systolic! })) },
              { label: 'rozkurczowe', points: g.points.filter((p) => p.diastolic !== undefined).map((p) => ({ at: p.at, value: p.diastolic! })), dashed: true },
            ]
          : [{ label: g.label, points: g.points.filter((p) => p.value !== undefined).map((p) => ({ at: p.at, value: p.value! })) }];
      const chart =
        g.count >= 2
          ? `<div class="chart">${periodChartSvg(series, { unit: g.unit, start: r.period.startUtc, end: r.period.endUtc, startLabel: plDate(r.period.from), endLabel: plDate(r.period.to) })}</div>`
          : '';
      const rows = g.points
        .map(
          (p) =>
            `<tr><td>${esc(timeLocal(p.at, tz))}</td><td class="num">${esc(groupValue(g, p))}</td><td class="small">${[p.corrected ? 'poprawiony przez pacjenta' : '', p.conflict ? 'inny odczyt z tej samej minuty' : '', p.note ?? ''].filter(Boolean).map(esc).join(' · ')}</td></tr>`,
        )
        .join('');
      return `<h3>${esc(groupTitle(g))}</h3>${chart}<table><thead><tr><th>Data i godzina</th><th class="num">Wartość (${esc(g.unit)})</th><th>Uwagi</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');

  const labs = r.labs.length
    ? `<table><thead><tr><th>Data</th><th>Badanie</th><th class="num">Wynik</th><th>Jednostka</th><th>Zakres z dokumentu</th><th>Oznaczenie lab.</th><th>Źródło</th></tr></thead><tbody>${r.labs
        .map(
          (f) =>
            `<tr><td>${esc(plDate(f.date))}</td><td>${esc(f.name)}${f.loinc ? ` <span class="src">LOINC ${esc(f.loinc)}</span>` : ''}</td><td class="num">${esc(f.value.replace('.', ','))}</td><td>${esc(f.unit ?? '')}</td><td>${esc(f.range ?? '—')}</td><td>${esc(f.labFlag ?? '')}</td><td class="src">${esc(SOURCE_PL[f.source])}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="muted">Brak potwierdzonych wyników badań z datą w tym okresie.</p>';

  const visits = r.appointments.length
    ? `<table><thead><tr><th>Termin</th><th>Usługa</th><th>Lekarz</th><th>Status</th></tr></thead><tbody>${r.appointments
        .map((a) => `<tr><td>${esc(formatLocal(a.start, tz))}</td><td>${esc(a.serviceName ?? '—')}</td><td>${esc(a.practitionerName ?? '—')}</td><td>${esc(STATUS_PL[a.status] ?? a.status)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="muted">Brak wizyt w tym okresie.</p>';

  const body = `
    ${r.period.partial ? `<div class="box warn small">Okres jeszcze trwa — raport obejmuje dane zapisane do ${esc(timeLocal(r.generatedAt, tz))}.</div>` : ''}
    <p class="small muted">Raport zawiera wyłącznie dane zapisane w aplikacji: pomiary z datą i źródłem, potwierdzone wyniki badań z dokumentów laboratoriów i wizyty. Niczego nie ocenia i nie zastępuje porady lekarza. W nagłym zagrożeniu życia dzwoń 112.</p>
    <h2>Podsumowanie pomiarów</h2>
    ${summary}
    ${groupSections ? `<h2>Odczyty</h2>${groupSections}` : ''}
    <h2>Wyniki badań</h2>
    ${labs}
    ${r.labsUnconfirmed ? `<p class="small">Pominięto ${r.labsUnconfirmed} odczyt(ów) maszynowych, których nikt nie potwierdził — nie są faktem; sprawdź je w aplikacji.</p>` : ''}
    <h2>Wizyty</h2>
    ${visits}
    <h2>Metoda</h2>
    <p class="small">${esc(r.method)}</p>`;

  return documentHtml({
    title: 'Raport okresowy — moje dane',
    subtitle: r.patient.name,
    org,
    meta: [
      ['Okres', r.period.label],
      ['Zakres', `${plDate(r.period.from)} – ${plDate(r.period.to)}`],
      ['Strefa czasowa', tz],
      ['Wygenerowano', timeLocal(r.generatedAt, tz)],
    ],
    body,
    templateVersion: r.templateVersion,
    demo: config.demoMode,
  });
}
