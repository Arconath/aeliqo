import { describe, expect, it, vi } from "vitest";
import { createCapabilityDispatcher, createWorkspace, defineDataset, type DataPort, type DataSnapshot, type Listener } from "./index";

function fixture() {
  const datasets = [
    defineDataset({ id: "items", entity: "Item", label: "Items", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }, { key: "ownerId", label: "Owner" }], metrics: [], timeFields: [], relationships: [{ id: "owner", field: "ownerId", targetDatasetId: "owners" }] }),
    defineDataset({ id: "owners", entity: "Owner", label: "Owners", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }], metrics: [], timeFields: [] }),
  ];
  const snapshots: Record<string, DataSnapshot> = {
    items: { status: "ready", records: [{ id: "a", name: "A", ownerId: "one" }] },
    owners: { status: "ready", records: [{ id: "one", name: "One" }, { id: "two", name: "Two" }] },
  };
  const listeners = new Map<string, Set<Listener>>();
  const port: DataPort = {
    listDatasets: () => datasets,
    getDataset: id => datasets.find(dataset => dataset.id === id),
    getSnapshot: id => snapshots[id]!,
    subscribe: (id, listener) => {
      const group = listeners.get(id) ?? new Set<Listener>();
      listeners.set(id, group);
      group.add(listener);
      return () => { group.delete(listener); };
    },
  };
  const store = createWorkspace({ dataPort: port, nodes: [
    { id: "table", component: "Table", datasetId: "items" },
    { id: "detail", component: "Detail", datasetId: "owners" },
  ], bindings: [{ id: "link", source: "table", target: "detail", entity: "Owner", relationship: "owner" }] });
  const update = (id: string, snapshot: DataSnapshot) => {
    snapshots[id] = snapshot;
    for (const listener of [...(listeners.get(id) ?? [])]) listener();
  };
  return { store, listeners, snapshots, update };
}

describe("application-owned linked selection lifecycle", () => {
  it("notifies a linked consumer when its source foreign key changes, without a workspace mutation", () => {
    const { store, update, listeners, snapshots } = fixture();
    store.apply({ version: 1, baseRevision: 0, operations: [{ type: "select", id: "table", recordId: "a" }] });
    const listener = vi.fn();
    const stop = store.subscribeSelection("detail", listener);
    update("items", { status: "ready", records: [{ id: "a", name: "A", ownerId: "two" }] });
    expect(store.getSelection("detail")).toBe("two");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().revision).toBe(1);
    update("items", { ...snapshots.items! });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    expect([...listeners.values()].every(group => group.size === 0)).toBe(true);
  });

  it("updates on target removal/recovery and releases source subscriptions after disconnect", () => {
    const { store, update, listeners, snapshots } = fixture();
    store.apply({ version: 1, baseRevision: 0, operations: [{ type: "select", id: "table", recordId: "a" }] });
    const listener = vi.fn();
    const stop = store.subscribeSelection("detail", listener);
    const owners = snapshots.owners!;
    update("owners", { status: "ready", records: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSelection("detail")).toBeNull();
    update("owners", owners);
    expect(listener).toHaveBeenCalledTimes(2);
    store.apply({ version: 1, baseRevision: 1, operations: [{ type: "disconnect", id: "link" }] });
    expect(listeners.get("items")?.size ?? 0).toBe(0);
    stop();
    expect([...listeners.values()].every(group => group.size === 0)).toBe(true);
  });
});

describe("commit observers", () => {
  it("reports observer failures without rejecting a committed operation or losing later notifications/replay", () => {
    const { store } = fixture();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      store.subscribe(() => { throw new Error("subscriber failed"); });
      const notified = vi.fn();
      store.subscribe(notified);
      store.subscribeOperations(() => { throw new Error("operation observer failed"); });
      const dispatcher = createCapabilityDispatcher(store, { onEvent: () => { throw new Error("telemetry failed"); } });
      const request = { version: 1, baseRevision: 0, operations: [{ type: "select", id: "table", recordId: "a" }] };
      expect(dispatcher.dispatch("workspace_apply", request, { requestId: "once" })).toMatchObject({ ok: true, revision: 1 });
      expect(dispatcher.dispatch("workspace_apply", request, { requestId: "once" })).toMatchObject({ ok: true, revision: 1 });
      expect(notified).toHaveBeenCalledTimes(1);
      expect(store.getState().revision).toBe(1);
      expect(report).toHaveBeenCalled();
    } finally { report.mockRestore(); }
  });

  it("returns the operation's own revision when a subscriber performs a subsequent edit", () => {
    const { store } = fixture();
    store.subscribe(() => {
      if (store.getState().revision === 1) store.apply({ version: 1, baseRevision: 1, operations: [{ type: "configure", id: "table", patch: { title: "Human edit" } }] });
    });
    const event = vi.fn();
    const dispatcher = createCapabilityDispatcher(store, { onEvent: event });
    const request = { version: 1, baseRevision: 0, operations: [{ type: "select", id: "table", recordId: "a" }] };
    expect(dispatcher.dispatch("workspace_apply", request, { requestId: "outer" })).toMatchObject({ ok: true, revision: 1 });
    expect(event).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 1, ok: true }));
    expect(store.getState().revision).toBe(2);
    expect(dispatcher.dispatch("workspace_apply", request, { requestId: "outer" })).toMatchObject({ ok: true, revision: 1 });
    expect(event).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 1, replayed: true }));
  });
});
