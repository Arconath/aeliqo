import {describe, expect, it} from "vitest";
import type {InteractionPayload, PresentationValues, ValidatedPresentation} from "../../packages/core/src/index.js";
import {renderNavigationFeedbackNode} from "../../packages/web/src/region/navigation-feedback-renderer.js";

type Node = ValidatedPresentation["nodes"][number];

function node(id: string, values: PresentationValues, ports: readonly {id: string; direction: "output"; payload: InteractionPayload["kind"]}[] = []): Node {
  return {
    node: {id, role: "feedback", representation: {id, revision: "1"}, config: {schema: {id: `${id}.config`, revision: "1"}, values}, children: [],
      result: undefined},
    manifest: {id, revision: "1"},
    config: {values, fields: [], ports, operations: []},
    result: undefined,
  } as Node;
}

function handler(rendered: ReturnType<typeof renderNavigationFeedbackNode>): (event: Event) => void {
  if (rendered === undefined || typeof rendered !== "object" || !("values" in rendered)) throw new Error("No template result");
  const candidate = rendered.values.find((value) => typeof value === "function");
  if (typeof candidate !== "function") throw new Error("No event handler");
  return candidate as (event: Event) => void;
}

describe("navigation and feedback region renderer", () => {
  it("delegates every registered representation to its owned custom element", () => {
    const cases: readonly [string, string, PresentationValues][] = [
      ["navigation.breadcrumb", "aeliqo-breadcrumb", {items: [], label: "Breadcrumb"}],
      ["navigation.menu", "aeliqo-menu", {items: [], label: "Menu"}],
      ["navigation.pagination", "aeliqo-pagination", {page: 1, label: "Pagination"}],
      ["navigation.tabs", "aeliqo-tabs", {items: []}],
      ["navigation.tree-nav", "aeliqo-tree-nav", {nodes: [], label: "Tree"}],
      ["feedback.tooltip", "aeliqo-tooltip", {label: "Help", content: "Info"}],
      ["feedback.popover", "aeliqo-popover", {label: "Open", content: "Info"}],
      ["feedback.dialog", "aeliqo-dialog", {heading: "Dialog"}],
      ["feedback.drawer", "aeliqo-drawer", {heading: "Drawer"}],
      ["feedback.toast", "aeliqo-toast", {message: "Saved"}],
      ["feedback.alert", "aeliqo-alert", {message: "Attention"}],
      ["feedback.progress", "aeliqo-progress", {label: "Progress"}],
      ["feedback.skeleton", "aeliqo-skeleton", {label: "Loading"}],
      ["feedback.empty-state", "aeliqo-empty-state", {kind: "no-records", heading: "Empty", message: "None"}],
    ];
    for (const [id, tag, values] of cases) {
      const rendered = renderNavigationFeedbackNode(node(id, values), () => undefined, () => undefined);
      expect(rendered).toBeDefined();
      if (rendered !== undefined && typeof rendered === "object" && "strings" in rendered) expect(rendered.strings.join("")).toContain(`<${tag}`);
    }
  });

  it("maps breadcrumb and menu events to declared canonical route/action payloads", () => {
    const emitted: InteractionPayload[] = [];
    const breadcrumb = node("navigation.breadcrumb", {items: [{id: "home", route: {id: "route.home", revision: "1"}, params: {}, href: "/home"}]}, [{id: "navigate", direction: "output", payload: "navigate"}]);
    const navigationEvent = new CustomEvent("aeliqo-navigation", {detail: {id: "home", source: "user"}, cancelable: true});
    const breadcrumbHandler = handler(renderNavigationFeedbackNode(breadcrumb, () => undefined, (_node, _port, payload) => emitted.push(payload)));
    breadcrumbHandler(navigationEvent);
    expect(navigationEvent.defaultPrevented).toBe(true);
    expect(emitted).toEqual([{kind: "navigate", route: {id: "route.home", revision: "1"}, params: {}}]);

    const menu = node("navigation.menu", {items: [{id: "open", action: {id: "action.open", revision: "1"}, input: {mode: "open"}}]}, [{id: "action", direction: "output", payload: "action-request"}]);
    const menuEvent = new CustomEvent("aeliqo-menu-action", {detail: {id: "open", source: "user"}, cancelable: true});
    const menuHandler = handler(renderNavigationFeedbackNode(menu, () => undefined, (_node, _port, payload) => emitted.push(payload)));
    menuHandler(menuEvent);
    expect(menuEvent.defaultPrevented).toBe(false);
    expect(emitted.at(-1)).toEqual({kind: "action-request", action: {id: "action.open", revision: "1"}, input: {mode: "open"}});
  });

  it("keeps page and tree mappings scoped to their host metadata", () => {
    const emitted: InteractionPayload[] = [];
    const page = node("navigation.pagination", {page: 1, outputId: "results", queryDigest: "query-1", cursors: [{page: 2, cursor: "cursor-2"}]}, [{id: "page", direction: "output", payload: "page"}]);
    const pageEvent = new CustomEvent("aeliqo-page-change", {detail: {page: 2, source: "user"}, cancelable: true});
    handler(renderNavigationFeedbackNode(page, () => undefined, (_node, _port, payload) => emitted.push(payload)))(pageEvent);
    expect(emitted.at(-1)).toEqual({kind: "page", outputId: "results", queryDigest: "query-1", cursor: "cursor-2"});

    const tree = node("navigation.tree-nav", {nodes: [{id: "settings", action: {id: "action.open", revision: "1"}, input: {}}]}, [{id: "action", direction: "output", payload: "action-request"}]);
    const treeEvent = new CustomEvent("aeliqo-tree-nav-select", {detail: {id: "settings", source: "user"}, cancelable: true});
    handler(renderNavigationFeedbackNode(tree, () => undefined, (_node, _port, payload) => emitted.push(payload)))(treeEvent);
    expect(emitted.at(-1)).toEqual({kind: "action-request", action: {id: "action.open", revision: "1"}, input: {}});
  });
});

