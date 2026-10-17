import Anthropic, { betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { config } from '../config.js';
import { AiError, type ProviderResult } from './types.js';

/**
 * Claude przez Amazon Bedrock (klient Mantle, region UE) albo bezpośrednio API Anthropic.
 * Ustrukturyzowane wyjście (output_config.format) + walidacja schematem Zod po stronie SDK.
 * Odmowy modelu są ponawiane na modelu zapasowym (middleware SDK) — gdy cały łańcuch odmówi,
 * zgłaszamy błąd „refusal”, a funkcja przechodzi w tryb ręczny.
 */

type Tier = 'note' | 'fast';
type Client = Anthropic | AnthropicBedrockMantle;

const clients = new Map<Tier, Client>();

function client(tier: Tier): Client {
  const hit = clients.get(tier);
  if (hit) return hit;
  const fallbackModel = tier === 'note' ? config.ai.fallbackModelNote : config.ai.fallbackModelFast;
  const middleware = config.ai.refusalFallback && fallbackModel ? [betaRefusalFallbackMiddleware([{ model: fallbackModel }])] : [];
  const c: Client =
    config.ai.provider === 'bedrock'
      ? new AnthropicBedrockMantle({ awsRegion: config.ai.awsRegion, middleware, timeout: config.ai.timeoutMs, maxRetries: 2 })
      : new Anthropic({ middleware, timeout: config.ai.timeoutMs, maxRetries: 2 });
  clients.set(tier, c);
  return c;
}

export async function callClaude<T>(input: {
  tier: Tier;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
}): Promise<ProviderResult<T>> {
  const model = input.tier === 'note' ? config.ai.modelNote : config.ai.modelFast;
  try {
    const res = await client(input.tier).beta.messages.parse({
      model,
      max_tokens: input.maxTokens,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
      output_config: { format: betaZodOutputFormat(input.schema as z.ZodType<T> & z.ZodObject), effort: input.effort },
    });
    if (res.stop_reason === 'refusal') throw new AiError('refusal', `model refused (${res.stop_details?.category ?? 'unknown'})`);
    if (res.stop_reason === 'max_tokens') throw new AiError('truncated', 'model output truncated');
    if (res.parsed_output === null || res.parsed_output === undefined) throw new AiError('invalid_output', 'structured output missing');
    return {
      data: res.parsed_output as T,
      model: res.model ?? model,
      inputUnits: res.usage.input_tokens,
      outputUnits: res.usage.output_tokens,
    };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new AiError('rate_limited', err.message);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AiError('auth', err.message);
    if (err instanceof Anthropic.BadRequestError) throw new AiError('bad_request', err.message);
    if (err instanceof Anthropic.APIError) throw new AiError('provider_error', `${err.status ?? ''} ${err.message}`.trim());
    throw new AiError('provider_unreachable', (err as Error).message);
  }
}
