import { notifyObserver } from "./observers";
import { aggregateRatio, metricValue, validateMetricDeclarations } from "./semantics";
import { createComponentRegistry, deltaConfigSchema, type ComponentRegistry } from "./registry";

export type DataRecord = Readonly<Record<string, string | number | null>>;
export interface Field {
  readonly temporal?: "month" | "date" | "instant";
  readonly key: string;
  readonly label: string;
  readonly semanticType?: "identifier" | "category" | "boolean" | "url" | "text";
}
export interface MetricField extends Field {
  readonly format?: "number" | "percent" | "currency";
  readonly unit?: string;
  readonly decimals?: number;
  readonly aggregation: "sum" | "mean" | "none" | "ratio-of-sums";
  readonly grain?: string;
  readonly ratio?: { readonly numerator: string; readonly denominator: string; readonly zeroDenominator: "null"; readonly missing: "exclude-pair" };
  readonly goal?: "minimize" | "maximize";
  readonly comparisonGroup?: string;
  readonly methodology?: string;
}
export interface DatasetRelationship {
  readonly id: string; readonly label?: string; readonly field: string;
  readonly targetDatasetId: string; readonly targetField?: string;
  readonly cardinality?: "many-to-one" | "one-to-one";
  readonly optional?: boolean;
}
export interface SnapshotMetadata {
  readonly source: string; readonly sourceDate?: string; readonly retrievedAt?: string; readonly snapshotVersion: string;
}
export interface Filter {
  readonly field: string; readonly operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';
  readonly value: string | number | readonly string[];
}
export interface Dataset {
  readonly id: string;
  readonly entity: string;
  readonly label: string;
  readonly description?: string;
  readonly semanticTags?: readonly string[];
  readonly caveat?: string;
  readonly identity: string;
  readonly grain?: string;
  readonly labelField: string;
  readonly dimensions: readonly Field[];
  readonly metrics: readonly MetricField[];
  readonly timeFields: readonly Field[];
  readonly relationships?: readonly DatasetRelationship[];
  readonly metadata?: SnapshotMetadata;
}
export interface DataSnapshot {
  readonly records: readonly DataRecord[];
  readonly status: "ready" | "loading" | "error";
  readonly error?: string;
  readonly metadata?: SnapshotMetadata;
  readonly scope?: "entire-dataset" | "filtered-result" | "loaded-page" | "sample";
  readonly totalCount?: number;
  readonly stale?: boolean;
  readonly revision?: string | number;
}
export type Listener = () => void;
/** The application owns both records and stable snapshots; notify only when a snapshot changes. */
export interface DataPort {
  listDatasets(): readonly Dataset[];
  getDataset(id: string): Dataset | undefined;
  getSnapshot(id: string): DataSnapshot;
  subscribe(id: string, listener: Listener): () => void;
}
export function defineDataset<T extends Dataset>(dataset: T): T {
  if (
    !dataset.id ||
    !dataset.entity ||
    !dataset.identity ||
    !dataset.labelField
  )
    throw new Error("Dataset identity and entity are required");
  const fields = [
    ...dataset.dimensions,
    ...dataset.metrics,
    ...dataset.timeFields,
  ];
  if (new Set(fields.map((field) => field.key)).size !== fields.length)
    throw new Error("Semantic fields must have unique keys");
  if (!fields.some((field) => field.key === dataset.labelField))
    throw new Error("Label field must be declared");
  if (fields.some((field) => !field.key || !field.label))
    throw new Error("Fields require keys and labels");
  if (fields.some(field => field.temporal !== undefined && !["month", "date", "instant"].includes(field.temporal)))
    throw new Error("Unknown temporal policy");
  const relationships = dataset.relationships ?? [];
  if (new Set(relationships.map(relation => relation.id)).size !== relationships.length) throw new Error('Relationship ids must be unique');
  for (const relation of relationships) {
    if (!relation.id || !relation.targetDatasetId || !fields.some(field => field.key === relation.field)) throw new Error('Relationship requires a declared source field and target dataset');
  }
  validateMetricDeclarations(dataset);
  return dataset;
}
export function aggregateMetric(
  records: readonly DataRecord[],
  metric: MetricField,
): number | null {
  if (metric.aggregation === 'ratio-of-sums') return aggregateRatio(records, metric);
  const values = records
    .map((record) => record[metric.key])
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  if (!values.length || (metric.aggregation === "none" && values.length !== 1))
    return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  const result = metric.aggregation === "mean" ? total / values.length : total;
  return Number.isFinite(result) ? result : null;
}
/** Missing and non-finite measures sort last in either direction; equal measures preserve input order. */
export function compareMetricRecords(
  a: DataRecord,
  b: DataRecord,
  metric: string | MetricField,
  direction: "asc" | "desc" = "asc",
): number {
  const left = typeof metric === 'string' ? a[metric] : metricValue(a, metric),
    right = typeof metric === 'string' ? b[metric] : metricValue(b, metric);
  const leftValid = typeof left === "number" && Number.isFinite(left);
  const rightValid = typeof right === "number" && Number.isFinite(right);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return (left - right) * (direction === "desc" ? -1 : 1);
}
export function formatMetric(
  value: number | null | undefined,
  metric: MetricField,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric.format === "percent")
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: metric.decimals ?? 1,
    }).format(value);
  if (metric.format === "currency") {
    assert(metric.unit && /^[A-Z]{3}$/.test(metric.unit) && Intl.supportedValuesOf("currency").includes(metric.unit), "Currency metric requires a supported currency code");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: metric.unit,
      maximumFractionDigits: metric.decimals ?? 4,
    }).format(value);
  }
  return (
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value) +
    (metric.unit ? ` ${metric.unit}` : "")
  );
}
export type BuiltinComponentType =
  | "Filter"
  | "Metric"
  | "Ranking"
  | "Trend"
  | "Table"
  | "Detail"
  | "Scatter"
  | "Distribution"
  | "Relationship"
  | "Matrix"
  | "Comparison"
  | "Explorer";
export type ComponentType = BuiltinComponentType | (string & {});
export type JsonValue = null | boolean | string | number | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export interface Capability {
  readonly component: ComponentType;
  readonly purpose: string;
  readonly accepts: readonly string[];
  readonly interactions: readonly string[];
  readonly minWidth: number;
  readonly accessibility: string;
  readonly adaptation?: string;
  readonly configSchema?: Readonly<Record<string, unknown>>;
}
export const catalog: readonly Capability[] = [
  { component: "Delta", purpose: "Compare a measure with an explicitly labeled baseline", accepts: ["metric", "baseline"], interactions: [], minWidth: 180, accessibility: "Signed change with baseline and zero-baseline explanation" },
  { component: "RecordList", purpose: "Scan entity summaries without ranking or a table grid", accepts: ["entity"], interactions: ["select", "receive-selection"], minWidth: 220, accessibility: "Semantic list with named record selection buttons" },
  { component: "SelectionSummary", purpose: "Disclose selected identities and their loaded scope", accepts: ["entity"], interactions: ["receive-selection"], minWidth: 180, accessibility: "Labeled selected identity list including unavailable entities" },
  { component: "Overview", purpose: "Read declared measures beside a scannable entity collection", accepts: ["entity", "metric"], interactions: ["select", "receive-selection"], minWidth: 280, accessibility: "Composition of labeled Metric and RecordList primitives" },
  {
    component: "Filter", purpose: "Build explicit semantic filters with an editable draft", accepts: ["entity"],
    interactions: ["filter"], minWidth: 260, accessibility: "Labeled native controls; IME-safe explicit submission", adaptation: "Controls wrap while preserving focused input and draft",
  },
  {
    component: "Metric",
    purpose: "Summarize one measure",
    accepts: ["metric"],
    interactions: [],
    minWidth: 180,
    accessibility: "Labeled numeric summary",
  },
  {
    component: "Ranking",
    purpose: "Order entities by a measure",
    accepts: ["entity", "metric"],
    interactions: ["select"],
    minWidth: 260,
    accessibility: "Keyboard-selectable ranked list",
    adaptation:
      "Compact containers retain labels and values and omit bar representation",
  },
  {
    component: "Trend",
    purpose: "Show a measure over time",
    accepts: ["time", "metric"],
    interactions: [],
    minWidth: 260,
    accessibility: "Named chart with textual summary",
    adaptation: "Responsive SVG and reduced tick density",
  },
  {
    component: "Table",
    purpose: "Inspect entity records",
    accepts: ["entity"],
    interactions: ["select"],
    minWidth: 280,
    accessibility: "Semantic table and selection buttons",
  },
  {
    component: "Detail",
    purpose: "Inspect a selected entity",
    accepts: ["entity"],
    interactions: ["receive-selection", "forward-selection"],
    minWidth: 260,
    accessibility: "Definition list with selected entity heading",
  },
  {
    component: "Scatter",
    purpose: "Inspect correlation and trade-offs between two measures",
    accepts: ["entity", "x-metric", "y-metric", "group"],
    interactions: ["select", "receive-selection"],
    minWidth: 320,
    accessibility: "Named scatterplot with keyboard-selectable point list",
    adaptation: "Full annotations become selected and Pareto-outlier annotations in compact containers",
  },
  {
    component: "Distribution",
    purpose: "Inspect the spread, range and outliers of a measure",
    accepts: ["entity", "metric"],
    interactions: [],
    minWidth: 280,
    accessibility: "Named histogram with textual range and outlier summary",
    adaptation: "Bin and label density follow the container width",
  },
  {
    component: "Relationship",
    purpose: "Explore a declared relationship between semantic entities",
    accepts: ["entity", "relationship"],
    interactions: ["select", "receive-selection"],
    minWidth: 320,
    accessibility: "Declared relationship groups with selectable source entities",
    adaptation: "Compact containers collapse relationship metadata while preserving every entity",
  },
  {
    component: "Matrix",
    purpose: "Compare boolean or categorical features across entities",
    accepts: ["entity", "boolean-metrics"],
    interactions: ["select", "receive-selection"],
    minWidth: 340,
    accessibility: "Semantic comparison table with selectable rows",
    adaptation: "Full labels become compact labels while retaining accessible names",
  },
  {
    component: "Comparison",
    purpose: "Compare measures using primitives",
    accepts: ["entity", "metric"],
    interactions: [],
    minWidth: 280,
    accessibility: "Labeled metric summaries and ranking",
  },
  {
    component: "Explorer",
    purpose: "Explore and inspect entities",
    accepts: ["entity", "metric"],
    interactions: ["select", "receive-selection"],
    minWidth: 280,
    accessibility: "Ranking linked to detail through semantic selection",
  },
];
export interface WorkspaceNode {
  readonly pinned?: boolean;
  readonly id: string;
  readonly component: ComponentType;
  readonly datasetId: string;
  readonly title?: string;
  readonly metric?: string;
  readonly xMetric?: string;
  readonly dimension?: string;
  readonly timeField?: string;
  readonly direction?: "asc" | "desc";
  readonly limit?: number;
  readonly filters?: readonly Filter[];
  readonly columns?: readonly string[];
  /** Stable entity identities selected for a bounded multi-record comparison. */
  readonly compareIds?: readonly string[];
  readonly seriesBy?: string;
  readonly relationship?: string;
  readonly span?: number;
  readonly height?: number;
  readonly density?: "comfortable" | "compact";
  readonly config?: Readonly<Record<string, JsonValue>>;
}
export interface Binding {
  readonly mode?: "selection" | "filter";
  readonly id: string;
  readonly source: string;
  readonly relationship?: string;
  readonly target: string;
  readonly entity: string;
}
export interface WorkspaceState {
  readonly revision: number;
  readonly nodes: Readonly<Record<string, WorkspaceNode>>;
  readonly order: readonly string[];
  readonly bindings: Readonly<Record<string, Binding>>;
  readonly selections: Readonly<Record<string, string | null>>;
}
export type Operation =
  | { readonly type: "pin"; readonly id: string; readonly pinned: boolean }
  | { readonly type: "undo" | "redo" }
  | { readonly type: "move"; readonly id: string; readonly index: number }
  | { readonly type: "mount"; readonly node: WorkspaceNode }
  | { readonly type: "remove"; readonly id: string }
  | {
      readonly type: "configure";
      readonly id: string;
      readonly patch: Partial<Omit<WorkspaceNode, "id">>;
      readonly unset?: readonly (keyof Omit<WorkspaceNode, "id" | "component" | "datasetId">)[];
    }
  | { readonly type: "connect"; readonly binding: Binding }
  | { readonly type: "disconnect"; readonly id: string }
  | {
      readonly type: "select";
      readonly id: string;
      readonly recordId: string | null;
    };
export interface WorkspaceRequest {
  readonly version: 1;
  readonly baseRevision: number;
  readonly operations: readonly Operation[];
}
export type ApplyResult =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly revision: number; readonly error: string };
export interface WorkspaceStore {
  readonly dataPort: DataPort;
  readonly registry: ComponentRegistry;
  getState(): WorkspaceState;
  getNode(id: string): WorkspaceNode | undefined;
  getSelection(id: string): string | null;
  getFilters(id: string): readonly Filter[];
  subscribeFilters(id: string, listener: Listener): () => void;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: Listener): () => void;
  subscribeNode(id: string, listener: Listener): () => void;
  subscribeOrder(listener: Listener): () => void;
  subscribeSelection(id: string, listener: Listener): () => void;
  subscribeOperations(listener: (event: { request: WorkspaceRequest; result: ApplyResult }) => void): () => void;
  apply(request: WorkspaceRequest, options?: { actor?: "human" | "agent" }): ApplyResult;
}
const safeId = (id: string): boolean =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id) &&
  !["__proto__", "constructor", "prototype"].includes(id);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function freezeNode(node: WorkspaceNode): WorkspaceNode {
  return Object.freeze({ ...node, ...(node.config ? { config: freezeConfig(node.config) as Readonly<Record<string, JsonValue>> } : {}), ...(node.columns ? { columns: Object.freeze([...node.columns]) } : {}), ...(node.compareIds ? { compareIds: Object.freeze([...node.compareIds]) } : {}), ...(node.filters ? { filters: Object.freeze(node.filters.map(filter => Object.freeze({ ...filter, value: Array.isArray(filter.value) ? Object.freeze([...filter.value]) : filter.value }))) } : {}) });
}
function freezeConfig(value: JsonValue, depth = 0): JsonValue {
  assert(depth <= 4, "Configuration nesting exceeds limit");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") { assert(value.length <= 2000, "Configuration string too long"); return value; }
  if (typeof value === "number") { assert(Number.isFinite(value), "Configuration number must be finite"); return value; }
  if (Array.isArray(value)) { assert(value.length <= 30, "Configuration array too large"); return Object.freeze(value.map(item => freezeConfig(item, depth + 1))); }
  assert(typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), "Configuration must be plain JSON");
  const entries = Object.entries(value);
  assert(entries.length <= 30 && entries.every(([key]) => safeId(key)), "Invalid configuration keys");
  return Object.freeze(Object.fromEntries(entries.map(([key, child]) => [key, freezeConfig(child, depth + 1)])));
}
function validateNode(node: WorkspaceNode, dataPort: DataPort, registry: ComponentRegistry): void {
  assert(safeId(node.id), "Invalid node id");
  assert(
    registry.get(node.component),
    "Unknown component",
  );
  const dataset = dataPort.getDataset(node.datasetId);
  assert(dataset, `Unknown dataset: ${node.datasetId}`);
  if (node.config) freezeConfig(node.config);
  if (node.pinned !== undefined) assert(typeof node.pinned === "boolean", "Pinned must be a boolean");
  registry.validate(node, dataPort);
  validateFilters(dataset, node.filters);
  if (node.columns) {
    const fields = [...dataset.dimensions, ...dataset.metrics, ...dataset.timeFields];
    assert(node.columns.length > 0 && node.columns.length <= 20 && new Set(node.columns).size === node.columns.length, "Expected 1–20 unique columns");
    assert(node.columns.every(key => fields.some(field => field.key === key)), "Unknown column");
  }
  if (node.compareIds) {
    assert(node.component === "Comparison", "compareIds are only valid for Comparison");
    assert(node.compareIds.length >= 2 && node.compareIds.length <= 8 && new Set(node.compareIds).size === node.compareIds.length, "Comparison requires 2–8 unique entity identities");
    const available = new Set(dataPort.getSnapshot(node.datasetId).records.map(record => String(record[dataset.identity])));
    assert(node.compareIds.every(id => available.has(id)), "Unknown comparison identity");
  }
  if (node.component === "Comparison" && node.columns) {
    assert(node.columns.every(key => dataset.metrics.some(metric => metric.key === key)), "Comparison columns must be metrics");
  }
  if (node.seriesBy) assert(dataset.dimensions.some(field => field.key === node.seriesBy), "Unknown series dimension");
  if (node.span !== undefined) assert(Number.isInteger(node.span) && node.span >= 1 && node.span <= 12, "Span must be 1–12");
  if (node.height !== undefined) assert(Number.isInteger(node.height) && node.height >= 240 && node.height <= 900, "Height must be 240–900");
  if (node.density !== undefined) assert(["compact", "comfortable"].includes(node.density), "Unknown density");
  const needsMetric = [
    "Delta",
    "Metric",
    "Ranking",
    "Trend",
    "Scatter",
    "Distribution",
    "Comparison",
    "Explorer",
  ].includes(node.component) || (node.component === "Overview" && !node.columns);
  if (node.component === "Overview" && node.columns) assert(node.columns.length <= 6 && node.columns.every(key => dataset.metrics.some(metric => metric.key === key)), "Overview requires at most six metric columns");
  if (node.component === "RecordList" && node.columns) assert(node.columns.length <= 8, "RecordList supports at most eight fields");
  if (needsMetric) assert(node.metric, `${node.component} requires a metric`);
  if (node.metric)
    assert(
      dataset.metrics.some((field) => field.key === node.metric),
      "Unknown metric",
    );
  if (node.xMetric)
    assert(
      dataset.metrics.some((field) => field.key === node.xMetric),
      "Unknown x metric",
    );
  if (node.component === "Scatter") {
    assert(node.xMetric, "Scatter requires an x metric");
    assert(node.xMetric !== node.metric, "Scatter metrics must be distinct");
  }
  if (node.dimension)
    assert(
      dataset.dimensions.some((field) => field.key === node.dimension),
      "Unknown dimension",
    );
  if (node.component === "Trend")
    assert(node.timeField, "Trend requires a time field");
  if (node.component === "Relationship") {
    assert(node.relationship, "Relationship requires a declared relationship");
    assert(
      dataset.relationships?.some((item) => item.id === node.relationship),
      "Unknown relationship",
    );
  }
  if (node.component === "Matrix") {
    assert(node.columns && node.columns.length > 0, "Matrix requires feature columns");
    assert(
      node.columns.every((key) => dataset.metrics.some((field) => field.key === key)),
      "Matrix columns must be metrics",
    );
  }
  if (node.timeField)
    assert(
      dataset.timeFields.some((field) => field.key === node.timeField),
      "Unknown time field",
    );
  if (node.limit !== undefined)
    assert(
      Number.isInteger(node.limit) && node.limit > 0 && node.limit <= 10000,
      "Limit must be an integer between 1 and 10000",
    );
  if (node.direction !== undefined)
    assert(
      node.direction === "asc" || node.direction === "desc",
      "Invalid sort direction",
    );
}
export function createWorkspace(options: {
  dataPort: DataPort;
  registry?: ComponentRegistry;
  nodes?: readonly WorkspaceNode[];
  bindings?: readonly Binding[];
  selections?: Readonly<Record<string, string | null>>;
}): WorkspaceStore {
  const { dataPort } = options;
  const registry = options.registry ?? createComponentRegistry(catalog.map(capability => ({ capability, ...(capability.component === "Delta" ? { configSchema: deltaConfigSchema } : {}) })));
  let state: WorkspaceState = {
    revision: 0,
    nodes: {},
    order: [],
    bindings: {},
    selections: {},
  };
  const operationListeners = new Set<(event: { request: WorkspaceRequest; result: ApplyResult }) => void>();
  const past: WorkspaceState[] = [], future: WorkspaceState[] = [];
  const emptyFilters: readonly Filter[] = Object.freeze([]);
  const filterCache = new Map<string, readonly Filter[]>();
  const filtersFor = (snapshot: WorkspaceState, id: string): readonly Filter[] => {
    const result: Filter[] = [], pending = [id], visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(...(snapshot.nodes[current]?.filters ?? emptyFilters));
      for (const binding of Object.values(snapshot.bindings)) if (binding.mode === "filter" && binding.target === current) pending.push(binding.source);
    }
    return result.length ? result : emptyFilters;
  };
  const getFilters = (id: string): readonly Filter[] => {
    const next = filtersFor(state, id), cached = filterCache.get(id);
    if (cached && cached.length === next.length && cached.every((filter, index) => filter === next[index])) return cached;
    if (!state.nodes[id]) { filterCache.delete(id); return emptyFilters; }
    const value = Object.freeze([...next]); filterCache.set(id, value); return value;
  };
  const listeners = new Map<string, Set<Listener>>();
  const subscribe = (key: string, listener: Listener): (() => void) => {
    let group = listeners.get(key);
    if (!group) {
      group = new Set();
      listeners.set(key, group);
    }
    group.add(listener);
    return () => {
      group.delete(listener);
      if (!group.size) listeners.delete(key);
    };
  };
  const apply = (request: WorkspaceRequest, control: { actor?: "human" | "agent" } = {}): ApplyResult => {
    if (request.version !== 1)
      return {
        ok: false,
        revision: state.revision,
        error: "Unsupported operation version",
      };
    if (request.baseRevision !== state.revision)
      return {
        ok: false,
        revision: state.revision,
        error: "Revision conflict; inspect and retry",
      };
    const previous = state;
    let nodes = state.nodes,
      order = state.order,
      bindings = state.bindings,
      selections = state.selections;
    try {
      assert(
        request.operations.length > 0 && request.operations.length <= 100,
        "Expected 1–100 operations",
      );
      for (const operation of request.operations) {
        if (control.actor === "agent") {
          assert(!["pin", "undo", "redo"].includes(operation.type), "Human-only workspace control");
          if (operation.type === "mount") assert(!operation.node.pinned, "Only humans can pin content");
          if (operation.type === "configure") assert(operation.patch.pinned === undefined, "Only humans can change pins");
          if (["move", "remove", "configure"].includes(operation.type) && "id" in operation)
            assert(!nodes[operation.id]?.pinned, "Pinned content requires a human to unpin it");
          if (operation.type === "remove" || operation.type === "configure" || operation.type === "connect" || operation.type === "disconnect") {
            const affected = operation.type === "connect" ? operation.binding.target : operation.type === "disconnect" ? bindings[operation.id]?.target : operation.id;
            const pending = affected ? [affected] : [], visited = new Set<string>();
            while (pending.length) {
              const current = pending.pop()!;
              if (visited.has(current)) continue;
              visited.add(current);
              for (const binding of Object.values(bindings)) if (binding.source === current) {
                assert(!nodes[binding.target]?.pinned, "Pinned content depends on this source");
                pending.push(binding.target);
              }
            }
          }
          if (operation.type === "connect") assert(!nodes[operation.binding.target]?.pinned, "Pinned content cannot be rebound by an agent");
          if (operation.type === "disconnect") assert(!nodes[bindings[operation.id]?.target ?? ""]?.pinned, "Pinned content cannot be disconnected by an agent");
        }
        switch (operation.type) {
          case "undo":
          case "redo": {
            assert(request.operations.length === 1, "History operations must run alone");
            const history = operation.type === "undo" ? past : future;
            const restored = history.at(-1);
            assert(restored, "No workspace history available");
            nodes = restored.nodes; order = restored.order; bindings = restored.bindings; selections = restored.selections;
            break;
          }
          case "pin": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            assert(typeof operation.pinned === "boolean", "Pinned must be a boolean");
            nodes = { ...nodes, [operation.id]: freezeNode({ ...nodes[operation.id]!, pinned: operation.pinned }) };
            break;
          }
          case "move": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            assert(Number.isInteger(operation.index) && operation.index >= 0 && operation.index < order.length, "Invalid move index");
            const reordered = order.filter(id => id !== operation.id);
            reordered.splice(operation.index, 0, operation.id);
            order = reordered;
            break;
          }
          case "mount": {
            validateNode(operation.node, dataPort, registry);
            assert(
              !Object.hasOwn(nodes, operation.node.id),
              "Node already exists",
            );
            nodes = {
              ...nodes,
              [operation.node.id]: freezeNode(operation.node),
            };
            order = [...order, operation.node.id];
            break;
          }
          case "remove": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            nodes = Object.fromEntries(
              Object.entries(nodes).filter(([id]) => id !== operation.id),
            );
            order = order.filter((id) => id !== operation.id);
            bindings = Object.fromEntries(
              Object.entries(bindings).filter(
                ([, binding]) =>
                  binding.source !== operation.id &&
                  binding.target !== operation.id,
              ),
            );
            selections = Object.fromEntries(
              Object.entries(selections).filter(([id]) => id !== operation.id),
            );
            break;
          }
          case "configure": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            const node = {
              ...nodes[operation.id],
              ...operation.patch,
              id: operation.id,
            } as WorkspaceNode;
            for (const field of operation.unset ?? []) {
              assert(["title", "metric", "xMetric", "dimension", "timeField", "direction", "limit", "filters", "columns", "compareIds", "seriesBy", "relationship", "span", "height", "density", "config"].includes(field), "Cannot unset required or unknown field");
              delete (node as unknown as Record<string, unknown>)[field];
            }
            validateNode(node, dataPort, registry);
            const previousNode = nodes[operation.id];
            const canSelect = registry.get(node.component)
              ?.interactions.includes("select");
            const dataset = dataPort.getDataset(node.datasetId)!;
            const selected = selections[operation.id];
            const filteredOut = selected != null && node.filters?.length && !filterRecords(dataPort.getSnapshot(node.datasetId).records, node.filters, dataset).some(record => String(record[dataset.identity]) === selected);
            if (
              (previousNode?.datasetId !== node.datasetId || !canSelect || filteredOut) &&
              selections[operation.id] != null
            ) {
              selections = { ...selections, [operation.id]: null };
            }
            nodes = { ...nodes, [operation.id]: freezeNode(node) };
            break;
          }
          case "connect": {
            assert(safeId(operation.binding.id), "Invalid binding id");
            assert(
              !Object.hasOwn(bindings, operation.binding.id),
              "Binding already exists",
            );
            assert(
              !Object.values(bindings).some(
                (binding) => binding.target === operation.binding.target && binding.mode !== "filter" && operation.binding.mode !== "filter",
              ),
              "Target already has a selection binding",
            );
            bindings = {
              ...bindings,
              [operation.binding.id]: Object.freeze({ ...operation.binding }),
            };
            break;
          }
          case "disconnect": {
            assert(Object.hasOwn(bindings, operation.id), "Unknown binding");
            bindings = Object.fromEntries(
              Object.entries(bindings).filter(([id]) => id !== operation.id),
            );
            break;
          }
          case "select": {
            const node = nodes[operation.id];
            assert(
              node && Object.hasOwn(nodes, operation.id),
              "Unknown selection source",
            );
            assert(
              registry.get(node.component)
                ?.interactions.includes("select"),
              "Component cannot produce selection",
            );
            const dataset = dataPort.getDataset(node.datasetId);
            assert(dataset, "Unknown dataset");
            if (operation.recordId !== null)
              assert(
                dataPort
                  .getSnapshot(node.datasetId)
                  .records.some(
                    (record) =>
                      String(record[dataset.identity]) === operation.recordId,
                  ),
                "Unknown record identity",
              );
            if (selections[operation.id] !== operation.recordId)
              selections = {
                ...selections,
                [operation.id]: operation.recordId,
              };
            break;
          }
          default:
            throw new Error("Unknown operation");
        }
      }
      assert(Object.keys(nodes).length <= 100 && Object.keys(bindings).length <= 100, "Workspace supports at most 100 nodes and bindings");
      for (const binding of Object.values(bindings)) {
        const source = nodes[binding.source],
          target = nodes[binding.target];
        assert(
          source && target && source.id !== target.id,
          "Binding requires distinct existing nodes",
        );
        assert(binding.mode === undefined || binding.mode === "selection" || binding.mode === "filter", "Unknown binding mode");
        if (binding.mode === "filter") {
          assert(registry.get(source.component)?.interactions.includes("filter"), "Binding source cannot filter");
          assert(source.datasetId === target.datasetId && !binding.relationship, "Filter bindings require the same dataset");
          assert(dataPort.getDataset(source.datasetId)?.entity === binding.entity, "Filter entity mismatch");
        } else {
        assert(
          registry.get(source.component)
            ?.interactions.some(interaction => interaction === "select" || interaction === "forward-selection"),
          "Binding source cannot select or forward selection",
        );
        assert(
          registry.get(target.component)
            ?.interactions.includes("receive-selection"),
          "Binding target cannot receive selection",
        );
        const sourceDataset = dataPort.getDataset(source.datasetId);
        const targetDataset = dataPort.getDataset(target.datasetId);
        assert(sourceDataset && targetDataset, 'Unknown binding dataset');
        if (binding.relationship) {
          const relation = sourceDataset.relationships?.find(item => item.id === binding.relationship);
          assert(relation && relation.targetDatasetId === target.datasetId, 'Unknown or incompatible relationship');
          assert(targetDataset.entity === binding.entity, 'Binding target entity mismatch');
          const targetField = relation.targetField ?? targetDataset.identity;
          assert(targetField === targetDataset.identity || [...targetDataset.dimensions, ...targetDataset.metrics, ...targetDataset.timeFields].some(field => field.key === targetField), 'Unknown relationship target field');
        } else {
          assert(source.datasetId === target.datasetId, "Cross-dataset binding requires an explicit relationship");
          assert(sourceDataset.entity === binding.entity && targetDataset.entity === binding.entity, 'Binding entity mismatch');
        }
        }
        const visit = (id: string, path: ReadonlySet<string>) => {
          assert(!path.has(id), "Selection bindings cannot contain cycles");
          const next = new Set([...path, id]);
          for (const incoming of Object.values(bindings).filter(candidate => candidate.target === id)) visit(incoming.source, next);
        };
        visit(binding.source, new Set([binding.target]));
      }
      for (const [id, selected] of Object.entries(selections)) {
        const node = nodes[id];
        if (!node || selected == null) continue;
        const dataset = dataPort.getDataset(node.datasetId)!;
        const effective = filtersFor({ ...state, nodes, bindings }, id);
        if (effective.length && !filterRecords(dataPort.getSnapshot(node.datasetId).records, effective, dataset).some(record => String(record[dataset.identity]) === selected))
          selections = { ...selections, [id]: null };
      }
    } catch (error) {
      return {
        ok: false,
        revision: state.revision,
        error: error instanceof Error ? error.message : "Invalid operation",
      };
    }
    const historyOperation = request.operations[0]?.type;
    if (historyOperation === "undo") { past.pop(); future.push(previous); }
    else if (historyOperation === "redo") { future.pop(); past.push(previous); }
    else { past.push(previous); if (past.length > 50) past.shift(); future.length = 0; }
    state = Object.freeze({
      revision: state.revision + 1,
      nodes: Object.freeze(nodes),
      order: Object.freeze(order),
      bindings: Object.freeze(bindings),
      selections: Object.freeze(selections),
    });
    for (const id of filterCache.keys()) if (!state.nodes[id]) filterCache.delete(id);
    const changed = new Set<Listener>();
    for (const [key, group] of listeners) {
      const id = key.slice(key.indexOf(":") + 1);
      if (
        key === "all" ||
        (key === "order" && previous.order !== state.order) ||
        (key.startsWith("node:") && previous.nodes[id] !== state.nodes[id])
      ) {
        for (const listener of group) changed.add(listener);
      }
    }
    const result = { ok: true as const, revision: state.revision };
    for (const listener of changed) notifyObserver(listener);
    return result;
  };
  const selection = (snapshot: WorkspaceState, id: string): string | null => {
    const incoming = Object.values(snapshot.bindings).find(
      (binding) => binding.target === id && binding.mode !== "filter",
    );
    if (!incoming) return snapshot.selections[id] ?? null;
    const selected = selection(snapshot, incoming.source);
    if (!incoming.relationship || selected === null) return selected;
    const source = snapshot.nodes[incoming.source], target = snapshot.nodes[id];
    const sourceDataset = source && dataPort.getDataset(source.datasetId);
    const targetDataset = target && dataPort.getDataset(target.datasetId);
    const relation = sourceDataset?.relationships?.find(item => item.id === incoming.relationship);
    if (!source || !target || !sourceDataset || !targetDataset || !relation) return null;
    const sourceMatches = dataPort.getSnapshot(source.datasetId).records.filter(record => String(record[sourceDataset.identity]) === selected);
    if (sourceMatches.length !== 1) return null;
    const sourceRecord = sourceMatches[0];
    const foreignKey = sourceRecord?.[relation.field];
    if (foreignKey == null) return null;
    const targetMatches = dataPort.getSnapshot(target.datasetId).records.filter(record => record[relation.targetField ?? targetDataset.identity] === foreignKey);
    const targetRecord = targetMatches.length === 1 ? targetMatches[0] : undefined;
    return targetRecord ? String(targetRecord[targetDataset.identity]) : null;
  };
  const subscribeSelection = (id: string, listener: Listener): (() => void) => {
    let selected = selection(state, id);
    let active = true;
    const dataSubscriptions = new Map<string, () => void>();
    const check = () => {
      if (!active) return;
      const next = selection(state, id);
      if (next !== selected) {
        selected = next;
        notifyObserver(listener);
      }
    };
    const reconcile = () => {
      if (!active) return;
      const datasets = new Set<string>();
      let cursor: string | undefined = id;
      while (cursor) {
        const node = state.nodes[cursor];
        if (node) datasets.add(node.datasetId);
        cursor = Object.values(state.bindings).find(binding => binding.target === cursor && binding.mode !== "filter")?.source;
      }
      for (const [datasetId, stop] of dataSubscriptions) {
        if (!datasets.has(datasetId)) { stop(); dataSubscriptions.delete(datasetId); }
      }
      for (const datasetId of datasets) {
        if (!dataSubscriptions.has(datasetId)) dataSubscriptions.set(datasetId, dataPort.subscribe(datasetId, check));
      }
      check();
    };
    // Observe the linked datasets only while a consumer is subscribed. Store
    // changes can rewire this chain; application snapshots never enter state.
    const stopStore = subscribe("all", reconcile);
    reconcile();
    return () => {
      active = false;
      stopStore();
      for (const stop of dataSubscriptions.values()) stop();
      dataSubscriptions.clear();
    };
  };
  if (options.nodes?.length || options.bindings?.length || Object.keys(options.selections ?? {}).length) {
    const initial: Operation[] = [
        ...(options.nodes ?? []).map((node) => ({
          type: "mount" as const,
          node,
        })),
        ...(options.bindings ?? []).map((binding) => ({
          type: "connect" as const,
          binding,
        })),
        ...Object.entries(options.selections ?? {}).map(([id, recordId]) => ({ type: "select" as const, id, recordId })),
      ];
    for (let offset = 0; offset < initial.length; offset += 100) {
      const result = apply({ version: 1, baseRevision: state.revision, operations: initial.slice(offset, offset + 100) });
      if (!result.ok) throw new Error(result.error);
    }
    state = Object.freeze({ ...state, revision: 0 });
    past.length = 0; future.length = 0;
  }
  return {
    dataPort,
    registry,
    getState: () => state,
    getNode: (id) => state.nodes[id],
    getSelection: (id) => selection(state, id),
    getFilters,
    subscribeFilters: (id, listener) => {
      let current = getFilters(id);
      return subscribe("all", () => { const next = getFilters(id); if (next !== current) { current = next; notifyObserver(listener); } });
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe: (listener) => subscribe("all", listener),
    subscribeNode: (id, listener) => subscribe(`node:${id}`, listener),
    subscribeOrder: (listener) => subscribe("order", listener),
    subscribeSelection,
    subscribeOperations: listener => { operationListeners.add(listener); return () => { operationListeners.delete(listener); }; },
    apply: (request, control) => { const result = apply(request, control); for (const listener of [...operationListeners]) notifyObserver(() => listener({request,result})); return result; },
  };
}

export function validateFilters(dataset: Dataset, filters: readonly Filter[] = []): void {
  assert(filters.length <= 10, 'At most ten filters are supported');
  const fields = new Set([dataset.identity, ...dataset.dimensions.map(field => field.key), ...dataset.metrics.map(field => field.key), ...dataset.timeFields.map(field => field.key)]);
  for (const filter of filters) {
    assert(fields.has(filter.field), `Unknown filter field: ${filter.field}`);
    assert(['eq', 'lt', 'lte', 'gt', 'gte', 'in'].includes(filter.operator), 'Unknown filter operator');
    if (filter.operator === 'in') assert(Array.isArray(filter.value) && filter.value.every(value => typeof value === 'string'), 'in requires a string list');
    else if (filter.operator === 'eq') assert(typeof filter.value === 'string' || (typeof filter.value === 'number' && Number.isFinite(filter.value)), 'eq requires a finite scalar');
    else assert(typeof filter.value === 'number' && Number.isFinite(filter.value) && dataset.metrics.some(metric => metric.key === filter.field), 'Numeric comparisons require a metric and finite number');
  }
}
export function filterRecords(records: readonly DataRecord[], filters: readonly Filter[] = [], dataset?: Dataset): readonly DataRecord[] {
  if (!filters.length) return records;
  return records.filter(record => filters.every(filter => {
    const metric = dataset?.metrics.find(field => field.key === filter.field);
    const actual = metric ? metricValue(record, metric) : record[filter.field];
    if (filter.operator === 'eq') return actual === filter.value;
    if (filter.operator === 'in') return typeof actual === 'string' && Array.isArray(filter.value) && filter.value.includes(actual);
    if (typeof actual !== 'number' || !Number.isFinite(actual) || typeof filter.value !== 'number') return false;
    switch (filter.operator) {
      case 'lt': return actual < filter.value;
      case 'lte': return actual <= filter.value;
      case 'gt': return actual > filter.value;
      case 'gte': return actual >= filter.value;
    }
  }));
}
