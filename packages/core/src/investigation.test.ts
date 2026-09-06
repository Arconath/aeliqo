import { describe, expect, it, vi } from "vitest";
import {
  createWorkspace,
  defineDataset,
  deriveSnapshot,
  filterInteractionSnapshot,
  suggestViews,
  patchSchema,
  restoreWorkspace,
  serializeWorkspace,
  type DataPort,
  type DataSnapshot,
} from "./index";

const dataset = defineDataset({
  id: "operations",
  entity: "Observation",
  label: "Operations",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Name" },
    { key: "team", label: "Team" },
  ],
  metrics: [
    { key: "requests", label: "Requests", aggregation: "sum" as const },
  ],
  timeFields: [{ key: "at", label: "At", temporal: "date" as const }],
});
const snapshot: DataSnapshot = {
  status: "ready",
  scope: "entire-dataset",
  totalCount: 3,
  records: [
    { id: "1", name: "API", team: null, requests: 10, at: "2026-09-01" },
    { id: "2", name: "Queue", team: "Unknown", requests: 20, at: "2026-09-02" },
    {
      id: "3",
      name: "Worker",
      team: "Platform",
      requests: 30,
      at: "2026-09-03",
    },
  ],
};
const port: DataPort = {
  listDatasets: () => [dataset],
  getDataset: (id) => (id === dataset.id ? dataset : undefined),
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
};
const nodes = [
  {
    id: "breakdown",
    component: "MetricBreakdown",
    datasetId: dataset.id,
    metric: "requests",
    dimension: "team",
  },
  {
    id: "trend",
    component: "Trend",
    datasetId: dataset.id,
    metric: "requests",
    timeField: "at",
  },
  {
    id: "records",
    component: "Table",
    datasetId: dataset.id,
    dimension: "team",
    timeField: "at",
  },
  {
    id: "quality",
    component: "QualityPanel",
    datasetId: dataset.id,
    dimension: "team",
    timeField: "at",
  },
  {
    id: "unrelated",
    component: "Metric",
    datasetId: dataset.id,
    metric: "requests",
  },
];
describe("linked investigations", () => {
  it("filters only explicitly linked records and source disclosure; keeps typed null distinct from clear", () => {
    const store = createWorkspace({
      dataPort: port,
      nodes,
      bindings: [
        {
          id: "group",
          source: "breakdown",
          target: "records",
          entity: dataset.entity,
          mode: "group",
        },
        {
          id: "range",
          source: "trend",
          target: "records",
          entity: dataset.entity,
          mode: "range",
        },
        {
          id: "quality-group",
          source: "breakdown",
          target: "quality",
          entity: dataset.entity,
          mode: "group",
        },
      ],
    });
    const changed = vi.fn(),
      unrelated = vi.fn();
    const stop = store.subscribeInputInteraction("records", "group", changed);
    store.subscribeInputInteraction("unrelated", "group", unrelated);
    const request = patchSchema.parse({
      version: 1,
      baseRevision: 0,
      operations: [
        {
          type: "interact",
          id: "breakdown",
          payload: {
            kind: "group",
            field: "team",
            value: null,
            valueType: "null",
          },
        },
      ],
    });
    expect(store.apply(request).ok).toBe(true);
    expect(store.getInputInteraction("breakdown", "group")).toBeNull();
    expect(
      filterInteractionSnapshot(dataset, snapshot, [
        store.getInputInteraction("records", "group"),
      ]).records.map((r) => r.id),
    ).toEqual(["1"]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
    const restored = restoreWorkspace(serializeWorkspace(store), {
      dataPort: port,
    });
    expect(restored.getInputInteraction("quality", "group")).toEqual({
      kind: "group",
      field: "team",
      value: null,
      valueType: "null",
    });
    expect(
      store.apply({
        version: 1,
        baseRevision: 1,
        operations: [
          {
            type: "interact",
            id: "breakdown",
            payload: { kind: "group", field: "team", value: null },
          },
        ],
      }).ok,
    ).toBe(true);
    expect(
      filterInteractionSnapshot(dataset, snapshot, [
        store.getInputInteraction("records", "group"),
      ]),
    ).toBe(snapshot);
    stop();
  });
  it("intersects temporal and categorical inputs while preserving partial population claims", () => {
    const partial = {
      ...snapshot,
      scope: "loaded-page" as const,
      totalCount: 100,
    };
    const result = filterInteractionSnapshot(dataset, partial, [
      {
        kind: "range",
        field: "at",
        range: { start: Date.UTC(2026, 8, 2), end: Date.UTC(2026, 8, 3) },
      },
      { kind: "group", field: "team", value: "Unknown", valueType: "string" },
    ]);
    expect(result.records.map((record) => record.id)).toEqual(["2"]);
    expect(result.scope).toBe("loaded-page");
    expect(result.totalCount).toBeUndefined();
    expect(
      deriveSnapshot({ ...partial, scope: undefined }, []).scope,
    ).toBeUndefined();
    expect(
      deriveSnapshot(snapshot, snapshot.records.slice(0, 1)),
    ).toMatchObject({ scope: "filtered-result", totalCount: 1 });
  });
  it("rejects contradictory typed category values atomically", () => {
    const store = createWorkspace({ dataPort: port, nodes });
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "interact",
            id: "breakdown",
            payload: {
              kind: "group",
              field: "team",
              value: 1,
              valueType: "string",
            },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(store.getState().revision).toBe(0);
  });
  it("suggests only compatible views for the declared task without changing state", () => {
    const store = createWorkspace({ dataPort: port, nodes });
    const before = store.getState();
    const proposals = suggestViews(dataset, "breakdown", store.registry);
    expect(proposals[0]).toMatchObject({
      node: { component: "MetricBreakdown", metric: "requests" },
      requiresAcceptance: true,
    });
    expect(store.getState()).toBe(before);
    const noAdditive = {
      ...dataset,
      metrics: dataset.metrics.map((metric) => ({
        ...metric,
        aggregation: "mean" as const,
      })),
    };
    expect(suggestViews(noAdditive, "breakdown")).toEqual([]);
    expect(suggestViews({ ...dataset, timeFields: [] }, "trend")).toEqual([]);
    expect(suggestViews(dataset, "events")).toEqual([]);
    expect(
      suggestViews({ ...dataset, semanticTags: ["event"] }, "events").map(
        (item) => item.node.component,
      ),
    ).toEqual(["EventTimeline"]);
    expect(suggestViews(dataset, "relationships")).toEqual([]);
  });
});
