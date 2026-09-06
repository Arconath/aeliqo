import { capabilityContracts, type createCapabilityDispatcher } from '@aeliqo/core';
export interface WebMCPTool {
  name:string; description:string; inputSchema:Record<string,unknown>;
  execute(input:unknown):Promise<string>;
}
export interface WebMCPHost { registerTool(tool:WebMCPTool,options:{signal:AbortSignal}):void|Promise<void> }
export type WebMCPRegistration = {
  supported: boolean;
  hostSource: 'native' | 'injected' | 'unavailable';
  evidence: 'adapter-registered' | 'adapter-unavailable';
  nativeHostVerified: false;
  dispose(): void;
};
/** WebMCP support: experimental. Current Chrome API uses document.modelContext and abort-based cleanup. */
export async function registerWebMCP(dispatcher:ReturnType<typeof createCapabilityDispatcher>, host?:WebMCPHost):Promise<WebMCPRegistration> {
  const native = typeof document==='undefined'?undefined:(document as Document & {modelContext?:WebMCPHost}).modelContext;
  const active = host ?? native;
  if (!active || typeof active.registerTool!=='function') return {supported:false,hostSource:'unavailable',evidence:'adapter-unavailable',nativeHostVerified:false,dispose:()=>undefined};
  const controller=new AbortController();
  try {
    for (const contract of capabilityContracts) await active.registerTool({name:contract.id,description:contract.description,inputSchema:contract.jsonSchema,
      execute:async input=>JSON.stringify(await dispatcher.dispatchAsync(contract.id,input,{source:'WebMCP'}, {signal:controller.signal})),
    },{signal:controller.signal});
  } catch(error) { controller.abort(); throw error; }
  return {supported:true,hostSource:host?'injected':'native',evidence:'adapter-registered',nativeHostVerified:false,dispose:()=>controller.abort()};
}
