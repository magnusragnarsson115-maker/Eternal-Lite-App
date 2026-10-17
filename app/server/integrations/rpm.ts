import type { Bundle, Observation, Patient } from '@medplum/fhirtypes';
import crypto from 'node:crypto';
import { audit } from '../audit.js';
import { config } from '../config.js';
import { LOINC, PESEL_SYSTEM, type VitalKind, VITALS } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { HttpError } from '../lib/util.js';
import { addMeasurement, type MeasurementInput } from '../services/observations.js';

/**
 * Odbiór pomiarów z platform zdalnego monitorowania (RPM) — np. Vitalera — w formacie FHIR R4.
 * Platforma wysyła Observation lub Bundle Observation na:
 *   POST /api/integrations/rpm/{provider}/webhook
 * Nagłówki: X-Eternal-Timestamp (unix, s), X-Eternal-Signature: sha256=HMAC_SHA256(sekret, `${ts}.${body}`).
 * Sekret per dostawca: RPM_WEBHOOK_SECRETS="vitalera:...". Pacjent: subject.reference = Patient/{id Eternal}
 * albo subject.identifier z numerem PESEL.
 */

const MAX_SKEW_SECONDS = 300;

export function rpmProviders(): string[] {
  return Object.keys(config.rpmWebhookSecrets);
}

export function verifySignature(provider: string, rawBody: string, timestamp: string | undefined, signature: string | undefined, now = Date.now()): void {
  const secret = config.rpmWebhookSecrets[provider];
  if (!secret) throw new HttpError(404, 'unknown_provider');
  if (!timestamp || !signature) throw new HttpError(401, 'missing_signature');
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > MAX_SKEW_SECONDS) throw new HttpError(401, 'stale_timestamp');
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'invalid_signature');
}

function loincOf(o: { code?: { coding?: { system?: string; code?: string }[] } }): string | undefined {
  return o.code?.coding?.find((c) => c.system === LOINC)?.code;
}

function toUnit(value: number, unit: string | undefined, kind: VitalKind): number {
  const u = (unit ?? '').toLowerCase();
  if (kind === 'weight' && (u === '[lb_av]' || u === 'lb' || u === 'lbs')) return Math.round(value * 0.45359237 * 10) / 10;
  if (kind === 'temperature' && (u === '[degf]' || u === '°f' || u === 'degf')) return Math.round(((value - 32) * 5) / 9 * 10) / 10;
  if (kind === 'glucose' && (u === 'mmol/l')) return Math.round(value * 18.016);
  if (kind === 'height' && (u === 'm')) return Math.round(value * 1000) / 10;
  return value;
}

const SINGLE: Record<string, VitalKind> = {
  [VITALS.heartRate.code]: 'heartRate',
  [VITALS.weight.code]: 'weight',
  [VITALS.height.code]: 'height',
  [VITALS.temperature.code]: 'temperature',
  [VITALS.spo2.code]: 'spo2',
  '2708-6': 'spo2',
  [VITALS.glucose.code]: 'glucose',
  '15074-8': 'glucose',
  '2345-7': 'glucose',
};

/** FHIR Observation z platformy RPM → wejście addMeasurement (albo powód odrzucenia). */
export function mapRpmObservation(o: Observation, provider: string): MeasurementInput | string {
  if (o.resourceType !== 'Observation') return 'not_an_observation';
  if (o.status && !['final', 'amended', 'corrected', 'preliminary'].includes(o.status)) return 'status_not_final';
  const effective = o.effectiveDateTime ?? o.effectiveInstant ?? o.effectivePeriod?.start ?? o.issued;
  const externalId = `${provider}:${o.id ?? o.identifier?.[0]?.value ?? `${loincOf(o)}:${effective}`}`;
  const device = o.device?.display ?? provider;
  const base = { effective, source: `rpm:${provider}` as const, device, externalId };
  const code = loincOf(o);
  if (code === VITALS.bpPanel.code || code === '55284-4') {
    const comp = (c: string) => o.component?.find((x) => loincOf(x) === c)?.valueQuantity?.value;
    const sys = comp(VITALS.systolic.code);
    const dia = comp(VITALS.diastolic.code);
    if (sys === undefined || dia === undefined) return 'bp_components_missing';
    return { ...base, kind: 'bp', systolic: sys, diastolic: dia, pulse: comp(VITALS.heartRate.code) };
  }
  const kind = code ? SINGLE[code] : undefined;
  if (!kind) return 'unsupported_code';
  const q = o.valueQuantity;
  if (q?.value === undefined) return 'value_missing';
  return { ...base, kind, value: toUnit(q.value, q.code ?? q.unit, kind) };
}

async function resolvePatient(o: Observation): Promise<string | undefined> {
  const ref = o.subject?.reference;
  if (ref?.startsWith('Patient/')) {
    const p = await fhir().readOptional<Patient>('Patient', idFromRef(ref));
    return p ? `Patient/${p.id}` : undefined;
  }
  const ident = o.subject?.identifier;
  if (ident?.system === PESEL_SYSTEM && ident.value) {
    const p = (await fhir().search<Patient>('Patient', { identifier: `${PESEL_SYSTEM}|${ident.value}` }))[0];
    return p ? `Patient/${p.id}` : undefined;
  }
  return undefined;
}

export async function ingestRpm(provider: string, payload: unknown): Promise<{ accepted: number; rejected: { index: number; reason: string }[] }> {
  const body = payload as Observation | Bundle;
  const observations: Observation[] =
    body?.resourceType === 'Bundle'
      ? (body.entry ?? []).map((e) => e.resource as Observation).filter(Boolean)
      : body?.resourceType === 'Observation'
        ? [body]
        : [];
  if (observations.length === 0) throw new HttpError(400, 'no_observations');
  if (observations.length > 500) throw new HttpError(413, 'too_many_observations');
  let accepted = 0;
  const rejected: { index: number; reason: string }[] = [];
  for (const [index, o] of observations.entries()) {
    const patientRef = await resolvePatient(o);
    if (!patientRef) {
      rejected.push({ index, reason: 'patient_not_found' });
      continue;
    }
    const mapped = mapRpmObservation(o, provider);
    if (typeof mapped === 'string') {
      rejected.push({ index, reason: mapped });
      continue;
    }
    try {
      await addMeasurement({ display: `RPM: ${provider}`, actorRef: `urn:eternal:integration:${provider}` }, patientRef, mapped);
      accepted++;
    } catch (err) {
      rejected.push({ index, reason: err instanceof HttpError ? err.code : 'invalid' });
    }
  }
  audit({ display: `RPM: ${provider}`, actorRef: `urn:eternal:integration:${provider}` }, { action: 'C', subtype: 'rpm-ingest', detail: { provider, accepted, rejected: rejected.length } });
  return { accepted, rejected };
}
