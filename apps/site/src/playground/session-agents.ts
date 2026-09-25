import { parseIntent, type Intent, type Outcome } from '@aeliqo/core';
import type { AgentModelToolEndpoint, AgentToolTransport } from '@aeliqo/agent/protocol';
import type { WebMcpAdapter, WebMcpEvidence } from '@aeliqo/agent/webmcp';
import { createAeliqoApp, type WebRenderReceipt } from '@aeliqo/web/app';
import { failure } from './guards.js';

type PlaygroundApp = ReturnType<typeof createAeliqoApp>;
type PlaygroundRender = (target: HTMLElement, intent: Intent, signal?: AbortSignal) => Promise<WebRenderReceipt>;
type AgentRenderInput = { readonly intent: unknown; readonly signal?: AbortSignal };
type WebMcpConnection = { readonly registrations: number; readonly evidence: WebMcpEvidence };

interface AgentConnectionState {
  enabled: boolean;
  webMcp: WebMcpAdapter | undefined;
  readonly endpoints: Set<AgentModelToolEndpoint>;
}

interface AgentConnectionOptions {
  readonly app: PlaygroundApp;
  readonly regionId: string;
  readonly getTarget: () => HTMLElement | undefined;
  readonly render: PlaygroundRender;
  readonly onAgentRender?: (intent: Intent, receipt: WebRenderReceipt) => void | Promise<void>;
  readonly state: AgentConnectionState;
}

function syncEgress(state: AgentConnectionState): void {
  state.enabled = state.webMcp !== undefined || state.endpoints.size > 0;
}

function renderPort(
  target: HTMLElement,
  regionId: string,
  requestId: string,
  render: PlaygroundRender,
  onAgentRender?: AgentConnectionOptions['onAgentRender'],
) {
  return {
    async render(input: AgentRenderInput): Promise<WebRenderReceipt> {
      const parsed = parseIntent(input.intent);
      if (!parsed.ok) return { status: 'failed', requestId, regionId, diagnostics: parsed.diagnostics };
      const receipt = await render(target, parsed.value, input.signal);
      await onAgentRender?.(parsed.value, receipt);
      return receipt;
    },
  };
}

function endpointOptions(
  app: PlaygroundApp,
  regionId: string,
  target: HTMLElement,
  render: PlaygroundRender,
  onAgentRender: AgentConnectionOptions['onAgentRender'],
  transport: AgentToolTransport,
  goalEpoch: string,
) {
  return {
    runtime: app.runtime,
    regionId,
    context: { read: () => app.runtime.contexts(regionId) },
    render: renderPort(target, regionId, `playground-${transport}-intent`, render, onAgentRender),
    goalEpoch,
    transport,
    expiresAt: Date.now() + 15 * 60_000,
    maxPending: 2,
    maxMilliseconds: 15_000,
    maxInputBytes: 32_000,
    maxOutputBytes: 64_000,
  };
}

function trackEndpoint(inner: AgentModelToolEndpoint, state: AgentConnectionState): AgentModelToolEndpoint {
  let tracked: AgentModelToolEndpoint;
  let closed = false;
  tracked = Object.freeze({
    ...inner,
    close() {
      if (closed) return;
      closed = true;
      inner.close();
      state.endpoints.delete(tracked);
      syncEgress(state);
    },
  });
  state.endpoints.add(tracked);
  syncEgress(state);
  return tracked;
}

async function connectAgent(
  options: AgentConnectionOptions,
  transport: Extract<AgentToolTransport, 'byok' | 'mcp'>,
  goalEpoch: string = crypto.randomUUID(),
) {
  const target = options.getTarget();
  if (target === undefined)
    return failure<AgentModelToolEndpoint>('playground.agent-region', 'Render a scenario before connecting an agent.');
  options.state.enabled = true;
  const { createAppToolEndpoint } = await import('@aeliqo/agent/app');
  const endpoint = createAppToolEndpoint(
    endpointOptions(options.app, options.regionId, target, options.render, options.onAgentRender, transport, goalEpoch),
  );
  if (!endpoint.ok) {
    syncEgress(options.state);
    return { ok: false as const, diagnostics: endpoint.diagnostics };
  }
  return { ok: true as const, value: trackEndpoint(endpoint.value, options.state) };
}

async function connectWebMcp(options: AgentConnectionOptions): Promise<Outcome<WebMcpConnection>> {
  const target = options.getTarget();
  if (target === undefined) return failure('playground.webmcp-region', 'Render a scenario before connecting WebMCP.');
  options.state.webMcp?.close();
  options.state.webMcp = undefined;
  syncEgress(options.state);
  options.state.enabled = true;
  const [{ createAppToolEndpoint }, { registerWebMcpTools }] = await Promise.all([
    import('@aeliqo/agent/app'),
    import('@aeliqo/agent/webmcp'),
  ]);
  const endpoint = createAppToolEndpoint(
    endpointOptions(
      options.app,
      options.regionId,
      target,
      options.render,
      options.onAgentRender,
      'webmcp',
      crypto.randomUUID(),
    ),
  );
  if (!endpoint.ok) {
    syncEgress(options.state);
    return { ok: false, diagnostics: endpoint.diagnostics };
  }
  const hostDocument = typeof document === 'undefined' ? undefined : document;
  const registered = await registerWebMcpTools({
    endpoint: endpoint.value,
    ...(hostDocument === undefined ? {} : { document: hostDocument, evidence: 'native' as const }),
  });
  if (!registered.ok) {
    endpoint.value.close();
    syncEgress(options.state);
    return { ok: false, diagnostics: registered.diagnostics };
  }
  options.state.webMcp = registered.value.adapter;
  syncEgress(options.state);
  return {
    ok: true,
    value: { registrations: registered.value.registrations.length, evidence: registered.value.adapter.evidence },
  };
}

export function createPlaygroundAgentConnections(options: AgentConnectionOptions) {
  return {
    connectAgent: (transport: Extract<AgentToolTransport, 'byok' | 'mcp'>, goalEpoch?: string) =>
      connectAgent(options, transport, goalEpoch),
    connectWebMcp: () => connectWebMcp(options),
    disconnectWebMcp() {
      options.state.webMcp?.close();
      options.state.webMcp = undefined;
      syncEgress(options.state);
    },
    dispose() {
      options.state.webMcp?.close();
      options.state.webMcp = undefined;
      for (const endpoint of [...options.state.endpoints]) endpoint.close();
      options.state.endpoints.clear();
      syncEgress(options.state);
    },
  };
}
