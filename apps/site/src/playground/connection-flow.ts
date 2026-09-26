import type { AgentModelToolEndpoint } from '@aeliqo/agent/protocol';
import {
  checkConnection,
  isLoopbackHost,
  sendLocalPrompt,
  type LocalPromptReceipt,
  type PlaygroundConnection,
} from './connection-controller.js';
import { matchDemoTask, runDemoTask } from './demo-agent.js';
import { connectLocalHost, type LocalHostConnection } from './local-host.js';
import type { ScenarioId } from './scenarios.js';
import type { PlaygroundSession } from './session.js';

type ConnectionKind = 'detect' | 'webmcp' | 'demo';
type ActiveConnection = 'none' | 'local' | 'webmcp' | 'demo';
type DotState = 'connected' | 'disconnected' | 'unavailable';
type WebMcpProbe = 'supported' | 'unsupported' | 'failed';

export interface ConnectionElements {
  kind: HTMLSelectElement;
  status: HTMLElement;
  label: HTMLElement;
  dot: HTMLElement;
  prompt: HTMLTextAreaElement;
  send: HTMLButtonElement;
  modelCalls: HTMLElement;
  localControls: HTMLElement;
  demoPanel: HTMLElement;
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
  demoEndpoint: AgentModelToolEndpoint | undefined;
  localModelReady: boolean;
  modelCallCount: number;
  demoRuns: number;
  probe: Promise<WebMcpProbe> | undefined;
}

const DEFAULT_LABEL = 'No agent · manual runtime';
const DEFAULT_STATUS = 'Pick a connection and choose Check connection. The scripted demo works in any browser.';
const MODULE_FAILURE = 'The agent module could not load. Reload the page to try again.';

function selectedKind(value: string): ConnectionKind {
  return value === 'webmcp' || value === 'demo' ? value : 'detect';
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

function updateComposer(state: ConnectionFlowState): void {
  const demo = state.connection === 'demo';
  const ready = demo || (state.connection === 'local' && state.localModelReady);
  state.elements.prompt.disabled = !ready;
  state.elements.send.disabled = !ready;
  state.elements.send.textContent = demo ? 'Send to demo agent' : 'Send to local agent';
  if (demo) {
    state.elements.prompt.placeholder = 'Type one of the listed requests';
    return;
  }
  state.elements.prompt.placeholder = ready
    ? 'Describe the interface you want'
    : 'Available after a connection is ready';
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
}

function teardown(state: ConnectionFlowState): void {
  state.localHost?.close();
  state.localHost = undefined;
  state.demoEndpoint?.close();
  state.demoEndpoint = undefined;
  state.connection = 'none';
  state.localModelReady = false;
  state.elements.mcpConfig.hidden = true;
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
    default:
      break;
  }
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
  state.elements.kind.value = 'detect';
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
