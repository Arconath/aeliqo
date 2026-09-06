import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCompanion } from './server.js';
const app=createCompanion({
  workspaceId:process.env.AELIQO_WORKSPACE_ID,
  rendererId:process.env.AELIQO_RENDERER_ID,
});
await app.ready;
await app.mcp.server.connect(new StdioServerTransport());
console.error(`Aeliqo companion: HTTP 127.0.0.1:${app.port}, WS 127.0.0.1:${app.mcp.bridge.port}`);
console.error(`Authorized target: workspace ${app.mcp.bridge.identity.workspaceId}; renderer ${app.mcp.bridge.identity.rendererId ?? 'chosen by the first authorized pairing'}`);
const identityQuery = new URLSearchParams({
  aeliqoBridgePort:String(app.mcp.bridge.port),
  aeliqoCompanionPort:String(app.port),
  aeliqoWorkspaceId:app.mcp.bridge.identity.workspaceId,
});
if(app.mcp.bridge.identity.rendererId) identityQuery.set('aeliqoRendererId',app.mcp.bridge.identity.rendererId);
console.error(`Pair this workspace: http://127.0.0.1:5173/playground/?${identityQuery}#aeliqoPairToken=${app.mcp.bridge.pairingToken}`);
let closing=false;
const close=async()=>{if(closing)return;closing=true;await app.close();};
process.on('SIGINT',()=>{void close();});
process.on('SIGTERM',()=>{void close();});
process.stdin.on('end',()=>{void close();});
