# Aeliqo

Aeliqo turns typed requests into views of application data. Describe a dataset
once, then request a list, a filtered result, a monthly trend, or a per-team
chart. Aeliqo validates the request, evaluates the permitted data, and selects
a registered view that fits the answer and the space available on screen.

The host application owns identity, permissions, data access, routes, and
business effects. Start with one region in an existing screen; registered
workspaces and pages can follow when you need several results together.

The same path works from application code or an optional agent. Agent input
cannot supply HTML, executable code, permissions, or an unregistered view.

[Documentation](https://docs.aeliqo.com/) · [Playground](https://docs.aeliqo.com/playground/) · [Component catalog](https://docs.aeliqo.com/components/)

## Quick start

This checkout targets **0.6.3**. Published versions and installation status are
shown in the [package guide](https://docs.aeliqo.com/reference/packages/).
For the React example below, use React 19.2 or a newer 19.x release and install matching
Aeliqo package versions:

```sh
npm install --save-exact \
  @aeliqo/core@0.6.3 \
  @aeliqo/runtime@0.6.3 \
  @aeliqo/web@0.6.3 \
  @aeliqo/react@0.6.3
```

The [React quickstart](https://docs.aeliqo.com/start/) registers one local People
dataset and asks four questions: everyone, one team, hires per month, and hires
per team. It renders tables and charts without a model or backend. The
[registered app tutorial](https://docs.aeliqo.com/start/registered-app/)
extends that setup with application-owned permissions and actions.

Never mix Aeliqo package versions in one application.

If React already owns a complete read-only array, the local surface API gives
you a smaller setup:

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

export function People({ rows }: { rows: readonly { id: string; name: string }[] }) {
  const surface = useDataSurface({ data: rows, getRowId: (row) => row.id });
  return <AdaptiveSurface surface={surface} />;
}
```

Follow the [local data guide](https://docs.aeliqo.com/guides/local-data/) for
this API's setup and limits, or the [React package guide](docs/packages/react.md)
for its full contract. If your screen already chooses its views and owns its
interaction state, use [standalone components](https://docs.aeliqo.com/start/standalone-components/)
directly. Register an app when requests need shared resource definitions,
permission checks, actions, or automatic view selection.

The common application entry points are:

```ts
import { defineResource } from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime';
import { registerAeliqoElements } from '@aeliqo/web';
import { createAeliqoApp } from '@aeliqo/web/app';
import { AeliqoProvider, AeliqoRegion } from '@aeliqo/react';
import { createAppToolEndpoint } from '@aeliqo/agent';
```

The optional agent entry point additionally requires `@aeliqo/agent@0.6.3`.
Each package root contains its primary API. Component families, query planning,
transport adapters, and other advanced APIs use explicit package subpaths.

## Packages

| Package           | Responsibility                                                       |
| ----------------- | -------------------------------------------------------------------- |
| `@aeliqo/core`    | Wire contracts, resource definitions, and intent compilation         |
| `@aeliqo/runtime` | Data, authority checks, Results, Regions, actions, and runtime state |
| `@aeliqo/web`     | Shared web components, browser registration, and adaptive app facade |
| `@aeliqo/react`   | React provider, Region, hooks, and family wrappers                   |
| `@aeliqo/agent`   | Bounded app tools and optional MCP, WebMCP, and model adapters       |

The public component library supports host token customization. The Aeliqo site
uses the same canonical token source and provides system, light, and dark themes.

## Try it

- [Playground](https://docs.aeliqo.com/playground/): choose an intent manually or
  connect a browser agent through experimental WebMCP. Try a component, an
  analytical workspace, and a page with a registered header and sidebar.
- [MCP and BYOK locally](https://docs.aeliqo.com/agents/mcp/): clone the standalone
  [`examples/local-agent`](examples/local-agent/) app. It exposes HTTP and stdio
  tools; an optional host model uses the same bounded loop. Startup makes no
  model calls, and credentials stay in the Node process.

Agent transports and model ports are independent of the rendering runtime.
Your app can use Aeliqo without an agent or supply a compatible agent/model
adapter without changing its data and permission rules.

## Examples

- [`examples/quickstart`](examples/quickstart/src/app.ts) is the complete
  resource-to-Region integration used by the documentation.
- [`examples/vnext/page-goal`](examples/vnext/page-goal/main.ts) grows one
  mounted Region from a component to a workspace and a registered page. Follow
  the [step-by-step tutorial](https://docs.aeliqo.com/guides/workspace/).
- [Framework examples](docs/examples/platform.md) cover Vanilla, React, and
  Vue hosts.
- [The vertical slice](docs/examples/vertical-slice.md) follows a
  Task through evaluation, Result storage, and presentation.
- [The reference host](docs/examples/reference-host.md) implements
  the synthetic HTTP data contract behind an application-owned server.

## Development

Follow [CONTRIBUTING.md](CONTRIBUTING.md#local-setup) for the complete setup.
Use Node.js `24.20.0`, pnpm `11.24.0`, Python 3, and Go `1.27.0`. The full
check also needs the Playwright browsers installed:

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm check
```

On macOS, plain `pnpm exec playwright install chromium firefox webkit` is enough;
`--with-deps` also installs the required system libraries on Linux.

See [AGENTS.md](AGENTS.md) for repository boundaries and the verification
matrix. Technical guides are maintained under [`docs/`](docs/README.md).
Current published versions and open work are in [docs/STATUS.md](docs/STATUS.md).

## Security and license

Report sensitive vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/Arconath/aeliqo/security/advisories/new).
For reproducible non-sensitive defects, see [SUPPORT.md](SUPPORT.md). Do not
include credentials, customer records, or proprietary data in examples or
issues.

Aeliqo is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE)
and [TRADEMARKS.md](TRADEMARKS.md) for attribution and project-name guidance.
