import { describe, expect, it, vi } from "vitest";
import { createWorkspace, defineDataset, restoreWorkspace, serializeWorkspace, type DataPort, type Operation } from "./index";

const dataset = defineDataset({ id: "sales", entity: "Sale", label: "Sales", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }], metrics: [{ key: "amount", label: "Amount", aggregation: "sum" as const }], timeFields: [] });
const port: DataPort = { listDatasets: () => [dataset], getDataset: id => id === dataset.id ? dataset : undefined, getSnapshot: () => ({ status: "ready", records: [{ id: "a", name: "Alpha", amount: 10 }, { id: "b", name: "Beta", amount: 20 }] }), subscribe: () => () => {} };
function fixture() {
  const store = createWorkspace({ dataPort: port, nodes: [{ id: "filter", component: "Filter", datasetId: "sales" }, { id: "table", component: "Table", datasetId: "sales" }, { id: "detail", component: "Detail", datasetId: "sales" }] });
  const apply = (...operations: Operation[]) => store.apply({ version: 1, baseRevision: store.getState().revision, operations });
  return { store, apply };
}
describe("human workspace controls", () => {
  it("protects human pins from agent removal, edits, moves and stale requests", () => {
    const { store, apply } = fixture();
    expect(apply({ type: "pin", id: "table", pinned: true }).ok).toBe(true);
    for (const operation of [{ type: "remove", id: "table" }, { type: "move", id: "table", index: 0 }, { type: "configure", id: "table", patch: { title: "changed" } }, { type: "pin", id: "table", pinned: false }, { type: "undo" }] as Operation[]) {
      expect(store.apply({ version: 1, baseRevision: 1, operations: [operation] }, { actor: "agent" }).ok).toBe(false);
    }
    expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: "remove", id: "table" }] }).ok).toBe(false);
    expect(store.getNode("table")?.pinned).toBe(true);
  });
  it("undoes atomically with increasing revisions, bounded history and redo invalidation", () => {
    const { store, apply } = fixture();
    expect(store.canUndo()).toBe(false);
    apply({ type: "configure", id: "table", patch: { title: "New title" } }, { type: "move", id: "table", index: 0 });
    expect(apply({ type: "undo" })).toEqual({ ok: true, revision: 2 });
    expect(store.getNode("table")?.title).toBeUndefined();
    expect(store.getState().order[0]).toBe("filter");
    expect(apply({ type: "redo" })).toEqual({ ok: true, revision: 3 });
    apply({ type: "undo" }); apply({ type: "pin", id: "table", pinned: true });
    expect(store.canRedo()).toBe(false);
    for (let i = 0; i < 60; i++) apply({ type: "configure", id: "table", patch: { title: String(i) } });
    for (let i = 0; i < 50; i++) expect(apply({ type: "undo" }).ok).toBe(true);
    expect(store.canUndo()).toBe(false);
  });
  it("propagates explicit filters without replacing local filters or treating them as selection", () => {
    const { store, apply } = fixture();
    apply({ type: "connect", binding: { id: "f", mode: "filter", source: "filter", target: "table", entity: "Sale" } }, { type: "connect", binding: { id: "s", source: "table", target: "detail", entity: "Sale" } }, { type: "select", id: "table", recordId: "a" });
    const listener = vi.fn(), stop = store.subscribeFilters("table", listener);
    const unrelated = store.getNode("detail");
    apply({ type: "configure", id: "filter", patch: { filters: [{ field: "amount", operator: "gt", value: 15 }] } });
    expect(store.getFilters("table")).toEqual([{ field: "amount", operator: "gt", value: 15 }]);
    expect(store.getFilters("table")).toBe(store.getFilters("table"));
    expect(store.getNode("table")?.filters).toBeUndefined();
    expect(store.getNode("detail")).toBe(unrelated);
    expect(store.getSelection("detail")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1); stop();
    apply({ type: "configure", id: "filter", patch: { filters: [] } });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("round-trips only validated presentation state and rejects executable or unknown imports", () => {
    const { store, apply } = fixture();
    apply({ type: "pin", id: "table", pinned: true }, { type: "configure", id: "table", patch: { density: "compact" } });
    const saved = serializeWorkspace(store);
    expect(saved).not.toContain("Alpha"); expect(saved).not.toContain("records"); expect(saved).not.toContain("baseRevision");
    const restored = restoreWorkspace(saved, { dataPort: port });
    expect(restored.getNode("table")).toEqual(store.getNode("table"));
    expect(restored.canUndo()).toBe(false);
    expect(() => restoreWorkspace('{"version":2,"operations":[]}', { dataPort: port })).toThrow();
    expect(() => restoreWorkspace('{"version":1,"operations":[{"type":"undo"}]}', { dataPort: port })).toThrow();
    expect(() => restoreWorkspace(saved.replace('"Table"', '"Executable"'), { dataPort: port })).toThrow();
  });
});
