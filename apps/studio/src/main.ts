import {parseExperience, createStandardFunctionRegistry, type Catalog, type Experience, type MeaningDefinition, type QuerySource} from '@aeliqo/core';
import {createMeaningAuthoring, meaningDigest} from '@aeliqo/runtime/meaning';
import {createStudioDocument, createStudioSession, type StudioArea, type StudioDocument, type StudioSession} from '@aeliqo/devtools';
import {registerAeliqoElements} from '@aeliqo/web/register';
import {catalogExample, catalogExamples, type CatalogExampleId} from '../../../examples/catalog/index.js';
import './styles.css';

registerAeliqoElements();

const functions = createStandardFunctionRegistry('studio-demo-functions');
if (!functions.ok) throw new Error(functions.diagnostics[0]!.message);
const registry = functions.value;

const baseCatalog = {
  version: '1', revision: 'studio-demo-catalog-1', functionRegistryDigest: registry.digest,
  entities: [{id: 'employees', label: 'Employees', identity: ['id'], rowGrain: ['id'], fields: [
    {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
    {id: 'name', label: 'Name', role: 'attribute', type: {value: 'text', nullable: false}},
    {id: 'amount', label: 'Amount', role: 'measure', type: {value: 'integer', nullable: false}},
  ]}], relationships: [], meanings: [], capabilities: [],
} as const satisfies Catalog;

const profile: Experience = {
  version: '1', id: 'employee-inspection', revision: '1', mode: 'adaptive', agentAllowed: false,
  allowedRepresentations: ['table', 'metric'], allowedPatterns: ['record-inspection'],
  composition: {allowWithoutPreset: true, maxNodes: 16, maxExpansions: 16}, requiredOperations: [],
  tokenProfile: {id: 'tokens.aeliqo', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable',
};

function makeCodeMeaning(): MeaningDefinition | undefined {
  const authoring = createMeaningAuthoring({catalog: baseCatalog, registry});
  if (!authoring.ok) return undefined;
  const field = authoring.value.field('employees', 'amount');
  if (!field.ok) return undefined;
  const expression = authoring.value.call({id: 'core.aggregate.sum', revision: '1'}, [field]);
  if (!expression.ok) return undefined;
  const draft = authoring.value.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', expression});
  return draft.ok ? draft.value.meaning : undefined;
}

const codeMeaning = makeCodeMeaning();
const input = {
  version: '1' as const, id: 'studio-demo', revision: 'studio-demo-1', catalog: baseCatalog,
  meanings: codeMeaning === undefined ? [] : [{version: '1' as const, meaning: codeMeaning, source: {surface: 'code' as const, ownership: 'code' as const, readOnly: true}, digest: meaningDigest(codeMeaning), assumptions: []}],
  profiles: [{label: 'Employee inspection', source: {surface: 'code' as const, ownership: 'code' as const, readOnly: true}, experience: profile}],
  activeProfile: {id: profile.id, revision: profile.revision}, tokens: {profile: {id: 'tokens.aeliqo', revision: '1'}, theme: 'light' as const},
};

const parsed = createStudioDocument(input, {registry});
if (!parsed.ok) throw new Error(parsed.diagnostics[0]!.message);
const session = createStudioSession(parsed.value, {registry});
const localSource: QuerySource = {
  revision: 'studio-local-source-1', catalogRevision: baseCatalog.revision, scopeDigest: 'studio-local', policyRevision: 'studio-local-1',
  relations: {employees: {entity: 'employees', complete: true, rows: [
    {id: 'ada', name: 'Ada', amount: 42}, {id: 'grace', name: 'Grace', amount: 37},
  ]}},
};

const rootElement = document.querySelector<HTMLDivElement>('#studio');
if (rootElement === null) throw new Error('Studio root is missing.');
const root: HTMLDivElement = rootElement;
type StudioState = ReturnType<StudioSession['getState']>;
type SavedControl = {readonly value: string; readonly checked?: boolean; readonly selectionStart?: number | null; readonly selectionEnd?: number | null};
const savedControls = new Map<string, SavedControl>();
let focusedControl: string | undefined;
let focusedSelection: {readonly start: number | null; readonly end: number | null} | undefined;
let lastEditableControl: string | undefined;
let lastEditableSelection: {readonly start: number | null; readonly end: number | null} | undefined;
let composing = false;
let deferredState: StudioState | undefined;
let previewDirection: 'ltr' | 'rtl' = 'ltr';
let previewLongLabel = false;
let galleryCleanup: (() => void) | undefined;

function controlKey(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | undefined {
  const form = control.closest('form')?.id;
  if (form !== undefined && form.length > 0 && control.name.length > 0) return `${form}:${control.name}`;
  if (control.id.length > 0) return control.id;
  return control.name.length > 0 ? control.name : undefined;
}

function captureControls(): void {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach((control) => {
    if (control instanceof HTMLInputElement && control.type === 'file') return;
    const key = controlKey(control);
    if (key === undefined) return;
    savedControls.set(key, {
      value: control.value,
      ...(control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio') ? {checked: control.checked} : {}),
      ...(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? {selectionStart: control.selectionStart, selectionEnd: control.selectionEnd} : {}),
    });
    if (document.activeElement === control) {
      focusedControl = key;
      focusedSelection = {start: control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.selectionStart : null, end: control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.selectionEnd : null};
      lastEditableControl = key;
      lastEditableSelection = focusedSelection;
    }
  });
  if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement) && lastEditableControl !== undefined) {
    focusedControl = lastEditableControl;
    focusedSelection = lastEditableSelection;
  }
}

function restoreControls(): void {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach((control) => {
    if (control instanceof HTMLInputElement && control.type === 'file') return;
    const key = controlKey(control);
    if (key === undefined) return;
    const saved = savedControls.get(key);
    if (saved === undefined) return;
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio') && saved.checked !== undefined) control.checked = saved.checked;
    else if (control instanceof HTMLSelectElement) {
      // A save can replace the active profile with a new immutable revision.
      // Preserve a saved selection only when that option still exists; an old
      // value must not clear the freshly rendered active revision.
      if (control.id !== 'profile-select' && [...control.options].some((option) => option.value === saved.value)) control.value = saved.value;
    } else control.value = saved.value;
  });
  if (focusedControl === undefined) return;
  const control = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')].find((candidate) => controlKey(candidate) === focusedControl);
  if (control === undefined) return;
  control.focus({preventScroll: true});
  if (focusedSelection !== undefined && (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && control.selectionStart !== null && focusedSelection.start !== null && focusedSelection.end !== null) {
    control.setSelectionRange(focusedSelection.start, focusedSelection.end);
  }
}

root.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) || (target instanceof HTMLInputElement && target.type === 'file')) return;
  const key = controlKey(target);
  if (key === undefined) return;
  lastEditableControl = key;
  lastEditableSelection = {start: target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionStart : null, end: target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionEnd : null};
});
root.addEventListener('compositionstart', () => { composing = true; });
root.addEventListener('compositionend', () => {
  composing = false;
  if (deferredState !== undefined) {
    const next = deferredState;
    deferredState = undefined;
    render(next);
  }
});

const areaLabels: Readonly<Record<StudioArea, string>> = {
  'data-meaning': 'Data & Meaning', experience: 'Experience', gallery: 'Component Gallery', inspect: 'Inspect',
};

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function diagnosticText(sessionValue: ReturnType<StudioSession['getState']>): string {
  return sessionValue.diagnostics.length === 0 ? '' : sessionValue.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(' ');
}

function diagnosticPanel(state: StudioState): string {
  if (state.diagnostics.length === 0) return '';
  return `<section class="diagnostic-panel" role="alert" aria-labelledby="diagnostics-title"><strong id="diagnostics-title">Needs attention</strong><p>${state.diagnostics.map((diagnostic) => `${esc(diagnostic.code)}: ${esc(diagnostic.message)}`).join('<br />')}</p><small>Your current document is still active. Correct the input and try again.</small></section>`;
}

function renderDataMeaning(state: ReturnType<StudioSession['getState']>): string {
  const catalog = state.document.catalog;
  const entity = catalog.entities[0];
  const drafts = state.document.meanings;
  const firstMeaning = drafts[0]?.meaning ?? catalog.meanings[0];
  const evaluation = firstMeaning === undefined || entity === undefined ? undefined : session.evaluateMeaning({meaning: {id: firstMeaning.id, revision: firstMeaning.revision}, entity: entity.id, source: localSource});
  const evaluationCopy = evaluation?.ok ? JSON.stringify(evaluation.value.rows) : undefined;
  const evaluationError = evaluation !== undefined && !evaluation.ok ? evaluation.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(' ') : undefined;
  return `<section class="workspace-section" aria-labelledby="data-title">
    <div class="section-heading"><div><p class="eyebrow">Source capabilities</p><h2 id="data-title">Data &amp; Meaning</h2><p class="lede">Reuse the application catalog and author a bounded meaning locally.</p></div><span class="badge">${esc(catalog.revision)}</span></div>
    <div class="split-grid"><div class="panel"><h3>Catalog fields</h3><p class="muted">${esc(entity?.label ?? 'No entity')} · identity and type come from the host catalog.</p><div class="field-list">${(entity?.fields ?? []).map((field) => `<div class="field-row"><span><strong>${esc(field.label)}</strong><small>${esc(field.id)}</small></span><code>${esc(field.type.value)}</code></div>`).join('')}</div></div>
      <div class="panel"><h3>Meaning drafts</h3><p class="muted">Code-owned entries stay read-only. Studio drafts receive their own source and revision.</p><div class="meaning-list">${drafts.length === 0 ? '<p class="empty-copy">No local drafts yet.</p>' : drafts.map((draft) => `<button class="meaning-item" data-meaning="${esc(draft.meaning.id)}@${esc(draft.meaning.revision)}"><span><strong>${esc(draft.meaning.label)}</strong><small>${esc(draft.source.ownership)} · ${esc(draft.meaning.revision)}</small></span><span class="badge ${draft.source.ownership === 'code' ? 'badge-neutral' : 'badge-accent'}">${draft.source.ownership === 'code' ? 'read-only' : 'draft'}</span></button>`).join('')}</div></div></div>
    <div class="panel evaluation-panel"><div><h3>Local evaluation</h3><p class="muted">The bounded source above is evaluated by the same typed planner used by runtime tasks.</p></div>${evaluationCopy === undefined ? `<p class="empty-copy">${esc(evaluationError ?? 'Create a meaning draft to preview a local result.')}</p>` : `<output aria-label="Local evaluation result"><code>${esc(evaluationCopy)}</code></output>`}</div>
    <form class="panel author-form" id="meaning-form"><div><h3>Define a local meaning</h3><p class="muted">This uses the typed field reference and canonical evaluator; no model or provider is needed.</p></div><label>Meaning ID<input name="id" value="employees.average" required pattern="[A-Za-z0-9._-]+" /></label><label>Label<input name="label" value="Average amount" required /></label><label>Description<textarea name="description" required>Average amount per employee.</textarea></label><input type="hidden" name="entity" value="employees" /><label>Field<select name="field"><option value="amount">amount · integer</option></select></label><button class="primary" type="submit">Create local draft</button></form>
  </section>`;
}

function renderExperience(state: ReturnType<StudioSession['getState']>): string {
  const active = state.document.profiles.find((entry) => entry.experience.id === state.document.activeProfile.id && entry.experience.revision === state.document.activeProfile.revision) ?? state.document.profiles[0]!;
  const previewWidths = [320, 360, 768, 1280] as const;
  return `<section class="workspace-section" aria-labelledby="experience-title"><div class="section-heading"><div><p class="eyebrow">Bounded design choices</p><h2 id="experience-title">Experience</h2><p class="lede">Preview approved patterns across size and data states.</p></div><span class="badge">${esc(active.experience.mode)}</span></div>
    <div class="panel experience-controls"><label>Profile<select id="profile-select">${state.document.profiles.map((entry) => `<option value="${esc(entry.experience.id)}@${esc(entry.experience.revision)}" ${entry.experience.id === active.experience.id && entry.experience.revision === active.experience.revision ? 'selected' : ''}>${esc(entry.label)}</option>`).join('')}</select></label><div class="segmented" role="group" aria-label="Theme"><button data-theme="light" class="${state.document.tokens.theme === 'light' ? 'selected' : ''}">Light</button><button data-theme="dark" class="${state.document.tokens.theme === 'dark' ? 'selected' : ''}">Dark</button></div><label>Direction<select id="preview-direction"><option value="ltr" ${previewDirection === 'ltr' ? 'selected' : ''}>LTR</option><option value="rtl" ${previewDirection === 'rtl' ? 'selected' : ''}>RTL</option></select></label><label class="checkbox-label"><input id="preview-long-label" aria-label="Use long preview text" type="checkbox" ${previewLongLabel ? 'checked' : ''} /> Long preview text</label></div>
    <form class="panel experience-edit" id="experience-edit-form"><div><h3>Edit a validated profile</h3><p class="muted">Changes create a new personal revision and leave code-owned profiles intact.</p></div><label>Label<input name="profile-label" value="${esc(active.label)}" required /></label><label>Revision<input name="profile-revision" value="${esc(`${active.experience.revision}-studio`)}" required /></label><label>Mode<select name="profile-mode"><option value="fixed" ${active.experience.mode === 'fixed' ? 'selected' : ''}>fixed</option><option value="adaptive" ${active.experience.mode === 'adaptive' ? 'selected' : ''}>adaptive</option><option value="composable" ${active.experience.mode === 'composable' ? 'selected' : ''}>composable</option></select></label><button class="primary" type="submit">Save profile revision</button></form>
    <p id="preview-scroll-help" class="muted">Each preview retains its stated width. Focus a preview and use the left and right arrow keys to inspect it horizontally.</p><div class="matrix" aria-label="Preview matrix">${previewWidths.map((width) => `<article class="matrix-cell" data-preview-width="${width}"><div class="matrix-label"><strong>${width}px</strong><span>${state.previewState}</span></div><div class="preview-viewport" tabindex="0" role="region" aria-label="${width}px preview" aria-describedby="preview-scroll-help" dir="${previewDirection}"><div class="preview-frame" data-preview-frame="${width}" dir="${previewDirection}" style="width: ${width}px"><aeliqo-metric data-preview-metric="${width}"></aeliqo-metric></div></div></article>`).join('')}</div>
    <div class="panel state-panel"><h3>Data states</h3><div class="state-buttons" role="group" aria-label="Preview data state">${(['ready', 'loading', 'empty', 'partial', 'stale', 'error'] as const).map((value) => `<button data-preview="${value}" class="${state.previewState === value ? 'selected' : ''}">${value}</button>`).join('')}</div><p class="muted">State previews are local and do not claim provider or model execution.</p></div>
  </section>`;
}

function renderGallery(state: StudioState): string {
  const selected = (state.selectedComponent ?? 'metric') as CatalogExampleId;
  const definition = catalogExamples.find((entry) => entry.id === selected) ?? catalogExamples[0]!;
  return `<section class="workspace-section" aria-labelledby="gallery-title"><div class="section-heading"><div><p class="eyebrow">Actual shared elements</p><h2 id="gallery-title">Component Gallery</h2><p class="lede">Choose one of the 71 executable catalog examples. Each preview mounts the same registered web component shipped to consumers.</p></div><span class="badge">OSS · local</span></div><div class="panel gallery-controls"><label>Component<select id="gallery-component-select">${catalogExamples.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === definition.id ? 'selected' : ''}>${esc(entry.name)}</option>`).join('')}</select></label><p id="gallery-component-description" class="muted">${esc(definition.description)}</p></div><article class="panel gallery-card gallery-selected"><div class="gallery-selected-heading"><div><h3>${esc(definition.name)}</h3><p class="muted">${esc(definition.fixture)}</p></div><code data-gallery-component="${esc(definition.id)}">${esc(definition.id)}</code></div><div id="gallery-preview" data-gallery-preview="${esc(definition.id)}"></div></article></section>`;
}

function renderInspect(state: ReturnType<StudioSession['getState']>): string {
  const inspection = session.inspect();
  const exported = session.exportDocument();
  return `<section class="workspace-section" aria-labelledby="inspect-title"><div class="section-heading"><div><p class="eyebrow">Evidence and source</p><h2 id="inspect-title">Inspect</h2><p class="lede">See the exact local revisions behind this preview.</p></div><span class="badge ${inspection.sourceOfTruth === 'application-bundle' ? 'badge-neutral' : 'badge-accent'}">${inspection.sourceOfTruth === 'application-bundle' ? 'application bundle' : 'studio draft'}</span></div><div class="inspect-grid"><div class="panel"><h3>Decision</h3><dl class="inspect-list"><div><dt>Catalog</dt><dd>${esc(inspection.catalogRevision)}</dd></div><div><dt>Function registry</dt><dd>${esc(inspection.registryDigest)}</dd></div><div><dt>Active profile</dt><dd>${esc(inspection.activeProfile.id)}@${esc(inspection.activeProfile.revision)}</dd></div><div><dt>Meaning entries</dt><dd>${inspection.meaningCount}</dd></div><div><dt>Code-owned</dt><dd>${inspection.codeOwnedCount}</dd></div><div><dt>Studio-owned</dt><dd>${inspection.studioOwnedCount}</dd></div></dl></div><div class="panel"><h3>Versioned export</h3><p class="muted">Safe to review or save. Credentials and raw rows are not part of the document.</p><pre class="export-preview">${exported.ok ? esc(exported.value) : esc(diagnosticText(state))}</pre></div></div></section>`;
}

function render(state: ReturnType<StudioSession['getState']>): void {
  if (composing) {
    deferredState = state;
    return;
  }
  captureControls();
  const activeLabel = areaLabels[state.area];
  if (state.area !== 'gallery') { galleryCleanup?.(); galleryCleanup = undefined; }
  root.innerHTML = `<header class="app-header"><a class="brand" href="/" aria-label="Aeliqo home"><img class="brand-mark" src="/aeliqo.png" alt="" /><span>Aeliqo <b>Studio</b></span></a><div class="header-actions"><span class="local-indicator"><i></i>Local workspace</span><button id="import-button" class="quiet">Import</button><input id="import-file" type="file" accept="application/json,.json" hidden /><button id="export-button" class="primary">Export document</button><button id="export-code-button" class="quiet">Export code</button></div></header><div class="app-shell"><aside class="sidebar" aria-label="Studio areas"><p class="sidebar-label">Workspace</p><nav>${(Object.keys(areaLabels) as StudioArea[]).map((area) => `<button class="nav-item ${area === state.area ? 'active' : ''}" data-area="${area}" aria-current="${area === state.area ? 'page' : 'false'}"><span class="nav-icon">${area === 'data-meaning' ? '◇' : area === 'experience' ? '◈' : area === 'gallery' ? '▦' : '⌁'}</span>${areaLabels[area]}</button>`).join('')}</nav><div class="sidebar-footer"><p>Document</p><code>${esc(state.document.id)}@${esc(state.document.revision)}</code><span>${state.dirty ? 'Unsaved local changes' : 'Saved snapshot'}</span></div></aside><main class="main-content"><div class="content-topline"><span>Local authoring</span><span>·</span><strong>${activeLabel}</strong></div>${diagnosticPanel(state)}<div id="announcement" class="sr-only" role="status" aria-live="polite">${esc(diagnosticText(state))}</div>${state.area === 'data-meaning' ? renderDataMeaning(state) : state.area === 'experience' ? renderExperience(state) : state.area === 'gallery' ? renderGallery(state) : renderInspect(state)}</main></div>`;
  bindEvents();
  if (state.area === 'experience') bindExperiencePreview(state);
  if (state.area === 'gallery') bindGallery(state);
  void syncPreviewTheme(root, state.document.tokens.theme);
  restoreControls();
}

async function syncPreviewTheme(container: Element | ShadowRoot, theme: string): Promise<void> {
  for (const element of container.querySelectorAll<HTMLElement>("*")) {
    if (!element.localName.startsWith("aeliqo-")) continue;
    element.setAttribute("data-aeliqo-theme", theme);
    await (element as HTMLElement & {updateComplete?: Promise<unknown>}).updateComplete;
    if (element.shadowRoot) await syncPreviewTheme(element.shadowRoot, theme);
  }
}

function bindExperiencePreview(state: StudioState): void {
  const entity = state.document.catalog.entities[0];
  const meaning = state.document.meanings[0]?.meaning ?? state.document.catalog.meanings[0];
  const evaluation = entity === undefined || meaning === undefined ? undefined : session.evaluateMeaning({meaning: {id: meaning.id, revision: meaning.revision}, entity: entity.id, source: localSource});
  const evaluatedValue = evaluation?.ok ? evaluation.value.rows[0]?.[meaning?.id ?? ''] : undefined;
  const value = state.previewState === 'loading' || state.previewState === 'empty' || state.previewState === 'error' ? undefined : evaluatedValue;
  const scope = {kind: 'filtered', loaded: localSource.relations.employees?.rows.length ?? 0, filteredTotal: localSource.relations.employees?.rows.length ?? 0, populationDigest: localSource.scopeDigest, label: 'Authorized employees'};
  root.querySelectorAll<HTMLElement>('[data-preview-metric]').forEach((metric) => Object.assign(metric, {
    label: previewLongLabel ? `${meaning?.label ?? 'Local result'} from the authorized employee population` : meaning?.label ?? 'Local result',
    value,
    description: evaluation?.ok ? 'Evaluated from the bounded local source.' : 'Local evaluation unavailable.',
    status: state.previewState,
    message: state.previewState === 'stale' ? 'Showing the last authorized value.' : undefined,
    unit: undefined, scope, format: 'number',
  }));
}

function bindGallery(state: StudioState): void {
  const selected = (state.selectedComponent ?? 'metric') as CatalogExampleId;
  const container = document.querySelector<HTMLElement>('#gallery-preview');
  if (container === null) return;
  galleryCleanup?.();
  galleryCleanup = catalogExample(selected, container);
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-area]').forEach((button) => button.addEventListener('click', () => session.selectArea(button.dataset.area as StudioArea)));
  root.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((button) => button.addEventListener('click', () => session.setPreviewState(button.dataset.preview as ReturnType<StudioSession['getState']>['previewState'])));
  root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => button.addEventListener('click', () => session.setTheme(button.dataset.theme as 'light' | 'dark')));
  root.querySelector<HTMLSelectElement>('#preview-direction')?.addEventListener('change', (event) => { const select = event.currentTarget; if (!(select instanceof HTMLSelectElement)) return; previewDirection = select.value === 'rtl' ? 'rtl' : 'ltr'; render(session.getState()); });
  root.querySelector<HTMLInputElement>('#preview-long-label')?.addEventListener('change', (event) => { const checkbox = event.currentTarget; if (!(checkbox instanceof HTMLInputElement)) return; previewLongLabel = checkbox.checked; render(session.getState()); });
  root.querySelector<HTMLSelectElement>('#gallery-component-select')?.addEventListener('change', (event) => { const select = event.currentTarget; if (!(select instanceof HTMLSelectElement)) return; session.selectComponent(select.value); });
  root.querySelectorAll<HTMLButtonElement>('[data-meaning]').forEach((button) => button.addEventListener('click', () => { const [id, revision] = button.dataset.meaning!.split('@'); session.selectMeaning({id: id!, revision: revision!}); session.selectArea('inspect'); }));
  const profileSelect = root.querySelector<HTMLSelectElement>('#profile-select');
  profileSelect?.addEventListener('change', () => { const [id, revision] = profileSelect.value.split('@'); session.setActiveProfile({id: id!, revision: revision!}); });
  root.querySelector<HTMLFormElement>('#experience-edit-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const active = session.getState().document.profiles.find((entry) => entry.experience.id === session.getState().document.activeProfile.id && entry.experience.revision === session.getState().document.activeProfile.revision);
    if (active === undefined) return;
    const data = new FormData(form);
    const candidateExperience = parseExperience({...active.experience, id: active.experience.id, revision: String(data.get('profile-revision')), mode: String(data.get('profile-mode'))});
    if (!candidateExperience.ok) { session.showDiagnostics(candidateExperience.diagnostics); return; }
    const result = session.editExperience({base: {id: active.experience.id, revision: active.experience.revision}, label: String(data.get('profile-label')), experience: candidateExperience.value});
    if (!result.ok) session.showDiagnostics(result.diagnostics);
  });
  root.querySelector<HTMLFormElement>('#meaning-form')?.addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; if (!(form instanceof HTMLFormElement)) return; const data = new FormData(form); const result = session.defineMeaning({id: String(data.get('id')), label: String(data.get('label')), description: String(data.get('description')), entity: String(data.get('entity')), field: String(data.get('field'))}); if (!result.ok) session.showDiagnostics(result.diagnostics); });
  root.querySelector<HTMLButtonElement>('#export-button')?.addEventListener('click', () => { const exported = session.exportDocument(); if (!exported.ok) return; const blob = new Blob([exported.value], {type: 'application/json'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${session.getState().document.id}.aeliqo.json`; link.click(); URL.revokeObjectURL(link.href); });
  root.querySelector<HTMLButtonElement>('#export-code-button')?.addEventListener('click', () => { const exported = session.exportCode(); if (!exported.ok) return; const blob = new Blob([exported.value], {type: 'text/typescript'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${session.getState().document.id}.aeliqo.ts`; link.click(); URL.revokeObjectURL(link.href); });
  root.querySelector<HTMLButtonElement>('#import-button')?.addEventListener('click', () => root.querySelector<HTMLInputElement>('#import-file')?.click());
  root.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async (event) => { const input = event.currentTarget; if (!(input instanceof HTMLInputElement) || input.files?.[0] === undefined) return; session.importDocument(await input.files[0].text()); });
}

session.subscribe((state) => { document.documentElement.dataset.theme = state.document.tokens.theme; render(state); });
document.documentElement.dataset.theme = session.getState().document.tokens.theme;
render(session.getState());
