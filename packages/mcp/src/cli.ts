#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAeliqoServer } from "./server.js";

const configuredPort = process.env.AELIQO_BRIDGE_PORT;
const port = configuredPort === undefined ? undefined : Number(configuredPort);
if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65_535))
  throw new Error("AELIQO_BRIDGE_PORT must be an integer from 0 through 65535");
const app = createAeliqoServer({
  port,
  workspaceId: process.env.AELIQO_WORKSPACE_ID,
  rendererId: process.env.AELIQO_RENDERER_ID,
});
await app.bridge.ready;
await app.server.connect(new StdioServerTransport());
console.error(`Aeliqo bridge listening on ws://127.0.0.1:${app.bridge.port}`);
console.error(`Authorized target: workspace ${app.bridge.identity.workspaceId}; renderer ${app.bridge.identity.rendererId ?? "chosen by the first authorized pairing"}`);
const identityQuery = new URLSearchParams({
  aeliqoBridgePort:String(app.bridge.port),
  aeliqoWorkspaceId:app.bridge.identity.workspaceId,
});
if(app.bridge.identity.rendererId) identityQuery.set("aeliqoRendererId",app.bridge.identity.rendererId);
console.error(`Pair this workspace: http://127.0.0.1:5173/playground/?${identityQuery}#aeliqoPairToken=${app.bridge.pairingToken}`);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
};
process.on("SIGINT", () => {
  void close();
});
process.on("SIGTERM", () => {
  void close();
});
process.stdin.on("end", () => {
  void close();
});
