import type { Location, Organization } from '@medplum/fhirtypes';
import type { AuditActor } from '../../server/audit.js';
import { closeDatabase, getDb, initDatabase } from '../../server/db.js';
import { setRepo } from '../../server/fhir/index.js';
import { LocalFhirRepository } from '../../server/fhir/local.js';
import { fhir } from '../../server/fhir/index.js';
import { invalidateDirectory, upsertPractitioner, upsertService } from '../../server/services/directory.js';
import { createPatient } from '../../server/services/patients.js';
import { createUser } from '../../server/auth/users.js';
import { setConsent } from '../../server/services/consents.js';
import { addDays, holidayName, isoWeekday, localDate } from '../../server/lib/time.js';

export const system: AuditActor = { display: 'test' };

export async function setupCore(): Promise<void> {
  closeDatabase();
  initDatabase(':memory:');
  const repo = new LocalFhirRepository(getDb());
  await repo.init();
  setRepo(repo);
  invalidateDirectory();
}

/** Minimalna placówka: organizacja, lokalizacja, usługa (20 min), lekarz. */
export async function setupClinic() {
  const org = await fhir().create<Organization>({ resourceType: 'Organization', name: 'Testowa placówka', active: true });
  const loc = await fhir().create<Location>({ resourceType: 'Location', name: 'Gabinet 1', status: 'active' });
  const service = await upsertService(system, { name: 'Konsultacja', durationMinutes: 20, mode: 'in-person', active: true, locationIds: [loc.id ?? ''], price: 100 });
  const tele = await upsertService(system, { name: 'Teleporada', durationMinutes: 15, mode: 'tele', active: true, locationIds: [] });
  const doctor = await upsertPractitioner(system, { given: 'Jan', family: 'Testowy', prefix: 'lek.', serviceIds: [service.id, tele.id], locationIds: [loc.id ?? ''], active: true });
  invalidateDirectory();
  return { org, loc, service, tele, doctor };
}

export async function makePatient(given = 'Anna', family = 'Pacjentka', opts: { verified?: boolean; account?: boolean } = { verified: true, account: true }) {
  const p = await createPatient(system, { given, family, birthDate: '1990-05-05', email: `${given.toLowerCase()}.${family.toLowerCase()}@test.local` }, { verified: opts.verified });
  const ref = `Patient/${p.id}`;
  let userId: string | undefined;
  if (opts.account) {
    userId = createUser({ email: `${given.toLowerCase()}.${family.toLowerCase()}@test.local`, passwordHash: 'x', roles: ['patient'], fhirRef: ref, displayName: `${given} ${family}`, emailVerified: true }).id;
  }
  const actor: AuditActor = { userId, actorRef: ref, display: `${given} ${family}`, roles: ['patient'] };
  return { patient: p, ref, userId, actor };
}

export async function grantAll(actor: AuditActor, ref: string, types: Parameters<typeof setConsent>[2][]) {
  for (const t of types) await setConsent(actor, ref, t, true);
}

/** Najbliższy dzień roboczy niebędący świętem, co najmniej `minDays` dni od dziś (YYYY-MM-DD). */
export function nextWorkday(minDays = 2): string {
  let d = addDays(localDate(new Date(), 'Europe/Warsaw'), minDays);
  while (isoWeekday(d) > 5 || holidayName(d)) d = addDays(d, 1);
  return d;
}
