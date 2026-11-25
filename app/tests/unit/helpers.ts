import type { Location, Organization } from '@medplum/fhirtypes';
import type { AuditActor } from '../../server/audit.js';
import { closeDatabase, getDb, initDatabase } from '../../server/db.js';
import { setRepo } from '../../server/fhir/index.js';
import { LocalFhirRepository } from '../../server/fhir/local.js';
import { fhir } from '../../server/fhir/index.js';
import { invalidateDirectory, upsertPractitioner, upsertService } from '../../server/services/directory.js';
import { createPatient } from '../../server/services/patients.js';
import { createUser } from '../../server/auth/users.js';
import { setConsent } from '../../server/services/consents.js';
import { addDays, holidayName, isoWeekday, localDate } from '../../server/lib/time.js';

export const system: AuditActor = { display: 'test' };

export async function setupCore(): Promise<void> {
  closeDatabase();
  initDatabase(':memory:');
  const repo = new LocalFhirRepository(getDb());
  await repo.init();
  setRepo(repo);
  invalidateDirectory();
}

/** Minimalna placówka: organizacja, lokalizacja, usługa (20 min), lekarz. */
export async function setupClinic() {
  const org = await fhir().create<Organization>({ resourceType: 'Organization', name: 'Testowa placówka', active: true });
  const loc = await fhir().create<Location>({ resourceType: 'Location', name: 'Gabinet 1', status: 'active' });
  const service = await upsertService(system, { name: 'Konsultacja', durationMinutes: 20, mode: 'in-person', active: true, locationIds: [loc.id ?? ''], price: 100 });
  const tele = await upsertService(system, { name: 'Teleporada', durationMinutes: 15, mode: 'tele', active: true, locationIds: [] });
  const doctor = await upsertPractitioner(system, { given: 'Jan', family: 'Testowy', prefix: 'lek.', serviceIds: [service.id, tele.id], locationIds: [loc.id ?? ''], active: true });
  invalidateDirectory();
  return { org, loc, service, tele, doctor };
}

export async function makePatient(given = 'Anna', family = 'Pacjentka', opts: { verified?: boolean; account?: boolean } = { verified: true, account: true }) {
  const p = await createPatient(system, { given, family, birthDate: '1990-05-05', email: `${given.toLowerCase()}.${family.toLowerCase()}@test.local` }, { verified: opts.verified });
  const ref = `Patient/${p.id}`;
  let userId: string | undefined;
  if (opts.account) {
    userId = createUser({ email: `${given.toLowerCase()}.${family.toLowerCase()}@test.local`, passwordHash: 'x', roles: ['patient'], fhirRef: ref, displayName: `${given} ${family}`, emailVerified: true }).id;
  }
  const actor: AuditActor = { userId, actorRef: ref, display: `${given} ${family}`, roles: ['patient'] };
  return { patient: p, ref, userId, actor };
}

export async function grantAll(actor: AuditActor, ref: string, types: Parameters<typeof setConsent>[2][]) {
  for (const t of types) await setConsent(actor, ref, t, true);
}

/** Najbliższy dzień roboczy niebędący świętem, co najmniej `minDays` dni od dziś (YYYY-MM-DD). */
export function nextWorkday(minDays = 2): string {
  let d = addDays(localDate(new Date(), 'Europe/Warsaw'), minDays);
  while (isoWeekday(d) > 5 || holidayName(d)) d = addDays(d, 1);
  return d;
}

/** Minimalny PDF z warstwą tekstową (Helvetica, znaki ASCII) — do testów odczytu bez Chromium. */
export function simplePdf(lines: string[]): Buffer {
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = lines.map((l, i) => `BT /F1 10 Tf 50 ${780 - i * 16} Td (${escape(l)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Ciało multipart/form-data dla app.inject. */
export function multipart(fields: Record<string, string>, file: { name: string; filename: string; contentType: string; data: Buffer }) {
  const boundary = `----eternal${Date.now()}`;
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
