import type { Provenance, Reference } from '@medplum/fhirtypes';
import { nowIso } from '../lib/util.js';
import { ETERNAL } from './constants.js';
import { fhir } from './index.js';

/**
 * Pochodzenie każdej wartości (moduł kontrolny K19, R2): kto, skąd, kiedy, czy potwierdzone.
 * Jeden zasób Provenance na operację (odczyt dokumentu, potwierdzenie, wpis ręczny, korekta, zatwierdzenie szkicu AI).
 */

export type ProvenanceActivity =
  | 'document-read'
  | 'patient-confirmed'
  | 'clinician-confirmed'
  | 'manual-entry'
  | 'correction'
  | 'ai-draft-approved'
  | 'clinic-entry'
  | 'import';

const ACTIVITY: Record<ProvenanceActivity, { code: string; display: string; system: string }> = {
  'document-read': { system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE', display: 'Odczyt z dokumentu' },
  'patient-confirmed': { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'VRF', display: 'Potwierdzenie przez pacjenta' },
  'clinician-confirmed': { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'VRF', display: 'Potwierdzenie przez personel' },
  'manual-entry': { system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE', display: 'Wpis ręczny' },
  correction: { system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'UPDATE', display: 'Korekta wartości' },
  'ai-draft-approved': { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'AUT', display: 'Szkic AI zatwierdzony przez lekarza' },
  'clinic-entry': { system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE', display: 'Wprowadzone przez placówkę' },
  import: { system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation', code: 'CREATE', display: 'Import z pliku' },
};

export interface ProvenanceAgent {
  /** Odniesienie do Patient/Practitioner albo opis urządzenia/oprogramowania (np. parser, model). */
  who?: string;
  display: string;
  role: 'author' | 'enterer' | 'verifier' | 'assembler' | 'informant' | 'performer';
}

export async function recordProvenance(input: {
  targets: string[];
  activity: ProvenanceActivity;
  agents: ProvenanceAgent[];
  sources?: { ref: string; role?: 'source' | 'derivation' | 'revision' | 'quotation' }[];
  reason?: string;
  extra?: { url: string; valueString?: string; valueCode?: string }[];
}): Promise<Provenance> {
  if (!input.targets.length) throw new Error('provenance without target');
  const act = ACTIVITY[input.activity];
  return fhir().create<Provenance>({
    resourceType: 'Provenance',
    target: input.targets.map((r): Reference => ({ reference: r })),
    recorded: nowIso(),
    activity: { coding: [{ system: act.system, code: act.code, display: act.display }], text: input.activity },
    reason: input.reason ? [{ text: input.reason }] : undefined,
    agent: input.agents.map((a) => ({
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: a.role }] },
      who: a.who ? { reference: a.who, display: a.display } : { display: a.display },
    })),
    entity: input.sources?.map((s) => ({ role: s.role ?? 'source', what: { reference: s.ref } })),
    extension: input.extra?.length ? input.extra : undefined,
  });
}

export async function provenanceFor(targetRef: string): Promise<Provenance[]> {
  const list = await fhir().search<Provenance>('Provenance', { target: targetRef, _count: '50' });
  return list.sort((a, b) => (a.recorded ?? '').localeCompare(b.recorded ?? ''));
}

