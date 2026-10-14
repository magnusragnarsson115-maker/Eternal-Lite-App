import { AsyncLocalStorage } from 'node:async_hooks';
import type { Meta, Patient, Resource, ResourceType } from '@medplum/fhirtypes';
import { getSetting, setSetting } from './settings.js';
import { FhirNotFoundError, type FhirRepository, type SearchParams, type StoredBinary } from './fhir/repository.js';

/**
 * Rozdzielenie organizacji (klinik) w jednej instancji — moduł kontrolny K13/K5.
 *
 * Każdy zasób FHIR ma znacznik organizacji `urn:eternal:org|{id}`. Personel kliniki widzi wyłącznie
 * zasoby ze znacznikiem swojej organizacji; dostęp do danych pacjenta z innego źródła (np. dokumenty
 * wgrane przez pacjenta i udostępnione klinice) przechodzi wyłącznie przez jawne udostępnienia
 * (access_grant) i repozytorium systemowe z kontrolą w usłudze.
 *
 * Kontekst żądania (AsyncLocalStorage) ustawia hak w app.ts — usługi nie muszą przekazywać organizacji.
 */

export const ORG_TAG_SYSTEM = 'urn:eternal:org';

export interface RequestScope {
  /** Organizacja personelu wykonującego żądanie. */
  orgId?: string;
  /** Pacjent zalogowany do aplikacji (dane własne, bez filtra organizacji). */
  patientRef?: string;
  /** Organizacje, w których pacjent jest zarejestrowany (dla zdarzeń i nowych zasobów). */
  patientOrgIds?: string[];
}

const als = new AsyncLocalStorage<RequestScope>();

export function currentScope(): RequestScope | undefined {
  return als.getStore();
}

export function currentOrgId(): string | undefined {
  return als.getStore()?.orgId;
}

export function runInScope<T>(scope: RequestScope, fn: () => T): T {
  return als.run(scope, fn);
}

/** Dla haków Fastify w stylu callback (propaguje kontekst do handlera). */
export function enterScope(scope: RequestScope, done: () => void): void {
  als.run(scope, done);
}

export function orgTag(orgId: string) {
  return { system: ORG_TAG_SYSTEM, code: orgId };
}

export function orgIdsOf(r: { meta?: Meta }): string[] {
  return (r.meta?.tag ?? []).filter((t) => t.system === ORG_TAG_SYSTEM && t.code).map((t) => t.code as string);
}

export function hasOrg(r: { meta?: Meta }, orgId: string): boolean {
  return orgIdsOf(r).includes(orgId);
}

export function withOrgTags<T extends Resource>(r: T, orgIds: string[]): T {
  const others = (r.meta?.tag ?? []).filter((t) => t.system !== ORG_TAG_SYSTEM);
  const unique = [...new Set(orgIds)];
  return { ...r, meta: { ...r.meta, tag: [...others, ...unique.map(orgTag)] } };
}

/**
 * Dane wgrane przez pacjenta (dokumenty, wyniki, wpisy z aplikacji) należą do pacjenta — znacznik „sejfu pacjenta”
 * zamiast organizacji. Klinika widzi je wyłącznie przez aktywne udostępnienie (services/grants.ts).
 */
export const VAULT_PREFIX = 'pt-';

export function vaultOrgId(patientRef: string): string {
  return `${VAULT_PREFIX}${patientRef.split('/')[1] ?? patientRef}`;
}

export function isVaultOrgId(id: string): boolean {
  return id.startsWith(VAULT_PREFIX);
}

export function defaultOrgId(): string | undefined {
  return getSetting<string>('default-org-id');
}

export function setDefaultOrgId(id: string): void {
  setSetting('default-org-id', id);
}

/**
 * Repozytorium widziane przez usługi (`fhir()`): dodaje znacznik organizacji przy zapisie
 * i filtruje odczyt/wyszukiwanie dla personelu. Pacjent i zadania systemowe — bez filtra
 * (usługi pacjenta sprawdzają własność danych po referencji pacjenta).
 */
export class ScopedFhirRepository implements FhirRepository {
  constructor(private readonly base: FhirRepository) {}

  get kind(): string {
    return this.base.kind;
  }

  init(): Promise<void> {
    return this.base.init();
  }

  private async tagsForCreate(r: Resource): Promise<string[] | undefined> {
    if (orgIdsOf(r).length) return undefined; // usługa ustawiła organizację jawnie
    const scope = currentScope();
    if (scope?.orgId) return [scope.orgId];
    if (scope?.patientRef) {
      if (scope.patientOrgIds) return scope.patientOrgIds;
      if (r.resourceType === 'Patient') return [];
      const p = await this.base.readOptional<Patient>('Patient', scope.patientRef.split('/')[1]);
      return p ? orgIdsOf(p) : [];
    }
    const def = defaultOrgId();
    return def ? [def] : undefined;
  }

  async create<T extends Resource>(resource: T): Promise<T> {
    const tags = await this.tagsForCreate(resource);
    return this.base.create(tags && tags.length ? withOrgTags(resource, tags) : resource);
  }

  private visible(r: Resource): boolean {
    const orgId = currentOrgId();
    if (!orgId) return true;
    return hasOrg(r, orgId);
  }

  async read<T extends Resource>(type: T['resourceType'], id: string): Promise<T> {
    const r = await this.base.read<T>(type, id);
    if (!this.visible(r)) throw new FhirNotFoundError(type, id);
    return r;
  }

  async readOptional<T extends Resource>(type: T['resourceType'], id: string): Promise<T | undefined> {
    const r = await this.base.readOptional<T>(type, id);
    return r && this.visible(r) ? r : undefined;
  }

  async update<T extends Resource>(resource: T, opts?: { ifMatch?: string }): Promise<T> {
    const orgId = currentOrgId();
    if (orgId && resource.id) {
      const current = await this.base.readOptional<T>(resource.resourceType, resource.id);
      if (!current || !hasOrg(current, orgId)) throw new FhirNotFoundError(resource.resourceType, resource.id);
      // znaczniki organizacji nie mogą zostać usunięte przez aktualizację
      const keep = orgIdsOf(current);
      return this.base.update(withOrgTags(resource, [...keep, ...orgIdsOf(resource)]), opts);
    }
    return this.base.update(resource, opts);
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    if (currentOrgId()) await this.read(type, id);
    return this.base.delete(type, id);
  }

  async search<T extends Resource>(type: T['resourceType'], params: SearchParams = {}): Promise<T[]> {
    const orgId = currentOrgId();
    if (!orgId) return this.base.search<T>(type, params);
    const tagFilter = `${ORG_TAG_SYSTEM}|${orgId}`;
    const existing = params._tag;
    const _tag = existing === undefined ? tagFilter : [...(Array.isArray(existing) ? existing : [existing]), tagFilter];
    return this.base.search<T>(type, { ...params, _tag });
  }

  async history<T extends Resource>(type: T['resourceType'], id: string): Promise<T[]> {
    if (currentOrgId()) await this.read(type, id);
    return this.base.history<T>(type, id);
  }

  saveBinary(data: Buffer, contentType: string, filename?: string): Promise<StoredBinary> {
    return this.base.saveBinary(data, contentType, filename);
  }

  readBinary(id: string): Promise<{ data: Buffer; contentType: string }> {
    return this.base.readBinary(id);
  }

  deleteBinary(id: string): Promise<void> {
    return this.base.deleteBinary(id);
  }

  health(): Promise<{ ok: boolean; detail: string }> {
    return this.base.health();
  }
}
