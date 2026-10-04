import type { Appointment, Location, Organization, Questionnaire, Slot } from '@medplum/fhirtypes';
import type { AuditActor } from '../audit.js';
import { hashPassword } from '../auth/passwords.js';
import { createUser, findUserByEmail, updateUser } from '../auth/users.js';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { TAG_FICTIONAL } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { addDays, isoWeekday, localDate, zonedToUtc } from '../lib/time.js';
import { CONSENT_TYPES, type ConsentType } from '../fhir/constants.js';
import { setConsent } from '../services/consents.js';
import { ensureSchedule, invalidateDirectory, SERVICE_SYSTEM, updateClinicSettings, upsertPractitioner, upsertService } from '../services/directory.js';
import { addMedication } from '../services/medications.js';
import { reply, startThreadAsPatient } from '../services/messages.js';
import { addMeasurement } from '../services/observations.js';
import { createPatient } from '../services/patients.js';
import { createDocument, createReport, registerUpload, setShared } from '../services/records.js';
import { bookAppointment, createAvailability } from '../services/scheduling.js';
import { simplePdf } from './pdf.js';

/**
 * Dane demonstracyjne — WSZYSTKIE osoby, placówka, wyniki i terminy są fikcyjne.
 * Nie zawierają numerów PESEL ani NPWZ (każdy poprawny numer może należeć do realnej osoby).
 */

export const DEMO_PASSWORD = 'Eternal-Demo-2026';
/** Stały sekret TOTP kont personelu w trybie demo (wyłącznie dane fikcyjne!). */
export const DEMO_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const system: AuditActor = { display: 'seed-demo' };

export async function seedDemo(log: (m: string) => void = console.log): Promise<void> {
  if (!config.demoMode) throw new Error('Seed demonstracyjny wymaga DEMO_MODE=true');
  if (findUserByEmail('admin@eternal.local')) {
    log('Dane demonstracyjne już istnieją — pomijam.');
    return;
  }
  const tz = config.clinic.timezone;
  const today = localDate(new Date(), tz);

  // --- organizacja i lokalizacja ---
  const org = await fhir().create<Organization>({
    resourceType: 'Organization',
    active: true,
    name: 'Centrum Medyczne Eternal (fikcyjne)',
    meta: { tag: [TAG_FICTIONAL] },
    telecom: [{ system: 'phone', value: '+48 22 000 00 00' }, { system: 'email', value: 'rejestracja@eternal.local' }],
  });
  const loc = await fhir().create<Location>({
    resourceType: 'Location',
    status: 'active',
    name: 'Przychodnia — ul. Przykładowa 1',
    address: { line: ['ul. Przykładowa 1'], postalCode: '00-000', city: 'Warszawa', country: 'PL' },
    telecom: [{ system: 'phone', value: '+48 22 000 00 00' }],
    managingOrganization: { reference: `Organization/${org.id}` },
    meta: { tag: [TAG_FICTIONAL] },
  });
  updateClinicSettings(system, {
    organizationId: org.id,
    name: 'Centrum Medyczne Eternal',
    phone: '+48 22 000 00 00',
    email: 'rejestracja@eternal.local',
    address: 'ul. Przykładowa 1, 00-000 Warszawa',
    privacyContact: 'iod@eternal.local',
  });

  // --- wywiad przed wizytą ---
  const questionnaire = await fhir().create<Questionnaire>({
    resourceType: 'Questionnaire',
    url: 'urn:eternal:questionnaire:wywiad-ogolny',
    version: '1',
    status: 'active',
    title: 'Wywiad przed wizytą',
    description: 'Krótki wywiad wypełniany przez pacjenta przed konsultacją. Odpowiedzi trafiają do lekarza.',
    item: [
      { linkId: 'reason', type: 'text', text: 'Z jakim problemem zgłaszasz się na wizytę?', required: true },
      {
        linkId: 'duration',
        type: 'choice',
        text: 'Od kiedy występują dolegliwości?',
        answerOption: [
          { valueCoding: { code: 'days', display: 'Kilka dni' } },
          { valueCoding: { code: 'weeks', display: 'Kilka tygodni' } },
          { valueCoding: { code: 'months', display: 'Kilka miesięcy lub dłużej' } },
          { valueCoding: { code: 'control', display: 'Wizyta kontrolna' } },
        ],
      },
      { linkId: 'allergies', type: 'boolean', text: 'Czy masz uczulenia na leki?' },
      {
        linkId: 'allergies-list',
        type: 'string',
        text: 'Na jakie leki?',
        enableWhen: [{ question: 'allergies', operator: '=', answerBoolean: true }],
      },
      { linkId: 'meds', type: 'text', text: 'Jakie leki przyjmujesz na stałe? (jeśli nie uzupełniłeś listy leków w aplikacji)' },
      { linkId: 'info', type: 'display', text: 'Odpowiedzi nie są analizowane automatycznie — przeczyta je lekarz przed wizytą.' },
    ],
  });

  // --- usługi ---
  const svc = {
    internal: await upsertService(system, {
      name: 'Konsultacja internistyczna',
      description: 'Wizyta u lekarza chorób wewnętrznych.',
      durationMinutes: 20,
      mode: 'in-person',
      price: 200,
      questionnaireId: questionnaire.id,
      specialty: 'Choroby wewnętrzne',
      active: true,
      locationIds: [loc.id ?? ''],
    }),
    cardio: await upsertService(system, {
      name: 'Konsultacja kardiologiczna',
      description: 'Konsultacja specjalistyczna z oceną wyników badań.',
      durationMinutes: 30,
      mode: 'in-person',
      price: 250,
      questionnaireId: questionnaire.id,
      specialty: 'Kardiologia',
      preparation: 'Zabierz wyniki wcześniejszych badań i listę przyjmowanych leków.',
      active: true,
      locationIds: [loc.id ?? ''],
    }),
    tele: await upsertService(system, {
      name: 'Teleporada internistyczna',
      description: 'Konsultacja wideo w przeglądarce — bez instalowania aplikacji.',
      durationMinutes: 15,
      mode: 'tele',
      price: 150,
      specialty: 'Choroby wewnętrzne',
      active: true,
      locationIds: [],
    }),
    lab: await upsertService(system, {
      name: 'Pobranie krwi (punkt pobrań)',
      description: 'Pobranie materiału do badań laboratoryjnych.',
      durationMinutes: 10,
      mode: 'in-person',
      price: 15,
      preparation: 'Zgłoś się na czczo (co najmniej 8 godzin bez jedzenia). Woda niegazowana dozwolona.',
      specialty: 'Diagnostyka laboratoryjna',
      active: true,
      locationIds: [loc.id ?? ''],
    }),
  };

  // --- personel ---
  const nowicka = await upsertPractitioner(system, {
    prefix: 'lek.',
    given: 'Anna',
    family: 'Nowicka',
    specialty: 'Choroby wewnętrzne',
    serviceIds: [svc.internal.id, svc.tele.id],
    locationIds: [loc.id ?? ''],
    active: true,
    bio: 'Specjalistka chorób wewnętrznych (postać fikcyjna).',
  });
  const zielinski = await upsertPractitioner(system, {
    prefix: 'dr n. med.',
    given: 'Piotr',
    family: 'Zieliński',
    specialty: 'Kardiologia',
    serviceIds: [svc.cardio.id],
    locationIds: [loc.id ?? ''],
    active: true,
    bio: 'Kardiolog (postać fikcyjna).',
  });
  const wojcik = await upsertPractitioner(system, {
    prefix: 'mgr',
    given: 'Ewa',
    family: 'Wójcik',
    specialty: 'Pielęgniarstwo',
    serviceIds: [svc.lab.id],
    locationIds: [loc.id ?? ''],
    active: true,
  });
  invalidateDirectory();

  const pw = await hashPassword(DEMO_PASSWORD);
  const staff = [
    { email: 'admin@eternal.local', name: 'Administrator Demo', roles: ['admin', 'reception'] as const, ref: undefined },
    { email: 'recepcja@eternal.local', name: 'Katarzyna Rejestracja', roles: ['reception'] as const, ref: undefined },
    { email: 'anna.nowicka@eternal.local', name: 'lek. Anna Nowicka', roles: ['practitioner'] as const, ref: `Practitioner/${nowicka.id}` },
    { email: 'piotr.zielinski@eternal.local', name: 'dr n. med. Piotr Zieliński', roles: ['practitioner'] as const, ref: `Practitioner/${zielinski.id}` },
  ];
  for (const s of staff) {
    const u = createUser({ email: s.email, passwordHash: pw, roles: [...s.roles], fhirRef: s.ref, displayName: s.name, emailVerified: true });
    updateUser(u.id, { totp_secret: DEMO_TOTP_SECRET, totp_enabled: true });
  }

  // --- grafiki: 3 tygodnie do przodu ---
  const to = addDays(today, 21);
  await createAvailability(system, { practitionerId: nowicka.id, serviceIds: [svc.internal.id], locationId: loc.id, from: today, to, weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '13:00', slotMinutes: 20, breakStart: '11:00', breakEnd: '11:20' });
  await createAvailability(system, { practitionerId: nowicka.id, serviceIds: [svc.tele.id], from: today, to, weekdays: [1, 2, 3, 4, 5], startTime: '13:30', endTime: '15:30', slotMinutes: 15 });
  await createAvailability(system, { practitionerId: zielinski.id, serviceIds: [svc.cardio.id], locationId: loc.id, from: today, to, weekdays: [2, 4], startTime: '10:00', endTime: '16:00', slotMinutes: 30 });
  await createAvailability(system, { practitionerId: wojcik.id, serviceIds: [svc.lab.id], locationId: loc.id, from: today, to, weekdays: [1, 2, 3, 4, 5], startTime: '07:00', endTime: '10:00', slotMinutes: 10 });

  // --- pacjenci (fikcyjni) ---
  const anna = await createPatient(system, {
    given: 'Anna',
    family: 'Kowalska',
    birthDate: '1986-04-12',
    gender: 'female',
    phone: '+48 500 000 001',
    email: 'pacjent@eternal.local',
    address: { line: 'ul. Fikcyjna 5/12', postalCode: '00-001', city: 'Warszawa' },
    preferredLanguage: 'pl',
  }, { verified: true, fictional: true });
  const annaRef = `Patient/${anna.id}`;
  const annaUser = createUser({ email: 'pacjent@eternal.local', passwordHash: pw, roles: ['patient'], fhirRef: annaRef, displayName: 'Anna Kowalska', emailVerified: true });
  const annaActor: AuditActor = { userId: annaUser.id, actorRef: annaRef, display: 'Anna Kowalska', roles: ['patient'] };
  for (const type of Object.keys(CONSENT_TYPES) as ConsentType[]) {
    await setConsent(annaActor, annaRef, type, type !== 'reminders-sms');
  }

  const jan = await createPatient(system, { given: 'Jan', family: 'Wiśniewski', birthDate: '1958-11-03', gender: 'male', phone: '+48 500 000 002' }, { verified: true, fictional: true });
  const maria = await createPatient(system, { given: 'Maria', family: 'Lewandowska', birthDate: '1999-02-27', gender: 'female', email: 'maria@eternal.local' }, { fictional: true });
  const mariaRef = `Patient/${maria.id}`;
  const mariaUser = createUser({ email: 'maria@eternal.local', passwordHash: pw, roles: ['patient'], fhirRef: mariaRef, displayName: 'Maria Lewandowska', emailVerified: true });
  for (const type of ['terms', 'privacy', 'results-online', 'reminders-email'] as ConsentType[]) {
    await setConsent({ userId: mariaUser.id, actorRef: mariaRef, display: 'Maria Lewandowska', roles: ['patient'] }, mariaRef, type, true);
  }

  // --- wizyty przyszłe (przez normalną ścieżkę rezerwacji) ---
  const freeSlots = async (serviceId: string, practitionerId: string, fromDay: string) => {
    const s = await fhir().search<Slot>('Slot', { 'service-type': `${SERVICE_SYSTEM}|${serviceId}`, status: 'free', start: `ge${zonedToUtc(fromDay, '00:00', tz).toISOString()}`, _sort: 'start' });
    const sch = await ensureSchedule(practitionerId, practitionerId === nowicka.id && serviceId === svc.tele.id ? undefined : loc.id);
    return s.filter((x) => x.schedule.reference === `Schedule/${sch.id}`);
  };
  let day = addDays(today, 1);
  while (isoWeekday(day) > 5) day = addDays(day, 1);
  const s1 = (await freeSlots(svc.internal.id, nowicka.id, day))[3];
  if (s1) await bookAppointment(annaActor, { slotId: s1.id ?? '', serviceId: svc.internal.id, patientRef: annaRef, comment: 'Kontrola po leczeniu infekcji.', bookedBy: 'patient' });
  const teleDay = addDays(day, 2);
  const s2 = (await freeSlots(svc.tele.id, nowicka.id, teleDay))[1];
  if (s2) await bookAppointment(annaActor, { slotId: s2.id ?? '', serviceId: svc.tele.id, patientRef: annaRef, bookedBy: 'patient' });
  const janSlot = (await freeSlots(svc.cardio.id, zielinski.id, today))[2];
  if (janSlot) await bookAppointment(system, { slotId: janSlot.id ?? '', serviceId: svc.cardio.id, patientRef: `Patient/${jan.id}`, bookedBy: 'staff' });
  const mariaSlot = (await freeSlots(svc.lab.id, wojcik.id, day))[0];
  if (mariaSlot) await bookAppointment(system, { slotId: mariaSlot.id ?? '', serviceId: svc.lab.id, patientRef: mariaRef, bookedBy: 'staff' });

  // --- wizyta przeszła (zrealizowana) ---
  const pastDay = addDays(today, -10);
  const nowickaSchedule = await ensureSchedule(nowicka.id, loc.id);
  const pastStart = zonedToUtc(pastDay, '09:00', tz);
  const pastSlot = await fhir().create<Slot>({
    resourceType: 'Slot',
    schedule: { reference: `Schedule/${nowickaSchedule.id}` },
    status: 'busy',
    start: pastStart.toISOString(),
    end: new Date(pastStart.getTime() + 20 * 60_000).toISOString(),
    serviceType: [{ coding: [{ system: SERVICE_SYSTEM, code: svc.internal.id, display: svc.internal.name }] }],
  });
  const pastAppt = await fhir().create<Appointment>({
    resourceType: 'Appointment',
    status: 'fulfilled',
    serviceType: [{ coding: [{ system: SERVICE_SYSTEM, code: svc.internal.id, display: svc.internal.name }] }],
    start: pastSlot.start,
    end: pastSlot.end,
    minutesDuration: 20,
    created: new Date(pastStart.getTime() - 5 * 86_400_000).toISOString(),
    slot: [{ reference: `Slot/${pastSlot.id}` }],
    participant: [
      { actor: { reference: annaRef, display: 'Anna Kowalska' }, status: 'accepted' },
      { actor: { reference: `Practitioner/${nowicka.id}`, display: nowicka.name }, status: 'accepted' },
      { actor: { reference: `Location/${loc.id}`, display: loc.name }, status: 'accepted' },
    ],
  });

  // --- wyniki i dokumenty ---
  const doctor: AuditActor = { display: nowicka.name, actorRef: `Practitioner/${nowicka.id}`, roles: ['practitioner'] };
  const pdf = simplePdf([
    'Wynik badania laboratoryjnego - DANE FIKCYJNE',
    'Centrum Medyczne Eternal (fikcyjne)',
    'Pacjent: Anna Kowalska (osoba fikcyjna)',
    'Morfologia krwi: HGB 13.6 g/dL, WBC 6.4 10^3/uL, PLT 251 10^3/uL',
    'Dokument wygenerowany do demonstracji aplikacji.',
  ]);
  const upload = await registerUpload(doctor, { data: pdf, filename: 'morfologia-dane-fikcyjne.pdf', contentType: 'application/pdf' });
  const cbc = await createReport(doctor, {
    patientId: anna.id ?? '',
    title: 'Morfologia krwi',
    loinc: '58410-2',
    category: 'LAB',
    effective: addDays(today, -3) + 'T07:30:00Z',
    laboratory: 'Laboratorium Eternal (fikcyjne)',
    observations: [
      { loinc: '718-7', name: 'Hemoglobina (HGB)', value: '13.6', unit: 'g/dL', refLow: 12, refHigh: 16 },
      { loinc: '6690-2', name: 'Leukocyty (WBC)', value: '6.4', unit: '10*3/uL', refLow: 4, refHigh: 10 },
      { loinc: '789-8', name: 'Erytrocyty (RBC)', value: '4.52', unit: '10*6/uL', refLow: 3.8, refHigh: 5.2 },
      { loinc: '777-3', name: 'Płytki krwi (PLT)', value: '251', unit: '10*3/uL', refLow: 150, refHigh: 400 },
      { loinc: '4544-3', name: 'Hematokryt (HCT)', value: '40.1', unit: '%', refLow: 37, refHigh: 47 },
    ],
    binaryId: upload.binaryId,
  });
  await setShared(doctor, cbc.ref, true);
  await createReport(doctor, {
    patientId: anna.id ?? '',
    title: 'Lipidogram',
    loinc: '24331-1',
    category: 'LAB',
    effective: addDays(today, -3) + 'T07:30:00Z',
    laboratory: 'Laboratorium Eternal (fikcyjne)',
    observations: [
      { loinc: '2093-3', name: 'Cholesterol całkowity', value: '212', unit: 'mg/dL', refHigh: 190, labFlag: 'H' },
      { loinc: '2085-9', name: 'Cholesterol HDL', value: '58', unit: 'mg/dL', refLow: 45 },
      { loinc: '13457-7', name: 'Cholesterol LDL (wyliczany)', value: '131', unit: 'mg/dL', refHigh: 115, labFlag: 'H' },
      { loinc: '2571-8', name: 'Triglicerydy', value: '115', unit: 'mg/dL', refHigh: 150 },
    ],
  });
  const recs = await createDocument(doctor, {
    patientId: anna.id ?? '',
    title: 'Zalecenia po wizycie',
    kind: 'recommendations',
    appointmentId: pastAppt.id,
    text: 'Zalecenia (treść fikcyjna, demonstracyjna):\n1. Kontrola za 2–3 tygodnie z wynikami morfologii.\n2. Nawadnianie, odpoczynek.\n3. W razie nasilenia objawów — kontakt z placówką; w stanie nagłym — 112.',
  });
  await setShared(doctor, recs.ref, true);
  getDb().prepare('INSERT OR IGNORE INTO record_read (user_id, resource_ref, read_at) VALUES (?, ?, ?)').run(annaUser.id, recs.ref, new Date().toISOString());

  // --- wiadomości ---
  const thread = await startThreadAsPatient(annaActor, {
    patientRef: annaRef,
    subject: 'Przygotowanie do pobrania krwi',
    category: 'question',
    body: 'Dzień dobry, czy przed pobraniem krwi mogę wypić kawę bez cukru?',
  });
  const receptionUser = findUserByEmail('recepcja@eternal.local');
  await reply({ userId: receptionUser?.id, display: 'Katarzyna Rejestracja', roles: ['reception'] }, {
    threadId: thread.id,
    as: 'staff',
    body: 'Dzień dobry, prosimy o zgłoszenie się na czczo — dozwolona jest wyłącznie woda niegazowana. Kawę można wypić po pobraniu.',
  });

  // --- pomiary domowe i leki ---
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    d.setHours(7, 30, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    await addMeasurement(annaActor, annaRef, {
      kind: 'bp',
      systolic: 118 + ((i * 7) % 15),
      diastolic: 76 + ((i * 5) % 9),
      pulse: 64 + ((i * 3) % 10),
      effective: d.toISOString(),
      source: i % 3 === 0 ? 'bluetooth' : 'manual',
      device: i % 3 === 0 ? 'Ciśnieniomierz BLE (GATT 0x1810)' : undefined,
    });
    if (i % 4 === 0) await addMeasurement(annaActor, annaRef, { kind: 'weight', value: 64.2 + (i % 3) * 0.3, effective: d.toISOString(), source: 'manual' });
  }
  await addMedication(annaActor, annaRef, { name: 'Witamina D3 2000 j.m.', dosage: '1 kapsułka dziennie', since: '2025-10' });

  log('Dane demonstracyjne utworzone (wszystkie osoby i wyniki są fikcyjne).');
}
