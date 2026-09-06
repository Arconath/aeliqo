import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAeliqoServer } from "../../packages/mcp/src/server.js";

const origin = process.argv[2];
if (!origin) throw new Error("An explicit test origin is required");
const app = createAeliqoServer({ port: 0, allowedOrigins: [origin] });
await app.bridge.ready;
await app.server.connect(new StdioServerTransport());
console.error(`AELIQO_TEST_BRIDGE_PORT=${app.bridge.port}`);
console.error(`AELIQO_TEST_PAIR_TOKEN=${app.bridge.pairingToken}`);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
};
process.on("SIGINT", () => { void close(); });
process.on("SIGTERM", () => { void close(); });
process.stdin.on("end", () => { void close(); });
