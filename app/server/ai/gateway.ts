import type { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { newId, nowIso } from '../lib/util.js';
import { currentOrgId } from '../tenancy.js';
import { callClaude } from './anthropic.js';
import { callMistral } from './mistral.js';
import { type AiTask, PROMPTS } from './prompts.js';
import { AiError, type ProviderResult } from './types.js';

/**
 * Brama modeli (moduł R5, K14): jedyne miejsce, przez które aplikacja woła modele językowe.
 * - lista dozwolonych zadań (bez zadań oceny stanu zdrowia),
 * - limit wywołań na organizację i dobę,
 * - rejestr wywołań BEZ treści medycznych: zadanie, dostawca, model, wersja polecenia, liczby tokenów, czas, wynik (A19.6),
 * - zapasowy dostawca z UE przy awarii dostawcy podstawowego.
 */

interface TaskSpec {
  tier: 'note' | 'fast';
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
}

const SPECS: Record<AiTask, TaskSpec> = {
  'lab-extract': { tier: 'fast', maxTokens: 8000, effort: 'low' },
  'doc-structure': { tier: 'fast', maxTokens: 4000, effort: 'low' },
  'scribe-note': { tier: 'note', maxTokens: 16000, effort: 'medium' },
  'scribe-validate': { tier: 'fast', maxTokens: 8000, effort: 'low' },
  'patient-summary': { tier: 'fast', maxTokens: 4000, effort: 'low' },
};

export type AiMode = 'model' | 'demo' | 'off';

export function aiMode(): AiMode {
  if (config.ai.provider === 'bedrock' || config.ai.provider === 'anthropic') return 'model';
  if (config.ai.provider === 'demo' && config.demoMode) return 'demo';
  return 'off';
}

export interface AiRun<T> {
  data: T;
  provider: string;
  model: string;
  promptVersion: string;
  /** Wynik reguł deterministycznych zamiast modelu (tryb demonstracyjny). */
  demo: boolean;
}

function logCall(row: {
  task: AiTask;
  provider: string;
  model?: string;
  promptVersion: string;
  orgId?: string;
  userId?: string;
  inputUnits?: number;
  outputUnits?: number;
  latencyMs: number;
  outcome: 'ok' | 'error' | 'refusal';
  errorCode?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO ai_call (id, ts, org_id, user_id, task, provider, model, prompt_version, input_units, output_units, latency_ms, outcome, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      nowIso(),
      row.orgId ?? null,
      row.userId ?? null,
      row.task,
      row.provider,
      row.model ?? null,
      row.promptVersion,
      row.inputUnits ?? null,
      row.outputUnits ?? null,
      row.latencyMs,
      row.outcome,
      row.errorCode ?? null,
    );
}

function checkLimit(orgId: string | undefined): void {
  if (!orgId) return;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM ai_call WHERE org_id = ? AND ts >= ? AND provider <> 'demo'").get(orgId, since) as { n: number };
  if (row.n >= config.ai.dailyCallLimitPerOrg) throw new AiError('limit_exceeded', 'daily AI call limit reached');
}

export async function runAiTask<T>(
  task: AiTask,
  opts: { user: string; schema: z.ZodType<T>; demo?: () => T; orgId?: string; userId?: string },
): Promise<AiRun<T>> {
  if (!(task in PROMPTS)) throw new AiError('not_allowed', `task ${String(task)} not allowed`);
  const prompt = PROMPTS[task];
  const spec = SPECS[task];
  const orgId = opts.orgId ?? currentOrgId();
  const mode = aiMode();

  if (mode === 'off') throw new AiError('disabled', 'AI provider disabled');
  if (mode === 'demo') {
    if (!opts.demo) throw new AiError('not_configured', 'no demo implementation');
    const t0 = Date.now();
    const data = opts.demo();
    logCall({ task, provider: 'demo', promptVersion: prompt.version, orgId, userId: opts.userId, latencyMs: Date.now() - t0, outcome: 'ok' });
    return { data, provider: 'demo', model: 'reguły demonstracyjne', promptVersion: prompt.version, demo: true };
  }

  checkLimit(orgId);
  const attempts: { provider: string; call: () => Promise<ProviderResult<T>> }[] = [
    {
      provider: config.ai.provider,
      call: () => callClaude({ tier: spec.tier, system: prompt.system, user: opts.user, schema: opts.schema, maxTokens: spec.maxTokens, effort: spec.effort }),
    },
  ];
  if (config.ai.secondary === 'mistral') {
    attempts.push({ provider: 'mistral', call: () => callMistral({ system: prompt.system, user: opts.user, schema: opts.schema, maxTokens: spec.maxTokens, name: task }) });
  }

  let lastError: AiError | undefined;
  for (const attempt of attempts) {
    const t0 = Date.now();
    try {
      const res = await attempt.call();
      logCall({
        task,
        provider: attempt.provider,
        model: res.model,
        promptVersion: prompt.version,
        orgId,
        userId: opts.userId,
        inputUnits: res.inputUnits,
        outputUnits: res.outputUnits,
        latencyMs: Date.now() - t0,
        outcome: 'ok',
      });
      return { data: res.data, provider: attempt.provider, model: res.model, promptVersion: prompt.version, demo: false };
    } catch (err) {
      const e = err instanceof AiError ? err : new AiError('provider_error', (err as Error).message);
      logCall({
        task,
        provider: attempt.provider,
        promptVersion: prompt.version,
        orgId,
        userId: opts.userId,
        latencyMs: Date.now() - t0,
        outcome: e.code === 'refusal' ? 'refusal' : 'error',
        errorCode: e.code,
      });
      lastError = e;
      // błąd żądania (zły schemat/parametry) nie zniknie u drugiego dostawcy
      if (e.code === 'bad_request') break;
    }
  }
  throw lastError ?? new AiError('provider_error', 'no provider');
}

/** Zestawienie rejestru wywołań dla panelu (bez treści). */
export function aiCallStats(orgId: string | undefined, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const where = orgId ? 'WHERE ts >= ? AND org_id = ?' : 'WHERE ts >= ?';
  const args = orgId ? [since, orgId] : [since];
  return getDb()
    .prepare(
      `SELECT task, provider, model, prompt_version, outcome, COUNT(*) AS calls, SUM(COALESCE(input_units,0)) AS input_units,
              SUM(COALESCE(output_units,0)) AS output_units, CAST(AVG(latency_ms) AS INTEGER) AS avg_latency_ms
       FROM ai_call ${where} GROUP BY task, provider, model, prompt_version, outcome ORDER BY task`,
    )
    .all(...args) as {
    task: string;
    provider: string;
    model: string | null;
    prompt_version: string;
    outcome: string;
    calls: number;
    input_units: number;
    output_units: number;
    avg_latency_ms: number;
  }[];
}
