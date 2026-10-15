import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestedProfile, resolveProxy } from './auth/proxy.js';
import { loadSession } from './auth/sessions.js';
import { isStaff } from './auth/users.js';
import { patientOrgIds, staffOrgId } from './services/orgs.js';
import { enterScope, type RequestScope } from './tenancy.js';
import { config } from './config.js';
import { frameSources } from './services/tele.js';
import { FhirConflictError, FhirNotFoundError, FhirValidationError } from './fhir/repository.js';
import { HttpError } from './lib/util.js';
import { reportError, SECURITY_POLICY, securityTxt } from './lib/monitoring.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { familyRoutes } from './routes/family.js';
import { healthRoutes } from './routes/health.js';
import { fhirRoutes } from './routes/fhir.js';
import { integrationRoutes } from './routes/integrations.js';
import { linkRoutes } from './routes/link.js';
import { visitRoutes } from './routes/visit.js';
import { scribeRoutes } from './routes/scribe.js';
import { orgRoutes } from './routes/org.js';
import { accountRoutes } from './routes/account.js';
import { meRoutes } from './routes/me.js';
import { patientRoutes } from './routes/patient.js';
import { publicRoutes } from './routes/public.js';
import { staffRoutes } from './routes/staff.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function webDistDir(): string | undefined {
  const candidates = [path.resolve(here, '../dist/web'), path.resolve(here, '../web')];
  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'assets')));
}

const CSRF_EXEMPT = [/^\/api\/integrations\/rpm\/[^/]+\/webhook$/];

function securityHeaders(reply: FastifyReply): void {
  const frames = frameSources().join(' ');
  const jitsi = frames;
  reply.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      `frame-src ${jitsi}`,
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  const allow = frameSources().map((f) => `"${f}"`).join(' ');
  reply.header('Permissions-Policy', `camera=(self ${allow}), microphone=(self ${allow}), display-capture=(self ${allow}), geolocation=(self), payment=()`);
  if (config.isProduction) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function sameOrigin(req: FastifyRequest): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.origin;
  if (!origin) return true; // klienci nieprzeglądarkowi (bez ciasteczek sesji nie uzyskają dostępu)
  try {
    const o = new URL(origin);
    const pub = new URL(config.publicUrl);
    return o.host === pub.host || o.host === req.headers.host;
  } catch {
    return false;
  }
}

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger
      ? {
          level: config.isProduction ? 'info' : 'debug',
          redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]'],
        }
      : false,
    trustProxy: config.trustProxy,
    bodyLimit: 5 * 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 10 } });

  for (const type of ['application/json', 'application/fhir+json']) {
    app.removeContentTypeParser(type);
    app.addContentTypeParser(type, { parseAs: 'string' }, (req, raw, done) => {
      const text = String(raw);
      req.rawBody = text;
      if (!text) return done(null, {});
      try {
        done(null, JSON.parse(text));
      } catch {
        done(new HttpError(400, 'invalid_json'), undefined);
      }
    });
  }

  app.addHook('onRequest', async (req) => {
    req.auth = loadSession(req);
    if (req.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const pathOnly = req.url.split('?')[0];
      if (CSRF_EXEMPT.some((re) => re.test(pathOnly))) return;
      if (!sameOrigin(req)) throw new HttpError(403, 'cross_origin_rejected');
      if (req.auth && !req.auth.bearer && req.headers['x-csrf-token'] !== req.auth.csrfToken) throw new HttpError(403, 'csrf_token_invalid');
    }
  });

  // Kontekst organizacji dla repozytorium FHIR i szyny zdarzeń (tenancy.ts); als.run w haku callbackowym
  // propaguje kontekst do handlera.
  app.addHook('onRequest', (req, _reply, done) => {
    const u = req.auth?.user;
    const resolve = async (): Promise<RequestScope> => {
      if (u && isStaff(u)) return { orgId: staffOrgId(u) };
      if (u?.fhir_ref?.startsWith('Patient/')) {
        // profil wybrany przez opiekuna — tylko przy aktywnym powiązaniu (auth/proxy.ts)
        const profile = requestedProfile(req);
        const ref = profile && profile !== u.fhir_ref && resolveProxy(u.id, profile) ? profile : u.fhir_ref;
        return { patientRef: ref, patientOrgIds: await patientOrgIds(ref) };
      }
      return {};
    };
    resolve().then(
      (scope) => enterScope(scope, done),
      (err: Error) => done(err),
    );
  });

  app.addHook('onSend', async (req, reply) => {
    securityHeaders(reply);
    if (req.url.startsWith('/api/') || req.url.startsWith('/fhir/')) reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) {
      if (err.status === 429) reply.header('Retry-After', String((err.details as { retryAfter?: number })?.retryAfter ?? 60));
      return reply.status(err.status).send({ error: err.code, message: err.message, details: err.details });
    }
    if (err instanceof FhirNotFoundError) return reply.status(404).send({ error: 'not_found' });
    if (err instanceof FhirConflictError) return reply.status(409).send({ error: 'version_conflict' });
    if (err instanceof FhirValidationError) return reply.status(422).send({ error: 'fhir_validation_failed', message: err.message, details: err.issues });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.code ?? 'bad_request', message: err.message });
    req.log.error({ err }, 'unhandled error');
    reportError(err, { route: req.routeOptions?.url, method: req.method });
    return reply.status(500).send({ error: 'internal_error' });
  });

  app.get('/api/health', async () => ({ status: 'ok', time: new Date().toISOString() }));
  // zgłaszanie podatności (A18.9, RFC 9116)
  app.get('/.well-known/security.txt', async (_req, reply) => {
    const txt = securityTxt();
    if (!txt) return reply.status(404).send({ error: 'not_found' });
    return reply.type('text/plain; charset=utf-8').header('Cache-Control', 'max-age=86400').send(txt);
  });
  app.get('/security-policy.txt', async (_req, reply) => reply.type('text/plain; charset=utf-8').send(SECURITY_POLICY));

  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(eventRoutes);
  await app.register(patientRoutes);
  await app.register(familyRoutes);
  await app.register(healthRoutes);
  await app.register(staffRoutes);
  await app.register(adminRoutes);
  await app.register(fhirRoutes);
  await app.register(integrationRoutes);
  await app.register(linkRoutes);
  await app.register(visitRoutes);
  await app.register(scribeRoutes);
  await app.register(orgRoutes);
  await app.register(accountRoutes);
  await app.register(meRoutes);

  const dist = webDistDir();
  if (dist) {
    // wildcard: pliki sprawdzane przy każdym żądaniu — nowy build nie wymaga restartu; hashowane zasoby cache'owane długo
    await app.register(fastifyStatic, {
      root: dist,
      prefix: '/',
      wildcard: true,
      index: ['index.html'],
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.header('Cache-Control', 'public, max-age=31536000, immutable');
        else res.header('Cache-Control', 'no-cache');
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/fhir/') || req.url.startsWith('/assets/') || !['GET', 'HEAD'].includes(req.method)) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.type('text/html').send(fs.readFileSync(path.join(dist, 'index.html')));
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'not_found' }));
  }

  return app;
}
