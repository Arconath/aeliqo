---
id: 'packages'
path: '/reference/packages/'
section: 'Reference'
title: 'Packages and entry points'
description: 'Five public packages, their root APIs, and the subpaths for specialized work.'
---

Each package root exposes its common entry point. Import specialized capabilities
from the owning subpath so the dependency is clear at the call site.

| Package           | Root API                                                                                                          | Common subpaths                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `@aeliqo/core`    | Contracts, typed parsers, `defineResource`, `compileIntent`, primary types                                        | `features`, `schema`, `expressions`, `semantics`, `query`, `interaction`, `presentation`, `plot`, `visualization`              |
| `@aeliqo/runtime` | `createAeliqoRuntime` and runtime types                                                                           | `data`, `evaluation`, `results`, `regions`, `surfaces`, `scopes`, `actions`, `presentation`, `persistence`, `audit`, `meaning` |
| `@aeliqo/web`     | Element registration, recipes                                                                                     | `app`, `foundation`, `inputs`, `navigation`, `feedback`, `data`, `plot`, `visualization`, `compound`, `region`, `server`       |
| `@aeliqo/react`   | Provider, Region, local data surface hooks, element registration; requires React 19 and the matching runtime peer | `surface`, `foundation`, `inputs`, `navigation`, `feedback`, `data`, `plot`, `visualization`, `compound`, `ssr`                |
| `@aeliqo/agent`   | `createAppToolEndpoint` and endpoint types                                                                        | `protocol`, `mcp`, `webmcp`, `model`, `capabilities`, `session`, `meaning`                                                     |

The dependency direction is `core → runtime → web → react`. `agent` may depend
on `core` and `runtime`. The public site may consume all five packages; package
code never imports the site.

## Runtime boundaries

- `core` has no browser, network, or application-state dependency.
- `runtime` does not access the DOM. Data and business effects are supplied by
  host adapters.
- `web` owns custom elements and browser registration. Its root is safe to
  import without the runtime package; call registration from a client
  boundary. The application facade is available from `@aeliqo/web/app` and
  requires `@aeliqo/runtime`.
- `react` delegates rendering and behavior to `web`; wrappers are imported from
  family subpaths.
- `agent` receives bounded host capabilities and cannot grant access or add a
  renderer.

Install all five packages on the same exact release when an application uses
them together:

```sh
npm install --save-exact \
  @aeliqo/core@0.5.2 \
  @aeliqo/runtime@0.5.2 \
  @aeliqo/web@0.5.2 \
  @aeliqo/react@0.5.2 \
  @aeliqo/agent@0.5.2
```

Component-only consumers can install just `@aeliqo/web`; skip `@aeliqo/agent`
when no agent connects.

<aeliqo-release-status></aeliqo-release-status>

The historical `0.5.0-rc.1` was published from an earlier source revision and
does not contain the React local data path documented here. Do not mix package
versions or treat an earlier RC as evidence for the current source.
Wire contract version `"1"` is independent of either npm version. See the
[0.3 to 0.4 migration guide](/ship/migration-0.3/) for older integrations and the
[0.4 to 0.5 migration guide](/ship/migration-0.4/) for this release line.
