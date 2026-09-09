import { WIRE_LIMITS as L } from './limits.js';
import { wireFailure } from '../diagnostics/wire.js';
/** UTF-8 size without a browser/Node encoder or ambient effect. */
export function utf8Bytes(text) {
    if (!/[^\x00-\x7f]/.test(text))
        return Math.min(text.length, L.bytes + 1);
    let bytes = 0;
    for (const point of text) {
        const value = point.codePointAt(0);
        bytes += value <= 0x7f ? 1 : value <= 0x7ff ? 2 : value <= 0xffff ? 3 : 4;
        if (bytes > L.bytes)
            return bytes;
    }
    return bytes;
}
function pathParts(path) {
    const parts = new Array(path?.depth ?? 0);
    for (let current = path; current !== undefined; current = current.parent)
        parts[current.depth - 1] = current.key;
    return parts;
}
/** Native JSON.parse has already checked syntax. Scan only object-key uniqueness. */
function inspectTextKeys(text) {
    const containers = [];
    for (let position = 0; position < text.length; position++) {
        const character = text[position];
        if (character === '{' || character === '[') {
            containers.push(character === '{' ? new Set() : null);
            if (containers.length > L.depth + 1)
                return wireFailure('wire.depth', 'The wire document exceeds its depth limit.');
        }
        else if (character === '}' || character === ']')
            containers.pop();
        else if (character === '"') {
            const start = position;
            while (++position < text.length) {
                if (text[position] === '\\')
                    position++;
                else if (text[position] === '"')
                    break;
            }
            let next = position + 1;
            while (next < text.length && /[\t\n\r ]/.test(text[next]))
                next++;
            if (text[next] !== ':')
                continue;
            const key = JSON.parse(text.slice(start, position + 1));
            const keys = containers.at(-1);
            if (keys.has(key))
                return wireFailure('wire.duplicate-key', 'Duplicate object keys are not accepted.');
            keys.add(key);
            if (keys.size > L.properties)
                return wireFailure('wire.properties', 'A wire object exceeds its property limit.');
        }
    }
    return { ok: true, value: undefined };
}
/** Do cheap iterative resource/JSON checks before recursive schema parsing. */
function inspectWireOriginal(input) {
    let value = input;
    if (typeof input === 'string') {
        if (input.length > L.bytes || utf8Bytes(input) > L.bytes)
            return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        try {
            value = JSON.parse(input);
        }
        catch {
            return wireFailure('wire.json', 'The wire document is not valid JSON.');
        }
        const uniqueKeys = inspectTextKeys(input);
        if (!uniqueKeys.ok)
            return uniqueKeys;
    }
    const frames = [{ value, path: undefined }];
    const ancestors = new Set();
    let nodes = 0;
    let textBytes = 0;
    try {
        while (frames.length) {
            const frame = frames.pop();
            const current = frame.value;
            if (frame.leave) {
                ancestors.delete(current);
                continue;
            }
            if (++nodes > L.nodes)
                return wireFailure('wire.nodes', 'The wire document exceeds its node limit.', pathParts(frame.path));
            if ((frame.path?.depth ?? 0) > L.depth)
                return wireFailure('wire.depth', 'The wire document exceeds its depth limit.', pathParts(frame.path).slice(0, L.depth));
            if (current === null || typeof current === 'boolean')
                continue;
            if (typeof current === 'number') {
                if (!Number.isFinite(current))
                    return wireFailure('wire.number', 'Wire numbers must be finite.', pathParts(frame.path));
                continue;
            }
            if (typeof current === 'string') {
                if (current.length > L.text)
                    return wireFailure('wire.text', 'A wire string exceeds its length limit.', pathParts(frame.path));
                textBytes += utf8Bytes(current);
                if (textBytes > L.bytes)
                    return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
                continue;
            }
            if (typeof current !== 'object')
                return wireFailure('wire.type', 'Only JSON values are accepted.', pathParts(frame.path));
            if (ancestors.has(current))
                return wireFailure('wire.cycle', 'Cyclic objects are not wire data.', pathParts(frame.path));
            const isArray = Array.isArray(current);
            const prototype = Object.getPrototypeOf(current);
            if (prototype !== (isArray ? Array.prototype : Object.prototype) && !(prototype === null && !isArray))
                return wireFailure('wire.object', 'Only plain JSON objects and arrays are accepted.', pathParts(frame.path));
            const keys = Reflect.ownKeys(current);
            if (isArray && current.length > L.array)
                return wireFailure('wire.array', 'A wire array exceeds its item limit.', pathParts(frame.path));
            if (!isArray && keys.length > L.properties)
                return wireFailure('wire.properties', 'A wire object exceeds its property limit.', pathParts(frame.path));
            if (isArray && keys.length !== current.length + 1)
                return wireFailure('wire.array', 'Sparse arrays and extra array properties are not accepted.', pathParts(frame.path));
            ancestors.add(current);
            frames.push({ value: current, path: frame.path, leave: true });
            for (let index = keys.length - 1; index >= 0; index--) {
                const key = keys[index];
                if (typeof key !== 'string')
                    return wireFailure('wire.key', 'Symbol keys are not wire data.', pathParts(frame.path));
                if (isArray && key === 'length')
                    continue;
                if (key.length > L.id || key === '__proto__')
                    return wireFailure('wire.key', 'A wire property name is not supported.', pathParts(frame.path));
                if (isArray && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length))
                    return wireFailure('wire.array', 'Extra array properties are not accepted.', pathParts(frame.path));
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
                    return wireFailure('wire.accessor', 'Accessors and hidden properties are not wire data.', [...pathParts(frame.path), key]);
                textBytes += utf8Bytes(key);
                frames.push({ value: descriptor.value, path: { parent: frame.path, key: isArray ? Number(key) : key, depth: (frame.path?.depth ?? 0) + 1 } });
            }
        }
        // Includes escaped characters and punctuation after the bounded structure walk.
        if (utf8Bytes(JSON.stringify(value)) > L.bytes)
            return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
    }
    catch {
        return wireFailure('wire.object', 'The supplied object could not be inspected as JSON.');
    }
    return { ok: true, value };
}

export function inspectWire(input) {
 const start=performance.now();
 try { return inspectWireOriginal(input); }
 finally {
  const category=Array.isArray(input)?`array:${input.length}`:input?.nodes?`plan:${input.nodes.length}`:input?.entities?'catalog':input?.needs?'task':input?.fields?'result':typeof input;
  const stats=globalThis.__ingressDiagnostic??=(Object.create(null));
  const value=stats[category]??={calls:0,ms:0};value.calls++;value.ms+=performance.now()-start;stats[category]=value;
 }
}
