import {
  AeliqoAvatarElement,
  AeliqoBadgeElement,
  AeliqoButtonElement,
  AeliqoGridElement,
  AeliqoHeadingElement,
  AeliqoIconButtonElement,
  AeliqoLinkElement,
  AeliqoScrollAreaElement,
  AeliqoSeparatorElement,
  AeliqoSplitPaneElement,
  AeliqoStackElement,
  AeliqoSurfaceElement,
  AeliqoTextElement,
} from "@aeliqo/web";
import {appendSlottedText, cleanupCatalogRoot, createCatalogElement, createCatalogRoot} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "foundation",
    description: "A direct foundation primitive with native semantics and tokenized layout.",
    fixture: "A fresh application-owned container with only the primitive and its direct content.",
    props: ["label or text", "disabled", "aria-label"],
    propsNotes: "Set the smallest semantic props needed by the host; content remains ordinary light-DOM children or slots.",
    states: ["ready", "disabled", "read-only"],
    keyboard: ["Tab", "Enter or Space when actionable", "native focus order"],
    events: ["aeliqo-action where the primitive is actionable"],
    expectedOutcome: "The primitive renders directly in the supplied host and preserves its native interaction boundary.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

export const foundationExamples: readonly CatalogExampleDefinition[] = [
  mount("button", (root) => {
    const element = createCatalogElement<AeliqoButtonElement>("aeliqo-button", root);
    element.label = "Save report";
    element.variant = "solid";
    element.type = "button";
  }),
  mount("icon-button", (root) => {
    const element = createCatalogElement<AeliqoIconButtonElement>("aeliqo-icon-button", root);
    element.label = "Open details";
    appendSlottedText(element, "icon", "⋯");
  }),
  mount("link", (root) => {
    const element = createCatalogElement<AeliqoLinkElement>("aeliqo-link", root);
    element.label = "View report";
    element.href = "/reports/weekly";
    element.target = "_self";
  }),
  mount("text", (root) => {
    const element = createCatalogElement<AeliqoTextElement>("aeliqo-text", root);
    element.text = "A plain, trusted text value.";
    element.as = "p";
  }),
  mount("heading", (root) => {
    const element = createCatalogElement<AeliqoHeadingElement>("aeliqo-heading", root);
    element.level = 2;
    element.size = "heading";
    element.text = "Weekly report";
  }),
  mount("badge", (root) => {
    const element = createCatalogElement<AeliqoBadgeElement>("aeliqo-badge", root);
    element.text = "Ready";
    element.tone = "success";
  }),
  mount("avatar", (root) => {
    const element = createCatalogElement<AeliqoAvatarElement>("aeliqo-avatar", root);
    element.name = "Ada Lovelace";
    element.alt = "Ada Lovelace";
    element.size = "medium";
  }),
  mount("separator", (root) => {
    const element = createCatalogElement<AeliqoSeparatorElement>("aeliqo-separator", root);
    element.orientation = "horizontal";
  }),
  mount("surface", (root) => {
    const element = createCatalogElement<AeliqoSurfaceElement>("aeliqo-surface", root);
    element.as = "section";
    element.tone = "surface";
    element.label = "Report panel";
    element.textContent = "Bounded surface content";
  }),
  mount("stack", (root) => {
    const element = createCatalogElement<AeliqoStackElement>("aeliqo-stack", root);
    element.direction = "row";
    element.gap = 12;
    element.align = "center";
    element.append("First", "Second");
  }),
  mount("grid", (root) => {
    const element = createCatalogElement<AeliqoGridElement>("aeliqo-grid", root);
    element.columns = 2;
    element.gap = 16;
    element.minItem = "small";
    element.append("Left", "Right");
  }),
  mount("split-pane", (root) => {
    const element = createCatalogElement<AeliqoSplitPaneElement>("aeliqo-split-pane", root);
    element.defaultPosition = 42;
    element.min = 20;
    element.max = 80;
    element.primaryLabel = "Primary panel";
    element.secondaryLabel = "Secondary panel";
    appendSlottedText(element, "start", "Primary panel");
    appendSlottedText(element, "end", "Secondary panel");
  }),
  mount("scroll-area", (root) => {
    const element = createCatalogElement<AeliqoScrollAreaElement>("aeliqo-scroll-area", root);
    element.axis = "y";
    element.label = "Report rows";
    element.tabIndex = 0;
    const content = document.createElement("p");
    content.textContent = "Scrollable report content that retains focus visibility.";
    element.append(content);
  }),
];
