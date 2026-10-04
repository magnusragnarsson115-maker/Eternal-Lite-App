/** Typy odpowiedzi API (odpowiadają widokom serwera). */

export type Role = 'patient' | 'practitioner' | 'reception' | 'admin';

export interface PatientView {
  id: string;
  ref: string;
  name: string;
  given: string;
  family: string;
  birthDate?: string;
  gender?: string;
  pesel?: string;
  phone?: string;
  email?: string;
  address?: { line?: string; postalCode?: string; city?: string };
  identityVerified: boolean;
  hasAccount: boolean;
  fictional: boolean;
  preferredLanguage?: string;
}

export interface PractitionerView {
  id: string;
  name: string;
  prefix?: string;
  specialty?: string;
  npwz?: string;
  serviceIds: string[];
  locationIds: string[];
  active: boolean;
  bio?: string;
}

export interface ServiceView {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  mode: 'in-person' | 'tele';
  price?: number;
  program?: string;
  preparation?: string;
  questionnaireId?: string;
  specialty?: string;
  active: boolean;
  locationIds: string[];
}

export interface LocationView {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Me {
  authenticated: boolean;
  csrfToken?: string;
  mfa?: { required: boolean; enrolled: boolean; enrollRequired: boolean };
  user?: {
    id: string;
    email: string;
    displayName: string;
    roles: Role[];
    staff: boolean;
    locale: 'pl' | 'en';
    emailVerified: boolean;
    mustChangePassword: boolean;
    status: string;
    fhirRef: string | null;
  };
  patient?: PatientView;
  practitioner?: PractitionerView;
}

export interface PublicConfig {
  demoMode: boolean;
  clinic: {
    name: string;
    phone: string;
    email: string;
    address: string;
    emergencyInfo: string;
    cancelMinHours: number;
    messageResponseDays: number;
    privacyContact: string;
  };
  vapidPublicKey: string;
  consents: { type: string; required: boolean; label: { pl: string; en: string } }[];
  consentPolicyVersion: string;
  passwordMinLength: number;
  fhirBackend: string;
  jitsiDomain: string;
  timezone: string;
}

export type AppointmentStatus = 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';

export interface AppointmentView {
  id: string;
  status: AppointmentStatus;
  start: string;
  end: string;
  minutesDuration: number;
  serviceId?: string;
  serviceName?: string;
  mode: 'in-person' | 'tele';
  practitionerId?: string;
  practitionerName?: string;
  locationId?: string;
  locationName?: string;
  patientId?: string;
  patientName?: string;
  comment?: string;
  preparation?: string;
  cancelReason?: string;
  cancelledBy?: 'patient' | 'staff';
  created?: string;
  slotId?: string;
  questionnaireId?: string;
  canCancelOnline: boolean;
  cancelDeadline: string;
  teleRoom?: boolean;
}

export interface SlotView {
  id: string;
  start: string;
  end: string;
  status: 'free' | 'busy' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error';
  practitionerId: string;
  practitionerName: string;
  serviceIds: string[];
  comment?: string;
}

export interface ObservationRow {
  id: string;
  name: string;
  loinc?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  labFlag?: string;
}

export interface RecordView {
  id: string;
  ref: string;
  type: 'report' | 'document';
  title: string;
  category: string;
  date: string;
  author?: string;
  laboratory?: string;
  shared: boolean;
  sharedAt?: string;
  readAt?: string;
  conclusion?: string;
  text?: string;
  attachment?: { binaryId: string; contentType: string; title?: string; size?: number };
  observations?: ObservationRow[];
  patientId: string;
}

export interface MessageView {
  id: string;
  threadId: string;
  from: 'patient' | 'clinic';
  senderName: string;
  body: string;
  sent: string;
}

export interface ThreadView {
  id: string;
  subject: string;
  category: 'administrative' | 'prescription' | 'results' | 'question';
  patientId: string;
  patientName: string;
  lastMessageAt: string;
  lastFrom: 'patient' | 'clinic';
  unread: boolean;
  messages?: MessageView[];
}

export type VitalKind = 'bp' | 'heartRate' | 'weight' | 'height' | 'temperature' | 'spo2' | 'glucose';

export interface MeasurementView {
  id: string;
  kind: VitalKind;
  effective: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit: string;
  source: string;
  device?: string;
  note?: string;
}

export interface MedicationView {
  id: string;
  name: string;
  rplId?: string;
  dosage?: string;
  since?: string;
  status: string;
  reportedAt: string;
}

export interface ConsentState {
  type: string;
  granted: boolean;
  required: boolean;
  label: { pl: string; en: string };
  updatedAt?: string;
  policyVersion?: string;
  id?: string;
}

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface QuestionnaireItem {
  linkId: string;
  type: string;
  text?: string;
  required?: boolean;
  repeats?: boolean;
  answerOption?: { valueCoding?: { code?: string; display?: string }; valueString?: string }[];
  enableWhen?: { question: string; operator: string; answerBoolean?: boolean; answerString?: string; answerCoding?: { code?: string } }[];
  enableBehavior?: 'all' | 'any';
  item?: QuestionnaireItem[];
}

export interface Questionnaire {
  id: string;
  title?: string;
  description?: string;
  item?: QuestionnaireItem[];
}

export interface AccessLogEntry {
  at: string;
  who: string;
  role: string;
  action: string;
  subtype: string;
  resource?: string;
}
