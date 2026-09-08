import {html,svg,css,nothing} from 'lit';
import type {PlotUnit,PlotSpec,Result,ResultRef,Outcome} from '@aeliqo/core';
import {AeliqoFoundationElement,aeliqoFoundationThemeStyles} from '../foundation/base.js';
import {compilePlotComposition,type PlotDataset,type CompiledPlot,type CompiledPlotNode} from './composition.js';
import {compilePlotUnit} from './geometry.js';
import type {PlotGeometry} from './geometry.js';
import {exactLabel} from './scales.js';
import {svgPlotMarks,paintPlotCanvas,seriesColor,seriesSymbol} from './render.js';

export interface AeliqoPlotSelectionDetail {readonly source:"user";readonly identity:string;readonly result:ResultRef}
export type AeliqoPlotSelectionEvent = CustomEvent<AeliqoPlotSelectionDetail>;

/** Direct plot surface: no runtime, query evaluator or model instance is constructed. */
const tickText=(text:string):string=>text.length>10?`${text.slice(0,4)}…${text.slice(-4)}`:text;
export class AeliqoPlotElement extends AeliqoFoundationElement {
 static readonly aeliqoVersion="0.1.0";
 static readonly properties={spec:{attribute:false},results:{attribute:false},datasets:{attribute:false},unit:{attribute:false},result:{attribute:false},rows:{attribute:false},
   renderer:{type:String},width:{type:Number},height:{type:Number},maxMarks:{type:Number,attribute:'max-marks'},
   label:{type:String},page:{state:true},selectedIdentity:{type:String,attribute:'selected-identity'},selectedResult:{attribute:false}};
 static readonly styles=[...aeliqoFoundationThemeStyles,css`
  :host{display:block;max-inline-size:100%;color:var(--aeliqo-color-text,#111827)}
  figure{margin:0} [part=viewport]{position:relative;max-inline-size:100%;overflow:auto}
  [part=canvas]{position:absolute;inset:0;pointer-events:none} svg{display:block}
  svg text{font:11px system-ui;fill:currentColor} table{border-collapse:collapse;inline-size:100%}
  th,td{text-align:start;padding:.5rem;border-block-end:1px solid var(--aeliqo-color-border,#64748b)}
  [part=data]{overflow:auto} button{min-block-size:2.75rem;min-inline-size:2.75rem}
  button:focus-visible{outline:3px solid var(--aeliqo-color-focus,#4338ca);outline-offset:2px}
  [aria-selected=true]{background:var(--aeliqo-color-surface,#f8fafc)}
  [part=concat-inline]{display:flex;gap:1rem;overflow:auto} [part=facet]{display:flex;flex-wrap:wrap;gap:1rem}
  [part=layer]{display:grid;overflow:auto} [part=layer]>div{grid-area:1/1}
  @media(forced-colors:active){svg path,svg circle,svg rect{stroke:CanvasText;fill:CanvasText}}
 `];
 spec:PlotSpec|undefined;
 results:readonly Result[]=[];
 datasets:readonly PlotDataset[]=[];
 unit:PlotUnit|undefined;
 result:Result|undefined;
 rows:unknown=[];
 renderer:'svg'|'canvas'='svg';
 width=640;height=320;maxMarks=20_000;
 label='Data visualization';
 selectedIdentity='';
 selectedResult:ResultRef|undefined;
 private selectionScope='';
 private singleResult=true;
 private page=0;
 private composition:Outcome<CompiledPlot>|undefined;
 private canvasGeometries:PlotGeometry[]=[];
 private compiled:Outcome<PlotGeometry>|undefined;
 protected override willUpdate(changed:Map<string,unknown>):void {
  if(['spec','results','datasets','unit','result','rows','width','height','maxMarks'].some(k=>changed.has(k))){
   this.composition=this.spec?compilePlotComposition(this.spec,this.results,this.datasets,{width:this.width,height:this.height,maxRows:10_000,maxMarks:this.maxMarks}):undefined;
   this.compiled=!this.spec&&this.unit&&this.result?compilePlotUnit(this.unit,this.result,this.rows,{width:this.width,height:this.height,maxRows:10_000,maxMarks:this.maxMarks}):undefined;
   const count=this.compiled?.ok?this.compiled.value.rows.length:0;
   this.page=Math.min(this.page,Math.max(0,Math.ceil(count/25)-1));
   const geometries:PlotGeometry[]=[];
   const visit=(node:CompiledPlotNode):void=>{if(node.kind==='unit')geometries.push(node.geometry);else if(node.kind==='facet')node.children.forEach(c=>visit(c.node));else node.children.forEach(visit);};
   if(this.composition?.ok)visit(this.composition.value.root);else if(this.compiled?.ok)geometries.push(this.compiled.value);
   const scope=JSON.stringify([...new Set(geometries.map(g=>this.refKey(g.result.ref)))].sort());
   if((this.selectionScope!==''&&this.selectionScope!==scope&&!this.selectedResult)||!geometries.some(g=>(!this.selectedResult||this.refKey(this.selectedResult)===this.refKey(g.result.ref))&&g.rows.some(r=>r.identity===this.selectedIdentity)))this.selectedIdentity='';
   this.singleResult=new Set(geometries.map(g=>this.refKey(g.result.ref))).size===1;
   this.selectionScope=scope;
  }
 }
 protected override updated():void {
  if(this.renderer!=='canvas')return;
  const canvases=this.renderRoot.querySelectorAll<HTMLCanvasElement>('canvas');
  canvases.forEach((canvas,index)=>{
   const g=this.canvasGeometries[index];if(!g)return;
   const context=canvas.getContext('2d');if(!context)return;
   const ratio=Math.min(2,Math.max(1,globalThis.devicePixelRatio||1),Math.sqrt(4_000_000/(g.width*g.height)));
   canvas.width=Math.round(g.width*ratio);canvas.height=Math.round(g.height*ratio);
   canvas.style.width=`${g.width}px`;canvas.style.height=`${g.height}px`;
   context.setTransform(ratio,0,0,ratio,0,0);paintPlotCanvas(context,g);
  });
 }

 private refKey(ref:ResultRef):string {return JSON.stringify([ref.id,ref.revision,ref.outputId,ref.queryDigest,ref.scopeDigest]);}
 private select(identity:string,result:Result):void {
  this.dispatchEvent(new CustomEvent('aeliqo-plot-select',{bubbles:true,composed:true,cancelable:true,
   detail:Object.freeze({source:'user',identity,result:result.ref})}));
 }
 protected override render(){
  this.canvasGeometries=[];
  if(this.composition){
   if(!this.composition.ok)return html`<p role="status">${this.composition.diagnostics[0].message}</p>`;
   return this.renderNode(this.composition.value.root,this.label);
  }
  const compiled=this.compiled;
  if(!compiled)return html`<p role="status">No result is available.</p>`;
  if(!compiled.ok)return html`<p role="status">${compiled.diagnostics[0].message}</p>`;
  return this.renderGeometry(compiled.value,this.label);
 }
 private renderNode(node:CompiledPlotNode,label:string,graphic=true,data=true):unknown {
  if(node.kind==='unit')return this.renderGeometry(node.geometry,label,graphic,data,node.displayedIdentities);
  if(node.kind==='facet')return html`<section aria-label=${label} part="facet">${node.children.map(c=>html`<section aria-label=${`${node.field}: ${c.label}`}>${data?html`<h3>${node.field}: ${c.label}</h3>`:nothing}${this.renderNode(c.node,`${label}, ${node.field}: ${c.label}`,graphic,data)}</section>`)}</section>`;
  if(node.kind==='concat')return html`<section part=${`concat-${node.direction}`} aria-label=${label}>${node.children.map((c,i)=>this.renderNode(c,`${label}, panel ${i+1}`,graphic,data))}</section>`;
  return html`<section aria-label=${label}>${data?html`<h3>${label}</h3>`:nothing}${graphic?html`<div part="layer">${node.children.map((c,i)=>html`<div>${this.renderNode(c,`${label}, layer ${i+1}`,true,false)}</div>`)}</div>`:nothing}${data?node.children.map((c,i)=>this.renderNode(c,`${label}, layer ${i+1}`,false,true)):nothing}</section>`;
 }
 private renderGeometry(g:PlotGeometry,label:string,graphic=true,data=true,displayedIdentities?:readonly string[]){
  const identities=displayedIdentities?new Set(displayedIdentities):undefined;
  const displayed=identities?g.rows.filter(r=>identities.has(r.identity)):g.rows;
  const axes=g.axes;const page=Math.min(this.page,Math.max(0,Math.ceil(displayed.length/25)-1));const pageRows=displayed.slice(page*25,page*25+25);
  if(graphic&&axes&&this.renderer==='canvas')this.canvasGeometries.push(g);
  const coverage=g.result.coverage;
  const precision=g.result.precision;
  const valueLabel=precision.kind==='exact'?'Exact loaded values':'Loaded approximate values';
  const scope=coverage.kind==='complete'?'Complete result':coverage.kind==='sample'?`Sample: ${coverage.method}`:coverage.kind==='partial'?`Partial result: ${coverage.reason}`:`Scope unknown: ${coverage.reason}`;
  return html`<figure part="figure">${data?html`<figcaption>${label}</figcaption><p part="scope">${scope}. ${g.rows.length} loaded rows.${displayed.length!==g.rows.length?` ${displayed.length} rows in this display partition.`:""}</p>
   ${g.result.period?html`<p>${g.result.period.interpretation} (${g.result.period.timezone})</p>`:nothing}
   ${g.result.filters.length?html`<p>Filtered result (${g.result.filters.length} applied conditions).</p>`:nothing}
   ${precision.kind==='approximate'?html`<p>Approximate values: ${precision.method}. ${precision.uncertainty.kind==='unquantified'?precision.uncertainty.reason:precision.uncertainty.interpretation}</p>`:nothing}
   `:nothing}
   ${graphic&&axes&&[...axes.x.ticks,...axes.y.ticks].some(t=>t.label.length>10)?html`<p>Axis labels are shortened. Exact values are listed below.</p>`:nothing}
   ${g.state==='data-only'?html`<p role="status">${g.reason}</p>`:nothing}
   ${graphic&&axes?html`<div part="viewport" style=${`width:${g.width}px;height:${g.height}px`}>
    ${this.renderer==='canvas'?html`<canvas part="canvas" aria-hidden="true"></canvas>`:nothing}
    <svg viewBox=${`0 0 ${g.width} ${g.height}`} width=${g.width} height=${g.height} role="img" aria-label=${`${label}. ${scope}. Values and selection are available in the data table below.`}>
     ${this.renderer==='svg'?svgPlotMarks(g):nothing}
     <path d=${`M64,24V${g.height-48}H${g.width-24}`} fill="none" stroke="currentColor"></path>
     ${axes.x.ticks.map(t=>svg`<text x=${t.position} y=${g.height-30} text-anchor="middle" aria-label=${t.label}>${tickText(t.label)}</text>`)}
     ${axes.y.ticks.map(t=>svg`<text x="58" y=${t.position} text-anchor="end" aria-label=${t.label}>${tickText(t.label)}</text>`)}
     <text x=${g.width/2} y=${g.height-8} text-anchor="middle">${axes.xLabel}</text>
     <text x="64" y="14">${axes.yLabel}</text>
    </svg></div>`:nothing}
    ${data?html`${g.legend.some(l=>l.label)?html`<ul aria-label="Series">${g.legend.map(l=>html`<li><span aria-hidden="true" style=${`color:${seriesColor(g,l.id)}`}>${seriesSymbol(g,l.id)}</span> ${l.label}</li>`)}</ul>`:nothing}
    <div part="data"><table><caption>${label}: ${valueLabel}</caption><thead><tr><th scope="col">Select</th>${g.result.fields.map(f=>html`<th scope="col">${f.label}${f.type.unit?` (${f.type.unit.symbol})`:''}</th>`)}</tr></thead>
     <tbody>${pageRows.map(row=>html`<tr><td><button type="button" aria-pressed=${this.selectedIdentity===row.identity&&(this.selectedResult?this.refKey(this.selectedResult)===this.refKey(g.result.ref):this.singleResult)?'true':'false'} aria-label=${`Select ${g.result.identity.map(k=>exactLabel(row.values[k]!)).join(', ')}`} @click=${()=>this.select(row.identity,g.result)}>Select</button></td>${g.result.fields.map(f=>html`<td>${exactLabel(row.values[f.id]!)}</td>`)}</tr>`)}</tbody></table></div>
    ${displayed.length>25?html`<nav aria-label="Plot data pages"><button type="button" ?disabled=${page===0} @click=${()=>{this.page=page-1;}}>Previous</button><span>Rows ${page*25+1}–${Math.min((page+1)*25,displayed.length)} of ${displayed.length} displayed</span><button type="button" ?disabled=${(page+1)*25>=displayed.length} @click=${()=>{this.page=page+1;}}>Next</button></nav>`:nothing}
    `:nothing}
  </figure>`;
 }
}
