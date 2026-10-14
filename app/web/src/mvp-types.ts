/** Typy odpowiedzi API modułów pilotażu, MVP-1 i MVP (odpowiadają widokom serwera). */

import type { AppointmentView } from './types';

export type DocumentKind = 'lab' | 'discharge' | 'imaging' | 'referral' | 'prescription' | 'certificate' | 'other';

export interface IntakeField {
  id: string;
  line: number;
  page: number;
  sourceText: string;
  name: string;
  value: string;
  valueNum?: number;
  unitRaw?: string;
  unit?: string;
  rangeText?: string;
  flag?: string;
  match?: { key: string; loinc: string; pl: string; loincDisplay: string; kind: 'exact' | 'fuzzy' };
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  origin: 'rules' | 'model';
  state: 'pending' | 'confirmed' | 'corrected' | 'rejected';
  original?: { name: string; value: string; unit?: string; rangeText?: string };
}

export interface IntakeExtract {
  kind: DocumentKind;
  lines: { page: number; text: string }[];
  items: IntakeField[];
  laboratory?: string;
  collectedAt?: string;
  doc?: { documentType: string; issuedAt?: string; issuer?: string; sections: { title: string; lines: number[] }[]; accessCode?: string };
  engine: { reader: string; parser: string; ai?: { provider: string; model: string; promptVersion: string; demo: boolean }; aiError?: string; rejected: number };
}

export type IntakeStatus = 'processing' | 'needs_review' | 'submitted' | 'confirmed' | 'unreadable' | 'failed';

export interface IntakeView {
  id: string;
  patientId: string;
  appointmentId?: string;
  source: 'invite' | 'app' | 'staff';
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

export type GrantScope = { kind: 'all' } | { kind: 'results' } | { kind: 'documents' } | { kind: 'selected'; refs: string[] };

export interface GrantView {
  id: string;
  patientRef: string;
  orgId: string;
  recipient: string;
  practitionerRef?: string;
  scope: GrantScope;
  purpose: 'visit' | 'consultation' | 'second-opinion' | 'other';
  appointmentId?: string;
  source: 'invite' | 'app';
  startsAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  revokedAt?: string;
}

export interface InviteView {
  id: string;
  purpose: string;
  patientId: string;
  appointmentId?: string;
  phone?: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired' | 'used';
  createdAt: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  sentChannels: string[];
  grant?: GrantView;
}

export interface VersionedText {
  version: string;
  title: string;
  paragraphs: string[];
}

export interface LinkContext {
  purpose: string;
  clinic: { name: string; phone?: string; privacyContact?: string; address?: string };
  patientLabel?: string;
  appointment?: { start: string; status: string };
  expiresAt: string;
  grant?: GrantView;
  demo: boolean;
  texts: { purpose: VersionedText; consent: VersionedText; ai: VersionedText };
  items: IntakeView[];
  limits: { maxFiles: number; maxSizeMb: number; types: string[] };
}

export interface AccessEntry {
  at: string;
  who: string;
  role: string;
  org?: string;
  action: string;
  subtype: string;
  resource?: string;
}

export interface RequirementState {
  id: string;
  label: string;
  optional: boolean;
  status: 'missing' | 'to_confirm' | 'ready';
  intakeIds: string[];
  clinicRecords: number;
}

export interface VisitPrep {
  appointment: AppointmentView;
  invite?: InviteView;
  grant?: GrantView;
  sharing: 'none' | 'invited' | 'shared' | 'withdrawn';
  requirements: RequirementState[];
  completeness: number;
  status: 'missing' | 'to_confirm' | 'ready';
  counts: { uploaded: number; toConfirm: number; unreadable: number };
  lastReminderAt?: string;
}

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

export interface FactsReport {
  templateVersion: string;
  layout: string;
  generatedAt: string;
  patient: { id: string; name: string; birthDate?: string; gender?: string };
  appointment?: { id: string; start: string; practitionerName?: string; serviceName?: string };
  missing: { label: string; status: string }[];
  prep?: { completeness: number; status: string; sharing: string };
  results: FactRow[];
  unconfirmed: FactRow[];
  documents: { ref: string; kind: string; title: string; date: string; binaryId?: string; sections: { title: string; text: string }[]; accessCode?: string; source: 'clinic' | 'patient' }[];
  sharing: { grants: GrantView[]; vaultIncluded: boolean };
}

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

export interface ScribeView {
  id: string;
  status: 'consented' | 'recorded' | 'processing' | 'draft' | 'approved' | 'failed' | 'cancelled';
  error?: string;
  appointmentId?: string;
  patientId: string;
  templateId: string;
  templateName: string;
  consentAt: string;
  audio: { present: boolean; seconds?: number; deletedAt?: string; deleteAfter?: string };
  sttProvider?: string;
  transcript?: { provider: string; model?: string; segments: { id: string; start?: number; end?: number; speaker?: string; text: string }[]; durationSec?: number };
  note?: NoteDoc;
  ai?: { provider: string; model: string; promptVersion: string; demo: boolean };
  draftReadyAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  compositionRef?: string;
  correctedRatio?: number;
  summary?: CardDoc;
  summaryStatus?: 'draft' | 'approved' | 'sent';
  summarySentAt?: string;
  cardRef?: string;
  createdAt: string;
}

export interface ScribeConfig {
  templates: { id: string; name: string; version: string; sections: { key: string; title: string }[] }[];
  usage: { used: number; limit: number; month: string };
  capabilities: { stt: 'service' | 'demo' | 'off'; ai: 'model' | 'demo' | 'off' };
  retentionDays: number;
  ehrLayout: string;
}

export interface CardView {
  id: string;
  ref: string;
  clinic: string;
  doctor: string;
  date: string;
  card: CardDoc & { version?: string };
  aiLabel: string;
  appointmentId?: string;
}

export interface ModuleView {
  id: string;
  code: string;
  area: 'doctor' | 'patient' | 'core';
  stage: string;
  name: string;
  description: string;
  switchable: boolean;
  scope: 'org' | 'global';
  enabled: boolean;
  rollout: number;
  active: boolean;
}

export interface IncidentView {
  id: string;
  reporterKind: string;
  reporter?: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'triage' | 'in-progress' | 'resolved' | 'closed';
  contact?: string;
  handledBy?: string;
  resolution?: string;
  dueAt: string;
  overdue: boolean;
  createdAt: string;
  escalatedTo?: string;
  possibleDataBreach: boolean;
}

export interface TeleState {
  provider: 'jitsi' | 'whereby';
  waiting: boolean;
  admitted: boolean;
  ended: boolean;
  patientJoinedAt?: string;
  admittedAt?: string;
  join?: { url: string; domain?: string; room?: string; publicServer?: boolean; provider?: string };
}

export interface PublicTexts {
  purpose: VersionedText;
  instructions: VersionedText;
  ai: VersionedText;
  crisis: { number: string; label: string; hours?: string }[];
  securityContact?: string;
  version: { app: string };
}
