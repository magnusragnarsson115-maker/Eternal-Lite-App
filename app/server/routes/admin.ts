import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import { audit, listAudit, verifyAuditChain } from '../audit.js';
import { hashPassword } from '../auth/passwords.js';
import { actorOf, destroyAllSessions, requireStaff } from '../auth/sessions.js';
import { type AppUser, createUser, findUserByEmail, findUserById, isStaff, listUsers, type Role, updateUser } from '../auth/users.js';
import { getDb } from '../db.js';
import { staffOrgId } from '../services/orgs.js';
import { listIntegrations } from '../integrations/registry.js';
import { body, IdParams, params, query, zDate, zId } from '../lib/http.js';
import { sbomFile } from '../lib/sbom.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/util.js';
import {
  getClinicSettings,
  listLocations,
  listPractitioners,
  listQuestionnaires,
  listServices,
  updateClinicSettings,
  upsertPractitioner,
  upsertService,
} from '../services/directory.js';
import { closeAccount } from '../services/privacy.js';
import { applyPackage, listPackages } from '../services/packages.js';
import { feedbackSummary } from '../services/surveys.js';
import { NOTE_TEMPLATE_IDS } from '../scribe/templates.js';

function tempPassword(): string {
  // 16 znaków z alfabetu bez znaków mylących — przekazywane osobiście, wymuszona zmiana przy logowaniu
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
}

function userView(u: ReturnType<typeof findUserById> & object) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    roles: u.roles,
    fhirRef: u.fhir_ref,
    status: u.status,
    mfaEnabled: u.totp_enabled,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    locked: !!u.locked_until && u.locked_until > new Date().toISOString(),
  };
}

const ServiceSchema = z.object({
  name: z.string().max(120),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  mode: z.enum(['in-person', 'tele']),
  price: z.number().min(0).max(100000).optional(),
  program: z.string().max(60).optional(),
  preparation: z.string().max(500).optional(),
  questionnaireId: zId.optional(),
  specialty: z.string().max(80).optional(),
  active: z.boolean().default(true),
  locationIds: z.array(zId).max(10).default([]),
});

const PractitionerSchema = z.object({
  prefix: z.string().max(30).optional(),
  given: z.string().max(80),
  family: z.string().max(80),
  npwz: z.string().max(7).optional().or(z.literal('').transform(() => undefined)),
  specialty: z.string().max(80).optional(),
  serviceIds: z.array(zId).max(50).default([]),
  locationIds: z.array(zId).max(10).default([]),
  active: z.boolean().default(true),
  bio: z.string().max(500).optional(),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const admin = (req: Parameters<typeof requireStaff>[0]) => requireStaff(req, ['admin']);
  /** Administrator zarządza wyłącznie kontami swojej organizacji (K13). */
  const orgUser = (adminUser: AppUser, id: string) => {
    const user = findUserById(id);
    if (!user || (isStaff(user) && staffOrgId(user) !== staffOrgId(adminUser))) throw notFound('user_not_found');
    return user;
  };

  app.get('/api/admin/settings', async (req) => {
    admin(req);
    return getClinicSettings();
  });

  app.put('/api/admin/settings', async (req) => {
    admin(req);
    const patch = body(
      req,
      z.object({
        name: z.string().max(120).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().max(120).optional(),
        address: z.string().max(200).optional(),
        cancelMinHours: z.number().int().min(0).max(168).optional(),
        reminderOffsetsHours: z.array(z.number().min(0.5).max(168)).max(4).optional(),
        emergencyInfo: z.string().max(300).optional(),
        messageResponseDays: z.number().int().min(1).max(14).optional(),
        privacyContact: z.string().max(200).optional(),
        specialties: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
        requiredDocuments: z
          .array(
            z.object({
              id: z.string().regex(/^[a-z0-9-]{1,40}$/),
              label: z.string().trim().min(1).max(160),
              accept: z.array(z.enum(['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other'])).min(1),
              maxAgeDays: z.number().int().min(1).max(3650).optional(),
              specialties: z.array(z.string().max(60)).max(10).optional(),
              optional: z.boolean().optional(),
            }),
          )
          .max(20)
          .optional(),
        noteTemplates: z.array(z.enum(NOTE_TEMPLATE_IDS)).min(1).optional(),
        ehrLayout: z.enum(['generic', 'soap']).optional(),
        scribeMonthlyLimitPerDoctor: z.number().int().min(0).max(5000).optional(),
        inviteValidityDaysAfterVisit: z.number().int().min(1).max(365).optional(),
        recordingRetentionDays: z.number().int().min(0).max(90).optional(),
        autoRemindMissingHours: z.number().int().min(0).max(168).optional(),
        pilot: z
          .object({ baselineWeekStart: zDate.optional(), eternalWeekStart: zDate.optional(), surveyEveryDays: z.number().int().min(7).max(60) })
          .optional(),
      }),
    );
    return updateClinicSettings(actorOf(req), patch);
  });

  // --- użytkownicy ----------------------------------------------------------------------------
  const patientInOrg = (ref: string, adminUser: AppUser) => {
    const row = getDb().prepare('SELECT content FROM fhir_resource WHERE type = ? AND id = ?').get('Patient', ref.split('/')[1] ?? '') as { content: string } | undefined;
    const orgId = staffOrgId(adminUser);
    return !row || !orgId || row.content.includes(`"${orgId}"`);
  };

  app.get('/api/admin/users', async (req) => {
    const auth = admin(req);
    const q = query(req, z.object({ scope: z.enum(['staff', 'deletion']).default('staff') }));
    const users =
      q.scope === 'staff'
        ? listUsers({ staffOnly: true }).filter((u) => staffOrgId(u) === staffOrgId(auth.user))
        : listUsers().filter((u) => u.status === 'deletion-requested' && u.fhir_ref && patientInOrg(u.fhir_ref, auth.user));
    return { items: users.map(userView) };
  });

  app.post('/api/admin/users', async (req) => {
    const auth = admin(req);
    const input = body(
      req,
      z.object({
        email: z.email().max(200),
        displayName: z.string().max(120),
        roles: z.array(z.enum(['practitioner', 'reception', 'admin'])).min(1),
        practitionerId: zId.optional(),
      }),
    );
    if (findUserByEmail(input.email)) throw conflict('email_taken');
    if (input.roles.includes('practitioner') && !input.practitionerId) throw badRequest('practitioner_required');
    if (input.practitionerId) {
      const p = (await listPractitioners(true)).find((x) => x.id === input.practitionerId);
      if (!p) throw notFound('practitioner_not_found');
      if (listUsers().some((u) => u.fhir_ref === `Practitioner/${p.id}`)) throw conflict('practitioner_has_account');
    }
    const password = tempPassword();
    const user = createUser({
      email: input.email,
      passwordHash: await hashPassword(password),
      roles: input.roles as Role[],
      fhirRef: input.practitionerId ? `Practitioner/${input.practitionerId}` : undefined,
      displayName: input.displayName,
      emailVerified: true,
      mustChangePassword: true,
      orgId: staffOrgId(auth.user),
    });
    audit(actorOf(req), { action: 'C', subtype: 'staff-user-create', entityRef: `urn:eternal:user:${user.id}`, detail: { roles: input.roles } });
    return { user: userView(user), temporaryPassword: password };
  });

  app.put('/api/admin/users/:id', async (req) => {
    const auth = admin(req);
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ roles: z.array(z.enum(['practitioner', 'reception', 'admin'])).min(1).optional(), status: z.enum(['active', 'disabled']).optional() }));
    const user = orgUser(auth.user, id);
    if (user.roles.includes('patient')) throw notFound('user_not_found');
    if (id === auth.user.id && (input.status === 'disabled' || (input.roles && !input.roles.includes('admin')))) throw forbidden('cannot_demote_self');
    updateUser(id, { roles: input.roles as Role[] | undefined, status: input.status });
    // odebranie dostępu po odejściu pracownika: sesje, klucze dostępu i linki nagrywania przestają działać od razu
    if (input.status === 'disabled') {
      destroyAllSessions(id);
      getDb().prepare('DELETE FROM webauthn_credential WHERE user_id = ?').run(id);
      getDb().prepare("UPDATE one_time_token SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(new Date().toISOString(), id);
    }
    audit(actorOf(req), { action: 'U', subtype: 'staff-user-update', entityRef: `urn:eternal:user:${id}`, detail: input });
    return userView(findUserById(id)!);
  });

  app.post('/api/admin/users/:id/reset-mfa', async (req) => {
    const auth = admin(req);
    const { id } = params(req, IdParams);
    orgUser(auth.user, id);
    updateUser(id, { totp_enabled: false, totp_secret: null });
    destroyAllSessions(id);
    audit(actorOf(req), { action: 'U', subtype: 'mfa-reset', entityRef: `urn:eternal:user:${id}` });
    return { ok: true };
  });

  app.post('/api/admin/users/:id/reset-password', async (req) => {
    const auth = admin(req);
    const { id } = params(req, IdParams);
    const user = orgUser(auth.user, id);
    if (user.roles.includes('patient')) throw notFound('user_not_found');
    const password = tempPassword();
    updateUser(id, { password_hash: await hashPassword(password), must_change_password: true, failed_logins: 0, locked_until: null });
    destroyAllSessions(id);
    audit(actorOf(req), { action: 'U', subtype: 'staff-password-reset', entityRef: `urn:eternal:user:${id}` });
    return { temporaryPassword: password };
  });

  app.post('/api/admin/users/:id/close', async (req) => {
    const auth = admin(req);
    const { id } = params(req, IdParams);
    const user = findUserById(id);
    if (!user || user.status !== 'deletion-requested' || !user.fhir_ref || !patientInOrg(user.fhir_ref, auth.user)) throw notFound('request_not_found');
    closeAccount(actorOf(req), id);
    return { ok: true };
  });

  // --- katalog -------------------------------------------------------------------------------
  app.get('/api/admin/catalog', async (req) => {
    admin(req);
    const [services, practitioners, locations, questionnaires] = await Promise.all([listServices(true), listPractitioners(true), listLocations(), listQuestionnaires()]);
    return { services, practitioners, locations, questionnaires: questionnaires.map((q) => ({ id: q.id, title: q.title })) };
  });

  app.post('/api/admin/services', async (req) => {
    admin(req);
    return upsertService(actorOf(req), body(req, ServiceSchema));
  });

  app.put('/api/admin/services/:id', async (req) => {
    admin(req);
    const { id } = params(req, IdParams);
    return upsertService(actorOf(req), { ...body(req, ServiceSchema), id });
  });

  app.post('/api/admin/practitioners', async (req) => {
    admin(req);
    return upsertPractitioner(actorOf(req), body(req, PractitionerSchema));
  });

  app.put('/api/admin/practitioners/:id', async (req) => {
    admin(req);
    const { id } = params(req, IdParams);
    return upsertPractitioner(actorOf(req), { ...body(req, PractitionerSchema), id });
  });

  // --- dziennik zdarzeń i integracje ------------------------------------------------------------
  app.get('/api/admin/audit', async (req) => {
    const auth = admin(req);
    const q = query(req, z.object({ patientRef: z.string().max(80).optional(), actorUserId: zId.optional(), before: z.coerce.number().int().optional(), limit: z.coerce.number().int().max(500).optional() }));
    // dziennik organizacji: zdarzenia jej personelu (bez treści klinicznej — tylko kto, co, kiedy)
    const orgUsers = new Set(listUsers({ staffOnly: true }).filter((u) => staffOrgId(u) === staffOrgId(auth.user)).map((u) => u.id));
    if (q.actorUserId && !orgUsers.has(q.actorUserId)) throw notFound('user_not_found');
    const items = listAudit({ ...q, limit: Math.min((q.limit ?? 100) * 3, 500) }).filter((r) => (r.actor_user_id ? orgUsers.has(r.actor_user_id) : !r.patient_ref)).slice(0, q.limit ?? 100);
    audit(actorOf(req), { action: 'R', subtype: 'audit-read', detail: { filter: q } });
    return { items };
  });

  app.get('/api/admin/audit/verify', async (req) => {
    admin(req);
    const result = verifyAuditChain();
    audit(actorOf(req), { action: 'E', subtype: 'audit-verify', outcome: result.ok ? 'success' : 'failure', detail: result });
    return result;
  });

  // M30 — pakiety specjalizacji: podgląd zmian i zastosowanie (tylko dodaje, nie nadpisuje ustawień placówki)
  app.get('/api/admin/packages', async (req) => {
    admin(req);
    return { items: await listPackages() };
  });

  app.post('/api/admin/packages/:id/apply', async (req) => {
    admin(req);
    const { id } = params(req, z.object({ id: z.enum(['interna', 'kardiologia', 'pediatria']) }));
    return applyPackage(actorOf(req), id);
  });

  // A12.3 — ankiety: ocena aplikacji (anonimowa) i liczba wypełnień, bez treści zdrowotnych
  app.get('/api/admin/surveys', async (req) => {
    const auth = admin(req);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw forbidden('no_org');
    return feedbackSummary(orgId);
  });

  // A18.9 — wykaz składników oprogramowania dla administratora placówki i audytora
  app.get('/api/admin/sbom', async (req, reply) => {
    admin(req);
    const file = sbomFile();
    if (!file) throw notFound('sbom_missing');
    audit(actorOf(req), { action: 'R', subtype: 'sbom-download' });
    reply.header('Content-Type', 'application/vnd.cyclonedx+json').header('Content-Disposition', 'attachment; filename="eternal-sbom.cdx.json"');
    return fs.readFileSync(file);
  });

  app.get('/api/admin/integrations', async (req) => {
    admin(req);
    const { health } = query(req, z.object({ health: z.enum(['0', '1']).optional() }));
    return { items: await listIntegrations(health === '1') };
  });
}
