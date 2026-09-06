import type { Dataset, DataRecord, MetricField } from "./contracts";
import { aggregateRatio, metricValue, validateMetricDeclarations } from "./semantics";
import { assert } from "./config-validation";

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
  if (
    fields.some(
      (field) =>
        field.temporal !== undefined &&
        !["month", "date", "instant"].includes(field.temporal),
    )
  )
    throw new Error("Unknown temporal policy");
  const relationships = dataset.relationships ?? [];
  if (
    new Set(relationships.map((relation) => relation.id)).size !==
    relationships.length
  )
    throw new Error("Relationship ids must be unique");
  for (const relation of relationships) {
    if (
      !relation.id ||
      !relation.targetDatasetId ||
      !fields.some((field) => field.key === relation.field)
    )
      throw new Error(
        "Relationship requires a declared source field and target dataset",
      );
  }
  validateMetricDeclarations(dataset);
  return dataset;
}
export function aggregateMetric(
  records: readonly DataRecord[],
  metric: MetricField,
): number | null {
  if (metric.aggregation === "ratio-of-sums")
    return aggregateRatio(records, metric);
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
  const left = typeof metric === "string" ? a[metric] : metricValue(a, metric),
    right = typeof metric === "string" ? b[metric] : metricValue(b, metric);
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
    assert(
      metric.unit &&
        /^[A-Z]{3}$/.test(metric.unit) &&
        Intl.supportedValuesOf("currency").includes(metric.unit),
      "Currency metric requires a supported currency code",
    );
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
