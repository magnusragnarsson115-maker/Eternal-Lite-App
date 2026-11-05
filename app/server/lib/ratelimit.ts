import { HttpError } from './util.js';

/** Prosty limiter okna przesuwnego w pamięci procesu (jedna instancja aplikacji). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    setInterval(() => this.sweep(), Math.max(windowMs, 60_000)).unref();
  }

  check(key: string): void {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.limit) {
      const retryAfter = Math.ceil((this.windowMs - (now - arr[0])) / 1000);
      throw new HttpError(429, 'rate_limited', `Too many requests, retry in ${retryAfter}s`, { retryAfter });
    }
    arr.push(now);
    this.hits.set(key, arr);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((t) => now - t < this.windowMs);
      if (kept.length === 0) this.hits.delete(k);
      else this.hits.set(k, kept);
    }
  }
}

export const authLimiter = new RateLimiter(20, 15 * 60_000);
export const publicApiLimiter = new RateLimiter(60, 60_000);
export const messageLimiter = new RateLimiter(30, 60 * 60_000);
