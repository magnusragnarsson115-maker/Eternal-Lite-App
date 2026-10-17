import { config } from '../config.js';
import { getDb } from '../db.js';
import { ScopedFhirRepository } from '../tenancy.js';
import { LocalFhirRepository } from './local.js';
import { GenericFhirRepository, MedplumFhirRepository } from './remote.js';
import type { FhirRepository } from './repository.js';

let base: FhirRepository | undefined;
let scoped: FhirRepository | undefined;

export function createRepository(): FhirRepository {
  switch (config.fhir.backend) {
    case 'medplum':
      return new MedplumFhirRepository(config.fhir.medplum);
    case 'fhir':
      return new GenericFhirRepository({ ...config.fhir.generic, timeoutMs: 15_000 });
    case 'local':
      return new LocalFhirRepository(getDb());
    default:
      throw new Error(`Unknown FHIR_BACKEND: ${config.fhir.backend as string}`);
  }
}

export function setRepo(r: FhirRepository): void {
  base = r;
  scoped = new ScopedFhirRepository(r);
}

/** Repozytorium w kontekście żądania — personel widzi tylko zasoby swojej organizacji. */
export function fhir(): FhirRepository {
  if (!scoped) throw new Error('FHIR repository not initialised');
  return scoped;
}

/**
 * Repozytorium bez filtra organizacji — wyłącznie dla usług, które same sprawdzają uprawnienia
 * (udostępnienia pacjenta, link zaproszenia, zadania systemowe). Każde użycie musi mieć kontrolę dostępu.
 */
export function fhirSystem(): FhirRepository {
  if (!base) throw new Error('FHIR repository not initialised');
  return base;
}
