import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {aeliqoNavigationStyles, emitAction} from "./shared.js";

export interface AeliqoTreeNavNode { readonly id: string; readonly label: string; readonly children?: readonly AeliqoTreeNavNode[]; readonly disabled?: boolean; }

interface FlatNode { readonly node: AeliqoTreeNavNode; readonly level: number; readonly parentId?: string; }

export class AeliqoTreeNavElement extends AeliqoFoundationElement {
  static readonly properties = {nodes: {attribute: false}, expandedIds: {attribute: false}, selectedId: {type: String}, label: {type: String}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, aeliqoNavigationStyles, css`
    [part="tree"] { list-style: none; margin: 0; padding: var(--aeliqo-space-4, 0.25rem); }
    [role="treeitem"] { align-items: center; border-radius: var(--aeliqo-radius-small, 0.375rem); cursor: pointer; display: flex; gap: var(--aeliqo-space-8, 0.5rem); min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding-block: var(--aeliqo-space-4, 0.25rem); padding-inline: var(--aeliqo-space-8, 0.5rem); }
    [role="treeitem"][aria-selected="true"] { background: color-mix(in srgb, var(--aeliqo-color-accent, #4338ca) 14%, transparent); font-weight: var(--aeliqo-typography-font-weight-semibold, 600); }
    [role="treeitem"][aria-disabled="true"] { cursor: not-allowed; opacity: 0.55; }
    [role="group"] { list-style: none; margin: 0; padding: 0; }
    .chevron { inline-size: 1.25rem; }
  `];

  nodes: readonly AeliqoTreeNavNode[] = [];
  expandedIds: readonly string[] = [];
  selectedId = "";
  label = "Navigation tree";
  private internalExpanded = new Set<string>();

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("expandedIds")) this.internalExpanded = new Set(this.expandedIds);
  }
  private isExpanded(id: string): boolean { return this.internalExpanded.has(id); }
  private flatVisible(): FlatNode[] {
    const result: FlatNode[] = [];
    const visit = (nodes: readonly AeliqoTreeNavNode[], level: number, parentId?: string): void => {
      for (const node of nodes) {
        result.push({node, level, ...(parentId === undefined ? {} : {parentId})});
        if (node.children?.length && this.isExpanded(node.id)) visit(node.children, level + 1, node.id);
      }
    };
    visit(this.nodes, 1);
    return result;
  }
  private select(node: AeliqoTreeNavNode): void {
    if (node.disabled) return;
    if (!emitAction(this, "aeliqo-tree-nav-select", {id: node.id, previousId: this.selectedId})) return;
    this.selectedId = node.id;
  }
  private toggle(node: AeliqoTreeNavNode): void {
    if (node.disabled) return;
    const expanded = this.isExpanded(node.id);
    if (!emitAction(this, "aeliqo-tree-nav-expand", {id: node.id, expanded: !expanded})) return;
    if (expanded) this.internalExpanded.delete(node.id); else this.internalExpanded.add(node.id);
    this.requestUpdate();
  }
  private keydown(event: KeyboardEvent, flat: FlatNode, index: number): void {
    const node = flat.node;
    const hasChildren = Boolean(node.children?.length);
    const visible = this.flatVisible();
    const current = this.renderRoot.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(node.id)}"]`);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (hasChildren && !this.isExpanded(node.id)) this.toggle(node);
      else if (hasChildren) this.renderRoot.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(node.children![0]!.id)}"]`)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (hasChildren && this.isExpanded(node.id)) this.toggle(node);
      else if (flat.parentId) this.renderRoot.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(flat.parentId)}"]`)?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? Math.min(visible.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : visible.length - 1;
      this.renderRoot.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(visible[next]!.node.id)}"]`)?.focus();
    } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.select(node); }
    void current;
  }
  private renderNode(flat: FlatNode, index: number) {
    const node = flat.node;
    const hasChildren = Boolean(node.children?.length);
    return html`<li role="treeitem" part="item" data-tree-id=${node.id} aria-level=${flat.level} aria-selected=${node.id === this.selectedId ? "true" : "false"} aria-expanded=${hasChildren ? (this.isExpanded(node.id) ? "true" : "false") : nothing} aria-disabled=${node.disabled ? "true" : nothing} tabindex=${node.id === this.selectedId || (!this.selectedId && index === 0) ? "0" : "-1"} style=${`padding-inline-start: calc(var(--aeliqo-space-8, 0.5rem) + ${(flat.level - 1) * 1.25}rem)`} @click=${() => this.select(node)} @keydown=${(event: KeyboardEvent) => this.keydown(event, flat, index)}>
      <span class="chevron" aria-hidden="true">${hasChildren ? (this.isExpanded(node.id) ? "⌄" : "›") : ""}</span><span>${node.label}</span>
    </li>`;
  }
  protected override render() {
    return html`<nav aria-label=${this.label}><ul part="tree" role="tree">${this.flatVisible().map((flat, index) => this.renderNode(flat, index))}</ul></nav>`;
  }
}
