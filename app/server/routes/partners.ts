import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { actorOf, requireClinician, requirePatient, requireStaff } from '../auth/sessions.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { getMapping, docplannerConfigured, listAddresses, listAddressServices, listDoctors, listFacilities, pullBookings, pushSlots, setMapping } from '../integrations/docplanner.js';
import { clearRegulatoryAck, infermedicaConfigured, regulatoryAck, setRegulatoryAck } from '../integrations/infermedica.js';
import { connectValidic, syncValidic, validicStatus } from '../integrations/validic.js';
import { body, IdParams, params, zId } from '../lib/http.js';
import { badRequest, notFound } from '../lib/util.js';
import { startEngineInterview } from '../services/interview.js';
import { staffOrgId } from '../services/orgs.js';
import { eternalIdFor } from '../services/snapshot.js';

/**
 * Integracje partnerów przez API (bez osadzonych widżetów): Validic Inform (urządzenia pacjenta), Docplanner /
 * ZnanyLekarz (terminy i rezerwacje), Infermedica (wywiad objawowy — tylko po ocenie zgodności MDR) i link do
 * licencjonowanej przeglądarki 3D badań obrazowych. Klucze wyłącznie w zmiennych środowiska serwera.
 */

const Id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

export async function partnerRoutes(app: FastifyInstance): Promise<void> {
  // --- Validic: pacjent łączy urządzenia i pobiera dane -------------------------------------------------------------
  app.get('/api/me/validic', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    return validicStatus(auth.user.id);
  });
  app.post('/api/me/validic/connect', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    return connectValidic(actorOf(req), auth.user.id, auth.patientRef);
  });
  app.post('/api/me/validic/sync', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    return syncValidic(actorOf(req), auth.user.id, auth.patientRef, 30);
  });

  // --- Docplanner / ZnanyLekarz: konfiguracja i synchronizacja (administrator placówki) -----------------------------
  const admin = (req: Parameters<typeof requireStaff>[0]) => {
    const auth = requireStaff(req, ['admin']);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw badRequest('org_required');
    return { auth, orgId };
  };
  app.get('/api/admin/docplanner', async (req) => {
    const { orgId } = admin(req);
    return { configured: docplannerConfigured(), domain: config.docplanner.domain, mapping: getMapping(orgId) ?? null };
  });
  app.get('/api/admin/docplanner/facilities', async (req) => {
    admin(req);
    return { items: await listFacilities() };
  });
  app.get('/api/admin/docplanner/facilities/:fid/doctors', async (req) => {
    admin(req);
    const { fid } = params(req, z.object({ fid: Id }));
    return { items: await listDoctors(fid) };
  });
  app.get('/api/admin/docplanner/facilities/:fid/doctors/:did/addresses', async (req) => {
    admin(req);
    const { fid, did } = params(req, z.object({ fid: Id, did: Id }));
    return { items: await listAddresses(fid, did) };
  });
  app.get('/api/admin/docplanner/facilities/:fid/doctors/:did/addresses/:aid/services', async (req) => {
    admin(req);
    const { fid, did, aid } = params(req, z.object({ fid: Id, did: Id, aid: Id }));
    return { items: await listAddressServices(fid, did, aid) };
  });
  app.put('/api/admin/docplanner/mapping', async (req) => {
    const { orgId } = admin(req);
    const input = body(
      req,
      z.object({
        facilityId: Id,
        doctors: z.array(z.object({ practitionerId: zId, doctorId: Id, addressId: Id, services: z.array(z.object({ serviceId: zId, addressServiceId: Id })).min(1).max(30) })).min(1).max(50),
      }),
    );
    return setMapping(actorOf(req), orgId, input);
  });
  app.post('/api/admin/docplanner/sync', async (req) => {
    const { orgId } = admin(req);
    const bookings = await pullBookings(actorOf(req), orgId);
    const slots = await pushSlots(actorOf(req), orgId);
    return { bookings, slots };
  });

  // --- Infermedica: bramka regulacyjna (administrator instancji) -----------------------------------------------------
  app.get('/api/admin/infermedica', async (req) => {
    requireStaff(req, ['admin']);
    return { configured: infermedicaConfigured(), regulatory: regulatoryAck() ?? null, baseUrl: config.infermedica.baseUrl };
  });
  app.put('/api/admin/infermedica/regulatory', async (req) => {
    requireStaff(req, ['admin']);
    const input = body(req, z.object({ reference: z.string().min(6).max(300), confirmedBy: z.string().min(5).max(160) }));
    return setRegulatoryAck(actorOf(req), input);
  });
  app.delete('/api/admin/infermedica/regulatory', async (req) => {
    requireStaff(req, ['admin']);
    clearRegulatoryAck(actorOf(req));
    return { ok: true };
  });
  app.post('/api/me/interviews/engine', async (req) => {
    const auth = requirePatient(req);
    const input = body(req, z.object({ text: z.string().min(3).max(2000), sex: z.enum(['male', 'female']).optional(), age: z.number().int().min(1).max(130).optional(), appointmentId: zId.optional() }));
    return startEngineInterview(actorOf(req), auth.patientRef, input);
  });

  // --- przeglądarka 3D badań obrazowych placówki (link uruchamiający, bez osadzania) ----------------------------------
  app.get('/api/staff/patients/:id/imaging-viewer', async (req) => {
    requireClinician(req);
    const { id } = params(req, IdParams);
    if (!config.imagingViewer.url) return { configured: false };
    if (!(await fhir().readOptional('Patient', id))) throw notFound('patient_not_found');
    const patientRef = `Patient/${id}`;
    // w adresie tylko identyfikatory rekordu — bez PESEL i nazwiska (adresy trafiają do dzienników serwerów)
    const url = config.imagingViewer.url.replaceAll('{patientId}', encodeURIComponent(id)).replaceAll('{eternalId}', encodeURIComponent(eternalIdFor(patientRef)));
    audit(actorOf(req), { action: 'R', subtype: 'imaging-viewer-launch', patientRef });
    return { configured: true, url, name: config.imagingViewer.name };
  });
}
