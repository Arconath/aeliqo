import {css, html, nothing} from "lit";
import {AeliqoFoundationElement} from "../foundation/base.js";
import {aeliqoInputStyles} from "./base.js";

/** Semantic grouping boundary for related controls and coordinated messages. */
export class AeliqoFieldGroupElement extends AeliqoFoundationElement {
  static readonly properties = {
    legend: {type: String},
    description: {type: String},
    error: {type: String},
    disabled: {type: Boolean, reflect: true},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  legend = "";
  description = "";
  error = "";
  disabled = false;
  private readonly restoredDisabled = new Map<HTMLElement & {disabled?: boolean}, boolean>();

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has("disabled")) return;
    for (const child of Array.from(this.children)) {
      if (!("disabled" in child) || typeof (child as {disabled?: unknown}).disabled !== "boolean") continue;
      const control = child as HTMLElement & {disabled: boolean};
      if (this.disabled) {
        if (!this.restoredDisabled.has(control)) this.restoredDisabled.set(control, control.disabled);
        control.disabled = true;
      } else {
        const prior = this.restoredDisabled.get(control);
        if (prior !== undefined) control.disabled = prior;
        this.restoredDisabled.delete(control);
      }
    }
  }

  protected override render() {
    return html`
      <fieldset part="group" ?disabled=${this.disabled} aria-describedby=${this.describedByIds() || nothing}>
        ${this.legend ? html`<legend part="legend">${this.legend}</legend>` : nothing}
        ${this.description ? html`<span id="description" part="description">${this.description}</span>` : nothing}
        <slot></slot>
        ${this.error ? html`<span id="error" part="error" role="alert">${this.error}</span>` : nothing}
      </fieldset>
    `;
  }

  private describedByIds(): string {
    return [this.description ? "description" : "", this.error ? "error" : ""].filter(Boolean).join(" ");
  }

  static readonly styles = [...aeliqoInputStyles, css`
    fieldset { border: 0; display: grid; gap: var(--aeliqo-space-8, 0.5rem); margin: 0; min-inline-size: 0; padding: 0; }
    legend { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); }
  `];
}
