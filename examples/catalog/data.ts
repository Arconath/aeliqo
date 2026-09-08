import {
  AeliqoCardCollectionElement,
  AeliqoDeltaElement,
  AeliqoDetailElement,
  AeliqoFilterBuilderElement,
  AeliqoKeyValueElement,
  AeliqoMetricElement,
  AeliqoRecordListElement,
  AeliqoSelectionSummaryElement,
  AeliqoTableElement,
  type AeliqoKeyValueItem,
  type AeliqoTableColumn,
  type AeliqoTableRow,
} from "@aeliqo/web";
import {catalogColumns, catalogFields, catalogRef, catalogRows, catalogScope, cleanupCatalogRoot, createCatalogElement, createCatalogRoot} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const tableColumns: readonly AeliqoTableColumn[] = catalogColumns.map(({key, label, sortable, align}) => ({
  key,
  label,
  ...(sortable === undefined ? {} : {sortable}),
  ...(align === undefined ? {} : {align}),
}));
const tableRows: readonly AeliqoTableRow[] = catalogRows.map((row) => ({
  id: row.id ?? null,
  name: row.name ?? null,
  team: row.team ?? null,
  date: row.date ?? null,
  amount: row.amount ?? null,
}));

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "data",
    description: "A scoped data primitive that preserves identity, precision, and honest loading or partial states.",
    fixture: "A bounded authorized Result projection with stable identities, scope disclosure, and exact displayed values.",
    props: ["rows or value", "identity", "scope", "status", "result"],
    propsNotes: "Rows and values are supplied by the host; the component does not fetch, infer, or expand scope.",
    states: ["ready", "loading", "empty", "partial", "stale", "error"],
    keyboard: ["Tab", "Arrow keys in interactive grids", "Enter or Space for selection", "focus follows stable identity"],
    events: ["aeliqo-data-selection", "aeliqo-filter-change", "aeliqo-data-load-more", "aeliqo-table-sort"],
    expectedOutcome: "The view renders only the supplied authorized scope and labels any incomplete or unavailable data explicitly.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
    result: catalogRef,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

const personKeys = ["string:3:ada", "string:5:grace"] as const;

export const dataExamples: readonly CatalogExampleDefinition[] = [
  mount("metric", (root) => {
    const element = createCatalogElement<AeliqoMetricElement>("aeliqo-metric", root);
    element.label = "Authorized people";
    element.value = catalogRows.length;
    element.unit = "records";
    element.scope = catalogScope;
    element.description = "Current filtered result";
  }),
  mount("delta", (root) => {
    const element = createCatalogElement<AeliqoDeltaElement>("aeliqo-delta", root);
    element.label = "Change from last week";
    element.current = 0.62;
    element.baseline = 0.5;
    element.mode = "percentage-point";
    element.unit = "%";
    element.scope = catalogScope;
  }),
  mount("key-value", (root) => {
    const element = createCatalogElement<AeliqoKeyValueElement>("aeliqo-key-value", root);
    const items: readonly AeliqoKeyValueItem[] = [
      {key: "owner", label: "Owner", value: "Ada Lovelace"},
      {key: "scope", label: "Scope", value: "Authorized people", description: "Current report scope"},
    ];
    element.items = items;
    element.scope = catalogScope;
  }),
  mount("detail", (root) => {
    const element = createCatalogElement<AeliqoDetailElement>("aeliqo-detail", root);
    element.title = "Person detail";
    element.record = catalogRows[0];
    element.fields = catalogColumns;
    element.identity = ["id"];
    element.entity = "person";
    element.scope = catalogScope;
  }),
  mount("record-list", (root) => {
    const element = createCatalogElement<AeliqoRecordListElement>("aeliqo-record-list", root);
    element.title = "People";
    element.rows = catalogRows;
    element.columns = catalogColumns;
    element.identity = ["id"];
    element.entity = "person";
    element.selection = "single";
    element.selectedKeys = [personKeys[0]];
    element.result = catalogRef;
    element.scope = catalogScope;
  }),
  mount("card-collection", (root) => {
    const element = createCatalogElement<AeliqoCardCollectionElement>("aeliqo-card-collection", root);
    element.title = "People cards";
    element.rows = catalogRows;
    element.columns = catalogColumns;
    element.identity = ["id"];
    element.entity = "person";
    element.headingKey = "name";
    element.selection = "multiple";
    element.hasMore = true;
    element.loadingMore = false;
    element.scope = catalogScope;
  }),
  mount("table", (root) => {
    const element = createCatalogElement<AeliqoTableElement>("aeliqo-table", root);
    element.caption = "People";
    element.columns = tableColumns;
    element.rows = tableRows;
    element.identity = ["id"];
    element.entity = "person";
    element.selection = "multiple";
    element.selectedKeys = [personKeys[0]];
    element.result = catalogRef;
    element.page = 1;
    element.pageSize = 10;
    element.totalRows = catalogRows.length;
    element.scope = catalogScope;
  }),
  mount("filter-builder", (root) => {
    const element = createCatalogElement<AeliqoFilterBuilderElement>("aeliqo-filter-builder", root);
    element.fields = catalogFields;
    element.entity = "person";
    element.scopeLabel = "Authorized people";
    element.autoApply = false;
    element.clauses = [{field: "team", operator: "eq", value: "Research"}];
    element.logical = "and";
  }),
  mount("selection-summary", (root) => {
    const element = createCatalogElement<AeliqoSelectionSummaryElement>("aeliqo-selection-summary", root);
    element.label = "People selected";
    element.entity = "person";
    element.selectedKeys = [personKeys[0], personKeys[1]];
    element.result = catalogRef;
    element.scope = catalogScope;
    element.clearable = true;
  }),
];
