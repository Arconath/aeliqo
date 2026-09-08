import {registerAeliqoElements} from "../../packages/web/src/index.js";
import {defineCompoundElements} from "../../packages/web/src/compound/index.js";
import type {ResultRef, VisualizationSpec} from "../../packages/core/src/index.js";

registerAeliqoElements();
defineCompoundElements();

const ref: ResultRef = {id: "compound-browser", revision: "1", outputId: "rows", queryDigest: "query", scopeDigest: "scope"};
const rows = [
  {id: "a", name: "Ada", group: "north", amount: {decimal: "100000000000000000.01"}},
  {id: "b", name: "Lin", group: "south", amount: {decimal: "2.50"}},
] as const;
const columns = [
  {key: "id", label: "ID"}, {key: "name", label: "Name"}, {key: "group", label: "Group"}, {key: "amount", label: "Amount"},
] as const;
const fields = [{id: "name", label: "Name", type: "text" as const}];
const scope = {loaded: 2, filteredTotal: 2, kind: "filtered" as const, label: "Authorized people"};
const trendResult = {
  version: "1" as const,
  ref,
  taskId: "compound-task",
  identity: ["id"],
  rowGrain: ["id", "date"],
  fields: [
    {id: "id", label: "ID", role: "identity" as const, type: {value: "text" as const, nullable: false}},
    {id: "date", label: "Date", role: "time" as const, type: {value: "date" as const, nullable: false, temporal: {calendar: "gregory" as const, grain: "day" as const}}},
    {id: "amount", label: "Amount", role: "measure" as const, type: {value: "decimal" as const, nullable: false}},
  ],
  counts: {loaded: 2, population: {kind: "unknown" as const}},
  precision: {kind: "exact" as const},
  coverage: {kind: "unknown" as const, reason: "Bounded compound fixture"},
  consistency: {kind: "unknown" as const, reason: "Host fixture"},
  evidence: {kind: "computed" as const, queryDigest: "query", definitions: []},
  filters: [], warnings: [], lineage: [],
};
const fixture = document.querySelector<HTMLElement>("#fixture")!;
const events: {readonly type: string; readonly detail: unknown}[] = [];
fixture.addEventListener("aeliqo-explorer-filter", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-explorer-selection", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-comparison-set", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-breakdown-group", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-search-results-selection", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-record-editor-save", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-record-editor-cancel", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));
fixture.addEventListener("aeliqo-form-flow-step", event => {
  const detail = (event as CustomEvent).detail as {to: string};
  events.push({type: event.type, detail});
  flow.activeStep = detail.to;
});
fixture.addEventListener("aeliqo-form-flow-commit", event => events.push({type: event.type, detail: (event as CustomEvent).detail}));

const explorer = document.createElement("aeliqo-explorer") as any;
explorer.id = "explorer";
Object.assign(explorer, {fields, rows, columns, identity: ["id"], entity: "person", result: ref, scope, detailFields: columns, detailRecord: rows[0]});
fixture.append(explorer);

const comparison = document.createElement("aeliqo-comparison") as any;
comparison.id = "comparison";
Object.assign(comparison, {
  compareSet: [{key: "a", label: "Alpha"}, {key: "b", label: "Beta"}], compareKeys: ["a", "b"], entity: "person", result: ref, scope,
  metrics: [{id: "amount", label: "Amount", unit: "USD", values: {a: {decimal: "100000000000000000.01"}, b: {decimal: "2.50"}}}],
});
fixture.append(comparison);

const breakdown = document.createElement("aeliqo-breakdown") as any;
breakdown.id = "breakdown";
Object.assign(breakdown, {
  groups: [
    {key: "north", label: "North", value: {decimal: "0.25"}, displayValue: "25%", recordCount: 1},
    {key: "legacy", label: "Legacy sufficient stats only", numerator: 1, denominator: 2, recordCount: 1},
  ], rows, columns, identity: ["id"], entity: "person", result: ref, scope,
});
fixture.append(breakdown);

const investigation = document.createElement("aeliqo-investigation") as any;
investigation.id = "investigation";
Object.assign(investigation, {entity: "person", result: ref, scope, baseline: {decimal: "2.50"}, detailRecord: rows[0], detailFields: columns});
fixture.append(investigation);

const search = document.createElement("aeliqo-search-results") as any;
search.id = "search";
Object.assign(search, {query: "Ada", queryRevision: "q2", resultRevision: "q1", rows, columns, identity: ["id"], result: ref, scope, count: 2});
fixture.append(search);

const editor = document.createElement("aeliqo-record-editor") as any;
editor.id = "editor";
Object.assign(editor, {entity: "person", entityKey: "a", entityRevision: "rev-1"});
const editorField = document.createElement("aeliqo-text-field") as any;
Object.assign(editorField, {name: "name", label: "Name", required: true, value: "Ada"});
editor.append(editorField);
fixture.append(editor);

const flow = document.createElement("aeliqo-form-flow") as any;
flow.id = "flow";
Object.assign(flow, {steps: [{id: "one", label: "Identity"}, {id: "two", label: "Review"}], activeStep: "one"});
const one = document.createElement("div"); one.slot = "step-one";
const oneField = document.createElement("aeliqo-text-field") as any;
Object.assign(oneField, {name: "displayName", label: "Display name", required: true}); one.append(oneField);
const two = document.createElement("div"); two.slot = "step-two"; two.textContent = "Review draft";
flow.append(one, two);
fixture.append(flow);

const quality = document.createElement("aeliqo-quality-panel") as any;
quality.id = "quality";
Object.assign(quality, {source: "CRM", freshness: "2026-09-09", completeness: "2 of 2", provenance: ["Host snapshot"], unsupportedClaims: ["Revenue causes retention"]});
fixture.append(quality);

const trend: VisualizationSpec = {
  version: "1", view: "trend", plot: {version: "1", root: {kind: "unit", mark: "line", result: ref, missing: "gap", encoding: {x: {field: "date", scale: "temporal"}, y: {field: "amount", scale: "linear"}}}},
};
Object.assign(investigation, {trend, trendContext: {results: [trendResult]}, trendDatasets: [{result: ref, rows: [{id: "a", date: "2026-09-08", amount: {decimal: "100000000000000000.01"}}, {id: "b", date: "2026-09-09", amount: {decimal: "2.50"}}]}]});

Object.assign(window, {compoundFixture: {events, ref, rows, flow, editor, search, breakdown}});
