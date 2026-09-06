// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { WebSocket } from "ws";
import { createAeliqoServer } from "./server.js";
import { patchSchema } from "./protocol.js";

type App = ReturnType<typeof createAeliqoServer>;
const openApps: App[] = [];
afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});
async function setup(timeoutMs = 1000, identity: {workspaceId?:string;rendererId?:string} = {}) {
  const app = createAeliqoServer({ port: 0, timeoutMs, ...identity });
  openApps.push(app);
  await app.bridge.ready;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await app.server.connect(serverTransport);
  await client.connect(clientTransport);
  return { app, client };
}
async function connect(app: App, identity = {token:app.bridge.pairingToken,workspaceId:"workspace",rendererId:"test-renderer"}) {
  const browser = new WebSocket(`ws://127.0.0.1:${app.bridge.port}`, {
    origin: "http://127.0.0.1:5173",
  });
  await new Promise<void>((resolve, reject) => {
    browser.once("open", resolve);
    browser.once("error", reject);
  });
  const paired = new Promise<void>((resolve, reject) => {
    browser.once("message", () => resolve());
    browser.once("close", (code) => reject(new Error(`Pairing closed: ${code}`)));
  });
  browser.send(JSON.stringify({type:"pair",...identity}));
  await paired;
  return browser;
}
const patch = {
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
        direction: "asc",
      },
    },
  ],
};

describe("MCP live bridge", () => {
  it("isolates independently configured workspace identities", async () => {
    const {app:first} = await setup(1000,{workspaceId:"operations",rendererId:"operations-tab"});
    const {app:second} = await setup(1000,{workspaceId:"finance",rendererId:"finance-tab"});
    expect(first.bridge.identity).toEqual({workspaceId:"operations",rendererId:"operations-tab"});
    expect(second.bridge.identity).toEqual({workspaceId:"finance",rendererId:"finance-tab"});
    await expect(connect(first,{token:first.bridge.pairingToken,workspaceId:"finance",rendererId:"operations-tab"})).rejects.toThrow("1008");
    await expect(connect(first,{token:second.bridge.pairingToken,workspaceId:"operations",rendererId:"operations-tab"})).rejects.toThrow("1008");
    const firstBrowser=await connect(first,{token:first.bridge.pairingToken,workspaceId:"operations",rendererId:"operations-tab"});
    const secondBrowser=await connect(second,{token:second.bridge.pairingToken,workspaceId:"finance",rendererId:"finance-tab"});
    expect(first.bridge.connected).toBe(true);
    expect(second.bridge.connected).toBe(true);
    firstBrowser.close();secondBrowser.close();
  });

  it("pins one credential, workspace and renderer across reconnect and revocation", async () => {
    const {app} = await setup();
    const identity = {token:app.bridge.pairingToken,workspaceId:"workspace",rendererId:"test-renderer"};
    await expect(connect(app,{...identity,token:"wrong"})).rejects.toThrow("1008");
    await expect(connect(app,{...identity,workspaceId:"other-workspace"})).rejects.toThrow("1008");
    const first = await connect(app);
    await expect(connect(app,{...identity,rendererId:"second-tab"})).rejects.toThrow("1008");
    const closed = new Promise<void>(resolve => first.once("close", () => resolve()));
    first.close(); await closed;
    await expect(connect(app,{...identity,rendererId:"second-tab"})).rejects.toThrow("1008");
    const reconnect = await connect(app);
    const revoked = new Promise<number>(resolve => reconnect.once("close", resolve));
    app.bridge.revoke();
    expect(await revoked).toBe(1008);
    await expect(connect(app)).rejects.toThrow("1008");
    expect(app.bridge.authorize(identity.token)).toBe(false);
    const {app: fresh} = await setup();
    await expect(connect(fresh,identity)).rejects.toThrow("1008");
  });

  it("rejects receipts claiming another renderer and fails outstanding calls on disconnect", async () => {
    const {app} = await setup();
    const browser = await connect(app);
    browser.once("message", raw => {
      const request = JSON.parse(raw.toString()) as {id:string};
      browser.send(JSON.stringify({id:request.id,ok:true,result:{contractVersion:"0.2",requestId:request.id,workspaceId:"workspace",ok:true,revision:1,operation:"committed",render:{status:"acknowledged",rendererId:"other",revision:1,evidence:"renderer-ack",visible:true},data:{status:"ready"},outcome:"presented",changedNodeIds:["ranking"]}}));
    });
    await expect(app.bridge.request("workspace_apply",patch)).rejects.toThrow("receipt target");
    const {app: second} = await setup();
    const other = await connect(second);
    other.once("message",()=>other.close());
    await expect(second.bridge.request("workspace_apply",patch)).rejects.toThrow("disconnected before acknowledgement");
  });
  it("rejects stale or internally inconsistent receipts and cancels pending requests", async () => {
    const {app}=await setup();
    const browser=await connect(app);
    browser.once("message",raw=>{
      const request=JSON.parse(raw.toString()) as {id:string};
      browser.send(JSON.stringify({id:request.id,ok:true,result:{contractVersion:"0.2",requestId:"stale-request",workspaceId:"workspace",ok:true,revision:1,operation:"committed",render:{status:"acknowledged",rendererId:"test-renderer",revision:1,evidence:"renderer-ack",visible:true},data:{status:"ready"},outcome:"presented",changedNodeIds:["ranking"]}}));
    });
    await expect(app.bridge.request("workspace_apply",patch)).rejects.toThrow("receipt target");

    const {app:cancelApp}=await setup();
    const waitingBrowser=await connect(cancelApp);
    waitingBrowser.once("message",()=>undefined);
    const controller=new AbortController();
    const pending=cancelApp.bridge.request("workspace_apply",patch,"MCP",{signal:controller.signal});
    controller.abort(new Error("caller cancelled"));
    await expect(pending).rejects.toThrow("caller cancelled");
    waitingBrowser.close();
  });
  it("propagates MCP client cancellation to the pending browser request", async () => {
    const { app, client } = await setup();
    let bridgeSignal: AbortSignal | undefined;
    const started = new Promise<void>((resolve) => {
      vi.spyOn(app.bridge, "request").mockImplementation(
        async (_method, _params, _source, options) => {
          bridgeSignal = options?.signal;
          resolve();
          return await new Promise((_done, reject) =>
            options?.signal?.addEventListener(
              "abort",
              () => reject(options.signal?.reason),
              { once: true },
            ),
          );
        },
      );
    });
    const controller = new AbortController();
    const pending = client.callTool(
      { name: "workspace_inspect", arguments: {} },
      undefined,
      { signal: controller.signal },
    );
    await started;
    expect(bridgeSignal?.aborted).toBe(false);
    controller.abort();
    await expect(pending).rejects.toThrow();
    await expect.poll(() => bridgeSignal?.aborted).toBe(true);
  });
  it("exposes only semantic tools and rejects writes when no workspace is connected", async () => {
    const { client } = await setup();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "workspace_inspect",
      "catalog_search",
      "data_query",
      "workspace_apply",
    ]);
    const result = await client.callTool({
      name: "workspace_apply",
      arguments: patch,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("No playground connected");
  });

  it("waits for a correlated browser acknowledgement before reporting mutation success", async () => {
    const { app, client } = await setup();
    const browser = await connect(app);
    let resolveRequest: (request: {
      id: string;
      method: string;
      params: unknown;
    }) => void = () => undefined;
    const received = new Promise<{
      id: string;
      method: string;
      params: unknown;
    }>((resolve) => {
      resolveRequest = resolve;
    });
    browser.once("message", (raw) =>
      resolveRequest(JSON.parse(raw.toString())),
    );
    let settled = false;
    const response = client
      .callTool({ name: "workspace_apply", arguments: patch })
      .then((result) => {
        settled = true;
        return result;
      });
    const request = await received;
    expect(request.method).toBe("workspace_apply");
    expect(request.params).toEqual(patch);
    expect(settled).toBe(false);
    browser.send(
      JSON.stringify({
        id: "unrelated-id",
        ok: true,
        result: { ok: true, revision: 999 },
      }),
    );
    expect(settled).toBe(false);
    browser.send(
      JSON.stringify({
        id: request.id,
        ok: true,
          result: { contractVersion:"0.2", requestId:request.id, workspaceId:"workspace", changedNodeIds:["ranking"], ok: true, revision: 1, operation: "committed", outcome: "presented", render: { status: "acknowledged", revision: 1,rendererId:"test-renderer",evidence:"renderer-ack",visible:true }, data: { status: "not-required" } },
      }),
    );
    const result = await response;
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result)).toContain("presented");
  });

  it("propagates core rejections from the browser", async () => {
    const { app, client } = await setup();
    const browser = await connect(app);
    browser.once("message", (raw) =>
      browser.send(
        JSON.stringify({
          id: JSON.parse(raw.toString()).id,
          ok: false,
          error: "Revision conflict",
        }),
      ),
    );
    const result = await client.callTool({
      name: "workspace_apply",
      arguments: patch,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Revision conflict");
  });

  it("times out without falsely claiming a mutation succeeded", async () => {
    const { app, client } = await setup(30);
    await connect(app);
    const result = await client.callTool({
      name: "workspace_apply",
      arguments: patch,
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("outcome is unknown");
  });

  it("rejects arbitrary executable configuration at the boundary", () => {
    expect(
      patchSchema.safeParse({
        ...patch,
        operations: [
          {
            type: "mount",
            node: {
              id: "evil",
              component: "Ranking",
              datasetId: "branches",
              jsx: "<script />",
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      patchSchema.safeParse({
        ...patch,
        operations: [
          { type: "configure", id: "ranking", patch: { css: "body {}" } },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects websocket connections from unrelated web origins", async () => {
    const { app } = await setup();
    const browser = new WebSocket(`ws://127.0.0.1:${app.bridge.port}`, {
      origin: "https://example.com",
    });
    const error = await new Promise<Error>((resolve) =>
      browser.once("error", resolve),
    );
    expect(error.message).toContain("401");
  });
});
