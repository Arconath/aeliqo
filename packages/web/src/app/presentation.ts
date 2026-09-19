import { validatePresentationPlan } from '@aeliqo/core/presentation';
import type { Diagnostic, Intent, Outcome, Result, Task } from '@aeliqo/core';
import type { PresentationEnvironment, PresentationRegistry, ValidatedPresentation } from '@aeliqo/core/presentation';
import type { RuntimeCommittedReceipt } from '@aeliqo/runtime/app';
import { recipeSupports } from '../recipes/standard.js';
import type { RecipeDefinition, RecipePresentationPolicy } from '../recipes/types.js';
import type { AeliqoRegionResult } from '../region/types.js';
import type { AeliqoInputBindings } from '../region/input-registry.js';
import { createFormBindings } from './form-bindings.js';
import type { AeliqoFormState, WebRenderReceipt } from './types.js';
import {
  diagnostic,
  environmentFor,
  experience,
  failedAfterRuntime,
  registryFor,
  presentationPolicy,
  withoutDataRevision,
  type WebAppContext,
  type WebRegion,
} from './context.js';
import type { AeliqoViewDefinition } from '../region/types.js';

interface PreparedDependencies {
  readonly current: NonNullable<RuntimeCommittedReceipt['region']['readSet']>;
  readonly result?: Result;
  readonly registry: PresentationRegistry;
  readonly recipe: RecipeDefinition;
  readonly environment: PresentationEnvironment;
  readonly policy?: RecipePresentationPolicy;
  readonly incumbent?: ValidatedPresentation['plan'];
}

interface PreparedPresentation {
  readonly presentation: ValidatedPresentation;
  readonly environment: PresentationEnvironment;
}

type Preparation = { readonly ok: true; readonly value: PreparedPresentation } | PreparationFailure;
type PreparationFailure = {
  readonly ok: false;
  readonly status: 'unsupported' | 'failed' | 'needs-input';
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
};
type DependencyResult = { readonly ok: true; readonly value: PreparedDependencies } | PreparationFailure;
type PolicyResult = { readonly ok: true; readonly value?: RecipePresentationPolicy } | PreparationFailure;

function preparationFailure(status: PreparationFailure['status'], item: Diagnostic): PreparationFailure {
  return { ok: false, status, diagnostics: [item] };
}

function currentReadSet(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  descriptors: readonly Result[],
): { readonly current: PreparedDependencies['current']; readonly result?: Result } | undefined {
  const current = context.runtime.snapshot(region.id)?.region?.readSet;
  const result = descriptors[0];
  if (current === undefined || (receipt.task.kind === 'data' && result === undefined)) return undefined;
  return { current, ...(result === undefined ? {} : { result }) };
}

function selectedRecipe(context: WebAppContext, intent: Intent): RecipeDefinition | undefined {
  return context.recipes.find((candidate) => recipeSupports(candidate, intent.kind));
}

function policyForTask(context: WebAppContext, region: WebRegion, task: Task): PolicyResult {
  if (task.kind !== 'data') return { ok: true };
  const resource = context.resources.get(region.resourceId);
  if (resource === undefined)
    return preparationFailure(
      'failed',
      diagnostic('web.app.resource', 'The mounted resource is unavailable for presentation policy.'),
    );
  return { ok: true, value: presentationPolicy(resource) };
}

function preparedDependencies(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  resultBindings: readonly AeliqoRegionResult[],
  descriptors: readonly Result[],
  inputs?: AeliqoInputBindings,
): DependencyResult {
  const source = currentReadSet(context, region, receipt, descriptors);
  if (source === undefined)
    return preparationFailure(
      'failed',
      diagnostic('web.app.result', 'The committed data Task has no materialized primary Result.'),
    );
  const registry = registryFor(resultBindings, descriptors, context.views, region.resourceId, inputs);
  if (registry === undefined)
    return preparationFailure(
      'failed',
      diagnostic('web.app.registry', 'The presentation registry could not be created.'),
    );
  const recipe = selectedRecipe(context, receipt.intent);
  if (recipe === undefined)
    return preparationFailure(
      'unsupported',
      diagnostic('web.app.recipe', 'No recipe supports ' + receipt.intent.kind + '.'),
    );
  const environment = environmentFor(region);
  const resolvedPolicy = policyForTask(context, region, receipt.task);
  if (!resolvedPolicy.ok) return resolvedPolicy;
  const policy = resolvedPolicy.value;
  const prior = region.element.presentation?.plan;
  const incumbent = prior?.preconditions.taskRevision === source.current.taskRevision ? prior : undefined;
  return {
    ok: true,
    value: {
      current: source.current,
      ...(source.result === undefined ? {} : { result: source.result }),
      registry,
      recipe,
      environment,
      ...(policy === undefined ? {} : { policy }),
      ...(incumbent === undefined ? {} : { incumbent }),
    },
  };
}

function validatedPlan(
  receipt: RuntimeCommittedReceipt,
  descriptors: readonly Result[],
  inputs: AeliqoInputBindings | undefined,
  views: readonly AeliqoViewDefinition[],
  prepared: PreparedDependencies,
): { readonly ok: true; readonly value: ValidatedPresentation } | PreparationFailure {
  const current = withoutDataRevision(prepared.current);
  const plan = prepared.recipe.build({
    intent: receipt.intent,
    task: receipt.task,
    ...(prepared.result === undefined ? {} : { result: prepared.result }),
    ...(inputs === undefined ? {} : { inputBindings: inputs }),
    current,
    environment: prepared.environment,
    availableViews: views,
    ...(prepared.policy === undefined ? {} : { presentationPolicy: prepared.policy }),
    ...(prepared.incumbent === undefined ? {} : { incumbent: prepared.incumbent }),
  });
  if (!plan.ok) {
    const status = plan.diagnostics.some((item) => item.code.startsWith('web.recipe.needs-input.'))
      ? 'needs-input'
      : 'unsupported';
    return { ok: false, status, diagnostics: plan.diagnostics };
  }
  const checked = validatePresentationPlan(
    plan.value,
    {
      task: receipt.task,
      experience: experience(prepared.registry, prepared.current.experienceRevision, prepared.policy),
      results: descriptors,
      current,
      environment: prepared.environment,
      rendererCapabilities: prepared.registry.manifests.map((manifest) => manifest.ref),
      stateMappingCapabilities: prepared.registry.stateMappings?.map((mapping) => mapping.ref) ?? [],
      ...(prepared.incumbent === undefined ? {} : { incumbent: prepared.incumbent }),
    },
    prepared.registry,
  );
  if (!checked.ok) return { ok: false, status: 'unsupported', diagnostics: checked.diagnostics };
  return { ok: true, value: checked.value };
}

function preparePresentation(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  resultBindings: readonly AeliqoRegionResult[],
  descriptors: readonly Result[],
  inputs?: AeliqoInputBindings,
): Preparation {
  const dependencies = preparedDependencies(context, region, receipt, resultBindings, descriptors, inputs);
  if (!dependencies.ok) return dependencies;
  const validated = validatedPlan(receipt, descriptors, inputs, context.views, dependencies.value);
  if (!validated.ok) return validated;
  return {
    ok: true,
    value: { presentation: validated.value, environment: dependencies.value.environment },
  };
}

function cancelledPresentation(
  receipt: RuntimeCommittedReceipt,
  requestId: string,
): ReturnType<typeof failedAfterRuntime> {
  return failedAfterRuntime('cancelled', receipt, requestId, [
    diagnostic('web.app.cancelled', 'A newer web operation replaced this presentation.'),
  ]);
}

function taskChanged(region: WebRegion, receipt: RuntimeCommittedReceipt): boolean {
  if (region.last === undefined) return false;
  return region.last.receipt.task.id !== receipt.task.id || region.last.receipt.task.revision !== receipt.task.revision;
}

function restoreElement(
  region: WebRegion,
  previous: {
    readonly presentation: typeof region.element.presentation;
    readonly results: typeof region.element.results;
    readonly interaction: typeof region.element.interaction;
  },
): void {
  region.element.presentation = previous.presentation;
  region.element.results = previous.results;
  region.element.interaction = previous.interaction;
}

function resetInteraction(region: WebRegion): void {
  region.values.clear();
  region.drafts.clear();
  delete region.actionAttempt;
  region.actionPending = false;
}

interface CommittedPresentation {
  readonly runtime: RuntimeCommittedReceipt;
  readonly presentation: ValidatedPresentation;
}

type RuntimeCommit =
  | { readonly ok: true; readonly value: CommittedPresentation }
  | { readonly ok: false; readonly receipt: WebRenderReceipt };

async function commitRuntime(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  requestId: string,
  prepared: PreparedPresentation,
  signal?: AbortSignal,
): Promise<RuntimeCommit> {
  const committed = await context.runtime.commitPresentation({
    regionId: region.id,
    requestId,
    task: receipt.task,
    presentation: prepared.presentation.plan,
    ...(signal === undefined ? {} : { signal }),
  });
  if (!committed.ok) {
    const stale = committed.diagnostics[0]?.code.includes('stale') === true;
    const status = stale ? 'cancelled' : 'failed';
    return { ok: false, receipt: failedAfterRuntime(status, receipt, requestId, committed.diagnostics) };
  }
  const task = committed.value.state?.task;
  const plan = committed.value.state?.presentation;
  if (task === undefined || plan === undefined)
    return {
      ok: false,
      receipt: failedAfterRuntime('failed', receipt, requestId, [
        diagnostic('web.app.commit', 'The committed Region did not retain its Task and presentation.'),
      ]),
    };
  return {
    ok: true,
    value: {
      runtime: { ...receipt, task, region: committed.value },
      presentation: { ...prepared.presentation, plan },
    },
  };
}

async function applyCommittedPresentation(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  resultBindings: readonly AeliqoRegionResult[],
  requestId: string,
  expectedSequence: number,
  prepared: PreparedPresentation,
  committed: CommittedPresentation,
): Promise<WebRenderReceipt> {
  const previous = {
    presentation: region.element.presentation,
    results: region.element.results,
    interaction: region.element.interaction,
  };
  const changesTask = taskChanged(region, receipt);
  if (region.sequence !== expectedSequence) return cancelledPresentation(receipt, requestId);
  try {
    region.element.viewRenderers = context.views;
    region.element.results = resultBindings;
    if (changesTask) region.element.interaction = undefined;
    region.element.presentation = committed.presentation;
    await region.element.updateComplete;
  } catch {
    if (region.sequence === expectedSequence) restoreElement(region, previous);
    return failedAfterRuntime('failed', receipt, requestId, [
      diagnostic('web.app.renderer', 'The renderer failed; the previous UI was restored.'),
    ]);
  }
  if (region.sequence !== expectedSequence) return cancelledPresentation(receipt, requestId);
  if (changesTask) resetInteraction(region);
  return {
    status: 'renderer-ready',
    requestId,
    regionId: region.id,
    runtime: committed.runtime,
    presentation: committed.presentation,
    environment: prepared.environment,
    diagnostics: [],
  };
}

async function commitPresentation(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  resultBindings: readonly AeliqoRegionResult[],
  requestId: string,
  expectedSequence: number,
  prepared: PreparedPresentation,
  signal?: AbortSignal,
): Promise<WebRenderReceipt> {
  const committed = await commitRuntime(context, region, receipt, requestId, prepared, signal);
  if (!committed.ok) return committed.receipt;
  return applyCommittedPresentation(
    context,
    region,
    receipt,
    resultBindings,
    requestId,
    expectedSequence,
    prepared,
    committed.value,
  );
}

export async function present(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  resultBindings: readonly AeliqoRegionResult[],
  descriptors: readonly Result[],
  requestId: string,
  expectedSequence: number,
  inputs?: AeliqoInputBindings,
  signal?: AbortSignal,
): Promise<WebRenderReceipt> {
  if (region.sequence !== expectedSequence) return cancelledPresentation(receipt, requestId);
  const prepared = preparePresentation(context, region, receipt, resultBindings, descriptors, inputs);
  if (!prepared.ok) return failedAfterRuntime(prepared.status, receipt, requestId, prepared.diagnostics);
  return commitPresentation(
    context,
    region,
    receipt,
    resultBindings,
    requestId,
    expectedSequence,
    prepared.value,
    signal,
  );
}

function formStateFailure(code: string, message: string): Outcome<never> {
  return { ok: false, diagnostics: [diagnostic(code, message)] };
}

async function readFormState(
  context: WebAppContext,
  region: WebRegion,
  intent: Extract<Intent, { readonly kind: 'create' | 'edit' }>,
  task: Extract<Task, { readonly kind: 'form' }>,
  resource: NonNullable<ReturnType<WebAppContext['resources']['get']>>,
  signal?: AbortSignal,
): Promise<Outcome<AeliqoFormState>> {
  const adapter = context.options.formState;
  if (adapter === undefined) {
    if (intent.kind === 'edit')
      return formStateFailure(
        'web.form-state.required',
        'Edit requires a trusted formState adapter to load current values and entity revision.',
      );
    return { ok: true, value: { values: {}, entityRevision: 'new' } };
  }
  const fallback = new AbortController();
  try {
    return await adapter.read({
      regionId: region.id,
      resource,
      intent,
      task,
      signal: signal ?? fallback.signal,
    });
  } catch {
    return formStateFailure('web.form-state.failed', 'The trusted formState adapter failed safely.');
  }
}

export async function resolveFormBindings(
  context: WebAppContext,
  region: WebRegion,
  receipt: RuntimeCommittedReceipt,
  signal?: AbortSignal,
): Promise<Outcome<AeliqoInputBindings | undefined>> {
  if (receipt.task.kind !== 'form') return { ok: true, value: undefined };
  if (receipt.intent.kind !== 'create' && receipt.intent.kind !== 'edit')
    return formStateFailure('web.form-state.intent', 'A form Task requires a create or edit intent.');
  const resource = context.resources.get(region.resourceId);
  if (resource === undefined)
    return formStateFailure('web.form-state.resource', 'The mounted form resource is unavailable.');
  const state = await readFormState(context, region, receipt.intent, receipt.task, resource, signal);
  if (!state.ok) return state;
  return createFormBindings(resource, receipt.intent, receipt.task, state.value);
}
