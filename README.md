# Aeliqo

Aeliqo turns a typed application intent into a registered interface. The host
application owns identity, permissions, data access, routes, and business
effects. Aeliqo validates the request, evaluates the permitted data, selects a
registered view, and reports the outcome.

The same path works from application code or an optional agent. Agent input
cannot supply HTML, executable code, permissions, or an unregistered view.

[Documentation](https://docs.aeliqo.com/) · [Playground](https://docs.aeliqo.com/playground/) · [Component catalog](https://docs.aeliqo.com/components/)

## Quick start

Install the packages used by a browser application:

```sh
npm install --save-exact \
  @aeliqo/core@0.4.2 \
  @aeliqo/runtime@0.4.2 \
  @aeliqo/web@0.4.2
```

The complete [quickstart](https://docs.aeliqo.com/start/) defines a resource,
connects a bounded local data source and trusted authority adapter, mounts a
Region, and renders an intent. It uses the same source that the documentation
build typechecks.

The published stable line is `0.4.2`. The breaking `0.5.0` vNext release line
is being cut over through the owner-approved release workflow; use its package
install command only after that workflow publishes the matching five packages.
Never mix `0.4.2` and `0.5.0` packages in one application.

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
