import type {InteractionPayload, InteractionState, Result, ResultRef, ValidatedPresentation} from "@aeliqo/core";
import {css, html, LitElement, nothing, type TemplateResult} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import {AeliqoInputEvent, AeliqoTableSelectionEvent} from "../events.js";
import "../elements/aeliqo-table.js";
import "../elements/aeliqo-chart.js";
import "../elements/aeliqo-input.js";
import type {AeliqoChartSeries, AeliqoTableColumn, AeliqoTableRow} from "../types.js";
import type {AeliqoRegionResult, AeliqoSemanticInteractionHandler, AeliqoSemanticInteractionRequest} from "./types.js";

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function resultFor(node: {readonly result: Result | undefined}, results: readonly AeliqoRegionResult[]): AeliqoRegionResult | undefined {
  if (node.result === undefined) return undefined;
  return results.find((candidate) => refKey(candidate.ref) === refKey(node.result!.ref));
}

function resultColumns(node: {readonly result: Result | undefined}, bound: AeliqoRegionResult | undefined): readonly AeliqoTableColumn[] {
  if (bound?.columns !== undefined) return bound.columns;
  return node.result?.fields.map((field) => ({key: field.id, label: field.label})) ?? [];
}

function valuesOf(node: {readonly config: {readonly values: Readonly<Record<string, unknown>>}}): Record<string, unknown> {
  return node.config.values as Record<string, unknown>;
}

/**
 * One controlled renderer for a validated presentation. It consumes only
 * host-resolved descriptors and bounded rows; query, authority and route
 * decisions remain outside this element.
 */
export class AeliqoRegionElement extends LitElement {
  static readonly properties = {
    presentation: {attribute: false},
    results: {attribute: false},
    interaction: {attribute: false},
    onSemanticInteraction: {attribute: false},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  presentation: ValidatedPresentation | undefined = undefined;
  results: readonly AeliqoRegionResult[] = [];
  interaction: InteractionState | undefined = undefined;
  onSemanticInteraction: AeliqoSemanticInteractionHandler | undefined = undefined;

  /** Clear committed content when the host revokes or disposes the region. */
  clear(): void {
    this.presentation = undefined;
    this.results = [];
    this.interaction = undefined;
  }

  revoke(): void { this.clear(); }
  dispose(): void { this.clear(); }

  protected override render(): TemplateResult | typeof nothing {
    if (this.presentation === undefined) return nothing;
    const nodes = new Map(this.presentation.nodes.map((node) => [node.node.id, node]));
    if (!nodes.has(this.presentation.plan.rootId)) return nothing;
    return html`<div part="region">${this.renderNode(this.presentation.plan.rootId, nodes)}</div>`;
  }

  private renderNode(nodeId: string, nodes: ReadonlyMap<string, ValidatedPresentation["nodes"][number]>): TemplateResult | typeof nothing {
    const resolved = nodes.get(nodeId);
    if (resolved === undefined) return nothing;
    const children = () => resolved.node.children.map((child) => this.renderNode(child, nodes));
    const values = valuesOf(resolved);
    switch (resolved.manifest.id) {
      case "layout.stack": {
        const gap = typeof values.gap === "number" && Number.isSafeInteger(values.gap) && values.gap >= 0 && values.gap <= 64 ? values.gap : 0;
        return html`<div part="stack" data-aeliqo-role="stack" style=${`gap:${gap}px`}>${children()}</div>`;
      }
      case "data.table": return this.renderTable(resolved, values);
      case "data.trend": return this.renderTrend(resolved, values);
      case "control.filter": return this.renderFilter(resolved, values);
      default: return html`<div part="unsupported">Unsupported registered representation.</div>`;
    }
  }

  private renderTable(resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): TemplateResult {
    const bound = resultFor(resolved, this.results);
    const columns = this.configColumns(values, resultColumns(resolved, bound));
    const selection = values.selection === "single" || values.selection === "multiple" ? values.selection : "none";
    const nodeId = resolved.node.id;
    const selectedKeys = this.selectionKeys(nodeId);
    const result = resolved.result?.ref;
    return html`<aeliqo-table
      .columns=${columns}
      .rows=${bound?.rows ?? []}
      .caption=${text(values.caption)}
      .emptyLabel=${bound === undefined ? "Data unavailable." : "No rows to display."}
      .entity=${text(values.entity, "row")}
      .identity=${resolved.result?.identity ?? []}
      .selection=${selection}
      .selectedKeys=${selectedKeys}
      .result=${result}
      @aeliqo-table-selection=${(event: Event) => this.handleTableSelection(event, resolved)}
    ></aeliqo-table>`;
  }

  private renderTrend(resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): TemplateResult {
    const bound = resultFor(resolved, this.results);
    const labelField = text(values.labelField);
    const rawSeries = Array.isArray(values.series) ? values.series : [];
    const series: AeliqoChartSeries[] = rawSeries.flatMap((item, index) => {
      const candidate = record(item); if (candidate === undefined) return [];
      const field = text(candidate.field); if (field.length === 0) return [];
      const label = text(candidate.label, field);
      const unit = text(candidate.unit);
      const points = (bound?.rows ?? []).map((row) => ({label: text(row[labelField], `Point ${index + 1}`), value: typeof row[field] === "number" ? row[field] as number : null}));
      return [{id: field, label, ...(unit.length === 0 ? {} : {unit}), points}];
    });
    return html`<aeliqo-chart
      .title=${text(values.title, "Trend")}
      .summary=${bound === undefined ? "Data unavailable." : ""}
      .scope=${text(values.scope)}
      .series=${series}
      .points=${series[0]?.points ?? []}
    ></aeliqo-chart>`;
  }

  private renderFilter(resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): TemplateResult {
    const field = text(values.field);
    const current = this.filterValue(resolved.node.id, field);
    return html`<aeliqo-input
      .label=${this.fieldLabel(resolved, field)}
      .hint=${text(values.placeholder)}
      .value=${current}
      @aeliqo-input=${(event: Event) => this.handleFilter(event, resolved, values)}
    ></aeliqo-input>`;
  }

  private fieldLabel(resolved: ValidatedPresentation["nodes"][number], field: string): string {
    return resolved.result?.fields.find((candidate) => candidate.id === field)?.label ?? field;
  }

  private configColumns(values: Record<string, unknown>, fallback: readonly AeliqoTableColumn[]): readonly AeliqoTableColumn[] {
    if (!Array.isArray(values.columns)) return fallback;
    return values.columns.flatMap((value) => {
      const candidate = record(value); if (candidate === undefined) return [];
      const key = text(candidate.key); const label = text(candidate.label, key);
      return key.length === 0 ? [] : [{key, label}];
    });
  }

  private selectionKeys(nodeId: string): readonly string[] {
    const entry = this.interaction?.values.find((candidate) => candidate.nodeId === nodeId && candidate.payload.kind === "selection");
    if (entry?.payload.kind !== "selection" || entry.payload.selection.mode !== "ids") return [];
    return entry.payload.selection.keys;
  }

  private filterValue(nodeId: string, field: string): string {
    const entry = this.interaction?.values.find((candidate) => candidate.nodeId === nodeId && candidate.payload.kind === "filter");
    if (entry?.payload.kind !== "filter") return "";
    const predicate = entry.payload.predicates.find((candidate) => candidate.op === "compare" && candidate.field === field && candidate.comparison === "eq");
    if (predicate?.op !== "compare") return "";
    return typeof predicate.value === "string" ? predicate.value : "";
  }

  private handleTableSelection(event: Event, resolved: ValidatedPresentation["nodes"][number]): void {
    const detail = (event as AeliqoTableSelectionEvent).detail;
    const port = resolved.config.ports.find((candidate) => candidate.payload === "selection");
    if (port === undefined) return;
    if (detail.mode === "clear") {
      this.emit({nodeId: resolved.node.id, portId: port.id, payload: {kind: "selection", selection: {mode: "clear"}}});
      return;
    }
    if (detail.result === undefined || detail.keys.length === 0) return;
    this.emit({nodeId: resolved.node.id, portId: port.id, payload: {
      kind: "selection",
      selection: {mode: "ids", entity: detail.entity, keys: [...detail.keys] as [string, ...string[]], result: detail.result},
    }});
  }

  private handleFilter(event: Event, resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): void {
    const detail = (event as AeliqoInputEvent).detail;
    const field = text(values.field); const outputId = text(values.outputId);
    if (field.length === 0 || outputId.length === 0 || resolved.config.ports.find((candidate) => candidate.payload === "filter") === undefined) return;
    const predicate = detail.value.length === 0 ? [] : [{op: "compare" as const, field, ...(values.entity === undefined ? {} : {entity: text(values.entity)}), comparison: "eq" as const, value: detail.value}];
    const payload: InteractionPayload = {kind: "filter", predicates: predicate, outputId};
    const port = resolved.config.ports.find((candidate) => candidate.payload === "filter");
    if (port !== undefined) this.emit({nodeId: resolved.node.id, portId: port.id, payload});
  }

  private emit(request: AeliqoSemanticInteractionRequest): void {
    this.onSemanticInteraction?.(request);
  }

  static readonly styles = [aeliqoThemeStyles, css`
    :host { color: var(--aeliqo-color-text, #18202a); display: block; }
    [part="region"] { display: block; min-inline-size: 0; }
    [part="stack"] { display: flex; flex-direction: column; min-inline-size: 0; }
    [part="unsupported"] { color: var(--aeliqo-color-muted, #495464); }
  `];
}
