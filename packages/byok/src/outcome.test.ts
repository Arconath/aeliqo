import {expect,it,vi} from 'vitest';
import {runAgent,createScriptedProvider} from './index';
import type {WorkspaceReceipt} from '@aeliqo/core';

const receipt:WorkspaceReceipt={contractVersion:'0.2',requestId:'r',workspaceId:'workspace',ok:true,operation:'committed',revision:1,render:{status:'acknowledged',rendererId:'renderer',revision:1,evidence:'renderer-ack',visible:true},data:{status:'ready'},outcome:'presented',changedNodeIds:['table']};
const apply={id:'apply',name:'workspace_apply',arguments:{version:1,baseRevision:0,operations:[{type:'mount',node:{id:'table',component:'Table',datasetId:'models'}}]}};
it('chat-only policy hides mutation tools and rejects a provider write without dispatching',async()=>{
  const dispatch=vi.fn();
  const scripted=createScriptedProvider([{calls:[apply]},{calls:[],text:'Explanation'}]);
  const result=await runAgent({name:'test',next:input=>{
    expect(input.tools.map(tool=>tool.id)).not.toContain('workspace_apply');
    return scripted.next(input);
  }},'Explain only',dispatch,{output:'chat'});
  expect(dispatch).not.toHaveBeenCalled();
  expect(result).toMatchObject({text:'Explanation',rejectedToolCalls:1});
});
it('read results and provider claims cannot substitute for the requested workspace change',async()=>{
  const provider=createScriptedProvider([{calls:[{id:'query',name:'data_query',arguments:{datasetId:'models'}}]},{calls:[],text:'Chart complete'}]);
  const result=await runAgent(provider,'Plot these',()=>({records:[]}),{output:'workspace'});
  expect(result).toMatchObject({outcome:'failed'});
  expect(result.text).not.toContain('Chart complete');
});
it.each(['pending','failed','presented'] as const)('workspace result follows actual %s receipt',async(outcome)=>{
  const value:WorkspaceReceipt=outcome==='presented'?receipt:{...receipt,outcome,render:{status:outcome==='failed'?'failed':'pending',revision:1}};
  const result=await runAgent(createScriptedProvider([{calls:[apply]},{calls:[],text:'Complete'}]),'Plot these',()=>value,{output:'workspace'});
  expect(result).toMatchObject({outcome,receipt:value});
  expect(result.text==='Complete').toBe(outcome==='presented');
});
it('a later failed mutation or fabricated receipt prevents a completion claim',async()=>{
  const dispatch=vi.fn().mockResolvedValueOnce(receipt).mockRejectedValueOnce(new Error('Conflict'));
  const result=await runAgent(createScriptedProvider([{calls:[apply]},{calls:[{...apply,id:'later'}]},{calls:[],text:'Complete'}]),'Plot these',dispatch,{output:'workspace'});
  expect(result).toMatchObject({outcome:'failed',rejectedToolCalls:1});
  const fabricated=await runAgent(createScriptedProvider([{calls:[apply]},{calls:[],text:'Complete'}]),'Plot these',()=>({...receipt,render:{status:'pending'}}),{output:'workspace'});
  expect(fabricated).toMatchObject({outcome:'failed',rejectedToolCalls:1});
});
