import {createServer, type Server} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {describe, expect, it, afterEach} from 'vitest';
import {
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
} from '../../packages/agent/node_modules/@modelcontextprotocol/server';
import {toNodeHandler, type NodeIncomingMessageLike, type NodeServerResponseLike} from '../../packages/agent/node_modules/@modelcontextprotocol/node';
import {parseWireValue, type OperationGrant, type Outcome} from '../../packages/core/src/index.js';
import {createAgentCapabilityRegistry} from '../../packages/agent/src/capabilities/registry.js';
import type {AgentCapabilityManifest} from '../../packages/agent/src/capabilities/types.js';
import {createAgentToolEndpoint} from '../../packages/agent/src/protocol/endpoint.js';
import type {AgentToolEndpoint, AgentToolEndpointOptions} from '../../packages/agent/src/protocol/types.js';
import {
  AELIQO_MCP_MODERN_REVISION,
  connectMcpHttpClient,
  connectMcpStdioClient,
  createMcpHttpHandler,
  createMcpServerFactory,
} from '../../packages/agent/src/mcp/index.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server => {
    if (server.listening) server.close();
    else await once(server, 'close').catch(() => undefined);
  }));
});

function endpointOptions(invoke: AgentCapabilityManifest['invoke'] = () => ({state: 'data-ready', value: {count: 2}})): AgentToolEndpointOptions {
  const operation: OperationGrant = 'catalog.read';
  const registry = createAgentCapabilityRegistry([{
    ref: {id: 'summary', revision: '1'}, operation, label: 'Summary', description: 'Return a bounded summary.',
    parse: input => parseWireValue(input) as Outcome<never>, invoke,
  }]);
  if (!registry.ok) throw new Error('registry fixture failed');
  return {
    transport: 'mcp', targetRegionId: 'region', goalEpoch: 'goal', principalKey: 'owner', expiresAt: Date.now() + 60_000,
    registry: registry.value,
    tools: [{name: 'summary', capability: {id: 'summary', revision: '1'}, operation, inputSchema: {type: 'object', properties: {query: {type: 'string'}}, additionalProperties: false}}],
    host: {readContext: () => ({ok: true, value: {principalKey: 'owner', regionId: 'region', goalEpoch: 'goal', grants: ['catalog.read', 'model.egress']}})},
  };
}

function newEndpoint(invoke?: AgentCapabilityManifest['invoke']): AgentToolEndpoint {
  const outcome = createAgentToolEndpoint(endpointOptions(invoke));
  if (!outcome.ok) throw new Error(JSON.stringify(outcome));
  return outcome.value;
}

function authGate(overrides: Partial<{resource: URL; issuer: string; expiresAt: number}> = {}) {
  const verifier = {
    verifyAccessToken: async (token: string) => {
      if (token !== 'fixture-token') throw new OAuthError(OAuthErrorCode.InvalidToken, 'invalid token');
      return {
        token,
        clientId: 'fixture-client',
        scopes: ['mcp'],
        expiresAt: overrides.expiresAt ?? Math.floor(Date.now() / 1000) + 60,
        resource: overrides.resource ?? new URL('http://127.0.0.1/'),
        extra: {issuer: overrides.issuer ?? 'https://issuer.example'},
      };
    },
  };
  return requireBearerAuth({verifier, requiredScopes: ['mcp']});
}

async function startHttp(options: Parameters<typeof createMcpHttpHandler>[0]) {
  const handler = createMcpHttpHandler(options);
  const nodeHandler = toNodeHandler(handler);
  const server = createServer((request, response) => { void nodeHandler(request as unknown as NodeIncomingMessageLike, response as unknown as NodeServerResponseLike); });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('server address unavailable');
  return {handler, server, url: new URL(`http://127.0.0.1:${address.port}/mcp`)};
}

describe('MCP adapter', () => {
  it('uses the official stdio server and client with negotiated modern and legacy eras', async () => {
    const child = fileURLToPath(new URL('./stdio-child.mjs', import.meta.url));
    const modern = await connectMcpStdioClient({
      server: {command: process.execPath, args: [child], stderr: 'pipe'},
      targetRegionId: 'region', goalEpoch: 'goal',
      versionNegotiation: {mode: {pin: AELIQO_MCP_MODERN_REVISION}},
    });
    expect(await modern.discover()).toMatchObject({ok: true, value: [{name: 'summary', capability: {id: 'summary', revision: '1'}}]});
    expect(await modern.invoke('summary', {query: 'stdio'}, {requestId: 'stdio-modern'})).toMatchObject({ok: true, value: {requestId: 'stdio-modern', value: {query: 'stdio'}}});
    modern.close();

    const legacy = await connectMcpStdioClient({
      server: {command: process.execPath, args: [child], stderr: 'pipe'},
      targetRegionId: 'region', goalEpoch: 'goal', versionNegotiation: {mode: 'legacy'},
    });
    expect(await legacy.discover()).toMatchObject({ok: true, value: [{name: 'summary'}]});
    expect(await legacy.invoke('summary', {}, {requestId: 'stdio-legacy'})).toMatchObject({ok: true, value: {requestId: 'stdio-legacy'}});
    legacy.close();
  });

  it('serves authenticated HTTP with fresh discovery/call endpoint instances and no token in URLs', async () => {
    let created = 0;
    const fixture = await startHttp({
      createEndpoint: () => { created += 1; return newEndpoint(); },
      authenticate: authGate(),
      allowedHostnames: ['127.0.0.1'],
      allowedOriginHostnames: ['127.0.0.1'],
      resourceServerUrl: new URL('http://127.0.0.1/'),
      issuer: 'https://issuer.example',
    });
    const requests: Request[] = [];
    const client = await connectMcpHttpClient({
      url: fixture.url,
      targetRegionId: 'region', goalEpoch: 'goal',
      authProvider: {token: async () => 'fixture-token'},
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return fetch(request);
      },
      versionNegotiation: {mode: 'auto'},
    });
    expect(await client.discover()).toMatchObject({ok: true, value: [{name: 'summary'}]});
    expect(await client.invoke('summary', {query: 'http'}, {requestId: 'http-call'})).toMatchObject({ok: true, value: {requestId: 'http-call', value: {count: 2}}});
    expect(created).toBeGreaterThanOrEqual(2);
    for (const request of requests) {
      expect(request.url).not.toContain('fixture-token');
      expect(await request.clone().text()).not.toContain('fixture-token');
    }
    client.close();
    await fixture.handler.close();
  });

  it('rejects origin, audience, issuer and expired authentication before endpoint discovery', async () => {
    const base = {
      createEndpoint: () => { throw new Error('endpoint must not be reached'); },
      authenticate: authGate(),
      allowedHostnames: ['127.0.0.1'],
      allowedOriginHostnames: ['127.0.0.1'],
      resourceServerUrl: new URL('http://127.0.0.1/'),
      issuer: 'https://issuer.example',
    } satisfies Parameters<typeof createMcpHttpHandler>[0];
    const handler = createMcpHttpHandler(base);
    const request = (headers: Record<string, string>) => new Request('http://127.0.0.1/mcp', {method: 'POST', headers: {'host': '127.0.0.1', ...headers}, body: '{}'});
    expect((await handler.fetch(request({origin: 'https://evil.example'}))).status).toBe(403);
    expect((await createMcpHttpHandler({...base, authenticate: authGate({resource: new URL('https://attacker.example/')})}).fetch(request({authorization: 'Bearer fixture-token'}))).status).toBe(401);
    expect((await createMcpHttpHandler({...base, authenticate: authGate({issuer: 'https://other.example'})}).fetch(request({authorization: 'Bearer fixture-token'}))).status).toBe(401);
    expect((await createMcpHttpHandler({...base, authenticate: authGate({expiresAt: Math.floor(Date.now() / 1000) - 1})}).fetch(request({authorization: 'Bearer fixture-token'}))).status).toBe(401);
  });

  it('maps cancellation and malformed remote receipts to bounded outcomes', async () => {
    const fixture = await startHttp({
      createEndpoint: () => newEndpoint(async (_input, context) => {
        await new Promise<void>((resolve) => {
          context.signal.addEventListener('abort', () => resolve(), {once: true});
        });
        return {state: 'data-ready', value: {never: 'delivered'}};
      }),
      authenticate: authGate(),
      allowedHostnames: ['127.0.0.1'],
      resourceServerUrl: new URL('http://127.0.0.1/'),
      issuer: 'https://issuer.example',
    });
    const client = await connectMcpHttpClient({url: fixture.url, targetRegionId: 'region', goalEpoch: 'goal', authProvider: {token: async () => 'fixture-token'}});
    const signal = new AbortController();
    const pending = client.invoke('summary', {}, {requestId: 'cancel-me', signal: signal.signal});
    await new Promise(resolve => setTimeout(resolve, 50));
    signal.abort();
    expect(await pending).toMatchObject({ok: false, diagnostics: [{code: 'agent.mcp.cancelled'}]});
    client.close();
    await fixture.handler.close();

    const malformed = await startHttp({
      createEndpoint: () => ({
        ...newEndpoint(),
        invoke: (async () => ({ok: true, value: {bad: true}})) as unknown as AgentToolEndpoint['invoke'],
      }),
      authenticate: authGate(),
      allowedHostnames: ['127.0.0.1'],
      resourceServerUrl: new URL('http://127.0.0.1/'),
      issuer: 'https://issuer.example',
    });
    const malformedClient = await connectMcpHttpClient({url: malformed.url, targetRegionId: 'region', goalEpoch: 'goal', authProvider: {token: async () => 'fixture-token'}});
    expect(await malformedClient.invoke('summary', {}, {requestId: 'bad-receipt'})).toMatchObject({ok: false, diagnostics: [{code: 'agent.mcp.receipt'}]});
    malformedClient.close();
    await malformed.handler.close();
  });

  it('does not print secrets in the stdio child and supports transport buffer limits', async () => {
    const child = fileURLToPath(new URL('./stdio-child.mjs', import.meta.url));
    const processHandle = (await import('node:child_process')).spawn(process.execPath, [child], {
      stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, AELIQO_MCP_MAX_BUFFER: '256'},
    });
    let stdout = '';
    processHandle.stdout.on('data', chunk => {stdout += String(chunk);});
    processHandle.stdin.write(`${'x'.repeat(1024)}\n`);
    setTimeout(() => processHandle.kill(), 100);
    await new Promise<void>(resolve => processHandle.once('close', () => resolve()));
    expect(stdout).not.toContain('fixture-token');
  });

  it('uses the current protocol revision in documentation', async () => {
    const documentation = await readFile(new URL('../../docs/agent-protocols/mcp.md', import.meta.url), 'utf8');
    expect(documentation).toContain(AELIQO_MCP_MODERN_REVISION);
  });
});
