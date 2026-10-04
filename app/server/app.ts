import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSession } from './auth/sessions.js';
import { config } from './config.js';
import { FhirConflictError, FhirNotFoundError, FhirValidationError } from './fhir/repository.js';
import { HttpError } from './lib/util.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { fhirRoutes } from './routes/fhir.js';
import { integrationRoutes } from './routes/integrations.js';
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
  const jitsi = `https://${config.jitsi.domain}`;
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
  reply.header('Permissions-Policy', `camera=(self "${jitsi}"), microphone=(self "${jitsi}"), display-capture=(self "${jitsi}"), geolocation=(), payment=()`);
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
      if (req.auth && req.headers['x-csrf-token'] !== req.auth.csrfToken) throw new HttpError(403, 'csrf_token_invalid');
    }
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
    return reply.status(500).send({ error: 'internal_error' });
  });

  app.get('/api/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(eventRoutes);
  await app.register(patientRoutes);
  await app.register(staffRoutes);
  await app.register(adminRoutes);
  await app.register(fhirRoutes);
  await app.register(integrationRoutes);

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
