import {
  defineDataset,
  type Dataset,
  type DataPort,
  type DataRecord,
  type DataSnapshot,
  type MetricField,
} from "@aeliqo/core";
import { snapshotMetadata, sources } from "./snapshot";
import {
  createUsageRecords,
  summarizeModelUsage,
  usage,
  modelUsage,
} from "./usage";
import { capabilityMetricKeys, createLandscapeGraph } from "./landscape";
export { usage, modelUsage, usageMetadata } from "./usage";
export { snapshotMetadata, sources } from "./snapshot";
const provenance = {
  retrievedAt: snapshotMetadata.retrievedAt,
  snapshotVersion: snapshotMetadata.version,
};
const metadataFields = [
  { key: "source", label: "Official source" },
  { key: "snapshotVersion", label: "Snapshot version" },
];
const timeFields = [{ key: "retrievedAt", label: "Retrieved on" }];
const priceMetrics: readonly MetricField[] = [
  {
    key: "inputPrice",
    label: "Input · USD / 1M tokens",
    format: "currency",
    unit: "USD",
    aggregation: "mean",
    goal: "minimize",
  },
  {
    key: "outputPrice",
    label: "Output · USD / 1M tokens",
    format: "currency",
    unit: "USD",
    aggregation: "mean",
    goal: "minimize",
  },
  {
    key: "cachedInputPrice",
    label: "Cached input · USD / 1M tokens",
    format: "currency",
    unit: "USD",
    aggregation: "mean",
    goal: "minimize",
  },
];
export const organizations = defineDataset({
  id: "organizations",
  entity: "Organization",
  label: "AI organizations",
  description: "Compatibility organization view backed by the same provider records.",
  semanticTags: ["provider", "organization", "portfolio"],
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Organization" },
    { key: "website", label: "Website" },
    { key: "description", label: "Scope" },
    ...metadataFields,
  ],
  metrics: [
    {
      key: "modelCount",
      label: "Models in curated snapshot",
      aggregation: "sum",
    },
    {
      key: "meanInputPrice",
      label: "Mean input price · USD / 1M tokens",
      format: "currency",
      unit: "USD",
      aggregation: "mean",
    },
    {
      key: "meanOutputPrice",
      label: "Mean output price · USD / 1M tokens",
      format: "currency",
      unit: "USD",
      aggregation: "mean",
    },
    {
      key: "outputPriceSpread",
      label: "Output price spread · USD / 1M tokens",
      format: "currency",
      unit: "USD",
      aggregation: "mean",
    },
  ],
  timeFields,
});
export const people = defineDataset({
  id: "people",
  entity: "Person",
  label: "Sourced organization leaders",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Person" },
    { key: "role", label: "Role" },
    { key: "organizationId", label: "Organization identity" },
    ...metadataFields,
  ],
  metrics: [],
  timeFields,
  relationships: [
    {
      id: "organization",
      label: "Organization",
      field: "organizationId",
      targetDatasetId: "organizations",
    },
  ],
});
export const models = defineDataset({
  id: "models",
  entity: "Model",
  label: "AI models and baseline pricing",
  description: "Model-level semantic view materialized once from the connected AI Landscape graph.",
  semanticTags: ["model", "pricing", "capability", "benchmark", "release", "availability"],
  caveat: "Coding benchmark values are a clearly labelled synthetic POC fixture. Prices and published capacities retain their source conditions.",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Model" },
    { key: "organizationId", label: "Organization identity" },
    { key: "organization", label: "Organization" },
    { key: "providerId", label: "Provider identity" },
    { key: "provider", label: "Provider" },
    { key: "family", label: "Family" },
    { key: "modality", label: "Modality" },
    { key: "reasoning", label: "Reasoning" },
    { key: "capabilitySummary", label: "Declared capabilities" },
    { key: "availabilitySummary", label: "Availability channels" },
    { key: "pricingConditions", label: "Pricing conditions" },
    { key: "pricingSource", label: "Official pricing source" },
    ...metadataFields,
  ],
  metrics: [
    ...priceMetrics,
    {
      key: "contextWindow",
      label: "Published context capacity",
      unit: "tokens",
      aggregation: "mean",
      goal: "maximize",
    },
    { key: "maxOutputTokens", label: "Maximum output", unit: "tokens", aggregation: "mean", goal: "maximize" },
    {
      key: "codingScore",
      label: "Coding task success",
      format: "percent",
      aggregation: "mean",
      goal: "maximize",
      comparisonGroup: "poc-coding-suite-v1",
      methodology: "Synthetic normalized coding task suite v1; identical method for every model.",
    },
    { key: "capabilityCount", label: "Capabilities supported", aggregation: "mean", goal: "maximize" },
    { key: "modalityCount", label: "Input modalities", aggregation: "mean", goal: "maximize" },
    { key: "availabilityCount", label: "Availability channels", aggregation: "mean", goal: "maximize" },
    ...capabilityMetricKeys.map((key) => ({
      key,
      label: ({
        capabilityToolUse: "Tool use",
        capabilityReasoning: "Reasoning",
        capabilityVision: "Vision input",
        capabilityAudio: "Audio input",
        capabilityVideo: "Video input",
        capabilityStructuredOutput: "Structured output",
      } as const)[key],
      format: "percent" as const,
      aggregation: "mean" as const,
      goal: "maximize" as const,
    })),
  ],
  timeFields: [{ key: "releaseDate", label: "Release date" }, ...timeFields],
  relationships: [
    {
      id: "organization",
      label: "Organization",
      field: "organizationId",
      targetDatasetId: "organizations",
    },
    {
      id: "provider",
      label: "Provider",
      field: "providerId",
      targetDatasetId: "providers",
    },
  ],
});
export const pricing = defineDataset({
  id: "pricing",
  entity: "Pricing",
  label: "Model pricing snapshot",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Pricing record" },
    { key: "modelId", label: "Model identity" },
    { key: "pricingConditions", label: "Pricing conditions" },
    ...metadataFields,
  ],
  metrics: priceMetrics,
  timeFields,
  relationships: [
    {
      id: "model",
      label: "Model",
      field: "modelId",
      targetDatasetId: "models",
    },
  ],
});
const organizationRecords: readonly DataRecord[] = [
  {
    id: "openai",
    name: "OpenAI",
    website: "https://openai.com",
    description: "GPT model provider",
    source: sources.openai,
    ...provenance,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    website: "https://www.anthropic.com",
    description: "Claude model provider",
    source: sources.anthropic,
    ...provenance,
  },
  {
    id: "google",
    name: "Google / Google DeepMind",
    website: "https://deepmind.google",
    description:
      "Gemini models; Google DeepMind is the AI research organization",
    source: sources.demis,
    ...provenance,
  },
  {
    id: "xai",
    name: "xAI / SpaceXAI",
    website: "https://x.ai",
    description:
      "Grok provider; retrieved developer documentation uses SpaceXAI branding",
    source: sources.xai,
    ...provenance,
  },
];
const peopleRecords: readonly DataRecord[] = [
  {
    id: "sam-altman",
    name: "Sam Altman",
    role: "CEO, OpenAI",
    organizationId: "openai",
    source: sources.sam,
    ...provenance,
  },
  {
    id: "dario-amodei",
    name: "Dario Amodei",
    role: "Co-founder and CEO, Anthropic",
    organizationId: "anthropic",
    source: sources.dario,
    ...provenance,
  },
  {
    id: "demis-hassabis",
    name: "Demis Hassabis",
    role: "CEO, Google DeepMind",
    organizationId: "google",
    source: sources.demis,
    ...provenance,
  },
];
// Only supported organization affiliations are recorded. No person-to-model authorship inference.
const rawModels: readonly DataRecord[] = [
  {
    id: "gpt-5-4",
    name: "GPT-5.4",
    organizationId: "openai",
    family: "GPT",
    inputPrice: 2.5,
    outputPrice: 15,
    cachedInputPrice: 0.25,
    contextWindow: 1050000,
    modality: "Text + image input; text output",
    reasoning: "Configurable effort",
    pricingConditions:
      "Standard text API; ≤272K input tokens. Above: 2× input and 1.5× output for full session.",
    source: sources.openai,
    pricingSource: sources.openai,
  },
  {
    id: "gpt-5-4-mini",
    name: "GPT-5.4 mini",
    organizationId: "openai",
    family: "GPT",
    inputPrice: 0.75,
    outputPrice: 4.5,
    cachedInputPrice: 0.075,
    contextWindow: 400000,
    modality: "Text + image input; text output",
    reasoning: "Configurable effort",
    pricingConditions: "Standard text API; excludes tool and regional charges.",
    source: sources.openaiMini,
    pricingSource: sources.openaiMini,
  },
  {
    id: "claude-opus-5",
    name: "Claude Opus 5",
    organizationId: "anthropic",
    family: "Claude",
    inputPrice: 5,
    outputPrice: 25,
    cachedInputPrice: null,
    contextWindow: 1000000,
    modality: "Text + image input; text output",
    reasoning: "Adaptive thinking",
    pricingConditions:
      "Claude API standard base tokens; cache rates not included in this curated source.",
    source: sources.anthropic,
    pricingSource: sources.anthropic,
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    organizationId: "anthropic",
    family: "Claude",
    inputPrice: 2,
    outputPrice: 10,
    cachedInputPrice: null,
    contextWindow: 1000000,
    modality: "Text + image input; text output",
    reasoning: "Adaptive thinking",
    pricingConditions:
      "Claude API standard base tokens; cache rates not included in this curated source.",
    source: sources.anthropic,
    pricingSource: sources.anthropic,
  },
  {
    id: "gemini-3-5-flash",
    name: "Gemini 3.5 Flash",
    organizationId: "google",
    family: "Gemini",
    inputPrice: 1.5,
    outputPrice: 9,
    cachedInputPrice: 0.15,
    contextWindow: 1048576,
    modality: "Text, image, video, audio + PDF input; text output",
    reasoning: "Thinking supported",
    pricingConditions:
      "Gemini Developer API paid standard tier. Output includes thinking; caching storage billed separately.",
    source: sources.googleFlash,
    pricingSource: sources.google,
  },
  {
    id: "gemini-3-5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    organizationId: "google",
    family: "Gemini",
    inputPrice: 0.3,
    outputPrice: 2.5,
    cachedInputPrice: 0.03,
    contextWindow: 1048576,
    modality: "Text, image, video, audio + PDF input; text output",
    reasoning: "Thinking supported",
    pricingConditions:
      "Gemini Developer API paid standard tier. Output includes thinking; caching storage billed separately.",
    source: sources.googleLite,
    pricingSource: sources.google,
  },
  {
    id: "grok-4-6",
    name: "Grok 4.6",
    organizationId: "xai",
    family: "Grok",
    inputPrice: 2,
    outputPrice: 6,
    cachedInputPrice: 0.5,
    contextWindow: 500000,
    modality: "Text + image input; text output",
    reasoning: "Configurable reasoning",
    pricingConditions:
      "Standard short context <200K tokens. At ≥200K: $4 input / $12 output per million.",
    source: sources.grok46,
    pricingSource: sources.xai,
  },
  {
    id: "grok-4-3",
    name: "Grok 4.3",
    organizationId: "xai",
    family: "Grok",
    inputPrice: 1.25,
    outputPrice: 2.5,
    cachedInputPrice: 0.2,
    contextWindow: 1000000,
    modality: "Text + image input; text output",
    reasoning: "Configurable reasoning",
    pricingConditions:
      "Standard short context <200K tokens. At ≥200K: $2.50 input / $5 output per million.",
    source: sources.grok43,
    pricingSource: sources.xai,
  },
];
// Application-owned materialized view: the join happens once, never in a component or workspace operation.
const baseModelRecords: readonly DataRecord[] = rawModels.map((record) => ({
  ...record,
  organization:
    organizationRecords.find((org) => org.id === record.organizationId)?.name ??
    null,
  ...provenance,
}));
const landscape = createLandscapeGraph(baseModelRecords, organizationRecords);
const modelRecords = landscape.modelRecords;
const pricingRecords = rawModels.map((record) => ({
  id: `${record.id}-standard`,
  name: `${record.name} · standard`,
  modelId: record.id ?? null,
  inputPrice: record.inputPrice ?? null,
  outputPrice: record.outputPrice ?? null,
  cachedInputPrice: record.cachedInputPrice ?? null,
  pricingConditions: record.pricingConditions ?? null,
  source: record.pricingSource ?? null,
  ...provenance,
}));
const organizationSummaries = organizationRecords.map((organization) => {
  const members = modelRecords.filter(
    (model) => model.organizationId === organization.id,
  );
  const inputs = members.map((model) => Number(model.inputPrice));
  const outputs = members.map((model) => Number(model.outputPrice));
  return {
    ...organization,
    modelCount: members.length,
    meanInputPrice:
      inputs.reduce((sum, price) => sum + price, 0) / members.length,
    meanOutputPrice:
      outputs.reduce((sum, price) => sum + price, 0) / members.length,
    outputPriceSpread: Math.max(...outputs) - Math.min(...outputs),
  };
});
const usageRecords = createUsageRecords(modelRecords);
const freezeSnapshot = (records: readonly DataRecord[]): DataSnapshot =>
  Object.freeze({
    status: "ready",
    records: Object.freeze(records.map((record) => Object.freeze(record))),
  });
const snapshots: Readonly<Record<string, DataSnapshot>> = Object.freeze({
  models: freezeSnapshot(modelRecords),
  organizations: freezeSnapshot(organizationSummaries),
  people: freezeSnapshot(peopleRecords),
  pricing: freezeSnapshot(pricingRecords),
  usage: freezeSnapshot(usageRecords),
  "model-usage": freezeSnapshot(
    summarizeModelUsage(modelRecords, usageRecords),
  ),
  ...landscape.snapshots,
});
const datasets: readonly Dataset[] = Object.freeze([
  models,
  organizations,
  pricing,
  people,
  usage,
  modelUsage,
  ...landscape.datasets,
]);
const missing: DataSnapshot = Object.freeze({
  status: "error",
  records: Object.freeze([]),
  error: "Dataset not available",
});
export const dataPort: DataPort = Object.freeze({
  listDatasets: () => datasets,
  getDataset: (id: string) => datasets.find((dataset) => dataset.id === id),
  getSnapshot: (id: string) => snapshots[id] ?? missing,
  subscribe: () => () => {},
});

export const snapshot = Object.freeze({
  ...snapshotMetadata,
  date: snapshotMetadata.retrievedAt,
  sources,
});
