import {css, html, LitElement, nothing} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import type {AeliqoDataScope, AeliqoDataStatus, AeliqoDataValue} from "./types.js";
import {dataValueText, dataStatusMessage, scopeText, dataStyles, statusTemplate} from "./shared.js";

export type AeliqoMetricFormat = "plain" | "number" | "percent";

/** A single host-validated value. This component formats and labels data; it
 * never computes a metric or changes its scope. */
export class AeliqoMetricElement extends LitElement {
  static readonly properties = {
    label: {type: String},
    value: {attribute: false},
    displayValue: {attribute: "display-value", type: String},
    unit: {type: String},
    description: {type: String},
    scope: {attribute: false},
    status: {type: String},
    message: {type: String},
    format: {type: String},
    locale: {type: String},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  label = "";
  value: AeliqoDataValue | undefined = undefined;
  displayValue: string | undefined = undefined;
  unit = "";
  description = "";
  scope: AeliqoDataScope | undefined = undefined;
  status: AeliqoDataStatus = "ready";
  message = "";
  format: AeliqoMetricFormat = "plain";
  locale = "";

  protected override render() {
    const effectiveStatus = this.value === undefined && this.status === "ready" ? "unavailable" : this.status;
    const unavailable = effectiveStatus === "unavailable" || effectiveStatus === "error";
    const value = unavailable ? (dataStatusMessage(effectiveStatus, this.message) ?? "Value unavailable.") : this.renderValue();
    const describedBy = [this.description ? "description" : "", this.scopeText ? "scope" : ""].filter(Boolean).join(" ");
    return html`
      <dl part="metric" aria-describedby=${describedBy || nothing} data-status=${effectiveStatus}>
        <dt part="label">${this.label}</dt>
        <dd part="value" class=${unavailable ? "unavailable" : nothing}>
          <bdi part="number" dir=${!unavailable && this.numericValue ? "ltr" : "auto"} tabindex=${!unavailable && this.numericValue ? "0" : nothing}>${value}</bdi>${this.unit ? html`<span part="unit">${this.unit}</span>` : nothing}
        </dd>
      </dl>
        ${this.description ? html`<div id="description" part="description">${this.description}</div>` : nothing}
        ${this.scopeText ? html`<div id="scope" part="scope">${this.scopeText}</div>` : nothing}
      ${effectiveStatus === "loading" || effectiveStatus === "partial" || effectiveStatus === "stale" || effectiveStatus === "empty"
        ? statusTemplate(effectiveStatus, this.message) : nothing}
    `;
  }

  private get scopeText(): string | undefined {
    return scopeText(this.scope);
  }

  private get numericValue(): boolean {
    return this.displayValue === undefined && (typeof this.value === "number" || (typeof this.value === "object" && this.value !== null && !Array.isArray(this.value) && typeof this.value.decimal === "string"));
  }

  private renderValue(): string {
    if (this.displayValue !== undefined) return this.displayValue;
    if (this.value === null || this.value === undefined) return "—";
    if (this.format === "plain" || typeof this.value !== "number") return dataValueText(this.value);
    const options: Intl.NumberFormatOptions = this.format === "percent" ? {style: "percent", maximumFractionDigits: 2} : {maximumFractionDigits: 2};
    try {
      return new Intl.NumberFormat(this.locale || undefined, options).format(this.value);
    } catch {
      return dataValueText(this.value);
    }
  }

  static readonly styles = [aeliqoThemeStyles, dataStyles, css`
    dl { margin: 0; }
    dt { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); }
    dd { align-items: baseline; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-4, 0.25rem); margin: var(--aeliqo-space-4, 0.25rem) 0 0; }
    [part="number"] { font-size: var(--aeliqo-typography-font-size-heading, 1.5rem); font-weight: var(--aeliqo-typography-font-weight-semibold, 600); overflow-wrap: anywhere; }
    [part="number"][dir="ltr"] { display: inline-block; max-inline-size: 100%; min-inline-size: 0; overflow-x: auto; overflow-y: hidden; overflow-wrap: normal; white-space: nowrap; }
    [part="unit"] { color: var(--aeliqo-color-muted, #475569); overflow-wrap: anywhere; }
    [part="description"], [part="scope"] { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); margin-block-start: var(--aeliqo-space-4, 0.25rem); overflow-wrap: anywhere; }
    dd.unavailable [part="number"] { color: var(--aeliqo-color-muted, #475569); font-size: inherit; font-weight: 400; }
  `];
}
