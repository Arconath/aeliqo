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
  useData,
  type AdaptationEvent,
  type SemanticProps,
} from "./shared";
export interface DistributionProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metric: string;
  limit?: number;
  title?: string;
  density?: "compact" | "comfortable";
  onAdaptation?: (event: AdaptationEvent) => void;
}
export function Distribution(props: DistributionProps | SemanticProps) {
  return "store" in props ? (
    <SemanticDistribution {...props} />
  ) : (
    <StandaloneDistribution {...props} />
  );
}
function SemanticDistribution(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  return (
    <DistributionView
      data={data}
      dataset={dataset}
      metric={metric}
      limit={props.node.limit}
      title={props.node.title}
      density={props.node.density}
      adaptationId={props.node.id}
      onAdaptation={props.onAdaptation}
    />
  );
}
function StandaloneDistribution(props: DistributionProps) {
  return (
    <DistributionView
      data={safeSnapshot(props.dataset, props.snapshot)}
      dataset={props.dataset}
      metric={props.dataset.metrics.find((field) => field.key === props.metric)}
      limit={props.limit}
      title={props.title}
      density={props.density}
      adaptationId="standalone-distribution"
      onAdaptation={props.onAdaptation}
    />
  );
}
function quantile(values: readonly number[], fraction: number) {
  const index = (values.length - 1) * fraction,
    lower = Math.floor(index),
    weight = index - lower;
  return (
    values[lower]! * (1 - weight) +
    values[Math.min(values.length - 1, lower + 1)]! * weight
  );
}
function DistributionView({
  data,
  dataset,
  metric,
  limit,
  title,
  adaptationId,
  onAdaptation,
  density,
}: {
  data: DataSnapshot;
  dataset?: Dataset;
  metric?: MetricField;
  limit?: number;
  title?: string;
  density?: "compact" | "comfortable";
  adaptationId: string;
  onAdaptation?: (event: AdaptationEvent) => void;
}) {
  const previousMode = useRef<DensityMode | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"full-bins" | "compact-bins">("full-bins");
  const chart = useMemo(() => {
    if (!dataset || !metric) return null;
    const values = data.records
      .flatMap((record) => {
        const value = metricValue(record, metric);
        return value === null ? [] : [{ record, value }];
      })
      .slice(0, limit ?? data.records.length)
      .sort((a, b) => a.value - b.value);
    if (!values.length) return null;
    const raw = values.map((item) => item.value),
      count = mode === "compact-bins" ? 5 : 8,
      min = raw[0]!,
      max = raw.at(-1)!,
      width = Math.max((max - min) / count, Number.EPSILON),
      bins = Array.from({ length: count }, (_, i) => ({
        start: min + i * width,
        end: i === count - 1 ? max : min + (i + 1) * width,
        count: 0,
      }));
    for (const value of raw)
      bins[Math.min(count - 1, Math.floor((value - min) / width))]!.count++;
    const q1 = quantile(raw, 0.25),
      q3 = quantile(raw, 0.75),
      iqr = q3 - q1,
      outliers = values.filter(
        (item) => item.value < q1 - iqr * 1.5 || item.value > q3 + iqr * 1.5,
      );
    return {
      values,
      bins,
      min,
      max,
      outliers,
      x: scaleLinear()
        .domain([min, max || min + 1])
        .range([42, 520]),
      y: scaleLinear()
        .domain([0, Math.max(1, ...bins.map((b) => b.count))])
        .range([150, 20]),
    };
  }, [data.records, dataset, metric, limit, mode]);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const resolved = resolveDensity(width, previousMode.current, 470, density);
      previousMode.current = resolved;
      const next = resolved === "compact" ? "compact-bins" : "full-bins";
      setMode(next);
      onAdaptation?.({
        id: adaptationId,
        mode: next,
        width,
        visibleRecords: chart?.values.length ?? 0,
        totalRecords: data.records.length,
        reason: density ? "explicit_preference" : resolved === "compact" ? "container_narrow" : "container_wide",
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [density, adaptationId, chart?.values.length, data.records.length, onAdaptation]);
  return (
    <div ref={ref} data-adaptation={mode}>
      <Card
        title={title ?? `${metric?.label ?? "Metric"} distribution`}
        subtitle={`${dataset?.label ?? "Dataset"} · spread and deterministic IQR outliers`}
        badge="Distribution"
      >
        {!ready(data) || !chart || !dataset || !metric ? (
          <DataState data={data} />
        ) : (
          <>
            <svg
              className="aeliqo-distribution"
              viewBox="0 0 540 185"
              role="img"
              aria-label={`${metric.label} distribution across ${chart.values.length} ${dataset.entity} records`}
            >
              {chart.bins.map((bin, i) => {
                const left = chart.x(bin.start),
                  right = i === chart.bins.length - 1 ? 520 : chart.x(bin.end);
                return (
                  <rect
                    key={i}
                    x={left + 2}
                    y={chart.y(bin.count)}
                    width={Math.max(2, right - left - 4)}
                    height={150 - chart.y(bin.count)}
                    rx="3"
                  >
                    <title>{`${formatMetric(bin.start, metric)}–${formatMetric(bin.end, metric)}: ${bin.count}`}</title>
                  </rect>
                );
              })}
            </svg>
            <div className="aeliqo-extremes">
              <span>
                <b>Lowest</b>
                {String(chart.values[0]!.record[dataset.labelField])} ·{" "}
                {formatMetric(chart.min, metric)}
              </span>
              <span>
                <b>Highest</b>
                {String(chart.values.at(-1)!.record[dataset.labelField])} ·{" "}
                {formatMetric(chart.max, metric)}
              </span>
            </div>
            <p className="aeliqo-hint">
              {chart.outliers.length
                ? `${chart.outliers.length} IQR outlier${chart.outliers.length === 1 ? "" : "s"}`
                : "No IQR outliers"}{" "}
              · {mode.replaceAll("-", " ")}
            </p>
          </>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}
