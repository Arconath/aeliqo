import { describe, expect, it } from 'vitest';
import { PairingRegistry, SESSION_TTL_MS } from '../src/registry.js';
import { isSurface, SURFACES } from '../src/protocol.js';

describe('isSurface', () => {
  it('accepts the known surfaces only', () => {
    expect(SURFACES).toEqual(['playground']);
    expect(isSurface('playground')).toBe(true);
    expect(isSurface('studio')).toBe(false);
    expect(isSurface('')).toBe(false);
    expect(isSurface(42)).toBe(false);
    expect(isSurface({})).toBe(false);
  });
});

describe('PairingRegistry', () => {
  it('mints a surface-bound pair token and resolves it', () => {
    const registry = new PairingRegistry();
    const session = registry.pair('playground');
    expect(session).toBeDefined();
    expect(session!.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(session!.surface).toBe('playground');
    expect(session!.tokenPrefix).toBe(session!.token.slice(0, 8));
    expect(session!.id).toMatch(/^[0-9a-f]{64}$/u);
    expect(session!.id).not.toBe(session!.token);
    expect(registry.resolve(session!.token)).toBe(session);
    registry.dispose();
  });

  it('expires sessions against the injected clock', () => {
    let now = 1_000_000;
    const expired: string[] = [];
    const registry = new PairingRegistry({
      now: () => now,
      ttlMs: 5_000,
      onExpire: (session) => expired.push(session.tokenPrefix),
    });
    const session = registry.pair('playground')!;
    expect(session.expiresAt).toBe(now + 5_000);
    expect(registry.resolve(session.token)).toBe(session);
    now += 5_001;
    expect(registry.resolve(session.token)).toBeUndefined();
    expect(registry.size).toBe(0);
    expect(expired).toEqual([session.tokenPrefix]);
    registry.dispose();
  });

  it('rejects unknown, empty, and oversized tokens', () => {
    const registry = new PairingRegistry();
    registry.pair('playground');
    expect(registry.resolve('bogus')).toBeUndefined();
    expect(registry.resolve('')).toBeUndefined();
    expect(registry.resolve('x'.repeat(200))).toBeUndefined();
    expect(registry.resolve(undefined)).toBeUndefined();
    expect(registry.resolve(null)).toBeUndefined();
    registry.dispose();
  });

  it('refuses new sessions beyond the table cap', () => {
    const registry = new PairingRegistry({ maxSessions: 2 });
    expect(registry.pair('playground')).toBeDefined();
    expect(registry.pair('playground')).toBeDefined();
    expect(registry.pair('playground')).toBeUndefined();
    expect(registry.size).toBe(2);
    registry.dispose();
  });

  it('keeps a freed slot after sweep expiry', () => {
    let now = 0;
    const registry = new PairingRegistry({ now: () => now, ttlMs: 10, maxSessions: 1 });
    expect(registry.pair('playground')).toBeDefined();
    now += 11;
    expect(registry.pair('playground')).toBeDefined();
    registry.dispose();
  });

  it('uses the default 15 minute ttl', () => {
    const registry = new PairingRegistry();
    const before = Date.now();
    const session = registry.pair('playground')!;
    expect(session.expiresAt).toBeGreaterThanOrEqual(before + SESSION_TTL_MS);
    expect(session.expiresAt).toBeLessThanOrEqual(Date.now() + SESSION_TTL_MS);
    registry.dispose();
  });
});
