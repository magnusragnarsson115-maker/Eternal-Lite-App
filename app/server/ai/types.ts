export type AiErrorCode =
  | 'disabled'
  | 'not_allowed'
  | 'limit_exceeded'
  | 'refusal'
  | 'truncated'
  | 'invalid_output'
  | 'rate_limited'
  | 'auth'
  | 'bad_request'
  | 'provider_error'
  | 'provider_unreachable'
  | 'not_configured';

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ProviderResult<T> {
  data: T;
  model: string;
  inputUnits?: number;
  outputUnits?: number;
}
