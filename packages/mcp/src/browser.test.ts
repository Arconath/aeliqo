// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { WebSocket as NodeWebSocket } from "ws";
import { createWorkspace, createCapabilityDispatcher, defineDataset, type DataPort } from "@aeliqo/core";
import { WorkspaceBridge } from "./bridge.js";
import { connectWorkspace } from "./browser.js";

const dataset = defineDataset({
  id: "branches",
  entity: "branch",
  label: "Branches",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Branch" }],
  metrics: [
    {
      key: "approvalRate",
      label: "Approval rate",
      format: "percent",
      aggregation: "mean",
    },
  ],
  timeFields: [],
});
const snapshot = {
  status: "ready" as const,
  records: [
    { id: "one", name: "Central", approvalRate: 0.8 },
    { id: "two", name: "Harbor", approvalRate: 0.6 },
  ],
};
const data: DataPort = {
  listDatasets: () => [dataset],
  getDataset: (id) => (id === dataset.id ? dataset : undefined),
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
};
let bridge: WorkspaceBridge | undefined;
let disconnect: (() => void) | undefined;
afterEach(async () => {
  disconnect?.();
  await bridge?.close();
  vi.unstubAllGlobals();
});

it("applies a semantic bridge patch to the real core, discovers data, and routes selection", async () => {
  vi.stubGlobal(
    "WebSocket",
    class extends NodeWebSocket {
      constructor(url: string) {
        super(url, { origin: "http://127.0.0.1:5173" });
      }
    },
  );
  bridge = new WorkspaceBridge(0);
  await bridge.ready;
  const store = createWorkspace({ dataPort: data });
  const dispatcher = createCapabilityDispatcher(store);
  const renderer = dispatcher.presentation.connect("test-renderer");
  store.subscribe(() => queueMicrotask(() => renderer.acknowledge(store.getState().revision, {visible:true})));
  const connected = new Promise<void>((resolve) => {
    disconnect = connectWorkspace(store, data, {
      url: `ws://127.0.0.1:${bridge?.port}`,
      dispatcher, pairingToken: bridge?.pairingToken, rendererId:"test-renderer",
      onStatus: (status) => {
        if (status === "connected") resolve();
      },
    });
  });
  await connected;
  expect(await bridge.request("catalog_search", {})).toMatchObject({
    datasets: [{ id: "branches" }],
  });
  expect(
    await bridge.request("data_query", {
      datasetId: "branches",
      metric: "approvalRate",
      direction: "asc",
      limit: 1,
    }),
  ).toMatchObject({ total: 2, records: [{ id: "two" }] });
  expect(
    await bridge.request("workspace_apply", {
      version: 1,
      baseRevision: 0,
      operations: [
        {
          type: "mount",
          node: {
            id: "ranking",
            component: "Ranking",
            datasetId: "branches",
            metric: "approvalRate",
          },
        },
        {
          type: "mount",
          node: { id: "detail", component: "Detail", datasetId: "branches" },
        },
        {
          type: "connect",
          binding: {
            id: "selection",
            source: "ranking",
            target: "detail",
            entity: "branch",
          },
        },
        { type: "select", id: "ranking", recordId: "two" },
      ],
    }),
  ).toMatchObject({ ok: true, revision: 1, operation: "committed", outcome: "presented", render: { status: "acknowledged", revision: 1 }, data: { status: "ready" }, changedNodeIds: ["ranking", "detail"] });
  expect(store.getSelection("detail")).toBe("two");
  expect(await bridge.request("workspace_inspect", {})).toMatchObject({
    revision: 1,
    order: ["ranking", "detail"],
  });
  await expect(
    bridge.request("workspace_apply", {
      version: 1,
      baseRevision: 0,
      operations: [{ type: "remove", id: "ranking" }],
    }),
  ).rejects.toThrow("Revision conflict");
  expect(store.getNode("ranking")).toBeDefined();
});

it("returns a pending receipt when no renderer acknowledgement is available", async () => {
  vi.stubGlobal("WebSocket", class extends NodeWebSocket {
    constructor(url: string) { super(url, { origin: "http://127.0.0.1:5173" }); }
  });
  bridge = new WorkspaceBridge(0);
  await bridge.ready;
  const store = createWorkspace({ dataPort: data });
  await new Promise<void>((resolve) => {
    disconnect = connectWorkspace(store, data, {
      url: `ws://127.0.0.1:${bridge?.port}`,
      pairingToken: bridge?.pairingToken, rendererId:"test-renderer",
      onStatus: status => { if (status === "connected") resolve(); },
    });
  });
  await expect(bridge.request("workspace_apply", {
    version: 1, baseRevision: 0,
    operations: [{ type: "mount", node: { id: "table", component: "Table", datasetId: "branches" } }],
  })).resolves.toMatchObject({ operation: "committed", outcome: "pending", render: { status: "disconnected", revision: 1 } });
});

it("waits for the renderer acknowledgement before returning a presented receipt", async () => {
  vi.stubGlobal("WebSocket", class extends NodeWebSocket {
    constructor(url: string) { super(url, { origin: "http://127.0.0.1:5173" }); }
  });
  bridge = new WorkspaceBridge(0);
  await bridge.ready;
  const store = createWorkspace({ dataPort: data });
  const dispatcher = createCapabilityDispatcher(store);
  const renderer = dispatcher.presentation.connect("test-renderer");
  await new Promise<void>((resolve) => {
    disconnect = connectWorkspace(store, data, {
      url: `ws://127.0.0.1:${bridge?.port}`,
      dispatcher, pairingToken: bridge?.pairingToken, rendererId:"test-renderer",
      onStatus: status => { if (status === "connected") resolve(); },
    });
  });
  let settled = false;
  const request = bridge.request("workspace_apply", {
    version: 1, baseRevision: 0,
    operations: [{ type: "mount", node: { id: "table", component: "Table", datasetId: "branches" } }],
  }).then(value => { settled = true; return value; });
  await vi.waitFor(() => expect(store.getState().revision).toBe(1));
  expect(settled).toBe(false);
  renderer.acknowledge(1,{visible:true});
  await expect(request).resolves.toMatchObject({ outcome: "presented", render: { status: "acknowledged", revision: 1 } });
});

it.each(["asc", "desc"] as const)(
  "keeps missing metric values last when querying %s",
  async (direction) => {
    const incompleteData: DataPort = {
      ...data,
      getSnapshot: () => ({
        status: "ready",
        records: [
          { id: "missing", name: "Missing", approvalRate: null },
          ...snapshot.records,
          { id: "not-numeric", name: "Not numeric", approvalRate: "unknown" },
        ],
      }),
    };
    vi.stubGlobal(
      "WebSocket",
      class extends NodeWebSocket {
        constructor(url: string) {
          super(url, { origin: "http://127.0.0.1:5173" });
        }
      },
    );
    bridge = new WorkspaceBridge(0);
    await bridge.ready;
    const store = createWorkspace({ dataPort: incompleteData });
    await new Promise<void>((resolve) => {
      disconnect = connectWorkspace(store, incompleteData, {
        url: `ws://127.0.0.1:${bridge?.port}`,
        pairingToken: bridge?.pairingToken, rendererId:"test-renderer",
        onStatus: (status) => {
          if (status === "connected") resolve();
        },
      });
    });
    const ordered = direction === "asc" ? ["two", "one"] : ["one", "two"];
    expect(
      await bridge.request("data_query", {
        datasetId: "branches",
        metric: "approvalRate",
        direction,
        limit: 4,
      }),
    ).toMatchObject({
      records: [...ordered, "missing", "not-numeric"].map((id) => ({ id })),
    });
  },
);
