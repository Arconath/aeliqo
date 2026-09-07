import type {Catalog, MeaningDefinition, Outcome, VersionRef} from '../contracts/types.js';
import {parseCatalog} from '../contracts/parse.js';
import {semanticFailure} from './errors.js';
import {validateSemanticType} from './type-utils.js';
import type {CatalogEntity, CatalogIndex, FieldBinding} from './types.js';

/** Version refs may contain `@`; encode the tuple without a delimiter collision. */
const key = (ref: VersionRef): string => JSON.stringify([ref.id, ref.revision]);

function fieldTypeWithEntityGrain(
  field: FieldBinding['field'],
  entity: CatalogEntity,
): FieldBinding['type'] {
  if (field.type.grain !== undefined) return field.type;
  return {...field.type, grain: entity.rowGrain};
}

export function createCatalogIndex(catalog: Catalog): Outcome<CatalogIndex> {
  const parsed = parseCatalog(catalog);
  if (!parsed.ok) return parsed;
  const canonical = parsed.value;

  const entities = new Map<string, CatalogEntity>();
  const fieldsByEntity = new Map<string, ReadonlyMap<string, FieldBinding>>();
  const fieldsById = new Map<string, FieldBinding[]>();
  const meanings = new Map<string, MeaningDefinition>();
  const capabilities = new Map<string, Catalog['capabilities'][number]>();

  for (let entityIndex = 0; entityIndex < canonical.entities.length; entityIndex += 1) {
    const entity = canonical.entities[entityIndex];
    if (entity === undefined)
      return semanticFailure('semantic.catalog-entity', 'Catalog entity is not a canonical object.', ['entities', entityIndex]);
    if (entities.has(entity.id))
      return semanticFailure('semantic.duplicate-entity', `Entity ${entity.id} is declared more than once.`, ['entities', entityIndex, 'id']);

    const entityFields = new Map<string, FieldBinding>();
    for (let fieldIndex = 0; fieldIndex < entity.fields.length; fieldIndex += 1) {
      const field = entity.fields[fieldIndex];
      if (field === undefined)
        return semanticFailure('semantic.field-shape', 'Field is not a canonical object.', ['entities', entityIndex, 'fields', fieldIndex]);
      if (entityFields.has(field.id))
        return semanticFailure('semantic.duplicate-field', `Field ${field.id} is declared more than once on ${entity.id}.`, ['entities', entityIndex, 'fields', fieldIndex, 'id']);
      const fieldType = validateSemanticType(field.type, ['entities', entityIndex, 'fields', fieldIndex, 'type']);
      if (!fieldType.ok) return fieldType;
      const binding: FieldBinding = {
        entityId: entity.id,
        entity,
        field,
        type: fieldTypeWithEntityGrain({...field, type: fieldType.value}, entity),
      };
      entityFields.set(field.id, binding);
      const all = fieldsById.get(field.id) ?? [];
      all.push(binding);
      fieldsById.set(field.id, all);
    }
    for (const identity of entity.identity) {
      if (!entityFields.has(identity))
        return semanticFailure('semantic.identity-field', `Identity field ${identity} is not declared on ${entity.id}.`, ['entities', entityIndex, 'identity']);
    }
    for (const grain of entity.rowGrain) {
      if (!entityFields.has(grain))
        return semanticFailure('semantic.grain-field', `Row-grain field ${grain} is not declared on ${entity.id}.`, ['entities', entityIndex, 'rowGrain']);
    }
    entities.set(entity.id, entity);
    fieldsByEntity.set(entity.id, entityFields);
  }

  for (let index = 0; index < canonical.relationships.length; index += 1) {
    const relationship = canonical.relationships[index];
    if (!relationship || !entities.has(relationship.sourceEntity) || !entities.has(relationship.targetEntity))
      return semanticFailure('semantic.relationship-entity', 'Relationship references an unknown entity.', ['relationships', index]);
    const sourceFields = fieldsByEntity.get(relationship.sourceEntity)!;
    const targetFields = fieldsByEntity.get(relationship.targetEntity)!;
    for (let keyIndex = 0; keyIndex < relationship.keys.length; keyIndex += 1) {
      const joinKey = relationship.keys[keyIndex]!;
      if (!sourceFields.has(joinKey.sourceField) || !targetFields.has(joinKey.targetField))
        return semanticFailure('semantic.relationship-field', 'Relationship key references an unknown field.', ['relationships', index, 'keys', keyIndex]);
    }
  }

  for (let index = 0; index < canonical.meanings.length; index += 1) {
    const meaning = canonical.meanings[index]!;
    const meaningKey = key(meaning);
    if (meanings.has(meaningKey))
      return semanticFailure('semantic.duplicate-meaning', `Meaning ${meaningKey} is declared more than once.`, ['meanings', index]);
    meanings.set(meaningKey, meaning);
  }

  for (let index = 0; index < canonical.capabilities.length; index += 1) {
    const capability = canonical.capabilities[index]!;
    const capabilityKey = key(capability.ref);
    if (capabilities.has(capabilityKey))
      return semanticFailure('semantic.duplicate-capability', `Capability ${capabilityKey} is declared more than once.`, ['capabilities', index]);
    if (!entities.has(capability.entity))
      return semanticFailure('semantic.capability-entity', `Capability entity ${capability.entity} is not declared.`, ['capabilities', index, 'entity']);
    const entityFields = fieldsByEntity.get(capability.entity)!;
    for (const field of capability.fields) {
      if (!entityFields.has(field))
        return semanticFailure('semantic.capability-field', `Capability field ${field} is not declared.`, ['capabilities', index, 'fields']);
    }
    capabilities.set(capabilityKey, capability);
  }

  const index: CatalogIndex = {
    catalog: canonical,
    entities,
    fieldsByEntity,
    fieldsById,
    meanings,
    capabilities,
    resolveField(entityId, fieldId) {
      if (entityId !== undefined) {
        const field = fieldsByEntity.get(entityId)?.get(fieldId);
        return field
          ? {ok: true, value: field}
          : semanticFailure('semantic.unknown-field', `Field ${fieldId} is not available on entity ${entityId}.`, ['ref']);
      }
      const fields = fieldsById.get(fieldId) ?? [];
      if (fields.length === 1) return {ok: true, value: fields[0]!};
      if (fields.length > 1)
        return semanticFailure('semantic.ambiguous-field', `Field ${fieldId} belongs to more than one entity.`, ['ref']);
      return semanticFailure('semantic.unknown-field', `Field ${fieldId} is not declared.`, ['ref']);
    },
    resolveMeaning(ref) {
      return meanings.get(key(ref));
    },
    resolveCapability(ref) {
      return capabilities.get(key(ref));
    },
  };
  return {ok: true, value: index};
}

export const versionKey = key;
