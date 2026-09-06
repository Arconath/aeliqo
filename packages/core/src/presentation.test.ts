import { describe, expect, it, vi } from "vitest";
import { createCapabilityDispatcher, createWorkspace, defineDataset, receiptSchema, type DataPort, type DataSnapshot } from "./index";

function fixture() {
  const dataset = defineDataset({ id: "events", label: "Events", entity: "Event", identity: "id", labelField: "name", dimensions: [{ key: "name", label: "Name" }, { key: "group", label: "Group" }], metrics: [{ key: "count", label: "Count", aggregation: "sum" }], timeFields: [{ key: "at", label: "At", temporal: "date" }] });
  let snapshot: DataSnapshot = { status: "ready", scope: "entire-dataset", records: [{ id: "one", name: "One", group: "A", count: 1, at: "2026-09-01" }] };
  const listeners = new Set<() => void>();
  const port: DataPort = { listDatasets: () => [dataset], getDataset: () => dataset, getSnapshot: () => snapshot, subscribe: (_id, fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; } };
  const store = createWorkspace({ dataPort: port });
  const dispatcher = createCapabilityDispatcher(store, { workspaceId: "events-workspace" });
  const request = { version: 1, baseRevision: 0, operations: [{ type: "mount", node: { id: "table", component: "Table", datasetId: "events" } }] };
  return { store, dispatcher, request, listeners, port, update(next: DataSnapshot) { snapshot = next; for (const fn of [...listeners]) fn(); } };
}
describe("shared operation receipts", () => {
  it.each([
    ["ready", { status: "ready" as const, records: [{ id: "one", name: "One", group: "A", count: 1, at: "2026-09-01" }] }, "ready", "presented"],
    ["partial", { status: "ready" as const, scope: "loaded-page" as const, totalCount: 2, records: [{ id: "one", name: "One", group: "A", count: 1, at: "2026-09-01" }] }, "partial", "pending"],
    ["error", { status: "error" as const, error: "Unavailable", records: [] }, "failed", "failed"],
  ] as const)("tracks source, linked receiver, and %s data for range receipts", (_label, next, dataStatus, outcome) => {
    const { dispatcher, store, update } = fixture();
    expect(store.apply({ version: 1, baseRevision: 0, operations: [
      { type: "mount", node: { id: "source", component: "Trend", datasetId: "events", metric: "count", timeField: "at" } },
      { type: "mount", node: { id: "target", component: "EventTimeline", datasetId: "events", timeField: "at" } },
      { type: "connect", binding: { id: "range", mode: "range", source: "source", target: "target", entity: "Event" } },
    ] }).ok).toBe(true);
    update(next);
    const renderer = dispatcher.presentation.connect("renderer");
    dispatcher.dispatch("workspace_apply", { version: 1, baseRevision: 1, operations: [
      { type: "interact", id: "source", payload: { kind: "range", field: "at", range: { start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 8, 2) } } },
    ] }, { requestId: `range-${_label}` });
    renderer.acknowledge(2);
    expect(dispatcher.presentation.inspect(`range-${_label}`)).toMatchObject({ changedNodeIds: ["source", "target"], data: { status: dataStatus }, outcome });
  });
  it("tracks group interaction sources and linked receivers in receipts", () => {
    const { dispatcher, store } = fixture();
    expect(store.apply({ version: 1, baseRevision: 0, operations: [
      { type: "mount", node: { id: "source", component: "MetricBreakdown", datasetId: "events", metric: "count", dimension: "group" } },
      { type: "mount", node: { id: "target", component: "MetricBreakdown", datasetId: "events", metric: "count", dimension: "group" } },
      { type: "connect", binding: { id: "group", mode: "group", source: "source", target: "target", entity: "Event" } },
    ] }).ok).toBe(true);
    const renderer = dispatcher.presentation.connect("renderer");
    dispatcher.dispatch("workspace_apply", { version: 1, baseRevision: 1, operations: [
      { type: "interact", id: "source", payload: { kind: "group", field: "group", value: "A" } },
    ] }, { requestId: "group" });
    renderer.acknowledge(2);
    expect(dispatcher.presentation.inspect("group")).toMatchObject({ changedNodeIds: ["source", "target"], data: { status: "ready" }, outcome: "presented" });
  });
  it("reports invalid snapshots and thrown application reads as data failures after commit", () => {
    const {dispatcher,request,update,port,store}=fixture();
    update({status:"ready",records:[{id:"duplicate",name:"A"},{id:"duplicate",name:"B"}]});
    const renderer=dispatcher.presentation.connect("renderer");
    const invalid=dispatcher.dispatch("workspace_apply",request,{requestId:"invalid"});
    renderer.acknowledge(1);
    expect(dispatcher.presentation.inspect("invalid")).toMatchObject({operation:"committed",data:{status:"failed"},outcome:"failed"});
    expect(store.getState().revision).toBe(invalid.revision);
    vi.spyOn(port,"getSnapshot").mockImplementation(()=>{throw new Error("Adapter unavailable");});
    expect(()=>renderer.acknowledge(1)).not.toThrow();
    expect(dispatcher.presentation.inspect("invalid")).toMatchObject({operation:"committed",data:{status:"failed"}});
  });
  it("keeps generated and explicit request ids distinct and rejects reverse collisions before mutation", () => {
    const {dispatcher,request,store}=fixture();
    dispatcher.dispatch("workspace_apply",request,{requestId:"local-1"});
    const next=dispatcher.dispatch("workspace_apply",{version:1,baseRevision:1,operations:[{type:"configure",id:"table",patch:{title:"Second"}}]});
    expect(next).toMatchObject({requestId:"local-2",revision:2});
    expect(()=>dispatcher.dispatch("workspace_apply",{version:1,baseRevision:2,operations:[{type:"remove",id:"table"}]},{requestId:next.requestId})).toThrow("different input");
    expect(store.getState().revision).toBe(2);
  });
  it("rejects disposed dispatchers before mutation but preserves a commit disposed by its observers", async () => {
    const first=fixture();first.dispatcher.presentation.dispose();
    expect(()=>first.dispatcher.dispatch("workspace_apply",first.request)).toThrow("disposed");
    expect(first.store.getState().revision).toBe(0);
    const second=fixture();second.store.subscribe(()=>second.dispatcher.presentation.dispose());
    await expect(second.dispatcher.dispatchAsync("workspace_apply",second.request)).resolves.toMatchObject({operation:"committed",revision:1,render:{status:"disconnected"},outcome:"pending"});
    expect(second.store.getState().revision).toBe(1);
    const third=fixture();
    const observing=createCapabilityDispatcher(third.store,{onEvent:()=>observing.presentation.dispose()});
    await expect(observing.dispatchAsync("workspace_apply",third.request)).resolves.toMatchObject({operation:"committed",revision:1,render:{status:"disconnected"},outcome:"pending"});
  });
  it("returns a committed data failure if adapter subscription throws, without leaking waiters", async () => {
    const {dispatcher,request,port,store,listeners}=fixture();
    dispatcher.presentation.connect("renderer");
    vi.spyOn(port,"subscribe").mockImplementation(()=>{throw new Error("Subscription unavailable");});
    await expect(dispatcher.dispatchAsync("workspace_apply",request,{requestId:"r"})).resolves.toMatchObject({operation:"committed",data:{status:"failed"},outcome:"failed"});
    expect(store.getState().revision).toBe(1);
    expect(listeners.size).toBe(0);
  });
  it("cleans subscriptions installed before a later failure and synchronous readiness notifications", async () => {
    const first=fixture();const subscribe=first.port.subscribe;
    const dataset=first.port.getDataset("events")!;
    vi.spyOn(first.port,"getDataset").mockImplementation(id=>({...dataset,id}));
    vi.spyOn(first.port,"subscribe").mockImplementation((id,listener)=>{
      if(id==="second")throw new Error("Second subscription failed");
      return subscribe(id,listener);
    });
    first.dispatcher.presentation.connect("renderer");
    await expect(first.dispatcher.dispatchAsync("workspace_apply",{version:1,baseRevision:0,operations:[...first.request.operations,{type:"mount",node:{id:"other",component:"Table",datasetId:"second"}}]})).resolves.toMatchObject({operation:"committed",outcome:"failed"});
    expect(first.listeners.size).toBe(0);
    const second=fixture();const renderer=second.dispatcher.presentation.connect("renderer");
    const stop=vi.fn();vi.spyOn(second.port,"subscribe").mockImplementation(()=>{renderer.acknowledge(1);return stop;});
    await expect(second.dispatcher.dispatchAsync("workspace_apply",second.request)).resolves.toMatchObject({outcome:"presented"});
    expect(stop).toHaveBeenCalledOnce();
  });
  it("commits without a renderer, exposes recoverable state, and later acknowledges the exact revision", async () => {
    const { dispatcher, request, store } = fixture();
    const result = await dispatcher.dispatchAsync("workspace_apply", request, { requestId: "r" });
    expect(result).toMatchObject({ operation: "committed", outcome: "pending", render: { status: "disconnected" }, data: { status: "ready" } });
    const renderer = dispatcher.presentation.connect("visible-renderer");
    renderer.acknowledge(0);
    expect(dispatcher.presentation.inspect("r")?.outcome).toBe("pending");
    renderer.acknowledge(1);
    const receipt = dispatcher.dispatch("workspace_inspect", { requestId: "r" }).receipt!;
    expect(receiptSchema.parse(receipt)).toMatchObject({ workspaceId: "events-workspace", outcome: "presented", render: { evidence: "renderer-ack", revision: 1 } });
    expect(dispatcher.dispatch("workspace_apply", request, { requestId: "r" })).toEqual(receipt);
    expect(store.getState().revision).toBe(1);
    expect(dispatcher.dispatch("workspace_inspect", { requestId: "missing" }).receiptStatus).toBe("unknown-or-expired");
  });
  it("does not turn a hidden tab, a loading skeleton, stale or partial data into completion", () => {
    const { dispatcher, request, update } = fixture();
    const renderer = dispatcher.presentation.connect("renderer");
    dispatcher.dispatch("workspace_apply", request, { requestId: "r" });
    renderer.acknowledge(1, { visible: false });
    expect(dispatcher.presentation.inspect("r")?.outcome).toBe("pending");
    for (const snapshot of [
      { status: "loading" as const, records: [] },
      { status: "ready" as const, records: [], stale: true },
      { status: "ready" as const, records: [], scope: "loaded-page" as const, totalCount: 50 },
    ]) {
      update(snapshot); renderer.acknowledge(1);
      expect(dispatcher.presentation.inspect("r")?.outcome).toBe("pending");
    }
    update({ status: "ready", records: [] });
    expect(dispatcher.presentation.inspect("r")?.outcome).toBe("pending");
    renderer.acknowledge(1);
    expect(dispatcher.presentation.inspect("r")?.outcome).toBe("presented");
  });
  it("returns a bounded pending response and cleans listeners after timeout, cancellation and disconnect", async () => {
    vi.useFakeTimers();
    try {
      const { dispatcher, request, listeners } = fixture();
      const renderer = dispatcher.presentation.connect("renderer");
      const pending = dispatcher.dispatchAsync("workspace_apply", request, { requestId: "r" }, { timeoutMs: 10 });
      expect(listeners.size).toBe(1);
      await vi.advanceTimersByTimeAsync(10);
      expect((await pending).outcome).toBe("pending");
      expect(listeners.size).toBe(0);
      const controller = new AbortController();
      const cancelled = dispatcher.presentation.wait("r", { signal: controller.signal });
      controller.abort();
      expect((await cancelled).operation).toBe("committed");
      expect(listeners.size).toBe(0);
      const disconnected = dispatcher.presentation.wait("r");
      renderer.disconnect();
      expect((await disconnected).render.status).toBe("disconnected");
      expect(listeners.size).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("does not acknowledge an older mutation using a newer revision", () => {
    const { dispatcher, request, store } = fixture();
    const renderer = dispatcher.presentation.connect("renderer");
    dispatcher.dispatch("workspace_apply", request, { requestId: "r" });
    store.apply({ version: 1, baseRevision: 1, operations: [{ type: "configure", id: "table", patch: { title: "Human change" } }] });
    renderer.acknowledge(2);
    renderer.acknowledge(1);
    expect(dispatcher.presentation.inspect("r")?.outcome).not.toBe("presented");
    expect(store.getNode("table")?.title).toBe("Human change");
  });
  it("rejects fabricated completion receipts", () => {
    const { dispatcher, request } = fixture();
    const pending = dispatcher.dispatch("workspace_apply", request);
    expect(receiptSchema.safeParse({ ...pending, outcome: "presented" }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...pending, render: { status: "acknowledged", rendererId: "r", revision: 99, evidence: "renderer-ack" } }).success).toBe(false);
  });
});
