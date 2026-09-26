import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/rate-limit.js';

describe('RateLimiter', () => {
  it('allows up to the limit inside the window then denies with a retry hint', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.allow('1.2.3.4').allowed).toBe(true);
    expect(limiter.allow('1.2.3.4').allowed).toBe(true);
    expect(limiter.allow('1.2.3.4').allowed).toBe(true);
    const denied = limiter.allow('1.2.3.4');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(limiter.allow('5.6.7.8').allowed).toBe(true);
  });

  it('resets after the window elapses', () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    expect(limiter.allow('ip').allowed).toBe(true);
    expect(limiter.allow('ip').allowed).toBe(false);
    now += 1_001;
    expect(limiter.allow('ip').allowed).toBe(true);
  });
});
