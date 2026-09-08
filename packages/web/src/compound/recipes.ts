import type {PresentationPlan, ResultRef, VersionRef} from "@aeliqo/core";
import type {
  AeliqoBreakdownRecipeInput, AeliqoComparisonRecipeInput, AeliqoCompoundRecipe, AeliqoCompoundRecipeInput,
  AeliqoExplorerRecipeInput, AeliqoFormFlowRecipeInput, AeliqoInvestigationRecipeInput, AeliqoQualityPanelRecipeInput,
  AeliqoRecordEditorRecipeInput, AeliqoSearchResultsRecipeInput,
} from "./types.js";

const REF = Object.freeze({
  explorer: {id: "compound.explorer", revision: "1"}, comparison: {id: "compound.comparison", revision: "1"},
  breakdown: {id: "compound.breakdown", revision: "1"}, investigation: {id: "compound.investigation", revision: "1"},
  searchResults: {id: "compound.search-results", revision: "1"}, recordEditor: {id: "compound.record-editor", revision: "1"},
  formFlow: {id: "compound.form-flow", revision: "1"}, qualityPanel: {id: "compound.quality-panel", revision: "1"},
  filter: {id: "control.filter-builder", revision: "1"}, search: {id: "input.search-field", revision: "1"},
  list: {id: "data.record-list", revision: "1"}, cards: {id: "data.card-collection", revision: "1"},
  table: {id: "data.table", revision: "1"}, detail: {id: "data.detail", revision: "1"}, metric: {id: "data.metric", revision: "1"},
  trend: {id: "visualization.trend", revision: "1"}, timeline: {id: "visualization.timeline", revision: "1"},
  form: {id: "input.form", revision: "1"},
} satisfies Record<string, VersionRef>);
export const AELIQO_COMPOUND_REFS = REF;
const CONFIG = (id: string): VersionRef => ({id: `${id}.config`, revision: "1"});
const OPERATION_REFS = Object.freeze({read: {id: "data.read", revision: "1"}, selection: {id: "interaction.selection", revision: "1"}, filter: {id: "data.filter", revision: "1"}, compare: {id: "data.compare", revision: "1"}, action: {id: "interaction.action", revision: "1"}}) satisfies Record<string, VersionRef>;
const op = (id: string): VersionRef => OPERATION_REFS[id as keyof typeof OPERATION_REFS] ?? {id, revision: "1"};
const mapping = {id: "selection.identity", revision: "1"} satisfies VersionRef;
const emptyValues = Object.freeze({});
const copyRef = <T extends ResultRef | VersionRef>(ref: T | undefined): T | undefined => ref === undefined ? undefined : {...ref};
type JsonValue = null | boolean | number | string | readonly JsonValue[] | {readonly [key: string]: JsonValue};
type PlanValues = {readonly [key: string]: JsonValue};
const cleanValue = (input: unknown): JsonValue => {
  if (Array.isArray(input)) return input.map(cleanValue);
  if (input !== null && typeof input === "object") {
    const output: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(input)) if (value !== undefined) output[key] = cleanValue(value);
    return output;
  }
  if (input === null || typeof input === "string" || typeof input === "boolean" || typeof input === "number") return input;
  return "";
};
const clean = (input: unknown): PlanValues => cleanValue(input) as PlanValues;

function plan(input: AeliqoCompoundRecipeInput, root: VersionRef, role: string, children: readonly {
  readonly id: string; readonly representation: VersionRef; readonly role: string; readonly result?: ResultRef; readonly values?: Readonly<Record<string, unknown>>;
}[], links: readonly PresentationPlan["links"][number][], operations: readonly VersionRef[] = [op("read")]): AeliqoCompoundRecipe {
  const rootId = `${input.id}:root`;
  const nodes: PresentationPlan["nodes"] = [{id: rootId, role, representation: root, config: {schema: CONFIG(root.id), values: clean({result: copyRef(input.result)})}, children: children.map(child => child.id)}, ...children.map(child => ({
    id: child.id, role: child.role, representation: child.representation, ...(child.result === undefined ? {} : {result: child.result}), config: {schema: CONFIG(child.representation.id), values: clean(child.values ?? emptyValues)}, children: [],
  }))];
  return {plan: Object.freeze({id: input.id, revision: input.revision, rootId, preconditions: input.preconditions, nodes, links, coverage: [{needId: `${input.id}:complete`, nodeIds: [rootId, ...children.map(child => child.id)] as [string, ...string[]], operations: (operations.length === 0 ? [op("read")] : operations) as [VersionRef, ...VersionRef[]]}], stateTransfer: [], diagnostics: []}), childIds: children.map(child => child.id)};
}
const link = (id: string, source: string, sourcePort: string, target: string, targetPort: string, propagation: "directed" | "identity-equivalence" = "directed"): PresentationPlan["links"][number] => ({id, source: {node: source, port: sourcePort}, target: {node: target, port: targetPort}, mapping, propagation});
const rootOf = (id: string): string => `${id}:root`;

export function explorerPresentationRecipe(input: AeliqoExplorerRecipeInput): AeliqoCompoundRecipe {
  const root = rootOf(input.id); const result = copyRef(input.result); const list = `${input.id}:collection`; const detail = `${input.id}:detail`; const filter = `${input.id}:filter`;
  return plan(input, REF.explorer, "explorer", [
    {id: filter, role: "filter", representation: REF.filter, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
    {id: list, role: "collection", representation: REF.list, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record", selection: "single"}},
    {id: detail, role: "detail", representation: REF.detail, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
  ], [link(`${input.id}:filter-results`, filter, "filter", list, "filter"), link(`${input.id}:selection-detail`, list, "selection", detail, "selection")], [op("read"), op("filter"), op("selection")]);
}
export function comparisonPresentationRecipe(input: AeliqoComparisonRecipeInput): AeliqoCompoundRecipe {
  const root = rootOf(input.id); const result = copyRef(input.result); const table = `${input.id}:compare-table`;
  return plan(input, REF.comparison, "comparison", [{id: table, role: "comparison", representation: REF.table, ...(result === undefined ? {} : {result}), values: {compareKeys: [...(input.compareKeys ?? [])], metrics: [...(input.metrics ?? [])]}}], [], [op("read"), op("compare"), op("selection")]);
}
export function breakdownPresentationRecipe(input: AeliqoBreakdownRecipeInput): AeliqoCompoundRecipe {
  const result = copyRef(input.result); const table = `${input.id}:groups`; const detail = `${input.id}:records`; const metric = `${input.id}:metric`;
  return plan(input, REF.breakdown, "breakdown", [
    {id: metric, role: "metric", representation: REF.metric, ...(result === undefined ? {} : {result}), values: {metricId: input.metricId ?? "metric"}},
    {id: table, role: "collection", representation: REF.table, ...(result === undefined ? {} : {result}), values: {groupField: input.groupField ?? "group"}},
    {id: detail, role: "detail", representation: REF.list, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
  ], [link(`${input.id}:group-records`, table, "group", detail, "filter")], [op("read"), op("compare"), op("selection")]);
}
export function investigationPresentationRecipe(input: AeliqoInvestigationRecipeInput): AeliqoCompoundRecipe {
  const result = copyRef(input.trendResult ?? input.result); const events = copyRef(input.eventResult ?? input.result); const trend = `${input.id}:trend`; const timeline = `${input.id}:events`; const detail = `${input.id}:detail`; const metric = `${input.id}:baseline`;
  return plan(input, REF.investigation, "investigation", [
    {id: trend, role: "trend", representation: REF.trend, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
    {id: metric, role: "baseline", representation: REF.metric, ...(result === undefined ? {} : {result}), values: {label: "Baseline"}},
    {id: timeline, role: "timeline", representation: REF.timeline, ...(events === undefined ? {} : {result: events}), values: {entity: input.entity ?? "record"}},
    {id: detail, role: "detail", representation: REF.detail, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
  ], [link(`${input.id}:event-detail`, timeline, "selection", detail, "selection")], [op("read"), op("compare"), op("selection")]);
}
export function searchResultsPresentationRecipe(input: AeliqoSearchResultsRecipeInput): AeliqoCompoundRecipe {
  const result = copyRef(input.result); const search = `${input.id}:query`; const list = `${input.id}:results`; const detail = `${input.id}:detail`;
  return plan(input, REF.searchResults, "search-results", [
    {id: search, role: "search", representation: REF.search, values: {query: input.query ?? ""}},
    {id: list, role: "collection", representation: REF.cards, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
    {id: detail, role: "detail", representation: REF.detail, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}},
  ], [link(`${input.id}:search-collection`, search, "query", list, "filter"), link(`${input.id}:result-detail`, list, "selection", detail, "selection")], [op("read"), op("filter"), op("selection")]);
}
export function recordEditorPresentationRecipe(input: AeliqoRecordEditorRecipeInput): AeliqoCompoundRecipe {
  const form = `${input.id}:form`; const result = copyRef(input.result);
  return plan(input, REF.recordEditor, "record-editor", [{id: form, role: "form", representation: REF.form, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record", action: copyRef(input.action)}}], [], [op("read"), op("action")]);
}
export function formFlowPresentationRecipe(input: AeliqoFormFlowRecipeInput): AeliqoCompoundRecipe {
  const form = `${input.id}:form`;
  return plan(input, REF.formFlow, "form-flow", [{id: form, role: "form", representation: REF.form, values: {steps: [...(input.steps ?? [])]}}], [], [op("read"), op("action")]);
}
export function qualityPanelPresentationRecipe(input: AeliqoQualityPanelRecipeInput): AeliqoCompoundRecipe {
  const result = copyRef(input.result);
  return plan(input, REF.qualityPanel, "quality-panel", [{id: `${input.id}:quality`, role: "quality", representation: REF.detail, ...(result === undefined ? {} : {result}), values: {entity: input.entity ?? "record"}}], [], [op("read")]);
}

export const compoundRecipeHelpers = Object.freeze({explorerPresentationRecipe, comparisonPresentationRecipe, breakdownPresentationRecipe, investigationPresentationRecipe, searchResultsPresentationRecipe, recordEditorPresentationRecipe, formFlowPresentationRecipe, qualityPanelPresentationRecipe});
