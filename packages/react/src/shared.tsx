import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  filterRecords,
  deriveSnapshot,
  filterInteractionSnapshot,
  validateSnapshot,
  snapshotWarnings,
  type Filter,
  type Dataset,
  type DataSnapshot,
  type WorkspaceInteraction,
  type WorkspaceNode,
  type WorkspaceStore,
} from "@aeliqo/core";
export interface AdaptationEvent {
  id: string;
  mode: string;
  width: number;
  visibleRecords: number;
  totalRecords: number;
  /** Deterministic reason suitable for an inspector or “why this view?” control. */
  reason?: "container_narrow" | "record_density" | "container_wide" | "explicit_preference";
}
export interface SemanticProps {
  store: WorkspaceStore;
  node: WorkspaceNode;
  onAdaptation?: (event: AdaptationEvent) => void;
}
export function safeSnapshot(
  dataset: Dataset | undefined,
  source: DataSnapshot,
): DataSnapshot {
  try {
    if (!dataset) throw new Error("Dataset is unavailable.");
    validateSnapshot(dataset, source);
    return source;
  } catch (error) {
    return {
      status: "error",
      records: [],
      error:
        error instanceof Error ? error.message : "Invalid dataset snapshot.",
    };
  }
}
export function DataWarnings({ data }: { data: DataSnapshot }) {
  return (
    <>
      {snapshotWarnings(data).map((message) => (
        <p className="aeliqo-caveat" role="status" key={message}>
          {message}
        </p>
      ))}
    </>
  );
}
export function useDatasetSnapshot(store: WorkspaceStore, datasetId: string) {
  const subscribe = useCallback(
    (listener: () => void) => store.dataPort.subscribe(datasetId, listener),
    [store, datasetId],
  );
  const snapshot = useCallback(
    () => store.dataPort.getSnapshot(datasetId),
    [store, datasetId],
  );
  const source = useSyncExternalStore(subscribe, snapshot, snapshot);
  const dataset = store.dataPort.getDataset(datasetId);
  return useMemo(() => safeSnapshot(dataset, source), [dataset, source]);
}
export function useData({ store, node }: SemanticProps) {
  const source = useDatasetSnapshot(store, node.datasetId);
  const dataset = store.dataPort.getDataset(node.datasetId);
  const filters = useFilters(store, node);
  const range = useInputInteraction(store, node.id, "range");
  const group = useInputInteraction(store, node.id, "group");
  const data = useMemo(
    () => {
      const filtered = filters.length ? deriveSnapshot(source, filterRecords(source.records, filters, dataset)) : source;
      return dataset ? filterInteractionSnapshot(dataset, filtered, [range, group]) : filtered;
    },
    [source, filters, dataset, range, group],
  );
  const metric =
    dataset?.metrics.find((field) => field.key === node.metric) ??
    dataset?.metrics[0];
  return { data, dataset, metric };
}
const noFilters: readonly Filter[] = [];
function useInputInteraction(store: WorkspaceStore, id: string, kind: WorkspaceInteraction["kind"]) {
  return useSyncExternalStore(
    useCallback(listener => store.subscribeInputInteraction(id, kind, listener), [store, id, kind]),
    useCallback(() => store.getInputInteraction(id, kind), [store, id, kind]),
    () => null,
  );
}
export function useFilters(store: WorkspaceStore, node: WorkspaceNode) {
  return useSyncExternalStore(
    useCallback(
      (listener) => store.subscribeFilters(node.id, listener),
      [store, node.id],
    ),
    useCallback(
      () =>
        store.getNode(node.id) &&
        store.getNode(node.id)?.datasetId === node.datasetId
          ? store.getFilters(node.id)
          : (node.filters ?? noFilters),
      [store, node.id, node.datasetId, node.filters],
    ),
    () => node.filters ?? noFilters,
  );
}
export function useSelection(store: WorkspaceStore, id: string) {
  return useSyncExternalStore(
    useCallback(
      (listener) => store.subscribeSelection(id, listener),
      [store, id],
    ),
    useCallback(() => store.getSelection(id), [store, id]),
    () => null,
  );
}
export function useInteraction(
  store: WorkspaceStore,
  id: string,
  kind: WorkspaceInteraction["kind"],
) {
  return useSyncExternalStore(
    useCallback(
      (listener) => store.subscribeInteraction(id, kind, listener),
      [store, id, kind],
    ),
    useCallback(() => store.getInteraction(id, kind), [store, id, kind]),
    () => null,
  );
}
export function interact(
  store: WorkspaceStore,
  node: WorkspaceNode,
  payload: WorkspaceInteraction,
) {
  store.apply(
    {
      version: 1,
      baseRevision: store.getState().revision,
      operations: [{ type: "interact", id: node.id, payload }],
    },
    { actor: "human" },
  );
}
export function select(store: WorkspaceStore, node: WorkspaceNode, id: string) {
  store.apply(
    {
      version: 1,
      baseRevision: store.getState().revision,
      operations: [{ type: "select", id: node.id, recordId: id }],
    },
    { actor: "human" },
  );
}
export function Card({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="aeliqo-card">
      <header className="aeliqo-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="aeliqo-subtitle">{subtitle}</p>}
        </div>
        {badge && <span className="aeliqo-pill">{badge}</span>}
      </header>
      {children}
    </section>
  );
}
export function DataState({ data }: { data: DataSnapshot }) {
  return (
    <div
      className="aeliqo-state"
      role={data.status === "error" ? "alert" : "status"}
    >
      {data.status === "loading"
        ? "Loading your data…"
        : data.status === "error"
          ? (data.error ?? "This data is temporarily unavailable.")
          : "No records to display."}
    </div>
  );
}
export const ready = (data: DataSnapshot) =>
  data.status === "ready" && data.records.length > 0;
export function FieldValue({
  value,
}: {
  value: string | number | null | undefined;
}) {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return (
        <a href={url.href} target="_blank" rel="noreferrer">
          {url.hostname} ↗
        </a>
      );
    } catch {
      /* Invalid application URL is rendered as plain text. */
    }
  }
  return <>{String(value ?? "—")}</>;
}
