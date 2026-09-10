import {css, html, nothing, svg, unsafeCSS} from "lit";
import {repeat} from "lit/directives/repeat.js";
import type {Diagnostic, Result, ResultRef, Scalar, VisualizationSpec, BoundVisualization} from "@aeliqo/sdk-core";
import {bindVisualizationSpec} from "@aeliqo/sdk-core";
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from "../../foundation/base.js";
import {compilePlotComposition} from "../../plot/composition.js";
import type {CompiledPlot, CompiledPlotNode, PlotDataset} from "../../plot/composition.js";
import type {PlotGeometry} from "../../plot/geometry.js";
import {QUANTITATIVE_COLOR_END, QUANTITATIVE_COLOR_START} from "../../plot/palette.js";
import {exactLabel} from "../../plot/scales.js";
import {seriesColor, svgPlotMarks} from "../../plot/render.js";
import {materializeVisualizationRows} from "../materialization.js";
import type {AeliqoVisualizationSelectionDetail, VisualizationDataset, VisualizationInputs} from "../types.js";

export type CartesianView = Extract<VisualizationSpec["view"], "trend" | "bar" | "area" | "scatter" | "histogram" | "heatmap">;

type CartesianState =
  | {readonly kind: "empty"}
  | {readonly kind: "error"; readonly diagnostics: readonly Diagnostic[]}
  | {readonly kind: "ready"; readonly bound: BoundVisualization; readonly compiled: CompiledPlot};

const fail = (code: string, message: string): {readonly ok: false; readonly diagnostics: readonly Diagnostic[]} => ({
  ok: false,
  diagnostics: [{code: `visualization.${code}`, message, retryable: false}],
});

const resultKey = (ref: ResultRef): string => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
const message = (diagnostics: readonly Diagnostic[]): string => diagnostics[0]?.message ?? "The visualization is unavailable.";
const inputChanged = (changed: Map<string, unknown>): boolean => ["visualization", "context", "datasets", "label", "width", "height", "maxMarks"].some((key) => changed.has(key));

/**
 * Shared family surface for the six Cartesian views. It owns no query/runtime
 * state: the host supplies a bound visualization and exact current rows.
 */
export abstract class AeliqoCartesianElement extends AeliqoFoundationElement {
  static readonly aeliqoVersion = "0.1.0";
  // This surface has several independent focus targets. Delegating a pointer
  // press to its first viewport can scroll a data button away before mouseup.
  static override readonly shadowRootOptions: ShadowRootInit = {mode: "open", delegatesFocus: false};
  static readonly properties = {
    visualization: {attribute: false},
    context: {attribute: false},
    datasets: {attribute: false},
    label: {type: String},
    width: {type: Number},
    height: {type: Number},
    maxMarks: {type: Number, attribute: "max-marks"},
    selectionEnabled: {type:Boolean,attribute:false},
    selectedIdentity: {type: String, attribute: "selected-identity"},
    selectedResult: {attribute: false},
  };

  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { color: var(--aeliqo-color-text, #111827); display: block; max-inline-size: 100%; min-inline-size: 0; }
    figure { margin: 0; }
    figcaption { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); margin-block-end: var(--aeliqo-space-8, .5rem); }
    [part="scope"], [part="note"], [part="error"], [part="color-key"] { color: var(--aeliqo-color-muted, #475569); font-size: var(--aeliqo-typography-font-size-caption, .8125rem); overflow-wrap: anywhere; unicode-bidi: plaintext; }
    [part="viewport"] { direction: ltr; max-inline-size: 100%; min-inline-size: 0; overflow: auto; position: relative; }
    [part="viewport"] svg { background: var(--aeliqo-color-canvas, #fff); block-size: auto; display: block; max-inline-size: 100%; }
    [part="viewport"] svg text { fill: currentColor; font: 11px system-ui, sans-serif; }
    [part="data"] { max-inline-size: 100%; min-inline-size: 0; overflow: auto; }
    table { border-collapse: collapse; inline-size: 100%; margin-block-start: var(--aeliqo-space-12, .75rem); min-inline-size: 28rem; }
    caption, th, td { overflow-wrap: anywhere; unicode-bidi: plaintext; }
    th, td { border-block-end: 1px solid var(--aeliqo-color-border, #64748b); padding: var(--aeliqo-space-8, .5rem); text-align: start; }
    th { font-weight: var(--aeliqo-typography-font-weight-semibold, 600); }
    button { min-block-size: var(--aeliqo-control-min-target, 2.75rem); min-inline-size: var(--aeliqo-control-min-target, 2.75rem); }
    button:focus-visible { outline: var(--aeliqo-focus-width, 3px) solid var(--aeliqo-color-focus, #4338ca); outline-offset: var(--aeliqo-focus-offset, 2px); }
    [part="legend"], [part="color-key-ticks"] { display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, .5rem) var(--aeliqo-space-16, 1rem); list-style: none; margin: var(--aeliqo-space-8, .5rem) 0 0; padding: 0; }
    [part="legend"] li { align-items: center; display: inline-flex; gap: var(--aeliqo-space-4, .25rem); }
    [part="legend-marker"] { block-size: .75rem; inline-size: .75rem; }
    [part="warnings"] { color: var(--aeliqo-color-warning, #92400e); margin: var(--aeliqo-space-8, .5rem) 0 0; padding-inline-start: 1.25rem; }
    [part="color-key-bar"] { background: linear-gradient(to right, ${unsafeCSS(QUANTITATIVE_COLOR_START)}, ${unsafeCSS(QUANTITATIVE_COLOR_END)}); block-size: .75rem; inline-size: min(24rem, 100%); }
    [part="pagination"] { align-items: center; display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-8, .5rem); margin-block-start: var(--aeliqo-space-8, .5rem); }
    [part="facet"], [part="concat-inline"], [part="concat-block"] { display: flex; flex-wrap: wrap; gap: var(--aeliqo-space-16, 1rem); }
    [part="concat-inline"] { overflow-inline: auto; flex-wrap: nowrap; }
    [part="layer"] { display: grid; overflow: auto; }
    [part="layer"] > div { grid-area: 1 / 1; }
    @media (max-width: 30rem) {
      [part="viewport"] svg { inline-size: 100%; }
      [part="viewport"] svg text { font-size: calc(.5rem + 12px); }
      [part="data"] { overflow: visible; }
      table { display: block; inline-size: 100%; min-inline-size: 0; }
      caption { display: block; margin-block: var(--aeliqo-space-12, .75rem); text-align: start; }
      thead { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; overflow: hidden; position: absolute; white-space: nowrap; }
      tbody { display: grid; gap: var(--aeliqo-space-12, .75rem); }
      tr { border-block-end: 1px solid var(--aeliqo-color-border, #64748b); display: block; padding-block: var(--aeliqo-space-4, .25rem); }
      td { border: 0; display: grid; gap: var(--aeliqo-space-8, .5rem); grid-template-columns: minmax(4.75rem, .7fr) minmax(0, 1.3fr); padding: var(--aeliqo-space-4, .25rem); }
      td::before { content: attr(data-label); font-weight: var(--aeliqo-typography-font-weight-semibold, 600); overflow-wrap: anywhere; }
      td > button { justify-self: start; }
    }
    @media (forced-colors: active) { [part="viewport"] svg path, [part="viewport"] svg circle, [part="viewport"] svg rect { stroke: CanvasText; fill: CanvasText; } }
  `];

  visualization: VisualizationSpec | undefined = undefined;
  context: VisualizationInputs["context"] = {results: []};
  datasets: readonly VisualizationDataset[] = [];
  label = "Data visualization";
  width = 640;
  height = 320;
  maxMarks = 20_000;
  selectionEnabled=true;
  selectedIdentity = "";
  selectedResult: ResultRef | undefined;

  private state: CartesianState = {kind: "empty"};
  private page = 0;
  private singleResult = true;
  private focusedIdentity: string | undefined;
  private focusedResult: string | undefined;
  private focusedElement: HTMLElement | undefined;

  protected abstract readonly expectedView: CartesianView;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (!inputChanged(changed)) return;
    const active = this.shadowRoot?.activeElement;
    const elementConstructor = globalThis.HTMLElement;
    if (elementConstructor !== undefined && active instanceof elementConstructor) {
      const button = active.closest<HTMLButtonElement>("button[data-aeliqo-row-identity]");
      if (button !== null && button.dataset.aeliqoRowIdentity !== undefined && button.dataset.aeliqoResult !== undefined) {
        this.focusedIdentity = button.dataset.aeliqoRowIdentity;
        this.focusedResult = button.dataset.aeliqoResult;
        this.focusedElement = button;
      }
    }
    this.page = 0;
    this.state = {kind: "empty"};
    if (this.visualization === undefined) {
      this.clearSelection();
      return;
    }
    const bound = bindVisualizationSpec(this.visualization, this.context);
    if (!bound.ok) {
      this.state = {kind: "error", diagnostics: bound.diagnostics};
      this.clearSelection();
      return;
    }
    if (bound.value.spec.view !== this.expectedView || !("plot" in bound.value.spec)) {
      this.state = {kind: "error", diagnostics: fail("view", `This surface only accepts the ${this.expectedView} visualization family.`).diagnostics};
      this.clearSelection();
      return;
    }
    const datasets: PlotDataset[] = [];
    for (const result of bound.value.results) {
      const materialized = materializeVisualizationRows(bound.value, result.ref, this.datasets);
      if (!materialized.ok) {
        this.state = {kind: "error", diagnostics: materialized.diagnostics};
        this.clearSelection();
        return;
      }
      datasets.push({result: result.ref, rows: materialized.value.map((row) => row.values)});
    }
    const compiled = compilePlotComposition(bound.value.spec.plot, bound.value.results, datasets, {
      width: this.width,
      height: this.height,
      maxRows: 10_000,
      maxMarks: this.maxMarks,
      family: this.expectedView,
      ...(bound.value.spec.view === "area" ? {stack: bound.value.spec.stack} : {}),
    });
    if (!compiled.ok) {
      this.state = {kind: "error", diagnostics: compiled.diagnostics};
      this.clearSelection();
      return;
    }
    this.state = {kind: "ready", bound: bound.value, compiled: compiled.value};
    this.retainSelection(compiled.value);
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (!inputChanged(changed) || this.focusedIdentity === undefined || this.focusedResult === undefined) return;
    const identity = this.focusedIdentity;
    const result = this.focusedResult;
    const focusedElement = this.focusedElement;
    this.focusedIdentity = undefined;
    this.focusedResult = undefined;
    this.focusedElement = undefined;
    if (focusedElement?.isConnected) {
      focusedElement.focus();
      return;
    }
    const target = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button[data-aeliqo-row-identity]") ?? [])]
      .find((candidate) => candidate.dataset.aeliqoRowIdentity === identity && candidate.dataset.aeliqoResult === result);
    target?.focus();
  }

  protected override render() {
    if (this.state.kind === "empty") return html`<p role="status">No ${this.expectedView} visualization is available.</p>`;
    if (this.state.kind === "error") return html`<p part="error" role="status">${message(this.state.diagnostics)}</p>`;
    return this.renderNode(this.state.compiled.root, this.label);
  }

  private renderNode(node: CompiledPlotNode, label: string, graphic = true, data = true): unknown {
    if (node.kind === "unit") return this.renderGeometry(node.geometry, label, graphic, data, node.displayedIdentities);
    if (node.kind === "facet") return html`<section part="facet" aria-label=${label}>${node.children.map((child) => html`<section aria-label=${`${node.field}: ${child.label}`}>
      ${data ? html`<h3>${node.field}: ${child.label}</h3>` : nothing}${this.renderNode(child.node, `${label}, ${node.field}: ${child.label}`, graphic, data)}
    </section>`)}</section>`;
    if (node.kind === "concat") return html`<section part=${`concat-${node.direction}`} aria-label=${label}>${node.children.map((child, index) => this.renderNode(child, `${label}, panel ${index + 1}`, graphic, data))}</section>`;
    return html`<section aria-label=${label}>${data ? html`<h3>${label}</h3>` : nothing}<div part="layer">${node.children.map((child, index) => html`<div>${this.renderNode(child, `${label}, layer ${index + 1}`, true, false)}</div>`)}</div>${data ? node.children.map((child, index) => this.renderNode(child, `${label}, layer ${index + 1}`, false, true)) : nothing}</section>`;
  }

  private renderGeometry(geometry: PlotGeometry, label: string, graphic: boolean, data: boolean, displayedIdentities?: readonly string[]): unknown {
    const displayedSet = displayedIdentities === undefined ? undefined : new Set(displayedIdentities);
    const displayed = displayedSet === undefined ? geometry.rows : geometry.rows.filter((row) => displayedSet.has(row.identity));
    const pageCount = Math.max(1, Math.ceil(displayed.length / 25));
    const page = Math.min(this.page, pageCount - 1);
    const pageRows = displayed.slice(page * 25, page * 25 + 25);
    const axes = geometry.axes;
    const abbreviatedTicks = axes !== undefined && [...axes.x.ticks, ...axes.y.ticks].some((tick) => tick.label.length > 12);
    const scope = this.scopeText(geometry.result);
    const valueLabel = geometry.result.precision.kind === "exact" ? "Exact loaded values" : "Loaded approximate values";
    const histogramMeasure = this.expectedView === "histogram" && this.state.kind === "ready" && this.state.bound.spec.view === "histogram" ? this.state.bound.spec.bins.measure : undefined;
    const tableLabel = histogramMeasure === undefined ? valueLabel : `${valueLabel}; executor-produced ${histogramMeasure} bins`;
    const axisLeft = geometry.axisLeft ?? 64;
    return html`<figure part="figure">
      ${data ? html`<figcaption>${label}</figcaption><p part="scope">${scope} ${geometry.rows.length} loaded rows.${displayed.length !== geometry.rows.length ? ` ${displayed.length} rows in this display partition.` : nothing}</p>` : nothing}
      ${geometry.result.period && data ? html`<p part="note">${geometry.result.period.interpretation} (${geometry.result.period.timezone}).</p>` : nothing}
      ${geometry.result.filters.length > 0 && data ? html`<p part="note">Filtered result (${geometry.result.filters.length} applied conditions).</p>` : nothing}
      ${abbreviatedTicks && data ? html`<p part="note">Axis labels are shortened for display; full values are listed in the data table.</p>` : nothing}
      ${geometry.result.precision.kind === "approximate" && data ? html`<p part="note">${valueLabel}: ${geometry.result.precision.method}. ${this.uncertaintyText(geometry.result.precision.uncertainty)}</p>` : nothing}
      ${geometry.result.warnings.length > 0 && data ? html`<ul part="warnings" aria-label="Result warnings">${geometry.result.warnings.map((warning) => html`<li>${warning.message}</li>`)}</ul>` : nothing}
      ${histogramMeasure !== undefined && data ? html`<p part="note">Executor-produced ${histogramMeasure} bins. Bin delivery does not establish source observation coverage.</p>` : nothing}
      ${geometry.state === "data-only" ? html`<p part="error" role="status">${geometry.reason ?? "The chart geometry is unavailable."}</p>` : nothing}
      ${graphic && axes && geometry.state === "plot" ? html`<div part="viewport" role="region" tabindex="0" aria-label=${`${label} ${this.expectedView} chart. Scroll to view the full graphic.`} style=${`inline-size: ${this.width}px`}>
        <svg viewBox=${`0 0 ${geometry.width} ${geometry.height}`} width=${geometry.width} height=${geometry.height} role="img" aria-label=${`${label}. ${scope} Values and selection are available in the data table below.`}>
          ${svgPlotMarks(geometry)}
          <path d=${`M${axisLeft},24V${geometry.height - 48}H${geometry.width - 24}`} fill="none" stroke="currentColor"></path>
          ${axes.x.ticks.map((tick, index) => svg`<text x=${tick.position} y=${geometry.height - 30} text-anchor=${this.xTickAnchor(index, axes.x.ticks.length)} aria-label=${tick.label}>${this.tickText(tick.label)}</text>`)}
          ${axes.y.ticks.map((tick) => svg`<text x=${axisLeft - 6} y=${tick.position} text-anchor="end" aria-label=${tick.label}>${this.tickText(tick.label)}</text>`)}
          <text x=${geometry.width / 2} y=${geometry.height - 8} text-anchor="middle">${axes.xLabel}</text>
          <text x=${axisLeft} y="14">${axes.yLabel}</text>
        </svg>
      </div>` : nothing}
      ${data ? html`${this.renderLegend(geometry)}${this.renderColorKey(geometry)}<div part="data"><table>
        <caption>${label}: ${tableLabel}</caption><thead><tr><th scope="col">Select</th>${geometry.result.fields.map((field) => html`<th scope="col">${field.label}${field.type.unit ? ` (${field.type.unit.symbol})` : nothing}</th>`)}</tr></thead>
        <tbody>${repeat(pageRows, (row) => row.identity, (row) => html`<tr><td data-label="Select"><button type="button" ?disabled=${!this.selectionEnabled} data-aeliqo-row-identity=${row.identity} data-aeliqo-result=${resultKey(geometry.result.ref)} aria-pressed=${this.isSelected(row.identity, geometry.result.ref) ? "true" : "false"} aria-label=${`Select ${this.identityLabel(row, geometry.result)}`} @click=${() => this.select(row.identity, geometry.result.ref)}>Select</button></td>${geometry.result.fields.map((field) => html`<td data-label=${field.label}>${exactLabel(row.values[field.id]!)}</td>`)}</tr>`)}</tbody>
      </table></div>${displayed.length > 25 ? html`<nav part="pagination" aria-label="${label} data pages"><button type="button" ?disabled=${page === 0} @click=${() => { this.page = page - 1; this.requestUpdate(); }}>Previous</button><span>Rows ${page * 25 + 1}–${Math.min((page + 1) * 25, displayed.length)} of ${displayed.length}</span><button type="button" ?disabled=${page + 1 >= pageCount} @click=${() => { this.page = page + 1; this.requestUpdate(); }}>Next</button></nav>` : nothing}` : nothing}
    </figure>`;
  }

  private renderLegend(geometry: PlotGeometry): unknown {
    if (!geometry.legend.some((entry) => entry.label)) return nothing;
    return html`<ul part="legend" aria-label="Series">${geometry.legend.map((entry) => html`<li><span part="legend-marker" aria-hidden="true" style=${`background:${seriesColor(geometry, entry.id)}`}></span>${entry.label || entry.id}</li>`)}</ul>`;
  }

  private renderColorKey(geometry: PlotGeometry): unknown {
    const field = geometry.result.fields.find((candidate) => candidate.id === geometry.colorField);
    if (field === undefined || geometry.colorTicks === undefined) return nothing;
    return html`<div part="color-key" aria-label=${`${field.label} color key`}><span>${field.label}</span><div part="color-key-bar" aria-hidden="true"></div><ul part="color-key-ticks">${geometry.colorTicks.map((tick) => html`<li>${tick.label}</li>`)}</ul></div>`;
  }

  private scopeText(result: Result): string {
    if (this.expectedView === "histogram") {
      const coverage = result.coverage.kind === "complete" ? "Complete bin delivery" : result.coverage.kind === "partial" ? `Partial bin delivery: ${result.coverage.reason}` : result.coverage.kind === "sample" ? `Sampled bin delivery: ${result.coverage.method}` : `Bin scope unknown: ${result.coverage.reason}`;
      return `${coverage}. Source observation coverage and missing/outside-bin counts are unknown.`;
    }
    return result.coverage.kind === "complete" ? "Complete result." : result.coverage.kind === "partial" ? `Partial result: ${result.coverage.reason}.` : result.coverage.kind === "sample" ? `Sample: ${result.coverage.method}.` : `Scope unknown: ${result.coverage.reason}.`;
  }

  private tickText(text: string): string { return text.length > 12 ? `${text.slice(0, 5)}…${text.slice(-5)}` : text; }
  private xTickAnchor(index: number, count: number): "start" | "middle" | "end" {
    if (count === 1) return "middle";
    if (index > 0 && index < count - 1) return "middle";
    if (index === 0) return "start";
    return "end";
  }
  private uncertaintyText(uncertainty: {readonly kind: "quantified"; readonly lower: number; readonly upper: number; readonly interpretation: string} | {readonly kind: "unquantified"; readonly reason: string}): string {
    return uncertainty.kind === "quantified"
      ? `${uncertainty.interpretation} (range ${uncertainty.lower}–${uncertainty.upper}).`
      : uncertainty.reason;
  }
  private identityLabel(row: {readonly values: Readonly<Record<string, Scalar>>}, result: Result): string { return result.identity.map((field) => exactLabel(row.values[field]!)).join(", "); }
  private isSelected(identity: string, result: ResultRef): boolean {
    return identity === this.selectedIdentity && (this.selectedResult === undefined ? this.singleResult : resultKey(result) === resultKey(this.selectedResult));
  }
  private select(identity: string, result: ResultRef): void {
    if(!this.selectionEnabled)return;
    const event = new CustomEvent<AeliqoVisualizationSelectionDetail>("aeliqo-visualization-select", {bubbles: true, composed: true, cancelable: true, detail: Object.freeze({source: "user", identity, result})});
    if (this.dispatchEvent(event)) {
      this.selectedIdentity = identity;
      this.selectedResult = result;
      this.requestUpdate();
    }
  }
  private clearSelection(): void { this.selectedIdentity = ""; this.selectedResult = undefined; }
  private retainSelection(compiled: CompiledPlot): void {
    const geometries: PlotGeometry[] = [];
    const visit = (node: CompiledPlotNode): void => { if (node.kind === "unit") geometries.push(node.geometry); else if (node.kind === "facet") node.children.forEach((child) => visit(child.node)); else node.children.forEach(visit); };
    visit(compiled.root);
    this.singleResult = new Set(geometries.map((geometry) => resultKey(geometry.result.ref))).size === 1;
    const stillPresent = geometries.some((geometry) => resultKey(geometry.result.ref) === resultKey(this.selectedResult ?? geometry.result.ref) && geometry.rows.some((row) => row.identity === this.selectedIdentity));
    if (!stillPresent) { this.selectedIdentity = ""; this.selectedResult = undefined; }
  }
}

export type CartesianElementInputs = Pick<VisualizationInputs, "visualization" | "context" | "datasets" | "label" | "width" | "height" | "maxMarks">;
