import type { Attachment, DiagnosticReport, DocumentReference, Observation, Patient, Reference } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { findUserByFhirRef } from '../auth/users.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { ETERNAL, LOINC, OBS_CATEGORY, TAG_IDENTITY_VERIFIED, TAG_PATIENT_VISIBLE, UCUM, V2_0074 } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { badRequest, conflict, forbidden, newId, notFound, nowIso, sha256 } from '../lib/util.js';
import { hasConsent } from './consents.js';
import { notifyPatient } from './notifications.js';
import { hasTag } from './patients.js';

/**
 * Wyniki badań (DiagnosticReport + Observation) i dokumenty (DocumentReference).
 * Aplikacja NIE interpretuje wyników: prezentuje wartości, jednostki, zakresy referencyjne
 * i oznaczenia dokładnie tak, jak podało je laboratorium/lekarz.
 */

export interface ObservationInput {
  loinc?: string;
  name: string;
  value: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
  labFlag?: 'H' | 'L' | 'N' | 'A' | 'HH' | 'LL';
}

export interface ReportInput {
  patientId: string;
  title: string;
  loinc?: string;
  category: 'LAB' | 'RAD' | 'OTH';
  effective: string;
  laboratory?: string;
  conclusion?: string;
  observations: ObservationInput[];
  binaryId?: string;
}

export interface DocumentInput {
  patientId: string;
  title: string;
  kind: 'recommendations' | 'certificate' | 'referral-scan' | 'visit-summary' | 'other';
  text?: string;
  binaryId?: string;
  appointmentId?: string;
}

export interface RecordView {
  id: string;
  ref: string;
  type: 'report' | 'document';
  title: string;
  category: string;
  date: string;
  author?: string;
  laboratory?: string;
  shared: boolean;
  sharedAt?: string;
  readAt?: string;
  conclusion?: string;
  text?: string;
  attachment?: { binaryId: string; contentType: string; title?: string; size?: number };
  observations?: {
    id: string;
    name: string;
    loinc?: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    labFlag?: string;
  }[];
  patientId: string;
}

const DOC_KINDS: Record<DocumentInput['kind'], { code: string; display: string; pl: string }> = {
  recommendations: { code: '69730-0', display: 'Instructions', pl: 'Zalecenia' },
  // Zaświadczenie lekarskie nie ma jednoznacznego kodu LOINC — kod ogólny dokumentu administracyjnego.
  certificate: { code: '51851-4', display: 'Administrative note', pl: 'Zaświadczenie' },
  'referral-scan': { code: '57133-1', display: 'Referral note', pl: 'Skierowanie' },
  'visit-summary': { code: '34133-9', display: 'Summary of episode note', pl: 'Podsumowanie wizyty' },
  other: { code: '51851-4', display: 'Administrative note', pl: 'Dokument' },
};

const FLAG_DISPLAY: Record<string, string> = { H: 'High', L: 'Low', N: 'Normal', A: 'Abnormal', HH: 'Critical high', LL: 'Critical low' };

function isVisible(r: { meta?: { tag?: { system?: string; code?: string }[] } }): boolean {
  return hasTag(r, TAG_PATIENT_VISIBLE);
}

function extValue(r: { extension?: { url: string; valueDateTime?: string; valueReference?: Reference }[] }, url: string) {
  return r.extension?.find((e) => e.url === url);
}

function readAtFor(resourceRef: string, patientRef: string): string | undefined {
  const user = findUserByFhirRef(patientRef);
  if (!user) return undefined;
  const row = getDb().prepare('SELECT read_at FROM record_read WHERE user_id = ? AND resource_ref = ?').get(user.id, resourceRef) as { read_at: string } | undefined;
  return row?.read_at;
}

function attachmentView(a: Attachment | undefined) {
  if (!a?.url) return undefined;
  return { binaryId: idFromRef(a.url), contentType: a.contentType ?? 'application/octet-stream', title: a.title, size: a.size };
}

function rangeText(o: Observation): string | undefined {
  const r = o.referenceRange?.[0];
  if (!r) return undefined;
  if (r.text) return r.text;
  const low = r.low?.value;
  const high = r.high?.value;
  if (low !== undefined && high !== undefined) return `${low} – ${high}`;
  if (low !== undefined) return `≥ ${low}`;
  if (high !== undefined) return `≤ ${high}`;
  return undefined;
}

function observationView(o: Observation) {
  return {
    id: o.id ?? '',
    name: o.code.text ?? o.code.coding?.[0]?.display ?? '',
    loinc: o.code.coding?.find((c) => c.system === LOINC)?.code,
    value: o.valueQuantity?.value !== undefined ? String(o.valueQuantity.value) : (o.valueString ?? ''),
    unit: o.valueQuantity?.unit,
    referenceRange: rangeText(o),
    labFlag: o.interpretation?.[0]?.coding?.[0]?.code,
  };
}

async function reportView(r: DiagnosticReport, withObservations: boolean): Promise<RecordView> {
  const patientRef = r.subject?.reference ?? '';
  const ref = `DiagnosticReport/${r.id}`;
  let observations: RecordView['observations'];
  if (withObservations) {
    const ids = (r.result ?? []).map((x) => idFromRef(x.reference)).filter(Boolean);
    const obs = ids.length ? await fhir().search<Observation>('Observation', { _id: ids.join(',') }) : [];
    observations = ids.map((id) => obs.find((o) => o.id === id)).filter((o): o is Observation => !!o).map(observationView);
  }
  return {
    id: r.id ?? '',
    ref,
    type: 'report',
    title: r.code.text ?? r.code.coding?.[0]?.display ?? 'Wynik',
    category: r.category?.[0]?.coding?.[0]?.code ?? 'LAB',
    date: r.effectiveDateTime ?? r.issued ?? r.meta?.lastUpdated ?? '',
    author: r.resultsInterpreter?.[0]?.display ?? r.performer?.find((p) => p.reference?.startsWith('Practitioner/'))?.display,
    laboratory: r.performer?.find((p) => p.reference?.startsWith('Organization/') || !p.reference)?.display,
    shared: isVisible(r),
    sharedAt: extValue(r, ETERNAL.ext.sharedAt)?.valueDateTime,
    readAt: readAtFor(ref, patientRef),
    conclusion: r.conclusion,
    attachment: attachmentView(r.presentedForm?.[0]),
    observations,
    patientId: idFromRef(patientRef),
  };
}

function documentView(d: DocumentReference): RecordView {
  const patientRef = d.subject?.reference ?? '';
  const ref = `DocumentReference/${d.id}`;
  const att = d.content[0]?.attachment;
  const isText = att?.contentType?.startsWith('text/plain') && att.data;
  return {
    id: d.id ?? '',
    ref,
    type: 'document',
    title: d.description ?? d.type?.text ?? 'Dokument',
    category: d.type?.text ?? 'Dokument',
    date: d.date ?? d.meta?.lastUpdated ?? '',
    author: d.author?.[0]?.display,
    shared: isVisible(d),
    sharedAt: extValue(d, ETERNAL.ext.sharedAt)?.valueDateTime,
    readAt: readAtFor(ref, patientRef),
    text: isText ? Buffer.from(att.data ?? '', 'base64').toString('utf8') : undefined,
    attachment: isText ? undefined : attachmentView(att),
    patientId: idFromRef(patientRef),
  };
}

async function linkBinary(binaryId: string | undefined, patientRef: string, resourceRef: string): Promise<Attachment | undefined> {
  if (!binaryId) return undefined;
  const row = getDb().prepare('SELECT * FROM binary_owner WHERE binary_id = ?').get(binaryId) as
    | { binary_id: string; patient_ref: string | null; resource_ref: string | null; filename: string | null; content_type: string; size: number; sha256: string; created_at: string }
    | undefined;
  if (!row) throw badRequest('unknown_file');
  if (row.resource_ref && row.resource_ref !== resourceRef) throw conflict('file_already_attached');
  getDb().prepare('UPDATE binary_owner SET patient_ref = ?, resource_ref = ? WHERE binary_id = ?').run(patientRef, resourceRef, binaryId);
  const data = await fhir().readBinary(binaryId);
  return {
    contentType: row.content_type,
    url: `Binary/${binaryId}`,
    title: row.filename ?? undefined,
    size: row.size,
    hash: crypto.createHash('sha1').update(data.data).digest('base64'),
    creation: row.created_at,
  };
}

export async function registerUpload(
  actor: AuditActor,
  file: { data: Buffer; filename: string; contentType: string },
): Promise<{ binaryId: string; size: number; contentType: string }> {
  const allowed: Record<string, (b: Buffer) => boolean> = {
    'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
    'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  };
  const check = allowed[file.contentType];
  if (!check) throw badRequest('unsupported_file_type');
  if (!check(file.data)) throw badRequest('file_content_mismatch');
  if (file.data.length > 15 * 1024 * 1024) throw badRequest('file_too_large');
  const stored = await fhir().saveBinary(file.data, file.contentType, file.filename);
  getDb()
    .prepare('INSERT INTO binary_owner (binary_id, filename, content_type, size, sha256, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(stored.id, file.filename.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120), file.contentType, stored.size, sha256(file.data), actor.userId ?? null, nowIso());
  audit(actor, { action: 'C', subtype: 'file-upload', entityRef: `Binary/${stored.id}`, detail: { size: stored.size, type: file.contentType } });
  return { binaryId: stored.id, size: stored.size, contentType: file.contentType };
}

export async function createReport(actor: AuditActor, input: ReportInput): Promise<RecordView> {
  if (!input.title.trim()) throw badRequest('title_required');
  if (input.observations.length === 0 && !input.binaryId && !input.conclusion) throw badRequest('empty_report');
  const patient = await fhir().read<Patient>('Patient', input.patientId);
  const patientRef = `Patient/${patient.id}`;
  const effective = new Date(input.effective).toISOString();
  const practitionerRef = actor.actorRef?.startsWith('Practitioner/') ? actor.actorRef : undefined;

  const obsRefs: Reference<Observation>[] = [];
  for (const o of input.observations) {
    if (!o.name.trim() || !o.value.trim()) throw badRequest('observation_incomplete');
    const numeric = /^-?\d+([.,]\d+)?$/.test(o.value.trim()) ? Number(o.value.trim().replace(',', '.')) : undefined;
    const obs: Observation = {
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{ system: OBS_CATEGORY, code: input.category === 'LAB' ? 'laboratory' : 'imaging' }] }],
      code: { coding: o.loinc ? [{ system: LOINC, code: o.loinc, display: o.name }] : undefined, text: o.name },
      subject: { reference: patientRef },
      effectiveDateTime: effective,
      issued: nowIso(),
      ...(numeric !== undefined
        ? { valueQuantity: { value: numeric, unit: o.unit || undefined, system: o.unit ? UCUM : undefined, code: o.unit || undefined } }
        : { valueString: o.value.trim() }),
      referenceRange:
        o.refLow !== undefined || o.refHigh !== undefined || o.refText
          ? [
              {
                low: o.refLow !== undefined ? { value: o.refLow, unit: o.unit || undefined } : undefined,
                high: o.refHigh !== undefined ? { value: o.refHigh, unit: o.unit || undefined } : undefined,
                text: o.refText || undefined,
              },
            ]
          : undefined,
      interpretation: o.labFlag
        ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: o.labFlag, display: FLAG_DISPLAY[o.labFlag] }], text: 'Oznaczenie laboratorium' }]
        : undefined,
      performer: practitionerRef ? [{ reference: practitionerRef, display: actor.display }] : undefined,
    };
    const saved = await fhir().create(obs);
    obsRefs.push({ reference: `Observation/${saved.id}` });
  }

  const reportId = newId();
  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: reportId,
    status: 'final',
    category: [{ coding: [{ system: V2_0074, code: input.category, display: input.category === 'LAB' ? 'Laboratory' : input.category === 'RAD' ? 'Radiology' : 'Other' }] }],
    code: { coding: input.loinc ? [{ system: LOINC, code: input.loinc }] : undefined, text: input.title.trim() },
    subject: { reference: patientRef },
    effectiveDateTime: effective,
    issued: nowIso(),
    performer: [
      ...(input.laboratory ? [{ display: input.laboratory }] : []),
      ...(practitionerRef ? [{ reference: practitionerRef, display: actor.display }] : []),
    ],
    result: obsRefs.length ? obsRefs : undefined,
    conclusion: input.conclusion?.trim() || undefined,
  };
  const att = await linkBinary(input.binaryId, patientRef, `DiagnosticReport/${reportId}`);
  if (att) report.presentedForm = [att];
  const saved = await fhir().create(report);
  audit(actor, { action: 'C', subtype: 'report-create', entityRef: `DiagnosticReport/${saved.id}`, patientRef });
  bus.publish({ type: 'report.changed', patientRef, resourceRef: `DiagnosticReport/${saved.id}`, staff: true });
  return reportView(saved, true);
}

export async function createDocument(actor: AuditActor, input: DocumentInput): Promise<RecordView> {
  if (!input.title.trim()) throw badRequest('title_required');
  if (!input.text?.trim() && !input.binaryId) throw badRequest('empty_document');
  const patient = await fhir().read<Patient>('Patient', input.patientId);
  const patientRef = `Patient/${patient.id}`;
  const kind = DOC_KINDS[input.kind];
  const id = newId();
  const attachment: Attachment =
    (await linkBinary(input.binaryId, patientRef, `DocumentReference/${id}`)) ??
    ({
      contentType: 'text/plain; charset=utf-8',
      data: Buffer.from(input.text?.trim() ?? '', 'utf8').toString('base64'),
      title: input.title.trim(),
      creation: nowIso(),
    } satisfies Attachment);
  const doc: DocumentReference = {
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    docStatus: 'final',
    type: { coding: [{ system: LOINC, code: kind.code, display: kind.display }], text: kind.pl },
    subject: { reference: patientRef },
    date: nowIso(),
    author: actor.actorRef?.startsWith('Practitioner/') ? [{ reference: actor.actorRef, display: actor.display }] : undefined,
    description: input.title.trim(),
    content: [{ attachment }],
    context: input.appointmentId ? { related: [{ reference: `Appointment/${input.appointmentId}` }] } : undefined,
  };
  const saved = await fhir().create(doc);
  audit(actor, { action: 'C', subtype: 'document-create', entityRef: `DocumentReference/${saved.id}`, patientRef });
  bus.publish({ type: 'document.changed', patientRef, resourceRef: `DocumentReference/${saved.id}`, staff: true });
  return documentView(saved);
}

type Shareable = DiagnosticReport | DocumentReference;

async function loadShareable(ref: string): Promise<Shareable> {
  const [type, id] = ref.split('/');
  if (type === 'DiagnosticReport') return fhir().read<DiagnosticReport>('DiagnosticReport', id);
  if (type === 'DocumentReference') return fhir().read<DocumentReference>('DocumentReference', id);
  throw badRequest('invalid_record_ref');
}

export async function setShared(actor: AuditActor, ref: string, shared: boolean): Promise<RecordView> {
  const r = await loadShareable(ref);
  const patientRef = r.subject?.reference ?? '';
  const patient = await fhir().read<Patient>('Patient', idFromRef(patientRef));
  if (shared && !hasTag(patient, TAG_IDENTITY_VERIFIED)) throw conflict('identity_not_verified');
  if (isVisible(r) === shared) return r.resourceType === 'DiagnosticReport' ? reportView(r, true) : documentView(r);
  const otherTags = (r.meta?.tag ?? []).filter((t) => !(t.system === TAG_PATIENT_VISIBLE.system && t.code === TAG_PATIENT_VISIBLE.code));
  const otherExt = (r.extension ?? []).filter((e) => e.url !== ETERNAL.ext.sharedAt && e.url !== ETERNAL.ext.sharedBy);
  const next = {
    ...r,
    meta: { ...r.meta, tag: shared ? [...otherTags, TAG_PATIENT_VISIBLE] : otherTags },
    extension: shared
      ? [
          ...otherExt,
          { url: ETERNAL.ext.sharedAt, valueDateTime: nowIso() },
          ...(actor.actorRef?.startsWith('Practitioner/') ? [{ url: ETERNAL.ext.sharedBy, valueReference: { reference: actor.actorRef, display: actor.display } }] : []),
        ]
      : otherExt,
  } as Shareable;
  if (!next.extension?.length) delete next.extension;
  const saved = await fhir().update(next);
  audit(actor, { action: 'U', subtype: shared ? 'record-share' : 'record-unshare', entityRef: ref, patientRef });
  bus.publish({ type: saved.resourceType === 'DiagnosticReport' ? 'report.changed' : 'document.changed', patientRef, resourceRef: ref });
  if (shared) {
    // Treść powiadomienia celowo bez nazwy badania — powiadomienia push/e-mail mogą być widoczne na ekranie blokady.
    await notifyPatient(patientRef, {
      kind: 'record-shared',
      title: 'Nowe wyniki lub dokumenty',
      body: 'Placówka udostępniła Ci nowe wyniki lub dokumenty. Zaloguj się, aby je zobaczyć.',
      link: `/wyniki/${saved.resourceType === 'DiagnosticReport' ? 'r' : 'd'}/${saved.id}`,
    });
  }
  return saved.resourceType === 'DiagnosticReport' ? reportView(saved, true) : documentView(saved);
}

export async function listPatientRecords(patientRef: string, opts: { onlyShared: boolean }): Promise<RecordView[]> {
  const params: Record<string, string> = { subject: patientRef, _count: '500' };
  if (opts.onlyShared) params._tag = `${TAG_PATIENT_VISIBLE.system}|${TAG_PATIENT_VISIBLE.code}`;
  const [reports, docs] = await Promise.all([
    fhir().search<DiagnosticReport>('DiagnosticReport', params),
    fhir().search<DocumentReference>('DocumentReference', { ...params, status: 'current' }),
  ]);
  const views = [...(await Promise.all(reports.map((r) => reportView(r, false)))), ...docs.map(documentView)];
  return views.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getRecord(ref: string, access: { patientRef?: string }): Promise<RecordView> {
  const r = await loadShareable(ref).catch(() => {
    throw notFound('record_not_found');
  });
  if (access.patientRef) {
    if (r.subject?.reference !== access.patientRef || !isVisible(r)) throw notFound('record_not_found');
  }
  return r.resourceType === 'DiagnosticReport' ? reportView(r, true) : documentView(r);
}

export async function patientCanViewRecords(patientRef: string): Promise<{ allowed: boolean; reason?: 'identity_not_verified' | 'consent_missing' }> {
  const patient = await fhir().read<Patient>('Patient', idFromRef(patientRef));
  if (!hasTag(patient, TAG_IDENTITY_VERIFIED)) return { allowed: false, reason: 'identity_not_verified' };
  if (!(await hasConsent(patientRef, 'results-online'))) return { allowed: false, reason: 'consent_missing' };
  return { allowed: true };
}

/** Potwierdzenie odczytu; pierwszy odczyt powiadamia personel (status „odczytano” w karcie pacjenta). */
export function markRead(userId: string, ref: string, patientRef?: string): boolean {
  const res = getDb().prepare('INSERT OR IGNORE INTO record_read (user_id, resource_ref, read_at) VALUES (?, ?, ?)').run(userId, ref, nowIso());
  const first = res.changes > 0;
  if (first) bus.publish({ type: ref.startsWith('DiagnosticReport/') ? 'report.changed' : 'document.changed', patientRef, resourceRef: ref });
  return first;
}

/** Dostęp do pliku: pacjent tylko do plików udostępnionych mu dokumentów; personel kliniczny — do wszystkich. */
export async function readBinaryFor(binaryId: string, access: { patientRef?: string; clinician?: boolean }) {
  const row = getDb().prepare('SELECT * FROM binary_owner WHERE binary_id = ?').get(binaryId) as
    | { patient_ref: string | null; resource_ref: string | null; filename: string | null; content_type: string }
    | undefined;
  if (!row) throw notFound('file_not_found');
  if (access.patientRef) {
    if (!row.resource_ref || row.patient_ref !== access.patientRef) throw notFound('file_not_found');
    const r = await loadShareable(row.resource_ref);
    if (!isVisible(r)) throw notFound('file_not_found');
  } else if (!access.clinician) {
    throw forbidden();
  }
  const data = await fhir().readBinary(binaryId);
  return { ...data, filename: row.filename ?? `plik-${binaryId}`, resourceRef: row.resource_ref, patientRef: row.patient_ref };
}
