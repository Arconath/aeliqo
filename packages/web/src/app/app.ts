import {
  createPresentationRegistry,
  parseInteractionState,
  validatePresentationPlan,
  type CommitPreconditions,
  type Diagnostic,
  type Experience,
  type InteractionPayload,
  type Outcome,
  type PresentationEnvironment,
  type PresentationRegistry,
  type Result,
} from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime/app';
import type { RuntimeCommittedReceipt, RuntimeRegionState, RuntimeUnsubscribe } from '@aeliqo/runtime/app';
import { registerAeliqoElements } from '../register.js';
import { AeliqoRegionElement } from '../region/aeliqo-region.js';
import { createAeliqoPresentationRegistry } from '../region/registry.js';
import type { AeliqoInputBindings } from '../region/input-registry.js';
import type { AeliqoRegionResult, AeliqoSemanticInteractionRequest, AeliqoViewDefinition } from '../region/types.js';
import { STANDARD_RECIPES, STANDARD_STATE_MAPPINGS, recipeSupports } from '../recipes/standard.js';
import type { RecipeDefinition } from '../recipes/types.js';
import type { AeliqoApp, AeliqoAppOptions, WebMountInput, WebRenderInput, WebRenderReceipt } from './types.js';
import { createFormBindings } from './form-bindings.js';

interface WebRegion {
  readonly id: string;
  readonly resourceId: string;
  readonly target: HTMLElement;
  readonly element: AeliqoRegionElement;
  resize?: ResizeObserver;
  sequence: number;
  category: 'wide' | 'narrow' | 'unknown';
  composing: boolean;
  pendingAdapt: boolean;
  actionPending: boolean;
  actionSequence: number;
  actionAttempt?: string;
  actionAbort?: AbortController;
  cancelAction?: () => boolean;
  runtimeSubscription?: RuntimeUnsubscribe;
  readonly values: Map<
    string,
    {
      readonly nodeId: string;
      readonly portId: string;
      readonly payload: Extract<
        InteractionPayload,
        { readonly kind: 'selection' | 'filter' | 'range' | 'group' | 'page' }
      >;
    }
  >;
  readonly drafts: Map<string, Extract<InteractionPayload, { readonly kind: 'draft' }>>;
  last?: {
    readonly receipt: RuntimeCommittedReceipt;
    readonly results: readonly AeliqoRegionResult[];
    readonly descriptors: readonly Result[];
    readonly inputs?: AeliqoInputBindings;
  };
}

function diagnostic(code: string, message: string): Diagnostic {
  return { code, message, retryable: false };
}
function failed(
  status: 'unsupported' | 'failed' | 'cancelled',
  regionId: string,
  requestId: string,
  item: Diagnostic,
): WebRenderReceipt {
  return { status, regionId, requestId, diagnostics: [item] };
}
function failedAfterRuntime(
  status: 'unsupported' | 'failed' | 'cancelled' | 'needs-input',
  runtime: RuntimeCommittedReceipt,
  requestId: string,
  diagnostics: readonly [Diagnostic, ...Diagnostic[]],
): WebRenderReceipt {
  return { status, regionId: runtime.regionId, requestId, runtime, diagnostics };
}
function withoutDataRevision(readSet: NonNullable<RuntimeCommittedReceipt['region']['readSet']>): CommitPreconditions {
  const { dataRevision: _dataRevision, ...pins } = readSet;
  return pins;
}
function refKey(ref: Result['ref']): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function materialize(
  receipt: RuntimeCommittedReceipt,
): { readonly results: readonly AeliqoRegionResult[]; readonly descriptors: readonly Result[] } | undefined {
  const results: AeliqoRegionResult[] = [];
  const descriptors: Result[] = [];
  for (const output of receipt.outputs) {
    const snapshot = output.handle.snapshot();
    if (snapshot.descriptor === undefined || (snapshot.status !== 'ready' && snapshot.status !== 'partial'))
      return undefined;
    descriptors.push(snapshot.descriptor);
    results.push({
      ref: snapshot.descriptor.ref,
      rows: snapshot.batches.flatMap((batch) => batch.rows),
      columns: snapshot.descriptor.fields.map((field) => ({ key: field.id, label: field.label })),
    });
  }
  return { results: Object.freeze(results), descriptors: Object.freeze(descriptors) };
}

function environmentFor(region: WebRegion): PresentationEnvironment {
  const view = region.target.ownerDocument.defaultView;
  const width = region.target.getBoundingClientRect().width;
  const computed = view?.getComputedStyle(region.target);
  const locale =
    region.target.lang || region.target.ownerDocument.documentElement.lang || view?.navigator.language || 'en-US';
  return {
    inlineSize: width > 0 ? { state: 'known', value: width } : { state: 'unknown' },
    blockSize:
      region.target.getBoundingClientRect().height > 0
        ? { state: 'known', value: region.target.getBoundingClientRect().height }
        : { state: 'unknown' },
    textScale: { state: 'unknown' },
    pointer: view?.matchMedia('(pointer: coarse)').matches === true ? 'coarse' : 'unknown',
    hover: view?.matchMedia('(hover: hover)').matches === true ? 'available' : 'unknown',
    keyboard: 'unknown',
    locale,
    direction: computed?.direction === 'rtl' ? 'rtl' : 'ltr',
    reducedMotion: view?.matchMedia('(prefers-reduced-motion: reduce)').matches === true,
    forcedColors: view?.matchMedia('(forced-colors: active)').matches === true,
  };
}

function category(width: number, previous: WebRegion['category']): WebRegion['category'] {
  if (!(width > 0)) return 'unknown';
  if (previous === 'wide') return width < 616 ? 'narrow' : 'wide';
  if (previous === 'narrow') return width > 664 ? 'wide' : 'narrow';
  return width < 640 ? 'narrow' : 'wide';
}

function deepActive(document: Document): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement !== null && active?.shadowRoot?.activeElement !== undefined)
    active = active.shadowRoot.activeElement;
  return active;
}
function composedContains(container: Element, node: Element): boolean {
  let current: Node | null = node;
  while (current !== null) {
    if (current === container) return true;
    const root = current.getRootNode();
    if (root !== current && 'host' in root && root.host !== null && typeof root.host === 'object')
      current = root.host as Node;
    else current = current.parentNode;
  }
  return false;
}
function interactionLocked(region: WebRegion): boolean {
  if (region.composing) return true;
  const active = deepActive(region.target.ownerDocument);
  if (active === null || !composedContains(region.element, active)) return false;
  return active.matches('input, textarea, select, [contenteditable="true"], [data-aeliqo-dirty="true"]');
}

function registryFor(
  results: readonly AeliqoRegionResult[],
  descriptors: readonly Result[],
  views: readonly AeliqoViewDefinition[],
  resourceId: string,
  inputs?: AeliqoInputBindings,
): PresentationRegistry | undefined {
  const byRef = new Map(descriptors.map((descriptor) => [refKey(descriptor.ref), descriptor]));
  const base = createAeliqoPresentationRegistry({
    ...(inputs === undefined ? {} : { inputs }),
    data: results.flatMap((binding) => {
      const result = byRef.get(refKey(binding.ref));
      return result === undefined
        ? []
        : [{ result, rows: binding.rows, ...(binding.columns === undefined ? {} : { columns: binding.columns }) }];
    }),
    resolveEntity: () => resourceId,
  });
  if (!base.ok) return undefined;
  const combined = createPresentationRegistry(
    [...base.value.manifests, ...views.map((view) => view.manifest)],
    base.value.mappings,
    base.value.patterns,
    [...(base.value.stateMappings ?? []), ...STANDARD_STATE_MAPPINGS],
  );
  return combined.ok ? combined.value : undefined;
}

function experience(registry: PresentationRegistry, revision: string): Experience {
  return {
    version: '1',
    id: 'aeliqo.web.app',
    revision,
    mode: 'adaptive',
    agentAllowed: true,
    allowedRepresentations: registry.manifests.map((manifest) => manifest.ref.id),
    allowedPatterns: [],
    composition: { allowWithoutPreset: true, maxNodes: 32, maxExpansions: 64 },
    requiredOperations: [],
    tokenProfile: { id: 'tokens.default', revision: '1' },
    extensionAllowlist: registry.manifests.filter((manifest) => manifest.extension).map((manifest) => manifest.ref),
    transitionPolicy: 'stable',
  };
}

export function createAeliqoApp(options: AeliqoAppOptions): AeliqoApp {
  const runtime = createAeliqoRuntime(options);
  const resources = new Map(options.resources.map((binding) => [binding.resource.id, binding.resource]));
  const recipes = Object.freeze([...(options.recipes ?? STANDARD_RECIPES)]);
  const views = Object.freeze([...(options.views ?? [])]);
  if (recipes.length === 0) throw new TypeError('createAeliqoApp requires at least one recipe.');
  if (new Set(recipes.map((recipe) => JSON.stringify([recipe.ref.id, recipe.ref.revision]))).size !== recipes.length)
    throw new TypeError('Recipe registrations must be unique.');
  if (new Set(views.map((view) => JSON.stringify([view.ref.id, view.ref.revision]))).size !== views.length)
    throw new TypeError('View registrations must be unique.');
  const regions = new Map<string, WebRegion>();
  const stateListeners = new Map<string, Set<(state: RuntimeRegionState) => void>>();
  let disposed = false;

  const bridgeRuntimeState = (region: WebRegion): void => {
    if (region.runtimeSubscription !== undefined) return;
    region.runtimeSubscription = runtime.subscribe(region.id, (state) => {
      for (const listener of [...(stateListeners.get(region.id) ?? [])]) {
        try {
          listener(state);
        } catch {
          /* State observers never control app lifecycle. */
        }
      }
    });
    const current = runtime.snapshot(region.id);
    if (current !== undefined) {
      for (const listener of [...(stateListeners.get(region.id) ?? [])]) {
        try {
          listener(current);
        } catch {
          /* State observers never control app lifecycle. */
        }
      }
    }
  };

  const notifyAction = (event: Parameters<NonNullable<AeliqoAppOptions['onActionEvent']>>[0]): void => {
    try {
      const pending = options.onActionEvent?.(event);
      if (pending !== undefined) void Promise.resolve(pending).catch(() => {});
    } catch {
      /* Application observers never control action authority. */
    }
  };

  const cancelActiveAction = (region: WebRegion): void => {
    region.actionAbort?.abort();
    delete region.actionAbort;
    const cancel = region.cancelAction;
    delete region.cancelAction;
    cancel?.();
    region.actionPending = false;
  };

  const publishInteraction = (region: WebRegion): void => {
    const state = parseInteractionState({
      version: '1',
      values: [...region.values.values()],
      drafts: [...region.drafts.values()].map((draft) => ({
        domain: 'app.form',
        entity: draft.entity,
        key: draft.key,
        field: draft.field,
        value: draft.value,
        entityRevision: draft.entityRevision,
      })),
    });
    if (state.ok) region.element.interaction = state.value;
  };

  const handleInteraction = async (region: WebRegion, request: AeliqoSemanticInteractionRequest): Promise<void> => {
    const payload = request.payload;
    if (payload.kind === 'draft') {
      region.drafts.set(JSON.stringify([payload.entity, payload.key, payload.field]), payload);
      delete region.actionAttempt;
      publishInteraction(region);
      return;
    }
    if (payload.kind !== 'action-request') {
      if (
        payload.kind === 'selection' ||
        payload.kind === 'filter' ||
        payload.kind === 'range' ||
        payload.kind === 'group' ||
        payload.kind === 'page'
      ) {
        region.values.set(JSON.stringify([request.nodeId, request.portId]), {
          nodeId: request.nodeId,
          portId: request.portId,
          payload,
        });
        publishInteraction(region);
      }
      return;
    }
    const port = runtime.actionPort;
    if (port === undefined) {
      notifyAction({
        state: 'failed',
        regionId: region.id,
        diagnostics: [diagnostic('web.action.unconfigured', 'This form action has no registered ActionPort.')],
      });
      return;
    }
    if (region.actionPending) return;
    const snapshot = runtime.snapshot(region.id)?.region;
    if (snapshot === undefined) return;
    const input = { ...payload.input };
    for (const draft of region.drafts.values()) input[draft.field] = draft.value;
    const entityDraft = region.drafts.values().next().value;
    const requestId = `action-${region.id}-${++region.actionSequence}`.slice(0, 160);
    region.actionAttempt ??= `attempt-${region.id}-${snapshot.taskRevision}-${region.actionSequence}`.slice(0, 160);
    const controller = new AbortController();
    region.actionAbort = controller;
    region.actionPending = true;
    const preview = await port.preview(
      {
        requestId,
        action: payload.action,
        input,
        ...(entityDraft === undefined
          ? {}
          : { entity: { key: entityDraft.key, revision: entityDraft.entityRevision } }),
        idempotencyKey: region.actionAttempt,
      },
      { signal: controller.signal },
    );
    if (!preview.ok) {
      if (region.actionAbort === controller) {
        delete region.actionAbort;
        region.actionPending = false;
      }
      notifyAction({ state: 'failed', regionId: region.id, diagnostics: preview.diagnostics });
      return;
    }
    if (controller.signal.aborted || region.actionAbort !== controller) {
      port.cancel(preview.value);
      return;
    }
    let active = true;
    const cancel = (): boolean => {
      if (!active) return false;
      const cancelled = port.cancel(preview.value);
      if (cancelled) {
        active = false;
        if (region.actionAbort === controller) delete region.actionAbort;
        if (region.cancelAction === cancel) delete region.cancelAction;
        region.actionPending = false;
      }
      return cancelled;
    };
    region.cancelAction = cancel;
    const confirm = async () => {
      if (!active)
        return {
          ok: false as const,
          diagnostics: [diagnostic('web.action.inactive', 'This action preview is no longer active.')] as const,
        };
      const confirmed = await port.confirm(preview.value, { signal: controller.signal });
      if (!confirmed.ok) {
        active = false;
        if (region.actionAbort === controller) delete region.actionAbort;
        if (region.cancelAction === cancel) delete region.cancelAction;
        region.actionPending = false;
        notifyAction({ state: 'failed', regionId: region.id, diagnostics: confirmed.diagnostics });
        return confirmed;
      }
      const executed = await port.execute(confirmed.value, { signal: controller.signal });
      active = false;
      if (region.actionAbort === controller) delete region.actionAbort;
      if (region.cancelAction === cancel) delete region.cancelAction;
      region.actionPending = false;
      if (!executed.ok) notifyAction({ state: 'failed', regionId: region.id, diagnostics: executed.diagnostics });
      else {
        delete region.actionAttempt;
        notifyAction({ state: 'executed', regionId: region.id, execution: executed.value });
      }
      return executed;
    };
    if (options.onActionEvent === undefined) {
      cancel();
      return;
    }
    notifyAction({ state: 'preview', regionId: region.id, preview: preview.value, confirm, cancel });
  };

  const resolveFormBindings = async (
    region: WebRegion,
    receipt: RuntimeCommittedReceipt,
    signal?: AbortSignal,
  ): Promise<Outcome<AeliqoInputBindings | undefined>> => {
    if (receipt.task.kind !== 'form') return { ok: true, value: undefined };
    if (receipt.intent.kind !== 'create' && receipt.intent.kind !== 'edit')
      return {
        ok: false,
        diagnostics: [diagnostic('web.form-state.intent', 'A form Task requires a create or edit intent.')],
      };
    const resource = resources.get(region.resourceId);
    if (resource === undefined)
      return {
        ok: false,
        diagnostics: [diagnostic('web.form-state.resource', 'The mounted form resource is unavailable.')],
      };
    let state;
    if (options.formState === undefined) {
      if (receipt.intent.kind === 'edit')
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              'web.form-state.required',
              'Edit requires a trusted formState adapter to load current values and entity revision.',
            ),
          ],
        };
      state = { values: {}, entityRevision: 'new' } as const;
    } else {
      const fallback = new AbortController();
      try {
        state = await options.formState.read({
          regionId: region.id,
          resource,
          intent: receipt.intent,
          task: receipt.task,
          signal: signal ?? fallback.signal,
        });
      } catch {
        return {
          ok: false,
          diagnostics: [diagnostic('web.form-state.failed', 'The trusted formState adapter failed safely.')],
        };
      }
      if (!state.ok) return state;
      state = state.value;
    }
    return createFormBindings(resource, receipt.intent, receipt.task, state);
  };

  const present = async (
    region: WebRegion,
    receipt: RuntimeCommittedReceipt,
    resultBindings: readonly AeliqoRegionResult[],
    descriptors: readonly Result[],
    requestId: string,
    expectedSequence: number,
    inputs?: AeliqoInputBindings,
    signal?: AbortSignal,
  ): Promise<WebRenderReceipt> => {
    if (region.sequence !== expectedSequence)
      return failedAfterRuntime('cancelled', receipt, requestId, [
        diagnostic('web.app.cancelled', 'A newer web operation replaced this presentation.'),
      ]);
    const runtimeState = runtime.snapshot(region.id)?.region;
    const current = runtimeState?.readSet;
    const result = descriptors[0];
    if (current === undefined || (receipt.task.kind === 'data' && result === undefined))
      return failedAfterRuntime('failed', receipt, requestId, [
        diagnostic('web.app.result', 'The committed data Task has no materialized primary Result.'),
      ]);
    const registry = registryFor(resultBindings, descriptors, views, region.resourceId, inputs);
    if (registry === undefined)
      return failedAfterRuntime('failed', receipt, requestId, [
        diagnostic('web.app.registry', 'The presentation registry could not be created.'),
      ]);
    const recipe: RecipeDefinition | undefined = recipes.find((candidate) =>
      recipeSupports(candidate, receipt.intent.kind),
    );
    if (recipe === undefined)
      return failedAfterRuntime('unsupported', receipt, requestId, [
        diagnostic('web.app.recipe', `No recipe supports ${receipt.intent.kind}.`),
      ]);
    const environment = environmentFor(region);
    const prior = region.element.presentation?.plan;
    const incumbent = prior?.preconditions.taskRevision === current.taskRevision ? prior : undefined;
    const plan = recipe.build({
      intent: receipt.intent,
      task: receipt.task,
      ...(result === undefined ? {} : { result }),
      ...(inputs === undefined ? {} : { inputBindings: inputs }),
      current: withoutDataRevision(current),
      environment,
      availableViews: views,
      ...(incumbent === undefined ? {} : { incumbent }),
    });
    if (!plan.ok) return failedAfterRuntime('unsupported', receipt, requestId, plan.diagnostics);
    const checked = validatePresentationPlan(
      plan.value,
      {
        task: receipt.task,
        experience: experience(registry, current.experienceRevision),
        results: descriptors,
        current: withoutDataRevision(current),
        environment,
        rendererCapabilities: registry.manifests.map((manifest) => manifest.ref),
        stateMappingCapabilities: registry.stateMappings?.map((mapping) => mapping.ref) ?? [],
        ...(incumbent === undefined ? {} : { incumbent }),
      },
      registry,
    );
    if (!checked.ok) return failedAfterRuntime('unsupported', receipt, requestId, checked.diagnostics);
    const committed = await runtime.commitPresentation({
      regionId: region.id,
      requestId,
      task: receipt.task,
      presentation: checked.value.plan,
      ...(signal === undefined ? {} : { signal }),
    });
    if (!committed.ok)
      return failedAfterRuntime(
        committed.diagnostics[0]?.code.includes('stale') ? 'cancelled' : 'failed',
        receipt,
        requestId,
        committed.diagnostics,
      );
    const committedTask = committed.value.state?.task;
    const committedPlan = committed.value.state?.presentation;
    if (committedTask === undefined || committedPlan === undefined)
      return failedAfterRuntime('failed', receipt, requestId, [
        diagnostic('web.app.commit', 'The committed Region did not retain its Task and presentation.'),
      ]);
    const committedRuntime: RuntimeCommittedReceipt = { ...receipt, task: committedTask, region: committed.value };
    const committedPresentation = { ...checked.value, plan: committedPlan };
    const previousPresentation = region.element.presentation;
    const previousResults = region.element.results;
    const previousInteraction = region.element.interaction;
    const changesTask =
      region.last !== undefined &&
      (region.last.receipt.task.id !== receipt.task.id || region.last.receipt.task.revision !== receipt.task.revision);
    if (region.sequence !== expectedSequence)
      return failedAfterRuntime('cancelled', receipt, requestId, [
        diagnostic('web.app.cancelled', 'A newer web operation replaced this presentation.'),
      ]);
    try {
      region.element.viewRenderers = views;
      region.element.results = resultBindings;
      if (changesTask) region.element.interaction = undefined;
      region.element.presentation = committedPresentation;
      await region.element.updateComplete;
    } catch {
      region.element.presentation = previousPresentation;
      region.element.results = previousResults;
      region.element.interaction = previousInteraction;
      return failedAfterRuntime('failed', receipt, requestId, [
        diagnostic('web.app.renderer', 'The renderer failed; the previous UI was restored.'),
      ]);
    }
    if (region.sequence !== expectedSequence)
      return failedAfterRuntime('cancelled', receipt, requestId, [
        diagnostic('web.app.cancelled', 'A newer web operation replaced this presentation.'),
      ]);
    if (changesTask) {
      region.values.clear();
      region.drafts.clear();
      delete region.actionAttempt;
      region.actionPending = false;
    }
    return {
      status: 'renderer-ready',
      requestId,
      regionId: region.id,
      runtime: committedRuntime,
      presentation: committedPresentation,
      environment,
      diagnostics: [],
    };
  };

  const adapt = async (region: WebRegion): Promise<void> => {
    if (region.last === undefined || interactionLocked(region)) {
      region.pendingAdapt = true;
      return;
    }
    region.pendingAdapt = false;
    const requestId = `adapt-${region.id}-${++region.sequence}`.slice(0, 160);
    const sequence = region.sequence;
    const result = await present(
      region,
      region.last.receipt,
      region.last.results,
      region.last.descriptors,
      requestId,
      sequence,
      region.last.inputs,
    );
    if (result.status === 'renderer-ready') region.last = { ...region.last, receipt: result.runtime };
  };

  const mount = (input: WebMountInput) => {
    if (disposed)
      return {
        ok: false as const,
        diagnostics: [diagnostic('web.app.disposed', 'The Aeliqo app is disposed.')] as const,
      };
    const view = input.target?.ownerDocument?.defaultView;
    if (view === null || view === undefined || !(input.target instanceof view.HTMLElement))
      return {
        ok: false as const,
        diagnostics: [diagnostic('web.app.target', 'Mount target must be an HTMLElement.')] as const,
      };
    if (regions.has(input.regionId))
      return {
        ok: false as const,
        diagnostics: [diagnostic('web.app.duplicate', `Region ${input.regionId} is already mounted.`)] as const,
      };
    try {
      registerAeliqoElements(view.customElements);
    } catch {
      return {
        ok: false as const,
        diagnostics: [
          diagnostic('web.app.registration', 'Aeliqo elements could not be registered in this document.'),
        ] as const,
      };
    }
    const mounted = runtime.mount({ regionId: input.regionId, resourceId: input.resourceId });
    if (!mounted.ok) return mounted;
    let element: AeliqoRegionElement;
    try {
      element = input.target.ownerDocument.createElement('aeliqo-region') as AeliqoRegionElement;
      element.setAttribute('data-aeliqo-app-region', input.regionId);
      input.target.append(element);
    } catch {
      runtime.unmount(input.regionId);
      return {
        ok: false as const,
        diagnostics: [diagnostic('web.app.mount', 'The Aeliqo Region could not be attached to the target.')] as const,
      };
    }
    const width = input.target.getBoundingClientRect().width;
    const region: WebRegion = {
      id: input.regionId,
      resourceId: input.resourceId,
      target: input.target,
      element,
      sequence: 0,
      category: category(width, 'unknown'),
      composing: false,
      pendingAdapt: false,
      actionPending: false,
      actionSequence: 0,
      values: new Map(),
      drafts: new Map(),
    };
    element.onSemanticInteraction = (request) => {
      void handleInteraction(region, request);
    };
    const ViewResizeObserver = input.target.ownerDocument.defaultView?.ResizeObserver;
    if (ViewResizeObserver !== undefined) {
      const resize = new ViewResizeObserver((entries) => {
        const widthNow = entries[0]?.contentRect.width ?? input.target.getBoundingClientRect().width;
        const next = category(widthNow, region.category);
        if (next === region.category) return;
        region.category = next;
        void adapt(region);
      });
      resize.observe(input.target);
      region.resize = resize;
    }
    element.addEventListener('compositionstart', () => {
      region.composing = true;
    });
    element.addEventListener('compositionend', () => {
      region.composing = false;
      if (region.pendingAdapt) void adapt(region);
    });
    element.addEventListener('focusout', () => {
      if (region.pendingAdapt)
        queueMicrotask(() => {
          if (!interactionLocked(region)) void adapt(region);
        });
    });
    regions.set(input.regionId, region);
    bridgeRuntimeState(region);
    return { ok: true as const, value: element };
  };

  const render = async (input: WebRenderInput): Promise<WebRenderReceipt> => {
    const region = regions.get(input.regionId);
    if (region === undefined)
      return failed(
        'failed',
        input.regionId,
        `render-${input.regionId}`,
        diagnostic('web.app.mount', 'Mount the Region before rendering.'),
      );
    const sequence = ++region.sequence;
    const receipt = await runtime.render(input);
    if (receipt.status !== 'committed') {
      if (receipt.status === 'denied') region.element.revoke();
      return receipt;
    }
    if (sequence !== region.sequence)
      return failedAfterRuntime('cancelled', receipt, receipt.requestId, [
        diagnostic('web.app.cancelled', 'A newer web render replaced this request.'),
      ]);
    cancelActiveAction(region);
    const bound = materialize(receipt);
    if (bound === undefined)
      return failedAfterRuntime('failed', receipt, receipt.requestId, [
        diagnostic('web.app.materialization', 'The committed Result is unavailable to the renderer.'),
      ]);
    const form = await resolveFormBindings(region, receipt, input.signal);
    if (!form.ok)
      return failedAfterRuntime(
        receipt.intent.kind === 'edit' ? 'needs-input' : 'failed',
        receipt,
        receipt.requestId,
        form.diagnostics,
      );
    if (sequence !== region.sequence)
      return failedAfterRuntime('cancelled', receipt, receipt.requestId, [
        diagnostic('web.app.cancelled', 'A newer web render replaced form state loading.'),
      ]);
    const result = await present(
      region,
      receipt,
      bound.results,
      bound.descriptors,
      `present-${receipt.requestId}`.slice(0, 160),
      sequence,
      form.value,
      input.signal,
    );
    if (result.status === 'renderer-ready' && sequence === region.sequence)
      region.last = { receipt: result.runtime, ...bound, ...(form.value === undefined ? {} : { inputs: form.value }) };
    return result;
  };

  return Object.freeze({
    runtime,
    mount,
    render,
    snapshot: (regionId: string) => runtime.snapshot(regionId),
    subscribe(regionId: string, listener: Parameters<AeliqoApp['subscribe']>[1]) {
      if (disposed) return () => {};
      let listeners = stateListeners.get(regionId);
      if (listeners === undefined) {
        listeners = new Set();
        stateListeners.set(regionId, listeners);
      }
      listeners.add(listener);
      const mounted = regions.get(regionId);
      if (mounted !== undefined) bridgeRuntimeState(mounted);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners?.delete(listener);
        if (listeners?.size === 0) stateListeners.delete(regionId);
      };
    },
    unmount(regionId: string) {
      const region = regions.get(regionId);
      if (region === undefined) return false;
      cancelActiveAction(region);
      region.resize?.disconnect();
      region.runtimeSubscription?.();
      region.element.dispose();
      region.element.remove();
      regions.delete(regionId);
      return runtime.unmount(regionId);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const region of regions.values()) {
        cancelActiveAction(region);
        region.resize?.disconnect();
        region.runtimeSubscription?.();
        region.element.dispose();
        region.element.remove();
      }
      regions.clear();
      stateListeners.clear();
      runtime.dispose();
    },
  } satisfies AeliqoApp);
}
