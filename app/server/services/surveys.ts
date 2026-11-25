import crypto from 'node:crypto';
import type { Patient, Questionnaire, QuestionnaireItem, QuestionnaireResponse } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import type { AppUser } from '../auth/users.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { redactIdentifiers } from '../lib/redact.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { ORG_TAG_SYSTEM, orgIdsOf, vaultOrgId, withOrgTags } from '../tenancy.js';
import { isConfirmed, patientLabFacts } from './patientData.js';
import { buildItems, readableAnswers, type AnswerValue } from './questionnaires.js';
import { crisisMentioned } from './safety.js';

/**
 * Ankiety pacjenta (A12.3, M27 w części ankiet okresowych). Cztery rodzaje, każdy z regułą „kiedy”:
 *
 * 1. health-intake — ankieta zdrowotna na start: od razu po założeniu konta (można odłożyć o 3 dni).
 * 2. health-followup — ankieta kontrolna: po obejrzeniu kolejnych 3 raportów okresowych (różne okresy),
 *    nie częściej niż co 30 dni i dopiero po ankiecie wstępnej.
 * 3. after-results — po nowych potwierdzonych wynikach badań (z datą z ostatnich 30 dni): czy wynik był
 *    omówiony, czy opis badania był zrozumiały, pytanie do lekarza (wysyłane tylko, jeśli pacjent zechce).
 *    Nie częściej niż co 7 dni.
 * 4. app-feedback — ocena aplikacji: 14 dni po założeniu konta, potem co 90 dni. Anonimowa.
 *
 * Granica MDR: ankiety zbierają informacje od pacjenta — bez punktacji, triażu i wniosków. Odpowiedzi zdrowotne
 * są danymi pacjenta (sejf, FHIR QuestionnaireResponse); placówka widzi je tylko przy aktywnym udostępnieniu.
 * Ocena aplikacji nie jest powiązana z tożsamością (osobna tabela, identyfikatory usuwane z tekstu).
 */

export type SurveyId = 'health-intake' | 'health-followup' | 'after-results' | 'app-feedback';
export const SURVEY_IDS: SurveyId[] = ['health-intake', 'after-results', 'health-followup', 'app-feedback'];

export interface SurveyDef {
  id: SurveyId;
  version: string;
  kind: 'health' | 'product';
  title: string;
  description: string;
  minutes: number;
  item: QuestionnaireItem[];
}

export const SURVEY_RULES = {
  intakeSnoozeDays: 3,
  snoozeDays: 7,
  followupEveryReports: 3,
  followupMinDays: 30,
  afterResultsWindowDays: 30,
  afterResultsMinDays: 7,
  feedbackFirstAfterDays: 14,
  feedbackEveryDays: 90,
};

const c = (code: string, display: string) => ({ valueCoding: { code, display } });
const SELF_RATED: QuestionnaireItem = {
  linkId: 'self-rated',
  type: 'choice',
  text: 'Jak ogólnie oceniasz swoje zdrowie?',
  answerOption: [c('5', 'Bardzo dobrze'), c('4', 'Dobrze'), c('3', 'Ani dobrze, ani źle'), c('2', 'Źle'), c('1', 'Bardzo źle')],
};
const NO_TRIAGE: QuestionnaireItem = {
  linkId: 'info',
  type: 'display',
  text: 'Aplikacja nie ocenia odpowiedzi. Lekarz zobaczy je tylko wtedy, gdy udostępnisz mu swoje dane. W nagłym zagrożeniu dzwoń 112.',
};
const SCALE7 = (linkId: string, text: string): QuestionnaireItem => ({
  linkId,
  type: 'choice',
  text,
  required: true,
  answerOption: [c('1', '1 — zdecydowanie nie'), c('2', '2'), c('3', '3'), c('4', '4'), c('5', '5'), c('6', '6'), c('7', '7 — zdecydowanie tak')],
});

export const SURVEYS: SurveyDef[] = [
  {
    id: 'health-intake',
    version: 'survey-health-intake/2026-10-1',
    kind: 'health',
    title: 'Ankieta zdrowotna na start',
    description: 'Kilka pytań o Twoje zdrowie. Pomogą lekarzowi, gdy udostępnisz mu dane, i pozwolą dopasować aplikację.',
    minutes: 4,
    item: [
      {
        linkId: 'chronic',
        type: 'choice',
        repeats: true,
        required: true,
        text: 'Na które choroby przewlekłe się leczysz? (zaznacz wszystkie)',
        answerOption: [
          c('hypertension', 'Nadciśnienie tętnicze'),
          c('diabetes', 'Cukrzyca'),
          c('heart', 'Choroba serca'),
          c('lung', 'Astma lub POChP'),
          c('thyroid', 'Choroba tarczycy'),
          c('kidney', 'Choroba nerek'),
          c('mental', 'Depresja lub zaburzenia lękowe'),
          c('cancer', 'Nowotwór (obecnie lub w przeszłości)'),
          c('other', 'Inna'),
          c('none', 'Nie leczę się przewlekle'),
        ],
      },
      { linkId: 'chronic-other', type: 'string', text: 'Jaka inna choroba?', enableWhen: [{ question: 'chronic', operator: '=', answerCoding: { code: 'other' } }] },
      { linkId: 'meds', type: 'text', text: 'Jakie leki przyjmujesz na stałe? (możesz też dodać je na liście leków)' },
      { linkId: 'allergies', type: 'boolean', text: 'Czy masz uczulenia na leki?' },
      { linkId: 'allergies-list', type: 'string', text: 'Na jakie leki?', enableWhen: [{ question: 'allergies', operator: '=', answerBoolean: true }] },
      { linkId: 'smoking', type: 'choice', text: 'Palenie tytoniu', answerOption: [c('never', 'Nigdy nie paliłem(-am)'), c('former', 'Paliłem(-am) w przeszłości'), c('current', 'Palę obecnie')] },
      {
        linkId: 'activity',
        type: 'choice',
        text: 'Ile razy w tygodniu ćwiczysz albo spacerujesz szybkim krokiem co najmniej 30 minut?',
        answerOption: [c('0', 'Rzadziej niż raz'), c('1-2', '1–2 razy'), c('3+', '3 razy lub częściej')],
      },
      {
        linkId: 'family',
        type: 'choice',
        repeats: true,
        text: 'Choroby u rodziców lub rodzeństwa (zaznacz wszystkie, które znasz)',
        answerOption: [c('heart-early', 'Zawał lub udar przed 60. rokiem życia'), c('diabetes', 'Cukrzyca'), c('cancer', 'Nowotwór'), c('none', 'Żadne z powyższych'), c('unknown', 'Nie wiem')],
      },
      SELF_RATED,
      { linkId: 'goals', type: 'text', text: 'W czym aplikacja ma Ci najbardziej pomóc? (opcjonalnie)' },
      NO_TRIAGE,
    ],
  },
  {
    id: 'after-results',
    version: 'survey-after-results/2026-10-1',
    kind: 'health',
    title: 'Po nowych wynikach',
    description: 'Trzy krótkie pytania o Twoje nowe wyniki badań. Aplikacja ich nie ocenia.',
    minutes: 1,
    item: [
      {
        linkId: 'discussed',
        type: 'choice',
        required: true,
        text: 'Czy wynik został już omówiony z lekarzem?',
        answerOption: [c('yes', 'Tak'), c('planned', 'Jeszcze nie — mam umówioną wizytę'), c('no', 'Nie'), c('not-needed', 'Nie wiem, czy trzeba')],
      },
      {
        linkId: 'understood',
        type: 'choice',
        text: 'Czy wiesz, co było badane? (opis badań jest na osi czasu wyników)',
        answerOption: [c('yes', 'Tak'), c('partly', 'Częściowo'), c('no', 'Nie')],
      },
      { linkId: 'question', type: 'text', text: 'Czy chcesz o coś zapytać lekarza? Wpisz pytanie — po zapisaniu możesz je wysłać do placówki.' },
      { linkId: 'info', type: 'display', text: 'Pytanie nie trafi do lekarza samo — wyślesz je, jeśli zechcesz. W nagłym zagrożeniu dzwoń 112.' },
    ],
  },
  {
    id: 'health-followup',
    version: 'survey-health-followup/2026-10-1',
    kind: 'health',
    title: 'Ankieta kontrolna',
    description: 'Co się zmieniło od ostatniej ankiety? Odpowiedzi uzupełnią Twoje raporty.',
    minutes: 2,
    item: [
      { linkId: 'new-diagnosis', type: 'boolean', required: true, text: 'Czy od ostatniej ankiety lekarz rozpoznał u Ciebie nową chorobę?' },
      { linkId: 'new-diagnosis-text', type: 'string', text: 'Jaką?', enableWhen: [{ question: 'new-diagnosis', operator: '=', answerBoolean: true }] },
      { linkId: 'meds-changed', type: 'boolean', required: true, text: 'Czy zmieniły się Twoje stałe leki?' },
      { linkId: 'meds-changed-text', type: 'text', text: 'Co się zmieniło?', enableWhen: [{ question: 'meds-changed', operator: '=', answerBoolean: true }] },
      { linkId: 'hospital', type: 'boolean', text: 'Czy byłeś(-aś) w tym czasie w szpitalu?' },
      SELF_RATED,
      { linkId: 'discuss', type: 'text', text: 'Czy chcesz coś z raportów omówić z lekarzem? (opcjonalnie)' },
      NO_TRIAGE,
    ],
  },
  {
    id: 'app-feedback',
    version: 'survey-app-feedback/2026-10-1',
    kind: 'product',
    title: 'Jak działa aplikacja?',
    description: 'Anonimowa ankieta o aplikacji. Pomoże ją ulepszyć. Nie wpisuj tu informacji o zdrowiu.',
    minutes: 1,
    item: [
      // UMUX-Lite (2 pytania, skala 1–7) — krótka, standardowa miara użyteczności
      SCALE7('umux-1', 'Aplikacja robi to, czego potrzebuję.'),
      SCALE7('umux-2', 'Aplikacja jest łatwa w użyciu.'),
      {
        linkId: 'recommend',
        type: 'choice',
        text: 'Jak bardzo polecił(a)byś aplikację bliskiej osobie? (0 — wcale, 10 — na pewno)',
        answerOption: Array.from({ length: 11 }, (_, i) => c(String(i), String(i))),
      },
      { linkId: 'hard', type: 'text', text: 'Co było trudne albo nie działało?' },
      { linkId: 'missing', type: 'text', text: 'Czego Ci brakuje w aplikacji?' },
      { linkId: 'info', type: 'display', text: 'Ankieta jest anonimowa: nie zapisujemy, kto ją wypełnił. Nie wpisuj danych osobowych ani informacji o zdrowiu.' },
    ],
  },
];

export function surveyDef(id: string): SurveyDef {
  const d = SURVEYS.find((s) => s.id === id);
  if (!d) throw notFound('survey_not_found');
  return d;
}

export function questionnaireOf(d: SurveyDef): Questionnaire {
  return { resourceType: 'Questionnaire', id: d.id, url: `urn:eternal:survey:${d.id}`, version: d.version, status: 'active', title: d.title, description: d.description, item: d.item };
}

// --- stan użytkownika (user_pref „surveys”) ----------------------------------------------------------------

interface OneState {
  completedAt?: string;
  skippedAt?: string;
  snoozedUntil?: string;
  /** Liczba obejrzanych raportów w chwili ostatniej ankiety (wstępnej albo kontrolnej). */
  reportsBaseline?: number;
}

interface SurveyState {
  surveys: Partial<Record<SurveyId, OneState>>;
  /** Raporty okresowe obejrzane przez pacjenta — różne okresy (klucz „rodzaj:od:do”). */
  reportPeriods: string[];
  reportCount: number;
  /** Potwierdzone wyniki, o które już zapytaliśmy (albo pacjent pominął). */
  seenResults: string[];
}

const EMPTY: SurveyState = { surveys: {}, reportPeriods: [], reportCount: 0, seenResults: [] };

function loadState(userId: string): SurveyState {
  const row = getDb().prepare("SELECT value FROM user_pref WHERE user_id = ? AND key = 'surveys'").get(userId) as { value: string } | undefined;
  if (!row) return structuredClone(EMPTY);
  try {
    return { ...structuredClone(EMPTY), ...(JSON.parse(row.value) as Partial<SurveyState>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function saveState(userId: string, s: SurveyState): void {
  s.reportPeriods = s.reportPeriods.slice(-100);
  s.seenResults = s.seenResults.slice(-1000);
  getDb()
    .prepare("INSERT INTO user_pref (user_id, key, value, updated_at) VALUES (?, 'surveys', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(userId, JSON.stringify(s), nowIso());
}

/** Obejrzany raport okresowy (A4) — licznik dla ankiety kontrolnej; ten sam okres liczy się raz. */
export function noteReportViewed(userId: string, periodKey: string): void {
  const s = loadState(userId);
  if (s.reportPeriods.includes(periodKey)) return;
  s.reportPeriods.push(periodKey);
  s.reportCount += 1;
  saveState(userId, s);
}

const DAY = 86_400_000;
const daysSince = (iso: string | undefined, now: number) => (iso ? (now - Date.parse(iso)) / DAY : Infinity);
const lastDone = (o: OneState | undefined) => [o?.completedAt, o?.skippedAt].filter(Boolean).sort().pop();

export interface SurveyCard {
  id: SurveyId;
  title: string;
  description: string;
  minutes: number;
  kind: SurveyDef['kind'];
  /** Dlaczego teraz (do pokazania pacjentowi) — szablon tekstu ze zmiennymi do tłumaczenia w aplikacji. */
  reason: string;
  reasonVars?: Record<string, number>;
  due: boolean;
  completedAt?: string;
}

async function unseenRecentResults(patientRef: string, s: SurveyState, now: number): Promise<string[]> {
  const facts = (await patientLabFacts(patientRef)).filter(isConfirmed);
  return facts.filter((f) => f.id && !s.seenResults.includes(f.id) && now - Date.parse(`${f.date}T12:00:00Z`) <= SURVEY_RULES.afterResultsWindowDays * DAY).map((f) => f.id!);
}

/** Lista ankiet z informacją, które są teraz należne (kolejność = priorytet). */
export async function surveysFor(user: AppUser, patientRef: string, now = Date.now()): Promise<SurveyCard[]> {
  const s = loadState(user.id);
  const st = (id: SurveyId) => s.surveys[id] ?? {};
  const snoozed = (id: SurveyId) => !!st(id).snoozedUntil && Date.parse(st(id).snoozedUntil!) > now;
  const intakeDone = !!st('health-intake').completedAt;
  const cards: SurveyCard[] = [];
  const card = (d: SurveyDef, due: boolean, reason: string, reasonVars?: Record<string, number>) =>
    cards.push({ id: d.id, title: d.title, description: d.description, minutes: d.minutes, kind: d.kind, reason, reasonVars, due, completedAt: st(d.id).completedAt });

  card(surveyDef('health-intake'), !intakeDone && !snoozed('health-intake'), intakeDone ? 'Możesz zaktualizować odpowiedzi w każdej chwili.' : 'Na start — pozwoli lepiej przygotować wizyty.');

  const unseen = await unseenRecentResults(patientRef, s, now);
  const resultsDue = unseen.length > 0 && daysSince(lastDone(st('after-results')), now) >= SURVEY_RULES.afterResultsMinDays && !snoozed('after-results');
  card(surveyDef('after-results'), resultsDue, unseen.length ? 'Masz nowe potwierdzone wyniki badań.' : 'Pojawi się, gdy dodasz nowe wyniki badań.');

  const baseline = st('health-followup').reportsBaseline ?? st('health-intake').reportsBaseline ?? 0;
  const reportsSince = s.reportCount - baseline;
  const lastHealth = [lastDone(st('health-followup')), st('health-intake').completedAt].filter(Boolean).sort().pop();
  const followupDue = intakeDone && reportsSince >= SURVEY_RULES.followupEveryReports && daysSince(lastHealth, now) >= SURVEY_RULES.followupMinDays && !snoozed('health-followup');
  card(
    surveyDef('health-followup'),
    followupDue,
    followupDue ? 'Obejrzałeś(-aś) kolejne raporty ({n}).' : intakeDone ? 'Pojawi się po kolejnych raportach ({n}), nie częściej niż co {d} dni.' : 'Pojawi się po ankiecie na start i kilku raportach.',
    followupDue ? { n: reportsSince } : { n: Math.max(0, SURVEY_RULES.followupEveryReports - reportsSince), d: SURVEY_RULES.followupMinDays },
  );

  const accountDays = daysSince(user.created_at, now);
  const fb = lastDone(st('app-feedback'));
  const feedbackDue = !snoozed('app-feedback') && (fb ? daysSince(fb, now) >= SURVEY_RULES.feedbackEveryDays : accountDays >= SURVEY_RULES.feedbackFirstAfterDays);
  card(surveyDef('app-feedback'), feedbackDue, 'Twoja opinia pomoże ulepszyć aplikację.');

  return cards;
}

// --- odpowiedzi ----------------------------------------------------------------------------------------------

const surveyCanonical = (d: SurveyDef) => `urn:eternal:survey:${d.id}|${d.version}`;

/** Odpowiedzi zdrowotne pacjenta (sejf). */
export async function healthResponses(patientRef: string, surveyId?: SurveyId): Promise<QuestionnaireResponse[]> {
  const all = await fhirSystem().search<QuestionnaireResponse>('QuestionnaireResponse', { subject: patientRef, _tag: `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`, _sort: '-authored', _count: '200' });
  return all.filter((r) => r.questionnaire?.startsWith('urn:eternal:survey:') && (!surveyId || r.questionnaire.startsWith(`urn:eternal:survey:${surveyId}|`)));
}

export function surveyIdOf(r: QuestionnaireResponse): SurveyId | undefined {
  const id = r.questionnaire?.replace('urn:eternal:survey:', '').split('|')[0];
  return SURVEY_IDS.find((x) => x === id);
}

/** Ostatnie odpowiedzi jako wartości formularza — do aktualizacji ankiety wstępnej. */
export function answersOf(r: QuestionnaireResponse | undefined): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  const walk = (items: QuestionnaireResponse['item'] = []) => {
    for (const i of items) {
      const vals = (i.answer ?? []).map((a) => a.valueCoding?.code ?? a.valueString ?? a.valueBoolean ?? a.valueInteger ?? a.valueDecimal ?? a.valueDate);
      if (vals.length > 1) out[i.linkId] = vals.map(String);
      else if (vals.length === 1) out[i.linkId] = vals[0] as AnswerValue;
      walk(i.item);
    }
  };
  walk(r?.item);
  return out;
}

async function patientOrgIds(patientRef: string): Promise<string[]> {
  const p = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1]);
  return p ? orgIdsOf(p).filter((o) => o !== vaultOrgId(patientRef)) : [];
}

export interface SubmitResult {
  ok: true;
  responseId?: string;
  /** Pytanie do lekarza z ankiety „po wynikach” — aplikacja proponuje wysłanie go jako wiadomości. */
  question?: string;
  /** F8.1 — w tekście są słowa kryzysowe: aplikacja pokazuje numery pomocy. */
  crisis?: boolean;
}

export async function submitSurvey(
  actor: AuditActor,
  user: AppUser,
  patientRef: string,
  surveyId: string,
  answers: Record<string, AnswerValue>,
  opts: { platform?: 'web' | 'mobile' } = {},
): Promise<SubmitResult> {
  const d = surveyDef(surveyId);
  const items = buildItems(d.item, answers);
  if (!items.length) throw badRequest('survey_empty');
  const texts = items.flatMap((i) => (i.answer ?? []).map((a) => a.valueString ?? '')).join(' ');
  const crisis = crisisMentioned(texts) || undefined;
  const orgIds = await patientOrgIds(patientRef);
  const now = nowIso();
  const s = loadState(user.id);
  const prev = s.surveys[d.id] ?? {};
  let responseId: string | undefined;

  if (d.kind === 'health') {
    const saved = await fhirSystem().create<QuestionnaireResponse>(
      withOrgTags(
        {
          resourceType: 'QuestionnaireResponse',
          status: 'completed',
          questionnaire: surveyCanonical(d),
          subject: { reference: patientRef },
          author: { reference: patientRef },
          source: { reference: patientRef },
          authored: now,
          item: items,
        },
        [vaultOrgId(patientRef)],
      ),
    );
    responseId = saved.id;
    audit(actor, { action: 'C', subtype: 'survey-submit', entityRef: `QuestionnaireResponse/${saved.id}`, patientRef, detail: { survey: d.id, version: d.version } });
  } else {
    // ocena aplikacji: bez tożsamości; identyfikatory usunięte z tekstu
    const clean = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, typeof v === 'string' ? redactIdentifiers(v).slice(0, 1000) : v]));
    audit(actor, { action: 'C', subtype: 'survey-submit', detail: { survey: d.id, version: d.version } });
    getDb()
      .prepare('INSERT INTO survey_submission (id, survey_id, version, kind, org_ids, platform, answers, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), d.id, d.version, d.kind, orgIds.join(','), opts.platform ?? null, JSON.stringify(clean), now.slice(0, 10));
  }
  if (d.kind === 'health') {
    // licznik wypełnień dla placówek (bez treści i bez tożsamości)
    getDb()
      .prepare('INSERT INTO survey_submission (id, survey_id, version, kind, org_ids, platform, answers, submitted_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)')
      .run(crypto.randomUUID(), d.id, d.version, d.kind, orgIds.join(','), opts.platform ?? null, now.slice(0, 10));
  }

  s.surveys[d.id] = { ...prev, completedAt: now, snoozedUntil: undefined, reportsBaseline: d.id === 'health-intake' || d.id === 'health-followup' ? s.reportCount : prev.reportsBaseline };
  if (d.id === 'after-results') s.seenResults.push(...(await unseenRecentResults(patientRef, s, Date.now())));
  saveState(user.id, s);
  const question = d.id === 'after-results' && typeof answers.question === 'string' && answers.question.trim() ? answers.question.trim().slice(0, 1500) : undefined;
  return { ok: true, responseId, question, crisis };
}

/** „Nie teraz” (odłożenie) albo „Pomiń” (do następnego terminu z reguły). */
export async function deferSurvey(user: AppUser, patientRef: string, surveyId: string, mode: 'later' | 'skip'): Promise<void> {
  const d = surveyDef(surveyId);
  const s = loadState(user.id);
  const cur = s.surveys[d.id] ?? {};
  if (mode === 'later') {
    const days = d.id === 'health-intake' ? SURVEY_RULES.intakeSnoozeDays : SURVEY_RULES.snoozeDays;
    s.surveys[d.id] = { ...cur, snoozedUntil: new Date(Date.now() + days * DAY).toISOString() };
  } else {
    if (d.id === 'health-intake') throw badRequest('survey_cannot_skip'); // wstępną można tylko odłożyć
    s.surveys[d.id] = { ...cur, skippedAt: nowIso(), snoozedUntil: undefined, reportsBaseline: d.id === 'health-followup' ? s.reportCount : cur.reportsBaseline };
    if (d.id === 'after-results') s.seenResults.push(...(await unseenRecentResults(patientRef, s, Date.now())));
  }
  saveState(user.id, s);
}

// --- dostęp placówki (D3) i zestawienia ---------------------------------------------------------------------

/** Ostatnia ankieta wstępna i kontrolna — do raportu faktów, gdy pacjent udostępnił dane. */
export async function latestHealthSurveys(patientRef: string): Promise<{ ref: string; surveyId: SurveyId; title: string; authored: string; answers: { question: string; answer: string }[] }[]> {
  const all = await healthResponses(patientRef);
  const out = [];
  for (const id of ['health-intake', 'health-followup'] as const) {
    const r = all.find((x) => surveyIdOf(x) === id);
    if (r) out.push({ ref: `QuestionnaireResponse/${r.id}`, surveyId: id, title: surveyDef(id).title, authored: r.authored ?? '', answers: readableAnswers(r) });
  }
  return out;
}

export interface FeedbackSummary {
  responses: number;
  /** UMUX-Lite 0–100: ((u1 − 1) + (u2 − 1)) / 12 × 100, średnia. */
  umuxLite?: number;
  /** Net Promoter Score −100…100 (odsetek 9–10 minus odsetek 0–6). */
  nps?: number;
  comments: { date: string; hard?: string; missing?: string }[];
  completions: { surveyId: string; count: number }[];
}

/** Zestawienie dla administratora placówki: ocena aplikacji (anonimowa) i liczba wypełnionych ankiet — bez treści zdrowotnych. */
export function feedbackSummary(orgId: string, sinceDays = 365): FeedbackSummary {
  const since = new Date(Date.now() - sinceDays * DAY).toISOString().slice(0, 10);
  const rows = getDb()
    .prepare("SELECT survey_id, kind, org_ids, answers, submitted_at FROM survey_submission WHERE submitted_at >= ? AND (',' || org_ids || ',') LIKE ? ORDER BY submitted_at DESC")
    .all(since, `%,${orgId},%`) as { survey_id: string; kind: string; org_ids: string; answers: string | null; submitted_at: string }[];
  const fb = rows.filter((r) => r.survey_id === 'app-feedback' && r.answers).map((r) => ({ date: r.submitted_at, a: JSON.parse(r.answers!) as Record<string, AnswerValue> }));
  const umux = fb.map((x) => [Number(x.a['umux-1']), Number(x.a['umux-2'])]).filter(([a, b]) => a >= 1 && a <= 7 && b >= 1 && b <= 7);
  const rec = fb.map((x) => Number(x.a.recommend)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 10);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.survey_id, (counts.get(r.survey_id) ?? 0) + 1);
  return {
    responses: fb.length,
    umuxLite: umux.length ? Math.round((umux.reduce((s, [a, b]) => s + ((a - 1 + (b - 1)) / 12) * 100, 0) / umux.length) * 10) / 10 : undefined,
    nps: rec.length ? Math.round(((rec.filter((v) => v >= 9).length - rec.filter((v) => v <= 6).length) / rec.length) * 100) : undefined,
    comments: fb
      .map((x) => ({ date: x.date, hard: typeof x.a.hard === 'string' && x.a.hard ? x.a.hard : undefined, missing: typeof x.a.missing === 'string' && x.a.missing ? x.a.missing : undefined }))
      .filter((x) => x.hard || x.missing)
      .slice(0, 50),
    completions: SURVEY_IDS.map((id) => ({ surveyId: id, count: id === 'app-feedback' ? fb.length : (counts.get(id) ?? 0) })),
  };
}
