import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getVapidKeys } from '../integrations/channels.js';
import { getClinicSettings } from '../services/directory.js';
import { CONSENT_TYPES } from '../fhir/constants.js';
import { CONSENT_POLICY_VERSION } from '../services/consents.js';
import { explanationsView } from '../labs/explanations.js';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // objaśnienia badań ze słownika (A2.4) — treść ogólna, bez danych pacjenta
  app.get('/api/public/explanations', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return explanationsView();
  });

  app.get('/api/public/config', async () => {
    const s = getClinicSettings();
    return {
      demoMode: config.demoMode,
      clinic: {
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        emergencyInfo: s.emergencyInfo,
        cancelMinHours: s.cancelMinHours,
        messageResponseDays: s.messageResponseDays,
        privacyContact: s.privacyContact,
      },
      vapidPublicKey: getVapidKeys().publicKey,
      consents: Object.entries(CONSENT_TYPES).map(([type, def]) => ({ type, required: def.required, label: { pl: def.pl, en: def.en } })),
      consentPolicyVersion: CONSENT_POLICY_VERSION,
      passwordMinLength: config.security.minPasswordLength,
      fhirBackend: config.fhir.backend,
      jitsiDomain: config.jitsi.domain,
      timezone: config.clinic.timezone,
    };
  });
}
