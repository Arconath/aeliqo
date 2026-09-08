import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {activeElement, focusFirst, focusableElements, listenOutside, nextFrame, restoreFocus, emitAction, safeElementId} from "../navigation/shared.js";
import {aeliqoFeedbackStyles} from "./shared.js";

export class AeliqoPopoverElement extends AeliqoFoundationElement {
  static readonly properties = {label: {type: String}, content: {type: String}, open: {type: Boolean, reflect: true}, modal: {type: Boolean}, closeOnOutside: {type: Boolean, attribute: "close-on-outside"}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, ...aeliqoFeedbackStyles, css`
    :host { display: inline-block; position: relative; }
    [part="trigger"] { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-small, 0.375rem); cursor: pointer; min-block-size: var(--aeliqo-control-min-target, 2.75rem); padding-inline: var(--aeliqo-space-12, 0.75rem); }
    [part="popover"] { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-medium, 0.625rem); box-shadow: var(--aeliqo-elevation-raised, 0 0.25rem 0.75rem -0.5rem #0f172a33); inset-block-start: calc(100% + var(--aeliqo-space-4, 0.25rem)); inset-inline-start: 0; max-block-size: min(70vh, 32rem); max-inline-size: min(28rem, calc(100vw - 2rem)); overflow: auto; padding: var(--aeliqo-space-16, 1rem); position: absolute; width: max-content; z-index: 15; }
    dialog[part="popover"] { inset: 50% auto auto 50%; max-block-size: min(70vh, 32rem); position: fixed; transform: translate(-50%, -50%); }
    dialog::backdrop { background: rgb(15 23 42 / 0.45); }
    [part="close"] { float: inline-end; }
    [part="close"], [part="trigger"] { min-block-size: var(--aeliqo-control-min-target, 2.75rem); }
  `];

  label = "Open details";
  content = "";
  open = false;
  modal = false;
  closeOnOutside = true;
  private returnFocus: HTMLElement | undefined = undefined;
  private pendingFocus: HTMLElement | undefined = undefined;
  private focusEpoch = 0;
  private stopOutside: (() => void) | undefined = undefined;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (!changed.has("modal") || !this.open) return;
    const active = focusableElements(this).find((candidate) => candidate.matches(":focus"));
    if (active !== undefined) this.pendingFocus = active;
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has("open") && !changed.has("closeOnOutside") && !changed.has("modal")) return;
    const epoch = ++this.focusEpoch;
    this.stopOutside?.(); this.stopOutside = undefined;
    if (this.open) {
      this.returnFocus ??= activeElement(this);
      if (this.closeOnOutside) this.stopOutside = listenOutside(this, () => this.close());
      const surface = this.renderRoot.querySelector<HTMLElement>("[part='popover']");
      if (this.modal && surface instanceof HTMLDialogElement && !surface.open) {
        if (typeof surface.showModal === "function") surface.showModal();
        else if (typeof surface.show === "function") surface.show();
        else surface.setAttribute("open", "");
      }
      const pending = this.pendingFocus;
      this.pendingFocus = undefined;
      const focusIfNeeded = (restorePending: boolean): void => {
        if (epoch !== this.focusEpoch || !this.open || surface === null || !surface.isConnected) return;
        const focusables = focusableElements(surface);
        const current = focusables.find((candidate) => candidate.matches(":focus"));
        if (restorePending && pending?.isConnected && focusables.includes(pending)) {
          pending.focus();
          return;
        }
        if (current === undefined) focusFirst(surface);
      };
      // Preserve a focused slotted control during a mode switch synchronously.
      // The queued fallback only fills an empty focus surface and cannot steal a
      // focus that the consumer moved after opening.
      focusIfNeeded(true);
      if (surface !== null) nextFrame(() => focusIfNeeded(false));
    } else {
      this.pendingFocus = undefined;
      const surface = this.renderRoot.querySelector<HTMLDialogElement>("dialog[part='popover']");
      if (surface?.open) {
        if (typeof surface.close === "function") surface.close();
        else surface.removeAttribute("open");
      }
      restoreFocus(this.returnFocus); this.returnFocus = undefined;
    }
  }

  disconnectedCallback(): void { this.stopOutside?.(); super.disconnectedCallback(); }
  private close(): void { if (emitAction(this, "aeliqo-popover-close", {})) this.open = false; }
  private keydown(event: KeyboardEvent): void {
    if (event.key === "Escape") { event.preventDefault(); this.close(); return; }
    if (!this.modal || event.key !== "Tab") return;
    const surface = this.renderRoot.querySelector<HTMLElement>("[part='popover']");
    if (surface === null) return;
    const focusables = focusableElements(surface);
    const first = focusables[0];
    const last = focusables.at(-1);
    const eventTarget = event.target instanceof HTMLElement && focusables.includes(event.target) ? event.target : undefined;
    const active = eventTarget ?? activeElement(this);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  private cancel(event: Event): void { event.preventDefault(); this.close(); }

  protected override render() {
    const id = safeElementId(`${this.id || "aeliqo-popover"}-surface`, "aeliqo-popover-surface");
    const content = html`<button part="close" type="button" aria-label="Close" @click=${() => this.close()}>×</button>
      ${this.content || html`<slot></slot>`}`;
    return html`<button part="trigger" type="button" aria-haspopup="dialog" aria-expanded=${this.open ? "true" : "false"} aria-controls=${id} @click=${() => { this.returnFocus ??= activeElement(this); this.open = !this.open; }}>${this.label}</button>
      ${this.modal
        ? html`<dialog part="popover" id=${id} role="dialog" aria-label=${this.label} aria-modal="true" @cancel=${this.cancel} @keydown=${this.keydown}>${content}</dialog>`
        : html`<section part="popover" id=${id} role="dialog" aria-label=${this.label} aria-modal="false" ?hidden=${!this.open} @keydown=${this.keydown}>${content}</section>`}`;
  }
}
