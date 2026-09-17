import type { Diagnostic, Outcome, PresentationPlan, ReadonlyJsonValue, Result, VersionRef } from '@aeliqo/core';
import type { PresentationStateMappingManifest, PresentationValues } from '@aeliqo/core/presentation';
import { AELIQO_CONFIG_SCHEMAS, AELIQO_OPERATION_REFS, AELIQO_PRESENTATION_REFS } from '../region/registry.js';
import { AELIQO_DATA_CONFIG_SCHEMAS, AELIQO_DATA_REFS } from '../region/data-registry.js';
import { AELIQO_INPUT_REFS } from '../input/manifest.js';
import { defineRecipe } from './define.js';
import type { RecipeContext, RecipeDefinition } from './types.js';

interface ViewChoice {
  readonly ref: VersionRef;
  readonly schema: VersionRef;
  readonly role: string;
  readonly operations: readonly VersionRef[];
}

const aliases: Readonly<Record<string, ViewChoice>> = Object.freeze({
  table: {
    ref: AELIQO_PRESENTATION_REFS.table,
    schema: AELIQO_CONFIG_SCHEMAS.table,
    role: 'table',
    operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.compare, AELIQO_OPERATION_REFS.analyze],
  },
  cards: {
    ref: AELIQO_DATA_REFS.cardCollection,
    schema: AELIQO_DATA_CONFIG_SCHEMAS.cardCollection,
    role: 'cardCollection',
    operations: [AELIQO_OPERATION_REFS.read],
  },
  list: {
    ref: AELIQO_DATA_REFS.recordList,
    schema: AELIQO_DATA_CONFIG_SCHEMAS.recordList,
    role: 'recordList',
    operations: [AELIQO_OPERATION_REFS.read],
  },
  detail: {
    ref: AELIQO_DATA_REFS.detail,
    schema: AELIQO_DATA_CONFIG_SCHEMAS.detail,
    role: 'detail',
    operations: [AELIQO_OPERATION_REFS.read],
  },
  trend: {
    ref: AELIQO_PRESENTATION_REFS.trend,
    schema: AELIQO_CONFIG_SCHEMAS.trend,
    role: 'trend',
    operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.compare, AELIQO_OPERATION_REFS.analyze],
  },
});

function failure(code: string, message: string): Outcome<never> {
  const item: Diagnostic = { code, message, retryable: false };
  return { ok: false, diagnostics: [item] };
}
function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}
function supportsOperation(operations: readonly VersionRef[], required: VersionRef): boolean {
  return operations.some((operation) => sameRef(operation, required));
}
function custom(
  context: RecipeContext,
  preferred: string,
):
  | {
      readonly ref: VersionRef;
      readonly schema: VersionRef;
      readonly role: string;
      readonly values: PresentationValues;
    }
  | undefined {
  if (context.result === undefined) return undefined;
  const definition = context.availableViews.find((view) => view.ref.id === preferred);
  const operation = context.task.needs[0]?.operation;
  if (
    definition === undefined ||
    operation === undefined ||
    !supportsOperation(definition.manifest.operations, operation)
  )
    return undefined;
  const suggested = definition.manifest.suggestConfig?.(context.task.needs, context.result);
  if (suggested !== undefined && !suggested.ok) return undefined;
  return {
    ref: definition.ref,
    schema: definition.manifest.configSchema,
    role: definition.manifest.roles[0]!,
    values: suggested?.value ?? {},
  };
}
function trendConfig(result: Result): PresentationValues | undefined {
  const temporal = result.fields.find((field) => field.type.value === 'date' || field.type.value === 'instant');
  const numeric = result.fields.find((field) => ['integer', 'float', 'decimal'].includes(field.type.value));
  if (temporal === undefined || numeric === undefined) return undefined;
  const seriesBy = result.rowGrain.filter((field) => field !== temporal.id && field !== numeric.id);
  return { labelField: temporal.id, series: [{ field: numeric.id }], seriesBy };
}
function dataColumns(context: RecipeContext, typed: boolean): readonly Readonly<Record<string, ReadonlyJsonValue>>[] {
  if (context.result === undefined) return [];
  const requested = new Set(context.task.needs[0]?.fields ?? []);
  return context.result.fields
    .filter((field) => requested.has(field.id))
    .map((field) => ({
      key: field.id,
      label: field.label,
      ...(typed ? { type: field.type.value } : {}),
    }));
}
function valuesFor(view: ViewChoice, context: RecipeContext): PresentationValues | undefined {
  if (context.result === undefined) return undefined;
  if (sameRef(view.ref, aliases.trend!.ref)) return trendConfig(context.result);
  if (sameRef(view.ref, aliases.table!.ref)) return { columns: dataColumns(context, false), selection: 'none' };
  const columns = dataColumns(context, true);
  if (sameRef(view.ref, aliases.detail!.ref)) return { fields: columns.map((column) => String(column.key)), columns };
  if (sameRef(view.ref, aliases.cards!.ref)) {
    const headingKey = context.result.fields.find(
      (field) =>
        context.task.needs[0]?.fields.includes(field.id) === true &&
        field.role === 'attribute' &&
        field.type.value === 'text',
    )?.id;
    return { columns, selection: 'none', ...(headingKey === undefined ? {} : { headingKey }) };
  }
  if (sameRef(view.ref, aliases.list!.ref)) return { columns, selection: 'none' };
  return {};
}
type SelectedView = {
  readonly ref: VersionRef;
  readonly schema: VersionRef;
  readonly role: string;
  readonly values: PresentationValues;
};

function preferredView(context: RecipeContext, preferred: string): SelectedView | undefined {
  const known = aliases[preferred] ?? Object.values(aliases).find((candidate) => candidate.ref.id === preferred);
  const operation = context.task.needs[0]?.operation;
  if (known !== undefined && operation !== undefined && supportsOperation(known.operations, operation)) {
    const values = valuesFor(known, context);
    if (values !== undefined) return { ...known, values };
  }
  return custom(context, preferred);
}

function viewWithValues(view: ViewChoice, context: RecipeContext): SelectedView {
  return { ...view, values: valuesFor(view, context) ?? {} };
}

function analyzeView(context: RecipeContext, result: Result): SelectedView {
  const values = trendConfig(result);
  if (values !== undefined) return { ...aliases.trend!, values };
  return viewWithValues(aliases.table!, context);
}

function browseView(context: RecipeContext, result: Result): SelectedView {
  const inlineSize = context.environment.inlineSize;
  const narrow = inlineSize.state === 'known' && inlineSize.value < 640;
  if (!narrow) return viewWithValues(aliases.table!, context);
  const cards = aliases.cards!;
  const values = valuesFor(cards, context) ?? {};
  const headingKey = result.fields.find((field) => field.role === 'attribute' && field.type.value === 'text')?.id;
  return { ...cards, values: { ...values, ...(headingKey === undefined ? {} : { headingKey }) } };
}

function viewForIntent(context: RecipeContext, result: Result): SelectedView {
  switch (context.intent.kind) {
    case 'detail':
      return viewWithValues(aliases.detail!, context);
    case 'compare':
      return viewWithValues(aliases.table!, context);
    case 'analyze':
      return analyzeView(context, result);
    default:
      return browseView(context, result);
  }
}

function selectedView(context: RecipeContext): SelectedView {
  if (context.result === undefined) throw new TypeError('A standard data recipe requires one Result descriptor.');
  const preferred = context.task.viewPreference?.representation;
  if (preferred !== undefined) {
    const choice = preferredView(context, preferred);
    if (choice !== undefined) return choice;
  }
  return viewForIntent(context, context.result);
}
function build(context: RecipeContext): Outcome<PresentationPlan> {
  if (context.task.kind !== 'data' || context.result === undefined)
    return failure('web.recipe.unsupported', 'Standard data recipes require a materialized data Task.');
  const view = selectedView(context);
  const need = context.task.needs[0];
  if (need === undefined) return failure('web.recipe.need', 'The Task has no presentation need.');
  const stateTransfer: Array<PresentationPlan['stateTransfer'][number]> = [];
  if (context.incumbent !== undefined) {
    for (const node of context.incumbent.nodes) {
      const mapping =
        sameRef(node.representation, view.ref) && node.role === view.role
          ? { id: 'aeliqo.state.identity', revision: '1' }
          : stateMapping(node.representation, view.ref)?.ref;
      if (mapping === undefined)
        return failure(
          'web.recipe.transition',
          'The current view cannot transfer its interaction state to the requested view.',
        );
      stateTransfer.push({ fromNode: node.id, toNode: 'primary', mapping });
    }
  }
  const plan: PresentationPlan = {
    id: `presentation-${context.task.id}`.slice(0, 160),
    revision: context.task.revision,
    rootId: 'primary',
    preconditions: context.current,
    nodes: [
      {
        id: 'primary',
        role: view.role,
        representation: view.ref,
        result: context.result.ref,
        config: { schema: view.schema, values: view.values },
        children: [],
      },
    ],
    links: [],
    coverage: [{ needId: need.id, nodeIds: ['primary'], operations: [need.operation] }],
    stateTransfer,
    diagnostics: [],
  };
  return { ok: true, value: plan };
}

export const standardDataRecipe: RecipeDefinition = defineRecipe({
  ref: { id: 'aeliqo.recipe.data', revision: '1' },
  intents: ['browse', 'detail', 'compare', 'analyze'],
  build,
});

function buildForm(context: RecipeContext): Outcome<PresentationPlan> {
  if (context.task.kind !== 'form' || context.inputBindings === undefined)
    return failure('web.recipe.unsupported', 'Standard form recipes require host-owned form bindings.');
  const form = context.inputBindings.inputs.find((binding) => binding.ref.id === AELIQO_INPUT_REFS.form.id);
  if (
    form === undefined ||
    form.action === undefined ||
    form.action.action.id !== context.task.action.id ||
    form.action.action.revision !== context.task.action.revision
  )
    return failure('web.recipe.form-binding', 'The form action is not pinned to the compiled Task action.');
  const fields = context.inputBindings.inputs.filter((binding) => binding.ref.id !== AELIQO_INPUT_REFS.form.id);
  const nodes: PresentationPlan['nodes'] = [
    {
      id: 'form',
      role: 'structure',
      representation: AELIQO_INPUT_REFS.form,
      config: {
        schema: { id: 'input.form.config', revision: '1' },
        values: { bindingRef: form.id, bindingRevision: context.inputBindings.revision },
      },
      children: fields.map((field) => field.id),
    },
    ...fields.map((field) => ({
      id: field.id,
      role: field.ref.id === AELIQO_INPUT_REFS.fieldGroup.id ? 'structure' : 'input',
      representation: field.ref,
      config: {
        schema: { id: `${field.ref.id}.config`, revision: '1' },
        values: { bindingRef: field.id, bindingRevision: context.inputBindings!.revision },
      },
      children: [],
    })),
  ];
  return {
    ok: true,
    value: {
      id: `presentation-${context.task.id}`.slice(0, 160),
      revision: context.task.revision,
      rootId: 'form',
      preconditions: context.current,
      nodes,
      links: [],
      coverage: [],
      stateTransfer:
        context.incumbent === undefined
          ? []
          : context.incumbent.nodes.map((node) => ({
              fromNode: node.id,
              toNode: node.id,
              mapping: { id: 'aeliqo.state.identity', revision: '1' },
            })),
      diagnostics: [],
    },
  };
}

export const standardFormRecipe: RecipeDefinition = defineRecipe({
  ref: { id: 'aeliqo.recipe.form', revision: '1' },
  intents: ['create', 'edit'],
  build: buildForm,
});

export const STANDARD_RECIPES: readonly RecipeDefinition[] = Object.freeze([standardDataRecipe, standardFormRecipe]);

export const STANDARD_VIEW_REFS = Object.freeze({
  table: AELIQO_PRESENTATION_REFS.table,
  cards: AELIQO_DATA_REFS.cardCollection,
  list: AELIQO_DATA_REFS.recordList,
  detail: AELIQO_DATA_REFS.detail,
  trend: AELIQO_PRESENTATION_REFS.trend,
});

export const STANDARD_STATE_MAPPINGS: readonly PresentationStateMappingManifest[] = Object.freeze([
  {
    ref: { id: 'aeliqo.web.table-to-cards', revision: '1' },
    from: AELIQO_PRESENTATION_REFS.table,
    to: AELIQO_DATA_REFS.cardCollection,
    fromRole: 'table',
    toRole: 'cardCollection',
    kind: 'transfer',
  },
  {
    ref: { id: 'aeliqo.web.cards-to-table', revision: '1' },
    from: AELIQO_DATA_REFS.cardCollection,
    to: AELIQO_PRESENTATION_REFS.table,
    fromRole: 'cardCollection',
    toRole: 'table',
    kind: 'transfer',
  },
]);

function stateMapping(from: VersionRef, to: VersionRef): PresentationStateMappingManifest | undefined {
  return STANDARD_STATE_MAPPINGS.find((mapping) => sameRef(mapping.from, from) && sameRef(mapping.to, to));
}

export function recipeSupports(recipe: RecipeDefinition, kind: RecipeContext['intent']['kind']): boolean {
  return recipe.intents.includes(kind);
}

export function standardOperationFor(kind: RecipeContext['intent']['kind']): VersionRef {
  if (kind === 'compare') return AELIQO_OPERATION_REFS.compare;
  if (kind === 'analyze') return AELIQO_OPERATION_REFS.analyze;
  return AELIQO_OPERATION_REFS.read;
}
