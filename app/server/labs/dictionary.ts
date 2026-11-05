/**
 * Słownik polskich nazw badań laboratoryjnych → LOINC, jednostki w UCUM (moduł K4, Mapping Engine).
 * Wersja robocza do weryfikacji przez redaktora medycznego przed pilotażem (plik 12.8, A3 poz. 8:
 * „słownik nazw badań z najczęstszych laboratoriów”). Kody LOINC dla oznaczeń w surowicy/osoczu
 * i krwi pełnej — przy innym materiale (np. mocz) wpis musi mieć osobny kod.
 */

export const DICTIONARY_VERSION = 'lab-dict/2026-10-1';

export interface LabTestDef {
  key: string;
  /** Nazwa wyświetlana po polsku. */
  pl: string;
  loinc: string;
  loincDisplay: string;
  /** Jednostki UCUM dopuszczalne dla tego badania (pierwsza = typowa w polskich laboratoriach). */
  units: string[];
  /** Nazwy i skróty spotykane na wynikach (bez polskich znaków i interpunkcji porównujemy po normalizacji). */
  names: string[];
}

export const LAB_TESTS: LabTestDef[] = [
  // morfologia
  { key: 'wbc', pl: 'Leukocyty (WBC)', loinc: '6690-2', loincDisplay: 'Leukocytes [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['WBC', 'Leukocyty', 'Krwinki białe', 'Leukocyty WBC', 'WBC Leukocyty'] },
  { key: 'rbc', pl: 'Erytrocyty (RBC)', loinc: '789-8', loincDisplay: 'Erythrocytes [#/volume] in Blood by Automated count', units: ['10*6/uL', '10*12/L'], names: ['RBC', 'Erytrocyty', 'Krwinki czerwone', 'RBC Erytrocyty', 'Erytrocyty RBC'] },
  { key: 'hgb', pl: 'Hemoglobina (HGB)', loinc: '718-7', loincDisplay: 'Hemoglobin [Mass/volume] in Blood', units: ['g/dL', 'g/L', 'mmol/L'], names: ['HGB', 'Hemoglobina', 'Hb', 'HGB Hemoglobina', 'Hemoglobina HGB'] },
  { key: 'hct', pl: 'Hematokryt (HCT)', loinc: '4544-3', loincDisplay: 'Hematocrit [Volume Fraction] of Blood by Automated count', units: ['%', 'L/L'], names: ['HCT', 'Hematokryt', 'Ht', 'HCT Hematokryt', 'Hematokryt HCT'] },
  { key: 'mcv', pl: 'MCV', loinc: '787-2', loincDisplay: 'MCV [Entitic volume] by Automated count', units: ['fL'], names: ['MCV', 'Średnia objętość krwinki', 'Średnia objętość erytrocytu'] },
  { key: 'mch', pl: 'MCH', loinc: '785-6', loincDisplay: 'MCH [Entitic mass] by Automated count', units: ['pg'], names: ['MCH', 'Średnia masa hemoglobiny w krwince'] },
  { key: 'mchc', pl: 'MCHC', loinc: '786-4', loincDisplay: 'MCHC [Mass/volume] by Automated count', units: ['g/dL', 'g/L', 'mmol/L'], names: ['MCHC', 'Średnie stężenie hemoglobiny w krwince'] },
  { key: 'rdw', pl: 'RDW', loinc: '788-0', loincDisplay: 'Erythrocyte distribution width [Ratio] by Automated count', units: ['%'], names: ['RDW', 'RDW-CV', 'RDW CV'] },
  { key: 'plt', pl: 'Płytki krwi (PLT)', loinc: '777-3', loincDisplay: 'Platelets [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['PLT', 'Płytki krwi', 'Trombocyty', 'PLT Płytki krwi', 'Płytki krwi PLT'] },
  { key: 'mpv', pl: 'MPV', loinc: '32623-1', loincDisplay: 'Platelet mean volume [Entitic volume] in Blood by Automated count', units: ['fL'], names: ['MPV', 'Średnia objętość płytki'] },
  { key: 'neut_abs', pl: 'Neutrofile', loinc: '751-8', loincDisplay: 'Neutrophils [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['Neutrofile', 'NEU', 'NEUT', 'Granulocyty obojętnochłonne', 'NEUT#', 'NEU#'] },
  { key: 'neut_pct', pl: 'Neutrofile %', loinc: '770-8', loincDisplay: 'Neutrophils/100 leukocytes in Blood by Automated count', units: ['%'], names: ['Neutrofile %', 'NEU %', 'NEUT %', 'NEUT%', 'NEU%'] },
  { key: 'lymph_abs', pl: 'Limfocyty', loinc: '731-0', loincDisplay: 'Lymphocytes [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['Limfocyty', 'LYM', 'LYMPH', 'LYM#', 'LYMPH#'] },
  { key: 'lymph_pct', pl: 'Limfocyty %', loinc: '736-9', loincDisplay: 'Lymphocytes/100 leukocytes in Blood by Automated count', units: ['%'], names: ['Limfocyty %', 'LYM %', 'LYMPH %', 'LYM%', 'LYMPH%'] },
  { key: 'mono_abs', pl: 'Monocyty', loinc: '742-7', loincDisplay: 'Monocytes [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['Monocyty', 'MONO', 'MON', 'MONO#', 'MON#'] },
  { key: 'mono_pct', pl: 'Monocyty %', loinc: '5905-5', loincDisplay: 'Monocytes/100 leukocytes in Blood by Automated count', units: ['%'], names: ['Monocyty %', 'MONO %', 'MON %', 'MONO%', 'MON%'] },
  { key: 'eos_abs', pl: 'Eozynofile', loinc: '711-2', loincDisplay: 'Eosinophils [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['Eozynofile', 'EOS', 'EOS#'] },
  { key: 'eos_pct', pl: 'Eozynofile %', loinc: '713-8', loincDisplay: 'Eosinophils/100 leukocytes in Blood by Automated count', units: ['%'], names: ['Eozynofile %', 'EOS %', 'EOS%'] },
  { key: 'baso_abs', pl: 'Bazofile', loinc: '704-7', loincDisplay: 'Basophils [#/volume] in Blood by Automated count', units: ['10*3/uL', '10*9/L'], names: ['Bazofile', 'BASO', 'BAS', 'BASO#'] },
  { key: 'baso_pct', pl: 'Bazofile %', loinc: '706-2', loincDisplay: 'Basophils/100 leukocytes in Blood by Automated count', units: ['%'], names: ['Bazofile %', 'BASO %', 'BAS %', 'BASO%'] },
  // biochemia i lipidy
  { key: 'glucose', pl: 'Glukoza', loinc: '2345-7', loincDisplay: 'Glucose [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Glukoza', 'Glukoza na czczo', 'Glukoza w surowicy', 'Glucose', 'GLU'] },
  { key: 'hba1c', pl: 'Hemoglobina glikowana (HbA1c)', loinc: '4548-4', loincDisplay: 'Hemoglobin A1c/Hemoglobin.total in Blood', units: ['%', 'mmol/mol'], names: ['HbA1c', 'Hemoglobina glikowana', 'Hemoglobina glikowana HbA1c', 'HbA1c hemoglobina glikowana'] },
  { key: 'chol', pl: 'Cholesterol całkowity', loinc: '2093-3', loincDisplay: 'Cholesterol [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Cholesterol całkowity', 'Cholesterol', 'Chol. całkowity', 'Cholesterol calk', 'CHOL', 'TC'] },
  { key: 'hdl', pl: 'Cholesterol HDL', loinc: '2085-9', loincDisplay: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Cholesterol HDL', 'HDL', 'HDL cholesterol', 'HDL-cholesterol', 'Cholesterol frakcji HDL'] },
  { key: 'ldl', pl: 'Cholesterol LDL', loinc: '13457-7', loincDisplay: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation', units: ['mg/dL', 'mmol/L'], names: ['Cholesterol LDL', 'LDL', 'LDL cholesterol', 'LDL-cholesterol', 'Cholesterol LDL wyliczony', 'Cholesterol frakcji LDL'] },
  { key: 'nonhdl', pl: 'Cholesterol nie-HDL', loinc: '43396-1', loincDisplay: 'Cholesterol non HDL [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Cholesterol nie-HDL', 'nie-HDL', 'non-HDL', 'Cholesterol non-HDL'] },
  { key: 'tg', pl: 'Triglicerydy', loinc: '2571-8', loincDisplay: 'Triglyceride [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Triglicerydy', 'Trójglicerydy', 'TG', 'TRIG'] },
  { key: 'creat', pl: 'Kreatynina', loinc: '2160-0', loincDisplay: 'Creatinine [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'umol/L'], names: ['Kreatynina', 'Kreatynina w surowicy', 'CREA', 'Creatinine'] },
  { key: 'egfr', pl: 'eGFR', loinc: '98979-8', loincDisplay: 'Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI 2021)', units: ['mL/min/{1.73_m2}'], names: ['eGFR', 'GFR', 'eGFR CKD-EPI', 'Wskaźnik eGFR', 'eGFR wg CKD-EPI'] },
  { key: 'urea', pl: 'Mocznik', loinc: '3091-6', loincDisplay: 'Urea [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Mocznik', 'Urea', 'UREA'] },
  { key: 'urate', pl: 'Kwas moczowy', loinc: '3084-1', loincDisplay: 'Urate [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'umol/L'], names: ['Kwas moczowy', 'UA', 'Uric acid'] },
  { key: 'alt', pl: 'ALT', loinc: '1742-6', loincDisplay: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['ALT', 'ALAT', 'Aminotransferaza alaninowa', 'ALT aminotransferaza alaninowa', 'GPT'] },
  { key: 'ast', pl: 'AST', loinc: '1920-8', loincDisplay: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['AST', 'AspAT', 'Aminotransferaza asparaginianowa', 'AST aminotransferaza asparaginianowa', 'GOT'] },
  { key: 'ggt', pl: 'GGTP', loinc: '2324-2', loincDisplay: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['GGTP', 'GGT', 'Gamma-glutamylotranspeptydaza', 'Gammaglutamylotranspeptydaza'] },
  { key: 'alp', pl: 'Fosfataza zasadowa', loinc: '6768-6', loincDisplay: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['Fosfataza zasadowa', 'ALP', 'FA', 'Fosfataza alkaliczna'] },
  { key: 'bili', pl: 'Bilirubina całkowita', loinc: '1975-2', loincDisplay: 'Bilirubin.total [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'umol/L'], names: ['Bilirubina całkowita', 'Bilirubina', 'BIL', 'Bilirubina całk'] },
  { key: 'bili_d', pl: 'Bilirubina bezpośrednia', loinc: '1968-7', loincDisplay: 'Bilirubin.direct [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'umol/L'], names: ['Bilirubina bezpośrednia', 'Bilirubina sprzężona'] },
  { key: 'tp', pl: 'Białko całkowite', loinc: '2885-2', loincDisplay: 'Protein [Mass/volume] in Serum or Plasma', units: ['g/dL', 'g/L'], names: ['Białko całkowite', 'Białko całk', 'TP'] },
  { key: 'alb', pl: 'Albumina', loinc: '1751-7', loincDisplay: 'Albumin [Mass/volume] in Serum or Plasma', units: ['g/dL', 'g/L'], names: ['Albumina', 'Albuminy', 'ALB'] },
  { key: 'ck', pl: 'Kinaza kreatynowa (CK)', loinc: '2157-6', loincDisplay: 'Creatine kinase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['CK', 'Kinaza kreatynowa', 'CPK'] },
  { key: 'ldh', pl: 'LDH', loinc: '2532-0', loincDisplay: 'Lactate dehydrogenase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['LDH', 'Dehydrogenaza mleczanowa'] },
  { key: 'amylase', pl: 'Amylaza', loinc: '1798-8', loincDisplay: 'Amylase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['Amylaza', 'Alfa-amylaza', 'AMY'] },
  { key: 'lipase', pl: 'Lipaza', loinc: '3040-3', loincDisplay: 'Lipase [Enzymatic activity/volume] in Serum or Plasma', units: ['U/L'], names: ['Lipaza', 'LIP'] },
  // elektrolity i minerały
  { key: 'na', pl: 'Sód', loinc: '2951-2', loincDisplay: 'Sodium [Moles/volume] in Serum or Plasma', units: ['mmol/L'], names: ['Sód', 'Na', 'Na+', 'Sod'] },
  { key: 'k', pl: 'Potas', loinc: '2823-3', loincDisplay: 'Potassium [Moles/volume] in Serum or Plasma', units: ['mmol/L'], names: ['Potas', 'K', 'K+'] },
  { key: 'cl', pl: 'Chlorki', loinc: '2075-0', loincDisplay: 'Chloride [Moles/volume] in Serum or Plasma', units: ['mmol/L'], names: ['Chlorki', 'Cl', 'Cl-'] },
  { key: 'ca', pl: 'Wapń całkowity', loinc: '17861-6', loincDisplay: 'Calcium [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Wapń całkowity', 'Wapń', 'Ca', 'Wapn'] },
  { key: 'mg', pl: 'Magnez', loinc: '19123-9', loincDisplay: 'Magnesium [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Magnez', 'Mg'] },
  { key: 'phos', pl: 'Fosforany', loinc: '2777-1', loincDisplay: 'Phosphate [Mass/volume] in Serum or Plasma', units: ['mg/dL', 'mmol/L'], names: ['Fosforany', 'Fosfor', 'Fosfor nieorganiczny', 'P'] },
  { key: 'fe', pl: 'Żelazo', loinc: '2498-4', loincDisplay: 'Iron [Mass/volume] in Serum or Plasma', units: ['ug/dL', 'umol/L'], names: ['Żelazo', 'Fe', 'Zelazo', 'Żelazo w surowicy'] },
  { key: 'ferritin', pl: 'Ferrytyna', loinc: '2276-4', loincDisplay: 'Ferritin [Mass/volume] in Serum or Plasma', units: ['ng/mL', 'ug/L'], names: ['Ferrytyna', 'Ferritin', 'FERR'] },
  { key: 'tibc', pl: 'Całkowita zdolność wiązania żelaza (TIBC)', loinc: '2500-7', loincDisplay: 'Iron binding capacity [Mass/volume] in Serum or Plasma', units: ['ug/dL', 'umol/L'], names: ['TIBC', 'Całkowita zdolność wiązania żelaza'] },
  // tarczyca i hormony
  { key: 'tsh', pl: 'TSH', loinc: '3016-3', loincDisplay: 'Thyrotropin [Units/volume] in Serum or Plasma', units: ['u[IU]/mL', 'm[IU]/L'], names: ['TSH', 'Tyreotropina', 'TSH III generacji', 'TSH 3 generacji', 'hTSH'] },
  { key: 'ft4', pl: 'FT4', loinc: '3024-7', loincDisplay: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma', units: ['ng/dL', 'pmol/L'], names: ['FT4', 'fT4', 'Wolna tyroksyna', 'Tyroksyna wolna'] },
  { key: 'ft3', pl: 'FT3', loinc: '3051-0', loincDisplay: 'Triiodothyronine (T3) free [Mass/volume] in Serum or Plasma', units: ['pg/mL', 'pmol/L'], names: ['FT3', 'fT3', 'Wolna trójjodotyronina', 'Trijodotyronina wolna'] },
  { key: 'atpo', pl: 'Przeciwciała anty-TPO', loinc: '8099-4', loincDisplay: 'Thyroperoxidase Ab [Units/volume] in Serum or Plasma', units: ['[IU]/mL', 'U/mL'], names: ['Anty-TPO', 'aTPO', 'Przeciwciała anty-TPO', 'ATPO'] },
  { key: 'insulin', pl: 'Insulina', loinc: '20448-7', loincDisplay: 'Insulin [Units/volume] in Serum or Plasma', units: ['u[IU]/mL', 'm[IU]/L', 'pmol/L'], names: ['Insulina', 'Insulina na czczo'] },
  { key: 'cortisol', pl: 'Kortyzol', loinc: '2143-6', loincDisplay: 'Cortisol [Mass/volume] in Serum or Plasma', units: ['ug/dL', 'nmol/L'], names: ['Kortyzol', 'Kortyzol rano'] },
  { key: 'psa', pl: 'PSA całkowity', loinc: '2857-1', loincDisplay: 'Prostate specific Ag [Mass/volume] in Serum or Plasma', units: ['ng/mL'], names: ['PSA', 'PSA całkowity', 'tPSA', 'PSA całk'] },
  // witaminy
  { key: 'vitd', pl: 'Witamina D (25-OH)', loinc: '62292-8', loincDisplay: '25-Hydroxyvitamin D2+25-Hydroxyvitamin D3 [Mass/volume] in Serum or Plasma', units: ['ng/mL', 'nmol/L'], names: ['Witamina D', 'Witamina D 25-OH', '25-OH witamina D', '25(OH)D', 'Witamina D3 25-OH', '25-OH-D'] },
  { key: 'b12', pl: 'Witamina B12', loinc: '2132-9', loincDisplay: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma', units: ['pg/mL', 'pmol/L'], names: ['Witamina B12', 'B12', 'Kobalamina'] },
  { key: 'folate', pl: 'Kwas foliowy', loinc: '2284-8', loincDisplay: 'Folate [Mass/volume] in Serum or Plasma', units: ['ng/mL', 'nmol/L'], names: ['Kwas foliowy', 'Foliany'] },
  // stan zapalny, krzepnięcie, kardiologia
  { key: 'crp', pl: 'CRP', loinc: '1988-5', loincDisplay: 'C reactive protein [Mass/volume] in Serum or Plasma', units: ['mg/L', 'mg/dL'], names: ['CRP', 'Białko C-reaktywne', 'Białko CRP'] },
  { key: 'hscrp', pl: 'hs-CRP', loinc: '30522-7', loincDisplay: 'C reactive protein [Mass/volume] in Serum or Plasma by High sensitivity method', units: ['mg/L'], names: ['hs-CRP', 'hsCRP', 'CRP wysokoczułe'] },
  { key: 'esr', pl: 'OB', loinc: '30341-2', loincDisplay: 'Erythrocyte sedimentation rate', units: ['mm/h'], names: ['OB', 'Odczyn Biernackiego', 'ESR'] },
  { key: 'inr', pl: 'INR', loinc: '6301-6', loincDisplay: 'INR in Platelet poor plasma by Coagulation assay', units: ['{INR}'], names: ['INR', 'PT INR', 'Wskaźnik INR'] },
  { key: 'pt', pl: 'Czas protrombinowy', loinc: '5902-2', loincDisplay: 'Prothrombin time (PT)', units: ['s'], names: ['Czas protrombinowy', 'PT', 'Czas protrombinowy PT'] },
  { key: 'aptt', pl: 'APTT', loinc: '3173-2', loincDisplay: 'aPTT in Blood by Coagulation assay', units: ['s'], names: ['APTT', 'aPTT', 'Czas kaolinowo-kefalinowy'] },
  { key: 'fib', pl: 'Fibrynogen', loinc: '3255-7', loincDisplay: 'Fibrinogen [Mass/volume] in Platelet poor plasma by Coagulation assay', units: ['mg/dL', 'g/L'], names: ['Fibrynogen'] },
  { key: 'ddimer', pl: 'D-dimery', loinc: '48065-7', loincDisplay: 'Fibrin D-dimer FEU [Mass/volume] in Platelet poor plasma', units: ['ug/L', 'ng/mL', 'mg/L'], names: ['D-dimery', 'D-dimer', 'D dimery'] },
  { key: 'ntprobnp', pl: 'NT-proBNP', loinc: '33762-6', loincDisplay: 'Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma', units: ['pg/mL'], names: ['NT-proBNP', 'NTproBNP', 'NT pro BNP'] },
  { key: 'tnhs', pl: 'Troponina T hs', loinc: '67151-1', loincDisplay: 'Troponin T.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method', units: ['ng/L'], names: ['Troponina T hs', 'hs-TnT', 'Troponina T wysokoczuła'] },
  { key: 'tni', pl: 'Troponina I', loinc: '10839-9', loincDisplay: 'Troponin I.cardiac [Mass/volume] in Serum or Plasma', units: ['ng/mL', 'ng/L'], names: ['Troponina I', 'TnI', 'cTnI'] },
];

/** Normalizacja nazwy: małe litery, bez polskich znaków i interpunkcji, pojedyncze spacje. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9%#+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RAW_UNITS: [string[], string][] = [
  [['mg/dl'], 'mg/dL'],
  [['g/dl'], 'g/dL'],
  [['g/l'], 'g/L'],
  [['mg/l'], 'mg/L'],
  [['mmol/l'], 'mmol/L'],
  [['mmol/mol'], 'mmol/mol'],
  [['umol/l', 'µmol/l', 'μmol/l'], 'umol/L'],
  [['nmol/l'], 'nmol/L'],
  [['pmol/l'], 'pmol/L'],
  [['u/l', 'j/l', 'iu/l', 'j.m./l'], 'U/L'],
  [['u/ml', 'iu/ml', 'j.m./ml', 'j/ml'], '[IU]/mL'],
  [['uiu/ml', 'µiu/ml', 'μiu/ml', 'µu/ml', 'uu/ml', 'µj.m./ml', 'uj.m./ml', 'mj.m./l'], 'u[IU]/mL'],
  [['miu/l', 'mu/l', 'mj/l'], 'm[IU]/L'],
  [['ng/ml'], 'ng/mL'],
  [['ng/l'], 'ng/L'],
  [['ng/dl'], 'ng/dL'],
  [['pg/ml'], 'pg/mL'],
  [['ug/dl', 'µg/dl', 'μg/dl'], 'ug/dL'],
  [['ug/l', 'µg/l', 'μg/l'], 'ug/L'],
  [['%'], '%'],
  [['l/l'], 'L/L'],
  [['fl'], 'fL'],
  [['pg'], 'pg'],
  [['tys/ul', 'tys/µl', 'tys./µl', 'tys./ul', 'tys/μl', '10^3/ul', '10^3/µl', '10*3/ul', '10³/µl', '10³/ul', 'x10^3/ul', 'k/ul'], '10*3/uL'],
  [['10^9/l', '10*9/l', 'x10^9/l', '10⁹/l'], '10*9/L'],
  [['mln/ul', 'mln/µl', 'mln./µl', 'mln/μl', '10^6/ul', '10^6/µl', '10*6/ul', '10⁶/µl', 'x10^6/ul', 'm/ul'], '10*6/uL'],
  [['10^12/l', '10*12/l', 'x10^12/l', 't/l'], '10*12/L'],
  [['mm/h', 'mm/godz', 'mm/godz.', 'mm/1h', 'mm/1godz', 'mm/60min'], 'mm/h'],
  [['s', 'sek', 'sek.', 'sec'], 's'],
  [['ml/min/1,73m2', 'ml/min/1.73m2', 'ml/min/1,73 m2', 'ml/min/1.73 m2', 'ml/min/1,73m²', 'ml/min/1.73m²', 'ml/min'], 'mL/min/{1.73_m2}'],
  [['inr'], '{INR}'],
];

const UNIT_MAP = new Map<string, string>();
for (const [raws, ucum] of RAW_UNITS) for (const r of raws) UNIT_MAP.set(r, ucum);

/** Jednostka z dokumentu → UCUM (zapis w FHIR). undefined, gdy nie rozpoznano. */
export function toUcum(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/μ/g, 'µ');
  return UNIT_MAP.get(key) ?? UNIT_MAP.get(key.replace(/µ/g, 'u'));
}

export function isUnitToken(raw: string): boolean {
  return toUcum(raw) !== undefined;
}

// --- dopasowanie nazw ---------------------------------------------------------------------------

interface IndexEntry {
  norm: string;
  def: LabTestDef;
}
const INDEX: IndexEntry[] = LAB_TESTS.flatMap((def) => [def.pl, ...def.names].map((n) => ({ norm: normalizeName(n), def })));
const EXACT = new Map<string, LabTestDef>();
for (const e of INDEX) if (!EXACT.has(e.norm)) EXACT.set(e.norm, e.def);

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export interface NameMatch {
  def: LabTestDef;
  /** exact — nazwa ze słownika; fuzzy — poprawiony błąd odczytu (np. „Clukosa” → „Glukoza”). */
  kind: 'exact' | 'fuzzy';
  distance: number;
}

/** Dopasowanie nazwy z dokumentu do słownika: dokładne, po skrócie w nawiasie, potem rozmyte. */
export function matchTestName(raw: string): NameMatch | undefined {
  const candidates = new Set<string>([normalizeName(raw)]);
  // „Hemoglobina (HGB)” → „hemoglobina”, „hgb”
  const paren = raw.match(/^(.*?)\(([^)]+)\)(.*)$/);
  if (paren) {
    candidates.add(normalizeName(`${paren[1]} ${paren[3]}`));
    candidates.add(normalizeName(paren[2]));
  }
  for (const c of candidates) {
    const def = EXACT.get(c);
    if (def) return { def, kind: 'exact', distance: 0 };
  }
  let best: NameMatch | undefined;
  for (const c of candidates) {
    if (c.length < 4) continue; // skrótów nie poprawiamy rozmyto — za duże ryzyko pomyłki
    for (const e of INDEX) {
      if (e.norm.length < 4) continue;
      const d = levenshtein(c, e.norm);
      const limit = e.norm.length <= 5 ? 1 : e.norm.length <= 9 ? 2 : 3;
      if (d <= limit && (!best || d < best.distance)) best = { def: e.def, kind: 'fuzzy', distance: d };
    }
  }
  return best;
}
