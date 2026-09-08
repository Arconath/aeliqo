import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {activeElement, focusFirst, focusLast, listenOutside, nextFrame, restoreFocus, emitAction} from "../navigation/shared.js";
import {aeliqoFeedbackStyles} from "./shared.js";

export class AeliqoPopoverElement extends AeliqoFoundationElement {
  static readonly properties = {label: {type: String}, content: {type: String}, open: {type: Boolean, reflect: true}, modal: {type: Boolean}, closeOnOutside: {type: Boolean, attribute: "close-on-outside"}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, ...aeliqoFeedbackStyles, css`
    :host { display: inline-block; position: relative; }
    [part="trigger"] { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-small, 0.375rem); cursor: pointer; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding-inline: var(--aeliqo-space-12, 0.75rem); }
    [part="popover"] { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-medium, 0.625rem); box-shadow: var(--aeliqo-elevation-raised, 0 0.25rem 0.75rem -0.5rem #0f172a33); inset-block-start: calc(100% + var(--aeliqo-space-4, 0.25rem)); inset-inline-start: 0; max-inline-size: min(28rem, calc(100vw - 2rem)); padding: var(--aeliqo-space-16, 1rem); position: absolute; width: max-content; z-index: 15; }
    [part="close"] { float: inline-end; }
    [part="close"], [part="trigger"] { min-block-size: var(--aeliqo-control-min-target, 2.75rem); }
  `];

  label = "Open details";
  content = "";
  open = false;
  modal = false;
  closeOnOutside = true;
  private returnFocus: HTMLElement | undefined = undefined;
  private stopOutside: (() => void) | undefined = undefined;

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has("open") && !changed.has("closeOnOutside") && !changed.has("modal")) return;
    this.stopOutside?.(); this.stopOutside = undefined;
    if (this.open) {
      this.returnFocus ??= activeElement(this);
      if (this.closeOnOutside) this.stopOutside = listenOutside(this, () => this.close());
      if (this.modal) nextFrame(() => focusFirst(this.shadowRoot ?? this.renderRoot));
    } else {
      restoreFocus(this.returnFocus); this.returnFocus = undefined;
    }
  }

  disconnectedCallback(): void { this.stopOutside?.(); super.disconnectedCallback(); }
  private close(): void { if (emitAction(this, "aeliqo-popover-close", {})) this.open = false; }
  private keydown(event: KeyboardEvent): void {
    if (event.key === "Escape") { event.preventDefault(); this.close(); return; }
    if (!this.modal || event.key !== "Tab") return;
    const first = this.renderRoot.querySelector<HTMLElement>("[part='popover']")!;
    const active = this.shadowRoot?.activeElement;
    const firstFocusable = first.querySelector<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");
    const lastFocusable = [...first.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].at(-1);
    if (event.shiftKey && active === firstFocusable) { event.preventDefault(); lastFocusable?.focus(); }
    else if (!event.shiftKey && active === lastFocusable) { event.preventDefault(); firstFocusable?.focus(); }
  }

  protected override render() {
    const id = `${this.id || "aeliqo-popover"}-surface`;
    return html`<button part="trigger" type="button" aria-haspopup="dialog" aria-expanded=${this.open ? "true" : "false"} aria-controls=${id} @click=${() => { this.returnFocus ??= activeElement(this); this.open = !this.open; }}>${this.label}</button>
      <section part="popover" id=${id} role="dialog" aria-label=${this.label} aria-modal=${this.modal ? "true" : "false"} ?hidden=${!this.open} @keydown=${this.keydown}>
        <button part="close" type="button" aria-label="Close" @click=${() => this.close()}>×</button>
        ${this.content || html`<slot></slot>`}
      </section>`;
  }
}
