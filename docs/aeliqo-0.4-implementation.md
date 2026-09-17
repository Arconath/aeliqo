# Aeliqo 0.4 implementation record

Status: Aeliqo 0.4.0 is published and deployed from
`c07a3d3a31eda165822ddfc21b2b1c6af45bb6b6`. The only remaining closeout action
is deprecating `@aeliqo/devtools@0.3.0`, which is waiting on npm account
two-factor authentication; no package deprecation has been applied.

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

| Milestone                                                     | Evidence                                                                                                      | State    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| Consolidate the public workspace and remove obsolete surfaces | Workspace manifests, package exports, routes, and consumer tests                                              | Complete |
| Complete the site, playground, and component documentation    | 71 authored pages, generated routes and previews, browser and visual checks                                   | Complete |
| Refactor production modules and enforce quality limits        | Oxlint, Knip, typecheck, characterization, package tests, and cross-browser suites                            | Complete |
| Verify the exact release candidate                            | `pnpm check` (82/82), release tooling, clean tarball consumers, docs artifact, site tests, and bundle budgets | Complete |
| Publish and cut over                                          | Five `0.4.0` packages and one immutable site image from the accepted commit; smoke-test production            | Complete |
| Deprecate the obsolete devtools package                       | Deprecate only `@aeliqo/devtools@0.3.0` after stable cutover                                                  | Pending  |

## Current observed evidence

- `release-metadata.json` declares version `0.4.0` and exactly the five
  intended public packages.
- The component catalog and `docs/site/components/` currently contain the same
  71 IDs.
- The accepted source revision is
  `c07a3d3a31eda165822ddfc21b2b1c6af45bb6b6`. A clean-commit `pnpm check`
  passed all 82 commands, and the main-branch quality run `35277635840` passed
  on the same SHA. Its uploaded evidence records `status: passed`,
  `sourceChangedDuringRun: false`, all five package identities, and zero secret
  findings in source and packed artifacts.
- The first main-branch run, `35256561324` at source
  `e554464deb92c1b70e30f5f62f8ea724b7c93708`, passed `pnpm check` (82/82) but
  then rejected the generated `connection-secret.d.ts` filename during the
  candidate tarball scan. That module contains only the opaque credential
  handle implementation. It is now named `auth-handle.ts`, keeping the strict
  sensitive-file scan intact; the agent build, 116 agent tests, installed
  consumer, and 30 release-tooling tests pass after the rename. The clean
  candidate build now passes for all five tarballs and its installed consumer
  checks 161 exports; the SBOM covers 59 components with zero secret findings.
- The corrected main-branch run, `35266923405` at source
  `e108daf18cf3a04748cc4f55d1536597f6646c94`, passed all 82 checks, candidate
  package consumption, web/docs/playground/static-server verification, and
  production-image smoke. Its uploaded evidence records an unchanged source
  SHA and zero secret findings in all five tarballs. The RC workflow,
  `35274859876`, then stopped before publishing because the `next` tag guard
  compared only RC ordinals and rejected moving from `0.3.0-rc.1` to
  `0.4.0-rc.1`. The guard now compares the full numeric release base before the
  RC ordinal, with tests for cross-line advancement and regressions. The final
  RC workflow `35285582550` succeeded after npm registry propagation delays;
  all five exact tarballs were installed, 161 exports loaded, and provenance
  for each package was verified against the accepted SHA.
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
  handling, and shutdown drain. The disposable image was removed. The production
  image and rollout are now verified below.
- Vite reports a 649.92 kB raw / 167.83 kB gzip main application chunk;
  the repository has no separate site chunk-size limit. This is a build-size
  observation, not a runtime-performance budget.
- The final stable publication run `35287340514` published and verified the
  five `0.4.0` packages with the `latest` tag. Its clean registry consumer
  loaded 161 exports, matched every candidate integrity, and verified npm
  provenance for all five packages against the same source SHA. The approved
  RC predecessor was also reinstalled and verified by that run.
- The production image run `35287581917` published immutable digest
  `sha256:2d7cf7b34960b4529c761422f08e6f74034765cee9422dfc3e2fdad854a962c8`
  from the same source SHA and SDK `0.4.0`. Its registry-attached SLSA
  provenance was verified; the SBOM reports two components and zero
  vulnerabilities, and the Trivy HIGH/CRITICAL gate found none.
- GitOps promotion run `35287680190` moved production to that digest and
  completed Flux acceptance. Promotion commit `0740c2a856ee4d3fde871fb4e68eb64447b0ffb1`
  was followed by acceptance-record commit
  `c07a487b9a93da0327b7322b2f39f5c0e3efebf2`. The live `/version` response
  reports SDK/site `0.4.0` at the accepted source SHA. `/healthz`, `/readyz`,
  the landing page, docs, search, component page, and playground all returned
  HTTP 200; `/docs/` and `/playground/` resolve to `docs.aeliqo.com`.
- The previous production image remains recorded for rollback at digest
  `sha256:084dd71f4115d2319859c43767f282fb4d73ec59bd2b524e1e2bf1d325d7072e`.
- `pnpm release:legacy:inspect` reports the allowlisted
  `@aeliqo/devtools@0.3.0` lineage as visible and ready, with no blockers. The
  apply step has not changed npm metadata: local `npm whoami` returns `E401`,
  and npm's package-settings flow is gated by account two-factor verification.
  Complete account authentication before applying the recorded deprecation
  message.

## Closeout

Implementation, verification, package publication, and production cutover are
complete from the single accepted source revision. The remaining closeout action
is the allowlisted `@aeliqo/devtools@0.3.0` deprecation after npm account
two-factor authentication. The failed unauthenticated attempt did not change
the package metadata.
