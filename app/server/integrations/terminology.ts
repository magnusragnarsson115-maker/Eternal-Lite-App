import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import { cacheGet, cacheSet } from '../settings.js';

/**
 * Terminologie: LOINC (badania), ICD-10 / ICD-11 (rozpoznania).
 * - NLM Clinical Tables (bezpłatne, bez klucza): LOINC, ICD-10-CM.
 * - WHO ICD-11 API (bezpłatne po rejestracji: ICD11_CLIENT_ID/SECRET).
 * - Lokalny słownik najczęstszych badań z polskimi nazwami — działa bez sieci.
 */

export interface CodeHit {
  code: string;
  display: string;
  displayPl?: string;
  unit?: string;
  system: string;
  source: 'local' | 'nlm' | 'who';
}

/** Najczęściej zlecane badania laboratoryjne — kody LOINC, nazwy PL, jednostki UCUM. */
export const COMMON_LAB_TESTS: { code: string; display: string; pl: string; unit?: string }[] = [
  { code: '58410-2', display: 'CBC panel - Blood by Automated count', pl: 'Morfologia krwi (panel)' },
  { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood', pl: 'Hemoglobina (HGB)', unit: 'g/dL' },
  { code: '6690-2', display: 'Leukocytes [#/volume] in Blood by Automated count', pl: 'Leukocyty (WBC)', unit: '10*3/uL' },
  { code: '789-8', display: 'Erythrocytes [#/volume] in Blood by Automated count', pl: 'Erytrocyty (RBC)', unit: '10*6/uL' },
  { code: '777-3', display: 'Platelets [#/volume] in Blood by Automated count', pl: 'Płytki krwi (PLT)', unit: '10*3/uL' },
  { code: '4544-3', display: 'Hematocrit [Volume Fraction] of Blood by Automated count', pl: 'Hematokryt (HCT)', unit: '%' },
  { code: '787-2', display: 'MCV [Entitic volume] by Automated count', pl: 'MCV', unit: 'fL' },
  { code: '30341-2', display: 'Erythrocyte sedimentation rate', pl: 'OB (odczyn Biernackiego)', unit: 'mm/h' },
  { code: '1988-5', display: 'C reactive protein [Mass/volume] in Serum or Plasma', pl: 'CRP', unit: 'mg/L' },
  { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma', pl: 'Glukoza', unit: 'mg/dL' },
  { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood', pl: 'Hemoglobina glikowana (HbA1c)', unit: '%' },
  { code: '24331-1', display: 'Lipid 1996 panel - Serum or Plasma', pl: 'Lipidogram (panel)' },
  { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma', pl: 'Cholesterol całkowity', unit: 'mg/dL' },
  { code: '2085-9', display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', pl: 'Cholesterol HDL', unit: 'mg/dL' },
  { code: '13457-7', display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation', pl: 'Cholesterol LDL (wyliczany)', unit: 'mg/dL' },
  { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma', pl: 'Triglicerydy', unit: 'mg/dL' },
  { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma', pl: 'Kreatynina', unit: 'mg/dL' },
  { code: '62238-1', display: 'Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI)', pl: 'eGFR (CKD-EPI)', unit: 'mL/min/{1.73_m2}' },
  { code: '3084-1', display: 'Urate [Mass/volume] in Serum or Plasma', pl: 'Kwas moczowy', unit: 'mg/dL' },
  { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma', pl: 'Potas', unit: 'mmol/L' },
  { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma', pl: 'Sód', unit: 'mmol/L' },
  { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma', pl: 'Wapń całkowity', unit: 'mg/dL' },
  { code: '2601-3', display: 'Magnesium [Mass/volume] in Serum or Plasma', pl: 'Magnez', unit: 'mg/dL' },
  { code: '1742-6', display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', pl: 'ALT (AlAT)', unit: 'U/L' },
  { code: '1920-8', display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', pl: 'AST (AspAT)', unit: 'U/L' },
  { code: '2324-2', display: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma', pl: 'GGTP', unit: 'U/L' },
  { code: '6768-6', display: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma', pl: 'Fosfataza zasadowa (ALP)', unit: 'U/L' },
  { code: '1975-2', display: 'Bilirubin.total [Mass/volume] in Serum or Plasma', pl: 'Bilirubina całkowita', unit: 'mg/dL' },
  { code: '1751-7', display: 'Albumin [Mass/volume] in Serum or Plasma', pl: 'Albumina', unit: 'g/dL' },
  { code: '2885-2', display: 'Protein [Mass/volume] in Serum or Plasma', pl: 'Białko całkowite', unit: 'g/dL' },
  { code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma', pl: 'TSH', unit: 'u[IU]/mL' },
  { code: '3024-7', display: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma', pl: 'FT4', unit: 'ng/dL' },
  { code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma', pl: 'Ferrytyna', unit: 'ng/mL' },
  { code: '2498-4', display: 'Iron [Mass/volume] in Serum or Plasma', pl: 'Żelazo', unit: 'ug/dL' },
  { code: '62292-8', display: '25-hydroxyvitamin D2+D3 [Mass/volume] in Serum or Plasma', pl: 'Witamina D (25-OH D2+D3)', unit: 'ng/mL' },
  { code: '2132-9', display: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma', pl: 'Witamina B12', unit: 'pg/mL' },
  { code: '6301-6', display: 'INR in Platelet poor plasma by Coagulation assay', pl: 'INR' },
  { code: '2857-1', display: 'Prostate specific Ag [Mass/volume] in Serum or Plasma', pl: 'PSA całkowity', unit: 'ng/mL' },
  { code: '24356-8', display: 'Urinalysis complete panel - Urine', pl: 'Badanie ogólne moczu (panel)' },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');
}

export function searchLocalLab(term: string, limit = 15): CodeHit[] {
  const t = norm(term.trim());
  if (!t) return [];
  return COMMON_LAB_TESTS.filter((x) => x.code.startsWith(term.trim()) || norm(x.pl).includes(t) || norm(x.display).includes(t))
    .slice(0, limit)
    .map((x) => ({ code: x.code, display: x.display, displayPl: x.pl, unit: x.unit, system: 'http://loinc.org', source: 'local' as const }));
}

/** Format odpowiedzi NLM Clinical Tables: [total, codes[], extra|null, display[][]] */
export function parseClinicalTables(json: unknown): { code: string; display: string }[] {
  if (!Array.isArray(json) || json.length < 4) return [];
  const codes = json[1] as string[];
  const displays = json[3] as string[][];
  return codes.map((code, i) => ({ code, display: (displays[i] ?? []).filter((d) => d !== code).join(' — ') || code }));
}

async function nlm(path: string, params: Record<string, string>): Promise<{ code: string; display: string }[]> {
  if (!config.publicApis.nlm) return [];
  const q = new URLSearchParams(params).toString();
  const key = `nlm:${path}?${q}`;
  const cached = cacheGet<{ code: string; display: string }[]>(key);
  if (cached) return cached;
  const res = await fetchWithTimeout(`https://clinicaltables.nlm.nih.gov/api/${path}?${q}`, {}, config.publicApis.timeoutMs);
  if (!res.ok) throw new Error(`NLM Clinical Tables returned ${res.status}`);
  const parsed = parseClinicalTables(await res.json());
  cacheSet(key, parsed, 7 * 24 * 3600);
  return parsed;
}

export async function searchLoinc(term: string): Promise<{ hits: CodeHit[]; remoteError?: string }> {
  const local = searchLocalLab(term);
  if (term.trim().length < 3) return { hits: local };
  try {
    const remote = await nlm('loinc_items/v3/search', { terms: term.trim(), df: 'LOINC_NUM,LONG_COMMON_NAME', maxList: '15' });
    const seen = new Set(local.map((h) => h.code));
    return {
      hits: [
        ...local,
        ...remote.filter((r) => !seen.has(r.code)).map((r) => ({ code: r.code, display: r.display, system: 'http://loinc.org', source: 'nlm' as const })),
      ],
    };
  } catch (err) {
    return { hits: local, remoteError: (err as Error).message };
  }
}

export async function searchIcd10(term: string): Promise<{ hits: CodeHit[]; remoteError?: string }> {
  if (term.trim().length < 2) return { hits: [] };
  try {
    const remote = await nlm('icd10cm/v3/search', { sf: 'code,name', df: 'code,name', terms: term.trim(), maxList: '15' });
    return { hits: remote.map((r) => ({ code: r.code, display: r.display, system: 'http://hl7.org/fhir/sid/icd-10-cm', source: 'nlm' as const })) };
  } catch (err) {
    return { hits: [], remoteError: (err as Error).message };
  }
}

// --- WHO ICD-11 ---------------------------------------------------------------------------------

let icdToken: { value: string; expiresAt: number } | undefined;

export function icd11Configured(): boolean {
  return !!(config.icd11.clientId && config.icd11.clientSecret);
}

async function icd11AccessToken(): Promise<string> {
  if (icdToken && icdToken.expiresAt > Date.now() + 60_000) return icdToken.value;
  const res = await fetchWithTimeout(
    'https://icdaccessmanagement.who.int/connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'icdapi_access',
        client_id: config.icd11.clientId,
        client_secret: config.icd11.clientSecret,
      }),
    },
    config.publicApis.timeoutMs,
  );
  if (!res.ok) throw new Error(`WHO token endpoint returned ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  icdToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return icdToken.value;
}

export function stripEm(s: string): string {
  return s.replace(/<\/?em[^>]*>/g, '');
}

export async function searchIcd11(term: string, language = 'en'): Promise<{ hits: CodeHit[]; remoteError?: string }> {
  if (!icd11Configured()) return { hits: [], remoteError: 'ICD11_CLIENT_ID/ICD11_CLIENT_SECRET not configured' };
  if (term.trim().length < 2) return { hits: [] };
  try {
    const token = await icd11AccessToken();
    const q = new URLSearchParams({ q: term.trim(), flatResults: 'true', highlightingEnabled: 'false' });
    const res = await fetchWithTimeout(
      `https://id.who.int/icd/release/11/${config.icd11.release}/mms/search?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Language': language, 'API-Version': 'v2' } },
      config.publicApis.timeoutMs,
    );
    if (!res.ok) throw new Error(`WHO ICD API returned ${res.status}`);
    const json = (await res.json()) as { destinationEntities?: { theCode?: string; title?: string; id?: string }[] };
    return {
      hits: (json.destinationEntities ?? [])
        .filter((e) => e.theCode)
        .slice(0, 15)
        .map((e) => ({ code: e.theCode ?? '', display: stripEm(e.title ?? ''), system: 'http://id.who.int/icd/release/11/mms', source: 'who' as const })),
    };
  } catch (err) {
    return { hits: [], remoteError: (err as Error).message };
  }
}
