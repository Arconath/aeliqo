import {renderNavigationFeedbackNode} from "./navigation-feedback-renderer.js";
import {renderInputNode} from "./input-renderer.js";
import {renderFoundationNode} from "./foundation-renderer.js";
import type {InteractionPayload, InteractionState, Result, ResultRef, ValidatedPresentation} from "@aeliqo/core";
import {css, html, LitElement, nothing, type TemplateResult} from "lit";
import {repeat} from "lit/directives/repeat.js";
import type {PropertyValues} from "lit";
import {aeliqoThemeStyles} from "../styles/theme.js";
import "../elements/aeliqo-table.js";
import "../elements/aeliqo-chart.js";
import "../elements/aeliqo-input.js";
import {stableTableRowKey} from "../elements/aeliqo-table.js";
import type {AeliqoChartSeries, AeliqoTableColumn, AeliqoTableRow} from "../types.js";
import type {AeliqoInputChangeDetail, AeliqoTableSelectionDetail} from "../types.js";
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

function resultRef(value: unknown): value is ResultRef {
  try {
    const candidate = record(value);
    return candidate !== undefined && typeof candidate.id === "string" && typeof candidate.revision === "string" &&
      typeof candidate.outputId === "string" && typeof candidate.queryDigest === "string" && typeof candidate.scopeDigest === "string";
  } catch {
    return false;
  }
}

function customDetail(event: Event): unknown {
  try {
    return typeof CustomEvent !== "undefined" && event instanceof CustomEvent ? event.detail : undefined;
  } catch {
    return undefined;
  }
}

function tableSelectionDetail(event: Event): AeliqoTableSelectionDetail | undefined {
  try {
    const candidate = record(customDetail(event));
    if (candidate === undefined || (candidate.mode !== "clear" && candidate.mode !== "ids") || typeof candidate.entity !== "string" || !Array.isArray(candidate.keys) || candidate.keys.some((key) => typeof key !== "string")) return undefined;
    const keys = candidate.keys as string[];
    if (candidate.mode === "clear" && keys.length !== 0) return undefined;
    if (candidate.mode === "ids" && keys.length === 0) return undefined;
    if (candidate.result !== undefined && !resultRef(candidate.result)) return undefined;
    return {
      mode: candidate.mode,
      entity: candidate.entity,
      keys,
      ...(candidate.result === undefined ? {} : {result: candidate.result}),
    };
  } catch {
    return undefined;
  }
}

function inputChangeDetail(event: Event): AeliqoInputChangeDetail | undefined {
  try {
    const candidate = record(customDetail(event));
    if (candidate === undefined || candidate.source !== "user" || typeof candidate.value !== "string") return undefined;
    return {source: "user", value: candidate.value};
  } catch {
    return undefined;
  }
}

function temporalTime(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function temporalLabel(value: unknown): string {
  if (typeof value === "string" && temporalTime(value) !== undefined) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  return "Invalid date";
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const decimal = record(value);
  if (decimal !== undefined && Object.keys(decimal).length === 1 && typeof decimal.decimal === "string") {
    const parsed = Number(decimal.decimal);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function decimalText(value: unknown): string | undefined {
  const decimal = record(value);
  return decimal !== undefined && Object.keys(decimal).length === 1 && typeof decimal.decimal === "string" ? decimal.decimal : undefined;
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
  private focusedNodeId: string | undefined;
  private focusedElement: HTMLElement | undefined;

  /** Clear committed content when the host revokes or disposes the region. */
  clear(): void {
    this.presentation = undefined;
    this.results = [];
    this.interaction = undefined;
  }

  revoke(): void { this.clear(); }
  dispose(): void { this.clear(); }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("presentation")) return;
    const active = this.shadowRoot?.activeElement;
    const elementConstructor = globalThis.HTMLElement;
    if (elementConstructor === undefined || !(active instanceof elementConstructor)) return;
    const nodeHost = active.closest<HTMLElement>("[data-aeliqo-node-id]");
    if (nodeHost === null) return;
    this.focusedNodeId = nodeHost.dataset.aeliqoNodeId;
    const nested = active.shadowRoot?.activeElement;
    this.focusedElement = nested instanceof HTMLElement ? nested : active;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has("presentation") || this.focusedNodeId === undefined) return;
    const focusedElement = this.focusedElement;
    const nodeId = this.focusedNodeId;
    this.focusedElement = undefined;
    this.focusedNodeId = undefined;
    if (focusedElement?.isConnected) {
      focusedElement.focus();
      return;
    }
    const target = [...(this.shadowRoot?.querySelectorAll<HTMLElement>("[data-aeliqo-node-id]") ?? [])]
      .find((candidate) => candidate.dataset.aeliqoNodeId === nodeId);
    target?.focus();
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.presentation === undefined) return nothing;
    const nodes = new Map(this.presentation.nodes.map((node) => [node.node.id, node]));
    if (!nodes.has(this.presentation.plan.rootId)) return nothing;
    return html`<div part="region" lang=${this.presentation.environment.locale} dir=${this.presentation.environment.direction}>${this.renderNode(this.presentation.plan.rootId, nodes)}</div>`;
  }

  private renderNode(nodeId: string, nodes: ReadonlyMap<string, ValidatedPresentation["nodes"][number]>): TemplateResult | typeof nothing {
    const resolved = nodes.get(nodeId);
    if (resolved === undefined) return nothing;
    const children = () => repeat(
      resolved.node.children,
      (childId) => childId,
      (childId) => this.renderNode(childId, nodes),
    );
    const values = valuesOf(resolved);
    switch (resolved.manifest.id) {
      case "layout.stack": {
        const gap = typeof values.gap === "number" && Number.isSafeInteger(values.gap) && values.gap >= 0 && values.gap <= 64
          ? `${values.gap}px`
          : "var(--aeliqo-space-24, 1.5rem)";
        return html`<div part="stack" data-aeliqo-role="stack" data-aeliqo-node-id=${resolved.node.id} style=${`gap:${gap}`}>${children()}</div>`;
      }
      case "data.table": return this.renderTable(resolved, values);
      case "data.trend": return this.renderTrend(resolved, values);
      case "control.filter": return this.renderFilter(resolved, values);
      default: return renderFoundationNode(resolved, childId => this.renderNode(childId, nodes), (node, portId, payload) => this.emitFoundation(node, portId, payload)) ?? renderInputNode(resolved, childId => this.renderNode(childId, nodes), (node, portId, payload) => this.emitFoundation(node, portId, payload), this.presentation?.environment.locale) ?? renderNavigationFeedbackNode(resolved, childId => this.renderNode(childId, nodes), (node, portId, payload) => this.emitFoundation(node, portId, payload)) ?? html`<div part="unsupported">Unsupported registered representation.</div>`;
    }
  }

  private emitFoundation(node: ValidatedPresentation["nodes"][number], portId: string, payload: InteractionPayload): void {
    if (!node.config.ports.some(port => port.id === portId && port.payload === payload.kind)) return;
    this.onSemanticInteraction?.({nodeId: node.node.id, portId, payload});
  }

  private renderTable(resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): TemplateResult {
    const bound = resultFor(resolved, this.results);
    const columns = this.configColumns(values, resultColumns(resolved, bound));
    const selection = values.selection === "single" || values.selection === "multiple" ? values.selection : "none";
    const nodeId = resolved.node.id;
    const selectedKeys = this.selectionKeys(nodeId);
    const result = resolved.result?.ref;
    const selectionPort = resolved.config.ports.find((candidate) => candidate.payload === "selection");
    const entity = selectionPort?.entity ?? "row";
    return html`<aeliqo-table
      data-aeliqo-node-id=${nodeId}
      data-aeliqo-theme="inherit"
      .columns=${columns}
      .rows=${bound?.rows ?? []}
      .caption=${text(values.caption)}
      .emptyLabel=${bound === undefined ? "Data unavailable." : "No rows to display."}
      .entity=${entity}
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
    const seriesBy = Array.isArray(values.seriesBy) ? values.seriesBy.flatMap((value) => typeof value === "string" ? [value] : []) : [];
    const rawSeries = Array.isArray(values.series) ? values.series : [];
    const rows = bound?.rows ?? [];
    const series: AeliqoChartSeries[] = rawSeries.flatMap((item) => {
      const candidate = record(item); if (candidate === undefined) return [];
      const field = text(candidate.field); if (field.length === 0) return [];
      const label = text(candidate.label, field);
      const unit = text(candidate.unit);
      const groups = new Map<string, {readonly values: readonly unknown[]; readonly rows: {readonly row: AeliqoTableRow; readonly index: number; readonly time: number}[]}>();
      rows.forEach((row, index) => {
        const values = seriesBy.map((groupField) => row[groupField]);
        const key = JSON.stringify(values);
        const group = groups.get(key);
        const time = temporalTime(row[labelField]);
        if (group === undefined) groups.set(key, {values, rows: [{row, index, time: time ?? Number.NaN}]});
        else group.rows.push({row, index, time: time ?? Number.NaN});
      });
      return [...groups.entries()].map(([groupKey, group]) => {
        const ordered = [...group.rows].sort((left, right) => Number.isNaN(left.time) || Number.isNaN(right.time) ? left.index - right.index : left.time - right.time || left.index - right.index);
        const suffix = group.values.length === 0 ? "" : ` · ${group.values.map((value) => value === null || value === undefined ? "—" : String(value)).join(" · ")}`;
        const points = ordered.map(({row, time}) => {
          const sourceValue = row[field];
          const value = Number.isNaN(time) ? Number.NaN : numericValue(sourceValue);
          const displayValue = decimalText(sourceValue);
          const sourceTime = row[labelField];
          return {
            label: temporalLabel(row[labelField]),
            // Keep the source instant text so the chart can retain canonical
            // sub-millisecond identity; Date.parse is only used for ordering.
            ...(Number.isNaN(time) ? {} : {x: typeof sourceTime === "string" ? sourceTime : time}),
            value,
            ...(displayValue === undefined ? {} : {displayValue}),
          };
        });
        return {id: `${field}:${groupKey}`, label: `${label}${suffix}`, ...(unit.length === 0 ? {} : {unit}), points};
      });
    });
    return html`<aeliqo-chart
      data-aeliqo-node-id=${resolved.node.id}
      data-aeliqo-theme="inherit"
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
      data-aeliqo-node-id=${resolved.node.id}
      data-aeliqo-theme="inherit"
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
    try {
      const detail = tableSelectionDetail(event);
      if (detail === undefined) return;
      const port = resolved.config.ports.find((candidate) => candidate.payload === "selection");
      if (port === undefined) return;
      if (detail.mode === "clear") {
        if (detail.entity !== port.entity) return;
        this.emit({nodeId: resolved.node.id, portId: port.id, payload: {kind: "selection", selection: {mode: "clear"}}});
        return;
      }
      if (detail.entity !== port.entity || detail.result === undefined || resolved.result === undefined || refKey(detail.result) !== refKey(resolved.result.ref) || detail.keys.length === 0) return;
      const bound = resultFor(resolved, this.results);
      if (bound === undefined) return;
      const allowed = new Set(bound.rows.map((row) => stableTableRowKey(row, port.identity ?? [])).filter((key): key is string => key !== undefined));
      if (new Set(detail.keys).size !== detail.keys.length || detail.keys.some((key) => !allowed.has(key))) return;
      this.emit({nodeId: resolved.node.id, portId: port.id, payload: {
        kind: "selection",
        selection: {mode: "ids", entity: detail.entity, keys: [...detail.keys] as [string, ...string[]], result: detail.result},
      }});
    } catch {
      // Custom events are an untrusted boundary; malformed details are ignored.
    }
  }

  private handleFilter(event: Event, resolved: ValidatedPresentation["nodes"][number], values: Record<string, unknown>): void {
    try {
      const detail = inputChangeDetail(event);
      if (detail === undefined) return;
      const field = text(values.field); const outputId = text(values.outputId);
      if (field.length === 0 || outputId.length === 0 || resolved.result === undefined || outputId !== resolved.result.ref.outputId || resolved.result.fields.find((candidate) => candidate.id === field)?.type.value !== "text" || resolved.config.ports.find((candidate) => candidate.payload === "filter") === undefined) return;
      const predicate = detail.value.length === 0 ? [] : [{op: "compare" as const, field, ...(values.entity === undefined ? {} : {entity: text(values.entity)}), comparison: "eq" as const, value: detail.value}];
      const payload: InteractionPayload = {kind: "filter", predicates: predicate, outputId};
      const port = resolved.config.ports.find((candidate) => candidate.payload === "filter");
      if (port !== undefined) this.emit({nodeId: resolved.node.id, portId: port.id, payload});
    } catch {
      // Custom events are an untrusted boundary; malformed details are ignored.
    }
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
