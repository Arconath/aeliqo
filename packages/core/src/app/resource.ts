import * as z from 'zod';
import { parseCatalog } from '../contracts/parse.js';
import type { Catalog, Diagnostic, Outcome, SemanticType } from '../contracts/types.js';
import { createCatalogIndex } from '../semantics/catalog.js';
import { STANDARD_INTENTS, ResourceDefinitionError } from './types.js';
import type { ResourceDefinition, ResourceFieldMetadata, ResourceInput } from './types.js';

type Path = readonly (string | number)[];
type ZodRuntimeSchema = z.ZodType & {
  readonly type?: string;
  readonly format?: string | null;
  readonly isInt?: boolean;
  readonly values?: ReadonlySet<unknown>;
  readonly options?: readonly unknown[];
  unwrap?: () => z.ZodType;
};

function diagnostic(code: string, message: string, path: Path, remedies?: readonly string[]): Diagnostic {
  return { code, message, path, retryable: false, ...(remedies === undefined ? {} : { remedies }) };
}

function validIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 160 && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function unwrap(schema: ZodRuntimeSchema): {
  readonly schema: ZodRuntimeSchema;
  readonly nullable: boolean;
  readonly optional: boolean;
} {
  let current = schema;
  let nullable = false;
  let optional = false;
  const seen = new Set<z.ZodType>();
  while (!seen.has(current)) {
    seen.add(current);
    if (current.type === 'nullable') nullable = true;
    else if (current.type === 'optional') optional = true;
    else if (!['default', 'prefault', 'readonly', 'catch'].includes(current.type ?? '')) break;
    const inner = current.unwrap?.();
    if (inner === undefined) break;
    current = inner;
  }
  return { schema: current, nullable, optional };
}

function inferType(schema: z.ZodType, path: Path): Outcome<SemanticType> {
  const unwrapped = unwrap(schema);
  if (unwrapped.optional) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'resource.optional-field',
          'Optional record fields cannot be represented as nullable values.',
          path,
          [
            'Use nullable() when null is valid, use default() when the field is always materialized, or project the source into a stable record shape.',
          ],
        ),
      ],
    };
  }
  const runtime = unwrapped.schema;
  let value: SemanticType['value'] | undefined;
  if (runtime.type === 'string')
    value = runtime.format === 'date' ? 'date' : runtime.format === 'datetime' ? 'instant' : 'text';
  else if (runtime.type === 'boolean') value = 'boolean';
  else if (runtime.type === 'number') value = runtime.isInt === true ? 'integer' : 'float';
  else if (runtime.type === 'enum') value = 'text';
  else if (runtime.type === 'literal') {
    const literal = runtime.values?.values().next().value;
    value =
      typeof literal === 'boolean'
        ? 'boolean'
        : typeof literal === 'number'
          ? Number.isInteger(literal)
            ? 'integer'
            : 'float'
          : typeof literal === 'string'
            ? 'text'
            : undefined;
  }
  if (value === undefined) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('resource.unsupported-schema', 'This field schema does not map to an Aeliqo scalar.', path, [
          'Project nested content into typed scalar fields or provide a dedicated typed binding outside the relational resource.',
        ]),
      ],
    };
  }
  const temporal =
    value === 'date'
      ? { calendar: 'gregorian', timezone: 'UTC', grain: 'day' }
      : value === 'instant'
        ? { calendar: 'gregorian', timezone: 'UTC' }
        : undefined;
  return { ok: true, value: { value, nullable: unwrapped.nullable, ...(temporal === undefined ? {} : { temporal }) } };
}

function inferredValues(schema: z.ZodType): readonly (string | number | boolean)[] | undefined {
  const runtime = unwrap(schema).schema;
  if (runtime.type !== 'enum' && runtime.type !== 'literal') return undefined;
  const values = [...(runtime.type === 'enum' ? (runtime.options ?? []) : (runtime.values ?? []))].filter(
    (value): value is string | number | boolean =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
  );
  return values.length === 0 ? undefined : Object.freeze(values);
}

function fieldValues(
  schema: z.ZodType,
  metadata: ResourceFieldMetadata | undefined,
  path: Path,
): Outcome<readonly (string | number | boolean)[] | undefined> {
  const values: unknown = metadata?.values ?? inferredValues(schema);
  if (values === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(values) || values.length === 0 || values.length > 100)
    return {
      ok: false,
      diagnostics: [diagnostic('resource.field-values', 'Field values must contain 1–100 unique scalar values.', path)],
    };
  const inspected: (string | number | boolean)[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value: unknown = values[index];
    const scalar =
      typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
    if (
      !scalar ||
      (typeof value === 'string' && (value.length === 0 || value.length > 160)) ||
      inspected.some((candidate) => Object.is(candidate, value)) ||
      !schema.safeParse(value).success
    )
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.field-values', 'A declared field value does not satisfy its runtime schema.', [
            ...path,
            index,
          ]),
        ],
      };
    inspected.push(value);
  }
  return { ok: true, value: Object.freeze(inspected) };
}

function generatedCatalog<Schema extends z.ZodObject>(input: ResourceInput<Schema>): Outcome<Catalog> {
  if ('catalog' in input && input.catalog !== undefined) return parseCatalog(input.catalog);
  const fields: Catalog['entities'][number]['fields'][number][] = [];
  const diagnostics: Diagnostic[] = [];
  for (const [id, schema] of Object.entries(input.schema.shape)) {
    const metadata = input.fields?.[id];
    const inferred = inferType(schema, ['schema', id]);
    if (!inferred.ok && metadata?.type === undefined) {
      diagnostics.push(...inferred.diagnostics);
      continue;
    }
    fields.push({
      id,
      label: metadata?.label ?? id,
      role: input.identity.includes(id) ? 'identity' : (metadata?.role ?? 'attribute'),
      type: metadata?.type ?? (inferred.ok ? inferred.value : { value: 'text', nullable: false }),
    });
  }
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic !== undefined) return { ok: false, diagnostics: [firstDiagnostic, ...diagnostics.slice(1)] };
  const catalog: Catalog = {
    version: '1',
    revision: input.revision,
    functionRegistryDigest: input.functionRegistryDigest ?? 'core-query-2',
    entities: [
      {
        id: input.id,
        label: input.label,
        identity: input.identity,
        rowGrain: input.rowGrain ?? input.identity,
        fields,
      },
    ],
    relationships: [],
    meanings: input.meanings ?? [],
    capabilities: [],
  };
  return parseCatalog(catalog);
}

function inspectResource<Schema extends z.ZodObject>(
  input: ResourceInput<Schema>,
): Outcome<ResourceDefinition<Schema>> {
  if (!validIdentifier(input.id))
    return {
      ok: false,
      diagnostics: [diagnostic('resource.id', 'Resource ID must be a bounded identifier without whitespace.', ['id'])],
    };
  if (input.label.trim().length === 0)
    return { ok: false, diagnostics: [diagnostic('resource.label', 'Resource label must not be empty.', ['label'])] };
  const shapeKeys = Object.keys(input.schema.shape);
  for (const metadataKey of Object.keys(input.fields ?? {})) {
    if (!shapeKeys.includes(metadataKey))
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.unknown-field', `Field metadata references unknown schema field ${metadataKey}.`, [
            'fields',
            metadataKey,
          ]),
        ],
      };
  }
  const catalogOutcome = generatedCatalog(input);
  if (!catalogOutcome.ok) return catalogOutcome;
  const indexed = createCatalogIndex(catalogOutcome.value);
  if (!indexed.ok) return indexed;
  const entityId = 'catalog' in input && input.catalog !== undefined ? (input.entity ?? input.id) : input.id;
  const entity = indexed.value.entities.get(entityId);
  if (entity === undefined)
    return {
      ok: false,
      diagnostics: [diagnostic('resource.entity', `Catalog entity ${entityId} is not declared.`, ['entity'])],
    };
  const schemaFields = new Set(shapeKeys);
  for (const field of entity.fields) {
    if (!schemaFields.has(field.id))
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.schema-field', `Catalog field ${field.id} is missing from the runtime schema.`, [
            'schema',
            field.id,
          ]),
        ],
      };
  }
  for (const key of schemaFields) {
    if (!entity.fields.some((field) => field.id === key))
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.catalog-field', `Runtime schema field ${key} is missing from the Catalog entity.`, [
            'schema',
            key,
          ]),
        ],
      };
  }
  const defaultIntents = STANDARD_INTENTS.filter(
    (intent) => (intent !== 'create' && intent !== 'edit') || input.forms?.[intent] !== undefined,
  );
  const intents = Object.freeze([...(input.intents ?? defaultIntents)]);
  if (new Set(intents).size !== intents.length)
    return {
      ok: false,
      diagnostics: [
        diagnostic('resource.duplicate-intent', 'Resource intent declarations must be unique.', ['intents']),
      ],
    };
  for (const intent of ['create', 'edit'] as const) {
    if (intents.includes(intent) && input.forms?.[intent] === undefined)
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.form-intent', `${intent} requires a registered form schema and action.`, ['intents']),
        ],
      };
  }
  const allowedViews = Object.freeze([...input.presentation.allowedViews]);
  if (
    allowedViews.length === 0 ||
    new Set(allowedViews).size !== allowedViews.length ||
    allowedViews.some((view) => !validIdentifier(view))
  )
    return {
      ok: false,
      diagnostics: [
        diagnostic('resource.views', 'A resource needs unique bounded allowed view IDs.', [
          'presentation',
          'allowedViews',
        ]),
      ],
    };
  for (const [kind, preferred] of Object.entries(input.presentation.preferred ?? {})) {
    if (!allowedViews.includes(preferred))
      return {
        ok: false,
        diagnostics: [
          diagnostic('resource.preferred-view', `Preferred ${kind} view ${preferred} is not allowed.`, [
            'presentation',
            'preferred',
            kind,
          ]),
        ],
      };
  }
  const mutableFieldMetadata: Record<string, ResourceFieldMetadata> = {};
  for (const [key, schema] of Object.entries(input.schema.shape)) {
    const metadata = input.fields?.[key];
    const values = fieldValues(schema, metadata, ['fields', key, 'values']);
    if (!values.ok) return values;
    mutableFieldMetadata[key] = Object.freeze({
      ...metadata,
      ...(values.value === undefined ? {} : { values: values.value }),
    });
  }
  const fieldMetadata: Readonly<Record<string, ResourceFieldMetadata>> = Object.freeze(mutableFieldMetadata);
  const definition: ResourceDefinition<Schema> = {
    id: input.id,
    label: input.label,
    ...(input.description === undefined ? {} : { description: input.description }),
    schema: input.schema,
    catalog: catalogOutcome.value,
    entity,
    fieldMetadata,
    intents,
    presentation: Object.freeze({
      allowedViews,
      ...(input.presentation.preferred === undefined
        ? {}
        : { preferred: Object.freeze({ ...input.presentation.preferred }) }),
    }),
    ...(input.forms === undefined ? {} : { forms: Object.freeze({ ...input.forms }) }),
    parseRecord(value) {
      const parsed = input.schema.safeParse(value);
      if (parsed.success) return { ok: true, value: parsed.data };
      const issues = parsed.error.issues.slice(0, 16).map((issue) =>
        diagnostic(
          `resource.record.${issue.code}`,
          issue.message,
          issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
        ),
      );
      const firstIssue = issues[0];
      return firstIssue === undefined
        ? {
            ok: false,
            diagnostics: [diagnostic('resource.record.invalid', 'The record does not match its runtime schema.', [])],
          }
        : { ok: false, diagnostics: [firstIssue, ...issues.slice(1)] };
    },
  };
  return { ok: true, value: Object.freeze(definition) };
}

/** Define trusted application metadata once. Runtime records still cross parseRecord before use. */
export function defineResource<Schema extends z.ZodObject>(input: ResourceInput<Schema>): ResourceDefinition<Schema> {
  const outcome = inspectResource(input);
  if (!outcome.ok) throw new ResourceDefinitionError(outcome.diagnostics);
  return outcome.value;
}

export function validateResource<Schema extends z.ZodObject>(
  input: ResourceInput<Schema>,
): Outcome<ResourceDefinition<Schema>> {
  return inspectResource(input);
}
