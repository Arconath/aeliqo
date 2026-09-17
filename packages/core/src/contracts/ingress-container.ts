import { wireFailure } from '../diagnostics/wire.js';
import { WIRE_LIMITS as L } from './limits.js';
import type { Outcome } from './types.js';
import { pathParts, type WirePath } from './ingress-walk-types.js';

export type WireContainer = { readonly isArray: boolean; readonly keys: PropertyKey[] };
export type WireProperty = { readonly key: string; readonly value: unknown };

export function inspectContainer(current: object, path: WirePath | undefined): Outcome<WireContainer> {
  const isArray = Array.isArray(current);
  const prototype = Object.getPrototypeOf(current) as unknown;
  if (prototype !== (isArray ? Array.prototype : Object.prototype) && !(prototype === null && !isArray))
    return wireFailure('wire.object', 'Only plain JSON objects and arrays are accepted.', pathParts(path));

  const keys = Reflect.ownKeys(current);
  if (isArray && current.length > L.array)
    return wireFailure('wire.array', 'A wire array exceeds its item limit.', pathParts(path));
  if (!isArray && keys.length > L.properties)
    return wireFailure('wire.properties', 'A wire object exceeds its property limit.', pathParts(path));
  if (isArray && keys.length !== current.length + 1)
    return wireFailure('wire.array', 'Sparse arrays and extra array properties are not accepted.', pathParts(path));
  return { ok: true, value: { isArray, keys } };
}

function isArrayIndex(key: string, length: number): boolean {
  return /^(?:0|[1-9][0-9]*)$/.test(key) && Number(key) < length;
}

export function inspectProperty(
  current: object,
  key: PropertyKey,
  isArray: boolean,
  path: WirePath | undefined,
): Outcome<WireProperty | undefined> {
  if (typeof key !== 'string') return wireFailure('wire.key', 'Symbol keys are not wire data.', pathParts(path));
  if (isArray && key === 'length') return { ok: true, value: undefined };
  if (key.length > L.id || key === '__proto__')
    return wireFailure('wire.key', 'A wire property name is not supported.', pathParts(path));
  if (isArray && !isArrayIndex(key, (current as unknown[]).length))
    return wireFailure('wire.array', 'Extra array properties are not accepted.', pathParts(path));

  const descriptor = Object.getOwnPropertyDescriptor(current, key);
  if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
    return wireFailure('wire.accessor', 'Accessors and hidden properties are not wire data.', [
      ...pathParts(path),
      key,
    ]);
  return { ok: true, value: { key, value: descriptor.value as unknown } };
}
