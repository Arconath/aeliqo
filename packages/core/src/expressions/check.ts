import {parseContract} from '../contracts/parse.js';
import type {Catalog, Expression, MeaningDefinition, Outcome, SemanticType, VersionRef} from '../contracts/types.js';
import {createCatalogIndex} from '../semantics/catalog.js';
import {prependOutcomePath, semanticFailure} from '../semantics/errors.js';
import {compatibleType, grainOf, isNumericType, sameStringSet, sameTemporal, sameUnit, validateSemanticType, numericOutput} from '../semantics/type-utils.js';
import type {CatalogIndex, EvaluationContext} from '../semantics/types.js';
import type {FunctionOutput, FunctionParameter, FunctionRegistry, FunctionSignature, TypedExpression, TypeConstraint} from './types.js';

export interface ExpressionCheckContext {
  readonly catalog: Catalog;
  readonly registry: FunctionRegistry;
  readonly index?: CatalogIndex;
  readonly definitions?: readonly MeaningDefinition[];
  readonly entityId?: string;
  readonly evaluationContext?: EvaluationContext;
  readonly expectedType?: SemanticType;
  readonly maxNodes?: number;
  readonly maxDepth?: number;
}

type EnterFrame = {readonly kind: 'enter'; readonly node: Expression; readonly path: readonly (string | number)[]; readonly depth: number};
type ExitFrame = {readonly kind: 'exit'; readonly node: Extract<Expression, {kind: 'call'}>; readonly path: readonly (string | number)[]; readonly depth: number};
type Frame = EnterFrame | ExitFrame;

const refKey = (ref: VersionRef): string => JSON.stringify([ref.id, ref.revision]);

export function checkExpression(input: unknown, context: ExpressionCheckContext): Outcome<TypedExpression> {
  const parsed = parseContract('expression', input);
  if (!parsed.ok) return parsed;
  if (context.registry.digest !== context.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-registry', 'The supplied function registry does not match the catalog registry pin.', ['functionRegistryDigest']);
  const indexOutcome = context.index === undefined ? createCatalogIndex(context.catalog) : {ok: true as const, value: context.index};
  if (!indexOutcome.ok) return indexOutcome;
  const index = indexOutcome.value;
  if (index.catalog.revision !== context.catalog.revision || index.catalog.functionRegistryDigest !== context.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-catalog-index', 'The supplied catalog index belongs to a different catalog revision or function registry pin.', ['catalog']);
  const definitions = new Map<string, MeaningDefinition>();
  for (const meaning of context.catalog.meanings) definitions.set(refKey(meaning), meaning);
  for (const meaning of context.definitions ?? []) {
    const identity = refKey(meaning);
    const prior = definitions.get(identity);
    if (prior !== undefined && stableJSON(prior) !== stableJSON(meaning))
      return semanticFailure('semantic.definition-conflict', `Meaning ${meaning.id}@${meaning.revision} conflicts with the catalog definition.`, ['definitions']);
    if (prior === undefined) definitions.set(identity, meaning);
  }

  const maxNodes = context.maxNodes ?? 256;
  const maxDepth = context.maxDepth ?? 64;
  if (!Number.isSafeInteger(maxNodes) || maxNodes <= 0)
    return semanticFailure('semantic.budget', 'Expression node budget must be a positive safe integer.', ['maxNodes']);
  if (!Number.isSafeInteger(maxDepth) || maxDepth <= 0)
    return semanticFailure('semantic.budget', 'Expression depth budget must be a positive safe integer.', ['maxDepth']);

  const root = parsed.value;
  const stack: Frame[] = [{kind: 'enter', node: root, path: [], depth: 0}];
  const active = new Set<object>();
  const checked = new WeakMap<object, TypedExpression>();
  const signatures = new WeakMap<object, FunctionSignature | undefined>();
  let nodes = 0;
  let final: TypedExpression | undefined;

  while (stack.length > 0) {
    const frame = stack.pop()!;
    // Enter frames represent expression nodes. Exit frames are evaluator work
    // for the same node and must not halve the advertised node budget.
    if (frame.kind === 'enter' && ++nodes > maxNodes)
      return semanticFailure('semantic.budget', 'Expression node budget exceeded.', frame.path);
    if (frame.depth > maxDepth)
      return semanticFailure('semantic.budget', 'Expression depth budget exceeded.', frame.path);

    if (frame.kind === 'exit') {
      const nodeObject = frame.node as object;
      const signature = signatures.get(nodeObject);
      if (signature === undefined) {
        active.delete(nodeObject);
        return semanticFailure('semantic.function-version', `Function ${frame.node.function.id}@${frame.node.function.revision} is not registered.`, [...frame.path, 'function']);
      }
      const args: TypedExpression[] = [];
      for (let index = 0; index < frame.node.arguments.length; index += 1) {
        const argument = checked.get(frame.node.arguments[index] as object);
        if (argument === undefined) {
          active.delete(nodeObject);
          return semanticFailure('semantic.expression', 'A child expression was not checked.', [...frame.path, 'arguments', index]);
        }
        args.push(argument);
      }
      const output = checkCall(frame.node, signature, args, frame.path, context.evaluationContext);
      if (!output.ok) {
        active.delete(nodeObject);
        return output;
      }
      checked.set(nodeObject, output.value);
      active.delete(nodeObject);
      final = output.value;
      continue;
    }

    const nodeObject = frame.node as object;
    if (active.has(nodeObject)) return semanticFailure('semantic.cycle', 'Expression references itself.', frame.path);
    active.add(nodeObject);

    if (frame.node.kind === 'literal') {
      const checkedLiteral = checkLiteral(frame.node, frame.path);
      if (!checkedLiteral.ok) return checkedLiteral;
      checked.set(nodeObject, checkedLiteral.value);
      active.delete(nodeObject);
      final = checkedLiteral.value;
    } else if (frame.node.kind === 'field') {
      const qualifiedEntity = fieldEntity(frame.node);
      if (qualifiedEntity !== undefined && context.entityId !== undefined && qualifiedEntity !== context.entityId)
        return semanticFailure('semantic.entity-grain', 'A field expression has conflicting entity bindings.', [...frame.path, 'entity']);
      const field = index.resolveField(qualifiedEntity ?? context.entityId, frame.node.ref);
      if (!field.ok) return prependOutcomePath(frame.path, field);
      const checkedField: TypedExpression = {expression: frame.node, type: field.value.type, context: context.evaluationContext ?? 'row', entityId: field.value.entityId};
      checked.set(nodeObject, checkedField);
      active.delete(nodeObject);
      final = checkedField;
    } else if (frame.node.kind === 'definition') {
      const meaning = definitions.get(refKey(frame.node.ref));
      if (meaning === undefined)
        return semanticFailure('semantic.unknown-definition', `Meaning ${refKey(frame.node.ref)} is not registered.`, [...frame.path, 'ref']);
      const typeCheck = validateSemanticType(meaning.output, [...frame.path, 'ref']);
      if (!typeCheck.ok) return typeCheck;
      const checkedDefinition: TypedExpression = {expression: frame.node, type: meaning.output, context: context.evaluationContext ?? 'row'};
      checked.set(nodeObject, checkedDefinition);
      active.delete(nodeObject);
      final = checkedDefinition;
    } else {
      const signature = context.registry.resolve(frame.node.function);
      signatures.set(nodeObject, signature);
      stack.push({kind: 'exit', node: frame.node, path: frame.path, depth: frame.depth});
      for (let index = frame.node.arguments.length - 1; index >= 0; index -= 1) {
        stack.push({kind: 'enter', node: frame.node.arguments[index]!, path: [...frame.path, 'arguments', index], depth: frame.depth + 1});
      }
    }
  }

  if (final === undefined) return semanticFailure('semantic.expression', 'Expression did not produce a typed result.');
  if (context.expectedType !== undefined && !compatibleType(final.type, context.expectedType))
    return semanticFailure('semantic.type-mismatch', 'Expression output is incompatible with the expected semantic type.', []);
  return {ok: true, value: final};
}

function checkLiteral(
  node: Extract<Expression, {kind: 'literal'}>,
  path: readonly (string | number)[],
): Outcome<TypedExpression> {
  const typeCheck = validateSemanticType(node.type, [...path, 'type']);
  if (!typeCheck.ok) return typeCheck;
  const value = node.value;
  if (value === null) {
    if (!node.type.nullable) return semanticFailure('semantic.nullability', 'Null literal requires a nullable semantic type.', [...path, 'value']);
  } else if (node.type.value === 'integer' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
    return semanticFailure('semantic.literal-type', 'Integer literals must be safe exact integers.', [...path, 'value']);
  } else if (node.type.value === 'float' && !(typeof value === 'number' && Number.isFinite(value))) {
    return semanticFailure('semantic.literal-type', 'Float literals must be finite numbers.', [...path, 'value']);
  } else if (node.type.value === 'boolean' && typeof value !== 'boolean') {
    return semanticFailure('semantic.literal-type', 'Boolean literals must be booleans.', [...path, 'value']);
  } else if ((node.type.value === 'text' || node.type.value === 'date' || node.type.value === 'instant') && typeof value !== 'string') {
    return semanticFailure('semantic.literal-type', 'Text/date/instant literals must be strings.', [...path, 'value']);
  } else if (node.type.value === 'date' && (typeof value !== 'string' || !isValidIsoDate(value))) {
    return semanticFailure('semantic.literal-date', 'Date literals must be valid proleptic-Gregorian ISO calendar dates.', [...path, 'value']);
  } else if (node.type.value === 'instant' && (typeof value !== 'string' || !isValidIsoInstant(value))) {
    return semanticFailure('semantic.literal-instant', 'Instant literals must be ISO datetimes with an explicit timezone offset.', [...path, 'value']);
  } else if ((node.type.value === 'date' || node.type.value === 'instant') && node.type.temporal !== undefined && node.type.temporal.calendar !== 'gregorian') {
    return semanticFailure('semantic.temporal-calendar', 'Non-Gregorian literal calendars require a registered temporal policy.', [...path, 'type', 'temporal', 'calendar']);
  } else if (node.type.value === 'decimal' && (!isDecimal(value))) {
    return semanticFailure('semantic.literal-type', 'Decimal literals must use the exact decimal object representation.', [...path, 'value']);
  }
  return {ok: true, value: {expression: node, type: node.type, context: 'row'}};
}

function isDecimal(value: unknown): value is {readonly decimal: string} {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'decimal' in value && typeof value.decimal === 'string';
}

function isValidIsoDate(value: string): boolean {
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

function isValidIsoInstant(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (match === null || !isValidIsoDate(match[1]!)) return false;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[5] === 'Z') return true;
  const offsetHour = Number(match[5]!.slice(1, 3));
  const offsetMinute = Number(match[5]!.slice(4, 6));
  return offsetHour <= 23 && offsetMinute <= 59;
}

function checkCall(
  node: Extract<Expression, {kind: 'call'}>,
  signature: FunctionSignature,
  args: readonly TypedExpression[],
  path: readonly (string | number)[],
  requestedContext?: EvaluationContext,
): Outcome<TypedExpression> {
  const required = signature.parameters.filter((parameter) => !parameter.optional).length;
  const maximum = signature.variadic === undefined ? signature.parameters.length : Number.POSITIVE_INFINITY;
  if (args.length < required || args.length > maximum)
    return semanticFailure('semantic.arity', `Function ${refKey(signature.ref)} received ${args.length} arguments; expected ${required}${Number.isFinite(maximum) ? `-${maximum}` : '+'}.`, [...path, 'arguments']);
  const context = requestedContext ?? defaultContext(signature);
  if (!signature.contexts.includes(context))
    return semanticFailure('semantic.function-context', `Function ${refKey(signature.ref)} is not registered for ${context} evaluation.`, [...path, 'function']);

  for (let index = 0; index < args.length; index += 1) {
    const parameter = signature.parameters[index] ?? signature.variadic;
    if (parameter === undefined) return semanticFailure('semantic.arity', 'Function argument has no declared parameter.', [...path, 'arguments', index]);
    const argument = args[index]!;
    if (signature.nullPolicy === 'reject' && argument.type.nullable)
      return semanticFailure('semantic.nullability', `Function ${refKey(signature.ref)} rejects nullable arguments.`, [...path, 'arguments', index]);
    if (!matchesConstraint(argument.type, parameter.constraint, args, index))
      return semanticFailure('semantic.type-mismatch', `Argument ${index + 1} is incompatible with function ${refKey(signature.ref)}.`, [...path, 'arguments', index]);
  }

  const hasDecimal = args.some((argument) => argument.type.value === 'decimal');
  const hasFloat = args.some((argument) => argument.type.value === 'float');
  if (hasDecimal && hasFloat)
    return semanticFailure('semantic.precision-mismatch', 'Decimal and floating-point arguments require an explicit registered cast.', [...path, 'arguments']);

  if (signature.operation === 'arithmetic' && args.length >= 2) {
    if (!sameOrBroadcastGrain(args[0]!, args[1]!))
      return semanticFailure('semantic.grain-mismatch', `Function ${refKey(signature.ref)} received incompatible grains.`, [...path, 'arguments', 1]);
    const outputIsExplicit = isExplicitOutput(signature.output);
    const unitRule = signature.unitRule ?? 'same';
    if (unitRule === 'same' && !sameUnit(args[0]!.type, args[1]!.type))
      return semanticFailure('semantic.unit-mismatch', `Function ${refKey(signature.ref)} received incompatible units.`, [...path, 'arguments', 1]);
    if (unitRule === 'scalar-multiply' && !outputIsExplicit && !scalarMultiplyUnitsAreSafe(args[0]!, args[1]!))
      return semanticFailure('semantic.unit-multiply', 'Multiplication of unit-bearing values requires a dimensionless literal scalar or an explicit registered output unit.', [...path, 'function']);
  }
  if (signature.operation === 'divide' && args.length >= 2 && !sameOrBroadcastGrain(args[0]!, args[1]!))
    return semanticFailure('semantic.grain-mismatch', `Function ${refKey(signature.ref)} received incompatible grains.`, [...path, 'arguments', 1]);
  if (signature.operation === 'ratio-of-sums' && args.length === 2) {
    if (!sameOrBroadcastGrain(args[0]!, args[1]!))
      return semanticFailure('semantic.grain-mismatch', 'Ratio-of-sums requires numerator and denominator at the same grain.', [...path, 'arguments', 1]);
    if (!sameUnit(args[0]!.type, args[1]!.type))
      return semanticFailure('semantic.unit-mismatch', 'Ratio-of-sums requires numerator and denominator in the same registered unit.', [...path, 'arguments', 1]);
  }
  if (signature.operation === 'mean-of-rates') {
    if (args.length === 0)
      return semanticFailure('semantic.arity', 'Mean-of-rates requires at least one rate.', [...path, 'arguments']);
    for (let index = 1; index < args.length; index += 1) {
      if (!sameUnit(args[0]!.type, args[index]!.type))
        return semanticFailure('semantic.unit-mismatch', 'Mean-of-rates requires rates in the same registered unit.', [...path, 'arguments', index]);
      if (!sameOrBroadcastGrain(args[0]!, args[index]!))
        return semanticFailure('semantic.grain-mismatch', 'Mean-of-rates requires rates at the same grain.', [...path, 'arguments', index]);
    }
  }
  if (signature.operation === 'comparison' && args.length >= 2) {
    for (let index = 1; index < args.length; index += 1) {
      const left = args[0]!;
      const right = args[index]!;
      if (!sameComparisonValueKind(left.type, right.type))
        return semanticFailure('semantic.type-mismatch', 'Comparison requires values of the same semantic type family.', [...path, 'arguments', index]);
      if (!sameUnit(left.type, right.type))
        return semanticFailure('semantic.unit-mismatch', 'Comparison requires the same registered unit.', [...path, 'arguments', index]);
      if (!sameOrBroadcastGrain(left, right))
        return semanticFailure('semantic.grain-mismatch', 'Comparison requires the same grain.', [...path, 'arguments', index]);
      if (!sameTemporal(left.type, right.type))
        return semanticFailure('semantic.temporal-mismatch', 'Comparison requires compatible calendar, timezone and temporal grain.', [...path, 'arguments', index]);
    }
  }
  if (signature.operation === 'conditional') {
    if (args.length !== 3 || args[0]!.type.value !== 'boolean')
      return semanticFailure('semantic.conditional-shape', 'Conditional expressions require a boolean condition and two branches.', [...path, 'arguments']);
    const thenBranch = args[1]!;
    const elseBranch = args[2]!;
    if (thenBranch.type.value !== elseBranch.type.value)
      return semanticFailure('semantic.type-mismatch', 'Conditional branches require the same value type.', [...path, 'arguments', 2]);
    if (!sameUnit(thenBranch.type, elseBranch.type))
      return semanticFailure('semantic.unit-mismatch', 'Conditional branches require the same registered unit.', [...path, 'arguments', 2]);
    if (!sameTemporal(thenBranch.type, elseBranch.type))
      return semanticFailure('semantic.temporal-mismatch', 'Conditional branches require the same temporal policy.', [...path, 'arguments', 2]);
    for (let index = 0; index < args.length; index += 1)
      for (let other = index + 1; other < args.length; other += 1)
        if (!sameOrBroadcastGrain(args[index]!, args[other]!) &&
            !(args[index]!.expression.kind === 'literal' && grainOf(args[index]!.type).length === 0) &&
            !(args[other]!.expression.kind === 'literal' && grainOf(args[other]!.type).length === 0))
          return semanticFailure('semantic.grain-mismatch', 'Conditional arguments require compatible grains.', [...path, 'arguments', other]);
  }

  const output = outputType(signature.output, signature.operation, signature.nullResult, args, path);
  if (!output.ok) return output;
  const outputCheck = validateSemanticType(output.value, path);
  if (!outputCheck.ok) return outputCheck;
  const entityIds = [...new Set(args.map((argument) => argument.entityId).filter((entityId): entityId is string => entityId !== undefined))];
  if (entityIds.length > 1)
    return semanticFailure('semantic.entity-grain', 'An expression cannot combine fields from different entity bindings without an explicit registered relation.', [...path, 'arguments']);
  const aggregation = signature.operation === 'ratio-of-sums' ? 'ratio-of-sums' : signature.operation === 'mean-of-rates' ? 'non-additive' : signature.aggregation.kind;
  const inheritedGrain = args.find((argument) => grainOf(argument.type).length > 0)?.type.grain;
  const resultType = signature.operation === 'conditional' || signature.operation === 'comparison'
    ? {...output.value, ...(inheritedGrain === undefined ? {} : {grain: inheritedGrain}),
      ...(signature.operation === 'conditional' ? {nullable: signature.nullResult === 'non-null' ? false
        : signature.nullResult === 'preserve' ? output.value.nullable
        : output.value.nullable || args.some((argument) => argument.type.nullable)} : {})}
    : signature.operation === 'coalesce'
      ? {...output.value, nullable: args.every((argument) => argument.type.nullable)}
      : output.value;
  const reducesGroup = context === 'group' && (signature.operation === 'aggregate' || signature.operation === 'ratio-of-sums' || signature.operation === 'mean-of-rates');
  const mayReturnNull = signature.nullResult !== 'non-null' && signature.nullResult !== 'preserve' &&
    (reducesGroup || signature.zeroDenominator === 'null' || signature.zeroDenominator === 'unknown');
  return {ok: true, value: {
    expression: node,
    type: {...resultType, ...(reducesGroup ? {grain: []} : {}), ...(mayReturnNull ? {nullable: true} : {})},
    context,
    ...(entityIds.length === 1 ? {entityId: entityIds[0]} : {}),
    aggregation,
    operation: signature.operation,
  }};
}

function defaultContext(signature: FunctionSignature): EvaluationContext {
  if (signature.operation === 'aggregate' && signature.contexts.includes('group')) return 'group';
  if (signature.contexts.includes('row')) return 'row';
  return signature.contexts[0] ?? 'row';
}

function matchesConstraint(
  actual: SemanticType,
  constraint: TypeConstraint,
  args: readonly TypedExpression[],
  index: number,
): boolean {
  if (constraint.kind === 'any') return constraint.allowNull !== false || !actual.nullable;
  if (constraint.kind === 'numeric') return isNumericType(actual) && (constraint.allowNull !== false || !actual.nullable);
  if (constraint.kind === 'boolean') return actual.value === 'boolean' && (constraint.allowNull !== false || !actual.nullable);
  if (constraint.kind === 'text') return actual.value === 'text' && (constraint.allowNull !== false || !actual.nullable);
  if (constraint.kind === 'exact') return compatibleType(actual, constraint.type);
  const other = args[constraint.argument];
  return other !== undefined && compatibleType(actual, other.type) && index !== constraint.argument;
}

function outputType(
  output: FunctionOutput,
  operation: FunctionSignature['operation'],
  nullResult: FunctionSignature['nullResult'],
  args: readonly TypedExpression[],
  path: readonly (string | number)[],
): Outcome<SemanticType> {
  if ('value' in output) {
    const nullable = nullResult === 'non-null'
      ? false
      : nullResult === 'preserve'
        ? output.nullable
        : output.nullable || args.some((argument) => argument.type.nullable);
    return {ok: true, value: {...output, nullable}};
  }
  if (output.kind === 'same-as' || output.kind === 'nullable-same-as') {
    const source = args[output.argument]?.type ?? {value: 'float', nullable: true};
    const nullable = output.kind === 'nullable-same-as' ? true : source.nullable;
    return {ok: true, value: {...source, nullable: nullResult === 'non-null' ? false : nullable}};
  }
  const first = args[0]?.type;
  const second = args[1]?.type;
  const unitsDiffer = first !== undefined && second !== undefined && !sameUnit(first, second);
  // A generic division cannot invent a money-per-time (or similar) unit. A
  // registered signature with an explicit semantic output may model it; the
  // generic numeric form is limited to same-unit dimensionless ratios.
  if (operation === 'divide' && unitsDiffer && output.unit === undefined)
    return semanticFailure('semantic.unit-division', 'Division of unequal registered units requires an explicit registered output type.', [...path, 'function']);
  const denominatorScalar = second !== undefined && isDimensionlessLiteral(args[1]!);
  const inferredUnit = output.unit !== undefined
    ? output.unit
    : operation === 'divide' && denominatorScalar
      ? first?.unit
      : operation === 'divide' || operation === 'ratio-of-sums'
      ? undefined
      : args.find((argument) => argument.type.unit !== undefined)?.type.unit;
  const forceFloat = output.forceFloat === true || operation === 'divide' || operation === 'mean-of-rates' || operation === 'ratio-of-sums';
  const options = {
    ...(inferredUnit === undefined ? {} : {unit: inferredUnit}),
    ...(forceFloat ? {forceFloat: true} : {}),
  };
  const result = numericOutput(args, options);
  return {ok: true, value: nullResult === 'non-null' ? {...result, nullable: false} : result};
}

function isExplicitOutput(output: FunctionOutput): boolean {
  return 'value' in output || (output.kind === 'numeric' && output.unit !== undefined);
}

function isDimensionlessLiteral(argument: TypedExpression): boolean {
  return argument.expression.kind === 'literal' && argument.type.unit === undefined && grainOf(argument.type).length === 0 && argument.expression.value !== null;
}

function sameOrBroadcastGrain(left: TypedExpression, right: TypedExpression): boolean {
  return sameStringSet(grainOf(left.type), grainOf(right.type)) || isBroadcastLiteral(left) || isBroadcastLiteral(right);
}

function isBroadcastLiteral(argument: TypedExpression): boolean {
  return argument.expression.kind === 'literal' && grainOf(argument.type).length === 0 && argument.expression.value !== null;
}

function scalarMultiplyUnitsAreSafe(left: TypedExpression, right: TypedExpression): boolean {
  const leftUnit = left.type.unit;
  const rightUnit = right.type.unit;
  if (leftUnit === undefined && rightUnit === undefined) return true;
  if (leftUnit !== undefined && rightUnit !== undefined) return false;
  const scalar = leftUnit === undefined ? left : right;
  return isDimensionlessLiteral(scalar);
}

function sameComparisonValueKind(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value) return false;
  return isNumericType(left) || left.value === 'boolean' || left.value === 'text' || left.value === 'date' || left.value === 'instant';
}

function stableJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? '';
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(record[key])}`).join(',')}}`;
}

function fieldEntity(node: Extract<Expression, {kind: 'field'}>): string | undefined {
  const candidate = node as Extract<Expression, {kind: 'field'}> & {readonly entity?: unknown};
  return typeof candidate.entity === 'string' ? candidate.entity : undefined;
}
