import { stateMappingFor } from './state.js';
import * as z from 'zod/mini';
import { parseContract } from '../contracts/parse.js';
import { inspectWire } from '../contracts/ingress.js';
import { idSchema, revisionSchema, jsonSchema } from '../contracts/schemas.js';
import { validateCommitReadSet } from '../contracts/commit.js';
import { freezePresentation, isThenable, presentationFailure as fail, versionKey } from './registry.js';
import { preparePresentationContext, validatePreparedPresentationPlan } from './validate.js';
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const stateIdentity = { id: 'aeliqo.state.identity', revision: '1' };
const suggestionSchema = z.record(z.string(), jsonSchema);
function normalizePlan(input, id, revision, preconditions) {
    const wire = inspectWire(input);
    if (!wire.ok)
        return wire;
    if (wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value))
        return fail('candidate', 'A presentation candidate must be a plan object.');
    const normalized = { ...wire.value, id, revision, preconditions };
    const reparsed = parseContract('presentation-plan', normalized);
    return reparsed;
}
function callbackValue(raw, code, message) {
    if (isThenable(raw))
        return fail(code, message);
    const wire = inspectWire(raw);
    if (!wire.ok)
        return wire;
    const outcome = wire.value;
    if (outcome === null || typeof outcome !== 'object' || outcome.ok !== true || !Object.hasOwn(outcome, 'value'))
        return fail(code, message);
    return { ok: true, value: outcome.value };
}
function canonicalOriginal(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function sameRef(left, right) {
    return versionKey(left) === versionKey(right);
}
function planTopology(plan) {
    return canonical(plan.nodes.map(node => [node.id, node.role, node.children]).sort((a, b) => compareText(String(a[0]), String(b[0]))));
}
function planVariants(plan) {
    return canonical(plan.nodes.map(node => [node.id, versionKey(node.representation)]).sort());
}
function planConfigurations(plan) {
    return canonical(plan.nodes.map(node => [node.id, node.config]).sort());
}
function planSemantics(plan) {
    return canonical([plan.links, plan.coverage, plan.nodes.map(node => [node.id, node.result]).sort()]);
}
function changePenalty(candidate, incumbent) {
    if (incumbent === undefined)
        return 0;
    let penalty = 0;
    if (planTopology(candidate) !== planTopology(incumbent))
        penalty += 80;
    if (planVariants(candidate) !== planVariants(incumbent))
        penalty += 80;
    if (planConfigurations(candidate) !== planConfigurations(incumbent))
        penalty += 20;
    if (planSemantics(candidate) !== planSemantics(incumbent))
        penalty += 20;
    return penalty;
}
function candidateScore(presentation, prepared, incumbent) {
    let score = 0;
    for (const node of presentation.nodes) {
        const quality = node.quality;
        if (quality === undefined)
            continue;
        score += quality.taskFit * 100;
        score += quality.informationDensity * 25;
        score -= quality.interactionEffort * 20;
        score -= quality.legibilityPenalty * 20;
        if (quality.cost !== undefined)
            score -= Math.min(100, Math.floor(quality.cost.microseconds / 1_000_000)) * 5;
    }
    if (prepared.constraints.preferredRepresentation !== undefined && presentation.nodes.some(node => node.manifest.id === prepared.constraints.preferredRepresentation))
        score += 150;
    const optionalCovered = prepared.constraints.taskNeeds.filter(need => !need.required && presentation.plan.coverage.some(entry => entry.needId === need.id)).length;
    score += optionalCovered * 10;
    score -= changePenalty(presentation.plan, incumbent);
    return score;
}
function betterCandidate(next, current) {
    if (current === undefined)
        return true;
    if (next.score !== current.score)
        return next.score > current.score;
    if (next.incumbent !== current.incumbent)
        return next.incumbent;
    return next.tie < current.tie;
}
function validPattern(candidate, patterns, prepared) {
    if (candidate.source !== 'pattern')
        return { ok: true, value: undefined };
    const patternRef = candidate.pattern;
    if (patternRef === undefined)
        return fail('pattern-required', 'A pattern candidate must identify its registered pattern.');
    const pattern = patterns.find(item => sameRef(item.ref, patternRef));
    if (pattern === undefined || !prepared.constraints.allowedPatterns.includes(pattern.ref.id))
        return fail('pattern-required', 'The candidate pattern is not allowed by the active experience.');
    return { ok: true, value: pattern };
}
function stableNodeId(need, role, _representation, used, context) {
    const coverage = context.incumbent?.coverage.find(entry => entry.needId === need.id);
    const existing = coverage?.nodeIds.find(id => {
        const node = context.incumbent?.nodes.find(candidate => candidate.id === id);
        return node !== undefined && node.role === role && !used.has(id);
    });
    if (existing !== undefined) {
        used.add(existing);
        return existing;
    }
    const base = `view.${need.id}`;
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    let index = 2;
    while (used.has(`${base}.${index}`))
        index++;
    const id = `${base}.${index}`;
    used.add(id);
    return id;
}
function stableRootId(role, _representation, used, context) {
    const currentRoot = context.incumbent?.nodes.find(node => node.id === context.incumbent?.rootId);
    if (currentRoot !== undefined && currentRoot.role === role && !used.has(currentRoot.id)) {
        used.add(currentRoot.id);
        return currentRoot.id;
    }
    const base = 'layout';
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    let index = 2;
    while (used.has(`${base}.${index}`))
        index++;
    const id = `${base}.${index}`;
    used.add(id);
    return id;
}
function transfersFor(nodes, incumbent, registry, context, rootId) {
    if (incumbent === undefined)
        return [];
    const next = new Map(nodes.map(node => [node.id, node]));
    return incumbent.nodes.flatMap(previous => {
        const candidate = next.get(previous.id);
        if (candidate !== undefined && candidate.role === previous.role && sameRef(candidate.representation, previous.representation))
            return [{ fromNode: previous.id, toNode: previous.id, mapping: stateIdentity }];
        const target = candidate ?? next.get(rootId);
        if (target === undefined)
            return [];
        const mapping = stateMappingFor(previous, target, registry, context, candidate === undefined ? 'archive' : 'transfer');
        return mapping === undefined ? [] : [{ fromNode: previous.id, toNode: target.id, mapping: mapping.ref }];
    });
}
function buildPlan(request, prepared, registry, layout, selected, suggest) {
    const required = prepared.constraints.taskNeeds.filter(need => need.required);
    const used = new Set();
    const descriptors = prepared.results;
    const resultFor = (need) => {
        if (need.outputId === undefined)
            return undefined;
        return descriptors.find(result => result.ref.outputId === need.outputId);
    };
    const nodes = [];
    for (let index = 0; index < required.length; index++) {
        const need = required[index];
        const manifest = selected[index];
        if (manifest === undefined)
            return fail('suggestion', 'The bounded composition did not provide a representation for every required need.');
        const result = resultFor(need);
        if (manifest.result === 'required' && result === undefined)
            return fail('suggestion', 'A required-result representation has no exact task output.');
        const values = suggest(manifest, [need], result);
        if (!values.ok)
            return values;
        const nodeId = stableNodeId(need, manifest.roles[0], manifest.ref, used, request.context);
        nodes.push({ id: nodeId, role: manifest.roles[0], representation: manifest.ref, ...(result === undefined ? {} : { result: result.ref }),
            config: { schema: manifest.configSchema, values: values.value }, children: [] });
    }
    if (layout === undefined && nodes.length !== 1)
        return fail('suggestion', 'A single leaf is required when no layout manifest is selected.');
    let rootId;
    if (layout === undefined)
        rootId = nodes[0].id;
    else {
        const values = suggest(layout, [], undefined);
        if (!values.ok)
            return values;
        rootId = stableRootId(layout.roles[0], layout.ref, used, request.context);
        nodes.unshift({ id: rootId, role: layout.roles[0], representation: layout.ref, config: { schema: layout.configSchema, values: values.value }, children: nodes.map(node => node.id) });
    }
    return { ok: true, value: {
            id: request.id, revision: request.revision, rootId, preconditions: request.preconditions,
            nodes, links: [], coverage: required.map((need, index) => ({ needId: need.id, nodeIds: [nodes[layout === undefined ? index : index + 1].id], operations: [need.operation] })),
            stateTransfer: transfersFor(nodes, request.context.incumbent, registry, request.context, rootId), diagnostics: [],
        } };
}
/** Bounded deterministic composition. Every candidate still passes the shared feasibility validator. */
export function composePresentation(request, registry) {
    const identity = z.safeParse(z.strictObject({ id: idSchema, revision: revisionSchema }), { id: request.id, revision: request.revision });
    if (!identity.success)
        return fail('request', 'The composition identity is invalid.');
    const requestPins = validateCommitReadSet(request.preconditions, request.context.current);
    if (!requestPins.ok)
        return requestPins;
    const prepared = preparePresentationContext(request.context);
    if (!prepared.ok)
        return prepared;
    const constraints = prepared.value.constraints;
    // Pure registered node resolutions may be reused only inside this synchronous
    // composition; no validation/authority cache survives a subsequent invocation.
    const nodeMemo = new Map();
    if (constraints.task.revision !== requestPins.value.taskRevision || constraints.task.catalogRevision !== requestPins.value.catalogRevision
        || constraints.task.functionRegistryDigest !== requestPins.value.functionRegistryDigest || constraints.experience.revision !== requestPins.value.experienceRevision)
        return fail('stale', 'The task or experience differs from the current version pins.');
    if (request.candidates !== undefined) {
        const candidatesWire = inspectWire(request.candidates);
        if (!candidatesWire.ok)
            return candidatesWire;
        if (!Array.isArray(candidatesWire.value) || candidatesWire.value.length > 64)
            return fail('candidate-budget', 'The proposed complete candidate list exceeds the input budget.');
    }
    const rejected = [];
    let expansions = 0;
    let budgetBlocked = false;
    let best;
    const spend = () => {
        if (expansions >= constraints.maxExpansions) {
            budgetBlocked = true;
            return false;
        }
        expansions++;
        return true;
    };
    const reject = (candidate, diagnostics) => rejected.push({ candidate, diagnostics });
    const consider = (presentation, candidateIsIncumbent) => {
        const rank = { presentation, score: candidateScore(presentation, prepared.value, request.context.incumbent),
            tie: canonical(presentation.plan), incumbent: candidateIsIncumbent };
        if (betterCandidate(rank, best))
            best = rank;
    };
    const validateCandidate = (input, label, options = {}, candidateIsIncumbent = false, expansionReserved = false) => {
        if (!expansionReserved && !spend())
            return false;
        const normalized = normalizePlan(input, identity.data.id, identity.data.revision, requestPins.value);
        if (!normalized.ok) {
            reject(label, normalized.diagnostics);
            return false;
        }
        const checked = validatePreparedPresentationPlan(normalized.value, request.context, registry, prepared.value, options, nodeMemo);
        if (!checked.ok) {
            reject(label, checked.diagnostics);
            return false;
        }
        consider(checked.value, candidateIsIncumbent);
        return true;
    };
    if (request.context.incumbent !== undefined)
        validateCandidate({ ...request.context.incumbent, stateTransfer: [] }, 'incumbent', {}, true);
    const patterns = registry.patterns ?? [];
    const patternContext = prepared.value.patternContext;
    const candidates = request.candidates ?? [];
    for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index];
        if (candidate === null || typeof candidate !== 'object' || (candidate.source !== 'explicit' && candidate.source !== 'pattern')) {
            reject(`candidate.${index}`, [{ code: 'presentation.candidate', message: 'The candidate source is invalid.', retryable: false }]);
            continue;
        }
        const pattern = validPattern(candidate, patterns, prepared.value);
        if (!pattern.ok) {
            reject(`candidate.${index}`, pattern.diagnostics);
            continue;
        }
        if (candidate.source === 'pattern') {
            if (!spend())
                break;
            let expanded;
            try {
                expanded = pattern.value.expand({ id: identity.data.id, revision: identity.data.revision, preconditions: requestPins.value, context: patternContext });
            }
            catch {
                reject(`pattern.${candidate.pattern.id}`, [{ code: 'presentation.pattern', message: 'The registered pattern expander failed.', retryable: false }]);
                continue;
            }
            const expansion = callbackValue(expanded, 'pattern', 'The registered pattern expander failed.');
            if (!expansion.ok) {
                reject(`pattern.${candidate.pattern.id}`, expansion.diagnostics);
                continue;
            }
            const selectedPattern = pattern.value;
            if (selectedPattern === undefined) {
                reject(`pattern.${candidate.pattern.id}`, [{ code: 'presentation.pattern', message: 'The registered pattern is unavailable.', retryable: false }]);
                continue;
            }
            validateCandidate(expansion.value, `pattern.${candidate.pattern.id}`, { requiredPattern: selectedPattern }, false, true);
        }
        else
            validateCandidate(candidate.plan, `candidate.${index}`, {}, false);
        if (budgetBlocked)
            break;
    }
    const allowed = registry.manifests.filter(manifest => constraints.allowedRepresentations.includes(manifest.ref.id)
        && contextHasRenderer(request.context.rendererCapabilities, manifest.ref)
        && manifest.suggestConfig !== undefined
        && (!manifest.extension || constraints.extensionAllowlist.some(ref => sameRef(ref, manifest.ref))))
        .sort((a, b) => compareText(versionKey(a.ref), versionKey(b.ref)));
    const required = constraints.taskNeeds.filter(need => need.required);
    for (const need of required) {
        if (need.outputId !== undefined && prepared.value.results.filter(result => result.ref.outputId === need.outputId).length > 1)
            return fail('ambiguous-result', 'Several result revisions match a named output; select an exact authorized descriptor before composing.');
    }
    const choices = required.map(need => allowed.filter(manifest => manifest.visibility === 'leaf' && manifest.children.min === 0
        && manifest.operations.some(op => sameRef(op, need.operation)) && (need.outputId === undefined ? manifest.result !== 'required' : manifest.result !== 'none')));
    const layouts = allowed.filter(manifest => manifest.result === 'none' && manifest.visibility === 'simultaneous'
        && manifest.children.min <= required.length && manifest.children.max >= required.length);
    const suggest = (manifest, needs, result) => {
        if (manifest.suggestConfig === undefined)
            return fail('suggestion', 'The representation has no trusted bounded suggestion.');
        let raw;
        try {
            raw = manifest.suggestConfig(needs, result);
        }
        catch {
            return fail('suggestion', 'The registered configuration suggestion failed.');
        }
        const outcome = callbackValue(raw, 'suggestion', 'The registered configuration suggestion failed.');
        if (!outcome.ok)
            return outcome;
        const parsed = z.safeParse(suggestionSchema, outcome.value);
        if (!parsed.success)
            return fail('suggestion', 'The registered configuration suggestion is not bounded JSON configuration.');
        return { ok: true, value: freezePresentation(parsed.data) };
    };
    const tryBuild = (layout, selected, label) => {
        if (!spend())
            return false;
        const built = buildPlan(request, prepared.value, registry, layout, selected, suggest);
        if (!built.ok) {
            reject(label, built.diagnostics);
            return false;
        }
        return validateCandidate(built.value, label, {}, false, true);
    };
    if (!budgetBlocked && required.length === 0) {
        const emptyRoots = allowed.filter(manifest => manifest.result !== 'required' && manifest.children.min === 0);
        for (const root of emptyRoots) {
            tryBuild(root, [], `registered.queryless.${root.ref.id}`);
            if (budgetBlocked)
                break;
        }
        if (emptyRoots.length === 0)
            reject('registered-queryless', [{ code: 'presentation.no-suggestion', message: 'No queryless root suggestion is registered.', retryable: false }]);
    }
    else if (!budgetBlocked && required.length === 1 && choices[0].length > 0) {
        for (const leaf of choices[0]) {
            tryBuild(undefined, [leaf], `registered.leaf.${leaf.ref.id}`);
            if (budgetBlocked)
                break;
        }
    }
    else if (!budgetBlocked && required.length > 1 && layouts.length > 0 && choices.every(list => list.length > 0)) {
        // Enumerate complete assignments lazily. Never allocate the Cartesian product;
        // every attempted assignment is bounded by the same expansion counter.
        const indices = choices.map(() => 0);
        let layoutIndex = 0;
        let candidateIndex = 0;
        while (layoutIndex < layouts.length) {
            tryBuild(layouts[layoutIndex], choices.map((list, index) => list[indices[index]]), `registered.${candidateIndex++}`);
            if (budgetBlocked)
                break;
            let position = indices.length - 1;
            while (position >= 0 && indices[position] + 1 >= choices[position].length) {
                indices[position] = 0;
                position--;
            }
            if (position >= 0)
                indices[position] = indices[position] + 1;
            else
                layoutIndex++;
        }
    }
    else if (!budgetBlocked) {
        reject('registered-composition', [{ code: 'presentation.no-suggestion', message: 'No complete suggestion is available from the installed registry. Explicit registered configurations may still be feasible.', retryable: false }]);
    }
    if (best === undefined)
        return { ok: true, value: freezePresentation({ status: budgetBlocked ? 'search-exhausted' : 'conflict', expansions, rejected }) };
    return { ok: true, value: freezePresentation({ status: budgetBlocked ? 'search-exhausted' : 'composed', presentation: best.presentation, expansions, rejected }) };
}
function contextHasRenderer(capabilities, ref) {
    try {
        return capabilities.some(candidate => sameRef(candidate, ref));
    }
    catch {
        return false;
    }
}

let canonicalDepth=0;
function canonical(...args) {const outer=canonicalDepth++===0;const start=outer?performance.now():0;try{return canonicalOriginal(...args);}finally{canonicalDepth--;if(outer){const stats=globalThis.__functionDiagnostic??=Object.create(null);const entry=stats['canonical']??={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;stats['canonical']=entry;}}}
