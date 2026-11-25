import type { FastifyInstance } from 'fastify';
import { totpCode } from '../../server/auth/totp.js';

export const ORIGIN = 'http://localhost:3000';

/** Klient HTTP testów: ciasteczko sesji, token CSRF, nagłówek Origin. */
export class Client {
  cookie = '';
  csrf = '';
  constructor(private app: FastifyInstance) {}
  async req(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, opts: { csrf?: boolean; origin?: string; headers?: Record<string, string> } = {}) {
    const res = await this.app.inject({
      method,
      url,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(opts.csrf !== false && this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        origin: opts.origin ?? ORIGIN,
        host: 'localhost:3000',
        ...opts.headers,
      },
    });
    return this.handle(res);
  }
  async upload(url: string, payload: Buffer, contentType: string) {
    const res = await this.app.inject({
      method: 'POST',
      url,
      payload,
      headers: { 'content-type': contentType, ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}), origin: ORIGIN, host: 'localhost:3000' },
    });
    return this.handle(res);
  }
  private handle(res: Awaited<ReturnType<FastifyInstance['inject']>>) {
    const set = res.headers['set-cookie'];
    if (set) this.cookie = (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ');
    const json = res.headers['content-type']?.includes('json') ? res.json() : undefined;
    if (json?.csrfToken) this.csrf = json.csrfToken;
    return { status: res.statusCode, json, headers: res.headers, body: res.body, raw: res.rawPayload };
  }
  /** Logowanie personelu z drugim składnikiem. */
  async loginStaff(email: string, password: string, secret: string) {
    const r = await this.req('POST', '/api/auth/login', { email, password });
    if (r.json?.mfa?.required) return this.req('POST', '/api/auth/mfa/verify', { code: totpCode(secret) });
    return r;
  }
}

export async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 5000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v !== undefined) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 50));
  }
}
