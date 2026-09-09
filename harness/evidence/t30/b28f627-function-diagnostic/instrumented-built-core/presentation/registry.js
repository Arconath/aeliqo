import * as z from 'zod/mini';
import { inspectWire } from '../contracts/ingress.js';
import { idSchema, versionRefSchema } from '../contracts/schemas.js';
import { WIRE_LIMITS } from '../contracts/limits.js';
import { validateInteractionGraph, interactionMappingManifestSchema } from '../interaction/graph.js';
export const presentationFailure = (code, message) => ({ ok: false,
    diagnostics: [{ code: `presentation.${code}`, message, retryable: false }] });
export const versionKey = (ref) => JSON.stringify([ref.id, ref.revision]);
/** Pattern IDs are allowlisted by ID in Experience, so revisions cannot be ambiguous. */
export const PRESENTATION_PATTERN_LIMIT = 64;
export const isThenable = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
        return false;
    try {
        return typeof value.then === 'function';
    }
    catch {
        return true;
    }
};
// Cache only graphs recursively frozen by this function, never arbitrary shallow-frozen input.
const ownedFrozenGraphs = new WeakSet();
function freezePresentationOriginal(value) {
    if (value !== null && typeof value === 'object' && !ownedFrozenGraphs.has(value)) {
        for (const child of Object.values(value))
            freezePresentation(child);
        Object.freeze(value);
        ownedFrozenGraphs.add(value);
    }
    return value;
}
const bound = z.int().check(z.minimum(0), z.maximum(WIRE_LIMITS.presentationNodes));
const manifestSchema = z.strictObject({
    ref: versionRefSchema, configSchema: versionRefSchema,
    roles: z.array(idSchema).check(z.minLength(1), z.maxLength(128)),
    operations: z.array(versionRefSchema).check(z.maxLength(128)),
    result: z.enum(['required', 'optional', 'none']), children: z.strictObject({ min: bound, max: bound }),
    visibility: z.enum(['simultaneous', 'exclusive', 'leaf']), extension: z.boolean(),
});
export const stateMappingSchema = z.strictObject({ ref: versionRefSchema, from: versionRefSchema, to: versionRefSchema, fromRole: idSchema, toRole: idSchema, kind: z.enum(['transfer', 'archive']) });
const patternSchema = z.strictObject({ ref: versionRefSchema });
/** Registry installation is trusted local code, not a serializable proposal operation. */
export function createPresentationRegistry(input, mappings = [], patterns = [], stateMappings = []) {
    if (!Array.isArray(input) || input.length === 0 || input.length > WIRE_LIMITS.presentationNodes)
        return presentationFailure('registry', 'A bounded nonempty representation registry is required.');
    if (!Array.isArray(patterns) || patterns.length > PRESENTATION_PATTERN_LIMIT)
        return presentationFailure('registry', 'A bounded pattern registry is required.');
    const manifests = [];
    const seen = new Set();
    try {
        for (const manifest of input) {
            const { resolveConfig, suggestConfig, assess, ...metadata } = manifest;
            if (typeof resolveConfig !== 'function' || (suggestConfig !== undefined && typeof suggestConfig !== 'function')
                || (assess !== undefined && typeof assess !== 'function'))
                return presentationFailure('registry', 'Representation configuration handlers must be registered local functions.');
            const wire = inspectWire(metadata);
            if (!wire.ok)
                return wire;
            const parsed = z.safeParse(manifestSchema, wire.value);
            if (!parsed.success)
                return presentationFailure('registry', 'Representation metadata does not match the bounded registry contract.');
            const m = parsed.data;
            if (seen.has(versionKey(m.ref)) || new Set(m.roles).size !== m.roles.length || new Set(m.operations.map(versionKey)).size !== m.operations.length
                || m.children.min > m.children.max || (m.visibility === 'leaf' && m.children.max !== 0))
                return presentationFailure('registry', 'Representation identities, operations, roles or child bounds are inconsistent.');
            seen.add(versionKey(m.ref));
            manifests.push(freezePresentation({ ...m, resolveConfig, ...(suggestConfig === undefined ? {} : { suggestConfig }), ...(assess === undefined ? {} : { assess }) }));
        }
    }
    catch {
        return presentationFailure('registry', 'Representation registration failed.');
    }
    const ownedPatterns = [];
    const patternIds = new Set();
    try {
        for (const pattern of patterns) {
            const { expand, matches, ...metadata } = pattern;
            if (typeof expand !== 'function' || typeof matches !== 'function')
                return presentationFailure('registry', 'Pattern expanders and matchers must be registered local functions.');
            const wire = inspectWire(metadata);
            if (!wire.ok)
                return wire;
            const parsed = z.safeParse(patternSchema, wire.value);
            if (!parsed.success || patternIds.has(parsed.data.ref.id))
                return presentationFailure('registry', 'Pattern references must be valid and unique by ID.');
            patternIds.add(parsed.data.ref.id);
            ownedPatterns.push(freezePresentation({ ...parsed.data, expand, matches }));
        }
    }
    catch {
        return presentationFailure('registry', 'Pattern registration failed.');
    }
    const stateWire = inspectWire(stateMappings);
    if (!stateWire.ok)
        return stateWire;
    const stateParsed = z.safeParse(z.array(stateMappingSchema).check(z.maxLength(128)), stateWire.value);
    if (!stateParsed.success || new Set(stateParsed.data.map(m => versionKey(m.ref))).size !== stateParsed.data.length
        || stateParsed.data.some(m => m.ref.id === 'aeliqo.state.identity' || !seen.has(versionKey(m.from)) || !seen.has(versionKey(m.to))
            || !manifests.find(n => versionKey(n.ref) === versionKey(m.from)).roles.includes(m.fromRole)
            || !manifests.find(n => versionKey(n.ref) === versionKey(m.to)).roles.includes(m.toRole)
            || (m.kind === 'transfer' && m.fromRole !== m.toRole)))
        return presentationFailure('registry', 'State mappings must be unique registered representation/role pairs.');
    const mappingWire = inspectWire(mappings);
    if (!mappingWire.ok)
        return mappingWire;
    const ownedMappings = z.safeParse(z.array(interactionMappingManifestSchema), mappingWire.value);
    if (!ownedMappings.success)
        return presentationFailure('registry', 'The registered mappings are malformed.');
    const mappingValues = ownedMappings.data;
    const graph = validateInteractionGraph({ nodes: [], links: [] }, mappingValues);
    if (!graph.ok)
        return graph;
    return { ok: true, value: freezePresentation({ manifests, mappings: mappingValues, patterns: ownedPatterns, stateMappings: stateParsed.data }) };
}

let freezePresentationDepth=0;
export function freezePresentation(...args) {const outer=freezePresentationDepth++===0;const start=outer?performance.now():0;try{return freezePresentationOriginal(...args);}finally{freezePresentationDepth--;if(outer){const stats=globalThis.__functionDiagnostic??=Object.create(null);const entry=stats['freezePresentation']??={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;stats['freezePresentation']=entry;}}}
