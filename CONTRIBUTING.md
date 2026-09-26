# Contributing to Aeliqo

Thanks for helping improve Aeliqo. Code, documentation, examples, and bug
reports are all welcome — including contributions made with AI coding
assistants. [AGENTS.md](AGENTS.md) is the canonical contributor guide for
humans and agents: it has the repository map, layer boundaries, code and
documentation conventions, and the verification matrix. Read it, or point
your tool at it, before opening a pull request.

Keep a contribution focused, include tests for behavior that can regress, and
update the relevant documentation in the same change as the code. Do not
include secrets, customer records, generated build output, or local tool
configuration.

## Local setup

Use the pinned toolchain: Node.js `24.20.0` (see [.node-version](.node-version))
and pnpm `11.24.0` (the `packageManager` field in [package.json](package.json)).

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
```

For the optional local Playground model connection, copy
`apps/site/.env.example` to `apps/site/.env.local` and edit only the local
copy. Never put a provider key in an issue, test fixture, screenshot, URL, or
committed file. Browser BYOK uses the user's key in page memory and does not
use this file.

## Running checks

`pnpm check` runs the full acceptance matrix in
[quality/commands.json](quality/commands.json) (via `scripts/quality.py`, so
Python 3 is required) and writes evidence under `artifacts/product-ci/`. It
covers typecheck, unit, browser, package-consumer, performance, lint,
security, and boundary checks. Run it on a clean commit before a release;
for a routine pull request, run the smallest commands that exercise the
changed contract — the required GitHub checks still run before merge.

Common focused commands by area:

| Change area                    | Commands                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Any change                     | `pnpm lint`, `pnpm format:check`, `pnpm typecheck`                                                     |
| `packages/core`                | `pnpm build:core`, `pnpm test:contracts`, `pnpm test:core:consumers`                                   |
| `packages/runtime`             | `pnpm build:runtime`, `pnpm test:data`, `pnpm test:regions`, `pnpm test:runtime:consumers`             |
| `packages/web` / `react`       | `pnpm build:platform`, `pnpm test:platform`, `pnpm test:platform:browser`, `pnpm test:components:a11y` |
| `packages/agent`               | `pnpm build:agent`, `pnpm test:agents`, `pnpm test:agent:consumers`                                    |
| Framework/SSR integrations     | `pnpm test:framework:consumers`, `pnpm test:next-platform`                                             |
| Component docs or examples     | `pnpm test:catalog-examples`, `pnpm test:docs-artifact`, `pnpm test:docs-inventory`                    |
| `apps/site` (site, playground) | `pnpm site:build`, `pnpm site:test`                                                                    |
| Visual changes                 | `pnpm test:visual` (Chromium, Firefox, WebKit at 360/768/1440 px)                                      |

`pnpm` scripts in [package.json](package.json) are the source of truth for the
exact commands.

## Code conventions

- Small modules with one clear responsibility. Prefer guard clauses,
  discriminated unions, exhaustive switches, dispatch tables, and pure
  functions for domain rules. Avoid nested conditionals and ternaries,
  catch-all managers/services, speculative abstraction, and duplicate sources
  of truth.
- Enforced limits ([.oxlintrc.json](.oxlintrc.json)): functions ≤ 80 lines,
  files ≤ 500 lines, cyclomatic complexity ≤ 12, nesting ≤ 3. Generated code
  and fixtures are excluded by path. No `as any` casts, import cycles, unused
  exports, unused dependencies, or unused locals.
- Dependency direction: `core → runtime → web → react`; `agent` may depend on
  `core` and `runtime`; `apps/site` may consume the public packages. No
  reverse dependencies. Keep I/O in adapters.
- Application code owns identity, permissions, routes, actions, and business
  effects. Treat all agent input as untrusted; never render agent-supplied
  HTML or execute agent-supplied code.

## Common changes

### Add or update a catalog component

1. Implement it under `packages/web` (and `packages/react` bindings if the
   family ships them).
2. Add or update its entry in [catalog/components.json](catalog/components.json).
3. Write its page at `docs/site/components/<catalog-id>.md` and a runnable
   example under [examples/catalog](examples/catalog/).
4. Verify with `pnpm test:catalog-examples` (typechecks, builds, mounts, and
   compares every copyable example with its catalog preview),
   `pnpm test:docs-inventory`, and `pnpm test:components:a11y`.

### Add or change a public package export

Public API changes require all of the following in the same change:

- the package `exports` map update,
- coverage in the matching clean tarball consumer under `tests/consumers/`,
- the matching package guide under [docs/packages](docs/packages/) (release
  staging generates each package `README.md` from these files),
- a release note in `docs/site/pages/release-notes.md`, and for breaking
  changes an entry in the current migration guide under `docs/site/pages/`.

### Update documentation

Authored public documentation lives in Markdown under `docs/site/`; edit the
canonical Markdown and the generators (`scripts/docs/build-public-docs.mjs`,
`apps/site/generate-pages.mjs`), never output under `artifacts/` or `dist/`.
Contributor-facing technical guides are indexed in [docs/README.md](docs/README.md).

## Commits and pull requests

Commit subjects follow `type(scope): subject`, for example `feat(site): …`,
`fix: …`, `docs(agent): …`, `refactor:`, `test(contracts):`, `chore(release):`,
`perf:`, `style:`, `security:`, `ci:`. Scope is optional; keep the subject in
the imperative mood.

Every commit must include a `Signed-off-by: Name <email>` trailer under the
[Developer Certificate of Origin 1.1](https://developercertificate.org/):

```sh
git commit --signoff
```

Open pull requests against `main` and fill in the
[pull request template](.github/pull_request_template.md): describe the
user-visible change, paste the exact commands and fresh output as evidence,
and complete the boundary checklist. UI changes should cover loading, empty,
error, disabled, focus, long-content, responsive, reduced-motion, and
right-to-left states that apply.

Contributions are accepted under [Apache License 2.0](LICENSE) unless the
maintainers agree to different terms before submission. Do not submit
third-party material without the right to redistribute it.

## Conduct and security

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Do not
open a public issue for a vulnerability — follow [SECURITY.md](SECURITY.md)
and use GitHub private vulnerability reporting. For non-sensitive defects,
see [SUPPORT.md](SUPPORT.md).
