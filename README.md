# Aeliqo

**Build adaptive interfaces without losing the meaning of the data behind them.**

Aeliqo is an Apache-2.0 TypeScript framework for semantic, evidence-aware user interfaces. It combines 71 accessible web components with typed contracts for data, intent, results, and presentation. Applications can adopt one component at a time, add bounded local or HTTP evaluation, and introduce model-assisted proposals only where they add value.

Aeliqo never replaces your application boundary. Your product continues to own identity, authorization, data access, routes, and business actions.

- **Standards-based UI:** custom elements share one implementation across vanilla JavaScript, React, Vue, and SSR.
- **Evidence-aware results:** scope, grain, completeness, precision, revision, and lineage travel with evaluated data.
- **Progressive adoption:** use a standalone component first; add semantics, runtime evaluation, Regions, or agents independently.
- **Provider optional:** components, local evaluation, authoring, and presentation work without an account or model call.
- **One release line:** all public packages use the same exact version.

[Read the documentation](https://docs.aeliqo.com/) · [Open the playground](https://docs.aeliqo.com/playground/) · [Browse the component catalog](https://docs.aeliqo.com/docs/components/)

## Quick start

Install the packages used by a basic browser integration:

```sh
npm install --save-exact \
  @aeliqo/core@0.1.0 \
  @aeliqo/runtime@0.1.0 \
  @aeliqo/web@0.1.0
```

Register a component once, then pass structured application data as properties:

```html
<aeliqo-record-list aria-label="Active people"></aeliqo-record-list>
```

```ts
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}

const people = document.querySelector<AeliqoRecordListElement>('aeliqo-record-list');
if (!people) throw new Error('Record list mount is missing');

people.columns = [
  {key: 'name', label: 'Name'},
  {key: 'team', label: 'Team'},
];
people.identity = ['id'];
people.rows = [
  {id: 'ada', name: 'Ada Chen', team: 'Design'},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering'},
];
people.scope = {
  label: 'Active people',
  kind: 'filtered',
  loaded: 2,
  filteredTotal: 2,
};
```

Use the [quickstart](https://docs.aeliqo.com/docs/getting-started/) to add interactions and verify loading, empty, partial, stale, and error states.

## The four public concepts

| Concept | Responsibility |
| --- | --- |
| **Catalog** | Describes entities, fields, identity, relationships, meanings, and source capabilities. |
| **Task** | States the requested outputs, operations, dependencies, and delivery constraints. |
| **Result** | Carries evaluated values with revision, scope, grain, completeness, precision, and lineage. |
| **Experience** | Constrains presentation so adaptation preserves the task, access, and essential operations. |

This separation lets an interface adapt while keeping the evidence used for each visible claim inspectable.

## Packages

| Package | Purpose |
| --- | --- |
| `@aeliqo/core` | Catalog, Task, query, presentation, interaction, and validation contracts |
| `@aeliqo/runtime` | Local and HTTP data services, evaluation, results, lifecycle, and audit export |
| `@aeliqo/web` | Accessible web components, data views, Regions, visualization, and SSR |
| `@aeliqo/react` | Thin React bindings over the shared web implementation |
| `@aeliqo/agent` | Bounded MCP and host-model adapters for trusted server processes |
| `@aeliqo/devtools` | Local authoring and inspection tools |

Keep every Aeliqo package on the same exact version while the API is major-zero.

## Examples

- [`examples/platform`](examples/platform/README.md) demonstrates the shared web implementation from vanilla JavaScript, React, and Vue.
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
