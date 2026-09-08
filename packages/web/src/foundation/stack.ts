import {css, html} from "lit";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "./base.js";

export type AeliqoStackDirection = "row" | "column";
export type AeliqoStackGap = 0 | 4 | 8 | 12 | 16 | 24 | 32 | 48;
export type AeliqoStackAlign = "start" | "center" | "end" | "stretch";
export type AeliqoStackJustify = "start" | "center" | "end" | "between";

export class AeliqoStackElement extends AeliqoFoundationElement {
  static readonly properties = {
    direction: {type: String},
    gap: {type: Number},
    align: {type: String},
    justify: {type: String},
    wrap: {type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  direction: AeliqoStackDirection = "column";
  gap: AeliqoStackGap = 16;
  align: AeliqoStackAlign = "stretch";
  justify: AeliqoStackJustify = "start";
  wrap = false;

  protected override render() {
    const direction = this.direction === "row" ? "row" : "column";
    const align = this.align === "start" || this.align === "center" || this.align === "end" ? this.align : "stretch";
    const justify = this.justify === "center" || this.justify === "end" || this.justify === "between" ? this.justify : "start";
    const gap = [0, 4, 8, 12, 16, 24, 32, 48].includes(this.gap) ? this.gap : 16;
    return html`<div part="stack" class=${`direction-${direction} align-${align} justify-${justify} gap-${gap}`} ?data-wrap=${this.wrap}><slot></slot></div>`;
  }

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: block; min-inline-size: 0; }
    [part="stack"] { display: flex; min-inline-size: 0; }
    .direction-row { flex-direction: row; }
    .direction-column { flex-direction: column; }
    .align-start { align-items: flex-start; }
    .align-center { align-items: center; }
    .align-end { align-items: flex-end; }
    .align-stretch { align-items: stretch; }
    .justify-start { justify-content: flex-start; }
    .justify-center { justify-content: center; }
    .justify-end { justify-content: flex-end; }
    .justify-between { justify-content: space-between; }
    [data-wrap] { flex-wrap: wrap; }
    .gap-0 { gap: 0; }
    .gap-4 { gap: var(--aeliqo-space-4, 0.25rem); }
    .gap-8 { gap: var(--aeliqo-space-8, 0.5rem); }
    .gap-12 { gap: var(--aeliqo-space-12, 0.75rem); }
    .gap-16 { gap: var(--aeliqo-space-16, 1rem); }
    .gap-24 { gap: var(--aeliqo-space-24, 1.5rem); }
    .gap-32 { gap: var(--aeliqo-space-32, 2rem); }
    .gap-48 { gap: var(--aeliqo-space-48, 3rem); }
  `];
}
