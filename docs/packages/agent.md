# `@aeliqo/agent`

`@aeliqo/agent` connects an optional agent session to an existing Aeliqo
application. Its root entry exposes the application tool endpoint; protocol and
model integrations stay on explicit subpaths.

## Main entry point

```ts
import { createAppToolEndpoint } from '@aeliqo/agent';

const endpoint = createAppToolEndpoint({
  runtime: app.runtime,
  render: app,
  regionId: 'people-main',
  goalEpoch: 'people-session-1',
  transport: 'mcp',
  expiresAt: Date.now() + 30 * 60_000,
});
if (!endpoint.ok) throw new Error(endpoint.diagnostics[0].message);
```

The endpoint exposes bounded context, render, and action tools for one paired
Region. Protected actions still require host policy and user confirmation.
Agent proposals cannot add a resource, action, permission, renderer, endpoint,
or executable code.

## Optional integrations

| Subpath | Responsibility |
| --- | --- |
| `@aeliqo/agent/mcp` | MCP client and server adapters |
| `@aeliqo/agent/webmcp` | Browser WebMCP capability adapter |
| `@aeliqo/agent/model` | Provider-neutral model tool loop |
| `@aeliqo/agent/model/openai` | OpenAI model adapter |
| `@aeliqo/agent/model/responses` | Responses transport integration |
| `@aeliqo/agent/protocol` | Lower-level Aeliqo agent protocol endpoint |
| `@aeliqo/agent/capabilities` | Host-owned capability registry and dispatch |
| `@aeliqo/agent/session` | Session scope, expiry, and lifecycle |
| `@aeliqo/agent/meaning` | Meaning-related agent capabilities |

Install optional provider or transport dependencies only for the integrations
the host enables. Keep credentials in the host and outside prompts or tool
arguments.
