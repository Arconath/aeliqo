import { aggregateMetric, formatMetric, type MetricField } from "@aeliqo/core";
import { useMemo } from "react";
import { Card, DataState, DataWarnings, useData, type SemanticProps } from "./shared";
export interface DeltaProps { value: number | null; baseline: number | null; label: string; baselineLabel: string; metric?: MetricField; mode?: "absolute" | "relative" }
export function Delta(props: DeltaProps | SemanticProps) {
  return "store" in props ? <SemanticDelta {...props} /> : <DeltaView {...props} />;
}
function SemanticDelta(props: SemanticProps) {
  const { data, metric } = useData(props);
  const config = props.node.config;
  const value = useMemo(() => metric ? aggregateMetric(data.records, metric) : null, [metric, data.records]);
  return <><DeltaView value={value} baseline={typeof config?.baseline === "number" ? config.baseline : null} baselineLabel={typeof config?.baselineLabel === "string" ? config.baselineLabel : ""} label={props.node.title ?? metric?.label ?? "Change"} metric={metric} mode={config?.mode === "relative" ? "relative" : "absolute"} state={data.status !== "ready" ? <DataState data={data} /> : undefined} /><DataWarnings data={data} /></>;
}
function DeltaView({ value, baseline, label, baselineLabel, metric, mode = "absolute", state }: DeltaProps & { state?: import("react").ReactNode }) {
  const finite = (value: number | null) => value !== null && Number.isFinite(value);
  const difference = finite(value) && finite(baseline) ? value! - baseline! : null;
  const result = difference === null ? null : mode === "relative" ? baseline === 0 ? null : difference / Math.abs(baseline!) : difference;
  const formatter = mode === "relative" ? { key: "relative", label, aggregation: "none" as const, format: "percent" as const } : metric;
  const text = result === null || !Number.isFinite(result) ? "Not available" : `${result > 0 ? "+" : ""}${formatter ? formatMetric(result, formatter) : new Intl.NumberFormat("en-US").format(result)}`;
  return <Card title={label} subtitle={baselineLabel ? `Baseline: ${baselineLabel}` : "Baseline label is required"}>
    {state ?? (!baselineLabel.trim() ? <p role="alert">Provide an explicit baseline label.</p> : <>
      <p className="aeliqo-value">{text}</p>
      <p className="aeliqo-hint">{difference === null ? "Current value or baseline is unavailable." : result === null ? "Relative change is undefined for a zero baseline." : `${difference > 0 ? "Increased" : difference < 0 ? "Decreased" : "Unchanged"}${mode === "relative" ? " relative to the absolute baseline" : " from baseline"}.`}</p>
    </>)}
  </Card>;
}
