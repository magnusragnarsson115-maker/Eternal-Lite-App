import type { Questionnaire, QuestionnaireItem } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { fhir } from '../fhir/index.js';
import { badRequest, notFound } from '../lib/util.js';
import type { RequiredDocument } from '../settings.js';
import { getClinicSettings, listServices, updateClinicSettings, upsertService } from './directory.js';

/**
 * Pakiety specjalizacji (M30 — personalizacja dla wielu organizacji): gotowy zestaw dla poradni —
 * wymagane dokumenty przed wizytą (D2), wywiad przed wizytą (M27), szablon notatki Scribe (D5) i układ
 * raportu faktów (D3). Administrator widzi podgląd zmian i stosuje pakiet jednym ruchem.
 *
 * Zasady: pakiet tylko DODAJE — nie usuwa ani nie nadpisuje ustawień placówki; wywiad przypina wyłącznie
 * do usług tej specjalizacji, które nie mają własnego wywiadu (albo mają starszą wersję tego pakietu).
 * Wywiad zbiera informacje dla lekarza — bez punktacji, triażu i automatycznej oceny (ścieżka N0).
 */

export interface SpecialtyPackage {
  id: 'interna' | 'kardiologia' | 'pediatria';
  version: string;
  name: string;
  description: string;
  /** Słowa w nazwie specjalizacji usługi lub lekarza, po których rozpoznajemy tę specjalizację. */
  match: string[];
  noteTemplate: 'general' | 'cardiology' | 'pediatrics';
  factsLayout: string;
  requiredDocuments: RequiredDocument[];
  questionnaire: { title: string; description: string; item: QuestionnaireItem[] };
}

const choice = (code: string, display: string) => ({ valueCoding: { code, display } });
const NO_TRIAGE: QuestionnaireItem = {
  linkId: 'info',
  type: 'display',
  text: 'Odpowiedzi przeczyta lekarz przed wizytą — aplikacja ich nie ocenia. Ten formularz nie służy do zgłaszania nagłych stanów: w nagłym zagrożeniu dzwoń 112.',
};
const MEDS: QuestionnaireItem = { linkId: 'meds', type: 'text', text: 'Jakie leki przyjmujesz na stałe? (jeśli nie ma ich na liście leków w aplikacji)' };
const ALLERGY: QuestionnaireItem[] = [
  { linkId: 'allergies', type: 'boolean', text: 'Czy masz uczulenia na leki?' },
  { linkId: 'allergies-list', type: 'string', text: 'Na jakie leki?', enableWhen: [{ question: 'allergies', operator: '=', answerBoolean: true }] },
];
const SINCE: QuestionnaireItem = {
  linkId: 'since',
  type: 'choice',
  text: 'Od kiedy występują dolegliwości?',
  answerOption: [choice('days', 'Kilka dni'), choice('weeks', 'Kilka tygodni'), choice('months', 'Kilka miesięcy lub dłużej'), choice('control', 'Wizyta kontrolna')],
};

export const PACKAGES: SpecialtyPackage[] = [
  {
    id: 'interna',
    version: 'pkg-interna/2026-10-1',
    name: 'Choroby wewnętrzne / POZ',
    description: 'Wyniki z ostatnich 6 miesięcy, dokumentacja z wcześniejszego leczenia, wywiad ogólny, notatka ogólna.',
    match: ['intern', 'wewnętrz', 'poz', 'rodzinn', 'ogóln'],
    noteTemplate: 'general',
    factsLayout: 'interna',
    requiredDocuments: [
      { id: 'pkg-interna-lab', label: 'Wyniki badań laboratoryjnych (ostatnie 6 miesięcy)', accept: ['lab'], maxAgeDays: 180, specialties: ['interna'] },
      { id: 'pkg-interna-history', label: 'Dokumentacja z wcześniejszego leczenia (wypis, opis badania)', accept: ['discharge', 'imaging', 'referral', 'other'], optional: true, specialties: ['interna'] },
    ],
    questionnaire: {
      title: 'Wywiad przed wizytą — choroby wewnętrzne',
      description: 'Kilka pytań, które pomogą lekarzowi przygotować się do wizyty. Zajmie ok. 2 minuty.',
      item: [
        { linkId: 'reason', type: 'text', text: 'Z jakim problemem zgłaszasz się na wizytę?', required: true },
        SINCE,
        { linkId: 'chronic', type: 'text', text: 'Choroby przewlekłe, na które się leczysz (jeśli są)' },
        MEDS,
        ...ALLERGY,
        NO_TRIAGE,
      ],
    },
  },
  {
    id: 'kardiologia',
    version: 'pkg-kardiologia/2026-10-1',
    name: 'Kardiologia',
    description: 'Lipidogram z 12 miesięcy, EKG lub opis badań serca, wypis ze szpitala, wywiad kardiologiczny, notatka kardiologiczna.',
    match: ['kardio'],
    noteTemplate: 'cardiology',
    factsLayout: 'kardiologia',
    requiredDocuments: [
      { id: 'pkg-kardio-lab', label: 'Wyniki badań laboratoryjnych, w tym lipidogram (ostatnie 12 miesięcy)', accept: ['lab'], maxAgeDays: 365, specialties: ['kardiologia'] },
      { id: 'pkg-kardio-ecg', label: 'EKG albo opis badań serca (echo, Holter, próba wysiłkowa)', accept: ['imaging', 'other'], optional: true, specialties: ['kardiologia'] },
      { id: 'pkg-kardio-discharge', label: 'Karta wypisowa ze szpitala (jeśli była hospitalizacja)', accept: ['discharge'], optional: true, specialties: ['kardiologia'] },
    ],
    questionnaire: {
      title: 'Wywiad przed wizytą — kardiologia',
      description: 'Kilka pytań, które pomogą kardiologowi przygotować się do wizyty. Zajmie ok. 3 minuty.',
      item: [
        { linkId: 'reason', type: 'text', text: 'Z jakim problemem zgłaszasz się na wizytę?', required: true },
        {
          linkId: 'symptoms',
          type: 'choice',
          repeats: true,
          text: 'Które z tych dolegliwości miałeś(-aś) w ostatnim miesiącu? (zaznacz wszystkie)',
          answerOption: [
            choice('chest', 'Ból lub ucisk w klatce piersiowej'),
            choice('dyspnea', 'Duszność'),
            choice('palpitations', 'Kołatanie serca'),
            choice('edema', 'Obrzęki nóg'),
            choice('syncope', 'Omdlenie lub zasłabnięcie'),
            choice('none', 'Żadne z powyższych'),
          ],
        },
        { linkId: 'home-bp', type: 'boolean', text: 'Czy mierzysz ciśnienie w domu? (pomiary możesz dodać w aplikacji)' },
        { linkId: 'smoking', type: 'choice', text: 'Palenie tytoniu', answerOption: [choice('never', 'Nigdy nie paliłem(-am)'), choice('former', 'Paliłem(-am) w przeszłości'), choice('current', 'Palę obecnie')] },
        MEDS,
        ...ALLERGY,
        NO_TRIAGE,
      ],
    },
  },
  {
    id: 'pediatria',
    version: 'pkg-pediatria/2026-10-1',
    name: 'Pediatria',
    description: 'Wyniki z 6 miesięcy, informacja o szczepieniach, wywiad z opiekunem dziecka, notatka pediatryczna.',
    match: ['pediatr', 'dziec'],
    noteTemplate: 'pediatrics',
    factsLayout: 'pediatria',
    requiredDocuments: [
      { id: 'pkg-ped-lab', label: 'Wyniki badań dziecka (ostatnie 6 miesięcy)', accept: ['lab'], maxAgeDays: 180, optional: true, specialties: ['pediatria'] },
      { id: 'pkg-ped-vaccines', label: 'Informacja o szczepieniach (zdjęcie strony z książeczki zdrowia)', accept: ['other', 'certificate'], optional: true, specialties: ['pediatria'] },
    ],
    questionnaire: {
      title: 'Wywiad przed wizytą — pediatria',
      description: 'Pytania wypełnia rodzic lub opiekun. Pomogą lekarzowi przygotować się do wizyty.',
      item: [
        { linkId: 'reason', type: 'text', text: 'Z jakim problemem zgłaszacie się na wizytę?', required: true },
        SINCE,
        { linkId: 'guardian', type: 'choice', text: 'Kto przyjdzie z dzieckiem?', answerOption: [choice('parent', 'Rodzic'), choice('legal', 'Opiekun prawny'), choice('authorized', 'Inna osoba z upoważnieniem')] },
        { linkId: 'vaccines', type: 'choice', text: 'Czy szczepienia są zgodne z kalendarzem szczepień?', answerOption: [choice('yes', 'Tak'), choice('no', 'Nie'), choice('unknown', 'Nie wiem')] },
        { ...MEDS, text: 'Jakie leki dziecko przyjmuje na stałe lub przyjmowało w ostatnim tygodniu?' },
        { linkId: 'allergies', type: 'boolean', text: 'Czy dziecko ma uczulenia na leki?' },
        { linkId: 'allergies-list', type: 'string', text: 'Na jakie leki?', enableWhen: [{ question: 'allergies', operator: '=', answerBoolean: true }] },
        NO_TRIAGE,
      ],
    },
  },
];

/** Klucz specjalizacji z dowolnej nazwy („Kardiolog”, „Poradnia kardiologiczna” → kardiologia). */
export function specialtyKey(name: string | undefined): SpecialtyPackage['id'] | undefined {
  const s = (name ?? '').toLowerCase();
  return PACKAGES.find((p) => p.match.some((m) => s.includes(m)))?.id;
}

const questionnaireUrl = (p: SpecialtyPackage) => `urn:eternal:package:${p.id}:wywiad`;

async function packageQuestionnaires(p: SpecialtyPackage): Promise<Questionnaire[]> {
  return fhir().search<Questionnaire>('Questionnaire', { url: questionnaireUrl(p) });
}

export interface PackagePreview {
  id: string;
  name: string;
  version: string;
  description: string;
  applied: boolean;
  changes: {
    specialties: string[];
    noteTemplates: string[];
    requiredDocuments: { add: RequiredDocument[]; keep: string[] };
    questionnaire: { action: 'create' | 'new-version' | 'none'; title: string; questions: number };
    services: { attach: { id: string; name: string }[]; skippedOwnQuestionnaire: { id: string; name: string }[]; noMatch: boolean };
  };
}

export async function previewPackage(id: string): Promise<PackagePreview> {
  const p = PACKAGES.find((x) => x.id === id);
  if (!p) throw notFound('package_not_found');
  const settings = getClinicSettings();
  const existingQ = await packageQuestionnaires(p);
  const current = existingQ.find((q) => q.version === p.version && q.status === 'active');
  const ownIds = new Set(existingQ.map((q) => q.id));
  const services = (await listServices(true)).filter((s) => specialtyKey(s.specialty) === p.id || specialtyKey(s.name) === p.id);
  const attach = services.filter((s) => !s.questionnaireId || (ownIds.has(s.questionnaireId) && s.questionnaireId !== current?.id));
  const skipped = services.filter((s) => s.questionnaireId && !ownIds.has(s.questionnaireId));
  // wymóg już spełniony przez istniejący (ta sama lista rodzajów, co najmniej tak samo restrykcyjny) nie jest dublowany
  const sameKinds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const covered = (d: RequiredDocument) =>
    settings.requiredDocuments.some(
      (e) =>
        e.id === d.id ||
        ((!e.specialties?.length || e.specialties.includes(p.id)) && sameKinds(e.accept, d.accept) && (e.maxAgeDays ?? Infinity) <= (d.maxAgeDays ?? Infinity) && (!e.optional || d.optional)),
    );
  const changes: PackagePreview['changes'] = {
    specialties: settings.specialties.includes(p.id) ? [] : [p.id],
    noteTemplates: settings.noteTemplates.includes(p.noteTemplate) ? [] : [p.noteTemplate],
    requiredDocuments: { add: p.requiredDocuments.filter((d) => !covered(d)), keep: p.requiredDocuments.filter(covered).map((d) => d.label) },
    questionnaire: { action: current ? 'none' : existingQ.length ? 'new-version' : 'create', title: p.questionnaire.title, questions: p.questionnaire.item.filter((i) => i.type !== 'display').length },
    services: { attach: attach.map((s) => ({ id: s.id, name: s.name })), skippedOwnQuestionnaire: skipped.map((s) => ({ id: s.id, name: s.name })), noMatch: services.length === 0 },
  };
  const applied =
    !changes.specialties.length && !changes.noteTemplates.length && !changes.requiredDocuments.add.length && changes.questionnaire.action === 'none' && !changes.services.attach.length;
  return { id: p.id, name: p.name, version: p.version, description: p.description, applied, changes };
}

export async function listPackages(): Promise<PackagePreview[]> {
  return Promise.all(PACKAGES.map((p) => previewPackage(p.id)));
}

export async function applyPackage(actor: AuditActor, id: string): Promise<PackagePreview> {
  const preview = await previewPackage(id);
  const p = PACKAGES.find((x) => x.id === id)!;
  if (preview.applied) throw badRequest('package_already_applied');
  const settings = getClinicSettings();
  updateClinicSettings(actor, {
    specialties: [...settings.specialties, ...preview.changes.specialties],
    noteTemplates: [...settings.noteTemplates, ...preview.changes.noteTemplates],
    requiredDocuments: [...settings.requiredDocuments, ...preview.changes.requiredDocuments.add],
  });
  let questionnaireId = (await packageQuestionnaires(p)).find((q) => q.version === p.version && q.status === 'active')?.id;
  if (preview.changes.questionnaire.action !== 'none') {
    // poprzednie wersje zostają (odpowiedzi pacjentów się do nich odwołują), ale nie są już przypinane
    for (const old of await packageQuestionnaires(p)) if (old.status === 'active') await fhir().update<Questionnaire>({ ...old, status: 'retired' });
    const q = await fhir().create<Questionnaire>({
      resourceType: 'Questionnaire',
      url: questionnaireUrl(p),
      version: p.version,
      status: 'active',
      title: p.questionnaire.title,
      description: p.questionnaire.description,
      item: p.questionnaire.item,
    });
    questionnaireId = q.id;
  }
  const all = await listServices(true);
  for (const s of preview.changes.services.attach) {
    const svc = all.find((x) => x.id === s.id);
    if (svc) await upsertService(actor, { ...svc, questionnaireId });
  }
  audit(actor, { action: 'U', subtype: 'package-apply', detail: { package: p.id, version: p.version, services: preview.changes.services.attach.length } });
  return previewPackage(id);
}
