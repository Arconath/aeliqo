import type { Outcome } from '@aeliqo/core';
import type { VisualizationInputs } from '../types.js';
import { fail } from './geometry/shared.js';
import { compileRelationshipGeometry } from './geometry/relationship.js';
import { compileTreeGeometry, compileTreemapGeometry } from './geometry/tree.js';
import type { HierarchyGeometryOptions, HierarchyVisualizationGeometry } from './geometry/types.js';

export * from './geometry/types.js';
export { compileRelationshipGeometry } from './geometry/relationship.js';
export { compileTreeGeometry, compileTreemapGeometry } from './geometry/tree.js';

export function compileHierarchyVisualization(
  inputs: VisualizationInputs,
  options: HierarchyGeometryOptions = {},
): Outcome<HierarchyVisualizationGeometry> {
  const view = inputs.visualization?.view;
  if (view === 'tree') return compileTreeGeometry(inputs, options);
  if (view === 'treemap') return compileTreemapGeometry(inputs, options);
  if (view === 'relationship') return compileRelationshipGeometry(inputs, options);
  return fail('view', 'The hierarchy surface requires a tree, treemap or relationship specification.');
}
