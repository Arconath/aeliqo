# Aeliqo

Aeliqo turns a typed application intent into a registered interface. The host
application owns identity, permissions, data access, routes, and business
effects. Aeliqo validates the request, evaluates the permitted data, selects a
registered view, and reports the outcome.

The same path works from application code or an optional agent. Agent input
cannot supply HTML, executable code, permissions, or an unregistered view.

[Documentation](https://docs.aeliqo.com/) · [Playground](https://docs.aeliqo.com/playground/) · [Component catalog](https://docs.aeliqo.com/components/)

## Quick start

After `0.5.0` is published to npm, install the packages used by a browser
application at the same exact version:

```sh
npm install --save-exact \
  @aeliqo/core@0.5.0 \
  @aeliqo/runtime@0.5.0 \
  @aeliqo/web@0.5.0
```

The complete [quickstart](https://docs.aeliqo.com/start/) defines a resource,
connects a bounded local data source and trusted authority adapter, mounts a
Region, and renders an intent. It uses the same source that the documentation
build typechecks.

The breaking `0.5.0` line is distributed through the release workflow. Before
its registry publication, use this repository's locked source checkout for
the 0.5 examples. `0.4.2` remains available for older applications. Never mix
package versions in one application.

The 0.5.0 source also has a small React path for a complete local array:

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

export function People({ rows }: { rows: readonly { id: string; name: string }[] }) {
  const surface = useDataSurface({ data: rows, getRowId: row => row.id });
  return <AdaptiveSurface surface={surface} />;
}
```

This API is described in the [React package guide](docs/packages/react.md).
It is absent from `0.4.2` and the historical `0.5.0-rc.1`, which was published
from an earlier source revision. Check the exact registry version before
installing the newer path.

The common application entry points are:

```ts
import { defineResource } from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime';
import { createAeliqoApp, registerAeliqoElements } from '@aeliqo/web';
import { AeliqoProvider, AeliqoRegion } from '@aeliqo/react';
import { createAppToolEndpoint } from '@aeliqo/agent';
```

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

## Examples

- [`examples/quickstart`](examples/quickstart/src/app.ts) is the complete
  resource-to-Region integration used by the documentation.
- [Framework examples](docs/examples/platform.md) cover Vanilla, React, and
  Vue hosts.
- [The vertical slice](docs/examples/vertical-slice.md) follows a
  Task through evaluation, Result storage, and presentation.
- [The reference host](docs/examples/reference-host.md) implements
  the synthetic HTTP data contract behind an application-owned server.

## Development

Use Node.js `24.20.0` and pnpm `11.24.0`:

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm check
```

See [AGENTS.md](AGENTS.md) for repository boundaries and the verification
matrix. Technical guides are maintained under [`docs/`](docs/README.md).

## Security and license

Report sensitive vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/Arconath/aeliqo/security/advisories/new).
For reproducible non-sensitive defects, see [SUPPORT.md](SUPPORT.md). Do not
include credentials, customer records, or proprietary data in examples or
issues.

Aeliqo is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE)
and [TRADEMARKS.md](TRADEMARKS.md) for attribution and project-name guidance.
