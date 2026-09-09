import {stateMappingFor} from './state.js';
import * as z from 'zod/mini';
import {canonicalJSON, parseContract, parseResult} from '../contracts/parse.js';
import {inspectWire} from '../contracts/ingress.js';
import {idSchema, jsonSchema, versionRefSchema} from '../contracts/schemas.js';
import {WIRE_LIMITS} from '../contracts/limits.js';
import {validateCommitReadSet, validateParsedCommitReadSet} from '../contracts/commit.js';
import {validateTaskStructure, type TaskStructure} from '../contracts/task/index.js';
import {resolveExperienceConstraints, type ExperienceConstraints} from '../contracts/experience/index.js';
import {validateInteractionGraph, type InteractionGraph} from '../interaction/graph.js';
import type {CommitPreconditions, Experience, Outcome, PresentationPlan, Result, ResultRef, Task, VersionRef} from '../contracts/types.js';
import type {
  PresentationContext, PresentationEnvironment, PresentationPatternContext, PresentationPatternManifest,
  PresentationRegistry, PresentationValues, PresentationQuality, ResolvedPresentationNode, ValidatedPresentation,
} from './types.js';
import {freezePresentation, isThenable, presentationFailure as fail, versionKey} from './registry.js';

const refKey = (r: ResultRef): string => JSON.stringify([r.id, r.revision, r.outputId, r.queryDigest, r.scopeDigest]);
const MAX_MEASURED_MICROSECONDS = 1_000_000_000_000;
const resolvedSchema = z.strictObject({
  values: z.record(z.string(), jsonSchema),
  fields: z.array(idSchema).check(z.maxLength(WIRE_LIMITS.array)),
  ports: z.array(z.unknown()).check(z.maxLength(128)),
  operations: z.optional(z.array(versionRefSchema).check(z.maxLength(WIRE_LIMITS.array))),
});
const qualitySchema = z.strictObject({
  taskFit: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  informationDensity: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  interactionEffort: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  legibilityPenalty: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  cost: z.optional(z.strictObject({
    microseconds: z.number().check(z.int(), z.minimum(0), z.maximum(MAX_MEASURED_MICROSECONDS)),
    measurement: versionRefSchema,
  })),
});

/** Parsed, immutable inputs shared by plan validation and trusted pattern callbacks. */
export interface PreparedPresentationContext {
  readonly constraints: ExperienceConstraints;
  readonly task: Task;
  readonly experience: Experience;
  readonly results: readonly Result[];
  readonly current: CommitPreconditions;
  readonly environment: PresentationEnvironment;
  /** Parsed once per composition; candidate validation must not rescan this invariant input. */
  readonly rendererCapabilities: readonly VersionRef[];
  readonly taskStructure: TaskStructure;
  readonly patternContext: PresentationPatternContext;
}

export interface PresentationValidationOptions {
  /** A pattern candidate must match this exact registered pattern. */
  readonly requiredPattern?: PresentationPatternManifest;
}

/** Pure indexes owned by one composition/validation invocation. */
export interface PresentationValidationCache {
  readonly manifests: ReadonlyMap<string, PresentationRegistry['manifests'][number]>;
  readonly renderer: ReadonlySet<string>;
  readonly extensions: ReadonlySet<string>;
  readonly allowedRepresentations: ReadonlySet<string>;
  readonly allowedOperations: ReadonlySet<string> | undefined;
  readonly requiredOperations: ReadonlySet<string>;
  readonly resultFields: ReadonlyMap<Result, ReadonlySet<string>>;
  readonly resultsByRef: ReadonlyMap<string, Result>;
  readonly taskInputs: ReadonlySet<string>;
  readonly taskNeeds: ReadonlyMap<string, Task['needs'][number]>;
  readonly taskOutputs: ReadonlyMap<string, Extract<Task, {kind: 'data'}>['outputs'][number]>;
  readonly nodeGraphs: Map<string, Outcome<InteractionGraph>>;
  readonly presentationGraphs: Map<string, Outcome<InteractionGraph>>;
  readonly coverageIds: WeakMap<object, number>;
  readonly coverageAnalyses: Map<string, Outcome<PresentationCoverageAnalysis>>;
  readonly treeEntries: PresentationTreeCacheEntry[];
  nextCoverageId: number;
}

interface PresentationCoverageAnalysis {
  readonly coverage: ReadonlyMap<string, PresentationPlan['coverage'][number]>;
  readonly operations: ReadonlySet<string>;
}

interface PresentationTreeCacheEntry {
  readonly rootId: string;
  readonly nodeIds: readonly string[];
  readonly children: readonly object[];
  readonly childrenById: ReadonlyMap<string, readonly string[]>;
  readonly parents: ReadonlyMap<string, string>;
}

/** Per-composition manifest index. It contains no authority beyond the supplied registry. */
export function preparePresentationRegistry(registry: PresentationRegistry): Outcome<ReadonlyMap<string, PresentationRegistry['manifests'][number]>> {
  if (!Array.isArray(registry?.manifests) || registry.manifests.length === 0 || registry.manifests.length > WIRE_LIMITS.presentationNodes)
    return fail('registry', 'The representation registry is malformed or exceeds its bound.');
  const manifests = new Map(registry.manifests.map(manifest => [versionKey(manifest.ref), manifest]));
  if (manifests.size !== registry.manifests.length) return fail('registry', 'Representation references must be unique.');
  return {ok: true, value: manifests};
}

export function preparePresentationValidationCache(
  prepared: PreparedPresentationContext,
  registry: PresentationRegistry,
  manifestIndex?: ReadonlyMap<string, PresentationRegistry['manifests'][number]>,
): Outcome<PresentationValidationCache> {
  const preparedManifests = manifestIndex === undefined ? preparePresentationRegistry(registry) : {ok: true as const, value: manifestIndex};
  if (!preparedManifests.ok) return preparedManifests;
  const resultFields = new Map<Result, ReadonlySet<string>>();
  const resultsByRef = new Map<string, Result>();
  for (const result of prepared.results) {
    resultFields.set(result, new Set(result.fields.map(field => field.id)));
    resultsByRef.set(refKey(result.ref), result);
  }
  const taskOutputs = new Map<string, Extract<Task, {kind: 'data'}>['outputs'][number]>();
  if (prepared.task.kind === 'data') for (const output of prepared.task.outputs) taskOutputs.set(output.id, output);
  return {ok: true, value: {
    manifests: preparedManifests.value,
    renderer: new Set(prepared.rendererCapabilities.map(versionKey)),
    extensions: new Set(prepared.constraints.extensionAllowlist.map(versionKey)),
    allowedRepresentations: new Set(prepared.constraints.allowedRepresentations),
    allowedOperations: prepared.constraints.allowedOperations === undefined ? undefined : new Set(prepared.constraints.allowedOperations.map(versionKey)),
    requiredOperations: new Set(prepared.constraints.requiredOperationIds),
    resultFields, resultsByRef,
    taskInputs: new Set(prepared.task.kind === 'presentation' ? prepared.task.inputs.map(refKey) : []),
    taskNeeds: new Map(prepared.constraints.taskNeeds.map(need => [need.id, need])), taskOutputs,
    nodeGraphs: new Map(), presentationGraphs: new Map(), coverageIds: new WeakMap(), coverageAnalyses: new Map(), treeEntries: [], nextCoverageId: 0,
  }};
}

function preparePresentationTree(plan: PresentationPlanLike, cache: PresentationValidationCache): Outcome<PresentationTreeCacheEntry> {
  const nodeIds = plan.nodes.map(node => node.id);
  const children = plan.nodes.map(node => node.children as object);
  for (const entry of cache.treeEntries) {
    if (entry.rootId !== plan.rootId || entry.nodeIds.length !== nodeIds.length) continue;
    let same = true;
    for (let index = 0; index < nodeIds.length; index++) {
      if (entry.nodeIds[index] !== nodeIds[index] || entry.children[index] !== children[index]) { same = false; break; }
    }
    if (same) return {ok: true, value: entry};
  }
  const childrenById = new Map(plan.nodes.map(node => [node.id, node.children]));
  if (childrenById.size !== plan.nodes.length || !childrenById.has(plan.rootId)) return fail('tree', 'Node IDs must be unique and the root must exist.');
  const parents = new Map<string, string>();
  for (const node of plan.nodes) {
    for (const child of node.children) {
      if (!childrenById.has(child) || child === plan.rootId || parents.has(child)) return fail('tree', 'Rendered nodes must form one tree with unique parent ownership.');
      parents.set(child, node.id);
    }
  }
  const visit = [plan.rootId];
  const visited = new Set<string>();
  for (let i = 0; i < visit.length; i++) {
    const id = visit[i]!;
    if (visited.has(id)) return fail('tree', 'Containment cycles are not allowed.');
    visited.add(id); visit.push(...childrenById.get(id)!);
  }
  if (visited.size !== childrenById.size) return fail('tree', 'All nodes must be reachable from the declared root.');
  const entry = {rootId: plan.rootId, nodeIds, children, childrenById, parents};
  cache.treeEntries.push(entry);
  return {ok: true, value: entry};
}

function coverageObjectId(cache: PresentationValidationCache, value: object): number {
  const cached = cache.coverageIds.get(value);
  if (cached !== undefined) return cached;
  cache.nextCoverageId += 1;
  cache.coverageIds.set(value, cache.nextCoverageId);
  return cache.nextCoverageId;
}

function coverageMemoKey(
  plan: PresentationPlanLike,
  byId: ReadonlyMap<string, ResolvedPresentationNode>,
  cache: PresentationValidationCache,
): string {
  const nodes: unknown[] = [];
  for (const entry of plan.coverage) {
    for (const id of entry.nodeIds) {
      const node = byId.get(id);
      nodes.push([id, node === undefined ? 0 : coverageObjectId(cache, node as object)]);
    }
  }
  return `${coverageObjectId(cache, plan.coverage as object)}:${JSON.stringify(nodes)}`;
}

function prepareCoverage(
  plan: PresentationPlanLike,
  byId: ReadonlyMap<string, ResolvedPresentationNode>,
  cache: PresentationValidationCache,
): Outcome<PresentationCoverageAnalysis> {
  const coverage = new Map<string, PresentationPlan['coverage'][number]>();
  const operations = new Set<string>();
  for (const entry of plan.coverage) {
    if (coverage.has(entry.needId) || new Set(entry.nodeIds).size !== entry.nodeIds.length || new Set(entry.operations.map(versionKey)).size !== entry.operations.length)
      return fail('coverage', 'Coverage entries must identify unique needs, nodes and operations.');
    const need = cache.taskNeeds.get(entry.needId);
    if (need === undefined || !entry.operations.some(op => versionKey(op) === versionKey(need.operation))) return fail('coverage', 'Coverage must identify a declared task operation.');
    const fields = new Set<string>();
    for (const id of entry.nodeIds) {
      const node = byId.get(id);
      if (node === undefined) return fail('coverage', 'Coverage points to a missing node.');
      if (need.outputId !== undefined && node.result?.ref.outputId !== need.outputId) return fail('coverage', 'The operation is bound to a different task output.');
      if (!entry.operations.every(op => (node.config.operations ?? []).some(supported => versionKey(supported) === versionKey(op)))) return fail('coverage', 'The representation configuration does not support the claimed operation.');
      if (cache.allowedOperations !== undefined && !entry.operations.every(op => cache.allowedOperations!.has(versionKey(op)))) return fail('restricted', 'An operation is restricted by the active experience.');
      node.config.fields.forEach(field => fields.add(field));
    }
    if (need.fields.some(field => !fields.has(field))) return fail('coverage', 'The required fields are not supplied by the claimed views.');
    coverage.set(need.id, entry); entry.operations.forEach(op => operations.add(op.id));
  }
  if ([...cache.taskNeeds.values()].some(need => need.required && !coverage.has(need.id)) || [...cache.requiredOperations].some(op => !operations.has(op)))
    return fail('coverage', 'The candidate omits a required operation.');
  return {ok: true, value: {coverage, operations}};
}

function callbackOutcome(raw: unknown, failureCode: string, failureMessage: string): Outcome<unknown> {
  if (isThenable(raw)) return fail(failureCode, failureMessage);
  const wire = inspectWire(raw);
  if (!wire.ok) return wire;
  const outcome = wire.value as {ok?: unknown; value?: unknown};
  if (outcome === null || typeof outcome !== 'object' || outcome.ok !== true || !Object.hasOwn(outcome, 'value'))
    return fail(failureCode, failureMessage);
  return {ok: true, value: outcome.value};
}

function parseRendererCapabilities(input: readonly VersionRef[]): Outcome<readonly VersionRef[]> {
  const wire = inspectWire(input);
  if (!wire.ok) return wire;
  const parsed = z.safeParse(z.array(versionRefSchema).check(z.maxLength(WIRE_LIMITS.array)), wire.value);
  if (!parsed.success) return fail('renderer', 'Renderer capability references are malformed or exceed their limit.');
  return {ok: true, value: freezePresentation(parsed.data)};
}

/** Parse and freeze the host-owned inputs before exposing them to trusted callbacks. */
export function preparePresentationContext(context: PresentationContext): Outcome<PreparedPresentationContext> {
  const constraints = resolveExperienceConstraints(context.experience, context.task, context.restrictions);
  if (!constraints.ok) return constraints;
  const taskStructure = validateTaskStructure(constraints.value.task);
  if (!taskStructure.ok) return taskStructure;
  const environment = parseContract('environment', context.environment);
  if (!environment.ok) return environment;
  const current = validateCommitReadSet(context.current, context.current);
  if (!current.ok) return current;
  const rendererCapabilities = parseRendererCapabilities(context.rendererCapabilities);
  if (!rendererCapabilities.ok) return rendererCapabilities;
  if (!Array.isArray(context.results) || context.results.length > WIRE_LIMITS.outputs)
    return fail('results', 'The authorized result descriptors must be bounded.');
  const results: Result[] = [];
  const seen = new Set<string>();
  const authorized = new Set(current.value.results.map(refKey));
  try {
    for (const input of context.results) {
      const parsed = parseResult(input);
      if (!parsed.ok) return parsed;
      const key = refKey(parsed.value.ref);
      if (seen.has(key)) return fail('results', 'The descriptor list repeats a result reference.');
      if (!authorized.has(key)) return fail('results', 'A supplied result descriptor is not present in the current authorized read set.');
      seen.add(key);
      results.push(freezePresentation(parsed.value));
    }
  } catch {
    return fail('results', 'The authorized result descriptors could not be parsed.');
  }
  const task = freezePresentation(constraints.value.task);
  const experience = freezePresentation(constraints.value.experience);
  const environmentValue = freezePresentation(environment.value);
  const currentValue = freezePresentation(current.value);
  const frozenResults = freezePresentation(results);
  const patternContext = freezePresentation({
    task, experience, results: frozenResults, current: currentValue, environment: environmentValue,
  });
  return {ok: true, value: freezePresentation({
    constraints: freezePresentation(constraints.value), task, experience, results: frozenResults,
    current: currentValue, environment: environmentValue, rendererCapabilities: rendererCapabilities.value,
    taskStructure: freezePresentation(taskStructure.value), patternContext,
  })};
}

function patternIsAllowed(pattern: PresentationPatternManifest, constraints: ExperienceConstraints): boolean {
  return constraints.allowedPatterns.includes(pattern.ref.id);
}

type PresentationPlanLike = ValidatedPresentation['plan'];

function matchesPattern(
  plan: PresentationPlanLike,
  prepared: PreparedPresentationContext,
  registry: PresentationRegistry,
  requiredPattern?: PresentationPatternManifest,
): boolean {
  const patterns = requiredPattern === undefined
    ? (registry.patterns ?? []).filter(pattern => patternIsAllowed(pattern, prepared.constraints))
    : (registry.patterns ?? []).filter(pattern => samePattern(pattern, requiredPattern) && patternIsAllowed(pattern, prepared.constraints));
  for (const pattern of patterns) {
    try {
      const matched = pattern.matches(plan, prepared.patternContext);
      if (isThenable(matched) || typeof matched !== 'boolean') continue;
      if (matched) return true;
    } catch {
      // A local pattern failure makes this pattern inapplicable; it never grants validity.
    }
  }
  return false;
}

function samePattern(left: PresentationPatternManifest, right: PresentationPatternManifest): boolean {
  return versionKey(left.ref) === versionKey(right.ref);
}

function parseQuality(raw: unknown): Outcome<PresentationQuality> {
  const outcome = callbackOutcome(raw, 'quality', 'The registered presentation assessor failed.');
  if (!outcome.ok) return outcome;
  const parsed = z.safeParse(qualitySchema, outcome.value);
  if (!parsed.success) return fail('quality', 'A presentation quality assessment is malformed or outside its bounded ordinal contract.');
  if (parsed.data.cost !== undefined && !Number.isSafeInteger(parsed.data.cost.microseconds))
    return fail('quality', 'A measured presentation cost must be a finite safe integer.');
  return {ok: true, value: freezePresentation(parsed.data as PresentationQuality)};
}

/** Validate feasibility against trusted descriptors/registry. This grants no runtime effects. */
export function validatePresentationPlan(
  input: unknown, context: PresentationContext, registry: PresentationRegistry, options: PresentationValidationOptions = {},
): Outcome<ValidatedPresentation> {
  const parsed = parseContract('presentation-plan', input);
  if (!parsed.ok) return parsed;
  const prepared = preparePresentationContext(context);
  if (!prepared.ok) return prepared;
  return validatePreparedPresentationPlan(parsed.value, context, registry, prepared.value, options);
}

/** Internal composition pass over an owned schema-parsed plan and this invocation's
 * immutable context. Deliberately not re-exported by the public presentation entry.
 * Public callers always enter validatePresentationPlan and parse their inputs. */
export function validatePreparedPresentationPlan(
  input: PresentationPlanLike, context: PresentationContext, registry: PresentationRegistry,
  preparedContext: PreparedPresentationContext, options: PresentationValidationOptions = {},
  nodeMemo?: Map<string, ResolvedPresentationNode>,
  nodeIdentityMemo?: WeakMap<object, ResolvedPresentationNode>,
  manifestIndex?: ReadonlyMap<string, PresentationRegistry['manifests'][number]>,
  validationCache?: PresentationValidationCache,
): Outcome<ValidatedPresentation> {
  // The schema parser owns this plan. Freeze nodes at the callback boundary and
  // freeze the completed replay plan after cached node substitutions.
  const plan = input;
  const prepared = {value: preparedContext};
  const {constraints: c, task, current} = prepared.value;
  if (c.task.revision !== current.taskRevision || c.task.catalogRevision !== current.catalogRevision
    || c.task.functionRegistryDigest !== current.functionRegistryDigest || c.experience.revision !== current.experienceRevision)
    return fail('stale', 'The task or experience differs from the current version pins.');
  if (plan.nodes.length === 0 || plan.nodes.length > c.maxNodes) return fail('nodes', 'The candidate exceeds the permitted node count.');
  const readSet = validateParsedCommitReadSet(plan.preconditions, prepared.value.current,
    [...prepared.value.taskStructure.resultReferences, ...plan.nodes.flatMap(n => n.result === undefined ? [] : [n.result])]);
  if (!readSet.ok) return readSet;
  const preparedCache = validationCache === undefined
    ? preparePresentationValidationCache(prepared.value, registry, manifestIndex)
    : {ok: true as const, value: validationCache};
  if (!preparedCache.ok) return preparedCache;
  const tree = preparePresentationTree(plan, preparedCache.value);
  if (!tree.ok) return tree;
  const {parents} = tree.value;
  const {manifests, renderer, extensions, allowedRepresentations, allowedOperations,
    resultFields, resultsByRef, taskInputs, taskOutputs} = preparedCache.value;
  const resolved: ResolvedPresentationNode[] = [];
  for (const node of plan.nodes) {
    // Full schema-owned node identity includes config, children, representation and
    // exact result reference. The memo belongs only to one immutable composition context.
    const identityCached = nodeIdentityMemo?.get(node as object);
    const memoKey = identityCached === undefined && nodeMemo !== undefined ? canonicalJSON(node) : undefined;
    const cached = identityCached ?? (memoKey === undefined ? undefined : nodeMemo?.get(memoKey));
    if (cached !== undefined) { resolved.push(cached); continue; }
    const key = versionKey(node.representation);
    const m = manifests.get(key);
    if (m === undefined || !renderer.has(key)) return fail('renderer', 'The requested representation is unavailable on this renderer.');
    if (!allowedRepresentations.has(m.ref.id) || (m.extension && !extensions.has(key))) return fail('restricted', 'The experience does not allow this representation.');
    if (!m.roles.includes(node.role) || versionKey(node.config.schema) !== versionKey(m.configSchema)) return fail('configuration', 'The representation role or configuration schema does not match its registration.');
    if (node.children.length < m.children.min || node.children.length > m.children.max) return fail('children', 'The child count violates the representation contract.');
    const nodeResult = node.result;
    const result = nodeResult === undefined ? undefined : resultsByRef.get(refKey(nodeResult));
    if ((node.result !== undefined && result === undefined) || (m.result === 'required' && result === undefined) || (m.result === 'none' && result !== undefined))
      return fail('binding', 'The representation requires an available, compatible result binding.');
    if (result !== undefined) {
      if (task.kind === 'presentation' && !taskInputs.has(refKey(result.ref)))
        return fail('binding', 'The result is not one of the queryless task inputs.');
      if (task.kind === 'data') {
        const output = taskOutputs.get(result.ref.outputId);
        if (output === undefined || (output.kind === 'reuse' ? refKey(output.result) !== refKey(result.ref) : result.taskId !== task.id))
          return fail('binding', 'The result does not belong to the declared task output.');
      }
      if (task.kind === 'form') return fail('binding', 'Queryless forms do not implicitly consume result data.');
    }
    freezePresentation(node);
    let output: unknown;
    try { output = m.resolveConfig(node.config.values, result, node); } catch { return fail('configuration', 'The registered configuration validator failed.'); }
    const outcome = callbackOutcome(output, 'configuration', 'The registered configuration validator failed.');
    if (!outcome.ok) return outcome;
    const config = z.safeParse(resolvedSchema, outcome.value);
    if (!config.success || new Set(config.data.fields).size !== config.data.fields.length) return fail('configuration', 'The registered configuration result is malformed.');
    const enabled = (config.data.operations ?? m.operations) as readonly VersionRef[];
    if (new Set(enabled.map(versionKey)).size !== enabled.length || enabled.some(op => !m.operations.some((declared: VersionRef) => versionKey(op) === versionKey(declared))))
      return fail('configuration', 'Enabled operations must be a unique subset of the registered manifest.');
    if (allowedOperations !== undefined && enabled.some(op => !allowedOperations.has(versionKey(op))))
      return fail('restricted', 'The representation exposes an operation restricted by the active experience.');
    if (config.data.fields.some((field: string) => result === undefined || !resultFields.get(result)!.has(field))) return fail('field', 'A representation refers to a field absent from its result.');
    const nodeGraphInput = {nodes: [{id: node.id, ports: config.data.ports}], links: []};
    const nodeGraphKey = canonicalJSON(nodeGraphInput);
    let portGraph = preparedCache.value.nodeGraphs.get(nodeGraphKey);
    if (portGraph === undefined) {
      portGraph = validateInteractionGraph(nodeGraphInput, registry.mappings);
      preparedCache.value.nodeGraphs.set(nodeGraphKey, portGraph);
    }
    if (!portGraph.ok) return portGraph;
    const values = freezePresentation(config.data.values as PresentationValues);
    const resolvedConfig = freezePresentation({values, fields: freezePresentation(config.data.fields), ports: portGraph.value.nodes[0]!.ports,
      operations: freezePresentation(enabled)});
    let quality: PresentationQuality | undefined;
    if (m.assess !== undefined) {
      let assessed: unknown;
      try { assessed = m.assess(resolvedConfig, result, prepared.value.environment); } catch { return fail('quality', 'The registered presentation assessor failed.'); }
      const parsedQuality = parseQuality(assessed);
      if (!parsedQuality.ok) return parsedQuality;
      quality = parsedQuality.value;
    }
    // Preserve the validated wire proposal for replay; resolved values may
    // contain host-only labels/defaults that the input schema correctly rejects.
    const resolvedNode = freezePresentation({node, manifest: m.ref,
      config: resolvedConfig, result, ...(quality === undefined ? {} : {quality})});
    resolved.push(resolvedNode);
    nodeIdentityMemo?.set(node as object, resolvedNode);
    if (memoKey !== undefined) nodeMemo?.set(memoKey, resolvedNode);
  }
  const byId = new Map(resolved.map(n => [n.node.id, n]));
  const coverageKey = coverageMemoKey(plan, byId, preparedCache.value);
  let preparedCoverage = preparedCache.value.coverageAnalyses.get(coverageKey);
  if (preparedCoverage === undefined) {
    preparedCoverage = prepareCoverage(plan, byId, preparedCache.value);
    preparedCache.value.coverageAnalyses.set(coverageKey, preparedCoverage);
  }
  if (!preparedCoverage.ok) return preparedCoverage;
  const {coverage} = preparedCoverage.value;
  const hasPotentialComparison = [...coverage.values()].some(entry => entry.nodeIds.length > 1)
    || c.task.needs.some(need => need.simultaneousGroup !== undefined);
  if (hasPotentialComparison) {
    const groups = new Map<string, Set<string>>();
    for (const need of c.task.needs) {
      const entry = coverage.get(need.id);
      if (entry === undefined) continue;
      const key = need.simultaneousGroup ?? `need:${need.id}`;
      const group = groups.get(key) ?? new Set<string>(); entry.nodeIds.forEach(id => group.add(id)); groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.size < 2) continue;
      const branches = new Map<string, string>();
      for (const id of group) {
        let child = id;
        for (let parent = parents.get(child); parent !== undefined; parent = parents.get(child)) {
          const ancestor = byId.get(parent)!;
          if (manifests.get(versionKey(ancestor.manifest))!.visibility === 'exclusive') {
            if (branches.has(parent) && branches.get(parent) !== child) return fail('simultaneous', 'An exclusive container hides an essential comparison.');
            branches.set(parent, child);
          }
          child = parent;
        }
      }
    }
  }
  if (context.incumbent !== undefined) {
    const old = parseContract('presentation-plan', context.incumbent);
    if (!old.ok) return old;
    const oldReadSet = validateCommitReadSet(old.value.preconditions, current,
      old.value.nodes.flatMap(n => n.result === undefined ? [] : [n.result]));
    if (!oldReadSet.ok) return oldReadSet;
    const stateCapabilities = parseRendererCapabilities(context.stateMappingCapabilities ?? []); if (!stateCapabilities.ok) return stateCapabilities;
    const nodeById = new Map(plan.nodes.map(node => [node.id, node]));
    const topology = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, n.role, n.children]).sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : String(a[0]) > String(b[0]) ? 1 : 0)));
    const variants = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, versionKey(n.representation)]).sort());
    const structural = topology(old.value) !== topology(plan);
    const replacing = variants(old.value) !== variants(plan);
    const configurations = (p: typeof plan) => JSON.stringify(p.nodes.map(n => [n.id, n.config]).sort());
    const configurationChanged = configurations(old.value) !== configurations(plan);
    const semantics = (p: typeof plan) => JSON.stringify([p.links, p.coverage, p.nodes.map(n => [n.id, n.result]).sort()]);
    const semanticChanged = semantics(old.value) !== semantics(plan);
    if ((!c.compositionChangeAllowed && structural) || (!c.representationReplacementAllowed && replacing)) return fail('transition', 'The experience mode forbids this presentation change.');
    if ((structural || replacing || configurationChanged || semanticChanged) && (context.transitionBlocked === true || (c.transitionPolicy === 'explicit-only' && context.explicitTransition !== true)))
      return fail('transition', 'The presentation change must wait for the active interaction or an explicit user transition.');
    if (structural || replacing || configurationChanged || semanticChanged) {
      for (const previous of old.value.nodes) {
        if (!plan.stateTransfer.some(t => t.fromNode === previous.id))
          return fail('state-transfer', 'Changing a presentation requires an explicit transfer or registered archival owner for every existing view identity.');
      }
    }
    const transferred = new Set<string>();
    for (const transfer of plan.stateTransfer) {
      if (transferred.has(transfer.fromNode)) return fail('state-transfer', 'A view identity cannot be transferred twice.');
      transferred.add(transfer.fromNode);
      const from = old.value.nodes.find(n => n.id === transfer.fromNode); const to = nodeById.get(transfer.toNode);
      if (from === undefined || to === undefined) return fail('state-transfer', 'The state transfer endpoint is unavailable.');
      const identity = from.id === to.id && from.role === to.role && versionKey(from.representation) === versionKey(to.representation)
        && transfer.mapping.id === 'aeliqo.state.identity' && transfer.mapping.revision === '1';
      const registered = stateMappingFor(from, to, registry, context, nodeById.has(from.id) ? 'transfer' : 'archive');
      if (!identity && (registered === undefined || versionKey(registered.ref) !== versionKey(transfer.mapping)
        || (registered.kind === 'transfer' && from.id !== to.id)))
        return fail('state-transfer', 'This state transfer has no exact registered renderer capability.');
    }
  } else if (plan.stateTransfer.length) return fail('state-transfer', 'State transfer requires an existing presentation.');
  const graphInput = {nodes: resolved.map(n => ({id: n.node.id, ports: n.config.ports})), links: plan.links};
  let graph: Outcome<InteractionGraph>;
  if (plan.links.length === 0) graph = {ok: true, value: freezePresentation({nodes: graphInput.nodes, links: [], mappings: []})};
  else {
    const graphKey = canonicalJSON(graphInput);
    const cachedGraph = preparedCache.value.presentationGraphs.get(graphKey);
    graph = cachedGraph ?? validateInteractionGraph(graphInput, registry.mappings);
    if (cachedGraph === undefined) preparedCache.value.presentationGraphs.set(graphKey, graph);
  }
  if (!graph.ok) return graph;
  const finalPlan = Object.freeze({...plan, nodes: Object.freeze(resolved.map(n => n.node))}) as PresentationPlan;
  if (options.requiredPattern !== undefined && (!patternIsAllowed(options.requiredPattern, c) || !matchesPattern(finalPlan, prepared.value, registry, options.requiredPattern)))
    return fail('pattern-required', 'The candidate does not match its allowed registered pattern.');
  if (!c.allowWithoutPreset && !matchesPattern(finalPlan, prepared.value, registry))
    return fail('pattern-required', 'This presentation requires an allowed registered pattern match.');
  return {ok: true, value: freezePresentation({plan: finalPlan, nodes: resolved, graph: graph.value, environment: prepared.value.environment})};
}
