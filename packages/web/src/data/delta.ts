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

interface DecimalRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}

function rational(numerator: bigint, denominator: bigint): DecimalRational | undefined {
  if (denominator === 0n) return undefined;
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

/** Parse ordinary and scientific decimal text without passing through IEEE-754. */
function parseDecimal(value: string): DecimalRational | undefined {
  const match = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:e([+-]?\d+))?$/iu.exec(value);
  if (match === null) return undefined;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10000) return undefined;
  let numerator = BigInt(`${match[1]}${match[2]}${fraction}`);
  const scale = fraction.length - exponent;
  let denominator = 1n;
  if (scale > 0) denominator = 10n ** BigInt(scale);
  else if (scale < 0) numerator *= 10n ** BigInt(-scale);
  return rational(numerator, denominator);
}

/** Render only terminating rationals, so an exact result never hides rounding. */
function finiteDecimal(value: DecimalRational): string | undefined {
  if (value.numerator === 0n) return "0";
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {denominator /= 2n; twos++;}
  while (denominator % 5n === 0n) {denominator /= 5n; fives++;}
  if (denominator !== 1n) return undefined;
  const scale = Math.max(twos, fives);
  const coefficient = (value.numerator < 0n ? -value.numerator : value.numerator)
    * 2n ** BigInt(scale - twos)
    * 5n ** BigInt(scale - fives);
  const digits = coefficient.toString();
  const padded = digits.padStart(scale + 1, "0");
  const whole = scale === 0 ? padded : padded.slice(0, -scale) || "0";
  const fraction = scale === 0 ? "" : padded.slice(-scale).replace(/0+$/u, "");
  return `${value.numerator < 0n ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function subtractDecimal(left: string, right: string): string | undefined {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (a === undefined || b === undefined) return undefined;
  return finiteDecimal(rational(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator)!);
}

function timesHundred(value: string): string | undefined {
  const parsed = parseDecimal(value);
  return parsed === undefined ? undefined : finiteDecimal(rational(parsed.numerator * 100n, parsed.denominator)!);
}

function divideDecimal(left: string, right: string): string | undefined {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (a === undefined || b === undefined || b.numerator === 0n) return undefined;
  return finiteDecimal(rational(a.numerator * b.denominator, a.denominator * b.numerator)!);
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
  const currentText = decimalInput(current);
  const baselineText = decimalInput(baseline);
  const exactDifference = currentText !== undefined && baselineText !== undefined
    ? subtractDecimal(currentText, baselineText) : undefined;
  if (exactDifference !== undefined && (mode === "absolute" || mode === "percentage-point")) {
    const exactValue: string | number = typeof current === "number" && typeof baseline === "number" ? Number(exactDifference) : exactDifference;
    if (typeof exactValue === "number" && !Number.isFinite(exactValue)) return {status: "unavailable", reason: "invalid"};
    if (mode === "absolute") return {status: "ready", value: exactValue, display: signed(exactDifference)};
    const percentagePoints = timesHundred(exactDifference);
    if (percentagePoints !== undefined) return {status: "ready", value: exactValue, display: `${signed(percentagePoints)} pp`};
  }
  if (mode === "relative" && currentText !== undefined && baselineText !== undefined) {
    const ratio = exactDifference === undefined ? undefined : divideDecimal(exactDifference, baselineText);
    if (ratio === undefined && parseDecimal(baselineText)?.numerator === 0n) return {status: "unavailable", reason: "zero-denominator"};
    if (ratio !== undefined) {
      const percentage = timesHundred(ratio);
      if (percentage !== undefined) {
        const exactValue: string | number = typeof current === "number" && typeof baseline === "number" ? Number(ratio) : ratio;
        if (typeof exactValue === "number" && Number.isFinite(exactValue)) {
          return {status: "ready", value: exactValue, display: `${signed(percentage)}%`};
        }
        if (typeof exactValue === "string") return {status: "ready", value: exactValue, display: `${signed(percentage)}%`};
      }
    }
    if (typeof current === "object" || typeof baseline === "object") return {status: "unavailable", reason: "invalid"};
  }
  const currentNumber = numeric(current);
  const baselineNumber = numeric(baseline);
  if (currentNumber === undefined) return {status: "unavailable", reason: "missing-current"};
  if (baselineNumber === undefined) return {status: "unavailable", reason: "missing-baseline"};
  if (mode === "relative" && baselineNumber === 0) return {status: "unavailable", reason: "zero-denominator"};
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
