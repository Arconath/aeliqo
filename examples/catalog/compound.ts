import {
  AeliqoBreakdownElement,
  AeliqoComparisonElement,
  AeliqoDateRangeElement,
  AeliqoExplorerElement,
  AeliqoFormFlowElement,
  AeliqoInvestigationElement,
  AeliqoQualityPanelElement,
  AeliqoRecordEditorElement,
  AeliqoSearchResultsElement,
  AeliqoTextFieldElement,
} from "@aeliqo/web";
import {
  catalogColumns,
  catalogFields,
  catalogRef,
  catalogRows,
  catalogScope,
  catalogVisualizationContext,
  catalogVisualizationDataset,
  catalogVisualizationSpecs,
  cleanupCatalogRoot,
  createCatalogElement,
  createCatalogRoot,
} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "compound",
    description: "A semantic compound coordinating owned primitives around a typed task outcome.",
    fixture: "A host-owned compound with shared rows, scope, result lineage, and slotted form controls where the contract calls for them.",
    props: ["rows", "scope", "result", "status", "host-owned actions", "slotted fields where applicable"],
    propsNotes: "Compounds coordinate primitives and emit typed requests; application code owns persistence, navigation, and execution.",
    states: ["ready", "loading", "empty", "partial", "stale", "error", "invalid"],
    keyboard: ["Tab", "Arrow keys within child controls", "Enter or Space commits the focused host action", "focus and draft are preserved across steps"],
    events: ["compound-specific typed interaction events", "aeliqo-record-editor-save", "aeliqo-form-flow-step", "aeliqo-form-flow-commit"],
    expectedOutcome: "The compound shares one scope and result lineage across its child primitives while leaving business actions with the host.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
    result: catalogRef,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

export const compoundExamples: readonly CatalogExampleDefinition[] = [
  mount("explorer", (root) => {
    const element = createCatalogElement<AeliqoExplorerElement>("aeliqo-explorer", root);
    element.fields = catalogFields;
    element.rows = catalogRows;
    element.columns = catalogColumns;
    element.identity = ["id"];
    element.entity = "person";
    element.selectedKey = "string:3:ada";
    element.detailRecord = catalogRows[0];
    element.detailFields = catalogColumns;
    element.result = catalogRef;
    element.scope = catalogScope;
    element.selection = "single";
  }),
  mount("comparison", (root) => {
    const element = createCatalogElement<AeliqoComparisonElement>("aeliqo-comparison", root);
    element.compareSet = [{key: "ada", label: "Ada"}, {key: "grace", label: "Grace"}];
    element.compareKeys = ["ada", "grace"];
    element.entity = "person";
    element.metrics = [
      {id: "amount", label: "Amount", unit: "records", values: {ada: 120, grace: 144}},
      {id: "team", label: "Team", values: {ada: "Research", grace: "Research"}},
    ];
    element.result = catalogRef;
    element.scope = catalogScope;
  }),
  mount("breakdown", (root) => {
    const element = createCatalogElement<AeliqoBreakdownElement>("aeliqo-breakdown", root);
    element.groups = [
      {key: "research", label: "Research", value: 264, unit: "records", recordCount: 2},
      {key: "product", label: "Product", value: 96, unit: "records", recordCount: 1},
    ];
    element.rows = catalogRows;
    element.columns = catalogColumns;
    element.identity = ["id"];
    element.entity = "person";
    element.result = catalogRef;
    element.scope = catalogScope;
  }),
  mount("investigation", (root) => {
    const element = createCatalogElement<AeliqoInvestigationElement>("aeliqo-investigation", root);
    element.entity = "person";
    element.result = catalogRef;
    element.scope = catalogScope;
    element.baseline = 100;
    element.detailRecord = catalogRows[0];
    element.detailFields = catalogColumns;
    element.trend = catalogVisualizationSpecs.trend;
    element.trendContext = catalogVisualizationContext;
    element.trendDatasets = [catalogVisualizationDataset];
  }),
  mount("search-results", (root) => {
    const element = createCatalogElement<AeliqoSearchResultsElement>("aeliqo-search-results", root);
    element.query = "research";
    element.queryRevision = "query-2";
    element.resultRevision = catalogRef.revision;
    element.rows = catalogRows;
    element.columns = catalogColumns;
    element.identity = ["id"];
    element.selectedKey = "string:3:ada";
    element.entity = "person";
    element.result = catalogRef;
    element.scope = catalogScope;
    element.count = catalogRows.length;
    element.detailRecord = catalogRows[0];
    element.detailFields = catalogColumns;
  }),
  mount("record-editor", (root) => {
    const element = createCatalogElement<AeliqoRecordEditorElement>("aeliqo-record-editor", root);
    element.entity = "person";
    element.entityKey = "text:ada";
    element.entityRevision = "person-revision-1";
    const name = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
    name.label = "Name";
    name.name = "name";
    name.value = "Ada Lovelace";
    const period = document.createElement("aeliqo-date-range") as AeliqoDateRangeElement;
    period.label = "Review period";
    period.name = "period";
    period.start = "2026-09-01";
    period.end = "2026-09-30";
    element.append(name, period);
  }),
  mount("form-flow", (root) => {
    const element = createCatalogElement<AeliqoFormFlowElement>("aeliqo-form-flow", root);
    element.steps = [
      {id: "identity", label: "Identity", fieldNames: ["name"]},
      {id: "review", label: "Review", fieldNames: ["period"]},
    ];
    element.activeStep = "identity";
    element.draft = {name: "Ada Lovelace"};
    const identity = document.createElement("div");
    identity.slot = "step-identity";
    const name = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
    name.label = "Name";
    name.name = "name";
    name.value = "Ada Lovelace";
    identity.append(name);
    const review = document.createElement("div");
    review.slot = "step-review";
    review.textContent = "Review the authorized values before commit.";
    element.append(identity, review);
  }),
  mount("quality-panel", (root) => {
    const element = createCatalogElement<AeliqoQualityPanelElement>("aeliqo-quality-panel", root);
    element.source = "People registry";
    element.freshness = "2026-09-09 09:00 UTC";
    element.completeness = "3 of 3 rows loaded";
    element.provenance = ["Authorized local snapshot", "Query: catalog-query"];
    element.unsupportedClaims = ["This view does not establish causation."];
    element.state = {source: element.source, freshness: element.freshness, completeness: element.completeness, provenance: element.provenance, unsupportedClaims: element.unsupportedClaims};
  }),
];
