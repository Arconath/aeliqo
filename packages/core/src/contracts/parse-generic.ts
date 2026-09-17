import { contractSchemas } from './schemas-registry.js';
import { inspectWire } from './ingress.js';
import { wireFailure } from '../diagnostics/wire.js';
import { canonicalJSON, parseInspectedSchema } from './parse-schema.js';
import type { Contract, ContractKind, Outcome } from './types.js';

/** A successful parse validates wire shape only. It grants no effect or business meaning. */
export function parseContract<K extends ContractKind>(kind: K, input: unknown): Outcome<Contract<K>> {
  const inspected = inspectWire(input);
  if (!inspected.ok) return inspected;
  if (!Object.hasOwn(contractSchemas, kind)) return wireFailure('wire.kind', 'The contract kind is not supported.');
  return parseInspectedSchema(isVersionedContract(kind), inspected.value, contractSchemas[kind]) as Outcome<
    Contract<K>
  >;
}

function isVersionedContract(kind: ContractKind): boolean {
  return kind === 'catalog' || kind === 'task' || kind === 'result' || kind === 'experience';
}

/** Stable object-key ordering; arrays, decimal scale and signed zero are preserved. */
export function serializeContract<K extends ContractKind>(kind: K, value: Contract<K>): Outcome<string> {
  const parsed = parseContract(kind, value);
  return parsed.ok ? { ok: true, value: canonicalJSON(parsed.value) } : parsed;
}
