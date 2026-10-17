import { z } from 'zod';
import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import { AiError, type ProviderResult } from './types.js';

/**
 * Mistral (UE) — drugi dostawca modelu językowego przy awarii dostawcy podstawowego
 * (plik 12.8, A7 poz. 8: „zapas Mistral”). Wyjście JSON według schematu, walidowane Zod.
 */
export async function callMistral<T>(input: { system: string; user: string; schema: z.ZodType<T>; maxTokens: number; name: string }): Promise<ProviderResult<T>> {
  if (!config.ai.mistralApiKey) throw new AiError('not_configured', 'MISTRAL_API_KEY not set');
  let res: Response;
  try {
    res = await fetchWithTimeout(
      'https://api.mistral.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.ai.mistralApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ai.mistralModel,
          max_tokens: input.maxTokens,
          temperature: 0,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
          response_format: { type: 'json_schema', json_schema: { name: input.name.replace(/[^a-zA-Z0-9_-]/g, '_'), schema: z.toJSONSchema(input.schema), strict: true } },
        }),
      },
      config.ai.timeoutMs,
    );
  } catch (err) {
    throw new AiError('provider_unreachable', (err as Error).message);
  }
  if (res.status === 429) throw new AiError('rate_limited', 'Mistral 429');
  if (res.status === 401 || res.status === 403) throw new AiError('auth', `Mistral ${res.status}`);
  if (!res.ok) throw new AiError('provider_error', `Mistral ${res.status}`);
  const json = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = json.choices?.[0];
  if (choice?.finish_reason === 'length') throw new AiError('truncated', 'Mistral output truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice?.message?.content ?? '');
  } catch {
    throw new AiError('invalid_output', 'Mistral returned non-JSON');
  }
  const check = input.schema.safeParse(parsed);
  if (!check.success) throw new AiError('invalid_output', 'Mistral output does not match schema');
  return { data: check.data, model: json.model ?? config.ai.mistralModel, inputUnits: json.usage?.prompt_tokens, outputUnits: json.usage?.completion_tokens };
}
