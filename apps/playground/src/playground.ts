import type { Intent } from '@aeliqo/core';
import type { AeliqoAppActionEvent, WebRenderReceipt } from '@aeliqo/web/app';
import { syncComponentTheme } from '/src/site.js';
import { checkConnection, sendLocalPrompt } from './connection-controller.js';
import { evidenceFor, type InspectorSection, type PlaygroundEvidence } from './inspect.js';
import { connectLocalHost, type LocalHostConnection } from './local-host.js';
import { PLAYGROUND_SCENARIOS, type PlaygroundScenario, type ScenarioId } from './scenarios.js';
import { createPlaygroundSession, type PlaygroundSession } from './session.js';

type Mode = 'guided' | 'manual' | 'connected';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Playground element ${selector} is missing.`);
  return element;
}

const scenarioSelect = required<HTMLSelectElement>('#pg-scenario');
const appRoot = required<HTMLElement>('.pg-app');
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
const error = required<HTMLElement>('#pg-error');
const viewBadge = required<HTMLElement>('#pg-view-badge');
const receiptState = required<HTMLElement>('#pg-receipt-state');
const modelCalls = required<HTMLElement>('#pg-model-calls');
const inspector = required<HTMLDialogElement>('#pg-inspector');
const inspectorSummary = required<HTMLElement>('#pg-inspector-summary');
const inspectorContent = required<HTMLElement>('#pg-inspector-content');
const actionDialog = required<HTMLDialogElement>('#pg-action');
const actionContent = required<HTMLElement>('#pg-action-content');
const actionStatus = required<HTMLElement>('#pg-action-status');
const actionCancel = required<HTMLButtonElement>('#pg-action-cancel');
const actionConfirm = required<HTMLButtonElement>('#pg-action-confirm');
const connectionKind = required<HTMLSelectElement>('#pg-connection-kind');
const connectionStatus = required<HTMLElement>('#pg-connect-status');
const connectionLabel = required<HTMLElement>('#pg-connection-label');
const connectionDot = required<HTMLElement>('#pg-connection-dot');
const prompt = required<HTMLTextAreaElement>('#pg-prompt');
const send = required<HTMLButtonElement>('#pg-send');

let mode: Mode = 'guided';
let scenario: PlaygroundScenario = PLAYGROUND_SCENARIOS[0]!;
let activeRequest: AbortController | undefined;
let session: PlaygroundSession;
let last: PlaygroundEvidence = {};
let inspectorSection: InspectorSection = 'intent';
let pendingAction: Extract<AeliqoAppActionEvent, { readonly state: 'preview' }> | undefined;
let actionReturnFocus: HTMLElement | undefined;
let connection: 'none' | 'local' | 'webmcp' = 'none';
let modelCallCount = 0;
let localHost: LocalHostConnection | undefined;

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

function renderInspector(): void {
  const section = evidenceFor(last, inspectorSection);
  inspectorSummary.textContent = section.summary;
  inspectorContent.textContent = stringify(section.value);
}

function deepestActiveElement(): HTMLElement | undefined {
  let active = document.activeElement;
  while (active instanceof HTMLElement && active.shadowRoot?.activeElement instanceof HTMLElement) {
    active = active.shadowRoot.activeElement;
  }
  return active instanceof HTMLElement ? active : undefined;
}

function closeActionDialog(): void {
  actionDialog.close();
  const target = actionReturnFocus;
  actionReturnFocus = undefined;
  window.setTimeout(() => {
    if (!actionDialog.open && target?.isConnected === true) target.focus();
  }, 0);
}

function actionEvent(event: AeliqoAppActionEvent): void {
  if (event.state === 'preview') {
    pendingAction = event;
    actionReturnFocus = deepestActiveElement();
    actionCancel.disabled = false;
    actionCancel.textContent = 'Cancel';
    actionConfirm.disabled = false;
    actionConfirm.removeAttribute('aria-busy');
    actionStatus.textContent = 'Waiting for your confirmation.';
    actionContent.textContent = stringify({
      action: event.preview.action,
      sideEffect: event.preview.sideEffect,
      confirmation: event.preview.confirmation,
      input: event.preview.input,
    });
    actionDialog.showModal();
    return;
  }
  if (event.state === 'failed') {
    pendingAction = undefined;
    actionCancel.disabled = false;
    actionCancel.textContent = 'Close';
    actionConfirm.disabled = true;
    actionConfirm.removeAttribute('aria-busy');
    actionStatus.textContent = event.diagnostics[0]?.message ?? 'The action failed.';
    setError(actionStatus.textContent);
    return;
  }
  pendingAction = undefined;
  actionConfirm.disabled = true;
  actionConfirm.removeAttribute('aria-busy');
  actionStatus.textContent =
    event.execution.state === 'executed'
      ? 'Action completed.'
      : 'The remote result is uncertain; reconcile before retrying.';
  status.textContent = actionStatus.textContent;
  receiptState.textContent = event.execution.state;
  if (event.execution.state === 'executed') {
    closeActionDialog();
  } else {
    actionCancel.disabled = false;
    actionCancel.textContent = 'Close';
  }
}

function resetSession(): void {
  activeRequest?.abort();
  localHost?.close();
  localHost = undefined;
  session?.dispose();
  regionHost.replaceChildren();
  session = createPlaygroundSession(actionEvent, applyAgentReceipt);
  last = {};
  pendingAction = undefined;
  actionReturnFocus = undefined;
  connection = 'none';
  modelCallCount = 0;
  modelCalls.textContent = '0';
  connectionLabel.textContent = 'No agent · manual runtime';
  connectionStatus.textContent = 'No local host detected. Guided and manual modes remain available.';
  connectionDot.dataset.state = 'unavailable';
  prompt.value = '';
  prompt.disabled = true;
  send.disabled = true;
  setError();
  status.textContent = 'Session reset. Choose a scenario step.';
  viewBadge.textContent = 'Waiting for intent';
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

async function applyReceipt(intent: Intent, receipt: WebRenderReceipt): Promise<void> {
  last = { intent, receipt };
  receiptState.textContent = receipt.status;
  viewBadge.textContent = selectedView(receipt);
  if (receipt.status === 'renderer-ready') {
    status.textContent = `${intent.kind} committed through the public runtime and ${viewBadge.textContent} renderer.`;
    await syncComponentTheme(regionHost);
  } else {
    const message = receipt.diagnostics[0]?.message ?? `The request ended as ${receipt.status}.`;
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
  status.textContent = `Compiling ${intent.kind} intent…`;
  trigger?.setAttribute('aria-busy', 'true');
  try {
    const receipt = await session.render(regionHost, intent, controller.signal);
    if (activeRequest !== controller) return;
    await applyReceipt(intent, receipt);
  } catch {
    if (!controller.signal.aborted) setError('The playground request failed safely. Reset the session and try again.');
  } finally {
    trigger?.removeAttribute('aria-busy');
    if (activeRequest === controller) activeRequest = undefined;
  }
}

function setMode(next: Mode): void {
  mode = next;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  guidedPanel.hidden = mode !== 'guided';
  manualPanel.hidden = mode !== 'manual';
  connectedPanel.hidden = mode !== 'connected';
  modeLabel.textContent = mode === 'guided' ? 'Guided demo' : mode === 'manual' ? 'Manual controls' : 'Connected agent';
}

function modeFrom(value: string | undefined): Mode | undefined {
  return value === 'guided' || value === 'manual' || value === 'connected' ? value : undefined;
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

for (const item of PLAYGROUND_SCENARIOS) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  scenarioSelect.append(option);
}
scenarioSelect.value = scenario.id;
scenarioSelect.addEventListener('change', () => {
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
actionCancel.addEventListener('click', () => {
  pendingAction?.cancel();
  pendingAction = undefined;
  closeActionDialog();
});
actionConfirm.addEventListener('click', async () => {
  const action = pendingAction;
  if (action === undefined) return;
  actionCancel.disabled = true;
  actionConfirm.disabled = true;
  actionConfirm.setAttribute('aria-busy', 'true');
  actionStatus.textContent = 'Rechecking authority and executing…';
  try {
    await action.confirm();
  } catch {
    if (pendingAction !== action) return;
    action.cancel();
    pendingAction = undefined;
    actionCancel.disabled = false;
    actionCancel.textContent = 'Close';
    actionConfirm.removeAttribute('aria-busy');
    actionStatus.textContent = 'The action failed safely. Close this review and try again.';
    setError(actionStatus.textContent);
  }
});
actionDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  pendingAction?.cancel();
  pendingAction = undefined;
  closeActionDialog();
});

required<HTMLButtonElement>('#pg-connect').addEventListener('click', async () => {
  localHost?.close();
  localHost = undefined;
  connectionStatus.textContent = 'Checking capability…';
  const kind = connectionKind.value === 'webmcp' ? 'webmcp' : 'detect';
  const result = await checkConnection(kind);
  if (kind === 'webmcp' && result.state === 'available') {
    const registered = await session.connectWebMcp();
    if (registered.ok) {
      connection = 'webmcp';
      const label = `Native WebMCP registered ${registered.value.registrations} tools (experimental).`;
      connectionStatus.textContent = label;
      connectionLabel.textContent = label;
      connectionDot.dataset.state = 'connected';
    } else {
      connection = 'none';
      const label = registered.diagnostics[0]?.message ?? 'WebMCP registration failed safely.';
      connectionStatus.textContent = label;
      connectionLabel.textContent = label;
      connectionDot.dataset.state = 'unavailable';
    }
  } else {
    if (result.state === 'connected') {
      try {
        localHost = await connectLocalHost(session);
        connection = 'local';
        connectionStatus.textContent = result.label;
        connectionLabel.textContent = result.label;
        connectionDot.dataset.state = 'connected';
      } catch (cause) {
        connection = 'none';
        const label = cause instanceof Error ? cause.message : 'The local host pairing failed safely.';
        connectionStatus.textContent = label;
        connectionLabel.textContent = label;
        connectionDot.dataset.state = 'unavailable';
      }
    } else {
      connection = 'none';
      connectionStatus.textContent = result.label;
      connectionLabel.textContent = result.label;
      connectionDot.dataset.state = result.state;
    }
  }
  const composerReady = connection === 'local' && result.state === 'connected' && result.modelConfigured;
  prompt.disabled = !composerReady;
  send.disabled = !composerReady;
});
send.addEventListener('click', async () => {
  const value = prompt.value.trim();
  if (connection !== 'local' || value.length === 0) return;
  const controller = new AbortController();
  connectionStatus.textContent = 'Waiting for the local agent proposal…';
  send.disabled = true;
  try {
    const receipt = await sendLocalPrompt(value, controller.signal);
    modelCallCount += receipt.modelRequests;
    modelCalls.textContent = String(modelCallCount);
    connectionStatus.textContent =
      receipt.stop === 'renderer-ready'
        ? `The local agent completed ${receipt.toolCalls} validated tool call${receipt.toolCalls === 1 ? '' : 's'}.`
        : receipt.stop === 'no-commit' && receipt.message !== undefined
          ? `No validated UI change was made. Agent draft: ${receipt.message}`
          : `The local agent stopped as ${receipt.stop}; no unsupported claim is shown as success.`;
  } catch {
    connectionStatus.textContent = 'The local agent request failed. No UI change was committed.';
  } finally {
    send.disabled = connection !== 'local';
  }
});

resetSession();
renderScenario();
for (const control of bootControls) control.disabled = false;
appRoot.removeAttribute('aria-busy');
void runIntent(scenario.steps[0]!.intent());
window.addEventListener(
  'pagehide',
  () => {
    activeRequest?.abort();
    localHost?.close();
    session.dispose();
  },
  { once: true },
);

export type { ScenarioId };
