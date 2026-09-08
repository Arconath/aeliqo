import {
  parseWireValue,
  type InteractionState,
  type Outcome,
  type PresentationManifest,
  type PresentationValues,
  type Result,
  type ResultRef,
  type ResolvedPresentationConfig,
  type ValidatedPresentation,
  type VersionRef,
} from "@aeliqo/core";
import {nothing, type TemplateResult} from "lit";
import {
  AELIQO_DATA_CONFIG_SCHEMAS,
  AELIQO_DATA_REFS,
  createAeliqoDataRegistry,
  validateAeliqoDataBinding,
  type AeliqoDataBinding,
  type AeliqoDataComponentId,
  type AeliqoDataRegistryOptions,
  type AeliqoDataResolvedNode,
  type AeliqoValidatedBinding,
} from "./data-registry.js";
import {
  renderAeliqoDataNode,
  type AeliqoDataHostRequestHandler,
} from "./data-renderer.js";

/** The operation identities shared by the existing canonical region registry. */
export const AELIQO_DATA_PRESENTATION_OPERATIONS = Object.freeze({
  read: {id: "data.read", revision: "1"},
  selection: {id: "interaction.selection", revision: "1"},
  filter: {id: "data.filter", revision: "1"},
  compare: {id: "data.compare", revision: "1"},
} satisfies Record<"read" | "selection" | "filter" | "compare", VersionRef>);

/**
 * Materialized data authorized by the application for one exact ResultRef.
 * The result descriptor is the key; rows are retained only in this host-side
 * binding and are never copied into a presentation plan.
 */
export type AeliqoAuthorizedDataBindings =
  | readonly AeliqoDataBinding[]
  | ReadonlyMap<string, AeliqoDataBinding>
  | Readonly<Record<string, AeliqoDataBinding>>;

export interface AeliqoDataPresentationOptions extends AeliqoDataRegistryOptions {
  readonly bindings: AeliqoAuthorizedDataBindings;
}

export interface AeliqoDataPresentationRegistry {
  readonly manifests: readonly PresentationManifest[];
  /** Resolve the current authorized snapshot for an exact ResultRef. */
  readonly bindingFor: (ref: ResultRef) => Outcome<AeliqoValidatedBinding>;
  /** Rebuild a helper node from the current host materialization. */
  readonly render: (
    node: ValidatedPresentation["nodes"][number],
    binding: AeliqoDataBinding,
    context?: AeliqoDataPresentationRenderContext,
  ) => TemplateResult | typeof nothing;
}

export interface AeliqoDataPresentationRenderContext {
  readonly interaction?: InteractionState;
  readonly onRequest?: AeliqoDataHostRequestHandler;
}

type DataManifestComponent = Exclude<AeliqoDataComponentId, "table">;
type CoreNode = ValidatedPresentation["nodes"][number];

const DATA_COMPONENTS: readonly DataManifestComponent[] = [
  "metric",
  "delta",
  "keyValue",
  "detail",
  "recordList",
  "cardCollection",
  "filterBuilder",
  "selectionSummary",
];

const fail = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{code: `web.data.presentation.${code}`, message, retryable: false}],
});

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function versionKey(ref: VersionRef): string {
  return JSON.stringify([ref.id, ref.revision]);
}

function sameRef(left: ResultRef | undefined, right: ResultRef): boolean {
  return left !== undefined && refKey(left) === refKey(right);
}

/** Stable comparison protects against an equivalent descriptor using another key order. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function sameResult(left: Result, right: Result): boolean {
  return sameRef(left.ref, right.ref) && canonical(left) === canonical(right);
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function snapshotBindings(input: AeliqoAuthorizedDataBindings, options: AeliqoDataRegistryOptions): Outcome<ReadonlyMap<string, AeliqoValidatedBinding>> {
  const entries: readonly (readonly [string, AeliqoDataBinding])[] = input instanceof Map
    ? [...input.entries()]
    : Array.isArray(input)
      ? input.map((binding) => [refKey(binding.result.ref), binding] as const)
      : Object.entries(input);
  if (entries.length > 128) return fail("binding", "The authorized data binding table is too large.");
  const map = new Map<string, AeliqoValidatedBinding>();
  for (const [key, binding] of entries) {
    const checked = validateAeliqoDataBinding(binding, options);
    if (!checked.ok) return checked;
    const actualKey = refKey(checked.value.result.ref);
    // A caller supplied map key is an index, never authority. It must still
    // name the exact ResultRef so an accidental alias cannot shadow a result.
    if (key !== actualKey) return fail("binding", "Authorized data bindings must be keyed by their exact ResultRef.");
    if (map.has(actualKey)) return fail("binding", "An exact ResultRef may have only one authorized materialization.");
    map.set(actualKey, freeze({
      result: checked.value.result,
      rows: checked.value.rows,
      columns: checked.value.columns,
      scope: checked.value.scope,
    }));
  }
  return {ok: true, value: map};
}

function dataComponent(ref: VersionRef): DataManifestComponent | "table" | undefined {
  return (Object.keys(AELIQO_DATA_REFS) as AeliqoDataComponentId[]).find((component) => {
    const candidate = AELIQO_DATA_REFS[component];
    return candidate.id === ref.id && candidate.revision === ref.revision;
  }) as DataManifestComponent | "table" | undefined;
}

function operationsFor(component: DataManifestComponent | "table", config: AeliqoDataResolvedNode["config"]): readonly VersionRef[] {
  const operations: VersionRef[] = [];
  const add = (operation: VersionRef): void => {
    if (!operations.some((candidate) => versionKey(candidate) === versionKey(operation))) operations.push(operation);
  };
  if (component !== "selectionSummary" || config.fields.length > 0 || config.ports.some((port) => port.payload === "selection")) add(AELIQO_DATA_PRESENTATION_OPERATIONS.read);
  if (component === "delta") add(AELIQO_DATA_PRESENTATION_OPERATIONS.compare);
  if (component === "filterBuilder") add(AELIQO_DATA_PRESENTATION_OPERATIONS.filter);
  if (component === "table" || component === "recordList" || component === "cardCollection" || component === "selectionSummary") {
    if (config.ports.some((port) => port.payload === "selection")) add(AELIQO_DATA_PRESENTATION_OPERATIONS.selection);
  }
  return operations;
}

function manifestOperations(component: DataManifestComponent): readonly VersionRef[] {
  switch (component) {
    case "delta": return [AELIQO_DATA_PRESENTATION_OPERATIONS.read, AELIQO_DATA_PRESENTATION_OPERATIONS.compare];
    case "filterBuilder": return [AELIQO_DATA_PRESENTATION_OPERATIONS.filter];
    case "selectionSummary": return [AELIQO_DATA_PRESENTATION_OPERATIONS.selection, AELIQO_DATA_PRESENTATION_OPERATIONS.read];
    case "recordList":
    case "cardCollection": return [AELIQO_DATA_PRESENTATION_OPERATIONS.read, AELIQO_DATA_PRESENTATION_OPERATIONS.selection];
    default: return [AELIQO_DATA_PRESENTATION_OPERATIONS.read];
  }
}

function presentationValues(value: Readonly<Record<string, unknown>>): Outcome<PresentationValues> {
  const parsed = parseWireValue(value);
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value))
    return fail("config", "The data presentation configuration is not bounded wire data.");
  return {ok: true, value: freeze(parsed.value as PresentationValues)};
}

function configFor(
  component: DataManifestComponent | "table",
  values: PresentationValues,
  result: Result | undefined,
  bindings: ReadonlyMap<string, AeliqoValidatedBinding>,
  options: AeliqoDataRegistryOptions,
  helper: ReturnType<typeof createAeliqoDataRegistry>,
): Outcome<ResolvedPresentationConfig> {
  if (result === undefined) return fail("binding", "A data representation requires an authorized Result.");
  const binding = bindings.get(refKey(result.ref));
  if (binding === undefined) return fail("stale", "The authorized ResultRef is not present in the current materialization table.");
  if (!sameResult(binding.result, result)) return fail("stale", "The materialized Result descriptor is stale for this ResultRef.");
  const resolved = helper.resolve({id: "presentation-data", component, config: values}, binding);
  if (!resolved.ok) return resolved;
  if (!sameRef(resolved.value.result.ref, result.ref)) return fail("stale", "The data helper returned a different ResultRef.");
  const resolvedValues = presentationValues(resolved.value.config.values);
  if (!resolvedValues.ok) return resolvedValues;
  return {
    ok: true,
    value: {
      values: resolvedValues.value,
      fields: freeze([...resolved.value.config.fields]),
      ports: freeze(resolved.value.config.ports.map((port) => freeze({...port}))),
      operations: operationsFor(component, resolved.value.config),
    },
  };
}

function buildManifest(
  component: DataManifestComponent,
  bindings: ReadonlyMap<string, AeliqoValidatedBinding>,
  options: AeliqoDataRegistryOptions,
): PresentationManifest {
  const helper = createAeliqoDataRegistry(options);
  return freeze({
    ref: AELIQO_DATA_REFS[component],
    configSchema: AELIQO_DATA_CONFIG_SCHEMAS[component],
    roles: [`${component}`],
    operations: manifestOperations(component),
    result: "required",
    children: {min: 0, max: 0},
    visibility: "leaf",
    extension: false,
    resolveConfig: (values, result) => configFor(component, values, result, bindings, options, helper),
  });
}

/** Build the eight canonical data manifests that complement the existing data.table@1 manifest. */
export function createAeliqoDataPresentationManifests(
  input: AeliqoAuthorizedDataBindings,
  options: AeliqoDataRegistryOptions = {},
): Outcome<readonly PresentationManifest[]> {
  const bindings = snapshotBindings(input, options);
  if (!bindings.ok) return bindings;
  return {ok: true, value: freeze(DATA_COMPONENTS.map((component) => buildManifest(component, bindings.value, options)))};
}

/** Create a complete data presentation bridge, including current binding lookup and rendering. */
export function createAeliqoDataPresentationRegistry(
  input: AeliqoAuthorizedDataBindings,
  options: AeliqoDataRegistryOptions = {},
): Outcome<AeliqoDataPresentationRegistry> {
  const bindings = snapshotBindings(input, options);
  if (!bindings.ok) return bindings;
  const manifests = freeze(DATA_COMPONENTS.map((component) => buildManifest(component, bindings.value, options)));
  const helper = createAeliqoDataRegistry(options);
  const bindingFor = (ref: ResultRef): Outcome<AeliqoValidatedBinding> => {
    const binding = bindings.value.get(refKey(ref));
    return binding === undefined ? fail("stale", "The requested ResultRef is not authorized in this presentation revision.") : {ok: true, value: binding};
  };
  const render = (node: CoreNode, binding: AeliqoDataBinding, context: AeliqoDataPresentationRenderContext = {}): TemplateResult | typeof nothing =>
    renderAeliqoDataPresentationNodeWith(helper, node, binding, options, bindings.value, context);
  return {ok: true, value: freeze({manifests, bindingFor, render})};
}

function renderAeliqoDataPresentationNodeWith(
  helper: ReturnType<typeof createAeliqoDataRegistry>,
  node: CoreNode,
  current: AeliqoDataBinding,
  options: AeliqoDataRegistryOptions,
  authorized: ReadonlyMap<string, AeliqoValidatedBinding>,
  context: AeliqoDataPresentationRenderContext,
): TemplateResult | typeof nothing {
  const component = dataComponent(node.manifest);
  if (component === undefined || node.result === undefined) return nothing;
  const authorizedBinding = authorized.get(refKey(node.result.ref));
  if (authorizedBinding === undefined) return nothing;
  if (!sameRef(current.result.ref, node.result.ref)) return nothing;
  const checked = validateAeliqoDataBinding(current, options);
  if (!checked.ok || !sameResult(checked.value.result, node.result)) return nothing;
  const resolved = helper.resolve({id: node.node.id, component, config: node.config.values}, checked.value);
  if (!resolved.ok || !sameRef(resolved.value.result.ref, node.result.ref)) return nothing;
  return renderAeliqoDataNode(resolved.value, context);
}

/** Render a core validated data node from current host materialization only. */
export function renderAeliqoDataPresentationNode(
  node: CoreNode,
  current: AeliqoDataBinding,
  context: AeliqoDataPresentationRenderContext = {},
  options: AeliqoDataRegistryOptions = {},
): TemplateResult | typeof nothing {
  const component = dataComponent(node.manifest);
  if (component === undefined || node.result === undefined) return nothing;
  const helper = createAeliqoDataRegistry(options);
  const checked = validateAeliqoDataBinding(current, options);
  if (!checked.ok || !sameRef(checked.value.result.ref, node.result.ref) || !sameResult(checked.value.result, node.result)) return nothing;
  return renderAeliqoDataPresentationNodeWith(helper, node, current, options, new Map([[refKey(checked.value.result.ref), checked.value]]), context);
}

/** Compatibility aliases for hosts that name the bridge after the shared data renderer. */
export const renderDataPresentationNode = renderAeliqoDataPresentationNode;
export const createDataPresentationManifests = createAeliqoDataPresentationManifests;
