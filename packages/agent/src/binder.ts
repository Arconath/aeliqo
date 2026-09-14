import {
  CONTRACT_VERSION,
  WIRE_LIMITS,
  createQueryPlanner,
  parseContract,
  parseWireValue,
  validateCommitReadSet,
  validateTaskStructure,
  type AgentBindingOutcome,
  type AgentTaskProposal,
  type Catalog,
  type CommitPreconditions,
  type Diagnostic,
  type OperationGrant,
  type Outcome,
  type QueryPlanner,
  type QueryLimits,
  type ResultRef,
  type Task,
} from '@aeliqo/core';
import type {
  AgentBindOptions,
  AgentBinder,
  AgentBinderOptions,
  AgentBindingDecision,
  AgentHostContext,
} from './binder-types.js';

type BindingFailureState = Extract<AgentBindingOutcome, {readonly state: 'unsupported' | 'denied' | 'invalid' | 'stale'}>['state'];
const ABORTED = Symbol('agent-host-aborted');

interface NormalizedHostContext extends AgentHostContext {
  readonly catalog: Catalog;
  readonly current: CommitPreconditions;
  readonly planner: QueryPlanner;
}

interface ValidatedProposal {
  readonly proposal: AgentTaskProposal;
  readonly task: Task;
  readonly structure: ReturnType<typeof validateTaskStructure> extends Outcome<infer T> ? T : never;
  readonly context: NormalizedHostContext;
  readonly plans: readonly {readonly outputId: string; readonly canonical: string; readonly planKey: string}[];
}

interface InspectionFailure {
  readonly ok: false;
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
  /** A typed state selected by the binder, when this was not a generic failure. */
  readonly state?: AgentBindingOutcome;
}

type Inspection = {readonly ok: true; readonly value: ValidatedProposal} | InspectionFailure;

const GRANT_TASK_PROPOSE: OperationGrant = 'task.propose';
const GRANT_CATALOG_READ: OperationGrant = 'catalog.read';
const GRANT_RESULT_INSPECT: OperationGrant = 'result.inspect';

function diagnostic(
  code: string,
  message: string,
  path?: readonly (string | number)[],
  retryable = false,
  remedies?: readonly string[],
): Diagnostic {
  return {
    code,
    message,
    retryable,
    ...(path === undefined || path.length === 0 ? {} : {path: [...path]}),
    ...(remedies === undefined || remedies.length === 0 ? {} : {remedies: [...remedies]}),
  };
}

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [diagnostic(code, message, path)]};
}

function validId(value: unknown, limit = WIRE_LIMITS.id): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.text;
}

function sameResultRef(left: ResultRef, right: ResultRef): boolean {
  return left.id === right.id && left.revision === right.revision && left.outputId === right.outputId
    && left.queryDigest === right.queryDigest && left.scopeDigest === right.scopeDigest;
}

function samePath(left: readonly (string | number)[] | undefined, right: readonly (string | number)[] | undefined): boolean {
  if (left === undefined || left.length === 0) return right === undefined || right.length === 0;
  if (right === undefined || left.length !== right.length) return false;
  return left.every((part, index) => part === right[index]);
}

function hasGrant(context: AgentHostContext, grant: OperationGrant): boolean {
  return context.grants.includes(grant);
}

function stateOutcome(state: BindingFailureState, diagnostics: readonly Diagnostic[]): Outcome<AgentBindingOutcome> {
  const checked = parseContract('binding-outcome', {
    state,
    diagnostics: diagnostics.length === 0 ? [diagnostic('agent.failure', 'The proposal could not be bound.')] : diagnostics,
  });
  if (checked.ok) return checked;
  return failure('agent.internal', 'The runtime produced an invalid binding diagnostic.');
}

function inspectionState(outcome: Outcome<AgentBindingOutcome>): InspectionFailure {
  if (!outcome.ok) return {ok: false, diagnostics: outcome.diagnostics};
  return {ok: false, diagnostics: [diagnostic('agent.internal', 'The binding state was unexpectedly successful.')], state: outcome.value};
}

function boundOutcome(task: Task): Outcome<AgentBindingOutcome> {
  const checked = parseContract('binding-outcome', {
    state: 'bound',
    value: task,
    interpretation: 'Task structure and supported query semantics are bound; no effect was executed.',
    assumptions: ['Business intent remains a residual application risk.', 'Evaluation and presentation are separate authorized operations.'],
  });
  if (checked.ok) return checked;
  return failure('agent.internal', 'The runtime produced an invalid bound Task.');
}

function decisionOutcome(
  decision: AgentBindingDecision,
): Outcome<AgentBindingOutcome> {
  if (decision.state === 'needs-choice') {
    const checked = parseContract('binding-outcome', {
      state: 'needs-choice',
      choices: decision.choices,
    });
    if (checked.ok) return checked;
  } else {
    const checked = parseContract('binding-outcome', {
      state: 'needs-meaning',
      concept: decision.concept,
      authoringRoutes: decision.authoringRoutes,
    });
    if (checked.ok) return checked;
  }
  return stateOutcome('invalid', [diagnostic('agent.host-decision', 'The host binding decision is malformed.')]);
}

function decisionFor(
  item: Diagnostic,
  context: NormalizedHostContext,
): AgentBindingDecision | undefined {
  if (context.decisions === undefined) return undefined;
  return context.decisions.find((candidate) =>
    candidate.scope === 'diagnostic'
      && candidate.goalEpoch === context.goalEpoch
      && candidate.diagnosticCode === item.code
      && samePath(candidate.diagnosticPath, item.path));
}

/** A host decision may represent a goal-wide material ambiguity even when
 * the candidate's individual query is structurally and semantically valid.
 * The goal epoch is the authority key; model task IDs are intentionally not
 * consulted here. */
function goalDecision(context: NormalizedHostContext): AgentBindingDecision | undefined {
  return context.decisions?.find((candidate) => candidate.scope === 'goal' && candidate.goalEpoch === context.goalEpoch);
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function digest(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `agent-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizedTask(task: Task): unknown {
  // requestId/targetRegionId belong to the proposal envelope and are not
  // semantic identity. Task data itself is retained in canonical key order.
  return task;
}

function taskFingerprint(
  task: Task,
  context: NormalizedHostContext,
  plans: readonly {readonly outputId: string; readonly canonical: string; readonly planKey: string}[] = [],
): string {
  return digest(canonical({
    version: CONTRACT_VERSION,
    task: normalizedTask(task),
    authority: {
      principalKey: context.principalKey,
      scopeDigest: context.current.scopeDigest,
      policyRevision: context.current.policyRevision,
      catalogRevision: context.current.catalogRevision,
      experienceRevision: context.current.experienceRevision,
      functionRegistryDigest: context.current.functionRegistryDigest,
      regionId: context.regionId,
      regionRevision: context.current.regionRevision,
      results: context.current.results,
      goalEpoch: context.goalEpoch,
      grants: [...context.grants].sort(),
      decisions: context.decisions,
      queryLimits: context.planner.limits,
      catalog: context.catalog,
      functionRegistry: context.functionRegistry,
    },
    plans,
  }));
}

function candidateFingerprint(input: unknown): string {
  const wire = parseWireValue(input);
  if (wire.ok) return digest(canonical(wire.value));
  try {
    return digest(`invalid:${String(input)}`);
  } catch {
    return digest('invalid:candidate');
  }
}

function normalizeDecision(input: unknown): AgentBindingDecision | undefined {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  if (record.state !== 'needs-choice' && record.state !== 'needs-meaning') return undefined;
  if (!validId(record.goalEpoch) || !validId(record.diagnosticCode) || (record.scope !== 'goal' && record.scope !== 'diagnostic')) return undefined;
  const path = record.diagnosticPath;
  if (path !== undefined && (!Array.isArray(path) || path.length > WIRE_LIMITS.depth || path.some((part) =>
    !(typeof part === 'string' ? validId(part) : Number.isSafeInteger(part) && part >= 0)))) return undefined;
  if (record.state === 'needs-choice') {
    if (!Array.isArray(record.choices) || record.choices.length === 0 || record.choices.length > WIRE_LIMITS.array) return undefined;
    const choices = record.choices.map((choice) => {
      if (choice === null || typeof choice !== 'object' || Array.isArray(choice)) return undefined;
      const value = choice as Record<string, unknown>;
      if (!validId(value.id) || !validText(value.label) || !validText(value.consequence)) return undefined;
      return Object.freeze({id: value.id, label: value.label, consequence: value.consequence});
    });
    if (choices.some((choice) => choice === undefined)) return undefined;
    return Object.freeze({state: 'needs-choice' as const, scope: record.scope as 'goal' | 'diagnostic', goalEpoch: record.goalEpoch, diagnosticCode: record.diagnosticCode,
      ...(path === undefined ? {} : {diagnosticPath: Object.freeze([...(path as readonly (string | number)[])])}), choices: Object.freeze(choices as AgentBindingDecision & {state: 'needs-choice'} extends never ? never : {id: string; label: string; consequence: string}[])}) as unknown as AgentBindingDecision;
  }
  if (!validText(record.concept) || !Array.isArray(record.authoringRoutes) || record.authoringRoutes.length > 2 ||
      record.authoringRoutes.some((route) => route !== 'ai-assisted' && route !== 'manual')) return undefined;
  return Object.freeze({state: 'needs-meaning' as const, scope: record.scope as 'goal' | 'diagnostic', goalEpoch: record.goalEpoch, diagnosticCode: record.diagnosticCode,
    ...(path === undefined ? {} : {diagnosticPath: Object.freeze([...(path as readonly (string | number)[])])}), concept: record.concept,
    authoringRoutes: Object.freeze([...(record.authoringRoutes as readonly ('ai-assisted' | 'manual')[])])});
}

function normalizeHost(value: AgentHostContext, queryLimits?: Partial<QueryLimits>): Outcome<NormalizedHostContext> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return failure('agent.denied', 'The host authority context is unavailable.');
    if (!validId(value.regionId) || !validId(value.goalEpoch) ||
        typeof value.principalKey !== 'string' || value.principalKey.length === 0 || value.principalKey.length > WIRE_LIMITS.id * 4 ||
        /[\u0000-\u001f\u007f]/u.test(value.principalKey)) return failure('agent.denied', 'The host authority context is malformed.');
    const catalog = parseContract('catalog', value.catalog);
    if (!catalog.ok) return failure('agent.denied', 'The host catalog is not a valid canonical descriptor.');
    const current = validateCommitReadSet(value.current, value.current);
    if (!current.ok) return failure('agent.denied', 'The host current preconditions are malformed.');
    const grants: OperationGrant[] = [];
    if (!Array.isArray(value.grants) || value.grants.length > WIRE_LIMITS.array) return failure('agent.denied', 'The host grant list is malformed.');
    for (const raw of value.grants) {
      // Enum contracts are wire JSON strings; passing the host's trusted
      // in-memory string directly would make inspectWire parse it as JSON
      // and reject every valid grant (e.g. `catalog.read`).
      const grant = parseContract('operation-grant', JSON.stringify(raw));
      if (!grant.ok) return failure('agent.denied', 'The host grant list is malformed.');
      if (!grants.includes(grant.value)) grants.push(grant.value);
    }
    if (current.value.catalogRevision !== catalog.value.revision || current.value.functionRegistryDigest !== value.functionRegistry.digest ||
        value.functionRegistry.digest !== catalog.value.functionRegistryDigest) return failure('agent.stale', 'The host catalog or function registry does not match the current pins.');
    const planner = createQueryPlanner({catalog: catalog.value, registry: value.functionRegistry, definitions: catalog.value.meanings,
      ...(queryLimits === undefined ? {} : {limits: queryLimits})});
    if (!planner.ok) return failure('agent.denied', 'The host query registry is unavailable for semantic validation.');
    let decisions: AgentBindingDecision[] | undefined;
    if (value.decisions !== undefined) {
      if (!Array.isArray(value.decisions) || value.decisions.length > WIRE_LIMITS.array) return failure('agent.denied', 'The host binding decisions are malformed.');
      decisions = [];
      for (const candidate of value.decisions) {
        const normalized = normalizeDecision(candidate);
        if (normalized === undefined) return failure('agent.denied', 'The host binding decisions are malformed.');
        if (normalized.goalEpoch !== value.goalEpoch) return failure('agent.stale-decisions', 'The host binding decision belongs to a different goal epoch.');
        decisions.push(normalized);
      }
    }
    return {ok: true, value: Object.freeze({
      principalKey: value.principalKey,
      regionId: value.regionId,
      goalEpoch: value.goalEpoch,
      current: current.value,
      catalog: catalog.value,
      functionRegistry: planner.value.registry,
      planner: planner.value,
      grants: Object.freeze(grants),
      ...(decisions === undefined ? {} : {decisions: Object.freeze(decisions)}),
    })};
  } catch {
    return failure('agent.denied', 'The host authority context could not be normalized safely.');
  }
}

/**
 * Authority data is host-owned and must be part of the accepted plan's
 * identity.  This key intentionally includes the grants, goal epoch,
 * decisions and planner limits that are easy to omit from a result-only
 * fingerprint.
 */
function authorityKey(context: NormalizedHostContext): string {
  return canonical({
    principalKey: context.principalKey,
    regionId: context.regionId,
    goalEpoch: context.goalEpoch,
    current: context.current,
    catalog: context.catalog,
    functionRegistry: context.functionRegistry,
    grants: [...context.grants].sort(),
    decisions: context.decisions,
    queryLimits: context.planner.limits,
  });
}

function validateRequiredResults(
  refs: readonly ResultRef[],
  context: NormalizedHostContext,
): Outcome<void> {
  const available = context.current.results;
  for (const ref of refs) {
    if (ref.scopeDigest !== context.current.scopeDigest || !available.some((candidate) => sameResultRef(candidate, ref)))
      return failure('agent.stale', 'A referenced result is no longer available in the current authority scope.');
  }
  return {ok: true, value: undefined};
}

function plannerFailure(
  result: Extract<ReturnType<QueryPlanner['plan']>, {readonly ok: false}>,
  context: NormalizedHostContext,
): InspectionFailure {
  const first = result.diagnostics[0];
  const decision = first === undefined ? undefined : decisionFor(first, context);
  if (decision !== undefined) return inspectionState(decisionOutcome(decision));
  if (first !== undefined && first.code.startsWith('query.stale')) return inspectionState(stateOutcome('stale', result.diagnostics));
  if (first !== undefined && (first.code === 'query.meaning' || first.code === 'query.unsupported' || first.code.startsWith('query.unsupported')))
    return inspectionState(stateOutcome('unsupported', result.diagnostics));
  return inspectionState(stateOutcome('invalid', result.diagnostics));
}

function validateTaskSemantics(
  proposal: AgentTaskProposal,
  task: Task,
  structure: ValidatedProposal['structure'],
  context: NormalizedHostContext,
): Inspection {
  if (task.regionId !== proposal.targetRegionId || task.regionId !== context.regionId)
    return inspectionState(stateOutcome('stale', [diagnostic('agent.stale-region', 'The Task region does not match the authorized target region.')])) ;
  if (task.revision !== context.current.taskRevision)
    return inspectionState(stateOutcome('stale', [diagnostic('agent.stale-task', 'The Task revision does not match the current host task revision.')])) ;
  if (task.catalogRevision !== context.current.catalogRevision || task.functionRegistryDigest !== context.current.functionRegistryDigest)
    return inspectionState(stateOutcome('stale', [diagnostic('agent.stale-pins', 'The Task catalog or function registry pin is stale.')])) ;
  const required = validateRequiredResults(structure.resultReferences, context);
  if (!required.ok) return inspectionState(stateOutcome('stale', required.diagnostics));
  if (structure.resultReferences.length > 0 && !hasGrant(context, GRANT_RESULT_INSPECT))
    return inspectionState(stateOutcome('denied', [diagnostic('agent.denied-result-inspect', 'The host did not grant result inspection for the referenced population.')])) ;
  if (task.kind === 'form') return inspectionState(stateOutcome('unsupported', [diagnostic('agent.form-unsupported', 'Form action binding is owned by the action and meaning dispatcher.')])) ;
  const plans: {outputId: string; canonical: string; planKey: string}[] = [];
  if (task.kind === 'data') {
    for (const output of task.outputs) {
      if (output.kind === 'reuse') continue;
      if (output.query.population.kind !== 'all-authorized')
        return inspectionState(stateOutcome('unsupported', [diagnostic('agent.population-unsupported', 'Fixed and live populations require an authorized result lineage and are not rewritten during binding.', ['outputs', output.id, 'query', 'population'])]));
      const planned = context.planner.plan(output.query);
      if (!planned.ok) return plannerFailure(planned, context);
      plans.push({outputId: output.id, canonical: planned.value.canonical, planKey: planned.value.planKey});
    }
  }
  return {ok: true, value: {proposal, task, structure, context, plans}};
}

export function createAgentBinder(options: AgentBinderOptions): AgentBinder {
  if (options === null || typeof options !== 'object' || options.host === null || typeof options.host?.readContext !== 'function')
    throw new TypeError('An agent host readContext callback is required.');
  let pending = 0;
  const requestedPending = options.maxPending;
  const maxPending = typeof requestedPending === 'number' && Number.isSafeInteger(requestedPending) && requestedPending > 0
    ? Math.min(64, requestedPending)
    : 8;

  /**
   * Race the host callback with cancellation.  A host is expected to honor
   * the signal, but releasing this binder slot does not depend on that
   * cooperation; late host promises are harmlessly ignored.
   */
  const readHost = async (
    proposal: AgentTaskProposal,
    signal: AbortSignal,
  ): Promise<Outcome<AgentHostContext>> => {
    if (signal.aborted) return failure('agent.cancelled', 'Agent binding was cancelled.');
    let removeAbort: (() => void) | undefined;
    let resolveAbort!: () => void;
    const aborted = new Promise<typeof ABORTED>((resolve) => { resolveAbort = () => resolve(ABORTED); });
    const onAbort = (): void => resolveAbort();
    signal.addEventListener('abort', onAbort, {once: true});
    removeAbort = () => signal.removeEventListener('abort', onAbort);
    const work = Promise.resolve().then(async (): Promise<Outcome<AgentHostContext> | typeof ABORTED | undefined> => {
      if (signal.aborted) return ABORTED;
      try {
        return await options.host.readContext({requestId: proposal.requestId, targetRegionId: proposal.targetRegionId, signal});
      } catch {
        return undefined;
      }
    });
    try {
      const result = await Promise.race([work, aborted]);
      if (result === ABORTED) return failure('agent.cancelled', 'Agent binding was cancelled.');
      if (result === undefined) return failure('agent.denied', 'The host authority context failed safely.');
      return result;
    } finally {
      removeAbort();
    }
  };

  const inspect = async (input: unknown, bindOptions: AgentBindOptions = {}): Promise<Inspection> => {
    const parsed = parseContract('task-proposal', input);
    if (!parsed.ok) return parsed;
    if (bindOptions.signal?.aborted) return failure('agent.cancelled', 'Agent binding was cancelled.');
    const signal = bindOptions.signal ?? new AbortController().signal;
    const hostResult = await readHost(parsed.value, signal);
    if (!hostResult.ok) return hostResult;
    const context = normalizeHost(hostResult.value, options.queryLimits);
    if (!context.ok) return context;
    if (bindOptions.goalEpoch !== undefined && bindOptions.goalEpoch !== context.value.goalEpoch)
      return failure('agent.stale-epoch', 'The agent goal epoch changed before binding.');
    if (!hasGrant(context.value, GRANT_TASK_PROPOSE) || !hasGrant(context.value, GRANT_CATALOG_READ))
      return failure('agent.denied', 'The host did not grant Task proposal and catalog binding.');
    if (parsed.value.effect !== 'read')
      return failure('agent.unsupported', 'This binder accepts only no-effect read Task proposals.');
    const structure = validateTaskStructure(parsed.value.value);
    if (!structure.ok) return structure;
    const readSet = validateCommitReadSet(parsed.value.preconditions, context.value.current, structure.value.resultReferences);
    if (!readSet.ok) return readSet;
    const semantics = validateTaskSemantics(parsed.value, structure.value.task, structure.value, context.value);
    if (!semantics.ok) return semantics;

    // Re-read the full authority after semantic inspection.  A proposal is
    // only safe to report as bound/fingerprintable when the principal,
    // grants, goal, decisions and complete read set still describe the same
    // host authority that was inspected.
    const freshHost = await readHost(parsed.value, signal);
    if (!freshHost.ok) return freshHost;
    const freshContext = normalizeHost(freshHost.value, options.queryLimits);
    if (!freshContext.ok) return freshContext;
    if (authorityKey(context.value) !== authorityKey(freshContext.value))
      return failure('agent.stale-authority', 'Host authority changed while the proposal was being inspected.');
    if (bindOptions.goalEpoch !== undefined && bindOptions.goalEpoch !== freshContext.value.goalEpoch)
      return failure('agent.stale-epoch', 'The agent goal epoch changed before binding.');
    const freshReadSet = validateCommitReadSet(parsed.value.preconditions, freshContext.value.current, structure.value.resultReferences);
    if (!freshReadSet.ok) return freshReadSet;
    const freshSemantics = validateTaskSemantics(parsed.value, structure.value.task, structure.value, freshContext.value);
    if (!freshSemantics.ok) return freshSemantics;
    const materialDecision = goalDecision(freshContext.value);
    if (materialDecision !== undefined) return inspectionState(decisionOutcome(materialDecision));
    return freshSemantics;
  };

  const bind = async (input: unknown, bindOptions: AgentBindOptions = {}): Promise<Outcome<AgentBindingOutcome>> => {
    if (pending >= maxPending) return stateOutcome('invalid', [diagnostic('agent.budget', 'The binding queue is full.')]);
    pending++;
    try {
      const inspected = await inspect(input, bindOptions);
      if (!inspected.ok) {
        if (inspected.state !== undefined) return {ok: true, value: inspected.state};
        const first = inspected.diagnostics[0];
        if (first?.code === 'agent.unsupported') return stateOutcome('unsupported', inspected.diagnostics);
        if (first?.code === 'agent.stale-epoch' || first?.code === 'agent.stale-authority' || first?.code === 'agent.stale-decisions' || first?.code === 'commit.stale' || first?.code === 'commit.missing-dependency' || first?.code === 'agent.stale' || first?.code === 'agent.stale-task') return stateOutcome('stale', inspected.diagnostics);
        if (first?.code === 'agent.denied' || first?.code === 'agent.denied-result-inspect') return stateOutcome('denied', inspected.diagnostics);
        if (first?.code === 'query.unsupported' || first?.code?.startsWith('query.unsupported')) return stateOutcome('unsupported', inspected.diagnostics);
        if (first?.code?.startsWith('query.stale')) return stateOutcome('stale', inspected.diagnostics);
        return stateOutcome('invalid', inspected.diagnostics);
      }
      if (bindOptions.signal?.aborted) return stateOutcome('stale', [diagnostic('agent.cancelled', 'Agent binding was cancelled.')]);
      return boundOutcome(inspected.value.task);
    } catch {
      return stateOutcome('invalid', [diagnostic('agent.invalid', 'The proposal could not be bound safely.')]);
    } finally {
      pending = Math.max(0, pending - 1);
    }
  };

  const fingerprint = async (input: unknown, bindOptions: AgentBindOptions = {}): Promise<Outcome<string>> => {
    if (pending >= maxPending) return failure('agent.budget', 'The binding queue is full.');
    pending++;
    try {
      const inspected = await inspect(input, bindOptions);
      if (inspected.ok) return {ok: true, value: taskFingerprint(inspected.value.task, inspected.value.context, inspected.value.plans)};
      return {ok: true, value: candidateFingerprint(input)};
    } finally {
      pending = Math.max(0, pending - 1);
    }
  };

  return Object.freeze({bind, fingerprint});
}

export function bindAgentProposal(
  input: unknown,
  options: AgentBinderOptions,
  bindOptions?: AgentBindOptions,
): Promise<Outcome<AgentBindingOutcome>> {
  return createAgentBinder(options).bind(input, bindOptions);
}

export function fingerprintAgentProposal(
  input: unknown,
  options: AgentBinderOptions,
  bindOptions?: AgentBindOptions,
): Promise<Outcome<string>> {
  return createAgentBinder(options).fingerprint(input, bindOptions);
}

export {candidateFingerprint};
