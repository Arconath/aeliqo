# Local agent integration

This recipe connects one local Aeliqo workspace to MCP or a server-side BYOK provider. It uses the public `@aeliqo/mcp` and `@aeliqo/byok` package boundaries. It does not create a remote multi-user service.

## MCP

Configure one process for one intended workspace:

For Codex CLI, run:

```bash
codex mcp add aeliqo-operations \
  --env AELIQO_WORKSPACE_ID=operations \
  --env AELIQO_RENDERER_ID=operations-main \
  -- npx --yes @aeliqo/mcp
```

The equivalent generic MCP client configuration is:

```json
{
  "mcpServers": {
    "aeliqo-operations": {
      "command": "npx",
      "args": ["--yes", "@aeliqo/mcp"],
      "env": {
        "AELIQO_WORKSPACE_ID": "operations",
        "AELIQO_RENDERER_ID": "operations-main"
      }
    }
  }
}
```

Open the pairing URL printed by the process. The credential is in the URL fragment and the Aeliqo browser integration removes it after parsing. Keep that URL out of screenshots and logs. Stop or revoke the process to invalidate the credential. MCP client cancellation is forwarded to work still pending in the browser bridge; a mutation whose delivery is ambiguous must be inspected before retrying.

## BYOK on loopback

Install the three server packages and a TypeScript runner:

```bash
npm install @aeliqo/core @aeliqo/mcp @aeliqo/byok
npm install --save-dev tsx
```

Copy [`apps/companion/examples/byok-local-server.ts`](../../../apps/companion/examples/byok-local-server.ts) into the backend and run it with `npx tsx byok-local-server.ts`. Supply `OPENAI_API_KEY` in the process environment and optionally `OPENAI_MODEL`; do not put either value in browser code, Vite variables, tool arguments, saved workspace state, or request JSON.

The example binds HTTP and WebSocket listeners to `127.0.0.1`, accepts only `http://127.0.0.1:5173`, requires the pairing bearer credential, and bounds input size, concurrency, tool turns, and time. Change the allowed local origin in source when the application uses another loopback origin; do not accept arbitrary origins.

The host application still owns data authorization. Its `DataPort` should expose only datasets and snapshots that the paired user may read. A remote deployment needs application authentication, authorization, TLS, rate and cost limits, audit handling, and its own pairing lifecycle before it can expose BYOK safely.

## Evidence boundary

The repository runs the MCP SDK through stdio and a real browser bridge. BYOK browser flow tests use a deterministic provider, while the OpenAI request contract is mocked. A paid-provider run remains an external release check. WebMCP remains optional and experimental; adapter registration is separate from current native-host verification.
