---
id: 'packages'
path: '/reference/packages/'
section: 'Reference'
title: 'Packages and entry points'
description: 'Five public packages, their root APIs, and the subpaths for specialized work.'
---

<p class="lead">Pick the smallest entry point that does the work. Each package root covers the common jobs; specialized APIs live on explicit subpaths.</p>

| Package           | Root provides                                                              | Documented subpaths                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aeliqo/core`    | Contracts, typed parsers, `defineResource`, `compileIntent`, primary types | `app`, `agent`, `contracts`, `expressions`, `features`, `interaction`, `plot`, `presentation`, `query`, `schema`, `schemas/*`, `semantics`, `visualization` |
| `@aeliqo/runtime` | `createAeliqoRuntime` and runtime types                                    | `actions`, `app`, `audit`, `data`, `evaluation`, `interaction`, `meaning`, `persistence`, `presentation`, `regions`, `results`, `scopes`, `surfaces`        |
| `@aeliqo/web`     | Element registration and recipe policy types                               | `app`, `server`, `region`, `recipes`, `register`, `events`, `styles`, `table`, `chart`, plus the family and component entries below                         |
| `@aeliqo/react`   | Provider, Region, render and surface hooks, element registration           | `app`, `surface`, `ssr`, `foundation`, `inputs`, `navigation`, `feedback`, `data`, `plot`, `visualization`, `compound`                                      |
| `@aeliqo/agent`   | `createAppToolEndpoint` and endpoint types                                 | `app`, `browser`, `capabilities`, `mcp`, `meaning`, `model`, `model/openai`, `model/responses`, `protocol`, `session`, `webmcp`                             |

`@aeliqo/web` also publishes family entries: `foundation`, `inputs`,
`navigation`, `feedback`, `data`, `plot`, `visualization`, and `compound`.
Grouped entries cover `visualization/temporal`, `visualization/cartesian`,
`visualization/hierarchy`, `region/adaptation`, `foundation/manifest`, and
`inputs/manifest`. Each catalog component imports from its own subpath, such as
`@aeliqo/web/text-field` or `@aeliqo/web/search-results`.

The dependency direction is `core → runtime → web → react`. `agent` may depend
on `core` and `runtime`. The public site may consume all five packages; package
code never imports the site.

## Runtime boundaries

- `core` has no browser, network, or application-state dependency.
- `runtime` does not access the DOM. Supply data and business effects through
  host adapters.
- `web` owns custom elements and browser registration. Its root is safe to
  import without the runtime package; call registration from a client
  boundary. The application facade is available from `@aeliqo/web/app` and
  requires `@aeliqo/runtime`.
- `react` delegates rendering and behavior to `web`; import wrappers from the
  family subpaths. The package requires React 19 and the matching
  `@aeliqo/runtime` peer.
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

Component-only consumers can install only `@aeliqo/web`; skip `@aeliqo/agent`
when no agent connects.

<aeliqo-release-status></aeliqo-release-status>

The historical `0.5.0-rc.1` was published from an earlier source revision. It
does not contain the React local data path documented here. Do not mix package
versions or treat an earlier RC as evidence for the current source.
Wire contract version `"1"` is independent of either npm version. See the
[0.3 to 0.4 migration guide](/ship/migration-0.3/) for older integrations and the
[0.4 to 0.5 migration guide](/ship/migration-0.4/) for this release line.
