import {scalarIdentity, WIRE_LIMITS} from '@aeliqo/sdk-core';
import type {Catalog, Diagnostic, Outcome, QuerySpec, Result, ResultRef, SemanticType} from '@aeliqo/sdk-core';
import type {DataValue} from '../data/types.js';
import type {ResultHandle, ResultSnapshot} from '../results/types.js';
import type {CohortMembership, CohortRequest, CohortResolver, CohortResolverContext} from './types.js';

function failure<T = never>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  const diagnostic: Diagnostic = {code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})};
  return {ok: false, diagnostics: [diagnostic]};
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function sameRef(left: ResultRef, right: ResultRef): boolean {
  return left.id === right.id && left.revision === right.revision && left.outputId === right.outputId
    && left.queryDigest === right.queryDigest && left.scopeDigest === right.scopeDigest;
}

function sameType(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value || left.nullable !== right.nullable || canonical(left.unit) !== canonical(right.unit) || canonical(left.temporal) !== canonical(right.temporal)) return false;
  if (left.grain !== undefined && right.grain !== undefined) {
    const normalize = (grain: readonly string[]) => [...grain].sort().map(fieldSuffix);
    if (canonical(normalize(left.grain)) !== canonical(normalize(right.grain))) return false;
  }
  return true;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validDate(value: string): boolean {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (matched === null) return false;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function validInstant(value: string): boolean {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (matched === null || !validDate(`${matched[1]}-${matched[2]}-${matched[3]}`)) return false;
  if (Number(matched[4]) > 23 || Number(matched[5]) > 59 || Number(matched[6]) > 59) return false;
  return matched[8] === 'Z' || (Number(matched[9]) <= 23 && Number(matched[10]) <= 59);
}

function validValue(value: DataValue, type: SemanticType): boolean {
  if (value === null) return type.nullable;
  if (type.value === 'text') return typeof value === 'string';
  if (type.value === 'date') return typeof value === 'string' && validDate(value);
  if (type.value === 'instant') return typeof value === 'string' && validInstant(value);
  if (type.value === 'boolean') return typeof value === 'boolean';
  if (type.value === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  if (type.value === 'float') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof value.decimal === 'string' && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value.decimal);
}

function tupleKey(tuple: readonly DataValue[], types: readonly SemanticType[]): Outcome<string> {
  if (tuple.length !== types.length) return failure('runtime.evaluation-grain', 'Cohort identity tuple arity does not match its declared types.');
  const identities: string[] = [];
  for (let index = 0; index < tuple.length; index++) {
    const identity = scalarIdentity(tuple[index], types[index]!);
    if (!identity.ok) return failure('runtime.evaluation-grain', 'Cohort identity value does not match its declared scalar type.');
    identities.push(identity.value);
  }
  return {ok: true, value: canonical(identities)};
}

function fieldSuffix(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === 'string') return parsed[1];
  } catch { /* Opaque field identifiers remain exact. */ }
  return value;
}

function entityFor(catalog: Catalog, id: string): Catalog['entities'][number] | undefined {
  return catalog.entities.find((entity) => entity.id === id);
}

function fieldFor(entity: Catalog['entities'][number], requested: string): Catalog['entities'][number]['fields'][number] | undefined {
  const exact = entity.fields.find((field) => field.id === requested);
  if (exact !== undefined) return exact;
  const suffix = fieldSuffix(requested);
  const matches = entity.fields.filter((field) => field.id === suffix || fieldSuffix(field.id) === suffix);
  return matches.length === 1 ? matches[0] : undefined;
}

function sameTargetType(left: SemanticType, right: SemanticType): boolean {
  if (left.value !== right.value || left.nullable !== right.nullable || canonical(left.unit) !== canonical(right.unit) || canonical(left.temporal) !== canonical(right.temporal)) return false;
  if (left.grain !== undefined && right.grain !== undefined) {
    const normalize = (grain: readonly string[]) => [...grain].sort().map(fieldSuffix);
    if (canonical(normalize(left.grain)) !== canonical(normalize(right.grain))) return false;
  }
  return true;
}

function cohortPredicate(entity: string, keys: readonly string[], tuples: readonly (readonly DataValue[])[]): NonNullable<QuerySpec['where']> {
  const compare = (tuple: readonly DataValue[]): NonNullable<QuerySpec['where']> => {
    const predicates = keys.map((field, index) => ({op: 'compare' as const, field, entity, comparison: 'eq' as const, value: tuple[index] as DataValue}));
    return predicates.length === 1 ? predicates[0]! : {op: 'and' as const, predicates};
  };
  if (tuples.length === 0) return {op: 'in', field: keys[0]!, entity, values: []};
  if (keys.length === 1) return {op: 'in', field: keys[0]!, entity, values: tuples.map((tuple) => tuple[0]!) };
  const predicates = tuples.map(compare);
  return predicates.length === 1 ? predicates[0]! : {op: 'or' as const, predicates};
}

/**
 * Bind a trusted cohort to a normal query predicate. The accepted ADC query
 * retains its fixed population; this internal planner form carries the
 * bounded, typed membership predicate as an all-authorized execution input.
 */
export function lowerCohortQuery(query: QuerySpec, membership: CohortMembership, catalog: Catalog): Outcome<QuerySpec> {
  const entity = entityFor(catalog, query.entity);
  if (entity === undefined) return failure('runtime.evaluation-grain', 'The task query entity is absent from the trusted catalog.', ['entity']);
  if (query.page?.cursor !== undefined) return failure('runtime.evaluation-unsupported', 'Paged cohort follow-ups require a cursor bound to the original cohort query.', ['page', 'cursor']);
  if (membership.identityKeys.length === 0) return failure('runtime.evaluation-invalid', 'A cohort requires at least one target identity field.');
  const targetFields: string[] = [];
  for (let index = 0; index < membership.identityKeys.length; index++) {
    const requested = membership.identityKeys[index]!;
    const target = fieldFor(entity, requested);
    if (target === undefined) return failure('runtime.evaluation-grain', 'The cohort identity field is not present or is ambiguous in the target query entity.', ['population', 'identityKeys', index]);
    if (!sameTargetType(target.type, membership.types[index]!)) return failure('runtime.evaluation-grain', 'The cohort identity field type does not match the target catalog field.', ['population', 'identityKeys', index]);
    targetFields.push(target.id);
  }
  const predicate = cohortPredicate(query.entity, targetFields, membership.tuples);
  const where: NonNullable<QuerySpec['where']> = query.where === undefined ? predicate : {op: 'and' as const, predicates: [predicate, query.where]};
  // The fixed population remains on the accepted wire query. The pure core
  // planner receives this lowered all-authorized form after the host resolver
  // has checked the complete membership and inserted its typed predicate.
  return {ok: true, value: {...query, population: {kind: 'all-authorized' as const}, where}};
}

function findField(result: Result, key: string): Result['fields'][number] | undefined {
  const exact = result.fields.find((field) => field.id === key);
  if (exact !== undefined) return exact;
  const suffix = fieldSuffix(key);
  const matches = result.fields.filter((field) => field.id === suffix || fieldSuffix(field.id) === suffix);
  return matches.length === 1 ? matches[0] : undefined;
}

function grainHas(grain: readonly string[], fieldId: string, requested: string): boolean {
  return grain.includes(fieldId) || grain.includes(requested) || grain.some((candidate) => fieldSuffix(candidate) === fieldSuffix(fieldId));
}

function catalogField(catalog: Catalog, requested: string): {readonly entity: string; readonly field: Catalog['entities'][number]['fields'][number]} | undefined {
  const suffix = fieldSuffix(requested);
  const matches: {readonly entity: string; readonly field: Catalog['entities'][number]['fields'][number]}[] = [];
  for (const entity of catalog.entities) {
    for (const field of entity.fields) {
      if (field.id === requested || field.id === suffix) matches.push({entity: entity.id, field});
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function deadlineFailure<T = never>(request: CohortRequest, context: CohortResolverContext): Outcome<T> | undefined {
  if (request.signal?.aborted || context.readContext.signal?.aborted) return failure('runtime.evaluation-cancelled', 'Cohort resolution was cancelled.');
  const now = context.now();
  if (!Number.isFinite(now) || now >= request.deadlineAt) return failure('runtime.evaluation-budget', 'Cohort resolution exceeded its deadline.');
  return undefined;
}

function resultRows(snapshot: ResultSnapshot): readonly Record<string, DataValue>[] {
  const rows: Record<string, DataValue>[] = [];
  for (const batch of snapshot.batches) for (const row of batch.rows) rows.push(row as Record<string, DataValue>);
  return rows;
}

function authorityCheck(request: CohortRequest, context: CohortResolverContext, handle: ResultHandle): Outcome<void> {
  if (!context.grants.includes('result.inspect')) return failure('runtime.evaluation-denied', 'The host did not grant result inspection for cohort membership.');
  if (request.scopeDigest !== context.scopeDigest) return failure('runtime.evaluation-denied', 'The cohort request scope does not match the fresh host authority.', ['scopeDigest']);
  if (handle.key.principalKey !== context.principalKey) return failure('runtime.evaluation-denied', 'The cohort source belongs to a different authenticated principal.');
  if (request.catalogRevision !== context.catalogRevision || handle.key.catalogRevision !== context.catalogRevision)
    return failure('runtime.evaluation-stale', 'The cohort result is bound to a different catalog revision.', ['catalogRevision']);
  if (handle.key.scopeDigest !== context.scopeDigest) return failure('runtime.evaluation-denied', 'The cohort result is outside the current authorization scope.');
  if (handle.key.policyRevision !== context.policyRevision)
    return failure('runtime.evaluation-denied', 'The cohort result policy revision is no longer authorized.', ['policyRevision']);
  if (handle.key.functionRegistryDigest !== context.functionRegistryDigest)
    return failure('runtime.evaluation-stale', 'The cohort result uses a different function registry revision.');
  if (request.sourceRevision !== undefined && request.sourceRevision !== handle.key.sourceRevision)
    return failure('runtime.evaluation-stale', 'The requested historical cohort source revision is unavailable.', ['sourceRevision']);
  return {ok: true, value: undefined};
}

/**
 * Compute the digest that a fixed population must carry in its wire query.
 * The digest is over the trusted, deduplicated membership and its authority
 * pins; a caller-provided string is never accepted as proof by itself.
 */
export async function cohortDigest(input: {
  readonly source: ResultRef;
  readonly identityKeys: readonly string[];
  readonly types: readonly SemanticType[];
  readonly tuples: readonly (readonly DataValue[])[];
  readonly scopeDigest: string;
  readonly policyRevision?: string;
  readonly catalogRevision: string;
  readonly sourceRevision: string;
}): Promise<Outcome<string>> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return failure('runtime.evaluation-crypto', 'WebCrypto SHA-256 is required for cohort identities.');
  try {
    // Membership is a set, while each tuple's position remains meaningful for
    // composite identities. scalarIdentity supplies the typed canonical form
    // (including decimal, signed-zero and instant equivalence); sorting those
    // identities makes the digest stable when source row order changes.
    const tuples: string[] = [];
    for (const tuple of input.tuples) {
      const key = tupleKey(tuple, input.types);
      if (!key.ok) return key;
      tuples.push(key.value);
    }
    tuples.sort((left, right) => left.localeCompare(right));
    const encoded = new TextEncoder().encode(canonical({...input, tuples}));
    const bytes = new Uint8Array(await subtle.digest('SHA-256', encoded));
    let hex = '';
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
    return {ok: true, value: `cohort-${hex}`};
  } catch {
    return failure('runtime.evaluation-crypto', 'The cohort identity could not be hashed.');
  }
}

export interface ResultCohortResolverOptions {
  readonly maxTuples?: number;
  readonly maxBytes?: number;
}

/** Resolver over host-owned ResultHandles; it never trusts a wire ResultRef alone. */
export function createResultCohortResolver(options: ResultCohortResolverOptions = {}): CohortResolver {
  const maxTuples = options.maxTuples ?? 10_000;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  if (!Number.isSafeInteger(maxTuples) || maxTuples < 1 || maxTuples > WIRE_LIMITS.array) throw new TypeError('maxTuples must be a bounded positive count.');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > WIRE_LIMITS.bytes) throw new TypeError('maxBytes must be a bounded positive byte limit.');
  return {
    async resolve(request, context) {
      if (!safeId(request.source.id) || !safeId(request.source.revision) || !safeId(request.source.outputId) || !safeId(request.source.queryDigest) || !safeId(request.source.scopeDigest))
        return failure('runtime.evaluation-invalid', 'The cohort source reference is not a bounded canonical identifier.');
      if (!Array.isArray(request.identityKeys) || request.identityKeys.length === 0 || request.identityKeys.length > WIRE_LIMITS.array)
        return failure('runtime.evaluation-invalid', 'A cohort requires a bounded non-empty identity key list.', ['identityKeys']);
      if (new Set(request.identityKeys).size !== request.identityKeys.length || request.identityKeys.some((key) => !safeId(key)))
        return failure('runtime.evaluation-invalid', 'Cohort identity keys must be unique bounded identifiers.', ['identityKeys']);
      const expired = deadlineFailure(request, context);
      if (expired !== undefined) return expired;
      let handle: ResultHandle | undefined;
      try { handle = context.resolveResult(request.source); } catch { return failure('runtime.evaluation-denied', 'The host result resolver failed.'); }
      if (handle === undefined) return failure('runtime.evaluation-denied', 'The cohort source is not a host-owned live result.');
      let lease;
      try { lease = handle.retain(); }
      catch { return failure('runtime.evaluation-denied', 'The cohort source could not be retained.'); }
      try {
        const authority = authorityCheck(request, context, handle);
        if (!authority.ok) return authority;
        const snapshot = handle.snapshot();
        const descriptor = snapshot.descriptor;
        if (descriptor === undefined || !sameRef(descriptor.ref, request.source)) return failure('runtime.evaluation-stale', 'The cohort source descriptor does not match the requested immutable reference.');
        if (snapshot.status !== 'ready' || descriptor.coverage.kind !== 'complete') return failure('runtime.evaluation-incomplete', 'A cohort requires a complete ready result; partial or sampled pages cannot define membership.');
        if (descriptor.consistency.kind !== 'snapshot' || descriptor.consistency.snapshotId !== handle.key.sourceRevision)
          return failure('runtime.evaluation-stale', 'The cohort source does not carry one stable source snapshot.');
        if (request.source.scopeDigest !== context.scopeDigest) return failure('runtime.evaluation-denied', 'The cohort source reference is outside the current scope.');
        if (request.targetGrain !== undefined && request.targetGrain.some((key) => !safeId(key))) return failure('runtime.evaluation-invalid', 'The target grain contains an invalid field identifier.', ['targetGrain']);
        const fields = request.identityKeys.map((key) => findField(descriptor, key));
        if (fields.some((field) => field === undefined)) return failure('runtime.evaluation-grain', 'Every cohort identity key must be a unique field in the source result.', ['identityKeys']);
        const selected = fields as (Result['fields'][number])[];
        for (let index = 0; index < selected.length; index++) {
          const field = selected[index]!;
          if (!grainHas(descriptor.rowGrain, field.id, request.identityKeys[index]!)) return failure('runtime.evaluation-grain', 'Cohort identity keys must be present in the source row grain.', ['identityKeys', index]);
          const catalog = catalogField(context.catalog, request.identityKeys[index]!);
          if (catalog !== undefined && !sameType(field.type, catalog.field.type)) return failure('runtime.evaluation-grain', 'Cohort identity field semantics do not match the authorized catalog.', ['identityKeys', index]);
        }
        const rows = resultRows(snapshot);
        if (rows.length !== snapshot.loadedRows) return failure('runtime.evaluation-incomplete', 'The retained result batches do not match the result store row count.');
        if (descriptor.counts.population.kind !== 'exact' || descriptor.counts.population.value !== rows.length)
          return failure('runtime.evaluation-incomplete', 'A complete cohort source must declare an exact population count.');
        const tuples: (readonly DataValue[])[] = [];
        const seen = new Set<string>();
        let bytes = 0;
        for (const row of rows) {
          const expiredRow = deadlineFailure(request, context);
          if (expiredRow !== undefined) return expiredRow;
          const tuple: DataValue[] = [];
          for (const field of selected) {
            const value = row[field.id];
            if (value === undefined || !validValue(value, field.type) || value === null)
              return failure('runtime.evaluation-grain', 'Cohort identity values must be present, typed and non-null.');
            tuple.push(value);
          }
          const key = tupleKey(tuple, selected.map((field) => field.type));
          if (!key.ok) return key;
          if (seen.has(key.value)) continue;
          seen.add(key.value);
          tuples.push(Object.freeze(tuple));
          if (tuples.length > maxTuples) return failure('runtime.evaluation-budget', 'The cohort exceeds its bounded identity tuple budget.');
          bytes += new TextEncoder().encode(key.value).byteLength;
          if (bytes > maxBytes) return failure('runtime.evaluation-budget', 'The cohort exceeds its bounded identity byte budget.');
        }
        const types = selected.map((field) => field.type);
        const sourceRevision = handle.key.sourceRevision;
        const digest = await cohortDigest({source: descriptor.ref, identityKeys: request.identityKeys, types, tuples, scopeDigest: context.scopeDigest, ...(context.policyRevision === undefined ? {} : {policyRevision: context.policyRevision}), catalogRevision: context.catalogRevision, sourceRevision});
        if (!digest.ok) return digest;
        const lineage = new Map<string, ResultRef>();
        lineage.set(canonical(descriptor.ref), descriptor.ref);
        for (const entry of descriptor.lineage) for (const input of entry.inputs) lineage.set(canonical(input), input);
        const membership: CohortMembership = Object.freeze({source: descriptor.ref, identityKeys: Object.freeze([...request.identityKeys]), types: Object.freeze([...types]), tuples: Object.freeze(tuples), tupleDigest: digest.value, scopeDigest: context.scopeDigest, ...(context.policyRevision === undefined ? {} : {policyRevision: context.policyRevision}), catalogRevision: context.catalogRevision, sourceRevision, lineage: Object.freeze([...lineage.values()]), complete: true as const});
        return {ok: true, value: membership};
      } finally {
        lease.release();
      }
    },
  };
}
