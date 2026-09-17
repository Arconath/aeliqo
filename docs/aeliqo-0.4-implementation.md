# Aeliqo 0.4 implementation record

Status: implementation complete; candidate verification, publication, and
production cutover are pending. No 0.4 package has been published, and
production remains on 0.3.

## Release boundary

- Source branch: `codex/aeliqo-0.4`.
- Release: breaking `0.4.0` with five public packages: `core`, `runtime`,
  `web`, `react`, and `agent`.
- Public product: one site application for the landing page, docs, component
  references, playground, and local runner. The site uses one fixed palette;
  component consumers retain token customization.
- Docs: English Markdown is the source for site content and all 71 component
  pages. API facts come from TypeScript declarations and executable examples.
- Cutover: publish packages and deploy one immutable image from the same
  verified source revision. Keep the current production image available until
  the new image passes health and route smoke checks.

## Milestones

| Milestone                                                     | Evidence                                                                                                      | State       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Consolidate the public workspace and remove obsolete surfaces | Workspace manifests, package exports, routes, and consumer tests                                              | Complete    |
| Complete the site, playground, and component documentation    | 71 authored pages, generated routes and previews, browser and visual checks                                   | Complete    |
| Refactor production modules and enforce quality limits        | Oxlint, Knip, typecheck, characterization, package tests, and cross-browser suites                            | Complete    |
| Verify the exact release candidate                            | `pnpm check` (82/82), release tooling, clean tarball consumers, docs artifact, site tests, and bundle budgets | In progress |
| Publish and cut over                                          | Five `0.4.0` packages and one immutable site image from the accepted commit; smoke-test production            | Pending     |

## Current observed evidence

- `release-metadata.json` declares version `0.4.0` and exactly the five
  intended public packages.
- The component catalog and `docs/site/components/` currently contain the same
  71 IDs.
- `pnpm check` has passed all 82 commands on a clean commit. Its report records
  the exact source revision, `status: passed`, and
  `sourceChangedDuringRun: false`. The main-branch quality workflow must repeat
  the gate on the accepted source SHA and upload its evidence before release.
- The first main-branch run, `35256561324` at source
  `e554464deb92c1b70e30f5f62f8ea724b7c93708`, passed `pnpm check` (82/82) but
  then rejected the generated `connection-secret.d.ts` filename during the
  candidate tarball scan. That module contains only the opaque credential
  handle implementation. It is now named `auth-handle.ts`, keeping the strict
  sensitive-file scan intact; the agent build, 116 agent tests, installed
  consumer, and 30 release-tooling tests pass after the rename. The clean
  candidate build now passes for all five tarballs and its installed consumer
  checks 161 exports; the SBOM covers 59 components with zero secret findings.
  The same-SHA main-branch rerun is pending.
- `pnpm site:build` and `pnpm site:test` pass. The site visual checks cover the
  landing page, documentation, a component page, and the playground at 360,
  768, and 1440 pixels; all 12 baselines pass. The component visual suite passes
  in Chromium, Firefox, and WebKit. `pnpm test:components:a11y` passes all 12
  tests. Two earlier Firefox state assertions were not reproducible in focused
  runs or the subsequent full Firefox run; no stable product failure was found.
- A desktop-to-mobile home-page resize reproduced a browser-level ResizeObserver
  loop error. Resize-driven adaptive rendering now runs once on the next animation
  frame, with pending work cancelled when the region is released. The site browser
  regression captures window-level ResizeObserver errors, and the fresh full site
  test run passes without one.
- A focused review exposed a second resize race: a runtime subscriber can unmount
  the region while presentation commit is pending, after which the async render
  could repopulate the detached element. Region release now advances the render
  generation, and failed-render rollback only restores state for the current
  generation. A public app-facade browser regression failed before the fix and
  passes afterward with the detached region still empty. Follow-up review found
  that delayed composition or focus callbacks could start adaptation on the
  released object and advance its generation again. `adaptRegion` now checks
  that the app is live and the region object is still the current map entry
  before doing work. A targeted regression failed before this guard by entering
  presentation preparation, then passed without changing the released
  generation or reading runtime state. The vertical browser suite and full site
  suite pass after the fix.
- `pnpm --dir apps/site test:performance` passes its built-site cold/warm
  observation for the landing page, component docs, and playground. The probe
  stays on the local 0.4 artifact, checks the current playground receipt, and
  records observations without asserting timing thresholds.
- `pnpm test:docs-artifact` freshly builds and verifies 121 public pages,
  including all 71 component pages. The source manifest includes each component
  Markdown page and its current hash. Artifact SHA-256:
  `e3e662847e61c8359aade70a58b16292d8db062305d86b2a9cc5c6fcc5d3fd33`.
- Clean tarball checks pass for the React framework, runtime, and public
  exports. The React package declares its runtime peer, and the installed
  consumer verifies it. Release tooling passes 30 tests.
- The full clean-commit matrix found input, data, plot, navigation/feedback,
  and visualization consumer fixtures that installed React without its
  `@aeliqo/runtime@0.4.0` peer. Each fixture now installs the runtime tarball
  and checks its dependency and peer versions. All five focused consumer tests
  and the final 82-command `pnpm check` pass.
- `pnpm test:performance:bundles` is now a required performance category in
  the 82-command `pnpm check` matrix, and release quality evidence rejects a
  missing performance result. The quality workflow retains the detailed bundle
  report with its source-bound command logs. The gate passes without raising
  budgets: region-table is 158,276 bytes gzip against 163,840 bytes; core
  planner validation is 62,847 bytes against 71,680 bytes. This gate measures
  package size and module boundaries, not timing or runtime performance. The
  latest run after the stale-callback lifecycle guard also passes all six
  package budgets.
- Independent review findings for the React runtime peer and component-page
  source hashes have been fixed and regression-tested. The separate review of
  quality-matrix and evidence wiring found no findings.
- A fresh dirty-tree image built after the resize and lifecycle fixes, tagged
  `aeliqo-site:dirty-preflight-20260917-stale-callback`, passed the static-image
  smoke for health, readiness, version, security headers, asset caching, 404
  handling, and shutdown drain. The disposable image was removed. The
  clean-commit, source-bound production image build, provenance/SBOM scan, and
  production rollout remain pending. The `site-release.yml` workflow builds
  the immutable image from main and starts GitOps promotion;
  `production-promotion.yml` verifies Flux rollout and records live version
  evidence.
- Vite reports a 649.92 kB raw / 167.83 kB gzip main application chunk;
  the repository has no separate site chunk-size limit. The live 0.3 edge
  serves its JavaScript with Brotli, but 0.4 edge transfer remains unverified
  until release.
- Read-only checks on 2026-09-17 of `aeliqo.com`, `www.aeliqo.com`, and
  `docs.aeliqo.com` report production `0.3.0` at site and SDK revision
  `285967a4d310a5e47f62592bb577aa9ca47ce097`; health, search, component, and
  playground routes respond. The previous production image digest
  `sha256:084dd71f4115d2319859c43767f282fb4d73ec59bd2b524e1e2bf1d325d7072e`
  remains available from GHCR for rollback and is the digest pinned in current
  GitOps main. The recorded production scan reports no HIGH or CRITICAL
  vulnerabilities.
- The production image now copies `docs/site/` into its build context, and the
  release workflow checks candidate package names against the canonical
  package list. No package has been published and production remains on 0.3.

## Required closeout

The new DCO-signed source commit must pass all 82 `pnpm check` commands on a
clean tree, the candidate tarball build, and the same-SHA main-branch workflow.
Publish `0.4.0-rc.1` with the `next` tag, verify all five registry packages in a
clean consumer, then publish `0.4.0` with the `latest` tag tied to that exact RC
run and source SHA. Dispatch the site release from the same main SHA; verify
the immutable image, GitOps revision, Flux rollout, `/healthz`, `/readyz`,
`/version`, and the landing, docs, component, search, and playground routes.
Keep the previous image available for rollback. After the stable packages and
site are live, deprecate the allowlisted `@aeliqo/devtools@0.3.0` lineage and
record the accepted source SHA and release evidence here.

The current local npm identity is unauthenticated (`npm whoami` returns 401),
and the repository has no npm token secret. Trusted publishing covers package
publication; legacy deprecation still needs npm authentication after cutover.
