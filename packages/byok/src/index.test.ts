// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { capabilityContracts, createCapabilityDispatcher, createWorkspace, type DataPort } from '@aeliqo/core';
import { createScriptedProvider, runAgent, type ProviderAdapter } from './index.js';
import { createOpenAIProvider } from './openai.js';
const data:DataPort={listDatasets:()=>[],getDataset:()=>undefined,getSnapshot:()=>({status:'ready',records:[]}),subscribe:()=>()=>undefined};
it('projects shared contracts and dispatches scripted calls without pretending they are reasoning',async()=>{
  const dispatcher=createCapabilityDispatcher(createWorkspace({dataPort:data}));
  const dispatch=vi.fn((name:Parameters<typeof dispatcher.dispatch>[0],input:unknown)=>dispatcher.dispatch(name,input,{source:'BYOK'}));
  const provider=createScriptedProvider([{calls:[{id:'one',name:'workspace_inspect',arguments:{}}]},{calls:[],text:'Fixture finished'}]);
  const result=await runAgent(provider,'Inspect current workspace',dispatch);
  expect(result).toMatchObject({toolCalls:1,provider:'deterministic-test-fixture',text:'Fixture finished'});
  expect(dispatch).toHaveBeenCalledWith('workspace_inspect',{});
});
it('rejects unknown tools and executable config before dispatch and bounds runaway providers',async()=>{
  const dispatch=vi.fn();
  const next=vi.fn<ProviderAdapter['next']>().mockResolvedValueOnce({calls:[{id:'one',name:'eval',arguments:{code:'run()'}},{id:'two',name:'workspace_apply',arguments:{version:1,baseRevision:0,operations:[{type:'configure',id:'a',patch:{css:'body{}'}}]}}]}).mockResolvedValue({calls:[],text:'Rejected'});
  await runAgent({name:'test',next},'Intent',dispatch);
  expect(dispatch).not.toHaveBeenCalled();
  expect(next.mock.calls[1]?.[0].results).toHaveLength(2);
  expect(next.mock.calls[0]?.[0].tools).toBe(capabilityContracts);
  const looping:ProviderAdapter={name:'loop',next:async()=>({calls:[{id:'call',name:'workspace_inspect',arguments:{}}]})};
  await expect(runAgent(looping,'Intent',dispatch,{maxTurns:2})).rejects.toThrow('turn budget');
});
it('uses Responses tool outputs and shared JSON schemas; keeps authorization out of model inputs',async()=>{
  const requests:Record<string,unknown>[]=[];
  const fetchMock=vi.fn<typeof fetch>().mockImplementation(async(_url,init)=>{
    requests.push(JSON.parse(String(init?.body)) as Record<string,unknown>);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-secret');
    return new Response(JSON.stringify({output:requests.length===1?[{type:'function_call',call_id:'c1',name:'workspace_inspect',arguments:'{}'}]:[{type:'message',content:[{type:'output_text',text:'Inspected'}]}]}),{status:200});
  });
  const provider=createOpenAIProvider({apiKey:'server-secret',model:'test-model',fetch:fetchMock});
  const result=await runAgent(provider,'Inspect',()=>({revision:0}));
  expect(result.text).toBe('Inspected');
  expect(JSON.stringify(requests)).not.toContain('server-secret');
  expect(requests[0]?.tools).toEqual(capabilityContracts.map(tool=>({type:'function',name:tool.id,description:tool.description,parameters:tool.jsonSchema,strict:false})));
  expect(requests[1]?.input).toContainEqual({type:'function_call_output',call_id:'c1',output:'{"revision":0}'});
});
it('propagates cancellation into an in-flight capability dispatch',async()=>{
  const controller=new AbortController();
  let dispatchSignal:AbortSignal|undefined;
  const dispatch=vi.fn((_name:unknown,_input:unknown,options?:{signal?:AbortSignal})=>new Promise((_resolve,reject)=>{
    dispatchSignal=options?.signal;
    options?.signal?.addEventListener('abort',()=>reject(options.signal?.reason),{once:true});
  }));
  const running=runAgent(createScriptedProvider([{calls:[{id:'inspect',name:'workspace_inspect',arguments:{}}]}]),'Inspect',dispatch,{signal:controller.signal});
  await vi.waitFor(()=>expect(dispatchSignal).toBe(controller.signal));
  controller.abort(new Error('pairing revoked'));
  await expect(running).rejects.toThrow('pairing revoked');
});
