---
id: "mcp"
path: "/agents/mcp/"
section: "Connect agents"
title: "MCP"
description: "Connect an MCP client to the bounded Aeliqo endpoint through a trusted local host."
---

MCP connects an agent client to the bounded Aeliqo endpoint. The host still
checks current authority, compiles the same intent, and uses the paired Region.

## Run a local session

From the repository root, start the local runner:

```sh
pnpm playground:local
```

Open the printed local URL. In the playground, choose **Connected agent** and
select the local host. The runner prints the HTTP endpoint, temporary bearer
credential, and stdio launch command. Keep the runner process open while the
client is connected. The browser must acknowledge a render before the endpoint
reports that the view is ready.

## Choose a transport

Use stdio when the MCP client launches a child process. Use the local HTTP
endpoint and temporary bearer credential when the client connects to the
already running host. Both transports expose `aeliqo_context`,
`aeliqo_render`, and `aeliqo_act`. The local runner binds to loopback and is not
a template for exposing an MCP server to the network.

## Session requirements

- Pair one session with one task identity and Region.
- Reject unknown origins, expired credentials, cross-Region calls, and replay.
- Bound pending calls, elapsed time, request and response bytes, and tool loops.
- Propagate cancellation through evaluation and rendering.
- Keep credentials, private rows, and confirmation callbacks out of discovery.

For a consumer integration, test initialization, the three-tool list, a valid
render, rejection of an unknown field, and disconnect during pending work. See
[agent recovery](/agents/recovery/) for expiry and uncertain action outcomes.
