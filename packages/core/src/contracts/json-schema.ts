import * as z from 'zod/mini';
import {contractSchemas} from './schemas.js';
import {CONTRACT_VERSION, WIRE_LIMITS} from './limits.js';
import type {ContractKind} from './types.js';

const cache = new Map<ContractKind, Readonly<Record<string, unknown>>>();

function addBounds(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.prefixItems) && record.prefixItems.length === 0) delete record.prefixItems;
  if (record.type === 'object') {
    record.maxProperties ??= WIRE_LIMITS.properties;
    const keyBounds = {maxLength: WIRE_LIMITS.id, not: {const: '__proto__'}};
    record.propertyNames = record.propertyNames === undefined ? keyBounds : {allOf: [record.propertyNames, keyBounds]};
  }
  if (record.type === 'array') record.maxItems ??= WIRE_LIMITS.array;
  if (record.type === 'string') record.maxLength ??= WIRE_LIMITS.text;
  for (const child of Object.values(record)) addBounds(child);
}

function freeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  return Object.freeze(value);
}

/** JSON Schema derived from the exact runtime contract used by parseContract. */
export function contractJsonSchema(kind: ContractKind): Readonly<Record<string, unknown>> {
  const existing = cache.get(kind);
  if (existing !== undefined) return existing;
  // Zod's returned object carries non-wire Standard Schema metadata. JSON
  // round-tripping retains only the published JSON Schema document.
  const document = JSON.parse(JSON.stringify(z.toJSONSchema(contractSchemas[kind], {target: 'draft-2020-12'}))) as Record<string, unknown>;
  addBounds(document);
  document.$id = `https://aeliqo.com/schemas/${CONTRACT_VERSION}/${kind}.schema.json`;
  document.$comment = 'Shape contract only. Authority, binding, and effect validation are separate.';
  const result = freeze(document);
  cache.set(kind, result);
  return result;
}
