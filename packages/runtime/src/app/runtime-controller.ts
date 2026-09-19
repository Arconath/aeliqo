import type { Outcome, Task } from '@aeliqo/core';
import { createTaskEvaluator } from '../evaluation/task.js';
import type { TrustedEvaluationContext } from '../evaluation/types.js';
import { createRegionStore } from '../regions/store.js';
import type { RegionAuthority, RegionHandle, RegionOutcome, RegionSnapshot, RegionStore } from '../regions/types.js';
import type { ResultHandle, ResultStore } from '../results/types.js';
import { RuntimeSurfaceFactory } from '../surfaces/runtime-factory.js';
import type { CreateCapabilitySurfaceInput, CreateDataSurfaceInput } from '../surfaces/types.js';
import { ScopeControllerImpl } from '../scopes/controller.js';
import type { CreateScopeInput, ScopeController } from '../scopes/types.js';
import type {
  AeliqoRuntime,
  AeliqoRuntimeOptions,
  AppAuthorityContext,
  RuntimeEffect,
  RuntimeMountInput,
  RuntimePresentationInput,
  RuntimeRegionState,
  RuntimeRenderInput,
  RuntimeRenderReceipt,
  RuntimeResourceBinding,
  RuntimeResourceContext,
} from './types.js';
import { readAuthority } from './runtime-authority.js';
import { describeResource, resolveTrackedResult } from './runtime-resource.js';
import { RuntimeRenderCoordinator } from './runtime-render.js';
import type { RuntimeRenderHost, RuntimeRenderPrepare } from './runtime-render.js';
import { createTrackedResultStore } from './runtime-result-store.js';
import type { MountedRegion } from './runtime-state.js';
import { diagnostic, failure, sameAuthority, sameTask, statusFor, uniqueRefs, validId } from './runtime-state.js';

interface PresentationTarget {
  readonly slot: MountedRegion;
  readonly region: RegionHandle;
}

export class RuntimeController implements RuntimeRenderHost {
  readonly intents: AeliqoRuntimeOptions['intents'];
  readonly regions: RegionStore;
  readonly evaluator: ReturnType<typeof createTaskEvaluator>;
  private readonly options: AeliqoRuntimeOptions;
  private readonly resources: Map<string, RuntimeResourceBinding>;
  private readonly resultStore: ResultStore;
  private readonly trackedHandles: Set<ResultHandle>;
  private readonly ownsResultStore: boolean;
  private readonly mounted = new Map<string, MountedRegion>();
  private readonly renderer: RuntimeRenderCoordinator;
  private readonly surfaceFactory: RuntimeSurfaceFactory;
  private readonly scopes = new Set<ScopeController>();
  private disposed = false;

  constructor(options: AeliqoRuntimeOptions) {
    validateOptions(options);
    this.options = options;
    this.resources = indexResources(options.resources);
    this.intents = options.intents;
    const tracked = createTrackedResultStore(options);
    this.resultStore = tracked.store;
    this.trackedHandles = tracked.handles;
    this.ownsResultStore = tracked.owned;
    this.regions = createRegionStore({
      readAuthority: (regionId) => this.readRegionAuthority(regionId),
      authorizeCommit: (input) => this.authorizeRegionCommit(input.regionId, input.authority, input.signal),
      ...(options.maxRegions === undefined ? {} : { maxRegions: options.maxRegions }),
    });
    this.evaluator = createTaskEvaluator({
      host: { readContext: (input) => this.readEvaluationContext(input.task, input.signal) },
      ...(options.maxRenderMilliseconds === undefined ? {} : { maxMilliseconds: options.maxRenderMilliseconds }),
    });
    this.renderer = new RuntimeRenderCoordinator(this);
    this.surfaceFactory = new RuntimeSurfaceFactory({
      runtimeId: options.runtimeId ?? `runtime-${nextRuntimeId++}`,
      mount: (input, binding) => this.mountSurface(input, binding),
      render: (input, prepare) => this.render(input, prepare),
      unmount: (regionId) => this.unmount(regionId),
    });
  }

  create(): AeliqoRuntime {
    const runtime: AeliqoRuntime = {
      ...(this.options.actionPort === undefined ? {} : { actionPort: this.options.actionPort }),
      createScope: (input) => this.createScope(input),
      createLocalSurfaceScope: (input) => this.surfaceFactory.createLocalScope(input),
      createSurface: ((input: CreateDataSurfaceInput<unknown> | CreateCapabilitySurfaceInput<unknown, unknown>) =>
        this.surfaceFactory.create(input)) as AeliqoRuntime['createSurface'],
      mount: (input) => this.mount(input),
      render: (input) => this.render(input),
      context: (regionId) => this.context(regionId),
      contexts: (regionId) => this.contexts(regionId),
      commitPresentation: (input) => this.commitPresentation(input),
      snapshot: (regionId) => this.snapshot(regionId),
      subscribe: (regionId, listener) => this.subscribe(regionId, listener),
      unmount: (regionId) => this.unmount(regionId),
      dispose: () => this.dispose(),
    };
    return Object.freeze(runtime);
  }

  getSlot(regionId: string): MountedRegion | undefined {
    return this.mounted.get(regionId);
  }

  getResource(slot: MountedRegion): RuntimeResourceBinding | undefined {
    return slot.surfaceBinding ?? this.resources.get(slot.resourceId);
  }

  preparePrincipal(slot: MountedRegion, signal: AbortSignal): Outcome<AppAuthorityContext> {
    const current = this.authorityFor(slot, 'render', signal);
    if (!current.ok) {
      this.clearDeniedPrincipal(slot);
      return current;
    }
    if (slot.principalKey !== undefined && slot.principalKey !== current.value.principalKey)
      this.replacePrincipal(slot, slot.principalKey);
    slot.principalKey = current.value.principalKey;
    return current;
  }

  setState(slot: MountedRegion, state: RuntimeRegionState): void {
    slot.state = Object.freeze(state);
    this.notify(slot);
  }

  failReceipt(
    slot: MountedRegion,
    sequence: number,
    requestId: string,
    diagnostics: RuntimeRenderReceipt['diagnostics'],
    task?: Task,
  ): RuntimeRenderReceipt {
    if (slot.sequence !== sequence) return this.cancelledReceipt(slot, requestId, task);
    const status = statusFor(diagnostics);
    const region = this.regionSnapshot(slot.regionId);
    this.setState(slot, {
      regionId: slot.regionId,
      resourceId: slot.resourceId,
      phase: status,
      requestId,
      ...(task === undefined ? {} : { task }),
      results: slot.refs,
      diagnostics,
      ...(region === undefined ? {} : { region }),
    });
    return { status, requestId, regionId: slot.regionId, diagnostics, ...(task === undefined ? {} : { task }) };
  }

  mount(input: RuntimeMountInput) {
    const valid = this.validateMount(input);
    if (!valid.ok) return valid;
    const state = this.initialState(input);
    this.mounted.set(input.regionId, this.createMountedRegion(input, state));
    return { ok: true as const, value: state };
  }

  private mountSurface(input: RuntimeMountInput, binding: RuntimeResourceBinding) {
    const valid = this.validateMount(input, binding);
    if (!valid.ok) return valid;
    const state = this.initialState(input);
    this.mounted.set(input.regionId, this.createMountedRegion(input, state, binding));
    return { ok: true as const, value: state };
  }

  render(input: RuntimeRenderInput, prepare?: RuntimeRenderPrepare): Promise<RuntimeRenderReceipt> {
    return this.renderer.render(input, prepare);
  }

  context(regionId: string): Outcome<RuntimeResourceContext> {
    const slot = this.getSlot(regionId);
    if (slot === undefined) return failure('runtime.mount-missing', 'Mount the Region before reading its context.');
    const authority = this.catalogAuthority(slot);
    if (!authority.ok) return authority;
    const binding = this.getResource(slot);
    if (binding === undefined) return failure('runtime.resource-missing', 'The mounted resource is unavailable.');
    return { ok: true, value: describeResource(binding, authority.value) };
  }

  contexts(regionId: string): Outcome<readonly RuntimeResourceContext[]> {
    const slot = this.getSlot(regionId);
    if (slot === undefined) return failure('runtime.mount-missing', 'Mount the Region before reading its contexts.');
    const active = this.catalogAuthority(slot);
    if (!active.ok) return active;
    const visible = this.visibleResourceContexts(slot, active.value);
    return { ok: true, value: Object.freeze(visible) };
  }

  async commitPresentation(input: RuntimePresentationInput) {
    const target = this.presentationTarget(input.regionId);
    if (!target.ok) return target;
    const current = target.value.region.snapshot();
    const valid = this.validatePresentation(input, current);
    if (!valid.ok) return valid;
    const staged = await target.value.region.stage({
      requestId: input.requestId,
      expected: current.readSet!,
      state: { task: input.task, presentation: input.presentation },
    });
    if (!staged.ok) return staged;
    const committed = await target.value.region.commit(staged.value, {
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      recheck: (next) => this.presentationRecheck(next, input.task),
    });
    if (committed.ok) this.publishPresentation(target.value.slot, committed.value, input.task);
    return committed;
  }

  snapshot(regionId: string): RuntimeRegionState | undefined {
    return this.getSlot(regionId)?.state;
  }

  subscribe(regionId: string, listener: (state: RuntimeRegionState) => void): () => void {
    const slot = this.getSlot(regionId);
    if (slot === undefined) throw new TypeError(`Region ${regionId} is not mounted.`);
    slot.listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      slot.listeners.delete(listener);
    };
  }

  unmount(regionId: string): boolean {
    const slot = this.getSlot(regionId);
    if (slot === undefined) return false;
    slot.active?.abort();
    this.regions.get(regionId)?.dispose();
    this.mounted.delete(regionId);
    slot.listeners.clear();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const scope of [...this.scopes]) scope.dispose();
    this.scopes.clear();
    this.surfaceFactory.dispose();
    for (const slot of this.mounted.values()) this.disposeMountedRegion(slot);
    this.mounted.clear();
    this.regions.dispose();
    this.releaseResultStore();
  }

  private createScope(input: CreateScopeInput): ScopeController {
    if (this.disposed) throw new TypeError('The Aeliqo runtime is disposed.');
    let scope!: ScopeController;
    scope = new ScopeControllerImpl(this.surfaceFactory.runtimeId, input, () => this.scopes.delete(scope));
    this.scopes.add(scope);
    return scope;
  }

  private validateMount(input: RuntimeMountInput, surfaceBinding?: RuntimeResourceBinding): Outcome<void> {
    if (this.disposed) return failure('runtime.app-disposed', 'The Aeliqo runtime is disposed.');
    if (!validId(input.regionId) || (surfaceBinding === undefined && !this.resources.has(input.resourceId)))
      return failure('runtime.mount-invalid', 'Mount requires a bounded region ID and registered resource.', [
        'regionId',
      ]);
    if (this.mounted.has(input.regionId))
      return failure('runtime.mount-duplicate', `Region ${input.regionId} is already mounted.`, ['regionId']);
    return { ok: true, value: undefined };
  }

  private initialState(input: RuntimeMountInput): RuntimeRegionState {
    return Object.freeze({
      regionId: input.regionId,
      resourceId: input.resourceId,
      phase: 'idle',
      results: [],
      diagnostics: [],
    });
  }

  private createMountedRegion(
    input: RuntimeMountInput,
    state: RuntimeRegionState,
    surfaceBinding?: RuntimeResourceBinding,
  ): MountedRegion {
    return {
      regionId: input.regionId,
      resourceId: input.resourceId,
      ...(surfaceBinding === undefined ? {} : { surfaceBinding }),
      listeners: new Set(),
      state,
      sequence: 0,
      refs: [],
      pendingRefs: [],
    };
  }

  private authorityFor(slot: MountedRegion, effect: RuntimeEffect, signal?: AbortSignal): Outcome<AppAuthorityContext> {
    return readAuthority(this.options, this.disposed, slot, slot.resourceId, effect, signal);
  }

  private authorityForResource(
    slot: MountedRegion,
    resourceId: string,
    effect: RuntimeEffect,
  ): Outcome<AppAuthorityContext> {
    return readAuthority(this.options, this.disposed, slot, resourceId, effect);
  }

  private readRegionAuthority(regionId: string): RegionOutcome<RegionAuthority> {
    const slot = this.getSlot(regionId);
    if (slot === undefined) return this.regionDenied('The region is not mounted.');
    const binding = this.getResource(slot);
    if (binding === undefined) return this.regionDenied('The mounted resource is unavailable.');
    const current = this.authorityFor(slot, 'commit');
    if (!current.ok) return current;
    if (slot.principalKey !== undefined && current.value.principalKey !== slot.principalKey)
      return this.regionDenied('The authenticated principal changed before commit.');
    return {
      ok: true,
      value: {
        principalKey: current.value.principalKey,
        scopeDigest: current.value.scopeDigest,
        policyRevision: current.value.policyRevision,
        catalogRevision: binding.resource.catalog.revision,
        experienceRevision: current.value.experienceRevision,
        functionRegistryDigest: binding.resource.catalog.functionRegistryDigest,
        results: uniqueRefs([...slot.refs, ...slot.pendingRefs]),
      },
    };
  }

  private authorizeRegionCommit(regionId: string, expected: RegionAuthority, signal: AbortSignal): RegionOutcome<void> {
    const slot = this.getSlot(regionId);
    if (slot === undefined) return this.regionDenied('The region is not mounted.');
    const current = this.authorityFor(slot, 'commit', signal);
    if (!current.ok) return current;
    return sameAuthority(current.value, expected)
      ? { ok: true, value: undefined }
      : this.regionStale('Authority changed during commit.');
  }

  private readEvaluationContext(task: Task, signal: AbortSignal): Outcome<TrustedEvaluationContext> {
    const slot = this.getSlot(task.regionId);
    const binding = slot === undefined ? undefined : this.getResource(slot);
    if (slot === undefined || binding === undefined)
      return failure('runtime.evaluation-denied', 'The Task targets an unmounted resource.');
    const current = this.authorityFor(slot, 'render', signal);
    if (!current.ok) return current;
    if (slot.principalKey !== current.value.principalKey)
      return failure('runtime.evaluation-stale', 'The authenticated principal changed during evaluation.');
    return { ok: true, value: this.evaluationContext(binding, current.value) };
  }

  private evaluationContext(binding: RuntimeResourceBinding, current: AppAuthorityContext): TrustedEvaluationContext {
    return {
      principalKey: current.principalKey,
      scopeDigest: current.scopeDigest,
      policyRevision: current.policyRevision,
      catalogRevision: binding.resource.catalog.revision,
      functionRegistryDigest: binding.resource.catalog.functionRegistryDigest,
      grants: current.grants,
      catalog: binding.resource.catalog,
      data: binding.data,
      resultStore: this.resultStore,
      readContext: current.readContext,
      resolveResult: (ref) => resolveTrackedResult(this.trackedHandles, ref),
      now: current.now ?? (() => Date.now()),
      ...(current.budget === undefined ? {} : { budget: current.budget }),
    };
  }

  private catalogAuthority(slot: MountedRegion): Outcome<AppAuthorityContext> {
    const current = this.authorityFor(slot, 'context');
    if (!current.ok) return current;
    if (!current.value.grants.includes('catalog.read'))
      return failure('runtime.context-denied', 'Catalog discovery is not permitted for this session.');
    return current;
  }

  private visibleResourceContexts(slot: MountedRegion, active: AppAuthorityContext): RuntimeResourceContext[] {
    const visible: RuntimeResourceContext[] = [];
    for (const resourceId of this.resources.keys()) {
      const authority = this.visibleAuthority(slot, resourceId, active);
      if (authority === undefined) continue;
      const binding = this.resources.get(resourceId);
      if (binding !== undefined) visible.push(describeResource(binding, authority));
    }
    return visible;
  }

  private visibleAuthority(
    slot: MountedRegion,
    resourceId: string,
    active: AppAuthorityContext,
  ): AppAuthorityContext | undefined {
    const current =
      resourceId === slot.resourceId
        ? { ok: true as const, value: active }
        : this.authorityForResource(slot, resourceId, 'context');
    if (!current.ok || !current.value.grants.includes('catalog.read')) return undefined;
    if (current.value.principalKey !== active.principalKey || current.value.scopeDigest !== active.scopeDigest)
      return undefined;
    return current.value;
  }

  private presentationTarget(regionId: string): Outcome<PresentationTarget> {
    const slot = this.getSlot(regionId);
    const region = this.regions.get(regionId);
    if (slot === undefined || region === undefined)
      return failure('runtime.mount-missing', 'The Region is not mounted and committed.');
    return { ok: true, value: { slot, region } };
  }

  private validatePresentation(input: RuntimePresentationInput, current: RegionSnapshot): Outcome<void> {
    if (!validId(input.requestId))
      return failure('runtime.presentation-invalid', 'Presentation request ID must be bounded.', ['requestId']);
    if (!sameTask(current, input.task))
      return failure('runtime.presentation-stale', 'Presentation Task is not the current committed Task.');
    if (current.readSet === undefined)
      return failure('runtime.presentation-stale', 'Presentation Task has no active read set.');
    return { ok: true, value: undefined };
  }

  private presentationRecheck(next: RegionSnapshot | undefined, task: Task): RegionOutcome<void> {
    if (next?.state?.task.id === task.id) return { ok: true, value: undefined };
    return this.regionStale('Presentation Task changed before commit.');
  }

  private publishPresentation(slot: MountedRegion, region: RegionSnapshot, task: Task): void {
    this.setState(slot, { ...slot.state, task: region.state?.task ?? task, region });
  }

  private clearDeniedPrincipal(slot: MountedRegion): void {
    const prior = slot.principalKey;
    this.regions.get(slot.regionId)?.revoke('authority denied');
    if (prior !== undefined) this.resultStore.revoke({ principalKey: prior });
    slot.refs = [];
    slot.pendingRefs = [];
  }

  private replacePrincipal(slot: MountedRegion, previous: string): void {
    this.resultStore.revoke({ principalKey: previous });
    this.regions.get(slot.regionId)?.dispose();
    slot.refs = [];
    slot.pendingRefs = [];
  }

  private regionSnapshot(regionId: string): RegionSnapshot | undefined {
    return this.regions.get(regionId)?.snapshot();
  }

  private cancelledReceipt(slot: MountedRegion, requestId: string, task?: Task): RuntimeRenderReceipt {
    return {
      status: 'cancelled',
      requestId,
      regionId: slot.regionId,
      diagnostics: [diagnostic('runtime.render-cancelled', 'A newer render replaced this request.')],
      ...(task === undefined ? {} : { task }),
    };
  }

  private regionDenied(message: string): RegionOutcome<never> {
    return { ok: false, diagnostics: [diagnostic('runtime.region-denied', message)] };
  }

  private regionStale(message: string): RegionOutcome<never> {
    return { ok: false, diagnostics: [diagnostic('runtime.region-stale', message)] };
  }

  private notify(slot: MountedRegion): void {
    for (const listener of [...slot.listeners]) {
      try {
        listener(slot.state);
      } catch {
        /* Observers never control runtime state. */
      }
    }
  }

  private disposeMountedRegion(slot: MountedRegion): void {
    slot.active?.abort();
    slot.listeners.clear();
  }

  private releaseResultStore(): void {
    if (this.ownsResultStore) this.resultStore.dispose();
    else this.trackedHandles.clear();
  }
}

function validateOptions(options: AeliqoRuntimeOptions): void {
  if (
    options === null ||
    typeof options !== 'object' ||
    options.authority === null ||
    typeof options.authority?.read !== 'function'
  )
    throw new TypeError('createAeliqoRuntime requires one trusted authority adapter.');
  if (!Array.isArray(options.resources) || options.resources.length === 0)
    throw new TypeError('createAeliqoRuntime requires at least one resource binding.');
}

let nextRuntimeId = 1;

function indexResources(resources: AeliqoRuntimeOptions['resources']): Map<string, RuntimeResourceBinding> {
  const indexed = new Map<string, RuntimeResourceBinding>();
  for (const binding of resources) {
    if (indexed.has(binding.resource.id))
      throw new TypeError(`Resource ${binding.resource.id} is bound more than once.`);
    indexed.set(binding.resource.id, binding);
  }
  return indexed;
}
