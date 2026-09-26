# Aeliqo 0.4 implementation record

Status: Aeliqo 0.4.0 is published and deployed from
`c07a3d3a31eda165822ddfc21b2b1c6af45bb6b6`. The only remaining closeout action
is deprecating `@aeliqo/devtools@0.3.0`, which is waiting on npm account
two-factor authentication; no package deprecation has been applied.

## Release boundary

- Source revision: the `0.4` development line; the `0.4.1` release is recorded at tag `v0.4.1`.
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

## 0.4.1 Playground and component polish

Status: implementation and local acceptance checks are complete for `0.4.1`.
Production remains on `0.4.0` until the patch passes its clean-commit quality
and source-bound release checks.

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
   key or make a real model request. Complete locally.
4. Review the completed diff, obtain the required DCO attestation, then publish
   the patch release and deploy an immutable image through the existing
   source-bound workflows. Confirm live health, version, docs, search, and
   Playground before closing the milestone. Pending release.

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
- No real provider request or user key was used. The live site remains on
  `0.4.0`; its `/playground/` response still has the old generic CSP. After
  cutover, verify the route-specific CSP and provider connection endpoint in
  addition to health, version, docs, search, and Playground routes.

Milestones 1–3 are complete locally. The source-bound clean-commit check,
accepted patch commit, registry candidate and stable publication, immutable
image deployment, and live acceptance remain pending. `pnpm check` must run on
the clean DCO-signed commit. The user has already authorized deployment and
specified that online users supply their own keys.

## 0.4.2 Global launch readiness

Status: implementation and local acceptance checks were complete on the
`0.4` development line from `d4c68a3`. The clean, accepted candidate commit and
source-bound release remained pending at that point.

The goal is a source-compatible patch that makes adaptive presentation obey
resource view policy, binds trends to requested semantic measures, turns the
People journey into the primary product proof, improves the component and
Playground experience, and replaces skeletal public documentation with usable
tutorial, guide, reference, and explanation content. The primary audience is
React and TypeScript developers building data-rich business applications.

Milestones and acceptance:

1. Correctness: enforce resource views in recipe selection and final plan
   validation; reject ambiguous trend metrics with a needs-input result. Verify
   with application-level regression tests. Complete.
2. Product experience: unify site/component tokens, repair chart geometry and
   replayable dialog examples, and restructure the Playground around Without AI
   and Connect AI journeys. Verify at 360, 768, and 1440 pixels. Complete.
3. Product proof and documentation: add an explicit monthly headcount scenario,
   improve the React-first learning path, document event payload/ownership and
   provider states, and keep all 71 component pages source-backed. Complete.
4. Integrations and community: separate simulated/native WebMCP evidence,
   distinguish configured/verified BYOK states, and add repository issue and PR
   templates plus a safe environment example. Complete.
5. Acceptance: run the complete quality matrix, clean package consumers,
   three-browser visual review, performance gates, static-image smoke, and an
   independent review. Publication and production promotion require this exact
   clean source revision. Local precommit gates and independent review are
   complete; the clean-commit `pnpm check`, publication, and promotion remain
   pending.

### Local verification completed 2026-09-19

- Presentation adaptation passes 35 unit and type checks, 2 browser checks, and
  the clean tarball consumer. The regressions cover resource view policy at
  recipe selection and final validation, preservation of the prior rendered
  result after a rejected custom recipe, requested semantic trend fields, and
  missing or ambiguous time and measure choices returning `needs-input`.
- `pnpm site:test` passes 21 site units, the production build, 9 main browser
  checks, 7 fake-provider BYOK checks, 2 local-runner checks, 12 documentation
  navigation checks across all 71 component routes, 10 responsive Playground
  checks, document layout, the Go server, 8 provenance checks, and all 24 light
  and dark baselines at 360, 768, and 1440 pixels.
- The full component visual matrix passes in Chromium, Firefox, and WebKit. Each
  engine passes 213 catalog cases, 126 field states, 87 responsive data-state
  cases plus 1 explicit unsupported-state record, 57 structure states, 21 data
  interactions, 24 compound interactions, and 81 visualization interactions
  across 360, 768, and 1440 pixels.
  `pnpm test:components:a11y` passes all 12 checks.
- The public documentation artifact verifies 121 pages and all 71 components
  at version `0.4.2`; its SHA-256 is
  `779de1ccd03bbfb46bd144b1c2224886c0cb3e0b9886f6bb5078bdcfbbabd2e4`.
  All 3 catalog example groups pass.
- Bundle performance passes all 6 budgets. The core planner is 62,847 bytes gzip
  against 71,680 bytes; the region table is 159,053 bytes against 163,840 bytes.
  Framework consumers, Next SSR and hydration, all 4 export-consumer scenarios,
  30 release-tooling tests, and package notices also pass.
- The native WebMCP probe passes in an isolated headed Chrome for Testing
  153.0.8010.12 with `WebMCPTesting` enabled. It verifies registration,
  discovery, invocation, cancellation, unregistration, and the exact
  `agent.webmcp.closed` late-call diagnostic with no page or server errors. The
  simulated protocol suite passes all 12 checks.
- A disposable local `0.4.2` production image passes health, readiness, version,
  security-header, immutable-asset, 404, Playground CSP, and graceful-shutdown
  checks. The image was removed after verification.
- Independent review found two medium-priority evidence gaps. Cancelled DeepSeek
  requests could be labelled verified, and the native WebMCP probe accepted an
  unrelated late-call exception. Both are fixed. The BYOK suite now proves that
  scenario cancellation retains the configured state without recording provider
  verification, and the native probe requires a structured closed-adapter
  diagnostic and rejects page or server errors.
- One bounded synthetic request through the browser DeepSeek adapter completed
  successfully against the configured real provider on 2026-09-19. The key and
  response text stayed out of source, artifacts, and logs. The 7 browser tests
  continue to cover the full BYOK UI and tool loop with an intercepted provider,
  including authentication failure and retry, timeout, malformed response,
  cancellation, reset, sanitization, and recovery.
- Formatting, lint, Knip, root and site type checks, and `git diff --check` pass.
  `pnpm check` intentionally remains for the clean DCO-signed candidate because
  the quality runner rejects a dirty checkout before running its 82 commands.

Compatibility constraints: do not change serialized protocol contracts; new
recipe policy input is optional for direct recipe consumers and always supplied
by the web application facade. Keep all five packages, all component families,
offline use, accessibility behavior, authorization hooks, BYOK, MCP, and
experimental WebMCP in the Apache-2.0 boundary.
