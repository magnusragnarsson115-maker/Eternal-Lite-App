import type { Attachment, DiagnosticReport, DocumentReference, Observation, Reference } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { aiMode, runAiTask } from '../ai/gateway.js';
import { readDocument } from '../ai/ocr.js';
import { DocStructureSchema, type DocStructure, LabExtractSchema } from '../ai/schemas.js';
import { AiError } from '../ai/types.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { ETERNAL, LOINC, OBS_CATEGORY, TAG_PATIENT_VISIBLE, TRUST, UCUM, V2_0074 } from '../fhir/constants.js';
import { fhirSystem } from '../fhir/index.js';
import { recordProvenance, type ProvenanceAgent } from '../fhir/provenance.js';
import { DICTIONARY_VERSION } from '../labs/dictionary.js';
import { type DocLine, isoDate, mergeModelItems, numberedText, parseLabDocument, type ParsedItem } from '../labs/parser.js';
import { badRequest, conflict, newId, notFound, nowIso } from '../lib/util.js';
import type { DocumentKind } from '../settings.js';
import { orgTag, runInScope, vaultOrgId } from '../tenancy.js';
import { notifyPatient } from './notifications.js';
import { registerUpload } from './records.js';

/**
 * Przyjęcie dokumentów od pacjenta (P3, D1, F3.1–F3.5, A2.1–A2.3, A2.7, F3.9).
 * Plik → odczyt (warstwa tekstowa PDF albo usługa OCR) → rozbiór regułami + model (opcjonalnie) → walidacja
 * (każda wartość musi wystąpić w tekście dokumentu) → pacjent potwierdza albo poprawia niepewne pola → zapis FHIR
 * w sejfie pacjenta z pochodzeniem (Provenance). Nic nie jest oceniane: zakres i oznaczenie tylko z dokumentu.
 */

export type IntakeStatus = 'processing' | 'needs_review' | 'submitted' | 'confirmed' | 'unreadable' | 'failed';
export type ItemState = 'pending' | 'confirmed' | 'corrected' | 'rejected';

export interface IntakeField extends ParsedItem {
  state: ItemState;
  original?: { name: string; value: string; unit?: string; rangeText?: string; flag?: string };
  confirmedBy?: 'patient' | 'clinician';
}

export interface IntakeExtract {
  kind: DocumentKind;
  lines: DocLine[];
  items: IntakeField[];
  laboratory?: string;
  collectedAt?: string;
  doc?: { documentType: DocStructure['documentType']; issuedAt?: string; issuer?: string; sections: { title: string; lines: number[] }[]; accessCode?: string };
  engine: { reader: string; parser: string; ai?: { provider: string; model: string; promptVersion: string; demo: boolean }; aiError?: string; rejected: number };
}

export interface IntakeRow {
  id: string;
  org_id: string | null;
  patient_ref: string;
  appointment_id: string | null;
  invite_id: string | null;
  uploaded_by: string;
  binary_id: string;
  filename: string | null;
  content_type: string;
  kind: string;
  status: IntakeStatus;
  ocr_provider: string | null;
  ocr_text: string | null;
  ocr_pages: number | null;
  extracted: string | null;
  laboratory: string | null;
  collected_at: string | null;
  document_ref: string | null;
  report_ref: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  source: 'invite' | 'app' | 'staff';
}

export interface IntakeView {
  id: string;
  patientId: string;
  appointmentId?: string;
  source: IntakeRow['source'];
  filename?: string;
  contentType: string;
  kind: DocumentKind | 'unknown';
  status: IntakeStatus;
  error?: string;
  laboratory?: string;
  collectedAt?: string;
  createdAt: string;
  confirmedAt?: string;
  documentRef?: string;
  reportRef?: string;
  extract?: IntakeExtract;
  counts: { items: number; confirmed: number; pending: number; flagged: number };
}

export interface IntakeContext {
  actor: AuditActor;
  patientRef: string;
  orgId?: string;
  inviteId?: string;
  appointmentId?: string;
  source: IntakeRow['source'];
  /** Kto potwierdza pola: pacjent (link, aplikacja) albo personel z udostępnieniem. */
  confirmer: 'patient' | 'clinician';
}

export const KIND_LABEL: Record<DocumentKind, string> = {
  lab: 'Wyniki badań laboratoryjnych',
  discharge: 'Karta informacyjna (wypis ze szpitala)',
  imaging: 'Opis badania obrazowego',
  referral: 'Skierowanie',
  prescription: 'Recepta',
  certificate: 'Zaświadczenie',
  other: 'Dokument medyczny',
};

const KIND_LOINC: Record<DocumentKind, { code: string; display: string }> = {
  lab: { code: '11502-2', display: 'Laboratory report' },
  discharge: { code: '18842-5', display: 'Discharge summary' },
  imaging: { code: '18748-4', display: 'Diagnostic imaging study' },
  referral: { code: '57133-1', display: 'Referral note' },
  prescription: { code: '57833-6', display: 'Prescription for medication' },
  certificate: { code: '51851-4', display: 'Administrative note' },
  other: { code: '51851-4', display: 'Administrative note' },
};

const DOC_TYPE_KIND: Record<DocStructure['documentType'], DocumentKind> = {
  'karta-wypisowa': 'discharge',
  recepta: 'prescription',
  zaswiadczenie: 'certificate',
  skierowanie: 'referral',
  'opis-badania': 'imaging',
  inny: 'other',
};

const FLAG_CODE: Record<string, string> = { H: 'H', L: 'L', HH: 'HH', LL: 'LL', '↑': 'H', '↓': 'L', '*': 'A', '!': 'A', '+': 'A', '<<': 'LL', '>>': 'HH' };

// --- odczyt i rozbiór --------------------------------------------------------------------------------

/** Minimalizacja danych przed wysłaniem tekstu do modelu: PESEL, telefony, adresy e-mail zastąpione znacznikiem. */
export function redactIdentifiers(text: string): string {
  return text
    .replace(/\b\d{11}\b/g, '[PESEL]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[E-MAIL]')
    .replace(/(?:\+48[\s-]?)?\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/g, '[TELEFON]');
}

const HEADING_RE =
  /^(rozpoznanie(?: zasadnicze| główne)?|rozpoznania współistniejące|epikryza|zalecenia(?: lekarskie| przy wypisie)?|leki|leczenie|wywiad|badanie przedmiotowe|przebieg hospitalizacji|wyniki badań(?: dodatkowych)?|opis badania|wnioski|cel skierowania|skierowanie do|rozpoznanie wstępne|treść zaświadczenia)\s*:?/i;

/** Rozpoznanie rodzaju i podział na sekcje bez modelu (tryb demonstracyjny i tryb ograniczony przy awarii — A18.8). */
export function heuristicStructure(lines: DocLine[]): DocStructure {
  const all = lines.map((l) => l.text).join('\n').toLowerCase();
  let documentType: DocStructure['documentType'] = 'inny';
  if (/karta informacyjna|wypis|leczenia szpitalnego|hospitalizacj/.test(all)) documentType = 'karta-wypisowa';
  else if (/recepta|rp\.|kod dostępu.*recept/.test(all)) documentType = 'recepta';
  else if (/zaświadczeni/.test(all)) documentType = 'zaswiadczenie';
  else if (/skierowani/.test(all)) documentType = 'skierowanie';
  else if (/\b(usg|rtg|tk|mr|rezonans|tomografi|ultrasonograf|opis badania)\b/.test(all)) documentType = 'opis-badania';
  const sections: { title: string; lines: number[] }[] = [];
  let current: { title: string; lines: number[] } | undefined;
  lines.forEach((l, i) => {
    const t = l.text.trim();
    const m = t.match(HEADING_RE);
    const upperHeading = t.length >= 4 && t.length <= 60 && t === t.toUpperCase() && /\p{Lu}{4}/u.test(t);
    if (m || upperHeading) {
      current = { title: (m ? m[1] : t).replace(/:$/, '').replace(/^\p{Ll}/u, (c) => c.toUpperCase()), lines: [] };
      sections.push(current);
      const rest = m ? t.slice(m[0].length).trim() : '';
      if (rest) current.lines.push(i + 1);
      return;
    }
    if (!current) {
      current = { title: 'Treść', lines: [] };
      sections.push(current);
    }
    current.lines.push(i + 1);
  });
  const date = all.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[.-]\d{1,2}[.-]\d{4})/);
  const code = all.match(/kod(?:u)? (?:dostępu|recepty|skierowania)[^0-9]{0,15}(\d{4})\b/);
  return { documentType, issuedAt: date ? date[1] : null, issuer: lines[0]?.text.slice(0, 120) ?? null, sections: sections.filter((s) => s.lines.length), accessCode: code ? code[1] : null };
}

export function rowById(id: string): IntakeRow | undefined {
  return getDb().prepare('SELECT * FROM intake_item WHERE id = ?').get(id) as IntakeRow | undefined;
}

function save(id: string, patch: Partial<Record<keyof IntakeRow, string | number | null>>): void {
  const keys = Object.keys(patch);
  getDb()
    .prepare(`UPDATE intake_item SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => patch[k as keyof IntakeRow] ?? null), nowIso(), id);
}

function publish(row: Pick<IntakeRow, 'patient_ref' | 'org_id' | 'id'>): void {
  bus.publish({ type: 'intake.changed', patientRef: row.patient_ref, resourceRef: `urn:eternal:intake:${row.id}`, orgIds: row.org_id ? [row.org_id] : undefined });
}

export async function uploadIntake(ctx: IntakeContext, file: { data: Buffer; filename: string; contentType: string }, hint?: DocumentKind, opts: { background?: boolean } = {}): Promise<IntakeView> {
  const uploaded = await registerUpload(ctx.actor, file);
  getDb().prepare('UPDATE binary_owner SET patient_ref = ? WHERE binary_id = ?').run(ctx.patientRef, uploaded.binaryId);
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO intake_item (id, org_id, patient_ref, appointment_id, invite_id, uploaded_by, binary_id, filename, content_type, kind, status, created_at, updated_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
    )
    .run(
      id,
      ctx.orgId ?? null,
      ctx.patientRef,
      ctx.appointmentId ?? null,
      ctx.inviteId ?? null,
      ctx.actor.userId ?? ctx.actor.actorRef ?? 'link',
      uploaded.binaryId,
      file.filename.slice(0, 120),
      file.contentType,
      hint ?? 'unknown',
      now,
      now,
      ctx.source,
    );
  audit(ctx.actor, { action: 'C', subtype: 'intake-upload', entityRef: `Binary/${uploaded.binaryId}`, patientRef: ctx.patientRef, detail: { intake: id, source: ctx.source } });
  const row = rowById(id)!;
  publish(row);
  // odczyt w tle; strona pacjenta odpytuje stan, panel dostaje zdarzenie (background=false: wywołujący sam czeka na processIntake)
  if (opts.background !== false) setImmediate(() => void runInScope({ patientRef: ctx.patientRef, patientOrgIds: ctx.orgId ? [ctx.orgId] : [] }, () => processIntake(id)));
  return toIntakeView(row, true);
}

export async function processIntake(id: string): Promise<void> {
  const row = rowById(id);
  if (!row) return;
  try {
    const bin = await fhirSystem().readBinary(row.binary_id);
    let read;
    try {
      read = await readDocument(bin.data, row.content_type);
    } catch (err) {
      const code = err instanceof AiError ? err.code : 'read_failed';
      save(id, { status: 'unreadable', error: code });
      publish(row);
      return;
    }
    const lines = read.lines.filter((l) => l.text.trim());
    if (!lines.length) {
      save(id, { status: 'unreadable', error: 'no_text', ocr_provider: read.provider, ocr_pages: read.pages });
      publish(row);
      return;
    }
    const engine: IntakeExtract['engine'] = { reader: read.provider, parser: DICTIONARY_VERSION, rejected: 0 };
    const parsed = parseLabDocument(lines);
    const hint = row.kind as DocumentKind | 'unknown';
    const isLab = hint === 'lab' || (hint === 'unknown' && parsed.items.length >= 2);
    let extract: IntakeExtract;
    const text = redactIdentifiers(numberedText(lines));
    if (isLab) {
      let result = parsed;
      if (aiMode() !== 'off') {
        try {
          const ai = await runAiTask('lab-extract', {
            user: text,
            schema: LabExtractSchema,
            orgId: row.org_id ?? undefined,
            demo: () => ({ laboratory: null, collectedAt: null, items: [] }),
          });
          engine.ai = { provider: ai.provider, model: ai.model, promptVersion: ai.promptVersion, demo: ai.demo };
          result = mergeModelItems(parsed, lines, ai.data.items);
          if (!result.laboratory && ai.data.laboratory && text.includes(ai.data.laboratory)) result.laboratory = ai.data.laboratory;
          if (!result.collectedAt && ai.data.collectedAt) result.collectedAt = isoDate(ai.data.collectedAt);
        } catch (err) {
          // tryb ograniczony: reguły bez modelu (A18.8)
          engine.aiError = err instanceof AiError ? err.code : 'ai_failed';
        }
      }
      engine.rejected = result.rejected;
      extract = {
        kind: 'lab',
        lines,
        items: result.items.map((i) => ({ ...i, state: 'pending' as ItemState })),
        laboratory: result.laboratory,
        collectedAt: result.collectedAt,
        engine,
      };
    } else {
      let structure = heuristicStructure(lines);
      if (aiMode() !== 'off') {
        try {
          const ai = await runAiTask('doc-structure', { user: text, schema: DocStructureSchema, orgId: row.org_id ?? undefined, demo: () => heuristicStructure(lines) });
          engine.ai = { provider: ai.provider, model: ai.model, promptVersion: ai.promptVersion, demo: ai.demo };
          // tylko numery istniejących linii; treść zawsze kopiowana z dokumentu
          const valid = ai.data.sections
            .map((s) => ({ title: s.title.slice(0, 80), lines: s.lines.filter((n) => Number.isInteger(n) && n >= 1 && n <= lines.length) }))
            .filter((s) => s.lines.length);
          const code = ai.data.accessCode && text.includes(ai.data.accessCode) ? ai.data.accessCode : null;
          structure = { ...ai.data, sections: valid.length ? valid : structure.sections, accessCode: code, issuer: ai.data.issuer && text.includes(ai.data.issuer) ? ai.data.issuer : structure.issuer };
        } catch (err) {
          engine.aiError = err instanceof AiError ? err.code : 'ai_failed';
        }
      }
      const kind: DocumentKind = hint !== 'unknown' ? hint : DOC_TYPE_KIND[structure.documentType];
      extract = {
        kind,
        lines,
        items: [],
        doc: {
          documentType: structure.documentType,
          issuedAt: structure.issuedAt ? isoDate(structure.issuedAt) : undefined,
          issuer: structure.issuer ?? undefined,
          sections: structure.sections,
          accessCode: structure.accessCode ?? undefined,
        },
        engine,
      };
    }
    save(id, {
      status: 'needs_review',
      kind: extract.kind,
      ocr_provider: read.provider,
      ocr_pages: read.pages,
      ocr_text: lines.map((l) => l.text).join('\n'),
      extracted: JSON.stringify(extract),
      laboratory: extract.laboratory ?? extract.doc?.issuer ?? null,
      collected_at: extract.collectedAt ?? extract.doc?.issuedAt ?? null,
      error: null,
    });
  } catch (err) {
    save(id, { status: 'failed', error: (err as Error).message.slice(0, 200) });
  }
  publish(row);
}

// --- widoki ------------------------------------------------------------------------------------------

export function toIntakeView(row: IntakeRow, withExtract: boolean): IntakeView {
  const extract = row.extracted ? (JSON.parse(row.extracted) as IntakeExtract) : undefined;
  const items = extract?.items ?? [];
  return {
    id: row.id,
    patientId: row.patient_ref.split('/')[1],
    appointmentId: row.appointment_id ?? undefined,
    source: row.source,
    filename: row.filename ?? undefined,
    contentType: row.content_type,
    kind: (row.kind as DocumentKind) ?? 'unknown',
    status: row.status,
    error: row.error ?? undefined,
    laboratory: row.laboratory ?? undefined,
    collectedAt: row.collected_at ?? undefined,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined,
    documentRef: row.document_ref ?? undefined,
    reportRef: row.report_ref ?? undefined,
    extract: withExtract ? extract : undefined,
    counts: {
      items: items.filter((i) => i.state !== 'rejected').length,
      confirmed: items.filter((i) => i.state === 'confirmed' || i.state === 'corrected').length,
      pending: items.filter((i) => i.state === 'pending').length,
      flagged: items.filter((i) => i.state !== 'rejected' && i.flag).length,
    },
  };
}

export function getIntake(id: string, access: { patientRef: string }): IntakeRow {
  const row = rowById(id);
  if (!row || row.patient_ref !== access.patientRef) throw notFound('intake_not_found');
  return row;
}

export function listIntake(filter: { patientRef?: string; appointmentId?: string; inviteId?: string; since?: string }): IntakeRow[] {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.patientRef) { where.push('patient_ref = ?'); args.push(filter.patientRef); }
  if (filter.appointmentId) { where.push('appointment_id = ?'); args.push(filter.appointmentId); }
  if (filter.inviteId) { where.push('invite_id = ?'); args.push(filter.inviteId); }
  if (filter.since) { where.push('created_at >= ?'); args.push(filter.since); }
  return getDb().prepare(`SELECT * FROM intake_item ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 300`).all(...args) as unknown as IntakeRow[];
}

// --- potwierdzanie i poprawki ---------------------------------------------------------------------------

export interface FieldReview {
  id: string;
  action: 'confirm' | 'correct' | 'reject';
  name?: string;
  value?: string;
  unit?: string;
  rangeText?: string;
}

function applyReview(extract: IntakeExtract, reviews: FieldReview[], who: 'patient' | 'clinician'): IntakeExtract {
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const items = extract.items.map((it): IntakeField => {
    const r = byId.get(it.id);
    if (!r) return it;
    if (r.action === 'reject') return { ...it, state: 'rejected', confirmedBy: who };
    if (r.action === 'confirm') return { ...it, state: 'confirmed', confirmedBy: who };
    const value = (r.value ?? it.value).trim();
    if (!value || value.length > 40) throw badRequest('invalid_value');
    const original = it.original ?? { name: it.name, value: it.value, unit: it.unitRaw, rangeText: it.rangeText, flag: it.flag };
    const num = /^[<>≤≥]?=?\s?-?\d+([.,]\d+)?$/.test(value) ? Number(value.replace(/^[<>≤≥]=?\s?/, '').replace(',', '.')) : undefined;
    return {
      ...it,
      name: (r.name ?? it.name).trim().slice(0, 120) || it.name,
      value,
      valueNum: num,
      unitRaw: r.unit !== undefined ? r.unit.trim() || undefined : it.unitRaw,
      unit: r.unit !== undefined ? r.unit.trim() || undefined : it.unit,
      rangeText: r.rangeText !== undefined ? r.rangeText.trim() || undefined : it.rangeText,
      state: 'corrected',
      original,
      confirmedBy: who,
    };
  });
  return { ...extract, items };
}

export function reviewIntake(ctx: IntakeContext, id: string, input: { items?: FieldReview[]; collectedAt?: string; laboratory?: string }): IntakeView {
  const row = getIntake(id, { patientRef: ctx.patientRef });
  if (!['needs_review', 'submitted'].includes(row.status) || !row.extracted) throw conflict('intake_not_reviewable');
  if (row.status === 'submitted' && ctx.confirmer === 'patient') throw conflict('intake_already_submitted');
  let extract = JSON.parse(row.extracted) as IntakeExtract;
  if (input.items?.length) extract = applyReview(extract, input.items, ctx.confirmer);
  if (input.collectedAt) {
    const d = isoDate(input.collectedAt);
    if (!d) throw badRequest('invalid_date');
    extract.collectedAt = d;
  }
  if (input.laboratory !== undefined) extract.laboratory = input.laboratory.trim().slice(0, 120) || undefined;
  save(id, { extracted: JSON.stringify(extract), collected_at: extract.collectedAt ?? row.collected_at, laboratory: extract.laboratory ?? row.laboratory });
  audit(ctx.actor, {
    action: 'U',
    subtype: 'intake-review',
    patientRef: row.patient_ref,
    detail: { intake: id, confirmed: input.items?.filter((i) => i.action === 'confirm').length ?? 0, corrected: input.items?.filter((i) => i.action === 'correct').length ?? 0 },
  });
  const next = rowById(id)!;
  publish(next);
  return toIntakeView(next, true);
}

// --- zapis do rekordu (FHIR) ---------------------------------------------------------------------------

function trustOf(it: IntakeField) {
  if (it.state === 'pending') return TRUST.machineUnconfirmed;
  return it.confirmedBy === 'clinician' ? TRUST.clinicianConfirmed : TRUST.patientConfirmed;
}

function observationFor(it: IntakeField, patientRef: string, docRef: string, effective: string, laboratory: string | undefined, tags: { system?: string; code?: string }[]): Observation {
  const flag = it.flag ? FLAG_CODE[it.flag] : undefined;
  return {
    resourceType: 'Observation',
    meta: { tag: [...tags, trustOf(it)] },
    status: it.state === 'pending' ? 'preliminary' : 'final',
    category: [{ coding: [{ system: OBS_CATEGORY, code: 'laboratory' }] }],
    code: {
      coding: it.match ? [{ system: LOINC, code: it.match.loinc, display: it.match.loincDisplay }] : undefined,
      text: it.name,
    },
    subject: { reference: patientRef },
    effectiveDateTime: effective,
    issued: nowIso(),
    performer: laboratory ? [{ display: laboratory }] : undefined,
    ...(it.valueNum !== undefined && !it.comparator
      ? { valueQuantity: { value: it.valueNum, unit: it.unitRaw ?? it.unit, system: it.unit ? UCUM : undefined, code: it.unit } }
      : it.valueNum !== undefined && it.comparator
        ? { valueQuantity: { value: it.valueNum, comparator: it.comparator, unit: it.unitRaw ?? it.unit, system: it.unit ? UCUM : undefined, code: it.unit } }
        : { valueString: it.value }),
    referenceRange:
      it.rangeText || it.refLow !== undefined || it.refHigh !== undefined
        ? [
            {
              low: it.refLow !== undefined ? { value: it.refLow, unit: it.unitRaw ?? it.unit, system: it.unit ? UCUM : undefined, code: it.unit } : undefined,
              high: it.refHigh !== undefined ? { value: it.refHigh, unit: it.unitRaw ?? it.unit, system: it.unit ? UCUM : undefined, code: it.unit } : undefined,
              text: it.rangeText ? `${it.rangeText} (zakres z dokumentu laboratorium)` : undefined,
            },
          ]
        : undefined,
    interpretation: flag
      ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: flag }], text: `Oznaczenie laboratorium: ${it.flag}` }]
      : undefined,
    derivedFrom: [{ reference: docRef }],
    extension: [
      { url: ETERNAL.ext.sourceLine, valueInteger: it.line + 1 },
      { url: ETERNAL.ext.sourceText, valueString: it.sourceText.slice(0, 300) },
      { url: ETERNAL.ext.confidence, valueCode: it.confidence },
      ...(it.original ? [{ url: ETERNAL.ext.correctionReason, valueString: `Poprawione przy potwierdzaniu odczytu (odczyt maszynowy: ${it.original.value}${it.original.unit ? ` ${it.original.unit}` : ''})` }] : []),
    ],
  };
}

/**
 * „Gotowe — lekarz zobaczy przed wizytą”: zapis do rekordu. Pola niepotwierdzone zostają jako odczyt maszynowy
 * (status preliminary, znacznik machine-unconfirmed) — raport faktów pokaże je osobno.
 */
export async function submitIntake(ctx: IntakeContext, id: string): Promise<IntakeView> {
  const row = getIntake(id, { patientRef: ctx.patientRef });
  if (row.status === 'submitted' || row.status === 'confirmed') return toIntakeView(row, true);
  if (row.status === 'processing') throw conflict('intake_processing');
  const extract = row.extracted ? (JSON.parse(row.extracted) as IntakeExtract) : undefined;
  const kind: DocumentKind = extract?.kind ?? 'other';
  const patientRef = row.patient_ref;
  const vault = orgTag(vaultOrgId(patientRef));
  const kindTag = { system: ETERNAL.intakeKind, code: kind, display: KIND_LABEL[kind] };
  const docId = newId();
  const bin = getDb().prepare('SELECT * FROM binary_owner WHERE binary_id = ?').get(row.binary_id) as { size: number; filename: string | null; created_at: string };
  const original: Attachment = { contentType: row.content_type, url: `Binary/${row.binary_id}`, title: row.filename ?? undefined, size: bin?.size, creation: bin?.created_at };
  const sectionsText = extract?.doc
    ? extract.doc.sections.map((s) => `== ${s.title} ==\n${s.lines.map((n) => extract.lines[n - 1]?.text ?? '').join('\n')}`).join('\n\n')
    : undefined;
  // data pobrania/wystawienia z dokumentu (sam dzień — dokument zwykle nie podaje godziny); bez daty — dzień wgrania
  const effectiveIso = extract?.collectedAt ?? extract?.doc?.issuedAt ?? row.created_at.slice(0, 10);
  const doc: DocumentReference = {
    resourceType: 'DocumentReference',
    id: docId,
    meta: { tag: [vault, kindTag, TAG_PATIENT_VISIBLE] },
    status: 'current',
    docStatus: 'final',
    type: { coding: [{ system: LOINC, ...KIND_LOINC[kind] }], text: KIND_LABEL[kind] },
    category: [{ coding: [{ system: ETERNAL.source, code: `patient-${row.source}`, display: 'Przekazane przez pacjenta' }] }],
    subject: { reference: patientRef },
    date: nowIso(),
    description: `${KIND_LABEL[kind]}${extract?.laboratory ? ` — ${extract.laboratory}` : extract?.doc?.issuer ? ` — ${extract.doc.issuer.slice(0, 80)}` : ''}`,
    content: [
      { attachment: original },
      ...(sectionsText ? [{ attachment: { contentType: 'text/plain; charset=utf-8', data: Buffer.from(sectionsText, 'utf8').toString('base64'), title: 'Treść dokumentu (kopia z odczytu)' } }] : []),
    ],
    context: {
      period: { start: effectiveIso },
      related: row.appointment_id ? [{ reference: `Appointment/${row.appointment_id}` }] : undefined,
    },
    extension: extract?.doc?.accessCode ? [{ url: 'urn:eternal:ext:access-code', valueString: extract.doc.accessCode }] : undefined,
  };
  const savedDoc = await fhirSystem().create(doc);
  const docRef = `DocumentReference/${savedDoc.id}`;
  getDb().prepare('UPDATE binary_owner SET resource_ref = ? WHERE binary_id = ?').run(docRef, row.binary_id);

  let reportRef: string | undefined;
  const obsRefs: string[] = [];
  const kept = (extract?.items ?? []).filter((i) => i.state !== 'rejected');
  if (kind === 'lab' && kept.length) {
    for (const it of kept) {
      const o = await fhirSystem().create(observationFor(it, patientRef, docRef, effectiveIso, extract?.laboratory, [vault, TAG_PATIENT_VISIBLE]));
      obsRefs.push(`Observation/${o.id}`);
    }
    const allConfirmed = kept.every((i) => i.state !== 'pending');
    const report: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      meta: { tag: [vault, kindTag, TAG_PATIENT_VISIBLE, allConfirmed ? (ctx.confirmer === 'clinician' ? TRUST.clinicianConfirmed : TRUST.patientConfirmed) : TRUST.machineUnconfirmed] },
      status: allConfirmed ? 'final' : 'preliminary',
      category: [{ coding: [{ system: V2_0074, code: 'LAB', display: 'Laboratory' }] }],
      code: { coding: [{ system: LOINC, code: '11502-2', display: 'Laboratory report' }], text: extract?.laboratory ? `Wyniki badań — ${extract.laboratory}` : 'Wyniki badań laboratoryjnych' },
      subject: { reference: patientRef },
      effectiveDateTime: effectiveIso,
      issued: nowIso(),
      performer: extract?.laboratory ? [{ display: extract.laboratory }] : undefined,
      result: obsRefs.map((r): Reference<Observation> => ({ reference: r })),
      presentedForm: [original],
      extension: [{ url: 'urn:eternal:ext:source-document', valueReference: { reference: docRef } }],
    };
    const savedReport = await fhirSystem().create(report);
    reportRef = `DiagnosticReport/${savedReport.id}`;
  }

  const uploader: ProvenanceAgent = { who: patientRef, display: row.source === 'staff' ? 'Personel placówki' : 'Pacjent', role: 'informant' };
  const software: ProvenanceAgent = { display: `Eternal — odczyt dokumentu (${extract?.engine.reader ?? 'brak'}; ${extract?.engine.parser ?? DICTIONARY_VERSION})`, role: 'assembler' };
  const agents = [uploader, software];
  if (extract?.engine.ai) agents.push({ display: `Model ${extract.engine.ai.model} (${extract.engine.ai.provider}; ${extract.engine.ai.promptVersion})`, role: 'assembler' });
  await runInScope({ patientRef }, async () => {
    await recordProvenance({ targets: [docRef, ...(reportRef ? [reportRef] : []), ...obsRefs], activity: 'document-read', agents, sources: [{ ref: `Binary/${row.binary_id}` }] });
    const confirmedRefs = kept.map((it, i) => (it.state !== 'pending' ? obsRefs[i] : undefined)).filter((r): r is string => !!r);
    if (confirmedRefs.length) {
      await recordProvenance({
        targets: confirmedRefs,
        activity: ctx.confirmer === 'clinician' ? 'clinician-confirmed' : 'patient-confirmed',
        agents: [{ who: ctx.actor.actorRef, display: ctx.actor.display ?? (ctx.confirmer === 'clinician' ? 'Personel' : 'Pacjent'), role: 'verifier' }],
        sources: [{ ref: docRef }],
      });
    }
  });
  const allConfirmed = kind !== 'lab' || kept.every((i) => i.state !== 'pending');
  save(id, {
    status: allConfirmed ? 'confirmed' : 'submitted',
    document_ref: docRef,
    report_ref: reportRef ?? null,
    confirmed_at: nowIso(),
    confirmed_by: ctx.actor.userId ?? ctx.actor.actorRef ?? null,
  });
  audit(ctx.actor, { action: 'C', subtype: 'intake-submit', entityRef: docRef, patientRef, detail: { intake: id, kind, observations: obsRefs.length, unconfirmed: kept.filter((i) => i.state === 'pending').length } });
  bus.publish({ type: 'document.changed', patientRef, resourceRef: docRef, orgIds: row.org_id ? [row.org_id] : undefined });
  const flagged = kept.filter((i) => i.flag && i.state !== 'pending').length;
  if (flagged && row.source === 'app') {
    // F3.6 — przepisanie oznaczeń laboratorium, bez oceny; push bez treści medycznej
    await notifyPatient(patientRef, {
      kind: 'lab-flags',
      title: 'Oznaczenia laboratorium w wgranym dokumencie',
      body: `Laboratorium oznaczyło ${flagged} wynik(ów) symbolem poza zakresem referencyjnym. Aplikacja nie ocenia wyników — omów je z lekarzem.`,
      link: reportRef ? `/wyniki/r/${reportRef.split('/')[1]}` : '/dokumenty',
      pushTitle: 'Eternal',
      pushBody: 'Nowa informacja o wgranym dokumencie. Zaloguj się, aby zobaczyć.',
    });
  }
  const next = rowById(id)!;
  publish(next);
  return toIntakeView(next, true);
}

/** Potwierdzenie przez personel pól, których pacjent nie potwierdził (po zapisie do rekordu). */
export async function clinicianConfirmObservations(actor: AuditActor, patientRef: string, intakeId: string, reviews: FieldReview[]): Promise<IntakeView> {
  const row = getIntake(intakeId, { patientRef });
  if (row.status !== 'submitted' || !row.report_ref || !row.extracted) throw conflict('intake_not_submitted');
  const extract = applyReview(JSON.parse(row.extracted) as IntakeExtract, reviews, 'clinician');
  const report = await fhirSystem().read<DiagnosticReport>('DiagnosticReport', row.report_ref.split('/')[1]);
  const kept = extract.items.filter((i) => i.state !== 'rejected');
  const prevKept = (JSON.parse(row.extracted) as IntakeExtract).items.filter((i) => i.state !== 'rejected');
  const changed: string[] = [];
  for (const [idx, ref] of (report.result ?? []).entries()) {
    const it = prevKept[idx] ? extract.items.find((x) => x.id === prevKept[idx].id) : undefined;
    if (!it || !ref.reference || !reviews.some((r) => r.id === it.id)) continue;
    const obs = await fhirSystem().read<Observation>('Observation', ref.reference.split('/')[1]);
    const fresh = observationFor(it, patientRef, row.document_ref ?? '', obs.effectiveDateTime ?? nowIso(), extract.laboratory, (obs.meta?.tag ?? []).filter((t) => t.system !== ETERNAL.trust));
    await fhirSystem().update<Observation>({ ...fresh, id: obs.id, meta: { ...obs.meta, tag: fresh.meta?.tag }, status: it.state === 'rejected' ? 'entered-in-error' : fresh.status });
    changed.push(ref.reference);
  }
  if (changed.length) {
    await runInScope({ patientRef }, () =>
      recordProvenance({ targets: changed, activity: 'clinician-confirmed', agents: [{ who: actor.actorRef, display: actor.display ?? 'Personel', role: 'verifier' }], sources: row.document_ref ? [{ ref: row.document_ref }] : undefined }),
    );
  }
  const allConfirmed = kept.every((i) => i.state !== 'pending');
  if (allConfirmed && report.status !== 'final') {
    await fhirSystem().update<DiagnosticReport>({ ...report, status: 'final', meta: { ...report.meta, tag: [...(report.meta?.tag ?? []).filter((t) => t.system !== ETERNAL.trust), TRUST.clinicianConfirmed] } });
  }
  save(intakeId, { extracted: JSON.stringify(extract), status: allConfirmed ? 'confirmed' : 'submitted' });
  audit(actor, { action: 'U', subtype: 'intake-clinician-confirm', patientRef, detail: { intake: intakeId, changed: changed.length } });
  const next = rowById(intakeId)!;
  publish(next);
  return toIntakeView(next, true);
}

/** Odczyt pliku źródłowego pozycji (dostęp sprawdza warstwa wywołująca). */
export async function intakeFile(row: IntakeRow): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const bin = await fhirSystem().readBinary(row.binary_id);
  return { data: bin.data, contentType: row.content_type, filename: row.filename ?? `dokument-${row.id}` };
}
