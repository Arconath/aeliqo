import {registerAeliqoElements} from '@aeliqo/web';
import {detectWebMcp} from '@aeliqo/agent/webmcp';
import {AeliqoRegionElement} from '@aeliqo/web/region';
import {AeliqoComparisonElement} from '@aeliqo/web/comparison';
import {AeliqoDetailElement} from '@aeliqo/web/detail';
import {AeliqoTextFieldElement} from '@aeliqo/web/text-field';
import {
  createDemoEngine,
  type DemoDataset,
  type DemoOutput,
  type DemoPresentation,
  type DemoTaskChoice,
  type DemoView,
} from './playground-engine.js';
import type {Diagnostic, Outcome, Task} from '@aeliqo/core';
import {syncComponentTheme} from './site.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw Error(`Missing playground control ${id}`);
  return node as T;
};

for (const [name, ctor] of [
  ['aeliqo-region', AeliqoRegionElement],
  ['aeliqo-comparison', AeliqoComparisonElement],
  ['aeliqo-detail', AeliqoDetailElement],
  ['aeliqo-text-field', AeliqoTextFieldElement],
] as const) {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
registerAeliqoElements();

const draft = $<HTMLTextAreaElement>('task-draft');
const view = $<HTMLSelectElement>('result-view');
const team = $<HTMLSelectElement>('play-team');
const dataset = $<HTMLSelectElement>('dataset');
const taskChoice = $<HTMLSelectElement>('task-choice');
const contributor = $<HTMLSelectElement>('contributor');
const cancel = $<HTMLButtonElement>('cancel');
const activities: {stage: string; message: string}[] = [];
let engine = createDemoEngine();
let outputs: readonly DemoOutput[] = [];
let presentations: readonly DemoPresentation[] = [];
let presentedLeases: ReturnType<DemoOutput['handle']['retain']>[] = [];
let accepted: Task | undefined;
let generation = 0;
let dirty = false;
let productFormDirty = false;
let workflowStep = 0;
let workflowLabel = 'Browse people';

const recovery: Readonly<Record<string, string>> = {
  'demo.needs-meaning': 'Next: run “Define absence days”, then retry.',
  'demo.needs-cohort': 'Next: browse people, freeze the displayed collection, then retry.',
  'demo.cohort-grain': 'Next: browse or rank people before freezing a cohort.',
  'demo.unsupported-view': 'Next: choose Exact table, or run the matching rank/trend task first.',
  'demo.stale': 'Next: run the selected task again to refresh it.',
  'demo.stale-result': 'Next: run the selected task again to rematerialize its rows.',
  'demo.cancelled': 'The previous authorized view remains available; run the task when ready.',
};

function activity(stage: string, message: string) {
  activities.push({stage, message});
  if (activities.length > 40) activities.shift();
  updateInspector();
}

function showError(message: string) {
  $('play-error').hidden = false;
  $('play-error').textContent = message;
  activity('rejected', message);
}

function showDiagnostics(diagnostics: readonly Diagnostic[]) {
  showError(diagnostics.map(item => `${item.code}: ${item.message}${recovery[item.code] ? ` ${recovery[item.code]}` : ' Review the Task in Source, correct it, and retry.'}`).join(' '));
}

function value<T>(result: Outcome<T>): T | undefined {
  if (!result.ok) {
    showDiagnostics(result.diagnostics);
    return undefined;
  }
  return result.value;
}

function inspectorValue(section: string): unknown {
  if (section === 'Task') {
    return accepted ? {status: 'accepted', task: accepted} : {status: 'No accepted Task yet'};
  }
  if (section === 'Data') {
    return outputs.map(output => ({
      outputId: output.descriptor.ref.outputId,
      revision: output.descriptor.ref.revision,
      scopeDigest: output.descriptor.ref.scopeDigest,
      queryDigest: output.descriptor.ref.queryDigest,
      grain: output.descriptor.rowGrain,
      fields: output.descriptor.fields,
      coverage: output.descriptor.coverage,
      lineage: output.descriptor.lineage,
      rowCount: output.rows.length,
    }));
  }
  if (section === 'Experience') {
    return presentations.map(item => ({
      id: item.experience.id,
      revision: item.experience.revision,
      mode: item.experience.mode,
      agentAllowed: item.experience.agentAllowed,
      allowedRepresentations: item.experience.allowedRepresentations,
      plan: item.plan,
    }));
  }
  return {budget: engine.budget, stages: activities};
}

function updateInspector() {
  const section = $<HTMLSelectElement>('inspector-tab').value;
  const summaries: Record<string, string> = {
    Task: 'Accepted typed Task and normalized query. Approval does not prove business intent.',
    Data: 'Exact result revision, authorized scope, grain, coverage, row count, and lineage. Raw rows stay in Source.',
    Experience: 'Committed Experience and Presentation plan. Changing a view does not call a model.',
    Activity: 'Bounded local stages, rejected candidates, and evaluation budget. No private chain-of-thought.',
  };
  $('inspector-summary').textContent = summaries[section] ?? '';
  $('inspector-content').textContent = JSON.stringify(inspectorValue(section), null, 2);
}

function renderSource() {
  const selected = dataset.value as DemoDataset;
  const snapshot = engine.sourceSnapshot(selected);
  $('source-description').textContent = `${snapshot.label} · ${snapshot.sourceRevision} · ${snapshot.scopeDigest} · synthetic records supplied by this page.`;
  $('source-content').textContent = JSON.stringify(snapshot, null, 2);
}

function setWorkflowStep(step: number, label: string) {
  if (step >= workflowStep) {
    workflowStep = step;
    workflowLabel = label;
  }
  const shown = Math.min(4, Math.max(1, workflowStep || 1));
  $<HTMLProgressElement>('workflow-meter').value = workflowStep;
  $('workflow-progress').textContent = `Step ${shown} of 4 · ${workflowLabel}`;
}

function currentView(): DemoView {
  return presentations[0]?.plan.nodes.some(node => node.representation.id === 'visualization.bar') ? 'bar'
    : presentations[0]?.plan.nodes.some(node => node.representation.id === 'visualization.trend') ? 'trend'
      : 'table';
}

function present(next: readonly DemoOutput[], requested: DemoView): boolean {
  const prepared: DemoPresentation[] = [];
  for (const output of next) {
    const checked = value(engine.present(output, requested));
    if (!checked) return false;
    prepared.push(checked);
  }
  const nodes = next.map((output, index) => {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = output.descriptor.ref.outputId === 'main' ? 'Evaluated output'
      : output.descriptor.ref.outputId === 'first-half' ? '3–16 August 2026'
        : output.descriptor.ref.outputId === 'second-half' ? '17–30 August 2026'
          : output.descriptor.ref.outputId;
    const region = new AeliqoRegionElement();
    region.presentation = prepared[index]!.validated;
    region.results = [{
      ref: output.descriptor.ref,
      rows: output.rows,
      visualizationContext: {results: [output.descriptor], catalog: engine.catalog},
    }];
    section.append(heading, region);
    return section;
  });
  const nextLeases = next.map(output => output.handle.retain());
  $('result-canvas').replaceChildren(...nodes);
  for (const lease of presentedLeases) lease.release();
  presentedLeases = nextLeases;
  outputs = next;
  presentations = prepared;
  view.value = requested;
  void syncComponentTheme($('result-canvas'));
  return true;
}

async function evaluate(task: unknown, requested: DemoView = 'table', progress?: {step: number; label: string}) {
  const token = ++generation;
  $('play-error').hidden = true;
  $('play-status').textContent = 'Evaluating locally…';
  cancel.disabled = false;
  activity('evaluate', 'Requested bounded local evaluation.');
  const result = await engine.evaluate(task);
  if (token !== generation) return;
  cancel.disabled = true;
  const next = value(result);
  if (!next) {
    $('play-status').textContent = outputs.length ? 'The previous authorized view is retained.' : 'No result was committed.';
    return;
  }
  if (!present(next, requested)) {
    $('play-status').textContent = 'The previous authorized view is retained; presentation was rejected.';
    return;
  }
  accepted = next[0]?.task;
  dirty = false;
  draft.value = JSON.stringify(accepted, null, 2);
  const rows = next.reduce((count, output) => count + output.rows.length, 0);
  $('play-status').textContent = `${next.length} complete output${next.length === 1 ? '' : 's'} · ${rows} result rows · Synthetic demo scope.`;
  $('result-title').textContent = accepted?.goal ?? 'Results';
  if (progress) setWorkflowStep(progress.step, progress.label);
  activity('commit', `Presented Task revision ${accepted?.revision}.`);
  if (dataset.value === 'products') mountCommerce(next[0]);
  updateInspector();
}

function runChoice() {
  syncContributorVisibility();
  const choice = taskChoice.value as DemoTaskChoice;
  const task = value(engine.taskFor(choice, {team: team.value, contributor: contributor.value}));
  if (!task) return;
  const progress = choice === 'people-browse' ? {step: 1, label: 'People browsed'}
    : choice === 'people-rank' ? {step: 4, label: 'Ranking explored'}
      : choice === 'people-trend' ? {step: 4, label: 'Fixed-cohort trend explored'}
        : choice === 'people-periods' ? {step: 4, label: 'Periods compared'}
          : choice === 'people-contributor' ? {step: 4, label: 'Contributor records inspected'}
            : undefined;
  const requested: DemoView = choice === 'people-rank' ? 'bar' : choice === 'people-trend' ? 'trend' : 'table';
  void evaluate(task, requested, progress);
}

$('run-task').addEventListener('click', runChoice);
$('browse-people').addEventListener('click', () => {
  taskChoice.value = 'people-browse';
  runChoice();
});
team.addEventListener('change', () => {
  taskChoice.value = 'people-browse';
  runChoice();
});
$('define-meaning').addEventListener('click', () => {
  if (!value(engine.defineAbsenceMeaning())) return;
  activity('meaning', 'Activated built-in sum of supplied absence days, revision 1. No rate or employee-count inference.');
  $('cohort-status').textContent = 'Meaning ready. Browse and freeze an employee collection for a fixed-cohort trend.';
  setWorkflowStep(2, 'Absence-days meaning defined');
  taskChoice.value = 'people-browse';
  runChoice();
});
$('rank').addEventListener('click', () => {
  taskChoice.value = 'people-rank';
  runChoice();
});
$('freeze').addEventListener('click', async () => {
  const selected = outputs[0];
  if (!selected) {
    showError('demo.needs-result: Browse an employee collection before freezing it. Next: run “Browse people”.');
    return;
  }
  const fixed = value(await engine.freezeCohort(selected, 'People frozen from the displayed result'));
  if (!fixed) return;
  $('cohort-status').textContent = `Fixed cohort: ${fixed.members} people · source revision ${fixed.source.revision}. Later filters do not change these identities.`;
  setWorkflowStep(3, 'Current people frozen');
  activity('cohort', `Froze ${fixed.members} stable employee identities.`);
});
$('trend').addEventListener('click', () => {
  taskChoice.value = 'people-trend';
  runChoice();
});
$('compare-periods').addEventListener('click', () => {
  taskChoice.value = 'people-periods';
  runChoice();
});
$('inspect-contributor').addEventListener('click', () => {
  taskChoice.value = 'people-contributor';
  runChoice();
});

view.addEventListener('change', () => {
  if (!outputs.length) return;
  const previous = currentView();
  if (!present(outputs, view.value as DemoView)) {
    view.value = previous;
    return;
  }
  $('play-error').hidden = true;
  activity('present', `Changed to ${view.value} without a model call.`);
});

cancel.addEventListener('click', () => {
  generation++;
  engine.cancel();
  cancel.disabled = true;
  $('play-status').textContent = 'Query cancelled. The current authorized view is retained.';
  activity('cancel', 'Cancelled the pending local evaluation.');
});

draft.addEventListener('input', () => { dirty = true; });
$('evaluate-draft').addEventListener('click', () => {
  try {
    void evaluate(JSON.parse(draft.value));
  } catch {
    showError('task.invalid-json: The Task document is not valid JSON. Next: correct the highlighted text and evaluate again.');
  }
});

$('export-task').addEventListener('click', () => {
  if (!accepted) {
    showError('demo.no-export: Evaluate a Task before export. Next: run the selected Task.');
    return;
  }
  const payload = engine.createExportDocument(accepted, presentations);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aeliqo-playground.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  activity('export', 'Exported the versioned Task and Presentation without rows or credentials.');
});

$('reset').addEventListener('click', () => {
  if ((dirty || productFormDirty) && !confirm('Reset the session and discard your local drafts?')) return;
  generation++;
  for (const lease of presentedLeases) lease.release();
  presentedLeases = [];
  $('result-canvas').replaceChildren();
  engine.dispose();
  engine = createDemoEngine();
  outputs = [];
  presentations = [];
  accepted = undefined;
  dirty = false;
  productFormDirty = false;
  workflowStep = 0;
  workflowLabel = 'Browse people';
  activities.length = 0;
  dataset.value = 'employees';
  team.value = 'all';
  contributor.value = 'ada';
  view.value = 'table';
  taskChoice.value = 'people-browse';
  draft.value = '';
  $('commerce-controls').replaceChildren();
  $('commerce-comparison').replaceChildren();
  $('commerce-detail').replaceChildren();
  $('commerce-form').replaceChildren();
  $('cohort-status').textContent = 'No fixed cohort yet. A fixed cohort preserves employee identities when filters change.';
  $<HTMLProgressElement>('workflow-meter').value = 0;
  $('workflow-progress').textContent = 'Step 1 of 4 · Browse people';
  syncDatasetVisibility();
  renderSource();
  activity('reset', 'Started a new ephemeral session and discarded local state.');
  runChoice();
});

let lastPanel: string | undefined;
const narrow = matchMedia('(max-width:900px)');
const panelMinWidth = 260;
const panelMaxWidth = 520;
const canvasMinWidth = 280;
const panels = [
  ['source-toggle', 'source-panel', 'source-close'],
  ['inspector-toggle', 'inspector-panel', 'inspector-close'],
] as const;
const workspace = $<HTMLElement>('playground-workspace');

function focusPanel(panel: string) {
  $(panel).querySelector<HTMLElement>('textarea,select,[tabindex="0"],button:not(.panel-resize):not(.panel-close)')?.focus();
}

function visiblePanels() {
  return panels.filter(([, panel]) => !$(panel).hidden);
}

function panelWidth(panel: string) {
  return Number($(panel).querySelector<HTMLElement>('.panel-resize')?.getAttribute('aria-valuenow')) || 320;
}

function setPanelWidth(panel: string, width: number) {
  const next = Math.max(panelMinWidth, Math.min(panelMaxWidth, Math.round(width)));
  $(panel).style.setProperty('--panel-width', `${next}px`);
  const handle = $(panel).querySelector<HTMLElement>('.panel-resize');
  handle?.setAttribute('aria-valuenow', String(next));
  handle?.setAttribute('aria-valuetext', `${next} pixels`);
}

function desktopPanelBudget() {
  const visible = visiblePanels();
  const gap = Number.parseFloat(getComputedStyle(workspace).columnGap) || 0;
  return Math.floor(workspace.clientWidth - gap * visible.length - canvasMinWidth);
}

function achievablePanelMax(panel: string) {
  const otherWidths = visiblePanels()
    .filter(([, visiblePanel]) => visiblePanel !== panel)
    .reduce((sum, [, visiblePanel]) => sum + panelWidth(visiblePanel), 0);
  return Math.max(panelMinWidth, Math.min(panelMaxWidth, desktopPanelBudget() - otherWidths));
}

function syncPanelRanges() {
  for (const [, panel] of visiblePanels()) {
    $(panel).querySelector<HTMLElement>('.panel-resize')?.setAttribute('aria-valuemax', String(achievablePanelMax(panel)));
  }
}

function fitDesktopPanels() {
  if (narrow.matches) return;
  const visible = visiblePanels();
  if (visible.length === 0 || workspace.clientWidth === 0) return;
  const budget = desktopPanelBudget();
  if (budget < panelMinWidth * visible.length) {
    const keep = visible.find(([, panel]) => panel === lastPanel) ?? visible.at(-1)!;
    const focused = document.activeElement;
    let hidFocus = false;
    for (const [toggle, panel] of visible) {
      if (panel !== keep[1]) {
        if (focused instanceof Node && $(panel).contains(focused)) hidFocus = true;
        $(panel).hidden = true;
        $(toggle).setAttribute('aria-expanded', 'false');
      }
    }
    if (hidFocus) focusPanel(keep[1]);
    syncPanelRanges();
    return;
  }
  const total = visible.reduce((sum, [, panel]) => sum + panelWidth(panel), 0);
  if (total > budget) {
    const width = Math.floor(budget / visible.length);
    for (const [, panel] of visible) setPanelWidth(panel, width);
  }
  syncPanelRanges();
}

function panelModality() {
  if (narrow.matches) {
    const visible = visiblePanels();
    if (visible.length > 1) {
      const keep = visible.find(([, panel]) => panel === lastPanel) ?? visible.at(-1)!;
      for (const [toggle, panel] of visible) {
        if (panel !== keep[1]) {
          $(panel).hidden = true;
          $(toggle).setAttribute('aria-expanded', 'false');
        }
      }
      focusPanel(keep[1]);
    }
  } else fitDesktopPanels();
  const opened = panels.find(([, panel]) => !$(panel).hidden);
  const modal = narrow.matches && opened !== undefined;
  for (const element of document.querySelectorAll<HTMLElement>('.topbar,footer,.playground-header,.playground-toolbar,.playground-main,#dataset-status')) element.inert = modal;
  for (const [, panel] of panels) {
    $(panel).setAttribute('role', modal && !$(panel).hidden ? 'dialog' : 'complementary');
    if (modal && !$(panel).hidden) $(panel).setAttribute('aria-modal', 'true');
    else $(panel).removeAttribute('aria-modal');
  }
  if (modal && opened !== undefined && !$(opened[1]).contains(document.activeElement)) focusPanel(opened[1]);
}

function closePanel(toggle: string, panel: string) {
  $(panel).hidden = true;
  $(toggle).setAttribute('aria-expanded', 'false');
  panelModality();
  $(toggle).focus();
}

for (const [toggle, panel, close] of panels) {
  $(toggle).addEventListener('click', () => {
    const opening = $(panel).hidden;
    if (opening && narrow.matches) {
      for (const [otherToggle, otherPanel] of panels) {
        if (otherPanel !== panel) {
          $(otherPanel).hidden = true;
          $(otherToggle).setAttribute('aria-expanded', 'false');
        }
      }
    }
    $(panel).hidden = !opening;
    if (opening) lastPanel = panel;
    $(toggle).setAttribute('aria-expanded', String(opening));
    panelModality();
    if (opening) focusPanel(panel);
  });
  $(close).addEventListener('click', () => closePanel(toggle, panel));
  $(panel).addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel(toggle, panel);
      return;
    }
    if (event.key !== 'Tab' || !narrow.matches) return;
    const controls = [...$(panel).querySelectorAll<HTMLElement>('button,textarea,select,[tabindex="0"]')]
      .filter(node => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
}
narrow.addEventListener('change', panelModality);
window.addEventListener('resize', panelModality);

$('inspector-tab').addEventListener('change', updateInspector);
const sourceSection = $<HTMLSelectElement>('source-section');
sourceSection.addEventListener('change', () => {
  const showingTask = sourceSection.value === 'task';
  $('source-task-view').hidden = !showingTask;
  $('source-data-view').hidden = showingTask;
  (showingTask ? draft : $('source-content')).focus();
});

for (const [id, panel, direction] of [
  ['source-resize', 'source-panel', 1],
  ['inspector-resize', 'inspector-panel', -1],
] as const) {
  const handle = $(id);
  let initial = 320;
  let start = 0;
  const resize = (width: number) => {
    setPanelWidth(panel, Math.min(width, achievablePanelMax(panel)));
    syncPanelRanges();
  };
  const physicalDirection = () => getComputedStyle(workspace).direction === 'rtl' ? -direction : direction;
  handle.addEventListener('keydown', event => {
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      resize(event.key === 'Home' ? panelMinWidth : achievablePanelMax(panel));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      resize(Number(handle.getAttribute('aria-valuenow')) + (event.key === 'ArrowRight' ? 16 : -16) * physicalDirection());
    }
  });
  handle.addEventListener('pointerdown', event => {
    initial = Number(handle.getAttribute('aria-valuenow'));
    start = event.clientX;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (handle.hasPointerCapture(event.pointerId)) resize(initial + (event.clientX - start) * physicalDirection());
  });
  const release = (event: PointerEvent) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
}

function mountCommerce(output: DemoOutput | undefined) {
  if (!output) return;
  const rows = output.rows.filter(row => typeof row.product_id === 'string');
  const controls = $('commerce-controls');
  controls.replaceChildren();
  const selects = [0, 1].map(index => {
    const label = document.createElement('label');
    label.textContent = index === 0 ? 'First product ' : 'Second product ';
    const select = document.createElement('select');
    select.setAttribute('aria-label', label.textContent.trim());
    for (const row of rows) {
      const option = document.createElement('option');
      option.value = String(row.product_id);
      option.textContent = String(row.name);
      select.append(option);
    }
    select.selectedIndex = Math.min(index, rows.length - 1);
    label.append(select);
    controls.append(label);
    return select;
  });
  function update() {
    const chosen = selects.map(select => rows.find(row => row.product_id === select.value)).filter(row => row !== undefined);
    const unique = chosen.filter((row, index) => chosen.findIndex(item => item.product_id === row.product_id) === index);
    const comparison = new AeliqoComparisonElement();
    comparison.entity = 'products';
    comparison.compareSet = unique.map(row => ({key: String(row.product_id), label: String(row.name)}));
    comparison.compareKeys = unique.map(row => String(row.product_id));
    comparison.metrics = [
      {id: 'price', label: 'Price', unit: 'USD', values: Object.fromEntries(unique.map(row => [String(row.product_id), typeof row.price === 'object' && row.price !== null && 'decimal' in row.price ? String(row.price.decimal) : 'Unknown']))},
      {id: 'stock', label: 'Stock', unit: 'items', values: Object.fromEntries(unique.map(row => [String(row.product_id), Number(row.stock)]))},
    ];
    comparison.result = output!.descriptor.ref;
    comparison.scope = {kind: 'filtered', label: 'Selected synthetic products', loaded: unique.length, filteredTotal: unique.length};
    $('commerce-comparison').replaceChildren(comparison);
    const detail = new AeliqoDetailElement();
    detail.record = chosen[0];
    detail.fields = [
      {key: 'name', label: 'Name'},
      {key: 'category', label: 'Category'},
      {key: 'price', label: 'Price (USD)'},
      {key: 'stock', label: 'Stock'},
    ];
    $('commerce-detail').replaceChildren(detail);
    $('commerce-progress').textContent = unique.length === 2 ? 'Step 2 of 3 · Comparison ready; inspect details and review a local draft' : 'Step 1 of 3 · Choose two different products';
    void syncComponentTheme($('commerce'));
  }
  selects.forEach(select => select.addEventListener('change', update));
  update();
  if (!$('commerce-form').children.length) {
    const form = document.createElement('form');
    const name = new AeliqoTextFieldElement();
    name.name = 'name';
    name.label = 'Your name';
    name.required = true;
    const note = new AeliqoTextFieldElement();
    note.name = 'note';
    note.label = 'Enquiry note';
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Review local enquiry';
    const receipt = document.createElement('p');
    receipt.setAttribute('role', 'status');
    form.append(name, note, button, receipt);
    form.addEventListener('aeliqo-input-change', () => { productFormDirty = true; });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      receipt.textContent = `Draft reviewed for ${String(new FormData(form).get('name') ?? '')}. This remains local; no enquiry was sent.`;
      $('commerce-progress').textContent = 'Step 3 of 3 · Local draft reviewed; nothing was sent';
      activity('review', 'Reviewed a local commerce enquiry draft without egress or action.');
    });
    $('commerce-form').append(form);
  }
}

function syncDatasetVisibility() {
  const commerce = dataset.value === 'products';
  for (const option of [...taskChoice.options]) {
    const matches = option.dataset.dataset === dataset.value;
    option.hidden = !matches;
    option.disabled = !matches;
  }
  if (taskChoice.selectedOptions[0]?.disabled) taskChoice.value = commerce ? 'products-browse' : 'people-browse';
  $('people-workflow').hidden = commerce;
  $('team-control').hidden = commerce;
  syncContributorVisibility();
  $('commerce').hidden = !commerce;
  $('dataset-status').textContent = commerce
    ? 'Commerce catalog · Synthetic local source · Scope: synthetic-public-records'
    : 'People & absence · Synthetic local source · Scope: synthetic-public-records';
}

function syncContributorVisibility() {
  $('contributor-control').hidden = dataset.value === 'products' || taskChoice.value !== 'people-contributor';
}

dataset.addEventListener('change', () => {
  taskChoice.value = dataset.value === 'products' ? 'products-browse' : 'people-browse';
  syncDatasetVisibility();
  renderSource();
  runChoice();
});
taskChoice.addEventListener('change', () => {
  syncContributorVisibility();
});

$('webmcp-status').textContent = detectWebMcp().supported ? 'WebMCP experimental API detected · unpaired' : 'WebMCP unavailable in this browser';
window.addEventListener('pagehide', event => {
  engine.cancel();
  if (!event.persisted) {
    for (const lease of presentedLeases) lease.release();
    presentedLeases = [];
    engine.dispose();
  }
});

syncDatasetVisibility();
renderSource();
updateInspector();
runChoice();
