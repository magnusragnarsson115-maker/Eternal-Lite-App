import type {
  HealthcareService,
  Location,
  Organization,
  Practitioner,
  PractitionerRole,
  Questionnaire,
  Reference,
  Schedule,
} from '@medplum/fhirtypes';
import { formatHumanName } from '@medplum/core';
import { audit, type AuditActor } from '../audit.js';
import { ETERNAL, NPWZ_SYSTEM } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { badRequest, notFound } from '../lib/util.js';
import { getSetting, setSetting, type ClinicSettings } from '../settings.js';
import { config } from '../config.js';

/** Katalog placówki: organizacja, lokalizacje, personel, usługi. Mała, często czytana — cache w pamięci. */

export const SERVICE_SYSTEM = 'urn:eternal:healthcare-service';

export interface ServiceView {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  mode: 'in-person' | 'tele';
  price?: number;
  program?: string;
  preparation?: string;
  questionnaireId?: string;
  specialty?: string;
  active: boolean;
  locationIds: string[];
}

export interface PractitionerView {
  id: string;
  name: string;
  prefix?: string;
  specialty?: string;
  npwz?: string;
  serviceIds: string[];
  locationIds: string[];
  active: boolean;
  bio?: string;
}

export interface LocationView {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

let cache: { at: number; services: ServiceView[]; practitioners: PractitionerView[]; locations: LocationView[] } | undefined;
const TTL = 60_000;

export function invalidateDirectory(): void {
  cache = undefined;
}

function ext<T = unknown>(r: { extension?: { url: string }[] }, url: string, key: string): T | undefined {
  const e = r.extension?.find((x) => x.url === url) as Record<string, unknown> | undefined;
  return e?.[key] as T | undefined;
}

export function toServiceView(s: HealthcareService): ServiceView {
  return {
    id: s.id ?? '',
    name: s.name ?? '',
    description: s.comment,
    durationMinutes: ext<number>(s, ETERNAL.ext.durationMinutes, 'valueInteger') ?? 20,
    mode: s.characteristic?.some((c) => c.coding?.some((cd) => cd.system === ETERNAL.visitMode && cd.code === 'tele')) ? 'tele' : 'in-person',
    price: ext<{ value?: number }>(s, ETERNAL.price, 'valueMoney')?.value,
    program: s.program?.[0]?.text,
    preparation: ext<string>(s, ETERNAL.ext.preparation, 'valueString'),
    questionnaireId: ext<Reference>(s, ETERNAL.ext.questionnaire, 'valueReference')?.reference?.split('/')[1],
    specialty: s.specialty?.[0]?.text,
    active: s.active !== false,
    locationIds: (s.location ?? []).map((l) => l.reference?.split('/')[1] ?? '').filter(Boolean),
  };
}

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const [services, practitioners, roles, locations] = await Promise.all([
    fhir().search<HealthcareService>('HealthcareService', { _sort: 'name' }),
    fhir().search<Practitioner>('Practitioner', {}),
    fhir().search<PractitionerRole>('PractitionerRole', {}),
    fhir().search<Location>('Location', {}),
  ]);
  cache = {
    at: Date.now(),
    services: services.map(toServiceView),
    practitioners: practitioners
      .map((p) => {
        const pr = roles.filter((r) => r.practitioner?.reference === `Practitioner/${p.id}` && r.active !== false);
        const name = p.name?.[0];
        return {
          id: p.id ?? '',
          name: name ? formatHumanName(name, { prefix: true }) : 'Lekarz',
          prefix: name?.prefix?.join(' '),
          specialty: pr.flatMap((r) => r.specialty ?? []).map((s) => s.text ?? s.coding?.[0]?.display ?? '')[0],
          npwz: p.identifier?.find((i) => i.system === NPWZ_SYSTEM)?.value,
          serviceIds: pr.flatMap((r) => r.healthcareService ?? []).map((h) => h.reference?.split('/')[1] ?? ''),
          locationIds: pr.flatMap((r) => r.location ?? []).map((h) => h.reference?.split('/')[1] ?? ''),
          active: p.active !== false,
          bio: p.extension?.find((e) => e.url === 'urn:eternal:ext:bio')?.valueString,
        } satisfies PractitionerView;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pl')),
    locations: locations.map((l) => ({
      id: l.id ?? '',
      name: l.name ?? '',
      address: l.address ? [l.address.line?.join(' '), l.address.postalCode, l.address.city].filter(Boolean).join(', ') : undefined,
      phone: l.telecom?.find((t) => t.system === 'phone')?.value,
    })),
  };
  return cache;
}

export async function listServices(includeInactive = false): Promise<ServiceView[]> {
  const d = await load();
  return includeInactive ? d.services : d.services.filter((s) => s.active);
}

export async function getService(id: string): Promise<ServiceView> {
  const s = (await load()).services.find((x) => x.id === id);
  if (!s) throw notFound('service_not_found');
  return s;
}

export async function listPractitioners(includeInactive = false): Promise<PractitionerView[]> {
  const d = await load();
  return includeInactive ? d.practitioners : d.practitioners.filter((p) => p.active);
}

export async function getPractitioner(id: string): Promise<PractitionerView> {
  const p = (await load()).practitioners.find((x) => x.id === id);
  if (!p) throw notFound('practitioner_not_found');
  return p;
}

export async function listLocations(): Promise<LocationView[]> {
  return (await load()).locations;
}

/** Grafik (Schedule) lekarza — jeden na lekarza i lokalizację, tworzony przy pierwszej dostępności. */
export async function ensureSchedule(practitionerId: string, locationId?: string): Promise<Schedule> {
  const existing = await fhir().search<Schedule>('Schedule', { actor: `Practitioner/${practitionerId}`, active: 'true' });
  const match = existing.find((s) => !locationId || s.actor.some((a) => a.reference === `Location/${locationId}`));
  if (match) return match;
  const p = await getPractitioner(practitionerId);
  return fhir().create<Schedule>({
    resourceType: 'Schedule',
    active: true,
    actor: [
      { reference: `Practitioner/${practitionerId}`, display: p.name },
      ...(locationId ? [{ reference: `Location/${locationId}` }] : []),
    ],
    comment: `Grafik: ${p.name}`,
  });
}

export async function getOrganization(): Promise<Organization | undefined> {
  return (await fhir().search<Organization>('Organization', { _count: '1' }))[0];
}

export function defaultClinicSettings(): ClinicSettings {
  return {
    name: 'Placówka medyczna',
    phone: '',
    email: '',
    address: '',
    cancelMinHours: config.clinic.cancelMinHours,
    reminderOffsetsHours: config.clinic.reminderOffsetsHours,
    emergencyInfo: 'W stanie nagłego zagrożenia życia lub zdrowia dzwoń pod numer alarmowy 112.',
    messageResponseDays: 2,
    privacyContact: '',
  };
}

export function getClinicSettings(): ClinicSettings {
  return { ...defaultClinicSettings(), ...(getSetting<Partial<ClinicSettings>>('clinic') ?? {}) };
}

export function updateClinicSettings(actor: AuditActor, patch: Partial<ClinicSettings>): ClinicSettings {
  const next = { ...getClinicSettings(), ...patch };
  if (next.cancelMinHours < 0 || next.cancelMinHours > 168) throw badRequest('invalid_cancel_window');
  if (next.reminderOffsetsHours.some((h) => !(h > 0 && h <= 168))) throw badRequest('invalid_reminder_offsets');
  setSetting('clinic', next);
  audit(actor, { action: 'U', subtype: 'settings-update', detail: { keys: Object.keys(patch) } });
  return next;
}

// --- zarządzanie katalogiem (administrator) -------------------------------------------------------

export async function upsertService(actor: AuditActor, input: Omit<ServiceView, 'id'> & { id?: string }): Promise<ServiceView> {
  if (!input.name.trim()) throw badRequest('name_required');
  if (!(input.durationMinutes >= 5 && input.durationMinutes <= 480)) throw badRequest('invalid_duration');
  const org = await getOrganization();
  const resource: HealthcareService = {
    resourceType: 'HealthcareService',
    ...(input.id ? { id: input.id } : {}),
    active: input.active,
    name: input.name.trim(),
    comment: input.description || undefined,
    providedBy: org ? { reference: `Organization/${org.id}` } : undefined,
    location: input.locationIds.map((id) => ({ reference: `Location/${id}` })),
    appointmentRequired: true,
    specialty: input.specialty ? [{ text: input.specialty }] : undefined,
    program: input.program ? [{ text: input.program }] : undefined,
    characteristic: [{ coding: [{ system: ETERNAL.visitMode, code: input.mode, display: input.mode === 'tele' ? 'Teleporada' : 'Wizyta stacjonarna' }] }],
    extension: [
      { url: ETERNAL.ext.durationMinutes, valueInteger: input.durationMinutes },
      ...(input.price !== undefined ? [{ url: ETERNAL.price, valueMoney: { value: input.price, currency: 'PLN' as const } }] : []),
      ...(input.preparation ? [{ url: ETERNAL.ext.preparation, valueString: input.preparation }] : []),
      ...(input.questionnaireId ? [{ url: ETERNAL.ext.questionnaire, valueReference: { reference: `Questionnaire/${input.questionnaireId}` } }] : []),
    ],
  };
  const saved = input.id ? await fhir().update(resource) : await fhir().create(resource);
  audit(actor, { action: input.id ? 'U' : 'C', subtype: 'service-upsert', entityRef: `HealthcareService/${saved.id}` });
  invalidateDirectory();
  return toServiceView(saved);
}

export async function upsertPractitioner(
  actor: AuditActor,
  input: { id?: string; prefix?: string; given: string; family: string; npwz?: string; specialty?: string; serviceIds: string[]; locationIds: string[]; active: boolean; bio?: string },
): Promise<PractitionerView> {
  if (!input.given.trim() || !input.family.trim()) throw badRequest('name_required');
  if (input.npwz && !/^\d{7}$/.test(input.npwz)) throw badRequest('invalid_npwz');
  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    ...(input.id ? { id: input.id } : {}),
    active: input.active,
    name: [{ use: 'official', family: input.family.trim(), given: [input.given.trim()], prefix: input.prefix ? [input.prefix] : undefined }],
    identifier: input.npwz ? [{ system: NPWZ_SYSTEM, value: input.npwz }] : undefined,
    extension: input.bio ? [{ url: 'urn:eternal:ext:bio', valueString: input.bio }] : undefined,
  };
  const saved = input.id ? await fhir().update(practitioner) : await fhir().create(practitioner);
  const org = await getOrganization();
  const roles = await fhir().search<PractitionerRole>('PractitionerRole', { practitioner: `Practitioner/${saved.id}` });
  const role: PractitionerRole = {
    resourceType: 'PractitionerRole',
    ...(roles[0]?.id ? { id: roles[0].id } : {}),
    active: input.active,
    practitioner: { reference: `Practitioner/${saved.id}` },
    organization: org ? { reference: `Organization/${org.id}` } : undefined,
    specialty: input.specialty ? [{ text: input.specialty }] : undefined,
    healthcareService: input.serviceIds.map((id) => ({ reference: `HealthcareService/${id}` })),
    location: input.locationIds.map((id) => ({ reference: `Location/${id}` })),
  };
  if (role.id) await fhir().update(role);
  else await fhir().create(role);
  audit(actor, { action: input.id ? 'U' : 'C', subtype: 'practitioner-upsert', entityRef: `Practitioner/${saved.id}` });
  invalidateDirectory();
  return getPractitioner(saved.id ?? '');
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  return fhir().search<Questionnaire>('Questionnaire', { status: 'active' });
}
