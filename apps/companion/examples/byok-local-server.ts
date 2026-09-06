import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { createAeliqoServer } from "@aeliqo/mcp";
import { runAgent, type ProviderAdapter } from "@aeliqo/byok";
import { createOpenAIProvider } from "@aeliqo/byok/openai";

const localOrigin = "http://127.0.0.1:5173";

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (Buffer.byteLength(body) > 8_192)
      throw new Error("Request exceeds 8 KB");
  }
  return JSON.parse(body) as unknown;
}

/**
 * Runnable local-only BYOK recipe using only public Aeliqo packages.
 * Keep the returned pairing token private and stop this process to revoke it.
 */
export function createLocalByokServer(options: {
  provider?: ProviderAdapter;
  apiKey?: string;
  model?: string;
  httpPort?: number;
  bridgePort?: number;
  workspaceId?: string;
  rendererId?: string;
} = {}) {
  const mcp = createAeliqoServer({
    port: options.bridgePort ?? 0,
    allowedOrigins: [localOrigin],
    workspaceId: options.workspaceId,
    rendererId: options.rendererId,
  });
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const provider =
    options.provider ??
    (apiKey
      ? createOpenAIProvider({
          apiKey,
          model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        })
      : undefined);
  let busy = false;
  const lifetime = new AbortController();
  const http = createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(value));
    };
    if (
      !/^127\.0\.0\.1:\d+$/.test(request.headers.host ?? "") ||
      request.headers.origin !== localOrigin
    ) {
      send(403, { error: "Untrusted local origin" });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", localOrigin);
    response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "POST");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      response.writeHead(204);
      response.end();
      return;
    }
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    if (!mcp.bridge.authorize(token)) {
      send(401, { error: "Pairing credential required" });
      return;
    }
    if (request.method !== "POST" || request.url !== "/byok") {
      send(404, { error: "Unknown endpoint" });
      return;
    }
    if (request.headers["content-type"] !== "application/json") {
      send(415, { error: "Expected application/json" });
      return;
    }
    if (busy) {
      send(409, { error: "An intent is already running" });
      return;
    }
    if (!provider) {
      send(503, { error: "OPENAI_API_KEY is not configured" });
      return;
    }
    const client = new AbortController();
    const abortClient = () => client.abort(new Error("BYOK client disconnected"));
    request.once("aborted", abortClient);
    response.once("close", () => {
      if (!response.writableEnded) abortClient();
    });
    try {
      const parsed = (await jsonBody(request)) as { intent?: unknown };
      if (
        typeof parsed.intent !== "string" ||
        !parsed.intent.trim() ||
        parsed.intent.length > 4_000 ||
        Object.keys(parsed).some((key) => key !== "intent")
      )
        throw new Error("Expected only an intent string");
      busy = true;
      try {
        const signal = AbortSignal.any([
          lifetime.signal,
          mcp.bridge.revocationSignal,
          client.signal,
          AbortSignal.timeout(60_000),
        ]);
        const result = await runAgent(
          provider,
          parsed.intent,
          (name, input, dispatchOptions) =>
            mcp.bridge.request(name, input, "BYOK", dispatchOptions),
          { output: "workspace", signal },
        );
        send(200, result);
      } finally {
        busy = false;
      }
    } catch (error) {
      send(400, {
        error: error instanceof Error ? error.message : "Intent failed",
      });
    }
  });
  const ready = Promise.all([
    mcp.bridge.ready,
    new Promise<void>((resolve, reject) => {
      http.once("error", reject);
      http.listen(options.httpPort ?? 0, "127.0.0.1", resolve);
    }),
  ]);
  http.requestTimeout = 10_000;
  return {
    mcp,
    ready,
    get port() {
      const address = http.address();
      if (!address || typeof address === "string") throw new Error("Not listening");
      return address.port;
    },
    close: async () => {
      lifetime.abort();
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
      await mcp.close();
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = createLocalByokServer({
    httpPort: Number(process.env.AELIQO_BYOK_PORT ?? 4319),
    bridgePort: Number(process.env.AELIQO_BRIDGE_PORT ?? 4318),
    workspaceId: process.env.AELIQO_WORKSPACE_ID,
    rendererId: process.env.AELIQO_RENDERER_ID,
  });
  await app.ready;
  const query = new URLSearchParams({
    aeliqoBridgePort: String(app.mcp.bridge.port),
    aeliqoCompanionPort: String(app.port),
    aeliqoWorkspaceId: app.mcp.bridge.identity.workspaceId,
  });
  if (app.mcp.bridge.identity.rendererId)
    query.set("aeliqoRendererId", app.mcp.bridge.identity.rendererId);
  console.error(
    `Pair the local workspace: ${localOrigin}/playground/?${query}#aeliqoPairToken=${app.mcp.bridge.pairingToken}`,
  );
  const close = () => void app.close();
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
