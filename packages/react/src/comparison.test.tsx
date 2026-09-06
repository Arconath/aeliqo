import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspace, defineDataset, type DataSnapshot } from "@aeliqo/core";
import { Comparison } from "./comparison";
import { Workspace } from "./index";

afterEach(cleanup);
const dataset = defineDataset({ id: "offers", entity: "Offer", label: "Offers", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }], metrics: [{ key: "usd", label: "USD price", aggregation: "mean", format: "currency", unit: "USD" }, { key: "eur", label: "EUR price", aggregation: "mean", format: "currency", unit: "EUR" }], timeFields: [] });
const snapshot: DataSnapshot = { status: "ready", records: [{ id: "a", name: "Alpha", usd: 0, eur: 5 }, { id: "b", name: "Beta", usd: null, eur: 8 }, { id: "c", name: "Gamma", usd: 12, eur: 10 }] };

describe("selected-entity Comparison", () => {
  it("reuses the Table primitive while keeping currencies separate and missing values honest", () => {
    render(<Comparison dataset={dataset} snapshot={{ ...snapshot, stale: true, scope: "loaded-page" }} metrics={["usd", "eur"]} selectedIds={["a", "b", "gone"]} />);
    expect(screen.getByRole("columnheader", { name: "USD price (USD)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "EUR price (EUR)" })).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(screen.getByText("€5.00")).toBeTruthy();
    expect(screen.getAllByLabelText("Not available")).toHaveLength(3);
    expect(screen.getByRole("row", { name: "gone (unavailable) Not available Not available" })).toBeTruthy();
    expect(screen.getByText("Data is stale.")).toBeTruthy();
  });
  it("projects an entire-dataset snapshot into an honest selected-result scope", () => {
    render(<Comparison dataset={dataset} snapshot={{ ...snapshot, scope: "entire-dataset", totalCount: 3 }} metrics={["usd"]} selectedIds={["a", "b"]} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
  it("keeps loaded-page provenance when unavailable selections expand the projection", () => {
    render(<Comparison dataset={dataset} snapshot={{ status: "ready", records: [snapshot.records[0]!], scope: "loaded-page", totalCount: 1 }} metrics={["usd"]} selectedIds={["a", "gone"]} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Loaded page only; results are not global.")).toBeTruthy();
  });
  it("emits controlled add/remove proposals while retaining selection until props change", () => {
    const onSelectionChange = vi.fn();
    const view = render(<Comparison dataset={dataset} snapshot={snapshot} metrics={["usd"]} selectedIds={["a", "b"]} onSelectionChange={onSelectionChange} />);
    expect((screen.getByRole("button", { name: "Remove Alpha from comparison" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Gamma" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(["a", "b", "c"]);
    expect((screen.getByRole("checkbox", { name: "Gamma" }) as HTMLInputElement).checked).toBe(false);
    view.rerender(<Comparison dataset={dataset} snapshot={snapshot} metrics={["usd"]} selectedIds={["a", "b", "c"]} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Beta from comparison" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(["a", "c"]);
  });
  it("renders lifecycle errors and rejects undeclared measures", () => {
    const view = render(<Comparison dataset={dataset} snapshot={snapshot} metrics={["name"]} selectedIds={["a", "b"]} />);
    expect(screen.getByRole("alert").textContent).toContain("declared metrics");
    view.rerender(<Comparison dataset={dataset} snapshot={{ status: "loading", records: [] }} metrics={["usd"]} selectedIds={["a", "b"]} />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    view.rerender(<Comparison dataset={dataset} snapshot={{ status: "ready", records: [] }} metrics={["usd"]} selectedIds={["a", "b"]} />);
    expect(screen.getByRole("status").textContent).toContain("No records");
  });
  it("hydrates stable labels and native keyboard controls without mismatches", async () => {
    const props = { dataset, snapshot, metrics: ["usd", "eur"], selectedIds: ["a", "b"], onSelectionChange: vi.fn() };
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Comparison {...props} />);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, <Comparison {...props} />, { onRecoverableError }); });
    try {
      expect(onRecoverableError).not.toHaveBeenCalled();
      const checkbox = within(container).getByRole("checkbox", { name: "Gamma" });
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
      fireEvent.click(checkbox);
      expect(props.onSelectionChange).toHaveBeenCalledWith(["a", "b", "c"]);
    } finally { await act(async () => root!.unmount()); container.remove(); }
  });
  it("semantic adapter preserves explicit comparison identities through human edits and undo", () => {
    const store = createWorkspace({ dataPort: { listDatasets: () => [dataset], getDataset: () => dataset, getSnapshot: () => snapshot, subscribe: () => () => {} }, nodes: [{ id: "compare", component: "Comparison", datasetId: dataset.id, metric: "usd", columns: ["usd", "eur"], compareIds: ["a", "b", "c"] }] });
    render(<Workspace store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Beta from comparison" }));
    expect(store.getNode("compare")?.compareIds).toEqual(["a", "c"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getNode("compare")?.compareIds).toEqual(["a", "b", "c"]);
  });
});
