import {createStandardFunctionRegistry, type Catalog, type Experience, type MeaningDefinition} from '@aeliqo/core';
import {createMeaningAuthoring, meaningDigest} from '@aeliqo/runtime/meaning';
import {createStudioDocument, createStudioSession, type StudioArea, type StudioDocument, type StudioSession} from '@aeliqo/devtools';
import {registerAeliqoElements} from '@aeliqo/web/register';
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

const rootElement = document.querySelector<HTMLDivElement>('#studio');
if (rootElement === null) throw new Error('Studio root is missing.');
const root: HTMLDivElement = rootElement;

const areaLabels: Readonly<Record<StudioArea, string>> = {
  'data-meaning': 'Data & Meaning', experience: 'Experience', gallery: 'Component Gallery', inspect: 'Inspect',
};

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function diagnosticText(sessionValue: ReturnType<StudioSession['getState']>): string {
  return sessionValue.diagnostics.length === 0 ? '' : sessionValue.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(' ');
}

function renderDataMeaning(state: ReturnType<StudioSession['getState']>): string {
  const catalog = state.document.catalog;
  const entity = catalog.entities[0];
  const drafts = state.document.meanings;
  return `<section class="workspace-section" aria-labelledby="data-title">
    <div class="section-heading"><div><p class="eyebrow">Source capabilities</p><h2 id="data-title">Data &amp; Meaning</h2><p class="lede">Reuse the application catalog and author a bounded meaning locally.</p></div><span class="badge">${esc(catalog.revision)}</span></div>
    <div class="split-grid"><div class="panel"><h3>Catalog fields</h3><p class="muted">${esc(entity?.label ?? 'No entity')} · identity and type come from the host catalog.</p><div class="field-list">${(entity?.fields ?? []).map((field) => `<div class="field-row"><span><strong>${esc(field.label)}</strong><small>${esc(field.id)}</small></span><code>${esc(field.type.value)}</code></div>`).join('')}</div></div>
      <div class="panel"><h3>Meaning drafts</h3><p class="muted">Code-owned entries stay read-only. Studio drafts receive their own source and revision.</p><div class="meaning-list">${drafts.length === 0 ? '<p class="empty-copy">No local drafts yet.</p>' : drafts.map((draft) => `<button class="meaning-item" data-meaning="${esc(draft.meaning.id)}@${esc(draft.meaning.revision)}"><span><strong>${esc(draft.meaning.label)}</strong><small>${esc(draft.source.ownership)} · ${esc(draft.meaning.revision)}</small></span><span class="badge ${draft.source.ownership === 'code' ? 'badge-neutral' : 'badge-accent'}">${draft.source.ownership === 'code' ? 'read-only' : 'draft'}</span></button>`).join('')}</div></div></div>
    <form class="panel author-form" id="meaning-form"><div><h3>Define a local meaning</h3><p class="muted">This uses the typed field reference and canonical evaluator; no model or provider is needed.</p></div><label>Meaning ID<input name="id" value="employees.average" required pattern="[A-Za-z0-9._-]+" /></label><label>Label<input name="label" value="Average amount" required /></label><label>Description<textarea name="description" required>Average amount per employee.</textarea></label><input type="hidden" name="entity" value="employees" /><label>Field<select name="field"><option value="amount">amount · integer</option></select></label><button class="primary" type="submit">Create local draft</button></form>
  </section>`;
}

function renderExperience(state: ReturnType<StudioSession['getState']>): string {
  const active = state.document.profiles.find((entry) => entry.experience.id === state.document.activeProfile.id && entry.experience.revision === state.document.activeProfile.revision) ?? state.document.profiles[0]!;
  return `<section class="workspace-section" aria-labelledby="experience-title"><div class="section-heading"><div><p class="eyebrow">Bounded design choices</p><h2 id="experience-title">Experience</h2><p class="lede">Preview approved patterns across size and data states.</p></div><span class="badge">${esc(active.experience.mode)}</span></div>
    <div class="panel experience-controls"><label>Profile<select id="profile-select">${state.document.profiles.map((entry) => `<option value="${esc(entry.experience.id)}@${esc(entry.experience.revision)}" ${entry.experience.id === active.experience.id && entry.experience.revision === active.experience.revision ? 'selected' : ''}>${esc(entry.label)}</option>`).join('')}</select></label><div class="segmented" role="group" aria-label="Theme"><button data-theme="light" class="${state.document.tokens.theme === 'light' ? 'selected' : ''}">Light</button><button data-theme="dark" class="${state.document.tokens.theme === 'dark' ? 'selected' : ''}">Dark</button></div></div>
    <div class="matrix" aria-label="Preview matrix">${['320px', '768px', '1280px'].map((size) => `<article class="matrix-cell"><div class="matrix-label"><strong>${size}</strong><span>${state.previewState}</span></div><div class="mini-preview ${state.document.tokens.theme}"><span class="mini-line wide"></span><span class="mini-line"></span><span class="mini-value">42</span></div></article>`).join('')}</div>
    <div class="panel state-panel"><h3>Data states</h3><div class="state-buttons" role="group" aria-label="Preview data state">${(['ready', 'loading', 'empty', 'partial', 'stale', 'error'] as const).map((value) => `<button data-preview="${value}" class="${state.previewState === value ? 'selected' : ''}">${value}</button>`).join('')}</div><p class="muted">State previews are local and do not claim provider or model execution.</p></div>
  </section>`;
}

function renderGallery(): string {
  return `<section class="workspace-section" aria-labelledby="gallery-title"><div class="section-heading"><div><p class="eyebrow">Actual shared elements</p><h2 id="gallery-title">Component Gallery</h2><p class="lede">These previews use the same registered web components shipped to consumers.</p></div><span class="badge">OSS · local</span></div><div class="gallery-grid"><article class="panel gallery-card"><h3>Metric</h3><p class="muted">Ready and stale states retain scope labels.</p><aeliqo-metric id="gallery-metric"></aeliqo-metric></article><article class="panel gallery-card gallery-wide"><h3>Table</h3><p class="muted">Native table semantics keep records inspectable.</p><aeliqo-table id="gallery-table"></aeliqo-table></article><article class="panel gallery-card"><h3>Trend</h3><p class="muted">A bounded chart preview from explicit points.</p><aeliqo-chart id="gallery-chart"></aeliqo-chart></article></div></section>`;
}

function renderInspect(state: ReturnType<StudioSession['getState']>): string {
  const inspection = session.inspect();
  const exported = session.exportDocument();
  return `<section class="workspace-section" aria-labelledby="inspect-title"><div class="section-heading"><div><p class="eyebrow">Evidence and source</p><h2 id="inspect-title">Inspect</h2><p class="lede">See the exact local revisions behind this preview.</p></div><span class="badge ${inspection.sourceOfTruth === 'application-bundle' ? 'badge-neutral' : 'badge-accent'}">${inspection.sourceOfTruth === 'application-bundle' ? 'application bundle' : 'studio draft'}</span></div><div class="inspect-grid"><div class="panel"><h3>Decision</h3><dl class="inspect-list"><div><dt>Catalog</dt><dd>${esc(inspection.catalogRevision)}</dd></div><div><dt>Function registry</dt><dd>${esc(inspection.registryDigest)}</dd></div><div><dt>Active profile</dt><dd>${esc(inspection.activeProfile.id)}@${esc(inspection.activeProfile.revision)}</dd></div><div><dt>Meaning entries</dt><dd>${inspection.meaningCount}</dd></div><div><dt>Code-owned</dt><dd>${inspection.codeOwnedCount}</dd></div><div><dt>Studio-owned</dt><dd>${inspection.studioOwnedCount}</dd></div></dl></div><div class="panel"><h3>Versioned export</h3><p class="muted">Safe to review or save. Credentials and raw rows are not part of the document.</p><pre class="export-preview">${exported.ok ? esc(exported.value) : esc(diagnosticText(state))}</pre></div></div></section>`;
}

function render(state: ReturnType<StudioSession['getState']>): void {
  const activeLabel = areaLabels[state.area];
  root.innerHTML = `<header class="app-header"><a class="brand" href="/" aria-label="Aeliqo home"><span class="brand-mark">A</span><span>Aeliqo <b>Studio</b></span></a><div class="header-actions"><span class="local-indicator"><i></i>Local workspace</span><button id="import-button" class="quiet">Import</button><input id="import-file" type="file" accept="application/json,.json" hidden /><button id="export-button" class="primary">Export document</button><button id="export-code-button" class="quiet">Export code</button></div></header><div class="app-shell"><aside class="sidebar" aria-label="Studio areas"><p class="sidebar-label">Workspace</p><nav>${(Object.keys(areaLabels) as StudioArea[]).map((area) => `<button class="nav-item ${area === state.area ? 'active' : ''}" data-area="${area}" aria-current="${area === state.area ? 'page' : 'false'}"><span class="nav-icon">${area === 'data-meaning' ? '◇' : area === 'experience' ? '◈' : area === 'gallery' ? '▦' : '⌁'}</span>${areaLabels[area]}</button>`).join('')}</nav><div class="sidebar-footer"><p>Document</p><code>${esc(state.document.id)}@${esc(state.document.revision)}</code><span>${state.dirty ? 'Unsaved local changes' : 'Saved snapshot'}</span></div></aside><main class="main-content"><div class="content-topline"><span>Local authoring</span><span>·</span><strong>${activeLabel}</strong></div><div id="announcement" class="sr-only" role="status" aria-live="polite">${esc(diagnosticText(state))}</div>${state.area === 'data-meaning' ? renderDataMeaning(state) : state.area === 'experience' ? renderExperience(state) : state.area === 'gallery' ? renderGallery() : renderInspect(state)}</main></div>`;
  bindEvents();
  if (state.area === 'gallery') bindGallery();
}

function bindGallery(): void {
  const metric = document.querySelector<HTMLElement>('#gallery-metric');
  if (metric !== null) Object.assign(metric, {label: 'Employees', value: 42, displayValue: '42', description: 'Current local preview', status: 'ready'});
  const table = document.querySelector<HTMLElement>('#gallery-table');
  if (table !== null) Object.assign(table, {caption: 'Employee records', columns: [{key: 'name', label: 'Name'}, {key: 'amount', label: 'Amount', align: 'end'}], rows: [{name: 'Ada', amount: 42}, {name: 'Grace', amount: 37}], entity: 'employees', identity: ['name']});
  const chart = document.querySelector<HTMLElement>('#gallery-chart');
  if (chart !== null) Object.assign(chart, {label: 'Amount trend', series: [{id: 'amount', label: 'Amount', points: [{label: 'Jan', x: '2026-01-01', y: 28}, {label: 'Feb', x: '2026-02-01', y: 42}, {label: 'Mar', x: '2026-03-01', y: 37}]}]});
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-area]').forEach((button) => button.addEventListener('click', () => session.selectArea(button.dataset.area as StudioArea)));
  root.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((button) => button.addEventListener('click', () => session.setPreviewState(button.dataset.preview as ReturnType<StudioSession['getState']>['previewState'])));
  root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => button.addEventListener('click', () => session.setTheme(button.dataset.theme as 'light' | 'dark')));
  root.querySelectorAll<HTMLButtonElement>('[data-meaning]').forEach((button) => button.addEventListener('click', () => { const [id, revision] = button.dataset.meaning!.split('@'); session.selectMeaning({id: id!, revision: revision!}); session.selectArea('inspect'); }));
  const profileSelect = root.querySelector<HTMLSelectElement>('#profile-select');
  profileSelect?.addEventListener('change', () => { const [id, revision] = profileSelect.value.split('@'); session.setActiveProfile({id: id!, revision: revision!}); });
  root.querySelector<HTMLFormElement>('#meaning-form')?.addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; if (!(form instanceof HTMLFormElement)) return; const data = new FormData(form); const result = session.defineMeaning({id: String(data.get('id')), label: String(data.get('label')), description: String(data.get('description')), entity: String(data.get('entity')), field: String(data.get('field'))}); if (!result.ok) session.showDiagnostics(result.diagnostics); });
  root.querySelector<HTMLButtonElement>('#export-button')?.addEventListener('click', () => { const exported = session.exportDocument(); if (!exported.ok) return; const blob = new Blob([exported.value], {type: 'application/json'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${session.getState().document.id}.aeliqo.json`; link.click(); URL.revokeObjectURL(link.href); });
  root.querySelector<HTMLButtonElement>('#export-code-button')?.addEventListener('click', () => { const exported = session.exportCode(); if (!exported.ok) return; const blob = new Blob([exported.value], {type: 'text/typescript'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${session.getState().document.id}.aeliqo.ts`; link.click(); URL.revokeObjectURL(link.href); });
  root.querySelector<HTMLButtonElement>('#import-button')?.addEventListener('click', () => root.querySelector<HTMLInputElement>('#import-file')?.click());
  root.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async (event) => { const input = event.currentTarget; if (!(input instanceof HTMLInputElement) || input.files?.[0] === undefined) return; session.importDocument(await input.files[0].text()); });
}

session.subscribe((state) => { document.documentElement.dataset.theme = state.document.tokens.theme; render(state); });
document.documentElement.dataset.theme = session.getState().document.tokens.theme;
render(session.getState());
