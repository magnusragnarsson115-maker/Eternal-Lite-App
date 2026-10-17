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

export const NOTE_TEMPLATE_IDS = ['general', 'cardiology', 'pediatrics', 'soap', 'sbar'] as const;

export function getTemplate(id: string): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0];
}

export const EHR_FIELDS: Record<EhrLayout, string[]> = {
  generic: ['Wywiad', 'Badanie przedmiotowe', 'Rozpoznanie', 'Zalecenia'],
  soap: ['S', 'O', 'A', 'P'],
};
