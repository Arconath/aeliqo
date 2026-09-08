import {aeliqoThemeStyles} from "../styles/theme.js";
import {css, html, LitElement, nothing} from "lit";
import {AeliqoTableSelectionEvent} from "../events.js";
import {scalarIdentity} from "@aeliqo/core";
import type {ResultRef} from "@aeliqo/core";
import type {AeliqoTableColumn, AeliqoTableRow, AeliqoTableSelectionMode, TableCell} from "../types.js";

/**
 * Encode a row identity for a semantic selection payload. Values are tagged
 * so text, null, numeric and boolean identities cannot collide; compound
 * identities are bounded JSON tuples. Render position is never part of key.
 */
function stableTableCellKey(value: TableCell): string | undefined {
  if (value === null) return "null:";
  if (typeof value === "string") return `string:${value.length}:${value}`;
  if (typeof value === "boolean") return `boolean:${value ? "true" : "false"}`;
  if (typeof value === "number") return Number.isFinite(value) ? `number:${String(value)}` : undefined;
  if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || typeof value.decimal !== "string") return undefined;
  const identity = scalarIdentity(value, {value: "decimal", nullable: false});
  return identity.ok ? `decimal:${identity.value}` : undefined;
}

export function stableTableRowKey(row: AeliqoTableRow, identity: readonly string[]): string | undefined {
  if (identity.length === 0) return undefined;
  const values = identity.map((field) => row[field]);
  if (values.some((value) => value === undefined)) return undefined;
  const encoded = values.map((value) => value === undefined ? undefined : stableTableCellKey(value));
  if (encoded.some((value) => value === undefined)) return undefined;
  if (encoded.length === 1) return encoded[0];
  return JSON.stringify(encoded);
}

function tableIdentityLabel(row: AeliqoTableRow, identity: readonly string[]): string {
  const values = identity.map((field) => row[field]).filter((value): value is TableCell => value !== undefined);
  return values.map((value) => {
    if (value === null) return "—";
    if (typeof value === "object" && !Array.isArray(value) && typeof value.decimal === "string") return value.decimal;
    return String(value);
  }).join(" · ") || "row";
}

export class AeliqoTableElement extends LitElement {
  static readonly properties = {
    columns: {attribute: false},
    rows: {attribute: false},
    caption: {type: String},
    emptyLabel: {attribute: "empty-label", type: String},
    entity: {type: String},
    identity: {attribute: false},
    selection: {type: String},
    selectedKeys: {attribute: false},
    result: {attribute: false},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  columns: readonly AeliqoTableColumn[] = [];
  rows: readonly AeliqoTableRow[] = [];
  caption = "";
  emptyLabel = "No rows to display.";
  entity = "row";
  identity: readonly string[] = [];
  selection: AeliqoTableSelectionMode = "none";
  selectedKeys: readonly string[] = [];
  result: ResultRef | undefined = undefined;

  protected override render() {
    const selectable = this.selection !== "none";
    return html`
      <div part="scroll" tabindex="0">
        <table part="table">
          ${this.caption ? html`<caption>${this.caption}</caption>` : nothing}
          <thead>
            <tr>
              ${selectable ? html`<th scope="col" part="selection-heading"><span class="visually-hidden">Select</span></th>` : nothing}
              ${this.columns.map((column) => html`<th scope="col">${column.label}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${this.rows.length === 0 ? html`<tr><td colspan=${Math.max(this.columns.length + (selectable ? 1 : 0), 1)}>${this.emptyLabel}</td></tr>` :
              this.rows.map((row) => this.renderRow(row, selectable))}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderRow(row: AeliqoTableRow, selectable: boolean) {
    const key = stableTableRowKey(row, this.identity);
    const selected = key !== undefined && this.selectedKeys.includes(key);
    const label = key === undefined ? "Row cannot be selected" : `${selected ? "Deselect" : "Select"} ${this.entity} ${tableIdentityLabel(row, this.identity)}`;
    return html`
      <tr ?data-selected=${selected} aria-selected=${selectable ? String(selected) : nothing}>
        ${selectable ? html`
          <td part="selection-cell">
            <input
              type=${this.selection === "single" ? "radio" : "checkbox"}
              name=${this.selection === "single" ? "aeliqo-single-selection" : nothing}
              .checked=${selected}
              ?disabled=${key === undefined}
              aria-label=${label}
              @change=${(event: Event) => this.handleSelection(event, key)}
            />
          </td>` : nothing}
        ${this.columns.map((column) => html`<td>${this.formatCell(row[column.key])}</td>`)}
      </tr>
    `;
  }

  private readonly handleSelection = (event: Event, key: string | undefined): void => {
    if (key === undefined || !(event.target instanceof HTMLInputElement)) return;
    const next = new Set(this.selectedKeys);
    if (this.selection === "single") {
      next.clear();
      if (event.target.checked) next.add(key);
    } else if (event.target.checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    const keys = [...next];
    const detail = keys.length === 0
      ? {mode: "clear" as const, entity: this.entity, keys: []}
      : {mode: "ids" as const, entity: this.entity, keys, ...(this.result === undefined ? {} : {result: this.result})};
    this.dispatchEvent(new AeliqoTableSelectionEvent(detail));
  };

  private formatCell(value: TableCell | undefined): string {
    if (value === null || value === undefined) {
      return "—";
    }
    if (typeof value === "object" && Object.keys(value).length === 1 && typeof value.decimal === "string") {
      return value.decimal;
    }
    return String(value);
  }

  static readonly styles = [aeliqoThemeStyles, css`
    :host {
      color: var(--aeliqo-table-color, var(--aeliqo-color-text, #18202a));
      display: block;
      max-inline-size: 100%;
    }

    [part="scroll"] {
      overflow-x: auto;
    }

    .visually-hidden {
      block-size: 1px;
      clip-path: inset(50%);
      clip: rect(0 0 0 0);
      inline-size: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
    }

    [part="scroll"]:focus-visible {
      outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-table-focus, var(--aeliqo-color-focus, #0b63ce));
      outline-offset: var(--aeliqo-focus-offset, 0.1875rem);
    }

    table {
      border-collapse: collapse;
      min-inline-size: 100%;
    }

    caption {
      font-weight: var(--aeliqo-typography-font-weight-semibold, 600);
      padding-block: var(--aeliqo-space-8, 0.5rem);
      text-align: start;
    }

    th,
    td {
      border-block-end: var(--aeliqo-control-border-width, 1px) solid var(--aeliqo-table-rule, var(--aeliqo-color-border, #c9d0d8));
      padding: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-space-12, 0.75rem);
      text-align: start;
      vertical-align: top;
    }

    th {
      background: var(--aeliqo-table-heading-background, var(--aeliqo-color-surface, #eef2f5));
      font-weight: var(--aeliqo-typography-font-weight-semibold, 600);
    }
  `];
}
