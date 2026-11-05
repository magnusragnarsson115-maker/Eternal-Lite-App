import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getSetting, setSetting } from '../settings.js';

/**
 * Wywiady przed wizytą prowadzone jak rozmowa (A12.3, A12.4, A5.5, runda 5).
 *
 * Kolejne pytanie wynika z REGUŁ ZAPISANYCH W DRZEWIE (odpowiedź → następne pytanie), które przegląda i zatwierdza
 * lekarz — nie z modelu, który sam dobiera pytania. Podsumowanie powstaje z odpowiedzi: powód, czas trwania,
 * objawy zgłoszone, objawy, którym pacjent zaprzeczył, leki, choroby, uczulenia, czynniki ryzyka podane przez
 * pacjenta i sprawy do omówienia. Bez punktacji, triażu i „prawdopodobnych rozpoznań” (granica MDR, COMPLIANCE §1).
 * Psychiatria: pytania opisowe, bez skal sumowanych do wyniku.
 */

export type SummaryField = 'reason' | 'duration' | 'symptoms' | 'meds' | 'conditions' | 'allergies' | 'risk' | 'issues' | 'other';

export interface IvOption {
  value: string;
  label: string;
  /** Następne pytanie po tej odpowiedzi (rozgałęzienie). */
  next?: string;
}

export interface IvNode {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'yesno' | 'text' | 'number';
  options?: IvOption[];
  /** Następne pytanie, jeśli odpowiedź nie wskazuje innego; brak = koniec. */
  next?: string;
  field: SummaryField;
  /** Dla pytań tak/nie o objaw: nazwa objawu w podsumowaniu (tak → objawy, nie → objawy zaprzeczone). */
  symptom?: string;
  /** Dla czynników ryzyka: etykieta w podsumowaniu, gdy odpowiedź „tak”. */
  riskLabel?: string;
  unit?: string;
  min?: number;
  max?: number;
  optional?: boolean;
  hint?: string;
}

export interface IvTree {
  id: string;
  version: string;
  title: string;
  specialty: string;
  description: string;
  start: string;
  nodes: IvNode[];
}

const yn = (yes?: string, no?: string): IvOption[] => [
  { value: 'yes', label: 'Tak', next: yes },
  { value: 'no', label: 'Nie', next: no },
  { value: 'unknown', label: 'Nie wiem', next: no },
];

// wspólne zakończenie: leki, uczulenia, choroby, czynniki ryzyka, sprawy do omówienia
const COMMON_TAIL: IvNode[] = [
  { id: 'meds-change', text: 'Czy od ostatniej wizyty zmieniły się Twoje leki (nowe, odstawione, inna dawka)?', type: 'yesno', options: yn('meds-what', 'allergy'), field: 'meds' },
  { id: 'meds-what', text: 'Co się zmieniło w lekach?', type: 'text', next: 'allergy', field: 'meds', hint: 'Np. „od września biorę ramipril 5 mg rano”.' },
  { id: 'allergy', text: 'Czy masz uczulenia na leki?', type: 'yesno', options: yn('allergy-what', 'conditions'), field: 'allergies', symptom: 'uczulenia na leki' },
  { id: 'allergy-what', text: 'Na jakie leki i co się wtedy działo?', type: 'text', next: 'conditions', field: 'allergies' },
  {
    id: 'conditions',
    text: 'Czy lekarz kiedyś rozpoznał u Ciebie którąś z tych chorób?',
    type: 'multi',
    options: [
      { value: 'hypertension', label: 'Nadciśnienie' },
      { value: 'diabetes', label: 'Cukrzyca' },
      { value: 'heart', label: 'Choroba serca' },
      { value: 'asthma', label: 'Astma lub POChP' },
      { value: 'thyroid', label: 'Choroba tarczycy' },
      { value: 'kidney', label: 'Choroba nerek' },
      { value: 'depression', label: 'Depresja lub zaburzenia lękowe' },
      { value: 'none', label: 'Żadna z nich' },
    ],
    next: 'smoking',
    field: 'conditions',
  },
  { id: 'smoking', text: 'Czy palisz papierosy lub e-papierosy?', type: 'yesno', options: yn('alcohol', 'alcohol'), field: 'risk', riskLabel: 'palenie (podane przez pacjenta)' },
  {
    id: 'alcohol',
    text: 'Jak często pijesz alkohol?',
    type: 'single',
    options: [
      { value: 'never', label: 'Nie piję' },
      { value: 'monthly', label: 'Kilka razy w miesiącu lub rzadziej' },
      { value: 'weekly', label: 'Kilka razy w tygodniu' },
      { value: 'daily', label: 'Codziennie' },
    ],
    next: 'family',
    field: 'risk',
  },
  { id: 'family', text: 'Czy ktoś z bliskiej rodziny (rodzice, rodzeństwo) chorował na serce przed 55. (mężczyźni) lub 65. (kobiety) rokiem życia?', type: 'yesno', options: yn('issues', 'issues'), field: 'risk', riskLabel: 'choroby serca w bliskiej rodzinie (podane przez pacjenta)' },
  { id: 'issues', text: 'O co chcesz zapytać lekarza albo co chcesz omówić?', type: 'text', field: 'issues', optional: true },
];

const DURATION: IvNode = {
  id: 'duration',
  text: 'Od kiedy to trwa?',
  type: 'single',
  options: [
    { value: 'days', label: 'Kilka dni' },
    { value: 'weeks', label: 'Kilka tygodni' },
    { value: 'months', label: 'Kilka miesięcy' },
    { value: 'years', label: 'Ponad rok' },
  ],
  field: 'duration',
};

export const INTERVIEW_TREES: IvTree[] = [
  {
    id: 'first-visit',
    version: 'wywiad-pierwsza-wizyta/2026-11-1',
    title: 'Pierwsza wizyta — wywiad ogólny',
    specialty: 'ogólna',
    description: 'Powód wizyty z rozgałęzieniami (ból, oddychanie, brzuch, samopoczucie, wyniki), potem leki, uczulenia, choroby i styl życia.',
    start: 'reason',
    nodes: [
      {
        id: 'reason',
        text: 'Z czym przychodzisz na wizytę?',
        type: 'single',
        options: [
          { value: 'pain', label: 'Ból', next: 'pain-where' },
          { value: 'breath', label: 'Kaszel lub duszność', next: 'breath-kind' },
          { value: 'belly', label: 'Dolegliwości brzucha', next: 'belly-kind' },
          { value: 'mood', label: 'Samopoczucie, sen, stres', next: 'mood-kind' },
          { value: 'results', label: 'Omówienie wyników albo kontrola', next: 'results-what' },
          { value: 'other', label: 'Coś innego', next: 'reason-text' },
        ],
        field: 'reason',
      },
      { id: 'reason-text', text: 'Opisz krótko, z czym przychodzisz.', type: 'text', next: 'duration', field: 'reason' },
      {
        id: 'pain-where',
        text: 'Gdzie boli?',
        type: 'multi',
        options: [
          { value: 'head', label: 'Głowa' },
          { value: 'chest', label: 'Klatka piersiowa' },
          { value: 'back', label: 'Plecy' },
          { value: 'joints', label: 'Stawy' },
          { value: 'belly', label: 'Brzuch' },
          { value: 'other', label: 'Gdzie indziej' },
        ],
        next: 'pain-scale',
        field: 'symptoms',
      },
      { id: 'pain-scale', text: 'Jak mocno boli w skali 0–10 (0 — nie boli, 10 — najmocniej, jak potrafisz sobie wyobrazić)?', type: 'number', min: 0, max: 10, unit: '/10', next: 'pain-night', field: 'symptoms', hint: 'To Twoja ocena — aplikacja jej nie interpretuje.' },
      { id: 'pain-night', text: 'Czy ból budzi Cię w nocy?', type: 'yesno', options: yn('duration', 'duration'), field: 'symptoms', symptom: 'ból budzący w nocy' },
      {
        id: 'breath-kind',
        text: 'Co dokładnie Ci dolega?',
        type: 'multi',
        options: [
          { value: 'cough', label: 'Kaszel' },
          { value: 'dyspnea', label: 'Duszność przy wysiłku' },
          { value: 'wheeze', label: 'Świszczący oddech' },
          { value: 'fever', label: 'Gorączka' },
        ],
        next: 'breath-sputum',
        field: 'symptoms',
      },
      { id: 'breath-sputum', text: 'Czy odkrztuszasz wydzielinę?', type: 'yesno', options: yn('duration', 'duration'), field: 'symptoms', symptom: 'odkrztuszanie wydzieliny' },
      {
        id: 'belly-kind',
        text: 'Co dokładnie Ci dolega?',
        type: 'multi',
        options: [
          { value: 'pain', label: 'Ból brzucha' },
          { value: 'nausea', label: 'Nudności lub wymioty' },
          { value: 'diarrhea', label: 'Biegunka' },
          { value: 'constipation', label: 'Zaparcia' },
          { value: 'heartburn', label: 'Zgaga' },
        ],
        next: 'belly-blood',
        field: 'symptoms',
      },
      { id: 'belly-blood', text: 'Czy zauważyłeś(-aś) krew w stolcu lub czarny stolec?', type: 'yesno', options: yn('duration', 'duration'), field: 'symptoms', symptom: 'krew w stolcu lub czarny stolec' },
      {
        id: 'mood-kind',
        text: 'Co najbardziej Ci przeszkadza?',
        type: 'multi',
        options: [
          { value: 'sleep', label: 'Sen' },
          { value: 'stress', label: 'Stres, napięcie' },
          { value: 'low', label: 'Obniżony nastrój' },
          { value: 'energy', label: 'Brak energii' },
        ],
        next: 'duration',
        field: 'symptoms',
      },
      { id: 'results-what', text: 'Jakie wyniki albo jaką chorobę chcesz omówić?', type: 'text', next: 'meds-change', field: 'reason' },
      { ...DURATION, next: 'meds-change' },
      ...COMMON_TAIL,
    ],
  },
  {
    id: 'cardiology',
    version: 'wywiad-kardiologia/2026-11-1',
    title: 'Kardiologia — przed wizytą',
    specialty: 'kardiologia',
    description: 'Dolegliwości sercowe (objawy tak/nie), pomiary domowe, potem leki, uczulenia, choroby i styl życia.',
    start: 'reason',
    nodes: [
      {
        id: 'reason',
        text: 'Jaki jest powód wizyty?',
        type: 'single',
        options: [
          { value: 'control', label: 'Wizyta kontrolna', next: 'chest-pain' },
          { value: 'new', label: 'Nowe dolegliwości', next: 'reason-text' },
          { value: 'results', label: 'Omówienie badań (EKG, echo, Holter)', next: 'reason-text' },
        ],
        field: 'reason',
      },
      { id: 'reason-text', text: 'Opisz krótko powód wizyty.', type: 'text', next: 'chest-pain', field: 'reason' },
      { id: 'chest-pain', text: 'Czy masz bóle lub ucisk w klatce piersiowej?', type: 'yesno', options: yn('chest-when', 'dyspnea'), field: 'symptoms', symptom: 'ból lub ucisk w klatce piersiowej' },
      {
        id: 'chest-when',
        text: 'Kiedy się pojawia?',
        type: 'single',
        options: [
          { value: 'effort', label: 'Przy wysiłku' },
          { value: 'rest', label: 'W spoczynku' },
          { value: 'both', label: 'I tak, i tak' },
        ],
        next: 'dyspnea',
        field: 'symptoms',
      },
      { id: 'dyspnea', text: 'Czy brakuje Ci tchu przy wysiłku, który wcześniej był łatwy?', type: 'yesno', options: yn('palpitations', 'palpitations'), field: 'symptoms', symptom: 'duszność przy wysiłku' },
      { id: 'palpitations', text: 'Czy odczuwasz kołatanie serca?', type: 'yesno', options: yn('edema', 'edema'), field: 'symptoms', symptom: 'kołatanie serca' },
      { id: 'edema', text: 'Czy puchną Ci nogi wieczorem?', type: 'yesno', options: yn('syncope', 'syncope'), field: 'symptoms', symptom: 'obrzęki nóg' },
      { id: 'syncope', text: 'Czy zdarzyło Ci się zemdleć albo prawie zemdleć?', type: 'yesno', options: yn('home-bp', 'home-bp'), field: 'symptoms', symptom: 'omdlenia lub stany przedomdleniowe' },
      { id: 'home-bp', text: 'Czy mierzysz ciśnienie w domu? Jeśli tak, wpisz typowy wynik (np. 135/85).', type: 'text', optional: true, next: 'meds-change', field: 'other' },
      ...COMMON_TAIL,
    ],
  },
  {
    id: 'diabetology',
    version: 'wywiad-diabetologia/2026-11-1',
    title: 'Diabetologia — przed wizytą',
    specialty: 'diabetologia',
    description: 'Sposób leczenia, pomiary glukozy, epizody niskiego cukru podane przez pacjenta, stopy i wzrok, potem część wspólna.',
    start: 'treatment',
    nodes: [
      {
        id: 'treatment',
        text: 'Jak obecnie leczysz cukrzycę?',
        type: 'multi',
        options: [
          { value: 'diet', label: 'Dieta i ruch' },
          { value: 'tablets', label: 'Tabletki' },
          { value: 'insulin', label: 'Insulina', next: 'insulin-how' },
          { value: 'injections', label: 'Inne zastrzyki (np. raz w tygodniu)' },
          { value: 'none', label: 'Nie mam jeszcze rozpoznanej cukrzycy' },
        ],
        next: 'glucose-meter',
        field: 'meds',
      },
      { id: 'insulin-how', text: 'Jak przyjmujesz insulinę (pen, pompa) i ile razy dziennie?', type: 'text', next: 'glucose-meter', field: 'meds' },
      {
        id: 'glucose-meter',
        text: 'Jak mierzysz glukozę?',
        type: 'single',
        options: [
          { value: 'cgm', label: 'Czujnik (CGM)' },
          { value: 'meter', label: 'Glukometr' },
          { value: 'none', label: 'Nie mierzę' },
        ],
        next: 'hypo',
        field: 'other',
      },
      { id: 'hypo', text: 'Czy od ostatniej wizyty zdarzył Ci się niski cukier (drżenie, poty, osłabienie)?', type: 'yesno', options: yn('hypo-count', 'feet'), field: 'symptoms', symptom: 'epizody niskiego cukru (zgłoszone)' },
      { id: 'hypo-count', text: 'Ile mniej więcej razy?', type: 'number', min: 0, max: 200, next: 'feet', field: 'symptoms' },
      { id: 'feet', text: 'Czy masz rany, odciski lub drętwienie stóp?', type: 'yesno', options: yn('eyes', 'eyes'), field: 'symptoms', symptom: 'zmiany lub drętwienie stóp' },
      { id: 'eyes', text: 'Kiedy ostatnio badano Ci dno oka?', type: 'single', options: [{ value: 'year', label: 'W ostatnim roku' }, { value: 'older', label: 'Dawniej' }, { value: 'never', label: 'Nigdy / nie pamiętam' }], next: 'meds-change', field: 'other' },
      ...COMMON_TAIL,
    ],
  },
  {
    id: 'psychiatry',
    version: 'wywiad-psychiatria/2026-11-1',
    title: 'Psychiatria — przed wizytą',
    specialty: 'psychiatria',
    description: 'Pytania opisowe o powód, sen, nastrój i leczenie — bez skal sumowanych do wyniku. Zawsze widoczna informacja o pomocy w kryzysie.',
    start: 'reason',
    nodes: [
      { id: 'reason', text: 'Co skłoniło Cię do umówienia wizyty? Napisz własnymi słowami.', type: 'text', next: 'duration', field: 'reason' },
      { ...DURATION, next: 'sleep' },
      { id: 'sleep', text: 'Jak śpisz w ostatnich tygodniach?', type: 'single', options: [{ value: 'ok', label: 'Bez zmian' }, { value: 'less', label: 'Mniej niż zwykle' }, { value: 'more', label: 'Więcej niż zwykle' }, { value: 'broken', label: 'Często się budzę' }], next: 'interest', field: 'symptoms' },
      { id: 'interest', text: 'Czy straciłeś(-aś) zainteresowanie rzeczami, które zwykle sprawiały Ci przyjemność?', type: 'yesno', options: yn('treatment-before', 'treatment-before'), field: 'symptoms', symptom: 'utrata zainteresowań' },
      { id: 'treatment-before', text: 'Czy leczyłeś(-aś) się wcześniej psychiatrycznie lub korzystałeś(-aś) z psychoterapii?', type: 'yesno', options: yn('treatment-what', 'meds-change'), field: 'conditions', symptom: 'wcześniejsze leczenie psychiatryczne lub psychoterapia' },
      { id: 'treatment-what', text: 'Jakie to było leczenie i jak długo?', type: 'text', next: 'meds-change', field: 'conditions' },
      ...COMMON_TAIL.filter((n) => n.id !== 'family').map((n) => (n.id === 'alcohol' ? { ...n, next: 'issues' } : n)),
    ],
  },
  {
    // profil „Medycyna estetyczna”: informacje do kwalifikacji, które lekarz omawia przed zabiegiem — bez oceny
    id: 'aesthetic',
    version: 'wywiad-estetyka/2026-11-1',
    title: 'Kwalifikacja do zabiegu medycyny estetycznej',
    specialty: 'medycyna estetyczna',
    description: 'Oczekiwania, wcześniejsze zabiegi, ciąża i karmienie, leki wpływające na krzepliwość, choroby autoimmunologiczne i nerwowo-mięśniowe, opryszczka, skłonność do bliznowców, uczulenia. Lekarz omawia odpowiedzi przy kwalifikacji.',
    start: 'reason',
    nodes: [
      { id: 'reason', text: 'Czego oczekujesz po zabiegu? Napisz własnymi słowami.', type: 'text', next: 'previous', field: 'reason' },
      { id: 'previous', text: 'Czy miałeś(-aś) wcześniej zabiegi medycyny estetycznej (toksyna, wypełniacze, nici, biostymulatory)?', type: 'yesno', options: yn('previous-what', 'pregnancy'), field: 'conditions', symptom: 'wcześniejsze zabiegi medycyny estetycznej' },
      { id: 'previous-what', text: 'Jakie zabiegi, w jakich okolicach i kiedy? Jeśli znasz nazwę preparatu — wpisz ją.', type: 'text', next: 'pregnancy', field: 'conditions', hint: 'Np. „kwas hialuronowy w usta, maj 2026”.' },
      { id: 'pregnancy', text: 'Czy jesteś w ciąży, planujesz ciążę w najbliższych miesiącach albo karmisz piersią?', type: 'yesno', options: yn('anticoag', 'anticoag'), field: 'risk', riskLabel: 'ciąża, planowana ciąża lub karmienie piersią' },
      { id: 'anticoag', text: 'Czy przyjmujesz leki wpływające na krzepnięcie krwi (np. przeciwzakrzepowe, kwas acetylosalicylowy) albo suplementy jak omega-3 lub miłorząb?', type: 'yesno', options: yn('anticoag-what', 'autoimmune'), field: 'meds', symptom: 'leki lub suplementy wpływające na krzepnięcie' },
      { id: 'anticoag-what', text: 'Jakie to leki lub suplementy?', type: 'text', next: 'autoimmune', field: 'meds' },
      { id: 'autoimmune', text: 'Czy lekarz rozpoznał u Ciebie chorobę autoimmunologiczną (np. toczeń, reumatoidalne zapalenie stawów) albo chorobę nerwowo-mięśniową (np. miastenia)?', type: 'yesno', options: yn('autoimmune-what', 'herpes'), field: 'conditions', symptom: 'choroba autoimmunologiczna lub nerwowo-mięśniowa' },
      { id: 'autoimmune-what', text: 'Jaka to choroba i jak jest leczona?', type: 'text', next: 'herpes', field: 'conditions' },
      { id: 'herpes', text: 'Czy miewasz nawracającą opryszczkę wargową?', type: 'yesno', options: yn('keloid', 'keloid'), field: 'risk', riskLabel: 'nawracająca opryszczka wargowa' },
      { id: 'keloid', text: 'Czy masz skłonność do przerostowych blizn lub bliznowców?', type: 'yesno', options: yn('skin', 'skin'), field: 'risk', riskLabel: 'skłonność do bliznowców' },
      { id: 'skin', text: 'Czy w okolicy planowanego zabiegu masz teraz stan zapalny, zmiany skórne albo świeżą ranę?', type: 'yesno', options: yn('allergy', 'allergy'), field: 'symptoms', symptom: 'stan zapalny lub zmiany skórne w okolicy zabiegu' },
      { id: 'allergy', text: 'Czy masz uczulenia na leki, środki znieczulające (np. lidokainę) albo inne substancje?', type: 'yesno', options: yn('allergy-what', 'meds-other'), field: 'allergies', symptom: 'uczulenia' },
      { id: 'allergy-what', text: 'Na co jesteś uczulony(-a) i co się wtedy działo?', type: 'text', next: 'meds-other', field: 'allergies' },
      { id: 'meds-other', text: 'Jakie inne leki przyjmujesz na stałe? (wpisz „brak”, jeśli żadne)', type: 'text', next: 'issues', field: 'meds' },
      { id: 'issues', text: 'Czy jest coś, o co chcesz zapytać lekarza przed zabiegiem?', type: 'text', field: 'issues', optional: true },
    ],
  },
];

export const INTERVIEW_IDS = INTERVIEW_TREES.map((t) => t.id);

export function interviewTree(id: string): IvTree {
  const t = INTERVIEW_TREES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown interview ${id}`);
  return t;
}

export function treeNode(tree: IvTree, id: string): IvNode | undefined {
  return tree.nodes.find((n) => n.id === id);
}

// --- zatwierdzenie drzewa przez lekarza (wersja + skrót treści) -------------------------------------------------

interface Approval {
  version: string;
  hash: string;
  approvedBy: string;
  approvedAt: string;
}

const key = (id: string) => `interview-approval:${id}`;

export function treeHash(t: IvTree): string {
  return crypto.createHash('sha256').update(JSON.stringify(t)).digest('hex').slice(0, 16);
}

export function treeApproval(t: IvTree): Approval | undefined {
  const a = getSetting<Approval>(key(t.id));
  return a && a.version === t.version && a.hash === treeHash(t) ? a : undefined;
}

/** Pacjent widzi wywiad po zatwierdzeniu; w instancji pokazowej — z oznaczeniem „projekt”. */
export function treeVisible(t: IvTree): boolean {
  return !!treeApproval(t) || config.demoMode;
}

export function approveTree(actor: AuditActor, id: string, approvedBy: string): Approval {
  const t = interviewTree(id);
  const name = approvedBy.trim();
  if (name.length < 5) throw new Error('Podaj imię, nazwisko i numer prawa wykonywania zawodu osoby zatwierdzającej.');
  const a: Approval = { version: t.version, hash: treeHash(t), approvedBy: name.slice(0, 160), approvedAt: new Date().toISOString() };
  setSetting(key(id), a);
  audit(actor, { action: 'U', subtype: 'interview-approve', detail: { tree: id, version: a.version, hash: a.hash, approvedBy: a.approvedBy } });
  return a;
}

export function treeReviewMarkdown(id?: string): string {
  const trees = id ? [interviewTree(id)] : INTERVIEW_TREES;
  return trees
    .flatMap((t) => [
      `# ${t.title} — ${t.version} (skrót ${treeHash(t)})`,
      '',
      t.description,
      '',
      'Zasada: kolejne pytanie wynika z reguł poniżej; podsumowanie przepisuje odpowiedzi bez punktacji i bez oceny.',
      '',
      ...t.nodes.flatMap((n) => [
        `- **${n.id}** (${n.type}${n.optional ? ', opcjonalne' : ''}) — ${n.text}`,
        ...(n.options ?? []).map((o) => `  - ${o.label}${o.next ? ` → ${o.next}` : ''}`),
        ...(n.next ? [`  - dalej → ${n.next}`] : []),
      ]),
      '',
    ])
    .join('\n');
}
