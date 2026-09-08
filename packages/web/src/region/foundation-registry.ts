import {parseWireValue, type Outcome, type PresentationManifest, type PresentationValues, type Scalar, type VersionRef} from '@aeliqo/core';
import {AELIQO_FOUNDATION_MANIFESTS} from '../foundation/manifest.js';

/** Immutable application-owned bindings. Change the Experience revision when these change. */
export interface AeliqoFoundationBindings {
  readonly revision: string;
  readonly contents?: readonly {readonly id: string; readonly text: string}[];
  readonly actions?: readonly {readonly id: string; readonly action: VersionRef; readonly input: Readonly<Record<string, Scalar>>}[];
  readonly routes?: readonly {readonly id: string; readonly route: VersionRef; readonly params: Readonly<Record<string, Scalar>>; readonly href: string}[];
  readonly identities?: readonly {readonly id: string; readonly name: string; readonly src?: string; readonly alt?: string}[];
}
const uniqueRefs=(values:readonly VersionRef[]):VersionRef[]=>[...new Map(values.map(value=>[JSON.stringify([value.id,value.revision]),value])).values()];
const fail = <T>(message: string): Outcome<T> => ({ok:false,diagnostics:[{code:'web.presentation.foundation-binding',message,retryable:false}]});
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const bounded=(value:unknown,max=160):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);
function ref(value:unknown):value is VersionRef{return record(value)&&Object.keys(value).length===2&&bounded(value.id)&&bounded(value.revision);}
function scalar(value:unknown):value is Scalar{return value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)||record(value)&&Object.keys(value).length===1&&typeof value.decimal==='string'&&value.decimal.length<=512&&/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value.decimal);}
function scalarRecord(value:unknown):value is Readonly<Record<string,Scalar>>{return record(value)&&Object.keys(value).length<=128&&Object.entries(value).every(([key,value])=>bounded(key)&&scalar(value));}
function safeHref(value:unknown,image=false):value is string {if(!bounded(value,4096))return false;try{return (image?['http:','https:']:['http:','https:','mailto:','tel:']).includes(new URL(value,'https://aeliqo.invalid').protocol);}catch{return false;}}
function freeze<T>(value:T):T {if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function copyBindings(input:AeliqoFoundationBindings|undefined):Outcome<AeliqoFoundationBindings>{
  if(input===undefined)return {ok:true,value:{revision:'unconfigured'}};
  const parsed=parseWireValue(input);if(!parsed.ok)return fail('Foundation bindings must be bounded JSON data.');
  const value:unknown=JSON.parse(JSON.stringify(parsed.value));
  if(!record(value)||!bounded(value.revision)||Object.keys(value).some(key=>!['revision','contents','actions','routes','identities'].includes(key)))return fail('Foundation binding metadata is invalid.');
  for(const kind of ['contents','actions','routes','identities'] as const){
    const items=value[kind];if(items===undefined)continue;
    if(!Array.isArray(items)||items.length>128)return fail('Foundation binding collections are bounded to 128 entries.');
    const ids=new Set<string>();
    for(const item of items){
      if(!record(item)||!bounded(item.id)||ids.has(item.id))return fail('Foundation binding identifiers must be unique bounded strings.');ids.add(item.id);
      const keys=kind==='contents'?['id','text']:kind==='actions'?['id','action','input']:kind==='routes'?['id','route','params','href']:['id','name','src','alt'];
      if(Object.keys(item).some(key=>!keys.includes(key)))return fail('A foundation binding contains an unknown field.');
      if(kind==='contents'&&!bounded(item.text,4096))return fail('Registered content requires bounded nonempty text.');
      if(kind==='actions'&&(!ref(item.action)||!scalarRecord(item.input)))return fail('Registered actions require a versioned action and scalar input.');
      if(kind==='routes'&&(!ref(item.route)||!scalarRecord(item.params)||!safeHref(item.href)))return fail('Registered routes require a versioned route, scalar parameters and a safe destination.');
      if(kind==='identities'&&(!bounded(item.name)||(item.src!==undefined&&!safeHref(item.src,true))||(item.alt!==undefined&&!bounded(item.alt))))return fail('Registered identity content is invalid.');
    }
  }
  return {ok:true,value:freeze(value) as unknown as AeliqoFoundationBindings};
}

/** Adapts owned primitives to the SAME core presentation validator used by data views. */
export function createFoundationPresentationManifests(input?:AeliqoFoundationBindings):Outcome<readonly PresentationManifest[]>{
  const copied=copyBindings(input);if(!copied.ok)return copied;
  const bindings=copied.value;
  const actions=bindings.actions??[];const routes=bindings.routes??[];
  const containers=new Set(['foundation.surface','foundation.stack','foundation.grid','foundation.scroll-area','foundation.split-pane']);
  const manifests:PresentationManifest[]=AELIQO_FOUNDATION_MANIFESTS.map(manifest=>({
    ref:manifest.ref,configSchema:{id:`${manifest.ref.id}.config`,revision:'1'},roles:[manifest.role],
    operations:manifest.ref.id==='foundation.link'?uniqueRefs(routes.map(entry=>entry.route)):manifest.role==='action'?uniqueRefs(actions.map(entry=>entry.action)):[],
    result:'none',children:manifest.ref.id==='foundation.split-pane'?{min:2,max:2}:containers.has(manifest.ref.id)?{min:0,max:32}:{min:0,max:0},
    visibility:containers.has(manifest.ref.id)?'simultaneous':'leaf',extension:false,
    resolveConfig(values){
      if(values.bindingRevision!==bindings.revision)return fail('The foundation binding revision does not match the pinned configuration.');
      const {bindingRevision: _bindingRevision,...leafValues}=values;
      const checked=manifest.resolveConfig(leafValues);if(!checked.ok)return fail(checked.diagnostics[0]?.message??'Foundation configuration is invalid.');
      const resolved:Record<string,unknown>={...checked.value.values,bindingRevision:bindings.revision};
      for(const key of ['contentRef','labelRef']){
        if(resolved[key]===undefined)continue;
        const content=bindings.contents?.find(entry=>entry.id===resolved[key]);if(content===undefined)return fail('The requested content reference is not registered.');
        resolved[key==='contentRef'?'text':'label']=content.text;
      }
      if(manifest.ref.id==='foundation.avatar'){
        const identity=bindings.identities?.find(entry=>entry.id===resolved.identityRef);if(identity===undefined)return fail('The requested identity reference is not registered.');
        resolved.name=identity.name;if(identity.src!==undefined)resolved.src=identity.src;if(identity.alt!==undefined)resolved.alt=identity.alt;
      }
      if(manifest.ref.id==='foundation.button'||manifest.ref.id==='foundation.icon-button'){
        const action=actions.find(entry=>entry.id===resolved.actionRef);if(action===undefined)return fail('The requested action reference is not registered.');
        // Semantic action requests never submit an enclosing native host form.
        if(resolved.type!==undefined&&resolved.type!=='button')return fail('Semantic buttons require type button; native submit/reset belongs to the direct form path.');
        resolved.action=action.action;resolved.actionInput=action.input;resolved.type='button';
        return {ok:true,value:{values:resolved as PresentationValues,fields:[],ports:[{id:'action',direction:'output',payload:'action-request'}],operations:[action.action]}};
      }
      if(manifest.ref.id==='foundation.link'){
        const route=routes.find(entry=>entry.id===resolved.routeRef);if(route===undefined)return fail('The requested route reference is not registered.');
        resolved.route=route.route;resolved.params=route.params;resolved.href=route.href;
        return {ok:true,value:{values:resolved as PresentationValues,fields:[],ports:[{id:'navigate',direction:'output',payload:'navigate'}],operations:[route.route]}};
      }
      return {ok:true,value:{values:resolved as PresentationValues,fields:[],ports:[],operations:[]}};
    },
  }));
  return {ok:true,value:manifests};
}
