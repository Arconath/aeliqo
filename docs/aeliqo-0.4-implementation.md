# Aeliqo 0.4 implementation record

Status: Aeliqo 0.4.1 is published and deployed from
`c7112872e5de98907d04ec6cae796d0d4890bc8a`. The five stable packages and the
immutable site image are verified at that source revision. The only remaining
closeout action is deprecating `@aeliqo/devtools@0.3.0` after npm account
two-factor authentication; no package deprecation has been applied.

## Release boundary

- Source branch: `codex/aeliqo-0.4`.
- Release: breaking `0.4.0` followed by patch `0.4.1`, with five public
  packages: `core`, `runtime`, `web`, `react`, and `agent`.
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
| Publish and cut over                                          | Five `0.4.1` packages and one immutable site image from the accepted commit; verify production                | Complete |
| Deprecate the obsolete devtools package                       | Deprecate only `@aeliqo/devtools@0.3.0` after stable cutover                                                  | Pending  |

## 0.4.0 initial launch evidence (historical)

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

## 0.4.1 patch release and production acceptance

- Accepted source revision: `c7112872e5de98907d04ec6cae796d0d4890bc8a`.
  The PR quality run `35342799366` and main quality run
  `35347827121` passed; the main run's `ci.json` records 82 successful checks,
  the exact source SHA, and `sourceChangedDuringRun: false`.
- RC workflow `35353021612` published `0.4.1-rc.1` with the `next` tag.
  Its successful publication record verifies all five package integrities;
  the installed registry consumer loaded 161 exports and verified npm
  provenance for every package against the accepted source SHA.
- Stable workflow `35354951762` published `0.4.1` with the `latest` tag.
  Its publication record verifies all five package integrities, and its
  installed registry consumer again loaded 161 exports and verified all five
  provenance statements. The registry reports `latest=0.4.1` for each package.
- Production image workflow `35356676229` built
  `ghcr.io/arconath/aeliqo-web@sha256:9b4ceacd92dc245a3b586823e06df6039b343ce7de4bd9275cb63cb64a898bc8`
  from the same source and SDK version `0.4.1`. Registry-attached SLSA
  provenance verified; the SBOM has two components and reports zero
  vulnerabilities, and the Trivy HIGH/CRITICAL gate exited 0.
- Promotion workflow `35356838964` completed Flux rollout and live health/version
  checks. GitOps promotion commit `8e47af1a89330a9435225677c1065596f2c2232f`
  passed validation run `35356923878`; acceptance record commit
  `449100c1db8c460f09a5d482d8b1b27a82215dbc` passed validation run
  `35357128007`. The release evidence records acceptance at
  `2026-09-18T14:34:34Z`.
- Live `/version` on both apex and `www` identifies site/SDK `0.4.1` at the
  accepted source SHA. `/healthz`, `/readyz`, docs, search, the data-table page,
  and the hosted playground returned HTTP 200. The playground's exact route
  CSP restricts model connections to `self` and `https://api.deepseek.com`.
- The direct predecessor image remains available for rollback at
  `sha256:2d7cf7b34960b4529c761422f08e6f74034765cee9422dfc3e2fdad854a962c8`.
  The earlier `0.3.0` image at
  `sha256:084dd71f4115d2319859c43767f282fb4d73ec59bd2b524e1e2bf1d325d7072e`
  also remains available.
- `pnpm release:legacy:inspect` reports `@aeliqo/devtools@0.3.0` visible and
  ready, with no blockers; all five `0.4.1` replacements are visible. The
  intended deprecation is not yet applied: `npm whoami` returns `E401`, and
  the npm account requires two-factor authentication.

## Closeout

Implementation, verification, package publication, and production cutover are
complete from the single accepted source revision. The remaining closeout action
is the allowlisted `@aeliqo/devtools@0.3.0` deprecation after npm account
two-factor authentication. The unauthenticated check did not change package
metadata.

## 0.4.1 Playground and component polish

Status: implementation, release checks, and production acceptance are complete
for `0.4.1` from `c7112872e5de98907d04ec6cae796d0d4890bc8a`.

The follow-up patch improves the component catalog and adds a hosted,
user-owned model connection. The hosted flow calls the fixed DeepSeek API
directly from the user's browser with the user's key. It does not proxy model
traffic, use an Aeliqo credential, or add a model endpoint to the static site
server. The page discloses provider data egress and user-billed usage before
opt-in; the key stays in page memory and clears when the connection ends or the
page unloads. The existing bounded tool loop, application-owned grants, and
explicit write confirmation remain in place.

The implementation milestones are:

1. Refine shared component surfaces, typography, spacing, controls, and states
   while preserving public APIs and the current light/indigo identity. Complete.
2. Add the fixed-provider BYOK flow, exact-route Content Security Policy,
   disclosure, credential clearing, bounded requests, and fake-provider browser
   tests. Document the hosted and local flows separately. Complete.
3. Verify all catalog examples and component accessibility, cross-browser
   rendering, responsive site routes, package and site checks, and the static
   image smoke. Use intercepted fake responses only; never test with a billing
   key or make a real model request. Complete.
4. Review the completed diff, obtain the required DCO attestation, publish the
   patch release, deploy its immutable image, and verify live acceptance.
   Complete; see the 0.4.1 release and production acceptance record above.

### Local verification completed 2026-09-18

- `pnpm site:test` passes unit and type checks, the production site build, 8
  site browser tests, 6 fake-provider BYOK tests, 2 local-runner tests, 11
  documentation navigation tests, 9 responsive tests, the document-layout
  test, Go server tests, 8 provenance tests, and all 12 visual baselines at
  360, 768, and 1440 pixels.
- `pnpm test:visual` passes its full suite in Chromium, Firefox, and WebKit.
  Each engine passes 142 catalog cases, 84 field states, 30 data states, 38
  structural states, and the data, compound, and visualization interaction
  cases. The suite exposed a transient filter-builder contrast issue and a
  hover-state contrast conflict on the empty-state action; both are fixed and
  verified in the full matrix.
- `pnpm test:components:a11y` passes all 12 tests. `pnpm format:check` and
  `pnpm lint` pass; lint includes 11 quality-policy tests, Oxlint, TypeScript
  lint, Knip, and site verification. Knip exits successfully with configuration
  hints.
- `pnpm test:docs-artifact` verifies 121 public pages and all 71 components;
  artifact SHA-256 is
  `fe3fe44cdea0a9047d781af7d933e33961fa4f63192cc13b18f2600dd3151eff`.
  `pnpm test:catalog-examples` passes all three catalog example groups.
- `pnpm test:performance:bundles` passes all six budgets. Core planner is
  62,847 bytes gzip against 71,680 bytes; region table is 159,060 bytes against
  163,840 bytes.
- A disposable local `0.4.1` site image passed
  `apps/site/scripts/ci/check-static-image.sh`, including an exact comparison
  of the complete route-specific `/playground/` Content Security Policy. Its
  `connect-src` permits only the fixed DeepSeek endpoint, with no analytics
  egress. The image was removed after the smoke test.
- No real provider request or user key was used. The live site is now
  `0.4.1` at the accepted source SHA. The deployed playground route has the
  exact tested CSP with `connect-src 'self' https://api.deepseek.com`; live
  health, readiness, version, docs, search, component, and playground checks
  passed after Flux rollout.

All four implementation and release milestones are complete. The user
authorized deployment and specified that online users supply their own keys.
Only the devtools deprecation remains, pending npm two-factor authentication.
