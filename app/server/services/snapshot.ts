import type { Condition, DocumentReference, Observation, Patient, Provenance, QuestionnaireResponse } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { getDb } from '../db.js';
import { ETERNAL, TRUST } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { readPref, writePref } from '../lib/prefs.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../tenancy.js';
import { listActivity, type ActivityDay } from './activity.js';
import { hasConsent } from './consents.js';
import { buildFacts, finalize, OTHER, testKey, type FactPoint, type FactRow } from './facts.js';
import { activeGrantsFor } from './grants.js';
import { KIND_LABEL } from './intake.js';
import { listJournal, type JournalEntry } from './journal.js';
import { listMedications, type MedicationView } from './medications.js';
import { listMeasurements, listMeasurementsForStaff, type MeasurementView } from './observations.js';
import { staffOrgId } from './orgs.js';
import { patientLabFacts } from './patientData.js';
import { responsesForPatient, readableAnswers } from './questionnaires.js';
import { listPatientAppointments, type AppointmentView } from './scheduling.js';
import { latestHealthSurveys } from './surveys.js';

/**
 * Medical Snapshot (A5.2), oś czasu zdrowia, „Co się zmieniło od ostatniej wizyty” i dane avatara (runda 5).
 *
 * Wszystko to są ZESTAWIENIA faktów z dokumentacji: liczby, daty i źródła. Aplikacja nie ocenia stanu zdrowia —
 * strzałka ↑/↓ pojawia się wyłącznie wtedy, gdy oznaczenie wydrukowało laboratorium; różnice w „Co się zmieniło”
 * to arytmetyka (poprzednia → obecna wartość); próg wyróżnienia pomiarów ustawia lekarz dla siebie (filtr
 * wyświetlania), a nie aplikacja. Avatar pokazuje, GDZIE i KIEDY są dane, nigdy „czy jest dobrze”.
 */

// --- wspólny model danych pacjenta -------------------------------------------------------------------------

export interface DocItem {
  ref: string;
  kind: string;
  title: string;
  date: string;
  source: 'clinic' | 'patient';
  binaryId?: string;
}

export interface PatientData {
  patientRef: string;
  name: string;
  birthDate?: string;
  gender?: string;
  identityVerified?: boolean;
  labs: FactRow[];
  /** null — pacjent nie udostępnia pomiarów tej placówce. */
  measurements: MeasurementView[] | null;
  activity: ActivityDay[] | null;
  meds: MedicationView[];
  conditions: { id: string; code?: string; display: string; status: string; onset?: string; recorded?: string; recorder?: string }[];
  appointments: AppointmentView[];
  documents: DocItem[];
  journal: JournalEntry[] | null;
  allergies: { reported: 'yes' | 'no' | 'unknown'; text?: string; source?: string; date?: string };
  sharing: { vault: boolean; measurements: boolean };
}

function patientName(p: Patient): string {
  const n = p.name?.[0];
  return n ? `${(n.given ?? []).join(' ')} ${n.family ?? ''}`.trim() : '—';
}

function conditionView(c: Condition) {
  return {
    id: c.id ?? '',
    code: c.code?.coding?.[0]?.code,
    display: c.code?.text ?? c.code?.coding?.[0]?.display ?? '',
    status: c.clinicalStatus?.coding?.[0]?.code ?? 'active',
    onset: c.onsetDateTime,
    recorded: c.recordedDate,
    recorder: c.recorder?.display,
  };
}

function allergiesFrom(answers: { question: string; answer: string }[], source: string, date?: string): PatientData['allergies'] | undefined {
  const yes = answers.find((a) => /uczulen/i.test(a.question) && !/jakie|na jakie/i.test(a.question));
  const list = answers.find((a) => /na jakie|jakie leki|uczulenia — lista|lista uczuleń/i.test(a.question));
  if (!yes && !list) return undefined;
  const isNo = yes && /^(nie|no|false)$/i.test(yes.answer.trim());
  return { reported: isNo ? 'no' : 'yes', text: list?.answer || (isNo ? undefined : yes?.answer), source, date };
}

/** Dane dla personelu: zakres placówki + sejf pacjenta tylko w zakresie udostępnienia (jak raport faktów). */
export async function collectForStaff(user: AppUser, actor: AuditActor, patientId: string): Promise<PatientData> {
  const orgId = staffOrgId(user);
  const patientRef = `Patient/${patientId}`;
  const grants = orgId ? activeGrantsFor(orgId, patientRef, user.fhir_ref ?? undefined) : [];
  const patient = (await fhir().readOptional<Patient>('Patient', patientId)) ?? (grants.length ? await fhirSystem().readOptional<Patient>('Patient', patientId) : undefined);
  if (!patient) throw notFound('patient_not_found');
  const facts = await buildFacts(user, actor, { patientId });
  const [meds, measured, appts, conditions, responses] = await Promise.all([
    listMedications(patientRef, true),
    listMeasurementsForStaff(patientRef),
    listPatientAppointments(patientRef),
    fhir().search<Condition>('Condition', { subject: patientRef, _count: '200' }),
    responsesForPatient(patientRef),
  ]);
  const shareMeasurements = measured.shared;
  const activity = shareMeasurements ? await listActivity(actor, patientRef, 120) : null;
  const journal = grants.length ? await listJournal(patientRef, undefined, 180) : null;
  let allergies: PatientData['allergies'] = { reported: 'unknown' };
  for (const r of responses) {
    const a = allergiesFrom(readableAnswers(r), 'wywiad przed wizytą', r.authored?.slice(0, 10));
    if (a) {
      allergies = a;
      break;
    }
  }
  if (allergies.reported === 'unknown')
    for (const sv of facts.surveys) {
      const a = allergiesFrom(sv.answers, sv.title, sv.authored.slice(0, 10));
      if (a) {
        allergies = a;
        break;
      }
    }
  return {
    patientRef,
    name: patientName(patient),
    birthDate: patient.birthDate,
    gender: patient.gender,
    identityVerified: patient.meta?.tag?.some((t) => t.system === ETERNAL.identity) ?? undefined,
    labs: [...facts.results, ...facts.unconfirmed],
    measurements: shareMeasurements ? measured.items : null,
    activity,
    meds,
    conditions: conditions.filter((c) => c.verificationStatus?.coding?.[0]?.code !== 'entered-in-error').map(conditionView),
    appointments: appts,
    documents: facts.documents.map((d) => ({ ref: d.ref, kind: d.kind, title: d.title, date: d.date, source: d.source, binaryId: d.binaryId })),
    journal,
    allergies,
    sharing: { vault: grants.length > 0, measurements: shareMeasurements },
  };
}

/** Dane pacjenta o sobie (własne konto albo opiekun z dostępem). */
export async function collectForPatient(actor: AuditActor, patientRef: string): Promise<PatientData> {
  const patient = await fhirSystem().read<Patient>('Patient', idFromRef(patientRef));
  const [facts, measurements, meds, appts, journal, vDocs, surveys] = await Promise.all([
    patientLabFacts(patientRef),
    listMeasurements(patientRef),
    listMedications(patientRef, true),
    listPatientAppointments(patientRef),
    listJournal(patientRef, undefined, 180),
    fhirSystem().search<DocumentReference>('DocumentReference', { subject: patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _count: '300' }),
    latestHealthSurveys(patientRef),
  ]);
  const activity = await listActivity(actor, patientRef, 120);
  const rows = new Map<string, FactRow>();
  for (const f of facts) {
    const k = testKey({ loinc: f.loinc, name: f.name });
    const row = rows.get(k.key) ?? { key: k.key, name: k.name, loinc: f.loinc, group: k.group, points: [], chart: false };
    row.points.push({
      date: f.date,
      value: f.value.replace('.', ','),
      valueNum: f.valueNum,
      unit: f.unit,
      range: f.range,
      labFlag: f.labFlag,
      source: { kind: f.source === 'clinic' ? 'clinic' : 'patient-document', ref: f.documentId ? `DocumentReference/${f.documentId}` : `Observation/${f.id}`, label: f.source === 'clinic' ? 'Wynik z placówki' : 'Dokument przesłany przez Ciebie' },
      trust: f.trust ?? TRUST.clinic.code,
      observationRef: f.id ? `Observation/${f.id}` : undefined,
    });
    rows.set(k.key, row);
  }
  let allergies: PatientData['allergies'] = { reported: 'unknown' };
  // najnowsze odpowiedzi pacjenta: wywiady przed wizytą, potem ankieta zdrowotna
  const responses = await fhirSystem().search<QuestionnaireResponse>('QuestionnaireResponse', { subject: patientRef, _sort: '-authored', _count: '20' }).catch(() => [] as QuestionnaireResponse[]);
  for (const r of responses) {
    const a = allergiesFrom(readableAnswers(r), 'wywiad przed wizytą', r.authored?.slice(0, 10));
    if (a) {
      allergies = a;
      break;
    }
  }
  if (allergies.reported === 'unknown')
    for (const sv of surveys) {
      const a = allergiesFrom(sv.answers, sv.title, sv.authored.slice(0, 10));
      if (a) {
        allergies = a;
        break;
      }
    }
  return {
    patientRef,
    name: patientName(patient),
    birthDate: patient.birthDate,
    gender: patient.gender,
    labs: finalize(rows, [...new Set([...rows.values()].map((r) => r.group)), OTHER]),
    measurements,
    activity,
    meds,
    conditions: [],
    appointments: appts,
    documents: vDocs
      .filter((d) => d.status !== 'entered-in-error')
      .map((d) => {
        const kind = d.meta?.tag?.find((t) => t.system === ETERNAL.intakeKind)?.code ?? 'other';
        return { ref: `DocumentReference/${d.id}`, kind, title: d.description ?? KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? 'Dokument', date: (d.context?.period?.start ?? d.date ?? '').slice(0, 10), source: kind === 'after-visit' ? ('clinic' as const) : ('patient' as const) };
      }),
    journal,
    allergies,
    sharing: { vault: true, measurements: true },
  };
}

// --- Medical Snapshot -------------------------------------------------------------------------------------

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
  /** Strzałka tylko z oznaczenia laboratorium (H/L/HH/LL), nigdy wyliczona przez aplikację. */
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

export interface Snapshot {
  generatedAt: string;
  patient: { id: string; name: string; birthDate?: string; age?: number; gender?: string; eternalId: string };
  sharing: PatientData['sharing'];
  problems: { active: SnapItem[]; historical: SnapItem[] };
  medications: { current: SnapItem[]; historical: SnapItem[] };
  allergies: PatientData['allergies'];
  results: { latest: ResultRef[]; flagged: ResultRef[]; total: number };
  parameters: ParamRow[];
  wearables: { days: number; source?: string; lastDate?: string; sleepAvg7?: number; sleepAvgPrev7?: number; stepsAvg7?: number; stepsAvgPrev7?: number };
  documents: SnapItem[];
  events: TimelineEvent[];
  alerts: { kind: 'missing' | 'unconfirmed' | 'new-results' | 'no-sharing' | 'cases'; text: string }[];
  sources: { label: string; count: number }[];
}

const LAB_ARROW: Record<string, '↑' | '↓'> = { H: '↑', HH: '↑', HU: '↑', L: '↓', LL: '↓', LU: '↓', A: '↑' };

/** Identyfikator Eternal ID — stały, czytelny skrót identyfikatora rekordu (bez danych osobowych). */
export function eternalIdFor(patientRef: string): string {
  const id = idFromRef(patientRef).replace(/[^a-z0-9]/gi, '').toUpperCase();
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const body = (h.toString(36).toUpperCase() + id).replace(/[^A-Z0-9]/g, '').padEnd(8, '0').slice(0, 8);
  return `ETR-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

function ageOn(birthDate: string | undefined, today: string): number | undefined {
  if (!birthDate) return undefined;
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < (d ?? 1)) ? 1 : 0);
}

export const PARAM_LABEL: Record<string, string> = { bp: 'Ciśnienie', heartRate: 'Tętno', spo2: 'SpO₂', weight: 'Masa ciała', glucose: 'Glukoza', temperature: 'Temperatura', height: 'Wzrost' };
const PARAM_ORDER = ['bp', 'heartRate', 'spo2', 'weight', 'glucose', 'temperature'];

function measValue(m: MeasurementView): string {
  if (m.kind === 'bp') return `${m.systolic}/${m.diastolic}`;
  return String(m.value ?? '').replace('.', ',');
}

function avg(nums: number[]): number | undefined {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : undefined;
}

function latestPoint(row: FactRow): FactPoint | undefined {
  return [...row.points].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function buildSnapshot(d: PatientData, today: string = nowIso().slice(0, 10)): Snapshot {
  const since30 = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString();
  const results: ResultRef[] = d.labs
    .map((r): ResultRef | undefined => {
      const p = latestPoint(r);
      if (!p) return undefined;
      return {
        key: r.key,
        name: r.name,
        group: r.group,
        value: p.value,
        unit: p.unit,
        date: p.date,
        range: p.range,
        labFlag: p.labFlag,
        arrow: p.labFlag ? LAB_ARROW[p.labFlag] : undefined,
        source: p.source.label,
        points: r.points.length,
        confirmed: p.trust !== TRUST.machineUnconfirmed.code,
      };
    })
    .filter((x): x is ResultRef => !!x)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'pl'));
  const params: ParamRow[] = [];
  for (const kind of PARAM_ORDER) {
    const list = (d.measurements ?? []).filter((m) => m.kind === kind).sort((a, b) => b.effective.localeCompare(a.effective));
    if (!list.length) continue;
    const [last, prev] = list;
    params.push({
      kind,
      label: PARAM_LABEL[kind],
      value: measValue(last),
      unit: last.unit,
      date: last.effective,
      source: last.device ?? last.source,
      previous: prev ? { value: measValue(prev), date: prev.effective } : undefined,
      count30: list.filter((m) => m.effective >= since30).length,
    });
  }
  const act = (d.activity ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  const inRange = (from: number, to: number) => act.filter((a) => a.date > day(from) && a.date <= day(to));
  const sleep = (list: ActivityDay[]) => avg(list.map((a) => a.sleep?.minutes).filter((x): x is number => x !== undefined));
  const steps = (list: ActivityDay[]) => avg(list.map((a) => a.steps).filter((x): x is number => x !== undefined));
  const conditions = d.conditions;
  const docs = d.documents.slice().sort((a, b) => b.date.localeCompare(a.date));
  const unconfirmed = d.labs.reduce((n, r) => n + r.points.filter((p) => p.trust === TRUST.machineUnconfirmed.code).length, 0);
  const sourceCount = new Map<string, number>();
  for (const r of d.labs) for (const p of r.points) sourceCount.set(p.source.label, (sourceCount.get(p.source.label) ?? 0) + 1);
  for (const m of d.measurements ?? []) {
    const k = `Pomiary: ${m.device ?? m.source}`;
    sourceCount.set(k, (sourceCount.get(k) ?? 0) + 1);
  }
  for (const a of d.activity ?? []) {
    const k = `Urządzenie: ${a.device ?? a.source}`;
    sourceCount.set(k, (sourceCount.get(k) ?? 0) + 1);
  }
  const alerts: Snapshot['alerts'] = [];
  if (!d.sharing.vault) alerts.push({ kind: 'no-sharing', text: 'Pacjent nie udostępnił tej placówce dokumentów z aplikacji — widać tylko dane placówki.' });
  if (!d.sharing.measurements) alerts.push({ kind: 'no-sharing', text: 'Pacjent nie udostępnia pomiarów domowych.' });
  if (unconfirmed) alerts.push({ kind: 'unconfirmed', text: `${unconfirmed} odczytów maszynowych czeka na potwierdzenie — sprawdź w oryginale.` });
  const fresh = results.filter((r) => r.date >= day(7)).length;
  if (fresh) alerts.push({ kind: 'new-results', text: `${fresh} wyników z ostatnich 7 dni.` });
  if (d.allergies.reported === 'unknown') alerts.push({ kind: 'missing', text: 'Brak informacji o uczuleniach — zapytaj w wywiadzie.' });
  return {
    generatedAt: nowIso(),
    patient: { id: idFromRef(d.patientRef), name: d.name, birthDate: d.birthDate, age: ageOn(d.birthDate, today), gender: d.gender, eternalId: eternalIdFor(d.patientRef) },
    sharing: d.sharing,
    problems: {
      active: conditions.filter((c) => c.status === 'active' || c.status === 'recurrence' || c.status === 'relapse').map((c) => ({ label: c.display, detail: c.code, date: c.onset ?? c.recorded, source: c.recorder ? `wpisał(a): ${c.recorder}` : undefined, ref: `Condition/${c.id}` })),
      historical: conditions.filter((c) => !['active', 'recurrence', 'relapse'].includes(c.status)).map((c) => ({ label: c.display, detail: c.code, date: c.onset ?? c.recorded, ref: `Condition/${c.id}` })),
    },
    medications: {
      current: d.meds.filter((m) => m.status === 'active').map((m) => ({ label: m.name, detail: [m.dosage, m.atc ? `ATC ${m.atc}` : undefined].filter(Boolean).join(' · ') || undefined, date: m.since ?? m.reportedAt.slice(0, 10), source: 'zgłoszone przez pacjenta', ref: `MedicationStatement/${m.id}` })),
      historical: d.meds.filter((m) => m.status !== 'active').map((m) => ({ label: m.name, detail: m.dosage, date: m.since ?? m.reportedAt.slice(0, 10), source: m.status === 'stopped' ? 'odstawiony' : m.status, ref: `MedicationStatement/${m.id}` })),
    },
    allergies: d.allergies,
    results: { latest: results.slice(0, 12), flagged: results.filter((r) => r.labFlag && r.arrow), total: results.length },
    parameters: params,
    wearables: {
      days: act.length,
      source: act[0]?.device ?? act[0]?.source,
      lastDate: act[0]?.date,
      sleepAvg7: sleep(inRange(7, 0)),
      sleepAvgPrev7: sleep(inRange(14, 7)),
      stepsAvg7: steps(inRange(7, 0)),
      stepsAvgPrev7: steps(inRange(14, 7)),
    },
    documents: docs.slice(0, 10).map((x) => ({ label: x.title, date: x.date, source: x.source === 'clinic' ? 'placówka' : 'od pacjenta', ref: x.ref })),
    events: buildTimeline(d, { today }).slice(0, 8),
    alerts,
    sources: [...sourceCount.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

// --- szczegół wyniku z pochodzeniem ---------------------------------------------------------------------------

export interface ResultDetail {
  key: string;
  name: string;
  loinc?: string;
  group: string;
  points: (FactPoint & {
    laboratory?: string;
    trustLabel: string;
    confirmations: { who: string; activity: string; at?: string }[];
    corrections: { field: string; from?: string; to?: string; who: string; at: string }[];
  })[];
}

const TRUST_PL: Record<string, string> = {
  [TRUST.clinic.code]: 'wprowadzone przez placówkę',
  [TRUST.machineUnconfirmed.code]: 'odczyt maszynowy — niepotwierdzony',
  [TRUST.patientConfirmed.code]: 'potwierdzone przez pacjenta',
  [TRUST.clinicianConfirmed.code]: 'potwierdzone przez personel',
  [TRUST.manual.code]: 'wpis ręczny pacjenta',
};

export async function resultDetail(d: PatientData, key: string): Promise<ResultDetail> {
  const row = d.labs.find((r) => r.key === key);
  if (!row) throw notFound('result_not_found');
  const points = await Promise.all(
    [...row.points]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(async (p) => {
        const obsId = p.observationRef ? idFromRef(p.observationRef) : undefined;
        const obs = obsId ? await fhirSystem().readOptional<Observation>('Observation', obsId) : undefined;
        if (obs && obs.subject?.reference !== d.patientRef) throw notFound('result_not_found');
        const prov = obsId ? await fhirSystem().search<Provenance>('Provenance', { target: `Observation/${obsId}`, _count: '20' }).catch(() => [] as Provenance[]) : [];
        const intakeIds = p.source.intakeId
          ? [p.source.intakeId]
          : p.source.ref.startsWith('DocumentReference/')
            ? (getDb().prepare('SELECT id FROM intake_item WHERE document_ref = ?').all(p.source.ref) as { id: string }[]).map((x) => x.id)
            : [];
        const corrections = intakeIds.length
          ? (getDb()
              .prepare(`SELECT field, auto_value, corrected_value, actor_name, actor_kind, at, loinc, source_text FROM extraction_correction WHERE intake_id IN (${intakeIds.map(() => '?').join(',')}) ORDER BY at`)
              .all(...intakeIds) as { field: string; auto_value: string | null; corrected_value: string | null; actor_name: string | null; actor_kind: string; at: string; loinc: string | null; source_text: string | null }[]).filter(
              (c) => (row.loinc && c.loinc === row.loinc) || (p.source.text && c.source_text && c.source_text.slice(0, 60) === p.source.text.slice(0, 60)),
            )
          : [];
        return {
          ...p,
          laboratory: obs?.performer?.[0]?.display,
          trustLabel: TRUST_PL[p.trust] ?? p.trust,
          confirmations: prov
            .sort((a, b) => (a.recorded ?? '').localeCompare(b.recorded ?? ''))
            .flatMap((pv) => (pv.agent ?? []).map((ag) => ({ who: ag.who?.display ?? 'system', activity: pv.activity?.coding?.[0]?.display ?? pv.activity?.text ?? '', at: pv.recorded }))),
          corrections: corrections.map((c) => ({ field: c.field, from: c.auto_value ?? undefined, to: c.corrected_value ?? undefined, who: c.actor_name ?? (c.actor_kind === 'patient' ? 'pacjent' : 'personel'), at: c.at })),
        };
      }),
  );
  return { key: row.key, name: row.name, loinc: row.loinc, group: row.group, points };
}

// --- oś czasu ------------------------------------------------------------------------------------------------

export const TIMELINE_CATEGORIES = ['meds', 'tests', 'symptoms', 'visits', 'measurements', 'hospital', 'documents', 'diagnoses'] as const;
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number];

export interface TimelineEvent {
  id: string;
  date: string;
  category: TimelineCategory;
  title: string;
  detail?: string;
  source?: string;
  ref?: string;
}

const PAIN_PL: Record<string, string> = {
  head: 'głowa', neck: 'szyja', chest: 'klatka piersiowa', abdomen: 'brzuch', 'upper-back': 'górna część pleców', 'lower-back': 'dolna część pleców', 'left-shoulder': 'lewy bark', 'right-shoulder': 'prawy bark',
  'left-arm': 'lewe ramię', 'right-arm': 'prawe ramię', 'left-hand': 'lewa dłoń', 'right-hand': 'prawa dłoń', 'left-hip': 'lewe biodro', 'right-hip': 'prawe biodro', 'left-knee': 'lewe kolano', 'right-knee': 'prawe kolano',
  'left-foot': 'lewa stopa', 'right-foot': 'prawa stopa', pelvis: 'miednica',
};

export function buildTimeline(d: PatientData, opts: { today?: string; categories?: TimelineCategory[]; from?: string; to?: string } = {}): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const m of d.meds) {
    if (m.since || m.reportedAt) out.push({ id: `med:${m.id}`, date: (m.since ?? m.reportedAt).slice(0, 10), category: 'meds', title: `Lek: ${m.name}`, detail: m.dosage, source: 'lista leków', ref: `MedicationStatement/${m.id}` });
    if (m.status === 'stopped') out.push({ id: `med-stop:${m.id}`, date: m.reportedAt.slice(0, 10), category: 'meds', title: `Odstawiony lek: ${m.name}`, source: 'lista leków', ref: `MedicationStatement/${m.id}` });
  }
  // badania — jedna pozycja na dzień i źródło
  const tests = new Map<string, { date: string; names: string[]; flagged: number; source: string; ref: string }>();
  for (const r of d.labs)
    for (const p of r.points) {
      const k = `${p.date}|${p.source.ref}`;
      const t = tests.get(k) ?? { date: p.date, names: [], flagged: 0, source: p.source.label, ref: p.source.ref };
      if (!t.names.includes(r.name)) t.names.push(r.name);
      if (p.labFlag && LAB_ARROW[p.labFlag]) t.flagged++;
      tests.set(k, t);
    }
  for (const [k, t] of tests)
    out.push({
      id: `tests:${k}`,
      date: t.date,
      category: 'tests',
      title: `Badania: ${t.names.slice(0, 4).join(', ')}${t.names.length > 4 ? ` i ${t.names.length - 4} więcej` : ''}`,
      detail: `${t.names.length} oznaczeń${t.flagged ? ` · ${t.flagged} z oznaczeniem laboratorium` : ''}`,
      source: t.source,
      ref: t.ref,
    });
  for (const a of d.appointments) {
    if (!['fulfilled', 'booked', 'arrived', 'checked-in'].includes(a.status)) continue;
    out.push({ id: `visit:${a.id}`, date: a.start, category: 'visits', title: a.status === 'fulfilled' ? `Wizyta: ${a.serviceName ?? ''}`.trim() : `Zaplanowana wizyta: ${a.serviceName ?? ''}`.trim(), detail: a.practitionerName, source: 'kalendarz placówki', ref: `Appointment/${a.id}` });
  }
  for (const c of d.conditions) out.push({ id: `dx:${c.id}`, date: (c.onset ?? c.recorded ?? '').slice(0, 10), category: 'diagnoses', title: `Rozpoznanie: ${c.display}`, detail: c.code, source: c.recorder ? `wpisał(a): ${c.recorder}` : undefined, ref: `Condition/${c.id}` });
  // pomiary — jedna pozycja na dzień i rodzaj, z zakresem wartości (bez oceny)
  const meas = new Map<string, MeasurementView[]>();
  for (const m of d.measurements ?? []) {
    const k = `${m.effective.slice(0, 10)}|${m.kind}`;
    meas.set(k, [...(meas.get(k) ?? []), m]);
  }
  for (const [k, list] of meas) {
    const [date, kind] = k.split('|');
    const values = list.map(measValue);
    const uniq = [...new Set(values)];
    out.push({ id: `meas:${k}`, date: list[0].effective, category: 'measurements', title: `${PARAM_LABEL[kind] ?? kind}: ${list.length === 1 ? values[0] : `${list.length} pomiary`} ${list[0].unit}`.trim(), detail: list.length > 1 ? uniq.slice(0, 6).join(' · ') : list[0].device, source: list[0].device ?? list[0].source, ref: `urn:eternal:measurements:${date}:${kind}` });
  }
  for (const a of d.activity ?? []) {
    if (!a.sleep && a.steps === undefined) continue;
    const parts = [a.steps !== undefined ? `${a.steps.toLocaleString('pl-PL')} kroków` : undefined, a.sleep ? `sen ${Math.floor(a.sleep.minutes / 60)} h ${a.sleep.minutes % 60} min` : undefined].filter(Boolean);
    out.push({ id: `act:${a.date}:${a.source}`, date: a.date, category: 'measurements', title: `Aktywność i sen: ${parts.join(', ')}`, source: a.device ?? a.source });
  }
  for (const j of d.journal ?? []) {
    if (j.kind === 'pain' && j.pain) out.push({ id: `sym:${j.id}`, date: j.at, category: 'symptoms', title: `Ból ${j.pain.intensity}/10 (samoocena)`, detail: j.pain.regions.map((r) => PAIN_PL[r] ?? r).join(', ') || undefined, source: 'dziennik pacjenta', ref: `Observation/${j.id}` });
    if (j.kind === 'menopause' && j.menopause) out.push({ id: `sym:${j.id}`, date: j.at, category: 'symptoms', title: 'Objawy okołomenopauzalne (samoocena)', detail: Object.keys(j.menopause.symptoms).join(', '), source: 'dziennik pacjenta', ref: `Observation/${j.id}` });
    if (j.kind === 'postpartum' && j.postpartum?.symptoms.length) out.push({ id: `sym:${j.id}`, date: j.at, category: 'symptoms', title: 'Objawy po porodzie (samoocena)', detail: j.postpartum.symptoms.join(', '), source: 'dziennik pacjenta', ref: `Observation/${j.id}` });
    if (j.kind === 'cycle' && j.cycle?.symptoms.length) out.push({ id: `sym:${j.id}`, date: j.at, category: 'symptoms', title: 'Objawy w cyklu (samoocena)', detail: j.cycle.symptoms.join(', '), source: 'dziennik pacjenta', ref: `Observation/${j.id}` });
  }
  for (const doc of d.documents) {
    const hospital = doc.kind === 'discharge';
    out.push({ id: `doc:${doc.ref}`, date: doc.date, category: hospital ? 'hospital' : 'documents', title: hospital ? `Hospitalizacja — ${doc.title}` : doc.title, source: doc.source === 'clinic' ? 'placówka' : 'od pacjenta', ref: doc.ref });
  }
  const cats = opts.categories?.length ? new Set(opts.categories) : undefined;
  return out
    .filter((e) => e.date && (!cats || cats.has(e.category)) && (!opts.from || e.date >= opts.from) && (!opts.to || e.date.slice(0, 10) <= opts.to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

// --- „Co się zmieniło od ostatniej wizyty” -----------------------------------------------------------------------

export interface DisplayFilter {
  /** Lekarz sam ustawia, od jakiej wartości chce widzieć pomiary wyróżnione — to filtr wyświetlania, nie norma. */
  bpSystolic?: number;
  bpDiastolic?: number;
  glucose?: number;
}

export function getDisplayFilter(userId: string): DisplayFilter {
  return readPref<DisplayFilter>(userId, 'wc-filter') ?? {};
}

export function setDisplayFilter(actor: AuditActor, userId: string, f: DisplayFilter): DisplayFilter {
  const clean: DisplayFilter = {};
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);
  clean.bpSystolic = num(f.bpSystolic, 60, 260);
  clean.bpDiastolic = num(f.bpDiastolic, 30, 160);
  clean.glucose = num(f.glucose, 20, 600);
  if ((f.bpSystolic !== undefined && clean.bpSystolic === undefined) || (f.bpDiastolic !== undefined && clean.bpDiastolic === undefined) || (f.glucose !== undefined && clean.glucose === undefined)) throw badRequest('invalid_value');
  writePref(userId, 'wc-filter', clean);
  audit(actor, { action: 'U', subtype: 'display-filter' });
  return clean;
}

export interface Change {
  kind: 'med-new' | 'med-stopped' | 'lab-change' | 'lab-new' | 'weight' | 'sleep' | 'steps' | 'measurement-filter' | 'document' | 'hospital' | 'diagnosis';
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
  filter: DisplayFilter;
  items: Change[];
  note: string;
}

const fmtNum = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');
const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}`;
const fmtMinutes = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;

export function lastVisitDate(d: PatientData, now: string = nowIso()): string | undefined {
  return d.appointments
    .filter((a) => a.status === 'fulfilled' && a.start < now)
    .map((a) => a.start)
    .sort()
    .at(-1);
}

export function whatChanged(d: PatientData, opts: { since?: string; filter?: DisplayFilter; now?: string } = {}): WhatChanged {
  const now = opts.now ?? nowIso();
  const last = lastVisitDate(d, now);
  const since = opts.since ?? last ?? new Date(Date.parse(now) - 90 * 86_400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  const items: Change[] = [];
  for (const m of d.meds) {
    const start = (m.since ?? m.reportedAt).slice(0, 10);
    if (start >= sinceDay && m.status === 'active') items.push({ kind: 'med-new', text: `Nowy lek: ${m.name}${m.dosage ? ` (${m.dosage})` : ''}`, date: start, ref: `MedicationStatement/${m.id}` });
    if (m.status === 'stopped' && m.reportedAt.slice(0, 10) >= sinceDay) items.push({ kind: 'med-stopped', text: `Odstawiony lek: ${m.name}`, date: m.reportedAt.slice(0, 10), ref: `MedicationStatement/${m.id}` });
  }
  for (const r of d.labs) {
    const pts = [...r.points].filter((p) => p.trust !== TRUST.machineUnconfirmed.code).sort((a, b) => a.date.localeCompare(b.date));
    const after = pts.filter((p) => p.date >= sinceDay);
    if (!after.length) continue;
    const latest = after.at(-1)!;
    const before = pts.filter((p) => p.date < latest.date).at(-1);
    if (before && before.valueNum !== undefined && latest.valueNum !== undefined && (before.unit ?? '') === (latest.unit ?? '')) {
      if (before.valueNum === latest.valueNum) continue;
      items.push({ kind: 'lab-change', text: `${r.name}: ${before.value} → ${latest.value}${latest.unit ? ` ${latest.unit}` : ''}`, from: before.value, to: latest.value, delta: fmtSigned(latest.valueNum - before.valueNum), date: latest.date, labFlag: latest.labFlag, ref: latest.observationRef });
    } else if (!before) {
      items.push({ kind: 'lab-new', text: `Nowe badanie: ${r.name} ${latest.value}${latest.unit ? ` ${latest.unit}` : ''}`, to: latest.value, date: latest.date, labFlag: latest.labFlag, ref: latest.observationRef });
    }
  }
  const meas = (d.measurements ?? []).slice().sort((a, b) => a.effective.localeCompare(b.effective));
  const weights = meas.filter((m) => m.kind === 'weight' && m.value !== undefined);
  const wAfter = weights.filter((m) => m.effective >= since).at(-1);
  const wBefore = weights.filter((m) => m.effective < since).at(-1) ?? weights.filter((m) => m.effective >= since)[0];
  if (wAfter && wBefore && wAfter.id !== wBefore.id && wAfter.value !== wBefore.value)
    items.push({ kind: 'weight', text: `Masa ciała: ${fmtSigned(wAfter.value! - wBefore.value!)} kg (${fmtNum(wBefore.value!)} → ${fmtNum(wAfter.value!)} kg)`, from: fmtNum(wBefore.value!), to: fmtNum(wAfter.value!), delta: `${fmtSigned(wAfter.value! - wBefore.value!)} kg`, date: wAfter.effective });
  const act = d.activity ?? [];
  const sleepBefore = avg(act.filter((a) => a.date < sinceDay && a.date >= new Date(Date.parse(since) - 14 * 86_400_000).toISOString().slice(0, 10)).map((a) => a.sleep?.minutes).filter((x): x is number => x !== undefined));
  const sleepAfter = avg(act.filter((a) => a.date >= sinceDay).map((a) => a.sleep?.minutes).filter((x): x is number => x !== undefined));
  if (sleepBefore !== undefined && sleepAfter !== undefined && Math.abs(sleepAfter - sleepBefore) >= 15)
    items.push({ kind: 'sleep', text: `Średni sen z urządzenia: ${fmtMinutes(sleepBefore)} → ${fmtMinutes(sleepAfter)} (${sleepAfter < sleepBefore ? 'krócej' : 'dłużej'} o ${Math.round(Math.abs(sleepAfter - sleepBefore))} min)`, from: fmtMinutes(sleepBefore), to: fmtMinutes(sleepAfter) });
  const stepsBefore = avg(act.filter((a) => a.date < sinceDay && a.date >= new Date(Date.parse(since) - 14 * 86_400_000).toISOString().slice(0, 10)).map((a) => a.steps).filter((x): x is number => x !== undefined));
  const stepsAfter = avg(act.filter((a) => a.date >= sinceDay).map((a) => a.steps).filter((x): x is number => x !== undefined));
  if (stepsBefore !== undefined && stepsAfter !== undefined && Math.abs(stepsAfter - stepsBefore) >= 500)
    items.push({ kind: 'steps', text: `Średnio kroków dziennie: ${Math.round(stepsBefore).toLocaleString('pl-PL')} → ${Math.round(stepsAfter).toLocaleString('pl-PL')}`, from: String(Math.round(stepsBefore)), to: String(Math.round(stepsAfter)) });
  const f = opts.filter ?? {};
  if (f.bpSystolic !== undefined || f.bpDiastolic !== undefined) {
    const hits = meas.filter((m) => m.kind === 'bp' && m.effective >= since && ((f.bpSystolic !== undefined && (m.systolic ?? 0) >= f.bpSystolic) || (f.bpDiastolic !== undefined && (m.diastolic ?? 0) >= f.bpDiastolic)));
    if (hits.length)
      items.push({ kind: 'measurement-filter', text: `${hits.length} ${hits.length === 1 ? 'pomiar' : hits.length < 5 ? 'pomiary' : 'pomiarów'} ciśnienia ≥ ${f.bpSystolic ?? '—'}/${f.bpDiastolic ?? '—'} (Twój filtr wyświetlania)`, detail: undefined, to: hits.map(measValue).join(', ') } as Change);
  }
  if (f.glucose !== undefined) {
    const hits = meas.filter((m) => m.kind === 'glucose' && m.effective >= since && (m.value ?? 0) >= f.glucose!);
    if (hits.length) items.push({ kind: 'measurement-filter', text: `${hits.length} pomiarów glukozy ≥ ${f.glucose} mg/dL (Twój filtr wyświetlania)`, to: hits.map(measValue).join(', ') });
  }
  for (const doc of d.documents.filter((x) => x.date >= sinceDay)) items.push({ kind: doc.kind === 'discharge' ? 'hospital' : 'document', text: doc.kind === 'discharge' ? `Hospitalizacja: ${doc.title}` : `Nowy dokument: ${doc.title}`, date: doc.date, ref: doc.ref });
  for (const c of d.conditions.filter((x) => (x.recorded ?? '').slice(0, 10) >= sinceDay)) items.push({ kind: 'diagnosis', text: `Nowe rozpoznanie w dokumentacji: ${c.display}${c.code ? ` (${c.code})` : ''}`, date: c.recorded?.slice(0, 10), ref: `Condition/${c.id}` });
  const order: Change['kind'][] = ['med-new', 'med-stopped', 'lab-change', 'lab-new', 'weight', 'measurement-filter', 'sleep', 'steps', 'diagnosis', 'hospital', 'document'];
  items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (b.date ?? '').localeCompare(a.date ?? ''));
  return {
    since,
    sinceSource: opts.since ? 'chosen' : last ? 'last-visit' : 'default-90-days',
    filter: f,
    items,
    note: 'Zestawienie różnic w liczbach i nowych wpisów. Aplikacja nie ocenia, czy zmiana jest dobra czy zła; wyróżnienie pomiarów — wyłącznie według filtra ustawionego przez lekarza.',
  };
}

// --- avatar: gdzie i kiedy są dane --------------------------------------------------------------------------------

export const AVATAR_REGIONS = ['head', 'neck', 'heart', 'lungs', 'liver', 'pancreas', 'kidneys', 'blood', 'arms', 'legs', 'body'] as const;
export type AvatarRegion = (typeof AVATAR_REGIONS)[number];
export const REGION_PL: Record<AvatarRegion, string> = {
  head: 'Głowa (sen, samopoczucie)',
  neck: 'Szyja (tarczyca)',
  heart: 'Serce i naczynia',
  lungs: 'Płuca i oddychanie',
  liver: 'Wątroba',
  pancreas: 'Trzustka i cukier',
  kidneys: 'Nerki i elektrolity',
  blood: 'Krew',
  arms: 'Ręce (szczepienia, bóle)',
  legs: 'Nogi (aktywność, bóle)',
  body: 'Całe ciało (masa ciała, temperatura, inne)',
};

const GROUP_REGION: Record<string, AvatarRegion> = {
  'Morfologia krwi': 'blood',
  'Gospodarka żelazem': 'blood',
  Krzepnięcie: 'blood',
  'Markery stanu zapalnego': 'blood',
  'Gospodarka węglowodanowa': 'pancreas',
  Trzustka: 'pancreas',
  Lipidogram: 'heart',
  'Serce i mięśnie': 'heart',
  'Nerki i kwas moczowy': 'kidneys',
  Elektrolity: 'kidneys',
  'Wątroba i białka': 'liver',
  Tarczyca: 'neck',
};
const KIND_REGION: Record<string, AvatarRegion> = { bp: 'heart', heartRate: 'heart', spo2: 'lungs', glucose: 'pancreas', weight: 'body', height: 'body', temperature: 'body' };
const PAIN_REGION: Record<string, AvatarRegion> = { head: 'head', neck: 'neck', chest: 'heart', abdomen: 'liver', 'left-arm': 'arms', 'right-arm': 'arms', 'left-hand': 'arms', 'right-hand': 'arms', 'left-shoulder': 'arms', 'right-shoulder': 'arms', 'left-knee': 'legs', 'right-knee': 'legs', 'left-foot': 'legs', 'right-foot': 'legs', 'left-hip': 'legs', 'right-hip': 'legs' };

export interface AvatarRegionView {
  key: AvatarRegion;
  label: string;
  count: number;
  lastDate?: string;
  /** Dane z ostatnich 30 dni — w interfejsie mocniejszy kolor znacznika (świeżość, nie stan zdrowia). */
  recent: boolean;
  topics: string[];
}

export interface AvatarView {
  level: number;
  nextLevelAt: number;
  regionsWithData: number;
  dataPoints: number;
  lastUpdated?: string;
  newSince7d: number;
  regions: AvatarRegionView[];
  rule: string;
}

export function avatarFor(d: PatientData, today: string = nowIso().slice(0, 10)): AvatarView {
  const acc = new Map<AvatarRegion, { count: number; last?: string; topics: Set<string> }>();
  const hit = (r: AvatarRegion, date: string | undefined, topic: string) => {
    const a = acc.get(r) ?? { count: 0, topics: new Set<string>() };
    a.count++;
    if (date && (!a.last || date > a.last)) a.last = date.slice(0, 10);
    a.topics.add(topic);
    acc.set(r, a);
  };
  for (const r of d.labs) for (const p of r.points) hit(GROUP_REGION[r.group] ?? 'body', p.date, r.name);
  for (const m of d.measurements ?? []) hit(KIND_REGION[m.kind] ?? 'body', m.effective, PARAM_LABEL[m.kind] ?? m.kind);
  for (const a of d.activity ?? []) {
    if (a.steps !== undefined) hit('legs', a.date, 'Kroki');
    if (a.sleep) hit('head', a.date, 'Sen z urządzenia');
  }
  for (const j of d.journal ?? []) {
    if (j.kind === 'mood') hit('head', j.at, 'Nastrój (dziennik)');
    if (j.kind === 'sleep') hit('head', j.at, 'Sen (dziennik)');
    if (j.kind === 'breathing') hit('lungs', j.at, 'Ćwiczenia oddechowe');
    if (j.kind === 'pain') for (const reg of j.pain?.regions ?? []) hit(PAIN_REGION[reg] ?? 'body', j.at, 'Ból (dziennik)');
  }
  for (const doc of d.documents) if (doc.kind === 'photo') hit('body', doc.date, 'Dokumentacja fotograficzna');
  const day30 = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const day7 = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const regions = AVATAR_REGIONS.map((key) => {
    const a = acc.get(key);
    return { key, label: REGION_PL[key], count: a?.count ?? 0, lastDate: a?.last, recent: !!a?.last && a.last >= day30, topics: [...(a?.topics ?? [])].slice(0, 6) };
  });
  const withData = regions.filter((r) => r.count > 0).length;
  const dataPoints = regions.reduce((n, r) => n + r.count, 0);
  // poziom rośnie z kompletnością dokumentacji (liczbą obszarów z danymi), nie z „wynikami”
  const level = Math.min(6, 1 + Math.floor(withData / 2));
  const newSince7d =
    d.labs.reduce((n, r) => n + r.points.filter((p) => p.date >= day7).length, 0) +
    (d.measurements ?? []).filter((m) => m.effective.slice(0, 10) >= day7).length +
    (d.activity ?? []).filter((a) => a.date >= day7).length;
  return {
    level,
    nextLevelAt: level >= 6 ? AVATAR_REGIONS.length : (level) * 2,
    regionsWithData: withData,
    dataPoints,
    lastUpdated: regions.map((r) => r.lastDate).filter(Boolean).sort().at(-1),
    newSince7d,
    regions,
    rule: 'Avatar pokazuje, gdzie i kiedy są dane w dokumentacji. Kolor oznacza świeżość danych, nie stan zdrowia.',
  };
}
