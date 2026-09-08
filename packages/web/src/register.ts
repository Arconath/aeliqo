import {AeliqoMatrixElement, AeliqoTimelineElement, AeliqoCalendarGridElement} from "./visualization/temporal/index.js";
import {AeliqoMetricElement, AeliqoDeltaElement, AeliqoKeyValueElement, AeliqoDetailElement, AeliqoRecordListElement, AeliqoCardCollectionElement, AeliqoSelectionSummaryElement, AeliqoFilterBuilderElement} from "./data/index.js";
import {AeliqoDialogElement, AeliqoDrawerElement, AeliqoPopoverElement, AeliqoTooltipElement, AeliqoAlertElement, AeliqoToastElement, AeliqoProgressElement, AeliqoSkeletonElement, AeliqoEmptyStateElement} from "./feedback/index.js";
import {AeliqoTabsElement, AeliqoBreadcrumbElement, AeliqoPaginationElement, AeliqoMenuElement, AeliqoTreeNavElement} from "./navigation/index.js";
import {AeliqoTextFieldElement, AeliqoTextAreaElement, AeliqoNumberFieldElement, AeliqoCheckboxElement, AeliqoRadioGroupElement, AeliqoSwitchElement, AeliqoSelectElement, AeliqoComboboxElement, AeliqoDateFieldElement, AeliqoDateRangeElement, AeliqoSliderElement, AeliqoSearchFieldElement, AeliqoFileInputElement, AeliqoFieldGroupElement, AeliqoFormElement} from "./input/index.js";
import {AeliqoPlotElement} from "./plot/index.js";
import {AeliqoButtonElement, AeliqoIconButtonElement, AeliqoLinkElement, AeliqoTextElement, AeliqoHeadingElement, AeliqoBadgeElement, AeliqoAvatarElement, AeliqoSeparatorElement, AeliqoSurfaceElement, AeliqoStackElement, AeliqoGridElement, AeliqoSplitPaneElement, AeliqoScrollAreaElement} from "./foundation/index.js";
import {AeliqoChartElement} from "./elements/aeliqo-chart.js";
import {AeliqoInputElement} from "./elements/aeliqo-input.js";
import {AeliqoTableElement} from "./elements/aeliqo-table.js";
import {AeliqoRegionElement} from "./region/aeliqo-region.js";

export const AELIQO_WEB_VERSION = "0.1.0-m0";

type AeliqoElementConstructor = CustomElementConstructor & {
  readonly aeliqoVersion?: string;
};

interface ElementRegistration {
  readonly name: string;
  readonly constructor: AeliqoElementConstructor;
}

const REGISTRATIONS: readonly ElementRegistration[] = [
  {name: "aeliqo-matrix", constructor: AeliqoMatrixElement},
  {name: "aeliqo-timeline", constructor: AeliqoTimelineElement},
  {name: "aeliqo-calendar-grid", constructor: AeliqoCalendarGridElement},
  {name: "aeliqo-metric", constructor: AeliqoMetricElement},
  {name: "aeliqo-delta", constructor: AeliqoDeltaElement},
  {name: "aeliqo-key-value", constructor: AeliqoKeyValueElement},
  {name: "aeliqo-detail", constructor: AeliqoDetailElement},
  {name: "aeliqo-record-list", constructor: AeliqoRecordListElement},
  {name: "aeliqo-card-collection", constructor: AeliqoCardCollectionElement},
  {name: "aeliqo-selection-summary", constructor: AeliqoSelectionSummaryElement},
  {name: "aeliqo-filter-builder", constructor: AeliqoFilterBuilderElement},

  {name: "aeliqo-dialog", constructor: AeliqoDialogElement},
  {name: "aeliqo-drawer", constructor: AeliqoDrawerElement},
  {name: "aeliqo-popover", constructor: AeliqoPopoverElement},
  {name: "aeliqo-tooltip", constructor: AeliqoTooltipElement},
  {name: "aeliqo-alert", constructor: AeliqoAlertElement},
  {name: "aeliqo-toast", constructor: AeliqoToastElement},
  {name: "aeliqo-progress", constructor: AeliqoProgressElement},
  {name: "aeliqo-skeleton", constructor: AeliqoSkeletonElement},
  {name: "aeliqo-empty-state", constructor: AeliqoEmptyStateElement},

  {name: "aeliqo-tabs", constructor: AeliqoTabsElement},
  {name: "aeliqo-breadcrumb", constructor: AeliqoBreadcrumbElement},
  {name: "aeliqo-pagination", constructor: AeliqoPaginationElement},
  {name: "aeliqo-menu", constructor: AeliqoMenuElement},
  {name: "aeliqo-tree-nav", constructor: AeliqoTreeNavElement},

  {name: "aeliqo-text-field", constructor: AeliqoTextFieldElement},
  {name: "aeliqo-text-area", constructor: AeliqoTextAreaElement},
  {name: "aeliqo-number-field", constructor: AeliqoNumberFieldElement},
  {name: "aeliqo-checkbox", constructor: AeliqoCheckboxElement},
  {name: "aeliqo-radio-group", constructor: AeliqoRadioGroupElement},
  {name: "aeliqo-switch", constructor: AeliqoSwitchElement},
  {name: "aeliqo-select", constructor: AeliqoSelectElement},
  {name: "aeliqo-combobox", constructor: AeliqoComboboxElement},
  {name: "aeliqo-date-field", constructor: AeliqoDateFieldElement},
  {name: "aeliqo-date-range", constructor: AeliqoDateRangeElement},
  {name: "aeliqo-slider", constructor: AeliqoSliderElement},
  {name: "aeliqo-search-field", constructor: AeliqoSearchFieldElement},
  {name: "aeliqo-file-input", constructor: AeliqoFileInputElement},
  {name: "aeliqo-field-group", constructor: AeliqoFieldGroupElement},
  {name: "aeliqo-form", constructor: AeliqoFormElement},

  {name: "aeliqo-plot", constructor: AeliqoPlotElement},
  {name: "aeliqo-button", constructor: AeliqoButtonElement},
  {name: "aeliqo-icon-button", constructor: AeliqoIconButtonElement},
  {name: "aeliqo-link", constructor: AeliqoLinkElement},
  {name: "aeliqo-text", constructor: AeliqoTextElement},
  {name: "aeliqo-heading", constructor: AeliqoHeadingElement},
  {name: "aeliqo-badge", constructor: AeliqoBadgeElement},
  {name: "aeliqo-avatar", constructor: AeliqoAvatarElement},
  {name: "aeliqo-separator", constructor: AeliqoSeparatorElement},
  {name: "aeliqo-surface", constructor: AeliqoSurfaceElement},
  {name: "aeliqo-stack", constructor: AeliqoStackElement},
  {name: "aeliqo-grid", constructor: AeliqoGridElement},
  {name: "aeliqo-split-pane", constructor: AeliqoSplitPaneElement},
  {name: "aeliqo-scroll-area", constructor: AeliqoScrollAreaElement},

  {name: "aeliqo-input", constructor: AeliqoInputElement},
  {name: "aeliqo-table", constructor: AeliqoTableElement},
  {name: "aeliqo-chart", constructor: AeliqoChartElement},
  {name: "aeliqo-region", constructor: AeliqoRegionElement},
];

/** Register the shared elements exactly once in the supplied browser registry. */
export function registerAeliqoElements(registry?: CustomElementRegistry): void {
  const target = registry ?? globalThis.customElements;
  if (target === undefined) {
    throw new Error("Aeliqo web elements require a CustomElementRegistry.");
  }

  for (const registration of REGISTRATIONS) {
    const current = target.get(registration.name) as AeliqoElementConstructor | undefined;
    if (current === undefined) {
      target.define(registration.name, registration.constructor);
      continue;
    }

    if (current !== registration.constructor && current.aeliqoVersion !== AELIQO_WEB_VERSION) {
      throw new Error(
        `Cannot register ${registration.name}: an incompatible custom element is already defined.`,
      );
    }
  }
}
