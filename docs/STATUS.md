# Aeliqo status

Last updated: 2026-10-09. This is the single maintained status record. Release
history lives in the [release notes](site/pages/release-notes.md) and on
[GitHub releases](https://github.com/Arconath/aeliqo/releases).

## Goal

Aeliqo is an Apache-2.0 framework that turns a validated intent into a
registered view. The same path works from application code or an optional
agent (MCP, WebMCP, or a bring-your-own-key model). The host application owns
data, permissions, routes, and business effects. Aeliqo needs no account,
hosted backend, license server, or model call.

## Published

| Surface  | Current                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm      | `@aeliqo/core`, `runtime`, `web`, `react`, `agent` at `0.6.3` (`latest`), published source `f697627b65aec0a1b0e81159fe13b9f19ddce74c`                                                                             |
| Site     | Site/embedded SDK source `f697627b65aec0a1b0e81159fe13b9f19ddce74c`, SDK `0.6.3`; anonymous OSS, no persistent staging                                                                                            |
| Image    | `ghcr.io/arconath/aeliqo-web@sha256:eea9879a3923756def7da9878e001761b13ad37e8e332a19f62667802d70ccf6`; two exact-image ready production replicas                                                                  |
| Delivery | Main-push quality `36814670613`, stable publication `36822915145`, production image `36824490075`, GitOps acceptance `414cb72723af0773153c73cb96737d579075a18d`; public acceptance and live verification complete |

All five 0.6.3 packages are published on `latest`. Canonical RC and stable
verification passed their registry consumers and source provenance at the exact
source above. [GitHub release 0.6.3](https://github.com/Arconath/aeliqo/releases/tag/v0.6.3)
is published as a stable release; its commit tag resolves exactly to
`f697627b65aec0a1b0e81159fe13b9f19ddce74c`. The canonical public-acceptance
record is committed and pushed on `platform-apps` main at
`414cb72723af0773153c73cb96737d579075a18d`. The previous
[GitHub 0.6.2 release](https://github.com/Arconath/aeliqo/releases/tag/v0.6.2)
records historical npm source `e86a6e2f8d7808d1a580a2d3c63ff33e7fa3b89b`.

**Current live evidence (2026-10-01):** final runtime readback at
`2026-10-01T06:50:10.200635Z` reports both `aeliqo-config` and `aeliqo` Flux
kustomizations Ready and Healthy, with applied and attempted GitOps revision
exactly `414cb72723af0773153c73cb96737d579075a18d`. Their current generations
6 and 23 are observed. Both non-terminating Ready pods use the exact desired
and running `eea9879` digest, source `f697627`, with zero restarts.

Initial runtime acceptance at 06:34 UTC reported both controllers Ready and
Healthy at promotion `83aaf375574871890224e3bfee2c0fd34e28af03`; deployment
generation 23 was observed and all replica counts were two. Canonical public
acceptance exited zero at `2026-10-01T06:34:20Z`, covering production health,
readiness, public revision, cache/security headers and routes.

The live smoke passed documentation search and the 71-component sidebar,
manual component/workspace/registered-page journeys, native experimental
WebMCP, and export ZIP dependencies at 0.6.3, with zero model calls. Thirty
focused public browser journeys passed at 06:37 UTC: 27 homepage, quickstart and
playground renders in Chromium, Firefox and WebKit at 360, 768 and 1440 pixels,
with zero axe violations or page errors, plus three no-JavaScript quickstart
keyboard/reflow checks at 320 pixels. All 36 public form/dialog cases also passed
in Chromium, Firefox and WebKit at 360, 768 and 1440 pixels, with no skipped,
unexpected or flaky tests. All nine live saved-default PNGs were independently
inspected with no actionable visual findings. The form/dialog run started at
`2026-10-01T06:38:30.901Z` and completed in 76.7 seconds. Live verification is
complete. Accessibility evidence covers these recorded routes and states;
general assistive-technology acceptance remains unverified.

## Progress against the goal

- **Done:** intent-to-view for components, workspaces, and registered pages;
  71 documented components; React, Vue, Vanilla, and Next SSR consumers; agent
  tools that accept a minimal intent and return ready-to-send examples; a
  standalone local MCP/BYOK example; a public playground with manual controls
  and native WebMCP.
- **Partly done:** render-tool diagnostics now include valid context choices
  for common field, view, measure, filter-value, and time-grain errors, and
  distinguish a malformed measure object from an unknown meaning. A
  `renderer-ready` result confirms visibility; `plan-committed` does not.
- **Not proven:** no measured success rate with a real model on the 0.6 tools,
  no external adopters yet, and WebMCP still needs an experimental browser
  flag.

Field/data-status direction and context-aware diagnostic hints first published
in `0.6.2` remain in `0.6.3`. The factual JSON-LD and gtag queue fixes remain
live on the current verified source.

### Historical 0.6.2 visual evidence

The retained Chromium visual review of source `4b86ed9` inspected 513 images,
including all 71 catalog components at three sizes and all visualization states.
Table/comparison narrow RTL overflow is intentional; fresh focused keyboard
scroll and geometry checks passed. The review found a synthetic form-flow
invalid state claiming an empty required name while showing the populated
catalog example. Its fixture now clears the displayed field and draft together,
requires the field, and asserts the actual empty value. The prior fixture failed
the new assertion; all nine browser/size variants and visual TypeScript checks
passed after correction. No component, package or live site behavior changed.
The historical clean fixture source `4a7562f4f552ba1349c487243ad81aa047d1b6ae`
passed required quality `36672716809`. Its pinned Linux full visual aggregate
contains 1,830 tests and 2,862 PNGs: 610 tests/954 images per browser, two
byte-identical captures, sourceBuilt=true and candidateDirty=false. Fixture
SHA is `5f1e2c7b664412af5b79572b16db1935d1f835238f9a504f84932ebbbc096625`.

**Baseline approval, 30 September 2026:** root deliberately approves this
source/fixture and the exact recorded container, browsers and fonts after
review by root, Luna visual reviewer and an independent Sol metadata reviewer.
The retained Chromium review covers all 71 catalog components at three sizes
and visualization/important states; current inventory matches, 951/954 images
are byte-identical to that reviewed source, and all three corrected invalid-form
frames were reviewed. Firefox and WebKit each had all 954 images inspected in
contact sheets, all 71 desktop component images and 21 important state images
inspected at full resolution. Narrow RTL tables retain intentional horizontal
scrolling. This does not claim exhaustive full-resolution review of all 2,862
images or assistive-technology acceptance. The exact runner and two-capture,
zero-diff policy are recorded in `scripts/visual/baseline.json`.

Strict pinned-image comparison passed on approval commit
`6e1ab03f405c8c50b4238144fd952440c2c92e8d`, quality run `36682155398`.
Its fresh aggregate reports approved=true, full scope, 1,830 tests and 2,862
images across Chromium, Firefox and WebKit against the exact fixture SHA above.
The required functional shards, aggregate and release contract also passed.
The earlier probe stays `probe-reproducible-unapproved`; it is not relabeled.
The paired performance job failed before measurement because its workload
hash differed from the old baseline. Qualification was owner-deferred on
30 September. The later 1 October planner timing policy and 0.6.3 release
evidence are recorded below; this historical report is not relabeled.

## Current release: 0.6.3

The owner requested all outstanding fixes and a release on 1 October 2026.
All five packages and the same-source production image are published and live.
Live verification, the committed acceptance receipt and the GitHub release
record are complete. Package versions, peer pins, examples and current
installation instructions align at 0.6.3. Public APIs and runtime/wire contracts remain
compatible with 0.6.2.

1. **Next.js security fix — published:** the integration fixture uses
   security-patched Next.js 16.3.6. The frozen installation, optimized production
   build and real SSR/hydration checks passed; the fixture does not use
   ImageResponse. GitHub alerts 3 and 5, which identify the same Node `next/og`
   ImageResponse RCE, are fixed and there are zero open alerts.
2. **Form and dialog repairs — verified:** double-click Done preserves trigger
   focus using the `mousedown` click count before default focus behavior. Saved
   widgets reset only unchanged fields to registered defaults and preserve newer
   edits. Presentation adaptation waits for the action to settle, then resumes
   for the current region with the existing task and authority checks. Independent
   review found no actionable issues. The required matrix includes the
   three-browser action-review regression and now has 93 commands. All 36
   site form/dialog browser/width cases passed on the release source, and all
   36 corresponding production cases passed without skips or flaky outcomes.
3. **Final source quality and visual evidence — passed:** local clean source
   `599421e4` passed all 93 commands without source changes. Pull request
   [quality run 36812332528](https://github.com/Arconath/aeliqo/actions/runs/36812332528)
   passed the full 93-command matrix. Exact final source
   `f697627b65aec0a1b0e81159fe13b9f19ddce74c` passed the same full matrix and
   release contract in main-push
   [quality run 36814670613](https://github.com/Arconath/aeliqo/actions/runs/36814670613).
   Its approved visual aggregate passed 1,830 tests and 2,862 images across
   Chromium, Firefox and WebKit, with zero pixel differences and byte-identical
   repeated captures against approved source `6c31d36`. The fixture SHA is
   `99515fd220704b5ea51993d0090c802ec8ecf0e1b47f64a4c07d25fa8ce8ee79`;
   the [visual reference review](testing/0.6.3-visual-reference.md) preserves the
   approval evidence and review scope.
4. **Planner timing policy — removal verified:** the owner permanently removed
   the absolute presentation-planner timing gate on 1 October, as recorded in
   [ADR 014](adr/014-planner-timing-diagnostics.md). Configuration, policy
   validation, browser assertions, paired-report acceptance and contributor
   guidance treat planner timings as diagnostic, with no replacement threshold.
   Existing reducer, mounted-row, relative comparison, provenance, functional
   and visual policies remain. The changed workload identity retired the earlier
   performance reference; the current reference is unapproved and comparison
   evidence remains advisory. No new performance baseline is required to release.
   The earlier [performance reference review](testing/0.6.3-performance-reference.md)
   preserves its historical measurements and approval evidence.
5. **Package publication — verified:**
   [RC run 36821306728](https://github.com/Arconath/aeliqo/actions/runs/36821306728)
   and [stable run 36822915145](https://github.com/Arconath/aeliqo/actions/runs/36822915145)
   succeeded at exact source `f697627`. Canonical `verify-approved-rc` and
   `verify-approved-stable` both passed all five registry consumers and source
   provenance. Stable 0.6.3 is now `latest` for all five packages.
6. **Image, live promotion and release receipts — complete:**
   [image run 36824490075](https://github.com/Arconath/aeliqo/actions/runs/36824490075)
   succeeded with registry-verified SLSA provenance and SBOM, and zero high or
   critical findings. Its immutable digest is the published `eea9879` image
   above, with site/SDK revision `f697627` and SDK 0.6.3. Reviewed and validated
   canonical preflight promoted GitOps revision `83aaf375`; Flux, replicas and
   canonical public acceptance and all recorded public UI cases passed. Independent
   review of the GitOps acceptance record found no actionable issues. That record
   is pushed in commit `414cb72723af0773153c73cb96737d579075a18d`, and the final
   runtime readback matches it exactly. The stable
   [GitHub 0.6.3 release](https://github.com/Arconath/aeliqo/releases/tag/v0.6.3)
   is published with its tag at the exact verified source.

The initial 0.6.2 performance failure was a workload-identity mismatch, not a
measured regression: the digest at that time was
`c9f7283566889e784043cc07703215c6ca882dfdd45da284dc9849e6326314fb`
and the historical approved digest is
`867fadc9677857bbbca368716c9d52a78d97e7e5cb419f66207e1d42ed65c913`.
The changed fixture opens the collapsed exact-data disclosure and uses current
row copy; the bundle threshold change was already owner-approved for 0.6.0.
The historical source `dcb9837` passed its strict paired comparison against
`d90a2c8` in
[run 36775350492](https://github.com/Arconath/aeliqo/actions/runs/36775350492)
under the policy then in effect. Later final-source comparisons recorded planner
p95 of 17 ms under the former rule; an unchanged-source recheck failed on the
reference at 18.1 ms before measuring the candidate. An exact-source probe
recorded 14.9/16.3 ms and stopped early; its companion comparison recorded
15.5/16.2 ms. These failed reports remain historical evidence; no observations
were discarded or relabeled as passing. Workload identities and the remaining
policies are still verified. This release makes no latency speedup claim.

The site is stateless, so there is no data migration. The previously accepted
immutable `cebbb901` image and source `fb04d4a` remain the rollback target;
application rollback does not unpublish npm versions. This is recovery readiness
only: no executed disaster restore, relocation or live rollback drill is claimed.
The required pull request and exact-source full-matrix main push are complete.

## Historical 0.6.2 site repair

The previously accepted site/SDK source was
`fb04d4a752fb1357a6ab2c6aaf4969aafbd22aa4`, SDK 0.6.2, image
`ghcr.io/arconath/aeliqo-web@sha256:cebbb901d898ee677af05a4b79c1715fac87bfdfb44e3e578f2e8ab983a2b3ca`,
at GitOps pin `658b6703a13e2bb7ab9afa9eaa069f211b3f3589`. This historical
acceptance remains the qualified rollback target; it is not the current image.

Focused live Chromium review on 30 September 2026 exercised the homepage,
docs quickstart and playground at 360 and 1440 pixels. Homepage filtering and
trend, docs shortcut/search, and playground filtered/chart/workspace/page
journeys passed without page errors. The mobile quickstart table triggered
axe's `scrollable-region-focusable` finding: its 608-pixel content sits in a
326-pixel container without a keyboard tab stop. This review does not establish
screen-reader acceptance or repeat all browser/component coverage.

The findings above are now fixed in the reviewed site/docs change. The quickstart
results table reflows at 320, 360, 768 and 1440 pixels, keeps intent identifiers
on one line, and remains a named keyboard focus stop with or without JavaScript.
The narrow playground task chooser now precedes the result in both visual and
DOM order. README and introductory guides distinguish standalone components,
the smaller local React surface, and the registered-resource quickstart.

Fresh local verification passed `pnpm format:check`, `pnpm lint`,
`pnpm site:test`, `pnpm test:docs-artifact` and `pnpm site:build`, plus the
production image contract smoke. A focused review of that local image passed
27 homepage/quickstart/playground renders in Chromium, Firefox and WebKit at
360, 768 and 1440 pixels, with no page errors or settled axe findings, and
three no-JavaScript keyboard/reflow checks at 320 pixels. Independent source
and focused screenshot review supported the changes. These checks used a
modified local tree; they do not replace exact-commit CI or deployment evidence.

The first release CI run caught a Linux font-dependent overflow at 320 pixels.
Prose in the quickstart table now has additional word-wrap opportunities while
intent identifiers stay unbroken. Regression coverage also exercises a wider
fallback font. Clean source `b5b2cb054820f624e0095d96a690ca063419b9fa`
passed all 92 local acceptance commands and required CI `36739295753`, plus
the approved pinned Linux visual aggregate. Site build `36749158528` then
rejected `scripts/visual/baseline.json` as a package change. The site-only
classifier now permits that exact visual evidence file; package source,
package guides, the lockfile and other scripts remain rejected. An executable
regression reproduced the rejection before the fix and all 32 release-tooling
tests passed afterward. Exact-source quality run `36750567829` passed all
required checks; production image run `36759903067` and live acceptance for
source `fb04d4a` passed. A post-release fix to the live smoke test's search
initialization wait was verified against production without changing the
deployed image or package artifacts.

## Repository follow-up, 2 October 2026

The current support matrix points to the 0.6.3 release receipts and separates
required functional acceptance from advisory visual and paired-performance
evidence. The historical 0.6.0 records remain available. This documentation
update does not publish packages or deploy a new site image.

## Release preparation: 0.7.0

The owner authorized publication and production deployment on 9 October.
[PR 57](https://github.com/Arconath/aeliqo/pull/57) merged the eleven audit
corrections and the revised landing page, documentation and playground at
`3205517231e455c23756c8ee917a598479db5917`. Its signed contribution passed
PR quality, all 93 acceptance commands and the release contract. Main-push
verification is running; this merge does not itself publish or deploy.

New dependency alerts reported during final release preflight are corrected
with patched Next.js, sharp, source-map-js, smol-toml and fast-uri versions.
Frozen installation, real Next SSR/hydration and the site build passed; fresh
pnpm audit reports zero advisories. Independent security review found no blocker.
Exact-source CI remains required before publication.

Final image preparation updates the static-server builder to security-patched
Go 1.27.2. The publisher keeps its build under a quarantine tag until provenance,
SBOM and HIGH/CRITICAL vulnerability checks pass, then promotes the same digest.
Nine publisher behavior checks, all 14 server tests on Go 1.27.2, workflow
policy checks, formatting and lint passed. Exact-source CI remains required
before release.

Contributor rollout is verified: the accepted-base workflow passed for the
signed release contribution. Remote main protection now requires `DCO`,
`functional` and `policy`, each bound to GitHub Actions app `15368`, with strict
branch freshness. Readback confirmed every other branch control was preserved.
The additive provider configuration passed independent review and Linux CI.

The next candidate is 0.7.0. OAuth integrations must explicitly pin the expected
issuer and reconnect credentials without an issuer stamp; the 0.6-to-0.7
migration guide documents that compatibility change. Publication requires a
fully verified main revision, an accepted registry RC, stable registry consumers
and the same-source production image. The published table above remains 0.6.3
until those steps and live acceptance complete.

## Open items

The [9 October launch audit](testing/2026-10-09-launch-audit.md) records the
original OAuth, form, validation, MCP action, input-admission, performance and
contributor-flow findings. Its local matrix stopped on a controller-commit
performance gate; an isolated repeat and the remaining commands passed.
The [remediation record](testing/2026-10-09-remediation.md) tracks source
corrections for all eleven findings and the revised site/docs/playground design.
Clean local snapshot `21c427b063ac537e0b4bbfa84c6a8e5263b00338` passed the
complete site gate and all 93 unchanged acceptance commands, 1,830 full visual
cases across three engines, 60 final input regressions, and same-source local
production image contracts plus five representative routes. Independent review
verified the command/log receipts and source identity. The snapshot is locally
authored by Codex without human contribution certification; it does not replace
accepted main-push CI or a maintainer release revision. These changes remain
unreleased and add no fresh remote production health or deployment receipt.

| Item                                                                                                                                                                                                                            | Next step                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Real-model success rate and external adoption remain unproven.                                                                                                                                                                  | Collect evidence from real integrations without inferring model success from deterministic tests. |
| Native WebMCP requires an experimental browser flag.                                                                                                                                                                            | Keep the experimental scope explicit while baseline browser availability remains unproven.        |
| Web SEO/GEO baseline: source adds per-host `llms.txt`, Open Graph/Twitter cards with a 1200×630 image, Organization JSON-LD and the `test:seo` CI check; not yet deployed. No FAQPage data because the site has no visible FAQ. | Merge, redeploy the site image, then verify `/llms.txt` on both hosts and the card metadata live. |

The planner policy removal and patched Next.js release are complete; neither is
an open release blocker. Visual and paired-performance jobs are advisory; the
functional matrix in `quality/commands.json` is the required gate. Aeliqo keeps
its GitHub-hosted OSS and site-release workflows; hosted-product auth, billing
and staging do not apply.
