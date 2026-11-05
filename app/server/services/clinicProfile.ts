import { audit, type AuditActor } from '../audit.js';
import { clinicProfile, CLINIC_PROFILES, type ClinicProfile, type ProfileFeature } from '../content/clinicProfiles.js';
import { HttpError, notFound } from '../lib/util.js';
import { listModules, moduleDef, setModuleFlag } from '../modules.js';
import { NOTE_TEMPLATE_IDS } from '../scribe/templates.js';
import { getClinicSettings, listLocations, listServices, updateClinicSettings, upsertService } from './directory.js';

/**
 * Profile placówek: wybór „produktu” pod rodzaj kliniki. Zastosowanie profilu tylko DODAJE — moduły, usługi,
 * wymagane dokumenty, szablony notatek i specjalizacje; niczego nie usuwa ani nie nadpisuje. Usunięcie profilu
 * wyłącza wyłącznie funkcje profilu (np. deklaracje POZ w menu), dane zostają.
 */

export function orgProfiles(orgId?: string): ClinicProfile[] {
  return (getClinicSettings(orgId).profiles ?? []).map((id) => clinicProfile(id)).filter((p): p is ClinicProfile => !!p);
}

export function orgFeatures(orgId?: string): ProfileFeature[] {
  return [...new Set(orgProfiles(orgId).flatMap((p) => p.features))];
}

export function hasFeature(orgId: string | undefined, f: ProfileFeature): boolean {
  return orgFeatures(orgId).includes(f);
}

export function requireFeature(orgId: string | undefined, f: ProfileFeature): void {
  if (!hasFeature(orgId, f)) throw new HttpError(404, 'profile_feature_off', `feature ${f} not in clinic profile`);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export interface ProfilePreview {
  id: ClinicProfile['id'];
  name: string;
  version: string;
  forWhom: string;
  active: boolean;
  needs: ClinicProfile['needs'];
  gaps: ClinicProfile['gaps'];
  legal: string[];
  interviews: string[];
  changes: {
    features: ProfileFeature[];
    modules: { id: string; name: string }[];
    services: { name: string; durationMinutes: number; mode: string; requiresPhysician?: boolean }[];
    servicesKept: string[];
    requiredDocuments: string[];
    noteTemplates: string[];
    specialties: string[];
  };
}

export async function previewProfile(id: string, orgId?: string): Promise<ProfilePreview> {
  const p = clinicProfile(id);
  if (!p) throw notFound('profile_not_found');
  const settings = getClinicSettings(orgId);
  const modules = listModules(orgId);
  const existing = new Set((await listServices(true)).map((s) => norm(s.name)));
  const active = (settings.profiles ?? []).includes(p.id);
  return {
    id: p.id,
    name: p.name,
    version: p.version,
    forWhom: p.forWhom,
    active,
    needs: p.needs,
    gaps: p.gaps,
    legal: p.legal,
    interviews: p.interviews,
    changes: {
      features: active ? [] : p.features,
      modules: p.modulesOn
        .filter((m) => moduleDef(m).scope === 'org' && moduleDef(m).switchable && !modules.find((x) => x.id === m)?.active)
        .map((m) => ({ id: m, name: moduleDef(m).name })),
      services: p.services.filter((s) => !existing.has(norm(s.name))).map((s) => ({ name: s.name, durationMinutes: s.durationMinutes, mode: s.mode, requiresPhysician: s.requiresPhysician })),
      servicesKept: p.services.filter((s) => existing.has(norm(s.name))).map((s) => s.name),
      requiredDocuments: p.requiredDocuments.filter((d) => !settings.requiredDocuments.some((e) => e.id === d.id)).map((d) => d.label),
      noteTemplates: p.noteTemplates.filter((t) => !settings.noteTemplates.includes(t) && (NOTE_TEMPLATE_IDS as readonly string[]).includes(t)),
      specialties: p.specialties.filter((s) => !settings.specialties.includes(s)),
    },
  };
}

export async function listProfiles(orgId?: string): Promise<ProfilePreview[]> {
  const out: ProfilePreview[] = [];
  for (const p of CLINIC_PROFILES) out.push(await previewProfile(p.id, orgId));
  return out;
}

export async function applyProfile(actor: AuditActor, id: string, orgId?: string): Promise<ProfilePreview> {
  const p = clinicProfile(id);
  if (!p) throw notFound('profile_not_found');
  const preview = await previewProfile(id, orgId);
  for (const m of preview.changes.modules) setModuleFlag(actor, m.id, { enabled: true }, orgId);
  const locations = (await listLocations()).map((l) => l.id);
  const wanted = new Set(preview.changes.services.map((s) => s.name));
  for (const s of p.services.filter((x) => wanted.has(x.name))) {
    await upsertService(actor, {
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      mode: s.mode,
      program: s.program,
      specialty: s.specialty,
      active: true,
      locationIds: s.mode === 'tele' ? [] : locations,
      vat: s.vat,
      requiresPhysician: s.requiresPhysician,
      consentTemplate: s.consentTemplate,
      controlAfterDays: s.controlAfterDays,
      purposeDefault: s.purposeDefault,
    });
  }
  const settings = getClinicSettings(orgId);
  updateClinicSettings(
    actor,
    {
      profiles: [...new Set([...(settings.profiles ?? []), p.id])],
      requiredDocuments: [...settings.requiredDocuments, ...p.requiredDocuments.filter((d) => !settings.requiredDocuments.some((e) => e.id === d.id)).map((d) => ({ ...d }))],
      noteTemplates: [...new Set([...settings.noteTemplates, ...preview.changes.noteTemplates])],
      specialties: [...new Set([...settings.specialties, ...p.specialties])],
    },
    orgId,
  );
  audit(actor, {
    action: 'U',
    subtype: 'clinic-profile-apply',
    detail: { profile: p.id, version: p.version, modules: preview.changes.modules.map((m) => m.id), services: preview.changes.services.length, documents: preview.changes.requiredDocuments.length },
  });
  return previewProfile(id, orgId);
}

export function removeProfile(actor: AuditActor, id: string, orgId?: string): void {
  const settings = getClinicSettings(orgId);
  if (!(settings.profiles ?? []).includes(id)) return;
  updateClinicSettings(actor, { profiles: settings.profiles.filter((x) => x !== id) }, orgId);
  audit(actor, { action: 'U', subtype: 'clinic-profile-remove', detail: { profile: id } });
}
