import { useMemo } from "react";
import { aggregateMetric, formatMetric, type MetricField } from "@aeliqo/core";
import { Card, DataState, DataWarnings, ready, useData, type SemanticProps } from "./shared";
export interface MetricProps { value: number | null; label: string; metric?: MetricField }
export function Metric(props: SemanticProps | MetricProps) {
  return "store" in props ? <SemanticMetric {...props} /> : <Card title={props.label}><MetricValue value={props.value} metric={props.metric} /></Card>;
}
function MetricValue({ value, metric }: Pick<MetricProps, "value" | "metric">) {
  return <div className="aeliqo-value">{metric ? formatMetric(value, metric) : value !== null && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "—"}</div>;
}
function SemanticMetric(props: SemanticProps) {
  const { data, metric, dataset } = useData(props);
  const value = useMemo(
    () => (metric ? aggregateMetric(data.records, metric) : null),
    [data.records, metric],
  );
  return (
    <Card
      title={props.node.title ?? metric?.label ?? "Metric"}
      subtitle={dataset?.label}
    >
      {!ready(data) ? (
        <DataState data={data} />
      ) : (
        <>
          <MetricValue value={value} metric={metric} />
          <div className="aeliqo-metric-footer">
            {metric?.aggregation === "ratio-of-sums" ? "Ratio of sums" : metric?.aggregation === "mean"
              ? "Average"
              : metric?.aggregation === "sum"
                ? "Total"
                : "Value"}{" "}
            · {data.records.length} {dataset?.entity} records
          </div>
        </>
      )}
      <DataWarnings data={data} />
    </Card>
  );
}
