import type { WorkspaceNode, DataPort } from "./contracts";
import type { ComponentRegistry } from "./registry";
import { assert, safeId, freezeConfig } from "./config-validation";
import { validateFilters } from "./filters";

/** All application-owned snapshots needed to present this node. */
export function nodeDatasetIds(node: WorkspaceNode): readonly string[] {
  const events = node.component === "TimeInvestigation" ? node.config?.eventDatasetId : undefined;
  return typeof events === "string" && events !== node.datasetId ? [node.datasetId, events] : [node.datasetId];
}

export function validateNode(
  node: WorkspaceNode,
  dataPort: DataPort,
  registry: ComponentRegistry,
): void {
  assert(safeId(node.id), "Invalid node id");
  assert(registry.get(node.component), "Unknown component");
  const dataset = dataPort.getDataset(node.datasetId);
  assert(dataset, `Unknown dataset: ${node.datasetId}`);
  if (node.config) freezeConfig(node.config);
  if (node.pinned !== undefined)
    assert(typeof node.pinned === "boolean", "Pinned must be a boolean");
  registry.validate(node, dataPort);
  validateFilters(dataset, node.filters);
  if (node.columns) {
    const fields = [
      ...dataset.dimensions,
      ...dataset.metrics,
      ...dataset.timeFields,
    ];
    assert(
      node.columns.length > 0 &&
        node.columns.length <= 20 &&
        new Set(node.columns).size === node.columns.length,
      "Expected 1–20 unique columns",
    );
    assert(
      node.columns.every((key) => fields.some((field) => field.key === key)),
      "Unknown column",
    );
  }
  if (node.compareIds) {
    assert(
      node.component === "Comparison",
      "compareIds are only valid for Comparison",
    );
    assert(
      node.compareIds.length >= 2 &&
        node.compareIds.length <= 8 &&
        new Set(node.compareIds).size === node.compareIds.length,
      "Comparison requires 2–8 unique entity identities",
    );
    const available = new Set(
      dataPort
        .getSnapshot(node.datasetId)
        .records.map((record) => String(record[dataset.identity])),
    );
    assert(
      node.compareIds.every((id) => available.has(id)),
      "Unknown comparison identity",
    );
  }
  if (node.component === "Comparison" && node.columns) {
    assert(
      node.columns.every((key) =>
        dataset.metrics.some((metric) => metric.key === key),
      ),
      "Comparison columns must be metrics",
    );
  }
  if (node.seriesBy)
    assert(
      dataset.dimensions.some((field) => field.key === node.seriesBy),
      "Unknown series dimension",
    );
  if (node.span !== undefined)
    assert(
      Number.isInteger(node.span) && node.span >= 1 && node.span <= 12,
      "Span must be 1–12",
    );
  if (node.height !== undefined)
    assert(
      Number.isInteger(node.height) && node.height >= 240 && node.height <= 900,
      "Height must be 240–900",
    );
  if (node.density !== undefined)
    assert(
      ["compact", "comfortable"].includes(node.density),
      "Unknown density",
    );
  const needsMetric =
    [
      "Delta",
      "Metric",
      "Ranking",
      "Trend",
      "Scatter",
      "Distribution",
      "Comparison",
      "Explorer",
      "MetricBreakdown",
      "TimeInvestigation",
    ].includes(node.component) ||
    (node.component === "Overview" && !node.columns);
  if (node.component === "Overview" && node.columns)
    assert(
      node.columns.length <= 6 &&
        node.columns.every((key) =>
          dataset.metrics.some((metric) => metric.key === key),
        ),
      "Overview requires at most six metric columns",
    );
  if (node.component === "RecordList" && node.columns)
    assert(
      node.columns.length <= 8,
      "RecordList supports at most eight fields",
    );
  if (needsMetric) assert(node.metric, `${node.component} requires a metric`);
  if (node.metric)
    assert(
      dataset.metrics.some((field) => field.key === node.metric),
      "Unknown metric",
    );
  if (node.xMetric)
    assert(
      dataset.metrics.some((field) => field.key === node.xMetric),
      "Unknown x metric",
    );
  if (node.component === "Scatter") {
    assert(node.xMetric, "Scatter requires an x metric");
    assert(node.xMetric !== node.metric, "Scatter metrics must be distinct");
  }
  if (node.dimension)
    assert(
      dataset.dimensions.some((field) => field.key === node.dimension),
      "Unknown dimension",
    );
  if (["Trend", "EventTimeline", "TimeInvestigation"].includes(node.component))
    assert(node.timeField, `${node.component} requires a time field`);
  if (node.component === "MetricBreakdown")
    assert(node.dimension, "MetricBreakdown requires a dimension");
  if (node.component === "MetricBreakdown" && node.metric) {
    const metric = dataset.metrics.find((field) => field.key === node.metric)!;
    assert(
      metric.aggregation === "sum" || metric.aggregation === "ratio-of-sums",
      "MetricBreakdown requires an additive or ratio-of-sums metric",
    );
  }
  if (node.component === "TimeInvestigation" && node.config?.eventDatasetId) {
    const events = dataPort.getDataset(String(node.config.eventDatasetId));
    assert(events, "Unknown event dataset");
    assert(events.timeFields.some(field => field.key === node.config?.eventTimeField), "Unknown event time field");
    if (node.config.eventLabelField)
      assert(events.dimensions.some(field => field.key === node.config?.eventLabelField), "Unknown event label field");
  }
  if (node.component === "Relationship") {
    assert(node.relationship, "Relationship requires a declared relationship");
    assert(
      dataset.relationships?.some((item) => item.id === node.relationship),
      "Unknown relationship",
    );
  }
  if (node.component === "Matrix") {
    assert(
      node.columns && node.columns.length > 0,
      "Matrix requires feature columns",
    );
    assert(
      node.columns.every((key) =>
        dataset.metrics.some((field) => field.key === key),
      ),
      "Matrix columns must be metrics",
    );
  }
  if (node.timeField)
    assert(
      dataset.timeFields.some((field) => field.key === node.timeField),
      "Unknown time field",
    );
  if (node.limit !== undefined)
    assert(
      Number.isInteger(node.limit) && node.limit > 0 && node.limit <= 10000,
      "Limit must be an integer between 1 and 10000",
    );
  if (node.direction !== undefined)
    assert(
      node.direction === "asc" || node.direction === "desc",
      "Invalid sort direction",
    );
}
