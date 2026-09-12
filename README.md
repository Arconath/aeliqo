# Aeliqo 0.1.0

Aeliqo is an Apache-2.0 adaptive semantic UI framework. It gives applications a
shared vocabulary—**Catalog, Task, Result, and Experience**—plus bounded query
evaluation, validated presentation composition, 71 ready-to-use web components,
thin React bindings, and optional agent integrations. Your application continues
to own data access, authenticated principals, routes, and business effects.

AI is optional and untrusted. Direct components, developer-authored meanings,
local evaluation, interactions, and presentation work without a model. A
shape-valid proposal still needs the application's semantic and authorization
checks before it can replace UI or cause an effect.

## Availability

The target is exactly `0.1.0` across six public packages:
`@aeliqo/{core,runtime,web,react,agent,devtools}`. Pin exact versions while the
API is major-zero. Source, npm publication, and the production website are
qualified separately; do not infer registry availability from this repository.
Until a registry release is verified, build this workspace or use the exact
checksum-verified candidate tarballs produced by `scripts/release/candidate.mjs`.
The candidate's clean npm consumer reproduces the reviewed pnpm lock graph for
artifact acceptance. It does not claim compatibility with every newer version
that package manifests might admit through semver ranges.

Requirements: Node `24.20.0`, pnpm `11.24.0`, and the browser/support matrix in
[the 0.1.0 support boundary](docs/public/0.1.0-support-boundary.md).

The manually dispatched product-quality workflow accepts `main` and reviewed
owner-repository `codex/*` candidates. Candidate dispatches must provide the
exact 40-character commit as `expected_source_sha`; this validates that source
but does not authorize publication. Package publication still requires a
successful quality run for the same commit on `main`.

## Minimal working example

Install the smallest boundary you need once the version is available:

```sh
npm install --save-exact @aeliqo/core@0.1.0
```

Validate a versioned catalog before using it:

```js
import {parseCatalog} from '@aeliqo/core';

const parsed = parseCatalog({
  version: '1', revision: 'catalog-1', functionRegistryDigest: 'functions-1',
  entities: [{
    id: 'employees', label: 'Employees', identity: ['employee.id'],
    rowGrain: ['employee.id'],
    fields: [{
      id: 'employee.id', label: 'Employee ID', role: 'identity',
      type: {value: 'text', nullable: false},
    }],
  }],
  relationships: [], meanings: [], capabilities: [],
});

if (!parsed.ok) throw new Error(parsed.error.code);
console.log(parsed.value.revision, parsed.value.entities[0].id);
```

Expected output:

```text
catalog-1 employees
```

The repository's [executable quickstart](examples/quickstart.mjs) uses the same
contract. The release-candidate gate installs the packed tarballs offline and
runs that file, so this path is checked against shipped bytes rather than only
workspace source.

## Adopt progressively

1. Use `@aeliqo/web` components directly, or the thin `@aeliqo/react` bindings.
2. Add `@aeliqo/core` contracts and `@aeliqo/runtime` local or authenticated HTTP
   evaluation when views need governed data semantics.
3. Add the presentation registry, region lifecycle, typed interactions, and
   developer-authored meanings as the application becomes adaptive.
4. Add `@aeliqo/agent` only in a trusted host when model-assisted proposals are
   useful. Provider credentials never belong in browser configuration.

Start with the [platform examples](examples/platform/README.md), the
[end-to-end vertical slice](examples/vertical-slice/README.md), or the
[synthetic ADC host](examples/reference-host/README.md). Public documentation
source, API metadata, and runnable catalog examples remain in this repository.
The marketing/docs presentation shell and its deployment live separately in the
private `Arconath/aeliqo-site` repository and are not required to build or test
the SDK.

## Development

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:docs-artifact
pnpm check
```

`pnpm check` is the complete product command ledger and includes unit, package
consumer, browser, SSR/hydration, security, accessibility, scenario, and
performance gates. `python3 scripts/validate_all.py` validates the retained
specification/reference kit; it is not a substitute for product tests. Public
pull requests run on GitHub-hosted GitHub Actions with read-only repository
permission and no private-site or production credential.

See [CONTRIBUTING.md](CONTRIBUTING.md), [the technical chapter map](docs/README.md),
and [the repository split contract](docs/repository-split.md). The concise
[AGENTS.md](AGENTS.md) preserves contributor boundaries and points to the
canonical product contracts.

## Migration and troubleshooting

The direct 0.1 package family is an incompatible lineage reset, not an automatic
upgrade or downgrade from historical 0.2 packages. Follow the
[0.1.0 migration guide](docs/migration-0.1.0.md); do not mix lineages in one
lockfile or deployment.

- `ERR_PACKAGE_PATH_NOT_EXPORTED`: use a documented package/subpath and pin all
  Aeliqo packages to the same exact version.
- A contract returns `ok: false`: handle its stable diagnostic; parsing never
  grants data access, intent correctness, or an effect.
- A custom element is already defined: register once at the application boundary
  and do not mix different Aeliqo versions in one registry.
- SSR imports browser globals: use `@aeliqo/web/server`; register browser elements
  only during hydration/client startup.
- Registry install fails: verify the requested version actually exists. Do not
  replace the exact version with `latest` or a mutable branch.

## Security, license, and product boundary

Report vulnerabilities through [SECURITY.md](SECURITY.md). Never put provider,
npm, GitHub, private-site, or application credentials into client bundles,
examples, logs, or issues. Aeliqo has no mandatory account, license callback,
safety paywall, or artificial paid row cap.

The complete framework—including runtime correctness/security, all components,
local Studio/devtools, testkit source, and agent plumbing—is Apache-2.0. Future
hosted organizational operations or support are a separate business hypothesis,
not functionality or customer demand claimed by 0.1.0. See the
[OSS/commercial boundary](docs/business/oss-commercial-boundary.md).
