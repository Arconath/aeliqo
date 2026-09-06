import { useState, type ReactNode } from "react";
import {
  type DataSnapshot,
  type Dataset,
  type Filter as SemanticFilter,
} from "@aeliqo/core";
import { Detail } from "./detail";
import { Filter } from "./filter";
import { Ranking } from "./ranking";
import { Table } from "./table";
import {
  safeSnapshot,
  select,
  useData,
  useSelection,
  type SemanticProps,
} from "./shared";
export interface ExplorerProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metric: string;
  columns?: readonly string[];
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filters?: readonly SemanticFilter[];
  onFiltersChange?: (filters: readonly SemanticFilter[]) => void;
  title?: string;
}
export function Explorer(props: ExplorerProps | SemanticProps) {
  return "store" in props ? (
    <SemanticExplorer {...props} />
  ) : (
    <StandaloneExplorer {...props} />
  );
}
function SemanticExplorer(props: SemanticProps) {
  const { data, dataset, metric } = useData(props),
    selectedId = useSelection(props.store, props.node.id);
  return dataset && metric ? (
    <ExplorerView
      dataset={dataset}
      snapshot={data}
      metric={metric.key}
      columns={props.node.columns}
      limit={props.node.limit}
      selectedId={selectedId}
      onSelect={(id) => select(props.store, props.node, id)}
      title={props.node.title}
      filter={<Filter store={props.store} node={props.node} />}
    />
  ) : null;
}
function StandaloneExplorer(props: ExplorerProps) {
  return (
    <ExplorerView
      {...props}
      snapshot={safeSnapshot(props.dataset, props.snapshot)}
      filter={
        props.onFiltersChange ? (
          <Filter
            dataset={props.dataset}
            filters={props.filters ?? []}
            onChange={props.onFiltersChange}
          />
        ) : undefined
      }
    />
  );
}
function ExplorerView({
  dataset,
  snapshot,
  metric,
  columns,
  limit,
  selectedId,
  onSelect,
  title,
  filter,
}: {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metric: string;
  columns?: readonly string[];
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
  filter?: ReactNode;
}) {
  const [view, setView] = useState<"ranking" | "table">("ranking");
  return (
    <div>
      {filter}
      <div
        className="aeliqo-view-switch"
        role="group"
        aria-label="Collection representation"
      >
        <button
          type="button"
          aria-pressed={view === "ranking"}
          onClick={() => setView("ranking")}
        >
          Ranking
        </button>
        <button
          type="button"
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          Table
        </button>
      </div>
      <div className="aeliqo-explorer">
        {view === "ranking" ? (
          <Ranking
            dataset={dataset}
            snapshot={snapshot}
            metric={metric}
            limit={limit}
            selectedId={selectedId}
            onSelect={onSelect}
            title={title ?? "Explore records"}
          />
        ) : (
          <Table
            dataset={dataset}
            snapshot={snapshot}
            columns={columns}
            selectedId={selectedId}
            onSelect={onSelect}
            title={title ?? "Explore records"}
          />
        )}
        <Detail
          dataset={dataset}
          snapshot={snapshot}
          selectedId={selectedId}
          title="Selected record"
        />
      </div>
    </div>
  );
}
