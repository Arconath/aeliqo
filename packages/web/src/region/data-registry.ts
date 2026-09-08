import {
  parseResult,
  parseWireValue,
  scalarIdentity,
  validateScalar,
  type InteractionPort,
  type InteractionPayload,
  type Outcome,
  type Result,
  type ResultRef,
  type Scalar,
  type SemanticType,
  type VersionRef,
} from "@aeliqo/core";
import type {
  AeliqoDataColumn,
  AeliqoDataRecord,
  AeliqoDataScope,
  AeliqoDataValue,
  AeliqoDeltaMode,
  AeliqoFilterPredicate,
  AeliqoSelectionMode,
} from "../data/index.js";

/** The nine data views share one trusted semantic registry. */
export const AELIQO_DATA_REFS = Object.freeze({
  metric: { id: "data.metric", revision: "1" },
  delta: { id: "data.delta", revision: "1" },
  keyValue: { id: "data.key-value", revision: "1" },
  detail: { id: "data.detail", revision: "1" },
  recordList: { id: "data.record-list", revision: "1" },
  cardCollection: { id: "data.card-collection", revision: "1" },
  table: { id: "data.table", revision: "1" },
  filterBuilder: { id: "control.filter-builder", revision: "1" },
  selectionSummary: { id: "data.selection-summary", revision: "1" },
} satisfies Record<string, VersionRef>);

export type AeliqoDataComponentId = keyof typeof AELIQO_DATA_REFS;

export const AELIQO_DATA_CONFIG_SCHEMAS = Object.freeze({
  metric: { id: "data.metric.config", revision: "1" },
  delta: { id: "data.delta.config", revision: "1" },
  keyValue: { id: "data.key-value.config", revision: "1" },
  detail: { id: "data.detail.config", revision: "1" },
  recordList: { id: "data.record-list.config", revision: "1" },
  cardCollection: { id: "data.card-collection.config", revision: "1" },
  table: { id: "data.table.config", revision: "1" },
  filterBuilder: { id: "control.filter-builder.config", revision: "1" },
  selectionSummary: { id: "data.selection-summary.config", revision: "1" },
} satisfies Record<AeliqoDataComponentId, VersionRef>);

/**
 * A region host supplies this object after it has authorized a Result and
 * materialized exactly `result.counts.loaded` rows for that ResultRef. The
 * registry never fetches, aggregates, or discovers another source.
 */
export interface AeliqoDataBinding {
  readonly result: Result;
  readonly rows: readonly AeliqoDataRecord[];
  readonly columns?: readonly AeliqoDataColumn[];
  /** Optional host-owned display scope. Numeric members are checked against the descriptor. */
  readonly scope?: AeliqoDataScope;
}

export interface AeliqoDataRegistryOptions {
  /** Trusted application binding for the entity represented by this Result. */
  readonly resolveEntity?: (result: Result) => string | undefined;
  readonly maxRows?: number;
}

export interface AeliqoDataNodeInput {
  readonly id: string;
  /** Either the public data component ID (`metric`) or its versioned representation ref. */
  readonly component: AeliqoDataComponentId | VersionRef;
  readonly config?: Readonly<Record<string, unknown>>;
}

export interface AeliqoDataResolvedConfig {
  readonly values: Readonly<Record<string, unknown>>;
  readonly fields: readonly string[];
  /** Ports are derived by reviewed code. They are never accepted from config. */
  readonly ports: readonly InteractionPort[];
  readonly identity: readonly string[];
  readonly columns: readonly AeliqoDataColumn[];
  readonly selection: AeliqoSelectionMode;
  readonly selectedRow?: AeliqoDataRecord;
  readonly selectedIndex?: number;
  readonly metricField?: string;
  readonly delta?: {
    readonly currentField: string;
    readonly baselineField: string;
    readonly mode: AeliqoDeltaMode;
    readonly currentRow: AeliqoDataRecord;
    readonly baselineRow: AeliqoDataRecord;
  };
  readonly detailRow?: AeliqoDataRecord;
}

export interface AeliqoDataResolvedNode {
  readonly id: string;
  readonly component: AeliqoDataComponentId;
  readonly ref: VersionRef;
  readonly result: Result;
  readonly rows: readonly AeliqoDataRecord[];
  readonly columns: readonly AeliqoDataColumn[];
  readonly scope: AeliqoDataScope;
  readonly config: AeliqoDataResolvedConfig;
}

export interface AeliqoDataManifest {
  readonly ref: VersionRef;
  readonly configSchema: VersionRef;
  readonly result: "required";
  readonly resolveConfig: (
    values: Readonly<Record<string, unknown>>,
    binding: AeliqoValidatedBinding,
    options: AeliqoDataRegistryOptions,
  ) => Outcome<AeliqoDataResolvedConfig>;
}

export interface AeliqoDataRegistry {
  readonly manifests: readonly AeliqoDataManifest[];
  readonly resolve: (
    input: AeliqoDataNodeInput,
    binding: AeliqoDataBinding,
  ) => Outcome<AeliqoDataResolvedNode>;
}

export interface AeliqoValidatedBinding extends AeliqoDataBinding {
  readonly result: Result;
  readonly rows: readonly AeliqoDataRecord[];
  readonly columns: readonly AeliqoDataColumn[];
  readonly scope: AeliqoDataScope;
}

const MAX_ITEMS = 128;
const MAX_LABEL = 160;
const MAX_NODE_ID = 128;
const MAX_VALUE_KEYS = 256;

const failure = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{ code: `web.data.${code}`, message, retryable: false }],
});

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function boundedText(value: unknown, field: string): Outcome<string> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_LABEL ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return failure("config", `${field} must be bounded text.`);
  }
  return { ok: true, value };
}

function refKey(ref: ResultRef): string {
  return JSON.stringify([
    ref.id,
    ref.revision,
    ref.outputId,
    ref.queryDigest,
    ref.scopeDigest,
  ]);
}

function sameRef(left: ResultRef, right: ResultRef): boolean {
  return refKey(left) === refKey(right);
}

function fieldMap(result: Result): Map<string, Result["fields"][number]> {
  return new Map(result.fields.map((field) => [field.id, field]));
}

function unitKey(type: SemanticType): string {
  return type.unit === undefined
    ? ""
    : JSON.stringify([
        type.unit.dimension,
        type.unit.symbol,
        type.unit.currency ?? null,
      ]);
}

function numeric(type: SemanticType): boolean {
  return (
    type.value === "integer" ||
    type.value === "float" ||
    type.value === "decimal"
  );
}

function validFieldList(
  raw: unknown,
  result: Result,
  field = "fields",
): Outcome<readonly string[]> {
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > MAX_ITEMS ||
    raw.some((value) => typeof value !== "string" || value.length === 0)
  ) {
    return failure("field", `${field} must name one or more result fields.`);
  }
  const fields = fieldMap(result);
  const values = raw as string[];
  if (
    new Set(values).size !== values.length ||
    values.some((value) => !fields.has(value))
  ) {
    return failure(
      "field",
      `${field} must contain unique fields declared by the authorized Result.`,
    );
  }
  return { ok: true, value: [...values] };
}

function identityFields(
  input: Readonly<Record<string, unknown>>,
  result: Result,
): Outcome<readonly string[]> {
  if (!Object.hasOwn(input, "identity"))
    return { ok: true, value: [...result.identity] };
  const checked = validFieldList(input.identity, result, "identity");
  if (!checked.ok) return checked;
  if (JSON.stringify(checked.value) !== JSON.stringify(result.identity)) {
    return failure(
      "identity",
      "identity must exactly match the Result descriptor identity.",
    );
  }
  return checked;
}

function columns(
  input: Readonly<Record<string, unknown>>,
  result: Result,
  fallback?: readonly AeliqoDataColumn[],
): Outcome<readonly AeliqoDataColumn[]> {
  const fields = fieldMap(result);
  const raw = input.columns;
  if (raw === undefined) {
    if (fallback !== undefined) return columns({ columns: fallback }, result);
    return {
      ok: true,
      value: result.fields.map((field) => ({
        key: field.id,
        label: field.label,
        type: field.type.value,
      })),
    };
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS)
    return failure("config", "columns must be a bounded nonempty array.");
  const output: AeliqoDataColumn[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const candidate = object(item);
    if (
      candidate === undefined ||
      Object.keys(candidate).some(
        (key) => !["key", "label", "type", "sortable", "align"].includes(key),
      )
    ) {
      return failure("config", "A data column contains an unknown property.");
    }
    const key = boundedText(candidate.key, "column.key");
    if (!key.ok) return key;
    const descriptor = fields.get(key.value);
    if (descriptor === undefined || seen.has(key.value))
      return failure(
        "field",
        `Column ${key.value} is not a unique authorized field.`,
      );
    let label = descriptor.label;
    if (candidate.label !== undefined) {
      const checkedLabel = boundedText(candidate.label, "column.label");
      if (!checkedLabel.ok) return checkedLabel;
      label = checkedLabel.value;
      if (label !== descriptor.label)
        return failure(
          "field",
          `Column ${key.value} must use the registered field label.`,
        );
    }
    if (
      candidate.type !== undefined &&
      candidate.type !== descriptor.type.value
    )
      return failure(
        "field",
        `Column ${key.value} must use the registered semantic type.`,
      );
    if (
      candidate.sortable !== undefined &&
      typeof candidate.sortable !== "boolean"
    )
      return failure("config", "column.sortable must be boolean.");
    if (
      candidate.align !== undefined &&
      candidate.align !== "start" &&
      candidate.align !== "center" &&
      candidate.align !== "end"
    )
      return failure("config", "column.align is invalid.");
    seen.add(key.value);
    output.push({
      key: key.value,
      label: descriptor.label,
      type: descriptor.type.value,
      ...(candidate.sortable === undefined
        ? {}
        : { sortable: candidate.sortable as boolean }),
      ...(candidate.align === undefined
        ? {}
        : { align: candidate.align as "start" | "center" | "end" }),
    });
  }
  return { ok: true, value: output };
}

function selection(
  input: Readonly<Record<string, unknown>>,
): Outcome<AeliqoSelectionMode> {
  const value = input.selection ?? "none";
  if (value !== "none" && value !== "single" && value !== "multiple")
    return failure("config", "selection must be none, single or multiple.");
  return { ok: true, value };
}

function entityFor(
  result: Result,
  options: AeliqoDataRegistryOptions,
  required: boolean,
): Outcome<string | undefined> {
  if (options.resolveEntity === undefined) {
    return required
      ? failure(
          "binding",
          "Selectable data views require a trusted entity resolver.",
        )
      : { ok: true, value: undefined };
  }
  let entity: string | undefined;
  try {
    entity = options.resolveEntity(result);
  } catch {
    return failure("binding", "The trusted entity resolver failed.");
  }
  if (entity === undefined)
    return required
      ? failure(
          "binding",
          "The authorized Result has no trusted entity binding.",
        )
      : { ok: true, value: undefined };
  return boundedText(entity, "entity");
}

function selectionPort(
  mode: AeliqoSelectionMode,
  result: Result,
  identity: readonly string[],
  options: AeliqoDataRegistryOptions,
): Outcome<readonly InteractionPort[]> {
  if (mode === "none") return { ok: true, value: [] };
  const entity = entityFor(result, options, true);
  if (!entity.ok) return entity;
  return {
    ok: true,
    value: [
      {
        id: "selection",
        direction: "inout",
        payload: "selection",
        entity: entity.value!,
        identity: [...identity],
        grain: [...result.rowGrain],
      },
    ],
  };
}

function filterPort(): readonly InteractionPort[] {
  return [{ id: "filter", direction: "output", payload: "filter" }];
}

/** Validate host-provided filter state against the exact fields exposed by a view. */
function filterPredicate(
  value: unknown,
  result: Result,
  allowedFields: readonly string[],
  depth = 0,
): Outcome<AeliqoFilterPredicate> {
  if (depth > 16) return failure("config", "Filter predicates are too deeply nested.");
  const candidate = object(value);
  if (candidate === undefined || typeof candidate.op !== "string")
    return failure("config", "Filter predicates must use the registered typed vocabulary.");
  const fields = fieldMap(result);
  const fieldFor = (raw: unknown): Outcome<{readonly id: string; readonly type: SemanticType}> => {
    const checked = boundedText(raw, "predicate.field");
    if (!checked.ok) return checked;
    const descriptor = fields.get(checked.value);
    if (descriptor === undefined || !allowedFields.includes(checked.value))
      return failure("field", "Filter predicates must target an exposed Result field.");
    return {ok: true, value: {id: descriptor.id, type: descriptor.type}};
  };
  try {
    switch (candidate.op) {
      case "compare": {
        if (Object.keys(candidate).some((key) => !["op", "field", "comparison", "value"].includes(key)))
          return failure("config", "A compare predicate contains an unknown property.");
        const field = fieldFor(candidate.field);
        if (!field.ok) return field;
        if (!["eq", "ne", "lt", "lte", "gt", "gte"].includes(String(candidate.comparison)))
          return failure("config", "A compare predicate uses an invalid comparison.");
        const scalar = validateScalar(candidate.value, field.value.type);
        if (!scalar.ok) return failure("field", "A compare predicate value does not match its Result field.");
        return {
          ok: true,
          value: {
            op: "compare",
            field: field.value.id,
            comparison: candidate.comparison as "eq" | "ne" | "lt" | "lte" | "gt" | "gte",
            value: scalar.value,
          },
        };
      }
      case "is-null": {
        if (Object.keys(candidate).some((key) => !["op", "field", "negate"].includes(key)))
          return failure("config", "An is-null predicate contains an unknown property.");
        const field = fieldFor(candidate.field);
        if (!field.ok) return field;
        if (typeof candidate.negate !== "boolean")
          return failure("config", "An is-null predicate requires a boolean negate flag.");
        return {ok: true, value: {op: "is-null", field: field.value.id, negate: candidate.negate}};
      }
      case "in": {
        if (Object.keys(candidate).some((key) => !["op", "field", "values"].includes(key)))
          return failure("config", "An in predicate contains an unknown property.");
        const field = fieldFor(candidate.field);
        if (!field.ok) return field;
        if (!Array.isArray(candidate.values) || candidate.values.length === 0 || candidate.values.length > MAX_ITEMS)
          return failure("config", "An in predicate requires a bounded nonempty values array.");
        const values: Scalar[] = [];
        for (const raw of candidate.values) {
          const scalar = validateScalar(raw, field.value.type);
          if (!scalar.ok) return failure("field", "An in predicate value does not match its Result field.");
          values.push(scalar.value);
        }
        return {ok: true, value: {op: "in", field: field.value.id, values}};
      }
      case "and":
      case "or": {
        if (Object.keys(candidate).some((key) => !["op", "predicates"].includes(key)))
          return failure("config", "A compound predicate contains an unknown property.");
        if (!Array.isArray(candidate.predicates) || candidate.predicates.length === 0 || candidate.predicates.length > MAX_ITEMS)
          return failure("config", "A compound predicate requires a bounded nonempty predicate list.");
        const predicates: AeliqoFilterPredicate[] = [];
        for (const raw of candidate.predicates) {
          const checked = filterPredicate(raw, result, allowedFields, depth + 1);
          if (!checked.ok) return checked;
          predicates.push(checked.value);
        }
        return {ok: true, value: {op: candidate.op, predicates}};
      }
      case "not": {
        if (Object.keys(candidate).some((key) => !["op", "predicate"].includes(key)))
          return failure("config", "A not predicate contains an unknown property.");
        const checked = filterPredicate(candidate.predicate, result, allowedFields, depth + 1);
        if (!checked.ok) return checked;
        return {ok: true, value: {op: "not", predicate: checked.value}};
      }
      default:
        return failure("config", "The filter predicate operation is not registered.");
    }
  } catch {
    return failure("config", "The filter predicate could not be validated.");
  }
}

function paginationPort(
  input: Readonly<Record<string, unknown>>,
): readonly InteractionPort[] {
  return input.page === true
    ? [{ id: "page", direction: "output", payload: "page" }]
    : [];
}

function allowedKeys(
  input: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  return Object.keys(input).every((key) => keys.includes(key));
}

function rowIdentity(row: AeliqoDataRecord, result: Result): Outcome<string> {
  const fields = fieldMap(result);
  const parts: string[] = [];
  for (const id of result.identity) {
    const field = fields.get(id)!;
    const value = row[id];
    if (value === undefined || value === null)
      return failure(
        "identity",
        `Identity field ${id} is missing from a supplied row.`,
      );
    const identity = scalarIdentity(value, field.type);
    if (!identity.ok)
      return failure("identity", `Identity field ${id} is invalid.`);
    parts.push(identity.value);
  }
  return { ok: true, value: JSON.stringify(parts) };
}

function identityValues(
  input: Readonly<Record<string, unknown>>,
  result: Result,
): Outcome<Readonly<Record<string, Scalar>> | undefined> {
  const raw = input.identityValues ?? input.rowIdentity;
  if (raw === undefined) return { ok: true, value: undefined };
  const values = object(raw);
  if (
    values === undefined ||
    Object.keys(values).length !== result.identity.length ||
    Object.keys(values).some((field) => !result.identity.includes(field))
  ) {
    return failure(
      "identity",
      "identityValues must provide every authorized identity field exactly once.",
    );
  }
  const descriptors = fieldMap(result);
  const normalized: Record<string, Scalar> = {};
  for (const fieldId of result.identity) {
    const descriptor = descriptors.get(fieldId)!;
    const checked = validateScalar(values[fieldId], descriptor.type);
    if (!checked.ok || checked.value === null)
      return failure(
        "identity",
        `identityValues.${fieldId} does not match the identity field type.`,
      );
    normalized[fieldId] = checked.value;
  }
  return { ok: true, value: normalized };
}

function selectOne(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<{ readonly row: AeliqoDataRecord; readonly index: number }> {
  if (binding.rows.length === 0)
    return failure(
      "binding",
      "The authorized Result has no supplied row for a scalar view.",
    );
  const requested = identityValues(input, binding.result);
  if (!requested.ok) return requested;
  if (requested.value === undefined && binding.rows.length !== 1) {
    return failure(
      "identity",
      "A scalar view requires exactly one authorized row or explicit identityValues.",
    );
  }
  if (requested.value === undefined)
    return { ok: true, value: { row: binding.rows[0]!, index: 0 } };
  const resultIdentity = JSON.stringify(
    binding.result.identity.map((field) => {
      const descriptor = fieldMap(binding.result).get(field)!;
      return scalarIdentity(requested.value![field], descriptor.type).ok
        ? (
            scalarIdentity(requested.value![field], descriptor.type) as {
              ok: true;
              value: string;
            }
          ).value
        : "";
    }),
  );
  const index = binding.rows.findIndex((row) => {
    const identity = rowIdentity(row, binding.result);
    return identity.ok && identity.value === resultIdentity;
  });
  if (index < 0)
    return failure(
      "identity",
      "identityValues does not identify a supplied authorized row.",
    );
  return { ok: true, value: { row: binding.rows[index]!, index } };
}

function scalarField(
  result: Result,
  fieldId: unknown,
  role: string,
): Outcome<{
  readonly id: string;
  readonly descriptor: Result["fields"][number];
}> {
  const field = boundedText(fieldId, role);
  if (!field.ok) return field;
  const descriptor = fieldMap(result).get(field.value);
  if (descriptor === undefined)
    return failure("field", `${role} must name a declared Result field.`);
  if (!numeric(descriptor.type))
    return failure("field", `${role} must name a numeric Result field.`);
  return { ok: true, value: { id: field.value, descriptor } };
}

function commonConfig(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
  options: AeliqoDataRegistryOptions,
  config: Pick<
    AeliqoDataResolvedConfig,
    "fields" | "columns" | "identity" | "selection"
  >,
  ports: readonly InteractionPort[] = [],
): AeliqoDataResolvedConfig {
  return {
    values: input,
    fields: config.fields,
    columns: config.columns,
    identity: config.identity,
    selection: config.selection,
    ports,
  };
}

function resolveMetric(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<AeliqoDataResolvedConfig> {
  if (!allowedKeys(input, ["field", "identityValues", "rowIdentity", "label"]))
    return failure(
      "config",
      "Metric configuration contains an unknown property.",
    );
  const field = scalarField(binding.result, input.field, "field");
  if (!field.ok) return field;
  if (input.label !== undefined && input.label !== field.value.descriptor.label)
    return failure(
      "field",
      "Metric label must use the registered field label.",
    );
  const selected = selectOne(input, binding);
  if (!selected.ok) return selected;
  return {
    ok: true,
    value: {
      ...commonConfig(
        input,
        binding,
        {},
        {
          fields: [field.value.id],
          columns: [
            {
              key: field.value.id,
              label: field.value.descriptor.label,
              type: field.value.descriptor.type.value,
            },
          ],
          identity: binding.result.identity,
          selection: "none",
        },
      ),
      metricField: field.value.id,
      selectedRow: selected.value.row,
      selectedIndex: selected.value.index,
    },
  };
}

function resolveDelta(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<AeliqoDataResolvedConfig> {
  if (
    !allowedKeys(input, [
      "currentField",
      "baselineField",
      "current",
      "baseline",
      "mode",
      "identityValues",
      "rowIdentity",
      "label",
    ])
  )
    return failure(
      "config",
      "Delta configuration contains an unknown property.",
    );
  const current = object(input.current);
  const baseline = object(input.baseline);
  const currentId = input.currentField ?? current?.field;
  const baselineId = input.baselineField ?? baseline?.field;
  const currentField = scalarField(binding.result, currentId, "currentField");
  if (!currentField.ok) return currentField;
  const baselineField = scalarField(
    binding.result,
    baselineId,
    "baselineField",
  );
  if (!baselineField.ok) return baselineField;
  if (
    unitKey(currentField.value.descriptor.type) !==
    unitKey(baselineField.value.descriptor.type)
  )
    return failure(
      "unit",
      "Delta observations must use compatible declared units.",
    );
  const mode = input.mode ?? "absolute";
  if (mode !== "absolute" && mode !== "relative" && mode !== "percentage-point")
    return failure("config", "Delta mode is invalid.");
  const selected = selectOne(input, binding);
  if (!selected.ok) return selected;
  return {
    ok: true,
    value: {
      ...commonConfig(
        input,
        binding,
        {},
        {
          fields: [currentField.value.id, baselineField.value.id],
          columns: [],
          identity: binding.result.identity,
          selection: "none",
        },
      ),
      selectedRow: selected.value.row,
      selectedIndex: selected.value.index,
      delta: {
        currentField: currentField.value.id,
        baselineField: baselineField.value.id,
        mode,
        currentRow: selected.value.row,
        baselineRow: selected.value.row,
      },
    },
  };
}

function resolveKeyValue(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<AeliqoDataResolvedConfig> {
  if (!allowedKeys(input, ["items", "identityValues", "rowIdentity"]))
    return failure(
      "config",
      "KeyValue configuration contains an unknown property.",
    );
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0 ||
    input.items.length > MAX_ITEMS
  )
    return failure(
      "config",
      "KeyValue items must be a bounded nonempty array.",
    );
  const fields = fieldMap(binding.result);
  const ids: string[] = [];
  for (const raw of input.items) {
    const item = object(raw);
    if (
      item === undefined ||
      !Object.hasOwn(item, "field") ||
      Object.keys(item).some(
        (key) =>
          !["field", "label", "description", "displayValue", "href"].includes(
            key,
          ),
      )
    )
      return failure("config", "KeyValue items are malformed.");
    const id = boundedText(item.field, "item.field");
    if (!id.ok) return id;
    const descriptor = fields.get(id.value);
    if (descriptor === undefined || ids.includes(id.value))
      return failure(
        "field",
        `KeyValue field ${id.value} is not unique in the Result.`,
      );
    if (item.label !== undefined && item.label !== descriptor.label)
      return failure(
        "field",
        `KeyValue field ${id.value} must use its registered label.`,
      );
    ids.push(id.value);
  }
  const selected = selectOne(input, binding);
  if (!selected.ok) return selected;
  return {
    ok: true,
    value: {
      ...commonConfig(
        input,
        binding,
        {},
        {
          fields: ids,
          columns: ids.map((id) => ({
            key: id,
            label: fields.get(id)!.label,
            type: fields.get(id)!.type.value,
          })),
          identity: binding.result.identity,
          selection: "none",
        },
      ),
      selectedRow: selected.value.row,
      selectedIndex: selected.value.index,
    },
  };
}

function resolveDetail(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<AeliqoDataResolvedConfig> {
  if (
    !allowedKeys(input, [
      "fields",
      "columns",
      "identity",
      "identityValues",
      "rowIdentity",
      "title",
      "entity",
    ])
  )
    return failure(
      "config",
      "Detail configuration contains an unknown property.",
    );
  const fields =
    input.fields === undefined
      ? {
          ok: true as const,
          value: binding.result.fields.map((field) => field.id),
        }
      : validFieldList(input.fields, binding.result);
  if (!fields.ok) return fields;
  const identity = identityFields(input, binding.result);
  if (!identity.ok) return identity;
  const columnFallback =
    input.columns === undefined
      ? (() => {
          const selected = binding.columns.filter((column) =>
            fields.value.includes(column.key),
          );
          if (selected.length > 0) return selected;
          return binding.result.fields
            .filter((field) => fields.value.includes(field.id))
            .map((field) => ({
              key: field.id,
              label: field.label,
              type: field.type.value,
            }));
        })()
      : undefined;
  const cols = columns(input, binding.result, columnFallback);
  if (!cols.ok) return cols;
  if (cols.value.some((column) => !fields.value.includes(column.key)))
    return failure("field", "Detail columns must be included in the configured fields.");
  const selected = selectOne(input, binding);
  if (!selected.ok) return selected;
  return {
    ok: true,
    value: {
      ...commonConfig(
        input,
        binding,
        {},
        {
          fields: fields.value,
          columns: cols.value,
          identity: identity.value,
          selection: "none",
        },
      ),
      selectedRow: selected.value.row,
      selectedIndex: selected.value.index,
      detailRow: selected.value.row,
    },
  };
}

function resolveCollection(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
  options: AeliqoDataRegistryOptions,
  kind: "recordList" | "cardCollection" | "table",
): Outcome<AeliqoDataResolvedConfig> {
  const keys =
    kind === "cardCollection"
      ? ["columns", "identity", "selection", "page", "headingKey"]
      : [
          "columns",
          "identity",
          "selection",
          "page",
          "mode",
          "virtualStart",
          "virtualized",
        ];
  if (!allowedKeys(input, keys))
    return failure(
      "config",
      `${kind} configuration contains an unknown property.`,
    );
  if (input.page !== undefined && typeof input.page !== "boolean")
    return failure("config", "page must be boolean when provided.");
  if (kind === "cardCollection") {
    if (input.headingKey !== undefined) {
      const heading = boundedText(input.headingKey, "headingKey");
      if (!heading.ok) return heading;
      if (!binding.result.fields.some((field) => field.id === heading.value))
        return failure(
          "field",
          "headingKey must name an authorized Result field.",
        );
    }
  }
  if (kind === "table") {
    if (
      input.mode !== undefined &&
      input.mode !== "table" &&
      input.mode !== "grid"
    )
      return failure("config", "table mode must be table or grid.");
    if (
      input.virtualized !== undefined &&
      typeof input.virtualized !== "boolean"
    )
      return failure("config", "table virtualized must be boolean.");
    if (
      input.virtualStart !== undefined &&
      (!Number.isSafeInteger(input.virtualStart) ||
        (input.virtualStart as number) < 0)
    )
      return failure(
        "config",
        "table virtualStart must be a safe nonnegative integer.",
      );
  }
  const identity = identityFields(input, binding.result);
  if (!identity.ok) return identity;
  const cols = columns(input, binding.result, binding.columns);
  if (!cols.ok) return cols;
  const mode = selection(input);
  if (!mode.ok) return mode;
  const ports = selectionPort(
    mode.value,
    binding.result,
    identity.value,
    options,
  );
  if (!ports.ok) return ports;
  const pagePorts = paginationPort(input);
  return {
    ok: true,
    value: commonConfig(
      input,
      binding,
      options,
      {
        fields: cols.value.map((column) => column.key),
        columns: cols.value,
        identity: identity.value,
        selection: mode.value,
      },
      [...ports.value, ...pagePorts],
    ),
  };
}

function resolveFilterBuilder(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
): Outcome<AeliqoDataResolvedConfig> {
  if (
    !allowedKeys(input, [
      "field",
      "fields",
      "outputId",
      "predicate",
      "inherited",
      "scopeLabel",
    ])
  )
    return failure(
      "config",
      "FilterBuilder configuration contains an unknown property.",
    );
  const outputId = boundedText(input.outputId, "outputId");
  if (!outputId.ok) return outputId;
  if (outputId.value !== binding.result.ref.outputId)
    return failure(
      "binding",
      "FilterBuilder outputId must match the exact authorized ResultRef.",
    );
  if (input.field !== undefined && input.fields !== undefined)
    return failure("config", "FilterBuilder must use either field or fields, not both.");
  const rawFields =
    input.fields ?? (input.field === undefined ? undefined : [input.field]);
  const fields = validFieldList(rawFields, binding.result, "fields");
  if (!fields.ok) return fields;
  const predicate =
    input.predicate === undefined
      ? {ok: true as const, value: undefined}
      : filterPredicate(input.predicate, binding.result, fields.value);
  if (!predicate.ok) return predicate;
  const inherited =
    input.inherited === undefined
      ? {ok: true as const, value: undefined}
      : filterPredicate(input.inherited, binding.result, fields.value);
  if (!inherited.ok) return inherited;
  const scopeLabel =
    input.scopeLabel === undefined
      ? {ok: true as const, value: undefined}
      : boundedText(input.scopeLabel, "scopeLabel");
  if (!scopeLabel.ok) return scopeLabel;
  const fieldDescriptors = fieldMap(binding.result);
  const normalized: Record<string, unknown> = {
    fields: fields.value,
    outputId: outputId.value,
    ...(predicate.value === undefined ? {} : {predicate: predicate.value}),
    ...(inherited.value === undefined ? {} : {inherited: inherited.value}),
    ...(scopeLabel.value === undefined ? {} : {scopeLabel: scopeLabel.value}),
  };
  return {
    ok: true,
    value: commonConfig(
      normalized,
      binding,
      {},
      {
        fields: fields.value,
        columns: fields.value.map((id) => ({
          key: id,
          label: fieldDescriptors.get(id)!.label,
          type: fieldDescriptors.get(id)!.type.value,
        })),
        identity: binding.result.identity,
        selection: "none",
      },
      filterPort(),
    ),
  };
}

function resolveSelectionSummary(
  input: Readonly<Record<string, unknown>>,
  binding: AeliqoValidatedBinding,
  options: AeliqoDataRegistryOptions,
): Outcome<AeliqoDataResolvedConfig> {
  if (!allowedKeys(input, ["identity", "entity", "clearable", "selection"]))
    return failure(
      "config",
      "SelectionSummary configuration contains an unknown property.",
    );
  const identity = identityFields(input, binding.result);
  if (!identity.ok) return identity;
  const entity = entityFor(binding.result, options, false);
  if (!entity.ok) return entity;
  if (
    input.entity !== undefined &&
    (entity.value === undefined || input.entity !== entity.value)
  )
    return failure(
      "binding",
      "SelectionSummary entity must use the trusted entity binding.",
    );
  const mode: Outcome<AeliqoSelectionMode> =
    input.selection === undefined
      ? { ok: true, value: "multiple" }
      : selection(input);
  if (!mode.ok) return mode;
  const ports: Outcome<readonly InteractionPort[]> =
    mode.value === "none"
      ? { ok: true, value: [] }
      : selectionPort(mode.value, binding.result, identity.value, options);
  if (!ports.ok) return ports;
  return {
    ok: true,
    value: commonConfig(
      input,
      binding,
      options,
      {
        fields: [],
        columns: [],
        identity: identity.value,
        selection: mode.value,
      },
      ports.value,
    ),
  };
}

function manifest(
  component: AeliqoDataComponentId,
  resolveConfig: AeliqoDataManifest["resolveConfig"],
): AeliqoDataManifest {
  return Object.freeze({
    ref: AELIQO_DATA_REFS[component],
    configSchema: AELIQO_DATA_CONFIG_SCHEMAS[component],
    result: "required",
    resolveConfig,
  });
}

function manifests(): readonly AeliqoDataManifest[] {
  return Object.freeze([
    manifest("metric", (values, binding) => resolveMetric(values, binding)),
    manifest("delta", (values, binding) => resolveDelta(values, binding)),
    manifest("keyValue", (values, binding) => resolveKeyValue(values, binding)),
    manifest("detail", (values, binding) => resolveDetail(values, binding)),
    manifest("recordList", (values, binding, options) =>
      resolveCollection(values, binding, options, "recordList"),
    ),
    manifest("cardCollection", (values, binding, options) =>
      resolveCollection(values, binding, options, "cardCollection"),
    ),
    manifest("table", (values, binding, options) =>
      resolveCollection(values, binding, options, "table"),
    ),
    manifest("filterBuilder", (values, binding) =>
      resolveFilterBuilder(values, binding),
    ),
    manifest("selectionSummary", (values, binding, options) =>
      resolveSelectionSummary(values, binding, options),
    ),
  ]);
}

function normalizeComponent(
  component: AeliqoDataNodeInput["component"],
): AeliqoDataComponentId | undefined {
  if (typeof component === "string")
    return Object.hasOwn(AELIQO_DATA_REFS, component)
      ? (component as AeliqoDataComponentId)
      : undefined;
  return (Object.keys(AELIQO_DATA_REFS) as AeliqoDataComponentId[]).find(
    (key) => {
      const ref = AELIQO_DATA_REFS[key];
      return ref.id === component.id && ref.revision === component.revision;
    },
  );
}

function validateScope(
  result: Result,
  rows: readonly AeliqoDataRecord[],
  scope: AeliqoDataScope | undefined,
): Outcome<AeliqoDataScope> {
  try {
    const population = result.counts.population;
    const coverage = result.coverage;
    if (
      coverage.kind !== "complete" &&
      coverage.kind !== "partial" &&
      coverage.kind !== "sample" &&
      coverage.kind !== "unknown"
    )
      return failure("scope", "The Result coverage state is not registered.");
    const digest =
      population.kind === "unknown" ? undefined : population.populationDigest;
    const coverageDigest =
      coverage.kind === "unknown" ? undefined : coverage.populationDigest;
    if (digest !== undefined && coverageDigest !== undefined && digest !== coverageDigest)
      return failure(
        "scope",
        "The Result population and coverage digests must match.",
      );
    if (population.kind === "exact" && population.value < rows.length)
      return failure(
        "count",
        "The exact Result population count cannot be below loaded rows.",
      );
    const canonical: AeliqoDataScope = {
      loaded: rows.length,
      ...(population.kind === "exact"
        ? { populationTotal: population.value }
        : {}),
      ...(digest === undefined ? {} : { populationDigest: digest }),
      kind:
        coverage.kind === "complete"
          ? "population"
          : coverage.kind === "unknown"
            ? "unknown"
            : "sample",
    };
    if (scope === undefined) return { ok: true, value: canonical };
    if (
      scope === null ||
      typeof scope !== "object" ||
      Array.isArray(scope) ||
      (Object.getPrototypeOf(scope) !== Object.prototype &&
        Object.getPrototypeOf(scope) !== null)
    )
      return failure("scope", "Scope must be a plain object.");
    const allowedKeys = [
      "loaded",
      "filteredTotal",
      "populationTotal",
      "populationDigest",
      "kind",
      "label",
    ];
    if (Object.keys(scope).some((key) => !allowedKeys.includes(key)))
      return failure("scope", "Scope contains an unknown property.");
    if (scope.loaded !== undefined && scope.loaded !== rows.length)
      return failure(
        "count",
        "Scope.loaded must equal the supplied authorized row count.",
      );
    if (
      scope.populationTotal !== undefined &&
      (population.kind !== "exact" || scope.populationTotal !== population.value)
    )
      return failure(
        "count",
        "Scope.populationTotal must match the exact Result population count.",
      );
    if (scope.populationDigest !== undefined && digest !== scope.populationDigest)
      return failure(
        "scope",
        "Scope.populationDigest must match the Result population digest.",
      );
    if (
      scope.filteredTotal !== undefined &&
      (!Number.isSafeInteger(scope.filteredTotal) ||
        scope.filteredTotal < rows.length ||
        (population.kind === "exact" && scope.filteredTotal > population.value))
    )
      return failure(
        "count",
        "Scope.filteredTotal must be a safe count at least as large as loaded rows.",
      );
    if (
      scope.loaded !== undefined &&
      (!Number.isSafeInteger(scope.loaded) || scope.loaded < 0)
    )
      return failure("count", "Scope.loaded must be a safe nonnegative count.");
    if (
      scope.populationTotal !== undefined &&
      (!Number.isSafeInteger(scope.populationTotal) || scope.populationTotal < 0)
    )
      return failure(
        "count",
        "Scope.populationTotal must be a safe nonnegative count.",
      );
    if (scope.kind !== undefined && scope.kind !== canonical.kind)
      return failure("scope", "Scope.kind must match the Result coverage state.");
    if (scope.label !== undefined && !boundedText(scope.label, "scope.label").ok)
      return failure("scope", "Scope.label must be bounded text.");
    return {
      ok: true,
      value: {
        ...canonical,
        ...(scope.filteredTotal === undefined
          ? {}
          : { filteredTotal: scope.filteredTotal }),
        ...(scope.label === undefined ? {} : { label: scope.label }),
        loaded: rows.length,
      },
    };
  } catch {
    return failure("scope", "Scope validation failed.");
  }
}

function validateBinding(
  binding: AeliqoDataBinding,
  options: AeliqoDataRegistryOptions,
): Outcome<AeliqoValidatedBinding> {
  if (binding === null || typeof binding !== "object")
    return failure("binding", "A data binding is required.");
  const result = binding.result;
  if (result === null || typeof result !== "object")
    return failure("binding", "The authorized Result descriptor is malformed.");
  const parsedResult = parseResult(result);
  if (!parsedResult.ok)
    return failure(
      "binding",
      "The authorized Result descriptor is not a valid core Result.",
    );
  const descriptor = parsedResult.value;
  if (!Array.isArray(binding.rows))
    return failure("binding", "Authorized rows must be an array.");
  const maxRows = options.maxRows ?? 10_000;
  if (
    !Number.isSafeInteger(maxRows) ||
    maxRows < 0 ||
    maxRows > 10_000 ||
    binding.rows.length > maxRows
  )
    return failure(
      "count",
      "Authorized rows exceed the bounded data view limit.",
    );
  if (binding.rows.length !== descriptor.counts.loaded)
    return failure(
      "count",
      "The supplied row count must equal Result.counts.loaded.",
    );
  const fields = fieldMap(descriptor);
  const identities = new Set<string>();
  const normalizedRows: AeliqoDataRecord[] = [];
  for (const row of binding.rows) {
    if (row === null || typeof row !== "object" || Array.isArray(row))
      return failure("row", "Authorized rows must be plain records.");
    const prototype = Object.getPrototypeOf(row);
    if (prototype !== Object.prototype && prototype !== null)
      return failure("row", "Authorized rows must be plain records.");
    try {
      for (const key of Object.keys(row))
        if (!fields.has(key))
          return failure(
            "field",
            `Authorized row contains undeclared field ${key}.`,
          );
      const normalized: Record<string, AeliqoDataValue> = {};
      for (const field of descriptor.fields) {
        const value = row[field.id];
        if (value === undefined) {
          if (!field.type.nullable)
            return failure(
              "field",
              `Authorized row is missing non-nullable field ${field.id}.`,
            );
          continue;
        }
        const checked = validateScalar(value, field.type);
        if (!checked.ok)
          return failure(
            "field",
            `Authorized row field ${field.id} does not match the Result semantic type.`,
          );
        normalized[field.id] = checked.value;
      }
      const identity = rowIdentity(normalized, descriptor);
      if (!identity.ok) return identity;
      if (identities.has(identity.value))
        return failure(
          "identity",
          "Authorized rows contain duplicate identity tuples.",
        );
      identities.add(identity.value);
      normalizedRows.push(Object.freeze(normalized));
    } catch {
      return failure("row", "Authorized row access failed validation.");
    }
  }
  const suppliedColumns = binding.columns;
  const checkedColumns = columns({}, descriptor, suppliedColumns);
  if (!checkedColumns.ok) return checkedColumns;
  const scope = validateScope(descriptor, normalizedRows, binding.scope);
  if (!scope.ok) return scope;
  return {
    ok: true,
    value: {
      result: descriptor,
      rows: normalizedRows,
      columns: checkedColumns.value.map((column) =>
        Object.freeze({ ...column }),
      ),
      scope: scope.value,
    },
  };
}

export function validateAeliqoDataBinding(
  binding: AeliqoDataBinding,
  options: AeliqoDataRegistryOptions = {},
): Outcome<AeliqoValidatedBinding> {
  return validateBinding(binding, options);
}

export function createAeliqoDataRegistry(
  options: AeliqoDataRegistryOptions = {},
): AeliqoDataRegistry {
  const entries = manifests();
  const byRef = new Map(
    entries.map((entry) => [`${entry.ref.id}@${entry.ref.revision}`, entry]),
  );
  const resolve = (
    input: AeliqoDataNodeInput,
    binding: AeliqoDataBinding,
  ): Outcome<AeliqoDataResolvedNode> => {
    try {
      if (
        input === null ||
        typeof input !== "object" ||
        typeof input.id !== "string" ||
        input.id.length === 0 ||
        input.id.length > MAX_NODE_ID
      )
        return failure("config", "A data node requires a bounded ID.");
      const component = normalizeComponent(input.component);
      if (component === undefined)
        return failure(
          "config",
          "The data node representation is not registered.",
        );
      const entry = byRef.get(
        `${AELIQO_DATA_REFS[component].id}@${AELIQO_DATA_REFS[component].revision}`,
      )!;
      const checkedBinding = validateBinding(binding, options);
      if (!checkedBinding.ok) return checkedBinding;
      const values = input.config ?? {};
      if (
        values === null ||
        typeof values !== "object" ||
        Array.isArray(values) ||
        Object.keys(values).length > MAX_VALUE_KEYS
      )
        return failure(
          "config",
          "Data configuration must be a bounded object.",
        );
      const wireValues = parseWireValue(values);
      if (
        !wireValues.ok ||
        wireValues.value === null ||
        typeof wireValues.value !== "object" ||
        Array.isArray(wireValues.value)
      )
        return failure(
          "config",
          "Data configuration must contain only bounded JSON values.",
        );
      const config = entry.resolveConfig(
        wireValues.value as Readonly<Record<string, unknown>>,
        checkedBinding.value,
        options,
      );
      if (!config.ok) return config;
      const selectedColumns =
        config.value.columns.length === 0
          ? checkedBinding.value.columns
          : config.value.columns;
      return {
        ok: true,
        value: Object.freeze({
          id: input.id,
          component,
          ref: entry.ref,
          result: checkedBinding.value.result,
          rows: checkedBinding.value.rows,
          columns: selectedColumns,
          scope: checkedBinding.value.scope,
          config: Object.freeze({
            ...config.value,
            values: Object.freeze({ ...config.value.values }),
            columns: Object.freeze(
              selectedColumns.map((column) => Object.freeze({ ...column })),
            ),
            fields: Object.freeze([...config.value.fields]),
            identity: Object.freeze([...config.value.identity]),
            ports: Object.freeze(
              config.value.ports.map((port) =>
                Object.freeze({
                  ...port,
                  ...(port.identity === undefined
                    ? {}
                    : { identity: Object.freeze([...port.identity]) }),
                  ...(port.grain === undefined
                    ? {}
                    : { grain: Object.freeze([...port.grain]) }),
                }),
              ),
            ),
          }),
        }),
      };
    } catch {
      return failure("config", "The data node could not be validated.");
    }
  };
  return Object.freeze({ manifests: entries, resolve });
}

export function resolveAeliqoDataNode(
  input: AeliqoDataNodeInput,
  binding: AeliqoDataBinding,
  options: AeliqoDataRegistryOptions = {},
): Outcome<AeliqoDataResolvedNode> {
  return createAeliqoDataRegistry(options).resolve(input, binding);
}

/** Compatibility alias for callers that call the binding pass directly. */
export const bindAeliqoDataNode = resolveAeliqoDataNode;
export const validateAeliqoDataResult = validateAeliqoDataBinding;

export type AeliqoDataInteractionPayload = Extract<
  InteractionPayload,
  { readonly kind: "selection" | "filter" | "range" | "group" | "page" }
>;
export type AeliqoDataField = Result["fields"][number];
export type AeliqoDataScalar = Scalar;
export type AeliqoDataValueType = AeliqoDataValue;
