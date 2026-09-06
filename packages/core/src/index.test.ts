import { describe, expect, it, vi } from "vitest";
import {
  aggregateMetric,
  compareMetricRecords,
  createWorkspace,
  defineDataset,
  formatMetric,
  type DataPort,
  type WorkspaceNode,
} from "./index";
const dataset = defineDataset({
  id: "branches",
  entity: "branch",
  label: "Branches",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Name" }],
  metrics: [
    {
      key: "rate",
      label: "Approval",
      format: "percent" as const,
      aggregation: "mean" as const,
    },
  ],
  timeFields: [],
});
const snapshot = {
  status: "ready" as const,
  records: [
    { id: "a", name: "East", rate: 0.4 },
    { id: "b", name: "West", rate: 0.8 },
  ],
};
const dataPort: DataPort = {
  listDatasets: () => [dataset],
  getDataset: (id) => (id === dataset.id ? dataset : undefined),
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
};
const ranking: WorkspaceNode = {
  id: "ranking",
  component: "Ranking",
  datasetId: "branches",
  metric: "rate",
};
const detail: WorkspaceNode = {
  id: "detail",
  component: "Detail",
  datasetId: "branches",
};
const metric: WorkspaceNode = {
  id: "metric",
  component: "Metric",
  datasetId: "branches",
  metric: "rate",
};
const makeStore = () =>
  createWorkspace({
    dataPort,
    nodes: [ranking, detail, metric],
    bindings: [
      {
        id: "selection",
        source: "ranking",
        target: "detail",
        entity: "branch",
      },
    ],
  });
describe("semantic contracts", () => {
  it("never invents USD for a directly formatted currency metric", () => {
    expect(() => formatMetric(12, { key: "amount", label: "Amount", format: "currency", aggregation: "sum" })).toThrow("currency code");
  });
  it("orders missing and non-finite measures last in both directions without inventing zero", () => {
    const records = [
      { rate: null },
      { rate: 0.8 },
      { rate: Number.NaN },
      { rate: 0.2 },
      { rate: Infinity },
    ];
    expect(
      [...records]
        .sort((a, b) => compareMetricRecords(a, b, "rate"))
        .map((record) => record.rate),
    ).toEqual([0.2, 0.8, null, Number.NaN, Infinity]);
    expect(
      [...records]
        .sort((a, b) => compareMetricRecords(a, b, "rate", "desc"))
        .map((record) => record.rate),
    ).toEqual([0.8, 0.2, null, Number.NaN, Infinity]);
    expect(compareMetricRecords({ rate: 1 }, { rate: 1 }, "rate")).toBe(0);
  });
  it("rejects duplicate semantic field keys", () =>
    expect(() =>
      defineDataset({
        ...dataset,
        dimensions: [{ key: "rate", label: "Rate" }],
      }),
    ).toThrow());
  it("preserves explicit aggregation and formatting meaning", () => {
    expect(aggregateMetric(snapshot.records, dataset.metrics[0]!)).toBeCloseTo(
      0.6,
    );
    expect(formatMetric(0.6, dataset.metrics[0]!)).toBe("60%");
    expect(aggregateMetric([], dataset.metrics[0]!)).toBeNull();
    expect(
      aggregateMetric(snapshot.records, {
        ...dataset.metrics[0]!,
        aggregation: "none",
      }),
    ).toBeNull();
  });
});
describe("workspace operations", () => {
  it("clears selection when a source switches datasets after explicitly disconnecting its old binding", () => {
    const alternate = { ...dataset, id: "alternate" };
    const port: DataPort = {
      ...dataPort,
      listDatasets: () => [dataset, alternate],
      getDataset: (id) =>
        id === "alternate" ? alternate : dataPort.getDataset(id),
      getSnapshot: (id) =>
        id === "alternate"
          ? {
              status: "ready",
              records: [{ id: "c", name: "New branch", rate: 0.7 }],
            }
          : snapshot,
    };
    const store = createWorkspace({
      dataPort: port,
      nodes: [ranking, detail],
      bindings: [
        {
          id: "selection",
          source: "ranking",
          target: "detail",
          entity: "branch",
        },
      ],
    });
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "a" }],
    });
    const listener = vi.fn();
    store.subscribeSelection("detail", listener);
    expect(
      store.apply({
        version: 1,
        baseRevision: 1,
        operations: [
          {
            type: "configure",
            id: "ranking",
            patch: { datasetId: "alternate" },
          },
          { type: "disconnect", id: "selection" },
        ],
      }).ok,
    ).toBe(true);
    expect(store.getSelection("ranking")).toBeNull();
    expect(store.getSelection("detail")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("clears local selection when a component loses selection capability", () => {
    const store = createWorkspace({ dataPort, nodes: [ranking] });
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "a" }],
    });
    store.apply({
      version: 1,
      baseRevision: 1,
      operations: [
        { type: "configure", id: "ranking", patch: { component: "Metric" } },
      ],
    });
    expect(store.getSelection("ranking")).toBeNull();
  });
  it("updates one node with structural sharing and fine-grained notifications", () => {
    const store = makeStore(),
      before = store.getState();
    const unrelated = vi.fn(),
      changed = vi.fn(),
      order = vi.fn();
    store.subscribeNode("metric", unrelated);
    store.subscribeNode("ranking", changed);
    store.subscribeOrder(order);
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          { type: "configure", id: "ranking", patch: { direction: "asc" } },
        ],
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(store.getState().nodes.metric).toBe(before.nodes.metric);
    expect(store.getState().order).toBe(before.order);
    expect(unrelated).not.toHaveBeenCalled();
    expect(order).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("routes typed selection without notifying unrelated nodes and cleans subscriptions", () => {
    const store = makeStore(),
      detailChanged = vi.fn(),
      unrelated = vi.fn();
    const unsubscribe = store.subscribeSelection("detail", detailChanged);
    store.subscribeNode("metric", unrelated);
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "a" }],
    });
    expect(store.getSelection("detail")).toBe("a");
    expect(detailChanged).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
    unsubscribe();
    store.apply({
      version: 1,
      baseRevision: 1,
      operations: [{ type: "select", id: "ranking", recordId: "b" }],
    });
    expect(detailChanged).toHaveBeenCalledTimes(1);
  });
  it("rolls back a whole patch on invalid field and rejects stale revisions", () => {
    const store = makeStore(),
      before = store.getState();
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          { type: "remove", id: "metric" },
          { type: "configure", id: "ranking", patch: { metric: "missing" } },
        ],
      }).ok,
    ).toBe(false);
    expect(store.getState()).toBe(before);
    expect(
      store.apply({
        version: 1,
        baseRevision: 7,
        operations: [{ type: "remove", id: "metric" }],
      }).ok,
    ).toBe(false);
  });
  it("rejects invalid identities and incompatible semantic bindings", () => {
    const store = makeStore();
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "select", id: "ranking", recordId: "missing" }],
      }).ok,
    ).toBe(false);
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          { type: "disconnect", id: "selection" },
          {
            type: "connect",
            binding: {
              id: "bad",
              source: "ranking",
              target: "detail",
              entity: "customer",
            },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "mount", node: { ...ranking, id: "__proto__" } }],
      }).ok,
    ).toBe(false);
  });
  it("cleans relationships and inherited selections when a source is removed", () => {
    const store = makeStore();
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "a" }],
    });
    store.apply({
      version: 1,
      baseRevision: 1,
      operations: [{ type: "remove", id: "ranking" }],
    });
    expect(store.getSelection("detail")).toBeNull();
    expect(store.getState().bindings).toEqual({});
  });
  it("rejects binding cycles and invalid reconfiguration of a connected source atomically", () => {
    const store = makeStore();
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          { type: "configure", id: "ranking", patch: { component: "Metric" } },
        ],
      }).ok,
    ).toBe(false);
    const explorers = createWorkspace({
      dataPort,
      nodes: [
        { ...ranking, component: "Explorer" },
        { ...ranking, id: "other", component: "Explorer" },
      ],
    });
    expect(
      explorers.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "connect",
            binding: {
              id: "a",
              source: "ranking",
              target: "other",
              entity: "branch",
            },
          },
          {
            type: "connect",
            binding: {
              id: "b",
              source: "other",
              target: "ranking",
              entity: "branch",
            },
          },
        ],
      }).ok,
    ).toBe(false);
  });
});
