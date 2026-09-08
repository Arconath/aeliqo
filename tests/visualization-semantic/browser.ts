import {validatePresentationPlan} from "../../packages/core/src/index.js";
import {AeliqoRegionElement, createAeliqoPresentationRegistry, registerAeliqoElements} from "../../packages/web/src/index.js";
import type {AeliqoPresentationRegistryOptions} from "../../packages/web/src/region/registry.js";
import type {AeliqoRegionResult, AeliqoSemanticInteractionRequest} from "../../packages/web/src/region/types.js";
import type {PresentationContext, PresentationPlan} from "../../packages/core/src/index.js";
import {regionResults, temporalRef, visualizationContext, visualizationPlan, visualizationRegistryOptions} from "./fixtures.mjs";

registerAeliqoElements();

function install(element: AeliqoRegionElement, readOnly: boolean, events: AeliqoSemanticInteractionRequest[]): void {
  const registry = createAeliqoPresentationRegistry(visualizationRegistryOptions(readOnly) as AeliqoPresentationRegistryOptions);
  if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
  const checked = validatePresentationPlan(
    visualizationPlan() as PresentationPlan,
    visualizationContext() as PresentationContext,
    registry.value,
  );
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  element.presentation = checked.value;
  element.results = regionResults() as AeliqoRegionResult[];
  element.onSemanticInteraction = (request) => events.push(request);
}

const editable = document.querySelector<AeliqoRegionElement>("#editable");
const readOnly = document.querySelector<AeliqoRegionElement>("#readonly");
if (editable === null || readOnly === null) throw new Error("Semantic visualization regions are missing.");
const semanticEvents: AeliqoSemanticInteractionRequest[] = [];
const readOnlyEvents: AeliqoSemanticInteractionRequest[] = [];
install(editable, false, semanticEvents);
install(readOnly, true, readOnlyEvents);

Object.assign(window, {
  aeliqoVisualizationSemanticReady: true,
  aeliqoVisualizationSemanticEvents: semanticEvents,
  aeliqoVisualizationSemanticReadOnlyEvents: readOnlyEvents,
  aeliqoVisualizationSemanticTemporalRef: temporalRef,
});
