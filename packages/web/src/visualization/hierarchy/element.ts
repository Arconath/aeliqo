import {css, html} from 'lit';
import type {Result, ResultRef, Scalar, VisualizationBindingContext} from '@aeliqo/core';
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from '../../foundation/base.js';
import {compileHierarchyVisualization} from './geometry.js';
import type {HierarchyGeometry, HierarchyVisualizationGeometry, RelationshipGeometry} from './geometry.js';
import type {AeliqoVisualizationSelectionDetail, VisualizationDataset, VisualizationInputs} from '../types.js';

const scalarLabel = (value: Scalar): string => value === null ? 'Missing' : typeof value === 'object' ? value.decimal : String(value);

export abstract class AeliqoHierarchyElementBase extends AeliqoFoundationElement {
  static readonly properties = {
    visualization: {attribute: false},
    context: {attribute: false},
    datasets: {attribute: false},
    label: {type: String},
    width: {type: Number},
    height: {type: Number},
    maxMarks: {type: Number, attribute: 'max-marks'},
    selectedIdentity: {type: String, attribute: 'selected-identity'},
  };
  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: block; max-inline-size: 100%; color: var(--aeliqo-color-text, #111827); }
    figure { margin: 0; }
    [part="viewport"] { overflow: auto; max-inline-size: 100%; border: 1px solid var(--aeliqo-color-border, #cbd5e1); border-radius: var(--aeliqo-radius-small, .375rem); }
    svg { display: block; max-inline-size: 100%; min-inline-size: 20rem; }
    svg text { font: 11px system-ui, sans-serif; fill: currentColor; pointer-events: none; }
    [part="node"], [part="edge"] { cursor: pointer; }
    [part="node"]:focus-visible, [part="edge"]:focus-visible { outline: 3px solid var(--aeliqo-color-focus, #4338ca); outline-offset: 2px; }
    [part="node"][aria-pressed="true"] { stroke: var(--aeliqo-color-focus, #4338ca); stroke-width: 3; }
    [part="edge"][aria-pressed="true"] { stroke: var(--aeliqo-color-focus, #4338ca); stroke-width: 3; }
    [part="data"] { overflow: auto; margin-block-start: 1rem; }
    table { border-collapse: collapse; inline-size: 100%; }
    th, td { text-align: start; padding: .5rem; border-block-end: 1px solid var(--aeliqo-color-border, #cbd5e1); vertical-align: top; }
    button { min-block-size: 2.75rem; min-inline-size: 2.75rem; }
    [aria-selected="true"] { background: color-mix(in srgb, var(--aeliqo-color-accent, #4338ca) 12%, transparent); }
    [part="scope"] { color: var(--aeliqo-color-text-muted, #475569); }
    @media (forced-colors: active) { svg path, svg line, svg rect, svg circle { stroke: CanvasText; fill: Canvas; } }
  `];

  visualization: VisualizationInputs['visualization'];
  context: VisualizationBindingContext = {results: []};
  datasets: readonly VisualizationDataset[] = [];
  label = 'Data visualization';
  width = 640;
  height = 360;
  maxMarks = 20_000;
  selectedIdentity = '';
  protected geometry: ReturnType<typeof compileHierarchyVisualization> | undefined;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (['visualization', 'context', 'datasets', 'width', 'height', 'maxMarks'].some(name => changed.has(name))) {
      this.geometry = compileHierarchyVisualization(this.inputs());
      if (this.geometry.ok && this.selectedIdentity !== '' && !this.geometry.value.rows.some(row => row.identity === this.selectedIdentity)) this.selectedIdentity = '';
    }
  }

  protected inputs(): VisualizationInputs {
    return {visualization: this.visualization, context: this.context, datasets: this.datasets, label: this.label, width: this.width, height: this.height, maxMarks: this.maxMarks};
  }

  protected abstract selectionEventName(): string;

  private select(identity: string, result: ResultRef): void {
    const detail: AeliqoVisualizationSelectionDetail = Object.freeze({source: 'user', identity, result});
    const event = new CustomEvent<AeliqoVisualizationSelectionDetail>(this.selectionEventName(), {bubbles: true, composed: true, cancelable: true, detail});
    if (this.dispatchEvent(event)) this.selectedIdentity = identity;
  }

  private keySelect(event: KeyboardEvent, identity: string, result: ResultRef): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); this.select(identity, result);
  }

  protected override render() {
    const geometry = this.geometry;
    if (geometry === undefined) return html`<p role="status">Preparing visualization.</p>`;
    if (!geometry.ok) return html`<p role="status">${geometry.diagnostics[0]?.message ?? 'The visualization could not be materialized.'}</p>`;
    return this.renderGeometry(geometry.value);
  }

  private scopeText(result: Result): string {
    const coverage = result.coverage;
    const scope = coverage.kind === 'complete' ? 'Complete result' : coverage.kind === 'sample' ? `Sample: ${coverage.method}` : coverage.kind === 'partial' ? `Partial result: ${coverage.reason}` : `Scope unknown: ${coverage.reason}`;
    return `${scope}. ${result.counts.loaded} loaded rows.`;
  }

  private renderGeometry(geometry: HierarchyVisualizationGeometry) {
    return html`<figure part="figure">
      <figcaption>${this.label}</figcaption>
      <p part="scope">${this.scopeText(geometry.result)}</p>
      ${geometry.result.period ? html`<p>${geometry.result.period.interpretation} (${geometry.result.period.timezone})</p>` : ''}
      ${geometry.result.filters.length ? html`<p>Filtered result (${geometry.result.filters.length} applied conditions).</p>` : ''}
      ${geometry.result.precision.kind === 'approximate' ? html`<p>Approximate values: ${geometry.result.precision.method}. ${geometry.result.precision.uncertainty.kind === 'unquantified' ? geometry.result.precision.uncertainty.reason : geometry.result.precision.uncertainty.interpretation}</p>` : ''}
      ${geometry.result.warnings.map(warning => html`<p>${warning.message}</p>`)}
      ${geometry.state === 'data-only' ? html`<p role="status">${geometry.reason ?? 'The graphic is unavailable.'}</p>` : geometry.kind === 'relationship' ? this.renderRelationshipGraphic(geometry) : this.renderHierarchyGraphic(geometry)}
      ${geometry.kind === 'relationship' ? this.renderRelationshipTable(geometry) : this.renderHierarchyTable(geometry)}
      <p class="sr-only">The exact loaded data is available in the table. Selection buttons are keyboard accessible.</p>
    </figure>`;
  }

  private renderHierarchyGraphic(geometry: HierarchyGeometry) {
    const byId = new Map(geometry.nodes.map(node => [node.identity, node]));
    const selected = this.selectedIdentity;
    return html`<div part="viewport"><svg part="graphic" width=${geometry.width} height=${geometry.height} viewBox=${`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label=${`${this.label}. ${geometry.kind === 'tree' ? 'Hierarchy' : 'Treemap'}. Exact values are available in the data table.`}>
      ${geometry.kind === 'tree' ? geometry.nodes.map(node => node.parentIdentity === undefined ? '' : (() => { const parent = byId.get(node.parentIdentity!); return parent === undefined ? '' : html`<line x1=${parent.x + parent.width / 2} y1=${parent.y + parent.height} x2=${node.x + node.width / 2} y2=${node.y} stroke="currentColor" stroke-opacity=".45"></line>`; })()) : ''}
      ${geometry.nodes.map(node => html`<rect part="node" x=${node.x} y=${node.y} width=${node.width} height=${node.height} rx="4" fill=${geometry.kind === 'treemap' ? (node.leaf ? 'var(--aeliqo-color-accent, #6366f1)' : 'var(--aeliqo-color-surface-raised, #e2e8f0)') : 'var(--aeliqo-color-surface-raised, #e2e8f0)'} fill-opacity=${geometry.kind === 'treemap' ? (node.leaf ? '.75' : '.22') : '1'} stroke="currentColor" stroke-opacity=".6" tabindex="0" role="button" aria-label=${node.label} aria-pressed=${selected === node.identity ? 'true' : 'false'} @click=${() => this.select(node.identity, geometry.result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, node.identity, geometry.result.ref)}></rect>${node.width > 54 && node.height > 20 ? html`<text x=${node.x + 6} y=${node.y + Math.min(18, node.height - 4)}>${node.label}</text>` : ''}`)}
    </svg></div>`;
  }

  private renderHierarchyTable(geometry: HierarchyGeometry) {
    const result = geometry.result;
    const precision = result.precision.kind === 'exact' ? 'Exact' : 'Approximate';
    const label = geometry.kind === 'treemap' ? `${precision} loaded hierarchy data (${geometry.leafValuePolicy} area policy)` : `${precision} loaded hierarchy data`;
    return html`<div part="data"><table><caption>${label}</caption><thead><tr><th scope="col">Select</th>${result.fields.map(field => html`<th scope="col">${field.label}${field.type.unit ? ` (${field.type.unit.symbol})` : ''}</th>`)}</tr></thead><tbody>${geometry.rows.map(row => html`<tr aria-selected=${this.selectedIdentity === row.identity ? 'true' : 'false'}><td><button type="button" aria-pressed=${this.selectedIdentity === row.identity ? 'true' : 'false'} aria-label=${`Select row ${row.identity}`} @click=${() => this.select(row.identity, result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, row.identity, result.ref)}>Select</button></td>${result.fields.map(field => html`<td>${scalarLabel(row.values[field.id]!)}</td>`)}</tr>`)}</tbody></table></div>`;
  }

  private renderRelationshipGraphic(geometry: RelationshipGeometry) {
    const selected = this.selectedIdentity;
    const byId = new Map(geometry.nodes.map(node => [node.identity, node]));
    return html`<div part="viewport"><svg part="graphic" width=${geometry.width} height=${geometry.height} viewBox=${`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label=${`${this.label}. Relationship graph. Exact values are available in the data table.`}>
      ${geometry.edges.map(edge => { const source = byId.get(edge.source)!; const target = byId.get(edge.target)!; return html`<line part="edge" x1=${source.x} y1=${source.y} x2=${target.x} y2=${target.y} stroke="currentColor" stroke-opacity=".5" tabindex="0" role="button" aria-label=${edge.label ?? 'Select relationship'} aria-pressed=${selected === edge.identity ? 'true' : 'false'} @click=${() => this.select(edge.identity, geometry.result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, edge.identity, geometry.result.ref)}></line>`; })}
      ${geometry.nodes.map(node => html`<circle cx=${node.x} cy=${node.y} r="9" fill=${node.namespace === 'source' ? 'var(--aeliqo-color-accent, #6366f1)' : 'var(--aeliqo-color-positive, #0f766e)'} stroke="currentColor"><title>${node.namespace}: ${node.label}</title></circle>`)}
      <text x=${geometry.width * .25} y="14" text-anchor="middle">Source</text><text x=${geometry.width * .75} y="14" text-anchor="middle">Target</text>
    </svg></div>`;
  }

  private renderRelationshipTable(geometry: RelationshipGeometry) {
    const result = geometry.result;
    const source = geometry.bound.spec.view === 'relationship' ? geometry.bound.spec.source.join(', ') : 'source';
    const target = geometry.bound.spec.view === 'relationship' ? geometry.bound.spec.target.join(', ') : 'target';
    return html`<div part="data"><table><caption>${result.precision.kind === 'exact' ? 'Exact' : 'Approximate'} loaded relationship data (${geometry.cardinality}; ${source} → ${target})</caption><thead><tr><th scope="col">Select</th>${result.fields.map(field => html`<th scope="col">${field.label}${field.type.unit ? ` (${field.type.unit.symbol})` : ''}</th>`)}</tr></thead><tbody>${geometry.rows.map(row => html`<tr aria-selected=${this.selectedIdentity === row.identity ? 'true' : 'false'}><td><button type="button" aria-pressed=${this.selectedIdentity === row.identity ? 'true' : 'false'} aria-label=${`Select relationship ${row.identity}`} @click=${() => this.select(row.identity, result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, row.identity, result.ref)}>Select</button></td>${result.fields.map(field => html`<td>${scalarLabel(row.values[field.id]!)}</td>`)}</tr>`)}</tbody></table></div>`;
  }
}

export class AeliqoTreeElement extends AeliqoHierarchyElementBase {
  static readonly aeliqoVersion = '0.1.0-m0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}

export class AeliqoTreemapElement extends AeliqoHierarchyElementBase {
  static readonly aeliqoVersion = '0.1.0-m0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}

export class AeliqoRelationshipElement extends AeliqoHierarchyElementBase {
  static readonly aeliqoVersion = '0.1.0-m0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}
