import { z } from 'zod';

/**
 * Schematy odpowiedzi modeli (ustrukturyzowane wyjście). Każde pole, które trafia do rekordu,
 * jest potem sprawdzane deterministycznie (wartość musi wystąpić w źródle).
 */

export const LabExtractSchema = z.object({
  laboratory: z.string().nullable(),
  collectedAt: z.string().nullable().describe('Data pobrania materiału dokładnie jak w dokumencie (np. 2026-09-14 albo 14.09.2026)'),
  items: z.array(
    z.object({
      name: z.string().describe('Nazwa badania dokładnie jak w dokumencie'),
      value: z.string().describe('Wynik dokładnie jak w dokumencie, łącznie ze znakami < >'),
      unit: z.string().nullable(),
      referenceRange: z.string().nullable().describe('Zakres referencyjny dokładnie jak w dokumencie'),
      flag: z.string().nullable().describe('Oznaczenie laboratorium przy wyniku (H, L, *, ↑, ↓) albo null'),
      line: z.number().describe('Numer linii (Lnnn), z której pochodzi wynik'),
    }),
  ),
});
export type LabExtract = z.infer<typeof LabExtractSchema>;

export const DocStructureSchema = z.object({
  documentType: z.enum(['karta-wypisowa', 'recepta', 'zaswiadczenie', 'skierowanie', 'opis-badania', 'inny']),
  issuedAt: z.string().nullable(),
  issuer: z.string().nullable().describe('Placówka albo lekarz wystawiający, dokładnie jak w dokumencie'),
  sections: z.array(
    z.object({
      title: z.string().describe('Nagłówek sekcji jak w dokumencie albo opisowy (np. Rozpoznanie, Zalecenia, Leki)'),
      lines: z.array(z.number()).describe('Numery linii (Lnnn) zawierające treść sekcji'),
    }),
  ),
  accessCode: z.string().nullable().describe('Kod dostępu e-recepty/e-skierowania, jeśli jest w dokumencie'),
});
export type DocStructure = z.infer<typeof DocStructureSchema>;

export const ScribeNoteSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      paragraphs: z.array(
        z.object({
          text: z.string(),
          sources: z.array(z.string()).describe('Identyfikatory fragmentów rozmowy, np. S3'),
        }),
      ),
    }),
  ),
});
export type ScribeNote = z.infer<typeof ScribeNoteSchema>;

export const ScribeValidationSchema = z.object({
  paragraphs: z.array(
    z.object({
      id: z.string(),
      supported: z.boolean(),
      problems: z.array(z.string()),
    }),
  ),
});
export type ScribeValidation = z.infer<typeof ScribeValidationSchema>;

export const PatientSummarySchema = z.object({
  whatWasDone: z.array(z.string()),
  nextSteps: z.array(z.string()),
  whenToReturn: z.string().nullable(),
  warningSigns: z.array(z.string()).describe('Tylko objawy, przy których lekarz w notatce kazał się zgłosić'),
});
export type PatientSummary = z.infer<typeof PatientSummarySchema>;
