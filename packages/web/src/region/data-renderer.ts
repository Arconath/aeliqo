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
  AeliqoDataColumn,
  AeliqoDataRecord,
  AeliqoDataScope,
  AeliqoDataStatus,
  AeliqoFilterChangeDetail,
  AeliqoFilterPredicate,
  AeliqoPageRequest,
  AeliqoSelectionDetail,
  AeliqoSortState,
  AeliqoTableSortDetail,
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

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

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
  return left !== undefined && refKey(left) === refKey(right);
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

function selectionPort(node: AeliqoDataResolvedNode) {
  return node.config.ports.find(
    (port) => port.id === "selection" && port.payload === "selection",
  );
}

function port(
  node: AeliqoDataResolvedNode,
  id: string,
  payload: InteractionPayload["kind"],
): boolean {
  return node.config.ports.some(
    (candidate) => candidate.id === id && candidate.payload === payload,
  );
}

function selectedKeys(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): readonly string[] {
  const entry = interaction?.values.find(
    (candidate) =>
      candidate.nodeId === node.id && candidate.payload.kind === "selection",
  );
  if (
    entry?.payload.kind !== "selection" ||
    entry.payload.selection.mode !== "ids"
  )
    return [];
  if (!sameRef(entry.payload.selection.result, node.result.ref)) return [];
  return entry.payload.selection.keys;
}

function selectedSummary(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): {
  readonly keys: readonly string[];
  readonly scope?: AeliqoSelectionScope;
} {
  const entry = interaction?.values.find(
    (candidate) =>
      candidate.nodeId === node.id && candidate.payload.kind === "selection",
  );
  if (entry?.payload.kind !== "selection") return { keys: [] };
  if (entry.payload.selection.mode === "ids") {
    if (!sameRef(entry.payload.selection.result, node.result.ref))
      return { keys: [] };
    return {
      keys: entry.payload.selection.keys,
      scope: { kind: "ids", matched: entry.payload.selection.keys.length },
    };
  }
  if (entry.payload.selection.mode === "predicate") {
    return {
      keys: [],
      scope: {
        kind: "predicate",
        label: "All matching records in the active server filter",
      },
    };
  }
  return { keys: [] };
}

function currentFilter(
  node: AeliqoDataResolvedNode,
  interaction: InteractionState | undefined,
): AeliqoFilterChangeDetail | undefined {
  const entry = interaction?.values.find(
    (candidate) =>
      candidate.nodeId === node.id && candidate.payload.kind === "filter",
  );
  if (
    entry?.payload.kind !== "filter" ||
    entry.payload.outputId !== node.result.ref.outputId
  )
    return undefined;
  const predicates = entry.payload.predicates;
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
): boolean {
  const allowed = new Set(
    node.rows
      .map((row) => stableDataRecordKey(row, node.config.identity))
      .filter((key): key is string => key !== undefined),
  );
  return (
    keys.length > 0 &&
    new Set(keys).size === keys.length &&
    keys.every((key) => allowed.has(key))
  );
}

function dispatchSelection(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (
    ![
      "aeliqo-record-list-selection",
      "aeliqo-card-selection",
      "aeliqo-table-selection",
      "aeliqo-selection-clear",
    ].includes(event.type)
  )
    return;
  const selection = selectionPort(node);
  if (selection === undefined) return;
  const detail =
    typeof CustomEvent !== "undefined" && event instanceof CustomEvent
      ? record(event.detail)
      : undefined;
  if (
    detail === undefined ||
    (detail.mode !== "clear" && detail.mode !== "ids") ||
    typeof detail.entity !== "string" ||
    !Array.isArray(detail.keys) ||
    detail.keys.some((key) => typeof key !== "string")
  )
    return;
  const entity = selection.entity;
  if (detail.entity !== entity) return;
  const keys = detail.keys as string[];
  if (detail.mode === "clear") {
    if (keys.length !== 0) return;
    context.onRequest?.({
      kind: "selection",
      nodeId: node.id,
      portId: selection.id,
      payload: { kind: "selection", selection: { mode: "clear" } },
    });
    return;
  }
  const candidateResult = detail.result;
  if (
    !record(candidateResult) ||
    !sameRef(candidateResult as ResultRef, node.result.ref) ||
    !validKeys(node, keys)
  )
    return;
  context.onRequest?.({
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
  const candidate = record(value);
  if (candidate === undefined || typeof candidate.op !== "string") return false;
  const fields = new Map(node.result.fields.map((field) => [field.id, field]));
  const check = (item: unknown): boolean => {
    const predicate = record(item);
    if (predicate === undefined || typeof predicate.op !== "string")
      return false;
    if (predicate.op === "and" || predicate.op === "or")
      return (
        Array.isArray(predicate.predicates) &&
        predicate.predicates.length > 0 &&
        predicate.predicates.every(check)
      );
    if (predicate.op === "not") return check(predicate.predicate);
    const field =
      typeof predicate.field === "string"
        ? fields.get(predicate.field)
        : undefined;
    if (field === undefined || !node.config.fields.includes(predicate.field as string)) return false;
    if (predicate.entity !== undefined) return false;
    if (predicate.op === "is-null")
      return typeof predicate.negate === "boolean";
    if (predicate.op === "compare") {
      const scalar = scalarValueForField(predicate.value);
      const checked =
        scalar === undefined ? undefined : validateScalar(scalar, field.type);
      return (
        ["eq", "ne", "lt", "lte", "gt", "gte"].includes(
          String(predicate.comparison),
        ) && checked?.ok === true
      );
    }
    if (predicate.op === "in") {
      return (
        Array.isArray(predicate.values) &&
        predicate.values.every((item) => {
          const scalar = scalarValueForField(item);
          return scalar !== undefined && validateScalar(scalar, field.type).ok;
        })
      );
    }
    return false;
  };
  return check(candidate);
}

function dispatchFilter(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (event.type !== "aeliqo-filter-change") return;
  if (!port(node, "filter", "filter")) return;
  const detail =
    typeof CustomEvent !== "undefined" && event instanceof CustomEvent
      ? (record(event.detail) as AeliqoFilterChangeDetail | undefined)
      : undefined;
  if (detail === undefined || detail.applied !== true) return;
  const predicate = detail.predicate;
  if (predicate !== undefined && !validatePredicate(predicate, node)) return;
  const predicates: Extract<
    InteractionPayload,
    { readonly kind: "filter" }
  >["predicates"] =
    predicate === undefined ? [] : [predicate as AeliqoFilterPredicate];
  context.onRequest?.({
    kind: "filter",
    nodeId: node.id,
    portId: "filter",
    payload: { kind: "filter", predicates, outputId: node.result.ref.outputId },
  });
}

function eventDetail<T>(event: Event): T | undefined {
  return typeof CustomEvent !== "undefined" && event instanceof CustomEvent
    ? (event.detail as T)
    : undefined;
}

function dispatchPage(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (event.type !== "aeliqo-table-page") return;
  if (!port(node, "page", "page")) return;
  const request = eventDetail<AeliqoPageRequest>(event);
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
  context.onRequest?.({
    kind: "page",
    nodeId: node.id,
    portId: "page",
    request: { ...request, result: node.result.ref },
  });
}

function dispatchSort(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (event.type !== "aeliqo-table-sort") return;
  const detail = eventDetail<AeliqoTableSortDetail>(event);
  const sort = detail?.sort;
  if (
    sort !== undefined &&
    (typeof sort.field !== "string" ||
      (sort.direction !== "asc" && sort.direction !== "desc") ||
      !node.columns.some((column) => column.key === sort.field))
  )
    return;
  context.onRequest?.({
    kind: "sort",
    nodeId: node.id,
    portId: "sort",
    request: sort,
  });
}

function dispatchWindow(
  node: AeliqoDataResolvedNode,
  event: Event,
  context: AeliqoDataRenderContext,
): void {
  if (event.type !== "aeliqo-table-window") return;
  const request = eventDetail<AeliqoTableWindowDetail>(event);
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
  context.onRequest?.({
    kind: "window",
    nodeId: node.id,
    portId: "window",
    request: { ...request, result: node.result.ref },
  });
}

function dispatchLoadMore(
  node: AeliqoDataResolvedNode,
  context: AeliqoDataRenderContext,
): void {
  context.onRequest?.({
    kind: "load-more",
    nodeId: node.id,
    portId: "load-more",
  });
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
    const population =
      node.result.counts.population.kind === "exact"
        ? node.result.counts.population.value
        : node.scope.filteredTotal;
    const hasMore = population !== undefined && population > node.rows.length;
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
      .hasMore=${hasMore}
      .loadingMore=${false}
      @aeliqo-card-selection=${(event: Event) => dispatchSelection(node, event, context)}
      @aeliqo-data-load-more=${() => dispatchLoadMore(node, context)}
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
