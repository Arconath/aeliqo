// @vitest-environment node
import { expect, it, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createWorkspace,
  createCapabilityDispatcher,
  capabilityContracts,
  type CapabilityEvent,
  type CapabilityName,
  type WorkspaceRequest,
} from "../packages/core/src/index";
import { createAeliqoServer } from "../packages/mcp/src/server";
import { runAgent, createScriptedProvider } from "../packages/byok/src/index";
import {
  registerWebMCP,
  type WebMCPTool,
} from "../packages/webmcp-experimental/src/index";
import { dataPort } from "../apps/playground/src/data";
const intent =
  "Show me models with low output pricing and large context windows, and let me inspect the selected model.";
const patch: WorkspaceRequest = {
  version: 1,
  baseRevision: 0,
  operations: [
    {
      type: "mount",
      node: {
        id: "ranking",
        component: "Ranking",
        datasetId: "models",
        metric: "outputPrice",
        direction: "asc",
        filters: [
          { field: "outputPrice", operator: "lte", value: 10 },
          { field: "contextWindow", operator: "gte", value: 1000000 },
        ],
      },
    },
    {
      type: "mount",
      node: {
        id: "scatter",
        component: "Scatter",
        datasetId: "models",
        xMetric: "outputPrice",
        metric: "contextWindow",
        seriesBy: "provider",
        filters: [
          { field: "outputPrice", operator: "lte", value: 10 },
          { field: "contextWindow", operator: "gte", value: 1000000 },
        ],
      },
    },
    {
      type: "mount",
      node: { id: "detail", component: "Detail", datasetId: "models" },
    },
    {
      type: "mount",
      node: {
        id: "organization",
        component: "Detail",
        datasetId: "organizations",
      },
    },
    {
      type: "connect",
      binding: {
        id: "selection",
        source: "ranking",
        target: "detail",
        entity: "Model",
      },
    },
    {
      type: "connect",
      binding: {
        id: "scatter-selection",
        source: "ranking",
        target: "scatter",
        entity: "Model",
      },
    },
    {
      type: "connect",
      binding: {
        id: "organization-selection",
        source: "detail",
        target: "organization",
        entity: "Organization",
        relationship: "organization",
      },
    },
    { type: "select", id: "ranking", recordId: "gemini-3-5-flash-lite" },
  ],
};
const calls: { name: CapabilityName; arguments: unknown }[] = [
  { name: "workspace_inspect", arguments: {} },
  { name: "catalog_search", arguments: {} },
  {
    name: "data_query",
    arguments: {
      datasetId: "models",
      metric: "outputPrice",
      direction: "asc",
      limit: 8,
      filters: [
        { field: "outputPrice", operator: "lte", value: 10 },
        { field: "contextWindow", operator: "gte", value: 1000000 },
      ],
    },
  },
  { name: "workspace_apply", arguments: patch },
];
it("MCP, deterministic BYOK and simulated current WebMCP converge on the same graph and semantics", async () => {
  const evidence: unknown[] = [];
  const outcomes: unknown[] = [];
  for (const source of ["MCP", "BYOK", "WebMCP"] as const) {
    const store = createWorkspace({ dataPort });
    const events: CapabilityEvent[] = [];
    const dispatcher = createCapabilityDispatcher(store, {
      onEvent: (event) => events.push(event),
      now: () => performance.now(),
    });
    if (source === "MCP") {
      const app = createAeliqoServer({ port: 0 });
      await app.bridge.ready;
      vi.spyOn(app.bridge, "request").mockImplementation(async (name, input) =>
        dispatcher.dispatch(name, input, { source }),
      );
      const client = new Client({
        name: "parity-contract-client",
        version: "2",
      });
      const [a, b] = InMemoryTransport.createLinkedPair();
      try {
        await Promise.all([app.server.connect(a), client.connect(b)]);
        expect(
          (await client.listTools()).tools.map((tool) => tool.name),
        ).toEqual(capabilityContracts.map((tool) => tool.id));
        for (const call of calls)
          expect(
            (
              await client.callTool({
                name: call.name,
                arguments: call.arguments as Record<string, unknown>,
              })
            ).isError,
          ).not.toBe(true);
      } finally {
        await client.close();
        await app.close();
      }
    } else if (source === "BYOK") {
      const provider = createScriptedProvider([
        ...calls.map((call, i) => ({ calls: [{ id: String(i), ...call }] })),
        { calls: [], text: "Scripted canonical fixture complete" },
      ]);
      const result = await runAgent(provider, intent, (name, input) =>
        dispatcher.dispatch(name, input, { source }),
      );
      expect(result.toolCalls).toBe(4);
    } else {
      const tools = new Map<string, WebMCPTool>();
      const registration = await registerWebMCP(dispatcher, {
        registerTool: (tool, { signal }) => {
          tools.set(tool.name, tool);
          signal.addEventListener("abort", () => tools.delete(tool.name));
        },
      });
      expect([...tools.keys()]).toEqual(
        capabilityContracts.map((tool) => tool.id),
      );
      for (const call of calls)
        await tools.get(call.name)!.execute(call.arguments);
      registration.dispose();
      expect(tools.size).toBe(0);
    }
    expect(store.getSelection("detail")).toBe("gemini-3-5-flash-lite");
    expect(store.getSelection("scatter")).toBe("gemini-3-5-flash-lite");
    expect(store.getSelection("organization")).toBe("google");
    expect(events.map((event) => event.source)).toEqual(Array(4).fill(source));
    outcomes.push(store.getState());
    evidence.push({
      source,
      intent,
      proofKind:
        source === "MCP"
          ? "SDK in-memory protocol with dispatcher transport fixture"
          : source === "BYOK"
            ? "deterministic test provider, no real model"
            : "simulated document.modelContext host, not native browser proof",
      capabilities: capabilityContracts.map((contract) => contract.id),
      calls,
      events,
      graph: store.getState(),
      outcome: {
        rankingMetric: "outputPrice",
        correlation: ["outputPrice", "contextWindow"],
        direction: "asc",
        selectedModel: store.getSelection("detail"),
        selectedOrganization: store.getSelection("organization"),
      },
    });
  }
  expect(outcomes[1]).toEqual(outcomes[0]);
  expect(outcomes[2]).toEqual(outcomes[0]);
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    "docs/evidence/protocol-parity.json",
    JSON.stringify({ intent, evidence }, null, 2) + "\n",
  );
});
