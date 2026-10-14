import type { Composition, Consent, DocumentReference, Patient } from '@medplum/fhirtypes';
import { redactIdentifiers } from '../lib/redact.js';
import { audit, type AuditActor } from '../audit.js';
import { aiMode, runAiTask } from '../ai/gateway.js';
import { PatientSummarySchema, type PatientSummary, ScribeNoteSchema, type ScribeNote, ScribeValidationSchema } from '../ai/schemas.js';
import { sttMode, transcribe, type Transcript, transcriptText } from '../ai/stt.js';
import { AiError } from '../ai/types.js';
import type { AppUser } from '../auth/users.js';
import { findUserByFhirRef } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { CONSENT_SCOPE, ETERNAL, LOINC, TAG_AI_ASSISTED, TAG_PATIENT_VISIBLE } from '../fhir/constants.js';
import { fhir, fhirSystem } from '../fhir/index.js';
import { type ProvenanceAgent, recordProvenance } from '../fhir/provenance.js';
import { formatLocal } from '../lib/time.js';
import { badRequest, conflict, forbidden, HttpError, newId, notFound, nowIso } from '../lib/util.js';
import { documentHtml, esc } from '../pdf/html.js';
import { EHR_FIELDS, getTemplate, type NoteTemplate } from '../scribe/templates.js';
import { orgTag, runInScope, vaultOrgId } from '../tenancy.js';
import { getClinicSettings, getPractitioner } from './directory.js';
import { notifyPatient, enqueue } from './notifications.js';
import { normalizePolishPhone } from '../integrations/channels.js';
import { staffOrgId } from './orgs.js';
import { recordMetric } from './metrics.js';

/**
 * Eternal Scribe (D5): zgoda → nagranie → transkrypcja → szkic według szablonu kliniki (każdy akapit ze źródłem)
 * → walidator źródeł → zatwierdzenie przez lekarza → Composition + PDF + pola do systemu gabinetowego.
 * Karta „Po wizycie” dla pacjenta: przepisanie zatwierdzonej notatki prostym językiem, zatwierdza lekarz.
 * Granica: tylko to, co padło w rozmowie — bez rozpoznań, kodów i zaleceń niewypowiedzianych; zawsze szkic.
 */

export const CARD_TEMPLATE_VERSION = 'card/2026-10-1';

export type ScribeStatus = 'consented' | 'recorded' | 'processing' | 'draft' | 'approved' | 'failed' | 'cancelled';

export interface NoteParagraph {
  id: string;
  text: string;
  sources: string[];
  addedByDoctor?: boolean;
  problems?: string[];
}

export interface NoteDoc {
  templateId: string;
  templateVersion: string;
  manual?: boolean;
  sections: { key: string; title: string; paragraphs: NoteParagraph[] }[];
}

export interface CardDoc {
  whatWasDone: string[];
  nextSteps: string[];
  whenToReturn: string | null;
  warningSigns: string[];
  erecipeCode?: string;
  problems?: string[];
}

interface Row {
  id: string;
  org_id: string;
  appointment_id: string | null;
  patient_ref: string;
  practitioner_user_id: string;
  template_id: string;
  consent_at: string;
  consent_note: string | null;
  audio_binary_id: string | null;
  audio_deleted_at: string | null;
  audio_seconds: number | null;
  audio_content_type: string | null;
  stt_provider: string | null;
  transcript: string | null;
  note: string | null;
  note_original: string | null;
  validation: string | null;
  status: ScribeStatus;
  error: string | null;
  recorded_at: string | null;
  draft_ready_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  composition_ref: string | null;
  corrected_ratio: number | null;
  summary: string | null;
  summary_status: 'draft' | 'approved' | 'sent' | null;
  summary_approved_at: string | null;
  summary_sent_at: string | null;
  card_ref: string | null;
  erecipe_code: string | null;
  edit_seconds: number | null;
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  template_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScribeView {
  id: string;
  status: ScribeStatus;
  error?: string;
  appointmentId?: string;
  patientId: string;
  templateId: string;
  templateName: string;
  consentAt: string;
  audio: { present: boolean; seconds?: number; deletedAt?: string; deleteAfter?: string };
  sttProvider?: string;
  transcript?: Transcript;
  note?: NoteDoc;
  ai?: { provider: string; model: string; promptVersion: string; demo: boolean };
  draftReadyAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  compositionRef?: string;
  correctedRatio?: number;
  summary?: CardDoc;
  summaryStatus?: Row['summary_status'];
  summarySentAt?: string;
  cardRef?: string;
  createdAt: string;
}

// --- dostęp ------------------------------------------------------------------------------------------

function rowById(id: string): Row | undefined {
  return getDb().prepare('SELECT * FROM scribe_session WHERE id = ?').get(id) as Row | undefined;
}

function save(id: string, patch: Partial<Record<keyof Row, string | number | null>>): void {
  const keys = Object.keys(patch);
  getDb()
    .prepare(`UPDATE scribe_session SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => patch[k as keyof Row] ?? null), nowIso(), id);
}

/** Sesja widoczna tylko dla lekarza, który ją prowadzi (notatka jest jego szkicem do zatwierdzenia). */
export function ownSession(user: AppUser, id: string): Row {
  const row = rowById(id);
  if (!row || row.org_id !== staffOrgId(user)) throw notFound('scribe_not_found');
  if (row.practitioner_user_id !== user.id) throw forbidden('scribe_other_practitioner');
  return row;
}

function publish(row: Pick<Row, 'id' | 'org_id' | 'patient_ref'>): void {
  bus.publish({ type: 'scribe.changed', resourceRef: `urn:eternal:scribe:${row.id}`, orgIds: [row.org_id], staff: true });
}

export function toScribeView(row: Row, opts: { full: boolean }): ScribeView {
  const tpl = getTemplate(row.template_id);
  const retention = getClinicSettings(row.org_id).recordingRetentionDays;
  return {
    id: row.id,
    status: row.status,
    error: row.error ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    patientId: row.patient_ref.split('/')[1],
    templateId: row.template_id,
    templateName: tpl.name,
    consentAt: row.consent_at,
    audio: {
      present: !!row.audio_binary_id && !row.audio_deleted_at,
      seconds: row.audio_seconds ?? undefined,
      deletedAt: row.audio_deleted_at ?? undefined,
      deleteAfter: row.approved_at && row.audio_binary_id && !row.audio_deleted_at ? new Date(Date.parse(row.approved_at) + retention * 86_400_000).toISOString() : undefined,
    },
    sttProvider: row.stt_provider ?? undefined,
    transcript: opts.full && row.transcript ? (JSON.parse(row.transcript) as Transcript) : undefined,
    note: opts.full && row.note ? (JSON.parse(row.note) as NoteDoc) : undefined,
    ai: row.ai_provider ? { provider: row.ai_provider, model: row.ai_model ?? '', promptVersion: row.prompt_version ?? '', demo: row.ai_provider === 'demo' } : undefined,
    draftReadyAt: row.draft_ready_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    compositionRef: row.composition_ref ?? undefined,
    correctedRatio: row.corrected_ratio ?? undefined,
    summary: opts.full && row.summary ? (JSON.parse(row.summary) as CardDoc) : undefined,
    summaryStatus: row.summary_status ?? undefined,
    summarySentAt: row.summary_sent_at ?? undefined,
    cardRef: row.card_ref ?? undefined,
    createdAt: row.created_at,
  };
}

// --- limit licencji (M-29) --------------------------------------------------------------------------

export function monthlyUsage(userId: string, at = new Date()): { used: number; limit: number; month: string } {
  const month = at.toISOString().slice(0, 7);
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM scribe_session WHERE practitioner_user_id = ? AND substr(created_at, 1, 7) = ? AND status NOT IN ('cancelled') AND (audio_binary_id IS NOT NULL OR status IN ('draft','approved'))")
    .get(userId, month) as { n: number };
  const orgRow = getDb().prepare('SELECT org_id FROM app_user WHERE id = ?').get(userId) as { org_id: string | null } | undefined;
  return { used: row.n, limit: getClinicSettings(orgRow?.org_id ?? undefined).scribeMonthlyLimitPerDoctor, month };
}

export function listSessions(user: AppUser, filter: { appointmentId?: string; patientId?: string }): ScribeView[] {
  const where = ['org_id = ?', 'practitioner_user_id = ?'];
  const args: string[] = [staffOrgId(user) ?? '', user.id];
  if (filter.appointmentId) { where.push('appointment_id = ?'); args.push(filter.appointmentId); }
  if (filter.patientId) { where.push('patient_ref = ?'); args.push(`Patient/${filter.patientId}`); }
  const rows = getDb().prepare(`SELECT * FROM scribe_session WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`).all(...args) as unknown as Row[];
  return rows.map((r) => toScribeView(r, { full: false }));
}

// --- przebieg --------------------------------------------------------------------------------------------

export async function startSession(user: AppUser, actor: AuditActor, input: { patientId: string; appointmentId?: string; templateId: string; consent: true; consentNote?: string }): Promise<ScribeView> {
  const orgId = staffOrgId(user);
  if (!orgId) throw forbidden('no_organization');
  const settings = getClinicSettings(orgId);
  if (!settings.noteTemplates.includes(input.templateId)) throw badRequest('template_not_enabled');
  const usage = monthlyUsage(user.id);
  if (usage.limit > 0 && usage.used >= usage.limit) throw new HttpError(409, 'scribe_limit_reached', 'monthly Scribe limit reached', usage);
  const patient = await fhir().read<Patient>('Patient', input.patientId);
  const patientRef = `Patient/${patient.id}`;
  if (input.appointmentId) {
    const appt = await fhir().read('Appointment', input.appointmentId);
    if (!(appt as { participant: { actor?: { reference?: string } }[] }).participant.some((p) => p.actor?.reference === patientRef)) throw badRequest('appointment_patient_mismatch');
  }
  const now = nowIso();
  // zgoda pacjenta na nagranie — zapis w dokumentacji placówki (z datą)
  const consent = await fhir().create<Consent>({
    resourceType: 'Consent',
    status: 'active',
    scope: { coding: [{ system: CONSENT_SCOPE, code: 'patient-privacy' }] },
    category: [{ coding: [{ system: ETERNAL.consentType, code: 'visit-recording', display: 'Zgoda na nagranie rozmowy (Eternal Scribe)' }] }],
    patient: { reference: patientRef },
    dateTime: now,
    performer: [{ reference: patientRef }],
    organization: [{ reference: `Organization/${orgId}` }],
    policy: [{ uri: 'urn:eternal:consent-text:nagranie-wizyty/2026-10-1' }],
    provision: { type: 'permit', period: { start: now }, actor: user.fhir_ref ? [{ role: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'PRCP' }] }, reference: { reference: user.fhir_ref } }] : undefined },
    extension: input.consentNote ? [{ url: 'urn:eternal:ext:consent-note', valueString: input.consentNote.slice(0, 300) }] : undefined,
  });
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO scribe_session (id, org_id, appointment_id, patient_ref, practitioner_user_id, template_id, consent_at, consent_note, status, created_at, updated_at, template_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'consented', ?, ?, ?)`,
    )
    .run(id, orgId, input.appointmentId ?? null, patientRef, user.id, input.templateId, now, input.consentNote ?? null, now, now, getTemplate(input.templateId).version);
  audit(actor, { action: 'C', subtype: 'scribe-start', entityRef: `Consent/${consent.id}`, patientRef, detail: { session: id, template: input.templateId } });
  recordMetric(orgId, 'scribe_session', { userId: user.id, appointmentId: input.appointmentId });
  const row = rowById(id)!;
  publish(row);
  return toScribeView(row, { full: true });
}

const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'video/webm'];

export async function uploadAudio(row: Row, actor: AuditActor, file: { data: Buffer; contentType: string }, durationSec?: number): Promise<ScribeView> {
  if (!['consented', 'failed'].includes(row.status)) throw conflict('scribe_audio_already_uploaded');
  const type = file.contentType.split(';')[0].trim().toLowerCase();
  if (!AUDIO_TYPES.includes(type)) throw badRequest('unsupported_audio_type');
  if (file.data.length < 1000) throw badRequest('audio_too_short');
  const stored = await fhirSystem().saveBinary(file.data, type === 'video/webm' ? 'audio/webm' : type, `wizyta-${row.id}`);
  save(row.id, { audio_binary_id: stored.id, audio_content_type: type, audio_seconds: durationSec ?? null, status: 'processing', recorded_at: nowIso(), error: null });
  audit(actor, { action: 'C', subtype: 'scribe-audio', patientRef: row.patient_ref, detail: { session: row.id, bytes: file.data.length, seconds: durationSec } });
  publish(row);
  setImmediate(() => void runInScope({ orgId: row.org_id }, () => processSession(row.id)));
  return toScribeView(rowById(row.id)!, { full: true });
}

/** Szkic bez modelu (tryb demonstracyjny): akapity to dosłowne fragmenty rozmowy przypisane do sekcji słowami kluczowymi. */
export function demoNote(tpl: NoteTemplate, t: Transcript): ScribeNote {
  const rules: [string, RegExp][] = [
    ['rozpoznanie', /rozpozna/i],
    ['leki', /\b(leki|lek |przyjmuj|witamin|tabletk|jednostek|mg\b)/i],
    ['pomiary', /(zmierzy|ciśnieni|tętno|saturac|temperatur)/i],
    ['wyniki', /(wynik|cholesterol|glukoz|morfolog|kreatynin|tsh)/i],
    ['badanie', /(osłuchow|badani[ue] przedmiot|zbadał|brzuch miękki|gardło)/i],
    ['kontrola', /(kontrol|112|jeśli pojawi|zgłosić się|wizyta kontrolna)/i],
    ['zalecenia', /(proszę|zlecam|zalecam|należy|zapisuj)/i],
  ];
  const soap: Record<string, string> = { wywiad: 'S', leki: 'S', rozwoj: 'S', badanie: 'O', pomiary: 'O', wyniki: 'O', rozpoznanie: 'A', zalecenia: 'P', kontrola: 'P' };
  const sbar: Record<string, string> = { wywiad: 'sytuacja', leki: 'tlo', rozwoj: 'tlo', badanie: 'tlo', pomiary: 'tlo', wyniki: 'tlo', rozpoznanie: 'ocena', zalecenia: 'zalecenie', kontrola: 'zalecenie' };
  const keys = new Set(tpl.sections.map((s) => s.key));
  const target = (k: string) =>
    keys.has(k) ? k : keys.has(soap[k] ?? '') ? soap[k] : keys.has(sbar[k] ?? '') ? sbar[k] : k === 'pomiary' && keys.has('badanie') ? 'badanie' : k === 'leki' && keys.has('wywiad') ? 'wywiad' : undefined;
  const buckets = new Map<string, { text: string; sources: string[] }[]>();
  for (const seg of t.segments) {
    const isDoctor = seg.speaker === 'lekarz' || seg.speaker === 'speaker_0' || seg.speaker === 'speaker_1';
    if (/\?\s*$/.test(seg.text)) continue; // pytania lekarza nie są treścią notatki
    let key = rules.find(([, re]) => re.test(seg.text))?.[0];
    if (!key && !isDoctor) key = 'wywiad';
    if (!key && seg.speaker === 'pacjent') key = 'wywiad';
    const k = key ? target(key) : undefined;
    if (!k || /^(dzień dobry|dobrze, dziękuję|dziękuję)/i.test(seg.text)) continue;
    const list = buckets.get(k) ?? [];
    list.push({ text: seg.text, sources: [seg.id] });
    buckets.set(k, list);
  }
  return { sections: tpl.sections.map((s) => ({ key: s.key, title: s.title, paragraphs: buckets.get(s.key) ?? [] })) };
}

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const ICD_RE = /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/g;

/** Walidator deterministyczny: źródła istnieją, liczby i kody z akapitu padły we wskazanych fragmentach. */
export function validateNote(note: NoteDoc, t: Transcript | undefined): NoteDoc {
  const segs = new Map((t?.segments ?? []).map((s) => [s.id, s.text]));
  const all = (t?.segments ?? []).map((s) => s.text).join(' ');
  return {
    ...note,
    sections: note.sections.map((s) => ({
      ...s,
      paragraphs: s.paragraphs.map((p) => {
        if (p.addedByDoctor || note.manual) return { ...p, problems: [] };
        const problems: string[] = [];
        if (!p.sources.length) problems.push('Brak odnośnika do fragmentu rozmowy.');
        const unknown = p.sources.filter((id) => !segs.has(id));
        if (unknown.length) problems.push(`Nieistniejące fragmenty: ${unknown.join(', ')}.`);
        const src = p.sources.map((id) => segs.get(id) ?? '').join(' ');
        const srcNums = new Set((src.match(NUM_RE) ?? []).map((n) => n.replace(',', '.')));
        const missing = (p.text.match(NUM_RE) ?? []).map((n) => n.replace(',', '.')).filter((n) => !srcNums.has(n));
        if (missing.length) problems.push(`Liczby nieobecne we wskazanych fragmentach: ${[...new Set(missing)].join(', ')}.`);
        const codes = (p.text.match(ICD_RE) ?? []).filter((c) => !all.includes(c));
        if (codes.length) problems.push(`Kod rozpoznania, który nie padł w rozmowie: ${codes.join(', ')}.`);
        return { ...p, problems };
      }),
    })),
  };
}

function withIds(note: ScribeNote, tpl: NoteTemplate): NoteDoc {
  return {
    templateId: tpl.id,
    templateVersion: tpl.version,
    sections: tpl.sections.map((ts) => {
      const s = note.sections.find((x) => x.key === ts.key);
      return { key: ts.key, title: ts.title, paragraphs: (s?.paragraphs ?? []).filter((p) => p.text.trim()).map((p, i) => ({ id: `${ts.key}-${i + 1}`, text: p.text.trim(), sources: p.sources })) };
    }),
  };
}

function templatePrompt(tpl: NoteTemplate): string {
  return tpl.sections.map((s) => `- ${s.key}: ${s.title} — ${s.hint}`).join('\n');
}

export async function processSession(id: string): Promise<void> {
  const row = rowById(id);
  if (!row || !row.audio_binary_id) return;
  const tpl = getTemplate(row.template_id);
  try {
    let transcript: Transcript;
    try {
      const audio = await fhirSystem().readBinary(row.audio_binary_id);
      transcript = await transcribe(audio.data, row.audio_content_type ?? audio.contentType);
    } catch (err) {
      save(id, { status: 'failed', error: err instanceof AiError ? `stt_${err.code}` : 'stt_failed' });
      publish(row);
      return;
    }
    if (!transcript.segments.length) {
      save(id, { status: 'failed', error: 'stt_empty', stt_provider: transcript.provider });
      publish(row);
      return;
    }
    save(id, { transcript: JSON.stringify(transcript), stt_provider: transcript.provider, audio_seconds: row.audio_seconds ?? transcript.durationSec ?? null });
    const user = `Szablon sekcji (klucz: tytuł — wskazówka):\n${templatePrompt(tpl)}\n\nTranskrypcja (fragmenty S#):\n${redactIdentifiers(transcriptText(transcript))}`;
    let note: NoteDoc;
    let ai: { provider: string; model: string; promptVersion: string } | undefined;
    try {
      const run = await runAiTask('scribe-note', { user, schema: ScribeNoteSchema, orgId: row.org_id, userId: row.practitioner_user_id, demo: () => demoNote(tpl, transcript) });
      note = withIds(run.data, tpl);
      ai = { provider: run.provider, model: run.model, promptVersion: run.promptVersion };
    } catch (err) {
      save(id, { status: 'failed', error: err instanceof AiError ? `ai_${err.code}` : 'ai_failed' });
      publish(row);
      return;
    }
    note = validateNote(note, transcript);
    // walidator modelowy (dodatkowy) — tylko poza trybem demonstracyjnym; błąd nie blokuje szkicu
    if (aiMode() === 'model') {
      const paragraphs = note.sections.flatMap((s) => s.paragraphs).map((p) => ({ id: p.id, text: p.text, sources: p.sources.map((sid) => `${sid}: ${transcript.segments.find((x) => x.id === sid)?.text ?? ''}`) }));
      try {
        const v = await runAiTask('scribe-validate', { user: redactIdentifiers(JSON.stringify({ paragraphs })), schema: ScribeValidationSchema, orgId: row.org_id, userId: row.practitioner_user_id });
        const bad = new Map(v.data.paragraphs.filter((p) => !p.supported).map((p) => [p.id, p.problems]));
        note = { ...note, sections: note.sections.map((s) => ({ ...s, paragraphs: s.paragraphs.map((p) => (bad.has(p.id) ? { ...p, problems: [...(p.problems ?? []), ...(bad.get(p.id) ?? ['Treść nie wynika ze wskazanych fragmentów.'])] } : p)) })) };
      } catch {
        /* szkic zostaje z wynikiem walidatora deterministycznego */
      }
    }
    const now = nowIso();
    save(id, {
      status: 'draft',
      note: JSON.stringify(note),
      note_original: JSON.stringify(note),
      draft_ready_at: now,
      ai_provider: ai?.provider ?? null,
      ai_model: ai?.model ?? null,
      prompt_version: ai?.promptVersion ?? null,
      error: null,
    });
    const seconds = row.recorded_at ? (Date.parse(now) - Date.parse(row.recorded_at)) / 1000 : undefined;
    recordMetric(row.org_id, 'scribe_draft_ready', { userId: row.practitioner_user_id, appointmentId: row.appointment_id ?? undefined, value: seconds });
  } catch (err) {
    save(id, { status: 'failed', error: (err as Error).message.slice(0, 120) });
  }
  publish(row);
}

/** Tryb ograniczony (A18.8) albo wizyta bez nagrania: pusty szablon do wypełnienia przez lekarza. */
export function startManual(row: Row, actor: AuditActor): ScribeView {
  if (!['consented', 'failed'].includes(row.status)) throw conflict('scribe_not_manualizable');
  const tpl = getTemplate(row.template_id);
  const note: NoteDoc = { templateId: tpl.id, templateVersion: tpl.version, manual: true, sections: tpl.sections.map((s) => ({ key: s.key, title: s.title, paragraphs: [] })) };
  save(row.id, { status: 'draft', note: JSON.stringify(note), note_original: JSON.stringify(note), draft_ready_at: nowIso() });
  audit(actor, { action: 'U', subtype: 'scribe-manual', patientRef: row.patient_ref, detail: { session: row.id, reason: row.error ?? 'no_recording' } });
  publish(row);
  return toScribeView(rowById(row.id)!, { full: true });
}

const NoteEdit = (note: NoteDoc, incoming: { key: string; paragraphs: { id?: string; text: string; sources?: string[] }[] }[]): NoteDoc => {
  const prev = new Map(note.sections.flatMap((s) => s.paragraphs).map((p) => [p.id, p]));
  return {
    ...note,
    sections: note.sections.map((s) => {
      const inc = incoming.find((x) => x.key === s.key);
      if (!inc) return s;
      return {
        ...s,
        paragraphs: inc.paragraphs
          .filter((p) => p.text.trim())
          .map((p, i) => {
            const old = p.id ? prev.get(p.id) : undefined;
            // źródła akapitu ustala szkic — lekarz może je tylko usunąć; akapit nowy jest oznaczony jako dopisany przez lekarza
            const sources = old ? (p.sources ?? old.sources).filter((x) => old.sources.includes(x)) : [];
            return { id: old?.id ?? `${s.key}-d${i + 1}-${Date.now() % 100000}`, text: p.text.trim().slice(0, 4000), sources, addedByDoctor: old ? old.addedByDoctor : true };
          }),
      };
    }),
  };
};

export function saveNote(row: Row, actor: AuditActor, sections: { key: string; paragraphs: { id?: string; text: string; sources?: string[] }[] }[]): ScribeView {
  if (row.status !== 'draft' || !row.note) throw conflict('scribe_not_editable');
  const transcript = row.transcript ? (JSON.parse(row.transcript) as Transcript) : undefined;
  const note = validateNote(NoteEdit(JSON.parse(row.note) as NoteDoc, sections), transcript);
  save(row.id, { note: JSON.stringify(note) });
  audit(actor, { action: 'U', subtype: 'scribe-edit', patientRef: row.patient_ref, detail: { session: row.id } });
  return toScribeView(rowById(row.id)!, { full: true });
}

function sentences(note: NoteDoc): string[] {
  return note.sections.flatMap((s) => s.paragraphs.flatMap((p) => p.text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)));
}

/** Odsetek zdań szkicu, które lekarz zmienił albo usunął (miernik jakości D12). */
export function correctedRatio(original: NoteDoc, final: NoteDoc): number {
  const orig = sentences(original);
  if (!orig.length) return 0;
  const fin = new Set(sentences(final));
  const changed = orig.filter((s) => !fin.has(s)).length;
  return Math.round((changed / orig.length) * 1000) / 1000;
}

function noteXhtml(note: NoteDoc): string {
  const body = note.sections
    .filter((s) => s.paragraphs.length)
    .map((s) => `<h3>${esc(s.title)}</h3>${s.paragraphs.map((p) => `<p>${esc(p.text)}</p>`).join('')}`)
    .join('');
  return `<div xmlns="http://www.w3.org/1999/xhtml">${body || '<p>—</p>'}</div>`;
}

function compositionFor(row: Row, note: NoteDoc, user: AppUser, status: Composition['status'], existing?: Composition): Composition {
  const tpl = getTemplate(note.templateId);
  return {
    ...(existing ?? {}),
    resourceType: 'Composition',
    meta: { ...(existing?.meta ?? {}), tag: [...(existing?.meta?.tag ?? []).filter((t) => t.system !== ETERNAL.ai), ...(note.manual ? [] : [TAG_AI_ASSISTED])] },
    status,
    type: { coding: [{ system: LOINC, code: '11506-3', display: 'Progress note' }], text: `Notatka z wizyty — ${tpl.name}` },
    subject: { reference: row.patient_ref },
    date: nowIso(),
    author: [{ reference: user.fhir_ref ?? `urn:eternal:user:${user.id}`, display: user.display_name }],
    title: `Notatka z wizyty — ${tpl.name}`,
    attester: [{ mode: 'legal', time: nowIso(), party: user.fhir_ref?.startsWith('Practitioner/') ? { reference: user.fhir_ref, display: user.display_name } : undefined }],
    custodian: { reference: `Organization/${row.org_id}` },
    section: note.sections
      .filter((s) => s.paragraphs.length)
      .map((s) => ({ title: s.title, code: { coding: [{ system: 'urn:eternal:note-section', code: s.key }] }, text: { status: 'generated' as const, div: noteXhtml({ ...note, sections: [s] }) } })),
    text: { status: 'generated', div: noteXhtml(note) },
    extension: [
      ...(row.appointment_id ? [{ url: ETERNAL.ext.appointment, valueReference: { reference: `Appointment/${row.appointment_id}` } }] : []),
      { url: ETERNAL.ext.templateVersion, valueString: tpl.version },
      ...(row.ai_model && !note.manual ? [{ url: ETERNAL.ext.aiModel, valueString: `${row.ai_provider}:${row.ai_model}` }, { url: ETERNAL.ext.promptVersion, valueString: row.prompt_version ?? '' }] : []),
    ],
  };
}

export async function approveNote(row: Row, user: AppUser, actor: AuditActor): Promise<ScribeView> {
  if (row.status !== 'draft' || !row.note) throw conflict('scribe_not_approvable');
  const note = JSON.parse(row.note) as NoteDoc;
  if (!note.sections.some((s) => s.paragraphs.length)) throw badRequest('note_empty');
  const comp = await fhir().create<Composition>(compositionFor(row, note, user, 'final'));
  const compRef = `Composition/${comp.id}`;
  const agents: ProvenanceAgent[] = [{ who: user.fhir_ref ?? undefined, display: user.display_name, role: 'author' }];
  if (!note.manual && row.ai_model) agents.push({ display: `Szkic: ${row.ai_provider}:${row.ai_model} (${row.prompt_version}); mowa: ${row.stt_provider}`, role: 'assembler' });
  await recordProvenance({ targets: [compRef], activity: note.manual ? 'clinic-entry' : 'ai-draft-approved', agents, sources: row.audio_binary_id ? [{ ref: `Binary/${row.audio_binary_id}` }] : undefined });
  const now = nowIso();
  const ratio = row.note_original ? correctedRatio(JSON.parse(row.note_original) as NoteDoc, note) : 0;
  const editSeconds = row.draft_ready_at ? (Date.parse(now) - Date.parse(row.draft_ready_at)) / 1000 : null;
  save(row.id, { status: 'approved', approved_at: now, approved_by: user.display_name, composition_ref: compRef, corrected_ratio: ratio, edit_seconds: editSeconds });
  audit(actor, { action: 'C', subtype: 'scribe-approve', entityRef: compRef, patientRef: row.patient_ref, detail: { session: row.id, correctedRatio: ratio, manual: !!note.manual } });
  recordMetric(row.org_id, 'scribe_approved', { userId: user.id, appointmentId: row.appointment_id ?? undefined, value: ratio, data: { editSeconds, manual: !!note.manual } });
  bus.publish({ type: 'document.changed', patientRef: row.patient_ref, resourceRef: compRef, orgIds: [row.org_id], staff: true });
  publish(row);
  return toScribeView(rowById(row.id)!, { full: true });
}

/** Poprawka po zatwierdzeniu (MVP-1: historia wersji notatki) — nowa wersja zasobu Composition ze statusem „amended”. */
export async function amendNote(row: Row, user: AppUser, actor: AuditActor, sections: Parameters<typeof saveNote>[2], reason: string): Promise<ScribeView> {
  if (row.status !== 'approved' || !row.composition_ref || !row.note) throw conflict('scribe_not_amendable');
  if (!reason.trim()) throw badRequest('reason_required');
  const note = validateNote(NoteEdit(JSON.parse(row.note) as NoteDoc, sections), undefined);
  const current = await fhir().read<Composition>('Composition', row.composition_ref.split('/')[1]);
  const next = compositionFor(row, note, user, 'amended', current);
  next.extension = [...(next.extension ?? []).filter((e) => e.url !== ETERNAL.ext.correctionReason), { url: ETERNAL.ext.correctionReason, valueString: reason.slice(0, 300) }];
  await fhir().update(next);
  await recordProvenance({ targets: [row.composition_ref], activity: 'correction', agents: [{ who: user.fhir_ref ?? undefined, display: user.display_name, role: 'author' }], reason });
  save(row.id, { note: JSON.stringify(note) });
  audit(actor, { action: 'U', subtype: 'scribe-amend', entityRef: row.composition_ref, patientRef: row.patient_ref, detail: { session: row.id } });
  return toScribeView(rowById(row.id)!, { full: true });
}

export async function noteVersions(row: Row) {
  if (!row.composition_ref) return [];
  const versions = await fhir().history<Composition>('Composition', row.composition_ref.split('/')[1]);
  return versions.map((c) => ({
    versionId: c.meta?.versionId,
    lastUpdated: c.meta?.lastUpdated,
    status: c.status,
    author: c.author?.[0]?.display,
    reason: c.extension?.find((e) => e.url === ETERNAL.ext.correctionReason)?.valueString,
    sections: (c.section ?? []).map((s) => ({ title: s.title, html: s.text?.div ?? '' })),
  }));
}

export function ehrExport(row: Row): { layout: string; fields: { field: string; text: string }[] } {
  if (!row.note) throw conflict('scribe_no_note');
  const note = JSON.parse(row.note) as NoteDoc;
  const tpl = getTemplate(note.templateId);
  const layout = getClinicSettings(row.org_id).ehrLayout;
  const fields = EHR_FIELDS[layout].map((field) => ({
    field,
    text: note.sections
      .filter((s) => tpl.sections.find((ts) => ts.key === s.key)?.ehr[layout] === field)
      .flatMap((s) => s.paragraphs.map((p) => p.text))
      .join('\n'),
  }));
  return { layout, fields };
}

export async function cancelSession(row: Row, actor: AuditActor): Promise<void> {
  if (row.status === 'approved') throw conflict('scribe_already_approved');
  if (row.audio_binary_id && !row.audio_deleted_at) await fhirSystem().deleteBinary(row.audio_binary_id);
  save(row.id, { status: 'cancelled', audio_deleted_at: row.audio_binary_id ? nowIso() : null, transcript: null, note: null, note_original: null });
  audit(actor, { action: 'D', subtype: 'scribe-cancel', patientRef: row.patient_ref, detail: { session: row.id } });
  publish(row);
}

/** Zadanie okresowe: usunięcie nagrania i transkrypcji N dni po zatwierdzeniu (ustawienie kliniki, [ZAŁ.] 30). */
export async function purgeRecordings(): Promise<number> {
  const rows = getDb().prepare("SELECT * FROM scribe_session WHERE audio_binary_id IS NOT NULL AND audio_deleted_at IS NULL AND status = 'approved'").all() as unknown as Row[];
  let n = 0;
  for (const r of rows) {
    const days = getClinicSettings(r.org_id).recordingRetentionDays;
    if (!r.approved_at || Date.parse(r.approved_at) + days * 86_400_000 > Date.now()) continue;
    await fhirSystem().deleteBinary(r.audio_binary_id ?? '');
    save(r.id, { audio_deleted_at: nowIso(), transcript: null });
    audit(undefined, { action: 'D', subtype: 'scribe-audio-purged', patientRef: r.patient_ref, detail: { session: r.id, retentionDays: days } });
    n++;
  }
  return n;
}

export async function notePdfHtml(row: Row): Promise<string> {
  if (!row.note) throw conflict('scribe_no_note');
  const note = JSON.parse(row.note) as NoteDoc;
  const patient = await fhir().read<Patient>('Patient', row.patient_ref.split('/')[1]);
  const name = patient.name?.[0];
  const tz = config.clinic.timezone;
  const label = note.manual
    ? ''
    : `<div class="box ai small"><span class="tag ai">AI</span> ${row.status === 'approved' ? `Szkic przygotowany przez AI, zatwierdzony przez lekarza: ${esc(row.approved_by)} (${esc(formatLocal(row.approved_at ?? '', tz))}).` : 'SZKIC przygotowany przez AI — niezatwierdzony.'}</div>`;
  const body = `${label}${note.sections
    .filter((s) => s.paragraphs.length)
    .map((s) => `<h2>${esc(s.title)}</h2>${s.paragraphs.map((p) => `<p>${esc(p.text)}</p>`).join('')}`)
    .join('')}`;
  return documentHtml({
    title: 'Notatka z wizyty',
    subtitle: `${name ? `${(name.given ?? []).join(' ')} ${name.family ?? ''}` : ''}${patient.birthDate ? `, ur. ${patient.birthDate}` : ''}`,
    org: getClinicSettings(row.org_id).name,
    meta: [
      ['Data', formatLocal(row.approved_at ?? row.created_at, tz)],
      ['Lekarz', row.approved_by ?? '—'],
      ['Szablon', getTemplate(note.templateId).name],
    ],
    body,
    templateVersion: note.templateVersion,
    demo: config.demoMode,
  });
}

// --- karta „Po wizycie” ------------------------------------------------------------------------------------

function noteText(note: NoteDoc): string {
  return note.sections.filter((s) => s.paragraphs.length).map((s) => `${s.title}:\n${s.paragraphs.map((p) => p.text).join('\n')}`).join('\n\n');
}

/** Karta bez modelu (tryb demonstracyjny): zdania przepisane z sekcji notatki. */
export function demoCard(note: NoteDoc): PatientSummary {
  const from = (...keys: string[]) => note.sections.filter((s) => keys.includes(s.key)).flatMap((s) => s.paragraphs.map((p) => p.text));
  const control = from('kontrola', 'P');
  return {
    whatWasDone: from('badanie', 'pomiary', 'wyniki', 'O').slice(0, 5),
    nextSteps: from('zalecenia', 'P').filter((t) => !/112|zgłosić/.test(t)).slice(0, 6),
    whenToReturn: control.find((t) => /kontrol|wizyt/i.test(t)) ?? null,
    warningSigns: [...control, ...from('zalecenia')].filter((t) => /112|zgłosić|jeśli pojawi/i.test(t)).slice(0, 4),
  };
}

function checkCard(card: CardDoc, note: NoteDoc): CardDoc {
  const src = noteText(note);
  const nums = new Set((src.match(NUM_RE) ?? []).map((n) => n.replace(',', '.')));
  const texts = [...card.whatWasDone, ...card.nextSteps, ...(card.whenToReturn ? [card.whenToReturn] : []), ...card.warningSigns];
  const missing = [...new Set(texts.flatMap((t) => t.match(NUM_RE) ?? []).map((n) => n.replace(',', '.')).filter((n) => !nums.has(n)))];
  return { ...card, problems: missing.length ? [`Liczby nieobecne w zatwierdzonej notatce: ${missing.join(', ')}.`] : [] };
}

export async function generateCard(row: Row, actor: AuditActor): Promise<ScribeView> {
  if (row.status !== 'approved' || !row.note) throw conflict('scribe_not_approved');
  if (row.summary_status === 'sent') throw conflict('card_already_sent');
  const note = JSON.parse(row.note) as NoteDoc;
  const run = await runAiTask('patient-summary', { user: redactIdentifiers(noteText(note)), schema: PatientSummarySchema, orgId: row.org_id, userId: row.practitioner_user_id, demo: () => demoCard(note) });
  const card = checkCard({ ...run.data }, note);
  save(row.id, { summary: JSON.stringify(card), summary_status: 'draft' });
  audit(actor, { action: 'C', subtype: 'card-draft', patientRef: row.patient_ref, detail: { session: row.id, provider: run.provider } });
  return toScribeView(rowById(row.id)!, { full: true });
}

export function saveCard(row: Row, actor: AuditActor, card: Omit<CardDoc, 'problems'>): ScribeView {
  if (row.summary_status === 'sent') throw conflict('card_already_sent');
  if (row.status !== 'approved' || !row.note) throw conflict('scribe_not_approved');
  if (card.erecipeCode && !/^\d{4}$/.test(card.erecipeCode)) throw badRequest('invalid_erecipe_code');
  const clean = (a: string[]) => a.map((x) => x.trim().slice(0, 400)).filter(Boolean).slice(0, 12);
  const next = checkCard({ whatWasDone: clean(card.whatWasDone), nextSteps: clean(card.nextSteps), whenToReturn: card.whenToReturn?.trim().slice(0, 300) || null, warningSigns: clean(card.warningSigns), erecipeCode: card.erecipeCode || undefined }, JSON.parse(row.note) as NoteDoc);
  save(row.id, { summary: JSON.stringify(next), summary_status: 'draft', erecipe_code: card.erecipeCode ?? null });
  audit(actor, { action: 'U', subtype: 'card-edit', patientRef: row.patient_ref, detail: { session: row.id } });
  return toScribeView(rowById(row.id)!, { full: true });
}

function cardText(card: CardDoc, meta: { clinic: string; doctor: string; date: string }): string {
  const list = (title: string, items: string[]) => (items.length ? `${title}\n${items.map((i) => `• ${i}`).join('\n')}\n` : '');
  return [
    `Karta „Po wizycie” — ${meta.clinic}, ${meta.date}, ${meta.doctor}`,
    list('Co zrobiono na wizycie:', card.whatWasDone),
    list('Co robić dalej:', card.nextSteps),
    card.whenToReturn ? `Kiedy wrócić: ${card.whenToReturn}\n` : '',
    list('Kiedy zgłosić się wcześniej:', card.warningSigns),
    card.erecipeCode ? `Kod e-recepty: ${card.erecipeCode}\n` : '',
    'Przygotowane przez AI, zatwierdzone przez lekarza. W nagłym zagrożeniu życia dzwoń 112.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * „Akceptuję i wyślij”: karta trafia do dokumentacji (DocumentReference, widoczna dla pacjenta i w jego sejfie);
 * pacjent z aplikacją dostaje powiadomienie, bez aplikacji — SMS z linkiem (bez treści medycznej w SMS).
 */
export async function approveAndSendCard(row: Row, user: AppUser, actor: AuditActor, input: { phone?: string }): Promise<{ view: ScribeView; channel: 'app' | 'sms' | 'none'; url?: string }> {
  if (row.status !== 'approved' || !row.summary) throw conflict('card_not_ready');
  if (row.summary_status === 'sent' && row.card_ref) throw conflict('card_already_sent');
  const card = JSON.parse(row.summary) as CardDoc;
  if (!card.whatWasDone.length && !card.nextSteps.length) throw badRequest('card_empty');
  const tz = config.clinic.timezone;
  const clinic = getClinicSettings(row.org_id).name;
  const meta = { clinic, doctor: user.display_name, date: formatLocal(nowIso(), tz) };
  const { problems: _p, ...clean } = card;
  const doc = await fhir().create<DocumentReference>({
    resourceType: 'DocumentReference',
    meta: { tag: [orgTag(row.org_id), orgTag(vaultOrgId(row.patient_ref)), TAG_PATIENT_VISIBLE, TAG_AI_ASSISTED, { system: ETERNAL.intakeKind, code: 'after-visit', display: 'Karta „Po wizycie”' }] },
    status: 'current',
    docStatus: 'final',
    type: { coding: [{ system: LOINC, code: '34133-9', display: 'Summary of episode note' }], text: 'Karta „Po wizycie”' },
    category: [{ coding: [{ system: ETERNAL.source, code: 'after-visit-card', display: 'Karta „Po wizycie”' }] }],
    subject: { reference: row.patient_ref },
    date: nowIso(),
    author: [{ reference: user.fhir_ref ?? `urn:eternal:user:${user.id}`, display: user.display_name }, { reference: `Organization/${row.org_id}`, display: clinic }],
    authenticator: user.fhir_ref?.startsWith('Practitioner/') ? { reference: user.fhir_ref, display: user.display_name } : undefined,
    description: `Karta „Po wizycie” — ${clinic}`,
    content: [
      { attachment: { contentType: 'text/plain; charset=utf-8', data: Buffer.from(cardText(card, meta), 'utf8').toString('base64'), title: 'Karta „Po wizycie”' } },
      { attachment: { contentType: 'application/json', data: Buffer.from(JSON.stringify({ ...clean, version: CARD_TEMPLATE_VERSION, ...meta }), 'utf8').toString('base64'), title: 'card.json' } },
    ],
    context: { related: [...(row.composition_ref ? [{ reference: row.composition_ref }] : []), ...(row.appointment_id ? [{ reference: `Appointment/${row.appointment_id}` }] : [])] },
    extension: [{ url: ETERNAL.ext.templateVersion, valueString: CARD_TEMPLATE_VERSION }],
  });
  const cardRef = `DocumentReference/${doc.id}`;
  await recordProvenance({
    targets: [cardRef],
    activity: 'ai-draft-approved',
    agents: [
      { who: user.fhir_ref ?? undefined, display: user.display_name, role: 'author' },
      { display: 'Eternal — przepisanie zatwierdzonej notatki prostym językiem (patient-summary)', role: 'assembler' },
    ],
    sources: row.composition_ref ? [{ ref: row.composition_ref, role: 'derivation' }] : undefined,
  });
  let channel: 'app' | 'sms' | 'none' = 'none';
  let url: string | undefined;
  const account = findUserByFhirRef(row.patient_ref);
  if (account && account.status === 'active') {
    await notifyPatient(row.patient_ref, { kind: 'after-visit-card', title: 'Karta „Po wizycie” jest gotowa', body: `${clinic} przesłała kartę po wizycie.`, link: `/karty/${doc.id}`, pushTitle: 'Eternal', pushBody: 'Karta po wizycie jest gotowa.' });
    channel = 'app';
  } else {
    const patient = await fhir().read<Patient>('Patient', row.patient_ref.split('/')[1]);
    const phone = input.phone ?? patient.telecom?.find((t) => t.system === 'phone')?.value;
    if (phone) {
      const { createCardLink } = await import('./cards.js');
      const link = await createCardLink({ orgId: row.org_id, patientRef: row.patient_ref, cardRef, appointmentId: row.appointment_id ?? undefined, days: 90, createdBy: user.id, purpose: 'after-visit' });
      const number = normalizePolishPhone(phone);
      if (!number) throw badRequest('invalid_phone');
      enqueue({ channel: 'sms', recipient: number, subject: '', body: `${clinic}: karta „Po wizycie” jest gotowa: ${link.url}`, relatedRef: `card:${doc.id}`, dedupeKey: `card:${doc.id}` });
      channel = 'sms';
      url = link.url;
    }
  }
  const now = nowIso();
  save(row.id, { card_ref: cardRef, summary_status: 'sent', summary_approved_at: now, summary_sent_at: now });
  audit(actor, { action: 'C', subtype: 'card-send', entityRef: cardRef, patientRef: row.patient_ref, detail: { session: row.id, channel } });
  recordMetric(row.org_id, 'card_sent', { userId: user.id, appointmentId: row.appointment_id ?? undefined, data: { channel } });
  bus.publish({ type: 'document.changed', patientRef: row.patient_ref, resourceRef: cardRef, orgIds: [row.org_id] });
  return { view: toScribeView(rowById(row.id)!, { full: true }), channel, url };
}

export async function practitionerSpecialty(user: AppUser): Promise<string | undefined> {
  if (!user.fhir_ref?.startsWith('Practitioner/')) return undefined;
  return (await getPractitioner(user.fhir_ref.split('/')[1]).catch(() => undefined))?.specialty;
}

export function scribeCapabilities() {
  return { stt: sttMode(), ai: aiMode() };
}
