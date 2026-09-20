import { describe, expect, it } from 'vitest';
import { defineResource, type Intent, type Result, type Task } from '../../packages/core/src/index.js';
import {
  resolvePresentation,
  validatePresentationPlan,
  type PresentationEnvironment,
  type ValidatedPresentation,
} from '../../packages/core/src/presentation/index.js';
import type { AeliqoRuntime, RuntimeCommittedReceipt } from '../../packages/runtime/src/app/index.js';
import { html } from 'lit';
import * as z from 'zod';
import { defineView, standardDataRecipe, standardFormRecipe } from '../../packages/web/src/recipes/index.js';
import { standardRecipeCandidates } from '../../packages/web/src/recipes/standard.js';
import {
  experience,
  presentationPolicy,
  type WebAppContext,
  type WebRegion,
} from '../../packages/web/src/app/context.js';
import { createFormBindings } from '../../packages/web/src/app/form-bindings.js';
import { present } from '../../packages/web/src/app/presentation.js';
import { createAeliqoPresentationRegistry } from '../../packages/web/src/region/registry.js';

const current = {
  scopeDigest: 'scope-1',
  policyRevision: 'policy-1',
  taskRevision: '1',
  regionRevision: 'region-1',
  catalogRevision: 'catalog-1',
  experienceRevision: 'experience-1',
  functionRegistryDigest: 'core-query-2',
  results: [{ id: 'result-1', revision: '1', outputId: 'primary', queryDigest: 'query-1', scopeDigest: 'scope-1' }],
} as const;

const result: Result = {
  version: '1',
  ref: { id: 'result-1', revision: '1', outputId: 'primary', queryDigest: 'query-1', scopeDigest: 'scope-1' },
  taskId: 'browse-1',
  fields: [
    { id: 'id', label: 'ID', type: { value: 'text', nullable: false }, role: 'identity' },
    { id: 'name', label: 'Name', type: { value: 'text', nullable: false }, role: 'attribute' },
  ],
  identity: ['id'],
  rowGrain: ['id'],
  counts: { loaded: 1, population: { kind: 'exact', value: 1, populationDigest: 'population-1' } },
  precision: { kind: 'exact' },
  coverage: { kind: 'complete', populationDigest: 'population-1' },
  consistency: { kind: 'snapshot', snapshotId: 'snapshot-1', sourceRevisions: { people: '1' } },
  evidence: { kind: 'observed', source: { id: 'people', revision: '1' } },
  filters: [],
  warnings: [],
  lineage: [],
};

function environment(width: number): PresentationEnvironment {
  return {
    inlineSize: { state: 'known', value: width },
    blockSize: { state: 'known', value: 600 },
    textScale: { state: 'known', value: 1 },
    pointer: 'fine',
    hover: 'available',
    keyboard: 'available',
    locale: 'en-US',
    direction: 'ltr',
    reducedMotion: false,
    forcedColors: false,
  };
}

function input(kind: 'browse' | 'compare', width: number, preferredView?: string) {
  const intent: Intent =
    kind === 'browse'
      ? {
          version: '1',
          id: 'browse-1',
          kind,
          resource: 'people',
          ...(preferredView === undefined ? {} : { preferredView }),
        }
      : {
          version: '1',
          id: 'browse-1',
          kind,
          resource: 'people',
          identities: [{ id: 'p-1' }, { id: 'p-2' }],
          ...(preferredView === undefined ? {} : { preferredView }),
        };
  const task: Task = {
    version: '1',
    id: 'browse-1',
    revision: '1',
    catalogRevision: 'catalog-1',
    functionRegistryDigest: 'core-query-2',
    regionId: 'main',
    kind: 'data',
    goal: 'Browse people',
    assumptions: [],
    outputs: [
      {
        id: 'primary',
        kind: 'query',
        query: {
          entity: 'people',
          fields: ['id', 'name'],
          measures: [],
          relations: [],
          groupBy: [],
          population: { kind: 'all-authorized' },
          order: [],
        },
        dependsOn: [],
        delivery: 'eager',
      },
    ],
    needs: [
      {
        id: kind,
        operation: { id: kind === 'compare' ? 'data.compare' : 'data.read', revision: '1' },
        outputId: 'primary',
        fields: ['id', 'name'],
        required: true,
      },
    ],
    ...(preferredView === undefined
      ? {}
      : { viewPreference: { representation: preferredView, strength: 'preferred' } }),
  };
  return {
    intent,
    task,
    result: { ...result, taskId: task.id },
    current,
    environment: environment(width),
    availableViews: [],
  };
}

function trendInput(requestedMeasures: readonly [string, ...string[]]) {
  const measures: Extract<Intent, { readonly kind: 'analyze' }>['measures'] = [
    { id: requestedMeasures[0], revision: '1' },
    ...requestedMeasures.slice(1).map((id) => ({ id, revision: '1' })),
  ];
  const intent: Intent = {
    version: '1',
    id: 'headcount-trend',
    kind: 'analyze',
    resource: 'people',
    measures,
    time: { field: 'week', grain: 'week' },
    preferredView: 'trend',
  };
  const task: Task = {
    version: '1',
    id: intent.id,
    revision: '1',
    catalogRevision: 'catalog-1',
    functionRegistryDigest: 'core-query-2',
    regionId: 'main',
    kind: 'data',
    goal: 'Show weekly headcount',
    assumptions: [],
    outputs: [
      {
        id: 'primary',
        kind: 'query',
        query: {
          entity: 'people',
          fields: ['week'],
          measures,
          relations: [],
          groupBy: ['week'],
          population: { kind: 'all-authorized' },
          order: [],
        },
        dependsOn: [],
        delivery: 'eager',
      },
    ],
    needs: [
      {
        id: 'analyze',
        operation: { id: 'data.analyze', revision: '1' },
        outputId: 'primary',
        fields: ['week', ...requestedMeasures],
        required: true,
      },
    ],
    viewPreference: { representation: 'trend', strength: 'preferred' },
  };
  const trendResult: Result = {
    ...result,
    ref: { ...result.ref, id: 'trend-result' },
    taskId: task.id,
    fields: [
      { id: 'employeeNumber', label: 'Employee number', type: { value: 'integer', nullable: false }, role: 'identity' },
      { id: 'week', label: 'Week', type: { value: 'date', nullable: false }, role: 'time' },
      { id: 'headcount', label: 'Headcount', type: { value: 'integer', nullable: false }, role: 'measure' },
      { id: 'capacity', label: 'Capacity', type: { value: 'decimal', nullable: false }, role: 'measure' },
    ],
    identity: ['employeeNumber'],
    rowGrain: ['week'],
  };
  return {
    intent,
    task,
    result: trendResult,
    current: { ...current, results: [trendResult.ref] },
    environment: environment(800),
    availableViews: [],
  };
}

function resolveStandard(
  context: (ReturnType<typeof input> | ReturnType<typeof trendInput>) & {
    readonly presentationPolicy?: { readonly allowedRepresentations: readonly string[] };
  },
) {
  if (context.result === undefined) throw new Error('Expected a materialized standard result.');
  const row = Object.fromEntries(
    context.result.fields.map((field) => [
      field.id,
      field.type.value === 'date'
        ? '2026-01-01'
        : field.type.value === 'decimal'
          ? { decimal: '1' }
          : ['integer', 'float'].includes(field.type.value)
            ? 1
            : field.id,
    ]),
  );
  const registry = createAeliqoPresentationRegistry({
    data: [{ result: context.result, rows: [row] }],
    resolveEntity: () => 'people',
  });
  expect(registry.ok).toBe(true);
  if (!registry.ok) throw new Error('Expected the standard presentation registry.');
  const authored = standardRecipeCandidates(context as unknown as Parameters<typeof standardRecipeCandidates>[0]);
  expect(authored.ok).toBe(true);
  if (!authored.ok) throw new Error('Expected standard candidates.');
  return resolvePresentation({
    id: 'web-test',
    revision: context.task.revision,
    preconditions: context.current,
    context: {
      task: context.task,
      experience: experience(registry.value, context.current.experienceRevision, context.presentationPolicy),
      results: [context.result],
      current: context.current,
      environment: context.environment,
      rendererCapabilities: registry.value.manifests.map((manifest) => manifest.ref),
      stateMappingCapabilities: registry.value.stateMappings?.map((mapping) => mapping.ref) ?? [],
    },
    registry: registry.value,
    target: {
      address: {
        runtimeId: 'runtime-1',
        scopeInstanceId: 'scope-1',
        activationEpoch: 1,
        surfaceId: 'main',
        surfaceGeneration: 1,
      },
      state: 'active',
    },
    ...authored.value,
  });
}

describe('0.3 standard recipes', () => {
  it('authors candidates and lets the core resolver adapt wide and narrow browse views', () => {
    const wide = resolveStandard(input('browse', 1_280));
    const narrow = resolveStandard(input('browse', 360));

    expect(wide.status === 'ready' && wide.plan.plan.nodes[0]?.representation.id).toBe('data.table');
    expect(narrow.status === 'ready' && narrow.plan.plan.nodes[0]?.representation.id).toBe('data.card-collection');
  });

  it('does not fall back when an explicit view pin is operation-incompatible', () => {
    const context = input('compare', 320);
    const task: Task = {
      ...context.task,
      viewPreference: { representation: 'data.card-collection', strength: 'explicit' },
    };

    const decision = resolveStandard({ ...context, task });

    expect(decision.status).toBe('unsupported');
    if (decision.status === 'unsupported')
      expect(decision.reasons.map((reason) => reason.code)).toContain('presentation.pin-incompatible');
  });

  it('returns a stable authorized measure clarification through the resolver seam', () => {
    const decision = resolveStandard(trendInput(['headcount', 'capacity']));

    expect(decision).toMatchObject({
      status: 'needs-input',
      diagnostic: { code: 'web.recipe.needs-input.measure' },
      choices: [
        { id: 'capacity', label: 'capacity' },
        { id: 'headcount', label: 'headcount' },
      ],
    });
  });

  it('does not prompt for a disallowed trend when an eligible table can present the task', () => {
    const decision = resolveStandard({
      ...trendInput(['headcount', 'capacity']),
      presentationPolicy: { allowedRepresentations: ['data.table'] },
    });

    expect(decision).toMatchObject({ status: 'ready' });
    if (decision.status === 'ready') expect(decision.plan.plan.nodes[0]?.representation.id).toBe('data.table');
  });

  it('treats inherited object keys as unknown view preferences instead of executing alias lookups', () => {
    const decision = resolveStandard(input('browse', 800, '__proto__'));

    expect(decision).toMatchObject({ status: 'ready' });
    if (decision.status === 'ready') expect(decision.plan.plan.nodes[0]?.representation.id).toBe('data.table');

    const direct = standardDataRecipe.build(input('browse', 800, '__proto__'));
    expect(direct.ok && direct.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('adapts browse from a table to cards using container width without a model call', () => {
    const wide = standardDataRecipe.build(input('browse', 1_280));
    const narrow = standardDataRecipe.build(input('browse', 360));
    expect(wide.ok && wide.value.nodes[0]?.representation.id).toBe('data.table');
    expect(narrow.ok && narrow.value.nodes[0]?.representation.id).toBe('data.card-collection');
  });

  it('keeps compare in a simultaneous column-preserving table on narrow containers', () => {
    const narrow = standardDataRecipe.build(input('compare', 320));
    expect(narrow.ok && narrow.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('keeps a narrow browse in the only representation permitted by resource policy', () => {
    const outcome = standardDataRecipe.build({
      ...input('browse', 360),
      presentationPolicy: { allowedRepresentations: ['data.table'] },
    });
    expect(outcome.ok && outcome.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('binds a preferred trend to the requested semantic measure instead of a numeric identity', () => {
    const outcome = standardDataRecipe.build(trendInput(['headcount']));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.nodes[0]).toMatchObject({
      representation: { id: 'data.trend' },
      config: { values: { labelField: 'week', series: [{ field: 'headcount' }], seriesBy: [] } },
    });
  });

  it('requests a measure choice when a preferred trend has multiple requested measures', () => {
    const outcome = standardDataRecipe.build(trendInput(['headcount', 'capacity']));
    expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: 'web.recipe.needs-input.measure' }] });
  });

  it('requests a time field when a preferred trend has no requested temporal field', () => {
    const context = trendInput(['headcount']);
    const output = context.task.outputs[0];
    if (output.kind !== 'query') throw new Error('The trend fixture must use a query output.');
    const task: Task = {
      ...context.task,
      outputs: [{ ...output, query: { ...output.query, fields: [], groupBy: [] } }],
      needs: context.task.needs.map((need) => ({ ...need, fields: ['headcount'] })),
    };
    const outcome = standardDataRecipe.build({ ...context, task });
    expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: 'web.recipe.needs-input.time' }] });
  });

  it('requests a numeric measure when a preferred trend has no requested measure', () => {
    const context = trendInput(['headcount']);
    const output = context.task.outputs[0];
    if (output.kind !== 'query') throw new Error('The trend fixture must use a query output.');
    const task: Task = {
      ...context.task,
      outputs: [{ ...output, query: { ...output.query, measures: [] } }],
      needs: context.task.needs.map((need) => ({ ...need, fields: ['week'] })),
    };
    const outcome = standardDataRecipe.build({ ...context, task });
    expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: 'web.recipe.needs-input.measure' }] });
  });

  it('rejects a plan outside resource policy during final presentation validation', () => {
    const context = input('browse', 360);
    const unrestricted = standardDataRecipe.build(context);
    expect(unrestricted.ok && unrestricted.value.nodes[0]?.representation.id).toBe('data.card-collection');
    if (!unrestricted.ok || context.result === undefined) return;
    const resource = defineResource({
      id: 'people',
      revision: 'catalog-1',
      label: 'person',
      schema: z.object({ id: z.string(), name: z.string() }),
      identity: ['id'],
      presentation: { allowedViews: ['table'] },
      fields: { id: { label: 'ID' }, name: { label: 'Name' } },
    });
    const policy = presentationPolicy(resource);
    const registry = createAeliqoPresentationRegistry({
      data: [{ result: context.result, rows: [{ id: 'p-1', name: 'Ada' }] }],
      resolveEntity: () => 'people',
    });
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const checked = validatePresentationPlan(
      unrestricted.value,
      {
        task: context.task,
        results: [context.result],
        current,
        environment: context.environment,
        rendererCapabilities: registry.value.manifests.map((manifest) => manifest.ref),
        stateMappingCapabilities: registry.value.stateMappings?.map((mapping) => mapping.ref) ?? [],
        experience: experience(registry.value, current.experienceRevision, policy),
      },
      registry.value,
    );
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.diagnostics).toMatchObject([{ code: 'presentation.restricted' }]);
  });

  it('preserves the prior rendered result when a custom recipe violates resource policy', async () => {
    const wide = input('browse', 800);
    const narrow = input('browse', 360);
    const priorPlan = standardDataRecipe.build({
      ...wide,
      presentationPolicy: { allowedRepresentations: ['data.table'] },
    });
    const violatingPlan = standardDataRecipe.build(narrow);
    expect(priorPlan.ok).toBe(true);
    expect(violatingPlan.ok && violatingPlan.value.nodes[0]?.representation.id).toBe('data.card-collection');
    if (!priorPlan.ok || !violatingPlan.ok || wide.result === undefined) return;

    const resource = defineResource({
      id: 'people',
      revision: 'catalog-1',
      label: 'person',
      schema: z.object({ id: z.string(), name: z.string() }),
      identity: ['id'],
      presentation: { allowedViews: ['table'] },
      fields: { id: { label: 'ID' }, name: { label: 'Name' } },
    });
    const rows = [{ id: 'p-1', name: 'Ada' }];
    const bindings = [{ ref: wide.result.ref, rows }];
    const registry = createAeliqoPresentationRegistry({
      data: [{ result: wide.result, rows }],
      resolveEntity: () => 'people',
    });
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const checked = validatePresentationPlan(
      priorPlan.value,
      {
        task: wide.task,
        results: [wide.result],
        current,
        environment: wide.environment,
        rendererCapabilities: registry.value.manifests.map((manifest) => manifest.ref),
        stateMappingCapabilities: registry.value.stateMappings?.map((mapping) => mapping.ref) ?? [],
        experience: experience(registry.value, current.experienceRevision, presentationPolicy(resource)),
      },
      registry.value,
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const previous = {
      ...checked.value,
      plan: {
        ...checked.value.plan,
        preconditions: { ...checked.value.plan.preconditions, taskRevision: 'previous-task' },
      },
    } satisfies ValidatedPresentation;
    const elementState = {
      presentation: previous as ValidatedPresentation | undefined,
      results: bindings,
      interaction: undefined,
    };
    const target = {
      lang: '',
      ownerDocument: { documentElement: { lang: 'en-US' }, defaultView: null },
      getBoundingClientRect: () => ({ width: 360, height: 600 }),
    } as unknown as HTMLElement;
    const region = {
      id: 'main',
      resourceId: 'people',
      target,
      element: elementState,
      sequence: 1,
      category: 'narrow',
      composing: false,
      pendingAdapt: false,
      actionPending: false,
      actionSequence: 0,
      values: new Map(),
      drafts: new Map(),
    } as unknown as WebRegion;
    let commitCalls = 0;
    const runtime = {
      snapshot: () => ({ region: { readSet: { ...current, dataRevision: 1 } } }),
      commitPresentation: () => {
        commitCalls++;
        throw new Error('Policy rejection must happen before a presentation commit.');
      },
    } as unknown as AeliqoRuntime;
    const context = {
      options: {},
      runtime,
      resources: new Map([[resource.id, resource]]),
      recipes: [{ ...standardDataRecipe, build: () => violatingPlan }],
      views: [],
      regions: new Map(),
      stateListeners: new Map(),
      disposed: false,
    } as unknown as WebAppContext;
    const receipt = {
      status: 'committed',
      requestId: 'runtime-request',
      regionId: 'main',
      intent: narrow.intent,
      task: narrow.task,
      outputs: [],
      region: { id: 'main', readSet: { ...current, dataRevision: 1 } },
      diagnostics: [],
    } as unknown as RuntimeCommittedReceipt;

    const outcome = await present(context, region, receipt, bindings, [wide.result], 'web-request', 1);

    expect(outcome).toMatchObject({ status: 'unsupported', diagnostics: [{ code: 'presentation.restricted' }] });
    expect(commitCalls).toBe(0);
    expect(elementState.presentation).toBe(previous);
    expect(elementState.results).toBe(bindings);
  });

  it('cancels a delayed stale presentation before it can publish over a newer renderer-ready Region', async () => {
    const fixture = input('browse', 800);
    if (fixture.result === undefined) throw new Error('The browse fixture must materialize a Result.');
    const resource = defineResource({
      id: 'people',
      revision: 'catalog-1',
      label: 'person',
      schema: z.object({ id: z.string(), name: z.string() }),
      identity: ['id'],
      presentation: { allowedViews: ['table', 'cards'] },
      fields: { id: { label: 'ID' }, name: { label: 'Name' } },
    });
    const bindings = [{ ref: fixture.result.ref, rows: [{ id: 'p-1', name: 'Ada' }] }];
    const elementState = {
      presentation: undefined as ValidatedPresentation | undefined,
      results: [] as readonly (typeof bindings)[number][],
      interaction: undefined,
      updateComplete: Promise.resolve(),
    };
    const target = {
      lang: '',
      ownerDocument: { documentElement: { lang: 'en-US' }, defaultView: null },
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    } as unknown as HTMLElement;
    const region = {
      id: 'main',
      resourceId: 'people',
      target,
      element: elementState,
      sequence: 1,
      category: 'wide',
      composing: false,
      pendingAdapt: false,
      actionPending: false,
      actionSequence: 0,
      values: new Map(),
      drafts: new Map(),
    } as unknown as WebRegion;
    let delayedStarted!: () => void;
    const delayed = new Promise<void>((resolve) => (delayedStarted = resolve));
    const published: string[] = [];
    const runtime = {
      snapshot: () => ({ region: { readSet: { ...current, dataRevision: 1 } } }),
      commitPresentation: async (request: {
        readonly requestId: string;
        readonly signal?: AbortSignal;
        readonly task: Task;
        readonly presentation: unknown;
      }) => {
        if (request.requestId === 'stale') {
          delayedStarted();
          await new Promise<void>((resolve) => {
            if (request.signal?.aborted) resolve();
            else request.signal?.addEventListener('abort', () => resolve(), { once: true });
          });
          return {
            ok: false as const,
            diagnostics: [
              { code: 'runtime.region-cancelled', message: 'The stale commit was cancelled.', retryable: false },
            ],
          };
        }
        published.push(request.requestId);
        return {
          ok: true as const,
          value: { state: { task: request.task, presentation: request.presentation } },
        };
      },
    } as unknown as AeliqoRuntime;
    const context = {
      options: {},
      runtime,
      resources: new Map([[resource.id, resource]]),
      recipes: [standardDataRecipe],
      views: [],
      regions: new Map(),
      stateListeners: new Map(),
      disposed: false,
    } as unknown as WebAppContext;
    const receipt = {
      status: 'committed',
      requestId: 'runtime-request',
      regionId: 'main',
      intent: fixture.intent,
      task: fixture.task,
      outputs: [],
      region: { id: 'main', readSet: { ...current, dataRevision: 1 } },
      diagnostics: [],
    } as unknown as RuntimeCommittedReceipt;

    const stale = present(context, region, receipt, bindings, [fixture.result], 'stale', 1);
    const reachedCommit = await Promise.race([
      delayed.then(() => true),
      stale.then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    expect(reachedCommit).toBe(true);
    region.sequence = 2;
    const currentRender = await present(context, region, receipt, bindings, [fixture.result], 'current', 2);
    const staleRender = await stale;

    expect(staleRender).toMatchObject({ status: 'cancelled', requestId: 'stale' });
    expect(currentRender).toMatchObject({ status: 'renderer-ready', requestId: 'current' });
    expect(published).toEqual(['current']);
    expect(elementState.presentation).toBe(
      currentRender.status === 'renderer-ready' ? currentRender.presentation : undefined,
    );
  });

  it('treats an incompatible preferred view as a preference and falls back safely', () => {
    const outcome = standardDataRecipe.build(input('compare', 320, 'cards'));
    expect(outcome.ok && outcome.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('accepts a consumer-owned custom view without changing the framework registry', () => {
    const custom = defineView({
      ref: { id: 'example.people-grid', revision: '1' },
      manifest: {
        ref: { id: 'example.people-grid', revision: '1' },
        configSchema: { id: 'example.people-grid.config', revision: '1' },
        roles: ['grid'],
        operations: [{ id: 'data.read', revision: '1' }],
        result: 'required',
        children: { min: 0, max: 0 },
        visibility: 'leaf',
        extension: true,
        resolveConfig: (values) => ({
          ok: true,
          value: { values, fields: ['id', 'name'], ports: [], operations: [{ id: 'data.read', revision: '1' }] },
        }),
      },
      render: () => html`<div>Custom people grid</div>`,
    });
    const context = { ...input('browse', 800, custom.ref.id), availableViews: [custom] };
    const outcome = standardDataRecipe.build(context);
    expect(outcome.ok && outcome.value.nodes[0]?.representation.id).toBe('example.people-grid');
  });

  it('builds a queryless create form entirely from host-owned resource bindings', () => {
    const resource = defineResource({
      id: 'people',
      revision: 'catalog-1',
      label: 'person',
      schema: z.object({ id: z.string(), name: z.string(), active: z.boolean() }),
      identity: ['id'],
      presentation: { allowedViews: ['table'] },
      fields: { id: { label: 'ID' }, name: { label: 'Name' }, active: { label: 'Active' } },
      forms: {
        create: { schema: { id: 'people.create', revision: '1' }, action: { id: 'people.create', revision: '1' } },
      },
    });
    const intent: Intent = { version: '1', id: 'create-1', kind: 'create', resource: 'people' };
    const task: Task = {
      version: '1',
      id: 'create-1',
      revision: '1',
      catalogRevision: 'catalog-1',
      functionRegistryDigest: 'core-query-2',
      regionId: 'main',
      kind: 'form',
      goal: 'Create person',
      assumptions: [],
      needs: [],
      schema: { id: 'people.create', revision: '1' },
      action: { id: 'people.create', revision: '1' },
    };
    const bindings = createFormBindings(resource, intent, task, { values: {}, entityRevision: 'new' });
    expect(bindings.ok).toBe(true);
    if (!bindings.ok) return;
    const formCurrent = { ...current, taskRevision: '1', results: [] };
    const plan = standardFormRecipe.build({
      intent,
      task,
      inputBindings: bindings.value,
      current: formCurrent,
      environment: environment(360),
      availableViews: [],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const registry = createAeliqoPresentationRegistry({ inputs: bindings.value });
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const checked = validatePresentationPlan(
      plan.value,
      {
        task,
        results: [],
        current: formCurrent,
        environment: environment(360),
        rendererCapabilities: registry.value.manifests.map((manifest) => manifest.ref),
        stateMappingCapabilities: [],
        experience: {
          version: '1',
          id: 'web',
          revision: 'experience-1',
          mode: 'adaptive',
          agentAllowed: true,
          allowedRepresentations: registry.value.manifests.map((manifest) => manifest.ref.id),
          allowedPatterns: [],
          composition: { allowWithoutPreset: true, maxNodes: 32, maxExpansions: 64 },
          requiredOperations: [],
          tokenProfile: { id: 'tokens.default', revision: '1' },
          extensionAllowlist: [],
          transitionPolicy: 'stable',
        },
      },
      registry.value,
    );
    if (!checked.ok)
      throw new Error(checked.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join('\n'));
    expect(plan.value.nodes.map((node) => node.representation.id)).toEqual([
      'input.form',
      'input.text-field',
      'input.text-field',
      'input.checkbox',
    ]);
  });
});
