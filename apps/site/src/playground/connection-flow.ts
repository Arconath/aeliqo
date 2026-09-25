import {
  checkConnection,
  sendLocalPrompt,
  type LocalPromptReceipt,
  type PlaygroundConnection,
} from './connection-controller.js';
import { connectLocalHost, type LocalHostConnection } from './local-host.js';
import type { PlaygroundSession } from './session.js';

type ActiveConnection = 'none' | 'local' | 'webmcp';

const DEFAULT_LABEL = 'No agent · manual runtime';
const DEFAULT_DETAIL = 'No local host detected. Without AI remains available.';

export interface ConnectionFlowElements {
  readonly kind: HTMLSelectElement;
  readonly status: HTMLElement;
  readonly label: HTMLElement;
  readonly dot: HTMLElement;
  readonly prompt: HTMLTextAreaElement;
  readonly send: HTMLButtonElement;
  readonly modelCalls: HTMLElement;
}

interface ConnectionFlowContext {
  readonly elements: ConnectionFlowElements;
  readonly session: () => PlaygroundSession;
  connection: ActiveConnection;
  localHost: LocalHostConnection | undefined;
  localModelReady: boolean;
  modelCallCount: number;
}

function promptStatus(receipt: LocalPromptReceipt): string {
  if (receipt.stop === 'no-commit' && receipt.message !== undefined)
    return `No validated UI change was made. Agent draft: ${receipt.message}`;
  switch (receipt.stop) {
    case 'renderer-ready': {
      const unit = receipt.toolCalls === 1 ? 'tool call' : 'tool calls';
      return `The local agent completed ${receipt.toolCalls} validated ${unit}.`;
    }
    default:
      return `The local agent stopped as ${receipt.stop}; no unsupported claim is shown as success.`;
  }
}

function updateComposer(context: ConnectionFlowContext): void {
  const ready = context.connection === 'local' && context.localModelReady;
  context.elements.prompt.disabled = !ready;
  context.elements.send.disabled = !ready;
  context.elements.send.textContent = 'Send to local agent';
  context.elements.prompt.placeholder = ready
    ? 'Describe the interface you want'
    : 'Available after a connection is ready';
}

function showConnection(context: ConnectionFlowContext, label: string, state: string): void {
  context.elements.status.textContent = label;
  context.elements.label.textContent = label;
  context.elements.dot.dataset.state = state;
}

function closeConnection(context: ConnectionFlowContext): void {
  context.localHost?.close();
  context.localHost = undefined;
  context.connection = 'none';
  context.localModelReady = false;
  updateComposer(context);
}

async function registerWebMcp(context: ConnectionFlowContext): Promise<void> {
  const registered = await context.session().connectWebMcp();
  if (registered.ok) {
    context.connection = 'webmcp';
    context.localModelReady = false;
    updateComposer(context);
    showConnection(
      context,
      `Native WebMCP registered ${registered.value.registrations} tools (experimental).`,
      'connected',
    );
    return;
  }
  context.connection = 'none';
  context.localModelReady = false;
  updateComposer(context);
  showConnection(context, registered.diagnostics[0]?.message ?? 'WebMCP registration failed safely.', 'unavailable');
}

async function pairLocalHost(
  context: ConnectionFlowContext,
  result: Extract<PlaygroundConnection, { readonly state: 'connected' }>,
): Promise<void> {
  try {
    context.localHost = await connectLocalHost(context.session());
    context.connection = 'local';
    context.localModelReady = result.modelConfigured;
    updateComposer(context);
    showConnection(context, result.label, 'connected');
  } catch (cause) {
    context.connection = 'none';
    context.localModelReady = false;
    updateComposer(context);
    const label = cause instanceof Error ? cause.message : 'The local host pairing failed safely.';
    showConnection(context, label, 'unavailable');
  }
}

async function applyCheck(
  context: ConnectionFlowContext,
  kind: 'webmcp' | 'detect',
  result: PlaygroundConnection,
): Promise<void> {
  if (kind === 'webmcp' && result.state === 'available') {
    await registerWebMcp(context);
    return;
  }
  if (result.state === 'connected') {
    await pairLocalHost(context, result);
    return;
  }
  context.connection = 'none';
  context.localModelReady = false;
  updateComposer(context);
  showConnection(context, result.label, result.state);
}

function changeKind(context: ConnectionFlowContext): void {
  switch (context.connection) {
    case 'local':
      if (context.elements.kind.value !== 'detect') {
        context.localHost?.close();
        context.localHost = undefined;
        context.localModelReady = false;
        context.connection = 'none';
        showConnection(context, 'The local agent connection was closed.', 'disconnected');
      }
      break;
    case 'webmcp':
      if (context.elements.kind.value !== 'webmcp') {
        context.session().disconnectWebMcp();
        context.connection = 'none';
        showConnection(context, 'The WebMCP connection was closed.', 'disconnected');
      }
      break;
  }
  updateComposer(context);
}

async function submitPrompt(context: ConnectionFlowContext): Promise<void> {
  const value = context.elements.prompt.value.trim();
  if (context.connection !== 'local' || value.length === 0) return;
  const controller = new AbortController();
  context.elements.status.textContent = 'Waiting for the local agent proposal…';
  context.elements.send.disabled = true;
  try {
    const receipt = await sendLocalPrompt(value, controller.signal);
    context.modelCallCount += receipt.modelRequests;
    context.elements.modelCalls.textContent = String(context.modelCallCount);
    context.elements.status.textContent = promptStatus(receipt);
  } catch {
    context.elements.status.textContent = 'The local agent request failed. No UI change was committed.';
  } finally {
    context.elements.send.disabled = context.connection !== 'local';
  }
}

function resetConnection(context: ConnectionFlowContext): void {
  closeConnection(context);
  context.elements.kind.value = 'detect';
  context.modelCallCount = 0;
  context.elements.modelCalls.textContent = '0';
  showConnection(context, DEFAULT_LABEL, 'disconnected');
  context.elements.status.textContent = DEFAULT_DETAIL;
}

export function createConnectionFlow(elements: ConnectionFlowElements, session: () => PlaygroundSession) {
  const context: ConnectionFlowContext = {
    elements,
    session,
    connection: 'none',
    localHost: undefined,
    localModelReady: false,
    modelCallCount: 0,
  };
  return {
    /** Apply a capability check or WebMCP registration for the selected kind. */
    async connect(): Promise<void> {
      closeConnection(context);
      elements.status.textContent = 'Checking capability…';
      const kind = elements.kind.value === 'webmcp' ? 'webmcp' : 'detect';
      await applyCheck(context, kind, await checkConnection(kind));
    },
    /** Close the active connection when the selector moves away from it. */
    changeKind: () => changeKind(context),
    /** Send the prompt to the paired local host and surface its bounded result. */
    submitPrompt: () => submitPrompt(context),
    /** Drop the active connection and WebMCP registration on the live session. */
    disconnect(): void {
      context.session().disconnectWebMcp();
      closeConnection(context);
    },
    /** Close the active connection without touching session registrations. */
    close: () => closeConnection(context),
    /** Restore the disconnected defaults, selector, label, and model-call count. */
    reset: () => resetConnection(context),
    /** Reflect a connection state on the status, label, and indicator elements. */
    show: (label: string, state: string) => showConnection(context, label, state),
  };
}
