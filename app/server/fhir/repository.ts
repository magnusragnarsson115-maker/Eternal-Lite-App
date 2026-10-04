import type { Resource, ResourceType } from '@medplum/fhirtypes';

export type SearchParams = Record<string, string | string[] | undefined>;

export interface StoredBinary {
  id: string;
  url: string;
  contentType: string;
  size: number;
  sha256: string;
}

export interface FhirRepository {
  /** local | medplum | fhir */
  readonly kind: string;
  init(): Promise<void>;
  create<T extends Resource>(resource: T): Promise<T>;
  read<T extends Resource>(type: T['resourceType'], id: string): Promise<T>;
  readOptional<T extends Resource>(type: T['resourceType'], id: string): Promise<T | undefined>;
  /** ifMatch = meta.versionId oczekiwanej wersji (blokada optymistyczna). */
  update<T extends Resource>(resource: T, opts?: { ifMatch?: string }): Promise<T>;
  /** Usunięcie logiczne — historia wersji zostaje (wymóg przechowywania dokumentacji). */
  delete(type: ResourceType, id: string): Promise<void>;
  search<T extends Resource>(type: T['resourceType'], params?: SearchParams): Promise<T[]>;
  history<T extends Resource>(type: T['resourceType'], id: string): Promise<T[]>;
  saveBinary(data: Buffer, contentType: string, filename?: string): Promise<StoredBinary>;
  readBinary(id: string): Promise<{ data: Buffer; contentType: string }>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

export class FhirConflictError extends Error {
  constructor(message = 'Version conflict') {
    super(message);
  }
}

export class FhirNotFoundError extends Error {
  constructor(
    public readonly resourceType: string,
    public readonly id: string,
  ) {
    super(`${resourceType}/${id} not found`);
  }
}

export class FhirValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: { severity: string; text: string; expression?: string[] }[],
  ) {
    super(message);
  }
}

export function refOf(resource: { resourceType: string; id?: string }): string {
  if (!resource.id) throw new Error('Resource has no id');
  return `${resource.resourceType}/${resource.id}`;
}

export function idFromRef(ref: string | undefined): string {
  if (!ref) return '';
  const i = ref.lastIndexOf('/');
  return i >= 0 ? ref.slice(i + 1) : ref;
}
