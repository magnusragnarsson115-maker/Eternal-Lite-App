import type { Organization } from '@medplum/fhirtypes';
import { readiness } from '../services/readiness.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { aiCallStats, aiMode } from '../ai/gateway.js';
import { ocrConfigured } from '../ai/ocr.js';
import { PROMPTS } from '../ai/prompts.js';
import { sttMode } from '../ai/stt.js';
import { hashPassword, passwordProblems } from '../auth/passwords.js';
import { actorOf, createSession, requirePatient, requireStaff, requireUser } from '../auth/sessions.js';
import { consumeToken, createUser, findUserByEmail, isStaff, issueToken, peekToken, type Role } from '../auth/users.js';
import { config } from '../config.js';
import { AI_NOTICE, APP_INSTRUCTIONS, CRISIS_NUMBERS, PURPOSE_TEXT, renderText } from '../content/texts.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { emailConfigured, sendEmail } from '../integrations/channels.js';
import { DICTIONARY_VERSION } from '../labs/dictionary.js';
import { body, params, query, zId } from '../lib/http.js';
import { badRequest, conflict, forbidden, notFound, nowIso, sha256 } from '../lib/util.js';
import { listModules, moduleDef, setModuleFlag } from '../modules.js';
import { renderPdf } from '../pdf/render.js';
import { NOTE_TEMPLATES } from '../scribe/templates.js';
import { getClinicSettings, listPractitioners } from '../services/directory.js';
import { FACTS_TEMPLATE_VERSION } from '../services/facts.js';
import { listIncidents, reportIncident, updateIncident } from '../services/incidents.js';
import {
  billingSettings,
  dashboardHtml,
  logDocTime,
  monthRange,
  pilotDashboard,
  setBillingSettings,
  submitSurvey,
  SURVEY_QUESTIONS,
  surveyDue,
  usageCsv,
  usageForMonth,
} from '../services/metrics.js';
import { staffOrgId, toOrgView } from '../services/orgs.js';
import { CARD_TEMPLATE_VERSION } from '../services/scribe.js';

/**
 * Organizacja kliniki (D0): przełączniki modułów (R10/A18.7), licznik użycia i eksport do faktury (R9),
 * zgłoszenia incydentów (A18.4), rejestr zastosowań AI (A19.6), zaproszenia personelu; mierniki pilotażu (D12);
 * teksty przeznaczenia i instrukcji (A18.1, A18.3) i numery kryzysowe (F8.1, F8.4).
 */

const MonthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
const thisMonth = () => new Date().toISOString().slice(0, 7);

const IncidentInput = z.object({
  category: z.enum(['data-error', 'ai-content', 'privacy', 'security', 'availability', 'other']),
  description: z.string().min(10).max(4000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  contact: z.string().max(200).optional(),
});

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  const admin = (req: Parameters<typeof requireStaff>[0]) => {
    const auth = requireStaff(req, ['admin']);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw forbidden('no_organization');
    return { auth, orgId };
  };

  // --- moduły -----------------------------------------------------------------------------------
  app.get('/api/modules', async (req) => {
    const auth = requireUser(req);
    const orgId = isStaff(auth.user) ? staffOrgId(auth.user) : undefined;
    return { items: listModules(orgId, auth.user.id).map((m) => ({ id: m.id, code: m.code, area: m.area, active: m.active })) };
  });

  app.get('/api/admin/modules', async (req) => {
    const { orgId } = admin(req);
    return { items: listModules(orgId) };
  });

  app.put('/api/admin/modules/:id', async (req) => {
    const { orgId } = admin(req);
    const { id } = params(req, z.object({ id: z.string().max(40) }));
    const { enabled } = body(req, z.object({ enabled: z.boolean() }));
    if (moduleDef(id).scope !== 'org') throw forbidden('module_managed_by_operator');
    setModuleFlag(actorOf(req), id, { enabled }, orgId);
    return { items: listModules(orgId) };
  });

  // --- organizacja, licznik użycia, faktura ------------------------------------------------------------
  app.get('/api/admin/org', async (req) => {
    const { orgId } = admin(req);
    const org = await fhirSystem().read<Organization>('Organization', orgId);
    return { org: toOrgView(org), billing: billingSettings(orgId) };
  });

  app.get('/api/admin/usage', async (req) => {
    const { orgId } = admin(req);
    const q = query(req, MonthQuery);
    const month = q.month ?? thisMonth();
    const { from, to } = monthRange(month);
    return { ...usageForMonth(orgId, month), scribePerDoctor: pilotDashboard(orgId, from, to).scribeUsage };
  });

  app.get('/api/admin/usage.csv', async (req, reply) => {
    const { orgId } = admin(req);
    const q = query(req, MonthQuery);
    const month = q.month ?? thisMonth();
    const org = toOrgView(await fhirSystem().read<Organization>('Organization', orgId));
    audit(actorOf(req), { action: 'E', subtype: 'usage-export', detail: { month } });
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="eternal-uzycie-${month}.csv"`);
    return usageCsv(orgId, month, { name: org.name, nip: org.nip });
  });

  app.put('/api/admin/billing', async (req) => {
    const { orgId } = admin(req);
    const input = body(req, z.object({ pricePerDoctorNet: z.number().min(0).max(100000).optional(), videoMinutePriceNet: z.number().min(0).max(1000).optional() }));
    return setBillingSettings(orgId, actorOf(req), input);
  });

  // --- incydenty ---------------------------------------------------------------------------------
  app.post('/api/incidents', async (req) => {
    const auth = requireUser(req);
    const input = body(req, IncidentInput);
    const staff = isStaff(auth.user);
    return reportIncident(actorOf(req), { ...input, orgId: staff ? staffOrgId(auth.user) : undefined, reporterKind: staff ? 'staff' : 'patient', severity: staff ? input.severity : undefined });
  });

  app.get('/api/admin/incidents', async (req) => {
    const { orgId } = admin(req);
    const q = query(req, z.object({ open: z.enum(['0', '1']).optional() }));
    return { items: listIncidents(orgId, { open: q.open === '1' }) };
  });

  app.put('/api/admin/incidents/:id', async (req) => {
    const { orgId } = admin(req);
    const { id } = params(req, z.object({ id: z.string().uuid() }));
    const patch = body(
      req,
      z.object({
        status: z.enum(['new', 'triage', 'in-progress', 'resolved', 'closed']).optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        resolution: z.string().max(2000).optional(),
        escalatedTo: z.string().max(200).optional(),
      }),
    );
    return updateIncident(actorOf(req), orgId, id, patch);
  });

  // --- rejestr zastosowań AI (A19.6) ---------------------------------------------------------------------
  app.get('/api/admin/ai-registry', async (req) => {
    const { orgId } = admin(req);
    const q = query(req, z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }));
    return {
      mode: aiMode(),
      providers: {
        model: config.ai.provider,
        region: config.ai.provider === 'bedrock' ? config.ai.awsRegion : undefined,
        modelNote: aiMode() === 'model' ? config.ai.modelNote : undefined,
        modelFast: aiMode() === 'model' ? config.ai.modelFast : undefined,
        secondary: config.ai.secondary || undefined,
        stt: sttMode() === 'service' ? config.stt.provider : sttMode(),
        ocr: ocrConfigured() ? config.ocr.provider : 'pdf-text',
      },
      tasks: Object.entries(PROMPTS).map(([task, p]) => ({ task, promptVersion: p.version })),
      templates: [
        ...NOTE_TEMPLATES.map((t) => ({ id: t.id, version: t.version, kind: 'note' })),
        { id: 'facts', version: FACTS_TEMPLATE_VERSION, kind: 'report' },
        { id: 'card', version: CARD_TEMPLATE_VERSION, kind: 'card' },
      ],
      dictionaryVersion: DICTIONARY_VERSION,
      dailyLimit: config.ai.dailyCallLimitPerOrg,
      calls: aiCallStats(orgId, q.days),
    };
  });

  // --- zaproszenia personelu (D0) --------------------------------------------------------------------
  app.post('/api/admin/staff-invites', async (req) => {
    const { auth, orgId } = admin(req);
    const input = body(
      req,
      z.object({ email: z.email().max(200), displayName: z.string().min(2).max(120), roles: z.array(z.enum(['practitioner', 'reception', 'admin'])).min(1), practitionerId: zId.optional() }),
    );
    if (findUserByEmail(input.email)) throw conflict('email_taken');
    if (input.roles.includes('practitioner') && !input.practitionerId) throw badRequest('practitioner_required');
    if (input.practitionerId && !(await listPractitioners(true)).some((p) => p.id === input.practitionerId)) throw notFound('practitioner_not_found');
    const token = issueToken('staff-invite', { userId: auth.user.id, payload: { ...input, email: input.email.toLowerCase(), orgId }, ttlMinutes: 7 * 24 * 60 });
    const url = `${config.publicUrl}/panel/zaproszenie/${token}`;
    const clinic = getClinicSettings(orgId).name;
    let emailed = false;
    if (emailConfigured()) {
      await sendEmail(input.email, `Zaproszenie do panelu Eternal — ${clinic}`, `${auth.user.display_name} zaprasza Cię do panelu ${clinic} w Eternal.\n\nUstaw hasło i drugi składnik logowania: ${url}\n\nLink jest ważny 7 dni.`);
      emailed = true;
    }
    audit(actorOf(req), { action: 'C', subtype: 'staff-invite', detail: { roles: input.roles, emailed } });
    // bez skonfigurowanej poczty link przekazuje administrator (osobiście albo bezpiecznym kanałem)
    return { emailed, url: emailed ? undefined : url, expiresInDays: 7 };
  });

  app.get('/api/admin/staff-invites', async (req) => {
    const { orgId } = admin(req);
    const rows = getDb().prepare("SELECT token_hash, payload, expires_at, created_at FROM one_time_token WHERE purpose = 'staff-invite' AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC").all(nowIso()) as {
      token_hash: string;
      payload: string;
      expires_at: string;
      created_at: string;
    }[];
    return {
      items: rows
        .map((r) => ({ id: r.token_hash.slice(0, 16), ...(JSON.parse(r.payload) as { email: string; displayName: string; roles: string[]; orgId: string }), expiresAt: r.expires_at, createdAt: r.created_at }))
        .filter((r) => r.orgId === orgId)
        .map(({ orgId: _o, ...r }) => r),
    };
  });

  app.delete('/api/admin/staff-invites/:id', async (req) => {
    const { orgId } = admin(req);
    const { id } = params(req, z.object({ id: z.string().regex(/^[a-f0-9]{16}$/) }));
    const row = getDb().prepare("SELECT token_hash, payload FROM one_time_token WHERE purpose = 'staff-invite' AND substr(token_hash, 1, 16) = ? AND used_at IS NULL").get(id) as { token_hash: string; payload: string } | undefined;
    if (!row || (JSON.parse(row.payload) as { orgId: string }).orgId !== orgId) throw notFound('invite_not_found');
    getDb().prepare('UPDATE one_time_token SET used_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
    audit(actorOf(req), { action: 'D', subtype: 'staff-invite-revoke' });
    return { ok: true };
  });

  app.get('/api/auth/staff-invite/:token', async (req) => {
    const { token } = params(req, z.object({ token: z.string().min(20).max(80) }));
    const t = peekToken<{ email: string; displayName: string; roles: string[]; orgId: string }>('staff-invite', token);
    if (!t) throw notFound('invite_invalid');
    return { email: t.payload.email, displayName: t.payload.displayName, roles: t.payload.roles, clinic: getClinicSettings(t.payload.orgId).name, passwordMinLength: Math.max(12, config.security.minPasswordLength) };
  });

  app.post('/api/auth/staff-invite/accept', async (req, reply) => {
    const input = body(req, z.object({ token: z.string().min(20).max(80), password: z.string().max(256) }));
    const peek = peekToken<{ email: string; displayName: string; roles: Role[]; orgId: string; practitionerId?: string }>('staff-invite', input.token);
    if (!peek) throw notFound('invite_invalid');
    const problems = passwordProblems(input.password, Math.max(12, config.security.minPasswordLength), [peek.payload.email.split('@')[0]]);
    if (problems.length) throw badRequest('weak_password', problems.join(', '));
    const t = consumeToken<typeof peek.payload>('staff-invite', input.token);
    if (!t) throw notFound('invite_invalid');
    if (findUserByEmail(t.payload.email)) throw conflict('email_taken');
    const user = createUser({
      email: t.payload.email,
      passwordHash: await hashPassword(input.password),
      roles: t.payload.roles,
      fhirRef: t.payload.practitionerId ? `Practitioner/${t.payload.practitionerId}` : undefined,
      displayName: t.payload.displayName,
      emailVerified: true,
      orgId: t.payload.orgId,
    });
    audit({ ...actorOf(req), userId: user.id, display: user.display_name, roles: user.roles }, { action: 'C', subtype: 'staff-invite-accept', entityRef: `urn:eternal:user:${user.id}`, detail: { invite: sha256(input.token).slice(0, 16) } });
    // sesja bez drugiego składnika — panel wymusi skonfigurowanie TOTP przed dostępem do danych
    createSession(reply, req, user, false);
    return { ok: true, next: '/panel/mfa' };
  });

  // --- mierniki pilotażu (D12) -------------------------------------------------------------------------
  const metricsAccess = (req: Parameters<typeof requireStaff>[0]) => {
    const auth = requireStaff(req, ['practitioner', 'admin']);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw forbidden('no_organization');
    return { auth, orgId };
  };

  app.get('/api/staff/metrics', async (req) => {
    const { orgId } = metricsAccess(req);
    const q = query(req, MonthQuery);
    const month = q.month ?? thisMonth();
    const { from, to } = monthRange(month);
    return { month, settings: getClinicSettings(orgId).pilot, ...pilotDashboard(orgId, from, to) };
  });

  app.get('/api/staff/metrics.pdf', async (req, reply) => {
    const { orgId } = metricsAccess(req);
    const q = query(req, MonthQuery);
    const month = q.month ?? thisMonth();
    const { from, to } = monthRange(month);
    const clinic = getClinicSettings(orgId).name;
    const pdf = await renderPdf(dashboardHtml(pilotDashboard(orgId, from, to), clinic, month), { footerLeft: `Raport pilotażu · ${clinic} · ${month}` });
    audit(actorOf(req), { action: 'E', subtype: 'metrics-pdf', detail: { month } });
    reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="raport-pilotazu-${month}.pdf"`);
    return pdf;
  });

  app.post('/api/staff/metrics/doc-time', async (req) => {
    const { auth, orgId } = metricsAccess(req);
    const input = body(req, z.object({ minutes: z.number().min(0.5).max(180), phase: z.enum(['baseline', 'eternal']), appointmentId: zId.optional() }));
    logDocTime(orgId, actorOf(req), auth.user.id, input);
    return { ok: true };
  });

  app.get('/api/staff/survey', async (req) => {
    const { auth, orgId } = metricsAccess(req);
    return { due: auth.user.roles.includes('practitioner') && surveyDue(orgId, auth.user.id), questions: SURVEY_QUESTIONS };
  });

  app.post('/api/staff/survey', async (req) => {
    const { auth, orgId } = metricsAccess(req);
    const input = body(req, z.object({ q1: z.number().int().min(1).max(5), q2: z.number().int().min(1).max(5), q3: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }));
    submitSurvey(orgId, actorOf(req), auth.user.id, input);
    return { ok: true };
  });

  // --- teksty: przeznaczenie, instrukcja (wersjonowane), informacja o AI, numery kryzysowe -----------------
  // gotowość do pracy: co działa naprawdę, co w trybie demo, co ustawić (bez wartości sekretów)
  app.get('/api/admin/readiness', async (req) => {
    const auth = requireStaff(req, ['admin']);
    const { live } = query(req, z.object({ live: z.enum(['0', '1']).optional() }));
    audit(actorOf(req), { action: 'R', subtype: 'readiness-check', detail: { live: live === '1', user: auth.user.id } });
    return readiness({ live: live === '1' });
  });

  // kontrolowana dystrybucja aktualizacji aplikacji mobilnej (A18.7); aktualizacje JS — kanały EAS Update z wdrożeniem procentowym
  app.get('/api/public/app-version', async () => ({
    minimum: config.mobile.minVersion,
    latest: config.mobile.latestVersion,
    storeUrl: { ios: config.mobile.iosStoreUrl || undefined, android: config.mobile.androidStoreUrl || undefined },
  }));

  app.get('/api/public/texts', async (req) => {
    const q = query(req, z.object({ lang: z.enum(['pl', 'en']).default('pl') }));
    return {
      purpose: renderText(PURPOSE_TEXT, q.lang),
      instructions: renderText(APP_INSTRUCTIONS, q.lang),
      ai: renderText(AI_NOTICE, q.lang),
      crisis: CRISIS_NUMBERS.map((c) => ({ number: c.number, label: q.lang === 'pl' ? c.pl : c.en, hours: c.hours })),
      securityContact: config.security.contact || undefined,
      version: { app: process.env.npm_package_version ?? '1.0.0' },
    };
  });

  // zgłoszenie problemu przez pacjenta z aplikacji (MVP — formularz; pełna obsługa zgłoszeń B2C w MVP-2)
  app.post('/api/me/incidents', async (req) => {
    requirePatient(req);
    const input = body(req, IncidentInput.omit({ severity: true }));
    return reportIncident(actorOf(req), { ...input, reporterKind: 'patient' });
  });
}
