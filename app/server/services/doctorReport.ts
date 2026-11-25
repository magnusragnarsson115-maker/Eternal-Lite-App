import type { Bundle, BundleEntry, Composition, CompositionSection, MedicationStatement, Observation, Patient, Reference, Resource } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { LOINC } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { nowIso } from '../lib/util.js';
import { esc, documentHtml } from '../pdf/html.js';
import { directiveCardLines, listDirectives, listFamilyHistory, listVaccinations, type FamilyHistoryView, type VaccinationView } from './healthHistory.js';
import { journalSummary, listJournal } from './journal.js';
import { listMedications, type MedicationView } from './medications.js';
import { patientLabFacts, type LabFact } from './patientData.js';
import { latestFacts, type LatestFacts } from './periodReport.js';
import { listContacts, getEmergencyInfo } from './safety.js';
import { answersOf, healthResponses, latestHealthSurveys } from './surveys.js';

/**
 * Raport dla lekarza w układzie SBAR (A4.3, F6.2), dokument FHIR (A4.4) i karta zdrowia na wyjazd PL/EN (A24.7).
 *
 * Granica MDR (COMPLIANCE §1): w SBAR litera A oznacza ocenę (Assessment) — tę część wypełnia lekarz. Raport podaje
 * w niej wyłącznie dane z aplikacji: ostatnie pomiary, wyniki z zakresami z dokumentów laboratoriów i liczby z
 * dzienników pacjenta. Żadnych wniosków, priorytetów ani oznaczeń „poza normą” od aplikacji.
 */

export const DOCTOR_REPORT_VERSION = 'raport-dla-lekarza-sbar/2026-10-1';
export const TRAVEL_CARD_VERSION = 'karta-na-wyjazd/2026-10-1';

export interface DoctorReportInput {
  reason: string;
  since?: string;
  questions?: string;
  expectations?: string;
  days: number;
}

export interface DoctorReport {
  version: string;
  generatedAt: string;
  patient: { name: string; birthDate?: string; gender?: string };
  period: { days: number; from: string };
  s: { reason: string; since?: string };
  b: {
    surveys: { title: string; authored: string; answers: { question: string; answer: string }[] }[];
    medications: MedicationView[];
    vaccinations: VaccinationView[];
    familyHistory: FamilyHistoryView[];
  };
  a: {
    measurements: LatestFacts['measurements'];
    labs: LabFact[];
    journal: ReturnType<typeof journalSummary>;
  };
  r: { questions?: string; expectations?: string };
}

const JOURNAL_PL: Record<string, string> = { mood: 'Samopoczucie (samoocena)', pain: 'Ból (samoocena 0–10)', sleep: 'Czas snu (dziennik)', breathing: 'Ćwiczenia oddechowe' };

async function patientHeader(patientRef: string) {
  const p = await fhirSystem().read<Patient>('Patient', patientRef.split('/')[1]);
  const n = p.name?.[0];
  return { resource: p, name: n ? `${(n.given ?? []).join(' ')} ${n.family ?? ''}`.trim() : '', birthDate: p.birthDate, gender: p.gender };
}

export async function buildDoctorReport(patientRef: string, input: DoctorReportInput, now: Date = new Date()): Promise<DoctorReport> {
  const from = new Date(now.getTime() - input.days * 86_400_000).toISOString().slice(0, 10);
  const [head, surveys, medications, vaccinations, familyHistory, facts, labs, journal] = await Promise.all([
    patientHeader(patientRef),
    latestHealthSurveys(patientRef),
    listMedications(patientRef),
    listVaccinations(patientRef),
    listFamilyHistory(patientRef),
    latestFacts(patientRef),
    patientLabFacts(patientRef),
    listJournal(patientRef, undefined, input.days, now),
  ]);
  return {
    version: DOCTOR_REPORT_VERSION,
    generatedAt: now.toISOString(),
    patient: { name: head.name, birthDate: head.birthDate, gender: head.gender },
    period: { days: input.days, from },
    s: { reason: input.reason.trim(), since: input.since?.trim() || undefined },
    b: {
      surveys: surveys.map((s) => ({ title: s.title, authored: s.authored, answers: s.answers })),
      medications,
      vaccinations: vaccinations.filter((v) => v.status === 'done').slice(0, 15),
      familyHistory,
    },
    a: {
      measurements: facts.measurements,
      labs: labs.filter((l) => l.date >= from && (l.status === 'final' || l.status === 'amended' || l.status === 'corrected')),
      journal: journalSummary(journal),
    },
    r: { questions: input.questions?.trim() || undefined, expectations: input.expectations?.trim() || undefined },
  };
}

const plDate = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
const plDateTime = (iso: string) => `${plDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;

function measurementText(m: LatestFacts['measurements'][number]): string {
  return m.systolic !== undefined ? `${m.systolic}/${m.diastolic} ${m.unit}` : `${m.value ?? '—'} ${m.unit}`;
}

export function doctorReportHtml(r: DoctorReport, org = 'Eternal'): string {
  const list = (items: string[], empty: string) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">${esc(empty)}</p>`);
  const s = `<h2>S — Sytuacja (słowami pacjenta)</h2>
    <div class="box"><p style="white-space:pre-wrap;margin:0">${esc(r.s.reason)}</p>${r.s.since ? `<p class="small muted" style="margin:2mm 0 0">Od kiedy: ${esc(r.s.since)}</p>` : ''}</div>`;
  const surveys = r.b.surveys
    .map((sv) => `<h3>${esc(sv.title)} <span class="muted small">(${esc(plDate(sv.authored.slice(0, 10)))})</span></h3><table><tbody>${sv.answers.map((a) => `<tr><td>${esc(a.question)}</td><td>${esc(a.answer)}</td></tr>`).join('')}</tbody></table>`)
    .join('');
  const b = `<h2>B — Tło (dane wpisane przez pacjenta)</h2>
    ${surveys || '<p class="muted">Pacjent nie wypełnił ankiety zdrowotnej.</p>'}
    <h3>Przyjmowane leki (lista pacjenta)</h3>${list(
      r.b.medications.map((m) => [m.name, m.dosage, m.since ? `od ${m.since}` : ''].filter(Boolean).join(' — ')),
      'Brak wpisów.',
    )}
    <h3>Szczepienia (zgłoszone przez pacjenta)</h3>${list(
      r.b.vaccinations.map((v) => `${v.vaccine}${v.dose ? `, dawka ${v.dose}` : ''} — ${v.date.length === 10 ? plDate(v.date) : v.date}`),
      'Brak wpisów.',
    )}
    <h3>Choroby w rodzinie</h3>${list(
      r.b.familyHistory.map((f) => `${f.relationshipLabel}: ${f.conditions.map((c) => `${c.text}${c.onsetAge !== undefined ? ` (od ${c.onsetAge} r.ż.)` : ''}`).join(', ')}`),
      'Brak wpisów.',
    )}`;
  const meas = r.a.measurements.length
    ? `<table><thead><tr><th>Pomiar</th><th class="num">Ostatnia wartość</th><th>Kiedy</th><th>Źródło</th></tr></thead><tbody>${r.a.measurements
        .map((m) => `<tr><td>${esc(m.label)}</td><td class="num">${esc(measurementText(m))}</td><td>${esc(plDateTime(m.effective))}</td><td class="small">${esc(m.sourceLabel)}${m.device ? ` · ${esc(m.device)}` : ''}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="muted">Brak pomiarów.</p>';
  const labs = r.a.labs.length
    ? `<table><thead><tr><th>Data</th><th>Badanie</th><th class="num">Wynik</th><th>Jednostka</th><th>Zakres z dokumentu</th><th>Oznaczenie lab.</th></tr></thead><tbody>${r.a.labs
        .map((l) => `<tr><td>${esc(plDate(l.date))}</td><td>${esc(l.name)}</td><td class="num">${esc(l.value)}</td><td>${esc(l.unit ?? '')}</td><td>${esc(l.range ?? '—')}</td><td>${esc(l.labFlag ?? '')}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="muted">Brak potwierdzonych wyników w tym okresie.</p>';
  const journal = r.a.journal.length
    ? `<table><thead><tr><th>Dziennik pacjenta</th><th class="num">Wpisy</th><th class="num">Najniższa</th><th class="num">Najwyższa</th><th class="num">Średnia</th></tr></thead><tbody>${r.a.journal
        .map((j) => `<tr><td>${esc(JOURNAL_PL[j.kind])}</td><td class="num">${j.count}</td><td class="num">${j.min ?? ''} ${esc(j.unit)}</td><td class="num">${j.max ?? ''} ${esc(j.unit)}</td><td class="num">${j.mean === undefined ? '<span class="muted small">1 wpis</span>' : `${j.mean} ${esc(j.unit)}`}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="muted">Brak wpisów w dziennikach.</p>';
  const a = `<h2>A — Dane do oceny lekarza (ostatnie ${r.period.days} dni, od ${esc(plDate(r.period.from))})</h2>
    <div class="box warn small">W standardzie SBAR litera A oznacza ocenę — dokonuje jej lekarz. Ta część zawiera wyłącznie dane z aplikacji: aplikacja nie ocenia wyników ani objawów.</div>
    <h3>Ostatnie pomiary</h3>${meas}
    <h3>Wyniki badań</h3><p class="small muted">Zakres referencyjny i oznaczenie wyłącznie z dokumentu laboratorium.</p>${labs}
    <h3>Dzienniki (samoocena pacjenta)</h3>${journal}`;
  const rr = `<h2>R — Pytania i prośby pacjenta</h2>
    ${r.r.questions ? `<div class="box"><p style="white-space:pre-wrap;margin:0">${esc(r.r.questions)}</p></div>` : '<p class="muted">Pacjent nie wpisał pytań.</p>'}
    ${r.r.expectations ? `<p><strong>Czego oczekuję po wizycie:</strong> ${esc(r.r.expectations)}</p>` : ''}`;
  return documentHtml({
    title: 'Informacje dla lekarza (SBAR)',
    subtitle: `${r.patient.name}${r.patient.birthDate ? `, ur. ${plDate(r.patient.birthDate)}` : ''}`,
    org,
    meta: [
      ['Przygotował', 'pacjent w aplikacji Eternal'],
      ['Data', plDateTime(r.generatedAt)],
    ],
    body: `<p class="small muted">Dokument przygotowany przez pacjenta. Dane wpisane lub wgrane przez pacjenta nie zostały zweryfikowane przez placówkę.</p>${s}${b}${a}${rr}`,
    templateVersion: r.version,
  });
}

// --- dokument FHIR (A4.4) --------------------------------------------------------------------------------------------

const uuid = () => `urn:uuid:${crypto.randomUUID()}`;

/** Kopia zasobu z odwołaniami przepiętymi na identyfikatory wewnątrz dokumentu. */
function relink<T extends Resource>(r: T, map: Map<string, string>): T {
  let json = JSON.stringify(r);
  for (const [from, to] of map) json = json.split(`"reference":"${from}"`).join(`"reference":"${to}"`);
  return JSON.parse(json) as T;
}

/**
 * Raport jako dokument FHIR R4 (Bundle typu „document” z Composition — sekcje SBAR, LOINC). Odwołania przepięte na
 * zasoby w dokumencie, więc plik da się zaimportować w innym systemie bez dostępu do naszego serwera.
 */
export async function doctorReportBundle(patientRef: string, report: DoctorReport): Promise<Bundle> {
  const head = await patientHeader(patientRef);
  const patientUrl = uuid();
  const map = new Map<string, string>([[patientRef, patientUrl]]);
  const entries: BundleEntry[] = [{ fullUrl: patientUrl, resource: head.resource }];
  const add = (r: Resource | undefined) => {
    if (!r?.id) return undefined;
    const key = `${r.resourceType}/${r.id}`;
    if (map.has(key)) return map.get(key)!;
    const url = uuid();
    map.set(key, url);
    entries.push({ fullUrl: url, resource: r });
    return url;
  };
  const refs = (urls: (string | undefined)[]): Reference[] => urls.filter((u): u is string => !!u).map((reference) => ({ reference }));

  const meds = await Promise.all(report.b.medications.map((m) => fhirSystem().readOptional<MedicationStatement>('MedicationStatement', m.id)));
  const labObs = await Promise.all(report.a.labs.filter((l) => l.id).map((l) => fhirSystem().readOptional<Observation>('Observation', l.id!)));
  const surveyRefs = (await healthResponses(patientRef)).slice(0, 2);
  const medUrls = meds.map(add);
  const labUrls = labObs.map(add);
  const surveyUrls = surveyRefs.map(add);
  const imm = await Promise.all(report.b.vaccinations.map((v) => fhirSystem().readOptional<Resource>('Immunization', v.id)));
  const immUrls = imm.map(add);
  const fam = await Promise.all(report.b.familyHistory.map((f) => fhirSystem().readOptional<Resource>('FamilyMemberHistory', f.id)));
  const famUrls = fam.map(add);

  const text = (html: string) => ({ status: 'generated' as const, div: `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>` });
  const sections: CompositionSection[] = [
    { title: 'S — Sytuacja (słowami pacjenta)', code: { coding: [{ system: LOINC, code: '29299-5', display: 'Reason for visit Narrative' }] }, text: text(`<p>${esc(report.s.reason)}</p>${report.s.since ? `<p>Od kiedy: ${esc(report.s.since)}</p>` : ''}`) },
    { title: 'B — Przyjmowane leki', code: { coding: [{ system: LOINC, code: '10160-0', display: 'History of Medication use Narrative' }] }, text: text(esc(report.b.medications.map((m) => m.name).join(', ') || 'Brak wpisów')), entry: refs(medUrls) },
    { title: 'B — Szczepienia', code: { coding: [{ system: LOINC, code: '11369-6', display: 'History of Immunization Narrative' }] }, text: text(esc(report.b.vaccinations.map((v) => `${v.vaccine} ${v.date}`).join(', ') || 'Brak wpisów')), entry: refs(immUrls) },
    { title: 'B — Choroby w rodzinie', code: { coding: [{ system: LOINC, code: '10157-6', display: 'History of family member diseases Narrative' }] }, text: text(esc(report.b.familyHistory.map((f) => f.relationshipLabel).join(', ') || 'Brak wpisów')), entry: refs(famUrls) },
    { title: 'B — Ankieta zdrowotna', code: { coding: [{ system: LOINC, code: '74465-6', display: 'Questionnaire response Document' }] }, text: text(esc(report.b.surveys.map((s) => s.title).join(', ') || 'Brak')), entry: refs(surveyUrls) },
    {
      title: 'A — Dane do oceny lekarza (bez oceny aplikacji)',
      code: { coding: [{ system: LOINC, code: '30954-2', display: 'Relevant diagnostic tests/laboratory data Narrative' }] },
      text: text(`<p>Aplikacja nie ocenia wyników. Zakresy referencyjne wyłącznie z dokumentów laboratoriów.</p>${report.a.labs.map((l) => `<p>${esc(l.date)} ${esc(l.name)}: ${esc(l.value)} ${esc(l.unit ?? '')} (${esc(l.range ?? '—')})</p>`).join('')}`),
      entry: refs(labUrls),
    },
    { title: 'R — Pytania pacjenta', code: { coding: [{ system: LOINC, code: '10164-2', display: 'History of Present illness Narrative' }] }, text: text(esc(report.r.questions ?? 'Brak pytań')) },
  ];
  const composition: Composition = {
    resourceType: 'Composition',
    status: 'final',
    type: { coding: [{ system: LOINC, code: '60591-5', display: 'Patient summary Document' }], text: 'Informacje dla lekarza (SBAR)' },
    subject: { reference: patientUrl, display: head.name },
    date: report.generatedAt,
    author: [{ reference: patientUrl, display: `${head.name} (pacjent, aplikacja Eternal)` }],
    title: 'Informacje dla lekarza (SBAR)',
    confidentiality: 'N',
    section: sections,
    extension: [{ url: 'urn:eternal:ext:template-version', valueString: report.version }],
  };
  const compUrl = uuid();
  return {
    resourceType: 'Bundle',
    type: 'document',
    identifier: { system: 'urn:ietf:rfc:3986', value: uuid() },
    timestamp: nowIso(),
    entry: [{ fullUrl: compUrl, resource: composition }, ...entries.map((e) => ({ ...e, resource: relink(e.resource!, map) }))],
  };
}

// --- karta zdrowia na wyjazd (A24.7) ---------------------------------------------------------------------------------

const CHRONIC_EN: Record<string, [string, string]> = {
  hypertension: ['Nadciśnienie tętnicze', 'High blood pressure'],
  diabetes: ['Cukrzyca', 'Diabetes'],
  heart: ['Choroba serca', 'Heart disease'],
  lung: ['Astma lub POChP', 'Asthma or COPD'],
  thyroid: ['Choroba tarczycy', 'Thyroid disease'],
  kidney: ['Choroba nerek', 'Kidney disease'],
  mental: ['Depresja lub zaburzenia lękowe', 'Depression or anxiety disorder'],
  cancer: ['Nowotwór (obecnie lub w przeszłości)', 'Cancer (now or in the past)'],
};

export interface TravelCard {
  version: string;
  name: string;
  birthDate?: string;
  conditions: { pl: string; en: string }[];
  allergies?: string;
  medications: string[];
  vaccinations: string[];
  notes?: string;
  directives: { pl: string; en: string }[];
  contacts: { name: string; phone: string; relation?: string }[];
}

export async function travelCard(patientRef: string): Promise<TravelCard> {
  const head = await patientHeader(patientRef);
  const [intake] = await healthResponses(patientRef, 'health-intake');
  const a = answersOf(intake);
  const chronic = Array.isArray(a.chronic) ? a.chronic : typeof a.chronic === 'string' ? [a.chronic] : [];
  const conditions = chronic.filter((c) => CHRONIC_EN[c]).map((c) => ({ pl: CHRONIC_EN[c][0], en: CHRONIC_EN[c][1] }));
  if (typeof a['chronic-other'] === 'string' && a['chronic-other'].trim()) conditions.push({ pl: a['chronic-other'].trim(), en: `${a['chronic-other'].trim()} (in Polish)` });
  const meds = await listMedications(patientRef);
  const vacc = (await listVaccinations(patientRef)).filter((v) => v.status === 'done').slice(0, 10);
  const info = getEmergencyInfo(patientRef);
  return {
    version: TRAVEL_CARD_VERSION,
    name: head.name,
    birthDate: head.birthDate,
    conditions,
    allergies: a.allergies === true ? (typeof a['allergies-list'] === 'string' ? a['allergies-list'] : '') || '—' : a.allergies === false ? '' : undefined,
    medications: meds.map((m) => [m.name, m.dosage].filter(Boolean).join(' — ')),
    vaccinations: vacc.map((v) => `${v.vaccine} — ${v.date}`),
    notes: info.notes || undefined,
    directives: directiveCardLines(await listDirectives(patientRef)),
    contacts: listContacts(patientRef).map((c) => ({ name: c.name, phone: c.phone, relation: c.relation })),
  };
}

export function travelCardHtml(c: TravelCard): string {
  const row = (pl: string, en: string, value: string) => `<tr><th style="width:34%">${esc(pl)}<br><span class="muted">${esc(en)}</span></th><td>${value}</td></tr>`;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '—');
  return documentHtml({
    title: 'Karta zdrowia · Health card',
    subtitle: `${c.name}${c.birthDate ? ` · ur. / born ${plDate(c.birthDate)}` : ''}`,
    meta: [['Język / Language', 'PL · EN']],
    body: `<div class="box warn small">Informacje wpisane przez pacjenta, bez weryfikacji medycznej. · Information entered by the patient, not medically verified.<br>Numer alarmowy w UE / EU emergency number: <strong>112</strong></div>
    <table><tbody>
      ${row('Choroby przewlekłe', 'Chronic conditions', c.conditions.length ? `<ul>${c.conditions.map((x) => `<li>${esc(x.pl)} · <span class="muted">${esc(x.en)}</span></li>`).join('')}</ul>` : '—')}
      ${row('Uczulenia na leki', 'Drug allergies', c.allergies === undefined ? '<span class="muted">nie podano · not provided</span>' : c.allergies ? esc(c.allergies) : 'brak · none')}
      ${row('Przyjmowane leki', 'Current medicines', list(c.medications))}
      ${row('Szczepienia', 'Vaccinations', list(c.vaccinations))}
      ${row('Inne informacje', 'Other information', c.notes ? `<span style="white-space:pre-wrap">${esc(c.notes)}</span>` : '—')}
      ${row('Dyspozycje', 'Wishes', c.directives.length ? `<ul>${c.directives.map((d) => `<li>${esc(d.pl)}<br><span class="muted">${esc(d.en)}</span></li>`).join('')}</ul>` : '—')}
      ${row('Osoby do kontaktu', 'Emergency contacts', c.contacts.length ? `<ul>${c.contacts.map((x) => `<li>${esc(x.name)}${x.relation ? ` (${esc(x.relation)})` : ''}: ${esc(x.phone)}</li>`).join('')}</ul>` : '—')}
    </tbody></table>
    <p class="small muted">Jeśli masz Europejską Kartę Ubezpieczenia Zdrowotnego (EKUZ), zabierz ją ze sobą. · If you have a European Health Insurance Card (EHIC), take it with you.</p>`,
    templateVersion: c.version,
  });
}

