import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { badRequest, fetchWithTimeout, HttpError, nowIso } from '../lib/util.js';
import { getSetting, setSetting } from '../settings.js';

/**
 * Infermedica Engine API v3 (https://developer.infermedica.com) — wywiad objawowy z dynamicznie dobieranymi
 * pytaniami i triażem. To WYRÓB MEDYCZNY (Infermedica: platforma klasy IIb wg MDR). Infermedica zastrzega, że jej
 * certyfikat nie obejmuje produktu, który integruje Engine API — dlatego silnik jest w Eternal wyłączony, dopóki
 * administrator nie zapisze referencji do oceny zgodności MDR własnego produktu (klasyfikacja, jednostka
 * notyfikowana, instrukcja używania) i umowy z Infermedica (w tym umowy powierzenia danych).
 * Do Infermedica trafiają wyłącznie: płeć, wiek, objawy i odpowiedzi — bez imienia, PESEL i kontaktu.
 * Pytania i wynik triażu pokazujemy bez zmian, z oznaczeniem źródła.
 */

export interface RegulatoryAck {
  reference: string;
  confirmedBy: string;
  at: string;
}

const ACK_KEY = 'infermedica-regulatory';

export function infermedicaConfigured(): boolean {
  return !!(config.infermedica.appId && config.infermedica.appKey);
}

export function regulatoryAck(): RegulatoryAck | undefined {
  return getSetting<RegulatoryAck>(ACK_KEY);
}

export function engineAvailable(): boolean {
  return infermedicaConfigured() && !!regulatoryAck();
}

export function setRegulatoryAck(actor: AuditActor, input: { reference: string; confirmedBy: string }): RegulatoryAck {
  const reference = input.reference.trim();
  const confirmedBy = input.confirmedBy.trim();
  if (reference.length < 6 || confirmedBy.length < 5) throw badRequest('regulatory_reference_required');
  const v: RegulatoryAck = { reference: reference.slice(0, 300), confirmedBy: confirmedBy.slice(0, 160), at: nowIso() };
  setSetting(ACK_KEY, v);
  audit(actor, { action: 'U', subtype: 'infermedica-regulatory-ack', detail: { reference: v.reference, confirmedBy: v.confirmedBy } });
  return v;
}

export function clearRegulatoryAck(actor: AuditActor): void {
  setSetting(ACK_KEY, null);
  audit(actor, { action: 'U', subtype: 'infermedica-regulatory-revoke' });
}

export type Sex = 'male' | 'female';
export interface Evidence {
  id: string;
  choice_id: 'present' | 'absent' | 'unknown';
  source?: 'initial' | 'suggest' | 'predefined';
}
export interface EngineQuestion {
  type: 'single' | 'group_single' | 'group_multiple';
  text: string;
  items: { id: string; name: string; choices: { id: string; label: string }[] }[];
}
export interface DiagnosisResult {
  question?: EngineQuestion;
  should_stop?: boolean;
  conditions?: { id: string; name: string; common_name?: string; probability: number }[];
}
export interface TriageResult {
  triage_level: string;
  serious?: { id: string; name: string; common_name?: string; is_emergency?: boolean }[];
}

async function post<T>(path: string, body: unknown, interviewId: string): Promise<T> {
  if (!engineAvailable()) throw new HttpError(409, 'engine_not_available');
  const c = config.infermedica;
  const headers: Record<string, string> = { 'App-Id': c.appId, 'App-Key': c.appKey, 'Interview-Id': interviewId, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (c.model) headers.Model = c.model;
  const res = await fetchWithTimeout(`${c.baseUrl.replace(/\/$/, '')}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }, 20_000).catch((err: Error) => {
    throw new HttpError(502, 'infermedica_unreachable', err.message);
  });
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'infermedica_auth');
  if (res.status === 429) throw new HttpError(503, 'infermedica_rate_limited');
  if (!res.ok) throw new HttpError(502, 'infermedica_error', `Infermedica ${res.status} ${path}`);
  return (await res.json()) as T;
}

export function newInterviewId(): string {
  return crypto.randomUUID();
}

/** Objawy z opisu pacjenta (NLP Infermedica) → dowody początkowe. */
export async function parseText(text: string, sex: Sex, age: number, interviewId: string): Promise<{ evidence: Evidence[]; labels: Record<string, string> }> {
  const r = await post<{ mentions?: { id: string; name: string; common_name?: string; choice_id: Evidence['choice_id'] }[] }>('/parse', { text: text.slice(0, 2000), sex, age: { value: age } }, interviewId);
  const mentions = r.mentions ?? [];
  return {
    evidence: mentions.map((m) => ({ id: m.id, choice_id: m.choice_id, source: 'initial' as const })),
    labels: Object.fromEntries(mentions.map((m) => [m.id, m.common_name ?? m.name])),
  };
}

export async function diagnosis(sex: Sex, age: number, evidence: Evidence[], interviewId: string): Promise<DiagnosisResult> {
  return post<DiagnosisResult>('/diagnosis', { sex, age: { value: age }, evidence }, interviewId);
}

export async function triage(sex: Sex, age: number, evidence: Evidence[], interviewId: string): Promise<TriageResult> {
  return post<TriageResult>('/triage', { sex, age: { value: age }, evidence }, interviewId);
}

/** Pytanie silnika → pytanie w czacie (bez zmian treści). */
export function questionToNode(q: EngineQuestion, n: number) {
  if (q.type === 'single') return { id: `q${n}`, text: q.text, type: 'single' as const, options: q.items[0]?.choices.map((c) => ({ value: c.id, label: c.label })) ?? [] };
  return { id: `q${n}`, text: q.text, type: q.type === 'group_multiple' ? ('multi' as const) : ('single' as const), options: q.items.map((i) => ({ value: i.id, label: i.name })) };
}

/** Odpowiedź z czatu → dowody dla silnika (zgodnie z typem pytania). */
export function answerToEvidence(q: EngineQuestion, value: string | string[]): Evidence[] {
  if (q.type === 'single') {
    const item = q.items[0];
    if (!item || typeof value !== 'string' || !item.choices.some((c) => c.id === value)) throw badRequest('invalid_value');
    return [{ id: item.id, choice_id: value as Evidence['choice_id'] }];
  }
  if (q.type === 'group_single') {
    if (typeof value !== 'string' || !q.items.some((i) => i.id === value)) throw badRequest('invalid_value');
    return [{ id: value, choice_id: 'present' }];
  }
  const chosen = Array.isArray(value) ? value : [value];
  if (chosen.some((v) => !q.items.some((i) => i.id === v))) throw badRequest('invalid_value');
  return q.items.map((i) => ({ id: i.id, choice_id: chosen.includes(i.id) ? 'present' : 'absent' }));
}

/** Poziomy triażu Infermedica — tekst wyświetlany jako wynik wyrobu medycznego dostawcy, z oznaczeniem źródła. */
export const TRIAGE_PL: Record<string, string> = {
  emergency_ambulance: 'Wezwij pogotowie — zadzwoń pod 112.',
  emergency: 'Pilnie zgłoś się na szpitalny oddział ratunkowy.',
  consultation_24: 'Skontaktuj się z lekarzem w ciągu 24 godzin.',
  consultation: 'Umów konsultację lekarską.',
  self_care: 'Samodzielna opieka w domu; przy pogorszeniu skontaktuj się z lekarzem.',
};
