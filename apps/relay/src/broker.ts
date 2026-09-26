import { randomUUID } from 'node:crypto';
import type { Outcome } from '@aeliqo/core';
import type { AgentToolCallOptions, AgentToolDefinition, AgentToolEndpoint } from '@aeliqo/agent/protocol';
import type { AgentCapabilityReceipt } from '@aeliqo/agent/capabilities';
import { failure, type BridgeCall, type BridgeCancel, type BridgeOperation, type Surface } from './protocol.js';

/** One serialized outcome bound for the tab: plain object with a boolean `ok`, at most 64 KiB encoded. */
function boundedOutcome(value: unknown): Outcome<unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const outcome = value as { readonly ok?: unknown };
  if (typeof outcome.ok !== 'boolean') return undefined;
  return JSON.stringify(value).length <= 65_536 ? (value as Outcome<unknown>) : undefined;
}

export interface RelayBrokerOptions {
  readonly surface: Surface;
  readonly expiresAt: number;
  readonly maxPending?: number;
  readonly callTimeoutMs?: number;
}

type Send = (event: 'call' | 'cancel', value: BridgeCall | BridgeCancel) => void;

interface Pending {
  readonly resolve: (outcome: Outcome<unknown>) => void;
  readonly timeout: NodeJS.Timeout;
  readonly cleanup: () => void;
}

const disconnected = () => failure('aeliqo.relay-disconnected', 'The browser tab disconnected from the relay.');
const cancelled = () => failure('aeliqo.relay-cancelled', 'The relayed tool call was cancelled.');

/**
 * One short-lived bridge between this relay process and one browser tab on one
 * surface. Port of `BrowserSessionBroker` (apps/site/runner/broker.mjs): SSE
 * `call` events are resolved by POST /ack; a replacement stream detaches the old
 * one; the pending-call cap bounds per-tab fan-out.
 */
export class RelaySessionBroker {
  readonly #expiresAt: number;
  readonly #maxPending: number;
  readonly #callTimeoutMs: number;
  readonly #surface: Surface;
  #pending = new Map<string, Pending>();
  #send: Send | undefined;
  #onClose: (() => void) | undefined;
  #attachment: symbol | undefined;

  constructor(options: RelayBrokerOptions) {
    this.#surface = options.surface;
    this.#expiresAt = options.expiresAt;
    this.#maxPending = options.maxPending ?? 2;
    this.#callTimeoutMs = options.callTimeoutMs ?? 30_000;
  }

  get expiresAt(): number {
    return this.#expiresAt;
  }

  get connected(): boolean {
    return this.#send !== undefined && Date.now() < this.#expiresAt;
  }

  attach(send: Send, onClose: () => void): symbol | undefined {
    if (Date.now() >= this.#expiresAt) return undefined;
    this.#onClose?.();
    const attachment = Symbol('relay-tab-stream');
    this.#attachment = attachment;
    this.#send = send;
    this.#onClose = onClose;
    return attachment;
  }

  detach(attachment: symbol | undefined): void {
    if (attachment !== undefined && attachment !== this.#attachment) return;
    this.#attachment = undefined;
    this.#send = undefined;
    this.#onClose = undefined;
    for (const entry of this.#pending.values()) entry.resolve(disconnected());
    this.#pending.clear();
  }

  acknowledge(id: unknown, outcome: unknown): boolean {
    if (typeof id !== 'string') return false;
    const entry = this.#pending.get(id);
    const checked = boundedOutcome(outcome);
    if (entry === undefined || checked === undefined) return false;
    this.#pending.delete(id);
    clearTimeout(entry.timeout);
    entry.cleanup();
    entry.resolve(checked);
    return true;
  }

  async call(call: Omit<BridgeCall, 'id'>, signal: AbortSignal | undefined): Promise<Outcome<unknown>> {
    if (!this.connected || this.#send === undefined) return disconnected();
    if (signal?.aborted) return cancelled();
    if (this.#pending.size >= this.#maxPending)
      return failure('aeliqo.relay-busy', 'The paired tab already has the maximum number of pending calls.');
    const id = randomUUID();
    return new Promise((resolve) => {
      const cancel = () => {
        const entry = this.#pending.get(id);
        if (entry === undefined) return;
        this.#pending.delete(id);
        clearTimeout(entry.timeout);
        this.#send?.('cancel', { id });
        resolve(cancelled());
      };
      const timeout = setTimeout(cancel, this.#callTimeoutMs);
      const cleanup = () => signal?.removeEventListener('abort', cancel);
      this.#pending.set(id, { resolve, timeout, cleanup });
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        this.#send?.('call', { id, ...call });
      } catch {
        this.#pending.delete(id);
        clearTimeout(timeout);
        cleanup();
        resolve(disconnected());
      }
    });
  }

  /**
   * The `mcp`-transport shim consumed by `createMcpHttpHandler`. The outcome
   * shapes are produced by the tab, so the per-method assertions here only restate
   * the contract the browser endpoint already owns; the relay bounds size, not shape.
   */
  endpoint(): AgentToolEndpoint {
    const call = (operation: BridgeOperation, payload: object, signal: AbortSignal | undefined) =>
      this.call({ transport: 'mcp', operation, ...payload }, signal);
    return Object.freeze({
      transport: 'mcp',
      targetRegionId: `${this.#surface}-main`,
      goalEpoch: `${this.#surface}-relay`,
      discover: async (options: { readonly signal?: AbortSignal } = {}) =>
        (await call('discover', {}, options.signal)) as Outcome<readonly AgentToolDefinition[]>,
      invoke: async (name: string, input: unknown, options: AgentToolCallOptions) =>
        (await call(
          'invoke',
          { name, input, requestId: options.requestId },
          options.signal,
        )) as Outcome<AgentCapabilityReceipt>,
      close() {},
    });
  }

  dispose(): void {
    this.#onClose?.();
    this.detach(this.#attachment);
  }
}
