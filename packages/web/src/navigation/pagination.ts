import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {aeliqoNavigationStyles, emitAction} from "./shared.js";

export class AeliqoPaginationElement extends AeliqoFoundationElement {
  static readonly properties = {
    page: {type: Number},
    pageCount: {type: Number, attribute: "page-count"},
    hasPrevious: {type: Boolean, attribute: "has-previous"},
    hasNext: {type: Boolean, attribute: "has-next"},
    label: {type: String},
    pending: {type: Boolean, reflect: true},
  };
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, aeliqoNavigationStyles, css`
    :host { align-items: center; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, 0.5rem); justify-content: space-between; }
    nav { align-items: center; display: inline-flex; gap: var(--aeliqo-space-4, 0.25rem); }
    button { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-small, 0.375rem); cursor: pointer; min-block-size: var(--aeliqo-control-min-target, 2.75rem); min-inline-size: var(--aeliqo-control-min-target, 2.75rem); padding-inline: var(--aeliqo-space-8, 0.5rem); }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    [part="status"] { color: var(--aeliqo-color-muted, #4b5563); }
  `];

  page = 1;
  pageCount?: number;
  hasPrevious = false;
  hasNext = false;
  label = "Pagination";
  pending = false;

  private move(direction: "previous" | "next"): void {
    const next = direction === "next" ? this.page + 1 : Math.max(1, this.page - 1);
    const allowed = direction === "next" ? this.hasNext : this.hasPrevious;
    if (this.pending || !allowed || (this.pageCount !== undefined && next > this.pageCount)) return;
    if (!emitAction(this, "aeliqo-page-change", {page: next, previousPage: this.page, direction})) return;
    this.page = next;
  }

  protected override render() {
    const total = Number.isSafeInteger(this.pageCount) && this.pageCount! > 0 ? ` of ${this.pageCount}` : "";
    const atFirst = !Number.isSafeInteger(this.page) || this.page <= 1;
    const atLast = this.pageCount !== undefined && Number.isSafeInteger(this.pageCount) && this.page >= this.pageCount;
    return html`<nav aria-label=${this.label}>
      <button part="previous" type="button" aria-label="Previous page" ?disabled=${this.pending || !this.hasPrevious || atFirst} @click=${() => this.move("previous")}>‹</button>
      <span part="status" aria-live="polite">Page ${this.page}${total}</span>
      <button part="next" type="button" aria-label="Next page" ?disabled=${this.pending || !this.hasNext || atLast} @click=${() => this.move("next")}>›</button>
    </nav>`;
  }
}
