import {
  createWorkspace,
  createCapabilityDispatcher,
  type WorkspaceNode,
  type Operation,
} from "@aeliqo/core";
import { dataPort } from "./data";
import { proof } from "./proof-store";
import { composeShowcase, showcaseScenarios } from "./showcase";
export const overview: WorkspaceNode[] = [
  {
    id: "baseline",
    component: "Metric",
    datasetId: "models",
    metric: "outputPrice",
    title: "Average output price",
  },
  {
    id: "smart-exploration",
    component: "Explorer",
    datasetId: "models",
    metric: "outputPrice",
    direction: "asc",
    title: "Explore the semantic model graph",
    limit: 8,
    span: 12,
  },
];
export const store = createWorkspace({ dataPort, nodes: overview });
export const dispatcher = createCapabilityDispatcher(store, {
  onEvent: proof.event,
  now: () => performance.now(),
});
export const explicit: WorkspaceNode = {
  id: "explicit",
  component: "Ranking",
  datasetId: "models",
  metric: "outputPrice",
  direction: "asc",
  title: "Models by output-token price",
  limit: 8,
};
export const explorer: WorkspaceNode = {
  id: "explorer",
  component: "Explorer",
  datasetId: "models",
  metric: "outputPrice",
  title: "Explore the model snapshot",
  limit: 8,
};
export const explicitScatter: WorkspaceNode = {
  id: "explicit-scatter",
  component: "Scatter",
  datasetId: "models",
  xMetric: "outputPrice",
  metric: "contextWindow",
  seriesBy: "provider",
  title: "Explicit price × context trade-off",
  span: 12,
};
export const demoStore = createWorkspace({
  dataPort,
  nodes: [explicit, explorer, explicitScatter],
});
export const canonicalIntent =
  "Show me models with low output pricing and large context windows, and let me inspect the selected model.";
export function applyDirect(operations: Operation[]) {
  return dispatcher.dispatch(
    "workspace_apply",
    { version: 1, baseRevision: store.getState().revision, operations },
    { source: "direct" },
  );
}
export function runShowcaseScenario(id: string) {
  const scenario = showcaseScenarios.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown showcase scenario: ${id}`);
  const composition = composeShowcase(scenario, store.getState(), dataPort);
  proof.beginPlan({
    intent: scenario.intent,
    semanticNeeds: scenario.needs.map((need) => need.kind),
    contracts: composition.contracts,
    datasets: [...new Set(scenario.needs.map((need) => need.datasetId))],
    relationships: composition.relationships,
    operations: composition.operations.map((operation) => operation.type),
    source: "direct",
  });
  const started = performance.now();
  const result = applyDirect([...composition.operations]);
  proof.completePlan(performance.now() - started);
  return result;
}
export function investigate() {
  return applyDirect([
    ...store
      .getState()
      .order.filter((id) => id !== "baseline")
      .map((id) => ({ type: "remove" as const, id })),
    {
      type: "mount",
      node: {
        id: "ranking",
        component: "Ranking",
        datasetId: "models",
        metric: "outputPrice",
        direction: "asc",
        title: "Lowest output-token pricing",
        limit: 8,
      },
    },
    {
      type: "mount",
      node: {
        id: "detail",
        component: "Detail",
        datasetId: "models",
        title: "Selected model",
      },
    },
    {
      type: "mount",
      node: {
        id: "organization",
        component: "Detail",
        datasetId: "organizations",
        title: "Related organization",
      },
    },
    {
      type: "mount",
      node: {
        id: "comparison",
        component: "Comparison",
        datasetId: "models",
        metric: "inputPrice",
        title: "Input pricing comparison",
      },
    },
    {
      type: "connect",
      binding: {
        id: "model-selection",
        source: "ranking",
        target: "detail",
        entity: "Model",
      },
    },
    {
      type: "connect",
      binding: {
        id: "model-organization",
        source: "detail",
        target: "organization",
        entity: "Organization",
        relationship: "organization",
      },
    },
  ]);
}
export function resetOverview() {
  return applyDirect([
    ...store.getState().order.map((id) => ({ type: "remove" as const, id })),
    ...overview.map((node) => ({ type: "mount" as const, node })),
  ]);
}
