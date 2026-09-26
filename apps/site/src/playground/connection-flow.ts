import type { AgentModelToolEndpoint } from '@aeliqo/agent/protocol';
import {
  checkConnection,
  isLoopbackHost,
  sendLocalPrompt,
  type LocalPromptReceipt,
  type PlaygroundConnection,
} from './connection-controller.js';
import { matchDemoTask, runDemoTask } from './demo-agent.js';
import { connectHostedRelay, pairHostedRelay, type HostedRelayConnection, type RelayState } from './hosted-relay.js';
import { connectLocalHost, type LocalHostConnection } from './local-host.js';
import { renderHostedMcpConfig } from './mcp-configs.js';
import type { ScenarioId } from './scenarios.js';
import type { PlaygroundSession } from './session.js';

type ConnectionKind = 'detect' | 'webmcp' | 'demo' | 'relay';
type ActiveConnection = 'none' | 'local' | 'webmcp' | 'demo' | 'relay';
type DotState = 'connected' | 'connecting' | 'disconnected' | 'unavailable';
type WebMcpProbe = 'supported' | 'unsupported' | 'failed';

export interface ConnectionElements {
  kind: HTMLSelectElement;
  status: HTMLElement;
  label: HTMLElement;
  dot: HTMLElement;
  prompt: HTMLTextAreaElement;
  send: HTMLButtonElement;
  modelCalls: HTMLElement;
  connectButton: HTMLButtonElement;
  localControls: HTMLElement;
  demoPanel: HTMLElement;
  relayControls: HTMLElement;
  relayGenerate: HTMLButtonElement;
  relaySession: HTMLElement;
  relayConfig: HTMLElement;
  relayCli: HTMLElement;
  relayExpiry: HTMLElement;
  mcpConfig: HTMLElement;
  webmcpNote: HTMLElement;
}

interface ConnectionHooks {
  scenario(): ScenarioId;
}

interface ConnectionFlowState {
  readonly elements: ConnectionElements;
  readonly hooks: ConnectionHooks;
  readonly session: () => PlaygroundSession;
  connection: ActiveConnection;
  localHost: LocalHostConnection | undefined;
  relay: HostedRelayConnection | undefined;
  demoEndpoint: AgentModelToolEndpoint | undefined;
  localModelReady: boolean;
  modelCallCount: number;
  demoRuns: number;
  probe: Promise<WebMcpProbe> | undefined;
}

const DEFAULT_LABEL = 'No agent · manual runtime';
const DEFAULT_STATUS = 'Pick a connection and choose Check connection. The scripted demo works in any browser.';
const MODULE_FAILURE = 'The agent module could not load. Reload the page to try again.';
const RELAY_PROMPT_HINT = 'Ask your connected agent — its proposals arrive through the relay for confirmation.';

const SEND_LABELS: Readonly<Record<ActiveConnection, string>> = {
  none: 'Send prompt',
  local: 'Send to local agent',
  webmcp: 'Send prompt',
  demo: 'Send to demo agent',
  relay: 'Send prompt',
};

function selectedKind(value: string): ConnectionKind {
  return value === 'webmcp' || value === 'demo' || value === 'relay' ? value : 'detect';
}

function describeLocalReceipt(receipt: LocalPromptReceipt): string {
  if (receipt.stop === 'no-commit' && receipt.message !== undefined)
    return `No validated UI change was made. Agent draft: ${receipt.message}`;
  if (receipt.stop === 'renderer-ready') {
    const calls = receipt.toolCalls === 1 ? 'tool call' : 'tool calls';
    return `The local agent completed ${receipt.toolCalls} validated ${calls}.`;
  }
  return `The local agent stopped as ${receipt.stop}; no unsupported claim is shown as success.`;
}

function composerPlaceholder(state: ConnectionFlowState, ready: boolean): string {
  if (state.connection === 'demo') return 'Type one of the listed requests';
  if (state.connection === 'relay') return RELAY_PROMPT_HINT;
  return ready ? 'Describe the interface you want' : 'Available after a connection is ready';
}

function updateComposer(state: ConnectionFlowState): void {
  const ready = state.connection === 'demo' || (state.connection === 'local' && state.localModelReady);
  state.elements.prompt.disabled = !ready;
  state.elements.send.disabled = !ready;
  state.elements.send.textContent = SEND_LABELS[state.connection];
  state.elements.prompt.placeholder = composerPlaceholder(state, ready);
}

function show(state: ConnectionFlowState, text: string, dot: DotState): void {
  state.elements.status.textContent = text;
  state.elements.label.textContent = text;
  state.elements.dot.dataset.state = dot;
}

function renderKindPanels(state: ConnectionFlowState): void {
  const kind = selectedKind(state.elements.kind.value);
  state.elements.localControls.hidden = kind !== 'detect';
  state.elements.demoPanel.hidden = kind !== 'demo';
  state.elements.relayControls.hidden = kind !== 'relay';
  state.elements.connectButton.hidden = kind === 'relay';
}

function teardown(state: ConnectionFlowState): void {
  state.localHost?.close();
  state.localHost = undefined;
  state.relay?.close();
  state.relay = undefined;
  state.demoEndpoint?.close();
  state.demoEndpoint = undefined;
  state.connection = 'none';
  state.localModelReady = false;
  state.elements.mcpConfig.hidden = true;
  state.elements.relaySession.hidden = true;
  state.elements.relayGenerate.disabled = false;
  state.elements.relayGenerate.textContent = 'Generate connection';
  updateComposer(state);
}

async function connectWebMcp(state: ConnectionFlowState): Promise<void> {
  const result = await state.session().connectWebMcp();
  if (result.ok) {
    state.connection = 'webmcp';
    state.localModelReady = false;
    updateComposer(state);
    show(state, `Native WebMCP registered ${result.value.registrations} tools (experimental).`, 'connected');
    return;
  }
  state.connection = 'none';
  state.localModelReady = false;
  updateComposer(state);
  show(state, result.diagnostics[0]?.message ?? 'WebMCP registration failed safely.', 'unavailable');
}

async function connectLocal(
  state: ConnectionFlowState,
  result: Extract<PlaygroundConnection, { readonly state: 'connected' }>,
): Promise<void> {
  try {
    state.localHost = await connectLocalHost(state.session());
    state.connection = 'local';
    state.localModelReady = result.modelConfigured;
    updateComposer(state);
    show(state, result.label, 'connected');
    if (isLoopbackHost(window.location.hostname)) state.elements.mcpConfig.hidden = false;
  } catch (cause) {
    state.connection = 'none';
    state.localModelReady = false;
    updateComposer(state);
    show(state, cause instanceof Error ? cause.message : 'The local host pairing failed safely.', 'unavailable');
  }
}

async function connectDemo(state: ConnectionFlowState): Promise<void> {
  state.elements.status.textContent = 'Starting the scripted demo agent…';
  const result = await state.session().connectDemoAgent();
  if (!result.ok) {
    show(state, result.diagnostics[0]?.message ?? 'The demo agent could not start safely.', 'unavailable');
    return;
  }
  state.demoEndpoint = result.value;
  state.connection = 'demo';
  updateComposer(state);
  show(state, 'Demo agent · scripted, no model calls', 'connected');
  state.elements.status.textContent =
    'Scripted demo ready — it only understands the requests listed above. No model is called.';
}

function relayExpiryText(expiresAt: number): string {
  const at = new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const minutes = Math.max(0, Math.round((expiresAt - Date.now()) / 60_000));
  return `Session expires at ${at} (about ${minutes} min). Regenerate when it lapses.`;
}

function onRelayState(state: ConnectionFlowState, next: RelayState): void {
  switch (next) {
    case 'live':
      state.elements.relayGenerate.textContent = 'Regenerate connection';
      show(state, 'Relay connected — your agent reaches this page through mcp.aeliqo.com.', 'connected');
      return;
    case 'interrupted':
      show(state, 'The relay channel dropped — reconnecting automatically.', 'connecting');
      return;
    case 'disconnected':
      show(state, 'The relay detached this tab. Generate a new connection to continue.', 'disconnected');
      return;
    case 'expired':
      state.elements.relayExpiry.textContent = 'Session expired — generate a new connection.';
      show(state, 'The relay session expired. Choose Regenerate connection to continue.', 'unavailable');
      return;
  }
}

async function connectRelay(state: ConnectionFlowState): Promise<void> {
  state.elements.relayGenerate.disabled = true;
  show(state, 'Requesting a hosted relay session…', 'connecting');
  try {
    const pair = await pairHostedRelay();
    if (selectedKind(state.elements.kind.value) !== 'relay') return;
    renderHostedMcpConfig(state.elements.relayConfig, state.elements.relayCli, pair);
    state.elements.relayExpiry.textContent = relayExpiryText(pair.expiresAt);
    state.elements.relaySession.hidden = false;
    show(state, 'Relay session created — opening the attach channel…', 'connecting');
    const relay = await connectHostedRelay(state.session(), pair, (next) => onRelayState(state, next));
    if (selectedKind(state.elements.kind.value) !== 'relay') {
      relay.close();
      state.elements.relaySession.hidden = true;
      return;
    }
    state.relay = relay;
    state.connection = 'relay';
    state.elements.relayGenerate.textContent = 'Regenerate connection';
    updateComposer(state);
    show(state, 'Relay connected — your agent reaches this page through mcp.aeliqo.com.', 'connected');
  } catch (cause) {
    if (selectedKind(state.elements.kind.value) !== 'relay') return;
    show(state, cause instanceof Error ? cause.message : 'The hosted relay pairing failed safely.', 'unavailable');
  } finally {
    state.elements.relayGenerate.disabled = false;
  }
}

async function applyCheck(
  state: ConnectionFlowState,
  kind: ConnectionKind,
  result: PlaygroundConnection,
): Promise<void> {
  if (kind === 'webmcp' && result.state === 'available') {
    await connectWebMcp(state);
    return;
  }
  if (result.state === 'connected') {
    await connectLocal(state, result);
    return;
  }
  state.connection = 'none';
  state.localModelReady = false;
  updateComposer(state);
  show(state, result.label, result.state === 'unavailable' ? 'unavailable' : 'disconnected');
}

function onKindChange(state: ConnectionFlowState): void {
  renderKindPanels(state);
  const kind = selectedKind(state.elements.kind.value);
  switch (state.connection) {
    case 'local':
      if (kind !== 'detect') {
        teardown(state);
        show(state, 'The local agent connection was closed.', 'disconnected');
      }
      break;
    case 'webmcp':
      if (kind !== 'webmcp') {
        state.session().disconnectWebMcp();
        state.connection = 'none';
        show(state, 'The WebMCP connection was closed.', 'disconnected');
      }
      break;
    case 'demo':
      if (kind !== 'demo') {
        teardown(state);
        show(state, 'The demo agent was stopped.', 'disconnected');
      }
      break;
    case 'relay':
      if (kind !== 'relay') {
        teardown(state);
        show(state, 'The hosted relay connection was closed.', 'disconnected');
      }
      break;
    default:
      break;
  }
  if (state.connection === 'none' && kind === 'relay')
    state.elements.status.textContent =
      'Choose Generate connection — the hosted relay pairs your agent with this page.';
  updateComposer(state);
}

async function sendLocal(state: ConnectionFlowState, text: string): Promise<void> {
  const controller = new AbortController();
  state.elements.status.textContent = 'Waiting for the local agent proposal…';
  state.elements.send.disabled = true;
  try {
    const receipt = await sendLocalPrompt(text, controller.signal);
    state.modelCallCount += receipt.modelRequests;
    state.elements.modelCalls.textContent = String(state.modelCallCount);
    state.elements.status.textContent = describeLocalReceipt(receipt);
  } catch {
    state.elements.status.textContent = 'The local agent request failed. No UI change was committed.';
  } finally {
    state.elements.send.disabled = state.connection !== 'local';
  }
}

async function sendDemo(state: ConnectionFlowState, text: string): Promise<void> {
  const endpoint = state.demoEndpoint;
  if (endpoint === undefined) return;
  state.elements.send.disabled = true;
  try {
    const task = matchDemoTask(text, state.hooks.scenario());
    if (task === undefined) {
      state.elements.status.textContent =
        'The scripted demo only understands the listed requests. Nothing was sent and nothing changed.';
      return;
    }
    state.elements.status.textContent = `Demo agent is running context → render for “${task.label}”…`;
    state.demoRuns += 1;
    state.elements.status.textContent = await runDemoTask(endpoint, task, state.demoRuns);
  } finally {
    state.elements.send.disabled = state.connection !== 'demo';
  }
}

function submitPrompt(state: ConnectionFlowState): Promise<void> | undefined {
  const text = state.elements.prompt.value.trim();
  if (text.length === 0) return undefined;
  switch (state.connection) {
    case 'demo':
      return sendDemo(state, text);
    case 'local':
      return sendLocal(state, text);
    case 'relay':
      state.elements.status.textContent =
        'The connected agent sends proposals through the relay — nothing is sent from this page.';
      return undefined;
    default:
      state.elements.status.textContent = 'Choose Check connection first — no agent is connected yet.';
      return undefined;
  }
}

async function probeWebMcp(): Promise<WebMcpProbe> {
  try {
    const { detectWebMcp } = await import('@aeliqo/agent/webmcp');
    return detectWebMcp({ document, evidence: 'native' }).supported ? 'supported' : 'unsupported';
  } catch {
    return 'failed';
  }
}

function applyProbe(state: ConnectionFlowState, probe: WebMcpProbe): void {
  switch (probe) {
    case 'supported':
      state.elements.webmcpNote.hidden = true;
      return;
    case 'unsupported':
      state.elements.webmcpNote.hidden = false;
      return;
    case 'failed':
      state.elements.webmcpNote.hidden = false;
      state.elements.status.textContent = MODULE_FAILURE;
  }
}

function reset(state: ConnectionFlowState): void {
  teardown(state);
  state.elements.kind.value = 'demo';
  state.modelCallCount = 0;
  state.demoRuns = 0;
  state.elements.modelCalls.textContent = '0';
  renderKindPanels(state);
  show(state, DEFAULT_LABEL, 'disconnected');
  state.elements.status.textContent = DEFAULT_STATUS;
}

export function createConnectionFlow(
  elements: ConnectionElements,
  session: () => PlaygroundSession,
  hooks: ConnectionHooks,
) {
  const state: ConnectionFlowState = {
    elements,
    hooks,
    session,
    connection: 'none',
    localHost: undefined,
    relay: undefined,
    demoEndpoint: undefined,
    localModelReady: false,
    modelCallCount: 0,
    demoRuns: 0,
    probe: undefined,
  };
  return {
    async prepare(): Promise<void> {
      state.probe ??= probeWebMcp();
      applyProbe(state, await state.probe);
    },
    async connect(): Promise<void> {
      teardown(state);
      const kind = selectedKind(elements.kind.value);
      if (kind === 'demo') {
        await connectDemo(state);
        return;
      }
      if (kind === 'relay') {
        await connectRelay(state);
        return;
      }
      elements.status.textContent = 'Checking capability…';
      try {
        await applyCheck(state, kind, await checkConnection(kind));
      } catch {
        show(state, MODULE_FAILURE, 'unavailable');
      }
    },
    changeKind: (): void => onKindChange(state),
    submitPrompt: (): Promise<void> | undefined => submitPrompt(state),
    disconnect(): void {
      state.session().disconnectWebMcp();
      teardown(state);
    },
    close: (): void => teardown(state),
    reset: (): void => reset(state),
    show: (text: string, dot: DotState): void => show(state, text, dot),
  };
}
