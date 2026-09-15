# Aeliqo

**Turn validated application intent into adaptive, registered web UI.**

Aeliqo is an Apache-2.0 TypeScript UI framework. A developer registers resources,
data, authority, actions, and allowed views. Application code or an AI agent then
sends a bounded intent such as “browse people”, “compare products”, or “edit this
ticket”. Aeliqo compiles the intent, evaluates permitted data, chooses a compatible
view, adapts it to the Region container, and returns an evidence-backed receipt.

Aeliqo does not generate arbitrary HTML and does not replace your application
boundary. Your product keeps ownership of identity, authorization, data access,
routes, and business effects. The same intent pipeline works without AI.

- **Standards-based UI:** custom elements share one implementation across vanilla JavaScript, React, Vue, and SSR.
- **Evidence-aware results:** scope, grain, completeness, precision, revision, and lineage travel with evaluated data.
- **Progressive adoption:** use one standalone component or mount a complete adaptive Region.
- **Agent-ready, provider-optional:** MCP, WebMCP, and BYOK use the same validated path as application code.
- **One release line:** all public packages use the same exact version.

[Read the documentation](https://docs.aeliqo.com/) · [Open the playground](https://docs.aeliqo.com/playground/) · [Browse the component catalog](https://docs.aeliqo.com/components/)

## Quick start

Install the packages used by a basic browser integration:

```sh
npm install --save-exact \
  @aeliqo/core@0.3.0 \
  @aeliqo/runtime@0.3.0 \
  @aeliqo/web@0.3.0
```

Define one resource and connect bounded local data:

```ts
import {createQueryFunctionRegistry, defineResource} from '@aeliqo/core';
import {createLocalDataService} from '@aeliqo/runtime/data';
import {createAeliqoApp} from '@aeliqo/web/app';
import {z} from 'zod';

const people = defineResource({
  id: 'people', revision: 'people-1', label: 'People', identity: ['id'],
  schema: z.object({id: z.string(), name: z.string(), team: z.string()}),
  fields: {name: {label: 'Name'}, team: {label: 'Team', role: 'dimension'}},
  presentation: {allowedViews: ['table', 'cards']},
});

const functions = createQueryFunctionRegistry({version: '2'});
if (!functions.ok) throw new Error(functions.diagnostics[0].message);
const data = createLocalDataService({
  snapshot: {catalog: people.catalog, sourceRevision: 'people-data-1', records: {
    people: [{id: 'ada', name: 'Ada Chen', team: 'Design'}],
  }},
  functionRegistry: functions.value,
  sourceLimits: {rows: 1_000, bytes: 1_000_000},
  authorize: () => ({ok: true, value: {scopeDigest: 'people', policyRevision: 'policy-1'}}),
});

const app = createAeliqoApp({resources: [{resource: people, data}], authority});
const target = document.querySelector<HTMLElement>('#app');
if (target === null) throw new Error('The app target is missing.');
const mounted = app.mount({target, regionId: 'main', resourceId: 'people'});
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);
const receipt = await app.render({regionId: 'main', intent: {
  version: '1', id: 'browse-people', kind: 'browse', resource: 'people',
  fields: ['name', 'team'],
}});
```

Here `authority` is a trusted application adapter that supplies the current
principal, scope, policy revision, grants, and read context. It is never read from
the intent. The complete, compiled source—including the authority adapter and
cleanup—is in the [quickstart](https://docs.aeliqo.com/start/).

On a wide Region the browse intent can render a table; on a narrow Region it can
render equivalent cards. No model call is needed. An MCP, WebMCP, or BYOK agent
may send the same intent through the three-tool endpoint, but cannot supply a new
view, permission, endpoint, or executable code.

## The five public concepts

| Concept | Responsibility |
| --- | --- |
| **Catalog** | Describes entities, fields, identity, relationships, meanings, and source capabilities. |
| **Intent** | Requests browse, detail, create, edit, compare, analyze, or a registered custom behavior. |
| **Task** | Compiles the intent into required outputs, operations, dependencies, and delivery constraints. |
| **Result** | Carries evaluated values with revision, scope, grain, completeness, precision, and lineage. |
| **Experience** | Constrains presentation so adaptation preserves the task, access, and essential operations. |

This separation lets an interface adapt while keeping the evidence used for each visible claim inspectable.

## Packages

| Package | Purpose |
| --- | --- |
| `@aeliqo/core` | Resources, intent compiler, Catalog, Task, query, presentation, and validation contracts |
| `@aeliqo/runtime` | `/app` orchestration, local/HTTP data, Results, Regions, actions, and audit |
| `@aeliqo/web` | `/app` browser facade, `/recipes`, 71 web components, SVG visualization, and SSR |
| `@aeliqo/react` | Thin `/app` lifecycle and component bindings over the shared web implementation |
| `@aeliqo/agent` | Three-tool `/app` endpoint plus bounded MCP, WebMCP, and host-model adapters |
| `@aeliqo/devtools` | Local authoring and inspection tools |

Keep every Aeliqo package on the same exact version while the API is major-zero.

## Examples

- [`examples/platform`](examples/platform/README.md) demonstrates the shared web implementation from vanilla JavaScript, React, and Vue.
- [`examples/quickstart`](examples/quickstart/src/app.ts) is the complete compiled resource-to-Region starter used by the documentation.
- [`examples/vertical-slice`](examples/vertical-slice/README.md) follows a Task through evaluation, Result storage, and presentation.
- [`examples/reference-host`](examples/reference-host/README.md) exposes the synthetic ADC HTTP contract from an application-owned server.
- The public [playground](https://docs.aeliqo.com/playground/) runs the bounded local runtime against synthetic data and exposes the exact Task and Result contracts.

## Development

Aeliqo requires Node.js `24.20.0` and pnpm `11.24.0`.

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
```

Run the focused test for the package or behavior you changed. Before a release candidate, run:

```sh
pnpm check
pnpm test:release-tooling
pnpm test:docs-artifact
pnpm site:test
```

The required quality suite covers types, unit behavior, package consumers, browser behavior, SSR and hydration, accessibility, security boundaries, scenarios, docs, and the playground. Performance qualification is currently outside the required release pipeline.

See [CONTRIBUTING.md](CONTRIBUTING.md) for review expectations and [docs/README.md](docs/README.md) for technical guides.

## Repository structure

```text
apps/          public web, docs, playground, Studio, and site assembly
packages/      independently published framework packages
examples/      runnable integrations and reference hosts
catalog/       public component catalog metadata
docs/          maintainer and integration guides
tests/         behavior, browser, consumer, accessibility, and security tests
quality/       required source quality command configuration
scripts/       documentation, release, and verification tooling
```

A future private hosted service, billing system, customer-data worker, or proprietary server implementation belongs in a separate private repository.

## Security and support

Use [GitHub private vulnerability reporting](https://github.com/Arconath/aeliqo/security/advisories/new) for sensitive reports. For reproducible non-sensitive defects, see [SUPPORT.md](SUPPORT.md). Do not include credentials, customer records, or proprietary data in examples or issues.

## License

Aeliqo is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) and [TRADEMARKS.md](TRADEMARKS.md) for attribution and project-name guidance.
