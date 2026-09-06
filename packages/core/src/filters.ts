import type { Dataset, Filter, DataRecord } from "./contracts";
import { metricValue } from "./semantics";
import { assert } from "./config-validation";

export function validateFilters(
  dataset: Dataset,
  filters: readonly Filter[] = [],
): void {
  assert(filters.length <= 10, "At most ten filters are supported");
  const fields = new Set([
    dataset.identity,
    ...dataset.dimensions.map((field) => field.key),
    ...dataset.metrics.map((field) => field.key),
    ...dataset.timeFields.map((field) => field.key),
  ]);
  for (const filter of filters) {
    assert(fields.has(filter.field), `Unknown filter field: ${filter.field}`);
    assert(
      ["eq", "lt", "lte", "gt", "gte", "in"].includes(filter.operator),
      "Unknown filter operator",
    );
    if (filter.operator === "in")
      assert(
        Array.isArray(filter.value) &&
          filter.value.every((value) => typeof value === "string"),
        "in requires a string list",
      );
    else if (filter.operator === "eq")
      assert(
        typeof filter.value === "string" ||
          (typeof filter.value === "number" && Number.isFinite(filter.value)),
        "eq requires a finite scalar",
      );
    else
      assert(
        typeof filter.value === "number" &&
          Number.isFinite(filter.value) &&
          dataset.metrics.some((metric) => metric.key === filter.field),
        "Numeric comparisons require a metric and finite number",
      );
  }
}
export function filterRecords(
  records: readonly DataRecord[],
  filters: readonly Filter[] = [],
  dataset?: Dataset,
): readonly DataRecord[] {
  if (!filters.length) return records;
  return records.filter((record) =>
    filters.every((filter) => {
      const metric = dataset?.metrics.find(
        (field) => field.key === filter.field,
      );
      const actual = metric
        ? metricValue(record, metric)
        : record[filter.field];
      if (filter.operator === "eq") return actual === filter.value;
      if (filter.operator === "in")
        return (
          typeof actual === "string" &&
          Array.isArray(filter.value) &&
          filter.value.includes(actual)
        );
      if (
        typeof actual !== "number" ||
        !Number.isFinite(actual) ||
        typeof filter.value !== "number"
      )
        return false;
      switch (filter.operator) {
        case "lt":
          return actual < filter.value;
        case "lte":
          return actual <= filter.value;
        case "gt":
          return actual > filter.value;
        case "gte":
          return actual >= filter.value;
      }
    }),
  );
}
