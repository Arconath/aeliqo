import {describe, expect, it, vi} from 'vitest';
import {parseWireValue, type Outcome} from '../../packages/core/src/index.js';
import type {AgentCapabilityReceipt} from '../../packages/agent/src/capabilities/types.js';
import type {AgentToolDefinition, AgentToolEndpoint} from '../../packages/agent/src/protocol/types.js';
import {createAgentCapabilityRegistry} from '../../packages/agent/src/capabilities/registry.js';
import {createAgentToolEndpoint} from '../../packages/agent/src/protocol/endpoint.js';
import {
  createWebMcpAdapter,
  detectWebMcp,
  type WebMcpModelContext,
  type WebMcpTool,
} from '../../packages/agent/src/webmcp/index.js';

const definition: AgentToolDefinition = {
  name: 'catalog_events',
  description: 'Read the authorized event catalog.',
  capability: {id: 'catalog.summary', revision: '1'},
  operation: 'catalog.read',
  inputSchema: {type: 'object', properties: {query: {type: 'string'}}, required: ['query']},
};

const receipt = (requestId: string): AgentCapabilityReceipt => ({
  version: '1', requestId, targetRegionId: 'region-1', goalEpoch: 'goal-1',
  capability: {id: 'catalog.summary', revision: '1'}, operation: 'catalog.read', transport: 'webmcp',
  state: 'data-ready', status: 'data-ready', stage: 'data-ready', diagnostics: [], value: {count: 1},
});

function endpoint(overrides: Partial<AgentToolEndpoint> = {}): AgentToolEndpoint {
  return {
    transport: 'webmcp', targetRegionId: 'region-1', goalEpoch: 'goal-1',
    discover: async () => ({ok: true, value: [definition]}),
    invoke: async (_name, _input, options) => ({ok: true, value: receipt(options.requestId)}),
    close: vi.fn(),
    ...overrides,
  };
}

function modelContext(tools: WebMcpTool[] = [], signals: AbortSignal[] = []): WebMcpModelContext {
  return {
    registerTool: (tool, options) => {
      tools.push(tool);
      if (options?.signal !== undefined) signals.push(options.signal);
    },
  };
}

describe('WebMCP adapter', () => {
  it('feature-detects document.modelContext and does not shim an absent host', async () => {
    const host = endpoint();
    const detection = detectWebMcp({});
    expect(detection).toMatchObject({evidence: 'simulated', supported: false});

    const adapter = createWebMcpAdapter({endpoint: host, document: {}});
    expect(adapter).toMatchObject({evidence: 'simulated', supported: false});
    expect(await adapter.discover()).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.unavailable'}]});
    const result = await adapter.register();
    expect(result).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.unavailable'}]});
    expect(host.close).not.toHaveBeenCalled();
  });

  it('registers discovered tools through a simulated host and uses the shared endpoint executor', async () => {
    const tools: WebMcpTool[] = [];
    const signals: AbortSignal[] = [];
    const invokes: Array<{name: string; input: unknown; requestId: string; signal: AbortSignal}> = [];
    const host = endpoint({
      invoke: async (name, input, options) => {
        invokes.push({name, input, requestId: options.requestId, signal: options.signal ?? new AbortController().signal});
        return {ok: true, value: receipt(options.requestId)};
      },
    });
    const adapter = createWebMcpAdapter({endpoint: host, modelContext: modelContext(tools, signals)});
    expect(adapter.evidence).toBe('simulated');

    const registered = await adapter.register();
    expect(registered).toMatchObject({ok: true, value: [{name: 'catalog_events', evidence: 'simulated'}]});
    expect(tools).toHaveLength(1);
    expect(signals).toHaveLength(1);
    expect(tools[0]?.inputSchema).toEqual(definition.inputSchema);

    const executed = await tools[0]!.execute({query: 'events'});
    expect(executed).toMatchObject({ok: true, value: {transport: 'webmcp', state: 'data-ready'}});
    expect(invokes).toHaveLength(1);
    expect(invokes[0]).toMatchObject({name: 'catalog_events', input: {query: 'events'}, requestId: 'webmcp-1'});
  });

  it('runs a registered WebMCP tool through the real paired endpoint and dispatcher', async () => {
    const registry = createAgentCapabilityRegistry([{
      ref: {id: 'catalog.summary', revision: '1'}, operation: 'catalog.read', label: 'Summary', description: definition.description,
      parse: input => parseWireValue(input) as Outcome<never>,
      invoke: (_input, context) => ({state: 'data-ready', value: {region: context.targetRegionId, transport: context.transport}}),
    }]);
    if (!registry.ok) throw new Error('registry');
    const created = createAgentToolEndpoint({
      transport: 'webmcp', targetRegionId: 'region-1', goalEpoch: 'goal-1', principalKey: 'principal-1', expiresAt: 1000, now: () => 1,
      registry: registry.value, tools: [{name: definition.name, capability: definition.capability, operation: definition.operation, inputSchema: definition.inputSchema}],
      host: {readContext: () => ({ok: true, value: {principalKey: 'principal-1', regionId: 'region-1', goalEpoch: 'goal-1', grants: ['catalog.read', 'model.egress']}})},
    });
    if (!created.ok) throw new Error('endpoint');
    const tools: WebMcpTool[] = [];
    const adapter = createWebMcpAdapter({endpoint: created.value, modelContext: modelContext(tools)});
    expect((await adapter.register()).ok).toBe(true);
    const result = await tools[0]!.execute({query: 'events'});
    expect(result).toMatchObject({ok: true, value: {state: 'data-ready', value: {region: 'region-1', transport: 'webmcp'}}});
  });

  it('keeps native evidence detection separate from explicit simulated injection', () => {
    const context = modelContext();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {modelContext: context}});
    try {
      expect(detectWebMcp()).toMatchObject({evidence: 'native', supported: true});
      expect(detectWebMcp({modelContext: context})).toMatchObject({evidence: 'simulated', supported: true});
    } finally {
      if (previous === undefined) delete (globalThis as {document?: unknown}).document;
      else Object.defineProperty(globalThis, 'document', previous);
    }
  });

  it('aborts registrations and rejects late executions after disposal', async () => {
    const tools: WebMcpTool[] = [];
    const signals: AbortSignal[] = [];
    const invoked = vi.fn(async (): Promise<Outcome<AgentCapabilityReceipt>> => ({ok: true, value: receipt('late')}));
    const host = endpoint({invoke: invoked});
    const adapter = createWebMcpAdapter({endpoint: host, modelContext: modelContext(tools, signals)});
    expect((await adapter.register()).ok).toBe(true);
    adapter.close();

    expect(host.close).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(true);
    const late = await tools[0]!.execute({query: 'events'});
    expect(late).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.closed'}]});
    expect(invoked).not.toHaveBeenCalled();
    adapter.close();
    expect(host.close).toHaveBeenCalledTimes(1);
  });

  it('propagates native execution cancellation and drops a late endpoint result', async () => {
    const tools: WebMcpTool[] = [];
    let release!: (result: Outcome<AgentCapabilityReceipt>) => void;
    const pending = new Promise<Outcome<AgentCapabilityReceipt>>(resolve => {release = resolve;});
    let endpointSignal: AbortSignal | undefined;
    const host = endpoint({invoke: async (_name, _input, options) => {
      endpointSignal = options.signal;
      return pending;
    }});
    const adapter = createWebMcpAdapter({endpoint: host, modelContext: modelContext(tools)});
    expect((await adapter.register()).ok).toBe(true);
    const controller = new AbortController();
    const execution = tools[0]!.execute({query: 'events'}, {signal: controller.signal});
    controller.abort();
    release({ok: true, value: receipt('cancelled')});
    const result = await execution;
    expect(endpointSignal?.aborted).toBe(true);
    expect(result).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.cancelled'}]});
  });

  it('settles registration when a host ignores the registration abort signal', async () => {
    let started!: () => void;
    const entered = new Promise<void>(resolve => {started = resolve;});
    let release!: () => void;
    const context: WebMcpModelContext = {registerTool: async () => {
      started();
      return new Promise<void>(resolve => {release = resolve;});
    }};
    const adapter = createWebMcpAdapter({endpoint: endpoint(), modelContext: context});
    const registration = adapter.register();
    await entered;
    adapter.close();
    expect(await registration).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.closed'}]});
    release();
  });

  it('rejects malformed or duplicate discovered definitions before registration', async () => {
    const tools: WebMcpTool[] = [];
    const host = endpoint({discover: async () => ({ok: true, value: [definition, definition]})});
    const adapter = createWebMcpAdapter({endpoint: host, modelContext: modelContext(tools)});
    const result = await adapter.register();
    expect(result).toMatchObject({ok: false, diagnostics: [{code: 'agent.webmcp.discovery'}]});
    expect(tools).toHaveLength(0);
  });
});
