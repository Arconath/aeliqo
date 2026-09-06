import { capabilityContracts, type createCapabilityDispatcher } from '@aeliqo/core';
export interface WebMCPTool {
  name:string; description:string; inputSchema:Record<string,unknown>;
  execute(input:unknown):Promise<string>;
}
export interface WebMCPHost { registerTool(tool:WebMCPTool,options:{signal:AbortSignal}):void|Promise<void> }
/** WebMCP support: experimental. Current Chrome API uses document.modelContext and abort-based cleanup. */
export async function registerWebMCP(dispatcher:ReturnType<typeof createCapabilityDispatcher>, host?:WebMCPHost) {
  const active = host ?? (typeof document==='undefined'?undefined:(document as Document & {modelContext?:WebMCPHost}).modelContext);
  if (!active || typeof active.registerTool!=='function') return {supported:false,dispose:()=>undefined};
  const controller=new AbortController();
  try {
    for (const contract of capabilityContracts) await active.registerTool({name:contract.id,description:contract.description,inputSchema:contract.jsonSchema,
      execute:async input=>JSON.stringify(await dispatcher.dispatchAsync(contract.id,input,{source:'WebMCP'}, {signal:controller.signal})),
    },{signal:controller.signal});
  } catch(error) { controller.abort(); throw error; }
  return {supported:true,dispose:()=>controller.abort()};
}
