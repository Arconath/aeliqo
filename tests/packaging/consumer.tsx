import { createWorkspace, defineDataset, type DataPort } from "@aeliqo/core";
import { Comparison, Metric, Ranking, Workspace } from "@aeliqo/react";
import type { DeltaProps } from "@aeliqo/react/delta";
import type { DetailProps } from "@aeliqo/react/detail";
import type { FilterProps } from "@aeliqo/react/filter";
import type { DistributionProps } from "@aeliqo/react/distribution";
import type { EventTimelineProps } from "@aeliqo/react/event-timeline";
import type { ExplorerProps } from "@aeliqo/react/explorer";
import type { MatrixProps } from "@aeliqo/react/matrix";
import type { MetricBreakdownProps } from "@aeliqo/react/metric-breakdown";
import type { OverviewProps } from "@aeliqo/react/overview";
import type { QualityPanelProps } from "@aeliqo/react/quality-panel";
import type { RankingProps } from "@aeliqo/react/ranking";
import type { RecordListProps } from "@aeliqo/react/record-list";
import type { RelationshipProps } from "@aeliqo/react/relationship";
import type { ScatterProps } from "@aeliqo/react/scatter";
import type { SelectionSummaryProps } from "@aeliqo/react/selection-summary";
import type { TableProps } from "@aeliqo/react/table";
import type { TrendProps } from "@aeliqo/react/trend";
import type { TimeInvestigationProps } from "@aeliqo/react/time-investigation";
import type { CSSProperties } from "react";

export type PublicDirectProps =
  | DeltaProps
  | DetailProps
  | DistributionProps
  | EventTimelineProps
  | ExplorerProps
  | FilterProps
  | MatrixProps
  | MetricBreakdownProps
  | OverviewProps
  | QualityPanelProps
  | RankingProps
  | RecordListProps
  | RelationshipProps
  | ScatterProps
  | SelectionSummaryProps
  | TableProps
  | TrendProps
  | TimeInvestigationProps;

export const services = defineDataset({
  id: "release-services",
  entity: "Service",
  label: "Release services",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Service", semanticType: "text" as const },
    { key: "team", label: "Team", semanticType: "category" as const },
  ],
  metrics: [
    { key: "requests", label: "Requests", aggregation: "sum" as const },
    {
      key: "availability",
      label: "Availability",
      aggregation: "mean" as const,
      format: "percent" as const,
    },
  ],
  timeFields: [{ key: "observedAt", label: "Observed", temporal: "date" as const }],
  metadata: {
    source: "isolated release consumer fixture",
    sourceDate: "2026-09-07",
    snapshotVersion: "1",
  },
});

export const serviceSnapshot = {
  status: "ready" as const,
  records: [
    { id: "api", name: "API", team: "Platform", requests: 1_240, availability: 0.999, observedAt: "2026-09-06" },
    { id: "worker", name: "Worker", team: "Operations", requests: 830, availability: 0.992, observedAt: "2026-09-06" },
  ],
  metadata: services.metadata,
  scope: "entire-dataset" as const,
};

const dataPort: DataPort = {
  listDatasets: () => [services],
  getDataset: (id) => (id === services.id ? services : undefined),
  getSnapshot: (id) =>
    id === services.id
      ? serviceSnapshot
      : { status: "error", records: [], error: "Unknown dataset" },
  subscribe: () => () => undefined,
};

export const workspace = createWorkspace({
  dataPort,
  nodes: [
    {
      id: "service-ranking",
      component: "Ranking",
      datasetId: services.id,
      metric: "requests",
      title: "Request volume",
    },
    {
      id: "service-detail",
      component: "Detail",
      datasetId: services.id,
      title: "Selected service",
    },
  ],
  bindings: [
    {
      id: "service-selection",
      source: "service-ranking",
      target: "service-detail",
      entity: services.entity,
    },
  ],
});

const selected = workspace.apply(
  {
    version: 1,
    baseRevision: workspace.getState().revision,
    operations: [{ type: "select", id: "service-ranking", recordId: "api" }],
  },
  { actor: "human" },
);
if (!selected.ok || workspace.getSelection("service-detail") !== "api")
  throw new Error("Manual linked selection did not reach the detail component");

export function ConsumerExample() {
  return (
    <main
      className="aeliqo-theme"
      data-aeliqo-theme="release-consumer"
      style={{ "--aeliqo-accent": "#6750a4" } as CSSProperties}
    >
      <Metric value={2_070} label="Daily requests" />
      <Ranking
        dataset={services}
        snapshot={serviceSnapshot}
        metric="requests"
        selectedId="api"
      />
      <Comparison
        dataset={services}
        snapshot={serviceSnapshot}
        metrics={["requests", "availability"]}
        selectedIds={["api", "worker"]}
      />
      <Workspace store={workspace} />
    </main>
  );
}
