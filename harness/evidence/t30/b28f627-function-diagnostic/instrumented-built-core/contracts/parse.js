import * as z from 'zod/mini';
import { contractSchemas } from './schemas.js';
import { CONTRACT_VERSION, WIRE_LIMITS } from './limits.js';
import { inspectWire } from './ingress.js';
import { wireDiagnostic, wireFailure } from '../diagnostics/wire.js';
/** A successful parse validates wire shape only. It grants no effect or business meaning. */
function parseContractOriginal(kind, input) {
    if (!Object.hasOwn(contractSchemas, kind))
        return wireFailure('wire.kind', 'The contract kind is not supported.');
    const inspected = inspectWire(input);
    if (!inspected.ok)
        return inspected;
    const value = inspected.value;
    if ((kind === 'catalog' || kind === 'task' || kind === 'result' || kind === 'experience') &&
        value !== null && typeof value === 'object' && Object.hasOwn(value, 'version')) {
        const version = value.version;
        if (version !== CONTRACT_VERSION)
            return wireFailure('wire.version', 'The contract version is not supported; explicit migration is required.', ['version']);
    }
    const parsed = z.safeParse(contractSchemas[kind], value);
    if (!parsed.success) {
        const diagnostics = parsed.error.issues.slice(0, WIRE_LIMITS.diagnostics).map(issue => wireDiagnostic(`wire.${issue.code}`, issue.path.filter((part) => typeof part !== 'symbol')));
        return { ok: false, diagnostics: diagnostics };
    }
    return { ok: true, value: parsed.data };
}
export const parseCatalog = (input) => parseContract('catalog', input);
export const parseTask = (input) => parseContract('task', input);
export const parseResult = (input) => parseContract('result', input);
export const parseExperience = (input) => parseContract('experience', input);
/** Internal deterministic key for already-inspected JSON, including signed zero. */
function canonicalJSONOriginal(value) {
    if (value === null)
        return 'null';
    if (typeof value === 'number' && Object.is(value, -0))
        return '-0';
    if (typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalJSON).join(',')}]`;
    const record = value;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`).join(',')}}`;
}
/** Stable object-key ordering; arrays, decimal scale and signed zero are preserved. */
export function serializeContract(kind, value) {
    const parsed = parseContract(kind, value);
    return parsed.ok ? { ok: true, value: canonicalJSON(parsed.value) } : parsed;
}

let parseContractDepth=0;
export function parseContract(...args) {const outer=parseContractDepth++===0;const start=outer?performance.now():0;try{return parseContractOriginal(...args);}finally{parseContractDepth--;if(outer){const stats=globalThis.__functionDiagnostic??=Object.create(null);const entry=stats['parseContract']??={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;stats['parseContract']=entry;}}}

let canonicalJSONDepth=0;
export function canonicalJSON(...args) {const outer=canonicalJSONDepth++===0;const start=outer?performance.now():0;try{return canonicalJSONOriginal(...args);}finally{canonicalJSONDepth--;if(outer){const stats=globalThis.__functionDiagnostic??=Object.create(null);const entry=stats['canonicalJSON']??={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;stats['canonicalJSON']=entry;}}}
