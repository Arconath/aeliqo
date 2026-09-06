import { resolveDensity, type DensityMode } from "./adaptation";
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import {
  formatMetric,
  metricValue,
  type DataSnapshot,
  type Dataset,
  type MetricField,
} from "@aeliqo/core";
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

export interface ScatterProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  xMetric: string;
  metric: string;
  dimension?: string;
  seriesBy?: string;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
  density?: "compact" | "comfortable";
  onAdaptation?: (event: AdaptationEvent) => void;
}
export function Scatter(props: ScatterProps | SemanticProps) {
  return "store" in props ? (
    <SemanticScatter {...props} />
  ) : (
    <StandaloneScatter {...props} />
  );
}
function SemanticScatter(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  const selectedId = useSelection(props.store, props.node.id);
  return (
    <ScatterView
      data={data}
      dataset={dataset}
      xMetric={dataset?.metrics.find(
        (field) => field.key === props.node.xMetric,
      )}
      metric={metric}
      dimension={props.node.dimension}
      seriesBy={props.node.seriesBy}
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
function StandaloneScatter(props: ScatterProps) {
  return (
    <ScatterView
      data={safeSnapshot(props.dataset, props.snapshot)}
      dataset={props.dataset}
      xMetric={props.dataset.metrics.find(
        (field) => field.key === props.xMetric,
      )}
      metric={props.dataset.metrics.find((field) => field.key === props.metric)}
      dimension={props.dimension}
      seriesBy={props.seriesBy}
      limit={props.limit}
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      title={props.title}
      density={props.density}
      onAdaptation={props.onAdaptation}
      adaptationId="standalone-scatter"
    />
  );
}
function extent(values: readonly number[]): [number, number] {
  const min = Math.min(...values),
    max = Math.max(...values);
  return min === max
    ? [min - 1, max + 1]
    : [min - (max - min) * 0.08, max + (max - min) * 0.08];
}
function ScatterView({
  data,
  dataset,
  xMetric,
  metric,
  dimension,
  seriesBy,
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
  xMetric?: MetricField;
  metric?: MetricField;
  dimension?: string;
  seriesBy?: string;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
  density?: "compact" | "comfortable";
  adaptationId: string;
  onAdaptation?: (event: AdaptationEvent) => void;
}) {
  const previousMode = useRef<DensityMode | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"full-annotations" | "focused-annotations">(
    "full-annotations",
  );
  const chart = useMemo(() => {
    if (!dataset || !xMetric || !metric) return null;
    const points = data.records
      .flatMap((record) => {
        const x = metricValue(record, xMetric),
          y = metricValue(record, metric);
        return x === null || y === null
          ? []
          : [
              {
                id: String(record[dataset.identity]),
                label: String(record[dimension ?? dataset.labelField]),
                group: String(record[seriesBy ?? ""] ?? "All"),
                x,
                y,
              },
            ];
      })
      .slice(0, limit ?? data.records.length);
    if (!points.length) return null;
    const improves = (
      candidate: number,
      value: number,
      goal: MetricField["goal"],
    ) => (goal === "minimize" ? candidate <= value : candidate >= value);
    const strict = (
      candidate: number,
      value: number,
      goal: MetricField["goal"],
    ) => (goal === "minimize" ? candidate < value : candidate > value);
    const frontier = new Set(
      points
        .filter(
          (point) =>
            !points.some(
              (candidate) =>
                candidate !== point &&
                improves(candidate.x, point.x, xMetric.goal) &&
                improves(candidate.y, point.y, metric.goal) &&
                (strict(candidate.x, point.x, xMetric.goal) ||
                  strict(candidate.y, point.y, metric.goal)),
            ),
        )
        .map((point) => point.id),
    );
    return {
      points,
      x: scaleLinear()
        .domain(extent(points.map((p) => p.x)))
        .nice()
        .range([54, 520]),
      y: scaleLinear()
        .domain(extent(points.map((p) => p.y)))
        .nice()
        .range([166, 18]),
      groups: [...new Set(points.map((p) => p.group))],
      frontier,
    };
  }, [data.records, dataset, xMetric, metric, dimension, seriesBy, limit]);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const resolved = resolveDensity(width, previousMode.current, 560, density);
      previousMode.current = resolved;
      const crowded = !density && (chart?.points.length ?? 0) > 14;
      const next = resolved === "compact" || crowded ? "focused-annotations" : "full-annotations";
      setMode(next);
      onAdaptation?.({
        id: adaptationId,
        mode: next,
        width,
        visibleRecords: chart?.points.length ?? 0,
        totalRecords: data.records.length,
        reason: density ? "explicit_preference" : resolved === "compact" ? "container_narrow" : crowded ? "record_density" : "container_wide",
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [density, adaptationId, chart?.points.length, data.records.length, onAdaptation]);
  return (
    <div ref={ref} data-adaptation={mode}>
      <Card
        title={title ?? "Metric trade-offs"}
        subtitle={`${xMetric?.label ?? "X measure"} × ${metric?.label ?? "Y measure"}`}
        badge="Correlation"
      >
        {!ready(data) || !chart || !dataset || !xMetric || !metric ? (
          <DataState
            data={
              data.status === "ready" && (!xMetric || !metric)
                ? {
                    status: "error",
                    records: [],
                    error:
                      "Choose two distinct declared metrics for this scatterplot.",
                  }
                : data
            }
          />
        ) : (
          <>
            <svg
              className="aeliqo-scatter"
              viewBox="0 0 540 205"
              role="img"
              aria-label={`${xMetric.label} versus ${metric.label}`}
            >
              <title>{`${xMetric.label} versus ${metric.label}`}</title>
              {chart.x.ticks(4).map((tick) => (
                <g key={`x-${tick}`}>
                  <line
                    className="aeliqo-chart-grid"
                    x1={chart.x(tick)}
                    x2={chart.x(tick)}
                    y1="18"
                    y2="166"
                  />
                  <text x={chart.x(tick)} y="184" textAnchor="middle">
                    {formatMetric(tick, xMetric)}
                  </text>
                </g>
              ))}
              {chart.y.ticks(4).map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    className="aeliqo-chart-grid"
                    x1="54"
                    x2="520"
                    y1={chart.y(tick)}
                    y2={chart.y(tick)}
                  />
                  <text x="48" y={chart.y(tick) + 3} textAnchor="end">
                    {formatMetric(tick, metric)}
                  </text>
                </g>
              ))}
              {chart.points.map((point) => {
                const group = chart.groups.indexOf(point.group);
                return (
                  <g
                    key={point.id}
                    role="button"
                    tabIndex={0}
                    className="aeliqo-scatter-point"
                    data-selected={selectedId === point.id}
                    data-frontier={chart.frontier.has(point.id)}
                    aria-label={`${point.label}: ${xMetric.label} ${formatMetric(point.x, xMetric)}, ${metric.label} ${formatMetric(point.y, metric)}`}
                    onClick={() => onSelect?.(point.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect?.(point.id);
                      }
                    }}
                  >
                    <circle
                      cx={chart.x(point.x)}
                      cy={chart.y(point.y)}
                      r={selectedId === point.id ? 7 : 5}
                      style={{
                        fill: `var(--aeliqo-chart-${group + 1}, var(--aeliqo-accent, #117568))`,
                      }}
                    />
                    <text x={chart.x(point.x) + 8} y={chart.y(point.y) - 7}>
                      {mode === "full-annotations" ||
                      selectedId === point.id ||
                      chart.frontier.has(point.id)
                        ? point.label
                        : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="aeliqo-chart-footer">
              <span>
                {chart.frontier.size} deterministic Pareto frontier points
              </span>
              <span>{mode.replaceAll("-", " ")}</span>
            </div>
            {(dataset.caveat || xMetric.methodology || metric.methodology) && (
              <p className="aeliqo-caveat">
                {metric.methodology ?? xMetric.methodology ?? dataset.caveat}
              </p>
            )}
          </>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}
