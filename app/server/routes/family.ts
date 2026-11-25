import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorOf, requirePatient } from '../auth/sessions.js';
import { config } from '../config.js';
import { body, params, zDate } from '../lib/http.js';
import { requireModule } from '../modules.js';
import { acceptInvite, BASIS_TEXT, caregiverOverview, createDependent, createInvite, deleteDependent, listAccess, listProfiles, PROXY_BASIS_VERSION, revokeLink } from '../services/family.js';

/**
 * Profile rodzinne i dostęp opiekuna (A22.1, A24.1, A24.2, A5.13, A22.6, S4.5, A21.6, A21.11).
 * Trasy działają zawsze na koncie zalogowanej osoby — nagłówek wyboru profilu jest tu pomijany.
 */

const PatientIdParams = z.object({ patientId: z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/) });

export async function familyRoutes(app: FastifyInstance): Promise<void> {
  const owner = (req: FastifyRequest) => {
    const auth = requirePatient(req, { ownOnly: true });
    requireModule('patient-family', { subject: auth.user.id });
    return auth;
  };

  app.get('/api/me/family', async (req) => {
    const auth = owner(req);
    return {
      profiles: await listProfiles(auth.user),
      access: listAccess(auth.user, auth.patientRef),
      basis: { version: PROXY_BASIS_VERSION, text: BASIS_TEXT },
    };
  });

  app.get('/api/me/family/overview', async (req) => {
    const auth = owner(req);
    return { items: await caregiverOverview(actorOf(req), auth.user, config.clinic.timezone) };
  });

  app.get('/api/me/family/:patientId/access', async (req) => {
    const auth = owner(req);
    const { patientId } = params(req, PatientIdParams);
    return { items: listAccess(auth.user, `Patient/${patientId}`) };
  });

  app.post('/api/me/family/dependents', async (req) => {
    const auth = owner(req);
    const input = body(
      req,
      z.object({
        given: z.string().trim().min(1).max(80),
        family: z.string().trim().min(1).max(80),
        birthDate: zDate,
        gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
        pesel: z.string().regex(/^\d{11}$/).optional(),
        relation: z.enum(['parent', 'guardian', 'caregiver']),
        declaration: z.literal(true),
      }),
    );
    return createDependent(actorOf(req), auth.user, input);
  });

  app.delete('/api/me/family/dependents/:patientId', async (req) => {
    const auth = owner(req);
    const { patientId } = params(req, PatientIdParams);
    return { steps: await deleteDependent(actorOf(req), auth.user, `Patient/${patientId}`) };
  });

  app.post('/api/me/family/invites', async (req) => {
    const auth = owner(req);
    const input = body(
      req,
      z.object({
        patientId: PatientIdParams.shape.patientId.optional(),
        relation: z.enum(['parent', 'guardian', 'caregiver', 'family']),
        access: z.enum(['full', 'view']),
        days: z.number().int().min(1).max(365).optional(),
      }),
    );
    const patientRef = input.patientId ? `Patient/${input.patientId}` : auth.patientRef;
    return createInvite(actorOf(req), auth.user, { patientRef, relation: input.relation, access: input.access, days: input.days });
  });

  app.post('/api/me/family/accept', async (req) => {
    const auth = owner(req);
    const { code } = body(req, z.object({ code: z.string().trim().min(10).max(20) }));
    return acceptInvite(actorOf(req), auth.user, code);
  });

  app.delete('/api/me/family/links/:id', async (req) => {
    const auth = owner(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    await revokeLink(actorOf(req), auth.user, id);
    return { ok: true };
  });
}
