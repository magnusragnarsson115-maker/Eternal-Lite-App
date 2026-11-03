import crypto from 'node:crypto';

/**
 * Podpis żądań AWS Signature Version 4 (bez SDK) — dla Amazon Textract i innych usług AWS z API JSON.
 * https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key: crypto.BinaryLike, s: string) => crypto.createHmac('sha256', key).update(s).digest();

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/** Zwraca nagłówki do wysłania (z Authorization). Ścieżka i zapytanie muszą być już zakodowane. */
export function signRequest(input: {
  method: string;
  host: string;
  path?: string;
  query?: string;
  region: string;
  service: string;
  headers?: Record<string, string>;
  body?: string;
  credentials: AwsCredentials;
  now?: Date;
}): Record<string, string> {
  const now = input.now ?? new Date();
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const headers: Record<string, string> = { ...(input.headers ?? {}), host: input.host, 'x-amz-date': date };
  if (input.credentials.sessionToken) headers['x-amz-security-token'] = input.credentials.sessionToken;
  const names = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = names.map((h) => `${h}:${String(lower[h]).trim().replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [input.method.toUpperCase(), input.path ?? '/', input.query ?? '', canonicalHeaders, signedHeaders, sha256(input.body ?? '')].join('\n');
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${input.credentials.secretAccessKey}`, day), input.region), input.service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) if (k !== 'host') out[k] = v;
  out.Authorization = `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return out;
}
