import {parseCatalog, parseContract} from '../contracts/parse.js';
import {inspectWire} from '../contracts/ingress.js';
import {WIRE_LIMITS} from '../contracts/limits.js';
import type {
  Catalog,
  Expression,
  FieldDefinition,
  MeaningDefinition,
  Outcome,
  QuerySpec,
  SemanticType,
  VersionRef,
} from '../contracts/types.js';
import {checkExpression} from '../expressions/check.js';
import {createFunctionRegistry} from '../expressions/registry.js';
import {createCatalogIndex} from '../semantics/catalog.js';
import type {FunctionRegistry, TypedExpression} from '../expressions/types.js';
import {
  type AggregateSpec,
  type DeriveSpec,
  type GroupKeySpec,
  type JoinSpec,
  type LogicalPlan,
  type PlanNode,
  type PlanOperation,
  type ProjectionSpec,
  type PredicateSpec,
  type QueryCost,
  type QueryField,
  type QueryInput,
  type QueryLimits,
  type QueryOutcome,
  type QueryPlannerOptions,
  type QueryPins,
  type QuerySchema,
  type RelationalQuery,
  type SemiJoinSpec,
  type SortSpec,
  type TimeBucketSpec,
  type WindowSpec,
} from './types.js';

const PLAN_ENTITY = '__aeliqo_plan__';
type CatalogEntity = Catalog['entities'][number];
type CatalogRelationship = Catalog['relationships'][number];
const DEFAULT_LIMITS: QueryLimits = Object.freeze({
  maxNodes: 256,
  maxDepth: 64,
  maxRows: 10_000,
  maxBytes: WIRE_LIMITS.bytes,
  maxJoinRows: 10_000,
  maxOperations: 1_000_000,
});

function failure<T>(code: string, message: string, path: readonly (string | number)[] = []): QueryOutcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path.length === 0 ? {} : {path: [...path]})}]};
}

function unsupported<T>(id: string, reason: string, alternatives: readonly string[] = [], path: readonly (string | number)[] = []): QueryOutcome<T> {
  return {ok: false, diagnostics: [{code: 'query.unsupported', message: `Query capability ${id} is not supported: ${reason}`, retryable: false, ...(path.length === 0 ? {} : {path: [...path]}), ...(alternatives.length === 0 ? {} : {remedies: [...alternatives]})}]};
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function safePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Query inputs cross a public boundary. Keep the accepted plan independent of
 * caller-owned arrays and objects, including nested expression metadata.
 * Contract values are JSON-like; rejecting other object kinds also avoids
 * retaining mutable class instances or executable values in a plan.
 */
function cloneSnapshot(value: unknown, active = new WeakSet<object>(), seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'undefined') return value;
  if (typeof value !== 'object') throw new Error('query snapshots may contain only data values');
  const existing = seen.get(value);
  if (existing !== undefined) {
    if (active.has(value)) throw new Error('query snapshots may not contain cycles');
    return existing;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) throw new Error('query snapshots may contain only plain objects');
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : Object.create(prototype);
  seen.set(value, copy);
  active.add(value);
  for (const key of Object.keys(value)) (copy as Record<string, unknown>)[key] = cloneSnapshot((value as Record<string, unknown>)[key], active, seen);
  active.delete(value);
  return copy;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function immutableSnapshot<T>(value: T): T {
  return deepFreeze(cloneSnapshot(value) as T);
}

function stable(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}

function fieldKey(entity: string, field: string): string {
  return JSON.stringify([entity, field]);
}

function relationKey(ref: VersionRef): string {
  return JSON.stringify([ref.id, ref.revision]);
}

function semanticType(type: SemanticType, grain: readonly string[]): SemanticType {
  return type.grain === undefined ? {...type, grain: [...grain]} : type;
}

function sourceField(entity: CatalogEntity, field: FieldDefinition): QueryField {
  return {
    id: fieldKey(entity.id, field.id), label: field.label,
    type: semanticType(field.type, entity.rowGrain.map((grain) => fieldKey(entity.id, grain))),
    role: field.role, source: {entity: entity.id, field: field.id},
  };
}

function scanSchema(entity: CatalogEntity): QuerySchema {
  const fields = entity.fields.map((field) => sourceField(entity, field));
  return {
    fields,
    identity: entity.identity.map((field) => fieldKey(entity.id, field)),
    grain: entity.rowGrain.map((field) => fieldKey(entity.id, field)),
  };
}

function roleForType(type: SemanticType): FieldDefinition['role'] {
  if (type.value === 'integer' || type.value === 'float' || type.value === 'decimal') return 'measure';
  return 'attribute';
}

function findField(schema: QuerySchema, expression: Extract<Expression, {kind: 'field'}>): QueryField | undefined {
  const candidates = schema.fields.filter((field) => {
    if (expression.entity !== undefined) return field.source?.entity === expression.entity && field.source.field === expression.ref;
    return field.id === expression.ref || field.source?.field === expression.ref;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

function syntheticId(index: number): string { return `f${index}`; }

function nonEmptyIds(values: readonly string[]): [string, ...string[]] {
  return values.length === 0 ? ['f0'] : [values[0]!, ...values.slice(1)];
}

function syntheticCatalog(schema: QuerySchema, registry: FunctionRegistry): Catalog {
  const fields = schema.fields.map((field, index) => ({
    id: syntheticId(index), label: field.label, type: field.type, role: field.role,
  }));
  return {
    version: '1', revision: 'query-schema', functionRegistryDigest: registry.digest,
    entities: [{id: PLAN_ENTITY, label: 'Query relation', identity: nonEmptyIds(schema.identity.map((value) => syntheticId(schema.fields.findIndex((field) => field.id === value)))), rowGrain: nonEmptyIds(schema.grain.map((value) => syntheticId(schema.fields.findIndex((field) => field.id === value)))), fields}],
    relationships: [], meanings: [], capabilities: [],
  };
}

interface ResolvedExpression {
  readonly original: Expression;
  readonly local: Expression;
  readonly typed: TypedExpression;
  readonly field?: QueryField;
}

function mapExpression(expression: Expression, schema: QuerySchema, path: readonly (string | number)[] = []): QueryOutcome<{readonly expression: Expression; readonly field?: QueryField}> {
  if (expression.kind === 'field') {
    const field = findField(schema, expression);
    if (field === undefined) return failure('query.field', 'Field reference is unknown or ambiguous in the current relation.', path);
    const index = schema.fields.findIndex((candidate) => candidate.id === field.id);
    return {ok: true, value: {expression: {kind: 'field', ref: syntheticId(index), entity: PLAN_ENTITY}, field}};
  }
  if (expression.kind === 'literal') return {ok: true, value: {expression}};
  if (expression.kind === 'definition') return unsupported('definition-expression', 'Meaning definitions must be resolved by the authorized planner before local evaluation.', ['Register a concrete expression definition.'], path);
  const args: Expression[] = [];
  for (let index = 0; index < expression.arguments.length; index += 1) {
    const mapped = mapExpression(expression.arguments[index]!, schema, [...path, 'arguments', index]);
    if (!mapped.ok) return mapped;
    args.push(mapped.value.expression);
  }
  return {ok: true, value: {expression: {kind: 'call', function: expression.function, arguments: args}}};
}

function resolveExpression(expression: Expression, schema: QuerySchema, registry: FunctionRegistry, context: 'row' | 'group' | 'window' = 'row'): QueryOutcome<ResolvedExpression> {
  const mapped = mapExpression(expression, schema);
  if (!mapped.ok) return mapped;
  const catalog = syntheticCatalog(schema, registry);
  const checked = checkExpression(mapped.value.expression, {catalog, registry, entityId: PLAN_ENTITY, evaluationContext: context});
  if (!checked.ok) return checked;
  return {ok: true, value: {original: expression, local: mapped.value.expression, typed: checked.value, ...(mapped.value.field === undefined ? {} : {field: mapped.value.field})}};
}

function sameTypeFamily(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value) return false;
  if (left.unit?.dimension !== right.unit?.dimension || left.unit?.currency !== right.unit?.currency || left.unit?.symbol !== right.unit?.symbol) return false;
  if (left.temporal?.calendar !== right.temporal?.calendar || left.temporal?.timezone !== right.temporal?.timezone || left.temporal?.grain !== right.temporal?.grain) return false;
  return true;
}

function validatePredicate(predicate: PredicateSpec, schema: QuerySchema, registry: FunctionRegistry, path: readonly (string | number)[] = []): QueryOutcome<void> {
  if (predicate.op === 'and' || predicate.op === 'or') {
    for (let index = 0; index < predicate.predicates.length; index += 1) {
      const child = validatePredicate(predicate.predicates[index]!, schema, registry, [...path, 'predicates', index]);
      if (!child.ok) return child;
    }
    return {ok: true, value: undefined};
  }
  if (predicate.op === 'not') return validatePredicate(predicate.predicate, schema, registry, [...path, 'predicate']);
  const leftExpression = predicate.op === 'compare' ? predicate.left : predicate.op === 'is-null' || predicate.op === 'in' ? predicate.expression : undefined;
  if (leftExpression === undefined) return failure('query.predicate', 'Predicate operator is not supported.');
  const left = resolveExpression(leftExpression, schema, registry);
  if (!left.ok) return left;
  if (predicate.op === 'is-null') return {ok: true, value: undefined};
  if (predicate.op === 'compare') {
    const right = resolveExpression(predicate.right, schema, registry);
    if (!right.ok) return right;
    if (!sameTypeFamily(left.value.typed.type, right.value.typed.type)) return failure('query.predicate-type', 'Comparison operands must have the same semantic type and unit.', [...path, 'right']);
    return {ok: true, value: undefined};
  }
  if (predicate.op !== 'in') return failure('query.predicate', 'Predicate operator is not supported.');
  for (let index = 0; index < predicate.values.length; index += 1) {
    const value = resolveExpression(predicate.values[index]!, schema, registry);
    if (!value.ok) return value;
    if (!sameTypeFamily(left.value.typed.type, value.value.typed.type)) return failure('query.predicate-type', 'Membership values must have the same semantic type and unit.', [...path, 'values', index]);
  }
  return {ok: true, value: undefined};
}

function fieldExpression(entity: string, field: string): Expression {
  return {kind: 'field', entity, ref: field};
}

function literalExpression(value: unknown, type: SemanticType): Expression {
  return {kind: 'literal', value: value as never, type};
}

function querySpecPredicate(predicate: QuerySpec['where'], entity: string, catalog: Catalog): QueryOutcome<PredicateSpec | undefined> {
  if (predicate === undefined) return {ok: true, value: undefined};
  const entityDefinition = catalog.entities.find((candidate) => candidate.id === entity);
  if (entityDefinition === undefined) return failure('query.entity', `Entity ${entity} is not declared.`);
  const convert = (input: QuerySpec['where']): QueryOutcome<PredicateSpec> => {
    if (input === undefined) return failure('query.predicate', 'Predicate is missing.');
    if (input.op === 'and' || input.op === 'or') {
      const predicates: PredicateSpec[] = [];
      for (let index = 0; index < input.predicates.length; index += 1) {
        const converted = convert(input.predicates[index]);
        if (!converted.ok) return converted;
        predicates.push(converted.value);
      }
      return {ok: true, value: {op: input.op, predicates}};
    }
    if (input.op === 'not') {
      const converted = convert(input.predicate);
      return converted.ok ? {ok: true, value: {op: 'not', predicate: converted.value}} : converted;
    }
    if (input.op !== 'compare' && input.op !== 'is-null' && input.op !== 'in') return failure('query.predicate', 'Predicate operator is not supported.');
    const selectedEntity = input.entity ?? entity;
    const selectedDefinition = catalog.entities.find((candidate) => candidate.id === selectedEntity);
    if (selectedDefinition === undefined) return failure('query.entity', `Entity ${selectedEntity} is not declared.`, ['where', 'entity']);
    const field = selectedDefinition.fields.find((candidate) => candidate.id === input.field);
    if (field === undefined) return failure('query.field', `Field ${input.field} is not declared on ${selectedEntity}.`, ['where', 'field']);
    const left = fieldExpression(selectedEntity, input.field);
    if (input.op === 'is-null') return {ok: true, value: {op: 'is-null', expression: left, negate: input.negate}};
    const type = semanticType(field.type, selectedDefinition.rowGrain.map((grain) => fieldKey(selectedEntity, grain)));
    if (input.op === 'compare') return {ok: true, value: {op: 'compare', left, comparison: input.comparison, right: literalExpression(input.value, {...type, nullable: input.value === null})}};
    return {ok: true, value: {op: 'in', expression: left, values: input.values.map((value) => literalExpression(value, {...type, nullable: value === null}))}};
  };
  return convert(predicate);
}

function meaningByRef(catalog: Catalog, definitions: readonly MeaningDefinition[], ref: VersionRef): MeaningDefinition | undefined {
  const key = relationKey(ref);
  return [...catalog.meanings, ...definitions].find((meaning) => relationKey(meaning) === key);
}

function aggregateFromMeaning(meaning: MeaningDefinition, _definitions: readonly MeaningDefinition[], _catalog: Catalog): QueryOutcome<AggregateSpec> {
  if (meaning.implementation.kind === 'host-capability') return unsupported('host-capability', `Meaning ${meaning.id}@${meaning.revision} is host-backed and has no local expression.`, ['Use the source capability executor.']);
  const expression = meaning.implementation.expression;
  if (expression.kind !== 'call') return unsupported('meaning-aggregate', `Meaning ${meaning.id}@${meaning.revision} is not an explicit aggregate call.`, ['Supply an approved aggregate meaning.']);
  return {ok: true, value: {id: meaning.id, label: meaning.label, function: expression.function, arguments: expression.arguments}};
}

function lowerQuerySpec(query: QuerySpec, catalog: Catalog, registry: FunctionRegistry, definitions: readonly MeaningDefinition[]): QueryOutcome<RelationalQuery> {
  type RelationUsage = {readonly relation: VersionRef; readonly kind: 'inner' | 'left' | 'semi'; readonly where?: QuerySpec['where']};
  const relationUsage = (query as QuerySpec & {readonly relationUsage?: readonly RelationUsage[]}).relationUsage;
  if (query.relations.length > 0 && (relationUsage === undefined || relationUsage.length !== query.relations.length)) return unsupported('query.relation-usage', 'Every relation reference must declare explicit inner, left or semijoin semantics.', ['Provide one relationUsage entry for each relation.'], ['relations']);
  if (query.relations.length === 0 && relationUsage !== undefined && relationUsage.length > 0) return failure('query.relation-usage', 'Relation usage cannot introduce a relation absent from the relation references.', ['relationUsage']);
  const joins: JoinSpec[] = [];
  const semiJoins: SemiJoinSpec[] = [];
  const seenRelations = new Set<string>();
  for (let index = 0; index < query.relations.length; index += 1) {
    const reference = query.relations[index]!;
    const usage = relationUsage?.find((candidate) => relationKey(candidate.relation) === relationKey(reference));
    if (usage === undefined || seenRelations.has(relationKey(reference))) return failure('query.relation-usage', 'Relation usage references must match each relation exactly once.', ['relationUsage', index]);
    seenRelations.add(relationKey(reference));
    const declared = relationshipFor(catalog, reference);
    if (declared === undefined) return failure('query.relationship', `Relationship ${relationKey(reference)} is not declared.`, ['relations', index]);
    let where: PredicateSpec | undefined;
    if (usage.where !== undefined) {
      const converted = querySpecPredicate(usage.where, declared.targetEntity, catalog);
      if (!converted.ok) return converted;
      where = converted.value;
    }
    if (usage.kind === 'semi') semiJoins.push({id: declared.id, rightEntity: declared.targetEntity, relationship: reference, ...(where === undefined ? {} : {where})});
    else joins.push({id: declared.id, rightEntity: declared.targetEntity, relationship: reference, kind: usage.kind, ...(where === undefined ? {} : {where})});
  }
  if (query.population.kind !== 'all-authorized') return unsupported('query.population-lineage', 'Fixed and live populations require an authorized result lineage input.', ['Provide a complete cohort source.'], ['population']);
  const where = querySpecPredicate(query.where, query.entity, catalog);
  if (!where.ok) return where;
  const entityDefinition = catalog.entities.find((candidate) => candidate.id === query.entity);
  if (entityDefinition === undefined) return failure('query.entity', `Entity ${query.entity} is not declared.`, ['entity']);
  let bucketId: string | undefined;
  let timeBuckets: TimeBucketSpec[] = [];
  if (query.timeBucket !== undefined) {
    const calendar = query.timeBucket.calendar ?? query.period?.calendar;
    const timezone = query.timeBucket.timezone ?? query.period?.timezone;
    if (calendar === undefined || timezone === undefined) return unsupported('query.time-bucket-policy', 'Time buckets require an explicit calendar and timezone policy.', ['Provide both fields on timeBucket or an instant period policy.'], ['timeBucket']);
    if ((query.timeBucket.calendar === undefined) !== (query.timeBucket.timezone === undefined)) return failure('query.time-bucket-policy', 'Calendar and timezone must be supplied together.', ['timeBucket']);
    if (query.period !== undefined && (calendar !== query.period.calendar || timezone !== query.period.timezone)) return failure('query.time-bucket-policy', 'The bucket and period policies disagree.', ['timeBucket']);
    const temporalField = entityDefinition.fields.find((candidate) => candidate.id === query.timeBucket!.field);
    if (temporalField === undefined) return failure('query.field', `Field ${query.timeBucket.field} is not declared on ${query.entity}.`, ['timeBucket', 'field']);
    if (temporalField.type.value !== 'instant' && temporalField.type.value !== 'date') return failure('query.period-type', 'Time buckets require a date or instant field.', ['timeBucket']);
    if (!['day', 'week', 'month', 'quarter', 'year'].includes(query.timeBucket.grain)) return unsupported('temporal-grain', 'The requested temporal grain is not in the bounded evaluator subset.', ['Use day, week, month, quarter or year.'], ['timeBucket', 'grain']);
    if (calendar !== 'gregorian' && calendar !== 'iso8601') return unsupported('temporal-policy', 'The requested civil calendar is not supported.', ['Use an explicit Gregorian or ISO8601 civil calendar.'], ['timeBucket']);
    if (query.timeBucket.grain === 'week' && query.timeBucket.weekStartsOn === undefined) return unsupported('temporal-week-start', 'Weekly buckets require an explicit week start.', ['Supply weekStartsOn from the domain policy.'], ['timeBucket']);
    bucketId = `__aeliqo_bucket_${query.timeBucket.field}_${query.timeBucket.grain}`;
    if (entityDefinition.fields.some((field) => field.id === bucketId)) return failure('query.time-bucket', 'Generated time bucket identifier collides with a source field.', ['timeBucket', 'field']);
    timeBuckets = [{id: bucketId, expression: fieldExpression(query.entity, query.timeBucket.field), grain: query.timeBucket.grain as TimeBucketSpec['grain'], calendar, timezone,
      ...(query.timeBucket.weekStartsOn === undefined ? {} : {weekStartsOn: query.timeBucket.weekStartsOn}), label: temporalField.label}];
  }
  const measureIds = new Set(query.measures.map((measure) => measure.id));
  const windowIds = new Set((query.windows ?? []).map((window) => window.id));
  const expressionForField = (field: string): Expression => bucketId !== undefined && query.timeBucket !== undefined && field === query.timeBucket.field
    ? query.groupBy.includes(field) ? {kind: 'field', ref: field} : {kind: 'field', ref: bucketId}
    : measureIds.has(field) || windowIds.has(field) ? {kind: 'field', ref: field} : fieldExpression(query.entity, field);
  const expressionForGroupField = (field: string): Expression => bucketId !== undefined && query.timeBucket !== undefined && field === query.timeBucket.field
    ? {kind: 'field', ref: bucketId}
    : fieldExpression(query.entity, field);
  const rewriteWindowExpression = (expression: Expression): Expression => {
    if (expression.kind === 'field') return bucketId !== undefined && query.timeBucket !== undefined && expression.ref === query.timeBucket.field && (expression.entity === undefined || expression.entity === query.entity)
      ? {kind: 'field', ref: bucketId}
      : expression;
    if (expression.kind !== 'call') return expression;
    return {kind: 'call', function: expression.function, arguments: expression.arguments.map(rewriteWindowExpression)};
  };
  const select: ProjectionSpec[] = [];
  const selected = new Set<string>();
  const addSelect = (field: string): void => {
    if (selected.has(field)) return;
    selected.add(field);
    select.push({id: field, expression: expressionForField(field)});
  };
  for (const field of query.fields) addSelect(field);
  const groupBy: GroupKeySpec[] = query.groupBy.map((field) => ({id: field, expression: expressionForGroupField(field)}));
  for (const field of query.groupBy) addSelect(field);
  const aggregates: AggregateSpec[] = [];
  for (let index = 0; index < query.measures.length; index += 1) {
    const meaning = meaningByRef(catalog, definitions, query.measures[index]!);
    if (meaning === undefined) return failure('query.meaning', `Meaning ${query.measures[index]!.id}@${query.measures[index]!.revision} is not authorized or declared.`, ['measures', index]);
    const aggregate = aggregateFromMeaning(meaning, definitions, catalog);
    if (!aggregate.ok) return aggregate;
    aggregates.push(aggregate.value);
    if (!select.some((item) => item.id === aggregate.value.id)) select.push({id: aggregate.value.id, expression: {kind: 'field', ref: aggregate.value.id}});
  }
  for (const field of query.fields) {
    if (groupBy.length > 0 && !groupBy.some((group) => group.id === field)) return failure('query.group-grain', `Projected field ${field} is not part of the requested grouping grain.`, ['fields']);
  }
  if (query.period !== undefined && query.timeBucket === undefined) return unsupported('query.period-field', 'A period needs an explicit temporal field or time bucket.', ['Provide timeBucket.field with period.'], ['period']);
  if (query.period !== undefined && (query.period.calendar !== 'gregorian' || query.period.timezone !== 'UTC')) return unsupported('temporal-policy', 'Only explicit Gregorian UTC periods are implemented in the pure evaluator.', ['Supply a host temporal policy for the requested calendar and timezone.'], ['period']);
  let filter = where.value;
  if (query.period !== undefined && query.timeBucket !== undefined) {
    const temporalField = entityDefinition.fields.find((candidate) => candidate.id === query.timeBucket!.field);
    if (temporalField === undefined) return failure('query.field', `Field ${query.timeBucket.field} is not declared on ${query.entity}.`, ['timeBucket', 'field']);
    if (temporalField.type.value !== 'instant') return unsupported('query.period-type', 'QuerySpec period bounds are instants and require an instant-valued time bucket field.', ['Use a typed RelationalQuery date predicate for local dates.'], ['period']);
    const type = semanticType(temporalField.type, entityDefinition.rowGrain.map((grain) => fieldKey(query.entity, grain)));
    const range: PredicateSpec = {op: 'and', predicates: [
      {op: 'compare', left: fieldExpression(query.entity, temporalField.id), comparison: 'gte', right: literalExpression(query.period.from, {...type, nullable: false})},
      {op: 'compare', left: fieldExpression(query.entity, temporalField.id), comparison: 'lt', right: literalExpression(query.period.toExclusive, {...type, nullable: false})},
    ]};
    filter = filter === undefined ? range : {op: 'and', predicates: [filter, range]};
  }
  if (query.page !== undefined) return unsupported('query.pagination', 'Delivery paging requires the ADC adapter and does not define the query population.', ['Use topK for an explicit ranked population, or execute paging through the ADC adapter.'], ['page']);
  if (query.topK !== undefined && query.order.length === 0) return failure('query.top-k-order', 'A top-K population requires an explicit deterministic ordering.', ['topK']);
  const orderBy: SortSpec[] = query.order.map((entry) => ({expression: bucketId !== undefined && query.timeBucket !== undefined && entry.field === query.timeBucket.field
    ? {kind: 'field', ref: query.groupBy.includes(entry.field) ? entry.field : bucketId}
    : measureIds.has(entry.field) ? {kind: 'field', ref: entry.field} : fieldExpression(query.entity, entry.field), direction: entry.direction, nulls: entry.nulls}));
  const windows: WindowSpec[] = (query.windows ?? []).map((window) => ({
    id: window.id,
    function: window.function,
    arguments: window.arguments.map(rewriteWindowExpression),
    partitionBy: window.partitionBy.map(rewriteWindowExpression),
    orderBy: window.orderBy.map((entry) => ({...entry, expression: rewriteWindowExpression(entry.expression)})),
    frame: {preceding: window.frame.preceding, following: window.frame.following},
  }));
  return {ok: true, value: {
    root: query.entity, select, ...(filter === undefined ? {} : {filter}),
    ...(joins.length === 0 ? {} : {joins}), ...(semiJoins.length === 0 ? {} : {semiJoins}),
    ...(timeBuckets.length === 0 ? {} : {timeBuckets}), ...(windows.length === 0 ? {} : {windows}),
    ...(groupBy.length === 0 ? {} : {groupBy}), ...(aggregates.length === 0 ? {} : {aggregates}),
    ...(orderBy.length === 0 ? {} : {orderBy}),
    ...(query.topK === undefined ? {} : {topK: query.topK}),
    pins: {catalogRevision: catalog.revision, functionRegistryDigest: registry.digest},
  }};
}

interface PlannerState {
  readonly nodes: PlanNode[];
  current: string;
  schema: QuerySchema;
  depth: number;
  cost: QueryCost;
}

function estimateBytes(schema: QuerySchema, rows: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, rows) * Math.max(1, schema.fields.length) * 32);
}

function nextCost(previous: QueryCost, schema: QuerySchema, operation: PlanOperation, rows: number, joinRows = previous.joinRows, requiresComplete = previous.requiresComplete): QueryCost {
  const operations = previous.operations + Math.max(1, rows);
  return {estimatedRows: Math.max(0, rows), estimatedBytes: estimateBytes(schema, rows), nodes: previous.nodes + 1, joinRows: joinRows + (operation === 'join' || operation === 'semijoin' ? rows : 0), requiresComplete: requiresComplete || operation === 'join' || operation === 'semijoin' || operation === 'group' || operation === 'aggregate' || operation === 'top-k' || operation === 'window', operations};
}

function nodeDetail(operation: PlanOperation): string {
  return operation === 'semijoin' ? 'membership join preserves left identity and row count' : operation === 'join' ? 'declared cardinality join' : `${operation} over bounded typed relation`;
}

function relationshipFor(catalog: Catalog, ref: VersionRef): CatalogRelationship | undefined {
  return catalog.relationships.find((relationship) => relationship.id === ref.id && relationship.revision === ref.revision);
}

function validateRelationshipKeyTypes(catalog: Catalog, relationship: CatalogRelationship, path: readonly (string | number)[]): QueryOutcome<void> {
  const source = catalog.entities.find((entity) => entity.id === relationship.sourceEntity);
  const target = catalog.entities.find((entity) => entity.id === relationship.targetEntity);
  if (source === undefined || target === undefined) return failure('query.relationship-key', 'Relationship key entities are not declared.', path);
  for (let index = 0; index < relationship.keys.length; index += 1) {
    const key = relationship.keys[index]!;
    const left = source.fields.find((field) => field.id === key.sourceField);
    const right = target.fields.find((field) => field.id === key.targetField);
    if (left === undefined || right === undefined) return failure('query.relationship-key', 'Relationship key fields are not declared on their entities.', [...path, 'keys', index]);
    if (!sameTypeFamily(left.type, right.type)) return failure('query.relationship-key-type', 'Relationship key fields must have compatible semantic types, units and temporal policies.', [...path, 'keys', index]);
  }
  return {ok: true, value: undefined};
}

function schemaFieldBySource(schema: QuerySchema, entity: string, field: string): QueryField | undefined {
  return schema.fields.find((candidate) => candidate.source?.entity === entity && candidate.source.field === field);
}

function addNode(state: PlannerState, operation: PlanOperation, output: QuerySchema, params: Record<string, unknown>, limits: QueryLimits, inputs: readonly string[], rows: number, joinRows = state.cost.joinRows, requiresComplete = state.cost.requiresComplete): QueryOutcome<void> {
  const id = `n${state.nodes.length}-${operation}`;
  const cost = nextCost(state.cost, output, operation, Math.min(limits.maxRows, rows), joinRows, requiresComplete);
  if (cost.nodes > limits.maxNodes || state.depth + 1 > limits.maxDepth || cost.operations > limits.maxOperations) return failure('query.budget', 'Logical query plan exceeds the bounded node, depth or operation budget.');
  if (cost.joinRows > limits.maxJoinRows) return failure('query.budget', 'Logical query plan exceeds the bounded join-row budget.');
  const node = {id, op: operation, inputs: [...inputs], output, cost, ...params} as unknown as PlanNode;
  state.nodes.push(node);
  state.current = id;
  state.schema = output;
  state.depth += 1;
  state.cost = cost;
  return {ok: true, value: undefined};
}

function validatePins(pins: QueryPins, catalog: Catalog, registry: FunctionRegistry): QueryOutcome<void> {
  if (!safeId(pins.catalogRevision) || pins.catalogRevision !== catalog.revision) return failure('query.stale-catalog', 'Query pins must match the current catalog revision.', ['pins', 'catalogRevision']);
  if (!safeId(pins.functionRegistryDigest) || pins.functionRegistryDigest !== registry.digest) return failure('query.stale-registry', 'Query pins must match the current function registry digest.', ['pins', 'functionRegistryDigest']);
  for (const value of [pins.sourceRevision, pins.scopeDigest, pins.policyRevision]) if (value !== undefined && !safeId(value)) return failure('query.pin', 'Query revision and scope pins must be bounded identifiers.', ['pins']);
  return {ok: true, value: undefined};
}

function outputField(id: string, expression: ResolvedExpression, label: string | undefined, role: FieldDefinition['role'] | undefined): QueryField {
  return {id, label: label ?? expression.field?.label ?? id, type: expression.typed.type, role: role ?? expression.field?.role ?? roleForType(expression.typed.type), ...(expression.field?.source === undefined ? {} : {source: expression.field.source})};
}

function projectSchema(input: QuerySchema, items: readonly ProjectionSpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields: QueryField[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!safeId(item.id) || ids.has(item.id)) return failure('query.projection', 'Projection identifiers must be unique bounded identifiers.', ['select']);
    ids.add(item.id);
    const expression = resolveExpression(item.expression, input, registry);
    if (!expression.ok) return expression;
    fields.push(outputField(item.id, expression.value, item.label, item.role));
  }
  const identity = input.identity.map((fieldId) => items.find((item) => {
    const field = item.expression.kind === 'field' ? findField(input, item.expression) : undefined;
    return field?.id === fieldId;
  })?.id).filter((value): value is string => value !== undefined);
  const grain = input.grain.map((fieldId) => items.find((item) => {
    const field = item.expression.kind === 'field' ? findField(input, item.expression) : undefined;
    return field?.id === fieldId;
  })?.id).filter((value): value is string => value !== undefined);
  if (identity.length !== input.identity.length) return unsupported('identity-projection', 'Every input identity field must remain projected for stable result lineage.', ['Project all identity fields.'], ['select']);
  return {ok: true, value: {fields, identity, grain}};
}

function appendSchema(input: QuerySchema, items: readonly ProjectionSpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields = [...input.fields];
  const ids = new Set(fields.map((field) => field.id));
  for (const item of items) {
    if (!safeId(item.id) || ids.has(item.id)) return failure('query.derive', 'Derived identifiers must be unique and must not shadow an input field.', ['derives']);
    ids.add(item.id);
    const expression = resolveExpression(item.expression, input, registry);
    if (!expression.ok) return expression;
    fields.push(outputField(item.id, expression.value, item.label, item.role));
  }
  return {ok: true, value: {fields, identity: input.identity, grain: input.grain}};
}

function timeBucketSchema(input: QuerySchema, items: readonly TimeBucketSpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields = [...input.fields];
  const ids = new Set(fields.map((field) => field.id));
  for (const item of items) {
    if (!safeId(item.id) || ids.has(item.id)) return failure('query.time-bucket', 'Time bucket identifiers must be unique and must not shadow an input field.', ['timeBuckets']);
    if (item.calendar !== 'gregorian' && item.calendar !== 'iso8601') return unsupported('temporal-policy', 'The requested civil calendar is not supported.', ['Use Gregorian or ISO8601 civil dates.'], ['timeBuckets']);
    if (!safeId(item.timezone)) return failure('query.temporal-policy', 'A bounded timezone identifier is required.', ['timeBuckets']);
    try { new Intl.DateTimeFormat('en', {timeZone: item.timezone}); } catch { return unsupported('temporal-policy', 'The timezone identifier is not supported by this environment.', ['Use a supported timezone identifier.'], ['timeBuckets']); }
    if (item.weekStartsOn !== undefined && (!Number.isInteger(item.weekStartsOn) || item.weekStartsOn < 0 || item.weekStartsOn > 6)) return failure('query.temporal-week-start', 'Week start must be an integer from zero through six.', ['timeBuckets']);
    if (item.calendar === 'iso8601' && item.grain === 'week' && item.weekStartsOn !== 1) return unsupported('temporal-week-start', 'ISO8601 weeks start on Monday.', ['Set weekStartsOn to 1.'], ['timeBuckets']);
    if (!['day', 'week', 'month', 'quarter', 'year'].includes(item.grain)) return unsupported('temporal-grain', 'The requested temporal grain is not in the bounded evaluator subset.', ['Use day, week, month, quarter or year.'], ['timeBuckets']);
    if (item.grain === 'week' && item.weekStartsOn === undefined) return unsupported('temporal-week-start', 'Weekly buckets require an explicit week start.', ['Set weekStartsOn to an ISO or locale-approved weekday.'], ['timeBuckets']);
    const expression = resolveExpression(item.expression, input, registry);
    if (!expression.ok) return expression;
    if (expression.value.typed.type.value !== 'date' && expression.value.typed.type.value !== 'instant') return failure('query.temporal-type', 'Time buckets require a date or instant expression.', ['timeBuckets']);
    const sourceType = expression.value.typed.type;
    if (sourceType.value === 'instant' && (item.timezone !== 'UTC' || item.calendar !== 'gregorian')) return unsupported('temporal-policy', 'Instant conversion currently supports Gregorian UTC buckets only.', ['Use a host temporal adapter for other instant timezones.'], ['timeBuckets']);
    if (sourceType.temporal !== undefined && (sourceType.temporal.calendar !== item.calendar || sourceType.temporal.timezone !== item.timezone)) return failure('query.temporal-policy', 'The bucket policy conflicts with its source temporal semantics.', ['timeBuckets']);
    const bucketType: SemanticType = {value: 'date', nullable: sourceType.nullable, grain: [...input.grain], temporal: {calendar: item.calendar, timezone: item.timezone, grain: item.grain}};
    fields.push({id: item.id, label: item.label ?? item.id, type: bucketType, role: 'dimension'});
    ids.add(item.id);
  }
  return {ok: true, value: {fields, identity: input.identity, grain: input.grain}};
}

function windowSchema(input: QuerySchema, items: readonly WindowSpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields = [...input.fields];
  const ids = new Set(fields.map((field) => field.id));
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (!safeId(item.id) || ids.has(item.id)) return failure('query.window', 'Window identifiers must be unique and must not shadow an input field.', ['windows', index]);
    if (!safePositive(item.frame.preceding) && item.frame.preceding !== 0) return failure('query.window-frame', 'Window preceding bound must be a nonnegative safe integer.', ['windows', index, 'frame', 'preceding']);
    if (!safePositive(item.frame.following) && item.frame.following !== 0) return failure('query.window-frame', 'Window following bound must be a nonnegative safe integer.', ['windows', index, 'frame', 'following']);
    if (item.function.id === 'core.window.lag' && item.frame.preceding < 1) return failure('query.window-frame', 'lag requires at least one preceding row.', ['windows', index, 'frame', 'preceding']);
    const signature = registry.resolve(item.function);
    if (signature === undefined) return failure('query.function', `Window function ${relationKey(item.function)} is not registered.`, ['windows', index, 'function']);
    if (!signature.contexts.includes('window')) return failure('query.window-context', `Function ${relationKey(item.function)} is not registered for window evaluation.`, ['windows', index, 'function']);
    for (let partitionIndex = 0; partitionIndex < item.partitionBy.length; partitionIndex += 1) {
      const checked = resolveExpression(item.partitionBy[partitionIndex]!, input, registry, 'row');
      if (!checked.ok) return checked;
    }
    for (let orderIndex = 0; orderIndex < item.orderBy.length; orderIndex += 1) {
      const checked = resolveExpression(item.orderBy[orderIndex]!.expression, input, registry, 'row');
      if (!checked.ok) return checked;
    }
    for (let argumentIndex = 0; argumentIndex < item.arguments.length; argumentIndex += 1) {
      const checked = resolveExpression(item.arguments[argumentIndex]!, input, registry, 'row');
      if (!checked.ok) return checked;
    }
    const call: Expression = {kind: 'call', function: item.function, arguments: item.arguments};
    const checked = resolveExpression(call, input, registry, 'window');
    if (!checked.ok) return checked;
    fields.push(outputField(item.id, checked.value, item.label, roleForType(checked.value.typed.type)));
    ids.add(item.id);
  }
  return {ok: true, value: {fields, identity: input.identity, grain: input.grain}};
}

function joinSchema(left: QuerySchema, right: QuerySchema, relationship: CatalogRelationship, kind: JoinSpec['kind']): QuerySchema {
  const rightFields = kind === 'left'
    ? right.fields.map((field) => ({...field, type: {...field.type, nullable: true}}))
    : right.fields;
  return {
    fields: [...left.fields, ...rightFields],
    identity: [...left.identity, ...right.identity],
    grain: relationship.cardinality === 'many-to-one' ? left.grain : [...left.grain, ...right.grain],
  };
}

function groupSchema(input: QuerySchema, keys: readonly GroupKeySpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields: QueryField[] = [];
  const ids = new Set<string>();
  for (const key of keys) {
    if (!safeId(key.id) || ids.has(key.id)) return failure('query.group', 'Group identifiers must be unique bounded identifiers.', ['groupBy']);
    ids.add(key.id);
    const expression = resolveExpression(key.expression, input, registry);
    if (!expression.ok) return expression;
    fields.push(outputField(key.id, expression.value, key.label, 'dimension'));
  }
  const grain = fields.map((field) => field.id);
  return {ok: true, value: {fields: fields.map((field) => ({...field, type: {...field.type, grain}})), identity: grain, grain}};
}

function aggregateSchema(input: QuerySchema, groupOutput: QuerySchema, items: readonly AggregateSpec[], registry: FunctionRegistry): QueryOutcome<QuerySchema> {
  const fields = [...groupOutput.fields];
  const ids = new Set(fields.map((field) => field.id));
  for (const item of items) {
    if (!safeId(item.id) || ids.has(item.id)) return failure('query.aggregate', 'Aggregate identifiers must be unique and must not shadow group keys.', ['aggregates']);
    const call: Expression = {kind: 'call', function: item.function, arguments: item.arguments};
    const checked = resolveExpression(call, input, registry, 'group');
    if (!checked.ok) return checked;
    const containsAggregate = (expression: Expression): boolean => {
      if (expression.kind !== 'call') return false;
      const signature = registry.resolve(expression.function);
      return signature !== undefined && (signature.operation === 'aggregate' || signature.operation === 'ratio-of-sums' || signature.operation === 'mean-of-rates' || expression.arguments.some(containsAggregate));
    };
    if (checked.value.typed.operation !== 'aggregate' && checked.value.typed.operation !== 'ratio-of-sums' && checked.value.typed.operation !== 'mean-of-rates' && !containsAggregate(call)) return unsupported('aggregate-function', `Function ${item.function.id}@${item.function.revision} is not an aggregate operation.`, ['Use an approved aggregate function.'], ['aggregates']);
    const field = outputField(item.id, checked.value, item.label, 'measure');
    fields.push({...field, type: {...field.type, grain: groupOutput.grain}});
    ids.add(item.id);
  }
  return {ok: true, value: {fields, identity: groupOutput.identity, grain: groupOutput.grain}};
}

function buildPlan(input: RelationalQuery, catalog: Catalog, registry: FunctionRegistry, limits: QueryLimits): QueryOutcome<LogicalPlan> {
  if (input.topK !== undefined && (input.orderBy?.length ?? 0) === 0) return failure('query.top-k-order', 'A top-K population requires an explicit deterministic ordering.', ['topK']);
  const pins = input.pins;
  const pinCheck = validatePins(pins, catalog, registry);
  if (!pinCheck.ok) return pinCheck;
  const entity = catalog.entities.find((candidate) => candidate.id === input.root);
  if (entity === undefined) return failure('query.entity', `Entity ${input.root} is not declared.`, ['root']);
  if (!Array.isArray(input.select) || input.select.length === 0) return failure('query.projection', 'A relational query must declare at least one projected field.', ['select']);
  const state: PlannerState = {nodes: [], current: '', schema: scanSchema(entity), depth: 0, cost: {estimatedRows: limits.maxRows, estimatedBytes: estimateBytes(scanSchema(entity), limits.maxRows), nodes: 0, joinRows: 0, requiresComplete: false, operations: 0}};
  const scan = addNode(state, 'scan', state.schema, {entity: entity.id}, limits, [], limits.maxRows);
  if (!scan.ok) return scan;

  for (let index = 0; index < (input.semiJoins ?? []).length; index += 1) {
    const spec = input.semiJoins![index]!;
    const relationship = relationshipFor(catalog, spec.relationship);
    if (relationship === undefined) return failure('query.relationship', `Relationship ${relationKey(spec.relationship)} is not declared.`, ['semiJoins', index]);
    if (relationship.sourceEntity !== input.root || relationship.targetEntity !== spec.rightEntity) return failure('query.relationship-direction', 'A semijoin must follow the declared relationship direction from the root entity.', ['semiJoins', index]);
    if (relationship.joinPolicy !== 'validated') return unsupported('query.relationship-policy', 'The declared relationship is not approved for local semijoin evaluation.', ['Use a validated relationship or a host capability.'], ['semiJoins', index]);
    const keyTypes = validateRelationshipKeyTypes(catalog, relationship, ['semiJoins', index]);
    if (!keyTypes.ok) return keyTypes;
    const right = catalog.entities.find((candidate) => candidate.id === spec.rightEntity)!;
    if (spec.where !== undefined) {
      const checkedWhere = validatePredicate(spec.where, scanSchema(right), registry, ['semiJoins', index, 'where']);
      if (!checkedWhere.ok) return checkedWhere;
    }
    const rightId = state.nodes.length;
    const rightScan = addNode(state, 'scan', scanSchema(right), {entity: right.id}, limits, [], limits.maxRows);
    if (!rightScan.ok) return rightScan;
    const leftNode = state.nodes[state.nodes.length - 2]!;
    const rightNode = state.nodes[state.nodes.length - 1]!;
    const keys = relationship.keys.map((key) => ({left: fieldKey(relationship.sourceEntity, key.sourceField), right: fieldKey(relationship.targetEntity, key.targetField)}));
    const output = leftNode.output;
    const semijoin = addNode(state, 'semijoin', output, {spec, keys}, limits, [leftNode.id, rightNode.id], Math.min(state.cost.estimatedRows, limits.maxRows));
    if (!semijoin.ok) return semijoin;
    void rightId;
  }

  for (let index = 0; index < (input.joins ?? []).length; index += 1) {
    const spec = input.joins![index]!;
    const relationship = relationshipFor(catalog, spec.relationship);
    if (relationship === undefined) return failure('query.relationship', `Relationship ${relationKey(spec.relationship)} is not declared.`, ['joins', index]);
    if (relationship.sourceEntity !== input.root || relationship.targetEntity !== spec.rightEntity) return failure('query.relationship-direction', 'A join must follow the declared relationship direction from the root entity.', ['joins', index]);
    if (relationship.joinPolicy !== 'validated') return unsupported('query.relationship-policy', 'The declared relationship is not approved for local join evaluation.', ['Use a validated relationship or a host capability.'], ['joins', index]);
    const keyTypes = validateRelationshipKeyTypes(catalog, relationship, ['joins', index]);
    if (!keyTypes.ok) return keyTypes;
    if (relationship.cardinality === 'one-to-many' || relationship.cardinality === 'many-to-many') return unsupported('query.fanout', 'A regular join could multiply source facts under the declared cardinality.', ['Use a semijoin or pre-aggregate the many-side facts before joining.'], ['joins', index]);
    const right = catalog.entities.find((candidate) => candidate.id === spec.rightEntity)!;
    if (spec.where !== undefined) {
      const checkedWhere = validatePredicate(spec.where, scanSchema(right), registry, ['joins', index, 'where']);
      if (!checkedWhere.ok) return checkedWhere;
    }
    const rightScan = addNode(state, 'scan', scanSchema(right), {entity: right.id}, limits, [], limits.maxRows);
    if (!rightScan.ok) return rightScan;
    const leftNode = state.nodes[state.nodes.length - 2]!;
    const rightNode = state.nodes[state.nodes.length - 1]!;
    const keys = relationship.keys.map((key) => ({left: fieldKey(relationship.sourceEntity, key.sourceField), right: fieldKey(relationship.targetEntity, key.targetField)}));
    const output = joinSchema(leftNode.output, rightNode.output, relationship, spec.kind);
    const joined = addNode(state, 'join', output, {spec, keys}, limits, [leftNode.id, rightNode.id], Math.min(limits.maxJoinRows, limits.maxRows));
    if (!joined.ok) return joined;
  }

  if (input.filter !== undefined) {
    const checked = validatePredicate(input.filter, state.schema, registry);
    if (!checked.ok) return checked;
    const filtered = addNode(state, 'filter', state.schema, {predicate: input.filter}, limits, [state.current], state.cost.estimatedRows);
    if (!filtered.ok) return filtered;
  }

  if ((input.timeBuckets ?? []).length > 0) {
    const output = timeBucketSchema(state.schema, input.timeBuckets!, registry);
    if (!output.ok) return output;
    const bucket = addNode(state, 'time-bucket', output.value, {items: input.timeBuckets!}, limits, [state.current], state.cost.estimatedRows);
    if (!bucket.ok) return bucket;
  }
  if ((input.derives ?? []).length > 0) {
    const output = appendSchema(state.schema, input.derives!, registry);
    if (!output.ok) return output;
    const derive = addNode(state, 'derive', output.value, {items: input.derives!}, limits, [state.current], state.cost.estimatedRows);
    if (!derive.ok) return derive;
  }
  if ((input.windows ?? []).length > 0) {
    const output = windowSchema(state.schema, input.windows!, registry);
    if (!output.ok) return output;
    const window = addNode(state, 'window', output.value, {items: input.windows!}, limits, [state.current], state.cost.estimatedRows);
    if (!window.ok) return window;
  }

  const hasAggregate = (input.aggregates ?? []).length > 0;
  const hasGroup = (input.groupBy ?? []).length > 0;
  if (hasAggregate || hasGroup) {
    const preGroupSchema = state.schema;
    const keys = input.groupBy ?? [];
    const grouped = groupSchema(state.schema, keys, registry);
    if (!grouped.ok) return grouped;
    const group = addNode(state, 'group', grouped.value, {keys}, limits, [state.current], state.cost.estimatedRows);
    if (!group.ok) return group;
    if (hasAggregate) {
      const aggregate = aggregateSchema(preGroupSchema, grouped.value, input.aggregates!, registry);
      if (!aggregate.ok) return aggregate;
      const node = addNode(state, 'aggregate', aggregate.value, {items: input.aggregates!}, limits, [state.current], Math.min(state.cost.estimatedRows, limits.maxRows));
      if (!node.ok) return node;
    }
  }

  let sortedBeforeProjection = false;
  if ((input.orderBy ?? []).length > 0) {
    let canSortBeforeProjection = true;
    for (const item of input.orderBy!) {
      const checked = resolveExpression(item.expression, state.schema, registry);
      if (!checked.ok) { canSortBeforeProjection = false; break; }
    }
    if (canSortBeforeProjection) {
      const sorted = addNode(state, 'sort', state.schema, {items: input.orderBy!}, limits, [state.current], state.cost.estimatedRows);
      if (!sorted.ok) return sorted;
      sortedBeforeProjection = true;
    }
  }
  const projected = projectSchema(state.schema, input.select, registry);
  if (!projected.ok) return projected;
  const projection = addNode(state, 'project', projected.value, {items: input.select}, limits, [state.current], state.cost.estimatedRows);
  if (!projection.ok) return projection;

  if ((input.orderBy ?? []).length > 0 && !sortedBeforeProjection) {
    for (let index = 0; index < input.orderBy!.length; index += 1) {
      const checked = resolveExpression(input.orderBy![index]!.expression, state.schema, registry);
      if (!checked.ok) return checked;
    }
    const sorted = addNode(state, 'sort', state.schema, {items: input.orderBy!}, limits, [state.current], state.cost.estimatedRows);
    if (!sorted.ok) return sorted;
  }
  if (input.topK !== undefined) {
    if (!safePositive(input.topK) || input.topK > limits.maxRows) return failure('query.budget', 'Top-K must be a bounded positive safe integer.', ['topK']);
    const top = addNode(state, 'top-k', state.schema, {limit: input.topK}, limits, [state.current], Math.min(state.cost.estimatedRows, input.topK));
    if (!top.ok) return top;
  }
  const canonical = stable({version: '1', pins, root: state.current, nodes: state.nodes});
  const plan: LogicalPlan = {version: '1', pins, root: state.current, nodes: state.nodes, output: state.schema, cost: state.cost, canonical, planKey: `query-${canonical}`, explain: state.nodes.map((node) => ({nodeId: node.id, operation: node.op, inputIds: node.inputs, detail: nodeDetail(node.op), estimatedRows: node.cost.estimatedRows, estimatedBytes: node.cost.estimatedBytes}))};
  return {ok: true, value: deepFreeze(plan)};
}

/** Reuse planner semantics after a transported plan passes structural validation. */
export function validatePlanSemantics(plan: LogicalPlan, catalog: Catalog, registry: FunctionRegistry): QueryOutcome<void> {
  const nodes = new Map(plan.nodes.map((node) => [node.id, node]));
  for (const node of plan.nodes) {
    const input = nodes.get(node.inputs[0]!)?.output;
    let expected: QueryOutcome<QuerySchema>;
    if (node.op === 'scan') {
      const entity = catalog.entities.find((candidate) => candidate.id === node.entity);
      if (entity === undefined) return failure('query.plan', 'Plan scan entity is unavailable.');
      expected = {ok: true, value: scanSchema(entity)};
    } else {
      if (input === undefined) return failure('query.plan', 'Plan input schema is unavailable.');
      expected = {ok: true, value: input};
      if (node.op === 'filter') {
        const checked = validatePredicate(node.predicate, input, registry);
        if (!checked.ok) return checked;
      } else if (node.op === 'project') expected = projectSchema(input, node.items, registry);
      else if (node.op === 'derive') expected = appendSchema(input, node.items, registry);
      else if (node.op === 'time-bucket') expected = timeBucketSchema(input, node.items, registry);
      else if (node.op === 'window') expected = windowSchema(input, node.items, registry);
      else if (node.op === 'group') expected = groupSchema(input, node.keys, registry);
      else if (node.op === 'aggregate') {
        const group = nodes.get(node.inputs[0]!);
        const population = group === undefined ? undefined : nodes.get(group.inputs[0]!)?.output;
        if (group?.op !== 'group' || population === undefined) return failure('query.plan', 'Aggregate population schema is unavailable.');
        expected = aggregateSchema(population, input, node.items, registry);
      } else if (node.op === 'sort') {
        for (const item of node.items) {
          const checked = resolveExpression(item.expression, input, registry);
          if (!checked.ok) return checked;
        }
      } else if (node.op === 'join' || node.op === 'semijoin') {
        const right = nodes.get(node.inputs[1]!)?.output;
        const relation = relationshipFor(catalog, node.spec.relationship);
        if (right === undefined || relation === undefined) return failure('query.plan', 'Relationship schema is unavailable.');
        const keys = validateRelationshipKeyTypes(catalog, relation, []);
        if (!keys.ok) return keys;
        if (node.spec.where !== undefined) {
          const checked = validatePredicate(node.spec.where, right, registry);
          if (!checked.ok) return checked;
        }
        if (node.op === 'join') expected = {ok: true, value: joinSchema(input, right, relation, node.spec.kind)};
      }
    }
    if (!expected.ok) return expected;
    if (stable(expected.value) !== stable(node.output))
      return failure('query.plan-schema', 'Plan output metadata does not match its validated semantics.', ['nodes', node.id, 'output']);
  }
  return {ok: true, value: undefined};
}

export function createQueryPlanner(options: QueryPlannerOptions): QueryOutcome<import('./types.js').QueryPlanner> {
  const parsed = parseCatalog(options.catalog);
  if (!parsed.ok) return parsed;
  let catalog: Catalog;
  try {
    catalog = immutableSnapshot(parsed.value);
  } catch {
    return failure('query.catalog', 'Catalog snapshot failed safely at the untrusted boundary.');
  }
  const indexed = createCatalogIndex(catalog);
  if (!indexed.ok) return indexed;
  let registryOutcome: QueryOutcome<FunctionRegistry>;
  try {
    registryOutcome = createFunctionRegistry({digest: options.registry.digest, signatures: options.registry.signatures});
  } catch {
    return failure('query.registry', 'Function registry snapshot failed safely at the untrusted boundary.', ['registry']);
  }
  if (!registryOutcome.ok) return failure('query.registry', 'Function registry snapshot failed safely at the untrusted boundary.', ['registry']);
  const registry = registryOutcome.value;
  if (registry.digest !== catalog.functionRegistryDigest) return failure('query.stale-registry', 'The function registry does not match the catalog function registry pin.', ['registry']);
  const limits: QueryLimits = Object.freeze({
    maxNodes: options.limits?.maxNodes ?? DEFAULT_LIMITS.maxNodes,
    maxDepth: options.limits?.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    maxRows: options.limits?.maxRows ?? DEFAULT_LIMITS.maxRows,
    maxBytes: options.limits?.maxBytes ?? DEFAULT_LIMITS.maxBytes,
    maxJoinRows: options.limits?.maxJoinRows ?? DEFAULT_LIMITS.maxJoinRows,
    maxOperations: options.limits?.maxOperations ?? DEFAULT_LIMITS.maxOperations,
  });
  for (const [key, value] of Object.entries(limits)) if (!safePositive(value)) return failure('query.budget', `Query limit ${key} must be a bounded positive safe integer.`, ['limits', key]);
  let definitions: readonly MeaningDefinition[];
  try {
    definitions = immutableSnapshot(options.definitions ?? []);
  } catch {
    return failure('query.definitions', 'Meaning definition snapshot failed safely at the untrusted boundary.', ['definitions']);
  }
  const planner: import('./types.js').QueryPlanner = {
    catalog,
    registry,
    limits,
    plan(input) {
      const ingress = inspectWire(input);
      if (!ingress.ok) return ingress;
      if (ingress.value === null || typeof ingress.value !== 'object' || Array.isArray(ingress.value))
        return failure('query.input', 'Query input must be a bounded data object.');
      try {
        let lowered: QueryOutcome<RelationalQuery>;
        if ('root' in ingress.value) {
          const allowed = new Set(['root', 'select', 'filter', 'semiJoins', 'joins', 'derives', 'timeBuckets', 'windows', 'groupBy', 'aggregates', 'orderBy', 'topK', 'pins']);
          if (Object.keys(ingress.value).some((key) => !allowed.has(key)))
            return failure('query.input', 'Internal query contains an unknown field.');
          lowered = {ok: true, value: immutableSnapshot(ingress.value) as RelationalQuery};
        } else {
          const parsedQuery = parseContract('query', ingress.value);
          if (!parsedQuery.ok) return parsedQuery;
          lowered = lowerQuerySpec(parsedQuery.value, catalog, registry, definitions);
        }
        if (!lowered.ok) return lowered;
        return buildPlan(lowered.value, catalog, registry, limits);
      } catch {
        return failure('query.input', 'Query input is malformed or exceeds the supported structural bounds.');
      }
    },
    evaluate(plan, source, context) {
      return evaluateLogicalPlan(plan, source, catalog, registry, context, limits);
    },
  };
  return {ok: true, value: Object.freeze(planner)};
}

import {evaluateLogicalPlan} from './evaluator.js';

export {DEFAULT_LIMITS, fieldKey, lowerQuerySpec};
