import crypto from 'node:crypto';
import { audit, type AuditActor } from './audit.js';
import { badRequest, HttpError } from './lib/util.js';
import { getSetting, setSetting } from './settings.js';
import { currentScope, defaultOrgId } from './tenancy.js';

/**
 * Rejestr modułów aplikacji (plik 12.8 — Doctor D0–D12, Pacjent P1–P14, rdzeń R1–R10) i przełączniki
 * (R10 — składanie produktu dla kliniki; A18.7 — kontrolowana dystrybucja aktualizacji).
 *
 * - moduły Doctor włącza administrator kliniki (ustawienie per organizacja),
 * - moduły pacjenta i wdrożenie stopniowe (odsetek kont) ustawia operator instancji (CLI),
 * - moduły bezpieczeństwa (np. numery kryzysowe F8.1) nie mają przełącznika.
 */

export type ModuleArea = 'doctor' | 'patient' | 'core';
export type ModuleStage = 'pilot' | 'mvp1' | 'mvp';

export interface ModuleDef {
  id: string;
  code: string;
  area: ModuleArea;
  stage: ModuleStage;
  name: string;
  description: string;
  /** false — zawsze włączony (obowiązkowy). */
  switchable: boolean;
  /** Kto przełącza: klinika (administrator) albo operator instancji. */
  scope: 'org' | 'global';
}

export const MODULES: ModuleDef[] = [
  { id: 'staff', code: 'D0', area: 'doctor', stage: 'pilot', name: 'Konta kliniki, role, rozliczenia, incydenty', description: 'Zaproszenia personelu, role, odebranie dostępu, licznik użycia, faktura, zgłoszenia.', switchable: false, scope: 'org' },
  { id: 'invite', code: 'D1', area: 'doctor', stage: 'pilot', name: 'Zaproszenie i przyjęcie danych od pacjenta', description: 'SMS z linkiem albo kod QR, zgoda, wgranie dokumentów bez konta, dziennik odczytów, wygasanie dostępu.', switchable: true, scope: 'org' },
  { id: 'inbox', code: 'D2', area: 'doctor', stage: 'pilot', name: 'Skrzynka materiałów i kompletność', description: 'Lista wizyt dnia z paskiem kompletności, filtr braków, przypomnienia.', switchable: true, scope: 'org' },
  { id: 'facts', code: 'D3', area: 'doctor', stage: 'pilot', name: 'Raport faktów przed wizytą', description: 'Wyniki z datą, jednostką i zakresem z dokumentu, odnośniki do źródeł, PDF.', switchable: true, scope: 'org' },
  { id: 'scribe', code: 'D5', area: 'doctor', stage: 'pilot', name: 'Eternal Scribe i karta „Po wizycie”', description: 'Nagranie za zgodą → szkic notatki ze źródłami → zatwierdzenie → PDF; podsumowanie dla pacjenta.', switchable: true, scope: 'org' },
  { id: 'video', code: 'D7', area: 'doctor', stage: 'mvp1', name: 'Wideo, rezerwacje, przypomnienia', description: 'Wizyta wideo w przeglądarce z poczekalnią, przypomnienia 24 h i 2 h, przypomnienia o lekach.', switchable: true, scope: 'org' },
  { id: 'metrics', code: 'D12', area: 'doctor', stage: 'pilot', name: 'Mierniki pilotażu i jakości', description: 'Czas dokumentacji, kompletność, poprawki notatek, ankieta lekarza, raport miesięczny.', switchable: true, scope: 'org' },
  { id: 'patient-sharing', code: 'P2', area: 'patient', stage: 'mvp', name: 'Udostępnianie na czas i „kto oglądał”', description: 'Komu udostępniam (zakres × odbiorca × czas), wycofanie jednym ruchem, dziennik dostępu.', switchable: true, scope: 'global' },
  { id: 'patient-intake', code: 'P3', area: 'patient', stage: 'mvp', name: 'Dokumenty i wyniki w aplikacji', description: 'Skan albo PDF, odczyt z potwierdzeniem, oś czasu z wersjami.', switchable: true, scope: 'global' },
  { id: 'manual-entries', code: 'P4', area: 'patient', stage: 'mvp', name: 'Wpisy ręczne i korekta', description: 'Pomiar z listy parametrów z kontrolą jednostek; korekta z powodem i historią.', switchable: true, scope: 'global' },
  { id: 'patient-surveys', code: 'A12.3', area: 'patient', stage: 'mvp', name: 'Ankiety zdrowotne i ocena aplikacji', description: 'Ankieta na start, po nowych wynikach, kontrolna po kilku raportach; anonimowa ocena aplikacji. Bez oceny odpowiedzi.', switchable: true, scope: 'global' },
  { id: 'notifications', code: 'P8', area: 'patient', stage: 'mvp', name: 'Powiadomienia i przypomnienia', description: 'Push → e-mail → SMS, preferencje, godziny ciszy.', switchable: false, scope: 'global' },
  { id: 'sos', code: 'P14', area: 'patient', stage: 'mvp', name: 'Ratunek jednym kliknięciem (SOS)', description: 'Karta ratunkowa, osoby bliskie, połączenie 112.', switchable: true, scope: 'global' },
  { id: 'crisis', code: 'P14', area: 'patient', stage: 'mvp', name: 'Numery kryzysowe 112 i 116 123', description: 'Zawsze widoczne w menu pomocy; nie do wyłączenia (F8.1).', switchable: false, scope: 'global' },
];

interface FlagValue {
  enabled: boolean;
  /** Odsetek kont (0–100) objętych modułem — wdrożenie stopniowe (A18.7). */
  rollout: number;
}

type FlagMap = Record<string, FlagValue>;

function key(scope: 'org' | 'global', orgId?: string): string {
  return scope === 'global' ? 'modules:global' : `modules:${orgId ?? defaultOrgId() ?? 'default'}`;
}

export function moduleDef(id: string): ModuleDef {
  const def = MODULES.find((m) => m.id === id);
  if (!def) throw badRequest('unknown_module');
  return def;
}

function flagFor(def: ModuleDef, orgId?: string): FlagValue {
  if (!def.switchable) return { enabled: true, rollout: 100 };
  const map = getSetting<FlagMap>(key(def.scope, orgId)) ?? {};
  return map[def.id] ?? { enabled: true, rollout: 100 };
}

/** Deterministyczny przydział konta do grupy wdrożenia (ten sam wynik przy każdym żądaniu). */
export function inRollout(moduleId: string, subject: string, rollout: number): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  const h = crypto.createHash('sha256').update(`${moduleId}:${subject}`).digest();
  return h.readUInt16BE(0) % 100 < rollout;
}

export function moduleEnabled(id: string, opts: { orgId?: string; subject?: string } = {}): boolean {
  const def = moduleDef(id);
  const orgId = opts.orgId ?? currentScope()?.orgId ?? currentScope()?.patientOrgIds?.[0];
  const flag = flagFor(def, orgId);
  if (!flag.enabled) return false;
  return opts.subject ? inRollout(id, opts.subject, flag.rollout) : flag.rollout > 0;
}

export function requireModule(id: string, opts: { orgId?: string; subject?: string } = {}): void {
  if (!moduleEnabled(id, opts)) throw new HttpError(404, 'module_disabled', `module ${id} disabled`);
}

export function listModules(orgId?: string, subject?: string) {
  return MODULES.map((m) => {
    const flag = flagFor(m, orgId);
    return { ...m, enabled: flag.enabled, rollout: flag.rollout, active: flag.enabled && (subject ? inRollout(m.id, subject, flag.rollout) : flag.rollout > 0) };
  });
}

export function setModuleFlag(actor: AuditActor | undefined, id: string, value: Partial<FlagValue>, orgId?: string): void {
  const def = moduleDef(id);
  if (!def.switchable) throw badRequest('module_not_switchable');
  if (value.rollout !== undefined && !(value.rollout >= 0 && value.rollout <= 100)) throw badRequest('invalid_rollout');
  const k = key(def.scope, orgId);
  const map = getSetting<FlagMap>(k) ?? {};
  map[id] = { ...(map[id] ?? { enabled: true, rollout: 100 }), ...value };
  setSetting(k, map);
  audit(actor, { action: 'U', subtype: 'module-flag', detail: { module: id, scope: def.scope, orgId: def.scope === 'org' ? orgId : undefined, ...map[id] } });
}
