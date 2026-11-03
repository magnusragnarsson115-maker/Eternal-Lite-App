import type { Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { badRequest, fetchWithTimeout, HttpError, isValidPesel, nowIso } from '../lib/util.js';
import { getSetting, setSetting } from '../settings.js';
import { createPatient, findPatientByPesel } from '../services/patients.js';
import { bookAppointment, cancelAppointment, findFreeSlots } from '../services/scheduling.js';
import { runInScope } from '../tenancy.js';

/**
 * Docplanner / ZnanyLekarz — Integrations API v3 (https://integrations.docplanner.com). Zamiast widżetu rezerwacji
 * na stronie: dwukierunkowa synchronizacja przez API. Terminy z kalendarza Eternal trafiają do ZnanyLekarz
 * (replaceSlots), rezerwacje pacjentów z ZnanyLekarz wracają jako wizyty w kalendarzu placówki (getBookings),
 * odwołania w obu kierunkach. Uwierzytelnienie: OAuth2 client_credentials, scope „integration”.
 * Dostęp: klucze API dla klientów Docplanner (panel ZnanyLekarz → Integracje).
 */

export interface DocplannerDoctorMap {
  practitionerId: string;
  doctorId: string;
  addressId: string;
  services: { serviceId: string; addressServiceId: string }[];
}
export interface DocplannerMapping {
  facilityId: string;
  doctors: DocplannerDoctorMap[];
  lastSlotsPushAt?: string;
  lastBookingsPullAt?: string;
}

const mapKey = (orgId: string) => `docplanner-map:${orgId}`;
const bookingKey = (orgId: string, bookingId: string) => `docplanner-booking:${orgId}:${bookingId}`;

export function docplannerConfigured(): boolean {
  return !!(config.docplanner.clientId && config.docplanner.clientSecret);
}

export function getMapping(orgId: string): DocplannerMapping | undefined {
  return getSetting<DocplannerMapping>(mapKey(orgId));
}

export function setMapping(actor: AuditActor, orgId: string, m: DocplannerMapping): DocplannerMapping {
  if (!m.facilityId || !m.doctors.length) throw badRequest('mapping_incomplete');
  const prev = getMapping(orgId);
  const v: DocplannerMapping = { ...m, lastSlotsPushAt: prev?.lastSlotsPushAt, lastBookingsPullAt: prev?.lastBookingsPullAt };
  setSetting(mapKey(orgId), v);
  audit(actor, { action: 'U', subtype: 'docplanner-mapping', detail: { facility: m.facilityId, doctors: m.doctors.length } });
  return v;
}

let token: { value: string; exp: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${config.docplanner.clientId}:${config.docplanner.clientSecret}`).toString('base64');
  const res = await fetchWithTimeout(`${config.docplanner.domain.replace(/\/$/, '')}/oauth/v2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'integration' }),
  }).catch((err: Error) => {
    throw new HttpError(502, 'docplanner_unreachable', err.message);
  });
  if (!res.ok) throw new HttpError(502, 'docplanner_auth', `Docplanner token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

/** Tylko dla testów: wyczyszczenie tokenu. */
export function resetDocplannerToken(): void {
  token = undefined;
}

async function api<T>(method: 'GET' | 'PUT' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (!docplannerConfigured()) throw new HttpError(409, 'docplanner_not_configured');
  const res = await fetchWithTimeout(`${config.docplanner.domain.replace(/\/$/, '')}/api/v3/integration${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch((err: Error) => {
    throw new HttpError(502, 'docplanner_unreachable', err.message);
  });
  if (res.status === 401) {
    token = undefined;
    throw new HttpError(502, 'docplanner_auth');
  }
  if (res.status === 429) throw new HttpError(503, 'docplanner_rate_limited');
  if (!res.ok) throw new HttpError(502, 'docplanner_error', `Docplanner ${res.status} ${path}`);
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => ({}))) as T;
}

const items = <T>(r: { _items?: T[] } | T[] | undefined): T[] => (Array.isArray(r) ? r : (r?._items ?? []));

// --- odczyt struktury konta (do mapowania w panelu administratora) -------------------------------------------------

export async function listFacilities(): Promise<{ id: string; name: string }[]> {
  return items(await api<{ _items?: { id: string | number; name: string }[] }>('GET', '/facilities')).map((f) => ({ id: String(f.id), name: f.name }));
}
export async function listDoctors(facilityId: string): Promise<{ id: string; name: string }[]> {
  return items(await api<{ _items?: { id: string | number; name?: string; surname?: string }[] }>('GET', `/facilities/${facilityId}/doctors`)).map((d) => ({ id: String(d.id), name: [d.name, d.surname].filter(Boolean).join(' ') }));
}
export async function listAddresses(facilityId: string, doctorId: string): Promise<{ id: string; name: string }[]> {
  return items(await api<{ _items?: { id: string | number; name?: string; city_name?: string; street?: string }[] }>('GET', `/facilities/${facilityId}/doctors/${doctorId}/addresses`)).map((a) => ({
    id: String(a.id),
    name: [a.name, a.street, a.city_name].filter(Boolean).join(', '),
  }));
}
export async function listAddressServices(facilityId: string, doctorId: string, addressId: string): Promise<{ id: string; name: string }[]> {
  return items(await api<{ _items?: { id: string | number; name?: string }[] }>('GET', `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/services`)).map((s) => ({ id: String(s.id), name: s.name ?? '' }));
}

// --- wysyłka wolnych terminów ----------------------------------------------------------------------------------------

export interface DpSlot {
  start: string;
  end: string;
  address_services: { address_service_id: number | string; duration: number }[];
}

/** Wolne terminy lekarza z kalendarza Eternal → format replaceSlots (jeden termin może obsłużyć kilka usług). */
export async function slotsFor(map: DocplannerDoctorMap, from: string, to: string): Promise<DpSlot[]> {
  const byStart = new Map<string, DpSlot>();
  for (const s of map.services) {
    for (const slot of await findFreeSlots({ serviceId: s.serviceId, practitionerId: map.practitionerId, from, to })) {
      const duration = Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60_000);
      const entry = byStart.get(slot.start) ?? { start: slot.start, end: slot.end, address_services: [] };
      if (!entry.address_services.some((x) => String(x.address_service_id) === s.addressServiceId)) entry.address_services.push({ address_service_id: /^\d+$/.test(s.addressServiceId) ? Number(s.addressServiceId) : s.addressServiceId, duration });
      byStart.set(slot.start, entry);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export async function pushSlots(actor: AuditActor, orgId: string, days = 28, now = new Date()): Promise<{ doctors: number; slots: number }> {
  const m = getMapping(orgId);
  if (!m) throw badRequest('docplanner_not_mapped');
  const from = now.toISOString();
  const to = new Date(now.getTime() + days * 86_400_000).toISOString();
  let total = 0;
  for (const d of m.doctors) {
    const slots = await runInScope({ orgId }, () => slotsFor(d, from, to));
    await api('PUT', `/facilities/${m.facilityId}/doctors/${d.doctorId}/addresses/${d.addressId}/slots`, { slots });
    total += slots.length;
  }
  setSetting(mapKey(orgId), { ...m, lastSlotsPushAt: nowIso() });
  audit(actor, { action: 'E', subtype: 'docplanner-slots-push', detail: { doctors: m.doctors.length, slots: total } });
  return { doctors: m.doctors.length, slots: total };
}

// --- pobieranie rezerwacji ----------------------------------------------------------------------------------------

export interface DpBooking {
  id: string | number;
  status?: string;
  start_at: string;
  end_at?: string;
  patient?: { name?: string; surname?: string; email?: string; phone?: string | number; birth_date?: string; nin?: string; gender?: string };
  address_service?: { id?: string | number; name?: string };
}

/** Data urodzenia z numeru PESEL (miesiąc z przesunięciem stulecia). */
export function birthDateFromPesel(pesel: string): string | undefined {
  if (!/^\d{11}$/.test(pesel)) return undefined;
  const yy = Number(pesel.slice(0, 2));
  let mm = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));
  const century = mm > 80 ? 1800 : mm > 60 ? 2200 : mm > 40 ? 2100 : mm > 20 ? 2000 : 1900;
  mm -= century === 1800 ? 80 : century === 2200 ? 60 : century === 2100 ? 40 : century === 2000 ? 20 : 0;
  const iso = `${century + yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return Number.isFinite(Date.parse(iso)) && mm >= 1 && mm <= 12 ? iso : undefined;
}

async function patientFor(actor: AuditActor, p: NonNullable<DpBooking['patient']>): Promise<Patient | undefined> {
  const pesel = p.nin && isValidPesel(p.nin) ? p.nin : undefined;
  if (pesel) {
    const found = await findPatientByPesel(pesel);
    if (found) return found;
  }
  const phone = p.phone ? String(p.phone).replace(/\s+/g, '') : undefined;
  if (phone) {
    const found = (await fhir().search<Patient>('Patient', { telecom: phone, _count: '2' }).catch(() => [] as Patient[]))[0];
    if (found) return found;
  }
  // nowy pacjent z ZnanyLekarz: tożsamość niepotwierdzona do czasu weryfikacji w placówce
  const birthDate = p.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date) ? p.birth_date : pesel ? birthDateFromPesel(pesel) : undefined;
  if (!birthDate) return undefined; // kartoteka wymaga daty urodzenia — rejestracja uzupełni dane z pacjentem
  return createPatient(actor, {
    given: (p.name ?? 'Pacjent').slice(0, 80),
    family: (p.surname ?? 'ZnanyLekarz').slice(0, 80),
    birthDate,
    pesel,
    phone: phone && /^\+?\d{9,15}$/.test(phone) ? phone : undefined,
    email: p.email || undefined,
    gender: p.gender === 'm' || p.gender === 'male' ? 'male' : p.gender === 'f' || p.gender === 'female' ? 'female' : undefined,
  });
}

/** Rezerwacje z ZnanyLekarz → wizyty w kalendarzu (na ten sam wolny termin); odwołane → odwołanie wizyty. */
export async function pullBookings(actor: AuditActor, orgId: string, days = 28, now = new Date()): Promise<{ created: number; cancelled: number; skipped: number }> {
  const m = getMapping(orgId);
  if (!m) throw badRequest('docplanner_not_mapped');
  const start = now.toISOString();
  const end = new Date(now.getTime() + days * 86_400_000).toISOString();
  let created = 0;
  let cancelled = 0;
  let skipped = 0;
  for (const d of m.doctors) {
    const list = items(await api<{ _items?: DpBooking[] }>('GET', `/facilities/${m.facilityId}/doctors/${d.doctorId}/addresses/${d.addressId}/bookings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`));
    for (const b of list) {
      const known = getSetting<string>(bookingKey(orgId, String(b.id)));
      const isCancelled = /cancel/i.test(b.status ?? '');
      await runInScope({ orgId }, async () => {
        if (known) {
          if (isCancelled && known !== 'cancelled') {
            // odwołanie przyszło z kalendarza zewnętrznego — wykonuje je placówka (reguły odwołań online nie dotyczą)
            const ok = await cancelAppointment(actor, { appointmentId: known, by: 'staff', reason: 'Pacjent odwołał wizytę w ZnanyLekarz' }).then(
              () => true,
              () => false,
            );
            if (ok) {
              setSetting(bookingKey(orgId, String(b.id)), 'cancelled');
              cancelled++;
            } else skipped++;
          }
          return;
        }
        if (isCancelled || !b.patient) {
          skipped++;
          return;
        }
        const svc = d.services.find((s) => s.addressServiceId === String(b.address_service?.id)) ?? d.services[0];
        const startAt = new Date(b.start_at).toISOString();
        const slot = (await findFreeSlots({ serviceId: svc.serviceId, practitionerId: d.practitionerId, from: new Date(Date.parse(startAt) - 60_000).toISOString(), to: new Date(Date.parse(startAt) + 60_000).toISOString() })).find(
          (s) => Date.parse(s.start) === Date.parse(startAt),
        );
        if (!slot) {
          skipped++;
          return;
        }
        const patient = await patientFor(actor, b.patient);
        if (!patient) {
          skipped++;
          return;
        }
        const appt = await bookAppointment(actor, { slotId: slot.id, serviceId: svc.serviceId, patientRef: `Patient/${patient.id}`, bookedBy: 'patient', comment: `Rezerwacja ZnanyLekarz #${b.id}` });
        setSetting(bookingKey(orgId, String(b.id)), appt.id);
        created++;
      });
    }
  }
  setSetting(mapKey(orgId), { ...(getMapping(orgId) ?? m), lastBookingsPullAt: nowIso() });
  audit(actor, { action: 'C', subtype: 'docplanner-bookings-pull', detail: { created, cancelled, skipped } });
  return { created, cancelled, skipped };
}

/** Synchronizacja w tle: rezerwacje co przebieg, terminy co przebieg (lekkie — 28 dni). */
export async function runDocplannerSweep(orgIds: string[]): Promise<number> {
  if (!docplannerConfigured() || config.demoMode) return 0;
  let n = 0;
  for (const orgId of orgIds) {
    if (!getMapping(orgId)) continue;
    const actor: AuditActor = { display: 'Synchronizacja ZnanyLekarz' };
    try {
      await pullBookings(actor, orgId);
      await pushSlots(actor, orgId);
      n++;
    } catch {
      /* kolejna próba w następnym przebiegu */
    }
  }
  return n;
}
