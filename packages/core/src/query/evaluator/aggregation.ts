import type { Expression, Outcome, SemanticType } from '../../contracts/types.js';
import type { FunctionSignature } from '../../expressions/types.js';
import type { AggregateSpec, QueryOutcome, QueryValue } from '../types.js';
import { failure, relationKey, unsupported, type EvalGroup, type EvalState } from './shared.js';
import { tick } from './execution-budget.js';
import { evaluateCall, evaluateConditional, evaluateExpression, trustedLocalSignature } from './expression-runtime.js';
import { expressionSemanticType, expressionValueType } from './expression-semantics.js';
import { isDecimal, scalarKey } from './value-utils.js';

interface AggregateContext {
  readonly state: EvalState;
  readonly item: AggregateSpec;
  readonly group: EvalGroup;
  readonly signature: FunctionSignature;
  readonly values: readonly (readonly QueryValue[])[];
}

function registeredAggregate(item: AggregateSpec, state: EvalState): Outcome<FunctionSignature> {
  const supplied = state.registry.resolve(item.function);
  if (supplied === undefined)
    return failure('query.function', `Function ${relationKey(item.function)} is not registered.`);
  return trustedLocalSignature(supplied);
}

function isAggregateSignature(signature: FunctionSignature): boolean {
  return ['aggregate', 'ratio-of-sums', 'mean-of-rates'].includes(signature.operation);
}

function evaluateGroupArguments(state: EvalState, item: AggregateSpec, group: EvalGroup): QueryOutcome<QueryValue[][]> {
  const values: QueryValue[][] = item.arguments.map(() => []);
  for (const row of group.rows) {
    for (let index = 0; index < item.arguments.length; index += 1) {
      const expression = item.arguments[index]!;
      const value = evaluateExpression(state, expression, row, group.schema);
      if (!value.ok) return value;
      values[index]!.push(value.value === undefined ? null : value.value);
    }
  }
  return { ok: true, value: values };
}

function evaluateNonAggregateCall(
  state: EvalState,
  item: AggregateSpec,
  group: EvalGroup,
  signature: FunctionSignature,
): QueryOutcome<QueryValue | undefined> {
  const arguments_: QueryValue[] = [];
  for (const expression of item.arguments) {
    const value = evaluateAggregateExpression(state, expression, group);
    if (!value.ok) return value;
    arguments_.push(value.value === undefined ? null : value.value);
  }
  const types = item.arguments.map((argument) => expressionSemanticType(argument, group.schema, state.registry));
  return evaluateCall(state, signature, arguments_, types);
}

function countValues({ values }: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const first = values[0];
  const count = first === undefined ? 0 : first.filter((value) => value !== null).length;
  return { ok: true, value: count };
}

function countDistinctValues(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const { values, item, group, state } = context;
  const expression = item.arguments[0];
  const type = expression === undefined ? undefined : expressionValueType(expression, group.schema, state.registry);
  const unique = new Set((values[0] ?? []).filter((value) => value !== null).map((value) => scalarKey(value, type)));
  return { ok: true, value: unique.size };
}

function sumAggregateValues(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const { values, item, group, signature, state } = context;
  const inputs = values[0] ?? [];
  if (signature.nullPolicy === 'propagate' && inputs.some((value) => value === null)) return { ok: true, value: null };
  const expression = item.arguments[0];
  if (expression === undefined) return failure('query.aggregate', 'Sum requires an input expression.');
  const type = expressionSemanticType(expression, group.schema, state.registry);
  return sumValues(
    state,
    inputs.filter((value) => value !== null),
    type,
  );
}

function resolveDivision(state: EvalState, policy: FunctionSignature['zeroDenominator']): Outcome<FunctionSignature> {
  let id: string;
  if (policy === 'error') id = 'core.divide.error';
  else if (policy === 'unknown') id = 'core.divide.unknown';
  else id = 'core.divide.null';
  const candidate = state.registry.resolve({ id, revision: '1' });
  if (candidate === undefined) return failure('query.function', `Function ${id}@1 is not registered.`);
  return trustedLocalSignature(candidate);
}

function ratioOfSums(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const { state, values, item, group, signature } = context;
  if (values.length < 2)
    return failure('query.aggregate', 'Ratio-of-sums requires numerator and denominator arguments.');
  const numeratorExpression = item.arguments[0];
  const denominatorExpression = item.arguments[1];
  if (numeratorExpression === undefined || denominatorExpression === undefined)
    return failure('query.aggregate', 'Ratio-of-sums requires numerator and denominator arguments.');
  const numerator = sumValues(
    state,
    values[0]!,
    expressionSemanticType(numeratorExpression, group.schema, state.registry),
    true,
  );
  const denominator = sumValues(
    state,
    values[1]!,
    expressionSemanticType(denominatorExpression, group.schema, state.registry),
    true,
  );
  if (!numerator.ok) return numerator;
  if (!denominator.ok) return denominator;
  if (numerator.value === null || denominator.value === null) return { ok: true, value: null };
  const divide = resolveDivision(state, signature.zeroDenominator);
  if (!divide.ok) return divide;
  return evaluateCall(state, divide.value, [numerator.value, denominator.value]);
}

function meanOfRates(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const { state, values, signature } = context;
  const inputs = values[0] ?? [];
  if (inputs.some((value) => value === null) && signature.nullPolicy === 'propagate') return { ok: true, value: null };
  const numeric: number[] = [];
  for (const value of inputs) {
    if (typeof value === 'number') numeric.push(value);
    else if (isDecimal(value)) {
      const converted = Number(value.decimal);
      if (!Number.isFinite(converted))
        return failure('query.numeric-overflow', 'Decimal mean input exceeded the bounded floating representation.');
      numeric.push(converted);
    }
  }
  if (numeric.length === 0) return { ok: true, value: null };
  state.approximate = true;
  return { ok: true, value: numeric.reduce((sum, value) => sum + value, 0) / numeric.length };
}

function unsupportedAggregate(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const { signature } = context;
  return unsupported(
    'aggregate-runtime',
    `No trusted local aggregate implementation exists for ${signature.ref.id}@${signature.ref.revision}.`,
  );
}

const AGGREGATE_HANDLERS: Readonly<
  Record<string, (context: AggregateContext) => QueryOutcome<QueryValue | undefined>>
> = {
  'core.aggregate.count': countValues,
  'core.aggregate.count-distinct': countDistinctValues,
  'core.aggregate.sum': sumAggregateValues,
};

function evaluateAggregateResult(context: AggregateContext): QueryOutcome<QueryValue | undefined> {
  const operation = context.signature.operation;
  if (operation === 'ratio-of-sums') return ratioOfSums(context);
  if (operation === 'mean-of-rates' || context.signature.ref.id === 'core.mean-of-rates') return meanOfRates(context);
  const handler = AGGREGATE_HANDLERS[context.signature.ref.id];
  if (handler !== undefined) return handler(context);
  return unsupportedAggregate(context);
}

export function aggregateValues(
  state: EvalState,
  item: AggregateSpec,
  group: EvalGroup,
): QueryOutcome<QueryValue | undefined> {
  const resolved = registeredAggregate(item, state);
  if (!resolved.ok) return resolved;
  const signature = resolved.value;
  if (signature.ref.id === 'core.if') {
    const expression: Expression = { kind: 'call', function: item.function, arguments: item.arguments };
    return evaluateAggregateExpression(state, expression, group);
  }
  if (!isAggregateSignature(signature)) return evaluateNonAggregateCall(state, item, group, signature);
  const charged = tick(state);
  if (!charged.ok) return charged;
  const evaluated = evaluateGroupArguments(state, item, group);
  if (!evaluated.ok) return evaluated;
  return evaluateAggregateResult({ state, item, group, signature, values: evaluated.value });
}

function aggregateCall(
  state: EvalState,
  expression: Extract<Expression, { kind: 'call' }>,
  group: EvalGroup,
  signature: FunctionSignature,
): QueryOutcome<QueryValue | undefined> {
  if (isAggregateSignature(signature)) {
    const item: AggregateSpec = {
      id: `nested-${expression.function.id}`,
      function: expression.function,
      arguments: expression.arguments,
    };
    return aggregateValues(state, item, group);
  }
  const arguments_: QueryValue[] = [];
  for (const argument of expression.arguments) {
    const value = evaluateAggregateExpression(state, argument, group);
    if (!value.ok) return value;
    arguments_.push(value.value === undefined ? null : value.value);
  }
  const types = expression.arguments.map((argument) => expressionSemanticType(argument, group.schema, state.registry));
  return evaluateCall(state, signature, arguments_, types);
}

function evaluateAggregateExpression(
  state: EvalState,
  expression: Expression,
  group: EvalGroup,
): QueryOutcome<QueryValue | undefined> {
  if (expression.kind === 'literal') {
    const step = tick(state);
    if (!step.ok) return step;
    return { ok: true, value: expression.value };
  }
  if (expression.kind !== 'call') {
    if (group.rows.length !== 1)
      return unsupported(
        'aggregate-expression',
        'A non-aggregate expression cannot be evaluated over multiple group rows.',
      );
    return evaluateExpression(state, expression, group.rows[0]!, group.schema);
  }
  const resolved = registeredAggregate(
    { id: `nested-${expression.function.id}`, function: expression.function, arguments: expression.arguments },
    state,
  );
  if (!resolved.ok) return resolved;
  if (resolved.value.ref.id === 'core.if')
    return evaluateConditional(state, expression.arguments, (child) =>
      evaluateAggregateExpression(state, child, group),
    );
  return aggregateCall(state, expression, group, resolved.value);
}

function validatedAddition(state: EvalState): Outcome<FunctionSignature> {
  const candidate = state.registry.resolve({ id: 'core.add', revision: '1' });
  if (candidate === undefined) return failure('query.function', 'Function core.add@1 is not registered.');
  return trustedLocalSignature(candidate);
}

function sumIntegers(state: EvalState, values: readonly QueryValue[], allowWide: boolean): Outcome<QueryValue | null> {
  let total = 0n;
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) {
      const charged = tick(state);
      if (!charged.ok) return charged;
    }
    const value = values[index];
    if (value === null) return { ok: true, value: null };
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
      return failure('query.numeric-overflow', 'Integer sum requires exact safe integer inputs.');
    total += BigInt(value);
  }
  if (values.length === 0) return { ok: true, value: null };
  if (total <= BigInt(Number.MAX_SAFE_INTEGER) && total >= BigInt(Number.MIN_SAFE_INTEGER))
    return { ok: true, value: Number(total) };
  if (allowWide) return { ok: true, value: { decimal: String(total) } };
  return failure('query.numeric-overflow', 'Integer sum exceeded the exact safe integer representation.');
}

function sumOtherValues(
  state: EvalState,
  values: readonly QueryValue[],
  type: SemanticType | undefined,
  addition: FunctionSignature | undefined,
): Outcome<QueryValue | null> {
  let total: QueryValue | undefined;
  for (const value of values) {
    if (value === null) return { ok: true, value: null };
    if (typeof value === 'number' && !Number.isSafeInteger(value)) state.approximate = true;
    if (total === undefined) {
      total = value;
      continue;
    }
    if (addition === undefined) return failure('query.function', 'Function core.add@1 is not registered.');
    const added = evaluateCall(state, addition, [total, value], [type, type]);
    if (!added.ok) return added;
    total = added.value;
  }
  return { ok: true, value: total ?? null };
}

export function sumValues(
  state: EvalState,
  values: readonly QueryValue[],
  type: SemanticType | undefined,
  allowWide = false,
): Outcome<QueryValue | null> {
  const addition = values.length > 1 ? validatedAddition(state) : undefined;
  if (addition !== undefined && !addition.ok) return addition;
  const signature = addition?.ok ? addition.value : undefined;
  if (type?.value === 'integer') return sumIntegers(state, values, allowWide);
  return sumOtherValues(state, values, type, signature);
}
