import type * as z from 'zod/mini';
import type {visualizationSpecSchema} from '../schemas.js';
import type {Wire} from '../types.js';
import type {PlotSpec} from '../plot/index.js';
import {parseContract} from '../parse.js';

type Shape = Wire<z.infer<typeof visualizationSpecSchema>>;
type WithPlot<T> = T extends {readonly plot: unknown} ? Omit<T, 'plot'> & {readonly plot: PlotSpec} : T;
/** Data references and family semantics only; captions come from trusted host/Result metadata. */
export type VisualizationSpec = WithPlot<Shape>;
export const parseVisualizationSpec = (input: unknown) => parseContract('visualization-spec', input);
export {bindVisualizationSpec} from './validate.js';
export type {BoundVisualization, VisualizationBindingContext, VisualizationRelationshipBinding, VisualizationHistogramBinding} from './validate.js';
