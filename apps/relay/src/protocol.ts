/**
 * Wire contract shared with the in-browser bridge (same shape the local runner
 * uses in apps/site/runner/broker.mjs → apps/site/src/playground/local-host.ts):
 * the relay emits SSE `call`/`cancel` events and the tab answers via POST /ack.
 */
import type { Diagnostic, Outcome } from '@aeliqo/core';

/**
 * Product surfaces that may claim a pair token. A surface only namespaces the
 * session (its own pairing page and region identity); the three MCP tools are
 * identical everywhere. Adding a surface is one entry here plus its page.
 */
export const SURFACES = Object.freeze(['playground'] as const);

export type Surface = (typeof SURFACES)[number];

export function isSurface(value: unknown): value is Surface {
  return typeof value === 'string' && (SURFACES as readonly string[]).includes(value);
}

/** Operations the tab bridge understands; `authorize` is BYOK-only and never emitted by the relay. */
export type BridgeOperation = 'authorize' | 'discover' | 'invoke';

/** One SSE `call` event payload, identical to the local runner's envelope. */
export interface BridgeCall {
  readonly id: string;
  readonly transport: 'mcp';
  readonly operation: BridgeOperation;
  readonly name?: string;
  readonly input?: unknown;
  readonly requestId?: string;
}

/** SSE `cancel` event payload for an aborted or timed-out call. */
export interface BridgeCancel {
  readonly id: string;
}

/** Acknowledgment posted by the tab: `{id, outcome}` or the flat `{id, ok, result|error}` form. */
export interface BridgeAck {
  readonly id: string;
  readonly outcome: Outcome<unknown>;
}

export function failure<T>(code: string, message: string): Outcome<T> {
  const diagnostic: Diagnostic = { code, message, retryable: false };
  return { ok: false, diagnostics: [diagnostic] };
}
