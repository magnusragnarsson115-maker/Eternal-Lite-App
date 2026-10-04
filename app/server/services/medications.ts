import type { MedicationStatement } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { fhir } from '../fhir/index.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';

/**
 * Lista przyjmowanych leków zgłoszona przez pacjenta (FHIR MedicationStatement, informationSource = Patient).
 * Służy lekarzowi jako informacja z wywiadu — aplikacja nie sprawdza interakcji ani dawek.
 */

export const RPL_SYSTEM = 'urn:eternal:rpl-product-id';

export interface MedicationView {
  id: string;
  name: string;
  rplId?: string;
  dosage?: string;
  since?: string;
  status: MedicationStatement['status'];
  reportedAt: string;
}

function toView(m: MedicationStatement): MedicationView {
  return {
    id: m.id ?? '',
    name: m.medicationCodeableConcept?.text ?? m.medicationCodeableConcept?.coding?.[0]?.display ?? '',
    rplId: m.medicationCodeableConcept?.coding?.find((c) => c.system === RPL_SYSTEM)?.code,
    dosage: m.dosage?.[0]?.text,
    since: m.effectivePeriod?.start,
    status: m.status,
    reportedAt: m.dateAsserted ?? m.meta?.lastUpdated ?? '',
  };
}

export async function listMedications(patientRef: string, includeStopped = false): Promise<MedicationView[]> {
  const items = await fhir().search<MedicationStatement>('MedicationStatement', { subject: patientRef, _sort: '-_lastUpdated' });
  return items.map(toView).filter((m) => m.status !== 'entered-in-error' && (includeStopped || m.status === 'active'));
}

export async function addMedication(
  actor: AuditActor,
  patientRef: string,
  input: { name: string; rplId?: string; dosage?: string; since?: string },
): Promise<MedicationView> {
  const name = input.name.trim().slice(0, 200);
  if (!name) throw badRequest('name_required');
  if (input.since && !/^\d{4}-\d{2}(-\d{2})?$/.test(input.since)) throw badRequest('invalid_date');
  const saved = await fhir().create<MedicationStatement>({
    resourceType: 'MedicationStatement',
    status: 'active',
    medicationCodeableConcept: {
      text: name,
      coding: input.rplId ? [{ system: RPL_SYSTEM, code: input.rplId, display: name }] : undefined,
    },
    subject: { reference: patientRef },
    informationSource: { reference: patientRef },
    dateAsserted: nowIso(),
    effectivePeriod: input.since ? { start: input.since } : undefined,
    dosage: input.dosage?.trim() ? [{ text: input.dosage.trim().slice(0, 200) }] : undefined,
  });
  audit(actor, { action: 'C', subtype: 'medication-add', entityRef: `MedicationStatement/${saved.id}`, patientRef });
  bus.publish({ type: 'observation.changed', patientRef });
  return toView(saved);
}

export async function stopMedication(actor: AuditActor, patientRef: string, id: string, enteredInError = false): Promise<void> {
  const m = await fhir().readOptional<MedicationStatement>('MedicationStatement', id);
  if (!m || m.subject.reference !== patientRef) throw notFound('medication_not_found');
  await fhir().update<MedicationStatement>({
    ...m,
    status: enteredInError ? 'entered-in-error' : 'stopped',
    effectivePeriod: enteredInError ? m.effectivePeriod : { ...m.effectivePeriod, end: nowIso().slice(0, 10) },
  });
  audit(actor, { action: 'U', subtype: enteredInError ? 'medication-retract' : 'medication-stop', entityRef: `MedicationStatement/${id}`, patientRef });
  bus.publish({ type: 'observation.changed', patientRef });
}
