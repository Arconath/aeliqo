import type {
  InteractionPayload,
  InteractionState,
  ResultRef,
  Scalar,
} from "@aeliqo/core";
import { validateScalar } from "@aeliqo/core";
import { html, nothing, type TemplateResult } from "lit";
import { calculateAeliqoDelta, type AeliqoDeltaMode } from "../data/delta.js";
import type { AeliqoKeyValueItem } from "../data/key-value.js";
import type { AeliqoSelectionScope } from "../data/selection-summary.js";
import { stableDataRecordKey, dataValueText } from "../data/shared.js";
import type {
  AeliqoDataScope,
  AeliqoDataStatus,
  AeliqoFilterChangeDetail,
  AeliqoFilterPredicate,
  AeliqoPageRequest,
  AeliqoSortState,
  AeliqoTableWindowDetail,
} from "../data/types.js";
import type { AeliqoDataResolvedNode } from "./data-registry.js";

export type AeliqoDataCanonicalPayload = Extract<
  InteractionPayload,
  { readonly kind: "selection" | "filter" }
>;

/**
 * Host requests emitted by the renderer. Selection and filter carry the
 * canonical core InteractionPayload. Page/sort/window/load-more stay typed
 * component requests because the core wire contract has no implicit window or
 * sort payload. The host decides whether and how to query.
 */
export type AeliqoDataHostRequest =
  | {
      readonly kind: "selection";
      readonly nodeId: string;
      readonly portId: string;
      readonly payload: Extract<
        InteractionPayload,
        { readonly kind: "selection" }
      >;
    }
  | {
      readonly kind: "filter";
      readonly nodeId: string;
      readonly portId: string;
      readonly payload: Extract<
        InteractionPayload,
        { readonly kind: "filter" }
      >;
    }
  | {
      readonly kind: "page";
      readonly nodeId: string;
      readonly portId: string;
      readonly request: AeliqoPageRequest;
    }
  | {
      readonly kind: "sort";
      readonly nodeId: string;
      readonly portId: string;
      readonly request: AeliqoSortState | undefined;
    }
  | {
      readonly kind: "window";
      readonly nodeId: string;
      readonly portId: string;
      readonly request: AeliqoTableWindowDetail;
    }
  | {
      readonly kind: "load-more";
      readonly nodeId: string;
      readonly portId: string;
    };

export type AeliqoDataHostRequestHandler = (
  request: AeliqoDataHostRequest,
) => void;

export interface AeliqoDataRenderContext {
  readonly interaction?: InteractionState;
  readonly onRequest?: AeliqoDataHostRequestHandler;
}

const RESULT_REF_KEYS = [
  "id",
  "revision",
  "outputId",
  "queryDigest",
  "scopeDigest",
] as const;

/**
 * Read only plain data records at the event boundary.  Event details come
 * from component/application code and may be proxies, class instances or
 * accessor-backed objects.  Copying data descriptors both prevents an
 * accidental getter from becoming trusted input and gives callers one
 * fail-closed representation to validate.
 */
const record = (value: unknown): Record<string, unknown> | undefined => {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return undefined;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return undefined;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
};

function exactRecord(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[] = allowed,
): Record<string, unknown> | undefined {
  const candidate = record(value);
  if (candidate === undefined) return undefined;
  const keys = Object.keys(candidate);
  if (keys.some((key) => !allowed.includes(key))) return undefined;
  if (required.some((key) => !Object.hasOwn(candidate, key))) return undefined;
  return candidate;
}

function resultRef(value: unknown): ResultRef | undefined {
  const candidate = exactRecord(value, RESULT_REF_KEYS);
  if (
    candidate === undefined ||
    RESULT_REF_KEYS.some(
      (key) =>
        typeof candidate[key] !== "string" ||
        !validId(candidate[key]),
    )
  )
    return undefined;
  return {
    id: candidate.id as string,
    revision: candidate.revision as string,
    outputId: candidate.outputId as string,
    queryDigest: candidate.queryDigest as string,
    scopeDigest: candidate.scopeDigest as string,
  };
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\s\u0000-\u001f\u007f]/u.test(value)
  );
}

function eventType(event: Event): string | undefined {
  try {
    return typeof event.type === "string" ? event.type : undefined;
  } catch {
    return undefined;
  }
}

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function refKey(ref: ResultRef): string {
  return JSON.stringify([
    ref.id,
    ref.revision,
    ref.outputId,
    ref.queryDigest,
    ref.scopeDigest,
  ]);
}

function sameRef(left: ResultRef | undefined, right: ResultRef): boolean {
  try {
    const checked = resultRef(left);
    return checked !== undefined && refKey(checked) === refKey(right);
  } catch {
    return false;
  }
}

function statusFor(node: AeliqoDataResolvedNode): AeliqoDataStatus {
  if (
    node.result.coverage.kind === "partial" ||
    node.result.coverage.kind === "sample"
  )
    return "partial";
  if (node.result.coverage.kind === "unknown") return "unavailable";
  return "ready";
}

function selectionPort(
  node: AeliqoDataResolvedNode,
  output = false,
) {
  try {
    return node.config.ports.find(
      (candidate) =>
        candidate.id === "selection" &&
        candidate.payload === "selection" &&
        (!output ||
          candidate.direction === "output" ||
          candidate.direction === "inout"),
    );
  } catch {
    return undefined;
  }
}

function port(
  node: AeliqoDataResolvedNode,
  id: string,
  payload: InteractionPayload["kind"],
): boolean {
  try {
    return node.config.ports.some(
      (candidate) =>
        candidate.id === id &&
        candidate.payload === payload &&
        (candidate.direction === "output" || candidate.direction === "inout"),
    );
  } catch {
    return false;
  }
}

/** Typed host requests have no core payload/port.  Their availability comes
 * from the validated component capability and an installed host callback. */
function hostOutput(
  context: AeliqoDataRenderContext,
): AeliqoDataHostRequestHandler | undefined {
  try {
    return typeof context.onRequest === "function" ? context.onRequest : undefined;
  } catch {
    return undefined;
  }
}

function interactionPayload(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
  kind: "selection" | "filter",
  portId: string,
): Record<string, unknown> | undefined {
  try {
    const values = interaction?.values;
    if (!Array.isArray(values)) return undefined;
    for (const raw of values) {
      const entry = exactRecord(
        raw,
        ["nodeId", "portId", "payload"],
      );
      if (
        entry === undefined ||
        entry.nodeId !== node.id ||
        entry.portId !== portId
      )
        continue;
      const payload = exactRecord(
        entry.payload,
        kind === "selection"
          ? ["kind", "selection"]
          : ["kind", "predicates", "outputId"],
      );
      if (payload?.kind === kind) return payload;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function exactKeys(keys: readonly unknown[]): keys is readonly string[] {
  try {
    return (
      keys.length > 0 &&
      new Set(keys).size === keys.length &&
      keys.every((key) => typeof key === "string" && key.length > 0)
    );
  } catch {
    return false;
  }
}

function validScopeDetail(value: unknown, node: AeliqoDataResolvedNode): boolean {
  if (value === undefined) return true;
  const scope = exactRecord(
    value,
    [
      "loaded",
      "filteredTotal",
      "populationTotal",
      "populationDigest",
      "kind",
      "label",
    ],
    [],
  );
  if (scope === undefined) return false;
  for (const key of ["loaded", "filteredTotal", "populationTotal"] as const) {
    if (
      Object.hasOwn(scope, key) &&
      (!Number.isSafeInteger(scope[key]) || (scope[key] as number) < 0)
    )
      return false;
  }
  if (
    Object.hasOwn(scope, "populationDigest") &&
    (typeof scope.populationDigest !== "string" ||
      scope.populationDigest !== node.scope.populationDigest)
  )
    return false;
  if (
    Object.hasOwn(scope, "kind") &&
    !["loaded", "filtered", "population", "sample", "unknown"].includes(
      String(scope.kind),
    )
  )
    return false;
  return (
    !Object.hasOwn(scope, "label") ||
    typeof scope.label === "string"
  );
}

function selectedKeys(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): readonly string[] {
  const selection = validatedSelection(node, interaction);
  return selection?.mode === "ids" ? selection.keys : [];
}

function selectedSummary(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): {
  readonly keys: readonly string[];
  readonly scope?: AeliqoSelectionScope;
} {
  const selection = validatedSelection(node, interaction);
  if (selection === undefined || selection.mode === "clear") return { keys: [] };
  if (selection.mode === "ids") {
    return {
      keys: selection.keys,
      scope: { kind: "ids", matched: selection.keys.length },
    };
  }
  return {
    keys: [],
    scope: {
      kind: "predicate",
      label: "All matching records in the active server filter",
    },
  };
}

function currentFilter(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): AeliqoFilterChangeDetail | undefined {
  try {
    const payload = interactionPayload(node, interaction, "filter", "filter");
    if (
      payload === undefined ||
      payload.outputId !== node.result.ref.outputId ||
      !Array.isArray(payload.predicates)
    )
      return undefined;
    const predicates = payload.predicates;
    if (
      predicates.length > 128 ||
      predicates.some((predicate) => !validatePredicate(predicate, node))
    )
      return undefined;
    const predicate: AeliqoFilterPredicate | undefined =
      predicates.length === 0
        ? undefined
        : predicates.length === 1
          ? (predicates[0] as AeliqoFilterPredicate)
          : {
              op: "and" as const,
              predicates: predicates as AeliqoFilterPredicate[],
            };
    return { ...(predicate === undefined ? {} : { predicate }), applied: true };
  } catch {
    return undefined;
  }
}

type ValidatedSelection =
  | { readonly mode: "clear" }
  | {
      readonly mode: "ids";
      readonly entity: string;
      readonly keys: readonly string[];
      readonly result: ResultRef;
    }
  | {
      readonly mode: "predicate";
      readonly entity: string;
      readonly predicate: AeliqoFilterPredicate;
      readonly queryDigest: string;
      readonly populationDigest: string;
    };

function validPopulationDigest(node: AeliqoDataResolvedNode): string | undefined {
  return typeof node.scope.populationDigest === "string" &&
    node.scope.populationDigest.length > 0
    ? node.scope.populationDigest
    : undefined;
}

function validatedSelection(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): ValidatedSelection | undefined {
  const payload = interactionPayload(
    node,
    interaction,
    "selection",
    "selection",
  );
  if (payload === undefined) return undefined;
  const selection = record(payload.selection);
  const selectionPortValue = selectionPort(node);
  if (selection === undefined || selectionPortValue === undefined) return undefined;
  const mode = selection.mode;
  if (mode === "clear") {
    return Object.keys(selection).length === 1 &&
      Object.hasOwn(selection, "mode")
      ? { mode: "clear" }
      : undefined;
  }
  const entity = selection.entity;
  if (typeof entity !== "string" || entity !== selectionPortValue.entity)
    return undefined;
  if (mode === "ids") {
    const checkedResult = resultRef(selection.result);
    const keys = selection.keys;
    if (
      Object.keys(selection).some(
        (key) => !["mode", "entity", "keys", "result"].includes(key),
      ) ||
      checkedResult === undefined ||
      !sameRef(checkedResult, node.result.ref) ||
      !Array.isArray(keys) ||
      !exactKeys(keys)
    )
      return undefined;
    return {
      mode: "ids",
      entity,
      keys: [...keys],
      result: checkedResult,
    };
  }
  if (mode === "predicate") {
    const queryDigest = selection.queryDigest;
    const populationDigest = selection.populationDigest;
    if (
      Object.keys(selection).some(
        (key) =>
          ![
            "mode",
            "entity",
            "predicate",
            "queryDigest",
            "populationDigest",
          ].includes(key),
      ) ||
      typeof queryDigest !== "string" ||
      queryDigest !== node.result.ref.queryDigest ||
      typeof populationDigest !== "string" ||
      populationDigest !== validPopulationDigest(node) ||
      !validatePredicate(selection.predicate, node)
    )
      return undefined;
    return {
      mode: "predicate",
      entity,
      predicate: selection.predicate as AeliqoFilterPredicate,
      queryDigest,
      populationDigest,
    };
  }
  return undefined;
}

function normalizedScalar(value: unknown): Scalar | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  )
    return value as Scalar;
  const candidate = record(value);
  return candidate !== undefined &&
    Object.keys(candidate).length === 1 &&
    typeof candidate.decimal === "string"
    ? { decimal: candidate.decimal }
    : undefined;
}

function validKeys(
  node: AeliqoDataResolvedNode,
  keys: readonly string[],
  interaction: InteractionState | undefined,
  entity: string,
): boolean {
  try {
    if (!exactKeys(keys)) return false;
    const loaded = new Set(
      node.rows
        .map((row) => stableDataRecordKey(row, node.config.identity))
        .filter((key): key is string => key !== undefined),
    );
    const authorized = validatedSelection(node, interaction);
    const retained =
      authorized?.mode === "ids" && authorized.entity === entity
        ? new Set(authorized.keys)
        : new Set<string>();
    return keys.every((key) => loaded.has(key) || retained.has(key));
  } catch {
    return false;
  }
}

function dispatchSelection(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  const type = eventType(event);
  if (
    type === undefined ||
    ![
      "aeliqo-record-list-selection",
      "aeliqo-card-selection",
      "aeliqo-table-selection",
      "aeliqo-selection-clear",
    ].includes(type)
  )
    return;
  const selection = selectionPort(node, true);
  if (selection === undefined) return;
  const detail = exactRecord(
    eventDetail(event),
    ["mode", "entity", "keys", "result", "scope"],
    ["mode", "entity", "keys"],
  );
  if (
    detail === undefined ||
    (detail.mode !== "clear" && detail.mode !== "ids") ||
    typeof detail.entity !== "string" ||
    !Array.isArray(detail.keys) ||
    !exactKeys(detail.keys)
  )
    return;
  if (!validScopeDetail(detail.scope, node)) return;
  const entity = selection.entity;
  if (detail.entity !== entity) return;
  const keys = detail.keys as string[];
  if (detail.mode === "clear") {
    if (keys.length !== 0) return;
    if (
      Object.hasOwn(detail, "result") &&
      !sameRef(detail.result as ResultRef, node.result.ref)
    )
      return;
    hostOutput(context)?.({
      kind: "selection",
      nodeId: node.id,
      portId: selection.id,
      payload: { kind: "selection", selection: { mode: "clear" } },
    });
    return;
  }
  const candidateResult = resultRef(detail.result);
  if (
    candidateResult === undefined ||
    !sameRef(candidateResult, node.result.ref) ||
    !validKeys(node, keys, context.interaction, entity)
  )
    return;
  hostOutput(context)?.({
    kind: "selection",
    nodeId: node.id,
    portId: selection.id,
    payload: {
      kind: "selection",
      selection: {
        mode: "ids",
        entity,
        keys: [...keys] as [string, ...string[]],
        result: node.result.ref,
      },
    },
  });
}

function scalarValueForField(value: unknown): Scalar | undefined {
  return normalizedScalar(value);
}

function validatePredicate(
  value: unknown,
  node: AeliqoDataResolvedNode,
): boolean {
  try {
    const fields = new Map(node.result.fields.map((field) => [field.id, field]));
    const allowedFields =
      node.config.fields.length === 0
        ? new Set(node.result.fields.map((field) => field.id))
        : new Set(node.config.fields);
    const seen = new WeakSet<object>();
    const check = (item: unknown, depth = 0): boolean => {
    if (depth > 32 || item === null || typeof item !== "object") return false;
    if (seen.has(item)) return false;
    seen.add(item);
    const predicate = record(item);
    if (predicate === undefined || typeof predicate.op !== "string") return false;
    if (predicate.op === "and" || predicate.op === "or") {
      if (
        Object.keys(predicate).some((key) =>
          !["op", "predicates"].includes(key),
        ) ||
        !Array.isArray(predicate.predicates) ||
        predicate.predicates.length === 0 ||
        predicate.predicates.length > 128
      )
        return false;
      return predicate.predicates.every((child) => check(child, depth + 1));
    }
    if (predicate.op === "not") {
      return (
        Object.keys(predicate).length === 2 &&
        Object.hasOwn(predicate, "predicate") &&
        check(predicate.predicate, depth + 1)
      );
    }
    const field =
      typeof predicate.field === "string"
        ? fields.get(predicate.field)
        : undefined;
    if (
      field === undefined ||
      !allowedFields.has(predicate.field as string) ||
      (Object.hasOwn(predicate, "entity") && predicate.entity !== undefined)
    )
      return false;
    if (predicate.op === "is-null") {
      return (
        Object.keys(predicate).every((key) =>
          ["op", "field", "negate"].includes(key),
        ) &&
        typeof predicate.negate === "boolean"
      );
    }
    if (predicate.op === "compare") {
      const scalar = scalarValueForField(predicate.value);
      const checked =
        scalar === undefined ? undefined : validateScalar(scalar, field.type);
      return (
        Object.keys(predicate).every((key) =>
          ["op", "field", "comparison", "value"].includes(key),
        ) &&
        ["eq", "ne", "lt", "lte", "gt", "gte"].includes(
          String(predicate.comparison),
        ) &&
        checked?.ok === true
      );
    }
    if (predicate.op === "in") {
      return (
        Object.keys(predicate).every((key) =>
          ["op", "field", "values"].includes(key),
        ) &&
        Array.isArray(predicate.values) &&
        predicate.values.length > 0 &&
        predicate.values.length <= 128 &&
        predicate.values.every((item) => {
          const scalar = scalarValueForField(item);
          return scalar !== undefined && validateScalar(scalar, field.type).ok;
        })
      );
    }
    return false;
    };
    return check(value);
  } catch {
    return false;
  }
}

function dispatchFilter(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (eventType(event) !== "aeliqo-filter-change") return;
  if (!port(node, "filter", "filter")) return;
  const detail = exactRecord(
    eventDetail(event),
    ["predicate", "inherited", "scopeLabel", "applied"],
    ["applied"],
  ) as AeliqoFilterChangeDetail | undefined;
  if (
    detail === undefined ||
    detail.applied !== true ||
    (Object.hasOwn(detail, "scopeLabel") &&
      detail.scopeLabel !== undefined &&
      typeof detail.scopeLabel !== "string")
  )
    return;
  const predicate = detail.predicate;
  if (predicate !== undefined && !validatePredicate(predicate, node)) return;
  const inherited = detail.inherited;
  if (inherited !== undefined && !validatePredicate(inherited, node)) return;
  const effective =
    predicate === undefined
      ? inherited
      : inherited === undefined
        ? predicate
        : { op: "and" as const, predicates: [inherited, predicate] };
  const predicates: Extract<
    InteractionPayload,
    { readonly kind: "filter" }
  >["predicates"] =
    effective === undefined
      ? []
      : [effective as AeliqoFilterPredicate];
  hostOutput(context)?.({
    kind: "filter",
    nodeId: node.id,
    portId: "filter",
    payload: { kind: "filter", predicates, outputId: node.result.ref.outputId },
  });
}

function eventDetail<T>(event: Event): T | undefined {
  try {
    if (typeof CustomEvent === "undefined" || !(event instanceof CustomEvent))
      return undefined;
    return (event.detail as T) ?? undefined;
  } catch {
    return undefined;
  }
}

function dispatchPage(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (eventType(event) !== "aeliqo-table-page") return;
  if (!port(node, "page", "page")) return;
  const detail = exactRecord(
    eventDetail(event),
    ["page", "pageSize", "result"],
    ["page", "pageSize"],
  );
  if (detail === undefined) return;
  const request: AeliqoPageRequest = {
    page: detail.page as number,
    pageSize: detail.pageSize as number,
    ...(Object.hasOwn(detail, "result") && detail.result !== undefined
      ? { result: detail.result as ResultRef }
      : {}),
  };
  if (
    request === undefined ||
    !Number.isSafeInteger(request.page) ||
    request.page < 1 ||
    !Number.isSafeInteger(request.pageSize) ||
    request.pageSize < 1
  )
    return;
  if (request.result !== undefined && !sameRef(request.result, node.result.ref))
    return;
  hostOutput(context)?.({
    kind: "page",
    nodeId: node.id,
    portId: "page",
    request: { page: request.page, pageSize: request.pageSize, result: node.result.ref },
  });
}

function dispatchSort(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (eventType(event) !== "aeliqo-table-sort") return;
  if (node.component !== "table" || !node.columns.some((column) => column.sortable === true)) return;
  const detail = exactRecord(eventDetail(event), ["sort"], ["sort"]);
  if (detail === undefined) return;
  const sortValue = detail.sort;
  const sort =
    sortValue === undefined
      ? undefined
      : record(sortValue);
  if (
    sortValue !== undefined &&
    (sort === undefined ||
      Object.keys(sort).some((key) => !["field", "direction"].includes(key)) ||
      typeof sort.field !== "string" ||
      (sort.direction !== "asc" && sort.direction !== "desc") ||
      !node.columns.some(
        (column) => column.key === sort.field && column.sortable === true,
      ))
  )
    return;
  hostOutput(context)?.({
    kind: "sort",
    nodeId: node.id,
    portId: "sort",
    request:
      sort === undefined
        ? undefined
        : { field: sort.field as string, direction: sort.direction as "asc" | "desc" },
  });
}

function dispatchWindow(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (
    eventType(event) !== "aeliqo-table-window" ||
    node.component !== "table" ||
    node.config.values.virtualized !== true ||
    node.config.values.mode !== "grid"
  )
    return;
  const detail = exactRecord(
    eventDetail(event),
    ["start", "count", "overscan", "row", "column", "reason", "result"],
    ["start", "count", "overscan", "row", "column", "reason"],
  );
  if (detail === undefined) return;
  const request: AeliqoTableWindowDetail = {
    start: detail.start as number,
    count: detail.count as number,
    overscan: detail.overscan as number,
    row: detail.row as number,
    column: detail.column as number,
    reason: detail.reason as "keyboard",
    ...(Object.hasOwn(detail, "result") && detail.result !== undefined
      ? { result: detail.result as ResultRef }
      : {}),
  };
  if (
    request === undefined ||
    request.reason !== "keyboard" ||
    !Number.isSafeInteger(request.start) ||
    request.start < 0 ||
    !Number.isSafeInteger(request.count) ||
    request.count < 1 ||
    !Number.isSafeInteger(request.overscan) ||
    request.overscan < 0 ||
    !Number.isSafeInteger(request.row) ||
    request.row < 0 ||
    !Number.isSafeInteger(request.column) ||
    request.column < 0
  )
    return;
  if (request.result !== undefined && !sameRef(request.result, node.result.ref))
    return;
  hostOutput(context)?.({
    kind: "window",
    nodeId: node.id,
    portId: "window",
    request: {
      start: request.start,
      count: request.count,
      overscan: request.overscan,
      row: request.row,
      column: request.column,
      reason: request.reason,
      result: node.result.ref,
    },
  });
}

function dispatchLoadMore(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (
    eventType(event) !== "aeliqo-data-load-more" ||
    node.component !== "cardCollection"
  )
    return;
  const detail = exactRecord(eventDetail(event), ["requested"], ["requested"]);
  if (detail === undefined || detail.requested !== true || !hasMore(node)) return;
  hostOutput(context)?.({
    kind: "load-more",
    nodeId: node.id,
    portId: "load-more",
  });
}

function hasMore(node: AeliqoDataResolvedNode): boolean {
  const population =
    node.result.counts.population.kind === "exact"
      ? node.result.counts.population.value
      : node.scope.filteredTotal;
  return (
    Number.isSafeInteger(population) &&
    (population as number) > node.rows.length
  );
}

function metricTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
): TemplateResult {
  const field = node.config.metricField ?? node.config.fields[0] ?? "";
  const descriptor = node.result.fields.find(
    (candidate) => candidate.id === field,
  );
  return html`<aeliqo-metric
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .label=${descriptor?.label ?? field}
    .value=${node.config.selectedRow?.[field]}
    .unit=${descriptor?.type.unit?.symbol ?? ""}
    .scope=${node.scope}
    .status=${status}
  ></aeliqo-metric>`;
}

function deltaTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
): TemplateResult {
  const delta = node.config.delta;
  const current = delta?.currentRow[delta.currentField];
  const baseline = delta?.baselineRow[delta.baselineField];
  const mode = delta?.mode ?? "absolute";
  const currentField = node.result.fields.find(
    (field) => field.id === delta?.currentField,
  );
  return html`<aeliqo-delta
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .label=${text(node.config.values.label, "Change")}
    .current=${current}
    .baseline=${baseline}
    .mode=${mode}
    .compatible=${true}
    .unit=${currentField?.type.unit?.symbol ?? ""}
    .scope=${node.scope}
    .status=${status}
  ></aeliqo-delta>`;
}

function keyValueTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
): TemplateResult {
  const row = node.config.selectedRow;
  const rawItems = Array.isArray(node.config.values.items)
    ? node.config.values.items
    : [];
  const items: AeliqoKeyValueItem[] = node.config.fields.map((field) => {
    const raw = record(rawItems.find((item) => record(item)?.field === field));
    const descriptor = node.result.fields.find(
      (candidate) => candidate.id === field,
    );
    const item: AeliqoKeyValueItem = {
      key: field,
      label: descriptor?.label ?? field,
      ...(row?.[field] === undefined ? {} : { value: row[field] }),
      ...(raw?.description === undefined
        ? {}
        : { description: text(raw.description) }),
      ...(raw?.displayValue === undefined
        ? {}
        : { displayValue: text(raw.displayValue) }),
      ...(raw?.href === undefined ? {} : { href: text(raw.href) }),
    };
    return item;
  });
  return html`<aeliqo-key-value
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .items=${items}
    .scope=${node.scope}
    .status=${status}
  ></aeliqo-key-value>`;
}

function detailTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
): TemplateResult {
  const entity =
    selectionPort(node)?.entity ?? text(node.config.values.entity, "record");
  return html`<aeliqo-detail
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .record=${node.config.detailRow ?? node.config.selectedRow}
    .fields=${node.columns}
    .identity=${node.config.identity}
    .entity=${entity}
    .title=${text(node.config.values.title, "Details")}
    .scope=${node.scope}
    .status=${status}
  ></aeliqo-detail>`;
}

function collectionTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
  context: AeliqoDataRenderContext,
  component: "record-list" | "card-collection" | "table",
): TemplateResult {
  const entity = selectionPort(node)?.entity ?? "record";
  const selected = selectedKeys(node, context.interaction);
  const result = node.result.ref;
  const selection = node.config.selection;
  if (component === "record-list")
    return html`<aeliqo-record-list
      data-aeliqo-node-id=${node.id}
      data-aeliqo-theme="inherit"
      .rows=${node.rows}
      .columns=${node.columns}
      .identity=${node.config.identity}
      .entity=${entity}
      .selection=${selection}
      .selectedKeys=${selected}
      .result=${result}
      .scope=${node.scope}
      .status=${status}
      @aeliqo-record-list-selection=${(event: Event) => dispatchSelection(node, event, context)}
    ></aeliqo-record-list>`;
  if (component === "card-collection") {
    const more = hasMore(node);
    return html`<aeliqo-card-collection
      data-aeliqo-node-id=${node.id}
      data-aeliqo-theme="inherit"
      .rows=${node.rows}
      .columns=${node.columns}
      .identity=${node.config.identity}
      .headingKey=${text(node.config.values.headingKey)}
      .entity=${entity}
      .selection=${selection}
      .selectedKeys=${selected}
      .result=${result}
      .scope=${node.scope}
      .status=${status}
      .hasMore=${more}
      .loadingMore=${false}
      @aeliqo-card-selection=${(event: Event) => dispatchSelection(node, event, context)}
      @aeliqo-data-load-more=${(event: Event) => dispatchLoadMore(node, event, context)}
    ></aeliqo-card-collection>`;
  }
  const mode = node.config.values.mode === "grid" ? "grid" : "table";
  const virtualStart =
    Number.isSafeInteger(node.config.values.virtualStart) &&
    (node.config.values.virtualStart as number) >= 0
      ? (node.config.values.virtualStart as number)
      : 0;
  return html`<aeliqo-table
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .columns=${node.columns}
    .rows=${node.rows}
    .identity=${node.config.identity}
    .entity=${entity}
    .selection=${selection}
    .selectedKeys=${selected}
    .result=${result}
    .mode=${mode}
    .virtualized=${node.config.values.virtualized === true}
    .virtualStart=${virtualStart}
    .totalRows=${node.scope.populationTotal ?? node.scope.filteredTotal ?? node.rows.length}
    @aeliqo-table-selection=${(event: Event) => dispatchSelection(node, event, context)}
    @aeliqo-table-page=${(event: Event) => dispatchPage(node, event, context)}
    @aeliqo-table-sort=${(event: Event) => dispatchSort(node, event, context)}
    @aeliqo-table-window=${(event: Event) => dispatchWindow(node, event, context)}
  ></aeliqo-table>`;
}

function filterTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
  context: AeliqoDataRenderContext,
): TemplateResult {
  const fields = node.result.fields
    .filter((field) => node.config.fields.includes(field.id))
    .map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type.value,
      nullable: field.type.nullable,
      semanticType: field.type,
    }));
  const current = currentFilter(node, context.interaction);
  return html`<aeliqo-filter-builder
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .fields=${fields}
    .predicate=${current?.predicate}
    .scopeLabel=${text(node.config.values.scopeLabel, "Current authorized scope")}
    .status=${status}
    @aeliqo-filter-change=${(event: Event) => dispatchFilter(node, event, context)}
  ></aeliqo-filter-builder>`;
}

function selectionTemplate(
  node: AeliqoDataResolvedNode,
  status: AeliqoDataStatus,
  context: AeliqoDataRenderContext,
): TemplateResult {
  const summary = selectedSummary(node, context.interaction);
  const entity = selectionPort(node)?.entity ?? "record";
  return html`<aeliqo-selection-summary
    data-aeliqo-node-id=${node.id}
    data-aeliqo-theme="inherit"
    .selectedKeys=${summary.keys}
    .selectionScope=${summary.scope}
    .entity=${entity}
    .result=${node.result.ref}
    .scope=${node.scope}
    .status=${status}
    .clearable=${node.config.values.clearable !== false}
    @aeliqo-selection-clear=${(event: Event) => dispatchSelection(node, event, context)}
  ></aeliqo-selection-summary>`;
}

/** Render one already validated data node using the shared owned data elements. */
export function renderAeliqoDataNode(
  node: AeliqoDataResolvedNode,
  context: AeliqoDataRenderContext = {},
): TemplateResult | typeof nothing {
  const status = statusFor(node);
  switch (node.component) {
    case "metric":
      return metricTemplate(node, status);
    case "delta":
      return deltaTemplate(node, status);
    case "keyValue":
      return keyValueTemplate(node, status);
    case "detail":
      return detailTemplate(node, status);
    case "recordList":
      return collectionTemplate(node, status, context, "record-list");
    case "cardCollection":
      return collectionTemplate(node, status, context, "card-collection");
    case "table":
      return collectionTemplate(node, status, context, "table");
    case "filterBuilder":
      return filterTemplate(node, status, context);
    case "selectionSummary":
      return selectionTemplate(node, status, context);
  }
}

/** Short alias for host renderers. */
export const renderDataNode = renderAeliqoDataNode;
