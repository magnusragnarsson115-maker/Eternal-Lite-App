import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { findUserById } from '../auth/users.js';
import { ingestRpm, verifySignature } from '../integrations/rpm.js';
import { handleCallback, syncWithings } from '../integrations/withings.js';
import { params, query } from '../lib/http.js';
import { RateLimiter } from '../lib/ratelimit.js';

const webhookLimiter = new RateLimiter(600, 60_000);

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Powrót z autoryzacji Withings. Nawigacja z zewnętrznej domeny nie niesie ciasteczka SameSite=Strict,
   * dlatego użytkownika identyfikuje wyłącznie jednorazowy parametr state.
   */
  app.get('/api/integrations/withings/callback', async (req, reply) => {
    const q = query(req, z.object({ code: z.string().max(500).optional(), state: z.string().max(200), error: z.string().max(200).optional() }));
    if (q.error || !q.code) return reply.redirect('/pomiary?withings=denied');
    try {
      const userId = await handleCallback(q.code, q.state);
      const user = findUserById(userId);
      if (user?.fhir_ref) {
        audit({ userId, display: user.display_name, actorRef: user.fhir_ref }, { action: 'C', subtype: 'withings-connect', patientRef: user.fhir_ref });
        void syncWithings({ userId, display: user.display_name, actorRef: user.fhir_ref }, userId, user.fhir_ref).catch((err: Error) => req.log.warn({ err }, 'withings initial sync failed'));
      }
      return reply.redirect('/pomiary?withings=connected');
    } catch (err) {
      req.log.warn({ err }, 'withings callback failed');
      return reply.redirect('/pomiary?withings=error');
    }
  });

  app.post('/api/integrations/rpm/:provider/webhook', async (req) => {
    const { provider } = params(req, z.object({ provider: z.string().regex(/^[a-z0-9-]{2,40}$/) }));
    webhookLimiter.check(`rpm:${provider}`);
    verifySignature(provider, req.rawBody ?? '', req.headers['x-eternal-timestamp'] as string | undefined, req.headers['x-eternal-signature'] as string | undefined);
    return ingestRpm(provider, req.body);
  });
}
