import {describe,it,expect} from 'vitest';
import {createPresentationRegistry,validatePresentationPlan,type PresentationManifest,type InteractionState} from '../../packages/core/src/index.js';
import {projectInteractionState,projectNavigationState} from '../../packages/runtime/src/presentation/renderer.js';
import {presentationPlan,presentationTask,experience,environment,result,ref} from '../contracts/fixtures.js';
const manifest:PresentationManifest={ref:{id:'data.table',revision:'1'},configSchema:{id:'data.table.config',revision:'1'},roles:['table'],result:'required',children:{min:0,max:0},visibility:'leaf',extension:false,operations:[],resolveConfig:values=>({ok:true,value:{values,fields:['employee.id'],ports:[{id:values.port==='chosen'?'chosen':'selection',direction:'inout',payload:'selection',entity:'employees',identity:['employee.id'],grain:['employee.id']}]}})};
const registry=createPresentationRegistry([manifest]);if(!registry.ok)throw Error('registry');
const context={task:presentationTask,experience,environment,results:[result],current:presentationPlan.preconditions,rendererCapabilities:[manifest.ref]};
const previous=validatePresentationPlan(presentationPlan,context,registry.value);if(!previous.ok)throw Error('previous');
const next=validatePresentationPlan({...presentationPlan,nodes:presentationPlan.nodes.map(node=>({...node,config:{...node.config,values:{port:'chosen'}}})),stateTransfer:[{fromNode:'table-1',toNode:'table-1',mapping:{id:'aeliqo.state.identity',revision:'1'}}]},{...context,incumbent:presentationPlan},registry.value);if(!next.ok)throw Error('next');
const state:InteractionState={version:'1',values:[{nodeId:'table-1',portId:'selection',payload:{kind:'selection',selection:{mode:'ids',entity:'employees',keys:['e-1'],result:ref}}}],drafts:[{domain:'profile',entity:'employees',key:'e-1',field:'name',value:'Unfinished',entityRevision:'1'}]};
describe('adaptation state projection',()=>{
 it('preserves exact selection scope and domain drafts while transferring a compatible port',()=>{
  const projected=projectInteractionState(previous.value,next.value,state);expect(projected.ok).toBe(true);if(!projected.ok)return;
  expect(projected.value).toEqual({...state,values:[{...state.values[0]!,portId:'chosen'}]});
  const navigation={route:{id:'employee',revision:'1'},params:{id:'e-1'},nodeId:'table-1'};
  expect(projectNavigationState(previous.value,next.value,navigation)).toEqual({ok:true,value:navigation});
 });
 it('rejects missing state owners and incompatible entity/grain instead of dropping state',()=>{
  expect(projectInteractionState(previous.value,{...next.value,plan:{...next.value.plan,stateTransfer:[]}},state).ok).toBe(false);
  const incompatible={...next.value,nodes:next.value.nodes.map(node=>({...node,config:{...node.config,ports:node.config.ports.map(port=>({...port,entity:'other'}))}}))};
  expect(projectInteractionState(previous.value,incompatible,state).ok).toBe(false);
  expect(projectNavigationState(previous.value,{...next.value,plan:{...next.value.plan,stateTransfer:[]}},{route:{id:'employee',revision:'1'},params:{},nodeId:'table-1'}).ok).toBe(false);
 });
});
