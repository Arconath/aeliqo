import type { Catalog, Expression, Outcome, SemanticType } from '../../contracts/types.js';
import { validateSemanticType } from '../../semantics/type-utils.js';
import type { FunctionRegistry } from '../../expressions/types.js';
import type { PredicateSpec, QuerySchema } from '../types.js';
import { entity, failure, fieldKey, isRecord, planId, relationKey } from './shared.js';

const FIELD_ROLES = new Set(['identity', 'attribute', 'dimension', 'measure', 'time']);

export function catalogSchema(catalog: Catalog, entityId: string): QuerySchema | undefined {
  const definition = entity(catalog, entityId);
  if (definition === undefined) return undefined;
  return {
    fields: definition.fields.map((field) => ({
      id: fieldKey(entityId, field.id),
      label: field.label,
      type:
        field.type.grain === undefined
          ? { ...field.type, grain: definition.rowGrain.map((grain) => fieldKey(entityId, grain)) }
          : field.type,
      role: field.role,
      source: { entity: entityId, field: field.id },
    })),
    identity: definition.identity.map((field) => fieldKey(entityId, field)),
    grain: definition.rowGrain.map((field) => fieldKey(entityId, field)),
  };
}

function validFieldSource(source: unknown, catalog: Catalog): boolean {
  if (source === undefined) return true;
  if (!isRecord(source) || !planId(source.entity) || !planId(source.field)) return false;
  const definition = entity(catalog, source.entity);
  return definition !== undefined && definition.fields.some((field) => field.id === source.field);
}

function validSchemaField(
  candidate: unknown,
  catalog: Catalog,
  ids: Set<string>,
): candidate is Record<string, unknown> {
  if (
    !isRecord(candidate) ||
    !planId(candidate.id) ||
    ids.has(candidate.id) ||
    typeof candidate.label !== 'string' ||
    !isRecord(candidate.type) ||
    !FIELD_ROLES.has(String(candidate.role)) ||
    !validateSemanticType(candidate.type as SemanticType).ok ||
    !validFieldSource(candidate.source, catalog)
  )
    return false;
  ids.add(candidate.id);
  return true;
}

function fieldsAreDeclared(values: readonly unknown[], ids: ReadonlySet<string>): boolean {
  return values.every((id) => typeof id === 'string' && ids.has(id));
}

export function validQuerySchema(value: unknown, catalog: Catalog): value is QuerySchema {
  if (!isRecord(value) || !Array.isArray(value.fields) || !Array.isArray(value.identity) || !Array.isArray(value.grain))
    return false;
  const ids = new Set<string>();
  if (!value.fields.every((field) => validSchemaField(field, catalog, ids))) return false;
  return fieldsAreDeclared(value.identity, ids) && fieldsAreDeclared(value.grain, ids);
}

export function planFields(schema: QuerySchema): Set<string> {
  return new Set(schema.fields.map((field) => field.id));
}

function sameUnit(left: SemanticType['unit'], right: SemanticType['unit']): boolean {
  return left?.dimension === right?.dimension && left?.currency === right?.currency && left?.symbol === right?.symbol;
}

function sameTemporal(left: SemanticType['temporal'], right: SemanticType['temporal']): boolean {
  return left?.calendar === right?.calendar && left?.timezone === right?.timezone && left?.grain === right?.grain;
}

export function compatibleSemanticTypes(left: SemanticType, right: SemanticType): boolean {
  return left.value === right.value && sameUnit(left.unit, right.unit) && sameTemporal(left.temporal, right.temporal);
}

function validateFieldExpression(
  schema: QuerySchema,
  expression: Extract<Expression, { kind: 'field' }>,
): Outcome<void> {
  const matches = schema.fields.filter((field) => {
    if (expression.entity === undefined) return field.id === expression.ref || field.source?.field === expression.ref;
    return field.source?.entity === expression.entity && field.source.field === expression.ref;
  });
  if (matches.length === 1) return { ok: true, value: undefined };
  return failure('query.plan', 'Plan contains an unknown or ambiguous field expression.');
}

function validateCallExpression(
  schema: QuerySchema,
  expression: Extract<Expression, { kind: 'call' }>,
  registry: FunctionRegistry,
  depth: number,
): Outcome<void> {
  if (
    !planId(expression.function.id) ||
    !planId(expression.function.revision) ||
    registry.resolve(expression.function) === undefined
  )
    return failure('query.plan', `Plan references an unregistered function ${relationKey(expression.function)}.`);
  for (const argument of expression.arguments) {
    const checked = expressionFields(schema, argument, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return { ok: true, value: undefined };
}

export function expressionFields(
  schema: QuerySchema,
  expression: Expression,
  registry: FunctionRegistry,
  depth = 0,
): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Plan expression depth exceeds the bounded evaluator limit.');
  switch (expression.kind) {
    case 'field':
      return validateFieldExpression(schema, expression);
    case 'literal':
      return validateSemanticType(expression.type).ok
        ? { ok: true, value: undefined }
        : failure('query.plan', 'Plan contains an invalid literal type.');
    case 'definition':
      return failure('query.plan', 'Definition expressions must be expanded before execution.');
    case 'call':
      return validateCallExpression(schema, expression, registry, depth);
  }
}

function validateAggregateCall(
  expression: Extract<Expression, { kind: 'call' }>,
  registry: FunctionRegistry,
  depth: number,
): Outcome<void> {
  if (
    !planId(expression.function.id) ||
    !planId(expression.function.revision) ||
    registry.resolve(expression.function) === undefined
  )
    return failure('query.plan', 'Aggregate function reference is invalid.');
  for (const argument of expression.arguments) {
    const checked = aggregateExpressionShape(argument, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return { ok: true, value: undefined };
}

export function aggregateExpressionShape(expression: Expression, registry: FunctionRegistry, depth = 0): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Aggregate expression depth exceeds the bounded evaluator limit.');
  switch (expression.kind) {
    case 'field':
      if (planId(expression.ref) && (expression.entity === undefined || planId(expression.entity)))
        return { ok: true, value: undefined };
      return failure('query.plan', 'Aggregate field reference is invalid.');
    case 'literal':
      return validateSemanticType(expression.type).ok
        ? { ok: true, value: undefined }
        : failure('query.plan', 'Aggregate literal type is invalid.');
    case 'definition':
      return failure('query.plan', 'Definition expressions must be expanded before execution.');
    case 'call':
      return validateAggregateCall(expression, registry, depth);
  }
}

function validatePredicateChildren(
  schema: QuerySchema,
  predicates: readonly PredicateSpec[],
  registry: FunctionRegistry,
  depth: number,
): Outcome<void> {
  for (const predicate of predicates) {
    const checked = predicateFields(schema, predicate, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return { ok: true, value: undefined };
}

function validatePredicateExpressions(
  schema: QuerySchema,
  expressions: readonly Expression[],
  registry: FunctionRegistry,
  depth: number,
): Outcome<void> {
  for (const expression of expressions) {
    const checked = expressionFields(schema, expression, registry, depth + 1);
    if (!checked.ok) return checked;
  }
  return { ok: true, value: undefined };
}

export function predicateFields(
  schema: QuerySchema,
  predicate: PredicateSpec,
  registry: FunctionRegistry,
  depth = 0,
): Outcome<void> {
  if (depth > 64) return failure('query.plan', 'Plan predicate depth exceeds the bounded evaluator limit.');
  switch (predicate.op) {
    case 'and':
    case 'or':
      return validatePredicateChildren(schema, predicate.predicates, registry, depth);
    case 'not':
      return predicateFields(schema, predicate.predicate, registry, depth + 1);
    case 'compare':
      return validatePredicateExpressions(schema, [predicate.left, predicate.right], registry, depth);
    case 'is-null':
      return expressionFields(schema, predicate.expression, registry, depth + 1);
    case 'in':
      return validatePredicateExpressions(schema, [predicate.expression, ...predicate.values], registry, depth);
  }
}
