import {css, html, nothing} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {activeElement, focusFirst, focusableElements, nextFrame, restoreFocus, emitAction, safeElementId} from "../navigation/shared.js";
import {aeliqoFeedbackStyles} from "./shared.js";

export class AeliqoDialogElement extends AeliqoFoundationElement {
  static readonly properties = {open: {type: Boolean, reflect: true}, heading: {type: String}, modal: {type: Boolean}, closeOnEscape: {type: Boolean, attribute: "close-on-escape"}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, ...aeliqoFeedbackStyles, css`
    dialog { background: var(--aeliqo-color-surface, #f8fafc); border: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-radius: var(--aeliqo-radius-large, 0.875rem); box-shadow: var(--aeliqo-elevation-raised, 0 0.25rem 0.75rem -0.5rem #0f172a33); color: inherit; inline-size: min(40rem, calc(100vw - 2rem)); max-block-size: min(80vh, 48rem); padding: 0; }
    dialog::backdrop { background: rgb(15 23 42 / 0.55); }
    [part="header"] { align-items: center; border-block-end: 0.0625rem solid var(--aeliqo-color-border, #64748b); display: flex; gap: var(--aeliqo-space-8, 0.5rem); justify-content: space-between; padding: var(--aeliqo-space-12, 0.75rem) var(--aeliqo-space-16, 1rem); }
    [part="content"] { overflow: auto; padding: var(--aeliqo-space-16, 1rem); }
    [part="close"] { background: transparent; border: 0; cursor: pointer; min-block-size: var(--aeliqo-control-min-target, 2.75rem); min-inline-size: var(--aeliqo-control-min-target, 2.75rem); }
  `];

  open = false;
  heading = "Dialog";
  modal = true;
  closeOnEscape = true;
  private returnFocus: HTMLElement | undefined = undefined;
  private pendingFocus: HTMLElement | undefined = undefined;
  private shownModal: boolean | undefined = undefined;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (!changed.has("modal") || !this.open) return;
    const active = focusableElements(this).find((candidate) => candidate.matches(":focus"));
    if (active !== undefined) this.pendingFocus = active;
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has("open") && !changed.has("modal")) return;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (dialog === null) return;
    if (this.open) {
      this.returnFocus ??= activeElement(this);
      if (!dialog.open) {
        if (this.modal && typeof dialog.showModal === "function") dialog.showModal();
        else if (typeof dialog.show === "function") dialog.show();
        else dialog.setAttribute("open", "");
        this.shownModal = this.modal;
      } else if (this.shownModal !== undefined && this.shownModal !== this.modal) {
        if (dialog.open && typeof dialog.close === "function") dialog.close();
        this.shownModal = undefined;
        if (this.modal && typeof dialog.showModal === "function") dialog.showModal();
        else if (typeof dialog.show === "function") dialog.show();
        else dialog.setAttribute("open", "");
        this.shownModal = this.modal;
      }
      const target = this.pendingFocus;
      this.pendingFocus = undefined;
      const focusTarget = (preserveCurrent: boolean): void => {
        const focusables = focusableElements(dialog);
        const current = activeElement(this);
        if (preserveCurrent && current !== undefined && focusables.includes(current)) return;
        if (target?.isConnected && focusables.includes(target)) target.focus();
        else focusFirst(dialog);
      };
      focusTarget(false);
      nextFrame(() => focusTarget(true));
    } else {
      if (dialog.open && typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
      this.shownModal = undefined;
      restoreFocus(this.returnFocus); this.returnFocus = undefined;
    }
  }

  private close(): void { if (emitAction(this, "aeliqo-dialog-close", {})) this.open = false; }
  private cancel(event: Event): void { if (!this.closeOnEscape) { event.preventDefault(); return; } event.preventDefault(); this.close(); }
  private keydown(event: KeyboardEvent): void {
    if (!this.modal || event.key !== "Tab") return;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (dialog === null) return;
    const focusables = focusableElements(dialog);
    const first = focusables[0];
    const last = focusables.at(-1);
    const eventTarget = event.target instanceof HTMLElement && focusables.includes(event.target) ? event.target : undefined;
    const active = eventTarget ?? activeElement(this);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }
  protected override render() {
    const headingId = safeElementId(`${this.id || "aeliqo-dialog"}-heading`, "aeliqo-dialog-heading");
    return html`<dialog part="dialog" aria-labelledby=${headingId} @cancel=${this.cancel} @keydown=${this.keydown}>
      <header part="header"><h2 id=${headingId}>${this.heading}</h2><button part="close" type="button" aria-label="Close" @click=${() => this.close()}>×</button></header>
      <div part="content"><slot></slot></div>
    </dialog>`;
  }
}
