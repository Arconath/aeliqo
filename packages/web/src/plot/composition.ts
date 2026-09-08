import {bindPlotSpec,scalarIdentity,parseWireValue} from '@aeliqo/core';
import type {PlotSpec,PlotNode,PlotUnit,Result,ResultRef,Scalar,Outcome} from '@aeliqo/core';
import {compilePlotUnit} from './geometry.js';
import type {PlotGeometry,PlotDatum,PlotGeometryOptions,PlotProjection} from './geometry.js';
import {exactLabel} from './scales.js';
export interface PlotDataset {readonly result:ResultRef;readonly rows:readonly Readonly<Record<string,Scalar>>[]}
export type CompiledPlotNode =
 | {readonly kind:'unit';readonly geometry:PlotGeometry;readonly displayedIdentities:readonly string[]}
 | {readonly kind:'layer';readonly scales:'shared-compatible'|'independent';readonly children:readonly CompiledPlotNode[]}
 | {readonly kind:'concat';readonly direction:'inline'|'block';readonly children:readonly CompiledPlotNode[]}
 | {readonly kind:'facet';readonly field:string;readonly scales:'shared-compatible'|'independent';readonly children:readonly {readonly key:string;readonly label:string;readonly node:CompiledPlotNode}[]};
export interface CompiledPlot {readonly spec:PlotSpec;readonly root:CompiledPlotNode}
const key=(r:ResultRef)=>JSON.stringify([r.id,r.revision,r.outputId,r.queryDigest,r.scopeDigest]);
const fail=(message:string):Outcome<never>=>({ok:false,diagnostics:[{code:'plot.composition',message,retryable:false}]});
interface Prepared {unit:PlotUnit;result:Result;rows:readonly PlotDatum[];raw:unknown}
interface Filter {field:string;key:string}
/** Compose already authorized data. Facets are display partitions, preserving the original Result references. */
export function compilePlotComposition(input:unknown,results:readonly Result[],datasets:readonly PlotDataset[],options:PlotGeometryOptions):Outcome<CompiledPlot>{
 const bound=bindPlotSpec(input,results);if(!bound.ok)return bound;
 const inspected=parseWireValue(datasets);if(!inspected.ok)return inspected;
 if(!Array.isArray(inspected.value)||inspected.value.length>128)return fail('The dataset list is invalid or exceeds its bound.');
 const byRef=new Map<string,unknown>();
 for(const value of inspected.value){
  if(value===null||typeof value!=='object'||Array.isArray(value))return fail('A dataset must be a record.');
  const d=value as unknown as PlotDataset;
  if(d.result===null||typeof d.result!=='object'||!Array.isArray(d.rows))return fail('A dataset requires a result reference and row array.');
  const id=key(d.result);if(byRef.has(id))return fail('Dataset result references must be unique.');byRef.set(id,d.rows);
 }
 const prepared=new Map<PlotNode,Prepared>();let work=0;
 for(const u of bound.value.units){
  const raw=byRef.get(key(u.result.ref));if(raw===undefined)return fail('An exact result dataset is unavailable.');
  work+=u.result.counts.loaded;if(work>50_000)return fail('Composition exceeds its row-work budget.');
  const geometry=compilePlotUnit(u.node,u.result,raw,options);if(!geometry.ok)return geometry;
  prepared.set(u.node,{unit:u.node,result:u.result,rows:geometry.value.rows,raw});
 }
 const descendants=(node:PlotNode):Prepared[]=>node.kind==='unit'?[prepared.get(node)!]:node.kind==='facet'?descendants(node.child):node.children.flatMap(descendants);
 const matches=(p:Prepared,row:PlotDatum,filters:readonly Filter[])=>filters.every(filter=>{
  const field=p.result.fields.find(f=>f.id===filter.field);if(!field)return false;
  const id=scalarIdentity(row.values[filter.field],field.type);return id.ok&&id.value===filter.key;
 });
 const domains=(node:PlotNode,filters:readonly Filter[]):PlotProjection['domains']=>{
  const x:Scalar[]=[],y:Scalar[]=[];
  for(const p of descendants(node))for(const row of p.rows)if(matches(p,row,filters)){
   const e=p.unit.encoding;x.push(row.values[e.x.field]!);y.push(row.values[e.y.field]!);
   if(e.x2)x.push(row.values[e.x2.field]!);if(e.y2)y.push(row.values[e.y2.field]!);
  }
  return {x,y};
 };
 let nodes=0,pixels=0,marks=0;
 const visit=(node:PlotNode,filters:readonly Filter[],inherited?:PlotProjection['domains']):Outcome<CompiledPlotNode>=>{
  if(++nodes>128)return fail('Expanded plot composition exceeds 128 nodes.');
  if(node.kind==='unit'){
   pixels+=options.width*options.height;if(pixels>16_000_000)return fail('Composition exceeds its total display-pixel budget.');
   const p=prepared.get(node)!;
   const identities=p.rows.filter(row=>matches(p,row,filters)).map(row=>row.identity);
   work+=p.rows.length;if(work>100_000)return fail('Expanded plot composition exceeds its row-work budget.');
   const g=compilePlotUnit(node,p.result,p.raw,options,{identities,...(inherited?{domains:inherited}:{})});
   if(g.ok){marks+=g.value.marks.reduce((n,m)=>n+(m.kind==='path'?m.identities.length:1),0);if(marks>100_000)return fail('Composition exceeds its total geometry budget.');}
   return g.ok?{ok:true,value:{kind:'unit',geometry:g.value,displayedIdentities:identities}}:g;
  }
  const shared=inherited??(node.kind!=='concat'&&node.scales==='shared-compatible'?domains(node,filters):undefined);
  if(shared&&(shared.x.length>10_000||shared.y.length>10_000))return fail('Shared scale domains exceed their value budget.');
  if(node.kind==='facet'){
   const groups=new Map<string,string>();
   for(const p of descendants(node.child))for(const row of p.rows)if(matches(p,row,filters)){
    const field=p.result.fields.find(f=>f.id===node.field)!;
    const identity=scalarIdentity(row.values[node.field],field.type);if(!identity.ok)return identity;
    groups.set(identity.value,exactLabel(row.values[node.field]!));
    if(groups.size>32)return fail('A facet exceeds 32 display groups.');
   }
   const children:{key:string;label:string;node:CompiledPlotNode}[]=[];
   for(const [group,label] of groups){const child=visit(node.child,[...filters,{field:node.field,key:group}],shared);if(!child.ok)return child;children.push({key:group,label,node:child.value});}
   return {ok:true,value:{kind:'facet',field:node.field,scales:node.scales,children}};
  }
  const children:CompiledPlotNode[]=[];
  for(const childNode of node.children){const child=visit(childNode,filters,shared);if(!child.ok)return child;children.push(child.value);}
  return node.kind==='concat'?{ok:true,value:{kind:'concat',direction:node.direction,children}}:{ok:true,value:{kind:'layer',scales:node.scales,children}};
 };
 const root=visit(bound.value.spec.root,[]);
 return root.ok?{ok:true,value:{spec:bound.value.spec,root:root.value}}:root;
}
