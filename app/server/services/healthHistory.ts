import type { Consent, FamilyMemberHistory, Immunization, ImmunizationRecommendation, Resource } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, vaultOrgId, withOrgTags } from '../tenancy.js';

/**
 * Historia zdrowia wpisywana przez pacjenta (lub opiekuna profilu dziecka):
 *  - szczepienia wykonane i planowane terminy z karty szczepień (A20.7, A21.7) — FHIR Immunization
 *    i ImmunizationRecommendation, źródło „zgłoszone przez pacjenta” (primarySource = false),
 *  - choroby w rodzinie (A20.9, A21.9) — FHIR FamilyMemberHistory,
 *  - dyspozycje medyczne i oświadczenie woli (A22.5) — FHIR Consent (zakres „adr”), wyłącznie informacyjnie.
 *
 * Aplikacja nie wylicza, jakie szczepienia „należą się” w danym wieku, i nie ocenia ryzyka rodzinnego — zapisuje
 * fakty podane przez pacjenta. Wszystko leży w sejfie pacjenta; lekarz widzi to po udostępnieniu.
 */

export const VACCINE_SYSTEM = 'urn:eternal:vaccine';
export const VACCINES: Record<string, string> = {
  'covid-19': 'COVID-19',
  influenza: 'Grypa',
  td: 'Tężec i błonica (Td)',
  tdap: 'Tężec, błonica, krztusiec (Tdap / DTaP)',
  'hep-b': 'Wirusowe zapalenie wątroby typu B',
  'hep-a': 'Wirusowe zapalenie wątroby typu A',
  hpv: 'HPV',
  pneumococcal: 'Pneumokoki',
  mmr: 'Odra, świnka, różyczka (MMR)',
  tbe: 'Kleszczowe zapalenie mózgu',
  varicella: 'Ospa wietrzna',
  rotavirus: 'Rotawirusy',
  meningococcal: 'Meningokoki',
  bcg: 'Gruźlica (BCG)',
  polio: 'Polio (IPV)',
  hib: 'Haemophilus influenzae typu b (Hib)',
  zoster: 'Półpasiec',
  rsv: 'RSV',
  other: 'Inna szczepionka',
};

const RELATIONSHIP: Record<string, string> = {
  MTH: 'matka',
  FTH: 'ojciec',
  SIS: 'siostra',
  BRO: 'brat',
  MGRMTH: 'babcia ze strony matki',
  MGRFTH: 'dziadek ze strony matki',
  PGRMTH: 'babcia ze strony ojca',
  PGRFTH: 'dziadek ze strony ojca',
  DAU: 'córka',
  SON: 'syn',
  AUNT: 'ciotka',
  UNCLE: 'wujek',
  EXT: 'inny krewny',
};
export const RELATIONSHIP_CODES = Object.keys(RELATIONSHIP) as [string, ...string[]];

export const FAMILY_CONDITIONS: Record<string, string> = {
  hypertension: 'Nadciśnienie tętnicze',
  diabetes: 'Cukrzyca',
  'heart-disease': 'Choroba serca lub zawał',
  stroke: 'Udar mózgu',
  cancer: 'Nowotwór',
  thyroid: 'Choroba tarczycy',
  asthma: 'Astma lub alergia',
  depression: 'Depresja lub inna choroba psychiczna',
  dementia: 'Otępienie (np. choroba Alzheimera)',
  genetic: 'Choroba genetyczna',
  other: 'Inna choroba',
};

export const DIRECTIVE_TEXT_VERSION = 'dyspozycje/2026-10-1';
export const DIRECTIVE_DISCLAIMER =
  'Te wpisy są informacją dla Twoich bliskich i lekarzy. Nie zastępują formalnych dokumentów: sprzeciwu w Centralnym Rejestrze Sprzeciwów (Poltransplant), upoważnienia złożonego w placówce ani pełnomocnictwa.';
export const DIRECTIVE_KINDS = ['organ-donation', 'transfusion', 'info-person', 'care-wishes'] as const;
export type DirectiveKind = (typeof DIRECTIVE_KINDS)[number];
const DIRECTIVE_SYSTEM = 'urn:eternal:directive';

const vault = (patientRef: string) => `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`;
const reported = { text: 'Zgłoszone przez pacjenta lub opiekuna' };

function checkDate(d: string, allowFuture = false): void {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d)) throw badRequest('invalid_date');
  if (!allowFuture && d > nowIso().slice(0, d.length)) throw badRequest('date_in_future');
}

async function ownResource<T extends Resource>(type: T['resourceType'], id: string, patientRef: string, ref: (r: T) => string | undefined): Promise<T> {
  const r = await fhirSystem().readOptional<T>(type, id);
  if (!r || ref(r) !== patientRef) throw notFound('entry_not_found');
  return r;
}

// --- szczepienia -----------------------------------------------------------------------------------------------------

export interface VaccinationView {
  id: string;
  status: 'done' | 'planned';
  vaccine: string;
  code?: string;
  date: string;
  dose?: number;
  lot?: string;
  place?: string;
  note?: string;
}

function vaccineConcept(code: string | undefined, name: string | undefined) {
  const display = code && code !== 'other' ? VACCINES[code] : undefined;
  const text = (name?.trim() || display || '').slice(0, 120);
  if (!text) throw badRequest('vaccine_required');
  return { coding: code && VACCINES[code] ? [{ system: VACCINE_SYSTEM, code, display: VACCINES[code] }] : undefined, text };
}

export async function addVaccination(
  actor: AuditActor,
  patientRef: string,
  input: { status: 'done' | 'planned'; code?: string; name?: string; date: string; dose?: number; lot?: string; place?: string; note?: string },
): Promise<VaccinationView> {
  checkDate(input.date, input.status === 'planned');
  if (input.status === 'planned' && input.date < nowIso().slice(0, 10)) throw badRequest('date_in_past');
  const concept = vaccineConcept(input.code, input.name);
  let saved: Resource;
  if (input.status === 'done') {
    saved = await fhirSystem().create<Immunization>(
      withOrgTags<Immunization>(
        {
          resourceType: 'Immunization',
          status: 'completed',
          vaccineCode: concept,
          patient: { reference: patientRef },
          occurrenceDateTime: input.date,
          recorded: nowIso(),
          primarySource: false,
          reportOrigin: reported,
          lotNumber: input.lot?.trim().slice(0, 40) || undefined,
          location: input.place?.trim() ? { display: input.place.trim().slice(0, 120) } : undefined,
          protocolApplied: input.dose ? [{ doseNumberPositiveInt: input.dose }] : undefined,
          note: input.note?.trim() ? [{ text: input.note.trim().slice(0, 500) }] : undefined,
        },
        [vaultOrgId(patientRef)],
      ),
    );
  } else {
    saved = await fhirSystem().create<ImmunizationRecommendation>(
      withOrgTags<ImmunizationRecommendation>(
        {
          resourceType: 'ImmunizationRecommendation',
          patient: { reference: patientRef },
          date: nowIso(),
          recommendation: [
            {
              vaccineCode: [concept],
              forecastStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/immunization-recommendation-status', code: 'due', display: 'Due' }], text: 'Planowane' },
              dateCriterion: [{ code: { coding: [{ system: 'http://loinc.org', code: '30980-7', display: 'Date vaccine due' }] }, value: input.date }],
              doseNumberPositiveInt: input.dose,
              description: input.note?.trim().slice(0, 500) || 'Termin wpisany przez pacjenta lub opiekuna (np. z karty szczepień).',
            },
          ],
        },
        [vaultOrgId(patientRef)],
      ),
    );
  }
  audit(actor, { action: 'C', subtype: input.status === 'done' ? 'vaccination-add' : 'vaccination-plan', entityRef: `${saved.resourceType}/${saved.id}`, patientRef });
  return (await listVaccinations(patientRef)).find((v) => v.id === saved.id)!;
}

export async function listVaccinations(patientRef: string): Promise<VaccinationView[]> {
  const [done, planned] = await Promise.all([
    fhirSystem().search<Immunization>('Immunization', { patient: patientRef, _tag: vault(patientRef), _count: '1000' }),
    fhirSystem().search<ImmunizationRecommendation>('ImmunizationRecommendation', { patient: patientRef, _tag: vault(patientRef), _count: '500' }),
  ]);
  const out: VaccinationView[] = [
    ...done
      .filter((i) => i.status === 'completed')
      .map((i) => ({
        id: i.id ?? '',
        status: 'done' as const,
        vaccine: i.vaccineCode.text ?? i.vaccineCode.coding?.[0]?.display ?? '',
        code: i.vaccineCode.coding?.find((c) => c.system === VACCINE_SYSTEM)?.code,
        date: i.occurrenceDateTime ?? i.occurrenceString ?? '',
        dose: i.protocolApplied?.[0]?.doseNumberPositiveInt,
        lot: i.lotNumber,
        place: i.location?.display,
        note: i.note?.[0]?.text,
      })),
    ...planned
      .filter((r) => r.recommendation[0]?.forecastStatus.coding?.[0]?.code === 'due')
      .map((r) => {
        const rec = r.recommendation[0];
        return {
          id: r.id ?? '',
          status: 'planned' as const,
          vaccine: rec.vaccineCode?.[0]?.text ?? '',
          code: rec.vaccineCode?.[0]?.coding?.find((c) => c.system === VACCINE_SYSTEM)?.code,
          date: rec.dateCriterion?.[0]?.value ?? '',
          dose: rec.doseNumberPositiveInt,
          note: rec.description,
        };
      }),
  ];
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function removeVaccination(actor: AuditActor, patientRef: string, id: string): Promise<void> {
  const imm = await fhirSystem().readOptional<Immunization>('Immunization', id);
  if (imm) {
    if (imm.patient.reference !== patientRef) throw notFound('entry_not_found');
    await fhirSystem().update<Immunization>({ ...imm, status: 'entered-in-error' });
  } else {
    const rec = await ownResource<ImmunizationRecommendation>('ImmunizationRecommendation', id, patientRef, (r) => r.patient.reference);
    await fhirSystem().update<ImmunizationRecommendation>({
      ...rec,
      recommendation: rec.recommendation.map((x) => ({ ...x, forecastStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/immunization-recommendation-status', code: 'complete', display: 'Complete' }], text: 'Usunięte z planu' } })),
    });
  }
  audit(actor, { action: 'U', subtype: 'vaccination-remove', entityRef: id, patientRef });
}

/** Planowany termin oznaczony jako wykonany: wpis szczepienia + zamknięcie planu. */
export async function completePlannedVaccination(actor: AuditActor, patientRef: string, id: string, input: { date: string; lot?: string; place?: string }): Promise<VaccinationView> {
  const rec = await ownResource<ImmunizationRecommendation>('ImmunizationRecommendation', id, patientRef, (r) => r.patient.reference);
  const r0 = rec.recommendation[0];
  const view = await addVaccination(actor, patientRef, {
    status: 'done',
    code: r0.vaccineCode?.[0]?.coding?.find((c) => c.system === VACCINE_SYSTEM)?.code,
    name: r0.vaccineCode?.[0]?.text,
    date: input.date,
    dose: r0.doseNumberPositiveInt,
    lot: input.lot,
    place: input.place,
  });
  await removeVaccination(actor, patientRef, id);
  return view;
}

// --- choroby w rodzinie --------------------------------------------------------------------------------------------

export interface FamilyHistoryView {
  id: string;
  relationship: string;
  relationshipLabel: string;
  conditions: { code?: string; text: string; onsetAge?: number }[];
  deceased?: boolean;
  deceasedAge?: number;
  note?: string;
}

export async function addFamilyHistory(
  actor: AuditActor,
  patientRef: string,
  input: { relationship: string; conditions: { code?: string; text?: string; onsetAge?: number }[]; deceased?: boolean; deceasedAge?: number; note?: string },
): Promise<FamilyHistoryView> {
  if (!RELATIONSHIP[input.relationship]) throw badRequest('invalid_relationship');
  const conditions = input.conditions
    .map((c) => ({ code: c.code && FAMILY_CONDITIONS[c.code] ? c.code : undefined, text: (c.text?.trim() || (c.code ? FAMILY_CONDITIONS[c.code] : '') || '').slice(0, 120), onsetAge: c.onsetAge }))
    .filter((c) => c.text);
  if (!conditions.length) throw badRequest('condition_required');
  const saved = await fhirSystem().create<FamilyMemberHistory>(
    withOrgTags<FamilyMemberHistory>(
      {
        resourceType: 'FamilyMemberHistory',
        status: 'completed',
        patient: { reference: patientRef },
        date: nowIso(),
        relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: input.relationship }], text: RELATIONSHIP[input.relationship] },
        deceasedBoolean: input.deceasedAge === undefined ? input.deceased : undefined,
        deceasedAge: input.deceasedAge !== undefined ? { value: input.deceasedAge, unit: 'a', system: 'http://unitsofmeasure.org', code: 'a' } : undefined,
        condition: conditions.map((c) => ({
          code: { coding: c.code ? [{ system: 'urn:eternal:family-condition', code: c.code, display: FAMILY_CONDITIONS[c.code] }] : undefined, text: c.text },
          onsetAge: c.onsetAge !== undefined ? { value: c.onsetAge, unit: 'a', system: 'http://unitsofmeasure.org', code: 'a' } : undefined,
        })),
        note: input.note?.trim() ? [{ text: input.note.trim().slice(0, 500) }] : undefined,
      },
      [vaultOrgId(patientRef)],
    ),
  );
  audit(actor, { action: 'C', subtype: 'family-history-add', entityRef: `FamilyMemberHistory/${saved.id}`, patientRef });
  return toFamilyView(saved);
}

function toFamilyView(f: FamilyMemberHistory): FamilyHistoryView {
  const code = f.relationship.coding?.[0]?.code ?? 'EXT';
  return {
    id: f.id ?? '',
    relationship: code,
    relationshipLabel: RELATIONSHIP[code] ?? f.relationship.text ?? '',
    conditions: (f.condition ?? []).map((c) => ({ code: c.code.coding?.[0]?.code, text: c.code.text ?? '', onsetAge: c.onsetAge?.value })),
    deceased: f.deceasedBoolean ?? (f.deceasedAge ? true : undefined),
    deceasedAge: f.deceasedAge?.value,
    note: f.note?.[0]?.text,
  };
}

export async function listFamilyHistory(patientRef: string): Promise<FamilyHistoryView[]> {
  const items = await fhirSystem().search<FamilyMemberHistory>('FamilyMemberHistory', { patient: patientRef, _tag: vault(patientRef), _count: '500' });
  return items.filter((f) => f.status !== 'entered-in-error').map(toFamilyView);
}

export async function removeFamilyHistory(actor: AuditActor, patientRef: string, id: string): Promise<void> {
  const f = await ownResource<FamilyMemberHistory>('FamilyMemberHistory', id, patientRef, (r) => r.patient.reference);
  await fhirSystem().update<FamilyMemberHistory>({ ...f, status: 'entered-in-error' });
  audit(actor, { action: 'U', subtype: 'family-history-remove', entityRef: `FamilyMemberHistory/${id}`, patientRef });
}

// --- dyspozycje medyczne i oświadczenie woli -------------------------------------------------------------------------

export interface DirectiveView {
  kind: DirectiveKind;
  value?: string;
  person?: { name: string; phone?: string };
  text?: string;
  showOnCard: boolean;
  updatedAt: string;
}

export type DirectiveInput =
  | { kind: 'organ-donation'; value: 'donor' | 'objection-registered' | 'undecided'; showOnCard: boolean }
  | { kind: 'transfusion'; value: 'accept' | 'refuse' | 'undecided'; showOnCard: boolean }
  | { kind: 'info-person'; person: { name: string; phone?: string }; showOnCard: boolean }
  | { kind: 'care-wishes'; text: string; showOnCard: boolean };

async function directiveResources(patientRef: string): Promise<Consent[]> {
  const all = await fhirSystem().search<Consent>('Consent', { patient: patientRef, _tag: vault(patientRef), _count: '200' });
  return all.filter((c) => c.category.some((x) => x.coding?.some((cd) => cd.system === DIRECTIVE_SYSTEM)));
}

function toDirectiveView(c: Consent): DirectiveView | undefined {
  const kind = c.category.flatMap((x) => x.coding ?? []).find((cd) => cd.system === DIRECTIVE_SYSTEM)?.code as DirectiveKind | undefined;
  if (!kind || c.status !== 'active') return undefined;
  const ext = (url: string) => c.extension?.find((e) => e.url === url);
  return {
    kind,
    value: ext('urn:eternal:ext:directive-value')?.valueString,
    person: ext('urn:eternal:ext:directive-person-name')?.valueString
      ? { name: ext('urn:eternal:ext:directive-person-name')!.valueString!, phone: ext('urn:eternal:ext:directive-person-phone')?.valueString }
      : undefined,
    text: ext('urn:eternal:ext:directive-text')?.valueString,
    showOnCard: ext('urn:eternal:ext:directive-show-on-card')?.valueBoolean ?? false,
    updatedAt: c.dateTime ?? c.meta?.lastUpdated ?? '',
  };
}

export async function listDirectives(patientRef: string): Promise<DirectiveView[]> {
  return (await directiveResources(patientRef)).map(toDirectiveView).filter((d): d is DirectiveView => !!d);
}

const DIRECTIVE_LABEL: Record<DirectiveKind, string> = {
  'organ-donation': 'Oświadczenie woli — dawstwo narządów',
  transfusion: 'Przetoczenie krwi',
  'info-person': 'Osoba, której można przekazać informacje',
  'care-wishes': 'Moje życzenia dotyczące leczenia',
};

/** Zapis nadpisuje poprzednią dyspozycję tego rodzaju (stara zostaje w historii jako nieaktywna). */
export async function setDirective(actor: AuditActor, patientRef: string, input: DirectiveInput): Promise<DirectiveView[]> {
  if (input.kind === 'info-person' && !input.person.name.trim()) throw badRequest('name_required');
  if (input.kind === 'info-person' && input.person.phone && !/^\+?[\d\s-]{9,16}$/.test(input.person.phone)) throw badRequest('invalid_phone');
  if (input.kind === 'care-wishes' && input.text.trim().length < 3) throw badRequest('text_required');
  for (const old of await directiveResources(patientRef)) {
    if (old.status === 'active' && toDirectiveView(old)?.kind === input.kind) await fhirSystem().update<Consent>({ ...old, status: 'inactive' });
  }
  const ext: NonNullable<Consent['extension']> = [{ url: 'urn:eternal:ext:directive-show-on-card', valueBoolean: input.showOnCard }];
  if ('value' in input) ext.push({ url: 'urn:eternal:ext:directive-value', valueString: input.value });
  if (input.kind === 'info-person') {
    ext.push({ url: 'urn:eternal:ext:directive-person-name', valueString: input.person.name.trim().slice(0, 120) });
    if (input.person.phone) ext.push({ url: 'urn:eternal:ext:directive-person-phone', valueString: input.person.phone.trim() });
  }
  if (input.kind === 'care-wishes') ext.push({ url: 'urn:eternal:ext:directive-text', valueString: input.text.trim().slice(0, 2000) });
  const permit = !(input.kind === 'transfusion' && input.value === 'refuse');
  await fhirSystem().create<Consent>(
    withOrgTags<Consent>(
      {
        resourceType: 'Consent',
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'adr', display: 'Advanced Care Directive' }] },
        category: [
          { coding: [{ system: 'http://loinc.org', code: '75320-2', display: 'Advance directive' }] },
          { coding: [{ system: DIRECTIVE_SYSTEM, code: input.kind, display: DIRECTIVE_LABEL[input.kind] }], text: DIRECTIVE_LABEL[input.kind] },
        ],
        patient: { reference: patientRef },
        dateTime: nowIso(),
        policy: [{ uri: `urn:eternal:policy:${DIRECTIVE_TEXT_VERSION}` }],
        provision: { type: permit ? 'permit' : 'deny' },
        extension: ext,
      },
      [vaultOrgId(patientRef)],
    ),
  );
  audit(actor, { action: 'U', subtype: `directive-${input.kind}`, patientRef, detail: { text: DIRECTIVE_TEXT_VERSION } });
  return listDirectives(patientRef);
}

export async function clearDirective(actor: AuditActor, patientRef: string, kind: DirectiveKind): Promise<DirectiveView[]> {
  for (const old of await directiveResources(patientRef)) {
    if (old.status === 'active' && toDirectiveView(old)?.kind === kind) await fhirSystem().update<Consent>({ ...old, status: 'inactive' });
  }
  audit(actor, { action: 'D', subtype: `directive-${kind}-clear`, patientRef });
  return listDirectives(patientRef);
}

/** Teksty dyspozycji na kartę ratunkową i kartę na wyjazd — tylko te, które pacjent zaznaczył do pokazania. */
export function directiveCardLines(items: DirectiveView[]): { pl: string; en: string }[] {
  const out: { pl: string; en: string }[] = [];
  for (const d of items.filter((x) => x.showOnCard)) {
    if (d.kind === 'organ-donation' && d.value === 'donor') out.push({ pl: 'Oświadczenie woli: chcę być dawcą narządów', en: 'Declaration: I wish to be an organ donor' });
    if (d.kind === 'organ-donation' && d.value === 'objection-registered') out.push({ pl: 'Sprzeciw wobec pobrania narządów złożony w Centralnym Rejestrze Sprzeciwów', en: 'Objection to organ donation registered in the Polish Central Register of Objections' });
    if (d.kind === 'transfusion' && d.value === 'refuse') out.push({ pl: 'Nie wyrażam zgody na przetoczenie krwi', en: 'I do not consent to blood transfusion' });
    if (d.kind === 'info-person' && d.person) out.push({ pl: `Osoba do informacji: ${d.person.name}${d.person.phone ? `, ${d.person.phone}` : ''}`, en: `Contact for information: ${d.person.name}${d.person.phone ? `, ${d.person.phone}` : ''}` });
    if (d.kind === 'care-wishes' && d.text) out.push({ pl: `Moje życzenia: ${d.text}`, en: `My wishes (in Polish): ${d.text}` });
  }
  return out;
}
