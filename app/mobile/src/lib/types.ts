import type { A11yPrefs } from './a11y';
/** Kształty odpowiedzi API (podzbiór typów z web/src/types.ts i web/src/mvp-types.ts). */

export interface Me {
  authenticated: boolean;
  token?: string;
  mfa?: { required: boolean; enrolled: boolean; methods?: { totp: boolean; keys: number; recoveryCodes: number } };
  user?: { id: string; email: string; displayName: string; roles: string[]; staff: boolean; locale: 'pl' | 'en'; phone?: string; phoneVerified?: boolean; a11y?: A11yPrefs };
  patient?: { id: string; name: string; birthDate?: string; gender?: string };
}

export type IntakeStatus = 'processing' | 'needs_review' | 'submitted' | 'confirmed' | 'unreadable' | 'failed';

export interface IntakeField {
  id: string;
  line: number;
  sourceText: string;
  name: string;
  value: string;
  unit?: string;
  rangeText?: string;
  flag?: string;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  state: 'pending' | 'confirmed' | 'corrected' | 'rejected';
}

export interface IntakeView {
  id: string;
  filename?: string;
  kind: string;
  status: IntakeStatus;
  error?: string;
  laboratory?: string;
  collectedAt?: string;
  createdAt: string;
  extract?: {
    kind: string;
    lines: { page: number; text: string }[];
    items: IntakeField[];
    doc?: { sections: { title: string; lines: number[] }[] };
    engine: { ai?: { provider: string; model: string; demo: boolean } };
  };
}

export interface DocumentItem {
  id: string;
  title: string;
  kind: string;
  kindLabel?: string;
  date?: string;
  contentType?: string;
}

export interface CardView {
  id: string;
  clinic: string;
  doctor: string;
  date: string;
  card: { whatWasDone: string[]; nextSteps: string[]; whenToReturn?: string | null; warningSigns: string[]; erecipeCode?: string };
}

export interface GrantView {
  id: string;
  recipient: string;
  scope: { kind: string };
  purpose: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface AccessEntry {
  at: string;
  who: string;
  org?: string;
  subtype: string;
  role?: string;
}

export interface SessionItem {
  id: string;
  device: string;
  method: string;
  ip?: string;
  createdAt: string;
  lastSeenAt?: string;
  current: boolean;
}

/** Ankiety (A12.3) — GET /api/me/surveys. */
export interface SurveyCard {
  id: string;
  title: string;
  description: string;
  minutes: number;
  kind: 'health' | 'product';
  reason: string;
  reasonVars?: Record<string, number>;
  due: boolean;
  completedAt?: string;
}

export interface SurveysData {
  items: SurveyCard[];
  history: { id: string; surveyId?: string; title: string; authored: string }[];
}

// --- profile rodzinne (A22.1, A24.1, A24.2) ------------------------------------------------------------------------

export type ProxyRelation = 'parent' | 'guardian' | 'caregiver' | 'family';
export type ProxyAccess = 'full' | 'view';

export interface FamilyProfile {
  patientRef: string;
  id: string;
  name: string;
  given: string;
  birthDate?: string;
  age?: number;
  self: boolean;
  managed: boolean;
  relation?: ProxyRelation;
  access: ProxyAccess | 'self';
  linkId?: string;
  lapsed?: boolean;
}

export interface FamilyAccess {
  id: string;
  name?: string;
  relation: ProxyRelation;
  access: ProxyAccess;
  status: 'pending' | 'active' | 'expired';
  you: boolean;
  activatedAt?: string;
  expiresAt?: string;
  codeExpiresAt?: string;
}

export interface FamilyData {
  profiles: FamilyProfile[];
  access: FamilyAccess[];
  basis: { version: string; text: Record<'parent' | 'guardian' | 'caregiver', string> };
}

export interface CaregiverOverviewItem {
  patientRef: string;
  name: string;
  age?: number;
  relation: ProxyRelation;
  access: ProxyAccess;
  nextAppointment?: { start: string; service: string; practitioner?: string };
  medsToday: { due: number; taken: number; skipped: number; missed: number };
  unreadMessages: number;
}

/** Dostęp ratunkowy do danych pacjenta (A24.5). */
export interface EmergencyAccessView {
  id: string;
  who: string;
  clinic?: string;
  reason: string;
  reasonText: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  active: boolean;
  review?: { outcome: 'justified' | 'unjustified'; at: string };
}
