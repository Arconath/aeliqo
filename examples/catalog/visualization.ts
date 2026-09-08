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
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

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
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
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
