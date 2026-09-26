import type { Intent } from '@aeliqo/core';
import type { WebRenderReceipt } from '@aeliqo/web/app';
import { createActionReviewController } from './action-review.js';
import { createConnectionFlow } from './connection-flow.js';
import { evidenceFor, selectedView, viewLabel, type InspectorSection, type PlaygroundEvidence } from './inspect.js';
import { fixtureEvidence } from './fixture-inspector.js';
import { createFixtureJourneys, FIXTURE_JOURNEYS, fixtureStatus, type FixtureJourney } from './fixture-journeys.js';
import { createJourneyTracker, journeyStagesFor } from './journey.js';
import { jakartaPeopleIntent, PLAYGROUND_SCENARIOS, type PlaygroundScenario } from './scenarios.js';
import { findScenario, labelIntent, renderScenarioControls } from './scenario-controls.js';
import { createPlaygroundSession, type PlaygroundSession } from './session.js';

type Mode = 'without-ai' | 'connected';
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
const committedFilter = required<HTMLElement>('#pg-committed-filter');
const error = required<HTMLElement>('#pg-error');
const viewBadge = required<HTMLElement>('#pg-view-badge');
const resultTitle = required<HTMLElement>('#pg-result-title');
const receiptState = required<HTMLElement>('#pg-receipt-state');
const modelCalls = required<HTMLElement>('#pg-model-calls');
const journeyIntent = required<HTMLElement>('#pg-journey-intent');
const journeyResult = required<HTMLElement>('#pg-journey-result');
const journeyView = required<HTMLElement>('#pg-journey-view');
const setJourney = createJourneyTracker(document.querySelectorAll<HTMLElement>('.pg-journey li'), viewBadge).set;
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
const exportButton = required<HTMLButtonElement>('#pg-export');
const exportNote = required<HTMLElement>('#pg-export-note');
const attendancePanel = required<HTMLElement>('#pg-attendance-journey');
const workspacePanel = required<HTMLElement>('#pg-workspace-journey');
const modeButtons = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
const inspectorButtons = document.querySelectorAll<HTMLButtonElement>('[data-inspector]');
const FIXTURE_PANELS: Readonly<Record<FixtureJourney, HTMLElement>> = {
  attendance: attendancePanel,
  workspace: workspacePanel,
};

const requestedScenario = new URLSearchParams(window.location.search).get('scenario') ?? '';
let mode: Mode = 'without-ai';
let scenario: PlaygroundScenario = findScenario(requestedScenario);
let activeRequest: AbortController | undefined;
let session: PlaygroundSession;
let last: PlaygroundEvidence = {};
let inspectorSection: InspectorSection = 'intent';
let activeJourney: 'standard' | FixtureJourney = 'standard';

const connectionFlow = createConnectionFlow(
  {
    kind: connectionKind,
    status: connectionStatus,
    label: connectionLabel,
    dot: connectionDot,
    prompt,
    send,
    modelCalls,
  },
  () => session,
);

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

function setExportAvailability(publicJourney: boolean): void {
  const published = typeof __AELIQO_EXPORT_AVAILABLE__ !== 'undefined' && __AELIQO_EXPORT_AVAILABLE__;
  exportButton.disabled = !published || publicJourney;
  exportNote.hidden = published && !publicJourney;
  if (exportNote.hidden) {
    exportButton.removeAttribute('aria-describedby');
    return;
  }
  exportButton.setAttribute('aria-describedby', 'pg-export-note');
  if (!published) return;
  const link = document.createElement('a');
  link.href = '/examples/';
  link.textContent = 'Run the matching 0.5 source fixture';
  exportNote.replaceChildren('This journey has no matching project ZIP. ', link, ' instead.');
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

function renderInspector(): void {
  if (activeJourney !== 'standard') {
    const panel = FIXTURE_PANELS[activeJourney];
    const evidence = fixtureEvidence(
      activeJourney,
      inspectorSection,
      panel,
      journeyIntent.textContent ?? '',
      journeyView.textContent ?? '',
    );
    inspectorSummary.textContent = evidence.summary;
    inspectorContent.textContent = stringify(evidence.value);
    return;
  }
  const section = evidenceFor(last, inspectorSection);
  inspectorSummary.textContent = section.summary;
  inspectorContent.textContent = stringify(section.value);
}

function resetSession(): void {
  activeRequest?.abort();
  session?.dispose();
  regionHost.replaceChildren();
  session = createPlaygroundSession(actionReview.handle, applyAgentReceipt);
  last = {};
  actionReview.reset();
  connectionFlow.reset();
  showStandardJourney();
  setExportAvailability(false);
  prompt.value = '';
  setError();
  status.textContent = 'Session reset. Choose a task.';
  journeyIntent.textContent = 'Choose a task';
  journeyResult.textContent = 'Waiting';
  journeyView.textContent = 'Waiting';
  setJourney('pending', 'pending', 'pending');
  viewBadge.textContent = 'Waiting for intent';
  resultTitle.textContent = 'Employees';
  resultDefinition.hidden = true;
  resultDefinition.textContent = '';
  committedFilter.hidden = true;
  committedFilter.textContent = '';
  receiptState.textContent = 'None';
  renderInspector();
}

function renderScenario(): void {
  renderScenarioControls(scenario, scenarioDescription, stepsHost, manualStep, runIntent);
}

function showStandardJourney(): void {
  fixtureJourneys.hide();
  activeJourney = 'standard';
  regionHost.hidden = false;
}

function showFixtureJourney(kind: FixtureJourney): void {
  activeRequest?.abort();
  connectionFlow.disconnect();
  connectionFlow.show('No agent · synthetic journey', 'disconnected');
  setMode('without-ai');
  activeJourney = kind;
  setExportAvailability(true);
  regionHost.hidden = true;
  committedFilter.hidden = true;
  setError();
  const spec = FIXTURE_JOURNEYS[kind];
  journeyIntent.textContent = spec.intentLabel;
  journeyResult.textContent = 'Evaluating…';
  journeyView.textContent = 'Waiting';
  setJourney('done', 'active', 'pending');
  resultTitle.textContent = spec.title;
  resultDefinition.hidden = false;
  resultDefinition.textContent = spec.definition;
  status.textContent = 'Evaluating the registered synthetic journey…';
  void fixtureJourneys.show(kind);
  renderInspector();
}

const fixtureJourneys = createFixtureJourneys({
  attendancePanel,
  workspacePanel,
  onStatus(kind, receipt) {
    const state = fixtureStatus(kind, receipt, resultTitle.textContent ?? 'Journey');
    receiptState.textContent = state.receipt;
    journeyResult.textContent = state.result;
    journeyView.textContent = state.view;
    viewBadge.textContent = state.view;
    status.textContent = state.status;
    setJourney(...journeyStagesFor(state.receipt));
  },
  onError() {
    setError('The synthetic journey could not load. Reload the page to retry.');
    journeyResult.textContent = 'Could not complete';
    setJourney('done', 'failed', 'pending');
  },
});

async function applyReceipt(intent: Intent, receipt: WebRenderReceipt): Promise<void> {
  last = { intent, receipt };
  receiptState.textContent = receipt.status;
  viewBadge.textContent = selectedView(receipt);
  journeyIntent.textContent = labelIntent(scenario, intent);
  const activeStep = scenario.steps.find((step) => step.id === intent.id);
  resultTitle.textContent = activeStep?.label ?? `${scenario.label} result`;
  resultDefinition.textContent = activeStep?.definition ?? '';
  resultDefinition.hidden = activeStep?.definition === undefined;
  switch (receipt.status) {
    case 'renderer-ready':
      applyReadyReceipt(intent, receipt);
      break;
    default:
      applyFailedReceipt(receipt);
  }
  renderInspector();
}

function applyReadyReceipt(intent: Intent, receipt: WebRenderReceipt): void {
  committedFilter.hidden = intent.id !== 'people-jakarta';
  committedFilter.textContent =
    intent.id === 'people-jakarta' ? 'Committed filter · Location: Jakarta · Scope: synthetic People' : '';
  journeyResult.textContent = 'Evaluated';
  journeyView.textContent = viewLabel(selectedView(receipt));
  setJourney('done', 'done', 'done');
  status.textContent = `${resultTitle.textContent} is ready. Open Inspect to see the request, result, and view choice.`;
}

function applyFailedReceipt(receipt: WebRenderReceipt): void {
  const message = receipt.diagnostics[0]?.message ?? `The request ended as ${receipt.status}.`;
  journeyResult.textContent = 'Could not complete';
  journeyView.textContent = 'No new view';
  setJourney('done', 'failed', 'pending');
  status.textContent = message;
  setError(message);
}

async function applyAgentReceipt(intent: Intent, receipt: WebRenderReceipt): Promise<void> {
  setError();
  await applyReceipt(intent, receipt);
}

async function runIntent(intent: Intent, trigger?: HTMLButtonElement, publicJourney = false): Promise<void> {
  showStandardJourney();
  setExportAvailability(publicJourney);
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  setError();
  journeyIntent.textContent = labelIntent(scenario, intent);
  journeyResult.textContent = 'Checking…';
  journeyView.textContent = 'Waiting';
  setJourney('done', 'active', 'pending');
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
      setJourney('done', 'failed', 'pending');
      setError('The playground request failed safely. Reset the session and try again.');
    }
  } finally {
    trigger?.removeAttribute('aria-busy');
    if (activeRequest === controller) activeRequest = undefined;
  }
}

function setMode(next: Mode): void {
  mode = next;
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  guidedPanel.hidden = mode !== 'without-ai';
  manualPanel.hidden = mode !== 'without-ai';
  connectedPanel.hidden = mode !== 'connected';
  modeLabel.textContent = modeLabels[mode];
}

const MODES = ['without-ai', 'connected'] as const satisfies readonly Mode[];
const INSPECTOR_SECTIONS = [
  'intent',
  'task',
  'result',
  'presentation',
  'diagnostics',
] as const satisfies readonly InspectorSection[];

function modeFrom(value: string | undefined): Mode | undefined {
  return MODES.find((candidate) => candidate === value);
}

function inspectorFrom(value: string | undefined): InspectorSection | undefined {
  return INSPECTOR_SECTIONS.find((candidate) => candidate === value);
}

function isFixtureJourney(value: string | undefined): value is FixtureJourney {
  return value === 'attendance' || value === 'workspace';
}

for (const item of PLAYGROUND_SCENARIOS) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  scenarioSelect.append(option);
}
scenarioSelect.value = scenario.id;
scenarioSelect.addEventListener('change', () => {
  scenario = findScenario(scenarioSelect.value);
  const url = new URL(window.location.href);
  url.searchParams.set('scenario', scenario.id);
  window.history.replaceState(null, '', url);
  renderScenario();
  void runIntent(scenario.steps[0]!.intent());
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-journey]'))
  button.addEventListener('click', () => {
    if (button.dataset.journey === 'jakarta') {
      scenario = findScenario('people');
      scenarioSelect.value = 'people';
      renderScenario();
      void runIntent(jakartaPeopleIntent(), undefined, true);
      return;
    }
    if (isFixtureJourney(button.dataset.journey)) showFixtureJourney(button.dataset.journey);
  });
for (const button of modeButtons)
  button.addEventListener('click', () => {
    const next = modeFrom(button.dataset.mode);
    if (next !== undefined) setMode(next);
  });
required<HTMLButtonElement>('#pg-run-manual').addEventListener('click', () => {
  const step = scenario.steps.find((candidate) => candidate.id === manualStep.value) ?? scenario.steps[0]!;
  void runIntent(step.intent());
});
required<HTMLButtonElement>('#pg-reset').addEventListener('click', () => resetSession());
exportButton.addEventListener('click', async () => {
  const [{ projectFiles }, { zipProject }] = await Promise.all([import('./project-template.js'), import('./zip.js')]);
  const blob = zipProject(projectFiles(scenario.id, __AELIQO_RELEASE_VERSION__));
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `aeliqo-${scenario.id}-example.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
  status.textContent = `Exported the ${scenario.label} source project with synthetic data and no credentials. Install after its pinned package version is published.`;
});
required<HTMLButtonElement>('#pg-inspect').addEventListener('click', () => {
  renderInspector();
  inspector.showModal();
});
required<HTMLButtonElement>('#pg-inspector-close').addEventListener('click', () => inspector.close());
for (const button of inspectorButtons)
  button.addEventListener('click', () => {
    const next = inspectorFrom(button.dataset.inspector);
    if (next === undefined) return;
    inspectorSection = next;
    for (const candidate of inspectorButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
    renderInspector();
  });
required<HTMLButtonElement>('#pg-connect').addEventListener('click', () => void connectionFlow.connect());
connectionKind.addEventListener('change', () => connectionFlow.changeKind());
send.addEventListener('click', () => void connectionFlow.submitPrompt());

resetSession();
renderScenario();
for (const control of bootControls) control.disabled = false;
setExportAvailability(false);
bootState.hidden = true;
appRoot.removeAttribute('aria-busy');
void runIntent(scenario.steps[0]!.intent());
window.addEventListener('pagehide', () => {
  activeRequest?.abort();
  connectionFlow.close();
  session.dispose();
});
