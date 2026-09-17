import * as z from 'zod/mini';
import { idSchema, jsonSchema, versionRefSchema } from '../../contracts/schemas.js';
import { WIRE_LIMITS } from '../../contracts/limits.js';
import type { Outcome, VersionRef } from '../../contracts/types.js';
import type { PresentationQuality, PresentationValues, ResolvedPresentationConfig } from '../types.js';
import { freezePresentation, isThenable, presentationFailure as fail, versionKey } from '../registry.js';
import type { PresentationValidationCache } from './types.js';
import { callbackOutcome } from './shared.js';

const MAX_MEASURED_MICROSECONDS = 1_000_000_000_000;
const EMPTY_RESOLVED_LIST = Object.freeze([]) as readonly never[];
const resolvedSchema = z.strictObject({
  values: z.record(z.string(), jsonSchema),
  fields: z.array(idSchema).check(z.maxLength(WIRE_LIMITS.array)),
  ports: z.array(z.unknown()).check(z.maxLength(128)),
  operations: z.optional(z.array(versionRefSchema).check(z.maxLength(WIRE_LIMITS.array))),
});
const qualitySchema = z.strictObject({
  taskFit: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  informationDensity: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  interactionEffort: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  legibilityPenalty: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
  cost: z.optional(
    z.strictObject({
      microseconds: z.number().check(z.int(), z.minimum(0), z.maximum(MAX_MEASURED_MICROSECONDS)),
      measurement: versionRefSchema,
    }),
  ),
});

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isEmptyArrayDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) return false;
  const list: unknown = descriptor.value;
  return (
    Array.isArray(list) &&
    Object.getPrototypeOf(list) === Array.prototype &&
    Reflect.ownKeys(list).length === 1 &&
    list.length === 0
  );
}

function hasExactEmptyConfig(config: unknown, values: PresentationValues): boolean {
  if (!isPlainRecord(config)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(config);
  if (
    Reflect.ownKeys(descriptors).length !== 4 ||
    descriptors.values?.value !== values ||
    !descriptors.values.enumerable
  )
    return false;
  return (['fields', 'ports', 'operations'] as const).every((key) => isEmptyArrayDescriptor(descriptors[key]));
}

/** Fast path only for the exact accessor-free empty layout shape owned by the supplied values. */
function ownedEmptyConfigOutcome(raw: unknown, values: PresentationValues): ResolvedPresentationConfig | undefined {
  try {
    if (isThenable(raw) || !isPlainRecord(raw)) return undefined;
    const outer = Object.getOwnPropertyDescriptors(raw);
    if (
      Reflect.ownKeys(outer).length !== 2 ||
      outer.ok?.value !== true ||
      !outer.ok.enumerable ||
      !outer.value?.enumerable ||
      !('value' in outer.value)
    )
      return undefined;
    if (!hasExactEmptyConfig(outer.value.value, values)) return undefined;
    return { values, fields: EMPTY_RESOLVED_LIST, ports: EMPTY_RESOLVED_LIST, operations: EMPTY_RESOLVED_LIST };
  } catch {
    return undefined;
  }
}

function appendFrozenDataChildren(value: object, pending: object[]): boolean {
  if (!Object.isFrozen(value)) return false;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) return false;
    const child: unknown = descriptor.value;
    if (child !== null && typeof child === 'object') pending.push(child);
  }
  return true;
}

/** A shared callback object is reusable only if every reachable value is frozen data. */
function isRecursivelyFrozenOutcome(value: object): boolean {
  const pending: object[] = [value];
  const seen = new WeakSet<object>();
  try {
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      if (!appendFrozenDataChildren(current, pending)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function parseResolvedConfig(
  raw: unknown,
  values: PresentationValues,
  cache: PresentationValidationCache,
): Outcome<ResolvedPresentationConfig> {
  const cached = raw !== null && typeof raw === 'object' ? cache.resolvedConfigs.get(raw) : undefined;
  if (cached !== undefined) return { ok: true, value: cached };

  const ownedEmpty = ownedEmptyConfigOutcome(raw, values);
  if (ownedEmpty !== undefined) return { ok: true, value: ownedEmpty };

  const outcome = callbackOutcome(raw, 'configuration', 'The registered configuration validator failed.');
  if (!outcome.ok) return outcome;
  const parsed = z.safeParse(resolvedSchema, outcome.value);
  if (!parsed.success) return failConfiguration();

  const config = parsed.data as ResolvedPresentationConfig;
  if (raw !== null && typeof raw === 'object' && isRecursivelyFrozenOutcome(raw)) {
    const owned = freezePresentation(config);
    cache.resolvedConfigs.set(raw, owned);
    return { ok: true, value: owned };
  }
  return { ok: true, value: config };
}

function failConfiguration(): Outcome<never> {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'presentation.configuration',
        message: 'The registered configuration result is malformed.',
        retryable: false,
      },
    ],
  };
}

export function validateResolvedConfig(
  config: ResolvedPresentationConfig,
  operations: readonly VersionRef[],
  allowedOperations: ReadonlySet<string> | undefined,
  resultFields: ReadonlySet<string> | undefined,
  resultAvailable: boolean,
): Outcome<readonly VersionRef[]> {
  if (new Set(config.fields).size !== config.fields.length) return failConfiguration();
  const enabled = config.operations ?? operations;
  if (
    new Set(enabled.map(versionKey)).size !== enabled.length ||
    enabled.some((op) => !operations.some((declared) => versionKey(op) === versionKey(declared)))
  )
    return fail('configuration', 'Enabled operations must be a unique subset of the registered manifest.');
  if (allowedOperations !== undefined && enabled.some((op) => !allowedOperations.has(versionKey(op))))
    return fail('restricted', 'The representation exposes an operation restricted by the active experience.');
  if (config.fields.some((field) => !resultAvailable || !resultFields?.has(field)))
    return fail('field', 'A representation refers to a field absent from its result.');
  return { ok: true, value: enabled };
}

export function parsePresentationQuality(raw: unknown): Outcome<PresentationQuality> {
  const outcome = callbackOutcome(raw, 'quality', 'The registered presentation assessor failed.');
  if (!outcome.ok) return outcome;
  const parsed = z.safeParse(qualitySchema, outcome.value);
  if (!parsed.success)
    return fail('quality', 'A presentation quality assessment is malformed or outside its bounded ordinal contract.');
  if (parsed.data.cost !== undefined && !Number.isSafeInteger(parsed.data.cost.microseconds))
    return fail('quality', 'A measured presentation cost must be a finite safe integer.');
  return { ok: true, value: freezePresentation(parsed.data as PresentationQuality) };
}
