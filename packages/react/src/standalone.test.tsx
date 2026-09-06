import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComponentRegistry,
  createPresentationTracker,
  createWorkspace,
  defineDataset,
  type DataSnapshot,
  type WorkspaceNode,
} from "@aeliqo/core";
import { Metric } from "./metric";
import { Table } from "./table";
import { Filter } from "./filter";
import { Matrix, Ranking, Workspace } from "./index";

afterEach(cleanup);
const dataset = defineDataset({
  id: "teams",
  entity: "Team",
  label: "Teams",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Name" }],
  metrics: [
    { key: "yes", label: "Approved", aggregation: "sum" },
    { key: "all", label: "Requests", aggregation: "sum" },
    {
      key: "rate",
      label: "Approval",
      aggregation: "ratio-of-sums",
      format: "percent",
      ratio: {
        numerator: "yes",
        denominator: "all",
        zeroDenominator: "null",
        missing: "exclude-pair",
      },
    },
  ],
  timeFields: [],
});
const snapshot: DataSnapshot = {
  status: "ready",
  records: [
    { id: "a", name: "Alpha", yes: 1, all: 2 },
    { id: "b", name: "Beta", yes: 9, all: 10 },
    { id: "c", name: "Unknown", yes: null, all: 5 },
  ],
};
const port = {
  listDatasets: () => [dataset],
  getDataset: () => dataset,
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
};
const node: WorkspaceNode = {
  id: "test",
  component: "Metric",
  datasetId: dataset.id,
  metric: "rate",
};

describe("standalone semantic components", () => {
  it("keeps a 100k-row, 20-column table DOM bounded and keyboard-navigable", () => {
    const dimensions = Array.from({ length: 19 }, (_, index) => ({
      key: `field${index}`,
      label: `Field ${index}`,
    }));
    const scaleDataset = defineDataset({
      id: "scale-table",
      entity: "Scale row",
      label: "Scale rows",
      identity: "id",
      labelField: "field0",
      dimensions,
      metrics: [{ key: "score", label: "Score", aggregation: "mean" }],
      timeFields: [],
    });
    const records = Array.from({ length: 100_000 }, (_, row) =>
      Object.fromEntries([
        ["id", `row-${row}`],
        ...dimensions.map((field, column) => [
          field.key,
          column === 0 ? `Record ${row}` : `R${row}C${column}`,
        ]),
        ["score", row % 100],
      ]),
    );
    const onSelect = vi.fn();
    const view = render(
      <Table
        dataset={scaleDataset}
        snapshot={{ status: "ready", records }}
        columns={[...dimensions.map((field) => field.key), "score"]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(20);
    expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe(
      "100001",
    );
    expect(view.container.querySelectorAll("tbody tr").length).toBeLessThan(30);
    fireEvent.keyDown(screen.getByRole("region"), { key: "End" });
    expect(screen.getByRole("button", { name: "Record 99999" })).toBeTruthy();
    expect(
      screen.getByText("Active row 100000 of 100000: Record 99999."),
    ).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("region"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("row-99999");
    expect(view.container.querySelectorAll("tbody tr").length).toBeLessThan(30);
  });

  it("links Filter to Table, retains the draft, and exposes human pin and history controls", () => {
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        { id: "filter", component: "Filter", datasetId: dataset.id },
        {
          id: "table",
          component: "Table",
          datasetId: dataset.id,
          columns: ["name", "rate"],
        },
      ],
      bindings: [
        {
          id: "filter-table",
          mode: "filter",
          source: "filter",
          target: "table",
          entity: dataset.entity,
        },
      ],
    });
    render(<Workspace store={store} />);
    const input = screen.getByLabelText("Value");
    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(within(screen.getByRole("table")).queryByText("Beta")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(screen.getByRole("table")).getByText("Beta")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(within(screen.getByRole("table")).queryByText("Beta")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pin table" }));
    expect(store.getNode("table")?.pinned).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Unpin table" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("never acknowledges missing or throwing extension renderers as presented", () => {
    const registry = createComponentRegistry([
      {
        capability: {
          component: "Broken",
          purpose: "Failure fixture",
          accepts: [],
          interactions: [],
          minWidth: 180,
          accessibility: "Text",
        },
      },
    ]);
    const store = createWorkspace({ dataPort: port, registry });
    const tracker = createPresentationTracker(store);
    const before = store.getState();
    store.apply({
      version: 1,
      baseRevision: before.revision,
      operations: [
        {
          type: "mount",
          node: { id: "broken", component: "Broken", datasetId: dataset.id },
        },
      ],
    });
    tracker.record("missing", before, store.getState().revision);
    const onPresented = vi.fn();
    const view = render(
      <Workspace
        store={store}
        presentation={tracker}
        onPresented={onPresented}
      />,
    );
    expect(tracker.inspect("missing")?.render.status).toBe("failed");
    expect(onPresented).not.toHaveBeenCalled();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      view.rerender(
        <Workspace
          store={store}
          presentation={tracker}
          onPresented={onPresented}
          renderers={{
            Broken: () => {
              throw new Error("Fixture renderer failure");
            },
          }}
        />,
      );
      expect(screen.getByRole("alert").textContent).toContain(
        "could not be rendered",
      );
      expect(tracker.inspect("missing")?.outcome).toBe("failed");
      expect(onPresented).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
  it("acknowledges a recovered renderer on the revision that fixes it", async () => {
    const registry = createComponentRegistry([
      {
        capability: {
          component: "Recoverable",
          purpose: "Recovery fixture",
          accepts: [],
          interactions: [],
          minWidth: 180,
          accessibility: "Text",
        },
      },
    ]);
    const store = createWorkspace({
      dataPort: port,
      registry,
      nodes: [
        { id: "recoverable", component: "Recoverable", datasetId: dataset.id },
      ],
    });
    const tracker = createPresentationTracker(store);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Renderer = ({ node: current }: { node: WorkspaceNode }) => {
      if (!current.title) throw new Error("Waiting for valid configuration");
      return <p>{current.title}</p>;
    };
    try {
      const first = store.getState();
      tracker.record("failed", first, first.revision);
      render(
        <Workspace
          store={store}
          presentation={tracker}
          renderers={{ Recoverable: Renderer }}
        />,
      );
      expect(tracker.inspect("failed")?.outcome).toBe("failed");

      const before = store.getState();
      const result = store.apply({
        version: 1,
        baseRevision: before.revision,
        operations: [
          {
            type: "configure",
            id: "recoverable",
            patch: { title: "Recovered" },
          },
        ],
      });
      expect(result.ok).toBe(true);
      tracker.record("recovered", before, store.getState().revision);

      await waitFor(() =>
        expect(tracker.inspect("recovered")?.outcome).toBe("presented"),
      );
      expect(screen.getByText("Recovered")).toBeTruthy();
    } finally {
      error.mockRestore();
    }
  });
  it("renders registered developer components and reports missing renderers", () => {
    const registry = createComponentRegistry([
      {
        capability: {
          component: "TeamNote",
          purpose: "Team annotation",
          accepts: [],
          interactions: [],
          minWidth: 180,
          accessibility: "Text",
        },
      },
    ]);
    const store = createWorkspace({
      dataPort: port,
      registry,
      nodes: [{ id: "note", component: "TeamNote", datasetId: dataset.id }],
    });
    const view = render(<Workspace store={store} />);
    expect(screen.getByRole("alert").textContent).toContain("No renderer");
    view.rerender(
      <Workspace
        store={store}
        renderers={{
          TeamNote: ({ node }) => <p>Team annotation: {node.datasetId}</p>,
        }}
      />,
    );
    expect(screen.getByText("Team annotation: teams")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("renders explicit Metric without a workspace and supports server rendering", () => {
    expect(
      renderToString(
        <Metric value={0.5} label="Approval" metric={dataset.metrics[2]} />,
      ),
    ).toContain("50%");
    render(<Metric value={null} label="Missing" />);
    expect(screen.getByText("—")).toBeTruthy();
  });
  it("uses ratio of sums in semantic Metric and derived values in standalone Table", () => {
    const store = createWorkspace({ dataPort: port });
    const view = render(<Metric store={store} node={node} />);
    expect(screen.getByText("83.3%")).toBeTruthy();
    view.unmount();
    const onSelect = vi.fn();
    render(
      <Table
        dataset={dataset}
        snapshot={snapshot}
        columns={["name", "rate"]}
        onSelect={onSelect}
        selectedId="a"
      />,
    );
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onSelect).toHaveBeenCalledWith("a");
    expect(
      renderToString(<Table dataset={dataset} snapshot={snapshot} />),
    ).toContain("Alpha");
  });
  it("sorts and filters derived ratios and discloses local partial scope", () => {
    const partial = {
      ...snapshot,
      scope: "loaded-page" as const,
      totalCount: 100,
      stale: true,
    };
    const store = createWorkspace({
      dataPort: { ...port, getSnapshot: () => partial },
    });
    render(
      <Ranking
        store={store}
        node={{
          ...node,
          component: "Ranking",
          direction: "desc",
          filters: [{ field: "rate", operator: "gte", value: 0.6 }],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /Beta/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Alpha/ })).toBeNull();
    expect(
      screen.getByText("Loaded page only; results are not global."),
    ).toBeTruthy();
    expect(screen.getByText("Data is stale.")).toBeTruthy();
  });
  it("renders invalid identity as an accessible error and missing Matrix values honestly", () => {
    const view = render(
      <Table
        dataset={dataset}
        snapshot={{ status: "ready", records: [{ id: null }] }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("identity");
    view.unmount();
    render(
      <Matrix
        store={createWorkspace({ dataPort: port })}
        node={{ ...node, component: "Matrix", columns: ["rate"] }}
      />,
    );
    expect(screen.getByLabelText("Approval: not available")).toBeTruthy();
  });
  it("keeps drafts local, ignores IME submit, and rejects missing or nonfinite numeric values", () => {
    const onChange = vi.fn();
    const view = render(
      <Filter dataset={dataset} filters={[]} onChange={onChange} />,
    );
    const input = screen.getByLabelText("Value");
    fireEvent.change(input, { target: { value: "日本" } });
    fireEvent.compositionStart(input);
    fireEvent.submit(input.closest("form")!);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { field: "name", operator: "eq", value: "日本" },
    ]);
    view.rerender(
      <Filter
        dataset={dataset}
        filters={[{ field: "name", operator: "eq", value: "other" }]}
        onChange={onChange}
      />,
    );
    expect((input as HTMLInputElement).value).toBe("日本");
    fireEvent.change(screen.getByLabelText("Field"), {
      target: { value: "rate" },
    });
    fireEvent.change(input, { target: { value: "Infinity" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getByRole("alert").textContent).toContain("finite");
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getByRole("alert").textContent).toContain("enter a value");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
