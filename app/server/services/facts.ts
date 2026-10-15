import type { Appointment, DiagnosticReport, DocumentReference, Observation, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { config } from '../config.js';
import { ETERNAL, LOINC, TRUST } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { LAB_TESTS, matchTestName } from '../labs/dictionary.js';
import { formatLocal } from '../lib/time.js';
import { nowIso } from '../lib/util.js';
import { documentHtml, esc, lineChartSvg } from '../pdf/html.js';
import { ORG_TAG_SYSTEM, vaultOrgId } from '../tenancy.js';
import { getClinicSettings, getPractitioner } from './directory.js';
import { activeGrantsFor, grantAllows, type GrantView } from './grants.js';
import { prepFor, type VisitPrep } from './inbox.js';
import { type IntakeExtract, KIND_LABEL, listIntake } from './intake.js';
import { staffOrgId } from './orgs.js';
import { toAppointmentView } from './scheduling.js';
import { labRange } from './patientData.js';

/**
 * Raport faktów przed wizytą (D3, DOC-04). Model odczytu tylko z potwierdzonych danych; każda liczba ma
 * odnośnik do źródła; odczyty niepotwierdzone oznaczone i poza tabelą; wykres przy co najmniej 2 pomiarach.
 * Zakres referencyjny wyłącznie z dokumentu laboratorium. Bez ocen typu „wynik niepokojący”.
 */

export const FACTS_TEMPLATE_VERSION = 'facts/2026-10-1';

export interface FactPoint {
  date: string;
  value: string;
  valueNum?: number;
  unit?: string;
  range?: string;
  labFlag?: string;
  source: { kind: 'clinic' | 'patient-document' | 'intake'; ref: string; label: string; binaryId?: string; intakeId?: string; line?: number; text?: string };
  trust: string;
  observationRef?: string;
}

export interface FactRow {
  key: string;
  name: string;
  loinc?: string;
  group: string;
  points: FactPoint[];
  chart: boolean;
}

export interface FactsDocument {
  ref: string;
  kind: string;
  title: string;
  date: string;
  issuer?: string;
  binaryId?: string;
  sections: { title: string; text: string }[];
  accessCode?: string;
  source: 'clinic' | 'patient';
}

export interface FactsReport {
  templateVersion: string;
  layout: string;
  generatedAt: string;
  patient: { id: string; name: string; birthDate?: string; gender?: string };
  appointment?: { id: string; start: string; practitionerName?: string; serviceName?: string };
  missing: { label: string; status: string }[];
  prep?: Pick<VisitPrep, 'completeness' | 'status' | 'sharing'>;
  results: FactRow[];
  unconfirmed: FactRow[];
  documents: FactsDocument[];
  sharing: { grants: GrantView[]; vaultIncluded: boolean };
}

// --- układy dla specjalizacji (MVP-1): wyłącznie kolejność grup, bez ocen --------------------------------

const GROUPS: Record<string, string[]> = {
  'Morfologia krwi': ['wbc', 'rbc', 'hgb', 'hct', 'mcv', 'mch', 'mchc', 'rdw', 'plt', 'mpv', 'neut_abs', 'neut_pct', 'lymph_abs', 'lymph_pct', 'mono_abs', 'mono_pct', 'eos_abs', 'eos_pct', 'baso_abs', 'baso_pct'],
  'Gospodarka węglowodanowa': ['glucose', 'hba1c', 'insulin'],
  Lipidogram: ['chol', 'hdl', 'ldl', 'nonhdl', 'tg'],
  'Nerki i kwas moczowy': ['creat', 'egfr', 'urea', 'urate'],
  'Wątroba i białka': ['alt', 'ast', 'ggt', 'alp', 'bili', 'bili_d', 'tp', 'alb'],
  Elektrolity: ['na', 'k', 'cl', 'ca', 'mg', 'phos'],
  'Gospodarka żelazem': ['fe', 'ferritin', 'tibc'],
  Tarczyca: ['tsh', 'ft4', 'ft3', 'atpo'],
  'Witaminy i hormony': ['vitd', 'b12', 'folate', 'cortisol', 'psa'],
  'Markery stanu zapalnego': ['crp', 'hscrp', 'esr'],
  Krzepnięcie: ['inr', 'pt', 'aptt', 'fib', 'ddimer'],
  'Serce i mięśnie': ['ntprobnp', 'tnhs', 'tni', 'ck', 'ldh'],
  Trzustka: ['amylase', 'lipase'],
};

export const LAYOUTS: Record<string, string[]> = {
  interna: ['Morfologia krwi', 'Gospodarka węglowodanowa', 'Lipidogram', 'Nerki i kwas moczowy', 'Wątroba i białka', 'Elektrolity', 'Tarczyca', 'Gospodarka żelazem', 'Witaminy i hormony', 'Markery stanu zapalnego', 'Krzepnięcie', 'Serce i mięśnie', 'Trzustka'],
  kardiologia: ['Serce i mięśnie', 'Lipidogram', 'Gospodarka węglowodanowa', 'Nerki i kwas moczowy', 'Elektrolity', 'Krzepnięcie', 'Morfologia krwi', 'Wątroba i białka', 'Tarczyca', 'Markery stanu zapalnego', 'Gospodarka żelazem', 'Witaminy i hormony', 'Trzustka'],
  pediatria: ['Morfologia krwi', 'Markery stanu zapalnego', 'Gospodarka żelazem', 'Witaminy i hormony', 'Tarczyca', 'Gospodarka węglowodanowa', 'Elektrolity', 'Nerki i kwas moczowy', 'Wątroba i białka', 'Lipidogram', 'Krzepnięcie', 'Serce i mięśnie', 'Trzustka'],
};

const KEY_GROUP = new Map(Object.entries(GROUPS).flatMap(([g, keys]) => keys.map((k) => [k, g] as const)));
const LOINC_KEY = new Map(LAB_TESTS.map((t) => [t.loinc, t.key]));
const OTHER = 'Pozostałe badania';

function layoutFor(specialty?: string): { name: string; order: string[] } {
  const s = (specialty ?? '').toLowerCase();
  const name = s.includes('kardio') ? 'kardiologia' : s.includes('pediatr') ? 'pediatria' : 'interna';
  return { name, order: [...LAYOUTS[name], OTHER] };
}

function testKey(o: { loinc?: string; name: string }): { key: string; group: string; name: string } {
  const byLoinc = o.loinc ? LOINC_KEY.get(o.loinc) : undefined;
  const key = byLoinc ?? matchTestName(o.name)?.def.key;
  const def = key ? LAB_TESTS.find((t) => t.key === key) : undefined;
  return { key: key ?? `name:${o.name.toLowerCase().replace(/\s+/g, ' ').trim()}`, group: (key && KEY_GROUP.get(key)) ?? OTHER, name: def?.pl ?? o.name };
}

function obsValue(o: Observation): { value: string; valueNum?: number; unit?: string } {
  const q = o.valueQuantity;
  if (q?.value !== undefined) return { value: `${q.comparator ?? ''}${String(q.value).replace('.', ',')}`, valueNum: q.comparator ? undefined : q.value, unit: q.unit ?? q.code };
  return { value: o.valueString ?? '' };
}

function obsRange(o: Observation): string | undefined {
  return labRange(o);
}

function trustCode(r: { meta?: { tag?: { system?: string; code?: string }[] } }): string {
  return r.meta?.tag?.find((t) => t.system === ETERNAL.trust)?.code ?? TRUST.clinic.code;
}

function isVault(r: { meta?: { tag?: { system?: string; code?: string }[] } }, patientRef: string): boolean {
  return (r.meta?.tag ?? []).some((t) => t.system === ORG_TAG_SYSTEM && t.code === vaultOrgId(patientRef));
}

function addPoint(rows: Map<string, FactRow>, name: string, loinc: string | undefined, p: FactPoint): void {
  const k = testKey({ loinc, name });
  const row = rows.get(k.key) ?? { key: k.key, name: k.name, loinc, group: k.group, points: [], chart: false };
  row.points.push(p);
  rows.set(k.key, row);
}

function finalize(rows: Map<string, FactRow>, order: string[]): FactRow[] {
  const list = [...rows.values()];
  for (const r of list) {
    r.points.sort((a, b) => b.date.localeCompare(a.date));
    const numeric = r.points.filter((p) => p.valueNum !== undefined);
    const units = new Set(numeric.map((p) => p.unit ?? ''));
    r.chart = numeric.length >= 2 && units.size === 1;
  }
  return list.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name, 'pl'));
}

function docSections(d: DocumentReference): { title: string; text: string }[] {
  const text = d.content.find((c) => c.attachment.contentType?.startsWith('text/plain') && c.attachment.data)?.attachment.data;
  if (!text) return [];
  const raw = Buffer.from(text, 'base64').toString('utf8');
  const parts = raw.split(/^== (.+) ==$/m);
  const out: { title: string; text: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ title: parts[i], text: (parts[i + 1] ?? '').trim() });
  return out.length ? out : [{ title: 'Treść', text: raw }];
}

/**
 * Buduje raport. Dane kliniki — przez repozytorium z zakresem organizacji; dane z sejfu pacjenta — tylko przy
 * aktywnym udostępnieniu tej klinice i w jego zakresie.
 */
export async function buildFacts(user: AppUser, actor: AuditActor, input: { patientId: string; appointmentId?: string }): Promise<FactsReport> {
  const orgId = staffOrgId(user);
  const patientRef = `Patient/${input.patientId}`;
  const grants = orgId ? activeGrantsFor(orgId, patientRef, user.fhir_ref ?? undefined) : [];
  const patient = (await fhir().readOptional<Patient>('Patient', input.patientId)) ?? (grants.length ? await fhirSystem().read<Patient>('Patient', input.patientId) : await fhir().read<Patient>('Patient', input.patientId));
  const apptRes = input.appointmentId ? await fhir().read<Appointment>('Appointment', input.appointmentId) : undefined;
  const appt = apptRes ? toAppointmentView(apptRes) : undefined;
  const specialty = appt?.practitionerId ? (await getPractitioner(appt.practitionerId).catch(() => undefined))?.specialty : undefined;
  const layout = layoutFor(specialty);

  const confirmed = new Map<string, FactRow>();
  const unconfirmed = new Map<string, FactRow>();
  const documents: FactsDocument[] = [];

  // 1. wyniki wprowadzone przez placówkę
  const clinicReports = await fhir().search<DiagnosticReport>('DiagnosticReport', { subject: patientRef, _count: '300' });
  const clinicObsIds = new Map<string, DiagnosticReport>();
  for (const r of clinicReports) for (const res of r.result ?? []) if (res.reference) clinicObsIds.set(idFromRef(res.reference), r);
  const clinicObs = clinicObsIds.size ? await fhir().search<Observation>('Observation', { _id: [...clinicObsIds.keys()].join(','), _count: '1000' }) : [];
  for (const o of clinicObs) {
    if (['entered-in-error', 'cancelled'].includes(o.status)) continue;
    const rep = clinicObsIds.get(o.id ?? '');
    const v = obsValue(o);
    const point: FactPoint = {
      date: (o.effectiveDateTime ?? rep?.effectiveDateTime ?? '').slice(0, 10),
      ...v,
      range: obsRange(o),
      labFlag: o.interpretation?.[0]?.coding?.[0]?.code,
      source: { kind: 'clinic', ref: `DiagnosticReport/${rep?.id}`, label: `${rep?.code.text ?? 'Wynik'} (placówka)`, binaryId: rep?.presentedForm?.[0]?.url ? idFromRef(rep.presentedForm[0].url) : undefined },
      trust: trustCode(o),
      observationRef: `Observation/${o.id}`,
    };
    addPoint(o.status === 'preliminary' ? unconfirmed : confirmed, o.code.text ?? o.code.coding?.[0]?.display ?? '', o.code.coding?.find((c) => c.system === LOINC)?.code, point);
  }

  // 2. sejf pacjenta w zakresie udostępnienia
  const vaultTag = `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`;
  if (grants.length) {
    const [vObs, vDocs] = await Promise.all([
      fhirSystem().search<Observation>('Observation', { subject: patientRef, _tag: vaultTag, _count: '1000' }),
      fhirSystem().search<DocumentReference>('DocumentReference', { subject: patientRef, _tag: vaultTag, _count: '300' }),
    ]);
    const docById = new Map(vDocs.map((d) => [`DocumentReference/${d.id}`, d]));
    for (const o of vObs) {
      if (['entered-in-error', 'cancelled'].includes(o.status)) continue;
      const docRef = o.derivedFrom?.[0]?.reference ?? '';
      if (!grantAllows(grants, docRef, 'result')) continue;
      const doc = docById.get(docRef);
      const v = obsValue(o);
      const point: FactPoint = {
        date: (o.effectiveDateTime ?? '').slice(0, 10),
        ...v,
        range: obsRange(o),
        labFlag: o.interpretation?.[0]?.coding?.[0]?.code,
        source: {
          kind: 'patient-document',
          ref: docRef,
          label: doc?.description ?? 'Dokument od pacjenta',
          binaryId: doc?.content[0]?.attachment.url ? idFromRef(doc.content[0].attachment.url) : undefined,
          line: o.extension?.find((e) => e.url === ETERNAL.ext.sourceLine)?.valueInteger,
          text: o.extension?.find((e) => e.url === ETERNAL.ext.sourceText)?.valueString,
        },
        trust: trustCode(o),
        observationRef: `Observation/${o.id}`,
      };
      addPoint(o.status === 'preliminary' ? unconfirmed : confirmed, o.code.text ?? '', o.code.coding?.find((c) => c.system === LOINC)?.code, point);
    }
    for (const d of vDocs) {
      const kind = d.meta?.tag?.find((t) => t.system === ETERNAL.intakeKind)?.code ?? 'other';
      if (kind === 'lab') continue;
      if (!grantAllows(grants, `DocumentReference/${d.id}`, 'document')) continue;
      documents.push({
        ref: `DocumentReference/${d.id}`,
        kind,
        title: d.description ?? KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? 'Dokument',
        date: (d.context?.period?.start ?? d.date ?? '').slice(0, 10),
        binaryId: d.content[0]?.attachment.url ? idFromRef(d.content[0].attachment.url) : undefined,
        sections: docSections(d),
        accessCode: d.extension?.find((e) => e.url === 'urn:eternal:ext:access-code')?.valueString,
        // karta „Po wizycie” leży w sejfie pacjenta, ale jej autorem jest placówka
        source: kind === 'after-visit' ? 'clinic' : 'patient',
      });
    }
    // 3. wgrane, ale jeszcze niezapisane do rekordu — zawsze jako odczyt niepotwierdzony
    for (const it of listIntake({ patientRef }).filter((r) => r.status === 'needs_review' && (r.org_id === orgId || r.source === 'app'))) {
      const ex = it.extracted ? (JSON.parse(it.extracted) as IntakeExtract) : undefined;
      for (const f of ex?.items ?? []) {
        if (f.state === 'rejected') continue;
        addPoint(unconfirmed, f.name, f.match?.loinc, {
          date: ex?.collectedAt ?? it.created_at.slice(0, 10),
          value: f.value,
          valueNum: f.comparator ? undefined : f.valueNum,
          unit: f.unitRaw ?? f.unit,
          range: f.rangeText,
          labFlag: f.flag,
          source: { kind: 'intake', ref: `urn:eternal:intake:${it.id}`, label: `${it.filename ?? 'Plik'} (nie zapisany przez pacjenta)`, binaryId: it.binary_id, intakeId: it.id, line: f.line + 1, text: f.sourceText },
          trust: TRUST.machineUnconfirmed.code,
        });
      }
    }
  }
  // dokumenty kliniki (bez wyników) — tylko tytuł i data, treść w systemie placówki
  const clinicDocs = await fhir().search<DocumentReference>('DocumentReference', { subject: patientRef, status: 'current', _count: '100' });
  for (const d of clinicDocs) {
    if (isVault(d, patientRef)) continue;
    documents.push({ ref: `DocumentReference/${d.id}`, kind: 'clinic', title: d.description ?? d.type?.text ?? 'Dokument', date: (d.date ?? '').slice(0, 10), sections: [], source: 'clinic', binaryId: d.content[0]?.attachment.url ? idFromRef(d.content[0].attachment.url) : undefined });
  }
  documents.sort((a, b) => b.date.localeCompare(a.date));

  const prep = appt ? await prepFor(appt, orgId) : undefined;
  const name = patient.name?.[0];
  const report: FactsReport = {
    templateVersion: `${FACTS_TEMPLATE_VERSION}+${layout.name}`,
    layout: layout.name,
    generatedAt: nowIso(),
    patient: { id: patient.id ?? '', name: name ? `${(name.given ?? []).join(' ')} ${name.family ?? ''}`.trim() : '—', birthDate: patient.birthDate, gender: patient.gender },
    appointment: appt ? { id: appt.id, start: appt.start, practitionerName: appt.practitionerName, serviceName: appt.serviceName } : undefined,
    missing: prep ? prep.requirements.filter((r) => r.status !== 'ready').map((r) => ({ label: r.label + (r.optional ? ' (opcjonalnie)' : ''), status: r.status })) : [],
    prep: prep ? { completeness: prep.completeness, status: prep.status, sharing: prep.sharing } : undefined,
    results: finalize(confirmed, layout.order),
    unconfirmed: finalize(unconfirmed, layout.order),
    documents,
    sharing: { grants, vaultIncluded: grants.length > 0 },
  };
  audit(actor, { action: 'R', subtype: 'facts-report', entityRef: input.appointmentId ? `Appointment/${input.appointmentId}` : patientRef, patientRef, detail: { results: report.results.length, unconfirmed: report.unconfirmed.length, vault: grants.length > 0 } });
  return report;
}

// --- HTML/PDF ------------------------------------------------------------------------------------------

const STATUS_PL: Record<string, string> = { missing: 'brak', to_confirm: 'do potwierdzenia', ready: 'gotowe' };

function rowsTable(rows: FactRow[], opts: { unconfirmed: boolean; sources: Map<string, number> }): string {
  let html = '';
  let group = '';
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      html += `<h3>${esc(group)}</h3>`;
    }
    const pts = r.points
      .map((p) => {
        const n = opts.sources.get(p.source.ref) ?? 0;
        return `<tr><td>${esc(p.date)}</td><td class="num">${esc(p.value)}</td><td>${esc(p.unit ?? '')}</td><td>${esc(p.range ?? '—')}</td><td>${esc(p.labFlag ?? '')}</td><td class="src">[${n}]${p.source.line ? ` w.${p.source.line}` : ''}</td></tr>`;
      })
      .join('');
    const chartPts = r.chart && !opts.unconfirmed ? r.points.filter((p) => p.valueNum !== undefined).map((p) => ({ date: p.date, value: p.valueNum as number })) : [];
    html += `<table><thead><tr><th colspan="6">${esc(r.name)}${r.loinc ? ` <span class="muted">LOINC ${esc(r.loinc)}</span>` : ''}${opts.unconfirmed ? ' <span class="tag unconfirmed">odczyt maszynowy, niepotwierdzony</span>' : ''}</th></tr>
      <tr><th>Data</th><th class="num">Wynik</th><th>Jednostka</th><th>Zakres z dokumentu</th><th>Oznaczenie lab.</th><th>Źródło</th></tr></thead><tbody>${pts}</tbody></table>
      ${chartPts.length >= 2 ? `<div class="chart">${lineChartSvg(chartPts, { unit: r.points[0]?.unit })}</div>` : ''}`;
  }
  return html;
}

export function factsHtml(report: FactsReport, clinicName: string): string {
  const sources = new Map<string, number>();
  const sourceList: { n: number; label: string; ref: string }[] = [];
  for (const r of [...report.results, ...report.unconfirmed])
    for (const p of r.points)
      if (!sources.has(p.source.ref)) {
        sources.set(p.source.ref, sources.size + 1);
        sourceList.push({ n: sources.size, label: p.source.label, ref: p.source.ref });
      }
  const tz = config.clinic.timezone;
  const missing = report.missing.length
    ? `<div class="box warn"><strong>Braki przed wizytą</strong><ul>${report.missing.map((m) => `<li>${esc(m.label)} — ${esc(STATUS_PL[m.status] ?? m.status)}</li>`).join('')}</ul></div>`
    : '';
  const docs = report.documents.length
    ? `<h2>Dokumenty</h2>${report.documents
        .map(
          (d) =>
            `<div class="box"><strong>${esc(d.title)}</strong> <span class="muted">${esc(d.date)}${d.source === 'patient' ? ' · przekazane przez pacjenta' : ' · placówka'}</span>${d.accessCode ? `<div class="small">Kod dostępu z dokumentu: ${esc(d.accessCode)}</div>` : ''}${d.sections
              .map((s) => `<div class="small"><strong>${esc(s.title)}:</strong> ${esc(s.text).replace(/\n/g, '<br>')}</div>`)
              .join('')}</div>`,
        )
        .join('')}`
    : '';
  const body = `
    ${missing}
    <p class="small muted">Raport zawiera wyłącznie fakty z dokumentów i ich źródła. Zakresy referencyjne i oznaczenia pochodzą z dokumentów laboratoriów. Raport niczego nie ocenia.</p>
    <h2>Wyniki potwierdzone</h2>
    ${report.results.length ? rowsTable(report.results, { unconfirmed: false, sources }) : '<p class="muted">Brak potwierdzonych wyników.</p>'}
    ${report.unconfirmed.length ? `<h2>Odczyty niepotwierdzone</h2><p class="small">Odczyt maszynowy, którego pacjent ani personel nie potwierdzili — nie jest faktem; sprawdź w oryginale.</p>${rowsTable(report.unconfirmed, { unconfirmed: true, sources })}` : ''}
    ${docs}
    <h2>Źródła</h2><ol class="small">${sourceList.map((s) => `<li>${esc(s.label)} <span class="muted">${esc(s.ref)}</span></li>`).join('')}</ol>`;
  return documentHtml({
    title: 'Raport faktów przed wizytą',
    subtitle: `${report.patient.name}${report.patient.birthDate ? `, ur. ${report.patient.birthDate}` : ''}`,
    org: clinicName,
    meta: [
      ...(report.appointment ? ([['Wizyta', formatLocal(report.appointment.start, tz)], ['Lekarz', report.appointment.practitionerName ?? '—']] as [string, string][]) : []),
      ['Układ', report.layout],
      ['Wygenerowano', formatLocal(report.generatedAt, tz)],
    ],
    body,
    templateVersion: report.templateVersion,
    demo: config.demoMode,
  });
}

export function clinicNameFor(user: AppUser): string {
  return getClinicSettings(staffOrgId(user)).name;
}
