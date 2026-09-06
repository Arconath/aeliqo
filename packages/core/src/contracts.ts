import type { ComponentRegistry } from "./registry";

export type DataRecord = Readonly<Record<string, string | number | null>>;
export interface Field {
  readonly temporal?: "month" | "date" | "instant";
  readonly key: string;
  readonly label: string;
  readonly semanticType?:
    "identifier" | "category" | "boolean" | "url" | "text";
}
export interface MetricField extends Field {
  readonly format?: "number" | "percent" | "currency";
  readonly unit?: string;
  readonly decimals?: number;
  readonly aggregation: "sum" | "mean" | "none" | "ratio-of-sums";
  readonly grain?: string;
  readonly ratio?: {
    readonly numerator: string;
    readonly denominator: string;
    readonly zeroDenominator: "null";
    readonly missing: "exclude-pair";
  };
  readonly goal?: "minimize" | "maximize";
  readonly comparisonGroup?: string;
  readonly methodology?: string;
}
export interface DatasetRelationship {
  readonly id: string;
  readonly label?: string;
  readonly field: string;
  readonly targetDatasetId: string;
  readonly targetField?: string;
  readonly cardinality?: "many-to-one" | "one-to-one";
  readonly optional?: boolean;
}
export interface SnapshotMetadata {
  readonly source: string;
  readonly sourceDate?: string;
  readonly retrievedAt?: string;
  readonly snapshotVersion: string;
}
export interface Filter {
  readonly field: string;
  readonly operator: "eq" | "lt" | "lte" | "gt" | "gte" | "in";
  readonly value: string | number | readonly string[];
}
/** Inclusive epoch-millisecond interval emitted by temporal components. */
export interface TemporalRange {
  readonly start: number;
  readonly end: number;
}
export type WorkspaceInteraction =
  | {
      readonly kind: "range";
      readonly field: string;
      readonly range: TemporalRange | null;
    }
  | {
      readonly kind: "group";
      readonly field: string;
      readonly value: string | number | null;
      /** Distinguishes a selected null category from the legacy null clear. */
      readonly valueType?: "null" | "string" | "number";
    };
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
  readonly scope?:
    "entire-dataset" | "filtered-result" | "loaded-page" | "sample";
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
export type BuiltinComponentType =
  | "Delta"
  | "RecordList"
  | "SelectionSummary"
  | "Overview"
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
  | "Explorer"
  | "MetricBreakdown"
  | "EventTimeline"
  | "TimeInvestigation"
  | "QualityPanel";
export type ComponentType = BuiltinComponentType | (string & {});
export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
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
  readonly mode?: "selection" | "filter" | "range" | "group";
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
  readonly interactions: Readonly<Record<string, WorkspaceInteraction | null>>;
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
      readonly unset?: readonly (keyof Omit<
        WorkspaceNode,
        "id" | "component" | "datasetId"
      >)[];
    }
  | { readonly type: "connect"; readonly binding: Binding }
  | { readonly type: "disconnect"; readonly id: string }
  | {
      readonly type: "select";
      readonly id: string;
      readonly recordId: string | null;
    }
  | {
      readonly type: "interact";
      readonly id: string;
      readonly payload: WorkspaceInteraction;
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
  getInteraction(
    id: string,
    kind: WorkspaceInteraction["kind"],
  ): WorkspaceInteraction | null;
  /** Only an explicit incoming link can turn an interaction into a data filter. */
  getInputInteraction(id: string, kind: WorkspaceInteraction["kind"]): WorkspaceInteraction | null;
  subscribeInputInteraction(id: string, kind: WorkspaceInteraction["kind"], listener: Listener): () => void;
  getFilters(id: string): readonly Filter[];
  subscribeFilters(id: string, listener: Listener): () => void;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: Listener): () => void;
  subscribeNode(id: string, listener: Listener): () => void;
  subscribeOrder(listener: Listener): () => void;
  subscribeSelection(id: string, listener: Listener): () => void;
  subscribeInteraction(
    id: string,
    kind: WorkspaceInteraction["kind"],
    listener: Listener,
  ): () => void;
  subscribeOperations(
    listener: (event: {
      request: WorkspaceRequest;
      result: ApplyResult;
    }) => void,
  ): () => void;
  apply(
    request: WorkspaceRequest,
    options?: { actor?: "human" | "agent" },
  ): ApplyResult;
}
