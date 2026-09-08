import {
  createCatalogIndex,
  parseCatalog,
  parseContract,
  serializeContract,
  authorizeMeaningActivation,
  validateMeaningBundle,
} from '@aeliqo/core';
import type {
  Catalog,
  CatalogEntity,
  Diagnostic,
  MeaningActivationReceipt,
  MeaningDefinition,
  MeaningBundle,
  Outcome,
  QuerySpec,
  ResultRef,
} from '@aeliqo/core';
import {WIRE_LIMITS} from '@aeliqo/core';
import {parseAcceptedQuery, parseCatalogRequest, parsePlanRequest} from './schema.js';
import type {
  AcceptedQuery,
  AuthorizeRead,
  CatalogPage,
  CatalogRequest,
  CatalogTarget,
  DataRecord,
  DataService,
  DataValue,
  LocalDataService,
  LocalDataServiceOptions,
  LocalSnapshot,
  MeaningRegistration,
  PlanAcceptance,
  PlanRequest,
  QueryBudget,
  ReadContext,
  ReadGrant,
  UnsupportedCapability,
} from './types.js';
import type {ResultEvent as DataResultEvent} from './types.js';

const DEFAULT_BUDGET: QueryBudget = Object.freeze({
  maxRows: 10_000,
  maxBytes: WIRE_LIMITS.bytes,
  maxMessages: 64,
  maxMilliseconds: 30_000,
  maxColumns: 128,
});
const DEFAULT_SCOPE = 'scope-public';
const SUPPORTED_OPERATIONS = Object.freeze(['projection', 'predicates', 'order', 'paging']);
const DEFAULT_PLAN_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_PLANS = 256;

interface StoredSnapshot {
  readonly catalog: Catalog;
  readonly sourceRevision: string;
  readonly records: Readonly<Record<string, readonly DataRecord[]>>;
}

interface SourceLimits {
  readonly rows: number;
  readonly bytes: number;
}

interface CursorValue {
  readonly kind: 'catalog' | 'data';
  readonly catalogRevision?: string;
  readonly target?: string;
  readonly queryDigest?: string;
  readonly scopeDigest?: string;
  readonly policyRevision?: string;
  readonly sourceRevision?: string;
  readonly offset: number;
}

interface EvaluationRow {
  readonly row: DataRecord;
  readonly index: number;
}

interface PredicateResult {
  readonly state: 'true' | 'false' | 'unknown';
}

type Predicate =
  | {readonly op: 'compare'; readonly field: string; readonly comparison: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'; readonly value: DataValue}
  | {readonly op: 'is-null'; readonly field: string; readonly negate: boolean}
  | {readonly op: 'in'; readonly field: string; readonly values: readonly DataValue[]}
  | {readonly op: 'and'; readonly predicates: readonly Predicate[]}
  | {readonly op: 'or'; readonly predicates: readonly Predicate[]}
  | {readonly op: 'not'; readonly predicate: Predicate};

function diagnostic(code: string, message: string, path?: readonly (string | number)[], remedies?: readonly string[]): Diagnostic {
  return {
    code,
    message,
    retryable: false,
    ...(path === undefined ? {} : {path: [...path]}),
    ...(remedies === undefined ? {} : {remedies: [...remedies]}),
  };
}

function failure<T>(code: string, message: string, path?: readonly (string | number)[], remedies?: readonly string[]): Outcome<T> {
  return {ok: false, diagnostics: [diagnostic(code, message, path, remedies)]};
}

function unsupported<T>(capability: UnsupportedCapability, path?: readonly (string | number)[]): Outcome<T> {
  return failure(
    'data.unsupported',
    `${capability.kind} capability ${capability.id} is not supported by this source: ${capability.reason}`,
    path,
    capability.alternatives,
  );
}

function isSafePositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function assertSafeId(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > WIRE_LIMITS.id || /[\s\u0000-\u001f\u007f]/u.test(value))
    throw new TypeError(`${label} must be a bounded nonempty identifier.`);
}

function deepFreezeRecord(record: DataRecord): DataRecord {
  const copy: Record<string, DataValue> = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value !== undefined && value !== null && typeof value === 'object')
      copy[key] = Object.freeze({decimal: value.decimal});
    else if (value !== undefined) copy[key] = value;
  }
  return Object.freeze(copy);
}

function validDecimal(value: string): boolean {
  return /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) && value.length <= 512;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

/** Fractional precision stays as decimal digits; Date only parses whole seconds. */
function instantParts(value: string): {epochMilliseconds: number; fraction: string} | undefined {
  if (value.length > WIRE_LIMITS.text) return undefined;
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (matched === null || !validDate(matched[1]!)) return undefined;
  if (Number(matched[2]) > 23 || Number(matched[3]) > 59 || Number(matched[4]) > 59) return undefined;
  if (matched[7] !== undefined && (Number(matched[7]) > 23 || Number(matched[8]) > 59)) return undefined;
  const epochMilliseconds = Date.parse(`${matched[1]}T${matched[2]}:${matched[3]}:${matched[4]}${matched[6]}`);
  if (!Number.isSafeInteger(epochMilliseconds)) return undefined;
  return {epochMilliseconds, fraction: (matched[5] ?? '').replace(/0+$/u, '')};
}

function validInstant(value: string): boolean {return instantParts(value) !== undefined;}

function validSourceValue(value: unknown, field: CatalogEntity['fields'][number]): value is DataValue {
  if (value === null) return field.type.nullable;
  if (typeof value === 'string') {
    if (value.length > WIRE_LIMITS.text) return false;
    if (field.type.value === 'date') return validDate(value);
    if (field.type.value === 'instant') return validInstant(value);
    return field.type.value === 'text';
  }
  if (typeof value === 'boolean') return field.type.value === 'boolean';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (field.type.value === 'integer') return Number.isSafeInteger(value);
    return field.type.value === 'float';
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return field.type.value === 'decimal' && Object.keys(record).length === 1 && typeof record.decimal === 'string' && validDecimal(record.decimal);
  }
  return false;
}

const DEFAULT_SOURCE_LIMITS: SourceLimits = Object.freeze({rows: WIRE_LIMITS.array, bytes: WIRE_LIMITS.bytes});

function normalizeSourceLimits(input: LocalDataServiceOptions['sourceLimits'] | undefined): SourceLimits {
  if (input === undefined) return DEFAULT_SOURCE_LIMITS;
  if (input === null || typeof input !== 'object' || Array.isArray(input) || !isSafePositive(input.rows) || !isSafePositive(input.bytes))
    throw new TypeError('sourceLimits must be bounded positive rows and bytes limits.');
  return Object.freeze({rows: input.rows, bytes: input.bytes});
}

function normalizeDecimalIdentity(value: string): string {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = unsigned.split('.');
  const normalizedFraction = fraction.replace(/0+$/u, '');
  if (whole === '0' && normalizedFraction.length === 0) return '0';
  return `${negative ? '-' : ''}${whole}${normalizedFraction.length === 0 ? '' : `.${normalizedFraction}`}`;
}

function identityPart(value: DataValue, fieldType: string): string {
  if (fieldType === 'decimal' && value !== null && typeof value === 'object')
    return `decimal:${normalizeDecimalIdentity(value.decimal)}`;
  if (fieldType === 'instant' && typeof value === 'string') {
    const parts = instantParts(value)!;
    return `instant:${parts.epochMilliseconds}:${parts.fraction}`;
  }
  if (typeof value === 'number' && value === 0) return `${fieldType}:0`;
  return `${fieldType}:${canonical(value)}`;
}

function sourceJsonBytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Local data snapshot contains a non-JSON source value.');
  return new TextEncoder().encode(serialized).byteLength;
}

function normalizeSnapshot(snapshot: LocalSnapshot, sourceLimits: SourceLimits): StoredSnapshot {
  const parsed = parseCatalog(snapshot.catalog);
  if (!parsed.ok) throw new TypeError('Local data snapshot catalog is not canonical.');
  const indexed = createCatalogIndex(parsed.value);
  if (!indexed.ok) throw new TypeError('Local data snapshot catalog has invalid entity, relationship or capability references.');
  if (parsed.value.entities.some(entity => entity.id === '__proto__' || entity.fields.some(field => field.id === '__proto__')))
    throw new TypeError('Local source identifiers must be representable as wire record keys.');
  assertSafeId(snapshot.sourceRevision, 'sourceRevision');
  if (!snapshot.records || typeof snapshot.records !== 'object' || Array.isArray(snapshot.records))
    throw new TypeError('Local data snapshot records must be an entity-to-records map.');
  if (Object.keys(snapshot.records).length > WIRE_LIMITS.properties)
    throw new TypeError('Local data snapshot records exceed the bounded entity map limit.');
  const records: Record<string, readonly DataRecord[]> = Object.create(null) as Record<string, readonly DataRecord[]>;
  const entities = new Map(parsed.value.entities.map((entity) => [entity.id, entity] as const));
  let totalRows = 0;
  let totalBytes = 0;
  const addCount = (count: number): void => {
    // Subtract first so accumulated byte counts cannot overflow a safe integer.
    if (count > sourceLimits.bytes - totalBytes) throw new TypeError('Local data snapshot exceeds the bounded source byte limit.');
    totalBytes += count;
  };
  const addBytes = (value: unknown): void => {addCount(sourceJsonBytes(value));};
  addCount(2); // Outer record-map braces.
  let firstEntity = true;
  for (const [entityId, rows] of Object.entries(snapshot.records)) {
    assertSafeId(entityId, 'entity id');
    const entity = entities.get(entityId);
    if (entity === undefined) throw new TypeError(`Rows reference unknown entity ${entityId}.`);
    if (!Array.isArray(rows)) throw new TypeError(`Rows for ${entityId} must be an array.`);
    if (rows.length > sourceLimits.rows - totalRows) throw new TypeError('Local data snapshot exceeds the bounded source row limit.');
    totalRows += rows.length;
    if (!firstEntity) addCount(1);
    firstEntity = false;
    addBytes(entityId);
    addCount(3); // Colon and array brackets.
    const identityKeys = new Set<string>();
    const fieldsById = new Map(entity.fields.map(field => [field.id, field]));
    records[entityId] = Object.freeze(Array.from({length: rows.length}, (_, rowIndex) => {
      const row = rows[rowIndex];
      if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new TypeError(`Row for ${entityId} must be a plain object.`);
      if (Object.getPrototypeOf(row) !== Object.prototype && Object.getPrototypeOf(row) !== null) throw new TypeError(`Row for ${entityId} must be a plain object.`);
      const keys = Object.keys(row);
      if (keys.length > WIRE_LIMITS.properties) throw new TypeError(`Row for ${entityId} exceeds the bounded field limit.`);
      addCount(2 + (rowIndex > 0 ? 1 : 0));
      for (const [index, key] of keys.entries()) {
        const field = fieldsById.get(key);
        const value = row[key];
        if (field === undefined || !validSourceValue(value, field)) throw new TypeError(`Row for ${entityId} has an invalid value for ${key}.`);
        // Only validated scalars are serialized. A large row is never stringified
        // wholesale before the source limit can reject it.
        addCount(1 + (index > 0 ? 1 : 0));
        addBytes(key);
        addBytes(value !== null && typeof value === 'object' ? {decimal: value.decimal} : value);
      }
      for (const field of entity.fields) {
        if (!field.type.nullable && (!Object.hasOwn(row, field.id) || row[field.id] === undefined || row[field.id] === null))
          throw new TypeError(`Row for ${entityId} is missing non-nullable field ${field.id}.`);
      }
      for (const identity of entity.identity) if (!Object.hasOwn(row, identity) || row[identity] === undefined || row[identity] === null) throw new TypeError(`Row for ${entityId} has an invalid identity field ${identity}.`);
      const identityKey = canonical(entity.identity.map(identity => identityPart(row[identity]!, fieldsById.get(identity)!.type.value)));
      if (identityKeys.has(identityKey)) throw new TypeError(`Rows for ${entityId} contain a duplicate identity tuple.`);
      identityKeys.add(identityKey);
      return deepFreezeRecord(row);
    }));
  }
  return Object.freeze({catalog: freezeCatalog(parsed.value), sourceRevision: snapshot.sourceRevision, records: Object.freeze(records)});
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const child of value) freezeDeep(child);
    } else {
      for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    }
  }
  return value;
}

function freezeCatalog(catalog: Catalog): Catalog { return freezeDeep(catalog); }

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'undefined' : encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function secureToken(prefix: string): string | undefined {
  const provider = globalThis.crypto;
  if (provider?.getRandomValues === undefined) return undefined;
  const bytes = new Uint8Array(16);
  provider.getRandomValues(bytes);
  let encoded = '';
  for (const byte of bytes) encoded += byte.toString(16).padStart(2, '0');
  return `${prefix}-${encoded}`;
}

async function digest(value: unknown, prefix: string): Promise<string> {
  const text = canonical(value);
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error('WebCrypto SHA-256 is required for ADC digests.');
  const bytes = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let encoded = '';
  for (const byte of bytes) encoded += byte.toString(16).padStart(2, '0');
  return `${prefix}-${encoded}`;
}

function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64Decode(value: string): string | undefined {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    return undefined;
  }
}

function encodeCursor(value: CursorValue): string { return base64Encode(canonical(value)); }

function decodeCursor(value: string): CursorValue | undefined {
  const text = base64Decode(value);
  if (text === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    if (record.kind !== 'catalog' && record.kind !== 'data') return undefined;
    if (!Number.isSafeInteger(record.offset) || (record.offset as number) < 0) return undefined;
    return {
      kind: record.kind,
      offset: record.offset as number,
      ...(typeof record.catalogRevision === 'string' ? {catalogRevision: record.catalogRevision} : {}),
      ...(typeof record.target === 'string' ? {target: record.target} : {}),
      ...(typeof record.queryDigest === 'string' ? {queryDigest: record.queryDigest} : {}),
      ...(typeof record.scopeDigest === 'string' ? {scopeDigest: record.scopeDigest} : {}),
      ...(typeof record.policyRevision === 'string' ? {policyRevision: record.policyRevision} : {}),
      ...(typeof record.sourceRevision === 'string' ? {sourceRevision: record.sourceRevision} : {}),
    };
  } catch {
    return undefined;
  }
}

function minBudget(requested: QueryBudget, host: QueryBudget, grant?: Partial<QueryBudget>): QueryBudget {
  const cap = (key: keyof QueryBudget): number => {
    const grantValue = grant?.[key];
    const grantLimit = grantValue === undefined ? Number.MAX_SAFE_INTEGER : grantValue;
    return Math.min(requested[key], host[key], grantLimit);
  };
  return Object.freeze({
    maxRows: cap('maxRows'), maxBytes: cap('maxBytes'), maxMessages: cap('maxMessages'),
    maxMilliseconds: cap('maxMilliseconds'), maxColumns: cap('maxColumns'),
  });
}

function getEntity(catalog: Catalog, entityId: string): CatalogEntity | undefined {
  return catalog.entities.find((entity) => entity.id === entityId);
}

function allowedEntity(grant: ReadGrant, entityId: string): boolean {
  return grant.entities === undefined || grant.entities.includes(entityId);
}

function allowedField(grant: ReadGrant, entityId: string, fieldId: string): boolean {
  if (grant.fields === undefined) return true;
  const fields = grant.fields[entityId];
  return fields !== undefined && fields.includes(fieldId);
}

function allowedIdentity(grant: ReadGrant, entity: CatalogEntity): boolean {
  return entity.identity.every((field) => allowedField(grant, entity.id, field));
}

function validateReadGrant(grant: ReadGrant): Outcome<ReadGrant> {
  try { assertSafeId(grant.scopeDigest, 'scopeDigest'); }
  catch { return failure('data.authorization', 'The ADC authorization returned an invalid scope digest.'); }
  if (grant.policyRevision !== undefined) {
    try { assertSafeId(grant.policyRevision, 'policyRevision'); }
    catch { return failure('data.authorization', 'The ADC authorization returned an invalid policy revision.'); }
  }
  if (grant.entities !== undefined) {
    if (!Array.isArray(grant.entities) || grant.entities.length > WIRE_LIMITS.array || new Set(grant.entities).size !== grant.entities.length)
      return failure('data.authorization', 'The ADC authorization returned an invalid entity scope.');
    for (const entity of grant.entities) {
      try { assertSafeId(entity, 'entity scope'); }
      catch { return failure('data.authorization', 'The ADC authorization returned an invalid entity scope.'); }
    }
  }
  if (grant.fields !== undefined) {
    if (typeof grant.fields !== 'object' || grant.fields === null || Array.isArray(grant.fields))
      return failure('data.authorization', 'The ADC authorization returned an invalid field scope.');
    for (const [entity, fields] of Object.entries(grant.fields)) {
      try { assertSafeId(entity, 'field scope entity'); }
      catch { return failure('data.authorization', 'The ADC authorization returned an invalid field scope.'); }
      if (!Array.isArray(fields) || fields.length > WIRE_LIMITS.array || new Set(fields).size !== fields.length)
        return failure('data.authorization', 'The ADC authorization returned an invalid field scope.');
      for (const field of fields) {
        try { assertSafeId(field, 'field scope'); }
        catch { return failure('data.authorization', 'The ADC authorization returned an invalid field scope.'); }
      }
    }
  }
  if (grant.maxBudget !== undefined) {
    if (typeof grant.maxBudget !== 'object' || grant.maxBudget === null || Array.isArray(grant.maxBudget))
      return failure('data.authorization', 'The ADC authorization returned an invalid budget.');
    for (const [key, value] of Object.entries(grant.maxBudget)) {
      if (!['maxRows', 'maxBytes', 'maxMessages', 'maxMilliseconds', 'maxColumns'].includes(key) || !isSafePositive(value as number))
        return failure('data.authorization', 'The ADC authorization returned an invalid budget.');
    }
  }
  if (grant.rowPolicy !== undefined && typeof grant.rowPolicy !== 'function')
    return failure('data.authorization', 'The ADC authorization returned an invalid row policy.');
  return {ok: true, value: grant};
}

function normalizeAuthorizationOutcome(value: unknown): Outcome<ReadGrant> {
  if (value !== null && typeof value === 'object' && (value as {readonly ok?: unknown}).ok === true)
    return validateReadGrant((value as {readonly value?: unknown}).value as ReadGrant);
  if (value !== null && typeof value === 'object' && (value as {readonly ok?: unknown}).ok === false) {
    const diagnosticsValue = (value as {readonly diagnostics?: unknown}).diagnostics;
    if (!Array.isArray(diagnosticsValue) || diagnosticsValue.length === 0 || diagnosticsValue.length > WIRE_LIMITS.diagnostics)
      return failure('data.authorization', 'The ADC authorization returned malformed diagnostics.');
    const diagnostics: Diagnostic[] = [];
    for (const candidate of diagnosticsValue) {
      const parsed = parseContract('result-event', {kind: 'error', requestId: 'authorization', error: candidate});
      if (!parsed.ok || parsed.value.kind !== 'error') return failure('data.authorization', 'The ADC authorization returned malformed diagnostics.');
      diagnostics.push(parsed.value.error);
    }
    return {ok: false, diagnostics: diagnostics as [Diagnostic, ...Diagnostic[]]};
  }
  return failure('data.authorization', 'The ADC authorization returned an invalid outcome.');
}

interface Deadline {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly cleanup: () => void;
}

function makeDeadline(context: ReadContext, milliseconds: number): Deadline {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (context.signal?.aborted) controller.abort();
  else context.signal?.addEventListener('abort', onParentAbort, {once: true});
  const delay = Math.min(Math.max(0, milliseconds), 2_147_483_647);
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, delay);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      context.signal?.removeEventListener('abort', onParentAbort);
    },
  };
}

function authorizeResult(
  authorize: AuthorizeRead | undefined,
  operation: 'describe' | 'plan' | 'execute',
  requestId: string,
  target: CatalogTarget | {readonly outputId: string},
  context: ReadContext,
  query?: QuerySpec,
): Promise<Outcome<ReadGrant>> {
  if (authorize === undefined) return Promise.resolve(context.signal?.aborted ? failure('data.aborted', 'The ADC authorization was cancelled.') : {ok: true, value: {scopeDigest: DEFAULT_SCOPE}});
  let pending: Promise<Outcome<ReadGrant>>;
  try {
    pending = Promise.resolve(authorize({operation, requestId, target, context, ...(query === undefined ? {} : {query})}));
  } catch {
    return Promise.resolve(failure('data.authorization', 'The ADC authorization failed.'));
  }
  if (context.signal === undefined) return pending.then(normalizeAuthorizationOutcome, () => failure('data.authorization', 'The ADC authorization failed.'));
  if (context.signal.aborted) return Promise.resolve(failure('data.aborted', 'The ADC authorization was cancelled.'));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Outcome<ReadGrant>) => {
      if (settled) return;
      settled = true;
      context.signal!.removeEventListener('abort', onAbort);
      resolve(result.ok ? validateReadGrant(result.value) : result);
    };
    const onAbort = () => finish(failure('data.aborted', 'The ADC authorization was cancelled.'));
    context.signal!.addEventListener('abort', onAbort, {once: true});
    pending.then((result) => finish(normalizeAuthorizationOutcome(result)), () => finish(failure('data.authorization', 'The ADC authorization failed.')));
  });
}

async function authorizeWithDeadline(
  authorize: AuthorizeRead | undefined,
  operation: 'describe' | 'plan' | 'execute',
  requestId: string,
  target: CatalogTarget | {readonly outputId: string},
  context: ReadContext,
  milliseconds: number,
  query?: QuerySpec,
): Promise<Outcome<ReadGrant>> {
  if (milliseconds <= 0) return context.signal?.aborted ? failure('data.aborted', 'The ADC authorization was cancelled.') : failure('data.budget', 'Authorization exceeded the effective time budget.');
  const deadline = makeDeadline(context, milliseconds);
  try {
    const result = await authorizeResult(authorize, operation, requestId, target, {...context, signal: deadline.signal}, query);
    if (deadline.timedOut() && !context.signal?.aborted) return failure('data.budget', 'Authorization exceeded the effective time budget.');
    return result;
  } finally {
    deadline.cleanup();
  }
}

async function digestWithDeadline(value: unknown, prefix: string, context: ReadContext, milliseconds: number): Promise<Outcome<string>> {
  if (milliseconds <= 0) return context.signal?.aborted ? failure('data.aborted', 'The ADC operation was cancelled.') : failure('data.budget', 'The ADC operation exceeded the effective time budget.');
  const deadline = makeDeadline(context, milliseconds);
  try {
    const result = await resolveValueWithAbort(digest(value, prefix), deadline.signal, 'data.crypto', 'WebCrypto SHA-256 is required for immutable ADC identities.');
    if (deadline.timedOut() && !context.signal?.aborted) return failure('data.budget', 'The ADC operation exceeded the effective time budget.');
    return result;
  } finally {
    deadline.cleanup();
  }
}

function resolveValueWithAbort<T>(value: Promise<T> | T, signal: AbortSignal | undefined, code: string, message: string): Promise<Outcome<T>> {
  let pending: Promise<T>;
  try { pending = Promise.resolve(value); }
  catch { return Promise.resolve(failure(code, message)); }
  if (signal === undefined) return pending.then((resolved) => ({ok: true, value: resolved} as const), () => failure(code, message));
  if (signal.aborted) return Promise.resolve(failure('data.aborted', 'The result execution was cancelled.'));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Outcome<T>) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => finish(failure('data.aborted', 'The result execution was cancelled.'));
    signal.addEventListener('abort', onAbort, {once: true});
    pending.then((resolved) => finish({ok: true, value: resolved}), () => finish(failure(code, message)));
  });
}

function mergeCatalogPage(catalog: Catalog, target: CatalogTarget, grant: ReadGrant, offset: number, pageSize: number, sourceRevision: string, scopeDigest: string): {catalog: Catalog; nextCursor?: string} {
  let entities = catalog.entities.filter((entity) => allowedEntity(grant, entity.id) && allowedIdentity(grant, entity) && entity.rowGrain.every((field) => allowedField(grant, entity.id, field)));
  if (target.kind === 'entity') entities = entities.filter((entity) => entity.id === target.entity);
  const page = entities.slice(offset, offset + pageSize);
  const entityIds = new Set(page.map((entity) => entity.id));
  const relationships = catalog.relationships.filter((relationship) => {
    if (!entityIds.has(relationship.sourceEntity) || !entityIds.has(relationship.targetEntity)) return false;
    return relationship.keys.every((key) => allowedField(grant, relationship.sourceEntity, key.sourceField) && allowedField(grant, relationship.targetEntity, key.targetField));
  });
  const visibleRelationshipRefs = new Set(relationships.map((relationship) => `${relationship.id}@${relationship.revision}`));
  const capabilities = catalog.capabilities.filter((capability) => {
    if (!entityIds.has(capability.entity)) return false;
    return capability.fields.every((field) => allowedField(grant, capability.entity, field))
      && capability.relations.every((relation) => visibleRelationshipRefs.has(`${relation.id}@${relation.revision}`));
  });
  const restrictedFields = grant.fields !== undefined;
  const pageEntities = page.map((entity) => {
    const fields = restrictedFields ? entity.fields.filter((field) => allowedField(grant, entity.id, field.id)) : entity.fields;
    return {...entity, fields};
  });
  const nextOffset = offset + page.length;
  return {
    catalog: {
      ...catalog,
      entities: pageEntities,
      relationships,
      capabilities,
      meanings: restrictedFields || grant.entities !== undefined ? [] : catalog.meanings,
    },
    ...(nextOffset < entities.length ? {nextCursor: encodeCursor({kind: 'catalog', catalogRevision: catalog.revision, target: canonical(target), sourceRevision, scopeDigest, ...(grant.policyRevision === undefined ? {} : {policyRevision: grant.policyRevision}), offset: nextOffset})} : {}),
  };
}

function fieldValue(row: DataRecord, field: string): DataValue | undefined {
  return Object.hasOwn(row, field) ? row[field] : undefined;
}

function decimalParts(value: {readonly decimal: string}): {coefficient: bigint; scale: number} {
  const negative = value.decimal.startsWith('-');
  const unsigned = negative ? value.decimal.slice(1) : value.decimal;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = `${whole}${fraction}`;
  const coefficient = BigInt(digits) * (negative ? -1n : 1n);
  return {coefficient, scale: fraction.length};
}

function compareDecimal(left: {readonly decimal: string}, right: {readonly decimal: string}): number {
  const a = decimalParts(left);
  const b = decimalParts(right);
  if (a.scale === b.scale) return a.coefficient < b.coefficient ? -1 : a.coefficient > b.coefficient ? 1 : 0;
  const scale = Math.max(a.scale, b.scale);
  const aa = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bb = b.coefficient * 10n ** BigInt(scale - b.scale);
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function compareCodePoints(left: string, right: string): number {
  const a = [...left];
  const b = [...right];
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aa = a[index]!.codePointAt(0)!;
    const bb = b[index]!.codePointAt(0)!;
    if (aa !== bb) return aa < bb ? -1 : 1;
  }
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}

function compareValues(left: DataValue, right: DataValue, type: string): number | undefined {
  if (left === null || right === null) return undefined;
  if (type === 'decimal') {
    if (typeof left !== 'object' || typeof right !== 'object') return undefined;
    return compareDecimal(left, right);
  }
  if (type === 'instant') {
    if (typeof left !== 'string' || typeof right !== 'string') return undefined;
    const a = instantParts(left);
    const b = instantParts(right);
    if (a === undefined || b === undefined) return undefined;
    if (a.epochMilliseconds !== b.epochMilliseconds) return a.epochMilliseconds < b.epochMilliseconds ? -1 : 1;
    const digits = Math.max(a.fraction.length, b.fraction.length);
    const fractionA = a.fraction.padEnd(digits, '0');
    const fractionB = b.fraction.padEnd(digits, '0');
    return fractionA < fractionB ? -1 : fractionA > fractionB ? 1 : 0;
  }
  if (type === 'date') {
    if (typeof left !== 'string' || typeof right !== 'string') return undefined;
    const a = Date.parse(left);
    const b = Date.parse(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof left === 'string' && typeof right === 'string') return compareCodePoints(left, right);
  if (typeof left === 'boolean' && typeof right === 'boolean') return left === right ? 0 : left ? 1 : -1;
  if (typeof left === 'number' && typeof right === 'number') return left < right ? -1 : left > right ? 1 : 0;
  return undefined;
}

function sameValue(left: DataValue, right: DataValue, type: string): boolean | undefined {
  if (left === null || right === null) return left === right;
  const compared = compareValues(left, right, type);
  return compared === undefined ? undefined : compared === 0;
}

function expectedValueType(type: string, value: DataValue): boolean {
  if (value === null) return true;
  if (type === 'text') return typeof value === 'string';
  if (type === 'date') return typeof value === 'string' && validDate(value);
  if (type === 'instant') return typeof value === 'string' && validInstant(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  if (type === 'float') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'decimal') return typeof value === 'object' && value !== null && typeof value.decimal === 'string';
  return false;
}

function predicateFields(predicate: Predicate | undefined, result: string[] = []): string[] {
  if (predicate === undefined) return result;
  if (predicate.op === 'and' || predicate.op === 'or') {
    for (const child of predicate.predicates) predicateFields(child, result);
    return result;
  }
  if (predicate.op === 'not') {
    predicateFields(predicate.predicate, result);
    return result;
  }
  result.push(predicate.field);
  return result;
}

function queryFields(query: QuerySpec): string[] {
  return [...query.fields, ...query.order.map((entry) => entry.field), ...predicateFields(query.where as unknown as Predicate | undefined)];
}

/** Cursor position is a continuation token, not part of the logical query identity. */
function normalizedQuery(query: QuerySpec): QuerySpec {
  if (query.page === undefined || query.page.cursor === undefined) return query;
  return {...query, page: {size: query.page.size}};
}

function validateQuery(query: QuerySpec, catalog: Catalog, grant: ReadGrant): Outcome<void> {
  const indexOutcome = createCatalogIndex(catalog);
  if (!indexOutcome.ok) return indexOutcome;
  if (!allowedEntity(grant, query.entity)) return failure('data.denied', 'The requested data is not available in the current authorization scope.', ['query', 'entity']);
  const entity = getEntity(catalog, query.entity);
  if (entity === undefined) return failure('data.invalid-entity', `Entity ${query.entity} is not available.`, ['query', 'entity']);
  if (!allowedIdentity(grant, entity) || !entity.rowGrain.every((field) => allowedField(grant, entity.id, field)))
    return failure('data.denied', 'The requested data is not available in the current authorization scope.', ['query', 'entity']);
  if (query.fields.length === 0) return failure('data.invalid-projection', 'A query must project at least one field.', ['query', 'fields']);
  if (new Set(query.fields).size !== query.fields.length) return failure('data.invalid-projection', 'Projection fields must be unique.', ['query', 'fields']);
  for (const identity of entity.identity) {
    if (!query.fields.includes(identity)) return unsupported({kind: 'source', id: 'identity-projection', reason: `Identity field ${identity} must be projected for stable result lineage.`, alternatives: ['Include all identity fields in the projection.']}, ['query', 'fields']);
  }
  if (query.measures.length > 0) return unsupported({kind: 'aggregation', id: 'measures', reason: 'The bounded local evaluator has no aggregate execution path.', alternatives: ['Use a host analytical capability.', 'Project source fields only.']}, ['query', 'measures']);
  if (query.relations.length > 0 || (query.relationUsage?.length ?? 0) > 0) return unsupported({kind: 'relation', id: 'relations', reason: 'Joins and relation expansion require an explicit host plan.', alternatives: ['Use an analytical host capability.']}, ['query', 'relations']);
  if (query.groupBy.length > 0) return unsupported({kind: 'grouping', id: 'groupBy', reason: 'Grouping is not part of the bounded local subset.', alternatives: ['Use a host analytical capability.']}, ['query', 'groupBy']);
  if (query.period !== undefined || query.timeBucket !== undefined) return unsupported({kind: 'operator', id: 'temporal', reason: 'Temporal filtering and bucketing are not inferred by the local evaluator.', alternatives: ['Provide a host capability with declared calendar semantics.']}, ['query', query.period === undefined ? 'timeBucket' : 'period']);
  if (query.population.kind !== 'all-authorized') return unsupported({kind: 'source', id: 'population', reason: 'Only the current bounded authorized source population is available locally.', alternatives: ['Use a host source with a stable cohort contract.']}, ['query', 'population']);
  for (let index = 0; index < query.fields.length; index += 1) {
    const field = query.fields[index]!;
    if (!allowedField(grant, query.entity, field)) return failure('data.denied', 'The requested data is not available in the current authorization scope.', ['query', 'fields', index]);
    const resolved = indexOutcome.value.resolveField(query.entity, field);
    if (!resolved.ok) return failure('data.invalid-field', `Field ${field} is not available on ${query.entity}.`, ['query', 'fields', index]);
  }
  for (const field of queryFields(query)) {
    if (!allowedField(grant, query.entity, field)) return failure('data.denied', 'The requested data is not available in the current authorization scope.', ['query']);
    const resolved = indexOutcome.value.resolveField(query.entity, field);
    if (!resolved.ok) return failure('data.invalid-field', `Field ${field} is not available on ${query.entity}.`, ['query']);
  }
  for (let index = 0; index < query.order.length; index += 1) {
    const entry = query.order[index]!;
    if (!query.fields.includes(entry.field)) return unsupported({kind: 'operator', id: 'order-projection', reason: 'Ordering by an unprojected field is outside the bounded projection subset.', alternatives: ['Project every order field.']}, ['query', 'order', index, 'field']);
  }
  const validatePredicateNode = (predicate: Predicate, path: readonly (string | number)[]): Outcome<void> => {
    if (predicate.op === 'and' || predicate.op === 'or') {
      for (let index = 0; index < predicate.predicates.length; index += 1) {
        const checked = validatePredicateNode(predicate.predicates[index]!, [...path, 'predicates', index]);
        if (!checked.ok) return checked;
      }
      return {ok: true, value: undefined};
    }
    if (predicate.op === 'not') return validatePredicateNode(predicate.predicate, [...path, 'predicate']);
    if (!allowedField(grant, query.entity, predicate.field)) return failure('data.denied', 'The requested data is not available in the current authorization scope.', path);
    const resolved = indexOutcome.value.resolveField(query.entity, predicate.field);
    if (!resolved.ok) return failure('data.invalid-field', `Field ${predicate.field} is not available on ${query.entity}.`, [...path, 'field']);
    if (predicate.op === 'compare') {
      if (predicate.value === null) return unsupported({kind: 'operator', id: 'compare-null', reason: 'Null comparisons are unknown; use is-null for explicit null checks.', alternatives: ['Use an is-null predicate.']}, [...path, 'value']);
      if (!expectedValueType(resolved.value.type.value, predicate.value)) return unsupported({kind: 'operator', id: 'typed-compare', reason: `Value type does not match field ${predicate.field}.`, alternatives: ['Use a value with the declared field type.']}, [...path, 'value']);
    } else if (predicate.op === 'in') {
      for (let index = 0; index < predicate.values.length; index += 1) {
        const value = predicate.values[index]!;
        if (value === null || !expectedValueType(resolved.value.type.value, value)) return unsupported({kind: 'operator', id: 'typed-in', reason: `Every membership value must match field ${predicate.field}; null membership is unknown.`, alternatives: ['Use typed non-null values or is-null.']}, [...path, 'values', index]);
      }
    }
    return {ok: true, value: undefined};
  };
  if (query.where !== undefined) return validatePredicateNode(query.where as unknown as Predicate, ['query', 'where']);
  return {ok: true, value: undefined};
}

function evaluatePredicate(predicate: Predicate, row: DataRecord, entity: CatalogEntity): PredicateResult {
  if (predicate.op === 'and' || predicate.op === 'or') {
    const children = predicate.predicates.map((child) => evaluatePredicate(child, row, entity).state);
    if (predicate.op === 'and') {
      if (children.includes('false')) return {state: 'false'};
      return {state: children.includes('unknown') ? 'unknown' : 'true'};
    }
    if (children.includes('true')) return {state: 'true'};
    return {state: children.includes('unknown') ? 'unknown' : 'false'};
  }
  if (predicate.op === 'not') {
    const child = evaluatePredicate(predicate.predicate, row, entity).state;
    return {state: child === 'true' ? 'false' : child === 'false' ? 'true' : 'unknown'};
  }
  const field = entity.fields.find((candidate) => candidate.id === predicate.field);
  if (field === undefined) return {state: 'unknown'};
  const actual = fieldValue(row, predicate.field);
  if (predicate.op === 'is-null') {
    const matched = actual === null;
    return {state: (predicate.negate ? !matched : matched) ? 'true' : 'false'};
  }
  if (actual === undefined || actual === null) return {state: 'unknown'};
  if (predicate.op === 'compare') {
    const compared = compareValues(actual, predicate.value, field.type.value);
    if (compared === undefined) return {state: 'unknown'};
    const matched = predicate.comparison === 'eq' ? compared === 0 : predicate.comparison === 'ne' ? compared !== 0 : predicate.comparison === 'lt' ? compared < 0 : predicate.comparison === 'lte' ? compared <= 0 : predicate.comparison === 'gt' ? compared > 0 : compared >= 0;
    return {state: matched ? 'true' : 'false'};
  }
  if (predicate.op !== 'in') return {state: 'unknown'};
  const matched = predicate.values.some((candidate: DataValue) => sameValue(actual, candidate, field.type.value) === true);
  return {state: matched ? 'true' : 'false'};
}

function compareRows(left: EvaluationRow, right: EvaluationRow, query: QuerySpec, entity: CatalogEntity): number {
  for (const order of query.order) {
    const field = entity.fields.find((candidate) => candidate.id === order.field);
    if (field === undefined) continue;
    const a = fieldValue(left.row, order.field);
    const b = fieldValue(right.row, order.field);
    let compared: number;
    if (a === undefined || a === null) compared = b === undefined || b === null ? 0 : order.nulls === 'first' ? -1 : 1;
    else if (b === undefined || b === null) compared = order.nulls === 'first' ? 1 : -1;
    else compared = compareValues(a, b, field.type.value) ?? 0;
    if (compared !== 0) {
      const eitherNull = a === undefined || a === null || b === undefined || b === null;
      return eitherNull || order.direction === 'asc' ? compared : -compared;
    }
  }
  for (const identity of entity.identity) {
    const field = entity.fields.find((candidate) => candidate.id === identity);
    if (field === undefined) continue;
    const a = fieldValue(left.row, identity);
    const b = fieldValue(right.row, identity);
    if (a === undefined || b === undefined) continue;
    const compared = compareValues(a, b, field.type.value);
    if (compared !== undefined && compared !== 0) return compared;
  }
  return left.index - right.index;
}

function resultError(requestId: string, code: string, message: string): DataResultEvent {
  return {kind: 'error', requestId, error: diagnostic(code, message)};
}

function resultReference(accepted: AcceptedQuery, resultId: string): ResultRef {
  return {id: resultId, revision: accepted.sourceRevision, outputId: accepted.target.outputId, queryDigest: accepted.queryDigest, scopeDigest: accepted.scopeDigest};
}

function eventBytes(event: DataResultEvent): number {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`).byteLength;
}

function pageCursor(accepted: AcceptedQuery, offset: number): string {
  return encodeCursor({kind: 'data', queryDigest: accepted.queryDigest, scopeDigest: accepted.scopeDigest, sourceRevision: accepted.sourceRevision, catalogRevision: accepted.catalogRevision, target: accepted.target.outputId, ...(accepted.policyRevision === undefined ? {} : {policyRevision: accepted.policyRevision}), offset});
}

function acceptedParts(value: AcceptedQuery | PlanAcceptance): AcceptedQuery {
  const {kind: _kind, supported: _supported, ...accepted} = value as PlanAcceptance;
  return accepted as AcceptedQuery;
}

function sameAccepted(left: AcceptedQuery | PlanAcceptance, right: AcceptedQuery): boolean {
  return canonical(acceptedParts(left)) === canonical(acceptedParts(right));
}

export function createLocalDataService(options: LocalDataServiceOptions): LocalDataService {
  const sourceLimits = normalizeSourceLimits(options.sourceLimits);
  let snapshot = normalizeSnapshot(options.snapshot, sourceLimits);
  let currentCatalog = snapshot.catalog;
  const plans = new Map<string, PlanAcceptance>();
  const registeredBundles = new Map<string, MeaningRegistration>();
  const planTtlMs = options.planTtlMs ?? DEFAULT_PLAN_TTL_MS;
  const maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS;
  if (!isSafePositive(planTtlMs) || planTtlMs > 86_400_000) throw new TypeError('planTtlMs must be a bounded positive duration.');
  if (!isSafePositive(maxPlans) || maxPlans > 10_000) throw new TypeError('maxPlans must be a bounded positive count.');
  const reapPlans = (now: number) => {
    for (const [key, plan] of plans) if (plan.expiresAt <= now) plans.delete(key);
    while (plans.size >= maxPlans) {
      const oldest = [...plans.entries()].sort((left, right) => left[1].expiresAt - right[1].expiresAt)[0];
      if (oldest === undefined) break;
      plans.delete(oldest[0]);
    }
  };

  const service: LocalDataService = {
    get catalog() { return currentCatalog; },
    get sourceRevision() { return snapshot.sourceRevision; },

    async describe(request, context = {}) {
      const startedAt = Date.now();
      const initialCatalog = currentCatalog;
      const initialSnapshot = snapshot;
      const parsed = parseCatalogRequest(request);
      if (!parsed.ok) return parsed;
      const input = parsed.value;
      if (input.catalogRevision !== null && input.catalogRevision !== currentCatalog.revision)
        return failure('data.stale-catalog', 'The requested catalog revision is no longer current.', ['catalogRevision']);
      const grant = await authorizeWithDeadline(options.authorize, 'describe', input.requestId, input.target, context, Math.min(input.budget.maxMilliseconds, options.hostBudget?.maxMilliseconds ?? DEFAULT_BUDGET.maxMilliseconds));
      if (!grant.ok) return grant;
      if (context.signal?.aborted) return failure('data.aborted', 'The catalog request was cancelled.');
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) return failure('data.stale-catalog', 'The catalog or source changed while authorization was being resolved.');
      if (!allowedTarget(input.target, currentCatalog, grant.value)) return failure('data.denied', 'The requested catalog target is not available in the current authorization scope.', ['target']);
      const effectiveBudget = minBudget(input.budget, options.hostBudget ?? DEFAULT_BUDGET, grant.value.maxBudget);
      if (Date.now() - startedAt > effectiveBudget.maxMilliseconds) return failure('data.budget', 'Discovery exceeded the effective time budget.', ['budget']);
      const pageSize = Math.min(input.pageSize ?? Math.min(100, WIRE_LIMITS.array), effectiveBudget.maxRows);
      if (!isSafePositive(pageSize) || pageSize > WIRE_LIMITS.array) return failure('data.budget', 'Catalog page size exceeds the bounded discovery budget.', ['pageSize']);
      let offset = 0;
      if (input.cursor !== undefined) {
        const cursor = decodeCursor(input.cursor);
        if (cursor?.kind !== 'catalog' || cursor.catalogRevision !== currentCatalog.revision || cursor.scopeDigest !== grant.value.scopeDigest || cursor.policyRevision !== grant.value.policyRevision || cursor.sourceRevision !== snapshot.sourceRevision || cursor.target !== canonical(input.target)) return failure('data.stale-cursor', 'The catalog cursor does not belong to the current catalog, source, target or authorization scope.', ['cursor']);
        offset = cursor.offset;
      }
      const page = mergeCatalogPage(currentCatalog, input.target, grant.value, offset, pageSize, snapshot.sourceRevision, grant.value.scopeDigest);
      const catalog = parseCatalog(page.catalog);
      if (!catalog.ok) return failure('data.catalog', 'The authorized catalog projection is not canonical.');
      if (context.signal?.aborted) return failure('data.aborted', 'The catalog request was cancelled.');
      if (Date.now() - startedAt > effectiveBudget.maxMilliseconds) return failure('data.budget', 'Discovery exceeded the effective time budget.', ['budget']);
      const pageValue: CatalogPage = {
        version: '1', requestId: input.requestId, catalog: catalog.value, catalogRevision: currentCatalog.revision,
        sourceRevision: snapshot.sourceRevision, scopeDigest: grant.value.scopeDigest, target: input.target, effectiveBudget,
        ...(page.nextCursor === undefined ? {} : {nextCursor: page.nextCursor}),
      };
      const columnCount = pageValue.catalog.entities.reduce((count, entity) => count + entity.fields.length, 0);
      if (columnCount > effectiveBudget.maxColumns) return failure('data.budget', 'Discovery exceeds the effective column budget.', ['budget', 'maxColumns']);
      if (new TextEncoder().encode(JSON.stringify(pageValue)).byteLength > effectiveBudget.maxBytes)
        return failure('data.budget', 'Discovery exceeds the effective response byte budget.', ['budget', 'maxBytes']);
      return {ok: true, value: pageValue};
    },

    async plan(request, context = {}) {
      const startedAt = Date.now();
      const initialCatalog = currentCatalog;
      const initialSnapshot = snapshot;
      const parsed = parsePlanRequest(request);
      if (!parsed.ok) return parsed;
      const input = parsed.value;
      if (input.catalogRevision !== currentCatalog.revision)
        return failure('data.stale-catalog', 'The plan must pin the current catalog revision.', ['catalogRevision']);
      const grant = await authorizeWithDeadline(options.authorize, 'plan', input.requestId, input.target, context, Math.min(input.budget.maxMilliseconds, options.hostBudget?.maxMilliseconds ?? DEFAULT_BUDGET.maxMilliseconds), input.query);
      if (!grant.ok) return grant;
      if (context.signal?.aborted) return failure('data.aborted', 'The ADC plan was cancelled.');
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot)
        return failure('data.stale-plan', 'The catalog or source changed while authorization was being resolved.');
      if (grant.value.rowPolicy !== undefined && grant.value.policyRevision === undefined)
        return failure('data.authorization', 'A row policy must declare a policy revision before a plan can be accepted.');
      const checked = validateQuery(input.query, currentCatalog, grant.value);
      if (!checked.ok) return checked;
      const selected = new Set(input.query.fields);
      if (selected.size > Math.min(input.budget.maxColumns, options.hostBudget?.maxColumns ?? DEFAULT_BUDGET.maxColumns, grant.value.maxBudget?.maxColumns ?? Number.MAX_SAFE_INTEGER))
        return failure('data.budget', 'The requested projection exceeds the effective column budget.', ['query', 'fields']);
      const hostBudget = options.hostBudget ?? DEFAULT_BUDGET;
      const effectiveBudget = minBudget(input.budget, hostBudget, grant.value.maxBudget);
      const capability = currentCatalog.capabilities.find((candidate) => candidate.entity === input.query.entity);
      const maxOutputRows = capability?.maxOutputRows;
      const boundedBudget = Object.freeze({
        ...effectiveBudget,
        ...(maxOutputRows === undefined ? {} : {maxRows: Math.min(effectiveBudget.maxRows, maxOutputRows)}),
      });
      if (boundedBudget.maxMessages < 3 || boundedBudget.maxRows < 1 || boundedBudget.maxColumns < selected.size)
        return failure('data.budget', 'The effective budget cannot carry a descriptor and a bounded result.', ['budget']);
      if (Date.now() - startedAt > boundedBudget.maxMilliseconds) return failure('data.budget', 'Planning exceeded the effective time budget.', ['budget']);
      const querySerialized = serializeContract('query', normalizedQuery(input.query));
      if (!querySerialized.ok) return querySerialized;
      const queryDigestOutcome = await digestWithDeadline(querySerialized.value, 'query', context, boundedBudget.maxMilliseconds - (Date.now() - startedAt));
      if (!queryDigestOutcome.ok) return queryDigestOutcome;
      const queryDigest = queryDigestOutcome.value;
      if (context.signal?.aborted) return failure('data.aborted', 'The ADC plan was cancelled.');
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) return failure('data.stale-plan', 'The catalog or source changed while the plan identity was being computed.');
      if (input.query.page?.cursor !== undefined) {
        const cursor = decodeCursor(input.query.page.cursor);
        if (cursor?.kind !== 'data' || cursor.queryDigest !== queryDigest || cursor.scopeDigest !== grant.value.scopeDigest || cursor.policyRevision !== grant.value.policyRevision || cursor.sourceRevision !== snapshot.sourceRevision || cursor.catalogRevision !== currentCatalog.revision || cursor.target !== input.target.outputId)
          return failure('data.stale-cursor', 'The query cursor does not belong to this query, scope, target or source revision.', ['query', 'page', 'cursor']);
      }
      const populationDigestOutcome = await digestWithDeadline(
        {queryDigest, scopeDigest: grant.value.scopeDigest, sourceRevision: snapshot.sourceRevision, catalogRevision: currentCatalog.revision, ...(grant.value.policyRevision === undefined ? {} : {policyRevision: grant.value.policyRevision})},
        'population',
        context,
        boundedBudget.maxMilliseconds - (Date.now() - startedAt),
      );
      if (!populationDigestOutcome.ok) return populationDigestOutcome;
      const populationDigest = populationDigestOutcome.value;
      if (context.signal?.aborted) return failure('data.aborted', 'The ADC plan was cancelled.');
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) return failure('data.stale-plan', 'The catalog or source changed while the plan population identity was being computed.');
      if (Date.now() - startedAt > boundedBudget.maxMilliseconds) return failure('data.budget', 'Planning exceeded the effective time budget.', ['budget']);
      const expiresAt = Date.now() + planTtlMs;
      const acceptedBase: AcceptedQuery = {
        version: '1', requestId: input.requestId, target: input.target, catalogRevision: currentCatalog.revision,
        sourceRevision: snapshot.sourceRevision, scopeDigest: grant.value.scopeDigest, queryDigest, populationDigest,
        planDigest: '', expiresAt, functionRegistryDigest: currentCatalog.functionRegistryDigest,
        ...(grant.value.policyRevision === undefined ? {} : {policyRevision: grant.value.policyRevision}),
        query: input.query, effectiveBudget: boundedBudget,
      };
      const planDigestOutcome = await digestWithDeadline({...acceptedBase, planDigest: ''}, 'plan', context, boundedBudget.maxMilliseconds - (Date.now() - startedAt));
      if (!planDigestOutcome.ok) return planDigestOutcome;
      const planDigest = planDigestOutcome.value;
      if (context.signal?.aborted) return failure('data.aborted', 'The ADC plan was cancelled.');
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) return failure('data.stale-plan', 'The catalog or source changed while the plan identity was being computed.');
      if (Date.now() - startedAt > boundedBudget.maxMilliseconds) return failure('data.budget', 'Planning exceeded the effective time budget.', ['budget']);
      const accepted: PlanAcceptance = {
        ...acceptedBase, kind: 'accepted', planDigest, supported: SUPPORTED_OPERATIONS,
      };
      const storedAccepted = freezeDeep(accepted);
      reapPlans(Date.now());
      plans.set(planDigest, storedAccepted);
      return {ok: true, value: storedAccepted};
    },

    async *execute(request, context = {}) {
      const startedAt = Date.now();
      const initialCatalog = currentCatalog;
      const initialSnapshot = snapshot;
      const parsed = parseAcceptedQuery(request);
      if (!parsed.ok) {
        const requestId = typeof request === 'object' && request !== null && 'requestId' in request && typeof request.requestId === 'string' ? request.requestId : 'execute';
        yield resultError(requestId, 'data.accepted-query', 'The accepted plan handle is invalid.');
        return;
      }
      const input = parsed.value;
      const stored = plans.get(input.planDigest);
      if (stored === undefined || Date.now() >= stored.expiresAt || !sameAccepted(stored, input)) {
        yield resultError(input.requestId, stored !== undefined && Date.now() >= stored.expiresAt ? 'data.expired-plan' : 'data.stale-plan', stored !== undefined && Date.now() >= stored.expiresAt ? 'The accepted plan handle has expired.' : 'The accepted plan handle is unknown, changed or expired.');
        return;
      }
      if (stored.functionRegistryDigest !== currentCatalog.functionRegistryDigest) {
        yield resultError(input.requestId, 'data.stale-plan', 'The accepted plan is pinned to a different function registry digest.');
        return;
      }
      if (snapshot.sourceRevision !== stored.sourceRevision || currentCatalog.revision !== stored.catalogRevision) {
        yield resultError(input.requestId, 'data.stale-plan', 'The accepted plan is stale for the current catalog or source revision.');
        return;
      }
      const initialRemaining = input.effectiveBudget.maxMilliseconds - (Date.now() - startedAt);
      const grant = await authorizeWithDeadline(options.authorize, 'execute', input.requestId, input.target, context, initialRemaining, input.query);
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) {
        yield resultError(input.requestId, 'data.stale-plan', 'The catalog or source changed while authorization was being resolved.');
        return;
      }
      if (!grant.ok) {
        yield resultError(input.requestId, grant.diagnostics[0]?.code ?? 'data.denied', grant.diagnostics[0]?.message ?? 'The execution was denied.');
        return;
      }
      if (context.signal?.aborted) {
        yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        return;
      }
      const checked = validateQuery(input.query, currentCatalog, grant.value);
      if (!checked.ok) {
        yield resultError(input.requestId, checked.diagnostics[0]?.code ?? 'data.invalid-query', checked.diagnostics[0]?.message ?? 'The execution query is no longer authorized.');
        return;
      }
      if (grant.value.scopeDigest !== stored.scopeDigest || grant.value.policyRevision !== stored.policyRevision || !allowedEntity(grant.value, input.query.entity)) {
        yield resultError(input.requestId, 'data.denied', 'The execution authorization scope or policy revision changed.');
        return;
      }
      const executionBudget = minBudget(stored.effectiveBudget, options.hostBudget ?? DEFAULT_BUDGET, grant.value.maxBudget);
      if (executionBudget.maxColumns < input.query.fields.length) {
        yield resultError(input.requestId, 'data.budget', 'The current authorization has a tighter projection budget.');
        return;
      }
      if (Date.now() - startedAt > executionBudget.maxMilliseconds) {
        yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget before reading rows.');
        return;
      }
      if (context.signal?.aborted) {
        yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        return;
      }
      const entity = getEntity(currentCatalog, input.query.entity);
      if (entity === undefined) {
        yield resultError(input.requestId, 'data.invalid-entity', 'The accepted plan refers to an unavailable entity.');
        return;
      }
      const populationDigest = stored.populationDigest;
      const resultIdOutcome = await digestWithDeadline({planDigest: stored.planDigest, requestId: input.requestId}, 'result', context, executionBudget.maxMilliseconds - (Date.now() - startedAt));
      if (!resultIdOutcome.ok) {
        yield resultError(input.requestId, resultIdOutcome.diagnostics[0]?.code ?? 'data.crypto', resultIdOutcome.diagnostics[0]?.message ?? 'The result identity could not be computed.');
        return;
      }
      const resultId = resultIdOutcome.value;
      if (context.signal?.aborted) {
        yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        return;
      }
      if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) {
        yield resultError(input.requestId, 'data.stale-plan', 'The catalog or source changed while the result identity was being computed.');
        return;
      }
      const ref = resultReference(stored, resultId);
      const sourceRows = snapshot.records[input.query.entity] ?? [];
      const evaluated: EvaluationRow[] = [];
      for (let index = 0; index < sourceRows.length; index += 1) {
        if (context.signal?.aborted) {
          yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
          return;
        }
        if (Date.now() - startedAt > executionBudget.maxMilliseconds) {
          yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while scanning rows.');
          return;
        }
        const row = sourceRows[index]!;
        if (grant.value.rowPolicy !== undefined) {
          const remaining = executionBudget.maxMilliseconds - (Date.now() - startedAt);
          if (remaining <= 0) {
            yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while authorizing rows.');
            return;
          }
          const policyDeadline = makeDeadline(context, remaining);
          let decision: Promise<boolean> | boolean;
          try { decision = grant.value.rowPolicy({entityId: input.query.entity, row, query: input.query, context: {...context, signal: policyDeadline.signal}}); }
          catch {
            policyDeadline.cleanup();
            yield resultError(input.requestId, 'data.denied', 'The host row policy could not authorize the requested row.');
            return;
          }
          const permission = await resolveValueWithAbort(
            decision,
            policyDeadline.signal,
            'data.denied',
            'The host row policy could not authorize the requested row.',
          );
          const policyTimedOut = policyDeadline.timedOut();
          policyDeadline.cleanup();
          if (policyTimedOut && !context.signal?.aborted) {
            yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while authorizing rows.');
            return;
          }
          if (!permission.ok) {
            yield resultError(input.requestId, permission.diagnostics[0]?.code ?? 'data.denied', permission.diagnostics[0]?.message ?? 'The host row policy could not authorize the requested row.');
            return;
          }
          const permitted = permission.value;
          if (typeof permitted !== 'boolean') {
            yield resultError(input.requestId, 'data.denied', 'The host row policy could not authorize the requested row.');
            return;
          }
          if (currentCatalog !== initialCatalog || snapshot !== initialSnapshot) {
            yield resultError(input.requestId, 'data.stale-plan', 'The catalog or source changed while row authorization was being resolved.');
            return;
          }
          if (!permitted) continue;
        }
        if (input.query.where !== undefined && evaluatePredicate(input.query.where as unknown as Predicate, row, entity).state !== 'true') continue;
        evaluated.push({row, index});
      }
      if (Date.now() - startedAt > executionBudget.maxMilliseconds) {
        yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while filtering rows.');
        return;
      }
      evaluated.sort((left, right) => compareRows(left, right, input.query, entity));
      if (context.signal?.aborted) {
        yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        return;
      }
      if (Date.now() - startedAt > executionBudget.maxMilliseconds) {
        yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while ordering rows.');
        return;
      }
      const requestedOffset = input.query.page?.cursor === undefined ? 0 : (decodeCursor(input.query.page.cursor)?.offset ?? 0);
      const pageLimit = input.query.page?.size ?? Number.MAX_SAFE_INTEGER;
      const available = evaluated.slice(requestedOffset);
      let outputRows: DataRecord[] = [];
      let partialReason: string | undefined = requestedOffset > 0 ? 'page' : undefined;
      for (const evaluatedRow of available) {
        if (outputRows.length >= pageLimit) { partialReason = 'page'; break; }
        if (outputRows.length >= executionBudget.maxRows) { partialReason = 'row budget'; break; }
        if (Date.now() - startedAt > executionBudget.maxMilliseconds) { partialReason = 'time budget'; break; }
        const projected: Record<string, DataValue> = {};
        for (const field of input.query.fields) {
          const value = fieldValue(evaluatedRow.row, field);
          if (value !== undefined) projected[field] = value;
        }
        outputRows.push(Object.freeze(projected));
      }
      if (requestedOffset + outputRows.length < evaluated.length && partialReason === undefined) partialReason = 'page';
      const descriptorBase = {
        version: '1' as const, ref, taskId: input.requestId,
        fields: entity.fields.filter((field) => input.query.fields.includes(field.id)),
        identity: entity.identity, rowGrain: entity.rowGrain,
        precision: {kind: 'exact' as const},
        consistency: {kind: 'snapshot' as const, snapshotId: stored.sourceRevision, sourceRevisions: {[entity.id]: stored.sourceRevision}},
        evidence: {kind: 'observed' as const, source: {id: 'local-source', revision: stored.sourceRevision}},
        filters: input.query.where === undefined ? [] : [input.query.where], warnings: [], lineage: [],
      };
      const makeCoverage = () => partialReason === undefined
        ? {kind: 'complete' as const, populationDigest}
        : {kind: 'partial' as const, populationDigest, reason: partialReason};
      const makeDescriptor = (): DataResultEvent => ({kind: 'descriptor', descriptor: {
        ...descriptorBase, counts: {loaded: outputRows.length, population: {kind: 'exact', value: evaluated.length, populationDigest}}, coverage: makeCoverage(),
      }});
      const nextOffset = () => requestedOffset + outputRows.length;
      const makeComplete = (): DataResultEvent => ({kind: 'complete', result: ref, finalCoverage: makeCoverage(), ...(partialReason === undefined || nextOffset() >= evaluated.length ? {} : {cursor: pageCursor(stored, nextOffset())})});
      const includeProgress = executionBudget.maxMessages >= 4;
      let descriptor = makeDescriptor();
      let batch: DataResultEvent | undefined = outputRows.length > 0 ? {kind: 'batch', result: ref, sequence: 0, rows: outputRows} : undefined;
      let progress: DataResultEvent | undefined = includeProgress ? {kind: 'progress', result: ref, completed: outputRows.length, total: evaluated.length, unit: 'rows'} : undefined;
      let complete = makeComplete();
      let fitFailure: 'aborted' | 'budget' | undefined;
      const fits = () => {
        if (context.signal?.aborted) { fitFailure = 'aborted'; return false; }
        if (Date.now() - startedAt > executionBudget.maxMilliseconds) { fitFailure = 'budget'; return false; }
        descriptor = makeDescriptor();
        batch = outputRows.length > 0 ? {kind: 'batch', result: ref, sequence: 0, rows: outputRows} : undefined;
        progress = includeProgress ? {kind: 'progress', result: ref, completed: outputRows.length, total: evaluated.length, unit: 'rows'} : undefined;
        complete = makeComplete();
        return eventBytes(descriptor) + (batch === undefined ? 0 : eventBytes(batch)) + (progress === undefined ? 0 : eventBytes(progress)) + eventBytes(complete) <= executionBudget.maxBytes;
      };
      let responseFits = fits();
      if (!responseFits && fitFailure === undefined && outputRows.length > 0) {
        const candidates = outputRows;
        let low = 0;
        let high = candidates.length;
        let best = -1;
        partialReason = 'byte budget';
        while (low <= high && fitFailure === undefined) {
          const middle = Math.ceil((low + high) / 2);
          outputRows = candidates.slice(0, middle);
          if (fits()) {
            best = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
        if (best >= 0) outputRows = candidates.slice(0, best);
        responseFits = fitFailure === undefined && fits();
      }
      if (fitFailure === 'aborted') {
        yield resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        return;
      }
      if (fitFailure === 'budget') {
        yield resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while bounding the response.');
        return;
      }
      if (!responseFits) {
        yield resultError(input.requestId, 'data.budget', 'The bounded result cannot fit the effective response byte budget.');
        return;
      }
      const yieldFailure = (): DataResultEvent | undefined => {
        if (context.signal?.aborted) return resultError(input.requestId, 'data.aborted', 'The result execution was cancelled.');
        if (Date.now() - startedAt > executionBudget.maxMilliseconds) return resultError(input.requestId, 'data.budget', 'Execution exceeded the effective time budget while emitting the response.');
        return undefined;
      };
      let pendingFailure = yieldFailure();
      if (pendingFailure !== undefined) { yield pendingFailure; return; }
      yield descriptor;
      if (batch !== undefined) {
        pendingFailure = yieldFailure();
        if (pendingFailure !== undefined) { yield pendingFailure; return; }
        yield batch;
      }
      if (progress !== undefined) {
        pendingFailure = yieldFailure();
        if (pendingFailure !== undefined) { yield pendingFailure; return; }
        yield progress;
      }
      pendingFailure = yieldFailure();
      if (pendingFailure !== undefined) { yield pendingFailure; return; }
      yield complete;
      return;
    },

    replaceSnapshot(next) {
      let normalized: StoredSnapshot;
      try { normalized = normalizeSnapshot(next, sourceLimits); }
      catch { return failure('data.source-shape', 'The replacement source snapshot is not a bounded canonical source.'); }
      if (normalized.sourceRevision === snapshot.sourceRevision && canonical(normalized.records) !== canonical(snapshot.records))
        return failure('data.source-revision-conflict', 'Source records changed without a new immutable source revision.', ['sourceRevision']);
      snapshot = normalized;
      currentCatalog = normalized.catalog;
      plans.clear();
      registeredBundles.clear();
      return {ok: true, value: undefined};
    },

    registerMeaningBundle(bundle) {
      const control = options.meaningActivation;
      if (control === undefined) return failure('data.meaning-controlplane', 'Meaning registration requires a host-owned activation policy and function registry.');
      const bundleKey = canonical(bundle);
      const existingBundle = registeredBundles.get(bundleKey);
      if (existingBundle !== undefined) {
        const replayBundle: MeaningBundle = {
          catalogRevision: currentCatalog.revision,
          functionRegistryDigest: bundle.functionRegistryDigest,
          meanings: existingBundle.meanings,
        };
        const replayed = validateMeaningBundle(replayBundle, {
          catalog: currentCatalog,
          registry: control.registry,
          definitions: currentCatalog.meanings,
          policy: {allowHostCapabilities: true},
        });
        if (!replayed.ok) return replayed;
        const receipts: MeaningActivationReceipt[] = [];
        for (const meaning of replayed.value.meanings) {
          if (meaning.origin === 'ai-assisted') return failure('data.meaning-origin', 'Only reviewed code-owned meanings may enter the local activation control plane.', ['meanings']);
          const activation = authorizeMeaningActivation(meaning, control.policy);
          if (!activation.ok) return activation;
          receipts.push(activation.value);
        }
        const registration: MeaningRegistration = freezeDeep({catalogRevision: currentCatalog.revision, meanings: replayed.value.meanings, receipts, idempotent: true});
        registeredBundles.set(bundleKey, registration);
        return {ok: true, value: registration};
      }
      if (bundle.catalogRevision !== currentCatalog.revision)
        return failure('data.stale-catalog', 'Meaning registration must pin the current catalog revision.', ['catalogRevision']);
      const validated = validateMeaningBundle(bundle, {
        catalog: currentCatalog,
        registry: control.registry,
        definitions: currentCatalog.meanings,
        policy: {allowHostCapabilities: true},
      });
      if (!validated.ok) return validated;
      for (const meaning of validated.value.meanings) {
        if (meaning.origin === 'ai-assisted') return failure('data.meaning-origin', 'Only reviewed code-owned meanings may enter the local activation control plane.', ['meanings']);
      }
      const added: MeaningDefinition[] = [];
      for (const meaning of validated.value.meanings) {
        const prior = currentCatalog.meanings.find((candidate) => candidate.id === meaning.id && candidate.revision === meaning.revision);
        if (prior !== undefined) {
          if (canonical(prior) !== canonical(meaning)) return failure('data.meaning-conflict', `Meaning ${meaning.id}@${meaning.revision} conflicts with the current catalog.`, ['meanings']);
          continue;
        }
        added.push(meaning);
      }
      const receipts: MeaningActivationReceipt[] = [];
      for (const meaning of validated.value.meanings) {
        const activation = authorizeMeaningActivation(meaning, control.policy);
        if (!activation.ok) return activation;
        receipts.push(activation.value);
      }
      if (added.length > 0) {
        const nextRevision = secureToken('catalog');
        if (nextRevision === undefined) return failure('data.crypto', 'WebCrypto random values are required for immutable catalog revisions.');
        const nextCatalogInput = {...currentCatalog, revision: nextRevision, meanings: [...currentCatalog.meanings, ...added]};
        const nextCatalog = parseCatalog(nextCatalogInput);
        if (!nextCatalog.ok) return nextCatalog;
        currentCatalog = freezeCatalog(nextCatalog.value);
        plans.clear();
      }
      const registration: MeaningRegistration = freezeDeep({catalogRevision: currentCatalog.revision, meanings: validated.value.meanings, receipts, idempotent: false});
      registeredBundles.set(bundleKey, registration);
      return {ok: true, value: registration};
    },
  };
  return service;
}

function allowedTarget(target: CatalogTarget, catalog: Catalog, grant: ReadGrant): boolean {
  if (target.kind === 'catalog') return true;
  const entity = getEntity(catalog, target.entity);
  return entity !== undefined && allowedEntity(grant, target.entity) && allowedIdentity(grant, entity) && entity.rowGrain.every((field) => allowedField(grant, entity.id, field));
}

export {DEFAULT_BUDGET, DEFAULT_SOURCE_LIMITS};
