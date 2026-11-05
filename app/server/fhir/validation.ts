import {
  indexSearchParameterBundle,
  indexStructureDefinitionBundle,
  OperationOutcomeError,
  validateResource,
} from '@medplum/core';
import { readJson } from '@medplum/definitions';
import type { Bundle, OperationOutcomeIssue, Resource, SearchParameter } from '@medplum/fhirtypes';
import { FhirValidationError } from './repository.js';

let loaded = false;

/**
 * Ładuje definicje struktur i parametrów wyszukiwania FHIR R4 (specyfikacja bazowa HL7).
 * Bez rozszerzeń Medplum — aplikacja ma działać z dowolnym serwerem FHIR R4.
 */
export function loadFhirDefinitions(): void {
  if (loaded) return;
  indexStructureDefinitionBundle(readJson('fhir/r4/profiles-types.json') as Bundle);
  indexStructureDefinitionBundle(readJson('fhir/r4/profiles-resources.json') as Bundle);
  indexSearchParameterBundle(readJson('fhir/r4/search-parameters.json') as Bundle<SearchParameter>);
  loaded = true;
}

function toIssues(issues: OperationOutcomeIssue[]) {
  return issues
    .filter((i) => i.severity === 'error' || i.severity === 'fatal')
    .map((i) => ({ severity: i.severity, text: i.details?.text ?? i.diagnostics ?? 'invalid', expression: i.expression }));
}

/** Walidacja strukturalna zasobu względem specyfikacji FHIR R4. Rzuca FhirValidationError. */
export function validateFhir(resource: Resource): void {
  loadFhirDefinitions();
  let issues: OperationOutcomeIssue[];
  try {
    issues = validateResource(resource);
  } catch (err) {
    if (err instanceof OperationOutcomeError) {
      issues = err.outcome.issue ?? [];
    } else {
      throw err;
    }
  }
  const errors = toIssues(issues);
  if (errors.length > 0) {
    throw new FhirValidationError(
      `Invalid ${resource.resourceType}: ${errors.map((e) => `${e.text}${e.expression ? ` (${e.expression.join(', ')})` : ''}`).join('; ')}`,
      errors,
    );
  }
}
