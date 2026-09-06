import { describe, expect, it, vi } from "vitest";
import {
  createWorkspace,
  defineDataset,
  restoreWorkspace,
  serializeWorkspace,
  type DataPort,
  type Operation,
} from "./index";

const dataset = defineDataset({
  id: "sales",
  entity: "Sale",
  label: "Sales",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Name" }, { key: "region", label: "Region" }],
  metrics: [{ key: "amount", label: "Amount", aggregation: "sum" as const }],
  timeFields: [
    { key: "observedAt", label: "Observed", temporal: "date" as const },
    { key: "createdAt", label: "Created", temporal: "date" as const },
  ],
});
const alternateDataset = defineDataset({
  ...dataset,
  id: "support-sales",
  label: "Support sales",
});
const port: DataPort = {
  listDatasets: () => [dataset, alternateDataset],
  getDataset: (id) =>
    id === dataset.id
      ? dataset
      : id === alternateDataset.id
        ? alternateDataset
        : undefined,
  getSnapshot: (id) => ({
    status: "ready",
    records:
      id === alternateDataset.id
        ? [{ id: "c", name: "Gamma", region: "East", amount: 30, observedAt: "2026-08-03", createdAt: "2026-07-03" }]
        : [
            { id: "a", name: "Alpha", region: "East", amount: 10, observedAt: "2026-08-01", createdAt: "2026-07-01" },
            { id: "b", name: "Beta", region: "West", amount: 20, observedAt: "2026-08-02", createdAt: "2026-07-02" },
          ],
  }),
  subscribe: () => () => {},
};
function fixture() {
  const store = createWorkspace({
    dataPort: port,
    nodes: [
      { id: "filter", component: "Filter", datasetId: "sales" },
      { id: "table", component: "Table", datasetId: "sales" },
      { id: "detail", component: "Detail", datasetId: "sales" },
    ],
  });
  const apply = (...operations: Operation[]) =>
    store.apply({
      version: 1,
      baseRevision: store.getState().revision,
      operations,
    });
  return { store, apply };
}
describe("human workspace controls", () => {
  it("protects human pins from agent removal, edits, moves and stale requests", () => {
    const { store, apply } = fixture();
    expect(apply({ type: "pin", id: "table", pinned: true }).ok).toBe(true);
    for (const operation of [
      { type: "remove", id: "table" },
      { type: "move", id: "table", index: 0 },
      { type: "configure", id: "table", patch: { title: "changed" } },
      { type: "pin", id: "table", pinned: false },
      { type: "undo" },
    ] as Operation[]) {
      expect(
        store.apply(
          { version: 1, baseRevision: 1, operations: [operation] },
          { actor: "agent" },
        ).ok,
      ).toBe(false);
    }
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "remove", id: "table" }],
      }).ok,
    ).toBe(false);
    expect(store.getNode("table")?.pinned).toBe(true);
  });
  it("undoes atomically with increasing revisions, bounded history and redo invalidation", () => {
    const { store, apply } = fixture();
    expect(store.canUndo()).toBe(false);
    apply(
      { type: "configure", id: "table", patch: { title: "New title" } },
      { type: "move", id: "table", index: 0 },
    );
    expect(apply({ type: "undo" })).toEqual({ ok: true, revision: 2 });
    expect(store.getNode("table")?.title).toBeUndefined();
    expect(store.getState().order[0]).toBe("filter");
    expect(apply({ type: "redo" })).toEqual({ ok: true, revision: 3 });
    apply({ type: "undo" });
    apply({ type: "pin", id: "table", pinned: true });
    expect(store.canRedo()).toBe(false);
    for (let i = 0; i < 60; i++)
      apply({ type: "configure", id: "table", patch: { title: String(i) } });
    for (let i = 0; i < 50; i++) expect(apply({ type: "undo" }).ok).toBe(true);
    expect(store.canUndo()).toBe(false);
  });
  it("propagates explicit filters without replacing local filters or treating them as selection", () => {
    const { store, apply } = fixture();
    apply(
      {
        type: "connect",
        binding: {
          id: "f",
          mode: "filter",
          source: "filter",
          target: "table",
          entity: "Sale",
        },
      },
      {
        type: "connect",
        binding: { id: "s", source: "table", target: "detail", entity: "Sale" },
      },
      { type: "select", id: "table", recordId: "a" },
    );
    const listener = vi.fn(),
      stop = store.subscribeFilters("table", listener);
    const unrelated = store.getNode("detail");
    apply({
      type: "configure",
      id: "filter",
      patch: { filters: [{ field: "amount", operator: "gt", value: 15 }] },
    });
    expect(store.getFilters("table")).toEqual([
      { field: "amount", operator: "gt", value: 15 },
    ]);
    expect(store.getFilters("table")).toBe(store.getFilters("table"));
    expect(store.getNode("table")?.filters).toBeUndefined();
    expect(store.getNode("detail")).toBe(unrelated);
    expect(store.getSelection("detail")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    apply({ type: "configure", id: "filter", patch: { filters: [] } });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("round-trips only validated presentation state and rejects executable or unknown imports", () => {
    const { store, apply } = fixture();
    apply(
      { type: "pin", id: "table", pinned: true },
      { type: "configure", id: "table", patch: { density: "compact" } },
    );
    const saved = serializeWorkspace(store);
    expect(saved).not.toContain("Alpha");
    expect(saved).not.toContain("records");
    expect(saved).not.toContain("baseRevision");
    const restored = restoreWorkspace(saved, { dataPort: port });
    expect(restored.getNode("table")).toEqual(store.getNode("table"));
    expect(restored.canUndo()).toBe(false);
    expect(() =>
      restoreWorkspace('{"version":2,"operations":[]}', { dataPort: port }),
    ).toThrow();
    expect(() =>
      restoreWorkspace('{"version":1,"operations":[{"type":"undo"}]}', {
        dataPort: port,
      }),
    ).toThrow();
    expect(() =>
      restoreWorkspace(saved.replace('"Table"', '"Executable"'), {
        dataPort: port,
      }),
    ).toThrow();
  });
  it("round-trips a validated typed interaction and its compatible link", () => {
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "events",
          component: "EventTimeline",
          datasetId: "sales",
          timeField: "observedAt",
        },
        {
          id: "trend",
          component: "Trend",
          datasetId: "sales",
          metric: "amount",
          timeField: "observedAt",
        },
      ],
      bindings: [
        {
          id: "window",
          mode: "range",
          source: "events",
          target: "trend",
          entity: "Sale",
        },
      ],
    });
    const range = { start: Date.UTC(2026, 7, 1), end: Date.UTC(2026, 7, 2) };
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "interact",
            id: "events",
            payload: { kind: "range", field: "observedAt", range },
          },
        ],
      }).ok,
    ).toBe(true);
    const restored = restoreWorkspace(serializeWorkspace(store), {
      dataPort: port,
    });
    expect(restored.getInteraction("trend", "range")).toEqual({
      kind: "range",
      field: "observedAt",
      range,
    });
  });
  it("clears typed interactions when configure changes their semantic field", () => {
    const store = createWorkspace({ dataPort: port, nodes: [
      { id: "trend", component: "Trend", datasetId: "sales", metric: "amount", timeField: "observedAt" },
      { id: "breakdown", component: "MetricBreakdown", datasetId: "sales", metric: "amount", dimension: "region" },
    ] });
    expect(store.apply({ version: 1, baseRevision: 0, operations: [
      { type: "interact", id: "trend", payload: { kind: "range", field: "observedAt", range: { start: 1, end: 2 } } },
      { type: "interact", id: "breakdown", payload: { kind: "group", field: "region", value: "East" } },
    ] }).ok).toBe(true);
    expect(store.apply({ version: 1, baseRevision: 1, operations: [
      { type: "configure", id: "trend", patch: { timeField: "createdAt" } },
      { type: "configure", id: "breakdown", patch: { dimension: "name" } },
    ] }).ok).toBe(true);
    expect(store.getInteraction("trend", "range")).toBeNull();
    expect(store.getInteraction("breakdown", "group")).toBeNull();
    const restored = restoreWorkspace(serializeWorkspace(store), { dataPort: port });
    expect(restored.getInteraction("trend", "range")).toBeNull();
    expect(restored.getInteraction("breakdown", "group")).toBeNull();
  });
  it("clears typed interactions when configure switches to another dataset with matching fields", () => {
    const store = createWorkspace({ dataPort: port, nodes: [
      { id: "trend", component: "Trend", datasetId: "sales", metric: "amount", timeField: "observedAt" },
      { id: "breakdown", component: "MetricBreakdown", datasetId: "sales", metric: "amount", dimension: "region" },
    ] });
    expect(store.apply({ version: 1, baseRevision: 0, operations: [
      { type: "interact", id: "trend", payload: { kind: "range", field: "observedAt", range: { start: 1, end: 2 } } },
      { type: "interact", id: "breakdown", payload: { kind: "group", field: "region", value: "East" } },
    ] }).ok).toBe(true);
    expect(store.apply({ version: 1, baseRevision: 1, operations: [
      { type: "configure", id: "trend", patch: { datasetId: "support-sales" } },
      { type: "configure", id: "breakdown", patch: { datasetId: "support-sales" } },
    ] }).ok).toBe(true);
    expect(store.getInteraction("trend", "range")).toBeNull();
    expect(store.getInteraction("breakdown", "group")).toBeNull();
  });
  it("rejects range and group links whose declared entity does not match the dataset", () => {
    const store = createWorkspace({ dataPort: port, nodes: [
      { id: "timeline", component: "EventTimeline", datasetId: "sales", timeField: "observedAt" },
      { id: "trend", component: "Trend", datasetId: "sales", metric: "amount", timeField: "observedAt" },
      { id: "source", component: "MetricBreakdown", datasetId: "sales", metric: "amount", dimension: "region" },
      { id: "target", component: "MetricBreakdown", datasetId: "sales", metric: "amount", dimension: "region" },
    ] });
    for (const binding of [
      { id: "range", mode: "range" as const, source: "timeline", target: "trend", entity: "WrongEntity" },
      { id: "group", mode: "group" as const, source: "source", target: "target", entity: "WrongEntity" },
    ]) {
      expect(store.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "connect", binding }],
      })).toMatchObject({ ok: false });
      expect(store.getState().revision).toBe(0);
    }
  });
});
