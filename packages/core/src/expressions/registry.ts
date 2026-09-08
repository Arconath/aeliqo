import type {Outcome, SemanticType, VersionRef} from '../contracts/types.js';
import {semanticFailure} from '../semantics/errors.js';
import {validateSemanticType} from '../semantics/type-utils.js';
import type {
  FunctionParameter,
  FunctionRegistry,
  FunctionRegistryInput,
  FunctionSignature,
  TypeConstraint,
} from './types.js';

/** Version refs may themselves contain `@`; use a tuple encoding, not a delimiter. */
export const versionKey = (ref: VersionRef): string => JSON.stringify([ref.id, ref.revision]);

export function createFunctionRegistry(input: FunctionRegistryInput): Outcome<FunctionRegistry> {
  if (typeof input.digest !== 'string' || input.digest.trim() === '')
    return semanticFailure('semantic.registry-digest', 'A function registry needs a nonempty immutable digest.', ['digest']);
  if (!Array.isArray(input.signatures) || input.signatures.length === 0)
    return semanticFailure('semantic.registry-empty', 'A function registry needs at least one versioned signature.', ['signatures']);

  const seen = new Set<string>();
  for (let index = 0; index < input.signatures.length; index += 1) {
    const signature = input.signatures[index];
    const path = ['signatures', index] as const;
    if (!isRecord(signature))
      return semanticFailure('semantic.registry-signature', 'Function signature must be an object.', path);
    if (!validVersionRef(signature.ref))
      return semanticFailure('semantic.registry-ref', 'Function signature must pin a nonempty ID and revision.', [...path, 'ref']);
    const key = versionKey(signature.ref);
    if (seen.has(key))
      return semanticFailure('semantic.registry-duplicate', `Function ${key} is declared more than once.`, [...path, 'ref']);
    seen.add(key);
    if (!Array.isArray(signature.contexts) || signature.contexts.length === 0 || !signature.contexts.every(isEvaluationContext))
      return semanticFailure('semantic.registry-context', `Function ${key} must declare an evaluation context.`, [...path, 'contexts']);
    if (!isRecord(signature.cost) || !Number.isSafeInteger(signature.cost.maxNodes) || signature.cost.maxNodes <= 0 || (signature.cost.maxMilliseconds !== undefined && (!Number.isFinite(signature.cost.maxMilliseconds) || signature.cost.maxMilliseconds <= 0)))
      return semanticFailure('semantic.registry-cost', `Function ${key} must declare a positive node budget.`, [...path, 'cost', 'maxNodes']);
    if (!Array.isArray(signature.parameters) || !signature.parameters.every(validParameter) || (signature.variadic !== undefined && !validParameter(signature.variadic)))
      return semanticFailure('semantic.registry-parameter', `Function ${key} has invalid parameter declarations.`, [...path, 'parameters']);
    for (let parameterIndex = 0; parameterIndex < signature.parameters.length; parameterIndex += 1) {
      if (!validConstraint(signature.parameters[parameterIndex]!.constraint, parameterIndex))
        return semanticFailure('semantic.registry-parameter', `Function ${key} has an invalid parameter constraint.`, [...path, 'parameters', parameterIndex, 'constraint']);
    }
    if (signature.variadic !== undefined && !validConstraint(signature.variadic.constraint, signature.parameters.length))
      return semanticFailure('semantic.registry-parameter', `Function ${key} has an invalid variadic constraint.`, [...path, 'variadic', 'constraint']);
    let optionalSeen = false;
    for (let parameterIndex = 0; parameterIndex < signature.parameters.length; parameterIndex += 1) {
      const parameter = signature.parameters[parameterIndex]!;
      if (parameter.optional === true) optionalSeen = true;
      else if (optionalSeen) return semanticFailure('semantic.registry-parameter', `Function ${key} cannot place a required parameter after an optional parameter.`, [...path, 'parameters', parameterIndex]);
    }
    if (!validOutput(signature.output, signature.parameters.length))
      return semanticFailure('semantic.registry-output', `Function ${key} has an invalid output declaration.`, [...path, 'output']);
    if (!isAggregationKind(signature.aggregation?.kind) || !Array.isArray(signature.aggregation?.dimensions) || !signature.aggregation.dimensions.every((dimension: unknown) => typeof dimension === 'string' && dimension.length > 0))
      return semanticFailure('semantic.registry-aggregation', `Function ${key} has an invalid aggregation declaration.`, [...path, 'aggregation']);
    if (!isFunctionOperation(signature.operation) || typeof signature.deterministic !== 'boolean' || !isNullPolicy(signature.nullPolicy) || !isNullResult(signature.nullResult) || !isUnitRule(signature.unitRule) || !isRealization(signature.realization))
      return semanticFailure('semantic.registry-signature', `Function ${key} has invalid execution metadata.`, path);
    if (signature.unitRule === 'explicit-output' && !outputHasExplicitUnit(signature.output))
      return semanticFailure('semantic.registry-unit-rule', `Function ${key} must declare an explicit output unit when using the explicit-output unit rule.`, [...path, 'unitRule']);
    if ((signature.operation === 'divide' || signature.operation === 'ratio-of-sums') && signature.zeroDenominator === undefined)
      return semanticFailure('semantic.registry-zero-denominator', `Division-like function ${key} must declare a zero-denominator policy.`, [...path, 'zeroDenominator']);
    if (signature.zeroDenominator !== undefined && !isZeroPolicy(signature.zeroDenominator))
      return semanticFailure('semantic.registry-zero-denominator', `Function ${key} has an invalid zero-denominator policy.`, [...path, 'zeroDenominator']);
    if (signature.operation !== 'divide' && signature.operation !== 'ratio-of-sums' && signature.zeroDenominator !== undefined)
      return semanticFailure('semantic.registry-zero-denominator', `Only division-like functions may declare zero-denominator policy.`, [...path, 'zeroDenominator']);
  }

  // Keep a private immutable snapshot. A digest is a host-supplied version
  // pin; it is not a cryptographic hash of mutable caller objects.
  const signatures = Object.freeze(input.signatures.map(cloneSignature));
  const registry: FunctionRegistry = {
    digest: input.digest,
    signatures,
    resolve(ref) {
      const wanted = versionKey(ref);
      return signatures.find((signature) => versionKey(signature.ref) === wanted);
    },
  };
  return {ok: true, value: Object.freeze(registry)};
}

function cloneSignature(input: FunctionSignature): FunctionSignature {
  const parameters = Object.freeze(input.parameters.map((parameter) => Object.freeze({
    ...parameter,
    constraint: cloneConstraint(parameter.constraint),
  })));
  const output = cloneOutput(input.output);
  const variadic = input.variadic === undefined ? undefined : Object.freeze({
    ...input.variadic,
    constraint: cloneConstraint(input.variadic.constraint),
  });
  const aggregation = Object.freeze({kind: input.aggregation.kind, dimensions: Object.freeze([...input.aggregation.dimensions])});
  const cost = Object.freeze({...input.cost});
  const contexts = Object.freeze([...input.contexts]);
  return Object.freeze({
    ...input,
    ref: Object.freeze({...input.ref}),
    parameters,
    ...(variadic === undefined ? {} : {variadic}),
    output,
    ...(input.nullResult === undefined ? {} : {nullResult: input.nullResult}),
    ...(input.unitRule === undefined ? {} : {unitRule: input.unitRule}),
    contexts,
    aggregation,
    cost,
  });
}

function cloneOutput(output: FunctionSignature['output']): FunctionSignature['output'] {
  if ('value' in output) return cloneSemanticType(output);
  if (output.kind === 'numeric') {
    return Object.freeze({
      ...output,
      ...(output.unit === undefined ? {} : {unit: Object.freeze({...output.unit})}),
    });
  }
  return Object.freeze({...output});
}

function cloneConstraint(constraint: TypeConstraint): TypeConstraint {
  if (constraint.kind === 'exact') return Object.freeze({...constraint, type: cloneSemanticType(constraint.type)});
  return Object.freeze({...constraint});
}

function cloneSemanticType(type: SemanticType): SemanticType {
  return Object.freeze({
    ...type,
    ...(type.unit === undefined ? {} : {unit: Object.freeze({...type.unit})}),
    ...(type.grain === undefined ? {} : {grain: Object.freeze([...type.grain])}),
    ...(type.temporal === undefined ? {} : {temporal: Object.freeze({...type.temporal})}),
  });
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validVersionRef(value: unknown): value is VersionRef {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && typeof value.revision === 'string' && value.revision.length > 0;
}

function isEvaluationContext(value: unknown): value is FunctionSignature['contexts'][number] {
  return value === 'row' || value === 'group' || value === 'window' || value === 'aggregate-of-aggregates';
}

function isAggregationKind(value: unknown): value is FunctionSignature['aggregation']['kind'] {
  return value === 'additive' || value === 'semi-additive' || value === 'non-additive' || value === 'ratio-of-sums' || value === 'none';
}

function isFunctionOperation(value: unknown): value is FunctionSignature['operation'] {
  return value === 'arithmetic' || value === 'comparison' || value === 'boolean' || value === 'coalesce' || value === 'conditional' || value === 'cast' || value === 'aggregate' || value === 'divide' || value === 'ratio-of-sums' || value === 'mean-of-rates' || value === 'temporal' || value === 'other';
}

function isNullPolicy(value: unknown): value is FunctionSignature['nullPolicy'] {
  return value === 'propagate' || value === 'reject' || value === 'exclude-pair';
}

function isNullResult(value: unknown): value is NonNullable<FunctionSignature['nullResult']> {
  return value === undefined || value === 'propagate' || value === 'preserve' || value === 'non-null';
}

function isUnitRule(value: unknown): value is NonNullable<FunctionSignature['unitRule']> {
  return value === undefined || value === 'same' || value === 'scalar-multiply' || value === 'explicit-output';
}

function isRealization(value: unknown): value is FunctionSignature['realization'] {
  return value === 'local' || value === 'host' || value === 'both';
}

function isZeroPolicy(value: unknown): value is NonNullable<FunctionSignature['zeroDenominator']> {
  return value === 'null' || value === 'unknown' || value === 'error';
}

function validParameter(value: unknown): value is FunctionParameter {
  return isRecord(value) && validConstraint(value.constraint) && (value.optional === undefined || typeof value.optional === 'boolean');
}

function validOutput(value: unknown, parameterCount: number): value is FunctionSignature['output'] {
  if (!isRecord(value)) return false;
  if ('value' in value) return validateSemanticType(value as SemanticType).ok;
  if (value.kind === 'same-as' || value.kind === 'nullable-same-as') return Number.isSafeInteger(value.argument) && value.argument >= 0 && value.argument < parameterCount;
  if (value.kind === 'numeric') return (value.forceFloat === undefined || typeof value.forceFloat === 'boolean') && (value.unit === undefined || validUnit(value.unit));
  return false;
}

function validConstraint(constraint: unknown, parameterIndex?: number): constraint is TypeConstraint {
  if (!isRecord(constraint)) return false;
  if (constraint.kind === 'any' || constraint.kind === 'numeric' || constraint.kind === 'boolean' || constraint.kind === 'text')
    return constraint.allowNull === undefined || typeof constraint.allowNull === 'boolean';
  if (constraint.kind === 'same-as') return Number.isSafeInteger(constraint.argument) && constraint.argument >= 0 && (parameterIndex === undefined || constraint.argument < parameterIndex);
  return constraint.kind === 'exact' && validateSemanticType(constraint.type as SemanticType).ok;
}

function validUnit(value: unknown): value is NonNullable<SemanticType['unit']> {
  return isRecord(value) && typeof value.dimension === 'string' && value.dimension.length > 0 &&
    typeof value.symbol === 'string' && value.symbol.length > 0 &&
    (value.currency === undefined || (typeof value.currency === 'string' && value.currency.length > 0));
}

function outputHasExplicitUnit(output: FunctionSignature['output']): boolean {
  return 'value' in output ? output.unit !== undefined : output.kind === 'numeric' && output.unit !== undefined;
}

const countType = (nullable = false): SemanticType => ({value: 'integer', nullable});
const booleanType = (nullable = false): SemanticType => ({value: 'boolean', nullable});

const numeric: TypeConstraint = {kind: 'numeric'};
const any: TypeConstraint = {kind: 'any'};

function signature(
  ref: VersionRef,
  parameters: readonly FunctionParameter[],
  output: FunctionSignature['output'],
  operation: FunctionSignature['operation'],
  aggregation: FunctionSignature['aggregation']['kind'] = 'none',
  options: Partial<Pick<FunctionSignature, 'nullPolicy' | 'contexts' | 'realization' | 'zeroDenominator' | 'nullResult' | 'unitRule'>> = {},
): FunctionSignature {
  return {
    ref,
    parameters,
    output,
    contexts: options.contexts ?? ['row', 'group'],
    nullPolicy: options.nullPolicy ?? 'propagate',
    ...(options.nullResult === undefined ? {} : {nullResult: options.nullResult}),
    ...(options.unitRule === undefined ? {} : {unitRule: options.unitRule}),
    aggregation: {kind: aggregation, dimensions: []},
    operation,
    deterministic: true,
    cost: {maxNodes: 64},
    realization: options.realization ?? 'both',
    ...(options.zeroDenominator === undefined ? {} : {zeroDenominator: options.zeroDenominator}),
  };
}

/** Trusted, reviewed signatures for the small expression vocabulary used by builders. */
export const standardFunctionSignatures: readonly FunctionSignature[] = [
  signature({id: 'core.add', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'arithmetic', 'none', {unitRule: 'same'}),
  signature({id: 'core.subtract', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'arithmetic', 'none', {unitRule: 'same'}),
  signature({id: 'core.multiply', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'arithmetic', 'none', {unitRule: 'scalar-multiply'}),
  signature({id: 'core.divide.null', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'divide', 'none', {zeroDenominator: 'null'}),
  signature({id: 'core.divide.unknown', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'divide', 'none', {zeroDenominator: 'unknown'}),
  signature({id: 'core.divide.error', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'divide', 'none', {nullPolicy: 'reject', zeroDenominator: 'error'}),
  signature({id: 'core.ratio-of-sums', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'ratio-of-sums', 'ratio-of-sums', {zeroDenominator: 'null'}),
  signature({id: 'core.ratio-of-sums.null', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'ratio-of-sums', 'ratio-of-sums', {zeroDenominator: 'null'}),
  signature({id: 'core.ratio-of-sums.unknown', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'ratio-of-sums', 'ratio-of-sums', {zeroDenominator: 'unknown'}),
  signature({id: 'core.ratio-of-sums.error', revision: '1'}, [{constraint: numeric}, {constraint: numeric}], {kind: 'numeric'}, 'ratio-of-sums', 'ratio-of-sums', {nullPolicy: 'reject', zeroDenominator: 'error'}),
  {
    ...signature({id: 'core.mean-of-rates', revision: '1'}, [], {kind: 'numeric', forceFloat: true}, 'mean-of-rates', 'non-additive', {contexts: ['group']}),
    variadic: {constraint: numeric},
  },
  signature({id: 'core.is-null', revision: '1'}, [{constraint: any, optional: false}], booleanType(false), 'comparison', 'none', {nullResult: 'non-null'}),
  signature({id: 'core.coalesce', revision: '1'}, [{constraint: any}, {constraint: {kind: 'same-as', argument: 0}}], {kind: 'nullable-same-as', argument: 0}, 'coalesce'),
  signature({id: 'core.aggregate.sum', revision: '1'}, [{constraint: numeric}], {kind: 'same-as', argument: 0}, 'aggregate', 'additive', {contexts: ['row', 'group']}),
  signature({id: 'core.aggregate.count', revision: '1'}, [{constraint: any}], countType(false), 'aggregate', 'additive', {contexts: ['row', 'group'], nullResult: 'non-null'}),
  signature({id: 'core.aggregate.count-distinct', revision: '1'}, [{constraint: any}], countType(false), 'aggregate', 'non-additive', {contexts: ['row', 'group'], nullResult: 'non-null'}),
];

export function createStandardFunctionRegistry(digest = 'core-standard-1'): Outcome<FunctionRegistry> {
  return createFunctionRegistry({digest, signatures: standardFunctionSignatures});
}

/** Query registry revision adds bounded window functions without changing core-standard-1. */
export const queryFunctionSignatures: readonly FunctionSignature[] = Object.freeze([
  ...standardFunctionSignatures,
  signature({id: 'core.window.sum', revision: '1'}, [{constraint: numeric}], {kind: 'same-as', argument: 0}, 'aggregate', 'additive', {contexts: ['window']}),
  signature({id: 'core.window.lag', revision: '1'}, [{constraint: any}], {kind: 'nullable-same-as', argument: 0}, 'other', 'none', {contexts: ['window']}),
  signature({id: 'core.window.rank', revision: '1'}, [], countType(false), 'other', 'none', {contexts: ['window'], nullResult: 'non-null'}),
].map(cloneSignature));

const queryFunctionSignaturesV2: readonly FunctionSignature[] = Object.freeze([
  ...queryFunctionSignatures,
  signature({id: 'core.equal', revision: '1'}, [{constraint: any}, {constraint: any}], booleanType(false), 'comparison'),
  signature({id: 'core.if', revision: '1'}, [{constraint: {kind: 'boolean'}}, {constraint: any}, {constraint: any}], {kind: 'same-as', argument: 1}, 'conditional'),
].map(cloneSignature));

export function createQueryFunctionRegistry(input: string | {readonly version: '2'; readonly digest?: string} = 'core-query-1'): Outcome<FunctionRegistry> {
  if (typeof input === 'string') return createFunctionRegistry({digest: input, signatures: queryFunctionSignatures});
  if (input === null || typeof input !== 'object' || input.version !== '2')
    return semanticFailure('semantic.registry-version', 'Unsupported query function registry version.', ['version']);
  return createFunctionRegistry({digest: input.digest ?? 'core-query-2', signatures: queryFunctionSignaturesV2});
}
