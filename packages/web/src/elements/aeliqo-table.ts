import {aeliqoThemeStyles} from "../styles/theme.js";
import {css, html, LitElement, nothing} from "lit";
import {AeliqoTableSelectionEvent} from "../events.js";
import {AeliqoTablePageEvent, AeliqoTableSortEvent} from "../data/events.js";
import {scalarIdentity} from "@aeliqo/core";
import type {ResultRef} from "@aeliqo/core";
import type {AeliqoDataScope, AeliqoDataStatus, AeliqoSortState} from "../data/types.js";
import type {AeliqoTableColumn, AeliqoTableRow, AeliqoTableSelectionMode, TableCell} from "../types.js";

/** Encode row identities without ever using a rendered row index. */
function stableTableCellKey(value: TableCell | undefined): string | undefined {
  if (value === undefined) return undefined;
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
  const encoded = identity.map((field) => stableTableCellKey(row[field]));
  if (encoded.some((value) => value === undefined)) return undefined;
  return encoded.length === 1 ? encoded[0] : JSON.stringify(encoded);
}

function tableIdentityLabel(row: AeliqoTableRow, identity: readonly string[]): string {
  const values = identity.map((field) => row[field]).filter((value): value is TableCell => value !== undefined);
  return values.map((value) => {
    if (value === null) return "—";
    if (typeof value === "object" && !Array.isArray(value) && typeof value.decimal === "string") return value.decimal;
    return String(value);
  }).join(" · ") || "row";
}

export type AeliqoTableMode = "table" | "grid";

/** Native table-first collection; grid mode is an explicit opt-in. */
export class AeliqoTableElement extends LitElement {
  static readonly properties = {
    columns: {attribute: false}, rows: {attribute: false}, caption: {type: String},
    emptyLabel: {attribute: "empty-label", type: String}, entity: {type: String},
    identity: {attribute: false}, selection: {type: String}, selectedKeys: {attribute: false},
    result: {attribute: false}, mode: {type: String}, sort: {attribute: false},
    page: {type: Number}, pageSize: {attribute: "page-size", type: Number},
    totalRows: {attribute: "total-rows", type: Number}, virtualized: {type: Boolean},
    virtualStart: {attribute: "virtual-start", type: Number}, virtualCount: {attribute: "virtual-count", type: Number},
    overscan: {type: Number}, scope: {attribute: false}, status: {type: String}, message: {type: String},
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
  mode: AeliqoTableMode = "table";
  sort: AeliqoSortState | undefined = undefined;
  page = 1;
  pageSize = 0;
  totalRows: number | undefined = undefined;
  virtualized = false;
  virtualStart = 0;
  virtualCount = 40;
  overscan = 4;
  scope: AeliqoDataScope | undefined = undefined;
  status: AeliqoDataStatus = "ready";
  message = "";

  protected override render() {
    const mode = this.mode === "grid" ? "grid" : "table";
    const selectable = this.selection !== "none";
    const status = this.rows.length === 0 && this.status === "ready" ? "empty" : this.status;
    const visible = this.visibleRows();
    const rowCount = this.totalRows ?? this.scope?.filteredTotal ?? this.scope?.populationTotal ?? this.rows.length;
    return html`
      <div part="scroll" tabindex=${mode === "grid" ? nothing : "0"}>
        ${mode === "table" ? html`
          <table part="table" data-virtualized=${this.virtualized ? "true" : "false"}>
            ${this.caption ? html`<caption>${this.caption}</caption>` : nothing}
            <thead><tr>
              ${selectable ? html`<th scope="col" part="selection-heading"><span class="visually-hidden">Select</span></th>` : nothing}
              ${this.columns.map((column) => this.renderHeader(column))}
            </tr></thead>
            <tbody>
              ${visible.length === 0 ? html`<tr><td colspan=${Math.max(this.columns.length + (selectable ? 1 : 0), 1)}>${status === "empty" ? this.emptyLabel : ""}</td></tr>` : visible.map((entry) => this.renderTableRow(entry.row, entry.index, selectable))}
            </tbody>
          </table>
      ` : this.renderGrid(visible, selectable, rowCount)}
      </div>
      ${this.renderScope(rowCount, visible.length)}
      ${status === "loading" || status === "partial" || status === "stale" || status === "error" || status === "unavailable" ? html`<p part="status" class=${status} role=${status === "loading" ? "status" : "alert"}>${this.message || this.statusMessage(status)}</p>` : nothing}
      ${this.renderPagination()}
    `;
  }

  private renderHeader(column: AeliqoTableColumn) {
    const sortable = column.sortable === true;
    const active = this.sort?.field === column.key;
    const indicator = active ? (this.sort?.direction === "asc" ? " ↑" : " ↓") : "";
    const ariaSort = active ? (this.sort?.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : nothing;
    return html`<th scope="col" part="heading" data-key=${column.key} aria-sort=${ariaSort} style=${column.align ? `text-align:${column.align}` : nothing}>
      ${sortable ? html`<button part="sort" type="button" aria-label=${`Sort by ${column.label}`} aria-pressed=${active ? "true" : "false"} @click=${() => this.requestSort(column)}>${column.label}${indicator}</button>` : html`${column.label}`}
    </th>`;
  }

  private renderTableRow(row: AeliqoTableRow, rowIndex: number, selectable: boolean) {
    const key = stableTableRowKey(row, this.identity);
    const selected = key !== undefined && this.selectedKeys.includes(key);
    return html`<tr data-row-index=${rowIndex} ?data-selected=${selected} aria-selected=${selectable ? String(selected) : nothing}>
      ${selectable ? this.renderSelectionCell(key, selected) : nothing}
      ${this.columns.map((column) => html`<td style=${column.align ? `text-align:${column.align}` : nothing}>${this.formatCell(row[column.key])}</td>`)}
    </tr>`;
  }

  private renderGrid(rows: readonly {readonly row: AeliqoTableRow; readonly index: number}[], selectable: boolean, rowCount: number | undefined) {
    const gridRowCount = rowCount === undefined ? undefined : rowCount + 1;
    const focus = this.gridFocus !== undefined && rows.some((entry) => entry.index === this.gridFocus?.row)
      ? this.gridFocus : {row: rows[0]?.index ?? 0, column: 0};
    return html`<div part="grid" role="grid" aria-label=${this.caption || "Data grid"} aria-rowcount=${gridRowCount === undefined ? nothing : String(gridRowCount)} aria-colcount=${String(this.columns.length + (selectable ? 1 : 0))}>
      <div role="rowgroup" part="grid-head"><div role="row" part="grid-row" aria-rowindex="1" style=${this.gridTemplate(selectable)}>
        ${selectable ? html`<div role="columnheader" aria-colindex="1" part="selection-heading"><span class="visually-hidden">Select</span></div>` : nothing}
        ${this.columns.map((column, index) => this.renderGridHeader(column, selectable ? index + 2 : index + 1))}
      </div></div>
      <div role="rowgroup" part="grid-body">
        ${rows.length === 0 ? html`<div role="row" aria-rowindex="2"><div role="gridcell" part="empty" aria-colspan=${Math.max(this.columns.length + (selectable ? 1 : 0), 1)}>${this.emptyLabel}</div></div>` : rows.map(({row, index}) => this.renderGridRow(row, index, selectable, focus))}
      </div>
    </div>`;
  }

  private renderGridRow(row: AeliqoTableRow, rowIndex: number, selectable: boolean, focus: {readonly row: number; readonly column: number}) {
    const key = stableTableRowKey(row, this.identity);
    const selected = key !== undefined && this.selectedKeys.includes(key);
    return html`<div role="row" part="grid-row" style=${this.gridTemplate(selectable)} data-row-index=${rowIndex} ?data-selected=${selected} aria-selected=${selectable ? String(selected) : nothing} aria-rowindex=${rowIndex + 2}>
      ${selectable ? this.renderGridCell(0, rowIndex, focus, this.renderSelectionCell(key, selected, true)) : nothing}
      ${this.columns.map((column, index) => this.renderGridCell(selectable ? index + 1 : index, rowIndex, focus, html`${this.formatCell(row[column.key])}`, column.align))}
    </div>`;
  }

  private renderGridCell(columnIndex: number, rowIndex: number, focus: {readonly row: number; readonly column: number}, content: unknown, align?: AeliqoTableColumn["align"]) {
    return html`<div role="gridcell" part="${columnIndex === 0 && this.selection !== "none" ? "selection-cell" : "cell"}" data-row-index=${rowIndex} data-col-index=${columnIndex} aria-colindex=${columnIndex + 1} tabindex=${focus.row === rowIndex && focus.column === columnIndex ? "0" : "-1"} style=${align ? `text-align:${align}` : nothing} @focus=${() => this.rememberGridFocus(rowIndex, columnIndex)} @keydown=${this.handleGridCellKeyDown}>${content}</div>`;
  }

  private renderGridHeader(column: AeliqoTableColumn, columnIndex: number) {
    const active = this.sort?.field === column.key;
    const indicator = active ? (this.sort?.direction === "asc" ? " ↑" : " ↓") : "";
    const ariaSort = active ? (this.sort?.direction === "asc" ? "ascending" : "descending") : column.sortable === true ? "none" : nothing;
    return html`<div role="columnheader" part="heading" data-key=${column.key} aria-colindex=${columnIndex} aria-sort=${ariaSort}>
      ${column.sortable === true ? html`<button part="sort" type="button" aria-label=${`Sort by ${column.label}`} aria-pressed=${active ? "true" : "false"} @click=${() => this.requestSort(column)}>${column.label}${indicator}</button>` : html`${column.label}`}
    </div>`;
  }

  private gridTemplate(selectable: boolean): string {
    const count = this.columns.length + (selectable ? 1 : 0);
    return `grid-template-columns: ${selectable ? "3.25rem " : ""}${"minmax(9rem, 1fr) ".repeat(Math.max(0, count - (selectable ? 1 : 0))).trim()}`;
  }

  private renderSelectionCell(key: string | undefined, selected: boolean, grid = false) {
    const action = selected && this.selection !== "single" ? "Deselect" : "Select";
    const label = key === undefined ? "Row cannot be selected" : `${action} ${this.entity} ${this.selectionLabelForKey(key)}`;
    const cell = html`<input type=${this.selection === "single" ? "radio" : "checkbox"} name=${this.selection === "single" ? "aeliqo-single-selection" : nothing} .checked=${selected} ?disabled=${key === undefined} aria-label=${label} @change=${(event: Event) => this.handleSelection(event, key)} />`;
    return grid ? cell : html`<td part="selection-cell">${cell}</td>`;
  }

  private selectionLabelForKey(key: string): string {
    const row = this.rows.find((candidate) => stableTableRowKey(candidate, this.identity) === key);
    return row === undefined ? key : tableIdentityLabel(row, this.identity);
  }

  private visibleRows(): readonly {readonly row: AeliqoTableRow; readonly index: number}[] {
    if (!this.virtualized) return this.rows.map((row, index) => ({row, index}));
    const start = Math.max(0, Math.trunc(this.virtualStart));
    const count = Math.max(1, Math.trunc(this.virtualCount));
    const overscan = Math.max(0, Math.trunc(this.overscan));
    const from = Math.max(0, start - overscan);
    const to = Math.min(this.rows.length, start + count + overscan);
    return this.rows.slice(from, to).map((row, index) => ({row, index: from + index}));
  }

  private renderScope(rowCount: number | undefined, renderedCount: number) {
    const loaded = this.scope?.loaded ?? this.rows.length;
    const total = this.totalRows ?? this.scope?.filteredTotal ?? this.scope?.populationTotal ?? rowCount;
    if (this.virtualized && renderedCount !== loaded) {
      const totalText = total !== undefined && total !== loaded ? `; ${total.toLocaleString()} matching ${this.entity}s` : "";
      return html`<p part="scope">Showing ${renderedCount.toLocaleString()} rendered of ${loaded.toLocaleString()} loaded ${this.entity}s${totalText}.</p>`;
    }
    if (total !== undefined && total !== loaded) return html`<p part="scope">Showing ${loaded.toLocaleString()} of ${total.toLocaleString()} ${this.entity}s.</p>`;
    const text = this.scope?.label ?? (this.scope?.kind === "sample" ? "Bounded sample" : this.scope?.kind === "unknown" ? "Scope unknown" : undefined);
    if (text) return html`<p part="scope">${text}</p>`;
    return nothing;
  }

  private renderPagination() {
    if (this.pageSize <= 0 || this.totalRows === undefined || this.totalRows <= this.pageSize) return nothing;
    const pages = Math.max(1, Math.ceil(this.totalRows / this.pageSize));
    return html`<nav part="pagination" aria-label="Pages">
      <button type="button" part="previous" ?disabled=${this.page <= 1} @click=${() => this.requestPage(this.page - 1)}>Previous</button>
      <span part="page-status">Page ${this.page} of ${pages}</span>
      <button type="button" part="next" ?disabled=${this.page >= pages} @click=${() => this.requestPage(this.page + 1)}>Next</button>
    </nav>`;
  }

  private readonly requestSort = (column: AeliqoTableColumn): void => {
    if (column.sortable !== true) return;
    let sort: AeliqoSortState | undefined;
    if (this.sort?.field !== column.key) sort = {field: column.key, direction: "asc"};
    else if (this.sort.direction === "asc") sort = {field: column.key, direction: "desc"};
    this.dispatchEvent(new AeliqoTableSortEvent({sort}));
  };

  private readonly requestPage = (page: number): void => {
    const pages = this.totalRows === undefined || this.pageSize <= 0 ? page : Math.max(1, Math.ceil(this.totalRows / this.pageSize));
    const next = Math.min(pages, Math.max(1, Math.trunc(page)));
    this.dispatchEvent(new AeliqoTablePageEvent({page: next, pageSize: this.pageSize, ...(this.result === undefined ? {} : {result: this.result})}));
  };

  private readonly handleSelection = (event: Event, key: string | undefined): void => {
    if (key === undefined || !(event.target instanceof HTMLInputElement)) return;
    const next = new Set(this.selectedKeys);
    if (this.selection === "single") { next.clear(); if (event.target.checked) next.add(key); }
    else if (event.target.checked) next.add(key);
    else next.delete(key);
    const keys = [...next];
    const detail = keys.length === 0
      ? {mode: "clear" as const, entity: this.entity, keys: [] as readonly string[]}
      : {mode: "ids" as const, entity: this.entity, keys, ...(this.result === undefined ? {} : {result: this.result})};
    this.dispatchEvent(new AeliqoTableSelectionEvent(detail));
  };

  private gridFocus: {readonly row: number; readonly column: number} | undefined;

  private rememberGridFocus(row: number, column: number): void {
    this.gridFocus = {row, column};
  }

  private readonly handleGridCellKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    const cell = event.currentTarget;
    if (!(cell instanceof HTMLElement)) return;
    const row = Number(cell.dataset.rowIndex);
    const column = Number(cell.dataset.colIndex);
    const cells = [...(this.shadowRoot?.querySelectorAll<HTMLElement>("[role='gridcell'][data-row-index]") ?? [])];
    const rows = [...new Set(cells.map((entry) => Number(entry.dataset.rowIndex)))].sort((left, right) => left - right);
    const columns = this.columns.length + (this.selection === "none" ? 0 : 1);
    const rowPosition = rows.indexOf(row);
    if (rowPosition < 0 || columns < 1) return;
    let nextRow = row;
    let nextColumn = column;
    if (event.key === "ArrowRight") nextColumn < columns - 1 ? nextColumn++ : (nextRow = rows[Math.min(rows.length - 1, rowPosition + 1)]!, nextColumn = 0);
    else if (event.key === "ArrowLeft") nextColumn > 0 ? nextColumn-- : (nextRow = rows[Math.max(0, rowPosition - 1)]!, nextColumn = columns - 1);
    else if (event.key === "ArrowDown") nextRow = rows[Math.min(rows.length - 1, rowPosition + 1)]!;
    else if (event.key === "ArrowUp") nextRow = rows[Math.max(0, rowPosition - 1)]!;
    else if (event.key === "Home" && event.ctrlKey) {nextRow = rows[0]!; nextColumn = 0;}
    else if (event.key === "End" && event.ctrlKey) {nextRow = rows.at(-1)!; nextColumn = columns - 1;}
    else if (event.key === "Home") nextColumn = 0;
    else if (event.key === "End") nextColumn = columns - 1;
    else if (event.key === "PageDown") nextRow = rows[Math.min(rows.length - 1, rowPosition + Math.max(1, this.virtualCount))]!;
    else if (event.key === "PageUp") nextRow = rows[Math.max(0, rowPosition - Math.max(1, this.virtualCount))]!;
    else return;
    const target = this.shadowRoot?.querySelector<HTMLElement>(`[role='gridcell'][data-row-index="${nextRow}"][data-col-index="${nextColumn}"]`);
    if (target === undefined || target === null) return;
    this.gridFocus = {row: nextRow, column: nextColumn};
    target.focus();
    event.preventDefault();
  };

  private formatCell(value: TableCell | undefined): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object" && Object.keys(value).length === 1 && typeof value.decimal === "string") return value.decimal;
    return String(value);
  }

  private statusMessage(status: AeliqoDataStatus): string {
    if (this.message) return this.message;
    if (status === "loading") return "Loading…";
    if (status === "partial") return "Showing a partial result.";
    if (status === "stale") return "This result may be out of date.";
    if (status === "error") return "The data could not be loaded.";
    return "Value unavailable.";
  }

  static readonly styles = [aeliqoThemeStyles, css`
    :host { color: var(--aeliqo-table-color, var(--aeliqo-color-text, #18202a)); display: block; max-inline-size: 100%; }
    :host, :host * { box-sizing: border-box; }
    [part="scroll"] { max-inline-size: 100%; overflow-x: auto; }
    .visually-hidden { block-size: 1px; clip-path: inset(50%); clip: rect(0 0 0 0); inline-size: 1px; overflow: hidden; position: absolute; white-space: nowrap; }
    [part="scroll"]:focus-visible, [part="cell"]:focus-visible, [part="selection-cell"]:focus-visible, [part="grid-row"]:focus-visible, :is(button, input):focus-visible { outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-table-focus, var(--aeliqo-color-focus, #0b63ce)); outline-offset: var(--aeliqo-focus-offset, 0.1875rem); }
    table { border-collapse: collapse; min-inline-size: 100%; }
    caption { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); padding-block: var(--aeliqo-space-8, 0.5rem); text-align: start; }
    th, td { border-block-end: var(--aeliqo-control-border-width, 1px) solid var(--aeliqo-table-rule, var(--aeliqo-color-border, #c9d0d8)); padding: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-space-12, 0.75rem); text-align: start; vertical-align: top; }
    th { background: var(--aeliqo-table-heading-background, var(--aeliqo-color-surface, #eef2f5)); font-weight: var(--aeliqo-typography-font-weight-semibold, 600); }
    th [part="sort"], [part="grid-row"] [part="sort"] { background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; inline-size: 100%; min-block-size: var(--aeliqo-control-compact-target, 2rem); padding: 0; text-align: inherit; }
    tr[data-selected="true"] td, [part="grid-row"][data-selected="true"] { background: color-mix(in srgb, var(--aeliqo-color-accent, #4338ca) 9%, transparent); }
    [part="grid"] { min-inline-size: max-content; }
    [part="grid-row"] { align-items: stretch; display: grid; }
    [part="grid-head"] [part="grid-row"] { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); }
    [part="grid-row"] [part="heading"], [part="grid-row"] [part="cell"], [part="grid-row"] [part="selection-cell"], [part="grid-head"] [part="grid-row"] > * { border-block-end: var(--aeliqo-control-border-width, 1px) solid var(--aeliqo-table-rule, var(--aeliqo-color-border, #c9d0d8)); min-inline-size: 9rem; padding: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-space-12, 0.75rem); }
    [part="grid-head"] [part="grid-row"] > * { background: var(--aeliqo-table-heading-background, var(--aeliqo-color-surface, #eef2f5)); }
    [part="grid-row"] [part="selection-cell"], [part="grid-head"] [part="grid-row"] > [part="selection-heading"] { min-inline-size: 3.25rem; }
    [part="scope"], [part="status"] { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, 0.8125rem); margin: var(--aeliqo-space-8, 0.5rem) 0 0; }
    [part="status"].error, [part="status"].unavailable { color: var(--aeliqo-color-danger, #b91c1c); }
    [part="status"].partial, [part="status"].stale { color: var(--aeliqo-color-warning, #854d0e); }
    [part="pagination"] { align-items: center; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, 0.5rem); margin-block-start: var(--aeliqo-space-12, 0.75rem); }
    [part="pagination"] button { background: var(--aeliqo-color-surface, #fff); border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #94a3b8); border-radius: var(--aeliqo-radius-small, 0.375rem); color: inherit; cursor: pointer; font: inherit; min-block-size: var(--aeliqo-control-compact-target, 2rem); padding-inline: var(--aeliqo-space-8, 0.5rem); }
    [part="pagination"] button:disabled { color: var(--aeliqo-color-muted, #64748b); cursor: not-allowed; }
    @media (forced-colors: active) { th, td, [part="grid-row"] > *, [part="pagination"] button { border-color: ButtonText; } tr[data-selected="true"] td, [part="grid-row"][data-selected="true"] { background: Highlight; color: HighlightText; } }
  `];
}
