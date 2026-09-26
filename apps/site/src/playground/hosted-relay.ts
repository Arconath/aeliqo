/**
 * Hosted MCP relay at mcp.aeliqo.com. `pairHostedRelay` trades the surface
 * name for a bearer token, an attach channel (SSE or WebSocket — the scheme
 * decides), and the MCP URL the user pastes into their agent client. The
 * channel carries `{kind:'call'|'cancel', id, method, params}` envelopes;
 * calls dispatch onto the in-page MCP endpoint through the same bridge
 * machinery as the local runner, and results return via POST /ack with the
 * bearer token.
 */
import type { Outcome } from '@aeliqo/core';
import {
  abortBridgeCalls,
  cancelBridgeCall,
  dispatchBridgeCall,
  parseChannelEvent,
  type BridgeCall,
  type BridgeEndpoints,
  type BridgeOperation,
} from './bridge-calls.js';
import { isRecord } from './guards.js';
import type { PlaygroundSession } from './session.js';

const RELAY_PAIR_URL = 'https://mcp.aeliqo.com/pair';

export interface RelayPair {
  readonly token: string;
  readonly attachUrl: string;
  readonly mcpUrl: string;
  readonly ackUrl: string;
  readonly expiresAt: number;
}

export type RelayState = 'live' | 'interrupted' | 'disconnected' | 'expired';

export interface HostedRelayConnection {
  readonly pair: RelayPair;
  close(): void;
}

interface ChannelHandlers {
  open(): void;
  message(name: string, value: unknown): void;
  drop(state: 'interrupted' | 'disconnected'): void;
}

interface RelayChannel {
  close(): void;
}

const ATTACH_TIMEOUT_MS = 10_000;
const ATTACH_SCHEMES = new Set(['wss:', 'ws:', 'https:', 'http:']);
const RELAY_CALL_ID = /^[A-Za-z0-9_-]{1,120}$/u;

/** The relay may spell endpoint operations directly or as MCP method names. */
const RELAY_METHODS: Readonly<Record<string, BridgeOperation>> = {
  discover: 'discover',
  'tools/list': 'discover',
  invoke: 'invoke',
  'tools/call': 'invoke',
  authorize: 'authorize',
};

const RELAY_REJECTED: Outcome<unknown> = {
  ok: false,
  diagnostics: [{ code: 'playground.relay-call', message: 'The browser rejected the relay call.', retryable: false }],
};

function urlProtocol(value: string): string | undefined {
  try {
    return new URL(value).protocol;
  } catch {
    return undefined;
  }
}

function attachScheme(value: string): string | undefined {
  const protocol = urlProtocol(value);
  return protocol !== undefined && ATTACH_SCHEMES.has(protocol) ? protocol : undefined;
}

/** Accepts epoch seconds or milliseconds; rejects anything non-numeric. */
function epochMilliseconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value < 100_000_000_000 ? Math.round(value * 1_000) : Math.round(value);
}

/** Validates the /pair response; acks post to `/ack` on the MCP URL's origin. */
function relayPair(value: unknown): RelayPair | undefined {
  if (!isRecord(value)) return undefined;
  const { token, attachUrl, mcpUrl, expiresAt } = value;
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) return undefined;
  if (typeof attachUrl !== 'string' || attachScheme(attachUrl) === undefined) return undefined;
  if (typeof mcpUrl !== 'string') return undefined;
  const mcpProtocol = urlProtocol(mcpUrl);
  if (mcpProtocol !== 'https:' && mcpProtocol !== 'http:') return undefined;
  const expires = epochMilliseconds(expiresAt);
  if (expires === undefined) return undefined;
  return { token, attachUrl, mcpUrl, ackUrl: new URL('/ack', mcpUrl).href, expiresAt: expires };
}

export async function pairHostedRelay(): Promise<RelayPair> {
  let response: Response;
  try {
    response = await fetch(RELAY_PAIR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ surface: 'playground' }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('The hosted relay is unreachable. Check the network connection and try again.');
  }
  if (!response.ok) throw new Error(`The hosted relay could not create a session (HTTP ${response.status}).`);
  const pair = relayPair(await response.json().catch(() => undefined));
  if (pair === undefined) throw new Error('The hosted relay returned an invalid pairing response.');
  return pair;
}

interface RelayCallParams {
  readonly name?: string;
  readonly input?: unknown;
  readonly requestId?: string;
}

/** Accepts both `params.input` and the MCP `params.arguments` spellings. */
function relayCallParams(value: unknown): RelayCallParams {
  const params = isRecord(value) ? value : {};
  const input = Object.hasOwn(params, 'input') ? params.input : params.arguments;
  return {
    ...(typeof params.name === 'string' ? { name: params.name } : {}),
    ...(Object.hasOwn(params, 'input') || Object.hasOwn(params, 'arguments') ? { input } : {}),
    ...(typeof params.requestId === 'string' ? { requestId: params.requestId } : {}),
  };
}

/** Maps one relay call envelope onto a BridgeCall; unknown methods drop. */
function relayCall(value: unknown): BridgeCall | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind !== undefined && value.kind !== 'call') return undefined;
  if (typeof value.id !== 'string' || !RELAY_CALL_ID.test(value.id)) return undefined;
  if (typeof value.method !== 'string') return undefined;
  const operation = RELAY_METHODS[value.method];
  if (operation === undefined) return undefined;
  const params = relayCallParams(value.params);
  if (operation === 'invoke' && params.name === undefined) return undefined;
  return { id: value.id, transport: 'mcp', operation, ...params };
}

function relayAckBody(id: string, outcome: Outcome<unknown>): string {
  if (outcome.ok) return JSON.stringify({ id, ok: true, result: outcome.value });
  return JSON.stringify({
    id,
    ok: false,
    error: outcome.diagnostics[0]?.message ?? 'The playground call failed.',
    diagnostics: outcome.diagnostics,
  });
}

async function acknowledgeRelay(
  pair: RelayPair,
  id: string,
  outcome: Outcome<unknown>,
  expire: () => void,
): Promise<void> {
  const response = await fetch(pair.ackUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${pair.token}`, 'content-type': 'application/json' },
    body: relayAckBody(id, outcome),
  });
  if (response.status === 401 || response.status === 403) {
    expire();
    throw new Error('The relay rejected the session token.');
  }
  if (!response.ok) throw new Error(`Relay acknowledgment failed (${response.status}).`);
}

/** SSE attach channel — prefers EventSource; the bearer rides in the URL. */
function openSseChannel(url: string, handlers: ChannelHandlers): RelayChannel {
  const events = new EventSource(url);
  for (const name of ['call', 'cancel', 'message'] as const)
    events.addEventListener(name, (event) => handlers.message(name, parseChannelEvent(event)));
  events.addEventListener('open', () => handlers.open());
  events.addEventListener('error', () =>
    handlers.drop(events.readyState === EventSource.CLOSED ? 'disconnected' : 'interrupted'),
  );
  return Object.freeze({ close: () => events.close() });
}

/** WebSocket attach channel — frames carry the same `{kind,…}` envelopes. */
function openSocketChannel(url: string, handlers: ChannelHandlers): RelayChannel {
  const socket = new WebSocket(url);
  socket.addEventListener('open', () => handlers.open());
  socket.addEventListener('message', (event) => handlers.message('message', parseChannelEvent(event)));
  socket.addEventListener('close', () => handlers.drop('disconnected'));
  socket.addEventListener('error', () => undefined);
  return Object.freeze({ close: () => socket.close() });
}

function openChannel(pair: RelayPair, handlers: ChannelHandlers): RelayChannel {
  const scheme = attachScheme(pair.attachUrl);
  if (scheme === 'wss:' || scheme === 'ws:') return openSocketChannel(pair.attachUrl, handlers);
  return openSseChannel(pair.attachUrl, handlers);
}

function channelDispatcher(
  pair: RelayPair,
  endpoints: BridgeEndpoints,
  pending: Map<string, AbortController>,
  expire: () => void,
): (name: string, value: unknown) => void {
  const acknowledge = (id: string, outcome: Outcome<unknown>) => acknowledgeRelay(pair, id, outcome, expire);
  return (name, value) => {
    if (name === 'cancel' || (isRecord(value) && value.kind === 'cancel')) {
      cancelBridgeCall(pending, value);
      return;
    }
    const call = relayCall(value);
    if (call !== undefined) dispatchBridgeCall(call, endpoints, pending, acknowledge, RELAY_REJECTED);
  };
}

/**
 * Pairs the in-page MCP endpoint with the hosted relay. Resolves once the
 * attach channel first opens; later drops and re-opens report through
 * `onState` so the panel can show interrupted, disconnected, or expired.
 */
export async function connectHostedRelay(
  session: PlaygroundSession,
  pair: RelayPair,
  onState: (state: RelayState) => void,
): Promise<HostedRelayConnection> {
  const connected = await session.connectAgent('mcp', 'hosted-relay');
  if (!connected.ok)
    throw new Error(connected.diagnostics[0]?.message ?? 'The browser Region could not pair with the relay.');
  const endpoint = connected.value;
  const pending = new Map<string, AbortController>();
  let channel: RelayChannel | undefined;
  let expiryTimer = 0;
  let closed = false;
  let attachSettled = false;
  const emit = (state: RelayState): void => {
    if (!closed) onState(state);
  };
  const connection: HostedRelayConnection = Object.freeze({
    pair,
    close() {
      if (closed) return;
      closed = true;
      window.clearTimeout(expiryTimer);
      channel?.close();
      abortBridgeCalls(pending);
      endpoint.close();
    },
  });
  let failReady: (cause: Error) => void = () => undefined;
  const markExpired = (): void => {
    if (closed) return;
    failReady(new Error('The relay session expired. Generate a new connection to continue.'));
    connection.close();
    onState('expired');
  };
  const onMessage = channelDispatcher(pair, { byok: endpoint, mcp: endpoint }, pending, markExpired);
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => failReady(new Error('The relay attach channel did not become ready.')),
      ATTACH_TIMEOUT_MS,
    );
    const settle = (action: () => void): void => {
      if (attachSettled || closed) return;
      attachSettled = true;
      window.clearTimeout(timeout);
      action();
    };
    failReady = (cause) => settle(() => reject(cause));
    channel = openChannel(pair, {
      open() {
        if (closed) return;
        if (attachSettled) emit('live');
        else settle(resolve);
      },
      message: onMessage,
      drop(state) {
        if (closed) return;
        if (attachSettled) emit(state);
        else failReady(new Error('The relay attach channel is unavailable.'));
      },
    });
  });
  expiryTimer = window.setTimeout(markExpired, Math.max(0, pair.expiresAt - Date.now()));
  try {
    await ready;
  } catch (cause) {
    connection.close();
    throw cause;
  }
  return connection;
}
