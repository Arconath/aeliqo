import { validateScalar, type Scalar, type SemanticType } from '@aeliqo/core';

export const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

export const bounded = (value: unknown, max = 512, required = true): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  (!required || value.length > 0) &&
  !/[\u0000-\u001f\u007f]/u.test(value);

export const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

function validSemanticBase(candidate: Record<string, unknown>): boolean {
  return (
    exactKeys(candidate, ['value', 'nullable', 'unit', 'grain', 'temporal']) &&
    ['text', 'boolean', 'integer', 'float', 'decimal', 'date', 'instant'].includes(String(candidate.value)) &&
    typeof candidate.nullable === 'boolean'
  );
}

function validSemanticUnit(value: unknown): boolean {
  if (value === undefined) return true;
  const unit = record(value);
  if (unit === undefined) return false;
  return (
    exactKeys(unit, ['dimension', 'symbol', 'currency']) &&
    bounded(unit.dimension, 160) &&
    bounded(unit.symbol, 160) &&
    (unit.currency === undefined || bounded(unit.currency, 160))
  );
}

function validSemanticGrain(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => bounded(item, 160)) && new Set(value).size === value.length;
}

function validSemanticTemporal(value: unknown, semanticValue: unknown): boolean {
  if (value === undefined) return true;
  const temporal = record(value);
  if (temporal === undefined) return false;
  return (
    exactKeys(temporal, ['calendar', 'timezone', 'grain']) &&
    bounded(temporal.calendar, 160) &&
    (temporal.timezone === undefined || bounded(temporal.timezone, 160)) &&
    (temporal.grain === undefined || bounded(temporal.grain, 160)) &&
    ['date', 'instant'].includes(String(semanticValue))
  );
}

function semanticType(value: unknown): value is SemanticType {
  const candidate = record(value);
  if (candidate === undefined || !validSemanticBase(candidate)) return false;
  return (
    validSemanticUnit(candidate.unit) &&
    validSemanticGrain(candidate.grain) &&
    validSemanticTemporal(candidate.temporal, candidate.value)
  );
}

export function validRef(value: unknown): value is { readonly id: string; readonly revision: string } {
  const candidate = record(value);
  return (
    candidate !== undefined &&
    Object.keys(candidate).length === 2 &&
    bounded(candidate.id, 160) &&
    bounded(candidate.revision, 160)
  );
}

export function scalarType(value: unknown): SemanticType | undefined {
  if (!semanticType(value)) return undefined;
  return value;
}

function numberScalar(raw: unknown, type: SemanticType): Scalar | undefined {
  if (typeof raw !== 'string' || !/^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(raw)) return undefined;
  const candidate: unknown = type.value === 'decimal' ? { decimal: raw } : Number(raw);
  const checked = validateScalar(candidate, type);
  return checked.ok ? checked.value : undefined;
}

export function scalar(raw: unknown, type: SemanticType, numericText = false): Scalar | undefined {
  if (numericText) return numberScalar(raw, type);
  const checked = validateScalar(raw, type);
  return checked.ok ? checked.value : undefined;
}

function sameUnit(left: SemanticType, right: SemanticType): boolean {
  if (left.unit === undefined || right.unit === undefined) return left.unit === right.unit;
  return (
    left.unit.dimension === right.unit.dimension &&
    left.unit.symbol === right.unit.symbol &&
    left.unit.currency === right.unit.currency
  );
}

function sameGrain(left: SemanticType, right: SemanticType): boolean {
  const leftGrain = left.grain ?? [];
  const rightGrain = right.grain ?? [];
  return leftGrain.length === rightGrain.length && leftGrain.every((item, index) => item === rightGrain[index]);
}

function sameTemporal(left: SemanticType, right: SemanticType): boolean {
  if (left.temporal === undefined || right.temporal === undefined) return left.temporal === right.temporal;
  return (
    left.temporal.calendar === right.temporal.calendar &&
    left.temporal.timezone === right.temporal.timezone &&
    left.temporal.grain === right.temporal.grain
  );
}

export function sameSemanticType(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value || left.nullable !== right.nullable) return false;
  return sameUnit(left, right) && sameGrain(left, right) && sameTemporal(left, right);
}

type DecimalNumber = { readonly coefficient: bigint; readonly scale: number };
type OptionalDecimal =
  { readonly kind: 'none' | 'invalid' } | { readonly kind: 'value'; readonly value: DecimalNumber };

function decimalInput(value: unknown): string | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return String(value);
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return undefined;
  return value;
}

function decimalParts(matched: RegExpExecArray): DecimalNumber | undefined {
  const exponent = Number(matched[5] ?? '0');
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1024) return undefined;
  const whole = matched[2] ?? '0';
  let fraction = '';
  if (matched[3] !== undefined) fraction = matched[3];
  else if (matched[4] !== undefined) fraction = matched[4];
  const sign = matched[1] === '-' ? -1n : 1n;
  let coefficient = BigInt(`${whole}${fraction}` || '0') * sign;
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function decimalNumber(value: unknown): DecimalNumber | undefined {
  const source = decimalInput(value);
  if (source === undefined) return undefined;
  const matched = /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/u.exec(source);
  if (matched === null) return undefined;
  return decimalParts(matched);
}

function optionalDecimal(value: unknown): OptionalDecimal {
  if (value === undefined || value === '') return { kind: 'none' };
  const parsed = decimalNumber(value);
  if (parsed === undefined) return { kind: 'invalid' };
  return { kind: 'value', value: parsed };
}

function decimalCompare(left: DecimalNumber, right: DecimalNumber): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * 10n ** BigInt(scale - left.scale);
  const b = right.coefficient * 10n ** BigInt(scale - right.scale);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function decimalOnStep(
  value: DecimalNumber,
  minimum: DecimalNumber | undefined,
  step: DecimalNumber | undefined,
): boolean {
  if (step === undefined) return true;
  if (step.coefficient <= 0n) return false;
  const base = minimum ?? { coefficient: 0n, scale: 0 };
  const scale = Math.max(value.scale, base.scale, step.scale);
  const delta =
    value.coefficient * 10n ** BigInt(scale - value.scale) - base.coefficient * 10n ** BigInt(scale - base.scale);
  const increment = step.coefficient * 10n ** BigInt(scale - step.scale);
  return delta % increment === 0n;
}

function valueWithinBounds(value: DecimalNumber, minimum: OptionalDecimal, maximum: OptionalDecimal): boolean {
  if (minimum.kind === 'value' && decimalCompare(value, minimum.value) < 0) return false;
  if (maximum.kind === 'value' && decimalCompare(value, maximum.value) > 0) return false;
  return true;
}

export function boundedStep(value: unknown, minimum: unknown, maximum: unknown, step: unknown): boolean {
  const parsed = decimalNumber(value);
  if (parsed === undefined) return false;
  const min = optionalDecimal(minimum);
  const max = optionalDecimal(maximum);
  const increment = optionalDecimal(step);
  if (min.kind === 'invalid' || max.kind === 'invalid' || increment.kind === 'invalid') return false;
  if (!valueWithinBounds(parsed, min, max)) return false;
  const minValue = min.kind === 'value' ? min.value : undefined;
  const incrementValue = increment.kind === 'value' ? increment.value : undefined;
  return decimalOnStep(parsed, minValue, incrementValue);
}
