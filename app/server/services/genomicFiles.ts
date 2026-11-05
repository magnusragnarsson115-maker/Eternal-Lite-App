import { audit, type AuditActor } from '../audit.js';
import { getDb } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { badRequest, newId, notFound, nowIso, sha256 } from '../lib/util.js';

/**
 * Plik surowych danych genetycznych od dostawcy testu (F16.2) — WYŁĄCZNIE przechowanie. Aplikacja nie otwiera,
 * nie odczytuje i nie interpretuje pliku (interpretacja wariantów to wyrób do diagnostyki in vitro i poradnictwo
 * genetyczne). Dane genetyczne to szczególna kategoria (art. 9 RODO): plik jest poza udostępnianiem, raportami
 * i kopią offline; pobrać i usunąć może go tylko pacjent, każdy dostęp trafia do dziennika.
 */

export const GENOMIC_MAX_BYTES = 15 * 1024 * 1024;
export const GENOMIC_NOTICE =
  'Aplikacja tylko przechowuje ten plik. Nie odczytuje go i nie interpretuje wyników — o znaczeniu wariantów genetycznych rozmawia się z lekarzem genetykiem albo w poradni genetycznej.';

export interface GenomicFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  provider?: string;
  uploadedAt: string;
}

interface Row {
  id: string;
  patient_ref: string;
  binary_id: string;
  filename: string;
  content_type: string;
  size: number;
  sha256: string;
  provider: string | null;
  uploaded_at: string;
}

const toView = (r: Row): GenomicFile => ({ id: r.id, filename: r.filename, contentType: r.content_type, size: r.size, sha256: r.sha256, provider: r.provider ?? undefined, uploadedAt: r.uploaded_at });

/** Rozpoznanie formatu bez czytania treści: ZIP, GZIP albo tekst (pierwsze 4 KB bez bajtów sterujących). */
export function genomicKind(data: Buffer): 'application/zip' | 'application/gzip' | 'text/plain' | undefined {
  if (data.length >= 4 && data.readUInt32LE(0) === 0x04034b50) return 'application/zip';
  if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) return 'application/gzip';
  const head = data.subarray(0, 4096);
  if (head.length && !head.some((b) => b === 0 || (b < 0x09) || (b > 0x0d && b < 0x20 && b !== 0x1b))) return 'text/plain';
  return undefined;
}

export async function uploadGenomicFile(actor: AuditActor, patientRef: string, file: { data: Buffer; filename: string; provider?: string; confirmed: boolean }): Promise<GenomicFile[]> {
  if (!file.confirmed) throw badRequest('confirmation_required');
  if (!file.data.length) throw badRequest('file_required');
  if (file.data.length > GENOMIC_MAX_BYTES) throw badRequest('file_too_large');
  const type = genomicKind(file.data);
  if (!type) throw badRequest('unsupported_file_type');
  if ((getDb().prepare('SELECT COUNT(*) AS n FROM genomic_file WHERE patient_ref = ?').get(patientRef) as { n: number }).n >= 5) throw badRequest('too_many');
  const stored = await fhirSystem().saveBinary(file.data, type, file.filename);
  const name = file.filename.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'dane-genetyczne';
  getDb()
    .prepare('INSERT INTO genomic_file (id, patient_ref, binary_id, filename, content_type, size, sha256, provider, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), patientRef, stored.id, name, type, stored.size, sha256(file.data), file.provider?.trim().slice(0, 60) || null, actor.userId ?? null, nowIso());
  audit(actor, { action: 'C', subtype: 'genomic-file-upload', entityRef: `Binary/${stored.id}`, patientRef, detail: { size: stored.size, type } });
  return listGenomicFiles(actor, patientRef);
}

export function listGenomicFiles(actor: AuditActor, patientRef: string): GenomicFile[] {
  const rows = getDb().prepare('SELECT * FROM genomic_file WHERE patient_ref = ? ORDER BY uploaded_at DESC').all(patientRef) as unknown as Row[];
  audit(actor, { action: 'R', subtype: 'genomic-file-list', patientRef });
  return rows.map(toView);
}

export async function downloadGenomicFile(actor: AuditActor, patientRef: string, id: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const r = getDb().prepare('SELECT * FROM genomic_file WHERE id = ? AND patient_ref = ?').get(id, patientRef) as Row | undefined;
  if (!r) throw notFound('file_not_found');
  const bin = await fhirSystem().readBinary(r.binary_id);
  audit(actor, { action: 'R', subtype: 'genomic-file-download', entityRef: `Binary/${r.binary_id}`, patientRef });
  return { data: bin.data, filename: r.filename, contentType: r.content_type };
}

export async function deleteGenomicFile(actor: AuditActor, patientRef: string, id: string): Promise<GenomicFile[]> {
  const r = getDb().prepare('SELECT * FROM genomic_file WHERE id = ? AND patient_ref = ?').get(id, patientRef) as Row | undefined;
  if (!r) throw notFound('file_not_found');
  await fhirSystem().deleteBinary(r.binary_id);
  getDb().prepare('DELETE FROM genomic_file WHERE id = ?').run(id);
  audit(actor, { action: 'D', subtype: 'genomic-file-delete', entityRef: `Binary/${r.binary_id}`, patientRef });
  return listGenomicFiles(actor, patientRef);
}

/** Usunięcie konta: pliki i ich zawartość znikają trwale. */
export async function purgeGenomicFiles(patientRef: string): Promise<number> {
  const rows = getDb().prepare('SELECT binary_id FROM genomic_file WHERE patient_ref = ?').all(patientRef) as { binary_id: string }[];
  for (const r of rows) await fhirSystem().deleteBinary(r.binary_id);
  getDb().prepare('DELETE FROM genomic_file WHERE patient_ref = ?').run(patientRef);
  return rows.length;
}
