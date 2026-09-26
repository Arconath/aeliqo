import { createHash, randomBytes } from 'node:crypto';
import { RelaySessionBroker } from './broker.js';
import type { Surface } from './protocol.js';

const PAIR_TOKEN_BYTES = 32;
export const SESSION_TTL_MS = 15 * 60_000;

/** One bound pairing: the token hash is the lookup key; the raw token is never stored. */
export interface RelaySession {
  readonly id: string;
  readonly surface: Surface;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly tokenPrefix: string;
  readonly broker: RelaySessionBroker;
}

export interface PairedSession extends RelaySession {
  readonly token: string;
}

export interface RegistryOptions {
  readonly now?: () => number;
  readonly ttlMs?: number;
  readonly maxSessions?: number;
  readonly sweepIntervalMs?: number;
  readonly maxPending?: number;
  readonly callTimeoutMs?: number;
  readonly onExpire?: (session: RelaySession) => void;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * In-memory pairing table. Sessions are keyed by the SHA-256 of the pair token
 * so the raw credential never rests in process state; expiry is enforced on
 * every resolve and by a periodic sweep that disposes stale brokers.
 */
export class PairingRegistry {
  readonly #now: () => number;
  readonly #ttlMs: number;
  readonly #maxSessions: number;
  readonly #maxPending: number;
  readonly #callTimeoutMs: number;
  readonly #onExpire: ((session: RelaySession) => void) | undefined;
  readonly #sessions = new Map<string, RelaySession>();
  readonly #sweeper: NodeJS.Timeout;

  constructor(options: RegistryOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#ttlMs = options.ttlMs ?? SESSION_TTL_MS;
    this.#maxSessions = options.maxSessions ?? 5_000;
    this.#maxPending = options.maxPending ?? 2;
    this.#callTimeoutMs = options.callTimeoutMs ?? 30_000;
    this.#onExpire = options.onExpire;
    this.#sweeper = setInterval(() => this.sweep(), options.sweepIntervalMs ?? 30_000);
    this.#sweeper.unref();
  }

  get size(): number {
    return this.#sessions.size;
  }

  /** Mint a fresh pair token for a surface. Returns undefined when the table is full. */
  pair(surface: Surface): PairedSession | undefined {
    this.sweep();
    if (this.#sessions.size >= this.#maxSessions) return undefined;
    const now = this.#now();
    const token = randomBytes(PAIR_TOKEN_BYTES).toString('base64url');
    const id = hashToken(token);
    const session: PairedSession = {
      id,
      token,
      surface,
      createdAt: now,
      expiresAt: now + this.#ttlMs,
      tokenPrefix: token.slice(0, 8),
      broker: new RelaySessionBroker({
        surface,
        expiresAt: now + this.#ttlMs,
        maxPending: this.#maxPending,
        callTimeoutMs: this.#callTimeoutMs,
      }),
    };
    this.#sessions.set(id, session);
    return session;
  }

  /** Resolve a presented bearer/query token to its live, unexpired session. */
  resolve(token: unknown): RelaySession | undefined {
    if (typeof token !== 'string' || token.length === 0 || token.length > 128) return undefined;
    const session = this.#sessions.get(hashToken(token));
    if (session === undefined) return undefined;
    if (session.expiresAt <= this.#now()) {
      this.#evict(session);
      return undefined;
    }
    return session;
  }

  /** Dispose all expired sessions; safe to call on every write path. */
  sweep(): void {
    const now = this.#now();
    for (const session of this.#sessions.values()) {
      if (session.expiresAt <= now) this.#evict(session);
    }
  }

  dispose(): void {
    clearInterval(this.#sweeper);
    for (const session of this.#sessions.values()) session.broker.dispose();
    this.#sessions.clear();
  }

  #evict(session: RelaySession): void {
    if (!this.#sessions.delete(session.id)) return;
    session.broker.dispose();
    this.#onExpire?.(session);
  }
}
