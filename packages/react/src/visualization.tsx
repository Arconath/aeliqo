import React from 'react';
import {createComponent,type EventName} from '@lit/react';
import {AeliqoMatrixElement,AeliqoTimelineElement,AeliqoCalendarGridElement,type AeliqoVisualizationSelectionEvent} from '@aeliqo/web/visualization';
export const AeliqoMatrix=createComponent({react:React,tagName:'aeliqo-matrix',elementClass:AeliqoMatrixElement,events:{onSelectionChange:'aeliqo-visualization-select' as EventName<AeliqoVisualizationSelectionEvent>},displayName:'AeliqoMatrix'});
export const AeliqoTimeline=createComponent({react:React,tagName:'aeliqo-timeline',elementClass:AeliqoTimelineElement,events:{onSelectionChange:'aeliqo-visualization-select' as EventName<AeliqoVisualizationSelectionEvent>},displayName:'AeliqoTimeline'});
export const AeliqoCalendarGrid=createComponent({react:React,tagName:'aeliqo-calendar-grid',elementClass:AeliqoCalendarGridElement,events:{onSelectionChange:'aeliqo-visualization-select' as EventName<AeliqoVisualizationSelectionEvent>},displayName:'AeliqoCalendarGrid'});
