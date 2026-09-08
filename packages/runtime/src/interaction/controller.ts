import {parseContract, parseInteractionState, WIRE_LIMITS} from '@aeliqo/core';
import type {InteractionState as CoreInteractionState, ResultRef} from '@aeliqo/core';
import {createSerialQueue, type SerialQueue} from '../scheduling/index.js';
import {resultRefForHandle} from '../regions/index.js';
import type {RegionObserver, RegionHandle, RegionReadSet, RegionSnapshot} from '../regions/types.js';
import type {RegionContent} from '../tasks/types.js';
import type {ResultHandle} from '../results/types.js';
import type {
  InteractionController,
  InteractionControllerOptions,
  InteractionDispatchOptions,
  InteractionEffectReceipt,
  InteractionEvent,
  InteractionFailure,
  InteractionGraph,
  InteractionHostCallback,
  InteractionHostContext,
  InteractionMaterialization,
  InteractionOutcome,
  InteractionPayload,
  InteractionQueryPayload,
  InteractionReceipt,
  InteractionResolutionContext,
  InteractionRoute,
  InteractionRoutedPayload,
  InteractionState,
} from './types.js';

const DEFAULT_MAX_QUEUED_EVENTS = 64;
const DEFAULT_MAX_EVENT_MILLISECONDS = 30_000;
const DEFAULT_MAX_HOPS = 32;

const failure = <T>(code: InteractionFailure['code'], message: string): InteractionOutcome<T> =>
  ({ok: false, diagnostics: [{code, message, retryable: false}]});

function freeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const child of value) freeze(child);
    return Object.freeze(value);
  }
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  return Object.freeze(value);
}

function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function routeKey(route: InteractionRoute): string {
  return JSON.stringify([route.nodeId, route.portId]);
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.text && !/[\u0000-\u001f\u007f]/u.test(value);
}

function hasGrant(context: InteractionHostContext, grant: string): boolean {
  return context.grants.includes(grant);
}

function sameTrustedContext(expected: InteractionHostContext, current: InteractionHostContext): boolean {
  return expected.principalKey === current.principalKey && expected.draftDomain === current.draftDomain &&
    expected.actor.id === current.actor.id && expected.actor.kind === current.actor.kind &&
    expected.scopeDigest === current.scopeDigest && expected.policyRevision === current.policyRevision &&
    expected.catalogRevision === current.catalogRevision && expected.experienceRevision === current.experienceRevision &&
    expected.functionRegistryDigest === current.functionRegistryDigest;
}

function grantsForPayload(payload: InteractionPayload): readonly string[] {
  if (payload.kind === 'selection') return payload.selection.mode === 'ids' ? ['experience.commit', 'result.inspect'] : ['experience.commit'];
  if (payload.kind === 'filter' || payload.kind === 'range' || payload.kind === 'group' || payload.kind === 'page') return ['experience.commit', 'result.inspect'];
  if (payload.kind === 'draft') return ['experience.commit', 'draft.edit'];
  if (payload.kind === 'navigate') return ['navigation.propose'];
  if (payload.kind === 'action-request') return ['action.propose'];
  return [];
}

function emptyPersistedState(): CoreInteractionState {
  return freeze({version: '1', values: [], drafts: []});
}

function persistedState(snapshot: RegionSnapshot): CoreInteractionState {
  if (snapshot.state?.interaction === undefined) return emptyPersistedState();
  const checked = parseInteractionState(snapshot.state.interaction);
  return checked.ok ? checked.value : emptyPersistedState();
}

function publicState(snapshot: RegionSnapshot): InteractionState {
  const persisted = snapshot.status === 'active' ? persistedState(snapshot) : emptyPersistedState();
  return freeze({...persisted, regionRevision: snapshot.regionRevision, taskRevision: snapshot.taskRevision});
}

function callbackOutcome(value: unknown): InteractionOutcome<void> {
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.ok === true && Object.keys(record).length === 2 && Object.hasOwn(record, 'value') && record.value === undefined)
      return {ok: true, value: undefined};
    if (record.ok === false && Array.isArray(record.diagnostics) && record.diagnostics.length > 0) {
      const diagnostics: InteractionFailure[] = [];
      for (const diagnostic of record.diagnostics) {
        if (diagnostic === null || typeof diagnostic !== 'object') return failure('runtime.interaction-denied', 'A host interaction callback returned an invalid diagnostic.');
        const candidate = diagnostic as Record<string, unknown>;
        if (!validText(candidate.code) || !validText(candidate.message) || typeof candidate.retryable !== 'boolean')
          return failure('runtime.interaction-denied', 'A host interaction callback returned an invalid diagnostic.');
        diagnostics.push(freeze({code: candidate.code, message: candidate.message, retryable: candidate.retryable}));
      }
      return {ok: false, diagnostics: diagnostics as [InteractionFailure, ...InteractionFailure[]]};
    }
  }
  return failure('runtime.interaction-denied', 'A host interaction callback returned an invalid outcome.');
}

function materializationOutcome(value: unknown): InteractionOutcome<InteractionMaterialization> {
  if (value === null || typeof value !== 'object') return failure('runtime.interaction-denied', 'The host materializer returned an invalid outcome.');
  const record = value as Record<string, unknown>;
  if (record.ok === false) {
    const checked = callbackOutcome(value);
    return checked.ok ? failure('runtime.interaction-denied', 'The host materializer returned an invalid failure.') : checked as InteractionOutcome<InteractionMaterialization>;
  }
  if (record.ok !== true || Object.keys(record).length !== 2 || !Object.hasOwn(record, 'value') || record.value === null || typeof record.value !== 'object')
    return failure('runtime.interaction-denied', 'The host materializer returned an invalid outcome.');
  const candidate = record.value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => key !== 'state' && key !== 'resultHandles') || !Object.hasOwn(candidate, 'state') ||
      candidate.state === null || typeof candidate.state !== 'object' || Array.isArray(candidate.state))
    return failure('runtime.interaction-denied', 'The host materializer returned an invalid region candidate.');
  if (candidate.resultHandles !== undefined && (!Array.isArray(candidate.resultHandles) || candidate.resultHandles.length > WIRE_LIMITS.array))
    return failure('runtime.interaction-budget', 'The host materializer returned too many result handles.');
  // ResultHandles are live capability objects. Copy and freeze the container,
  // but never recursively freeze the handles themselves: ResultStore leases
  // may need to update their internal state during region staging/commit.
  const resultHandles = candidate.resultHandles === undefined ? undefined : Object.freeze([...candidate.resultHandles] as ResultHandle[]);
  return {ok: true, value: Object.freeze({state: candidate.state as RegionContent,
    ...(resultHandles === undefined ? {} : {resultHandles})})};
}

interface ResolvedResult { readonly ref: ResultRef; readonly handle: ResultHandle; }
interface AppliedPayload { readonly state: CoreInteractionState; readonly result?: ResolvedResult; }
interface EventDeadline { expired: boolean; }

class InteractionControllerImpl implements InteractionController {
  private readonly queue: SerialQueue;
  private readonly maxEventMilliseconds: number;
  private readonly maxHops: number;
  private readonly maxQueuedEvents: number;
  private readonly pending = new Map<string, AbortController>();
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];
  private readonly graph: InteractionGraph;
  private readonly region: RegionHandle;
  private readonly options: InteractionControllerOptions;
  private observer: RegionObserver | undefined;
  private committing = false;
  private revoked = false;
  private disposed = false;

  constructor(options: InteractionControllerOptions) {
    if (options === null || typeof options !== 'object') throw new TypeError('Interaction controller options are required.');
    this.region = options.region;
    this.graph = options.graph;
    this.options = options;
    this.maxEventMilliseconds = options.maxEventMilliseconds ?? DEFAULT_MAX_EVENT_MILLISECONDS;
    this.maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;
    if (!Number.isSafeInteger(this.maxEventMilliseconds) || this.maxEventMilliseconds < 1 || this.maxEventMilliseconds > 86_400_000)
      throw new TypeError('maxEventMilliseconds must be a bounded positive duration.');
    if (!Number.isSafeInteger(this.maxHops) || this.maxHops < 1 || this.maxHops > WIRE_LIMITS.array)
      throw new TypeError('maxHops must be a bounded positive integer.');
    const snapshot = this.region.snapshot();
    if (snapshot.status !== 'active') throw new TypeError('An interaction controller requires an active region.');
    this.maxQueuedEvents = options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS;
    if (!Number.isSafeInteger(this.maxQueuedEvents) || this.maxQueuedEvents < 1 || this.maxQueuedEvents > WIRE_LIMITS.array)
      throw new TypeError('maxQueuedEvents must be a bounded positive integer.');
    this.queue = createSerialQueue(this.maxQueuedEvents);
    this.observer = this.region.observe((update) => {
      if (update.kind === 'revoke' || update.kind === 'dispose') {
        this.revoked = true;
        this.abortPending();
        return;
      }
      // A live update is read directly from the region snapshot by state().
      // During our own commit, the final snapshot check below decides whether
      // the receipt may be published; this callback never resurrects state.
      if (this.committing) return;
    });
  }

  /**
   * Controller revocation closes this event channel and aborts work. The host
   * owns read-access revocation and must revoke the region/result partition
   * when its authorization is withdrawn; controller.revoke() does not mutate
   * application-owned region data by itself.
   */
  state(): InteractionState { return publicState(this.region.snapshot()); }

  dispatch(input: unknown, options: InteractionDispatchOptions = {}): Promise<InteractionOutcome<InteractionReceipt>> {
    if (this.disposed) return Promise.resolve(failure('runtime.interaction-disposed', 'The interaction controller has been disposed.'));
    if (this.revoked) return Promise.resolve(failure('runtime.interaction-revoked', 'The interaction controller has been revoked.'));
    const parsed = parseContract('interaction', input);
    if (!parsed.ok) return Promise.resolve(failure('runtime.interaction-invalid', 'The interaction event is not a valid canonical wire event.'));
    const event = parsed.value;
    if (this.pending.has(event.eventId)) return Promise.resolve(failure('runtime.interaction-stale', 'An interaction with this event ID is already pending.'));
    // Admission must be synchronous: a flood of callers cannot create more
    // pending entries than the queue budget while rejected promises settle.
    if (this.pending.size >= this.maxQueuedEvents)
      return Promise.resolve(failure('runtime.interaction-budget', 'The interaction queue is full.'));
    const controller = new AbortController();
    const forward = () => controller.abort();
    options.signal?.addEventListener('abort', forward, {once: true});
    if (options.signal?.aborted) controller.abort();
    this.pending.set(event.eventId, controller);
    const run = this.queue.enqueue<InteractionOutcome<InteractionReceipt>>(() => this.process(event, options.sourcePortId, controller));
    return run.then((result): InteractionOutcome<InteractionReceipt> => result,
      (error: unknown) => failure<InteractionReceipt>('runtime.interaction-invalid', error instanceof Error ? error.message : 'The interaction queue rejected the event.'))
      .finally(() => { options.signal?.removeEventListener('abort', forward); this.pending.delete(event.eventId); });
  }

  cancel(eventId: string): boolean {
    const controller = this.pending.get(eventId);
    if (controller === undefined) return false;
    controller.abort();
    return true;
  }

  revoke(_reason?: string): boolean {
    if (this.disposed || this.revoked) return false;
    this.revoked = true;
    this.abortPending();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.revoked = true;
    this.abortPending();
    this.observer?.unsubscribe();
    this.observer = undefined;
    this.queue.close();
  }

  private abortPending(): void { for (const controller of this.pending.values()) controller.abort(); }

  private remember(eventId: string): void {
    if (this.seen.has(eventId)) return;
    this.seen.add(eventId);
    this.seenOrder.push(eventId);
    while (this.seenOrder.length > this.maxQueuedEvents * 4) {
      const old = this.seenOrder.shift();
      if (old !== undefined) this.seen.delete(old);
    }
  }

  private resolutionContext(event: InteractionEvent, host: InteractionHostContext, snapshot: RegionSnapshot, signal: AbortSignal): InteractionResolutionContext {
    return {event, host, region: snapshot, signal};
  }

  private readHost(snapshot: RegionSnapshot): InteractionOutcome<InteractionHostContext> {
    let host: InteractionHostContext;
    try { host = this.options.readContext(); } catch { return failure('runtime.interaction-denied', 'The host interaction context could not be read.'); }
    if (host === null || typeof host !== 'object' || Array.isArray(host) || !validText(host.principalKey) || !validText(host.draftDomain) ||
        host.actor === null || typeof host.actor !== 'object' || Array.isArray(host.actor) || !validText(host.actor.id) ||
        !['user', 'service', 'system'].includes(host.actor.kind) || !Array.isArray(host.grants) || host.grants.length > WIRE_LIMITS.array ||
        host.grants.some((grant) => !validText(grant)) || !validText(host.scopeDigest) || !validText(host.policyRevision) ||
        !validText(host.catalogRevision) || !validText(host.experienceRevision) || !validText(host.functionRegistryDigest) ||
        !Array.isArray(host.results) || host.results.length > WIRE_LIMITS.array || host.results.some((ref) => ref.scopeDigest !== host.scopeDigest))
      return failure('runtime.interaction-denied', 'The host interaction context is not bounded or current.');
    if (snapshot.readSet === undefined || host.catalogRevision !== snapshot.readSet.catalogRevision || host.experienceRevision !== snapshot.readSet.experienceRevision ||
        host.functionRegistryDigest !== snapshot.readSet.functionRegistryDigest || host.scopeDigest !== snapshot.readSet.scopeDigest ||
        host.policyRevision !== snapshot.readSet.policyRevision)
      return failure('runtime.interaction-stale', 'The host interaction context is stale against the region.');
    // Capture a bounded owned snapshot. Host applications may reuse and mutate
    // their context object while an async callback is pending; retaining that
    // object would make the original authorization silently change underneath
    // the controller's rechecks.
    const owned = Object.freeze({
      ...host,
      actor: Object.freeze({id: host.actor.id, kind: host.actor.kind}),
      grants: Object.freeze([...host.grants]),
      results: Object.freeze(host.results.map((ref) => Object.freeze({...ref}))),
    });
    return {ok: true, value: owned};
  }

  /** Re-read authorization after an async host operation and before effects/commit. */
  private currentHost(
    snapshot: RegionSnapshot,
    expected: InteractionHostContext,
    requiredGrants: readonly string[] = [],
  ): InteractionOutcome<InteractionHostContext> {
    const current = this.readHost(snapshot);
    if (!current.ok) return current;
    if (!sameTrustedContext(expected, current.value))
      return failure('runtime.interaction-stale', 'The trusted interaction context changed while the interaction was awaiting host work.');
    for (const grant of requiredGrants) {
      if (!hasGrant(current.value, grant)) return failure('runtime.interaction-denied', `The host no longer grants ${grant}.`);
    }
    return current;
  }

  private sourceRoute(event: InteractionEvent, sourcePortId: string | undefined): InteractionOutcome<InteractionRoute> {
    const node = this.graph.definition.nodes.find((candidate) => candidate.id === event.originNodeId);
    if (node === undefined) return failure('runtime.interaction-invalid', 'The interaction origin node is not registered.');
    if (sourcePortId !== undefined) {
      const port = node.ports.find((candidate) => candidate.id === sourcePortId);
      if (port === undefined) return failure('runtime.interaction-invalid', 'The interaction source port is not registered.');
      return {ok: true, value: {nodeId: node.id, portId: sourcePortId}};
    }
    const candidates = node.ports.filter((port) => port.payload === event.payload.kind && port.direction !== 'input');
    if (candidates.length !== 1) return failure('runtime.interaction-invalid', 'The interaction source port is ambiguous; provide sourcePortId.');
    return {ok: true, value: {nodeId: node.id, portId: candidates[0]!.id}};
  }

  private async callHost<T>(callback: InteractionHostCallback<T> | undefined, value: T, context: InteractionResolutionContext, controller: AbortController, deadline?: EventDeadline): Promise<InteractionOutcome<void>> {
    if (callback === undefined) return failure('runtime.interaction-denied', 'The host has not registered the required interaction callback.');
    if (deadline?.expired) return failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.');
    if (controller.signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let onAbort: (() => void) | undefined;
    const pending = Promise.resolve().then(() => callback(value, context));
    const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => { timedOut = true; resolve('timeout'); }, this.maxEventMilliseconds); });
    const aborted = new Promise<'aborted'>((resolve) => {
      onAbort = () => resolve('aborted');
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener('abort', onAbort, {once: true});
    });
    try {
      const result = await Promise.race([pending, timeout, aborted]);
      if (result === 'timeout' || timedOut) { controller.abort(); return failure('runtime.interaction-budget', 'The host interaction callback exceeded its bounded time budget.'); }
      if (result === 'aborted') return deadline?.expired
        ? failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.')
        : failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      if (controller.signal.aborted) return deadline?.expired
        ? failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.')
        : failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      return callbackOutcome(result);
    } catch {
      return failure('runtime.interaction-denied', 'The host interaction callback failed.');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) controller.signal.removeEventListener('abort', onAbort);
    }
  }

  private async callMaterialize(payloads: readonly InteractionQueryPayload[], context: InteractionResolutionContext, next: CoreInteractionState, controller: AbortController, deadline?: EventDeadline): Promise<InteractionOutcome<InteractionMaterialization>> {
    if (this.options.materialize === undefined) return failure('runtime.interaction-denied', 'The host has not registered a materializer for query-affecting interaction state.');
    if (deadline?.expired) return failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.');
    if (controller.signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let onAbort: (() => void) | undefined;
    const pending = Promise.resolve().then(() => this.options.materialize!(payloads, context, next));
    const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => { timedOut = true; resolve('timeout'); }, this.maxEventMilliseconds); });
    const aborted = new Promise<'aborted'>((resolve) => {
      onAbort = () => resolve('aborted');
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener('abort', onAbort, {once: true});
    });
    try {
      const result = await Promise.race([pending, timeout, aborted]);
      if (result === 'timeout' || timedOut) { controller.abort(); return failure('runtime.interaction-budget', 'The host materializer exceeded its bounded time budget.'); }
      if (result === 'aborted') return deadline?.expired
        ? failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.')
        : failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      if (controller.signal.aborted) return deadline?.expired
        ? failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.')
        : failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      return materializationOutcome(result);
    } catch {
      return failure('runtime.interaction-denied', 'The host materializer failed.');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) controller.signal.removeEventListener('abort', onAbort);
    }
  }

  private resultFor(outputId: string, context: InteractionResolutionContext): InteractionOutcome<ResolvedResult> {
    const refs = context.host.results.filter((ref) => ref.outputId === outputId);
    if (refs.length !== 1) return failure('runtime.interaction-stale', 'The interaction output is not uniquely bound to the current result scope.');
    const ref = refs[0]!;
    if (this.options.resolveResult === undefined) return failure('runtime.interaction-denied', 'The host has not registered a result resolver.');
    let handle: ResultHandle | undefined;
    try { handle = this.options.resolveResult(ref, context); } catch { return failure('runtime.interaction-denied', 'The host result resolver failed.'); }
    if (handle === undefined) return failure('runtime.interaction-stale', 'The interaction result is no longer available.');
    if (handle.key.principalKey !== context.host.principalKey) return failure('runtime.interaction-denied', 'The interaction result belongs to a different host principal.');
    const resolved = resultRefForHandle(handle);
    if (!resolved.ok || refKey(resolved.value) !== refKey(ref)) return failure('runtime.interaction-stale', 'The interaction result generation changed.');
    try {
      const status = handle.snapshot().status;
      if (!['ready', 'partial', 'refreshing'].includes(status)) return failure('runtime.interaction-stale', 'The interaction result is not currently readable.');
    } catch { return failure('runtime.interaction-stale', 'The interaction result could not be inspected.'); }
    return {ok: true, value: {ref, handle}};
  }

  private upsertValue(state: CoreInteractionState, route: InteractionRoute, payload: Extract<InteractionPayload, {readonly kind: 'selection' | 'filter' | 'range' | 'group' | 'page'}>): CoreInteractionState {
    const key = routeKey(route);
    const values = state.values.filter((entry) => routeKey(entry) !== key);
    return freeze({...state, values: freeze([...values, freeze({nodeId: route.nodeId, portId: route.portId, payload})])});
  }

  private clearValue(state: CoreInteractionState, route: InteractionRoute): CoreInteractionState {
    const key = routeKey(route);
    const values = state.values.filter((entry) => routeKey(entry) !== key);
    return values.length === state.values.length ? state : freeze({...state, values: freeze(values)});
  }

  private async applyPayload(
    payload: InteractionPayload,
    route: InteractionRoute,
    event: InteractionEvent,
    host: InteractionHostContext,
    snapshot: RegionSnapshot,
    controller: AbortController,
    deadline: EventDeadline,
    state: CoreInteractionState,
    effects: InteractionEffectReceipt[],
    navigations: Extract<InteractionPayload, {readonly kind: 'navigate'}>[],
  ): Promise<InteractionOutcome<AppliedPayload>> {
    const context = this.resolutionContext(event, host, snapshot, controller.signal);
    if (controller.signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
    if (payload.kind === 'selection') {
      if (!hasGrant(host, 'experience.commit')) return failure('runtime.interaction-denied', 'The host did not grant interaction state updates.');
      if (payload.selection.mode === 'clear') return {ok: true, value: {state: this.clearValue(state, route)}};
      let result: ResolvedResult | undefined;
      if (payload.selection.mode === 'ids') {
        if (!hasGrant(host, 'result.inspect')) return failure('runtime.interaction-denied', 'The host did not grant result inspection.');
        const keys = new Set(payload.selection.keys);
        if (keys.size !== payload.selection.keys.length) return failure('runtime.interaction-invalid', 'Entity selection keys must be unique.');
        const checked = this.resultFor(payload.selection.result.outputId, context);
        if (!checked.ok) return checked;
        if (refKey(checked.value.ref) !== refKey(payload.selection.result)) return failure('runtime.interaction-stale', 'The selected result is not the current authorized result.');
        result = checked.value;
      }
      const checked = await this.callHost(this.options.validateSelection, payload.selection, context, controller, deadline);
      if (!checked.ok) return checked;
      return result === undefined
        ? {ok: true, value: {state: this.upsertValue(state, route, payload)}}
        : {ok: true, value: {state: this.upsertValue(state, route, payload), result}};
    }
    if (payload.kind === 'filter' || payload.kind === 'range' || payload.kind === 'group' || payload.kind === 'page') {
      if (!hasGrant(host, 'experience.commit')) return failure('runtime.interaction-denied', 'The host did not grant interaction state updates.');
      if (!hasGrant(host, 'result.inspect')) return failure('runtime.interaction-denied', 'The host did not grant result inspection.');
      const result = this.resultFor(payload.outputId, context);
      if (!result.ok) return result;
      if (payload.kind === 'page' && payload.queryDigest !== result.value.ref.queryDigest) return failure('runtime.interaction-stale', 'The page cursor belongs to a different query generation.');
      const checked = await this.callHost(this.options.validateScope, payload, context, controller, deadline);
      if (!checked.ok) return checked;
      return {ok: true, value: {state: this.upsertValue(state, route, payload), result: result.value}};
    }
    if (payload.kind === 'draft') {
      if (!hasGrant(host, 'draft.edit') || !hasGrant(host, 'experience.commit')) return failure('runtime.interaction-denied', 'The host did not grant draft editing.');
      if (!validText(payload.key)) return failure('runtime.interaction-invalid', 'Draft edits require a stable entity key.');
      const current = state.drafts.find((draft) => draft.domain === host.draftDomain && draft.entity === payload.entity && draft.key === payload.key && draft.field === payload.field);
      if (current !== undefined && current.entityRevision !== payload.entityRevision)
        return failure('runtime.interaction-stale', 'The draft entity revision changed; resolve the draft conflict explicitly.');
      const checked = await this.callHost(this.options.validateDraft, payload, context, controller, deadline);
      if (!checked.ok) return checked;
      const nextDraft = freeze({domain: host.draftDomain, entity: payload.entity, key: payload.key, field: payload.field, value: payload.value, entityRevision: payload.entityRevision});
      const drafts = state.drafts.filter((draft) => !(draft.domain === host.draftDomain && draft.entity === payload.entity && draft.key === payload.key && draft.field === payload.field));
      return {ok: true, value: {state: freeze({...state, drafts: freeze([...drafts, nextDraft])})}};
    }
    if (payload.kind === 'navigate') {
      if (!hasGrant(host, 'navigation.propose')) return failure('runtime.interaction-denied', 'The host did not grant application navigation proposals.');
      const current = this.currentHost(snapshot, host, ['navigation.propose']);
      if (!current.ok) return current;
      const checked = await this.callHost(this.options.validateNavigation, payload, this.resolutionContext(event, current.value, snapshot, controller.signal), controller, deadline);
      if (!checked.ok) return checked;
      effects.push(freeze({kind: 'navigate', eventId: event.eventId, actorId: host.actor.id}));
      navigations.push(payload);
      return {ok: true, value: {state}};
    }
    if (payload.kind === 'action-request') {
      if (!hasGrant(host, 'action.propose')) return failure('runtime.interaction-denied', 'The host did not grant action proposals.');
      const current = this.currentHost(snapshot, host, ['action.propose']);
      if (!current.ok) return current;
      const checked = await this.callHost(this.options.onActionProposal, payload, this.resolutionContext(event, current.value, snapshot, controller.signal), controller, deadline);
      if (!checked.ok) return checked;
      effects.push(freeze({kind: 'action-proposal', eventId: event.eventId, actorId: host.actor.id}));
      return {ok: true, value: {state}};
    }
    return failure('runtime.interaction-unsupported', 'The interaction payload kind is not supported by this controller.');
  }

  private addHandle(handles: ResultHandle[], handle: ResultHandle): void {
    let key: string | undefined;
    try {
      const resolved = resultRefForHandle(handle);
      if (resolved.ok) key = refKey(resolved.value);
    } catch { /* malformed handles are rejected by region.stage */ }
    if (!handles.some((candidate) => {
      if (candidate === handle) return true;
      if (key === undefined) return false;
      try {
        const resolved = resultRefForHandle(candidate);
        return resolved.ok && refKey(resolved.value) === key;
      } catch { return false; }
    })) handles.push(handle);
  }

  private async materialize(
    payloads: readonly InteractionQueryPayload[],
    event: InteractionEvent,
    host: InteractionHostContext,
    snapshot: RegionSnapshot,
    next: CoreInteractionState,
    controller: AbortController,
    deadline: EventDeadline,
    handles: ResultHandle[],
  ): Promise<InteractionOutcome<RegionContent | undefined>> {
    if (payloads.length === 0) return {ok: true, value: undefined};
    const result = await this.callMaterialize(payloads, this.resolutionContext(event, host, snapshot, controller.signal), next, controller, deadline);
    if (!result.ok) return result;
    const checked = result.value.state.interaction === undefined ? undefined : parseInteractionState(result.value.state.interaction);
    if (checked === undefined || !checked.ok || canonical(checked.value) !== canonical(next))
      return failure('runtime.interaction-invalid', 'The host materializer must return the canonical next interaction state.');
    for (const handle of result.value.resultHandles ?? []) this.addHandle(handles, handle);
    return {ok: true, value: result.value.state};
  }

  /**
   * Extend the proposal read set with every live handle used by the candidate.
   * A host may add a fresh result during materialization; scalar pins remain
   * captured from the original region read set and are never rebased here.
   */
  private expectedReadSet(before: RegionSnapshot, handles: readonly ResultHandle[]): InteractionOutcome<RegionReadSet> {
    if (before.readSet === undefined) return failure('runtime.interaction-disposed', 'The region has no active read set.');
    const refs = [...before.readSet.results];
    const seen = new Set(refs.map((ref) => refKey(ref)));
    for (const handle of handles) {
      let resolved: ReturnType<typeof resultRefForHandle>;
      try { resolved = resultRefForHandle(handle); } catch { return failure('runtime.interaction-stale', 'A result handle could not be bound to the interaction read set.'); }
      if (!resolved.ok) return failure('runtime.interaction-stale', resolved.diagnostics[0]!.message);
      if (resolved.value.scopeDigest !== before.readSet.scopeDigest) return failure('runtime.interaction-stale', 'A result handle belongs to a different authorization scope.');
      const key = refKey(resolved.value);
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(resolved.value);
      }
    }
    if (refs.length > WIRE_LIMITS.array) return failure('runtime.interaction-budget', 'The interaction read set exceeds its result dependency budget.');
    return {ok: true, value: {...before.readSet, results: refs}};
  }

  private async commitState(
    event: InteractionEvent,
    before: RegionSnapshot,
    expected: RegionReadSet,
    next: CoreInteractionState,
    candidate: RegionContent | undefined,
    resultHandles: readonly ResultHandle[],
    controller: AbortController,
    deadline: EventDeadline,
    recheck: () => InteractionOutcome<void>,
  ): Promise<InteractionOutcome<RegionSnapshot>> {
    if (deadline.expired) return failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.');
    if (before.readSet === undefined || before.state === undefined) return failure('runtime.interaction-disposed', 'The region has no active state or read set.');
    if (this.region.snapshot().regionRevision !== before.regionRevision) return failure('runtime.interaction-stale', 'The region changed while the interaction was being prepared.');
    const state = candidate ?? {...before.state, interaction: next};
    const checked = state.interaction === undefined ? undefined : parseInteractionState(state.interaction);
    if (checked === undefined || !checked.ok || canonical(checked.value) !== canonical(next)) return failure('runtime.interaction-invalid', 'The interaction state candidate is not the prepared canonical state.');
    this.committing = true;
    try {
      const staged = await this.region.stage({requestId: event.eventId, expected, state, ...(resultHandles.length === 0 ? {} : {resultHandles})});
      if (!staged.ok) return failure('runtime.interaction-stale', staged.diagnostics[0]!.message);
      if (controller.signal.aborted) {
        this.region.discard(staged.value);
        return deadline.expired
          ? failure('runtime.interaction-budget', 'The interaction exceeded its bounded event time budget.')
          : failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
      }
      const committed = await this.region.commit(staged.value, {
        signal: controller.signal,
        recheck: () => {
          const checked = recheck();
          return checked.ok ? {ok: true, value: undefined} : checked;
        },
      });
      if (!committed.ok) {
        if (deadline.expired) return failure('runtime.interaction-budget', committed.diagnostics[0]!.message);
        if (controller.signal.aborted || committed.diagnostics[0]?.code === 'runtime.region-cancelled')
          return failure('runtime.interaction-cancelled', committed.diagnostics[0]!.message);
        return failure('runtime.interaction-stale', committed.diagnostics[0]!.message);
      }
      return committed;
    } finally {
      this.committing = false;
      const latest = this.region.snapshot();
      if (latest.status !== 'active') {
        this.revoked = true;
        this.abortPending();
      }
    }
  }

  private async process(event: InteractionEvent, sourcePortId: string | undefined, controller: AbortController): Promise<InteractionOutcome<InteractionReceipt>> {
    // Queue admission is intentionally outside this deadline. Once the event
    // starts processing, every callback, materializer and region commit shares
    // one abort signal and one bounded wall-clock budget.
    const deadline: EventDeadline = {expired: false};
    const timer = setTimeout(() => { deadline.expired = true; controller.abort(); }, this.maxEventMilliseconds);
    try {
      return await this.processEvent(event, sourcePortId, controller, deadline);
    } finally {
      clearTimeout(timer);
    }
  }

  private async processEvent(event: InteractionEvent, sourcePortId: string | undefined, controller: AbortController, deadline: EventDeadline): Promise<InteractionOutcome<InteractionReceipt>> {
    if (this.disposed) return failure('runtime.interaction-disposed', 'The interaction controller has been disposed.');
    if (this.revoked) return failure('runtime.interaction-revoked', 'The interaction controller has been revoked.');
    if (controller.signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
    const before = this.region.snapshot();
    if (before.status !== 'active') return failure(before.status === 'revoked' ? 'runtime.interaction-revoked' : 'runtime.interaction-disposed', 'The region is no longer active.');
    const host = this.readHost(before);
    if (!host.ok) return host;
    // Idempotent receipts still expose state, so authorize the current host
    // before returning a remembered event's snapshot.
    if (this.seen.has(event.eventId)) {
      return {ok: true, value: freeze({eventId: event.eventId, state: publicState(before), region: before, routed: [], effects: [], noop: true})};
    }
    if (event.regionId !== before.id || event.regionRevision !== before.regionRevision) return failure('runtime.interaction-stale', 'The interaction event is stale against the current region revision.');
    this.remember(event.eventId);
    const source = this.sourceRoute(event, sourcePortId);
    if (!source.ok) return source;
    const routed = this.graph.route(event, source.value, controller.signal, this.maxHops);
    if (!routed.ok) return routed;
    const routedItems: InteractionRoutedPayload[] = [{route: source.value, payload: event.payload, causationId: event.causationId}, ...routed.value];
    let state = persistedState(before);
    const effects: InteractionEffectReceipt[] = [];
    const navigations: Extract<InteractionPayload, {readonly kind: 'navigate'}>[] = [];
    const queryPayloads: InteractionQueryPayload[] = [];
    const resultHandles: ResultHandle[] = [];
    const requiredGrants = new Set<string>();
    const applied = new Set<string>();
    for (const item of routedItems) {
      const key = `${routeKey(item.route)}\u0000${canonical(item.payload)}`;
      if (applied.has(key)) continue;
      applied.add(key);
      const next = await this.applyPayload(item.payload, item.route, event, host.value, before, controller, deadline, state, effects, navigations);
      if (!next.ok) return next;
      state = next.value.state;
      for (const grant of grantsForPayload(item.payload)) requiredGrants.add(grant);
      if (next.value.result !== undefined) this.addHandle(resultHandles, next.value.result.handle);
      if (item.payload.kind === 'filter' || item.payload.kind === 'range' || item.payload.kind === 'group' || item.payload.kind === 'page') queryPayloads.push(item.payload);
    }
    const changed = canonical(state) !== canonical(persistedState(before));
    let region = before;
    let candidate: RegionContent | undefined;
    if (changed) {
      const materialized = await this.materialize(queryPayloads, event, host.value, before, state, controller, deadline, resultHandles);
      if (!materialized.ok) return materialized;
      const current = this.currentHost(before, host.value, [...requiredGrants]);
      if (!current.ok) return current;
      const expected = this.expectedReadSet(before, resultHandles);
      if (!expected.ok) return expected;
      candidate = materialized.value;
      const committed = await this.commitState(event, before, expected.value, state, candidate, resultHandles, controller, deadline,
        () => {
          const checked = this.currentHost(before, host.value, [...requiredGrants]);
          return checked.ok ? {ok: true, value: undefined} : checked;
        });
      if (!committed.ok) return committed;
      region = committed.value;
      if (this.revoked) return failure('runtime.interaction-revoked', 'The region was revoked during the interaction.');
    } else if (controller.signal.aborted) return failure('runtime.interaction-cancelled', 'The interaction was cancelled.');
    for (const navigate of navigations) {
      const current = this.currentHost(region, host.value, ['navigation.propose']);
      if (!current.ok) return current;
      const callback = await this.callHost(this.options.onNavigate, navigate, this.resolutionContext(event, current.value, region, controller.signal), controller, deadline);
      if (!callback.ok) return callback;
    }
    return {ok: true, value: freeze({eventId: event.eventId, state: publicState(region), region, routed: routed.value, effects, noop: !changed && effects.length === 0})};
  }
}

export function createInteractionController(options: InteractionControllerOptions): InteractionController {
  return new InteractionControllerImpl(options);
}
