import {registerAeliqoElements} from "../../../packages/web/src/register.js";
import {AeliqoRegionElement} from "../../../packages/web/src/region/aeliqo-region.js";
import type {AeliqoRegionResult} from "../../../packages/web/src/region/types.js";
import type {AeliqoTableColumn} from "../../../packages/web/src/types.js";
import type {Result, ResultRef, ValidatedPresentation} from "../../../packages/core/src/index.js";

registerAeliqoElements();
customElements.define("aeliqo-region", AeliqoRegionElement);

const region = document.querySelector<AeliqoRegionElement>("#region")!;
const ref: ResultRef = {id: "rows-result", revision: "1", outputId: "rows", queryDigest: "query", scopeDigest: "scope"};
const events: unknown[] = [];

function result(fields: Result["fields"]): Result {
  return {version: "1", ref, taskId: "task", fields, identity: ["employee.id"], rowGrain: ["employee.id", "week"],
    counts: {loaded: 0, population: {kind: "unknown"}}, precision: {kind: "exact"}, coverage: {kind: "unknown", reason: "fixture"},
    consistency: {kind: "unknown", reason: "fixture"}, evidence: {kind: "observed", source: {id: "fixture", revision: "1"}}, filters: [], warnings: [], lineage: []};
}

function node(id: string, role: string, representation: string, values: Record<string, unknown>, fields: string[], resultDescriptor: Result | undefined, ports: readonly Record<string, unknown>[] = []) {
  return {node: {id, role, representation: {id: representation, revision: "1"}, ...(resultDescriptor === undefined ? {} : {result: resultDescriptor.ref}), config: {schema: {id: `${representation}.config`, revision: "1"}, values}, children: []},
    manifest: {id: representation, revision: "1"}, config: {values, fields, ports}, result: resultDescriptor};
}

function presentation(children: readonly string[], nodes: readonly ReturnType<typeof node>[]): ValidatedPresentation {
  const byId = new Map(nodes.map((entry) => [entry.node.id, entry]));
  const layout = node("layout", "structure", "layout.stack", {gap: 4}, [], undefined);
  const layoutNode = {...layout, node: {...layout.node, children}};
  byId.set("layout", layoutNode);
  return {plan: {rootId: "layout"} as ValidatedPresentation["plan"], nodes: [...byId.values()], graph: {} as ValidatedPresentation["graph"], environment: {} as ValidatedPresentation["environment"]};
}

const textField = {id: "employee.id", label: "Employee ID", type: {value: "text", nullable: false}, role: "identity" as const};
const departmentField = {id: "department", label: "Department", type: {value: "text", nullable: false}, role: "dimension" as const};
const weekField = {id: "week", label: "Week", type: {value: "instant", nullable: false}, role: "time" as const};
const amountField = {id: "absence", label: "Absence", type: {value: "decimal", nullable: true}, role: "measure" as const};

const selectionResult = result([textField, departmentField]);
const selectionRows = [{"employee.id": "e1", department: "People"}, {"employee.id": "e2", department: "Sales"}];
const tableColumns: readonly AeliqoTableColumn[] = [{key: "employee.id", label: "Employee ID"}, {key: "department", label: "Department"}];

const trendResult = result([textField, weekField, amountField]);
const trendRows = [
  {"employee.id": "e1", week: "2026-01-01T00:00:00Z", absence: 1}, {"employee.id": "e1", week: "2026-01-08T00:00:00Z", absence: null}, {"employee.id": "e1", week: "2026-01-15T00:00:00Z", absence: 2},
  {"employee.id": "e2", week: "2026-01-01T00:00:00Z", absence: 0}, {"employee.id": "e2", week: "2026-01-15T00:00:00Z", absence: 1},
  {"employee.id": "e3", week: "2026-01-01T00:00:00Z", absence: 2}, {"employee.id": "e3", week: "2026-01-08T00:00:00Z", absence: 2}, {"employee.id": "e3", week: "2026-01-15T00:00:00Z", absence: 3},
  {"employee.id": "e4", week: "2026-01-01T00:00:00Z", absence: 3}, {"employee.id": "e4", week: "2026-01-08T00:00:00Z", absence: 2}, {"employee.id": "e4", week: "2026-01-15T00:00:00Z", absence: 4},
  {"employee.id": "e5", week: "2026-01-01T00:00:00Z", absence: 4}, {"employee.id": "e5", week: "2026-01-08T00:00:00Z", absence: 3}, {"employee.id": "e5", week: "2026-02-01T00:00:00Z", absence: 6},
];

function mountFilters(order: readonly string[] = ["filter-a", "filter-b"]): void {
  const filterA = node("filter-a", "filter", "control.filter", {field: "department", outputId: "rows"}, ["department"], selectionResult, [{id: "filter", direction: "output", payload: "filter"}]);
  const filterB = node("filter-b", "filter", "control.filter", {field: "department", outputId: "rows"}, ["department"], selectionResult, [{id: "filter", direction: "output", payload: "filter"}]);
  region.results = [{ref: selectionResult.ref, rows: selectionRows, columns: tableColumns} satisfies AeliqoRegionResult];
  region.presentation = presentation(order, [filterA, filterB]);
}

function mountSelection(): void {
  const table = node("table", "table", "data.table", {selection: "multiple"}, ["employee.id", "department"], selectionResult, [{id: "selection", direction: "inout", payload: "selection", entity: "employees", identity: ["employee.id"], grain: ["employee.id"]}]);
  region.results = [{ref: selectionResult.ref, rows: selectionRows, columns: tableColumns} satisfies AeliqoRegionResult];
  region.presentation = presentation(["table"], [table]);
}

function mountTrend(): void {
  const trend = node("trend", "trend", "data.trend", {labelField: "week", series: [{field: "absence", label: "Absence"}], seriesBy: ["employee.id"]}, ["week", "employee.id", "absence"], trendResult);
  region.results = [{ref: trendResult.ref, rows: trendRows} satisfies AeliqoRegionResult];
  region.presentation = presentation(["trend"], [trend]);
}

region.onSemanticInteraction = (event) => events.push(event);
Object.assign(window, {
  aeliqoReady: true,
  aeliqoEvents: events,
  mountFilters,
  mountSelection,
  mountTrend,
  reorderFilters: () => mountFilters(["filter-b", "filter-a"]),
});
mountFilters();
