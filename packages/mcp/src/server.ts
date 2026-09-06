import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capabilityContracts } from "@aeliqo/core";
import { WorkspaceBridge } from "./bridge.js";
import type { BridgeRequest } from "./protocol.js";

export function createAeliqoServer(
  options: { port?: number; timeoutMs?: number; allowedOrigins?: readonly string[]; workspaceId?: string; rendererId?: string } = {},
) {
  const bridge = new WorkspaceBridge(options.port, options.timeoutMs, options.allowedOrigins, {
    workspaceId: options.workspaceId,
    rendererId: options.rendererId,
  });
  const server = new McpServer({ name: "aeliqo", version: "0.1.0" }, {
    instructions: "For changes requested in the paired Aeliqo workspace, inspect, query as needed, apply semantic operations, then verify the receipt. A data query does not change UI. Respect chat-only requests. Never report completion while render or data is pending, failed, or disconnected. This server targets only its explicitly paired workspace and renderer; do not guess another tab. Preserve newer edits and inspect after conflicts or uncertain outcomes.",
  });
  const invoke = async (
    method: BridgeRequest["method"],
    params: unknown,
    signal?: AbortSignal,
  ) => {
    try {
      const result = await bridge.request(method, params, "MCP", { signal });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              error instanceof Error
                ? error.message
                : "Workspace request failed",
          },
        ],
      };
    }
  };
  for (const contract of capabilityContracts) {
    server.registerTool(
      contract.id,
      { description: contract.description, inputSchema: contract.inputSchema },
      (params: unknown, context: { signal: AbortSignal }) =>
        invoke(contract.id, params, context.signal),
    );
  }
  return {
    server,
    bridge,
    close: async () => {
      await server.close();
      await bridge.close();
    },
  };
}
