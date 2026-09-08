/**
 * Production-package workload fixtures used by the browser and Node probes.
 *
 * These are deliberately bounded probes. They report the work they perform
 * and the input scope so a result cannot be mistaken for a whole-page or
 * backend capacity claim.
 */
import {composePresentation} from '@aeliqo/core';
import {createAeliqoPresentationRegistry, AELIQO_CONFIG_SCHEMAS, AELIQO_OPERATION_REFS, AELIQO_PRESENTATION_REFS} from '@aeliqo/web/region';
import {createInteractionController, createInteractionGraph} from '@aeliqo/runtime/interaction';
import {createRegionStore} from '@aeliqo/runtime/regions';

export const SMALL_ROW_COUNT = 100;
export const MEDIUM_ROW_COUNT = 10_000;
export const MEDIUM_VIEW_COUNT = 30;
export const MEDIUM_FIELD_COUNT = 100;
export const MEDIUM_CANDIDATE_COUNT = 64;
export const LARGE_POPULATION_COUNT = 1_000_000;
export const LARGE_TRANSFERRED_ROW_COUNT = 100;

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index] ?? 0;
}

export function summary(values) {
  return {
    count: values.length,
    minMs: values.length === 0 ? 0 : Math.min(...values),
    maxMs: values.length === 0 ? 0 : Math.max(...values),
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
  };
}

export async function coldWarm(label, operation, options = {}) {
  const coldCount = options.coldCount ?? 3;
  const warmCount = options.warmCount ?? 7;
  const coldMs = [];
  const warmMs = [];
  for (let index = 0; index < coldCount; index += 1) {
    const started = now();
    await operation('cold', index);
    coldMs.push(now() - started);
  }
  for (let index = 0; index < warmCount; index += 1) {
    const started = now();
    await operation('warm', index);
    warmMs.push(now() - started);
  }
  return {label, cold: {rawMs: coldMs, ...summary(coldMs)}, warm: {rawMs: warmMs, ...summary(warmMs)}};
}

export function makeRows(count, fieldCount = 4) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const row = {id: `row-${index + 1}`, label: `Row ${index + 1}`, value: index};
    for (let field = 3; field < fieldCount; field += 1) row[`field-${String(field).padStart(3, '0')}`] = `v-${index}-${field}`;
    rows.push(row);
  }
  return rows;
}

export function semanticFields(count = MEDIUM_FIELD_COUNT) {
  return Array.from({length: count}, (_, index) => {
    if (index === 0) return {id: 'id', label: 'ID', type: {value: 'text', nullable: false}, role: 'identity'};
    return {id: `field-${String(index).padStart(3, '0')}`, label: `Field ${index}`, type: {value: 'text', nullable: true}, role: 'attribute'};
  });
}

export function mediumResult() {
  const ref = {id: 'performance-medium-result', revision: '1', outputId: 'rows', queryDigest: 'performance-medium-query', scopeDigest: 'performance-medium-scope'};
  const fields = semanticFields();
  return {
    version: '1', ref, taskId: 'performance-medium-task', fields, identity: ['id'], rowGrain: ['id'],
    counts: {loaded: MEDIUM_ROW_COUNT, population: {kind: 'exact', value: MEDIUM_ROW_COUNT, populationDigest: 'performance-medium-population'}},
    precision: {kind: 'exact'}, coverage: {kind: 'complete', populationDigest: 'performance-medium-population'},
    consistency: {kind: 'snapshot', snapshotId: 'performance-medium-snapshot', sourceRevisions: {records: '1'}},
    evidence: {kind: 'observed', source: {id: 'performance-medium-source', revision: '1'}}, filters: [], warnings: [], lineage: [],
  };
}

export function mediumContext() {
  const result = mediumResult();
  const needs = Array.from({length: MEDIUM_VIEW_COUNT}, (_, index) => ({
    id: `view-${String(index + 1).padStart(2, '0')}`, operation: AELIQO_OPERATION_REFS.read,
    outputId: result.ref.outputId, fields: [result.fields[index + 1]?.id ?? 'id'], required: true,
  }));
  const task = {
    version: '1', id: 'performance-medium-task', revision: 'performance-task-1', catalogRevision: 'performance-catalog-1',
    functionRegistryDigest: 'performance-functions-1', regionId: 'performance-medium-region', goal: 'Render the medium workload',
    kind: 'presentation', needs, assumptions: [], inputs: [result.ref],
  };
  const current = {
    scopeDigest: 'performance-medium-scope', policyRevision: 'performance-policy-1', taskRevision: task.revision,
    regionRevision: 'performance-region-1', catalogRevision: task.catalogRevision, experienceRevision: 'performance-experience-1',
    functionRegistryDigest: task.functionRegistryDigest, results: [result.ref],
  };
  const experience = {
    version: '1', id: 'performance-medium-experience', revision: current.experienceRevision, mode: 'composable', agentAllowed: false,
    allowedRepresentations: [AELIQO_PRESENTATION_REFS.stack.id, AELIQO_PRESENTATION_REFS.table.id], allowedPatterns: [],
    composition: {allowWithoutPreset: true, maxNodes: 64, maxExpansions: MEDIUM_CANDIDATE_COUNT}, requiredOperations: [],
    tokenProfile: {id: 'tokens.default', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable',
  };
  const environment = {
    inlineSize: {state: 'known', value: 1280}, blockSize: {state: 'known', value: 900}, textScale: {state: 'known', value: 1},
    pointer: 'fine', hover: 'available', keyboard: 'available', locale: 'en-US', direction: 'ltr', reducedMotion: false, forcedColors: false,
  };
  return {result, task, current, experience, environment};
}

export function mediumPlan() {
  const {result, task, current, experience, environment} = mediumContext();
  const nodes = [
    {id: 'layout', role: 'structure', representation: AELIQO_PRESENTATION_REFS.stack, config: {schema: AELIQO_CONFIG_SCHEMAS.stack, values: {}}, children: []},
  ];
  const tableNodes = [];
  for (let index = 0; index < MEDIUM_VIEW_COUNT; index += 1) {
    const id = `view-${String(index + 1).padStart(2, '0')}`;
    tableNodes.push({id, role: 'table', representation: AELIQO_PRESENTATION_REFS.table, result: result.ref,
      config: {schema: AELIQO_CONFIG_SCHEMAS.table, values: {selection: 'none'}}, children: []});
  }
  nodes[0].children = tableNodes.map((node) => node.id);
  nodes.push(...tableNodes);
  const plan = {
    id: 'performance-medium-plan', revision: 'performance-plan-1', rootId: 'layout', preconditions: current,
    nodes, links: [], coverage: task.needs.map((need, index) => ({needId: need.id, nodeIds: [tableNodes[index]?.id ?? 'view-01'], operations: [AELIQO_OPERATION_REFS.read]})),
    stateTransfer: [], diagnostics: [],
  };
  const registryResult = createAeliqoPresentationRegistry({resolveEntity: () => 'record'});
  if (!registryResult.ok) throw new Error(`presentation registry unavailable: ${registryResult.diagnostics[0]?.message ?? 'unknown error'}`);
  const context = {task, experience, results: [result], current, environment,
    rendererCapabilities: [AELIQO_PRESENTATION_REFS.stack, AELIQO_PRESENTATION_REFS.table]};
  const candidates = Array.from({length: MEDIUM_CANDIDATE_COUNT}, () => ({source: 'explicit', plan}));
  return {context, registry: registryResult.value, plan, candidates, rows: makeRows(MEDIUM_ROW_COUNT, 4)};
}

export function runMediumPlanner() {
  const workload = mediumPlan();
  const started = now();
  const composed = composePresentation({id: 'performance-medium-composition', revision: 'performance-composition-1', preconditions: workload.context.current,
    context: workload.context, candidates: workload.candidates}, workload.registry);
  const durationMs = now() - started;
  if (!composed.ok) throw new Error(`medium composition failed: ${JSON.stringify(composed.diagnostics)}`);
  return {durationMs, status: composed.value.status, expansions: composed.value.expansions, nodes: composed.value.presentation?.plan.nodes.length ?? 0,
    candidateCount: MEDIUM_CANDIDATE_COUNT, rowCount: MEDIUM_ROW_COUNT, viewCount: MEDIUM_VIEW_COUNT, fieldCount: MEDIUM_FIELD_COUNT};
}

export async function runTargetedReducer(iterations = 100) {
  const authority = {principalKey: 'performance-principal', scopeDigest: 'performance-reducer-scope', policyRevision: 'performance-reducer-policy',
    catalogRevision: 'performance-reducer-catalog', experienceRevision: 'performance-reducer-experience', functionRegistryDigest: 'performance-reducer-functions', results: []};
  const task = {version: '1', id: 'performance-reducer-task', revision: 'performance-reducer-task-1', catalogRevision: authority.catalogRevision,
    functionRegistryDigest: authority.functionRegistryDigest, regionId: 'performance-reducer-region', goal: 'Edit a bounded draft', kind: 'presentation', needs: [], assumptions: [], inputs: []};
  const store = createRegionStore({readAuthority: () => ({ok: true, value: authority}), authorizeCommit: async () => ({ok: true, value: undefined})});
  const created = store.create({id: task.regionId, state: {task}});
  if (!created.ok) throw new Error(`reducer region failed: ${created.diagnostics[0]?.message ?? 'unknown error'}`);
  const region = created.value;
  const graph = createInteractionGraph({nodes: [
    {id: 'editor', ports: [{id: 'draft', direction: 'output', payload: 'draft'}]},
    {id: 'unrelated', ports: [{id: 'draft', direction: 'input', payload: 'draft'}]},
  ], links: [], mappings: []});
  const host = () => ({principalKey: authority.principalKey, draftDomain: 'performance', actor: {id: 'performance-user', kind: 'user'},
    grants: ['experience.commit', 'draft.edit'], scopeDigest: authority.scopeDigest, policyRevision: authority.policyRevision,
    catalogRevision: authority.catalogRevision, experienceRevision: authority.experienceRevision, functionRegistryDigest: authority.functionRegistryDigest, results: []});
  const controller = createInteractionController({region, graph, readContext: host,
    validateDraft: () => ({ok: true, value: undefined})});
  const durations = [];
  let successful = 0;
  let unrelatedRoutes = 0;
  for (let index = 0; index < iterations; index += 1) {
    const event = {eventId: `draft-${index + 1}`, causationId: `cause-${index + 1}`, regionId: task.regionId,
      regionRevision: region.snapshot().regionRevision, originNodeId: 'editor',
      payload: {kind: 'draft', entity: 'record', key: 'row-1', field: 'field-001', value: `draft-${index + 1}`, entityRevision: '1'}};
    const started = now();
    const outcome = await controller.dispatch(event, {sourcePortId: 'draft'});
    durations.push(now() - started);
    if (outcome.ok) {
      successful += 1;
      unrelatedRoutes += outcome.value.routed.filter((item) => item.route.nodeId === 'unrelated').length;
    }
  }
  const finalState = controller.state();
  controller.dispose();
  graph.dispose();
  store.dispose();
  return {iterations, successful, unrelatedRoutes, finalDraftCount: finalState.drafts.length, rawMs: durations, ...summary(durations)};
}

export function environmentSnapshot() {
  if (typeof navigator !== 'undefined') return {runtime: 'browser', userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language,
    viewport: {width: globalThis.innerWidth, height: globalThis.innerHeight}, devicePixelRatio: globalThis.devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency ?? null};
  return {runtime: 'node', node: process.version, platform: process.platform, arch: process.arch, cpuCount: typeof process !== 'undefined' ? process.availableParallelism?.() ?? null : null};
}
