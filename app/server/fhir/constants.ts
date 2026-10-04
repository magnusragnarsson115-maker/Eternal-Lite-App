/** Systemy identyfikatorów i kodowań używane w zasobach FHIR. */

/** PESEL — OID nadany przez CSIOZ/CeZ (PIK HL7 CDA / FHIR PL). */
export const PESEL_SYSTEM = 'urn:oid:2.16.840.1.113883.3.4424.1.1.616';
/** Numer prawa wykonywania zawodu lekarza (NPWZ). */
export const NPWZ_SYSTEM = 'urn:oid:2.16.840.1.113883.3.4424.1.6.2';

export const LOINC = 'http://loinc.org';
export const UCUM = 'http://unitsofmeasure.org';
export const ICD10 = 'http://hl7.org/fhir/sid/icd-10';
export const SNOMED = 'http://snomed.info/sct';
export const OBS_CATEGORY = 'http://terminology.hl7.org/CodeSystem/observation-category';
export const V2_0074 = 'http://terminology.hl7.org/CodeSystem/v2-0074';
export const CONSENT_SCOPE = 'http://terminology.hl7.org/CodeSystem/consentscope';
export const CONSENT_CATEGORY = 'http://loinc.org';
export const ACT_REASON = 'http://terminology.hl7.org/CodeSystem/v3-ActReason';
export const DOC_TYPE = 'http://loinc.org';
export const APPOINTMENT_CANCEL_REASON = 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason';
export const SERVICE_MODE = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode';

/** Własne systemy aplikacji. */
export const ETERNAL = {
  visibility: 'urn:eternal:visibility',
  identity: 'urn:eternal:identity',
  data: 'urn:eternal:data',
  source: 'urn:eternal:source',
  consentType: 'urn:eternal:consent-type',
  activation: 'urn:eternal:activation-code',
  visitMode: 'urn:eternal:visit-mode',
  price: 'urn:eternal:price',
  thread: 'urn:eternal:thread',
  ext: {
    readByPatient: 'urn:eternal:ext:read-by-patient',
    sharedAt: 'urn:eternal:ext:shared-at',
    sharedBy: 'urn:eternal:ext:shared-by',
    appointment: 'urn:eternal:ext:appointment',
    teleRoom: 'urn:eternal:ext:tele-room',
    preparation: 'urn:eternal:ext:preparation',
    questionnaire: 'urn:eternal:ext:questionnaire',
    durationMinutes: 'urn:eternal:ext:duration-minutes',
    readByStaff: 'urn:eternal:ext:read-by-staff',
    device: 'urn:eternal:ext:device',
  },
} as const;

export const TAG_PATIENT_VISIBLE = { system: ETERNAL.visibility, code: 'patient-visible', display: 'Udostępnione pacjentowi' };
export const TAG_IDENTITY_VERIFIED = { system: ETERNAL.identity, code: 'verified', display: 'Tożsamość potwierdzona' };
export const TAG_FICTIONAL = { system: ETERNAL.data, code: 'fictional', display: 'Dane fikcyjne' };

/** Kody LOINC parametrów mierzonych samodzielnie (profil FHIR Vital Signs). */
export const VITALS = {
  bpPanel: { code: '85354-9', display: 'Blood pressure panel with all children optional', pl: 'Ciśnienie tętnicze' },
  systolic: { code: '8480-6', display: 'Systolic blood pressure', pl: 'Ciśnienie skurczowe', unit: 'mm[Hg]', unitDisplay: 'mmHg' },
  diastolic: { code: '8462-4', display: 'Diastolic blood pressure', pl: 'Ciśnienie rozkurczowe', unit: 'mm[Hg]', unitDisplay: 'mmHg' },
  heartRate: { code: '8867-4', display: 'Heart rate', pl: 'Tętno', unit: '/min', unitDisplay: '/min' },
  weight: { code: '29463-7', display: 'Body weight', pl: 'Masa ciała', unit: 'kg', unitDisplay: 'kg' },
  height: { code: '8302-2', display: 'Body height', pl: 'Wzrost', unit: 'cm', unitDisplay: 'cm' },
  temperature: { code: '8310-5', display: 'Body temperature', pl: 'Temperatura ciała', unit: 'Cel', unitDisplay: '°C' },
  spo2: { code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry', pl: 'Saturacja (SpO₂)', unit: '%', unitDisplay: '%' },
  glucose: { code: '2339-0', display: 'Glucose [Mass/volume] in Blood', pl: 'Glukoza we krwi', unit: 'mg/dL', unitDisplay: 'mg/dL' },
} as const;

export type VitalKind = 'bp' | 'heartRate' | 'weight' | 'height' | 'temperature' | 'spo2' | 'glucose';

/** Rodzaje zgód zbieranych przez aplikację (Consent.category / ETERNAL.consentType). */
export const CONSENT_TYPES = {
  terms: { required: true, pl: 'Akceptacja regulaminu świadczenia usług drogą elektroniczną', en: 'Acceptance of the terms of electronic services' },
  privacy: { required: true, pl: 'Zapoznanie się z informacją o przetwarzaniu danych (art. 13 RODO)', en: 'Acknowledgement of the privacy notice (Art. 13 GDPR)' },
  'results-online': { required: false, pl: 'Udostępnianie wyników i dokumentacji w aplikacji', en: 'Access to results and records in the app' },
  'reminders-email': { required: false, pl: 'Przypomnienia o wizytach e-mailem', en: 'Appointment reminders by e-mail' },
  'reminders-sms': { required: false, pl: 'Przypomnienia o wizytach SMS-em', en: 'Appointment reminders by SMS' },
  'reminders-push': { required: false, pl: 'Powiadomienia push w przeglądarce/telefonie', en: 'Push notifications' },
  telemedicine: { required: false, pl: 'Udział w teleporadach (wideo)', en: 'Participation in video consultations' },
  'share-measurements': { required: false, pl: 'Przekazywanie pomiarów domowych do placówki', en: 'Sharing home measurements with the clinic' },
} as const;

export type ConsentType = keyof typeof CONSENT_TYPES;
