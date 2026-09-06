import { expect,it } from 'vitest';
import { capabilityContracts,createCapabilityDispatcher,createWorkspace,type DataPort } from '@aeliqo/core';
import { registerWebMCP,type WebMCPHost,type WebMCPTool } from './index.js';
const data:DataPort={listDatasets:()=>[],getDataset:()=>undefined,getSnapshot:()=>({status:'ready',records:[]}),subscribe:()=>()=>undefined};
it('is optional when the browser does not implement WebMCP',async()=>{
  expect((await registerWebMCP(createCapabilityDispatcher(createWorkspace({dataPort:data})))).supported).toBe(false);
});
it('projects and executes shared capabilities using an explicit fake host; abort cleans registrations',async()=>{
  const tools=new Map<string,WebMCPTool>();
  const fakeHost:WebMCPHost={registerTool(tool,{signal}){tools.set(tool.name,tool);signal.addEventListener('abort',()=>tools.delete(tool.name),{once:true});}};
  const registration=await registerWebMCP(createCapabilityDispatcher(createWorkspace({dataPort:data})),fakeHost);
  expect([...tools.keys()]).toEqual(capabilityContracts.map(contract=>contract.id));
  for(const contract of capabilityContracts)expect(tools.get(contract.id)?.inputSchema).toBe(contract.jsonSchema);
  expect(JSON.parse(await tools.get('workspace_inspect')!.execute({}))).toMatchObject({revision:0});
  await expect(tools.get('workspace_apply')!.execute({version:1,baseRevision:0,operations:[{type:'mount',node:{id:'evil',component:'JSX',datasetId:'x'}}]})).rejects.toThrow();
  registration.dispose();expect(tools.size).toBe(0);
});
