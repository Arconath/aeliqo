import type { Dataset, WorkspaceNode } from "./contracts";
import type { ComponentRegistry } from "./registry";

export const viewTasks = [
  "overview",
  "compare",
  "trend",
  "events",
  "breakdown",
  "inspect",
  "quality",
  "distribution",
  "relationships",
] as const;
export type ViewTask = (typeof viewTasks)[number];
export interface ViewSuggestion {
  readonly node: Omit<WorkspaceNode, "id">;
  readonly reason: string;
  readonly requiresAcceptance: true;
}

/** Deterministic candidates for a declared task. Never mutates a workspace. */
export function suggestViews(
  dataset: Dataset,
  task: ViewTask,
  registry?: ComponentRegistry,
): readonly ViewSuggestion[] {
  const metric = dataset.metrics[0]?.key;
  const timeField = dataset.timeFields[0]?.key;
  const dimension =
    dataset.dimensions.find((field) => field.key !== dataset.labelField)?.key ??
    dataset.dimensions[0]?.key;
  const candidates: ViewSuggestion[] = [];
  const add = (
    component: string,
    reason: string,
    fields: Partial<WorkspaceNode> = {},
  ) => {
    if (registry && !registry.get(component)) return;
    candidates.push({
      node: { datasetId: dataset.id, component, ...fields },
      reason,
      requiresAcceptance: true,
    });
  };
  switch (task) {
    case "overview":
      if (metric)
        add(
          "Overview",
          "Summarize declared metrics beside records; each metric keeps its own unit.",
          { metric },
        );
      add("RecordList", "Inspect named entities without imposing a ranking.");
      break;
    case "compare":
      if (metric)
        add(
          "Comparison",
          "Compare entity values using declared measures without mixing units.",
          { metric },
        );
      add("Table", "Inspect original values side by side.");
      break;
    case "trend":
      if (metric && timeField)
        add(
          "Trend",
          "A declared measure and time field support temporal analysis; missing values remain gaps.",
          { metric, timeField },
        );
      break;
    case "events":
      if (timeField && dataset.semanticTags?.includes("event"))
        add(
          "EventTimeline",
          "The dataset explicitly declares event semantics and a dated field, so records can be inspected chronologically without implying causality.",
          { timeField },
        );
      break;
    case "breakdown": {
      const additive = dataset.metrics.find(
        (field) =>
          field.aggregation === "sum" || field.aggregation === "ratio-of-sums",
      );
      if (additive && dimension)
        add(
          "MetricBreakdown",
          "This measure can be recomputed by a declared dimension without averaging percentages.",
          { metric: additive.key, dimension },
        );
      break;
    }
    case "inspect":
      add("Table", "Inspect original records with stable entity identities.");
      add("RecordList", "Scan named entities with fewer fields.");
      break;
    case "quality":
      add(
        "QualityPanel",
        "Inspect provided provenance, loaded population and missing values; unknown evidence stays unknown.",
      );
      break;
    case "distribution":
      if (metric)
        add(
          "Distribution",
          "A declared measure supports spread and outlier inspection.",
          { metric },
        );
      break;
    case "relationships":
      for (const relation of dataset.relationships ?? [])
        add(
          "Relationship",
          "Follow an application-declared relationship; matching names do not invent a join.",
          { relationship: relation.id },
        );
      break;
  }
  return candidates;
}
