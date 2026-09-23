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
| `@aeliqo/agent/browser` | Optional scoped bridge for explicit surface targets |

## Scoped browser bridge (0.5)

`connectAgent` pairs a host-owned client to an already authorized scope and an
explicit target allowlist. The host registers each target with a live surface;
the bridge does not search the DOM or discover every surface in the runtime.
This entry belongs to the 0.5 release line. The historical `0.5.0-rc.1` was
built from an earlier revision; verify its export
map before attempting to use this entry from that package.

```ts
import { connectAgent, type AgentClient } from '@aeliqo/agent/browser';

const client: AgentClient = {
  kind: 'host-agent-client',
  registeredTargets: [{ id: 'people-main', surface: peopleSurface }],
};
const connection = connectAgent({
  scope: authorizedScope,
  client,
  targets: ['people-main'],
});
// The host disconnects this pairing when its screen or session ends.
connection.disconnect();
```

`peopleSurface` and `authorizedScope` above are application-owned values,
created through `@aeliqo/runtime/surfaces` and
`@aeliqo/runtime/scopes`. The snippet shows the bridge boundary; the complete
synthetic setup and cleanup are in `examples/vnext/journeys` and
`tests/vnext/fixtures/agent.ts`. A target's optional `render` callback may
acknowledge a renderer-ready revision; without it, a committed controller
request is not proof that a view rendered. When authority, activation epoch,
target, or principal changes, the old pairing is fenced and scoped conversation
continuity must reset. The target list grants no new data permission.

Install optional provider or transport dependencies only for the integrations
the host enables. Keep credentials in the host and outside prompts or tool
arguments.

## Model profile configuration

Use `createOpenAICompatibleToolModel` for a generic Chat Completions endpoint.
Its `baseURL`, model ID, auth scheme, capabilities, and egress policy are
explicit configuration; the adapter never infers a provider or model from a
hostname or key format. `auth: { scheme: 'none' }` is limited to an explicit
loopback endpoint (`localhost`, `127.0.0.1`, or `[::1]`) whose exact origin is
in `policy.allowedOrigins`. HTTP additionally requires explicit insecure-HTTP
permission. Hosted
bearer and custom-header connections require a server-owned
`createOpaqueModelSecret` handle, and missing credentials fail closed.

The model connection is non-streaming and supports bounded retries,
cancellation, request/response limits, optional provider usage, and local input
token estimation. Declare only capabilities the endpoint actually supports;
protocol fixtures do not qualify model quality or live provider support.
