import {WIRE_LIMITS, compileIntent, parseContract, parseIntent} from '@aeliqo/core';
import type {Diagnostic, Outcome, ResultRef, Task} from '@aeliqo/core';
import {createTaskEvaluator} from '../evaluation/task.js';
import type {MaterializedTaskOutput, TaskEvaluation, TrustedEvaluationContext} from '../evaluation/types.js';
import {createRegionStore} from '../regions/store.js';
import type {RegionAuthority, RegionHandle, RegionOutcome} from '../regions/types.js';
import {createResultStore} from '../results/store.js';
import type {ResultHandle, ResultStore} from '../results/types.js';
import type {
  AeliqoRuntime,
  AeliqoRuntimeOptions,
  AppAuthorityContext,
  RuntimeCommittedReceipt,
  RuntimeMountInput,
  RuntimePresentationInput,
  RuntimeRegionState,
  RuntimeRenderInput,
  RuntimeRenderReceipt,
  RuntimeRenderStatus,
  RuntimeResourceContext,
} from './types.js';

interface MountedRegion {
  readonly regionId: string;
  readonly resourceId: string;
  readonly listeners: Set<(state: RuntimeRegionState) => void>;
  state: RuntimeRegionState;
  sequence: number;
  active?: AbortController;
  principalKey?: string;
  refs: readonly ResultRef[];
  pendingRefs: readonly ResultRef[];
}

function diagnostic(code: string, message: string, path?: readonly (string | number)[]): Diagnostic {
  return {code, message, retryable: false, ...(path === undefined ? {} : {path})};
}
function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [diagnostic(code, message, path)]};
}
function validId(value: string): boolean {
  return value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}
function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}
function uniqueRefs(refs: readonly ResultRef[]): readonly ResultRef[] {
  return Object.freeze([...new Map(refs.map((ref) => [refKey(ref), ref])).values()]);
}
function statusFor(diagnostics: readonly Diagnostic[]): Exclude<RuntimeRenderStatus, 'committed'> {
  const code = diagnostics[0]?.code ?? '';
  if (code.includes('cancel') || code.includes('abort') || code.includes('disposed') || code.includes('stale')) return 'cancelled';
  if (code.includes('denied') || code.includes('revoked') || code.includes('permission')) return 'denied';
  if (code.includes('unsupported') || code.startsWith('intent.unknown-')) return 'unsupported';
  if (code.includes('needs-choice') || code.includes('needs-input') || code.includes('identity')) return 'needs-input';
  return 'failed';
}
function linkedSignal(parent: AbortSignal | undefined): {readonly controller: AbortController; cleanup(): void} {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  parent?.addEventListener('abort', abort, {once: true});
  if (parent?.aborted === true) controller.abort();
  return {controller, cleanup() { parent?.removeEventListener('abort', abort); }};
}

export function createAeliqoRuntime(options: AeliqoRuntimeOptions): AeliqoRuntime {
  if (options === null || typeof options !== 'object' || options.authority === null || typeof options.authority?.read !== 'function')
    throw new TypeError('createAeliqoRuntime requires one trusted authority adapter.');
  if (!Array.isArray(options.resources) || options.resources.length === 0) throw new TypeError('createAeliqoRuntime requires at least one resource binding.');
  const resources = new Map<string, AeliqoRuntimeOptions['resources'][number]>();
  for (const binding of options.resources) {
    if (resources.has(binding.resource.id)) throw new TypeError(`Resource ${binding.resource.id} is bound more than once.`);
    resources.set(binding.resource.id, binding);
  }
  const ownsResultStore = options.resultStore === undefined;
  const underlyingStore = options.resultStore ?? createResultStore(options.resultStoreOptions);
  const trackedHandles = new Set<ResultHandle>();
  const resultStore: ResultStore = {
    begin(input) { const handle = underlyingStore.begin(input); trackedHandles.add(handle); return handle; },
    get(input) { return underlyingStore.get(input); },
    revoke(input) { underlyingStore.revoke(input); },
    dispose() { underlyingStore.dispose(); trackedHandles.clear(); },
  };
  const mounted = new Map<string, MountedRegion>();
  let disposed = false;

  const bindingForTask = (task: Task) => {
    const slot = mounted.get(task.regionId);
    return slot === undefined ? undefined : resources.get(slot.resourceId);
  };
  const authorityForResource = (slot: MountedRegion, resourceId: string, effect: 'render' | 'commit' | 'context', signal?: AbortSignal): Outcome<AppAuthorityContext> => {
    if (disposed) return failure('runtime.app-disposed', 'The Aeliqo runtime is disposed.');
    let outcome: ReturnType<AeliqoRuntimeOptions['authority']['read']>;
    try { outcome = options.authority.read({resourceId, regionId: slot.regionId, effect, ...(signal === undefined ? {} : {signal})}); }
    catch { return failure('runtime.authority-denied', 'The authority adapter failed safely.'); }
    if (!outcome.ok) return outcome;
    const value = outcome.value;
    if (!validId(value.scopeDigest) || !validId(value.policyRevision) || !validId(value.experienceRevision)
      || typeof value.principalKey !== 'string' || value.principalKey.length === 0 || value.principalKey.length > WIRE_LIMITS.id * 4)
      return failure('runtime.authority-invalid', 'The authority adapter returned invalid bounded identity or revision metadata.');
    return {ok: true, value};
  };
  const authorityFor = (slot: MountedRegion, effect: 'render' | 'commit' | 'context', signal?: AbortSignal): Outcome<AppAuthorityContext> =>
    authorityForResource(slot, slot.resourceId, effect, signal);
  const describeResource = (resourceId: string, current: AppAuthorityContext): RuntimeResourceContext => {
    const resource = resources.get(resourceId)!.resource;
    const actions = current.grants.includes('action.propose')
      ? (['create', 'edit'] as const).flatMap((intent) => {
          const binding = resource.forms?.[intent];
          return binding === undefined ? [] : [{intent, action: binding.action}];
        })
      : [];
    return Object.freeze({
      resource: Object.freeze({id: resource.id, label: resource.label, ...(resource.description === undefined ? {} : {description: resource.description})}),
      intents: Object.freeze([...resource.intents]),
      fields: Object.freeze(resource.entity.fields.flatMap((field) => resource.fieldMetadata[field.id]?.hidden === true ? [] : [Object.freeze({
        id: field.id, label: field.label, ...(resource.fieldMetadata[field.id]?.description === undefined ? {} : {description: resource.fieldMetadata[field.id]!.description}),
        role: field.role, type: field.type, ...(resource.fieldMetadata[field.id]?.values === undefined ? {} : {values: resource.fieldMetadata[field.id]!.values}),
      })])),
      meanings: Object.freeze(resource.catalog.meanings.map((meaning) => Object.freeze({
        id: meaning.id, revision: meaning.revision, label: meaning.label, explanation: meaning.explanation,
        output: meaning.output, aggregation: meaning.aggregation,
      }))),
      views: Object.freeze([...resource.presentation.allowedViews]),
      actions: Object.freeze(actions.map((action) => Object.freeze(action))),
      authority: Object.freeze({principalKey: current.principalKey, scopeDigest: current.scopeDigest, policyRevision: current.policyRevision,
        experienceRevision: current.experienceRevision, grants: Object.freeze([...current.grants])}),
    });
  };
  const resolveResult = (ref: ResultRef): ResultHandle | undefined => {
    for (const handle of trackedHandles) {
      const snapshot = handle.snapshot();
      if (snapshot.status === 'disposed' || snapshot.status === 'denied') { trackedHandles.delete(handle); continue; }
      if (snapshot.descriptor !== undefined && refKey(snapshot.descriptor.ref) === refKey(ref)) return handle;
    }
    return undefined;
  };
  const regionAuthority = (regionId: string): RegionOutcome<RegionAuthority> => {
    const slot = mounted.get(regionId);
    if (slot === undefined) return {ok: false, diagnostics: [diagnostic('runtime.region-denied', 'The region is not mounted.')]};
    const binding = resources.get(slot.resourceId)!;
    const current = authorityFor(slot, 'commit');
    if (!current.ok) return current;
    if (slot.principalKey !== undefined && current.value.principalKey !== slot.principalKey)
      return {ok: false, diagnostics: [diagnostic('runtime.region-denied', 'The authenticated principal changed before commit.')]};
    return {ok: true, value: {
      principalKey: current.value.principalKey, scopeDigest: current.value.scopeDigest, policyRevision: current.value.policyRevision,
      catalogRevision: binding.resource.catalog.revision, experienceRevision: current.value.experienceRevision,
      functionRegistryDigest: binding.resource.catalog.functionRegistryDigest, results: uniqueRefs([...slot.refs, ...slot.pendingRefs]),
    }};
  };
  const regions = createRegionStore({
    readAuthority: regionAuthority,
    authorizeCommit: ({regionId, authority, signal}) => {
      const slot = mounted.get(regionId);
      if (slot === undefined) return {ok: false, diagnostics: [diagnostic('runtime.region-denied', 'The region is not mounted.')]};
      const current = authorityFor(slot, 'commit', signal);
      if (!current.ok) return current;
      const same = current.value.principalKey === authority.principalKey && current.value.scopeDigest === authority.scopeDigest
        && current.value.policyRevision === authority.policyRevision && current.value.experienceRevision === authority.experienceRevision;
      return same ? {ok: true, value: undefined} : {ok: false, diagnostics: [diagnostic('runtime.region-stale', 'Authority changed during commit.')]};
    },
    ...(options.maxRegions === undefined ? {} : {maxRegions: options.maxRegions}),
  });
  const evaluator = createTaskEvaluator({
    host: {readContext: ({task, signal}) => {
      const slot = mounted.get(task.regionId);
      const binding = bindingForTask(task);
      if (slot === undefined || binding === undefined) return failure('runtime.evaluation-denied', 'The Task targets an unmounted resource.');
      const current = authorityFor(slot, 'render', signal);
      if (!current.ok) return current;
      if (slot.principalKey !== current.value.principalKey) return failure('runtime.evaluation-stale', 'The authenticated principal changed during evaluation.');
      const context: TrustedEvaluationContext = {
        principalKey: current.value.principalKey, scopeDigest: current.value.scopeDigest,
        policyRevision: current.value.policyRevision, catalogRevision: binding.resource.catalog.revision,
        functionRegistryDigest: binding.resource.catalog.functionRegistryDigest, grants: current.value.grants,
        catalog: binding.resource.catalog, data: binding.data, resultStore, readContext: current.value.readContext,
        resolveResult, now: current.value.now ?? (() => Date.now()), ...(current.value.budget === undefined ? {} : {budget: current.value.budget}),
      };
      return {ok: true, value: context};
    }},
    ...(options.maxRenderMilliseconds === undefined ? {} : {maxMilliseconds: options.maxRenderMilliseconds}),
  });

  const notify = (slot: MountedRegion): void => {
    for (const listener of [...slot.listeners]) {
      try { listener(slot.state); } catch { /* Observers never control runtime state. */ }
    }
  };
  const setState = (slot: MountedRegion, state: RuntimeRegionState): void => {
    slot.state = Object.freeze(state);
    notify(slot);
  };
  const failReceipt = (slot: MountedRegion, sequence: number, requestId: string, diagnostics: readonly Diagnostic[], task?: Task): RuntimeRenderReceipt => {
    if (slot.sequence !== sequence) {
      return {status: 'cancelled', requestId, regionId: slot.regionId,
        diagnostics: [diagnostic('runtime.render-cancelled', 'A newer render replaced this request.')],
        ...(task === undefined ? {} : {task})};
    }
    const status = statusFor(diagnostics);
    setState(slot, {regionId: slot.regionId, resourceId: slot.resourceId, phase: status, requestId,
      ...(task === undefined ? {} : {task}), results: slot.refs, diagnostics, ...(regions.get(slot.regionId) === undefined ? {} : {region: regions.get(slot.regionId)!.snapshot()})});
    return {status, requestId, regionId: slot.regionId, diagnostics, ...(task === undefined ? {} : {task})};
  };
  const preparePrincipal = (slot: MountedRegion, signal: AbortSignal): Outcome<AppAuthorityContext> => {
    const current = authorityFor(slot, 'render', signal);
    if (!current.ok) {
      const prior = slot.principalKey;
      regions.get(slot.regionId)?.revoke('authority denied');
      if (prior !== undefined) resultStore.revoke({principalKey: prior});
      slot.refs = []; slot.pendingRefs = [];
      return current;
    }
    if (slot.principalKey !== undefined && slot.principalKey !== current.value.principalKey) {
      resultStore.revoke({principalKey: slot.principalKey});
      regions.get(slot.regionId)?.dispose();
      slot.refs = []; slot.pendingRefs = [];
    }
    slot.principalKey = current.value.principalKey;
    return current;
  };
  const mount = (input: RuntimeMountInput) => {
    if (disposed) return failure<RuntimeRegionState>('runtime.app-disposed', 'The Aeliqo runtime is disposed.');
    if (!validId(input.regionId) || !resources.has(input.resourceId)) return failure<RuntimeRegionState>('runtime.mount-invalid', 'Mount requires a bounded region ID and registered resource.', ['regionId']);
    if (mounted.has(input.regionId)) return failure<RuntimeRegionState>('runtime.mount-duplicate', `Region ${input.regionId} is already mounted.`, ['regionId']);
    const state: RuntimeRegionState = Object.freeze({regionId: input.regionId, resourceId: input.resourceId, phase: 'idle', results: [], diagnostics: []});
    mounted.set(input.regionId, {regionId: input.regionId, resourceId: input.resourceId, listeners: new Set(), state, sequence: 0, refs: [], pendingRefs: []});
    return {ok: true as const, value: state};
  };
  const render = async (input: RuntimeRenderInput): Promise<RuntimeRenderReceipt> => {
    const slot = mounted.get(input.regionId);
    const fallbackRequest = `render-${input.regionId}`.slice(0, WIRE_LIMITS.id);
    if (slot === undefined) return {status: 'failed', requestId: fallbackRequest, regionId: input.regionId,
      diagnostics: [diagnostic('runtime.mount-missing', 'Mount the Region before rendering.')]};
    const requestId = `render-${slot.regionId}-${++slot.sequence}`.slice(0, WIRE_LIMITS.id);
    const sequence = slot.sequence;
    slot.active?.abort();
    slot.pendingRefs = [];
    const linked = linkedSignal(input.signal);
    slot.active = linked.controller;
    setState(slot, {regionId: slot.regionId, resourceId: slot.resourceId, phase: 'rendering', requestId,
      results: slot.refs, diagnostics: [], ...(regions.get(slot.regionId) === undefined ? {} : {region: regions.get(slot.regionId)!.snapshot()})});
    let evaluation: TaskEvaluation | undefined;
    try {
      const authority = preparePrincipal(slot, linked.controller.signal);
      if (!authority.ok) return failReceipt(slot, sequence, requestId, authority.diagnostics);
      const parsedIntent = parseIntent(input.intent);
      if (!parsedIntent.ok) return failReceipt(slot, sequence, requestId, parsedIntent.diagnostics);
      const binding = resources.get(slot.resourceId)!;
      const compiled = compileIntent(parsedIntent.value, {resource: binding.resource, regionId: slot.regionId, taskRevision: String(sequence),
        ...(options.intents === undefined ? {} : {customIntents: options.intents})});
      if (!compiled.ok) return failReceipt(slot, sequence, requestId, compiled.diagnostics);
      const task = compiled.value;
      let outputs: readonly MaterializedTaskOutput[] = [];
      if (task.kind === 'data') {
        const evaluated = await evaluator.evaluate({task, signal: linked.controller.signal});
        if (!evaluated.ok) return failReceipt(slot, sequence, requestId, evaluated.diagnostics, task);
        evaluation = evaluated.value;
        outputs = evaluation.outputs;
      }
      if (linked.controller.signal.aborted || sequence !== slot.sequence) return failReceipt(slot, sequence, requestId, [diagnostic('runtime.render-cancelled', 'A newer render replaced this request.')], task);
      slot.pendingRefs = outputs.map((output) => output.ref);
      let region: RegionHandle;
      const current = regions.get(slot.regionId);
      if (current === undefined) {
        const seedTask = parseContract('task', {...task, revision: String(Math.max(0, sequence - 1))});
        if (!seedTask.ok) return failReceipt(slot, sequence, requestId, seedTask.diagnostics, task);
        const created = regions.create({id: slot.regionId, state: {task: seedTask.value}});
        if (!created.ok) return failReceipt(slot, sequence, requestId, created.diagnostics, task);
        region = created.value;
      } else region = current;
      const before = region.snapshot();
      if (before.readSet === undefined) return failReceipt(slot, sequence, requestId, [diagnostic('runtime.region-stale', 'The Region has no active read set.')], task);
      const staged = await region.stage({requestId, expected: before.readSet, state: {task}, resultHandles: outputs.map((output) => output.handle)});
      if (!staged.ok) return failReceipt(slot, sequence, requestId, staged.diagnostics, task);
      if (linked.controller.signal.aborted || sequence !== slot.sequence) {
        region.discard(staged.value);
        return failReceipt(slot, sequence, requestId, [diagnostic('runtime.render-cancelled', 'A newer render replaced this request.')], task);
      }
      const committed = await region.commit(staged.value, {signal: linked.controller.signal, recheck: () => sequence === slot.sequence
        ? {ok: true, value: undefined} : {ok: false, diagnostics: [diagnostic('runtime.render-cancelled', 'A newer render replaced this request.')]}});
      if (!committed.ok) return failReceipt(slot, sequence, requestId, committed.diagnostics, task);
      slot.refs = uniqueRefs(slot.pendingRefs);
      slot.pendingRefs = [];
      const committedTask = committed.value.state?.task ?? task;
      const receipt: RuntimeCommittedReceipt = {status: 'committed', requestId, regionId: slot.regionId, diagnostics: [],
        intent: parsedIntent.value, task: committedTask, outputs, region: committed.value};
      setState(slot, {regionId: slot.regionId, resourceId: slot.resourceId, phase: 'committed', requestId, task: committedTask,
        results: slot.refs, diagnostics: [], region: committed.value});
      return receipt;
    } catch {
      return failReceipt(slot, sequence, requestId, [diagnostic('runtime.render-failed', 'The render pipeline failed safely.')]);
    } finally {
      if (slot.sequence === sequence) slot.pendingRefs = [];
      evaluation?.release();
      linked.cleanup();
      if (slot.active === linked.controller) delete slot.active;
    }
  };
  const runtime: AeliqoRuntime = {
    ...(options.actionPort === undefined ? {} : {actionPort: options.actionPort}),
    mount,
    render,
    context(regionId) {
      const slot = mounted.get(regionId);
      if (slot === undefined) return failure('runtime.mount-missing', 'Mount the Region before reading its context.');
      const current = authorityFor(slot, 'context');
      if (!current.ok) return current;
      if (!current.value.grants.includes('catalog.read')) return failure('runtime.context-denied', 'Catalog discovery is not permitted for this session.');
      return {ok: true, value: describeResource(slot.resourceId, current.value)};
    },
    contexts(regionId) {
      const slot = mounted.get(regionId);
      if (slot === undefined) return failure('runtime.mount-missing', 'Mount the Region before reading its contexts.');
      const active = authorityFor(slot, 'context');
      if (!active.ok) return active;
      if (!active.value.grants.includes('catalog.read')) return failure('runtime.context-denied', 'Catalog discovery is not permitted for this session.');
      const visible: RuntimeResourceContext[] = [];
      for (const resourceId of resources.keys()) {
        const current = resourceId === slot.resourceId ? active : authorityForResource(slot, resourceId, 'context');
        if (!current.ok || !current.value.grants.includes('catalog.read')) continue;
        if (current.value.principalKey !== active.value.principalKey || current.value.scopeDigest !== active.value.scopeDigest) continue;
        visible.push(describeResource(resourceId, current.value));
      }
      return {ok: true, value: Object.freeze(visible)};
    },
    async commitPresentation(input: RuntimePresentationInput) {
      const slot = mounted.get(input.regionId);
      const region = regions.get(input.regionId);
      if (slot === undefined || region === undefined) return failure('runtime.mount-missing', 'The Region is not mounted and committed.');
      if (!validId(input.requestId)) return failure('runtime.presentation-invalid', 'Presentation request ID must be bounded.', ['requestId']);
      const current = region.snapshot();
      if (current.readSet === undefined || current.state?.task.id !== input.task.id || current.state.task.revision !== input.task.revision)
        return failure('runtime.presentation-stale', 'Presentation Task is not the current committed Task.');
      const staged = await region.stage({requestId: input.requestId, expected: current.readSet,
        state: {task: input.task, presentation: input.presentation}});
      if (!staged.ok) return staged;
      const committed = await region.commit(staged.value, {...(input.signal === undefined ? {} : {signal: input.signal}), recheck: (next) =>
        next?.state?.task.id === input.task.id
          ? {ok: true, value: undefined}
          : failure('runtime.presentation-stale', 'Presentation Task changed before commit.')});
      if (committed.ok) setState(slot, {...slot.state, task: committed.value.state?.task ?? input.task, region: committed.value});
      return committed;
    },
    snapshot(regionId) { return mounted.get(regionId)?.state; },
    subscribe(regionId, listener) {
      const slot = mounted.get(regionId);
      if (slot === undefined) throw new TypeError(`Region ${regionId} is not mounted.`);
      slot.listeners.add(listener);
      let subscribed = true;
      return () => { if (!subscribed) return; subscribed = false; slot.listeners.delete(listener); };
    },
    unmount(regionId) {
      const slot = mounted.get(regionId);
      if (slot === undefined) return false;
      slot.active?.abort();
      regions.get(regionId)?.dispose();
      mounted.delete(regionId);
      slot.listeners.clear();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const slot of mounted.values()) { slot.active?.abort(); slot.listeners.clear(); }
      mounted.clear();
      regions.dispose();
      if (ownsResultStore) resultStore.dispose();
      else trackedHandles.clear();
    },
  };
  return Object.freeze(runtime);
}
