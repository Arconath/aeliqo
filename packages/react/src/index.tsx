import React from "react";
import {createComponent, type EventName} from "@lit/react";
import {
  AeliqoChartElement,
  AeliqoInputElement,
  AeliqoTableElement,
  AeliqoInputEvent,
  registerAeliqoElements,
} from "@aeliqo/web";
import type {
  AeliqoChartPoint,
  AeliqoInputChangeDetail,
  AeliqoTableColumn,
  AeliqoTableRow,
} from "@aeliqo/web";

export type {AeliqoChartPoint, AeliqoInputChangeDetail, AeliqoTableColumn, AeliqoTableRow};
export {AeliqoInputEvent};

export const AeliqoInput = createComponent({
  react: React,
  tagName: "aeliqo-input",
  elementClass: AeliqoInputElement,
  events: {onAeliqoInput: "aeliqo-input" as EventName<AeliqoInputEvent>},
  displayName: "AeliqoInput",
});

export const AeliqoChart = createComponent({
  react: React,
  tagName: "aeliqo-chart",
  elementClass: AeliqoChartElement,
  displayName: "AeliqoChart",
});

/** React consumers call this at their app boundary; importing the binding is SSR-safe. */
export function registerAeliqoReactElements(): void {
  registerAeliqoElements();
}

export * from "./foundation.js";
export * from "./inputs.js";

export * from "./navigation.js";

export * from "./feedback.js";

export * from "./data.js";

export * from "./plot.js";

export * from "./visualization.js";
