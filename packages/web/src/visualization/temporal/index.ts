import {html,svg,css,nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import type {VisualizationBindingContext,VisualizationSpec} from '@aeliqo/core';
import {AeliqoFoundationElement,aeliqoFoundationThemeStyles} from '../../foundation/base.js';
import {exactLabel} from '../../plot/scales.js';
import type {VisualizationDataset,VisualizationInputs,VisualizationRow} from '../types.js';
import {compileTemporalVisualization} from './geometry.js';
export {compileTemporalVisualization} from './geometry.js';
export type {TemporalGeometry,TimelineMark,CalendarDay} from './geometry.js';
class AeliqoTemporalElement extends AeliqoFoundationElement implements VisualizationInputs {
 static readonly properties={visualization:{attribute:false},context:{attribute:false},datasets:{attribute:false},label:{type:String},width:{type:Number},height:{type:Number},maxMarks:{type:Number,attribute:'max-marks'},page:{state:true}};
 static readonly styles=[...aeliqoFoundationThemeStyles,css`
 :host{display:block;min-inline-size:0;inline-size:100%;color:var(--aeliqo-color-text,#111827);max-inline-size:100%}figure{margin:0}table{border-collapse:collapse;inline-size:100%}th,td{text-align:start;padding:.5rem;border-block-end:1px solid var(--aeliqo-color-border,#64748b)}[part=data],[part=viewport]{overflow:auto;max-inline-size:100%}button{font:inherit;min-inline-size:2.75rem;min-block-size:2.75rem}nav{display:flex;align-items:center;gap:.5rem}svg{display:block;color:var(--aeliqo-color-accent,#4338ca)}.days{display:grid;grid-template-columns:repeat(7,minmax(5rem,1fr));gap:.25rem;min-inline-size:40rem}.day{border:1px solid var(--aeliqo-color-border,#64748b);padding:.5rem;min-block-size:5rem}.day span{display:block}strong{display:block;margin:.2rem 0;font-size:1rem}button:focus-visible{outline:3px solid var(--aeliqo-color-focus,#4338ca)}
 `];
 visualization:VisualizationSpec|undefined;context:VisualizationBindingContext={results:[]};datasets:readonly VisualizationDataset[]=[];
 label='Data visualization';width=640;height=320;maxMarks=1000;private page=0;private scope='';
 protected readonly view:'matrix'|'timeline'|'calendar-grid'='matrix';
 private focused:HTMLElement|undefined;
 protected override willUpdate():void {const active=this.shadowRoot?.activeElement;this.focused=globalThis.HTMLElement!==undefined&&active instanceof HTMLElement?active:undefined;}
 protected override updated():void {const target=this.focused;this.focused=undefined;if(target?.isConnected&&this.ownerDocument.activeElement===this.ownerDocument.body)target.focus({preventScroll:true});}

 protected override render(){
  if(this.visualization?.view!==this.view)return html`<p role="status">No matching visualization is available.</p>`;
  const compiled=compileTemporalVisualization(this);if(!compiled.ok)return html`<p role="status">${compiled.diagnostics[0]?.message}</p>`;
  const g=compiled.value;const result=g.result;const refKey=JSON.stringify(result.ref);if(this.scope!==refKey){this.scope=refKey;this.page=0;}
  const rowsByIdentity=new Map(g.rows.map(row=>[row.identity,row]));
  const temporalField=result.fields.find(f=>f.id===(this.visualization?.view==='timeline'?this.visualization.start:this.visualization?.view==='calendar-grid'?this.visualization.date:''));
  const page=Math.min(this.page,Math.max(0,Math.ceil(g.rows.length/25)-1));const fields=g.columns.map(id=>result.fields.find(f=>f.id===id)!);
  const coverage=result.coverage;const scope=coverage.kind==='complete'?'Complete result':coverage.kind==='sample'?`Sample: ${coverage.method}`:coverage.kind==='partial'?`Partial result: ${coverage.reason}`:`Scope unknown: ${coverage.reason}`;
  const select=(row:VisualizationRow)=>this.dispatchEvent(new CustomEvent('aeliqo-visualization-select',{bubbles:true,composed:true,cancelable:true,detail:Object.freeze({source:'user',identity:row.identity,result:result.ref})}));
  const spec=this.visualization;
  const displayLabel=(row:VisualizationRow)=>spec.view!=='matrix'&&'label' in spec&&spec.label?exactLabel(row.values[spec.label]!):rowLabel(row);
  const rowLabel=(row:VisualizationRow)=>result.identity.map(id=>exactLabel(row.values[id]!)).join(', ');
  return html`<figure><figcaption>${this.label}</figcaption><p part="scope">${scope}. ${g.rows.length} loaded rows.</p>
   ${result.period?html`<p>${result.period.interpretation} (${result.period.timezone})</p>`:nothing}
   ${result.filters.length?html`<p>Filtered result (${result.filters.length} applied conditions).</p>`:nothing}
   ${result.precision.kind==='approximate'?html`<p>Approximate values: ${result.precision.method}. ${result.precision.uncertainty.kind==='unquantified'?result.precision.uncertainty.reason:result.precision.uncertainty.interpretation}</p>`:nothing}
   ${result.warnings.map(w=>html`<p>${w.message}</p>`)}
   ${g.state==='data-only'?html`<p role="status">${g.reason}</p>`:nothing}
   ${g.timeline?html`<p>Intervals use separate lanes when they overlap. ${temporalField?.type.temporal?.calendar}; timezone: ${temporalField?.type.temporal?.timezone??'civil dates'}. Missing endpoints appear only in the data table. Visual labels are limited to 40 characters. Exact endpoints, labels and selection are available below.</p><div part="viewport" tabindex="0" role="region" aria-label=${`${this.label}: scrollable graphic`}><svg width=${g.width} height=${g.height} viewBox=${`0 0 ${g.width} ${g.height}`} role="img" aria-label=${`${this.label}: intervals in chronological order. ${scope}. Exact values below.`}>${g.timeline.map(mark=>svg`<line x1=${mark.x} x2=${Math.max(mark.x+2,mark.end)} y1=${24+mark.lane*28} y2=${24+mark.lane*28} stroke="currentColor" stroke-width="12"></line><text x="24" y=${16+mark.lane*28} font-size="11" fill="currentColor">${displayLabel(rowsByIdentity.get(mark.identity)!).slice(0,40)}</text>`)}${g.ticks?.filter((_,index,list)=>index===0||index===list.length-1).map((tick,index)=>svg`<text x=${tick.position} y=${g.height-16} text-anchor=${index===0?'start':'end'} font-size="11" fill="currentColor" aria-label=${tick.label}>${tick.label.length>24?`${tick.label.slice(0,23)}…`:tick.label}</text>`)}</svg></div>`:nothing}
   ${g.days?html`<p>Gregorian calendar; timezone: ${temporalField?.type.temporal?.timezone??'civil dates'}. Weeks start on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][g.weekStartsOn!]}. Missing dates appear only in the data table. Counts below are loaded rows per day.</p><div part="viewport" tabindex="0" role="region" aria-label=${`${this.label}: scrollable graphic`}><div class="days">${g.days.map((day,index)=>html`<section class="day" style=${index===0?`grid-column-start:${(day.weekday-g.weekStartsOn!+7)%7+1}`:''}><strong>${day.date}</strong><span>${day.rows.length} loaded rows</span>${day.rows.slice(0,3).map(row=>html`<span>${displayLabel(row)}${spec.view==='calendar-grid'&&spec.value?`: ${exactLabel(row.values[spec.value]!)}`:''}</span>`)}${day.rows.length>3?html`<span>${day.rows.length-3} additional rows in the data table.</span>`:nothing}${day.rows.length===1?html`<button type="button" aria-label=${`Select ${rowLabel(day.rows[0]!)}`} @click=${()=>select(day.rows[0]!)}>Select</button>`:nothing}</section>`)}</div></div>`:nothing}
   <div part="data" tabindex="0" role="region" aria-label=${`${this.label}: scrollable data`}><table><caption>${this.label}: ${result.precision.kind==='exact'?'exact':'approximate'} loaded values</caption><thead><tr><th scope="col">Select</th>${fields.map(f=>html`<th scope="col">${f.label}${f.type.unit?` (${f.type.unit.symbol})`:''}</th>`)}</tr></thead><tbody>${repeat(g.rows.slice(page*25,page*25+25),row=>row.identity,row=>html`<tr><td><button type="button" aria-label=${`Select ${rowLabel(row)}`} @click=${()=>select(row)}>Select</button></td>${fields.map(f=>html`<td>${exactLabel(row.values[f.id]!)}</td>`)}</tr>`)}</tbody></table></div>
   ${g.rows.length>25?html`<nav aria-label="Visualization data pages"><button type="button" ?disabled=${page===0} @click=${()=>{this.page=page-1;}}>Previous</button><span>Rows ${page*25+1}–${Math.min((page+1)*25,g.rows.length)} of ${g.rows.length}</span><button type="button" ?disabled=${(page+1)*25>=g.rows.length} @click=${()=>{this.page=page+1;}}>Next</button></nav>`:nothing}
  </figure>`;
 }
}
export class AeliqoMatrixElement extends AeliqoTemporalElement {protected override readonly view='matrix' as const;}
export class AeliqoTimelineElement extends AeliqoTemporalElement {protected override readonly view='timeline' as const;}
export class AeliqoCalendarGridElement extends AeliqoTemporalElement {protected override readonly view='calendar-grid' as const;}
export function defineTemporalElements():void {for(const [tag,element] of [['aeliqo-matrix',AeliqoMatrixElement],['aeliqo-timeline',AeliqoTimelineElement],['aeliqo-calendar-grid',AeliqoCalendarGridElement]] as const)if(!customElements.get(tag))customElements.define(tag,element);}
