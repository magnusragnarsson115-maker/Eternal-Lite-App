import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getSetting, setSetting } from '../settings.js';
import { LAB_TESTS } from './dictionary.js';

/**
 * Objaśnienia nazw badań, jednostek i pól dokumentu (A2.4): opis ogólny ze słownika, bez diagnozy
 * i bez indywidualnego zalecenia. Opis mówi, CO jest mierzone, i nigdy nie interpretuje wartości
 * (granica wyrobu medycznego — COMPLIANCE §1). Każdy opis ma wersję słownika.
 *
 * Treść jest projektem do zatwierdzenia przez lekarza odpowiedzialnego za treści. Zatwierdzenie
 * wiąże się ze skrótem treści: każda zmiana tekstu wymaga ponownego zatwierdzenia. Pacjent widzi
 * opisy dopiero po zatwierdzeniu; w instancji pokazowej — z oznaczeniem „projekt”.
 */

export const EXPLANATIONS_VERSION = 'lab-explain/2026-10-1';

/** Co mierzy badanie — klucz jak w słowniku badań (server/labs/dictionary.ts). */
export const TEST_TEXT: Record<string, string> = {
  wbc: 'Liczba leukocytów (krwinek białych) w określonej objętości krwi. Krwinki białe są częścią układu odpornościowego.',
  rbc: 'Liczba erytrocytów (krwinek czerwonych) w określonej objętości krwi. Krwinki czerwone przenoszą tlen.',
  hgb: 'Stężenie hemoglobiny we krwi. Hemoglobina to białko krwinek czerwonych, które wiąże i przenosi tlen.',
  hct: 'Hematokryt: jaką część objętości krwi stanowią krwinki czerwone (w procentach albo jako ułamek).',
  mcv: 'Średnia objętość jednej krwinki czerwonej.',
  mch: 'Średnia masa hemoglobiny w jednej krwince czerwonej.',
  mchc: 'Średnie stężenie hemoglobiny w krwinkach czerwonych.',
  rdw: 'Wskaźnik zróżnicowania wielkości krwinek czerwonych: jak bardzo różnią się one rozmiarem.',
  plt: 'Liczba płytek krwi (trombocytów) w określonej objętości krwi. Płytki biorą udział w krzepnięciu.',
  mpv: 'Średnia objętość jednej płytki krwi.',
  neut_abs: 'Liczba neutrofili (granulocytów obojętnochłonnych), najliczniejszego rodzaju krwinek białych, w określonej objętości krwi.',
  neut_pct: 'Jaki odsetek wszystkich krwinek białych stanowią neutrofile.',
  lymph_abs: 'Liczba limfocytów, rodzaju krwinek białych związanego z odpornością, w określonej objętości krwi.',
  lymph_pct: 'Jaki odsetek wszystkich krwinek białych stanowią limfocyty.',
  mono_abs: 'Liczba monocytów, rodzaju krwinek białych, w określonej objętości krwi.',
  mono_pct: 'Jaki odsetek wszystkich krwinek białych stanowią monocyty.',
  eos_abs: 'Liczba eozynofili (granulocytów kwasochłonnych), rodzaju krwinek białych, w określonej objętości krwi.',
  eos_pct: 'Jaki odsetek wszystkich krwinek białych stanowią eozynofile.',
  baso_abs: 'Liczba bazofili (granulocytów zasadochłonnych), najmniej licznego rodzaju krwinek białych, w określonej objętości krwi.',
  baso_pct: 'Jaki odsetek wszystkich krwinek białych stanowią bazofile.',
  glucose: 'Stężenie glukozy (cukru) w surowicy lub osoczu krwi w chwili pobrania. Wydruk zwykle podaje, czy badanie wykonano na czczo.',
  hba1c: 'Hemoglobina glikowana: jaka część hemoglobiny ma przyłączoną glukozę. Odzwierciedla stężenie glukozy z mniej więcej ostatnich 2–3 miesięcy.',
  chol: 'Stężenie cholesterolu całkowitego, czyli cholesterolu we wszystkich frakcjach lipoprotein krwi.',
  hdl: 'Stężenie cholesterolu przenoszonego przez lipoproteiny o dużej gęstości (HDL).',
  ldl: 'Stężenie cholesterolu przenoszonego przez lipoproteiny o małej gęstości (LDL). Często jest wyliczane ze wzoru, a nie mierzone bezpośrednio — metodę podaje wydruk.',
  nonhdl: 'Cholesterol nie-HDL: cholesterol całkowity pomniejszony o cholesterol HDL; wartość wyliczana.',
  tg: 'Stężenie triglicerydów, czyli tłuszczów krążących we krwi. Wpływa na nie ostatni posiłek, dlatego zwykle oznacza się je na czczo.',
  creat: 'Stężenie kreatyniny, produktu przemiany materii w mięśniach, który wydalają nerki.',
  egfr: 'Szacowany współczynnik przesączania kłębuszkowego: wartość wyliczana ze stężenia kreatyniny, wieku i płci według wzoru (np. CKD-EPI), opisująca pracę nerek.',
  urea: 'Stężenie mocznika, produktu przemiany białek, który wydalają nerki.',
  urate: 'Stężenie kwasu moczowego, produktu przemiany puryn.',
  alt: 'Aktywność enzymu aminotransferazy alaninowej (ALT) we krwi. Enzym występuje głównie w komórkach wątroby.',
  ast: 'Aktywność enzymu aminotransferazy asparaginianowej (AST) we krwi. Enzym występuje m.in. w wątrobie, mięśniach i sercu.',
  ggt: 'Aktywność enzymu gamma-glutamylotranspeptydazy (GGTP) we krwi. Enzym występuje m.in. w wątrobie i drogach żółciowych.',
  alp: 'Aktywność fosfatazy zasadowej we krwi. Enzym pochodzi głównie z wątroby, dróg żółciowych i kości.',
  bili: 'Stężenie bilirubiny całkowitej, barwnika powstającego z rozpadu hemoglobiny i wydalanego z żółcią.',
  bili_d: 'Stężenie bilirubiny bezpośredniej (sprzężonej), czyli części bilirubiny przetworzonej już przez wątrobę.',
  tp: 'Stężenie wszystkich białek w surowicy krwi.',
  alb: 'Stężenie albuminy, głównego białka osocza, wytwarzanego przez wątrobę.',
  ck: 'Aktywność kinazy kreatynowej, enzymu występującego głównie w mięśniach szkieletowych i mięśniu sercowym.',
  ldh: 'Aktywność dehydrogenazy mleczanowej (LDH), enzymu obecnego w wielu tkankach.',
  amylase: 'Aktywność amylazy, enzymu trawiącego skrobię, wytwarzanego głównie przez trzustkę i ślinianki.',
  lipase: 'Aktywność lipazy, enzymu trawiącego tłuszcze, wytwarzanego przez trzustkę.',
  na: 'Stężenie sodu, głównego elektrolitu płynu pozakomórkowego.',
  k: 'Stężenie potasu, elektrolitu ważnego m.in. dla pracy mięśni i serca.',
  cl: 'Stężenie chlorków, elektrolitu płynów ustrojowych.',
  ca: 'Stężenie wapnia całkowitego we krwi (wapnia związanego z białkami i wolnego).',
  mg: 'Stężenie magnezu we krwi.',
  phos: 'Stężenie fosforanów (fosforu nieorganicznego) we krwi.',
  fe: 'Stężenie żelaza w surowicy krwi.',
  ferritin: 'Stężenie ferrytyny, białka, w którym organizm magazynuje żelazo.',
  tibc: 'Całkowita zdolność wiązania żelaza: ile żelaza mogą przyłączyć białka, które przenoszą je we krwi (głównie transferyna).',
  tsh: 'Stężenie hormonu tyreotropowego (TSH), wydzielanego przez przysadkę mózgową i pobudzającego tarczycę.',
  ft4: 'Stężenie wolnej tyroksyny (FT4), hormonu tarczycy niezwiązanego z białkami.',
  ft3: 'Stężenie wolnej trójjodotyroniny (FT3), aktywnej postaci hormonu tarczycy niezwiązanej z białkami.',
  atpo: 'Stężenie przeciwciał przeciwko peroksydazie tarczycowej (anty-TPO), enzymowi tarczycy.',
  insulin: 'Stężenie insuliny, hormonu trzustki, który reguluje poziom glukozy we krwi.',
  cortisol: 'Stężenie kortyzolu, hormonu kory nadnerczy. Jego poziom zmienia się w ciągu doby, dlatego liczy się godzina pobrania.',
  psa: 'Stężenie całkowitego swoistego antygenu sterczowego (PSA), białka wytwarzanego przez gruczoł krokowy (prostatę).',
  vitd: 'Stężenie 25-hydroksywitaminy D, postaci witaminy D krążącej we krwi.',
  b12: 'Stężenie witaminy B12 (kobalaminy) we krwi.',
  folate: 'Stężenie kwasu foliowego (folianów) we krwi.',
  crp: 'Stężenie białka C-reaktywnego (CRP), wytwarzanego przez wątrobę w odpowiedzi na stan zapalny.',
  hscrp: 'Stężenie białka C-reaktywnego oznaczone metodą o wysokiej czułości (hs-CRP), która mierzy także bardzo małe stężenia.',
  esr: 'Odczyn Biernackiego (OB): o ile milimetrów opadną krwinki czerwone w probówce w ciągu godziny.',
  inr: 'INR: znormalizowany wskaźnik czasu krzepnięcia, wyliczany z czasu protrombinowego tak, aby wyniki z różnych laboratoriów były porównywalne.',
  pt: 'Czas protrombinowy: ile sekund trwa krzepnięcie osocza po dodaniu odczynnika (zewnątrzpochodny tor krzepnięcia).',
  aptt: 'Czas kaolinowo-kefalinowy (APTT): ile sekund trwa krzepnięcie osocza w teście wewnątrzpochodnego toru krzepnięcia.',
  fib: 'Stężenie fibrynogenu, białka osocza, z którego podczas krzepnięcia powstaje skrzep (włóknik).',
  ddimer: 'Stężenie D-dimerów, fragmentów powstających przy rozpuszczaniu skrzepu (włóknika).',
  ntprobnp: 'Stężenie NT-proBNP, fragmentu peptydu natriuretycznego uwalnianego przez komórki mięśnia sercowego.',
  tnhs: 'Stężenie troponiny T oznaczone metodą o wysokiej czułości. Troponina to białko komórek mięśnia sercowego.',
  tni: 'Stężenie troponiny I, białka komórek mięśnia sercowego.',
};

/** Jednostki — klucz po normalizacji (unitKey). */
export const UNIT_TEXT: Record<string, string> = {
  '10*3/ul': 'tysiące komórek w mikrolitrze krwi (10³/µl) — to samo co 10⁹ w litrze',
  '10*9/l': 'miliardy komórek w litrze krwi (10⁹/l) — to samo co tysiące w mikrolitrze',
  '10*6/ul': 'miliony komórek w mikrolitrze krwi (10⁶/µl)',
  '10*12/l': 'biliony komórek w litrze krwi (10¹²/l) — to samo co miliony w mikrolitrze',
  'g/dl': 'gramy na decylitr (100 ml)',
  'g/l': 'gramy na litr',
  'mg/dl': 'miligramy na decylitr (100 ml)',
  'mg/l': 'miligramy na litr',
  'ug/dl': 'mikrogramy na decylitr',
  'ug/l': 'mikrogramy na litr',
  'ng/ml': 'nanogramy na mililitr',
  'ng/dl': 'nanogramy na decylitr',
  'ng/l': 'nanogramy na litr',
  'pg/ml': 'pikogramy na mililitr',
  pg: 'pikogramy — masa w jednej krwince',
  fl: 'femtolitry — objętość jednej krwinki',
  'mmol/l': 'milimole na litr — ilość cząsteczek substancji w litrze',
  'umol/l': 'mikromole na litr',
  'nmol/l': 'nanomole na litr',
  'pmol/l': 'pikomole na litr',
  'mmol/mol': 'milimole na mol — ile hemoglobiny glikowanej przypada na całą hemoglobinę',
  '%': 'procent',
  'l/l': 'litr na litr — ułamek objętości (np. 0,40 to 40%)',
  'u/l': 'jednostki aktywności enzymu na litr',
  'ml/min/1.73_m2': 'mililitry na minutę w przeliczeniu na standardową powierzchnię ciała 1,73 m²',
  'mm/h': 'milimetry na godzinę',
  s: 'sekundy',
  inr: 'liczba bez jednostki (wskaźnik)',
  'uiu/ml': 'mikrojednostki międzynarodowe na mililitr (µIU/ml)',
  'iu/ml': 'jednostki międzynarodowe na mililitr (IU/ml)',
  'u/ml': 'jednostki na mililitr (U/ml)',
};

const UNIT_ALIASES: Record<string, string> = {
  'tys/ul': '10*3/ul',
  'mln/ul': '10*6/ul',
  'g/100ml': 'g/dl',
  'mg/100ml': 'mg/dl',
  'ml/min/1.73m2': 'ml/min/1.73_m2',
  'ml/min/1,73m2': 'ml/min/1.73_m2',
  'mm/godz': 'mm/h',
  'mm/1h': 'mm/h',
  sek: 's',
  'miu/l': 'uiu/ml',
  'mj/l': 'uiu/ml',
  'mu/l': 'uiu/ml',
  'j/l': 'u/l',
  'iu/l': 'u/l',
};

/** Normalizacja zapisu jednostki z wydruku i z UCUM: wielkość liter, µ, nawiasy UCUM, potęgi. */
export function unitKey(unit: string): string {
  const k = unit
    .trim()
    .toLowerCase()
    .replace(/µ|μ/g, 'u')
    .replace(/[[\]{}\s]/g, '')
    .replace(/\^/g, '*')
    .replace(/x10/g, '10');
  return UNIT_ALIASES[k] ?? k;
}

export const FIELD_TEXT = {
  range:
    'Zakres z dokumentu to przedział podany przez laboratorium, które wykonało badanie. Zależy od metody i laboratorium, dlatego ten sam parametr może mieć różne zakresy w różnych laboratoriach.',
  flag: 'Oznaczenie laboratorium (np. H, L, ↑, ↓, *) to znak wydrukowany przez laboratorium przy wyniku spoza jego zakresu. Aplikacja przepisuje je bez zmian; znaczenie wyniku omawia z Tobą lekarz.',
  loinc: 'LOINC to międzynarodowy kod rodzaju badania. Dzięki niemu wyniki tego samego badania z różnych laboratoriów trafiają do jednej historii.',
} as const;

// --- zatwierdzanie ---------------------------------------------------------------------------------------

const APPROVAL_KEY = 'lab-explanations-approval';

export interface ExplanationsApproval {
  version: string;
  hash: string;
  approvedBy: string;
  approvedAt: string;
}

export function contentHash(): string {
  return crypto.createHash('sha256').update(JSON.stringify({ v: EXPLANATIONS_VERSION, t: TEST_TEXT, u: UNIT_TEXT, f: FIELD_TEXT })).digest('hex').slice(0, 16);
}

export function currentApproval(): ExplanationsApproval | undefined {
  const a = getSetting<ExplanationsApproval>(APPROVAL_KEY);
  return a && a.version === EXPLANATIONS_VERSION && a.hash === contentHash() ? a : undefined;
}

export function approveExplanations(actor: AuditActor, approvedBy: string): ExplanationsApproval {
  const name = approvedBy.trim();
  if (name.length < 5) throw new Error('Podaj imię, nazwisko i numer prawa wykonywania zawodu osoby zatwierdzającej.');
  const a: ExplanationsApproval = { version: EXPLANATIONS_VERSION, hash: contentHash(), approvedBy: name.slice(0, 160), approvedAt: new Date().toISOString() };
  setSetting(APPROVAL_KEY, a);
  audit(actor, { action: 'U', subtype: 'explanations-approve', detail: { version: a.version, hash: a.hash, approvedBy: a.approvedBy } });
  return a;
}

export interface ExplanationsView {
  version: string;
  hash: string;
  approval?: { by: string; at: string };
  /** Pokazywać pacjentom: po zatwierdzeniu albo w instancji pokazowej (z oznaczeniem projektu). */
  visible: boolean;
  draft: boolean;
  tests: Record<string, { key: string; name: string; text: string }>;
  units: Record<string, string>;
  fields: typeof FIELD_TEXT;
}

/** Słownik dla interfejsu: badania po kodzie LOINC (tak są zapisane wyniki). */
export function explanationsView(): ExplanationsView {
  const approval = currentApproval();
  const tests: ExplanationsView['tests'] = {};
  for (const t of LAB_TESTS) {
    const text = TEST_TEXT[t.key];
    if (text) tests[t.loinc] = { key: t.key, name: t.pl, text };
  }
  return {
    version: EXPLANATIONS_VERSION,
    hash: contentHash(),
    approval: approval ? { by: approval.approvedBy, at: approval.approvedAt } : undefined,
    visible: !!approval || config.demoMode,
    draft: !approval,
    tests,
    units: UNIT_TEXT,
    fields: FIELD_TEXT,
  };
}

/** Wersja do przeglądu przez lekarza (Markdown): każdy opis z nazwą badania, kodem i jednostkami. */
export function explanationsReviewMarkdown(): string {
  const lines = [
    `# Objaśnienia badań do zatwierdzenia — ${EXPLANATIONS_VERSION} (skrót treści ${contentHash()})`,
    '',
    'Zasada: opis mówi, co jest mierzone. Nie interpretuje wartości, nie wskazuje przyczyn ani zaleceń (granica wyrobu medycznego).',
    '',
    '## Badania',
    '',
    ...LAB_TESTS.map((t) => `- **${t.pl}** (LOINC ${t.loinc}; jednostki: ${t.units.join(', ')}): ${TEST_TEXT[t.key] ?? '— BRAK OPISU —'}`),
    '',
    '## Jednostki',
    '',
    ...Object.entries(UNIT_TEXT).map(([u, txt]) => `- \`${u}\`: ${txt}`),
    '',
    '## Pola dokumentu',
    '',
    ...Object.entries(FIELD_TEXT).map(([k, txt]) => `- ${k}: ${txt}`),
    '',
    `Zatwierdzenie: \`npm run cli -- approve-explanations "lek. Imię Nazwisko, PWZ 0000000"\``,
  ];
  return lines.join('\n');
}
