import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspace, defineDataset, type DataSnapshot } from "@aeliqo/core";
import { Delta } from "./delta";
import { RecordList } from "./record-list";
import { SelectionSummary } from "./selection-summary";
import { Overview } from "./overview";
import { Workspace } from "./index";
afterEach(cleanup);
const dataset = defineDataset({ id: "cohorts", label: "Cohorts", entity: "Cohort", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }], metrics: [{ key: "yes", label: "Approved", aggregation: "sum" }, { key: "all", label: "Requests", aggregation: "sum" }, { key: "rate", label: "Approval rate", aggregation: "ratio-of-sums", format: "percent", ratio: { numerator: "yes", denominator: "all", missing: "exclude-pair", zeroDenominator: "null" } }], timeFields: [] });
const snapshot: DataSnapshot = { status: "ready", records: [{ id: "small", name: "Small", yes: 1, all: 2 }, { id: "large", name: "Large", yes: 90, all: 100 }] };
const port = { listDatasets: () => [dataset], getDataset: () => dataset, getSnapshot: () => snapshot, subscribe: () => () => {} };
describe("bounded semantic component additions", () => {
  it("accepts Overview metric columns without a redundant metric and rejects missing or dimension-only measures", () => {
    const store = createWorkspace({ dataPort: port });
    for (const patch of [{}, { columns: ["name"] }]) {
      expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "overview", component: "Overview", datasetId: dataset.id, ...patch } }] }).ok).toBe(false);
      expect(store.getState().revision).toBe(0);
    }
    expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "overview", component: "Overview", datasetId: dataset.id, columns: ["rate"] } }] }).ok).toBe(true);
    render(<Workspace store={store} />);
    expect(screen.getByText("89.2%")).toBeTruthy();
  });
  it("Delta distinguishes relative zero baseline, signed negative baseline and missing values", () => {
    const view = render(<Delta value={5} baseline={0} label="Growth" baselineLabel="Prior period" mode="relative" />);
    expect(screen.getByText("Relative change is undefined for a zero baseline.")).toBeTruthy();
    view.rerender(<Delta value={-5} baseline={-10} label="Growth" baselineLabel="Prior period" mode="relative" />);
    expect(screen.getByText("+50%")).toBeTruthy();
    view.rerender(<Delta value={null} baseline={0} label="Growth" baselineLabel="Prior period" />);
    expect(screen.getByText("Current value or baseline is unavailable.")).toBeTruthy();
  });
  it("RecordList shows declared summaries, controlled identity and omitted-row scope", () => {
    const onSelect = vi.fn();
    render(<RecordList dataset={dataset} snapshot={snapshot} fields={["rate"]} selectedId="small" limit={1} onSelect={onSelect} />);
    expect(screen.getByText("50%")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Small" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    button.focus(); fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith("small");
    expect(screen.getByText(/Showing 1 of 2 loaded/)).toBeTruthy();
  });
  it("SelectionSummary preserves unavailable explicit ids on partial data and clears only on request", () => {
    const onClear = vi.fn();
    render(<SelectionSummary dataset={dataset} snapshot={{ ...snapshot, scope: "loaded-page", stale: true }} selectedIds={["small", "missing"]} onClear={onClear} />);
    expect(screen.getByText("missing (unavailable in loaded scope)")).toBeTruthy();
    expect(screen.getByText("2 explicit identities selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByText("Data is stale.")).toBeTruthy();
  });
  it("Overview composes Metric ratio-of-sums and RecordList without copying selection state", () => {
    const onSelect = vi.fn();
    render(<Overview dataset={dataset} snapshot={snapshot} metrics={["rate"]} onSelect={onSelect} />);
    expect(screen.getByText("89.2%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(onSelect).toHaveBeenCalledWith("large");
  });
  it("registers additive semantic contracts and rejects invalid Delta config before commit", () => {
    const store = createWorkspace({ dataPort: port });
    const rejected = store.apply({ version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "delta", component: "Delta", datasetId: dataset.id, metric: "yes", config: { baseline: 1, baselineLabel: "Prior", script: "unsafe" } } }] });
    expect(rejected.ok).toBe(false);
    expect(store.getState().revision).toBe(0);
    const accepted = store.apply({ version: 1, baseRevision: 0, operations: [
      { type: "mount", node: { id: "list", component: "RecordList", datasetId: dataset.id } },
      { type: "mount", node: { id: "summary", component: "SelectionSummary", datasetId: dataset.id } },
      { type: "connect", binding: { id: "selected", source: "list", target: "summary", entity: dataset.entity } },
      { type: "mount", node: { id: "delta", component: "Delta", datasetId: dataset.id, metric: "yes", config: { baseline: 90, baselineLabel: "Prior" } } },
    ] });
    expect(accepted.ok).toBe(true);
    render(<Workspace store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    expect(screen.getByText("1 explicit identities selected")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
  });
  it("supports SSR without workspace and renders invalid, empty and loading states honestly", () => {
    for (const component of [<Delta value={2} baseline={1} baselineLabel="Prior" label="Change" />, <RecordList dataset={dataset} snapshot={snapshot} />, <SelectionSummary dataset={dataset} snapshot={snapshot} selectedIds={[]} />, <Overview dataset={dataset} snapshot={snapshot} metrics={["rate"]} />]) expect(renderToString(component)).toContain("aeliqo-card");
    const view = render(<RecordList dataset={dataset} snapshot={snapshot} fields={["unknown"]} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    view.rerender(<Overview dataset={dataset} snapshot={{ status: "loading", records: [] }} metrics={["rate"]} />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    view.rerender(<SelectionSummary dataset={dataset} snapshot={snapshot} selectedIds={[]} />);
    expect(screen.getByText("No records selected.")).toBeTruthy();
  });
});
