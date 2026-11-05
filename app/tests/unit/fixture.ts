import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app.js';
import { hashPassword } from '../../server/auth/passwords.js';
import { createUser, updateUser } from '../../server/auth/users.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { createOrganization, ensureOrganizations } from '../../server/services/orgs.js';
import { bookAppointment, createAvailability, findFreeSlots } from '../../server/services/scheduling.js';
import { runInScope, setDefaultOrgId, withOrgTags } from '../../server/tenancy.js';
import { Client } from './client.js';
import { makePatient, nextWorkday, setupClinic, setupCore, system } from './helpers.js';

export const PW = 'Haslo-Personelu-2026';
const SECRETS = ['JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU', 'MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'];

/**
 * Wspólne środowisko testów API: klinika (organizacja domyślna), druga klinika, lekarz, rejestracja, administrator,
 * lekarz drugiej kliniki, pacjent bez konta z wizytą i telefonem.
 */
export async function orgFixture(opts: { patientAccount?: boolean } = {}) {
  await setupCore();
  const ctx = await setupClinic();
  const orgId = ctx.org.id ?? '';
  await fhirSystem().update(withOrgTags(ctx.org, [orgId]));
  setDefaultOrgId(orgId);
  await ensureOrganizations();
  const other = await createOrganization(system, { name: 'Inna klinika' });
  const day = nextWorkday(3);
  await runInScope({ orgId }, () =>
    createAvailability(system, { practitionerId: ctx.doctor.id, serviceIds: [ctx.service.id, ctx.tele.id], locationId: ctx.loc.id ?? '', from: day, to: day, weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '12:00', slotMinutes: 20 }),
  );
  const p = await makePatient('Maria', 'Linkowa', { verified: true, account: !!opts.patientAccount });
  const withPhone = { ...p.patient, telecom: [{ system: 'phone' as const, value: '+48600100200' }] };
  await fhirSystem().update(withPhone);
  const appt = await runInScope({ orgId }, async () => {
    const slots = await findFreeSlots({ serviceId: ctx.service.id, from: `${day}T00:00:00Z`, to: `${day}T23:59:59Z` });
    return bookAppointment(system, { patientRef: p.ref, slotId: slots[0].id, serviceId: ctx.service.id, bookedBy: 'staff' });
  });
  const pw = await hashPassword(PW);
  const mk = (email: string, roles: ('practitioner' | 'reception' | 'admin')[], secret: string, org: string, fhirRef?: string, name = email) => {
    const u = createUser({ email, passwordHash: pw, roles, fhirRef, displayName: name, emailVerified: true, orgId: org });
    updateUser(u.id, { totp_secret: secret, totp_enabled: true });
    return u;
  };
  const users = {
    doctor: mk('lekarz@fx.local', ['practitioner'], SECRETS[0], orgId, `Practitioner/${ctx.doctor.id}`, 'lek. Jan Testowy'),
    reception: mk('recepcja@fx.local', ['reception'], SECRETS[1], orgId, undefined, 'Recepcja'),
    other: mk('lekarz@inna.local', ['practitioner'], SECRETS[2], other.id, undefined, 'lek. Obcy'),
    admin: mk('admin@fx.local', ['admin'], SECRETS[3], orgId, undefined, 'Administrator'),
  };
  const app: FastifyInstance = await buildApp();
  const login = async (email: string, secret: string) => {
    const c = new Client(app);
    await c.loginStaff(email, PW, secret);
    return c;
  };
  return {
    app,
    ctx,
    orgId,
    otherOrgId: other.id,
    patient: p,
    appt,
    day,
    users,
    clients: {
      doctor: await login('lekarz@fx.local', SECRETS[0]),
      reception: await login('recepcja@fx.local', SECRETS[1]),
      other: await login('lekarz@inna.local', SECRETS[2]),
      admin: await login('admin@fx.local', SECRETS[3]),
    },
  };
}
