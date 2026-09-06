import { resolveDensity, type DensityMode } from "./adaptation";
import { useEffect, useMemo, useRef, useState } from "react";
import { metricValue, type DataSnapshot, type Dataset } from "@aeliqo/core";
import {
  Card,
  DataState,
  DataWarnings,
  ready,
  safeSnapshot,
  select,
  useData,
  useSelection,
  type AdaptationEvent,
  type SemanticProps,
} from "./shared";
export interface MatrixProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  columns: readonly string[];
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
  density?: "compact" | "comfortable";
  onAdaptation?: (event: AdaptationEvent) => void;
}
export function Matrix(props: MatrixProps | SemanticProps) {
  return "store" in props ? (
    <SemanticMatrix {...props} />
  ) : (
    <StandaloneMatrix {...props} />
  );
}
function SemanticMatrix(props: SemanticProps) {
  const { data, dataset } = useData(props),
    selectedId = useSelection(props.store, props.node.id);
  return (
    <MatrixView
      data={data}
      dataset={dataset}
      columns={props.node.columns ?? []}
      limit={props.node.limit}
      selectedId={selectedId}
      onSelect={(id) => select(props.store, props.node, id)}
      title={props.node.title}
      density={props.node.density}
      adaptationId={props.node.id}
      onAdaptation={props.onAdaptation}
    />
  );
}
function StandaloneMatrix(props: MatrixProps) {
  return (
    <MatrixView
      data={safeSnapshot(props.dataset, props.snapshot)}
      dataset={props.dataset}
      columns={props.columns}
      limit={props.limit}
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      title={props.title}
      density={props.density}
      onAdaptation={props.onAdaptation}
      adaptationId="standalone-matrix"
    />
  );
}
function MatrixView({
  data,
  dataset,
  columns,
  limit,
  selectedId,
  onSelect,
  title,
  adaptationId,
  onAdaptation,
  density,
}: {
  data: DataSnapshot;
  dataset?: Dataset;
  columns: readonly string[];
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
  density?: "compact" | "comfortable";
  adaptationId: string;
  onAdaptation?: (event: AdaptationEvent) => void;
}) {
  const previousMode = useRef<DensityMode | null>(null);
  const ref = useRef<HTMLDivElement>(null),
    [mode, setMode] = useState<"full-labels" | "compact-labels">("full-labels");
  const metrics = useMemo(
    () =>
      columns.flatMap((key) => {
        const metric = dataset?.metrics.find((field) => field.key === key);
        return metric ? [metric] : [];
      }),
    [columns, dataset],
  );
  const records = data.records.slice(0, limit ?? data.records.length);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const resolved = resolveDensity(width, previousMode.current, 650, density);
      previousMode.current = resolved;
      const next = resolved === "compact" ? "compact-labels" : "full-labels";
      setMode(next);
      onAdaptation?.({
        id: adaptationId,
        mode: next,
        width,
        visibleRecords: records.length,
        totalRecords: data.records.length,
        reason: density ? "explicit_preference" : resolved === "compact" ? "container_narrow" : "container_wide",
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [density, adaptationId, records.length, data.records.length, onAdaptation]);
  return (
    <div ref={ref} data-adaptation={mode}>
      <Card
        title={title ?? "Capability matrix"}
        subtitle={`${dataset?.label ?? "Dataset"} · ${metrics.length} semantic features`}
        badge="Matrix"
      >
        {!ready(data) || !dataset || metrics.length !== columns.length ? (
          <DataState
            data={
              data.status === "ready"
                ? {
                    status: "error",
                    records: [],
                    error: "Choose declared metric columns for this matrix.",
                  }
                : data
            }
          />
        ) : (
          <div className="aeliqo-matrix-scroll">
            <table className="aeliqo-matrix">
              <thead>
                <tr>
                  <th scope="col">{dataset.entity}</th>
                  {metrics.map((metric) => (
                    <th key={metric.key} scope="col" title={metric.label}>
                      {mode === "compact-labels" ? (
                        <>
                          <span aria-hidden="true">
                            {metric.label
                              .split(/\s+/)
                              .map((word) => word[0])
                              .join("")}
                          </span>
                          <span className="aeliqo-sr-only">{metric.label}</span>
                        </>
                      ) : (
                        metric.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const id = String(record[dataset.identity]);
                  return (
                    <tr key={id} data-selected={selectedId === id}>
                      <th scope="row">
                        <button
                          type="button"
                          aria-pressed={selectedId === id}
                          onClick={() => onSelect?.(id)}
                        >
                          {String(record[dataset.labelField])}
                        </button>
                      </th>
                      {metrics.map((metric) => {
                        const value = metricValue(record, metric),
                          enabled = value === null ? null : value > 0;
                        return (
                          <td
                            key={metric.key}
                            aria-label={`${metric.label}: ${enabled === null ? "not available" : enabled ? "supported" : "not supported"}`}
                            data-enabled={enabled ?? undefined}
                          >
                            {enabled === null ? "?" : enabled ? "●" : "–"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}
