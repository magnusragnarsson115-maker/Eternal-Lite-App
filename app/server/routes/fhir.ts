import type { Bundle, CapabilityStatement, Resource, ResourceType } from '@medplum/fhirtypes';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { audit, listAudit, toAuditEvent } from '../audit.js';
import { actorOf, requireUser } from '../auth/sessions.js';
import { isStaff } from '../auth/users.js';
import { config } from '../config.js';
import { OBS_CATEGORY, TAG_PATIENT_VISIBLE } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import type { SearchParams } from '../fhir/repository.js';
import { forbidden, notFound } from '../lib/util.js';
import { patientCanViewRecords } from '../services/records.js';

/**
 * Fasada HL7 FHIR R4 (odczyt i wyszukiwanie) dla systemów zewnętrznych i aplikacji SMART-podobnych.
 * Uprawnienia jak w interfejsie: pacjent widzi wyłącznie swój przedział (compartment) i udostępnione mu dokumenty.
 */

const DIRECTORY: ResourceType[] = ['HealthcareService', 'Practitioner', 'PractitionerRole', 'Location', 'Organization'];
const CLINICAL: ResourceType[] = [
  'Patient',
  'Appointment',
  'Slot',
  'Schedule',
  'DiagnosticReport',
  'Observation',
  'DocumentReference',
  'Consent',
  'Communication',
  'MedicationStatement',
  'Questionnaire',
  'QuestionnaireResponse',
];
const RECEPTION: ResourceType[] = ['Patient', 'Appointment', 'Slot', 'Schedule', ...DIRECTORY];
const PATIENT_TYPES: ResourceType[] = [
  'Patient',
  'Appointment',
  'DiagnosticReport',
  'DocumentReference',
  'Observation',
  'Consent',
  'Communication',
  'MedicationStatement',
  'QuestionnaireResponse',
  'Questionnaire',
  ...DIRECTORY,
];

function allowedTypes(roles: string[]): ResourceType[] {
  if (roles.includes('practitioner')) return [...CLINICAL, ...DIRECTORY, ...(roles.includes('admin') ? (['AuditEvent'] as ResourceType[]) : [])];
  const out = new Set<ResourceType>();
  if (roles.includes('reception')) RECEPTION.forEach((t) => out.add(t));
  if (roles.includes('admin')) [...DIRECTORY, 'AuditEvent' as ResourceType].forEach((t) => out.add(t));
  if (roles.includes('patient')) PATIENT_TYPES.forEach((t) => out.add(t));
  return [...out];
}

function compartmentParams(type: ResourceType, patientRef: string): SearchParams | undefined {
  switch (type) {
    case 'Patient':
      return { _id: patientRef.split('/')[1] };
    case 'Appointment':
    case 'Consent':
      return { patient: patientRef };
    case 'DiagnosticReport':
    case 'DocumentReference':
      return { subject: patientRef, _tag: `${TAG_PATIENT_VISIBLE.system}|${TAG_PATIENT_VISIBLE.code}` };
    case 'Observation':
      return { subject: patientRef, category: `${OBS_CATEGORY}|vital-signs` };
    case 'Communication':
    case 'MedicationStatement':
    case 'QuestionnaireResponse':
      return { subject: patientRef };
    default:
      return undefined;
  }
}

function inCompartment(r: Resource, patientRef: string): boolean {
  const a = r as unknown as Record<string, unknown>;
  if (r.resourceType === 'Patient') return `Patient/${r.id}` === patientRef;
  if (DIRECTORY.includes(r.resourceType) || r.resourceType === 'Questionnaire') return true;
  const refs = [
    (a.subject as { reference?: string } | undefined)?.reference,
    (a.patient as { reference?: string } | undefined)?.reference,
    ...((a.participant as { actor?: { reference?: string } }[] | undefined)?.map((p) => p.actor?.reference) ?? []),
  ];
  if (!refs.includes(patientRef)) return false;
  if (r.resourceType === 'DiagnosticReport' || r.resourceType === 'DocumentReference') {
    return !!r.meta?.tag?.some((t) => t.system === TAG_PATIENT_VISIBLE.system && t.code === TAG_PATIENT_VISIBLE.code);
  }
  if (r.resourceType === 'Observation') {
    return !!(a.category as { coding?: { code?: string }[] }[] | undefined)?.some((c) => c.coding?.some((cd) => cd.code === 'vital-signs'));
  }
  return true;
}

function bundle(req: FastifyRequest, resources: Resource[]): Bundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    link: [{ relation: 'self', url: `${config.publicUrl}${req.url}` }],
    entry: resources.map((r) => ({ fullUrl: `${config.publicUrl}/fhir/R4/${r.resourceType}/${r.id}`, resource: r, search: { mode: 'match' } })),
  };
}

function capability(): CapabilityStatement {
  const types = [...new Set([...CLINICAL, ...DIRECTORY])];
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    software: { name: 'Eternal', version: '1.0.0' },
    implementation: { description: 'Eternal — aplikacja pacjenta i panel placówki', url: `${config.publicUrl}/fhir/R4` },
    rest: [
      {
        mode: 'server',
        security: { description: 'Sesja aplikacji (ciasteczko), uprawnienia wg ról; pacjent — wyłącznie własny przedział danych.' },
        resource: types.map((type) => ({ type, interaction: [{ code: 'read' }, { code: 'search-type' }] })),
      },
    ],
  };
}

export async function fhirRoutes(app: FastifyInstance): Promise<void> {
  const send = (reply: import('fastify').FastifyReply, body: unknown) => reply.header('Content-Type', 'application/fhir+json; charset=utf-8').send(body);

  app.get('/fhir/R4/metadata', async (_req, reply) => send(reply, capability()));

  app.get('/fhir/R4/:type', async (req, reply) => {
    const auth = requireUser(req);
    const { type } = req.params as { type: ResourceType };
    if (!allowedTypes(auth.user.roles).includes(type)) throw forbidden('resource_type_not_allowed');
    const raw = (req.query ?? {}) as SearchParams;
    const q: SearchParams = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_include') && !k.startsWith('_revinclude')));
    if (type === 'AuditEvent') {
      const rows = listAudit({ limit: Number(q._count ?? 100), patientRef: typeof q.patient === 'string' ? q.patient : undefined });
      return send(reply, bundle(req, rows.map(toAuditEvent)));
    }
    let results: Resource[];
    if (!isStaff(auth.user)) {
      const patientRef = auth.user.fhir_ref ?? '';
      if ((type === 'DiagnosticReport' || type === 'DocumentReference') && !(await patientCanViewRecords(patientRef)).allowed) {
        return send(reply, bundle(req, []));
      }
      const forced = compartmentParams(type, patientRef);
      results = await fhir().search(type, { ...q, ...(forced ?? {}) });
      results = results.filter((r) => inCompartment(r, patientRef));
    } else {
      results = await fhir().search(type, q);
    }
    audit(actorOf(req), { action: 'R', subtype: 'fhir-search', entityRef: type, patientRef: auth.user.fhir_ref?.startsWith('Patient/') ? auth.user.fhir_ref : undefined, detail: { count: results.length } });
    return send(reply, bundle(req, results));
  });

  app.get('/fhir/R4/:type/:id', async (req, reply) => {
    const auth = requireUser(req);
    const { type, id } = req.params as { type: ResourceType; id: string };
    if (!allowedTypes(auth.user.roles).includes(type) || type === 'AuditEvent') throw forbidden('resource_type_not_allowed');
    const r = await fhir().readOptional(type, id);
    if (!r) throw notFound();
    if (!isStaff(auth.user)) {
      const patientRef = auth.user.fhir_ref ?? '';
      if (!inCompartment(r, patientRef)) throw notFound();
      if ((type === 'DiagnosticReport' || type === 'DocumentReference') && !(await patientCanViewRecords(patientRef)).allowed) throw notFound();
    }
    const subject = (r as { subject?: { reference?: string } }).subject?.reference;
    audit(actorOf(req), { action: 'R', subtype: 'fhir-read', entityRef: `${type}/${id}`, patientRef: type === 'Patient' ? `Patient/${id}` : subject });
    return send(reply, r);
  });
}
