import { config } from '../config.js';
import { getDb } from '../db.js';
import { LocalFhirRepository } from './local.js';
import { GenericFhirRepository, MedplumFhirRepository } from './remote.js';
import type { FhirRepository } from './repository.js';

let repo: FhirRepository | undefined;

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
  repo = r;
}

export function fhir(): FhirRepository {
  if (!repo) throw new Error('FHIR repository not initialised');
  return repo;
}
