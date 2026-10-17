import crypto from 'node:crypto';
import { audit, type AuditActor } from '../audit.js';
import { config } from '../config.js';
import { getSetting, setSetting } from '../settings.js';

/**
 * Programy profilaktyczne finansowane przez NFZ (A7.7): kto może skorzystać (wiek liczony rocznikiem, jak
 * w zaproszeniach NFZ), jak często i jak się zapisać. To informacja o zasadach programu, nie zalecenie dla
 * konkretnej osoby — aplikacja niczego nie ocenia i nie pyta o objawy.
 *
 * Treść jest projektem do zatwierdzenia przez lekarza odpowiedzialnego za treści (jak objaśnienia badań, A2.4).
 * Zatwierdzenie wiąże się ze skrótem treści: każda zmiana tekstu wymaga ponownego zatwierdzenia. Zasady
 * programów zmieniają się (np. „Moje Zdrowie” zastąpił „Profilaktykę 40 Plus” w maju 2025) — sprawdzaj
 * źródła przy każdej wersji.
 */

export const PREVENTIVE_VERSION = 'nfz-profilaktyka/2026-10-1';

export interface PreventiveVariant {
  key: string;
  label: string;
  years: number;
}

export interface PreventiveProgram {
  key: string;
  name: string;
  sex?: 'female';
  /** Wiek w roku kalendarzowym (rok bieżący − rok urodzenia), włącznie. */
  minAge: number;
  maxAge?: number;
  /** Odstęp między badaniami w programie; zależny od wieku albo od rodzaju badania. */
  intervals: { fromAge: number; years: number }[];
  variants?: PreventiveVariant[];
  text: string;
  howTo: string;
  note?: string;
  source: string;
}

export const PREVENTIVE_PROGRAMS: PreventiveProgram[] = [
  {
    key: 'moje-zdrowie',
    name: 'Program „Moje Zdrowie” (bilans zdrowia osoby dorosłej)',
    minAge: 20,
    intervals: [
      { fromAge: 20, years: 5 },
      { fromAge: 50, years: 3 },
    ],
    text: 'Ankieta i podstawowe badania w przychodni podstawowej opieki zdrowotnej, potem rozmowa z lekarzem lub pielęgniarką o wynikach. Od 20. roku życia — raz na 5 lat, od 50. roku życia — raz na 3 lata.',
    howTo: 'Ankietę wypełnisz w Internetowym Koncie Pacjenta albo w aplikacji mojeIKP; badania wykonuje Twoja przychodnia POZ.',
    source: 'https://pacjent.gov.pl',
  },
  {
    key: 'mammografia',
    name: 'Program profilaktyki raka piersi (mammografia)',
    sex: 'female',
    minAge: 45,
    maxAge: 74,
    intervals: [{ fromAge: 45, years: 2 }],
    text: 'Bezpłatna mammografia dla kobiet w wieku 45–74 lat raz na 2 lata, bez skierowania. Badanie wykonuje pracownia stacjonarna albo mammobus.',
    howTo: 'Zapis przez centralną e-rejestrację w Internetowym Koncie Pacjenta, w pracowni albo pod numerem Telefonicznej Informacji Pacjenta 800 190 590.',
    note: 'Inne zasady obowiązują po leczeniu raka piersi — ustala je lekarz prowadzący.',
    source: 'https://pacjent.gov.pl',
  },
  {
    key: 'cytologia',
    name: 'Program profilaktyki raka szyjki macicy (cytologia albo test HPV)',
    sex: 'female',
    minAge: 25,
    maxAge: 64,
    intervals: [{ fromAge: 25, years: 3 }],
    variants: [
      { key: 'cytology', label: 'cytologia', years: 3 },
      { key: 'hpv', label: 'test HPV HR', years: 5 },
    ],
    text: 'Bezpłatne badanie dla kobiet w wieku 25–64 lat, bez skierowania: cytologia raz na 3 lata albo test HPV HR raz na 5 lat.',
    howTo: 'Zapis w poradni ginekologicznej z umową z NFZ albo przez Internetowe Konto Pacjenta.',
    source: 'https://pacjent.gov.pl',
  },
  {
    key: 'kolonoskopia',
    name: 'Program badań przesiewowych raka jelita grubego (kolonoskopia)',
    minAge: 50,
    maxAge: 65,
    intervals: [{ fromAge: 50, years: 10 }],
    text: 'Bezpłatna kolonoskopia bez skierowania dla osób w wieku 50–65 lat, które nie miały kolonoskopii w ciągu ostatnich 10 lat.',
    howTo: 'Zapis bezpośrednio w ośrodku realizującym program (lista na stronie NFZ) albo przez Internetowe Konto Pacjenta.',
    note: 'Program obejmuje też osoby w wieku 40–49 lat, których krewny pierwszego stopnia chorował na raka jelita grubego — to ustala lekarz albo ośrodek, nie aplikacja.',
    source: 'https://pacjent.gov.pl',
  },
];

// --- zatwierdzanie (jak objaśnienia badań) ---------------------------------------------------------------

const APPROVAL_KEY = 'preventive-approval';

export interface PreventiveApproval {
  version: string;
  hash: string;
  approvedBy: string;
  approvedAt: string;
}

export function preventiveHash(): string {
  return crypto.createHash('sha256').update(JSON.stringify({ v: PREVENTIVE_VERSION, p: PREVENTIVE_PROGRAMS })).digest('hex').slice(0, 16);
}

export function preventiveApproval(): PreventiveApproval | undefined {
  const a = getSetting<PreventiveApproval>(APPROVAL_KEY);
  return a && a.version === PREVENTIVE_VERSION && a.hash === preventiveHash() ? a : undefined;
}

/** Pacjent widzi programy po zatwierdzeniu; w instancji pokazowej — z oznaczeniem „projekt”. */
export function preventiveVisible(): boolean {
  return !!preventiveApproval() || config.demoMode;
}

export function approvePreventive(actor: AuditActor, approvedBy: string): PreventiveApproval {
  const name = approvedBy.trim();
  if (name.length < 5) throw new Error('Podaj imię, nazwisko i numer prawa wykonywania zawodu osoby zatwierdzającej.');
  const a: PreventiveApproval = { version: PREVENTIVE_VERSION, hash: preventiveHash(), approvedBy: name.slice(0, 160), approvedAt: new Date().toISOString() };
  setSetting(APPROVAL_KEY, a);
  audit(actor, { action: 'U', subtype: 'preventive-approve', detail: { version: a.version, hash: a.hash, approvedBy: a.approvedBy } });
  return a;
}

export function preventiveReviewMarkdown(): string {
  return [
    `# Programy profilaktyczne NFZ do zatwierdzenia — ${PREVENTIVE_VERSION} (skrót treści ${preventiveHash()})`,
    '',
    'Zasada: tekst opisuje warunki programu i sposób zapisu. Nie ocenia ryzyka, nie pyta o objawy i nie zaleca badań konkretnej osobie.',
    'Wiek liczony rocznikiem (rok bieżący − rok urodzenia), tak jak w zaproszeniach NFZ. Sprawdź źródła przed zatwierdzeniem.',
    '',
    ...PREVENTIVE_PROGRAMS.flatMap((p) => [
      `## ${p.name}`,
      '',
      `- Kto: ${p.sex === 'female' ? 'kobiety' : 'wszyscy'}, wiek ${p.minAge}${p.maxAge ? `–${p.maxAge}` : '+'} lat`,
      `- Jak często: ${p.variants ? p.variants.map((v) => `${v.label} co ${v.years} lat`).join('; ') : p.intervals.map((i) => `od ${i.fromAge} lat co ${i.years} lat`).join('; ')}`,
      `- Opis: ${p.text}`,
      `- Zapis: ${p.howTo}`,
      ...(p.note ? [`- Uwaga: ${p.note}`] : []),
      `- Źródło: ${p.source}`,
      '',
    ]),
  ].join('\n');
}
