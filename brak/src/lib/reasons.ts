export const REASONS = [
  { value: "BRAK_NA_STANIE", label: "Brak na stanie" },
  { value: "WYCOFANY_Z_OFERTY", label: "Wycofany z oferty" },
  { value: "ZA_DROGO", label: "Klient uznał, że za drogo" },
  { value: "INNY", label: "Inny powód" },
] as const;

export type ReasonValue = (typeof REASONS)[number]["value"];

export function reasonLabel(value: string | null): string {
  return REASONS.find((r) => r.value === value)?.label ?? "—";
}
