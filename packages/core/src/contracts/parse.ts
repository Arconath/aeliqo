import * as z from 'zod/mini';
import {contractSchemas} from './schemas.js';
import {CONTRACT_VERSION, WIRE_LIMITS} from './limits.js';
import {inspectWire} from './ingress.js';
import {wireDiagnostic, wireFailure} from '../diagnostics/wire.js';
import type {Contract, ContractKind, Diagnostic, Outcome} from './types.js';

/** Parse an already-inspected JSON value. Callers must establish the wire boundary first. */
export function parseInspectedContract<K extends ContractKind>(kind: K, input: unknown): Outcome<Contract<K>> {
  if (!Object.hasOwn(contractSchemas, kind)) return wireFailure('wire.kind', 'The contract kind is not supported.');
  const value = input;
  if ((kind === 'catalog' || kind === 'task' || kind === 'result' || kind === 'experience') &&
      value !== null && typeof value === 'object' && Object.hasOwn(value, 'version')) {
    const version = (value as {version: unknown}).version;
    if (version !== CONTRACT_VERSION) return wireFailure('wire.version', 'The contract version is not supported; explicit migration is required.', ['version']);
  }
  const parsed = z.safeParse(contractSchemas[kind], value);
  if (!parsed.success) {
    const diagnostics = parsed.error.issues.slice(0, WIRE_LIMITS.diagnostics).map(issue =>
      wireDiagnostic(`wire.${issue.code}`, issue.path.filter((part): part is string | number => typeof part !== 'symbol')));
    return {ok: false, diagnostics: diagnostics as [Diagnostic, ...Diagnostic[]]};
  }
  return {ok: true, value: parsed.data as Contract<K>};
}
/** A successful parse validates wire shape only. It grants no effect or business meaning. */
export function parseContract<K extends ContractKind>(kind: K, input: unknown): Outcome<Contract<K>> {
  const inspected = inspectWire(input);
  if (!inspected.ok) return inspected;
  return parseInspectedContract(kind, inspected.value);
}
export const parseCatalog = (input: unknown) => parseContract('catalog', input);
export const parseTask = (input: unknown) => parseContract('task', input);
export const parseResult = (input: unknown) => parseContract('result', input);
export const parseExperience = (input: unknown) => parseContract('experience', input);

/** Internal deterministic key for already-inspected JSON, including signed zero. */
export function canonicalJSON(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`).join(',')}}`;
}
/** Stable object-key ordering; arrays, decimal scale and signed zero are preserved. */
export function serializeContract<K extends ContractKind>(kind: K, value: Contract<K>): Outcome<string> {
  const parsed = parseContract(kind, value);
  return parsed.ok ? {ok: true, value: canonicalJSON(parsed.value)} : parsed;
}
