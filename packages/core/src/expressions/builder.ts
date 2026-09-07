import type {Catalog, Expression, MeaningDefinition, Outcome, SemanticType, VersionRef} from '../contracts/types.js';
import {createCatalogIndex} from '../semantics/catalog.js';
import {prependOutcomePath, semanticFailure} from '../semantics/errors.js';
import {validateMeaning, validateMeaningBundle} from '../semantics/meaning.js';
import type {MeaningBundle, MeaningBundleContext, MeaningScope, ZeroDenominatorPolicy} from '../semantics/types.js';
import {checkExpression} from './check.js';
import {createFunctionRegistry} from './registry.js';
import type {ExpressionInput, FunctionRegistry, TypedExpression} from './types.js';

type Entity<C extends Catalog> = C['entities'][number];
type EntityId<C extends Catalog> = Entity<C>['id'];
type EntityWithId<C extends Catalog, E extends string> = Extract<Entity<C>, {readonly id: E}>;
type FieldId<C extends Catalog, E extends EntityId<C>> = EntityWithId<C, E>['fields'][number]['id'];

export interface AuthoringOptions<C extends Catalog> extends MeaningBundleContext {
  readonly catalog: C;
}

export interface RatioOfSumsInput {
  readonly numerator: ExpressionInput;
  readonly denominator: ExpressionInput;
  readonly zeroDenominator: ZeroDenominatorPolicy;
}

export interface MeanOfRatesInput {
  readonly rates: readonly [ExpressionInput, ...ExpressionInput[]];
}

export interface DefineMetricInput {
  readonly id: string;
  readonly revision?: string;
  readonly label: string;
  readonly description: string;
  readonly expression: ExpressionInput;
  readonly aggregation?: MeaningDefinition['aggregation'];
  readonly aggregationDimensions?: readonly string[];
  readonly missingPolicy?: MeaningDefinition['missingPolicy'];
  readonly scope?: MeaningScope;
  readonly dependencies?: readonly VersionRef[];
}

export interface TypedAuthoring<C extends Catalog> {
  readonly catalog: C;
  readonly registry: FunctionRegistry;
  field<E extends EntityId<C>>(entityId: E, fieldId: FieldId<C, E>): Outcome<TypedExpression>;
  literal(value: unknown, type: SemanticType): Outcome<TypedExpression>;
  call(ref: VersionRef, args: readonly ExpressionInput[]): Outcome<TypedExpression>;
  ratioOfSums(input: RatioOfSumsInput): Outcome<TypedExpression>;
  meanOfRates(input: MeanOfRatesInput): Outcome<TypedExpression>;
  defineMetric(input: DefineMetricInput): Outcome<MeaningDefinition>;
  bundle(meanings: readonly MeaningDefinition[]): Outcome<MeaningBundle>;
}

export function createTypedAuthoring<const C extends Catalog>(options: AuthoringOptions<C>): Outcome<TypedAuthoring<C>> {
  const indexOutcome = createCatalogIndex(options.catalog);
  if (!indexOutcome.ok) return indexOutcome;
  const index = indexOutcome.value;
  if (options.registry.digest !== index.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-registry', 'The supplied function registry does not match the catalog registry pin.', ['functionRegistryDigest']);
  const registryOutcome = createFunctionRegistry({digest: options.registry.digest, signatures: options.registry.signatures});
  if (!registryOutcome.ok) return registryOutcome;
  const registry = registryOutcome.value;
  const catalog = snapshotValue(index.catalog) as C;
  const definitions = snapshotDefinitions(options.definitions ?? []);
  const policy = options.policy === undefined ? undefined : snapshotValue(options.policy);
  const context = (entityId?: string) => ({
    catalog,
    index,
    registry,
    definitions,
    ...(entityId === undefined ? {} : {entityId}),
  });

  const field = <E extends EntityId<C>>(entityId: E, fieldId: FieldId<C, E>): Outcome<TypedExpression> => {
    const resolved = index.resolveField(entityId, fieldId);
    if (!resolved.ok) return resolved;
    const expression: Expression = {kind: 'field', ref: fieldId, entity: entityId};
    return {ok: true, value: {expression, type: resolved.value.type, context: 'row', entityId: resolved.value.entityId}};
  };

  const literal = (value: unknown, type: SemanticType): Outcome<TypedExpression> =>
    checkExpression({kind: 'literal', value, type}, context());

  const call = (ref: VersionRef, args: readonly ExpressionInput[]): Outcome<TypedExpression> => {
    const unwrapped = unwrapAll(args);
    if (!unwrapped.ok) return unwrapped;
    const entityIds = [...new Set(unwrapped.value.map((argument) => argument.entityId).filter((entityId): entityId is string => entityId !== undefined))];
    if (entityIds.length > 1)
      return semanticFailure('semantic.entity-grain', 'An expression cannot combine fields from different entity bindings without an explicit registered relation.', ['arguments']);
    const expression: Expression = {kind: 'call', function: ref, arguments: unwrapped.value.map((argument) => argument.expression)};
    const entityId = entityIds[0] ?? inferEntity(expression, index);
    return checkExpression(expression, context(entityId));
  };

  const ratioOfSums = (input: RatioOfSumsInput): Outcome<TypedExpression> => {
    const numerator = unwrap(input.numerator);
    if (!numerator.ok) return numerator;
    const denominator = unwrap(input.denominator);
    if (!denominator.ok) return denominator;
    return call({id: `core.ratio-of-sums.${input.zeroDenominator}`, revision: '1'}, [numerator.value, denominator.value]);
  };

  const meanOfRates = (input: MeanOfRatesInput): Outcome<TypedExpression> => {
    const rates = unwrapAll(input.rates);
    if (!rates.ok) return rates;
    const result = call({id: 'core.mean-of-rates', revision: '1'}, rates.value);
    if (!result.ok) return result;
    return {ok: true, value: {...result.value, aggregation: 'non-additive'}};
  };

  const defineMetric = (input: DefineMetricInput): Outcome<MeaningDefinition> => {
    const expression = unwrap(input.expression);
    if (!expression.ok) return expression;
    const inferredAggregation = input.aggregation ?? expression.value.aggregation ?? 'none';
    if (input.aggregation !== undefined && expression.value.aggregation !== undefined && input.aggregation !== expression.value.aggregation)
      return semanticFailure('semantic.aggregation-mismatch', 'Declared aggregation does not match the expression operation.', ['aggregation']);
    const dependencies = uniqueRefs([...(input.dependencies ?? []), ...collectDefinitionRefs(expression.value.expression)]);
    const meaning: MeaningDefinition = {
      id: input.id,
      revision: input.revision ?? '1',
      label: input.label,
      explanation: input.description,
      output: expression.value.type,
      implementation: {kind: 'expression', expression: expression.value.expression},
      dependencies,
      functionRegistryDigest: options.registry.digest,
      origin: 'manual',
      lifecycle: 'draft',
      scope: input.scope ?? 'session',
      authority: 'hypothesis',
      aggregation: inferredAggregation,
      aggregationDimensions: input.aggregationDimensions ?? [],
      missingPolicy: input.missingPolicy ?? 'propagate',
    };
    return validateMeaning(meaning, {catalog, registry, index, definitions, ...(policy === undefined ? {} : {policy})});
  };

  const bundle = (meanings: readonly MeaningDefinition[]): Outcome<MeaningBundle> =>
    validateMeaningBundle({catalogRevision: catalog.revision, functionRegistryDigest: registry.digest, meanings}, {catalog, registry, definitions, ...(policy === undefined ? {} : {policy})});

  return {ok: true, value: Object.freeze({catalog, registry, field, literal, call, ratioOfSums, meanOfRates, defineMetric, bundle})};
}

/** Keep a typed authoring session pinned even when caller-owned wire objects are edited later. */
function snapshotDefinitions(definitions: readonly MeaningDefinition[]): readonly MeaningDefinition[] {
  return Object.freeze(definitions.map((definition) => snapshotValue(definition) as MeaningDefinition));
}

function snapshotValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshotValue(item))) as T;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) copy[key] = snapshotValue(child);
  return Object.freeze(copy) as T;
}

function unwrap(input: ExpressionInput): Outcome<TypedExpression> {
  if (isOutcome(input)) return input;
  return {ok: true, value: input};
}

function unwrapAll(inputs: readonly ExpressionInput[]): Outcome<readonly TypedExpression[]> {
  const values: TypedExpression[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const value = unwrap(inputs[index]!);
    if (!value.ok) return prependOutcomePath(['arguments', index], value);
    values.push(value.value);
  }
  return {ok: true, value: values};
}

function isOutcome(input: ExpressionInput): input is Outcome<TypedExpression> {
  return typeof input === 'object' && input !== null && 'ok' in input && typeof input.ok === 'boolean';
}

function inferEntity(expression: Expression, index: ReturnType<typeof createCatalogIndex> extends Outcome<infer I> ? I : never): string | undefined {
  const stack = [expression];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'field') {
      const bindings = index.fieldsById.get(node.ref);
      if (bindings?.length === 1) return bindings[0]!.entityId;
    }
    if (node.kind === 'call') for (let position = node.arguments.length - 1; position >= 0; position -= 1) stack.push(node.arguments[position]!);
  }
  return undefined;
}

function collectDefinitionRefs(expression: Expression): readonly VersionRef[] {
  const refs: VersionRef[] = [];
  const stack = [expression];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'definition') refs.push(node.ref);
    if (node.kind === 'call') for (let position = node.arguments.length - 1; position >= 0; position -= 1) stack.push(node.arguments[position]!);
  }
  return refs;
}

function uniqueRefs(refs: readonly VersionRef[]): readonly VersionRef[] {
  const seen = new Set<string>();
  const result: VersionRef[] = [];
  for (const ref of refs) {
    const identity = JSON.stringify([ref.id, ref.revision]);
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(ref);
    }
  }
  return result;
}
