import {css, html} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../foundation/base.js";
import {activeElement, focusFirst, nextFrame, restoreFocus, emitAction} from "../navigation/shared.js";
import {aeliqoFeedbackStyles} from "./shared.js";

export type AeliqoDrawerMode = "inline" | "modal";
export type AeliqoDrawerSide = "start" | "end";

export class AeliqoDrawerElement extends AeliqoFoundationElement {
  static readonly properties = {open: {type: Boolean, reflect: true}, heading: {type: String}, mode: {type: String}, side: {type: String}};
  static readonly aeliqoVersion = "0.1.0-m0";
  static readonly styles = [...aeliqoFoundationThemeStyles, ...aeliqoFeedbackStyles, css`
    :host { display: block; }
    [part="inline"] { background: var(--aeliqo-color-surface, #f8fafc); border-inline-start: 0.0625rem solid var(--aeliqo-color-border, #64748b); border-inline-end: 0.0625rem solid var(--aeliqo-color-border, #64748b); max-block-size: 100%; overflow: auto; }
    dialog { background: var(--aeliqo-color-surface, #f8fafc); border: 0; border-block: 0.0625rem solid var(--aeliqo-color-border, #64748b); color: inherit; inset-block: 0; margin: 0; max-block-size: none; max-inline-size: min(28rem, 92vw); padding: 0; position: fixed; width: min(28rem, 92vw); }
    dialog[data-side="end"] { inset-inline-end: 0; }
    dialog[data-side="start"] { inset-inline-start: 0; }
    dialog::backdrop { background: rgb(15 23 42 / 0.45); }
    [part="header"] { align-items: center; border-block-end: 0.0625rem solid var(--aeliqo-color-border, #64748b); display: flex; justify-content: space-between; padding: var(--aeliqo-space-12, 0.75rem) var(--aeliqo-space-16, 1rem); }
    [part="content"] { max-block-size: calc(100vh - 5rem); overflow: auto; padding: var(--aeliqo-space-16, 1rem); }
    [part="close"] { background: transparent; border: 0; cursor: pointer; min-block-size: var(--aeliqo-control-min-target, 2.75rem); min-inline-size: var(--aeliqo-control-min-target, 2.75rem); }
  `];

  open = false;
  heading = "Details";
  mode: AeliqoDrawerMode = "inline";
  side: AeliqoDrawerSide = "end";
  private returnFocus: HTMLElement | undefined = undefined;

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has("open") && !changed.has("mode")) return;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (this.mode === "modal" && dialog !== null) {
      if (this.open) {
        this.returnFocus ??= activeElement(this);
        if (!dialog.open) typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
        nextFrame(() => focusFirst(dialog));
      } else {
        if (dialog.open && typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
        restoreFocus(this.returnFocus); this.returnFocus = undefined;
      }
    }
  }

  private close(): void { if (emitAction(this, "aeliqo-drawer-close", {})) this.open = false; }
  protected override render() {
    const headingId = `${this.id || "aeliqo-drawer"}-heading`;
    if (this.mode === "modal") return html`<dialog part="modal" data-side=${this.side} aria-labelledby=${headingId} @cancel=${(event: Event) => { event.preventDefault(); this.close(); }}>
      <header part="header"><h2 id=${headingId}>${this.heading}</h2><button part="close" type="button" aria-label="Close" @click=${() => this.close()}>×</button></header><div part="content"><slot></slot></div>
    </dialog>`;
    return html`<aside part="inline" aria-labelledby=${headingId} ?hidden=${!this.open}><header part="header"><h2 id=${headingId}>${this.heading}</h2><button part="close" type="button" aria-label="Close" @click=${() => this.close()}>×</button></header><div part="content"><slot></slot></div></aside>`;
  }
}
