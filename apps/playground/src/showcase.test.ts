import { describe, expect, it, vi } from "vitest";
import { createWorkspace, type WorkspaceNode } from "@aeliqo/core";
import { dataPort } from "./data";
import { composeShowcase, showcaseScenarios } from "./showcase";

const initial: WorkspaceNode[] = [
  { id: "baseline", component: "Metric", datasetId: "models", metric: "outputPrice" },
  { id: "smart-exploration", component: "Explorer", datasetId: "models", metric: "outputPrice" },
];

describe("generic Showcase composition", () => {
  it("derives trusted components from semantic needs and reuses compatible blocks", () => {
    const store = createWorkspace({ dataPort, nodes: initial });
    const baseline = store.getNode("baseline");
    const baselineListener = vi.fn();
    store.subscribeNode("baseline", baselineListener);
    const price = showcaseScenarios.find((item) => item.id === "price-landscape")!;
    const first = composeShowcase(price, store.getState(), dataPort);
    expect(first.contracts).toEqual([
      { need: "distribution", component: "Distribution" },
      { need: "ranking", component: "Ranking" },
      { need: "inspection", component: "Detail" },
    ]);
    expect(store.apply({ version: 1, baseRevision: 0, operations: first.operations }).ok).toBe(true);
    expect(store.getSelection("smart-inspection")).toBe("gemini-3-5-flash-lite");
    expect(store.getNode("baseline")).toBe(baseline);
    expect(baselineListener).not.toHaveBeenCalled();

    const ranking = store.getNode("smart-ranking");
    const nextScenario = showcaseScenarios.find((item) => item.id === "large-context")!;
    const next = composeShowcase(nextScenario, store.getState(), dataPort);
    expect(next.operations.some((operation) => operation.type === "configure" && operation.id === "smart-ranking")).toBe(true);
    expect(next.operations.some((operation) => operation.type === "mount" && operation.node.id === "smart-ranking")).toBe(false);
    expect(store.apply({ version: 1, baseRevision: 1, operations: next.operations }).ok).toBe(true);
    expect(store.getNode("smart-ranking")).not.toBe(ranking);
    expect(store.getNode("baseline")).toBe(baseline);
    expect(baselineListener).not.toHaveBeenCalled();
  });

  it("keeps scenario descriptions free of executable UI payloads", () => {
    const serialized = JSON.stringify(showcaseScenarios);
    expect(serialized).not.toMatch(/<\/?[A-Za-z]|className|function\s*\(|=>|javascript:/i);
  });
});
