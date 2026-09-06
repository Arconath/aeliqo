// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {createCompanion} from './server.js';
import {createScriptedProvider} from '@aeliqo/byok';
import type {ProviderAdapter} from '@aeliqo/byok';
let app:ReturnType<typeof createCompanion>|undefined;
afterEach(async()=>{await app?.close();});
it('rejects foreign origins and reports missing provider without exposing secrets',async()=>{
  app=createCompanion({port:0,bridgePort:0,apiKey:''});await app.ready;
  const url=`http://127.0.0.1:${app.port}`;
  expect((await fetch(`${url}/status`,{headers:{Origin:'https://evil.example'}})).status).toBe(403);
  expect((await fetch(`${url}/status`,{headers:{Origin:'http://127.0.0.1:5173'}})).status).toBe(401);
  const status=await fetch(`${url}/status`,{headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app.mcp.bridge.pairingToken}`}});
  expect(await status.json()).toMatchObject({providerConfigured:false,workspaceConnected:false});
  const command=await fetch(`${url}/byok`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app.mcp.bridge.pairingToken}`,'Content-Type':'application/json'},body:JSON.stringify({intent:'Inspect'})});
  expect(command.status).toBe(503);
  app.mcp.bridge.revoke();
  expect((await fetch(`${url}/status`,{headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app.mcp.bridge.pairingToken}`}})).status).toBe(401);
});
it('runs an explicit injected test fixture and rejects oversized or unknown input',async()=>{
  app=createCompanion({port:0,bridgePort:0,provider:createScriptedProvider([{calls:[],text:'Scripted fixture only'}])});await app.ready;
  const invoke=(body:unknown)=>fetch(`http://127.0.0.1:${app?.port}/byok`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app?.mcp.bridge.pairingToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  expect((await invoke({intent:'Inspect',apiKey:'no'})).status).toBe(400);
  expect((await invoke({intent:'x'.repeat(10000)})).status).toBe(400);
  expect(await(await invoke({intent:'Inspect'})).json()).toMatchObject({provider:'deterministic-test-fixture',outcome:'failed',toolCalls:0});
});
it('reports explicit workspace identity and aborts provider work when pairing is revoked',async()=>{
  let providerSignal:AbortSignal|undefined;
  const started=new Promise<void>(resolve=>{
    const provider:ProviderAdapter={name:'pending-provider',next:({signal})=>{
      providerSignal=signal;resolve();
      return new Promise((_done,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    }};
    app=createCompanion({port:0,bridgePort:0,workspaceId:'operations',rendererId:'operations-tab',provider});
  });
  await app!.ready;
  const status=await fetch(`http://127.0.0.1:${app!.port}/status`,{headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app!.mcp.bridge.pairingToken}`}});
  expect(await status.json()).toMatchObject({workspaceId:'operations',rendererId:'operations-tab',workspaceConnected:false});
  const call=fetch(`http://127.0.0.1:${app!.port}/byok`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app!.mcp.bridge.pairingToken}`,'Content-Type':'application/json'},body:JSON.stringify({intent:'Investigate'})});
  await started;
  app!.mcp.bridge.revoke();
  expect(providerSignal?.aborted).toBe(true);
  expect((await call).status).toBe(400);
  expect((await fetch(`http://127.0.0.1:${app!.port}/status`,{headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app!.mcp.bridge.pairingToken}`}})).status).toBe(401);
});
it('aborts provider work when the HTTP client disconnects',async()=>{
  let providerSignal:AbortSignal|undefined;
  let startedResolve:()=>void=()=>undefined;
  const started=new Promise<void>(resolve=>{startedResolve=resolve;});
  const provider:ProviderAdapter={name:'pending-provider',next:({signal})=>{
    providerSignal=signal;startedResolve();
    return new Promise((_done,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }};
  app=createCompanion({port:0,bridgePort:0,provider});await app.ready;
  const controller=new AbortController();
  const call=fetch(`http://127.0.0.1:${app.port}/byok`,{method:'POST',signal:controller.signal,headers:{Origin:'http://127.0.0.1:5173',Authorization:`Bearer ${app.mcp.bridge.pairingToken}`,'Content-Type':'application/json'},body:JSON.stringify({intent:'Investigate'})});
  await started;controller.abort();
  await expect(call).rejects.toThrow();
  await vi.waitFor(()=>expect(providerSignal?.aborted).toBe(true));
});
