import {AeliqoRelationshipElement, AeliqoTreeElement, AeliqoTreemapElement} from './element.js';

export {AeliqoHierarchyElementBase, AeliqoRelationshipElement, AeliqoTreeElement, AeliqoTreemapElement} from './element.js';
export type {HierarchyGeometry, HierarchyGeometryOptions, HierarchyNodeGeometry, HierarchyVisualizationGeometry, RelationshipEdgeGeometry, RelationshipGeometry, RelationshipNodeGeometry} from './geometry.js';
export {compileHierarchyVisualization, compileRelationship, compileRelationshipGeometry, compileTree, compileTreeGeometry, compileTreemap, compileTreemapGeometry} from './geometry.js';

/** Register hierarchy elements in an application-owned custom element registry. */
export function defineHierarchyElements(registry: CustomElementRegistry | undefined = globalThis.customElements): void {
  if (registry === undefined) return;
  if (!registry.get('aeliqo-tree')) registry.define('aeliqo-tree', AeliqoTreeElement);
  if (!registry.get('aeliqo-treemap')) registry.define('aeliqo-treemap', AeliqoTreemapElement);
  if (!registry.get('aeliqo-relationship')) registry.define('aeliqo-relationship', AeliqoRelationshipElement);
}
export type {AeliqoVisualizationSelectionDetail, AeliqoVisualizationSelectionEvent, VisualizationDataset, VisualizationInputs} from '../types.js';
