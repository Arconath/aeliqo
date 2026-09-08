import {
  AeliqoAreaElement,
  AeliqoBarElement,
  AeliqoCalendarGridElement,
  AeliqoHeatmapElement,
  AeliqoHistogramElement,
  AeliqoMatrixElement,
  AeliqoRelationshipElement,
  AeliqoScatterElement,
  AeliqoTimelineElement,
  AeliqoTrendElement,
  AeliqoTreeElement,
  AeliqoTreemapElement,
} from "@aeliqo/web";
import type {VisualizationBindingContext, VisualizationSpec} from "@aeliqo/core";
import type {VisualizationDataset} from "@aeliqo/web/visualization";
import {
  catalogRef,
  catalogTemporalSpecs,
  catalogVisualizationContext,
  catalogVisualizationDataset,
  catalogVisualizationSpecs,
  createCatalogElement,
  createCatalogRoot,
  cleanupCatalogRoot,
  hierarchyContext,
  hierarchyDataset,
  hierarchySpec,
  relationshipContext,
  relationshipDataset,
  relationshipSpec,
  treemapSpec,
} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId, CatalogExampleMetadata} from "./types.js";
import {catalogMountSource, catalogSource} from "./source.js";

const sourceImports = `import {
  AeliqoAreaElement,
  AeliqoBarElement,
  AeliqoCalendarGridElement,
  AeliqoHeatmapElement,
  AeliqoHistogramElement,
  AeliqoMatrixElement,
  AeliqoRelationshipElement,
  AeliqoScatterElement,
  AeliqoTimelineElement,
  AeliqoTrendElement,
  AeliqoTreeElement,
  AeliqoTreemapElement,
  registerAeliqoElements,
} from "@aeliqo/web";
`;

const sourceTypeImports = `import type {PlotUnit, ResultRef, Scalar, VisualizationBindingContext, VisualizationSpec} from "@aeliqo/core";
import type {VisualizationDataset} from "@aeliqo/web/visualization";`;

const sourceSetup = `${sourceTypeImports}

const catalogRef: ResultRef = {
  id: "aeliqo-catalog-example",
  revision: "1",
  outputId: "people",
  queryDigest: "catalog-query",
  scopeDigest: "catalog-scope",
};
const rows: readonly Readonly<Record<string, Scalar>>[] = [
  {id: "ada", name: "Ada Lovelace", team: "Research", date: "2026-09-08", amount: 120, low: 80, high: 100, zero: 0},
  {id: "lin", name: "Lin Chen", team: "Product", date: "2026-09-09", amount: 96, low: 100, high: 140, zero: 0},
  {id: "grace", name: "Grace Hopper", team: "Research", date: "2026-09-10", amount: 144, low: 140, high: 160, zero: 0},
];
const plot = (mark: PlotUnit["mark"], encoding: PlotUnit["encoding"]): PlotUnit => ({kind: "unit", mark, result: catalogRef, missing: "gap", encoding});
type CartesianView = "trend" | "bar" | "area" | "scatter" | "histogram" | "heatmap";
const cartesian = (view: CartesianView, mark: PlotUnit["mark"]): VisualizationSpec => ({version: "1", view, plot: {version: "1", root: plot(mark, {x: {field: "date", scale: "temporal"}, y: {field: "amount", scale: "linear", zero: true}})}} as VisualizationSpec);
const catalogVisualizationSpecs: Readonly<Record<CartesianView, VisualizationSpec>> = {
  trend: cartesian("trend", "line"),
  bar: cartesian("bar", "bar"),
  area: {...cartesian("area", "area"), stack: "none", meaning: {id: "amount", revision: "1"}} as VisualizationSpec,
  scatter: cartesian("scatter", "point"),
  histogram: {...cartesian("histogram", "rect"), bins: {start: "low", end: "high", value: "amount", measure: "count", boundary: "start-inclusive-end-exclusive"}} as VisualizationSpec,
  heatmap: cartesian("heatmap", "cell"),
};
const catalogTemporalSpecs: Readonly<Record<"matrix" | "timeline" | "calendar-grid", VisualizationSpec>> = {
  matrix: {version: "1", view: "matrix", result: catalogRef, columns: ["name", "team", "amount"]},
  timeline: {version: "1", view: "timeline", result: catalogRef, start: "date"},
  "calendar-grid": {version: "1", view: "calendar-grid", result: catalogRef, date: "date"},
};
const catalogVisualizationDataset: VisualizationDataset = {result: catalogRef, rows};
const catalogVisualizationContext: VisualizationBindingContext = {results: []};
const histogramSpec = catalogVisualizationSpecs.histogram as Extract<VisualizationSpec, {view: "histogram"}>;
const histogramContext: VisualizationBindingContext = {...catalogVisualizationContext, histograms: [{result: catalogRef, bins: histogramSpec.bins}]};
const hierarchyRef: ResultRef = {...catalogRef, id: "aeliqo-catalog-hierarchy", outputId: "nodes"};
const hierarchyDataset: VisualizationDataset = {result: hierarchyRef, rows: [{id: "company", parent: null, label: "Company", amount: 3}]};
const hierarchySpec: VisualizationSpec = {version: "1", view: "tree", result: hierarchyRef, node: ["id"], parent: ["parent"], label: "label"};
const treemapSpec: VisualizationSpec = {...hierarchySpec, view: "treemap", value: "amount", meaning: {id: "amount", revision: "1"}};
const hierarchyContext: VisualizationBindingContext = {results: []};
const relationshipRef: ResultRef = {...catalogRef, id: "aeliqo-catalog-relationship", outputId: "edges"};
const relationshipDataset: VisualizationDataset = {result: relationshipRef, rows: [{edge: "e1", source: "research", target: "company"}]};
const relationshipSpec: VisualizationSpec = {version: "1", view: "relationship", result: relationshipRef, source: ["source"], target: ["target"], relationship: {id: "reports-to", revision: "1"}};
const relationshipContext: VisualizationBindingContext = {results: [], relationships: [{result: relationshipRef, relationship: {id: "reports-to", revision: "1"}, source: ["source"], target: ["target"]}]};
type CatalogVisualizationElement = HTMLElement & {
  visualization: VisualizationSpec | undefined;
  context: VisualizationBindingContext;
  datasets: readonly VisualizationDataset[];
  label: string;
  width: number;
  height: number;
  maxMarks: number;
  selectionEnabled: boolean;
};
function configure<T extends CatalogVisualizationElement>(element: T, visualization: VisualizationSpec, context: VisualizationBindingContext, datasets: readonly VisualizationDataset[] = [catalogVisualizationDataset]): T {
  element.visualization = visualization;
  element.context = context;
  element.datasets = datasets;
  element.label = "Catalog example";
  element.width = 640;
  element.height = 360;
  element.maxMarks = 500;
  element.selectionEnabled = true;
  return element;
}`;

type MetadataNotes = Pick<CatalogExampleMetadata, "fixture" | "props" | "propsNotes" | "states" | "keyboard" | "events" | "expectedOutcome">;
const componentNotes: Record<string, Partial<MetadataNotes>> = {
  trend: {fixture: "A line trend over the authorized date and amount fields.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "The spec declares temporal x and measure y; dataset rows and Result lineage are supplied by the host.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across marks", "Enter selects a mark", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The trend renders only the supplied Result scope and selection identifies the chosen row."},
  bar: {fixture: "A bar comparison by team with amount and person series.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Ordinal dimensions and exact measure encodings come from the typed spec; the component does not aggregate new data.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across bars", "Enter selects a bar", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Bars reflect the supplied team/person encodings and preserve result scope."},
  area: {fixture: "An area view over the authorized date and amount fields with an explicit non-stacked policy.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "The spec states stacking and missing-value policy; rendering never fills or invents missing rows.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across marks", "Enter selects a mark", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The area preserves the declared missing-value treatment and exposes equivalent data access."},
  scatter: {fixture: "A point view comparing amount against amount for the bounded people rows.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Both axes are explicit measure encodings; no trend or causal claim is inferred from position.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across points", "Enter selects a point", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Points are drawn from supplied rows and any selection remains tied to Result identity."},
  histogram: {fixture: "Bounded low/high bins with amount as the exact value and count as the declared measure.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Bin boundaries and measure are declared in the spec; the renderer does not silently choose a binning policy.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across bins", "Enter selects a bin", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Bins render according to the declared boundary policy and remain scope-labelled."},
  heatmap: {fixture: "A team by person heatmap colored by exact amount.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Both ordinal dimensions and the color measure are explicit; color does not replace text labels.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across cells", "Enter selects a cell", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Cells preserve both dimensions and expose an accessible equivalent representation."},
  matrix: {fixture: "A temporal matrix of person, team, and amount columns.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Column IDs come from the temporal spec and rows remain tied to the supplied result.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across cells", "Enter selects a row", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The matrix exposes the declared temporal columns without changing grain."},
  timeline: {fixture: "A timeline keyed by the authorized date field.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "The timeline start field is explicit and dates retain calendar semantics from the Result descriptor.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across events", "Enter selects an event", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Events are placed on the declared date axis and remain linked to result identities."},
  "calendar-grid": {fixture: "A calendar grid keyed by the authorized date field.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Calendar placement follows the spec and declared calendar descriptor; missing dates are not invented.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across days", "Enter selects a day", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The calendar preserves date meaning and exposes the supplied rows through accessible data."},
  tree: {fixture: "A company-to-team hierarchy with explicit parent and node identity fields.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Parent and node fields define hierarchy; the renderer does not infer relationships from labels.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across nodes", "Enter selects a node", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The hierarchy preserves parent relationships and emits stable node selections."},
  treemap: {fixture: "A hierarchy treemap sized by the declared amount meaning.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "The amount meaning and hierarchy fields are explicit; area is not treated as an unqualified metric.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across nodes", "Enter selects a node", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "Treemap area follows the declared amount meaning and retains hierarchy scope."},
  relationship: {fixture: "Two explicit reports-to edges with source and target fields.", props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"], propsNotes: "Relationship identity and cardinality come from the catalog context; an edge does not establish causation.", states: ["ready", "partial", "loading", "empty", "error"], keyboard: ["Tab", "Arrow keys across edges", "Enter selects an edge", "Accessible table remains available"], events: ["aeliqo-visualization-select"], expectedOutcome: "The graph displays only declared edges and labels them as evidence within the supplied scope."},
};

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "visualization",
    description: "A canonical visualization specification bound to an authorized Result and rendered by the shared web element.",
    fixture: "A typed VisualizationSpec, matching Result descriptor, and bounded dataset passed directly to the actual renderer.",
    props: ["visualization", "context", "datasets", "label", "width", "height", "maxMarks", "selectionEnabled"],
    propsNotes: "The spec declares mark and encoding semantics; the host supplies authorized context, result lineage, and row data.",
    states: ["ready", "partial", "loading", "empty", "error"],
    keyboard: ["Tab", "Arrow keys move between marks or rows", "Enter selects the focused mark", "accessible data table remains available"],
    events: ["aeliqo-visualization-select"],
    expectedOutcome: "The actual renderer shows the typed view, preserves Result scope, and exposes an equivalent accessible data representation.",
    ...componentNotes[id],
    source: catalogSource({imports: sourceImports, setup: sourceSetup, mount: catalogMountSource(id)}),
    result: catalogRef,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

type CatalogVisualizationElement = HTMLElement & {
  visualization: VisualizationSpec | undefined;
  context: VisualizationBindingContext;
  datasets: readonly VisualizationDataset[];
  label: string;
  width: number;
  height: number;
  maxMarks: number;
  selectionEnabled: boolean;
};

function configure<T extends CatalogVisualizationElement>(element: T, visualization: VisualizationSpec, context: VisualizationBindingContext, datasets: readonly VisualizationDataset[] = [catalogVisualizationDataset]): T {
  element.visualization = visualization;
  element.context = context;
  element.datasets = datasets;
  element.label = "Catalog example";
  element.width = 640;
  element.height = 360;
  element.maxMarks = 500;
  element.selectionEnabled = true;
  return element;
}

const histogramSpec = catalogVisualizationSpecs.histogram as Extract<VisualizationSpec, {view: "histogram"}>;
const histogramContext: VisualizationBindingContext = {
  ...catalogVisualizationContext,
  histograms: [{result: catalogRef, bins: histogramSpec.bins}],
};

export const visualizationExamples: readonly CatalogExampleDefinition[] = [
  mount("trend", (root) => configure(createCatalogElement<AeliqoTrendElement>("aeliqo-trend", root), catalogVisualizationSpecs.trend, catalogVisualizationContext)),
  mount("bar", (root) => configure(createCatalogElement<AeliqoBarElement>("aeliqo-bar", root), catalogVisualizationSpecs.bar, catalogVisualizationContext)),
  mount("area", (root) => configure(createCatalogElement<AeliqoAreaElement>("aeliqo-area", root), catalogVisualizationSpecs.area, catalogVisualizationContext)),
  mount("scatter", (root) => configure(createCatalogElement<AeliqoScatterElement>("aeliqo-scatter", root), catalogVisualizationSpecs.scatter, catalogVisualizationContext)),
  mount("histogram", (root) => configure(createCatalogElement<AeliqoHistogramElement>("aeliqo-histogram", root), histogramSpec, histogramContext)),
  mount("heatmap", (root) => configure(createCatalogElement<AeliqoHeatmapElement>("aeliqo-heatmap", root), catalogVisualizationSpecs.heatmap, catalogVisualizationContext)),
  mount("matrix", (root) => configure(createCatalogElement<AeliqoMatrixElement>("aeliqo-matrix", root), catalogTemporalSpecs.matrix, catalogVisualizationContext)),
  mount("timeline", (root) => configure(createCatalogElement<AeliqoTimelineElement>("aeliqo-timeline", root), catalogTemporalSpecs.timeline, catalogVisualizationContext)),
  mount("calendar-grid", (root) => configure(createCatalogElement<AeliqoCalendarGridElement>("aeliqo-calendar-grid", root), catalogTemporalSpecs["calendar-grid"], catalogVisualizationContext)),
  mount("tree", (root) => configure(createCatalogElement<AeliqoTreeElement>("aeliqo-tree", root), hierarchySpec, hierarchyContext, [hierarchyDataset])),
  mount("treemap", (root) => configure(createCatalogElement<AeliqoTreemapElement>("aeliqo-treemap", root), treemapSpec, hierarchyContext, [hierarchyDataset])),
  mount("relationship", (root) => configure(createCatalogElement<AeliqoRelationshipElement>("aeliqo-relationship", root), relationshipSpec, relationshipContext, [relationshipDataset])),
];
