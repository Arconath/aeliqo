import { describe, expect, it, vi } from "vitest";
import {
  createWorkspace,
  createCapabilityDispatcher,
  defineDataset,
  filterRecords,
  formatMetric,
  capabilityContracts,
  type DataPort,
  type CapabilityEvent,
  type Filter,
} from "./index";
const orgs = defineDataset({
  id: "organizations",
  entity: "Organization",
  label: "Organizations",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Name" }],
  metrics: [],
  timeFields: [],
});
const models = defineDataset({
  id: "models",
  entity: "Model",
  label: "Models",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Name" },
    { key: "organizationId", label: "Organization" },
  ],
  metrics: [
    {
      key: "price",
      label: "Price",
      format: "currency" as const,
      unit: "USD",
      aggregation: "mean" as const,
      goal: "minimize" as const,
    },
    {
      key: "score",
      label: "Score",
      format: "percent" as const,
      aggregation: "mean" as const,
      goal: "maximize" as const,
    },
    {
      key: "tools",
      label: "Tools",
      format: "percent" as const,
      aggregation: "mean" as const,
    },
  ],
  timeFields: [],
  relationships: [
    {
      id: "organization",
      field: "organizationId",
      targetDatasetId: "organizations",
    },
  ],
});
const pricing = defineDataset({
  id: "pricing",
  entity: "Pricing",
  label: "Pricing",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Name" },
    { key: "modelId", label: "Model" },
  ],
  metrics: [{ key: "price", label: "Price", aggregation: "mean" as const }],
  timeFields: [],
  relationships: [{ id: "model", field: "modelId", targetDatasetId: "models" }],
});
const records = {
  organizations: [{ id: "o", name: "Lab" }],
  models: [
    {
      id: "m",
      name: "Small",
      organizationId: "o",
      price: 0.15,
      score: 0.7,
      tools: 1,
    },
    {
      id: "n",
      name: "Large",
      organizationId: "o",
      price: 2,
      score: 0.9,
      tools: 0,
    },
  ],
  pricing: [{ id: "p", name: "Standard", modelId: "m", price: 0.15 }],
};
const port: DataPort = {
  listDatasets: () => [orgs, models, pricing],
  getDataset: (id) =>
    [orgs, models, pricing].find((dataset) => dataset.id === id),
  getSnapshot: (id) => ({
    status: "ready",
    records: records[id as keyof typeof records],
  }),
  subscribe: () => () => {},
};
const store = () =>
  createWorkspace({
    dataPort: port,
    nodes: [
      {
        id: "ranking",
        datasetId: "pricing",
        component: "Ranking",
        metric: "price",
      },
      { id: "model", datasetId: "models", component: "Detail" },
      { id: "org", datasetId: "organizations", component: "Detail" },
    ],
  });
describe("semantic relationships", () => {
  it("clears a selected record excluded by a newly configured filter and protects nested filter snapshots", () => {
    const workspace = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "ranking",
          datasetId: "models",
          component: "Ranking",
          metric: "price",
        },
        { id: "detail", datasetId: "models", component: "Detail" },
      ],
      bindings: [
        { id: "a", source: "ranking", target: "detail", entity: "Model" },
      ],
    });
    workspace.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "n" }],
    });
    const listener = vi.fn();
    workspace.subscribeSelection("detail", listener);
    const filters: Filter[] = [{ field: "price", operator: "lt", value: 1 }];
    workspace.apply({
      version: 1,
      baseRevision: 1,
      operations: [{ type: "configure", id: "ranking", patch: { filters } }],
    });
    expect(workspace.getSelection("ranking")).toBeNull();
    expect(workspace.getSelection("detail")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    filters.splice(0, 1);
    expect(workspace.getNode("ranking")?.filters).toHaveLength(1);
    expect(Object.isFrozen(workspace.getNode("ranking")?.filters?.[0])).toBe(
      true,
    );
  });
  it("resolves foreign keys through chained Detail selections and cleans removal", () => {
    const workspace = store();
    const listener = vi.fn();
    workspace.subscribeSelection("org", listener);
    const result = workspace.apply({
      version: 1,
      baseRevision: 0,
      operations: [
        {
          type: "connect",
          binding: {
            id: "a",
            source: "ranking",
            target: "model",
            entity: "Model",
            relationship: "model",
          },
        },
        {
          type: "connect",
          binding: {
            id: "b",
            source: "model",
            target: "org",
            entity: "Organization",
            relationship: "organization",
          },
        },
        { type: "select", id: "ranking", recordId: "p" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(workspace.getSelection("model")).toBe("m");
    expect(workspace.getSelection("org")).toBe("o");
    expect(listener).toHaveBeenCalledTimes(1);
    workspace.apply({
      version: 1,
      baseRevision: 1,
      operations: [{ type: "remove", id: "model" }],
    });
    expect(workspace.getSelection("org")).toBeNull();
  });
  it("rejects undeclared cross-entity links atomically", () => {
    const workspace = store();
    expect(
      workspace.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "connect",
            binding: {
              id: "a",
              source: "ranking",
              target: "org",
              entity: "Organization",
              relationship: "invented",
            },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(workspace.getState().revision).toBe(0);
  });
  it("keeps decimal pricing and filters typed fields", () => {
    expect(formatMetric(0.15, models.metrics[0]!)).toBe("$0.15");
    expect(
      filterRecords(records.models, [
        { field: "price", operator: "lt", value: 1 },
      ]),
    ).toEqual([records.models[0]]);
    expect(
      filterRecords(records.models, [
        { field: "name", operator: "in", value: ["Large"] },
      ]),
    ).toEqual([records.models[1]]);
  });
});
describe("shared capability dispatcher", () => {
  it("validates rich semantic primitives and fans one selection out to compatible consumers", () => {
    const workspace = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "source",
          component: "Ranking",
          datasetId: "models",
          metric: "price",
        },
        {
          id: "scatter",
          component: "Scatter",
          datasetId: "models",
          xMetric: "price",
          metric: "score",
        },
        {
          id: "matrix",
          component: "Matrix",
          datasetId: "models",
          columns: ["tools"],
        },
        {
          id: "graph",
          component: "Relationship",
          datasetId: "models",
          relationship: "organization",
        },
        { id: "detail", component: "Detail", datasetId: "models" },
      ],
      bindings: [
        {
          id: "to-scatter",
          source: "source",
          target: "scatter",
          entity: "Model",
        },
        {
          id: "to-matrix",
          source: "source",
          target: "matrix",
          entity: "Model",
        },
        { id: "to-graph", source: "source", target: "graph", entity: "Model" },
        {
          id: "to-detail",
          source: "source",
          target: "detail",
          entity: "Model",
        },
      ],
    });
    const listeners = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    ["scatter", "matrix", "graph", "detail"].forEach((id, index) =>
      workspace.subscribeSelection(id, listeners[index]!),
    );
    expect(
      workspace.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "select", id: "source", recordId: "m" }],
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      ["scatter", "matrix", "graph", "detail"].map((id) =>
        workspace.getSelection(id),
      ),
    ).toEqual(["m", "m", "m", "m"]);
    expect(
      listeners.every((listener) => listener.mock.calls.length === 1),
    ).toBe(true);
    expect(
      workspace.apply({
        version: 1,
        baseRevision: 1,
        operations: [
          {
            type: "mount",
            node: {
              id: "bad",
              component: "Scatter",
              datasetId: "models",
              metric: "score",
            },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(workspace.getState().revision).toBe(1);
  });
  it("supports semantic columns and incremental layout with immutable configuration", () => {
    const workspace = store();
    const dispatcher = createCapabilityDispatcher(workspace);
    const unchanged = workspace.getNode("org");
    const listener = vi.fn();
    workspace.subscribeNode("org", listener);
    const columns = ["name", "organizationId"];
    dispatcher.dispatch("workspace_apply", {
      version: 1,
      baseRevision: 0,
      operations: [
        {
          type: "configure",
          id: "model",
          patch: {
            component: "Table",
            columns,
            span: 8,
            height: 400,
            density: "compact",
            limit: 1000,
          },
        },
        { type: "move", id: "model", index: 0 },
      ],
    });
    columns.pop();
    expect(workspace.getNode("model")?.columns).toEqual([
      "name",
      "organizationId",
    ]);
    expect(workspace.getState().order[0]).toBe("model");
    expect(workspace.getNode("org")).toBe(unchanged);
    expect(listener).not.toHaveBeenCalled();
    expect(() =>
      dispatcher.dispatch("workspace_apply", {
        version: 1,
        baseRevision: 1,
        operations: [
          { type: "configure", id: "model", patch: { columns: ["invented"] } },
        ],
      }),
    ).toThrow("Unknown column");
    expect(() =>
      dispatcher.dispatch("workspace_apply", {
        version: 1,
        baseRevision: 1,
        operations: [{ type: "move", id: "org", index: 99 }],
      }),
    ).toThrow("Invalid move index");
    expect(() =>
      dispatcher.dispatch("workspace_apply", {
        version: 1,
        baseRevision: 1,
        operations: [{ type: "configure", id: "org", patch: { span: 13 } }],
      }),
    ).toThrow();
    expect(workspace.getState().revision).toBe(1);
    dispatcher.dispatch("workspace_apply", {
      version: 1,
      baseRevision: 1,
      operations: [
        {
          type: "configure",
          id: "model",
          patch: {},
          unset: ["columns", "span"],
        },
      ],
    });
    expect(workspace.getNode("model")?.columns).toBeUndefined();
    expect(workspace.getNode("model")?.span).toBeUndefined();
  });
  it("discovers multiple independent keywords instead of matching an entire phrase", () => {
    const result = createCapabilityDispatcher(store()).dispatch(
      "catalog_search",
      { query: "models pricing ranking detail" },
    );
    expect(result.datasets.some((dataset) => dataset.id === "models")).toBe(
      true,
    );
    expect(
      result.components.some((component) => component.component === "Detail"),
    ).toBe(true);
  });
  it("returns typed, advisory suggestions only for a known dataset and declared task", () => {
    const result = createCapabilityDispatcher(store()).dispatch(
      "catalog_search",
      { query: "", datasetId: "models", task: "quality" },
    );
    expect(result.suggestions).toEqual([
      expect.objectContaining({
        node: expect.objectContaining({
          component: "QualityPanel",
          datasetId: "models",
        }),
        requiresAcceptance: true,
      }),
    ]);
    expect(() =>
      createCapabilityDispatcher(store()).dispatch("catalog_search", {
        query: "",
        datasetId: "missing",
        task: "quality",
      }),
    ).toThrow("known datasetId");
  });
  it("projects four strict schemas and executes a shared filtered query", () => {
    expect(capabilityContracts.map((contract) => contract.id)).toEqual([
      "workspace_inspect",
      "catalog_search",
      "data_query",
      "workspace_apply",
    ]);
    expect(
      capabilityContracts.every(
        (contract) => contract.jsonSchema.type === "object",
      ),
    ).toBe(true);
    const dispatcher = createCapabilityDispatcher(store());
    expect(
      dispatcher.dispatch("data_query", {
        datasetId: "models",
        metric: "price",
        filters: [{ field: "price", operator: "lt", value: 1 }],
      }),
    ).toMatchObject({ total: 1, records: [{ id: "m" }] });
    expect(() =>
      dispatcher.dispatch("data_query", {
        datasetId: "models",
        filters: [{ field: "invented", operator: "eq", value: "x" }],
      }),
    ).toThrow("Unknown filter");
    expect(() =>
      dispatcher.dispatch("workspace_apply", {
        version: 1,
        baseRevision: 0,
        operations: [
          { type: "configure", id: "ranking", patch: { css: "bad" } },
        ],
      }),
    ).toThrow();
  });
  it("replays successful mutations once, rejects conflicting request reuse, and records timings/source", () => {
    const workspace = store();
    const events: CapabilityEvent[] = [];
    let clock = 0;
    const dispatcher = createCapabilityDispatcher(workspace, {
      onEvent: (event) => events.push(event),
      now: () => ++clock,
    });
    const patch = {
      version: 1,
      baseRevision: 0,
      operations: [
        { type: "configure", id: "ranking", patch: { title: "Updated" } },
      ],
    };
    const context = { source: "BYOK" as const, requestId: "same" };
    expect(
      dispatcher.dispatch("workspace_apply", patch, context),
    ).toMatchObject({ ok: true, revision: 1 });
    expect(
      dispatcher.dispatch("workspace_apply", patch, context),
    ).toMatchObject({ ok: true, revision: 1 });
    expect(workspace.getState().revision).toBe(1);
    expect(events[0]).toMatchObject({
      source: "BYOK",
      validationMs: 1,
      executionMs: 1,
      ok: true,
    });
    expect(events[1]?.replayed).toBe(true);
    expect(() => dispatcher.dispatch("workspace_inspect", {}, context)).toThrow(
      "different input",
    );
    expect(events.at(-1)?.ok).toBe(false);
  });
  it("exposes direct operation observations with cleanup", () => {
    const workspace = store();
    const listener = vi.fn();
    const stop = workspace.subscribeOperations(listener);
    workspace.apply({
      version: 1,
      baseRevision: 0,
      operations: [{ type: "select", id: "ranking", recordId: "p" }],
    });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    workspace.apply({
      version: 1,
      baseRevision: 1,
      operations: [{ type: "select", id: "ranking", recordId: null }],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
