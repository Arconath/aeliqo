interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  readonly limit?: number;
  readonly windowMs?: number;
  readonly now?: () => number;
}

export interface RateLimitVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

/**
 * Fixed-window, per-key in-memory limiter. Used for `POST /pair` per client IP —
 * deliberately small and sweeping lazily so a burst of keys cannot grow the map
 * without bound between windows.
 */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #buckets = new Map<string, Bucket>();

  constructor(options: RateLimiterOptions = {}) {
    this.#limit = options.limit ?? 20;
    this.#windowMs = options.windowMs ?? 60_000;
    this.#now = options.now ?? Date.now;
  }

  allow(key: string): RateLimitVerdict {
    const now = this.#now();
    if (this.#buckets.size > 10_000) this.#sweep(now);
    const bucket = this.#buckets.get(key);
    if (bucket === undefined || bucket.resetAt <= now) {
      this.#buckets.set(key, { count: 1, resetAt: now + this.#windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= this.#limit)
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  #sweep(now: number): void {
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
  }
}
