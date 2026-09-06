import {
  defineDataset,
  type DataRecord,
  type DataSnapshot,
  type Dataset,
} from "@aeliqo/core";
import { snapshotMetadata } from "./snapshot";

const metadata = {
  source: "Curated AI Landscape POC snapshot",
  retrievedAt: snapshotMetadata.retrievedAt,
  snapshotVersion: snapshotMetadata.version,
};

const provenanceFields = [
  { key: "source", label: "Source", semanticType: "text" as const },
  { key: "snapshotVersion", label: "Snapshot version", semanticType: "identifier" as const },
];
const snapshotTime = [{ key: "retrievedAt", label: "Retrieved on" }];

const capabilityDefinitions = [
  { id: "tool-use", name: "Tool use", category: "Agentic" },
  { id: "reasoning", name: "Reasoning", category: "Reasoning" },
  { id: "vision", name: "Vision input", category: "Modality" },
  { id: "audio-input", name: "Audio input", category: "Modality" },
  { id: "video-input", name: "Video input", category: "Modality" },
  { id: "structured-output", name: "Structured output", category: "Output" },
] as const;

export const capabilityMetricKeys = [
  "capabilityToolUse",
  "capabilityReasoning",
  "capabilityVision",
  "capabilityAudio",
  "capabilityVideo",
  "capabilityStructuredOutput",
] as const;

const profiles = {
  "gpt-5-4": {
    releaseDate: "2026-08-12",
    maxOutputTokens: 128000,
    codingScore: 0.93,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api", "azure-ai", "cloud-marketplace"],
  },
  "gpt-5-4-mini": {
    releaseDate: "2026-08-12",
    maxOutputTokens: 64000,
    codingScore: 0.79,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api", "azure-ai"],
  },
  "claude-opus-5": {
    releaseDate: "2026-07-21",
    maxOutputTokens: 128000,
    codingScore: 0.91,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api", "aws-bedrock", "google-vertex"],
  },
  "claude-sonnet-5": {
    releaseDate: "2026-07-21",
    maxOutputTokens: 128000,
    codingScore: 0.86,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api", "aws-bedrock", "google-vertex"],
  },
  "gemini-3-5-flash": {
    releaseDate: "2026-06-18",
    maxOutputTokens: 65536,
    codingScore: 0.84,
    capabilities: ["tool-use", "reasoning", "vision", "audio-input", "video-input", "structured-output"],
    modalities: ["text", "image", "audio", "video"],
    channels: ["first-party-api", "google-vertex", "cloud-marketplace"],
  },
  "gemini-3-5-flash-lite": {
    releaseDate: "2026-06-18",
    maxOutputTokens: 65536,
    codingScore: 0.71,
    capabilities: ["tool-use", "reasoning", "vision", "audio-input", "video-input", "structured-output"],
    modalities: ["text", "image", "audio", "video"],
    channels: ["first-party-api", "google-vertex"],
  },
  "grok-4-6": {
    releaseDate: "2026-05-07",
    maxOutputTokens: 64000,
    codingScore: 0.82,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api", "cloud-marketplace"],
  },
  "grok-4-3": {
    releaseDate: "2026-03-14",
    maxOutputTokens: 64000,
    codingScore: 0.74,
    capabilities: ["tool-use", "reasoning", "vision", "structured-output"],
    modalities: ["text", "image"],
    channels: ["first-party-api"],
  },
} as const;

type ProfileId = keyof typeof profiles;
const capabilityKey: Readonly<Record<string, (typeof capabilityMetricKeys)[number]>> = {
  "tool-use": "capabilityToolUse",
  reasoning: "capabilityReasoning",
  vision: "capabilityVision",
  "audio-input": "capabilityAudio",
  "video-input": "capabilityVideo",
  "structured-output": "capabilityStructuredOutput",
};

const freezeSnapshot = (records: readonly DataRecord[]): DataSnapshot =>
  Object.freeze({
    status: "ready",
    metadata,
    records: Object.freeze(records.map((record) => Object.freeze(record))),
  });

export const providers = defineDataset({
  id: "providers",
  entity: "Provider",
  label: "AI model providers",
  description: "Provider entities reused across model, release and availability relationships.",
  semanticTags: ["provider", "portfolio", "organization"],
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Provider", semanticType: "category" as const },
    { key: "website", label: "Website", semanticType: "url" as const },
    { key: "description", label: "Scope", semanticType: "text" as const },
    ...provenanceFields,
  ],
  metrics: [
    { key: "modelCount", label: "Models", aggregation: "sum" as const, goal: "maximize" as const },
    { key: "meanOutputPrice", label: "Mean output price", aggregation: "mean" as const, format: "currency" as const, unit: "USD", goal: "minimize" as const },
    { key: "capabilityCoverage", label: "Capability coverage", aggregation: "mean" as const, format: "percent" as const, goal: "maximize" as const },
  ],
  timeFields: snapshotTime,
  metadata,
});

export const capabilities = defineDataset({
  id: "capabilities",
  entity: "Capability",
  label: "Declared model capabilities",
  semanticTags: ["capability", "feature"],
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Capability" },
    { key: "category", label: "Category" },
    ...provenanceFields,
  ],
  metrics: [],
  timeFields: snapshotTime,
  metadata,
});

export const modalities = defineDataset({
  id: "modalities",
  entity: "Modality",
  label: "Input and output modalities",
  semanticTags: ["modality", "input", "output"],
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Modality" }, ...provenanceFields],
  metrics: [],
  timeFields: snapshotTime,
  metadata,
});

export const modelLimits = defineDataset({
  id: "model-limits",
  entity: "ModelLimit",
  label: "Published model limits",
  semanticTags: ["model", "context", "limit"],
  identity: "id",
  labelField: "model",
  dimensions: [
    { key: "model", label: "Model" },
    { key: "modelId", label: "Model identity" },
    ...provenanceFields,
  ],
  metrics: [
    { key: "contextWindow", label: "Context capacity", unit: "tokens", aggregation: "mean" as const, goal: "maximize" as const },
    { key: "maxOutputTokens", label: "Maximum output", unit: "tokens", aggregation: "mean" as const, goal: "maximize" as const },
  ],
  timeFields: snapshotTime,
  relationships: [{ id: "model", label: "Model", field: "modelId", targetDatasetId: "models" }],
  metadata,
});

export const benchmarks = defineDataset({
  id: "benchmarks",
  entity: "Benchmark",
  label: "Comparable POC benchmark methods",
  description: "Method definitions are separated from results so incompatible methods are never silently combined.",
  semanticTags: ["benchmark", "methodology"],
  caveat: "Coding scores are a synthetic, same-methodology fixture for framework evaluation; they are not product recommendations.",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Benchmark" },
    { key: "methodology", label: "Methodology" },
    ...provenanceFields,
  ],
  metrics: [],
  timeFields: snapshotTime,
  metadata,
});

export const benchmarkResults = defineDataset({
  id: "benchmark-results",
  entity: "BenchmarkResult",
  label: "Comparable coding benchmark results",
  semanticTags: ["benchmark", "performance", "coding"],
  caveat: "Synthetic normalized values share one declared methodology and exist only to test semantic comparison behavior.",
  identity: "id",
  labelField: "model",
  dimensions: [
    { key: "model", label: "Model" },
    { key: "modelId", label: "Model identity" },
    { key: "provider", label: "Provider" },
    { key: "benchmarkId", label: "Benchmark identity" },
    ...provenanceFields,
  ],
  metrics: [
    {
      key: "score",
      label: "Coding task success",
      format: "percent" as const,
      aggregation: "mean" as const,
      goal: "maximize" as const,
      comparisonGroup: "poc-coding-suite-v1",
      methodology: "Synthetic normalized coding task suite v1; identical method for every model.",
    },
  ],
  timeFields: snapshotTime,
  relationships: [
    { id: "model", label: "Model", field: "modelId", targetDatasetId: "models" },
    { id: "benchmark", label: "Benchmark", field: "benchmarkId", targetDatasetId: "benchmarks" },
  ],
  metadata,
});

export const releases = defineDataset({
  id: "releases",
  entity: "Release",
  label: "Model release chronology",
  semanticTags: ["release", "time", "evolution"],
  identity: "id",
  labelField: "model",
  dimensions: [
    { key: "model", label: "Model" },
    { key: "modelId", label: "Model identity" },
    { key: "provider", label: "Provider" },
    { key: "providerId", label: "Provider identity" },
    ...provenanceFields,
  ],
  metrics: [{ key: "releaseCount", label: "Releases", aggregation: "sum" as const }],
  timeFields: [{ key: "releaseDate", label: "Release date" }, ...snapshotTime],
  relationships: [
    { id: "model", label: "Model", field: "modelId", targetDatasetId: "models" },
    { id: "provider", label: "Provider", field: "providerId", targetDatasetId: "providers" },
  ],
  metadata,
});

export const availability = defineDataset({
  id: "availability",
  entity: "Availability",
  label: "Declared model availability channels",
  semanticTags: ["availability", "deployment", "channel"],
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Availability" },
    { key: "model", label: "Model" },
    { key: "modelId", label: "Model identity" },
    { key: "provider", label: "Provider" },
    { key: "providerId", label: "Provider identity" },
    { key: "channel", label: "Channel" },
    ...provenanceFields,
  ],
  metrics: [],
  timeFields: snapshotTime,
  relationships: [
    { id: "model", label: "Model", field: "modelId", targetDatasetId: "models" },
    { id: "provider", label: "Provider", field: "providerId", targetDatasetId: "providers" },
  ],
  metadata,
});

export const modelCapabilities = defineDataset({
  id: "model-capabilities",
  entity: "ModelCapability",
  label: "Model to capability relationships",
  semanticTags: ["model", "capability", "relationship"],
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "name", label: "Model capability" },
    { key: "model", label: "Model" },
    { key: "modelId", label: "Model identity" },
    { key: "capability", label: "Capability" },
    { key: "capabilityId", label: "Capability identity" },
    ...provenanceFields,
  ],
  metrics: [{ key: "supported", label: "Supported", aggregation: "mean" as const, format: "percent" as const }],
  timeFields: snapshotTime,
  relationships: [
    { id: "model", label: "Model", field: "modelId", targetDatasetId: "models" },
    { id: "capability", label: "Capability", field: "capabilityId", targetDatasetId: "capabilities" },
  ],
  metadata,
});

export interface LandscapeGraph {
  modelRecords: readonly DataRecord[];
  datasets: readonly Dataset[];
  snapshots: Readonly<Record<string, DataSnapshot>>;
}

export function createLandscapeGraph(
  baseModels: readonly DataRecord[],
  providerRecords: readonly DataRecord[],
): LandscapeGraph {
  const byId = new Map(baseModels.map((model) => [String(model.id), model]));
  const providerName = new Map(providerRecords.map((provider) => [String(provider.id), String(provider.name)]));
  const modelRecords = baseModels.map((model) => {
    const profile = profiles[String(model.id) as ProfileId];
    if (!profile) return model;
    const flags = Object.fromEntries(capabilityMetricKeys.map((key) => [key, 0])) as Record<string, number>;
    for (const capability of profile.capabilities) flags[capabilityKey[capability]!] = 1;
    return {
      ...model,
      providerId: model.organizationId,
      provider: model.organization,
      releaseDate: profile.releaseDate,
      maxOutputTokens: profile.maxOutputTokens,
      codingScore: profile.codingScore,
      capabilityCount: profile.capabilities.length,
      modalityCount: profile.modalities.length,
      availabilityCount: profile.channels.length,
      capabilitySummary: profile.capabilities.map((id) => capabilityDefinitions.find((item) => item.id === id)?.name).join(", "),
      availabilitySummary: profile.channels.join(", "),
      ...flags,
    };
  });

  const capabilityRecords = capabilityDefinitions.map((capability) => ({ ...capability, ...metadata }));
  const modalityDefinitions = ["text", "image", "audio", "video"].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), ...metadata }));
  const limitRecords = Object.entries(profiles).map(([modelId, profile]) => ({
    id: `${modelId}-limits`,
    modelId,
    model: byId.get(modelId)?.name ?? modelId,
    contextWindow: byId.get(modelId)?.contextWindow ?? null,
    maxOutputTokens: profile.maxOutputTokens,
    source: byId.get(modelId)?.source ?? metadata.source,
    retrievedAt: metadata.retrievedAt,
    snapshotVersion: metadata.snapshotVersion,
  }));
  const benchmarkRecords = [{ id: "poc-coding-suite-v1", name: "POC coding task suite v1", methodology: "Synthetic normalized task success; one shared method across every model.", ...metadata }];
  const resultRecords = Object.entries(profiles).map(([modelId, profile]) => ({
    id: `${modelId}-coding-v1`, modelId, model: byId.get(modelId)?.name ?? modelId,
    provider: providerName.get(String(byId.get(modelId)?.organizationId)) ?? "Unknown",
    benchmarkId: "poc-coding-suite-v1", score: profile.codingScore, ...metadata,
  }));
  const releaseRecords = Object.entries(profiles).map(([modelId, profile]) => ({
    id: `${modelId}-release`, modelId, model: byId.get(modelId)?.name ?? modelId,
    providerId: byId.get(modelId)?.organizationId ?? null,
    provider: providerName.get(String(byId.get(modelId)?.organizationId)) ?? "Unknown",
    releaseDate: profile.releaseDate, releaseCount: 1,
    source: byId.get(modelId)?.source ?? metadata.source,
    retrievedAt: metadata.retrievedAt, snapshotVersion: metadata.snapshotVersion,
  }));
  const availabilityRecords = Object.entries(profiles).flatMap(([modelId, profile]) =>
    profile.channels.map((channel) => ({
      id: `${modelId}-${channel}`, name: `${byId.get(modelId)?.name ?? modelId} · ${channel}`,
      modelId, model: byId.get(modelId)?.name ?? modelId,
      providerId: byId.get(modelId)?.organizationId ?? null,
      provider: providerName.get(String(byId.get(modelId)?.organizationId)) ?? "Unknown",
      channel, ...metadata,
    })),
  );
  const modelCapabilityRecords = Object.entries(profiles).flatMap(([modelId, profile]) =>
    capabilityDefinitions.map((capability) => ({
      id: `${modelId}-${capability.id}`,
      name: `${byId.get(modelId)?.name ?? modelId} · ${capability.name}`,
      modelId,
      model: byId.get(modelId)?.name ?? modelId,
      capabilityId: capability.id,
      capability: capability.name,
      supported: (profile.capabilities as readonly string[]).includes(capability.id) ? 1 : 0,
      ...metadata,
    })),
  );
  const providerSummaries = providerRecords.map((provider) => {
    const members = modelRecords.filter((model) => model.organizationId === provider.id);
    const coverage = members.reduce((sum, model) => sum + Number(model.capabilityCount ?? 0), 0) /
      Math.max(1, members.length * capabilityDefinitions.length);
    const prices = members.map((model) => Number(model.outputPrice));
    return {
      ...provider,
      modelCount: members.length,
      meanOutputPrice: prices.reduce((sum, value) => sum + value, 0) / Math.max(1, prices.length),
      capabilityCoverage: coverage,
    };
  });
  return {
    modelRecords,
    datasets: [providers, capabilities, modalities, modelLimits, benchmarks, benchmarkResults, releases, availability, modelCapabilities],
    snapshots: Object.freeze({
      providers: freezeSnapshot(providerSummaries),
      capabilities: freezeSnapshot(capabilityRecords),
      modalities: freezeSnapshot(modalityDefinitions),
      "model-limits": freezeSnapshot(limitRecords),
      benchmarks: freezeSnapshot(benchmarkRecords),
      "benchmark-results": freezeSnapshot(resultRecords),
      releases: freezeSnapshot(releaseRecords),
      availability: freezeSnapshot(availabilityRecords),
      "model-capabilities": freezeSnapshot(modelCapabilityRecords),
    }),
  };
}
