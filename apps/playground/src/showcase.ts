import {
  catalog,
  type Binding,
  type ComponentType,
  type DataPort,
  type Operation,
  type WorkspaceNode,
  type WorkspaceState,
} from "@aeliqo/core";
import { capabilityMetricKeys } from "./landscape";

export type SemanticNeedKind =
  | "summary"
  | "ranking"
  | "trend"
  | "table"
  | "inspection"
  | "correlation"
  | "distribution"
  | "relationship"
  | "matrix"
  | "comparison"
  | "exploration";

export interface SemanticNeed {
  readonly kind: SemanticNeedKind;
  readonly datasetId: string;
  readonly title: string;
  readonly metric?: string;
  readonly xMetric?: string;
  readonly dimension?: string;
  readonly timeField?: string;
  readonly seriesBy?: string;
  readonly relationship?: string;
  readonly columns?: readonly string[];
  readonly direction?: "asc" | "desc";
  readonly filters?: WorkspaceNode["filters"];
  readonly limit?: number;
  readonly span?: number;
}

export interface ShowcaseScenario {
  readonly id: string;
  readonly shortLabel: string;
  readonly intent: string;
  readonly rationale: string;
  readonly needs: readonly SemanticNeed[];
  readonly initialSelection?: string;
}

export const showcaseScenarios: readonly ShowcaseScenario[] = [
  {
    id: "price-landscape",
    shortLabel: "Price landscape",
    intent: "Show me how current AI models are distributed by output-token price, highlight the cheapest and most expensive models, and let me inspect any model.",
    rationale: "Spread, ordered extremes and inspection share one Model selection channel.",
    needs: [
      { kind: "distribution", datasetId: "models", metric: "outputPrice", title: "Output-price distribution", span: 7 },
      { kind: "ranking", datasetId: "models", metric: "outputPrice", direction: "asc", title: "Price extremes", limit: 8, span: 5 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "family", "outputPrice", "contextWindow", "pricingConditions", "source"], title: "Selected model", span: 12 },
    ],
    initialSelection: "gemini-3-5-flash-lite",
  },
  {
    id: "price-performance",
    shortLabel: "Price × performance",
    intent: "Find models that appear inexpensive relative to their benchmark performance.",
    rationale: "A Pareto frontier avoids inventing a universal quality score; methodology remains visible.",
    needs: [
      { kind: "correlation", datasetId: "models", xMetric: "outputPrice", metric: "codingScore", seriesBy: "provider", title: "Price × comparable coding result", span: 8 },
      { kind: "ranking", datasetId: "models", metric: "codingScore", direction: "desc", title: "Comparable coding results", limit: 8, span: 4 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "outputPrice", "codingScore", "contextWindow", "capabilitySummary", "source"], title: "Selected model evidence", span: 12 },
    ],
    initialSelection: "gpt-5-4-mini",
  },
  {
    id: "large-context",
    shortLabel: "Large-context value",
    intent: "Which models combine a large context window with relatively low output-token pricing?",
    rationale: "Two declared measures remain separate; the view exposes their trade-off directly.",
    needs: [
      { kind: "correlation", datasetId: "models", xMetric: "outputPrice", metric: "contextWindow", seriesBy: "provider", title: "Context capacity × output price", span: 8 },
      { kind: "ranking", datasetId: "models", metric: "contextWindow", direction: "desc", filters: [{ field: "outputPrice", operator: "lte", value: 10 }], title: "Large context below $10 output", limit: 8, span: 4 },
      { kind: "comparison", datasetId: "models", metric: "outputPrice", title: "Output-price comparison", span: 7 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "outputPrice", "contextWindow", "maxOutputTokens", "pricingConditions"], title: "Selected model", span: 5 },
    ],
    initialSelection: "gemini-3-5-flash-lite",
  },
  {
    id: "provider-portfolio",
    shortLabel: "Provider portfolio",
    intent: "Show the major AI providers and how their model portfolios differ.",
    rationale: "Declared provider relationships, portfolio summaries and capability coverage answer different parts of the same question.",
    needs: [
      { kind: "relationship", datasetId: "models", relationship: "provider", title: "Providers → model portfolios", span: 7 },
      { kind: "comparison", datasetId: "providers", metric: "meanOutputPrice", title: "Provider price portfolios", span: 5 },
      { kind: "matrix", datasetId: "models", columns: capabilityMetricKeys, title: "Portfolio capability matrix", span: 12 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "family", "capabilitySummary", "availabilitySummary", "outputPrice"], title: "Selected portfolio model", span: 12 },
    ],
    initialSelection: "claude-sonnet-5",
  },
  {
    id: "capability-landscape",
    shortLabel: "Capabilities",
    intent: "Which models support the broadest set of capabilities, and what capabilities distinguish them?",
    rationale: "The ranking summarizes breadth while the matrix preserves each declared feature.",
    needs: [
      { kind: "matrix", datasetId: "models", columns: capabilityMetricKeys, title: "Model capability landscape", span: 8 },
      { kind: "ranking", datasetId: "models", metric: "capabilityCount", direction: "desc", title: "Capability breadth", limit: 8, span: 4 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "capabilitySummary", "capabilityCount", "modalityCount", "availabilityCount"], title: "Selected model", span: 12 },
    ],
    initialSelection: "gemini-3-5-flash",
  },
  {
    id: "release-evolution",
    shortLabel: "Release evolution",
    intent: "Show how the competitive AI landscape has evolved across releases.",
    rationale: "Only declared release dates are trended; no historical pricing is fabricated.",
    needs: [
      { kind: "trend", datasetId: "releases", metric: "releaseCount", timeField: "releaseDate", seriesBy: "provider", title: "Release chronology by provider", span: 8 },
      { kind: "table", datasetId: "releases", columns: ["model", "provider", "releaseDate"], title: "Declared releases", span: 4 },
      { kind: "inspection", datasetId: "releases", columns: ["modelId", "provider", "releaseDate", "source"], title: "Selected release", span: 12 },
    ],
    initialSelection: "grok-4-3-release",
  },
  {
    id: "availability",
    shortLabel: "Availability",
    intent: "Which models are available through multiple deployment or provider channels?",
    rationale: "Model-level breadth links to the underlying channel records without inventing deployment support.",
    needs: [
      { kind: "ranking", datasetId: "models", metric: "availabilityCount", direction: "desc", title: "Channel breadth by model", span: 5 },
      { kind: "table", datasetId: "availability", columns: ["model", "provider", "channel"], title: "Declared availability channels", span: 7 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "availabilitySummary", "availabilityCount", "source"], title: "Selected model", span: 12 },
    ],
    initialSelection: "claude-opus-5",
  },
  {
    id: "multi-dimensional",
    shortLabel: "Trade-off investigation",
    intent: "I want a model with low output price, large context, strong coding results, and tool support. Show me the trade-offs.",
    rationale: "Price, capacity, comparable coding evidence and declared capabilities remain inspectable rather than collapsing into one opaque score.",
    needs: [
      { kind: "correlation", datasetId: "models", xMetric: "outputPrice", metric: "contextWindow", seriesBy: "provider", filters: [{ field: "capabilityToolUse", operator: "eq", value: 1 }], title: "Price × context · tool-capable models", span: 7 },
      { kind: "ranking", datasetId: "models", metric: "codingScore", direction: "desc", filters: [{ field: "capabilityToolUse", operator: "eq", value: 1 }, { field: "outputPrice", operator: "lte", value: 10 }], title: "Coding evidence under $10 output", limit: 8, span: 5 },
      { kind: "matrix", datasetId: "models", columns: capabilityMetricKeys, title: "Capability trade-offs", span: 8 },
      { kind: "inspection", datasetId: "models", columns: ["provider", "outputPrice", "contextWindow", "codingScore", "capabilitySummary"], title: "Selected candidate", span: 4 },
    ],
    initialSelection: "gemini-3-5-flash",
  },
];

const purposeTerms: Readonly<Record<SemanticNeedKind, string>> = {
  summary: "Summarize",
  ranking: "Order entities",
  trend: "over time",
  table: "Inspect entity records",
  inspection: "selected entity",
  correlation: "correlation",
  distribution: "spread",
  relationship: "declared relationship",
  matrix: "boolean or categorical",
  comparison: "Compare measures",
  exploration: "Explore and inspect",
};

function matchComponent(kind: SemanticNeedKind): ComponentType {
  const term = purposeTerms[kind].toLowerCase();
  const match = catalog.find((capability) => capability.purpose.toLowerCase().includes(term));
  if (!match) throw new Error(`No trusted component matches semantic need: ${kind}`);
  return match.component;
}

const optionalNodeKeys = [
  "title", "metric", "xMetric", "dimension", "timeField", "direction", "limit",
  "filters", "columns", "seriesBy", "relationship", "span", "height", "density",
] as const;

function nodeForNeed(need: SemanticNeed): WorkspaceNode {
  return {
    id: `smart-${need.kind}`,
    component: matchComponent(need.kind),
    datasetId: need.datasetId,
    title: need.title,
    metric: need.metric,
    xMetric: need.xMetric,
    dimension: need.dimension,
    timeField: need.timeField,
    seriesBy: need.seriesBy,
    relationship: need.relationship,
    columns: need.columns,
    direction: need.direction,
    filters: need.filters,
    limit: need.limit,
    span: need.span,
  };
}

export interface ComposedShowcase {
  readonly operations: readonly Operation[];
  readonly nodes: readonly WorkspaceNode[];
  readonly contracts: readonly { need: SemanticNeedKind; component: ComponentType }[];
  readonly relationships: readonly string[];
}

export function composeShowcase(
  scenario: ShowcaseScenario,
  state: WorkspaceState,
  dataPort: DataPort,
): ComposedShowcase {
  const nodes = scenario.needs.map(nodeForNeed);
  const desiredIds = new Set(nodes.map((node) => node.id));
  const operations: Operation[] = Object.keys(state.bindings).map((id) => ({ type: "disconnect", id }));
  for (const id of state.order) {
    if (!desiredIds.has(id) && id !== "baseline") operations.push({ type: "remove", id });
  }
  for (const node of nodes) {
    const existing = state.nodes[node.id];
    if (!existing) operations.push({ type: "mount", node });
    else {
      const nodePatch = Object.fromEntries(
        Object.entries(node).filter(([key]) => key !== "id"),
      ) as Partial<Omit<WorkspaceNode, "id">>;
      operations.push({
        type: "configure",
        id: node.id,
        patch: nodePatch,
        unset: optionalNodeKeys.filter((key) => node[key] === undefined),
      });
    }
  }
  nodes.forEach((node, index) => operations.push({ type: "move", id: node.id, index }));

  const source = nodes.find((node) => node.component === "Ranking") ??
    nodes.find((node) => ["Table", "Scatter", "Relationship", "Matrix"].includes(node.component));
  const bindings: Binding[] = [];
  if (source) {
    const sourceDataset = dataPort.getDataset(source.datasetId);
    for (const target of nodes) {
      if (target.id === source.id) continue;
      const targetContract = catalog.find((capability) => capability.component === target.component);
      const targetDataset = dataPort.getDataset(target.datasetId);
      if (!targetContract?.interactions.includes("receive-selection") || !sourceDataset || !targetDataset) continue;
      if (sourceDataset.entity === targetDataset.entity) {
        bindings.push({ id: `link-${source.id}-${target.id}`, source: source.id, target: target.id, entity: sourceDataset.entity });
      }
    }
  }
  operations.push(...bindings.map((binding) => ({ type: "connect" as const, binding })));
  if (source && scenario.initialSelection && dataPort.getSnapshot(source.datasetId).records.some((record) => String(record[dataPort.getDataset(source.datasetId)!.identity]) === scenario.initialSelection)) {
    operations.push({ type: "select", id: source.id, recordId: scenario.initialSelection });
  }
  return {
    operations,
    nodes,
    contracts: scenario.needs.map((need, index) => ({ need: need.kind, component: nodes[index]!.component })),
    relationships: nodes.flatMap((node) => node.relationship ? [`${node.datasetId}.${node.relationship}`] : []),
  };
}
