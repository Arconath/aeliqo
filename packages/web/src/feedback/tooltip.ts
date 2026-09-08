import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {aeliqoFeedbackStyles} from "./shared.js";

export class AeliqoTooltipElement extends AeliqoFoundationElement {
  static readonly properties = {label: {type: String}, content: {type: String}, open: {type: Boolean, reflect: true}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, ...aeliqoFeedbackStyles, css`
    :host { display: inline-block; position: relative; }
    [part="trigger"] { background: transparent; border: 0; cursor: help; display: inline-flex; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding: var(--aeliqo-space-4, 0.25rem); }
    [part="tooltip"] { background: var(--aeliqo-color-text, #111827); border-radius: var(--aeliqo-radius-small, 0.375rem); color: var(--aeliqo-color-canvas, #fff); inset-block-start: calc(100% + var(--aeliqo-space-4, 0.25rem)); inset-inline-start: 0; max-inline-size: min(22rem, calc(100vw - 2rem)); padding: var(--aeliqo-space-8, 0.5rem); position: absolute; width: max-content; z-index: 20; }
  `];

  label = "More information";
  content = "";
  open = false;
  private closeTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  private show(): void { clearTimeout(this.closeTimer); this.open = true; }
  private hide(): void { clearTimeout(this.closeTimer); this.open = false; }
  private keydown(event: KeyboardEvent): void { if (event.key === "Escape") { event.preventDefault(); this.hide(); } }

  disconnectedCallback(): void { clearTimeout(this.closeTimer); super.disconnectedCallback(); }

  protected override render() {
    const tooltipId = `${this.id || "aeliqo-tooltip"}-content`;
    return html`<button part="trigger" type="button" aria-label=${this.label} aria-describedby=${this.open ? tooltipId : nothing}
      @mouseenter=${this.show} @focus=${this.show} @mouseleave=${this.hide} @blur=${this.hide} @keydown=${this.keydown}>${this.label}</button>
      <span part="tooltip" id=${tooltipId} role="tooltip" ?hidden=${!this.open}>${this.content || html`<slot></slot>`}</span>`;
  }
}
