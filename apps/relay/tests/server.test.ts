import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { ReadableStreamDefaultReader } from 'node:stream/web';
import { afterEach, describe, expect, it } from 'vitest';
import { connectMcpHttpClient } from '@aeliqo/agent/mcp';
import type { AgentToolEndpoint } from '@aeliqo/agent/protocol';
import { createRelayServer, type RelayServer, type RelayServerOptions } from '../src/server.js';
import { PairingRegistry } from '../src/registry.js';
import type { BridgeCall } from '../src/protocol.js';

interface RunningRelay {
  readonly base: string;
  readonly relay: RelayServer;
}

const relays: RelayServer[] = [];

async function startRelay(options: RelayServerOptions = {}): Promise<RunningRelay> {
  const relay = createRelayServer(options);
  relays.push(relay);
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  const address = relay.server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${address.port}`, relay };
}

afterEach(() => {
  for (const relay of relays.splice(0)) relay.close();
});

interface PairResponse {
  readonly token: string;
  readonly surface: string;
  readonly attachUrl: string;
  readonly mcpUrl: string;
  readonly expiresAt: number;
}

async function pair(base: string, headers: Record<string, string> = {}): Promise<PairResponse> {
  const response = await fetch(`${base}/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ surface: 'playground' }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as PairResponse;
}

const TOOL_DEFS = [
  {
    name: 'aeliqo_context',
    description: 'Read the paired resource catalog, fields, meanings, views, and grants.',
    capability: { id: 'aeliqo.app.context', revision: '1' },
    operation: 'catalog.read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'aeliqo_render',
    description: 'Render a validated intent.',
    capability: { id: 'aeliqo.app.render', revision: '1' },
    operation: 'task.evaluate',
    inputSchema: { type: 'object' },
  },
  {
    name: 'aeliqo_act',
    description: 'Propose or execute an action.',
    capability: { id: 'aeliqo.app.action', revision: '1' },
    operation: 'action.propose',
    inputSchema: { type: 'object' },
  },
];

/** Minimal in-test stand-in for the playground's browser bridge: SSE in, POST /ack out. */
class FakeTab {
  readonly calls: BridgeCall[] = [];
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly #token: string;
  readonly #base: string;
  #closed = false;

  private constructor(reader: ReadableStreamDefaultReader<Uint8Array>, token: string, base: string) {
    this.#reader = reader;
    this.#token = token;
    this.#base = base;
  }

  static async connect(attachUrl: string, token: string, base: string): Promise<FakeTab> {
    const response = await fetch(attachUrl, { headers: { origin: 'https://docs.aeliqo.com' } });
    if (response.status !== 200 || response.body === null) throw new Error(`attach failed: ${response.status}`);
    const tab = new FakeTab(response.body.getReader(), token, base);
    void tab.#pump();
    return tab;
  }

  async #pump(): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    while (!this.#closed) {
      const { done, value } = await this.#reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n\n');
      while (index >= 0) {
        this.#block(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        index = buffer.indexOf('\n\n');
      }
    }
  }

  #block(block: string): void {
    const lines = block.split('\n');
    const event = lines.find((line) => line.startsWith('event: '))?.slice(7);
    const data = lines.find((line) => line.startsWith('data: '))?.slice(6);
    if (event !== 'call' || data === undefined) return;
    const call = JSON.parse(data) as BridgeCall;
    this.calls.push(call);
    void this.answer(call);
  }

  async answer(call: BridgeCall): Promise<void> {
    const outcome =
      call.operation === 'discover' ? { ok: true, value: TOOL_DEFS } : { ok: true, value: receiptFor(call) };
    await fetch(`${this.#base}/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#token}` },
      body: JSON.stringify({ id: call.id, outcome }),
    });
  }

  close(): void {
    this.#closed = true;
    void this.#reader.cancel().catch(() => undefined);
  }
}

function receiptFor(call: BridgeCall): Record<string, unknown> {
  return {
    version: '1',
    requestId: call.requestId ?? call.id,
    targetRegionId: 'region',
    goalEpoch: 'goal',
    capability: { id: 'aeliqo.app.context', revision: '1' },
    operation: 'catalog.read',
    transport: 'mcp',
    state: 'data-ready',
    status: 'data-ready',
    stage: 'data-ready',
    diagnostics: [],
    value: { echoed: call.input },
  };
}

async function connectAgent(mcpUrl: string, token: string): Promise<AgentToolEndpoint> {
  return connectMcpHttpClient({
    url: mcpUrl,
    targetRegionId: 'region',
    goalEpoch: 'goal',
    policy: { allowInsecureLoopback: true },
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
}

describe('aeliqo relay http', () => {
  it('reports health and version', async () => {
    const { base } = await startRelay({ revision: 'test-rev' });
    const health = await fetch(`${base}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
    const version = await fetch(`${base}/version`);
    expect(await version.json()).toEqual({ product: 'aeliqo-relay', revision: 'test-rev' });
    expect((await fetch(`${base}/missing`)).status).toBe(404);
  });

  it('mints pair tokens with attach and mcp URLs', async () => {
    const { base, relay } = await startRelay();
    const before = Date.now();
    const session = await pair(base, { origin: 'https://docs.aeliqo.com' });
    expect(session.surface).toBe('playground');
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(new URL(session.attachUrl).origin).toBe(base);
    expect(new URL(session.attachUrl).pathname).toBe('/attach');
    expect(new URL(session.attachUrl).searchParams.get('token')).toBe(session.token);
    expect(new URL(session.mcpUrl).href).toBe(`${base}/mcp`);
    expect(session.expiresAt).toBeGreaterThan(before + 14 * 60_000);
    expect(relay.registry.size).toBe(1);
  });

  it('uses the configured public origin for minted URLs', async () => {
    const { base } = await startRelay({ publicOrigin: 'https://relay.aeliqo.com' });
    const session = await pair(base);
    expect(session.attachUrl.startsWith('https://relay.aeliqo.com/attach?token=')).toBe(true);
    expect(session.mcpUrl).toBe('https://relay.aeliqo.com/mcp');
  });

  it('enforces the browser origin allowlist and CORS preflight', async () => {
    const { base } = await startRelay();
    const denied = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ surface: 'playground' }),
    });
    expect(denied.status).toBe(403);

    const allowed = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://docs.aeliqo.com' },
      body: JSON.stringify({ surface: 'playground' }),
    });
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://docs.aeliqo.com');

    const preflight = await fetch(`${base}/pair`, {
      method: 'OPTIONS',
      headers: { origin: 'https://aeliqo.com', 'access-control-request-method': 'POST' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://aeliqo.com');
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization');

    const unknown = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ surface: 'studio' }),
    });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'unknown-surface' });
  });

  it('rate limits pairing per client address', async () => {
    const { base } = await startRelay({ rateLimitOptions: { limit: 2, windowMs: 60_000 } });
    await pair(base);
    await pair(base);
    const denied = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ surface: 'playground' }),
    });
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).not.toBeNull();
  });

  it('rejects attach without a live token', async () => {
    const { base } = await startRelay();
    expect((await fetch(`${base}/attach?token=bogus`)).status).toBe(401);
    expect((await fetch(`${base}/attach`)).status).toBe(401);
  });

  it('rejects ack without a bearer token', async () => {
    const { base } = await startRelay();
    const response = await fetch(`${base}/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'x', outcome: { ok: true, value: {} } }),
    });
    expect(response.status).toBe(401);
  });

  it('rejects MCP calls without a live paired tab', async () => {
    const { base } = await startRelay();
    const session = await pair(base);
    const unauthenticated = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(unauthenticated.status).toBe(401);

    const unattached = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(unattached.status).toBe(401);
    expect(await unattached.json()).toEqual({ error: 'invalid_token' });
  });

  it('expires sessions so the MCP boundary denies stale tokens', async () => {
    let now = Date.now();
    const registry = new PairingRegistry({ now: () => now, ttlMs: 5_000 });
    const { base } = await startRelay({ registry });
    const session = await pair(base);
    const tab = await FakeTab.connect(session.attachUrl, session.token, base);
    now += 5_001;
    registry.sweep();
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(response.status).toBe(401);
    tab.close();
  });

  it('relays a full MCP handshake: pair → attach → discover → invoke → ack', { timeout: 30_000 }, async () => {
    const { base } = await startRelay();
    const session = await pair(base, { origin: 'https://docs.aeliqo.com' });
    const tab = await FakeTab.connect(session.attachUrl, session.token, base);
    try {
      const client = await connectAgent(session.mcpUrl, session.token);
      try {
        const discovered = await client.discover();
        expect(discovered.ok).toBe(true);
        if (discovered.ok)
          expect(discovered.value.map((tool) => tool.name)).toEqual(['aeliqo_context', 'aeliqo_render', 'aeliqo_act']);
        expect(tab.calls.some((call) => call.operation === 'discover')).toBe(true);

        const result = await client.invoke('aeliqo_context', { probe: 7 }, { requestId: 'it-1' });
        const invokeCall = tab.calls.find((call) => call.operation === 'invoke');
        expect(invokeCall).toBeDefined();
        expect(invokeCall!.name).toBe('aeliqo_context');
        expect(invokeCall!.requestId).toBe('it-1');
        expect(invokeCall!.input).toEqual({ probe: 7 });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.requestId).toBe('it-1');
          expect(result.value.state).toBe('data-ready');
        }
      } finally {
        client.close();
      }
    } finally {
      tab.close();
    }
  });

  it('maps a flat `{id, ok:false, error}` ack into a failed tool outcome', { timeout: 30_000 }, async () => {
    const { base } = await startRelay();
    const session = await pair(base);
    const tab = await FakeTab.connect(session.attachUrl, session.token, base);
    // Override the default acker: fail invokes flatly instead of returning a receipt.
    tab.answer = async (call: BridgeCall) => {
      if (call.operation === 'discover') {
        await fetch(`${base}/ack`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ id: call.id, outcome: { ok: true, value: TOOL_DEFS } }),
        });
        return;
      }
      await fetch(`${base}/ack`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ id: call.id, ok: false, error: 'tab exploded' }),
      });
    };
    try {
      const client = await connectAgent(session.mcpUrl, session.token);
      try {
        await client.discover();
        const result = await client.invoke('aeliqo_context', {}, { requestId: 'it-2' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.diagnostics[0]!.message).toBe('tab exploded');
      } finally {
        client.close();
      }
    } finally {
      tab.close();
    }
  });
});
