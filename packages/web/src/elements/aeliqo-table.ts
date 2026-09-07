import {css, html, LitElement, nothing} from "lit";
import type {AeliqoTableColumn, AeliqoTableRow} from "../types.js";

export class AeliqoTableElement extends LitElement {
  static readonly properties = {
    columns: {attribute: false},
    rows: {attribute: false},
    caption: {type: String},
    emptyLabel: {attribute: "empty-label", type: String},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  columns: readonly AeliqoTableColumn[] = [];
  rows: readonly AeliqoTableRow[] = [];
  caption = "";
  emptyLabel = "No rows to display.";

  protected override render() {
    return html`
      <div part="scroll" tabindex="0">
        <table part="table">
          ${this.caption ? html`<caption>${this.caption}</caption>` : nothing}
          <thead>
            <tr>
              ${this.columns.map((column) => html`<th scope="col">${column.label}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${this.rows.length === 0
              ? html`<tr><td colspan=${Math.max(this.columns.length, 1)}>${this.emptyLabel}</td></tr>`
              : this.rows.map(
                  (row) => html`
                    <tr>
                      ${this.columns.map((column) => html`<td>${this.formatCell(row[column.key])}</td>`)}
                    </tr>
                  `,
                )}
          </tbody>
        </table>
      </div>
    `;
  }

  private formatCell(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) {
      return "—";
    }
    return String(value);
  }

  static readonly styles = css`
    :host {
      color: var(--aeliqo-table-color, #18202a);
      display: block;
      font: inherit;
      max-inline-size: 100%;
    }

    [part="scroll"] {
      overflow-x: auto;
    }

    [part="scroll"]:focus-visible {
      outline: 0.2rem solid var(--aeliqo-table-focus, #0b63ce);
      outline-offset: 0.15rem;
    }

    table {
      border-collapse: collapse;
      min-inline-size: 100%;
    }

    caption {
      font-weight: 600;
      padding-block: 0.45rem;
      text-align: start;
    }

    th,
    td {
      border-block-end: 1px solid var(--aeliqo-table-rule, #c9d0d8);
      padding: 0.55rem 0.7rem;
      text-align: start;
      vertical-align: top;
    }

    th {
      background: var(--aeliqo-table-heading-background, #eef2f5);
      font-weight: 650;
    }
  `;
}
