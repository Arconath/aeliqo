import {css, html, svg} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import type {Result, ResultRef, Scalar, VisualizationBindingContext} from '@aeliqo/sdk-core';
import {AeliqoFoundationElement, aeliqoFoundationThemeStyles} from '../../foundation/base.js';
import {compileHierarchyVisualization} from './geometry.js';
import type {HierarchyGeometry, HierarchyVisualizationGeometry, RelationshipGeometry} from './geometry.js';
import type {AeliqoVisualizationSelectionDetail, VisualizationDataset, VisualizationInputs} from '../types.js';

const scalarLabel = (value: Scalar): string => value === null ? 'Missing' : typeof value === 'object' ? value.decimal : String(value);

export abstract class AeliqoHierarchyElementBase extends AeliqoFoundationElement {
  static readonly shadowRootOptions: ShadowRootInit = {mode: "open", delegatesFocus: false};
  static readonly properties = {
    page: {state:true},
    visualization: {attribute: false},
    context: {attribute: false},
    datasets: {attribute: false},
    label: {type: String},
    width: {type: Number},
    height: {type: Number},
    maxMarks: {type: Number, attribute: 'max-marks'},
    selectionEnabled:{type:Boolean,attribute:false},
    selectedIdentity: {type: String, attribute: 'selected-identity'},
  };
  static readonly styles = [...aeliqoFoundationThemeStyles, css`
    :host { display: block; min-inline-size:0; inline-size:100%; max-inline-size: 100%; color: var(--aeliqo-color-text, #111827); }
    .sr-only {position:absolute;inline-size:1px;block-size:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;}
    figure { margin: 0; }
    figcaption, [part="scope"], p, caption, th, td { overflow-wrap: anywhere; unicode-bidi: plaintext; }
    [part="viewport"] { direction: ltr; overflow: auto; max-inline-size: 100%; border: 1px solid var(--aeliqo-color-border, #cbd5e1); border-radius: var(--aeliqo-radius-small, .375rem); }
    svg { display: block; max-inline-size: 100%; min-inline-size: min(20rem, 100%); }
    svg text { font: inherit; fill: currentColor; pointer-events: none; }
    svg .tree-label { fill: #111827; }
    svg .treemap-label { fill: var(--aeliqo-color-on-accent, #fff); }
    [part="node"], [part="edge"] { cursor: pointer; }
    [part="node"]:focus-visible, [part="edge"]:focus-visible { outline: 3px solid var(--aeliqo-color-focus, #4338ca); outline-offset: 2px; }
    [part="node"][aria-pressed="true"] { stroke: var(--aeliqo-color-focus, #4338ca); stroke-width: 3; }
    [part="edge"][aria-pressed="true"] { stroke: var(--aeliqo-color-focus, #4338ca); stroke-width: 3; }
    [part="data"] { overflow: auto; margin-block-start: 1rem; }
    button {font:inherit;min-block-size:2.75rem;min-inline-size:2.75rem;}
    table { border-collapse: collapse; inline-size: 100%; }
    th, td { text-align: start; padding: .5rem; border-block-end: 1px solid var(--aeliqo-color-border, #cbd5e1); vertical-align: top; }
    [aria-selected="true"] { background: color-mix(in srgb, var(--aeliqo-color-accent, #4338ca) 12%, transparent); }
    [part="scope"] { color: var(--aeliqo-color-muted, #4b5563); }
    @media (max-width: 30rem) {
      [part="data"] { overflow: visible; }
      table { display: block; inline-size: 100%; min-inline-size: 0; }
      caption { display: block; margin-block: .75rem; text-align: start; }
      thead { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; overflow: hidden; position: absolute; white-space: nowrap; }
      tbody { display: grid; gap: .75rem; }
      tr { border-block-end: 1px solid var(--aeliqo-color-border, #cbd5e1); display: block; padding-block: .25rem; }
      td { border: 0; display: grid; gap: .5rem; grid-template-columns: minmax(4.75rem, .7fr) minmax(0, 1.3fr); padding: .25rem; }
      td::before { content: attr(data-label); font-weight: 600; overflow-wrap: anywhere; }
      td > button { justify-self: start; }
    }
    @media (forced-colors: active) { svg path, svg line, svg rect, svg circle { stroke: CanvasText; fill: Canvas; } }
  `];

  visualization: VisualizationInputs['visualization'];
  context: VisualizationBindingContext = {results: []};
  datasets: readonly VisualizationDataset[] = [];
  label = 'Data visualization';
  width = 640;
  height = 360;
  maxMarks = 20_000;
  selectionEnabled=true;
  selectedIdentity = '';
  private page=0;
  private scope='';
  private focused:HTMLElement|SVGElement|undefined;
  protected abstract readonly expectedView:'tree'|'treemap'|'relationship';
  protected geometry: ReturnType<typeof compileHierarchyVisualization> | undefined;

  protected override willUpdate(changed: Map<string, unknown>): void {
    const active=this.shadowRoot?.activeElement;this.focused=active instanceof (globalThis.Element??Object)?active as HTMLElement|SVGElement:undefined;
    if (['visualization', 'context', 'datasets', 'width', 'height', 'maxMarks'].some(name => changed.has(name))) {
      this.geometry = this.visualization?.view===this.expectedView?compileHierarchyVisualization(this.inputs()):{ok:false,diagnostics:[{code:'visualization.view',message:`This surface requires a ${this.expectedView} specification.`,retryable:false}]};
      const scope=this.geometry.ok?JSON.stringify(this.geometry.value.result.ref):'';
      if(!this.geometry.ok||(this.scope!==''&&scope!==this.scope))this.selectedIdentity='';
      if(scope!==this.scope)this.page=0;this.scope=scope;
      this.page=this.geometry.ok?Math.min(this.page,Math.max(0,Math.ceil(this.geometry.value.rows.length/25)-1)):0;
      if (this.geometry.ok && this.selectedIdentity !== '' && !this.geometry.value.rows.some(row => row.identity === this.selectedIdentity)) this.selectedIdentity = '';
    }
  }

  protected override updated():void {const focused=this.focused;this.focused=undefined;if(focused?.isConnected&&(this.ownerDocument.activeElement===this.ownerDocument.body||(this.getRootNode() as Document|ShadowRoot).activeElement===this)&&!this.shadowRoot?.activeElement)focused.focus({preventScroll:true});}

  protected inputs(): VisualizationInputs {
    return {visualization: this.visualization, context: this.context, datasets: this.datasets, label: this.label, width: this.width, height: this.height, maxMarks: this.maxMarks};
  }

  protected abstract selectionEventName(): string;

  private select(identity: string, result: ResultRef): void {
    if(!this.selectionEnabled)return;
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
      <p class="sr-only">The loaded data is available in the table. Selection buttons are keyboard accessible.</p>
    </figure>`;
  }

  private renderHierarchyGraphic(geometry: HierarchyGeometry) {
    const byId = new Map(geometry.nodes.map(node => [node.identity, node]));
    const selected = this.selectedIdentity;
    return html`<div part="viewport" tabindex="0" role="region" aria-label=${`${this.label}: scrollable graphic`}><svg part="graphic" width=${geometry.width} height=${geometry.height} viewBox=${`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label=${`${this.label}. ${geometry.kind === 'tree' ? 'Hierarchy' : 'Treemap'}. Loaded values are available in the data table.`}>
      ${geometry.kind === 'tree' ? geometry.nodes.map(node => node.parentIdentity === undefined ? '' : (() => { const parent = byId.get(node.parentIdentity!); return parent === undefined ? '' : svg`<line x1=${parent.x + parent.width / 2} y1=${parent.y + parent.height} x2=${node.x + node.width / 2} y2=${node.y} stroke="currentColor" stroke-opacity=".45"></line>`; })()) : ''}
      ${repeat(geometry.nodes.filter(node=>node.width>0&&node.height>0),node=>node.identity,node => svg`<rect part="node" x=${node.x} y=${node.y} width=${node.width} height=${node.height} rx="4" fill=${geometry.kind === 'treemap' ? (node.leaf ? 'var(--aeliqo-color-accent, #6366f1)' : 'var(--aeliqo-color-surface-raised, #e2e8f0)') : 'var(--aeliqo-color-surface-raised, #e2e8f0)'} fill-opacity=${geometry.kind === 'treemap' ? (node.leaf ? '1' : '.22') : '1'} stroke="currentColor" stroke-opacity=".6" tabindex=${this.selectionEnabled?"0":"-1"} role="button" aria-disabled=${this.selectionEnabled?"false":"true"} aria-label=${node.label.trim()||node.rowIdentity} aria-pressed=${selected === node.rowIdentity ? 'true' : 'false'} @click=${() => this.select(node.rowIdentity, geometry.result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, node.rowIdentity, geometry.result.ref)}></rect>${node.width > 54 && node.height > 20 && (geometry.kind === 'tree' || node.leaf) ? svg`<text class=${geometry.kind === 'tree' ? 'tree-label' : 'treemap-label'} x=${node.x + 6} y=${node.y + Math.min(18, node.height - 4)}>${node.label.length>Math.floor(node.width/12)?`${node.label.slice(0,Math.max(1,Math.floor(node.width/12)-1))}…`:node.label}</text>` : ''}`)}
    </svg></div>`;
  }

  private renderHierarchyTable(geometry: HierarchyGeometry) {
    const result = geometry.result;
    const precision = result.precision.kind === 'exact' ? 'Exact' : 'Approximate';
    const label = geometry.kind === 'treemap' ? `${precision} loaded hierarchy data (${geometry.leafValuePolicy} area policy)` : `${precision} loaded hierarchy data`;
    return html`<div part="data" tabindex="0" role="region" aria-label=${`${this.label}: scrollable data`}><table><caption>${label}</caption><thead><tr><th scope="col">Select</th>${result.fields.map(field => html`<th scope="col">${field.label}${field.type.unit ? ` (${field.type.unit.symbol})` : ''}</th>`)}</tr></thead><tbody>${repeat(geometry.rows.slice(this.page*25,this.page*25+25),row=>row.identity,row => html`<tr aria-selected=${this.selectedIdentity === row.identity ? 'true' : 'false'}><td data-label="Select"><button type="button" ?disabled=${!this.selectionEnabled} aria-pressed=${this.selectedIdentity === row.identity ? 'true' : 'false'} aria-label=${`Select row ${row.identity}`} @click=${() => this.select(row.identity, result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, row.identity, result.ref)}>Select</button></td>${result.fields.map(field => html`<td data-label=${field.label}>${scalarLabel(row.values[field.id]!)}</td>`)}</tr>`)}</tbody></table></div>${this.pagination(geometry.rows.length)}`;
  }

  private pagination(count:number){const page=Math.min(this.page,Math.max(0,Math.ceil(count/25)-1));return count>25?html`<nav aria-label="Visualization data pages"><button type="button" ?disabled=${page===0} @click=${()=>{this.page=page-1;}}>Previous</button><span>Rows ${page*25+1}–${Math.min((page+1)*25,count)} of ${count}</span><button type="button" ?disabled=${(page+1)*25>=count} @click=${()=>{this.page=page+1;}}>Next</button></nav>`:'';}

  private renderRelationshipGraphic(geometry: RelationshipGeometry) {
    const selected = this.selectedIdentity;
    const byId = new Map(geometry.nodes.map(node => [node.identity, node]));
    return html`<div part="viewport" tabindex="0" role="region" aria-label=${`${this.label}: scrollable graphic`}><svg part="graphic" width=${geometry.width} height=${geometry.height} viewBox=${`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label=${`${this.label}. Relationship graph. Loaded values are available in the data table.`}>
      ${repeat(geometry.edges,edge=>edge.identity,edge => { const source = byId.get(edge.source)!; const target = byId.get(edge.target)!; return svg`<line part="edge" x1=${source.x} y1=${source.y} x2=${target.x} y2=${target.y} stroke="currentColor" stroke-opacity=".5" tabindex=${this.selectionEnabled?"0":"-1"} role="button" aria-disabled=${this.selectionEnabled?"false":"true"} aria-label=${edge.label?.trim() || `${edge.sourceLabel} → ${edge.targetLabel}`} aria-pressed=${selected === edge.identity ? 'true' : 'false'} @click=${() => this.select(edge.identity, geometry.result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, edge.identity, geometry.result.ref)}></line>`; })}
      ${geometry.nodes.map(node => svg`<circle cx=${node.x} cy=${node.y} r="9" fill=${node.namespace === 'source' ? 'var(--aeliqo-color-accent, #6366f1)' : 'var(--aeliqo-color-positive, #0f766e)'} stroke="currentColor"></circle><text class="relationship-node-label" x=${node.x+(node.namespace==='source'?-14:14)} y=${node.y+5} text-anchor=${node.namespace==='source'?'end':'start'}>${node.label.length>12?`${node.label.slice(0,11)}…`:node.label}</text>`)}
      <text class="relationship-column-label" x=${geometry.width * .25} y="18" text-anchor="middle">Source</text><text class="relationship-column-label" x=${geometry.width * .75} y="18" text-anchor="middle">Target</text>
    </svg></div>`;
  }

  private renderRelationshipTable(geometry: RelationshipGeometry) {
    const result = geometry.result;
    const source = geometry.bound.spec.view === 'relationship' ? geometry.bound.spec.source.join(', ') : 'source';
    const target = geometry.bound.spec.view === 'relationship' ? geometry.bound.spec.target.join(', ') : 'target';
    return html`<div part="data" tabindex="0" role="region" aria-label=${`${this.label}: scrollable data`}><table><caption>${result.precision.kind === 'exact' ? 'Exact' : 'Approximate'} loaded relationship data (${geometry.cardinality}; ${source} → ${target})</caption><thead><tr><th scope="col">Select</th>${result.fields.map(field => html`<th scope="col">${field.label}${field.type.unit ? ` (${field.type.unit.symbol})` : ''}</th>`)}</tr></thead><tbody>${repeat(geometry.rows.slice(this.page*25,this.page*25+25),row=>row.identity,row => html`<tr aria-selected=${this.selectedIdentity === row.identity ? 'true' : 'false'}><td data-label="Select"><button type="button" ?disabled=${!this.selectionEnabled} aria-pressed=${this.selectedIdentity === row.identity ? 'true' : 'false'} aria-label=${`Select relationship ${row.identity}`} @click=${() => this.select(row.identity, result.ref)} @keydown=${(event: KeyboardEvent) => this.keySelect(event, row.identity, result.ref)}>Select</button></td>${result.fields.map(field => html`<td data-label=${field.label}>${scalarLabel(row.values[field.id]!)}</td>`)}</tr>`)}</tbody></table></div>${this.pagination(geometry.rows.length)}`;
  }
}

export class AeliqoTreeElement extends AeliqoHierarchyElementBase {
  protected readonly expectedView='tree' as const;
  static readonly aeliqoVersion = '0.1.0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}

export class AeliqoTreemapElement extends AeliqoHierarchyElementBase {
  protected readonly expectedView='treemap' as const;
  static readonly aeliqoVersion = '0.1.0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}

export class AeliqoRelationshipElement extends AeliqoHierarchyElementBase {
  protected readonly expectedView='relationship' as const;
  static readonly aeliqoVersion = '0.1.0';
  protected selectionEventName(): string { return 'aeliqo-visualization-select'; }
}
