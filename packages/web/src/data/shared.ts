import {css, html, nothing, type TemplateResult} from "lit";
import {scalarIdentity} from "@aeliqo/core";
import type {Result} from "@aeliqo/core";
import type {AeliqoDataRecord, AeliqoDataScope, AeliqoDataStatus, AeliqoDataValue} from "./types.js";

/** Materialized observations remain readable even when population coverage is unknown. */
export function materializedDataStatus(result: Result): AeliqoDataStatus {
  return result.coverage.kind === "partial" || result.coverage.kind === "sample" ? "partial" : "ready";
}

/** Stable, typed identity encoding. It deliberately excludes render position. */
export function stableDataValueKey(value: AeliqoDataValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "null:";
  if (typeof value === "string") return `string:${value.length}:${value}`;
  if (typeof value === "boolean") return `boolean:${value ? "true" : "false"}`;
  if (typeof value === "number") return Number.isFinite(value) ? `number:${String(value)}` : undefined;
  if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || typeof value.decimal !== "string") return undefined;
  const identity = scalarIdentity(value, {value: "decimal", nullable: false});
  return identity.ok ? `decimal:${identity.value}` : undefined;
}

export function stableDataRecordKey(record: AeliqoDataRecord, identity: readonly string[]): string | undefined {
  if (identity.length === 0) return undefined;
  const keys = identity.map((field) => stableDataValueKey(record[field]));
  if (keys.some((key) => key === undefined)) return undefined;
  return keys.length === 1 ? keys[0] : JSON.stringify(keys);
}

export function dataValueText(value: AeliqoDataValue | undefined, missing = "—"): string {
  if (value === undefined || value === null) return missing;
  if (typeof value === "object" && !Array.isArray(value) && typeof value.decimal === "string") return value.decimal;
  return String(value);
}

export function dataStatusMessage(status: AeliqoDataStatus, message?: string): string | undefined {
  if (message !== undefined && message.length > 0) return message;
  switch (status) {
    case "loading": return "Loading…";
    case "empty": return "No data to display.";
    case "partial": return "Showing a partial result.";
    case "stale": return "This result may be out of date.";
    case "error": return "The data could not be loaded.";
    case "unavailable": return "Value unavailable.";
    case "ready": return undefined;
  }
}

export function scopeText(scope: AeliqoDataScope | undefined): string | undefined {
  if (scope === undefined) return undefined;
  const parts: string[] = [];
  if (scope.label) parts.push(scope.label);
  if (scope.kind === "sample") parts.push("Bounded sample");
  if (scope.kind === "unknown") parts.push("Scope unknown");
  const total = scope.filteredTotal ?? scope.populationTotal;
  const population = scope.filteredTotal === undefined ? "population" : "matching";
  if (scope.loaded !== undefined && total !== undefined)
    parts.push(`${scope.loaded.toLocaleString()} of ${total.toLocaleString()} ${population} records loaded`);
  else if (scope.loaded !== undefined) parts.push(`${scope.loaded.toLocaleString()} loaded records`);
  else if (total !== undefined) parts.push(`${total.toLocaleString()} ${population} records`);
  return parts.length === 0 ? undefined : parts.join("; ");
}

export function statusTemplate(status: AeliqoDataStatus, message?: string): TemplateResult | typeof nothing {
  const text = dataStatusMessage(status, message);
  if (text === undefined) return nothing;
  const kind = status === "error" || status === "unavailable" ? "error" : status;
  return html`<p part="status" class=${kind} role=${status === "loading" ? "status" : "alert"}>${text}</p>`;
}

export const dataStyles = css`
  :host {
    box-sizing: border-box;
    color: var(--aeliqo-color-text, #18202a);
    display: block;
    max-inline-size: 100%;
  }
  :host, :host * { box-sizing: border-box; }
  [part="status"] { margin: 0; padding: var(--aeliqo-space-8, 0.5rem) 0; }
  [part="status"].error { color: var(--aeliqo-color-danger, #b91c1c); }
  [part="status"].partial, [part="status"].stale { color: var(--aeliqo-color-warning, #854d0e); }
  :is(button, input, select):focus-visible {
    outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-color-focus, #4338ca);
    outline-offset: var(--aeliqo-focus-offset, 0.125rem);
  }
  @media (forced-colors: active) {
    :is(button, input, select):focus-visible { outline: 2px solid Highlight; }
  }
`;

export function safeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
