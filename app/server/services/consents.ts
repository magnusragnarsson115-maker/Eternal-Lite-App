import type { Consent } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { CONSENT_SCOPE, CONSENT_TYPES, type ConsentType, ETERNAL } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { nowIso } from '../lib/util.js';

/** Wersja treści zgód — zmiana treści wymaga ponownego zebrania zgody (RODO art. 7 ust. 1: wykazanie zgody). */
export const CONSENT_POLICY_VERSION = '2026-10';

export interface ConsentState {
  type: ConsentType;
  granted: boolean;
  required: boolean;
  label: { pl: string; en: string };
  updatedAt?: string;
  policyVersion?: string;
  id?: string;
}

function consentTypeOf(c: Consent): ConsentType | undefined {
  const code = c.category?.flatMap((cat) => cat.coding ?? []).find((cd) => cd.system === ETERNAL.consentType)?.code;
  return code && code in CONSENT_TYPES ? (code as ConsentType) : undefined;
}

function buildConsent(patientRef: string, type: ConsentType, granted: boolean, existing?: Consent): Consent {
  const def = CONSENT_TYPES[type];
  return {
    ...(existing ?? {}),
    resourceType: 'Consent',
    status: 'active',
    scope: {
      coding: [
        type === 'telemedicine'
          ? { system: CONSENT_SCOPE, code: 'treatment', display: 'Treatment' }
          : { system: CONSENT_SCOPE, code: 'patient-privacy', display: 'Privacy Consent' },
      ],
    },
    category: [{ coding: [{ system: ETERNAL.consentType, code: type, display: def.pl }], text: def.pl }],
    patient: { reference: patientRef },
    dateTime: nowIso(),
    policy: [{ uri: `urn:eternal:policy:${type}:${CONSENT_POLICY_VERSION}` }],
    provision: { type: granted ? 'permit' : 'deny', period: { start: nowIso() } },
  };
}

export async function listConsents(patientRef: string): Promise<Consent[]> {
  return fhir().search<Consent>('Consent', { patient: patientRef });
}

export async function getConsentStates(patientRef: string): Promise<ConsentState[]> {
  const consents = await listConsents(patientRef);
  return (Object.keys(CONSENT_TYPES) as ConsentType[]).map((type) => {
    const c = consents.find((x) => consentTypeOf(x) === type);
    const def = CONSENT_TYPES[type];
    return {
      type,
      granted: !!c && c.status === 'active' && c.provision?.type === 'permit',
      required: def.required,
      label: { pl: def.pl, en: def.en },
      updatedAt: c?.dateTime,
      policyVersion: c?.policy?.[0]?.uri?.split(':').pop(),
      id: c?.id,
    };
  });
}

export async function hasConsent(patientRef: string, type: ConsentType): Promise<boolean> {
  const consents = await fhir().search<Consent>('Consent', { patient: patientRef, category: `${ETERNAL.consentType}|${type}` });
  return consents.some((c) => c.status === 'active' && c.provision?.type === 'permit');
}

export async function setConsent(actor: AuditActor, patientRef: string, type: ConsentType, granted: boolean): Promise<Consent> {
  const existing = (await fhir().search<Consent>('Consent', { patient: patientRef, category: `${ETERNAL.consentType}|${type}` }))[0];
  if (existing && existing.provision?.type === (granted ? 'permit' : 'deny') && existing.status === 'active') return existing;
  const resource = buildConsent(patientRef, type, granted, existing);
  const saved = existing ? await fhir().update(resource) : await fhir().create(resource);
  audit(actor, {
    action: existing ? 'U' : 'C',
    subtype: granted ? 'consent-grant' : 'consent-withdraw',
    entityRef: `Consent/${saved.id}`,
    patientRef,
    detail: { type, policy: CONSENT_POLICY_VERSION },
  });
  bus.publish({ type: 'consent.changed', patientRef, resourceRef: `Consent/${saved.id}` });
  return saved;
}

export async function consentHistory(consentId: string): Promise<{ at: string; granted: boolean; version?: string }[]> {
  const versions = await fhir().history<Consent>('Consent', consentId);
  return versions.map((v) => ({
    at: v.dateTime ?? v.meta?.lastUpdated ?? '',
    granted: v.provision?.type === 'permit',
    version: v.policy?.[0]?.uri?.split(':').pop(),
  }));
}
