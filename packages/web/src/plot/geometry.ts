import {line,area} from 'd3-shape';
import {bindPlotSpec,parseWireValue,scalarIdentity,validateScalar,compareScalars} from '@aeliqo/core';
import type {PlotUnit,Result,Scalar,Outcome} from '@aeliqo/core';
import {makePlotScale,exactLabel} from './scales.js';
import type {PlotScale} from './scales.js';

export interface PlotRow {readonly [field:string]:Scalar}
export interface PlotDatum {readonly identity:string;readonly values:PlotRow}
export type PlotMark =
 | {readonly kind:'point';readonly x:number;readonly y:number;readonly radius:number;readonly series:string;readonly identity:string}
 | {readonly kind:'rect';readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly series:string;readonly identity:string}
 | {readonly kind:'path';readonly path:string;readonly filled:boolean;readonly series:string;readonly identities:readonly string[]};
export interface PlotGeometry {
 readonly width:number;readonly height:number;
 readonly state:'plot'|'data-only';readonly reason?:string;
 readonly marks:readonly PlotMark[];readonly rows:readonly PlotDatum[];
 readonly axes?:{readonly x:PlotScale;readonly y:PlotScale;readonly xLabel:string;readonly yLabel:string};
 readonly series:readonly string[];readonly legend:readonly {readonly id:string;readonly label:string}[];readonly result:Result;
}
export interface PlotProjection {
 readonly identities?:readonly string[];
 readonly domains?:{readonly x:readonly Scalar[];readonly y:readonly Scalar[]};
}
export interface PlotGeometryOptions {readonly width:number;readonly height:number;readonly maxRows:number;readonly maxMarks:number}
const fail=(code:string,message:string):Outcome<never>=>({ok:false,diagnostics:[{code:`plot.${code}`,message,retryable:false}]});
/** Bounded realization. Over-budget data returns a diagnostic; observations are never silently dropped. */
export function compilePlotUnit(unit:PlotUnit,result:Result,inputRows:unknown,options:PlotGeometryOptions,projection:PlotProjection={}):Outcome<PlotGeometry> {
 const {width,height,maxRows,maxMarks}=options;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<160||height<120||width>8192||height>8192||width*height>4_000_000||
    !Number.isSafeInteger(maxRows)||maxRows<1||maxRows>10_000||!Number.isSafeInteger(maxMarks)||maxMarks<1||maxMarks>50_000)
   return fail('budget','The plot dimensions or geometry budget are unsupported.');
 const bound=bindPlotSpec({version:'1',root:unit},[result]);if(!bound.ok)return bound;
 const normalizedUnit=bound.value.units[0]!.node;
 const descriptor=bound.value.units[0]!.result;
 const inspected=parseWireValue(inputRows);if(!inspected.ok)return inspected;
 const rows=inspected.value;
 if(!Array.isArray(rows)||rows.length>maxRows)return fail('rows','The plot exceeds the loaded-row budget.');
 if(rows.length*descriptor.fields.length>100_000)return fail('cell-budget','The loaded data exceeds the bounded cell budget.');
 if(rows.length!==descriptor.counts.loaded)return fail('scope','The supplied rows do not match the descriptor loaded count.');
 if(descriptor.identity.length===0)return fail('identity','Interactive plots require stable result identities.');
 const fields=new Map(descriptor.fields.map(f=>[f.id,f]));
 const data:PlotDatum[]=[];const keys=new Set<string>();
 for(const row of rows){
   if(row===null||typeof row!=='object'||Array.isArray(row))return fail('row','A plot row must be a record.');
   if(Object.keys(row).some(key=>!fields.has(key)))return fail('row-field','A plot row contains a field outside the authorized descriptor.');
   const values:Record<string,Scalar>=Object.create(null) as Record<string,Scalar>;
   for(const field of descriptor.fields){
     const raw=(row as Record<string,unknown>)[field.id];
     const value=validateScalar(raw===undefined&&field.type.nullable?null:raw,field.type);
     if(!value.ok)return value;values[field.id]=value.value;
   }
   const identityParts:string[]=[];
   for(const fieldId of descriptor.identity){
     const field=fields.get(fieldId);if(field===undefined)return fail('identity','An identity field is missing.');
     if(values[fieldId]===null)return fail('identity','Identity values cannot be missing.');
     const identity=scalarIdentity(values[fieldId],field.type);if(!identity.ok)return identity;identityParts.push(identity.value);
   }
   const identity=JSON.stringify(identityParts);if(keys.has(identity))return fail('identity','Plot row identities must be unique.');
   keys.add(identity);data.push({identity,values});
 }
 if(projection.identities&&(projection.identities.length>maxRows||projection.identities.some(id=>!keys.has(id))))return fail('projection','The display projection references unavailable rows.');
 if(projection.domains&&(projection.domains.x.length>10_000||projection.domains.y.length>10_000))return fail('domain-budget','The display scale domain exceeds its value budget.');
 const displayKeys=projection.identities?new Set(projection.identities):undefined;
 const displayed=displayKeys?data.filter(d=>displayKeys.has(d.identity)):data;
 const dataOnly=(reason:string):Outcome<PlotGeometry>=>({ok:true,value:{state:'data-only',reason,width,height,marks:[],rows:data,series:[],legend:[],result:descriptor}});
 const e=normalizedUnit.encoding;
 const label=(id:string)=>{const f=fields.get(id)!;return `${f.label}${f.type.unit?` (${f.type.unit.symbol})`:''}`;};
 try {
  const x=makePlotScale(e.x,fields.get(e.x.field)!.type,projection.domains?.x??displayed.flatMap(d=>[d.values[e.x.field]!,...(e.x2?[d.values[e.x2.field]!]:[])]),[64,width-24]);
  const y=makePlotScale(e.y,fields.get(e.y.field)!.type,projection.domains?.y??displayed.flatMap(d=>[d.values[e.y.field]!,...(e.y2?[d.values[e.y2.field]!]:[])]),[height-48,24]);
  if(e.size&&normalizedUnit.mark!=='point'&&normalizedUnit.mark!=='line')return dataOnly('Size is supported only for point marks.');
  if((e.x2||e.y2)&&normalizedUnit.mark!=='rect'&&normalizedUnit.mark!=='link')return dataOnly('Second endpoints require rect or link marks.');
  const series=new Map<string,PlotDatum[]>();
  const legend=new Map<string,string>();
  for(const d of displayed){
    const parts:string[]=[];
    for(const encoding of [e.series,e.color])if(encoding){
      const identity=scalarIdentity(d.values[encoding.field],fields.get(encoding.field)!.type);
      if(!identity.ok)return identity;parts.push(identity.value);
    }
    const id=JSON.stringify(parts);
    legend.set(id,[e.series,e.color].filter(v=>v!==undefined).map(v=>`${fields.get(v.field)!.label}: ${exactLabel(d.values[v.field]!)}`).join(', '));
    const group=series.get(id)??[];group.push(d);series.set(id,group);
  }
  if(series.size>12)return dataOnly('The plot exceeds 12 distinguishable series; use the data view.');
  // Quantitative color and size require explicit legend geometry; never silently ignore them.
  if(e.color&&e.color.scale!=='ordinal')return dataOnly('This realization requires ordinal color encoding.');
  const size=e.size?makePlotScale(e.size,fields.get(e.size.field)!.type,displayed.map(d=>d.values[e.size!.field]!),[3,12]):undefined;
  const marks:PlotMark[]=[];
  const px=(d:PlotDatum)=>x.at(d.values[e.x.field]!);
  const py=(d:PlotDatum)=>y.at(d.values[e.y.field]!);
  for(const [groupId,group] of series){
    const defined=(d:PlotDatum)=>px(d)!==undefined&&py(d)!==undefined;
    if(normalizedUnit.mark==='line'||normalizedUnit.mark==='area'){
      if(e.x.scale!=='ordinal'){
        let previous:Scalar=null;
        for(const d of group){if(!defined(d)){previous=null;continue;}const current=d.values[e.x.field]!;
          if(previous!==null){const order=compareScalars(previous,current,fields.get(e.x.field)!.type);if(!order.ok||order.value===null||order.value>0)return dataOnly('Line and area observations must be ordered by x; missing values remain gaps.');}
          previous=current;
        }
      }
      const zero=fields.get(e.y.field)!.type.value==='decimal'?{decimal:'0'}:0;
      const path=normalizedUnit.mark==='line'
        ?line<PlotDatum>().defined(defined).x(d=>px(d)!).y(d=>py(d)!)(group)
        :area<PlotDatum>().defined(defined).x(d=>px(d)!).y0(y.at(zero)!).y1(d=>py(d)!)(group);
      if(path)marks.push({kind:'path',path,filled:normalizedUnit.mark==='area',series:groupId,identities:group.filter(defined).map(d=>d.identity)});
    }
    for(const d of group){
      const x0=px(d),y0=py(d);if(x0===undefined||y0===undefined)continue;
      if(normalizedUnit.mark==='point'||normalizedUnit.mark==='line'){
        const radius=size?.at(d.values[e.size!.field]!)??3;
        marks.push({kind:'point',x:x0,y:y0,radius,series:groupId,identity:d.identity});
      } else if(normalizedUnit.mark==='bar'||normalizedUnit.mark==='cell'){
        const zero=fields.get(e.y.field)!.type.value==='decimal'?{decimal:'0'}:0;
        const baseline=normalizedUnit.mark==='bar'?y.at(zero)!:y0+6;
        const barWidth=Math.max(1,Math.min(28,(width-88)/Math.max(1,displayed.length)*0.7));
        marks.push({kind:'rect',x:x0-barWidth/2,y:Math.min(y0,baseline),width:barWidth,height:Math.max(1,Math.abs(baseline-y0)),series:groupId,identity:d.identity});
      } else if(normalizedUnit.mark==='rect'||normalizedUnit.mark==='link'){
        const x1=x.at(d.values[e.x2!.field]!),y1=y.at(d.values[e.y2!.field]!);if(x1===undefined||y1===undefined)continue;
        if(normalizedUnit.mark==='rect')marks.push({kind:'rect',x:Math.min(x0,x1),y:Math.min(y0,y1),width:Math.abs(x1-x0),height:Math.abs(y1-y0),series:groupId,identity:d.identity});
        else marks.push({kind:'path',path:line()([[x0,y0],[x1,y1]])!,filled:false,series:groupId,identities:[d.identity]});
      }
    }
  }
  const geometryCost=marks.reduce((n,m)=>n+(m.kind==='path'?m.identities.length:1),0);
  if(geometryCost>maxMarks)return dataOnly('The exact geometry exceeds the mark budget.');
  return {ok:true,value:{state:'plot',width,height,marks,rows:data,axes:{x,y,xLabel:label(e.x.field),yLabel:label(e.y.field)},series:[...series.keys()],legend:[...legend].map(([id,label])=>({id,label})),result:descriptor}};
 }catch{return dataOnly('The scale cannot safely represent these observations. Exact values are available below.');}
}
