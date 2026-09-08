import {
  AeliqoAlertElement,
  AeliqoDialogElement,
  AeliqoDrawerElement,
  AeliqoEmptyStateElement,
  AeliqoPopoverElement,
  AeliqoProgressElement,
  AeliqoSkeletonElement,
  AeliqoToastElement,
  AeliqoTooltipElement,
} from "@aeliqo/web";
import {cleanupCatalogRoot, createCatalogElement, createCatalogRoot} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "feedback",
    description: "A feedback primitive that makes status, focus, dismissal, and recovery explicit.",
    fixture: "A visible status surface with a host-approved message and an optional action or dismissal boundary.",
    props: ["open", "heading or message", "tone", "status"],
    propsNotes: "Tone supplements text and role; open/close state is controlled by the host where effects matter.",
    states: ["ready", "loading", "pending", "error", "empty", "disabled"],
    keyboard: ["Tab", "Enter or Space", "Escape dismisses transient surfaces when enabled", "focus returns to the trigger"],
    events: ["aeliqo-dialog-close", "aeliqo-drawer-close", "aeliqo-popover-close", "aeliqo-toast-dismiss", "aeliqo-alert-action"],
    expectedOutcome: "The feedback state is visible and announced with an explicit recovery or dismissal boundary.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

export const feedbackExamples: readonly CatalogExampleDefinition[] = [
  mount("tooltip", (root) => {
    const element = createCatalogElement<AeliqoTooltipElement>("aeliqo-tooltip", root);
    element.label = "More information";
    element.content = "Values are scoped to the current report.";
    element.open = true;
  }),
  mount("popover", (root) => {
    const element = createCatalogElement<AeliqoPopoverElement>("aeliqo-popover", root);
    element.label = "Report details";
    element.content = "The report includes the authorized current scope.";
    element.open = true;
    element.modal = false;
  }),
  mount("dialog", (root) => {
    const element = createCatalogElement<AeliqoDialogElement>("aeliqo-dialog", root);
    element.heading = "Confirm archive";
    element.open = true;
    element.modal = true;
    element.closeOnEscape = true;
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = "Archive report";
    element.append(action);
  }),
  mount("drawer", (root) => {
    const element = createCatalogElement<AeliqoDrawerElement>("aeliqo-drawer", root);
    element.heading = "Report details";
    element.mode = "inline";
    element.side = "end";
    element.open = true;
    element.textContent = "Inline detail content keeps the surrounding task visible.";
  }),
  mount("toast", (root) => {
    const element = createCatalogElement<AeliqoToastElement>("aeliqo-toast", root);
    element.message = "Report saved";
    element.tone = "success";
    element.open = true;
    element.duration = 0;
    element.dismissible = true;
  }),
  mount("alert", (root) => {
    const element = createCatalogElement<AeliqoAlertElement>("aeliqo-alert", root);
    element.heading = "Review scope";
    element.message = "This page contains the first authorized result window.";
    element.tone = "warning";
    element.actionLabel = "Inspect";
    element.dismissible = true;
    element.open = true;
  }),
  mount("progress", (root) => {
    const element = createCatalogElement<AeliqoProgressElement>("aeliqo-progress", root);
    element.label = "Loading report";
    element.value = 62;
    element.max = 100;
  }),
  mount("skeleton", (root) => {
    const element = createCatalogElement<AeliqoSkeletonElement>("aeliqo-skeleton", root);
    element.label = "Loading report rows";
    element.lines = 3;
    element.variant = "text";
    element.animated = false;
  }),
  mount("empty-state", (root) => {
    const element = createCatalogElement<AeliqoEmptyStateElement>("aeliqo-empty-state", root);
    element.kind = "no-matches";
    element.heading = "No matching reports";
    element.message = "Try a broader team or date filter.";
    element.actionLabel = "Clear filters";
  }),
];
