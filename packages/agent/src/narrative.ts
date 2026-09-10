import {compareScalars, parseContract, scalarIdentity, validateScalar, type NarrativeCell, type NarrativeClaim, type OperationGrant, type Outcome, type ResultRef, type Scalar} from '@aeliqo/sdk-core';
import type {ResultHandle} from '@aeliqo/sdk-runtime/results';

/** Fresh host authority. A model may never supply this context or its resolver. */
export interface NarrativeAuthority {
  readonly principalKey: string;
  readonly scopeDigest: string;
  readonly policyRevision?: string;
  readonly catalogRevision: string;
  readonly functionRegistryDigest: string;
  readonly grants: readonly OperationGrant[];
  /** Only explicitly authorized live handles are exposed by the host. */
  readonly resolveResult: (ref: ResultRef) => ResultHandle | undefined;
}
export interface NarrativeVerifierOptions {
  readonly readContext: () => Outcome<NarrativeAuthority>;
  readonly maxRows?: number;
}
export type NarrativeReceipt =
  | {readonly state: 'verified'; readonly claim: Extract<NarrativeClaim, {kind: 'value' | 'comparison'}>; readonly evidence: readonly {readonly result: ResultRef; readonly generation: number}[]}
  | {readonly state: 'unverified'; readonly reason: 'interpretation' | 'false' | 'null-comparison'};

const fail = <T>(code: string, message: string): Outcome<T> => ({ok: false, diagnostics: [{code: `agent.narrative.${code}`, message, retryable: false}]});
function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
function pins(context: NarrativeAuthority): string {
  return canonical([context.principalKey, context.scopeDigest, context.policyRevision, context.catalogRevision, context.functionRegistryDigest, [...context.grants].sort()]);
}
function authorized(context: NarrativeAuthority): boolean {
  return [context.principalKey, context.scopeDigest, context.catalogRevision, context.functionRegistryDigest].every(value => typeof value === 'string' && value.length > 0) && context.grants.includes('result.inspect');
}

/** Verifies exact structured cells only. The receipt never certifies human intent or prose entailment. */
export function createNarrativeVerifier(options: NarrativeVerifierOptions) {
  const maxRows = options.maxRows ?? 100_000;
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1_000_000) throw new RangeError('maxRows must be between 1 and 1000000.');
  return {verify(input: unknown): Outcome<NarrativeReceipt> {
    try {
      const initial = options.readContext();
      if (!initial.ok || !authorized(initial.value)) return fail('denied', 'Result inspection is not authorized.');
      const context = initial.value;
      const initialPins = pins(context);
      const parsed = parseContract('narrative-claim', input);
      if (!parsed.ok) return parsed;
      const claim = parsed.value;
      if (claim.kind !== 'value' && claim.kind !== 'comparison') return {ok: true, value: {state: 'unverified', reason: 'interpretation'}};
      const used: {handle: ResultHandle; snapshot: ReturnType<ResultHandle['snapshot']>; ref: ResultRef}[] = [];
      let scanned = 0;
      function cellValue(cell: NarrativeCell): Outcome<Scalar> {
        if (cell.result.scopeDigest !== context.scopeDigest) return fail('stale', 'The claim scope is not current.');
        const handle = context.resolveResult(cell.result);
        if (handle === undefined) return fail('unavailable', 'The authorized result is unavailable.');
        const key = handle.key;
        if (key.principalKey !== context.principalKey || key.scopeDigest !== context.scopeDigest || key.policyRevision !== context.policyRevision || key.catalogRevision !== context.catalogRevision || key.functionRegistryDigest !== context.functionRegistryDigest) return fail('denied', 'The result authority has changed.');
        const snapshot = handle.snapshot();
        const descriptor = snapshot.descriptor;
        if (snapshot.status !== 'ready' || descriptor === undefined || !same(descriptor.ref, cell.result)) return fail('stale', 'The exact result revision is not ready.');
        if (descriptor.precision.kind !== 'exact' || descriptor.coverage.kind !== 'complete' || descriptor.consistency.kind !== 'snapshot' || descriptor.evidence.kind === 'inferred') return fail('unsupported', 'Exact complete observed or computed evidence is required.');
        if (descriptor.coverage.populationDigest !== cell.populationDigest || !same(descriptor.filters, cell.filters) || !same(descriptor.period, cell.period)) return fail('scope', 'The population, filters or period do not match.');
        const field = descriptor.fields.find(candidate => candidate.id === cell.field);
        if (field !== undefined && field.role === 'measure' && descriptor.evidence.kind === 'computed' && descriptor.evidence.definitions.length > 0 && field.derivation === undefined) return fail('definition', 'The computed metric lacks an explicit field definition mapping.');
        if (field === undefined || !same(field.type, cell.type) || !same(field.derivation, cell.definition)) return fail('field', 'The field type or definition does not match.');
        if (descriptor.evidence.kind === 'computed' && cell.definition !== undefined && !descriptor.evidence.definitions.some(ref => same(ref, cell.definition))) return fail('definition', 'The computation does not cite this definition.');
        if (descriptor.identity.length === 0 || !same([...descriptor.identity].sort(), Object.keys(cell.identity).sort())) return fail('identity', 'The claim must identify one complete stable row identity.');
        const identityFields = descriptor.identity.map(id => descriptor.fields.find(candidate => candidate.id === id));
        if (identityFields.some(field => field === undefined)) return fail('identity', 'The result identity is unavailable.');
        const expected: string[] = [];
        for (const field of identityFields) {
          const identity = scalarIdentity(cell.identity[field!.id], field!.type);
          if (!identity.ok) return fail('identity', 'The claim identity value is invalid.');
          expected.push(identity.value);
        }
        let matches = 0;
        let value: Scalar | undefined;
        for (const batch of snapshot.batches) for (const row of batch.rows) {
          if (++scanned > maxRows) return fail('budget', 'The claim verification row budget was reached.');
          const actual: string[] = [];
          for (const field of identityFields) {
            const identity = scalarIdentity(row[field!.id], field!.type);
            if (!identity.ok) return fail('identity', 'The result contains an invalid identity.');
            actual.push(identity.value);
          }
          if (same(actual, expected)) {
            matches++;
            const checked = validateScalar(row[cell.field], cell.type);
            if (!checked.ok) return fail('field', 'The result cell is invalid.');
            value = checked.value;
          }
        }
        if (matches !== 1 || value === undefined) return fail('identity', 'A unique matching result row is required.');
        used.push({handle, snapshot, ref: cell.result});
        return {ok: true, value};
      }
      let truth: boolean;
      let nullComparison = false;
      if (claim.kind === 'value') {
        const actual = cellValue(claim.cell); if (!actual.ok) return actual;
        const expected = validateScalar(claim.value, claim.cell.type); if (!expected.ok) return fail('value', 'The claim value has an invalid type.');
        const compared = compareScalars(actual.value, expected.value, claim.cell.type); if (!compared.ok) return compared;
        truth = actual.value === null && expected.value === null || compared.value === 0;
      } else {
        if (!same(claim.left.type, claim.right.type)) return fail('type', 'Comparison cells must have the same semantic type.');
        const left = cellValue(claim.left); if (!left.ok) return left;
        const right = cellValue(claim.right); if (!right.ok) return right;
        const compared = compareScalars(left.value, right.value, claim.left.type); if (!compared.ok) return compared;
        const order = compared.value;
        nullComparison = order === null;
        truth = order !== null && ({eq: order === 0, ne: order !== 0, lt: order < 0, lte: order <= 0, gt: order > 0, gte: order >= 0})[claim.relation];
      }
      const current = options.readContext();
      if (!current.ok || !authorized(current.value) || pins(current.value) !== initialPins) return fail('denied', 'Result authority changed during verification.');
      for (const entry of used) if (current.value.resolveResult(entry.ref) !== entry.handle) return fail('stale', 'Result evidence changed during verification.');
      const final = options.readContext();
      if (!final.ok || !authorized(final.value) || pins(final.value) !== initialPins) return fail('denied', 'Result authority changed during verification.');
      for (const entry of used) {
        const latest = entry.handle.snapshot();
        if (latest.status !== 'ready' || latest.generation !== entry.snapshot.generation || latest.descriptor !== entry.snapshot.descriptor || latest.batches !== entry.snapshot.batches || latest.loadedRows !== entry.snapshot.loadedRows) return fail('stale', 'Result evidence changed during verification.');
      }
      if (!truth) return {ok: true, value: {state: 'unverified', reason: nullComparison ? 'null-comparison' : 'false'}};
      return {ok: true, value: {state: 'verified', claim, evidence: used.map(({ref, handle}) => ({result: ref, generation: handle.generation}))}};
    } catch {return fail('unavailable', 'Claim verification could not obtain current authorized evidence.');}
  }};
}
