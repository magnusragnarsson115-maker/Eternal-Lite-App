import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';
import { fetchWithTimeout, HttpError } from '../lib/util.js';
import { consumeToken, issueToken } from './users.js';

/**
 * Logowanie zewnętrzną usługą tożsamości przez OpenID Connect (decyzja D50: Amazon Cognito Essentials albo Keycloak;
 * ten sam mechanizm obsłuży później logowanie Apple/Google — MLP). Konto musi już istnieć (dopasowanie po e-mailu) —
 * usługa tożsamości nie zakłada kont w Eternal. Kod autoryzacji z PKCE, stan i nonce jednorazowe.
 */

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

let discovery: { at: number; doc: Discovery } | undefined;

export function oidcEnabled(): boolean {
  return !!(config.oidc.issuer && config.oidc.clientId);
}

async function discover(): Promise<Discovery> {
  if (discovery && Date.now() - discovery.at < 3_600_000) return discovery.doc;
  const res = await fetchWithTimeout(`${config.oidc.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) throw new HttpError(502, 'oidc_discovery_failed');
  const doc = (await res.json()) as Discovery;
  discovery = { at: Date.now(), doc };
  return doc;
}

export function redirectUri(): string {
  return `${config.publicUrl}/api/auth/oidc/callback`;
}

export async function startOidc(returnTo: string): Promise<string> {
  if (!oidcEnabled()) throw new HttpError(404, 'oidc_disabled');
  const d = await discover();
  const verifier = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = issueToken('oauth-state', { payload: { provider: 'oidc', verifier, nonce, returnTo: returnTo.startsWith('/') ? returnTo : '/' }, ttlMinutes: 10 });
  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.oidc.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export async function finishOidc(code: string, state: string): Promise<{ email: string; mfa: boolean; returnTo: string }> {
  const s = consumeToken<{ provider: string; verifier: string; nonce: string; returnTo: string }>('oauth-state', state);
  if (!s || s.payload.provider !== 'oidc') throw new HttpError(400, 'oidc_state_invalid');
  const d = await discover();
  const res = await fetchWithTimeout(d.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(config.oidc.clientSecret ? { Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.oidc.clientId)}:${encodeURIComponent(config.oidc.clientSecret)}`).toString('base64')}` } : {}),
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: config.oidc.clientId, code_verifier: s.payload.verifier }),
  });
  if (!res.ok) throw new HttpError(401, 'oidc_token_failed');
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new HttpError(401, 'oidc_no_id_token');
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(d.jwks_uri)), { issuer: d.issuer, audience: config.oidc.clientId });
  if (payload.nonce !== s.payload.nonce) throw new HttpError(401, 'oidc_nonce_mismatch');
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email || payload.email_verified === false) throw new HttpError(401, 'oidc_email_unverified');
  const amr = Array.isArray(payload.amr) ? (payload.amr as string[]) : [];
  // drugi składnik po stronie usługi tożsamości (amr: mfa/otp/hwk) zwalnia z TOTP w Eternal
  const mfa = amr.some((m) => ['mfa', 'otp', 'hwk', 'swk', 'fpt', 'face'].includes(m));
  return { email, mfa, returnTo: s.payload.returnTo };
}
