import { evalFhirPath, getSearchParameters, matchesSearchRequest, parseSearchRequest } from '@medplum/core';
import type { Resource, ResourceType } from '@medplum/fhirtypes';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from '../db.js';
import { chunk, newId, nowIso, sha256 } from '../lib/util.js';
import {
  FhirConflictError,
  FhirNotFoundError,
  type FhirRepository,
  type SearchParams,
  type StoredBinary,
} from './repository.js';
import { loadFhirDefinitions, validateFhir } from './validation.js';

const REF_RE = /^[A-Z][A-Za-z]+\/[A-Za-z0-9\-.]{1,64}$/;
const DEFAULT_COUNT = 1000;
/** Typy, dla których kolumna ts (początek) pozwala zawęzić wyszukiwanie po dacie przed filtrem FHIRPath. */
const TS_PREFILTER: Record<string, string[]> = { Slot: ['start'], Appointment: ['date'] };

interface Row {
  content: string;
}

/**
 * Lokalny magazyn FHIR R4 na SQLite.
 * - Każdy zapis jest walidowany względem specyfikacji FHIR R4 (@medplum/core).
 * - Pełna historia wersji (fhir_history), usunięcie jest logiczne.
 * - Wyszukiwanie: zawężenie po indeksie referencji/dacie, następnie dokładne dopasowanie
 *   semantyką parametrów wyszukiwania FHIR (matchesSearchRequest).
 */
export class LocalFhirRepository implements FhirRepository {
  readonly kind = 'local';

  constructor(private readonly db: DatabaseSync) {}

  async init(): Promise<void> {
    loadFhirDefinitions();
  }

  async create<T extends Resource>(resource: T): Promise<T> {
    return this.writeSync(resource, { mode: 'create' });
  }

  async read<T extends Resource>(type: T['resourceType'], id: string): Promise<T> {
    const found = this.readSync<T>(type, id);
    if (!found) throw new FhirNotFoundError(type, id);
    return found;
  }

  async readOptional<T extends Resource>(type: T['resourceType'], id: string): Promise<T | undefined> {
    return this.readSync<T>(type, id);
  }

  async update<T extends Resource>(resource: T, opts?: { ifMatch?: string }): Promise<T> {
    return this.writeSync(resource, { mode: 'update', ifMatch: opts?.ifMatch });
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    transaction(this.db, () => {
      const current = this.readSync(type, id);
      if (!current) throw new FhirNotFoundError(type, id);
      const version = Number(current.meta?.versionId ?? '0') + 1;
      const now = nowIso();
      this.db.prepare('UPDATE fhir_resource SET deleted = 1, version_id = ?, last_updated = ? WHERE type = ? AND id = ?').run(version, now, type, id);
      this.db
        .prepare('INSERT INTO fhir_history (type, id, version_id, last_updated, content, deleted) VALUES (?, ?, ?, ?, ?, 1)')
        .run(type, id, version, now, JSON.stringify(current));
      this.db.prepare('DELETE FROM fhir_ref WHERE type = ? AND id = ?').run(type, id);
    });
  }

  async search<T extends Resource>(type: T['resourceType'], params: SearchParams = {}): Promise<T[]> {
    const request = parseSearchRequest<T>(type, params);
    const filters = request.filters ?? [];

    let candidateIds: Set<string> | undefined;
    const intersect = (ids: Iterable<string>) => {
      const next = new Set(ids);
      candidateIds = candidateIds ? new Set([...candidateIds].filter((id) => next.has(id))) : next;
    };

    let tsFrom: string | undefined;
    let tsTo: string | undefined;

    for (const f of filters) {
      const op = String(f.operator);
      if (f.code === '_id' && op === 'eq') {
        intersect(f.value.split(','));
        continue;
      }
      if (op === 'eq' && !f.code.startsWith('_')) {
        const values = f.value.split(',');
        if (values.every((v) => REF_RE.test(v))) {
          const ids: string[] = [];
          for (const part of chunk(values, 200)) {
            const rows = this.db
              .prepare(`SELECT DISTINCT id FROM fhir_ref WHERE type = ? AND ref IN (${part.map(() => '?').join(',')})`)
              .all(type, ...part) as { id: string }[];
            ids.push(...rows.map((r) => r.id));
          }
          intersect(ids);
        }
      }
      if (TS_PREFILTER[type]?.includes(f.code)) {
        // zawężenie z zapasem ±1 dzień; dokładny warunek sprawdza matchesSearchRequest
        const t = Date.parse(f.value);
        if (Number.isFinite(t)) {
          if (op === 'ge' || op === 'gt' || op === 'sa') tsFrom = new Date(t - 86_400_000).toISOString();
          if (op === 'le' || op === 'lt' || op === 'eb') tsTo = new Date(t + 2 * 86_400_000).toISOString();
          if (op === 'eq') {
            tsFrom = new Date(t - 86_400_000).toISOString();
            tsTo = new Date(t + 2 * 86_400_000).toISOString();
          }
        }
      }
    }

    let rows: Row[];
    if (candidateIds) {
      rows = [];
      for (const part of chunk([...candidateIds], 400)) {
        if (part.length === 0) continue;
        rows.push(
          ...(this.db
            .prepare(`SELECT content FROM fhir_resource WHERE type = ? AND deleted = 0 AND id IN (${part.map(() => '?').join(',')})`)
            .all(type, ...part) as unknown as Row[]),
        );
      }
    } else {
      const where = ['type = ?', 'deleted = 0'];
      const args: string[] = [type];
      if (tsFrom) { where.push('ts >= ?'); args.push(tsFrom); }
      if (tsTo) { where.push('ts <= ?'); args.push(tsTo); }
      rows = this.db.prepare(`SELECT content FROM fhir_resource WHERE ${where.join(' AND ')}`).all(...args) as unknown as Row[];
    }

    let results = rows.map((r) => JSON.parse(r.content) as T);
    if (filters.length > 0) results = results.filter((r) => matchesSearchRequest(r, request));

    const sortRules = request.sortRules ?? [];
    if (sortRules.length > 0) {
      const defs = getSearchParameters(type) ?? {};
      const keyCache = new Map<T, (string | number | undefined)[]>();
      const keyOf = (r: T) => {
        let k = keyCache.get(r);
        if (!k) {
          k = sortRules.map((rule) => sortKey(r, rule.code, defs[rule.code]?.expression));
          keyCache.set(r, k);
        }
        return k;
      };
      results.sort((a, b) => {
        const ka = keyOf(a);
        const kb = keyOf(b);
        for (let i = 0; i < sortRules.length; i++) {
          const c = compareKeys(ka[i], kb[i]);
          if (c !== 0) return sortRules[i].descending ? -c : c;
        }
        return 0;
      });
    }

    const offset = request.offset ?? 0;
    const count = request.count ?? DEFAULT_COUNT;
    return results.slice(offset, offset + count);
  }

  async history<T extends Resource>(type: T['resourceType'], id: string): Promise<T[]> {
    const rows = this.db
      .prepare('SELECT content FROM fhir_history WHERE type = ? AND id = ? ORDER BY version_id DESC')
      .all(type, id) as unknown as Row[];
    return rows.map((r) => JSON.parse(r.content) as T);
  }

  async saveBinary(data: Buffer, contentType: string): Promise<StoredBinary> {
    const id = newId();
    const hash = sha256(data);
    this.db
      .prepare('INSERT INTO fhir_binary (id, content_type, sha256, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, contentType, hash, data.length, data, nowIso());
    return { id, url: `Binary/${id}`, contentType, size: data.length, sha256: hash };
  }

  async readBinary(id: string): Promise<{ data: Buffer; contentType: string }> {
    const row = this.db.prepare('SELECT content_type, data FROM fhir_binary WHERE id = ?').get(id) as
      | { content_type: string; data: Uint8Array }
      | undefined;
    if (!row) throw new FhirNotFoundError('Binary', id);
    return { data: Buffer.from(row.data), contentType: row.content_type };
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM fhir_resource WHERE deleted = 0').get() as { n: number };
    return { ok: true, detail: `SQLite, ${row.n} zasobów FHIR` };
  }

  // ---------------------------------------------------------------------------

  private readSync<T extends Resource>(type: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT content FROM fhir_resource WHERE type = ? AND id = ? AND deleted = 0').get(type, id) as
      | Row
      | undefined;
    return row ? (JSON.parse(row.content) as T) : undefined;
  }

  private writeSync<T extends Resource>(input: T, opts: { mode: 'create' | 'update'; ifMatch?: string }): T {
    return transaction(this.db, () => {
      const type = input.resourceType;
      const id = opts.mode === 'create' ? (input.id ?? newId()) : input.id;
      if (!id) throw new Error('update requires id');
      const existing = this.db.prepare('SELECT version_id, deleted FROM fhir_resource WHERE type = ? AND id = ?').get(type, id) as
        | { version_id: number; deleted: number }
        | undefined;
      if (opts.mode === 'create' && existing) throw new FhirConflictError(`${type}/${id} already exists`);
      if (opts.mode === 'update' && opts.ifMatch !== undefined) {
        const expected = opts.ifMatch.replace(/^W\//, '').replace(/"/g, '');
        if (!existing || existing.deleted || String(existing.version_id) !== expected) {
          throw new FhirConflictError(`${type}/${id}: expected version ${expected}, found ${existing?.version_id ?? 'none'}`);
        }
      }
      const version = (existing?.version_id ?? 0) + 1;
      const now = nowIso();
      const resource = {
        ...input,
        id,
        meta: { ...input.meta, versionId: String(version), lastUpdated: now },
      } as T;
      validateFhir(resource);
      const content = JSON.stringify(resource);
      this.db
        .prepare(
          `INSERT INTO fhir_resource (type, id, version_id, last_updated, ts, content, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(type, id) DO UPDATE SET version_id = excluded.version_id, last_updated = excluded.last_updated,
             ts = excluded.ts, content = excluded.content, deleted = 0`,
        )
        .run(type, id, version, now, extractTs(resource) ?? null, content);
      this.db
        .prepare('INSERT INTO fhir_history (type, id, version_id, last_updated, content, deleted) VALUES (?, ?, ?, ?, ?, 0)')
        .run(type, id, version, now, content);
      this.db.prepare('DELETE FROM fhir_ref WHERE type = ? AND id = ?').run(type, id);
      const insertRef = this.db.prepare('INSERT INTO fhir_ref (type, id, ref) VALUES (?, ?, ?)');
      for (const ref of extractRefs(resource)) insertRef.run(type, id, ref);
      return resource;
    });
  }
}

function extractRefs(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) extractRefs(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'reference' && typeof v === 'string' && REF_RE.test(v)) out.add(v);
      else if (typeof v === 'object') extractRefs(v, out);
    }
  }
  return out;
}

function normalizeInstant(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

function extractTs(r: Resource): string | undefined {
  const a = r as unknown as Record<string, unknown>;
  return (
    normalizeInstant(a.start) ??
    normalizeInstant(a.effectiveDateTime) ??
    normalizeInstant((a.effectivePeriod as { start?: string } | undefined)?.start) ??
    normalizeInstant(a.issued) ??
    normalizeInstant(a.sent) ??
    normalizeInstant(a.authored) ??
    normalizeInstant(a.authoredOn) ??
    normalizeInstant(a.dateTime) ??
    normalizeInstant(a.date) ??
    normalizeInstant(a.recorded)
  );
}

function sortKey(resource: Resource, code: string, expression: string | undefined): string | number | undefined {
  let value: unknown;
  if (code === '_lastUpdated') value = resource.meta?.lastUpdated;
  else if (code === '_id') value = resource.id;
  else if (expression) value = evalFhirPath(expression, resource)[0];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.start === 'string') value = o.start;
    else if (typeof o.family === 'string') value = `${o.family} ${(o.given as string[] | undefined)?.join(' ') ?? ''}`;
    else if (typeof o.reference === 'string') value = o.reference;
    else if (typeof o.text === 'string') value = o.text;
    else value = JSON.stringify(o);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}(-\d{2})?(T.*)?$/.test(s)) {
    const t = Date.parse(s);
    if (Number.isFinite(t)) return t;
  }
  return s.toLocaleLowerCase('pl');
}

function compareKeys(a: string | number | undefined, b: string | number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pl');
}
