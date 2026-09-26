---
id: "mcp"
path: "/agents/mcp/"
section: "AI agents"
title: "MCP"
description: "Connect an MCP client to the bounded Aeliqo endpoint through a trusted local host."
---

MCP connects an agent client to one bounded Aeliqo endpoint. The application
still reads current authority, compiles the same intent as the interface, and
commits only through the paired Region. MCP never selects a browser tab or
grants access by itself.

## Run a local session

From the repository root, start the local runner:

```sh
pnpm playground:local
```

Open the printed local URL. In the playground, choose **Connect AI** and select
the local host. The runner prints the Streamable HTTP endpoint, temporary
bearer credential, and complete stdio launch command. The browser session lasts
15 minutes, remains paired to one Region, and is released on disconnect or
expiry. The browser must acknowledge a committed render before the endpoint
reports `renderer-ready`.

## Choose a transport

Use stdio when the MCP client launches a child process. The bridge keeps stdout
for MCP frames and connects back to the loopback runner. Use Streamable HTTP
when the client connects to the already running host. The local endpoint
requires the printed bearer credential, refuses an unpaired browser, and binds
to loopback. It is a development integration, not a network deployment
template.

For a remote HTTP server, use HTTPS and an application-owned OAuth resource
server. Follow the [MCP 2025-11-25 authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): publish protected-resource metadata, discover the authorization server, use PKCE, bind the token to the canonical MCP resource, send the token in the `Authorization` header, validate audience and expiry, and return `401` or `403` challenges as specified. The OAuth flow applies to HTTP transports; stdio receives credentials from its launch environment.

## Understand the three tools

| Tool | What it accepts | What proves success |
| --- | --- | --- |
| `aeliqo_context` | No authority claims from the caller | Current host-approved resources, fields, meanings, actions, and views |
| `aeliqo_render` | A bounded structured intent using discovered IDs and revisions | A trusted receipt, ending in `renderer-ready` only after browser acknowledgement |
| `aeliqo_act` | A proposal for a registered action | A staged receipt; consequential effects still require application policy and user confirmation |

Call `aeliqo_context` first. If the requested field, meaning, action, or view is
absent or ambiguous, stop and ask for a choice. Do not substitute another
metric or claim that the UI changed without a renderer receipt.

## Session requirements

- Pair one session with one task identity and Region.
- Reject unknown origins, expired credentials, cross-Region calls, and replay.
- Bound pending calls, elapsed time, request and response bytes, and tool loops.
- Propagate cancellation through evaluation and rendering.
- Keep credentials, private rows, and confirmation callbacks out of discovery.
- Close the endpoint on disconnect and reject late discovery or invocation.

For a consumer integration, test initialization and protocol negotiation, the
exact three-tool list, a valid render with browser acknowledgement, an unknown
field, expired authentication, cancellation during pending work, disconnect,
and a late call after closure. See [agent recovery](/agents/recovery/) for
expiry and uncertain action outcomes.
