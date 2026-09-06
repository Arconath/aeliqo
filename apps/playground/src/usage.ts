import {
  defineDataset,
  type DataRecord,
  type MetricField,
} from "@aeliqo/core";

export const usageMetadata = Object.freeze({
  version: "synthetic-usage-v1",
  startDate: "2026-06-09",
  endDate: "2026-09-06",
  days: 90,
  source:
    "Deterministic synthetic workload fixture; not observed usage, popularity, availability or historical pricing.",
});
const metrics: readonly MetricField[] = [
  {
    key: "requests",
    label: "Synthetic requests",
    unit: "requests",
    aggregation: "sum",
  },
  {
    key: "inputTokens",
    label: "Synthetic input tokens",
    unit: "tokens",
    aggregation: "sum",
  },
  {
    key: "outputTokens",
    label: "Synthetic output tokens",
    unit: "tokens",
    aggregation: "sum",
  },
  {
    key: "spend",
    label: "Simulated spend at snapshot prices",
    format: "currency",
    unit: "USD",
    aggregation: "sum",
  },
  {
    key: "latency",
    label: "Synthetic daily mean latency",
    unit: "ms",
    aggregation: "mean",
  },
];
const dimensions = [
  { key: "name", label: "Observation" },
  { key: "model", label: "Model" },
  { key: "modelId", label: "Model identity" },
  { key: "organization", label: "Organization" },
  { key: "organizationId", label: "Organization identity" },
  { key: "dataKind", label: "Data provenance" },
  { key: "source", label: "Source and limitations" },
  { key: "snapshotVersion", label: "Fixture version" },
];
const relationships = [
  { id: "model", label: "Model", field: "modelId", targetDatasetId: "models" },
  {
    id: "organization",
    label: "Organization",
    field: "organizationId",
    targetDatasetId: "organizations",
  },
];
export const usage = defineDataset({
  id: "usage",
  entity: "UsageObservation",
  label: "Synthetic daily AI workload · 90 days (not real adoption)",
  identity: "id",
  labelField: "name",
  dimensions,
  metrics,
  timeFields: [{ key: "date", label: "Simulated day" }],
  relationships,
});
export const modelUsage = defineDataset({
  id: "model-usage",
  entity: "ModelUsage",
  label: "Synthetic model usage totals · not real popularity",
  identity: "id",
  labelField: "model",
  dimensions,
  timeFields: [],
  metrics: [
    ...metrics.filter((metric) => metric.key !== "latency"),
    {
      key: "inputPrice",
      label: "Snapshot input price · USD / 1M tokens",
      format: "currency",
      unit: "USD",
      aggregation: "mean",
    },
    {
      key: "outputPrice",
      label: "Snapshot output price · USD / 1M tokens",
      format: "currency",
      unit: "USD",
      aggregation: "mean",
    },
  ],
  relationships,
});

/** Fixed arithmetic, no clock/random/network; figures deliberately do not assert market adoption. */
export function createUsageRecords(
  models: readonly DataRecord[],
): readonly DataRecord[] {
  return Array.from({ length: usageMetadata.days }, (_, day) => {
    const date = new Date(Date.UTC(2026, 5, 9 + day))
      .toISOString()
      .slice(0, 10);
    return models.map((model, index) => {
      const requests = Math.round(
        (900 + index * 170) *
          (1 + day / 180) *
          (0.85 + ((day + index) % 7) * 0.05),
      );
      const inputTokens = requests * (600 + index * 80);
      const outputTokens = requests * (180 + index * 20);
      return Object.freeze({
        id: `${model.id}-${date}`,
        name: `${model.name} · ${date}`,
        date,
        modelId: model.id ?? null,
        model: model.name ?? null,
        organizationId: model.organizationId ?? null,
        organization: model.organization ?? null,
        requests,
        inputTokens,
        outputTokens,
        spend: Number(
          (
            (inputTokens * Number(model.inputPrice) +
              outputTokens * Number(model.outputPrice)) /
            1e6
          ).toFixed(6),
        ),
        latency: 300 + index * 130 + ((day * 17 + index * 11) % 160),
        dataKind: "SYNTHETIC · not observed usage",
        source: usageMetadata.source,
        snapshotVersion: usageMetadata.version,
      });
    });
  }).flat();
}

export function summarizeModelUsage(
  models: readonly DataRecord[],
  observations: readonly DataRecord[],
): readonly DataRecord[] {
  return models.map((model) => {
    const rows = observations.filter((row) => row.modelId === model.id);
    const total = (key: string) =>
      rows.reduce((sum, row) => sum + Number(row[key]), 0);
    return {
      id: model.id ?? null,
      name: `${model.name} · synthetic workload`,
      modelId: model.id ?? null,
      model: model.name ?? null,
      organizationId: model.organizationId ?? null,
      organization: model.organization ?? null,
      requests: total("requests"),
      inputTokens: total("inputTokens"),
      outputTokens: total("outputTokens"),
      spend: Number(total("spend").toFixed(6)),
      inputPrice: model.inputPrice ?? null,
      outputPrice: model.outputPrice ?? null,
      dataKind: "SYNTHETIC · not real popularity",
      source: usageMetadata.source,
      snapshotVersion: usageMetadata.version,
    };
  });
}
