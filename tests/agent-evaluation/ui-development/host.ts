import {
  createStandardFunctionRegistry,
  parseContract,
  parseTask,
  parseWireValue,
  type CommitPreconditions,
  type Diagnostic,
  type Experience,
  type Outcome,
  type PresentationContext,
  type PresentationPlan,
  type Result,
  type Task,
  type ValidatedPresentation,
} from '@aeliqo/core';
import {
  createLocalDataService,
  type DataRecord,
  type LocalDataService,
  type QueryBudget,
} from '@aeliqo/runtime/data';
import {
  createResultStore,
  type ResultHandle,
  type ResultStore,
} from '@aeliqo/runtime/results';
import {
  createResultCohortResolver,
  createTaskEvaluator,
  type MaterializedTaskOutput,
  type TrustedEvaluationContext,
} from '@aeliqo/runtime/evaluation';
import {
  createRegionStore,
  type RegionAuthority,
  type RegionHandle,
  type RegionReadSet,
  type RegionSnapshot,
} from '@aeliqo/runtime/regions';
import {
  createCallbackPresentationRenderer,
  type PresentationRenderer,
} from '@aeliqo/runtime/presentation';
import {
  createInteractionController,
  createInteractionGraph,
  type InteractionController,
  type InteractionOutcome,
} from '@aeliqo/runtime/interaction';
import {
  createAgentCapabilityRegistry,
  validateAgentComposition,
  type AgentCapabilityHandlerResult,
  type AgentCapabilityHostContext,
  type AgentCapabilityManifest,
} from '@aeliqo/agent';
import {
  createAgentToolEndpoint,
  type AgentToolEndpoint,
  type AgentToolTransport,
} from '@aeliqo/agent/protocol';
import type {
  AgentCapabilityReceipt,
  AgentJsonValue,
} from '@aeliqo/agent';
import {
  AELIQO_CONFIG_SCHEMAS,
  AELIQO_PRESENTATION_REFS,
  createAeliqoPresentationRegistry,
  type AeliqoRegionElement,
  type AeliqoRegionResult,
  type AeliqoSemanticInteractionRequest,
} from '@aeliqo/web/region';
import type {RegionContent} from '@aeliqo/runtime/regions';

export interface UiDevelopmentFixture {
  readonly id: 'development-ui-records';
  readonly principalKey: 'ui-development-principal';
  readonly regionId: 'ui-development-region';
  readonly goalEpoch: 'ui-development-goal-1';
  readonly scopeDigest: 'ui-development-scope-1';
  readonly sourceRevision: 'ui-development-source-1';
  readonly budget: QueryBudget;
  readonly catalog: import('@aeliqo/core').Catalog;
  readonly records: Readonly<Record<string, readonly DataRecord[]>>;
}

export const fixture: UiDevelopmentFixture = Object.freeze({
  id: 'development-ui-records',
  principalKey: 'ui-development-principal',
  regionId: 'ui-development-region',
  goalEpoch: 'ui-development-goal-1',
  scopeDigest: 'ui-development-scope-1',
  sourceRevision: 'ui-development-source-1',
  budget: Object.freeze({maxRows: 10, maxBytes: 100_000, maxMessages: 8, maxMilliseconds: 5_000, maxColumns: 8}),
  catalog: Object.freeze({
    version: '1',
    revision: 'ui-development-catalog-1',
    functionRegistryDigest: '',
    entities: [{
      id: 'items',
      label: 'Items',
      identity: ['id'],
      rowGrain: ['id'],
      fields: [
        {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
        {id: 'group', label: 'Group', role: 'dimension', type: {value: 'text', nullable: false}},
        {id: 'value', label: 'Value', role: 'measure', type: {value: 'integer', nullable: false}},
      ],
    }],
    relationships: [],
    meanings: [],
    capabilities: [],
  } as const),
  records: Object.freeze({items: Object.freeze([
    Object.freeze({id: 'a', group: 'A', value: 9}),
    Object.freeze({id: 'b', group: 'B', value: 2}),
    Object.freeze({id: 'c', group: 'A', value: 5}),
  ])}),
});

const standardFunctions = createStandardFunctionRegistry();
if (!standardFunctions.ok) throw new Error('The standard function registry is unavailable.');
const standardFunctionRegistry = standardFunctions.value;
const developmentFixture = Object.freeze({
  ...fixture,
  catalog: Object.freeze({...fixture.catalog, functionRegistryDigest: standardFunctions.value.digest}),
});

export const task: Task = Object.freeze({
  version: '1',
  id: 'ui-development-task',
  revision: '1',
  regionId: fixture.regionId,
  catalogRevision: developmentFixture.catalog.revision,
  functionRegistryDigest: developmentFixture.catalog.functionRegistryDigest,
  goal: 'Show group A items',
  needs: [],
  assumptions: [],
  kind: 'data',
  outputs: [{
    id: 'main',
    kind: 'query',
    dependsOn: [],
    delivery: 'eager',
    query: {
      entity: 'items',
      fields: ['id', 'value'],
      measures: [],
      relations: [],
      groupBy: [],
      population: {kind: 'all-authorized'},
      where: {op: 'compare', field: 'group', comparison: 'eq', value: 'A'},
      order: [{field: 'value', direction: 'desc', nulls: 'last'}],
    },
  }],
} as const);

const experience: Experience = Object.freeze({
  version: '1',
  id: 'ui-development-experience',
  revision: '1',
  mode: 'composable',
  agentAllowed: true,
  allowedRepresentations: [AELIQO_PRESENTATION_REFS.stack.id, AELIQO_PRESENTATION_REFS.table.id],
  allowedPatterns: [],
  composition: {allowWithoutPreset: true, maxNodes: 4, maxExpansions: 8},
  requiredOperations: [],
  tokenProfile: {id: 'tokens.default', revision: '1'},
  extensionAllowlist: [],
  transitionPolicy: 'stable',
});

const environment: PresentationContext['environment'] = Object.freeze({
  inlineSize: {state: 'known', value: 720},
  blockSize: {state: 'known', value: 480},
  textScale: {state: 'known', value: 1},
  pointer: 'fine',
  hover: 'available',
  keyboard: 'available',
  locale: 'en-US',
  direction: 'ltr',
  reducedMotion: false,
  forcedColors: false,
} as const);

const fail = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false}],
});

const diagnostic = (code: string, message: string): Diagnostic => ({code, message, retryable: false});

const refKey = (ref: Result['ref']): string => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);

function pins(readSet: RegionReadSet): CommitPreconditions {
  const {dataRevision: _dataRevision, ...value} = readSet;
  return value;
}

function sameRef(left: Result['ref'], right: Result['ref']): boolean {
  return refKey(left) === refKey(right);
}

function resultRows(output: MaterializedTaskOutput): readonly DataRecord[] {
  return output.handle.snapshot().batches.flatMap(batch => batch.rows) as readonly DataRecord[];
}

function resultFor(output: MaterializedTaskOutput): AeliqoRegionResult | undefined {
  const descriptor = output.handle.snapshot().descriptor;
  if (descriptor === undefined) return undefined;
  return {ref: descriptor.ref, rows: resultRows(output)};
}

function normalizedRegionContent(snapshot: RegionSnapshot): RegionContent | undefined {
  return snapshot.state;
}

interface ProposalRecord {
  readonly id: string;
  readonly goalEpoch: string;
  readonly expected: RegionReadSet;
  readonly task: Task;
  readonly validated: ValidatedPresentation;
}

export interface UiDevelopmentObservation {
  readonly stage: 'evaluate' | 'propose' | 'commit' | 'selection' | 'revoke';
  readonly status: string;
  readonly at: number;
  readonly details?: Readonly<Record<string, AgentJsonValue>>;
}

export interface UiDevelopmentHost {
  readonly endpoint: AgentToolEndpoint;
  readonly region: RegionHandle;
  readonly fixture: UiDevelopmentFixture;
  readonly observations: readonly UiDevelopmentObservation[];
  readonly outputs: () => readonly MaterializedTaskOutput[];
  readonly plan: () => Outcome<PresentationPlan>;
  readonly evaluateTask: (input?: unknown) => Promise<Outcome<AgentCapabilityReceipt>>;
  readonly propose: (input: unknown) => Promise<Outcome<AgentCapabilityReceipt>>;
  readonly commit: (proposalId: string) => Promise<Outcome<AgentCapabilityReceipt>>;
  readonly attach: (element: AeliqoRegionElement) => void;
  readonly holdNextCommit: () => void;
  readonly waitForCommitAuthorization: () => Promise<void>;
  readonly revoke: (reason?: string) => void;
  readonly dispose: () => void;
}

function presentationContext(
  snapshot: RegionSnapshot,
  registry: import('@aeliqo/core').PresentationRegistry,
  outputs: readonly MaterializedTaskOutput[],
): PresentationContext {
  const state = normalizedRegionContent(snapshot);
  if (state === undefined || snapshot.readSet === undefined) throw new Error('The development region is not active.');
  return {
    task: state.task,
    experience,
    results: outputs.flatMap(output => output.handle.snapshot().descriptor === undefined ? [] : [output.handle.snapshot().descriptor!]),
    current: pins(snapshot.readSet),
    environment,
    ...(state.presentation === undefined ? {} : {incumbent: state.presentation}),
    rendererCapabilities: [AELIQO_PRESENTATION_REFS.stack, AELIQO_PRESENTATION_REFS.table],
  };
}

function planForResult(snapshot: RegionSnapshot, output: MaterializedTaskOutput): Outcome<PresentationPlan> {
  if (snapshot.readSet === undefined || output.handle.snapshot().descriptor === undefined)
    return fail('ui-development.plan', 'A evaluated output is required before proposing a presentation.');
  const descriptor = output.handle.snapshot().descriptor!;
  return {ok: true, value: Object.freeze({
    id: 'ui-development-plan',
    revision: '1',
    rootId: 'root',
    preconditions: pins(snapshot.readSet),
    nodes: [
      {id: 'root', role: 'structure', representation: AELIQO_PRESENTATION_REFS.stack,
        config: {schema: AELIQO_CONFIG_SCHEMAS.stack, values: {gap: 8}}, children: ['items']},
      {id: 'items', role: 'table', representation: AELIQO_PRESENTATION_REFS.table, result: descriptor.ref,
        config: {schema: AELIQO_CONFIG_SCHEMAS.table, values: {selection: 'multiple'}}, children: []},
    ],
    links: [],
    coverage: [],
    stateTransfer: [],
    diagnostics: [],
  })};
}

/**
 * A development-only host that wires the real evaluator, capability dispatcher,
 * region transaction and web renderer together.  It deliberately exposes no
 * expected answer or quality score to capability handlers.
 */
export function createUiDevelopmentHost(transport: AgentToolTransport = 'manual'): UiDevelopmentHost {
  const functions = standardFunctionRegistry;
  const resultStore: ResultStore = createResultStore({maxEntries: 16, maxBytes: 1_000_000, ttlMs: 300_000});
  const service: LocalDataService = createLocalDataService({
    snapshot: {catalog: developmentFixture.catalog, sourceRevision: developmentFixture.sourceRevision, records: developmentFixture.records},
    hostBudget: developmentFixture.budget,
    sourceLimits: {rows: 100, bytes: 100_000},
    authorize: () => revoked
      ? fail('ui-development.revoked', 'The development fixture authority was revoked.')
      : {ok: true, value: {scopeDigest: developmentFixture.scopeDigest, policyRevision: 'ui-development-policy-1'}},
  });
  const cohortResolver = createResultCohortResolver();
  const handles = new Map<string, ResultHandle>();
  const retained = new Map<string, ReturnType<ResultHandle['retain']>>();
  const outputs: MaterializedTaskOutput[] = [];
  const proposals = new Map<string, ProposalRecord>();
  const observations: UiDevelopmentObservation[] = [];
  let region: RegionHandle;
  let element: AeliqoRegionElement | undefined;
  let activePresentation: ValidatedPresentation | undefined;
  let interaction: InteractionController | undefined;
  let interactionGraph: ReturnType<typeof createInteractionGraph> | undefined;
  let sequence = 0;
  let revoked = false;
  let pendingEvaluation: readonly MaterializedTaskOutput[] | undefined;
  let holdCommit = false;
  let commitStarted = false;
  let releaseCommit: (() => void) | undefined;
  let resolveCommitStarted: (() => void) | undefined;
  let commitStartedPromise: Promise<void> | undefined;
  const maxProposals = 16;

  const presentationRegistryResult = createAeliqoPresentationRegistry({resolveEntity: result => result.ref.outputId === 'main' ? 'items' : undefined});
  if (!presentationRegistryResult.ok) throw new Error(presentationRegistryResult.diagnostics[0]?.message ?? 'The presentation registry is unavailable.');
  const registry = presentationRegistryResult.value;

  const refs = (): readonly Result['ref'][] => [...handles.values()].flatMap(handle => {
    const descriptor = handle.snapshot().descriptor;
    return descriptor === undefined ? [] : [descriptor.ref];
  });

  const authority = (): RegionAuthority => ({
    principalKey: developmentFixture.principalKey,
    scopeDigest: developmentFixture.scopeDigest,
    policyRevision: 'ui-development-policy-1',
    catalogRevision: developmentFixture.catalog.revision,
    experienceRevision: experience.revision,
    functionRegistryDigest: functions.digest,
    results: refs(),
  });

  const currentPins = (): CommitPreconditions | undefined => {
    const snapshot = region?.snapshot();
    return snapshot?.readSet === undefined ? undefined : pins(snapshot.readSet);
  };

  const grants = (): readonly import('@aeliqo/core').OperationGrant[] => revoked
    ? []
    : ['catalog.read', 'task.evaluate', 'result.inspect', 'experience.propose', 'experience.commit'];

  const context = (): TrustedEvaluationContext => ({
    principalKey: developmentFixture.principalKey,
    scopeDigest: developmentFixture.scopeDigest,
    policyRevision: 'ui-development-policy-1',
    catalogRevision: developmentFixture.catalog.revision,
    functionRegistryDigest: functions.digest,
    grants: revoked ? [] : ['task.evaluate', 'result.inspect'],
    catalog: developmentFixture.catalog,
    data: service,
    resultStore,
    readContext: {principal: developmentFixture.principalKey},
    cohortResolver,
    resolveResult: ref => handles.get(refKey(ref)),
    now: Date.now,
    budget: developmentFixture.budget,
  });

  const evaluator = createTaskEvaluator({
    host: {readContext: () => revoked ? fail('ui-development.revoked', 'The development fixture authority was revoked.') : {ok: true, value: context()}},
    budget: developmentFixture.budget,
    maxMilliseconds: developmentFixture.budget.maxMilliseconds,
  });

  const hostContext = (): Outcome<AgentCapabilityHostContext> => {
    const current = currentPins();
    if (current === undefined) return fail('agent.ui-development.denied', 'The development region is unavailable.');
    return {ok: true as const, value: {
      principalKey: developmentFixture.principalKey,
      regionId: developmentFixture.regionId,
      goalEpoch: developmentFixture.goalEpoch,
      current,
      grants: grants(),
    }};
  };

  const readEvaluation = async (input: unknown, signal: AbortSignal): Promise<Outcome<AgentCapabilityHandlerResult>> => {
    const parsed = parseTask(input);
    if (!parsed.ok) return {ok: true, value: {state: 'invalid', diagnostics: parsed.diagnostics}};
    if (parsed.value.id !== task.id || parsed.value.regionId !== task.regionId || parsed.value.kind !== 'data')
      return {ok: true, value: {state: 'invalid', diagnostics: [diagnostic('ui-development.task', 'The development task is not the paired data task.')]}};
    const evaluated = await evaluator.evaluate({task: parsed.value, signal});
    if (!evaluated.ok) return {ok: true, value: {state: 'failed', diagnostics: evaluated.diagnostics}};
    try {
      const nextEntries: Array<{readonly key: string; readonly handle: ResultHandle; readonly lease: ReturnType<ResultHandle['retain']>}> = [];
      for (const output of evaluated.value.outputs) {
        const descriptor = output.handle.snapshot().descriptor;
        if (descriptor === undefined) return {ok: true, value: {state: 'failed', diagnostics: [diagnostic('ui-development.output', 'The evaluated output has no descriptor.') ]}};
        nextEntries.push({key: refKey(descriptor.ref), handle: output.handle, lease: output.handle.retain()});
      }
      // A new evaluation replaces the host's current materialization. Keep the
      // region's own leases authoritative while publishData reconciles them,
      // but do not advertise retired generations to later proposals or stage
      // them into a fresh commit.
      for (const lease of retained.values()) lease.release();
      retained.clear();
      handles.clear();
      outputs.splice(0, outputs.length, ...evaluated.value.outputs);
      for (const entry of nextEntries) {
        handles.set(entry.key, entry.handle);
        if (!entry.lease.released) retained.set(entry.key, entry.lease);
      }
      pendingEvaluation = Object.freeze([...outputs]);
      observations.push({stage: 'evaluate', status: 'data-ready', at: Date.now(), details: {outputCount: outputs.length}});
      // Do not return rows/descriptors as capability output. The browser host
      // retains them for the authorized renderer; no answer oracle crosses the
      // capability boundary.
      return {ok: true, value: {state: 'data-ready', value: {outputIds: outputs.map(output => output.outputId)}}};
    } finally {
      evaluated.value.release();
    }
  };

  const parsePlan = (input: unknown): Outcome<PresentationPlan> => {
    const checked = parseContract('presentation-plan', input);
    return checked.ok ? checked : checked as Outcome<PresentationPlan>;
  };

  const proposePresentation = (input: PresentationPlan): Outcome<AgentCapabilityHandlerResult> => {
    const snapshot = region.snapshot();
    if (snapshot.status !== 'active' || snapshot.readSet === undefined || outputs.length === 0)
      return {ok: true, value: {state: 'stale', diagnostics: [diagnostic('ui-development.no-output', 'Evaluate an authorized output before proposing a view.')]}};
    const contextValue = presentationContext(snapshot, registry, outputs);
    const validated = validateAgentComposition(input, registry, contextValue);
    if (!validated.ok) return {ok: true, value: {state: 'invalid', diagnostics: validated.diagnostics}};
    if (proposals.size >= maxProposals) return {ok: true, value: {state: 'failed', diagnostics: [diagnostic('ui-development.proposal-budget', 'The bounded development proposal window is full.')]}};
    const proposalId = `ui-proposal-${++sequence}`;
    if (proposals.has(proposalId)) return {ok: true, value: {state: 'invalid', diagnostics: [diagnostic('ui-development.proposal', 'The development proposal identifier is already in use.')]}};
    proposals.set(proposalId, {id: proposalId, goalEpoch: developmentFixture.goalEpoch, expected: snapshot.readSet!, task: snapshot.state!.task, validated: validated.value});
    observations.push({stage: 'propose', status: 'bound', at: Date.now(), details: {proposalId, regionRevision: snapshot.regionRevision}});
    return {ok: true, value: {state: 'bound', value: {proposalId, regionRevision: snapshot.regionRevision}}};
  };

  const commitPresentation = async (input: {readonly proposalId: string}, signal: AbortSignal): Promise<Outcome<AgentCapabilityHandlerResult>> => {
    const proposal = proposals.get(input.proposalId);
    if (proposal === undefined) return {ok: true, value: {state: 'stale', diagnostics: [diagnostic('ui-development.proposal', 'The presentation proposal is no longer available.')]}};
    // A proposal is a one-shot capability receipt. Consume it before any
    // asynchronous authorization so retries cannot race a committed state.
    proposals.delete(input.proposalId);
    const before = region.snapshot();
    if (before.status !== 'active' || before.state === undefined || before.readSet === undefined || proposal.goalEpoch !== developmentFixture.goalEpoch)
      return {ok: true, value: {state: 'stale', diagnostics: [diagnostic('ui-development.region', 'The proposal belongs to a closed or changed region.')]}};
    if (before.regionRevision !== proposal.expected.regionRevision || before.dataRevision !== proposal.expected.dataRevision)
      return {ok: true, value: {state: 'stale', diagnostics: [diagnostic('ui-development.stale', 'A newer authorized region revision superseded the proposal.')]}};
    const refreshed = validateAgentComposition(proposal.validated.plan, registry, presentationContext(before, registry, outputs));
    if (!refreshed.ok) return {ok: true, value: {state: 'stale', diagnostics: refreshed.diagnostics}};
    const previous = activePresentation;
    const projection = {presentation: refreshed.value, ...(before.state.interaction === undefined ? {} : {interaction: before.state.interaction})};
    const staged = await region.stage({requestId: `ui-commit-${++sequence}`, expected: proposal.expected, state: {task: before.state.task, presentation: refreshed.value.plan, ...(before.state.interaction === undefined ? {} : {interaction: before.state.interaction})}, resultHandles: [...handles.values()]});
    if (!staged.ok) return {ok: true, value: {state: 'stale', diagnostics: staged.diagnostics}};
    const discard = (): void => { region.discard(staged.value); };
    if (signal.aborted) { discard(); return {ok: true, value: {state: 'cancelled', diagnostics: [diagnostic('ui-development.cancelled', 'The presentation commit was cancelled.')]}}; }
    const prepared = renderer.prepare({signal, next: projection, ...(previous === undefined ? {} : {previous: {presentation: previous, ...(before.state.interaction === undefined ? {} : {interaction: before.state.interaction})}})});
    if (!prepared.ok) { discard(); return {ok: true, value: {state: 'failed', diagnostics: prepared.diagnostics}}; }
    const rollback = (): void => { prepared.value.rollback(); };
    const committed = await region.commit(staged.value, {
      signal,
      recheck: prospective => {
        if (signal.aborted) return {ok: false, diagnostics: [diagnostic('ui-development.cancelled', 'The presentation commit was cancelled.')]};
        const current = region.snapshot();
        if (current.regionRevision !== before.regionRevision || current.dataRevision !== before.dataRevision)
          return {ok: false, diagnostics: [diagnostic('ui-development.stale', 'The authorized region changed before publication.')]};
        const finalPlan = prospective?.state?.presentation;
        if (finalPlan === undefined) return {ok: false, diagnostics: [diagnostic('ui-development.stale', 'The committed presentation has no final plan.')]};
        const applied = prepared.value.apply({...projection, presentation: {...refreshed.value, plan: finalPlan}});
        return applied.ok ? {ok: true, value: undefined} : applied;
      },
    });
    if (!committed.ok) { rollback(); return {ok: true, value: {state: committed.diagnostics.some(item => item.code.includes('stale')) ? 'stale' : 'failed', diagnostics: committed.diagnostics}}; }
    activePresentation = {...refreshed.value, plan: committed.value.state?.presentation ?? refreshed.value.plan};
    interactionGraph?.dispose();
    interactionGraph = createInteractionGraph(activePresentation.graph);
    interaction?.dispose();
    interaction = createInteractionController({
      region,
      graph: interactionGraph,
      readContext: () => ({principalKey: developmentFixture.principalKey, draftDomain: 'ui-development', actor: {id: developmentFixture.principalKey, kind: 'user'}, grants: revoked ? [] : ['result.inspect', 'experience.commit'], scopeDigest: developmentFixture.scopeDigest, policyRevision: 'ui-development-policy-1', catalogRevision: developmentFixture.catalog.revision, experienceRevision: experience.revision, functionRegistryDigest: functions.digest, results: refs()}),
      resolveResult: ref => handles.get(refKey(ref)),
      validateSelection: (selection, context) => {
        if (selection.mode === 'clear') return {ok: true, value: undefined};
        const valid = selection.mode === 'ids' && selection.entity === 'items' && selection.keys.every(key => outputs.some(output => resultRows(output).some(row => `string:${String(row.id).length}:${String(row.id)}` === key)));
        return valid ? {ok: true, value: undefined} : {ok: false, diagnostics: [{code: 'runtime.interaction-invalid', message: 'The selected identity is outside the authorized result population.', retryable: false}]};
      },
    });
    observations.push({stage: 'commit', status: 'renderer-ready', at: Date.now(), details: {regionRevision: committed.value.regionRevision}});
    return {ok: true, value: {state: 'renderer-ready', regionRevision: committed.value.regionRevision}};
  };

  const asAgentInput = <T>(outcome: Outcome<T>): Outcome<AgentJsonValue> => outcome.ok
    ? {ok: true, value: outcome.value as unknown as AgentJsonValue}
    : outcome as unknown as Outcome<AgentJsonValue>;

  const capabilityRegistryResult = createAgentCapabilityRegistry([
    {
      ref: {id: 'ui-development.evaluate', revision: '1'}, operation: 'task.evaluate', label: 'Evaluate development task', description: 'Evaluate the paired development Task within its authorized local source.',
      parse: input => asAgentInput(parseTask(input)), invoke: (input, context) => readEvaluation(input, context.signal),
    } satisfies AgentCapabilityManifest,
    {
      ref: {id: 'ui-development.propose', revision: '1'}, operation: 'experience.propose', label: 'Propose development presentation', description: 'Validate a registered presentation proposal without committing it.',
      parse: input => asAgentInput(parsePlan(input)), invoke: input => proposePresentation(input as PresentationPlan),
    } satisfies AgentCapabilityManifest,
    {
      ref: {id: 'ui-development.commit', revision: '1'}, operation: 'experience.commit', label: 'Commit development presentation', description: 'Commit one host-validated presentation through the region transaction.',
      parse: input => {
        const wire = parseWireValue(input);
        if (!wire.ok || wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value)) return fail('ui-development.commit-input', 'A commit request must name a proposal.');
        const value = wire.value as Record<string, unknown>;
        if (Object.keys(value).length !== 1 || typeof value.proposalId !== 'string' || value.proposalId.length === 0 || value.proposalId.length > 128) return fail('ui-development.commit-input', 'A commit request must name one bounded proposal.');
        return {ok: true, value: {proposalId: value.proposalId} as AgentJsonValue};
      },
      invoke: (input, context) => commitPresentation(input as {readonly proposalId: string}, context.signal),
    } satisfies AgentCapabilityManifest,
  ]);
  if (!capabilityRegistryResult.ok) throw new Error(capabilityRegistryResult.diagnostics[0]?.message ?? 'The capability registry is unavailable.');

  const store = createRegionStore({
    readAuthority: () => revoked ? fail('runtime.region-revoked', 'The development region authority was revoked.') : {ok: true, value: authority()},
    authorizeCommit: async ({state, current, signal}) => {
      if (revoked || signal.aborted) return fail('runtime.region-revoked', 'The development region authority was revoked.');
      if (!grants().includes('experience.commit') || state.presentation === undefined) return fail('runtime.region-denied', 'The host did not grant presentation commit.');
      const checked = validateAgentComposition(state.presentation, registry, presentationContext(current, registry, outputs));
      if (!checked.ok) return fail('runtime.region-invalid', checked.diagnostics.map(item => item.message).join('; '));
      if (holdCommit) {
        holdCommit = false;
        commitStarted = true;
        resolveCommitStarted?.();
        resolveCommitStarted = undefined;
        await new Promise<void>(resolve => {
          releaseCommit = resolve;
          signal.addEventListener('abort', () => resolve(), {once: true});
        });
        releaseCommit = undefined;
      }
      if (revoked || signal.aborted) return fail('runtime.region-revoked', 'The development region authority was revoked.');
      return {ok: true, value: undefined};
    },
  });
  const created = store.create({id: developmentFixture.regionId, state: {task}});
  if (!created.ok) throw new Error(created.diagnostics[0]?.message ?? 'The development region could not be created.');
  region = created.value;

  const renderer: PresentationRenderer = createCallbackPresentationRenderer({
    apply: next => {
      if (element === undefined) return;
      element.presentation = next.presentation;
      element.interaction = next.interaction;
      element.requestUpdate();
    },
    clear: () => element?.clear(),
  });

  const endpointResult = createAgentToolEndpoint({
    transport,
    targetRegionId: developmentFixture.regionId,
    goalEpoch: developmentFixture.goalEpoch,
    principalKey: developmentFixture.principalKey,
    scopeDigest: developmentFixture.scopeDigest,
    expiresAt: Date.now() + 300_000,
    registry: capabilityRegistryResult.value,
    host: {readContext: () => hostContext()},
    maxMilliseconds: developmentFixture.budget.maxMilliseconds,
    maxOutputBytes: 256_000,
    tools: [
      {name: 'evaluate_task', capability: {id: 'ui-development.evaluate', revision: '1'}, operation: 'task.evaluate', inputSchema: {type: 'object', additionalProperties: true}},
      {name: 'propose_experience', capability: {id: 'ui-development.propose', revision: '1'}, operation: 'experience.propose', inputSchema: {type: 'object', additionalProperties: true}},
      {name: 'commit_experience', capability: {id: 'ui-development.commit', revision: '1'}, operation: 'experience.commit', inputSchema: {type: 'object', properties: {proposalId: {type: 'string'}}, additionalProperties: false}},
    ],
  });
  if (!endpointResult.ok) throw new Error(endpointResult.diagnostics[0]?.message ?? 'The development endpoint could not be created.');
  const endpoint: AgentToolEndpoint = endpointResult.value;
  const commitRequest = async (proposalId: string): Promise<Outcome<AgentCapabilityReceipt>> => {
    try {
      return await endpoint.invoke('commit_experience', {proposalId}, {requestId: `ui-commit-request-${++sequence}`});
    } finally {
      // A staged commit can fail before host authorization (for example, a
      // malformed or already-stale proposal). Wake the test seam so it cannot
      // wait forever for an authorization callback that will never run.
      if (!commitStarted) {
        holdCommit = false;
        resolveCommitStarted?.();
        resolveCommitStarted = undefined;
      }
    }
  };

  const observer = region.observe(update => {
    if (update.kind === 'revoke' || update.kind === 'dispose') {
      renderer.clear(update.reason);
      observations.push({stage: 'revoke', status: update.kind, at: Date.now()});
      return;
    }
    if (element === undefined || update.snapshot.state === undefined) return;
    element.interaction = update.snapshot.state.interaction;
    if (activePresentation !== undefined && update.snapshot.state.presentation !== undefined)
      element.presentation = {...activePresentation, plan: update.snapshot.state.presentation};
    element.requestUpdate();
  });

  const host: UiDevelopmentHost = {
    endpoint,
    region,
    fixture: developmentFixture,
    observations,
    outputs: () => Object.freeze([...outputs]),
    plan: () => {
      const output = outputs[0];
      return output === undefined ? fail('ui-development.plan', 'Evaluate the development task first.') : planForResult(region.snapshot(), output);
    },
    evaluateTask: async input => {
      pendingEvaluation = undefined;
      const result = await endpoint.invoke('evaluate_task', input ?? task, {requestId: `ui-evaluate-${++sequence}`});
      const pending = pendingEvaluation as readonly MaterializedTaskOutput[] | undefined;
      if (result.ok && result.value.state === 'data-ready' && pending !== undefined) {
        const published = await region.publishData({resultHandles: pending.map(output => output.handle), reason: 'Authorized evaluated output became available.'});
        if (!published.ok) return {ok: false, diagnostics: published.diagnostics};
        if (element !== undefined) element.results = pending.flatMap(output => { const value = resultFor(output); return value === undefined ? [] : [value]; });
      }
      return result;
    },
    propose: input => endpoint.invoke('propose_experience', input, {requestId: `ui-propose-${++sequence}`}),
    commit: proposalId => commitRequest(proposalId),
    attach: attached => {
      element = attached;
      element.results = outputs.flatMap(output => { const value = resultFor(output); return value === undefined ? [] : [value]; });
      element.onSemanticInteraction = (request: AeliqoSemanticInteractionRequest): void => {
        const controller = interaction;
        if (controller === undefined) return;
        const snapshot = region.snapshot();
        void controller.dispatch({eventId: `ui-user-${++sequence}`, causationId: `ui-user-${sequence}`, regionId: snapshot.id, regionRevision: snapshot.regionRevision, originNodeId: request.nodeId, payload: request.payload}, {sourcePortId: request.portId});
      };
      const current = region.snapshot();
      if (activePresentation !== undefined && current.state?.presentation !== undefined) element.presentation = {...activePresentation, plan: current.state.presentation};
      element.interaction = current.state?.interaction;
      element.requestUpdate();
    },
    holdNextCommit: () => {
      holdCommit = true;
      commitStarted = false;
      commitStartedPromise = new Promise(resolve => { resolveCommitStarted = resolve; });
    },
    waitForCommitAuthorization: async () => {
      if (!commitStartedPromise || commitStarted) return;
      await Promise.race([
        commitStartedPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('The bounded commit authorization wait expired.')), developmentFixture.budget.maxMilliseconds + 100)),
      ]);
    },
    revoke: reason => {
      if (revoked) return;
      revoked = true;
      interaction?.revoke(reason);
      region.revoke(reason);
      resultStore.revoke({principalKey: developmentFixture.principalKey, scopeDigest: developmentFixture.scopeDigest});
      releaseCommit?.();
      releaseCommit = undefined;
    },
    dispose: () => {
      renderer.clear('The development host was disposed.');
      observer.unsubscribe();
      interaction?.dispose();
      interactionGraph?.dispose();
      endpoint.close();
      region.dispose();
      store.dispose();
      proposals.clear();
      for (const lease of retained.values()) lease.release();
      retained.clear();
      resultStore.dispose();
    },
  };
  return host;
}

export type {AeliqoRegionElement};
