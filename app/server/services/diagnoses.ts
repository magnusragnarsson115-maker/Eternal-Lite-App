import type { Condition, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { getDb, transaction } from '../db.js';
import { ICD10 } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { searchIcd10 as searchIcd10Remote, type CodeHit } from '../integrations/terminology.js';
import { findHeader, normHeader, parseCsvRows, searchText } from '../lib/csv.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';

/**
 * Rozpoznania z kodem ICD-10 (A12.6). Kod wybiera lekarz ze słownika — aplikacja niczego nie koduje sama
 * (automatyczne kodowanie rozpoznań to F3.10, poza zakresem: wyrób medyczny). Rozpoznanie zapisujemy jako
 * FHIR Condition z autorem (lekarz) i datą.
 *
 * Słownik: pełna Międzynarodowa Statystyczna Klasyfikacja Chorób ICD-10 (wydanie polskie) z importu pliku
 * (`npm run cli -- import-icd10 <plik.csv>`); bez importu — krótka lista najczęstszych rozpoznań poniżej
 * (nazwy do sprawdzenia z wydaniem urzędowym) i, jeśli włączone, wyszukiwarka NLM ICD-10-CM (wersja
 * amerykańska — oznaczona w interfejsie).
 */

export const ICD10_COMMON: { code: string; name: string }[] = [
  { code: 'I10', name: 'Samoistne (pierwotne) nadciśnienie' },
  { code: 'I25', name: 'Przewlekła choroba niedokrwienna serca' },
  { code: 'I48', name: 'Migotanie i trzepotanie przedsionków' },
  { code: 'I50', name: 'Niewydolność serca' },
  { code: 'I83', name: 'Żylaki kończyn dolnych' },
  { code: 'E03.9', name: 'Niedoczynność tarczycy, nieokreślona' },
  { code: 'E05.9', name: 'Tyreotoksykoza, nieokreślona' },
  { code: 'E10', name: 'Cukrzyca insulinozależna' },
  { code: 'E11', name: 'Cukrzyca insulinoniezależna' },
  { code: 'E28.2', name: 'Zespół policystycznych jajników' },
  { code: 'E55.9', name: 'Niedobór witaminy D, nieokreślony' },
  { code: 'E66', name: 'Otyłość' },
  { code: 'E78.0', name: 'Czysta hipercholesterolemia' },
  { code: 'E78.5', name: 'Hiperlipidemia, nieokreślona' },
  { code: 'D50.9', name: 'Niedokrwistość z niedoboru żelaza, nieokreślona' },
  { code: 'J00', name: 'Ostre zapalenie nosa i gardła [przeziębienie]' },
  { code: 'J01.9', name: 'Ostre zapalenie zatok, nieokreślone' },
  { code: 'J02.9', name: 'Ostre zapalenie gardła, nieokreślone' },
  { code: 'J03.9', name: 'Ostre zapalenie migdałków, nieokreślone' },
  { code: 'J06.9', name: 'Ostre zakażenie górnych dróg oddechowych, nieokreślone' },
  { code: 'J18.9', name: 'Zapalenie płuc, nieokreślone' },
  { code: 'J20.9', name: 'Ostre zapalenie oskrzeli, nieokreślone' },
  { code: 'J30.4', name: 'Alergiczne zapalenie błony śluzowej nosa, nieokreślone' },
  { code: 'J44', name: 'Inna przewlekła obturacyjna choroba płuc' },
  { code: 'J45', name: 'Dychawica oskrzelowa [astma]' },
  { code: 'K21', name: 'Choroba refluksowa żołądkowo-przełykowa' },
  { code: 'K29.7', name: 'Zapalenie żołądka, nieokreślone' },
  { code: 'K58', name: 'Zespół jelita drażliwego' },
  { code: 'K59.0', name: 'Zaparcie' },
  { code: 'K80', name: 'Kamica żółciowa' },
  { code: 'N18', name: 'Przewlekła choroba nerek' },
  { code: 'N39.0', name: 'Zakażenie układu moczowego o nieokreślonym umiejscowieniu' },
  { code: 'N40', name: 'Rozrost gruczołu krokowego' },
  { code: 'N94.6', name: 'Bolesne miesiączkowanie, nieokreślone' },
  { code: 'N95.1', name: 'Stany menopauzalne i klimakteryczne u kobiet' },
  { code: 'M10', name: 'Dna [skaza moczanowa]' },
  { code: 'M16', name: 'Choroba zwyrodnieniowa stawu biodrowego' },
  { code: 'M17', name: 'Choroba zwyrodnieniowa stawu kolanowego' },
  { code: 'M54.5', name: 'Ból krzyża' },
  { code: 'M81', name: 'Osteoporoza bez patologicznego złamania' },
  { code: 'F32', name: 'Epizod depresyjny' },
  { code: 'F33', name: 'Zaburzenie depresyjne nawracające' },
  { code: 'F41.1', name: 'Zaburzenie lękowe uogólnione' },
  { code: 'F41.2', name: 'Zaburzenie depresyjne i lękowe mieszane' },
  { code: 'F43.2', name: 'Zaburzenia adaptacyjne' },
  { code: 'F51.0', name: 'Bezsenność nieorganiczna' },
  { code: 'G43', name: 'Migrena' },
  { code: 'G44.2', name: 'Ból głowy typu napięciowego' },
  { code: 'G47.3', name: 'Bezdech podczas snu' },
  { code: 'H10', name: 'Zapalenie spojówek' },
  { code: 'H66.9', name: 'Zapalenie ucha środkowego, nieokreślone' },
  { code: 'L20', name: 'Atopowe zapalenie skóry' },
  { code: 'L40', name: 'Łuszczyca' },
  { code: 'L70', name: 'Trądzik' },
  { code: 'B34.9', name: 'Zakażenie wirusowe, nieokreślone' },
  { code: 'U07.1', name: 'COVID-19, wirus zidentyfikowany' },
  { code: 'R05', name: 'Kaszel' },
  { code: 'R42', name: 'Zawroty głowy' },
  { code: 'R50.9', name: 'Gorączka, nieokreślona' },
  { code: 'R51', name: 'Ból głowy' },
  { code: 'Z00.0', name: 'Ogólne badanie lekarskie' },
  { code: 'Z34', name: 'Nadzór nad przebiegiem prawidłowej ciąży' },
  { code: 'Z76.0', name: 'Wystawienie powtórnej recepty' },
];

const CODE_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export function importedIcd10Count(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM icd10_code').get() as { n: number }).n;
}

/** Import słownika ICD-10 z pliku CSV (kolumny: kod i nazwa; separator ; , albo tabulator). */
export function importIcd10Csv(text: string): { imported: number; skipped: number } {
  const rows = parseCsvRows(text);
  const header = findHeader(rows, [
    ['kod', 'kod icd 10', 'code', 'symbol'],
    ['nazwa', 'opis', 'nazwa polska', 'name', 'description'],
  ]);
  if (!header) throw new Error('Nie znaleziono kolumn „kod” i „nazwa” w nagłówku pliku.');
  const [ci, ni] = header.cols;
  let imported = 0;
  let skipped = 0;
  const db = getDb();
  transaction(db, () => {
    db.prepare('DELETE FROM icd10_code').run();
    const ins = db.prepare('INSERT OR REPLACE INTO icd10_code (code, name, search_text) VALUES (?, ?, ?)');
    for (const r of rows.slice(header.index + 1)) {
      const code = (r[ci] ?? '').toUpperCase().replace(/\s/g, '');
      const name = (r[ni] ?? '').trim();
      if (!CODE_RE.test(code) || !name) {
        skipped++;
        continue;
      }
      ins.run(code, name.slice(0, 300), searchText(code, name));
      imported++;
    }
  });
  return { imported, skipped };
}

/** Słownik dla lekarza: import (pełny) albo lista najczęstszych; potem wyszukiwarka NLM (ICD-10-CM). */
export async function searchDiagnosisCodes(term: string): Promise<{ hits: CodeHit[]; dictionary: 'imported' | 'common'; remoteError?: string }> {
  const t = term.trim();
  if (t.length < 2) return { hits: [], dictionary: importedIcd10Count() ? 'imported' : 'common' };
  const q = normHeader(t);
  const codeLike = /^[a-z]\d/i.test(t);
  let local: CodeHit[];
  let dictionary: 'imported' | 'common';
  if (importedIcd10Count()) {
    dictionary = 'imported';
    const rows = getDb()
      .prepare(codeLike ? 'SELECT code, name FROM icd10_code WHERE code LIKE ? ORDER BY code LIMIT 20' : 'SELECT code, name FROM icd10_code WHERE search_text LIKE ? ORDER BY length(code), code LIMIT 20')
      .all(codeLike ? `${t.toUpperCase()}%` : `%${q}%`) as { code: string; name: string }[];
    local = rows.map((r) => ({ code: r.code, display: r.name, displayPl: r.name, system: ICD10, source: 'local' as const }));
  } else {
    dictionary = 'common';
    local = ICD10_COMMON.filter((c) => (codeLike ? c.code.startsWith(t.toUpperCase()) : normHeader(c.name).includes(q)))
      .slice(0, 20)
      .map((c) => ({ code: c.code, display: c.name, displayPl: c.name, system: ICD10, source: 'local' as const }));
  }
  if (local.length >= 10 || dictionary === 'imported') return { hits: local, dictionary };
  const remote = await searchIcd10Remote(t);
  return { hits: [...local, ...remote.hits.filter((h) => !local.some((l) => l.code === h.code))], dictionary, remoteError: remote.remoteError };
}

export interface DiagnosisView {
  id: string;
  code: string;
  display: string;
  system: string;
  status: 'active' | 'resolved' | 'inactive';
  onset?: string;
  recordedDate?: string;
  recorder?: string;
  note?: string;
}

function toView(c: Condition): DiagnosisView {
  const coding = c.code?.coding?.[0];
  return {
    id: c.id ?? '',
    code: coding?.code ?? '',
    display: c.code?.text ?? coding?.display ?? '',
    system: coding?.system ?? ICD10,
    status: (c.clinicalStatus?.coding?.[0]?.code as DiagnosisView['status']) ?? 'active',
    onset: c.onsetDateTime,
    recordedDate: c.recordedDate,
    recorder: c.recorder?.display,
    note: c.note?.[0]?.text,
  };
}

const CLINICAL = 'http://terminology.hl7.org/CodeSystem/condition-clinical';

export async function listDiagnoses(actor: AuditActor, patientId: string): Promise<DiagnosisView[]> {
  const items = await fhir().search<Condition>('Condition', { subject: `Patient/${patientId}`, _count: '200' });
  audit(actor, { action: 'R', subtype: 'diagnosis-list', patientRef: `Patient/${patientId}` });
  return items
    .filter((c) => c.verificationStatus?.coding?.[0]?.code !== 'entered-in-error')
    .map(toView)
    .sort((a, b) => (b.recordedDate ?? '').localeCompare(a.recordedDate ?? ''));
}

export async function addDiagnosis(
  actor: AuditActor,
  staff: AppUser,
  patientId: string,
  input: { code: string; display: string; system?: string; onset?: string; note?: string },
): Promise<DiagnosisView> {
  const patient = await fhir().readOptional<Patient>('Patient', patientId);
  if (!patient) throw notFound('patient_not_found');
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/.test(code)) throw badRequest('invalid_code');
  const system = input.system === 'http://hl7.org/fhir/sid/icd-10-cm' ? input.system : ICD10;
  const saved = await fhir().create<Condition>({
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: CLINICAL, code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: { coding: [{ system, code, display: input.display.trim().slice(0, 300) }], text: input.display.trim().slice(0, 300) },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: input.onset,
    recordedDate: nowIso(),
    recorder: { reference: staff.fhir_ref ?? `urn:eternal:user:${staff.id}`, display: staff.display_name },
    note: input.note?.trim() ? [{ text: input.note.trim().slice(0, 1000) }] : undefined,
  });
  audit(actor, { action: 'C', subtype: 'diagnosis-add', entityRef: `Condition/${saved.id}`, patientRef: `Patient/${patientId}`, detail: { code, system } });
  return toView(saved);
}

export async function setDiagnosisStatus(actor: AuditActor, id: string, status: 'active' | 'resolved' | 'inactive' | 'entered-in-error'): Promise<DiagnosisView> {
  const c = await fhir().readOptional<Condition>('Condition', id);
  if (!c) throw notFound('diagnosis_not_found');
  const next: Condition =
    status === 'entered-in-error'
      ? { ...c, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'entered-in-error' }] } }
      : { ...c, clinicalStatus: { coding: [{ system: CLINICAL, code: status }] }, abatementDateTime: status === 'resolved' ? nowIso() : undefined };
  const saved = await fhir().update<Condition>(next);
  audit(actor, { action: 'U', subtype: `diagnosis-${status}`, entityRef: `Condition/${id}`, patientRef: c.subject.reference });
  return toView(saved);
}
