import {parseContract, parseWireValue, WIRE_LIMITS} from '@aeliqo/sdk-core';
import type {Diagnostic} from '@aeliqo/sdk-core';
import type {RegionDocument, RegionDocumentInput, RegionPersistence} from './types.js';
import type {RegionHistoryEntry, RegionOutcome, RegionReadSet, RegionSnapshot} from '../regions/types.js';

const VERSION = '1' as const;
const failure = <T>(code: string, message: string): RegionOutcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false} as Diagnostic],
});

function frozen<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) { for (const child of value) frozen(child); return Object.freeze(value); }
  for (const child of Object.values(value as Record<string, unknown>)) frozen(child);
  return Object.freeze(value);
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') { const encoded = JSON.stringify(value); return encoded === undefined ? 'undefined' : encoded; }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function validReadSet(value: unknown): value is RegionReadSet {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const fields = ['scopeDigest', 'policyRevision', 'taskRevision', 'regionRevision', 'catalogRevision', 'experienceRevision', 'functionRegistryDigest', 'results', 'dataRevision'];
  if (Object.keys(record).some((key) => !fields.includes(key)) || fields.some((field) => !Object.hasOwn(record, field))) return false;
  if (fields.filter((field) => field !== 'results' && field !== 'dataRevision').some((field) => !validId(record[field]))) return false;
  if (!Number.isSafeInteger(record.dataRevision) || (record.dataRevision as number) < 0 || !Array.isArray(record.results) || record.results.length > WIRE_LIMITS.array) return false;
  const refs = new Set<string>();
  for (const ref of record.results) {
    if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) return false;
    const candidate = ref as Record<string, unknown>;
    const names = ['id', 'revision', 'outputId', 'queryDigest', 'scopeDigest'];
    if (Object.keys(candidate).length !== names.length || names.some((name) => !validId(candidate[name]))) return false;
    if (candidate.scopeDigest !== record.scopeDigest) return false;
    const key = canonical(ref);
    if (refs.has(key)) return false;
    refs.add(key);
  }
  return true;
}

function validHistory(value: unknown, scopeDigest: string): value is readonly RegionHistoryEntry[] {
  if (!Array.isArray(value) || value.length > WIRE_LIMITS.array) return false;
  return value.every((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    const allowed = ['kind', 'taskRevision', 'regionRevision', 'dataRevision', 'stateDigest', 'changedResults', 'requestId', 'reason', 'at'];
    if (Object.keys(record).some((key) => !allowed.includes(key))) return false;
    if (!['commit', 'data', 'revoke'].includes(String(record.kind)) || !validId(record.taskRevision) || !validId(record.regionRevision)) return false;
    if (!Number.isSafeInteger(record.dataRevision) || (record.dataRevision as number) < 0 || !Number.isSafeInteger(record.at) || (record.at as number) < 0) return false;
    if (record.stateDigest !== undefined && !validId(record.stateDigest)) return false;
    if (record.requestId !== undefined && !validId(record.requestId)) return false;
    if (record.reason !== undefined && (typeof record.reason !== 'string' || record.reason.length === 0 || record.reason.length > WIRE_LIMITS.text)) return false;
    if (record.changedResults !== undefined) {
      if (!Array.isArray(record.changedResults) || record.changedResults.length > WIRE_LIMITS.array) return false;
      const refs = new Set<string>();
      for (const ref of record.changedResults) {
        if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) return false;
        const candidate = ref as Record<string, unknown>;
        if (Object.keys(candidate).length !== 5 || ['id', 'revision', 'outputId', 'queryDigest', 'scopeDigest'].some((name) => !validId(candidate[name]))) return false;
        if (candidate.scopeDigest !== scopeDigest) return false;
        const key = canonical(ref);
        if (refs.has(key)) return false;
        refs.add(key);
      }
    }
    return true;
  });
}

function validateDocument(input: unknown): RegionOutcome<RegionDocument> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return failure('runtime.region-invalid', 'The persisted region document must be an object.');
  const value = input as Record<string, unknown>;
  const allowed = ['version', 'id', 'task', 'taskRevision', 'regionRevision', 'dataRevision', 'readSet', 'stateDigest', 'history'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return failure('runtime.region-invalid', 'The persisted region document contains an unknown property.');
  if (value.version !== VERSION || !validId(value.id) || !validId(value.taskRevision) || !validId(value.regionRevision) || !validId(value.stateDigest))
    return failure('runtime.region-invalid', 'The persisted region document has an unsupported identity or version.');
  if (!Number.isSafeInteger(value.dataRevision) || (value.dataRevision as number) < 0 || !validReadSet(value.readSet))
    return failure('runtime.region-invalid', 'The persisted region revisions or read set are invalid.');
  const readSet = value.readSet as RegionReadSet;
  if (value.dataRevision !== readSet.dataRevision || !validHistory(value.history, readSet.scopeDigest))
    return failure('runtime.region-invalid', 'The persisted data revision or history is invalid.');
  const task = parseContract('task', value.task);
  if (!task.ok || task.value.regionId !== value.id || task.value.revision !== value.taskRevision)
    return failure('runtime.region-invalid', 'The persisted Task does not belong to the region revision.');
  const document: RegionDocument = frozen({
    version: VERSION,
    id: value.id as string,
    task: task.value,
    taskRevision: value.taskRevision as string,
    regionRevision: value.regionRevision as string,
    dataRevision: value.dataRevision as number,
    readSet: value.readSet as RegionReadSet,
    stateDigest: value.stateDigest as string,
    history: value.history as readonly RegionHistoryEntry[],
  });
  return {ok: true, value: document};
}

export function exportRegionDocument(snapshot: RegionSnapshot, history: readonly RegionHistoryEntry[] = []): RegionDocument {
  if (snapshot.status === 'disposed' || snapshot.state === undefined || snapshot.readSet === undefined) throw new Error('Only an authorized active region can be persisted.');
  const task = snapshot.state.task;
  const stateDigest = digest(snapshot.state);
  const document: RegionDocument = {
    version: VERSION,
    id: snapshot.id,
    task,
    taskRevision: snapshot.taskRevision,
    regionRevision: snapshot.regionRevision,
    dataRevision: snapshot.dataRevision,
    readSet: snapshot.readSet,
    stateDigest,
    history,
  };
  const parsed = validateDocument(document);
  if (!parsed.ok) throw new TypeError(parsed.diagnostics[0]!.message);
  return parsed.value;
}

export function serializeRegionDocument(snapshot: RegionSnapshot, history: readonly RegionHistoryEntry[] = []): string {
  return canonical(exportRegionDocument(snapshot, history));
}

export function parseRegionDocument(input: RegionDocumentInput): RegionOutcome<RegionDocument> {
  const wire = parseWireValue(input);
  if (!wire.ok) return failure(wire.diagnostics[0]!.code, wire.diagnostics[0]!.message);
  return validateDocument(wire.value);
}

export const regionPersistence: RegionPersistence = Object.freeze({export: exportRegionDocument, serialize: serializeRegionDocument, parse: parseRegionDocument});
