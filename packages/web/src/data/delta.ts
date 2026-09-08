import {css, html, LitElement, nothing} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import type {AeliqoDataScope, AeliqoDataStatus, AeliqoDataValue, AeliqoDeltaResult} from "./types.js";
import {dataStyles, dataStatusMessage, scopeText, statusTemplate} from "./shared.js";

export type AeliqoDeltaMode = "absolute" | "relative" | "percentage-point";

function numeric(value: AeliqoDataValue | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.decimal === "string") {
    const parsed = Number(value.decimal);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function decimalInput(value: AeliqoDataValue | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.decimal === "string") return value.decimal;
  return undefined;
}

function subtractDecimal(left: string, right: string): string | undefined {
  const parse = (value: string): {readonly sign: bigint; readonly digits: bigint; readonly scale: number} | undefined => {
    const match = /^(-?)([0-9]+)(?:\.([0-9]+))?$/u.exec(value);
    if (match === null) return undefined;
    const fraction = match[3] ?? "";
    return {sign: match[1] === "-" ? -1n : 1n, digits: BigInt(`${match[2]}${fraction}`), scale: fraction.length};
  };
  const a = parse(left);
  const b = parse(right);
  if (a === undefined || b === undefined) return undefined;
  const scale = Math.max(a.scale, b.scale);
  const result = a.sign * a.digits * 10n ** BigInt(scale - a.scale) - b.sign * b.digits * 10n ** BigInt(scale - b.scale);
  if (result === 0n) return "0";
  const negative = result < 0n;
  const digits = (negative ? -result : result).toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? digits : digits.slice(0, -scale) || "0";
  const fraction = scale === 0 ? "" : digits.slice(-scale).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function timesHundred(value: string): string | undefined {
  const result = subtractDecimal(value, "0");
  if (result === undefined) return undefined;
  const match = /^(-?)([0-9]+)(?:\.([0-9]+))?$/u.exec(result);
  if (match === null) return undefined;
  const fraction = match[3] ?? "";
  const digits = `${match[2]}${fraction}`.replace(/^0+(?=[0-9])/u, "");
  const shifted = `${digits}${"0".repeat(2)}`;
  const split = shifted.length - fraction.length;
  const whole = shifted.slice(0, split) || "0";
  const decimal = shifted.slice(split).replace(/0+$/u, "");
  return `${match[1]}${whole}${decimal ? `.${decimal}` : ""}`;
}

function signed(value: string): string {
  return value.startsWith("-") || value === "0" ? value : `+${value}`;
}

function decimalText(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Object.is(value, -0)) return "0";
  return String(Number(value.toPrecision(15)));
}

/** Calculate a delta only when the two values are explicitly compatible. */
export function calculateAeliqoDelta(
  current: AeliqoDataValue | undefined,
  baseline: AeliqoDataValue | undefined,
  mode: AeliqoDeltaMode = "absolute",
  compatible = true,
): AeliqoDeltaResult {
  if (!compatible) return {status: "unavailable", reason: "incompatible"};
  const currentNumber = numeric(current);
  const baselineNumber = numeric(baseline);
  if (currentNumber === undefined) return {status: "unavailable", reason: "missing-current"};
  if (baselineNumber === undefined) return {status: "unavailable", reason: "missing-baseline"};
  if (mode === "relative" && baselineNumber === 0) return {status: "unavailable", reason: "zero-denominator"};
  const exactDifference = subtractDecimal(decimalInput(current) ?? "", decimalInput(baseline) ?? "");
  if (exactDifference !== undefined && (mode === "absolute" || mode === "percentage-point")) {
    const exactValue: string | number = typeof current === "number" && typeof baseline === "number" ? Number(exactDifference) : exactDifference;
    if (mode === "absolute") return {status: "ready", value: exactValue, display: signed(exactDifference)};
    const percentagePoints = timesHundred(exactDifference);
    if (percentagePoints !== undefined) return {status: "ready", value: exactValue, display: `${signed(percentagePoints)} pp`};
  }
  const difference = currentNumber - baselineNumber;
  const value = mode === "relative" ? difference / baselineNumber : difference;
  if (!Number.isFinite(value)) return {status: "unavailable", reason: "invalid"};
  const displayValue = mode === "relative" ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`
    : mode === "percentage-point" ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)} pp`
      : `${value > 0 ? "+" : ""}${decimalText(value)}`;
  return {status: "ready", value, display: displayValue};
}

/** Displays a comparison supplied by the host. Percentage points and
 * relative percentage change use distinct modes and labels. */
export class AeliqoDeltaElement extends LitElement {
  static readonly properties = {
    label: {type: String},
    current: {attribute: false},
    baseline: {attribute: false},
    mode: {type: String},
    compatible: {type: Boolean},
    unit: {type: String},
    scope: {attribute: false},
    status: {type: String},
    message: {type: String},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  label = "Change";
  current: AeliqoDataValue | undefined = undefined;
  baseline: AeliqoDataValue | undefined = undefined;
  mode: AeliqoDeltaMode = "absolute";
  compatible = true;
  unit = "";
  scope: AeliqoDataScope | undefined = undefined;
  status: AeliqoDataStatus = "ready";
  message = "";

  protected override render() {
    const result = this.status === "ready" ? calculateAeliqoDelta(this.current, this.baseline, this.validMode, this.compatible) : undefined;
    const modeLabel = this.validMode === "relative" ? "relative change" : this.validMode === "percentage-point" ? "percentage-point change" : "absolute change";
    const unavailable = this.status !== "ready" || result?.status !== "ready";
    const rendered = unavailable
      ? dataStatusMessage(this.status !== "ready" ? this.status : "unavailable", this.message) ?? "Value unavailable."
      : result.display ?? "—";
    const scope = scopeText(this.scope);
    return html`
      <dl part="delta" data-mode=${this.validMode} data-status=${unavailable ? "unavailable" : "ready"}>
        <dt part="label">${this.label}</dt>
        <dd part="value" class=${unavailable ? "unavailable" : ""} aria-label=${unavailable ? rendered : `${rendered}, ${modeLabel}`}>
          <span part="number">${rendered}</span>${this.unit && !unavailable ? html`<span part="unit">${this.unit}</span>` : nothing}
        </dd>
        <div part="mode">${modeLabel}</div>
        ${scope ? html`<div part="scope">${scope}</div>` : nothing}
      </dl>
      ${this.status === "loading" || this.status === "partial" || this.status === "stale" || this.status === "empty" ? statusTemplate(this.status, this.message) : nothing}
    `;
  }

  private get validMode(): AeliqoDeltaMode {
    return this.mode === "relative" || this.mode === "percentage-point" ? this.mode : "absolute";
  }

  static readonly styles = [aeliqoThemeStyles, dataStyles, css`
    dl { margin: 0; }
    dt { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); }
    dd { align-items: baseline; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-4, 0.25rem); margin: var(--aeliqo-space-4, 0.25rem) 0 0; }
    [part="number"] { font-size: var(--aeliqo-typography-font-size-heading, 1.5rem); font-variant-numeric: tabular-nums; font-weight: var(--aeliqo-typography-font-weight-semibold, 600); overflow-wrap: anywhere; }
    [part="unit"], [part="mode"], [part="scope"] { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); }
    [part="mode"], [part="scope"] { margin-block-start: var(--aeliqo-space-4, 0.25rem); }
    dd.unavailable [part="number"] { color: var(--aeliqo-color-muted, #475569); font-size: inherit; font-weight: 400; }
  `];
}
