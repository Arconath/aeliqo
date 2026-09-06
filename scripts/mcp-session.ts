import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const client = new Client({ name: "codex-live-proof", version: "2.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", "apps/companion/src/cli.ts"],
  cwd: process.cwd(),
  stderr: "pipe",
});
await client.connect(transport);
const transcript: unknown[] = [];
mkdirSync("docs/evidence", { recursive: true });
console.log(JSON.stringify({ ready: true, tools: await client.listTools() }));
for await (const line of createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  if (!line.trim()) continue;
  if (line === "exit") break;
  try {
    const request = JSON.parse(line) as {
      name: string;
      arguments: Record<string, unknown>;
      intent?: string;
    };
    const start = performance.now();
    const response = await client.callTool({
      name: request.name,
      arguments: request.arguments,
    });
    const event = {
      timestamp: new Date().toISOString(),
      intent: request.intent,
      request,
      response,
      transportAndExecutionMs: performance.now() - start,
    };
    transcript.push(event);
    writeFileSync(
      "docs/evidence/codex-live-mcp.json",
      JSON.stringify(transcript, null, 2) + "\n",
    );
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
await client.close();
