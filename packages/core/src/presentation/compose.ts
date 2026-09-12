import {stateMappingFor} from './state.js';
import * as z from 'zod/mini';
import {parseInspectedContract} from '../contracts/parse.js';
import {inspectWire} from '../contracts/ingress.js';
import {
  commitPreconditionsSchema, diagnosticSchema, idSchema, interactionLinkSchema, jsonSchema, presentationCoverageSchema,
  presentationNodeSchema, presentationStateTransferSchema, revisionSchema,
} from '../contracts/schemas.js';
import {WIRE_LIMITS} from '../contracts/limits.js';
import {validateCommitReadSet} from '../contracts/commit.js';
import type {Diagnostic, Outcome, PresentationPlan, Result, Task, VersionRef} from '../contracts/types.js';
import type {
  PresentationComposition, PresentationCompositionRequest, PresentationManifest, PresentationPatternManifest, PresentationRegistry,
  PresentationValues, ValidatedPresentation, ResolvedPresentationNode,
} from './types.js';
import {freezePresentation, freezePresentationContainer, isThenable, presentationFailure as fail, versionKey} from './registry.js';
import {preparePresentationContext, preparePresentationRegistry, preparePresentationValidationCache, validatePreparedPresentationPlan, type PresentationValidationOptions, type PreparedPresentationContext} from './validate.js';

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const stateIdentity = {id: 'aeliqo.state.identity', revision: '1'} as const;
const suggestionSchema = z.record(z.string(), jsonSchema);
type CanonicalCache = WeakMap<object, string>;
const inspectedPlanEnvelopeSchema = z.strictObject({
  id: idSchema, revision: revisionSchema, rootId: idSchema, preconditions: z.unknown(),
  nodes: z.array(z.unknown()).check(z.maxLength(WIRE_LIMITS.presentationNodes)),
  links: z.array(z.unknown()).check(z.maxLength(WIRE_LIMITS.links)),
  coverage: z.array(z.unknown()).check(z.maxLength(WIRE_LIMITS.array)),
  stateTransfer: z.array(z.unknown()).check(z.maxLength(WIRE_LIMITS.array)),
  diagnostics: z.array(z.unknown()).check(z.maxLength(WIRE_LIMITS.diagnostics)),
});

interface PresentationParseCache {
  readonly preconditions: WeakMap<object, z.infer<typeof commitPreconditionsSchema>>;
  readonly nodes: WeakMap<object, z.infer<typeof presentationNodeSchema>>;
  readonly links: WeakMap<object, z.infer<typeof interactionLinkSchema>>;
  readonly coverage: WeakMap<object, z.infer<typeof presentationCoverageSchema>>;
  readonly stateTransfer: WeakMap<object, z.infer<typeof presentationStateTransferSchema>>;
  readonly diagnostics: WeakMap<object, z.infer<typeof diagnosticSchema>>;
  readonly nodeArrays: WeakMap<object, readonly z.infer<typeof presentationNodeSchema>[]>;
  readonly linkArrays: WeakMap<object, readonly z.infer<typeof interactionLinkSchema>[]>;
  readonly coverageArrays: WeakMap<object, readonly z.infer<typeof presentationCoverageSchema>[]>;
  readonly stateTransferArrays: WeakMap<object, readonly z.infer<typeof presentationStateTransferSchema>[]>;
  readonly diagnosticArrays: WeakMap<object, readonly z.infer<typeof diagnosticSchema>[]>;
}

function createPresentationParseCache(): PresentationParseCache {
  return {preconditions: new WeakMap(), nodes: new WeakMap(), links: new WeakMap(), coverage: new WeakMap(), stateTransfer: new WeakMap(), diagnostics: new WeakMap(),
    nodeArrays: new WeakMap(), linkArrays: new WeakMap(), coverageArrays: new WeakMap(), stateTransferArrays: new WeakMap(), diagnosticArrays: new WeakMap()};
}

function parseCachedObject<S extends z.ZodMiniType>(input: unknown, schema: S, cache: WeakMap<object, z.infer<S>>): z.infer<S> | undefined {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const cached = cache.get(input);
  if (cached !== undefined) return cached;
  const parsed = z.safeParse(schema, input);
  if (!parsed.success) return undefined;
  const value = freezePresentation(parsed.data);
  cache.set(input, value);
  return value;
}

function parseCachedArray<S extends z.ZodMiniType>(input: unknown, schema: S, maximum: number, cache: WeakMap<object, z.infer<S>>,
  arrayCache: WeakMap<object, readonly z.infer<S>[]>): readonly z.infer<S>[] | undefined {
  if (!Array.isArray(input) || input.length > maximum) return undefined;
  const cached = arrayCache.get(input);
  if (cached !== undefined) return cached;
  const output: z.infer<S>[] = [];
  for (const item of input) {
    const parsed = parseCachedObject(item, schema, cache);
    if (parsed === undefined) return undefined;
    output.push(parsed);
  }
  const value = freezePresentationContainer(output) as readonly z.infer<S>[];
  arrayCache.set(input, value);
  return value;
}

/**
 * Parse a plan after the containing candidate list has passed inspectWire.
 * Shared fragments are memoized only for this synchronous composition; this
 * never trusts an uninspected object or carries authority across invocations.
 */
function parseInspectedPresentationPlan(input: unknown, cache: PresentationParseCache): Outcome<PresentationPlan> {
  const envelope = z.safeParse(inspectedPlanEnvelopeSchema, input);
  if (!envelope.success) {
    const fallback = parseInspectedContract('presentation-plan', input);
    return fallback.ok ? {ok: true, value: freezePresentation(fallback.value)} : fallback;
  }
  const raw = input as Record<string, unknown>;
  const preconditions = parseCachedObject(raw.preconditions, commitPreconditionsSchema, cache.preconditions);
  const nodes = parseCachedArray(raw.nodes, presentationNodeSchema, WIRE_LIMITS.presentationNodes, cache.nodes, cache.nodeArrays);
  const links = parseCachedArray(raw.links, interactionLinkSchema, WIRE_LIMITS.links, cache.links, cache.linkArrays);
  const coverage = parseCachedArray(raw.coverage, presentationCoverageSchema, WIRE_LIMITS.array, cache.coverage, cache.coverageArrays);
  const stateTransfer = parseCachedArray(raw.stateTransfer, presentationStateTransferSchema, WIRE_LIMITS.array, cache.stateTransfer, cache.stateTransferArrays);
  const diagnostics = parseCachedArray(raw.diagnostics, diagnosticSchema, WIRE_LIMITS.diagnostics, cache.diagnostics, cache.diagnosticArrays);
  if (preconditions === undefined || nodes === undefined || links === undefined || coverage === undefined || stateTransfer === undefined || diagnostics === undefined)
    return parseInspectedContract('presentation-plan', input);
  return {ok: true, value: freezePresentationContainer({id: envelope.data.id, revision: envelope.data.revision, rootId: envelope.data.rootId,
    preconditions, nodes, links, coverage, stateTransfer, diagnostics}) as PresentationPlan};
}

function normalizePlan(input: unknown, id: string, revision: string, preconditions: unknown, alreadyInspected: boolean, cache: PresentationParseCache): Outcome<PresentationPlan> {
  const wire = alreadyInspected ? {ok: true as const, value: input} : inspectWire(input);
  if (!wire.ok) return wire;
  if (wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value))
    return fail('candidate', 'A presentation candidate must be a plan object.');
  const normalized = {...wire.value as Record<string, unknown>, id, revision, preconditions};
  const reparsed = parseInspectedPresentationPlan(normalized, cache);
  return reparsed;
}

function callbackValue(raw: unknown, code: string, message: string): Outcome<unknown> {
  if (isThenable(raw)) return fail(code, message);
  const wire = inspectWire(raw);
  if (!wire.ok) return wire;
  const outcome = wire.value as {ok?: unknown; value?: unknown};
  if (outcome === null || typeof outcome !== 'object' || outcome.ok !== true || !Object.hasOwn(outcome, 'value')) return fail(code, message);
  return {ok: true, value: outcome.value};
}

function canonical(value: unknown, cache?: CanonicalCache): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const cached = cache?.get(value);
  if (cached !== undefined) return cached;
  const serialized = Array.isArray(value)
    ? `[${value.map(item => canonical(item, cache)).join(',')}]`
    : `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], cache)}`).join(',')}}`;
  cache?.set(value, serialized);
  return serialized;
}

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return versionKey(left) === versionKey(right);
}

function planTopology(plan: PresentationPlan): string {
  return canonical(plan.nodes.map(node => [node.id, node.role, node.children]).sort((a, b) => compareText(String(a[0]), String(b[0]))));
}

function planVariants(plan: PresentationPlan): string {
  return canonical(plan.nodes.map(node => [node.id, versionKey(node.representation)]).sort());
}

function planConfigurations(plan: PresentationPlan): string {
  return canonical(plan.nodes.map(node => [node.id, node.config]).sort());
}

function planSemantics(plan: PresentationPlan): string {
  return canonical([plan.links, plan.coverage, plan.nodes.map(node => [node.id, node.result]).sort()]);
}

function changePenalty(candidate: PresentationPlan, incumbent: PresentationPlan | undefined): number {
  if (incumbent === undefined) return 0;
  let penalty = 0;
  if (planTopology(candidate) !== planTopology(incumbent)) penalty += 80;
  if (planVariants(candidate) !== planVariants(incumbent)) penalty += 80;
  if (planConfigurations(candidate) !== planConfigurations(incumbent)) penalty += 20;
  if (planSemantics(candidate) !== planSemantics(incumbent)) penalty += 20;
  return penalty;
}

function candidateScore(
  presentation: ValidatedPresentation,
  prepared: PreparedPresentationContext,
  incumbent: PresentationPlan | undefined,
): number {
  let score = 0;
  for (const node of presentation.nodes) {
    const quality = node.quality;
    if (quality === undefined) continue;
    score += quality.taskFit * 100;
    score += quality.informationDensity * 25;
    score -= quality.interactionEffort * 20;
    score -= quality.legibilityPenalty * 20;
    if (quality.cost !== undefined) score -= Math.min(100, Math.floor(quality.cost.microseconds / 1_000_000)) * 5;
  }
  if (prepared.constraints.preferredRepresentation !== undefined && presentation.nodes.some(node => node.manifest.id === prepared.constraints.preferredRepresentation)) score += 150;
  const optionalCovered = prepared.constraints.taskNeeds.filter(need => !need.required && presentation.plan.coverage.some(entry => entry.needId === need.id)).length;
  score += optionalCovered * 10;
  score -= changePenalty(presentation.plan, incumbent);
  return score;
}

interface RankedCandidate {
  readonly presentation: ValidatedPresentation;
  readonly score: number;
  readonly tie: string;
  readonly incumbent: boolean;
}

function betterCandidate(next: RankedCandidate, current: RankedCandidate | undefined): boolean {
  if (current === undefined) return true;
  if (next.score !== current.score) return next.score > current.score;
  if (next.incumbent !== current.incumbent) return next.incumbent;
  return next.tie < current.tie;
}

function validPattern(
  candidate: {readonly source: 'explicit' | 'pattern'; readonly pattern?: VersionRef; readonly plan: PresentationPlan},
  patterns: readonly PresentationPatternManifest[],
  prepared: PreparedPresentationContext,
): Outcome<PresentationPatternManifest | undefined> {
  if (candidate.source !== 'pattern') return {ok: true, value: undefined};
  const patternRef = candidate.pattern;
  if (patternRef === undefined) return fail('pattern-required', 'A pattern candidate must identify its registered pattern.');
  const pattern = patterns.find(item => sameRef(item.ref, patternRef));
  if (pattern === undefined || !prepared.constraints.allowedPatterns.includes(pattern.ref.id))
    return fail('pattern-required', 'The candidate pattern is not allowed by the active experience.');
  return {ok: true, value: pattern};
}

function stableNodeId(
  need: Task['needs'][number],
  role: string,
  _representation: VersionRef,
  used: Set<string>,
  context: PresentationCompositionRequest['context'],
): string {
  const coverage = context.incumbent?.coverage.find(entry => entry.needId === need.id);
  const existing = coverage?.nodeIds.find(id => {
    const node = context.incumbent?.nodes.find(candidate => candidate.id === id);
    return node !== undefined && node.role === role && !used.has(id);
  });
  if (existing !== undefined) { used.add(existing); return existing; }
  const base = `view.${need.id}`;
  if (!used.has(base)) { used.add(base); return base; }
  let index = 2;
  while (used.has(`${base}.${index}`)) index++;
  const id = `${base}.${index}`; used.add(id); return id;
}

function stableRootId(
  role: string,
  _representation: VersionRef,
  used: Set<string>,
  context: PresentationCompositionRequest['context'],
): string {
  const currentRoot = context.incumbent?.nodes.find(node => node.id === context.incumbent?.rootId);
  if (currentRoot !== undefined && currentRoot.role === role && !used.has(currentRoot.id)) {
    used.add(currentRoot.id); return currentRoot.id;
  }
  const base = 'layout';
  if (!used.has(base)) { used.add(base); return base; }
  let index = 2;
  while (used.has(`${base}.${index}`)) index++;
  const id = `${base}.${index}`; used.add(id); return id;
}

function transfersFor(
  nodes: readonly PresentationPlan['nodes'][number][],
  incumbent: PresentationPlan | undefined, registry: PresentationRegistry, context: PresentationCompositionRequest['context'], rootId: string,
): PresentationPlan['stateTransfer'] {
  if (incumbent === undefined) return [];
  const next = new Map(nodes.map(node => [node.id, node]));
  return incumbent.nodes.flatMap(previous => {
    const candidate = next.get(previous.id);
    if (candidate !== undefined && candidate.role === previous.role && sameRef(candidate.representation, previous.representation))
      return [{fromNode: previous.id, toNode: previous.id, mapping: stateIdentity}];
    const target = candidate ?? next.get(rootId);
    if (target === undefined) return [];
    const mapping = stateMappingFor(previous, target, registry, context, candidate === undefined ? 'archive' : 'transfer');
    return mapping === undefined ? [] : [{fromNode: previous.id, toNode: target.id, mapping: mapping.ref}];
  });
}

function buildPlan(
  request: PresentationCompositionRequest,
  prepared: PreparedPresentationContext,
  registry: PresentationRegistry,
  layout: PresentationManifest | undefined,
  selected: readonly PresentationManifest[],
  suggest: (manifest: PresentationManifest, needs: readonly Task['needs'][number][], result: Result | undefined) => Outcome<PresentationValues>,
): Outcome<PresentationPlan> {
  const required = prepared.constraints.taskNeeds.filter(need => need.required);
  const used = new Set<string>();
  const descriptors = prepared.results;
  const resultFor = (need: Task['needs'][number]): Result | undefined => {
    if (need.outputId === undefined) return undefined;
    return descriptors.find(result => result.ref.outputId === need.outputId);
  };
  const nodes: PresentationPlan['nodes'][number][] = [];
  for (let index = 0; index < required.length; index++) {
    const need = required[index]!;
    const manifest = selected[index];
    if (manifest === undefined) return fail('suggestion', 'The bounded composition did not provide a representation for every required need.');
    const result = resultFor(need);
    if (manifest.result === 'required' && result === undefined) return fail('suggestion', 'A required-result representation has no exact task output.');
    const values = suggest(manifest, [need], result);
    if (!values.ok) return values;
    const nodeId = stableNodeId(need, manifest.roles[0]!, manifest.ref, used, request.context);
    nodes.push({id: nodeId, role: manifest.roles[0]!, representation: manifest.ref, ...(result === undefined ? {} : {result: result.ref}),
      config: {schema: manifest.configSchema, values: values.value}, children: []});
  }
  if (layout === undefined && nodes.length !== 1) return fail('suggestion', 'A single leaf is required when no layout manifest is selected.');
  let rootId: string;
  if (layout === undefined) rootId = nodes[0]!.id;
  else {
    const values = suggest(layout, [], undefined);
    if (!values.ok) return values;
    rootId = stableRootId(layout.roles[0]!, layout.ref, used, request.context);
    nodes.unshift({id: rootId, role: layout.roles[0]!, representation: layout.ref, config: {schema: layout.configSchema, values: values.value}, children: nodes.map(node => node.id)});
  }
  return {ok: true, value: {
    id: request.id, revision: request.revision, rootId, preconditions: request.preconditions,
    nodes, links: [], coverage: required.map((need, index) => ({needId: need.id, nodeIds: [nodes[layout === undefined ? index : index + 1]!.id], operations: [need.operation]})),
    stateTransfer: transfersFor(nodes, request.context.incumbent, registry, request.context, rootId), diagnostics: [],
  }};
}

/** Bounded deterministic composition. Every candidate still passes the shared feasibility validator. */
export function composePresentation(request: PresentationCompositionRequest, registry: PresentationRegistry): Outcome<PresentationComposition> {
  const identity = z.safeParse(z.strictObject({id: idSchema, revision: revisionSchema}), {id: request.id, revision: request.revision});
  if (!identity.success) return fail('request', 'The composition identity is invalid.');
  const requestPins = validateCommitReadSet(request.preconditions, request.context.current);
  if (!requestPins.ok) return requestPins;
  const prepared = preparePresentationContext(request.context);
  if (!prepared.ok) return prepared;
  const constraints = prepared.value.constraints;
  const preparedManifests = preparePresentationRegistry(registry);
  if (!preparedManifests.ok) return preparedManifests;
  const validationCache = preparePresentationValidationCache(prepared.value, registry, preparedManifests.value);
  if (!validationCache.ok) return validationCache;
  // Pure registered node resolutions may be reused only inside this synchronous
  // composition; no validation/authority cache survives a subsequent invocation.
  const nodeMemo = new Map<string, ResolvedPresentationNode>();
  const nodeIdentityMemo = new WeakMap<object, ResolvedPresentationNode>();
  const canonicalCache: CanonicalCache = new WeakMap();
  const parseCache = createPresentationParseCache();
  if (constraints.task.revision !== requestPins.value.taskRevision || constraints.task.catalogRevision !== requestPins.value.catalogRevision
    || constraints.task.functionRegistryDigest !== requestPins.value.functionRegistryDigest || constraints.experience.revision !== requestPins.value.experienceRevision)
    return fail('stale', 'The task or experience differs from the current version pins.');
  if (request.candidates !== undefined) {
    const candidatesWire = inspectWire(request.candidates);
    if (!candidatesWire.ok) return candidatesWire;
    if (!Array.isArray(candidatesWire.value) || candidatesWire.value.length > 64)
      return fail('candidate-budget', 'The proposed complete candidate list exceeds the input budget.');
  }
  const rejected: {candidate: string; diagnostics: readonly Diagnostic[]}[] = [];
  let expansions = 0;
  let budgetBlocked = false;
  let best: RankedCandidate | undefined;
  const spend = (): boolean => {
    if (expansions >= constraints.maxExpansions) { budgetBlocked = true; return false; }
    expansions++;
    return true;
  };
  const reject = (candidate: string, diagnostics: readonly Diagnostic[]) => rejected.push({candidate, diagnostics});
  const consider = (presentation: ValidatedPresentation, candidateIsIncumbent: boolean): void => {
    const rank: RankedCandidate = {presentation, score: candidateScore(presentation, prepared.value, request.context.incumbent),
      tie: canonical(presentation.plan, canonicalCache), incumbent: candidateIsIncumbent};
    if (betterCandidate(rank, best)) best = rank;
  };
  const validateCandidate = (input: unknown, label: string, options: PresentationValidationOptions = {}, candidateIsIncumbent = false, expansionReserved = false, alreadyInspected = false): boolean => {
    if (!expansionReserved && !spend()) return false;
    const normalized = normalizePlan(input, identity.data.id, identity.data.revision, requestPins.value, alreadyInspected, parseCache);
    if (!normalized.ok) { reject(label, normalized.diagnostics); return false; }
    const checked = validatePreparedPresentationPlan(normalized.value, request.context, registry, prepared.value, options, nodeMemo, nodeIdentityMemo, preparedManifests.value, validationCache.value, true);
    if (!checked.ok) { reject(label, checked.diagnostics); return false; }
    consider(checked.value, candidateIsIncumbent);
    return true;
  };
  if (request.context.incumbent !== undefined) validateCandidate({...request.context.incumbent, stateTransfer: []}, 'incumbent', {}, true);

  const patterns = registry.patterns ?? [];
  const patternContext = prepared.value.patternContext;
  const candidates = request.candidates ?? [];
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!;
    if (candidate === null || typeof candidate !== 'object' || (candidate.source !== 'explicit' && candidate.source !== 'pattern')) {
      reject(`candidate.${index}`, [{code: 'presentation.candidate', message: 'The candidate source is invalid.', retryable: false}]);
      continue;
    }
    const pattern = validPattern(candidate, patterns, prepared.value);
    if (!pattern.ok) { reject(`candidate.${index}`, pattern.diagnostics); continue; }
    if (candidate.source === 'pattern') {
      if (!spend()) break;
      let expanded: unknown;
      try {
        expanded = pattern.value!.expand({id: identity.data.id, revision: identity.data.revision, preconditions: requestPins.value, context: patternContext});
      } catch { reject(`pattern.${candidate.pattern!.id}`, [{code: 'presentation.pattern', message: 'The registered pattern expander failed.', retryable: false}]); continue; }
      const expansion = callbackValue(expanded, 'pattern', 'The registered pattern expander failed.');
      if (!expansion.ok) { reject(`pattern.${candidate.pattern!.id}`, expansion.diagnostics); continue; }
      const selectedPattern = pattern.value;
      if (selectedPattern === undefined) { reject(`pattern.${candidate.pattern!.id}`, [{code: 'presentation.pattern', message: 'The registered pattern is unavailable.', retryable: false}]); continue; }
      validateCandidate(expansion.value, `pattern.${candidate.pattern!.id}`, {requiredPattern: selectedPattern}, false, true, true);
    } else validateCandidate(candidate.plan, `candidate.${index}`, {}, false, false, true);
    if (budgetBlocked) break;
  }
  const required = constraints.taskNeeds.filter(need => need.required);
  for (const need of required) {
    if (need.outputId !== undefined && prepared.value.results.filter(result => result.ref.outputId === need.outputId).length > 1)
      return fail('ambiguous-result', 'Several result revisions match a named output; select an exact authorized descriptor before composing.');
  }
  // Explicit candidates consumed the complete bounded search. Finalize the
  // incumbent without preparing a registered fallback that cannot be tried.
  if (expansions >= constraints.maxExpansions) {
    if (best === undefined) return {ok: true, value: freezePresentation({status: 'search-exhausted', expansions, rejected})};
    return {ok: true, value: freezePresentation({status: 'search-exhausted', presentation: best.presentation, expansions, rejected})};
  }
  const allowed = registry.manifests.filter(manifest => constraints.allowedRepresentations.includes(manifest.ref.id)
    && contextHasRenderer(request.context.rendererCapabilities, manifest.ref)
    && manifest.suggestConfig !== undefined
    && (!manifest.extension || constraints.extensionAllowlist.some(ref => sameRef(ref, manifest.ref))))
    .sort((a, b) => compareText(versionKey(a.ref), versionKey(b.ref)));
  const choices = required.map(need => allowed.filter(manifest => manifest.visibility === 'leaf' && manifest.children.min === 0
    && manifest.operations.some(op => sameRef(op, need.operation)) && (need.outputId === undefined ? manifest.result !== 'required' : manifest.result !== 'none')));
  const layouts = allowed.filter(manifest => manifest.result === 'none' && manifest.visibility === 'simultaneous'
    && manifest.children.min <= required.length && manifest.children.max >= required.length);
  const suggest = (manifest: PresentationManifest, needs: readonly Task['needs'][number][], result: Result | undefined): Outcome<PresentationValues> => {
    if (manifest.suggestConfig === undefined) return fail('suggestion', 'The representation has no trusted bounded suggestion.');
    let raw: unknown;
    try { raw = manifest.suggestConfig(needs, result); } catch { return fail('suggestion', 'The registered configuration suggestion failed.'); }
    const outcome = callbackValue(raw, 'suggestion', 'The registered configuration suggestion failed.');
    if (!outcome.ok) return outcome;
    const parsed = z.safeParse(suggestionSchema, outcome.value);
    if (!parsed.success) return fail('suggestion', 'The registered configuration suggestion is not bounded JSON configuration.');
    return {ok: true, value: freezePresentation(parsed.data as PresentationValues)};
  };
  const tryBuild = (layout: PresentationManifest | undefined, selected: readonly PresentationManifest[], label: string): boolean => {
    if (!spend()) return false;
    const built = buildPlan(request, prepared.value, registry, layout, selected, suggest);
    if (!built.ok) { reject(label, built.diagnostics); return false; }
    return validateCandidate(built.value, label, {}, false, true, true);
  };
  if (!budgetBlocked && required.length === 0) {
    const emptyRoots = allowed.filter(manifest => manifest.result !== 'required' && manifest.children.min === 0);
    for (const root of emptyRoots) {
      tryBuild(root, [], `registered.queryless.${root.ref.id}`);
      if (budgetBlocked) break;
    }
    if (emptyRoots.length === 0) reject('registered-queryless', [{code: 'presentation.no-suggestion', message: 'No queryless root suggestion is registered.', retryable: false}]);
  } else if (!budgetBlocked && required.length === 1 && choices[0]!.length > 0) {
    for (const leaf of choices[0]!) {
      tryBuild(undefined, [leaf], `registered.leaf.${leaf.ref.id}`);
      if (budgetBlocked) break;
    }
  } else if (!budgetBlocked && required.length > 1 && layouts.length > 0 && choices.every(list => list.length > 0)) {
    // Enumerate complete assignments lazily. Never allocate the Cartesian product;
    // every attempted assignment is bounded by the same expansion counter.
    const indices = choices.map(() => 0);
    let layoutIndex = 0;
    let candidateIndex = 0;
    while (layoutIndex < layouts.length) {
      tryBuild(layouts[layoutIndex]!, choices.map((list, index) => list[indices[index]!]!), `registered.${candidateIndex++}`);
      if (budgetBlocked) break;
      let position = indices.length - 1;
      while (position >= 0 && indices[position]! + 1 >= choices[position]!.length) { indices[position] = 0; position--; }
      if (position >= 0) indices[position] = indices[position]! + 1;
      else layoutIndex++;
    }
  } else if (!budgetBlocked) {
    reject('registered-composition', [{code: 'presentation.no-suggestion', message: 'No complete suggestion is available from the installed registry. Explicit registered configurations may still be feasible.', retryable: false}]);
  }
  if (best === undefined) return {ok: true, value: freezePresentation({status: budgetBlocked ? 'search-exhausted' : 'conflict', expansions, rejected})};
  return {ok: true, value: freezePresentation({status: budgetBlocked ? 'search-exhausted' : 'composed', presentation: best.presentation, expansions, rejected})};
}

function contextHasRenderer(capabilities: readonly VersionRef[], ref: VersionRef): boolean {
  try { return capabilities.some(candidate => sameRef(candidate, ref)); } catch { return false; }
}
