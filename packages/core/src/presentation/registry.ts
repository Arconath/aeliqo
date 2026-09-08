import * as z from 'zod/mini';
import {inspectWire} from '../contracts/ingress.js';
import {idSchema, versionRefSchema} from '../contracts/schemas.js';
import {WIRE_LIMITS} from '../contracts/limits.js';
import type {Outcome} from '../contracts/types.js';
import {validateInteractionGraph, interactionMappingManifestSchema} from '../interaction/graph.js';
import type {InteractionMappingManifest} from '../interaction/graph.js';
import type {PresentationManifest, PresentationRegistry} from './types.js';

export const presentationFailure = (code: string, message: string): Outcome<never> => ({ok: false,
  diagnostics: [{code: `presentation.${code}`, message, retryable: false}]});
export const versionKey = (ref: {readonly id: string; readonly revision: string}): string => JSON.stringify([ref.id, ref.revision]);
export function freezePresentation<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezePresentation(child);
    Object.freeze(value);
  }
  return value;
}
const bound = z.int().check(z.minimum(0), z.maximum(WIRE_LIMITS.presentationNodes));
const manifestSchema = z.strictObject({
  ref: versionRefSchema, configSchema: versionRefSchema,
  roles: z.array(idSchema).check(z.minLength(1), z.maxLength(128)),
  operations: z.array(versionRefSchema).check(z.maxLength(128)),
  result: z.enum(['required', 'optional', 'none']), children: z.strictObject({min: bound, max: bound}),
  visibility: z.enum(['simultaneous', 'exclusive', 'leaf']), extension: z.boolean(),
});

/** Registry installation is trusted local code, not a serializable proposal operation. */
export function createPresentationRegistry(
  input: readonly PresentationManifest[], mappings: readonly InteractionMappingManifest[] = [],
): Outcome<PresentationRegistry> {
  if (!Array.isArray(input) || input.length === 0 || input.length > WIRE_LIMITS.presentationNodes)
    return presentationFailure('registry', 'A bounded nonempty representation registry is required.');
  const manifests: PresentationManifest[] = [];
  const seen = new Set<string>();
  try {
    for (const manifest of input) {
      const {resolveConfig, suggestConfig, ...metadata} = manifest;
      if (typeof resolveConfig !== 'function' || (suggestConfig !== undefined && typeof suggestConfig !== 'function'))
        return presentationFailure('registry', 'Representation configuration handlers must be registered local functions.');
      const wire = inspectWire(metadata);
      if (!wire.ok) return wire;
      const parsed = z.safeParse(manifestSchema, wire.value);
      if (!parsed.success) return presentationFailure('registry', 'Representation metadata does not match the bounded registry contract.');
      const m = parsed.data;
      if (seen.has(versionKey(m.ref)) || new Set(m.roles).size !== m.roles.length || new Set(m.operations.map(versionKey)).size !== m.operations.length
        || m.children.min > m.children.max || (m.visibility === 'leaf' && m.children.max !== 0))
        return presentationFailure('registry', 'Representation identities, operations, roles or child bounds are inconsistent.');
      seen.add(versionKey(m.ref));
      manifests.push(freezePresentation({...m, resolveConfig, ...(suggestConfig === undefined ? {} : {suggestConfig})}));
    }
  } catch {
    return presentationFailure('registry', 'Representation registration failed.');
  }
  const graph = validateInteractionGraph({nodes: [], links: []}, mappings);
  if (!graph.ok) return graph;
  const wire = inspectWire(mappings);
  if (!wire.ok) return wire;
  const ownedMappings = z.safeParse(z.array(interactionMappingManifestSchema), wire.value);
  if (!ownedMappings.success) return presentationFailure('registry', 'The registered mappings are malformed.');
  return {ok: true, value: freezePresentation({manifests, mappings: ownedMappings.data as unknown as readonly InteractionMappingManifest[]})};
}
