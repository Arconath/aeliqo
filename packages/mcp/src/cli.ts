import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAeliqoServer } from "./server.js";

const app = createAeliqoServer();
await app.bridge.ready;
await app.server.connect(new StdioServerTransport());
console.error(`Aeliqo bridge listening on ws://127.0.0.1:${app.bridge.port}`);
console.error(`Pair this workspace: http://127.0.0.1:5173/?aeliqoBridgePort=${app.bridge.port}#aeliqoPairToken=${app.bridge.pairingToken}`);
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
