import {line,area} from 'd3-shape';
import {bindPlotSpec,parseWireValue,scalarIdentity,validateScalar,compareScalars} from '@aeliqo/sdk-core';
import type {PlotUnit,Result,Scalar,Outcome} from '@aeliqo/sdk-core';
import {makePlotScale,exactLabel} from './scales.js';
import type {PlotScale,PlotTick} from './scales.js';
import {quantitativeColor} from './palette.js';

export interface PlotRow {readonly [field:string]:Scalar}
export interface PlotDatum {readonly identity:string;readonly values:PlotRow}
export type PlotMark =
 | {readonly kind:'point';readonly x:number;readonly y:number;readonly radius:number;readonly series:string;readonly identity:string;readonly color?:string}
 | {readonly kind:'rect';readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly series:string;readonly identity:string;readonly color?:string}
 | {readonly kind:'path';readonly path:string;readonly filled:boolean;readonly series:string;readonly identities:readonly string[];readonly color?:string};
export interface PlotGeometry {
 readonly width:number;readonly height:number;
 readonly state:'plot'|'data-only';readonly reason?:string;
 readonly marks:readonly PlotMark[];readonly rows:readonly PlotDatum[];
 readonly axes?:{readonly x:PlotScale;readonly y:PlotScale;readonly xLabel:string;readonly yLabel:string};
 readonly colorField?:string;readonly colorTicks?:readonly PlotTick[];
 readonly series:readonly string[];readonly legend:readonly {readonly id:string;readonly label:string}[];readonly result:Result;
}
export interface PlotProjection {
 readonly identities?:readonly string[];
 readonly domains?:{readonly x:readonly Scalar[];readonly y:readonly Scalar[]};
}
export interface PlotGeometryOptions {
 readonly width:number;readonly height:number;readonly maxRows:number;readonly maxMarks:number;
 /** Family-only geometry semantics. The ordinary plot surface leaves this unset. */
 readonly family?:'area'|'histogram'|'heatmap'|'trend'|'bar'|'scatter';
 readonly stack?:'none'|'zero';
}
const fail=(code:string,message:string):Outcome<never>=>({ok:false,diagnostics:[{code:`plot.${code}`,message,retryable:false}]});
/** Bounded realization. Over-budget data returns a diagnostic; observations are never silently dropped. */
export function compilePlotUnit(unit:PlotUnit,result:Result,inputRows:unknown,options:PlotGeometryOptions,projection:PlotProjection={}):Outcome<PlotGeometry> {
 const {width,height,maxRows,maxMarks,family,stack}=options;
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
     const raw=Object.hasOwn(row,field.id)?(row as Record<string,unknown>)[field.id]:undefined;
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
  if(e.size&&normalizedUnit.mark!=='point'&&normalizedUnit.mark!=='line')return dataOnly('Size is supported only for point marks.');
  if((e.x2||e.y2)&&normalizedUnit.mark!=='rect'&&normalizedUnit.mark!=='link')return dataOnly('Second endpoints require rect or link marks.');
  const colorScale=e.color&&e.color.scale!=='ordinal'
    ? makePlotScale(e.color,fields.get(e.color.field)!.type,displayed.map(d=>d.values[e.color!.field]!),[0,1])
    : undefined;
  if(e.color&&e.color.scale!=='ordinal'&&['line','area'].includes(normalizedUnit.mark))return dataOnly('Quantitative color is not representable on a single line or area path. Use an ordinal series or the exact data table.');
  if(e.color&&e.color.scale!=='ordinal'&&displayed.some(d=>d.values[e.color!.field]===null))return dataOnly('Quantitative color requires a value for every displayed mark.');
  const colorAt=(value:Scalar):string|undefined=>{
    if(colorScale===undefined||value===null)return undefined;
    const position=colorScale.at(value);if(position===undefined)return undefined;
    const first=colorScale.ticks[0]?.position??0;const last=colorScale.ticks[colorScale.ticks.length-1]?.position??1;
    const ratio=last===first?0.5:Math.min(1,Math.max(0,(position-first)/(last-first)));
    return quantitativeColor(ratio);
  };
  const series=new Map<string,PlotDatum[]>();
  const legend=new Map<string,string>();
  for(const d of displayed){
    const parts:string[]=[];
    for(const encoding of [e.series, ...(e.color?.scale==='ordinal'?[e.color]:[])] )if(encoding){
      const identity=scalarIdentity(d.values[encoding.field],fields.get(encoding.field)!.type);
      if(!identity.ok)return identity;parts.push(identity.value);
    }
    const id=JSON.stringify(parts);
    legend.set(id,[e.series, ...(e.color?.scale==='ordinal'?[e.color]:[])].filter(v=>v!==undefined).map(v=>`${fields.get(v.field)!.label}: ${exactLabel(d.values[v.field]!)}`).join(', '));
    const group=series.get(id)??[];group.push(d);series.set(id,group);
  }
  if(series.size>12)return dataOnly('The plot exceeds 12 distinguishable series; use the data view.');
  if(family!==undefined){
    const requiredFields=[e.x.field,e.y.field,...(e.x2?[e.x2.field]:[]),...(e.y2?[e.y2.field]:[]),...(family==='heatmap'&&e.color?[e.color.field]:[])];
    for(const datum of data){
      const missing=requiredFields.some(field=>datum.values[field]===null||datum.values[field]===undefined);
      const allowedGap=(family==='trend'||family==='area')&&datum.values[e.x.field]!==null&&datum.values[e.x.field]!==undefined
        &&datum.values[e.y.field]===null;
      if(missing&&!allowedGap)return dataOnly('A Cartesian mark requires non-missing encoded dimensions and measures.');
    }
  }
  const yType=fields.get(e.y.field)!.type;
  const zero=yType.value==='decimal'?{decimal:'0'}:0;
  const numericValue=(value:Scalar):number=>{
    if(value===null)throw Error('Missing numeric value');
    const number=typeof value==='object'?Number(value.decimal):Number(value);
    if(!Number.isFinite(number))throw Error('Numeric value is not finite');
    return number;
  };
  const decimalParts=(value:string):{coefficient:bigint;scale:number}=>{
    const [whole,fraction='']=value.split('.');return {coefficient:BigInt(`${whole}${fraction}`),scale:fraction.length};
  };
  const decimalText=(coefficient:bigint,scale:number):string=>{
    const negative=coefficient<0n;const absolute=(negative?-coefficient:coefficient).toString();
    if(scale===0)return `${negative?'-':''}${absolute}`;
    const padded=absolute.padStart(scale+1,'0');const point=padded.length-scale;
    const fraction=padded.slice(point).replace(/0+$/u,'');
    return `${negative?'-':''}${padded.slice(0,point)}${fraction?`.${fraction}`:''}`;
  };
  const addNumeric=(left:Scalar,right:Scalar):Scalar=>{
    if(yType.value==='decimal'){
      const a=decimalParts((left as {decimal:string}).decimal),b=decimalParts((right as {decimal:string}).decimal);
      const scale=Math.max(a.scale,b.scale);
      return {decimal:decimalText(a.coefficient*10n**BigInt(scale-a.scale)+b.coefficient*10n**BigInt(scale-b.scale),scale)};
    }
    const sum=numericValue(left)+numericValue(right);
    if(!Number.isFinite(sum)||(yType.value==='integer'&&!Number.isSafeInteger(sum)))throw Error('Stacked area exceeds numeric bounds');
    return sum;
  };
  const stackCoordinates=new Map<string,{readonly baseline:Scalar;readonly top:Scalar}>();
  const stackExtras:Scalar[]=[];
  if(normalizedUnit.mark==='area'&&stack==='zero'){
    if(e.series===undefined)return dataOnly('Stacked areas require an explicit series dimension.');
    const offsets=new Map<string,{positive:Scalar;negative:Scalar}>();
    let cohort: Set<string>|undefined;
    for(const group of series.values()){
      const seenX=new Set<string>();
      for(const datum of group){
        const value=datum.values[e.y.field];
        const xIdentity=scalarIdentity(datum.values[e.x.field]!,fields.get(e.x.field)!.type);
        if(!xIdentity.ok)return xIdentity;
        if(seenX.has(xIdentity.value))return dataOnly('Stacked area series must contain one value per temporal grain.');
        seenX.add(xIdentity.value);
        if(value===null||value===undefined)continue;
        const existing=offsets.get(xIdentity.value)??{positive:zero,negative:zero};
        const sign=compareScalars(value,zero,yType);if(!sign.ok||sign.value===null)return dataOnly('Stacked area magnitudes must be ordered numeric values.');
        const negative=sign.value<0;
        const baseline=negative?existing.negative:existing.positive;
        const top=addNumeric(baseline,value);
        stackCoordinates.set(datum.identity,{baseline,top});
        offsets.set(xIdentity.value,negative?{positive:existing.positive,negative:top}:{positive:top,negative:existing.negative});
        stackExtras.push(top);
      }
      if(cohort===undefined)cohort=seenX;else if(cohort.size!==seenX.size||[...cohort].some(key=>!seenX.has(key)))return dataOnly('Stacked area series must share the same temporal cohorts.');
    }
  }
  if(family==='histogram'){
    const startType=fields.get(e.x.field)!.type;
    const valueType=fields.get(e.y.field)!.type;
    const baselineType=fields.get(e.y2!.field)!.type;
    let previousStart:Scalar|undefined;
    let previousEnd:Scalar|undefined;
    for(const datum of data){
      const start=datum.values[e.x.field]!,end=datum.values[e.x2!.field]!,value=datum.values[e.y.field]!,baseline=datum.values[e.y2!.field]!;
      if(start===null||end===null||value===null||baseline===null)return dataOnly('Histogram bins require non-missing endpoints, values and a zero baseline.');
      const positive=compareScalars(start,end,startType);if(!positive.ok||positive.value===null||positive.value>=0)return dataOnly('Histogram bins must have positive width.');
      const zeroBaseline=compareScalars(baseline,zero,baselineType);if(!zeroBaseline.ok||zeroBaseline.value!==0)return dataOnly('Histogram bins must use an explicit zero baseline.');
      const nonnegative=compareScalars(value,zero,valueType);if(!nonnegative.ok||nonnegative.value===null||nonnegative.value<0)return dataOnly('Histogram counts and densities cannot be negative.');
      if(previousStart!==undefined){const ordered=compareScalars(previousStart,start,startType);if(!ordered.ok||ordered.value===null||ordered.value>=0)return dataOnly('Histogram bins must be ordered without duplicate starts.');}
      if(previousEnd!==undefined){const disjoint=compareScalars(previousEnd,start,startType);if(!disjoint.ok||disjoint.value===null||disjoint.value>0)return dataOnly('Histogram bins must not overlap.');}
      previousStart=start;previousEnd=end;
    }
  }
  const yDomain=projection.domains?.y===undefined
    ? displayed.flatMap(d=>[d.values[e.y.field]!,...(e.y2?[d.values[e.y2.field]!]:[])])
    : [...projection.domains.y];
  if(stackExtras.length>0)yDomain.push(...stackExtras);
  const y=makePlotScale(e.y,yType,yDomain,[height-48,24]);
  const needsZero=['bar','area','histogram'].includes(family??'')||normalizedUnit.mark==='bar'||normalizedUnit.mark==='area';
  const zeroY=needsZero?y.at(zero):undefined;
  if(needsZero&&zeroY===undefined)return dataOnly('The quantitative scale cannot represent its required zero baseline.');
  const baselineY=zeroY??0;
  // Quantitative color and size require explicit legend geometry; never silently ignore them.
  const size=e.size?makePlotScale(e.size,fields.get(e.size.field)!.type,displayed.map(d=>d.values[e.size!.field]!),[3,12]):undefined;
  const minStep=(positions:readonly number[],fallback:number):number=>{
    const sorted=[...positions].sort((a,b)=>a-b);let step=Number.POSITIVE_INFINITY;
    for(let index=1;index<sorted.length;index+=1)step=Math.min(step,sorted[index]!-(sorted[index-1]!));
    return Number.isFinite(step)&&step>0?step:fallback;
  };
  const actualXPositions=[...new Set(displayed.map(d=>x.at(d.values[e.x.field]!)).filter((position):position is number=>position!==undefined))];
  const actualYPositions=[...new Set(displayed.map(d=>y.at(d.values[e.y.field]!)).filter((position):position is number=>position!==undefined))];
  const cellWidth=Math.max(1,Math.min(160,minStep(actualXPositions,(width-88)/Math.max(1,actualXPositions.length))*0.9));
  const cellHeight=Math.max(1,Math.min(96,minStep(actualYPositions,(height-72)/Math.max(1,actualYPositions.length))*0.9));
  const cellKeys=new Set<string>();
  const barLayout=new Map<string,{readonly center:number;readonly width:number}>();
  if(normalizedUnit.mark==='bar'){
    const byX=new Map<string,{readonly group:string;readonly datum:PlotDatum}[]>();
    for(const [groupId,group] of series)for(const datum of group){
      const identity=scalarIdentity(datum.values[e.x.field]!,fields.get(e.x.field)!.type);
      if(!identity.ok)return identity;
      const entries=byX.get(identity.value)??[];
      if(entries.some(entry=>entry.group===groupId))return dataOnly('Bar rows must contain one value per x and series grain.');
      entries.push({group:groupId,datum});byX.set(identity.value,entries);
    }
    const xStep=minStep([...byX.values()].map(entries=>x.at(entries[0]!.datum.values[e.x.field]!)!).filter((position):position is number=>position!==undefined),0);
    if(byX.size>1&&xStep<1)return dataOnly('Bar categories are too dense for distinct marks at this width; exact data is available below.');
    for(const entries of byX.values()){
      const capacity=byX.size>1?xStep*0.8:Math.min(28,(width-88)/Math.max(1,displayed.length)*0.7);
      const barWidth=Math.min(28,capacity/entries.length);
      if(!Number.isFinite(barWidth)||barWidth<1)return dataOnly('Bar groups are too dense for distinct marks at this width; exact data is available below.');
      const center=x.at(entries[0]!.datum.values[e.x.field]!);
      if(center===undefined)return dataOnly('A bar category has no display position.');
      const start=center-(barWidth*entries.length)/2+barWidth/2;
      entries.forEach((entry,index)=>barLayout.set(entry.datum.identity,{center:start+index*barWidth,width:barWidth}));
    }
  }
  const marks:PlotMark[]=[];
  const px=(d:PlotDatum)=>x.at(d.values[e.x.field]!);
  const py=(d:PlotDatum)=>y.at(d.values[e.y.field]!);
  const xPosition=(d:PlotDatum):number=>{const position=px(d);if(position===undefined)throw Error('Missing x position');return position;};
  const yPosition=(d:PlotDatum):number=>{const position=py(d);if(position===undefined)throw Error('Missing y position');return position;};
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
      const path=normalizedUnit.mark==='line'
        ?line<PlotDatum>().defined(defined).x(d=>px(d)!).y(yPosition)(group)
        :stack==='zero'
          ?area<PlotDatum>().defined(d=>defined(d)&&stackCoordinates.has(d.identity)).x(d=>px(d)!)
            .y0(d=>y.at(stackCoordinates.get(d.identity)!.baseline)!)
            .y1(d=>y.at(stackCoordinates.get(d.identity)!.top)!)(group)
          :area<PlotDatum>().defined(defined).x(xPosition).y0(baselineY).y1(yPosition)(group);
      if(path)marks.push({kind:'path',path,filled:normalizedUnit.mark==='area',series:groupId,identities:group.filter(defined).map(d=>d.identity)});
    }
    for(const d of group){
      const x0=px(d),y0=py(d);if(x0===undefined||y0===undefined)continue;
      const markColor=colorAt(d.values[e.color?.field ?? e.y.field]!);
      if(normalizedUnit.mark==='point'||normalizedUnit.mark==='line'){
        const radius=size?.at(d.values[e.size!.field]!)??3;
        marks.push({kind:'point',x:x0,y:y0,radius,series:groupId,identity:d.identity,...(markColor===undefined?{}:{color:markColor})});
      } else if(normalizedUnit.mark==='bar'||normalizedUnit.mark==='cell'){
        const zero=fields.get(e.y.field)!.type.value==='decimal'?{decimal:'0'}:0;
        const baseline=normalizedUnit.mark==='bar'?y.at(zero)!:y0;
        const layout=normalizedUnit.mark==='bar'?barLayout.get(d.identity):undefined;
        const barWidth=layout?.width??Math.max(1,Math.min(28,(width-88)/Math.max(1,displayed.length)*0.7));
        const markX=layout?.center??x0;
        if(normalizedUnit.mark==='cell'){
          const xIdentity=scalarIdentity(d.values[e.x.field]!,fields.get(e.x.field)!.type);
          const yIdentity=scalarIdentity(d.values[e.y.field]!,fields.get(e.y.field)!.type);
          if(!xIdentity.ok)return xIdentity;if(!yIdentity.ok)return yIdentity;
          const cellKey=JSON.stringify([xIdentity.value,yIdentity.value]);
          if(cellKeys.has(cellKey))return dataOnly('Heatmap rows must contain one value per dimension pair.');
          cellKeys.add(cellKey);
          marks.push({kind:'rect',x:x0-cellWidth/2,y:y0-cellHeight/2,width:cellWidth,height:cellHeight,series:groupId,identity:d.identity,...(markColor===undefined?{}:{color:markColor})});
        } else {
          marks.push({kind:'rect',x:markX-barWidth/2,y:Math.min(y0,baseline),width:barWidth,height:Math.max(1,Math.abs(baseline-y0)),series:groupId,identity:d.identity,...(markColor===undefined?{}:{color:markColor})});
        }
      } else if(normalizedUnit.mark==='rect'||normalizedUnit.mark==='link'){
        const x1=x.at(d.values[e.x2!.field]!),y1=y.at(d.values[e.y2!.field]!);if(x1===undefined||y1===undefined)continue;
        if(normalizedUnit.mark==='rect')marks.push({kind:'rect',x:Math.min(x0,x1),y:Math.min(y0,y1),width:Math.abs(x1-x0),height:Math.abs(y1-y0),series:groupId,identity:d.identity,...(markColor===undefined?{}:{color:markColor})});
        else marks.push({kind:'path',path:line()([[x0,y0],[x1,y1]])!,filled:false,series:groupId,identities:[d.identity],...(markColor===undefined?{}:{color:markColor})});
      }
    }
  }
  if(displayed.length===0||marks.length===0)return dataOnly(displayed.length===0?'No displayed observations are available for the requested plot partition.':'No plottable observations are available; exact values are shown below.');
  const geometryCost=marks.reduce((n,m)=>n+(m.kind==='path'?m.identities.length:1),0);
  if(geometryCost>maxMarks)return dataOnly('The exact geometry exceeds the mark budget.');
  const colorPresentation=e.color&&e.color.scale!=='ordinal'&&colorScale!==undefined
    ? {colorField:e.color.field,colorTicks:colorScale.ticks}
    : {};
  return {ok:true,value:{state:'plot',width,height,marks,rows:data,axes:{x,y,xLabel:label(e.x.field),yLabel:label(e.y.field)},...colorPresentation,series:[...series.keys()],legend:[...legend].map(([id,label])=>({id,label})),result:descriptor}};
 }catch{return dataOnly('The scale cannot safely represent these observations. Loaded values are available below.');}
}
