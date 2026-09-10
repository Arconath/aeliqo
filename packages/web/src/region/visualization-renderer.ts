import {
  bindVisualizationSpec,
  parseVisualizationSpec,
  parseWireValue,
  type InteractionPayload,
  type InteractionState,
  type Result,
  type ResultRef,
  type ValidatedPresentation,
} from "@aeliqo/sdk-core";
import {html, nothing, type TemplateResult} from "lit";
import {materializeVisualizationRows} from "../visualization/materialization.js";
import type {VisualizationSpec} from "@aeliqo/sdk-core";
import type {
  AeliqoVisualizationBinding,
  AeliqoVisualizationPresentationRenderContext,
  AeliqoVisualizationRegistryOptions,
} from "./visualization-registry.js";

type CoreNode = ValidatedPresentation["nodes"][number];

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function sameRef(left: ResultRef | undefined, right: ResultRef): boolean {
  try { return left !== undefined && refKey(left) === refKey(right); } catch { return false; }
}

function sameResult(left: Result | undefined, right: Result): boolean {
  return left !== undefined && sameRef(left.ref, right.ref) && canonical(left) === canonical(right);
}

function resultRef(value: unknown): ResultRef | undefined {
  const parsed = parseWireValue(value);
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return undefined;
  const candidate = parsed.value as Record<string, unknown>;
  const keys = ["id", "revision", "outputId", "queryDigest", "scopeDigest"];
  if (Object.keys(candidate).length !== keys.length || keys.some((key) => typeof candidate[key] !== "string" || (candidate[key] as string).length === 0)) return undefined;
  return candidate as ResultRef;
}

function selectionDetail(event: Event): {readonly identity: string; readonly result: ResultRef} | undefined {
  let detail: unknown;
  try {
    if (typeof CustomEvent === "undefined" || !(event instanceof CustomEvent)) return undefined;
    detail = event.detail;
  } catch { return undefined; }
  const parsed = parseWireValue(detail);
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return undefined;
  const candidate = parsed.value as Record<string, unknown>;
  if (Object.keys(candidate).length !== 3 || candidate.source !== "user" || typeof candidate.identity !== "string" || candidate.identity.length === 0) return undefined;
  const ref = resultRef(candidate.result);
  return ref === undefined ? undefined : {identity: candidate.identity, result: ref};
}

function selectedIdentity(interaction: InteractionState | undefined, nodeId: string, result: ResultRef, entity: string | undefined): string | undefined {
  if (interaction === undefined) return undefined;
  try {
    const retained = interaction.values.find((value) => value.nodeId === nodeId && value.portId === "selection" && value.payload.kind === "selection");
    const selection = retained?.payload.kind === "selection" ? retained.payload.selection : undefined;
    return selection?.mode === "ids" && selection.entity === entity && sameRef(selection.result, result) && selection.keys.length === 1 ? selection.keys[0] : undefined;
  } catch { return undefined; }
}

function renderElement(
  spec: VisualizationSpec,
  binding: AeliqoVisualizationBinding,
  label: string,
  selected: string | undefined,
  selectionEnabled:boolean,
  onSelect: (event: Event) => void,
): TemplateResult {
  const props = {
    visualization: spec,
    context: binding.context,
    datasets: binding.datasets,
    label,
    width: 640,
    height: 360,
    "max-marks": 20_000,
    ...(selected === undefined ? {} : {"selected-identity": selected}),
  };
  // Lit SSR needs literal tag names so that its element registry can attach
  // the correct custom-element renderer. Every branch remains typed input.
  switch (spec.view) {
    case "trend": return html`<aeliqo-trend .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-trend>`;
    case "bar": return html`<aeliqo-bar .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-bar>`;
    case "area": return html`<aeliqo-area .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-area>`;
    case "scatter": return html`<aeliqo-scatter .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-scatter>`;
    case "histogram": return html`<aeliqo-histogram .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-histogram>`;
    case "heatmap": return html`<aeliqo-heatmap .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-heatmap>`;
    case "matrix": return html`<aeliqo-matrix .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected??""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-matrix>`;
    case "timeline": return html`<aeliqo-timeline .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected??""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-timeline>`;
    case "calendar-grid": return html`<aeliqo-calendar-grid .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected??""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-calendar-grid>`;
    case "tree": return html`<aeliqo-tree .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-tree>`;
    case "treemap": return html`<aeliqo-treemap .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-treemap>`;
    case "relationship": return html`<aeliqo-relationship .visualization=${props.visualization} .context=${props.context} .datasets=${props.datasets} .label=${props.label} .width=${props.width} .height=${props.height} .maxMarks=${props["max-marks"]} .selectedIdentity=${selected ?? ""} .selectionEnabled=${selectionEnabled} @aeliqo-visualization-select=${onSelect}></aeliqo-relationship>`;
  }
}

function declaredSelection(node: CoreNode): boolean {
  return node.config.ports.some((port) => port.id === "selection" && port.payload === "selection" && (port.direction === "output" || port.direction === "inout"))
    && (node.config.operations ?? []).some((operation) => operation.id === "interaction.selection" && operation.revision === "1");
}

function renderWith(
  node: CoreNode,
  current: AeliqoVisualizationBinding,
  context: AeliqoVisualizationPresentationRenderContext,
  options: AeliqoVisualizationRegistryOptions,
  authorized?: ReadonlyMap<string, AeliqoVisualizationBinding>,
): TemplateResult | typeof nothing {
  if (node.result === undefined) return nothing;
  const inspectedCurrent = parseWireValue(current);
  if (!inspectedCurrent.ok) return nothing;
  const view = node.manifest.id.startsWith("visualization.") ? node.manifest.id.slice("visualization.".length) as VisualizationSpec["view"] : undefined;
  if (view === undefined || !Object.hasOwn({trend: true, bar: true, area: true, scatter: true, histogram: true, heatmap: true, matrix: true, timeline: true, "calendar-grid": true, tree: true, treemap: true, relationship: true}, view)) return nothing;
  const trusted = authorized?.get(refKey(node.result.ref));
  if (trusted !== undefined && canonical(trusted) !== canonical(current)) return nothing;
  if (!sameResult(current.result, node.result)) return nothing;
  const parsed = parseVisualizationSpec(node.config.values.visualization);
  if (!parsed.ok || parsed.value.view !== view) return nothing;
  const bound = bindVisualizationSpec(parsed.value, current.context);
  if (!bound.ok || bound.value.results.length!==1 || !bound.value.results.some((result) => sameResult(result, node.result!))) return nothing;
  for (const result of bound.value.results) if (!materializeVisualizationRows(bound.value, result.ref, current.datasets).ok) return nothing;
  const owner = options.resolveEntity === undefined ? undefined : (() => { try { return options.resolveEntity(node.result!); } catch { return undefined; } })();
  const expectedPort = owner === undefined ? [] : [{id: "selection", direction: "inout", payload: "selection", entity: owner, identity: [...node.result.identity], grain: [...node.result.rowGrain]}];
  const expectedFields = parsed.value.view==="matrix"?[...parsed.value.columns]:node.result.fields.map((field) => field.id);
  const expectedOperations = owner === undefined ? [{id: "data.read", revision: "1"}] : [{id: "data.read", revision: "1"}, {id: "interaction.selection", revision: "1"}];
  if (canonical(node.config.values) !== canonical({visualization: parsed.value}) || canonical(node.config.fields) !== canonical(expectedFields) || canonical(node.config.ports) !== canonical(expectedPort) || canonical(node.config.operations) !== canonical(expectedOperations)) return nothing;
  const selectionEnabled = declaredSelection(node);
  const selected = selectionEnabled ? selectedIdentity(context.interaction, node.node.id, node.result.ref, owner) : undefined;
  const handler = (event: Event): void => {
    if (!declaredSelection(node) || typeof context.onSemanticInteraction !== "function") {event.preventDefault();return;}
    const detail = selectionDetail(event);
    if (detail === undefined || !sameRef(detail.result, node.result!.ref)) return;
    const rows = materializeVisualizationRows(bound.value, node.result!.ref, current.datasets);
    if (!rows.ok || !rows.value.some((row) => row.identity === detail.identity)) return;
    const port = node.config.ports.find((candidate) => candidate.id === "selection" && candidate.payload === "selection");
    if (port === undefined || port.entity === undefined) return;
    const payload: InteractionPayload = {kind: "selection", selection: {mode: "ids", entity: port.entity, keys: [detail.identity], result: node.result!.ref}};
    try { context.onSemanticInteraction(node.node.id, port.id, payload); } catch { /* host callback failures do not alter authorization */ }
  };
  return renderElement(parsed.value, current, `Data visualization: ${view}`, selected, selectionEnabled, handler);
}

export function renderAeliqoVisualizationPresentationNode(node: CoreNode, current: AeliqoVisualizationBinding, context: AeliqoVisualizationPresentationRenderContext = {}, options: AeliqoVisualizationRegistryOptions = {}, authorized?: ReadonlyMap<string, AeliqoVisualizationBinding>): TemplateResult | typeof nothing {
  try { return renderWith(node, current, context, options, authorized); } catch { return nothing; }
}
