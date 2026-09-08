import type {
  Catalog,
  Expression,
  Outcome,
  SemanticType,
  VersionRef,
} from '../contracts/types.js';
import type {FunctionRegistry, FunctionSignature} from '../expressions/types.js';
import {queryFunctionSignatures, standardFunctionSignatures} from '../expressions/registry.js';
import {validateSemanticType} from '../semantics/type-utils.js';
import {compareScalars, scalarIdentity, scalarInstantParts, validateScalar} from '../contracts/scalars.js';
import {inspectWire} from '../contracts/ingress.js';
import {validatePlanSemantics} from './planner.js';
import {
  type AggregateSpec,
  type LogicalPlan,
  type PlanNode,
  type PredicateSpec,
  type QueryExecutionContext,
  type QueryField,
  type QueryOutcome,
  type QueryResult,
  type QueryRow,
  type QuerySchema,
  type QuerySource,
  type QuerySourceRelation,
  type QueryValue,
  type SortSpec,
  type TimeBucketSpec,
  type WindowSpec,
} from './types.js';

type CatalogEntity = Catalog['entities'][number];
type CatalogRelationship = Catalog['relationships'][number];

interface EvalGroup {
  readonly keyRow: QueryRow;
  readonly rows: readonly QueryRow[];
  readonly schema: QuerySchema;
}

interface EvalRelation {
  readonly schema: QuerySchema;
  readonly rows: readonly QueryRow[];
  readonly complete: boolean;
  readonly groups?: readonly EvalGroup[];
}

interface EvalState {
  readonly source: QuerySource;
  readonly catalog: Catalog;
  readonly registry: FunctionRegistry;
  readonly context: QueryExecutionContext;
  readonly startedAt?: number;
  lastClock?: number;
  readonly unknown: Array<{readonly field: string; readonly reason: string}>;
  approximate: boolean;
  operations: number;
}

function failure<T>(code: string, message: string, path: readonly (string | number)[] = []): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path.length === 0 ? {} : {path: [...path]})}]};
}

function unsupported<T>(id: string, reason: string): Outcome<T> {
  return failure('query.unsupported', `Query capability ${id} is not supported: ${reason}`);
}

function stable(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (seen.has(value)) return '"<cycle>"';
  seen.add(value);
  if (Array.isArray(value)) {
    const output = `[${value.map((entry) => stable(entry, seen)).join(',')}]`;
    seen.delete(value);
    return output;
  }
  const record = value as Record<string, unknown>;
  const output = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key], seen)}`).join(',')}}`;
  seen.delete(value);
  return output;
}

const trustedLocalSignatures = new Map<string, FunctionSignature>(
  [...standardFunctionSignatures, ...queryFunctionSignatures].map((signature) => [relationKey(signature.ref), signature]),
);

function trustedLocalSignature(state: EvalState, candidate: FunctionSignature): Outcome<FunctionSignature> {
  const expected = trustedLocalSignatures.get(relationKey(candidate.ref));
  if (expected === undefined) return unsupported('function-runtime', `No trusted local implementation exists for ${candidate.ref.id}@${candidate.ref.revision}.`);
  // The registry is a semantic pin, not an implementation capability. A host
  // may add signatures, but the local evaluator only executes an immutable,
  // reviewed realization whose complete signature still matches the registry.
  if (stable(candidate) !== stable(expected) || (candidate.realization !== 'local' && candidate.realization !== 'both'))
    return unsupported('function-runtime', `The supplied registry signature for ${candidate.ref.id}@${candidate.ref.revision} is not the reviewed local realization.`);
  return {ok: true, value: expected};
}

function relationKey(ref: VersionRef): string { return JSON.stringify([ref.id, ref.revision]); }
function fieldKey(entity: string, field: string): string { return JSON.stringify([entity, field]); }

function entity(catalog: Catalog, id: string): CatalogEntity | undefined { return catalog.entities.find((candidate) => candidate.id === id); }
function relationship(catalog: Catalog, ref: VersionRef): CatalogRelationship | undefined {
  return catalog.relationships.find((candidate) => relationKey(candidate) === relationKey(ref));
}

function validDecimal(value: string): boolean { return /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) && value.length <= 512; }
function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

function normalizeSourceRelation(source: QuerySourceRelation, catalog: Catalog, expectedEntity?: string): Outcome<EvalRelation> {
  if (!isPlainDataRecord(source) || typeof source.entity !== 'string' || typeof source.complete !== 'boolean') return failure('query.source-shape', 'Source relation metadata is invalid.');
  if (expectedEntity !== undefined && source.entity !== expectedEntity) return failure('query.source-entity', `Source relation is labelled ${source.entity} but the plan requested ${expectedEntity}.`);
  const definition = entity(catalog, source.entity);
  if (definition === undefined) return failure('query.source-entity', `Source relation ${source.entity} is not declared.`);
  if (!Array.isArray(source.rows)) return failure('query.source-shape', `Source relation ${source.entity} rows must be an array.`);
  const schema: QuerySchema = {
    fields: definition.fields.map((field) => ({id: fieldKey(definition.id, field.id), label: field.label, type: field.type.grain === undefined ? {...field.type, grain: definition.rowGrain.map((grain) => fieldKey(definition.id, grain))} : field.type, role: field.role, source: {entity: definition.id, field: field.id}})),
    identity: definition.identity.map((field) => fieldKey(definition.id, field)),
    grain: definition.rowGrain.map((field) => fieldKey(definition.id, field)),
  };
  const rows: QueryRow[] = [];
  const identities = new Set<string>();
  for (let index = 0; index < source.rows.length; index += 1) {
    const input = source.rows[index];
    if (!isPlainDataRecord(input)) return failure('query.source-shape', `Source row ${index} for ${source.entity} must be a plain object with data properties.`);
    const output: Record<string, QueryValue> = {};
    for (const key of Object.keys(input)) {
      const field = definition.fields.find((candidate) => candidate.id === key);
      if (field === undefined) return failure('query.source-value', `Source row ${index} for ${source.entity} has an invalid value for ${key}.`);
      const checked = validateScalar(input[key], field.type);
      if (!checked.ok) return failure('query.source-value', `Source row ${index} for ${source.entity} has an invalid value for ${key}.`);
      output[fieldKey(source.entity, key)] = checked.value;
    }
    for (const field of definition.fields) {
      if (!Object.hasOwn(input, field.id) || input[field.id] === undefined || (input[field.id] === null && !field.type.nullable)) return failure('query.source-value', `Source row ${index} for ${source.entity} is missing non-nullable field ${field.id}.`);
    }
    const tuple: string[] = [];
    for (const fieldId of definition.identity) {
      const field = definition.fields.find((candidate) => candidate.id === fieldId)!;
      const identity = scalarIdentity(output[fieldKey(source.entity, fieldId)], field.type);
      if (!identity.ok) return failure('query.source-value', `Source row ${index} for ${source.entity} has an invalid identity value.`);
      tuple.push(identity.value);
    }
    const identity = stable(tuple);
    if (identities.has(identity)) return failure('query.source-identity', `Source relation ${source.entity} contains duplicate identity tuples.`);
    identities.add(identity);
    rows.push(Object.freeze(output));
  }
  return {ok: true, value: {schema, rows: Object.freeze(rows), complete: source.complete}};
}

type PlanRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlanRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPlainDataRecord(value: unknown): value is PlanRecord {
  try {
    if (!isRecord(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Reflect.ownKeys(value).every((key) => {
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && 'value' in descriptor;
    });
  } catch {
    return false;
  }
}

function planId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safePositiveCount(value: unknown): value is number {
  return safeCount(value) && value > 0;
}

interface ValidatedExecutionContext {
  readonly startedAt?: number;
}

function validateExecutionContext(context: unknown): Outcome<ValidatedExecutionContext> {
  if (!isPlainDataRecord(context)) return failure('query.context', 'Query execution context must be a plain data object.');
  for (const key of ['maxRows', 'maxBytes', 'maxOperations'] as const) {
    const value = context[key];
    if (value !== undefined && !safePositiveCount(value)) return failure('query.budget', `Execution context ${key} must be a bounded positive safe integer.`, [key]);
  }
  const maxMilliseconds = context.maxMilliseconds;
  if (maxMilliseconds !== undefined && (typeof maxMilliseconds !== 'number' || !Number.isFinite(maxMilliseconds) || maxMilliseconds <= 0 || maxMilliseconds > Number.MAX_SAFE_INTEGER))
    return failure('query.budget', 'Execution context maxMilliseconds must be a bounded positive finite number.', ['maxMilliseconds']);
  if (context.cancellation !== undefined && (!isPlainDataRecord(context.cancellation) || typeof context.cancellation.aborted !== 'boolean'))
    return failure('query.context', 'Execution context cancellation must expose a boolean aborted flag.', ['cancellation']);
  if (context.clock !== undefined && typeof context.clock !== 'function') return failure('query.clock', 'Execution context clock must be a function.', ['clock']);
  if (maxMilliseconds !== undefined && context.clock === undefined)
    return failure('query.clock', 'A time budget requires an injected monotonic clock.', ['clock']);
  if (context.clock === undefined) return {ok: true, value: {}};
  let startedAt: number;
  try {
    startedAt = context.clock();
  } catch {
    return failure('query.clock', 'Execution context clock failed safely at the untrusted boundary.', ['clock']);
  }
  if (!Number.isFinite(startedAt)) return failure('query.clock', 'Execution context clock must return a finite number.', ['clock']);
  return {ok: true, value: {startedAt}};
}

function catalogSchema(catalog: Catalog, entityId: string): QuerySchema | undefined {
  const definition = entity(catalog, entityId);
  if (definition === undefined) return undefined;
  return {
    fields: definition.fields.map((field) => ({
      id: fieldKey(entityId, field.id), label: field.label,
      type: field.type.grain === undefined ? {...field.type, grain: definition.rowGrain.map((grain) => fieldKey(entityId, grain))} : field.type,
      role: field.role, source: {entity: entityId, field: field.id},
    })),
    identity: definition.identity.map((field) => fieldKey(entityId, field)),
    grain: definition.rowGrain.map((field) => fieldKey(entityId, field)),
  };
}

function validQuerySchema(value: unknown, catalog: Catalog): value is QuerySchema {
  if (!isRecord(value) || !Array.isArray(value.fields) || !Array.isArray(value.identity) || !Array.isArray(value.grain)) return false;
  const ids = new Set<string>();
  for (const candidate of value.fields) {
    if (!isRecord(candidate) || !planId(candidate.id) || ids.has(candidate.id) || typeof candidate.label !== 'string' || !isRecord(candidate.type) ||
      !['identity', 'attribute', 'dimension', 'measure', 'time'].includes(String(candidate.role)) || !validateSemanticType(candidate.type as SemanticType).ok) return false;
    ids.add(candidate.id);
    if (candidate.source !== undefined) {
      const source = candidate.source;
      if (!isRecord(source) || !planId(source.entity) || !planId(source.field) || entity(catalog, source.entity) === undefined ||
        entity(catalog, source.entity)!.fields.some((field) => field.id === source.field) === false) return false;
    }
  }
  return value.identity.every((id): id is string => typeof id === 'string' && ids.has(id)) && value.grain.every((id): id is string => typeof id === 'string' && ids.has(id));
}

function planFields(schema: QuerySchema): Set<string> { return new Set(schema.fields.map((field) => field.id)); }

function compatibleSemanticTypes(left: SemanticType, right: SemanticType): boolean {
  return left.value === right.value && left.unit?.dimension === right.unit?.dimension && left.unit?.currency === right.unit?.currency && left.unit?.symbol === right.unit?.symbol &&
    left.temporal?.calendar === right.temporal?.calendar && left.temporal?.timezone === right.temporal?.timezone && left.temporal?.grain === right.temporal?.grain;
}

function expressionFields(schema: QuerySchema, expression: Expression, registry: FunctionRegistry, depth = 0): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Plan expression depth exceeds the bounded evaluator limit.');
  if (expression.kind === 'field') {
    const candidates = schema.fields.filter((field) => expression.entity === undefined
      ? field.id === expression.ref || field.source?.field === expression.ref
      : field.source?.entity === expression.entity && field.source.field === expression.ref);
    return candidates.length === 1 ? {ok: true, value: undefined} : failure('query.plan', 'Plan contains an unknown or ambiguous field expression.');
  }
  if (expression.kind === 'literal') return validateSemanticType(expression.type).ok ? {ok: true, value: undefined} : failure('query.plan', 'Plan contains an invalid literal type.');
  if (expression.kind === 'definition') return failure('query.plan', 'Definition expressions must be expanded before execution.');
  if (!planId(expression.function.id) || !planId(expression.function.revision) || registry.resolve(expression.function) === undefined)
    return failure('query.plan', `Plan references an unregistered function ${relationKey(expression.function)}.`);
  for (const argument of expression.arguments) {
    const checked = expressionFields(schema, argument, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return {ok: true, value: undefined};
}

function aggregateExpressionShape(expression: Expression, registry: FunctionRegistry, depth = 0): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Aggregate expression depth exceeds the bounded evaluator limit.');
  if (expression.kind === 'field') return planId(expression.ref) && (expression.entity === undefined || planId(expression.entity)) ? {ok: true, value: undefined} : failure('query.plan', 'Aggregate field reference is invalid.');
  if (expression.kind === 'literal') return validateSemanticType(expression.type).ok ? {ok: true, value: undefined} : failure('query.plan', 'Aggregate literal type is invalid.');
  if (expression.kind === 'definition') return failure('query.plan', 'Definition expressions must be expanded before execution.');
  if (!planId(expression.function.id) || !planId(expression.function.revision) || registry.resolve(expression.function) === undefined) return failure('query.plan', 'Aggregate function reference is invalid.');
  for (const argument of expression.arguments) {
    const checked = aggregateExpressionShape(argument, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return {ok: true, value: undefined};
}

function predicateFields(schema: QuerySchema, predicate: PredicateSpec, registry: FunctionRegistry, depth = 0): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Plan predicate depth exceeds the bounded evaluator limit.');
  if (predicate.op === 'and' || predicate.op === 'or') {
    for (const child of predicate.predicates) {
      const checked = predicateFields(schema, child, registry, depth + 1);
      if (!checked.ok) return checked;
    }
    return {ok: true, value: undefined};
  }
  if (predicate.op === 'not') return predicateFields(schema, predicate.predicate, registry, depth + 1);
  const expression = predicate.op === 'compare' ? predicate.left : predicate.op === 'is-null' || predicate.op === 'in' ? predicate.expression : undefined;
  if (expression === undefined) return failure('query.plan', 'Plan predicate operator is invalid.');
  const left = expressionFields(schema, expression, registry, depth + 1);
  if (!left.ok) return left;
  if (predicate.op === 'compare') return expressionFields(schema, predicate.right, registry, depth + 1);
  if (predicate.op === 'in') {
    for (const value of predicate.values) {
      const checked = expressionFields(schema, value, registry, depth + 1);
      if (!checked.ok) return checked;
    }
  }
  return {ok: true, value: undefined};
}

function validNodeCost(value: unknown): value is PlanRecord {
  return isRecord(value) && safeCount(value.estimatedRows) && safeCount(value.estimatedBytes) && safeCount(value.nodes) &&
    safeCount(value.joinRows) && typeof value.requiresComplete === 'boolean' && safeCount(value.operations);
}

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index]);
}

function validateNode(node: PlanRecord, inputRelations: readonly PlanNode[], catalog: Catalog, registry: FunctionRegistry): Outcome<void> {
  if (!planId(node.id) || typeof node.op !== 'string' || !['scan', 'filter', 'project', 'derive', 'time-bucket', 'window', 'join', 'semijoin', 'group', 'aggregate', 'sort', 'top-k'].includes(node.op) ||
    !Array.isArray(node.inputs) || !node.inputs.every(planId) || !validQuerySchema(node.output, catalog) || !validNodeCost(node.cost))
    return failure('query.plan', 'Plan node shape is invalid.');
  const input = inputRelations[0];
  const second = inputRelations[1];
  if (node.op === 'scan') {
    if (node.inputs.length !== 0 || typeof node.entity !== 'string') return failure('query.plan', 'Scan node shape is invalid.');
    const expected = catalogSchema(catalog, node.entity);
    return expected !== undefined && stable(node.output) === stable(expected) ? {ok: true, value: undefined} : failure('query.plan', 'Scan node schema does not match the catalog entity.');
  }
  if (input === undefined) return failure('query.plan', 'Non-scan node is missing its input.');
  if (node.op === 'filter') {
    if (node.inputs.length !== 1 || !isRecord(node.predicate)) return failure('query.plan', 'Filter node shape is invalid.');
    return predicateFields(input.output, node.predicate as PredicateSpec, registry);
  }
  if (node.op === 'project' || node.op === 'derive' || node.op === 'time-bucket' || node.op === 'window') {
    if (node.inputs.length !== 1 || !Array.isArray(node.items)) return failure('query.plan', `${node.op} node shape is invalid.`);
    const priorIds = input.output.fields.map((field) => field.id);
    const itemIds: string[] = [];
    for (const item of node.items as readonly unknown[]) {
      if (!isRecord(item) || !planId(item.id) || itemIds.includes(item.id) || (node.op !== 'window' && !isRecord(item.expression))) return failure('query.plan', `${node.op} item is invalid.`);
      itemIds.push(item.id);
      if (node.op !== 'window') {
        const checked = expressionFields(input.output, item.expression as Expression, registry);
        if (!checked.ok) return checked;
      }
      if (node.op === 'window') {
        if (!isRecord(item.function) || !planId(item.function.id) || !planId(item.function.revision) || !Array.isArray(item.partitionBy) || !Array.isArray(item.orderBy) ||
          !isRecord(item.frame) || !safeCount(item.frame.preceding) || !safeCount(item.frame.following) || registry.resolve(item.function as VersionRef) === undefined)
          return failure('query.plan', 'Window item is invalid.');
        const signature = registry.resolve(item.function as VersionRef)!;
        if (!signature.contexts.includes('window')) return failure('query.plan', 'Window item function is not registered for window evaluation.');
        for (const expression of item.partitionBy as readonly unknown[]) {
          const partition = expressionFields(input.output, expression as Expression, registry);
          if (!partition.ok) return partition;
        }
        for (const sort of item.orderBy as readonly unknown[]) {
          if (!isRecord(sort) || !isRecord(sort.expression)) return failure('query.plan', 'Window sort item is invalid.');
          const order = expressionFields(input.output, sort.expression as Expression, registry);
          if (!order.ok) return order;
        }
        for (const argument of Array.isArray(item.arguments) ? item.arguments : []) {
          const argumentCheck = expressionFields(input.output, argument as Expression, registry);
          if (!argumentCheck.ok) return argumentCheck;
        }
      }
    }
    const expectedIds = node.op === 'project' ? itemIds : [...priorIds, ...itemIds];
    if (!sameIds(node.output.fields.map((field) => field.id), expectedIds)) return failure('query.plan', `${node.op} output schema does not match its items.`);
    return {ok: true, value: undefined};
  }
  if (node.op === 'group') {
    if (node.inputs.length !== 1 || !Array.isArray(node.keys)) return failure('query.plan', 'Group node shape is invalid.');
    for (const key of node.keys) {
      if (!isRecord(key) || !planId(key.id) || !isRecord(key.expression)) return failure('query.plan', 'Group key is invalid.');
      const checked = expressionFields(input.output, key.expression as Expression, registry);
      if (!checked.ok) return checked;
    }
    if (!sameIds(node.output.fields.map((field) => field.id), (node.keys as readonly PlanRecord[]).map((key) => key.id as string))) return failure('query.plan', 'Group output schema does not match its keys.');
    return {ok: true, value: undefined};
  }
  if (node.op === 'aggregate') {
    if (node.inputs.length !== 1 || !Array.isArray(node.items)) return failure('query.plan', 'Aggregate node shape is invalid.');
    for (const item of node.items) {
      if (!isRecord(item) || !planId(item.id) || !isRecord(item.function) || !Array.isArray(item.arguments) || registry.resolve(item.function as VersionRef) === undefined) return failure('query.plan', 'Aggregate item is invalid.');
      for (const argument of item.arguments) {
        const checked = aggregateExpressionShape(argument as Expression, registry);
        if (!checked.ok) return checked;
      }
    }
    const expectedIds = [...input.output.fields.map((field) => field.id), ...(node.items as readonly PlanRecord[]).map((item) => item.id as string)];
    if (!sameIds(node.output.fields.map((field) => field.id), expectedIds)) return failure('query.plan', 'Aggregate output schema does not match its items.');
    return {ok: true, value: undefined};
  }
  if (node.op === 'sort') {
    if (node.inputs.length !== 1 || !Array.isArray(node.items) || stable(node.output) !== stable(input.output)) return failure('query.plan', 'Sort node shape is invalid.');
    for (const item of node.items) {
      if (!isRecord(item) || !isRecord(item.expression)) return failure('query.plan', 'Sort item is invalid.');
      const checked = expressionFields(input.output, item.expression as Expression, registry);
      if (!checked.ok) return checked;
    }
    return {ok: true, value: undefined};
  }
  if (node.op === 'top-k') return node.inputs.length === 1 && safePositiveCount(node.limit) && stable(node.output) === stable(input.output) ? {ok: true, value: undefined} : failure('query.plan', 'Top-K node shape is invalid.');
  if (node.op === 'join' || node.op === 'semijoin') {
    if (node.inputs.length !== 2 || second === undefined || !isRecord(node.spec) || !isRecord(node.spec.relationship) || !Array.isArray(node.keys)) return failure('query.plan', `${node.op} node shape is invalid.`);
    const relation = relationship(catalog, node.spec.relationship as VersionRef);
    if (relation === undefined || relation.joinPolicy !== 'validated' || relation.sourceEntity !== input.output.fields.find((field) => field.source !== undefined)?.source?.entity || relation.targetEntity !== node.spec.rightEntity) return failure('query.plan', 'Join relationship is not declared or has the wrong direction.');
    if ((relation.cardinality === 'one-to-many' || relation.cardinality === 'many-to-many') && node.op === 'join') return failure('query.plan', 'A regular join cannot use a fanout relationship.');
    if (node.op === 'join' && !['inner', 'left'].includes(String(node.spec.kind))) return failure('query.plan', 'Join kind is invalid.');
    for (const key of node.keys) {
      if (!isRecord(key) || !planId(key.left) || !planId(key.right) || !planFields(input.output).has(key.left) || !planFields(second.output).has(key.right)) return failure('query.plan', 'Join key is invalid.');
      const leftField = input.output.fields.find((field) => field.id === key.left);
      const rightField = second.output.fields.find((field) => field.id === key.right);
      if (leftField === undefined || rightField === undefined || !compatibleSemanticTypes(leftField.type, rightField.type)) return failure('query.relationship-key-type', 'Join key fields must have compatible semantic types, units and temporal policies.');
    }
    if (node.spec.where !== undefined) {
      const checked = predicateFields(second.output, node.spec.where as PredicateSpec, registry);
      if (!checked.ok) return checked;
    }
    return {ok: true, value: undefined};
  }
  if (node.op === 'time-bucket') return {ok: true, value: undefined};
  return failure('query.plan', 'Unknown plan node operation.');
}

function validateLogicalPlan(input: unknown, catalog: Catalog, registry: FunctionRegistry): Outcome<LogicalPlan> {
  const ingress = inspectWire(input);
  if (!ingress.ok) return ingress;
  input = ingress.value;
  if (!isRecord(input) || input.version !== '1' || !isRecord(input.pins) || !planId(input.pins.catalogRevision) || !planId(input.pins.functionRegistryDigest) ||
    !planId(input.root) || !Array.isArray(input.nodes) || input.nodes.length === 0 || !validQuerySchema(input.output, catalog) || !validNodeCost(input.cost) ||
    typeof input.canonical !== 'string' || typeof input.planKey !== 'string' || !Array.isArray(input.explain)) return failure('query.plan', 'Logical plan shape is invalid.');
  if (input.pins.catalogRevision !== catalog.revision || input.pins.functionRegistryDigest !== registry.digest) return failure('query.stale-plan', 'The logical plan is stale for the current catalog or function registry.');
  for (const key of ['sourceRevision', 'scopeDigest', 'policyRevision'] as const) {
    if (input.pins[key] !== undefined && !planId(input.pins[key])) return failure('query.plan', `Plan pin ${key} is invalid.`);
  }
  const nodes = input.nodes as PlanNode[];
  const map = new Map<string, PlanNode>();
  for (const candidate of input.nodes as readonly unknown[]) {
    if (!isRecord(candidate) || !planId(candidate.id) || map.has(candidate.id)) return failure('query.plan', 'Logical plan node identifiers must be unique and bounded.');
    map.set(candidate.id, candidate as unknown as PlanNode);
  }
  if (!map.has(input.root)) return failure('query.plan', 'Logical plan root is missing.');
  for (const node of nodes) {
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    for (const inputId of inputs) if (!map.has(inputId)) return failure('query.plan', `Logical plan input ${inputId} is missing.`);
    const inputRelations = inputs.map((inputId) => map.get(inputId)!) as PlanNode[];
    const checked = validateNode(node as unknown as PlanRecord, inputRelations, catalog, registry);
    if (!checked.ok) return checked;
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): Outcome<void> => {
    if (visiting.has(id)) return failure('query.plan', 'Logical plan contains a cycle.');
    if (visited.has(id)) return {ok: true, value: undefined};
    visiting.add(id);
    const node = map.get(id)!;
    for (const inputId of node.inputs) { const checked = visit(inputId); if (!checked.ok) return checked; }
    visiting.delete(id); visited.add(id); return {ok: true, value: undefined};
  };
  const acyclic = visit(input.root); if (!acyclic.ok) return acyclic;
  if (visited.size !== nodes.length) return failure('query.plan', 'Logical plan contains unreachable nodes.');
  const rootNode = map.get(input.root)!;
  if (input.cost.nodes !== nodes.length || stable(input.output) !== stable(rootNode.output) || stable(input.cost) !== stable(rootNode.cost)) return failure('query.plan', 'Logical plan cost or output metadata is inconsistent.');
  for (let index = 0; index < nodes.length; index += 1) {
    const cost = nodes[index]!.cost;
    if (cost.nodes !== index + 1) return failure('query.plan', 'Logical plan node cost sequence is invalid.');
    if (index > 0 && cost.operations < nodes[index - 1]!.cost.operations) return failure('query.plan', 'Logical plan operation costs are not monotonic.');
  }
  const canonical = stable({version: '1', pins: input.pins, root: input.root, nodes: input.nodes});
  if (input.canonical !== canonical || input.planKey !== `query-${canonical}`) return failure('query.plan', 'Logical plan canonical identity does not match its contents.');
  if (input.explain.length !== nodes.length || !sameIds(input.explain.map((entry) => isRecord(entry) ? String(entry.nodeId) : ''), nodes.map((node) => node.id))) return failure('query.plan', 'Logical plan explanation is not aligned with its nodes.');
  for (let index = 0; index < input.explain.length; index += 1) {
    const explanation = input.explain[index];
    const node = nodes[index]!;
    if (!isRecord(explanation) || explanation.operation !== node.op || !Array.isArray(explanation.inputIds) || !sameIds(explanation.inputIds.filter((id): id is string => typeof id === 'string'), node.inputs) ||
      explanation.estimatedRows !== node.cost.estimatedRows || explanation.estimatedBytes !== node.cost.estimatedBytes) return failure('query.plan', 'Logical plan explanation metadata is inconsistent.');
  }
  const plan = input as unknown as LogicalPlan;
  const semantics = validatePlanSemantics(plan, catalog, registry);
  return semantics.ok ? {ok: true, value: plan} : semantics;
}

function sourceField(schema: QuerySchema, expression: Extract<Expression, {kind: 'field'}>): QueryField | undefined {
  const fields = schema.fields.filter((field) => expression.entity === undefined
    ? field.id === expression.ref || field.source?.field === expression.ref
    : field.source?.entity === expression.entity && field.source.field === expression.ref);
  return fields.length === 1 ? fields[0] : undefined;
}

function decimalParts(value: {readonly decimal: string}): {coefficient: bigint; scale: number} {
  const negative = value.decimal.startsWith('-');
  const unsigned = negative ? value.decimal.slice(1) : value.decimal;
  const [whole, fraction = ''] = unsigned.split('.');
  return {coefficient: BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n), scale: fraction.length};
}

const MAX_DECIMAL_DIGITS = 512;

function decimalText(coefficient: bigint, scale: number): {readonly decimal: string} | undefined {
  if (!Number.isSafeInteger(scale) || scale < 0 || scale > MAX_DECIMAL_DIGITS) return undefined;
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (digits.length > MAX_DECIMAL_DIGITS) return undefined;
  const whole = scale === 0 ? digits : digits.slice(0, -scale) || '0';
  const fraction = scale === 0 ? '' : digits.slice(-scale).replace(/0+$/u, '');
  const text = `${negative ? '-' : ''}${whole}${fraction.length === 0 ? '' : `.${fraction}`}`;
  return validDecimal(text) ? {decimal: text} : undefined;
}

function decimalAdd(left: {readonly decimal: string}, right: {readonly decimal: string}, sign = 1n): {readonly decimal: string} | undefined {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const coefficient = a.coefficient * 10n ** BigInt(scale - a.scale) + sign * b.coefficient * 10n ** BigInt(scale - b.scale);
  return decimalText(coefficient, scale);
}

function decimalMultiply(left: {readonly decimal: string}, right: {readonly decimal: string}): {readonly decimal: string} | undefined {
  const a = decimalParts(left);
  const b = decimalParts(right);
  return decimalText(a.coefficient * b.coefficient, a.scale + b.scale);
}

function isDecimal(value: QueryValue | undefined): value is {readonly decimal: string} {
  return value !== null && value !== undefined && typeof value === 'object';
}

function compareValue(left: QueryValue | undefined, right: QueryValue | undefined, type: SemanticType['value']): number | undefined {
  if (left === undefined || right === undefined || left === null || right === null) return undefined;
  const compared = compareScalars(left, right, {value: type, nullable: true});
  return compared.ok && compared.value !== null ? compared.value : undefined;
}

function expressionValueType(expression: Expression, schema: QuerySchema, registry: FunctionRegistry): SemanticType['value'] | undefined {
  if (expression.kind === 'field') return sourceField(schema, expression)?.type.value;
  if (expression.kind === 'literal') return expression.type.value;
  if (expression.kind === 'call') {
    const signature = registry.resolve(expression.function);
    const output = signature?.output;
    if (output === undefined) return undefined;
    if ('value' in output) return output.value;
    if (output.kind === 'same-as' || output.kind === 'nullable-same-as') {
      const argument = expression.arguments[output.argument];
      return argument === undefined ? undefined : expressionValueType(argument, schema, registry);
    }
    const argumentTypes = expression.arguments.map((argument) => expressionValueType(argument, schema, registry));
    return output.forceFloat || signature?.operation === 'divide' || signature?.operation === 'ratio-of-sums' || signature?.operation === 'mean-of-rates' || argumentTypes.includes('float') ? 'float'
      : argumentTypes.includes('decimal') ? 'decimal' : 'integer';
  }
  return undefined;
}

/** Canonical typed equality key for grouping, joins and distinct values. */
function scalarKey(value: QueryValue | undefined, type?: SemanticType['value']): string {
  if (value === undefined || value === null) return 'null';
  const inferred = type ?? (isDecimal(value) ? 'decimal' : typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'boolean' : 'text');
  const identity = scalarIdentity(value, {value: inferred, nullable: true});
  return identity.ok ? identity.value : stable(value);
}

function rowValue(state: EvalState, expression: Extract<Expression, {kind: 'field'}>, row: QueryRow, schema: QuerySchema): QueryOutcome<QueryValue | undefined> {
  const field = sourceField(schema, expression);
  if (field === undefined) return failure('query.field', 'Field reference is unknown or ambiguous during evaluation.');
  return {ok: true, value: row[field.id]};
}

function evaluateExpression(state: EvalState, expression: Expression, row: QueryRow, schema: QuerySchema): QueryOutcome<QueryValue | undefined> {
  if (expression.kind === 'literal') return {ok: true, value: expression.value};
  if (expression.kind === 'field') return rowValue(state, expression, row, schema);
  if (expression.kind === 'definition') return unsupported('definition-expression', 'Definition expressions must be expanded by the authorized host before local evaluation.');
  const supplied = state.registry.resolve(expression.function);
  if (supplied === undefined) return failure('query.function', `Function ${relationKey(expression.function)} is not registered.`);
  const trusted = trustedLocalSignature(state, supplied);
  if (!trusted.ok) return trusted;
  const signature = trusted.value;
  const arguments_: QueryValue[] = [];
  for (const argument of expression.arguments) {
    const value = evaluateExpression(state, argument, row, schema);
    if (!value.ok) return value;
    arguments_.push(value.value === undefined ? null : value.value);
  }
  if (signature.operation === 'aggregate' || signature.operation === 'ratio-of-sums' || signature.operation === 'mean-of-rates') return unsupported('aggregate-context', 'Aggregate functions require a group evaluation context.');
  return evaluateCall(state, signature, arguments_);
}

function evaluateCall(state: EvalState, signature: FunctionSignature, args: readonly QueryValue[]): QueryOutcome<QueryValue | undefined> {
  const id = signature.ref.id;
  if (id === 'core.is-null') return {ok: true, value: args[0] === null ? true : false};
  if (id === 'core.coalesce') return {ok: true, value: args.find((value) => value !== null) ?? null};
  if (id === 'core.add' || id === 'core.subtract' || id === 'core.multiply') {
    const left = args[0]; const right = args[1];
    if (left === null || right === null || left === undefined || right === undefined) return {ok: true, value: null};
    if (isDecimal(left) && isDecimal(right)) {
      const result = id === 'core.multiply' ? decimalMultiply(left, right) : decimalAdd(left, right, id === 'core.subtract' ? -1n : 1n);
      return result === undefined ? failure('query.numeric-overflow', 'Decimal operation exceeded the bounded exact representation.') : {ok: true, value: result};
    }
    if (typeof left === 'number' && typeof right === 'number') {
      const result = id === 'core.add' ? left + right : id === 'core.subtract' ? left - right : left * right;
      if (!Number.isFinite(result)) return failure('query.numeric-overflow', 'Numeric operation produced a non-finite result.');
      if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || !Number.isSafeInteger(result)) state.approximate = true;
      return {ok: true, value: result};
    }
    if (isDecimal(left) && typeof right === 'number' && Number.isSafeInteger(right) && id === 'core.multiply') {
      const result = decimalMultiply(left, {decimal: String(right)});
      return result === undefined ? failure('query.numeric-overflow', 'Decimal multiplication exceeded the bounded exact representation.') : {ok: true, value: result};
    }
    if (typeof left === 'number' && isDecimal(right) && Number.isSafeInteger(left) && id === 'core.multiply') {
      const result = decimalMultiply({decimal: String(left)}, right);
      return result === undefined ? failure('query.numeric-overflow', 'Decimal multiplication exceeded the bounded exact representation.') : {ok: true, value: result};
    }
    return failure('query.numeric-type', 'Numeric operation received incompatible runtime values.');
  }
  if (id.startsWith('core.divide')) {
    const left = args[0]; const right = args[1];
    if (left === null || right === null || left === undefined || right === undefined) return {ok: true, value: null};
    const denominator = isDecimal(right) ? decimalParts(right).coefficient === 0n : right === 0;
    if (denominator) {
      if (signature.zeroDenominator === 'error') return failure('query.zero-denominator', 'Division denominator is zero.');
      if (signature.zeroDenominator === 'unknown') { state.unknown.push({field: 'division', reason: 'zero denominator'}); return {ok: true, value: null}; }
      return {ok: true, value: null};
    }
    const numerator = isDecimal(left) ? Number(left.decimal) : left;
    const divisor = isDecimal(right) ? Number(right.decimal) : right;
    if (typeof numerator !== 'number' || typeof divisor !== 'number' || !Number.isFinite(numerator) || !Number.isFinite(divisor)) return failure('query.numeric-type', 'Division received incompatible runtime values.');
    const result = numerator / divisor;
    if (!Number.isFinite(result)) return failure('query.numeric-overflow', 'Division produced a non-finite result.');
    state.approximate = true;
    return {ok: true, value: result};
  }
  return unsupported('function-runtime', `No trusted local implementation exists for ${id}@${signature.ref.revision}.`);
}

type Truth = 'true' | 'false' | 'unknown';

function evaluatePredicate(state: EvalState, predicate: PredicateSpec, row: QueryRow, schema: QuerySchema): QueryOutcome<Truth> {
  if (predicate.op === 'and' || predicate.op === 'or') {
    const values: Truth[] = [];
    for (const child of predicate.predicates) {
      const value = evaluatePredicate(state, child, row, schema);
      if (!value.ok) return value;
      values.push(value.value);
    }
    if (predicate.op === 'and') return {ok: true, value: values.includes('false') ? 'false' : values.includes('unknown') ? 'unknown' : 'true'};
    return {ok: true, value: values.includes('true') ? 'true' : values.includes('unknown') ? 'unknown' : 'false'};
  }
  if (predicate.op === 'not') {
    const value = evaluatePredicate(state, predicate.predicate, row, schema);
    if (!value.ok) return value;
    return {ok: true, value: value.value === 'true' ? 'false' : value.value === 'false' ? 'true' : 'unknown'};
  }
  const expression = predicate.op === 'compare' ? predicate.left : predicate.op === 'is-null' || predicate.op === 'in' ? predicate.expression : undefined;
  if (expression === undefined) return failure('query.predicate', 'Predicate operator is invalid.');
  const value = evaluateExpression(state, expression, row, schema);
  if (!value.ok) return value;
  if (predicate.op === 'is-null') return {ok: true, value: value.value === null ? (predicate.negate ? 'false' : 'true') : (predicate.negate ? 'true' : 'false')};
  if (value.value === undefined || value.value === null) return {ok: true, value: 'unknown'};
  if (predicate.op === 'compare') {
    const right = evaluateExpression(state, predicate.right, row, schema);
    if (!right.ok) return right;
    const field = predicate.left.kind === 'field' ? sourceField(schema, predicate.left) : undefined;
    const compared = compareValue(value.value, right.value, field?.type.value ?? (typeof value.value === 'number' ? 'float' : typeof value.value === 'string' ? 'text' : typeof value.value === 'boolean' ? 'boolean' : 'decimal'));
    if (compared === undefined) return {ok: true, value: 'unknown'};
    const matched = predicate.comparison === 'eq' ? compared === 0 : predicate.comparison === 'ne' ? compared !== 0 : predicate.comparison === 'lt' ? compared < 0 : predicate.comparison === 'lte' ? compared <= 0 : predicate.comparison === 'gt' ? compared > 0 : compared >= 0;
    return {ok: true, value: matched ? 'true' : 'false'};
  }
  if (predicate.op !== 'in') return failure('query.predicate', 'Predicate operator is invalid.');
  const type = expressionValueType(predicate.expression, schema, state.registry) ?? (typeof value.value === 'number' ? 'float' : typeof value.value === 'boolean' ? 'boolean' : isDecimal(value.value) ? 'decimal' : 'text');
  let unknown = false;
  for (const candidate of predicate.values) {
    const right = evaluateExpression(state, candidate, row, schema);
    if (!right.ok) return right;
    if (right.value === null || right.value === undefined) { unknown = true; continue; }
    const compared = compareValue(value.value, right.value, type);
    if (compared === 0) return {ok: true, value: 'true'};
    if (compared === undefined) unknown = true;
  }
  return {ok: true, value: unknown ? 'unknown' : 'false'};
}

function tick(state: EvalState, amount = 1): Outcome<void> {
  state.operations += amount;
  const limit = state.context.maxOperations ?? Number.MAX_SAFE_INTEGER;
  if (state.operations > limit) return failure('query.budget', 'Query evaluation exceeded its operation budget.');
  if (state.context.cancellation?.aborted) return failure('query.cancelled', 'Query evaluation was cancelled.');
  if (state.context.clock !== undefined && state.lastClock !== undefined) {
    let now: number;
    try {
      now = state.context.clock();
    } catch {
      return failure('query.clock', 'Execution context clock failed during evaluation.');
    }
    if (!Number.isFinite(now) || now < state.lastClock) return failure('query.clock', 'Execution context clock must be finite and monotonic.');
    state.lastClock = now;
    if (state.startedAt !== undefined && state.context.maxMilliseconds !== undefined && now - state.startedAt > state.context.maxMilliseconds)
      return failure('query.budget', 'Query evaluation exceeded its time budget.');
  }
  return {ok: true, value: undefined};
}

function outputBytes(rows: readonly QueryRow[]): number {
  const encoded = JSON.stringify(rows);
  return encoded === undefined ? Number.MAX_SAFE_INTEGER : new TextEncoder().encode(encoded).byteLength;
}

function compareRows(left: QueryRow, right: QueryRow, schema: QuerySchema, specs: readonly SortSpec[], state: EvalState, appendIdentity = true): QueryOutcome<number> {
  for (const spec of specs) {
    const a = evaluateExpression(state, spec.expression, left, schema);
    const b = evaluateExpression(state, spec.expression, right, schema);
    if (!a.ok) return a;
    if (!b.ok) return b;
    const field = spec.expression.kind === 'field' ? sourceField(schema, spec.expression) : undefined;
    const aNull = a.value === null || a.value === undefined;
    const bNull = b.value === null || b.value === undefined;
    let compared = aNull || bNull ? aNull && bNull ? 0 : aNull ? spec.nulls === 'first' ? -1 : 1 : spec.nulls === 'first' ? 1 : -1 : compareValue(a.value, b.value, field?.type.value ?? 'text') ?? 0;
    if (compared !== 0) {
      if (!aNull && !bNull && spec.direction === 'desc') compared = -compared;
      return {ok: true, value: compared};
    }
  }
  if (appendIdentity) {
    for (const identity of schema.identity) {
      const compared = compareValue(left[identity], right[identity], schema.fields.find((field) => field.id === identity)?.type.value ?? 'text');
      if (compared !== undefined && compared !== 0) return {ok: true, value: compared};
    }
  }
  return {ok: true, value: 0};
}

/** Gregorian weekday for the bounded four-digit date domain (Sunday = 0). */
function gregorianWeekday(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const;
  const adjustedYear = month < 3 ? year - 1 : year;
  const weekday = adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) + offsets[month - 1]! + day;
  return ((weekday % 7) + 7) % 7;
}

function shiftGregorianDate(year: number, month: number, day: number, delta: number): {readonly year: number; readonly month: number; readonly day: number} | undefined {
  // Date.UTC(year, ...) intentionally is not used: ECMAScript treats numeric
  // years 0..99 as 1900..1999. setUTCFullYear preserves the ISO year.
  const shifted = new Date(0);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCFullYear(year, month - 1, day);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  const shiftedYear = shifted.getUTCFullYear();
  if (shiftedYear < 0 || shiftedYear > 9999) return undefined;
  return {year: shiftedYear, month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate()};
}

function bucket(value: QueryValue | undefined, item: TimeBucketSpec): QueryOutcome<QueryValue | undefined> {
  if (value === null || value === undefined) return {ok: true, value: null};
  if (typeof value !== 'string') return failure('query.temporal-type', 'Time bucket input must be a date or instant string.');
  let date: string;
  if (validDate(value)) date = value;
  else if (scalarInstantParts(value) !== undefined) date = new Date(value).toISOString().slice(0, 10);
  else return failure('query.temporal-value', 'Time bucket input is not a valid bounded date or instant.');
  const [yearText, monthText, dayText] = date.split('-');
  let year = Number(yearText); let month = Number(monthText); let day = Number(dayText);
  if (item.grain === 'year') { month = 1; day = 1; }
  else if (item.grain === 'quarter') { month = Math.floor((month - 1) / 3) * 3 + 1; day = 1; }
  else if (item.grain === 'month') day = 1;
  else if (item.grain === 'week') {
    const weekday = gregorianWeekday(year, month, day);
    const starts = item.weekStartsOn ?? 1;
    const delta = (weekday - starts + 7) % 7;
    const start = shiftGregorianDate(year, month, day, -delta);
    if (start === undefined) return failure('query.temporal-range', 'Weekly time bucket starts outside the supported four-digit date range.');
    year = start.year; month = start.month; day = start.day;
  }
  return {ok: true, value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`};
}

function aggregateValues(state: EvalState, item: AggregateSpec, group: EvalGroup): QueryOutcome<QueryValue | undefined> {
  const supplied = state.registry.resolve(item.function);
  if (supplied === undefined) return failure('query.function', `Function ${relationKey(item.function)} is not registered.`);
  const trusted = trustedLocalSignature(state, supplied);
  if (!trusted.ok) return trusted;
  const signature = trusted.value;
  if (signature.operation !== 'aggregate' && signature.operation !== 'ratio-of-sums' && signature.operation !== 'mean-of-rates') {
    const arguments_: QueryValue[] = [];
    for (const argument of item.arguments) {
      const value = evaluateAggregateExpression(state, argument, group);
      if (!value.ok) return value;
      arguments_.push(value.value === undefined ? null : value.value);
    }
    return evaluateCall(state, signature, arguments_);
  }
  const values: QueryValue[][] = item.arguments.map(() => []);
  for (const row of group.rows) {
    for (let index = 0; index < item.arguments.length; index += 1) {
      const value = evaluateExpression(state, item.arguments[index]!, row, group.schema);
      if (!value.ok) return value;
      values[index]!.push(value.value === undefined ? null : value.value);
    }
  }
  const id = signature.ref.id;
  if (id === 'core.aggregate.count') return {ok: true, value: values[0] === undefined ? 0 : values[0].filter((value) => value !== null).length};
  if (id === 'core.aggregate.count-distinct') {
    const type = item.arguments[0] === undefined ? undefined : expressionValueType(item.arguments[0], group.schema, state.registry);
    const distinct = new Set(values[0]?.filter((value) => value !== null).map((value) => scalarKey(value, type)));
    return {ok: true, value: distinct.size};
  }
  if (id === 'core.aggregate.sum') {
    let total: QueryValue | undefined;
    for (const value of values[0] ?? []) {
      if (value === null) {
        if (signature.nullPolicy === 'propagate') return {ok: true, value: null};
        continue;
      }
      if (typeof value === 'number' && !Number.isSafeInteger(value)) state.approximate = true;
      if (total === undefined) total = value;
      else {
        const addedCandidate = state.registry.resolve({id: 'core.add', revision: '1'});
        if (addedCandidate === undefined) return failure('query.function', 'Function core.add@1 is not registered.');
        const addedSignature = trustedLocalSignature(state, addedCandidate);
        if (!addedSignature.ok) return addedSignature;
        const added = evaluateCall(state, addedSignature.value, [total, value]);
        if (!added.ok) return added;
        total = added.value;
      }
    }
    return {ok: true, value: total ?? null};
  }
  if (id.startsWith('core.ratio-of-sums')) {
    if (values.length < 2) return failure('query.aggregate', 'Ratio-of-sums requires numerator and denominator arguments.');
    const numerator = sumValues(state, values[0]!); const denominator = sumValues(state, values[1]!);
    if (!numerator.ok) return numerator; if (!denominator.ok) return denominator;
    if (numerator.value === null || denominator.value === null) return {ok: true, value: null};
    const divideId = signature.zeroDenominator === 'error' ? 'core.divide.error' : signature.zeroDenominator === 'unknown' ? 'core.divide.unknown' : 'core.divide.null';
    const divideCandidate = state.registry.resolve({id: divideId, revision: '1'});
    if (divideCandidate === undefined) return failure('query.function', `Function ${divideId}@1 is not registered.`);
    const divide = trustedLocalSignature(state, divideCandidate);
    if (!divide.ok) return divide;
    return evaluateCall(state, divide.value, [numerator.value, denominator.value]);
  }
  if (id === 'core.mean-of-rates') {
    if ((values[0] ?? []).some((value) => value === null) && signature.nullPolicy === 'propagate') return {ok: true, value: null};
    const numeric: number[] = [];
    for (const value of values[0] ?? []) {
      if (typeof value === 'number') numeric.push(value);
      else if (isDecimal(value)) {
        const converted = Number(value.decimal);
        if (!Number.isFinite(converted)) return failure('query.numeric-overflow', 'Decimal mean input exceeded the bounded floating representation.');
        numeric.push(converted);
      }
    }
    if (numeric.length === 0) return {ok: true, value: null};
    state.approximate = true;
    return {ok: true, value: numeric.reduce((sum, value) => sum + value, 0) / numeric.length};
  }
  return unsupported('aggregate-runtime', `No trusted local aggregate implementation exists for ${id}@${signature.ref.revision}.`);
}

function evaluateAggregateExpression(state: EvalState, expression: Expression, group: EvalGroup): QueryOutcome<QueryValue | undefined> {
  if (expression.kind !== 'call') {
    if (group.rows.length !== 1) return unsupported('aggregate-expression', 'A non-aggregate expression cannot be evaluated over multiple group rows.');
    return evaluateExpression(state, expression, group.rows[0]!, group.schema);
  }
  const supplied = state.registry.resolve(expression.function);
  if (supplied === undefined) return failure('query.function', `Function ${relationKey(expression.function)} is not registered.`);
  const trusted = trustedLocalSignature(state, supplied);
  if (!trusted.ok) return trusted;
  const signature = trusted.value;
  if (signature.operation === 'aggregate' || signature.operation === 'ratio-of-sums' || signature.operation === 'mean-of-rates')
    return aggregateValues(state, {id: `nested-${expression.function.id}`, function: expression.function, arguments: expression.arguments}, group);
  const arguments_: QueryValue[] = [];
  for (const argument of expression.arguments) {
    const value = evaluateAggregateExpression(state, argument, group);
    if (!value.ok) return value;
    arguments_.push(value.value === undefined ? null : value.value);
  }
  return evaluateCall(state, signature, arguments_);
}

function sumValues(state: EvalState, values: readonly QueryValue[]): Outcome<QueryValue | null> {
  let total: QueryValue | undefined;
  for (const value of values) {
    if (value === null) return {ok: true, value: null};
    if (typeof value === 'number' && !Number.isSafeInteger(value)) state.approximate = true;
    if (total === undefined) total = value;
    else {
      const candidate = state.registry.resolve({id: 'core.add', revision: '1'});
      if (candidate === undefined) return failure('query.function', 'Function core.add@1 is not registered.');
      const addedSignature = trustedLocalSignature(state, candidate);
      if (!addedSignature.ok) return addedSignature;
      const added = evaluateCall(state, addedSignature.value, [total, value]);
      if (!added.ok) return added;
      total = added.value;
    }
  }
  return {ok: true, value: total ?? null};
}

function nullResult(schema: QuerySchema, row: QueryRow, fields: readonly QueryField[]): QueryRow {
  const output: Record<string, QueryValue> = {...row};
  for (const field of fields) output[field.id] = null;
  return Object.freeze(output);
}

function executeWindow(state: EvalState, input: EvalRelation, items: readonly WindowSpec[], output: QuerySchema): Outcome<EvalRelation> {
  const rows = input.rows.map((row) => ({...row}));
  for (const item of items) {
    const supplied = state.registry.resolve(item.function);
    if (supplied === undefined) return failure('query.function', `Window function ${relationKey(item.function)} is not registered.`);
    const trusted = trustedLocalSignature(state, supplied);
    if (!trusted.ok) return trusted;
    const signature = trusted.value;
    if (!signature.contexts.includes('window')) return failure('query.window-context', `Function ${relationKey(item.function)} is not registered for window evaluation.`);
    if (item.frame.preceding < 0 || item.frame.following < 0) return failure('query.window-frame', 'Window frame bounds must be nonnegative.');
    if (item.function.id === 'core.window.lag' && item.frame.preceding < 1) return failure('query.window-frame', 'lag requires at least one preceding row.');
    const partitions = new Map<string, number[]>();
    for (let index = 0; index < rows.length; index += 1) {
      const values: QueryValue[] = [];
      for (const expression of item.partitionBy) {
        const value = evaluateExpression(state, expression, rows[index]!, input.schema);
        if (!value.ok) return value;
        values.push(value.value === undefined ? null : value.value);
      }
      const key = values.map((value, index) => scalarKey(value, expressionValueType(item.partitionBy[index]!, input.schema, state.registry))).join('|');
      const indexes = partitions.get(key) ?? [];
      indexes.push(index); partitions.set(key, indexes);
    }
    const identitySet = new Set(input.schema.identity);
    for (const spec of item.orderBy) {
      if (spec.expression.kind === 'field') {
        const field = sourceField(input.schema, spec.expression);
        if (field !== undefined) identitySet.delete(field.id);
      }
    }
    if (identitySet.size > 0) return failure('query.window-order', 'Window order must include every stable identity field.', []);
    for (const indexes of partitions.values()) {
      indexes.sort((left, right) => {
        const compared = compareRows(rows[left]!, rows[right]!, input.schema, item.orderBy, state);
        return compared.ok ? compared.value : 0;
      });
      for (let position = 0; position < indexes.length; position += 1) {
        const rowIndex = indexes[position]!;
        const row = rows[rowIndex]!;
        let value: QueryValue | undefined;
        if (item.function.id === 'core.window.rank') {
          let rank = 1;
          const rankSpecs = item.orderBy.filter((spec) => spec.expression.kind !== 'field' || !input.schema.identity.includes(sourceField(input.schema, spec.expression)?.id ?? ''));
          for (let prior = 0; prior < position; prior += 1) {
            const compared = compareRows(rows[indexes[prior]!]!, row, input.schema, rankSpecs, state, false);
            if (compared.ok && compared.value !== 0) rank = prior + 2;
          }
          value = rank;
        } else if (item.function.id === 'core.window.lag') {
          const prior = position - 1;
          if (prior < 0) value = null;
          else {
            const argument = evaluateExpression(state, item.arguments[0]!, rows[indexes[prior]!]!, input.schema);
            if (!argument.ok) return argument;
            value = argument.value ?? null;
          }
        } else if (item.function.id === 'core.window.sum') {
          const first = Math.max(0, position - item.frame.preceding);
          const last = Math.min(indexes.length - 1, position + item.frame.following);
          const values: QueryValue[] = [];
          let hasNull = false;
          for (let offset = first; offset <= last; offset += 1) {
            const argument = evaluateExpression(state, item.arguments[0]!, rows[indexes[offset]!]!, input.schema);
            if (!argument.ok) return argument;
            if (argument.value === null || argument.value === undefined) hasNull = true;
            else values.push(argument.value);
          }
          if (hasNull && signature.nullPolicy === 'propagate') value = null;
          else {
            const summed = sumValues(state, values);
            if (!summed.ok) return summed;
            value = summed.value;
          }
        } else return unsupported('window-runtime', `No trusted local implementation exists for ${item.function.id}@${item.function.revision}.`);
        rows[rowIndex]![item.id] = value ?? null;
      }
    }
  }
  return {ok: true, value: {schema: output, rows: rows.map((row) => Object.freeze(row)), complete: input.complete}};
}

export function evaluateLogicalPlan(plan: LogicalPlan, source: QuerySource, catalog: Catalog, registry: FunctionRegistry, context: QueryExecutionContext = {}): Outcome<QueryResult> {
  const validContext = validateExecutionContext(context);
  if (!validContext.ok) return validContext;
  if (!isPlainDataRecord(source) || typeof source.revision !== 'string' || !isPlainDataRecord(source.relations)) return failure('query.source-shape', 'Query source must be a plain data object with a plain relations map.');
  let verified: Outcome<LogicalPlan>;
  try {
    verified = validateLogicalPlan(plan as unknown, catalog, registry);
  } catch {
    return failure('query.plan', 'Logical plan validation failed safely at the untrusted boundary.');
  }
  if (!verified.ok) return verified;
  plan = verified.value;
  if (plan.pins.sourceRevision !== undefined && plan.pins.sourceRevision !== source.revision) return failure('query.stale-source', 'The logical plan is stale for the source revision.');
  if (source.catalogRevision !== undefined && source.catalogRevision !== catalog.revision) return failure('query.stale-source', 'The source catalog revision is stale.');
  if (plan.pins.scopeDigest !== undefined && ((context.scopeDigest ?? source.scopeDigest) !== plan.pins.scopeDigest || (source.scopeDigest !== undefined && source.scopeDigest !== plan.pins.scopeDigest))) return failure('query.denied', 'The logical plan scope is not authorized for this source.');
  if (plan.pins.policyRevision !== undefined && ((context.policyRevision ?? source.policyRevision) !== plan.pins.policyRevision || (source.policyRevision !== undefined && source.policyRevision !== plan.pins.policyRevision))) return failure('query.denied', 'The logical plan policy revision is not current.');
  if (context.catalogRevision !== undefined && context.catalogRevision !== catalog.revision) return failure('query.stale-catalog', 'The evaluator context catalog revision is stale.');
  const state: EvalState = {source, catalog, registry, context, ...(validContext.value.startedAt === undefined ? {} : {startedAt: validContext.value.startedAt, lastClock: validContext.value.startedAt}), unknown: [], approximate: false, operations: 0};
  const nodes = new Map(plan.nodes.map((node) => [node.id, node] as const));
  const cache = new Map<string, Outcome<EvalRelation>>();
  const evaluateNode = (id: string): Outcome<EvalRelation> => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const node = nodes.get(id);
    if (node === undefined) return failure('query.plan', `Plan node ${id} is missing.`);
    const checked = tick(state);
    if (!checked.ok) { cache.set(id, checked); return checked; }
    const inputs: EvalRelation[] = [];
    for (const inputId of node.inputs) {
      const input = evaluateNode(inputId);
      if (!input.ok) { cache.set(id, input); return input; }
      inputs.push(input.value);
    }
    let result: Outcome<EvalRelation>;
    if (node.op === 'scan') {
      const relation = source.relations[node.entity];
      result = relation === undefined ? failure('query.source', `Source relation ${node.entity} is missing.`) : normalizeSourceRelation(relation, catalog, node.entity);
    } else if (node.op === 'filter') {
      const input = inputs[0]!;
      const rows: QueryRow[] = [];
      for (const row of input.rows) {
        const checkedPredicate = evaluatePredicate(state, node.predicate, row, input.schema);
        if (!checkedPredicate.ok) { result = checkedPredicate; cache.set(id, result); return result; }
        if (checkedPredicate.value === 'true') rows.push(row);
      }
      result = {ok: true, value: {schema: node.output, rows, complete: input.complete}};
    } else if (node.op === 'project' || node.op === 'derive' || node.op === 'time-bucket') {
      const input = inputs[0]!;
      const rows: QueryRow[] = [];
      const items = node.op === 'time-bucket' ? node.items : node.items;
      for (const row of input.rows) {
        const projected: Record<string, QueryValue> = {...row};
        for (const item of items) {
          const value = node.op === 'time-bucket'
            ? (() => { const timeItem = item as TimeBucketSpec; const expression = evaluateExpression(state, timeItem.expression, row, input.schema); return expression.ok ? bucket(expression.value, timeItem) : expression; })()
            : evaluateExpression(state, item.expression, row, input.schema);
          if (!value.ok) { result = value; cache.set(id, result); return result; }
          if (node.op === 'project') projected[item.id] = value.value ?? null;
          else projected[item.id] = value.value ?? null;
        }
        if (node.op === 'project') {
          const output: Record<string, QueryValue> = {};
          for (const field of node.output.fields) output[field.id] = projected[field.id] ?? null;
          rows.push(Object.freeze(output));
        } else rows.push(Object.freeze(projected));
      }
      result = {ok: true, value: {schema: node.output, rows, complete: input.complete}};
    } else if (node.op === 'join' || node.op === 'semijoin') {
      const left = inputs[0]!; const right = inputs[1]!;
      if (!left.complete || !right.complete) { result = failure('query.incomplete-input', 'Join and semijoin require complete source populations.'); cache.set(id, result); return result; }
      const keys = node.keys;
      const rightRows: QueryRow[] = [];
      for (const row of right.rows) {
        if (node.spec.where === undefined) {
          rightRows.push(row);
          continue;
        }
        const predicate = evaluatePredicate(state, node.spec.where, row, right.schema);
        if (!predicate.ok) { result = predicate; cache.set(id, result); return result; }
        if (predicate.value === 'true') rightRows.push(row);
      }
      const rightMap = new Map<string, QueryRow[]>();
      for (const row of rightRows) {
        const values = keys.map((key) => row[key.right]);
        if (values.some((value) => value === null || value === undefined)) continue;
        const key = keys.map((joinKey, index) => scalarKey(values[index], right.schema.fields.find((field) => field.id === joinKey.right)?.type.value)).join('|');
        const bucketRows = rightMap.get(key) ?? [];
        bucketRows.push(row); rightMap.set(key, bucketRows);
      }
      const declaredRelationship = relationship(catalog, node.spec.relationship as VersionRef);
      if (node.op === 'join' && declaredRelationship !== undefined && (declaredRelationship.cardinality === 'one-to-one' || declaredRelationship.cardinality === 'many-to-one') && [...rightMap.values()].some((rows) => rows.length > 1)) {
        result = failure('query.cardinality', 'Declared relationship cardinality was violated by duplicate right-side join keys.'); cache.set(id, result); return result;
      }
      const leftKeyCounts = new Map<string, number>();
      if (node.op === 'join' && declaredRelationship?.cardinality === 'one-to-one') {
        for (const leftRow of left.rows) {
          const values = keys.map((key) => leftRow[key.left]);
          if (values.some((value) => value === null || value === undefined)) continue;
          const key = keys.map((joinKey, index) => scalarKey(values[index], left.schema.fields.find((field) => field.id === joinKey.left)?.type.value)).join('|');
          leftKeyCounts.set(key, (leftKeyCounts.get(key) ?? 0) + 1);
        }
        if ([...leftKeyCounts.values()].some((count) => count > 1)) {
          result = failure('query.cardinality', 'Declared one-to-one relationship was violated by duplicate left-side join keys.'); cache.set(id, result); return result;
        }
      }
      const rows: QueryRow[] = [];
      for (const leftRow of left.rows) {
        const values = keys.map((key) => leftRow[key.left]);
        const key = keys.map((joinKey, index) => scalarKey(values[index], left.schema.fields.find((field) => field.id === joinKey.left)?.type.value)).join('|');
        const matches = values.some((value) => value === null || value === undefined) ? [] : rightMap.get(key) ?? [];
        if (node.op === 'semijoin') { if (matches.length > 0) rows.push(leftRow); continue; }
        if (matches.length > 1) { result = failure('query.cardinality', 'Declared one-to-one or many-to-one cardinality was violated by source rows.'); cache.set(id, result); return result; }
        if (matches.length === 0) {
          if (node.spec.kind === 'left') rows.push(nullResult(left.schema, leftRow, right.schema.fields));
        } else rows.push(Object.freeze({...leftRow, ...matches[0]}));
      }
      result = {ok: true, value: {schema: node.output, rows, complete: true}};
    } else if (node.op === 'group') {
      const input = inputs[0]!;
      if (!input.complete) { result = failure('query.incomplete-input', 'Grouping requires a complete source population.'); cache.set(id, result); return result; }
      const groups = new Map<string, {keys: Record<string, QueryValue>; rows: QueryRow[]}>();
      for (const row of input.rows) {
        const values: QueryValue[] = [];
        for (const key of node.keys) { const value = evaluateExpression(state, key.expression, row, input.schema); if (!value.ok) {result = value; cache.set(id, result); return result;} values.push(value.value ?? null); }
        const key = values.map((value, index) => scalarKey(value, node.output.fields[index]?.type.value)).join('|'); const current = groups.get(key) ?? {keys: {}, rows: []};
        node.keys.forEach((groupKey, index) => { current.keys[groupKey.id] = values[index] ?? null; });
        current.rows.push(row); groups.set(key, current);
      }
      if (node.keys.length === 0 && groups.size === 0) groups.set('[]', {keys: {}, rows: []});
      const groupValues: EvalGroup[] = [...groups.values()].map((group) => ({keyRow: Object.freeze(group.keys), rows: Object.freeze(group.rows), schema: input.schema}));
      result = {ok: true, value: {schema: node.output, rows: groupValues.map((group) => group.keyRow), complete: true, groups: groupValues}};
    } else if (node.op === 'aggregate') {
      const input = inputs[0]!;
      if (input.groups === undefined) { result = failure('query.aggregate', 'Aggregate node requires a preceding group node.'); cache.set(id, result); return result; }
      const rows: QueryRow[] = [];
      for (const group of input.groups) {
        const output: Record<string, QueryValue> = {...group.keyRow};
        for (const item of node.items) { const value = aggregateValues(state, item, group); if (!value.ok) {result = value; cache.set(id, result); return result;} output[item.id] = value.value ?? null; }
        rows.push(Object.freeze(output));
      }
      result = {ok: true, value: {schema: node.output, rows, complete: true}};
    } else if (node.op === 'sort') {
      const input = inputs[0]!;
      if (!input.complete) { result = failure('query.incomplete-input', 'Exact sorting requires a complete source population.'); cache.set(id, result); return result; }
      const rows = [...input.rows];
      for (let left = 0; left < rows.length; left += 1) for (let right = left + 1; right < rows.length; right += 1) {
        const compared = compareRows(rows[left]!, rows[right]!, input.schema, node.items, state);
        if (!compared.ok) {result = compared; cache.set(id, result); return result;}
        if (compared.value > 0) [rows[left], rows[right]] = [rows[right]!, rows[left]!];
        const step = tick(state); if (!step.ok) {result = step; cache.set(id, result); return result;}
      }
      result = {ok: true, value: {schema: node.output, rows, complete: true}};
    } else if (node.op === 'top-k') {
      const input = inputs[0]!;
      if (!input.complete) { result = failure('query.incomplete-input', 'Top-K requires a complete source population.'); cache.set(id, result); return result; }
      result = {ok: true, value: {schema: node.output, rows: input.rows.slice(0, node.limit), complete: true}};
    } else if (node.op === 'window') {
      const input = inputs[0]!;
      if (!input.complete) { result = failure('query.incomplete-input', 'Window evaluation requires a complete source population.'); cache.set(id, result); return result; }
      result = executeWindow(state, input, node.items, node.output);
    } else result = failure('query.plan', 'Unknown logical plan operation.');
    cache.set(id, result);
    return result;
  };
  const final = evaluateNode(plan.root);
  if (!final.ok) return final;
  const rows = final.value.rows;
  const bytes = outputBytes(rows);
  if (context.maxRows !== undefined && rows.length > context.maxRows) return failure('query.budget', 'Query result exceeds the row budget.');
  if (context.maxBytes !== undefined && bytes > context.maxBytes) return failure('query.budget', 'Query result exceeds the byte budget.');
  const finalCheck = tick(state, 0);
  if (!finalCheck.ok) return finalCheck;
  return {ok: true, value: {schema: final.value.schema, rows, sourceRevision: source.revision, complete: final.value.complete, precision: state.approximate ? {kind: 'approximate', method: 'IEEE-754 arithmetic, division or mean'} : {kind: 'exact'}, unknown: state.unknown, estimatedBytes: bytes}};
}
