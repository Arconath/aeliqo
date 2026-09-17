import { parseCatalog, WIRE_LIMITS } from '@aeliqo/core';
import type { Catalog } from '@aeliqo/core';
import { createCatalogIndex } from '@aeliqo/core/semantics';
import type { CatalogEntity } from '@aeliqo/core/semantics';
import type { DataRecord, DataValue, LocalDataServiceOptions, LocalSnapshot } from '../types.js';
import { assertSafeId, canonical } from './shared.js';
import type { SourceLimits } from './shared.js';

export interface StoredSnapshot {
  readonly catalog: Catalog;
  readonly sourceRevision: string;
  readonly records: Readonly<Record<string, readonly DataRecord[]>>;
}

interface ByteBudget {
  readonly limits: SourceLimits;
  rows: number;
  bytes: number;
}

export const DEFAULT_SOURCE_LIMITS: SourceLimits = Object.freeze({ rows: WIRE_LIMITS.array, bytes: WIRE_LIMITS.bytes });

export function normalizeSourceLimits(input: LocalDataServiceOptions['sourceLimits'] | undefined): SourceLimits {
  if (input === undefined) return DEFAULT_SOURCE_LIMITS;
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !Number.isSafeInteger(input.rows) ||
    input.rows < 1 ||
    !Number.isSafeInteger(input.bytes) ||
    input.bytes < 1
  )
    throw new TypeError('sourceLimits must be bounded positive rows and bytes limits.');
  return Object.freeze({ rows: input.rows, bytes: input.bytes });
}

function validDecimal(value: string): boolean {
  return /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value) && value.length <= 512;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function instantParts(value: string): { readonly epochMilliseconds: number; readonly fraction: string } | undefined {
  if (value.length > WIRE_LIMITS.text) return undefined;
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (matched === null || !validDate(matched[1]!)) return undefined;
  if (Number(matched[2]) > 23 || Number(matched[3]) > 59 || Number(matched[4]) > 59) return undefined;
  if (invalidOffset(matched[7], matched[8])) return undefined;
  const epochMilliseconds = Date.parse(`${matched[1]}T${matched[2]}:${matched[3]}:${matched[4]}${matched[6]}`);
  if (!Number.isSafeInteger(epochMilliseconds)) return undefined;
  return { epochMilliseconds, fraction: (matched[5] ?? '').replace(/0+$/u, '') };
}

function invalidOffset(hours: string | undefined, minutes: string | undefined): boolean {
  return hours !== undefined && (Number(hours) > 23 || Number(minutes) > 59);
}

function validSourceString(value: string, field: CatalogEntity['fields'][number]): boolean {
  if (value.length > WIRE_LIMITS.text) return false;
  if (field.type.value === 'date') return validDate(value);
  if (field.type.value === 'instant') return instantParts(value) !== undefined;
  return field.type.value === 'text';
}

function validDecimalRecord(value: object, field: CatalogEntity['fields'][number]): boolean {
  if (field.type.value !== 'decimal' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && typeof record.decimal === 'string' && validDecimal(record.decimal);
}

function validSourceValue(value: unknown, field: CatalogEntity['fields'][number]): value is DataValue {
  if (value === null) return field.type.nullable;
  if (typeof value === 'string') return validSourceString(value, field);
  if (typeof value === 'boolean') return field.type.value === 'boolean';
  if (typeof value === 'number') return validSourceNumber(value, field);
  if (typeof value === 'object') return validDecimalRecord(value, field);
  return false;
}

function validSourceNumber(value: number, field: CatalogEntity['fields'][number]): boolean {
  if (!Number.isFinite(value)) return false;
  if (field.type.value === 'integer') return Number.isSafeInteger(value);
  return field.type.value === 'float';
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

function addBytes(budget: ByteBudget, value: unknown): void {
  addCount(budget, sourceJsonBytes(value));
}

function addCount(budget: ByteBudget, count: number): void {
  if (count > budget.limits.bytes - budget.bytes)
    throw new TypeError('Local data snapshot exceeds the bounded source byte limit.');
  budget.bytes += count;
}

function catalogForSnapshot(catalog: Catalog): Catalog {
  const parsed = parseCatalog(catalog);
  if (!parsed.ok) throw new TypeError('Local data snapshot catalog is not canonical.');
  const indexed = createCatalogIndex(parsed.value);
  if (!indexed.ok)
    throw new TypeError('Local data snapshot catalog has invalid entity, relationship or capability references.');
  const invalidKeys = parsed.value.entities.some(
    (entity) => entity.id === '__proto__' || entity.fields.some((field) => field.id === '__proto__'),
  );
  if (invalidKeys) throw new TypeError('Local source identifiers must be representable as wire record keys.');
  return parsed.value;
}

function createByteBudget(limits: SourceLimits): ByteBudget {
  const budget = { limits, rows: 0, bytes: 0 };
  addCount(budget, 2);
  return budget;
}

function assertSnapshotRecords(records: LocalSnapshot['records']): void {
  if (records === null || typeof records !== 'object' || Array.isArray(records))
    throw new TypeError('Local data snapshot records must be an entity-to-records map.');
  if (Object.keys(records).length > WIRE_LIMITS.properties)
    throw new TypeError('Local data snapshot records exceed the bounded entity map limit.');
}

function normalizeEntityRows(
  entityId: string,
  rows: readonly DataRecord[],
  entity: CatalogEntity,
  budget: ByteBudget,
): readonly DataRecord[] {
  if (!Array.isArray(rows)) throw new TypeError(`Rows for ${entityId} must be an array.`);
  if (rows.length > budget.limits.rows - budget.rows)
    throw new TypeError('Local data snapshot exceeds the bounded source row limit.');
  budget.rows += rows.length;
  addCount(budget, 3);
  const identityKeys = new Set<string>();
  const fields = new Map(entity.fields.map((field) => [field.id, field]));
  const normalized: DataRecord[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    if (rowIndex > 0) addCount(budget, 1);
    normalized.push(normalizeRow(row, rowIndex, entity, fields, identityKeys, budget));
  }
  return Object.freeze(normalized);
}

function normalizeRow(
  row: DataRecord,
  rowIndex: number,
  entity: CatalogEntity,
  fields: ReadonlyMap<string, CatalogEntity['fields'][number]>,
  identityKeys: Set<string>,
  budget: ByteBudget,
): DataRecord {
  assertPlainRecord(row, entity.id);
  const keys = Object.keys(row);
  if (keys.length > WIRE_LIMITS.properties)
    throw new TypeError(`Row for ${entity.id} exceeds the bounded field limit.`);
  addCount(budget, 2 + (rowIndex > 0 ? 1 : 0));
  writeValidatedFields(row, keys, fields, entity.id, budget);
  validateRequiredFields(row, entity);
  validateIdentityFields(row, entity);
  const identityKey = canonical(
    entity.identity.map((identity) => identityPart(row[identity]!, fields.get(identity)!.type.value)),
  );
  if (identityKeys.has(identityKey)) throw new TypeError(`Rows for ${entity.id} contain a duplicate identity tuple.`);
  identityKeys.add(identityKey);
  return deepFreezeRecord(row);
}

function assertPlainRecord(row: unknown, entityId: string): asserts row is DataRecord {
  if (row === null || typeof row !== 'object' || Array.isArray(row))
    throw new TypeError(`Row for ${entityId} must be a plain object.`);
  const prototype = Object.getPrototypeOf(row);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`Row for ${entityId} must be a plain object.`);
}

function writeValidatedFields(
  row: DataRecord,
  keys: readonly string[],
  fields: ReadonlyMap<string, CatalogEntity['fields'][number]>,
  entityId: string,
  budget: ByteBudget,
): void {
  for (const [index, key] of keys.entries()) {
    const field = fields.get(key);
    const value = row[key];
    if (field === undefined || !validSourceValue(value, field))
      throw new TypeError(`Row for ${entityId} has an invalid value for ${key}.`);
    addCount(budget, 1 + (index > 0 ? 1 : 0));
    addBytes(budget, key);
    addBytes(budget, value !== null && typeof value === 'object' ? { decimal: value.decimal } : value);
  }
}

function validateRequiredFields(row: DataRecord, entity: CatalogEntity): void {
  for (const field of entity.fields) {
    const missing =
      !field.type.nullable && (!Object.hasOwn(row, field.id) || row[field.id] === undefined || row[field.id] === null);
    if (missing) throw new TypeError(`Row for ${entity.id} is missing non-nullable field ${field.id}.`);
  }
}

function validateIdentityFields(row: DataRecord, entity: CatalogEntity): void {
  for (const identity of entity.identity) {
    const missing = !Object.hasOwn(row, identity) || row[identity] === undefined || row[identity] === null;
    if (missing) throw new TypeError(`Row for ${entity.id} has an invalid identity field ${identity}.`);
  }
}

function deepFreezeRecord(record: DataRecord): DataRecord {
  const copy: Record<string, DataValue> = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value !== undefined && value !== null && typeof value === 'object')
      copy[key] = Object.freeze({ decimal: value.decimal });
    else if (value !== undefined) copy[key] = value;
  }
  return Object.freeze(copy);
}

export function freezeCatalog(catalog: Catalog): Catalog {
  return freezeDeep(catalog);
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const child of value) freezeDeep(child);
  } else {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}

export function normalizeSnapshot(snapshot: LocalSnapshot, sourceLimits: SourceLimits): StoredSnapshot {
  const catalog = catalogForSnapshot(snapshot.catalog);
  assertSafeId(snapshot.sourceRevision, 'sourceRevision');
  assertSnapshotRecords(snapshot.records);
  const budget = createByteBudget(sourceLimits);
  const entities = new Map(catalog.entities.map((entity) => [entity.id, entity] as const));
  const records: Record<string, readonly DataRecord[]> = Object.create(null) as Record<string, readonly DataRecord[]>;
  for (const [entityId, rows] of Object.entries(snapshot.records)) {
    assertSafeId(entityId, 'entity id');
    const entity = entities.get(entityId);
    if (entity === undefined) throw new TypeError(`Rows reference unknown entity ${entityId}.`);
    if (Object.keys(records).length > 0) addCount(budget, 1);
    addBytes(budget, entityId);
    records[entityId] = normalizeEntityRows(entityId, rows, entity, budget);
  }
  return Object.freeze({
    catalog: freezeCatalog(catalog),
    sourceRevision: snapshot.sourceRevision,
    records: Object.freeze(records),
  });
}
