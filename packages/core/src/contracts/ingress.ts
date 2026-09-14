import {WIRE_LIMITS as L} from './limits.js';
import type {Outcome} from './types.js';
import {wireFailure} from '../diagnostics/wire.js';

const JSON_SAFE_ASCII = /^[\x20-\x21\x23-\x5b\x5d-\x7f]*$/u;

/** UTF-8 size without a browser/Node encoder or ambient effect. */
export function utf8Bytes(text: string): number {
  if (!/[^\x00-\x7f]/.test(text)) return Math.min(text.length, L.bytes + 1);
  let bytes = 0;
  for (const point of text) {
    const value = point.codePointAt(0)!;
    bytes += value <= 0x7f ? 1 : value <= 0x7ff ? 2 : value <= 0xffff ? 3 : 4;
    if (bytes > L.bytes) return bytes;
  }
  return bytes;
}
/** Byte length of JSON.stringify(text), without allocating the escaped string. */
function jsonStringBytes(text: string): number {
  if (JSON_SAFE_ASCII.test(text)) return text.length + 2;
  let bytes = 2;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 0x22 || code === 0x5c || code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      bytes += 2;
    } else if (code < 0x20) {
      bytes += 6;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index++; }
      else bytes += 6;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes += 6;
    } else {
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
    }
    if (bytes > L.bytes) return bytes;
  }
  return bytes;
}
function jsonPrimitiveBytes(value: null | boolean | number | string): number {
  if (value === null) return 4;
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (typeof value === 'number') return utf8Bytes(String(value));
  return jsonStringBytes(value);
}
function cachedJSONBytes(text: string, cache: Map<string, number>): number {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const bytes = jsonStringBytes(text);
  if (cache.size < 1024) cache.set(text, bytes);
  return bytes;
}
type WirePath = {readonly parent: WirePath | undefined; readonly key: string | number; readonly depth: number};
/** A completed subtree summary is local to one walk; each alias still pays its full resource cost. */
type WireSummary = {readonly nodes: number; readonly bytes: number; readonly maxRelativeDepth: number};
type SummaryScope = {
  readonly baseDepth: number;
  readonly startNodes: number;
  readonly startBytes: number;
  readonly parent: SummaryScope | undefined;
  maxRelativeDepth: number;
};
type Frame = {value: unknown; path: WirePath | undefined; leave?: boolean; scope?: SummaryScope};
function pathParts(path: WirePath | undefined): (string | number)[] {
  const parts = new Array<string | number>(path?.depth ?? 0);
  for (let current = path; current !== undefined; current = current.parent) parts[current.depth - 1] = current.key;
  return parts;
}
/** Native JSON.parse has already checked syntax. Scan only object-key uniqueness. */
function inspectTextKeys(text: string): Outcome<undefined> {
  const containers: (Set<string> | null)[] = [];
  for (let position = 0; position < text.length; position++) {
    const character = text[position];
    if (character === '{' || character === '[') {
      containers.push(character === '{' ? new Set() : null);
      if (containers.length > L.depth + 1)
        return wireFailure('wire.depth', 'The wire document exceeds its depth limit.');
    } else if (character === '}' || character === ']') containers.pop();
    else if (character === '"') {
      const start = position;
      while (++position < text.length) {
        if (text[position] === '\\') position++;
        else if (text[position] === '"') break;
      }
      let next = position + 1;
      while (next < text.length && /[\t\n\r ]/.test(text[next]!)) next++;
      if (text[next] !== ':') continue;
      const key = JSON.parse(text.slice(start, position + 1)) as string;
      const keys = containers.at(-1)!;
      if (keys!.has(key))
        return wireFailure('wire.duplicate-key', 'Duplicate object keys are not accepted.');
      keys!.add(key);
      if (keys!.size > L.properties)
        return wireFailure('wire.properties', 'A wire object exceeds its property limit.');
    }
  }
  return {ok: true, value: undefined};
}
/** Do cheap iterative resource/JSON checks before recursive schema parsing. */
export function inspectWire(input: unknown): Outcome<unknown> {
  let value = input;
  if (typeof input === 'string') {
    if (input.length > L.bytes || utf8Bytes(input) > L.bytes)
      return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
    try {value = JSON.parse(input) as unknown;}
    catch {return wireFailure('wire.json', 'The wire document is not valid JSON.');}
    const uniqueKeys = inspectTextKeys(input);
    if (!uniqueKeys.ok) return uniqueKeys;
  }
  const frames: Frame[] = [{value, path: undefined}];
  const ancestors = new Set<object>();
  const summaries = new WeakMap<object, WireSummary>();
  let nodes = 0;
  let encodedBytes = 0;
  const stringByteCache = new Map<string, number>();
  const addEncodedBytes = (bytes: number): boolean => {
    encodedBytes += bytes;
    return encodedBytes <= L.bytes;
  };
  try {
    while (frames.length) {
      const frame = frames.pop()!;
      const current = frame.value;
      if (frame.leave) {
        ancestors.delete(current as object);
        if (!addEncodedBytes(1)) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        const scope = frame.scope!;
        const summary = {
          nodes: nodes - scope.startNodes,
          bytes: encodedBytes - scope.startBytes,
          maxRelativeDepth: scope.maxRelativeDepth,
        };
        summaries.set(current as object, summary);
        if (scope.parent !== undefined) {
          const relativeDepth = scope.baseDepth - scope.parent.baseDepth + scope.maxRelativeDepth;
          scope.parent.maxRelativeDepth = Math.max(scope.parent.maxRelativeDepth, relativeDepth);
        }
        continue;
      }
      const depth = frame.path?.depth ?? 0;
      if (depth > L.depth) return wireFailure('wire.depth', 'The wire document exceeds its depth limit.', pathParts(frame.path).slice(0, L.depth));
      const parentScope = frame.scope;
      if (parentScope !== undefined) parentScope.maxRelativeDepth = Math.max(parentScope.maxRelativeDepth, depth - parentScope.baseDepth);
      const isObject = current !== null && typeof current === 'object';
      if (isObject && ancestors.has(current)) {
        if (++nodes > L.nodes) return wireFailure('wire.nodes', 'The wire document exceeds its node limit.', pathParts(frame.path));
        return wireFailure('wire.cycle', 'Cyclic objects are not wire data.', pathParts(frame.path));
      }
      const cached = isObject ? summaries.get(current) : undefined;
      if (cached !== undefined && nodes + cached.nodes <= L.nodes && encodedBytes + cached.bytes <= L.bytes
        && depth + cached.maxRelativeDepth <= L.depth) {
        nodes += cached.nodes;
        encodedBytes += cached.bytes;
        if (parentScope !== undefined) parentScope.maxRelativeDepth = Math.max(parentScope.maxRelativeDepth,
          depth - parentScope.baseDepth + cached.maxRelativeDepth);
        continue;
      }
      if (++nodes > L.nodes) return wireFailure('wire.nodes', 'The wire document exceeds its node limit.', pathParts(frame.path));
      if (current === null || typeof current === 'boolean') {
        if (!addEncodedBytes(jsonPrimitiveBytes(current))) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        continue;
      }
      if (typeof current === 'number') {
        if (!Number.isFinite(current)) return wireFailure('wire.number', 'Wire numbers must be finite.', pathParts(frame.path));
        if (!addEncodedBytes(jsonPrimitiveBytes(current))) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        continue;
      }
      if (typeof current === 'string') {
        if (current.length > L.text) return wireFailure('wire.text', 'A wire string exceeds its length limit.', pathParts(frame.path));
        if (!addEncodedBytes(cachedJSONBytes(current, stringByteCache))) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        continue;
      }
      if (typeof current !== 'object') return wireFailure('wire.type', 'Only JSON values are accepted.', pathParts(frame.path));
      const isArray = Array.isArray(current);
      const prototype = Object.getPrototypeOf(current) as unknown;
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
      if (!addEncodedBytes(1)) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
      const scope: SummaryScope = {baseDepth: depth, startNodes: nodes - 1, startBytes: encodedBytes - 1, parent: parentScope, maxRelativeDepth: 0};
      frames.push({value: current, path: frame.path, leave: true, scope});
      let propertyIndex = 0;
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index]!;
        if (typeof key !== 'string') return wireFailure('wire.key', 'Symbol keys are not wire data.', pathParts(frame.path));
        if (isArray && key === 'length') continue;
        if (key.length > L.id || key === '__proto__') return wireFailure('wire.key', 'A wire property name is not supported.', pathParts(frame.path));
        if (isArray && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length))
          return wireFailure('wire.array', 'Extra array properties are not accepted.', pathParts(frame.path));
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          return wireFailure('wire.accessor', 'Accessors and hidden properties are not wire data.', [...pathParts(frame.path), key]);
        const syntaxBytes = isArray
          ? (Number(key) === 0 ? 0 : 1)
          : cachedJSONBytes(key, stringByteCache) + 1 + (propertyIndex === 0 ? 0 : 1);
        if (!addEncodedBytes(syntaxBytes)) return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
        propertyIndex++;
        frames.push({value: descriptor.value as unknown, scope,
          path: {parent: frame.path, key: isArray ? Number(key) : key, depth: depth + 1}});
      }
    }
    if (encodedBytes > L.bytes)
      return wireFailure('wire.bytes', 'The wire document exceeds its byte limit.');
  } catch {
    return wireFailure('wire.object', 'The supplied object could not be inspected as JSON.');
  }
  return {ok: true, value};
}
