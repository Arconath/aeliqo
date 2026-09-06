import { useEffect, useMemo, useRef, useState } from "react";
import { compareMetricRecords, metricValue, formatMetric, type Dataset, type DataSnapshot, type WorkspaceNode, type MetricField, type DataRecord } from "@aeliqo/core";
import { Card, DataState, safeSnapshot, DataWarnings, ready, useData, useSelection, select, type AdaptationEvent, type SemanticProps } from "./shared";
const emptyRecords: readonly DataRecord[] = [];
export interface RankingProps {
  dataset: Dataset; snapshot: DataSnapshot; metric: string;
  direction?: "asc" | "desc"; limit?: number; dimension?: string; title?: string;
  selectedId?: string | null; onSelect?: (id: string) => void;
  onAdaptation?: (event: AdaptationEvent) => void;
}
export function Ranking(props: RankingProps | (SemanticProps & { interactive?: boolean })) {
  return "store" in props ? <SemanticRanking {...props} /> : <StandaloneRanking {...props} />;
}
function SemanticRanking(props: SemanticProps & { interactive?: boolean }) {
  const { data, dataset, metric } = useData(props);
  const selected = useSelection(props.store, props.node.id);
  return <RankingView data={data} dataset={dataset} metric={metric} node={props.node} selected={selected} onSelect={props.interactive === false ? undefined : id => select(props.store, props.node, id)} onAdaptation={props.onAdaptation} />;
}
function StandaloneRanking(props: RankingProps) {
  const data = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <RankingView data={data} dataset={props.dataset} metric={props.dataset.metrics.find(field => field.key === props.metric)} node={{ id: "standalone-ranking", ...props }} selected={props.selectedId ?? null} onSelect={props.onSelect} onAdaptation={props.onAdaptation} />;
}
function RankingView({ data, dataset, metric, node, selected, onSelect, onAdaptation }: { data: DataSnapshot; dataset?: Dataset; metric?: MetricField; node: Partial<WorkspaceNode> & { id: string }; selected: string | null; onSelect?: (id: string) => void; onAdaptation?: (event: AdaptationEvent) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"compact" | "full">("full");
  const records = useMemo(
    () =>
      metric
        ? [...data.records]
            .sort((a, b) =>
              compareMetricRecords(a, b, metric, node.direction),
            )
            .slice(0, node.limit ?? 8)
        : emptyRecords,
    [data.records, metric, node.direction, node.limit],
  );
  const domain = useMemo(
    () => {
      const values = records.map(record => metric ? metricValue(record, metric) ?? 0 : 0);
      const min = Math.min(0, ...values), max = Math.max(0, ...values);
      return { min, max, range: max - min || 1, zero: -min / (max - min || 1) * 100 };
    },
    [records, metric],
  );
  useEffect(() => {
    const element = container.current?.firstElementChild;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (!width) return;
      const mode = width <= 390 ? "compact" : "full";
      setMode(mode);
      onAdaptation?.({
        id: node.id,
        mode,
        width,
        visibleRecords: records.length,
        totalRecords: data.records.length,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [node.id, onAdaptation, records.length, data.records.length]);
  return (
    <div ref={container} data-adaptation={mode}>
      <Card
        title={node.title ?? `${dataset?.entity ?? "Entity"} ranking`}
        subtitle={`${dataset?.label ?? "Dataset"} · ${metric?.label ?? "Measure"} · ${node.direction === "desc" ? "highest" : "lowest"} first`}
        badge={`${records.length} shown`}
      >
        {!ready(data) || !dataset || !metric ? (
          <DataState data={!metric && data.status === "ready" ? { status: "error", records: [], error: "Choose a declared metric for this ranking." } : data} />
        ) : (
          <>
            <ol className="aeliqo-ranking">
              {records.map((record, index) => {
                const id = String(record[dataset.identity]);
                const value = metricValue(record, metric);
                const Row = !onSelect ? "div" : "button";
                return (
                  <li key={id}>
                    <Row
                      className="aeliqo-ranking-row"
                      {...(!onSelect
                        ? {}
                        : {
                            type: "button" as const,
                            "aria-pressed": selected === id,
                            onClick: () => onSelect?.(id),
                          })}
                    >
                      <span className="aeliqo-rank-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="aeliqo-record-label">
                        {String(
                          record[node.dimension ?? dataset.labelField],
                        )}
                        {mode === "full" && (
                          <small>
                            {String(
                              record[
                                dataset.dimensions.find((field) =>
                                  /organization|provider|family/i.test(field.key),
                                )?.key ?? ""
                              ] ?? dataset.entity,
                            )}
                          </small>
                        )}
                      </span>
                      <span className="aeliqo-bar-track" aria-hidden="true" style={{ position: "relative" }}>
                        <span data-zero-baseline="true" style={{ position: "absolute", insetInlineStart: `${domain.zero}%`, insetBlock: -2, borderInlineStart: "1px solid currentColor", opacity: 0.35 }} />
                        <span
                          className="aeliqo-bar"
                          style={{
                            display: "block",
                            width: `${Math.abs(value ?? 0) / domain.range * 100}%`,
                            marginInlineStart: `${value !== null && value < 0 ? domain.zero + value / domain.range * 100 : domain.zero}%`,
                          }}
                        />
                      </span>
                      <span className="aeliqo-number">
                        {formatMetric(
                          typeof value === "number" ? value : null,
                          metric,
                        )}
                      </span>
                    </Row>
                  </li>
                );
              })}
            </ol>
            {!!onSelect && (
              <p className="aeliqo-hint">
                Select a {dataset.entity.toLowerCase()} to inspect its details.
              </p>
            )}
          </>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}
