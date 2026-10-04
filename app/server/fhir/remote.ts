import { MedplumClient, OperationOutcomeError } from '@medplum/core';
import type { Binary, Bundle, Resource, ResourceType } from '@medplum/fhirtypes';
import { fetchWithTimeout, sha256 } from '../lib/util.js';
import {
  FhirConflictError,
  FhirNotFoundError,
  FhirValidationError,
  type FhirRepository,
  type SearchParams,
  type StoredBinary,
} from './repository.js';
import { loadFhirDefinitions, validateFhir } from './validation.js';

const MAX_PAGES = 20;

function toQuery(params: SearchParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) q.append(k, item);
  }
  if (!q.has('_count')) q.set('_count', '1000');
  return q;
}

/**
 * Dowolny serwer FHIR R4 (HAPI, Azure Health Data Services, Google Healthcare API, Aidbox…).
 * Uwierzytelnienie: statyczny token Bearer albo OAuth2 client_credentials.
 */
export class GenericFhirRepository implements FhirRepository {
  readonly kind: string = 'fhir';
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly opts: {
      baseUrl: string;
      bearerToken?: string;
      tokenUrl?: string;
      clientId?: string;
      clientSecret?: string;
      timeoutMs?: number;
    },
  ) {}

  async init(): Promise<void> {
    loadFhirDefinitions();
    if (!this.opts.baseUrl) throw new Error('FHIR_BASE_URL is required for FHIR_BACKEND=fhir');
  }

  private base(): string {
    return this.opts.baseUrl.replace(/\/$/, '');
  }

  private async authHeader(): Promise<Record<string, string>> {
    if (this.opts.bearerToken) return { Authorization: `Bearer ${this.opts.bearerToken}` };
    if (this.opts.tokenUrl && this.opts.clientId && this.opts.clientSecret) {
      if (!this.token || this.token.expiresAt < Date.now() + 30_000) {
        const res = await fetchWithTimeout(this.opts.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.opts.clientId,
            client_secret: this.opts.clientSecret,
          }),
        });
        if (!res.ok) throw new Error(`FHIR token endpoint returned ${res.status}`);
        const json = (await res.json()) as { access_token: string; expires_in?: number };
        this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
      }
      return { Authorization: `Bearer ${this.token.value}` };
    }
    return {};
  }

  private async request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.base()}/${path}`;
    const res = await fetchWithTimeout(
      url,
      {
        method,
        headers: {
          Accept: 'application/fhir+json',
          ...(body ? { 'Content-Type': 'application/fhir+json' } : {}),
          ...(await this.authHeader()),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      this.opts.timeoutMs ?? 15_000,
    );
    if (res.status === 404 || res.status === 410) {
      const [type, id] = path.split('?')[0].split('/');
      throw new FhirNotFoundError(type, id ?? '');
    }
    if (res.status === 409 || res.status === 412) throw new FhirConflictError(`FHIR server returned ${res.status}`);
    if (res.status === 400 || res.status === 422) {
      const text = await res.text();
      throw new FhirValidationError(`FHIR server rejected resource: ${text.slice(0, 500)}`, []);
    }
    if (!res.ok) throw new Error(`FHIR server ${method} ${path} → ${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async create<T extends Resource>(resource: T): Promise<T> {
    validateFhir(resource);
    return this.request<T>('POST', resource.resourceType, resource);
  }

  async read<T extends Resource>(type: T['resourceType'], id: string): Promise<T> {
    return this.request<T>('GET', `${type}/${encodeURIComponent(id)}`);
  }

  async readOptional<T extends Resource>(type: T['resourceType'], id: string): Promise<T | undefined> {
    try {
      return await this.read<T>(type, id);
    } catch (err) {
      if (err instanceof FhirNotFoundError) return undefined;
      throw err;
    }
  }

  async update<T extends Resource>(resource: T, opts?: { ifMatch?: string }): Promise<T> {
    validateFhir(resource);
    const headers: Record<string, string> = opts?.ifMatch ? { 'If-Match': `W/"${opts.ifMatch}"` } : {};
    return this.request<T>('PUT', `${resource.resourceType}/${encodeURIComponent(resource.id ?? '')}`, resource, headers);
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    await this.request('DELETE', `${type}/${encodeURIComponent(id)}`);
  }

  async search<T extends Resource>(type: T['resourceType'], params: SearchParams = {}): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = `${type}?${toQuery(params).toString()}`;
    const wanted = params._count ? Number(params._count) : Infinity;
    for (let page = 0; next && page < MAX_PAGES && out.length < wanted; page++) {
      const bundle: Bundle<T> = await this.request<Bundle<T>>('GET', next);
      for (const e of bundle.entry ?? []) {
        if (e.resource && (!e.search?.mode || e.search.mode === 'match')) out.push(e.resource);
      }
      next = bundle.link?.find((l) => l.relation === 'next')?.url;
    }
    return Number.isFinite(wanted) ? out.slice(0, wanted) : out;
  }

  async history<T extends Resource>(type: T['resourceType'], id: string): Promise<T[]> {
    const bundle = await this.request<Bundle<T>>('GET', `${type}/${encodeURIComponent(id)}/_history`);
    return (bundle.entry ?? []).map((e) => e.resource).filter((r): r is T => !!r);
  }

  async saveBinary(data: Buffer, contentType: string): Promise<StoredBinary> {
    const created = await this.request<Binary>('POST', 'Binary', {
      resourceType: 'Binary',
      contentType,
      data: data.toString('base64'),
    } satisfies Binary);
    return { id: created.id ?? '', url: `Binary/${created.id}`, contentType, size: data.length, sha256: sha256(data) };
  }

  async readBinary(id: string): Promise<{ data: Buffer; contentType: string }> {
    const bin = await this.request<Binary>('GET', `Binary/${encodeURIComponent(id)}`);
    return { data: Buffer.from(bin.data ?? '', 'base64'), contentType: bin.contentType ?? 'application/octet-stream' };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const meta = await this.request<{ fhirVersion?: string; software?: { name?: string } }>('GET', 'metadata');
      return { ok: true, detail: `${meta.software?.name ?? 'FHIR'} ${meta.fhirVersion ?? ''} @ ${this.base()}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}

/**
 * Medplum (chmura lub instancja własna) przez oficjalny SDK @medplum/core.
 * Uwierzytelnienie: ClientApplication (OAuth2 client_credentials), odnawiane automatycznie.
 */
export class MedplumFhirRepository implements FhirRepository {
  readonly kind = 'medplum';
  private readonly client: MedplumClient;

  constructor(private readonly opts: { baseUrl: string; clientId: string; clientSecret: string }) {
    this.client = new MedplumClient({
      baseUrl: opts.baseUrl,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      fetch: globalThis.fetch.bind(globalThis),
      cacheTime: 0,
    });
  }

  async init(): Promise<void> {
    loadFhirDefinitions();
    if (!this.opts.clientId || !this.opts.clientSecret) {
      throw new Error('MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET are required for FHIR_BACKEND=medplum');
    }
    await this.client.startClientLogin(this.opts.clientId, this.opts.clientSecret);
  }

  private wrap<T>(promise: Promise<T>, type?: string, id?: string): Promise<T> {
    return promise.catch((err: unknown) => {
      if (err instanceof OperationOutcomeError) {
        const code = err.outcome.issue?.[0]?.code;
        if (code === 'not-found') throw new FhirNotFoundError(type ?? '', id ?? '');
        if (code === 'conflict') throw new FhirConflictError(err.message);
        if (code === 'invalid' || code === 'structure' || code === 'required') throw new FhirValidationError(err.message, []);
      }
      throw err;
    });
  }

  async create<T extends Resource>(resource: T): Promise<T> {
    validateFhir(resource);
    return this.wrap(this.client.createResource(resource)) as Promise<T>;
  }

  async read<T extends Resource>(type: T['resourceType'], id: string): Promise<T> {
    return this.wrap(this.client.readResource(type, id), type, id) as Promise<T>;
  }

  async readOptional<T extends Resource>(type: T['resourceType'], id: string): Promise<T | undefined> {
    try {
      return await this.read<T>(type, id);
    } catch (err) {
      if (err instanceof FhirNotFoundError) return undefined;
      throw err;
    }
  }

  async update<T extends Resource>(resource: T, opts?: { ifMatch?: string }): Promise<T> {
    validateFhir(resource);
    const headers = opts?.ifMatch ? { 'If-Match': `W/"${opts.ifMatch}"` } : undefined;
    return this.wrap(this.client.updateResource(resource as T & { id: string }, headers ? { headers } : undefined)) as Promise<T>;
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    await this.wrap(this.client.deleteResource(type, id), type, id);
  }

  async search<T extends Resource>(type: T['resourceType'], params: SearchParams = {}): Promise<T[]> {
    const q = toQuery(params);
    const result = await this.wrap(this.client.searchResources(type, q));
    return [...result] as unknown as T[];
  }

  async history<T extends Resource>(type: T['resourceType'], id: string): Promise<T[]> {
    const bundle = await this.wrap(this.client.readHistory(type, id), type, id);
    return (bundle.entry ?? []).map((e) => e.resource as T).filter(Boolean);
  }

  async saveBinary(data: Buffer, contentType: string, filename?: string): Promise<StoredBinary> {
    const bin = await this.wrap(this.client.createBinary(new Uint8Array(data), filename, contentType));
    return { id: bin.id, url: `Binary/${bin.id}`, contentType, size: data.length, sha256: sha256(data) };
  }

  async readBinary(id: string): Promise<{ data: Buffer; contentType: string }> {
    const blob = (await this.wrap(this.client.download(`Binary/${id}`))) as Blob;
    return { data: Buffer.from(await blob.arrayBuffer()), contentType: blob.type || 'application/octet-stream' };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      await this.client.searchResources('Organization', { _count: '1' });
      return { ok: true, detail: `Medplum @ ${this.opts.baseUrl}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
