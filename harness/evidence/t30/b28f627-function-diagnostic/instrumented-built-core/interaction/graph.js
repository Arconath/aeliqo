import * as z from 'zod/mini';
import { inspectWire } from '../contracts/ingress.js';
import { WIRE_LIMITS } from '../contracts/limits.js';
import { idSchema, interactionLinkSchema, semanticTypeSchema, versionRefSchema } from '../contracts/schemas.js';
export const INTERACTION_GRAPH_LIMITS = Object.freeze({
    nodes: WIRE_LIMITS.presentationNodes,
    links: WIRE_LIMITS.links,
    portsPerNode: 128,
    totalPorts: 2_048,
    mappings: WIRE_LIMITS.links,
});
const ids = z.array(idSchema).check(z.maxLength(128));
const portShape = {
    payload: z.enum(['selection', 'filter', 'range', 'group', 'page', 'navigate', 'draft', 'action-request', 'extension']),
    entity: z.optional(idSchema),
    identity: z.optional(ids),
    grain: z.optional(ids),
    type: z.optional(semanticTypeSchema),
    /** Only registered extensions may carry the canonical extension payload. */
    extension: z.optional(versionRefSchema),
};
export const interactionPortShapeSchema = z.strictObject(portShape);
export const interactionPortSchema = z.strictObject({
    id: idSchema, direction: z.enum(['input', 'output', 'inout']), ...portShape,
});
export const interactionMappingManifestSchema = z.strictObject({
    ref: versionRefSchema,
    source: interactionPortShapeSchema,
    target: interactionPortShapeSchema,
    kind: z.enum(['identity', 'registered']),
});
export const interactionGraphInputSchema = z.strictObject({
    nodes: z.array(z.strictObject({ id: idSchema,
        ports: z.array(interactionPortSchema).check(z.maxLength(INTERACTION_GRAPH_LIMITS.portsPerNode)),
    })).check(z.maxLength(INTERACTION_GRAPH_LIMITS.nodes)),
    links: z.array(interactionLinkSchema).check(z.maxLength(INTERACTION_GRAPH_LIMITS.links)),
});
const mappingsSchema = z.array(interactionMappingManifestSchema).check(z.maxLength(INTERACTION_GRAPH_LIMITS.mappings));
const failure = (code, message) => ({ ok: false,
    diagnostics: [{ code, message, retryable: false }] });
const endpointKey = (endpoint) => JSON.stringify([endpoint.node, endpoint.port]);
const versionKey = (ref) => JSON.stringify([ref.id, ref.revision]);
function freeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function canonical(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function shapeOf(port) {
    return {
        payload: port.payload,
        ...(port.entity === undefined ? {} : { entity: port.entity }),
        ...(port.identity === undefined ? {} : { identity: port.identity }),
        ...(port.grain === undefined ? {} : { grain: [...port.grain].sort() }),
        ...(port.type === undefined ? {} : { type: { ...port.type,
                ...(port.type.grain === undefined ? {} : { grain: [...port.type.grain].sort() }),
            } }),
        ...(port.extension === undefined ? {} : { extension: port.extension }),
    };
}
function validShape(shape) {
    for (const keys of [shape.identity, shape.grain, shape.type?.grain]) {
        if (keys !== undefined && new Set(keys).size !== keys.length)
            return false;
    }
    if (shape.payload === 'selection' && (shape.entity === undefined || !shape.identity?.length))
        return false;
    if (shape.payload === 'extension' ? shape.extension === undefined : shape.extension !== undefined)
        return false;
    return true;
}
/**
 * Check explicit port links using host-registered semantic manifests. This pure
 * pass does not authorize effects, run mapping callbacks or infer port semantics
 * from a model's declarations. Callers resolve nodes from their trusted component
 * registry and supply registeredMappings separately from proposed links.
 *
 * Identity-equivalence links form selection equivalence classes. Every directed
 * edge between those classes must form a DAG. Runtime propagation implements the
 * identity operation itself; a callback cannot self-certify convergence.
 */
function validateInteractionGraphOriginal(input, registeredMappings) {
    const inputWire = inspectWire(input);
    if (!inputWire.ok)
        return inputWire;
    const registryWire = inspectWire(registeredMappings);
    if (!registryWire.ok)
        return registryWire;
    const parsed = z.safeParse(interactionGraphInputSchema, inputWire.value);
    const registry = z.safeParse(mappingsSchema, registryWire.value);
    if (!parsed.success || !registry.success)
        return failure('interaction.invalid-graph', 'The interaction graph or registered mapping manifests are invalid or exceed their limits.');
    // inspectWire rejected present undefined properties before the schema pass.
    const graph = parsed.data;
    const ports = new Map();
    const nodeIds = new Set();
    for (const node of graph.nodes) {
        if (nodeIds.has(node.id))
            return failure('interaction.duplicate-node', 'Interaction node identities must be unique.');
        nodeIds.add(node.id);
        for (const port of node.ports) {
            const key = endpointKey({ node: node.id, port: port.id });
            if (ports.has(key))
                return failure('interaction.duplicate-port', 'A node cannot register the same interaction port twice.');
            if (!validShape(port))
                return failure('interaction.invalid-port', 'A port requires consistent identity, grain and registered extension semantics.');
            ports.set(key, port);
            if (ports.size > INTERACTION_GRAPH_LIMITS.totalPorts)
                return failure('interaction.graph-budget', 'The graph exceeds its total registered port limit.');
        }
    }
    const mappings = new Map();
    for (const mapping of registry.data) {
        const key = versionKey(mapping.ref);
        if (mappings.has(key))
            return failure('interaction.duplicate-mapping', 'A mapping version can be registered only once.');
        if (!validShape(mapping.source) || !validShape(mapping.target))
            return failure('interaction.invalid-mapping', 'Registered mappings require valid source and target semantics.');
        if (mapping.kind === 'identity' && canonical(shapeOf(mapping.source)) !== canonical(shapeOf(mapping.target)))
            return failure('interaction.invalid-identity', 'An identity mapping cannot change payload, entity, identity, grain, unit or temporal semantics.');
        mappings.set(key, mapping);
    }
    const parents = new Map([...ports.keys()].map(key => [key, key]));
    const find = (key) => {
        let root = key;
        while (parents.get(root) !== root)
            root = parents.get(root);
        while (key !== root) {
            const next = parents.get(key);
            parents.set(key, root);
            key = next;
        }
        return root;
    };
    const usedMappings = new Set();
    const links = new Set();
    const directed = [];
    for (const link of graph.links) {
        if (links.has(link.id))
            return failure('interaction.duplicate-link', 'Interaction link identities must be unique.');
        links.add(link.id);
        const source = ports.get(endpointKey(link.source));
        const target = ports.get(endpointKey(link.target));
        const mapping = mappings.get(versionKey(link.mapping));
        if (source === undefined || target === undefined)
            return failure('interaction.missing-port', 'Every interaction endpoint must name a registered node port.');
        if (source.direction === 'input' || target.direction === 'output')
            return failure('interaction.port-direction', 'A link must connect an emitting port to a receiving port.');
        if (mapping === undefined)
            return failure('interaction.unknown-mapping', 'The requested mapping version is not registered.');
        if (canonical(shapeOf(source)) !== canonical(shapeOf(mapping.source)) || canonical(shapeOf(target)) !== canonical(shapeOf(mapping.target)))
            return failure('interaction.port-mismatch', 'The mapping does not match the declared payload, identity, grain, unit or temporal semantics of both ports.');
        usedMappings.add(versionKey(link.mapping));
        if (link.propagation === 'identity-equivalence') {
            if (mapping.kind !== 'identity' || source.payload !== 'selection' || source.direction !== 'inout' || target.direction !== 'inout')
                return failure('interaction.nonconvergent', 'Selection equivalence requires identity mappings and bidirectional selection ports.');
            parents.set(find(endpointKey(link.target)), find(endpointKey(link.source)));
        }
        else
            directed.push(link);
    }
    const roots = new Set([...ports.keys()].map(find));
    const indegree = new Map([...roots].map(root => [root, 0]));
    const successors = new Map();
    for (const link of directed) {
        const source = find(endpointKey(link.source));
        const target = find(endpointKey(link.target));
        if (source === target)
            return failure('interaction.feedback', 'Directed feedback within a selection equivalence class is not supported.');
        const next = successors.get(source) ?? new Set();
        if (!next.has(target)) {
            next.add(target);
            indegree.set(target, indegree.get(target) + 1);
        }
        successors.set(source, next);
    }
    const ready = [...indegree].filter(([, count]) => count === 0).map(([key]) => key);
    for (let index = 0; index < ready.length; index++) {
        for (const target of successors.get(ready[index]) ?? []) {
            const remaining = indegree.get(target) - 1;
            indegree.set(target, remaining);
            if (remaining === 0)
                ready.push(target);
        }
    }
    if (ready.length !== roots.size)
        return failure('interaction.feedback', 'Directed interaction mappings cannot form a feedback cycle.');
    return { ok: true, value: freeze({ ...graph, mappings: [...mappings].filter(([key]) => usedMappings.has(key)).map(([, mapping]) => mapping) }) };
}

let validateInteractionGraphDepth=0;
export function validateInteractionGraph(...args) {const outer=validateInteractionGraphDepth++===0;const start=outer?performance.now():0;try{return validateInteractionGraphOriginal(...args);}finally{validateInteractionGraphDepth--;if(outer){const stats=globalThis.__functionDiagnostic??=Object.create(null);const entry=stats['validateInteractionGraph']??={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;stats['validateInteractionGraph']=entry;}}}
