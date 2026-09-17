import type { ResultRef } from './types.js';

export type CanonicalCache = WeakMap<object, string>;

export function stableJson(value: unknown, cache?: CanonicalCache): string {
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? '';
  const cached = cache?.get(value);
  if (cached !== undefined) return cached;
  const serialized = Array.isArray(value)
    ? `[${value.map((item) => stableJson(item, cache)).join(',')}]`
    : `{${Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key], cache)}`)
        .join(',')}}`;
  cache?.set(value, serialized);
  return serialized;
}

export const versionRefKey = (ref: { readonly id: string; readonly revision: string }): string =>
  JSON.stringify([ref.id, ref.revision]);

export const resultRefKey = (ref: ResultRef): string =>
  JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);

export function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sameVersionRef(
  left: { readonly id: string; readonly revision: string },
  right: { readonly id: string; readonly revision: string },
): boolean {
  return versionRefKey(left) === versionRefKey(right);
}
