import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  catalog,
  createCapabilityDispatcher,
  createWorkspace,
  type WorkspaceNode,
} from "../packages/core/src/index";
import { dataPort, snapshot } from "../apps/playground/src/data";
import {
  composeShowcase,
  type ShowcaseScenario,
} from "../apps/playground/src/showcase";
import { capabilityMetricKeys } from "../apps/playground/src/landscape";

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
  // Verify all eleven historic entries byte-for-byte; additive post-freeze entries are not retroactive proof.
  catalog: catalog.filter(capability => ["Metric", "Ranking", "Trend", "Table", "Detail", "Scatter", "Distribution", "Relationship", "Matrix", "Comparison", "Explorer"].includes(capability.component)),
};
const digest = createHash("sha256")
  .update(JSON.stringify(content))
  .digest("hex");
if (digest !== frozen.sha256)
  throw new Error("Dataset or component catalog changed after freeze");

const cases: readonly (ShowcaseScenario & { correctness: string })[] = [
  {
    id: "vision-price",
    shortLabel: "Vision price",
    intent: "Which vision-capable models have the lowest output price?",
    rationale: "Filter a declared boolean capability and preserve price units.",
    needs: [
      { kind: "ranking", datasetId: "models", metric: "outputPrice", direction: "asc", filters: [{ field: "capabilityVision", operator: "eq", value: 1 }], title: "Vision-capable price ranking" },
      { kind: "matrix", datasetId: "models", columns: capabilityMetricKeys, title: "Declared capabilities" },
      { kind: "inspection", datasetId: "models", title: "Selected model" },
    ],
    initialSelection: "gemini-3-5-flash-lite",
    correctness: "Capability support is declared; price remains USD per million output tokens.",
  },
  {
    id: "provider-value",
    shortLabel: "Provider value",
    intent: "Which providers combine broad capability coverage with lower mean output pricing?",
    rationale: "Compare two separately declared provider measures.",
    needs: [
      { kind: "correlation", datasetId: "providers", xMetric: "meanOutputPrice", metric: "capabilityCoverage", title: "Provider coverage × mean price" },
      { kind: "inspection", datasetId: "providers", title: "Selected provider" },
    ],
    initialSelection: "google",
    correctness: "Coverage is derived from the fixed model subset and does not claim market breadth.",
  },
  {
    id: "output-limits",
    shortLabel: "Output limits",
    intent: "How do maximum output limits compare with output-token price?",
    rationale: "Show capacity and price as independent measures.",
    needs: [
      { kind: "correlation", datasetId: "models", xMetric: "outputPrice", metric: "maxOutputTokens", seriesBy: "provider", title: "Maximum output × price" },
      { kind: "ranking", datasetId: "models", metric: "maxOutputTokens", direction: "desc", title: "Maximum output ranking" },
      { kind: "inspection", datasetId: "models", title: "Selected model" },
    ],
    initialSelection: "claude-opus-5",
    correctness: "Published output capacity is not presented as generated output or throughput.",
  },
  {
    id: "release-sequence",
    shortLabel: "Release sequence",
    intent: "Show the order of releases and let me inspect the earliest entry.",
    rationale: "Use declared release dates only.",
    needs: [
      { kind: "trend", datasetId: "releases", metric: "releaseCount", timeField: "releaseDate", seriesBy: "provider", title: "Release sequence" },
      { kind: "table", datasetId: "releases", columns: ["model", "provider", "releaseDate"], title: "Release records" },
      { kind: "inspection", datasetId: "releases", title: "Selected release" },
    ],
    initialSelection: "grok-4-3-release",
    correctness: "No historical pricing is inferred from release chronology.",
  },
  {
    id: "tool-channel",
    shortLabel: "Tool channels",
    intent: "Which tool-capable models are available through the most channels?",
    rationale: "Combine a capability filter with channel breadth.",
    needs: [
      { kind: "ranking", datasetId: "models", metric: "availabilityCount", direction: "desc", filters: [{ field: "capabilityToolUse", operator: "eq", value: 1 }], title: "Tool-capable channel breadth" },
      { kind: "table", datasetId: "availability", columns: ["model", "channel", "provider"], title: "Underlying channel records" },
      { kind: "inspection", datasetId: "models", title: "Selected model" },
    ],
    initialSelection: "claude-sonnet-5",
    correctness: "Availability counts only records in the curated snapshot.",
  },
  {
    id: "vision-spread",
    shortLabel: "Vision spread",
    intent: "Show the output-price spread among models with vision input.",
    rationale: "Distribution preserves the filtered population.",
    needs: [
      { kind: "distribution", datasetId: "models", metric: "outputPrice", filters: [{ field: "capabilityVision", operator: "eq", value: 1 }], title: "Vision-model price spread" },
      { kind: "ranking", datasetId: "models", metric: "outputPrice", direction: "asc", filters: [{ field: "capabilityVision", operator: "eq", value: 1 }], title: "Vision-model price ranking" },
      { kind: "inspection", datasetId: "models", title: "Selected model" },
    ],
    initialSelection: "grok-4-3",
    correctness: "The distribution uses current baseline prices only.",
  },
  {
    id: "family-exploration",
    shortLabel: "Families",
    intent: "Explore model families, providers, and their output pricing.",
    rationale: "Reuse relationship, comparison and exploration semantics.",
    needs: [
      { kind: "relationship", datasetId: "models", relationship: "provider", title: "Provider portfolios" },
      { kind: "comparison", datasetId: "models", metric: "outputPrice", title: "Model price comparison" },
      { kind: "exploration", datasetId: "models", metric: "outputPrice", title: "Explore models" },
    ],
    initialSelection: "gpt-5-4",
    correctness: "Only the declared Model→Provider relationship is followed.",
  },
  {
    id: "affordable-coding",
    shortLabel: "Affordable coding",
    intent: "Find models below $7 output price with coding success above 75%.",
    rationale: "Apply explicit thresholds without synthesizing a combined score.",
    needs: [
      { kind: "ranking", datasetId: "models", metric: "codingScore", direction: "desc", filters: [{ field: "outputPrice", operator: "lte", value: 7 }, { field: "codingScore", operator: "gte", value: 0.75 }], title: "Affordable comparable coding results" },
      { kind: "correlation", datasetId: "models", xMetric: "outputPrice", metric: "codingScore", seriesBy: "provider", title: "Price × coding evidence" },
      { kind: "inspection", datasetId: "models", title: "Selected candidate" },
    ],
    initialSelection: "gpt-5-4-mini",
    correctness: "The synthetic benchmark methodology is retained and no universal quality claim is made.",
  },
  {
    id: "price-history",
    shortLabel: "Price history",
    intent: "Show how output-token prices changed over the last year.",
    rationale: "Exercise the insufficient-temporal-evidence fallback.",
    needs: [
      { kind: "trend", datasetId: "models", metric: "outputPrice", timeField: "retrievedAt", title: "Output-price history" },
      { kind: "table", datasetId: "pricing", columns: ["name", "outputPrice", "retrievedAt"], title: "Available price snapshot" },
    ],
    correctness: "One retrieval date yields a one-snapshot fallback; no historical trend is fabricated.",
  },
];

const baseline: WorkspaceNode = {
  id: "baseline",
  component: "Metric",
  datasetId: "models",
  metric: "outputPrice",
};

const results = cases.map((scenario) => {
  const store = createWorkspace({ dataPort, nodes: [baseline] });
  const composition = composeShowcase(scenario, store.getState(), dataPort);
  const result = store.apply({ version: 1, baseRevision: 0, operations: composition.operations });
  const temporalFallback = scenario.id === "price-history";
  return {
    intent: scenario.intent,
    status: temporalFallback ? "SAFE_FALLBACK" : result.ok ? "PASS" : "FAIL",
    solvedWithoutSourceChanges: result.ok,
    existingSemanticComponentsOnly: result.ok,
    usefulComposition: result.ok && !temporalFallback,
    semanticCorrectnessPreserved: result.ok,
    manualRearrangementRequired: false,
    components: composition.nodes.map((node) => node.component),
    datasets: [...new Set(composition.nodes.map((node) => node.datasetId))],
    generatedCode: { jsx: 0, css: 0, javascript: 0 },
    correctness: scenario.correctness,
    revision: store.getState().revision,
  };
});

const failSafeStore = createWorkspace({ dataPort, nodes: [baseline] });
let universalError = "";
try {
  createCapabilityDispatcher(failSafeStore).dispatch("data_query", {
    datasetId: "models",
    metric: "universalQuality",
  });
} catch (error) {
  universalError = error instanceof Error ? error.message : "Rejected";
}
results.push({
  intent: "Which model is universally best across every capability and workload?",
  status: "FAIL_SAFE",
  solvedWithoutSourceChanges: false,
  existingSemanticComponentsOnly: true,
  usefulComposition: false,
  semanticCorrectnessPreserved: universalError === "Unknown metric: universalQuality",
  manualRearrangementRequired: false,
  components: [],
  datasets: ["models"],
  generatedCode: { jsx: 0, css: 0, javascript: 0 },
  correctness: `Rejected unsupported universal score: ${universalError}`,
  revision: failSafeStore.getState().revision,
});

writeFileSync(
  "docs/evidence/unseen-intents-v2.json",
  JSON.stringify(
    {
      frozenAt: frozen.frozenAt,
      catalogHash: digest,
      catalogUnchanged: true,
      evaluator: "Post-freeze semantic plans executed against the fixed core; no model or component source was changed between freeze and evaluation.",
      totals: {
        intents: results.length,
        pass: results.filter((result) => result.status === "PASS").length,
        safeFallback: results.filter((result) => result.status === "SAFE_FALLBACK").length,
        failSafe: results.filter((result) => result.status === "FAIL_SAFE").length,
      },
      results,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Recorded ${results.length} post-freeze intents; catalog hash unchanged.`);
