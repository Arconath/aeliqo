import { createServer, type IncomingMessage } from 'node:http';
import { createAeliqoServer } from '@aeliqo/mcp';
import { runAgent, type ProviderAdapter } from '@aeliqo/byok';
import { createOpenAIProvider } from '@aeliqo/byok/openai';
import { z } from 'zod';
const origins=new Set(['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173']);
async function readBody(request:IncomingMessage):Promise<unknown> {
  let body='';
  for await(const chunk of request) { body+=String(chunk);if(Buffer.byteLength(body)>8192)throw new Error('Request exceeds 8KB'); }
  return JSON.parse(body) as unknown;
}
export function createCompanion(options:{port?:number;bridgePort?:number;allowedOrigins?:readonly string[];provider?:ProviderAdapter;apiKey?:string;model?:string;workspaceId?:string;rendererId?:string;byokTimeoutMs?:number}={}) {
  const mcp=createAeliqoServer({port:options.bridgePort,allowedOrigins:options.allowedOrigins,workspaceId:options.workspaceId,rendererId:options.rendererId});
  const allowedOrigins=options.allowedOrigins ? new Set(options.allowedOrigins) : origins;
  const model=options.model??process.env.OPENAI_MODEL??'gpt-5.4-mini';
  const apiKey=options.apiKey??process.env.OPENAI_API_KEY;
  const provider=options.provider??(apiKey?createOpenAIProvider({apiKey,model}):undefined);
  let busy=false;
  const controller=new AbortController();
  const http=createServer(async(request,response)=>{
    const send=(status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
    const origin=request.headers.origin;
    if(!/^127\.0\.0\.1:\d+$/.test(request.headers.host??'') || !origin || !allowedOrigins.has(origin)) {send(403,{error:'Untrusted local origin'});return;}
    response.setHeader('Access-Control-Allow-Origin',origin);
    response.setHeader('Vary','Origin');
    if(request.method==='OPTIONS') {response.setHeader('Access-Control-Allow-Methods','GET, POST');response.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');response.writeHead(204);response.end();return;}
    if(!mcp.bridge.authorize(request.headers.authorization?.replace(/^Bearer /,''))) {send(401,{error:'Pairing credential required'});return;}
    if(request.method==='GET'&&request.url==='/status') {send(200,{providerConfigured:Boolean(provider),model,busy,workspaceConnected:mcp.bridge.connected,...mcp.bridge.identity});return;}
    if(request.method!=='POST'||request.url!=='/byok') {send(404,{error:'Unknown endpoint'});return;}
    if(request.headers['content-type']!=='application/json') {send(415,{error:'Expected application/json'});return;}
    if(busy) {send(409,{error:'An intent is already running'});return;}
    if(!provider) {send(503,{error:'Set OPENAI_API_KEY in the companion environment, then restart'});return;}
    const client=new AbortController();
    const abortClient=()=>client.abort(new Error('BYOK client disconnected'));
    request.once('aborted',abortClient);
    response.once('close',()=>{if(!response.writableEnded)abortClient();});
    try {
      const {intent}=z.object({intent:z.string().trim().min(1).max(4000)}).strict().parse(await readBody(request));
      if(busy){send(409,{error:'An intent is already running'});return;}
      busy=true;
      try {
        const signal=AbortSignal.any([controller.signal,mcp.bridge.revocationSignal,client.signal,AbortSignal.timeout(Math.max(1000,Math.min(options.byokTimeoutMs??60000,120000)))]);
        const result=await runAgent(provider,intent,(name,input)=>mcp.bridge.request(name,input,'BYOK',{signal}),{signal,output:'workspace'});
        send(200,result);
      } finally {busy=false;}
    } catch(error){send(400,{error:error instanceof Error?error.message:'Intent failed'});}
  });
  http.requestTimeout=10000;
  const ready=new Promise<void>((resolve,reject)=>{http.once('error',reject);http.listen(options.port??4319,'127.0.0.1',resolve);});
  return {mcp,ready:Promise.all([ready,mcp.bridge.ready]),get port(){const addr=http.address();if(!addr||typeof addr==='string')throw new Error('Not listening');return addr.port;},close:async()=>{controller.abort();http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()));await mcp.close();}};
}
