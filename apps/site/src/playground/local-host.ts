import type { Outcome } from '@aeliqo/core';
import type { AgentModelToolEndpoint, AgentToolEndpoint } from '@aeliqo/agent/protocol';
import type { PlaygroundSession } from './session.js';

type BridgeOperation = 'authorize' | 'discover' | 'invoke';

interface BridgeCall {
  readonly id: string;
  readonly transport: 'byok' | 'mcp';
  readonly operation: BridgeOperation;
  readonly name?: string;
  readonly input?: unknown;
  readonly requestId?: string;
}

const BRIDGE_CALL_KEYS = new Set(['id', 'transport', 'operation', 'name', 'input', 'requestId']);

export interface LocalHostConnection {
  close(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasUnknownBridgeFields(value: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(value).some((key) => !BRIDGE_CALL_KEYS.has(key));
}

function isBridgeTransport(value: unknown): value is BridgeCall['transport'] {
  return value === 'byok' || value === 'mcp';
}

function isBridgeOperation(value: unknown): value is BridgeOperation {
  return value === 'authorize' || value === 'discover' || value === 'invoke';
}

function hasValidInvokeArguments(operation: BridgeOperation, value: Readonly<Record<string, unknown>>): boolean {
  return operation !== 'invoke' || (typeof value.name === 'string' && typeof value.requestId === 'string');
}

function bridgeCall(value: unknown): BridgeCall | undefined {
  if (!isRecord(value)) return undefined;
  const call = value;
  if (hasUnknownBridgeFields(call)) return undefined;
  if (typeof call.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(call.id)) return undefined;
  if (!isBridgeTransport(call.transport) || !isBridgeOperation(call.operation)) return undefined;
  if (!hasValidInvokeArguments(call.operation, call)) return undefined;
  return {
    id: call.id,
    transport: call.transport,
    operation: call.operation,
    ...(typeof call.name === 'string' ? { name: call.name } : {}),
    ...(Object.hasOwn(call, 'input') ? { input: call.input } : {}),
    ...(typeof call.requestId === 'string' ? { requestId: call.requestId } : {}),
  };
}

function parseEvent(event: Event): unknown {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return undefined;
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return undefined;
  }
}

async function acknowledge(id: string, outcome: Outcome<unknown>): Promise<void> {
  const response = await fetch('/api/aeliqo/ack', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, outcome }),
  });
  if (!response.ok) throw new Error(`Local host acknowledgment failed (${response.status}).`);
}

async function invoke(
  call: BridgeCall,
  endpoints: Readonly<Record<'byok' | 'mcp', AgentModelToolEndpoint>>,
  signal: AbortSignal,
): Promise<Outcome<unknown>> {
  const endpoint: AgentToolEndpoint = endpoints[call.transport];
  if (call.operation === 'authorize') {
    if (call.transport !== 'byok') {
      return {
        ok: false,
        diagnostics: [
          { code: 'playground.local-operation', message: 'MCP does not expose model authorization.', retryable: false },
        ],
      };
    }
    return endpoints.byok.authorizeModel({ signal });
  }
  if (call.operation === 'discover') return endpoint.discover({ signal });
  return endpoint.invoke(call.name ?? '', call.input, { requestId: call.requestId ?? call.id, signal });
}

async function connectEndpoints(
  session: PlaygroundSession,
): Promise<Readonly<Record<'byok' | 'mcp', AgentModelToolEndpoint>>> {
  const [byok, mcp] = await Promise.all([
    session.connectAgent('byok', 'local-playground'),
    session.connectAgent('mcp', 'local-playground'),
  ]);
  if (byok.ok && mcp.ok) return { byok: byok.value, mcp: mcp.value };
  if (byok.ok) byok.value.close();
  if (mcp.ok) mcp.value.close();
  let message = 'The browser Region could not be paired.';
  if (!byok.ok) message = byok.diagnostics[0]?.message ?? message;
  else if (!mcp.ok) message = mcp.diagnostics[0]?.message ?? message;
  throw new Error(message);
}

/** Pairs the local process with the browser-owned Region; no model key enters the page. */
export async function connectLocalHost(session: PlaygroundSession): Promise<LocalHostConnection> {
  const endpoints = await connectEndpoints(session);
  const pending = new Map<string, AbortController>();
  const events = new EventSource('/api/aeliqo/events');
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('The local host event stream did not become ready.')),
      5_000,
    );
    events.addEventListener(
      'open',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    events.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout);
        reject(new Error('The local host event stream is unavailable.'));
      },
      { once: true },
    );
  }).catch((cause: unknown) => {
    events.close();
    endpoints.byok.close();
    endpoints.mcp.close();
    throw cause;
  });

  events.addEventListener('call', (event) => {
    const call = bridgeCall(parseEvent(event));
    if (call === undefined) return;
    const controller = new AbortController();
    pending.set(call.id, controller);
    void invoke(call, endpoints, controller.signal)
      .then((outcome) => acknowledge(call.id, outcome))
      .catch(() =>
        acknowledge(call.id, {
          ok: false,
          diagnostics: [
            { code: 'playground.local-call', message: 'The browser rejected the local host call.', retryable: false },
          ],
        }),
      )
      .finally(() => pending.delete(call.id));
  });
  events.addEventListener('cancel', (event) => {
    const value = parseEvent(event);
    if (isRecord(value)) {
      const id = Object.hasOwn(value, 'id') ? value.id : undefined;
      if (typeof id === 'string') pending.get(id)?.abort();
    }
  });

  let closed = false;
  return Object.freeze({
    close() {
      if (closed) return;
      closed = true;
      events.close();
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      endpoints.byok.close();
      endpoints.mcp.close();
      void fetch('/api/aeliqo/disconnect', { method: 'POST', keepalive: true }).catch(() => undefined);
    },
  });
}
