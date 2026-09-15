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

export interface LocalHostConnection {
  close(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bridgeCall(value: unknown): BridgeCall | undefined {
  if (!isRecord(value)) return undefined;
  const call = value;
  if (Object.keys(call).some((key) => !['id', 'transport', 'operation', 'name', 'input', 'requestId'].includes(key)))
    return undefined;
  if (typeof call.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(call.id)) return undefined;
  if (call.transport !== 'byok' && call.transport !== 'mcp') return undefined;
  if (call.operation !== 'authorize' && call.operation !== 'discover' && call.operation !== 'invoke') return undefined;
  if (call.operation === 'invoke' && (typeof call.name !== 'string' || typeof call.requestId !== 'string'))
    return undefined;
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

/** Pairs the local process with the browser-owned Region; no model key enters the page. */
export async function connectLocalHost(session: PlaygroundSession): Promise<LocalHostConnection> {
  const [byok, mcp] = await Promise.all([
    session.connectAgent('byok', 'local-playground'),
    session.connectAgent('mcp', 'local-playground'),
  ]);
  if (!byok.ok || !mcp.ok) {
    if (byok.ok) byok.value.close();
    if (mcp.ok) mcp.value.close();
    const diagnostics = !byok.ok ? byok.diagnostics : !mcp.ok ? mcp.diagnostics : [];
    throw new Error(diagnostics[0]?.message ?? 'The browser Region could not be paired.');
  }

  const endpoints = { byok: byok.value, mcp: mcp.value };
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
