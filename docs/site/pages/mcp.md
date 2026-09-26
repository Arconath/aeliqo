---
id: 'mcp'
path: '/agents/mcp/'
section: 'AI agents'
title: 'MCP'
description: 'Connect an MCP client to the bounded Aeliqo endpoint through a trusted local host.'
---

MCP connects an agent client to one bounded Aeliqo endpoint. Your application
still reads current authority, compiles the same intent as the interface, and
commits only through the paired Region. MCP never selects a browser tab or
grants access by itself.

## Start the local runner

1. From the repository root, run:

   ```bash
   pnpm playground:local
   ```

   You should see three printed lines: the playground address
   (`http://127.0.0.1:4174/playground/`), the MCP endpoint
   (`http://127.0.0.1:4174/mcp`) with a bearer token, and the stdio launch
   command. Copy the token.

2. Open `http://127.0.0.1:4174/playground/` — the runner's own copy of the
   playground.

   Use this local copy. The hosted site cannot pair with your runner; the
   browser blocks cross-site pairing for security reasons.

## Pair the browser session

1. On the local playground page, choose **Connect AI**.
2. Keep **Local Playground host** selected and choose **Check connection**.
   You should see “Local runner connected — MCP endpoint is ready”, plus two
   copyable client configs.
3. Keep the bearer token private. It authorizes MCP calls against your paired
   Region.

The session lasts 15 minutes, stays paired to one Region, and ends on
disconnect or expiry. The endpoint reports `renderer-ready` only after the
browser acknowledges a committed render.

## Connect your MCP client

For Cursor or another client that accepts a remote URL, add a Streamable HTTP
server:

```json
{
  "mcpServers": {
    "aeliqo-playground": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:4174/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

For Claude Desktop or another client that launches a child process, add the
stdio bridge:

```json
{
  "mcpServers": {
    "aeliqo-playground": {
      "command": "pnpm",
      "args": ["--dir", "apps/site", "mcp:stdio"],
      "env": {
        "AELIQO_LOCAL_URL": "http://127.0.0.1:4174",
        "AELIQO_MCP_TOKEN": "<token>"
      }
    }
  }
}
```

Replace `<token>` with the printed bearer token. The `--dir apps/site` path is
relative to the repository root; use an absolute path if your client launches
elsewhere. The bridge keeps stdout for MCP frames and forwards calls to the
loopback runner. Both transports refuse calls until a browser session is
paired, and the endpoint binds to loopback only. This is a development
integration, not a network deployment template.

## Know the three tools

| Tool             | What it accepts                                                | What proves success                                                                            |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `aeliqo_context` | No authority claims from the caller                            | Current host-approved resources, fields, meanings, actions, and views                          |
| `aeliqo_render`  | A bounded structured intent using discovered IDs and revisions | A trusted receipt, ending in `renderer-ready` only after browser acknowledgement               |
| `aeliqo_act`     | A proposal for a registered action                             | A staged receipt; consequential effects still require application policy and user confirmation |

Call `aeliqo_context` first. If the requested field, meaning, action, or view
is absent or ambiguous, stop and ask for a choice. Never substitute another
metric or claim the UI changed without a renderer receipt.

## Keep the session bounded

- Pair one session with one task identity and Region.
- Reject unknown origins, expired credentials, cross-Region calls, and replay.
- Bound pending calls, elapsed time, request and response bytes, and tool loops.
- Propagate cancellation through evaluation and rendering.
- Keep credentials, private rows, and confirmation callbacks out of discovery.
- Close the endpoint on disconnect and reject late discovery or invocation.

## Deploy a remote server

For a remote HTTP server, use HTTPS and an application-owned OAuth resource
server. Follow the
[MCP 2025-11-25 authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization):
publish protected-resource metadata, discover the authorization server, use
PKCE, bind the token to the canonical MCP resource, send the token in the
`Authorization` header, validate audience and expiry, and return `401` or `403`
challenges as specified. The OAuth flow applies to HTTP transports; stdio
receives credentials from its launch environment.

## Test your integration

Test initialization and protocol negotiation, the exact three-tool list, a
valid render with browser acknowledgement, an unknown field, expired
authentication, cancellation during pending work, disconnect, and a late call
after closure. See [agent recovery](/agents/recovery/) for expiry and
uncertain action outcomes.

<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/byok/"><span>BYOK model loop</span><small>Add a provider model to the same paired session.</small><b aria-hidden="true">→</b></a><a href="/agents/recovery/"><span>Agent recovery</span><small>Handle expiry, failure, and uncertain outcomes.</small><b aria-hidden="true">→</b></a></nav>
