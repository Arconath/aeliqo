import {
  bindVisualizationSpec,
  parseResult,
  parseVisualizationSpec,
  parseWireValue,
  type InteractionPort,
  type InteractionState,
  type Outcome,
  type PresentationManifest,
  type PresentationNode,
  type PresentationValues,
  type Result,
  type ResultRef,
  type ResolvedPresentationConfig,
  type ValidatedPresentation,
  type VersionRef,
  type VisualizationBindingContext,
  type VisualizationSpec,
} from "@aeliqo/core";
import {materializeVisualizationRows} from "../visualization/materialization.js";
import type {VisualizationDataset} from "../visualization/types.js";
import {
  renderAeliqoVisualizationPresentationNode,
} from "./visualization-renderer.js";
import {nothing, type TemplateResult} from "lit";

/** The twelve semantic visualization representations shipped by the web host. */
export const AELIQO_VISUALIZATION_REFS = Object.freeze({
  trend: {id: "visualization.trend", revision: "1"},
  bar: {id: "visualization.bar", revision: "1"},
  area: {id: "visualization.area", revision: "1"},
  scatter: {id: "visualization.scatter", revision: "1"},
  histogram: {id: "visualization.histogram", revision: "1"},
  heatmap: {id: "visualization.heatmap", revision: "1"},
  matrix: {id: "visualization.matrix", revision: "1"},
  timeline: {id: "visualization.timeline", revision: "1"},
  "calendar-grid": {id: "visualization.calendar-grid", revision: "1"},
  tree: {id: "visualization.tree", revision: "1"},
  treemap: {id: "visualization.treemap", revision: "1"},
  relationship: {id: "visualization.relationship", revision: "1"},
} satisfies Record<VisualizationSpec["view"], VersionRef>);

export const AELIQO_VISUALIZATION_CONFIG_SCHEMAS = Object.freeze({
  trend: {id: "visualization.trend.config", revision: "1"},
  bar: {id: "visualization.bar.config", revision: "1"},
  area: {id: "visualization.area.config", revision: "1"},
  scatter: {id: "visualization.scatter.config", revision: "1"},
  histogram: {id: "visualization.histogram.config", revision: "1"},
  heatmap: {id: "visualization.heatmap.config", revision: "1"},
  matrix: {id: "visualization.matrix.config", revision: "1"},
  timeline: {id: "visualization.timeline.config", revision: "1"},
  "calendar-grid": {id: "visualization.calendar-grid.config", revision: "1"},
  tree: {id: "visualization.tree.config", revision: "1"},
  treemap: {id: "visualization.treemap.config", revision: "1"},
  relationship: {id: "visualization.relationship.config", revision: "1"},
} satisfies Record<VisualizationSpec["view"], VersionRef>);

export const AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS = Object.freeze({
  read: {id: "data.read", revision: "1"},
  selection: {id: "interaction.selection", revision: "1"},
} satisfies Record<"read" | "selection", VersionRef>);
export const AELIQO_VISUALIZATION_OPERATIONS = AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS;

export type AeliqoAuthorizedVisualizationBindings =
  | readonly AeliqoVisualizationBinding[]
  | ReadonlyMap<string, AeliqoVisualizationBinding>
  | Readonly<Record<string, AeliqoVisualizationBinding>>;

export interface AeliqoVisualizationBinding {
  /** The primary Result descriptor used by the presentation node. */
  readonly result: Result;
  /** All exact descriptors and host-owned catalog meaning declarations needed by the spec. */
  readonly context: VisualizationBindingContext;
  /** Materialized rows keyed by exact ResultRef. */
  readonly datasets: readonly VisualizationDataset[];
}

export interface AeliqoVisualizationRegistryOptions {
  /** Trusted application binding for the entity represented by a Result. */
  readonly resolveEntity?: (result: Result) => string | undefined;
  readonly maxDatasets?: number;
}

export interface AeliqoVisualizationPresentationRenderContext {
  readonly onSemanticInteraction?: (nodeId: string, portId: string, payload: import("@aeliqo/core").InteractionPayload) => void;
  readonly interaction?: InteractionState;
}

export interface AeliqoVisualizationPresentationRegistry {
  readonly manifests: readonly PresentationManifest[];
  readonly bindingFor: (ref: ResultRef) => Outcome<AeliqoVisualizationBinding>;
  readonly render: (
    node: ValidatedPresentation["nodes"][number],
    binding: AeliqoVisualizationBinding,
    context?: AeliqoVisualizationPresentationRenderContext,
  ) => TemplateResult | typeof nothing;
}

type VisualizationView = VisualizationSpec["view"];
type CoreNode = ValidatedPresentation["nodes"][number];

const VIEWS: readonly VisualizationView[] = [
  "trend", "bar", "area", "scatter", "histogram", "heatmap", "matrix",
  "timeline", "calendar-grid", "tree", "treemap", "relationship",
];
const MAX_DATASETS = 64;

const fail = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{code: `web.visualization.presentation.${code}`, message, retryable: false}],
});

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function versionKey(ref: VersionRef): string {
  return JSON.stringify([ref.id, ref.revision]);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function sameRef(left: ResultRef | undefined, right: ResultRef): boolean {
  try { return left !== undefined && refKey(left) === refKey(right); } catch { return false; }
}

function sameResult(left: Result | undefined, right: Result): boolean {
  return left !== undefined && sameRef(left.ref, right.ref) && canonical(left) === canonical(right);
}

function entriesFor(input: AeliqoAuthorizedVisualizationBindings): readonly (readonly [string, AeliqoVisualizationBinding])[] {
  if (input instanceof Map) return [...input.entries()];
  if (Array.isArray(input)) return input.map((binding) => [refKey(binding.result.ref), binding] as const);
  return Object.entries(input);
}

function parseDatasets(input: readonly VisualizationDataset[], maxDatasets: number): Outcome<readonly VisualizationDataset[]> {
  const inspected = parseWireValue(input);
  if (!inspected.ok) return inspected;
  if (!Array.isArray(inspected.value) || inspected.value.length > maxDatasets) return fail("datasets", "Visualization materializations exceed the bounded host limit.");
  const seen = new Set<string>();
  for (const item of inspected.value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return fail("dataset", "A visualization materialization must be an object.");
    const candidate = item as Record<string, unknown>;
    if (Object.keys(candidate).some((key) => key !== "result" && key !== "rows") || candidate.result === undefined || candidate.rows === undefined) return fail("dataset", "A visualization materialization requires an exact result and rows.");
    const parsed = parseWireValue(candidate.result);
    if (!parsed.ok) return parsed;
    if (parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return fail("dataset", "A visualization dataset result reference is malformed.");
    const ref = parsed.value as ResultRef;
    if (Object.keys(ref).length !== 5 || [ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest].some((value) => typeof value !== "string" || value.length === 0)) return fail("dataset", "A visualization dataset result reference is malformed.");
    const key = refKey(ref);
    if (seen.has(key)) return fail("dataset", "A result may have only one visualization materialization.");
    seen.add(key);
  }
  return {ok: true, value: freeze(inspected.value as readonly VisualizationDataset[])};
}

function snapshotContext(context: VisualizationBindingContext): Outcome<VisualizationBindingContext> {
  const inspected = parseWireValue(context);
  if (!inspected.ok) return inspected;
  if (inspected.value === null || typeof inspected.value !== "object" || Array.isArray(inspected.value)) return fail("context", "Visualization binding context must be a bounded object.");
  const candidate = inspected.value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["results", "catalog", "relationships", "histograms"].includes(key)) || !Array.isArray(candidate.results)) return fail("context", "Visualization binding context has an unsupported shape.");
  const results: Result[] = [];
  const seen = new Set<string>();
  for (const raw of candidate.results) {
    const parsed = parseResult(raw);
    if (!parsed.ok) return parsed;
    const key = refKey(parsed.value.ref);
    if (seen.has(key)) return fail("context", "Visualization context repeats an exact ResultRef.");
    seen.add(key); results.push(parsed.value);
  }
  // bindVisualizationSpec performs the catalog, histogram and relationship checks.
  return {ok: true, value: freeze({
    results,
    ...(candidate.catalog === undefined ? {} : {catalog: candidate.catalog}),
    ...(candidate.relationships === undefined ? {} : {relationships: candidate.relationships}),
    ...(candidate.histograms === undefined ? {} : {histograms: candidate.histograms}),
  }) as unknown as VisualizationBindingContext};
}

function snapshotBindings(input: AeliqoAuthorizedVisualizationBindings, options: AeliqoVisualizationRegistryOptions): Outcome<ReadonlyMap<string, AeliqoVisualizationBinding>> {
  try {
    const entries = entriesFor(input);
    if (entries.length > 128) return fail("binding", "The authorized visualization binding table is too large.");
    const map = new Map<string, AeliqoVisualizationBinding>();
    for (const [suppliedKey, binding] of entries) {
      if (binding === null || typeof binding !== "object") return fail("binding", "A visualization binding must be an object.");
      const parsedResult = parseResult(binding.result);
      if (!parsedResult.ok) return parsedResult;
      const actualKey = refKey(parsedResult.value.ref);
      if (suppliedKey !== actualKey || map.has(actualKey)) return fail("binding", "Authorized visualization bindings must use one exact ResultRef key.");
      const context = snapshotContext(binding.context);
      if (!context.ok) return context;
      if (!context.value.results.some((result) => sameResult(result, parsedResult.value))) return fail("binding", "The primary visualization Result must be present exactly in its authorized context.");
      const datasets = parseDatasets(binding.datasets, options.maxDatasets ?? MAX_DATASETS);
      if (!datasets.ok) return datasets;
      const contextKeys = new Set(context.value.results.map((result) => refKey(result.ref)));
      for (const dataset of datasets.value) {
        if (!contextKeys.has(refKey(dataset.result))) return fail("dataset", "A visualization materialization must name a Result authorized by its context.");
      }
      map.set(actualKey, freeze({result: parsedResult.value, context: context.value, datasets: datasets.value}));
    }
    return {ok: true, value: map};
  } catch {
    return fail("binding", "The authorized visualization bindings could not be validated.");
  }
}

function configFor(view: VisualizationView, values: PresentationValues, result: Result | undefined, bindings: ReadonlyMap<string, AeliqoVisualizationBinding>, options: AeliqoVisualizationRegistryOptions): Outcome<ResolvedPresentationConfig> {
  if (result === undefined) return fail("binding", "A visualization representation requires an authorized Result.");
  const parsedValues = parseWireValue(values);
  if (!parsedValues.ok) return parsedValues;
  if (parsedValues.value === null || typeof parsedValues.value !== "object" || Array.isArray(parsedValues.value)) return fail("config", "Visualization configuration must be a bounded object.");
  const input = parsedValues.value as Record<string, unknown>;
  if (Object.keys(input).length !== 1 || !Object.hasOwn(input, "visualization")) return fail("config", "Visualization configuration must contain exactly one visualization spec.");
  const spec = parseVisualizationSpec(input.visualization);
  if (!spec.ok) return spec;
  if (spec.value.view !== view) return fail("view", `The ${view} manifest cannot resolve a ${spec.value.view} visualization.`);
  const binding = bindings.get(refKey(result.ref));
  if (binding === undefined || !sameResult(binding.result, result)) return fail("stale", "The authorized visualization Result descriptor is stale or unavailable.");
  const bound = bindVisualizationSpec(spec.value, binding.context);
  if (!bound.ok) return bound;
  if (!bound.value.results.some((candidate) => sameResult(candidate, result))) return fail("binding", "The primary Result is not part of the visualization specification.");
  for (const candidate of bound.value.results) {
    const rows = materializeVisualizationRows(bound.value, candidate.ref, binding.datasets);
    if (!rows.ok) return rows;
  }
  const owner = options.resolveEntity === undefined ? undefined : (() => {
    try { return options.resolveEntity(result); } catch { return undefined; }
  })();
  if (options.resolveEntity !== undefined && (typeof owner !== "string" || owner.length === 0)) return fail("binding", "Selectable visualization views require a trusted entity binding.");
  const ports: InteractionPort[] = owner === undefined ? [] : [{id: "selection", direction: "inout", payload: "selection", entity: owner, identity: [...result.identity], grain: [...result.rowGrain]}];
  return {ok: true, value: freeze({
    values: {visualization: spec.value},
    fields: [...result.fields.map((field) => field.id)],
    ports,
    operations: owner === undefined ? [AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS.read] : [AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS.read, AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS.selection],
  })};
}

function buildManifest(view: VisualizationView, bindings: ReadonlyMap<string, AeliqoVisualizationBinding>, options: AeliqoVisualizationRegistryOptions): PresentationManifest {
  return freeze({
    ref: AELIQO_VISUALIZATION_REFS[view], configSchema: AELIQO_VISUALIZATION_CONFIG_SCHEMAS[view],
    roles: ["view", "visualization"], operations: [AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS.read, AELIQO_VISUALIZATION_PRESENTATION_OPERATIONS.selection],
    result: "required", children: {min: 0, max: 0}, visibility: "leaf", extension: false,
    resolveConfig: (values, result) => configFor(view, values, result, bindings, options),
  });
}

export function createAeliqoVisualizationPresentationManifests(input: AeliqoAuthorizedVisualizationBindings, options: AeliqoVisualizationRegistryOptions = {}): Outcome<readonly PresentationManifest[]> {
  const bindings = snapshotBindings(input, options);
  if (!bindings.ok) return bindings;
  return {ok: true, value: freeze(VIEWS.map((view) => buildManifest(view, bindings.value, options)))};
}

export function createAeliqoVisualizationPresentationRegistry(input: AeliqoAuthorizedVisualizationBindings, options: AeliqoVisualizationRegistryOptions = {}): Outcome<AeliqoVisualizationPresentationRegistry> {
  const bindings = snapshotBindings(input, options);
  if (!bindings.ok) return bindings;
  const manifests = freeze(VIEWS.map((view) => buildManifest(view, bindings.value, options)));
  const bindingFor = (ref: ResultRef): Outcome<AeliqoVisualizationBinding> => {
    let binding: AeliqoVisualizationBinding | undefined;
    try { binding = bindings.value.get(refKey(ref)); } catch { binding = undefined; }
    return binding === undefined ? fail("stale", "The requested visualization ResultRef is not authorized in this presentation revision.") : {ok: true, value: binding};
  };
  const render = (node: CoreNode, binding: AeliqoVisualizationBinding, context: AeliqoVisualizationPresentationRenderContext = {}): TemplateResult | typeof nothing => renderAeliqoVisualizationPresentationNode(node, binding, context, options, bindings.value);
  return {ok: true, value: freeze({manifests, bindingFor, render})};
}

export const createVisualizationPresentationManifests = createAeliqoVisualizationPresentationManifests;
export const createVisualizationPresentationRegistry = createAeliqoVisualizationPresentationRegistry;
export const createAeliqoVisualizationManifests = createAeliqoVisualizationPresentationManifests;
export const createAeliqoVisualizationRegistry = createAeliqoVisualizationPresentationRegistry;
