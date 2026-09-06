import { describe, expect, it } from "vitest";
import { createCapabilityDispatcher, createWorkspace, defineDataset, serializeWorkspace, type DataPort } from "./index";

const dataset = defineDataset({
  id: "offers", entity: "Offer", label: "Offers", identity: "id", labelField: "name",
  dimensions: [{ key: "name", label: "Name" }],
  metrics: [
    { key: "price", label: "Price", aggregation: "none", format: "currency", unit: "USD" },
    { key: "quality", label: "Quality", aggregation: "none", format: "percent" },
  ], timeFields: [],
} as const);
const dataPort: DataPort = {
  listDatasets: () => [dataset], getDataset: id => id === dataset.id ? dataset : undefined,
  getSnapshot: () => ({ status: "ready", records: [{ id: "a", name: "Alpha", price: 10, quality: .8 }, { id: "b", name: "Beta", price: 12, quality: .9 }, { id: "c", name: "Gamma", price: null, quality: .7 }] }),
  subscribe: () => () => {},
};

describe("Comparison contract", () => {
  it("accepts bounded identities and multiple declared metrics through the shared wire grammar", () => {
    const store = createWorkspace({ dataPort });
    const dispatcher = createCapabilityDispatcher(store);
    const receipt = dispatcher.dispatch("workspace_apply", { version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "choice", component: "Comparison", datasetId: "offers", metric: "price", columns: ["price", "quality"], compareIds: ["a", "b"] } }] }, { source: "MCP", requestId: "comparison-1" });
    expect(receipt).toMatchObject({ ok: true, operation: "committed", changedNodeIds: ["choice"] });
    expect(store.getNode("choice")?.compareIds).toEqual(["a", "b"]);
    expect(serializeWorkspace(store)).toContain('"compareIds":["a","b"]');
  });

  it("rejects unknown, duplicate, undersized, oversized and non-Comparison identities atomically", () => {
    const bad = [["a", "missing"], ["a", "a"], ["a"], ["a", "b", "c", "d", "e", "f", "g", "h", "i"]];
    for (const compareIds of bad) {
      const store = createWorkspace({ dataPort });
      expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "bad", component: "Comparison", datasetId: "offers", metric: "price", compareIds } }] }).ok).toBe(false);
      expect(store.getState().revision).toBe(0);
    }
    const store = createWorkspace({ dataPort });
    expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "bad", component: "Table", datasetId: "offers", compareIds: ["a", "b"] } }] }).ok).toBe(false);
  });
});
