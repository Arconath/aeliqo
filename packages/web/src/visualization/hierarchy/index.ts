import {AeliqoRelationshipElement, AeliqoTreeElement, AeliqoTreemapElement} from './element.js';

export {AeliqoHierarchyElementBase, AeliqoRelationshipElement, AeliqoTreeElement, AeliqoTreemapElement} from './element.js';
export type {HierarchyGeometry, HierarchyGeometryOptions, HierarchyNodeGeometry, HierarchyVisualizationGeometry, RelationshipEdgeGeometry, RelationshipGeometry, RelationshipNodeGeometry} from './geometry.js';
export {compileHierarchyVisualization, compileRelationship, compileRelationshipGeometry, compileTree, compileTreeGeometry, compileTreemap, compileTreemapGeometry} from './geometry.js';

/** Register hierarchy elements in an application-owned custom element registry. */
export function defineHierarchyElements(registry: CustomElementRegistry | undefined = globalThis.customElements): void {
  if (registry === undefined) throw new Error('Hierarchy visualization elements require a CustomElementRegistry.');
  for(const [name,constructor] of [['aeliqo-tree',AeliqoTreeElement],['aeliqo-treemap',AeliqoTreemapElement],['aeliqo-relationship',AeliqoRelationshipElement]] as const){
    const current=registry.get(name);
    if(current===undefined)registry.define(name,constructor);
    else if(current!==constructor&&(current as typeof constructor).aeliqoVersion!=='0.1.0-m0')throw new Error(`Cannot register ${name}: an incompatible custom element is already defined.`);
  }
}
export type {AeliqoVisualizationSelectionDetail, AeliqoVisualizationSelectionEvent, VisualizationDataset, VisualizationInputs} from '../types.js';
