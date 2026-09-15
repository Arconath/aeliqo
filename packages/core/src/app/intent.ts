import {parseIntent, parseTask} from '../contracts/parse.js';
import type {Diagnostic, Intent, Outcome, QuerySpec, Task} from '../contracts/types.js';
import type {CompileIntentOptions, IntentCompilerContext, IntentIdentity, ResourceDefinition} from './types.js';

type Path = readonly (string | number)[];
function failure<T>(code: string, message: string, path: Path = [], remedies?: readonly string[]): Outcome<T> {
  const diagnostic: Diagnostic = {code, message, path, retryable: false, ...(remedies === undefined ? {} : {remedies})};
  return {ok: false, diagnostics: [diagnostic]};
}
function ref(id: string) { return {id, revision: '1'} as const; }

function fieldSet(resource: ResourceDefinition): ReadonlySet<string> {
  return new Set(resource.entity.fields.map((field) => field.id));
}

function validateFields(resource: ResourceDefinition, fields: readonly string[] | undefined, path: Path, includeIdentity = true): Outcome<readonly string[]> {
  const available = fieldSet(resource);
  const requested = fields ?? resource.entity.fields.filter((field) => resource.fieldMetadata[field.id]?.hidden !== true).map((field) => field.id);
  const selected = includeIdentity ? [...resource.entity.identity, ...requested] : requested;
  if (selected.length === 0) return failure('intent.empty-fields', 'At least one visible field is required.', path);
  for (let index = 0; index < selected.length; index += 1) {
    if (!available.has(selected[index]!)) return failure('intent.unknown-field', `Field ${selected[index]} is not available on ${resource.id}.`, [...path, index]);
  }
  return {ok: true, value: [...new Set(selected)]};
}

function identityPredicate(resource: ResourceDefinition, identity: IntentIdentity, path: Path): Outcome<NonNullable<QuerySpec['where']>> {
  const expected = resource.entity.identity;
  const keys = Object.keys(identity);
  if (keys.length !== expected.length || expected.some((field) => !Object.hasOwn(identity, field)) || keys.some((field) => !expected.includes(field)))
    return failure('intent.identity', `Identity for ${resource.id} must provide exactly: ${expected.join(', ')}.`, path);
  const predicates: NonNullable<QuerySpec['where']>[] = [];
  for (const field of expected) {
    const value = identity[field];
    if (value === undefined) return failure('intent.identity', `Identity field ${field} is missing.`, [...path, field]);
    predicates.push({op: 'compare', field, comparison: 'eq', value});
  }
  return predicates.length === 1 ? {ok: true, value: predicates[0]!} : {ok: true, value: {op: 'and', predicates}};
}

function mergeFilter(left: QuerySpec['where'], right: QuerySpec['where']): QuerySpec['where'] {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return {op: 'and', predicates: [left, right]};
}

function queryTask(intent: Intent, resource: ResourceDefinition, regionId: string, revision: string, query: QuerySpec,
  operation: string, needFields: readonly string[]): Task {
  const preferredView = intent.preferredView ?? resource.presentation.preferred?.[intent.kind === 'custom' ? 'browse' : intent.kind];
  return {
    version: '1', id: intent.id, revision, catalogRevision: resource.catalog.revision,
    functionRegistryDigest: resource.catalog.functionRegistryDigest, regionId, kind: 'data',
    goal: `${intent.kind} ${resource.label}`, assumptions: [],
    outputs: [{id: 'primary', kind: 'query', query, dependsOn: [], delivery: 'eager'}],
    needs: [{id: intent.kind, operation: ref(operation), outputId: 'primary', fields: needFields, required: true}],
    ...(preferredView === undefined ? {} : {viewPreference: {representation: preferredView, strength: 'preferred'}}),
  };
}

function baseQuery(resource: ResourceDefinition, fields: readonly string[]): QuerySpec {
  return {entity: resource.entity.id, fields, measures: [], relations: [], groupBy: [],
    population: {kind: 'all-authorized'}, order: []};
}

function compileStandard(intent: Exclude<Intent, {kind: 'custom'}>, context: IntentCompilerContext): Outcome<Task> {
  const resource = context.resource;
  if (!resource.intents.includes(intent.kind)) return failure('intent.unsupported', `${intent.kind} is not enabled for ${resource.id}.`, ['kind']);
  if (intent.preferredView !== undefined && !resource.presentation.allowedViews.includes(intent.preferredView))
    return failure('intent.unknown-view', `View ${intent.preferredView} is not allowed for ${resource.id}.`, ['preferredView']);

  if (intent.kind === 'create' || intent.kind === 'edit') {
    const binding = resource.forms?.[intent.kind];
    if (binding === undefined) return failure('intent.unsupported', `${intent.kind} needs a registered form and action.`, ['kind']);
    if (intent.kind === 'edit') {
      const identity = identityPredicate(resource, intent.identity, ['identity']);
      if (!identity.ok) return identity;
    }
    const task: Task = {
      version: '1', id: intent.id, revision: context.taskRevision, catalogRevision: resource.catalog.revision,
      functionRegistryDigest: resource.catalog.functionRegistryDigest, regionId: context.regionId, kind: 'form',
      goal: `${intent.kind} ${resource.label}`, assumptions: [], needs: [], schema: binding.schema, action: binding.action,
      ...(intent.kind === 'edit' ? {entityKey: JSON.stringify(intent.identity)} : {}),
      ...(intent.preferredView === undefined ? {} : {viewPreference: {representation: intent.preferredView, strength: 'preferred'}}),
    };
    return parseTask(task);
  }

  if (intent.kind === 'analyze') {
    const dimensionFields = intent.dimensions ?? [];
    const dimensions = dimensionFields.length === 0
      ? {ok: true as const, value: [] as readonly string[]}
      : validateFields(resource, dimensionFields, ['dimensions'], false);
    if (!dimensions.ok) return dimensions;
    for (let index = 0; index < intent.measures.length; index += 1) {
      const measure = intent.measures[index]!;
      const meaning = resource.catalog.meanings.find((candidate) => candidate.id === measure.id && candidate.revision === measure.revision);
      if (meaning === undefined) return failure('intent.unknown-meaning', `Meaning ${measure.id}@${measure.revision} is not registered for ${resource.id}.`, ['measures', index]);
    }
    if (intent.time !== undefined && !dimensionFields.includes(intent.time.field))
      return failure('intent.temporal-grain', 'The temporal field must be included in analyze dimensions.', ['time', 'field']);
    const timeBucket = intent.time === undefined ? undefined : {
      field: intent.time.field, grain: intent.time.grain,
      ...(intent.time.calendar === undefined ? {} : {calendar: intent.time.calendar}),
      ...(intent.time.timezone === undefined ? {} : {timezone: intent.time.timezone}),
      ...(intent.time.weekStartsOn === undefined ? {} : {weekStartsOn: intent.time.weekStartsOn}),
    };
    const query: QuerySpec = {entity: resource.entity.id, fields: dimensions.value, measures: intent.measures, relations: [],
      groupBy: dimensions.value, population: {kind: 'all-authorized'},
      ...(intent.filter === undefined ? {} : {where: intent.filter}), ...(intent.period === undefined ? {} : {period: intent.period}),
      ...(timeBucket === undefined ? {} : {timeBucket}),
      order: (intent.sort ?? []).map((sort) => ({field: sort.field, direction: sort.direction, nulls: sort.nulls ?? 'last'})),
      ...(intent.limit === undefined ? {} : {topK: intent.limit})};
    return {ok: true, value: queryTask(intent, resource, context.regionId, context.taskRevision, query, 'data.analyze', [...dimensions.value, ...intent.measures.map((measure) => measure.id)])};
  }

  const requested = validateFields(resource, intent.fields, ['fields'], false);
  if (!requested.ok) return requested;
  const selected = Object.freeze([...new Set([...resource.entity.identity, ...requested.value])]);
  if (intent.kind === 'browse') {
    const searchFields = intent.search?.fields ?? resource.entity.fields.filter((field) => field.type.value === 'text').map((field) => field.id);
    const search = intent.search === undefined ? undefined : validateFields(resource, searchFields, ['search', 'fields'], false);
    if (search !== undefined && !search.ok) return search;
    const query: QuerySpec = {...baseQuery(resource, selected), ...(intent.filter === undefined ? {} : {where: intent.filter}),
      ...(intent.search === undefined || search === undefined ? {} : {search: {text: intent.search.text, fields: [search.value[0]!, ...search.value.slice(1)]}}),
      order: (intent.sort ?? []).map((sort) => ({field: sort.field, direction: sort.direction, nulls: sort.nulls ?? 'last'})),
      ...(intent.page === undefined ? {} : {page: intent.page})};
    return {ok: true, value: queryTask(intent, resource, context.regionId, context.taskRevision, query, 'data.read', requested.value)};
  }
  if (intent.kind === 'detail') {
    const identity = identityPredicate(resource, intent.identity, ['identity']);
    if (!identity.ok) return identity;
    const query = {...baseQuery(resource, selected), where: identity.value, page: {size: 1}};
    return {ok: true, value: queryTask(intent, resource, context.regionId, context.taskRevision, query, 'data.read', requested.value)};
  }
  if (intent.kind === 'compare') {
    const predicates: NonNullable<QuerySpec['where']>[] = [];
    for (let index = 0; index < intent.identities.length; index += 1) {
      const predicate = identityPredicate(resource, intent.identities[index]!, ['identities', index]);
      if (!predicate.ok) return predicate;
      predicates.push(predicate.value);
    }
    const where: NonNullable<QuerySpec['where']> = predicates.length === 1 ? predicates[0]! : {op: 'or', predicates};
    const query = {...baseQuery(resource, selected), where};
    return {ok: true, value: queryTask(intent, resource, context.regionId, context.taskRevision, query, 'data.compare', requested.value)};
  }

  return failure('intent.unsupported', 'The intent kind is not supported.', ['kind']);
}

export function compileIntent(input: unknown, options: CompileIntentOptions): Outcome<Task> {
  const parsed = parseIntent(input);
  if (!parsed.ok) return parsed;
  const intent = parsed.value;
  if (intent.resource !== options.resource.id) return failure('intent.unknown-resource', `Intent targets ${intent.resource}, not ${options.resource.id}.`, ['resource']);
  const context: IntentCompilerContext = {resource: options.resource, regionId: options.regionId, taskRevision: options.taskRevision ?? '1'};
  if (intent.kind !== 'custom') return compileStandard(intent, context);
  if (intent.preferredView !== undefined && !options.resource.presentation.allowedViews.includes(intent.preferredView))
    return failure('intent.unknown-view', `View ${intent.preferredView} is not allowed for ${options.resource.id}.`, ['preferredView']);
  const definition = options.customIntents?.resolve(intent.intent);
  if (definition === undefined) return failure('intent.unknown-custom', `Custom intent ${intent.intent.id}@${intent.intent.revision} is not registered.`, ['intent']);
  const inputParsed = definition.schema.safeParse(intent.input);
  if (!inputParsed.success) {
    const diagnostics = inputParsed.error.issues.slice(0, 16).map((issue) => ({code: `intent.input.${issue.code}`, message: issue.message,
      path: ['input', ...issue.path.filter((part): part is string | number => typeof part !== 'symbol')], retryable: false} satisfies Diagnostic));
    const first = diagnostics[0];
    if (first === undefined) return failure('intent.input.invalid', 'The custom intent input is invalid.', ['input']);
    return {ok: false, diagnostics: [first, ...diagnostics.slice(1)]};
  }
  let outcome: Outcome<Task>;
  try { outcome = definition.compile(inputParsed.data, context); }
  catch { return failure('intent.compiler-failed', 'The registered custom intent compiler failed safely.', ['intent']); }
  if (!outcome.ok) return outcome;
  const task = parseTask(outcome.value);
  if (!task.ok) return task;
  if (task.value.regionId !== options.regionId || task.value.catalogRevision !== options.resource.catalog.revision || task.value.functionRegistryDigest !== options.resource.catalog.functionRegistryDigest)
    return failure('intent.compiler-stale', 'The custom intent compiler returned a Task pinned to another runtime context.', ['intent']);
  return task;
}

export function combineIntentFilter(left: QuerySpec['where'], right: QuerySpec['where']): QuerySpec['where'] {
  return mergeFilter(left, right);
}
