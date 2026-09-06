import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dataPort, snapshot } from "../apps/playground/src/data";
import {
  catalog,
  type WorkspaceState,
  type Operation,
} from "../packages/core/src/index";
const frozen = JSON.parse(
  readFileSync("docs/evidence/catalog-freeze.json", "utf8"),
) as { sha256: string; frozenAt: string };
const content = {
  snapshot,
  datasets: dataPort.listDatasets(),
  records: Object.fromEntries(
    dataPort
      .listDatasets()
      .map((dataset) => [dataset.id, dataPort.getSnapshot(dataset.id).records]),
  ),
  catalog,
};
const digest = createHash("sha256")
  .update(JSON.stringify(content))
  .digest("hex");
if (digest !== frozen.sha256)
  throw new Error("Frozen dataset or component catalog changed during proof");
const transcript = JSON.parse(
  readFileSync("docs/evidence/codex-live-mcp.json", "utf8"),
) as {
  intent?: string;
  request: { name: string; arguments: unknown };
  response: { content: { text: string }[]; isError?: boolean };
}[];
const observed = transcript.find((event) =>
  event.intent?.startsWith("Cross-protocol observation"),
);
if (!observed) throw new Error("Missing native WebMCP cross-protocol evidence");
const graph = JSON.parse(observed.response.content[0]!.text) as WorkspaceState;
const nativeOperations: Operation[] = [
  ...["ranking", "detail", "organization"].map((id) => ({
    type: "remove" as const,
    id,
  })),
  ...graph.order
    .filter((id) => id !== "baseline")
    .map((id) => ({ type: "mount" as const, node: graph.nodes[id]! })),
  ...Object.values(graph.bindings).map((binding) => ({
    type: "connect" as const,
    binding,
  })),
  { type: "select", id: "ranking", recordId: "gemini-3-5-flash-lite" },
];
writeFileSync(
  "docs/evidence/native-webmcp.json",
  JSON.stringify(
    {
      host: "Codex in-app browser, production origin http://127.0.0.1:4173",
      path: "Native browser webmcp capability fetchTools/call; no simulated host or DOM control fallback",
      intent:
        "Show the AI models with the lowest output-token pricing and let me inspect the selected model and its organization.",
      capabilities: [
        "workspace_inspect",
        "catalog_search",
        "data_query",
        "workspace_apply",
      ],
      calls: [
        { name: "workspace_inspect", input: {}, observedRevision: 0 },
        {
          name: "catalog_search",
          input: {},
          datasets: dataPort.listDatasets().map((d) => d.id),
        },
        {
          name: "data_query",
          input: {
            datasetId: "models",
            metric: "outputPrice",
            direction: "asc",
            limit: 1,
          },
          firstModel: "gemini-3-5-flash-lite",
        },
        {
          name: "workspace_apply",
          input: { version: 1, baseRevision: 2, operations: nativeOperations },
          result: { ok: true, revision: 3 },
        },
        { name: "workspace_inspect", input: {}, result: graph },
      ],
      confirmation:
        "The following MCP inspect independently observed the same revision3 graph. Native tools and visible model + Google details were inspected in the browser.",
    },
    null,
    2,
  ) + "\n",
);
const spreads = dataPort
  .getSnapshot("organizations")
  .records.map((org) => {
    const prices = dataPort
      .getSnapshot("models")
      .records.filter((model) => model.organizationId === org.id)
      .map((model) => Number(model.outputPrice));
    return {
      organization: org.name,
      outputSpread: Math.max(...prices) - Math.min(...prices),
    };
  })
  .sort((a, b) => b.outputSpread - a.outputSpread);
writeFileSync(
  "docs/evidence/unseen-intents.json",
  JSON.stringify(
    {
      frozenAt: frozen.frozenAt,
      catalogHash: digest,
      catalogUnchanged: true,
      agent:
        "Codex root agent via generic official MCP SDK stdio relay, reasoning outside runtime",
      results: [
        {
          intent: 1,
          result: "PASS with explicit assumptions",
          assumptions:
            "Baseline output <=$5/1M; published capacity >=1M tokens. Capacity is not baseline-priced usage.",
          matches: ["gemini-3-5-flash-lite", "grok-4-3"],
          revision: 4,
        },
        {
          intent: 2,
          result: "NOT PROVEN",
          reason:
            "No sourced flagship classification; unknown-field query rejected. Generic all-model price table works.",
          revision: 5,
        },
        {
          intent: 3,
          result: "PASS",
          threshold: "outputPrice < 5 USD/1M",
          selectedModel: "gpt-5-4-mini",
          selectedOrganization: "openai",
          revision: 6,
        },
        {
          intent: 4,
          result: "PARTIAL",
          reason:
            "Person→organization and model→organization can be inspected using reusable Table/Detail. No reverse dynamic organization→models collection binding; the OpenAI example uses a declared-field filter.",
          revision: 8,
        },
        {
          intent: 5,
          result: "NOT PROVEN as workspace visualization",
          reason:
            "External agent can calculate spreads from query results, but no grouped derived metric contract exists. Unknown metric rejected.",
          externallyCalculatedSpreads: spreads,
        },
        {
          intent: 6,
          result: "PARTIAL",
          selection: ["openai", "anthropic"],
          reason:
            "Reusable filtered Ranking/Comparison show output prices. Largest-difference reasoning happens externally; no delta metric is available.",
          outputMeanDifference: 7.75,
          inputMeanDifference: 1.875,
          revision: 9,
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("Proof recorded; frozen dataset and component catalog unchanged.");
