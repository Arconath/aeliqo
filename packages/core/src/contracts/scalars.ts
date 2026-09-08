/** Pure value semantics. Date receives explicit values; no global clock is read. */
import {WIRE_LIMITS} from './limits.js';
import type {Outcome, Scalar, SemanticType} from './types.js';

const bad = (): Outcome<never> => ({ok: false, diagnostics: [{code: 'scalar.invalid', message: 'The value does not satisfy its declared scalar type and bounds.', retryable: false}]});
const ordered = (left: number | bigint | string, right: typeof left): -1 | 0 | 1 => left < right ? -1 : left > right ? 1 : 0;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
}

/** Retain all fractional digits; parsing the full instant would truncate precision. */
export function scalarInstantParts(value: string): {readonly milliseconds: number; readonly fraction: string} | undefined {
  if (typeof value !== 'string' || value.length > WIRE_LIMITS.text) return undefined;
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (!parts || !validDate(parts[1]!)) return undefined;
  if (Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59) return undefined;
  if (parts[7] !== undefined && (Number(parts[7]) > 23 || Number(parts[8]) > 59)) return undefined;
  const milliseconds = Date.parse(`${parts[1]}T${parts[2]}:${parts[3]}:${parts[4]}${parts[6]}`);
  if (!Number.isSafeInteger(milliseconds)) return undefined;
  return {milliseconds, fraction: (parts[5] ?? '').replace(/0+$/u, '')};
}

function decimalText(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return undefined;
  if (Reflect.ownKeys(value).length !== 1) return undefined;
  const member = Object.getOwnPropertyDescriptor(value, 'decimal');
  if (!member || !('value' in member) || typeof member.value !== 'string') return undefined;
  const text: string = member.value;
  return text.length <= 512 && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(text) ? text : undefined;
}

/** Clone decimal objects; do not retain caller-owned mutable objects or invoke accessors. */
export function validateScalar(value: unknown, type: SemanticType): Outcome<Scalar> {
  try {
    if (type === null || typeof type !== 'object' || typeof type.nullable !== 'boolean' ||
      !['text','boolean','integer','float','decimal','date','instant'].includes(type.value)) return bad();
    if (value === null) return type.nullable ? {ok: true, value: null} : bad();
    switch (type.value) {
      case 'text': return typeof value === 'string' && value.length <= WIRE_LIMITS.text ? {ok: true, value} : bad();
      case 'boolean': return typeof value === 'boolean' ? {ok: true, value} : bad();
      case 'integer': return typeof value === 'number' && Number.isSafeInteger(value) ? {ok: true, value} : bad();
      case 'float': return typeof value === 'number' && Number.isFinite(value) ? {ok: true, value} : bad();
      case 'decimal': {
        const text = decimalText(value);
        return text === undefined ? bad() : {ok: true, value: Object.freeze({decimal: text})};
      }
      case 'date': return typeof value === 'string' && validDate(value) ? {ok: true, value} : bad();
      case 'instant': return typeof value === 'string' && scalarInstantParts(value) !== undefined ? {ok: true, value} : bad();
    }
  } catch {return bad();}
}

function decimalParts(value: string): {coefficient: bigint; scale: number} {
  const [whole, fraction = ''] = value.split('.');
  return {coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length};
}

function normalizeDecimal(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/u, '');
  if ((whole === '0' || whole === '-0') && trimmed.length === 0) return '0';
  return `${whole}${trimmed ? `.${trimmed}` : ''}`;
}

/** SQL three-valued comparison: null denotes unknown, independently of sort null placement. */
export function compareScalars(left: unknown, right: unknown, type: SemanticType): Outcome<-1 | 0 | 1 | null> {
  const a = validateScalar(left, type); if (!a.ok) return a;
  const b = validateScalar(right, type); if (!b.ok) return b;
  if (a.value === null || b.value === null) return {ok: true, value: null};
  if (type.value === 'decimal') {
    const l = decimalParts((a.value as {decimal: string}).decimal);
    const r = decimalParts((b.value as {decimal: string}).decimal);
    const scale = Math.max(l.scale, r.scale);
    return {ok: true, value: ordered(l.coefficient * 10n ** BigInt(scale - l.scale), r.coefficient * 10n ** BigInt(scale - r.scale))};
  }
  if (type.value === 'instant') {
    const l = scalarInstantParts(a.value as string)!; const r = scalarInstantParts(b.value as string)!;
    const seconds = ordered(l.milliseconds, r.milliseconds);
    const length = Math.max(l.fraction.length, r.fraction.length);
    return {ok: true, value: seconds || ordered(l.fraction.padEnd(length, '0'), r.fraction.padEnd(length, '0'))};
  }
  if (type.value === 'boolean') return {ok: true, value: ordered(Number(a.value), Number(b.value))};
  if (type.value === 'text') {
    const l = [...a.value as string]; const r = [...b.value as string];
    for (let index = 0; index < Math.min(l.length, r.length); index++) {
      const comparison = ordered(l[index]!.codePointAt(0)!, r[index]!.codePointAt(0)!);
      if (comparison) return {ok: true, value: comparison};
    }
    return {ok: true, value: ordered(l.length, r.length)};
  }
  return {ok: true, value: ordered(a.value as number | string, b.value as number | string)};
}

/** Collision-free component key; callers encode composite identities as tuples of these keys. */
export function scalarIdentity(value: unknown, type: SemanticType): Outcome<string> {
  const checked = validateScalar(value, type); if (!checked.ok) return checked;
  let identity: unknown = checked.value;
  if (identity !== null && type.value === 'decimal') identity = normalizeDecimal((checked.value as {decimal: string}).decimal);
  if (identity !== null && type.value === 'instant') {
    const parts = scalarInstantParts(checked.value as string)!;
    identity = [parts.milliseconds, parts.fraction];
  }
  return {ok: true, value: JSON.stringify([type.value, identity])};
}
