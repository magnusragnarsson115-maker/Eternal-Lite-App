import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../audit.js';
import { findUserByFhirRef, issueToken } from '../auth/users.js';
import { AI_NOTICE, LINK_CONSENT_TEXT, PURPOSE_TEXT, renderText } from '../content/texts.js';
import { body, params } from '../lib/http.js';
import { formatLocal } from '../lib/time.js';
import { badRequest, conflict, forbidden, HttpError } from '../lib/util.js';
import { config } from '../config.js';
import { requireModule } from '../modules.js';
import { getGrantRow } from '../services/grants.js';
import { getIntake, intakeFile, listIntake, reviewIntake, submitIntake, toIntakeView, uploadIntake, type IntakeContext } from '../services/intake.js';
import { acceptIntakeConsent, linkActor, linkContext, resolveLink, withdrawViaLink, type InviteRow } from '../services/invites.js';
import { accessLogForPatient } from '../services/privacy.js';
import { runInScope } from '../tenancy.js';

/**
 * Strona pacjenta pod linkiem z SMS (D1/DOC-07, P2, P3): bez konta i bez instalowania.
 * Każde wywołanie rozwiązuje token na nowo (odwołanie i wygaśnięcie działają natychmiast).
 */

const TokenParams = z.object({ token: z.string().min(20).max(80) });
const MAX_FILES_PER_LINK = 40;

function lang(req: FastifyRequest): 'pl' | 'en' {
  const q = (req.query as { lang?: string } | undefined)?.lang;
  if (q === 'en' || q === 'pl') return q;
  return (req.headers['accept-language'] ?? '').toLowerCase().startsWith('pl') ? 'pl' : (req.headers['accept-language'] ? 'en' : 'pl');
}

function intakeCtx(req: FastifyRequest, row: InviteRow): IntakeContext {
  return {
    actor: linkActor(req, row),
    patientRef: row.patient_ref,
    orgId: row.org_id,
    inviteId: row.id,
    appointmentId: row.appointment_id ?? undefined,
    source: 'invite',
    confirmer: 'patient',
  };
}

function requireActiveGrant(row: InviteRow): void {
  const g = row.grant_id ? getGrantRow(row.grant_id) : undefined;
  if (!g || g.status !== 'active') throw forbidden('consent_required');
}

/** Rozwiązanie tokenu w zakresie organizacji, która zaprosiła (zdarzenia trafiają do jej personelu). */
async function withLink<T>(req: FastifyRequest, fn: (row: InviteRow) => Promise<T>): Promise<T> {
  const { token } = params(req, TokenParams);
  const row = resolveLink(token, ['intake']);
  requireModule('invite', { orgId: row.org_id });
  return runInScope({ patientRef: row.patient_ref, patientOrgIds: [row.org_id] }, () => fn(row));
}

export async function linkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/link/:token', async (req) =>
    withLink(req, async (row) => {
      const ctx = await linkContext(row);
      const l = lang(req);
      const until = formatLocal(row.expires_at, config.clinic.timezone, l === 'pl' ? 'pl-PL' : 'en-GB');
      audit(linkActor(req, row), { action: 'R', subtype: 'link-open', patientRef: row.patient_ref, detail: { invite: row.id } });
      return {
        ...ctx,
        texts: {
          purpose: renderText(PURPOSE_TEXT, l),
          consent: renderText(LINK_CONSENT_TEXT, l, { clinic: ctx.clinic.name, until }),
          ai: renderText(AI_NOTICE, l),
        },
        items: listIntake({ inviteId: row.id }).map((r) => toIntakeView(r, false)),
        limits: { maxFiles: MAX_FILES_PER_LINK, maxSizeMb: 15, types: ['application/pdf', 'image/jpeg', 'image/png'] },
      };
    }),
  );

  app.post('/api/link/:token/consent', async (req) =>
    withLink(req, async (row) => {
      const input = body(req, z.object({ accept: z.literal(true), textVersion: z.string().max(60) }));
      if (input.textVersion !== LINK_CONSENT_TEXT.version) throw conflict('consent_text_changed');
      const grant = await acceptIntakeConsent(linkActor(req, row), row);
      return { grant };
    }),
  );

  app.post('/api/link/:token/withdraw', async (req) =>
    withLink(req, async (row) => {
      await withdrawViaLink(linkActor(req, row), row);
      return { ok: true };
    }),
  );

  app.post('/api/link/:token/upload', async (req) =>
    withLink(req, async (row) => {
      requireActiveGrant(row);
      if (listIntake({ inviteId: row.id }).length >= MAX_FILES_PER_LINK) throw new HttpError(429, 'too_many_files');
      const file = await req.file();
      if (!file) throw badRequest('file_required');
      const data = await file.toBuffer();
      if (file.file.truncated) throw badRequest('file_too_large');
      const hintField = file.fields.kind as { value?: string } | undefined;
      const hint = z.enum(['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other']).optional().parse(hintField?.value || undefined);
      return uploadIntake(intakeCtx(req, row), { data, filename: file.filename, contentType: file.mimetype }, hint);
    }),
  );

  app.get('/api/link/:token/intake/:id', async (req) =>
    withLink(req, async (row) => {
      const { id } = params(req, TokenParams.extend({ id: z.string().uuid() }));
      const item = getIntake(id, { patientRef: row.patient_ref });
      if (item.invite_id !== row.id) throw new HttpError(404, 'intake_not_found');
      return toIntakeView(item, true);
    }),
  );

  app.post('/api/link/:token/intake/:id/review', async (req) =>
    withLink(req, async (row) => {
      requireActiveGrant(row);
      const { id } = params(req, TokenParams.extend({ id: z.string().uuid() }));
      const item = getIntake(id, { patientRef: row.patient_ref });
      if (item.invite_id !== row.id) throw new HttpError(404, 'intake_not_found');
      const input = body(req, ReviewSchema);
      return reviewIntake(intakeCtx(req, row), id, input);
    }),
  );

  app.post('/api/link/:token/intake/:id/submit', async (req) =>
    withLink(req, async (row) => {
      requireActiveGrant(row);
      const { id } = params(req, TokenParams.extend({ id: z.string().uuid() }));
      const item = getIntake(id, { patientRef: row.patient_ref });
      if (item.invite_id !== row.id) throw new HttpError(404, 'intake_not_found');
      return submitIntake(intakeCtx(req, row), id);
    }),
  );

  app.get('/api/link/:token/intake/:id/file', async (req, reply) =>
    withLink(req, async (row) => {
      const { id } = params(req, TokenParams.extend({ id: z.string().uuid() }));
      const item = getIntake(id, { patientRef: row.patient_ref });
      if (item.invite_id !== row.id) throw new HttpError(404, 'intake_not_found');
      const f = await intakeFile(item);
      reply.header('Content-Type', f.contentType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
      return f.data;
    }),
  );

  /**
   * „Załóż konto i przejmij dane” (D1, MVP-1): kod aktywacyjny dla kartoteki z linku. Rejestracja wymaga dodatkowo
   * daty urodzenia zgodnej z kartoteką — sam link nie wystarcza do założenia konta.
   */
  app.post('/api/link/:token/takeover', async (req) =>
    withLink(req, async (row) => {
      if (findUserByFhirRef(row.patient_ref)) throw conflict('account_exists');
      const code = issueToken('patient-activation', { payload: { patientRef: row.patient_ref }, ttlMinutes: 30, code: 'activation' });
      audit(linkActor(req, row), { action: 'C', subtype: 'link-takeover-code', patientRef: row.patient_ref, detail: { invite: row.id } });
      return { activationCode: code, expiresInMinutes: 30 };
    }),
  );

  /** „Kto oglądał moje dane” pod tym samym linkiem — odczyty personelu od utworzenia linku. */
  app.get('/api/link/:token/access-log', async (req) =>
    withLink(req, async (row) => ({ items: accessLogForPatient(row.patient_ref, { staffOnly: true, since: row.created_at }) })),
  );
}

export const ReviewSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(80),
        action: z.enum(['confirm', 'correct', 'reject']),
        name: z.string().max(120).optional(),
        value: z.string().max(40).optional(),
        unit: z.string().max(30).optional(),
        rangeText: z.string().max(60).optional(),
      }),
    )
    .max(200)
    .optional(),
  collectedAt: z.string().max(20).optional(),
  laboratory: z.string().max(120).optional(),
});
