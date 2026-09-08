import {
  AeliqoBreadcrumbElement,
  AeliqoMenuElement,
  AeliqoPaginationElement,
  AeliqoTabsElement,
  AeliqoTreeNavElement,
  type AeliqoBreadcrumbItem,
  type AeliqoMenuItem,
  type AeliqoTabItem,
  type AeliqoTreeNavNode,
} from "@aeliqo/web";
import {cleanupCatalogRoot, createCatalogElement, createCatalogRoot} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "navigation",
    description: "A keyboard navigable navigation primitive with stable item identities.",
    fixture: "A bounded set of application-approved items or nodes with one current/selected identity.",
    props: ["items or nodes", "value or selectedId", "label", "disabled"],
    propsNotes: "Items carry stable IDs; labels are visible and disabled entries remain discoverable.",
    states: ["ready", "disabled", "pending"],
    keyboard: ["Tab", "Arrow keys", "Enter or Space", "Home and End where supported"],
    events: ["aeliqo-navigation", "component-specific change event"],
    expectedOutcome: "Navigation state remains addressable by stable IDs and user intent is emitted as a cancellable host request.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

const tabs: readonly AeliqoTabItem[] = [
  {id: "overview", label: "Overview", content: "Overview content"},
  {id: "details", label: "Details", content: "Details content"},
  {id: "history", label: "History", content: "History content", disabled: true},
];
const breadcrumb: readonly AeliqoBreadcrumbItem[] = [
  {id: "home", label: "Home", href: "/"},
  {id: "reports", label: "Reports", href: "/reports"},
  {id: "current", label: "Weekly report", current: true},
];
const menuItems: readonly AeliqoMenuItem[] = [
  {id: "open", label: "Open report"},
  {id: "archive", label: "Archive"},
  {id: "disabled", label: "Unavailable", disabled: true},
];
const treeNodes: readonly AeliqoTreeNavNode[] = [
  {id: "reports", label: "Reports", children: [{id: "weekly", label: "Weekly"}, {id: "monthly", label: "Monthly"}]},
  {id: "settings", label: "Settings", disabled: true},
];

export const navigationExamples: readonly CatalogExampleDefinition[] = [
  mount("tabs", (root) => {
    const element = createCatalogElement<AeliqoTabsElement>("aeliqo-tabs", root);
    element.items = tabs;
    element.value = "overview";
    element.activation = "manual";
  }),
  mount("breadcrumb", (root) => {
    const element = createCatalogElement<AeliqoBreadcrumbElement>("aeliqo-breadcrumb", root);
    element.items = breadcrumb;
    element.label = "Report path";
  }),
  mount("pagination", (root) => {
    const element = createCatalogElement<AeliqoPaginationElement>("aeliqo-pagination", root);
    element.page = 2;
    element.pageCount = 4;
    element.hasPrevious = true;
    element.hasNext = true;
    element.label = "Report pages";
  }),
  mount("menu", (root) => {
    const element = createCatalogElement<AeliqoMenuElement>("aeliqo-menu", root);
    element.items = menuItems;
    element.label = "Report actions";
    element.open = true;
  }),
  mount("tree-nav", (root) => {
    const element = createCatalogElement<AeliqoTreeNavElement>("aeliqo-tree-nav", root);
    element.nodes = treeNodes;
    element.expandedIds = ["reports"];
    element.selectedId = "weekly";
    element.label = "Report navigation";
  }),
];
