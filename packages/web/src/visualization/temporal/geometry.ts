import {bindVisualizationSpec, compareScalars} from '@aeliqo/sdk-core';
import type {Outcome, Result, Scalar, SemanticType} from '@aeliqo/sdk-core';
import {materializeVisualizationRows} from '../materialization.js';
import type {VisualizationInputs, VisualizationRow} from '../types.js';
import {makePlotScale,type PlotTick} from '../../plot/scales.js';
export interface TimelineMark {readonly identity:string;readonly x:number;readonly end:number;readonly lane:number}
export interface CalendarDay {readonly date:string;readonly weekday:number;readonly rows:readonly VisualizationRow[]}
export interface TemporalGeometry {
 readonly view:'matrix'|'timeline'|'calendar-grid';readonly result:Result;readonly rows:readonly VisualizationRow[];readonly columns:readonly string[];
 readonly width:number;readonly height:number;readonly state:'ready'|'data-only';readonly reason?:string;
 readonly timeline?:readonly TimelineMark[];readonly ticks?:readonly PlotTick[];readonly days?:readonly CalendarDay[];readonly weekStartsOn?:number;
}
const fail=(message:string):Outcome<never>=>({ok:false,diagnostics:[{code:'visualization.temporal',message,retryable:false}]});
/** The calendar draws Gregorian civil days. Other declared calendars retain exact data. */
function civilDay(value:Scalar,type:SemanticType,formatter:Intl.DateTimeFormat|undefined):string|undefined {
 if(value===null)return undefined;
 if(type.value==='date')return String(value);
 const parts=formatter!.formatToParts(new Date(String(value)));
 const part=(name:string)=>parts.find(p=>p.type===name)?.value;
 if(part('era')!=='AD')throw Error('The calendar date is outside the supported civil range.');
 return `${part('year')!.padStart(4,'0')}-${part('month')}-${part('day')}`;
}
export function compileTemporalVisualization(input:VisualizationInputs):Outcome<TemporalGeometry> {
 const bound=bindVisualizationSpec(input.visualization,input.context);if(!bound.ok)return bound;
 const spec=bound.value.spec;
 if(spec.view!=='matrix'&&spec.view!=='timeline'&&spec.view!=='calendar-grid')return fail('This renderer requires a matrix, timeline or calendar specification.');
 const materialized=materializeVisualizationRows(bound.value,spec.result,input.datasets);if(!materialized.ok)return materialized;
 const result=bound.value.results[0]!;const rows=materialized.value;
 if(!Number.isFinite(input.width)||!Number.isFinite(input.height)||input.width<160||input.height<120||input.width*input.height>4_000_000||!Number.isInteger(input.maxMarks)||input.maxMarks<1||input.maxMarks>50_000)return fail('Visualization dimensions or mark budget are outside supported limits.');
 const base:TemporalGeometry={view:spec.view,result,rows,columns:spec.view==='matrix'?spec.columns:result.fields.map(f=>f.id),width:input.width,height:input.height,state:'ready'};
 if(spec.view==='matrix')return {ok:true,value:base};
 const field=result.fields.find(f=>f.id===(spec.view==='timeline'?spec.start:spec.date))!;
 const dataOnly=(reason:string):Outcome<TemporalGeometry>=>({ok:true,value:{...base,state:'data-only',reason}});
 if(!['gregory','gregorian','iso8601'].includes(field.type.temporal!.calendar))return dataOnly('This calendar is not supported visually; the declared dates remain in the data table.');
 if(spec.view==='timeline') {
  const intervals:{row:VisualizationRow;start:Scalar;end:Scalar}[]=[];
  for(const row of rows){const start=row.values[spec.start]!;const end=spec.end?row.values[spec.end]!:start;
   if(start===null||end===null)continue;
   const ordered=compareScalars(start,end,field.type);if(!ordered.ok)return ordered;if(ordered.value===null||ordered.value>0)return fail('Timeline interval ends must not precede their starts.');
   intervals.push({row,start,end});
  }
  if(intervals.length>Math.min(input.maxMarks,1000))return dataOnly('Timeline mark budget exceeded; all loaded intervals remain in the data table.');
  const compare=(a:Scalar,b:Scalar):number=>{const c=compareScalars(a,b,field.type);if(!c.ok||c.value===null)throw Error('Unordered timeline');return c.value;};
  intervals.sort((a,b)=>compare(a.start,b.start)||compare(a.end,b.end)||(a.row.identity < b.row.identity ? -1 : a.row.identity > b.row.identity ? 1 : 0));
  try {
   const scale=makePlotScale({field:field.id,scale:'temporal'},field.type,intervals.flatMap(i=>[i.start,i.end]),[24,input.width-24]);
   const ends:Scalar[]=[];const marks:TimelineMark[]=[];let work=0;
   for(const interval of intervals){let lane=-1;for(let index=0;index<ends.length;index++){if(++work>100_000)return dataOnly('Timeline lane calculation exceeds the work budget; all intervals remain in the data table.');if(compare(ends[index]!,interval.start)<0){lane=index;break;}}if(lane<0)lane=ends.length;ends[lane]=interval.end;
    if((lane+1)*28>input.height-40)return dataOnly('Overlapping intervals exceed the visible lane budget; all intervals remain in the data table.');
    marks.push({identity:interval.row.identity,x:scale.at(interval.start)!,end:scale.at(interval.end)!,lane});
   }
   return {ok:true,value:{...base,timeline:marks,ticks:scale.ticks}};
  }catch{return dataOnly('These temporal values cannot be represented safely as geometry; exact values remain in the data table.');}
 }
 try {
  const formatter=field.type.value==='instant'?new Intl.DateTimeFormat('en-US',{calendar:'gregory',timeZone:field.type.temporal!.timezone,year:'numeric',month:'2-digit',day:'2-digit',era:'short'}):undefined;
  const grouped=new Map<string,VisualizationRow[]>();
  for(const row of rows){const day=civilDay(row.values[spec.date]!,field.type,formatter);if(day!==undefined){const group=grouped.get(day)??[];group.push(row);grouped.set(day,group);}}
  const dates=[...grouped.keys()].sort();const first=dates[0];const last=dates.at(-1);const weekStartsOn=spec.weekStartsOn??1;
  if(!first||!last)return {ok:true,value:{...base,days:[],weekStartsOn}};
  const start=Date.parse(`${first}T00:00:00Z`);const end=Date.parse(`${last}T00:00:00Z`);const count=Math.round((end-start)/86_400_000)+1;
  if(!Number.isFinite(count)||count<1||count>Math.min(input.maxMarks,366))return dataOnly('Calendar span exceeds the day budget; all loaded dates remain in the data table.');
  const days:CalendarDay[]=[];
  for(let n=0;n<count;n++){const date=new Date(start+n*86_400_000);const key=date.toISOString().slice(0,10);days.push({date:key,weekday:date.getUTCDay(),rows:grouped.get(key)??[]});}
  return {ok:true,value:{...base,days,weekStartsOn}};
 }catch{return dataOnly('The declared timezone or date is not supported visually; exact dates remain in the data table.');}
}
