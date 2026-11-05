import zlib from 'node:zlib';
import type { Appointment, Location, Patient } from '@medplum/fhirtypes';
import type { AuditActor } from '../audit.js';
import { createUser, findUserByEmail, updateUser } from '../auth/users.js';
import { hashPassword } from '../auth/passwords.js';
import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { addDays, localDate, zonedToUtc } from '../lib/time.js';
import { getSetting, setSetting } from '../settings.js';
import { runInScope } from '../tenancy.js';
import {
  addLot,
  addProcedurePhoto,
  approveConsentTemplate,
  createComplication,
  createProcedure,
  createProduct,
  listProducts,
  markConsentRead,
  recordConsentSigned,
  requestConsent,
  setImageConsent,
  signProcedure,
} from '../services/aesthetic.js';
import { applyProfile } from '../services/clinicProfile.js';
import { setConsent } from '../services/consents.js';
import { listPractitioners, listServices, setPractitionerProfession, updateClinicSettings, upsertPractitioner, upsertService } from '../services/directory.js';
import { createOrganization } from '../services/orgs.js';
import { createPatient } from '../services/patients.js';
import { createDeclaration, createPlan, decideDeclaration, recordBzod, updatePlanItem } from '../services/poz.js';
import { DEMO_PASSWORD, DEMO_TOTP_SECRET } from './constants.js';

/**
 * Dane pokazowe profili placówek (fikcyjne):
 * - Centrum Medyczne Eternal → profil POZ: deklaracje, IPOM Anny Kowalskiej z koordynatorem, bilans „Moje Zdrowie”;
 * - Klinika Medycyny Estetycznej Aurora (druga placówka) → profil „Medycyna estetyczna”: lekarka i kosmetolożka,
 *   produkty i partie (także po terminie i z krótką datą), zatwierdzone wzory zgód, dwie podpisane karty zabiegów
 *   ze zdjęciami poglądowymi (rysunki), szkic trzeciej, powikłanie, wizyta na jutro.
 */

const sys: AuditActor = { display: 'seed-demo' };

// --- zdjęcia poglądowe (rysunek twarzy, PNG) -------------------------------------------------------------------------

function png(w: number, h: number, px: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Rysunek twarzy: zmarszczki czoła (przed toksyną) i pełniejsze usta (po wypełniaczu) — wyłącznie ilustracja. */
function face(opts: { wrinkles: boolean; lips: number }): Buffer {
  return png(240, 320, (x, y) => {
    if (inEllipse(x, y, 120, 150, 78, 104)) {
      if (y < 78 && !inEllipse(x, y, 120, 96, 66, 30)) return [92, 64, 48];
      if (opts.wrinkles && [104, 113, 122].some((ly) => Math.abs(y - ly) < 1.2) && x > 82 && x < 158) return [196, 150, 126];
      if (inEllipse(x, y, 92, 146, 12, 5) || inEllipse(x, y, 148, 146, 12, 5)) return [60, 46, 42];
      if ((Math.abs(y - 132) < 1.6 && x > 78 && x < 106) || (Math.abs(y - 132) < 1.6 && x > 134 && x < 162)) return [96, 70, 56];
      if (Math.abs(x - 120) < 1.4 && y > 150 && y < 186) return [205, 162, 138];
      if (inEllipse(x, y, 120, 214, 24, opts.lips)) return [186, 92, 98];
      return [232, 196, 172];
    }
    return [234, 230, 226];
  });
}

async function patientByName(family: string): Promise<Patient | undefined> {
  return (await fhir().search<Patient>('Patient', {})).find((p) => p.name?.[0]?.family === family);
}

export async function seedProfilesDemo(log: (m: string) => void = console.log): Promise<void> {
  if (!config.demoMode || getSetting<boolean>('demo-profiles')) return;
  const doctor = findUserByEmail('anna.nowicka@eternal.local');
  const reception = findUserByEmail('recepcja@eternal.local');
  const patient = findUserByEmail('pacjent@eternal.local');
  if (!doctor?.org_id || !patient?.fhir_ref) return;
  const orgId = doctor.org_id;
  const tz = config.clinic.timezone;
  const today = localDate(new Date(), tz);
  const docActor: AuditActor = { userId: doctor.id, actorRef: doctor.fhir_ref ?? undefined, display: doctor.display_name, roles: doctor.roles };
  const recActor: AuditActor = { userId: reception?.id, display: reception?.display_name ?? 'Rejestracja', roles: ['reception'] };

  // --- Centrum Medyczne Eternal: profil POZ ---------------------------------------------------------------------------
  await runInScope({ orgId }, async () => {
    for (const p of await listPractitioners(true)) await setPractitionerProfession(sys, p.id, p.specialty?.startsWith('Pielęg') ? 'pielegniarka' : 'lekarz');
    await applyProfile(sys, 'poz', orgId);
    updateClinicSettings(sys, { ipomLimits: { edukacja: 6, dietetyk: 3 } }, orgId);
    const prs = await listPractitioners(true);
    const nowicka = prs.find((p) => p.name.includes('Nowicka'))!;
    const nurse = prs.find((p) => p.profession === 'pielegniarka');
    const annaId = patient.fhir_ref!.split('/')[1];
    const decide = async (d: { id: string }) => decideDeclaration(recActor, orgId, d.id, { action: 'accept' });
    await decide(await createDeclaration(recActor, orgId, { patientId: annaId, kind: 'lekarz', practitionerId: nowicka.id, source: 'ikp', submittedOn: addDays(today, -400) }));
    if (nurse) await decide(await createDeclaration(recActor, orgId, { patientId: annaId, kind: 'pielegniarka', practitionerId: nurse.id, source: 'papier', submittedOn: addDays(today, -400) }));
    const jan = await patientByName('Wiśniewski');
    const maria = await patientByName('Lewandowska');
    if (jan) {
      await decide(await createDeclaration(recActor, orgId, { patientId: jan.id ?? '', kind: 'lekarz', practitionerId: nowicka.id, source: 'papier', submittedOn: addDays(today, -900) }));
      await recordBzod(recActor, orgId, jan.id ?? '', `${Number(today.slice(0, 4)) - 2}-05-12`);
    }
    if (maria) await createDeclaration(recActor, orgId, { patientId: maria.id ?? '', kind: 'lekarz', practitionerId: nowicka.id, source: 'ikp', submittedOn: today });
    const plan = await createPlan(doctor, docActor, orgId, {
      patientId: annaId,
      groups: ['nadcisnienie'],
      coordinatorUserId: reception?.id ?? null,
      note: 'Pacjentka prowadzi dzienniczek pomiarów w aplikacji (dane pokazowe).',
      items: [
        { kind: 'badanie', title: 'Kreatynina i eGFR', dueOn: addDays(today, -3) },
        { kind: 'badanie', title: 'Lipidogram', dueOn: addDays(today, 5) },
        { kind: 'edukacja', title: 'Porada edukacyjna — pomiary ciśnienia w domu', dueOn: addDays(today, -10) },
        { kind: 'dietetyk', title: 'Porada dietetyczna — ograniczenie soli', dueOn: addDays(today, 14) },
        { kind: 'wizyta', title: 'Wizyta kontrolna z dzienniczkiem pomiarów', dueOn: addDays(today, 21) },
      ],
    });
    const edu = plan.items.find((i) => i.kind === 'edukacja');
    if (edu) await updatePlanItem(recActor, orgId, plan.id, edu.id, { status: 'zrealizowane', doneOn: addDays(today, -10) });
  });

  // --- Klinika Medycyny Estetycznej Aurora: profil „Medycyna estetyczna” ---------------------------------------------
  const aurora = await createOrganization(sys, { name: 'Klinika Medycyny Estetycznej Aurora (fikcyjna)', phone: '+48 22 000 00 50', email: 'recepcja@aurora.eternal.local' });
  const pw = await hashPassword(DEMO_PASSWORD);
  await runInScope({ orgId: aurora.id }, async () => {
    const loc = await fhir().create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: 'Aurora — gabinet zabiegowy',
      address: { line: ['ul. Pokazowa 7'], postalCode: '00-002', city: 'Warszawa', country: 'PL' },
      telecom: [{ system: 'phone', value: '+48 22 000 00 50' }],
      managingOrganization: { reference: `Organization/${aurora.id}` },
    });
    updateClinicSettings(
      sys,
      { organizationId: aurora.id, name: 'Klinika Medycyny Estetycznej Aurora', phone: '+48 22 000 00 50', email: 'recepcja@aurora.eternal.local', address: 'ul. Pokazowa 7, 00-002 Warszawa', privacyContact: 'iod@aurora.eternal.local' },
      aurora.id,
    );
    await applyProfile(sys, 'estetyka', aurora.id);
    // cennik pokazowy (kwoty fikcyjne)
    const PRICES: [string, number][] = [['Konsultacja kwalifikacyjna', 200], ['Toksyna botulinowa — mimiczne', 900], ['Toksyna botulinowa — leczenie', 1400], ['Wypełniacz z kwasem', 1200], ['Stymulator tkankowy', 1500], ['Mezoterapia igłowa', 600], ['Wizyta kontrolna po zabiegu', 0], ['Zabieg kosmetologiczny', 350]];
    for (const s of await listServices(true)) {
      const price = PRICES.find(([prefix]) => s.name.startsWith(prefix))?.[1];
      if (price !== undefined) await upsertService(sys, { ...s, price });
    }
    const services = await listServices(true);
    const physicianSvc = services.filter((s) => s.requiresPhysician).map((s) => s.id);
    const cosmSvc = services.filter((s) => !s.requiresPhysician).map((s) => s.id);
    const doc = await upsertPractitioner(sys, { prefix: 'lek.', given: 'Joanna', family: 'Malinowska', specialty: 'Dermatologia, medycyna estetyczna', serviceIds: physicianSvc, locationIds: [loc.id ?? ''], active: true, bio: 'Lekarka dermatolog (postać fikcyjna).', profession: 'lekarz' });
    await upsertPractitioner(sys, { prefix: 'mgr', given: 'Ewa', family: 'Sadowska', specialty: 'Kosmetologia', serviceIds: cosmSvc, locationIds: [loc.id ?? ''], active: true, profession: 'kosmetolog' });
    const docUser = createUser({ email: 'joanna.malinowska@eternal.local', passwordHash: pw, roles: ['practitioner'], fhirRef: `Practitioner/${doc.id}`, displayName: 'lek. Joanna Malinowska', emailVerified: true, orgId: aurora.id });
    updateUser(docUser.id, { totp_secret: DEMO_TOTP_SECRET, totp_enabled: true });
    const auroraActor: AuditActor = { userId: docUser.id, actorRef: `Practitioner/${doc.id}`, display: 'lek. Joanna Malinowska', roles: ['practitioner'] };

    const k = await createPatient(sys, { given: 'Karolina', family: 'Wiśniewska', birthDate: '1991-03-08', gender: 'female', phone: '+48 500 000 007', email: 'karolina@eternal.local' }, { verified: true, fictional: true });
    const kRef = `Patient/${k.id}`;
    const kUser = createUser({ email: 'karolina@eternal.local', passwordHash: pw, roles: ['patient'], fhirRef: kRef, displayName: 'Karolina Wiśniewska', emailVerified: true });
    const kActor: AuditActor = { userId: kUser.id, actorRef: kRef, display: 'Karolina Wiśniewska', roles: ['patient'] };
    for (const t of ['terms', 'privacy', 'results-online', 'reminders-email'] as const) await setConsent(kActor, kRef, t, true);
    setImageConsent(auroraActor, aurora.id, kRef, { documentation: true });

    // produkty i partie (nazwy fikcyjne)
    const toks = createProduct(auroraActor, aurora.id, { name: 'Neurotoks A 100 j. (preparat fikcyjny)', kind: 'toksyna', category: 'lek', manufacturer: 'Fikcyjna Farma S.A.', unit: 'j.' });
    addLot(auroraActor, aurora.id, toks.id, { lot: 'NT-2026-118', expiry: addDays(today, 240), receivedOn: addDays(today, -60) });
    addLot(auroraActor, aurora.id, toks.id, { lot: 'NT-2025-044', expiry: addDays(today, -20), receivedOn: addDays(today, -300) });
    const fill = createProduct(auroraActor, aurora.id, { name: 'HialuFill Lips 1 ml (wyrób fikcyjny)', kind: 'wypelniacz-ha', category: 'wyrob-medyczny', manufacturer: 'Demo Aesthetics Sp. z o.o.', unit: 'ml' });
    addLot(auroraActor, aurora.id, fill.id, { lot: 'HF-26-0091', expiry: addDays(today, 400), udi: '(01)05900000000017(17)281231(10)HF260091', receivedOn: addDays(today, -30) });
    addLot(auroraActor, aurora.id, fill.id, { lot: 'HF-25-0450', expiry: addDays(today, 20), receivedOn: addDays(today, -200) });
    const bio = createProduct(auroraActor, aurora.id, { name: 'BioStim CaHA 1,5 ml (wyrób fikcyjny)', kind: 'biostymulator', category: 'wyrob-medyczny', manufacturer: 'Demo Aesthetics Sp. z o.o.', unit: 'ml' });
    addLot(auroraActor, aurora.id, bio.id, { lot: 'BS-26-007', expiry: addDays(today, 300), receivedOn: addDays(today, -15) });
    const lot = (productId: string, l: string) => listProducts(aurora.id).find((p) => p.id === productId)!.lots.find((x) => x.lot === l)!.id;

    for (const id of ['toksyna', 'wypelniacz', 'biostymulator', 'mezoterapia']) approveConsentTemplate(auroraActor, aurora.id, id, 'lek. Joanna Malinowska, PWZ 1234567 (dane fikcyjne)');
    const cTox = await requestConsent(auroraActor, aurora.id, k.id ?? '', 'toksyna');
    recordConsentSigned(auroraActor, aurora.id, cTox.id, { signedOn: addDays(today, -40), method: 'papier' });
    const cFill = await requestConsent(auroraActor, aurora.id, k.id ?? '', 'wypelniacz');
    recordConsentSigned(auroraActor, aurora.id, cFill.id, { signedOn: addDays(today, -12), method: 'papier' });
    const cBio = await requestConsent(auroraActor, aurora.id, k.id ?? '', 'biostymulator');
    markConsentRead(kActor, kRef, cBio.id);

    const svc = (prefix: string) => services.find((s) => s.name.startsWith(prefix))?.id;
    const at = (daysAgo: number, hh: string) => zonedToUtc(addDays(today, -daysAgo), hh, tz).toISOString();
    // 1) toksyna — 40 dni temu
    const p1 = await createProcedure(docUser, auroraActor, aurora.id, {
      patientId: k.id ?? '',
      serviceId: svc('Toksyna botulinowa — mimiczne'),
      title: 'Toksyna botulinowa — czoło i gładzizna',
      purpose: 'estetyczny',
      performedAt: at(40, '11:00'),
      items: [
        { productId: toks.id, lotId: lot(toks.id, 'NT-2026-118'), quantity: 10, area: 'czoło' },
        { productId: toks.id, lotId: lot(toks.id, 'NT-2026-118'), quantity: 12, area: 'gładzizna (lwia zmarszczka)' },
      ],
      points: [
        { x: 0.37, y: 0.27, view: 'przod', quantity: 2, item: 0 },
        { x: 0.45, y: 0.25, view: 'przod', quantity: 2, item: 0 },
        { x: 0.55, y: 0.25, view: 'przod', quantity: 2, item: 0 },
        { x: 0.63, y: 0.27, view: 'przod', quantity: 2, item: 0 },
        { x: 0.5, y: 0.31, view: 'przod', quantity: 2, item: 0 },
        { x: 0.44, y: 0.38, view: 'przod', quantity: 4, item: 1 },
        { x: 0.5, y: 0.39, view: 'przod', quantity: 4, item: 1 },
        { x: 0.56, y: 0.38, view: 'przod', quantity: 4, item: 1 },
      ],
      notes: 'Kwalifikacja bez przeciwwskazań (wywiad w aplikacji). Pacjentka poinformowana o działaniu po 3–14 dniach.',
      consentId: cTox.id,
      nextOn: addDays(today, 80),
    });
    await addProcedurePhoto(auroraActor, aurora.id, p1.id, { data: face({ wrinkles: true, lips: 6 }), filename: 'przed-en-face.png', contentType: 'image/png', phase: 'przed', angle: 'en-face' });
    await addProcedurePhoto(auroraActor, aurora.id, p1.id, { data: face({ wrinkles: false, lips: 6 }), filename: 'po-en-face.png', contentType: 'image/png', phase: 'po', angle: 'en-face' });
    await signProcedure(docUser, auroraActor, aurora.id, p1.id);
    // 2) wypełniacz ust — 12 dni temu, kontrola za 2 dni
    const p2 = await createProcedure(docUser, auroraActor, aurora.id, {
      patientId: k.id ?? '',
      serviceId: svc('Wypełniacz z kwasem hialuronowym'),
      title: 'Wypełniacz HA — modelowanie ust',
      purpose: 'estetyczny',
      performedAt: at(12, '15:30'),
      items: [{ productId: fill.id, lotId: lot(fill.id, 'HF-26-0091'), quantity: 1, area: 'usta' }],
      points: [
        { x: 0.42, y: 0.66, view: 'przod', quantity: 0.2, item: 0 },
        { x: 0.5, y: 0.655, view: 'przod', quantity: 0.2, item: 0 },
        { x: 0.58, y: 0.66, view: 'przod', quantity: 0.2, item: 0 },
        { x: 0.45, y: 0.69, view: 'przod', quantity: 0.2, item: 0 },
        { x: 0.55, y: 0.69, view: 'przod', quantity: 0.2, item: 0 },
      ],
      notes: 'Technika wkłuć liniowych, kaniula 25G. Hialuronidaza dostępna w gabinecie.',
      consentId: cFill.id,
      controlOn: addDays(today, 2),
    });
    await addProcedurePhoto(auroraActor, aurora.id, p2.id, { data: face({ wrinkles: false, lips: 6 }), filename: 'przed-usta.png', contentType: 'image/png', phase: 'przed', angle: 'en-face' });
    await addProcedurePhoto(auroraActor, aurora.id, p2.id, { data: face({ wrinkles: false, lips: 10 }), filename: 'po-usta.png', contentType: 'image/png', phase: 'po', angle: 'en-face' });
    await signProcedure(docUser, auroraActor, aurora.id, p2.id);
    await createComplication(auroraActor, aurora.id, { procedureId: p2.id, noticedOn: addDays(today, -9), description: 'Obrzęk i zasinienie wargi górnej utrzymujące się 3 dni po zabiegu (dane pokazowe).', seriousness: 'lagodne', actions: 'Zimne okłady, kontrola telefoniczna; objawy ustąpiły.', reportTo: 'nie-dotyczy' });
    // 3) szkic — biostymulacja zaplanowana na dziś (zgoda jeszcze niepodpisana)
    await createProcedure(docUser, auroraActor, aurora.id, {
      patientId: k.id ?? '',
      serviceId: svc('Stymulator tkankowy'),
      title: 'Stymulator tkankowy — owal twarzy',
      purpose: 'estetyczny',
      items: [{ productId: bio.id, lotId: lot(bio.id, 'BS-26-007'), quantity: 1.5, area: 'linia żuchwy' }],
      points: [],
    });
    // wizyta na jutro (kontrola), widoczna w kalendarzu i kolejce lekarki
    const start = zonedToUtc(addDays(today, 1), '10:00', tz);
    await fhir().create<Appointment>({
      resourceType: 'Appointment',
      status: 'booked',
      serviceType: [{ text: 'Wizyta kontrolna po zabiegu' }],
      start: start.toISOString(),
      end: new Date(start.getTime() + 15 * 60_000).toISOString(),
      minutesDuration: 15,
      created: new Date().toISOString(),
      comment: 'Kontrola po wypełniaczu ust (dane pokazowe).',
      participant: [
        { actor: { reference: kRef, display: 'Karolina Wiśniewska' }, status: 'accepted' },
        { actor: { reference: `Practitioner/${doc.id}`, display: 'lek. Joanna Malinowska' }, status: 'accepted' },
        { actor: { reference: `Location/${loc.id}`, display: loc.name }, status: 'accepted' },
      ],
    });
  });
  setSetting('demo-profiles', true);
  log('Dane pokazowe profili placówek utworzone (POZ, klinika estetyczna Aurora — fikcyjne).');
}
