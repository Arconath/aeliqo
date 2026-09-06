// @vitest-environment node
import {afterEach,expect,it} from 'vitest';
import {createCompanion} from './server.js';
import {createScriptedProvider} from '@aeliqo/byok';
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
