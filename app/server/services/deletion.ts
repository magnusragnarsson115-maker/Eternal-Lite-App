import type { MedicationStatement, Observation, Patient, Resource, ResourceType } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { destroyAllSessions } from '../auth/sessions.js';
import { type AppUser, updateUser } from '../auth/users.js';
import { config } from '../config.js';
import { getDb, transaction } from '../db.js';
import { fhirSystem } from '../fhir/index.js';
import { newId, nowIso } from '../lib/util.js';
import { documentHtml, esc } from '../pdf/html.js';
import { ORG_TAG_SYSTEM, orgIdsOf, vaultOrgId } from '../tenancy.js';
import { enqueue } from './notifications.js';
import { revokeGrant } from './grants.js';
import { purgeGenomicFiles } from './genomicFiles.js';

/**
 * Usunięcie danych z potwierdzeniem (A18.12, art. 17 RODO): co usunięto, co musi zostać i dlaczego,
 * kiedy znikną kopie. Usuwamy dane własne pacjenta (sejf, wpisy z aplikacji, konto i ustawienia) u nas
 * i u dostawców, którzy je przechowują. Dokumentacja medyczna placówek zostaje (art. 29 ustawy o prawach pacjenta),
 * podobnie dziennik zdarzeń bez treści medycznej (rozliczalność, art. 5 ust. 2 RODO).
 */

export interface DeletionStep {
  key: string;
  label: string;
  status: 'deleted' | 'kept' | 'scheduled' | 'not-stored';
  count?: number;
  detail: string;
}

export interface DeletionConfirmation {
  id: string;
  requestedAt: string;
  completedAt: string;
  steps: DeletionStep[];
  backupsGoneBy: string;
}

export const VAULT_TYPES: ResourceType[] = [
  'Observation',
  'DiagnosticReport',
  'DocumentReference',
  'QuestionnaireResponse',
  'Provenance',
  'RelatedPerson',
  'Immunization',
  'ImmunizationRecommendation',
  'FamilyMemberHistory',
  'Consent',
  'Goal',
];

async function expungeAll(resources: Resource[]): Promise<number> {
  let n = 0;
  for (const r of resources) {
    if (!r.id) continue;
    await fhirSystem().expunge(r.resourceType as ResourceType, r.id);
    n++;
  }
  return n;
}

/** Dane własne profilu pacjenta: udostępnienia, sejf, wpisy z aplikacji (kroki 1–3 potwierdzenia). */
async function erasePatientData(actor: AuditActor, patientRef: string): Promise<DeletionStep[]> {
  const db = getDb();
  const steps: DeletionStep[] = [];
  // 1. udostępnienia i linki — natychmiastowe odebranie dostępu
  const grants = db.prepare("SELECT id FROM access_grant WHERE patient_ref = ? AND status = 'active'").all(patientRef) as { id: string }[];
  for (const g of grants) await revokeGrant(actor, g.id, { patientRef });
  const links = db.prepare("UPDATE invite_link SET status = 'revoked' WHERE patient_ref = ? AND status = 'active'").run(patientRef);
  // opiekunowie tracą dostęp do profilu (A24.2)
  const proxies = db
    .prepare("UPDATE proxy_link SET status = 'revoked', revoked_at = ?, revoked_by = ?, code_hash = NULL WHERE patient_ref = ? AND status IN ('pending', 'active')")
    .run(nowIso(), actor.userId ?? null, patientRef);
  steps.push({ key: 'sharing', label: 'Udostępnienia klinikom, linki i dostęp opiekunów', status: 'deleted', count: grants.length + Number(links.changes) + Number(proxies.changes), detail: 'Kliniki i opiekunowie stracili dostęp do materiałów, linki przestały działać.' });

  // 2. sejf pacjenta: dokumenty i wyniki wgrane przez pacjenta, odczyty, pochodzenie
  const vaultTag = `${ORG_TAG_SYSTEM}|${vaultOrgId(patientRef)}`;
  const vault: Resource[] = [];
  for (const t of VAULT_TYPES) vault.push(...(await fhirSystem().search(t, { _tag: vaultTag, _count: '5000' })));
  // karty „Po wizycie” są także dokumentacją placówki — zostają u niej, usuwamy tylko kopię w sejfie (znacznik)
  const clinicCopies = vault.filter((r) => orgIdsOf(r).some((o) => o !== vaultOrgId(patientRef)));
  for (const r of clinicCopies) {
    await fhirSystem().update({ ...r, meta: { ...r.meta, tag: (r.meta?.tag ?? []).filter((t) => !(t.system === ORG_TAG_SYSTEM && t.code === vaultOrgId(patientRef))) } });
  }
  const own = vault.filter((r) => !clinicCopies.includes(r));
  const intake = db.prepare('SELECT binary_id FROM intake_item WHERE patient_ref = ?').all(patientRef) as { binary_id: string }[];
  for (const b of intake) {
    await fhirSystem().deleteBinary(b.binary_id).catch(() => undefined);
    db.prepare('DELETE FROM binary_owner WHERE binary_id = ?').run(b.binary_id);
  }
  db.prepare('DELETE FROM intake_item WHERE patient_ref = ?').run(patientRef);
  const n = (await expungeAll(own)) + (await purgeGenomicFiles(patientRef));
  steps.push({ key: 'vault', label: 'Dokumenty i wyniki wgrane przez Ciebie, odczyty, pliki, odpowiedzi w ankietach', status: 'deleted', count: n + intake.length, detail: 'Usunięte trwale, razem z historią wersji.' });

  // 3. wpisy z aplikacji: pomiary i lista leków wprowadzone przez pacjenta
  const obs = (await fhirSystem().search<Observation>('Observation', { subject: patientRef, _count: '5000' })).filter((o) => o.performer?.[0]?.reference === patientRef);
  const meds = (await fhirSystem().search<MedicationStatement>('MedicationStatement', { subject: patientRef, _count: '1000' })).filter((m) => m.informationSource?.reference === patientRef);
  const m = await expungeAll([...obs, ...meds]);
  transaction(db, () => {
    db.prepare('DELETE FROM med_schedule WHERE patient_ref = ?').run(patientRef);
    db.prepare('DELETE FROM custom_reminder WHERE patient_ref = ?').run(patientRef);
    db.prepare('DELETE FROM preventive_status WHERE patient_ref = ?').run(patientRef);
    db.prepare('DELETE FROM emergency_contact WHERE patient_ref = ?').run(patientRef);
    db.prepare('DELETE FROM setting WHERE key = ?').run(`emergency:${patientRef}`);
  });
  steps.push({ key: 'entries', label: 'Pomiary, leki, przypomnienia, osoby bliskie i karta ratunkowa', status: 'deleted', count: m, detail: 'Wpisy wprowadzone przez Ciebie w aplikacji.' });
  return steps;
}

/**
 * Usunięcie profilu prowadzonego przez opiekuna (dziecko, osoba pod opieką — A24.1): dane własne profilu jak przy
 * usunięciu konta, profil oznaczony jako nieaktywny. Dokumentacja placówek i dziennik zdarzeń zostają.
 */
export async function deleteManagedProfileData(actor: AuditActor, patientRef: string): Promise<DeletionStep[]> {
  const steps = await erasePatientData(actor, patientRef);
  const p = await fhirSystem().readOptional<Patient>('Patient', patientRef.split('/')[1] ?? '');
  if (p) await fhirSystem().update<Patient>({ ...p, active: false });
  audit(actor, { action: 'D', subtype: 'managed-profile-deleted', patientRef, detail: { steps: steps.map((x) => `${x.key}:${x.status}:${x.count ?? ''}`) } });
  return steps;
}

export async function deleteMyData(actor: AuditActor, user: AppUser): Promise<DeletionConfirmation> {
  const patientRef = user.fhir_ref ?? '';
  const id = newId();
  const requestedAt = nowIso();
  const db = getDb();
  db.prepare("INSERT INTO deletion_job (id, user_id, patient_ref, requested_at, status, steps) VALUES (?, ?, ?, ?, 'running', '[]')").run(id, user.id, patientRef || null, requestedAt);
  const steps: DeletionStep[] = patientRef ? await erasePatientData(actor, patientRef) : [];

  // profile dzieci i osób pod opieką, których ta osoba była jedynym opiekunem, nie mogą zostać bez opiekuna
  const managed = db
    .prepare("SELECT DISTINCT patient_ref FROM proxy_link WHERE proxy_user_id = ? AND status = 'active' AND managed = 1")
    .all(user.id) as { patient_ref: string }[];
  let orphaned = 0;
  for (const m of managed) {
    const others = db
      .prepare("SELECT COUNT(*) AS n FROM proxy_link WHERE patient_ref = ? AND status = 'active' AND access = 'full' AND proxy_user_id <> ?")
      .get(m.patient_ref, user.id) as { n: number };
    if (others.n === 0) {
      await deleteManagedProfileData(actor, m.patient_ref);
      orphaned++;
    }
  }
  const resigned = db
    .prepare("UPDATE proxy_link SET status = 'revoked', revoked_at = ?, revoked_by = ?, code_hash = NULL WHERE proxy_user_id = ? AND status IN ('pending', 'active')")
    .run(nowIso(), user.id, user.id);
  if (managed.length || Number(resigned.changes)) {
    steps.push({
      key: 'family',
      label: 'Profile dzieci i osób pod opieką',
      status: 'deleted',
      count: orphaned,
      detail: 'Profile, w których byłeś jedynym opiekunem, usunięto razem z ich danymi; z pozostałych profili zostałeś wypisany.',
    });
  }

  // 4. konto: logowanie, klucze, urządzenia, powiadomienia, preferencje
  transaction(db, () => {
    for (const sql of [
      'DELETE FROM webauthn_credential WHERE user_id = ?',
      'DELETE FROM recovery_code WHERE user_id = ?',
      'DELETE FROM user_pref WHERE user_id = ?',
      'DELETE FROM app_code WHERE user_id = ?',
      'DELETE FROM push_subscription WHERE user_id = ?',
      'DELETE FROM integration_token WHERE user_id = ?',
      'DELETE FROM notification WHERE user_id = ?',
      "DELETE FROM outbox WHERE user_id = ? AND status = 'pending'",
      'DELETE FROM record_read WHERE user_id = ?',
      "UPDATE waitlist_entry SET status = 'removed' WHERE user_id = ?",
    ])
      db.prepare(sql).run(user.id);
  });
  destroyAllSessions(user.id);
  updateUser(user.id, { status: 'disabled', password_hash: 'deleted', totp_secret: null, totp_enabled: false, phone: null, phone_verified: false, display_name: 'Konto usunięte' });
  db.prepare('UPDATE app_user SET email = ? WHERE id = ?').run(`deleted-${user.id}@invalid`, user.id);
  steps.push({ key: 'account', label: 'Konto, hasło, klucze dostępu, urządzenia, powiadomienia i preferencje', status: 'deleted', detail: 'Adres e-mail zwolniony; logowanie niemożliwe.' });

  // 5. dostawcy zewnętrzni (rejestr dostawców — R8, K16)
  steps.push({ key: 'ai', label: 'Model językowy i odczyt dokumentów (Bedrock/Anthropic, Mistral, Google Document AI)', status: 'not-stored', detail: 'Przetwarzanie bez przechowywania treści; rejestr wywołań Eternal nie zawiera danych medycznych.' });
  steps.push({ key: 'sms', label: 'Bramka SMS i poczta e-mail', status: 'kept', detail: 'Operator przechowuje numer i datę wysłanych wiadomości przez okres wymagany prawem telekomunikacyjnym; treść bez danych o zdrowiu.' });

  // 6. co musi zostać
  steps.push({ key: 'clinic-records', label: 'Dokumentacja medyczna w placówkach (notatki z wizyt, wyniki wprowadzone przez placówkę, karty „Po wizycie”, zgody)', status: 'kept', detail: 'Placówka przechowuje ją 20 lat (art. 29 ustawy o prawach pacjenta). Wniosek o dostęp lub sprostowanie — do placówki.' });
  steps.push({ key: 'audit', label: 'Dziennik zdarzeń (kto, co, kiedy — bez treści medycznej)', status: 'kept', detail: 'Wymagany do rozliczalności (art. 5 ust. 2 RODO) i bezpieczeństwa.' });
  const backupDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 35);
  const backupsGoneBy = new Date(Date.now() + backupDays * 86_400_000).toISOString();
  steps.push({ key: 'backups', label: 'Kopie zapasowe', status: 'scheduled', detail: `Dane znikną z kopii zapasowych najpóźniej ${backupsGoneBy.slice(0, 10)} (rotacja ${backupDays} dni); kopie są szyfrowane i nie są używane do bieżącej pracy.` });

  const completedAt = nowIso();
  db.prepare("UPDATE deletion_job SET status = 'completed', steps = ?, completed_at = ? WHERE id = ?").run(JSON.stringify(steps), completedAt, id);
  audit(actor, { action: 'D', subtype: 'patient-data-deleted', patientRef: patientRef || undefined, detail: { job: id, steps: steps.map((s) => `${s.key}:${s.status}:${s.count ?? ''}`) } });
  const confirmation: DeletionConfirmation = { id, requestedAt, completedAt, steps, backupsGoneBy };
  if (user.email && !user.email.endsWith('@invalid')) {
    enqueue({
      channel: 'email',
      recipient: user.email,
      subject: 'Potwierdzenie usunięcia danych',
      body: `Twoje dane w Eternal zostały usunięte (${completedAt.slice(0, 16).replace('T', ' ')} UTC, nr ${id}).\n\n${steps.map((s) => `• ${s.label}: ${STATUS_PL[s.status]}${s.count !== undefined ? ` (${s.count})` : ''} — ${s.detail}`).join('\n')}`,
      dedupeKey: `deletion:${id}`,
    });
  }
  return confirmation;
}

const STATUS_PL: Record<DeletionStep['status'], string> = { deleted: 'usunięte', kept: 'zostaje', scheduled: 'zaplanowane', 'not-stored': 'nie przechowujemy' };

export function confirmationHtml(c: DeletionConfirmation): string {
  const rows = c.steps.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(STATUS_PL[s.status])}${s.count !== undefined ? ` (${s.count})` : ''}</td><td class="small">${esc(s.detail)}</td></tr>`).join('');
  return documentHtml({
    title: 'Potwierdzenie usunięcia danych',
    subtitle: `Nr ${c.id}`,
    meta: [
      ['Wniosek', c.requestedAt.slice(0, 16).replace('T', ' ')],
      ['Wykonano', c.completedAt.slice(0, 16).replace('T', ' ')],
    ],
    body: `<table><thead><tr><th>Zakres</th><th>Stan</th><th>Wyjaśnienie</th></tr></thead><tbody>${rows}</tbody></table>`,
    templateVersion: 'usuniecie-danych/2026-10-1',
    demo: config.demoMode,
  });
}
