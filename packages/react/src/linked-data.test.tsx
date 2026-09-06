// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createWorkspace, defineDataset, type DataPort, type DataSnapshot, type Listener } from "@aeliqo/core";
import { Detail } from "./index";

afterEach(cleanup);

it("refreshes an isolated Detail when the selected source record changes its relationship", () => {
  const source = defineDataset({ id: "tickets", entity: "Ticket", label: "Tickets", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Ticket" }, { key: "team", label: "Team key" }], metrics: [], timeFields: [], relationships: [{ id: "team", field: "team", targetDatasetId: "teams" }] });
  const target = defineDataset({ id: "teams", entity: "Team", label: "Teams", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Team" }], metrics: [], timeFields: [] });
  const snapshots: Record<string, DataSnapshot> = {
    tickets: { status: "ready", records: [{ id: "ticket", name: "Request", team: "a" }] },
    teams: { status: "ready", records: [{ id: "a", name: "First team" }, { id: "b", name: "Second team" }] },
  };
  const listeners = new Map<string, Set<Listener>>();
  const port: DataPort = {
    listDatasets: () => [source, target],
    getDataset: id => id === source.id ? source : target,
    getSnapshot: id => snapshots[id]!,
    subscribe: (id, listener) => {
      const group = listeners.get(id) ?? new Set<Listener>();
      listeners.set(id, group);
      group.add(listener);
      return () => { group.delete(listener); };
    },
  };
  const node = { id: "detail", component: "Detail" as const, datasetId: "teams" };
  const store = createWorkspace({ dataPort: port, nodes: [{ id: "table", component: "Table", datasetId: "tickets" }, node], bindings: [{ id: "link", source: "table", target: "detail", entity: "Team", relationship: "team" }] });
  store.apply({ version: 1, baseRevision: 0, operations: [{ type: "select", id: "table", recordId: "ticket" }] });
  const view = render(<Detail store={store} node={node} />);
  expect(screen.getByRole("heading", { name: "First team" })).toBeTruthy();
  act(() => {
    snapshots.tickets = { status: "ready", records: [{ id: "ticket", name: "Request", team: "b" }] };
    for (const listener of listeners.get("tickets") ?? []) listener();
  });
  expect(screen.getByRole("heading", { name: "Second team" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "First team" })).toBeNull();
  expect(store.getState().revision).toBe(1);
  view.unmount();
  expect([...listeners.values()].every(group => group.size === 0)).toBe(true);
});
