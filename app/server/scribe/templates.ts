/**
 * Szablony notatek Eternal Scribe (D5): sekcje, kolejność i mapowanie na pola systemu gabinetowego
 * („Kopiuj do systemu gabinetowego”). Wersja szablonu trafia do notatki i do rejestru.
 * Sekcja „Rozpoznanie” przyjmuje wyłącznie rozpoznanie wypowiedziane przez lekarza — model go nie stawia.
 */

export type EhrLayout = 'generic' | 'soap';

export interface TemplateSection {
  key: string;
  title: string;
  hint: string;
  ehr: Record<EhrLayout, string>;
}

export interface NoteTemplate {
  id: string;
  version: string;
  name: string;
  specialty: string;
  sections: TemplateSection[];
}

const S = {
  wywiad: { key: 'wywiad', title: 'Wywiad', hint: 'Dolegliwości i ich przebieg z relacji pacjenta.', ehr: { generic: 'Wywiad', soap: 'S' } },
  leki: { key: 'leki', title: 'Leki przyjmowane', hint: 'Leki i suplementy wymienione w rozmowie, z dawkami tylko jeśli padły.', ehr: { generic: 'Wywiad', soap: 'S' } },
  badanie: { key: 'badanie', title: 'Badanie przedmiotowe', hint: 'Wyniki badania w gabinecie podane przez lekarza.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
  pomiary: { key: 'pomiary', title: 'Pomiary', hint: 'Pomiary z gabinetu i domowe — liczby dokładnie jak padły.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
  wyniki: { key: 'wyniki', title: 'Wyniki badań omówione na wizycie', hint: 'Wartości wyników wymienione w rozmowie.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
  rozpoznanie: { key: 'rozpoznanie', title: 'Rozpoznanie', hint: 'Tylko rozpoznanie wypowiedziane przez lekarza; inaczej pusto.', ehr: { generic: 'Rozpoznanie', soap: 'A' } },
  zalecenia: { key: 'zalecenia', title: 'Zalecenia', hint: 'Zalecenia, zlecenia badań i leki wypowiedziane przez lekarza.', ehr: { generic: 'Zalecenia', soap: 'P' } },
  kontrola: { key: 'kontrola', title: 'Kontrola i dalsze postępowanie', hint: 'Termin kontroli i sytuacje, w których pacjent ma się zgłosić.', ehr: { generic: 'Zalecenia', soap: 'P' } },
  rozwoj: { key: 'rozwoj', title: 'Rozwój i szczepienia', hint: 'Tylko jeśli były omawiane.', ehr: { generic: 'Wywiad', soap: 'S' } },
  // runda 5 — pełna struktura wizyty (A12.5)
  powod: { key: 'powod', title: 'Powód wizyty', hint: 'Z czym pacjent przychodzi — jego słowami.', ehr: { generic: 'Wywiad', soap: 'S' } },
  objawy: { key: 'objawy', title: 'Objawy', hint: 'Objawy wymienione przez pacjenta, z czasem trwania tylko jeśli padł.', ehr: { generic: 'Wywiad', soap: 'S' } },
  historia: { key: 'historia', title: 'Historia chorób', hint: 'Choroby przebyte i przewlekłe wymienione w rozmowie.', ehr: { generic: 'Wywiad', soap: 'S' } },
  alergie: { key: 'alergie', title: 'Alergie', hint: 'Uczulenia wymienione w rozmowie; jeśli pacjent zaprzeczył — zapisz to.', ehr: { generic: 'Wywiad', soap: 'S' } },
  obserwacje: { key: 'obserwacje', title: 'Badanie / obserwacje', hint: 'Badanie przedmiotowe i pomiary podane przez lekarza.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
  ocena: { key: 'ocena', title: 'Ocena lekarza', hint: 'Wyłącznie słowa lekarza; model nie stawia oceny ani rozpoznania.', ehr: { generic: 'Rozpoznanie', soap: 'A' } },
  plan: { key: 'plan', title: 'Plan', hint: 'Zlecone badania i dalsze kroki wypowiedziane przez lekarza.', ehr: { generic: 'Zalecenia', soap: 'P' } },
} satisfies Record<string, TemplateSection>;

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { id: 'general', version: 'note-general/2026-10-1', name: 'Wizyta ogólna (POZ, interna)', specialty: 'interna', sections: [S.wywiad, S.badanie, S.wyniki, S.rozpoznanie, S.zalecenia, S.kontrola] },
  { id: 'cardiology', version: 'note-cardiology/2026-10-1', name: 'Kardiologia', specialty: 'kardiologia', sections: [S.wywiad, S.leki, S.pomiary, S.wyniki, S.rozpoznanie, S.zalecenia, S.kontrola] },
  { id: 'pediatrics', version: 'note-pediatrics/2026-10-1', name: 'Pediatria', specialty: 'pediatria', sections: [{ ...S.wywiad, hint: 'Dolegliwości z relacji rodzica lub opiekuna i dziecka.' }, S.rozwoj, S.badanie, S.rozpoznanie, S.zalecenia, S.kontrola] },
  {
    id: 'soap',
    version: 'note-soap/2026-10-1',
    name: 'SOAP',
    specialty: 'ogólna',
    sections: [
      { key: 'S', title: 'S — dane podmiotowe', hint: 'Relacja pacjenta.', ehr: { generic: 'Wywiad', soap: 'S' } },
      { key: 'O', title: 'O — dane przedmiotowe', hint: 'Badanie, pomiary, wyniki.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
      { key: 'A', title: 'A — ocena lekarza', hint: 'Tylko słowa lekarza; model nie stawia oceny.', ehr: { generic: 'Rozpoznanie', soap: 'A' } },
      { key: 'P', title: 'P — plan', hint: 'Zalecenia i kontrola wypowiedziane przez lekarza.', ehr: { generic: 'Zalecenia', soap: 'P' } },
    ],
  },
  {
    // F3.19: raport SBAR (przekazanie pacjenta, konsultacja) — ocena wyłącznie słowami lekarza
    id: 'sbar',
    version: 'note-sbar/2026-10-1',
    name: 'SBAR (przekazanie, konsultacja)',
    specialty: 'ogólna',
    sections: [
      { key: 'sytuacja', title: 'S — sytuacja', hint: 'Z czym pacjent zgłasza się teraz — z relacji pacjenta.', ehr: { generic: 'Wywiad', soap: 'S' } },
      { key: 'tlo', title: 'B — tło', hint: 'Przebieg, leki, wyniki i pomiary wymienione w rozmowie.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
      { key: 'ocena', title: 'A — ocena lekarza', hint: 'Tylko słowa lekarza; model nie stawia oceny.', ehr: { generic: 'Rozpoznanie', soap: 'A' } },
      { key: 'zalecenie', title: 'R — zalecenie', hint: 'Zalecenia, zlecenia i kontrola wypowiedziane przez lekarza.', ehr: { generic: 'Zalecenia', soap: 'P' } },
    ],
  },
];

NOTE_TEMPLATES.push({
  id: 'full',
  version: 'note-full/2026-11-1',
  name: 'Pełna struktura wizyty (11 sekcji)',
  specialty: 'ogólna',
  sections: [S.powod, S.wywiad, S.objawy, S.historia, { ...S.leki, title: 'Leki' }, S.alergie, S.obserwacje, S.ocena, S.plan, S.zalecenia, { ...S.kontrola, title: 'Kontrola' }],
});

// profile placówek: porada kompleksowa w opiece koordynowanej (POZ) i karta zabiegu medycyny estetycznej
NOTE_TEMPLATES.push(
  {
    id: 'koz',
    version: 'note-koz/2026-11-1',
    name: 'Porada kompleksowa — opieka koordynowana (POZ)',
    specialty: 'interna',
    sections: [
      { ...S.wywiad, hint: 'Przebieg choroby przewlekłej i dolegliwości z relacji pacjenta.' },
      S.leki,
      S.badanie,
      { ...S.wyniki, hint: 'Wyniki badań i pomiary omówione na wizycie — liczby dokładnie jak padły.' },
      S.rozpoznanie,
      { key: 'ipom', title: 'Indywidualny Plan Opieki Medycznej', hint: 'Badania, konsultacje, porady edukacyjne i dietetyczne zaplanowane przez lekarza — tylko wypowiedziane.', ehr: { generic: 'Zalecenia', soap: 'P' } },
      S.zalecenia,
      S.kontrola,
    ],
  },
  {
    id: 'aesthetic',
    version: 'note-aesthetic/2026-11-1',
    name: 'Karta zabiegu — medycyna estetyczna',
    specialty: 'medycyna estetyczna',
    sections: [
      { key: 'powod', title: 'Oczekiwania pacjenta', hint: 'Z czym pacjent przychodzi — jego słowami.', ehr: { generic: 'Wywiad', soap: 'S' } },
      { key: 'kwalifikacja', title: 'Kwalifikacja i przeciwwskazania', hint: 'Omówione przeciwwskazania i odpowiedzi pacjenta (ciąża, leki, choroby, wcześniejsze zabiegi) — bez oceny modelu.', ehr: { generic: 'Wywiad', soap: 'S' } },
      { key: 'zabieg', title: 'Przebieg zabiegu', hint: 'Okolice, technika i ilości podane przez lekarza; produkt i numer serii zapisuje karta zabiegu.', ehr: { generic: 'Badanie przedmiotowe', soap: 'O' } },
      S.zalecenia,
      { ...S.kontrola, title: 'Kontrola' },
    ],
  },
);

export const NOTE_TEMPLATE_IDS = ['general', 'cardiology', 'pediatrics', 'soap', 'sbar', 'full', 'koz', 'aesthetic'] as const;

/** Formaty wyjściowe notatki (A12.5) — przekształcenie tej samej, zatwierdzanej treści, bez dopisywania. */
export const NOTE_FORMATS = ['clinical', 'soap', 'discharge', 'summary', 'ehr', 'fhir'] as const;
export type NoteFormat = (typeof NOTE_FORMATS)[number];
export const NOTE_FORMAT_PL: Record<NoteFormat, string> = {
  clinical: 'Notatka kliniczna',
  soap: 'SOAP',
  discharge: 'Karta informacyjna (wypis)',
  summary: 'Podsumowanie wizyty dla pacjenta',
  ehr: 'Pola do systemu gabinetowego (HIS/EHR/EDM)',
  fhir: 'FHIR Composition (EDM, HL7 FHIR R4)',
};
/** Klucz sekcji → litera SOAP (dla szablonów innych niż SOAP). */
export const SOAP_OF: Record<string, 'S' | 'O' | 'A' | 'P'> = {
  powod: 'S', wywiad: 'S', objawy: 'S', historia: 'S', leki: 'S', alergie: 'S', rozwoj: 'S', sytuacja: 'S', tlo: 'S', S: 'S',
  badanie: 'O', pomiary: 'O', wyniki: 'O', obserwacje: 'O', O: 'O',
  rozpoznanie: 'A', ocena: 'A', A: 'A',
  zalecenia: 'P', kontrola: 'P', plan: 'P', zalecenie: 'P', P: 'P', ipom: 'P',
  kwalifikacja: 'S', zabieg: 'O',
};
/** Układ karty informacyjnej: sekcja docelowa → klucze sekcji notatki. */
export const DISCHARGE_LAYOUT: [string, string[]][] = [
  ['Rozpoznanie / ocena lekarza', ['rozpoznanie', 'ocena', 'A']],
  ['Wywiad i przebieg wizyty', ['powod', 'wywiad', 'objawy', 'historia', 'kwalifikacja', 'sytuacja', 'tlo', 'S']],
  ['Badanie i wyniki', ['badanie', 'pomiary', 'wyniki', 'obserwacje', 'zabieg', 'O']],
  ['Leki', ['leki']],
  ['Alergie', ['alergie']],
  ['Zalecenia', ['plan', 'ipom', 'zalecenia', 'zalecenie', 'P']],
  ['Kontrola', ['kontrola']],
];

export function getTemplate(id: string): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0];
}

export const EHR_FIELDS: Record<EhrLayout, string[]> = {
  generic: ['Wywiad', 'Badanie przedmiotowe', 'Rozpoznanie', 'Zalecenia'],
  soap: ['S', 'O', 'A', 'P'],
};
