import {
  composePresentation,
  validatePresentationPlan,
  type CommitPreconditions,
  type PresentationComposition,
  type PresentationCompositionRequest,
  type PresentationContext,
  type PresentationEnvironment,
  type PresentationPlan,
  type PresentationRegistry,
  type ValidatedPresentation,
} from '@aeliqo/core';
import type {
  RegionFailure,
  RegionHandle,
  RegionOutcome,
  RegionReadSet,
  RegionSnapshot,
  RegionUpdate,
} from '../regions/types.js';
import {
  projectInteractionState,
  projectNavigationState,
  type PresentationNavigationState,
  type PresentationProjectionInput,
  type PresentationProjectionState,
  type PresentationRenderer,
} from './renderer.js';

const failure = <T>(code: string, message: string): RegionOutcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false}],
});

type AdaptationContextFields = Omit<PresentationContext, 'task' | 'current' | 'incumbent' | 'environment'>;

/**
 * Host-owned context that is safe to refresh for every adaptation request.
 * Task, current read-set and incumbent are deliberately absent: the controller
 * derives all three from the current RegionSnapshot immediately before compose.
 */
export type PresentationAdaptationContext = AdaptationContextFields &
  Partial<Pick<PresentationContext, 'environment' | 'transitionBlocked' | 'explicitTransition'>> & {
    /** Optional host proposals; all use the same core feasibility validator. */
    readonly candidates?: PresentationCompositionRequest['candidates'];
  };

export interface PresentationAdaptationReadInput {
  readonly region: RegionHandle;
  readonly snapshot: RegionSnapshot;
  readonly environment: PresentationEnvironment;
  readonly signal: AbortSignal;
}

export type PresentationAdaptationContextSource =
  | PresentationAdaptationContext
  | ((input: PresentationAdaptationReadInput) =>
    | PresentationAdaptationContext
    | RegionOutcome<PresentationAdaptationContext>
    | Promise<PresentationAdaptationContext | RegionOutcome<PresentationAdaptationContext>>);

export interface PresentationAdaptationOptions {
  readonly region: RegionHandle;
  readonly registry: PresentationRegistry;
  /** Base host context. Its task/current/incumbent members are ignored. */
  readonly baseContext: PresentationAdaptationContextSource;
  /** Optional per-request full replacement context. It runs after the request
   * has been queued; task/current/incumbent are still ignored and the base
   * context is not merged into its result. */
  readonly readContext?: PresentationAdaptationContextSource;
  readonly renderer: PresentationRenderer;
  /** Optional live host guard checked before composition and publication. */
  readonly transitionBlocked?: () => boolean;
  /** Optional application-owned navigation state carried by the renderer. */
  readonly readNavigation?: () => PresentationNavigationState | undefined;
  /** Injectable clock/scheduler keep resize tests deterministic and bounded. */
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMilliseconds: number) => unknown;
  readonly cancelSchedule?: (handle: unknown) => void;
  /** Minimum time between committed structural transitions. Defaults to 120ms. */
  readonly dwellMs?: number;
  /** Ignore size-only changes below this threshold. Defaults to 8 CSS pixels. */
  readonly hysteresisPx?: number;
  /** Coalesced callers are bounded; defaults to 64. */
  readonly maxPendingRequests?: number;
}

export type PresentationAdaptationStatus =
  | 'committed'
  | 'unchanged'
  | 'deferred'
  | 'cancelled';

export interface PresentationAdaptationResult {
  readonly status: PresentationAdaptationStatus;
  readonly snapshot: RegionSnapshot;
  readonly composition?: PresentationComposition;
  readonly reason?: string;
}

export interface PresentationAdaptationRequestOptions {
  /** User-triggered transitions may bypass explicit-only profile policy. */
  readonly explicit?: boolean;
  /** Skip size hysteresis for a user-triggered retry. */
  readonly force?: boolean;
}

export interface PresentationAdaptationController {
  /** Queue the newest measured environment; concurrent resize requests coalesce. */
  request(
    environment: PresentationEnvironment,
    options?: PresentationAdaptationRequestOptions,
  ): Promise<RegionOutcome<PresentationAdaptationResult>>;
  /** Run the newest queued request immediately, subject to cancellation/dwell policy. */
  flush(): Promise<RegionOutcome<PresentationAdaptationResult>>;
  readonly pending: boolean;
  dispose(): void;
}

interface PendingRequest {
  readonly environment: PresentationEnvironment;
  readonly options: PresentationAdaptationRequestOptions;
  readonly resolve: (outcome: RegionOutcome<PresentationAdaptationResult>) => void;
}

interface ContextInput {
  readonly source: PresentationAdaptationContextSource;
  readonly input: PresentationAdaptationReadInput;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function samePlan(left: PresentationPlan | undefined, right: PresentationPlan | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  // Request identity, revisions, preconditions and transfer instructions are
  // publication metadata. Compare every user-visible semantic member so an
  // unchanged candidate does not churn the region, while changes to variants,
  // configuration, links, coverage or enabled operations still publish.
  return canonical({
    rootId: left.rootId,
    nodes: left.nodes,
    links: left.links,
    coverage: left.coverage,
  }) === canonical({
    rootId: right.rootId,
    nodes: right.nodes,
    links: right.links,
    coverage: right.coverage,
  });
}

function validNonnegativeInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0;
}

function readMeasurement(environment: PresentationEnvironment, key: 'inlineSize' | 'blockSize' | 'textScale'): number | undefined {
  const measurement = environment[key];
  return measurement.state === 'known' && Number.isFinite(measurement.value) ? measurement.value : undefined;
}

function environmentRequiresRefresh(previous: PresentationEnvironment | undefined, next: PresentationEnvironment, threshold: number): boolean {
  if (previous === undefined) return true;
  if (previous.locale !== next.locale || previous.direction !== next.direction || previous.pointer !== next.pointer ||
      previous.hover !== next.hover || previous.keyboard !== next.keyboard || previous.reducedMotion !== next.reducedMotion ||
      previous.forcedColors !== next.forcedColors) return true;
  for (const key of ['inlineSize', 'blockSize', 'textScale'] as const) {
    const before = readMeasurement(previous, key);
    const after = readMeasurement(next, key);
    if (before === undefined || after === undefined) return true;
    // Text scale is an accessibility input rather than a layout noise signal;
    // any known change must be reevaluated even when the container is fixed.
    if (key === 'textScale' && before !== after) return true;
    if (Math.abs(after - before) >= threshold) return true;
  }
  return false;
}

function snapshotReadSet(snapshot: RegionSnapshot): RegionOutcome<RegionReadSet> {
  if (snapshot.status !== 'active' || snapshot.state === undefined || snapshot.readSet === undefined)
    return failure('runtime.presentation-disposed', 'The region has no active task and read set.');
  return {ok: true, value: snapshot.readSet};
}

function semanticReadSet(readSet: RegionReadSet): CommitPreconditions {
  const {dataRevision: _dataRevision, ...pins} = readSet;
  return pins;
}

function sameSnapshot(left: RegionSnapshot, right: RegionSnapshot): boolean {
  return left.status === right.status && left.taskRevision === right.taskRevision &&
    left.regionRevision === right.regionRevision && left.dataRevision === right.dataRevision;
}

function normalizeContextOutcome(value: unknown): RegionOutcome<PresentationAdaptationContext> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.hasOwn(value as object, 'ok')) {
    const outcome = value as {readonly ok?: unknown; readonly value?: unknown; readonly diagnostics?: unknown};
    if (outcome.ok === true) return normalizeContextOutcome(outcome.value);
    if (outcome.ok === false && Array.isArray(outcome.diagnostics) && outcome.diagnostics.length > 0)
      return {ok: false, diagnostics: outcome.diagnostics as unknown as readonly [RegionFailure, ...RegionFailure[]]};
    return failure('runtime.presentation-context', 'The host context callback returned an invalid outcome.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return failure('runtime.presentation-context', 'The host context is not a bounded object.');
  const context = value as Record<string, unknown>;
  if (context.experience === undefined || context.results === undefined)
    return failure('runtime.presentation-context', 'Adaptation context requires an Experience and authorized result descriptors.');
  if (!Array.isArray(context.results) || !Array.isArray(context.rendererCapabilities))
    return failure('runtime.presentation-context', 'Adaptation context requires result descriptors and renderer capabilities.');
  // A caller may conveniently pass a full PresentationContext. Strip its
  // snapshot-owned pins instead of trusting them; contextFor() below derives
  // these fields from the RegionSnapshot for this exact request.
  const {task: _task, current: _current, incumbent: _incumbent, ...host} = context;
  return {ok: true, value: host as unknown as PresentationAdaptationContext};
}

async function readSource(input: ContextInput): Promise<RegionOutcome<PresentationAdaptationContext>> {
  try {
    const raw = typeof input.source === 'function' ? input.source(input.input) : input.source;
    if (raw === null || typeof raw !== 'object' || typeof (raw as PromiseLike<unknown>).then !== 'function')
      return normalizeContextOutcome(raw);
    // Host refresh callbacks are expected to honor AbortSignal, but the
    // controller must settle when a buggy/legacy callback ignores it. The
    // callback continues in the background; its late value is discarded.
    return await new Promise<RegionOutcome<PresentationAdaptationContext>>((resolve) => {
      let settled = false;
      const finish = (outcome: RegionOutcome<PresentationAdaptationContext>): void => {
        if (settled) return;
        settled = true;
        input.input.signal.removeEventListener('abort', onAbort);
        resolve(outcome);
      };
      const onAbort = (): void => finish(failure('runtime.presentation-cancelled', 'The adaptation context refresh was cancelled.'));
      input.input.signal.addEventListener('abort', onAbort, {once: true});
      if (input.input.signal.aborted) { onAbort(); return; }
      Promise.resolve(raw).then((value) => finish(normalizeContextOutcome(value)), () => finish(failure('runtime.presentation-context', 'The host context callback failed.')));
    });
  } catch {
    return failure('runtime.presentation-context', 'The host context callback failed.');
  }
}

function failureFromCore<T>(outcome: {readonly ok: false; readonly diagnostics: readonly unknown[]}): RegionOutcome<T> {
  return {ok: false, diagnostics: outcome.diagnostics as readonly [RegionFailure, ...RegionFailure[]]};
}

function contextFor(
  snapshot: RegionSnapshot,
  base: PresentationAdaptationContext,
  environment: PresentationEnvironment,
  explicit: boolean,
): RegionOutcome<PresentationContext> {
  const readSet = snapshotReadSet(snapshot);
  if (!readSet.ok) return readSet;
  if (snapshot.state === undefined) return failure('runtime.presentation-disposed', 'The region has no current task.');
  return {ok: true, value: {
    ...base,
    task: snapshot.state.task,
    current: semanticReadSet(readSet.value),
    environment,
    ...(snapshot.state.presentation === undefined ? {} : {incumbent: snapshot.state.presentation}),
    explicitTransition: explicit,
  }};
}

function resultForPlan(
  validated: ValidatedPresentation,
  plan: PresentationPlan,
): ValidatedPresentation {
  // RegionStore rewrites only task and plan read-set revisions during commit.
  // Keep the validated semantic graph while adopting the exact committed plan.
  return Object.freeze({...validated, plan});
}

function readTransitionBlocked(callback: (() => boolean) | undefined): boolean {
  if (callback === undefined) return false;
  try { return callback() === true; } catch { return true; }
}

function makeRequestId(counter: number): {readonly id: string; readonly revision: string} {
  return {id: `adapt.${counter.toString(36)}`, revision: '1'};
}

/**
 * Runtime adaptation coordinator. It performs no model/provider work: each
 * request is a local compose/validate pass followed by a RegionHandle
 * transaction, and newer measurements cancel/coalesce older work.
 */
export function createPresentationAdaptationController(options: PresentationAdaptationOptions): PresentationAdaptationController {
  if (options === null || typeof options !== 'object' || options.region === undefined || options.registry === undefined ||
      options.baseContext === undefined || options.renderer === undefined)
    throw new TypeError('A region, presentation registry, context and renderer are required.');
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? ((callback: () => void, delay: number) => setTimeout(callback, delay));
  const cancelSchedule = options.cancelSchedule ?? ((handle: unknown) => { if (handle !== undefined) clearTimeout(handle as ReturnType<typeof setTimeout>); });
  const dwellMs = options.dwellMs ?? 120;
  const hysteresisPx = options.hysteresisPx ?? 8;
  const maxPending = options.maxPendingRequests ?? 64;
  if (!validNonnegativeInteger(dwellMs) || !validNonnegativeInteger(hysteresisPx) || !validNonnegativeInteger(maxPending) || maxPending < 1)
    throw new TypeError('Adaptation budgets must be nonnegative safe integers.');

  let disposed = false;
  let pending: PendingRequest | undefined;
  let waiters: ((outcome: RegionOutcome<PresentationAdaptationResult>) => void)[] = [];
  let scheduled: unknown;
  let scheduledActive = false;
  let scheduleEpoch = 0;
  let running: Promise<RegionOutcome<PresentationAdaptationResult>> | undefined;
  let runningWaiters: readonly ((outcome: RegionOutcome<PresentationAdaptationResult>) => void)[] = [];
  let activeController: AbortController | undefined;
  let requestCounter = 0;
  let lastEnvironment: PresentationEnvironment | undefined;
  let lastCommitAt: number | undefined;
  let closedByRegion = false;

  const safeNow = (): number => {
    try {
      const value = now();
      return Number.isFinite(value) ? value : 0;
    } catch {
      // A broken test/host clock must not strand an adaptation promise. An
      // immediate retry is safer than holding a queued resize indefinitely.
      return 0;
    }
  };

  const clearPending = (outcome: RegionOutcome<PresentationAdaptationResult>): void => {
    const current = waiters;
    waiters = [];
    for (const resolve of current) resolve(outcome);
  };

  const settleRunning = (outcome: RegionOutcome<PresentationAdaptationResult>): void => {
    const current = runningWaiters;
    runningWaiters = [];
    for (const resolve of current) resolve(outcome);
  };

  const cancelScheduled = (): void => {
    scheduleEpoch++;
    if (!scheduledActive) return;
    if (scheduled !== undefined) { try { cancelSchedule(scheduled); } catch { /* best effort */ } }
    scheduled = undefined;
    scheduledActive = false;
  };

  const observe = (update: RegionUpdate): void => {
    if (update.kind === 'revoke' || update.kind === 'dispose') {
      try { options.renderer.clear(update.reason); } catch { /* renderer clear is best effort after authorization loss */ }
      closedByRegion = true;
      cancelScheduled();
      pending = undefined;
      const outcome = failure<PresentationAdaptationResult>(
        update.kind === 'revoke' ? 'runtime.presentation-revoked' : 'runtime.presentation-disposed',
        update.kind === 'revoke' ? 'The region authorization was revoked.' : 'The region was disposed.',
      );
      clearPending(outcome);
      settleRunning(outcome);
      activeController?.abort();
    }
  };
  const observer = options.region.observe(observe);
  if (observer.closed) {
    closedByRegion = true;
    try { options.renderer.clear("The region was already closed."); } catch { /* clearing remains the renderer owner responsibility */ }
  }

  const run = async (request: PendingRequest): Promise<RegionOutcome<PresentationAdaptationResult>> => {
    const controller = new AbortController();
    activeController = controller;
    const signal = controller.signal;
    const before = options.region.snapshot();
    if (disposed) return failure('runtime.presentation-disposed', 'The adaptation controller is disposed.');
    if (before.status !== 'active' || before.state === undefined || before.readSet === undefined)
      return failure('runtime.presentation-disposed', 'The region is no longer active.');
    if (!request.options.force && !environmentRequiresRefresh(lastEnvironment, request.environment, hysteresisPx)) {
      // Keep the baseline at the last successfully applied environment so
      // successive small resize deltas can accumulate.
      return {ok: true, value: {status: 'deferred', snapshot: before, reason: 'hysteresis'}};
    }
    const currentReadSet = snapshotReadSet(before);
    if (!currentReadSet.ok) return currentReadSet;
    const contextInput: PresentationAdaptationReadInput = {region: options.region, snapshot: before, environment: request.environment, signal};
    const source = options.readContext ?? options.baseContext;
    const refreshed = await readSource({source, input: contextInput});
    if (signal.aborted) return failure('runtime.presentation-cancelled', 'The adaptation was cancelled.');
    if (!refreshed.ok) return refreshed;
    const beforeRefresh = options.region.snapshot();
    if (!sameSnapshot(before, beforeRefresh)) return failure('runtime.presentation-stale', 'The region changed while its adaptation context was refreshed.');
    const explicit = request.options.explicit ?? refreshed.value.explicitTransition === true;
    const context = contextFor(before, refreshed.value, request.environment, explicit);
    if (!context.ok) return context;
    if (readTransitionBlocked(options.transitionBlocked)) {
      return {ok: true, value: {status: 'deferred', snapshot: before, reason: 'transition-blocked'}};
    }
    if (context.value.transitionBlocked === true) {
      return {ok: true, value: {status: 'deferred', snapshot: before, reason: 'transition-blocked'}};
    }
    if (before.state.presentation !== undefined && refreshed.value.experience.transitionPolicy === 'explicit-only' && !explicit) {
      // The compiler may otherwise return the incumbent as a valid fallback.
      // Defer before composition so a blocked measurement remains retryable.
      return {ok: true, value: {status: 'deferred', snapshot: before, reason: 'transition-blocked'}};
    }
    const requestIdentity = makeRequestId(++requestCounter);
    const composed = composePresentation({id: requestIdentity.id, revision: requestIdentity.revision, preconditions: semanticReadSet(currentReadSet.value), context: context.value, ...(refreshed.value.candidates === undefined ? {} : {candidates: refreshed.value.candidates})}, options.registry);
    if (!composed.ok) return failureFromCore(composed);
    if (signal.aborted) return failure('runtime.presentation-cancelled', 'The adaptation was cancelled.');
    const candidate = composed.value.presentation;
    if (candidate === undefined) return failure('runtime.presentation-conflict', 'No feasible presentation was found for the measured environment.');
    const incumbent = before.state.presentation;
    if (samePlan(candidate.plan, incumbent)) {
      return {ok: true, value: {status: 'unchanged', snapshot: before, composition: composed.value}};
    }
    // A committed plan carries the transfer that produced it. Validate it as
    // an incumbent source graph, where historical transfer instructions are
    // metadata for the prior transition rather than candidate state.
    const previousValidated = incumbent === undefined ? undefined : validatePresentationPlan({...incumbent, stateTransfer: []}, context.value, options.registry);
    if (previousValidated !== undefined && !previousValidated.ok) return failureFromCore(previousValidated);
    const interaction = projectInteractionState(previousValidated?.value, candidate, before.state.interaction);
    if (!interaction.ok) return interaction;
    let currentNavigation: PresentationNavigationState | undefined;
    try { currentNavigation = options.readNavigation?.(); }
    catch { return failure('runtime.presentation-navigation', 'The host navigation state could not be read.'); }
    const navigation = projectNavigationState(previousValidated?.value, candidate, currentNavigation);
    if (!navigation.ok) return navigation;
    const nextProjection: PresentationProjectionState = Object.freeze({presentation: candidate,
      ...(interaction.value === undefined ? {} : {interaction: interaction.value}),
      ...(navigation.value === undefined ? {} : {navigation: navigation.value})});
    const previousNavigation = currentNavigation;
    const projectionInput: PresentationProjectionInput = {next: nextProjection, signal,
      ...(previousValidated?.value === undefined ? {} : {previous: {presentation: previousValidated.value,
        ...(before.state.interaction === undefined ? {} : {interaction: before.state.interaction}),
        ...(previousNavigation === undefined ? {} : {navigation: previousNavigation})}})};
    const staged = await options.region.stage({requestId: requestIdentity.id, expected: currentReadSet.value,
      state: {task: before.state.task, presentation: candidate.plan, ...(interaction.value === undefined ? {} : {interaction: interaction.value})},
    });
    if (!staged.ok) return staged;
    const discard = (): void => { try { options.region.discard(staged.value); } catch { /* an already-consumed token is harmless */ } };
    if (signal.aborted) { discard(); return failure('runtime.presentation-cancelled', 'The adaptation was cancelled.'); }
    let prepared: RegionOutcome<import('./renderer.js').PreparedPresentationProjection>;
    try { prepared = options.renderer.prepare(projectionInput); }
    catch { discard(); return failure('runtime.presentation-renderer', 'The renderer could not prepare the presentation projection.'); }
    if (!prepared.ok) { discard(); return prepared; }
    const rollback = (): void => { try { prepared.value.rollback(); } catch { /* renderer revoke/clear remains the last recovery boundary */ } };
    const recheck = (prospective?: RegionSnapshot): RegionOutcome<void> => {
      if (signal.aborted) return failure('runtime.presentation-cancelled', 'The adaptation was cancelled before publication.');
      if (readTransitionBlocked(options.transitionBlocked)) return failure('runtime.presentation-transition-blocked', 'The presentation transition is blocked by an active interaction.');
      const current = options.region.snapshot();
      if (!sameSnapshot(before, current)) return failure('runtime.presentation-stale', 'The region changed before the presentation could be committed.');
      const finalPlan = prospective?.state?.presentation;
      if (finalPlan === undefined) return failure('runtime.presentation-stale', 'The region did not provide the prospective presentation revisions.');
      const finalPresentation = resultForPlan(candidate, finalPlan);
      const finalProjection: PresentationProjectionState = Object.freeze({...nextProjection, presentation: finalPresentation});
      let applied: RegionOutcome<void>;
      try { applied = prepared.value.apply(finalProjection); }
      catch { rollback(); return failure('runtime.presentation-renderer', 'The renderer could not apply the prepared projection.'); }
      if (!applied.ok) { rollback(); return applied; }
      return {ok: true, value: undefined};
    };
    const committed = await options.region.commit(staged.value, {signal, recheck});
    if (!committed.ok) { rollback(); return committed; }
    lastEnvironment = request.environment;
    lastCommitAt = safeNow();
    // Adopt the exact committed plan metadata for renderer callbacks that keep
    // a projection snapshot. The semantic graph is unchanged by RegionStore's
    // revision rewrite, so this update is informational and cannot fail.
    const committedPlan = committed.value.state?.presentation;
    const result: PresentationComposition = Object.freeze({...composed.value,
      presentation: committedPlan === undefined ? candidate : resultForPlan(candidate, committedPlan)});
    return {ok: true, value: {status: 'committed', snapshot: committed.value, composition: result}};
  };

  function scheduleStart(delay: number): void {
    if (disposed || scheduledActive || running !== undefined || pending === undefined) return;
    const epoch = ++scheduleEpoch;
    const callback = (): void => {
      if (epoch !== scheduleEpoch || disposed || closedByRegion) return;
      scheduleEpoch++;
      scheduled = undefined;
      scheduledActive = false;
      const request = pending;
      if (request === undefined || disposed) return;
      pending = undefined;
      const waitersAtStart = waiters;
      waiters = [];
      startRunning(request, waitersAtStart);
    };
    try {
      const handle = schedule(callback, delay);
      // A synchronous scheduler may have already started the run. Do not leave
      // a stale cancellation handle behind in that case.
      if (running === undefined && pending !== undefined) {
        scheduled = handle;
        scheduledActive = true;
      }
    } catch {
      scheduled = undefined;
      scheduledActive = false;
      pending = undefined;
      clearPending(failure('runtime.presentation-schedule', 'The adaptation scheduler failed.'));
    }
  }

  function startRunning(
    request: PendingRequest,
    waitersAtStart: readonly ((outcome: RegionOutcome<PresentationAdaptationResult>) => void)[],
  ): Promise<RegionOutcome<PresentationAdaptationResult>> {
    runningWaiters = waitersAtStart;
    let task: Promise<RegionOutcome<PresentationAdaptationResult>>;
    try { task = run(request); }
    catch { task = Promise.resolve(failure('runtime.presentation-context', 'The adaptation failed before it could settle.')); }
    running = task.then((outcome) => {
      settleRunning(outcome);
      return outcome;
    }, () => {
      const outcome = failure<PresentationAdaptationResult>('runtime.presentation-context', 'The adaptation failed before publication.');
      settleRunning(outcome);
      return outcome;
    }).finally(() => {
      running = undefined;
      if (pending !== undefined && !disposed) {
        const dwell = lastCommitAt === undefined ? 0 : Math.max(0, dwellMs - (safeNow() - lastCommitAt));
        scheduleStart(dwell);
      }
    });
    return running;
  }

  const execute = (): Promise<RegionOutcome<PresentationAdaptationResult>> => {
    if (running !== undefined) return running;
    if (pending === undefined) return Promise.resolve(failure('runtime.presentation-queue', 'No adaptation request is queued.'));
    cancelScheduled();
    const request = pending;
    pending = undefined;
    const waitersAtStart = waiters;
    waiters = [];
    return startRunning(request, waitersAtStart);
  };

  const queue = (environment: PresentationEnvironment, requestOptions: PresentationAdaptationRequestOptions = {}): Promise<RegionOutcome<PresentationAdaptationResult>> => {
    if (disposed || closedByRegion) return Promise.resolve(failure('runtime.presentation-disposed', 'The adaptation controller is disposed.'));
    if (waiters.length >= maxPending) return Promise.resolve(failure('runtime.presentation-budget', 'The adaptation request queue is full.'));
    activeController?.abort();
    return new Promise((resolve) => {
      pending = {environment, options: requestOptions, resolve};
      waiters.push(resolve);
      if (running !== undefined) return;
      const delay = lastCommitAt === undefined ? 0 : Math.max(0, dwellMs - (safeNow() - lastCommitAt));
      scheduleStart(delay);
    });
  };

  return {
    request: queue,
    flush: () => {
      if (disposed || closedByRegion) return Promise.resolve(failure('runtime.presentation-disposed', 'The adaptation controller is disposed.'));
      if (running !== undefined) return running;
      return execute();
    },
    get pending() { return !disposed && !closedByRegion && (pending !== undefined || running !== undefined); },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      activeController?.abort();
      settleRunning(failure('runtime.presentation-disposed', 'The adaptation controller is disposed.'));
      cancelScheduled();
      observer.unsubscribe();
      pending = undefined;
      clearPending(failure('runtime.presentation-disposed', 'The adaptation controller is disposed.'));
    },
  };
}

export type {PresentationNavigationState, PresentationProjectionInput, PresentationProjectionState, PresentationRenderer};
