/**
 * Usunięcie identyfikatorów przed wysłaniem tekstu do modelu językowego (R5): PESEL, e-mail, telefon.
 * Model nie potrzebuje ich do odczytu dokumentu, szkicu notatki ani karty — w odpowiedzi zostają znaczniki.
 */
export function redactIdentifiers(text: string): string {
  return text
    .replace(/\b\d{11}\b/g, '[PESEL]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[E-MAIL]')
    .replace(/(?:\+48[\s-]?)?\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/g, '[TELEFON]');
}
