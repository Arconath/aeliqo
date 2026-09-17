import type { Catalog, MeaningDefinition, Outcome } from '../contracts/types.js';
import { parseCatalog } from '../contracts/parse.js';
import { semanticFailure } from './errors.js';
import { validateSemanticType } from './type-utils.js';
import type { CatalogEntity, CatalogIndex, FieldBinding } from './types.js';
import { versionRefKey as key } from '../contracts/stable.js';

type ValidationFailure = Outcome<never> | undefined;

function fieldTypeWithEntityGrain(field: FieldBinding['field'], entity: CatalogEntity): FieldBinding['type'] {
  if (field.type.grain !== undefined) return field.type;
  return { ...field.type, grain: entity.rowGrain };
}

interface CatalogIndexes {
  readonly entities: Map<string, CatalogEntity>;
  readonly fieldsByEntity: Map<string, ReadonlyMap<string, FieldBinding>>;
  readonly fieldsById: Map<string, FieldBinding[]>;
  readonly meanings: Map<string, MeaningDefinition>;
  readonly capabilities: Map<string, Catalog['capabilities'][number]>;
}

function createIndexes(): CatalogIndexes {
  return {
    entities: new Map(),
    fieldsByEntity: new Map(),
    fieldsById: new Map(),
    meanings: new Map(),
    capabilities: new Map(),
  };
}

function indexFields(
  entity: CatalogEntity,
  entityIndex: number,
  indexes: CatalogIndexes,
): Outcome<ReadonlyMap<string, FieldBinding>> {
  const entityFields = new Map<string, FieldBinding>();
  for (let fieldIndex = 0; fieldIndex < entity.fields.length; fieldIndex += 1) {
    const field = entity.fields[fieldIndex];
    if (field === undefined)
      return semanticFailure('semantic.field-shape', 'Field is not a canonical object.', [
        'entities',
        entityIndex,
        'fields',
        fieldIndex,
      ]);
    if (entityFields.has(field.id))
      return semanticFailure(
        'semantic.duplicate-field',
        `Field ${field.id} is declared more than once on ${entity.id}.`,
        ['entities', entityIndex, 'fields', fieldIndex, 'id'],
      );
    const fieldType = validateSemanticType(field.type, ['entities', entityIndex, 'fields', fieldIndex, 'type']);
    if (!fieldType.ok) return fieldType;
    const binding: FieldBinding = {
      entityId: entity.id,
      entity,
      field,
      type: fieldTypeWithEntityGrain({ ...field, type: fieldType.value }, entity),
    };
    entityFields.set(field.id, binding);
    const all = indexes.fieldsById.get(field.id) ?? [];
    all.push(binding);
    indexes.fieldsById.set(field.id, all);
  }
  return { ok: true, value: entityFields };
}

function firstMissingField(fields: ReadonlyMap<string, FieldBinding>, ids: readonly string[]): string | undefined {
  return ids.find((id) => !fields.has(id));
}

function validateEntityReferences(
  entity: CatalogEntity,
  entityIndex: number,
  fields: ReadonlyMap<string, FieldBinding>,
): ValidationFailure {
  const identity = firstMissingField(fields, entity.identity);
  if (identity !== undefined)
    return semanticFailure('semantic.identity-field', `Identity field ${identity} is not declared on ${entity.id}.`, [
      'entities',
      entityIndex,
      'identity',
    ]);
  const grain = firstMissingField(fields, entity.rowGrain);
  if (grain !== undefined)
    return semanticFailure('semantic.grain-field', `Row-grain field ${grain} is not declared on ${entity.id}.`, [
      'entities',
      entityIndex,
      'rowGrain',
    ]);
  return undefined;
}

function registerEntity(
  entity: CatalogEntity | undefined,
  entityIndex: number,
  indexes: CatalogIndexes,
): ValidationFailure {
  if (entity === undefined)
    return semanticFailure('semantic.catalog-entity', 'Catalog entity is not a canonical object.', [
      'entities',
      entityIndex,
    ]);
  if (indexes.entities.has(entity.id))
    return semanticFailure('semantic.duplicate-entity', `Entity ${entity.id} is declared more than once.`, [
      'entities',
      entityIndex,
      'id',
    ]);
  const fields = indexFields(entity, entityIndex, indexes);
  if (!fields.ok) return fields;
  const references = validateEntityReferences(entity, entityIndex, fields.value);
  if (references !== undefined) return references;
  indexes.entities.set(entity.id, entity);
  indexes.fieldsByEntity.set(entity.id, fields.value);
  return undefined;
}

function indexEntities(catalog: Catalog, indexes: CatalogIndexes): ValidationFailure {
  for (let index = 0; index < catalog.entities.length; index += 1) {
    const registered = registerEntity(catalog.entities[index], index, indexes);
    if (registered !== undefined) return registered;
  }
  return undefined;
}

function validateRelationship(
  relationship: Catalog['relationships'][number] | undefined,
  index: number,
  indexes: CatalogIndexes,
): ValidationFailure {
  if (
    !relationship ||
    !indexes.entities.has(relationship.sourceEntity) ||
    !indexes.entities.has(relationship.targetEntity)
  )
    return semanticFailure('semantic.relationship-entity', 'Relationship references an unknown entity.', [
      'relationships',
      index,
    ]);
  const sourceFields = indexes.fieldsByEntity.get(relationship.sourceEntity)!;
  const targetFields = indexes.fieldsByEntity.get(relationship.targetEntity)!;
  for (let keyIndex = 0; keyIndex < relationship.keys.length; keyIndex += 1) {
    const joinKey = relationship.keys[keyIndex]!;
    if (!sourceFields.has(joinKey.sourceField) || !targetFields.has(joinKey.targetField))
      return semanticFailure('semantic.relationship-field', 'Relationship key references an unknown field.', [
        'relationships',
        index,
        'keys',
        keyIndex,
      ]);
  }
  return undefined;
}

function indexRelationships(catalog: Catalog, indexes: CatalogIndexes): ValidationFailure {
  for (let index = 0; index < catalog.relationships.length; index += 1) {
    const result = validateRelationship(catalog.relationships[index], index, indexes);
    if (result !== undefined) return result;
  }
  return undefined;
}

function indexMeanings(catalog: Catalog, indexes: CatalogIndexes): ValidationFailure {
  for (let index = 0; index < catalog.meanings.length; index += 1) {
    const meaning = catalog.meanings[index]!;
    const meaningKey = key(meaning);
    if (indexes.meanings.has(meaningKey))
      return semanticFailure('semantic.duplicate-meaning', `Meaning ${meaningKey} is declared more than once.`, [
        'meanings',
        index,
      ]);
    indexes.meanings.set(meaningKey, meaning);
  }
  return undefined;
}

function validateCapability(
  capability: Catalog['capabilities'][number],
  index: number,
  indexes: CatalogIndexes,
): ValidationFailure {
  const capabilityKey = key(capability.ref);
  if (indexes.capabilities.has(capabilityKey))
    return semanticFailure('semantic.duplicate-capability', `Capability ${capabilityKey} is declared more than once.`, [
      'capabilities',
      index,
    ]);
  if (!indexes.entities.has(capability.entity))
    return semanticFailure('semantic.capability-entity', `Capability entity ${capability.entity} is not declared.`, [
      'capabilities',
      index,
      'entity',
    ]);
  const entityFields = indexes.fieldsByEntity.get(capability.entity)!;
  for (const field of capability.fields) {
    if (!entityFields.has(field))
      return semanticFailure('semantic.capability-field', `Capability field ${field} is not declared.`, [
        'capabilities',
        index,
        'fields',
      ]);
  }
  indexes.capabilities.set(capabilityKey, capability);
  return undefined;
}

function indexCapabilities(catalog: Catalog, indexes: CatalogIndexes): ValidationFailure {
  for (let index = 0; index < catalog.capabilities.length; index += 1) {
    const result = validateCapability(catalog.capabilities[index]!, index, indexes);
    if (result !== undefined) return result;
  }
  return undefined;
}

function resolveField(
  entityId: string | undefined,
  fieldId: string,
  fieldsByEntity: ReadonlyMap<string, ReadonlyMap<string, FieldBinding>>,
  fieldsById: ReadonlyMap<string, readonly FieldBinding[]>,
): ReturnType<CatalogIndex['resolveField']> {
  if (entityId !== undefined) {
    const field = fieldsByEntity.get(entityId)?.get(fieldId);
    if (field !== undefined) return { ok: true, value: field };
    return semanticFailure('semantic.unknown-field', `Field ${fieldId} is not available on entity ${entityId}.`, [
      'ref',
    ]);
  }
  const fields = fieldsById.get(fieldId) ?? [];
  if (fields.length === 1) return { ok: true, value: fields[0]! };
  if (fields.length > 1)
    return semanticFailure('semantic.ambiguous-field', `Field ${fieldId} belongs to more than one entity.`, ['ref']);
  return semanticFailure('semantic.unknown-field', `Field ${fieldId} is not declared.`, ['ref']);
}

function createCatalogIndexValue(catalog: Catalog, indexes: CatalogIndexes): CatalogIndex {
  return {
    catalog,
    ...indexes,
    resolveField: (entityId, fieldId) => resolveField(entityId, fieldId, indexes.fieldsByEntity, indexes.fieldsById),
    resolveMeaning: (ref) => indexes.meanings.get(key(ref)),
    resolveCapability: (ref) => indexes.capabilities.get(key(ref)),
  };
}

export function createCatalogIndex(catalog: Catalog): Outcome<CatalogIndex> {
  const parsed = parseCatalog(catalog);
  if (!parsed.ok) return parsed;
  const indexes = createIndexes();
  const phases = [indexEntities, indexRelationships, indexMeanings, indexCapabilities];
  for (const phase of phases) {
    const failure = phase(parsed.value, indexes);
    if (failure !== undefined) return failure;
  }
  return { ok: true, value: createCatalogIndexValue(parsed.value, indexes) };
}

export { key as versionKey };
