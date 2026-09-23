import type { Intent } from '@aeliqo/core';
import type { WebRenderReceipt } from '@aeliqo/web/app';
import { createActionReviewController } from './action-review.js';
import { checkConnection, sendLocalPrompt } from './connection-controller.js';
import { createHostedDeepSeekControls } from './deepseek-controls.js';
import { evidenceFor, type InspectorSection, type PlaygroundEvidence } from './inspect.js';
import { connectLocalHost, type LocalHostConnection } from './local-host.js';
import { PLAYGROUND_SCENARIOS, type PlaygroundScenario, type ScenarioId } from './scenarios.js';
import { createPlaygroundSession, type PlaygroundSession } from './session.js';

type Mode = 'without-ai' | 'connected';
type ConnectionCheck = Awaited<ReturnType<typeof checkConnection>>;
type LocalPromptReceipt = Awaited<ReturnType<typeof sendLocalPrompt>>;
const modeLabels: Readonly<Record<Mode, string>> = {
  'without-ai': 'Without AI',
  connected: 'Connect AI',
};

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Playground element ${selector} is missing.`);
  return element;
}

const scenarioSelect = required<HTMLSelectElement>('#pg-scenario');
const appRoot = required<HTMLElement>('.pg-app');
const bootState = required<HTMLElement>('#pg-boot');
const bootControls = document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-playground-boot-control]');
const scenarioDescription = required<HTMLElement>('#pg-scenario-description');
const stepsHost = required<HTMLElement>('#pg-steps');
const manualStep = required<HTMLSelectElement>('#pg-manual-step');
const modeLabel = required<HTMLElement>('#pg-mode-label');
const guidedPanel = required<HTMLElement>('#pg-guided');
const manualPanel = required<HTMLElement>('#pg-manual');
const connectedPanel = required<HTMLElement>('#pg-connected');
const regionHost = required<HTMLElement>('#pg-region');
const status = required<HTMLElement>('#pg-status');
const resultDefinition = required<HTMLElement>('#pg-result-definition');
const error = required<HTMLElement>('#pg-error');
const viewBadge = required<HTMLElement>('#pg-view-badge');
const resultTitle = required<HTMLElement>('#pg-result-title');
const receiptState = required<HTMLElement>('#pg-receipt-state');
const modelCalls = required<HTMLElement>('#pg-model-calls');
const journeyIntent = required<HTMLElement>('#pg-journey-intent');
const journeyResult = required<HTMLElement>('#pg-journey-result');
const journeyView = required<HTMLElement>('#pg-journey-view');
const inspector = required<HTMLDialogElement>('#pg-inspector');
const inspectorSummary = required<HTMLElement>('#pg-inspector-summary');
const inspectorContent = required<HTMLElement>('#pg-inspector-content');
const actionDialog = required<HTMLDialogElement>('#pg-action');
const actionContent = required<HTMLElement>('#pg-action-content');
const actionStatus = required<HTMLElement>('#pg-action-status');
const actionCancel = required<HTMLButtonElement>('#pg-action-cancel');
const actionConfirm = required<HTMLButtonElement>('#pg-action-confirm');
const connectionKind = required<HTMLSelectElement>('#pg-connection-kind');
const localConnectionControls = required<HTMLElement>('#pg-local-connection-controls');
const connectionStatus = required<HTMLElement>('#pg-connect-status');
const connectionLabel = required<HTMLElement>('#pg-connection-label');
const connectionDot = required<HTMLElement>('#pg-connection-dot');
const prompt = required<HTMLTextAreaElement>('#pg-prompt');
const send = required<HTMLButtonElement>('#pg-send');

let mode: Mode = 'without-ai';
let scenario: PlaygroundScenario = PLAYGROUND_SCENARIOS[0]!;
let activeRequest: AbortController | undefined;
let session: PlaygroundSession;
let last: PlaygroundEvidence = {};
let inspectorSection: InspectorSection = 'intent';
let connection: 'none' | 'local' | 'webmcp' | 'deepseek' = 'none';
let modelCallCount = 0;
let localHost: LocalHostConnection | undefined;
let localModelReady = false;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{"error":"Value could not be serialized."}';
  }
}

function setError(message?: string): void {
  error.hidden = message === undefined;
  error.textContent = message ?? '';
}

const actionReview = createActionReviewController({
  dialog: actionDialog,
  content: actionContent,
  cancelButton: actionCancel,
  confirmButton: actionConfirm,
  status: actionStatus,
  pageStatus: status,
  receiptState,
  stringify,
  setError,
});

function updateComposer(): void {
  const ready = (connection === 'local' && localModelReady) || connection === 'deepseek';
  prompt.disabled = !ready;
  send.disabled = !ready;
  send.textContent = connection === 'deepseek' ? 'Send directly to DeepSeek' : 'Send to local agent';
  prompt.placeholder = ready ? 'Describe the interface you want' : 'Available after a connection is ready';
}

const hostedDeepSeek = createHostedDeepSeekControls({
  connectionKind,
  localControls: localConnectionControls,
  controls: required<HTMLElement>('#pg-deepseek-controls'),
  keyInput: required<HTMLInputElement>('#pg-deepseek-key'),
  consent: required<HTMLInputElement>('#pg-deepseek-consent'),
  connectButton: required<HTMLButtonElement>('#pg-deepseek-connect'),
  disconnectButton: required<HTMLButtonElement>('#pg-deepseek-disconnect'),
  status: connectionStatus,
  prompt,
  sendButton: send,
  getSession: () => session,
  getScenario: () => scenario,
  showConnection,
  updateComposer,
  onConnected: () => {
    connection = 'deepseek';
  },
  onDisconnected: () => {
    if (connection === 'deepseek') connection = 'none';
  },
  recordModelRequests: (count) => {
    modelCallCount += count;
    modelCalls.textContent = String(modelCallCount);
  },
});

function renderInspector(): void {
  const section = evidenceFor(last, inspectorSection);
  inspectorSummary.textContent = section.summary;
  inspectorContent.textContent = stringify(section.value);
}

function resetSession(): void {
  activeRequest?.abort();
  hostedDeepSeek.clear();
  localHost?.close();
  localHost = undefined;
  session?.dispose();
  regionHost.replaceChildren();
  session = createPlaygroundSession(actionReview.handle, applyAgentReceipt);
  last = {};
  actionReview.reset();
  connection = 'none';
  localModelReady = false;
  connectionKind.value = 'detect';
  modelCallCount = 0;
  modelCalls.textContent = '0';
  connectionLabel.textContent = 'No agent · manual runtime';
  connectionStatus.textContent = 'No local host detected. Without AI remains available.';
  connectionDot.dataset.state = 'disconnected';
  hostedDeepSeek.update();
  prompt.value = '';
  updateComposer();
  setError();
  status.textContent = 'Session reset. Choose a task.';
  journeyIntent.textContent = 'Choose a task';
  journeyResult.textContent = 'Waiting';
  journeyView.textContent = 'Waiting';
  viewBadge.textContent = 'Waiting for intent';
  resultTitle.textContent = 'Employees';
  resultDefinition.hidden = true;
  resultDefinition.textContent = '';
  receiptState.textContent = 'None';
  renderInspector();
}

function currentScenario(id: string): PlaygroundScenario {
  return PLAYGROUND_SCENARIOS.find((candidate) => candidate.id === id) ?? PLAYGROUND_SCENARIOS[0]!;
}

function renderScenario(): void {
  scenarioDescription.textContent = scenario.description;
  stepsHost.replaceChildren();
  manualStep.replaceChildren();
  for (const step of scenario.steps) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.step = step.id;
    const strong = document.createElement('strong');
    strong.textContent = step.label;
    const description = document.createElement('span');
    description.textContent = step.description;
    button.append(strong, description);
    button.addEventListener('click', () => void runIntent(step.intent(), button));
    stepsHost.append(button);
    const option = document.createElement('option');
    option.value = step.id;
    option.textContent = step.label;
    manualStep.append(option);
  }
}

function selectedView(receipt: WebRenderReceipt): string {
  if (!('presentation' in receipt)) return receipt.status;
  return (
    receipt.presentation.nodes.find((node) => node.node.id === receipt.presentation.plan.rootId)?.manifest.id ??
    receipt.status
  );
}

function viewLabel(view: string): string {
  const name = view.split('.').at(-1) ?? view;
  return name.replaceAll('-', ' ').replace(/^\w/u, (letter) => letter.toUpperCase());
}

function intentLabel(intent: Intent): string {
  const registered = scenario.steps.find((step) => step.id === intent.id);
  if (registered !== undefined) return registered.label;
  const kind = intent.kind.replace(/^\w/u, (letter) => letter.toUpperCase());
  return `${kind} ${scenario.label.toLowerCase()}`;
}

async function applyReceipt(intent: Intent, receipt: WebRenderReceipt): Promise<void> {
  last = { intent, receipt };
  receiptState.textContent = receipt.status;
  viewBadge.textContent = selectedView(receipt);
  journeyIntent.textContent = intentLabel(intent);
  const activeStep = scenario.steps.find((step) => step.id === intent.id);
  resultTitle.textContent = activeStep?.label ?? `${scenario.label} result`;
  resultDefinition.textContent = activeStep?.definition ?? '';
  resultDefinition.hidden = activeStep?.definition === undefined;
  if (receipt.status === 'renderer-ready') {
    journeyResult.textContent = 'Evaluated';
    journeyView.textContent = viewLabel(selectedView(receipt));
    status.textContent = `${resultTitle.textContent} is ready. Open Inspect to see the request, result, and view choice.`;
  } else {
    const message = receipt.diagnostics[0]?.message ?? `The request ended as ${receipt.status}.`;
    journeyResult.textContent = 'Could not complete';
    journeyView.textContent = 'No new view';
    status.textContent = message;
    setError(message);
  }
  renderInspector();
}

async function applyAgentReceipt(intent: Intent, receipt: WebRenderReceipt): Promise<void> {
  setError();
  await applyReceipt(intent, receipt);
}

async function runIntent(intent: Intent, trigger?: HTMLButtonElement): Promise<void> {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  setError();
  journeyIntent.textContent = intentLabel(intent);
  journeyResult.textContent = 'Checking…';
  journeyView.textContent = 'Waiting';
  status.textContent = 'Checking the request and evaluating the result…';
  trigger?.setAttribute('aria-busy', 'true');
  try {
    const receipt = await session.render(regionHost, intent, controller.signal);
    if (activeRequest !== controller) return;
    await applyReceipt(intent, receipt);
  } catch {
    if (!controller.signal.aborted) {
      journeyResult.textContent = 'Could not complete';
      journeyView.textContent = 'No new view';
      setError('The playground request failed safely. Reset the session and try again.');
    }
  } finally {
    trigger?.removeAttribute('aria-busy');
    if (activeRequest === controller) activeRequest = undefined;
  }
}

function setMode(next: Mode): void {
  mode = next;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  guidedPanel.hidden = mode !== 'without-ai';
  manualPanel.hidden = mode !== 'without-ai';
  connectedPanel.hidden = mode !== 'connected';
  modeLabel.textContent = modeLabels[mode];
}

function modeFrom(value: string | undefined): Mode | undefined {
  return value === 'without-ai' || value === 'connected' ? value : undefined;
}

function inspectorFrom(value: string | undefined): InspectorSection | undefined {
  return value === 'intent' ||
    value === 'task' ||
    value === 'result' ||
    value === 'presentation' ||
    value === 'diagnostics'
    ? value
    : undefined;
}

function showConnection(label: string, state: string): void {
  connectionStatus.textContent = label;
  connectionLabel.textContent = label;
  connectionDot.dataset.state = state;
}

function changeConnectionKind(): void {
  if (connectionKind.value !== 'deepseek') {
    const hadHostedState = hostedDeepSeek.clear();
    if (hadHostedState) {
      if (connection === 'deepseek') connection = 'none';
      showConnection('Disconnected from DeepSeek; the browser-held key was cleared.', 'disconnected');
    }
  }
  if (connection === 'local' && connectionKind.value !== 'detect') {
    localHost?.close();
    localHost = undefined;
    localModelReady = false;
    connection = 'none';
    showConnection('The local agent connection was closed.', 'disconnected');
  }
  if (connection === 'webmcp' && connectionKind.value !== 'webmcp') {
    session.disconnectWebMcp();
    connection = 'none';
    showConnection('The WebMCP connection was closed.', 'disconnected');
  }
  hostedDeepSeek.update();
  updateComposer();
}

async function registerWebMcpConnection(): Promise<void> {
  const registered = await session.connectWebMcp();
  if (registered.ok) {
    connection = 'webmcp';
    localModelReady = false;
    updateComposer();
    showConnection(`Native WebMCP registered ${registered.value.registrations} tools (experimental).`, 'connected');
    return;
  }
  connection = 'none';
  localModelReady = false;
  updateComposer();
  showConnection(registered.diagnostics[0]?.message ?? 'WebMCP registration failed safely.', 'unavailable');
}

async function pairDetectedLocalHost(result: Extract<ConnectionCheck, { readonly state: 'connected' }>): Promise<void> {
  try {
    localHost = await connectLocalHost(session);
    connection = 'local';
    localModelReady = result.modelConfigured;
    updateComposer();
    showConnection(result.label, 'connected');
  } catch (cause) {
    connection = 'none';
    localModelReady = false;
    updateComposer();
    const label = cause instanceof Error ? cause.message : 'The local host pairing failed safely.';
    showConnection(label, 'unavailable');
  }
}

async function applyConnectionCheck(kind: 'webmcp' | 'detect', result: ConnectionCheck): Promise<void> {
  if (kind === 'webmcp' && result.state === 'available') {
    await registerWebMcpConnection();
    return;
  }
  if (result.state === 'connected') {
    await pairDetectedLocalHost(result);
    return;
  }
  connection = 'none';
  localModelReady = false;
  updateComposer();
  showConnection(result.label, result.state);
}

function promptStatus(receipt: LocalPromptReceipt): string {
  if (receipt.stop === 'renderer-ready') {
    const unit = receipt.toolCalls === 1 ? 'tool call' : 'tool calls';
    return `The local agent completed ${receipt.toolCalls} validated ${unit}.`;
  }
  if (receipt.stop === 'no-commit' && receipt.message !== undefined)
    return `No validated UI change was made. Agent draft: ${receipt.message}`;
  return `The local agent stopped as ${receipt.stop}; no unsupported claim is shown as success.`;
}

async function submitLocalPrompt(): Promise<void> {
  const value = prompt.value.trim();
  if (connection !== 'local' || value.length === 0) return;
  const controller = new AbortController();
  connectionStatus.textContent = 'Waiting for the local agent proposal…';
  send.disabled = true;
  try {
    const receipt = await sendLocalPrompt(value, controller.signal);
    modelCallCount += receipt.modelRequests;
    modelCalls.textContent = String(modelCallCount);
    connectionStatus.textContent = promptStatus(receipt);
  } catch {
    connectionStatus.textContent = 'The local agent request failed. No UI change was committed.';
  } finally {
    send.disabled = connection !== 'local';
  }
}

for (const item of PLAYGROUND_SCENARIOS) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  scenarioSelect.append(option);
}
scenarioSelect.value = scenario.id;
scenarioSelect.addEventListener('change', () => {
  hostedDeepSeek.cancel();
  scenario = currentScenario(scenarioSelect.value);
  renderScenario();
  void runIntent(scenario.steps[0]!.intent());
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
  button.addEventListener('click', () => {
    const next = modeFrom(button.dataset.mode);
    if (next !== undefined) setMode(next);
  });
required<HTMLButtonElement>('#pg-run-manual').addEventListener('click', () => {
  const step = scenario.steps.find((candidate) => candidate.id === manualStep.value) ?? scenario.steps[0]!;
  void runIntent(step.intent());
});
required<HTMLButtonElement>('#pg-reset').addEventListener('click', () => resetSession());
required<HTMLButtonElement>('#pg-export').addEventListener('click', async () => {
  const [{ projectFiles }, { zipProject }] = await Promise.all([import('./project-template.js'), import('./zip.js')]);
  const blob = zipProject(projectFiles(scenario.id, __AELIQO_RELEASE_VERSION__));
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `aeliqo-${scenario.id}-example.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
  status.textContent = `Exported the installable ${scenario.label} project with synthetic data and no credentials.`;
});
required<HTMLButtonElement>('#pg-inspect').addEventListener('click', () => {
  renderInspector();
  inspector.showModal();
});
required<HTMLButtonElement>('#pg-inspector-close').addEventListener('click', () => inspector.close());
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-inspector]'))
  button.addEventListener('click', () => {
    const next = inspectorFrom(button.dataset.inspector);
    if (next === undefined) return;
    inspectorSection = next;
    for (const candidate of document.querySelectorAll<HTMLButtonElement>('[data-inspector]'))
      candidate.setAttribute('aria-pressed', String(candidate === button));
    renderInspector();
  });
required<HTMLButtonElement>('#pg-connect').addEventListener('click', async () => {
  if (connectionKind.value === 'deepseek') return;
  localHost?.close();
  localHost = undefined;
  connection = 'none';
  localModelReady = false;
  updateComposer();
  connectionStatus.textContent = 'Checking capability…';
  const kind = connectionKind.value === 'webmcp' ? 'webmcp' : 'detect';
  const result = await checkConnection(kind);
  await applyConnectionCheck(kind, result);
});
connectionKind.addEventListener('change', changeConnectionKind);
send.addEventListener('click', () => {
  if (connection === 'deepseek') void hostedDeepSeek.submit();
  else void submitLocalPrompt();
});

resetSession();
renderScenario();
for (const control of bootControls) control.disabled = false;
hostedDeepSeek.update();
bootState.hidden = true;
appRoot.removeAttribute('aria-busy');
void runIntent(scenario.steps[0]!.intent());
window.addEventListener('pagehide', () => {
  activeRequest?.abort();
  const clearedHostedConnection = hostedDeepSeek.clear();
  localHost?.close();
  localHost = undefined;
  session.dispose();
  connection = 'none';
  localModelReady = false;
  updateComposer();
  if (clearedHostedConnection)
    showConnection('Connection cleared when the page was left. Reconnect to continue.', 'disconnected');
});

export type { ScenarioId };
