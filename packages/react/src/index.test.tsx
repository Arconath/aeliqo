// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspace,
  defineDataset,
  type DataPort,
  type DataSnapshot,
} from "@aeliqo/core";
import {
  Explorer,
  Matrix,
  Ranking,
  Table,
  Trend,
  Workspace,
} from "./index";

afterEach(cleanup);
const dataset = defineDataset({
  id: "branches",
  entity: "Branch",
  label: "Branches",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Branch" },
    { key: "region", label: "Region" },
  ],
  metrics: [
    {
      key: "approval",
      label: "Approval rate",
      format: "percent",
      aggregation: "mean",
    },
  ],
  timeFields: [],
});

describe("rich semantic visualization primitives", () => {
  const providers = defineDataset({
    id: "providers",
    entity: "Provider",
    label: "Providers",
    identity: "id",
    labelField: "name",
    dimensions: [{ key: "name", label: "Provider" }],
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
      { key: "name", label: "Model" },
      { key: "providerId", label: "Provider identity" },
      { key: "provider", label: "Provider" },
    ],
    metrics: [
      { key: "price", label: "Price", aggregation: "mean", goal: "minimize" },
      { key: "score", label: "Score", aggregation: "mean", format: "percent", goal: "maximize", methodology: "One comparable fixture" },
      { key: "tools", label: "Tool use", aggregation: "mean", format: "percent" },
      { key: "vision", label: "Vision", aggregation: "mean", format: "percent" },
    ],
    timeFields: [],
    relationships: [{ id: "provider", field: "providerId", targetDatasetId: "providers" }],
  });
  const snapshots: Record<string, DataSnapshot> = {
    providers: { status: "ready", records: [{ id: "lab-a", name: "Lab A" }, { id: "lab-b", name: "Lab B" }] },
    models: {
      status: "ready",
      records: [
        { id: "a", name: "Alpha", providerId: "lab-a", provider: "Lab A", price: 1, score: 0.7, tools: 1, vision: 0 },
        { id: "b", name: "Beta", providerId: "lab-b", provider: "Lab B", price: 4, score: 0.95, tools: 1, vision: 1 },
        { id: "c", name: "Gamma", providerId: "lab-a", provider: "Lab A", price: 12, score: 0.6, tools: 0, vision: 1 },
      ],
    },
  };
  const port: DataPort = {
    listDatasets: () => [models, providers],
    getDataset: (id) => (id === "models" ? models : id === "providers" ? providers : undefined),
    getSnapshot: (id) => snapshots[id] ?? { status: "error", records: [], error: "missing" },
    subscribe: () => () => {},
  };

  it("renders four semantic views and propagates one selection to every compatible consumer", () => {
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        { id: "ranking", component: "Ranking", datasetId: "models", metric: "score", direction: "desc" },
        { id: "scatter", component: "Scatter", datasetId: "models", xMetric: "price", metric: "score", seriesBy: "provider" },
        { id: "matrix", component: "Matrix", datasetId: "models", columns: ["tools", "vision"] },
        { id: "relationship", component: "Relationship", datasetId: "models", relationship: "provider" },
        { id: "distribution", component: "Distribution", datasetId: "models", metric: "price" },
        { id: "detail", component: "Detail", datasetId: "models" },
      ],
      bindings: [
        { id: "scatter-link", source: "ranking", target: "scatter", entity: "Model" },
        { id: "matrix-link", source: "ranking", target: "matrix", entity: "Model" },
        { id: "relationship-link", source: "ranking", target: "relationship", entity: "Model" },
        { id: "detail-link", source: "ranking", target: "detail", entity: "Model" },
      ],
    });
    const view = render(<Workspace store={store} />);
    expect(screen.getByRole("img", { name: "Price versus Score" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Price distribution across 3 Model records" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Model to Provider relationship" })).toBeTruthy();
    const ranking = view.container.querySelector<HTMLElement>(
      '[data-node-id="ranking"]',
    );
    if (!ranking) throw new Error("missing ranking");
    fireEvent.click(within(ranking).getByRole("button", { name: /Alpha/ }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeTruthy();
    expect(view.container.querySelector('[data-node-id="scatter"] [data-selected="true"]')).toBeTruthy();
    expect(view.container.querySelector('[data-node-id="matrix"] tr[data-selected="true"]')).toBeTruthy();
    expect(view.container.querySelector('[data-node-id="relationship"] path[data-selected="true"]')).toBeTruthy();
  });

  it("changes Matrix label density deterministically and disconnects observation", () => {
    const disconnect = vi.fn();
    let resize: ((width: number) => void) | undefined;
    class Observer {
      constructor(callback: ResizeObserverCallback) {
        resize = (width) => callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      observe = vi.fn();
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const store = createWorkspace({ dataPort: port });
    const node = { id: "matrix", component: "Matrix" as const, datasetId: "models", columns: ["tools", "vision"] };
    const onAdaptation = vi.fn();
    const view = render(<Matrix store={store} node={node} onAdaptation={onAdaptation} />);
    act(() => resize?.(420));
    expect(view.container.querySelector("[data-adaptation]")?.getAttribute("data-adaptation")).toBe("compact-labels");
    expect(onAdaptation).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "compact-labels", width: 420 }));
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
function fixture() {
  let snapshot: DataSnapshot = {
    status: "ready",
    records: [
      { id: "a", name: "Central", region: "East", approval: 0.8 },
      { id: "b", name: "Harbor", region: "West", approval: 0.5 },
    ],
  };
  const listeners = new Set<() => void>();
  const port: DataPort = {
    listDatasets: () => [dataset],
    getDataset: () => dataset,
    getSnapshot: () => snapshot,
    subscribe: (_, listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const store = createWorkspace({
    dataPort: port,
    nodes: [
      {
        id: "ranking",
        component: "Ranking",
        datasetId: "branches",
        metric: "approval",
      },
      { id: "detail", component: "Detail", datasetId: "branches" },
      {
        id: "metric",
        component: "Metric",
        datasetId: "branches",
        metric: "approval",
      },
    ],
    bindings: [
      {
        id: "selection",
        source: "ranking",
        target: "detail",
        entity: "Branch",
      },
    ],
  });
  return {
    store,
    listeners,
    update: (next: DataSnapshot) => {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}
describe("semantic React components", () => {
  it("Table renders declared dimension columns and formatted metrics in requested order", () => {
    const { store } = fixture();
    render(
      <Table
        store={store}
        node={{
          id: "ranking",
          component: "Table",
          datasetId: "branches",
          columns: ["name", "region", "approval"],
        }}
      />,
    );
    expect(
      screen.getAllByRole("columnheader").map((item) => item.textContent),
    ).toEqual(["Branch", "Region", "Approval rate"]);
    expect(screen.getByText("East")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Central" }));
    expect(store.getSelection("detail")).toBe("a");
  });
  it("virtualizes 10000 rows and reaches the last record by keyboard without mounting all rows", () => {
    const { store, update } = fixture();
    update({
      status: "ready",
      records: Array.from({ length: 10000 }, (_, index) => ({
        id: `row-${index}`,
        name: `Record ${index}`,
        region: "East",
        approval: 0.5,
      })),
    });
    render(
      <Table
        store={store}
        node={{
          id: "ranking",
          component: "Table",
          datasetId: "branches",
          columns: ["name", "region"],
          height: 300,
          limit: 10000,
        }}
      />,
    );
    expect(screen.getAllByRole("button").length).toBeLessThan(30);
    expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe(
      "10001",
    );
    fireEvent.keyDown(screen.getByRole("region"), { key: "End" });
    expect(screen.getByRole("button", { name: "Record 9999" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("region"), { key: "Enter" });
    expect(store.getSelection("detail")).toBe("row-9999");
    expect(screen.getAllByRole("button").length).toBeLessThan(30);
    act(() =>
      update({
        status: "ready",
        records: Array.from({ length: 150 }, (_, index) => ({
          id: `row-${index}`,
          name: `Record ${index}`,
          region: "East",
          approval: 0.5,
        })),
      }),
    );
    fireEvent.keyDown(screen.getByRole("region"), { key: "Enter" });
    expect(store.getSelection("detail")).toBe("row-0");
    expect(screen.getByRole("region").scrollTop).toBe(0);
  });
  it("formats numeric metrics without an explicit format and preserves their units", () => {
    const numeric = defineDataset({
      ...dataset,
      metrics: [
        {
          key: "capacity",
          label: "Capacity",
          aggregation: "mean",
          unit: "tokens",
        },
      ],
    });
    const snapshot: DataSnapshot = {
      status: "ready",
      records: [{ id: "a", name: "Central", capacity: 1000 }],
    };
    const store = createWorkspace({
      dataPort: {
        listDatasets: () => [numeric],
        getDataset: () => numeric,
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
      },
    });
    render(
      <Table
        store={store}
        node={{
          id: "table",
          component: "Table",
          datasetId: "branches",
          columns: ["capacity", "name"],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "1,000 tokens" })).toBeTruthy();
  });
  it("applies semantic span and density without rerendering unrelated blocks", () => {
    const { store } = fixture();
    const view = render(<Workspace store={store} instrumentation />);
    const untouched = view.container.querySelector('[data-node-id="metric"]');
    const count = untouched?.getAttribute("data-render-count");
    act(() => {
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "configure",
            id: "ranking",
            patch: { span: 8, density: "compact" },
          },
        ],
      });
    });
    expect(
      view.container
        .querySelector('[data-node-id="ranking"]')
        ?.getAttribute("style"),
    ).toContain("--aeliqo-block-span: 8");
    expect(untouched?.getAttribute("data-render-count")).toBe(count);
  });
  it("acknowledges the exact workspace revision after React commits it", () => {
    const { store } = fixture();
    const presented = vi.fn();
    render(<Workspace store={store} onPresented={presented} />);
    expect(presented).toHaveBeenLastCalledWith(0);
    act(() => {
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [{ type: "configure", id: "ranking", patch: { title: "Updated" } }],
      });
    });
    expect(presented).toHaveBeenLastCalledWith(1);
  });
  it("Trend keeps separate series and positions points by elapsed time", () => {
    const monthly = defineDataset({
      ...dataset,
      id: "monthly",
      timeFields: [{ key: "month", label: "Month" }],
    });
    const snapshot: DataSnapshot = {
      status: "ready",
      records: [
        {
          id: "a",
          name: "Central",
          region: "East",
          month: "2026-01-01",
          approval: 0.4,
        },
        {
          id: "b",
          name: "Central",
          region: "East",
          month: "2026-01-02",
          approval: 0.8,
        },
        {
          id: "c",
          name: "Harbor",
          region: "West",
          month: "2026-02-01",
          approval: 0.9,
        },
      ],
    };
    const store = createWorkspace({
      dataPort: {
        listDatasets: () => [monthly],
        getDataset: () => monthly,
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
      },
    });
    const view = render(
      <Trend
        store={store}
        node={{
          id: "trend",
          component: "Trend",
          datasetId: "monthly",
          metric: "approval",
          timeField: "month",
          seriesBy: "region",
        }}
      />,
    );
    expect(view.container.querySelectorAll("[data-series]")).toHaveLength(2);
    expect(screen.getByText("East · 80%")).toBeTruthy();
    expect(screen.getByText("West · 90%")).toBeTruthy();
    expect(screen.getByText("3 periods · 2 series")).toBeTruthy();
    const path = view.container
      .querySelector('[data-series="East"] path')
      ?.getAttribute("d");
    expect(path).toMatch(/L57\./); // One day occupies 1/31 of the x domain, not half the chart.
  });
  it("orders and formats explicit Ranking from the dataset contract", () => {
    const { store } = fixture();
    const node = store.getNode("ranking");
    if (!node) throw new Error("missing node");
    render(<Ranking store={store} node={node} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]?.textContent).toContain("Harbor");
    expect(buttons[0]?.textContent).toContain("50%");
  });
  it("links keyboard-compatible selection and keeps unrelated block renders stable", () => {
    const { store } = fixture();
    const view = render(<Workspace store={store} instrumentation />);
    const metric = view.container.querySelector('[data-node-id="metric"]');
    const initial = metric?.getAttribute("data-render-count");
    fireEvent.click(screen.getByRole("button", { name: /Harbor/ }));
    expect(screen.getByRole("heading", { name: "Harbor" })).toBeTruthy();
    expect(screen.getByText("West")).toBeTruthy();
    expect(metric?.getAttribute("data-render-count")).toBe(initial);
    const detail = view.container.querySelector('[data-node-id="detail"]');
    const detailCount = detail?.getAttribute("data-render-count");
    act(() => {
      store.apply({
        version: 1,
        baseRevision: store.getState().revision,
        operations: [
          {
            type: "configure",
            id: "ranking",
            patch: { title: "Lowest approvals" },
          },
        ],
      });
    });
    expect(
      screen.getByRole("heading", { name: "Lowest approvals" }),
    ).toBeTruthy();
    expect(metric?.getAttribute("data-render-count")).toBe(initial);
    expect(detail?.getAttribute("data-render-count")).toBe(detailCount);
  });
  it("Explorer composes collection and detail with no page interaction glue", () => {
    const { store } = fixture();
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [
        {
          type: "mount",
          node: {
            id: "explorer",
            component: "Explorer",
            datasetId: "branches",
            metric: "approval",
          },
        },
      ],
    });
    const node = store.getNode("explorer");
    if (!node) throw new Error("missing node");
    render(<Explorer store={store} node={node} />);
    fireEvent.click(screen.getByRole("button", { name: /Central/ }));
    expect(screen.getByRole("heading", { name: "Central" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    fireEvent.click(
      within(screen.getByRole("table")).getByRole("button", { name: "Harbor" }),
    );
    expect(screen.getByRole("heading", { name: "Harbor" })).toBeTruthy();
  });
  it("responds to application-owned data, shows states and releases data subscriptions", () => {
    const { store, listeners, update } = fixture();
    const view = render(<Workspace store={store} />);
    expect(listeners.size).toBeGreaterThan(0);
    act(() => update({ status: "loading", records: [] }));
    expect(screen.getAllByRole("status")[0]?.textContent).toContain("Loading");
    act(() =>
      update({ status: "error", records: [], error: "Network unavailable" }),
    );
    expect(screen.getAllByRole("alert")[0]?.textContent).toBe(
      "Network unavailable",
    );
    act(() => update({ status: "ready", records: [] }));
    expect(screen.getAllByText("No records to display.")).toHaveLength(3);
    view.unmount();
    expect(listeners.size).toBe(0);
  });
  it("mounts Table and entity Comparison from the same dataset semantics", () => {
    const { store } = fixture();
    act(() => {
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "mount",
            node: { id: "table", component: "Table", datasetId: "branches" },
          },
          {
            type: "mount",
            node: {
              id: "comparison",
              component: "Comparison",
              datasetId: "branches",
              metric: "approval",
            },
          },
        ],
      });
    });
    render(<Workspace store={store} />);
    expect(
      within(screen.getAllByRole("table")[0]!).getByRole("button", { name: "Harbor" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Entity comparison" }),
    ).toBeTruthy();
  });
  it("Trend computes semantic period aggregates and exposes an accessible chart summary", () => {
    const monthly = defineDataset({
      ...dataset,
      id: "monthly",
      timeFields: [{ key: "month", label: "Month" }],
    });
    const snapshot: DataSnapshot = {
      status: "ready",
      records: [
        { id: "a", name: "Central", month: "2026-01", approval: 0.4 },
        { id: "b", name: "Harbor", month: "2026-01", approval: 0.8 },
        { id: "c", name: "Central", month: "2026-02", approval: 0.9 },
      ],
    };
    const dataPort: DataPort = {
      listDatasets: () => [monthly],
      getDataset: () => monthly,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    };
    const store = createWorkspace({ dataPort });
    const view = render(
      <Trend
        store={store}
        node={{
          id: "trend",
          component: "Trend",
          datasetId: "monthly",
          metric: "approval",
          timeField: "month",
        }}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "Approval rate from 2026-01 to 2026-02",
      }),
    ).toBeTruthy();
    expect(screen.getByText("2 periods · Latest: 90%")).toBeTruthy();
    expect(view.container.querySelector("path")?.getAttribute("d")).toMatch(
      /^M/,
    );
  });
  it("uses the same semantic filter in Ranking and Metric", () => {
    const { store } = fixture();
    const filters = [
      { field: "approval", operator: "lt" as const, value: 0.6 },
    ];
    store.apply({
      version: 1,
      baseRevision: 0,
      operations: [
        { type: "configure", id: "ranking", patch: { filters } },
        { type: "configure", id: "metric", patch: { filters } },
      ],
    });
    render(<Workspace store={store} />);
    expect(screen.queryByRole("button", { name: /Central/ })).toBeNull();
    expect(screen.getAllByText("50%")).toHaveLength(2);
  });
  it("follows declared cross-entity relationships and renders safe sources", () => {
    const organization = defineDataset({
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
      ...dataset,
      id: "models",
      entity: "Model",
      dimensions: [
        ...dataset.dimensions,
        { key: "organizationId", label: "Organization ID" },
        { key: "source", label: "Source" },
      ],
      relationships: [
        {
          id: "organization",
          field: "organizationId",
          targetDatasetId: "organizations",
        },
      ],
    });
    const modelData: DataSnapshot = {
      status: "ready",
      records: [
        {
          id: "m",
          name: "Model A",
          approval: 0.5,
          organizationId: "org",
          source: "javascript:alert(1)",
        },
      ],
    };
    const orgData: DataSnapshot = {
      status: "ready",
      records: [
        { id: "org", name: "Lab A", source: "https://example.com/source" },
      ],
    };
    const dataPort: DataPort = {
      listDatasets: () => [models, organization],
      getDataset: (id) => (id === "models" ? models : organization),
      getSnapshot: (id) => (id === "models" ? modelData : orgData),
      subscribe: () => () => {},
    };
    const store = createWorkspace({
      dataPort,
      nodes: [
        {
          id: "r",
          component: "Ranking",
          datasetId: "models",
          metric: "approval",
        },
        { id: "d", component: "Detail", datasetId: "models" },
        { id: "o", component: "Detail", datasetId: "organizations" },
      ],
      bindings: [
        { id: "model", source: "r", target: "d", entity: "Model" },
        {
          id: "org",
          source: "d",
          target: "o",
          entity: "Organization",
          relationship: "organization",
        },
      ],
    });
    render(<Workspace store={store} />);
    fireEvent.click(screen.getByRole("button", { name: /Model A/ }));
    expect(screen.getByRole("heading", { name: "Lab A" })).toBeTruthy();
    expect(screen.getByText("javascript:alert(1)")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /example.com/ }).getAttribute("href"),
    ).toBe("https://example.com/source");
    expect(screen.queryByRole("link", { name: /javascript/ })).toBeNull();
  });
  it("reports measured container adaptation and disconnects its observer", () => {
    const observe = vi.fn(),
      disconnect = vi.fn();
    let resize: ((width: number) => void) | undefined;
    class Observer {
      constructor(callback: ResizeObserverCallback) {
        resize = (width) =>
          callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const { store } = fixture();
    const node = store.getNode("ranking");
    if (!node) throw new Error("missing node");
    const onAdaptation = vi.fn();
    const view = render(
      <Ranking store={store} node={node} onAdaptation={onAdaptation} />,
    );
    act(() => resize?.(320));
    expect(
      view.container
        .querySelector("[data-adaptation]")
        ?.getAttribute("data-adaptation"),
    ).toBe("compact");
    expect(onAdaptation).toHaveBeenLastCalledWith({
      id: "ranking",
      mode: "compact",
      width: 320,
      visibleRecords: 2,
      totalRecords: 2,
    });
    act(() => resize?.(600));
    expect(
      view.container
        .querySelector("[data-adaptation]")
        ?.getAttribute("data-adaptation"),
    ).toBe("full");
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
